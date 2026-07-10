// Reference gate for buildings.js (node buildings-reference.mjs):
//  - the OSM height ladder against the tag forms the wild carries
//  - shoelace area exact on a surveyed rectangle
//  - ear clipping held by the EXACTNESS identity: triangle areas
//    sum to the polygon area, convex and concave
//  - the LIVE Interlaken fixture parses to real footprints with
//    the documented defaults doing the work
//  - the merged geometry: watertight counts, outward walls, roofs
//    at base + height, water/off-box skipping, glow carried
import {
  areaM2,
  buildingsGeometry,
  DEFAULT_HEIGHT,
  earClip,
  heightOf,
  LEVEL_M,
  parseBuildings
} from './buildings.js';
import {BUILDINGS_FIXTURE} from './buildings-fixture.mjs';
import {geoToScene} from './roam.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // The height ladder, in the priority the wiki defines: height
  // tag (metres, either decimal form) beats levels x 3 beats the
  // type default beats the global default.
  const ok =
    heightOf({height: '12'}) === 12 &&
    heightOf({height: '12,5'}) === 12.5 &&
    heightOf({height: '9 m'}) === 9 &&
    heightOf({'building:levels': '4'}) === 4 * LEVEL_M &&
    heightOf({height: 'tall', 'building:levels': '2'}) === 2 * LEVEL_M &&
    heightOf({building: 'garage'}) === 3 &&
    heightOf({building: 'house'}) === 7 &&
    heightOf({building: 'apartments'}) === DEFAULT_HEIGHT &&
    heightOf({}) === DEFAULT_HEIGHT;
  check(
    'height ladder',
    ok,
    `height tag (both decimal forms, unit suffix) > levels x ${LEVEL_M} m (Simple 3D Buildings) > type default > ${DEFAULT_HEIGHT} m`
  );
}

{
  // Shoelace: a 40 x 25 m rectangle at 46.7N measures 1000 m^2 to
  // equirectangular tolerance.
  const mLat = 111320;
  const mLon = mLat * Math.cos((46.7 * Math.PI) / 180);
  const dLat = 25 / mLat;
  const dLon = 40 / mLon;
  const rect = [
    [46.7, 7.9],
    [46.7, 7.9 + dLon],
    [46.7 + dLat, 7.9 + dLon],
    [46.7 + dLat, 7.9]
  ];
  const a = areaM2(rect);
  check(
    'shoelace area',
    Math.abs(a - 1000) < 0.01,
    `40 x 25 m rectangle -> ${a.toFixed(3)} m^2`
  );
}

{
  // Ear clipping exactness: triangle areas sum to the polygon
  // area for a convex pentagon AND a concave L (both windings).
  const area2 = (pts) => {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[(i + 1) % pts.length];
      s += ax * bz - bx * az;
    }
    return Math.abs(s) / 2;
  };
  const triArea = (pts, [a, b, c]) =>
    Math.abs(
      (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) -
        (pts[c][0] - pts[a][0]) * (pts[b][1] - pts[a][1])
    ) / 2;
  const pent = [
    [0, 0],
    [4, 0],
    [5, 3],
    [2, 5],
    [-1, 3]
  ];
  const L = [
    [0, 0],
    [4, 0],
    [4, 1],
    [1, 1],
    [1, 4],
    [0, 4]
  ];
  let worst = 0;
  for (const poly of [pent, pent.slice().reverse(), L, L.slice().reverse()]) {
    const tris = earClip(poly);
    const sum = tris.reduce((s, t) => s + triArea(poly, t), 0);
    worst = Math.max(worst, Math.abs(sum - area2(poly)));
    if (tris.length !== poly.length - 2) worst = Infinity;
  }
  check(
    'ear clipping',
    worst < 1e-12,
    `pentagon and concave L (both windings): n-2 triangles whose areas sum to the polygon area to ${worst.toExponential(1)}`
  );
}

const builds = parseBuildings(BUILDINGS_FIXTURE);

{
  // The LIVE fixture: 180 captured Interlaken footprints parse to
  // real buildings (tiny sheds under 25 m^2 dropped), closing
  // points deduped, gable/flat split present on both sides.
  const gabled = builds.filter((b) => b.gabled).length;
  const dedup = builds.every((b) => {
    const f = b.ring[0];
    const l = b.ring[b.ring.length - 1];
    return f[0] !== l[0] || f[1] !== l[1];
  });
  check(
    'live Interlaken fixture',
    builds.length > 140 &&
      gabled > 30 &&
      builds.length - gabled > 30 &&
      dedup &&
      builds.every((b) => b.h >= 3 && b.h <= 60),
    `${builds.length} footprints (${gabled} gabled, ${builds.length - gabled} flat), rings deduped, heights within the ladder's range`
  );
}

{
  // Merged geometry on flat ground: every wall vertex pair sits at
  // base-2m or base+h, roofs at/above base+h; outward orientation
  // held by the normals - walls horizontal, flat roofs straight
  // UP, and NOTHING in a building faces downward (a flipped roof
  // is invisible from above); a building in water is skipped;
  // glow rides every vertex of its building.
  const anchor = {lat: 46.6863, lon: 7.8632};
  const U = 7 / 400;
  const set = [
    ...builds.slice(0, 2),
    builds.find((b) => b.gabled),
    builds.find((b) => !b.gabled)
  ];
  const g = buildingsGeometry(
    set,
    anchor,
    () => 10,
    () => 0.7,
    U,
    140
  );
  let yOk = true;
  let horiz = 0;
  let up = 0;
  let down = 0;
  let maxY = -Infinity;
  for (let i = 0; i < g.count; i++) {
    const y = g.position[3 * i + 1];
    const ny = g.normal[3 * i + 1];
    maxY = Math.max(maxY, y);
    if (Math.abs(ny) < 1e-6) horiz++;
    if (ny > 0.999) up++;
    if (ny < -1e-6) down++;
    if (y < 10 - 2 * U - 1e-6) yOk = false;
  }
  const hMax = Math.max(...set.map((b) => b.h)) * U;
  const drowned = buildingsGeometry(
    set,
    anchor,
    () => null,
    () => 0,
    U,
    140
  );
  check(
    'merged geometry',
    g.placed === set.length &&
      g.count > 0 &&
      yOk &&
      horiz > 0 &&
      up > 0 &&
      down === 0 &&
      maxY <= 10 + hMax * 1.36 &&
      g.glow.every((v) => Math.abs(v - 0.7) < 1e-6) &&
      drowned.placed === 0 &&
      drowned.count === 0,
    `${set.length} buildings (gabled + flat among them) -> ${g.count} vertices: bases at ground-2m, tops within height+gable, ${horiz} horizontal wall normals, ${up} straight-up roof normals, none facing down, glow carried; on water nothing is placed`
  );
}

process.exit(fail ? 1 : 0);
