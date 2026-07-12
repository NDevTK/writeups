/**
 * spectral-color.js - the measured-reflectance provenance for the
 * vegetation colours. crops.js and forest.js carry palette colours for
 * each phenophase (green canopy, ripe cereal, flowering rape, autumn
 * gold, ...); this is where those colours come FROM: measured visible
 * band-reflectance run through this repo's own CIE 1931 2 deg / D65
 * colorimetry (ocean-color.js, the same pipeline the ocean and sky
 * display path use) to an sRGB colour. So a crop's colour is not
 * eyeballed - it is the true colour a D65-lit canopy of that measured
 * reflectance would show, and spectral-color-reference.mjs holds each
 * module's palette to the signature (green-led / gold R>G>B / purple /
 * white) its measured spectrum actually produces.
 *
 * The band-reflectance anchors are from leaf/canopy-optics and
 * senescence/flower-reflectance literature (PROSPECT/SAIL leaf optics,
 * Jacquemoud & Baret 1990; Gitelson & Merzlyak carotenoid/anthocyanin
 * senescence indices; canola-bloom and ripe-cereal visible spectra;
 * ECOSTRESS/ASTER dry-grass, Meerdink 2019 / Baldridge 2009). Healthy
 * canopy: chlorophyll absorbs blue (~450) and red (~670), reflects a
 * modest green plateau (~550) -> dark desaturated green. Senescence:
 * chlorophyll goes, carotenoids (yellow-orange) then anthocyanins (red)
 * dominate, visible reflectance rises and reddens -> gold/orange, and
 * the canopy BRIGHTENS. Flowers add their pigment (rape carotenoid
 * yellow: green+red high, blue low; lavender anthocyanin: blue+red over
 * green). Values are fractions (0-1) at nm; linear interpolation between.
 */

import {CIE_1931_2DEG, XYZ_TO_LINEAR_SRGB} from './ocean-color.js';

// Measured visible band reflectance [nm, fraction] per surface.
export const MEASURED_VIS = {
  // conifer / needleleaf: darker than broadleaf, green-peaked
  conifer: [
    [400, 0.035],
    [450, 0.035],
    [550, 0.08],
    [600, 0.05],
    [650, 0.035],
    [700, 0.09]
  ],
  // broadleaf deciduous green canopy through the season
  broadleaf_summer: [
    [400, 0.045],
    [450, 0.045],
    [550, 0.115],
    [600, 0.065],
    [650, 0.045],
    [700, 0.12]
  ],
  broadleaf_spring: [
    [400, 0.05],
    [450, 0.05],
    [550, 0.15],
    [600, 0.08],
    [650, 0.06],
    [700, 0.16]
  ],
  // peak-autumn gold-orange: carotenoid, red reflectance climbs
  broadleaf_autumn: [
    [400, 0.06],
    [450, 0.07],
    [500, 0.11],
    [550, 0.2],
    [600, 0.32],
    [650, 0.4],
    [700, 0.45]
  ],
  // winter bare: brown branches over leaf litter, flat-ish rising
  broadleaf_bare: [
    [400, 0.12],
    [450, 0.13],
    [550, 0.17],
    [600, 0.2],
    [650, 0.22],
    [700, 0.24]
  ],
  // crops
  maize_green: [
    [400, 0.035],
    [450, 0.035],
    [550, 0.09],
    [600, 0.05],
    [650, 0.035],
    [700, 0.1]
  ],
  cereal_ripe: [
    [400, 0.12],
    [450, 0.13],
    [500, 0.18],
    [550, 0.28],
    [600, 0.36],
    [650, 0.4],
    [700, 0.44]
  ], // bright golden
  rape_bloom: [
    [400, 0.07],
    [450, 0.07],
    [500, 0.12],
    [550, 0.3],
    [600, 0.34],
    [650, 0.3],
    [700, 0.34]
  ], // brilliant yellow (green+red high, blue low)
  lavender_bloom: [
    [400, 0.16],
    [450, 0.2],
    [500, 0.15],
    [550, 0.1],
    [600, 0.13],
    [650, 0.19],
    [700, 0.23]
  ], // violet-purple (blue+red over green)
  cotton_boll: [
    [400, 0.55],
    [450, 0.6],
    [550, 0.68],
    [600, 0.7],
    [650, 0.7],
    [700, 0.7]
  ], // white
  // grass (centralised; grassland.js uses the same physics)
  green_grass: [
    [400, 0.045],
    [450, 0.045],
    [500, 0.055],
    [550, 0.11],
    [600, 0.065],
    [650, 0.05],
    [700, 0.1]
  ],
  dry_grass: [
    [400, 0.157],
    [450, 0.155],
    [500, 0.18],
    [550, 0.21],
    [600, 0.26],
    [650, 0.3],
    [700, 0.34]
  ]
};

const interp = (a, l) => {
  if (l <= a[0][0]) return a[0][1];
  if (l >= a[a.length - 1][0]) return a[a.length - 1][1];
  for (let i = 0; i < a.length - 1; i++) {
    const [l0, r0] = a[i];
    const [l1, r1] = a[i + 1];
    if (l >= l0 && l <= l1) return r0 + ((r1 - r0) * (l - l0)) / (l1 - l0);
  }
  return a[a.length - 1][1];
};

const gamma = (c) =>
  c <= 0.0031308
    ? 12.92 * c
    : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;

// A reflectance spectrum (band anchors, or a MEASURED_VIS key) -> its
// D65 true colour: {lin (linear sRGB), srgb (gamma-encoded display),
// Y (luminous reflectance)}. Integrated over the CIE 1931 2 deg CMFs
// weighted by the D65 SPD, normalised so a perfect diffuser is white.
export function bandColor(anchorsOrKey) {
  const a =
    typeof anchorsOrKey === 'string'
      ? MEASURED_VIS[anchorsOrKey]
      : anchorsOrKey;
  let X = 0;
  let Y = 0;
  let Z = 0;
  let N = 0;
  for (const [lam, xb, yb, zb, d65] of CIE_1931_2DEG) {
    if (lam < 400 || lam > 700) continue;
    const R = interp(a, lam);
    X += R * d65 * xb;
    Y += R * d65 * yb;
    Z += R * d65 * zb;
    N += d65 * yb;
  }
  X /= N;
  Y /= N;
  Z /= N;
  const M = XYZ_TO_LINEAR_SRGB;
  const lin = [
    M[0][0] * X + M[0][1] * Y + M[0][2] * Z,
    M[1][0] * X + M[1][1] * Y + M[1][2] * Z,
    M[2][0] * X + M[2][1] * Y + M[2][2] * Z
  ];
  return {lin, srgb: lin.map(gamma), Y};
}
