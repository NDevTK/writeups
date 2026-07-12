// Reference gate for linelod.js (node linelod-reference.mjs): honest
// level-of-detail for the OSM road network.
//
//  - a road is kept when it is prominent enough to be seen at its nearest
//    distance: its CLASS base radius (motorway across the box, service
//    road underfoot) plus a LENGTH bonus. Never a count.
//  - distance is to the NEAREST vertex (a road reaching toward you is
//    near where it reaches, not at its far end).
//  - the class radii line up with the real roads.js rank order.
import {
  classRadiusM,
  nearestDistM,
  lineReachM,
  lodFilterRoads
} from './linelod.js';
import {rankOf} from './roads.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const near = (a, b, t) => Math.abs(a - b) < t;

const LAT = 51.5;
const LON = -0.12;
const mLat = 111320;
const mLon = mLat * Math.cos((LAT * Math.PI) / 180);
const north = (dM) => [LAT + dM / mLat, LON];
const east = (dM) => [LAT, LON + dM / mLon];

{
  // Nearest-vertex distance: closest point of {5 km N, 500 m E} is 500 m.
  const d = nearestDistM([north(5000), east(500)], LAT, LON);
  check('nearest-vertex distance', near(d, 500, 5), `-> ${d.toFixed(0)} m`);
}

{
  // Class radius follows the rank order: motorway spans the box, a
  // service road is underfoot, and the rank comes from roads.js.
  const ok =
    classRadiusM(rankOf('motorway')) === 8000 &&
    classRadiusM(rankOf('primary')) === 8000 &&
    classRadiusM(rankOf('residential')) === 2500 &&
    classRadiusM(rankOf('service')) === 900 &&
    classRadiusM(rankOf('motorway_link')) === 8000 && // _link folds to base
    classRadiusM(rankOf('footway')) < classRadiusM(rankOf('residential'));
  check(
    'class radius by rank',
    ok,
    `motorway ${classRadiusM(rankOf('motorway'))} · residential ${classRadiusM(rankOf('residential'))} · service ${classRadiusM(rankOf('service'))} m`
  );
}

{
  // Reach = base + capped length bonus.
  const ok =
    near(lineReachM(2500, 100), 2900, 1) &&
    near(lineReachM(2500, 100000), 10500, 1); // 2500 + 8000 cap
  check(
    'reach = base + capped length',
    ok,
    `short ${lineReachM(2500, 100)} · capped ${lineReachM(2500, 100000)}`
  );
}

{
  // The heart of it: a motorway 6 km off is KEPT (class spans the box);
  // a residential street 6 km off is DROPPED (class radius 2.5 km) but
  // the same street near is KEPT; a service road only underfoot. Sorted
  // nearest first, no count cap.
  const feats = [
    {id: 'M6', kind: 'motorway', pts: [north(6000)], len: 400},
    {id: 'RES_FAR', kind: 'residential', pts: [north(6000)], len: 200},
    {id: 'RES_NEAR', kind: 'residential', pts: [east(800)], len: 200},
    {id: 'SVC_FAR', kind: 'service', pts: [north(4000)], len: 60},
    {id: 'SVC_FEET', kind: 'service', pts: [north(120)], len: 60}
  ];
  const kept = lodFilterRoads(feats, LAT, LON, rankOf);
  const ids = kept.map((f) => f.id);
  const ok =
    ids.includes('M6') &&
    !ids.includes('RES_FAR') &&
    ids.includes('RES_NEAR') &&
    !ids.includes('SVC_FAR') &&
    ids.includes('SVC_FEET') &&
    ids[0] === 'SVC_FEET'; // nearest first
  check(
    'class LOD: arterials far, side streets near',
    ok,
    ok
      ? `motorway@6km kept, residential@6km dropped/near kept, service@4km dropped/underfoot kept; nearest first (${ids.join(',')})`
      : `got ${ids.join(',')}`
  );
}

{
  // No count anywhere: 400 near primary roads all survive (bounded by
  // geometry - class + distance - never by a ceiling).
  const feats = [];
  for (let i = 0; i < 400; i++)
    feats.push({id: 'R' + i, kind: 'primary', pts: [north(10 + i)], len: 500});
  const kept = lodFilterRoads(feats, LAT, LON, rankOf);
  const ok = kept.length === 400 && kept[0].id === 'R0'; // all kept, nearest first
  check(
    'no count cap: every visible road kept',
    ok,
    `400 near primaries -> ${kept.length} kept, nearest ${kept[0].id}`
  );
}

process.exit(fail ? 1 : 0);
