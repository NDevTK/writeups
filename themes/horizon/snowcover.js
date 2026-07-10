/**
 * snowcover.js - MEASURED snow on the terrain. The snowline was a
 * heuristic (the freezing level); NASA GIBS serves the daily
 * measured answer: MODIS_Terra_NDSI_Snow_Cover, the standard
 * MODIS snow product (Hall, Riggs & Salomonson - NDSI scaled
 * 1..100 per pixel), as palettized PNGs over the SAME keyless
 * WMTS the Black Marble night lights use. The published colormap
 * is embedded VERBATIM below (v1.3, fetched 2026-07-10) and
 * inverted exactly; NDSI becomes fractional snow cover through
 * the Salomonson & Appel (2004, RSE 89) regression
 *   FSC = -0.01 + 1.45 NDSI   (clamped [0, 1])
 * - the published MODIS fractional-snow algorithm, followed as
 * printed. Flags stay flags: cloud, night, water and no-data mark
 * a cell UNKNOWN (-1) and the freezing-level heuristic keeps
 * standing there - measurement where the satellite saw ground,
 * the old rule where it did not.
 */

import {sceneToGeo} from './roam.js';
import {pixelOf} from './nightlights.js';

export const SNOW_LAYER = 'MODIS_Terra_NDSI_Snow_Cover';
export const SNOW_Z = 8; // GoogleMapsCompatible_Level8 (native max)

// The published NDSI ramp, verbatim: row k = sourceValue k+1
// (NDSI x 100), rgb as GIBS paints it. Not a formula - the ramp
// steps its green channel in bands and cycles blue, so the exact
// table IS the inversion.
export const NDSI_RGB = [
  [240, 240, 128],
  [240, 240, 129],
  [240, 240, 130],
  [240, 240, 131],
  [240, 240, 132],
  [240, 240, 133],
  [240, 240, 134],
  [240, 240, 135],
  [240, 240, 136],
  [240, 240, 137],
  [240, 240, 138],
  [240, 240, 139],
  [240, 240, 140],
  [240, 240, 141],
  [240, 240, 142],
  [240, 240, 143],
  [240, 240, 144],
  [240, 240, 145],
  [240, 240, 146],
  [240, 240, 147],
  [240, 210, 128],
  [240, 210, 129],
  [240, 210, 130],
  [240, 210, 131],
  [240, 210, 132],
  [240, 210, 133],
  [240, 210, 134],
  [240, 210, 135],
  [240, 210, 136],
  [240, 210, 137],
  [240, 210, 138],
  [240, 210, 139],
  [240, 210, 140],
  [240, 210, 141],
  [240, 210, 142],
  [240, 210, 143],
  [240, 210, 144],
  [240, 210, 145],
  [240, 210, 146],
  [240, 210, 147],
  [240, 180, 128],
  [240, 180, 129],
  [240, 180, 130],
  [240, 180, 131],
  [240, 180, 132],
  [240, 180, 133],
  [240, 180, 134],
  [240, 180, 135],
  [240, 180, 136],
  [240, 180, 137],
  [240, 180, 138],
  [240, 180, 139],
  [240, 180, 140],
  [240, 180, 141],
  [240, 180, 142],
  [240, 180, 143],
  [240, 180, 144],
  [240, 180, 145],
  [240, 180, 146],
  [240, 180, 147],
  [240, 150, 128],
  [240, 150, 129],
  [240, 150, 130],
  [240, 150, 131],
  [240, 150, 132],
  [240, 150, 133],
  [240, 150, 134],
  [240, 150, 135],
  [240, 150, 136],
  [240, 150, 137],
  [240, 150, 138],
  [240, 150, 139],
  [240, 150, 140],
  [240, 150, 141],
  [240, 150, 142],
  [240, 150, 143],
  [240, 150, 144],
  [240, 150, 145],
  [240, 150, 146],
  [240, 150, 147],
  [240, 120, 128],
  [240, 121, 128],
  [240, 122, 128],
  [240, 123, 128],
  [240, 124, 128],
  [240, 125, 128],
  [240, 126, 128],
  [240, 127, 128],
  [240, 128, 128],
  [240, 128, 129],
  [240, 129, 129],
  [240, 129, 130],
  [240, 130, 130],
  [240, 130, 131],
  [240, 131, 131],
  [240, 131, 132],
  [240, 132, 132],
  [240, 132, 133],
  [240, 133, 133],
  [255, 0, 0]
];

// The transparent classes (alpha 0 in the tiles, RGB distinct):
// 0 = snow-free ground, 211 night, 237 inland water, 239 ocean,
// 250 cloud, 254 detector saturated, 255 no data.
export const FLAG_RGB = new Map([
  ['0,255,0', 0],
  ['255,200,255', 200],
  ['200,200,200', 201],
  ['189,0,189', 211],
  ['0,0,255', 237],
  ['35,35,117', 239],
  ['0,191,255', 250],
  ['170,0,0', 254],
  ['255,255,255', 255]
]);

// rgb -> sourceValue for the opaque ramp.
const RAMP = new Map(
  NDSI_RGB.map(([r, g, b], k) => [r + ',' + g + ',' + b, k + 1])
);

/**
 * One tile pixel [r,g,b,a] -> {kind, v}:
 *  - {kind: 'ndsi', v}   opaque ramp, v = NDSI in [0.01..1]
 *  - {kind: 'clear'}     measured snow-free ground (value 0)
 *  - {kind: 'unknown', flag} cloud/night/water/no-data - the
 *    satellite did not see the ground here
 */
export function classifyPixel(p) {
  if (!p) return {kind: 'unknown', flag: -1};
  const [r, g, b, a] = p;
  if (a > 0) {
    const v = RAMP.get(r + ',' + g + ',' + b);
    return v ? {kind: 'ndsi', v: v / 100} : {kind: 'unknown', flag: -1};
  }
  const f = FLAG_RGB.get(r + ',' + g + ',' + b);
  if (f === 0) return {kind: 'clear'};
  return {kind: 'unknown', flag: f ?? -1};
}

// Salomonson & Appel (2004): fractional snow cover from NDSI -
// the published regression, clamped to the physical range.
export function fscOf(ndsi) {
  return Math.min(1, Math.max(0, -0.01 + 1.45 * ndsi));
}

/**
 * The snow field over the roam box: an n x n grid of fractional
 * snow cover sampled through the SAME Earth anchoring as the
 * terrain (roam.sceneToGeo, gated) and the night lights' gated
 * web-mercator pixel mapping. Cell values: FSC in [0, 1] where
 * the satellite saw ground, -1 where it did not (cloud, night,
 * water, no data). sample(ix, iy) -> [r,g,b,a] of a global
 * integer pixel or null off the fetched tiles. Returns {data, n,
 * known, snowy}: known = share of cells the satellite answered,
 * snowy = mean FSC over the known cells. Row 0 = SOUTH edge (the
 * terrain shader's v = 0.5 - z/world orientation).
 */
export function snowField(sample, anchor, world, n) {
  const data = new Float32Array(n * n).fill(-1);
  let known = 0;
  let sum = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * world - world / 2;
      const z = ((j + 0.5) / n) * world - world / 2;
      const g = sceneToGeo(x, z, anchor);
      const p = pixelOf(g.lat, g.lon, SNOW_Z);
      const c = classifyPixel(sample(Math.floor(p.px), Math.floor(p.py)));
      const row = n - 1 - j;
      if (c.kind === 'ndsi') {
        const f = fscOf(c.v);
        data[row * n + i] = f;
        known++;
        sum += f;
      } else if (c.kind === 'clear') {
        data[row * n + i] = 0;
        known++;
      }
    }
  }
  return {
    data,
    n,
    known: known / (n * n),
    snowy: known ? sum / known : 0
  };
}
