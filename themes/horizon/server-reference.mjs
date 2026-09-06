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
import {readFileSync} from 'node:fs';
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
  decodeL2Vectors,
  decodeL2Window,
  l2Cell,
  l2DcompBody,
  l2DmwBody,
  L2_DMW_HEAD_BYTES,
  L2_DMW_RADIUS_KM,
  l2FileUrl,
  l2HeightBody,
  l2ImageryBody,
  l2ListUrl,
  l2MaskBody,
  l2Prefixes,
  l2DsrBody,
  l2AodBody,
  l2LstBody,
  l2SstBody,
  l2Window,
  L2_AOD_BOX_R,
  L2_AOD_EXTRAS,
  L2_AOD_SPEC,
  L2_LST_SPEC,
  L2_LST_EXTRAS,
  L2_LST_NEAR_PX,
  L2_ASKS,
  L2_AT_MAX_AGE_MS,
  L2_COD_SPEC,
  L2_CPS_SPEC,
  L2_HALF_PX,
  L2_HEAD_BYTES,
  L2_HEIGHT_SPEC,
  L2_HELD_WINDOWS,
  L2_IMAGERY_SPEC,
  L2_LIST_MS,
  L2_MASK_SPEC,
  L2_RANGE_BLOCK,
  L2_RETRY_MS,
  L2_DSR_SPEC,
  L2_SST_SPEC,
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
  parseVersion,
  parseUpdateStatus,
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
import {
  aodBoxEstimate,
  aodCensus,
  boxMean,
  dcompCensus,
  dmwLayers,
  dmwUnpack,
  fieldCensus,
  goodCensus,
  heightCensus,
  lstPqi,
  nearestGood,
  qualityCensus,
  unpackArray,
  unscale
} from './goesl2.js';
import {openHdf5, openHdf5Lazy} from './hdf5.js';
import {inflateSync} from 'node:zlib';
import {
  ACHAC_B64,
  ACHAC_NAME,
  DMWC_B64,
  DMWC_EXPECT,
  DMWC_NAME
} from './hdf5-fixture.js';

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
      L2_HELD_WINDOWS === 12 &&
      L2_AT_MAX_AGE_MS === 7 * 86400e3 &&
      l2ListUrl('noaa-goes18', 'ABI-L2-ACMC/2026/248/19/') ===
        'https://noaa-goes18.s3.amazonaws.com/?list-type=2&prefix=ABI-L2-ACMC%2F2026%2F248%2F19%2F&max-keys=1000' &&
      l2FileUrl('noaa-goes19', 'ABI-L2-ACHAC/2026/248/19/x.nc') ===
        'https://noaa-goes19.s3.amazonaws.com/ABI-L2-ACHAC/2026/248/19/x.nc' &&
      // this hour, the last, and the one before (the hourly SST lands
      // 63 min after its hour, measured 155th)
      pre.length === 3 &&
      pre[0] === 'ABI-L2-ACMC/2026/248/20/' &&
      pre[1] === 'ABI-L2-ACMC/2026/248/19/' &&
      pre[2] === 'ABI-L2-ACMC/2026/248/18/',
    `the vendored ${ACHAC_NAME} decodes to G18 CONUS at ${dec && dec.time} (LZA bound ${dec && dec.lzaMaxDeg}, 500x300, HT as float32 metres with NaN fill, DQF bytes); the tenth-degree cell (32.9/-117.1) cuts the 21x21 window at pixel (424, 127) - the goesl2 gate's own pin - with ${body && body.census.n} retrieved tops, median ${body && body.census.medianM.toFixed(1)} m, ${body && body.pixel.ewM} x ${body && body.pixel.nsM} m pixels at the slant; the packed heights unpack to the same census; the sub-satellite point is outside the scene (null); a missing dataset -> null (502), and the mask body on a height decode is null, never a throw; the listing and file URLs and the three hourly prefixes (this hour, last, the one before - the hourly SST lands 63 min after its hour) are pinned; listings stand ${L2_LIST_MS / 1000} s, ${L2_HELD_WINDOWS} decoded windows per product, ?t= reaches ${L2_AT_MAX_AGE_MS / 86400e3} days back`
  );
  // THE WINDOW READ IN PLACE (151st pass): the daemon's decode reads
  // the vendored file by ranges - a counting readRange over the
  // same bytes, the daemon's own block and head sizes - and the
  // window it returns is the whole-file decode's cut, pixel for
  // pixel; an outside point reads nothing past the frame; a
  // whole-buffer handle gives the same through the same code.
  const inflate = (u8) =>
    new Uint8Array(
      inflateSync(Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength))
    );
  const reads = [];
  const readRange = async (s, e) => {
    reads.push([s, Math.min(e, bytes.length)]);
    return bytes.subarray(s, Math.min(e, bytes.length));
  };
  const t0 = Date.now();
  const lazy = await openHdf5Lazy(readRange, inflate, {
    blockBytes: L2_RANGE_BLOCK,
    headBytes: L2_HEAD_BYTES
  });
  const decR = await decodeL2Window(
    lazy,
    L2_HEIGHT_SPEC,
    cell.lat,
    cell.lon,
    10
  );
  const ms = Date.now() - t0;
  const bodyR = decR ? l2HeightBody(decR, 'k', cell.lat, cell.lon) : null;
  const same = (a, b) =>
    a.length === b.length &&
    Array.from(a).every(
      (v, i) => v === b[i] || (Number.isNaN(v) && Number.isNaN(b[i]))
    );
  const readsBefore = reads.length;
  const outsideR = await decodeL2Window(lazy, L2_HEIGHT_SPEC, 0, -137, 10);
  const wholeR = await decodeL2Window(
    openHdf5(bytes, inflate),
    L2_HEIGHT_SPEC,
    cell.lat,
    cell.lon,
    10
  );
  check(
    'THE WINDOW READ IN PLACE: ranges of the file give the whole decode’s window',
    decR !== null &&
      w !== null &&
      decR.time === dec.time &&
      decR.platform === 'G18' &&
      decR.lzaMaxDeg === 70 &&
      decR.x.n === 500 &&
      decR.y.n === 300 &&
      decR.box.i === 424 &&
      decR.box.j === 127 &&
      decR.box.rows === 21 &&
      decR.box.cols === 21 &&
      decR.data.HT instanceof Float32Array &&
      decR.data.HT.length === 441 &&
      same(decR.data.HT, w.cut.HT) &&
      same(decR.data.DQF, w.cut.DQF) &&
      bodyR !== null &&
      bodyR.census.n === body.census.n &&
      bodyR.census.medianM === body.census.medianM &&
      bodyR.pixel.ewM === body.pixel.ewM &&
      bodyR.box.i0 === body.box.i0 &&
      // the reads: the head, then the chunk index and the chunks of
      // the one strip the window lies in - whole blocks, merged
      lazy.stats.rounds === 3 &&
      lazy.stats.ranges === 3 &&
      lazy.stats.bytes === bytes.length &&
      reads[0][0] === 0 &&
      reads[0][1] === L2_HEAD_BYTES &&
      L2_RANGE_BLOCK === 65536 &&
      L2_HEAD_BYTES === 262144 &&
      outsideR !== null &&
      outsideR.box === null &&
      outsideR.data === null &&
      l2HeightBody(outsideR, 'k', 0, -137) === null &&
      reads.length === readsBefore &&
      wholeR !== null &&
      same(wholeR.data.HT, decR.data.HT) &&
      wholeR.box.i === 424,
    `the vendored ${ACHAC_NAME} read by ${lazy.stats.ranges} ranges in ${lazy.stats.rounds} rounds (${lazy.stats.bytes} of its ${bytes.length} bytes: the ${L2_HEAD_BYTES}-byte head, then the strip the home window lies in) gives the 21x21 home window at (424, 127) pixel for pixel - ${bodyR && bodyR.census.n} tops, median ${bodyR && bodyR.census.medianM.toFixed(1)} m - in ${ms} ms; the sub-satellite point answers box null with nothing more read; a whole-buffer handle through the same decode agrees`
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
  // a synthetic SST decode on the fixture's grid (151st): counts =
  // the HT counts (0.00244163 K each from 180 K), DQF 0 where
  // retrieved, every 7th retrieved pixel degraded (1), 3 where fill
  const sstArr = new Uint16Array(raw.data.HT.length);
  const sstDqf = new Uint8Array(raw.data.HT.length);
  let kept = 0;
  for (let q = 0; q < sstArr.length; q++) {
    const h = raw.data.HT[q];
    sstArr[q] = h;
    if (h === 65535) sstDqf[q] = 3;
    else sstDqf[q] = ++kept % 7 === 0 ? 1 : 0;
  }
  const sstDec = {
    ...raw,
    data: {SST: sstArr, DQF: sstDqf},
    meta: {SST: {scale: 0.00244163, offset: 180, fill: 65535, units: 'K'}}
  };
  const ss = l2SstBody(sstDec, 'ks', cell.lat, cell.lon);
  const ssBack = ss
    ? unscale(unpackArray(ss.sst), {
        scale: ss.sstScale,
        offset: ss.sstOffset,
        fill: ss.sstFill
      })
    : null;
  const ssDq = ss ? unpackArray(ss.dqf) : null;
  const ssAgain = ss ? goodCensus(ssBack, ssDq) : null;
  let ssDegraded = 0;
  if (ssDq) for (const v of ssDq) if (v === 1) ssDegraded++;
  // a synthetic DSR decode on the fixture's grid (152nd): counts =
  // the HT counts at 0.02289 W/m2 a count (0..1500 W/m2 spans the
  // 16 bits the way the product's own scale does), DQF 0 where
  // retrieved, 1 where fill
  const dsrArr = new Uint16Array(raw.data.HT.length);
  const dsrDqf = new Uint8Array(raw.data.HT.length);
  for (let q = 0; q < dsrArr.length; q++) {
    const h = raw.data.HT[q];
    dsrArr[q] = h;
    dsrDqf[q] = h === 65535 ? 1 : 0;
  }
  const dsrDec = {
    ...raw,
    data: {DSR: dsrArr, DQF: dsrDqf},
    meta: {DSR: {scale: 0.022890279, offset: 0, fill: 65535, units: 'W m-2'}}
  };
  const dsBody = l2DsrBody(dsrDec, 'kd', cell.lat, cell.lon);
  const dsBack = dsBody
    ? unscale(unpackArray(dsBody.dsr), {
        scale: dsBody.dsrScale,
        offset: dsBody.dsrOffset,
        fill: dsBody.dsrFill
      })
    : null;
  const dsDq = dsBody ? unpackArray(dsBody.dqf) : null;
  const dsAgain = dsBody ? fieldCensus(dsBack, dsDq) : null;
  const dsNear = dsBody ? boxMean(dsBack, dsDq, dsBody.box, 5) : null;
  // the home pixel (424, 127) on the file's own grid
  const homeCount = raw.data.HT[127 * 500 + 424];
  const homeWm2 =
    homeCount === 65535 ? null : +(homeCount * 0.022890279).toFixed(1);
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
      // the SST body (151st): the census over DQF 0 with the
      // degraded count beside it, recomputed from the wire exactly
      ss !== null &&
      ss.product === 'ABI-L2-SSTF' &&
      ss.sst.kind === 'u16' &&
      ss.sstOffset === 180 &&
      ss.sstFill === 65535 &&
      ss.box.i === 424 &&
      ss.box.rows === 101 &&
      ss.census.good > 0 &&
      ss.census.degraded > 0 &&
      ss.census.good + ss.census.degraded <= ss.census.n &&
      ss.census.minK >= 180 &&
      ssAgain.good === ss.census.good &&
      ssAgain.medianK === ss.census.medianK &&
      ssDegraded === ss.census.degraded &&
      L2_SST_SPEC.SST === 'raw16' &&
      L2_SST_SPEC.DQF === 'raw' &&
      L2_HALF_PX.sst === 50 &&
      // the DSR body (152nd): the point's pixel, the ATBD's spatial
      // mean within 5 px, the census in W/m2 - recomputed from the
      // wire exactly
      dsBody !== null &&
      dsBody.product === 'ABI-L2-DSRF' &&
      dsBody.units === 'W m-2' &&
      dsBody.dsr.kind === 'u16' &&
      dsBody.dsrFill === 65535 &&
      dsBody.box.i === 424 &&
      dsBody.box.cols === 101 &&
      dsBody.here === homeWm2 &&
      dsBody.near.r === 5 &&
      dsBody.near.n === dsNear.n &&
      dsBody.near.n > 0 &&
      Math.abs(dsBody.near.mean - dsNear.mean) < 0.06 &&
      dsBody.census.good === dsAgain.good &&
      dsBody.census.median === dsAgain.median &&
      dsBody.census.good + (dsBody.census.n - dsBody.census.good) ===
        dsBody.census.n &&
      L2_DSR_SPEC.DSR === 'raw16' &&
      L2_DSR_SPEC.DQF === 'raw' &&
      L2_HALF_PX.dsr === 50 &&
      L2_ASKS.length === 19 &&
      L2_ASKS.map((a) => a.id).join(',') ===
        'mask,height,imagery,cod,cps,sst,dsr,dmw,aod,lst,vis,phase,fire,tpw,rain,adp,lvt,lvm,dsi' &&
      L2_ASKS[2].band === 'C13' &&
      L2_ASKS.map((a) => a.halfPx ?? '-').join(',') ===
        '50,10,50,50,50,50,50,-,50,50,200,50,50,10,50,50,1,1,1' &&
      // the hourly full-disk SST is never asked for a mosaic's
      // minute, nor are the winds (the decks' drift, not a mosaic's
      // comparison), the haze (the channel's now), the hourly land
      // skin (the land layer's now) or the visible window (the decks'
      // now); the 10-minute DSR is (a file within 15 min of any)
      L2_ASKS[5].timed === false &&
      L2_ASKS[7].timed === false &&
      L2_ASKS[8].timed === false &&
      L2_ASKS[9].timed === false &&
      L2_ASKS[10].timed === false &&
      // the cloud top phase (161st): the optics' now, never a
      // mosaic's minute
      L2_ASKS[11].id === 'phase' &&
      L2_ASKS[11].product === 'ABI-L2-ACTPC' &&
      L2_ASKS[11].timed === false &&
      L2_ASKS[11].pageOnly === undefined &&
      // the fire's heat (162nd): the hot spots burning now
      L2_ASKS[12].id === 'fire' &&
      L2_ASKS[12].product === 'ABI-L2-FDCC' &&
      L2_ASKS[12].timed === false &&
      // the column's water (163rd): the clear-sky reference's now
      L2_ASKS[13].id === 'tpw' &&
      L2_ASKS[13].product === 'ABI-L2-TPWC' &&
      L2_ASKS[13].halfPx === 10 &&
      L2_ASKS[13].timed === false &&
      // the rain (164th): the rate falling now, the full disk's
      // 10-minute file
      L2_ASKS[14].id === 'rain' &&
      L2_ASKS[14].product === 'ABI-L2-RRQPEF' &&
      L2_ASKS[14].halfPx === 50 &&
      L2_ASKS[14].timed === false &&
      // the haze's kind (169th): the daytime smoke and dust flags,
      // the scene's now
      L2_ASKS[15].id === 'adp' &&
      L2_ASKS[15].product === 'ABI-L2-ADPC' &&
      L2_ASKS[15].halfPx === 50 &&
      L2_ASKS[15].timed === false &&
      L2_ASKS[15].pageOnly === undefined &&
      // the column from orbit (171st): the two profile files as
      // column asks - every level of a 3 x 3 window of 10-km fields
      L2_ASKS[16].id === 'lvt' &&
      L2_ASKS[16].product === 'ABI-L2-LVTPC' &&
      L2_ASKS[16].kind === 'column' &&
      L2_ASKS[16].halfPx === 1 &&
      L2_ASKS[16].timed === false &&
      L2_ASKS[17].id === 'lvm' &&
      L2_ASKS[17].product === 'ABI-L2-LVMPC' &&
      L2_ASKS[17].kind === 'column' &&
      L2_ASKS[17].spec.LVM === 'column16' &&
      L2_ASKS[17].timed === false &&
      // the tower's ceiling (172nd): the stability indices of the same
      // retrieval, a window ask on the profiles' 10-km grid
      L2_ASKS[18].id === 'dsi' &&
      L2_ASKS[18].product === 'ABI-L2-DSIC' &&
      L2_ASKS[18].kind === undefined &&
      L2_ASKS[18].spec.CAPE === 'raw16' &&
      L2_ASKS[18].spec.DQF_Overall === 'raw' &&
      L2_ASKS[18].halfPx === 1 &&
      L2_ASKS[18].timed === false &&
      L2_ASKS[18].pageOnly === undefined &&
      L2_ASKS.filter((a) => a.timed === false).length === 13 &&
      // the eleventh ask (159th) is the page's own: the daemon never
      // lists, fetches or serves the 500-m visible window (a 2.6 MB
      // read every five minutes by day, a 430 kB body - the free
      // tier's egress cannot carry it; the bucket's CORS can)
      L2_ASKS[10].pageOnly === true &&
      L2_ASKS[10].band === 'C02' &&
      L2_ASKS[10].product === 'ABI-L2-CMIPC' &&
      L2_ASKS.filter((a) => !a.pageOnly).length === 18 &&
      L2_ASKS.filter((a) => a.pageOnly).length === 1 &&
      L2_IMAGERY_SPEC.CMI === 'raw16' &&
      L2_COD_SPEC.COD === 'raw16' &&
      L2_CPS_SPEC.CPS === 'raw16' &&
      // the CPS file's flags are the COD file's (measured): not held
      L2_CPS_SPEC.DQF === undefined,
    `raw16 keeps the vendored HT as uint16 counts with scale 0.3052037 and fill 65535 (count x scale = the height); an imagery body dressed on the fixture's grid packs ${btRaw && btRaw.length} counts (u16, fill 65535) that unscale back to kelvin at the home pixel (424, 127), census ${im && im.census.good} good; a DCOMP body with ${dc && dc.census.retrieved} retrievals (${dc && dc.census.water.n} water, ${dc && dc.census.ice.n} ice, ${dc && dc.census.thin} thin) whose census the page recomputes from the wire exactly; without a CPS file the body carries no radii; an SST body dressed the same way censuses ${ss && ss.census.good} good px (${ss && ss.census.degraded} degraded beside them) from 180 K counts, recomputed from the wire exactly; a DSR body dressed the same way (152nd) carries the home pixel (${dsBody && dsBody.here} W/m2 from the fixture's count there), the mean of ${dsBody && dsBody.near.n} good px within 5 px (${dsBody && dsBody.near.mean} W/m2) and a census of ${dsBody && dsBody.census.good} good px, all recomputed from the wire; /goesl2 asks eighteen products, the imagery by band C13, the hourly SST, the winds, the haze, the hourly land skin, the cloud top phase, the fire hot spots, the column's water, the rain, the aerosol detection, the two profile columns and the stability indices never for a mosaic's minute and the 10-minute DSR for one; the eleventh ask, the page's own 500-m visible window (band C02 at half width 200), the daemon never lists or serves`
  );
}

{
  // THE MEASURED HAZE (156th pass): an AOD body dressed on the
  // fixture's grid - counts = the HT counts (0..65530 spans -0.05..5
  // at 7.706e-5 a count, the product's own scale), DQF by a pattern
  // over the retrieved pixels (every 5th low, every 3rd of the rest
  // medium, the others high; no retrieval where HT is fill) - its
  // census, the point's own pixel, the plain 50-km box mean and the
  // ATBD's collocation estimator recomputed from the wire; the
  // extras (the file's own scalar datasets) read whole and by range
  // without a further range; the ninth ask's pins.
  const bytes = new Uint8Array(Buffer.from(ACHAC_B64, 'base64'));
  const extras = [
    'mean_cloud_top_height',
    'cloud_pixels',
    'solar_zenith_angle_bounds',
    'no_such_dataset'
  ];
  const raw = decodeL2(bytes, {HT: 'raw16', DQF: 'raw'}, undefined, extras);
  const cell = l2Cell(32.85, -117.12);
  const aodArr = new Uint16Array(raw.data.HT.length);
  const aodDqf = new Uint8Array(raw.data.HT.length);
  let kept = 0;
  for (let q = 0; q < aodArr.length; q++) {
    const h = raw.data.HT[q];
    aodArr[q] = h === 65535 ? 65535 : Math.min(h, 65530);
    if (h === 65535) aodDqf[q] = 3;
    else {
      kept++;
      aodDqf[q] = kept % 5 === 0 ? 2 : kept % 3 === 0 ? 1 : 0;
    }
  }
  const aodDec = {
    ...raw,
    data: {AOD: aodArr, DQF: aodDqf},
    meta: {AOD: {scale: 7.706e-5, offset: -0.05, fill: 65535, units: '1'}},
    extras: {
      mean_aod550_land: 0.0461,
      std_dev_aod550_land: 0.0517,
      mean_aod550_water: 0.0614,
      std_dev_aod550_water: 0.0344,
      aod550_retrievals_attempted_land: 274782,
      aod550_retrievals_attempted_water: 1151286,
      quantitative_solar_zenith_angle_bounds: [0, 78.5],
      sunglint_angle_bounds: [0, 36]
    }
  };
  const body = l2AodBody(aodDec, 'ka', cell.lat, cell.lon);
  const back = body
    ? unscale(unpackArray(body.aod), {
        scale: body.aodScale,
        offset: body.aodOffset,
        fill: body.aodFill
      })
    : null;
  const dq = body ? unpackArray(body.dqf) : null;
  const again = body ? aodCensus(back, dq) : null;
  const estAgain = body
    ? aodBoxEstimate(back, dq, body.box, L2_AOD_BOX_R)
    : null;
  const nearAgain = body ? boxMean(back, dq, body.box, L2_AOD_BOX_R) : null;
  // the home pixel (424, 127) on the file's own grid
  const gq = 127 * 500 + 424;
  const homeTau =
    raw.data.HT[gq] === 65535
      ? null
      : Math.min(raw.data.HT[gq], 65530) * 7.706e-5 - 0.05;
  const homeDqf = aodDqf[gq];
  // the extras by range: the lazy handle over the same bytes, the
  // reads counted with and without them
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const inflateHere = (u8) =>
    new Uint8Array(
      inflateSync(Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength))
    );
  const lazyReads = async (ex) => {
    const reads = [];
    const f = await openHdf5Lazy(
      async (s, e) => {
        reads.push([s, e]);
        return bytes.subarray(s, Math.min(e, bytes.length));
      },
      inflateHere,
      {blockBytes: L2_RANGE_BLOCK, headBytes: L2_HEAD_BYTES}
    );
    const win = await decodeL2Window(
      f,
      {HT: 'raw16', DQF: 'raw'},
      cell.lat,
      cell.lon,
      L2_HALF_PX.height,
      ex
    );
    return {win, reads: reads.length};
  };
  const plain = await lazyReads(null);
  const withEx = await lazyReads(extras);
  const ask = L2_ASKS[8];
  check(
    'THE MEASURED HAZE: the AOD body dressed on the fixture, recomputed from the wire; the extras without a further range',
    body !== null &&
      body.product === 'ABI-L2-AODC' &&
      body.wavelengthNm === 550 &&
      body.aod.kind === 'u16' &&
      body.aodFill === 65535 &&
      near(body.aodScale, 7.706e-5, 1e-12) &&
      body.aodOffset === -0.05 &&
      body.box.i === 424 &&
      body.box.j === 127 &&
      body.box.cols === 101 &&
      body.census.n === body.box.rows * body.box.cols &&
      body.census.high +
        body.census.medium +
        body.census.low +
        body.census.none +
        body.census.fill ===
        body.census.n &&
      body.census.high > 0 &&
      body.census.medium > 0 &&
      body.census.low > 0 &&
      body.census.none > 0 &&
      body.census.fill === 0 &&
      body.census.min >= -0.05 &&
      body.census.max <= 5 &&
      JSON.stringify(again) === JSON.stringify(body.census) &&
      body.here ===
        (homeDqf <= 1 && homeTau !== null ? +homeTau.toFixed(4) : null) &&
      body.hereDqf === homeDqf &&
      body.near.r === L2_AOD_BOX_R &&
      body.near.n === nearAgain.n &&
      body.near.n > 0 &&
      Math.abs(body.near.mean - nearAgain.mean) < 6e-5 &&
      body.est.r === L2_AOD_BOX_R &&
      body.est.n === estAgain.n &&
      body.est.n === body.near.n &&
      body.est.kept === estAgain.kept &&
      body.est.kept > 0 &&
      body.est.kept < body.est.n &&
      Math.abs(body.est.mean - estAgain.mean) < 6e-5 &&
      body.est.mean <= body.near.mean &&
      body.sceneStats.meanLand === 0.0461 &&
      body.sceneStats.attemptedWater === 1151286 &&
      body.szaBounds[1] === 78.5 &&
      body.glintBounds[1] === 36 &&
      raw.extras.cloud_pixels === 122906 &&
      near(raw.extras.mean_cloud_top_height, 3752.858, 1e-3) &&
      raw.extras.solar_zenith_angle_bounds.join(',') === '0,180' &&
      raw.extras.no_such_dataset === null &&
      plain.win.extras === null &&
      withEx.win.extras.cloud_pixels === 122906 &&
      near(withEx.win.extras.mean_cloud_top_height, 3752.858, 1e-3) &&
      withEx.win.extras.no_such_dataset === null &&
      withEx.reads === plain.reads &&
      withEx.win.box.i === plain.win.box.i &&
      ask.id === 'aod' &&
      ask.product === 'ABI-L2-AODC' &&
      ask.halfPx === 50 &&
      ask.spec === L2_AOD_SPEC &&
      ask.extras === L2_AOD_EXTRAS &&
      L2_AOD_EXTRAS.length === 8 &&
      L2_AOD_EXTRAS[0] === 'mean_aod550_land' &&
      L2_AOD_SPEC.AOD === 'raw16' &&
      L2_AOD_SPEC.DQF === 'raw' &&
      L2_AOD_BOX_R === 12 &&
      L2_HALF_PX.aod === 50,
    `an AOD body dressed on the fixture's grid censuses ${body && body.census.n} px - ${body && body.census.high} high, ${body && body.census.medium} medium, ` +
      `${body && body.census.low} low, ${body && body.census.none} none - with the high-quality median ${body && body.census.median.toFixed(3)}, ` +
      `the home pixel (424, 127) ${body && body.here === null ? 'not usable (' + body.hereDqf + ')' : body && body.here + ' (DQF ' + body.hereDqf + ')'}, ` +
      `${body && body.near.n} high-quality px in the 50-km box (plain mean ${body && body.near.mean}) and the ATBD's estimate ${body && body.est.mean} ` +
      `from the ${body && body.est.kept} kept - every figure recomputed from the wire; the extras read whole (${raw.extras.cloud_pixels} cloud pixels, ` +
      `mean top ${raw.extras.mean_cloud_top_height.toFixed(1)} m, an absent name null) and by range in ${withEx.reads} reads, the same ${plain.reads} without them; ` +
      `the ninth ask ${ask.product} at half width ${ask.halfPx} with ${L2_AOD_EXTRAS.length} extras, never for a mosaic's minute`
  );
}

{
  // THE LAND'S SKIN (157th pass): an LST body dressed on the
  // fixture's grid - counts = the HT counts folded into the file's
  // valid range (9200..61200 at 0.0025 K from 190 K), DQF by a
  // pattern over the retrieved pixels (every 5th low, every 3rd of
  // the rest medium, the others high; no retrieval where HT is
  // fill), the PQI word carrying the quality, the mask's state and
  // a day bit by pattern, the home pixel (424, 127) forced to no
  // retrieval under cloud so the body must stand the layer on its
  // nearest high-quality neighbour - the census, the point, the
  // nearest and the scene's statistics recomputed from the wire; the
  // tenth ask's pins.
  const bytes = new Uint8Array(Buffer.from(ACHAC_B64, 'base64'));
  const raw = decodeL2(bytes, {HT: 'raw16', DQF: 'raw'});
  const cell = l2Cell(32.85, -117.12);
  const n = raw.data.HT.length;
  const lstArr = new Uint16Array(n);
  const lstDqf = new Uint8Array(n);
  const lstPqiArr = new Uint16Array(n);
  const gq = 127 * 500 + 424;
  let kept = 0;
  for (let q = 0; q < n; q++) {
    const h = raw.data.HT[q];
    if (h === 65535 || q === gq) {
      lstArr[q] = 65535;
      lstDqf[q] = 3;
      lstPqiArr[q] = 3 + (3 << 2); // no retrieval, cloudy
      continue;
    }
    kept++;
    lstArr[q] = 9200 + (h % 52000);
    lstDqf[q] = kept % 5 === 0 ? 2 : kept % 3 === 0 ? 1 : 0;
    lstPqiArr[q] =
      lstDqf[q] + (lstDqf[q] === 2 ? 2 << 2 : 0) + (kept % 2 === 0 ? 4096 : 0);
  }
  const lstDec = {
    ...raw,
    data: {LST: lstArr, DQF: lstDqf, PQI: lstPqiArr},
    meta: {
      LST: {scale: 0.0025, offset: 190, fill: 65535, units: 'K'},
      PQI: {scale: 1, offset: 0, fill: 65535, units: null}
    },
    extras: {
      mean_lst: 293.0574,
      min_lst: 228.6577,
      max_lst: 313.0973,
      standard_deviation_lst: 7.0881,
      total_pixels_where_lst_is_retrieved: 330835,
      number_good_retrievals: 101687,
      quantitative_local_zenith_angle_bounds: [0, 55],
      retrieval_local_zenith_angle_bounds: [0, 85]
    }
  };
  const body = l2LstBody(lstDec, 'kl', cell.lat, cell.lon);
  const back = body
    ? unscale(unpackArray(body.lst), {
        scale: body.lstScale,
        offset: body.lstOffset,
        fill: body.lstFill
      })
    : null;
  const dq = body ? unpackArray(body.dqf) : null;
  const pq = body ? unpackArray(body.pqi) : null;
  const again = body ? qualityCensus(back, dq) : null;
  const nearAgain = body
    ? nearestGood(back, dq, body.box, L2_LST_NEAR_PX, 0)
    : null;
  const ci = body ? body.box.i - body.box.i0 : 0;
  const cj = body ? body.box.j - body.box.j0 : 0;
  const qc = body ? cj * body.box.cols + ci : 0;
  const kmAgain =
    body && nearAgain
      ? +(
          Math.hypot(
            nearAgain.di * body.pixel.ewM,
            nearAgain.dj * body.pixel.nsM
          ) / 1000
        ).toFixed(1)
      : null;
  const nearWord = body && nearAgain ? lstPqi(pq[nearAgain.q]) : null;
  const ask = L2_ASKS[9];
  check(
    'THE LAND’S SKIN: the LST body dressed on the fixture, the point under cloud, the layer’s pixel its nearest high-quality neighbour, every figure recomputed from the wire',
    body !== null &&
      body.product === 'ABI-L2-LSTC' &&
      body.units === 'K' &&
      body.lst.kind === 'u16' &&
      body.dqf.kind === 'u8' &&
      body.pqi.kind === 'u16' &&
      body.lstFill === 65535 &&
      body.lstScale === 0.0025 &&
      body.lstOffset === 190 &&
      body.box.i === 424 &&
      body.box.j === 127 &&
      body.box.cols === 101 &&
      body.census.n === body.box.rows * body.box.cols &&
      body.census.high +
        body.census.medium +
        body.census.low +
        body.census.none +
        body.census.fill ===
        body.census.n &&
      body.census.high > 0 &&
      body.census.medium > 0 &&
      body.census.low > 0 &&
      body.census.none > 0 &&
      body.census.fill === 0 &&
      body.census.min >= 213 &&
      body.census.max <= 343 &&
      JSON.stringify(again) === JSON.stringify(body.census) &&
      body.here.K === null &&
      body.here.dqf === 3 &&
      lstPqi(body.here.pqi).cloud === 3 &&
      lstPqi(body.here.pqi).quality === 3 &&
      dq[qc] === 3 &&
      body.nearest !== null &&
      nearAgain !== null &&
      body.nearest.di === nearAgain.di &&
      body.nearest.dj === nearAgain.dj &&
      Math.max(Math.abs(body.nearest.di), Math.abs(body.nearest.dj)) === 1 &&
      body.nearest.K === +back[nearAgain.q].toFixed(2) &&
      body.nearest.km === kmAgain &&
      // one pixel of the fixture's 10-km grid at this view angle
      body.nearest.km > 8 &&
      body.nearest.km < 20 &&
      body.nearest.pqi === pq[nearAgain.q] &&
      nearWord.quality === 0 &&
      nearWord.cloud === 0 &&
      dq[nearAgain.q] === 0 &&
      body.nearPx === L2_LST_NEAR_PX &&
      body.sceneStats.meanK === 293.06 &&
      body.sceneStats.sdK === 7.09 &&
      body.sceneStats.retrieved === 330835 &&
      body.sceneStats.good === 101687 &&
      body.lzaBounds[1] === 55 &&
      body.lzaRetrievalBounds[1] === 85 &&
      body.lzaMaxDeg === raw.lzaMaxDeg &&
      ask.id === 'lst' &&
      ask.product === 'ABI-L2-LSTC' &&
      ask.halfPx === 50 &&
      ask.spec === L2_LST_SPEC &&
      ask.extras === L2_LST_EXTRAS &&
      ask.timed === false &&
      L2_LST_EXTRAS.length === 8 &&
      L2_LST_EXTRAS[0] === 'mean_lst' &&
      L2_LST_EXTRAS[5] === 'number_good_retrievals' &&
      L2_LST_SPEC.LST === 'raw16' &&
      L2_LST_SPEC.DQF === 'raw' &&
      L2_LST_SPEC.PQI === 'raw16' &&
      L2_LST_NEAR_PX === 5 &&
      L2_HALF_PX.lst === 50,
    `an LST body dressed on the fixture's grid censuses ${body && body.census.n} px - ${body && body.census.high} high, ${body && body.census.medium} medium, ` +
      `${body && body.census.low} low, ${body && body.census.none} none - with the high-quality median ${body && body.census.median.toFixed(2)} K ` +
      `(${body && body.census.min.toFixed(1)} to ${body && body.census.max.toFixed(1)}); the home pixel (424, 127) no retrieval under cloud, so the layer's pixel is ` +
      `its neighbour at (${body && body.nearest.di}, ${body && body.nearest.dj}), ${body && body.nearest.km} km off, ${body && body.nearest.K} K, ` +
      `high quality and clear by its word${nearWord && nearWord.day ? ', day' : ', night'} - every figure recomputed from the wire; the scene's own ` +
      `${body && body.sceneStats.retrieved.toLocaleString('en-US')} retrieved and ${body && body.sceneStats.good.toLocaleString('en-US')} good px, ` +
      `quantitative to ${body && body.lzaBounds[1]} deg; the tenth ask ${ask.product} at half width ${ask.halfPx} with ${L2_LST_EXTRAS.length} extras, ` +
      `never for a mosaic's minute`
  );
}

{
  // THE DEPLOYED REVISION (158th pass): install.sh writes the VERSION
  // file beside the entry point and the daemon reports it - the
  // parser takes the file's own shape, and anything else (a hand-run
  // tree without one, an empty file, a stray string) reads as no
  // version rather than a throw.
  const good = parseVersion(
    '{"rev":"9d25f5f0000000000000000000000000abcdef12","installedAt":"2026-09-06T10:00:00Z"}'
  );
  const partial = parseVersion('{"rev":"abc"}');
  const empty = parseVersion('');
  const junk = parseVersion('{"rev":12,"installedAt":null}');
  const notJson = parseVersion('9d25f5f');
  check(
    'THE DEPLOYED REVISION: the VERSION file parses to its own shape and to nothing on anything else',
    good.rev === '9d25f5f0000000000000000000000000abcdef12' &&
      good.installedAt === '2026-09-06T10:00:00Z' &&
      partial.rev === 'abc' &&
      partial.installedAt === null &&
      empty.rev === null &&
      empty.installedAt === null &&
      junk.rev === null &&
      junk.installedAt === null &&
      notJson.rev === null &&
      Object.keys(good).join() === 'rev,installedAt',
    `{"rev","installedAt"} reads back as written (${good.rev.slice(0, 7)} installed ${good.installedAt}); a rev alone keeps a null install time; ` +
      `an empty file, a numeric rev and a bare hash all read as no version - the daemon starts either way and says which`
  );
}

{
  // THE VECTORS READ WHOLE (153rd pass): the DMWC cut (hdf5-fixture:
  // the real file's 83 vectors nearest the home, written by h5py
  // with the file's own names, types, attributes, chunking and
  // filters) read through the daemon's own range handle with the
  // winds' head size - one round, one range, the whole file -
  // decodes to the point list; the vectors within 150 km, the ATBD
  // layers' counts and vector means agree with python/numpy's
  // independent reading of the same rows; the body's rounded
  // columns give the page the same layers; a far point keeps
  // nothing with nothing more read; a whole-buffer handle agrees;
  // the eighth ask is the winds by band, whole, never timed.
  const bytes = new Uint8Array(Buffer.from(DMWC_B64, 'base64'));
  const inflate = (u8) =>
    new Uint8Array(
      inflateSync(Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength))
    );
  const reads = [];
  const readRange = async (s, e) => {
    reads.push([s, e]);
    return bytes.subarray(s, Math.min(e, bytes.length));
  };
  const t0 = Date.now();
  const lazy = await openHdf5Lazy(readRange, inflate, {
    blockBytes: L2_RANGE_BLOCK,
    headBytes: L2_DMW_HEAD_BYTES
  });
  const dec = await decodeL2Vectors(lazy, 32.85, -117.12, L2_DMW_RADIUS_KM);
  const ms = Date.now() - t0;
  const E = DMWC_EXPECT;
  const body = dec ? l2DmwBody(dec, 'k') : null;
  const again = body ? dmwLayers(dmwUnpack(body.vectors)) : null;
  const readsBefore = reads.length;
  const far = await decodeL2Vectors(lazy, 0, -137, L2_DMW_RADIUS_KM);
  const whole = await decodeL2Vectors(
    openHdf5(bytes, inflate),
    32.85,
    -117.12,
    L2_DMW_RADIUS_KM
  );
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  // a layer against python's: the counts exact, the statistics to a
  // millionth (float32 values summed in double on both sides)
  const layerOk = (id) => {
    const a = body && body.layers[id];
    const e = E.layers[id];
    if (!a || !e) return false;
    if (a.n !== e.n || a.used !== e.used || a.radiusKm !== e.radiusKm)
      return false;
    if (e.radiusKm === null) return a.spdMs === null && a.dirDeg === null;
    return [
      'spdMs',
      'dirDeg',
      'meanMs',
      'medianMs',
      'minMs',
      'maxMs',
      'sdMs',
      'medianHpa',
      'nearestKm'
    ].every((k) => near(a[k], e[k], 1e-6));
  };
  const againOk = (id) => {
    const a = again && again[id];
    const b = body && body.layers[id];
    if (!a || !b) return false;
    if (a.n !== b.n || a.used !== b.used || a.radiusKm !== b.radiusKm)
      return false;
    if (b.radiusKm === null) return true;
    return near(a.spdMs, b.spdMs, 0.02) && near(a.dirDeg, b.dirDeg, 0.2);
  };
  check(
    'THE VECTORS READ WHOLE: the point list decodes from the first range, the layers agree with numpy',
    bytes.length < L2_DMW_HEAD_BYTES &&
      lazy.stats.rounds === 1 &&
      lazy.stats.ranges === 1 &&
      lazy.stats.bytes === bytes.length &&
      reads[0][0] === 0 &&
      reads[0][1] === L2_DMW_HEAD_BYTES &&
      L2_DMW_HEAD_BYTES === 1048576 &&
      L2_DMW_RADIUS_KM === 150 &&
      dec !== null &&
      dec.total === E.total &&
      dec.vectors.length === E.within150 &&
      dec.time.startsWith(E.timeIsoMinute) &&
      dec.platform === 'G18' &&
      dec.scene === 'CONUS' &&
      dec.band === 'C14' &&
      dec.imageGapS === E.gapS &&
      dec.lzaMaxDeg === E.lzaGood &&
      near(dec.vectors[0].km, E.nearestKm, 1e-6) &&
      dec.vectors.every((v, i) => i === 0 || v.km >= dec.vectors[i - 1].km) &&
      dec.vectors.every((v) => v.dqf === 0 && v.spdMs >= 3 && v.hPa > 0) &&
      dec.sceneStats.layers.length === 3 &&
      dec.sceneStats.layers.map((l) => l.n).join(',') ===
        E.sceneLayerN.join(',') &&
      dec.sceneStats.layers[0].hPa === 250 &&
      dec.sceneStats.meanMs > 3 &&
      body !== null &&
      body.product === 'ABI-L2-DMWC' &&
      body.n === E.within150 &&
      body.vectors.km.length === body.n &&
      body.vectors.dqf.every((q) => q === 0) &&
      layerOk('high') &&
      layerOk('mid') &&
      layerOk('low') &&
      againOk('high') &&
      againOk('mid') &&
      againOk('low') &&
      far !== null &&
      far.vectors.length === 0 &&
      far.total === E.total &&
      reads.length === readsBefore &&
      whole !== null &&
      whole.vectors.length === dec.vectors.length &&
      whole.time === dec.time &&
      L2_ASKS[7].id === 'dmw' &&
      L2_ASKS[7].kind === 'vectors' &&
      L2_ASKS[7].band === 'C14' &&
      L2_ASKS[7].radiusKm === L2_DMW_RADIUS_KM &&
      L2_ASKS[7].headBytes === L2_DMW_HEAD_BYTES &&
      L2_ASKS[7].product === 'ABI-L2-DMWC',
    `the ${DMWC_NAME} cut (${bytes.length} bytes, ${dec && dec.total} vectors) read in ${lazy.stats.rounds} round of ${lazy.stats.ranges} range (${lazy.stats.bytes} bytes: the megabyte head holds the file) in ${ms} ms: ${dec && dec.vectors.length} vectors within ${L2_DMW_RADIUS_KM} km of the home (nearest ${dec && dec.vectors[0].km.toFixed(1)} km) at ${dec && dec.time} from ${dec && dec.platform} ${dec && dec.scene} band ${dec && dec.band}, images ${dec && dec.imageGapS} s apart; the layers - high ${body && body.layers.high.used} of ${body && body.layers.high.n} within ${body && body.layers.high.radiusKm} km at ${body && body.layers.high.spdMs && body.layers.high.spdMs.toFixed(2)} m/s from ${body && body.layers.high.dirDeg && body.layers.high.dirDeg.toFixed(1)} deg, mid ${body && body.layers.mid.n} (too few), low ${body && body.layers.low.used} within ${body && body.layers.low.radiusKm} km at ${body && body.layers.low.spdMs && body.layers.low.spdMs.toFixed(2)} m/s from ${body && body.layers.low.dirDeg && body.layers.low.dirDeg.toFixed(1)} deg - agree with numpy's to a millionth; the wire's rounded columns give the same layers; the sub-satellite point keeps none of the ${E.total} with nothing more read; a whole-buffer handle agrees`
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

// ---- THE DAEMON'S BINDINGS (161st pass) --------------------------
// The daemon binds the decode block's names by destructuring its
// namespace (const {...} = L2), so a body builder it CALLS but never
// bound throws ReferenceError at request time - the 161st's first
// build did exactly that with l2PhaseBody: the daemon crashed on its
// first /goesl2 while every gate stayed green, and a deploy would
// have crash-looped the box on every request. This landmark reads
// the daemon's own source: every l2...Body the code calls must be
// bound from L2 and re-exported, and every served ask must have a
// builder named for it (the DCOMP pair through l2DcompBody).
{
  const src = readFileSync(
    new URL('./server/src/index.mjs', import.meta.url),
    'utf8'
  );
  const called = [
    ...new Set(
      [...src.matchAll(/\b(l2[A-Z][A-Za-z]*Body)\(/g)].map((m) => m[1])
    )
  ].sort();
  const bound = (src.match(/const \{([^}]*)\} = L2;/) ?? ['', ''])[1]
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const exported = (src.match(
    /export \{([^}]*)\} from '\.\.\/\.\.\/goesl2-decode\.js';/
  ) ?? ['', ''])[1]
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const unbound = called.filter((n) => !bound.includes(n));
  const unexported = called.filter((n) => !exported.includes(n));
  const served = L2_ASKS.filter((a) => !a.pageOnly && a.id !== 'cps');
  const builderOf = (id) =>
    'l2' +
    (id === 'cod' ? 'Dcomp' : id[0].toUpperCase() + id.slice(1)) +
    'Body';
  const missing = served
    .map((a) => builderOf(a.id))
    .filter((n) => !called.includes(n));
  check(
    "THE DAEMON'S BINDINGS: every body builder the daemon calls is bound from the decode block, every served ask has one",
    called.length >= 10 &&
      unbound.length === 0 &&
      unexported.length === 0 &&
      missing.length === 0 &&
      bound.includes('l2PhaseBody') &&
      called.includes('l2PhaseBody'),
    `the daemon calls ${called.length} builders (${called.join(', ')}), all ${unbound.length === 0 ? 'bound' : 'NOT bound: ' + unbound.join(', ')} ` +
      `and ${unexported.length === 0 ? 'all re-exported' : 'not re-exported: ' + unexported.join(', ')}; the ${served.length} served asks each name one` +
      (missing.length ? ` - MISSING ${missing.join(', ')}` : '')
  );
}

{
  // THE GATE'S OWN REPORT (172nd): update.sh writes its phase, revision,
  // start, seconds and failing lines to a status file; the daemon reads
  // it fresh under /health as version.update. The parser takes the
  // file's shape and nothing else; the script's three phases and the
  // daemon's read are guarded at source level like the ship list.
  const okS = parseUpdateStatus(
    '{"phase":"failed","rev":"abc123","startedAt":"2026-09-06T21:00:00Z","gatedS":3120,"at":"2026-09-06T21:52:00Z","tail":"[FAIL] glm-reference.mjs\\nError: x"}'
  );
  const gating = parseUpdateStatus(
    '{"phase":"gating","rev":"abc123","startedAt":"2026-09-06T21:00:00Z","gatedS":0,"at":"2026-09-06T21:00:00Z","tail":""}'
  );
  const badPhase = parseUpdateStatus('{"phase":"resting","rev":"abc"}');
  const junkS = parseUpdateStatus('not json');
  const emptyS = parseUpdateStatus('');
  const srcUpd = readFileSync(
    new URL('./server/update.sh', import.meta.url),
    'utf8'
  );
  const srcIdx = readFileSync(
    new URL('./server/src/index.mjs', import.meta.url),
    'utf8'
  );
  check(
    "THE GATE'S OWN REPORT: the updater's status file parses to its phases and to nothing else, the script writes all three, the daemon serves it under /health",
    okS !== null &&
      okS.phase === 'failed' &&
      okS.rev === 'abc123' &&
      okS.gatedS === 3120 &&
      okS.tail.startsWith('[FAIL] glm-reference.mjs') &&
      okS.tail.includes('\n') &&
      gating.phase === 'gating' &&
      gating.gatedS === 0 &&
      gating.tail === '' &&
      badPhase === null &&
      junkS === null &&
      emptyS === null &&
      /write_status gating "\$NEW"/.test(srcUpd) &&
      /write_status deployed "\$NEW"/.test(srcUpd) &&
      /write_status failed "\$NEW"/.test(srcUpd) &&
      srcUpd.includes('/opt/horizon-live-update.status.json') &&
      srcUpd.includes('tee "$GATE_LOG"') &&
      srcIdx.includes(
        "env.UPDATE_STATUS ?? '/opt/horizon-live-update.status.json'"
      ) &&
      /update: updateStatus\(\)/.test(srcIdx),
    `a failed report reads back (${okS.rev} after ${okS.gatedS} s, tail "${okS.tail.split('\n')[0]}"), a gating one with zero seconds, an unknown phase / junk / nothing as null; update.sh writes gating, deployed and failed to ${'/opt/horizon-live-update.status.json'} through a tee'd gate log, and index.mjs serves the file as version.update`
  );
}

{
  // THE SHIP LIST, WHOLE (174th): every '../../X.js' import in
  // index.mjs must have BOTH an install line and a sed rewrite in
  // install.sh - the 158th guarded the ship line, and the 168th's
  // glm.js had one while its rewrite was missing, so install.sh's own
  // drift guard refused every revision from the 168th on AFTER a
  // passing gate, and update.sh under set -e re-gated the same tip an
  // hour a time with nothing recorded (found on 2026-09-06 with the
  // box on the 166th's build at 22:20Z). Also the updater's new
  // phases: an install that fails is recorded and reported.
  const srcIdx = readFileSync(
    new URL('./server/src/index.mjs', import.meta.url),
    'utf8'
  );
  const srcInstall = readFileSync(
    new URL('./server/install.sh', import.meta.url),
    'utf8'
  );
  const srcUpd = readFileSync(
    new URL('./server/update.sh', import.meta.url),
    'utf8'
  );
  const imports = [
    ...new Set(
      [...srcIdx.matchAll(/from '\.\.\/\.\.\/([a-z0-9-]+\.js)'/g)].map(
        (m) => m[1]
      )
    )
  ].sort();
  const noShip = imports.filter(
    (f) => !srcInstall.includes(`install -m 644 ../${f} /opt/horizon-live/${f}`)
  );
  const noRewrite = imports.filter(
    (f) => !srcInstall.includes(`s#'../../${f}'#'./${f}'#`)
  );
  const inst = parseUpdateStatus(
    '{"phase":"install-failed","rev":"abc","startedAt":"2026-09-06T22:00:00Z","gatedS":3300,"at":"2026-09-06T22:56:00Z","tail":"install.sh: unshipped ../../ import in index.mjs"}'
  );
  const installing = parseUpdateStatus('{"phase":"installing","rev":"abc"}');
  check(
    'THE SHIP LIST, WHOLE: every shared import of the daemon has its install line and its rewrite, and an install that fails after a passing gate is recorded',
    imports.length >= 19 &&
      imports.includes('glm.js') &&
      imports.includes('mrms.js') &&
      noShip.length === 0 &&
      noRewrite.length === 0 &&
      inst !== null &&
      inst.phase === 'install-failed' &&
      installing !== null &&
      installing.phase === 'installing' &&
      /write_status install-failed "\$NEW"/.test(srcUpd) &&
      /write_status installing "\$NEW"/.test(srcUpd) &&
      /echo "\$NEW failed \$\(date \+%s\)" >"\$STATE"\n\s+write_status install-failed/.test(
        srcUpd
      ),
    `${imports.length} shared imports (${imports.join(', ')}): ${noShip.length === 0 ? 'every one shipped' : 'NOT shipped: ' + noShip.join(', ')}, ${noRewrite.length === 0 ? 'every one rewritten' : 'NOT rewritten: ' + noRewrite.join(', ')}; update.sh records an install failure as a failed revision (the cooldown applies) and reports phases installing and install-failed`
  );
}

{
  // THE FLASHES FROM ORBIT (168th): the daemon's /glm route is bound
  // to the shared law module and the install ships it with the
  // bearing helper it imports - a source-level guard like the
  // 161st's, so a build that forgets a file cannot deploy
  const srcGlm = readFileSync(
    new URL('./server/src/index.mjs', import.meta.url),
    'utf8'
  );
  const instGlm = readFileSync(
    new URL('./server/install.sh', import.meta.url),
    'utf8'
  );
  check(
    "THE FLASHES' ROUTE is bound to the law and shipped with what it imports",
    srcGlm.includes("url.pathname === '/glm'") &&
      srcGlm.includes("from '../../glm.js'") &&
      srcGlm.includes('parseGlmFlashes(openHdf5(') &&
      srcGlm.includes("l2KeyFor(bucket, 'GLM-L2-LCFA'") &&
      srcGlm.includes('GLM_KEEP = 3') &&
      srcGlm.includes('GLM_REFRESH_MS = 20e3') &&
      // the ring is the last minute: a file fetched before a quiet
      // spell is dropped when a newer one lands (measured 740 s
      // across a 12-minute gap before the rule)
      srcGlm.includes('GLM_WINDOW_MS = 60e3') &&
      srcGlm.includes('newest - f.endMs <= GLM_WINDOW_MS') &&
      instGlm.includes('install -m 644 ../glm.js /opt/horizon-live/glm.js') &&
      instGlm.includes(
        'install -m 644 ../wildfire.js /opt/horizon-live/wildfire.js'
      ),
    "the daemon answers /glm from glm.js's parseGlmFlashes over the newest LCFA file of the craft that sees the point, holding three 20-s files (a minute) refreshed at most every 20 s; install.sh ships glm.js and wildfire.js (rangeBearing)"
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
