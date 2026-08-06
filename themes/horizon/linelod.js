/**
 * linelod.js - honest level-of-detail for OSM LINE networks (the
 * roads), the line-layer sibling of bldlod.js and veglod.js, gated by
 * linelod-reference.mjs.
 *
 * Roads had the same lie as the buildings once: parse, sort by class,
 * slice(0, 500). The first honest pass replaced the count with a
 * hand-tuned CLASS table (motorway 8 km ... path 600 m) plus a length
 * bonus - spatial, but every number in it was invented, and it kept
 * dropping ALREADY-DOWNLOADED, plainly visible ways: a hiking trail
 * 1.3 km across an alpine valley subtends whole arcminutes of extent
 * (resolvable many times over) and the table cut it at 600 m while
 * the fetch had already paid for it. A budget dressed as perception.
 *
 * veglod.js wrote the real angle down (Reddy 1997: the display's
 * finest pixel, floored by the Snellen observer's 1 arcmin), and for
 * a LINE feature the honest test is its EXTENT: a way whose whole
 * drawn extent subtends less than the threshold cannot structure the
 * percept - drop it and nothing that could have been seen is lost. A
 * sub-pixel-WIDE road, by contrast, still crosses hundreds of pixels
 * along its length: presence survives where width does not, so width
 * licenses no drop (the same argument that keeps a distant wire
 * against the sky). The subtense law is veglod's own chordArcmin,
 * re-exported, not re-derived.
 *
 * What bounds the download is the FETCH, stated as such at the call
 * site (Horizon.html): all classes within the near pass, arterial
 * classes across the box - a feasibility budget in the open, not a
 * perceptual claim. Everything fetched is then kept unless its whole
 * extent could never have been seen.
 *
 * Distance is to the NEAREST vertex of the way (a road passing far
 * off but reaching toward you is near where it reaches). Cheap
 * equirectangular metres, exact enough for LOD over a box.
 */

import {crownArcmin as chordArcmin, vegKeep as extentKeep} from './veglod.js';

// The one chord-subtense law (veglod.js): full-angle 2 atan(x / 2d).
export {chordArcmin};

const R_EARTH_M = 6371000;
const RAD = Math.PI / 180;

// Nearest-vertex distance (m) from (lat, lon) to a polyline of [lat,lon]
// points, in a local equirectangular frame around the view.
export function nearestDistM(pts, lat, lon) {
  if (!Array.isArray(pts) || !pts.length) return Infinity;
  const kx = Math.cos(lat * RAD);
  let best = Infinity;
  for (const p of pts) {
    if (!p) continue;
    const x = (p[1] - lon) * kx;
    const y = p[0] - lat;
    const d = (x * x + y * y) * RAD * RAD * R_EARTH_M * R_EARTH_M;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

// Keep while the way's whole extent still subtends the threshold -
// veglod's own keep decision applied to the line's length. Pure
// geometry in, decision out: no counters, no classes, no cap.
export function lineKeep(lenM, distM, thresholdArcmin) {
  return extentKeep(lenM, distM, thresholdArcmin);
}

/**
 * Keep the fetched ways visible from (lat, lon). Each feature needs
 * {pts:[[lat,lon]], len}. thresholdArcmin is the shared display
 * threshold (veglod.js lodThresholdArcmin). A way survives while its
 * extent subtends at least the threshold at its nearest distance -
 * bounded by geometry, never by a count or a class. Sorted nearest
 * first.
 */
export function lodFilterRoads(features, lat, lon, thresholdArcmin) {
  const kept = [];
  for (const f of features || []) {
    const d = nearestDistM(f.pts, lat, lon);
    if (!lineKeep(f.len || 0, d, thresholdArcmin)) continue;
    kept.push({f, d});
  }
  kept.sort((a, b) => a.d - b.d);
  return kept.map((k) => k.f);
}
