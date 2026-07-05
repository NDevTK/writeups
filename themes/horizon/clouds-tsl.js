import {
  WebGLCoordinateSystem,
  CustomBlending,
  NoBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  Color,
  Data3DTexture,
  DataTexture,
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  MeshBasicNodeMaterial,
  NearestFilter,
  QuadMesh,
  RGBAFormat,
  RenderTarget,
  RepeatWrapping,
  StorageTexture,
  Vector2,
  Vector3
} from 'three/webgpu';
import {
  Break,
  Fn,
  If,
  Loop,
  clamp,
  dot,
  exp,
  float,
  fract,
  instanceIndex,
  int,
  ivec2,
  max,
  min,
  mix,
  mrt,
  normalize,
  positionWorld,
  screenCoordinate,
  select,
  smoothstep,
  struct,
  texture,
  texture3D,
  textureStore,
  uniform,
  uv,
  vec2,
  vec3,
  vec4
} from 'three/tsl';
import {generateCloudArrays} from './cloud-noise.js';
import {generateBlueNoise} from './blue-noise.js';

/**
 * TSL port of the temporally reconstructed Nubis cloud system (WebGPU
 * project, phase 2). Same pipeline as the GLSL version it replaces:
 * quarter-res march (one 4x4 Bayer pixel fresh per frame, the rest
 * reprojected through the previous view-projection), both decks in ONE
 * pass composited near-over-far premultiplied, rays clamped at the
 * real terrain depth, golden-ratio jitter with exponential history
 * integration, nearest-depth upsampling at composite (Jansen & Bavoil
 * 2010). The noise physics lives once in cloud-noise.js.
 *
 * Phase 3: the march body is a coordinate-parameterised Fn (single
 * physics definition) with two drivers - on WebGPU it is a compute
 * dispatch ping-ponging two StorageTextures; on the WebGL2 backend it
 * stays the QuadMesh pass into render targets. The composite remains
 * a raster pass on both (it blends into the frame).
 *
 * Texture-coordinate conventions (pinned by probes, WEBGPU-PLAN.md):
 * in TSL-land QuadMesh uv(), colour sample() and depth-texture
 * sample() are all uniformly TOP-ORIGIN, so screen-aligned textures
 * are sampled at uv()/screen position directly; the only flips live
 * at uv <-> NDC conversions (ndc.y = 1 - 2v).
 */

export function generateCloudTexturesTSL() {
  const {base, N, det, M} = generateCloudArrays();
  const baseTex = new Data3DTexture(base, N, N, N);
  baseTex.format = RGBAFormat;
  baseTex.minFilter = baseTex.magFilter = LinearFilter;
  baseTex.wrapS = baseTex.wrapT = baseTex.wrapR = RepeatWrapping;
  baseTex.needsUpdate = true;
  const detailTex = new Data3DTexture(det, M, M, M);
  detailTex.format = RGBAFormat;
  detailTex.minFilter = detailTex.magFilter = LinearFilter;
  detailTex.wrapS = detailTex.wrapT = detailTex.wrapR = RepeatWrapping;
  detailTex.needsUpdate = true;
  return {baseTex, detailTex};
}

function quarterTarget(w, h, count = 1) {
  return new RenderTarget(w, h, {
    count,
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
    stencilBuffer: false
  });
}

/**
 * Cloud shadows on the world (phase 5): Beer-Lambert through the SAME
 * Nubis density field the sky renders - the deck's sun optical depth
 * integrated vertically into a 2D map (Schneider 2015's cloud shadow
 * map), applied per pixel to every sunlit material through three's
 * receivedShadowNode hook, replacing the flat (1 - cloudy*k) global
 * dim for the decks.
 *
 * The hook is standalone (materials are built before the lazy cloud
 * system exists): it owns the map's texture node and the projection
 * uniforms, and multiplies the received CSM shadow by
 * exp(-tau / max(sunDir.y, 0.08)) per deck, sampled where the sun ray
 * through the surface point crosses that deck's mid height. The map
 * itself is filled by the cloud system (attachShadow) because the
 * density lives there; until then it is a zero texture - full sun.
 */
export function createCloudShadowHook() {
  const SIZE = 256;
  const zero = new DataTexture(
    new Uint8Array([0, 0, 0, 255]),
    1,
    1,
    RGBAFormat
  );
  zero.needsUpdate = true;
  const tauNode = texture(zero); // .value swaps to the filled map
  const u = {
    uSunDirW: uniform(new Vector3(0, 1, 0)),
    uMidLow: uniform(31),
    uMidMid: uniform(60),
    uWorldSize: uniform(280),
    uOn: uniform(0)
  };
  const transmittance = Fn(([worldPos]) => {
    const res = float(1).toVar();
    If(u.uOn.greaterThan(0.5), () => {
      const sy = max(u.uSunDirW.y, 0.08);
      const slant = sy.reciprocal();
      const toUv = (p) => p.div(u.uWorldSize).add(0.5);
      // Project along the sun ray to each deck's mid height; the map
      // stores each deck's VERTICAL sigma*integral(density) in its
      // own channel.
      const oLow = u.uSunDirW.xz
        .div(sy)
        .mul(u.uMidLow.sub(worldPos.y))
        .add(worldPos.xz);
      const oMid = u.uSunDirW.xz
        .div(sy)
        .mul(u.uMidMid.sub(worldPos.y))
        .add(worldPos.xz);
      const tau = tauNode
        .sample(toUv(oLow))
        .x.add(tauNode.sample(toUv(oMid)).y);
      res.assign(exp(tau.mul(slant).negate()));
    });
    return res;
  });
  return {
    tauNode,
    uniforms: u,
    size: SIZE,
    // For unlit materials (the water builds its sun terms itself):
    // the Beer-Lambert transmittance at a world position.
    transmittance,
    applyTo(material) {
      material.receivedShadowNode = Fn(([shadow]) =>
        shadow.mul(transmittance(positionWorld))
      );
    },
    update(sunDir, on) {
      u.uSunDirW.value.copy(sunDir);
      u.uOn.value = on ? 1 : 0;
    }
  };
}

export function createCloudSystemTSL(renderer, baseTex, detailTex) {
  const mkDeck = (cType, sigma) => ({
    cov: uniform(0),
    yBase: uniform(24),
    yTop: uniform(38),
    cType: uniform(cType),
    sigma: uniform(sigma),
    wOff: uniform(new Vector2(0, 0))
  });
  const uniformsLow = mkDeck(1, 0.9);
  const uniformsMid = mkDeck(0.15, 0.45);
  const shared = {
    sunDirW: uniform(new Vector3(0, 1, 0)),
    sunCol: uniform(new Color(1, 1, 1)),
    ambCol: uniform(new Color(0.3, 0.35, 0.4))
  };
  const invVP = uniform(new Matrix4());
  const prevVP = uniform(new Matrix4());
  const camPos = uniform(new Vector3());
  const frameI = uniform(0);
  const warm = uniform(1);
  const resQ = uniform(new Vector2(1, 1));

  const baseNode = texture3D(baseTex);
  const detailNode = texture3D(detailTex);
  // Swappable per-frame textures (node.value updated in render()).
  const histNode = texture(quarterTarget(2, 2).texture);
  const histDepthNode = texture(quarterTarget(2, 2).texture);
  const depthNode = texture(new DepthTexture(2, 2));
  const cloudNode = texture(quarterTarget(2, 2).texture);

  // ---------- density model (one definition for both decks) ----------
  const remapf = Fn(([v, a, b, c, d]) =>
    c.add(clamp(v, a, b).sub(a).div(b.sub(a)).mul(d.sub(c)))
  );

  // Weather map: zero-mean difference of two samples of the same
  // stationary noise - the REAL reported cover is conserved.
  const coverAt = Fn(([xz, cov, wOff]) => {
    const q = xz.add(wOff).mul(0.0019);
    const wvar = baseNode
      .sample(vec3(q.x, 0.5, q.y))
      .g.sub(baseNode.sample(vec3(q.x.add(0.5), 0.13, q.y.add(0.5))).g);
    return clamp(cov.add(wvar.mul(1.6).mul(cov).mul(cov.oneMinus())), 0.0, 1.0);
  });

  // Height gradients by cloud type (Nubis).
  const heightProfile = Fn(([h, cType]) => {
    const vpS = smoothstep(0.0, 0.1, h).mul(
      smoothstep(0.25, 0.55, h).oneMinus()
    );
    const vpC = smoothstep(0.0, 0.08, h).mul(smoothstep(1.0, 0.3, h));
    const vpT = smoothstep(0.0, 0.05, h).mul(smoothstep(1.0, 0.9, h));
    return mix(
      mix(vpS, vpC, clamp(cType, 0.0, 1.0)),
      vpT,
      clamp(cType.sub(1.0), 0.0, 1.0)
    );
  });

  const densityCoarse = Fn(([p, h, cov, cType, wOff]) => {
    const uvw = vec3(
      p.x.add(wOff.x).mul(0.0055),
      p.y.mul(0.016),
      p.z.add(wOff.y).mul(0.0055)
    );
    const nb = baseNode.sample(uvw);
    const wfbm = nb.g.mul(0.625).add(nb.b.mul(0.25)).add(nb.a.mul(0.125));
    const d = remapf(nb.r, wfbm.oneMinus().negate(), 1.0, 0.0, 1.0);
    const covL = coverAt(p.xz, cov, wOff);
    const d2 = remapf(d, covL.oneMinus(), 1.0, 0.0, 1.0).mul(covL);
    return d2.mul(heightProfile(h, cType));
  });

  const density = Fn(([p, h, cov, cType, wOff]) => {
    const res = float(0).toVar();
    const d = densityCoarse(p, h, cov, cType, wOff);
    If(d.greaterThan(0.0), () => {
      const uvw = vec3(
        p.x.add(wOff.x).mul(0.0055),
        p.y.mul(0.016),
        p.z.add(wOff.y).mul(0.0055)
      );
      const dn = detailNode.sample(uvw.mul(6.0)).rgb;
      const dfbm = dn.r.mul(0.625).add(dn.g.mul(0.25)).add(dn.b.mul(0.125));
      const er = mix(dfbm, dfbm.oneMinus(), clamp(h.mul(3.0), 0.0, 1.0));
      res.assign(clamp(remapf(d, er.mul(0.35), 1.0, 0.0, 1.0), 0.0, 1.0));
    });
    return res;
  });

  const pow15v = Fn(([x]) => {
    const m = max(x, 1e-6);
    return m.mul(m.sqrt());
  });
  // JS-side node builder (g is always a compile-time constant lobe).
  const hg = (c, g) => {
    const g2 = g * g;
    return float((1 - g2) / (4 * 3.14159265)).div(
      pow15v(float(1 + g2).sub(c.mul(2 * g)))
    );
  };

  // Blue-noise march jitter (phase 4): a 64x64 void-and-cluster rank
  // mask replaces the white-noise sin-hash - neighbouring pixels get
  // maximally different march phases, so the un-converged temporal
  // estimate dithers at the highest frequency instead of mottling.
  // Ranks are stored 16-bit across R and G (a uint8 pair); the
  // golden-ratio sequence stays as the TEMPORAL decorrelator.
  const bn = generateBlueNoise();
  const bnData = new Uint8Array(bn.N * bn.N * 4);
  for (let i = 0; i < bn.N * bn.N; i++) {
    const q = bn.rank[i] * 16 + 8; // (rank + 0.5) / 4096 in 16 bits
    bnData[i * 4] = q >> 8;
    bnData[i * 4 + 1] = q & 255;
    bnData[i * 4 + 3] = 255;
  }
  const bnTex = new DataTexture(bnData, bn.N, bn.N, RGBAFormat);
  bnTex.minFilter = bnTex.magFilter = NearestFilter;
  bnTex.wrapS = bnTex.wrapT = RepeatWrapping;
  bnTex.needsUpdate = true;
  const bnNode = texture(bnTex);
  const blueNoiseAt = Fn(([pix]) => {
    const t = bnNode.sample(pix.div(bn.N));
    return t.r.mul((255 * 256) / 65536).add(t.g.mul(255 / 65536));
  });

  // World-space distance to the terrain along this pixel's ray from
  // the depth prepass (1.0 = far plane = unoccluded sky). Depth
  // textures sample top-origin like everything else in TSL-land, so
  // screen-aligned uv needs no flip; NDC does (y = 1 - 2v).
  // NOTE(phase 3): d*2-1 assumes GL clip-z; parameterise for WebGPU's
  // 0..1 clip-z when the backend flips.
  // Depth-value -> NDC z differs per backend: GL clip z is -1..1
  // (z = 2d-1), WebGPU is 0..1 (z = d). The ray build at the far
  // plane (z = 1) is the same in both. coordinateSystem is final
  // after renderer.init(), and this factory runs after it.
  const glClip = renderer.coordinateSystem === WebGLCoordinateSystem;
  const sceneDist = Fn(([vUv, ndc]) => {
    const res = float(1e8).toVar();
    const d = depthNode.sample(vUv).r;
    If(d.lessThan(0.9999), () => {
      const zNdc = glClip ? d.mul(2.0).sub(1.0) : d;
      const w = invVP.mul(vec4(ndc, zNdc, 1.0));
      res.assign(w.xyz.div(w.w).sub(camPos).length());
    });
    return res;
  });

  // Coarse ranging: distance to the first density along the ray in
  // this slab, or -1. Split from the fine march (phase 4) because it
  // doubles as the CLOUD FRONT DEPTH the depth-aware reprojection
  // stores per pixel; marchSlab receives its result so the ranging
  // still runs exactly once per deck.
  const slabFront = Fn(([ro, rd, sceneD, yB, yT, cov, cTy, wO]) => {
    const tStart = float(-1).toVar();
    If(cov.greaterThan(0.02).and(rd.y.abs().greaterThan(1e-4)), () => {
      const tA = yB.sub(ro.y).div(rd.y);
      const tB = yT.sub(ro.y).div(rd.y);
      const t0 = max(min(tA, tB), 0.0).toVar();
      const t1 = min(max(tA, tB), min(2600.0, sceneD)).toVar();
      If(t1.greaterThan(t0), () => {
        const COARSE = 14;
        const dtc = t1.sub(t0).div(COARSE);
        const tc = t0.add(dtc.mul(0.5)).toVar();
        Loop(COARSE, () => {
          const pc = ro.add(rd.mul(tc));
          const hc = clamp(pc.y.sub(yB).div(yT.sub(yB)), 0.0, 1.0);
          If(densityCoarse(pc, hc, cov, cTy, wO).greaterThan(0.0), () => {
            tStart.assign(max(tc.sub(dtc), t0));
            Break();
          });
          tc.addAssign(dtc);
        });
      });
    });
    return tStart;
  });

  // One slab: fine march from the pre-ranged start with 4-tap Beer,
  // Beer-powder, dual-lobe HG; PREMULTIPLIED output with horizon fade.
  const marchSlab = Fn(
    ([ro, rd, jit, sceneD, tStart, yB, yT, cov, cTy, sg, wO, phase]) => {
      const result = vec4(0).toVar();
      If(tStart.greaterThanEqual(0.0), () => {
        const tA = yB.sub(ro.y).div(rd.y);
        const tB = yT.sub(ro.y).div(rd.y);
        const t0 = max(min(tA, tB), 0.0).toVar();
        const t1 = min(max(tA, tB), min(2600.0, sceneD)).toVar();
        If(t1.greaterThan(tStart), () => {
          const fade = exp(t0.mul(-0.0011));
          {
            const STEPS = 28;
            const dt = t1.sub(tStart).div(STEPS);
            const t = tStart.add(dt.mul(jit)).toVar();
            const L = vec3(0).toVar();
            const T = float(1).toVar();
            Loop(STEPS, () => {
              const p = ro.add(rd.mul(t)).toVar();
              const h = clamp(p.y.sub(yB).div(yT.sub(yB)), 0.0, 1.0);
              const d = density(p, h, cov, cTy, wO);
              If(d.greaterThan(0.01), () => {
                // 4-tap Beer toward the sun.
                const dts = clamp(
                  yT.sub(p.y).div(max(shared.sunDirW.y, 0.25)).mul(0.25),
                  0.4,
                  6.0
                ).toVar();
                const tauS = float(0).toVar();
                Loop(4, ({i: s}) => {
                  const ps = p.add(
                    shared.sunDirW.mul(dts.mul(float(s).add(1.0)))
                  );
                  const hs = clamp(ps.y.sub(yB).div(yT.sub(yB)), 0.0, 1.0);
                  tauS.addAssign(density(ps, hs, cov, cTy, wO).mul(dts));
                });
                tauS.mulAssign(sg);
                // Multiple scattering by attenuated octaves
                // (Wrenninge et al. 2013 "Oz: The Great and
                // Volumetric"; real-time form per Hillaire, Frostbite
                // 2016), replacing the Beer-powder cheat: octave i
                // scales contribution by a^i, sun optical depth by
                // b^i, and phase eccentricity by c^i (the phase
                // vector arrives per octave). a = b = c = 0.5,
                // N = 3; a <= b keeps it energy-conserving.
                const octA = vec3(1.0, 0.5, 0.25);
                const octExt = exp(tauS.negate().mul(vec3(1.0, 0.5, 0.25)));
                const sunTerm = dot(octA.mul(octExt), phase);
                // 18 was the display calibration of the old
                // single-scatter term; dividing by sum(a^i) = 1.75
                // keeps that white point - the octave SHAPE (deep
                // transmission, more isotropic side-lighting) is the
                // physics, the constant is exposure.
                const S = shared.sunCol
                  .mul(sunTerm)
                  .mul(18.0 / 1.75)
                  .add(shared.ambCol.mul(mix(0.35, 1.0, h)));
                const sT = exp(sg.mul(d).mul(dt).negate());
                L.addAssign(T.mul(S.sub(S.mul(sT))));
                T.mulAssign(sT);
                If(T.lessThan(0.01), () => {
                  Break();
                });
              });
              t.addAssign(dt);
            });
            result.assign(vec4(L.mul(fade), T.oneMinus().mul(fade)));
          }
        });
      });
      return result;
    }
  );

  // No cloud on this ray: far sentinel, so the depth-aware
  // reprojection degrades to direction-only (parallax -> 0), which
  // is exact for the sky.
  const FAR_CLOUD = 30000.0;

  // ---------- the reconstruction (quarter res) ----------
  // pix carries fragment-convention pixel CENTRES (x+0.5, y+0.5) -
  // exactly screenCoordinate.xy in the raster driver - so the Bayer
  // lattice and the per-pixel hash are bit-identical in both drivers.
  // A JS builder (one call per driver), not an Fn: it returns TWO
  // nodes - {col, front} - and the drivers route them to their dual
  // outputs (MRT attachments / storage textures).
  const buildMarch = (vUv, pix) => {
    const ndc = vec2(vUv.x.mul(2.0).sub(1.0), float(1.0).sub(vUv.y.mul(2.0)));
    const wf = invVP.mul(vec4(ndc, 1.0, 1.0));
    const rd = normalize(wf.xyz.div(wf.w).sub(camPos)).toVar();

    // 4x4 Bayer in closed form: B4(x,y) = 4*b2(x&1,y&1) +
    // b2((x>>1)&1,(y>>1)&1) with b2(x,y) = (3y)^(2x).
    const px = pix.x.toInt();
    const py = pix.y.toInt();
    const b2lo = py
      .bitAnd(int(1))
      .mul(int(3))
      .bitXor(px.bitAnd(int(1)).mul(int(2)));
    const b2hi = py
      .shiftRight(int(1))
      .bitAnd(int(1))
      .mul(int(3))
      .bitXor(px.shiftRight(int(1)).bitAnd(int(1)).mul(int(2)));
    const bayer = b2lo.mul(int(4)).add(b2hi).toFloat();

    const fresh = bayer.equal(frameI).or(warm.equal(1.0));

    // Depth-aware history reprojection (phase 4). The camera
    // translates (intro ease, free flight), so a fixed proxy
    // distance parallaxes wrongly for everything not at that
    // distance. Two-step scheme (Schneider): estimate the previous
    // uv with the proxy, read the CLOUD FRONT DEPTH the history
    // stores there, then reproject through that distance. Rotation
    // stays exact for any distance; sky pixels carry the FAR_CLOUD
    // sentinel and degrade to direction-only. uv is top-origin: flip
    // when converting the NDC projection back to texture coords.
    const p0Clip = prevVP.mul(vec4(camPos.add(rd.mul(600.0)), 1.0));
    const p0Ndc = p0Clip.xy.div(p0Clip.w);
    const p0Uv = vec2(
      p0Ndc.x.mul(0.5).add(0.5),
      float(0.5).sub(p0Ndc.y.mul(0.5))
    );
    const ok0 = p0Clip.w
      .greaterThan(0.0)
      .and(p0Uv.x.greaterThanEqual(0.0))
      .and(p0Uv.x.lessThanEqual(1.0))
      .and(p0Uv.y.greaterThanEqual(0.0))
      .and(p0Uv.y.lessThanEqual(1.0));
    const d0 = select(ok0, histDepthNode.sample(p0Uv).r, float(600.0));
    const dRef = clamp(d0, 50.0, FAR_CLOUD);
    const pClip = prevVP.mul(vec4(camPos.add(rd.mul(dRef)), 1.0));
    const pNdc = pClip.xy.div(pClip.w);
    const pUv = vec2(pNdc.x.mul(0.5).add(0.5), float(0.5).sub(pNdc.y.mul(0.5)));
    const histOk = pClip.w
      .greaterThan(0.0)
      .and(pUv.x.greaterThanEqual(0.0))
      .and(pUv.x.lessThanEqual(1.0))
      .and(pUv.y.greaterThanEqual(0.0))
      .and(pUv.y.lessThanEqual(1.0));
    const hist = histNode.sample(pUv).toVar();

    const result = vec4(0).toVar();
    const front = float(FAR_CLOUD).toVar();
    If(fresh.not().and(histOk), () => {
      result.assign(hist);
      // Carry the reprojected front depth forward with its colour.
      front.assign(histDepthNode.sample(pUv).r);
    }).Else(() => {
      const sceneD = sceneDist(vUv, ndc).toVar();
      // Golden-ratio temporal jitter + exponential integration: the
      // march-start estimate converges to the true integral over time.
      const jit = fract(blueNoiseAt(pix).add(frameI.mul(0.618034))).toVar();
      const cSun = dot(rd, shared.sunDirW);
      // Dual-lobe HG per multiple-scattering octave: eccentricity
      // scaled by c^i (c = 0.5) on both lobes (Wrenninge 2013).
      const dualHG = (s) => mix(hg(cSun, 0.6 * s), hg(cSun, -0.3 * s), 0.35);
      const phase = vec3(dualHG(1), dualHG(0.5), dualHG(0.25)).toVar();
      const fLow = slabFront(
        camPos,
        rd,
        sceneD,
        uniformsLow.yBase,
        uniformsLow.yTop,
        uniformsLow.cov,
        uniformsLow.cType,
        uniformsLow.wOff
      ).toVar();
      const fMid = slabFront(
        camPos,
        rd,
        sceneD,
        uniformsMid.yBase,
        uniformsMid.yTop,
        uniformsMid.cov,
        uniformsMid.cType,
        uniformsMid.wOff
      ).toVar();
      const A = marchSlab(
        camPos,
        rd,
        jit,
        sceneD,
        fLow,
        uniformsLow.yBase,
        uniformsLow.yTop,
        uniformsLow.cov,
        uniformsLow.cType,
        uniformsLow.sigma,
        uniformsLow.wOff,
        phase
      ).toVar();
      const B = marchSlab(
        camPos,
        rd,
        jit,
        sceneD,
        fMid,
        uniformsMid.yBase,
        uniformsMid.yTop,
        uniformsMid.cov,
        uniformsMid.cType,
        uniformsMid.sigma,
        uniformsMid.wOff,
        phase
      ).toVar();
      const now = vec4(
        A.rgb.add(B.rgb.mul(A.a.oneMinus())),
        A.a.add(B.a.mul(A.a.oneMinus()))
      );
      result.assign(
        select(histOk.and(warm.equal(0.0)), mix(hist, now, 0.08), now)
      );
      front.assign(
        min(
          select(fLow.greaterThanEqual(0.0), fLow, FAR_CLOUD),
          select(fMid.greaterThanEqual(0.0), fMid, FAR_CLOUD)
        )
      );
    });
    return {col: result, front};
  };

  // ---------- depth-aware composite (full res, over the canvas) ----------
  const compositeNode = Fn(() => {
    const vUv = uv();
    const ndc = vec2(vUv.x.mul(2.0).sub(1.0), float(1.0).sub(vUv.y.mul(2.0)));
    const dF = min(sceneDist(vUv, ndc), 4000.0);
    const st = vUv.mul(resQ).sub(0.5);
    const i0 = st.floor();
    const f = st.fract();
    const acc = vec4(0).toVar();
    const wsum = float(0).toVar();
    const nearC = vec4(0).toVar();
    const nearD = float(1e9).toVar();
    const dMin = float(1e9).toVar();
    const dMax = float(0).toVar();
    for (const [ix, iy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1]
    ]) {
      const tc = clamp(
        i0.add(vec2(ix, iy)).add(0.5).div(resQ),
        vec2(0),
        vec2(1)
      );
      const wb = (ix === 0 ? f.x.oneMinus() : f.x).mul(
        iy === 0 ? f.y.oneMinus() : f.y
      );
      const tNdc = vec2(tc.x.mul(2.0).sub(1.0), float(1.0).sub(tc.y.mul(2.0)));
      const dT = min(sceneDist(tc, tNdc), 4000.0);
      const dd = dF.sub(dT).abs();
      const w = wb.mul(exp(dd.mul(-0.004))).add(1e-5);
      const c = cloudNode.sample(tc);
      acc.addAssign(c.mul(w));
      wsum.addAssign(w);
      If(dd.lessThan(nearD), () => {
        nearD.assign(dd);
        nearC.assign(c);
      });
      dMin.assign(min(dMin, dT));
      dMax.assign(max(dMax, dT));
    }
    // Depth-coherent neighbourhoods blend; silhouette-straddling ones
    // take the single nearest-depth tap (Jansen & Bavoil 2010).
    return select(dMax.sub(dMin).greaterThan(250.0), nearC, acc.div(wsum));
  });

  const quad = new QuadMesh();
  const useCompute = !!renderer.backend.isWebGPUBackend;
  let marchMat = null;
  if (!useCompute) {
    marchMat = new MeshBasicNodeMaterial();
    // buildMarch's If/Loop/toVar calls need an active TSL build stack
    // - fine inside the compute kernel's Fn, but a raster material
    // node graph is assembled NOW, so wrap it in an Fn returning a
    // struct (probed: struct + mrt + 2-attachment RT work on the
    // WebGL2 backend) and route the members to the two attachments.
    const MarchOut = struct({col: 'vec4', front: 'float'});
    const marchStruct = Fn(([vUv, pix]) => {
      const m = buildMarch(vUv, pix);
      return MarchOut(m.col, m.front);
    });
    const built = marchStruct(uv(), screenCoordinate.xy).toVar();
    marchMat.colorNode = built.get('col');
    // Attachment 1 carries the cloud front depth for the depth-aware
    // reprojection (names match rt.textures[i].name).
    marchMat.mrtNode = mrt({
      output: built.get('col'),
      cfront: vec4(built.get('front'), 0.0, 0.0, 1.0)
    });
    marchMat.toneMapped = false;
    // The march WRITES transmittance in alpha, and an OPAQUE node
    // material stomps output alpha to 1 (invisible over the black A/B
    // background, fatal over a real scene). transparent + NoBlending
    // writes source RGBA verbatim.
    marchMat.transparent = true;
    marchMat.blending = NoBlending;
  }
  const compMat = new MeshBasicNodeMaterial();
  compMat.colorNode = compositeNode();
  compMat.toneMapped = false;
  // Premultiplied-alpha over: the volumetric integral's radiance is
  // already transmittance-weighted.
  compMat.transparent = true;
  // Premultiplied-alpha over: the volumetric integral's radiance is
  // already transmittance-weighted. NOT material.premultipliedAlpha -
  // that flag makes the shader multiply rgb by alpha a second time.
  compMat.blending = CustomBlending;
  compMat.blendSrc = OneFactor;
  compMat.blendDst = OneMinusSrcAlphaFactor;
  compMat.depthTest = false;
  compMat.depthWrite = false;

  // Ping-pong pair: {tex, depthTex, fill()} - fill() marches into
  // both (radiance + cloud front depth), reading history from the
  // OTHER buffer via histNode/histDepthNode (swapped in render()).
  let bufA = null;
  let bufB = null;
  const prevVPStore = new Matrix4();

  function makeBuffer(qw, qh) {
    if (useCompute) {
      const tex = new StorageTexture(qw, qh);
      tex.type = HalfFloatType;
      tex.minFilter = tex.magFilter = LinearFilter;
      // Depth reads must not blend across the cloud/sky sentinel
      // edge: nearest.
      const depthTex = new StorageTexture(qw, qh);
      depthTex.type = HalfFloatType;
      depthTex.minFilter = depthTex.magFilter = NearestFilter;
      const kernel = Fn(() => {
        const i = int(instanceIndex);
        const x = i.mod(qw);
        const y = i.div(qw);
        const vUv = vec2(float(x).add(0.5).div(qw), float(y).add(0.5).div(qh));
        const pix = vec2(float(x).add(0.5), float(y).add(0.5));
        const m = buildMarch(vUv, pix);
        textureStore(tex, ivec2(x, y), m.col);
        textureStore(depthTex, ivec2(x, y), vec4(m.front, 0.0, 0.0, 1.0));
      })().compute(qw * qh);
      return {
        tex,
        depthTex,
        fill: () => renderer.compute(kernel),
        dispose: () => {
          tex.dispose();
          depthTex.dispose();
        }
      };
    }
    const rt = quarterTarget(qw, qh, 2);
    rt.textures[0].name = 'output';
    rt.textures[1].name = 'cfront';
    rt.textures[1].minFilter = rt.textures[1].magFilter = NearestFilter;
    return {
      tex: rt.textures[0],
      depthTex: rt.textures[1],
      fill: () => {
        quad.material = marchMat;
        renderer.setRenderTarget(rt);
        quad.render(renderer);
        renderer.setRenderTarget(null);
      },
      dispose: () => rt.dispose()
    };
  }

  function setSize(w, h) {
    const qw = Math.max(Math.ceil(w / 4), 8);
    const qh = Math.max(Math.ceil(h / 4), 8);
    if (bufA) {
      bufA.dispose();
      bufB.dispose();
    }
    bufA = makeBuffer(qw, qh);
    bufB = makeBuffer(qw, qh);
    resQ.value.set(qw, qh);
    warm.value = 1; // history is gone; march everything once
  }
  setSize(32, 32);

  function render(camera, depthTexture) {
    depthNode.value = depthTexture;
    camPos.value.setFromMatrixPosition(camera.matrixWorld);
    invVP.value.multiplyMatrices(
      camera.matrixWorld,
      camera.projectionMatrixInverse
    );
    prevVP.value.copy(prevVPStore);
    histNode.value = bufB.tex;
    histDepthNode.value = bufB.depthTex;
    bufA.fill();
    const t = bufA;
    bufA = bufB;
    bufB = t; // bufB now holds the newest reconstruction
    prevVPStore.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frameI.value = (frameI.value + 1) % 16;
    warm.value = 0;
  }

  function composite() {
    cloudNode.value = bufB.tex;
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    quad.material = compMat;
    quad.render(renderer);
    renderer.autoClear = auto;
  }

  // ---------- the cloud shadow map (phase 5) ----------
  // Vertical sigma-weighted optical depth of each deck into the
  // hook's 2D map, one channel per deck, refreshed with the frame
  // (the field advects with wOff). Integrates the FULL eroded
  // density - the same field the sky marches. (A coarse-only
  // integral was measured to leave tau >= 0.42 in the VISUAL GAPS:
  // the detail erosion's clamp-to-zero removes the coarse field's
  // low-amplitude residue, so gaps only clear when the shadow
  // integral erodes too.)
  let shadowHook = null;
  let shadowFill = null;
  function attachShadow(hook) {
    shadowHook = hook;
    const S = hook.size;
    const K = 8;
    const deckTau = (wxz, d) => {
      const dy = d.yTop.sub(d.yBase);
      const acc = float(0).toVar();
      Loop(K, ({i: s}) => {
        const hh = float(s)
          .add(0.5)
          .mul(1 / K);
        const p = vec3(wxz.x, d.yBase.add(hh.mul(dy)), wxz.y);
        acc.addAssign(density(p, hh, d.cov, d.cType, d.wOff));
      });
      return acc.mul(dy.div(K)).mul(d.sigma);
    };
    const tauAt = (pix) => {
      const wxz = vec2(pix)
        .add(0.5)
        .div(S)
        .sub(0.5)
        .mul(hook.uniforms.uWorldSize);
      return vec4(deckTau(wxz, uniformsLow), deckTau(wxz, uniformsMid), 0, 1);
    };
    if (useCompute) {
      const tex = new StorageTexture(S, S);
      tex.type = HalfFloatType;
      tex.minFilter = tex.magFilter = LinearFilter;
      const kernel = Fn(() => {
        const i = int(instanceIndex);
        const xy = ivec2(i.mod(S), i.div(S));
        textureStore(tex, xy, tauAt(xy));
      })().compute(S * S);
      hook.tauNode.value = tex;
      shadowFill = () => renderer.compute(kernel);
    } else {
      const rt = quarterTarget(S, S);
      const m = new MeshBasicNodeMaterial();
      // Builders with Loop/toVar need an active TSL build stack -
      // the compute kernel Fn provides one lazily, the raster
      // material graph is assembled NOW (the ocean hit the same
      // class of bug), so wrap in an Fn.
      m.colorNode = Fn(() => tauAt(ivec2(screenCoordinate.xy)))();
      m.transparent = true;
      m.blending = NoBlending;
      m.toneMapped = false;
      hook.tauNode.value = rt.texture;
      shadowFill = () => {
        quad.material = m;
        renderer.setRenderTarget(rt);
        quad.render(renderer);
        renderer.setRenderTarget(null);
      };
    }
  }

  // _warm is exposed for the validation harness only: forcing it to
  // 1 every frame makes every pixel march fresh - the temporal-free
  // ground truth the moving-camera reprojection test compares
  // against.
  return {
    uniformsLow,
    uniformsMid,
    shared,
    setSize,
    render,
    composite,
    attachShadow,
    updateShadow() {
      if (!shadowFill) return;
      shadowHook.uniforms.uMidLow.value =
        (uniformsLow.yBase.value + uniformsLow.yTop.value) / 2;
      shadowHook.uniforms.uMidMid.value =
        (uniformsMid.yBase.value + uniformsMid.yTop.value) / 2;
      shadowFill();
    },
    _warm: warm
  };
}
