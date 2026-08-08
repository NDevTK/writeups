/**
 * lunar-umbra.js - the eclipsed moon's shadow profile, printed.
 * The lunar-eclipse darkening was a hand copper lerp (the block
 * itself called it \"the documented display mapping of a
 * mid-scale L2 eclipse\") plus a 0.18 penumbral constant. The
 * printed replacement:
 *
 * Mallama 2022, \"Lunar Eclipse Phenomena: Modeled and
 * Explained\" (arXiv:2112.08966 - read in full): a model of
 * refraction (his Table 3.1 / Eq. 1 intensity-deflection law),
 * absorption (Eq. 2, 73% blue to 90% red per air mass) and
 * focusing, validated against Sky & Telescope and Westfall
 * photometry (his Fig. 5.1). His Table B.1 prints the
 * DISK-RESOLVED intensity lost, in magnitudes, at 50 shadow
 * positions from the outer penumbral boundary (0) to the shadow
 * centre (1), for Johnson-Cousins B, V(green) and R - vendored
 * VERBATIM below and stood in for the theme's 440/550/680
 * channels (the band centres sit within ~15 nm of the theme's;
 * stated). The printed structure the gate holds: the three
 * colour branches separate \"about a third of the way in\"; at
 * the centre blue has lost 22.24 mag (\"almost a billion\"),
 * red 11.02 (\"20,000 times\") - the printed reason the deep
 * umbra is red. The gate also REPRODUCES his integrated Table
 * B.2 endpoints by disc-integrating this table with his own
 * stated geometry (penumbral annulus width = lunar diameter),
 * and holds his baseline full moon (-12.73) against the theme's
 * shipped MOON_FULL_VMAG (-12.74). Scope: the table is for a
 * clear atmosphere - Mallama notes volcanic aerosol darkens
 * eclipses below it (the model is \"an approximate upper limit\"
 * after major eruptions), the stated hook for a future coupling
 * to the theme's measured stratospheric AOD. Corroboration:
 * Ugolnikov, Maslov & Korotkiy 2011 (arXiv:1106.6178 - read in
 * full) MEASURED the June 2011 umbra in three bands; their
 * printed \"503 nm relative brightness value falls down to
 * about 1e-6 in the umbra\" sits within a factor ~1.5 of this
 * table's deep-umbra green (6.6e-7).
 *
 * Position for a POINT at angular distance d from the shadow
 * centre: pos = 1 - d / penumbraRadius (his Pos'n definition,
 * with the live penumbral radius as the printed scale
 * adjustment for other geometries).
 */

// Table B.1, verbatim: [shadow position, B, V, R] magnitudes
// lost (near-IR column not carried - the theme has no IR
// channel).
export const UMBRA_MAG_LOST = [
  [0, 0, 0, 0],
  [0.02, 0.02, 0.02, 0.03],
  [0.041, 0.06, 0.06, 0.07],
  [0.061, 0.11, 0.11, 0.12],
  [0.082, 0.17, 0.17, 0.18],
  [0.102, 0.24, 0.24, 0.24],
  [0.122, 0.32, 0.32, 0.32],
  [0.143, 0.41, 0.41, 0.41],
  [0.163, 0.51, 0.51, 0.51],
  [0.184, 0.63, 0.63, 0.63],
  [0.204, 0.76, 0.76, 0.75],
  [0.224, 0.92, 0.91, 0.9],
  [0.245, 1.09, 1.08, 1.06],
  [0.265, 1.3, 1.28, 1.26],
  [0.286, 1.54, 1.51, 1.49],
  [0.306, 1.83, 1.8, 1.77],
  [0.327, 2.19, 2.14, 2.1],
  [0.347, 2.64, 2.58, 2.53],
  [0.367, 3.24, 3.15, 3.08],
  [0.388, 4.15, 4.02, 3.91],
  [0.408, 6.04, 5.76, 5.5],
  [0.429, 7.32, 6.76, 6.28],
  [0.449, 8.07, 7.31, 6.68],
  [0.469, 8.74, 7.78, 7.01],
  [0.49, 9.39, 8.22, 7.3],
  [0.51, 10.04, 8.65, 7.57],
  [0.531, 10.71, 9.07, 7.83],
  [0.551, 11.35, 9.47, 8.08],
  [0.571, 11.97, 9.86, 8.31],
  [0.592, 12.58, 10.23, 8.52],
  [0.612, 13.17, 10.59, 8.74],
  [0.632, 13.76, 10.94, 8.94],
  [0.653, 14.33, 11.29, 9.13],
  [0.673, 14.9, 11.63, 9.32],
  [0.694, 15.46, 11.96, 9.5],
  [0.714, 16.02, 12.28, 9.68],
  [0.734, 16.57, 12.6, 9.85],
  [0.755, 17.11, 12.91, 10],
  [0.775, 17.65, 13.22, 10.15],
  [0.796, 18.19, 13.52, 10.29],
  [0.816, 18.72, 13.8, 10.42],
  [0.837, 19.24, 14.08, 10.53],
  [0.857, 19.74, 14.34, 10.64],
  [0.878, 20.23, 14.58, 10.73],
  [0.898, 20.68, 14.8, 10.81],
  [0.918, 21.12, 15, 10.88],
  [0.939, 21.52, 15.17, 10.94],
  [0.959, 21.86, 15.3, 10.98],
  [0.98, 22.11, 15.39, 11.01],
  [1, 22.24, 15.44, 11.02]
];

// Magnitudes lost at channel c (theme order 0=R(680), 1=V(550),
// 2=B(440)) and shadow position pos (clamped to the table).
const COL = [3, 2, 1]; // theme channel -> table column
export function umbralMagLost(c, pos) {
  const t = UMBRA_MAG_LOST;
  if (pos <= t[0][0]) return t[0][COL[c]];
  for (let i = 1; i < t.length; i++) {
    if (pos <= t[i][0]) {
      const f = (pos - t[i - 1][0]) / (t[i][0] - t[i - 1][0]);
      return t[i - 1][COL[c]] + f * (t[i][COL[c]] - t[i - 1][COL[c]]);
    }
  }
  return t[t.length - 1][COL[c]];
}

// The intensity factor (0..1) at channel c and position pos.
export function umbralFactor(c, pos) {
  return Math.pow(10, -0.4 * umbralMagLost(c, pos));
}

// A 1D RGBA float LUT over pos 0..1 for the moon material.
export function buildUmbraLUT(n = 64) {
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const pos = i / (n - 1);
    out[i * 4] = umbralFactor(0, pos);
    out[i * 4 + 1] = umbralFactor(1, pos);
    out[i * 4 + 2] = umbralFactor(2, pos);
    out[i * 4 + 3] = 1;
  }
  return out;
}
