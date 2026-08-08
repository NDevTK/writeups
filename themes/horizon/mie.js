/**
 * mie.js - exact Mie scattering for the glory: the rings of the
 * Brocken spectre, drawn inside the fogbow from the SAME
 * measured fog. Gated by mie-reference.mjs.
 *
 * THE SOURCE - van de Hulst 1957 (Light Scattering by Small
 * Particles), the corona machinery's own printed source, whose
 * Ch. 9 formalism this implements exactly:
 *   an = psi_n'(mx) psi_n(x)-ish Riccati-Bessel form via the
 *   logarithmic derivative D_n(mx) (downward recurrence - the
 *   numerically stable route), psi/chi upward, and the angular
 *   functions pi_n / tau_n by their recurrences. Water in the
 *   visible is non-absorbing to the precision drawn (k < 1e-7),
 *   so m is REAL and the amplitudes reduce to
 *     a_n = A_n / (A_n - i B_n),
 *   fully computable in real arithmetic.
 * The series truncates at the classic N = x + 4 x^(1/3) + 2
 * (Wiscombe's widely printed criterion).
 *
 * THE GATE holds the code to anchors that are either PRINTED in
 * the repo's own sources or EXACT identities:
 *  - the Rayleigh asymptote (van de Hulst: Qsca -> (8/3) x^4
 *    |(m^2-1)/(m^2+2)|^2 as x -> 0)
 *  - the extinction paradox (van de Hulst: Qext -> 2 as x ->
 *    infinity - the same printed limit the corona/fogbow ride)
 *  - the OPTICAL THEOREM as an internal exactness check:
 *    Qext = (4/x^2) Re S(0) must equal the series sum to
 *    machine precision
 *  - energy: for real m, Qsca = Qext identically
 *  - the forward lobe agrees with the SHIPPED certified Airy
 *    diffraction (cloud-corona.js airyPattern) in their common
 *    large-x regime - the new exact code and the old certified
 *    approximation meet where they must
 *  - THE GLORY EMERGES: at the fogbow's own printed droplet
 *    (Mazoyer 2019, 14 um) the exact backscatter pattern makes
 *    rings a few degrees from the antisolar point, red outside
 *    blue, with the inverse-size similarity - nothing about the
 *    glory is put in by hand; it is what the series does there.
 *
 * THE DRAWN GLORY rides the fogbow's whole measured chain: the
 * same METAR FG occurrence, the same Koschmieder visibility
 * extinction, the same thin-fog slab - one fog, two displays
 * (Airy bow at 35-40 deg, Mie rings at 0-8 deg), both around
 * the antisolar point, exactly as on the mountain.
 */

import {waterIndex} from './rainbow.js';
import {FOG_D_DRAWN_UM} from './fogbow.js';

// RGB channel wavelengths (um) - the theme's triplet.
export const GLORY_CH_UM = [0.68, 0.55, 0.44];

// Classic series length (Wiscombe's criterion, widely printed).
export function mieN(x) {
  return Math.ceil(x + 4 * Math.cbrt(x) + 2);
}

// Core series for REAL refractive index m at size parameter x:
// returns {anR, anI, bnR, bnI, N} arrays (1-indexed at [n-1]).
export function mieCoeffs(x, m) {
  const N = mieN(x);
  // Logarithmic derivative D_n(mx) by downward recurrence.
  const mx = m * x;
  const ND = Math.max(N + 15, Math.ceil(1.2 * mx) + 15);
  const D = new Float64Array(ND + 1);
  for (let n = ND; n >= 1; n--) {
    const k = n / mx;
    D[n - 1] = k - 1 / (D[n] + k);
  }
  // Riccati-Bessel psi, chi upward.
  const anR = new Float64Array(N);
  const anI = new Float64Array(N);
  const bnR = new Float64Array(N);
  const bnI = new Float64Array(N);
  let psi0 = Math.sin(x);
  let psi1 = Math.sin(x) / x - Math.cos(x);
  let chi0 = Math.cos(x);
  let chi1 = Math.cos(x) / x + Math.sin(x);
  for (let n = 1; n <= N; n++) {
    const psi = n === 1 ? psi1 : ((2 * n - 1) / x) * psi1 - psi0;
    const chi = n === 1 ? chi1 : ((2 * n - 1) / x) * chi1 - chi0;
    if (n > 1) {
      psi0 = psi1;
      psi1 = psi;
      chi0 = chi1;
      chi1 = chi;
    }
    const dn = D[n];
    const ka = dn / m + n / x;
    const kb = dn * m + n / x;
    const Na = ka * psi - psi0; // psi_{n-1}
    const Ka = ka * chi - chi0;
    const Nb = kb * psi - psi0;
    const Kb = kb * chi - chi0;
    // a_n = Na/(Na - i Ka) = Na(Na + i Ka)/(Na^2 + Ka^2)
    const da = Na * Na + Ka * Ka;
    const db = Nb * Nb + Kb * Kb;
    anR[n - 1] = (Na * Na) / da;
    anI[n - 1] = (Na * Ka) / da;
    bnR[n - 1] = (Nb * Nb) / db;
    bnI[n - 1] = (Nb * Kb) / db;
  }
  return {anR, anI, bnR, bnI, N};
}

// Efficiencies from the series sums.
export function mieQ(x, m) {
  const {anR, anI, bnR, bnI, N} = mieCoeffs(x, m);
  let ext = 0;
  let sca = 0;
  for (let n = 1; n <= N; n++) {
    const w = 2 * n + 1;
    ext += w * (anR[n - 1] + bnR[n - 1]);
    sca +=
      w *
      (anR[n - 1] * anR[n - 1] +
        anI[n - 1] * anI[n - 1] +
        bnR[n - 1] * bnR[n - 1] +
        bnI[n - 1] * bnI[n - 1]);
  }
  return {qext: (2 / (x * x)) * ext, qsca: (2 / (x * x)) * sca};
}

// Scattering amplitudes S1, S2 at cos(theta) via pi/tau
// recurrences. Returns [S1R, S1I, S2R, S2I].
export function mieS12(coeffs, x, mu) {
  const {anR, anI, bnR, bnI, N} = coeffs;
  let s1R = 0;
  let s1I = 0;
  let s2R = 0;
  let s2I = 0;
  let pi0 = 0;
  let pi1 = 1;
  for (let n = 1; n <= N; n++) {
    const tau = n * mu * pi1 - (n + 1) * pi0;
    const f = (2 * n + 1) / (n * (n + 1));
    s1R += f * (anR[n - 1] * pi1 + bnR[n - 1] * tau);
    s1I += f * (anI[n - 1] * pi1 + bnI[n - 1] * tau);
    s2R += f * (anR[n - 1] * tau + bnR[n - 1] * pi1);
    s2I += f * (anI[n - 1] * tau + bnI[n - 1] * pi1);
    const pi2 = ((2 * n + 1) / n) * mu * pi1 - ((n + 1) / n) * pi0;
    pi0 = pi1;
    pi1 = pi2;
  }
  return [s1R, s1I, s2R, s2I];
}

// Qext by the optical theorem - the gate's internal exactness
// anchor: (4/x^2) Re S(0).
export function mieQextOptical(x, m) {
  const c = mieCoeffs(x, m);
  const s = mieS12(c, x, 1);
  return (4 / (x * x)) * s[0];
}

// Unpolarised normalised phase function p(theta) (sr^-1,
// integral over 4pi = 1): (|S1|^2 + |S2|^2) / (2 pi x^2 Qsca)
// - van de Hulst's normalisation.
export function miePhase(coeffs, x, qsca, mu) {
  const s = mieS12(coeffs, x, mu);
  const i1 = s[0] * s[0] + s[1] * s[1];
  const i2 = s[2] * s[2] + s[3] * s[3];
  return (i1 + i2) / 2 / (Math.PI * x * x * qsca);
}

// The glory: the phase function over 0..thetaMax degrees FROM
// THE ANTISOLAR POINT (scattering angle 180 - g), per RGB
// channel at the droplet diameter dUm, with the water index at
// each channel (rainbow.js Sellmeier - one dispersion for bow
// and glory).
export const GLORY_TEX_W = 160;
export const GLORY_MAX_DEG = 8;
export function buildGloryLUT(dUm = FOG_D_DRAWN_UM) {
  const data = new Float32Array(GLORY_TEX_W * 4);
  for (let c = 0; c < 3; c++) {
    const lam = GLORY_CH_UM[c];
    const m = waterIndex(lam);
    const x = (Math.PI * dUm) / lam;
    const coeffs = mieCoeffs(x, m);
    const {qsca} = mieQ(x, m);
    for (let i = 0; i < GLORY_TEX_W; i++) {
      const g = (((i + 0.5) / GLORY_TEX_W) * GLORY_MAX_DEG * Math.PI) / 180;
      const mu = Math.cos(Math.PI - g);
      data[i * 4 + c] = miePhase(coeffs, x, qsca, mu);
    }
  }
  for (let i = 0; i < GLORY_TEX_W; i++) data[i * 4 + 3] = 1;
  return {data, w: GLORY_TEX_W, maxDeg: GLORY_MAX_DEG};
}

// The glory's first ring (deg from antisolar) for a channel: walk
// outward from the axis, find the core-ring dark gap (the running
// minimum), then the ring is the maximum of the climb beyond it -
// a real climb (1.35x the gap floor, the prominence guard against
// sub-percent interference wiggles). The physical definition of
// "the first bright ring", nothing tuned to a wavelength.
export function gloryRingDeg(dUm, lamUm, gMaxDeg = 8) {
  const m = waterIndex(lamUm);
  const x = (Math.PI * dUm) / lamUm;
  const coeffs = mieCoeffs(x, m);
  const {qsca} = mieQ(x, m);
  const n = 800;
  const val = (gDeg) =>
    miePhase(coeffs, x, qsca, Math.cos(Math.PI - (gDeg * Math.PI) / 180));
  let runMin = val(0);
  let climbing = false;
  let peakV = -1;
  let peakG = null;
  for (let i = 1; i <= n; i++) {
    const g = (gMaxDeg * i) / n;
    const v = val(g);
    if (!climbing) {
      if (v < runMin) runMin = v;
      else if (v > runMin * 1.35) climbing = true;
    }
    if (climbing) {
      if (v > peakV) {
        peakV = v;
        peakG = g;
      } else if (v < peakV * 0.9) {
        return peakG; // past the ring crest
      }
    }
  }
  return peakG;
}
