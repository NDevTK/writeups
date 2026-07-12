// Reference gate for bldlod.js (node bldlod-reference.mjs): honest
// level-of-detail selection of the OSM buildings, run on the RAW
// Overpass response so the costly parse only touches what will draw.
//
//  - LOD is SPATIAL, never a count: a footprint is kept when it is big
//    enough to be seen at its distance. A shed at your feet stays; the
//    same shed a kilometre out drops; a large block a kilometre out
//    stays. Nothing near is discarded to hit a number.
//  - the near cut is a real radius (buildings past it are the land-use
//    tint + the tall-landmark ring, not individual houses here).
//  - metres and shoelace area are equirectangular-exact for a ~km box.
import {
  BLD_NEAR_M,
  bldLodMinArea,
  metresBetween,
  ringAreaM2,
  lodFilterOsm
} from './bldlod.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const near = (a, b, t) => Math.abs(a - b) < t;

const LAT = 51.5074;
const LON = -0.1278;
const mLat = 111320;
const mLon = mLat * Math.cos((LAT * Math.PI) / 180);

// A square OSM way of side `sideM` metres whose near corner is `dM`
// metres due north of the anchor (the first vertex is what the filter
// distances by).
const wayAt = (dNorthM, sideM, id) => {
  const la = LAT + dNorthM / mLat;
  const lo = LON;
  const dLa = sideM / mLat;
  const dLo = sideM / mLon;
  return {
    type: 'way',
    id,
    geometry: [
      {lat: la, lon: lo},
      {lat: la, lon: lo + dLo},
      {lat: la + dLa, lon: lo + dLo},
      {lat: la + dLa, lon: lo},
      {lat: la, lon: lo}
    ]
  };
};

{
  const dn = metresBetween(LAT, LON, LAT + 1000 / mLat, LON);
  const de = metresBetween(LAT, LON, LAT, LON + 1000 / mLon);
  const ok = near(dn, 1000, 5) && near(de, 1000, 5);
  check(
    'metres between',
    ok,
    `1 km N -> ${dn.toFixed(0)} m; 1 km E -> ${de.toFixed(0)} m`
  );
}

{
  // Shoelace area: a 20 m square reads ~400 m^2.
  const a = ringAreaM2(wayAt(50, 20, 'x').geometry);
  const ok = near(a, 400, 8);
  check('ring area (m^2)', ok, `20 m square -> ${a.toFixed(0)} m^2`);
}

{
  const ok =
    bldLodMinArea(0) <= 12 &&
    bldLodMinArea(300) <= 12 &&
    bldLodMinArea(700) > bldLodMinArea(300) &&
    bldLodMinArea(1150) > bldLodMinArea(700) &&
    bldLodMinArea(1e6) === bldLodMinArea(1150);
  check(
    'LOD threshold ramps with range',
    ok,
    `feet ${bldLodMinArea(0)} · 300 m ${bldLodMinArea(300)} · 700 m ${bldLodMinArea(700)} · 1.15 km ${bldLodMinArea(1150)} m^2`
  );
}

{
  // The heart of it, on a raw Overpass object: a small shed near is
  // KEPT; the same small shed far is DROPPED (spatial LOD, not a count);
  // a large block far is KEPT; a way past the near radius is excluded;
  // survivors are raw ways, nearest first.
  const osm = {
    elements: [
      wayAt(120, 6, 'SHED_NEAR'), // ~36 m^2 at 120 m -> keep
      wayAt(1000, 6, 'SHED_FAR'), // ~36 m^2 at 1 km -> drop (needs 130)
      wayAt(1000, 20, 'BLOCK_FAR'), // ~400 m^2 at 1 km -> keep
      wayAt(30, 15, 'HOUSE_FEET'), // nearest -> keep, first
      wayAt(3000, 40, 'TOWER_BEYOND') // past 1.2 km radius -> drop
    ]
  };
  const {elements: kept} = lodFilterOsm(osm, LAT, LON);
  const ids = kept.map((e) => e.id);
  const ok =
    ids.includes('SHED_NEAR') &&
    !ids.includes('SHED_FAR') &&
    ids.includes('BLOCK_FAR') &&
    ids.includes('HOUSE_FEET') &&
    !ids.includes('TOWER_BEYOND') &&
    ids[0] === 'HOUSE_FEET' &&
    kept.every((e) => e.type === 'way' && Array.isArray(e.geometry));
  check(
    'raw-OSM spatial LOD keeps the visible, drops the invisible',
    ok,
    ok
      ? `near shed kept, far shed dropped, far block kept, beyond-radius tower dropped; nearest first (${ids.join(',')})`
      : `got ${ids.join(',')}`
  );
}

{
  // No count anywhere: 50 near houses all survive - bounded by geometry
  // (radius + size at distance), never by a ceiling.
  const many = {elements: []};
  for (let i = 0; i < 50; i++) many.elements.push(wayAt(10 + i, 15, 'B' + i));
  const r = lodFilterOsm(many, LAT, LON);
  const ok = r.elements.length === 50 && r.elements[0].id === 'B0';
  check(
    'no count cap: every visible building kept',
    ok,
    `50 near houses -> ${r.elements.length} kept, nearest ${r.elements[0].id}`
  );
}

process.exit(fail ? 1 : 0);
