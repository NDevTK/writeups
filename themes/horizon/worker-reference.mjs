// Reference printer for the horizon-adsb Cloudflare worker (node
// worker-reference.mjs). The worker module runs unmodified in node
// (same V8; Response/Request are global since node 18), so this
// gate exercises the REAL handler offline with stubbed fetch. One
// upstream by MEASUREMENT: the /probe diagnostic ran on the
// deployed edge (2026-07-06) - control 200, opensky api AND auth
// TimeoutError (network-drops CF ranges, so credentials can never
// help), adsb.lol 429, adsb.fi 403, airplanes.live 200 with 32
// aircraft in 232 ms. airplanes.live speaks readsb v2 natively
// (feet, knots), so no unit conversion exists to get wrong - the
// worker only strips vectors to the seven fields the theme reads.
// Landmarks:
//  - point URL: centre + radius in whole nm on the /v2/point path
//  - normalization: readsb vectors stripped to the theme's seven
//    fields with units UNTOUCHED, grounded (alt_baro "ground") and
//    incomplete vectors dropped, callsigns trimmed
//  - handler: a 429 blip carried by the rate-respecting retry,
//    CORS + x-adsb-source on the response, User-Agent sent, and
//    the aircraft feed adsbToScene (contrails.js) unchanged
//  - /probe: the edge diagnostic that picked the feed answers
//    offline, mapping HTTP statuses and thrown timeouts alike
//    into inspectable rows
//  - /ais: the real handler through a stubbed aisstream.io
//    WebSocket - subscription carries the secret key + exact
//    bounding box, latest report per MMSI wins, ITU-R M.1371
//    sentinels map to null/0, no key -> 503
//  - allowlist: wrong path 404, out-of-range coords 400, OPTIONS
//    preflight carries the CORS allow headers
import worker, {aisBox, normalize, pointUrl} from './worker/src/index.js';
import {adsbToScene} from './contrails.js';
import {aisToScene} from './ships.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  const u = pointUrl('46.620', '8.040', 15);
  check(
    'point URL',
    u === 'https://api.airplanes.live/v2/point/46.620/8.040/15' &&
      pointUrl('51.470', '-0.450', 15.4) ===
        'https://api.airplanes.live/v2/point/51.470/-0.450/15',
    `${u}; fractional dist rounds to whole nm`
  );
}

// A recorded-shape readsb payload (airplanes.live /v2/point): one
// clean cruise vector, one on the ground (alt_baro is the STRING
// "ground" in readsb), one missing track (both must be dropped),
// plus extra readsb fields the strip must remove.
const FEED = {
  ac: [
    {
      hex: '3c6754',
      type: 'adsb_icao',
      flight: 'DLH9CK  ',
      r: 'D-AIEB',
      t: 'A21N',
      alt_baro: 36000,
      alt_geom: 37600,
      gs: 400,
      ias: 244,
      track: 90,
      lat: 46.62,
      lon: 8.04,
      squawk: '1000',
      rssi: -9.7
    },
    {
      hex: '4b1817',
      flight: 'SWR12A  ',
      alt_baro: 'ground',
      gs: 5,
      track: 180,
      lat: 46.7,
      lon: 8.1
    },
    {
      hex: '4b2b45',
      flight: 'HBZZZ   ',
      alt_baro: 8000,
      gs: 120,
      lat: 46.6,
      lon: 8.0
    }
  ]
};

{
  const ac = normalize(FEED);
  const a = ac[0];
  check(
    'normalization',
    ac.length === 1 &&
      a.hex === '3c6754' &&
      a.flight === 'DLH9CK' &&
      a.alt_baro === 36000 &&
      a.gs === 400 &&
      a.track === 90 &&
      a.lat === 46.62 &&
      a.lon === 8.04 &&
      Object.keys(a).length === 7 &&
      !('ias' in a),
    `readsb units untouched (36000 ft, 400 kt); stripped to ${Object.keys(a).length} fields; "ground" + missing-track vectors dropped (3 -> ${ac.length})`
  );
}

const REQ = () =>
  new Request('https://horizon-adsb.test/adsb?lat=46.62&lon=8.04&dist=15');
const realFetch = globalThis.fetch;

{
  // Handler end-to-end: a 429 blip on the first shot (the feed
  // rate-limits at 1 req/s) carried by the rate-respecting retry;
  // User-Agent on every fetch; the normalized aircraft must feed
  // the theme's adsbToScene mapping unchanged.
  let apiCalls = 0;
  let sawUA = true;
  globalThis.fetch = async (u, init) => {
    if (
      !((init?.headers || {})['user-agent'] || '').startsWith('horizon-adsb/')
    )
      sawUA = false;
    if (++apiCalls === 1) return new Response('slow down', {status: 429});
    return new Response(JSON.stringify(FEED), {
      headers: {'content-type': 'application/json'}
    });
  };
  const res = await worker.fetch(REQ());
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
    'handler',
    res.status === 200 &&
      apiCalls === 2 &&
      sawUA &&
      res.headers.get('access-control-allow-origin') === '*' &&
      res.headers.get('x-adsb-source') === 'airplanes.live' &&
      body.ac.length === 1 &&
      Math.abs(scene.y - yExp) < 1e-9 &&
      Math.abs(scene.vx - (400 * 0.514444) / 57.14) < 1e-9 &&
      Math.abs(scene.x) < 1e-9,
    `429 then 200 on retry (${apiCalls} calls, UA set), CORS *, x-adsb-source ${res.headers.get('x-adsb-source')}; adsbToScene round-trip: FL360 east -> y ${scene.y.toFixed(2)}, vx ${scene.vx.toFixed(3)} u/s`
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
    if (s.includes('opensky-network.org')) {
      const e = new Error('operation timed out');
      e.name = 'TimeoutError';
      throw e;
    }
    if (s.includes('airplanes.live')) {
      return new Response(JSON.stringify(FEED), {
        headers: {'content-type': 'application/json'}
      });
    }
    return new Response('nope', {status: 429});
  };
  const res = await worker.fetch(new Request('https://x.test/probe'));
  const j = await res.json();
  globalThis.fetch = realFetch;
  const by = Object.fromEntries(j.probe.map((r) => [r.name, r]));
  check(
    'probe endpoint',
    res.status === 200 &&
      j.probe.length === 6 &&
      j.probe.every((r) => typeof r.ms === 'number') &&
      by['airplanes.live'].status === 200 &&
      by['airplanes.live'].aircraft === 3 &&
      by['opensky-api'].error === 'TimeoutError: operation timed out' &&
      by['opensky-auth'].status === 401 &&
      by['adsb.lol'].status === 429 &&
      by['control'].status === 429 &&
      res.headers.get('cache-control') === 'no-store',
    `6 fixed targets; airplanes.live 200/${by['airplanes.live'].aircraft} ac, opensky-api -> "${by['opensky-api'].error}", opensky-auth 401, uncached`
  );
}

{
  // /ais end-to-end through a stubbed WebSocket that behaves
  // exactly like aisstream.io: open -> subscription expected ->
  // PositionReports stream -> close. Asserts the subscription
  // carries the SECRET key and the exact bounding box, that the
  // latest report per MMSI wins, that ITU-R M.1371 sentinels map
  // to null/0, and that the normalized ship feeds the theme's
  // aisToScene mapping unchanged.
  const REPORT = (over = {}) => ({
    MessageType: 'PositionReport',
    MetaData: {MMSI: 211234560, ShipName: 'EDELWEISS  ', ...over.meta},
    Message: {
      PositionReport: {
        UserID: over.mmsi ?? 211234560,
        Latitude: over.lat ?? 46.62,
        Longitude: over.lon ?? 8.04,
        Sog: over.sog ?? 10,
        Cog: over.cog ?? 90,
        TrueHeading: over.hdg ?? 87,
        NavigationalStatus: 0
      }
    }
  });
  let sub = null;
  const realWS = globalThis.WebSocket;
  globalThis.WebSocket = class extends EventTarget {
    constructor() {
      super();
      setTimeout(() => this.dispatchEvent(new Event('open')), 0);
    }
    send(s) {
      sub = JSON.parse(s);
      const say = (o) =>
        this.dispatchEvent(
          new MessageEvent('message', {data: JSON.stringify(o)})
        );
      setTimeout(() => {
        say(REPORT({lat: 46.6})); // stale position...
        say(REPORT({lat: 46.63})); // ...same MMSI, latest wins
        say(
          REPORT({
            mmsi: 269057000,
            meta: {ShipName: 'VERENA'},
            sog: 102.3, // not available -> 0
            cog: 360, // not available -> null
            hdg: 511 // not available -> null
          })
        );
        say({MessageType: 'ShipStaticData', Message: {}}); // ignored
        this.dispatchEvent(new Event('close')); // ends the window
      }, 0);
    }
    close() {}
  };
  const env = {AISSTREAM_KEY: 'sekret'};
  const res = await worker.fetch(
    new Request('https://x.test/ais?lat=46.62&lon=8.04&dist=8'),
    env
  );
  const noKey = await worker.fetch(
    new Request('https://x.test/ais?lat=46.62&lon=8.04'),
    {}
  );
  const bad = await worker.fetch(
    new Request('https://x.test/ais?lat=999&lon=0'),
    env
  );
  globalThis.WebSocket = realWS;
  const j = await res.json();
  const byM = Object.fromEntries(j.ships.map((s) => [s.mmsi, s]));
  const box = aisBox(46.62, 8.04, 8);
  const scene = aisToScene(byM[211234560], {
    lat: 46.62,
    lon: 8.04,
    halfM: 8000,
    world: 280,
    mpu: 57.14
  });
  check(
    '/ais route',
    res.status === 200 &&
      res.headers.get('x-ais-source') === 'aisstream.io' &&
      res.headers.get('access-control-allow-origin') === '*' &&
      sub.APIKey === 'sekret' &&
      JSON.stringify(sub.BoundingBoxes) === JSON.stringify([box]) &&
      JSON.stringify(sub.FilterMessageTypes) ===
        JSON.stringify(['PositionReport']) &&
      j.ships.length === 2 &&
      byM[211234560].lat === 46.63 &&
      byM[211234560].name === 'EDELWEISS' &&
      byM[269057000].sog === 0 &&
      byM[269057000].cog === null &&
      byM[269057000].hdg === null &&
      Math.abs(scene.vx - (10 * 0.514444) / 57.14) < 1e-12 &&
      noKey.status === 503 &&
      bad.status === 400,
    `subscription carries key + exact box; latest-per-MMSI wins (lat ${byM[211234560].lat}); sentinels 102.3/360/511 -> 0/null/null; aisToScene vx ${scene.vx.toFixed(4)} u/s; no key -> 503, lat=999 -> 400`
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
