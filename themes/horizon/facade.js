/**
 * facade.js - the real colour of a real building. buildings.js gives
 * every town its true footprint and height, but every wall wore a
 * hash-picked stone tint and every pitched roof the same tiled brown.
 * OSM records what a building is actually made of and painted, on the
 * SAME way[building] polygons, through the SAME Overpass mirrors:
 * building:colour / roof:colour (white 301k, grey, beige, #eecfaf, red,
 * ... - a mix of hex and CSS/German colour names) and building:material
 * / roof:material (brick 636k, plaster, concrete, wood, metal, glass;
 * roof_tiles 960k, metal, slate, thatch, copper, ...). This turns those
 * tags into a wall and roof colour: the explicit colour when tagged,
 * else a representative tone for the material, else null so the caller
 * keeps its hash tint / default roof. Pure JS (no renderer import),
 * gated by facade-reference.mjs; consumed by buildings.js.
 *
 * Colours are sRGB (0-1) in the same space as buildings.js FACADES /
 * ROOF. Material tones are representative (a brick wall reddish-brown,
 * a slate roof dark blue-grey, weathered copper its verdigris green);
 * the explicit colour tags are honoured literally (hex exact, named
 * colours at their CSS value), since that is what the mapper painted.
 */

// CSS (+ a few German) colour names seen in real building:colour /
// roof:colour data, as hex. Resolved by parseColour; separators are
// stripped first so light_gray / lightgrey / "light grey" all match.
export const NAMED = {
  white: '#ffffff',
  black: '#000000',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  orange: '#ffa500',
  brown: '#a52a2a',
  grey: '#808080',
  gray: '#808080',
  lightgrey: '#d3d3d3',
  lightgray: '#d3d3d3',
  darkgrey: '#a9a9a9',
  darkgray: '#a9a9a9',
  dimgrey: '#696969',
  dimgray: '#696969',
  silver: '#c0c0c0',
  beige: '#f5f5dc',
  tan: '#d2b48c',
  wheat: '#f5deb3',
  pink: '#ffc0cb',
  maroon: '#800000',
  firebrick: '#b22222',
  darkred: '#8b0000',
  lightblue: '#add8e6',
  salmon: '#fa8072',
  darksalmon: '#e9967a',
  slategrey: '#708090',
  slategray: '#708090',
  tomato: '#ff6347',
  cream: '#fffdd0',
  ivory: '#fffff0',
  gold: '#ffd700',
  khaki: '#f0e68c',
  olive: '#808000',
  navy: '#000080',
  teal: '#008080',
  purple: '#800080',
  sandybrown: '#f4a460',
  peru: '#cd853f',
  sienna: '#a0522d',
  chocolate: '#d2691e',
  // German colour names (OSM has many German taggers)
  weiss: '#ffffff',
  weiß: '#ffffff',
  grau: '#808080',
  rot: '#ff0000',
  gelb: '#ffff00',
  braun: '#a52a2a',
  blau: '#0000ff',
  gruen: '#008000',
  grün: '#008000',
  schwarz: '#000000',
  rosa: '#ffc0cb'
};

// building:material -> a representative WALL colour.
export const MATERIAL_WALL = {
  brick: [0.55, 0.28, 0.22],
  plaster: [0.82, 0.78, 0.7],
  plastered: [0.82, 0.78, 0.7],
  render: [0.82, 0.78, 0.7],
  cement_block: [0.62, 0.61, 0.58],
  cement: [0.62, 0.61, 0.58],
  block: [0.62, 0.61, 0.58],
  concrete: [0.6, 0.6, 0.58],
  concrete_masonry_unit: [0.62, 0.61, 0.58],
  rcc: [0.6, 0.6, 0.58],
  wood: [0.5, 0.38, 0.26],
  timber_framing: [0.55, 0.42, 0.3],
  timber: [0.5, 0.38, 0.26],
  metal: [0.6, 0.62, 0.64],
  metal_plates: [0.6, 0.62, 0.64],
  steel: [0.58, 0.6, 0.63],
  tin: [0.62, 0.63, 0.64],
  glass: [0.5, 0.6, 0.68],
  stone: [0.68, 0.64, 0.57],
  masonry: [0.68, 0.64, 0.57],
  sandstone: [0.78, 0.66, 0.5],
  limestone: [0.85, 0.82, 0.74],
  marble: [0.9, 0.9, 0.88],
  mud: [0.55, 0.42, 0.3],
  earth: [0.55, 0.42, 0.3],
  plastic: [0.75, 0.75, 0.73],
  vinyl: [0.78, 0.77, 0.73],
  plastic_sheeting: [0.72, 0.72, 0.7]
};

// roof:material -> a representative ROOF colour.
export const MATERIAL_ROOF = {
  roof_tiles: [0.55, 0.28, 0.2],
  tile: [0.55, 0.28, 0.2],
  tiles: [0.55, 0.28, 0.2],
  brick: [0.55, 0.28, 0.2],
  metal: [0.55, 0.57, 0.6],
  metal_sheet: [0.55, 0.57, 0.6],
  tin: [0.6, 0.61, 0.62],
  cgi: [0.58, 0.59, 0.6],
  zinc: [0.55, 0.57, 0.6],
  zink: [0.55, 0.57, 0.6],
  concrete: [0.48, 0.48, 0.47],
  rcc: [0.48, 0.48, 0.47],
  asbestos: [0.5, 0.5, 0.49],
  eternit: [0.5, 0.5, 0.49],
  gravel: [0.45, 0.44, 0.42],
  stone: [0.5, 0.48, 0.44],
  tar_paper: [0.3, 0.3, 0.32],
  asphalt: [0.3, 0.3, 0.32],
  asphalt_shingle: [0.32, 0.31, 0.32],
  slate: [0.28, 0.29, 0.33],
  glass: [0.5, 0.6, 0.68],
  thatch: [0.6, 0.5, 0.3],
  grass: [0.3, 0.4, 0.2],
  wood: [0.52, 0.4, 0.28],
  copper: [0.3, 0.55, 0.5], // weathered verdigris - the iconic green
  plaster: [0.8, 0.78, 0.72]
};

const hexTo = (h) => {
  let s = h.slice(1);
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  if (s.length !== 6 || /[^0-9a-f]/.test(s)) return null;
  return [
    parseInt(s.slice(0, 2), 16) / 255,
    parseInt(s.slice(2, 4), 16) / 255,
    parseInt(s.slice(4, 6), 16) / 255
  ];
};

// An OSM colour value (hex #rgb / #rrggbb, or a CSS/German name) -> an
// sRGB triple (0-1), or null if unparseable. Named colours are matched
// case-insensitively with separators (spaces, underscores, hyphens)
// stripped, so "Light_Grey" == "light grey" == "lightgrey".
export function parseColour(str) {
  if (!str) return null;
  const raw = String(str).trim().toLowerCase();
  if (!raw) return null;
  if (raw[0] === '#') return hexTo(raw);
  const key = raw.replace(/[\s_-]/g, '');
  return NAMED[key] ? hexTo(NAMED[key]) : null;
}

// Normalise an OSM material value (lowercase, spaces -> underscores) so
// "Metal", "metal sheet" and "concrete masonry unit" match the tables.
const matKey = (v) =>
  String(v || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

// The WALL colour for a building's tags: the explicit building:colour
// when parseable, else the building:material tone, else null (caller
// keeps its hash-picked facade tint).
export function wallColour(tags) {
  if (!tags) return null;
  const c = parseColour(tags['building:colour'] || tags['building:color']);
  if (c) return c;
  return MATERIAL_WALL[matKey(tags['building:material'])] || null;
}

// The ROOF colour for a building's tags: the explicit roof:colour when
// parseable, else the roof:material tone, else null (caller keeps its
// default tiled/flat roof colour).
export function roofColour(tags) {
  if (!tags) return null;
  const c = parseColour(tags['roof:colour'] || tags['roof:color']);
  if (c) return c;
  return MATERIAL_ROOF[matKey(tags['roof:material'])] || null;
}
