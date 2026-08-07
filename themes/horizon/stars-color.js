/**
 * stars-color.js - catalogue star tints from physics: Planck's law
 * at the star's effective temperature through this repo's own CIE
 * 1931 2-deg colorimetry (ocean-color.js - the same table and
 * XYZ -> sRGB matrix the ocean, vegetation and sky display paths
 * ride), replacing the theme's hand-shaped kelvin ramp. No new
 * empirical constant enters: Planck's law carries the SI-exact
 * h, c, k_B (2019 SI redefinition), the CMFs and the matrix are
 * already shipped, and the one convention is stated - tints are
 * normalized to max channel 1 (the sprite system carries
 * brightness in its magnitude term, so the tint is a
 * chromaticity carrier; the rod-fold ratio below is
 * scale-invariant by construction).
 *
 * The sources:
 *  - Ballesteros 2012 (EPL 97, 34008, "New insights into black
 *    bodies"): the printed blackbody colour-temperature relation
 *      T = 4600 (1/(0.92(B-V) + 1.7) + 1/(0.92(B-V) + 0.62)) K,
 *    inverted here by monotone bisection to give a temperature
 *    its B-V abscissa. His own constants land the solar
 *    effective temperature at the Sun's B-V = 0.65: 5778 K (the
 *    gate holds it to 1 K).
 *  - Schaefer 1990 (PASP 102, 212, "Telescopic Limiting
 *    Magnitudes" - read in full), the companion to the 1993
 *    review behind the shipped colour floor: his Eq. 13 prints
 *    the night-vision colour correction
 *      -2.5 log(F_c) = 1 - (B-V)/2   if log(B) < 3.17,
 *    below the SAME 1500 nL boundary (his B is in
 *    millimicroLamberts = nL), and Eq. 14
 *    (I* = I Fb Fe Ft Fp Fa Fsc Fr Fc) with the p. 214 prose
 *    ("the redder of the two stars would appear fainter" under
 *    night vision) fixes the sign that the 1993 review left
 *    ambiguous: in the rod frame a star's V-band brightness
 *    shifts by -(1 - (B-V)/2) mag - a printed slope of +0.5 mag
 *    per unit B-V, redder fainter. The theme's shipped rod fold
 *    (Larson Eq. 13 scotopic luminance on the sprite tint,
 *    sky-objects-tsl.js) produces this shift from the spectra
 *    themselves: over these Planck tints its slope is 0.42 mag
 *    per B-V across B-V 0..1.5 - two independent printed routes
 *    (a Macbeth-patch photometric fit vs astronomical
 *    physiology) within 17% on one slope, so Schaefer's F_c is
 *    deliberately NOT applied on top of the fold: the fold
 *    already carries it (the gate holds slope and sign).
 *
 * Documented scope: the catalogue temperature is treated as a
 * blackbody (no line blanketing - Ballesteros' fit is exactly
 * the demonstration that real-star B-V tracks the blackbody
 * form); and the shipped CMF table spans 360-700 nm, so the
 * deepest-red tail beyond 700 nm is truncated (the CMFs
 * themselves are near zero there - sub-percent of X for the
 * coolest catalogue entry).
 */

import {CIE_1931_2DEG, XYZ_TO_LINEAR_SRGB} from './ocean-color.js';
import {scotopicY} from './adaptation.js';

// SI-exact physical constants (2019 SI redefinition).
export const PLANCK_H = 6.62607015e-34; // J s
export const LIGHT_C = 2.99792458e8; // m / s
export const BOLTZMANN_K = 1.380649e-23; // J / K

// Planck spectral radiance at wavelength nm and temperature K.
// Absolute scale cancels in every use below - only the relative
// spectrum matters.
export function planckSpectralRadiance(nm, kelvin) {
  const lam = nm * 1e-9;
  const x = (PLANCK_H * LIGHT_C) / (lam * BOLTZMANN_K * kelvin);
  return (2 * PLANCK_H * LIGHT_C * LIGHT_C) / Math.pow(lam, 5) / Math.expm1(x);
}

// Blackbody XYZ on the shipped CMF grid (uniform 5 nm rows -
// the constant step drops out of the chromaticity).
export function planckXYZ(kelvin) {
  let X = 0;
  let Y = 0;
  let Z = 0;
  for (const [nm, xb, yb, zb] of CIE_1931_2DEG) {
    const B = planckSpectralRadiance(nm, kelvin);
    X += B * xb;
    Y += B * yb;
    Z += B * zb;
  }
  return [X, Y, Z];
}

// The star tint: blackbody XYZ through the shipped display
// matrix, negatives clipped at the gamut edge, max channel
// normalized to 1.
export function starTintRGB(kelvin) {
  const [X, Y, Z] = planckXYZ(kelvin);
  const m = XYZ_TO_LINEAR_SRGB;
  const rgb = [
    Math.max(0, m[0][0] * X + m[0][1] * Y + m[0][2] * Z),
    Math.max(0, m[1][0] * X + m[1][1] * Y + m[1][2] * Z),
    Math.max(0, m[2][0] * X + m[2][1] * Y + m[2][2] * Z)
  ];
  const mx = Math.max(rgb[0], rgb[1], rgb[2]);
  return mx > 0 ? [rgb[0] / mx, rgb[1] / mx, rgb[2] / mx] : [1, 1, 1];
}

// ---- Ballesteros 2012, printed constants verbatim ----
export const BALLESTEROS_T0 = 4600; // K
export const BALLESTEROS_A = 0.92;
export const BALLESTEROS_B = 1.7;
export const BALLESTEROS_C = 0.62;
export function ballesterosT(bv) {
  return (
    BALLESTEROS_T0 *
    (1 / (BALLESTEROS_A * bv + BALLESTEROS_B) +
      1 / (BALLESTEROS_A * bv + BALLESTEROS_C))
  );
}
// Monotone-decreasing inversion over the physical branch
// (bv > -C/A); the window covers the catalogue's 2300-45000 K.
export function ballesterosBV(kelvin) {
  let lo = -0.65;
  let hi = 3.5;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (ballesterosT(mid) > kelvin) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// The sprite fold's own Rec.709 -> XYZ rows (sky-objects-tsl.js
// verbatim; the gate checks they invert the shipped
// XYZ_TO_LINEAR_SRGB).
export const RGB_TO_XYZ = [
  [0.4124, 0.3576, 0.1805],
  [0.2126, 0.7152, 0.0722],
  [0.0193, 0.1192, 0.9505]
];

// The rod-frame brightness shift of a star tint, in magnitudes
// (positive = fainter under rods) - EXACTLY the shader chain:
// tint -> XYZ (rows above) -> Larson Eq. 13 scotopic luminance
// over photopic Y, with the shipped /2.31 white normalization.
export function rodShiftMag(kelvin) {
  const [r, g, b] = starTintRGB(kelvin);
  const m = RGB_TO_XYZ;
  const X = m[0][0] * r + m[0][1] * g + m[0][2] * b;
  const Y = m[1][0] * r + m[1][1] * g + m[1][2] * b;
  const Z = m[2][0] * r + m[2][1] * g + m[2][2] * b;
  const Ys = scotopicY(X, Y, Z) / 2.31;
  return -2.5 * Math.log10(Ys / Y);
}
