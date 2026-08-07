/**
 * stratos.js - the stratospheric (Junge) aerosol layer and the
 * twilight purple light it scatters. The theme's mie layer hugs
 * the ground (1.2 km scale height), so minutes after sunset every
 * drawn aerosol sits in the planet's shadow - yet the real sky
 * keeps a lit scatterer: the background sulfate layer at 15-25 km.
 * This module adds that layer as a single-scatter term over the
 * dome, with every constant printed:
 *
 *  - Lee & Hernandez-Andres 2003 (Applied Optics 42, 445,
 *    "Measuring and modeling twilight's purple light" - read in
 *    full): the mechanism - the purple light's reds are
 *    TROPOSPHERICALLY reddened transmitted sunlight singly
 *    scattered in the stratosphere (their Sec. 7; the
 *    stratosphere alone "at most yellows" it), against the
 *    ozone/molecular blue the dome already marches. Their
 *    Table 2 prints the evening window at view elevation 20 deg:
 *    start h0 = -1.41 +- 0.93, maximum purity -3.89 +- 0.71,
 *    end -7.37 +- 0.56 - the gate's anchors. Scatterers:
 *    sulfuric-acid droplets, median radii < 0.1 um.
 *  - Kremser et al. 2016 (Rev. Geophys. 54, 278, "Stratospheric
 *    aerosol" - read in full, all 59 pages): the layer sits at
 *    15-25 km with its peak near 20 km (their Sec. 1, after
 *    Junge 1961); during volcanically quiescent periods the
 *    aerosol is "only 5 to 10% above molecular levels" in
 *    CALIPSO 532 nm backscatter (their Sec. 4.3), and the
 *    stratospheric aerosol lidar ratio is "typically between 45
 *    and 50 sr" (their Sec. 4.2). With the EXACT molecular
 *    lidar ratio 8 pi / 3 those three printed numbers fix the
 *    layer's EXTINCTION as a fraction of the molecular
 *    extinction inside it - no new unit constant enters, the
 *    amplitude rides the theme's own Hillaire Rayleigh scale:
 *      f_ext = (0.05..0.10) x (45..50) / (8 pi / 3)
 *            = 0.27..0.60  (log-mid 0.40).
 *    Integrated over the printed layer against the shipped
 *    profile this lands the background stratospheric AOD at
 *    0.0036..0.0081 (mid 0.0054) - the review's own Fig. 4/10
 *    quiescent record (~0.003-0.006) sits inside the bracket.
 *    Their printed 525/750/1020 nm record (Fig. 10) reads to an
 *    Angstrom exponent near 1.2-1.5; the midpoint 1.35 spreads
 *    the 532 nm anchor across the theme's three channels (a
 *    documented graph-read - the one number here not from body
 *    text). The nonvolcanic size (radius < 0.2 um printed;
 *    OSIRIS retrieval median 80 nm) justifies the Rayleigh
 *    phase SHAPE as the dipole limit (stated reduction), and
 *    sulfate in the visible is taken purely scattering.
 *
 * volcScale is the stage-2 hook: Kremser prints the sulfate
 * e-folding time (~1 year, after Robock 2000) and Table 1 the
 * moderate-eruption SO2 masses - a live OMPS/GIBS feed can
 * scale the layer through it; until that lands it stays 1
 * (background), and the term is linear in it by construction.
 *
 * Documented scope: single scattering only - Lee's printed END
 * (-7.37 deg at view 20 deg) includes light the straight-line
 * term cannot carry there (the layer at that view is hard-
 * shadowed by -5.7 deg; the surviving low-view term reproduces
 * the end near the horizon instead - the gate holds both), and
 * grazing refraction (~0.5 deg) is not bent into the shadow.
 */

import {sunTransmittanceJS, pathToRadiusT} from './sun-transmittance.js';

// The shipped Hillaire Rayleigh frame (sun-transmittance.js
// verbatim): per-metre betas at h = 0 for the theme's 680/550/
// 440 nm channels, scale height 8 km.
export const RAY_BETA = [5.802e-6, 13.558e-6, 33.1e-6];
export const RAY_H_M = 8000;
export const THEME_LAMBDA_NM = [680, 550, 440];

// ---- Kremser 2016, printed ----
export const STRAT_BASE_M = 15000; // layer 15-25 km, peak ~20
export const STRAT_TOP_M = 25000;
export const BS_RATIO_RANGE = [0.05, 0.1]; // above molecular, 532
export const LIDAR_SR_RANGE = [45, 50]; // stratospheric aerosol
export const MOL_LIDAR_SR = (8 * Math.PI) / 3; // exact Rayleigh
// Aerosol extinction as a fraction of molecular INSIDE the layer
// (532 nm): log-mid of the printed ranges over the exact ratio.
export const EXT_FRAC =
  (Math.sqrt(0.05 * 0.1) * Math.sqrt(45 * 50)) / MOL_LIDAR_SR;
export const EXT_FRAC_RANGE = [
  (0.05 * 45) / MOL_LIDAR_SR,
  (0.1 * 50) / MOL_LIDAR_SR
];
export const ANGSTROM = 1.35; // Fig. 10 graph-read, documented

// Molecular beta at the CALIPSO anchor wavelength from the
// shipped 550 nm channel (exact lambda^-4).
export const RAY_BETA_532 = RAY_BETA[1] * Math.pow(550 / 532, 4);

// Per-channel aerosol scattering beta at height h (m): the
// printed fraction of the molecular profile at 532, spread by
// the Angstrom slope.
export function stratBeta(c, hM) {
  if (hM < STRAT_BASE_M || hM > STRAT_TOP_M) return 0;
  return (
    EXT_FRAC *
    RAY_BETA_532 *
    Math.exp(-hM / RAY_H_M) *
    Math.pow(532 / THEME_LAMBDA_NM[c], ANGSTROM)
  );
}

// The background stratospheric AOD the chain implies (vertical,
// 532 nm) - the gate holds it inside the printed record band.
export function stratAOD532() {
  return (
    EXT_FRAC *
    RAY_BETA_532 *
    RAY_H_M *
    (Math.exp(-STRAT_BASE_M / RAY_H_M) - Math.exp(-STRAT_TOP_M / RAY_H_M))
  );
}

const RB = 6360e3;
// Distance along a ray (cos zenith mu from radius r0) to the
// crossing of radius rt (outward branch).
function distToRadius(r0, mu, rt) {
  const b = r0 * mu;
  const disc = b * b + rt * rt - r0 * r0;
  if (disc < 0) return -1;
  return -b + Math.sqrt(disc);
}

// Single-scatter radiance of the layer, per unit source TOA
// irradiance (1/sr), per channel. View: elevation hView (rad),
// azimuth dPhi from the sun's azimuth. Sun at sunAlt (rad).
// mie: the theme's live aerosol set (tropospheric reddening of
// both legs). volcScale scales the layer linearly (stage-2
// hook; 1 = background).
export function stratLayerRadiance(
  hView,
  dPhi,
  sunAlt,
  mie,
  eyeM = 300,
  volcScale = 1
) {
  const mu = Math.sin(hView);
  const r0 = RB + Math.max(eyeM, 0);
  const s0 = distToRadius(r0, mu, RB + STRAT_BASE_M);
  const s1 = distToRadius(r0, mu, RB + STRAT_TOP_M);
  if (!(s1 > 0) || !(s1 > s0)) return [0, 0, 0];
  const sLo = Math.max(s0, 0);
  const cs = Math.cos(sunAlt);
  const ss = Math.sin(sunAlt);
  const vx = Math.cos(hView) * Math.cos(dPhi);
  const vy = Math.cos(hView) * Math.sin(dPhi);
  // Scattering angle is fixed along the straight ray: between
  // the beam and the view direction (dipole/Rayleigh shape at
  // the printed sub-0.1 um sizes).
  const cosTh = vx * cs + mu * ss;
  const phase = (3 / (16 * Math.PI)) * (1 + cosTh * cosTh);
  const N = 8;
  const ds = (s1 - sLo) / N;
  const out = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const s = sLo + (i + 0.5) * ds;
    const px = s * vx;
    const py = s * vy;
    const pz = r0 + s * mu;
    const rP = Math.sqrt(px * px + py * py + pz * pz);
    const hP = rP - RB;
    // Local sun elevation cosine at the sample: the beam's
    // grazing geometry, planet shadow included by the
    // transmittance itself.
    const muS = (px * cs + pz * ss) / rP;
    const tSun = sunTransmittanceJS(muS, mie, hP);
    if (tSun[0] + tSun[1] + tSun[2] === 0) continue;
    const tView = pathToRadiusT(mu, mie, eyeM, hP);
    for (let c = 0; c < 3; c++) {
      out[c] += stratBeta(c, hP) * volcScale * phase * tSun[c] * tView[c] * ds;
    }
  }
  return out;
}

// The drawn grid: relative azimuth x elevation, RGBA float rows
// (alpha 1). Elevation spans the whole dome to the zenith (the
// purple light can climb past mid-sky; Lee's region is
// "eyelid-shaped" around the solar azimuth), azimuth the full
// circle.
export const STRAT_TEX_W = 24;
export const STRAT_TEX_H = 16;
export const STRAT_EL_MAX = Math.PI / 2;
export function fillStratTexture(data, sunAlt, mie, eyeM, volcScale = 1) {
  for (let j = 0; j < STRAT_TEX_H; j++) {
    const el = ((j + 0.5) / STRAT_TEX_H) * STRAT_EL_MAX;
    for (let i = 0; i < STRAT_TEX_W; i++) {
      const dPhi = ((i + 0.5) / STRAT_TEX_W - 0.5) * 2 * Math.PI;
      const L = stratLayerRadiance(el, dPhi, sunAlt, mie, eyeM, volcScale);
      const k = (j * STRAT_TEX_W + i) * 4;
      data[k] = L[0];
      data[k + 1] = L[1];
      data[k + 2] = L[2];
      data[k + 3] = 1;
    }
  }
  return data;
}
