/**
 * bldlod.js - honest level-of-detail selection for the OSM buildings,
 * shared by the theme (Horizon.html) and gated by bldlod-reference.mjs.
 *
 * The old path fetched way[building] over the whole 8 km box capped at
 * `out geom 600`, then kept the 400 nearest a centroid - a SCATTERED
 * SUBSAMPLE shown as if it were the real city. Standing in central
 * London you saw ~400 arbitrary footprints where OSM has fifty thousand;
 * your actual neighbours were missing. A scene that says "every value is
 * real" must not do that.
 *
 * LOD here is SPATIAL, never a count: a footprint is kept when it is big
 * enough to actually be seen at its distance from the view. Right next to
 * you every house shows; a few hundred metres out the sheds and garages
 * drop but the houses stay; toward the edge only the larger blocks
 * remain - exactly what the eye resolves. Nothing is invented and nothing
 * near is thrown away to hit a number; the selection is deterministic and
 * uniform in size, not an arbitrary slice.
 *
 * Feasibility is real: central London has ~10,000 buildings within 1.5 km
 * and tens of thousands within the box - a wallpaper can neither download
 * nor extrude them all. So the query is drawn from the near radius where
 * an individual footprint reads at all, the size-at-distance ramp thins
 * the far-near ones, and the WHOLE FILTER RUNS ON THE RAW OSM (a cheap
 * shoelace area), so the expensive parse (roof OBB, colours) only ever
 * touches the buildings that will actually be drawn. Past the near radius
 * the city is the land-use tint + measured night-lights, and distant
 * TOWERS are a separate, coarser ring.
 */

// The buildings query is drawn from this radius (metres) around the
// view. Past it an individual house is sub-pixel; the far city is the
// land-use tint + skyglow, and distant towers are the separate ring.
export const BLD_NEAR_M = 1200;

// Distance -> minimum footprint area (m^2) worth drawing. A ramp, not a
// cliff: everything very near, houses to mid range, only blocks at the
// edge. Grounded in what subtends a visible angle, not a budget.
export function bldLodMinArea(distM) {
  if (!(distM > 0)) return 12; // at the feet: even a shed
  if (distM < 500) return 12; // whole neighbourhood, sheds included
  if (distM < 850) return 55; // houses stay, tiny outbuildings drop
  if (distM < 1100) return 130; // houses/blocks
  return 260; // toward the edge: the larger blocks only
}

const R_EARTH_M = 6371000;
const RAD = Math.PI / 180;

// Planar-enough metric distance (m) between two lat/lon for a ~km box:
// equirectangular around the view latitude. Exact enough for LOD.
export function metresBetween(lat0, lon0, lat1, lon1) {
  const x = (lon1 - lon0) * RAD * Math.cos(((lat0 + lat1) / 2) * RAD);
  const y = (lat1 - lat0) * RAD;
  return Math.hypot(x, y) * R_EARTH_M;
}

// Metric footprint area (m^2) of an OSM way geometry ([{lat,lon},...]),
// shoelace in a local equirectangular frame. Cheap: no trig per vertex
// beyond the one cos(lat). Used to LOD-filter BEFORE the costly parse.
export function ringAreaM2(geometry) {
  if (!Array.isArray(geometry) || geometry.length < 3) return 0;
  const lat0 = geometry[0].lat;
  const kx = 111320 * Math.cos(lat0 * RAD);
  const ky = 111320;
  let s = 0;
  for (let i = 0; i < geometry.length; i++) {
    const a = geometry[i];
    const b = geometry[(i + 1) % geometry.length];
    if (!a || !b) return 0;
    s += a.lon * kx * (b.lat * ky) - b.lon * kx * (a.lat * ky);
  }
  return Math.abs(s) / 2;
}

/**
 * Filter a raw Overpass buildings response to the footprints actually
 * visible from (lat, lon): each way is kept only when it is within the
 * near radius AND its footprint clears the size-at-distance threshold -
 * every building you could see, and no others, bounded by geometry and
 * never by a count. Returns a REDUCED Overpass object ({elements}) of the
 * surviving ways unchanged, sorted nearest first, so the caller's
 * parseBuildings runs its heavy per-building work only on what will draw.
 */
export function lodFilterOsm(osm, lat, lon) {
  const kept = [];
  for (const el of (osm && osm.elements) || []) {
    if (el.type !== 'way' || !Array.isArray(el.geometry)) continue;
    if (el.geometry.length < 4) continue;
    const g0 = el.geometry[0];
    if (!g0) continue;
    const distM = metresBetween(lat, lon, g0.lat, g0.lon);
    if (distM > BLD_NEAR_M) continue;
    if (ringAreaM2(el.geometry) < bldLodMinArea(distM)) continue;
    kept.push({el, distM});
  }
  kept.sort((a, b) => a.distM - b.distM);
  return {elements: kept.map((k) => k.el)};
}
