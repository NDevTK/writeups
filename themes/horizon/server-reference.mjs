// Reference printer for the horizon-live daemon (node
// server-reference.mjs). The daemon (server/src/index.mjs) owns
// everything now - the Cloudflare worker it superseded has been
// DELETED (git history holds it), and its schema normalizers and
// their landmarks moved here. This set gates the daemon's pure
// pieces:
//  - the AIS engine: ingest into the 1-degree spatial grid with
//    latest-per-MMSI, cell migration when a ship crosses a grid
//    boundary (old cell emptied AND deleted), Class B frames on
//    the same path, junk frames counted but not ingested
//  - query: the same aisBox geodesy as the /ais route, exact
//    boundary inclusion, internal fields stripped, limit honoured
//  - prune: stale ships dropped with their grid entries, fresh
//    ships kept
//  - origin allowlist: the website origin gets its exact CORS
//    echo, foreign origins are refused, absent Origin passes with
//    NO grant (curl works, browsers from other sites do not)
//  - rate limiter: continuous-refill token bucket - the budget
//    holds, refills with time, and IPs are isolated
// All time-dependent landmarks pass explicit clocks - nothing
// here reads the wall clock.
import {
  createAisState,
  createLimiter,
  createStrikeState,
  decodeFrame,
  gridKey,
  ingest,
  ingestStrike,
  lzwDecode,
  originCheck,
  prune,
  pruneStrikes,
  aisBox,
  normalize,
  normalizeShip,
  overBackpressure,
  query,
  queryStrikes,
  SEC_HEADERS,
  SSE_BUFFER_MAX,
  sseEvent
} from './server/src/index.mjs';

import {haversineKm} from './lightning.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const FRAME = (mmsi, lat, lon, over = {}) => ({
  MessageType: over.classB ? 'StandardClassBPositionReport' : 'PositionReport',
  MetaData: {MMSI: mmsi, ShipName: over.name ?? 'SHIP ' + mmsi},
  Message: {
    [over.classB ? 'StandardClassBPositionReport' : 'PositionReport']: {
      UserID: mmsi,
      Latitude: lat,
      Longitude: lon,
      Sog: over.sog ?? 10,
      Cog: over.cog ?? 90,
      TrueHeading: over.hdg ?? 88
    }
  }
});

{
  const st = createAisState();
  const t0 = 1000;
  ingest(st, FRAME(1, 46.2, 8.9), t0);
  ingest(st, FRAME(1, 46.9, 8.9), t0 + 1); // same cell, newer
  ingest(st, FRAME(1, 47.1, 8.9), t0 + 2); // crosses into 47:8
  ingest(st, FRAME(2, 47.5, 9.5, {classB: true, name: 'DINGHY  '}), t0 + 3); // cell 47:9
  ingest(st, {MessageType: 'ShipStaticData', Message: {}}, t0 + 4); // junk
  const oldCell = st.grid.get(gridKey(46.9, 8.9));
  const newCell = st.grid.get(gridKey(47.1, 8.9));
  check(
    'grid ingest',
    st.ships.size === 2 &&
      st.frames === 5 &&
      oldCell === undefined &&
      newCell &&
      newCell.has(1) &&
      st.ships.get(1).lat === 47.1 &&
      st.ships.get(2).name === 'DINGHY' &&
      st.grid.size === 2,
    `5 frames -> 2 ships (latest-per-MMSI, junk counted not stored); cell migration 46:8 -> 47:8 (old cell deleted); Class B ingested, name trimmed`
  );

  // Query: same geodesy as the /ais route's aisBox, exact
  // boundary inclusion, internals stripped.
  const box = aisBox(47.3, 9.0, 30);
  const hits = query(st, 47.3, 9.0, 30);
  const one = query(st, 47.3, 9.0, 30, 1);
  const none = query(st, 10, 10, 8);
  const edge = query(st, 47.1 - 29.9 / 60, 8.9, 30); // ship 1 near lamax
  check(
    'grid query',
    hits.length === 2 &&
      hits.every(
        (s) =>
          !('gk' in s) &&
          !('t' in s) &&
          s.lat >= box[0][0] &&
          s.lat <= box[1][0]
      ) &&
      one.length === 1 &&
      none.length === 0 &&
      edge.some((s) => s.mmsi === 1),
    `30 nm at 47.3N finds both ships, internals stripped; limit=1 honoured; empty ocean empty; ship at 29.9 of 30 nm north still inside`
  );

  // Prune: ship 1 last heard t0+2, ship 2 at t0+3.
  const n = prune(st, 100, t0 + 103);
  check(
    'prune',
    n === 1 && st.ships.size === 1 && st.ships.has(2) && st.grid.size === 1,
    `at t0+103 with 100 ms max age: ship 1 (heard t0+2, age 101) pruned with its cell, ship 2 (t0+3, age exactly 100) kept`
  );
}

{
  // Frame decoding: WebSocket messages arrive as text OR binary.
  // node's undici delivers binary as Blob by default, whose
  // String() is "[object Blob]" - a silent zero-frames failure
  // mode indistinguishable from a dead key. decodeFrame accepts
  // string/ArrayBuffer/views exactly and THROWS on anything else
  // (counted as badFrames in /health, never swallowed silently).
  const json = '{"MessageType":"PositionReport"}';
  const buf = new TextEncoder().encode(json);
  let threw = null;
  try {
    decodeFrame({});
  } catch (e) {
    threw = String(e);
  }
  check(
    'frame decode',
    decodeFrame(json) === json &&
      decodeFrame(buf.buffer) === json &&
      decodeFrame(buf) === json &&
      threw !== null &&
      threw.includes('undecodable'),
    `string passthrough exact; ArrayBuffer and Uint8Array utf8-decode exact; Blob-like object throws (-> badFrames), never a silent parse of "[object Blob]"`
  );
}

{
  // Blitzortung LZW: a spec-built ENCODER (initial dictionary =
  // single chars, new entry = previous word + first char of
  // current) provides ground truth; the daemon's decoder must
  // invert it exactly - including the KwKwK corner case ("aaaa"),
  // where the decoder meets a code it has not built yet.
  const lzwEncode = (s) => {
    const dict = new Map();
    let g = 256;
    let w = s[0];
    const out = [];
    const emit = (word) =>
      out.push(word.length === 1 ? word : String.fromCharCode(dict.get(word)));
    for (let i = 1; i < s.length; i++) {
      const wc = w + s[i];
      if (dict.has(wc)) w = wc;
      else {
        emit(w);
        dict.set(wc, g++);
        w = s[i];
      }
    }
    emit(w);
    return out.join('');
  };
  const strike =
    '{"time":1783372802970770000,"lat":28.204296,"lon":-81.011173,"alt":0,"pol":0,"sig":[{"sta":1},{"sta":2}]}';
  const kwk = 'aaaaaaaa';
  const mixed = 'ababababab{"lat":1.5,"lat":1.5,"lat":1.5}';
  const ok =
    lzwDecode(lzwEncode(strike)) === strike &&
    lzwDecode(lzwEncode(kwk)) === kwk &&
    lzwDecode(lzwEncode(mixed)) === mixed &&
    lzwEncode(strike).length < strike.length;
  check(
    'Blitzortung LZW',
    ok,
    `round trip exact on a strike frame (${strike.length} -> ${lzwEncode(strike).length} chars), on "aaaaaaaa" (KwKwK) and on repeated JSON`
  );
}

{
  // Strike engine: ns -> ms time base, grid insert, exact
  // haversine radius query with age filter, prune with cell
  // cleanup.
  const st = createStrikeState();
  const now = 1_800_000_000_000;
  const a = ingestStrike(
    st,
    {time: (now - 60e3) * 1e6, lat: 46.6, lon: 8.0},
    now
  );
  ingestStrike(st, {time: (now - 5 * 60e3) * 1e6, lat: 47.4, lon: 8.6}, now);
  ingestStrike(st, {time: (now - 60e3) * 1e6, lat: 50.0, lon: 8.0}, now); // 378 km north
  ingestStrike(st, {lat: 'x'}, now); // junk
  const d2 = haversineKm(46.6, 8.0, 47.4, 8.6);
  const both = queryStrikes(st, 46.6, 8.0, 150, 10 * 60e3, now);
  const near = queryStrikes(st, 46.6, 8.0, 50, 10 * 60e3, now);
  const fresh = queryStrikes(st, 46.6, 8.0, 150, 2 * 60e3, now);
  const pruned = pruneStrikes(st, 4 * 60e3, now);
  check(
    'strike engine',
    a.t === now - 60e3 &&
      st.total === 3 &&
      both.length === 2 &&
      both.some((s) => s.km === Math.round(d2)) &&
      near.length === 1 &&
      near[0].ageMs === 60e3 &&
      fresh.length === 1 &&
      pruned === 1 &&
      st.count === 2,
    `ns -> ms exact; radius 150 km finds 2 of 3 (third at 378 km), the second at its exact haversine ${d2.toFixed(0)} km; 50 km -> 1; 2 min age filter -> 1; prune drops the 5-min-old strike (${pruned})`
  );
}

{
  const ALLOW = ['https://ndevtk.github.io'];
  const site = originCheck('https://ndevtk.github.io', ALLOW);
  const evil = originCheck('https://evil.example', ALLOW);
  const curl = originCheck(undefined, ALLOW);
  check(
    'origin allowlist',
    site.ok &&
      site.acao === 'https://ndevtk.github.io' &&
      !evil.ok &&
      evil.acao === null &&
      curl.ok &&
      curl.acao === null,
    `website origin -> exact CORS echo; foreign origin refused; no Origin passes with NO grant`
  );
}

{
  // Absorbed from the retired worker's gate when the worker was
  // deleted - the normalizers now live in the daemon. readsb
  // strip: seven fields, units untouched, "ground"/incomplete
  // dropped; AIS sentinels (ITU-R M.1371) to 0/null/null; the
  // aisBox geodesy (1 nm latitude = exactly 1/60 deg).
  const ac = normalize({
    ac: [
      {
        hex: 'a',
        flight: 'BAW1 ',
        lat: 1,
        lon: 2,
        alt_baro: 36000,
        gs: 400,
        track: 90,
        ias: 9,
        squawk: 'x'
      },
      {hex: 'b', lat: 1, lon: 2, alt_baro: 'ground', gs: 5, track: 0},
      {hex: 'c', lat: 1, lon: 2, alt_baro: 8000, gs: 100}
    ]
  });
  const ship = normalizeShip(
    {ShipName: 'VERENA  '},
    {
      UserID: 1,
      Latitude: 3,
      Longitude: 4,
      Sog: 102.3,
      Cog: 360,
      TrueHeading: 511
    }
  );
  const box = aisBox(46.62, 8.04, 15);
  check(
    'normalizers (ex-worker)',
    ac.length === 1 &&
      Object.keys(ac[0]).length === 7 &&
      ac[0].flight === 'BAW1' &&
      !('ias' in ac[0]) &&
      ship.sog === 0 &&
      ship.cog === null &&
      ship.hdg === null &&
      ship.name === 'VERENA' &&
      Math.abs(box[1][0] - box[0][0] - 0.5) < 1e-12 &&
      Math.abs((box[0][1] + box[1][1]) / 2 - 8.04) < 1e-12,
    `readsb strip 3 -> 1 with 7 fields; AIS sentinels 102.3/360/511 -> 0/null/null, name trimmed; 15 nm box spans exactly 0.500 deg of latitude, centred`
  );
}

{
  check(
    'security headers',
    SEC_HEADERS['content-security-policy'] === 'sandbox' &&
      SEC_HEADERS['x-content-type-options'] === 'nosniff' &&
      Object.keys(SEC_HEADERS).length === 2,
    `every response carries content-security-policy: sandbox + x-content-type-options: nosniff - a JSON/SSE API that can never be coaxed into rendering as a document`
  );
}

{
  // SSE wire framing: the EventSource spec parses exactly this -
  // an event line, one data line, a blank-line terminator.
  const ev = sseEvent('strike', {km: 12});
  check(
    'SSE framing',
    ev === 'event: strike\ndata: {"km":12}\n\n',
    JSON.stringify(ev) + ' - spec-exact named event'
  );
}

{
  // SSE backpressure: a stalled client is dropped once its socket
  // buffer exceeds SSE_BUFFER_MAX - never at or below it. The
  // budget sits far above any single event (a full 80-ship ais
  // frame is a few KB) and far below what a 1 GB box can afford
  // times SSE_MAX concurrent streams.
  const bigEvent = sseEvent('ais', {
    ships: Array.from({length: 80}, () => ({
      lat: 51.123456,
      lon: 1.123456,
      sog: 12.3,
      cog: 234.5,
      hdg: 234,
      mmsi: 235123456,
      name: 'LONGISH SHIP NAME'
    }))
  }).length;
  check(
    'SSE backpressure',
    overBackpressure(SSE_BUFFER_MAX) === false &&
      overBackpressure(SSE_BUFFER_MAX + 1) === true &&
      overBackpressure(0) === false &&
      overBackpressure(SSE_BUFFER_MAX, 100) === true &&
      SSE_BUFFER_MAX >= 20 * bigEvent &&
      SSE_BUFFER_MAX * 25 <= 64e6,
    `drop strictly above ${SSE_BUFFER_MAX} B; ${Math.floor(SSE_BUFFER_MAX / bigEvent)}x the largest real event (${bigEvent} B); worst case ${((SSE_BUFFER_MAX * 25) / 1e6).toFixed(1)} MB across SSE_MAX streams`
  );
}

{
  const lim = createLimiter(60);
  const t0 = 0;
  let granted = 0;
  for (let i = 0; i < 70; i++) if (lim.take('a', t0)) granted++;
  const otherIp = lim.take('b', t0);
  const afterRefill = lim.take('a', t0 + 2000); // 2 s -> +2 tokens
  const stillDry = lim.take('a', t0 + 2001) && lim.take('a', t0 + 2002);
  check(
    'rate limiter',
    granted === 60 && otherIp && afterRefill && !stillDry && lim.size() === 2,
    `60/min budget: 70 instant requests -> exactly 60 granted; other IP unaffected; 2 s refill grants ~2 more then dry again`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
