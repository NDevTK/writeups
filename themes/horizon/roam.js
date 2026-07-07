/**
 * Roam - the single source shared by the theme's terrain-streaming
 * walk system (Horizon.html) and the reference printer
 * (roam-reference.mjs).
 *
 * The world is ONE equirectangular box: 2*DEM_HALF_M metres of
 * real DEM mapped onto WORLD scene units around a geodetic anchor,
 * and every subsystem (aircraft, ships, forests, radar,
 * bathymetry) shares that mapping. Roaming does not mosaic tiles -
 * it RE-ANCHORS: when the free camera has flown ROAM_TRIGGER_M
 * metres from the anchor, the theme fetches a fresh box centred on
 * the camera's geodetic position and swaps it in, rewriting the
 * camera exactly (the geodetic point it occupies becomes the new
 * origin; its absolute altitude survives the asinh datum change).
 * Because the anchor moves to wherever the camera IS, the walk is
 * a chain of exact closed-form transforms - nothing accumulates.
 *
 * What lives here is the exact geodesy of that swap:
 *  - geoToScene / sceneToGeo: the theme's equirectangular mapping
 *    and its algebraic inverse. The forward map is THE one the
 *    fleet already uses (ships.aisToScene, contrails.adsbToScene,
 *    the OSM forests, the DEM itself) - the reference holds them
 *    equal so the model lives once.
 *  - MPU = 2*DEM_HALF_M / WORLD: the exact metres-per-scene-unit
 *    the mapping implies (57.142857..; the theme's former 57.14
 *    literal was a 0.005% approximation of its own constant).
 *  - elevOfY / yOfElev: the asinh altitude compression and its
 *    exact inverse, for carrying the camera's absolute altitude
 *    across the anchor's new elevation datum.
 *  - roamDecision: the trigger geometry. ROAM_TRIGGER_M is half
 *    the box half-width, so at the moment a re-anchor starts
 *    there are still DEM_HALF_M - ROAM_TRIGGER_M metres of real
 *    data between the camera and the void, and the stitched tile
 *    canvas extends further still.
 */

// The box: metres of real DEM from the anchor to each edge, and
// the scene units it maps onto. These are THE world constants -
// Horizon.html imports them from here.
export const DEM_HALF_M = 8000;
export const WORLD = 280;
export const MPU = (2 * DEM_HALF_M) / WORLD; // exact metres per scene unit
export const M_LAT = 111320; // metres per degree of latitude

// Re-anchor when the camera is this far (metres) from the anchor:
// half the box half-width - real terrain keeps rendering all the
// way through the fetch.
export const ROAM_TRIGGER_M = DEM_HALF_M / 2;
// Breather between successful hops (a hop rebuilds the world).
export const ROAM_COOLDOWN_MS = 8000;
// After a failed fetch (offline, polar mercator, tile gap): hold
// position - the camera stays clamped to the current box - and
// retry later.
export const ROAM_RETRY_MS = 30000;

// The theme's scene mapping: equirectangular offsets from the
// anchor, +x east, +z south, DEM_HALF_M metres = WORLD/2 units.
// Identical to the embedded mapping in ships.aisToScene and
// contrails.adsbToScene (held equal by the reference).
export function geoToScene(lat, lon, anchor) {
  const mLon = Math.max(M_LAT * Math.cos((anchor.lat * Math.PI) / 180), 1e-6);
  const dLat = DEM_HALF_M / M_LAT;
  const dLon = DEM_HALF_M / mLon;
  return {
    x: ((lon - anchor.lon) / (2 * dLon)) * WORLD,
    z: (-(lat - anchor.lat) / (2 * dLat)) * WORLD
  };
}

// Exact algebraic inverse: where on Earth is this scene point?
export function sceneToGeo(x, z, anchor) {
  const mLon = Math.max(M_LAT * Math.cos((anchor.lat * Math.PI) / 180), 1e-6);
  const dLat = DEM_HALF_M / M_LAT;
  const dLon = DEM_HALF_M / mLon;
  return {
    lat: anchor.lat - (z / WORLD) * 2 * dLat,
    lon: anchor.lon + (x / WORLD) * 2 * dLon
  };
}

// The theme's asinh altitude compression (y scene units for e
// metres above sea level, around the box's elevation datum) and
// its exact inverse. Swapping datums = elevOfY under the old,
// yOfElev under the new: absolute altitude is the invariant.
export function yOfElev(e, centerElev) {
  return 16 * Math.asinh((e - centerElev) / 500);
}
export function elevOfY(y, centerElev) {
  return centerElev + 500 * Math.sinh(y / 16);
}

// The roam gate. st = {pending, notBefore}; distM = metres from
// the anchor; now = ms clock (explicit - nothing here reads the
// wall clock).
export function roamDecision(distM, st, now) {
  if (st.pending) return 'wait';
  if (now < st.notBefore) return 'cooldown';
  return distM >= ROAM_TRIGGER_M ? 'go' : 'stay';
}

// ---- Earth-anchored dressing --------------------------------------
// The DEM is geodetic (the Mercator canvas is indexed by lat/lon,
// so the mountains agree exactly between overlapping boxes), but
// scene-space dressing would re-roll on every re-anchor: the same
// hillside would grow different micro-relief and different trees
// each time it was rendered from a new box. So dressing is seeded
// by the POINT, never by the box - the property "two boxes agree
// wherever they overlap" is a landmark, not a hope.

// The micro-relief wavelength the theme has always used: fbm(x/7)
// with 7 scene units = exactly 400 m (MPU is exactly 400/7).
export const MICRO_M = 400;

// Deterministic integer hash -> [0,1) (the same avalanche family
// as the theme's mulberry32, applied to a 3D lattice point).
function hash3(x, y, z) {
  let a =
    (Math.imul(x | 0, 374761393) ^
      Math.imul(y | 0, 668265263) ^
      Math.imul(z | 0, 1440662683)) |
    0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// 3D value noise (trilinear, smoothstep) - period-free, so the
// whole Earth fits without the wrapping grid the theme's 2D
// noise uses.
export function noise3(x, y, z) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const tx = smooth(x - xi);
  const ty = smooth(y - yi);
  const tz = smooth(z - zi);
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return lerp(
    lerp(
      lerp(c(0, 0, 0), c(1, 0, 0), tx),
      lerp(c(0, 1, 0), c(1, 1, 0), tx),
      ty
    ),
    lerp(
      lerp(c(0, 0, 1), c(1, 0, 1), tx),
      lerp(c(0, 1, 1), c(1, 1, 1), tx),
      ty
    ),
    tz
  );
}

// Micro-relief for a scene point: the theme's exact fbm octave
// weights (0.55/0.27/0.13/0.05 at 1/2.1/4.3/8.9) over 3D value
// noise on the Earth sphere, base wavelength MICRO_M. 3D-on-the-
// sphere rather than a lat/lon plane because any 2D unrolling of
// the globe shears somewhere (lon*cos(lat) drifts by
// lonRad*sin(lat) metres of texture per metre walked north -
// 21:1 streaks at 170 deg E); the sphere embedding is isometric
// everywhere. Range [0,1] like the theme's fbm; the theme keeps
// its documented `micro * (relief - 0.5)` amplitude.
const R_DRESS = M_LAT * (180 / Math.PI); // the map convention's own Earth radius
export function microRelief(x, z, anchor) {
  const g = sceneToGeo(x, z, anchor);
  const la = (g.lat * Math.PI) / 180;
  const lo = (g.lon * Math.PI) / 180;
  const s = R_DRESS / MICRO_M;
  const px = s * Math.cos(la) * Math.cos(lo);
  const py = s * Math.cos(la) * Math.sin(lo);
  const pz = s * Math.sin(la);
  return (
    0.55 * noise3(px, py, pz) +
    0.27 * noise3(px * 2.1 + 13, py * 2.1 + 7, pz * 2.1 + 29) +
    0.13 * noise3(px * 4.3 + 41, py * 4.3 + 3, pz * 4.3 + 11) +
    0.05 * noise3(px * 8.9 + 5, py * 8.9 + 59, pz * 8.9 + 23)
  );
}

// Trees are Earth-anchored the same way: the world is tiled by
// fixed geodetic cells (TREE_CELL_M of latitude on a side; the
// longitude side narrows as cos(lat), which the acceptance draw
// compensates exactly, so areal candidate density is uniform).
// Every cell hashes to one deterministic candidate - position
// jitter, species, size, sway phase - so the same wood grows the
// same trees no matter which box renders it or how many times.
// Candidates come back sorted by their hash so a display budget
// (the theme takes the first N that pass its physical tests)
// selects a spatially unbiased, deterministic subset.
export const TREE_CELL_M = 150;
export function treeCandidates(anchor, marginUnits = 20) {
  const dCell = TREE_CELL_M / M_LAT; // degrees per cell, both axes
  const half = ((WORLD / 2 - marginUnits) * MPU) / M_LAT; // deg lat
  const halfLon =
    ((WORLD / 2 - marginUnits) * MPU) /
    Math.max(M_LAT * Math.cos((anchor.lat * Math.PI) / 180), 1e-6);
  const i0 = Math.floor((anchor.lat - half) / dCell);
  const i1 = Math.ceil((anchor.lat + half) / dCell);
  const j0 = Math.floor((anchor.lon - halfLon) / dCell);
  const j1 = Math.ceil((anchor.lon + halfLon) / dCell);
  const out = [];
  const lim = (WORLD - 2 * marginUnits) / 2;
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const key = hash3(i, j, 0);
      const lat = (i + hash3(i, j, 1)) * dCell;
      // Acceptance ~ cos(lat): cells narrow east-west with
      // latitude, so keeping cos of them restores uniform
      // candidates per square metre exactly.
      if (key >= Math.cos((lat * Math.PI) / 180)) continue;
      const lon = (j + hash3(i, j, 2)) * dCell;
      const s = geoToScene(lat, lon, anchor);
      if (Math.abs(s.x) > lim || Math.abs(s.z) > lim) continue;
      out.push({
        x: s.x,
        z: s.z,
        lat,
        lon,
        key,
        r: [
          hash3(i, j, 3),
          hash3(i, j, 4),
          hash3(i, j, 5),
          hash3(i, j, 6),
          hash3(i, j, 7)
        ]
      });
    }
  }
  out.sort((a, b) => a.key - b.key || a.lat - b.lat || a.lon - b.lon);
  return out;
}

// ---- roam URL + sync pacing ----------------------------------------
// Roaming is the SAME session walking, not a fresh start: the URL
// keeps everything it had (including harness pins like ?time -
// explore's relocateURL deliberately drops those, roam must not)
// and only the coordinates move. `place` is dropped - the label
// stops being true the moment you walk away from it.
export function roamURL(search, lat, lon) {
  const p = new URLSearchParams(search);
  p.set('lat', lat.toFixed(4));
  p.set('lon', lon.toFixed(4));
  p.delete('place');
  return '?' + p.toString();
}

// Re-anchoring the terrain is per-hop, but the API re-syncs
// (weather, marine, radar, forests, BRDF, polls) wait for the
// camera to SETTLE - hammering third parties once per 8 s hop
// during a long flight measures nothing the sky can show. The
// force-hops backstop still refreshes a pilot who never stops.
export const ROAM_SETTLE_MS = 4000;
export const ROAM_FORCE_HOPS = 3;
export function settleDue(dirty, idleMs, hopsSince) {
  if (!dirty) return false;
  return idleMs >= ROAM_SETTLE_MS || hopsSince >= ROAM_FORCE_HOPS;
}
