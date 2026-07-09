/**
 * nightlights.js - the ground under the skyglow: NASA Black Marble
 * measured nighttime lights on the terrain. The theme's Falchi
 * light-pollution atlas (skyglow.js) is DERIVED from VIIRS DNB
 * radiances - this module puts the SOURCE on the ground, so the
 * valley towns glow exactly where the sky above them does.
 *
 * Feed: GIBS WMTS (CORS *, keyless), layer
 * VIIRS_SNPP_GapFilled_BRDF_Corrected_DayNightBand_Radiance - the
 * daily gap-filled, BRDF-corrected, moonlight-removed Black Marble
 * science product (VNP46A2; Roman et al. 2018, RSE 210). Tiles are
 * palettized PNGs whose published GIBS colormap is an EXACT
 * data-to-gray mapping in nW/(cm^2 sr) - inverting it recovers
 * calibrated radiance, so town brightness here is measured, linear
 * and comparable town to town. One published-typo correction is
 * documented at the table.
 *
 * The lamp tint is not measured (DNB is panchromatic): a 2700 K
 * Planckian white point via the Kang et al. (2002) CCT->xy
 * approximation and the sRGB primaries - a documented rendering
 * choice, computed (and gated) rather than eyeballed.
 */

import {sceneToGeo} from './roam.js';

export const NL_Z = 8; // GoogleMapsCompatible_Level8 (native max)
export const NL_LAYER =
  'VIIRS_SNPP_GapFilled_BRDF_Corrected_DayNightBand_Radiance';

// GIBS colormap VIIRS_DayNightBand_At_Sensor_Radiance (v1.3):
// [gray, lo, hi) radiance bins in nW/(cm^2 sr). Gray 166's
// published upper edge reads 100.0 amid a 0.1-wide ramp whose next
// bin starts at 10.0 - the one demonstrable typo, corrected here
// (the contiguity landmark would fail otherwise). RGB 0,0,160
// (palette index 0, transparent) is the no-data fill.
export const DNB_BINS = [
  [7, 0, 0.1],
  [13, 0.1, 0.2],
  [19, 0.2, 0.3],
  [24, 0.3, 0.4],
  [29, 0.4, 0.5],
  [33, 0.5, 0.6],
  [37, 0.6, 0.7],
  [41, 0.7, 0.8],
  [45, 0.8, 0.9],
  [48, 0.9, 1],
  [52, 1, 1.1],
  [55, 1.1, 1.2],
  [58, 1.2, 1.3],
  [61, 1.3, 1.4],
  [64, 1.4, 1.5],
  [67, 1.5, 1.6],
  [69, 1.6, 1.7],
  [72, 1.7, 1.8],
  [74, 1.8, 1.9],
  [77, 1.9, 2],
  [79, 2, 2.1],
  [81, 2.1, 2.2],
  [83, 2.2, 2.3],
  [85, 2.3, 2.4],
  [87, 2.4, 2.5],
  [89, 2.5, 2.6],
  [91, 2.6, 2.7],
  [93, 2.7, 2.8],
  [95, 2.8, 2.9],
  [96, 2.9, 3],
  [98, 3, 3.1],
  [100, 3.1, 3.2],
  [101, 3.2, 3.3],
  [103, 3.3, 3.4],
  [105, 3.4, 3.5],
  [106, 3.5, 3.6],
  [108, 3.6, 3.7],
  [109, 3.7, 3.8],
  [111, 3.8, 3.9],
  [112, 3.9, 4],
  [113, 4, 4.1],
  [115, 4.1, 4.2],
  [116, 4.2, 4.3],
  [117, 4.3, 4.4],
  [118, 4.4, 4.5],
  [120, 4.5, 4.6],
  [121, 4.6, 4.7],
  [122, 4.7, 4.8],
  [123, 4.8, 4.9],
  [125, 4.9, 5],
  [126, 5, 5.1],
  [127, 5.1, 5.2],
  [128, 5.2, 5.3],
  [129, 5.3, 5.4],
  [130, 5.4, 5.5],
  [131, 5.5, 5.6],
  [132, 5.6, 5.7],
  [133, 5.7, 5.8],
  [134, 5.8, 5.9],
  [135, 5.9, 6],
  [136, 6, 6.1],
  [137, 6.1, 6.2],
  [138, 6.2, 6.3],
  [139, 6.3, 6.4],
  [140, 6.4, 6.5],
  [141, 6.5, 6.6],
  [142, 6.6, 6.7],
  [143, 6.7, 6.8],
  [144, 6.8, 7],
  [145, 7, 7.1],
  [146, 7.1, 7.2],
  [147, 7.2, 7.3],
  [148, 7.3, 7.4],
  [149, 7.4, 7.6],
  [150, 7.6, 7.7],
  [151, 7.7, 7.8],
  [152, 7.8, 7.9],
  [153, 7.9, 8.1],
  [154, 8.1, 8.2],
  [155, 8.2, 8.3],
  [156, 8.3, 8.5],
  [157, 8.5, 8.6],
  [158, 8.6, 8.8],
  [159, 8.8, 8.9],
  [160, 8.9, 9],
  [161, 9, 9.2],
  [162, 9.2, 9.3],
  [163, 9.3, 9.5],
  [164, 9.5, 9.6],
  [165, 9.6, 9.8],
  [166, 9.8, 10],
  [167, 10, 10.1],
  [168, 10.1, 10.3],
  [169, 10.3, 10.4],
  [170, 10.4, 10.6],
  [171, 10.6, 10.8],
  [172, 10.8, 11],
  [173, 11, 11.1],
  [174, 11.1, 11.3],
  [175, 11.3, 11.5],
  [176, 11.5, 11.7],
  [177, 11.7, 11.8],
  [178, 11.8, 12],
  [179, 12, 12.2],
  [180, 12.2, 12.4],
  [181, 12.4, 12.6],
  [182, 12.6, 12.8],
  [183, 12.8, 13],
  [184, 13, 13.2],
  [185, 13.2, 13.4],
  [186, 13.4, 13.6],
  [187, 13.6, 13.9],
  [188, 13.9, 14.1],
  [189, 14.1, 14.3],
  [190, 14.3, 14.5],
  [191, 14.5, 14.7],
  [192, 14.7, 15],
  [193, 15, 15.2],
  [194, 15.2, 15.4],
  [195, 15.4, 15.7],
  [196, 15.7, 15.9],
  [197, 15.9, 16.2],
  [198, 16.2, 16.4],
  [199, 16.4, 16.7],
  [200, 16.7, 16.9],
  [201, 16.9, 17.2],
  [202, 17.2, 17.5],
  [203, 17.5, 17.7],
  [204, 17.7, 18],
  [205, 18, 18.3],
  [206, 18.3, 18.6],
  [207, 18.6, 18.8],
  [208, 18.8, 19.1],
  [209, 19.1, 19.4],
  [210, 19.4, 19.7],
  [211, 19.7, 20],
  [212, 20, 20.3],
  [213, 20.3, 20.7],
  [214, 20.7, 21],
  [215, 21, 21.3],
  [216, 21.3, 21.6],
  [217, 21.6, 21.9],
  [218, 21.9, 22.3],
  [219, 22.3, 22.6],
  [220, 22.6, 23],
  [221, 23, 23.3],
  [222, 23.3, 23.7],
  [223, 23.7, 24],
  [224, 24, 24.4],
  [225, 24.4, 24.8],
  [226, 24.8, 25.1],
  [227, 25.1, 25.5],
  [228, 25.5, 25.9],
  [229, 25.9, 26.3],
  [230, 26.3, 26.7],
  [231, 26.7, 27.1],
  [232, 27.1, 27.5],
  [233, 27.5, 27.9],
  [234, 27.9, 28.3],
  [235, 28.3, 28.8],
  [236, 28.8, 29.2],
  [237, 29.2, 29.6],
  [238, 29.6, 30.1],
  [239, 30.1, 30.5],
  [240, 30.5, 31],
  [241, 31, 31.5],
  [242, 31.5, 31.9],
  [243, 31.9, 32.4],
  [244, 32.4, 32.9],
  [245, 32.9, 33.4],
  [246, 33.4, 33.9],
  [247, 33.9, 34.4],
  [248, 34.4, 34.9],
  [249, 34.9, 35.5],
  [250, 35.5, 36],
  [251, 36, 36.5],
  [252, 36.5, 37.1],
  [253, 37.1, 37.6],
  [254, 37.6, 38.2],
  [255, 38.2, 999999]
];

const BY_GRAY = new Map(DNB_BINS.map(([g, lo, hi]) => [g, [lo, hi]]));

/**
 * Calibrated radiance (nW/(cm^2 sr)) from a decoded tile pixel.
 * Bin value: the midpoint of [lo, hi); the open top bin [38.2,
 * inf) reads its lower edge. Non-colormap colors (no-data fill,
 * canvas-filtered edges) are NaN - the field builder skips them.
 */
export function radianceFromRGB(r, g, b, a) {
  if (a !== undefined && a < 255) return NaN;
  if (r !== g || g !== b) return NaN;
  const bin = BY_GRAY.get(r);
  if (!bin) return NaN;
  return bin[1] > 1000 ? bin[0] : (bin[0] + bin[1]) / 2;
}

/**
 * Global fractional pixel coordinates of (lat, lon) on the z-level
 * web-mercator pixel grid (256-px tiles); tile = floor(px/256).
 */
export function pixelOf(lat, lon, z = NL_Z) {
  const n = 2 ** z * 256;
  const px = ((lon + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const py = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return {px, py, n};
}

/**
 * The radiance field over the roam box: an nxn grid of measured
 * radiances, sampled through the SAME Earth anchoring the terrain
 * uses (roam.sceneToGeo, gated) and NaN-aware bilinear on RADIANCE
 * (never on gray - the colormap is non-linear). `sample(ix, iy)`
 * returns the [r,g,b,a] of a global integer pixel or null off the
 * fetched tiles. Returns {data, max, mean} (Float32Array n*n, row
 * j = south to north to match the terrain texture orientation).
 */
export function lightsField(sample, anchor, world, n, mpu) {
  const data = new Float32Array(n * n);
  let max = 0;
  let sum = 0;
  let cnt = 0;
  const rad = (ix, iy) => {
    const p = sample(ix, iy);
    return p ? radianceFromRGB(p[0], p[1], p[2], p[3]) : NaN;
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n - 0.5) * world;
      const z = (0.5 - (j + 0.5) / n) * world; // +j = north (+row)
      const g = sceneToGeo(x, z, anchor);
      const {px, py} = pixelOf(g.lat, g.lon);
      const ix = Math.floor(px - 0.5);
      const iy = Math.floor(py - 0.5);
      const fx = px - 0.5 - ix;
      const fy = py - 0.5 - iy;
      let v = 0;
      let w = 0;
      for (const [dx, dy, wq] of [
        [0, 0, (1 - fx) * (1 - fy)],
        [1, 0, fx * (1 - fy)],
        [0, 1, (1 - fx) * fy],
        [1, 1, fx * fy]
      ]) {
        const q = rad(ix + dx, iy + dy);
        if (Number.isFinite(q)) {
          v += q * wq;
          w += wq;
        }
      }
      const out = w > 0 ? v / w : 0;
      data[j * n + i] = out;
      if (out > max) max = out;
      sum += out;
      cnt++;
    }
  }
  return {data, max, mean: sum / cnt};
}

// ---- the lamp white point (documented choice, gated math) ----
// Kang et al. (2002): cubic approximations of the Planckian locus
// in CIE 1931 xy, valid 1667..25000 K.
export function planckianXY(T) {
  const t = 1 / T;
  const x =
    T <= 4000
      ? -0.2661239e9 * t * t * t -
        0.2343589e6 * t * t +
        0.8776956e3 * t +
        0.17991
      : -3.0258469e9 * t * t * t +
        2.1070379e6 * t * t +
        0.2226347e3 * t +
        0.24039;
  const x3 = x * x * x;
  const x2 = x * x;
  let y;
  if (T <= 2222)
    y = -1.1063814 * x3 - 1.3481102 * x2 + 2.18555832 * x - 0.20219683;
  else if (T <= 4000)
    y = -0.9549476 * x3 - 1.37418593 * x2 + 2.09137015 * x - 0.16748867;
  else y = 3.081758 * x3 - 5.8733867 * x2 + 3.75112997 * x - 0.37001483;
  return [x, y];
}

// xy (Y=1) -> linear sRGB, normalised so max component = 1.
export function xyToLinearSrgb(x, y) {
  const X = x / y;
  const Z = (1 - x - y) / y;
  const rgb = [
    3.2404542 * X - 1.5371385 + -0.4985314 * Z,
    -0.969266 * X + 1.8760108 + 0.041556 * Z,
    0.0556434 * X - 0.2040259 + 1.0572252 * Z
  ].map((v) => Math.max(v, 0));
  const m = Math.max(...rgb);
  return rgb.map((v) => v / m);
}

// The rendered lamp tint: 2700 K (warm white - the HPS-to-LED
// transition midpoint most streetlighting sits in; a rendering
// choice, stated, not physics).
export const LAMP_CCT = 2700;
export const LAMP_TINT = xyToLinearSrgb(...planckianXY(LAMP_CCT));
