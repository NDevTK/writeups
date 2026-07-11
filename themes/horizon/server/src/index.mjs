#!/usr/bin/env node
/**
 * horizon-live - the Horizon theme's live-data daemon, for a
 * small always-on server with its OWN IP address (a GCP free-tier
 * e2-micro fits: the global AIS picture is tens of MB and
 * aisstream's stated ~300 msg/s is trivial for node).
 *
 * Why a daemon instead of the (retired, deleted) Cloudflare
 * worker: every failure measured on the worker
 * had one root cause - Cloudflare's SHARED egress IPs look like
 * abuse upstream (adsb.lol tarpits them, adsb.fi 403s, OpenSky
 * drops them at the network; the same queries answer sub-second
 * from a single-tenant IP). A dedicated IP reopens the whole
 * upstream menu, and a resident process fixes what a per-request
 * worker never could:
 *  - ONE persistent aisstream.io WebSocket with a GLOBAL
 *    subscription (their design intent - the free tier allows
 *    few concurrent sockets), ingested into an in-memory
 *    last-position-per-MMSI table under a 1x1 degree spatial
 *    grid: any visitor anywhere is answered from RAM in
 *    microseconds, no per-request connect/subscribe dance
 *  - reconnect with exponential backoff + a stale-feed watchdog
 *  - richer aircraft feeds by failover (adsb.lol, adsb.fi,
 *    airplanes.live - all readsb v2) with a 15 s in-memory cache
 *  - /probe stays: run it ON the deployed box to measure what
 *    its IP can reach (including OpenSky) before trusting it
 *
 * Security posture (this is NOT an open CORS proxy):
 *  - Origin allowlist: browser requests carrying an Origin
 *    header outside ALLOW_ORIGIN are refused 403 and never get
 *    an access-control-allow-origin echo - only the website can
 *    use the API from a browser. Requests without Origin (curl,
 *    health checks) pass but receive no CORS grant.
 *  - per-IP token bucket (RATE_PER_MIN, default 60/min)
 *  - SSE backpressure: a stalled stream client is disconnected
 *    once its socket buffer exceeds SSE_BUFFER_MAX (256 KiB) -
 *    slow readers cannot grow this process's memory
 *  - GET/OPTIONS only, exact paths, numeric params validated and
 *    clamped
 *  - zero npm dependencies: node >= 22 built-ins only (http
 *    server + global WebSocket client) - nothing to audit
 *
 * Config (environment; see ../horizon-live.service):
 *   AISSTREAM_KEY  aisstream.io API key (without it /ais -> 503)
 *   PORT           listen port (default 8127, loopback for Caddy)
 *   HOST           bind address (default 127.0.0.1)
 *   ALLOW_ORIGIN   comma list (default https://ndevtk.github.io)
 *   RATE_PER_MIN   per-IP request budget (default 60)
 *   TRUST_PROXY    1 = take client IP from X-Forwarded-For
 *                  (default 1 - Caddy fronts this daemon)
 *
 * The pure pieces (schema normalizers, grid ingest/query/prune,
 * origin check, rate limiter, security headers, backpressure
 * predicate) are exported for the reference gate
 * (../../server-reference.mjs).
 */

import http from 'node:http';
import {haversineKm} from '../../lightning.js';
import {parseHemiPower, parsePropagated} from '../../solarwind.js';
import {normalizeMetars} from '../../metar.js';
import {parseHmsKml, smokeAt} from '../../smoke.js';
import {parseGrib2} from '../../grib2.js';
import {aerosolProducts} from '../../aerosol.js';

// Schema normalizers - moved here when the Cloudflare worker was
// retired and deleted (the daemon superseded it; git history
// holds the worker). All three remain reference-gated in
// server-reference.mjs.

// Strip readsb state vectors to the seven fields the theme reads
// (alt_baro stays in FEET, gs in KNOTS - the theme owns the exact
// conversions). Grounded (alt_baro === "ground") and incomplete
// vectors are dropped.
export function normalize(j) {
  return (Array.isArray(j.ac) ? j.ac : [])
    .filter(
      (a) =>
        typeof a.lat === 'number' &&
        typeof a.lon === 'number' &&
        typeof a.alt_baro === 'number' &&
        typeof a.gs === 'number' &&
        typeof a.track === 'number'
    )
    .map((a) => ({
      hex: a.hex,
      flight: ((a.flight || '') + '').trim(),
      lat: a.lat,
      lon: a.lon,
      alt_baro: a.alt_baro,
      gs: a.gs,
      track: a.track
    }));
}

// One AIS position report -> the six fields the theme reads.
// ITU-R M.1371 sentinels: Sog 102.3 kt, Cog 360, TrueHeading 511
// all mean "not available".
export function normalizeShip(meta, p) {
  return {
    mmsi: p.UserID,
    name: String((meta && meta.ShipName) || '').trim(),
    lat: p.Latitude,
    lon: p.Longitude,
    sog: typeof p.Sog === 'number' && p.Sog < 102.3 ? p.Sog : 0,
    cog: typeof p.Cog === 'number' && p.Cog < 360 ? p.Cog : null,
    hdg:
      typeof p.TrueHeading === 'number' && p.TrueHeading !== 511
        ? p.TrueHeading
        : null
  };
}

// One AIS static-data report (message 5) -> the measured vessel:
// ITU-R M.1371 ship type (code table in ships.js) and the REAL
// dimensions - A/B metres to bow/stern and C/D to port/starboard
// from the reference point, so length = A+B, beam = C+D (0 =
// not available). Draught arrives already decoded in metres.
export function normalizeStatic(s) {
  const d = s.Dimension || {};
  const len = (d.A || 0) + (d.B || 0);
  const beam = (d.C || 0) + (d.D || 0);
  return {
    mmsi: s.UserID,
    name: String(s.Name || '').trim(),
    type: typeof s.Type === 'number' ? s.Type : 0,
    len: len > 0 && len < 500 ? len : 0,
    beam: beam > 0 && beam < 80 ? beam : 0,
    draught:
      typeof s.MaximumStaticDraught === 'number' &&
      s.MaximumStaticDraught > 0 &&
      s.MaximumStaticDraught < 30
        ? s.MaximumStaticDraught
        : 0
  };
}

// Centre + radius (nm) -> bounding box: 1 nm of latitude is
// exactly 1/60 degree; longitude widens by 1/cos(lat), clamped
// away from the poles.
export function aisBox(lat, lon, d) {
  const dLat = d / 60;
  const dLon = d / (60 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return [
    [Math.max(lat - dLat, -90), Math.max(lon - dLon, -180)],
    [Math.min(lat + dLat, 90), Math.min(lon + dLon, 180)]
  ];
}

// Applied to every HTTP response (gated in server-reference).
export const SEC_HEADERS = {
  'content-security-policy': 'sandbox',
  'x-content-type-options': 'nosniff'
};

const AIS_WS = 'wss://stream.aisstream.io/v0/stream';
const UA = 'horizon-live/1.0 (+https://github.com/NDevTK/writeups)';
const FETCH_MS = 4000;

// ---- AIS engine: persistent global picture ---------------------

export function createAisState() {
  return {
    ships: new Map(), // mmsi -> normalized ship + {gk, t}
    statics: new Map(), // mmsi -> normalized static data + {t}
    grid: new Map(), // "lat:lon" 1-degree cell -> Set<mmsi>
    frames: 0,
    badFrames: 0, // arrived but failed decode/parse - a nonzero
    // count with zero frames means a WIRE problem, not a key one
    lastFrame: 0,
    connects: 0,
    started: Date.now()
  };
}

// WebSocket frames arrive as strings (text frames) or binary
// (ArrayBuffer once binaryType is set - node's undici otherwise
// defaults to Blob, whose String() is "[object Blob]" and parses
// as NOTHING; that failure mode is exactly why this helper exists
// and is gated). Accepts string, ArrayBuffer and views.
export function decodeFrame(data) {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) return new TextDecoder().decode(data);
  throw new Error('undecodable frame: ' + Object.prototype.toString.call(data));
}

export function gridKey(lat, lon) {
  return Math.floor(lat) + ':' + Math.floor(lon);
}

// Ingest one aisstream frame (already JSON.parsed). Latest report
// per MMSI wins; a ship crossing a 1-degree cell boundary is
// moved between cells. Returns true when a position was taken.
export function ingest(st, m, now = Date.now()) {
  st.frames++;
  st.lastFrame = now;
  // Static data (message 5): the vessel's MEASURED identity -
  // type, real length/beam from the A/B/C/D offsets, draught.
  // Class A transmits it every 6 minutes; latest wins.
  const sd = m && m.Message && m.Message.ShipStaticData;
  if (sd && typeof sd.UserID === 'number') {
    const stat = normalizeStatic(sd);
    stat.t = now;
    st.statics.set(stat.mmsi, stat);
    return false; // not a position - the caller counts positions
  }
  const p =
    m &&
    m.Message &&
    (m.Message.PositionReport || m.Message.StandardClassBPositionReport);
  if (!p) return false;
  if (typeof p.Latitude !== 'number' || typeof p.Longitude !== 'number')
    return false;
  const ship = normalizeShip(m.MetaData, p);
  const gk = gridKey(ship.lat, ship.lon);
  const prev = st.ships.get(ship.mmsi);
  if (prev && prev.gk !== gk) {
    const old = st.grid.get(prev.gk);
    if (old) {
      old.delete(ship.mmsi);
      if (old.size === 0) st.grid.delete(prev.gk);
    }
  }
  ship.gk = gk;
  ship.t = now;
  st.ships.set(ship.mmsi, ship);
  let cell = st.grid.get(gk);
  if (!cell) st.grid.set(gk, (cell = new Set()));
  cell.add(ship.mmsi);
  return true;
}

// Drop ships not heard from in maxAgeMs (AIS Class A transmits
// every 2-10 s underway, every 3 min at anchor; 20 min silence
// means gone). Returns the number pruned.
export function prune(st, maxAgeMs = 20 * 60e3, now = Date.now()) {
  let n = 0;
  for (const [mmsi, s] of st.ships) {
    if (now - s.t > maxAgeMs) {
      st.ships.delete(mmsi);
      const cell = st.grid.get(s.gk);
      if (cell) {
        cell.delete(mmsi);
        if (cell.size === 0) st.grid.delete(s.gk);
      }
      n++;
    }
  }
  // Statics age out on their own clock (message 5 repeats every
  // 6 min from Class A; a day of silence means gone for good).
  for (const [mmsi, s] of st.statics)
    if (now - s.t > 24 * 3600e3) st.statics.delete(mmsi);
  return n;
}

// Answer a visitor query from RAM: the same centre+radius ->
// bounding box geodesy as the /ais route (aisBox - the model
// lives once), walked over the grid cells the box overlaps. Strips the
// internal fields; payloads stay tiny (egress is the metered
// resource on a free-tier box).
export function query(st, lat, lon, dist, limit = 80) {
  const [[la0, lo0], [la1, lo1]] = aisBox(lat, lon, dist);
  const out = [];
  for (let a = Math.floor(la0); a <= Math.floor(la1); a++) {
    for (let o = Math.floor(lo0); o <= Math.floor(lo1); o++) {
      const cell = st.grid.get(a + ':' + o);
      if (!cell) continue;
      for (const mmsi of cell) {
        const s = st.ships.get(mmsi);
        if (!s) continue;
        if (s.lat < la0 || s.lat > la1 || s.lon < lo0 || s.lon > lo1) continue;
        // Merge the vessel's measured identity (message 5) when
        // the picture holds one: type, real length/beam, draught.
        const sd = st.statics.get(mmsi);
        out.push({
          mmsi: s.mmsi,
          name: s.name || (sd && sd.name) || '',
          lat: s.lat,
          lon: s.lon,
          sog: s.sog,
          cog: s.cog,
          hdg: s.hdg,
          ...(sd && {
            type: sd.type,
            len: sd.len,
            beam: sd.beam,
            draught: sd.draught
          })
        });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

// ---- Lightning (Blitzortung.org community network) -------------
// Strikes stream over another persistent WebSocket; the wire
// format is LZW-compressed JSON (their map client's scheme -
// protocol verified live: subscribe with {"a":111}, frames decode
// to {time (ns), lat, lon, ...}). Data CC BY-SA; the theme
// credits Blitzortung.org in its provenance panel.
const BLITZ_HOSTS = [
  'wss://ws1.blitzortung.org',
  'wss://ws7.blitzortung.org',
  'wss://ws8.blitzortung.org'
];

// Their LZW: dictionary starts at code 256, entries are built as
// previous-word + first-char, unknown codes mean word + word[0].
// Exported and gated by a round-trip against a spec-built encoder.
export function lzwDecode(b) {
  const d = b.split('');
  const e = {};
  let c = d[0];
  let f = c;
  let g = 256;
  const out = [c];
  for (let i = 1; i < d.length; i++) {
    const cc = d[i].charCodeAt(0);
    const w = cc < 256 ? d[i] : (e[cc] ?? f + c);
    out.push(w);
    c = w.charAt(0);
    e[g++] = f + c;
    f = w;
  }
  return out.join('');
}

export function createStrikeState() {
  return {
    grid: new Map(), // "lat:lon" 1-degree cell -> [{t, lat, lon}]
    count: 0,
    total: 0,
    lastStrike: 0,
    connects: 0
  };
}

// Ingest one decoded Blitzortung frame. Time arrives in
// NANOSECONDS since epoch; stored in ms. Returns the stored
// strike or null.
export function ingestStrike(st, j, now = Date.now()) {
  if (!j || typeof j.lat !== 'number' || typeof j.lon !== 'number') return null;
  const s = {
    t: typeof j.time === 'number' ? Math.round(j.time / 1e6) : now,
    lat: j.lat,
    lon: j.lon
  };
  const gk = gridKey(j.lat, j.lon);
  let cell = st.grid.get(gk);
  if (!cell) st.grid.set(gk, (cell = []));
  cell.push(s);
  st.count++;
  st.total++;
  st.lastStrike = now;
  return s;
}

// Strikes older than maxAgeMs leave the picture (a flash matters
// for minutes, not hours). Returns the number pruned.
export function pruneStrikes(st, maxAgeMs = 15 * 60e3, now = Date.now()) {
  let n = 0;
  for (const [gk, cell] of st.grid) {
    const keep = cell.filter((s) => now - s.t <= maxAgeMs);
    n += cell.length - keep.length;
    if (keep.length) st.grid.set(gk, keep);
    else st.grid.delete(gk);
  }
  st.count -= n;
  return n;
}

// Strikes within km of the point in the last sinceMs, EXACT
// great-circle distances (haversine from lightning.js - the model
// lives once) after a conservative grid-cell prefilter. Ages out,
// so the client can replay timing faithfully.
export function queryStrikes(st, lat, lon, km, sinceMs, now = Date.now()) {
  const dLat = Math.ceil(km / 110) + 0; // 1 deg lat >= 110.57 km
  const dLon = Math.ceil(
    km / Math.max(111.32 * Math.cos((lat * Math.PI) / 180), 1)
  );
  const out = [];
  for (let a = Math.floor(lat) - dLat; a <= Math.floor(lat) + dLat; a++) {
    for (let o = Math.floor(lon) - dLon; o <= Math.floor(lon) + dLon; o++) {
      const cell = st.grid.get(a + ':' + o);
      if (!cell) continue;
      for (const s of cell) {
        if (now - s.t > sinceMs) continue;
        const d = haversineKm(lat, lon, s.lat, s.lon);
        if (d > km) continue;
        out.push({ageMs: now - s.t, lat: s.lat, lon: s.lon, km: Math.round(d)});
        if (out.length >= 200) return out;
      }
    }
  }
  return out;
}

// One server-sent event, exactly framed (the wire format the
// EventSource spec parses: an event name line, one data line,
// blank-line terminator). Exported for the reference gate.
export function sseEvent(name, obj) {
  return 'event: ' + name + '\ndata: ' + JSON.stringify(obj) + '\n\n';
}

// SSE backpressure: a stalled client (zero TCP window, hostile or
// just asleep) would otherwise buffer events in THIS process's RAM
// without bound for its whole 30-minute stream lifetime - on a
// 1 GB e2-micro that is the resource that actually runs out. Once
// a client's socket buffer exceeds SSE_BUFFER_MAX it is
// disconnected (EventSource reconnects healthy clients on its
// own). 256 KiB holds minutes of the busiest real fanout, and is
// orders of magnitude above any single event.
export const SSE_BUFFER_MAX = 262144;
export function overBackpressure(buffered, max = SSE_BUFFER_MAX) {
  return buffered > max;
}

// ---- Origin allowlist + per-IP rate limit ----------------------

// Browser requests carry Origin; only the website's origin gets
// the CORS grant, anything else is refused outright. Non-browser
// requests (no Origin) pass without a grant - the rate limiter
// still applies to them.
export function originCheck(origin, allowed) {
  if (!origin) return {ok: true, acao: null};
  return allowed.includes(origin)
    ? {ok: true, acao: origin}
    : {ok: false, acao: null};
}

// Token bucket per IP: perMin tokens, continuous refill, bucket
// map pruned of full buckets on a timer (bounded memory).
export function createLimiter(perMin = 60) {
  const buckets = new Map(); // ip -> {tokens, t}
  return {
    take(ip, now = Date.now()) {
      let b = buckets.get(ip);
      if (!b) buckets.set(ip, (b = {tokens: perMin, t: now}));
      b.tokens = Math.min(perMin, b.tokens + ((now - b.t) / 60e3) * perMin);
      b.t = now;
      if (b.tokens < 1) return false;
      b.tokens -= 1;
      return true;
    },
    prune(now = Date.now()) {
      for (const [ip, b] of buckets) {
        const full =
          Math.min(perMin, b.tokens + ((now - b.t) / 60e3) * perMin) >=
          perMin - 1e-9;
        if (full) buckets.delete(ip);
      }
    },
    size: () => buckets.size
  };
}

// ---- Ocean colour: VIIRS chlorophyll (CoastWatch ERDDAP) -------
// Semantics pinned by live queries (2026-07-11) against
// noaacwNPPN20VIIRSDINEOFDaily (VIIRS NPP+N20, DINEOF gap-filled
// daily, ~2-day latency): grid 2160x4320 (1/12 deg), cell centres
// at (k + 0.5)/12 from -90/-180; chlor_a in mg m^-3, valid range
// 0.001..100, land/ice cells arrive as JSON null (the -999 fill).
// The pure pieces live here so server-reference.mjs can hold them
// to the recorded live responses.
export function chlorCell(lat, lon) {
  const snap = (x, n) =>
    (Math.max(-n, Math.min(n - 1, Math.floor(x * 12))) + 0.5) / 12;
  return {
    lat: snap(Math.max(-90, Math.min(90, lat)), 1080),
    lon: snap(Math.max(-180, Math.min(180, lon)), 2160)
  };
}

// The upstream URL is built HERE from the snapped cell only - the
// endpoint is a point-query proxy for one dataset, never a general
// fetcher of caller-supplied URLs.
export function chlorUrl(cell) {
  return (
    'https://coastwatch.noaa.gov/erddap/griddap/' +
    'noaacwNPPN20VIIRSDINEOFDaily.json' +
    `?chlor_a%5B(last)%5D%5B(0.0)%5D%5B(${cell.lat})%5D%5B(${cell.lon})%5D`
  );
}

// null = unusable response (-> 502); {chlor: null} = a real answer
// (land/ice cell) and cached like any success.
export function parseChlor(j) {
  const t = j?.table;
  const row = t?.rows?.[0];
  if (!row || !Array.isArray(t.columnNames)) return null;
  const col = t.columnNames.indexOf('chlor_a');
  if (col < 0) return null;
  const v = row[col];
  return {
    chlor: typeof v === 'number' && v >= 0.001 && v <= 100 ? v : null,
    time: typeof row[0] === 'string' ? row[0] : null
  };
}

// ---- Land greenness: MODIS NDVI (ORNL DAAC MOD13Q1) ------------
// The ORNL DAAC MODIS/VIIRS Web Service serves ONE MOD13Q1 (Terra,
// 250 m, 16-day composite) NDVI pixel for a lat/lon as JSON, no key,
// CORS-open. Two calls: /dates returns the composite calendar (global
// - the same Ayyyyddd list for every land cell), /subset returns the
// value at a date. Both URLs are built HERE from the snapped cell and
// the resolved date only - never a caller-supplied URL, the same
// point-query-proxy posture as /chlor. The land twin of the ocean
// colour feed (vegetation.js/land-color.js turn the NDVI into a
// terrain albedo). The pure pieces live here for server-reference.mjs.
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

// ---- Aircraft: readsb failover from a clean IP -----------------
// All three speak readsb v2 ({ac:[...]}, feet/knots) and feed the
// reference-gated normalize(). Order preferred by data richness;
// /probe on the deployed box decides if the order should change.
const ADSB_UPSTREAMS = [
  (lat, lon, d) =>
    'https://api.adsb.lol/v2/lat/' + lat + '/lon/' + lon + '/dist/' + d,
  (lat, lon, d) =>
    'https://opendata.adsb.fi/api/v2/lat/' + lat + '/lon/' + lon + '/dist/' + d,
  (lat, lon, d) =>
    'https://api.airplanes.live/v2/point/' + lat + '/' + lon + '/' + d
];

// ---- Probe targets (run ON the deployed box) -------------------
const PROBE_TARGETS = [
  [
    'control',
    'https://api.open-meteo.com/v1/forecast?latitude=51.47&longitude=-0.45&current=temperature_2m'
  ],
  [
    'opensky-api',
    'https://opensky-network.org/api/states/all?lamin=51.220&lamax=51.720&lomin=-0.851&lomax=-0.049'
  ],
  ['adsb.lol', 'https://api.adsb.lol/v2/lat/51.47/lon/-0.45/dist/15'],
  ['adsb.fi', 'https://opendata.adsb.fi/api/v2/lat/51.47/lon/-0.45/dist/15'],
  ['airplanes.live', 'https://api.airplanes.live/v2/point/51.47/-0.45/15']
];

async function probeAll() {
  return Promise.all(
    PROBE_TARGETS.map(async ([name, u]) => {
      const t0 = Date.now();
      try {
        const res = await fetch(u, {
          signal: AbortSignal.timeout(6000),
          headers: {'user-agent': UA}
        });
        let aircraft = null;
        try {
          const j = await res.json();
          if (Array.isArray(j.ac)) aircraft = j.ac.length;
          else if (Array.isArray(j.states)) aircraft = j.states.length;
        } catch {
          // non-JSON body - status alone is the datum
        }
        return {name, ms: Date.now() - t0, status: res.status, aircraft};
      } catch (e) {
        return {name, ms: Date.now() - t0, error: e.name + ': ' + e.message};
      }
    })
  );
}

// ---- The daemon (not exercised by the reference gate - the
// pure pieces above are; this is the integration shell) ---------

function runAisSocket(key, st, log) {
  let ws = null;
  let backoff = 1000;
  const connect = () => {
    let ended = false;
    const reopen = () => {
      if (ended) return;
      ended = true;
      backoff = Math.min(backoff * 2, 60e3);
      log(`ais socket down - reconnect in ${backoff / 1000}s`);
      setTimeout(connect, backoff);
    };
    try {
      ws = new WebSocket(AIS_WS);
    } catch (e) {
      log('ais socket constructor failed: ' + e);
      reopen();
      return;
    }
    ws.addEventListener('open', () => {
      st.connects++;
      backoff = 1000;
      log('ais socket open - global subscription sent');
      ws.send(
        JSON.stringify({
          APIKey: key,
          BoundingBoxes: [
            [
              [-90, -180],
              [90, 180]
            ]
          ],
          FilterMessageTypes: [
            'PositionReport',
            'StandardClassBPositionReport',
            'ShipStaticData'
          ]
        })
      );
    });
    try {
      ws.binaryType = 'arraybuffer'; // never Blob (see decodeFrame)
    } catch {
      // runtime without binaryType - decodeFrame handles views
    }
    ws.addEventListener('message', (ev) => {
      try {
        ingest(st, JSON.parse(decodeFrame(ev.data)));
      } catch (e) {
        st.badFrames++;
        if (st.badFrames === 1) log('first bad frame: ' + e);
      }
    });
    ws.addEventListener('close', reopen, {once: true});
    ws.addEventListener(
      'error',
      () => {
        try {
          ws.close();
        } catch {
          // already closing
        }
        reopen();
      },
      {once: true}
    );
  };
  connect();
  // Watchdog: a socket that is "open" but silent for 3 minutes is
  // dead upstream (a valid global subscription never goes quiet
  // that long - the world's oceans do not empty).
  setInterval(() => {
    if (st.connects > 0 && Date.now() - (st.lastFrame || st.started) > 180e3) {
      log('ais watchdog: no frames for 180 s - cycling the socket');
      try {
        ws.close();
      } catch {
        // triggers reopen either way
      }
    }
  }, 60e3).unref();
  setInterval(() => prune(st), 60e3).unref();
}

// Persistent Blitzortung socket: rotate hosts on reconnect,
// subscribe on open, ingest strikes, fan out to SSE clients.
function runBlitzSocket(st, clients, log) {
  const bootT = Date.now();
  let hostIdx = 0;
  let ws = null;
  let backoff = 1000;
  const connect = () => {
    let ended = false;
    const reopen = () => {
      if (ended) return;
      ended = true;
      backoff = Math.min(backoff * 2, 60e3);
      hostIdx = (hostIdx + 1) % BLITZ_HOSTS.length;
      log(`blitzortung socket down - next host in ${backoff / 1000}s`);
      setTimeout(connect, backoff);
    };
    try {
      ws = new WebSocket(BLITZ_HOSTS[hostIdx]);
    } catch (e) {
      log('blitzortung constructor failed: ' + e);
      reopen();
      return;
    }
    try {
      ws.binaryType = 'arraybuffer';
    } catch {
      // decodeFrame handles views
    }
    ws.addEventListener('open', () => {
      st.connects++;
      backoff = 1000;
      log('blitzortung socket open (' + BLITZ_HOSTS[hostIdx] + ')');
      ws.send(JSON.stringify({a: 111}));
    });
    ws.addEventListener('message', (ev) => {
      try {
        const s = ingestStrike(st, JSON.parse(lzwDecode(decodeFrame(ev.data))));
        if (!s) return;
        for (const cl of clients) {
          const d = haversineKm(cl.lat, cl.lon, s.lat, s.lon);
          if (d <= cl.km) {
            // Per-client isolation: one broken or stalled client
            // must never abort the fanout to the rest, and a
            // client over the backpressure budget is dropped (its
            // close handler cleans up; EventSource reconnects).
            try {
              if (overBackpressure(cl.res.writableLength)) cl.res.destroy();
              else
                cl.res.write(
                  sseEvent('strike', {
                    lat: s.lat,
                    lon: s.lon,
                    km: Math.round(d)
                  })
                );
            } catch {
              // close handler cleans up
            }
          }
        }
      } catch {
        // malformed frame
      }
    });
    ws.addEventListener('close', reopen, {once: true});
    ws.addEventListener(
      'error',
      () => {
        try {
          ws.close();
        } catch {
          // triggers reopen either way
        }
        reopen();
      },
      {once: true}
    );
  };
  connect();
  setInterval(() => {
    // The planet always has thunderstorms; a long-quiet socket is
    // dead upstream.
    if (st.connects > 0 && Date.now() - (st.lastStrike || bootT) > 300e3) {
      log('blitzortung watchdog: silent 300 s - cycling');
      try {
        ws.close();
      } catch {
        // reopen fires regardless
      }
    }
    pruneStrikes(st);
  }, 60e3).unref();
}

function main() {
  const env = process.env;
  const PORT = Number(env.PORT || 8127);
  const HOST = env.HOST || '127.0.0.1';
  const ALLOW = (env.ALLOW_ORIGIN || 'https://ndevtk.github.io')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const TRUST = (env.TRUST_PROXY ?? '1') === '1';
  const limiter = createLimiter(Number(env.RATE_PER_MIN || 60));
  setInterval(() => limiter.prune(), 60e3).unref();
  const st = createAisState();
  const log = (m) => console.log(new Date().toISOString(), m);
  if (env.AISSTREAM_KEY) runAisSocket(env.AISSTREAM_KEY, st, log);
  else log('AISSTREAM_KEY unset - /ais will answer 503');
  // Lightning needs no key - Blitzortung's community sockets are
  // open (data CC BY-SA, credited by the theme). SSE clients are
  // origin-scoped by the SAME allowlist gate as every route
  // (WebSockets/EventSource bypass CORS, so the Origin check IS
  // the protection) and capped: streams are the one resource a
  // client can hold open.
  const blitz = createStrikeState();
  const sseClients = new Set();
  const SSE_MAX = Number(env.SSE_MAX || 25);
  runBlitzSocket(blitz, sseClients, log);

  // Space weather: DSCOVR/ACE solar wind at L1 (already propagated
  // to the bow shock by SWPC - the propagated_time_tag IS the
  // physical lead time) plus the OVATION hemispheric power. ONE
  // 60 s poll of two small CDN files serves every visitor; the
  // Newell coupling is computed in the shared solarwind.js (the
  // model lives once, gated by solarwind-reference).
  const SWPC_WIND =
    'https://services.swpc.noaa.gov/products/geospace/propagated-solar-wind-1-hour.json';
  const SWPC_HP =
    'https://services.swpc.noaa.gov/text/aurora-nowcast-hemi-power.txt';
  const space = {at: 0, wind: null, hp: null, fetches: 0, errors: 0};
  async function pollSpace() {
    try {
      const opt = {
        signal: AbortSignal.timeout(FETCH_MS),
        headers: {'user-agent': UA}
      };
      const [w, h] = await Promise.all([
        fetch(SWPC_WIND, opt).then((r) =>
          r.ok ? r.json() : Promise.reject(new Error('wind ' + r.status))
        ),
        fetch(SWPC_HP, opt).then((r) =>
          r.ok ? r.text() : Promise.reject(new Error('hp ' + r.status))
        )
      ]);
      const wind = parsePropagated(w);
      const hp = parseHemiPower(h);
      if (wind) space.wind = wind;
      if (hp) space.hp = hp;
      if (wind || hp) space.at = Date.now();
      space.fetches++;
    } catch {
      space.errors++; // stale copy keeps serving; next poll retries
    }
  }
  pollSpace();
  setInterval(pollSpace, 60e3).unref();
  const spaceBody = () =>
    space.wind || space.hp
      ? {wind: space.wind, hp: space.hp, at: space.at}
      : null;

  // Wildfire smoke: NOAA HMS - analysts drawing verified plumes
  // from satellite imagery, one daily KML (~200 KB in season).
  // Fetched hourly, parsed by the gated smoke.js, answered from
  // RAM; early in the UTC day today's file may not exist yet, so
  // yesterday's stands in.
  const smokeState = {at: 0, day: '', polys: [], fetches: 0, errors: 0};
  async function pollSmoke() {
    for (const back of [0, 1]) {
      const t = new Date(Date.now() - back * 86400e3);
      const y = t.getUTCFullYear();
      const mo = String(t.getUTCMonth() + 1).padStart(2, '0');
      const da = String(t.getUTCDate()).padStart(2, '0');
      const day = '' + y + mo + da;
      try {
        const r = await fetch(
          'https://satepsanone.nesdis.noaa.gov/pub/FIRE/web/HMS/Smoke_Polygons/KML/' +
            y +
            '/' +
            mo +
            '/hms_smoke' +
            day +
            '.kml',
          {signal: AbortSignal.timeout(FETCH_MS), headers: {'user-agent': UA}}
        );
        if (!r.ok) throw new Error('hms ' + r.status);
        const polys = parseHmsKml(await r.text());
        if (!polys.length && back === 0) continue; // too early UTC
        smokeState.polys = polys;
        smokeState.day = day;
        smokeState.at = Date.now();
        smokeState.fetches++;
        return;
      } catch {
        smokeState.errors++;
      }
    }
  }
  pollSmoke();
  setInterval(pollSmoke, 3600e3).unref();

  let tlesCache = {t: 0, body: null}; // CelesTrak visual group
  const adsbCache = new Map(); // area key -> {t, body, src}
  const metarCache = new Map(); // area key -> {t, body}
  const aerosolCache = new Map(); // 0.25-deg cell key -> {t, body}
  const chlorCache = new Map(); // 1/12-deg cell key -> {t, body}
  const ndviCache = new Map(); // 0.01-deg cell key -> {t, body}
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of adsbCache) if (now - v.t > 30e3) adsbCache.delete(k);
    for (const [k, v] of metarCache)
      if (now - v.t > 20 * 60e3) metarCache.delete(k);
    for (const [k, v] of aerosolCache)
      if (now - v.t > 90 * 60e3) aerosolCache.delete(k);
    for (const [k, v] of chlorCache)
      if (now - v.t > 12 * 3600e3) chlorCache.delete(k);
    for (const [k, v] of ndviCache)
      if (now - v.t > 12 * 3600e3) ndviCache.delete(k);
  }, 30e3).unref();

  // Measured aerosol radiative properties: GEFS-Aerosols (NOAA's
  // operational GOCART coupling) via the NOMADS grib filter - the
  // supported subsetting path since OpenDAP retired (SCN 25-81).
  // A request covers ONE 0.25-deg cell (a 0.5-deg box, ~6 KB of
  // GRIB2), decoded by the gated grib2.js and censused by the
  // gated aerosol.js; per-cell answers are cached for 45 min
  // (the product is 3-hourly), failures for 5 min, so many
  // viewers in one place cost one upstream request.
  const aerosolState = {fetches: 0, errors: 0, cycle: ''};
  async function fetchAerosol(lat, lon) {
    const cla = Math.max(-90, Math.min(90, Math.round(lat * 4) / 4));
    const clo = (((Math.round(lon * 4) / 4) % 360) + 360) % 360;
    const key = cla + '/' + clo;
    const hit = aerosolCache.get(key);
    if (hit && Date.now() - hit.t < (hit.body ? 45 : 5) * 60e3) return hit.body;
    const bottom = Math.max(-90, Math.min(cla - 0.25, 89.5));
    const left = Math.max(0, Math.min(clo - 0.25, 359.5));
    // Latest cycle at least 5 h old (publish latency), then older.
    const CYC = 21600e3;
    const newest = Math.floor((Date.now() - 5 * 3600e3) / CYC) * CYC;
    for (let k = 0; k < 3; k++) {
      const ct = newest - k * CYC;
      const d = new Date(ct);
      const ymd =
        d.getUTCFullYear() +
        String(d.getUTCMonth() + 1).padStart(2, '0') +
        String(d.getUTCDate()).padStart(2, '0');
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const fhr = Math.max(
        0,
        Math.min(120, Math.round((Date.now() - ct) / 10800e3) * 3)
      );
      const u =
        'https://nomads.ncep.noaa.gov/cgi-bin/filter_gefs_chem_0p25.pl' +
        `?dir=%2Fgefs.${ymd}%2F${hh}%2Fchem%2Fpgrb2ap25` +
        `&file=gefs.chem.t${hh}z.a2d_0p25.f${String(fhr).padStart(3, '0')}.grib2` +
        '&var_AOTK=on&var_SCTAOTK=on&var_ASYSFK=on&var_SSALBK=on&all_lev=on' +
        `&subregion=&leftlon=${left}&rightlon=${left + 0.5}` +
        `&toplat=${bottom + 0.5}&bottomlat=${bottom}`;
      try {
        aerosolState.fetches++;
        const r = await fetch(u, {
          signal: AbortSignal.timeout(15e3),
          headers: {'user-agent': UA}
        });
        if (!r.ok) continue; // cycle not published yet - older one
        const buf = new Uint8Array(await r.arrayBuffer());
        const products = aerosolProducts(parseGrib2(buf), cla, clo);
        if (!products) continue;
        const cycle = `${d.toISOString().slice(0, 13)}:00Z`;
        aerosolState.cycle = cycle + '+' + fhr;
        const body = {
          products,
          cycle,
          fhr,
          cell: {lat: cla, lon: clo > 180 ? clo - 360 : clo}
        };
        aerosolCache.set(key, {t: Date.now(), body});
        return body;
      } catch {
        aerosolState.errors++;
      }
    }
    aerosolCache.set(key, {t: Date.now(), body: null});
    return null;
  }
  // Chlorophyll-a for the 1/12-deg cell over the point, from the
  // gap-filled VIIRS daily product on CoastWatch ERDDAP - the host
  // sends no CORS header, so the daemon proxies ONE point query
  // (URL built by the gated chlorUrl from the snapped cell only).
  // The product is daily with ~2-day latency, so successes - land
  // included - cache for 6 h and failures for 10 min; many viewers
  // in one place cost one upstream request.
  const chlorState = {fetches: 0, errors: 0, time: ''};
  async function fetchChlor(lat, lon) {
    const cell = chlorCell(lat, lon);
    const key = cell.lat + '/' + cell.lon;
    const hit = chlorCache.get(key);
    if (hit && Date.now() - hit.t < (hit.body ? 360 : 10) * 60e3)
      return hit.body;
    try {
      chlorState.fetches++;
      const r = await fetch(chlorUrl(cell), {
        signal: AbortSignal.timeout(15e3),
        headers: {'user-agent': UA}
      });
      if (!r.ok) throw new Error('erddap ' + r.status);
      const parsed = parseChlor(await r.json());
      if (!parsed) throw new Error('erddap shape');
      if (parsed.time) chlorState.time = parsed.time;
      const body = {...parsed, cell};
      chlorCache.set(key, {t: Date.now(), body});
      return body;
    } catch {
      chlorState.errors++;
      chlorCache.set(key, {t: Date.now(), body: null});
      return null;
    }
  }
  // Land greenness for the 0.01-deg cell over the point, from the
  // ORNL DAAC MODIS MOD13Q1 NDVI service (250 m, 16-day composite,
  // ~weeks latency). Two steps: resolve the latest composite date
  // once (the calendar is global, cached 6 h), then one /subset point
  // query per cell (URL from the gated ndviUrl). Successes - the fill
  // "no measure" null included - cache 12 h, failures 10 min.
  const ndviState = {fetches: 0, errors: 0, date: '', calDate: ''};
  const ndviDateCache = {t: 0, date: ''};
  const NDVI_DATE_REF = {lat: 45, lon: -90}; // any land cell; calendar is global
  async function resolveNdviDate() {
    if (ndviDateCache.date && Date.now() - ndviDateCache.t < 6 * 3600e3)
      return ndviDateCache.date;
    try {
      const r = await fetch(ndviDatesUrl(NDVI_DATE_REF), {
        signal: AbortSignal.timeout(FETCH_MS),
        headers: {'user-agent': UA}
      });
      if (!r.ok) throw new Error('ornl dates ' + r.status);
      const date = ndviDate(await r.json());
      if (!date) throw new Error('ornl dates shape');
      ndviDateCache.t = Date.now();
      ndviDateCache.date = date;
      ndviState.date = date;
      return date;
    } catch {
      ndviState.errors++;
      return ndviDateCache.date || null; // a stale date still serves
    }
  }
  async function fetchNdvi(lat, lon) {
    const date = await resolveNdviDate();
    if (!date) return null;
    const cell = ndviCell(lat, lon);
    const key = cell.lat + '/' + cell.lon;
    const hit = ndviCache.get(key);
    if (hit && Date.now() - hit.t < (hit.body ? 720 : 10) * 60e3)
      return hit.body;
    try {
      ndviState.fetches++;
      const r = await fetch(ndviUrl(cell, date), {
        signal: AbortSignal.timeout(15e3),
        headers: {'user-agent': UA}
      });
      if (!r.ok) throw new Error('ornl ' + r.status);
      const parsed = parseNdvi(await r.json());
      if (!parsed) throw new Error('ornl shape');
      if (parsed.date) ndviState.calDate = parsed.date;
      const body = {...parsed, cell};
      ndviCache.set(key, {t: Date.now(), body});
      return body;
    } catch {
      ndviState.errors++;
      ndviCache.set(key, {t: Date.now(), body: null});
      return null;
    }
  }
  // Aircraft near a point via the readsb failover chain, shared
  // by GET /adsb and the /stream pushes - the 15 s per-area cache
  // means many viewers in one place cost ONE upstream request,
  // and stream pushes never exceed the feeds' documented rates.
  async function fetchAdsb(lat, lon, dist) {
    const la = lat.toFixed(3);
    const lo = lon.toFixed(3);
    const d = Math.round(dist);
    const ck = la + '/' + lo + '/' + d;
    const hit = adsbCache.get(ck);
    if (hit && Date.now() - hit.t < 15e3) {
      return {body: hit.body, src: hit.src + ' (cached)'};
    }
    for (const mk of ADSB_UPSTREAMS) {
      const u = mk(la, lo, d);
      try {
        const r = await fetch(u, {
          signal: AbortSignal.timeout(FETCH_MS),
          headers: {'user-agent': UA}
        });
        if (!r.ok) continue;
        const body = {ac: normalize(await r.json())};
        const src = new URL(u).hostname;
        adsbCache.set(ck, {t: Date.now(), body, src});
        return {body, src};
      } catch {
        // timeout or malformed - next upstream
      }
    }
    return null;
  }

  const server = http.createServer(async (req, res) => {
    const ip = TRUST
      ? (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        req.socket.remoteAddress
      : req.socket.remoteAddress;
    const oc = originCheck(req.headers.origin, ALLOW);
    const head = (extra = {}) => ({
      // Defence in depth on EVERY response: the API serves JSON/
      // text only - CSP sandbox neutralises it if anything ever
      // coaxes a browser into rendering a response as a document,
      // and nosniff pins the declared content types.
      ...SEC_HEADERS,
      ...(oc.acao
        ? {
            'access-control-allow-origin': oc.acao,
            'access-control-allow-methods': 'GET, OPTIONS',
            vary: 'origin'
          }
        : {}),
      ...extra
    });
    const send = (code, body, extra) => {
      res.writeHead(code, head(extra));
      res.end(body);
    };
    if (!oc.ok) return send(403, 'origin not allowed');
    if (req.method === 'OPTIONS') return send(204, null);
    if (req.method !== 'GET') return send(405, 'method not allowed');
    if (!limiter.take(ip)) return send(429, 'rate limited');
    const url = new URL(req.url, 'http://localhost');
    const json = (code, obj, extra = {}) =>
      send(code, JSON.stringify(obj), {
        'content-type': 'application/json',
        ...extra
      });

    if (url.pathname === '/tles') {
      // CelesTrak's visual group (the ~150 naked-eye satellites)
      // for the theme's SGP4 fleet. CelesTrak asks clients to
      // fetch element sets at most every few hours - the 6 h
      // in-memory cache honours that whatever the visitor count,
      // and a stale copy serves through upstream outages (TLEs
      // stay accurate for days).
      if (tlesCache.body && Date.now() - tlesCache.t < 6 * 3600e3) {
        return send(200, tlesCache.body, {
          'content-type': 'text/plain',
          'cache-control': 'public, max-age=21600',
          'x-tle-source': 'celestrak.org (cached)'
        });
      }
      try {
        const r = await fetch(
          'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle',
          {signal: AbortSignal.timeout(15000), headers: {'user-agent': UA}}
        );
        if (!r.ok) throw new Error('celestrak ' + r.status);
        const body = await r.text();
        tlesCache = {t: Date.now(), body};
        return send(200, body, {
          'content-type': 'text/plain',
          'cache-control': 'public, max-age=21600',
          'x-tle-source': 'celestrak.org'
        });
      } catch {
        if (tlesCache.body) {
          return send(200, tlesCache.body, {
            'content-type': 'text/plain',
            'cache-control': 'public, max-age=3600',
            'x-tle-source': 'celestrak.org (stale)'
          });
        }
        return send(502, 'tles unavailable');
      }
    }

    if (url.pathname === '/solarwind') {
      // No coordinates: the solar wind is one number pair for the
      // whole planet. 503 only before the first successful poll.
      const body = spaceBody();
      if (!body) return json(503, {error: 'no data yet'});
      return json(200, body, {
        'cache-control': 'public, max-age=60',
        'x-space-source': 'NOAA SWPC (DSCOVR/ACE L1 + OVATION)'
      });
    }

    if (url.pathname === '/health' || url.pathname === '/probe') {
      const ais = {
        ships: st.ships.size,
        statics: st.statics.size,
        cells: st.grid.size,
        frames: st.frames,
        badFrames: st.badFrames,
        lastFrameAgoMs: st.lastFrame ? Date.now() - st.lastFrame : null,
        connects: st.connects,
        uptimeMs: Date.now() - st.started,
        keySet: !!env.AISSTREAM_KEY
      };
      const lightning = {
        strikes: blitz.count,
        cells: blitz.grid.size,
        total: blitz.total,
        lastStrikeAgoMs: blitz.lastStrike
          ? Date.now() - blitz.lastStrike
          : null,
        connects: blitz.connects,
        streams: sseClients.size
      };
      const smokeHealth = {
        plumes: smokeState.polys.length,
        day: smokeState.day,
        ageMs: smokeState.at ? Date.now() - smokeState.at : null,
        fetches: smokeState.fetches,
        errors: smokeState.errors
      };
      const spaceHealth = {
        haveWind: !!space.wind,
        haveHp: !!space.hp,
        coupling: space.wind ? Math.round(space.wind.coupling) : null,
        ageMs: space.at ? Date.now() - space.at : null,
        fetches: space.fetches,
        errors: space.errors
      };
      const aerosolHealth = {
        cells: aerosolCache.size,
        cycle: aerosolState.cycle,
        fetches: aerosolState.fetches,
        errors: aerosolState.errors
      };
      const chlorHealth = {
        cells: chlorCache.size,
        time: chlorState.time,
        fetches: chlorState.fetches,
        errors: chlorState.errors
      };
      const ndviHealth = {
        cells: ndviCache.size,
        date: ndviState.calDate,
        composite: ndviState.date,
        fetches: ndviState.fetches,
        errors: ndviState.errors
      };
      if (url.pathname === '/health')
        return json(
          200,
          {
            ais,
            lightning,
            space: spaceHealth,
            smoke: smokeHealth,
            aerosol: aerosolHealth,
            chlor: chlorHealth,
            ndvi: ndviHealth
          },
          {'cache-control': 'no-store'}
        );
      return json(
        200,
        {
          ais,
          lightning,
          space: spaceHealth,
          smoke: smokeHealth,
          aerosol: aerosolHealth,
          chlor: chlorHealth,
          ndvi: ndviHealth,
          probe: await probeAll()
        },
        {'cache-control': 'no-store'}
      );
    }

    const lat = Number(url.searchParams.get('lat'));
    const lon = Number(url.searchParams.get('lon'));
    if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180))
      return send(400, 'bad request');

    if (url.pathname === '/ais') {
      if (!env.AISSTREAM_KEY)
        return json(503, {ships: [], error: 'no AISSTREAM_KEY'});
      const dist = Math.min(Number(url.searchParams.get('dist')) || 8, 30);
      if (!(dist > 0)) return send(400, 'bad request');
      return json(
        200,
        {ships: query(st, lat, lon, dist)},
        {
          'cache-control': 'public, max-age=30',
          'x-ais-source': 'aisstream.io',
          'x-ais-engine':
            st.frames + ' frames, ' + st.ships.size + ' ships resident'
        }
      );
    }

    if (url.pathname === '/lightning') {
      const km = Math.min(Number(url.searchParams.get('km')) || 150, 250);
      if (!(km > 0)) return send(400, 'bad request');
      return json(
        200,
        {strikes: queryStrikes(blitz, lat, lon, km, 10 * 60e3)},
        {
          'cache-control': 'public, max-age=30',
          'x-lightning-source': 'blitzortung.org'
        }
      );
    }

    if (url.pathname === '/smoke') {
      // The analyst-verified plume over the point (HMS is a North
      // America product - null elsewhere is the truthful answer).
      return json(
        200,
        {
          smoke: smokeAt(smokeState.polys, lat, lon),
          plumes: smokeState.polys.length,
          day: smokeState.day
        },
        {
          'cache-control': 'public, max-age=600',
          'x-smoke-source': 'NOAA HMS (analyst-verified)'
        }
      );
    }

    if (url.pathname === '/metar') {
      // Aerodrome observations near the point: aviationweather.gov
      // decodes the reports but sends no CORS header, so the
      // daemon proxies - stripped to the fields the theme reads
      // (normalizeMetars, gated) with a 10-minute per-area cache
      // (reports refresh half-hourly; many viewers in one place
      // cost one upstream request).
      const ck = lat.toFixed(1) + '/' + lon.toFixed(1);
      const hit = metarCache.get(ck);
      if (hit && Date.now() - hit.t < 10 * 60e3) {
        return json(200, hit.body, {
          'cache-control': 'public, max-age=300',
          'x-metar-source': 'aviationweather.gov (cached)'
        });
      }
      try {
        const d = 0.6;
        const u =
          'https://aviationweather.gov/api/data/metar?format=json&bbox=' +
          (lat - d).toFixed(2) +
          ',' +
          (lon - d).toFixed(2) +
          ',' +
          (lat + d).toFixed(2) +
          ',' +
          (lon + d).toFixed(2);
        const r = await fetch(u, {
          signal: AbortSignal.timeout(FETCH_MS),
          headers: {'user-agent': UA}
        });
        if (!r.ok) throw new Error(r.status);
        const body = {metars: normalizeMetars(await r.json())};
        metarCache.set(ck, {t: Date.now(), body});
        return json(200, body, {
          'cache-control': 'public, max-age=300',
          'x-metar-source': 'aviationweather.gov'
        });
      } catch {
        return json(502, {metars: [], upstream: 'unavailable'});
      }
    }

    if (url.pathname === '/aerosol') {
      // Measured aerosol radiative properties for the cell over
      // the point: total AOT at five optical bands, scattering
      // AOT, single-scattering albedo, asymmetry, and the
      // dust/sea-salt/sulphate/organic/black-carbon split.
      const body = await fetchAerosol(lat, lon);
      if (!body) return json(502, {products: null, upstream: 'unavailable'});
      return json(200, body, {
        'cache-control': 'public, max-age=900',
        'x-aerosol-source': 'NOMADS GEFS-Aerosols (GOCART)'
      });
    }

    if (url.pathname === '/chlor') {
      // Chlorophyll-a in the 1/12-deg cell over the point, mg/m^3.
      // chlor null with a 200 is a real answer (land/ice cell);
      // 502 means the upstream itself failed.
      const body = await fetchChlor(lat, lon);
      if (!body) return json(502, {chlor: null, upstream: 'unavailable'});
      return json(200, body, {
        'cache-control': 'public, max-age=3600',
        'x-chlor-source': 'NOAA CoastWatch VIIRS DINEOF (ERDDAP)'
      });
    }

    if (url.pathname === '/ndvi') {
      // Land greenness (MODIS NDVI) in the 0.01-deg cell over the
      // point. ndvi null with a 200 is a real answer (water/cloud/
      // barren no-measure cell); 502 means the upstream itself failed.
      const body = await fetchNdvi(lat, lon);
      if (!body) return json(502, {ndvi: null, upstream: 'unavailable'});
      return json(200, body, {
        'cache-control': 'public, max-age=3600',
        'x-ndvi-source': 'NASA MODIS MOD13Q1 (ORNL DAAC)'
      });
    }

    if (url.pathname === '/adsb') {
      const dist = Math.min(Number(url.searchParams.get('dist')) || 15, 60);
      if (!(dist > 0)) return send(400, 'bad request');
      const got = await fetchAdsb(lat, lon, dist);
      if (!got) return json(502, {ac: [], upstream: 'unavailable'});
      return json(200, got.body, {
        'cache-control': 'public, max-age=15',
        'x-adsb-source': got.src
      });
    }

    if (url.pathname === '/stream') {
      // The unified live channel - the daemon's ONE push server
      // (the per-feature legacy stream was removed): ONE
      // origin-scoped EventSource
      // per viewer carries everything time-sensitive as named
      // events - `strike` the moment Blitzortung locates one,
      // `ais` ship deltas every 30 s from the in-RAM picture,
      // `adsb` aircraft every 20 s through the shared per-area
      // cache (many viewers in one place still cost one upstream
      // request). Initial ais/adsb push on connect so the page
      // paints immediately. Origin scoping: EventSource bypasses
      // CORS, so the global allowlist gate above IS the
      // protection - foreign origins were 403'd before this line.
      const km = Math.min(Number(url.searchParams.get('km')) || 150, 250);
      const aisDist = Math.min(Number(url.searchParams.get('ais')) || 8, 30);
      const adsbDist = Math.min(Number(url.searchParams.get('adsb')) || 15, 60);
      if (sseClients.size >= SSE_MAX) return send(503, 'stream capacity');
      res.writeHead(
        200,
        head({
          'content-type': 'text/event-stream',
          'cache-control': 'no-store'
        })
      );
      res.write(': horizon-live unified stream\n\n');
      const client = {res, lat, lon, km};
      sseClients.add(client);
      // Every periodic write goes through the same backpressure
      // gate as the strike fanout: a stalled client is dropped
      // before it can grow this process's memory.
      const guardedWrite = (chunk) => {
        try {
          if (overBackpressure(res.writableLength)) res.destroy();
          else res.write(chunk);
        } catch {
          // closing below
        }
      };
      const pushAis = () => {
        if (env.AISSTREAM_KEY) {
          guardedWrite(sseEvent('ais', {ships: query(st, lat, lon, aisDist)}));
        }
      };
      const pushAdsb = async () => {
        const got = await fetchAdsb(lat, lon, adsbDist);
        if (!got) return;
        guardedWrite(sseEvent('adsb', got.body));
      };
      const pushSpace = () => {
        const body = spaceBody();
        if (body) guardedWrite(sseEvent('space', body));
      };
      pushAis();
      pushAdsb();
      pushSpace();
      const iAis = setInterval(pushAis, 30e3);
      const iAdsb = setInterval(pushAdsb, 20e3);
      const iSpace = setInterval(pushSpace, 60e3);
      const hb = setInterval(() => guardedWrite(': hb\n\n'), 25e3);
      const bye = setTimeout(() => res.end(), 30 * 60e3);
      req.on('close', () => {
        clearInterval(iAis);
        clearInterval(iAdsb);
        clearInterval(iSpace);
        clearInterval(hb);
        clearTimeout(bye);
        sseClients.delete(client);
      });
      return;
    }

    return send(404, 'not found');
  });
  server.listen(PORT, HOST, () =>
    log(`horizon-live on ${HOST}:${PORT} (origins: ${ALLOW.join(', ')})`)
  );
}

// Run only as a program - importing this module (the reference
// gate does) must stay side-effect free.
if (import.meta.url === 'file://' + process.argv[1]) main();
