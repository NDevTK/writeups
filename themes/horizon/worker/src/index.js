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

const UPSTREAM = 'https://api.adsb.lol/v2';

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
    const upstream =
      UPSTREAM +
      '/lat/' +
      lat.toFixed(3) +
      '/lon/' +
      lon.toFixed(3) +
      '/dist/' +
      Math.round(dist);
    const res = await fetch(upstream, {
      cf: {cacheTtl: 15, cacheEverything: true}
    });
    return new Response(res.body, {
      status: res.status,
      headers: {...CORS, 'content-type': 'application/json'}
    });
  }
};
