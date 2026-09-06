/**
 * rainshafts.js - the rain the satellite measures, seen falling where
 * it falls. NOAA's rainfall rate pixels within reach of the view
 * (goesl2.rainList, navigated to their places by the fixed grid's
 * own equations) become rain shafts: a grey curtain hung from the
 * cloud base to the ground at each pixel's bearing and distance,
 * its opacity the optical depth of the rain itself. Pure JS (no
 * renderer import), gated by rainshafts-reference.mjs; the theme
 * places and draws them.
 *
 * THE LAW: Atlas (1953), "Optical extinction by rainfall", J.
 * Meteor. 10, 486-488 - the extinction coefficient of rain per
 * kilometre of path from the Marshall-Palmer drop spectrum:
 * sigma_e = 0.25 R^0.63 km^-1 for Bergeron-process rain (R in
 * mm/h), an order of magnitude more for orographic rain (a between
 * 1.25 and 2.6) - as quoted by two open sources (US patent 9,621,265
 * and Reyes et al. 2025, Atmosfera; the AMS page itself is behind a
 * wall, stated). A shaft seen through its own 2-km pixel has optical
 * depth tau = sigma_e L; what the eye sees of the world behind it is
 * exp(-tau), so the curtain's opacity is 1 - exp(-tau): 1 mm/h
 * through 2 km is 0.39, 10 mm/h 0.88, drizzle at 0.2 mm/h 0.18.
 * Koschmieder's 3/sigma gives the visibility inside the rain (12 km
 * at 1 mm/h, 2.8 km at 10) - stated beside it, not drawn.
 */
import {rangeBearing} from './wildfire.js';

export const RAIN_EXTINCTION = {
  source: 'Atlas 1953, J. Meteor. 10, 486-488',
  a: 0.25, // km^-1 at 1 mm/h, Bergeron-process rain
  b: 0.63,
  orographicA: [1.25, 2.6],
  pixelPathKm: 2, // the ABI pixel the shaft is measured over
  koschmieder: 3 // MOR = 3 / sigma (contrast threshold 0.05)
};

/** Atlas's extinction coefficient (km^-1) at a rain rate (mm/h). */
export function rainExtinctionPerKm(mmh, a = RAIN_EXTINCTION.a, b = RAIN_EXTINCTION.b) {
  return mmh > 0 ? a * Math.pow(mmh, b) : 0;
}

/** The optical depth of a path (km) through rain at a rate. */
export function rainOpticalDepth(mmh, pathKm = RAIN_EXTINCTION.pixelPathKm) {
  return rainExtinctionPerKm(mmh) * pathKm;
}

/** What a curtain of rain hides: 1 - exp(-tau) over the pixel's path. */
export function shaftOpacity(mmh, pathKm = RAIN_EXTINCTION.pixelPathKm) {
  return 1 - Math.exp(-rainOpticalDepth(mmh, pathKm));
}

/** Koschmieder's meteorological optical range inside the rain (km). */
export function rainVisibilityKm(mmh) {
  const s = rainExtinctionPerKm(mmh);
  return s > 0 ? RAIN_EXTINCTION.koschmieder / s : Infinity;
}

/**
 * The raining pixels within maxKm of (lat, lon) as shafts: each with
 * its distance, bearing, rate, optical depth and opacity, nearest
 * first, capped. Pixels under minMmH (drizzle the eye would not see
 * as a curtain) are left out; a degraded pixel (past the zenith
 * block-out) is kept and flagged.
 */
export function rainShaftsNear(list, lat, lon, {maxKm = 100, cap = 160, minMmH = 0.2} = {}) {
  const out = [];
  for (const p of list || []) {
    if (!(p.mmh >= minMmH)) continue;
    const rb = rangeBearing(lat, lon, p.latDeg, p.lonDeg);
    if (rb.distKm > maxKm) continue;
    const tau = rainOpticalDepth(p.mmh);
    out.push({
      lat: p.latDeg,
      lon: p.lonDeg,
      mmh: p.mmh,
      quality: p.quality ?? 'good',
      distKm: rb.distKm,
      bearingDeg: rb.bearingDeg,
      tau,
      opacity: 1 - Math.exp(-tau)
    });
  }
  out.sort((a, b) => a.distKm - b.distKm);
  return out.slice(0, cap);
}

/** The shafts' words for a line: how many, the nearest, the heaviest. */
export function rainShaftsSummary(shafts) {
  if (!shafts || !shafts.length) return null;
  let heaviest = shafts[0];
  for (const s of shafts) if (s.mmh > heaviest.mmh) heaviest = s;
  const nearest = shafts[0];
  return {
    n: shafts.length,
    nearestKm: nearest.distKm,
    nearestBearingDeg: nearest.bearingDeg,
    nearestMmH: nearest.mmh,
    heaviestMmH: heaviest.mmh,
    heaviestKm: heaviest.distKm,
    heaviestOpacity: heaviest.opacity
  };
}
