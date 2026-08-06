// veglod-reference.mjs - the gate for the spatial vegetation LOD.
// Landmarks:
//  - the Snellen acuity floor (20/20 separates 1 arcmin; Tipton 1984
//    via Reddy 1997 Sec. 2.3.3) engages exactly when a display
//    outresolves the eye
//  - the frame-edge pixel subtense is the EXACT tan-mapping derivative
//    2 tan(f/2)/H cos^2(f/2), checked against an independent finite
//    difference of the projection, and against the small-angle fov/H
//    it replaces (which overstates the edge pixel by ~1/cos^2 terms)
//  - keepRadiusM inverts crownArcmin exactly (roundtrip), and vegKeep
//    flips across that radius
//  - monotonicity: a wider crown carries further; a taller viewport
//    (finer pixels) carries everything further
//  - the doctrine: the decision is a pure function of geometry - same
//    inputs, same answer, no counter anywhere in the API
import {
  ACUITY_ARCMIN,
  crownArcmin,
  keepRadiusM,
  lodThresholdArcmin,
  pixelArcmin,
  vegKeep
} from './veglod.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const RAD_PER_ARCMIN = Math.PI / (180 * 60);

{
  // Independent construction of the frame-edge pixel: place the last
  // two pixel-boundary rays of an H-pixel viewport at fov f by their
  // tan coordinates and difference their angles.
  const f = 55;
  const H = 720;
  const half = ((f / 2) * Math.PI) / 180;
  const t = Math.tan(half);
  const lastEdge = Math.atan(t);
  const prevEdge = Math.atan(t - (2 * t) / H);
  const fd = (lastEdge - prevEdge) / RAD_PER_ARCMIN;
  const got = pixelArcmin(f, H);
  const smallAngle = (f * 60) / H;
  check(
    'frame-edge pixel subtense',
    Math.abs(got - fd) / fd < 2e-3 &&
      got < smallAngle &&
      Math.abs(got - (((2 * t) / H) * Math.cos(half) ** 2) / RAD_PER_ARCMIN) <
        1e-12,
    `55 deg/720 px: exact ${got.toFixed(3)}' vs finite-difference ${fd.toFixed(3)}'; small-angle fov/H ${smallAngle.toFixed(3)}' overstates the edge pixel`
  );
}

{
  const coarse = lodThresholdArcmin(55, 720);
  const fine = lodThresholdArcmin(55, 20000);
  check(
    'acuity floor',
    ACUITY_ARCMIN === 1.0 &&
      Math.abs(coarse - pixelArcmin(55, 720)) < 1e-12 &&
      fine === 1.0 &&
      pixelArcmin(55, 20000) < 1.0,
    `Snellen 20/20 separates 1' (Tipton 1984; Reddy 1997 2.3.3): 720 px display governs at ${coarse.toFixed(2)}', a 20000 px display (${pixelArcmin(55, 20000).toFixed(3)}') floors at ${fine.toFixed(1)}'`
  );
}

{
  // Roundtrip: the closed-form radius is exactly where the decision
  // flips, for a drawn crown and a real threshold.
  const thr = lodThresholdArcmin(55, 1080);
  const w = 131.4; // metres, a drawn conifer crown (2.3 units * MPU)
  const R = keepRadiusM(w, thr);
  const at = crownArcmin(w, R);
  check(
    'keep-radius roundtrip',
    Math.abs(at - thr) < 1e-9 &&
      vegKeep(w, R * 0.999, thr) &&
      !vegKeep(w, R * 1.001, thr),
    `131.4 m crown at 55 deg/1080 px: threshold ${thr.toFixed(3)}' -> radius ${(R / 1000).toFixed(1)} km, subtense there ${at.toFixed(3)}', keep flips across it`
  );
}

{
  const thr = lodThresholdArcmin(55, 1080);
  const rSmall = keepRadiusM(60, thr);
  const rBig = keepRadiusM(140, thr);
  const rFiner = keepRadiusM(60, lodThresholdArcmin(55, 2160));
  check(
    'monotonicity',
    rBig > rSmall &&
      rFiner > rSmall &&
      crownArcmin(60, 1000) > crownArcmin(60, 2000),
    `wider crown carries further (${(rBig / 1000).toFixed(1)} > ${(rSmall / 1000).toFixed(1)} km); finer pixels carry further (${(rFiner / 1000).toFixed(1)} km at 2160 px); subtense falls with distance`
  );
}

{
  // The doctrine landmark: pure geometry in, decision out. The same
  // candidate gets the same answer however many others exist - the
  // property a count cap (the old `trees.length >= 140`) violates by
  // construction.
  const thr = lodThresholdArcmin(55, 1080);
  const a = vegKeep(120, 3000, thr);
  const again = [1, 2, 3, 4, 5].map(() => vegKeep(120, 3000, thr));
  check(
    'spatial, never a count',
    again.every((v) => v === a) && vegKeep.length === 3,
    `decision is a pure function of (width, distance, threshold) - no counter in the API, identical on every evaluation`
  );
}

process.exit(fail ? 1 : 0);
