// Ocean colour: the water-leaving body colour of a Case-1 sea, as the
// CIE tristimulus of its Morel & Maritorena [2001] irradiance
// reflectance R(lambda) (morel.js) seen under average daylight. This
// closes the chain from the daemon's measured chlorophyll to a single
// linear-sRGB colour the water shader tints the sea with, so a cell's
// hue is a physical consequence of its [Chl] - not a painted gradient.
//
// The stimulus is the reflected daylight Eu(lambda) = R(lambda) *
// Ed(lambda), with Ed the CIE standard illuminant D65 (the sRGB
// reference white), integrated against the CIE 1931 2 deg standard
// observer:
//   X = sum R*Ed*xbar,  Y = sum R*Ed*ybar,  Z = sum R*Ed*zbar
// normalised by N = sum Ed*ybar so a perfect diffuser (R = 1) returns
// Y = 1 - i.e. Y is the water's luminous reflectance (a few percent).
// XYZ -> linear sRGB is the IEC 61966-2-1 transform (Rec.709
// primaries, D65 white). The clearest water is a more saturated blue
// than sRGB can encode, so the out-of-gamut channel is clipped at zero.
//
// The two datasets are the canonical CVRL transcriptions (fetched
// 2026-07-11), resampled to the 5 nm grid 360-700 nm:
//   - CIE 1931 2 deg XYZ colour-matching functions  (ciexyz31_1.csv)
//   - CIE standard illuminant D65 relative SPD       (Illuminantd65.csv)
// The observer is negligible below 360 nm; seawater absorbs so
// strongly above 700 nm that R(lambda) ~ 0 there, so the truncated red
// tail carries no colour (the integrated D65 white point over this
// grid is 0.3125, 0.3290 vs the canonical 0.3127, 0.3290 - the 0.0002
// in x is exactly that dropped tail). ocean-color-reference.mjs holds
// the transcription to the white point, the observer peak and the
// blue-to-green ocean-colour progression.
//
// One global scalar - BODY_GAIN, calibrated once at REFERENCE_CHL - ties
// this physical body colour to the theme's tuned exposure (the prior
// hand-picked 0x0a2431 water luminance). It is an exposure anchor, not
// physics: the spectrum, the chromaticity, and the relative luminance
// between clear and bloom water are entirely the model's.

import {reflectanceSpectrum} from './morel.js';

// [lambda (nm), xbar, ybar, zbar, D65] on the 5 nm grid, 360-700 nm.
// D65 is the relative SPD normalised to 100 at 560 nm.
export const CIE_1931_2DEG = [
  [360, 0.00013, 0.000004, 0.000606, 46.6383],
  [365, 0.000232, 0.000007, 0.001086, 49.3637],
  [370, 0.000415, 0.000012, 0.001946, 52.0891],
  [375, 0.000742, 0.000022, 0.003486, 51.0323],
  [380, 0.001368, 0.000039, 0.00645, 49.9755],
  [385, 0.002236, 0.000064, 0.01055, 52.3118],
  [390, 0.004243, 0.00012, 0.02005, 54.6482],
  [395, 0.00765, 0.000217, 0.03621, 68.7015],
  [400, 0.01431, 0.000396, 0.06785, 82.7549],
  [405, 0.02319, 0.00064, 0.1102, 87.1204],
  [410, 0.04351, 0.00121, 0.2074, 91.486],
  [415, 0.07763, 0.00218, 0.3713, 92.4589],
  [420, 0.13438, 0.004, 0.6456, 93.4318],
  [425, 0.21477, 0.0073, 1.03905, 90.057],
  [430, 0.2839, 0.0116, 1.3856, 86.6823],
  [435, 0.3285, 0.01684, 1.62296, 95.7736],
  [440, 0.34828, 0.023, 1.74706, 104.865],
  [445, 0.34806, 0.0298, 1.7826, 110.936],
  [450, 0.3362, 0.038, 1.77211, 117.008],
  [455, 0.3187, 0.048, 1.7441, 117.41],
  [460, 0.2908, 0.06, 1.6692, 117.812],
  [465, 0.2511, 0.0739, 1.5281, 116.336],
  [470, 0.19536, 0.09098, 1.28764, 114.861],
  [475, 0.1421, 0.1126, 1.0419, 115.392],
  [480, 0.09564, 0.13902, 0.81295, 115.923],
  [485, 0.05795, 0.1693, 0.6162, 112.367],
  [490, 0.03201, 0.20802, 0.46518, 108.811],
  [495, 0.0147, 0.2586, 0.3533, 109.082],
  [500, 0.0049, 0.323, 0.272, 109.354],
  [505, 0.0024, 0.4073, 0.2123, 108.578],
  [510, 0.0093, 0.503, 0.1582, 107.802],
  [515, 0.0291, 0.6082, 0.1117, 106.296],
  [520, 0.06327, 0.71, 0.07825, 104.79],
  [525, 0.1096, 0.7932, 0.05725, 106.239],
  [530, 0.1655, 0.862, 0.04216, 107.689],
  [535, 0.22575, 0.91485, 0.02984, 106.047],
  [540, 0.2904, 0.954, 0.0203, 104.405],
  [545, 0.3597, 0.9803, 0.0134, 104.225],
  [550, 0.43345, 0.99495, 0.00875, 104.046],
  [555, 0.51205, 1, 0.00575, 102.023],
  [560, 0.5945, 0.995, 0.0039, 100],
  [565, 0.6784, 0.9786, 0.00275, 98.1671],
  [570, 0.7621, 0.952, 0.0021, 96.3342],
  [575, 0.8425, 0.9154, 0.0018, 96.0611],
  [580, 0.9163, 0.87, 0.00165, 95.788],
  [585, 0.9786, 0.8163, 0.0014, 92.2368],
  [590, 1.0263, 0.757, 0.0011, 88.6856],
  [595, 1.0567, 0.6949, 0.001, 89.3459],
  [600, 1.0622, 0.631, 0.0008, 90.0062],
  [605, 1.0456, 0.5668, 0.0006, 89.8026],
  [610, 1.0026, 0.503, 0.00034, 89.5991],
  [615, 0.9384, 0.4412, 0.00024, 88.6489],
  [620, 0.85445, 0.381, 0.00019, 87.6987],
  [625, 0.7514, 0.321, 0.0001, 85.4936],
  [630, 0.6424, 0.265, 0.00005, 83.2886],
  [635, 0.5419, 0.217, 0.00003, 83.4939],
  [640, 0.4479, 0.175, 0.00002, 83.6992],
  [645, 0.3608, 0.1382, 0.00001, 81.863],
  [650, 0.2835, 0.107, 0, 80.0268],
  [655, 0.2187, 0.0816, 0, 80.1207],
  [660, 0.1649, 0.061, 0, 80.2146],
  [665, 0.1212, 0.04458, 0, 81.2462],
  [670, 0.0874, 0.032, 0, 82.2778],
  [675, 0.0636, 0.0232, 0, 80.281],
  [680, 0.04677, 0.017, 0, 78.2842],
  [685, 0.0329, 0.01192, 0, 74.0027],
  [690, 0.0227, 0.00821, 0, 69.7213],
  [695, 0.01584, 0.005723, 0, 70.6652],
  [700, 0.011359, 0.004102, 0, 71.6091]
];

// XYZ (D65) -> linear sRGB, the IEC 61966-2-1 matrix (Rec.709
// primaries, D65 white; Lindbloom's tabulation).
export const XYZ_TO_LINEAR_SRGB = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.969266, 1.8760108, 0.041556],
  [0.0556434, -0.2040259, 1.0572252]
];

export const REFERENCE_CHL = 0.1; // mg m^-3 - the exposure-anchor cell
export const LEGACY_WATER_HEX = 0x0a2431; // the prior hand-picked body colour

const srgbDecode = (c) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
export const luminance = (rgb) =>
  0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];

// Linear luminance the sea had before this feature - the exposure the
// theme's tonemap was tuned against, which BODY_GAIN reproduces at
// REFERENCE_CHL.
export const TARGET_LUMINANCE = luminance([
  srgbDecode(((LEGACY_WATER_HEX >> 16) & 0xff) / 255),
  srgbDecode(((LEGACY_WATER_HEX >> 8) & 0xff) / 255),
  srgbDecode((LEGACY_WATER_HEX & 0xff) / 255)
]);

// Tristimulus of the D65-lit Case-1 reflectance for a chlorophyll
// concentration (mg m^-3), normalised so a perfect diffuser gives
// Y = 1. Y is then the water body's luminous reflectance.
export function chlToXYZ(chl) {
  const spec = reflectanceSpectrum(chl);
  const R = new Map(spec.map((s) => [s.nm, s.R]));
  let X = 0;
  let Y = 0;
  let Z = 0;
  let N = 0;
  for (const [nm, xb, yb, zb, ed] of CIE_1931_2DEG) {
    const r = R.get(nm);
    if (r === undefined) continue; // grid outside Table 2 (none here)
    X += r * ed * xb;
    Y += r * ed * yb;
    Z += r * ed * zb;
    N += ed * yb;
  }
  return {X: X / N, Y: Y / N, Z: Z / N};
}

// CIE xy chromaticity of the water colour (hue/saturation only).
export function chromaticity(chl) {
  const {X, Y, Z} = chlToXYZ(chl);
  const s = X + Y + Z;
  return {x: X / s, y: Y / s};
}

// XYZ -> linear sRGB, with the out-of-gamut channel clipped at zero
// (the clearest ocean blue lies just outside the sRGB triangle).
export function xyzToLinearSRGB({X, Y, Z}) {
  const m = XYZ_TO_LINEAR_SRGB;
  return [
    Math.max(0, m[0][0] * X + m[0][1] * Y + m[0][2] * Z),
    Math.max(0, m[1][0] * X + m[1][1] * Y + m[1][2] * Z),
    Math.max(0, m[2][0] * X + m[2][1] * Y + m[2][2] * Z)
  ];
}

// The single exposure scalar (see header): the physical body colour at
// REFERENCE_CHL scaled to the sea's prior tuned luminance. Everything
// else - hue, and how much brighter a bloom is than a gyre - is the
// model's own.
export const BODY_GAIN =
  TARGET_LUMINANCE / luminance(xyzToLinearSRGB(chlToXYZ(REFERENCE_CHL)));

// The water-leaving body colour for a chlorophyll concentration, in the
// linear-sRGB working space three's Color/uniform expects. Returns
// [r, g, b].
export function waterColorLinear(chl) {
  const rgb = xyzToLinearSRGB(chlToXYZ(chl));
  return [rgb[0] * BODY_GAIN, rgb[1] * BODY_GAIN, rgb[2] * BODY_GAIN];
}
