// Double-precision reference of the moon's Hapke photometry
// (node moon-reference.mjs). The kernel now lives ONCE in
// moonphase.js (shared with the theme's paraselenic optics -
// moon halos scale with this curve); this printer holds it to
// the observed lunar phase behaviour. Hapke (1981) IMSA with the
// (2002) H-function approximation and the SHOE opposition surge,
// single-lobe Henyey-Greenstein, lunar parameters from
// Helfenstein & Veverka (1987):
//   w = 0.21, B0 = 2.0, h = 0.07, xi = -0.18
// (macroscopic roughness theta-bar omitted - sub-pixel at the
// theme's 6-px disc; documented, not hidden).
//
// Sanity target: the disk-integrated phase curve. Observed lunar
// V-band (Rougier 1933): brightness at 90 deg phase is ~8% of full
// moon; the ~40% step from the opposition surge inside |g| < 7 deg.
import {diskIntegrated, hapkeR, relPhase} from './moonphase.js';

const r = hapkeR;
// Full-moon disc-centre value - the normalisation anchor that keeps
// the theme's calibrated full-moon brightness.
const R_FULL_CENTRE = r(1, 1, 0);
console.log('REF hapke: r_full_centre =', R_FULL_CENTRE.toFixed(5));

const full = diskIntegrated(0.01);
for (const g of [0.01, 5, 20, 45, 90, 120]) {
  console.log(
    `REF phase g=${String(g).padStart(5)} deg: I/I_full = ${(
      diskIntegrated(g) / full
    ).toFixed(4)}`
  );
}

// The theme's 1 Hz evaluator must sit on the same curve.
const rp90 = relPhase(90);
const ref90 = diskIntegrated(90) / diskIntegrated(0.01);
console.log(
  `REF relPhase(90) = ${rp90.toFixed(4)} vs N=400 curve ${ref90.toFixed(4)} (coarse-grid drift ${(Math.abs(rp90 - ref90) * 100).toFixed(2)}%)`
);
if (Math.abs(rp90 - ref90) > 0.005) {
  console.log('LANDMARK FAILED: relPhase drift');
  process.exit(1);
}
