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
  max,
  min,
  normalize,
  positionLocal,
  select,
  sin,
  sqrt,
  texture,
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
 * Runs identically on WebGPU and on WebGPURenderer's WebGL2 backend -
 * in phase 3 the LUT passes become compute dispatches; the functions
 * here stay the single definition of the physics.
 */

const RB = 6360e3;
const RT = 6460e3;
const MAX_DIST_M = 25700; // 450 scene units at 57.14 m/unit

export function createAtmosphereTSL(renderer) {
  // Float render targets are required; on the WebGL2 backend that
  // means EXT_color_buffer_float (same gate as the GLSL version).
  try {
    const gl = renderer.backend.gl;
    if (gl && !gl.getExtension('EXT_color_buffer_float')) return {ok: false};
  } catch {
    /* WebGPU backend: float targets are core */
  }

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

  const tLut = makeTarget(256, 64);
  const msLut = makeTarget(32, 32);
  const skyLut = makeTarget(192, 108);
  const aerialLut = makeTarget(64, 32);
  const irrLut = makeTarget(1, 1, FloatType);

  const tTexNode = texture(tLut.texture);
  const msTexNode = texture(msLut.texture);
  const skyTexNode = texture(skyLut.texture);

  const sunT = Fn(([r, mu]) => tTexNode.sample(tParamsToUv(r, mu)).rgb);
  const psiMS = Fn(
    ([r, mu]) =>
      msTexNode.sample(vec2(mu.mul(0.5).add(0.5), r.sub(RB).div(RT - RB))).rgb
  );

  // ---------- transmittance (built once per aerosol change) ----------
  const transmittanceNode = Fn(() => {
    const vUv = uv();
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
  const multiscatterNode = Fn(() => {
    const vUv = uv();
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

  // ---------- sky-view (per frame) ----------
  const skyviewNode = Fn(() => {
    const vUv = uv();
    const r = float(RB).add(max(camH, 1.0));
    const horizon = sqrt(max(r.mul(r).sub(RB * RB), 0.0))
      .div(r)
      .negate();
    const hAngle = horizon.clamp(-1, 1).asin();
    const elev = float(0).toVar();
    If(vUv.y.lessThan(0.5), () => {
      const c = float(1.0).sub(vUv.y.mul(2.0));
      elev.assign(hAngle.sub(c.mul(c).mul(hAngle.add(1.5707963))));
    }).Else(() => {
      const c = vUv.y.mul(2.0).sub(1.0);
      elev.assign(hAngle.add(c.mul(c).mul(float(1.5707963).sub(hAngle))));
    });
    const relAz = vUv.x.mul(3.14159265);
    const se = sin(elev);
    const ce = cos(elev);
    const dir = vec3(ce.mul(cos(relAz)), se, ce.mul(sin(relAz)));
    const dGround = raySphere(r, dir.y, float(RB));
    const dTop = raySphere(r, dir.y, float(RT));
    const dEnd = max(select(dGround.greaterThan(0.0), dGround, dTop), 0.0);
    return marchSky32(r, dir, dEnd);
  });

  // ---------- aerial perspective (per frame) ----------
  const aerialNode = Fn(() => {
    const vUv = uv();
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
      const uy = float(0.5)
        .add(
          sqrt(
            clamp(elev.sub(hAngle).div(float(1.5707963).sub(hAngle)), 0.0, 1.0)
          ).mul(0.5)
        )
        .toVar();
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
    const uy = float(0).toVar();
    If(elev.lessThan(hAngle), () => {
      uy.assign(
        float(0.5).sub(
          sqrt(
            clamp(hAngle.sub(elev).div(hAngle.add(1.5707963)), 0.0, 1.0)
          ).mul(0.5)
        )
      );
    }).Else(() => {
      uy.assign(
        float(0.5).add(
          sqrt(
            clamp(elev.sub(hAngle).div(float(1.5707963).sub(hAngle)), 0.0, 1.0)
          ).mul(0.5)
        )
      );
    });
    const sunH = normalize(sunDirW.xz.add(vec2(1e-6, 1e-6)));
    const vH = normalize(v.xz.add(vec2(1e-6, 1e-6)));
    const relAz = dot(sunH, vH).clamp(-1, 1).acos();
    const col = skyTexNode.sample(vec2(relAz.div(3.14159265), uy)).rgb.toVar();
    // The sun disc itself: direct transmittance, honestly clipped.
    const cSun = dot(v, sunDirW);
    If(cSun.greaterThan(0.9999893), () => {
      col.addAssign(tTexNode.sample(tParamsToUv(r, v.y)).rgb.mul(120.0));
    });
    return vec4(col.mul(exposure), 1.0);
  });

  // Pass plumbing: QuadMesh, deliberately. Probes established the
  // texture-coordinate conventions on WebGPURenderer's WebGL backend:
  //   - readback rows and SCENE-geometry writes are GL bottom-origin
  //   - QuadMesh writes AND texture().sample() reads are both V-flipped
  // So QuadMesh-write + sample() is self-consistent for every GPU
  // consumer (chained passes, the dome, the aerial hook in materials).
  // Do NOT mix scene-geometry writes into this chain, and remember
  // that numeric readbacks of these LUTs see flipped rows.
  const quad = new QuadMesh();

  function passMaterial(node) {
    const m = new MeshBasicNodeMaterial();
    m.colorNode = node();
    m.toneMapped = false;
    // LUT alpha channels carry data (the aerial LUT stores mean
    // transmittance in alpha); opaque node materials stomp output
    // alpha to 1, so write source RGBA verbatim.
    m.transparent = true;
    m.blending = NoBlending;
    return m;
  }
  const tMat = passMaterial(transmittanceNode);
  const msMat = passMaterial(multiscatterNode);
  const svMat = passMaterial(skyviewNode);
  const aerialMat = passMaterial(aerialNode);
  const irrMat = passMaterial(irradianceNode);

  function pass(mat, target) {
    quad.material = mat;
    renderer.setRenderTarget(target);
    quad.render(renderer);
    renderer.setRenderTarget(null);
  }

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
    aerialTex: aerialLut.texture,
    aerialMaxUnits: MAX_DIST_M / 57.14,
    // Exposed for the validation harness (orientation / content
    // checks against the GLSL reference).
    luts: {
      t: tLut.texture,
      ms: msLut.texture,
      sky: skyLut.texture
    },
    // Harness-only numeric readback of a LUT region.
    async readLut(name, x, y, w, h) {
      const rt = {t: tLut, ms: msLut, sky: skyLut, aerial: aerialLut}[name];
      return renderer.readRenderTargetPixelsAsync(rt, x, y, w, h);
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
        pass(tMat, tLut);
        pass(msMat, msLut);
        lutsBuilt = true;
        lastMie = mie;
      }
      pass(svMat, skyLut);
      pass(aerialMat, aerialLut);
      pass(irrMat, irrLut);
    },
    // Cosine-weighted mean sky radiance (multiply by pi for
    // irradiance). Async: no pipeline stall, the caller updates the
    // hemisphere light when the read resolves (1 Hz cadence).
    async readIrradiance() {
      return renderer.readRenderTargetPixelsAsync(irrLut, 0, 0, 1, 1);
    }
  };
}
