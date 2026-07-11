import {
  NoBlending,
  BackSide,
  DataTexture,
  QuadMesh,
  HalfFloatType,
  FloatType,
  LinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  RenderTarget,
  RGBAFormat,
  SphereGeometry,
  StorageTexture,
  Vector2,
  Vector3
} from 'three/webgpu';
import {
  Fn,
  If,
  Loop,
  abs,
  asin,
  asinh,
  atan,
  clamp,
  cos,
  dot,
  exp,
  float,
  fwidth,
  instanceIndex,
  int,
  ivec2,
  max,
  min,
  mix,
  normalize,
  positionLocal,
  pow,
  select,
  sin,
  sqrt,
  texture,
  textureStore,
  uniform,
  uv,
  vec2,
  vec3,
  vec4
} from 'three/tsl';

/**
 * TSL port of the Hillaire (2020) multiple-scattering atmosphere
 * (WebGPU project, phase 2). Same math, same LUT sizes and Bruneton
 * parameterisation as the GLSL version this replaces:
 *  - transmittance LUT 256x64, built once (40-step optical depth)
 *  - multiple-scattering LUT 32x32: 64 spherical-Fibonacci directions,
 *    20-step marches, ground bounce, Psi_ms = L2 / (1 - f_ms)
 *  - sky-view LUT 384x108 per frame (32 steps, sqrt-warped elevation
 *    split at the true horizon; full SIGNED azimuth circle)
 *  - aerial-perspective LUT 128x32 (SIGNED relative azimuth over the
 *    full circle x distance, 20 steps) for the per-material fog hook
 *  - BOTH per-frame marches carry Hillaire's volumetric shadow: the
 *    DIRECT single-scatter term is multiplied per step by the cloud
 *    shadow map's Beer-Lambert transmittance at the marched point
 *    (crepuscular rays in the sky AND in the terrain haze; multiple
 *    scattering stays unshadowed). The full circles exist BECAUSE
 *    of the shadow - clouds are not azimuthally symmetric; the
 *    seams sit at the anti-sun azimuth where in-scatter varies
 *    slowest. Shadow samples map to the scene through the exact
 *    asinh altitude datum, so rays above the decks read full sun.
 *  - 1x1 cosine-weighted sky irradiance for the hemisphere ambient
 *    (read back asynchronously - no pipeline stall)
 *  - the dome samples the sky-view LUT and adds the sun disc through
 *    the transmittance LUT
 *
 * The LUT builders are coordinate-parameterised Fns - the single
 * definition of the physics - each dispatched as a compute kernel
 * writing a StorageTexture (probe: store-y == sample-v ==
 * readback-row, filtered sampling works inside kernels). WebGPU-only
 * build: the QuadMesh render-target drivers were deleted with the
 * WebGL2 backend.
 */

const RB = 6360e3;
const RT = 6460e3;
const MAX_DIST_M = 25700; // 450 scene units at 57.14 m/unit
const SCENE_PER_M = 7 / 400; // roam.js MPU inverted (exact)
const SKY_H = 108; // sky-view LUT rows; the guarded split needs it

// `cloudShadow` (optional) is the theme's cloud shadow hook
// (clouds-tsl.js createCloudShadowHook): its Beer-Lambert
// transmittance(worldPos) shadows the aerial march's direct term.
export function createAtmosphereTSL(renderer, cloudShadow) {
  // Mie radiative properties as uniforms (aerosol.js): per-channel
  // scattering and absorption coefficients at profile h = 0 (1/m)
  // and the phase asymmetry. Defaults are Hillaire (2020)'s exact
  // constants (scattering 3.996e-6, extinction 4.440e-6 = sigma_s
  // / 0.9, g 0.8); with a live /aerosol answer the theme sets the
  // MEASURED GEFS-Aerosols channel set instead (the gated
  // aerosol-reference.mjs proves the measured path degenerates to
  // these defaults for paper-standard air).
  const mieScat = uniform(new Vector3(3.996e-6, 3.996e-6, 3.996e-6));
  const mieAbs = uniform(new Vector3(4.44e-7, 4.44e-7, 4.44e-7));
  const mieG = uniform(0.8);
  const sunMu = uniform(0.5);
  const camH = uniform(300);
  const exposure = uniform(28);
  // Hillaire (2020) terminates ground-hitting sky-view rays with a
  // Lambertian ground bounce; the albedo is FED by the theme, not
  // painted - Payne (1972) open-ocean broadband 0.06 where the box
  // has sea, 0 otherwise (a land value needs its own citation, so
  // inland horizons keep the pure in-scatter until then).
  const groundAlb = uniform(new Vector3(0, 0, 0));
  const sunDirW = uniform(new Vector3(0, 1, 0));
  // Refraction of the drawn disc (refraction.js on the CPU): the
  // red and blue channels' own apparent directions and the shared
  // vertical flattening. Defaults draw an undispersed round disc.
  const sunDirR = uniform(new Vector3(0, 1, 0));
  const sunDirB = uniform(new Vector3(0, 1, 0));
  const sunFlat = uniform(1);
  // The sunset transfer LUT (refraction.js transferCurve): TRUE
  // altitude per channel indexed by APPARENT altitude across a
  // horizon band. Folds in the curve ARE the mirage images and
  // the magnified green flash - the disc membership test below
  // replaces the centre+flatten model inside the band. Fed by the
  // theme on profile/observer-height cadence (the curve is
  // sun-independent); transOn gates the whole path so high-sun
  // frames pay nothing.
  const TRANS_ROWS = 160;
  const transTex = new DataTexture(
    new Float32Array(TRANS_ROWS * 4),
    TRANS_ROWS,
    1,
    RGBAFormat,
    FloatType
  );
  transTex.magFilter = LinearFilter;
  transTex.minFilter = LinearFilter;
  transTex.needsUpdate = true;
  const transNode = texture(transTex);
  const transA0 = uniform(-0.0105);
  const transA1 = uniform(0.0349);
  const transOn = uniform(0);
  const sunTrueAlt = uniform(0);

  const rayleighS = vec3(5.802e-6, 13.558e-6, 33.1e-6);
  const ozoneA = vec3(0.65e-6, 1.881e-6, 0.085e-6);

  // x: rayleigh, y: mie, z: ozone (tent at 25 km).
  const densities = Fn(([h]) =>
    vec3(
      exp(h.div(-8000)),
      exp(h.div(-1200)),
      max(0.0, float(1.0).sub(abs(h.sub(25e3)).div(15e3)))
    )
  );

  const extinction = Fn(([h]) => {
    const d = densities(h);
    return rayleighS
      .mul(d.x)
      .add(mieScat.add(mieAbs).mul(d.y))
      .add(ozoneA.mul(d.z));
  });

  // Distance to the sphere of radius R, or -1.
  const raySphere = Fn(([r, mu, R]) => {
    const b = r.mul(mu);
    const c = r.mul(r).sub(R.mul(R));
    const disc = b.mul(b).sub(c);
    const res = float(-1).toVar();
    If(disc.greaterThanEqual(0.0), () => {
      const s = sqrt(disc);
      const t0 = b.negate().sub(s);
      const t1 = b.negate().add(s);
      res.assign(
        select(
          t0.greaterThan(0.0),
          t0,
          select(t1.greaterThan(0.0), t1, float(-1))
        )
      );
    });
    return res;
  });

  // Bruneton's transmittance LUT parameterisation.
  const tParamsToUv = Fn(([r, mu]) => {
    const H = sqrt(RT * RT - RB * RB);
    const rho = sqrt(max(r.mul(r).sub(RB * RB), 0.0));
    const disc = r
      .mul(r)
      .mul(mu.mul(mu).sub(1.0))
      .add(RT * RT);
    const d = max(
      r
        .mul(mu)
        .negate()
        .add(sqrt(max(disc, 0.0))),
      0.0
    );
    const dMin = float(RT).sub(r);
    const dMax = rho.add(H);
    return vec2(d.sub(dMin).div(dMax.sub(dMin)), rho.div(H));
  });

  const phaseR = Fn(([c]) =>
    c
      .mul(c)
      .add(1.0)
      .mul(3.0 / (16.0 * 3.14159265))
  );
  // Henyey-Greenstein x Cornette-Shanks with the MEASURED asymmetry
  // (GEFS-Aerosols ASYSFK uniform; 0.8 when no measurement).
  const phaseM = Fn(([c]) => {
    const g2 = mieG.mul(mieG);
    return g2
      .oneMinus()
      .div(g2.add(2.0))
      .mul(3.0 / (8.0 * 3.14159265))
      .mul(c.mul(c).add(1.0))
      .div(pow15(g2.add(1.0).sub(c.mul(mieG).mul(2.0))));
  });
  // x^1.5 without pow's undefined-for-negative edge.
  const pow15 = Fn(([x]) => {
    const m = max(x, 1e-6);
    return m.mul(sqrt(m));
  });

  // Compute kernels over storage textures (WebGPU-only build; the
  // QuadMesh render-target drivers were deleted with the WebGL2
  // backend).

  function makeTarget(w, h, type) {
    const rt = new RenderTarget(w, h, {
      type: type || HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
      stencilBuffer: false
    });
    return rt;
  }

  function makeStorage(w, h, type) {
    const t = new StorageTexture(w, h);
    t.type = type || HalfFloatType;
    t.minFilter = t.magFilter = LinearFilter;
    return t;
  }

  // {tex, w, h} per LUT.
  function makeLut(w, h, type) {
    const tex = makeStorage(w, h, type);
    return {tex, w, h};
  }

  const tLut = makeLut(256, 64);
  const msLut = makeLut(32, 32);
  // Full SIGNED azimuth circle (384 = the old 192 half-circle
  // texel pitch kept): the volumetric cloud shadow is not
  // azimuthally symmetric, so the sky-view LUT carries both sides
  // of the sun line. u = 0.5 faces the sun; the clamp seam sits at
  // the anti-sun azimuth.
  const skyLut = makeLut(384, SKY_H);
  const aerialLut = makeLut(128, 32);
  // The irradiance readback needs a RenderTarget on both backends
  // (readRenderTargetPixelsAsync is the async staging read); it is a
  // single texel - nothing for compute to win.
  const irrLut = makeTarget(1, 1, FloatType);

  const tTexNode = texture(tLut.tex);
  const msTexNode = texture(msLut.tex);
  const skyTexNode = texture(skyLut.tex);

  const sunT = Fn(([r, mu]) => tTexNode.sample(tParamsToUv(r, mu)).rgb);
  const psiMS = Fn(
    ([r, mu]) =>
      msTexNode.sample(vec2(mu.mul(0.5).add(0.5), r.sub(RB).div(RT - RB))).rgb
  );

  // ---------- transmittance (built once per aerosol change) ----------
  const transmittanceNode = Fn(([vUv]) => {
    const H = float(Math.sqrt(RT * RT - RB * RB));
    const rho = H.mul(vUv.y);
    const r = sqrt(rho.mul(rho).add(RB * RB));
    const dMin = float(RT).sub(r);
    const dMax = rho.add(H);
    const d = dMin.add(vUv.x.mul(dMax.sub(dMin)));
    const mu = clamp(
      select(
        d.equal(0.0),
        float(1.0),
        H.mul(H).sub(rho.mul(rho)).sub(d.mul(d)).div(r.mul(d).mul(2.0))
      ),
      -1.0,
      1.0
    );
    const N = 40;
    const dt = d.div(N);
    const tau = vec3(0).toVar();
    Loop(N, ({i}) => {
      const ti = float(i).add(0.5).mul(dt);
      const h = sqrt(
        r.mul(r).add(ti.mul(ti)).add(r.mul(ti).mul(mu).mul(2.0))
      ).sub(RB);
      tau.addAssign(extinction(h).mul(dt));
    });
    return vec4(exp(tau.negate()), 1.0);
  });

  // ---------- multiple scattering (rebuilt when aerosols or the
  // fed ground albedo change) ----------
  const multiscatterNode = Fn(([vUv]) => {
    const muS = vUv.x.mul(2.0).sub(1.0);
    const r = float(RB)
      .add(vUv.y.mul(RT - RB))
      .add(1.0);
    const sunDir = vec3(sqrt(max(muS.mul(muS).oneMinus(), 0.0)), muS, 0.0);

    // Hillaire eq. 5-7: second-order luminance and the transfer
    // integrated over the sphere; Psi_ms = L2 / (1 - f_ms).
    const L2 = vec3(0).toVar();
    const fms = vec3(0).toVar();
    const DIRS = 64;
    Loop(DIRS, ({i}) => {
      // Everything derived from the OUTER counter must be materialised
      // with toVar() before the inner Loop: nested TSL Loops both name
      // their counter `i`, and un-var'd expressions are inlined into
      // the inner body where GLSL scoping makes the INNER i win
      // (verified by probe: sum test returned the shadowed value).
      const fi = float(i).add(0.5).toVar();
      const cosT = float(1.0)
        .sub(fi.mul(2.0 / DIRS))
        .toVar();
      const sinT = sqrt(max(cosT.mul(cosT).oneMinus(), 0.0)).toVar();
      const phi = fi.mul(2.399963).toVar();
      const dir = vec3(sinT.mul(cos(phi)), cosT, sinT.mul(sin(phi))).toVar();

      const mu = dir.y.toVar();
      const dGround = raySphere(r, mu, float(RB)).toVar();
      const dTop = raySphere(r, mu, float(RT)).toVar();
      const dEnd = select(dGround.greaterThan(0.0), dGround, dTop).toVar();
      const STEPS = 20;
      const dt = dEnd.div(STEPS).toVar();
      const T = vec3(1).toVar();
      const Li = vec3(0).toVar();
      const fi3 = vec3(0).toVar();
      const cSun = dot(dir, sunDir).toVar();
      Loop(STEPS, ({i: s}) => {
        const ti = float(s).add(0.5).mul(dt);
        const ri = sqrt(
          r.mul(r).add(ti.mul(ti)).add(r.mul(ti).mul(mu).mul(2.0))
        );
        const h = ri.sub(RB);
        const dens = densities(h);
        const scat = rayleighS.mul(dens.x).add(mieScat.mul(dens.y));
        const ext = extinction(h);
        const muSi = clamp(r.mul(muS).add(ti.mul(cSun)).div(ri), -1.0, 1.0);
        const Ts = sunT(ri, muSi);
        const S = scat
          .mul(phaseR(cSun).add(phaseM(cSun)))
          .mul(0.5)
          .mul(Ts);
        const stepT = exp(ext.mul(dt).negate());
        const extC = max(ext, vec3(1e-9));
        Li.addAssign(T.mul(S.sub(S.mul(stepT))).div(extC));
        fi3.addAssign(T.mul(scat.sub(scat.mul(stepT))).div(extC));
        T.mulAssign(stepT);
      });
      If(dGround.greaterThan(0.0), () => {
        const muSg = clamp(
          r.mul(muS).add(dGround.mul(cSun)).div(RB),
          -1.0,
          1.0
        );
        // Ground contribution at the FED albedo - Hillaire's model
        // has ONE ground_albedo parameter shared by this LUT and
        // the sky-view terminal bounce (his reference implementation
        // defaults it to zero and exposes it as an input; the old
        // 0.3 literal here was uncited). The theme feeds Payne
        // (1972) 0.06 where the box has sea, 0 inland until a
        // measured land albedo earns its citation.
        Li.addAssign(
          T.mul(sunT(float(RB), muSg))
            .mul(max(muSg, 0.0))
            .mul(groundAlb)
            .mul(1 / Math.PI)
        );
      });
      L2.addAssign(Li.div(DIRS));
      fms.addAssign(fi3.div(DIRS));
    });
    const psi = L2.div(max(vec3(1).sub(fms), vec3(1e-4)));
    return vec4(psi, 1.0);
  });

  // ---------- shared march with volumetric shadow ----------
  // ONE single-scattering march serves the sky-view and aerial LUTs
  // (step count is the compile-time constant): a ray from camera
  // height at SIGNED azimuth az from the sun and elevation
  // (se, ce), where chi(t) - the cloud shadow map's Beer-Lambert
  // transmittance at the marched point - multiplies the DIRECT
  // single-scatter term only (Hillaire 2020's volumetric shadow;
  // multiple scattering stays unshadowed). The marched point maps
  // to the scene through the sun-azimuth rotation (roundtrip
  // gated), the horizontal arc ti*ce (curvature over the 16 km
  // shadow range is metres - far under the map texel), and the
  // theme's exact asinh altitude datum (roam.js yOfElev, gated).
  // Mirrored in atmo-reference.mjs.
  const aerialCamXZ = uniform(new Vector2(0, 0));
  const aerialSunAz = uniform(new Vector2(1, 0));
  const shadowElev0 = uniform(0); // the box's elevation datum (m)
  // withGround: Hillaire's terminal ground bounce for sky-view rays
  // that end ON the virtual ground (L += T x albedo/pi x NdotL x
  // T_sun at the hit) - the aerial march never takes it, scene
  // geometry provides that ground.
  const makeMarch = (steps, withGround = false) =>
    Fn((args) => {
      const [r, az, se, ce, dEnd] = args;
      const gHit = withGround ? args[5] : null;
      const dt = dEnd.div(steps);
      const T = vec3(1).toVar();
      const L = vec3(0).toVar();
      const mu = se;
      const sunS = sqrt(max(sunMu.mul(sunMu).oneMinus(), 0.0));
      const cSun = ce.mul(cos(az)).mul(sunS).add(se.mul(sunMu));
      // Scene-plane direction of this azimuth: the sun's azimuth
      // vector rotated by az (counterclockwise in the xz basis -
      // the same convention aerial-tsl's atan(cross, dot) reads
      // back; roundtrip gated).
      const sceneDir = vec2(
        aerialSunAz.x.mul(cos(az)).sub(aerialSunAz.y.mul(sin(az))),
        aerialSunAz.x.mul(sin(az)).add(aerialSunAz.y.mul(cos(az)))
      );
      Loop(steps, ({i: s}) => {
        const ti = float(s).add(0.5).mul(dt);
        const ri = sqrt(
          r.mul(r).add(ti.mul(ti)).add(r.mul(ti).mul(mu).mul(2.0))
        );
        const h = ri.sub(RB);
        const dens = densities(h);
        const scatR = rayleighS.mul(dens.x);
        const scatM = mieScat.mul(dens.y);
        const ext = extinction(h);
        const muSi = clamp(r.mul(sunMu).add(ti.mul(cSun)).div(ri), -1.0, 1.0);
        const Ts = sunT(ri, muSi);
        // chi: sun visibility through the cloud decks at the
        // marched point - scene xz from the horizontal arc, scene
        // y from the altitude datum (a ray above the decks reads
        // full sun; the hook's mid-plane projection handles any y).
        const chi = cloudShadow
          ? (() => {
              const p = aerialCamXZ.add(
                sceneDir.mul(ti.mul(ce).mul(SCENE_PER_M))
              );
              const y = asinh(h.sub(shadowElev0).div(500)).mul(16);
              return cloudShadow.transmittance(vec3(p.x, y, p.y));
            })()
          : float(1);
        const S = scatR
          .mul(phaseR(cSun))
          .add(scatM.mul(phaseM(cSun)))
          .mul(Ts)
          .mul(chi)
          .add(scatR.add(scatM).mul(psiMS(ri, muSi)));
        const stepT = exp(ext.mul(dt).negate());
        L.addAssign(T.mul(S.sub(S.mul(stepT))).div(max(ext, vec3(1e-9))));
        T.mulAssign(stepT);
      });
      if (gHit) {
        // The ground point's up vector dotted with the sun IS the
        // path muS expression at ti = dEnd (both are dot(P-hat,
        // sun)) - so NdotL and the transmittance-to-sun reuse the
        // march's own formulas exactly.
        const rG = sqrt(
          r.mul(r).add(dEnd.mul(dEnd)).add(r.mul(dEnd).mul(mu).mul(2.0))
        );
        const muG = clamp(r.mul(sunMu).add(dEnd.mul(cSun)).div(rG), -1.0, 1.0);
        L.addAssign(
          T.mul(sunT(rG, muG))
            .mul(groundAlb)
            .mul(max(muG, 0.0))
            .mul(1 / Math.PI)
            .mul(gHit)
        );
      }
      return vec4(L, dot(T, vec3(1 / 3, 1 / 3, 1 / 3)));
    });
  const marchSky32 = makeMarch(32, true);
  const marchAerial20 = makeMarch(20);

  // Sky-view vertical mapping, Bruneton-style guarded split (phase 4
  // horizon-band fix). Sky radiance is DISCONTINUOUS at the horizon
  // (ground-terminated march below vs full path to the atmosphere top
  // above); the old mapping put the seam mid-texel at v=0.5 and
  // bilinear filtering smeared it into a band. Now each half-range
  // maps to its own texel-CENTRE range with a half-texel guard on
  // either side of the seam - a sampled v never mixes rows across it
  // - keeping the sqrt warp that concentrates resolution at the
  // horizon. The ray class is assigned BY HALF (Bruneton 2008 's
  // ray_r_mu_intersects_ground), not by intersection test, so the two
  // boundary rows store the true one-sided limits: the below row
  // marches to the ground at the exact tangent distance, the above
  // row to the top.
  const SKY_GUARD = 0.5 / SKY_H;
  const SKY_SPAN = 0.5 - 1 / SKY_H;
  const skyVFromElev = Fn(([elev, hAngle]) => {
    const res = float(0).toVar();
    If(elev.lessThan(hAngle), () => {
      const s = sqrt(
        clamp(hAngle.sub(elev).div(hAngle.add(1.5707963)), 0.0, 1.0)
      );
      res.assign(float(0.5 - SKY_GUARD).sub(s.mul(SKY_SPAN)));
    }).Else(() => {
      const s = sqrt(
        clamp(elev.sub(hAngle).div(float(1.5707963).sub(hAngle)), 0.0, 1.0)
      );
      res.assign(float(0.5 + SKY_GUARD).add(s.mul(SKY_SPAN)));
    });
    return res;
  });
  const elevFromSkyV = Fn(([v, hAngle]) => {
    const res = float(0).toVar();
    If(v.lessThan(0.5), () => {
      const s = clamp(
        float(0.5 - SKY_GUARD)
          .sub(v)
          .div(SKY_SPAN),
        0.0,
        1.0
      );
      res.assign(hAngle.sub(s.mul(s).mul(hAngle.add(1.5707963))));
    }).Else(() => {
      const s = clamp(v.sub(0.5 + SKY_GUARD).div(SKY_SPAN), 0.0, 1.0);
      res.assign(hAngle.add(s.mul(s).mul(float(1.5707963).sub(hAngle))));
    });
    return res;
  });

  // ---------- sky-view (per frame) ----------
  const skyviewNode = Fn(([vUv]) => {
    const r = float(RB).add(max(camH, 1.0));
    const horizon = sqrt(max(r.mul(r).sub(RB * RB), 0.0))
      .div(r)
      .negate();
    const hAngle = horizon.clamp(-1, 1).asin();
    const elev = elevFromSkyV(vUv.y, hAngle);
    // Full-circle SIGNED azimuth: u = 0.5 faces the sun, the seam
    // (u = 0/1) is the anti-sun azimuth (same convention as the
    // aerial LUT - the cloud shadow is not azimuthally symmetric).
    const az = vUv.x.sub(0.5).mul(2.0 * 3.14159265);
    const se = sin(elev);
    const ce = cos(elev);
    const dGround = raySphere(r, se, float(RB));
    const dTop = raySphere(r, se, float(RT));
    // Ray class by texture half; the tangent distance is the exact
    // disc==0 fallback for the below-boundary row.
    const dTangent = sqrt(max(r.mul(r).sub(RB * RB), 0.0));
    const dEnd = max(
      select(
        vUv.y.lessThan(0.5),
        select(dGround.greaterThan(0.0), dGround, dTangent),
        dTop
      ),
      0.0
    );
    // Below-horizon rows whose ray genuinely reaches the ground
    // take Hillaire's terminal ground bounce; the tangent
    // fallback and every above-horizon row do not.
    const gHit = select(
      vUv.y.lessThan(0.5).and(dGround.greaterThan(0.0)),
      float(1.0),
      float(0.0)
    );
    return marchSky32(r, az, se, ce, dEnd, gHit);
  });

  // ---------- aerial perspective (per frame) ----------
  const aerialNode = Fn(([vUv]) => {
    // Full-circle SIGNED azimuth: u = 0.5 faces the sun, the seam
    // (u = 0/1) is the anti-sun azimuth. A horizontal ray:
    // se = 0, ce = 1.
    const az = vUv.x.sub(0.5).mul(2.0 * 3.14159265);
    const dist = vUv.y.mul(MAX_DIST_M);
    const r = float(RB).add(max(camH, 1.0));
    return marchAerial20(r, az, float(0), float(1), dist);
  });

  // ---------- cosine-weighted sky irradiance (per frame, 1x1) ----------
  const irradianceNode = Fn(() => {
    const r = float(RB).add(max(camH, 1.0));
    const horizon = sqrt(max(r.mul(r).sub(RB * RB), 0.0))
      .div(r)
      .negate();
    const hAngle = horizon.clamp(-1, 1).asin();
    const E = vec3(0).toVar();
    const wSum = float(0).toVar();
    Loop(6, ({i: ie}) => {
      // toVar() everything outer-counter-derived before the inner Loop
      // (nested counters shadow - see the multiscatter comment).
      const elev = float(ie)
        .add(0.5)
        .mul(1.5707963 / 6)
        .toVar();
      const uy = skyVFromElev(elev, hAngle).toVar();
      // cos(theta_zenith) = sin(elev); d-omega = cos(elev) d-elev d-az
      const w = sin(elev).mul(cos(elev)).toVar();
      Loop(8, ({i: ia}) => {
        // ax spans the FULL signed circle now (u = 0.5 faces the
        // sun) - the mean over 8 azimuths is the same integral,
        // and the shadowed sky darkens the ambient correctly.
        const ax = float(ia)
          .add(0.5)
          .mul(1 / 8);
        E.addAssign(skyTexNode.sample(vec2(ax, uy)).rgb.mul(w));
        wSum.addAssign(w);
      });
    });
    return vec4(E.div(max(wSum, 1e-6)), 1.0);
  });

  // ---------- the dome ----------
  // The dome's LUT sample for an arbitrary world direction - shared
  // by the dome itself and by anything that sits ABOVE the whole
  // atmosphere (the moon disc): every metre of air along such a ray
  // is in front of the object, so the full sky-view in-scatter adds
  // over its surface radiance.
  const skySampleFor = Fn(([v]) => {
    const r = float(RB).add(max(camH, 1.0));
    const horizon = sqrt(max(r.mul(r).sub(RB * RB), 0.0))
      .div(r)
      .negate();
    const hAngle = horizon.clamp(-1, 1).asin();
    const elev = v.y.clamp(-1, 1).asin();
    const sunH = normalize(sunDirW.xz.add(vec2(1e-6, 1e-6)));
    const vH = normalize(v.xz.add(vec2(1e-6, 1e-6)));
    // SIGNED azimuth over the full circle - atan(cross, dot), the
    // same convention the LUT fill rotates by (roundtrip gated).
    const ux = atan(sunH.x.mul(vH.y).sub(sunH.y.mul(vH.x)), dot(sunH, vH))
      .div(2.0 * 3.14159265)
      .add(0.5);
    // The horizon is a true radiance discontinuity (the guarded LUT
    // split stores its one-sided limits in the two seam rows). A
    // pixel straddling it should show the box-filter integral of
    // both sides, so blend the limits by pixel coverage
    // (fwidth(elev) = the pixel's elevation footprint); this also
    // keeps the dome a continuous function of elev - no cross-device
    // single-pixel classification flips along the horizon row.
    const sA = sqrt(
      clamp(elev.sub(hAngle).div(float(1.5707963).sub(hAngle)), 0.0, 1.0)
    );
    const sB = sqrt(
      clamp(hAngle.sub(elev).div(hAngle.add(1.5707963)), 0.0, 1.0)
    );
    const uyAbove = float(0.5 + SKY_GUARD).add(sA.mul(SKY_SPAN));
    const uyBelow = float(0.5 - SKY_GUARD).sub(sB.mul(SKY_SPAN));
    const cov = clamp(
      elev
        .sub(hAngle)
        .div(max(fwidth(elev), 1e-7))
        .add(0.5),
      0.0,
      1.0
    );
    return mix(
      skyTexNode.sample(vec2(ux, uyBelow)).rgb,
      skyTexNode.sample(vec2(ux, uyAbove)).rgb,
      cov
    );
  });

  const domeColor = Fn(() => {
    const v = normalize(positionLocal);
    const r = float(RB).add(max(camH, 1.0));
    const col = skySampleFor(v).toVar();
    // The sun disc: direct transmittance with photospheric limb
    // darkening, Hestroffer & Magnan (1998) power law I(mu) = mu^a,
    // a(lambda_um) = -0.023 + 0.292 / lambda, at the same 680/550/440
    // nm the scattering coefficients use. mu = cos of the angular
    // offset from disc centre normalised to the disc radius; the 120
    // constant is the CENTRAL intensity.
    //
    // Atmospheric refraction splits and squashes the disc
    // (refraction.js, ray-traced through the MEASURED profile on
    // the CPU): each channel carries its own apparent direction -
    // the green rim IS the gap between them, widening when the
    // profile magnifies it (the green flash's approach) - and all
    // three share the vertical flattening ratio (the setting sun's
    // published ~5/6 squash). The angular offset from each centre
    // is decomposed against the local vertical and its vertical
    // component divided by the flatten factor; clamp keeps the
    // limb law's exact zero at the (elliptical) edge, as before.
    const cSunG = dot(v, sunDirW);
    // Inside the transfer band at a low sun, the disc is drawn
    // through the LUT: the fragment's APPARENT altitude reads the
    // TRUE altitude each channel sees there, and disc membership
    // is |trueAlt - sunTrueAlt| against the disc radius - folds in
    // the curve then draw themselves as the Omega sun, mock-mirage
    // slices and the magnified flash. Azimuth handled small-angle
    // (the gate is a ~2.5 deg window around the sun's azimuth).
    const aFrag = asin(clamp(v.y, -1.0, 1.0));
    const vH = normalize(vec3(v.x, 0.0, v.z).add(vec3(0.0, 0.0, 1e-9)));
    const sH = normalize(
      vec3(sunDirW.x, 0.0, sunDirW.z).add(vec3(0.0, 0.0, 1e-9))
    );
    const cosAz = dot(vH, sH);
    const sinAz = vH.x.mul(sH.z).sub(vH.z.mul(sH.x));
    const inBand = transOn
      .greaterThan(0.5)
      .and(aFrag.greaterThan(transA0))
      .and(aFrag.lessThan(transA1))
      .and(cosAz.greaterThan(0.999));
    If(inBand, () => {
      const uT = aFrag.sub(transA0).div(transA1.sub(transA0));
      const t4 = transNode.sample(vec2(uT, 0.5));
      const t3 = t4.rgb;
      const discR = float(Math.acos(0.9999893));
      const hOff = sinAz.mul(cos(aFrag));
      const chanMu = (tc) => {
        const vOff = tc.sub(sunTrueAlt);
        const s2 = clamp(
          vOff.mul(vOff).add(hOff.mul(hOff)).div(discR.mul(discR)),
          0.0,
          1.0
        );
        return sqrt(s2.oneMinus());
      };
      const limb = vec3(
        pow(chanMu(t3.x), 0.4064),
        pow(chanMu(t3.y), 0.5079),
        pow(chanMu(t3.z), 0.6406)
      );
      col.addAssign(
        tTexNode.sample(tParamsToUv(r, v.y)).rgb.mul(limb).mul(t4.a).mul(120.0)
      );
    }).Else(() => {
      If(cSunG.greaterThan(0.9998), () => {
        const sin2R = 1 - 0.9999893 * 0.9999893;
        const chanMu = (dir) => {
          const cS = dot(v, dir);
          const up = normalize(
            vec3(0.0, 1.0, 0.0)
              .sub(dir.mul(dir.y))
              .add(vec3(0.0, 0.0, 1e-9))
          );
          const off = v.sub(dir.mul(cS));
          const ov = dot(off, up).div(sunFlat);
          const rest = off.sub(up.mul(dot(off, up)));
          const s2 = clamp(
            ov.mul(ov).add(dot(rest, rest)).div(sin2R),
            0.0,
            1.0
          );
          return sqrt(s2.oneMinus());
        };
        const limb = vec3(
          pow(chanMu(sunDirR), 0.4064),
          pow(chanMu(sunDirW), 0.5079),
          pow(chanMu(sunDirB), 0.6406)
        );
        col.addAssign(
          tTexNode.sample(tParamsToUv(r, v.y)).rgb.mul(limb).mul(120.0)
        );
      });
    });
    return vec4(col.mul(exposure), 1.0);
  });

  // QuadMesh remains only for the irradiance pass (a 1x1
  // RenderTarget the async readback needs) and the readLut blit.
  const quad = new QuadMesh();

  function passMaterial(node) {
    const m = new MeshBasicNodeMaterial();
    m.colorNode = node;
    m.toneMapped = false;
    // LUT alpha channels carry data (the aerial LUT stores mean
    // transmittance in alpha); opaque node materials stomp output
    // alpha to 1, so write source RGBA verbatim.
    m.transparent = true;
    m.blending = NoBlending;
    return m;
  }

  // One compute invocation per texel; vUv at texel centres (the same
  // coordinates the readLut blit's uv() sees).
  function makeKernel(fn, lut) {
    const {w, h} = lut;
    return Fn(() => {
      const i = int(instanceIndex);
      const x = i.mod(w);
      const y = i.div(w);
      const vUv = vec2(float(x).add(0.5).div(w), float(y).add(0.5).div(h));
      textureStore(lut.tex, ivec2(x, y), fn(vUv));
    })().compute(w * h);
  }

  // Per-LUT fill: dispatch the kernel.
  function makeFill(fn, lut) {
    const kernel = makeKernel(fn, lut);
    return () => renderer.compute(kernel);
  }

  const fillT = makeFill(transmittanceNode, tLut);
  const fillMs = makeFill(multiscatterNode, msLut);
  const fillSky = makeFill(skyviewNode, skyLut);
  const fillAerial = makeFill(aerialNode, aerialLut);

  const irrMat = passMaterial(irradianceNode());

  const domeMat = new MeshBasicNodeMaterial({side: BackSide});
  domeMat.colorNode = domeColor();
  domeMat.toneMapped = false;
  domeMat.depthWrite = false;
  const mesh = new Mesh(new SphereGeometry(1400, 32, 20), domeMat);
  mesh.renderOrder = -3;

  let lutsBuilt = false;
  let lastMie = '';
  let lastMs = '';

  return {
    ok: true,
    mesh,
    aerialTex: aerialLut.tex,
    // Exact metres-per-scene-unit (roam.js MPU = 16000/280): the
    // old 57.14 literal was 50 ppm off the mapping's own constant.
    aerialMaxUnits: MAX_DIST_M / (400 / 7),
    // Crepuscular rays: the shadowed marches need the camera's
    // scene position, the sun's azimuth vector and the box's
    // elevation datum to place their shadow samples (set per frame
    // next to the fog hook's uSunAzV).
    aerialShadow: {camXZ: aerialCamXZ, sunAz: aerialSunAz, elev0: shadowElev0},
    // Refraction of the drawn disc: per-channel apparent
    // directions + vertical flattening (set from refraction.js).
    sunDisc: {dirR: sunDirR, dirB: sunDirB, flatten: sunFlat},
    // The sunset transfer LUT feed (see the band in domeColor).
    sunTransfer: {
      on: transOn,
      sunTrue: sunTrueAlt,
      set(curve) {
        const d = transTex.image.data;
        for (let i = 0; i < TRANS_ROWS; i++) {
          d[i * 4] = curve.tR[i];
          d[i * 4 + 1] = curve.tG[i];
          d[i * 4 + 2] = curve.tB[i];
          // Alpha = visibility: rows whose rays run into the
          // surface show sea, not sun.
          d[i * 4 + 3] = curve.vis ? curve.vis[i] : 1;
        }
        transTex.needsUpdate = true;
        transA0.value = curve.a[0];
        transA1.value = curve.a[curve.a.length - 1];
      }
    },
    // The dome's own radiance (exposure applied) for a world
    // direction - objects above the atmosphere (the moon) add this
    // over their surface so a dark disc never punches a hole in
    // the day sky.
    skyRadiance: (v) => skySampleFor(v).mul(exposure),
    // Exposed for the validation harness (orientation / content
    // checks against the GLSL reference).
    luts: {
      t: tLut.tex,
      ms: msLut.tex,
      sky: skyLut.tex
    },
    // Harness-only numeric readback of a LUT region: the LUTs are
    // storage textures, not render targets - blit through a quad
    // into a temp RT first. (All LUT widths keep w*16 bytes
    // 256-aligned; narrower WebGPU readbacks come back row-padded.)
    async readLut(name, x, y, w, h) {
      const lut = {t: tLut, ms: msLut, sky: skyLut, aerial: aerialLut}[name];
      const rt = makeTarget(lut.w, lut.h, FloatType);
      const m = passMaterial(texture(lut.tex).sample(uv()));
      quad.material = m;
      renderer.setRenderTarget(rt);
      quad.render(renderer);
      renderer.setRenderTarget(null);
      const px = await renderer.readRenderTargetPixelsAsync(rt, x, y, w, h);
      rt.dispose();
      return px;
    },
    // Called each frame: cheap sky-view raymarch for the current sun.
    // exposure models the eye's photopic adaptation (tone
    // reproduction, not physics): twilight is genuinely darker, but
    // not pitch black.
    update(sunDir, mie, camHMetres, expo, groundAlbedo) {
      // The ground albedo (shared by the MS LUT and the terminal
      // bounce): Payne (1972) 0.06 scalar where the box has sea,
      // or the box's MEASURED per-channel white-sky albedo inland
      // ([R,G,B] from the MOD09A1 RTLSR inversion - MODIS bands
      // 1/4/3, the nearest measured narrowbands to the atmosphere's
      // 680/550/440 nm channels).
      if (Array.isArray(groundAlbedo)) groundAlb.value.fromArray(groundAlbedo);
      else if (groundAlbedo != null) groundAlb.value.setScalar(groundAlbedo);
      // mie = {scat: [r,g,b], abs: [r,g,b], g} (1/m at h = 0) from
      // aerosol.js mieCoefficients - measured when /aerosol
      // answers, the Hillaire defaults calibrated to the measured
      // total AOD otherwise.
      if (mie) {
        mieScat.value.fromArray(mie.scat);
        mieAbs.value.fromArray(mie.abs);
        mieG.value = mie.g;
      }
      sunMu.value = sunDir.y;
      camH.value = camHMetres;
      sunDirW.value.copy(sunDir);
      if (expo) exposure.value = expo;
      // Aerosols change on sync cadence, not per frame; rebuild the
      // static LUTs only when the radiative set actually moves. The
      // multiple-scattering LUT also carries the fed ground albedo
      // (sea/land differs by anchor), so its key includes it.
      const mieKey = mie
        ? mie.scat.join() + '|' + mie.abs.join() + '|' + mie.g
        : lastMie;
      const msKey =
        mieKey +
        '|' +
        groundAlb.value.x +
        ',' +
        groundAlb.value.y +
        ',' +
        groundAlb.value.z;
      if (!lutsBuilt || msKey !== lastMs) {
        if (!lutsBuilt || mieKey !== lastMie) fillT();
        fillMs();
        lutsBuilt = true;
        lastMie = mieKey;
        lastMs = msKey;
      }
      fillSky();
      fillAerial();
      quad.material = irrMat;
      renderer.setRenderTarget(irrLut);
      quad.render(renderer);
      renderer.setRenderTarget(null);
    },
    // Cosine-weighted mean sky radiance (multiply by pi for
    // irradiance). Async: no pipeline stall, the caller updates the
    // hemisphere light when the read resolves (1 Hz cadence).
    async readIrradiance() {
      return renderer.readRenderTargetPixelsAsync(irrLut, 0, 0, 1, 1);
    }
  };
}
