// Reference gate for ocean-color.js (node ocean-color-reference.mjs):
// the CIE colour integration that turns a Morel & Maritorena [2001]
// reflectance spectrum into the water's linear-sRGB body colour, held
// to colorimetric ground truth and to the ocean-colour progression the
// bio-optical model itself produces.
//
//  - transcription: the pinned CIE 1931 2 deg observer and D65
//    illuminant integrate a perfect diffuser to the D65 white point
//    (0.3127, 0.3290), and that white maps through the XYZ->sRGB
//    matrix to a neutral (1, 1, 1) - the observer, the illuminant and
//    the matrix are mutually consistent.
//  - the clearest water (Chl = 0.03) is a deep blue: its chromaticity
//    sits far on the blue side of white and the blue channel dominates.
//  - a heavy bloom (Chl = 10) is green: its chromaticity is pushed well
//    above the white point in y and the green channel dominates.
//  - the ocean-colour signal: across Chl the chromaticity x rises
//    monotonically and the dominant channel crosses blue -> green, the
//    hue shift that IS ocean colour.
//  - oligotrophic water is darker than a bloom (luminance rises with
//    Chl), and the one exposure scalar reproduces the sea's prior tuned
//    luminance at the reference cell exactly.
import {
  CIE_1931_2DEG,
  BODY_GAIN,
  LEGACY_WATER_HEX,
  REFERENCE_CHL,
  TARGET_LUMINANCE,
  chlToXYZ,
  chromaticity,
  luminance,
  waterColorLinear,
  xyzToLinearSRGB
} from './ocean-color.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const maxChannel = (rgb) => rgb.indexOf(Math.max(...rgb)); // 0=R 1=G 2=B

{
  // A perfect diffuser (R = 1) under the pinned D65, integrated against
  // the pinned observer, must land on the D65 white point; the same
  // XYZ through the matrix must come back neutral. This is the joint
  // transcription check for all three tables.
  let X = 0;
  let Y = 0;
  let Z = 0;
  let N = 0;
  for (const [, xb, yb, zb, ed] of CIE_1931_2DEG) {
    X += ed * xb;
    Y += ed * yb;
    Z += ed * zb;
    N += ed * yb;
  }
  const s = X + Y + Z;
  const wx = X / s;
  const wy = Y / s;
  const white = xyzToLinearSRGB({X: X / N, Y: Y / N, Z: Z / N});
  const spread = Math.max(...white) - Math.min(...white);
  check(
    'D65 white point + neutral',
    Math.abs(wx - 0.3127) < 0.002 &&
      Math.abs(wy - 0.329) < 0.002 &&
      spread < 0.01 &&
      Math.abs(white[1] - 1) < 0.01,
    `white xy = (${wx.toFixed(4)}, ${wy.toFixed(4)}) ~ D65; sRGB(white) = ${white.map((v) => v.toFixed(3)).join(', ')} (neutral)`
  );
}

{
  // Clearest water: deep blue. Chromaticity far to the blue side of the
  // white point and the blue channel the largest.
  const {x, y} = chromaticity(0.03);
  const rgb = waterColorLinear(0.03);
  check(
    'clear-water blue',
    x < 0.2 && y < 0.15 && maxChannel(rgb) === 2 && rgb[2] > 0.05,
    `Chl 0.03: xy = (${x.toFixed(3)}, ${y.toFixed(3)}) (blue of white 0.31/0.33); linRGB = ${rgb.map((v) => v.toFixed(3)).join(', ')} - blue dominant`
  );
}

{
  // Heavy bloom: green. Chromaticity pushed well above the white point
  // in y and the green channel the largest.
  const {x, y} = chromaticity(10);
  const rgb = waterColorLinear(10);
  check(
    'bloom green',
    y > 0.38 && x > 0.29 && maxChannel(rgb) === 1,
    `Chl 10: xy = (${x.toFixed(3)}, ${y.toFixed(3)}) (green, y >> white 0.33); linRGB = ${rgb.map((v) => v.toFixed(3)).join(', ')} - green dominant`
  );
}

{
  // The ocean-colour progression: chromaticity x strictly increasing
  // with Chl, and the dominant channel crossing from blue (Chl <= 0.3)
  // to green (Chl >= 3) - the blue-to-green hue shift of ocean colour.
  const chls = [0.03, 0.1, 0.3, 1, 3, 10, 30];
  const xs = chls.map((c) => chromaticity(c).x);
  let mono = true;
  for (let i = 1; i < xs.length; i++) if (xs[i] <= xs[i - 1]) mono = false;
  const blue = [0.03, 0.1, 0.3].every(
    (c) => maxChannel(waterColorLinear(c)) === 2
  );
  const green = [3, 10, 30].every((c) => maxChannel(waterColorLinear(c)) === 1);
  check(
    'blue-to-green progression',
    mono && blue && green,
    `x over Chl ${chls.join('/')} = ${xs.map((v) => v.toFixed(3)).join(', ')} (rising); blue dominant <=0.3, green dominant >=3`
  );
}

{
  // Oligotrophic water is darker than a bloom (luminance rises with
  // Chl), and the single exposure scalar reproduces the sea's prior
  // hand-tuned luminance at the reference cell to machine precision.
  const yClear = luminance(xyzToLinearSRGB(chlToXYZ(0.03)));
  const yBloom = luminance(xyzToLinearSRGB(chlToXYZ(10)));
  const yRef = luminance(waterColorLinear(REFERENCE_CHL));
  check(
    'darkness + exposure anchor',
    yClear < yBloom &&
      Math.abs(yRef - TARGET_LUMINANCE) < 1e-9 &&
      BODY_GAIN > 0.5 &&
      BODY_GAIN < 3,
    `luminance Chl 0.03 = ${yClear.toFixed(4)} < Chl 10 = ${yBloom.toFixed(4)}; gain ${BODY_GAIN.toFixed(3)} -> ref luminance ${yRef.toFixed(4)} = legacy 0x${LEGACY_WATER_HEX.toString(16)} (${TARGET_LUMINANCE.toFixed(4)})`
  );
}

{
  // Delivered colour is well-formed across the full valid chlorophyll
  // range: every channel finite, non-negative, and never blown out.
  let ok = true;
  let worst = '';
  for (const c of [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30, 100]) {
    const rgb = waterColorLinear(c);
    for (const v of rgb)
      if (!Number.isFinite(v) || v < 0 || v > 1) {
        ok = false;
        worst = `Chl ${c} -> ${rgb.map((x) => x.toFixed(3)).join(', ')}`;
      }
  }
  check(
    'gamut + finiteness',
    ok,
    ok
      ? 'Chl 0.01..100 all channels finite, in [0, 1]'
      : `out of range at ${worst}`
  );
}

{
  // The pinned CIE grid is intact: 69 rows at 5 nm 360-700, the
  // luminous-efficiency peak ybar = 1 at 555 nm, and D65 = 100 at its
  // 560 nm normalisation point.
  const row = (nm) => CIE_1931_2DEG.find((r) => r[0] === nm);
  check(
    'CIE grid integrity',
    CIE_1931_2DEG.length === 69 &&
      CIE_1931_2DEG[0][0] === 360 &&
      CIE_1931_2DEG[68][0] === 700 &&
      row(555)[2] === 1 &&
      row(560)[4] === 100,
    `${CIE_1931_2DEG.length} rows 360-700 nm @5; ybar(555) = ${row(555)[2]}, D65(560) = ${row(560)[4]}`
  );
}

process.exit(fail ? 1 : 0);
