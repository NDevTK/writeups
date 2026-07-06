/**
 * Weather-radar decode and Z-R inversion - the single source shared
 * by the theme's radar sync (Horizon.html) and the reference
 * printer (radar-reference.mjs).
 *
 *  - RainViewer tile encoding (their black-and-white "dBZ values"
 *    color scheme, /{color=0}/0_0.png with smoothing and snow
 *    colorisation off): the RED channel carries reflectivity,
 *    dBZ = (R & 127) - 32 over the radar range -32..95 dBZ; bit 7
 *    of R flags SNOW; a fully transparent pixel means no radar
 *    coverage (not "no rain").
 *  - Rain: Marshall & Palmer (1948) Z = 200 R^1.6 (Z in mm^6/m^3,
 *    R in mm/h), inverted exactly: R = (10^(dBZ/10) / 200)^(1/1.6).
 *  - Snow: Sekhon & Srivastava (1970) Z = 1780 S^2.21 with S the
 *    liquid-equivalent rate (mm/h), inverted the same way.
 *  - Web Mercator tile math (the slippy-map standard): exact
 *    formulas for the tile and in-tile pixel of a lat/lon at zoom z.
 *
 * These are the classic operational relations; site-specific Z-R
 * variants exist (drop-size distributions vary by climate) but the
 * MP/SS pair is the published default the composite itself assumes.
 */

export const DBZ_MIN = -32;

// RainViewer BW scheme red channel -> {dbz, snow} (alpha handled by
// the caller: alpha 0 = no coverage).
export function decodeRed(r) {
  return {dbz: (r & 127) - 32, snow: (r & 128) === 128};
}

// Marshall-Palmer (1948) rain rate from reflectivity, mm/h.
export function rainRate(dbz) {
  if (dbz <= DBZ_MIN) return 0;
  const Z = Math.pow(10, dbz / 10);
  return Math.pow(Z / 200, 1 / 1.6);
}

// Sekhon-Srivastava (1970) snow rate (liquid equivalent), mm/h.
export function snowRate(dbz) {
  if (dbz <= DBZ_MIN) return 0;
  const Z = Math.pow(10, dbz / 10);
  return Math.pow(Z / 1780, 1 / 2.21);
}

// Forward relations, for the round-trip checks.
export function dbzOfRain(R) {
  return 10 * Math.log10(200 * Math.pow(R, 1.6));
}
export function dbzOfSnow(S) {
  return 10 * Math.log10(1780 * Math.pow(S, 2.21));
}

/**
 * Web Mercator: lat/lon (deg) at zoom z -> {tx, ty} tile indices and
 * {px, py} pixel within the 256px tile. Exact slippy-map formulas.
 */
export function tileAt(lat, lon, z) {
  const n = Math.pow(2, z);
  const xf = ((lon + 180) / 360) * n;
  const latR = (lat * Math.PI) / 180;
  const yf = ((1 - Math.asinh(Math.tan(latR)) / Math.PI) / 2) * n;
  const tx = Math.floor(xf);
  const ty = Math.floor(yf);
  return {
    tx,
    ty,
    px: Math.floor((xf - tx) * 256),
    py: Math.floor((yf - ty) * 256)
  };
}

// Ground metres per tile pixel at (lat, z) - for sizing the sampling
// window to the world footprint.
export function metresPerPixel(lat, z) {
  return (
    (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (Math.pow(2, z) * 256)
  );
}

/**
 * Reduce a decoded RGBA tile region to precipitation statistics:
 * mean rain/snow rates over COVERED pixels in a (2h+1)^2 window
 * clamped to the tile, plus coverage and snow fractions. `data` is
 * the tile's RGBA bytes (256 x 256 x 4).
 */
export function windowStats(data, px, py, h) {
  let rain = 0;
  let snow = 0;
  let covered = 0;
  let snowy = 0;
  let total = 0;
  for (let j = Math.max(py - h, 0); j <= Math.min(py + h, 255); j++) {
    for (let i = Math.max(px - h, 0); i <= Math.min(px + h, 255); i++) {
      total++;
      const k = (j * 256 + i) * 4;
      if (data[k + 3] === 0) continue; // no radar coverage
      covered++;
      const {dbz, snow: isSnow} = decodeRed(data[k]);
      if (isSnow) {
        snowy++;
        snow += snowRate(dbz);
      } else {
        rain += rainRate(dbz);
      }
    }
  }
  return {
    rain: covered ? rain / covered : 0,
    snow: covered ? snow / covered : 0,
    coverage: total ? covered / total : 0,
    snowFrac: covered ? snowy / covered : 0
  };
}
