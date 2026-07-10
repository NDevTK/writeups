/**
 * peaks.js - real summit labels. The Jungfrau panorama is famous
 * BECAUSE its peaks have names; OSM natural=peak nodes carry the
 * two facts a panorama label needs - the name and the surveyed
 * elevation - through the SAME Overpass mirrors as everything
 * else. Pure JS, gated:
 *  - parsePeaks: named peaks with their elevation parsed from the
 *    tag's wild forms ('4048.8', '4 158', comma decimals, unit
 *    suffixes); a peak without a name cannot be labelled and is
 *    dropped, a peak without an elevation keeps a name-only label.
 *  - selectPeaks: the cartographic declutter rule - rank by
 *    elevation, keep a peak only if it stands clear of every
 *    already-kept one (the fixture's own "Wengen Jungfrau", 300 m
 *    from the Jungfrau, is the case in point).
 *  - labelText: what the label says - 'Jungfrau · 4158 m'.
 */

export function parsePeaks(json) {
  const out = [];
  for (const el of (json && json.elements) || []) {
    if (el.type !== 'node' || !el.tags || !el.tags.name) continue;
    if (!Number.isFinite(el.lat) || !Number.isFinite(el.lon)) continue;
    let ele = null;
    if (el.tags.ele != null) {
      const v = parseFloat(
        String(el.tags.ele).replace(/\s+/g, '').replace(',', '.')
      );
      if (Number.isFinite(v) && v > -430 && v < 8850) ele = v;
    }
    out.push({id: el.id, name: el.tags.name, ele, lat: el.lat, lon: el.lon});
  }
  return out;
}

// Equirectangular separation in metres.
const sepM = (a, b) => {
  const mLat = 111320;
  const dx = (b.lon - a.lon) * mLat * Math.cos((a.lat * Math.PI) / 180);
  const dy = (b.lat - a.lat) * mLat;
  return Math.hypot(dx, dy);
};

/**
 * The declutter rule: elevation-ranked greedy selection - a peak
 * is labelled only if it stands at least minSepM clear of every
 * higher labelled peak. Elevation-less peaks rank last.
 */
export function selectPeaks(peaks, cap = 14, minSepM = 1800) {
  const ranked = peaks
    .slice()
    .sort((a, b) => (b.ele ?? -1e9) - (a.ele ?? -1e9));
  const kept = [];
  for (const p of ranked) {
    if (kept.length >= cap) break;
    if (kept.every((q) => sepM(p, q) >= minSepM)) kept.push(p);
  }
  return kept;
}

// The label itself: name, and the surveyed elevation when the
// node carries one (rounded to the metre - the tag's precision).
export function labelText(peak) {
  return peak.ele == null
    ? peak.name
    : peak.name + ' · ' + Math.round(peak.ele) + ' m';
}
