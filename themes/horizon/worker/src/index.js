/**
 * horizon-adsb - a minimal allowlisted CORS proxy for live ADS-B
 * aircraft, deployed as a Cloudflare Worker.
 *
 * Why it exists: no public ADS-B feed is browser-reachable -
 * OpenSky locks access-control-allow-origin to its own site, and
 * adsb.lol / adsb.fi send no CORS headers at all (probed
 * 2026-07-06; see WEBGPU-PLAN.md). This worker forwards ONE fixed
 * query shape upstream and adds the CORS header, so the Horizon
 * theme can draw its Schmidt-Appleman contrails behind REAL
 * aircraft instead of ambient traffic.
 *
 * ONE upstream: OpenSky's REST API, authenticated. The readsb
 * community feeds (adsb.lol, adsb.fi) were measured to TARPIT
 * Cloudflare-egress requests - 5 of 6 probes against the deployed
 * worker hung past 15 s with an occasional sub-second success -
 * so a failover chain through them stalls the whole request, and
 * they were dropped. OpenSky's anonymous tier buckets its 400
 * daily credits per IP, which Cloudflare's shared egress exhausts
 * instantly; a registered API client gets 4000 credits per DAY on
 * its own account (docs: openskynetwork.github.io/opensky-api),
 * and this worker's 15 nm bounding box is far under the 25 sq deg
 * 1-credit tier. With the 15 s edge cache that budget holds a
 * poll-per-minute theme site comfortably.
 *
 * Auth: OAuth2 client-credentials against the OpenSky Keycloak
 * (30-minute Bearer tokens, cached per isolate, refreshed on 401).
 * Configure once:
 *   npx wrangler secret put OPENSKY_CLIENT_ID
 *   npx wrangler secret put OPENSKY_CLIENT_SECRET
 * (create the API client on the OpenSky account page). Without
 * the secrets the worker still runs anonymously - best effort on
 * the shared per-IP pool.
 *
 * Every upstream fetch carries a hard 4 s AbortSignal timeout -
 * the tarpit measurement is exactly why: a proxy that can hang
 * for minutes is worse than one that answers 502 in seconds.
 *
 * It is deliberately not an open proxy:
 *  - only GET/OPTIONS on the exact path /adsb
 *  - only the three numeric parameters lat/lon/dist, validated and
 *    clamped (dist <= 60 nm)
 *  - coordinates rounded to ~110 m so nearby visitors share one
 *    cached upstream request (edge cache 15 s; OpenSky data is
 *    5-10 s resolution, and the cache spends the credit budget
 *    frugally)
 *
 * Deploy: cd themes/horizon/worker && npx wrangler deploy
 * The theme looks for https://horizon-adsb.<your>.workers.dev via
 * the ADSB_PROXY constant in Horizon.html (override with ?adsb=).
 */

const TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const API = 'https://opensky-network.org/api/states/all';
const FETCH_MS = 4000;

// Exact unit constants (international foot and knot) - the same
// values contrails.js uses to undo the conversion scene-side.
const FT_M = 0.3048;
const KT_MS = 0.514444;

// OpenSky takes a bounding box, not centre+radius: 1 nm of
// latitude is exactly 1/60 degree; longitude widens by 1/cos(lat)
// (clamped away from the poles). Exported for the reference gate.
export function bboxUrl(lat, lon, d) {
  const la = Number(lat);
  const lo = Number(lon);
  const dLat = d / 60;
  const dLon = d / (60 * Math.max(Math.cos((la * Math.PI) / 180), 0.01));
  return (
    API +
    '?lamin=' +
    Math.max(la - dLat, -90).toFixed(3) +
    '&lamax=' +
    Math.min(la + dLat, 90).toFixed(3) +
    '&lomin=' +
    Math.max(lo - dLon, -180).toFixed(3) +
    '&lomax=' +
    Math.min(lo + dLon, 180).toFixed(3)
  );
}

// OpenSky state vector (positional): 0 icao24, 1 callsign, 5 lon,
// 6 lat, 7 baro_altitude (m), 8 on_ground, 9 velocity (m/s),
// 10 true_track (deg). Convert SI to the readsb shape and units
// (feet, knots) the theme's single parser expects, dropping
// grounded or incomplete vectors.
export function normalize(j) {
  return (Array.isArray(j.states) ? j.states : [])
    .filter(
      (s) =>
        !s[8] &&
        typeof s[5] === 'number' &&
        typeof s[6] === 'number' &&
        typeof s[7] === 'number' &&
        typeof s[9] === 'number' &&
        typeof s[10] === 'number'
    )
    .map((s) => ({
      hex: s[0],
      flight: ((s[1] || '') + '').trim(),
      lat: s[6],
      lon: s[5],
      alt_baro: s[7] / FT_M,
      gs: s[9] / KT_MS,
      track: s[10]
    }));
}

// Per-isolate token cache: OpenSky Bearer tokens live 30 minutes
// (expires_in 1800); refresh two minutes early. resetToken() lets
// the reference gate exercise the cold path deterministically.
let tokenCache = {token: null, exp: 0};
export function resetToken() {
  tokenCache = {token: null, exp: 0};
}

async function getToken(env) {
  if (!env || !env.OPENSKY_CLIENT_ID || !env.OPENSKY_CLIENT_SECRET) {
    return null;
  }
  if (tokenCache.token && Date.now() < tokenCache.exp) {
    return tokenCache.token;
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.OPENSKY_CLIENT_ID,
      client_secret: env.OPENSKY_CLIENT_SECRET
    }),
    signal: AbortSignal.timeout(FETCH_MS)
  });
  if (!res.ok) return null;
  const j = await res.json();
  tokenCache = {
    token: j.access_token,
    exp: Date.now() + Math.max((j.expires_in || 1800) - 120, 60) * 1000
  };
  return tokenCache.token;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'cache-control': 'public, max-age=15'
};

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') {
      return new Response(null, {headers: CORS});
    }
    const url = new URL(req.url);
    if (req.method !== 'GET' || url.pathname !== '/adsb') {
      return new Response('not found', {status: 404, headers: CORS});
    }
    const lat = Number(url.searchParams.get('lat'));
    const lon = Number(url.searchParams.get('lon'));
    const dist = Math.min(Number(url.searchParams.get('dist')) || 15, 60);
    if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && dist > 0)) {
      return new Response('bad request', {status: 400, headers: CORS});
    }
    let token = null;
    try {
      token = await getToken(env);
    } catch {
      // token endpoint down or timed out - fall back to anonymous
    }
    const target = bboxUrl(lat.toFixed(3), lon.toFixed(3), Math.round(dist));
    // The anonymous tier sheds load with intermittent 503s (about
    // half of single shots when probed), so retry short - the
    // theme polls once a minute and should not lose the whole
    // minute to one shed request.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 400));
      try {
        const res = await fetch(target, {
          headers: token ? {authorization: 'Bearer ' + token} : {},
          cf: {
            cacheEverything: true,
            cacheTtlByStatus: {'200-299': 15, '400-599': 0}
          },
          signal: AbortSignal.timeout(FETCH_MS)
        });
        if (res.status === 401 && token) {
          // token expired server-side - refresh once and retry
          resetToken();
          try {
            token = await getToken(env);
          } catch {
            token = null;
          }
          continue;
        }
        if (!res.ok) continue;
        const ac = normalize(await res.json());
        return new Response(JSON.stringify({ac}), {
          headers: {
            ...CORS,
            'content-type': 'application/json',
            'x-adsb-source': token ? 'opensky-auth' : 'opensky'
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
