// Double-precision JS reference of the Tessendorf (2001) FFT ocean
// (node ocean-reference.mjs). Ground truth for the GPU port, sharing
// the spectrum single-source (ocean-spectrum.js). Conventions the
// GPU must match exactly:
//  - grid index i -> k_i = 2 pi (i - N/2) / L (DC at N/2)
//  - h(k,t) = h0(k) e^{+iwt} + conj(h0(-k)) e^{-iwt}  (Hermitian)
//  - inverse transform f(x) = sum_k h(k) e^{+i k.x}, NO 1/N^2
//  - choppy displacement  Dx = -i kx/k h,  Dz = -i kz/k h
//  - spectral slopes      Sx =  i kx h,    Sz =  i kz h
//  - Jacobian derivatives Jxx = (kx^2/k) h, Jzz = (kz^2/k) h,
//    Jxz = (kx kz / k) h;  J = (1+l Jxx)(1+l Jzz) - (l Jxz)^2
import {
  buildInitialSpectrum,
  calibrateSeaState,
  cos2sSpread,
  jonswapShape,
  spectrumK,
  tmaSpectrum
} from './ocean-spectrum.js';

const N = 256;
const L = 450; // metres
const PARAMS = {U10: 12, F: 120e3, D: 60, windDir: 0};
const SEED = 1337;
const LAMBDA = 1.1; // choppiness
const T = 13.7;

const {h0, omega} = buildInitialSpectrum(N, L, PARAMS, SEED);

// Realised significant wave height: the surface variance is the sum
// over k of |h0(k) + conj(h0(-k))|^2 (Parseval on the Hermitian
// modes the FFT actually renders). It must match the omega-space
// integral of the spectrum - the normalisation is E[|h0|^2] =
// S dk^2 / 2 precisely so these agree (grid truncation and the
// Gaussian draws put a few percent between them).
function realisedHs(h0g, n) {
  const cj = (i) => (n - i) % n;
  let v = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * n + i;
      const b = cj(j) * n + cj(i);
      const hr = h0g[a * 2] + h0g[b * 2];
      const hi = h0g[a * 2 + 1] - h0g[b * 2 + 1];
      v += hr * hr + hi * hi;
    }
  }
  return 4 * Math.sqrt(v);
}
{
  let m0t = 0;
  const dw = 1e-4;
  for (let i = 1; i < 400000; i++) {
    m0t += tmaSpectrum(i * dw, PARAMS.U10, PARAMS.F, PARAMS.D) * dw;
  }
  console.log(
    `REF Hs(U=12): theory ${(4 * Math.sqrt(m0t)).toFixed(2)} m,` +
      ` realised ${realisedHs(h0, N).toFixed(2)} m`
  );
}

// ---- time evolution to the 8 real fields (packed 4 complex) ----
const idx = (i, j) => j * N + i;
const conjIndex = (i) => (N - i) % N; // -k index on the shifted grid: k(i)=-k(N-i mod N)... see note

// NOTE on -k: k_i = dk (i - N/2). -k_i = dk (N/2 - i) = k_{N-i}.
// For i = 0 there is no mirror (k = -pi N / L, the Nyquist row own
// mirror is itself modulo the grid); (N - i) % N maps 0 -> 0, which
// pairs Nyquist with itself - the standard convention.

function evolve(t, h0In = h0, omegaIn = omega) {
  // fields as complex grids
  const mk = () => new Float64Array(N * N * 2);
  const H = mk();
  const Dx = mk();
  const Dz = mk();
  const Sx = mk();
  const Sz = mk();
  const Jxx = mk();
  const Jzz = mk();
  const Jxz = mk();
  const dk = (2 * Math.PI) / L;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const kx = dk * (i - N / 2);
      const kz = dk * (j - N / 2);
      const k = Math.max(Math.hypot(kx, kz), 1e-6);
      const a = idx(i, j);
      const b = idx(conjIndex(i), conjIndex(j));
      const w = omegaIn[a] * t;
      const c = Math.cos(w);
      const s = Math.sin(w);
      // h = h0(k) e^{iwt} + conj(h0(-k)) e^{-iwt}
      const hr =
        h0In[a * 2] * c -
        h0In[a * 2 + 1] * s +
        (h0In[b * 2] * c - h0In[b * 2 + 1] * s);
      const hi =
        h0In[a * 2] * s +
        h0In[a * 2 + 1] * c -
        (h0In[b * 2] * s + h0In[b * 2 + 1] * c);
      H[a * 2] = hr;
      H[a * 2 + 1] = hi;
      // multiply by -i kx/k: (r+ii)(-i q) = (i q) r ... -i*q*(hr+ i hi) = q hi - i q hr
      const qx = kx / k;
      const qz = kz / k;
      Dx[a * 2] = qx * hi;
      Dx[a * 2 + 1] = -qx * hr;
      Dz[a * 2] = qz * hi;
      Dz[a * 2 + 1] = -qz * hr;
      // i kx h = i kx (hr + i hi) = -kx hi + i kx hr
      Sx[a * 2] = -kx * hi;
      Sx[a * 2 + 1] = kx * hr;
      Sz[a * 2] = -kz * hi;
      Sz[a * 2 + 1] = kz * hr;
      Jxx[a * 2] = ((kx * kx) / k) * hr;
      Jxx[a * 2 + 1] = ((kx * kx) / k) * hi;
      Jzz[a * 2] = ((kz * kz) / k) * hr;
      Jzz[a * 2 + 1] = ((kz * kz) / k) * hi;
      Jxz[a * 2] = ((kx * kz) / k) * hr;
      Jxz[a * 2 + 1] = ((kx * kz) / k) * hi;
    }
  }
  return {H, Dx, Dz, Sx, Sz, Jxx, Jzz, Jxz};
}

// ---- iterative radix-2 complex FFT (inverse: e^{+i}) ----
function ifftRow(re, im, off, stride) {
  // bit reversal
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const a = off + i * stride;
      const b = off + j * stride;
      let t = re[a];
      re[a] = re[b];
      re[b] = t;
      t = im[a];
      im[a] = im[b];
      im[b] = t;
    }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (2 * Math.PI) / len; // +i: inverse
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let cwr = 1;
      let cwi = 0;
      for (let j2 = 0; j2 < len / 2; j2++) {
        const a = off + (i + j2) * stride;
        const b = off + (i + j2 + len / 2) * stride;
        const tr = re[b] * cwr - im[b] * cwi;
        const ti = re[b] * cwi + im[b] * cwr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nwr = cwr * wr - cwi * wi;
        cwi = cwr * wi + cwi * wr;
        cwr = nwr;
      }
    }
  }
}

// Our grid has DC at index N/2 (k = dk (i - N/2)); the textbook FFT
// wants DC at 0. Shifting the input by N/2 in both axes equals
// multiplying the OUTPUT by (-1)^(x+z); we apply the equivalent
// input twist (-1)^(i+j) instead, which the GPU does too.
function ifft2(field) {
  const re = new Float64Array(N * N);
  const im = new Float64Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const sgn = (i + j) & 1 ? -1 : 1;
      re[idx(i, j)] = field[idx(i, j) * 2] * sgn;
      im[idx(i, j)] = field[idx(i, j) * 2 + 1] * sgn;
    }
  }
  for (let j = 0; j < N; j++) ifftRow(re, im, j * N, 1); // rows
  for (let i = 0; i < N; i++) ifftRow(re, im, i, N); // columns
  return {re, im};
}

const F = evolve(T);
const h = ifft2(F.H);
const dx = ifft2(F.Dx);
const dz = ifft2(F.Dz);
const sx = ifft2(F.Sx);
const sz = ifft2(F.Sz);
const jxx = ifft2(F.Jxx);
const jzz = ifft2(F.Jzz);
const jxz = ifft2(F.Jxz);

// Hermitian sanity: outputs must be real.
{
  let maxIm = 0;
  let maxRe = 0;
  for (let i = 0; i < N * N; i++) {
    maxIm = Math.max(maxIm, Math.abs(h.im[i]));
    maxRe = Math.max(maxRe, Math.abs(h.re[i]));
  }
  console.log(
    'REF hermitian: max|Im(h)| =',
    maxIm.toExponential(2),
    ' max|h| =',
    maxRe.toFixed(3),
    'm'
  );
}

// Foam-threshold calibration: the shader's mask is
// smoothstep(Jt, Jt - FOAM_W, J) - foam grows as the Jacobian folds
// below Jt. Calibrate Jt against THAT mask (not an idealised hard
// threshold): bisect so the grid-mean masked coverage equals
// Monahan & O'Muircheartaigh (1980) W = 3.84e-6 U^3.41 at this
// wind - after that, coverage at every other wind follows from the
// physics alone.
const FOAM_W = 0.175;
{
  const U = PARAMS.U10;
  const W = 3.84e-6 * Math.pow(U, 3.41);
  const Js = new Float64Array(N * N);
  for (let a = 0; a < N * N; a++) {
    Js[a] =
      (1 + LAMBDA * jxx.re[a]) * (1 + LAMBDA * jzz.re[a]) -
      LAMBDA * LAMBDA * jxz.re[a] * jxz.re[a];
  }
  const smooth = (e0, e1, x) => {
    const u = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
    return u * u * (3 - 2 * u);
  };
  const coverage = (t) => {
    let m = 0;
    for (let a = 0; a < N * N; a++) m += smooth(t, t - FOAM_W, Js[a]);
    return m / (N * N);
  };
  let lo = 0;
  let hi = 2;
  for (let it = 0; it < 60; it++) {
    const mid = 0.5 * (lo + hi);
    if (coverage(mid) < W) lo = mid;
    else hi = mid;
  }
  const Jt = 0.5 * (lo + hi);
  const sorted = Float64Array.from(Js).sort();
  console.log(
    `REF foam calibration: Monahan W(${U}) = ${(W * 100).toFixed(2)}%` +
      ` -> Jt = ${Jt.toFixed(4)} at mask width ${FOAM_W}` +
      ` (J range ${sorted[0].toFixed(3)}..${sorted[N * N - 1].toFixed(3)})`
  );
}

// ---- measured sea-state mode (live marine-API partitions) ----
// A North-Sea-like state: wind sea Hs 1.5 m Tp 6 s toward +x under
// U10 = 10 m/s, plus swell Hs 2.0 m Tp 14 s toward 60 deg. Checks:
//  - cos^{2s} spreading integrates to 1 (the lgamma normalisation)
//  - dense k-plane quadrature of spectrumK recovers each Hs exactly
//    (total variance = sum of partition variances)
//  - each partition's 1D spectrum peaks at its measured Tp
//  - the production cascade pair realises the total Hs
{
  const D = 60;
  const SEA = [
    {hs: 1.5, tp: 6, dir: 0, U10: 10},
    {hs: 2.0, tp: 14, dir: Math.PI / 3}
  ];
  const parts = calibrateSeaState(SEA);
  console.log(
    'REF sea gamma: wind',
    parts[0].gamma.toFixed(3),
    'swell',
    parts[1].gamma.toFixed(3)
  );
  for (const s of [5, 25, 75]) {
    let I = 0;
    const M = 20000;
    for (let i = 0; i < M; i++) {
      const th = -Math.PI + ((i + 0.5) / M) * 2 * Math.PI;
      I += (cos2sSpread(s, th) * 2 * Math.PI) / M;
    }
    console.log(`REF spread integral s=${s}: ${I.toFixed(6)}`);
  }
  // Dense quadrature over the k-plane, one partition at a time (each
  // is independent; variances add).
  for (const [name, one] of [
    ['wind ', [parts[0]]],
    ['swell', [parts[1]]]
  ]) {
    const P = {D, partitions: one};
    const K = 4; // rad/m; wavelengths below 1.6 m carry ~0 variance here
    const M = 3000;
    const dkq = (2 * K) / M;
    let m0 = 0;
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < M; i++) {
        m0 +=
          spectrumK(dkq * (i - M / 2 + 0.5), dkq * (j - M / 2 + 0.5), P) *
          dkq *
          dkq;
      }
    }
    console.log(
      `REF sea m0 ${name}: 4 sqrt(m0) = ${(4 * Math.sqrt(m0)).toFixed(3)} m`
    );
  }
  // Peak placement: the 1D omega spectrum of each partition must peak
  // at its measured Tp.
  for (const [name, p, tp] of [
    ['wind ', parts[0], 6],
    ['swell', parts[1], 14]
  ]) {
    let best = 0;
    let bestW = 0;
    for (let i = 1; i < 8000; i++) {
      const w = i * 0.001;
      const S = p.alpha * jonswapShape(w, p.wp, p.gamma);
      if (S > best) {
        best = S;
        bestW = w;
      }
    }
    console.log(
      `REF sea peak ${name}: Tp ${((2 * Math.PI) / bestW).toFixed(2)} s (measured ${tp})`
    );
  }
  // The production cascades (L = 1000 / 120 partitioned at 25 m)
  // under this sea: realised Hs from the drawn h0 grids (variances
  // add across the band-split cascades). Target: the total measured
  // Hs = sqrt(1.5^2 + 2^2) = 2.5 m.
  const SPLIT = (2 * Math.PI) / 25;
  let vc = 0;
  for (const [Lc, seedC, band] of [
    [1000, 1337, {kMax: SPLIT}],
    [120, 7331, {kMin: SPLIT}]
  ]) {
    const spec = buildInitialSpectrum(
      256,
      Lc,
      {D, partitions: parts, ...band},
      seedC
    );
    const hsC = realisedHs(spec.h0, 256);
    vc += (hsC * hsC) / 16;
  }
  console.log(
    `REF sea cascades: realised Hs = ${(4 * Math.sqrt(vc)).toFixed(3)} m (measured total 2.500)`
  );
  // Swell slope sanity: long waves carry little mss - print the two
  // partitions' resolved slope variance for the bookkeeping notes.
  for (const [name, one] of [
    ['wind ', [parts[0]]],
    ['swell', [parts[1]]]
  ]) {
    const spec = buildInitialSpectrum(256, 1000, {D, partitions: one}, 1337);
    console.log(`REF sea mss ${name} (L=1000): ${spec.mss.toExponential(3)}`);
  }
}

const pts = [
  [0, 0],
  [37, 81],
  [128, 200],
  [255, 13]
];
for (const [i, j] of pts) {
  const a = idx(i, j);
  const lx = LAMBDA * jxx.re[a];
  const lz = LAMBDA * jzz.re[a];
  const lc = LAMBDA * jxz.re[a];
  const J = (1 + lx) * (1 + lz) - lc * lc;
  // Exact displaced-surface normal (same tangents as the GPU unpack).
  const tx = [1 + lx, sx.re[a], lc];
  const tz = [lc, sz.re[a], 1 + lz];
  const n = [
    tz[1] * tx[2] - tz[2] * tx[1],
    tz[2] * tx[0] - tz[0] * tx[2],
    tz[0] * tx[1] - tz[1] * tx[0]
  ];
  const nl = Math.hypot(...n);
  console.log(
    `REF t=${T} (${i},${j}): h=${h.re[a].toFixed(5)} Dx=${dx.re[a].toFixed(5)}` +
      ` Dz=${dz.re[a].toFixed(5)} Sx=${sx.re[a].toFixed(5)} Sz=${sz.re[a].toFixed(5)}` +
      ` nx=${(n[0] / nl).toFixed(5)} nz=${(n[2] / nl).toFixed(5)} J=${J.toFixed(5)}`
  );
}

// Per-texel ground truth for the SEA-STATE mode (tsl-ocean-num.html
// ?sea=1 runs the same single L=450 full-band grid): the reference
// partitions above, seed 1337, t = 13.7.
{
  const specS = buildInitialSpectrum(
    N,
    L,
    {
      D: 60,
      partitions: calibrateSeaState([
        {hs: 1.5, tp: 6, dir: 0, U10: 10},
        {hs: 2.0, tp: 14, dir: Math.PI / 3}
      ])
    },
    SEED
  );
  const FS = evolve(T, specS.h0, specS.omega);
  const hS = ifft2(FS.H);
  const dxS = ifft2(FS.Dx);
  const dzS = ifft2(FS.Dz);
  for (const [i, j] of pts) {
    const a = idx(i, j);
    console.log(
      `REF sea t=${T} (${i},${j}): h=${hS.re[a].toFixed(5)}` +
        ` Dx=${dxS.re[a].toFixed(5)} Dz=${dzS.re[a].toFixed(5)}`
    );
  }
}

{
  // The calm limit: with no wind there is no wind sea - the
  // spectrum vanishes IDENTICALLY (physics, not a clamp). U10 = 0
  // used to ride into peakOmega's 1/U10 as Infinity and fill h0
  // with 0 x Inf = NaN; the GPU rendered the NaN vertex as a
  // 400 m cone in a dead-calm Nelson harbour (found by LOOKING).
  // Every h0 texel and the resolved mss must be exactly zero and
  // finite.
  const calm = buildInitialSpectrum(
    64,
    250,
    {U10: 0, F: 50000, D: 12, windDir: 0},
    7
  );
  let bad = 0;
  let nonzero = 0;
  for (let i = 0; i < calm.h0.length; i++) {
    if (!Number.isFinite(calm.h0[i])) bad++;
    else if (calm.h0[i] !== 0) nonzero++;
  }
  if (bad || nonzero || calm.mss !== 0)
    throw new Error(
      `calm limit broken: ${bad} non-finite, ${nonzero} nonzero, mss ${calm.mss}`
    );
  console.log(
    'REF calm limit: U10 = 0 -> every h0 texel exactly 0 and finite, mss = 0 - a dead-calm sea is FLAT, never NaN'
  );
}
