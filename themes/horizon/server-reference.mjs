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
  chlorCell,
  chlorUrl,
  createAisState,
  createLimiter,
  createStrikeState,
  decodeFrame,
  gridKey,
  ingest,
  ingestStrike,
  lzwDecode,
  originCheck,
  parseChlor,
  parseNdvi,
  ndviCell,
  ndviDatesUrl,
  ndviUrl,
  ndviDate,
  parseSurface,
  parseSurfaceState,
  surfaceQaClean,
  surfaceDatesUrl,
  surfaceUrl,
  parseRrs,
  rrsCell,
  rrsUrl,
  parseSst,
  sstCell,
  sstUrl,
  SST_HALF_DEG,
  SST_STRIDE,
  decodeL2,
  decodeL2Async,
  l2Cell,
  l2DcompBody,
  l2FileUrl,
  l2HeightBody,
  l2ImageryBody,
  l2ListUrl,
  l2MaskBody,
  l2Prefixes,
  l2Window,
  L2_ASKS,
  L2_AT_MAX_AGE_MS,
  L2_COD_SPEC,
  L2_CPS_SPEC,
  L2_HALF_PX,
  L2_HEIGHT_SPEC,
  L2_HELD_PER_PRODUCT,
  L2_IMAGERY_SPEC,
  L2_LIST_MS,
  L2_MASK_SPEC,
  L2_RETRY_MS,
  L2_HELD_TRIM_MB,
  L2_WINDOW_MS,
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
  sseEvent,
  budgetLeftMs,
  fetchBudgetMs,
  UPSTREAM_BUDGET_MS,
  HOME_DEFAULT,
  parseHome,
  warmUpPaths,
  WARM_UP_TRIES,
  WARM_UP_PAUSE_MS,
  recentAreas,
  restoreCaches,
  rrsPick,
  snapshotCaches,
  STATE_MAX_AGE_MS,
  STATE_SAVE_MS,
  warmUpPlan
} from './server/src/index.mjs';

import {haversineKm} from './lightning.js';
import {dcompCensus, heightCensus, unpackArray, unscale} from './goesl2.js';
import {ACHAC_B64, ACHAC_NAME} from './hdf5-fixture.js';

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

  // Static data (message 5): the measured vessel merged into the
  // query answer - type, length = A+B, beam = C+D, draught in
  // metres (aisstream decodes it), name filling a blank position
  // name. A static frame is not a position (returns false).
  const took = ingest(
    st,
    {
      MessageType: 'ShipStaticData',
      Message: {
        ShipStaticData: {
          UserID: 2,
          Name: 'EVER GIVEN ',
          Type: 70,
          Dimension: {A: 160, B: 80, C: 18, D: 14},
          MaximumStaticDraught: 13.2
        }
      }
    },
    t0 + 5
  );
  const merged = query(st, 47.5, 9.5, 8).find((s) => s.mmsi === 2);
  const bare = query(st, 47.3, 9.0, 30).find((s) => s.mmsi === 1);
  check(
    'static data merge',
    took === false &&
      st.statics.size === 1 &&
      merged &&
      merged.type === 70 &&
      merged.len === 240 &&
      merged.beam === 32 &&
      merged.draught === 13.2 &&
      merged.name === 'DINGHY' &&
      bare &&
      !('len' in bare),
    `message 5 for MMSI 2 -> type 70 cargo, 240 x 32 m draught 13.2 merged into its query row (position name wins); MMSI 1 without statics carries no dimension fields`
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
        t: 'A320',
        category: 'A3',
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
      Object.keys(ac[0]).length === 9 &&
      ac[0].flight === 'BAW1' &&
      ac[0].t === 'A320' &&
      ac[0].cat === 'A3' &&
      !('ias' in ac[0]) &&
      ship.sog === 0 &&
      ship.cog === null &&
      ship.hdg === null &&
      ship.st === 15 &&
      ship.name === 'VERENA' &&
      normalizeShip(
        {},
        {UserID: 2, Latitude: 0, Longitude: 0, Sog: 0, NavigationalStatus: 1}
      ).st === 1 &&
      normalizeShip(
        {},
        {UserID: 3, Latitude: 0, Longitude: 0, Sog: 0, NavigationalStatus: 16}
      ).st === 15 &&
      Math.abs(box[1][0] - box[0][0] - 0.5) < 1e-12 &&
      Math.abs((box[0][1] + box[1][1]) / 2 - 8.04) < 1e-12,
    `readsb strip 3 -> 1 with 9 fields incl. measured type A320 + category A3; AIS sentinels 102.3/360/511 -> 0/null/null, missing/out-of-range NavigationalStatus -> 15 (M.1371's own default), at-anchor 1 kept, name trimmed; 15 nm box spans exactly 0.500 deg of latitude, centred`
  );
}

{
  // Ocean colour (/chlor): the pure pieces held to the LIVE
  // responses recorded when the source was pinned (2026-07-11):
  //   (37.5,-123)  -> cell 37.541664/-122.958336, 0.69309556 mg/m^3
  //   (25,-140)    -> 0.06402797 (oligotrophic gyre low end)
  //   (39,-100)    -> null (land - a real answer, not an error)
  const row = (lat, lon, v) => ({
    table: {
      columnNames: ['time', 'altitude', 'latitude', 'longitude', 'chlor_a'],
      rows: [['2026-07-09T12:00:00Z', 0, lat, lon, v]]
    }
  });
  const sf = chlorCell(37.5, -123.0);
  const idem = chlorCell(sf.lat, sf.lon);
  const nw = chlorCell(90, 180);
  const se = chlorCell(-91, -181); // out-of-range input clamps
  const u = chlorUrl(sf);
  const PIN =
    'https://coastwatch.noaa.gov/erddap/griddap/' +
    'noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a%5B(last)%5D%5B(0.0)%5D';
  const ocean = parseChlor(row(37.541664, -122.958336, 0.69309556));
  const gyre = parseChlor(row(25.041662, -140.04166, 0.06402797));
  const land = parseChlor(row(39.041664, -99.958336, null));
  check(
    'chlorophyll (/chlor)',
    Math.abs(sf.lat - 37.541664) < 3e-6 &&
      Math.abs(sf.lon - -122.958336) < 3e-6 &&
      idem.lat === sf.lat &&
      idem.lon === sf.lon &&
      Math.abs(nw.lat - 89.958333) < 1e-6 &&
      Math.abs(nw.lon - 179.958333) < 1e-6 &&
      Math.abs(se.lat - -89.958333) < 1e-6 &&
      Math.abs(se.lon - -179.958333) < 1e-6 &&
      u === PIN + `%5B(${sf.lat})%5D%5B(${sf.lon})%5D` &&
      ocean.chlor === 0.69309556 &&
      ocean.time === '2026-07-09T12:00:00Z' &&
      gyre.chlor === 0.06402797 &&
      land.chlor === null &&
      land.time === '2026-07-09T12:00:00Z' &&
      parseChlor(row(0, 0, -999.0)).chlor === null &&
      parseChlor(row(0, 0, 101)).chlor === null &&
      parseChlor(row(0, 0, 5e-4)).chlor === null &&
      parseChlor(row(0, 0, '0.5')).chlor === null &&
      parseChlor({}) === null &&
      parseChlor({table: {columnNames: ['time'], rows: [['t']]}}) === null,
    `cell snap matches the live-returned 1/12-deg centres (37.541664/-122.958336) and is idempotent; poles/antimeridian and out-of-range inputs clamp inside the grid; URL pinned to the CoastWatch dataset with the snapped cell only; live ocean 0.693 and gyre 0.064 mg/m^3 parse exact; land null is a real answer; -999 fill, out-of-valid-range and non-numeric -> null; malformed tables -> null (502)`
  );
}

{
  // Land greenness (/ndvi): the pure pieces held to the LIVE ORNL DAAC
  // MOD13Q1 responses recorded when the source was pinned (2026-07-11):
  //   (45,-90) Wisconsin -> 0.6813 at composite A2026145 (2026-05-25)
  //   (23,13)  Sahara    -> 0.096 (bare desert)
  //   -3000 fill / out-of-range -> ndvi null (a real no-measure cell)
  const sub = (raw) => ({
    subset: [
      {
        modis_date: 'A2026145',
        calendar_date: '2026-05-25',
        band: '250m_16_days_NDVI',
        data: [raw]
      }
    ]
  });
  const dates = {
    dates: [
      {modis_date: 'A2026001', calendar_date: '2026-01-01'},
      {modis_date: 'A2026145', calendar_date: '2026-05-25'}
    ]
  };
  const wi = ndviCell(45.0, -90.0);
  const idem = ndviCell(wi.lat, wi.lon);
  const clamp = ndviCell(91, 181);
  const date = ndviDate(dates);
  const u = ndviUrl(wi, date);
  const PIN =
    'https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?latitude=45&longitude=-90' +
    '&startDate=A2026145&endDate=A2026145&band=250m_16_days_NDVI' +
    '&kmAboveBelow=0&kmLeftRight=0';
  const grass = parseNdvi(sub(6813));
  const desert = parseNdvi(sub(960));
  check(
    'land greenness (/ndvi)',
    date === 'A2026145' &&
      ndviDate({dates: []}) === null &&
      ndviDate({}) === null &&
      ndviDate({dates: [{modis_date: 'X'}]}) === null &&
      ndviDatesUrl(wi) ===
        'https://modis.ornl.gov/rst/api/v1/MOD13Q1/dates?latitude=45&longitude=-90' &&
      wi.lat === 45 &&
      wi.lon === -90 &&
      idem.lat === wi.lat &&
      idem.lon === wi.lon &&
      clamp.lat === 90 &&
      clamp.lon === 180 &&
      ndviCell(-91, -181).lat === -90 &&
      u === PIN &&
      Math.abs(grass.ndvi - 0.6813) < 1e-9 &&
      grass.date === '2026-05-25' &&
      Math.abs(desert.ndvi - 0.096) < 1e-9 &&
      parseNdvi(sub(-3000)).ndvi === null &&
      parseNdvi(sub(-2001)).ndvi === null &&
      parseNdvi(sub(10001)).ndvi === null &&
      parseNdvi({subset: []}).ndvi === null &&
      parseNdvi({subset: []}).date === null &&
      parseNdvi(sub('0.5')) === null &&
      parseNdvi({}) === null &&
      parseNdvi({subset: [{data: []}]}) === null,
    `date resolves to the latest composite A2026145; cell snaps to 0.01 deg (45/-90), idempotent, poles/antimeridian clamp inside; /dates + /subset URLs pinned to the ORNL MOD13Q1 service with the snapped cell + date only; live Wisconsin 0.6813 and Sahara 0.096 parse exact; empty subset (ocean/off-land) and -3000 fill / out-of-range -> ndvi null (real no-measure, 200); non-numeric/malformed -> null (502)`
  );
}

{
  // Measured land colour (/surface): the pure pieces held to the LIVE
  // ORNL DAAC MOD09A1 responses recorded when the source was pinned
  // (2026-07-11, composite A2026169 / 2026-06-18): Sahara (23,13)
  // sur_refl_b01 raw 4248 -> 0.4248; the -28672 fill and empty subset
  // -> refl null (real no-measure).
  const band = (raw, b = 'sur_refl_b01') => ({
    subset: [
      {
        modis_date: 'A2026169',
        calendar_date: '2026-06-18',
        band: b,
        data: [raw]
      }
    ]
  });
  const cell = ndviCell(23.0, 13.0);
  const u = surfaceUrl(cell, 'A2026169', 'sur_refl_b01');
  const PIN =
    'https://modis.ornl.gov/rst/api/v1/MOD09A1/subset?latitude=23&longitude=13' +
    '&startDate=A2026169&endDate=A2026169&band=sur_refl_b01&kmAboveBelow=0&kmLeftRight=0';
  const red = parseSurface(band(4248));
  check(
    'surface reflectance (/surface)',
    surfaceDatesUrl(cell) ===
      'https://modis.ornl.gov/rst/api/v1/MOD09A1/dates?latitude=23&longitude=13' &&
      u === PIN &&
      Math.abs(red.refl - 0.4248) < 1e-9 &&
      red.date === '2026-06-18' &&
      Math.abs(parseSurface(band(2460, 'sur_refl_b04')).refl - 0.246) < 1e-9 &&
      parseSurface(band(-28672)).refl === null &&
      parseSurface(band(16001)).refl === null &&
      parseSurface(band(-50)).refl === 0 && // small negative clamps up to 0
      parseSurface({subset: []}).refl === null &&
      parseSurface({subset: []}).date === null &&
      parseSurface(band('x')) === null &&
      parseSurface({}) === null,
    `/dates + /subset URLs pinned to the ORNL MOD09A1 service with the snapped cell + date + band only; live Sahara red 0.4248 and green 0.246 parse exact; -28672 fill and out-of-range -> refl null, small negative clamps to 0; empty subset (ocean) -> null refl (200); non-numeric/malformed -> null (502)`
  );
}

{
  // Surface QA (sur_refl_state_500m): the cloud/cirrus/shadow decode
  // held to the LIVE recorded states (2026-07-11): Amazon 138 (cloud
  // state 10 = mixed) is contaminated and rejected; Sahara/Wisconsin 72
  // (cloud state 00 = clear, land, low aerosol) pass. Bit meanings from
  // the LP DAAC layer table.
  check(
    'surface QA decode',
    surfaceQaClean(72) === true && // clear, land, low aerosol (Sahara/Wisconsin)
      surfaceQaClean(138) === false && // mixed cloud (Amazon) - rejected
      surfaceQaClean(0) === true && // clear
      surfaceQaClean(3) === true && // "not set, assumed clear"
      surfaceQaClean(1) === false && // cloudy (bits 0-1 = 01)
      surfaceQaClean(2) === false && // mixed (bits 0-1 = 10)
      surfaceQaClean(4) === false && // cloud shadow (bit 2)
      surfaceQaClean(3 << 8) === false && // cirrus high (bits 8-9 = 11)
      surfaceQaClean(1 << 10) === false && // internal cloud flag (bit 10)
      surfaceQaClean(null) === false &&
      parseSurfaceState({subset: [{data: [138]}]}) === 138 &&
      parseSurfaceState({subset: []}) === null &&
      parseSurfaceState({}) === null,
    `state 72 (clear/land) clean, 138 (mixed cloud) rejected; cloudy/mixed/shadow/high-cirrus/internal-cloud all rejected; assumed-clear passes; raw state parsed, malformed -> null`
  );
}

{
  // Measured ocean colour (/rrs): the pure pieces held to the LIVE ESA
  // CCI v6.0 response recorded when the source was pinned (2026-07-11):
  // the clear gyre (25N, 140W) at 2025-12-31. A cloud-gap null or the
  // 9.97e36 fill in any band -> {rrs: null} (a real no-measure answer).
  const cols = [
    'time',
    'latitude',
    'longitude',
    'Rrs_412',
    'Rrs_443',
    'Rrs_490',
    'Rrs_510',
    'Rrs_560',
    'Rrs_665'
  ];
  const row = (vals) => ({
    table: {
      columnNames: cols,
      rows: [['2025-12-31T00:00:00Z', 24.979, -139.979, ...vals]]
    }
  });
  const gyre = [
    0.0095712375, 0.008005913, 0.0055653746, 0.0032426326, 0.0012882876,
    1.4774383e-4
  ];
  const cell = rrsCell(25.0, -140.0);
  const idem = rrsCell(cell.lat, cell.lon);
  const u = rrsUrl(cell);
  const idx = `%5B(last)%5D%5B(${cell.lat})%5D%5B(${cell.lon})%5D`;
  const PIN =
    'https://coastwatch.pfeg.noaa.gov/erddap/griddap/pmlEsaCCI60OceanColorDaily.json?' +
    ['Rrs_412', 'Rrs_443', 'Rrs_490', 'Rrs_510', 'Rrs_560', 'Rrs_665']
      .map((v) => v + idx)
      .join(',');
  const parsed = parseRrs(row(gyre));
  const fillRow = row([9.96921e36, ...gyre.slice(1)]);
  const nullRow = row([0.008, null, ...gyre.slice(2)]);
  const negRow = row([-0.001, ...gyre.slice(1)]);
  check(
    'measured ocean colour (/rrs)',
    cell.lat === 25 &&
      cell.lon === -140 &&
      idem.lat === cell.lat &&
      idem.lon === cell.lon &&
      rrsCell(91, 181).lat === 90 &&
      u === PIN &&
      parsed.rrs.length === 6 &&
      Math.abs(parsed.rrs[1] - 0.008005913) < 1e-9 &&
      Math.abs(parsed.rrs[4] - 0.0012882876) < 1e-9 &&
      parsed.time === '2025-12-31T00:00:00Z' &&
      parseRrs(fillRow).rrs === null &&
      parseRrs(nullRow).rrs === null &&
      parseRrs(negRow).rrs[0] === 0 &&
      parseRrs({}) === null &&
      parseRrs({table: {columnNames: ['time'], rows: [['t']]}}) === null,
    `cell snaps to the 1/24-deg grid (25/-140), idempotent, poles/antimeridian clamp; one multi-band ERDDAP URL pinned to the CCI dataset with the snapped cell only; live gyre Rrs_443 0.008006 / Rrs_560 0.001288 parse exact; 9.97e36 fill and null band -> rrs null (no-measure), small negative clamps to 0; malformed/missing column -> null (502)`
  );
}

{
  // The foundation-SST box (/sst, 147th pass): the pure pieces held to
  // the shape of the LIVE MUR response (CoastWatch ERDDAP, read
  // 2026-09-05: a 2-deg box at stride 5 came back as 41 x 41 rows,
  // latitude outer, nulls over land, time 2026-09-04T09:00:00Z).
  const cell = sstCell(32.85, -117.12);
  const idem = sstCell(cell.lat, cell.lon);
  const u = sstUrl(cell);
  const PIN =
    'https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41.json' +
    '?analysed_sst%5B(last)%5D%5B(31.5):5:(34.5)%5D%5B(-118.5):5:(-115.5)%5D';
  const cols = ['time', 'latitude', 'longitude', 'analysed_sst'];
  const rows = [];
  // a 3 x 4 box: land (null) on the east column, one fill value
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 4; j++)
      rows.push([
        '2026-09-04T09:00:00Z',
        32.5 + 0.05 * i,
        -118 + 0.05 * j,
        j === 3 ? null : i === 2 && j === 0 ? -7.768 : 20 + i + 0.1 * j
      ]);
  const g = parseSst({table: {columnNames: cols, rows}});
  const shuffled = parseSst({
    table: {columnNames: cols, rows: [...rows].reverse()}
  });
  check(
    'foundation SST box (/sst)',
    cell.lat === 33 &&
      cell.lon === -117 &&
      idem.lat === cell.lat &&
      idem.lon === cell.lon &&
      sstCell(89.9, 179.9).lat === 88 &&
      sstCell(89.9, 179.9).lon === 178.5 &&
      SST_HALF_DEG === 1.5 &&
      SST_STRIDE === 5 &&
      u === PIN &&
      g &&
      g.nLat === 3 &&
      g.nLon === 4 &&
      g.lat0 === 32.5 &&
      g.lon0 === -118 &&
      Math.abs(g.dLat - 0.05) < 1e-9 &&
      Math.abs(g.dLon - 0.05) < 1e-9 &&
      g.validN === 8 &&
      g.sst[0] === 20 &&
      g.sst[1 * 4 + 2] === 21.2 &&
      g.sst[3] === null &&
      g.sst[2 * 4] === null &&
      g.time === '2026-09-04T09:00:00Z' &&
      shuffled &&
      shuffled.sst[1 * 4 + 2] === 21.2 &&
      parseSst({}) === null &&
      parseSst({table: {columnNames: cols, rows: rows.slice(0, 5)}}) === null,
    `the 0.5-deg cell (33/-117) is idempotent and clamps at 88/178.5 so the +-1.5-deg box stays on the grid; one URL pinned to the MUR dataset at stride 5 with (last); a 3x4 table parses to a row-major grid (lat outer) with land nulls and the -7.768 fill dropped (8 valid), the same grid from the rows reversed; a malformed or ragged table -> null (502)`
  );
}

{
  // NOAA's L2 cloud-product windows (/goesl2, 148th pass): the
  // daemon's decode and window cut run on the vendored GOES-18
  // ACHAC file (hdf5-fixture.js, the file h5py read the same way)
  // and must land on the goesl2 gate's own pinned home window; the
  // packed heights unpack to the same census; the bucket URLs and
  // the hour prefixes are pinned; a file without the grid is
  // refused as null (502), never guessed.
  const bytes = new Uint8Array(Buffer.from(ACHAC_B64, 'base64'));
  const dec = decodeL2(bytes, L2_HEIGHT_SPEC);
  const cell = l2Cell(32.85, -117.12);
  const body = dec ? l2HeightBody(dec, 'k', cell.lat, cell.lon) : null;
  const ht = body ? unpackArray(body.ht) : null;
  const dq = body ? unpackArray(body.dqf) : null;
  const again = ht ? heightCensus(Array.from(ht), Array.from(dq)) : null;
  const w = dec ? l2Window(dec, 32.85, -117.12, 10) : null;
  const outside = dec ? l2Window(dec, 0, -137, 10) : 'not null';
  const noGrid = decodeL2(bytes, {no_such_dataset: 'raw'});
  const maskShape = dec ? l2MaskBody(dec, 'k', cell.lat, cell.lon) : null;
  const pre = l2Prefixes('ABI-L2-ACMC', new Date('2026-09-05T20:02:00Z'));
  check(
    'NOAA cloud-product windows (/goesl2)',
    dec !== null &&
      dec.platform === 'G18' &&
      dec.scene === 'CONUS' &&
      dec.time.startsWith('2026-09-05T18:4') &&
      dec.lzaMaxDeg === 70 &&
      dec.proj.longitude_of_projection_origin === -137 &&
      dec.x.n === 500 &&
      dec.y.n === 300 &&
      dec.data.HT instanceof Float32Array &&
      dec.data.DQF instanceof Uint8Array &&
      cell.lat === 32.9 &&
      cell.lon === -117.1 &&
      body !== null &&
      body.product === 'ABI-L2-ACHAC' &&
      body.key === 'k' &&
      body.box.i === 424 &&
      body.box.j === 127 &&
      body.box.rows === 21 &&
      body.box.cols === 21 &&
      body.pixel.ewM === 11438 &&
      body.pixel.nsM === 13741 &&
      body.ht.kind === 'f32' &&
      body.ht.n === 441 &&
      body.census.n === 340 &&
      Math.abs(body.census.medianM - 3056.6) < 1 &&
      again.n === 340 &&
      again.medianM === body.census.medianM &&
      w !== null &&
      w.box.i === 424 &&
      outside === null &&
      noGrid === null &&
      // the mask's datasets are not in a height file: the decode
      // refuses the spec, and the mask body refuses the height
      // decode (null, never a throw)
      decodeL2(bytes, L2_MASK_SPEC) === null &&
      maskShape === null &&
      L2_HALF_PX.mask === 50 &&
      L2_HALF_PX.height === 10 &&
      L2_LIST_MS === 60e3 &&
      L2_RETRY_MS === 2 * 60e3 &&
      L2_WINDOW_MS === 15 * 60e3 &&
      L2_HELD_PER_PRODUCT === 2 &&
      L2_AT_MAX_AGE_MS === 7 * 86400e3 &&
      l2ListUrl('noaa-goes18', 'ABI-L2-ACMC/2026/248/19/') ===
        'https://noaa-goes18.s3.amazonaws.com/?list-type=2&prefix=ABI-L2-ACMC%2F2026%2F248%2F19%2F&max-keys=1000' &&
      l2FileUrl('noaa-goes19', 'ABI-L2-ACHAC/2026/248/19/x.nc') ===
        'https://noaa-goes19.s3.amazonaws.com/ABI-L2-ACHAC/2026/248/19/x.nc' &&
      pre.length === 2 &&
      pre[0] === 'ABI-L2-ACMC/2026/248/20/' &&
      pre[1] === 'ABI-L2-ACMC/2026/248/19/',
    `the vendored ${ACHAC_NAME} decodes to G18 CONUS at ${dec && dec.time} (LZA bound ${dec && dec.lzaMaxDeg}, 500x300, HT as float32 metres with NaN fill, DQF bytes); the tenth-degree cell (32.9/-117.1) cuts the 21x21 window at pixel (424, 127) - the goesl2 gate's own pin - with ${body && body.census.n} retrieved tops, median ${body && body.census.medianM.toFixed(1)} m, ${body && body.pixel.ewM} x ${body && body.pixel.nsM} m pixels at the slant; the packed heights unpack to the same census; the sub-satellite point is outside the scene (null); a missing dataset -> null (502), and the mask body on a height decode is null, never a throw; the listing and file URLs and the this-hour/last-hour prefixes are pinned; listings stand ${L2_LIST_MS / 1000} s, ${L2_HELD_PER_PRODUCT} decoded files per product, ?t= reaches ${L2_AT_MAX_AGE_MS / 86400e3} days back`
  );
  // The decode worker (the event loop keeps serving while a 4 MB
  // mask inflates): the same bytes through the worker come back as
  // the main thread's decode, typed arrays and all
  const t0 = Date.now();
  const decW = await decodeL2Async(bytes, L2_HEIGHT_SPEC);
  const ms = Date.now() - t0;
  const sum = (a) => {
    let s = 0;
    for (const v of a) if (Number.isFinite(v)) s += v;
    return s;
  };
  check(
    'the decode worker returns the main thread’s decode',
    decW !== null &&
      dec !== null &&
      decW.time === dec.time &&
      decW.platform === dec.platform &&
      decW.x.n === dec.x.n &&
      decW.data.HT instanceof Float32Array &&
      decW.data.DQF instanceof Uint8Array &&
      decW.data.HT.length === dec.data.HT.length &&
      Math.abs(sum(decW.data.HT) - sum(dec.data.HT)) < 1e-3 &&
      sum(decW.data.DQF) === sum(dec.data.DQF) &&
      JSON.stringify(decW.proj) === JSON.stringify(dec.proj),
    `a worker thread imported this module (main() guarded by import.meta.url), decoded the vendored file and posted ${decW && decW.data.HT.length} heights back as Float32Array with the same sum, DQF and projection - in ${ms} ms including the worker's start`
  );
  // The imagery and DCOMP windows (149th pass): the raw16 mode
  // keeps the counts with the file's own scaling (tried on the
  // vendored file's HT: raw uint16, scale 0.3052037, fill 65535,
  // count x scale = the physical height); the imagery and DCOMP
  // bodies are built on a decode dressed as those products (the
  // real files are 4-5 MB each, not vendored) - counts on the wire
  // as u16 with a signed fill mapped to 65535, the page's unscale
  // giving the kelvin back, the censuses by value and phase.
  const raw = decodeL2(bytes, {HT: 'raw16', DQF: 'raw'});
  let q0 = -1; // the first retrieved pixel of the file
  if (raw)
    for (let q = 0; q < raw.data.HT.length; q++)
      if (raw.data.HT[q] !== 65535) {
        q0 = q;
        break;
      }
  const rawOk =
    raw &&
    raw.data.HT instanceof Uint16Array &&
    Math.abs(raw.meta.HT.scale - 0.3052037) < 1e-7 &&
    raw.meta.HT.fill === 65535 &&
    raw.meta.HT.units === 'm' &&
    q0 >= 0 &&
    Math.abs(raw.data.HT[q0] * raw.meta.HT.scale - dec.data.HT[q0]) < 1e-3;
  // a synthetic imagery decode on the fixture's grid: CMI counts
  // from the heights (count = height / 10, so 0..6553 fits the
  // 12-bit range's spirit), fill -1 where HT is fill, DQF 0
  const cmi = new Int16Array(raw.data.HT.length);
  for (let q = 0; q < cmi.length; q++)
    cmi[q] = raw.data.HT[q] === 65535 ? -1 : Math.round(raw.data.HT[q] / 10);
  const imDec = {
    ...raw,
    data: {CMI: cmi, DQF: new Uint8Array(cmi.length)},
    meta: {CMI: {scale: 0.06145332, offset: 89.62, fill: -1, units: 'K'}}
  };
  const im = l2ImageryBody(imDec, 'im', cell.lat, cell.lon);
  const btRaw = im ? unpackArray(im.bt) : null;
  const btK = im
    ? unscale(btRaw, {scale: im.btScale, offset: im.btOffset, fill: im.btFill})
    : null;
  // the first measured pixel of the window, back on the file's grid
  let qw = -1;
  if (btRaw)
    for (let q = 0; q < btRaw.length; q++)
      if (btRaw[q] !== 65535) {
        qw = q;
        break;
      }
  const gq =
    im && qw >= 0
      ? (im.box.j0 + Math.floor(qw / im.box.cols)) * 500 +
        im.box.i0 +
        (qw % im.box.cols)
      : -1;
  // a synthetic DCOMP pair: COD counts = HT counts (0..65530), the
  // flag word marking every 3rd retrieval ice, every 5th thin, a
  // fill where HT is fill; CPS = half the COD count
  const codArr = new Uint16Array(raw.data.HT.length);
  const cpsArr = new Uint16Array(raw.data.HT.length);
  const flags = new Uint16Array(raw.data.HT.length);
  for (let q = 0; q < codArr.length; q++) {
    const h = raw.data.HT[q];
    codArr[q] = h === 65535 ? 65535 : h;
    cpsArr[q] = h === 65535 ? 65535 : Math.floor(h / 2);
    flags[q] = (q % 3 === 0 ? 128 : 0) | (q % 5 === 0 ? 512 : 0);
  }
  const codDec = {
    ...raw,
    data: {COD: codArr, DQF: flags},
    meta: {COD: {scale: 0.00244163, offset: 0, fill: 65535, units: '1'}}
  };
  const cpsDec = {
    ...raw,
    data: {CPS: cpsArr, DQF: flags},
    meta: {CPS: {scale: 0.00244163, offset: 0, fill: 65535, units: 'um'}}
  };
  const dc = l2DcompBody(codDec, cpsDec, 'kc', 'kp', cell.lat, cell.lon);
  const codBack = dc
    ? unscale(unpackArray(dc.cod), {scale: dc.codScale, fill: dc.fill})
    : null;
  const cpsBack = dc
    ? unscale(unpackArray(dc.cps), {scale: dc.cpsScale, fill: dc.fill})
    : null;
  const dqBack = dc ? unpackArray(dc.dqf) : null;
  const dcAgain = dc ? dcompCensus(codBack, cpsBack, dqBack) : null;
  const noCps = l2DcompBody(codDec, null, 'kc', null, cell.lat, cell.lon);
  check(
    'the imagery and DCOMP windows (/goesl2, 149th)',
    rawOk &&
      im !== null &&
      im.product === 'ABI-L2-CMIPC' &&
      im.band === 'C13' &&
      im.bt.kind === 'u16' &&
      im.btFill === 65535 &&
      btRaw.length === im.box.rows * im.box.cols &&
      im.box.i === 424 &&
      im.box.j === 127 &&
      // the fixture's 300x500 grid cut with the 2-km half width:
      // 101 wide, clipped at the scene's top edge to fewer rows
      im.box.cols === 101 &&
      im.box.rows === 101 &&
      Number.isNaN(btK[0]) ===
        (raw.data.HT[im.box.j0 * 500 + im.box.i0] === 65535) &&
      qw >= 0 &&
      Math.abs(
        btK[qw] - (Math.round(raw.data.HT[gq] / 10) * 0.06145332 + 89.62)
      ) < 1e-3 &&
      im.census.good > 0 &&
      im.census.good <= im.census.n &&
      im.census.medianK > 89 &&
      dc !== null &&
      dc.product === 'ABI-L2-CODC' &&
      dc.cpsKey === 'kp' &&
      dc.cod.kind === 'u16' &&
      dc.dqf.kind === 'u16' &&
      dc.census.retrieved > 0 &&
      dc.census.fill + dc.census.clear + dc.census.retrieved === dc.census.n &&
      dc.census.ice.n + dc.census.water.n === dc.census.retrieved &&
      dc.census.thin > 0 &&
      dcAgain.retrieved === dc.census.retrieved &&
      dcAgain.codMedian === dc.census.codMedian &&
      dcAgain.water.reffMedian === dc.census.water.reffMedian &&
      noCps !== null &&
      noCps.cps === null &&
      noCps.census.water.reffN === 0 &&
      L2_ASKS.length === 5 &&
      L2_ASKS.map((a) => a.id).join(',') === 'mask,height,imagery,cod,cps' &&
      L2_ASKS[2].band === 'C13' &&
      L2_IMAGERY_SPEC.CMI === 'raw16' &&
      L2_COD_SPEC.COD === 'raw16' &&
      L2_CPS_SPEC.CPS === 'raw16' &&
      // the CPS file's flags are the COD file's (measured): not held
      L2_CPS_SPEC.DQF === undefined &&
      // the memory guard (held arrays, not resident size) sits well
      // under the service's 512 MB MemoryMax
      L2_HELD_TRIM_MB === 160,
    `raw16 keeps the vendored HT as uint16 counts with scale 0.3052037 and fill 65535 (count x scale = the height); an imagery body dressed on the fixture's grid packs ${btRaw && btRaw.length} counts (u16, fill 65535) that unscale back to kelvin at the home pixel (424, 127), census ${im && im.census.good} good; a DCOMP body with ${dc && dc.census.retrieved} retrievals (${dc && dc.census.water.n} water, ${dc && dc.census.ice.n} ice, ${dc && dc.census.thin} thin) whose census the page recomputes from the wire exactly; without a CPS file the body carries no radii; /goesl2 asks five products, the imagery by band C13`
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

// ---- warm-up on start (142nd pass) -----------------------------
{
  const home = parseHome(HOME_DEFAULT);
  const paths = warmUpPaths(home);
  const custom = parseHome(' 51.5 , -0.13 ');
  const bad = [
    parseHome(''),
    parseHome(undefined),
    parseHome('91,0'),
    parseHome('0,181'),
    parseHome('lat,lon'),
    parseHome('32.85')
  ];
  check(
    'warm-up on start',
    home !== null &&
      home.lat === 32.85 &&
      home.lon === -117.12 &&
      paths.length === 5 &&
      paths[0] === '/sounding?lat=32.85&lon=-117.12' &&
      paths[1] === '/buoy?lat=32.85&lon=-117.12' &&
      paths[2] === '/metar?lat=32.85&lon=-117.12' &&
      paths[3] === '/sst?lat=32.85&lon=-117.12' &&
      paths[4] === '/goesl2?lat=32.85&lon=-117.12' &&
      custom !== null &&
      custom.lat === 51.5 &&
      custom.lon === -0.13 &&
      warmUpPaths(custom)[0] === '/sounding?lat=51.50&lon=-0.13' &&
      bad.every((b) => b === null) &&
      warmUpPaths(null).length === 0 &&
      WARM_UP_TRIES === 3 &&
      WARM_UP_PAUSE_MS === 5000 &&
      // three tries with their pauses fit well inside the hour the
      // sounding cache lives, and inside a deploy's first minute
      WARM_UP_TRIES * (UPSTREAM_BUDGET_MS + 5000) +
        (WARM_UP_TRIES - 1) * WARM_UP_PAUSE_MS <
        120e3,
    `a fresh process warms the home area's slow routes right after it listens (measured in a smoke run: a cold /sounding spends its budget on the station list plus one slow Wyoming answer and fails once - 502 in 20.5 s - then answers in 16 s with the list cached): HORIZON_HOME=lat,lon or the theme's default ${HOME_DEFAULT} -> ${paths.join(', ')}, each up to ${WARM_UP_TRIES} tries ${WARM_UP_PAUSE_MS / 1000} s apart, stopping at the first 200; a malformed or out-of-range home warms nothing (${bad.length} bad forms refused)`
  );
}

// ---- upstream time budget --------------------------------------
{
  const t0 = 1_000_000;
  const dl = t0 + UPSTREAM_BUDGET_MS;
  const full = fetchBudgetMs(dl, t0, 20000);
  const mid = fetchBudgetMs(dl, t0 + 20000, 20000);
  const spent = budgetLeftMs(dl, dl);
  const past = budgetLeftMs(dl, dl + 5000);
  const mono =
    budgetLeftMs(dl, t0) > budgetLeftMs(dl, t0 + 1) &&
    budgetLeftMs(dl, t0 + 1) > budgetLeftMs(dl, t0 + 2);
  check(
    'upstream time budget',
    UPSTREAM_BUDGET_MS === 25000 &&
      UPSTREAM_BUDGET_MS < 30000 &&
      full === 20000 &&
      mid === 5000 &&
      spent === 0 &&
      past === 0 &&
      mono,
    `one ${UPSTREAM_BUDGET_MS / 1000} s deadline per multi-fetch ` +
      `handler (under the tightest common edge origin timeout with ` +
      `margin - the measured /sounding and /buoy cold walks could ` +
      `run minutes and surface as the EDGE's 502): a fetch takes ` +
      `min(cap, remaining) - ${full / 1000} s when fresh, ` +
      `${mid / 1000} s with 5 s left - remaining decreases ` +
      `monotonically and clamps to 0 at and past the deadline, ` +
      `where the handlers fall to the stale cache or fail fast as ` +
      `their own json`
  );
}

{
  // Cache persistence across restarts (144th pass): a snapshot of
  // named Maps of {t, body} rows and named singles round-trips
  // through JSON; a restore drops rows older than the age limit
  // (and rows stamped in the future), never overwrites a fresher
  // row already fetched, and the warm-up plan then covers the home
  // first and the snapshot's most recently served areas after it.
  const now = 1_700_000_000_000;
  const rows = new Map([
    ['33,-117', {t: now - 60e3, body: {a: 1}}],
    ['34,-120', {t: now - 3600e3, body: {b: 2}}],
    ['51,0', {t: now - 2 * STATE_MAX_AGE_MS, body: {old: true}}],
    ['bad', 'not a row']
  ]);
  let single = {t: now - 5000, body: 'tles'};
  const reg = {
    maps: {
      sounding: rows,
      metar: new Map([['32.9/-117.1', {t: now - 10e3, body: {}}]])
    },
    singles: {
      tles: {get: () => single, set: (v) => (single = v)},
      empty: {get: () => ({t: 0, body: null}), set: () => {}}
    }
  };
  const snap = JSON.parse(JSON.stringify(snapshotCaches(reg, now)));
  const back = new Map([['33,-117', {t: now + 1, body: {fresher: true}}]]);
  let single2 = {t: 0, body: null};
  const reg2 = {
    maps: {sounding: back, metar: new Map()},
    singles: {tles: {get: () => single2, set: (v) => (single2 = v)}}
  };
  const c = restoreCaches(snap, reg2, now);
  const areas = recentAreas(snap, {lat: 32.85, lon: -117.12}, 6, now);
  const plan = warmUpPlan({lat: 32.85, lon: -117.12}, areas);
  check(
    'cache persistence across restarts',
    snap.savedAt === now &&
      snap.maps.sounding.length === 3 &&
      snap.singles.tles.body === 'tles' &&
      snap.singles.empty === undefined &&
      c.maps === 2 &&
      c.singles === 1 &&
      c.dropped === 1 &&
      back.get('33,-117').body.fresher === true &&
      back.get('34,-120').body.b === 2 &&
      !back.has('51,0') &&
      single2.body === 'tles' &&
      restoreCaches(null, reg2, now).maps === 0 &&
      areas.length === 1 &&
      areas[0].lat === 34 &&
      areas[0].lon === -120 &&
      plan.length === 10 &&
      plan[0] === '/sounding?lat=32.85&lon=-117.12' &&
      plan[3] === '/sst?lat=32.85&lon=-117.12' &&
      plan[4] === '/goesl2?lat=32.85&lon=-117.12' &&
      plan[5] === '/sounding?lat=34.00&lon=-120.00' &&
      STATE_SAVE_MS === 5 * 60e3 &&
      STATE_MAX_AGE_MS === 24 * 3600e3,
    `${snap.maps.sounding.length} rows and 1 feed snapshotted (the empty feed and the ` +
      `malformed row skipped); restored ${c.maps} rows + ${c.singles} feed, ${c.dropped} stale ` +
      `dropped, the fresher row already in RAM kept; the snapshot names ${areas.length} recent ` +
      `area beside the home (the home's own area and the tenth-degree metar key of the same ` +
      `area fold in), so the warm-up plan runs ${plan.length} paths, home first`
  );
  // The ocean-colour pick: the daily's measurement wins, the 8-day
  // composite fills its cloud gaps, a real no-measure answer beats
  // nothing, and the composite URL is the daily's over its own
  // dataset.
  const d0 = {rrs: null, product: 'daily'};
  const c1 = {rrs: [1, 2, 3, 4, 5, 6], product: '8day'};
  check(
    'ocean colour: composite fills the daily gap (/rrs)',
    rrsPick({rrs: [1, 1, 1, 1, 1, 1], product: 'daily'}, c1).product ===
      'daily' &&
      rrsPick(d0, c1).product === '8day' &&
      rrsPick(d0, null) === d0 &&
      rrsPick(null, {rrs: null, product: '8day'}).product === '8day' &&
      rrsPick(null, null) === null &&
      rrsUrl(rrsCell(25, -140), '8day').startsWith(
        'https://coastwatch.pfeg.noaa.gov/erddap/griddap/pmlEsaCCI60OceanColor8Day.json?Rrs_412'
      ) &&
      rrsUrl(rrsCell(25, -140), 'nonsense') === rrsUrl(rrsCell(25, -140)),
    `daily with data wins; a daily cloud gap takes the 8-day composite; a lone null is still ` +
      `a real answer; the composite asks the 8-day dataset for the same six bands (a six-band ` +
      `point query measured at 17.7 s on 2026-09-05 - the old 15-s timeout failed every call)`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
