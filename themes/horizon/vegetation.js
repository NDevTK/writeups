// Land vegetation: the reflectance of a ground cell as a physical
// mixture of green canopy and bare soil, set by that cell's MEASURED
// greenness. This is the terrestrial twin of morel.js - where the sea
// gets its colour from measured chlorophyll, the land gets its colour
// from a measured vegetation index - and it feeds the same CIE colour
// integration (land-color.js) that ocean-color.js uses for the water.
//
// The chain:
//   Fr(NDVI) = (N*)^2,  N* = (NDVI - NDVI0)/(NDVIs - NDVI0)   Carlson
//              & Ripley [1997], the scaled-NDVI square relation; N*
//              clamped to [0, 1] so Fr is a fractional cover.
//   rho(lambda) = Fr*veg(lambda) + (1 - Fr)*soil(lambda)      the
//              two-endmember linear sub-pixel reflectance mixture:
//              a cell is a patch of canopy over a patch of soil, and
//              its reflectance is their area-weighted sum.
//
// So a barren cell (Fr -> 0) wears the soil's warm rising spectrum and
// a densely vegetated cell (Fr -> 1) wears the canopy's green-peak,
// red-absorbing, red-edge spectrum - the hue is a physical consequence
// of the measured index, not a painted class colour.
//
// The two endmember spectra are canonical library measurements
// (fetched 2026-07-11), on a 10 nm grid 400-700 nm, as reflectance
// FRACTIONS:
//   - GREEN_VEG: USGS Spectral Library v7 "Lawn_Grass GDS91 green"
//     (splib07a, Beckman AREF, record 21373). The textbook green-leaf
//     visible shape: low blue, a green bump at 550, the chlorophyll
//     absorption minimum near 670, and the red-edge climb by 700.
//   - DRY_SOIL: ECOSTRESS Spectral Library "Brown loamy fine sand"
//     (Alfisol Haplustalf, sample 87P3468, JHU Beckman; original
//     percent divided to a fraction). A smooth monotonic rise from
//     blue to red - a bare, warm substrate.
// vegetation-reference.mjs holds both spectra and the mixture to these
// published shapes and to the Carlson & Ripley relation.

// NDVI endmembers: bare-soil and full-cover NDVI. Gutman & Ignatov
// [1998], the global AVHRR pair (NDVI0 = 0.04, NDVIs = 0.52); Carlson
// & Ripley take these as scene-specific, and Montandon & Small [2008]
// note a larger mean soil NDVI (~0.2). Exposed as arguments so a caller
// with a scene histogram can override them.
export const NDVI_SOIL = 0.04;
export const NDVI_VEG = 0.52;

// [lambda (nm), reflectance fraction] on a 10 nm grid, 400-700 nm.
// USGS splib07a Lawn_Grass GDS91 green (Beckman AREF).
export const GREEN_VEG = [
  [400, 0.025],
  [410, 0.0283],
  [420, 0.0298],
  [430, 0.031],
  [440, 0.0312],
  [450, 0.0355],
  [460, 0.0365],
  [470, 0.0366],
  [480, 0.0365],
  [490, 0.0367],
  [500, 0.0391],
  [510, 0.0457],
  [520, 0.0619],
  [530, 0.0832],
  [540, 0.0939],
  [550, 0.0969], // green bump
  [560, 0.0949],
  [570, 0.0855],
  [580, 0.0729],
  [590, 0.0668],
  [600, 0.0638],
  [610, 0.0608],
  [620, 0.0558],
  [630, 0.0531],
  [640, 0.0501],
  [650, 0.0452],
  [660, 0.0427],
  [670, 0.0391], // chlorophyll absorption minimum
  [680, 0.0382],
  [690, 0.049],
  [700, 0.0914] // red edge
];

// [lambda (nm), reflectance fraction] on a 10 nm grid, 400-700 nm.
// ECOSTRESS Alfisol Haplustalf 87P3468 (JHU Beckman; percent/100).
export const DRY_SOIL = [
  [400, 0.0463],
  [410, 0.054],
  [420, 0.0628],
  [430, 0.0679],
  [440, 0.0752],
  [450, 0.0829],
  [460, 0.0861],
  [470, 0.0907],
  [480, 0.0971],
  [490, 0.1031],
  [500, 0.1056],
  [510, 0.1111],
  [520, 0.1174],
  [530, 0.1233],
  [540, 0.1339],
  [550, 0.1405],
  [560, 0.1513],
  [570, 0.1585],
  [580, 0.1654],
  [590, 0.1726],
  [600, 0.1761],
  [610, 0.1819],
  [620, 0.1907],
  [630, 0.1974],
  [640, 0.1991],
  [650, 0.2047],
  [660, 0.2105],
  [670, 0.2191],
  [680, 0.2249],
  [690, 0.2302],
  [700, 0.2377]
];

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Fractional vegetation cover from NDVI, Carlson & Ripley [1997]:
// the scaled NDVI squared, clamped so Fr is a physical fraction. Fr = 0
// at or below bare-soil NDVI, 1 at or above full-cover NDVI.
export function fractionalCover(ndvi, ndvi0 = NDVI_SOIL, ndvis = NDVI_VEG) {
  const nStar = clamp((ndvi - ndvi0) / (ndvis - ndvi0), 0, 1);
  return nStar * nStar;
}

// Reflectance of an endmember table at a wavelength, linearly
// interpolated on its 10 nm grid and held flat past the ends (below
// 400 nm both surfaces are dark and the CIE observer is small, so the
// clamped violet tail carries almost no colour).
export function sampleSpectrum(table, nm) {
  if (nm <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (nm >= last[0]) return last[1];
  let i = 0;
  while (i < table.length - 2 && nm > table[i + 1][0]) i++;
  const t = (nm - table[i][0]) / (table[i + 1][0] - table[i][0]);
  return table[i][1] + (table[i + 1][1] - table[i][1]) * t;
}

// The mixed ground reflectance at a wavelength for a measured NDVI: the
// fractional-cover-weighted sum of the canopy and soil endmembers.
export function mixedReflectanceAt(
  ndvi,
  nm,
  ndvi0 = NDVI_SOIL,
  ndvis = NDVI_VEG
) {
  const fr = fractionalCover(ndvi, ndvi0, ndvis);
  return (
    fr * sampleSpectrum(GREEN_VEG, nm) + (1 - fr) * sampleSpectrum(DRY_SOIL, nm)
  );
}

// The mixed ground reflectance spectrum for a measured NDVI across the
// endmember grid (convenience for the reference gate and band work).
// Returns [{nm, R}].
export function canopyReflectance(ndvi, ndvi0 = NDVI_SOIL, ndvis = NDVI_VEG) {
  return GREEN_VEG.map(([nm]) => ({
    nm,
    R: mixedReflectanceAt(ndvi, nm, ndvi0, ndvis)
  }));
}
