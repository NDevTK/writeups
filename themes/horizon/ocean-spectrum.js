/**
 * Ocean wave spectrum - the single source shared by the
 * double-precision CPU reference (ocean-reference.mjs) and the GPU
 * runtime (ocean-tsl.js). Papers, implemented in full:
 *
 *  - JONSWAP spectrum (Hasselmann et al. 1973): fetch-limited wind
 *    sea, S(w) = a g^2 / w^5 exp(-5/4 (wp/w)^4) gamma^r with the
 *    fetch relations for alpha and wp.
 *  - TMA transformation (Bouws, Gunther, Rosenthal & Vincent 1985):
 *    finite-depth factor phi(w, D) via the Kitaigorodskii scaling
 *    wh = w sqrt(D/g), applied to JONSWAP.
 *  - Hasselmann directional spreading (Hasselmann, Dunckel & Ewing
 *    1980): D(w, theta) = N(s) cos^{2s}(theta/2) with the measured
 *    power laws s below/above the peak.
 *  - Finite-depth dispersion w^2 = g k tanh(k D) and its group-
 *    velocity Jacobian dw/dk for the S(w,theta) -> S(kx,kz) change
 *    of variables (Tessendorf 2001 sect. 4.3 generalised to finite
 *    depth).
 *
 * h0(k) = (xi_r + i xi_i)/sqrt(2) * sqrt(2 S(kx,kz) dk^2), Gaussian
 * xi from a seeded Box-Muller/LCG so every session and both engines
 * generate the identical sea.
 */

const G = 9.81;

// Finite-depth dispersion and its derivative.
export function dispersion(k, depth) {
  const kd = Math.min(k * depth, 50); // tanh saturates; avoid overflow
  const t = Math.tanh(kd);
  const w = Math.sqrt(G * k * t);
  const sech2 = 1 / (Math.cosh(Math.min(kd, 20)) * Math.cosh(Math.min(kd, 20)));
  const dwdk = w > 0 ? (G * (t + kd * sech2)) / (2 * w) : 0;
  return {w, dwdk};
}

// JONSWAP with TMA finite-depth factor. U10 wind speed (m/s),
// F fetch (m), D depth (m).
export function tmaSpectrum(w, U10, F, D) {
  if (w <= 0) return 0;
  // Fetch relations (Hasselmann et al. 1973).
  const xTilde = (G * F) / (U10 * U10);
  const alpha = 0.076 * Math.pow(xTilde, -0.22);
  const wp = (22 * G) / (U10 * Math.pow(xTilde, 0.33));
  const gamma = 3.3;
  const sigma = w <= wp ? 0.07 : 0.09;
  const r = Math.exp(-((w - wp) * (w - wp)) / (2 * sigma * sigma * wp * wp));
  const jonswap =
    ((alpha * G * G) / Math.pow(w, 5)) *
    Math.exp(-1.25 * Math.pow(wp / w, 4)) *
    Math.pow(gamma, r);
  // Kitaigorodskii/TMA depth attenuation phi(wh), wh = w sqrt(D/g).
  const wh = w * Math.sqrt(D / G);
  let phi;
  if (wh <= 1) phi = 0.5 * wh * wh;
  else if (wh < 2) phi = 1 - 0.5 * (2 - wh) * (2 - wh);
  else phi = 1;
  return jonswap * phi;
}

export function peakOmega(U10, F) {
  const xTilde = (G * F) / (U10 * U10);
  return (22 * G) / (U10 * Math.pow(xTilde, 0.33));
}

// Hasselmann, Dunckel & Ewing (1980) directional spreading:
// D(w,theta) = N(s) cos^{2s}(theta/2), theta relative to the wind.
export function hasselmannSpread(w, wp, U10, theta) {
  const ratio = w / wp;
  let s;
  if (ratio < 0.95) {
    s = 6.97 * Math.pow(Math.max(ratio, 0.05), 4.06);
  } else {
    const mu = -2.33 - 1.45 * ((U10 * wp) / G - 1.17);
    s = 9.77 * Math.pow(ratio, mu);
  }
  s = Math.min(Math.max(s, 0), 60); // cosh/gamma overflow guard
  // Normalisation N(s) = Gamma(s+1)^2 * 2^{2s-1} / (pi Gamma(2s+1))
  // via lgamma so it stays finite at large s.
  const lg = (x) => {
    // Lanczos log-gamma, double precision.
    const c = [
      76.18009172947146, -86.50532032941677, 24.01409824083091,
      -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
    ];
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log((2.5066282746310005 * ser) / x);
  };
  const logN =
    2 * lg(s + 1) + (2 * s - 1) * Math.LN2 - Math.log(Math.PI) - lg(2 * s + 1);
  const cosHalf = Math.cos(theta / 2);
  if (cosHalf <= 0) return 0;
  return Math.exp(logN + 2 * s * Math.log(cosHalf));
}

// Directional wavenumber spectrum S(kx,kz) (change of variables:
// S(k,theta) k dk dtheta = S(w,theta) dw dtheta).
export function spectrumK(kx, kz, params) {
  const {U10, F, D, windDir} = params;
  const k = Math.hypot(kx, kz);
  if (k < 1e-6) return 0;
  const {w, dwdk} = dispersion(k, D);
  const S = tmaSpectrum(w, U10, F, D);
  if (S <= 0) return 0;
  const wp = peakOmega(U10, F);
  const theta = Math.atan2(kz, kx) - windDir;
  const Dth = hasselmannSpread(
    w,
    wp,
    U10,
    Math.atan2(Math.sin(theta), Math.cos(theta))
  );
  return (S * Dth * dwdk) / k;
}

// Deterministic Gaussian pairs: LCG + Box-Muller.
export function makeGaussian(seed) {
  let s = seed >>> 0;
  const rand = () =>
    (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  return () => {
    let u1 = rand();
    if (u1 < 1e-12) u1 = 1e-12;
    const u2 = rand();
    const r = Math.sqrt(-2 * Math.log(u1));
    return [r * Math.cos(2 * Math.PI * u2), r * Math.sin(2 * Math.PI * u2)];
  };
}

/**
 * The initial spectrum grid: N x N complex h0(k) plus omega(k).
 * Grid convention: index i in [0,N) maps to wavenumber component
 * k_i = 2 pi (i - N/2) / L (signed, DC at i = N/2), matching the
 * shifted layout both the reference FFT and the GPU FFT use.
 *
 * params.kMin / params.kMax (optional, rad/m) band-limit the grid -
 * cascades partition k-space with them exactly (h0 = 0 outside
 * [kMin, kMax)), so summed cascades never double-count energy.
 *
 * Returns {h0, omega, mss}: mss is the RESOLVED mean-square slope
 * E[|grad h|^2] = sum k^2 S(k) dk^2 over the banded grid - the exact
 * variance the FFT waves realise. The BRDF's Cox-Munk glitter lobe
 * uses the residual (total wind mss minus resolved) so sub-grid
 * slopes are neither lost nor counted twice (the split of Bruneton,
 * Neyret & Holzschuch 2010).
 */
export function buildInitialSpectrum(N, L, params, seed = 1337) {
  const h0 = new Float64Array(N * N * 2);
  const omega = new Float64Array(N * N);
  const gauss = makeGaussian(seed);
  const dk = (2 * Math.PI) / L;
  const kMin = params.kMin ?? 0;
  const kMax = params.kMax ?? Infinity;
  let mss = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const kx = dk * (i - N / 2);
      const kz = dk * (j - N / 2);
      const k = Math.hypot(kx, kz);
      const idx = j * N + i;
      omega[idx] = dispersion(Math.max(k, 1e-6), params.D).w;
      // Always draw the Gaussian pair so texel <-> random-stream
      // alignment is index-pure (skipping DC would shift everything
      // after it and make h0 depend on grid traversal details).
      const [gr, gi] = gauss();
      const inBand = k >= kMin && k < kMax;
      const Sk = inBand ? spectrumK(kx, kz, params) : 0;
      mss += k * k * Sk * dk * dk;
      const amp = Math.sqrt(2 * Sk * dk * dk) / Math.SQRT2;
      h0[idx * 2] = gr * amp;
      h0[idx * 2 + 1] = gi * amp;
    }
  }
  return {h0, omega, mss};
}
