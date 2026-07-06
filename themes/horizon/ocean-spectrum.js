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
 *  - MEASURED sea-state mode (live marine data): the spectrum is a
 *    sum over observed partitions (wind sea + swell), each a
 *    JONSWAP shape at its measured peak period with the
 *    DNV-RP-C205 sect. 3.5.5 peak enhancement
 *    gamma(Hs, Tp) and the Phillips constant fixed by EXACT numeric
 *    integration so each partition's variance is m0 = Hs^2/16 - the
 *    measured height is ground truth (Goda's closed-form alpha
 *    approximation is not used). The wind-sea partition keeps the
 *    Hasselmann 1980 spreading (it is wind-coupled); swell - no
 *    longer coupled to the local wind - gets the Mitsuyasu et al.
 *    (1975) / Goda & Suzuki (1975) cos^{2s}(theta/2) with
 *    s_max = 75, their value for swell far from its source. This is
 *    the two-peaked composition of Torsethaugen/Ochi-Hubble, but
 *    with the partitions MEASURED instead of modelled.
 *
 * h0(k) = (xi_r + i xi_i)/2 * sqrt(S(kx,kz) dk^2) - so that
 * E[|h0|^2] = S dk^2 / 2 and the realised surface variance equals
 * m0 exactly (see buildInitialSpectrum) - with Gaussian xi from a
 * seeded Box-Muller/LCG so every session and both engines generate
 * the identical sea.
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

// JONSWAP spectral shape with a unit Phillips constant - the piece
// every mode shares. S(w) = alpha * jonswapShape(w, wp, gamma).
export function jonswapShape(w, wp, gamma) {
  if (w <= 0) return 0;
  const sigma = w <= wp ? 0.07 : 0.09;
  const r = Math.exp(-((w - wp) * (w - wp)) / (2 * sigma * sigma * wp * wp));
  return (
    ((G * G) / Math.pow(w, 5)) *
    Math.exp(-1.25 * Math.pow(wp / w, 4)) *
    Math.pow(gamma, r)
  );
}

// Kitaigorodskii/TMA depth attenuation phi(wh), wh = w sqrt(D/g).
export function tmaPhi(w, D) {
  const wh = w * Math.sqrt(D / G);
  if (wh <= 1) return 0.5 * wh * wh;
  if (wh < 2) return 1 - 0.5 * (2 - wh) * (2 - wh);
  return 1;
}

// JONSWAP with TMA finite-depth factor. U10 wind speed (m/s),
// F fetch (m), D depth (m).
export function tmaSpectrum(w, U10, F, D) {
  if (w <= 0) return 0;
  // Fetch relations (Hasselmann et al. 1973).
  const xTilde = (G * F) / (U10 * U10);
  const alpha = 0.076 * Math.pow(xTilde, -0.22);
  const wp = (22 * G) / (U10 * Math.pow(xTilde, 0.33));
  return alpha * jonswapShape(w, wp, 3.3) * tmaPhi(w, D);
}

// DNV-RP-C205 sect. 3.5.5: peak enhancement for a measured
// (Hs, Tp) pair - gamma = 5 for Tp/sqrt(Hs) <= 3.6, 1 beyond 5,
// exp(5.75 - 1.15 Tp/sqrt(Hs)) between.
export function dnvGamma(Hs, Tp) {
  const q = Tp / Math.sqrt(Hs);
  if (q <= 3.6) return 5;
  if (q >= 5) return 1;
  return Math.exp(5.75 - 1.15 * q);
}

export function peakOmega(U10, F) {
  const xTilde = (G * F) / (U10 * U10);
  return (22 * G) / (U10 * Math.pow(xTilde, 0.33));
}

// Lanczos log-gamma, double precision.
const lg = (x) => {
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

// Normalised cos^{2s}(theta/2) spreading:
// N(s) = Gamma(s+1)^2 * 2^{2s-1} / (pi Gamma(2s+1)), via lgamma so
// it stays finite at the swell's large s.
export function cos2sSpread(s, theta) {
  s = Math.min(Math.max(s, 0), 200); // log-space overflow guard
  const logN =
    2 * lg(s + 1) + (2 * s - 1) * Math.LN2 - Math.log(Math.PI) - lg(2 * s + 1);
  const cosHalf = Math.cos(theta / 2);
  if (cosHalf <= 0) return 0;
  return Math.exp(logN + 2 * s * Math.log(cosHalf));
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
  return cos2sSpread(s, theta);
}

// Mitsuyasu et al. (1975) / Goda & Suzuki (1975) spreading for waves
// with no local-wind coupling: s rises as (w/wp)^5 below the peak,
// decays as (w/wp)^-2.5 above; SWELL_SMAX = 75 is Goda's value for
// swell that has propagated far from its source (by definition of
// swell - the marine model reports it as a separate partition
// precisely because it left its generation area).
export const SWELL_SMAX = 75;
export function mitsuyasuSpread(w, wp, sMax, theta) {
  const ratio = Math.max(w / wp, 0.05);
  const s = sMax * (ratio <= 1 ? Math.pow(ratio, 5) : Math.pow(ratio, -2.5));
  return cos2sSpread(s, theta);
}

/**
 * Calibrate measured sea-state partitions for spectrumK. Each input
 * is {hs, tp, dir, U10?}: significant height (m), PEAK period (s),
 * the direction the waves travel TOWARD (radians, world-XZ math
 * convention), and - for the wind-sea partition only - the wind
 * speed the Hasselmann spreading needs (omit for swell, which gets
 * the Mitsuyasu-Goda form at SWELL_SMAX). The Phillips constant of
 * each partition comes from EXACT numeric integration of its shape
 * so the partition variance is m0 = hs^2/16: the measured height
 * stays ground truth. NO TMA factor here - TMA transforms a
 * deep-water PREDICTION into depth-limited form, but the marine
 * model's Hs/Tp already contain the site's real depth physics;
 * re-applying phi provably shifts the measured peak (a 14 s swell
 * moved to 12.9 s at D = 60 m). Finite-depth dispersion still maps
 * omega to the local wavenumbers - that is geometry, not energy.
 */
export function calibrateSeaState(parts) {
  return parts
    .filter((p) => p && p.hs > 0.01 && p.tp > 0.5)
    .map((p) => {
      const wp = (2 * Math.PI) / p.tp;
      const gamma = dnvGamma(p.hs, p.tp);
      // The w^-5 tail converges fast; 40 wp at 40k panels holds the
      // quadrature error orders below the marine model's precision.
      const NW = 40000;
      const dw = (40 * wp) / NW;
      let m0 = 0;
      for (let i = 0; i < NW; i++) {
        const w = (i + 0.5) * dw;
        m0 += jonswapShape(w, wp, gamma) * dw;
      }
      return {
        alpha: (p.hs * p.hs) / 16 / m0,
        wp,
        gamma,
        dir: p.dir,
        U10: p.U10
      };
    });
}

// Directional wavenumber spectrum S(kx,kz) (change of variables:
// S(k,theta) k dk dtheta = S(w,theta) dw dtheta). Two modes, one
// formulation: params.partitions (calibrateSeaState output) sums the
// measured partitions; otherwise the fetch-limited wind sea from
// {U10, F, windDir} - the physics when no marine data exists.
export function spectrumK(kx, kz, params) {
  const {U10, F, D, windDir} = params;
  const k = Math.hypot(kx, kz);
  if (k < 1e-6) return 0;
  const {w, dwdk} = dispersion(k, D);
  const thK = Math.atan2(kz, kx);
  if (params.partitions) {
    let sum = 0;
    for (const p of params.partitions) {
      const S = p.alpha * jonswapShape(w, p.wp, p.gamma);
      if (S <= 0) continue;
      const th = thK - p.dir;
      const thW = Math.atan2(Math.sin(th), Math.cos(th));
      sum += p.U10
        ? S * hasselmannSpread(w, p.wp, p.U10, thW)
        : S * mitsuyasuSpread(w, p.wp, SWELL_SMAX, thW);
    }
    return (sum * dwdk) / k;
  }
  const S = tmaSpectrum(w, U10, F, D);
  if (S <= 0) return 0;
  const wp = peakOmega(U10, F);
  const theta = thK - windDir;
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
      // E[|h0|^2] = S dk^2 / 2, so the Hermitian mode
      // h(k) = h0(k) + conj(h0(-k)) carries E[|h(k)|^2] =
      // (S(k) + S(-k))/2 dk^2 and the realised surface variance
      // sums to exactly m0 (Horvath 2015's normalisation of
      // Tessendorf's eq. 42, whose literal reading realises FOUR
      // times the spectral variance - measured here, 5.68 m
      // realised Hs against 2.62 m of theory before the fix).
      const amp = 0.5 * Math.sqrt(Sk) * dk;
      h0[idx * 2] = gr * amp;
      h0[idx * 2 + 1] = gi * amp;
    }
  }
  return {h0, omega, mss};
}
