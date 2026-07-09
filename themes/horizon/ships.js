/**
 * Ships - the single source shared by the theme's AIS vessel
 * system (Horizon.html) and the reference printer
 * (ships-reference.mjs).
 *
 * The vessels are MEASURED: live AIS position reports around the
 * visitor via the horizon-live daemon (/ais route: aisstream.io
 * over the daemon's persistent WebSocket, the API key held on the
 * box - their terms forbid exposing it to browsers, which a
 * static site could never honour). What this module owns is the
 * PHYSICS of seeing a ship:
 *
 * Navigation lights - COLREGS (International Regulations for
 * Preventing Collisions at Sea, 1972), the law every vessel
 * actually obeys:
 *  - Rule 21 fixes the arcs EXACTLY: masthead light 225 deg
 *    (right ahead to 22.5 deg abaft the beam on each side),
 *    sidelights 112.5 deg each (green starboard, red port),
 *    sternlight 135 deg centred dead aft. Side + stern arcs tile
 *    the full circle: 112.5 + 112.5 + 135 = 360.
 *  - Rule 22 fixes minimum visible ranges for vessels >= 50 m:
 *    masthead 6 nm, sidelights 3 nm, sternlight 3 nm.
 *  - Annex I section 8 converts range to luminous intensity:
 *      I = 3.43e6 x T x D^2 x K^-D   [candela]
 *    with T = 2e-7 lux (the adopted threshold of illuminance)
 *    and K = 0.8 (atmospheric transmissivity per nm, i.e. a
 *    13 nm meteorological visibility). This gives the published
 *    table: 0.9 cd at 1 nm, 12 cd at 3 nm, 94 cd at 6 nm.
 *  - Allard's law gives the apparent illuminance at the eye:
 *      E = I x K^(d/1852) / d^2      [lux, d in metres]
 *    The constant 3.43e6 IS 1852^2 (rounded to 3 figures): at
 *    exactly the rated range the eye receives exactly the
 *    threshold T - the regulation is Allard's law solved for I.
 *  - Rule 20(b): lights are carried from sunset to sunrise -
 *    geometric solar altitude below -50 arcmin (-0.8333 deg),
 *    the standard refraction + semidiameter horizon.
 *
 * Kinematics: AIS SOG is in knots over ground, COG/heading in
 * degrees true (ITU-R M.1371 sentinels handled daemon-side).
 * The scene mapping mirrors the aircraft path (equirectangular
 * offsets, exact international knot).
 */

// Exact international knot (m/s) - must equal contrails.KT_MS
// (asserted by the reference).
export const KT_MS = 0.514444;

// Rule 20(b): sunset/sunrise boundary as geometric solar
// altitude (34' refraction + 16' semidiameter = -50').
export const SUNSET_ELEV = -50 / 60;

// Rule 22(a), vessels of 50 m or more in length: minimum
// luminous ranges in nautical miles.
export const RANGE_NM = {masthead: 6, side: 3, stern: 3};

// Rule 22 in full - minimum luminous ranges (nm) by vessel
// length: (a) >= 50 m: masthead 6, side 3, stern 3; (b) >= 12 m
// but < 50 m: masthead 5 (3 if under 20 m), side 2, stern 2;
// (c) < 12 m: masthead 2, side 1, stern 2.
export function rangesFor(lenM) {
  if (lenM >= 50) return {masthead: 6, side: 3, stern: 3};
  if (lenM >= 12) return {masthead: lenM >= 20 ? 5 : 3, side: 2, stern: 2};
  return {masthead: 2, side: 1, stern: 2};
}

// ITU-R M.1371 ship-type code (AIS message 5 "Type") -> the
// silhouette class the theme draws. First digit is the family;
// 30-37 are specific craft.
export function typeClass(t) {
  if (t === 30) return 'fishing';
  if (t === 31 || t === 32 || t === 52) return 'tug';
  if (t === 36) return 'sailing';
  if (t === 37) return 'pleasure';
  const d = Math.floor((t || 0) / 10);
  if (d === 4) return 'hsc';
  if (d === 6) return 'passenger';
  if (d === 7) return 'cargo';
  if (d === 8) return 'tanker';
  return 'other';
}

/**
 * The vessel's light plan from its MEASURED length and beam -
 * COLREGS made concrete:
 *  - Rule 23(a): power-driven vessels carry a forward masthead
 *    light, and a second one abaft and higher when >= 50 m.
 *  - Rule 25(b): sailing vessels underway carry sidelights and
 *    sternlight ONLY - no masthead light.
 *  - Annex I 2(a): forward masthead height >= 6 m above the hull
 *    (>= the beam if broader, need not exceed 12 m); the after
 *    masthead at least 4.5 m vertically higher.
 *  - Annex I 3(a): horizontal separation of the mastheads at
 *    least half the vessel's length (need not exceed 100 m); the
 *    forward light no more than a quarter length from the stem.
 *  - Rule 22 ranges via rangesFor.
 * Ship frame: metres, bow at z = -len/2, +y up. Returns
 * {mastheads: [{y, z}...], sideY, sternY, ranges}.
 */
export function lightPlan(lenM, beamM, cls) {
  const len = Math.max(lenM || 0, 6);
  const beam = Math.max(beamM || 0, 2);
  const ranges = rangesFor(len);
  // Sailing (Rule 25(b)): no masthead light; side/stern heights
  // are display placement near deck level (the regulation fixes
  // the arcs and ranges, not a sailing hull's geometry).
  if (cls === 'sailing')
    return {
      mastheads: [],
      sideY: Math.min(0.15 * len, 3),
      sternY: Math.min(0.1 * len, 2),
      ranges
    };
  const h1 = Math.min(Math.max(6, beam), 12);
  const zFwd = -len / 2 + Math.min(len / 4, len * 0.2);
  const mastheads = [{y: h1, z: zFwd}];
  if (len >= 50) {
    const sep = Math.min(Math.max(len / 2, 0), 100);
    mastheads.push({y: h1 + 4.5, z: zFwd + sep});
  }
  // Annex I 2(g): sidelights not above three quarters of the
  // forward masthead height.
  return {mastheads, sideY: 0.6 * h1, sternY: 0.4 * h1, ranges};
}

// Annex I section 8: luminous intensity (candela) for a light
// required to be visible at D nautical miles. T = 2e-7 lux
// threshold, K = 0.8 atmospheric transmissivity.
export function luminousIntensity(D, K = 0.8, T = 2e-7) {
  return 3.43e6 * T * D * D * Math.pow(K, -D);
}

// Allard's law: apparent illuminance (lux) at distance d metres
// from a light of intensity I candela through transmissivity K
// per nautical mile.
export function apparentLux(I, dM, K = 0.8) {
  return (I * Math.pow(K, dM / 1852)) / (dM * dM);
}

// Rule 21 arcs. rel = relative bearing of the OBSERVER from the
// ship's bow, degrees clockwise [0, 360). Sidelights run from
// right ahead to 22.5 deg abaft the beam (112.5 deg each); the
// sternlight fills the remaining 135 deg; the masthead light
// spans both sidelight arcs (225 deg).
export function lightArcs(rel) {
  const r = ((rel % 360) + 360) % 360;
  const starboard = r <= 112.5;
  const port = r >= 247.5 || r === 0;
  const stern = r > 112.5 && r < 247.5;
  return {starboard, port, stern, masthead: starboard || port};
}

// Relative bearing of the observer from the ship's bow. Scene
// frame: +x east, +z south (north = -z), headings in degrees
// true (0 = north, 90 = east).
export function relBearing(headingDeg, ship, obs) {
  const bearing =
    (Math.atan2(obs.x - ship.x, -(obs.z - ship.z)) * 180) / Math.PI;
  return (((bearing - headingDeg) % 360) + 360) % 360;
}

// Map one AIS ship into the scene: equirectangular offsets from
// the reference (the same mapping the theme uses for OSM, DEM
// and aircraft), course/speed-over-ground as a scene-space
// velocity on the water plane (y is owned by the theme's tide).
// ref = {lat, lon, halfM, world, mpu}.
export function aisToScene(ship, ref) {
  const mLat = 111320;
  const mLon = Math.max(mLat * Math.cos((ref.lat * Math.PI) / 180), 1e-6);
  const dLat = ref.halfM / mLat;
  const dLon = ref.halfM / mLon;
  const x = ((ship.lon - ref.lon) / (2 * dLon)) * ref.world;
  const z = (-(ship.lat - ref.lat) / (2 * dLat)) * ref.world;
  const sp = ((ship.sog || 0) * KT_MS) / ref.mpu; // scene units/s
  const dir = ship.cog !== null && ship.cog !== undefined ? ship.cog : 0;
  const tr = (dir * Math.PI) / 180;
  return {x, z, vx: sp * Math.sin(tr), vz: -sp * Math.cos(tr), sp};
}
