import {
  NoBlending,
  BackSide,
  QuadMesh,
  HalfFloatType,
  FloatType,
  LinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  RenderTarget,
  SphereGeometry,
  StorageTexture,
  Vector3
} from 'three/webgpu';
import {
  Fn,
  If,
  Loop,
  abs,
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
 *  - sky-view LUT 192x108 per frame (32 steps, sqrt-warped elevation
 *    split at the true horizon)
 *  - aerial-perspective LUT 64x32 (relative azimuth x distance, 20
 *    steps) for the per-material fog hook
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
const SKY_H = 108; // sky-view LUT rows; the guarded split needs it

export function createAtmosphereTSL(renderer) {
  const mieScale = uniform(1);
  const sunMu = uniform(0.5);
  const camH = uniform(300);
  const exposure = uniform(28);
  const sunDirW = uniform(new Vector3(0, 1, 0));

  const rayleighS = vec3(5.802e-6, 13.558e-6, 33.1e-6);
  const ozoneA = vec3(0.65e-6, 1.881e-6, 0.085e-6);
  const MIE_S0 = 3.996e-6;
  const MIE_A0 = 4.4e-6;

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
      .add(d.y.mul(MIE_S0 + MIE_A0).mul(mieScale))
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
  const phaseM = Fn(([c]) => {
    const g = 0.8;
    const g2 = g * g;
    return float((3.0 / (8.0 * 3.14159265)) * ((1.0 - g2) / (2.0 + g2)))
      .mul(c.mul(c).add(1.0))
      .div(pow15(float(1.0 + g2).sub(c.mul(2.0 * g))));
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
  const skyLut = makeLut(192, SKY_H);
  const aerialLut = makeLut(64, 32);
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

  // ---------- multiple scattering (built once) ----------
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
        const scat = rayleighS
          .mul(dens.x)
          .add(dens.y.mul(MIE_S0).mul(mieScale));
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
        Li.addAssign(
          T.mul(sunT(float(RB), muSg))
            .mul(max(muSg, 0.0))
            .mul(0.3 / 3.14159265)
        );
      });
      L2.addAssign(Li.div(DIRS));
      fms.addAssign(fi3.div(DIRS));
    });
    const psi = L2.div(max(vec3(1).sub(fms), vec3(1e-4)));
    return vec4(psi, 1.0);
  });

  // Shared single-scattering march used by sky-view and aerial (step
  // count is a compile-time constant, hence the factory).
  const makeMarchSky = (steps) =>
    Fn(([r, dir, dEnd]) => {
      const dt = dEnd.div(steps);
      const T = vec3(1).toVar();
      const L = vec3(0).toVar();
      const mu = dir.y;
      const sunS = sqrt(max(sunMu.mul(sunMu).oneMinus(), 0.0));
      const sunDir = vec3(sunS, sunMu, 0.0);
      const cSun = dot(dir, sunDir);
      Loop(steps, ({i: s}) => {
        const ti = float(s).add(0.5).mul(dt);
        const ri = sqrt(
          r.mul(r).add(ti.mul(ti)).add(r.mul(ti).mul(mu).mul(2.0))
        );
        const h = ri.sub(RB);
        const dens = densities(h);
        const scatR = rayleighS.mul(dens.x);
        const scatM = vec3(dens.y.mul(MIE_S0).mul(mieScale));
        const ext = extinction(h);
        const muSi = clamp(r.mul(sunMu).add(ti.mul(cSun)).div(ri), -1.0, 1.0);
        const Ts = sunT(ri, muSi);
        const S = scatR
          .mul(phaseR(cSun))
          .add(scatM.mul(phaseM(cSun)))
          .mul(Ts)
          .add(scatR.add(scatM).mul(psiMS(ri, muSi)));
        const stepT = exp(ext.mul(dt).negate());
        L.addAssign(T.mul(S.sub(S.mul(stepT))).div(max(ext, vec3(1e-9))));
        T.mulAssign(stepT);
      });
      return vec4(L, dot(T, vec3(1 / 3, 1 / 3, 1 / 3)));
    });
  const marchSky32 = makeMarchSky(32);
  const marchSky20 = makeMarchSky(20);

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
    const relAz = vUv.x.mul(3.14159265);
    const se = sin(elev);
    const ce = cos(elev);
    const dir = vec3(ce.mul(cos(relAz)), se, ce.mul(sin(relAz)));
    const dGround = raySphere(r, dir.y, float(RB));
    const dTop = raySphere(r, dir.y, float(RT));
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
    return marchSky32(r, dir, dEnd);
  });

  // ---------- aerial perspective (per frame) ----------
  const aerialNode = Fn(([vUv]) => {
    const relAz = vUv.x.mul(3.14159265);
    const dist = vUv.y.mul(MAX_DIST_M);
    const r = float(RB).add(max(camH, 1.0));
    const dir = vec3(cos(relAz), 0.0, sin(relAz));
    return marchSky20(r, dir, dist);
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
  const domeColor = Fn(() => {
    const v = normalize(positionLocal);
    const r = float(RB).add(max(camH, 1.0));
    const horizon = sqrt(max(r.mul(r).sub(RB * RB), 0.0))
      .div(r)
      .negate();
    const hAngle = horizon.clamp(-1, 1).asin();
    const elev = v.y.clamp(-1, 1).asin();
    const sunH = normalize(sunDirW.xz.add(vec2(1e-6, 1e-6)));
    const vH = normalize(v.xz.add(vec2(1e-6, 1e-6)));
    const relAz = dot(sunH, vH).clamp(-1, 1).acos();
    const ux = relAz.div(3.14159265);
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
    const col = mix(
      skyTexNode.sample(vec2(ux, uyBelow)).rgb,
      skyTexNode.sample(vec2(ux, uyAbove)).rgb,
      cov
    ).toVar();
    // The sun disc: direct transmittance with photospheric limb
    // darkening, Hestroffer & Magnan (1998) power law I(mu) = mu^a,
    // a(lambda_um) = -0.023 + 0.292 / lambda, at the same 680/550/440
    // nm the scattering coefficients use. mu = cos of the angular
    // offset from disc centre normalised to the disc radius; the 120
    // constant is now the CENTRAL intensity.
    const cSun = dot(v, sunDirW);
    If(cSun.greaterThan(0.9999893), () => {
      const sin2R = 1 - 0.9999893 * 0.9999893;
      const s2 = clamp(cSun.mul(cSun).oneMinus().div(sin2R), 0.0, 1.0);
      const muD = sqrt(s2.oneMinus());
      const limb = pow(vec3(muD), vec3(0.4064, 0.5079, 0.6406));
      col.addAssign(
        tTexNode.sample(tParamsToUv(r, v.y)).rgb.mul(limb).mul(120.0)
      );
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
  let lastMie = -1;

  return {
    ok: true,
    mesh,
    aerialTex: aerialLut.tex,
    aerialMaxUnits: MAX_DIST_M / 57.14,
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
    update(sunDir, mie, camHMetres, expo) {
      mieScale.value = mie;
      sunMu.value = sunDir.y;
      camH.value = camHMetres;
      sunDirW.value.copy(sunDir);
      if (expo) exposure.value = expo;
      // Aerosols change slowly; rebuild the static LUTs only when the
      // measured AOD moves.
      if (!lutsBuilt || Math.abs(mie - lastMie) > 0.05) {
        fillT();
        fillMs();
        lutsBuilt = true;
        lastMie = mie;
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
