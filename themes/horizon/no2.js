/**
 * no2.js - the brown horizon: MEASURED tropospheric nitrogen
 * dioxide as a Beer-Lambert absorber in the sky marches. Gated by
 * no2-reference.mjs against three independent vendored laboratory
 * datasets (no2-xsec-data.js).
 *
 * THE PHYSICS - NO2 is the coloured gas of polluted air: its
 * visible band system absorbs blue strongly, green moderately and
 * red barely (the vendored 293 K band means run 5.1e-19 /
 * 1.0e-19 / 5.9e-21 cm^2 across the theme's 440/550/680 nm
 * channels - a 87:17:1 ordering), so a polluted horizon path
 * loses blue and turns brown. The theme's ozone absorber
 * (ozone.js - the Chappuis band at its measured column) already
 * takes exactly this road at stratospheric heights; NO2 is its
 * boundary-layer sibling, and the term enters every march the
 * same way: an absorption coefficient per channel times a
 * density profile times a measured column.
 *
 * THE DATA - the MPI-Mainz UV/VIS Spectral Atlas (Keller-Rudek,
 * Moortgat, Sander & Soerensen 2013, ESSD 5, 365-373 - open
 * access, READ IN FULL): a curated archive serving each study\'s
 * ORIGINAL published cross sections in cm^2 molecule^-1 (base e,
 * air wavelengths; their Sect. 3.3 fixes the unit conventions).
 * Three independent laboratory datasets are vendored at the
 * theme\'s channel windows (no2-xsec-data.js): Bogumil et al.
 * 2003 (SCIAMACHY PFM, 230-930 nm - the shipped values; the only
 * set covering the red channel window whole), Vandaele et al.
 * 1998 (FTS, to 667 nm) and Burrows et al. 1998 (GOME FM, to
 * 794 nm). The gate holds the three to each other: Bogumil and
 * Vandaele agree to ~2% in blue and green; Burrows sits a
 * documented ~6% low (the atlas\'s own overview-plot spread).
 * The channel value is the 0.5-nm-binned BAND MEAN over +-20 nm
 * around each channel wavelength - NO2\'s banded spectrum makes
 * a single-wavelength read unstable; the mean over the channel
 * window is the honest reduction (documented; same spirit as the
 * theme\'s single-lambda channel convention everywhere else).
 *
 * THE FEED - Sentinel-5P TROPOMI tropospheric NO2 column via
 * NASA GIBS, keyless WMTS PNG tiles (daily, global, live -
 * confirmed serving current dates), inverted EXACTLY through the
 * published colormap the layer is styled with (Worldview styles
 * TROPOMI with the OMI_Nitrogen_Dioxide_Tropo_Column palette;
 * fetched 2026-08-08 and embedded verbatim below): 191 bins from
 * 0 to 2.0e16 molecules/cm^2 with an open top. Unknown or
 * unpainted cells read as ZERO column - no measurement, no tint,
 * fails closed. (TEMPO L3 serves the same quantity hourly over
 * North America - a future refinement, recorded.)
 *
 * THE PROFILE - tropospheric NO2 hugs the polluted boundary
 * layer it is emitted into; the drawn profile is the march\'s own
 * boundary-layer exponential (the 1200 m mie scale height,
 * Hillaire\'s printed aerosol profile) - a documented co-emission
 * reduction: NOx and urban aerosol ride the same mixed layer,
 * and the MEASURED quantity is the column, which the profile
 * only redistributes vertically. beta0 = sigma x N / 1200 m puts
 * the whole measured column under that exponential exactly.
 *
 * Scale: a heavy plume (1.5e16 cm^-2, the colormap\'s red zone)
 * carries vertical tau_blue ~ 0.008 - invisible overhead - but
 * the horizon chord through a 1200 m layer runs ~70-90 airmasses:
 * tau_blue ~ 0.5, a 40% blue loss against a few percent in red -
 * THE brown band over the skyline. A clean background column
 * (< 1e15) stays under a JND at every elevation. Emergence, no
 * threshold coded.
 */

import {
  NO2_BOGUMIL_B,
  NO2_BOGUMIL_G,
  NO2_BOGUMIL_R,
  NO2_BURROWS_B,
  NO2_BURROWS_G,
  NO2_BURROWS_R,
  NO2_VANDAELE_B,
  NO2_VANDAELE_G
} from './no2-xsec-data.js';

// The march\'s boundary-layer scale height (Hillaire\'s printed
// mie profile - sun-transmittance.js / atmosphere-tsl.js carry
// the same 1200 m in their integrals).
export const NO2_H_M = 1200;

// Band mean of a vendored [nm, cm^2] slice.
export function bandMean(rows) {
  let s = 0;
  for (const [, v] of rows) s += v;
  return s / rows.length;
}

// The shipped per-channel cross sections (cm^2, 293 K): Bogumil
// band means at the theme\'s R/G/B windows.
export function no2SigmaCm2() {
  return [
    bandMean(NO2_BOGUMIL_R),
    bandMean(NO2_BOGUMIL_G),
    bandMean(NO2_BOGUMIL_B)
  ];
}
// The cross-check sets the gate compares (Vandaele red window is
// partial - Bogumil vs Burrows carries the red comparison).
export function no2SigmaVandaeleBG() {
  return [bandMean(NO2_VANDAELE_G), bandMean(NO2_VANDAELE_B)];
}
export function no2SigmaBurrows() {
  return [
    bandMean(NO2_BURROWS_R),
    bandMean(NO2_BURROWS_G),
    bandMean(NO2_BURROWS_B)
  ];
}

// Per-metre absorption at h = 0 for a measured column (molecules
// per cm^2), profile exp(-h/1200): sigma[cm^2] x N[cm^-2] is the
// vertical tau; dividing by the profile integral (H = 1200 m)
// makes beta0 with exactly that column underneath.
export function no2BetaPerM(colCm2) {
  const s = no2SigmaCm2();
  const N = Math.max(colCm2 || 0, 0);
  return [(s[0] * N) / NO2_H_M, (s[1] * N) / NO2_H_M, (s[2] * N) / NO2_H_M];
}

// ---- the live feed ----------------------------------------------
export const NO2_LAYER = 'TROPOMI_L2_Nitrogen_Dioxide_Tropospheric_Column';
export const NO2_Z = 6; // GoogleMapsCompatible_Level6 (native max)

// The published colormap, verbatim (OMI_Nitrogen_Dioxide_Tropo_
// Column v1.3, the palette Worldview styles the TROPOMI layer
// with): [r, g, b, lo, hi] per bin, molecules/cm^2; -1 = open
// end. Bin 0 is the below-zero no-data entry.
export const NO2_RGB = [
  [255, 252, 199, -1, 0],
  [255, 252, 171, 0, 1.06e14],
  [255, 251, 169, 1.06e14, 2.12e14],
  [255, 250, 167, 2.12e14, 3.18e14],
  [255, 249, 165, 3.18e14, 4.24e14],
  [255, 248, 164, 4.24e14, 5.3e14],
  [255, 247, 162, 5.3e14, 6.36e14],
  [255, 247, 160, 6.36e14, 7.42e14],
  [255, 246, 158, 7.42e14, 8.48e14],
  [255, 246, 156, 8.48e14, 9.54e14],
  [255, 245, 154, 9.54e14, 1.06e15],
  [255, 244, 152, 1.06e15, 1.17e15],
  [255, 243, 150, 1.17e15, 1.27e15],
  [255, 243, 149, 1.27e15, 1.38e15],
  [255, 242, 147, 1.38e15, 1.48e15],
  [255, 241, 145, 1.48e15, 1.59e15],
  [255, 240, 143, 1.59e15, 1.7e15],
  [255, 239, 142, 1.7e15, 1.8e15],
  [255, 238, 140, 1.8e15, 1.91e15],
  [255, 237, 138, 1.91e15, 2.01e15],
  [255, 236, 136, 2.01e15, 2.12e15],
  [255, 236, 135, 2.12e15, 2.23e15],
  [255, 235, 133, 2.23e15, 2.33e15],
  [255, 235, 131, 2.33e15, 2.44e15],
  [255, 234, 129, 2.44e15, 2.54e15],
  [255, 234, 128, 2.54e15, 2.65e15],
  [255, 233, 126, 2.65e15, 2.76e15],
  [255, 232, 125, 2.76e15, 2.86e15],
  [255, 231, 123, 2.86e15, 2.97e15],
  [255, 230, 122, 2.97e15, 3.07e15],
  [255, 229, 120, 3.07e15, 3.18e15],
  [255, 228, 118, 3.18e15, 3.29e15],
  [255, 227, 116, 3.29e15, 3.39e15],
  [255, 227, 115, 3.39e15, 3.5e15],
  [255, 226, 113, 3.5e15, 3.6e15],
  [255, 225, 112, 3.6e15, 3.71e15],
  [255, 224, 110, 3.71e15, 3.82e15],
  [255, 223, 109, 3.82e15, 3.92e15],
  [255, 222, 107, 3.92e15, 4.03e15],
  [255, 222, 106, 4.03e15, 4.13e15],
  [255, 221, 105, 4.13e15, 4.24e15],
  [255, 221, 104, 4.24e15, 4.35e15],
  [255, 220, 102, 4.35e15, 4.45e15],
  [255, 219, 101, 4.45e15, 4.56e15],
  [255, 218, 100, 4.56e15, 4.66e15],
  [255, 217, 99, 4.66e15, 4.77e15],
  [255, 216, 97, 4.77e15, 4.88e15],
  [255, 215, 95, 4.88e15, 4.98e15],
  [255, 214, 93, 4.98e15, 5.09e15],
  [255, 214, 92, 5.09e15, 5.19e15],
  [255, 213, 90, 5.19e15, 5.3e15],
  [255, 212, 89, 5.3e15, 5.41e15],
  [255, 211, 88, 5.41e15, 5.51e15],
  [255, 211, 87, 5.51e15, 5.62e15],
  [255, 210, 85, 5.62e15, 5.72e15],
  [255, 209, 84, 5.72e15, 5.83e15],
  [255, 208, 83, 5.83e15, 5.94e15],
  [255, 208, 82, 5.94e15, 6.04e15],
  [255, 207, 81, 6.04e15, 6.15e15],
  [255, 206, 80, 6.15e15, 6.25e15],
  [255, 205, 79, 6.25e15, 6.36e15],
  [255, 204, 78, 6.36e15, 6.47e15],
  [255, 202, 77, 6.47e15, 6.57e15],
  [255, 201, 76, 6.57e15, 6.68e15],
  [255, 200, 75, 6.68e15, 6.78e15],
  [255, 199, 74, 6.78e15, 6.89e15],
  [255, 197, 72, 6.89e15, 7e15],
  [255, 195, 71, 7e15, 7.1e15],
  [255, 194, 70, 7.1e15, 7.21e15],
  [255, 193, 69, 7.21e15, 7.31e15],
  [255, 191, 67, 7.31e15, 7.42e15],
  [255, 190, 66, 7.42e15, 7.53e15],
  [255, 188, 65, 7.53e15, 7.63e15],
  [255, 187, 64, 7.63e15, 7.74e15],
  [255, 185, 63, 7.74e15, 7.84e15],
  [255, 184, 62, 7.84e15, 7.95e15],
  [255, 183, 60, 7.95e15, 8.06e15],
  [255, 182, 60, 8.06e15, 8.16e15],
  [255, 180, 58, 8.16e15, 8.27e15],
  [255, 179, 57, 8.27e15, 8.37e15],
  [255, 177, 56, 8.37e15, 8.48e15],
  [255, 176, 55, 8.48e15, 8.59e15],
  [255, 174, 54, 8.59e15, 8.69e15],
  [255, 173, 53, 8.69e15, 8.8e15],
  [255, 171, 52, 8.8e15, 8.9e15],
  [255, 170, 51, 8.9e15, 9.01e15],
  [255, 168, 50, 9.01e15, 9.12e15],
  [255, 167, 49, 9.12e15, 9.22e15],
  [255, 165, 48, 9.22e15, 9.33e15],
  [255, 164, 47, 9.33e15, 9.43e15],
  [255, 162, 46, 9.43e15, 9.54e15],
  [255, 161, 45, 9.54e15, 9.65e15],
  [255, 159, 44, 9.65e15, 9.75e15],
  [255, 158, 43, 9.75e15, 9.86e15],
  [255, 156, 42, 9.86e15, 9.97e15],
  [255, 155, 42, 9.97e15, 1.01e16],
  [255, 154, 41, 1.01e16, 1.02e16],
  [255, 153, 41, 1.02e16, 1.03e16],
  [255, 151, 40, 1.03e16, 1.04e16],
  [255, 150, 40, 1.04e16, 1.05e16],
  [255, 149, 40, 1.05e16, 1.06e16],
  [255, 148, 40, 1.06e16, 1.07e16],
  [255, 146, 39, 1.07e16, 1.08e16],
  [255, 145, 39, 1.08e16, 1.09e16],
  [255, 143, 38, 1.09e16, 1.1e16],
  [255, 142, 38, 1.1e16, 1.11e16],
  [255, 141, 37, 1.11e16, 1.12e16],
  [255, 140, 36, 1.12e16, 1.13e16],
  [255, 139, 36, 1.13e16, 1.14e16],
  [255, 138, 36, 1.14e16, 1.16e16],
  [255, 136, 35, 1.16e16, 1.17e16],
  [255, 135, 35, 1.17e16, 1.18e16],
  [255, 133, 35, 1.18e16, 1.19e16],
  [255, 132, 35, 1.19e16, 1.2e16],
  [255, 130, 34, 1.2e16, 1.21e16],
  [255, 129, 34, 1.21e16, 1.22e16],
  [255, 128, 33, 1.22e16, 1.23e16],
  [255, 127, 33, 1.23e16, 1.24e16],
  [255, 125, 32, 1.24e16, 1.25e16],
  [255, 124, 32, 1.25e16, 1.26e16],
  [255, 123, 32, 1.26e16, 1.27e16],
  [255, 122, 32, 1.27e16, 1.28e16],
  [255, 120, 31, 1.28e16, 1.29e16],
  [255, 119, 31, 1.29e16, 1.3e16],
  [255, 118, 31, 1.3e16, 1.31e16],
  [255, 117, 31, 1.31e16, 1.33e16],
  [255, 115, 30, 1.33e16, 1.34e16],
  [255, 113, 30, 1.34e16, 1.35e16],
  [255, 112, 29, 1.35e16, 1.36e16],
  [255, 111, 29, 1.36e16, 1.37e16],
  [255, 108, 28, 1.37e16, 1.38e16],
  [255, 106, 28, 1.38e16, 1.39e16],
  [255, 104, 28, 1.39e16, 1.4e16],
  [255, 102, 28, 1.4e16, 1.41e16],
  [255, 100, 27, 1.41e16, 1.42e16],
  [255, 98, 27, 1.42e16, 1.43e16],
  [255, 96, 26, 1.43e16, 1.44e16],
  [255, 94, 26, 1.44e16, 1.45e16],
  [255, 92, 25, 1.45e16, 1.46e16],
  [255, 90, 25, 1.46e16, 1.47e16],
  [255, 88, 24, 1.47e16, 1.48e16],
  [255, 86, 24, 1.48e16, 1.5e16],
  [255, 84, 23, 1.5e16, 1.51e16],
  [255, 82, 23, 1.51e16, 1.52e16],
  [255, 80, 23, 1.52e16, 1.53e16],
  [255, 79, 23, 1.53e16, 1.54e16],
  [255, 77, 22, 1.54e16, 1.55e16],
  [255, 75, 22, 1.55e16, 1.56e16],
  [255, 73, 21, 1.56e16, 1.57e16],
  [255, 72, 21, 1.57e16, 1.58e16],
  [255, 70, 20, 1.58e16, 1.59e16],
  [255, 68, 20, 1.59e16, 1.6e16],
  [255, 65, 20, 1.6e16, 1.61e16],
  [255, 64, 20, 1.61e16, 1.62e16],
  [255, 62, 19, 1.62e16, 1.63e16],
  [255, 60, 19, 1.63e16, 1.64e16],
  [255, 58, 19, 1.64e16, 1.65e16],
  [255, 57, 19, 1.65e16, 1.66e16],
  [254, 55, 18, 1.66e16, 1.67e16],
  [254, 54, 18, 1.67e16, 1.68e16],
  [253, 52, 18, 1.68e16, 1.7e16],
  [253, 51, 18, 1.7e16, 1.71e16],
  [252, 49, 17, 1.71e16, 1.72e16],
  [251, 48, 17, 1.72e16, 1.73e16],
  [250, 47, 17, 1.73e16, 1.74e16],
  [250, 46, 17, 1.74e16, 1.75e16],
  [248, 44, 16, 1.75e16, 1.76e16],
  [247, 43, 16, 1.76e16, 1.77e16],
  [246, 41, 16, 1.77e16, 1.78e16],
  [245, 40, 16, 1.78e16, 1.79e16],
  [244, 39, 15, 1.79e16, 1.8e16],
  [243, 38, 15, 1.8e16, 1.81e16],
  [242, 37, 15, 1.81e16, 1.82e16],
  [242, 36, 15, 1.82e16, 1.83e16],
  [241, 34, 14, 1.83e16, 1.84e16],
  [240, 33, 14, 1.84e16, 1.85e16],
  [239, 32, 14, 1.85e16, 1.87e16],
  [239, 31, 14, 1.87e16, 1.88e16],
  [237, 29, 13, 1.88e16, 1.89e16],
  [237, 28, 13, 1.89e16, 1.9e16],
  [236, 27, 12, 1.9e16, 1.91e16],
  [235, 26, 12, 1.91e16, 1.92e16],
  [234, 24, 11, 1.92e16, 1.93e16],
  [233, 23, 11, 1.93e16, 1.94e16],
  [232, 22, 11, 1.94e16, 1.95e16],
  [232, 21, 11, 1.95e16, 1.96e16],
  [231, 20, 10, 1.96e16, 1.97e16],
  [230, 19, 10, 1.97e16, 1.98e16],
  [229, 18, 10, 1.98e16, 1.99e16],
  [229, 17, 10, 1.99e16, 2e16],
  [127, 0, 14, 2e16, -1]
];

// Inverse of the colormap: column (molecules/cm^2) of one tile
// pixel, or null (transparent / no-data / colour off the map).
export function no2OfRGBA(r, g, b, a) {
  if (a < 128) return null;
  let best = null;
  let bestD = 49; // exact-palette tiles; tolerance for resampling
  for (const [cr, cg, cb, lo, hi] of NO2_RGB) {
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = [lo, hi];
    }
  }
  if (!best) return null;
  const [lo, hi] = best;
  if (lo < 0) return 0; // below-range entry: clean air
  if (hi < 0) return lo; // open top: the bin floor
  return (lo + hi) / 2;
}

// Neighbourhood census around a pixel (the OMPS pattern): mean
// painted column; unpainted cells count as ZERO column (clean or
// unmeasured - no tint either way, fails closed).
export function sampleNo2(pxAt, px, py, half = 16) {
  let sum = 0;
  let n = 0;
  let painted = 0;
  for (let dy = -half; dy <= half; dy += 4) {
    for (let dx = -half; dx <= half; dx += 4) {
      const p = pxAt(px + dx, py + dy);
      if (!p) continue;
      n++;
      const v = no2OfRGBA(p[0], p[1], p[2], p[3]);
      if (v !== null && v > 0) {
        sum += v;
        painted++;
      }
    }
  }
  if (!n) return {col: 0, painted: 0, cells: 0};
  return {col: sum / n, painted, cells: n};
}
