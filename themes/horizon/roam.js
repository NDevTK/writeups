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
