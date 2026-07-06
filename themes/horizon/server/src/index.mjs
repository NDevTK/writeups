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

const AIS_WS = 'wss://stream.aisstream.io/v0/stream';
const UA = 'horizon-live/1.0 (+https://github.com/NDevTK/writeups)';
const FETCH_MS = 4000;

// ---- AIS engine: persistent global picture ---------------------

export function createAisState() {
  return {
    ships: new Map(), // mmsi -> normalized ship + {gk, t}
    grid: new Map(), // "lat:lon" 1-degree cell -> Set<mmsi>
    frames: 0,
    lastFrame: 0,
    connects: 0,
    started: Date.now()
  };
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
    ws.addEventListener('message', (ev) => {
      try {
        ingest(st, JSON.parse(String(ev.data)));
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
    if (st.connects > 0 && Date.now() - st.lastFrame > 180e3) {
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

  const adsbCache = new Map(); // url -> {t, body}
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of adsbCache) if (now - v.t > 30e3) adsbCache.delete(k);
  }, 30e3).unref();

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
        lastFrameAgoMs: st.lastFrame ? Date.now() - st.lastFrame : null,
        connects: st.connects,
        uptimeMs: Date.now() - st.started
      };
      if (url.pathname === '/health')
        return json(200, {ais}, {'cache-control': 'no-store'});
      return json(
        200,
        {ais, probe: await probeAll()},
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

    if (url.pathname === '/adsb') {
      const dist = Math.min(Number(url.searchParams.get('dist')) || 15, 60);
      if (!(dist > 0)) return send(400, 'bad request');
      const la = lat.toFixed(3);
      const lo = lon.toFixed(3);
      const d = Math.round(dist);
      const ck = la + '/' + lo + '/' + d;
      const hit = adsbCache.get(ck);
      if (hit && Date.now() - hit.t < 15e3)
        return json(200, hit.body, {
          'cache-control': 'public, max-age=15',
          'x-adsb-source': hit.src + ' (cached)'
        });
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
          return json(200, body, {
            'cache-control': 'public, max-age=15',
            'x-adsb-source': src
          });
        } catch {
          // timeout or malformed - next upstream
        }
      }
      return json(502, {ac: [], upstream: 'unavailable'});
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
