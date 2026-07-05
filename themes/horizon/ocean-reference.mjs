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
import {buildInitialSpectrum} from './ocean-spectrum.js';

const N = 256;
const L = 450; // metres
const PARAMS = {U10: 12, F: 120e3, D: 60, windDir: 0};
const SEED = 1337;
const LAMBDA = 1.1; // choppiness
const T = 13.7;

const {h0, omega} = buildInitialSpectrum(N, L, PARAMS, SEED);

// Significant wave height from the gridded variance (m0 = sum of
// E[|h0|^2] = sum S dk^2; our h0 samples carry that expectation as
// realised Gaussian draws - report both).
{
  let m0 = 0;
  for (let i = 0; i < N * N; i++) {
    m0 += h0[i * 2] * h0[i * 2] + h0[i * 2 + 1] * h0[i * 2 + 1];
  }
  console.log('REF Hs(U=12) ~', (4 * Math.sqrt(m0)).toFixed(2), 'm');
}

// ---- time evolution to the 8 real fields (packed 4 complex) ----
const idx = (i, j) => j * N + i;
const conjIndex = (i) => (N - i) % N; // -k index on the shifted grid: k(i)=-k(N-i mod N)... see note

// NOTE on -k: k_i = dk (i - N/2). -k_i = dk (N/2 - i) = k_{N-i}.
// For i = 0 there is no mirror (k = -pi N / L, the Nyquist row own
// mirror is itself modulo the grid); (N - i) % N maps 0 -> 0, which
// pairs Nyquist with itself - the standard convention.

function evolve(t) {
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
      const w = omega[a] * t;
      const c = Math.cos(w);
      const s = Math.sin(w);
      // h = h0(k) e^{iwt} + conj(h0(-k)) e^{-iwt}
      const hr =
        h0[a * 2] * c - h0[a * 2 + 1] * s + (h0[b * 2] * c - h0[b * 2 + 1] * s);
      const hi =
        h0[a * 2] * s + h0[a * 2 + 1] * c - (h0[b * 2] * s + h0[b * 2 + 1] * c);
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
