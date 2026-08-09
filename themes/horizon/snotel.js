/**
 * snotel.js - MEASURED snow depth: the NRCS SNOTEL network's
 * snow pillows and depth sensors outrank the model snow depth
 * where one is near - the USGS-rivers pattern (the AWDB REST API
 * is the repo's second CORS-open feed: browser-direct, keyless,
 * no daemon). Gated by snotel-reference.mjs on a vendored real
 * winter response (Red Mountain Pass, CO - 713:CO:SNTL).
 *
 * THE FEED - wcc.sc.egov.usda.gov/awdbRestApi/services/v1:
 *   /stations             station triplets with lat/lon and
 *                         elevation in FEET
 *   /data?stationTriplets=T&elements=SNWD,WTEQ&duration=DAILY
 *                         daily snow depth / water equivalent
 *                         in INCHES
 * Unit conversions are exact by definition (the international
 * inch is 25.4 mm): IN_M = 0.0254; feet ride contrails.js's
 * gated FT_M.
 *
 * DOCUMENTED GATES: SNOTEL_MAX_KM = 40 (the USGS gauge radius -
 * the basin scale) and SNOTEL_MAX_DELEV_M = 300: mountain snow
 * is elevation-banded, and 300 m moves the ISA lapse (the
 * refraction chain's own 6.5 K/km) by under 2 degC - a station
 * outside that band measures a different snowpack and the model
 * stands.
 */

import {FT_M} from './contrails.js';

export const SNOTEL_BASE =
  'https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1';
export const SNOTEL_MAX_KM = 40;
export const SNOTEL_MAX_DELEV_M = 300;
// Daily telemetry plus the morning report lag - a reading older
// than two days means the pillow went quiet and the model stands.
export const SNOTEL_FRESH_D = 2;
export const IN_M = 0.0254;

// /stations rows -> SNOTEL-only entries with metric elevation.
// The endpoint returns every AWDB network; only ':SNTL' triplets
// carry pillows.
export function parseSnotelStations(rows) {
  const out = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r.stationTriplet !== 'string') continue;
    if (!r.stationTriplet.endsWith(':SNTL')) continue;
    if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) continue;
    out.push({
      triplet: r.stationTriplet,
      name: r.name || r.stationTriplet,
      lat: r.latitude,
      lon: r.longitude,
      elevM: Number.isFinite(r.elevation) ? r.elevation * FT_M : null
    });
  }
  return out;
}

// /data response -> the newest finite daily readings in metres:
// {date, snwdM, wteqM}. Either element may be missing on a given
// station (some pillows lack depth sensors) - null, not 0: a
// missing sensor is not bare ground.
export function snotelLatestM(payload) {
  const st = Array.isArray(payload) ? payload[0] : null;
  if (!st || !Array.isArray(st.data)) return null;
  const latest = (code) => {
    for (const el of st.data) {
      if (el?.stationElement?.elementCode !== code) continue;
      const vals = (el.values || [])
        .filter((v) => v && Number.isFinite(v.value))
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      if (vals.length) return vals[0];
    }
    return null;
  };
  const d = latest('SNWD');
  const w = latest('WTEQ');
  if (!d && !w) return null;
  return {
    date: (d || w).date,
    snwdM: d ? d.value * IN_M : null,
    wteqM: w ? w.value * IN_M : null
  };
}
