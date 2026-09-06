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
export function rainExtinctionPerKm(
  mmh,
  a = RAIN_EXTINCTION.a,
  b = RAIN_EXTINCTION.b
) {
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
export function rainShaftsNear(
  list,
  lat,
  lon,
  {maxKm = 100, cap = 160, minMmH = 0.2} = {}
) {
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

// ---- THE RAIN'S COVER WHERE NO RADAR SEES (167th pass) --------------
// The decks' measured cover field (the radar's, RM x RM texels over
// the world box, R = the local cover mapped from the rain rate: 0.95
// x smoothstep(rate, 0.05, 1)) says nothing under RainViewer's black.
// The satellite's raining pixels give the same field the same way:
// each pixel's 2-km footprint splatted over the texels it covers
// (equirectangular offsets from the observer, +x east, +z south, the
// mapping roam.geoToScene uses), the strongest rate keeping a texel,
// a zero border ring so the field fades at the world edge.
export const COVER_RATE_FLOOR_MMH = 0.05; // below drizzle nothing shows
export const COVER_RATE_FULL_MMH = 1; // saturate toward the cap by 1 mm/h
export const COVER_CAP = 0.95;
const M_LAT = 111320;
const smooth = (x, a, b) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** The local cover a rain rate maps to (the radar field's own rule). */
export function coverOfRate(mmh) {
  return COVER_CAP * smooth(mmh, COVER_RATE_FLOOR_MMH, COVER_RATE_FULL_MMH);
}
/**
 * The satellite's cover field: RM x RM RGBA float32 (R the cover, A
 * 1) spanning worldM metres centred on (lat, lon). Each raining pixel
 * within the box paints the texels its pixelM footprint touches with
 * coverOfRate, the larger value keeping a texel; the border ring
 * stays zero. Returns {data, rm, painted, pixels}.
 */
export function rainCoverField(
  list,
  lat,
  lon,
  {rm = 64, worldM = 16000, pixelM = 2000} = {}
) {
  const data = new Float32Array(rm * rm * 4);
  for (let k = 3; k < data.length; k += 4) data[k] = 1;
  const mPerTexel = worldM / rm;
  const mLon = Math.max(M_LAT * Math.cos((lat * Math.PI) / 180), 1e-6);
  let painted = 0;
  let pixels = 0;
  const half = pixelM / 2;
  for (const p of list || []) {
    const cover = coverOfRate(p.mmh);
    if (!(cover > 0)) continue;
    const xM = (p.lonDeg - lon) * mLon;
    const zM = -(p.latDeg - lat) * M_LAT;
    if (Math.abs(xM) > worldM / 2 + half || Math.abs(zM) > worldM / 2 + half)
      continue;
    pixels++;
    // the footprint [a, b) touches texels floor(a/T) .. ceil(b/T) - 1: a
    // pixel ending exactly on a texel edge does not paint the texel beyond
    // (an epsilon of a millionth of a texel keeps a footprint that ends
    // on a texel edge, to floating error, on its own side of it)
    const EPS = 1e-6;
    const i0 = Math.floor((xM - half + worldM / 2) / mPerTexel + EPS);
    const i1 = Math.ceil((xM + half + worldM / 2) / mPerTexel - EPS) - 1;
    const j0 = Math.floor((zM - half + worldM / 2) / mPerTexel + EPS);
    const j1 = Math.ceil((zM + half + worldM / 2) / mPerTexel - EPS) - 1;
    for (let jj = Math.max(j0, 1); jj <= Math.min(j1, rm - 2); jj++)
      for (let ii = Math.max(i0, 1); ii <= Math.min(i1, rm - 2); ii++) {
        const k = (jj * rm + ii) * 4;
        if (data[k] === 0) painted++;
        if (cover > data[k]) data[k] = cover;
      }
  }
  return {data, rm, painted, pixels};
}
/**
 * The merged measured cover: the radar's texel where the radar sees
 * it (covered[k] true), the satellite's where it does not. Returns
 * {data, fromRadar, fromSatellite} - the counts of texels each
 * measurement gave a cover above zero.
 */
export function mergeCoverFields(radar, satellite, covered, rm) {
  const data = new Float32Array(rm * rm * 4);
  let fromRadar = 0;
  let fromSatellite = 0;
  for (let t = 0; t < rm * rm; t++) {
    const k = t * 4;
    const useRadar = !covered || covered[t];
    const src = useRadar ? radar : satellite;
    data[k] = src ? src[k] : 0;
    data[k + 3] = 1;
    if (data[k] > 0) {
      if (useRadar) fromRadar++;
      else fromSatellite++;
    }
  }
  return {data, fromRadar, fromSatellite};
}
