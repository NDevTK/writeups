/**
 * grassland.js - the base green of the landscape, breathing with the
 * season. crops.js and forest.js made the fields and woods follow the
 * calendar, but landuse.js still painted every meadow, pasture and park
 * the same lush green in January as in July - so a winter scene had
 * bare-brown woods and stripped fields standing in bright summer grass.
 * This modulates the grass-family classes (grass, meadow, grassland,
 * village_green, recreation_ground, cemetery) by month and latitude.
 *
 * Grounded in grassland remote-sensing phenology (MODIS land-surface
 * phenology, Zhang et al. 2006 / MCD12Q2; European-grassland 20-yr LSP,
 * MDPI RS 15(1):218) and measured dry-grass vs green-grass spectra
 * (ECOSTRESS spectral library, Meerdink et al. 2019): green grass has
 * low green-peaked visible reflectance (dark desaturated green, G>R>B),
 * while cured/dormant grass loses chlorophyll and reflects higher and
 * red-dominant (R>G>B, a warm straw), and - the load-bearing fact - is
 * BRIGHTER than green grass. Grass stays PRESENT when dormant (tan turf,
 * not bare ground), unlike the deciduous forest that goes bare.
 *
 * Two guardrails the literature demands, both to avoid over-browning:
 *  - NO summer browning anywhere. Summer senescence is a
 *    Mediterranean/semi-arid signal that cannot be told from latitude
 *    alone; firing it would brown an alpine-Swiss July meadow that is
 *    really lush. Summer stays green in every band.
 *  - Winter browning is LATITUDE-GRADED. Cool-season C3 pasture in
 *    maritime/mild-temperate climates (NW Europe, lowland Switzerland)
 *    stays green through winter; hard-winter browning is driven by
 *    continentality, not latitude. So temperate winter gets only a
 *    gentle olive dulling; the full straw dormancy is reserved for the
 *    continental/boreal band (>~52 deg) where hard winter/snow is
 *    reliable. Below |lat| ~26 deg grass is effectively evergreen; the
 *    seasonal amplitude ramps in from there to full by ~40 deg so there
 *    is no visible seam.
 *
 * Pure JS, gated by grassland-reference.mjs; consumed by parseLanduse.
 */

// Dormant/senescent turf targets, in the same low-albedo space as
// CLASS_ALBEDO (ECOSTRESS dry-grass: warm, R>G>B, brighter than green).
export const GRASS_DORMANT = [0.42, 0.35, 0.19]; // full straw (continental)
export const GRASS_OLIVE = [0.2, 0.26, 0.11]; // gentle maritime-winter dulling
export const GRASS_AUTUMN = [0.34, 0.28, 0.14]; // senescence shoulder

const wrapMonth = (m) => ((((m - 1) % 12) + 12) % 12) + 1;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mix = (a, b, t) => [
  a[0] * (1 - t) + b[0] * t,
  a[1] * (1 - t) + b[1] * t,
  a[2] * (1 - t) + b[2] * t
];

// The phenophase of turf at a month/latitude: 'green' (growing),
// 'shoulder' (spring green-up / autumn senescence), or 'dormant' (deep
// winter). Windows follow the MODIS LSP transitions per latitude band:
// the cycle slides later and compresses poleward. Southern hemisphere
// shifts the calendar +6 months.
export function grassPhase(month, lat) {
  let m = month;
  if (Number.isFinite(lat) && lat < 0) m = wrapMonth(m + 6);
  const a = Math.abs(Number.isFinite(lat) ? lat : 45);
  let dormant, shoulder;
  if (a >= 55) {
    // boreal: brief Jul-Aug peak, dormancy Oct-mid-May
    dormant = [10, 11, 12, 1, 2, 3, 4];
    shoulder = [5, 9];
  } else if (a <= 38) {
    // warm temperate: green most of the year, mild Dec-Feb dormancy
    dormant = [12, 1, 2];
    shoulder = [11, 3];
  } else {
    // mid-latitude temperate: peak May-Aug, senescence Sep-Oct,
    // dormancy Nov-Feb, spring green-up shoulder in Mar
    dormant = [11, 12, 1, 2];
    shoulder = [3, 9, 10];
  }
  if (dormant.includes(m)) return 'dormant';
  if (shoulder.includes(m)) return 'shoulder';
  return 'green';
}

// The seasonal turf colour: the class's own green in the growing
// season; at the shoulder a mild senescence blend; in winter a GENTLE
// olive dulling in the temperate band but the full straw dormancy in
// the continental/boreal band (>= 52 deg). The seasonal amplitude ramps
// in from |lat| 26 deg (evergreen below) to full by 40 deg. Green
// year-round with no month (the truthful default).
export function grassColor(base, month, lat) {
  if (!month) return base;
  const a = Math.abs(Number.isFinite(lat) ? lat : 45);
  const amp = clamp01((a - 26) / 14); // 0 at 26 deg -> 1 by 40 deg
  if (amp <= 0) return base; // subtropical/tropical: evergreen
  const ph = grassPhase(month, lat);
  if (ph === 'green') return base;
  if (ph === 'shoulder') return mix(base, GRASS_AUTUMN, 0.35 * amp);
  // dormant: continental straw vs maritime-temperate olive
  return a >= 52
    ? mix(base, GRASS_DORMANT, 0.7 * amp)
    : mix(base, GRASS_OLIVE, 0.5 * amp);
}
