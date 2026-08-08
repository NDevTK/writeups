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

// ---- the measured face and its orientation (moonface.js) ----
import {
  moonAlbAt,
  moonAlbMean,
  moonOrientation,
  rotApply,
  MOON_POLE_RA_DEG,
  MOON_POLE_DEC_DEG
} from './moonface.js';
import {MOON_ALB, MOON_ALB_W, MOON_ALB_H} from './moon-albedo-data.js';

{
  // The vendored LROC WAC map at its own facts: area-weighted
  // sphere mean 1 (the mean-1 normalization preserves the Hapke
  // disc calibration by construction); the named maria dark and
  // the ray/highland terrain bright at printed selenographic
  // coordinates (Crisium 17.0N 59.1E, Tranquillitatis 8.5N 31E,
  // Tycho's terrain 43.3S 11.2W, far-side highlands); and the
  // hemispheric asymmetry - the dark (maria) area fraction on
  // the nearside is several times the farside's, the classic
  // printed nearside-maria concentration.
  const mean = moonAlbMean();
  let nearDark = 0;
  let nearW = 0;
  let farDark = 0;
  let farW = 0;
  for (let j = 0; j < MOON_ALB_H; j++) {
    const lat = (0.5 - (j + 0.5) / MOON_ALB_H) * Math.PI;
    const w = Math.cos(lat);
    for (let i = 0; i < MOON_ALB_W; i++) {
      const lon = ((i + 0.5) / MOON_ALB_W) * 360;
      const near = lon < 90 || lon > 270;
      const dark = MOON_ALB[j * MOON_ALB_W + i] / 128 < 0.82;
      if (near) {
        nearW += w;
        if (dark) nearDark += w;
      } else {
        farW += w;
        if (dark) farDark += w;
      }
    }
  }
  const nd = nearDark / nearW;
  const fd = farDark / farW;
  const okMap =
    Math.abs(mean - 1) < 0.01 &&
    moonAlbAt(17, 59.1) < 0.7 &&
    moonAlbAt(8.5, 31) < 0.7 &&
    moonAlbAt(-43.3, -11.2) > 1.2 &&
    moonAlbAt(20, 180) > 1.2 &&
    nd > 2.5 * fd;
  console.log(
    `REF WAC face: sphere mean ${mean.toFixed(4)} (1 by construction); Crisium ${moonAlbAt(17, 59.1).toFixed(2)} / Tranquillitatis ${moonAlbAt(8.5, 31).toFixed(2)} dark, Tycho terrain ${moonAlbAt(-43.3, -11.2).toFixed(2)} / farside ${moonAlbAt(20, 180).toFixed(2)} bright; dark fraction near ${(nd * 100).toFixed(0)}% vs far ${(fd * 100).toFixed(0)}% (printed nearside-maria asymmetry)`
  );
  if (!okMap) {
    console.log('LANDMARK FAILED: WAC face');
    process.exit(1);
  }
}

{
  // The orientation triad: IAU pole constants verbatim; R is
  // orthonormal; the sub-observer body point maps EXACTLY to the
  // earth direction; the body pole lands in the pole
  // half-plane; zero libration faces the (0, 0) meridian.
  const earth = [0.3, 0.2, 0.93];
  const pole = [0.1, 0.95, -0.2];
  // Consistent geometry: the sub-observer latitude IS 90 deg
  // minus the pole-to-earth angle (that is its definition) - the
  // synthetic pair must honour it for the exact-mapping checks.
  const en0 = Math.hypot(earth[0], earth[1], earth[2]);
  const pn0 = Math.hypot(pole[0], pole[1], pole[2]);
  const elatDeg =
    90 -
    (Math.acos(
      (earth[0] * pole[0] + earth[1] * pole[1] + earth[2] * pole[2]) /
        (en0 * pn0)
    ) *
      180) /
      Math.PI;
  const R = moonOrientation(elatDeg, -2.88, earth, pole);
  let orth = 0;
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      let s2 = 0;
      for (let k = 0; k < 3; k++) s2 += R[a * 3 + k] * R[b * 3 + k];
      orth = Math.max(orth, Math.abs(s2 - (a === b ? 1 : 0)));
    }
  }
  const el = (elatDeg * Math.PI) / 180;
  const eo = (-2.88 * Math.PI) / 180;
  const uB = [
    Math.cos(el) * Math.sin(eo),
    Math.sin(el),
    Math.cos(el) * Math.cos(eo)
  ];
  const mapped = rotApply(R, uB);
  const en = Math.hypot(earth[0], earth[1], earth[2]);
  const dev = Math.hypot(
    mapped[0] - earth[0] / en,
    mapped[1] - earth[1] / en,
    mapped[2] - earth[2] / en
  );
  const pW = rotApply(R, [0, 1, 0]);
  const pn = Math.hypot(pole[0], pole[1], pole[2]);
  const poleDot = (pW[0] * pole[0] + pW[1] * pole[1] + pW[2] * pole[2]) / pn;
  const R0 = moonOrientation(0, 0, [0, 0, 1], [0, 1, 0]);
  const front = rotApply(R0, [0, 0, 1]);
  const ok =
    MOON_POLE_RA_DEG === 269.9949 &&
    MOON_POLE_DEC_DEG === 66.5392 &&
    orth < 1e-12 &&
    dev < 1e-12 &&
    poleDot > 1 - 1e-12 &&
    Math.hypot(front[0], front[1], front[2] - 1) < 1e-12;
  console.log(
    `REF face orientation: IAU pole 269.9949/66.5392 verbatim; R orthonormal to ${orth.toExponential(1)}; sub-observer -> earth to ${dev.toExponential(1)}; pole alignment cos ${poleDot.toFixed(4)}; zero libration faces (0,0) exactly`
  );
  if (!ok) {
    console.log('LANDMARK FAILED: face orientation');
    process.exit(1);
  }
}
