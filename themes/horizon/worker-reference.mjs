// Reference printer for the horizon-adsb Cloudflare worker (node
// worker-reference.mjs). The worker module runs unmodified in node
// (same V8; Response/Request are global since node 18), so this
// gate exercises the REAL handler offline: global fetch is stubbed
// with a recorded OpenSky state-vector payload and failing readsb
// upstreams, exactly the situation measured on the deployed worker
// (both community feeds refuse Cloudflare egress).
// Landmarks:
//  - OpenSky bounding box: 1 nm of latitude is exactly 1/60 degree;
//    longitude widens by 1/cos(lat); the box is centred on the query
//  - schema normalization: OpenSky SI state vectors map to the
//    readsb shape with the EXACT international foot and knot
//    (10972.8 m -> 36000 ft, 205.7776 m/s -> 400 kt), grounded and
//    incomplete vectors are dropped, callsigns are trimmed
//  - end-to-end: with readsb down, the handler answers 200 from
//    opensky with CORS + x-adsb-source, and the normalized aircraft
//    feeds adsbToScene (contrails.js) unchanged - one parser
//  - allowlist: wrong path 404, non-numeric coords 400, OPTIONS
//    preflight carries the CORS allow headers
import worker, {UPSTREAMS} from './worker/src/index.js';
import {adsbToScene} from './contrails.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const opensky = UPSTREAMS.find((u) => u.name === 'opensky');

{
  const u = new URL(opensky.url('46.620', '8.040', 15));
  const g = (k) => Number(u.searchParams.get(k));
  const dLat = 15 / 60;
  const dLon = 15 / (60 * Math.cos((46.62 * Math.PI) / 180));
  const ok =
    Math.abs(g('lamax') - g('lamin') - 2 * dLat) < 2e-3 &&
    Math.abs(g('lomax') - g('lomin') - 2 * dLon) < 2e-3 &&
    Math.abs((g('lamax') + g('lamin')) / 2 - 46.62) < 1e-3 &&
    Math.abs((g('lomax') + g('lomin')) / 2 - 8.04) < 1e-3 &&
    u.origin === 'https://opensky-network.org' &&
    u.pathname === '/api/states/all';
  check(
    'OpenSky bbox',
    ok,
    `15 nm at 46.62N: dLat ${(g('lamax') - g('lamin')).toFixed(3)} deg (exact 0.500), dLon ${(g('lomax') - g('lomin')).toFixed(3)} deg (1/cos widened ${(2 * dLon).toFixed(3)}), centred`
  );
}

// A recorded-shape OpenSky payload: one clean cruise vector with
// EXACT SI values for round unit conversions, one grounded, one
// with a null velocity (both must be dropped).
const STATES = {
  time: 1751791000,
  states: [
    [
      '3c6754',
      'DLH9CK  ',
      'Germany',
      1751790995,
      1751790999,
      8.04,
      46.62,
      10972.8,
      false,
      205.7776,
      90.0,
      0.0,
      null,
      11079.5,
      '1000',
      false,
      0
    ],
    [
      '4b1817',
      'SWR12A  ',
      'Switzerland',
      0,
      0,
      8.1,
      46.7,
      10.0,
      true,
      5.0,
      180.0,
      0,
      null,
      15.0,
      null,
      false,
      0
    ],
    [
      '4b2b45',
      'HBZZZ   ',
      'Switzerland',
      0,
      0,
      8.0,
      46.6,
      3000.0,
      false,
      null,
      45.0,
      0,
      null,
      3050.0,
      null,
      false,
      0
    ]
  ]
};

{
  const ac = opensky.norm(STATES);
  const a = ac[0];
  check(
    'normalization',
    ac.length === 1 &&
      a.hex === '3c6754' &&
      a.flight === 'DLH9CK' &&
      Math.abs(a.alt_baro - 36000) < 1e-9 &&
      Math.abs(a.gs - 400) < 1e-9 &&
      a.lat === 46.62 &&
      a.lon === 8.04 &&
      a.track === 90,
    `10972.8 m -> ${a.alt_baro.toFixed(1)} ft (exact 36000); 205.7776 m/s -> ${a.gs.toFixed(1)} kt (exact 400); grounded + null-velocity vectors dropped (3 -> ${ac.length})`
  );
}

{
  // End-to-end with the measured outage: readsb upstreams 429
  // (Cloudflare egress refused) and OpenSky sheds the FIRST call
  // with a 503 (its anonymous tier drops about half of single
  // shots - probed), so the in-worker retry must carry it. The
  // handler must return 200 JSON with CORS and name its source;
  // the aircraft must feed the theme's adsbToScene mapping
  // unchanged.
  const realFetch = globalThis.fetch;
  let openskyCalls = 0;
  globalThis.fetch = async (u) => {
    if (String(u).startsWith('https://opensky-network.org/')) {
      if (++openskyCalls === 1) return new Response('shedding', {status: 503});
      return new Response(JSON.stringify(STATES), {
        headers: {'content-type': 'application/json'}
      });
    }
    return new Response('rate limited', {status: 429});
  };
  const res = await worker.fetch(
    new Request('https://horizon-adsb.test/adsb?lat=46.62&lon=8.04&dist=15')
  );
  const body = await res.json();
  globalThis.fetch = realFetch;
  const scene = adsbToScene(body.ac[0], {
    lat: 46.62,
    lon: 8.04,
    halfM: 8000,
    world: 280,
    centerElev: 300,
    mpu: 57.14
  });
  const yExp = 16 * Math.asinh((36000 * 0.3048 - 300) / 500);
  check(
    'handler failover',
    res.status === 200 &&
      openskyCalls === 2 &&
      res.headers.get('access-control-allow-origin') === '*' &&
      res.headers.get('x-adsb-source') === 'opensky' &&
      body.ac.length === 1 &&
      Math.abs(scene.y - yExp) < 1e-9 &&
      Math.abs(scene.vx - (400 * 0.514444) / 57.14) < 1e-9 &&
      Math.abs(scene.x) < 1e-9,
    `readsb 429 -> opensky 503 then 200 on retry (${openskyCalls} calls), CORS *, x-adsb-source ${res.headers.get('x-adsb-source')}; adsbToScene round-trip: FL360 east -> y ${scene.y.toFixed(2)}, vx ${scene.vx.toFixed(3)} u/s`
  );
}

{
  const nf = await worker.fetch(new Request('https://x.test/other'));
  const bad = await worker.fetch(
    new Request('https://x.test/adsb?lat=999&lon=0')
  );
  const pre = await worker.fetch(
    new Request('https://x.test/adsb', {method: 'OPTIONS'})
  );
  check(
    'allowlist',
    nf.status === 404 &&
      bad.status === 400 &&
      pre.status === 200 &&
      (pre.headers.get('access-control-allow-methods') || '').includes('GET'),
    `wrong path 404, lat=999 400, OPTIONS 200 with allow-methods`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
