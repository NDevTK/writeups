/**
 * crops.js - what the farm field is actually GROWING, and the colour
 * that crop wears. landuse.js paints one farmland brown everywhere the
 * OSM says landuse=farmland; but a farmland is not one colour - it is
 * brilliant-yellow rapeseed in April, golden wheat in July, deep-green
 * maize in August, purple lavender in June, olive-green vineyard rows.
 * OSM records the real crop on the SAME polygons, through the SAME
 * Overpass mirrors, as `crop=*` (grape 592k, rice 439k, cereal 73k,
 * corn, wheat, rape, lavender, ...), plus `produce=*` and `trees=*` on
 * orchards. This turns that tag into a research-grounded canopy colour,
 * seasonally shifted so the hero crops only wear their iconic colour
 * inside their real bloom/ripen window. Pure JS (no renderer import),
 * gated by crops-reference.mjs; consumed by parseLanduse in landuse.js.
 *
 * Colours are representative daylit sRGB (0-1) in the SAME low-albedo
 * space as landuse.js CLASS_ALBEDO / the terrain grass ramp - a green
 * canopy reads as a dark, desaturated green because chlorophyll
 * absorbs blue (~450 nm) and red (~670 nm) and reflects only a modest
 * green peak (~550 nm): leaf visible reflectance is green ~10-15%,
 * red/blue ~3-6% (EUMeTrain 3.2; Humboldt GSP). Senescence/ripening =
 * chlorophyll breaks down, carotenoids/browns take over -> tan/gold
 * (Frontiers, wheat senescence PSRI 2019). The iconic colours trace to
 * MEASURED band reflectance run through the repo's CIE 1931/D65 pipeline
 * (spectral-color.js / ocean-color.js): rape flowering a low-blue yellow
 * (MDPI RS 14(5):1113; canola spectra, Sui 2016), ripe-cereal gold, deep
 * maize green, lavender a blue+red purple, cotton bolls white (MDPI RS
 * 12(11):1712) - spectral-color-reference.mjs holds these hero colours
 * to those measured signatures. Tag values and usage counts from OSM
 * taginfo (crop/produce/trees, fetched 2026-07-11).
 */

// Per canonical crop: `green` is the vegetative canopy (the safe
// default, worn most of the year); `hero`/`months` is the iconic
// phenophase colour and its Northern-Hemisphere window (inclusive
// month numbers, 1=Jan). Southern hemisphere shifts the window +6
// months. Crops with no `hero` are green year-round at scene scale.
export const CROP_ALBEDO = {
  // Cereals: green in spring, GOLDEN/tan at ripe harvest (late Jun-Aug).
  cereal: {
    green: [0.32, 0.45, 0.15],
    hero: [0.78, 0.66, 0.32],
    months: {lo: 7, hi: 8}
  },
  // Maize/corn: deep dense green summer canopy, tan stover in autumn.
  maize: {
    green: [0.13, 0.3, 0.09],
    hero: [0.62, 0.52, 0.3],
    months: {lo: 9, hi: 10}
  },
  // Rapeseed/canola: BRILLIANT YELLOW at flowering (Apr-May), else green.
  rape: {
    green: [0.3, 0.42, 0.14],
    hero: [0.86, 0.78, 0.16],
    months: {lo: 4, hi: 5}
  },
  // Sunflower: green leaves + yellow heads -> muted green-gold at bloom.
  sunflower: {
    green: [0.3, 0.42, 0.15],
    hero: [0.55, 0.55, 0.16],
    months: {lo: 7, hi: 8}
  },
  // Rice/paddy: green over water-glint; golden at harvest (Sep-Oct).
  rice: {
    green: [0.28, 0.42, 0.3],
    hero: [0.8, 0.72, 0.32],
    months: {lo: 9, hi: 10}
  },
  // Soy: broadleaf green, yellow-tan at senescence.
  soy: {
    green: [0.24, 0.4, 0.14],
    hero: [0.7, 0.62, 0.28],
    months: {lo: 9, hi: 10}
  },
  // Cotton: green canopy, WHITE open bolls brightening the field.
  cotton: {
    green: [0.22, 0.36, 0.14],
    hero: [0.72, 0.72, 0.66],
    months: {lo: 9, hi: 10}
  },
  // Grape/vineyard: green rows + bare soil = muted olive; red-gold fall.
  grape: {
    green: [0.34, 0.4, 0.24],
    hero: [0.66, 0.45, 0.2],
    months: {lo: 10, hi: 11}
  },
  // Lavender: grey-green foliage, PURPLE flower spikes in bloom (Jun-Jul).
  lavender: {
    green: [0.4, 0.44, 0.34],
    hero: [0.42, 0.32, 0.55],
    months: {lo: 6, hi: 7}
  },
  // Green year-round at field scale.
  sugarbeet: {green: [0.16, 0.34, 0.11]},
  sugarcane: {green: [0.24, 0.4, 0.14]},
  potato: {green: [0.24, 0.4, 0.16]},
  hop: {green: [0.22, 0.38, 0.13]},
  tea: {green: [0.15, 0.33, 0.13]},
  coffee: {green: [0.14, 0.3, 0.12]},
  olive: {green: [0.3, 0.36, 0.22]}, // grey-green evergreen
  orchard: {green: [0.2, 0.35, 0.15]} // generic fruit-tree canopy
};

// Green-canopy anchor for a recognised-but-untabled green crop.
export const CROP_GREEN = [0.2, 0.36, 0.14];

// Raw OSM tag token -> canonical crop key. Built from the real
// taginfo value lists (crop/produce/trees). The single most important
// correction: OSM tags rapeseed as `rape`, not rapeseed/canola/colza.
export const CROP_ALIAS = {
  // cereals (crop=cereal dominates; wheat/barley/grain and friends)
  wheat: 'cereal',
  barley: 'cereal',
  oat: 'cereal',
  oats: 'cereal',
  rye: 'cereal',
  triticale: 'cereal',
  grain: 'cereal',
  cereals: 'cereal',
  spelt: 'cereal',
  millet: 'cereal',
  sorghum: 'cereal',
  // maize / corn
  corn: 'maize',
  // rapeseed / canola / colza -> OSM `rape`
  rapeseed: 'rape',
  canola: 'rape',
  colza: 'rape',
  mustard: 'rape', // brassica, same yellow bloom
  // sunflower
  sunflowers: 'sunflower',
  // rice / paddy
  paddy: 'rice',
  // soy
  soybean: 'soy',
  soybeans: 'soy',
  soya: 'soy',
  // grape / vineyard
  grapes: 'grape',
  vine: 'grape',
  vineyard: 'grape',
  wine: 'grape',
  grape_nursery: 'grape',
  // sugar beet
  sugar_beet: 'sugarbeet',
  beet: 'sugarbeet',
  beetroot: 'sugarbeet',
  // sugarcane (+ Portuguese, Brazil is a heavy tagger)
  sugar_cane: 'sugarcane',
  'cana-de-açúcar': 'sugarcane',
  'cana-de-açucar': 'sugarcane',
  // hops
  hops: 'hop',
  hop_plants: 'hop',
  // coffee (trees=coffea_plants after suffix strip -> coffea)
  coffea: 'coffee',
  // potato
  potatoes: 'potato',
  // olives
  olives: 'olive',
  oliveoil: 'olive',
  // orchard / fruit-tree crops (produce=* and trees=* strip to these)
  apple: 'orchard',
  apples: 'orchard',
  pear: 'orchard',
  plum: 'orchard',
  plums: 'orchard',
  cherry: 'orchard',
  cherries: 'orchard',
  orange: 'orchard',
  oranges: 'orchard',
  peach: 'orchard',
  apricot: 'orchard',
  date: 'orchard',
  dates: 'orchard',
  banana: 'orchard',
  bananas: 'orchard',
  mango: 'orchard',
  walnut: 'orchard',
  almond: 'orchard',
  hazel: 'orchard',
  hazelnut: 'orchard',
  avocado: 'orchard',
  lemon: 'orchard',
  lime: 'orchard',
  citrus: 'orchard',
  mandarin: 'orchard',
  fig: 'orchard',
  kiwi: 'orchard',
  pineapple: 'orchard',
  papaya: 'orchard',
  coconut: 'orchard',
  palm: 'orchard',
  oil_palm: 'orchard',
  oil: 'orchard', // produce=oil / trees=oil_palms (suffix-stripped)
  'palm oil': 'orchard',
  palm_oil: 'orchard',
  chestnut: 'orchard',
  pecan: 'orchard',
  pistachio: 'orchard',
  macadamia: 'orchard',
  persimmon: 'orchard',
  nut: 'orchard',
  fruit: 'orchard',
  berries: 'orchard',
  berry: 'orchard',
  blueberry: 'orchard',
  strawberry: 'orchard',
  raspberry: 'orchard',
  cranberry: 'orchard',
  cranberries: 'orchard',
  rubber: 'orchard' // latex plantation canopy: green trees
};

// Strip the produce/trees suffixes (olive_trees -> olive,
// coffea_plants -> coffea, oil_palms -> oil_palm) and normalise a raw
// OSM crop/produce/trees value to a canonical crop key, or null.
// Handles OSM multi-value list syntax (`wheat;barley;sunflower`) and
// comma variants by taking the FIRST token.
export function normalizeCrop(raw) {
  if (!raw) return null;
  let tok = String(raw).toLowerCase().trim().split(/[;,]/)[0].trim();
  if (!tok) return null;
  tok = tok.replace(/_(trees|plants|palms)$/, '');
  if (CROP_ALBEDO[tok]) return tok;
  return CROP_ALIAS[tok] || null;
}

const wrapMonth = (m) => ((((m - 1) % 12) + 12) % 12) + 1;
const inWindow = (m, lo, hi) =>
  lo <= hi ? m >= lo && m <= hi : m >= lo || m <= hi;

// The canopy colour for a canonical crop at the given month/latitude:
// the hero phenophase colour inside its window (window shifted +6
// months in the southern hemisphere), else the vegetative green. With
// no month, always green (the truthful default). Returns null for an
// untabled key.
export function cropColor(canonical, month, lat) {
  const e = CROP_ALBEDO[canonical];
  if (!e) return null;
  if (e.hero && month) {
    let {lo, hi} = e.months;
    if (Number.isFinite(lat) && lat < 0) {
      lo = wrapMonth(lo + 6);
      hi = wrapMonth(hi + 6);
    }
    if (inWindow(month, lo, hi)) return e.hero;
  }
  return e.green;
}

// The one call landuse.js makes: given an OSM tags object, the current
// month (1-12) and the scene latitude, return the crop canopy albedo
// or null (unrecognised -> caller keeps the base class albedo). Reads
// crop, then produce, then trees (the three ways OSM records it).
export function cropAlbedoFromTags(tags, month, lat) {
  if (!tags) return null;
  const raw = tags.crop || tags.produce || tags.trees;
  const canon = normalizeCrop(raw);
  return canon ? cropColor(canon, month, lat) : null;
}
