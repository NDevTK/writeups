/**
 * METAR - the single source shared by the horizon-live daemon
 * (server/src/index.mjs; install.sh ships this file beside it,
 * the same pattern as lightning.js/solarwind.js), the theme
 * (Horizon.html) and the reference printer (metar-reference.mjs).
 *
 * Aerodromes MEASURE the sky: a ceilometer reads each cloud
 * layer's base off a laser return, visibility comes off a
 * transmissometer or a trained observer, and the report is the
 * aviation-legal record of what the sky is actually doing. The
 * theme has modelled cloud-base height with Espy's LCL estimate
 * (125 m per degree of dewpoint spread) - a nearby fresh METAR
 * replaces that estimate with the measurement, and its layer
 * covers replace the model's low/mid/high percentages (the same
 * measured-beats-model rule the radar layer already follows).
 * Source: aviationweather.gov's data API (decoded JSON; no CORS,
 * so the daemon proxies with a per-area cache). Wire fixtures
 * captured live 2026-07-07.
 *
 *  - Cover fractions: FMH-1 (Federal Meteorological Handbook
 *    No. 1, ch. 9) defines the okta bands - FEW 1-2, SCT 3-4,
 *    BKN 5-7, OVC 8. A band maps to its midpoint (documented
 *    convention); sky-clear codes and CAVOK are exactly 0, VV
 *    (indefinite ceiling) is exactly 8.
 *  - Etages: WMO International Cloud Atlas mid-latitude levels -
 *    low below 2000 m, middle 2000-7000 m, high above. Each
 *    layer joins its etage by MEASURED base (feet -> metres by
 *    the exact international foot); an etage's cover is the MAX
 *    of its layers (cover is a ceiling fraction, not a sum).
 *  - Visibility: statute miles -> metres by the exact 1609.344;
 *    the API's "N+" strings mean "at least N" and map to N
 *    (a documented floor - the haze model can only be told what
 *    was measured).
 *  - Station choice: nearest FRESH report wins - a closer but
 *    stale station never beats a fresh one within range.
 */

import {haversineKm} from './lightning.js';

export const FT_M = 0.3048; // exact international foot
export const SM_M = 1609.344; // exact statute mile
export const ETAGE_LOW_M = 2000; // WMO low/middle boundary
export const ETAGE_MID_M = 7000; // WMO middle/high boundary
export const METAR_MAX_KM = 60; // a report speaks for ~this far
export const METAR_MAX_AGE_S = 5400; // 90 min: two report cycles

// FMH-1 okta band midpoints, eighths of sky.
export const OKTAS = {
  CAVOK: 0,
  CLR: 0,
  SKC: 0,
  NCD: 0,
  NSC: 0,
  FEW: 1.5,
  SCT: 3.5,
  BKN: 6,
  OVC: 8,
  VV: 8
};

export function coverFraction(cover) {
  const o = OKTAS[cover];
  return o === undefined ? null : o / 8;
}

// Decoded-API visibility (statute miles, number or "N+") -> m.
export function visibilityM(visib) {
  if (visib === null || visib === undefined) return null;
  const n = typeof visib === 'number' ? visib : parseFloat(String(visib));
  if (!Number.isFinite(n) || n < 0) return null;
  return n * SM_M;
}

// Layer list [{cover, base(ft AGL)}] -> etage covers (%) plus the
// lowest measured LOW-etage base in metres AGL (the deck the
// theme raymarches; null when no low layer reports a base).
export function etageCovers(clouds) {
  let low = 0;
  let mid = 0;
  let high = 0;
  let baseM = null;
  for (const c of Array.isArray(clouds) ? clouds : []) {
    const f = coverFraction(c.cover);
    if (f === null || f === 0) continue;
    const b = Number.isFinite(+c.base) ? +c.base * FT_M : null;
    if (b === null) continue;
    if (b < ETAGE_LOW_M) {
      low = Math.max(low, f);
      baseM = baseM === null ? b : Math.min(baseM, b);
    } else if (b < ETAGE_MID_M) {
      mid = Math.max(mid, f);
    } else {
      high = Math.max(high, f);
    }
  }
  return {low: low * 100, mid: mid * 100, high: high * 100, baseM};
}

// Strip a decoded-API response to the fields the model reads
// (the same frugality rule as the readsb normalizer): entries
// without a position or observation time are dropped.
export function normalizeMetars(list) {
  return (Array.isArray(list) ? list : [])
    .filter(
      (m) =>
        typeof m.lat === 'number' &&
        typeof m.lon === 'number' &&
        typeof m.obsTime === 'number'
    )
    .map((m) => ({
      id: m.icaoId,
      name: m.name,
      lat: m.lat,
      lon: m.lon,
      elev: m.elev,
      obsTime: m.obsTime,
      temp: m.temp,
      dewp: m.dewp,
      visib: m.visib ?? null,
      cover: m.cover ?? null,
      clouds: Array.isArray(m.clouds)
        ? m.clouds.map((c) => ({cover: c.cover, base: c.base}))
        : [],
      wx: m.wxString ?? null
    }));
}

// Nearest FRESH station to the visitor: staleness disqualifies
// before distance ranks - a closer but expired report never
// beats a fresh one in range. nowSec explicit (nothing here
// reads the wall clock).
export function pickStation(
  metars,
  lat,
  lon,
  nowSec,
  maxKm = METAR_MAX_KM,
  maxAgeS = METAR_MAX_AGE_S
) {
  let best = null;
  let bestKm = Infinity;
  for (const m of Array.isArray(metars) ? metars : []) {
    if (!(nowSec - m.obsTime >= 0 && nowSec - m.obsTime <= maxAgeS)) continue;
    const km = haversineKm(lat, lon, m.lat, m.lon);
    if (km > maxKm || km >= bestKm) continue;
    best = m;
    bestKm = km;
  }
  return best ? {...best, km: bestKm} : null;
}
