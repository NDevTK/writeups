/**
 * powerlines.js - the transmission network: OSM way[power=line]
 * and way[power=minor_line], whose VERTICES are the supports
 * (that is how the network is mapped - towers/poles are the way's
 * nodes). The spans hang on the SAME gated catenary the
 * aerialways carry - solveCatenaryA / catenaryPoints and the
 * SAG_FRAC constant are re-exported physics, not re-derived (the
 * standing reuse directive; the solver's Newton iteration and the
 * unequal-support asinh vertex form are landmarked in
 * aerialways-reference.mjs).
 *
 * The doctrine calls: power=cable and location=underground are
 * SKIPPED exactly like road/rail tunnels - drawing buried plant
 * would be inventing. Support height is the way's height=* tag
 * when tagged; otherwise the display defaults below (furniture,
 * like the vessels' superstructures - only measured facts are
 * gated): TOWER_M for lines, POLE_M for minor lines.
 */

import {catenaryPoints, SAG_FRAC} from './aerialways.js';

// One sag law for every hanging cable in the theme.
export {catenaryPoints, SAG_FRAC};

// Display support heights (m) when OSM carries no height tag.
export const TOWER_M = 35;
export const POLE_M = 10;

// Height sanity bounds (m) for the tag.
export const SUPPORT_H_MIN_M = 3;
export const SUPPORT_H_MAX_M = 200;

/**
 * Parse power ways: keep line/minor_line with >= 2 vertices,
 * skip underground/cable. Returns [{pts: [[lat, lon], ...],
 * hM, minor}].
 */
export function parsePowerLines(json, cap = Infinity) {
  const out = [];
  for (const el of (json && json.elements) || []) {
    if (el.type !== 'way' || !el.tags || !el.geometry) continue;
    const p = el.tags.power;
    if (p !== 'line' && p !== 'minor_line') continue;
    if (el.tags.location === 'underground') continue;
    if (el.geometry.length < 2) continue;
    const minor = p === 'minor_line';
    const hTag = parseFloat(el.tags.height);
    const hM =
      Number.isFinite(hTag) &&
      hTag >= SUPPORT_H_MIN_M &&
      hTag <= SUPPORT_H_MAX_M
        ? hTag
        : minor
          ? POLE_M
          : TOWER_M;
    out.push({
      pts: el.geometry.map((g) => [g.lat, g.lon]),
      hM,
      minor
    });
    if (out.length >= cap) break;
  }
  return out;
}
