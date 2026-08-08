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

// ---- the point-source colour floor (Schaefer 1993) ----
// Schaefer, "Astronomy and the Limits of Vision" (Vistas in
// Astronomy 36, 311 - read in full), Sec. 2.12: "The human eye
// can detect colors from sources brighter than 1500 nL" - the
// photopic/scotopic boundary as he uses it throughout (his
// case split log B = 3.17 IS log10(1500)). His own printed
// conversion (p. 319): 1 nanoLambert = 3.18e-6 nit. The
// product lands within 15% of Ferwerda/LBNL's printed
// MESOPIC_LO above - two independent printed sources on one
// colour floor - and his same table's 26.33 mag/arcsec^2 per
// nL closes a THIRD way through this module's Falchi-anchored
// bridge (the gate holds both corroborations).
export const NL_TO_CDM2 = 3.18e-6;
export const COLOR_LIMIT_NL = 1500;
export const COLOR_LIMIT_CDM2 = COLOR_LIMIT_NL * NL_TO_CDM2;

// ---- naked-eye limiting magnitude (Schaefer 1990) ----
// Schaefer, "Telescopic limiting magnitudes" (PASP 102, 212 -
// read in full): the Knoll-Tousey-Hulburt threshold as
// summarised by Hecht, his Eq. 2 with the printed constants -
// I = C (1 + [K B]^0.5)^2, log C = -9.80 / log K = -1.90 for
// night vision and log C = -8.35 / log K = -5.90 for day, split
// at the printed log B = 3.17 (B in nanoLamberts - the SAME
// printed 1500 nL boundary as this module's colour floor); the
// Allen anchor m = -16.57 - 2.5 log I* (his Eq. 16); and his
// assembled naked-eye zenith equation (Eq. 18):
//   m_z = 8.68 - 1.2 k_v - 5 log(1 + 0.158 sqrt(B_nL)),
// whose printed worked example - B = 136 nL, k_v = 0.3 gives
// 6.05, "in excellent agreement with common lore" - the gate
// reproduces exactly, along with his printed nL pairings for
// 21.0 and 21.8 mag/arcsec^2 skies (136 and 65 nL). The day
// branch assembles the same way from Eq. 2's printed day
// constants with the printed day extinction q = 1.0 (Eq. 3)
// and no colour correction (Eq. 13) - and puts the daytime
// naked-eye limit near -4: Venus stays visible in daylight,
// Jupiter does not, the classic. The two branches are separate
// experimental fits that do not quite meet at the seam; the
// drawn limit blends linearly in log B across +-0.2 dex there
// (documented). k_v = 0.3 is his printed "more typical
// weather" extinction. The detection TRANSITION is printed
// too: Blackwell's 10->50 and 50->90% probability steps are
// each "roughly half a magnitude" - the sprites fade over
// +-0.5 mag around this limit.
// ---- extended-source contrast threshold (Crumey 2014) ----
// Crumey, "Human contrast threshold and astronomical visibility"
// (MNRAS 442, 2600, arXiv:1405.4209 - read in full): Blackwell's
// large-field data re-derived in closed form. His scotopic model
// - his own recommendation "for astronomical visibility" (valid
// below the printed ~0.1 cd/m^2) - with every constant printed:
//   R = (r1 B^-1/4 + r2)^2         (Ricco branch, Eqs. 23/26)
//   Cinf = k1 B^-1/4 + k2          (large-target branch, Eqs. 35/49)
//   C(A) = ((R/A)^q + Cinf^q)^1/q  (Eq. 41), q = 0.6 (Eq. 44)
// with the printed zero-background floor B >= 1e-5 cd/m^2 and
// threshold excess dB = B C. The detection RAMP reuses the
// printed Blackwell half-magnitude probability width the star
// and meteor gates carry. What the model does that the flash JND
// (above) provably cannot: the gegenschein at a dark sky sits
// ~16x ABOVE this threshold - visible, as it really is - and
// drops to ~2x under a full-moon sky (marginal; with Crumey's
// field factor ~2 for non-laboratory conditions, gone).
//
// Above his printed validity edge ("approximately 0.1 cd m^-2
// (15 mag arcsec^-2) for achromatic sources") the fitted
// coefficients expire - k1 B^-1/4 + k2 crosses zero near 1.3
// cd/m^2 and the threshold would flatten to a floor instead of
// rising. So past the edge the threshold continues as a WEBER
// law: contrast frozen at the model's own edge value, threshold
// growing linearly with B - the printed photopic regime (the
// Ferwerda frame's photopic branch above is the same slope-one
// line). Continuous at the edge by construction, identical below
// it, and it lets a bright-source gate (the aurora curtain) die
// correctly in twilight and daylight instead of surviving on the
// expired fit.
export const CRUMEY_R1 = 7.31e-4;
export const CRUMEY_R2 = -5.162e-4;
export const CRUMEY_K1 = 7.633e-3;
export const CRUMEY_K2 = -7.174e-3;
export const CRUMEY_Q = 0.6;
export const CRUMEY_B_FLOOR = 1e-5;
export const CRUMEY_B_VALID = 0.1;
export function crumeyThresholdDB(Bcdm2, Asr) {
  const Braw = Math.max(Bcdm2, CRUMEY_B_FLOOR);
  const B = Math.min(Braw, CRUMEY_B_VALID);
  const b4 = Math.pow(B, -0.25);
  const R = Math.pow(Math.max(CRUMEY_R1 * b4 + CRUMEY_R2, 0), 2);
  const Cinf = Math.max(CRUMEY_K1 * b4 + CRUMEY_K2, 1e-6);
  const C = Math.pow(
    Math.pow(R / Math.max(Asr, 1e-9), CRUMEY_Q) + Math.pow(Cinf, CRUMEY_Q),
    1 / CRUMEY_Q
  );
  // Weber continuation past the printed validity edge (ratio 1
  // below it).
  return B * C * (Braw / B);
}
// Visibility of an extended feature of excess luminance dL and
// solid angle A over sky B: the printed +-0.5 mag Blackwell ramp
// on the threshold ratio.
// Crumey's field factor for non-laboratory viewing (his notional
// working value F = 2, printed in his telescopic application and
// shown there to land Sinnott's best-value limiting magnitudes).
export const CRUMEY_F = 2;
export function extendedVisibility(dLcdm2, Bcdm2, Asr) {
  if (!(dLcdm2 > 0)) return 0;
  const ratio = dLcdm2 / (CRUMEY_F * crumeyThresholdDB(Bcdm2, Asr));
  const half = Math.pow(10, 0.4 * DETECT_HALF_MAG);
  const t = (Math.log(ratio) / Math.log(half) + 1) / 2;
  return Math.min(Math.max(t, 0), 1);
}
// The milky way's drawn appearance: Crumey's printed observation
// anchor (Bigourdan 1907 via his Sec. 9): the summer milky way
// "became visible ... when the Sun reached 13 degrees below
// horizon", sky ~20.2-20.3 mag/arcsec^2, with his printed
// dark-sky bands (grey 20.25-21.24, black 21.25-21.74). The
// drawn fade runs the printed grey band: on at 20.25, full at
// 21.25 - his own practical dark-sky definition ("one in which
// the Milky Way is capable of being seen").
export function milkyWayVisibility(Bcdm2) {
  const mag =
    NATURAL_MAG -
    2.5 * Math.log10(Math.max(Bcdm2, 1e-9) / (NATURAL_MCD * 1e-3));
  const t = (mag - 20.25) / (21.25 - 20.25);
  return Math.min(Math.max(t, 0), 1);
}

export const KV_TYPICAL = 0.3;
export const DETECT_HALF_MAG = 0.5;
export function limitingMagnitude(Bcdm2, kv = KV_TYPICAL) {
  const nL = Math.max(Bcdm2, 1e-9) / NL_TO_CDM2;
  const logB = Math.log10(nL);
  const mNight = 8.68 - 1.2 * kv - 5 * Math.log10(1 + 0.158 * Math.sqrt(nL));
  const mDay =
    -16.57 +
    2.5 * 8.35 -
    kv -
    5 * Math.log10(1 + Math.pow(10, -5.9 / 2) * Math.sqrt(nL));
  const t = Math.min(Math.max((logB - 2.97) / 0.4, 0), 1);
  return mNight * (1 - t) + mDay * t;
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
