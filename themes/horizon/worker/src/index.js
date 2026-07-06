/**
 * horizon-adsb - a minimal allowlisted CORS proxy for live ADS-B
 * aircraft, deployed as a Cloudflare Worker.
 *
 * Why it exists: no public ADS-B feed is browser-reachable -
 * OpenSky locks access-control-allow-origin to its own site, and
 * adsb.lol / adsb.fi send no CORS headers at all (probed
 * 2026-07-06; see WEBGPU-PLAN.md). This worker forwards ONE fixed
 * query shape to api.adsb.lol and adds the CORS header, so the
 * Horizon theme can draw its Schmidt-Appleman contrails behind
 * REAL aircraft instead of ambient traffic.
 *
 * It is deliberately not an open proxy:
 *  - only GET/OPTIONS on the exact path /adsb
 *  - only the three numeric parameters lat/lon/dist, validated and
 *    clamped (dist <= 60 nm)
 *  - coordinates rounded to ~110 m so nearby visitors share one
 *    cached upstream request (edge cache 15 s, matching the
 *    upstream's own update cadence)
 *
 * Deploy: cd themes/horizon/worker && npx wrangler deploy
 * The theme looks for https://horizon-adsb.<your>.workers.dev via
 * the ADSB_PROXY constant in Horizon.html (override with ?adsb=).
 */

// Both feeds speak the same readsb v2 schema ({ac: [...]});
// adsb.lol intermittently 429s Cloudflare-egress requests (measured
// on the first deploy), so the worker fails over in order and only
// caches successes.
const UPSTREAMS = [
  (lat, lon, d) =>
    'https://api.adsb.lol/v2/lat/' + lat + '/lon/' + lon + '/dist/' + d,
  (lat, lon, d) =>
    'https://opendata.adsb.fi/api/v2/lat/' + lat + '/lon/' + lon + '/dist/' + d
];

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'cache-control': 'public, max-age=15'
};

export default {
  async fetch(req) {
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
    for (const mk of UPSTREAMS) {
      try {
        const res = await fetch(
          mk(lat.toFixed(3), lon.toFixed(3), Math.round(dist)),
          {
            cf: {
              cacheEverything: true,
              cacheTtlByStatus: {'200-299': 15, '400-599': 0}
            }
          }
        );
        if (res.ok) {
          return new Response(res.body, {
            headers: {...CORS, 'content-type': 'application/json'}
          });
        }
      } catch {
        // try the next feed
      }
    }
    return new Response('{"ac":[],"upstream":"unavailable"}', {
      status: 502,
      headers: {...CORS, 'content-type': 'application/json'}
    });
  }
};
