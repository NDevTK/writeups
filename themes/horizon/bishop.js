/**
 * bishop.js - Bishop's Ring: the stratospheric diffraction corona
 * of a volcanically loaded sky, from the phenomenon's own printed
 * primary. Gated by bishop-reference.mjs.
 *
 * THE PRIMARY - 'The Eruption of Krakatoa and Subsequent
 * Phenomena', Report of the Krakatoa Committee of the Royal
 * Society, 1888, Part IV Section I(e), "The large corona round
 * the sun and moon in 1883-4-5, generally known as 'Bishop's
 * Ring'", by E. Douglas Archibald (pp. 232-263). The report is a
 * page scan (archive.org item eruptionofkrakat00roya); per the
 * standing rule every value below was machine-read from the PAGE
 * IMAGES (report pages 232, 235, 236, 237, 238, 256, 257 = scan
 * pages 338, 341-344, 362-363), with the OCR text used only to
 * locate them.
 *
 * WHAT THE REPORT PRINTS
 *  - Discovery and span (p. 232, 256): first detailed observation
 *    by Rev. S. E. Bishop, Honolulu, September 5th 1883 - "corona
 *    or halo extending from 20 deg to 30 deg from the sun ...
 *    whitish haze with pinkish tint, shading off into lilac or
 *    purple against the blue ... hardly a conspicuous object";
 *    maximum intensity about spring 1884; gradual decline to June
 *    1886, after which not seen even by Ricco.
 *  - Structure (pp. 235-236): a diffraction corona - red OUTSIDE
 *    (the Carola's lunar ring "deep red outer margin"), the
 *    reverse of the ice-crystal halo; Cornu's tint order from
 *    within outwards: blue, neutral grey, brown-yellow,
 *    coppery-red, purple-red, dull violet. Averaged over ~20
 *    observers (Table II, excluding two doubtful): inner white
 *    space 21 deg 7 min, outer red boundary 45 deg 33 min in
 *    DIAMETER; adopted 21 deg / 45 deg 30 min. Ricco's May 1884
 *    theodolite triplet (the series' most careful single
 *    measurement, and the value Archibald himself elevates):
 *    inner 21 deg 36 min, MAXIMUM INTENSITY 30 deg 20 min, outer
 *    42 deg 52 min. Riggenbach's independent twelve high-sun
 *    means (p. 237): 20 / 28 / 44 deg.
 *  - The Stokes reduction (p. 257): "The formula employed is
 *    Sin(D/2) = N lambda/d", N = 0.7655 (first order) and 1.7571
 *    (second order), "for the values of these constants the
 *    writer is indebted to Professor Stokes". Applied to the
 *    adopted 21 deg (taken as "the position of the bright
 *    violet"), 30 deg 20 min (maximum intensity = mid-spectrum)
 *    and 45 deg 30 min (the red ring) it prints particle
 *    diameters 0.00165 / 0.00162 / 0.00150 mm, mean 0.00159 mm =
 *    0.00006 inch adopted ("about three times the mean length of
 *    a wave of light"). Independent printed estimates (p. 256):
 *    Forel 0.003 mm, Flogel 0.001 mm.
 *  - Conclusions (p. 256): a first-order diffraction corona in
 *    the same elevated haze stratum as the twilight glows;
 *    particles solid dust rather than ice; best seen at great
 *    altitudes and in air free of ordinary dust; near the
 *    equator, where the matter was densest, reduced to a mere
 *    glare without the red border (p. 238) - optical depth
 *    washout. Round the moon only the pale-reddish boundary was
 *    distinguishable, apparently smaller "in consequence of its
 *    inferior brilliancy" (p. 236) - a visibility effect, which
 *    the theme's adaptation machinery reproduces for free.
 *  - Sunset behaviour (pp. 237-238, documentation): the ring
 *    dilates with solar zenith distance (63 observations, 1885 -
 *    diameters inner/red/outer 12/26/32.8 deg at ZD 60-78 deg,
 *    27.8/32.4/46.6 at 81.6-88.9, 35/38.4/49.2 at 89.1-92.3),
 *    and the brightest part of the twilight purple glow sits at
 *    the dilated corona's radius (13 obs: 18.6 deg at ZD
 *    92.1-93.8) - the report's own bridge to the purple light the
 *    theme already draws from the same layer (stratos.js). The
 *    dilatation itself is not modelled (the diffraction angle is
 *    fixed; the report offers no mechanism).
 *
 * THE CONSTANTS' IDENTITY (documentation + gate landmark): Stokes'
 * printed N are the first two zeros of the Bessel function J0
 * over pi - 2.4048255577/pi = 0.76544, 5.5200781103/pi = 1.75709
 * (A&S Table 9.5 zeros, already the repo's Bessel anchors) -
 * matching the print to the precision of the era's tables. His
 * first-order criterion therefore places the ring of colour
 * lambda at u = x sin(theta) = 2.405 on the Airy variable - on
 * the SHOULDER of the central lobe, not at the first bright ring
 * (u = 5.13562, the first zero of J2; A&S Table 9.5).
 *
 * THE DRAWN DIAMETER - the theme draws diffraction with one
 * certified machinery (the Airy pattern the cirrus corona rides),
 * so the 1888 observations are inverted through THAT physics,
 * exactly the road Sassen 1991 takes for cirrus ("crystal mean
 * diameters ... from the ring angles themselves"): Ricco's
 * printed maximum-intensity radius 15 deg 10 min is identified
 * with the first bright Airy ring in mid-visible light - the
 * V(lambda)-weighted sum peaks where the 550 nm channel rings -
 * giving
 *    d = j21 x lambda_mid / (pi sin 15 deg 10 min) = 3.44 um.
 * The other two printed anchors then EMERGE as landmarks rather
 * than inputs: the mid-spectrum first MINIMUM (the gap bounding
 * the inner white space) lands at 11.3 deg against the printed
 * 10.5 (Riggenbach 10.0); the printed outer red limit 22.75 deg
 * falls between the red channel's first ring (18.9 deg) and its
 * second zero (26.2 deg). The result sits on Forel's independent
 * printed 0.003 mm (one of the three observers the report calls
 * "the most carefully measured") - while Archibald's own 0.00159
 * mm differs by EXACTLY the ratio of the two ring criteria,
 * j21/j01 = 5.13562/2.40483 = 2.1356 (a gate landmark): same
 * measurements, different printed reduction. Both stand in the
 * module; the drawn one is the one the drawing's own mathematics
 * makes true to the 1888 sky.
 *
 * THE AMPLITUDE - single scattering through a thin slab, the
 * cirrus corona's own law L(theta) = P(theta) x (tau/2) e^-tau
 * (van de Hulst Q -> 2 diffraction half; x = pi d/lambda ~ 20
 * sits deep in the regime, and the diffracted tau is achromatic -
 * the aureole's stated geometric-cross-section convention). The
 * tau is the MEASURED volcanic excess of the stratosphere: the
 * live OMPS-LP stratospheric AOD (volcanic.js, GIBS keyless)
 * against the shipped Kremser background chain,
 *    tau_ring = (volcScale - 1) x chainAOD675(),
 * on the slant chord through the printed 15-25 km Junge layer
 * (stratos.js; shellChordAM geometry). The background subtraction
 * IS the physics: Kremser's quiescent layer is sub-0.2 um sulfate,
 * and for d < N lambda the printed formula has no solution - a
 * background stratosphere CANNOT ring (the gate states it). Only
 * a fresh coarse-mode injection - the 1888 report's own regime -
 * draws the ring, and its visibility against the sky then EMERGES
 * radiometrically: at today's volcScale ~1 the term is a fraction
 * of a percent of the circumsolar sky (invisible); at a
 * Pinatubo/Krakatoa-class loading it rises to tens of percent -
 * "visible every day and all day", yet still "hardly a
 * conspicuous object" beside the direct glare. No visibility
 * threshold is coded anywhere.
 *
 * Scope, documented: quiet-time OMPS excesses are fine-mode and
 * carry no 3.4 um pattern - their drawn ring is sub-visible by
 * magnitude (the emergence landmark), so the attribution errs
 * invisibly; the printed sunset dilatation and the near-equator
 * multiple-scattering washout are recorded, not modelled.
 */

import {
  airyPattern,
  airyEncircled,
  buildCloudCoronaLUT,
  coronaAmp,
  shellChordAM,
  CHANNEL_UM
} from './cloud-corona.js';
import {chainAOD675} from './volcanic.js';
import {STRAT_BASE_M, STRAT_TOP_M} from './stratos.js';

// ---- the print, machine-read from the 1888 page images ---------

// Stokes' constants (report p. 257 / scan 363): sin(D/2) = N l/d.
export const BISHOP_N1 = 0.7655; // first order
export const BISHOP_N2 = 1.7571; // second order
// Their mathematical identity: the first two J0 zeros over pi
// (A&S Table 9.5 - the repo's own Bessel anchors).
export const J0_ZERO_1 = 2.4048255577;
export const J0_ZERO_2 = 5.5200781103;
// First bright ring of the Airy pattern [2 J1(u)/u]^2: the first
// zero of J2 (d/du [J1/u] = -J2/u; A&S Table 9.5). The gate also
// re-derives it by direct maximisation - self-certifying.
export const AIRY_RING1_U = 5.13562;

// The adopted angular anchors (DIAMETERS, deg) and Archibald's
// particle table (p. 257): [diameter deg, 1st-order d mm,
// 2nd-order d mm], with his colour assignments.
export const ARCH_INNER_DEG = 21; // "position of the bright violet"
export const ARCH_MID_DEG = 30 + 20 / 60; // Ricco max intensity
export const ARCH_OUTER_DEG = 45.5; // "the red ring" (45 deg 30')
export const ARCH_TABLE = [
  [ARCH_INNER_DEG, 0.00165, 0.00379],
  [ARCH_MID_DEG, 0.00162, 0.00376],
  [ARCH_OUTER_DEG, 0.0015, 0.00346]
];
export const ARCH_D_MM = 0.00159; // his printed 1st-order mean
export const ARCH_D_IN = 0.00006; // the adopted inch value
export const FOREL_D_MM = 0.003; // p. 256, independent
export const FLOGEL_D_MM = 0.001; // p. 256, independent

// The measured series behind the anchors (documentation + gates):
// Table II means (p. 236) and Riggenbach's high-sun means
// (p. 237), diameters in degrees.
export const TABLE2_INNER_DEG = 21 + 7 / 60;
export const TABLE2_OUTER_DEG = 45 + 33 / 60;
export const RIGGENBACH_DEG = {inner: 20, midRed: 28, outer: 44};
// Ricco's theodolite triplet (p. 235), the series' best single
// measurement - the drawn diameter's anchor is its middle value.
export const RICCO_DEG = {inner: 21.6, max: ARCH_MID_DEG, outer: 42 + 52 / 60};
// The sunset dilatation record (p. 237; 63 observations, 1885):
// mean diameters by solar zenith distance band - documentation
// (the mechanism is not printed; the drawn angle stays the
// diffraction one).
export const DILATATION = [
  {zd: [60, 78], inner: 12, red: 26, outer: 32.8},
  {zd: [81.6, 88.9], inner: 27.8, red: 32.4, outer: 46.6},
  {zd: [89.1, 92.3], inner: 35, red: 38.4, outer: 49.2}
];
// The purple-glow bridge (p. 238): brightest glow radius 18.6 deg
// (13 obs, ZD 92.1-93.8) - at the dilated corona's own radius.
export const PURPLE_GLOW_RAD_DEG = 18.6;
// History (pp. 232, 256): first seen / maximum / last seen.
export const BISHOP_FIRST = '1883-09-05';
export const BISHOP_MAX = '1884 (spring)';
export const BISHOP_LAST = '1886-06';

// ---- the report's own formula (Stokes reduction) ---------------

// d (mm) from a ring diameter and wavelength - p. 257 verbatim.
export function archibaldParticleMm(diamDeg, lambdaNm, order = 1) {
  const N = order === 2 ? BISHOP_N2 : BISHOP_N1;
  return (N * lambdaNm * 1e-6) / Math.sin(((diamDeg / 2) * Math.PI) / 180);
}
// The wavelength his printed (diameter, d) pairs imply - the
// gate's colour-band re-derivation of his table.
export function impliedLambdaNm(diamDeg, dMm, order = 1) {
  const N = order === 2 ? BISHOP_N2 : BISHOP_N1;
  return (dMm * Math.sin(((diamDeg / 2) * Math.PI) / 180) * 1e6) / N;
}

// ---- the drawn diameter ----------------------------------------

// Ricco's maximum-intensity radius through the first bright Airy
// ring at the theme's mid channel (V(lambda) peaks by the 550 nm
// channel; the drawn V-weighted ring maximum sits at the mid ring
// - the gate holds it).
export const RICCO_MAX_RAD = ((ARCH_MID_DEG / 2) * Math.PI) / 180;
export function bishopDiameterUm(lambdaMidUm = CHANNEL_UM[1]) {
  return (AIRY_RING1_U * lambdaMidUm) / (Math.PI * Math.sin(RICCO_MAX_RAD));
}

// LUT reach: past the red channel's second zero (26.2 deg) and
// the printed outer limit (22.75 deg); the encircled-energy
// landmark states how much of the diffracted light the cone
// holds per channel (> 90%).
export const BISHOP_THETA_MAX_DEG = 28;

// The drawn pattern: the certified Airy machinery of the cirrus
// corona at the 1888-inverted diameter, convolved once with the
// live source disc. limbAlpha [0,0,0] for the moon's flat disc.
export function buildBishopLUT(srcRadRad, limbAlpha = undefined) {
  return buildCloudCoronaLUT(
    srcRadRad,
    bishopDiameterUm(),
    limbAlpha,
    BISHOP_THETA_MAX_DEG
  );
}

// ---- the measured amplitude ------------------------------------

// The volcanic excess of the live stratosphere at the OMPS
// wavelength: zero at background (volcScale 1) BY CONSTRUCTION -
// the quiescent sub-0.2 um layer cannot satisfy sin <= 1 in the
// printed formula, so a background sky draws no ring. The [1, 8]
// clamp is volcScaleOfSaod's own (volcanic.js).
export function bishopExcessTau(volcScale) {
  const vs = Math.min(Math.max(volcScale || 1, 1), 8);
  return (vs - 1) * chainAOD675();
}

// Slab amplitude per unit direct irradiance at the eye: the
// excess tau on the exact chord through the printed 15-25 km
// layer, through the shipped (tau/2) e^-tau law. Achromatic
// (geometric diffraction share at x ~ 20).
export function bishopAmpOf(volcScale, sinAlt, eyeHM = 300) {
  const tau = bishopExcessTau(volcScale);
  if (!(tau > 0) || !(sinAlt > 0)) return 0;
  const e = Math.asin(Math.min(Math.max(sinAlt, -1), 1));
  return coronaAmp(tau * shellChordAM(e, eyeHM, STRAT_BASE_M, STRAT_TOP_M));
}

// Re-exports the reference gate exercises against the pattern.
export {airyPattern, airyEncircled, coronaAmp};
