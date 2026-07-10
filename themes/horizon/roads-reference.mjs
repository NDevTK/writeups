// Reference gate for roads.js (node roads-reference.mjs):
//  - the OSM width ladder against the tag forms the wild carries
//  - surface provenance: the tagged surface picks the albedo,
//    untagged ways default by class
//  - densify/thin held exact: gap and spacing bounds, endpoints
//    and original vertices preserved
//  - the LIVE Interlaken fixture parses to the real street network
//    with the documented defaults doing the work
//  - ribbon geometry held by the EXACTNESS identity (triangle
//    areas sum to length x width on a straight flat road, normals
//    exactly up), water breaking a road into strips, a bridge
//    spanning the same water on a straight grade
import {
  DEFAULT_WIDTH,
  densify,
  LANE_M,
  lengthM,
  parseRoads,
  roadsGeometry,
  SURFACE_COLOR,
  surfaceColor,
  thin,
  TYPE_WIDTH,
  widthOf
} from './roads.js';
import {ROADS_FIXTURE} from './roads-fixture.mjs';
import {geoToScene} from './roam.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // The width ladder: width tag (either decimal form) beats
  // lanes x 3.5 m beats the type default beats the global default.
  const ok =
    widthOf({width: '6'}) === 6 &&
    widthOf({width: '5,5'}) === 5.5 &&
    widthOf({width: '4 m'}) === 4 &&
    widthOf({lanes: '2'}) === 2 * LANE_M &&
    widthOf({width: 'wide', lanes: '3'}) === 3 * LANE_M &&
    widthOf({highway: 'primary'}) === TYPE_WIDTH.primary &&
    widthOf({highway: 'path'}) === TYPE_WIDTH.path &&
    widthOf({highway: 'busway'}) === DEFAULT_WIDTH &&
    widthOf({}) === DEFAULT_WIDTH;
  check(
    'width ladder',
    ok,
    `width tag (both decimal forms, unit suffix) > lanes x ${LANE_M} m (OSM default lane) > type default > ${DEFAULT_WIDTH} m`
  );
}

{
  // Surface provenance: the tag picks the albedo; untagged paved
  // families read asphalt, untagged track/path families bare
  // ground.
  const ok =
    surfaceColor({surface: 'gravel'}) === SURFACE_COLOR.gravel &&
    surfaceColor({surface: 'grass'}) === SURFACE_COLOR.grass &&
    surfaceColor({highway: 'residential'}) === SURFACE_COLOR.asphalt &&
    surfaceColor({highway: 'track'}) === SURFACE_COLOR.ground &&
    surfaceColor({highway: 'path'}) === SURFACE_COLOR.ground;
  check(
    'surface provenance',
    ok,
    'tagged surface wins; untagged paved classes -> asphalt, track/path -> bare ground'
  );
}

{
  // densify/thin: no gap above maxSep, no interior spacing below
  // minSep, endpoints exact, original vertices never moved.
  const line = [
    [0, 0],
    [40, 0],
    [40, 3],
    [41, 3],
    [90, 60]
  ];
  const dense = densify(line, 7);
  let maxGap = 0;
  for (let i = 1; i < dense.length; i++)
    maxGap = Math.max(
      maxGap,
      Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1])
    );
  const kept = line.every((p) =>
    dense.some((q) => q[0] === p[0] && q[1] === p[1])
  );
  const thinned = thin(dense, 7);
  let minGap = Infinity;
  for (let i = 1; i < thinned.length - 1; i++)
    minGap = Math.min(
      minGap,
      Math.hypot(
        thinned[i][0] - thinned[i - 1][0],
        thinned[i][1] - thinned[i - 1][1]
      )
    );
  const ends = thinned[0] === dense[0] && thinned[thinned.length - 1][0] === 90;
  check(
    'densify and thin',
    maxGap <= 7 + 1e-12 && kept && minGap >= 7 - 1e-12 && ends,
    `densified gaps <= 7 (worst ${maxGap.toFixed(3)}), originals kept; thinned interior spacing >= 7 (least ${minGap.toFixed(3)}), endpoints exact`
  );
}

const roads = parseRoads(ROADS_FIXTURE);

{
  // The LIVE fixture: 400 captured Interlaken ways parse to the
  // real network - stubs dropped, bridges present, the trunk road
  // (A8) and the footpaths both surviving the class-ranked cap.
  const kinds = new Set(roads.map((r) => r.kind));
  const bridges = roads.filter((r) => r.bridge).length;
  const ok =
    roads.length > 300 &&
    kinds.has('trunk') &&
    kinds.has('residential') &&
    kinds.has('footway') &&
    bridges >= 5 &&
    roads.every((r) => r.wM >= 1 && r.wM <= 60 && r.len >= 25) &&
    roads.every((r) => r.pts.length >= 2);
  check(
    'live Interlaken fixture',
    ok,
    `${roads.length} ways (${kinds.size} classes, ${bridges} bridges), widths within the ladder's range, stubs under 25 m dropped`
  );
}

{
  // Ribbon exactness on a straight flat road, then the water rules
  // on the same road: no bridge tag -> the wet middle splits it
  // into two strips; the bridge tag -> one deck on the straight
  // grade between the shores.
  const anchor = {lat: 46.7, lon: 7.9};
  const U = 7 / 400;
  const mLat = 111320;
  const mLon = mLat * Math.cos((46.7 * Math.PI) / 180);
  const LEN_M = 400;
  const road = {
    id: 1,
    pts: [
      [46.7, 7.9 - LEN_M / 2 / mLon],
      [46.7, 7.9 + LEN_M / 2 / mLon]
    ],
    wM: 6,
    color: [0.1, 0.2, 0.3],
    bridge: false,
    kind: 'residential'
  };
  const flat = roadsGeometry([road], anchor, () => 3, U, 1e9);
  // predicted vertex count from the SAME gated densify/thin
  const line = thin(
    densify(
      road.pts.map(([la, lo]) => {
        const s = geoToScene(la, lo, anchor);
        return [s.x, s.z];
      }),
      15 * U
    ),
    4 * U
  );
  const wantCount = 6 * (line.length - 1);
  let area = 0;
  let upOk = true;
  for (let i = 0; i + 8 < flat.position.length; i += 9) {
    const p = flat.position;
    const ux = p[i + 3] - p[i];
    const uz = p[i + 5] - p[i + 2];
    const vx = p[i + 6] - p[i];
    const vz = p[i + 8] - p[i + 2];
    area += Math.abs(ux * vz - uz * vx) / 2;
  }
  for (let i = 0; i < flat.count; i++)
    if (Math.abs(flat.normal[3 * i + 1] - 1) > 1e-9) upOk = false;
  // scene length from the exact projection (equirectangular in,
  // equirectangular out - the identity is exact, not approximate)
  const a = geoToScene(road.pts[0][0], road.pts[0][1], anchor);
  const b = geoToScene(road.pts[1][0], road.pts[1][1], anchor);
  const wantArea = Math.hypot(b.x - a.x, b.z - a.z) * 6 * U;
  // water: wet middle third; shores at different heights
  const wetY = (x) => (Math.abs(x) < 1 ? null : x < 0 ? 4 : 8);
  const cut = roadsGeometry([road], anchor, wetY, U, 1e9);
  const spanned = roadsGeometry(
    [{...road, bridge: true}],
    anchor,
    wetY,
    U,
    1e9
  );
  // the deck must hold the straight grade: y strictly rising
  // across the gap, every deck vertex between the shore levels
  let grade = true;
  for (let i = 0; i < spanned.count; i++) {
    const y = spanned.position[3 * i + 1];
    if (y < 4 - 1e-9 || y > 8 + 1e-9) grade = false;
  }
  check(
    'ribbon, water and bridge',
    flat.placed === 1 &&
      flat.count === wantCount &&
      // float32 vertex storage bounds the identity, not the math
      Math.abs(area - wantArea) < 1e-6 * wantArea &&
      upOk &&
      cut.count < flat.count &&
      cut.count > 0 &&
      spanned.count === wantCount &&
      grade,
    `straight 400 m road -> ${flat.count} vertices, ribbon area = length x 6 m to ${(Math.abs(area - wantArea) / wantArea).toExponential(1)}, normals exactly up; a wet middle cuts it to ${cut.count} vertices in two strips; the bridge tag spans it (${spanned.count} vertices) on the straight 4->8 m grade`
  );
}

process.exit(fail ? 1 : 0);
