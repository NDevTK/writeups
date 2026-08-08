/**
 * fogbow.js - the white bow: the rainbow machinery at MEASURED
 * fog, drawn when the aerodrome reports fog and the sun still
 * reaches the bank. Gated by fogbow-reference.mjs.
 *
 * THE PRIMARY - Mazoyer et al. 2019 ("Experimental study of the
 * aerosol impact on fog microphysics", ACP 19, 4323-4344, open
 * access, READ IN FULL): 23 instrumented fog events (radiation
 * and stratus-lowering) at SIRTA. What it prints and this module
 * carries:
 *  - fog droplet MEAN DIAMETERS 4-14 um across the events, with
 *    the anticorrelation spelled out: the highest number
 *    concentration (255 cm^-3) pairs with the lowest Dm (4 um),
 *    and "for fog events with Nd > 120 cm^-3 the mean diameter
 *    cannot exceed 7 um, while it reaches twice this value" in
 *    clean air - so the big-droplet fogs are the clean ones;
 *  - the droplet spectrometer's own range 2-50 um diameter;
 *  - "the fog onset is generally defined by a drop of
 *    visibility below the 1 km threshold" - the METAR FG
 *    definition this module gates on;
 *  - the THIN/THICK classification by the two diffusometers:
 *    "thin" fog has its "top altitude lower than 18 m" (low
 *    visibility at 4 m only), "thick" is developed on the
 *    vertical - the 18 m instrument height is the printed
 *    anchor for the shallow-fog regime, WHICH IS THE FOGBOW'S:
 *    the bow needs direct sun on the bank, and the drawn slab
 *    at the thin-fog top lets the sun leg survive.
 *
 * THE OPTICS are the rainbow's own, at the fog size: Airy's
 * theory (rainbow.js - Adam's Physics Reports forms, the
 * Daimon & Masumura water index, the Descartes caustic, the
 * energy-normalised LUT) with the drop radius set from the
 * printed fog span instead of Marshall-Palmer rain. Everything
 * the classic fogbow IS then EMERGES from the shipped law:
 *  - the supernumerary spacing ~ (k a)^(-2/3) (Adam, printed in
 *    rainbow.js) balloons at fog sizes - the first Airy maximum
 *    becomes the whole bow;
 *  - the per-channel first maxima CONVERGE - the colour
 *    separation that makes the rainbow collapses into WHITE
 *    (the gate holds the convergence against the rain case);
 *  - the bow pulls visibly inside the Descartes angle (the
 *    Airy shift grows as size falls).
 * The drawn size is the printed clean-fog end (Dm = 14 um -
 * Adam's printed a^(7/3) brightness scaling weights the bow
 * toward the biggest droplets present, and Mazoyer prints that
 * those are the clean-fog ones); the gate holds the whiteness
 * across the WHOLE printed 4-14 um span.
 *
 * THE AMPLITUDE is measured end to end: the fog's extinction is
 * the MEASURED visibility through Koschmieder's own definition
 * (lightning.js KOSCHMIEDER = 3.912 = -ln 0.02: sigma =
 * 3.912 / V), and the two-leg slab is the rainbow's own bowSlab
 * at the printed 18 m thin-fog top. DENSE FOG KILLS ITS OWN
 * BOW emergently: as V falls, the sun leg's extinction through
 * even 18 m of bank extinguishes the display - the fogbow lives
 * in thin bright fog exactly as observed, no threshold coded.
 *
 * THE OCCURRENCE is the aerodrome's report: any METAR FG group
 * (FG, MIFG shallow, BCFG patches, PRFG partial, FZFG freezing
 * - all droplet fog by the 1 km definition; freezing fog is
 * supercooled DROPLETS, still a bow-maker). Mist (BR) is
 * excluded - the printed definition is the 1 km fog threshold.
 * No report, no bow - fails closed.
 */

import {KOSCHMIEDER} from './lightning.js';

// ---- Mazoyer et al. 2019, printed -------------------------------
export const FOG_DM_UM = [4, 14]; // mean-diameter span, 23 events
export const FOG_SPECTRO_UM = [2, 50]; // FM-100 measuring range
export const FOG_VIS_DEF_M = 1000; // "visibility below the 1 km threshold"
export const FOG_THIN_TOP_M = 18; // "top altitude lower than 18 m"
export const FOG_ND_MAX_CM3 = 255; // highest printed concentration

// The drawn droplet: the printed clean-fog end of the span
// (documented reduction - Adam's a^(7/3) brightness weighting on
// Mazoyer's printed size-number anticorrelation).
export const FOG_D_DRAWN_UM = 14;
export function fogDropRadiusMm() {
  return FOG_D_DRAWN_UM / 2 / 1000;
}

// ---- the measured extinction ------------------------------------
// Koschmieder: visibility is DEFINED as the range where contrast
// falls to 2%, so the fog's extinction is exactly 3.912 / V.
export function fogSigmaPerM(visM) {
  if (!Number.isFinite(visM) || visM <= 0) return 0;
  return KOSCHMIEDER / visM;
}
// The slab's sigma x H at the printed thin-fog top - what the
// rainbow's own bowSlab takes. sigma x V = 3.912 identically, so
// this is KOSCHMIEDER x 18 / V: tau ~ 0.23 at 300 m visibility
// (bright bow), ~ 1.4 at 50 m (the bank eats its own display).
export function fogSigH(visM, topM = FOG_THIN_TOP_M) {
  return fogSigmaPerM(visM) * topM;
}

// ---- the measured occurrence ------------------------------------
// METAR FG code group with its qualifiers: MI shallow, BC
// patches, PR partial, VC vicinity, FZ freezing - all droplet
// fog under the printed 1 km definition. BR (mist), FU (smoke)
// and DU/SA never match.
export function fogReported(wx) {
  if (typeof wx !== 'string') return false;
  return /(^|\s)(?:[+-]|VC)?(?:MI|BC|PR|FZ)?FG(\s|$)/.test(wx);
}
