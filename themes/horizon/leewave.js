/**
 * leewave.js - mountain (lee) waves and their lenticular clouds
 * from the MEASURED balloon column over the REAL upwind ridge.
 * Pure functions, mirrored by leewave-reference.mjs.
 *
 * The primary is OPEN and printed: Stull, Practical Meteorology:
 * An Algebra-based Survey of Atmospheric Science, v1.02b
 * (CC-BY-NC-SA, https://www.eoas.ubc.ca/books/Practical_Meteorology/),
 * ch. 17 'Regional Winds' 17.7 Mountain Waves and ch. 5
 * 'Atmospheric Stability' 5.6.3 Brunt-Vaisala Frequency:
 *
 *  - N_BV = [ (|g|/Tv) (dTv/dz + Gamma_d) ]^1/2  (eq. 5.4a),
 *    |g| = 9.8 m s^-2 and Gamma_d = 9.8 K km^-1 both printed in
 *    the equation's own text. His worked sample: ISA at 4 km
 *    (T = 262 K, lapse -6.5 K/km) gives 0.0111 rad/s and period
 *    565.5 s - held as a landmark.
 *  - natural wavelength lambda = 2 pi M / N_BV  (eq. 17.30).
 *    His worked sample: M = 30 m/s over -0.005 K/m air at 283 K
 *    gives N = 0.0129 s^-1 and lambda = 14.62 km - landmark.
 *  - the damped standing wave downwind of the crest
 *    z = z1 exp(-x/(b lambda)) cos(2 pi x/lambda)  (eq. 17.31),
 *    so crest n (at x = n lambda) has amplitude z1 e^(-n/b).
 *  - Froude number 3: Fr3 = lambda/(2 W)  (eq. 17.32). Fr3 ~ 1
 *    is resonance ('very intense waves ... greatest chance of
 *    forming lenticular clouds'), amplitude z1 ~ H/2 (his own
 *    approximation); Fr3 << 1 is blocked flow and Fr3 >> 1 a
 *    turbulent wake, both with z1 < H/2 and NO printed value -
 *    so the theme draws clouds only in the resonant regime and
 *    reports the others by name.
 *  - lenticulars cap the crests whose amplitude exceeds the
 *    lifting condensation level, z_LCL = a (T - Td) with
 *    a = 125 m degC^-1 (the ch. 17 sample application, quoting
 *    the Moisture chapter). His sample (z1 = 500 m, b = 3,
 *    zLCL = 250 m) prints '1 cap cloud and 2 lenticular clouds'
 *    - the crest ladder 500 / 358.6 / 257.2 / 184.4 m cuts
 *    EXACTLY there, held as a landmark.
 *
 * NOTE on |g|: Stull's eq. 5.4a and both worked samples print
 * 9.8 m s^-2; the repo's G_M_S2 = 9.81 is the FSM snow chain's
 * own print. Each module keeps its primary's constant.
 */

import {EPS, eLiq} from './contrails.js';

export const G_STULL = 9.8; // m/s^2 (eq. 5.4a's own print)
export const GAMMA_D_KM = 0.0098; // K/m (eq. 5.4a: 9.8 K/km)
export const LCL_A_M_PER_C = 125; // m/degC (ch. 17 sample print)
export const B_DAMP = 3; // the sample's damping factor b
// Display gate for 'Fr3 ~ 1': one octave about resonance. Stull
// prints only the qualitative ladder (<<1, ~1, >>1); the octave
// is the documented display reading of 'nearly equal'.
export const FR3_RES_LO = 0.5;
export const FR3_RES_HI = 2.0;

// Exact virtual temperature (K) from T (degC), RH (0-1), p (Pa):
// w = eps e/(p - e), Tv = T (1 + w/eps)/(1 + w) - the same exact
// factor the bulk-Richardson BLH carries (no 0.61 approximation;
// eps is the gated Appleman constant, e the gated eLiq).
export function virtualTk(tC, rh, pPa) {
  const tK = tC + 273.15;
  const e = Math.max(0, Math.min(1, rh)) * eLiq(tK);
  if (!(pPa > e)) return tK;
  const w = (EPS * e) / (pPa - e);
  return (tK * (1 + w / EPS)) / (1 + w);
}

// Dew point (degC) from T (degC) and RH (0-1): invert the SAME
// eLiq the contrail chain gates - bisection on
// eLiq(Td) = rh eLiq(T), exact to that curve. RH at or below
// zero has no dew point (returns null - dry air writes no
// lenticulars, the caller states it).
export function dewC(tC, rh) {
  if (!(rh > 0)) return null;
  if (rh >= 1) return tC;
  const target = rh * eLiq(tC + 273.15);
  let lo = tC - 80;
  let hi = tC;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (eLiq(mid + 273.15) > target) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

// Brunt-Vaisala frequency (rad/s), eq. 5.4a: a POINT virtual
// temperature (K, the layer's base - the form both worked
// samples use) and the layer's Tv lapse (K/m, negative =
// cooling upward). Returns null for a statically unstable
// layer (no oscillation, no wave).
export function nBV(tvK, lapseKperM) {
  const s2 = (G_STULL / tvK) * (lapseKperM + GAMMA_D_KM);
  return s2 > 0 ? Math.sqrt(s2) : null;
}

// Natural wavelength (m), eq. 17.30.
export function naturalWavelengthM(mMs, nBv) {
  return (2 * Math.PI * mMs) / nBv;
}

// The damped standing wave (m), eq. 17.31: displacement at
// downwind distance x from the crest, initial amplitude z1.
export function dampedZ(z1M, lamM, xM, b = B_DAMP) {
  return z1M * Math.exp(-xM / (b * lamM)) * Math.cos((2 * Math.PI * xM) / lamM);
}

// Froude number 3 (dimensionless), eq. 17.32.
export function froude3(lamM, wM) {
  return lamM / (2 * wM);
}

// The printed regime ladder for Fr3.
export function fr3Regime(fr3) {
  if (fr3 < FR3_RES_LO) return 'blocked';
  if (fr3 > FR3_RES_HI) return 'wake';
  return 'resonant';
}

// Lifting condensation level (m above the streamline), the
// ch. 17 sample's own form.
export function zLclM(tC, tdC) {
  return LCL_A_M_PER_C * (tC - tdC);
}

/**
 * The upwind ridge from an elevation transect. dM ascending
 * upwind distances (m) from the anchor, eM elevations (m AMSL)
 * at those distances. A candidate is a local maximum; its hill
 * height H is the drop to the lowest ground between it and the
 * anchor (the lee valley the flow descends into); the NEAREST
 * candidate with H >= minHM wins (its waves reach the anchor
 * least damped - eq. 17.31's e-folding). W is the full width at
 * half of H (crossings interpolated; clamped at the transect
 * ends). Returns {dM, elevM, hM, wM} or null (no ridge in
 * reach - flat fetch writes no waves).
 */
export function ridgeFromTransect(dM, eM, minHM = 200) {
  const n = Math.min(dM.length, eM.length);
  for (let i = 1; i < n - 1; i++) {
    if (!(eM[i] >= eM[i - 1] && eM[i] >= eM[i + 1])) continue;
    let base = Infinity;
    for (let j = 0; j <= i; j++) base = Math.min(base, eM[j]);
    const h = eM[i] - base;
    if (h < minHM) continue;
    const half = eM[i] - h / 2;
    let dNear = dM[0];
    for (let j = i; j > 0; j--) {
      if (eM[j - 1] <= half) {
        const f = (eM[j] - half) / (eM[j] - eM[j - 1]);
        dNear = dM[j] + f * (dM[j - 1] - dM[j]);
        break;
      }
      if (j === 1) dNear = dM[0];
    }
    let dFar = dM[n - 1];
    for (let j = i; j < n - 1; j++) {
      if (eM[j + 1] <= half) {
        const f = (eM[j] - half) / (eM[j] - eM[j + 1]);
        dFar = dM[j] + f * (dM[j + 1] - dM[j]);
        break;
      }
      if (j === n - 2) dFar = dM[n - 1];
    }
    return {dM: dM[i], elevM: eM[i], hM: h, wM: Math.abs(dFar - dNear)};
  }
  return null;
}

/**
 * The lenticular ladder: crest n sits at x = n lambda downwind
 * of the ridge with amplitude z_n = z1 e^(-n/b) (eq. 17.31 at
 * its cosine crests); a cloud caps every crest with z_n > zLCL.
 * Its chord comes from the printed cosine itself: within one
 * crest (amplitude ~ constant, stated) z(x) crosses zLCL at
 * half-chord (lambda/2 pi) acos(zLCL/z_n); its thickness is
 * z_n - zLCL. n = 0 is the cap cloud over the crest. Returns
 * [{n, xM, topRelM, baseRelM, chordM}] - heights relative to
 * the crest-grazing streamline (the ridge-top altitude).
 */
export function crestClouds({z1M, lamM, zLclRelM, b = B_DAMP, nMax = 8}) {
  const out = [];
  if (!(z1M > 0) || !(lamM > 0) || !(zLclRelM >= 0)) return out;
  for (let n = 0; n <= nMax; n++) {
    const zn = z1M * Math.exp(-n / b);
    if (zn <= zLclRelM) break;
    const halfChord = (lamM / (2 * Math.PI)) * Math.acos(zLclRelM / zn);
    out.push({
      n,
      xM: n * lamM,
      topRelM: zn,
      baseRelM: zLclRelM,
      chordM: 2 * halfChord
    });
  }
  return out;
}
