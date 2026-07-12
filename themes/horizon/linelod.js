/**
 * linelod.js - honest level-of-detail for the OSM ROAD network, the
 * line-layer twin of bldlod.js, gated by linelod-reference.mjs.
 *
 * Roads had the same lie as the buildings: parse them, sort by class,
 * then slice(0, 500) - a fixed count that drops real, present streets the
 * moment the network is bigger than 500. Central London has ~209,000
 * highway ways (OSM splits every road at each junction); 500 was a
 * quarter of a percent, shown as if it were the city.
 *
 * Roads cannot be fetched whole at any radius, so the theme pulls them in
 * two honest passes - ALL classes near (the streets you stand on) and the
 * ARTERIAL classes across the box (the network you see reaching away) -
 * and this module decides what survives: a road is kept when it is
 * prominent enough to be seen at its nearest distance. Prominence is its
 * CLASS (a motorway reads clear across the box, a service road only when
 * you are on it) plus its LENGTH (a long way is seen from farther than a
 * short stub of the same class). Never a count. A village keeps its whole
 * network; a metropolis keeps its spine far and its side streets near.
 *
 * Distance is to the NEAREST vertex of the way (a road passing 5 km off
 * but reaching toward you is near where it reaches). Cheap
 * equirectangular metres, exact enough for LOD over a box.
 */

const R_EARTH_M = 6371000;
const RAD = Math.PI / 180;

// OSM highway class -> base visibility radius (m): how far that class is
// still worth drawing before length is considered. Trunk roads span the
// box; service roads and paths only read underfoot. Ranks follow
// roads.js RANK (0 motorway .. 15 path).
const CLASS_RADIUS_M = [
  8000, // 0 motorway
  8000, // 1 trunk
  8000, // 2 primary
  6000, // 3 secondary
  6000, // 4 tertiary
  2500, // 5 unclassified
  2500, // 6 residential
  1600, // 7 living_street
  1600, // 8 pedestrian
  900, // 9 service
  900, // 10 track
  700, // 11 cycleway
  700, // 12 footway
  600, // 13 steps
  600, // 14 bridleway
  600 // 15 path
];

// Base radius (m) for a class rank (ranks past the table use the last).
export function classRadiusM(rank) {
  const i = Math.max(0, Math.min(rank | 0, CLASS_RADIUS_M.length - 1));
  return CLASS_RADIUS_M[i];
}

// Nearest-vertex distance (m) from (lat, lon) to a polyline of [lat,lon]
// points, in a local equirectangular frame around the view.
export function nearestDistM(pts, lat, lon) {
  if (!Array.isArray(pts) || !pts.length) return Infinity;
  const kx = Math.cos(lat * RAD);
  let best = Infinity;
  for (const p of pts) {
    if (!p) continue;
    const x = (p[1] - lon) * kx;
    const y = p[0] - lat;
    const d = (x * x + y * y) * RAD * RAD * R_EARTH_M * R_EARTH_M;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

/**
 * The visibility reach (m) of a line: its class base radius plus a bonus
 * for its own length (a long way is seen from farther), the bonus capped
 * so one very long way cannot reach the whole planet.
 */
export function lineReachM(baseRadiusM, lenM, lenGain = 4, lenCapM = 8000) {
  return baseRadiusM + Math.min(Math.max(lenM, 0) * lenGain, lenCapM);
}

/**
 * Keep the roads visible from (lat, lon). Each feature needs
 * {pts:[[lat,lon]], len, kind}. `rankOf(kind)` maps the OSM highway class
 * to its rank (roads.js exports this). A road survives when its nearest
 * distance is within class-radius + length-bonus - so every road prominent
 * enough to see is kept and no others, bounded by geometry, never by a
 * count. Sorted nearest first.
 */
export function lodFilterRoads(features, lat, lon, rankOf) {
  const kept = [];
  for (const f of features || []) {
    const d = nearestDistM(f.pts, lat, lon);
    const reach = lineReachM(classRadiusM(rankOf(f.kind)), f.len || 0);
    if (d > reach) continue;
    kept.push({f, d});
  }
  kept.sort((a, b) => a.d - b.d);
  return kept.map((k) => k.f);
}
