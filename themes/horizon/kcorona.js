/**
 * kcorona.js - the solar corona's absolute photometry: the
 * K + F corona as printed closed forms, for the totality the
 * theme now times with the measured eclipse radius (beads.js).
 * Pure functions, mirrored by kcorona-reference.mjs.
 *
 * PRIMARY (open ADS scan, brightness sections read in full):
 * van de Hulst 1950, "The electron density of the solar corona"
 * (BAN 11, 135) - THE model corona. His equations (5)-(9), each
 * a sum of C_n r^-n terms in units of 1e-8 times the AVERAGE
 * surface brightness of the solar disc:
 *   K_max  = 355.6 r^-17 + 177.8 r^-7 + 0.708 r^-2.5
 *   K_min  = 200.0 r^-17 + 100.0 r^-7 + 0.398 r^-2.5
 *   F      =               14.86 r^-7 + 4.99  r^-2.5
 *   K_pole = 191.0 r^-17 + 12.59 r^-7
 * with the minimum-phase corona built of equatorial sectors
 * (0.7 of the circumference, K_min) and polar sectors (0.3,
 * K_pole), the maximum-phase corona circular with K_max =
 * c K_min, c = 1.78 (his adopted value; his Figure 1 shows the
 * total brightness rising by that factor with the Mitchell
 * phase, ~linearly between minimum and maximum - the phase
 * blend here interpolates the same way, stated). His Eq. (10)
 * turns any such sum into the TOTAL brightness of a ring in
 * units of the whole sun:
 *   B(r1, r2) = sum_n 2 C_n / (n - 2) (r1^{2-n} - r2^{2-n}).
 * Table 1's printed totals (K'_min + F = 0.828e-6 of the sun,
 * K_max + F = 1.472e-6) and his quoted Dyson & Woolley visual
 * record (0.47 to 0.72 FULL MOONS, i.e. 1.07e-6 to 1.66e-6 of
 * the sun) are gate-held - and cross-gated against the theme's
 * OWN moonlight frame.
 *
 * CROSS-CHECK (read in full): Saito, Poland & Munro 1977
 * (Solar Physics 55, 121) - the Skylab HAO coronagraph's
 * streamer-free background corona near minimum, Tables II/III:
 * B_{K+F} in units of the mean solar disc brightness at
 * r = 2.5..5 for equator and pole. Two instruments, 23 years
 * and a technology apart, land on the 1950 closed forms
 * (gate-held at every printed radius).
 *
 * Absolute frame: the mean solar disc brightness in cd/m^2 is
 * E0_LUX / (pi sin^2 theta_sun) - the theme's own illuminance
 * constant over the disc's solid angle - so every corona
 * number lands in the same photometric frame the dome, the
 * moon and the adaptation machinery already share.
 */

import {E0_LUX} from './adaptation.js';
import {AU_KM, R_SUN_KM} from './eclipses.js';

// van de Hulst's printed coefficient sets: [C, n] pairs, unit
// 1e-8 x mean solar surface brightness.
export const VDH_K_MAX = [
  [355.6, 17],
  [177.8, 7],
  [0.708, 2.5]
];
export const VDH_K_MIN = [
  [200.0, 17],
  [100.0, 7],
  [0.398, 2.5]
];
export const VDH_F = [
  [14.86, 7],
  [4.99, 2.5]
];
export const VDH_K_POLE = [
  [191.0, 17],
  [12.59, 7]
];
export const VDH_C_MAXMIN = 1.78; // K_max = c K_min, his adopted c
export const VDH_EQ_FRACTION = 0.7; // equatorial sectors, min phase
// Saito, Poland & Munro 1977 Tables II/III: measured B_{K+F} in
// units of the mean solar disc brightness (streamer-free
// background), [r, equatorial, polar].
export const SPM77_BKF = [
  [2.5, 8.9e-9, 5.5e-9],
  [3.0, 4.7e-9, 3.0e-9],
  [4.0, 1.9e-9, 1.4e-9],
  [5.0, 1.1e-9, 7.4e-10]
];

const evalSum = (coeffs, r) => {
  let s = 0;
  for (const [c, n] of coeffs) s += c * Math.pow(r, -n);
  return s;
};

/**
 * Surface brightness of the K-corona at r (solar radii from sun
 * centre), as a fraction of the mean solar disc brightness.
 * sector: 'eq' | 'pole'; phase: 0 (minimum) .. 1 (maximum) on
 * Mitchell's scale - the equator scales K_min -> c K_min, the
 * pole fills toward the circular maximum corona.
 */
export function kSurfB(r, sector = 'eq', phase = 0) {
  const p = Math.min(1, Math.max(0, phase));
  if (sector === 'pole') {
    const kp = evalSum(VDH_K_POLE, r);
    const km = evalSum(VDH_K_MAX, r);
    return (kp + p * (km - kp)) * 1e-8;
  }
  const kmin = evalSum(VDH_K_MIN, r);
  return kmin * (1 + p * (VDH_C_MAXMIN - 1)) * 1e-8;
}

/** F-corona surface brightness at r, fraction of mean disc B. */
export function fSurfB(r) {
  return evalSum(VDH_F, r) * 1e-8;
}

/** Total K+F surface brightness (fraction of mean disc B). */
export function coronaSurfB(r, sector = 'eq', phase = 0) {
  return kSurfB(r, sector, phase) + fSurfB(r);
}

/**
 * van de Hulst Eq. (10): total brightness of the ring r1..r2 of
 * a C_n r^-n sum, in units of the WHOLE sun's brightness
 * (coeffs in the 1e-8 unit -> result carries 1e-8).
 */
export function ringTotal(coeffs, r1, r2 = Infinity) {
  let s = 0;
  for (const [c, n] of coeffs) {
    const t2 = r2 === Infinity ? 0 : Math.pow(r2, 2 - n);
    s += ((2 * c) / (n - 2)) * (Math.pow(r1, 2 - n) - t2);
  }
  return s * 1e-8;
}

/**
 * Total corona illuminance (lux) at phase p: the weighted
 * K-corona (0.7 equatorial + 0.3 polar at minimum, filling to
 * the circular maximum) plus F, over r = 1..infinity, times the
 * sun's illuminance constant.
 */
export function coronaIlluminanceLux(phase = 0) {
  const p = Math.min(1, Math.max(0, phase));
  const kEq = ringTotal(VDH_K_MIN, 1) * (1 + p * (VDH_C_MAXMIN - 1));
  const kPoleMin = ringTotal(VDH_K_POLE, 1);
  const kMax = ringTotal(VDH_K_MAX, 1);
  const kPole = kPoleMin + p * (kMax - kPoleMin);
  const w = VDH_EQ_FRACTION;
  return (w * kEq + (1 - w) * kPole + ringTotal(VDH_F, 1)) * E0_LUX;
}

/** Mean solar disc luminance (cd/m^2) at 1 au, theme frame. */
export function sunMeanDiscCdM2() {
  const th = Math.asin(R_SUN_KM / AU_KM);
  return E0_LUX / (Math.PI * Math.sin(th) * Math.sin(th));
}

/** Corona surface luminance (cd/m^2) at r, sector, phase. */
export function coronaCdM2(r, sector = 'eq', phase = 0) {
  return coronaSurfB(r, sector, phase) * sunMeanDiscCdM2();
}
