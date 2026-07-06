// Reference printer for the horizon-live daemon (node
// server-reference.mjs). The daemon (server/src/index.mjs) is the
// worker's successor on a dedicated-IP box; its schema
// normalizers are IMPORTED from the worker source (the model
// lives once, and stays gated by worker-reference.mjs). This set
// gates the daemon's own pure pieces:
//  - the AIS engine: ingest into the 1-degree spatial grid with
//    latest-per-MMSI, cell migration when a ship crosses a grid
//    boundary (old cell emptied AND deleted), Class B frames on
//    the same path, junk frames counted but not ingested
//  - query: the same aisBox geodesy as the worker, exact boundary
//    inclusion, internal fields stripped, limit honoured
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
  decodeFrame,
  gridKey,
  ingest,
  originCheck,
  prune,
  query
} from './server/src/index.mjs';
import {aisBox} from './worker/src/index.js';

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

  // Query: same geodesy as the worker's aisBox, exact boundary
  // inclusion, internals stripped.
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
