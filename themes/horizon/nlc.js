/**
 * Noctilucent clouds - the single source shared by the theme's
 * NLC shell (Horizon.html / sky-objects-tsl.js) and the reference
 * printer (nlc-reference.mjs).
 *
 * Polar mesospheric ice at h ~ 83 km (the coldest place on
 * Earth: the summer mesopause), visible ONLY in the twilight
 * wedge where the observer stands in darkness while the shell
 * overhead is still in sunlight. The geometry is EXACT and the
 * classical visibility window falls out of it rather than being
 * put in:
 *
 *  - A sky direction is traced to the 83-km shell (closed-form
 *    ray-sphere solve from the observer on a spherical Earth of
 *    IUGG radius, shared with lightning.js).
 *  - The shell point is sunlit unless it sits inside the Earth's
 *    shadow CYLINDER, widened by the twilight screening height
 *    (~30 km: the lower atmosphere is opaque to grazing rays -
 *    Rozenberg's classical twilight treatment, the same source
 *    as the theme's airmass formula).
 *  - Derived, not assumed: overhead the shell darkens at solar
 *    depression acos(R/(R+h)) = 9.2 deg; toward the sunward
 *    horizon the LAST sunlit patch dies at ~16.6 deg - the
 *    published "NLC window: sun 6-16 deg below the horizon"
 *    (Gadsden & Schroeder 1989) emerges from the cylinder
 *    geometry to within half a degree. The 6-deg lower bound is
 *    the sky-brightness gate (civil twilight drowns them), kept
 *    as the documented display threshold.
 *
 * Occurrence: NLC are a HIGH-LATITUDE SUMMER phenomenon - the
 * season envelope (raised cosine from ~30 days before to ~65
 * after the summer solstice, peaking ~3 weeks after it) and the
 * 50-65 deg latitude ramp follow the satellite/lidar climatology
 * shape (DeLand et al. 2003 SBUV; Fiedler et al. 2011 ALOMAR);
 * night-to-night variability is deliberately left out - when the
 * season, latitude and geometry allow, the display shows the
 * climatological-mean veil (documented display choice; no live
 * NLC feed exists to measure tonight's display).
 */

import {R_EARTH} from './lightning.js';

export const NLC_H_KM = 83; // canonical mesopause cloud height
export const SCREEN_KM = 30; // twilight screening height
export const BETA_MIN_DEG = 6; // sky-brightness gate (published)

// Distance along a view ray (elevation elev rad) from the
// observer to the h-km shell - closed form on the spherical
// Earth. Always positive (the shell encloses the observer).
export function shellDistanceKm(elev, hKm = NLC_H_KM) {
  const R = R_EARTH;
  const se = Math.sin(elev);
  return Math.sqrt(R * R * se * se + hKm * (2 * R + hKm)) - R * se;
}

// Is the shell point along (elev, azimuth-from-sun dAz) sunlit at
// solar depression beta (all radians)? Exact vector construction:
// observer at geocentric (0,0,R); sun toward azimuth 0 at
// elevation -beta; shadow cylinder of radius R + screen behind
// the Earth.
export function sunlitAtShell(
  elev,
  dAz,
  beta,
  hKm = NLC_H_KM,
  screenKm = SCREEN_KM
) {
  const R = R_EARTH;
  const t = shellDistanceKm(elev, hKm);
  const v = [
    Math.cos(elev) * Math.cos(dAz),
    Math.cos(elev) * Math.sin(dAz),
    Math.sin(elev)
  ];
  const P = [t * v[0], t * v[1], R + t * v[2]]; // geocentric
  const s = [Math.cos(beta), 0, -Math.sin(beta)]; // toward sun
  const along = P[0] * s[0] + P[1] * s[1] + P[2] * s[2];
  if (along >= 0) return true; // sun side of the terminator plane
  const px = P[0] - along * s[0];
  const py = P[1] - along * s[1];
  const pz = P[2] - along * s[2];
  const perp = Math.sqrt(px * px + py * py + pz * pz);
  return perp > R + screenKm;
}

// Solar depression (rad) at which the shell point in direction
// (elev, dAz) enters shadow - bisection on the exact test.
export function shadowEntryDepression(
  elev,
  dAz,
  hKm = NLC_H_KM,
  screenKm = SCREEN_KM
) {
  let lo = 0;
  let hi = Math.PI / 4;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (sunlitAtShell(elev, dAz, mid, hKm, screenKm)) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Season/latitude envelope (0..1): raised cosine over
// [solstice - 32 d, solstice + 65 d] peaking 22 days after the
// summer solstice of the observer's hemisphere (the DeLand/
// Fiedler climatology shape), times a 50 -> 58 deg latitude
// ramp. doy = day of year (1..366).
export function seasonEnvelope(doy, latDeg) {
  const absLat = Math.abs(latDeg);
  if (absLat < 50) return 0;
  const latRamp = Math.min((absLat - 50) / 8, 1);
  const solstice = latDeg >= 0 ? 172 : 355; // Jun 21 / Dec 21
  let d = doy - solstice;
  if (d > 182.5) d -= 365;
  if (d < -182.5) d += 365;
  const peak = 22;
  const half = d < peak ? 54 : 43; // -32..+65 window
  const x = (d - peak) / half;
  if (x <= -1 || x >= 1) return 0;
  return 0.5 * (1 + Math.cos(Math.PI * x)) * latRamp;
}
