// Reference printer for the horizon-adsb Cloudflare worker (node
// worker-reference.mjs). The worker module runs unmodified in node
// (same V8; Response/Request are global since node 18), so this
// gate exercises the REAL handler offline: global fetch is stubbed
// with recorded OpenSky payloads and the measured failure modes
// (anonymous 503 shedding, expired-token 401s). One upstream by
// design - the readsb community feeds tarpit Cloudflare egress
// (measured: 5 of 6 probes hung past 15 s) and were dropped.
// Landmarks:
//  - OpenSky bounding box: 1 nm of latitude is exactly 1/60 degree;
//    longitude widens by 1/cos(lat); the box is centred on the query
//  - schema normalization: OpenSky SI state vectors map to the
//    readsb shape with the EXACT international foot and knot
//    (10972.8 m -> 36000 ft, 205.7776 m/s -> 400 kt), grounded and
//    incomplete vectors are dropped, callsigns are trimmed
//  - anonymous mode: no secrets -> no token call, first shot shed
//    with 503 (measured ~half of single shots), the in-worker
//    retry carries it; CORS + x-adsb-source on the response and
//    the aircraft feed adsbToScene (contrails.js) unchanged
//  - authenticated mode: client-credentials form POST to the
//    Keycloak token endpoint, Bearer header on the API call,
//    token cached across invocations (ONE token fetch for two
//    requests), 401 -> refresh once and carry on
//  - allowlist: wrong path 404, out-of-range coords 400, OPTIONS
//    preflight carries the CORS allow headers
import worker, {bboxUrl, normalize, resetToken} from './worker/src/index.js';
import {adsbToScene} from './contrails.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  const u = new URL(bboxUrl('46.620', '8.040', 15));
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
  const ac = normalize(STATES);
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

const REQ = () =>
  new Request('https://horizon-adsb.test/adsb?lat=46.62&lon=8.04&dist=15');
const realFetch = globalThis.fetch;

{
  // Anonymous mode (no secrets): no token traffic; OpenSky sheds
  // the FIRST call with a 503 (the measured behaviour of the
  // anonymous tier - about half of single shots), so the
  // in-worker retry must carry it. The normalized aircraft must
  // feed the theme's adsbToScene mapping unchanged.
  resetToken();
  let apiCalls = 0;
  let tokenCalls = 0;
  let sawAuth = false;
  let sawUA = true;
  globalThis.fetch = async (u, init) => {
    if (String(u).includes('auth.opensky-network.org')) {
      tokenCalls++;
      return new Response('{}', {status: 200});
    }
    if ((init?.headers || {}).authorization) sawAuth = true;
    if (
      !((init?.headers || {})['user-agent'] || '').startsWith('horizon-adsb/')
    )
      sawUA = false;
    if (++apiCalls === 1) return new Response('shedding', {status: 503});
    return new Response(JSON.stringify(STATES), {
      headers: {'content-type': 'application/json'}
    });
  };
  const res = await worker.fetch(REQ(), {});
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
    'anonymous mode',
    res.status === 200 &&
      apiCalls === 2 &&
      tokenCalls === 0 &&
      !sawAuth &&
      sawUA &&
      res.headers.get('access-control-allow-origin') === '*' &&
      res.headers.get('x-adsb-source') === 'opensky' &&
      body.ac.length === 1 &&
      Math.abs(scene.y - yExp) < 1e-9 &&
      Math.abs(scene.vx - (400 * 0.514444) / 57.14) < 1e-9 &&
      Math.abs(scene.x) < 1e-9,
    `503 then 200 on retry (${apiCalls} calls, no token traffic, UA set), CORS *, x-adsb-source ${res.headers.get('x-adsb-source')}; adsbToScene round-trip: FL360 east -> y ${scene.y.toFixed(2)}, vx ${scene.vx.toFixed(3)} u/s`
  );
}

{
  // Authenticated mode: client-credentials form POST, Bearer on
  // the API call, ONE token fetch serving two requests (the
  // 30-minute cache), and a server-side 401 refreshed exactly
  // once without losing the request.
  resetToken();
  const env = {OPENSKY_CLIENT_ID: 'horizon', OPENSKY_CLIENT_SECRET: 's3cret'};
  let tokenCalls = 0;
  let apiCalls = 0;
  let goodForm = false;
  const bearers = [];
  let expire401 = false;
  globalThis.fetch = async (u, init) => {
    if (String(u).includes('auth.opensky-network.org')) {
      tokenCalls++;
      const p = new URLSearchParams(String(init.body));
      goodForm =
        init.method === 'POST' &&
        p.get('grant_type') === 'client_credentials' &&
        p.get('client_id') === 'horizon' &&
        p.get('client_secret') === 's3cret';
      return new Response(
        JSON.stringify({access_token: 'tok' + tokenCalls, expires_in: 1800}),
        {headers: {'content-type': 'application/json'}}
      );
    }
    apiCalls++;
    bearers.push((init?.headers || {}).authorization || null);
    if (expire401) {
      expire401 = false;
      return new Response('expired', {status: 401});
    }
    return new Response(JSON.stringify(STATES), {
      headers: {'content-type': 'application/json'}
    });
  };
  const r1 = await worker.fetch(REQ(), env);
  const r2 = await worker.fetch(REQ(), env); // cached token, no new POST
  const cachedOk = tokenCalls === 1 && apiCalls === 2;
  expire401 = true; // third request: server rejects tok1 once
  const r3 = await worker.fetch(REQ(), env);
  globalThis.fetch = realFetch;
  check(
    'authenticated mode',
    goodForm &&
      cachedOk &&
      r1.status === 200 &&
      r2.status === 200 &&
      r3.status === 200 &&
      r1.headers.get('x-adsb-source') === 'opensky-auth' &&
      bearers[0] === 'Bearer tok1' &&
      bearers[1] === 'Bearer tok1' &&
      bearers.at(-1) === 'Bearer tok2' &&
      tokenCalls === 2,
    `client-credentials form exact; 1 token POST serves 2 requests (Bearer tok1 both); 401 -> refreshed to tok2 and answered 200; x-adsb-source opensky-auth`
  );
}

{
  // /probe: the edge diagnostic answers offline with one entry
  // per fixed target, mapping HTTP statuses and thrown timeouts
  // alike into inspectable rows - a TimeoutError must come back
  // as an error string, not a hang and not a crash.
  globalThis.fetch = async (u, init) => {
    const s = String(u);
    if (s.includes('auth.opensky-network.org')) {
      return new Response('{"error":"invalid_client"}', {status: 401});
    }
    if (s.includes('adsb.lol')) {
      const e = new Error('operation timed out');
      e.name = 'TimeoutError';
      throw e;
    }
    if (s.includes('opensky-network.org')) {
      return new Response(JSON.stringify(STATES), {
        headers: {'content-type': 'application/json'}
      });
    }
    return new Response('{"ac":[]}', {
      headers: {'content-type': 'application/json'}
    });
  };
  const res = await worker.fetch(new Request('https://x.test/probe'), {});
  const j = await res.json();
  globalThis.fetch = realFetch;
  const by = Object.fromEntries(j.probe.map((r) => [r.name, r]));
  check(
    'probe endpoint',
    res.status === 200 &&
      j.probe.length === 6 &&
      j.probe.every((r) => typeof r.ms === 'number') &&
      by['opensky-api'].status === 200 &&
      by['opensky-api'].aircraft === 3 &&
      by['opensky-auth'].status === 401 &&
      by['adsb.lol'].error === 'TimeoutError: operation timed out' &&
      by['control'].status === 200 &&
      res.headers.get('cache-control') === 'no-store',
    `6 fixed targets; opensky-api 200/${by['opensky-api'].aircraft} states, opensky-auth 401 (reachable), adsb.lol -> "${by['adsb.lol'].error}", uncached`
  );
}

{
  const nf = await worker.fetch(new Request('https://x.test/other'), {});
  const bad = await worker.fetch(
    new Request('https://x.test/adsb?lat=999&lon=0'),
    {}
  );
  const pre = await worker.fetch(
    new Request('https://x.test/adsb', {method: 'OPTIONS'}),
    {}
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
