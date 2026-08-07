/**
 * adaptation.js - the eye's photometric adaptation frame: the
 * scene-light display mapping from MEASURED human visual data, so
 * the theme's exposure and night appearance stop being display
 * calibrations.
 *
 * The sources:
 *  - Larson, Rushmeier & Piatko 1997 (LBNL 39882, "A Visibility
 *    Matching Tone Reproduction Operator for High Dynamic Range
 *    Scenes", read in full): Table 1's piecewise just-noticeable-
 *    difference function dLt(La) - the Ferwerda et al. 1996
 *    rod+cone detection thresholds combined at their printed
 *    crossover 10^-0.0184 cd/m^2 - VERBATIM below; the
 *    contrast-matching display frame (their Eq. 7a, after Ward
 *    1991): display-over-world slope bounded by dLt(Ld)/dLt(Lw),
 *    whose GLOBAL form is the exposure shape 1/dLt(La) (the
 *    display-side threshold is a constant of the display and
 *    folds into the anchor); the printed mesopic range - rods
 *    saturating by 5.6 cd/m^2, cones starting at 0.0056, a
 *    linear luminance ramp between (their Sec. 5.2); and Eq. 13,
 *    the Macbeth-fit scotopic luminance
 *      Y_scot = Y (1.33 (1 + (Y+Z)/X) - 1.68).
 *  - The PHOTOMETRIC BRIDGE derives from constants this repo
 *    already ships, with no new empirical number: Falchi 2016's
 *    printed natural-sky pair (skyglow.js NATURAL_MCD 0.174
 *    mcd/m^2 = NATURAL_MAG 22.00 mag/arcsec^2) fixes the
 *    surface-brightness scale; one exact solid angle (arcsec^2
 *    in steradians) turns it into the point-source zero point;
 *    and moonlight.js's SUN_VMAG -26.74 then gives the solar
 *    illuminance constant E0_LUX = 128.2 klx - the textbook
 *    value, DERIVED - and the full-moon 0.32 lx corroboration.
 *  - MOONSKY_*: the clear-sky hemisphere irradiance per unit
 *    source E0 versus source altitude - the Hillaire reference
 *    march (atmo-reference.mjs core: same constants, same
 *    multiple-scattering LUT at zero ground albedo)
 *    hemisphere-integrated offline; the atmosphere is linear in
 *    its source, so the sun's transfer IS the moon's at the
 *    moon's altitude. The atmo gate re-derives rows with its own
 *    march.
 *
 * Documented scope: the exposure here is INSTANTANEOUS in the
 * adaptation luminance (the eye's minutes-long dark-adaptation
 * time course is not modelled - a stated simplification), and
 * the JND fit carries its printed seam discontinuities of a few
 * percent at the branch boundaries (the gate measures them).
 */

// ---- LBNL 39882 Table 1, verbatim ----
// log10 of the just-noticeable difference at adaptation
// luminance La (cd/m^2).
export function jndLog10(logLa) {
  if (!Number.isFinite(logLa)) return NaN;
  if (logLa < -3.94) return -2.86;
  if (logLa < -1.44) return Math.pow(0.405 * logLa + 1.6, 2.18) - 2.86;
  if (logLa < -0.0184) return logLa - 0.395;
  if (logLa < 1.9) return Math.pow(0.249 * logLa + 0.65, 2.7) - 0.72;
  return logLa - 1.255;
}
export function jnd(LaCdM2) {
  return Math.pow(10, jndLog10(Math.log10(Math.max(LaCdM2, 1e-12))));
}

// The GLOBAL contrast-matching exposure shape (Eq. 7a's frame):
// the world-side threshold only - the display-side dLt(Ld) is a
// constant of the display and belongs in the caller's anchor.
export function exposureShape(LaCdM2) {
  return 1 / jnd(Math.max(LaCdM2, 1e-8));
}

// ---- the printed mesopic range and scotopic luminance ----
export const MESOPIC_LO_CDM2 = 0.0056; // cones just getting light
export const MESOPIC_HI_CDM2 = 5.6; // rods no longer significant
// 0 = pure scotopic (grey), 1 = pure photopic (colour); the
// paper's linear luminance ramp between the printed bounds.
export function mesopicBlend(LaCdM2) {
  if (!Number.isFinite(LaCdM2)) return 1;
  return Math.min(
    Math.max(
      (LaCdM2 - MESOPIC_LO_CDM2) / (MESOPIC_HI_CDM2 - MESOPIC_LO_CDM2),
      0
    ),
    1
  );
}
// Eq. 13: scotopic luminance from photopic XYZ (CIE 2-deg).
export function scotopicY(X, Y, Z) {
  if (!(X > 0)) return 0;
  return Y * (1.33 * (1 + (Y + Z) / X) - 1.68);
}

// ---- the photometric bridge, derived from shipped constants ----
import {NATURAL_MCD, NATURAL_MAG} from './skyglow.js';
import {SUN_VMAG, MOON_FULL_VMAG} from './moonlight.js';

// Exact: one arcsec^2 in steradians.
export const ARCSEC2_SR = Math.pow(Math.PI / 180 / 3600, 2);
// Surface brightness S (mag/arcsec^2) -> luminance (cd/m^2),
// anchored on Falchi's printed pair.
export function magArcsec2ToCdM2(S) {
  return NATURAL_MCD * 1e-3 * Math.pow(10, -0.4 * (S - NATURAL_MAG));
}
// A point source of magnitude V spread over 1 arcsec^2 has
// surface brightness V, so its illuminance is that luminance
// times the exact solid angle - the classical zero point,
// derived: E(V) = 2.58e-6 x 10^(-0.4 V) lux.
export function magToLux(V) {
  return magArcsec2ToCdM2(V) * ARCSEC2_SR;
}
// The solar illuminance constant, DERIVED: 128.2 klx (textbook
// ~120-133; the gate asserts the range) - and the full-moon
// corroboration 0.32 lx (textbook ~0.25-0.32).
export const E0_LUX = magToLux(SUN_VMAG);
export const MOON_FULL_LUX = magToLux(MOON_FULL_VMAG);

// Luminance (theme 3-lambda frame): the same Rec.709 weights the
// theme's stLum uses.
export function lum3(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ---- the clear-sky transfer: hemisphere irradiance per unit
// source E0 versus source altitude (Hillaire reference march,
// gAlb 0; rows re-derived by the atmo gate) ----
export const MOONSKY_ALT_DEG = [
  -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 15, 20, 30, 45, 60, 75, 90
];
export const MOONSKY_E_R = [
  0.0000056011, 0.000036432, 0.00014513, 0.0009729, 0.0039534, 0.009825,
  0.014349, 0.017015, 0.018769, 0.019881, 0.020655, 0.021739, 0.022223,
  0.022649, 0.023122, 0.023247, 0.023375, 0.023455
];
export const MOONSKY_E_G = [
  0.000004562, 0.000030388, 0.00010616, 0.00075114, 0.0028429, 0.0089248,
  0.016853, 0.023882, 0.029454, 0.033447, 0.036446, 0.040983, 0.043176,
  0.045102, 0.04718, 0.04759, 0.048075, 0.048327
];
export const MOONSKY_E_B = [
  0.000011908, 0.000075513, 0.00024022, 0.0014807, 0.0045706, 0.013062,
  0.024632, 0.038464, 0.051289, 0.061882, 0.070531, 0.084892, 0.092108,
  0.098094, 0.10588, 0.106, 0.10747, 0.10823
];
function lerpRows(xs, ys, x) {
  if (x <= xs[0]) {
    // Below the table edge the twilight collapse CONTINUES: the
    // march's own log-slope between the last two rows (~0.8 dex
    // per 2 deg) extrapolated down. By the astronomical-twilight
    // definition (sun 18 deg down: no sunlight in the observer's
    // sky) this decays past the Falchi natural-sky floor - the
    // gate asserts that closure - so deep night never inherits
    // the -10 deg row's 0.2 cd/m^2 (40x a full-moon sky).
    return ys[0] * Math.pow(ys[1] / ys[0], (x - xs[0]) / (xs[1] - xs[0]));
  }
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const f = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return ys[i - 1] + f * (ys[i] - ys[i - 1]);
    }
  }
  return ys[ys.length - 1];
}
// Per-channel sky irradiance per unit of the source's TOA
// irradiance, at source altitude altRad. Multiply by the
// source's own E0 (1 for the sun, moonIrradianceE0 for the
// moon) - linearity is the whole trick.
export function skyTransferE(altRad) {
  const d = (altRad * 180) / Math.PI;
  if (!Number.isFinite(d)) return [0, 0, 0];
  return [
    lerpRows(MOONSKY_ALT_DEG, MOONSKY_E_R, d),
    lerpRows(MOONSKY_ALT_DEG, MOONSKY_E_G, d),
    lerpRows(MOONSKY_ALT_DEG, MOONSKY_E_B, d)
  ];
}

// ---- the display map ----
// EXPO_DAY is the display's ONE remaining unit constant: the
// exposure the theme's daytime appearance was built at (the old
// 24/(0.2 + 0.8 day) curve's daylight value - continuity, not
// physics, documented as such). Everything else derives: the
// anchor is the clear-day mean sky luminance the transfer table
// and the bridge give (sun at 45 deg), and the exposure at any
// other adaptation state follows the JND ratio - Eq. 7a's
// global form. The old curve spanned 5x from day to night; this
// map spans the eye's own ~3e4.
export const EXPO_DAY = 24;
export const LA_DAY_ANCHOR_CDM2 =
  (lum3(...skyTransferE(Math.PI / 4)) * E0_LUX) / Math.PI;
export function adaptExposure(LaCdM2) {
  if (!Number.isFinite(LaCdM2)) return EXPO_DAY;
  return (
    (EXPO_DAY * exposureShape(Math.max(LaCdM2, 1e-6))) /
    exposureShape(LA_DAY_ANCHOR_CDM2)
  );
}
