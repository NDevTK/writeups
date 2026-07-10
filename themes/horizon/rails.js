/**
 * rails.js - real railways. Around Interlaken the rail network IS
 * the landscape: the standard-gauge Thun line, the metre-gauge
 * Berner Oberland-Bahn, 800 mm rack lines and the Harderbahn
 * funicular. OSM way[railway] through the SAME Overpass mirrors,
 * rendered through the SAME gated ribbon builder as the roads and
 * rivers (roadsGeometry - exactness, terrain following, water
 * strip-breaking and bridge spanning gated ONCE and shared). This
 * module owns only what is rail-specific:
 *  - railWidthOf: the width ladder is MEASURED where the data
 *    allows - the captured census tags gauge on 288 of 300 ways -
 *    bed width = tracks x (gauge + 2.6 m ballast shoulders, ~1.3 m
 *    each side, the standard formation allowance), falling to
 *    tracks x 4 m without a gauge, then per-type defaults.
 *  - parseRailways: tunnelled reaches SKIPPED (the Alps route
 *    trains underground; drawing them would be inventing); the
 *    bridge tag CARRIES to the shared builder - the rail bridges
 *    over the Aare genuinely span it.
 */

import {lengthM, roadsGeometry} from './roads.js';

// Per-type bed widths when neither gauge nor tracks speak.
export const RAIL_WIDTH = {
  rail: 4,
  light_rail: 3.7,
  narrow_gauge: 3.4,
  tram: 3.4,
  funicular: 2.8
};
export const SHOULDER_M = 2.6; // ballast both sides of the gauge

// Ballast-bed albedo (linear); rails vanish below texel size.
export const RAIL_COLOR = [0.19, 0.18, 0.17];

export function railWidthOf(tags = {}) {
  let tracks = parseFloat(tags.tracks);
  if (!Number.isFinite(tracks) || tracks < 1 || tracks > 12) tracks = 1;
  const gauge = parseFloat(tags.gauge);
  if (Number.isFinite(gauge) && gauge >= 300 && gauge <= 3000)
    return tracks * (gauge / 1000 + SHOULDER_M);
  return tracks * (RAIL_WIDTH[tags.railway] ?? 4);
}

/**
 * Overpass railway ways -> ribbon-builder inputs. Tunnelled
 * reaches and unknown types are dropped; the bridge tag rides
 * through so decks span water; longest lines first under the cap.
 */
export function parseRailways(json, cap = 300, minLenM = 50) {
  const out = [];
  for (const el of (json && json.elements) || []) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const tags = el.tags || {};
    if (!(tags.railway in RAIL_WIDTH)) continue;
    if (tags.tunnel && tags.tunnel !== 'no') continue; // underground
    const pts = el.geometry.map((g) => [g.lat, g.lon]);
    const len = lengthM(pts);
    if (len < minLenM) continue;
    out.push({
      id: el.id,
      pts,
      len,
      wM: railWidthOf(tags),
      color: RAIL_COLOR,
      bridge: tags.bridge === 'yes' || tags.bridge === 'viaduct',
      kind: tags.railway,
      name: tags.name || ''
    });
  }
  out.sort((a, b) => b.len - a.len);
  return out.slice(0, cap);
}

// The geometry IS the roads' gated ribbon builder (see rivers.js
// for the same reuse) - one exactness gate, three consumers.
export const railsGeometry = roadsGeometry;
