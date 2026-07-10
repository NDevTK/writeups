// Reference gate for rivers.js (node rivers-reference.mjs):
//  - the waterway width ladder against the tag forms
//  - parse rules: tunnelled reaches skipped, unknown types
//    dropped, class-ranked cap, the LIVE fixture carrying the
//    Aare by name
//  - the geometry IS the roads' gated ribbon builder: the area
//    identity holds through the rivers path on a straight stream
//  - a watercourse reaching polygon water stops at the shore
//    (the shared strip-breaking, asserted through THIS path)
import {
  B_AT_A_STATION,
  DEFAULT_WATER_WIDTH,
  dischargeFactor,
  parseWaterways,
  refDischarge,
  RIVER_COLOR,
  riversGeometry,
  riverWidthOf,
  WATER_WIDTH
} from './rivers.js';
import {densify, thin} from './roads.js';
import {DISCHARGE_FIXTURE, RIVERS_FIXTURE} from './rivers-fixture.mjs';
import {geoToScene} from './roam.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // The width ladder: width tag (either decimal form) beats the
  // type default beats the global default.
  const ok =
    riverWidthOf({width: '8'}) === 8 &&
    riverWidthOf({width: '3,5'}) === 3.5 &&
    riverWidthOf({width: '2 m'}) === 2 &&
    riverWidthOf({waterway: 'river'}) === WATER_WIDTH.river &&
    riverWidthOf({waterway: 'stream'}) === WATER_WIDTH.stream &&
    riverWidthOf({waterway: 'ditch'}) === WATER_WIDTH.ditch &&
    riverWidthOf({}) === DEFAULT_WATER_WIDTH;
  check(
    'waterway width ladder',
    ok,
    `width tag (both decimal forms, unit suffix) > type default > ${DEFAULT_WATER_WIDTH} m`
  );
}

const rivers = parseWaterways(RIVERS_FIXTURE);

{
  // The LIVE fixture: the captured network parses - tunnelled
  // reaches gone (70 of 300 in the capture), the Aare present by
  // name, rivers ranked before streams, stubs dropped.
  const kinds = new Set(rivers.map((r) => r.kind));
  const firstStream = rivers.findIndex((r) => r.kind === 'stream');
  const lastRiver = rivers.map((r) => r.kind).lastIndexOf('river');
  const ok =
    rivers.length > 120 &&
    rivers.some((r) => r.name === 'Aare') &&
    kinds.has('stream') &&
    kinds.has('canal') &&
    lastRiver < firstStream &&
    rivers.every((r) => r.wM >= 0.3 && r.wM <= 400 && r.len >= 50) &&
    rivers.every((r) => !r.bridge);
  check(
    'live Interlaken fixture',
    ok,
    `${rivers.length} watercourses (${kinds.size} classes) - the Aare by name, rivers ranked first, every tunnelled reach skipped`
  );
}

{
  // The shared builder: a straight 300 m stream through the
  // RIVERS path holds the roads' gated area identity (length x
  // ladder width to float32 storage) with the water albedo on
  // every vertex - the geometry is gated once, shared honestly.
  const anchor = {lat: 46.7, lon: 7.9};
  const U = 7 / 400;
  const mLon = 111320 * Math.cos((46.7 * Math.PI) / 180);
  const stream = parseWaterways({
    elements: [
      {
        type: 'way',
        id: 5,
        tags: {waterway: 'stream'},
        geometry: [
          {lat: 46.7, lon: 7.9 - 150 / mLon},
          {lat: 46.7, lon: 7.9 + 150 / mLon}
        ]
      }
    ]
  });
  const g = riversGeometry(stream, anchor, () => 2, U, 1e9);
  const line = thin(
    densify(
      stream[0].pts.map(([la, lo]) => {
        const s = geoToScene(la, lo, anchor);
        return [s.x, s.z];
      }),
      15 * U
    ),
    4 * U
  );
  let area = 0;
  for (let i = 0; i + 8 < g.position.length; i += 9) {
    const p = g.position;
    area +=
      Math.abs(
        (p[i + 3] - p[i]) * (p[i + 8] - p[i + 2]) -
          (p[i + 5] - p[i + 2]) * (p[i + 6] - p[i])
      ) / 2;
  }
  const a = geoToScene(stream[0].pts[0][0], stream[0].pts[0][1], anchor);
  const b = geoToScene(stream[0].pts[1][0], stream[0].pts[1][1], anchor);
  const wantArea = Math.hypot(b.x - a.x, b.z - a.z) * WATER_WIDTH.stream * U;
  let colOk = true;
  for (let i = 0; i < g.count; i++)
    for (let k = 0; k < 3; k++)
      if (Math.abs(g.color[3 * i + k] - RIVER_COLOR[k]) > 1e-6) colOk = false;
  check(
    'shared ribbon builder',
    g.placed === 1 &&
      g.count === 6 * (line.length - 1) &&
      Math.abs(area - wantArea) < 1e-6 * wantArea &&
      colOk,
    `straight 300 m stream -> ${g.count} vertices, area = length x ${WATER_WIDTH.stream} m to ${(Math.abs(area - wantArea) / wantArea).toExponential(1)}, water albedo on every vertex`
  );
}

{
  // The shore: where groundY says polygon water (a lake), the
  // ribbon STOPS - the stream hands over to the lake surface
  // instead of drawing across it (bridge=false always for water).
  const anchor = {lat: 46.7, lon: 7.9};
  const U = 7 / 400;
  const mLon = 111320 * Math.cos((46.7 * Math.PI) / 180);
  const stream = parseWaterways({
    elements: [
      {
        type: 'way',
        id: 6,
        tags: {waterway: 'stream'},
        geometry: [
          {lat: 46.7, lon: 7.9 - 200 / mLon},
          {lat: 46.7, lon: 7.9 + 200 / mLon}
        ]
      }
    ]
  });
  const dry = riversGeometry(stream, anchor, () => 2, U, 1e9);
  // the eastern half is a lake
  const half = riversGeometry(
    stream,
    anchor,
    (x) => (x > 0 ? null : 2),
    U,
    1e9
  );
  let maxX = -Infinity;
  for (let i = 0; i < half.count; i++)
    maxX = Math.max(maxX, half.position[3 * i]);
  check(
    'stops at the shore',
    half.count > 0 && half.count < dry.count && maxX <= 0 + 15 * U + 1e-9,
    `the eastern half in a lake: ${dry.count} -> ${half.count} vertices, the ribbon's last vertex at x = ${maxX.toFixed(3)} (the shore), the lake surface takes over`
  );
}

{
  // Hydraulic geometry (Leopold & Maddock 1953): the width factor
  // IS (Q/Qref)^b with the canonical at-a-station exponent 0.26 -
  // exact against Math.pow, unity at reference flow, clamped at
  // believable bounds, and 1 (nothing invented) on missing data.
  const ok =
    B_AT_A_STATION === 0.26 &&
    dischargeFactor(2, 1) === Math.pow(2, 0.26) &&
    dischargeFactor(1, 2) === Math.pow(0.5, 0.26) &&
    dischargeFactor(34.65, 34.65) === 1 &&
    dischargeFactor(1e9, 1) === 2 &&
    dischargeFactor(1e-9, 1) === 0.5 &&
    dischargeFactor(NaN, 30) === 1 &&
    dischargeFactor(30, 0) === 1 &&
    refDischarge([1, 2, 3]) === null;
  check(
    'hydraulic geometry',
    ok,
    `w ~ Q^${B_AT_A_STATION} (Leopold & Maddock at-a-station), exact to Math.pow, unity at reference, clamped [0.5, 2], factor 1 whenever the data cannot speak`
  );
}

{
  // The LIVE GloFAS record: 93 days at the Interlaken cell - the
  // median recomputes to the captured 34.65 m3/s, and the day of
  // capture (26.16, a below-median summer flow) yields a width
  // factor just under 1, exactly the power law's answer.
  const q = DISCHARGE_FIXTURE.daily.river_discharge;
  const ref = refDischarge(q);
  const today = q[q.length - 1];
  const f = dischargeFactor(today, ref);
  check(
    'live GloFAS discharge',
    q.length === 93 &&
      ref === 34.65 &&
      today === 26.16 &&
      f === Math.pow(26.16 / 34.65, 0.26) &&
      f > 0.9 &&
      f < 1,
    `93 days -> median ${ref} m3/s; capture day ${today} -> width x${f.toFixed(3)} - the Aare a touch narrower that day, by the paper's own law`
  );
}

process.exit(fail ? 1 : 0);
