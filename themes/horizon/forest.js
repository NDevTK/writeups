/**
 * forest.js - what the forest is MADE OF, and the colour it wears this
 * month. landuse.js paints one flat dark green wherever OSM says
 * landuse=forest / natural=wood, but a forest is not one colour and not
 * one season: a spruce stand is dark blue-green all year, an oak-beech
 * wood is deep green in summer, blazes gold-orange at peak autumn, and
 * stands grey-brown and bare through winter. OSM records the structure
 * on the SAME polygons, through the SAME Overpass mirrors, as
 * leaf_type=* (broadleaved 82%, needleleaved 11%, mixed 6%, palm,
 * leafless) and leaf_cycle=* (deciduous 71%, evergreen 23%, semi_*),
 * both heavily used (natural=wood 12.5M, landuse=forest 5.9M). This
 * turns those tags + the month/latitude into a phenology-grounded
 * canopy colour. Pure JS (no renderer import), gated by
 * forest-reference.mjs; consumed by parseLanduse in landuse.js beside
 * the crop path.
 *
 * Colours in the table are true-colour display sRGB (0-1) for a canopy
 * seen from distance, grounded in leaf/canopy optics: chlorophyll
 * absorbs blue (~450 nm) and red (~670 nm) and reflects a modest green
 * plateau (~550 nm) -> a DARK desaturated green (green ~8-15%, red/blue
 * ~3-5%; PROSPECT/SAIL leaf optics, Jacquemoud & Baret 1990). Autumn:
 * chlorophyll breaks down, unmasking carotenoids (yellow-orange) and
 * anthocyanins (red), reflectance climbs in red -> gold through
 * orange-red (Gitelson/Merzlyak senescence indices). The colours trace
 * to MEASURED band reflectance run through the repo's CIE 1931/D65
 * pipeline (spectral-color.js / ocean-color.js): conifer/summer/spring
 * come out green-led, autumn gold-orange (R>G>B) and brighter, bare a
 * brown litter - spectral-color-reference.mjs holds these table values
 * to those measured signatures. A single SCENE_SCALE then lands them in
 * the darker albedo space the terrain ramp and CLASS_ALBEDO.forest
 * ([0.07,0.16,0.05]) already use, preserving hue.
 */

// The empirical scene-albedo calibration: the research true-colour
// sRGB values are ~2.5x brighter than this renderer's forest albedo
// convention; 0.4 lands summer broadleaf green right on the existing
// CLASS_ALBEDO.forest while keeping the autumn gold and spring
// yellow-green reading distinctly.
export const SCENE_SCALE = 0.4;

// Canopy colours (true-colour display sRGB, pre-scale) by kind/season.
export const FOREST_SRGB = {
  // Conifer / needleleaved evergreen: dark blue-green year-round, a
  // touch duller/olive in winter. Reflects less than broadleaf.
  conifer: {green: [0.14, 0.3, 0.16], winter: [0.16, 0.26, 0.17]},
  // Broadleaved deciduous through the year.
  deciduous: {
    spring: [0.34, 0.49, 0.21], // fresh yellow-green leaf-out
    summer: [0.24, 0.4, 0.18], // deep green full canopy
    autumn: [0.6, 0.38, 0.12], // peak gold-orange senescence
    bare: [0.33, 0.28, 0.22] // grey-brown: bare branches over litter
  },
  // Mixed forest: conifers stay green, so the seasonal swing is muted.
  mixed: {
    spring: [0.26, 0.4, 0.19],
    summer: [0.2, 0.35, 0.17],
    autumn: [0.42, 0.35, 0.16], // muted olive-gold
    bare: [0.24, 0.28, 0.19]
  },
  // Broadleaved evergreen (holm oak, tropical): green year-round, no
  // autumn; slightly greyer than deciduous summer (waxy cuticle).
  broadleaf_evergreen: {green: [0.2, 0.33, 0.17]},
  // leaf_type=leafless (sparse / cactus scrub): muted brown-green.
  leafless: {green: [0.33, 0.3, 0.22]}
};

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .trim();

// The forest KIND from the OSM leaf_type + leaf_cycle pair, or null
// when neither tag says anything usable (caller keeps the flat forest
// default). Structure (leaf_type) leads; the cycle refines whether a
// broadleaf is the deciduous seasonal case or an evergreen.
export function forestKind(leafType, leafCycle) {
  const lt = norm(leafType);
  const lc = norm(leafCycle);
  if (lt === 'leafless') return 'leafless';
  if (lt === 'palm') return 'broadleaf_evergreen'; // palms: evergreen
  if (lt === 'needleleaved')
    return lc === 'deciduous' ? 'deciduous' : 'conifer'; // larch = decid.
  if (lt === 'mixed') return 'mixed';
  if (lt === 'broadleaved')
    return lc === 'evergreen' || lc === 'semi_evergreen'
      ? 'broadleaf_evergreen'
      : 'deciduous'; // deciduous / semi_deciduous / unspecified
  // No leaf_type, but a cycle: evergreen -> assume conifer green;
  // deciduous -> broadleaf seasonal.
  if (lc === 'evergreen' || lc === 'semi_evergreen') return 'conifer';
  if (lc === 'deciduous' || lc === 'semi_deciduous') return 'deciduous';
  return null;
}

// The phenophase used to be guessed here from month and latitude -
// spring/summer/autumn windows bucketed into three latitude bands.
// It is now MEASURED for the pixel under the camera (phenology.js
// phenoForestPhase, off the MCD12Q2 EVI2 amplitude crossings), and
// the guess is deleted rather than kept as a backstop: without a
// measured phase the canopy is simply not put through a season.
const scale = (c) => [
  c[0] * SCENE_SCALE,
  c[1] * SCENE_SCALE,
  c[2] * SCENE_SCALE
];

// The canopy albedo for a forest of the given structure at the
// MEASURED phenophase, or null if the tags say nothing usable.
// `phase` is phenology.js's reading of the pixel's own MCD12Q2 EVI2
// amplitude crossings: 'spring' on the green-up ramp, 'summer' across
// the >=90% plateau, 'autumn' on the green-down ramp, 'bare' outside
// the season. Conifer/evergreen stay green (conifer duller only when
// the pixel is measurably bare); deciduous and mixed run the full
// cycle. No phase - no usable cycle for this pixel - means summer
// green, the truthful unknown, NOT a calendar guess.
export function forestColor(leafType, leafCycle, phase = null) {
  const kind = forestKind(leafType, leafCycle);
  if (!kind) return null;
  const t = FOREST_SRGB[kind];
  if (kind === 'conifer') return scale(phase === 'bare' ? t.winter : t.green);
  if (kind === 'broadleaf_evergreen' || kind === 'leafless')
    return scale(t.green);
  return scale(t[phase] || t.summer);
}

// The one call landuse.js makes: an OSM tags object + the measured
// phenophase -> the forest canopy albedo, or null (caller keeps the
// flat forest class albedo when the leaf tags are absent/unusable).
export function forestAlbedoFromTags(tags, phase = null) {
  if (!tags) return null;
  return forestColor(tags.leaf_type, tags.leaf_cycle, phase);
}
