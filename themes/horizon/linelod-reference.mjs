// Reference gate for linelod.js (node linelod-reference.mjs): honest
// level-of-detail for OSM line networks.
//
//  - a fetched way is kept while its whole EXTENT still subtends the
//    shared display threshold (veglod.js lodThresholdArcmin) at its
//    nearest distance - never a count, never a class table.
//  - the subtense law is veglod's own chordArcmin, re-exported not
//    re-derived (one law for crowns and extents).
//  - distance is to the NEAREST vertex (a road reaching toward you is
//    near where it reaches, not at its far end).
//  - the retired CLASS_RADIUS_M table dropped downloaded, visible
//    ways; the landmark pins one such trail as KEPT under the law.
import {
  chordArcmin,
  lineKeep,
  nearestDistM,
  lodFilterRoads
} from './linelod.js';
import {lodThresholdArcmin, ACUITY_ARCMIN} from './veglod.js';
import {crownArcmin} from './veglod.js';

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

// The shared display threshold for a representative display (60 deg
// fov over 1080 rows): the finest-pixel subtense, floored by acuity.
const THR = lodThresholdArcmin(60, 1080);

{
  // One subtense law: linelod's chordArcmin IS veglod's crownArcmin
  // (function identity - re-exported, not re-derived).
  check(
    'one chord-subtense law (veglod re-export)',
    chordArcmin === crownArcmin,
    'chordArcmin === veglod.crownArcmin'
  );
}

{
  // Nearest-vertex distance: closest point of {5 km N, 500 m E} is 500 m.
  const d = nearestDistM([north(5000), east(500)], LAT, LON);
  check('nearest-vertex distance', near(d, 500, 5), `-> ${d.toFixed(0)} m`);
}

{
  // The keep boundary is exact both ways: at the closed-form keep
  // radius d* = L / (2 tan(thr/2)) the extent subtends the threshold
  // exactly; just inside it is kept, just past it is dropped.
  const L = 100;
  const thrRad = (THR / 60) * (Math.PI / 180);
  const dStar = L / (2 * Math.tan(thrRad / 2));
  const ok =
    lineKeep(L, dStar * 0.999, THR) &&
    !lineKeep(L, dStar * 1.001, THR) &&
    near(chordArcmin(L, dStar), THR, 1e-9);
  check(
    'extent boundary exact',
    ok,
    `100 m way: keep radius ${(dStar / 1000).toFixed(1)} km, subtense there ${chordArcmin(L, dStar).toFixed(4)}' = threshold ${THR.toFixed(4)}'`
  );
}

{
  // The trail the table dropped: a 100 m footpath at 1.3 km subtends
  // ~4.4 arcmin of extent - resolvable many times over - and the
  // retired class table (600 m base + 4x length bonus = 1000 m) cut
  // it. Under the extent law it is KEPT: nothing downloaded and
  // visible is discarded.
  const feats = [
    {id: 'TRAIL', kind: 'path', pts: [north(1300)], len: 100},
    {id: 'STUB', kind: 'path', pts: [north(1300)], len: 0.2}
  ];
  const kept = lodFilterRoads(feats, LAT, LON, THR).map((f) => f.id);
  const ok =
    kept.includes('TRAIL') &&
    !kept.includes('STUB') &&
    chordArcmin(100, 1300) > 4 * ACUITY_ARCMIN;
  check(
    'the trail the class table dropped is kept',
    ok,
    `path@1.3km extent ${chordArcmin(100, 1300).toFixed(1)}' kept; a 0.2 m stub there (${chordArcmin(0.2, 1300).toFixed(3)}') dropped`
  );
}

{
  // No count anywhere: 400 near primary ways all survive (bounded by
  // geometry - extent at distance - never by a ceiling), nearest
  // first.
  const feats = [];
  for (let i = 0; i < 400; i++)
    feats.push({id: 'R' + i, kind: 'primary', pts: [north(10 + i)], len: 500});
  const kept = lodFilterRoads(feats, LAT, LON, THR);
  const ok = kept.length === 400 && kept[0].id === 'R0';
  check(
    'no count cap: every visible way kept',
    ok,
    `400 near primaries -> ${kept.length} kept, nearest ${kept[0].id}`
  );
}

process.exit(fail ? 1 : 0);
