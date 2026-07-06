#!/usr/bin/env node
/**
 * horizon-live - the Horizon theme's live-data daemon, for a
 * small always-on server with its OWN IP address (a GCP free-tier
 * e2-micro fits: the global AIS picture is tens of MB and
 * aisstream's stated ~300 msg/s is trivial for node).
 *
 * Why a daemon instead of the Cloudflare Worker
 * (themes/horizon/worker): every failure measured on the worker
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
 *  - GET/OPTIONS only, exact paths, numeric params validated and
 *    clamped - same allowlist discipline as the worker
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
 * The pure pieces (grid ingest/query/prune, origin check, rate
 * limiter) are exported for the reference gate
 * (../../server-reference.mjs); the schema normalizers are
 * imported from the worker source - the model lives once.
 */

import http from 'node:http';
import {aisBox, normalize, normalizeShip} from '../../worker/src/index.js';
import {haversineKm} from '../../lightning.js';

const AIS_WS = 'wss://stream.aisstream.io/v0/stream';
const UA = 'horizon-live/1.0 (+https://github.com/NDevTK/writeups)';
const FETCH_MS = 4000;

// ---- AIS engine: persistent global picture ---------------------

export function createAisState() {
  return {
    ships: new Map(), // mmsi -> normalized ship + {gk, t}
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
  return n;
}

// Answer a visitor query from RAM: the same centre+radius ->
// bounding box geodesy as the worker (aisBox - the model lives
// once), walked over the grid cells the box overlaps. Strips the
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
        out.push({
          mmsi: s.mmsi,
          name: s.name,
          lat: s.lat,
          lon: s.lon,
          sog: s.sog,
          cog: s.cog,
          hdg: s.hdg
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

// ---- Aircraft: readsb failover from a clean IP -----------------
// All three speak readsb v2 ({ac:[...]}, feet/knots) and feed the
// worker-gated normalize(). Order preferred by data richness;
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
          FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport']
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
            const payload = {lat: s.lat, lon: s.lon, km: Math.round(d)};
            // named event on the multiplexed /stream, bare data
            // on the legacy /lightning/stream
            cl.res.write(
              cl.named
                ? sseEvent('strike', payload)
                : 'data: ' + JSON.stringify(payload) + '\n\n'
            );
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

  const adsbCache = new Map(); // area key -> {t, body, src}
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of adsbCache) if (now - v.t > 30e3) adsbCache.delete(k);
  }, 30e3).unref();
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

    if (url.pathname === '/health' || url.pathname === '/probe') {
      const ais = {
        ships: st.ships.size,
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
      if (url.pathname === '/health')
        return json(200, {ais, lightning}, {'cache-control': 'no-store'});
      return json(
        200,
        {ais, lightning, probe: await probeAll()},
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

    if (url.pathname === '/lightning/stream') {
      // Server-sent events: strikes near the point, pushed the
      // moment Blitzortung locates them. EventSource always sends
      // Origin, and the global allowlist gate above already 403'd
      // anything foreign - this stream is origin-scoped by
      // construction. Capped globally and renewed by the client's
      // built-in reconnect (we end streams after 30 min).
      const km = Math.min(Number(url.searchParams.get('km')) || 150, 250);
      if (!(km > 0)) return send(400, 'bad request');
      if (sseClients.size >= SSE_MAX) return send(503, 'stream capacity');
      res.writeHead(
        200,
        head({
          'content-type': 'text/event-stream',
          'cache-control': 'no-store',
          'x-lightning-source': 'blitzortung.org'
        })
      );
      res.write(': horizon-live lightning stream\n\n');
      const client = {res, lat, lon, km};
      sseClients.add(client);
      const hb = setInterval(() => {
        try {
          res.write(': hb\n\n');
        } catch {
          // closing below
        }
      }, 25e3);
      const bye = setTimeout(() => res.end(), 30 * 60e3);
      req.on('close', () => {
        clearInterval(hb);
        clearTimeout(bye);
        sseClients.delete(client);
      });
      return;
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
      // The unified live channel: ONE origin-scoped EventSource
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
      const client = {res, lat, lon, km, named: true};
      sseClients.add(client);
      const pushAis = () => {
        if (env.AISSTREAM_KEY) {
          try {
            res.write(sseEvent('ais', {ships: query(st, lat, lon, aisDist)}));
          } catch {
            // closing below
          }
        }
      };
      const pushAdsb = async () => {
        const got = await fetchAdsb(lat, lon, adsbDist);
        if (!got) return;
        try {
          res.write(sseEvent('adsb', got.body));
        } catch {
          // closing below
        }
      };
      pushAis();
      pushAdsb();
      const iAis = setInterval(pushAis, 30e3);
      const iAdsb = setInterval(pushAdsb, 20e3);
      const hb = setInterval(() => {
        try {
          res.write(': hb\n\n');
        } catch {
          // closing below
        }
      }, 25e3);
      const bye = setTimeout(() => res.end(), 30 * 60e3);
      req.on('close', () => {
        clearInterval(iAis);
        clearInterval(iAdsb);
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
