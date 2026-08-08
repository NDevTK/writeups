/**
 * lightpillars.js - light pillars over the measured city lights:
 * the columns of glints that stand above ground lights when
 * diamond dust fills the boundary layer. Gated by
 * lightpillars-reference.mjs.
 *
 * THE PRIMARIES - both open access, both read:
 *  - Zeng 2018 (J. Adv. Model. Earth Syst. 10, 2300 - the
 *    diamond-dust microphysics model): carries the definitional
 *    prints - diamond dust "forms at temperatures typically
 *    less than -10 degC", is "usually composed of
 *    well-developed crystals (often plates)", with arctic
 *    wintertime frequency 20-50% - so the PLATE basal-mirror
 *    optics (the theme's booked sun-pillar machinery) is the
 *    printed habit, and the phenomenon is common where cold
 *    cities are.
 *  - Ricaud et al. 2017 (ACP 17, 5221 - the Dome C lidar
 *    episodes): diamond dust/ice fog detected "in the planetary
 *    boundary layer to a maximum altitude of 100-300 m above
 *    the ground" (depolarization > 30%; one episode "confined
 *    from the surface to 100-200 m") - the printed LAYER DEPTH
 *    that sets how tall the drawn pillars stand.
 *
 * THE OCCURRENCE GATE is a MEASUREMENT, not a threshold: METAR
 * present weather 'IC' (ice crystals / diamond dust) from the
 * live station the theme already reads - a human or sensor at
 * the aerodrome REPORTED crystals in the air now. No coded
 * temperature test; the report is the fact. (Zeng's printed
 * "typically less than -10 degC" is carried as documentation of
 * when to expect the report, not as a gate.)
 *
 * THE GEOMETRY is exact catoptrics on the printed habit: a
 * horizontal basal face at height h above a ground light images
 * the light at height 2h, so a crystal layer of depth H over a
 * light at horizontal distance d paints a vertical column above
 * the light - apparent top elevation atan(2H/d), glints living
 * at half-range. The drawn quad stands 2H over the lamp (the
 * image column made real - the standard construction), and the
 * tilt of real plates smears its width and softens its top by
 * the SAME booked statistics the sun pillar uses
 * (halos.js PLATE_TILT_THETA ~ 1 deg, Breon & Dubrulle;
 * PILLAR_SIGMA_ALT = sqrt(2) x Theta through the mirror fold).
 * Nothing new is tuned: the layer depth is printed, the tilt is
 * booked, the occurrence is measured; one documented display
 * gain scales the additive quads against the lamps they stand
 * on (the lamps' own drawn brightness is already the display
 * calibration).
 */

import {PLATE_TILT_THETA, PILLAR_SIGMA_ALT} from './halos.js';

// ---- printed -----------------------------------------------------
export const DD_LAYER_M = [100, 300]; // Ricaud 2017: "100-300 m"
export const DD_T_TYP_C = -10; // Zeng 2018: "typically less than -10"
export const DD_ARCTIC_FREQ = [0.2, 0.5]; // Zeng 2018 winter frequency

// The drawn layer depth: the printed span's midpoint (documented
// reduction; the span itself is what the gate holds).
export const DD_LAYER_DRAWN_M = (DD_LAYER_M[0] + DD_LAYER_M[1]) / 2;

// ---- the exact mirror geometry ----------------------------------
// Apparent elevation of the pillar top for a ground light at
// horizontal distance dM under a crystal layer of depth layerM:
// the basal mirror at the layer top images the light at twice
// the height.
export function pillarTopRad(dM, layerM = DD_LAYER_DRAWN_M) {
  if (!Number.isFinite(dM) || dM <= 0) return 0;
  return Math.atan2(2 * layerM, dM);
}
// The image-column height the drawn quad stands (m above the
// lamp): 2H - the whole construction in one number.
export function pillarColumnM(layerM = DD_LAYER_DRAWN_M) {
  return 2 * layerM;
}
// Angular half-width of the pillar (radians): the booked tilt
// spread through the mirror fold - the same sqrt(2) Theta the
// sun pillar's altitude spread carries (the finite-range factor
// is order one and documented; the sideways tilt component
// deflects by twice itself exactly as the vertical one does).
export function pillarHalfWidthRad() {
  return PILLAR_SIGMA_ALT;
}
// World half-width of the drawn quad at lamp distance dM.
export function pillarHalfWidthM(dM) {
  return Math.max(dM, 1) * Math.tan(PILLAR_SIGMA_ALT);
}

// ---- the measured occurrence ------------------------------------
// METAR present-weather: IC = ice crystals (diamond dust). The
// word test keeps BLSN/DRSN/ICE-in-remarks etc. from matching -
// the code group is space-delimited in the wx string.
export function diamondDustReported(wx) {
  if (typeof wx !== 'string') return false;
  return /(^|\s)[+-]?IC(\s|$)/.test(wx);
}

// The vertical intensity profile of the drawn quad: v in [0, 1]
// bottom-to-top of the 2H column. The body is flat (every height
// inside the layer mirrors somewhere along the sightline); the
// top softens over the tilt fold's share of the column - the
// printed geometry's own edge, not a styling choice: the layer
// top at 2H smears by ~ d x sigma of EXTRA image height, which
// at the drawn scale is sigma/atan(2H/d) of the column height.
export function pillarProfile(v, dM, layerM = DD_LAYER_DRAWN_M) {
  if (!(v >= 0) || v > 1) return 0;
  const topAng = pillarTopRad(dM, layerM);
  const soft = Math.min(
    Math.max(PILLAR_SIGMA_ALT / Math.max(topAng, 1e-6), 0.05),
    0.45
  );
  const fadeIn = Math.min(v / 0.06, 1); // ground-clutter seam
  const fadeTop =
    v > 1 - soft ? Math.exp(-(((v - (1 - soft)) / soft) ** 2) * 3) : 1;
  return fadeIn * fadeTop;
}

export {PLATE_TILT_THETA, PILLAR_SIGMA_ALT};
