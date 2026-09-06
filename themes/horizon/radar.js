/**
 * Weather-radar decode and Z-R inversion - the single source shared
 * by the theme's radar sync (Horizon.html) and the reference
 * printer (radar-reference.mjs).
 *
 *  - RainViewer tile encoding. Their documented black-and-white
 *    "dBZ values" scheme (colour 0) carries reflectivity in the RED
 *    channel, dBZ = (R & 127) - 32 over -32..95 dBZ, bit 7 flagging
 *    SNOW (decodeRed). MEASURED on 2026-09-06 (164th pass): the
 *    public v2 tiles serve the UNIVERSAL BLUE palette whatever colour
 *    index the URL asks (nine indices, one identical tile), so the
 *    red-channel rule read a 24-dBZ blue (0,127,180) as -32 dBZ and
 *    the light 15-dBZ blues (R 136) as snow. The palette is vendored
 *    verbatim from RainViewer's own colour table and decoded by
 *    exact colour, nearest colour for a resampled pixel
 *    (decodeUniversalBlue); a tile's scheme is told from its pixels
 *    (all-grey opaque = black-and-white). A transparent pixel is NO
 *    ECHO above the palette's floor (-32 dBZ in the grey scheme, -10
 *    dBZ in Universal Blue) - or no radar at all: only RainViewer's
 *    coverage mask (/v2/coverage/0, black = no radar) tells which,
 *    and windowStats takes it.
 *  - Rain: Marshall & Palmer (1948) Z = 200 R^1.6 (Z in mm^6/m^3,
 *    R in mm/h), inverted exactly: R = (10^(dBZ/10) / 200)^(1/1.6).
 *  - Snow: Sekhon & Srivastava (1970) Z = 1780 S^2.21 with S the
 *    liquid-equivalent rate (mm/h), inverted the same way.
 *  - Web Mercator tile math (the slippy-map standard): exact
 *    formulas for the tile and in-tile pixel of a lat/lon at zoom z.
 *
 * These are the classic operational relations; site-specific Z-R
 * variants exist (drop-size distributions vary by climate) but the
 * MP/SS pair is the published default the composite itself assumes.
 */

export const DBZ_MIN = -32;

// RainViewer BW scheme red channel -> {dbz, snow} (alpha handled by
// the caller: alpha 0 = no coverage).
export function decodeRed(r) {
  return {dbz: (r & 127) - 32, snow: (r & 128) === 128};
}

// Marshall-Palmer (1948) rain rate from reflectivity, mm/h.
export function rainRate(dbz) {
  if (dbz <= DBZ_MIN) return 0;
  const Z = Math.pow(10, dbz / 10);
  return Math.pow(Z / 200, 1 / 1.6);
}

// Sekhon-Srivastava (1970) snow rate (liquid equivalent), mm/h.
export function snowRate(dbz) {
  if (dbz <= DBZ_MIN) return 0;
  const Z = Math.pow(10, dbz / 10);
  return Math.pow(Z / 1780, 1 / 2.21);
}

// Forward relations, for the round-trip checks.
export function dbzOfRain(R) {
  return 10 * Math.log10(200 * Math.pow(R, 1.6));
}
export function dbzOfSnow(S) {
  return 10 * Math.log10(1780 * Math.pow(S, 2.21));
}

/**
 * Web Mercator: lat/lon (deg) at zoom z -> {tx, ty} tile indices and
 * {px, py} pixel within the 256px tile. Exact slippy-map formulas.
 */
export function tileAt(lat, lon, z) {
  const n = Math.pow(2, z);
  const xf = ((lon + 180) / 360) * n;
  const latR = (lat * Math.PI) / 180;
  const yf = ((1 - Math.asinh(Math.tan(latR)) / Math.PI) / 2) * n;
  const tx = Math.floor(xf);
  const ty = Math.floor(yf);
  return {
    tx,
    ty,
    px: Math.floor((xf - tx) * 256),
    py: Math.floor((yf - ty) * 256)
  };
}

// Ground metres per tile pixel at (lat, z) - for sizing the sampling
// window to the world footprint.
export function metresPerPixel(lat, z) {
  return (
    (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (Math.pow(2, z) * 256)
  );
}

// ---- THE PALETTE (164th pass) ----------------------------------
// RainViewer's Universal Blue colour table, vendored VERBATIM from
// https://www.rainviewer.com/api/color-schemes.html (the page's own
// colorData, column 'Universal Blue'; rows dBZ -32..95, RGBA hex).
// Index i is dBZ i - 32. Rain first, then the snow ramp.
export const UNIVERSAL_BLUE_RAIN = [
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '63615914',
  '66635a19',
  '69665c1e',
  '6c685d24',
  '6f6b5f29',
  '726e612e',
  '75706234',
  '78736439',
  '7c75653e',
  '7f786744',
  '827b6949',
  '857d6a4e',
  '88806c54',
  '8b826d59',
  '8e856f5e',
  '92887164',
  '9e93756e',
  'aa9e7978',
  'b6a97e82',
  'c2b4828c',
  'cec08796',
  'd2c48ba0',
  'd6c88faa',
  'dacc93b4',
  'ded097be',
  '88ddeeff',
  '6cd1ebff',
  '51c5e8ff',
  '36bae5ff',
  '1baee2ff',
  '00a3e0ff',
  '009ad5ff',
  '0091caff',
  '0088bfff',
  '007fb4ff',
  '0077aaff',
  '0070a3ff',
  '00699cff',
  '006295ff',
  '005b8eff',
  '005588ff',
  '005180ff',
  '004e78ff',
  '004a70ff',
  '004768ff',
  'ffee00ff',
  'ffe000ff',
  'ffd200ff',
  'ffc500ff',
  'ffb700ff',
  'ffaa00ff',
  'ff9f00ff',
  'ff9500ff',
  'ff8b00ff',
  'ff8100ff',
  'ff4400ff',
  'f23600ff',
  'e62800ff',
  'd91b00ff',
  'cd0d00ff',
  'c10000ff',
  'a80000ff',
  '8f0000ff',
  '760000ff',
  '5d0000ff',
  'ffaaffff',
  'ff9fffff',
  'ff95ffff',
  'ff8bffff',
  'ff81ffff',
  'ff77ffff',
  'ff6cffff',
  'ff62ffff',
  'ff58ffff',
  'ff4effff',
  'ffffffff',
  'ffffffff',
  'ffffffff',
  'ffffffff',
  'ffffffff',
  'ffffffff',
  'ffffffff',
  'ffffffff',
  'ffffffff',
  'ffffffff',
  '00ff00ff',
  '00ff00ff',
  '00ff00ff',
  '00ff00ff',
  '00ff00ff',
  '00ff00ff',
  '00ff00ff',
  '00ff00ff',
  '00ff00ff',
  '00ff00ff',
  '00ff00ff',
  '00ff00ff',
  '00ff00ff',
  '00ff00ff',
  '00ff00ff',
  '00ff00ff',
  '00ff00ff',
  '00ff00ff',
  '00ff00ff',
  '00ff00ff',
  '00ff00ff'
];
export const UNIVERSAL_BLUE_SNOW = [
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  'cfffff00',
  'ceffff0c',
  'cdffff19',
  'ccffff26',
  'cbffff33',
  'cbffff3f',
  'caffff4c',
  'c9ffff59',
  'c8ffff66',
  'c7ffff72',
  'c7ffff7f',
  'c6ffff8c',
  'c5ffff99',
  'c4ffffa5',
  'c3ffffb2',
  'c3ffffbf',
  'c2ffffcc',
  'c1ffffd8',
  'c0ffffe5',
  'bffffff2',
  'bfffffff',
  'b8f8ffff',
  'b2f2ffff',
  'abebffff',
  'a5e5ffff',
  '9fdfffff',
  '98d8ffff',
  '92d2ffff',
  '8bcbffff',
  '85c5ffff',
  '7fbfffff',
  '78b8ffff',
  '72b2ffff',
  '6babffff',
  '65a5ffff',
  '5f9fffff',
  '5b9bffff',
  '5898ffff',
  '5595ffff',
  '5292ffff',
  '4f8fffff',
  '4b8bffff',
  '4888ffff',
  '4585ffff',
  '4282ffff',
  '3f7fffff',
  '3b7bffff',
  '3878ffff',
  '3575ffff',
  '3272ffff',
  '2f6fffff',
  '2b6bffff',
  '2868ffff',
  '2565ffff',
  '2262ffff',
  '1f5fffff',
  '1b5bffff',
  '1858ffff',
  '1555ffff',
  '1252ffff',
  '0f4fffff',
  '0c4bffff',
  '0948ffff',
  '0645ffff',
  '0242ffff',
  '003fffff',
  '003bffff',
  '0038ffff',
  '0035ffff',
  '0032ffff',
  '002fffff',
  '002bffff',
  '0028ffff',
  '0025ffff',
  '0022ffff',
  '001fffff',
  '001bffff',
  '0018ffff',
  '0015ffff',
  '0012ffff',
  '000fffff',
  '000cffff',
  '0009ffff',
  '0006ffff',
  '0002ffff',
  '0000ffff',
  '0000ffff',
  '0000ffff',
  '0000ffff',
  '0000ffff',
  '0000ffff',
  '0000ffff',
  '0000ffff',
  '0000ffff',
  '0000ffff',
  '0000ffff',
  '0000ffff',
  '0000ffff',
  '0000ffff',
  '0000ffff',
  '0000ffff',
  '0000ffff',
  '0000ffff',
  '0000ffff',
  '0000ffff',
  '0000ffff'
];

const hexRgba = (h) => [
  parseInt(h.slice(0, 2), 16),
  parseInt(h.slice(2, 4), 16),
  parseInt(h.slice(4, 6), 16),
  parseInt(h.slice(6, 8), 16)
];
// exact colour -> {dbz, snow}; the list for the nearest-colour fall-back
const PALETTE = new Map();
const PALETTE_LIST = [];
for (const [arr, snow] of [
  [UNIVERSAL_BLUE_RAIN, false],
  [UNIVERSAL_BLUE_SNOW, true]
]) {
  arr.forEach((h, i) => {
    if (h === '00000000') return;
    const c = hexRgba(h);
    const key = c.join(',');
    if (!PALETTE.has(key)) PALETTE.set(key, {dbz: i - 32, snow});
    PALETTE_LIST.push({c, dbz: i - 32, snow});
  });
}
// the palette's floor: the first dBZ drawn at all (below it the
// tile is transparent, like no radar)
export const UNIVERSAL_BLUE_FLOOR_DBZ =
  UNIVERSAL_BLUE_RAIN.findIndex((h) => h !== '00000000') - 32;
export const PALETTE_COLOURS = PALETTE.size;

/**
 * A Universal Blue pixel -> {dbz, snow, exact, dist}: transparent
 * is no echo (dbz = DBZ_MIN); a colour in the table decodes exactly;
 * any other (a resampled or antialiased pixel) takes the nearest
 * table colour in RGBA, its distance stated.
 */
export function decodeUniversalBlue(r, g, b, a) {
  if (a === 0) return {dbz: DBZ_MIN, snow: false, exact: true, dist: 0};
  const hit = PALETTE.get(`${r},${g},${b},${a}`);
  if (hit) return {dbz: hit.dbz, snow: hit.snow, exact: true, dist: 0};
  let best = null;
  let bd = Infinity;
  for (const p of PALETTE_LIST) {
    const d =
      (p.c[0] - r) * (p.c[0] - r) +
      (p.c[1] - g) * (p.c[1] - g) +
      (p.c[2] - b) * (p.c[2] - b) +
      (p.c[3] - a) * (p.c[3] - a);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return {dbz: best.dbz, snow: best.snow, exact: false, dist: Math.sqrt(bd)};
}

/**
 * Which scheme a tile is drawn in, from its own pixels: every opaque
 * pixel grey (R = G = B) is the black-and-white dBZ scheme, any
 * colour is Universal Blue; null when nothing is drawn (no echo in
 * the tile, or no radar - the mask says).
 */
export function detectScheme(data) {
  let opaque = 0;
  let grey = 0;
  for (let k = 0; k < data.length; k += 4) {
    if (data[k + 3] === 0) continue;
    opaque++;
    if (data[k] === data[k + 1] && data[k + 1] === data[k + 2]) grey++;
  }
  if (!opaque) return null;
  return grey === opaque ? 'bw' : 'universal-blue';
}

/** One pixel of a tile in a scheme -> {dbz, snow}. */
export function decodePixel(data, k, scheme) {
  if (data[k + 3] === 0) return {dbz: DBZ_MIN, snow: false};
  return scheme === 'bw'
    ? decodeRed(data[k])
    : decodeUniversalBlue(data[k], data[k + 1], data[k + 2], data[k + 3]);
}

/**
 * Reduce a tile region to precipitation statistics over the COVERED
 * pixels of a (2h+1)^2 window clamped to the tile: the areal mean
 * rain and snow rates (a covered pixel without echo counts as 0 -
 * the mean over the ground, not over the echoes), the echo fraction,
 * the coverage from RainViewer's mask tile when given (its
 * transparent pixels are covered, its black ones are not; without a
 * mask every pixel counts as covered), the snow fraction of the
 * echoes, the window's maximum rate and the pixel at (px, py) itself
 * (`here`, null when uncovered). The scheme is detected from the
 * tile unless given. `data` and `mask` are 256 x 256 RGBA bytes.
 */
export function windowStats(
  data,
  px,
  py,
  h,
  {scheme = null, mask = null} = {}
) {
  const sch = scheme ?? detectScheme(data) ?? 'universal-blue';
  let rain = 0;
  let snow = 0;
  let covered = 0;
  let echo = 0;
  let snowy = 0;
  let total = 0;
  let maxRate = 0;
  let here = null;
  for (let j = Math.max(py - h, 0); j <= Math.min(py + h, 255); j++) {
    for (let i = Math.max(px - h, 0); i <= Math.min(px + h, 255); i++) {
      total++;
      const k = (j * 256 + i) * 4;
      if (mask && mask[k + 3] !== 0) continue; // the mask's black: no radar
      covered++;
      const d = decodePixel(data, k, sch);
      const rate = d.snow ? snowRate(d.dbz) : rainRate(d.dbz);
      if (data[k + 3] !== 0) echo++;
      if (d.snow) {
        snowy++;
        snow += rate;
      } else rain += rate;
      if (rate > maxRate) maxRate = rate;
      if (i === px && j === py) here = {dbz: d.dbz, snow: d.snow, rate};
    }
  }
  return {
    scheme: sch,
    rain: covered ? rain / covered : 0,
    snow: covered ? snow / covered : 0,
    coverage: total ? covered / total : 0,
    echoFrac: covered ? echo / covered : 0,
    snowFrac: echo ? snowy / echo : 0,
    maxRate,
    here,
    total,
    covered
  };
}
