import * as THREE from 'three';
import {generateCloudArrays} from './cloud-noise.js';

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
 *  - temporal reconstruction (Schneider sec. 5, as shipped in HZD):
 *    the march renders into a QUARTER-resolution buffer, one pixel of
 *    every 4x4 Bayer block marched fresh per frame, the other fifteen
 *    reprojected from the previous frame through the previous
 *    view-projection; rays clamp against the real terrain depth, and
 *    the composite upsamples depth-aware (Wronski 2014) so cloud never
 *    bleeds across ridge silhouettes
 *  - both decks (cumulus at the LCL, altostratus at 700 hPa) march in
 *    the SAME pass, composited front-to-back in slab order, with
 *    premultiplied-alpha output - the volumetric integral already
 *    weights its radiance, so straight alpha blending would dim it
 *    twice
 *  - the slabs are advected by their real winds; per-pixel dithered
 *    march start kills banding
 *
 * High ice cloud stays a 2D treatment, as in the research.
 */

// ---------- tileable noise (shared definition in cloud-noise.js) ----------

export function generateCloudTextures() {
  const {base, N, det, M} = generateCloudArrays();
  const baseTex = new THREE.Data3DTexture(base, N, N, N);
  baseTex.format = THREE.RGBAFormat;
  baseTex.minFilter = baseTex.magFilter = THREE.LinearFilter;
  baseTex.wrapS = baseTex.wrapT = baseTex.wrapR = THREE.RepeatWrapping;
  baseTex.needsUpdate = true;
  const detailTex = new THREE.Data3DTexture(det, M, M, M);
  detailTex.format = THREE.RGBAFormat;
  detailTex.minFilter = detailTex.magFilter = THREE.LinearFilter;
  detailTex.wrapS = detailTex.wrapT = detailTex.wrapR = THREE.RepeatWrapping;
  detailTex.needsUpdate = true;
  return {baseTex, detailTex};
}

// ---------- the temporally reconstructed march ----------

// Shared GLSL: per-slab density model (parameterised so both decks run
// in ONE pass) and helpers.
const DENSITY_GLSL = /* glsl */ `
  float remapf(float v, float a, float b, float c, float d) {
    return c + (clamp(v, a, b) - a) / (b - a) * (d - c);
  }

  // Weather map (Schneider's 2D coverage texture): low-frequency,
  // wind-advected spatial variation of the cover. The difference of two
  // samples of the same stationary noise has exactly zero mean, so the
  // REAL reported cover is conserved across the sky, not decorated.
  float coverAt(vec2 xz, float cov, vec2 wOff) {
    vec2 q = (xz + wOff) * 0.0019;
    float wvar = texture(baseTex, vec3(q.x, 0.5, q.y)).g -
                 texture(baseTex, vec3(q.x + 0.5, 0.13, q.y + 0.5)).g;
    return clamp(cov + wvar * 1.6 * cov * (1.0 - cov), 0.0, 1.0);
  }

  // Height gradients by cloud type (Nubis): a thin flat stratus sheet,
  // the round-topped cumulus, the full-depth cumulonimbus tower.
  float heightProfile(float h, float cType) {
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
  float densityCoarse(vec3 p, float h, float cov, float cType, vec2 wOff) {
    vec3 uvw = vec3(
      (p.x + wOff.x) * 0.0055,
      p.y * 0.016,
      (p.z + wOff.y) * 0.0055
    );
    vec4 nb = texture(baseTex, uvw);
    float wfbm = nb.g * 0.625 + nb.b * 0.25 + nb.a * 0.125;
    float d = remapf(nb.r, -(1.0 - wfbm), 1.0, 0.0, 1.0);
    // Coverage remap (Schneider): the real cover carves the field.
    float covL = coverAt(p.xz, cov, wOff);
    d = remapf(d, 1.0 - covL, 1.0, 0.0, 1.0) * covL;
    return d * heightProfile(h, cType);
  }

  float density(vec3 p, float h, float cov, float cType, vec2 wOff) {
    float d = densityCoarse(p, h, cov, cType, wOff);
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
`;

// Reconstruct the world-space distance to the terrain along a pixel's
// ray from the depth prepass (depth 1.0 = far plane = unoccluded sky).
const SCENEDIST_GLSL = /* glsl */ `
  float sceneDist(vec2 uv, vec2 ndc) {
    float d = texture(depthTex, uv).r;
    if (d >= 0.9999) return 1e8;
    vec4 w = invVP * vec4(ndc, d * 2.0 - 1.0, 1.0);
    return length(w.xyz / w.w - camPos);
  }
`;

const MARCH_FRAG = /* glsl */ `
  precision highp float;
  precision highp sampler3D;
  uniform sampler3D baseTex;
  uniform sampler3D detailTex;
  uniform sampler2D histTex;   // previous frame's reconstruction
  uniform sampler2D depthTex;  // full-res terrain depth prepass
  uniform mat4 invVP;
  uniform mat4 prevVP;
  uniform vec3 camPos;
  uniform vec3 sunDirW;
  uniform vec3 sunCol;
  uniform vec3 ambCol;
  uniform float covA;   // low deck: real low cover at the real LCL
  uniform float yBaseA;
  uniform float yTopA;
  uniform float cTypeA;
  uniform float sigmaA;
  uniform vec2 wOffA;
  uniform float covB;   // mid deck: altostratus at the 700 hPa level
  uniform float yBaseB;
  uniform float yTopB;
  uniform float cTypeB;
  uniform float sigmaB;
  uniform vec2 wOffB;
  uniform int frameI;
  uniform int warm;     // first frame: march every pixel
  in vec2 vUv;
  out vec4 outColor;

  __DENSITY__
  __SCENEDIST__

  // One slab, marched with the coarse ranging + fine march of the
  // single-deck shader; returns PREMULTIPLIED (L, alpha) with the
  // horizon fade folded into both.
  vec4 marchSlab(
    vec3 ro, vec3 rd, float jit, float sceneD,
    float yB, float yT, float cov, float cTy, float sg, vec2 wO,
    float phase
  ) {
    if (cov < 0.02 || abs(rd.y) < 1e-4) return vec4(0.0);
    float t0 = (yB - ro.y) / rd.y;
    float t1 = (yT - ro.y) / rd.y;
    if (t0 > t1) { float tt = t0; t0 = t1; t1 = tt; }
    t0 = max(t0, 0.0);
    t1 = min(t1, min(2600.0, sceneD));
    if (t1 <= t0) return vec4(0.0);
    // Aerial fade: the deck dissolves into the horizon haze instead of
    // ending at a hard march boundary.
    float fade = exp(-t0 * 0.0011);

    // Adaptive march (Schneider sec. 5): cheap erosion-free ranging,
    // then every detailed step spent inside the occupied span.
    const int COARSE = 14;
    float dtc = (t1 - t0) / float(COARSE);
    float tStart = -1.0;
    float tc = t0 + dtc * 0.5;
    for (int i = 0; i < COARSE; i++) {
      vec3 pc = ro + rd * tc;
      float hc = clamp((pc.y - yB) / (yT - yB), 0.0, 1.0);
      if (densityCoarse(pc, hc, cov, cTy, wO) > 0.0) {
        tStart = max(tc - dtc, t0);
        break;
      }
      tc += dtc;
    }
    if (tStart < 0.0) return vec4(0.0);

    const int STEPS = 28;
    float dt = (t1 - tStart) / float(STEPS);
    float t = tStart + dt * jit;

    vec3 L = vec3(0.0);
    float T = 1.0;
    for (int i = 0; i < STEPS; i++) {
      vec3 p = ro + rd * t;
      float h = clamp((p.y - yB) / (yT - yB), 0.0, 1.0);
      float d = density(p, h, cov, cTy, wO);
      if (d > 0.01) {
        // 4-tap Beer toward the sun.
        float tauS = 0.0;
        float dts = (yT - p.y) / max(sunDirW.y, 0.25) * 0.25;
        dts = clamp(dts, 0.4, 6.0);
        for (int s = 1; s <= 4; s++) {
          vec3 ps = p + sunDirW * dts * float(s);
          float hs = clamp((ps.y - yB) / (yT - yB), 0.0, 1.0);
          tauS += density(ps, hs, cov, cTy, wO) * dts;
        }
        tauS *= sg;
        // Beer-powder (Schneider 2015).
        float beer = exp(-tauS) * (1.0 - exp(-2.0 * tauS)) * 2.0;
        vec3 S = sunCol * beer * phase * 18.0 + ambCol * mix(0.35, 1.0, h);
        float sig = sg * d;
        float sT = exp(-sig * dt);
        L += T * (S - S * sT); // energy-conserving (Hillaire 2016)
        T *= sT;
        if (T < 0.01) break;
      }
      t += dt;
    }
    return vec4(L * fade, (1.0 - T) * fade);
  }

  void main() {
    vec2 ndc = vUv * 2.0 - 1.0;
    vec4 wf = invVP * vec4(ndc, 1.0, 1.0);
    vec3 rd = normalize(wf.xyz / wf.w - camPos);

    // Temporal reconstruction (Schneider sec. 5): one pixel of every
    // 4x4 Bayer block is marched fresh per frame; the other fifteen
    // reproject last frame's result through the previous
    // view-projection. The camera in this scene rotates but never
    // translates, so direction reprojection through a representative
    // point at cloud distance is exact for rotation and sub-pixel for
    // the residual.
    ivec2 pc = ivec2(gl_FragCoord.xy);
    int slot = (pc.x & 3) | ((pc.y & 3) << 2);
    const int bayer[16] = int[16](
      0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5
    );
    bool fresh = bayer[slot] == frameI || warm == 1;
    vec4 hist = vec4(0.0);
    bool histOk = false;
    vec4 pClip = prevVP * vec4(camPos + rd * 600.0, 1.0);
    if (pClip.w > 0.0) {
      vec2 pUv = (pClip.xy / pClip.w) * 0.5 + 0.5;
      if (all(greaterThanEqual(pUv, vec2(0.0))) &&
          all(lessThanEqual(pUv, vec2(1.0)))) {
        hist = texture(histTex, pUv);
        histOk = true;
      }
    }
    if (!fresh && histOk) {
      outColor = hist;
      return;
    }
    // History off-screen (a pan brought new sky in): march instead.

    float sceneD = sceneDist(vUv, ndc);
    // Temporal integration of the march-start dither: the jitter walks
    // a golden-ratio sequence each refresh and fresh marches blend into
    // history exponentially, so the estimate converges to the true
    // integral over time instead of freezing one noise pattern in.
    float jit = fract(hash12(gl_FragCoord.xy) + float(frameI) * 0.618034);
    float cSun = dot(rd, sunDirW);
    float phase = mix(hg(cSun, 0.6), hg(cSun, -0.3), 0.35);
    // Both decks in one pass, composited near-over-far (premultiplied);
    // the low deck is always the nearer slab from a ground camera.
    vec4 A = marchSlab(
      camPos, rd, jit, sceneD, yBaseA, yTopA, covA, cTypeA, sigmaA, wOffA,
      phase
    );
    vec4 B = marchSlab(
      camPos, rd, jit, sceneD, yBaseB, yTopB, covB, cTypeB, sigmaB, wOffB,
      phase
    );
    vec4 now = vec4(A.rgb + (1.0 - A.a) * B.rgb, A.a + (1.0 - A.a) * B.a);
    // Production temporal-accumulation blend: low alpha keeps the
    // stationary variance of the jittered estimate a few percent of a
    // single sample. Clouds, sun and weather all change over seconds,
    // so the ~2s convergence is well inside their real time scales.
    outColor = histOk && warm == 0 ? mix(hist, now, 0.08) : now;
  }
`;

// Depth-aware upsample of the quarter-res reconstruction (Wronski
// 2014): each full-res pixel weights the four nearest quarter texels
// by bilinear distance AND terrain-depth similarity, so cloud never
// bleeds across ridge silhouettes.
const COMPOSITE_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D cloudTex;  // quarter-res, premultiplied
  uniform sampler2D depthTex;  // full-res terrain depth
  uniform mat4 invVP;
  uniform vec3 camPos;
  uniform vec2 resQ;
  in vec2 vUv;
  out vec4 outColor;

  __SCENEDIST__

  void main() {
    vec2 ndc = vUv * 2.0 - 1.0;
    float dF = min(sceneDist(vUv, ndc), 4000.0);
    vec2 st = vUv * resQ - 0.5;
    vec2 i0 = floor(st);
    vec2 f = fract(st);
    vec4 acc = vec4(0.0);
    float wsum = 0.0;
    vec4 nearC = vec4(0.0);
    float nearD = 1e9;
    float dMin = 1e9;
    float dMax = 0.0;
    for (int j = 0; j < 2; j++)
      for (int i = 0; i < 2; i++) {
        vec2 tc = (i0 + vec2(float(i), float(j)) + 0.5) / resQ;
        tc = clamp(tc, vec2(0.0), vec2(1.0));
        float wb = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y);
        float dT = min(sceneDist(tc, tc * 2.0 - 1.0), 4000.0);
        float dd = abs(dF - dT);
        float w = wb * exp(-dd * 0.004) + 1e-5;
        vec4 c = texture(cloudTex, tc);
        acc += c * w;
        wsum += w;
        if (dd < nearD) {
          nearD = dd;
          nearC = c;
        }
        dMin = min(dMin, dT);
        dMax = max(dMax, dT);
      }
    // Depth-coherent neighbourhoods blend; a neighbourhood that
    // straddles a silhouette takes the single depth-nearest tap
    // (nearest-depth upsampling, Jansen & Bavoil 2010) - weighted
    // averaging across the edge is what causes striping there.
    outColor = dMax - dMin > 250.0 ? nearC : acc / wsum;
  }
`;

const QUAD_VERT =
  'out vec2 vUv; void main(){ vUv = uv;' +
  ' gl_Position = vec4(position.xy, 0.0, 1.0); }';

function quarterTarget(w, h) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false
  });
}

export function createCloudSystem(renderer) {
  const uniformsLow = {
    cov: {value: 0},
    yBase: {value: 24},
    yTop: {value: 38},
    cType: {value: 1},
    sigma: {value: 0.9},
    wOff: {value: new THREE.Vector2(0, 0)}
  };
  const uniformsMid = {
    cov: {value: 0},
    yBase: {value: 44},
    yTop: {value: 50},
    cType: {value: 0.15},
    sigma: {value: 0.45},
    wOff: {value: new THREE.Vector2(0, 0)}
  };
  const shared = {
    baseTex: {value: null},
    detailTex: {value: null},
    sunDirW: {value: new THREE.Vector3(0, 1, 0)},
    sunCol: {value: new THREE.Color(1, 1, 1)},
    ambCol: {value: new THREE.Color(0.3, 0.35, 0.4)}
  };

  const invVP = {value: new THREE.Matrix4()};
  const camPos = {value: new THREE.Vector3()};
  const marchU = {
    baseTex: shared.baseTex,
    detailTex: shared.detailTex,
    histTex: {value: null},
    depthTex: {value: null},
    invVP,
    prevVP: {value: new THREE.Matrix4()},
    camPos,
    sunDirW: shared.sunDirW,
    sunCol: shared.sunCol,
    ambCol: shared.ambCol,
    covA: uniformsLow.cov,
    yBaseA: uniformsLow.yBase,
    yTopA: uniformsLow.yTop,
    cTypeA: uniformsLow.cType,
    sigmaA: uniformsLow.sigma,
    wOffA: uniformsLow.wOff,
    covB: uniformsMid.cov,
    yBaseB: uniformsMid.yBase,
    yTopB: uniformsMid.yTop,
    cTypeB: uniformsMid.cType,
    sigmaB: uniformsMid.sigma,
    wOffB: uniformsMid.wOff,
    frameI: {value: 0},
    warm: {value: 1}
  };
  const compU = {
    cloudTex: {value: null},
    depthTex: marchU.depthTex,
    invVP,
    camPos,
    resQ: {value: new THREE.Vector2(1, 1)}
  };

  function fullscreen(fragmentShader, uniforms, blend) {
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms,
      vertexShader: QUAD_VERT,
      fragmentShader
    });
    if (blend) {
      // Premultiplied-alpha over: the volumetric integral's radiance is
      // already transmittance-weighted, so straight alpha blending
      // (which the old deck meshes used) dimmed it a second time.
      mat.transparent = true;
      mat.blending = THREE.CustomBlending;
      mat.blendSrc = THREE.OneFactor;
      mat.blendDst = THREE.OneMinusSrcAlphaFactor;
      mat.depthTest = false;
      mat.depthWrite = false;
    }
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    return {scene, mat};
  }

  const march = fullscreen(
    MARCH_FRAG.replace('__DENSITY__', DENSITY_GLSL).replace(
      '__SCENEDIST__',
      SCENEDIST_GLSL
    ),
    marchU,
    false
  );
  const comp = fullscreen(
    COMPOSITE_FRAG.replace('__SCENEDIST__', SCENEDIST_GLSL),
    compU,
    true
  );
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let rtA = null;
  let rtB = null;
  const prevVPStore = new THREE.Matrix4();

  function setSize(w, h) {
    const qw = Math.max(Math.ceil(w / 4), 8);
    const qh = Math.max(Math.ceil(h / 4), 8);
    if (rtA) {
      rtA.dispose();
      rtB.dispose();
    }
    rtA = quarterTarget(qw, qh);
    rtB = quarterTarget(qw, qh);
    compU.resQ.value.set(qw, qh);
    marchU.warm.value = 1; // history is gone; march everything once
  }

  function render(camera, depthTexture) {
    marchU.depthTex.value = depthTexture;
    camPos.value.setFromMatrixPosition(camera.matrixWorld);
    invVP.value.multiplyMatrices(
      camera.matrixWorld,
      camera.projectionMatrixInverse
    );
    marchU.prevVP.value.copy(prevVPStore);
    marchU.histTex.value = rtB.texture;
    renderer.setRenderTarget(rtA);
    renderer.render(march.scene, quadCam);
    renderer.setRenderTarget(null);
    const t = rtA;
    rtA = rtB;
    rtB = t; // rtB now holds the newest reconstruction
    prevVPStore.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    marchU.frameI.value = (marchU.frameI.value + 1) % 16;
    marchU.warm.value = 0;
  }

  function composite() {
    compU.cloudTex.value = rtB.texture;
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(comp.scene, quadCam);
    renderer.autoClear = auto;
  }

  return {uniformsLow, uniformsMid, shared, setSize, render, composite};
}
