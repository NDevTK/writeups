/**
 * rivers.js - real watercourses. The lakes module put polygon
 * water where OSM draws riverbanks, but most of the network is
 * LINEAR: waterway=river/stream/canal ways - the Aare's arms, the
 * Lütschine, every alpine stream. Through the SAME Overpass
 * mirrors, and rendered through the SAME gated ribbon builder the
 * roads use (roadsGeometry - the exactness identity, water
 * strip-breaking and terrain following are gated ONCE and shared,
 * not re-derived). This module owns only what is water-specific:
 *  - riverWidthOf: the waterway width ladder - the `width` tag
 *    when present, else documented defaults by waterway type. The
 *    captured census says the ladder matters: width was tagged on
 *    6 of 300 Interlaken watercourses.
 *  - parseWaterways: tunnelled reaches are SKIPPED (an underground
 *    watercourse is invisible by definition - 70 of the 300
 *    captured ways are tagged tunnel); unknown waterway types are
 *    dropped; class-ranked cap keeps the big water first.
 * A watercourse reaching a lake or the sea stops at the shore:
 * the shared builder breaks ribbons where groundY says water,
 * and the polygon surface takes over - one water, two sources.
 */

import {lengthM, roadsGeometry} from './roads.js';

// The waterway width ladder (metres).
export const WATER_WIDTH = {
  river: 10,
  canal: 5,
  stream: 2.5,
  drain: 1.2,
  ditch: 1
};
export const DEFAULT_WATER_WIDTH = 2;

// Linear deep-water albedo (the lakes' Water mesh handles real
// reflection; ribbons read as the dark band real streams are).
export const RIVER_COLOR = [0.05, 0.11, 0.14];

export function riverWidthOf(tags = {}) {
  const w = parseFloat(String(tags.width || '').replace(',', '.'));
  if (Number.isFinite(w) && w > 0.3 && w < 400) return w;
  return WATER_WIDTH[tags.waterway] ?? DEFAULT_WATER_WIDTH;
}

const RANK = ['river', 'canal', 'stream', 'drain', 'ditch'];

/**
 * Overpass waterway ways -> ribbon-builder inputs [{id, pts, len,
 * wM, color, bridge, kind, name}]. Tunnelled reaches and unknown
 * types are dropped; stubs under minLenM are invisible; the cap
 * keeps rivers before streams before ditches, longest first.
 */
export function parseWaterways(json, cap = 300, minLenM = 50) {
  const out = [];
  for (const el of (json && json.elements) || []) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const tags = el.tags || {};
    const rank = RANK.indexOf(tags.waterway);
    if (rank < 0) continue;
    if (tags.tunnel && tags.tunnel !== 'no') continue; // underground
    const pts = el.geometry.map((g) => [g.lat, g.lon]);
    const len = lengthM(pts);
    if (len < minLenM) continue;
    out.push({
      id: el.id,
      pts,
      len,
      rank,
      wM: riverWidthOf(tags),
      color: RIVER_COLOR,
      bridge: false, // water never bridges water
      kind: tags.waterway,
      name: tags.name || ''
    });
  }
  out.sort((a, b) => a.rank - b.rank || b.len - a.len);
  return out.slice(0, cap);
}

// The geometry IS the roads' gated ribbon builder - re-exported
// under the water name so call sites read honestly. groundY null
// (lake, sea) breaks the ribbon at the shore.
export const riversGeometry = roadsGeometry;

// ---- Hydraulic geometry: the MEASURED flow drives the width ----
// Leopold & Maddock (1953, USGS Professional Paper 252):
// at-a-station hydraulic geometry - a river cross-section widens
// with discharge as w = a Q^b, their canonical at-a-station width
// exponent b ~= 0.26. Applied as a RATIO against the recent
// reference flow, the tag/ladder width stays the calibration and
// today's GloFAS discharge moves it: w_today = w_ladder x
// (Q_today / Q_ref)^0.26.
export const B_AT_A_STATION = 0.26;

// The reference flow: the median of the recent daily record (the
// same source, so the ratio is internally consistent). Null when
// the record is too short to mean anything.
export function refDischarge(series, minDays = 14) {
  const vals = (series || []).filter((v) => Number.isFinite(v) && v > 0);
  if (vals.length < minDays) return null;
  const s = vals.slice().sort((a, b) => a - b);
  return s[(s.length - 1) >> 1];
}

// Today's width multiplier. No data (or nonsense) means factor 1:
// the ladder width stands unchanged - nothing is invented. The
// clamp keeps a drought or a flood within believable render
// bounds without touching the exponent.
export function dischargeFactor(qNow, qRef, b = B_AT_A_STATION) {
  if (
    !Number.isFinite(qNow) ||
    !Number.isFinite(qRef) ||
    qNow <= 0 ||
    qRef <= 0
  )
    return 1;
  return Math.min(2, Math.max(0.5, Math.pow(qNow / qRef, b)));
}
