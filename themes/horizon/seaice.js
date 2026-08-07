/**
 * seaice.js - white sea ice reflectance from the printed model,
 * stage 1 of the sea-ice pass (the polar ocean currently draws
 * liquid water year-round - the theme has measured snow for land
 * but no ice for the sea). This module is the optics; the GIBS
 * concentration feed and the drawn water blend are the named
 * next stage.
 *
 * Source, read in full: Malinka, Zege, Heygster & Istomina,
 * "Reflective properties of white sea ice and snow" (The
 * Cryosphere 10, 2541, 2016 - the author manuscript). White ice
 * is any ice topped by a granular scattering layer (drained melt
 * surface); its reflectance is closed-form in THREE parameters
 * (their Table 1): the layer optical thickness tau, the
 * effective grain size a (the mean chord of the ice-air random
 * mixture), and the yellow-substance absorption. The machinery
 * transcribed here:
 *  - Eq. 10: the Fresnel diffuse transmittance T_diff(n) closed
 *    form; the paper prints 1 - T_diff spanning 6.11e-2..6.95e-2
 *    over n = 1.300..1.334 (the gate holds the transcription to
 *    that printed interval).
 *  - Eqs. 7-9: the single-scattering albedo of the mixture,
 *    omega0 = 1 - x T_diff / (x + T_diff) with x = alpha n^2 a
 *    and alpha = 4 pi kappa / lambda.
 *  - Eqs. 20-21, 25, 29: the asymptotic albedos of the finite
 *    bright layer, G(theta) = (3/7)(1 + 2 cos theta),
 *    y = 4 sqrt((1-omega0)/(3(1-omega0 g))),
 *    gamma = sqrt(3(1-omega0)(1-omega0 g)),
 *      r(theta0) = sinh(gamma tau + y[1 - G(theta0)]) /
 *                  sinh(gamma tau + y),
 *      r_d = sinh(gamma tau) / sinh(gamma tau + y),
 *    with the printed mean cosine g ~ 0.67 of the ice-air
 *    mixture (their Sec. 2.2/3.3) - and the printed structural
 *    facts the gate holds: at 550 nm absorption is negligible
 *    and r_d collapses to Eq. 30's tau/(tau+4); the direct and
 *    diffuse albedos cross at theta0 = arccos(2/3) ~ 48 deg
 *    (their Sec. 4.2), which is EXACT here because
 *    G(arccos(2/3)) = 1.
 *  - The parameters: the conclusion prints ordinary bare white
 *    ice at tau = 7..15 with grains 1-4 mm (Table 2's typical
 *    white ice: tau 9.3-20, a 2.2-2.8 mm, yellow substance
 *    negligible in the pure cases) - the drawn ice carries the
 *    log-mid of the printed ranges, pure (alpha_y = 0, a stated
 *    reduction backed by the printed pure-case values ~1e-4).
 *
 * Ice optical constants: Warren & Brandt 2008 (JGR 113, D14220,
 * "Optical constants of ice from the ultraviolet to the
 * microwave: a revised compilation") - the rows at the theme's
 * three channels VERBATIM from the published ASCII table
 * (atmos.uw.edu/ice_optical_constants, fetched 2026-08-07).
 */

// [lambda nm, n, kappa] - Warren & Brandt 2008 table rows.
export const ICE_NK = [
  [680, 1.3073, 2.09e-8],
  [550, 1.311, 2.289e-9],
  [440, 1.3163, 6.268e-11]
];

// Malinka 2016, printed white-ice parameter ranges (log-mids).
export const WHITE_ICE_TAU_RANGE = [7, 15];
export const WHITE_ICE_A_RANGE_MM = [1, 4];
export const WHITE_ICE_TAU = Math.sqrt(
  WHITE_ICE_TAU_RANGE[0] * WHITE_ICE_TAU_RANGE[1]
);
export const WHITE_ICE_A_M =
  Math.sqrt(WHITE_ICE_A_RANGE_MM[0] * WHITE_ICE_A_RANGE_MM[1]) * 1e-3;
export const ICE_G = 0.67; // printed mean cosine of the mixture

// Eq. 10: Fresnel transmittance of diffuse light through the
// air-ice boundary, closed form in the real index n.
export function tDiff(n) {
  const n2 = n * n;
  const n3 = n2 * n;
  const n4 = n2 * n2;
  const n5 = n4 * n;
  const n6 = n4 * n2;
  return (
    (2 * (5 * n6 + 8 * n5 + 6 * n4 - 5 * n3 - n - 1)) /
      (3 * (n3 + n2 + n + 1) * (n4 - 1)) +
    ((n2 * (n2 - 1) * (n2 - 1)) / Math.pow(n2 + 1, 3)) *
      Math.log((n + 1) / (n - 1)) -
    ((8 * n4 * (n4 + 1)) / ((n4 - 1) * (n4 - 1) * (n2 + 1))) * Math.log(n)
  );
}

// Eqs. 7-9: single-scattering albedo of the ice-air mixture at
// channel c for grain size aM (m).
export function iceOmega0(c, aM = WHITE_ICE_A_M) {
  const [nm, n, kappa] = ICE_NK[c];
  const alpha = (4 * Math.PI * kappa) / (nm * 1e-9);
  const x = alpha * n * n * aM;
  const T = tDiff(n);
  return 1 - (x * T) / (x + T);
}

// Eqs. 20/25 helpers at channel c.
function yGamma(c, aM) {
  const w0 = iceOmega0(c, aM);
  const y = 4 * Math.sqrt((1 - w0) / (3 * (1 - w0 * ICE_G)));
  const gamma = Math.sqrt(3 * (1 - w0) * (1 - w0 * ICE_G));
  return {y, gamma};
}

// Eq. 20: the escape function.
export function iceGFn(cosTheta) {
  return (3 / 7) * (1 + 2 * cosTheta);
}

// Eq. 29: bihemispherical (diffuse-incidence) albedo.
export function iceAlbedoDiffuse(c, tau = WHITE_ICE_TAU, aM = WHITE_ICE_A_M) {
  const {y, gamma} = yGamma(c, aM);
  return Math.sinh(gamma * tau) / Math.sinh(gamma * tau + y);
}

// Eq. 29: directional-hemispherical albedo at solar cosine.
export function iceAlbedoDirect(
  c,
  cosTheta0,
  tau = WHITE_ICE_TAU,
  aM = WHITE_ICE_A_M
) {
  const {y, gamma} = yGamma(c, aM);
  return (
    Math.sinh(gamma * tau + y * (1 - iceGFn(cosTheta0))) /
    Math.sinh(gamma * tau + y)
  );
}

// ---- stage 2: the measured concentration feed and the display
// frame ----
// NASA GIBS GHRSST_L4_MUR25_Sea_Ice_Concentration (the MUR L4
// analysis's ice field; daily, keyless, epsg3857 Level6
// verified live - the AMSR2 12 km layer ended 2025-09-01 and
// was rejected). The published colormap (v1.3, fetched
// 2026-08-07) is 100 one-percent bins [k, k+1) with unique
// colours - vendored verbatim, [r, g, b, k].
export const SEAICE_LAYER = 'GHRSST_L4_MUR25_Sea_Ice_Concentration';
export const SEAICE_Z = 6; // GoogleMapsCompatible_Level6
export const ICE_CONC_RGB = [
  [17, 17, 17, 0],
  [14, 0, 14, 1],
  [28, 0, 28, 2],
  [50, 0, 50, 3],
  [64, 0, 64, 4],
  [78, 0, 78, 5],
  [99, 0, 99, 6],
  [113, 0, 113, 7],
  [135, 0, 135, 8],
  [149, 0, 149, 9],
  [163, 0, 163, 10],
  [184, 0, 184, 11],
  [198, 0, 198, 12],
  [220, 0, 220, 13],
  [234, 0, 234, 14],
  [248, 0, 248, 15],
  [241, 0, 255, 16],
  [227, 0, 255, 17],
  [205, 0, 255, 18],
  [191, 0, 255, 19],
  [177, 0, 255, 20],
  [156, 0, 255, 21],
  [142, 0, 255, 22],
  [127, 0, 255, 23],
  [106, 0, 255, 24],
  [92, 0, 255, 25],
  [71, 0, 255, 26],
  [57, 0, 255, 27],
  [42, 0, 255, 28],
  [21, 0, 255, 29],
  [7, 0, 255, 30],
  [0, 16, 255, 31],
  [0, 33, 255, 32],
  [0, 49, 255, 33],
  [0, 74, 255, 34],
  [0, 90, 255, 35],
  [0, 115, 255, 36],
  [0, 132, 255, 37],
  [0, 148, 255, 38],
  [0, 173, 255, 39],
  [0, 189, 255, 40],
  [0, 206, 255, 41],
  [0, 230, 255, 42],
  [0, 247, 255, 43],
  [0, 250, 241, 44],
  [0, 246, 227, 45],
  [0, 241, 212, 46],
  [0, 234, 191, 47],
  [0, 229, 177, 48],
  [0, 222, 156, 49],
  [0, 217, 142, 50],
  [0, 212, 127, 51],
  [0, 205, 106, 52],
  [0, 201, 92, 53],
  [0, 194, 71, 54],
  [0, 189, 57, 55],
  [0, 184, 42, 56],
  [0, 177, 21, 57],
  [0, 172, 7, 58],
  [15, 175, 0, 59],
  [30, 180, 0, 60],
  [45, 185, 0, 61],
  [68, 193, 0, 62],
  [83, 198, 0, 63],
  [98, 203, 0, 64],
  [120, 210, 0, 65],
  [135, 215, 0, 66],
  [158, 223, 0, 67],
  [173, 228, 0, 68],
  [188, 233, 0, 69],
  [210, 240, 0, 70],
  [225, 245, 0, 71],
  [248, 253, 0, 72],
  [255, 248, 0, 73],
  [255, 234, 0, 74],
  [255, 212, 0, 75],
  [255, 198, 0, 76],
  [255, 177, 0, 77],
  [255, 163, 0, 78],
  [255, 149, 0, 79],
  [255, 127, 0, 80],
  [255, 113, 0, 81],
  [255, 99, 0, 82],
  [255, 78, 0, 83],
  [255, 64, 0, 84],
  [255, 42, 0, 85],
  [255, 28, 0, 86],
  [255, 14, 0, 87],
  [255, 9, 9, 88],
  [255, 26, 26, 89],
  [255, 51, 51, 90],
  [255, 68, 68, 91],
  [255, 85, 85, 92],
  [255, 111, 111, 93],
  [255, 128, 128, 94],
  [255, 153, 153, 95],
  [255, 170, 170, 96],
  [255, 187, 187, 97],
  [255, 213, 213, 98],
  [255, 230, 230, 99]
];

const CONC_LUT = new Map();
for (let i = 0; i < ICE_CONC_RGB.length; i++) {
  const [r, g, b] = ICE_CONC_RGB[i];
  CONC_LUT.set((r << 16) | (g << 8) | b, i);
}

// One pixel -> concentration fraction (bin centre). -1 =
// unknown (no data / land / unlisted colour).
export function iceConcOfRGBA(r, g, b, a) {
  if (a < 255) return -1;
  const i = CONC_LUT.get((r << 16) | (g << 8) | b);
  if (i === undefined) return -1;
  return (i + 0.5) / 100;
}

// Neighbourhood mean around a global pixel at SEAICE_Z: unknown
// cells are SKIPPED (land, gaps); no valid cell at all returns
// -1 and the feature stays off.
export function sampleIceConc(pxAt, px, py, half = 16) {
  let sum = 0;
  let n = 0;
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const p = pxAt(px + dx, py + dy);
      if (!p) continue;
      const v = iceConcOfRGBA(p[0], p[1], p[2], p[3]);
      if (v >= 0) {
        sum += v;
        n++;
      }
    }
  }
  return n ? sum / n : -1;
}

// The drawn ice colour in the water body's own display frame:
// the diffuse white-ice albedo (Eq. 29 at the printed
// parameters) times the SAME BODY_GAIN scalar the Morel body
// colour rides (ocean-color.js) - reflectance in, display out,
// no new constant.
import {BODY_GAIN} from './ocean-color.js';
export function iceDisplayRGB() {
  return [
    iceAlbedoDiffuse(0) * BODY_GAIN,
    iceAlbedoDiffuse(1) * BODY_GAIN,
    iceAlbedoDiffuse(2) * BODY_GAIN
  ];
}
