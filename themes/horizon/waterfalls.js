/**
 * waterfalls.js - waterway=waterfall nodes: OSM tags a fall as a
 * NODE on the watercourse, with height=* in metres. The rule here
 * is the repo's standing one - nothing measured, nothing drawn: a
 * fall without a parseable height is skipped rather than guessed,
 * and the drawn curtain's width rides the SAME gated Leopold &
 * Maddock discharge ratio the rivers already carry (w ~ Q^0.26,
 * rivers.js B_AT_A_STATION - re-exported physics, not re-derived).
 * The curtain geometry itself is display furniture like the
 * vessels: only the measured facts (position, height, the
 * discharge ratio) are gated.
 */

import {B_AT_A_STATION} from './rivers.js';

// Display base width (m) of a drawn fall at discharge ratio 1.
export const FALL_BASE_W_M = 4;

// Height sanity bounds (m): OSM height is metres; taller than the
// tallest measured waterfall (Angel Falls 979 m) is junk data.
export const FALL_H_MIN_M = 1;
export const FALL_H_MAX_M = 1000;

/**
 * Parse waterfall nodes: keep only nodes with a finite height in
 * (FALL_H_MIN_M, FALL_H_MAX_M]. Height accepts OSM's plain-metre
 * forms ("12", "12.5", "12 m"); anything else is unmeasured.
 */
export function parseWaterfalls(json, cap = Infinity) {
  const out = [];
  for (const el of (json && json.elements) || []) {
    if (el.type !== 'node' || !el.tags) continue;
    if (el.tags.waterway !== 'waterfall') continue;
    const h = parseFloat(el.tags.height);
    if (!Number.isFinite(h) || h < FALL_H_MIN_M || h > FALL_H_MAX_M) continue;
    out.push({
      lat: el.lat,
      lon: el.lon,
      hM: h,
      name: String(el.tags.name || '').trim()
    });
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * Drawn curtain width (m) from the measured GloFAS discharge
 * ratio, through the rivers' own gated Leopold exponent:
 * w = base * ratio^0.26 (ratio 1 = the climatological river).
 */
export function fallWidthM(dischargeRatio = 1) {
  const r = Math.max(dischargeRatio, 0.05);
  return FALL_BASE_W_M * Math.pow(r, B_AT_A_STATION);
}
