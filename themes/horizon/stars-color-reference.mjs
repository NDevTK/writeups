// Reference gate for stars-color.js (node stars-color-reference.mjs):
// the Planck star-tint chain at its printed anchors - Ballesteros'
// blackbody colour-temperature relation, the shipped white point,
// and Schaefer 1990's night-vision colour slope against the
// theme's own rod fold.
import {
  planckXYZ,
  starTintRGB,
  ballesterosT,
  ballesterosBV,
  rodShiftMag,
  RGB_TO_XYZ,
  BALLESTEROS_T0,
  BALLESTEROS_A,
  BALLESTEROS_B,
  BALLESTEROS_C
} from './stars-color.js';
import {XYZ_TO_LINEAR_SRGB} from './ocean-color.js';
import {D65} from './spectral-srgb.js';
import {scotopicY} from './adaptation.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // Ballesteros 2012's printed constants land the solar effective
  // temperature at the Sun's B-V = 0.65, and the bisection
  // inversion closes round-trip across the whole branch.
  const tSun = ballesterosT(0.65);
  let worst = 0;
  for (let bv = -0.4; bv <= 2.5; bv += 0.05) {
    worst = Math.max(worst, Math.abs(ballesterosBV(ballesterosT(bv)) - bv));
  }
  const ok =
    BALLESTEROS_T0 === 4600 &&
    BALLESTEROS_A === 0.92 &&
    BALLESTEROS_B === 1.7 &&
    BALLESTEROS_C === 0.62 &&
    Math.abs(tSun - 5778) < 1 &&
    worst < 1e-9;
  check(
    'Ballesteros relation: printed constants, solar anchor, inversion',
    ok,
    `T(0.65) ${tSun.toFixed(1)} K (Teff_sun 5778); round-trip worst ${worst.toExponential(1)}`
  );
}

{
  // The sprite fold's Rec.709 -> XYZ rows invert the shipped
  // display matrix - the two constants are one transform.
  let worst = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) {
        s += XYZ_TO_LINEAR_SRGB[i][k] * RGB_TO_XYZ[k][j];
      }
      worst = Math.max(worst, Math.abs(s - (i === j ? 1 : 0)));
    }
  }
  const ok = worst < 5e-4;
  check(
    'matrix closure: fold rows x shipped XYZ->sRGB = identity',
    ok,
    `worst element ${worst.toExponential(1)} (< 5e-4)`
  );
}

{
  // The 6500 K blackbody lands at the shipped D65 white point to
  // within the known D-series-vs-Planck offset (D65 is a daylight
  // spectrum, not a pure blackbody - the small green-side shift
  // is the documented residual, bounded at 0.006).
  const [X, Y, Z] = planckXYZ(6500);
  const s = X + Y + Z;
  const sd = D65[0] + D65[1] + D65[2];
  const dx = X / s - D65[0] / sd;
  const dy = Y / s - D65[1] / sd;
  const ok = Math.abs(dx) < 0.006 && Math.abs(dy) < 0.006;
  check(
    'white point: 6500 K Planck vs shipped D65',
    ok,
    `xy (${(X / s).toFixed(4)}, ${(Y / s).toFixed(4)}) vs (${(D65[0] / sd).toFixed(4)}, ${(D65[1] / sd).toFixed(4)}) - dxy (${dx.toFixed(4)}, ${dy.toFixed(4)}) < 0.006`
  );
}

{
  // The tint runs the locus the right way: chromaticity x falls
  // monotonically with temperature over the catalogue span, the
  // coolest entry is red-led, the hottest blue-led, and every
  // tint is a valid max-1 colour.
  let lastX = Infinity;
  let mono = true;
  let valid = true;
  for (let T = 2300; T <= 45000; T *= 1.12) {
    const [X, Y, Z] = planckXYZ(T);
    const x = X / (X + Y + Z);
    if (x >= lastX) mono = false;
    lastX = x;
    const rgb = starTintRGB(T);
    const mx = Math.max(...rgb);
    const mn = Math.min(...rgb);
    if (!(Math.abs(mx - 1) < 1e-12 && mn >= 0 && rgb.every(Number.isFinite)))
      valid = false;
  }
  const cool = starTintRGB(2300);
  const hot = starTintRGB(45000);
  const ok =
    mono &&
    valid &&
    cool[0] === 1 &&
    cool[1] < 0.4 &&
    cool[2] < 0.1 &&
    hot[2] === 1 &&
    hot[0] < 0.4;
  check(
    'locus: monotone x(T), red-led cool end, blue-led hot end',
    ok,
    `2300 K (${cool.map((v) => v.toFixed(3)).join(',')}), 45000 K (${hot.map((v) => v.toFixed(3)).join(',')})`
  );
}

{
  // THE SCHAEFER LANDMARK: his Eq. 13 prints the night-vision
  // colour correction -2.5 log(F_c) = 1 - (B-V)/2 (log B < 3.17,
  // the same 1500 nL floor), and Eq. 14's assembly with the
  // p. 214 prose fixes the sign - redder fainter, +0.5 mag per
  // unit B-V. The theme's shipped rod fold (Larson Eq. 13 on the
  // sprite tint) must reproduce that slope from the Planck
  // spectra themselves: least-squares over B-V 0..1.5.
  const pts = [];
  for (let bv = 0; bv <= 1.5001; bv += 0.05) {
    pts.push([bv, rodShiftMag(ballesterosT(bv))]);
  }
  const n = pts.length;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const [x, y] of pts) {
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
  }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  // Scale invariance: the shift is chromaticity-only (the max-1
  // convention cannot move it) - same tint scaled 0.37 gives the
  // same Ys/Y ratio through the fold algebra.
  const [r, g, b] = starTintRGB(4000);
  const shift = (k) => {
    const m = RGB_TO_XYZ;
    const X = k * (m[0][0] * r + m[0][1] * g + m[0][2] * b);
    const Y = k * (m[1][0] * r + m[1][1] * g + m[1][2] * b);
    const Z = k * (m[2][0] * r + m[2][1] * g + m[2][2] * b);
    return -2.5 * Math.log10(scotopicY(X, Y, Z) / 2.31 / Y);
  };
  const inv = Math.abs(shift(1) - shift(0.37));
  const ok = slope > 0.4 && slope < 0.55 && inv < 1e-12;
  check(
    'Schaefer 1990 Eq. 13: rod-fold slope vs the printed 0.5 mag/(B-V)',
    ok,
    `fold slope ${slope.toFixed(3)} over B-V 0..1.5 (printed 0.5, within 20%); sign redder-fainter (Eq. 14); scale-invariant to ${inv.toExponential(1)}`
  );
}

process.exit(fail ? 1 : 0);
