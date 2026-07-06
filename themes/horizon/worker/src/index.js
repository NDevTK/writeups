/**
 * horizon-adsb - a minimal allowlisted CORS proxy for live ADS-B
 * aircraft, deployed as a Cloudflare Worker.
 *
 * Why it exists: no public ADS-B feed is browser-reachable -
 * they either lock access-control-allow-origin to their own site
 * or send no CORS headers at all (probed 2026-07-06; see
 * WEBGPU-PLAN.md). This worker forwards ONE fixed query shape
 * upstream and adds the CORS header, so the Horizon theme can
 * draw its Schmidt-Appleman contrails behind REAL aircraft
 * instead of ambient traffic.
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
 * It is deliberately not an open proxy:
 *  - only GET/OPTIONS on the exact paths /adsb and /probe (the
 *    latter a fixed-target edge diagnostic, no parameters)
 *  - only the three numeric parameters lat/lon/dist, validated
 *    and clamped (dist <= 60 nm)
 *
 * Deploy: cd themes/horizon/worker && npx wrangler deploy
 * The theme looks for https://horizon-adsb.<your>.workers.dev via
 * the ADSB_PROXY constant in Horizon.html (override with ?adsb=).
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
  async fetch(req) {
    if (req.method === 'OPTIONS') {
      return new Response(null, {headers: CORS});
    }
    const url = new URL(req.url);
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
