/**
 * horizon-adsb - the Horizon theme's live-data edge proxy
 * (Cloudflare Worker). Two allowlisted routes:
 *   /adsb - live aircraft (they lay the Schmidt-Appleman
 *           contrails in the theme)
 *   /ais  - live ships (they sail the FFT ocean, carrying
 *           COLREGS navigation lights after sunset)
 * plus /probe, the fixed-target edge diagnostic.
 *
 * Why it exists: no public ADS-B feed is browser-reachable -
 * they either lock access-control-allow-origin to their own site
 * or send no CORS headers at all (probed 2026-07-06; see
 * WEBGPU-PLAN.md). And AIS goes further: aisstream.io requires a
 * per-account API key that its terms forbid exposing to browsers
 * - a static GitHub Pages site cannot hold a secret, but a
 * worker can (npx wrangler secret put AISSTREAM_KEY). The worker
 * forwards ONE fixed query shape per route and adds the CORS
 * header.
 *
 * ONE upstream: airplanes.live. Chosen by MEASUREMENT, not
 * preference - the /probe diagnostic below ran on the deployed
 * edge (2026-07-06) and said, with a 200/389 ms control proving
 * egress healthy:
 *   opensky-api    TimeoutError at 6 s  - network-drops CF ranges
 *   opensky-auth   TimeoutError at 6 s  - so credentials can
 *                                         never help
 *   adsb.lol       429 in 869 ms        - refuses CF egress
 *   adsb.fi        403 in 139 ms        - refuses CF egress
 *   airplanes.live 200 in 232 ms, 32 aircraft
 * airplanes.live is itself served through Cloudflare, so
 * worker-to-it traffic is first-class. It speaks readsb v2 JSON
 * ({ac: [...]}, altitudes in feet, speeds in knots) - the same
 * schema and units the theme's parser was built for. The worker
 * strips each state vector to the seven fields the theme reads,
 * which also shrinks the payload an order of magnitude.
 *
 * Respecting the feed (docs.airplanes.live: 1 request/second):
 * coordinates are rounded to ~110 m so nearby visitors share one
 * cached upstream request, successes are edge-cached 15 s, and
 * the retry (for blips) waits a full 1.1 s so the worker never
 * exceeds the documented rate even while retrying. Every fetch
 * carries a hard 4 s AbortSignal timeout and an honest
 * User-Agent.
 *
 * Ships: aisstream.io speaks WebSocket only (subscribe within
 * 3 s of connecting, position reports stream in). /ais opens an
 * outbound socket, subscribes to the visitor's bounding box,
 * collects PositionReports for a short fixed window, closes, and
 * answers plain JSON - the browser never sees a socket or the
 * key. Results are edge-cached 60 s per rounded coordinate
 * (ships move slowly; the free tier allows few concurrent
 * connections, so the cache IS the budget).
 *
 * It is deliberately not an open proxy:
 *  - only GET/OPTIONS on the exact paths /adsb, /ais and /probe
 *    (the latter a fixed-target edge diagnostic, no parameters)
 *  - only the three numeric parameters lat/lon/dist, validated
 *    and clamped (dist <= 60 nm for aircraft, <= 30 nm for ships)
 *
 * Deploy: cd themes/horizon/worker && npx wrangler deploy
 * The theme looks for https://horizon-adsb.<your>.workers.dev via
 * the ADSB_PROXY / AIS_PROXY constants in Horizon.html (override
 * with ?adsb= / ?ais=).
 */

const API = 'https://api.airplanes.live/v2/point/';
const FETCH_MS = 4000;

// Identify honestly upstream. Workers send NO User-Agent by
// default, and UA-less bot traffic gets WAF'd.
const UA = 'horizon-adsb/1.0 (+https://github.com/NDevTK/writeups)';

// airplanes.live point query: centre + radius in nm, exactly the
// shape the theme asks for - no bbox conversion needed. Exported
// for the reference gate.
export function pointUrl(lat, lon, d) {
  return API + lat + '/' + lon + '/' + Math.round(d);
}

// Strip readsb state vectors to the seven fields the theme reads
// (Horizon.html syncTraffic -> contrails.js adsbToScene), keeping
// readsb's native units (alt_baro in FEET, gs in KNOTS - the
// theme owns the exact ft/kt conversions). Drop grounded
// (alt_baro === "ground") and incomplete vectors - the theme
// requires every numeric field.
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

// ---- AIS ships (aisstream.io over WebSocket) -------------------
const AIS_WS = 'wss://stream.aisstream.io/v0/stream';
const AIS_WINDOW_MS = 2500;

// One AIS position report -> the six fields the theme reads.
// AIS sentinel values per ITU-R M.1371: Sog 102.3 kt = not
// available, Cog 360 = not available, TrueHeading 511 = not
// available. Exported for the reference gate.
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

// aisstream bounding box for centre + radius in nm (same geodesy
// as the aircraft path: 1 nm latitude = exactly 1/60 degree).
export function aisBox(lat, lon, d) {
  const dLat = d / 60;
  const dLon = d / (60 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return [
    [Math.max(lat - dLat, -90), Math.max(lon - dLon, -180)],
    [Math.min(lat + dLat, 90), Math.min(lon + dLon, 180)]
  ];
}

// Open an outbound WebSocket. Prefer the standard constructor
// (node 22+, current workerd); fall back to the classic Workers
// fetch-Upgrade API on older runtimes.
async function connectWS(url) {
  if (typeof WebSocket === 'function') {
    try {
      const ws = new WebSocket(url);
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('open timeout')), 5000);
        ws.addEventListener(
          'open',
          () => {
            clearTimeout(t);
            resolve();
          },
          {once: true}
        );
        ws.addEventListener(
          'error',
          () => {
            clearTimeout(t);
            reject(new Error('ws error'));
          },
          {once: true}
        );
      });
      return ws;
    } catch (e) {
      if (!/not supported|not implemented|constructor/i.test(String(e))) {
        throw e;
      }
    }
  }
  const res = await fetch(url.replace(/^wss:/, 'https:'), {
    headers: {upgrade: 'websocket', 'user-agent': UA}
  });
  const ws = res.webSocket;
  if (!ws) throw new Error('upgrade failed: ' + res.status);
  ws.accept();
  return ws;
}

// Subscribe to the box and collect PositionReports for a fixed
// window (aisstream closes the socket itself if no subscription
// arrives within 3 s - ours goes out on open). Latest report per
// MMSI wins.
async function collectShips(key, lat, lon, dist) {
  const ws = await connectWS(AIS_WS);
  const ships = new Map();
  let refused = null; // aisstream answers a bad subscription with
  // an {error: ...} frame and closes - an empty sea must not be
  // conflated with a refused key
  try {
    ws.send(
      JSON.stringify({
        APIKey: key,
        BoundingBoxes: [aisBox(lat, lon, dist)],
        FilterMessageTypes: ['PositionReport']
      })
    );
    await new Promise((resolve) => {
      const t = setTimeout(resolve, AIS_WINDOW_MS);
      const done = () => {
        clearTimeout(t);
        resolve();
      };
      ws.addEventListener('close', done, {once: true});
      ws.addEventListener('error', done, {once: true});
      ws.addEventListener('message', (ev) => {
        try {
          const m = JSON.parse(
            typeof ev.data === 'string'
              ? ev.data
              : new TextDecoder().decode(ev.data)
          );
          if (m && m.error) {
            refused = String(m.error);
            done();
            return;
          }
          const p = m && m.Message && m.Message.PositionReport;
          if (!p || m.MessageType !== 'PositionReport') return;
          if (typeof p.Latitude !== 'number' || typeof p.Longitude !== 'number')
            return;
          ships.set(p.UserID, normalizeShip(m.MetaData, p));
          if (ships.size >= 80) done();
        } catch {
          // ignore malformed frames
        }
      });
    });
  } finally {
    try {
      ws.close();
    } catch {
      // already closed
    }
  }
  if (refused && ships.size === 0) {
    throw new Error('aisstream refused: ' + refused);
  }
  return [...ships.values()];
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'cache-control': 'public, max-age=15'
};

// GET /probe - edge-side diagnosis, because "which ADS-B feed
// works from Cloudflare egress" can ONLY be measured from the
// edge. This is the instrument that picked airplanes.live (see
// header) and it stays: if the feed ever regresses, one GET
// re-runs the measurement. Fixed target list, zero parameters -
// not a proxy. Every entry reports status or error name +
// elapsed ms.
export const PROBE_TARGETS = [
  [
    'control',
    'https://api.open-meteo.com/v1/forecast?latitude=51.47&longitude=-0.45&current=temperature_2m'
  ],
  [
    'opensky-api',
    'https://opensky-network.org/api/states/all?lamin=51.220&lamax=51.720&lomin=-0.851&lomax=-0.049'
  ],
  [
    'opensky-auth',
    'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'
  ],
  ['adsb.lol', 'https://api.adsb.lol/v2/lat/51.47/lon/-0.45/dist/15'],
  ['adsb.fi', 'https://opendata.adsb.fi/api/v2/lat/51.47/lon/-0.45/dist/15'],
  ['airplanes.live', () => pointUrl('51.47', '-0.45', 15)]
];

async function probeAll() {
  return Promise.all(
    PROBE_TARGETS.map(async ([name, target]) => {
      const u = typeof target === 'function' ? target() : target;
      const t0 = Date.now();
      try {
        const init = {
          signal: AbortSignal.timeout(6000),
          headers: {'user-agent': UA}
        };
        if (name === 'opensky-auth') {
          // reachability only: bogus credentials -> a FAST 401
          // from Keycloak proves the route; a timeout proves the
          // block is at the network, where auth cannot help
          init.method = 'POST';
          init.headers['content-type'] = 'application/x-www-form-urlencoded';
          init.body =
            'grant_type=client_credentials&client_id=probe&client_secret=probe';
        }
        const res = await fetch(u, init);
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

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') {
      return new Response(null, {headers: CORS});
    }
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/ais') {
      const lat = Number(url.searchParams.get('lat'));
      const lon = Number(url.searchParams.get('lon'));
      const dist = Math.min(Number(url.searchParams.get('dist')) || 8, 30);
      if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && dist > 0)) {
        return new Response('bad request', {status: 400, headers: CORS});
      }
      if (!env || !env.AISSTREAM_KEY) {
        return new Response('{"ships":[],"error":"no AISSTREAM_KEY"}', {
          status: 503,
          headers: {...CORS, 'content-type': 'application/json'}
        });
      }
      // Manual edge cache (fetch-level cf caching cannot wrap a
      // WebSocket session): rounded coords key a 60 s entry -
      // ships move slowly, and the free tier allows few
      // concurrent sockets, so the cache IS the budget.
      const key = new Request(
        'https://horizon-adsb.cache/ais?lat=' +
          lat.toFixed(3) +
          '&lon=' +
          lon.toFixed(3) +
          '&dist=' +
          Math.round(dist)
      );
      const edge = typeof caches !== 'undefined' ? caches.default : null;
      if (edge) {
        const hit = await edge.match(key);
        if (hit) return hit;
      }
      try {
        const ships = await collectShips(
          env.AISSTREAM_KEY,
          Number(lat.toFixed(3)),
          Number(lon.toFixed(3)),
          Math.round(dist)
        );
        const res = new Response(JSON.stringify({ships}), {
          headers: {
            ...CORS,
            'content-type': 'application/json',
            'cache-control': 'public, max-age=60',
            'x-ais-source': 'aisstream.io'
          }
        });
        if (edge) await edge.put(key, res.clone());
        return res;
      } catch {
        return new Response('{"ships":[],"upstream":"unavailable"}', {
          status: 502,
          headers: {...CORS, 'content-type': 'application/json'}
        });
      }
    }
    if (req.method === 'GET' && url.pathname === '/probe') {
      return new Response(JSON.stringify({probe: await probeAll()}, null, 1), {
        headers: {
          ...CORS,
          'content-type': 'application/json',
          'cache-control': 'no-store'
        }
      });
    }
    if (req.method !== 'GET' || url.pathname !== '/adsb') {
      return new Response('not found', {status: 404, headers: CORS});
    }
    const lat = Number(url.searchParams.get('lat'));
    const lon = Number(url.searchParams.get('lon'));
    const dist = Math.min(Number(url.searchParams.get('dist')) || 15, 60);
    if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && dist > 0)) {
      return new Response('bad request', {status: 400, headers: CORS});
    }
    const target = pointUrl(lat.toFixed(3), lon.toFixed(3), dist);
    // One retry for transient blips, spaced a full 1.1 s so the
    // worker never exceeds the feed's documented 1 req/s even
    // while retrying.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 1100));
      try {
        const res = await fetch(target, {
          headers: {'user-agent': UA},
          cf: {
            cacheEverything: true,
            cacheTtlByStatus: {'200-299': 15, '400-599': 0}
          },
          signal: AbortSignal.timeout(FETCH_MS)
        });
        if (!res.ok) continue;
        const ac = normalize(await res.json());
        return new Response(JSON.stringify({ac}), {
          headers: {
            ...CORS,
            'content-type': 'application/json',
            'x-adsb-source': 'airplanes.live'
          }
        });
      } catch {
        // malformed body, network failure or timeout - retry
      }
    }
    return new Response('{"ac":[],"upstream":"unavailable"}', {
      status: 502,
      headers: {...CORS, 'content-type': 'application/json'}
    });
  }
};
