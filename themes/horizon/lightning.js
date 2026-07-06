/**
 * Lightning - the single source shared by the theme's flash
 * system (Horizon.html), the horizon-live daemon (server/src -
 * imports the geometry helpers) and the reference printer
 * (lightning-reference.mjs).
 *
 * The strikes are MEASURED: Blitzortung.org's community lightning
 * location network, streamed over the daemon's persistent
 * WebSocket (protocol verified live: LZW-compressed JSON state
 * frames, each strike located by dozens of volunteer stations;
 * data CC BY-SA, credited in the provenance panel). What this
 * module owns is the PHYSICS of seeing a flash:
 *
 * Flash structure - Rakov & Uman, "Lightning: Physics and
 * Effects" (Cambridge, 2003), the standard reference:
 *  - a negative cloud-to-ground FLASH is a sequence of return
 *    strokes: 15-20% are single-stroke; the rest carry 2..~15
 *    strokes with an overall mean of 3-5 (Berger's Monte San
 *    Salvatore climatology: ~3.5)
 *  - interstroke intervals have a geometric mean near 60 ms
 *  - subsequent strokes carry roughly 12 kA median peak current
 *    vs ~30 kA for the first: optically ~0.4 of the first (peak
 *    light output tracks peak current near-linearly)
 *  - 30-50% of flashes contain a CONTINUING CURRENT phase tens
 *    to ~250 ms long - the steady glow between the flickers
 * The stroke sequence generator consumes an EXPLICIT uniform
 * stream (no Math.random - deterministic under the pin harness)
 * and the flash amplitude at any instant is a sum of per-stroke
 * exponential decays plus the continuing-current plateau.
 *
 * Sight line - Koschmieder's law: atmospheric transmission over
 * distance d with meteorological visibility V is
 *   T = exp(-3.912 d / V)
 * (3.912 = -ln(0.02): visibility is DEFINED as the range where
 * contrast falls to 2%). Apparent flash brightness then falls as
 * T / d^2. Distances are great-circle (haversine, mean Earth
 * radius 6371.0088 km); the strike's scene azimuth comes from
 * the same equirectangular frame every other layer uses.
 */

// Mean Earth radius, km (IUGG).
export const R_EARTH = 6371.0088;

// Koschmieder's constant: -ln(0.02).
export const KOSCHMIEDER = 3.912;

// Great-circle distance, km.
export function haversineKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const sLat = Math.sin(((lat2 - lat1) * r) / 2);
  const sLon = Math.sin(((lon2 - lon1) * r) / 2);
  const a = sLat * sLat + Math.cos(lat1 * r) * Math.cos(lat2 * r) * sLon * sLon;
  return 2 * R_EARTH * Math.asin(Math.min(Math.sqrt(a), 1));
}

// Atmospheric transmission over d km at visibility V km.
export function transmission(dKm, visKm = 25) {
  return Math.exp((-KOSCHMIEDER * dKm) / visKm);
}

// Relative apparent brightness of a flash at distance d:
// inverse-square with Koschmieder extinction, normalized so
// d = 10 km, V = 25 km gives 1 (a nearby storm).
export function apparentFlash(dKm, visKm = 25) {
  const d = Math.max(dKm, 1);
  return (100 / (d * d)) * (transmission(d, visKm) / transmission(10, visKm));
}

// True bearing (deg, 0 = north, 90 = east) from the observer to
// the strike in the local equirectangular frame - the same
// small-domain approximation the DEM/OSM/traffic layers share.
export function strikeBearing(obs, strike) {
  const dLon =
    (strike.lon - obs.lon) *
    Math.cos(((obs.lat + strike.lat) / 2) * (Math.PI / 180));
  const dLat = strike.lat - obs.lat;
  return ((Math.atan2(dLon, dLat) * 180) / Math.PI + 360) % 360;
}

// ---- Rakov & Uman flash sequence -------------------------------
// rand: array of uniforms in [0,1), consumed left to right (pass
// seeded values; the generator itself never touches Math.random).
// Returns {strokes: [{t (s), amp}], cc: {t0, dur, amp} | null,
// dur} with the first stroke at t = 0 and amp = 1.
export const SINGLE_STROKE_P = 0.17; // Rakov & Uman: 15-20%
export const SUBSEQUENT_RATIO = 0.4; // ~12 kA / ~30 kA
export const INTERSTROKE_MS = 60; // geometric mean
export const CC_FRACTION = 0.4; // 30-50% carry continuing current

export function strokeSequence(rand) {
  let i = 0;
  const u = () => rand[i++ % rand.length];
  let n;
  if (u() < SINGLE_STROKE_P) n = 1;
  else n = Math.min(2 + Math.floor(Math.log(1 - u()) / Math.log(1 - 0.35)), 15);
  const strokes = [{t: 0, amp: 1}];
  let t = 0;
  for (let k = 1; k < n; k++) {
    // lognormal about the 60 ms geometric mean (sigma_ln 0.55)
    const z =
      Math.sqrt(-2 * Math.log(Math.max(u(), 1e-12))) *
      Math.cos(2 * Math.PI * u());
    t += (INTERSTROKE_MS / 1000) * Math.exp(0.55 * z);
    const jz =
      Math.sqrt(-2 * Math.log(Math.max(u(), 1e-12))) *
      Math.cos(2 * Math.PI * u());
    strokes.push({t, amp: SUBSEQUENT_RATIO * Math.exp(0.3 * jz)});
  }
  let cc = null;
  if (u() < CC_FRACTION) {
    const after = strokes[Math.min(Math.floor(u() * n), n - 1)];
    cc = {
      t0: after.t,
      // 40-250 ms, log-uniform (Rakov & Uman's tens-to-hundreds)
      dur: 0.04 * Math.exp(Math.log(250 / 40) * u()),
      amp: 0.12
    };
  }
  const end = Math.max(strokes[strokes.length - 1].t, cc ? cc.t0 + cc.dur : 0);
  return {strokes, cc, dur: end + 0.05};
}

// Optical amplitude of the flash at time t (s) since the first
// stroke: per-stroke exponential afterglow (tau ~ 8 ms - the
// luminous phase plus display persistence) over the
// continuing-current plateau.
export const STROKE_TAU = 0.008;

export function flashAmplitude(seq, t) {
  let a = 0;
  for (const s of seq.strokes) {
    if (t >= s.t) a += s.amp * Math.exp(-(t - s.t) / STROKE_TAU);
  }
  if (seq.cc && t >= seq.cc.t0 && t <= seq.cc.t0 + seq.cc.dur) {
    a += seq.cc.amp;
  }
  return a;
}
