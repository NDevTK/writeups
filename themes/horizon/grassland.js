/**
 * grassland.js - the base green of the landscape, breathing with the
 * season. crops.js and forest.js made the fields and woods follow the
 * calendar, but landuse.js still painted every meadow, pasture and park
 * the same lush green in January as in July - so a winter scene had
 * bare-brown woods and stripped fields standing in bright summer grass.
 * This modulates the grass-family classes (grass, meadow, grassland,
 * village_green, recreation_ground, cemetery) by the MEASURED phase
 * phenology.js reads out of MCD12Q2 for the pixel under the camera.
 * It used to modulate them by month and latitude instead; that
 * calendar is gone rather than kept as a backstop, and the guardrails
 * it needed went with it (see grassColor).
 *
 * Grounded in grassland remote-sensing phenology (MODIS land-surface
 * phenology, Zhang et al. 2006 / MCD12Q2; European-grassland 20-yr LSP,
 * MDPI RS 15(1):218) and measured dry-grass vs green-grass spectra
 * (ECOSTRESS/ASTER spectral library, Meerdink et al. 2019; Baldridge et
 * al. 2009): green grass has low green-peaked visible reflectance (dark
 * desaturated green, G>R>B), while cured/dormant grass loses chlorophyll
 * and reflects higher, red-dominant (R>G>B, a warm straw), and - the
 * load-bearing fact - is BRIGHTER than green. Grass stays PRESENT when
 * dormant (tan turf, not bare ground), unlike the deciduous forest.
 *
 * The colour targets are not eyeballed: the measured ASTER/ECOSTRESS
 * band reflectances (green grass ~4-11% green-peaked; dry grass rising
 * ~14% blue -> 21% green -> 32% red, anchored on the JHU dry-grass
 * spectrum) were integrated through this repo's own CIE 1931 2 deg / D65
 * pipeline (ocean-color.js) to sRGB. That reproduces the ECOSTRESS
 * "literal" colours - green ~[0.28,0.33,0.23] at luminance Y~0.08, dry
 * ~[0.58,0.49,0.43] at Y~0.22 - and quantifies the ~2.7x dormant
 * brightening. The palette values below are the darker scene-albedo
 * rendering of that measured direction (a slightly warmer, lower-blue
 * "golden cured" straw rather than fully-weathered grey litter), held to
 * the measured R>G>B-and-brighter constraints by the gate.
 *
 * Both guardrails the old latitude calendar needed are now structural
 * rather than hand-drawn. It had to forbid summer browning outright,
 * because Mediterranean summer senescence cannot be told from
 * latitude and firing it would have cured a lush alpine July meadow;
 * the measured phase simply reports what the pixel did, so a
 * genuinely summer-dormant Mediterranean pasture browns and the
 * alpine one does not. It also had to grade winter browning by
 * latitude, so that a mild maritime pasture was only dulled and not
 * strawed; now a pixel that never reaches a measured dormancy is
 * never browned at all.
 *
 * Pure JS, gated by grassland-reference.mjs; consumed by parseLanduse.
 */

// Dormant/senescent turf targets, in the same low-albedo space as
// CLASS_ALBEDO (ECOSTRESS dry-grass: warm, R>G>B, brighter than green).
export const GRASS_DORMANT = [0.42, 0.35, 0.19]; // cured straw
export const GRASS_AUTUMN = [0.34, 0.28, 0.14]; // senescence shoulder

const mix = (a, b, t) => [
  a[0] * (1 - t) + b[0] * t,
  a[1] * (1 - t) + b[1] * t,
  a[2] * (1 - t) + b[2] * t
];

/**
 * The seasonal turf colour, driven ONLY by the measured phase that
 * phenology.js reads out of MCD12Q2 for the pixel under the camera:
 * 'green' keeps the class's own colour, 'shoulder' takes the
 * senescence blend, 'dormant' the cured straw.
 *
 * There is no month/latitude calendar behind this any more. The old
 * one guessed the phase from hardcoded month lists per latitude band
 * and then scaled the blend by a latitude ramp (nothing below 26 deg,
 * full by 40) with a separate continental-vs-maritime split at 52 deg
 * choosing straw over olive. Every one of those numbers was standing
 * in for a question the satellite answers directly:
 *  - "is there a season here at all?" is the product's own retrieval
 *    test (a cycle needs EVI2 amplitude >= 0.1 and >= 35% of the
 *    three-year range), so NO CYCLE means no modulation - the grass
 *    keeps its class colour, which is what a pixel with no strong
 *    season actually looks like. The 26-40 deg ramp is gone.
 *  - "does this place brown hard, or just dull?" was the 52 deg
 *    split, and it existed to stop a mild maritime winter being
 *    strawed by a calendar that browned it wrongly. A measured
 *    dormancy is a real one - the pixel reached its own dormant floor
 *    - so the measured dry-grass target is the right one and the
 *    olive compromise has nothing left to do.
 *
 * No phase (no usable cycle) returns the base colour unchanged: the
 * honest unknown, not a guess.
 */
export function grassColor(base, phase = null) {
  if (phase === 'shoulder') return mix(base, GRASS_AUTUMN, 0.35);
  if (phase === 'dormant') return mix(base, GRASS_DORMANT, 0.7);
  return base;
}
