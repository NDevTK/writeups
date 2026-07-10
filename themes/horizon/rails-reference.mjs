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
//  - map-matching (nearest-arc projection): exact closed-form
//    foot points on interior and endpoint, the gate excludes,
//    the nearest of two arcs wins across grid cells, the arc
//    direction is unit - a train is rail-constrained, its fix
//    is not
//  - route-based map matching: Dijkstra over the drawn graph
//    walks the L exactly (arc lengths, the corner at its length
//    fraction, per-segment track bearings), one-arc legs go
//    direct, disconnected components return null - a leg the
//    network cannot carry is never invented
import {
  parseRailways,
  RAIL_COLOR,
  RAIL_WIDTH,
  railIndex,
  railRoute,
  railsGeometry,
  railWidthOf,
  routePoint,
  SHOULDER_M,
  snapToRail
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

{
  // Map-matching at its closed points. One horizontal arc from
  // (0,0) to (10,0), one vertical from (20,-5) to (20,5):
  //  - (3, 2) projects to the interior foot (3, 0) at d = 2,
  //    direction exactly +x
  //  - (-4, 3) clamps to the endpoint (0, 0) at d = 5 (3-4-5)
  //  - (19, 0) is 1 from the vertical arc and 9 from the
  //    horizontal - the nearest arc wins even in another cell
  //  - a 0.5 gate excludes the (3, 2) fix entirely
  const idx = railIndex(
    [
      [
        [0, 0],
        [10, 0]
      ],
      [
        [20, -5],
        [20, 5]
      ]
    ],
    4
  );
  const interior = snapToRail(idx, 3, 2, 60);
  const endpoint = snapToRail(idx, -4, 3, 60);
  const nearest = snapToRail(idx, 19, 0, 60);
  const gated = snapToRail(idx, 3, 2, 0.5);
  const ok =
    interior &&
    Math.abs(interior.x - 3) < 1e-12 &&
    Math.abs(interior.z) < 1e-12 &&
    Math.abs(interior.d - 2) < 1e-12 &&
    Math.abs(interior.dx - 1) < 1e-12 &&
    Math.abs(interior.dz) < 1e-12 &&
    endpoint &&
    Math.abs(endpoint.x) < 1e-12 &&
    Math.abs(endpoint.z) < 1e-12 &&
    Math.abs(endpoint.d - 5) < 1e-12 &&
    nearest &&
    Math.abs(nearest.x - 20) < 1e-12 &&
    Math.abs(nearest.d - 1) < 1e-12 &&
    Math.abs(Math.hypot(nearest.dx, nearest.dz) - 1) < 1e-12 &&
    gated === null;
  check(
    'map-matching nearest arc',
    ok,
    `interior foot (3,0) at d=2 with unit +x direction; endpoint clamp (0,0) at the exact 3-4-5 distance; the vertical arc wins at (19,0) across cells (d=1 vs 9); the 0.5 gate returns null - no invented track`
  );
}

{
  // Route-based map matching on an L of two ways sharing their
  // junction node (as OSM junctions do): (1,-2) and (12,8) project
  // to (1,0) and (10,8); the routed leg is (1,0)-(10,0)-(10,8),
  // length exactly 17. routePoint walks it by arc length: f = 9/17
  // lands ON the corner, past it the bearing turns +z. One-arc legs
  // route directly; two disconnected arcs return null.
  const idx = railIndex(
    [
      [
        [0, 0],
        [10, 0]
      ],
      [
        [10, 0],
        [10, 10]
      ]
    ],
    4
  );
  const rt = railRoute(idx, 1, -2, 12, 8, 60);
  const corner = rt && routePoint(rt, 9 / 17);
  const after = rt && routePoint(rt, 12 / 17);
  const start = rt && routePoint(rt, 0);
  const direct = railRoute(idx, 2, 1, 7, -1, 60);
  const apart = railIndex(
    [
      [
        [0, 0],
        [10, 0]
      ],
      [
        [0, 50],
        [10, 50]
      ]
    ],
    4
  );
  const none = railRoute(apart, 1, 0, 9, 50, 60);
  const ok =
    rt &&
    Math.abs(rt.len - 17) < 1e-9 &&
    Math.abs(corner.x - 10) < 1e-9 &&
    Math.abs(corner.z) < 1e-9 &&
    Math.abs(start.dx - 1) < 1e-12 &&
    Math.abs(after.x - 10) < 1e-9 &&
    Math.abs(after.z - 3) < 1e-9 &&
    Math.abs(after.dz - 1) < 1e-12 &&
    direct &&
    Math.abs(direct.len - 5) < 1e-9 &&
    none === null;
  check(
    'route-based map matching',
    ok,
    `the L routes (1,0)-(10,0)-(10,8) at length 17 exactly; f=9/17 sits ON the junction, f=12/17 is 3 up the second arc heading +z; a one-arc leg goes direct (len 5); disconnected arcs -> null (no invented route)`
  );
}

{
  // Gap healing: the parse drops sub-50 m connector ways (switch
  // throats), which fragments the graph exactly at junctions - so
  // a dangling endpoint within the heal radius (cell/4 = 1 unit
  // here) reconnects through the foreign arc at exact partial
  // lengths. Two collinear arcs 0.5 apart route straight through
  // (length exactly 18: 9 + 0.5 + 8.5); the same two arcs 5 apart
  // stay separate - a five-unit hole is not a dropped connector.
  const gapped = railIndex(
    [
      [
        [0, 0],
        [10, 0]
      ],
      [
        [10.5, 0],
        [20, 0]
      ]
    ],
    4
  );
  const healed = railRoute(gapped, 1, 0, 19, 0, 60);
  const wide = railIndex(
    [
      [
        [0, 0],
        [10, 0]
      ],
      [
        [15, 0],
        [25, 0]
      ]
    ],
    4
  );
  const unhealed = railRoute(wide, 1, 0, 24, 0, 60);
  const ok = healed && Math.abs(healed.len - 18) < 1e-9 && unhealed === null;
  check(
    'dropped-connector healing',
    ok,
    `a 0.5-unit junction gap heals: (1,0)->(19,0) routes at length exactly 18 through the dangling endpoint's partial-length edges; a 5-unit hole stays two components (null) - real dropped switch throats reconnect, invented links do not`
  );
}

process.exit(fail ? 1 : 0);
