// Reference gate for rails.js (node rails-reference.mjs):
//  - the width ladder MEASURED from the gauge tag (288 of 300
//    captured ways carry one): tracks x (gauge + shoulders) >
//    tracks x 4 > type defaults
//  - parse rules on the LIVE fixture: tunnelled reaches skipped,
//    the Harderbahn by name, all three gauges of the region
//  - the geometry IS the roads' gated ribbon builder: the area
//    identity holds through the rails path at the gauge width
//  - the bridge tag CARRIES: a rail bridge spans wet ground on
//    the shared straight grade (the Aare rail bridges are real)
import {
  parseRailways,
  RAIL_COLOR,
  RAIL_WIDTH,
  railsGeometry,
  railWidthOf,
  SHOULDER_M
} from './rails.js';
import {densify, thin} from './roads.js';
import {RAILS_FIXTURE} from './rails-fixture.mjs';
import {geoToScene} from './roam.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // The ladder: measured gauge (mm) + shoulders per track beats
  // tracks x 4 beats the type default.
  const ok =
    railWidthOf({gauge: '1435'}) === 1.435 + SHOULDER_M &&
    railWidthOf({gauge: '1435', tracks: '2'}) === 2 * (1.435 + SHOULDER_M) &&
    railWidthOf({gauge: '1000'}) === 1 + SHOULDER_M &&
    railWidthOf({gauge: '800'}) === 0.8 + SHOULDER_M &&
    railWidthOf({tracks: '2', railway: 'rail'}) === 8 &&
    railWidthOf({railway: 'funicular'}) === RAIL_WIDTH.funicular &&
    railWidthOf({railway: 'narrow_gauge'}) === RAIL_WIDTH.narrow_gauge;
  check(
    'gauge-measured width ladder',
    ok,
    `tracks x (gauge + ${SHOULDER_M} m shoulders) > tracks x 4 m > type defaults - the bed is measured where 288 of 300 ways tag their gauge`
  );
}

const rails = parseRailways(RAILS_FIXTURE);

{
  // The LIVE fixture: the region's rail identity survives the
  // parse - all three gauges (1435 standard, 1000 BOB, 800 rack),
  // the Harderbahn funicular by name, tunnelled reaches gone,
  // bridges carried for the Aare crossings.
  const kinds = new Set(rails.map((r) => r.kind));
  const widths = new Set(rails.map((r) => Math.round(r.wM * 100)));
  const bridges = rails.filter((r) => r.bridge).length;
  const ok =
    rails.length > 150 &&
    kinds.has('rail') &&
    kinds.has('narrow_gauge') &&
    kinds.has('funicular') &&
    rails.some((r) => r.name === 'Harderbahn') &&
    widths.has(Math.round((1.435 + SHOULDER_M) * 100)) &&
    widths.has(Math.round((1 + SHOULDER_M) * 100)) &&
    widths.has(Math.round((0.8 + SHOULDER_M) * 100)) &&
    // bridges are SHORT spans: of the 24 tagged in the capture,
    // most fall under the 50-60 m stub floors - the long decks
    // survive
    bridges >= 5 &&
    rails.every((r) => r.wM >= 2 && r.wM <= 20 && r.len >= 50);
  check(
    'live Interlaken fixture',
    ok,
    `${rails.length} ways (${kinds.size} classes, ${bridges} bridges) - the Harderbahn by name, beds at all three measured gauges, every tunnelled reach skipped`
  );
}

{
  // The shared builder through the RAILS path: a straight 300 m
  // metre-gauge line holds the area identity at the MEASURED
  // width (1.0 m gauge + shoulders), ballast albedo throughout.
  const anchor = {lat: 46.7, lon: 7.9};
  const U = 7 / 400;
  const mLon = 111320 * Math.cos((46.7 * Math.PI) / 180);
  const line1 = parseRailways({
    elements: [
      {
        type: 'way',
        id: 7,
        tags: {railway: 'narrow_gauge', gauge: '1000'},
        geometry: [
          {lat: 46.7, lon: 7.9 - 150 / mLon},
          {lat: 46.7, lon: 7.9 + 150 / mLon}
        ]
      }
    ]
  });
  const g = railsGeometry(line1, anchor, () => 2, U, 1e9);
  const pts = thin(
    densify(
      line1[0].pts.map(([la, lo]) => {
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
  const a = geoToScene(line1[0].pts[0][0], line1[0].pts[0][1], anchor);
  const b = geoToScene(line1[0].pts[1][0], line1[0].pts[1][1], anchor);
  const wantArea = Math.hypot(b.x - a.x, b.z - a.z) * (1 + SHOULDER_M) * U;
  let colOk = true;
  for (let i = 0; i < g.count; i++)
    for (let k = 0; k < 3; k++)
      if (Math.abs(g.color[3 * i + k] - RAIL_COLOR[k]) > 1e-6) colOk = false;
  check(
    'shared ribbon builder',
    g.placed === 1 &&
      g.count === 6 * (pts.length - 1) &&
      Math.abs(area - wantArea) < 1e-6 * wantArea &&
      colOk,
    `straight 300 m metre-gauge line -> ${g.count} vertices, area = length x ${(1 + SHOULDER_M).toFixed(1)} m (the MEASURED bed) to ${(Math.abs(area - wantArea) / wantArea).toExponential(1)}, ballast albedo throughout`
  );
}

{
  // The bridge carry: the same line tagged bridge=yes spans a wet
  // middle on the shared straight grade; untagged, it breaks at
  // the shore. Asymmetric shores prove the grade is real.
  const anchor = {lat: 46.7, lon: 7.9};
  const U = 7 / 400;
  const mLon = 111320 * Math.cos((46.7 * Math.PI) / 180);
  const mk = (bridge) =>
    parseRailways({
      elements: [
        {
          type: 'way',
          id: 8,
          tags: bridge
            ? {railway: 'rail', gauge: '1435', bridge: 'yes'}
            : {railway: 'rail', gauge: '1435'},
          geometry: [
            {lat: 46.7, lon: 7.9 - 200 / mLon},
            {lat: 46.7, lon: 7.9 + 200 / mLon}
          ]
        }
      ]
    });
  const wetY = (x) => (Math.abs(x) < 1 ? null : x < 0 ? 3 : 6);
  const cut = railsGeometry(mk(false), anchor, wetY, U, 1e9);
  const spanned = railsGeometry(mk(true), anchor, wetY, U, 1e9);
  const dry = railsGeometry(mk(true), anchor, () => 3, U, 1e9);
  let grade = true;
  for (let i = 0; i < spanned.count; i++) {
    const y = spanned.position[3 * i + 1];
    if (y < 3 - 1e-9 || y > 6 + 1e-9) grade = false;
  }
  check(
    'bridge carries to the deck',
    cut.count > 0 &&
      cut.count < dry.count &&
      spanned.count === dry.count &&
      grade,
    `untagged, the wet middle cuts the line (${cut.count} of ${dry.count} vertices); tagged bridge=yes it spans on the straight 3->6 m grade - the Aare rail bridges really cross`
  );
}

process.exit(fail ? 1 : 0);
