/**
 * modis-land.js - the ORNL DAAC MODIS land feeds' pure pieces, shared
 * by the theme (Horizon.html fetches them DIRECTLY) and the horizon-live
 * daemon (server/src/index.mjs re-exports them for its optional proxy),
 * gated by modis-land-reference.mjs.
 *
 * The ORNL DAAC MODIS/VIIRS Web Service serves ONE MODIS pixel for a
 * lat/lon as JSON, no key, CORS-open (it answers Access-Control-Allow-
 * Origin), so the browser fetches it itself - it is a public science
 * service built for many clients, and this site is small. Two feeds,
 * both a two-step /dates-then-/subset point query whose URLs are built
 * HERE from the snapped cell and a resolved composite date only (never a
 * caller-supplied URL - a point-query proxy, not a general fetcher):
 *
 *  - NDVI: MOD13Q1 (Terra, 250 m, 16-day composite) greenness, the land
 *    twin of the ocean-colour feed.
 *  - Surface reflectance: MOD09A1 (Terra, 500 m, 8-day, atmospherically
 *    corrected) visible bands b03/b04/b01, the MEASURED land colour
 *    (surface-color.js integrates the three bands through CIE), gated by
 *    its sur_refl_state_500m QA bitfield so a cloud/shadow pixel is
 *    rejected in favour of the tuned grass rather than shown as truth.
 */

// ---- Land greenness: MODIS NDVI (MOD13Q1) ----------------------
const NDVI_BAND = '250m_16_days_NDVI';
const ORNL_MOD13Q1 = 'https://modis.ornl.gov/rst/api/v1/MOD13Q1';

// Snap to a ~0.01-deg cell for cache coherence (many viewers in one
// place cost one upstream query); the service nearest-neighbours the
// snapped point to its containing 250 m pixel.
export function ndviCell(lat, lon) {
  const snap = (x, n) => Math.round(Math.max(-n, Math.min(n, x)) * 100) / 100;
  return {lat: snap(lat, 90), lon: snap(lon, 180)};
}

// The /dates URL for a cell - resolves the composite calendar (the
// latest Ayyyyddd is what /subset then queries).
export function ndviDatesUrl(cell) {
  return `${ORNL_MOD13Q1}/dates?latitude=${cell.lat}&longitude=${cell.lon}`;
}

// The /subset point URL, built from the snapped cell and a resolved
// composite date only.
export function ndviUrl(cell, date) {
  return (
    `${ORNL_MOD13Q1}/subset?latitude=${cell.lat}&longitude=${cell.lon}` +
    `&startDate=${date}&endDate=${date}&band=${NDVI_BAND}` +
    '&kmAboveBelow=0&kmLeftRight=0'
  );
}

// The latest composite date (MODIS Ayyyyddd) from a /dates response;
// null if the calendar is missing or malformed.
export function ndviDate(j) {
  const ds = j?.dates;
  if (!Array.isArray(ds) || !ds.length) return null;
  const m = ds[ds.length - 1]?.modis_date;
  return typeof m === 'string' && /^A\d{7}$/.test(m) ? m : null;
}

// null = unusable response (-> 502); {ndvi: null} = a real answer
// (no land measure here) and cached like any success, exactly as
// chlor's land null. An empty subset is the service's answer for a
// water/off-land point (200 with subset: []); a present pixel with a
// -3000 fill or out-of-range value is a masked land pixel. Stored NDVI
// is scaled by 1e-4 over the valid range -2000..10000 (-0.2..1.0).
export function parseNdvi(j) {
  if (!j || !Array.isArray(j.subset)) return null;
  const s = j.subset[0];
  if (!s) return {ndvi: null, date: null}; // no pixel: ocean/off-land
  if (!Array.isArray(s.data) || typeof s.data[0] !== 'number') return null;
  const raw = s.data[0];
  const ok = raw >= -2000 && raw <= 10000;
  return {
    ndvi: ok ? raw * 1e-4 : null,
    date: typeof s.calendar_date === 'string' ? s.calendar_date : null
  };
}

// ---- Land colour: MODIS surface reflectance (MOD09A1) ----------
// MOD09A1 is raw SR, not BRDF-normalised NBAR (MCD43A4 is not point-
// queryable on ORNL). The cell snap is ndviCell (0.01 deg - the model
// lives once).
export const MOD09_BANDS = {
  blue: 'sur_refl_b03',
  green: 'sur_refl_b04',
  red: 'sur_refl_b01'
};
export const MOD09_STATE_BAND = 'sur_refl_state_500m';
const ORNL_MOD09A1 = 'https://modis.ornl.gov/rst/api/v1/MOD09A1';

export function surfaceDatesUrl(cell) {
  return `${ORNL_MOD09A1}/dates?latitude=${cell.lat}&longitude=${cell.lon}`;
}

export function surfaceUrl(cell, date, band) {
  return (
    `${ORNL_MOD09A1}/subset?latitude=${cell.lat}&longitude=${cell.lon}` +
    `&startDate=${date}&endDate=${date}&band=${band}` +
    '&kmAboveBelow=0&kmLeftRight=0'
  );
}

// null = unusable response (-> 502); {refl: null} = a real no-measure
// answer (empty subset over ocean/off-land, or a fill/out-of-range
// pixel). MOD09A1 stores reflectance*1e-4 over the valid range
// -100..16000; the -28672 fill and anything outside read null, and a
// small negative reflectance is clamped up to 0.
export function parseSurface(j) {
  if (!j || !Array.isArray(j.subset)) return null;
  const s = j.subset[0];
  if (!s) return {refl: null, date: null};
  if (!Array.isArray(s.data) || typeof s.data[0] !== 'number') return null;
  const raw = s.data[0];
  const ok = raw >= -100 && raw <= 16000;
  return {
    refl: ok ? Math.max(0, raw * 1e-4) : null,
    date: typeof s.calendar_date === 'string' ? s.calendar_date : null
  };
}

// The raw integer of the sur_refl_state_500m QA band from a subset
// response (null if malformed).
export function parseSurfaceState(j) {
  if (!j || !Array.isArray(j.subset)) return null;
  const s = j.subset[0];
  if (!s || !Array.isArray(s.data) || typeof s.data[0] !== 'number')
    return null;
  return s.data[0];
}

// Decode the MOD09A1 sur_refl_state_500m bitfield and decide whether the
// pixel's colour is trustworthy. Bit layout (LP DAAC / verified): bits
// 0-1 cloud state (0 clear, 1 cloudy, 2 mixed, 3 assumed clear), bit 2
// cloud shadow, bits 8-9 cirrus (0 none .. 3 high), bit 10 internal
// cloud flag. A cloudy/mixed/shadowed/thick-cirrus/internal-cloud pixel
// is contaminated (the Amazon 138 = mixed cloud is exactly this case),
// so its measured colour is rejected in favour of the tuned grass.
export function surfaceQaClean(state) {
  if (typeof state !== 'number' || !Number.isFinite(state)) return false;
  const cloud = state & 0b11; // bits 0-1
  if (cloud === 1 || cloud === 2) return false; // cloudy or mixed
  if ((state >> 2) & 1) return false; // bit 2 cloud shadow
  if (((state >> 8) & 0b11) === 3) return false; // bits 8-9 cirrus high
  if ((state >> 10) & 1) return false; // bit 10 internal cloud
  return true;
}
