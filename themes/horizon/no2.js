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
 * THE FEEDS - two instruments, one quantity, each inverted
 * EXACTLY through its own published colormap; unknown or
 * unpainted cells read as ZERO column - no measurement, no tint,
 * fails closed.
 *  - TEMPO hourly over greater North America (Zoogman et al.
 *    2017, the mission paper, READ IN FULL from the open NTRS
 *    deposit; constants below): the first geostationary
 *    air-quality instrument scans the printed field of regard
 *    every daylight hour, so the drawn brown horizon carries the
 *    MEASURED diurnal cycle - the paper's own Sect. 9 puts the
 *    morning/evening scans on "peaks in vehicle miles traveled":
 *    rush hour enters the sky. Served as GIBS L3 tiles at exact
 *    per-scan timestamps; TIME=default is the latest scan. The
 *    palette (TEMPO_NO2_Vertical_Column_Troposphere v1.3,
 *    fetched 2026-08-08): 254 linear bins, 0 to 3.0e16.
 *  - Sentinel-5P TROPOMI daily, global (the fallback everywhere
 *    else and when TEMPO has no painted cells - night, FOR edge,
 *    gaps), via the same keyless GIBS WMTS (Worldview styles it
 *    with the OMI_Nitrogen_Dioxide_Tropo_Column palette; fetched
 *    2026-08-08): 191 bins, 0 to 2.0e16, open top.
 * The gate holds the two palettes to each other: the same column
 * inverts to the same molecules/cm^2 within one bin - no scale
 * factor between instruments anywhere.
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

// Inverse of a [r, g, b, lo, hi] palette: column (molecules/cm^2)
// of one tile pixel, or null (transparent / no-data / colour off
// the map). Shared by the TROPOMI/OMI and TEMPO palettes.
export function paletteOfRGBA(pal, r, g, b, a) {
  if (a < 128) return null;
  let best = null;
  let bestD = 49; // exact-palette tiles; tolerance for resampling
  for (const [cr, cg, cb, lo, hi] of pal) {
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
export function no2OfRGBA(r, g, b, a) {
  return paletteOfRGBA(NO2_RGB, r, g, b, a);
}

// Neighbourhood census around a pixel (the OMPS pattern): mean
// painted column; unpainted cells count as ZERO column (clean or
// unmeasured - no tint either way, fails closed). ofRGBA selects
// the palette inverter (default: the TROPOMI/OMI one).
export function sampleNo2(pxAt, px, py, half = 16, ofRGBA = no2OfRGBA) {
  let sum = 0;
  let n = 0;
  let painted = 0;
  for (let dy = -half; dy <= half; dy += 4) {
    for (let dx = -half; dx <= half; dx += 4) {
      const p = pxAt(px + dx, py + dy);
      if (!p) continue;
      n++;
      const v = ofRGBA(p[0], p[1], p[2], p[3]);
      if (v !== null && v > 0) {
        sum += v;
        painted++;
      }
    }
  }
  if (!n) return {col: 0, painted: 0, cells: 0};
  return {col: sum / n, painted, cells: n};
}

// ---- TEMPO: the hourly geostationary column ---------------------
// Zoogman et al. 2017 ("Tropospheric Emissions: Monitoring of
// Pollution (TEMPO)", JQSRT 186, 17-39; the open NTRS deposit
// 20170003141, READ IN FULL, Tables 1-2 machine-read): the first
// Earth Venture Instrument - a GEO UV/Vis spectrometer scanning
// "from Mexico City, Cuba, and the Bahamas to the Canadian oil
// sands, and from the Atlantic to the Pacific" EVERY DAYLIGHT
// HOUR (Table 1 revisit: 1 hour; field of regard 4.82 x 8.38 deg
// N/S x E/W from GEO), "to capture the high variability present
// in the diurnal cycle of emissions and chemistry that are
// unobservable from current low-Earth orbit satellites that
// measure once per day" - their Sect. 9 names the morning/evening
// scans landing on "peaks in vehicle miles traveled": the rush
// hours. THE PRINT THAT TIES THE FEED TO THE DRAWN OPTICS: the
// NO2 retrieval fits 400-465 nm (Sect. 7), SNR-specified over
// 423-451 nm (Table 1) - INSIDE the theme's 440 +- 20 nm blue
// band-mean window. The instrument measures the column in the
// very band the drawn absorber removes from the sky.
export const TEMPO_LAYER = 'TEMPO_L3_NO2_Vertical_Column_Troposphere';
export const TEMPO_Z = 6; // GoogleMapsCompatible_Level7 native; z6 ample
export const TEMPO_FIT_NM = [423, 451]; // Table 1 NO2 SNR window
export const TEMPO_FIT_WIDE_NM = [400, 465]; // Sect. 7 fit range
export const TEMPO_REVISIT_H = 1; // Table 1 - hourly daylight scans
export const TEMPO_IFOV_KM = [2.1, 4.4]; // Table 1, at 36.5 N 100 W
export const TEMPO_PROD_KM = [8.4, 4.4]; // Table 2 note (4 co-added)
export const TEMPO_NO2_TYP_CM2 = 6e15; // Table 2 typical (background)
export const TEMPO_NO2_PREC_CM2 = 1.0e15; // Table 2 required precision
export const TEMPO_FOR_DEG = [4.82, 8.38]; // Table 1 N/S x E/W
// The printed geographic FOR reduced to a precheck box (abstract
// corners, generous margins - the tile's own painted cells are
// the real gate; outside the box the TROPOMI daily walk serves).
export const TEMPO_BOX = {latMin: 17, latMax: 58, lonMin: -130, lonMax: -60};
export function inTempoBox(lat, lon) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= TEMPO_BOX.latMin &&
    lat <= TEMPO_BOX.latMax &&
    lon >= TEMPO_BOX.lonMin &&
    lon <= TEMPO_BOX.lonMax
  );
}

// The TEMPO layer's own published colormap, verbatim
// (TEMPO_NO2_Vertical_Column_Troposphere v1.3, fetched
// 2026-08-08): 254 linear bins, 0 to 3.0e16 molecules/cm^2,
// yellow through orange to deep purple; same row format as
// NO2_RGB (first row is the below-range clean-air entry).
export const TEMPO_RGB = [
  [254, 237, 176, -1, 0],
  [253, 236, 175, 0, 1.181e14],
  [253, 234, 173, 1.181e14, 2.362e14],
  [253, 233, 172, 2.362e14, 3.543e14],
  [253, 232, 171, 3.543e14, 4.724e14],
  [253, 230, 169, 4.724e14, 5.906e14],
  [253, 229, 168, 5.906e14, 7.087e14],
  [253, 227, 167, 7.087e14, 8.268e14],
  [253, 226, 165, 8.268e14, 9.449e14],
  [252, 225, 164, 9.449e14, 1.063e15],
  [252, 223, 163, 1.063e15, 1.181e15],
  [252, 222, 161, 1.181e15, 1.299e15],
  [252, 220, 160, 1.299e15, 1.417e15],
  [252, 219, 159, 1.417e15, 1.535e15],
  [252, 218, 157, 1.535e15, 1.654e15],
  [252, 216, 156, 1.654e15, 1.772e15],
  [251, 215, 155, 1.772e15, 1.89e15],
  [251, 213, 153, 1.89e15, 2.008e15],
  [251, 212, 152, 2.008e15, 2.126e15],
  [251, 211, 151, 2.126e15, 2.244e15],
  [251, 209, 150, 2.244e15, 2.362e15],
  [251, 208, 148, 2.362e15, 2.48e15],
  [251, 206, 147, 2.48e15, 2.598e15],
  [250, 205, 146, 2.598e15, 2.717e15],
  [250, 204, 145, 2.717e15, 2.835e15],
  [250, 202, 143, 2.835e15, 2.953e15],
  [250, 201, 142, 2.953e15, 3.071e15],
  [250, 199, 141, 3.071e15, 3.189e15],
  [250, 198, 140, 3.189e15, 3.307e15],
  [250, 197, 139, 3.307e15, 3.425e15],
  [249, 195, 137, 3.425e15, 3.543e15],
  [249, 194, 136, 3.543e15, 3.661e15],
  [249, 193, 135, 3.661e15, 3.78e15],
  [249, 191, 134, 3.78e15, 3.898e15],
  [249, 190, 133, 3.898e15, 4.016e15],
  [249, 188, 132, 4.016e15, 4.134e15],
  [248, 187, 130, 4.134e15, 4.252e15],
  [248, 186, 129, 4.252e15, 4.37e15],
  [248, 184, 128, 4.37e15, 4.488e15],
  [248, 183, 127, 4.488e15, 4.606e15],
  [248, 182, 126, 4.606e15, 4.724e15],
  [247, 180, 125, 4.724e15, 4.843e15],
  [247, 179, 124, 4.843e15, 4.961e15],
  [247, 177, 123, 4.961e15, 5.079e15],
  [247, 176, 122, 5.079e15, 5.197e15],
  [247, 175, 121, 5.197e15, 5.315e15],
  [246, 173, 120, 5.315e15, 5.433e15],
  [246, 172, 119, 5.433e15, 5.551e15],
  [246, 171, 118, 5.551e15, 5.669e15],
  [246, 169, 117, 5.669e15, 5.787e15],
  [245, 168, 116, 5.787e15, 5.906e15],
  [245, 166, 115, 5.906e15, 6.024e15],
  [245, 165, 114, 6.024e15, 6.142e15],
  [245, 164, 113, 6.142e15, 6.26e15],
  [245, 162, 112, 6.26e15, 6.378e15],
  [244, 161, 111, 6.378e15, 6.496e15],
  [244, 160, 110, 6.496e15, 6.614e15],
  [244, 158, 109, 6.614e15, 6.732e15],
  [243, 157, 108, 6.732e15, 6.85e15],
  [243, 155, 107, 6.85e15, 6.969e15],
  [243, 154, 106, 6.969e15, 7.087e15],
  [243, 153, 105, 7.087e15, 7.205e15],
  [242, 151, 104, 7.205e15, 7.323e15],
  [242, 150, 103, 7.323e15, 7.441e15],
  [242, 149, 103, 7.441e15, 7.559e15],
  [242, 147, 102, 7.559e15, 7.677e15],
  [241, 146, 101, 7.677e15, 7.795e15],
  [241, 145, 100, 7.795e15, 7.913e15],
  [241, 143, 99, 7.913e15, 8.031e15],
  [240, 142, 98, 8.031e15, 8.15e15],
  [240, 140, 98, 8.15e15, 8.268e15],
  [240, 139, 97, 8.268e15, 8.386e15],
  [239, 138, 96, 8.386e15, 8.504e15],
  [239, 136, 95, 8.504e15, 8.622e15],
  [239, 135, 95, 8.622e15, 8.74e15],
  [238, 134, 94, 8.74e15, 8.858e15],
  [238, 132, 93, 8.858e15, 8.976e15],
  [238, 131, 93, 8.976e15, 9.094e15],
  [237, 129, 92, 9.094e15, 9.213e15],
  [237, 128, 91, 9.213e15, 9.331e15],
  [237, 127, 91, 9.331e15, 9.449e15],
  [236, 125, 90, 9.449e15, 9.567e15],
  [236, 124, 90, 9.567e15, 9.685e15],
  [235, 123, 89, 9.685e15, 9.803e15],
  [235, 121, 89, 9.803e15, 9.921e15],
  [235, 120, 88, 9.921e15, 1.004e16],
  [234, 119, 88, 1.004e16, 1.016e16],
  [234, 117, 87, 1.016e16, 1.028e16],
  [233, 116, 87, 1.028e16, 1.039e16],
  [233, 114, 86, 1.039e16, 1.051e16],
  [232, 113, 86, 1.051e16, 1.063e16],
  [232, 112, 85, 1.063e16, 1.075e16],
  [231, 110, 85, 1.075e16, 1.087e16],
  [231, 109, 85, 1.087e16, 1.098e16],
  [230, 108, 84, 1.098e16, 1.11e16],
  [230, 106, 84, 1.11e16, 1.122e16],
  [229, 105, 84, 1.122e16, 1.134e16],
  [229, 104, 84, 1.134e16, 1.146e16],
  [228, 102, 83, 1.146e16, 1.157e16],
  [228, 101, 83, 1.157e16, 1.169e16],
  [227, 100, 83, 1.169e16, 1.181e16],
  [227, 98, 83, 1.181e16, 1.193e16],
  [226, 97, 83, 1.193e16, 1.205e16],
  [225, 96, 83, 1.205e16, 1.217e16],
  [225, 95, 83, 1.217e16, 1.228e16],
  [224, 93, 83, 1.228e16, 1.24e16],
  [224, 92, 83, 1.24e16, 1.252e16],
  [223, 91, 83, 1.252e16, 1.264e16],
  [222, 89, 83, 1.264e16, 1.276e16],
  [222, 88, 83, 1.276e16, 1.287e16],
  [221, 87, 83, 1.287e16, 1.299e16],
  [220, 86, 83, 1.299e16, 1.311e16],
  [219, 85, 83, 1.311e16, 1.323e16],
  [219, 83, 83, 1.323e16, 1.335e16],
  [218, 82, 83, 1.335e16, 1.346e16],
  [217, 81, 83, 1.346e16, 1.358e16],
  [216, 80, 83, 1.358e16, 1.37e16],
  [215, 79, 84, 1.37e16, 1.382e16],
  [215, 77, 84, 1.382e16, 1.394e16],
  [214, 76, 84, 1.394e16, 1.406e16],
  [213, 75, 84, 1.406e16, 1.417e16],
  [212, 74, 85, 1.417e16, 1.429e16],
  [211, 73, 85, 1.429e16, 1.441e16],
  [210, 72, 85, 1.441e16, 1.453e16],
  [209, 71, 85, 1.453e16, 1.465e16],
  [209, 70, 86, 1.465e16, 1.476e16],
  [208, 69, 86, 1.476e16, 1.488e16],
  [207, 68, 86, 1.488e16, 1.5e16],
  [206, 67, 87, 1.5e16, 1.512e16],
  [205, 66, 87, 1.512e16, 1.524e16],
  [204, 65, 87, 1.524e16, 1.535e16],
  [203, 64, 88, 1.535e16, 1.547e16],
  [202, 63, 88, 1.547e16, 1.559e16],
  [201, 62, 88, 1.559e16, 1.571e16],
  [200, 61, 89, 1.571e16, 1.583e16],
  [199, 60, 89, 1.583e16, 1.594e16],
  [198, 59, 89, 1.594e16, 1.606e16],
  [197, 58, 90, 1.606e16, 1.618e16],
  [196, 57, 90, 1.618e16, 1.63e16],
  [194, 56, 90, 1.63e16, 1.642e16],
  [193, 56, 91, 1.642e16, 1.654e16],
  [192, 55, 91, 1.654e16, 1.665e16],
  [191, 54, 91, 1.665e16, 1.677e16],
  [190, 53, 92, 1.677e16, 1.689e16],
  [189, 52, 92, 1.689e16, 1.701e16],
  [188, 52, 92, 1.701e16, 1.713e16],
  [187, 51, 93, 1.713e16, 1.724e16],
  [186, 50, 93, 1.724e16, 1.736e16],
  [184, 49, 93, 1.736e16, 1.748e16],
  [183, 48, 94, 1.748e16, 1.76e16],
  [182, 48, 94, 1.76e16, 1.772e16],
  [181, 47, 94, 1.772e16, 1.783e16],
  [180, 46, 94, 1.783e16, 1.795e16],
  [179, 46, 95, 1.795e16, 1.807e16],
  [178, 45, 95, 1.807e16, 1.819e16],
  [176, 44, 95, 1.819e16, 1.831e16],
  [175, 44, 96, 1.831e16, 1.843e16],
  [174, 43, 96, 1.843e16, 1.854e16],
  [173, 42, 96, 1.854e16, 1.866e16],
  [172, 42, 96, 1.866e16, 1.878e16],
  [170, 41, 97, 1.878e16, 1.89e16],
  [169, 40, 97, 1.89e16, 1.902e16],
  [168, 40, 97, 1.902e16, 1.913e16],
  [167, 39, 97, 1.913e16, 1.925e16],
  [165, 39, 97, 1.925e16, 1.937e16],
  [164, 38, 98, 1.937e16, 1.949e16],
  [163, 38, 98, 1.949e16, 1.961e16],
  [162, 37, 98, 1.961e16, 1.972e16],
  [161, 37, 98, 1.972e16, 1.984e16],
  [159, 36, 98, 1.984e16, 1.996e16],
  [158, 36, 99, 1.996e16, 2.008e16],
  [157, 35, 99, 2.008e16, 2.02e16],
  [155, 35, 99, 2.02e16, 2.031e16],
  [154, 34, 99, 2.031e16, 2.043e16],
  [153, 34, 99, 2.043e16, 2.055e16],
  [152, 33, 99, 2.055e16, 2.067e16],
  [150, 33, 99, 2.067e16, 2.079e16],
  [149, 32, 99, 2.079e16, 2.091e16],
  [148, 32, 99, 2.091e16, 2.102e16],
  [147, 32, 99, 2.102e16, 2.114e16],
  [145, 31, 99, 2.114e16, 2.126e16],
  [144, 31, 99, 2.126e16, 2.138e16],
  [143, 31, 99, 2.138e16, 2.15e16],
  [141, 30, 99, 2.15e16, 2.161e16],
  [140, 30, 99, 2.161e16, 2.173e16],
  [139, 30, 99, 2.173e16, 2.185e16],
  [137, 29, 99, 2.185e16, 2.197e16],
  [136, 29, 99, 2.197e16, 2.209e16],
  [135, 29, 99, 2.209e16, 2.22e16],
  [133, 28, 99, 2.22e16, 2.232e16],
  [132, 28, 99, 2.232e16, 2.244e16],
  [131, 28, 99, 2.244e16, 2.256e16],
  [129, 28, 99, 2.256e16, 2.268e16],
  [128, 27, 98, 2.268e16, 2.28e16],
  [127, 27, 98, 2.28e16, 2.291e16],
  [125, 27, 98, 2.291e16, 2.303e16],
  [124, 27, 98, 2.303e16, 2.315e16],
  [123, 27, 98, 2.315e16, 2.327e16],
  [121, 26, 97, 2.327e16, 2.339e16],
  [120, 26, 97, 2.339e16, 2.35e16],
  [119, 26, 97, 2.35e16, 2.362e16],
  [117, 26, 97, 2.362e16, 2.374e16],
  [116, 26, 96, 2.374e16, 2.386e16],
  [115, 26, 96, 2.386e16, 2.398e16],
  [113, 25, 96, 2.398e16, 2.409e16],
  [112, 25, 95, 2.409e16, 2.421e16],
  [110, 25, 95, 2.421e16, 2.433e16],
  [109, 25, 94, 2.433e16, 2.445e16],
  [108, 25, 94, 2.445e16, 2.457e16],
  [106, 25, 94, 2.457e16, 2.469e16],
  [105, 25, 93, 2.469e16, 2.48e16],
  [104, 25, 93, 2.48e16, 2.492e16],
  [102, 24, 92, 2.492e16, 2.504e16],
  [101, 24, 92, 2.504e16, 2.516e16],
  [100, 24, 91, 2.516e16, 2.528e16],
  [98, 24, 91, 2.528e16, 2.539e16],
  [97, 24, 90, 2.539e16, 2.551e16],
  [96, 24, 90, 2.551e16, 2.563e16],
  [94, 24, 89, 2.563e16, 2.575e16],
  [93, 23, 89, 2.575e16, 2.587e16],
  [92, 23, 88, 2.587e16, 2.598e16],
  [90, 23, 87, 2.598e16, 2.61e16],
  [89, 23, 87, 2.61e16, 2.622e16],
  [87, 23, 86, 2.622e16, 2.634e16],
  [86, 23, 85, 2.634e16, 2.646e16],
  [85, 23, 85, 2.646e16, 2.657e16],
  [83, 22, 84, 2.657e16, 2.669e16],
  [82, 22, 84, 2.669e16, 2.681e16],
  [81, 22, 83, 2.681e16, 2.693e16],
  [79, 22, 82, 2.693e16, 2.705e16],
  [78, 22, 81, 2.705e16, 2.717e16],
  [77, 21, 81, 2.717e16, 2.728e16],
  [76, 21, 80, 2.728e16, 2.74e16],
  [74, 21, 79, 2.74e16, 2.752e16],
  [73, 21, 79, 2.752e16, 2.764e16],
  [72, 21, 78, 2.764e16, 2.776e16],
  [70, 20, 77, 2.776e16, 2.787e16],
  [69, 20, 76, 2.787e16, 2.799e16],
  [68, 20, 75, 2.799e16, 2.811e16],
  [66, 20, 75, 2.811e16, 2.823e16],
  [65, 19, 74, 2.823e16, 2.835e16],
  [64, 19, 73, 2.835e16, 2.846e16],
  [62, 19, 72, 2.846e16, 2.858e16],
  [61, 19, 71, 2.858e16, 2.87e16],
  [60, 18, 71, 2.87e16, 2.882e16],
  [59, 18, 70, 2.882e16, 2.894e16],
  [57, 18, 69, 2.894e16, 2.906e16],
  [56, 17, 68, 2.906e16, 2.917e16],
  [55, 17, 67, 2.917e16, 2.929e16],
  [54, 17, 66, 2.929e16, 2.941e16],
  [52, 17, 65, 2.941e16, 2.953e16],
  [51, 16, 65, 2.953e16, 2.965e16],
  [50, 16, 64, 2.965e16, 2.976e16],
  [48, 15, 63, 2.976e16, 2.988e16],
  [47, 15, 62, 2.988e16, 3e16]
];
export function tempoOfRGBA(r, g, b, a) {
  return paletteOfRGBA(TEMPO_RGB, r, g, b, a);
}
