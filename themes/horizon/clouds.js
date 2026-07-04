import * as THREE from 'three';

/**
 * Volumetric cloudscape after Schneider & Vos, "The Real-Time Volumetric
 * Cloudscapes of Horizon Zero Dawn" (SIGGRAPH 2015) and Schneider's
 * "Nubis" follow-ups, with the energy-conserving scatter integration
 * from Hillaire's Frostbite course (2016):
 *
 *  - base shape: tileable Perlin-Worley 3D noise (64^3; the paper uses
 *    128^3 - the only concession, for CPU generation time), remapped by
 *    the REAL low-cloud cover
 *  - weather map (Schneider's 2D coverage texture): a low-frequency,
 *    wind-advected field varies cover across the sky. It is built as the
 *    difference of two samples of the same stationary noise, which has
 *    exactly zero mean - the reported cover is conserved, not decorated
 *  - vertical profiles by cloud TYPE (stratus / cumulus / cumulonimbus
 *    height gradients as in Nubis), selected by the reported WMO code
 *  - edge erosion: tileable Worley 3D detail (32^3), wispy at the base
 *    and billowy at the tops (the paper's height-dependent mix)
 *  - lighting: Beer-powder toward the sun with a dual-lobe
 *    Henyey-Greenstein phase, plus sky ambient
 *  - adaptive march (Schneider sec. 5): a cheap erosion-free ranging
 *    pass at coarse step finds the cloud boundary, then the full-detail
 *    march spends every step inside the occupied span
 *  - the slab sits at the real lifting condensation level and is
 *    advected by the real wind; per-pixel dithered march start kills
 *    banding
 *
 * Both the low deck and the 700 hPa altostratus deck are volumetric
 * instances of this shader (extinction is a uniform - altostratus has
 * a genuinely lower liquid water content than cumulus). High ice cloud
 * stays a 2D treatment, as in the research.
 */

// ---------- tileable noise generation (CPU, once, lazily) ----------

function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tileable 3D Perlin noise with period wrapping.
function makePerlin(period, seed) {
  const rand = mulberry(seed);
  const perm = new Uint8Array(512);
  const grads = [];
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = perm[i & 255];
  for (let i = 0; i < 16; i++) {
    const th = rand() * Math.PI * 2;
    const z = rand() * 2 - 1;
    const r = Math.sqrt(1 - z * z);
    grads.push([r * Math.cos(th), r * Math.sin(th), z]);
  }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const g = (ix, iy, iz, dx, dy, dz) => {
    const gi =
      grads[
        perm[
          (((ix % period) + period) % period) +
            perm[
              ((((iy % period) + period) % period) +
                perm[((iz % period) + period) % period]) &
                255
            ]
        ] & 15
      ];
    return gi[0] * dx + gi[1] * dy + gi[2] * dz;
  };
  return (x, y, z) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fy = y - iy;
    const fz = z - iz;
    const u = fade(fx);
    const v = fade(fy);
    const w = fade(fz);
    const lerp = (a, b, t) => a + (b - a) * t;
    return lerp(
      lerp(
        lerp(g(ix, iy, iz, fx, fy, fz), g(ix + 1, iy, iz, fx - 1, fy, fz), u),
        lerp(
          g(ix, iy + 1, iz, fx, fy - 1, fz),
          g(ix + 1, iy + 1, iz, fx - 1, fy - 1, fz),
          u
        ),
        v
      ),
      lerp(
        lerp(
          g(ix, iy, iz + 1, fx, fy, fz - 1),
          g(ix + 1, iy, iz + 1, fx - 1, fy, fz - 1),
          u
        ),
        lerp(
          g(ix, iy + 1, iz + 1, fx, fy - 1, fz - 1),
          g(ix + 1, iy + 1, iz + 1, fx - 1, fy - 1, fz - 1),
          u
        ),
        v
      ),
      w
    );
  };
}

// Tileable 3D Worley (cellular) noise, inverted: 1 at feature points.
function makeWorley(period, seed) {
  const rand = mulberry(seed);
  const pts = {};
  for (let x = 0; x < period; x++)
    for (let y = 0; y < period; y++)
      for (let z = 0; z < period; z++)
        pts[x + ',' + y + ',' + z] = [rand(), rand(), rand()];
  return (px, py, pz) => {
    // px..pz in cell units
    const cx = Math.floor(px);
    const cy = Math.floor(py);
    const cz = Math.floor(pz);
    let dMin = 9;
    for (let ox = -1; ox <= 1; ox++)
      for (let oy = -1; oy <= 1; oy++)
        for (let oz = -1; oz <= 1; oz++) {
          const wx = (((cx + ox) % period) + period) % period;
          const wy = (((cy + oy) % period) + period) % period;
          const wz = (((cz + oz) % period) + period) % period;
          const f = pts[wx + ',' + wy + ',' + wz];
          const dx = cx + ox + f[0] - px;
          const dy = cy + oy + f[1] - py;
          const dz = cz + oz + f[2] - pz;
          const d = dx * dx + dy * dy + dz * dz;
          if (d < dMin) dMin = d;
        }
    return Math.max(0, 1 - Math.sqrt(dMin));
  };
}

const remap = (v, a, b, c, d) =>
  c + ((Math.min(Math.max(v, a), b) - a) / (b - a)) * (d - c);

export function generateCloudTextures() {
  // Base: R = Perlin-Worley, GBA = Worley fBm octaves (Schneider fig. 4).
  const N = 64;
  const perlin = makePerlin(8, 1717);
  const w4 = makeWorley(4, 41);
  const w8 = makeWorley(8, 42);
  const w16 = makeWorley(16, 43);
  const base = new Uint8Array(N * N * N * 4);
  let k = 0;
  for (let z = 0; z < N; z++)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const u = x / N;
        const v = y / N;
        const w = z / N;
        let p = 0;
        let amp = 1;
        let freq = 8;
        for (let o = 0; o < 4; o++) {
          p += perlin(u * freq, v * freq, w * freq) * amp;
          amp *= 0.5;
          freq *= 2;
        }
        p = p * 0.5 + 0.5;
        const c4 = w4(u * 4, v * 4, w * 4);
        const c8 = w8(u * 8, v * 8, w * 8);
        const c16 = w16(u * 16, v * 16, w * 16);
        const wf = c4 * 0.625 + c8 * 0.25 + c16 * 0.125;
        // Perlin-Worley: dilate Perlin by the Worley fBm.
        const pw = remap(p, -(1 - wf), 1, 0, 1);
        base[k++] = pw * 255;
        base[k++] = c4 * 255;
        base[k++] = c8 * 255;
        base[k++] = c16 * 255;
      }
  const baseTex = new THREE.Data3DTexture(base, N, N, N);
  baseTex.format = THREE.RGBAFormat;
  baseTex.minFilter = baseTex.magFilter = THREE.LinearFilter;
  baseTex.wrapS = baseTex.wrapT = baseTex.wrapR = THREE.RepeatWrapping;
  baseTex.needsUpdate = true;

  // Detail: RGB Worley octaves for edge erosion.
  const M = 32;
  const d2 = makeWorley(2, 51);
  const d4 = makeWorley(4, 52);
  const d8 = makeWorley(8, 53);
  const det = new Uint8Array(M * M * M * 4);
  k = 0;
  for (let z = 0; z < M; z++)
    for (let y = 0; y < M; y++)
      for (let x = 0; x < M; x++) {
        const u = x / M;
        const v = y / M;
        const w = z / M;
        det[k++] = d2(u * 2, v * 2, w * 2) * 255;
        det[k++] = d4(u * 4, v * 4, w * 4) * 255;
        det[k++] = d8(u * 8, v * 8, w * 8) * 255;
        det[k++] = 255;
      }
  const detailTex = new THREE.Data3DTexture(det, M, M, M);
  detailTex.format = THREE.RGBAFormat;
  detailTex.minFilter = detailTex.magFilter = THREE.LinearFilter;
  detailTex.wrapS = detailTex.wrapT = detailTex.wrapR = THREE.RepeatWrapping;
  detailTex.needsUpdate = true;

  return {baseTex, detailTex};
}

// ---------- the raymarched deck ----------

const CLOUD_FRAG = /* glsl */ `
  precision highp sampler3D;
  uniform sampler3D baseTex;
  uniform sampler3D detailTex;
  uniform vec3 sunDirW;
  uniform vec3 sunCol;
  uniform vec3 ambCol;
  uniform float cov;     // real low-cloud cover 0..1
  uniform float yBase;   // real LCL, scene units
  uniform float yTop;
  uniform float cType;   // 0 stratus, 1 cumulus, 2 cumulonimbus (WMO code)
  uniform float sigma;   // extinction per scene unit at density 1
  uniform vec2 wOff;     // real wind advection offset
  in vec3 vWorld;
  out vec4 outColor;

  float remapf(float v, float a, float b, float c, float d) {
    return c + (clamp(v, a, b) - a) / (b - a) * (d - c);
  }

  // Weather map (Schneider's 2D coverage texture): low-frequency,
  // wind-advected spatial variation of the cover. The difference of two
  // samples of the same stationary noise has exactly zero mean, so the
  // REAL reported cover is conserved across the sky, not decorated.
  float coverAt(vec2 xz) {
    vec2 q = (xz + wOff) * 0.0019;
    float wvar = texture(baseTex, vec3(q.x, 0.5, q.y)).g -
                 texture(baseTex, vec3(q.x + 0.5, 0.13, q.y + 0.5)).g;
    return clamp(cov + wvar * 1.6 * cov * (1.0 - cov), 0.0, 1.0);
  }

  // Height gradients by cloud type (Nubis): a thin flat stratus sheet,
  // the round-topped cumulus, the full-depth cumulonimbus tower.
  float heightProfile(float h) {
    float vpS = smoothstep(0.0, 0.1, h) * (1.0 - smoothstep(0.25, 0.55, h));
    float vpC = smoothstep(0.0, 0.08, h) * smoothstep(1.0, 0.3, h);
    float vpT = smoothstep(0.0, 0.05, h) * smoothstep(1.0, 0.9, h);
    return mix(
      mix(vpS, vpC, clamp(cType, 0.0, 1.0)),
      vpT,
      clamp(cType - 1.0, 0.0, 1.0)
    );
  }

  // Erosion-free density: the base shape only. Used by the coarse
  // ranging pass, and as the first (early-out) half of density().
  float densityCoarse(vec3 p, float h) {
    vec3 uvw = vec3(
      (p.x + wOff.x) * 0.0055,
      p.y * 0.016,
      (p.z + wOff.y) * 0.0055
    );
    vec4 nb = texture(baseTex, uvw);
    float wfbm = nb.g * 0.625 + nb.b * 0.25 + nb.a * 0.125;
    float d = remapf(nb.r, -(1.0 - wfbm), 1.0, 0.0, 1.0);
    // Coverage remap (Schneider): the real cover carves the field.
    float covL = coverAt(p.xz);
    d = remapf(d, 1.0 - covL, 1.0, 0.0, 1.0) * covL;
    return d * heightProfile(h);
  }

  float density(vec3 p, float h) {
    float d = densityCoarse(p, h);
    if (d <= 0.0) return 0.0;
    // Erosion: wispy at the base, billowy at the top.
    vec3 uvw = vec3(
      (p.x + wOff.x) * 0.0055,
      p.y * 0.016,
      (p.z + wOff.y) * 0.0055
    );
    vec3 dn = texture(detailTex, uvw * 6.0).rgb;
    float dfbm = dn.r * 0.625 + dn.g * 0.25 + dn.b * 0.125;
    float er = mix(dfbm, 1.0 - dfbm, clamp(h * 3.0, 0.0, 1.0));
    d = remapf(d, er * 0.35, 1.0, 0.0, 1.0);
    return clamp(d, 0.0, 1.0);
  }

  float hg(float c, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * 3.14159265 * pow(1.0 + g2 - 2.0 * g * c, 1.5));
  }

  float hash12(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec3 ro = cameraPosition;
    vec3 rd = normalize(vWorld - cameraPosition);
    // Slab entry/exit.
    if (abs(rd.y) < 1e-4) discard;
    float t0 = (yBase - ro.y) / rd.y;
    float t1 = (yTop - ro.y) / rd.y;
    if (t0 > t1) { float tt = t0; t0 = t1; t1 = tt; }
    t0 = max(t0, 0.0);
    t1 = min(t1, 2600.0);
    if (t1 <= t0) discard;
    // Aerial fade: the deck dissolves into the horizon haze instead of
    // ending at a hard march boundary.
    float horizonFade = exp(-t0 * 0.0011);

    // Adaptive march (Schneider sec. 5): a cheap erosion-free ranging
    // pass at coarse step finds the first occupied sample; the
    // full-detail march then spends every step inside the cloud span
    // instead of on empty air before it.
    const int COARSE = 14;
    float dtc = (t1 - t0) / float(COARSE);
    float tStart = -1.0;
    float tc = t0 + dtc * 0.5;
    for (int i = 0; i < COARSE; i++) {
      vec3 pc = ro + rd * tc;
      float hc = clamp((pc.y - yBase) / (yTop - yBase), 0.0, 1.0);
      if (densityCoarse(pc, hc) > 0.0) {
        tStart = max(tc - dtc, t0);
        break;
      }
      tc += dtc;
    }
    if (tStart < 0.0) discard;

    const int STEPS = 28;
    float dt = (t1 - tStart) / float(STEPS);
    // Dithered start: trades banding for noise (Schneider sec. 5).
    float t = tStart + dt * hash12(gl_FragCoord.xy);

    float cSun = dot(rd, sunDirW);
    float phase = mix(hg(cSun, 0.6), hg(cSun, -0.3), 0.35);

    vec3 L = vec3(0.0);
    float T = 1.0;
    for (int i = 0; i < STEPS; i++) {
      vec3 p = ro + rd * t;
      float h = clamp((p.y - yBase) / (yTop - yBase), 0.0, 1.0);
      float d = density(p, h);
      if (d > 0.01) {
        // 4-tap Beer toward the sun.
        float tauS = 0.0;
        float dts = (yTop - p.y) / max(sunDirW.y, 0.25) * 0.25;
        dts = clamp(dts, 0.4, 6.0);
        for (int s = 1; s <= 4; s++) {
          vec3 ps = p + sunDirW * dts * float(s);
          float hs = clamp((ps.y - yBase) / (yTop - yBase), 0.0, 1.0);
          tauS += density(ps, hs) * dts;
        }
        tauS *= sigma;
        // Beer-powder (Schneider 2015).
        float beer = exp(-tauS) * (1.0 - exp(-2.0 * tauS)) * 2.0;
        vec3 S =
          sunCol * beer * phase * 18.0 +
          ambCol * mix(0.35, 1.0, h);
        float sig = sigma * d;
        float sT = exp(-sig * dt);
        L += T * (S - S * sT); // energy-conserving (Hillaire 2016)
        T *= sT;
        if (T < 0.01) break;
      }
      t += dt;
    }
    if (T > 0.995) discard;
    outColor = vec4(L, (1.0 - T) * horizonFade);
  }
`;

export function createCloudDeck() {
  const uniforms = {
    baseTex: {value: null},
    detailTex: {value: null},
    sunDirW: {value: new THREE.Vector3(0, 1, 0)},
    sunCol: {value: new THREE.Color(1, 1, 1)},
    ambCol: {value: new THREE.Color(0.3, 0.35, 0.4)},
    cov: {value: 0},
    yBase: {value: 24},
    yTop: {value: 38},
    cType: {value: 1},
    sigma: {value: 0.9},
    wOff: {value: new THREE.Vector2(0, 0)}
  };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(480, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      glslVersion: THREE.GLSL3,
      uniforms,
      vertexShader:
        'out vec3 vWorld; void main(){' +
        ' vWorld = (modelMatrix * vec4(position, 1.0)).xyz;' +
        ' gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: CLOUD_FRAG
    })
  );
  mesh.visible = false;
  return {mesh, uniforms};
}
