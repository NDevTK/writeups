/**
 * veglod.js - spatial vegetation LOD, the third sibling of bldlod.js
 * and linelod.js. The doctrine is theirs: LOD is SPATIAL, never a
 * count. A tree is kept while its DRAWN crown still subtends an angle
 * the viewer could actually resolve; below that the instance can only
 * alias, and the ground already carries the forest's measured canopy
 * albedo through the landuse tint, so nothing real is lost.
 *
 * The threshold is the coarser of two physical limits, after Reddy
 * (1997, "Perceptually Modulated Level of Detail for Virtual
 * Environments", Univ. of Edinburgh PhD thesis):
 *  - the DISPLAY's angular sampling: Reddy Sec. 3.1.5-3.1.6 measures
 *    scene features in cycles/pixel and scales them to cycles/degree
 *    through the display field of view - one pixel is the finest
 *    feature a display can reconstruct. Under the perspective (tan)
 *    mapping a pixel's subtense varies across the frame; the FINEST
 *    pixel sits at the frame edge, d(theta) = cos^2(theta) d(tan), so
 *    the conservative threshold uses 2 tan(fov/2)/H * cos^2(fov/2) -
 *    exact, not the small-angle fov/H.
 *  - the STANDARD OBSERVER's acuity: Snellen 20/20 is the ability to
 *    separate objects subtending 1 minute of arc (Tipton 1984, via
 *    Reddy Sec. 2.3.3) - the floor when a display outresolves the eye.
 *
 * Reddy's mandate (Sec. 2.3.4): detail below these thresholds "would
 * not be available" to any later stage of vision - removing it cannot
 * change the percept. That is exactly the honesty rule this repo's
 * LOD follows: drop only what could never have been seen.
 */

// Snellen 20/20: two objects subtending 1 arcmin are just separable
// (Tipton 1984; Reddy 1997 Sec. 2.3.3, the standard observer).
export const ACUITY_ARCMIN = 1.0;

const RAD_PER_ARCMIN = Math.PI / (180 * 60);

// The finest (frame-edge) pixel subtense of a perspective display, in
// arcminutes: 2 tan(fovY/2)/H compressed by cos^2(fovY/2) - the exact
// tan-mapping derivative at the frame edge (Reddy Sec. 3.1.6 computes
// the same per-pixel visual arc from the display FOV).
export function pixelArcmin(fovYDeg, viewportHeightPx) {
  const half = ((fovYDeg / 2) * Math.PI) / 180;
  const c = Math.cos(half);
  return (((2 * Math.tan(half)) / viewportHeightPx) * c * c) / RAD_PER_ARCMIN;
}

// The LOD threshold: the display's finest pixel, floored by the
// standard observer's acuity (whichever limit is COARSER governs -
// detail below either cannot reach the percept).
export function lodThresholdArcmin(fovYDeg, viewportHeightPx) {
  return Math.max(pixelArcmin(fovYDeg, viewportHeightPx), ACUITY_ARCMIN);
}

// Exact angular width of a drawn crown of widthM at distM (metres):
// the full-angle chord subtense, no small-angle shortcut.
export function crownArcmin(widthM, distM) {
  return (2 * Math.atan(widthM / (2 * Math.max(distM, 1e-9)))) / RAD_PER_ARCMIN;
}

// Keep while the crown still subtends at least the threshold. Pure
// geometry in, decision out: no counters, no candidate order, no cap -
// the property the reference gate pins.
export function vegKeep(widthM, distM, thresholdArcmin) {
  return crownArcmin(widthM, distM) >= thresholdArcmin;
}

// The closed-form keep radius: the distance at which a crown of
// widthM subtends exactly thresholdArcmin (inverse of crownArcmin).
export function keepRadiusM(widthM, thresholdArcmin) {
  return widthM / (2 * Math.tan((thresholdArcmin * RAD_PER_ARCMIN) / 2));
}
