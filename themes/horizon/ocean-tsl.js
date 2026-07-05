import {
  DataTexture,
  FloatType,
  HalfFloatType,
  LinearFilter,
  MeshBasicNodeMaterial,
  NearestFilter,
  NoBlending,
  QuadMesh,
  RGBAFormat,
  RenderTarget,
  RepeatWrapping,
  StorageTexture
} from 'three/webgpu';
import {
  Fn,
  cos,
  float,
  instanceIndex,
  int,
  ivec2,
  max,
  mrt,
  screenCoordinate,
  sin,
  sqrt,
  struct,
  texture,
  textureLoad,
  textureStore,
  uniform,
  uv,
  vec2,
  vec3,
  vec4
} from 'three/tsl';
import {buildInitialSpectrum} from './ocean-spectrum.js';

/**
 * Tessendorf (2001) FFT ocean on the GPU (WebGPU project, phase 5).
 * The spectrum physics is single-source in ocean-spectrum.js
 * (JONSWAP + TMA depth factor, Hasselmann directional spreading,
 * finite-depth dispersion) and validated against the
 * double-precision ocean-reference.mjs; this module is the runtime:
 *
 *  - h0(k)/omega initialised ONCE on the CPU (seeded - identical sea
 *    everywhere) into an rgba32float texture
 *  - per frame: Hermitian time evolution to 8 real fields packed as
 *    4 complex transforms in two rgba32float chains
 *    (h + iDx | Dz + iSx) and (Sz + iJxx | Jzz + iJxz)
 *  - 2D inverse FFT as 2 x log2(N) Cooley-Tukey butterfly passes per
 *    chain (both chains in one pass), driven by a precomputed LUT
 *    (bit-reversal folded into pass 0, bottom-half twiddle signs
 *    folded into the LUT) - the exact algorithm of the reference
 *  - unpack to two COMBINABLE maps (cascades sum linearly; normals
 *    and the Jacobian are built once from the totals in the water
 *    material): (lambda Dx, h, lambda Dz, lambda Jxz) and
 *    (Sx, Sz, lambda Jxx, lambda Jzz)
 *
 * All passes are per-texel builders with the project's dual drivers:
 * compute + storage textures on WebGPU, struct/MRT QuadMesh passes on
 * the WebGL2 backend. Texel reads go through loadTexel(): exact
 * textureLoad on WebGPU; nearest .sample() at texel centres on the
 * WebGL2 backend, whose QuadMesh-write/sample() V-flip convention is
 * only self-consistent through samplers (raw texelFetch there reads
 * every pass's output flipped and scrambles the vertical
 * butterflies - measured, not theorised).
 */

export function createOceanFFT(renderer, opts = {}) {
  const N = opts.N || 256;
  const LOG2N = Math.log2(N);
  const L = opts.L || 450;
  const params = {
    U10: opts.U10 ?? 12,
    F: opts.F ?? 120e3,
    D: opts.D ?? 60,
    windDir: opts.windDir ?? 0,
    kMin: opts.kMin,
    kMax: opts.kMax
  };
  const seed = opts.seed ?? 1337;
  const useCompute = !!renderer.backend.isWebGPUBackend;

  // Orientation, MEASURED on both backends (tsl-flip-probe3): CPU
  // DataTexture rows read straight under .sample() at texel centres,
  // QuadMesh MRT writes + .sample() are self-consistent on BOTH
  // attachments, and only the WebGL2 READBACK is row-flipped
  // (handled in readMap). No upload flips anywhere.

  const uTime = uniform(0);
  const uLambda = uniform(opts.lambda ?? 1.1);

  // ---------- CPU init: h0 + omega, butterfly LUT ----------
  const h0Data = new Float32Array(N * N * 4);
  let resolvedMss = 0;
  // Node-side copy for the material's variance bookkeeping (updates
  // itself on setWind).
  const mssUniform = uniform(0);
  function fillSpectrum() {
    const spec = buildInitialSpectrum(N, L, params, seed);
    for (let i = 0; i < N * N; i++) {
      h0Data[i * 4] = spec.h0[i * 2];
      h0Data[i * 4 + 1] = spec.h0[i * 2 + 1];
      h0Data[i * 4 + 2] = spec.omega[i];
    }
    resolvedMss = spec.mss;
    mssUniform.value = spec.mss;
  }
  fillSpectrum();
  const h0Tex = new DataTexture(h0Data, N, N, RGBAFormat, FloatType);
  h0Tex.minFilter = h0Tex.magFilter = NearestFilter;
  h0Tex.needsUpdate = true;

  const rev = (x) => {
    let r = 0;
    for (let b = 0; b < LOG2N; b++) r = (r << 1) | ((x >> b) & 1);
    return r;
  };
  const lutData = new Float32Array(N * LOG2N * 4);
  for (let p = 0; p < LOG2N; p++) {
    const m = 1 << (p + 1);
    for (let x = 0; x < N; x++) {
      const pos = x % m;
      const top = pos < m / 2;
      const k = top ? pos : pos - m / 2;
      const ang = (2 * Math.PI * k) / m; // +i: inverse transform
      let wr = Math.cos(ang);
      let wi = Math.sin(ang);
      let iA = top ? x : x - m / 2;
      let iB = top ? x + m / 2 : x;
      if (!top) {
        wr = -wr;
        wi = -wi;
      }
      if (p === 0) {
        iA = rev(iA);
        iB = rev(iB);
      }
      const o = (p * N + x) * 4;
      lutData[o] = wr;
      lutData[o + 1] = wi;
      lutData[o + 2] = iA;
      lutData[o + 3] = iB;
    }
  }
  const lutTex = new DataTexture(lutData, N, LOG2N, RGBAFormat, FloatType);
  lutTex.minFilter = lutTex.magFilter = NearestFilter;
  lutTex.needsUpdate = true;

  // ---------- dual-output pass plumbing ----------
  const quad = new QuadMesh();
  const PassOut = struct({a: 'vec4', b: 'vec4'});

  // Exact texel reads, per backend. On WebGPU textureLoad is the
  // plain integer fetch. On the WebGL2 backend QuadMesh writes are
  // V-flipped and only .sample() compensates (the project's pinned
  // convention) - textureLoad/texelFetch there would read every
  // chain pass flipped and scramble the vertical butterflies - so
  // that driver reads through a NEAREST sample at texel centres,
  // which is bit-exact for fetch purposes.
  const loadTexel = useCompute
    ? (tex, p) => textureLoad(tex, p)
    : (tex, p, w = N, h = N) =>
        // vec2(p), not p.toFloat(): toFloat() on an ivec2 collapses
        // to a scalar and every coordinate degenerates (measured:
        // constant columns).
        texture(tex).sample(vec2(p).add(0.5).div(vec2(w, h)));

  function makePair(type) {
    if (useCompute) {
      const mk = () => {
        const t = new StorageTexture(N, N);
        t.type = type;
        t.minFilter = t.magFilter =
          type === FloatType ? NearestFilter : LinearFilter;
        if (type !== FloatType) t.wrapS = t.wrapT = RepeatWrapping;
        return t;
      };
      return {a: mk(), b: mk()};
    }
    const rt = new RenderTarget(N, N, {
      count: 2,
      type,
      minFilter: type === FloatType ? NearestFilter : LinearFilter,
      magFilter: type === FloatType ? NearestFilter : LinearFilter,
      depthBuffer: false,
      stencilBuffer: false
    });
    rt.textures[0].name = 'a';
    rt.textures[1].name = 'b';
    if (type !== FloatType) {
      rt.textures[0].wrapS = rt.textures[0].wrapT = RepeatWrapping;
      rt.textures[1].wrapS = rt.textures[1].wrapT = RepeatWrapping;
    }
    return {a: rt.textures[0], b: rt.textures[1], rt};
  }

  // builder(pix: ivec2) -> {a, b} vec4 nodes; one fill() per driver.
  function makeFill(builder, pair) {
    if (useCompute) {
      const kernel = Fn(() => {
        const i = int(instanceIndex);
        const x = i.mod(N);
        const y = i.div(N);
        const r = builder(ivec2(x, y));
        textureStore(pair.a, ivec2(x, y), r.a);
        textureStore(pair.b, ivec2(x, y), r.b);
      })().compute(N * N);
      return () => renderer.compute(kernel);
    }
    const m = new MeshBasicNodeMaterial();
    const fn = Fn(([pix]) => {
      const r = builder(pix);
      return PassOut(r.a, r.b);
    });
    const o = fn(ivec2(screenCoordinate.xy)).toVar();
    m.colorNode = o.get('a');
    m.mrtNode = mrt({a: o.get('a'), b: o.get('b')});
    m.transparent = true;
    m.blending = NoBlending;
    m.toneMapped = false;
    return () => {
      quad.material = m;
      renderer.setRenderTarget(pair.rt);
      quad.render(renderer);
      renderer.setRenderTarget(null);
    };
  }

  // ---------- evolve: h0 -> packed spectra at time t ----------
  const evolveAt = (pix) => {
    const i = pix.x;
    const j = pix.y;
    const t0 = loadTexel(h0Tex, pix);
    const cj = loadTexel(
      h0Tex,
      ivec2(int(N).sub(i).mod(int(N)), int(N).sub(j).mod(int(N)))
    );
    const wt = t0.b.mul(uTime);
    const c = cos(wt);
    const s = sin(wt);
    // h = h0(k) e^{iwt} + conj(h0(-k)) e^{-iwt}, then the (-1)^(i+j)
    // input twist that moves DC from index N/2 to 0 (same as the
    // reference).
    const sgn = float(1).sub(i.add(j).bitAnd(int(1)).toFloat().mul(2.0));
    const hr = t0.r
      .mul(c)
      .sub(t0.g.mul(s))
      .add(cj.r.mul(c))
      .sub(cj.g.mul(s))
      .mul(sgn);
    const hi = t0.r
      .mul(s)
      .add(t0.g.mul(c))
      .sub(cj.r.mul(s))
      .sub(cj.g.mul(c))
      .mul(sgn);
    const dk = (2 * Math.PI) / L;
    const kx = i
      .toFloat()
      .sub(N / 2)
      .mul(dk);
    const kz = j
      .toFloat()
      .sub(N / 2)
      .mul(dk);
    const k = max(sqrt(kx.mul(kx).add(kz.mul(kz))), 1e-6);
    const qx = kx.div(k);
    const qz = kz.div(k);
    // T0 = h + i Dx with Dx = -i qx h; T1 = Dz + i Sx, Sx = i kx h.
    const DxR = qx.mul(hi);
    const DxI = qx.mul(hr).negate();
    const DzR = qz.mul(hi);
    const DzI = qz.mul(hr).negate();
    const SxR = kx.mul(hi).negate();
    const SxI = kx.mul(hr);
    const SzR = kz.mul(hi).negate();
    const SzI = kz.mul(hr);
    const jxx = kx.mul(kx).div(k);
    const jzz = kz.mul(kz).div(k);
    const jxz = kx.mul(kz).div(k);
    return {
      a: vec4(hr.sub(DxI), hi.add(DxR), DzR.sub(SxI), DzI.add(SxR)),
      b: vec4(
        SzR.sub(jxx.mul(hi)),
        SzI.add(jxx.mul(hr)),
        jzz.mul(hr).sub(jxz.mul(hi)),
        jzz.mul(hi).add(jxz.mul(hr))
      )
    };
  };

  // ---------- one butterfly pass over both chains ----------
  const cmulAdd = (a, wR, wI, b) =>
    vec2(
      a.x.add(wR.mul(b.x)).sub(wI.mul(b.y)),
      a.y.add(wR.mul(b.y)).add(wI.mul(b.x))
    );
  const fftAt = (pix, pass, horizontal, srcA, srcB) => {
    const along = horizontal ? pix.x : pix.y;
    // LUT texel: (twiddle.re, twiddle.im, indexA, indexB)
    const lut = loadTexel(lutTex, ivec2(along, int(pass)), N, LOG2N);
    const iA = int(lut.z);
    const iB = int(lut.w);
    const pA = horizontal ? ivec2(iA, pix.y) : ivec2(pix.x, iA);
    const pB = horizontal ? ivec2(iB, pix.y) : ivec2(pix.x, iB);
    const a0 = loadTexel(srcA, pA);
    const b0 = loadTexel(srcA, pB);
    const a1 = loadTexel(srcB, pA);
    const b1 = loadTexel(srcB, pB);
    const outA = vec4(
      cmulAdd(a0.xy, lut.x, lut.y, b0.xy),
      cmulAdd(a0.zw, lut.x, lut.y, b0.zw)
    );
    const outB = vec4(
      cmulAdd(a1.xy, lut.x, lut.y, b1.xy),
      cmulAdd(a1.zw, lut.x, lut.y, b1.zw)
    );
    return {a: outA, b: outB};
  };

  // ---------- unpack: final chains -> display maps ----------
  // The maps carry COMBINABLE quantities: displacements, slopes and
  // choppiness-scaled Jacobian derivatives sum linearly across
  // cascades, so the material adds cascade samples first and builds
  // the exact displaced-surface normal and folding Jacobian ONCE
  // from the totals (normals and J of the sum are not the sum of
  // normals / J).
  const unpackAt = (pix, srcA, srcB) => {
    const a4 = loadTexel(srcA, pix);
    const b4 = loadTexel(srcB, pix);
    const h = a4.x;
    const Dx = a4.y;
    const Dz = a4.z;
    const Sx = a4.w;
    const Sz = b4.x;
    const Jxx = b4.y;
    const Jzz = b4.z;
    const Jxz = b4.w;
    return {
      a: vec4(uLambda.mul(Dx), h, uLambda.mul(Dz), uLambda.mul(Jxz)),
      b: vec4(Sx, Sz, uLambda.mul(Jxx), uLambda.mul(Jzz))
    };
  };

  // ---------- wire the passes ----------
  const spectra = makePair(FloatType); // evolve output
  const pong = makePair(FloatType); // FFT ping-pong partner
  const maps = makePair(HalfFloatType); // displacement + derivatives

  const fills = [];
  fills.push(makeFill(evolveAt, spectra));
  // 2 x LOG2N butterfly passes, ping-ponging spectra <-> pong; track
  // which pair holds the data so unpack reads the right one.
  let src = spectra;
  let dst = pong;
  for (let axis = 0; axis < 2; axis++) {
    for (let p = 0; p < LOG2N; p++) {
      const s = src;
      const d = dst;
      fills.push(makeFill((pix) => fftAt(pix, p, axis === 0, s.a, s.b), d));
      const t = src;
      src = dst;
      dst = t;
    }
  }
  const finalPair = src;
  fills.push(makeFill((pix) => unpackAt(pix, finalPair.a, finalPair.b), maps));

  return {
    // world-space metres per texture repeat
    patchSize: L,
    displacementTex: maps.a,
    derivTex: maps.b,
    lambda: uLambda,
    // Exact resolved mean-square slope of this (banded) grid; the
    // material's Cox-Munk lobe uses total-minus-resolved (Bruneton
    // et al. 2010) so sub-grid slopes are neither lost nor doubled.
    get resolvedMss() {
      return resolvedMss;
    },
    mssUniform,
    mapSize: N,
    // Winds change: rebuild the spectrum IN PLACE (same textures and
    // kernels - only the h0/omega data re-uploads), the same pattern
    // as the aerosol-gated atmosphere LUTs.
    setWind(U10, windDir) {
      params.U10 = U10;
      params.windDir = windDir;
      fillSpectrum();
      h0Tex.needsUpdate = true;
    },
    update(tSeconds) {
      uTime.value = tSeconds;
      for (const fill of fills) fill();
    },
    // Harness-only numeric readback (blit through a float RT, same
    // pattern as the atmosphere's readLut). The blit fragment output
    // clamps NEGATIVE rgb at 0 (measured: positives pass unclamped),
    // so the blit stores v * 0.25 + 8 and this undoes it - exact,
    // since both are fp32 affine. Caveat: on the WebGL2 backend the
    // request row is compensated, but multi-row regions come back
    // with their rows in bottom-origin order.
    async readMap(which, x, y, w, h) {
      const tex = which === 'disp' ? maps.a : maps.b;
      const rt = new RenderTarget(N, N, {
        type: FloatType,
        depthBuffer: false
      });
      const m = new MeshBasicNodeMaterial();
      m.colorNode = loadTexel(tex, ivec2(screenCoordinate.xy))
        .mul(0.25)
        .add(8.0);
      m.transparent = true;
      m.blending = NoBlending;
      m.toneMapped = false;
      quad.material = m;
      renderer.setRenderTarget(rt);
      quad.render(renderer);
      renderer.setRenderTarget(null);
      // WebGL-backend readbacks are bottom-origin (harness truth).
      const ry = useCompute ? y : N - y - h;
      const px = await renderer.readRenderTargetPixelsAsync(rt, x, ry, w, h);
      rt.dispose();
      for (let i2 = 0; i2 < px.length; i2++) px[i2] = (px[i2] - 8) * 4;
      return px;
    }
  };
}
