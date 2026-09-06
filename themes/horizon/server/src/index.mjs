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
import {readFileSync, renameSync, writeFileSync} from 'node:fs';
import {join as joinPath} from 'node:path';
import {haversineKm} from '../../lightning.js';
import {parseHemiPower, parsePropagated} from '../../solarwind.js';
import {normalizeMetars} from '../../metar.js';
import {parseHmsKml, smokeAt} from '../../smoke.js';
import {parseGrib2, gridValue} from '../../grib2.js';
import {aerosolProducts} from '../../aerosol.js';
import {
  latestFresh,
  nearestAeronetSite,
  parseAeronetSites,
  parseAeronetV3
} from '../../aeronet.js';
import {gmnMedians, parseTrajSummary} from '../../gmn.js';
import {GVP_RSS, GVP_WFS, parseGvpRss, plumeTopM} from '../../gvp.js';
import {
  blhRiM,
  freezingLevelM,
  IGRA_STATIONS,
  levelAt,
  parcelAscent,
  parseIgraStations,
  parseWyoText,
  thinRows,
  WYO_BASE
} from '../../sounding.js';
import {
  firstSpecRow,
  firstTxtValue,
  NDBC_BASE,
  NDBC_STATIONS,
  parseStations
} from '../../buoy.js';
import {COBS_API, COBS_WINDOW_DAYS, cobsMedians} from '../../cobs.js';
import {ozoneCensus} from '../../ozone.js';
import {
  ndviCell,
  ndviDatesUrl,
  ndviUrl,
  ndviDate,
  parseNdvi,
  MOD09_BANDS,
  MOD09_STATE_BAND,
  surfaceDatesUrl,
  surfaceUrl,
  parseSurface,
  parseSurfaceState,
  surfaceQaClean
} from '../../modis-land.js';
import {inflateSync} from 'node:zlib';
import {pickSatellite} from '../../satellites.js';
import {openHdf5, openHdf5Lazy, physicalValues} from '../../hdf5.js';
// THE FLASHES FROM ORBIT (168th): GLM's flashes decoded and composed
// by the shared law module (gated by glm-reference.mjs)
import {
  GLM_ATBD,
  glmFlashesNear,
  glmSummary,
  parseGlmFlashes
} from '../../glm.js';
import {
  bandKeys,
  bucketPrefix,
  cutWindow,
  dcompCensus,
  DMW_BAND,
  dmwColumns,
  dmwLayers,
  dmwWithin,
  fixedGridGeometry,
  boxMean,
  fieldCensus,
  goodCensus,
  heightCensus,
  IMAGERY_BAND,
  L2_BUCKETS,
  L2_PRODUCTS,
  latestByStart,
  maskCensus,
  nearestByStart,
  packArray,
  parseS3Keys,
  pixelSizeM,
  productTimeIso,
  quantile,
  unscale,
  windowBox
} from '../../goesl2.js';

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
      track: a.track,
      // The MEASURED airframe identity: ICAO type designator (readsb
      // 't', e.g. A320/B789/GLF6) and DO-260B emitter category (e.g.
      // A3/A5) - so the theme can draw each aircraft at its real type
      // (aircraft.js), the aerial twin of the AIS ship silhouettes.
      t: typeof a.t === 'string' ? a.t : '',
      cat: typeof a.category === 'string' ? a.category : ''
    }));
}

// One AIS position report -> the seven fields the theme reads.
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
        : null,
    // Navigational status (M.1371 message 1/2/3, Table 45): 0
    // under way (engine), 1 at anchor, 2 not under command, 3
    // restricted manoeuvrability, 5 moored, 6 aground, 8 under
    // way sailing; 15 is the standard's own "undefined" default.
    // The theme turns this into the COLREGS Rule 27/30 light
    // regimes and holds anchored hulls instead of dead-reckoning
    // their GPS jitter.
    st:
      typeof p.NavigationalStatus === 'number' &&
      p.NavigationalStatus >= 0 &&
      p.NavigationalStatus <= 15
        ? p.NavigationalStatus
        : 15
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

// ---- Upstream time budget --------------------------------------

// The wall clock an edge grants an origin is finite (Cloudflare's
// free-tier origin timeout is 100 s), so a handler that walks
// slow upstreams SERIALLY can hang past it and surface as the
// edge's own plain-text 502 - measured on /sounding (up to 4
// slots x 2 Wyoming fetches x 45 s) and /buoy (4 candidates x 6
// NDBC files x 30 s: a 12-minute worst case). Every multi-fetch
// handler therefore shares ONE deadline: each fetch takes the
// smaller of its own cap and the time left, and when the budget
// is spent the answer comes from the stale cache or fails fast
// as OUR json - never as an edge timeout. 25 s keeps a whole
// cold walk under the tightest common edge limit with margin.
export const UPSTREAM_BUDGET_MS = 25000;

// ---- Warm-up on start ------------------------------------------

// A fresh process has empty caches, and the routes that walk slow
// upstreams (the sounding's Wyoming fetches, the buoy's NDBC
// files) can spend their whole budget on the first request and
// answer 502 (measured on /sounding after a deploy: the first
// fetch failed at the 25-s budget, the second answered in 16 s).
// So the process warms the home area's caches right after it
// starts listening - the theme's default scene unless
// HORIZON_HOME=lat,lon says otherwise. Pure helpers, gated.
export const HOME_DEFAULT = '32.85,-117.12';
export function parseHome(s) {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(s ?? '');
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return {lat, lon};
}
export function warmUpPaths(home) {
  if (!home) return [];
  const q = `lat=${home.lat.toFixed(2)}&lon=${home.lon.toFixed(2)}`;
  return [
    `/sounding?${q}`,
    `/buoy?${q}`,
    `/metar?${q}`,
    `/sst?${q}`,
    `/goesl2?${q}`
  ];
}
export const WARM_UP_TRIES = 3;
export const WARM_UP_PAUSE_MS = 5000;

// ---- Cache persistence across restarts (144th pass) -------------
// Every deploy restarts the process (the self-update timer; measured
// uptime 3.8 h after a busy day), and a fresh process holds empty
// caches - the warm-up covers the home area, nobody else's. So the
// slow per-area caches and the sitewide feeds are snapshotted to
// the systemd StateDirectory every STATE_SAVE_MS and on SIGTERM,
// and restored at start; the warm-up then also refreshes the areas
// the snapshot served most recently. Pure helpers, gated:
// snapshotCaches serializes named Maps of {t, body} rows and named
// singles {t, ...}; restoreCaches puts back rows younger than
// maxAgeMs without overwriting anything fresher already fetched.
export const STATE_SAVE_MS = 5 * 60e3;
export const STATE_MAX_AGE_MS = 24 * 3600e3;
export function snapshotCaches({maps = {}, singles = {}}, now = Date.now()) {
  const out = {savedAt: now, maps: {}, singles: {}};
  for (const [name, m] of Object.entries(maps))
    out.maps[name] = [...m.entries()].filter(
      ([, v]) => v && typeof v === 'object' && Number.isFinite(v.t)
    );
  for (const [name, s] of Object.entries(singles)) {
    const v = s.get();
    if (v && typeof v === 'object' && Number.isFinite(v.t) && v.t > 0)
      out.singles[name] = v;
  }
  return out;
}
export function restoreCaches(
  snap,
  {maps = {}, singles = {}},
  now = Date.now(),
  maxAgeMs = STATE_MAX_AGE_MS
) {
  const counts = {maps: 0, singles: 0, dropped: 0};
  if (!snap || typeof snap !== 'object') return counts;
  const fresh = (v) =>
    v &&
    typeof v === 'object' &&
    Number.isFinite(v.t) &&
    now - v.t <= maxAgeMs &&
    v.t <= now + 60e3;
  for (const [name, m] of Object.entries(maps)) {
    const rows = snap.maps?.[name];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== 'string')
        continue;
      const [k, v] = row;
      if (!fresh(v)) {
        counts.dropped++;
        continue;
      }
      const have = m.get(k);
      if (have && Number.isFinite(have.t) && have.t >= v.t) continue;
      m.set(k, v);
      counts.maps++;
    }
  }
  for (const [name, s] of Object.entries(singles)) {
    const v = snap.singles?.[name];
    if (v === undefined) continue;
    if (!fresh(v)) {
      counts.dropped++;
      continue;
    }
    const have = s.get();
    if (have && Number.isFinite(have.t) && have.t >= v.t) continue;
    s.set(v);
    counts.singles++;
  }
  return counts;
}
// The areas a snapshot served most recently, from its per-area cache
// keys ("33,-117" one-degree keys or "32.9/-117.1" tenth-degree
// ones), newest first, the home's own area excluded, at most max.
export function recentAreas(
  snap,
  home,
  max = 6,
  now = Date.now(),
  maxAgeMs = STATE_MAX_AGE_MS
) {
  const seen = new Map();
  for (const rows of Object.values(snap?.maps ?? {})) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!Array.isArray(row) || typeof row[0] !== 'string') continue;
      const m = /^(-?\d+(?:\.\d+)?)[,/](-?\d+(?:\.\d+)?)$/.exec(row[0]);
      if (!m) continue;
      const lat = Number(m[1]);
      const lon = Number(m[2]);
      if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) continue;
      const t = Number.isFinite(row[1]?.t) ? row[1].t : 0;
      if (now - t > maxAgeMs) continue; // an area nobody asked for in a day
      const key = Math.round(lat) + ',' + Math.round(lon);
      if (home && key === Math.round(home.lat) + ',' + Math.round(home.lon))
        continue;
      const have = seen.get(key);
      if (!have || have.t < t)
        seen.set(key, {lat: Math.round(lat), lon: Math.round(lon), t});
    }
  }
  return [...seen.values()]
    .sort((a, b) => b.t - a.t)
    .slice(0, max)
    .map(({lat, lon}) => ({lat, lon}));
}
export function warmUpPlan(home, areas = []) {
  const out = [];
  for (const a of [home, ...areas]) for (const p of warmUpPaths(a)) out.push(p);
  return [...new Set(out)];
}
export function budgetLeftMs(deadlineMs, nowMs) {
  return Math.max(0, deadlineMs - nowMs);
}
export function fetchBudgetMs(deadlineMs, nowMs, capMs) {
  return Math.min(capMs, budgetLeftMs(deadlineMs, nowMs));
}

// ---- Origin allowlist + per-IP rate limit ----------------------

// Browser requests carry Origin; only the website's origin gets
// the CORS grant, anything else is refused outright. Non-browser
// requests (no Origin) pass without a grant - the rate limiter
// still applies to them.
// The deployed revision's file (158th pass): install.sh writes
// {"rev", "installedAt"} beside index.mjs; anything else reads as
// no version, never as a throw (a hand-run daemon has none).
export function parseVersion(text) {
  try {
    const v = JSON.parse(text);
    return {
      rev: typeof v.rev === 'string' && v.rev ? v.rev : null,
      installedAt:
        typeof v.installedAt === 'string' && v.installedAt
          ? v.installedAt
          : null
    };
  } catch {
    return {rev: null, installedAt: null};
  }
}
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

// ---- MODIS land feeds (NDVI + surface reflectance) ------------
// The pure URL builders, parsers and QA bitfield decode now live in the
// shared modis-land.js so the theme fetches ORNL DIRECTLY (the service
// is keyless and CORS-open). Imported at the top for the daemon's
// optional proxy handlers below, and re-exported for server-reference.
export {
  ndviCell,
  ndviDatesUrl,
  ndviUrl,
  ndviDate,
  parseNdvi,
  MOD09_BANDS,
  MOD09_STATE_BAND,
  surfaceDatesUrl,
  surfaceUrl,
  parseSurface,
  parseSurfaceState,
  surfaceQaClean
};

// ---- Measured ocean colour: ESA CCI Rrs (CoastWatch ERDDAP) ----
// The measured-sea-colour feed: ESA Ocean Colour CCI v6.0 remote-sensing
// reflectance Rrs at six visible bands for the cell over the point, so
// the sea colour is the MEASURED reflectance (ocean-measured-color.js
// integrates the bands through CIE), valid in turbid Case-2 water the
// Morel Case-1 /chlor model misreads. Like /chlor, CoastWatch ERDDAP
// sends no CORS header so the daemon proxies; the URL is built HERE from
// the snapped cell only. One request returns all six bands (ERDDAP joins
// variables). CCI is science-quality (~6-month latency); the theme uses
// it as the primary colour with the NRT Morel colour as the cloud-gap
// fallback. The pure pieces live here for server-reference.mjs.
// The daily product is the primary; its 8-day composite is the
// CLOUD-GAP fallback (144th pass: a daily cell answers null under
// cloud or at the coast for weeks at a time - the composite carries
// the same bands over the same grid, filled by the clear days).
export const RRS_DATASETS = {
  daily:
    'https://coastwatch.pfeg.noaa.gov/erddap/griddap/pmlEsaCCI60OceanColorDaily.json',
  '8day':
    'https://coastwatch.pfeg.noaa.gov/erddap/griddap/pmlEsaCCI60OceanColor8Day.json'
};
const RRS_DATASET = RRS_DATASETS.daily;
const RRS_VARS = [
  'Rrs_412',
  'Rrs_443',
  'Rrs_490',
  'Rrs_510',
  'Rrs_560',
  'Rrs_665'
];

// Snap to the ESA CCI ~1/24-deg (4 km) grid for cache coherence;
// idempotent. ERDDAP nearest-neighbours the snapped point to its cell.
export function rrsCell(lat, lon) {
  const snap = (x, n) => Math.round(Math.max(-n, Math.min(n, x)) * 24) / 24;
  return {lat: snap(lat, 90), lon: snap(lon, 180)};
}

// The multi-band point-query URL, built from the snapped cell only. The
// CCI grid is [time][latitude][longitude] - no altitude term (the
// chlorophyll product has one; this one does not).
export function rrsUrl(cell, product = 'daily') {
  const idx = `%5B(last)%5D%5B(${cell.lat})%5D%5B(${cell.lon})%5D`;
  const base = RRS_DATASETS[product] ?? RRS_DATASET;
  return base + '?' + RRS_VARS.map((v) => v + idx).join(',');
}
// Which answer serves: the daily's measurement when it has one, else
// the composite's, else whichever real no-measure answer arrived
// (daily first); null when neither request produced a usable body.
export function rrsPick(daily, composite) {
  if (daily && daily.rrs) return daily;
  if (composite && composite.rrs) return composite;
  return daily ?? composite ?? null;
}

// null = unusable response (-> 502); {rrs: null} = a real no-measure
// answer (a cloud-gap pixel: any band null or the 9.97e36 fill). A valid
// answer is the six Rrs values in band order, small negatives (residual
// atmospheric correction) clamped up to 0.
export function parseRrs(j) {
  const t = j?.table;
  const row = t?.rows?.[0];
  if (!row || !Array.isArray(t.columnNames)) return null;
  const time = typeof row[0] === 'string' ? row[0] : null;
  const rrs = [];
  for (const v of RRS_VARS) {
    const col = t.columnNames.indexOf(v);
    if (col < 0) return null;
    const val = row[col];
    if (typeof val !== 'number' || !Number.isFinite(val) || val > 1)
      return {rrs: null, time};
    rrs.push(Math.max(0, val));
  }
  return {rrs, time};
}

// ---- Foundation SST field: JPL MUR (CoastWatch ERDDAP) ----------
// The per-pixel clear-sky reference for the satellite cloud field
// (goesir.js, 147th pass) and the sea temperature where no pier or
// buoy is within reach: JPL's MUR v4.1 analysis (0.01 deg, daily,
// sea_surface_foundation_temperature - the temperature under the
// diurnal skin; "the data for the most recent 7 days is usually
// revised everyday", the dataset's own summary) as CoastWatch's
// ERDDAP serves it (no CORS header - the daemon proxies). One request
// answers a 3-deg box at stride 5 (0.05 deg, 61 x 61 points, ~200 kB
// upstream in ~1.2 s, measured 2026-09-05), re-encoded compactly
// (values to 0.001 C, null over land and where the analysis has no
// value). The pure pieces live here for server-reference.mjs.
export const SST_DATASET =
  'https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41.json';
export const SST_HALF_DEG = 1.5;
export const SST_STRIDE = 5; // 0.05 deg on the 0.01-deg grid

// Snap to a 0.5-deg cell (the box around it covers +-1 deg of any
// point inside, the cloud field's 100-km window); idempotent; the
// poles and the antimeridian clamp so the box stays on the grid.
export function sstCell(lat, lon) {
  const snap = (x, n) => Math.round(Math.max(-n, Math.min(n, x)) * 2) / 2;
  return {lat: snap(lat, 88), lon: snap(lon, 178.5)};
}
export function sstUrl(cell) {
  const f = (v) => +v.toFixed(2);
  const la0 = f(cell.lat - SST_HALF_DEG);
  const la1 = f(cell.lat + SST_HALF_DEG);
  const lo0 = f(cell.lon - SST_HALF_DEG);
  const lo1 = f(cell.lon + SST_HALF_DEG);
  return (
    SST_DATASET +
    `?analysed_sst%5B(last)%5D%5B(${la0}):${SST_STRIDE}:(${la1})%5D` +
    `%5B(${lo0}):${SST_STRIDE}:(${lo1})%5D`
  );
}
// null = unusable response (-> 502); a grid with every value null is
// a real answer (an inland box). The grid is row-major with latitude
// outer, as ERDDAP orders its rows.
export function parseSst(j) {
  const t = j?.table;
  if (!t || !Array.isArray(t.rows) || !Array.isArray(t.columnNames))
    return null;
  const col = (name) => t.columnNames.indexOf(name);
  const ct = col('time');
  const cla = col('latitude');
  const clo = col('longitude');
  const cv = col('analysed_sst');
  if (ct < 0 || cla < 0 || clo < 0 || cv < 0 || !t.rows.length) return null;
  const lats = [...new Set(t.rows.map((r) => r[cla]))].sort((a, b) => a - b);
  const lons = [...new Set(t.rows.map((r) => r[clo]))].sort((a, b) => a - b);
  const nLat = lats.length;
  const nLon = lons.length;
  if (nLat < 2 || nLon < 2 || nLat * nLon !== t.rows.length) return null;
  const dLat = (lats[nLat - 1] - lats[0]) / (nLat - 1);
  const dLon = (lons[nLon - 1] - lons[0]) / (nLon - 1);
  const sst = new Array(nLat * nLon).fill(null);
  let validN = 0;
  for (const r of t.rows) {
    const i = Math.round((r[cla] - lats[0]) / dLat);
    const jj = Math.round((r[clo] - lons[0]) / dLon);
    if (i < 0 || jj < 0 || i >= nLat || jj >= nLon) return null;
    const v = r[cv];
    if (typeof v === 'number' && Number.isFinite(v) && v > -7 && v < 50) {
      sst[i * nLon + jj] = Math.round(v * 1000) / 1000;
      validN++;
    }
  }
  const time = typeof t.rows[0][ct] === 'string' ? t.rows[0][ct] : null;
  return {
    time,
    lat0: lats[0],
    lon0: lons[0],
    dLat: +dLat.toFixed(6),
    dLon: +dLon.toFixed(6),
    nLat,
    nLon,
    validN,
    sst
  };
}

// ---- NOAA's operational cloud products (148th-153rd) ------------
// The listing and file URLs, the asks, the window and vector decodes
// and the bodies live in goesl2-decode.js since the 155th pass -
// pure, so the PAGE runs the same code against the CORS-open buckets
// when this daemon is unreachable (goesl2-client.js). Re-exported
// here for server-reference.mjs; node's inflate is this side's only
// addition (the whole-bytes decodeL2 takes it by default).
import * as L2 from '../../goesl2-decode.js';
export {
  L2_HALF_PX,
  L2_LIST_MS,
  L2_RETRY_MS,
  L2_WINDOW_MS,
  L2_HELD_WINDOWS,
  L2_AT_MAX_AGE_MS,
  L2_RANGE_BLOCK,
  L2_HEAD_BYTES,
  L2_LIST_KEYS,
  l2ListUrl,
  l2FileUrl,
  l2Prefixes,
  l2Cell,
  L2_MASK_SPEC,
  L2_HEIGHT_SPEC,
  L2_IMAGERY_SPEC,
  L2_COD_SPEC,
  L2_CPS_SPEC,
  L2_SST_SPEC,
  L2_DSR_SPEC,
  L2_DMW_RADIUS_KM,
  L2_DMW_HEAD_BYTES,
  L2_AOD_SPEC,
  L2_AOD_EXTRAS,
  L2_AOD_BOX_R,
  L2_LST_SPEC,
  L2_LST_EXTRAS,
  L2_LST_NEAR_PX,
  L2_VIS_BAND,
  L2_VIS_SPEC,
  L2_VIS_EXTRAS,
  l2VisBody,
  L2_ASKS,
  decodeL2Window,
  decodeL2Vectors,
  l2Window,
  l2MaskBody,
  l2HeightBody,
  l2ImageryBody,
  l2SstBody,
  l2DmwBody,
  l2DsrBody,
  l2AodBody,
  l2LstBody,
  L2_PHASE_SPEC,
  L2_PHASE_EXTRAS,
  l2PhaseBody,
  L2_FIRE_SPEC,
  L2_FIRE_EXTRAS,
  l2FireBody,
  L2_TPW_SPEC,
  L2_RAIN_SPEC,
  L2_RAIN_EXTRAS,
  L2_ADP_SPEC,
  L2_ADP_EXTRAS,
  L2_LVT_SPEC,
  L2_LVM_SPEC,
  L2_LAP_EXTRAS,
  L2_TPW_EXTRAS,
  l2TpwBody,
  l2RainBody,
  l2AdpBody,
  l2LvtBody,
  l2LvmBody,
  decodeL2Column,
  l2DcompBody
} from '../../goesl2-decode.js';
const {
  L2_HALF_PX,
  L2_LIST_MS,
  L2_RETRY_MS,
  L2_WINDOW_MS,
  L2_HELD_WINDOWS,
  L2_AT_MAX_AGE_MS,
  L2_RANGE_BLOCK,
  L2_HEAD_BYTES,
  L2_LIST_KEYS,
  l2ListUrl,
  l2FileUrl,
  l2Prefixes,
  l2Cell,
  L2_MASK_SPEC,
  L2_HEIGHT_SPEC,
  L2_IMAGERY_SPEC,
  L2_COD_SPEC,
  L2_CPS_SPEC,
  L2_SST_SPEC,
  L2_DSR_SPEC,
  L2_DMW_RADIUS_KM,
  L2_DMW_HEAD_BYTES,
  L2_ASKS,
  decodeL2Window,
  decodeL2Vectors,
  decodeL2Column,
  l2Window,
  l2MaskBody,
  l2HeightBody,
  l2ImageryBody,
  l2SstBody,
  l2DmwBody,
  l2DsrBody,
  l2AodBody,
  l2LstBody,
  l2PhaseBody,
  l2FireBody,
  l2TpwBody,
  l2RainBody,
  l2AdpBody,
  l2LvtBody,
  l2LvmBody,
  l2DcompBody
} = L2;
const l2Inflate = (u8) =>
  new Uint8Array(
    inflateSync(Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength))
  );
export function decodeL2(bytes, spec, inflate = l2Inflate, extras = null) {
  return L2.decodeL2(bytes, spec, inflate, extras);
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
    st.attempts = (st.attempts || 0) + 1;
    st.gen = (st.gen || 0) + 1;
    const gen = st.gen;
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
    // Node's WebSocket has NO handshake timeout: a half-open
    // upstream (SYN accepted, 101 never answered) fires no event
    // at all and would wedge the reconnect loop forever - the
    // production box was found exactly there (connects frozen at
    // 1, zero frames for the daemon's whole uptime). 15 s with
    // no 'open' aborts and retries.
    const openTimer = setTimeout(() => {
      if (st.gen === gen) {
        log('ais handshake timeout - aborting the attempt');
        try {
          ws.close();
        } catch {
          // fall through to reopen either way
        }
        reopen();
      }
    }, 15e3);
    openTimer.unref?.();
    ws.addEventListener('open', () => {
      clearTimeout(openTimer);
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
    ws.addEventListener(
      'close',
      (ev) => {
        st.lastClose = {code: ev.code, at: Date.now()};
        reopen();
      },
      {once: true}
    );
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
    // The reopen path for THIS attempt, callable by the watchdog
    // even when the socket swallows its own close event.
    st.forceReopen = () => {
      if (st.gen !== gen) return; // a newer attempt owns the loop
      try {
        ws.close();
      } catch {
        // proceed to reopen regardless
      }
      reopen();
    };
  };
  connect();
  // Watchdog: a socket that is "open" but silent for 3 minutes is
  // dead upstream (a valid global subscription floods within
  // seconds - the world's oceans do not empty). The cycle goes
  // through forceReopen, which reschedules EVEN IF the dead
  // socket never fires its close event - the failure mode that
  // froze the production box at connects=1 with zero frames.
  setInterval(() => {
    if (Date.now() - (st.lastFrame || st.started) > 180e3) {
      log('ais watchdog: no frames for 180 s - cycling the socket');
      st.cycles = (st.cycles || 0) + 1;
      if (st.forceReopen) st.forceReopen();
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
  const aeronetCache = new Map(); // site name -> {t, body}
  let aeronetSites = {t: 0, sites: []}; // the station list, daily
  let gmnCache = {t: 0, body: null}; // yesterday's medians, 6-hourly
  let gvpCache = {t: 0, body: null}; // weekly eruption report, 6-hourly
  let gvpElev = {t: 0, map: new Map()}; // Holocene summit elevations, daily
  let sndStations = {t: 0, list: []}; // IGRA station list, daily
  const sndCache = new Map(); // 1-deg area -> {t, body}, hourly
  let buoyStations = {t: 0, list: []}; // NDBC active stations, daily
  const buoyCache = new Map(); // 1-deg area -> {t, body}, 30 min
  let cobsCache = {t: 0, body: null}; // measured comet medians, 3-hourly
  const aerosolCache = new Map(); // 0.25-deg cell key -> {t, body}
  const ozoneCache = new Map(); // 0.25-deg cell key -> {t, body}
  const chlorCache = new Map(); // 1/12-deg cell key -> {t, body}
  const ndviCache = new Map(); // 0.01-deg cell key -> {t, body}
  const surfaceCache = new Map(); // 0.01-deg cell key -> {t, body}
  const rrsCache = new Map(); // 1/24-deg cell key -> {t, body}
  const sstCache = new Map(); // 0.5-deg cell key -> {t, body} (MUR box)
  // NOAA's L2 cloud products (148th pass; range reads in the 151st):
  // the bucket listings, the decoded WINDOWS by file key and
  // tenth-degree cell (typed arrays, tens of kB each - RAM only,
  // never persisted; a dozen per satellite and product), the reads
  // in flight, the products' failure holds, and the dressed bodies
  // per cell and file keys
  const l2Listings = new Map(); // `${bucket}/${prefix}` -> {t, until, keys}
  const l2Decoded = new Map(); // `${bucket}/${product}/${key}/${cell}` -> {t, key, stamp, cell, dec, ranges, bytes, total}
  const l2Inflight = new Map(); // the same key -> the promise in flight
  const l2Fail = new Map(); // `${bucket}/${product}` -> retry-after ms
  const goesl2Cache = new Map(); // `${sat}/${cell}/${keys}` -> {t, body}
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of adsbCache) if (now - v.t > 30e3) adsbCache.delete(k);
    for (const [k, v] of metarCache)
      if (now - v.t > 20 * 60e3) metarCache.delete(k);
    for (const [k, v] of aerosolCache)
      if (now - v.t > 90 * 60e3) aerosolCache.delete(k);
    for (const [k, v] of ozoneCache)
      if (now - v.t > 3 * 3600e3) ozoneCache.delete(k);
    for (const [k, v] of chlorCache)
      if (now - v.t > 12 * 3600e3) chlorCache.delete(k);
    for (const [k, v] of ndviCache)
      if (now - v.t > 12 * 3600e3) ndviCache.delete(k);
    for (const [k, v] of surfaceCache)
      if (now - v.t > 12 * 3600e3) surfaceCache.delete(k);
    for (const [k, v] of rrsCache)
      if (now - v.t > 12 * 3600e3) rrsCache.delete(k);
    for (const [k, v] of sstCache)
      if (now - v.t > 12 * 3600e3) sstCache.delete(k);
    for (const [k, v] of goesl2Cache)
      if (now - v.t > L2_WINDOW_MS) goesl2Cache.delete(k);
    // a decoded window nobody asked for in an hour is let go
    for (const [k, v] of l2Decoded) if (now - v.t > 3600e3) l2Decoded.delete(k);
    for (const [k, v] of l2Listings) if (now > v.until) l2Listings.delete(k);
    for (const [k, v] of l2Fail) if (now > v) l2Fail.delete(k);
  }, 30e3).unref();

  // Persistence (snapshotCaches/restoreCaches): the slow per-area
  // caches and the sitewide feeds survive a restart through the
  // systemd StateDirectory (HORIZON_STATE_DIR overrides; none set:
  // no persistence, logged once). The short-lived adsb cache and
  // the streaming pictures are not persisted.
  // THE DEPLOYED REVISION (158th pass): install.sh writes VERSION
  // beside index.mjs ({rev, installedAt}); /health, /probe and the
  // /goesl2 body carry it, so a box that silently kept an old deploy
  // (the 151st-157th: the ship list lacked goesl2-decode.js and the
  // drift guard refused every revision) is seen from anywhere.
  const VERSION = (() => {
    try {
      return parseVersion(
        readFileSync(new URL('./VERSION', import.meta.url), 'utf8')
      );
    } catch {
      return {rev: null, installedAt: null};
    }
  })();
  log(
    `version: ${VERSION.rev ? VERSION.rev.slice(0, 12) + ' installed ' + VERSION.installedAt : 'no VERSION file (a hand-run tree)'}`
  );
  const versionInfo = () => ({
    ...VERSION,
    // the products this box serves (a pageOnly ask is the page's own)
    products: L2_ASKS.filter((a) => !a.pageOnly).map((a) => a.id),
    node: process.versions.node
  });
  const STATE_DIR = (env.HORIZON_STATE_DIR ?? env.STATE_DIRECTORY ?? '')
    .split(':')[0]
    .trim();
  const STATE_FILE = STATE_DIR ? joinPath(STATE_DIR, 'cache.json') : '';
  const single = (get, set) => ({get, set});
  const persisted = {
    maps: {
      sounding: sndCache,
      buoy: buoyCache,
      metar: metarCache,
      aeronet: aeronetCache,
      aerosol: aerosolCache,
      ozone: ozoneCache,
      chlor: chlorCache,
      ndvi: ndviCache,
      surface: surfaceCache,
      rrs: rrsCache,
      sst: sstCache
    },
    singles: {
      tles: single(
        () => tlesCache,
        (v) => (tlesCache = v)
      ),
      gmn: single(
        () => gmnCache,
        (v) => (gmnCache = v)
      ),
      gvp: single(
        () => gvpCache,
        (v) => (gvpCache = v)
      ),
      cobs: single(
        () => cobsCache,
        (v) => (cobsCache = v)
      ),
      sndStations: single(
        () => sndStations,
        (v) => (sndStations = v)
      ),
      buoyStations: single(
        () => buoyStations,
        (v) => (buoyStations = v)
      ),
      aeronetSites: single(
        () => aeronetSites,
        (v) => (aeronetSites = v)
      )
    }
  };
  const stateInfo = {file: STATE_FILE || null, restored: null, savedAt: 0};
  let stateSnap = null;
  if (STATE_FILE) {
    try {
      stateSnap = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
      const c = restoreCaches(stateSnap, persisted);
      stateInfo.restored = {...c, savedAt: stateSnap.savedAt ?? null};
      log(
        `state: restored ${c.maps} cache rows and ${c.singles} feeds from ${STATE_FILE} ` +
          `(saved ${new Date(stateSnap.savedAt ?? 0).toISOString()}, ${c.dropped} stale dropped)`
      );
    } catch (e) {
      log(
        `state: nothing restored from ${STATE_FILE} (${e.code ?? e.message})`
      );
    }
  } else log('state: no StateDirectory - caches live only in RAM');
  const saveState = () => {
    if (!STATE_FILE) return false;
    try {
      const snap = snapshotCaches(persisted);
      writeFileSync(STATE_FILE + '.tmp', JSON.stringify(snap));
      renameSync(STATE_FILE + '.tmp', STATE_FILE);
      stateInfo.savedAt = snap.savedAt;
      return true;
    } catch (e) {
      log('state: save failed (' + e.message + ')');
      return false;
    }
  };
  setInterval(saveState, STATE_SAVE_MS).unref();
  for (const sig of ['SIGTERM', 'SIGINT'])
    process.on(sig, () => {
      const ok = saveState();
      log(`state: ${ok ? 'saved' : 'not saved'} on ${sig}, exiting`);
      process.exit(0);
    });

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
  // Measured total-column ozone: the operational GFS's TOZNE (WMO
  // 4.2-0-14-0, Dobson units) through the SAME NOMADS grib-filter
  // path the aerosols ride - the filter's subregion extraction
  // re-packs to simple packing, so the gated grib2.js decodes the
  // GFS unchanged. One 0.25-deg cell per request (~200 bytes);
  // GFS cycles 6-hourly with hourly forecast files, so successes
  // cache 60 min and failures 5. ozone.js's census fails CLOSED
  // outside [70, 700] DU - the sky never runs on decode garbage.
  const ozoneState = {fetches: 0, errors: 0, cycle: ''};
  async function fetchOzone(lat, lon) {
    const cla = Math.max(-90, Math.min(90, Math.round(lat * 4) / 4));
    const clo = (((Math.round(lon * 4) / 4) % 360) + 360) % 360;
    const key = cla + '/' + clo;
    const hit = ozoneCache.get(key);
    if (hit && Date.now() - hit.t < (hit.body ? 60 : 5) * 60e3) return hit.body;
    const bottom = Math.max(-90, Math.min(cla - 0.25, 89.5));
    const left = Math.max(0, Math.min(clo - 0.25, 359.5));
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
        Math.min(120, Math.round((Date.now() - ct) / 3600e3))
      );
      const u =
        'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl' +
        `?dir=%2Fgfs.${ymd}%2F${hh}%2Fatmos` +
        `&file=gfs.t${hh}z.pgrb2.0p25.f${String(fhr).padStart(3, '0')}` +
        '&var_TOZNE=on&all_lev=on' +
        `&subregion=&leftlon=${left}&rightlon=${left + 0.5}` +
        `&toplat=${bottom + 0.5}&bottomlat=${bottom}`;
      try {
        ozoneState.fetches++;
        const r = await fetch(u, {
          signal: AbortSignal.timeout(15e3),
          headers: {'user-agent': UA}
        });
        if (!r.ok) continue;
        const buf = new Uint8Array(await r.arrayBuffer());
        const census = ozoneCensus(parseGrib2(buf), cla, clo, gridValue);
        if (!census) continue;
        const cycle = `${d.toISOString().slice(0, 13)}:00Z`;
        ozoneState.cycle = cycle + '+' + fhr;
        const body = {
          du: census.du,
          cycle,
          fhr,
          cell: {lat: cla, lon: clo > 180 ? clo - 360 : clo}
        };
        ozoneCache.set(key, {t: Date.now(), body});
        return body;
      } catch {
        ozoneState.errors++;
      }
    }
    ozoneCache.set(key, {t: Date.now(), body: null});
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
  // Measured land colour for the 0.01-deg cell over the point: the three
  // MOD09A1 visible bands (blue/green/red) at the latest 8-day composite
  // (date resolved once, cached 6 h; the calendar is global). One
  // upstream call per band - three per cell - assembled into a reflect-
  // ance triple; successes cache 12 h, failures 10 min.
  const surfaceState = {
    fetches: 0,
    errors: 0,
    rejected: 0,
    date: '',
    calDate: ''
  };
  const surfaceDateCache = {t: 0, date: ''};
  async function resolveSurfaceDate() {
    if (surfaceDateCache.date && Date.now() - surfaceDateCache.t < 6 * 3600e3)
      return surfaceDateCache.date;
    try {
      const r = await fetch(surfaceDatesUrl(NDVI_DATE_REF), {
        signal: AbortSignal.timeout(FETCH_MS),
        headers: {'user-agent': UA}
      });
      if (!r.ok) throw new Error('ornl mod09 dates ' + r.status);
      const date = ndviDate(await r.json()); // same Ayyyyddd calendar shape
      if (!date) throw new Error('ornl mod09 dates shape');
      surfaceDateCache.t = Date.now();
      surfaceDateCache.date = date;
      surfaceState.date = date;
      return date;
    } catch {
      surfaceState.errors++;
      return surfaceDateCache.date || null;
    }
  }
  async function fetchSurface(lat, lon) {
    const date = await resolveSurfaceDate();
    if (!date) return null;
    const cell = ndviCell(lat, lon);
    const key = cell.lat + '/' + cell.lon;
    const hit = surfaceCache.get(key);
    if (hit && Date.now() - hit.t < (hit.body ? 720 : 10) * 60e3)
      return hit.body;
    try {
      surfaceState.fetches++;
      const opt = {
        signal: AbortSignal.timeout(15e3),
        headers: {'user-agent': UA}
      };
      const [blue, green, red, state] = await Promise.all([
        ...[MOD09_BANDS.blue, MOD09_BANDS.green, MOD09_BANDS.red].map(
          async (b) => {
            const r = await fetch(surfaceUrl(cell, date, b), opt);
            if (!r.ok) throw new Error('ornl mod09 ' + r.status);
            const p = parseSurface(await r.json());
            if (!p) throw new Error('ornl mod09 shape');
            return p;
          }
        ),
        (async () => {
          const r = await fetch(surfaceUrl(cell, date, MOD09_STATE_BAND), opt);
          if (!r.ok) throw new Error('ornl mod09 state ' + r.status);
          return parseSurfaceState(await r.json());
        })()
      ]);
      if (blue.date) surfaceState.calDate = blue.date;
      // A pixel counts as measured only when it has real reflectance AND
      // its QA is clean; a cloud/mixed/shadow pixel (or a fill/off-land
      // one) answers as no-measure so the terrain keeps its tuned grass.
      const clean = surfaceQaClean(state);
      const measured =
        clean && blue.refl != null && green.refl != null && red.refl != null;
      if (!clean) surfaceState.rejected++;
      const body = {
        blue: measured ? blue.refl : null,
        green: measured ? green.refl : null,
        red: measured ? red.refl : null,
        date: blue.date,
        qa: clean ? 'clean' : 'contaminated',
        cell
      };
      surfaceCache.set(key, {t: Date.now(), body});
      return body;
    } catch {
      surfaceState.errors++;
      surfaceCache.set(key, {t: Date.now(), body: null});
      return null;
    }
  }
  // Measured ocean colour for the cell over the point: the six ESA CCI
  // Rrs bands in ONE ERDDAP request (URL from the gated rrsUrl). Cloud-
  // gap pixels answer {rrs: null} (a real 200); successes cache 12 h,
  // failures 10 min. CCI is a slow science product, so the long cache is
  // ample.
  const rrsState = {fetches: 0, errors: 0, time: ''};
  async function fetchRrs(lat, lon) {
    const cell = rrsCell(lat, lon);
    const key = cell.lat + '/' + cell.lon;
    const hit = rrsCache.get(key);
    if (hit && Date.now() - hit.t < (hit.body ? 720 : 10) * 60e3)
      return hit.body;
    try {
      rrsState.fetches++;
      // Both products in parallel under the shared upstream budget
      // (a six-band ERDDAP point query takes ~18 s here - measured
      // 17.7 s twice on 2026-09-05 - which the old 15-s timeout
      // turned into a 502 on every call); the daily's measurement
      // wins, the composite fills its cloud gaps (rrsPick).
      const deadline = Date.now() + UPSTREAM_BUDGET_MS;
      const get = async (product) => {
        const r = await fetch(rrsUrl(cell, product), {
          signal: AbortSignal.timeout(
            fetchBudgetMs(deadline, Date.now(), UPSTREAM_BUDGET_MS)
          ),
          headers: {'user-agent': UA}
        });
        if (!r.ok) throw new Error('cci ' + r.status);
        const parsed = parseRrs(await r.json());
        if (!parsed) throw new Error('cci shape');
        return {...parsed, product};
      };
      const [d, c] = await Promise.allSettled([get('daily'), get('8day')]);
      const picked = rrsPick(
        d.status === 'fulfilled' ? d.value : null,
        c.status === 'fulfilled' ? c.value : null
      );
      if (!picked)
        throw new Error(d.reason?.message ?? c.reason?.message ?? 'cci');
      if (picked.time) rrsState.time = picked.time;
      const body = {...picked, cell};
      rrsCache.set(key, {t: Date.now(), body});
      return body;
    } catch {
      rrsState.errors++;
      rrsCache.set(key, {t: Date.now(), body: null});
      return null;
    }
  }
  // The foundation-SST box over the point's 0.5-deg cell: one ERDDAP
  // request (URL from the gated sstUrl), parsed by the gated
  // parseSst. MUR is daily, so successes cache 6 h (the newest day
  // reaches ERDDAP once a day); failures 10 min.
  const sstState = {fetches: 0, errors: 0, time: ''};
  async function fetchSst(lat, lon) {
    const cell = sstCell(lat, lon);
    const key = cell.lat + '/' + cell.lon;
    const hit = sstCache.get(key);
    if (hit && Date.now() - hit.t < (hit.body ? 360 : 10) * 60e3)
      return hit.body;
    try {
      sstState.fetches++;
      const r = await fetch(sstUrl(cell), {
        signal: AbortSignal.timeout(UPSTREAM_BUDGET_MS),
        headers: {'user-agent': UA}
      });
      if (!r.ok) throw new Error('mur ' + r.status);
      const parsed = parseSst(await r.json());
      if (!parsed) throw new Error('mur shape');
      if (parsed.time) sstState.time = parsed.time;
      const body = {...parsed, cell};
      sstCache.set(key, {t: Date.now(), body});
      return body;
    } catch {
      sstState.errors++;
      sstCache.set(key, {t: Date.now(), body: null});
      return null;
    }
  }
  // NOAA's L2 cloud products (148th pass; range reads in the 151st).
  // A product's file for a moment: the bucket's hour prefix is
  // listed (a listing stands a minute - the cheap part, ~2 kB), the
  // newest start stamp is taken for "latest", or the stamp nearest
  // the asked time (a mosaic's own minute, within 15 min -
  // nearestByStart, gated); the window is read from the file by
  // HTTP range ONLY when that key and cell are not already held.
  // Windows are kept by file key and cell, a dozen per product
  // (L2_HELD_WINDOWS). One read per key and cell in flight at a
  // time; a listing or read failure holds the product L2_RETRY_MS,
  // during which the newest held window of the cell stands in for
  // "latest" and a timed ask gets nothing.
  const l2State = {
    lists: 0,
    fetches: 0,
    ranges: 0,
    rangeBytes: 0,
    errors: 0,
    lastError: ''
  };
  async function l2Listing(bucket, prefix, deadline) {
    const k = bucket + '/' + prefix;
    const hit = l2Listings.get(k);
    if (hit && Date.now() < hit.until) return hit.keys;
    l2State.lists++;
    const r = await fetch(l2ListUrl(bucket, prefix), {
      signal: AbortSignal.timeout(
        fetchBudgetMs(deadline, Date.now(), UPSTREAM_BUDGET_MS)
      ),
      headers: {'user-agent': UA}
    });
    if (!r.ok) throw new Error('list ' + r.status);
    const keys = parseS3Keys(await r.text());
    l2Listings.set(k, {t: Date.now(), until: Date.now() + L2_LIST_MS, keys});
    return keys;
  }
  // the key for a moment (null: nothing listed for it): this hour's
  // prefix, then the previous hour's
  async function l2KeyFor(bucket, product, at, deadline, band = null) {
    const when = at ? new Date(at) : new Date();
    for (const prefix of l2Prefixes(product, when)) {
      const listed = await l2Listing(bucket, prefix, deadline);
      const keys = band ? bandKeys(listed, band) : listed;
      const pick = at ? nearestByStart(keys, at) : latestByStart(keys);
      if (pick) return pick;
    }
    return null;
  }
  // the newest window held for a product and cell (a hold's stand-in)
  const l2Newest = (pk, ck) => {
    let best = null;
    for (const [k, v] of l2Decoded)
      if (
        k.startsWith(pk + '/') &&
        k.endsWith('/' + ck) &&
        (!best || v.stamp > best.stamp)
      )
        best = v;
    return best;
  };
  // one HTTP range of a bucket file: 206 with the bytes (the
  // Content-Range total is the file's size, for the journal), 416
  // past the end (nothing), 200 from a server that ignored the
  // range (the whole file, cut here), anything else an error
  const l2RangeReader = (url, product, deadline, onTotal) => async (s, e) => {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(
        fetchBudgetMs(deadline, Date.now(), UPSTREAM_BUDGET_MS)
      ),
      headers: {'user-agent': UA, range: `bytes=${s}-${e - 1}`}
    });
    if (r.status === 206) {
      const m = /\/(\d+)$/.exec(r.headers.get('content-range') ?? '');
      if (m) onTotal(+m[1]);
      return new Uint8Array(await r.arrayBuffer());
    }
    if (r.status === 416) return new Uint8Array(0);
    if (r.status === 200) {
      const all = new Uint8Array(await r.arrayBuffer());
      onTotal(all.length);
      return all.subarray(s, e);
    }
    throw new Error(product + ' ' + r.status);
  };
  async function l2File(bucket, ask, deadline, at, cell) {
    const {product, spec, halfPx} = ask;
    const band = ask.band ?? null;
    const pk = bucket + '/' + product + (band ? '-' + band : '');
    const ck = cell.lat + '/' + cell.lon;
    const held = l2Fail.get(pk);
    if (held && Date.now() < held) return at ? null : l2Newest(pk, ck);
    try {
      const pick = await l2KeyFor(bucket, product, at, deadline, band);
      if (!pick) {
        if (at) return null;
        throw new Error(product + ': no file listed');
      }
      const dk = pk + '/' + pick.key + '/' + ck;
      const have = l2Decoded.get(dk);
      if (have) {
        have.t = Date.now();
        return have;
      }
      if (l2Inflight.has(dk)) return await l2Inflight.get(dk);
      const p = (async () => {
        try {
          l2State.fetches++;
          let total = null;
          const t0 = Date.now();
          const f = await openHdf5Lazy(
            l2RangeReader(
              l2FileUrl(bucket, pick.key),
              product,
              deadline,
              (n) => {
                total = n;
              }
            ),
            l2Inflate,
            {
              blockBytes: L2_RANGE_BLOCK,
              headBytes: ask.headBytes ?? L2_HEAD_BYTES
            }
          );
          const dec =
            ask.kind === 'vectors'
              ? await decodeL2Vectors(f, cell.lat, cell.lon, ask.radiusKm)
              : ask.kind === 'column'
                ? await decodeL2Column(
                    f,
                    spec,
                    cell.lat,
                    cell.lon,
                    halfPx,
                    ask.extras ?? null
                  )
                : await decodeL2Window(
                    f,
                    spec,
                    cell.lat,
                    cell.lon,
                    halfPx,
                    ask.extras ?? null
                  );
          if (!dec) throw new Error(product + ': not readable');
          l2State.ranges += f.stats.ranges;
          l2State.rangeBytes += f.stats.bytes;
          const row = {
            t: Date.now(),
            key: pick.key,
            stamp: pick.stamp,
            cell: ck,
            dec,
            ranges: f.stats.ranges,
            bytes: f.stats.bytes,
            total
          };
          l2Decoded.set(dk, row);
          // at most L2_HELD_WINDOWS per product: the least recently
          // asked for go first
          const mine = [...l2Decoded]
            .filter(([k]) => k.startsWith(pk + '/'))
            .sort((a, b) => a[1].t - b[1].t);
          while (mine.length > L2_HELD_WINDOWS)
            l2Decoded.delete(mine.shift()[0]);
          log(
            `goesl2: ${pick.key.split('/').pop()} (${f.stats.ranges} ranges, ` +
              `${(f.stats.bytes / 1024).toFixed(0)} kB of ` +
              (total ? `${(total / 1e6).toFixed(1)} MB` : 'unknown size') +
              `, ${f.stats.rounds} rounds in ${Date.now() - t0} ms, ${dec.time}` +
              (at ? `, for ${at}` : '') +
              (dec.vectors
                ? `, ${dec.vectors.length} of ${dec.total} vectors within ${ask.radiusKm} km`
                : dec.box
                  ? ''
                  : ', outside the scene') +
              ')'
          );
          return row;
        } finally {
          l2Inflight.delete(dk);
        }
      })();
      l2Inflight.set(dk, p);
      return await p;
    } catch (e) {
      l2State.errors++;
      l2State.lastError = e.message;
      log('goesl2: ' + e.message);
      l2Fail.set(pk, Date.now() + L2_RETRY_MS);
      return at ? null : l2Newest(pk, ck);
    }
  }
  // The answer for a point: null = both products failed (502); a
  // body with sat null = no bucket reaches this longitude (200, a
  // real answer); else the mask and height windows, either null
  // when its product failed or the point is outside its scene. With
  // `at` (ISO) the files nearest that moment, for the page's
  // comparison at its mosaic's own minute.
  // THE FLASHES FROM ORBIT (168th pass): the Geostationary Lightning
  // Mapper's flashes of the last minute around a point. The craft that
  // sees this longitude (the same pick as the ABI windows) writes a
  // 20-second LCFA file every 20 seconds (about 400 kB, read whole);
  // the newest three are held per bucket - a minute of flashes -
  // refreshed at most every 20 s, so a page asking every 30 s costs
  // this box one 400-kB read per 20 s per craft and answers in
  // microseconds from the ring.
  const glmHeld = new Map(); // bucket -> {at, files: [...], error}
  const GLM_REFRESH_MS = 20e3;
  const GLM_KEEP = 3;
  const GLM_WINDOW_MS = 60e3;
  async function glmRefresh(bucket, deadline) {
    const h = glmHeld.get(bucket) ?? {at: 0, files: [], error: null};
    if (Date.now() - h.at < GLM_REFRESH_MS) return h;
    h.at = Date.now();
    glmHeld.set(bucket, h);
    try {
      const pick = await l2KeyFor(bucket, 'GLM-L2-LCFA', null, deadline);
      if (!pick) throw new Error('no GLM file listed');
      if (!h.files.some((f) => f.key === pick.key)) {
        const r = await fetch(l2FileUrl(bucket, pick.key), {
          signal: AbortSignal.timeout(
            fetchBudgetMs(deadline, Date.now(), UPSTREAM_BUDGET_MS)
          )
        });
        if (!r.ok) throw new Error('GLM ' + r.status);
        const buf = new Uint8Array(await r.arrayBuffer());
        const parsed = parseGlmFlashes(openHdf5(buf, l2Inflate));
        if (!parsed) throw new Error('GLM file unreadable');
        h.files.push({
          key: pick.key,
          startMs: parsed.startMs,
          endMs: parsed.endMs,
          flashes: parsed.flashes,
          diskFlashes: parsed.diskFlashes,
          platform: parsed.platform,
          bytes: buf.length
        });
        h.files.sort((a, b) => a.startMs - b.startMs);
        while (h.files.length > GLM_KEEP) h.files.shift();
        // the ring is the last MINUTE, not the last three reads: a
        // file fetched before a quiet spell would otherwise stretch
        // the window (measured: 740 s across a 12-minute gap)
        const newest = h.files[h.files.length - 1].endMs;
        h.files = h.files.filter((f) => newest - f.endMs <= GLM_WINDOW_MS);
      }
      h.error = null;
    } catch (e) {
      h.error = e.message;
    }
    return h;
  }
  async function fetchGlm(lat, lon, km) {
    const pick = pickSatellite(lat, lon);
    const bucket = pick.sat ? L2_BUCKETS[pick.sat.id] : null;
    if (!bucket)
      return {
        sat: null,
        name: null,
        reason: pick.sat
          ? `${pick.sat.name} (${pick.sat.craft}) has no open bucket`
          : pick.nearest
            ? `${pick.nearest.name} sees this point at ${pick.viewZenithDeg.toFixed(0)} deg zenith, past the reach`
            : 'no satellite table',
        flashes: [],
        summary: null
      };
    const deadline = Date.now() + UPSTREAM_BUDGET_MS;
    const h = await glmRefresh(bucket, deadline);
    if (!h.files.length) return null;
    const all = h.files.flatMap((f) => f.flashes);
    const near = glmFlashesNear(all, lat, lon, {maxKm: km, cap: 300}).map(
      (f) => ({
        id: f.id,
        lat: +f.lat.toFixed(4),
        lon: +f.lon.toFixed(4),
        energyJ: f.energyJ,
        areaKm2: f.areaKm2 === null ? null : +f.areaKm2.toFixed(1),
        quality: f.quality,
        words: f.words,
        tFirstMs: f.tFirstMs,
        durationMs: f.durationMs === null ? null : Math.round(f.durationMs),
        distKm: +f.distKm.toFixed(1),
        bearingDeg: +f.bearingDeg.toFixed(1),
        strength: +f.strength.toFixed(3)
      })
    );
    const last = h.files[h.files.length - 1];
    return {
      sat: pick.sat.id,
      name: pick.sat.name,
      craft: pick.sat.craft,
      bucket,
      km,
      files: h.files.map((f) => ({
        key: f.key.split('/').pop(),
        start: new Date(f.startMs).toISOString(),
        end: new Date(f.endMs).toISOString(),
        n: f.flashes.length,
        diskFlashes: f.diskFlashes,
        kb: Math.round(f.bytes / 1024)
      })),
      windowStart: new Date(h.files[0].startMs).toISOString(),
      windowEnd: new Date(last.endMs).toISOString(),
      ageS: Math.round((Date.now() - last.endMs) / 1000),
      diskFlashes: last.diskFlashes,
      n: near.length,
      flashes: near,
      summary: glmSummary(near),
      error: h.error,
      atbd: GLM_ATBD.version
    };
  }
  async function fetchGoesL2(lat, lon, at = null) {
    const pick = pickSatellite(lat, lon);
    const bucket = pick.sat ? L2_BUCKETS[pick.sat.id] : null;
    if (!bucket)
      return {
        sat: null,
        reason: pick.sat
          ? `${pick.sat.name} (${pick.sat.craft}) has no open L2 bucket`
          : pick.nearest
            ? `${pick.nearest.name} sees this point at ${pick.viewZenithDeg.toFixed(0)} deg zenith, past the products' reach`
            : 'no satellite table'
      };
    const cell = l2Cell(lat, lon);
    const deadline = Date.now() + UPSTREAM_BUDGET_MS;
    // a pageOnly ask (159th: the 500-m visible window, a 430 kB body)
    // is the page's own read of the bucket, never this box's egress
    const asks = L2_ASKS.filter(
      (a) => !a.pageOnly && (!at || a.timed !== false)
    );
    const got = await Promise.all(
      asks.map((a) => l2File(bucket, a, deadline, at, cell))
    );
    const F = Object.fromEntries(asks.map((a, i) => [a.id, got[i]]));
    if (!got.some((f) => f)) return null;
    const ck =
      `${pick.sat.id}/${cell.lat}/${cell.lon}/${at ?? 'latest'}/` +
      got.map((f) => (f ? f.key : '-')).join('/');
    const hit = goesl2Cache.get(ck);
    if (hit) return hit.body;
    const body = {
      sat: pick.sat.id,
      name: pick.sat.name,
      craft: pick.sat.craft,
      bucket,
      viewZenithDeg: +pick.viewZenithDeg.toFixed(2),
      cell,
      at,
      halfPx: L2_HALF_PX,
      mask: F.mask
        ? l2MaskBody(F.mask.dec, F.mask.key, cell.lat, cell.lon)
        : null,
      height: F.height
        ? l2HeightBody(F.height.dec, F.height.key, cell.lat, cell.lon)
        : null,
      imagery: F.imagery
        ? l2ImageryBody(F.imagery.dec, F.imagery.key, cell.lat, cell.lon)
        : null,
      dcomp: F.cod
        ? l2DcompBody(
            F.cod.dec,
            F.cps ? F.cps.dec : null,
            F.cod.key,
            F.cps ? F.cps.key : null,
            cell.lat,
            cell.lon
          )
        : null,
      sst: F.sst ? l2SstBody(F.sst.dec, F.sst.key, cell.lat, cell.lon) : null,
      dsr: F.dsr ? l2DsrBody(F.dsr.dec, F.dsr.key, cell.lat, cell.lon) : null,
      dmw: F.dmw ? l2DmwBody(F.dmw.dec, F.dmw.key) : null,
      aod: F.aod ? l2AodBody(F.aod.dec, F.aod.key, cell.lat, cell.lon) : null,
      lst: F.lst ? l2LstBody(F.lst.dec, F.lst.key, cell.lat, cell.lon) : null,
      // the cloud top phase (161st)
      phase: F.phase
        ? l2PhaseBody(F.phase.dec, F.phase.key, cell.lat, cell.lon)
        : null,
      // the fire's heat (162nd)
      fire: F.fire
        ? l2FireBody(F.fire.dec, F.fire.key, cell.lat, cell.lon)
        : null,
      // the column's water (163rd)
      tpw: F.tpw ? l2TpwBody(F.tpw.dec, F.tpw.key, cell.lat, cell.lon) : null,
      rain: F.rain
        ? l2RainBody(F.rain.dec, F.rain.key, cell.lat, cell.lon)
        : null,
      // the haze's kind (169th): the smoke and dust flags by day
      adp: F.adp ? l2AdpBody(F.adp.dec, F.adp.key, cell.lat, cell.lon) : null,
      // the column from orbit (171st): the profiles over the observer
      lvt: F.lvt ? l2LvtBody(F.lvt.dec, F.lvt.key, cell.lat, cell.lon) : null,
      lvm: F.lvm ? l2LvmBody(F.lvm.dec, F.lvm.key, cell.lat, cell.lon) : null,
      upstream: got.every((f) => f) ? 'ok' : 'partial',
      // the deployed revision (158th): the page can tell an older
      // daemon's body from a fresh one's
      rev: VERSION.rev
    };
    goesl2Cache.set(ck, {t: Date.now(), body});
    return body;
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

  // Per-endpoint counters for /health (the 86th pass's lesson,
  // finished: the AIS incident was diagnosed remotely because the
  // socket engine had counters - the fetch endpoints get the
  // same). Outcomes read off the response itself: status < 400
  // with a '(cached)'/'(stale)' source header counts as served-
  // from-cache; a 4xx/5xx is a fail with its time kept.
  const epStats = new Map();
  const epMark = (path, code, extra = {}) => {
    if (path === '/health' || path === '/probe') return;
    let s = epStats.get(path);
    if (!s)
      epStats.set(
        path,
        (s = {
          hits: 0,
          ok: 0,
          cached: 0,
          fail: 0,
          lastOkAt: null,
          lastFailAt: null
        })
      );
    s.hits++;
    const src =
      Object.entries(extra).find(
        ([k]) => k.startsWith('x-') && k.endsWith('-source')
      )?.[1] || '';
    if (code < 400) {
      if (src.includes('cached') || src.includes('stale')) s.cached++;
      else {
        s.ok++;
        s.lastOkAt = new Date().toISOString();
      }
    } else {
      s.fail++;
      s.lastFailAt = new Date().toISOString();
    }
  };

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
    let curPath = null;
    const send = (code, body, extra) => {
      if (curPath) epMark(curPath, code, extra);
      res.writeHead(code, head(extra));
      res.end(body);
    };
    if (!oc.ok) return send(403, 'origin not allowed');
    if (req.method === 'OPTIONS') return send(204, null);
    if (req.method !== 'GET') return send(405, 'method not allowed');
    if (!limiter.take(ip)) return send(429, 'rate limited');
    const url = new URL(req.url, 'http://localhost');
    curPath = url.pathname;
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
        attempts: st.attempts || 0,
        cycles: st.cycles || 0,
        lastClose: st.lastClose || null,
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
      const ozoneHealth = {
        cells: ozoneCache.size,
        cycle: ozoneState.cycle,
        fetches: ozoneState.fetches,
        errors: ozoneState.errors
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
      const surfaceHealth = {
        cells: surfaceCache.size,
        date: surfaceState.calDate,
        composite: surfaceState.date,
        fetches: surfaceState.fetches,
        rejected: surfaceState.rejected,
        errors: surfaceState.errors
      };
      const rrsHealth = {
        cells: rrsCache.size,
        time: rrsState.time,
        fetches: rrsState.fetches,
        errors: rrsState.errors
      };
      const sstHealth = {
        cells: sstCache.size,
        time: sstState.time,
        fetches: sstState.fetches,
        errors: sstState.errors
      };
      const goesl2Health = {
        windows: [...l2Decoded].map(([k, v]) => ({
          product: k.split('/').slice(0, 2).join('/'),
          file: v.key.split('/').pop(),
          cell: v.cell,
          time: v.dec.time,
          scene: v.dec.scene,
          box: v.dec.box
            ? `${v.dec.box.rows}x${v.dec.box.cols}`
            : v.dec.vectors
              ? `${v.dec.vectors.length} of ${v.dec.total} vectors`
              : null,
          readKb: Math.round(v.bytes / 1024),
          fileMb: v.total ? +(v.total / 1e6).toFixed(1) : null,
          ranges: v.ranges,
          askedS: Math.round((Date.now() - v.t) / 1000)
        })),
        listings: l2Listings.size,
        bodies: goesl2Cache.size,
        holds: [...l2Fail.keys()],
        lists: l2State.lists,
        fetches: l2State.fetches,
        ranges: l2State.ranges,
        rangeMb: +(l2State.rangeBytes / 1e6).toFixed(1),
        errors: l2State.errors,
        rssMb: Math.round(process.memoryUsage().rss / 1048576),
        heapMb: Math.round(process.memoryUsage().heapUsed / 1048576),
        lastError: l2State.lastError
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
            ozone: ozoneHealth,
            chlor: chlorHealth,
            ndvi: ndviHealth,
            // Every fetch endpoint's own counters (the 86th
            // pass's lesson finished): ok = served fresh from
            // upstream, cached = cache/stale-serve, fail = 4xx/5xx
            // with its time - the next incident diagnoses itself.
            endpoints: Object.fromEntries(epStats),
            // the deployed revision and the products this build
            // serves (158th pass)
            version: versionInfo()
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
          ozone: ozoneHealth,
          chlor: chlorHealth,
          ndvi: ndviHealth,
          surface: surfaceHealth,
          rrs: rrsHealth,
          sst: sstHealth,
          goesl2: goesl2Health,
          version: versionInfo(),
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

    if (url.pathname === '/gmn') {
      // Yesterday's measured meteors, reduced: the Global Meteor
      // Network's daily trajectory summary (~6 MB, CC BY 4.0,
      // regenerated each morning) parsed by the gated gmn.js at
      // Vida 2021's own validity fences and served as per-shower
      // MEDIANS (begin/end heights, duration, speed) - a
      // few-hundred-byte payload the theme's streak kinematics
      // draw from. Counts are deliberately not turned into
      // rates (flux needs the network's own collecting-area
      // weighting); 6-hour cache, one upstream fetch a day in
      // practice.
      if (gmnCache.body && Date.now() - gmnCache.t < 6 * 3600e3) {
        return json(200, gmnCache.body, {
          'cache-control': 'public, max-age=3600',
          'x-gmn-source': 'globalmeteornetwork.org CC BY 4.0 (cached)'
        });
      }
      try {
        const r = await fetch(
          'https://globalmeteornetwork.org/data/traj_summary_data/daily/traj_summary_yesterday.txt',
          {signal: AbortSignal.timeout(60000), headers: {'user-agent': UA}}
        );
        if (!r.ok) throw new Error(r.status);
        const rows = parseTrajSummary(await r.text());
        if (rows.length < 50) throw new Error('short file');
        const body = {
          at: Date.now(),
          meteors: rows.length,
          medians: gmnMedians(rows)
        };
        gmnCache = {t: Date.now(), body};
        return json(200, body, {
          'cache-control': 'public, max-age=3600',
          'x-gmn-source': 'globalmeteornetwork.org CC BY 4.0'
        });
      } catch {
        if (gmnCache.body) {
          return json(200, gmnCache.body, {
            'cache-control': 'public, max-age=600',
            'x-gmn-source': 'globalmeteornetwork.org CC BY 4.0 (stale)'
          });
        }
        return json(502, {medians: null, upstream: 'unavailable'});
      }
    }

    if (url.pathname === '/volcano') {
      // The Smithsonian/USGS Weekly Volcanic Activity Report:
      // every currently reported eruption with the observatory's
      // OWN printed plume height (gvp.js parses the two printed
      // grammars behind a plume-context guard), joined to the
      // GVP Holocene list's summit elevations for the a.s.l.
      // conversion - one institution, both numbers. The report
      // is weekly; 6-hour cache, elevations daily, stale-serve.
      if (gvpCache.body && Date.now() - gvpCache.t < 6 * 3600e3) {
        return json(200, gvpCache.body, {
          'cache-control': 'public, max-age=3600',
          'x-gvp-source': 'volcano.si.edu weekly report (cached)'
        });
      }
      try {
        if (Date.now() - gvpElev.t > 24 * 3600e3) {
          const r = await fetch(GVP_WFS, {
            signal: AbortSignal.timeout(60000),
            headers: {'user-agent': UA}
          });
          if (!r.ok) throw new Error(r.status);
          const gj = await r.json();
          const map = new Map();
          for (const f of gj.features || []) {
            const p = f.properties || {};
            if (p.Volcano_Name)
              map.set(p.Volcano_Name, {
                lat: p.Latitude,
                lon: p.Longitude,
                elevM: p.Elevation
              });
          }
          if (map.size < 500) throw new Error('short volcano list');
          gvpElev = {t: Date.now(), map};
        }
        const r = await fetch(GVP_RSS, {
          signal: AbortSignal.timeout(60000),
          headers: {'user-agent': UA}
        });
        if (!r.ok) throw new Error(r.status);
        const rows = parseGvpRss(await r.text());
        const volcanoes = [];
        for (const v of rows) {
          const ref = gvpElev.map.get(v.name);
          const elevM = ref ? ref.elevM : null;
          const topM = plumeTopM(v, elevM);
          if (topM === null) continue; // no printed height, no plume
          volcanoes.push({
            name: v.name,
            lat: v.lat,
            lon: v.lon,
            elevM,
            topM
          });
        }
        if (!rows.length) throw new Error('empty report');
        const body = {at: Date.now(), reported: rows.length, volcanoes};
        gvpCache = {t: Date.now(), body};
        return json(200, body, {
          'cache-control': 'public, max-age=3600',
          'x-gvp-source': 'volcano.si.edu weekly report + Holocene WFS'
        });
      } catch {
        if (gvpCache.body) {
          return json(200, gvpCache.body, {
            'cache-control': 'public, max-age=600',
            'x-gvp-source': 'volcano.si.edu weekly report (stale)'
          });
        }
        return json(502, {volcanoes: null, upstream: 'unavailable'});
      }
    }

    if (url.pathname === '/comets') {
      // MEASURED comet brightness (cobs.js): the COBS network's
      // recent magnitude estimates reduced to per-comet medians
      // - the g/k formula's stand-in wherever an estimate is
      // fresh. 3-hour cache, stale-serve.
      if (cobsCache.body && Date.now() - cobsCache.t < 3 * 3600e3) {
        return json(200, cobsCache.body, {
          'cache-control': 'public, max-age=3600',
          'x-cobs-source': 'cobs.si (cached)'
        });
      }
      try {
        const from = new Date(Date.now() - COBS_WINDOW_DAYS * 86400e3)
          .toISOString()
          .slice(0, 10);
        const r = await fetch(COBS_API + '&from_date=' + from, {
          signal: AbortSignal.timeout(60000),
          headers: {'user-agent': UA}
        });
        if (!r.ok) throw new Error(r.status);
        const j = await r.json();
        const flat = (j.objects || []).map((o) => ({
          obs_date: o.obs_date,
          fullname: o.comet?.fullname,
          magnitude: o.magnitude
        }));
        const medians = cobsMedians(flat, Date.now());
        if (!Object.keys(medians).length && flat.length < 5)
          throw new Error('empty feed');
        const body = {at: Date.now(), observations: flat.length, medians};
        cobsCache = {t: Date.now(), body};
        return json(200, body, {
          'cache-control': 'public, max-age=3600',
          'x-cobs-source': 'cobs.si'
        });
      } catch {
        if (cobsCache.body) {
          return json(200, cobsCache.body, {
            'cache-control': 'public, max-age=600',
            'x-cobs-source': 'cobs.si (stale)'
          });
        }
        return json(502, {medians: null, upstream: 'unavailable'});
      }
    }

    if (url.pathname === '/sounding') {
      // MEASURED upper air (sounding.js): the nearest active
      // radiosonde station's latest 00/12Z ascent from the
      // Wyoming server, reduced to the numbers the theme's
      // consumers read - measured freezing level, 250 hPa
      // temperature/humidity/wind. Stations via NOAA's IGRA
      // list (daily); ascents cached an hour per 1-degree area;
      // stale-serve. Freshness/radius decisions stay with the
      // CLIENT (it knows its scene clock).
      const lat = parseFloat(url.searchParams.get('lat'));
      const lon = parseFloat(url.searchParams.get('lon'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon))
        return json(400, {error: 'lat/lon required'});
      const key = Math.round(lat) + ',' + Math.round(lon);
      const hit = sndCache.get(key);
      if (hit && Date.now() - hit.t < 3600e3) {
        return json(200, hit.body, {
          'cache-control': 'public, max-age=900',
          'x-sounding-source': 'weather.uwyo.edu + IGRA (cached)'
        });
      }
      // One shared deadline for the whole upstream walk (see
      // UPSTREAM_BUDGET_MS): slow Wyoming answers degrade to the
      // stale cache, never to an edge timeout.
      const deadline = Date.now() + UPSTREAM_BUDGET_MS;
      try {
        if (Date.now() - sndStations.t > 24 * 3600e3) {
          const r = await fetch(IGRA_STATIONS, {
            signal: AbortSignal.timeout(
              fetchBudgetMs(deadline, Date.now(), 15000)
            ),
            headers: {'user-agent': UA}
          });
          if (!r.ok) throw new Error(r.status);
          const list = parseIgraStations(await r.text());
          if (list.length > 300) sndStations = {t: Date.now(), list};
        }
        let best = null;
        for (const s of sndStations.list) {
          const d = haversineKm(lat, lon, s.lat, s.lon);
          if (!best || d < best.d) best = {s, d};
        }
        if (!best) throw new Error('no stations');
        // Latest synoptic slots, newest first (ascents launch
        // ~1 h before the nominal hour and land ~1 h after).
        const slots = [];
        const now = new Date();
        for (let back = 0; back < 4; back++) {
          const t = new Date(now.getTime() - back * 12 * 3600e3);
          const h = t.getUTCHours() >= 13 ? 12 : t.getUTCHours() >= 1 ? 0 : -12;
          const d = new Date(t);
          let hh = h;
          if (h === -12) {
            d.setUTCDate(d.getUTCDate() - 1);
            hh = 12;
          }
          const iso =
            d.toISOString().slice(0, 10) +
            ' ' +
            String(hh).padStart(2, '0') +
            ':00:00';
          if (!slots.includes(iso)) slots.push(iso);
        }
        let body = null;
        const fetchAscent = async (slot) => {
          const left = fetchBudgetMs(deadline, Date.now(), 20000);
          if (left < 2000) return null;
          const r = await fetch(
            WYO_BASE +
              '?datetime=' +
              encodeURIComponent(slot) +
              '&id=' +
              best.s.wmo +
              '&type=TEXT:LIST',
            {signal: AbortSignal.timeout(left), headers: {'user-agent': UA}}
          );
          if (!r.ok) return null;
          const pre = (await r.text()).match(/<PRE>([\s\S]*?)<\/PRE>/i);
          if (!pre) return null;
          const rows = parseWyoText(pre[1]);
          return rows.length < 50 ? null : rows;
        };
        for (let si = 0; si < slots.length; si++) {
          if (budgetLeftMs(deadline, Date.now()) < 2000) break;
          const slot = slots[si];
          const rows = await fetchAscent(slot);
          if (!rows) continue;
          // The RESIDUAL layer (Stull's printed structure): the
          // PREVIOUS ascent's mixed-layer depth still carries its
          // pollutants tonight - reduce the next slot back too
          // (an optional extra: it yields to the budget first).
          let prevBlhAglM = null;
          let prevAt = null;
          if (
            si + 1 < slots.length &&
            budgetLeftMs(deadline, Date.now()) > 5000
          ) {
            const prevRows = await fetchAscent(slots[si + 1]);
            if (prevRows) {
              prevBlhAglM = blhRiM(prevRows);
              prevAt = slots[si + 1].replace(' ', 'T') + 'Z';
            }
          }
          body = {
            wmo: best.s.wmo,
            name: best.s.name,
            lat: best.s.lat,
            lon: best.s.lon,
            distKm: Math.round(best.d),
            at: slot.replace(' ', 'T') + 'Z',
            n: rows.length,
            topHpa: rows[rows.length - 1].p,
            freezingM: freezingLevelM(rows),
            t250C: levelAt(rows, 250, 'tC'),
            rh250: levelAt(rows, 250, 'rh'),
            drct250: levelAt(rows, 250, 'drct'),
            spd250Ms: levelAt(rows, 250, 'spdMs'),
            // The measured 700 hPa level (mid-deck drift, plume
            // bend) and the bulk-Richardson boundary layer depth
            // (sounding.js, both gated).
            t700C: levelAt(rows, 700, 'tC'),
            drct700: levelAt(rows, 700, 'drct'),
            spd700Ms: levelAt(rows, 700, 'spdMs'),
            blhAglM: blhRiM(rows),
            prevBlhAglM,
            prevAt,
            // The thinned profile itself (~4 KB): the client's
            // refraction column rides the balloon (sounding.js
            // thinRows keeps the mirage-making low rows verbatim).
            rows: thinRows(rows),
            // The parcel ascent (sounding.js, gated): measured
            // cloud base / storm top / instability energy.
            ...parcelAscent(rows)
          };
          break;
        }
        if (!body) throw new Error('no recent ascent');
        sndCache.set(key, {t: Date.now(), body});
        if (sndCache.size > 500) sndCache.delete(sndCache.keys().next().value);
        return json(200, body, {
          'cache-control': 'public, max-age=900',
          'x-sounding-source': 'weather.uwyo.edu + IGRA'
        });
      } catch {
        if (hit) {
          return json(200, hit.body, {
            'cache-control': 'public, max-age=600',
            'x-sounding-source': 'weather.uwyo.edu + IGRA (stale)'
          });
        }
        return json(502, {sounding: null, upstream: 'unavailable'});
      }
    }

    if (url.pathname === '/buoy') {
      // MEASURED sea state (buoy.js): the nearest NDBC station's
      // newest directional wave spectrum - C11(f) plus the
      // Longuet-Higgins alpha1/alpha2/r1/r2 per band - joined
      // with the standard met row. Station list daily; spectra
      // cached 30 min per 1-degree area; stale-serve. The
      // freshness/radius gates stay with the CLIENT.
      const lat = parseFloat(url.searchParams.get('lat'));
      const lon = parseFloat(url.searchParams.get('lon'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon))
        return json(400, {error: 'lat/lon required'});
      const key = Math.round(lat) + ',' + Math.round(lon);
      const hit = buoyCache.get(key);
      if (hit && Date.now() - hit.t < 1800e3) {
        return json(200, hit.body, {
          'cache-control': 'public, max-age=600',
          'x-buoy-source': 'ndbc.noaa.gov (cached)'
        });
      }
      // One shared deadline for the whole candidate walk (see
      // UPSTREAM_BUDGET_MS): a silent NDBC degrades to the stale
      // cache, never to an edge timeout.
      const deadline = Date.now() + UPSTREAM_BUDGET_MS;
      try {
        if (Date.now() - buoyStations.t > 24 * 3600e3) {
          const r = await fetch(NDBC_STATIONS, {
            signal: AbortSignal.timeout(
              fetchBudgetMs(deadline, Date.now(), 15000)
            ),
            headers: {'user-agent': UA}
          });
          if (!r.ok) throw new Error(r.status);
          const list = parseStations(await r.text());
          if (list.length > 100) buoyStations = {t: Date.now(), list};
        }
        // Nearest stations first; a buoy can be adrift or silent,
        // so walk up to the four nearest within 400 km and take
        // the first with a live spectral file.
        const near = buoyStations.list
          .map((s) => ({s, d: haversineKm(lat, lon, s.lat, s.lon)}))
          .filter((x) => x.d < 400)
          .sort((a, b) => a.d - b.d)
          .slice(0, 4);
        let body = null;
        for (const cand of near) {
          if (budgetLeftMs(deadline, Date.now()) < 2000) break;
          const get = async (prod) => {
            const left = fetchBudgetMs(deadline, Date.now(), 12000);
            if (left < 1500) return null;
            const r = await fetch(NDBC_BASE + cand.s.id + '.' + prod, {
              signal: AbortSignal.timeout(left),
              headers: {'user-agent': UA}
            });
            return r.ok ? r.text() : null;
          };
          const specTxt = await get('data_spec');
          if (!specTxt) continue;
          const spec = firstSpecRow(specTxt, true);
          if (!spec || spec.f.length < 10) continue;
          // Directional products are optional (many met buoys
          // report density only): a band's direction joins ONLY
          // when its file's newest row shares the spectrum's
          // timestamp and band grid - otherwise null (isotropic
          // at draw time, the Longuet-Higgins series' own limit).
          // Optional files yield to the budget first - a found
          // spectrum ships even if its directions ran out of time.
          const dir = {};
          for (const prod of ['swdir', 'swdir2', 'swr1', 'swr2']) {
            const t = await get(prod);
            const row = t ? firstSpecRow(t, false) : null;
            dir[prod] =
              row && row.at === spec.at && row.f.length === spec.f.length
                ? row.v
                : null;
          }
          const txt = await get('txt');
          const wv = txt ? firstTxtValue(txt, 'wvht') : null;
          const dpd = txt ? firstTxtValue(txt, 'dpd') : null;
          const mwd = txt ? firstTxtValue(txt, 'mwd') : null;
          const wt = txt ? firstTxtValue(txt, 'wtmp') : null;
          // the buoy's own wind (138th pass): the sea's nearest
          // over-water anemometer when no pier is in reach
          const ws = txt ? firstTxtValue(txt, 'wspd') : null;
          const wd = txt ? firstTxtValue(txt, 'wdir') : null;
          body = {
            id: cand.s.id,
            name: cand.s.name,
            lat: cand.s.lat,
            lon: cand.s.lon,
            distKm: Math.round(cand.d),
            at: new Date(spec.at).toISOString().replace('.000', ''),
            sep: spec.sep,
            f: spec.f,
            s: spec.v,
            a1: dir.swdir,
            a2: dir.swdir2,
            r1: dir.swr1,
            r2: dir.swr2,
            wvht: wv ? wv.val : null,
            dpd: dpd ? dpd.val : null,
            mwd: mwd ? mwd.val : null,
            wtmp: wt ? wt.val : null,
            wspd: ws ? ws.val : null,
            wdir: wd ? wd.val : null
          };
          break;
        }
        if (!body) throw new Error('no reporting buoy in range');
        buoyCache.set(key, {t: Date.now(), body});
        if (buoyCache.size > 500)
          buoyCache.delete(buoyCache.keys().next().value);
        return json(200, body, {
          'cache-control': 'public, max-age=600',
          'x-buoy-source': 'ndbc.noaa.gov'
        });
      } catch (e) {
        if (hit) {
          return json(200, hit.body, {
            'cache-control': 'public, max-age=300',
            'x-buoy-source': 'ndbc.noaa.gov (stale)'
          });
        }
        return json(502, {buoy: null, upstream: 'unavailable'});
      }
    }

    if (url.pathname === '/aeronet') {
      // The nearest AERONET station's latest direct-sun AOD
      // (Giles et al. 2019 V3, Level 1.5 near-real-time; the
      // web service sends no CORS header so the daemon proxies,
      // the METAR pattern). Station list cached a day; per-site
      // observations 15 min (the printed triplet cadence is
      // 3 min - one upstream request serves many viewers).
      // Normalisation is the gated aeronet.js; the freshness
      // and radius decisions stay with the CLIENT (it knows its
      // scene clock) - the daemon serves the newest same-day
      // rows verbatim-parsed.
      try {
        if (Date.now() - aeronetSites.t > 24 * 3600e3) {
          const r = await fetch(
            'https://aeronet.gsfc.nasa.gov/aeronet_locations_v3.txt',
            {signal: AbortSignal.timeout(FETCH_MS), headers: {'user-agent': UA}}
          );
          if (r.ok) {
            const sites = parseAeronetSites(await r.text());
            if (sites.length > 100) aeronetSites = {t: Date.now(), sites};
          }
        }
        const site = nearestAeronetSite(aeronetSites.sites, lat, lon);
        if (!site) return json(200, {obs: null, site: null});
        const hit = aeronetCache.get(site.name);
        if (hit && Date.now() - hit.t < 15 * 60e3) {
          return json(
            200,
            {...hit.body, site},
            {
              'cache-control': 'public, max-age=300',
              'x-aeronet-source': 'aeronet.gsfc.nasa.gov (cached)'
            }
          );
        }
        const now = new Date();
        const y = new Date(now.getTime() - 86400e3);
        const u =
          'https://aeronet.gsfc.nasa.gov/cgi-bin/print_web_data_v3?site=' +
          encodeURIComponent(site.name) +
          '&year=' +
          y.getUTCFullYear() +
          '&month=' +
          (y.getUTCMonth() + 1) +
          '&day=' +
          y.getUTCDate() +
          '&year2=' +
          now.getUTCFullYear() +
          '&month2=' +
          (now.getUTCMonth() + 1) +
          '&day2=' +
          now.getUTCDate() +
          '&AOD15=1&AVG=10&if_no_html=1';
        const r = await fetch(u, {
          signal: AbortSignal.timeout(FETCH_MS),
          headers: {'user-agent': UA}
        });
        if (!r.ok) throw new Error(r.status);
        const rows = parseAeronetV3(await r.text());
        // Newest few rows only - the client applies its own
        // freshness window against its scene clock.
        const tail = rows.slice(-4);
        const obs = tail.length ? tail[tail.length - 1] : null;
        const body = {obs, recent: tail};
        aeronetCache.set(site.name, {t: Date.now(), body});
        return json(
          200,
          {...body, site},
          {
            'cache-control': 'public, max-age=300',
            'x-aeronet-source': 'aeronet.gsfc.nasa.gov'
          }
        );
      } catch {
        return json(502, {obs: null, site: null, upstream: 'unavailable'});
      }
    }

    if (url.pathname === '/ozone') {
      // Measured total-column ozone (DU) for the 0.25-deg cell over
      // the point - the GFS TOZNE field. The theme scales its ozone
      // absorption by DU/300 (the column Bruneton's constants
      // encode by construction).
      const body = await fetchOzone(lat, lon);
      if (!body) return json(502, {du: null, upstream: 'unavailable'});
      return json(200, body, {
        'cache-control': 'public, max-age=1800',
        'x-ozone-source': 'NOMADS GFS TOZNE'
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

    if (url.pathname === '/surface') {
      // Measured land colour: the three MOD09A1 visible-band reflect-
      // ances (blue/green/red) in the 0.01-deg cell over the point.
      // A null triple with a 200 is a real answer (water/off-land/fill);
      // 502 means the upstream itself failed.
      const body = await fetchSurface(lat, lon);
      if (!body) return json(502, {blue: null, upstream: 'unavailable'});
      return json(200, body, {
        'cache-control': 'public, max-age=3600',
        'x-surface-source': 'NASA MODIS MOD09A1 surface reflectance (ORNL DAAC)'
      });
    }

    if (url.pathname === '/rrs') {
      // Measured sea colour: the six ESA CCI Rrs bands over the point.
      // A null rrs with a 200 is a real answer (cloud gap / off-water);
      // 502 means the upstream itself failed.
      const body = await fetchRrs(lat, lon);
      if (!body) return json(502, {rrs: null, upstream: 'unavailable'});
      return json(200, body, {
        'cache-control': 'public, max-age=3600',
        'x-rrs-source': 'ESA Ocean Colour CCI v6.0 (CoastWatch ERDDAP)'
      });
    }

    if (url.pathname === '/sst') {
      // The foundation-SST box over the point's cell (MUR, daily).
      // An all-null grid with a 200 is a real answer (inland); 502
      // means the upstream itself failed.
      const body = await fetchSst(lat, lon);
      if (!body) return json(502, {sst: null, upstream: 'unavailable'});
      return json(200, body, {
        'cache-control': 'public, max-age=3600',
        'x-sst-source': 'JPL MUR SST v4.1 (CoastWatch ERDDAP)'
      });
    }

    if (url.pathname === '/glm') {
      // THE FLASHES FROM ORBIT (168th): GLM's flashes of the last
      // minute within km of the point. 200 with sat null is a real
      // answer (no craft reaches this longitude); 502 when no file
      // could be read at all.
      const km = Math.min(Number(url.searchParams.get('km')) || 200, 400);
      if (!(km > 0)) return send(400, 'bad request');
      const body = await fetchGlm(lat, lon, km);
      if (!body) return json(502, {sat: null, upstream: 'unavailable'});
      return json(200, body, {
        'cache-control': 'public, max-age=10',
        'x-glm-source':
          'NOAA GOES-R GLM L2 LCFA (NOAA Open Data Dissemination, S3)'
      });
    }

    if (url.pathname === '/goesl2') {
      // NOAA's clear-sky mask and cloud-top height windows around
      // the point (148th pass). 200 with sat null is a real answer
      // (no bucket reaches this longitude); 502 when both products
      // failed upstream (or nothing is listed within 15 min of a
      // ?t=); 'partial' names a body with one of them. ?t=ISO asks
      // for the files nearest that moment (at most a week back).
      const tq = url.searchParams.get('t');
      let at = null;
      if (tq !== null) {
        const ms = Date.parse(tq);
        if (
          !Number.isFinite(ms) ||
          Math.abs(Date.now() - ms) > L2_AT_MAX_AGE_MS
        )
          return send(400, 'bad request');
        at = new Date(ms).toISOString();
      }
      const body = await fetchGoesL2(lat, lon, at);
      if (!body) return json(502, {sat: null, upstream: 'unavailable'});
      return json(200, body, {
        'cache-control': 'public, max-age=300',
        'x-goesl2-source':
          'NOAA GOES-R ABI L2 ACMC + ACHAC (NOAA Open Data Dissemination, S3)'
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
  server.listen(PORT, HOST, () => {
    log(`horizon-live on ${HOST}:${PORT} (origins: ${ALLOW.join(', ')})`);
    // the warm-up (see warmUpPaths): one request per slow route for
    // the home area, sequential, each failure logged and ignored
    const home = parseHome(env.HORIZON_HOME ?? HOME_DEFAULT);
    // the home first, then the areas the restored snapshot served
    // most recently (their caches came back with it; the warm-up
    // refreshes what went stale)
    const areas = recentAreas(stateSnap, home);
    const paths = warmUpPlan(home, areas);
    if (areas.length)
      log(
        `warm: ${areas.length} recent area(s) beside the home: ` +
          areas.map((a) => a.lat + ',' + a.lon).join(' ')
      );
    const self = `http://${HOST === '0.0.0.0' || HOST === '::' ? '127.0.0.1' : HOST}:${PORT}`;
    // A cold /sounding can spend its budget on the station list
    // plus one slow Wyoming answer and fail once (measured in the
    // smoke run: 502 in 20.5 s, then 200 in 16 s with the list
    // cached), so each route gets WARM_UP_TRIES attempts, a pause
    // between, stopping at the first 200.
    setTimeout(async () => {
      for (const p of paths) {
        for (let attempt = 1; attempt <= WARM_UP_TRIES; attempt++) {
          const t0 = Date.now();
          let status = 0;
          try {
            const r = await fetch(self + p, {
              signal: AbortSignal.timeout(UPSTREAM_BUDGET_MS + 5000)
            });
            status = r.status;
            log(
              `warm ${p}: ${r.status} in ${Date.now() - t0} ms (try ${attempt})`
            );
          } catch (e) {
            log(
              `warm ${p}: failed (${e.message}) in ${Date.now() - t0} ms (try ${attempt})`
            );
          }
          if (status === 200 || attempt === WARM_UP_TRIES) break;
          await new Promise((r) => setTimeout(r, WARM_UP_PAUSE_MS));
        }
      }
    }, 500).unref();
  });
}

// Run only as a program - importing this module (the reference
// gate does) must stay side-effect free.
if (import.meta.url === 'file://' + process.argv[1]) main();
