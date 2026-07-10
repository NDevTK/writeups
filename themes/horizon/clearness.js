/**
 * clearness.js - the daylight, measured. Open-Meteo's satellite
 * radiation API (keyless, CORS-open) serves the geostationary
 * constellations' actual observed global horizontal irradiance
 * (W/m^2) at the anchor; this module turns it into the scene's
 * ambient response through two classical, published pieces:
 *
 *  - Haurwitz (1945/46): the clear-sky global irradiance
 *    GHI_clear = 1098 cos(Z) exp(-0.057/cos(Z)) - the venerable
 *    closed-form clear-sky model, still a standard baseline.
 *    The clearness index kt = GHI_measured / GHI_clear is the
 *    whole-sky transmittance the satellite actually saw.
 *  - Erbs, Klein & Duffie (1982): the diffuse fraction kd(kt) -
 *    the standard correlation splitting global into direct and
 *    DIFFUSE. The scene's direct sun already dims per pixel
 *    (Beer-Lambert through the drawn decks) and its clear-sky
 *    diffuse comes from the sky LUT; what the measurement should
 *    drive is the AMBIENT - the diffuse skylight - and
 *    kd(kt) * kt is exactly the measured diffuse in clear-sky
 *    units. ambientFactor() normalises that to unity at the
 *    correlation's own clear-regime boundary (kt = 0.8, where
 *    kd plateaus at 0.165), so a clear sky leaves the calibrated
 *    scene untouched and the measurement rescales it - including
 *    the real, documented brightening of thin overcast (diffuse
 *    under a bright cloud deck EXCEEDS clear-sky diffuse).
 *
 * kt is only defined while the sun is meaningfully up (the
 * Haurwitz denominator vanishes at the horizon): below
 * cos(Z) = 0.1 the index is null and the caller keeps its
 * fallback.
 */

/** Haurwitz clear-sky global horizontal irradiance, W/m^2. */
export function haurwitz(cosZ) {
  if (!(cosZ > 0)) return 0;
  return 1098 * cosZ * Math.exp(-0.057 / cosZ);
}

/** Erbs, Klein & Duffie (1982) diffuse fraction - verbatim. */
export function erbsDiffuse(kt) {
  const k = Math.min(Math.max(kt, 0), 1.5);
  if (k <= 0.22) return 1 - 0.09 * k;
  if (k <= 0.8) {
    return (
      0.9511 -
      0.1604 * k +
      4.388 * k * k -
      16.638 * k * k * k +
      12.336 * k * k * k * k
    );
  }
  return 0.165;
}

/**
 * Clearness index from measured GHI (W/m^2) at solar cos(Z):
 * null while the sun is too low for the ratio to mean anything.
 * Clamped to [0, 1.3] - cloud-edge enhancement genuinely pushes
 * past 1 for moments; beyond 1.3 is sensor noise.
 */
export function clearnessIndex(ghi, cosZ) {
  if (!(cosZ > 0.1) || !Number.isFinite(ghi) || ghi < 0) return null;
  return Math.min(Math.max(ghi / haurwitz(cosZ), 0), 1.3);
}

// The correlation's clear-regime anchor: kt = 0.8, at the
// correlation's OWN kd there (the quartic's 0.16527 - a whisker
// over the plateau), so ambientFactor(0.8) = 1 identically.
const CLEAR_DIFFUSE = erbsDiffuse(0.8) * 0.8;

/**
 * The ambient's measured scale: kd(kt) * kt in units of the
 * clear-sky anchor - exactly 1 at kt = 0.8, above 1 under bright
 * thin overcast (the real effect), small under a black sky.
 * Clamped to [0.15, 2.5].
 */
export function ambientFactor(kt) {
  if (kt == null) return null;
  return Math.min(Math.max((erbsDiffuse(kt) * kt) / CLEAR_DIFFUSE, 0.15), 2.5);
}

/**
 * Pick the latest hour at or before nowMs with a finite value,
 * no older than maxAgeMs. times are the API's ISO hour strings
 * (UTC). Returns {ms, ghi} or null.
 */
export function pickHour(times, values, nowMs, maxAgeMs = 2 * 3600e3) {
  let best = null;
  for (let i = 0; i < times.length; i++) {
    const ms = Date.parse(times[i] + (times[i].endsWith('Z') ? '' : 'Z'));
    if (!Number.isFinite(ms) || ms > nowMs) continue;
    if (nowMs - ms > maxAgeMs) continue;
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    if (!best || ms > best.ms) best = {ms, ghi: v};
  }
  return best;
}
