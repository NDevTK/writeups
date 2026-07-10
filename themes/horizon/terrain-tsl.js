import {
  Color,
  DataTexture,
  FloatType,
  MeshStandardNodeMaterial,
  RedFormat,
  RGBAFormat,
  Vector2,
  Vector3
} from 'three/webgpu';
import {
  Fn,
  acos,
  attribute,
  cameraPosition,
  clamp,
  cos,
  cross,
  dot,
  exp,
  exp2,
  float,
  floor,
  fract,
  fwidth,
  int,
  length,
  log2,
  max,
  mix,
  normalize,
  positionWorld,
  pow,
  select,
  sin,
  smoothstep,
  sqrt,
  texture,
  transformNormalToView,
  uint,
  uniform,
  vec2,
  vec3
} from 'three/tsl';
import {
  ALPHA_G,
  CELL0,
  F0_ICE,
  FSPEC,
  LMAX,
  HBIN,
  N_GAUSS,
  NBAR_MIN,
  OMEGA_G,
  RHO
} from './snow-glints.js';
import {G_DHOT, G_GEO, G_VOL, H_GEO, H_VOL, THETA_MAX, XI0} from './ross-li.js';

// Black-sky cubic of the hotspot-corrected volume kernel: Lucht's
// fit plus the Maignan-excess fit (both on the g0 + g1 t^2 + g2 t^3
// basis, so the coefficients add).
const G_VOL_M = G_VOL.map((g, i) => g + G_DHOT[i]);

/**
 * TSL port of Horizon's terrain material (WebGPU project, phase 2).
 *
 * This is the SAME physics as the GLSL onBeforeCompile version in
 * Horizon.html, expressed as node code for WebGPURenderer:
 *  - per-pixel grass/rock/snow/sea from the DEM slope moments and
 *    the inverted asinh elevation, noise-jittered borders
 *  - LEADR filtering (Dupuy et al. 2013): the terrain reads a
 *    CPU-built slope-moment pyramid (leadr.js) instead of a normal
 *    map. The trilinear auto-LOD sample gives the footprint's MEAN
 *    slope (the filtered shading normal - normals do not average,
 *    slopes do) and its central variance, which inflates every
 *    microfacet lobe: alpha_eff^2 = alpha^2 + 2 sigma^2 for the
 *    body GGX and for the snow-glint lobe alike, so distant ridges
 *    neither alias nor lose their specular energy
 *  - Pierson-Moskowitz sea normals from the real wind (Hs = 0.21 U^2/g,
 *    Tp = 0.7305 U, deep-water dispersion) with Blinn glitter and
 *    Schlick fresnel; Monahan & O'Muircheartaigh whitecap fraction
 *  - per-pixel GGX roughness (vegetation ~0.95, rock ~0.88, snow 0.45)
 *  - the aerial-perspective hook: inscatter + mean transmittance from
 *    the Hillaire aerial LUT, then Koschmieder fog on the MEASURED
 *    visibility
 *
 * The node graph deduplicates shared subexpressions (the moments
 * sample, snow, slope) across colorNode / roughnessNode /
 * normalNode, so splitting the single GLSL terrainColor() into
 * separate nodes loses nothing.
 */

export function createTerrainNodeMaterial(momentsTex, aerial) {
  // TextureNodes are part of the graph; rebakes swap via node.value.
  // momentsTex: RGBA32F (E[sx], E[sz], E[sx^2], E[sz^2]) with
  // hand-built mips (leadr.js pyramid), trilinear filtering.
  const momentsTexNode = texture(momentsTex);
  const u = {
    uWorldSize: uniform(280),
    uCenterElev: uniform(300),
    uSnowy: uniform(0),
    uSnowLine: uniform(2300),
    uTime: uniform(0),
    uWindMs: uniform(3),
    uWindVec: uniform(new Vector2(1, 0)),
    uSunDirW: uniform(new Vector3(0, 1, 0)),
    uSunCol: uniform(new Color(0, 0, 0)),
    // Ross-Li vegetation BRDF (ross-li.js): fitted archetype kernel
    // weights (f_iso, f_vol, f_geo, red band), the diffuse-skylight
    // fraction of the current light rig, and the data gate (0 until
    // a MOD09A1 fit succeeds).
    uRossW: uniform(new Vector3(0, 0, 0)),
    uRossMix: uniform(1),
    uRossOn: uniform(0),
    // Black Marble measured night lights (nightlights.js): a
    // radiance field (nW/(cm^2 sr), linear) over the roam box, the
    // night factor, the exposure-matched gain and the gated
    // 2700 K Planckian lamp tint.
    uLightsOn: uniform(0),
    uLandOn: uniform(0),
    uLightsNight: uniform(0),
    uLightsGain: uniform(0.035),
    uLightsTint: uniform(new Vector3(1, 0.417, 0.1))
  };

  const thash = Fn(([p]) =>
    fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453))
  );

  const tnoise = Fn(([p]) => {
    const i = p.floor();
    const f = p.fract();
    const s = f.mul(f).mul(float(3).sub(f.mul(2)));
    return mix(
      mix(thash(i), thash(i.add(vec2(1, 0))), s.x),
      mix(thash(i.add(vec2(0, 1))), thash(i.add(vec2(1, 1))), s.x),
      s.y
    );
  });

  const tfbm = Fn(([p]) =>
    tnoise(p)
      .mul(0.6)
      .add(tnoise(p.mul(2.7).add(19)).mul(0.28))
      .add(tnoise(p.mul(6.1).add(47)).mul(0.12))
  );

  // Pierson-Moskowitz fully developed sea, identical constants to the
  // GLSL: two wave trains at their true deep-water dispersion speeds,
  // steepness pi*Hs/lambda tilting the normal.
  const seaNormal = Fn(([wp]) => {
    const U = max(u.uWindMs, 0.8);
    const Hs = U.mul(U).mul(0.21 / 9.81);
    const Tp = U.mul(0.7305);
    const Lp = max(Tp.mul(Tp).mul(1.5614), 4.0);
    const pm = wp.xz.mul(57.14);
    const d1 = normalize(u.uWindVec);
    const d2 = normalize(
      u.uWindVec.add(vec2(u.uWindVec.y.negate(), u.uWindVec.x).mul(0.6))
    );
    const k1 = Lp.reciprocal().mul(6.28318);
    const k2 = Lp.mul(0.45).reciprocal().mul(6.28318);
    const s1 = Hs.div(Lp).mul(3.14159);
    const a1 = cos(
      dot(pm, d1)
        .mul(k1)
        .sub(u.uTime.mul(k1.mul(9.81).sqrt()))
    );
    const a2 = cos(
      dot(pm, d2)
        .mul(k2)
        .sub(u.uTime.mul(k2.mul(9.81).sqrt()))
        .add(1.7)
    );
    const chop = tnoise(pm.mul(0.05).add(d1.mul(u.uTime.mul(0.15))))
      .sub(0.5)
      .mul(s1)
      .mul(1.2);
    const grad = d1
      .mul(s1.mul(a1))
      .add(d2.mul(s1.mul(0.6).mul(a2)))
      .add(vec2(chop, chop));
    return normalize(vec3(grad.x.negate(), 1.0, grad.y.negate()));
  });

  // Sun glitter: Blinn lobe on the wave normals with Schlick fresnel;
  // calm water gives a tight bright path, wind spreads it.
  const seaSpec = Fn(([wp]) => {
    const n = seaNormal(wp);
    const V = normalize(cameraPosition.sub(wp));
    const H = normalize(V.add(u.uSunDirW));
    const gloss = mix(700.0, 60.0, clamp(u.uWindMs.div(15.0), 0.0, 1.0));
    const f = pow(clamp(float(1).sub(dot(V, n)), 0.0, 1.0), 5.0)
      .mul(0.95)
      .add(0.05);
    return u.uSunCol
      .mul(pow(max(dot(n, H), 0.0), gloss))
      .mul(f)
      .mul(6.0);
  });

  // ---------- Zirr-Kaplanyan snow glints (see snow-glints.js) ----
  // The counting model's node mirror. Every hash input is a
  // non-negative integer, so pcg3d (uint32-exact on both backends)
  // matches the CPU reference bit for bit; the probe page
  // (harness/tsl-glint-probe.html) checks the integers directly.
  const pcg3dX = (x, y, z) => {
    let vx = x.mul(uint(1664525)).add(uint(1013904223));
    let vy = y.mul(uint(1664525)).add(uint(1013904223));
    let vz = z.mul(uint(1664525)).add(uint(1013904223));
    vx = vx.add(vy.mul(vz));
    vy = vy.add(vz.mul(vx));
    vz = vz.add(vx.mul(vy));
    vx = vx.bitXor(vx.shiftRight(uint(16)));
    vy = vy.bitXor(vy.shiftRight(uint(16)));
    vz = vz.bitXor(vz.shiftRight(uint(16)));
    vx = vx.add(vy.mul(vz));
    return vx; // only the first lane is consumed
  };

  // Poisson count by inverse CDF on one uniform (unrolled k <= 6,
  // matching the reference's truncation); above N_GAUSS the crystals
  // are sub-pixel and a matched mean/variance uniform stands in
  // (the paper's Gaussian regime).
  const countFromU = (u2, nbar) => {
    let p = exp(nbar.negate());
    let cdf = p;
    let N = float(0);
    for (let k = 1; k <= 6; k++) {
      N = N.add(select(u2.greaterThan(cdf), 1.0, 0.0));
      p = p.mul(nbar).div(k);
      cdf = cdf.add(p);
    }
    const gauss = nbar.add(u2.sub(0.5).mul(sqrt(nbar.mul(12))));
    return select(nbar.lessThanEqual(N_GAUSS), N, gauss);
  };

  const min2 = (a, b) => select(a.lessThan(b), a, b);

  // The glint factor: E[factor] = 1, so it multiplies the analytic
  // smooth facet lobe without changing its mean - near snow breaks
  // into discrete sparkle, far snow converges to the smooth lobe.
  const glintFactorNode = (pm, aM, hb, pHit) => {
    const lf = clamp(log2(max(aM, CELL0).div(CELL0)), 0.0, LMAX);
    const l0 = floor(lf);
    const tl = fract(lf);
    // hb components are SCALAR int nodes (vector .toInt() collapses
    // to a scalar - measured; scalar conversions are exact).
    const zKey = uint(hb[0].add(int(512)))
      .mul(uint(73856093))
      .bitXor(uint(hb[1].add(int(512))).mul(uint(19349663)))
      .bitXor(uint(hb[2].add(int(512))).mul(uint(83492791)));
    let sum = float(0);
    let nbarPix = float(0);
    for (let li = 0; li < 2; li++) {
      const l = li === 0 ? l0 : min2(l0.add(1), LMAX);
      const wl = li === 0 ? float(1).sub(tl) : tl;
      const s = exp2(l).mul(CELL0);
      const nbarCell = s.mul(s).mul(RHO).mul(pHit);
      nbarPix = nbarPix.add(wl.mul(nbarCell));
      const f = pm.div(s).sub(0.5);
      const c = floor(f);
      const b = f.sub(c);
      const lKey = zKey.bitXor(uint(l.toInt()).mul(uint(1597334677)));
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          const w = wl
            .mul(i ? b.x : float(1).sub(b.x))
            .mul(j ? b.y : float(1).sub(b.y));
          const hx = pcg3dX(
            uint(c.x.toInt().add(int(i + 1048576))),
            uint(c.y.toInt().add(int(j + 1048576))),
            lKey
          );
          const u2 = hx.toFloat().mul(1 / 4294967296);
          sum = sum.add(w.mul(countFromU(u2, nbarCell)));
        }
      }
    }
    return sum.div(max(nbarPix, NBAR_MIN));
  };

  // Smooth facet lobe (exact GGX D + height-correlated Smith V +
  // Schlick F on ice), scaled by the crystal area fraction. The
  // glint factor modulates it. The crystal orientation spread
  // widens by the LEADR footprint slope variance - distant snow's
  // glint lobe carries the unresolved terrain slopes too.
  const snowGlint = Fn(([wp, nSnow, sig2G]) => {
    const V = normalize(cameraPosition.sub(wp));
    const L = u.uSunDirW;
    const H = normalize(V.add(L));
    const nh = clamp(dot(nSnow, H), 0.0, 1.0);
    const nv = clamp(dot(nSnow, V), 1e-4, 1.0);
    const nl = clamp(dot(nSnow, L), 0.0, 1.0);
    const a2 = float(ALPHA_G * ALPHA_G).add(sig2G.mul(2.0));
    const t = nh.mul(nh).mul(a2.sub(1)).add(1);
    const D = a2.div(t.mul(t).mul(Math.PI));
    const oneMa2 = float(1).sub(a2);
    const lv = nl.mul(sqrt(nv.mul(nv).mul(oneMa2).add(a2)));
    const ll = nv.mul(sqrt(nl.mul(nl).mul(oneMa2).add(a2)));
    const Vis = float(0.5).div(max(lv.add(ll), 1e-9));
    const F = pow(clamp(float(1).sub(dot(V, H)), 0.0, 1.0), 5.0)
      .mul(1 - F0_ICE)
      .add(F0_ICE);
    const smooth2 = D.mul(Vis).mul(F).mul(nl).mul(FSPEC);
    const pm = wp.xz.mul(57.14);
    const aM = length(fwidth(pm));
    const hb = [
      floor(H.x.mul(HBIN)).toInt(),
      floor(H.y.mul(HBIN)).toInt(),
      floor(H.z.mul(HBIN)).toInt()
    ];
    const pHit = D.mul(nh).mul(OMEGA_G);
    return u.uSunCol.mul(smooth2.mul(glintFactorNode(pm, aM, hb, pHit)));
  });

  const wet = attribute('wet', 'float');

  // Shared pieces of the material decision (deduplicated by the
  // graph). ONE trilinear moments sample per fragment: mean slope ->
  // the LEADR-filtered world normal; central variance -> the lobe
  // inflation shared by the body GGX and the glints.
  const mom = momentsTexNode.sample(
    positionWorld.xz.div(u.uWorldSize).add(0.5)
  );
  const nW = normalize(vec3(mom.r.negate(), 1.0, mom.g.negate()));
  const sig2 = max(mom.b.sub(mom.r.mul(mom.r)), 0.0)
    .add(max(mom.a.sub(mom.g.mul(mom.g)), 0.0))
    .mul(0.5);
  const slope = float(1).sub(nW.y);
  // e = centerElev + 500*sinh(y/16), sinh via exponentials.
  const yy = positionWorld.y.div(16);
  const eM = u.uCenterElev.add(exp(yy).sub(exp(yy.negate())).mul(250));
  const n1 = tfbm(positionWorld.xz.mul(0.11));
  const n2 = tfbm(positionWorld.xz.mul(0.6));
  const rockF = smoothstep(0.2, 0.45, slope.add(n2.sub(0.5).mul(0.08)));
  const snowLine = u.uSnowLine.add(n1.sub(0.5).mul(500));
  const snow = max(
    smoothstep(snowLine, snowLine.add(700), eM).mul(
      smoothstep(0.35, 0.6, slope).oneMinus()
    ),
    u.uSnowy.mul(smoothstep(0.25, 0.45, slope).oneMinus()).mul(0.85)
  );

  // ---------- Ross-Li vegetation anisotropy (ross-li.js) ----------
  // The MODIS operational BRDF (Lucht 2000 RTLSR) with the Maignan
  // 2004 hotspot, weights from the BRDF archetype (Zhang/Jiao 2016)
  // fitted to the pixel's own MOD09A1 multi-angular reflectance.
  // The node is the exact TSL mirror of ross-li.js: the directional
  // term is normalised by ITS black-sky albedo (Lucht cubic + the
  // fitted hotspot-excess cubic) and the isotropic-sky term by the
  // white-sky albedo, so each averages to 1 over the view
  // hemisphere - the kernels redistribute the existing grass
  // albedo with sun/view geometry (hotspot brightening opposite the
  // sun, shadow-driven darkening into it) without changing it.
  // Angles sit in the LOCAL frame of the LEADR mean normal and are
  // clamped to the 75 deg kernel-fit domain.
  const hPoly = (g, t) => t.mul(t).mul(t.mul(g[2]).add(g[1])).add(g[0]);
  const rossA = Fn(() => {
    const iso = u.uRossW.x;
    const vol = u.uRossW.y;
    const geo = u.uRossW.z;
    const V = normalize(cameraPosition.sub(positionWorld));
    const L = u.uSunDirW;
    const cQ = Math.cos(THETA_MAX);
    const cli = dot(nW, L);
    const clv = dot(nW, V);
    const cti = clamp(cli, cQ, 1);
    const ctv = clamp(clv, cQ, 1);
    const ti = acos(cti);
    const tv = acos(ctv);
    const sti = sin(ti);
    const stv = sin(tv);
    // Relative azimuth around the local normal; phi = 0 is
    // backscatter (kernels are even in phi).
    const lt = L.sub(nW.mul(cli));
    const vt = V.sub(nW.mul(clv));
    const cphi = clamp(
      dot(lt, vt).div(max(length(lt).mul(length(vt)), 1e-4)),
      -1,
      1
    );
    const sphi2 = float(1).sub(cphi.mul(cphi));
    // RossThick with the Maignan hotspot factor.
    const cxi = clamp(cti.mul(ctv).add(sti.mul(stv).mul(cphi)), -1, 1);
    const xi = acos(cxi);
    const hot = float(1).add(float(1).div(xi.div(XI0).add(1)));
    const kvol = float(Math.PI / 2)
      .sub(xi)
      .mul(cxi)
      .add(sin(xi))
      .mul(hot)
      .div(cti.add(ctv))
      .sub(Math.PI / 4);
    // LiSparse-Reciprocal at h/b = 2, b/r = 1.
    const tanI = sti.div(cti);
    const tanV = stv.div(ctv);
    const secI = cti.reciprocal();
    const secV = ctv.reciprocal();
    const secS = secI.add(secV);
    const D2 = tanI
      .mul(tanI)
      .add(tanV.mul(tanV))
      .sub(tanI.mul(tanV).mul(cphi).mul(2));
    const tt = tanI.mul(tanV);
    const cost = clamp(
      sqrt(max(D2.add(tt.mul(tt).mul(sphi2)), 0))
        .mul(2)
        .div(secS),
      -1,
      1
    );
    const tO = acos(cost);
    const O = tO.sub(sin(tO).mul(cost)).mul(secS).div(Math.PI);
    const kgeo = O.sub(secS).add(cxi.add(1).mul(0.5).mul(secI).mul(secV));
    // Direct beam: BRF over its own black-sky albedo.
    const R = max(iso.add(vol.mul(kvol)).add(geo.mul(kgeo)), 0);
    const bsaM = max(
      iso.add(vol.mul(hPoly(G_VOL_M, ti))).add(geo.mul(hPoly(G_GEO, ti))),
      1e-3
    );
    // Isotropic sky: the reciprocity HDRF over the white-sky albedo.
    const skyN = max(
      iso.add(vol.mul(hPoly(G_VOL, tv))).add(geo.mul(hPoly(G_GEO, tv))),
      0
    );
    const wsa = max(iso.add(vol.mul(H_VOL)).add(geo.mul(H_GEO)), 1e-3);
    const A = mix(R.div(bsaM), skyN.div(wsa), u.uRossMix);
    return mix(float(1), A, u.uRossOn);
  })();

  // Real ground cover (landuse.js): rgb = the OSM class albedo,
  // a = coverage. Mixed into the GRASS albedo only - rock faces,
  // snow and the sea never read it - through the same detail
  // noise and measured Ross-Li factor, so lighting stays the
  // model's. Default 1x1 a=0: base grass until data arrives.
  const landZero = new DataTexture(
    new Float32Array([0, 0, 0, 0]),
    1,
    1,
    RGBAFormat,
    FloatType
  );
  landZero.needsUpdate = true;
  const landTexNode = texture(landZero);

  const colorNode = Fn(() => {
    const n3 = tfbm(positionWorld.xz.mul(3.3));
    const land = landTexNode.sample(
      vec2(
        positionWorld.x.div(u.uWorldSize).add(0.5),
        float(0.5).sub(positionWorld.z.div(u.uWorldSize))
      )
    );
    const grass0 = mix(vec3(0.09, 0.21, 0.05), vec3(0.19, 0.33, 0.08), n1);
    const grass = mix(grass0, land.rgb, land.a.mul(u.uLandOn).mul(0.85))
      .mul(n3.mul(0.3).add(0.85))
      .mul(rossA);
    const rock = mix(vec3(0.28, 0.25, 0.21), vec3(0.4, 0.37, 0.32), n2).mul(
      n3.mul(0.36).add(0.82)
    );
    const col1 = mix(grass, rock, rockF);
    const col2 = mix(col1, rock, smoothstep(1600.0, 2400.0, eM).mul(0.92));
    const col3 = mix(col2, vec3(0.87, 0.9, 0.93), snow);
    // Sea: Monahan & O'Muircheartaigh (1980) whitecap fraction
    // W = 3.84e-6 * U^3.41.
    const U = max(u.uWindMs, 0.8);
    const W = clamp(pow(U, 3.41).mul(3.84e-6), 0.0, 0.6);
    const pmc = positionWorld.xz.mul(57.14 * 0.11);
    const capN = tnoise(
      pmc.add(normalize(u.uWindVec).mul(u.uTime.mul(0.25))).add(31.0)
    );
    const sea0 = mix(vec3(0.05, 0.13, 0.2), vec3(0.07, 0.17, 0.25), n1);
    const sea = mix(
      sea0,
      vec3(0.75, 0.8, 0.84),
      smoothstep(W.oneMinus(), W.oneMinus().add(0.04), capN)
    );
    return mix(col3, sea, wet);
  })();

  // Per-pixel GGX roughness: vegetation ~0.95, rock ~0.88, snow 0.45
  // (its real forward sheen), LEADR-inflated by the footprint slope
  // variance; wet sea pixels keep roughness 1 so the Blinn seaSpec
  // stays the one glitter model.
  const rBase = mix(mix(0.95, 0.88, rockF), 0.45, snow);
  const aBase = rBase.mul(rBase);
  const aEff = sqrt(aBase.mul(aBase).add(sig2.mul(2.0)));
  const roughnessNode = mix(clamp(sqrt(aEff), 0.0, 1.0), 1.0, wet);

  // World normal: waves on wet pixels, the DEM normal map elsewhere.
  const normalNode = transformNormalToView(
    mix(nW, seaNormal(positionWorld), wet)
  );

  // Glitter adds to the outgoing light exactly like the GLSL
  // `outgoingLight += vWet * seaSpec(vWp)`; snow adds the
  // Zirr-Kaplanyan crystal sparkle on dry snowy pixels (like the sea
  // glitter, the emissive path is not CSM-shadowed - documented,
  // consistent with the existing model; glints only carry energy in
  // direct sun via uSunCol).
  // Black Marble night lights: measured DNB radiance over the box
  // (linear nW/(cm^2 sr), row 0 = south edge), exposure-matched by
  // ONE gain like every other emissive, tinted by the gated 2700 K
  // Planckian white point, gated by darkness. Where the data says
  // dark, the ground stays dark - towns glow only where they are.
  const lightsZero = new DataTexture(
    new Float32Array([0]),
    1,
    1,
    RedFormat,
    FloatType
  );
  lightsZero.needsUpdate = true;
  const lightsTexNode = texture(lightsZero);
  const nightLights = lightsTexNode
    .sample(
      vec2(
        positionWorld.x.div(u.uWorldSize).add(0.5),
        float(0.5).sub(positionWorld.z.div(u.uWorldSize))
      )
    )
    .r.mul(u.uLightsGain)
    .mul(u.uLightsNight)
    .mul(u.uLightsOn)
    .mul(u.uLightsTint);

  const emissiveNode = seaSpec(positionWorld)
    .mul(wet)
    .add(snowGlint(positionWorld, nW, sig2).mul(snow).mul(wet.oneMinus()))
    .add(nightLights);

  const mat = new MeshStandardNodeMaterial({metalness: 0});
  mat.colorNode = colorNode;
  mat.roughnessNode = roughnessNode;
  mat.normalNode = normalNode;
  mat.emissiveNode = emissiveNode;
  // Aerial perspective + Koschmieder: the ONE shared hook from
  // aerial-tsl.js, same graph every world material uses.
  aerial.apply(mat);
  return {
    material: mat,
    uniforms: u,
    momentsTexNode,
    lightsTexNode,
    landTexNode
  };
}
