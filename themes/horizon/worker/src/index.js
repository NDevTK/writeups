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
 * Upstreams, in order: adsb.lol and adsb.fi (readsb v2 JSON,
 * passed through), then OpenSky's anonymous REST API. The readsb
 * community feeds refuse Cloudflare-egress requests outright
 * (measured on the deployed worker: both fail from the edge while
 * answering the same query from a residential IP), so in practice
 * OpenSky serves - behind a server-side proxy its restrictive
 * CORS policy is irrelevant, which is exactly the point of the
 * worker. OpenSky speaks a different schema (state vectors as
 * positional arrays, SI units), so its entry normalizes into the
 * same readsb shape {ac: [{hex, flight, lat, lon, alt_baro(ft),
 * gs(kt), track}]} and the theme keeps a single parser.
 *
 * It is deliberately not an open proxy:
 *  - only GET/OPTIONS on the exact path /adsb
 *  - only the three numeric parameters lat/lon/dist, validated and
 *    clamped (dist <= 60 nm)
 *  - coordinates rounded to ~110 m so nearby visitors share one
 *    cached upstream request (edge cache 15 s, matching the
 *    readsb update cadence; OpenSky anonymous data is 10 s
 *    resolution and rate-limited per IP, so the cache also spends
 *    its credit budget frugally)
 *
 * Deploy: cd themes/horizon/worker && npx wrangler deploy
 * The theme looks for https://horizon-adsb.<your>.workers.dev via
 * the ADSB_PROXY constant in Horizon.html (override with ?adsb=).
 */

// Exact unit constants (international foot and knot) - the same
// values contrails.js uses to undo the conversion scene-side.
const FT_M = 0.3048;
const KT_MS = 0.514444;

// Each upstream: a URL builder (lat/lon as fixed(3) strings, dist
// in whole nm) and a normalizer from its parsed JSON to the readsb
// aircraft list. Exported for the node-side reference check.
export const UPSTREAMS = [
  {
    name: 'adsb.lol',
    url: (lat, lon, d) =>
      'https://api.adsb.lol/v2/lat/' + lat + '/lon/' + lon + '/dist/' + d,
    norm: (j) => (Array.isArray(j.ac) ? j.ac : [])
  },
  {
    name: 'adsb.fi',
    url: (lat, lon, d) =>
      'https://opendata.adsb.fi/api/v2/lat/' +
      lat +
      '/lon/' +
      lon +
      '/dist/' +
      d,
    norm: (j) => (Array.isArray(j.ac) ? j.ac : [])
  },
  {
    // OpenSky takes a bounding box, not centre+radius: 1 nm of
    // latitude is exactly 1/60 degree; longitude widens by
    // 1/cos(lat) (clamped away from the poles). The anonymous
    // tier sheds load with intermittent 503s (~half of single
    // shots when probed), so this entry gets short in-worker
    // retries - the theme polls once a minute and should not
    // lose the whole minute to one shed request.
    name: 'opensky',
    retries: 2,
    url: (lat, lon, d) => {
      const la = Number(lat);
      const lo = Number(lon);
      const dLat = d / 60;
      const dLon = d / (60 * Math.max(Math.cos((la * Math.PI) / 180), 0.01));
      return (
        'https://opensky-network.org/api/states/all' +
        '?lamin=' +
        Math.max(la - dLat, -90).toFixed(3) +
        '&lamax=' +
        Math.min(la + dLat, 90).toFixed(3) +
        '&lomin=' +
        Math.max(lo - dLon, -180).toFixed(3) +
        '&lomax=' +
        Math.min(lo + dLon, 180).toFixed(3)
      );
    },
    // OpenSky state vector (positional): 0 icao24, 1 callsign,
    // 5 lon, 6 lat, 7 baro_altitude (m), 8 on_ground, 9 velocity
    // (m/s), 10 true_track (deg). Convert SI to the readsb units
    // (feet, knots) and drop grounded or incomplete vectors -
    // the theme's parser requires every numeric field.
    norm: (j) =>
      (Array.isArray(j.states) ? j.states : [])
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
        }))
  }
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
    for (const up of UPSTREAMS) {
      for (let attempt = 0; attempt <= (up.retries || 0); attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 400));
        try {
          const res = await fetch(
            up.url(lat.toFixed(3), lon.toFixed(3), Math.round(dist)),
            {
              cf: {
                cacheEverything: true,
                cacheTtlByStatus: {'200-299': 15, '400-599': 0}
              }
            }
          );
          if (!res.ok) continue;
          const ac = up.norm(await res.json());
          return new Response(JSON.stringify({ac}), {
            headers: {
              ...CORS,
              'content-type': 'application/json',
              'x-adsb-source': up.name
            }
          });
        } catch {
          // malformed body or network failure - retry or move on
        }
      }
    }
    return new Response('{"ac":[],"upstream":"unavailable"}', {
      status: 502,
      headers: {...CORS, 'content-type': 'application/json'}
    });
  }
};
