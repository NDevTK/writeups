// Reference gate for geotiles.js (node geotiles-reference.mjs): the
// slippy-tile grid the vector layers fetch by, held to the universal
// OSM tile convention.
//
//  - tileOf matches the published OSM tiling (central London is in
//    z14 tile 8186/5448 - checkable against tile.openstreetmap.org).
//  - tileBounds inverts tileOf: a point's tile contains the point.
//  - tilesCovering covers a box exactly (every corner's tile included).
//  - unionElements dedupes a way returned by two neighbouring tiles.
import {
  tileOf,
  tileBounds,
  tileBbox,
  tileKey,
  tilesCovering,
  unionElements
} from './geotiles.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // Published OSM convention: Charing Cross (51.5074, -0.1278) lies in
  // z14 x=8186 y=5448; zoom halves to z13 4093/2724.
  const t14 = tileOf(51.5074, -0.1278, 14);
  const t13 = tileOf(51.5074, -0.1278, 13);
  const ok =
    t14.x === 8186 && t14.y === 5448 && t13.x === 4093 && t13.y === 2724;
  check(
    'OSM slippy convention',
    ok,
    `London z14 -> ${t14.x}/${t14.y} (want 8186/5448); z13 -> ${t13.x}/${t13.y}`
  );
}

{
  // Bounds invert the tile: the point is inside its own tile's box, and
  // the box is ~2.4 km wide at z14 on this latitude.
  const t = tileOf(51.5074, -0.1278, 14);
  const b = tileBounds(t.x, t.y, 14);
  const wKm = (b.e - b.w) * 111.32 * Math.cos((51.5074 * Math.PI) / 180);
  const ok =
    b.s < 51.5074 &&
    51.5074 < b.n &&
    b.w < -0.1278 &&
    -0.1278 < b.e &&
    wKm > 1 &&
    wKm < 2;
  check(
    'bounds contain the point',
    ok,
    `s ${b.s.toFixed(4)} < 51.5074 < n ${b.n.toFixed(4)}; width ${wKm.toFixed(2)} km at z14`
  );
}

{
  // Covering a +/-1.5 km London box at z14 takes a small block of tiles
  // and includes the tiles of all four corners.
  const dLat = 1500 / 111320;
  const dLon = 1500 / (111320 * Math.cos((51.5074 * Math.PI) / 180));
  const s = 51.5074 - dLat;
  const w = -0.1278 - dLon;
  const n = 51.5074 + dLat;
  const e = -0.1278 + dLon;
  const tiles = tilesCovering(s, w, n, e, 14);
  const has = (la, lo) => {
    const t = tileOf(la, lo, 14);
    return tiles.some((q) => q.x === t.x && q.y === t.y);
  };
  const ok =
    tiles.length >= 4 &&
    tiles.length <= 12 &&
    has(s, w) &&
    has(s, e) &&
    has(n, w) &&
    has(n, e);
  check(
    'covering includes every corner',
    ok,
    `+/-1.5 km -> ${tiles.length} tiles at z14, all corners in`
  );
}

{
  // Keys and bboxes are stable strings a cache can address.
  const ok =
    tileKey(8186, 5448, 14) === '14/8186/5448' &&
    /^[-0-9.]+,[-0-9.]+,[-0-9.]+,[-0-9.]+$/.test(tileBbox(8186, 5448, 14));
  check(
    'key + bbox strings',
    ok,
    `${tileKey(8186, 5448, 14)} · ${tileBbox(8186, 5448, 14)}`
  );
}

{
  // A way crossing a tile edge comes back from both tiles: the union
  // keeps it once, first-seen order preserved.
  const a = [{id: 1}, {id: 2}];
  const b = [{id: 2}, {id: 3}];
  const u = unionElements([a, b]);
  const ok = u.length === 3 && u[0].id === 1 && u[1].id === 2 && u[2].id === 3;
  check(
    'union dedupes edge-crossers',
    ok,
    `[1,2]+[2,3] -> ${u.map((e) => e.id).join(',')}`
  );
}

process.exit(fail ? 1 : 0);
