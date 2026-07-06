/**
 * Bright satellites - the single source shared by the theme's
 * satellite fleet (Horizon.html) and the reference printer
 * (sats-reference.mjs).
 *
 * The fleet is MEASURED: CelesTrak's `visual` group - the
 * curated list of the ~150 satellites bright enough for the
 * naked eye - fetched as two-line elements through the daemon
 * (/tles, 6 h cache: CelesTrak asks exactly that of clients) and
 * propagated in the page with SGP4 via the vendored satellite.js
 * (Vallado's "Revisiting Spacetrack Report #3" implementation -
 * the research code itself, also exercised by this module's
 * reference against a real element set). The ISS keeps its own
 * existing path and is excluded from the fleet.
 *
 * What this module owns:
 *  - TLE parsing WITH the format's own integrity check: the
 *    modulo-10 checksum (sum of digits, minus signs count 1) in
 *    column 69 of each line - corrupted feeds are dropped line
 *    by line, never propagated
 *  - the cylindrical Earth-shadow test (Vallado sec. 5.3): a
 *    satellite is sunlit unless it sits behind the terminator
 *    plane AND within one Earth radius of the shadow axis - the
 *    same construction the ISS block and the NLC shell use
 *  - the standard-magnitude law of visual satellite observing
 *    (McCants convention, used by every prediction service):
 *    m = m_std + 5 log10(d / 1000 km)
 *        - 2.5 log10(f(beta) / f(90 deg))
 *    with f the Lambertian sphere phase law IMPORTED from
 *    earthshine.js - the third body lit by reflection in this
 *    theme, one phase law for all of them. m_std is the
 *    magnitude at 1000 km and half phase; intrinsic values are
 *    not distributed with GP data, so the fleet uses the
 *    naked-eye class default 4.0 (documented display choice -
 *    the GEOMETRY of every pass is exact).
 */

import {lambertPhase} from './earthshine.js';

export const STD_MAG_DEFAULT = 4.0; // naked-eye class, 1000 km half phase
export const R_EARTH_EQ = 6378.137; // WGS-84 equatorial radius, km

// TLE line checksum: digits sum, '-' counts 1, modulo 10 equals
// the last column.
export function tleChecksum(line) {
  let s = 0;
  for (let i = 0; i < 68; i++) {
    const c = line[i];
    if (c >= '0' && c <= '9') s += c.charCodeAt(0) - 48;
    else if (c === '-') s += 1;
  }
  return s % 10;
}

// Parse a name/line1/line2 TLE text into {name, norad, l1, l2}
// entries, dropping any set whose checksum fails.
export function parseTLEs(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i + 2 < lines.length + 1; i++) {
    const l1 = lines[i + 1] || '';
    const l2 = lines[i + 2] || '';
    if (!l1.startsWith('1 ') || !l2.startsWith('2 ')) continue;
    if (l1.length < 69 || l2.length < 69) continue;
    if (tleChecksum(l1) !== Number(l1[68])) continue;
    if (tleChecksum(l2) !== Number(l2[68])) continue;
    out.push({
      name: lines[i].trim(),
      norad: Number(l1.slice(2, 7)),
      l1,
      l2
    });
    i += 2;
  }
  return out;
}

// Vallado's cylindrical shadow: rEci in km, sunDir a unit vector
// toward the sun (equatorial frame). Sunlit on the sun side of
// the terminator plane, or outside the shadow cylinder.
export function sunlitEci(rEci, sunDir) {
  const dp = rEci.x * sunDir.x + rEci.y * sunDir.y + rEci.z * sunDir.z;
  if (dp >= 0) return true;
  const px = rEci.x - dp * sunDir.x;
  const py = rEci.y - dp * sunDir.y;
  const pz = rEci.z - dp * sunDir.z;
  return Math.hypot(px, py, pz) > R_EARTH_EQ;
}

// Apparent magnitude at range dKm and phase angle beta (rad).
export function satMagnitude(dKm, beta, mStd = STD_MAG_DEFAULT) {
  return (
    mStd +
    5 * Math.log10(Math.max(dKm, 1) / 1000) -
    2.5 *
      Math.log10(Math.max(lambertPhase(beta), 1e-9) / lambertPhase(Math.PI / 2))
  );
}
