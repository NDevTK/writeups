// Reference gate for ocean-measured-color.js (node
// ocean-measured-color-reference.mjs): the CIE integration that turns a
// six-band measured Rrs spectrum into the sea's linear-sRGB body colour,
// held to the LIVE ESA CCI v6.0 values recorded when the source was
// pinned (2026-07-11, latest composite 2025-12-31) and to the exposure
// anchor.
//
//  - a clear oligotrophic gyre is a deep blue (blue channel dominant,
//    chromaticity far to the blue of the white point).
//  - a turbid Case-2 coast (Mississippi plume) is green - its measured
//    Rrs peaks in the green and its red is elevated, the sediment/CDOM
//    signature a chlorophyll-only Case-1 model misreads as blue.
//  - across gyre -> productive coast -> turbid plume the sea greens: the
//    blue fraction falls and the chromaticity slides off the blue point.
//  - one exposure scalar reproduces the sea's tuned deep-blue luminance
//    at the clear-gyre reference exactly.
import {
  LEGACY_WATER_HEX,
  RRS_BANDS_NM,
  REFERENCE_RRS,
  SEA_GAIN,
  TARGET_LUMINANCE,
  chromaticity,
  luminance,
  rrsAt,
  seaColorLinear
} from './ocean-measured-color.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const maxChannel = (rgb) => rgb.indexOf(Math.max(...rgb)); // 0=R 1=G 2=B
const blueFrac = (rgb) => rgb[2] / (rgb[0] + rgb[1] + rgb[2]);
const greenFrac = (rgb) => rgb[1] / (rgb[0] + rgb[1] + rgb[2]);

// LIVE ESA CCI Rrs [412,443,490,510,560,665] (sr^-1), 2025-12-31.
const GYRE = REFERENCE_RRS;
const CALIFORNIA = [
  0.002517, 0.002797, 0.002613, 0.002209, 0.001305, 0.0001722
];
const MISSISSIPPI = [
  0.002485, 0.002699, 0.003168, 0.003337, 0.003214, 0.0006305
];

{
  // Band interpolation: reproduces each band at its centre, stays
  // between neighbours, and holds the tails flat.
  const mid = rrsAt(GYRE, (RRS_BANDS_NM[1] + RRS_BANDS_NM[2]) / 2);
  check(
    'band interpolation',
    RRS_BANDS_NM.every(
      (nm, i) => Math.abs(rrsAt(GYRE, nm) - GYRE[i]) < 1e-15
    ) &&
      rrsAt(GYRE, 360) === GYRE[0] &&
      rrsAt(GYRE, 700) === GYRE[5] &&
      mid < Math.max(GYRE[1], GYRE[2]) &&
      mid > Math.min(GYRE[1], GYRE[2]),
    `six centres reproduced; 360->Rrs_412, 700->Rrs_665 held; 443/490 midpoint ${mid.toExponential(2)} between`
  );
}

{
  // Clear gyre: a deep blue. Blue channel dominant, chromaticity far to
  // the blue side of the white point (0.3127, 0.3290).
  const rgb = seaColorLinear(GYRE);
  const {x, y} = chromaticity(GYRE);
  check(
    'clear-gyre deep blue',
    maxChannel(rgb) === 2 && x < 0.25 && y < 0.28,
    `linRGB = ${rgb.map((v) => v.toFixed(3)).join(', ')} (blue dominant); xy = (${x.toFixed(3)}, ${y.toFixed(3)}) blue of white`
  );
}

{
  // Turbid Case-2 plume: green. The measured Rrs peaks in the green, so
  // the colour is NOT blue-dominant - it is green - the signature a
  // Case-1 chlorophyll model cannot produce.
  const rgb = seaColorLinear(MISSISSIPPI);
  const {x, y} = chromaticity(MISSISSIPPI);
  check(
    'turbid plume green (Case-2)',
    maxChannel(rgb) === 1 && greenFrac(rgb) > blueFrac(rgb),
    `linRGB = ${rgb.map((v) => v.toFixed(3)).join(', ')} (green dominant); xy = (${x.toFixed(3)}, ${y.toFixed(3)}); greenFrac ${greenFrac(rgb).toFixed(3)} > blueFrac ${blueFrac(rgb).toFixed(3)}`
  );
}

{
  // The measured ocean-colour signal: across gyre -> productive coast ->
  // turbid plume the blue fraction falls monotonically and the
  // chromaticity x rises (the sea greening from Case-1 to Case-2) -
  // distinctness a chlorophyll index alone cannot give.
  const seq = [GYRE, CALIFORNIA, MISSISSIPPI];
  const bf = seq.map((s) => blueFrac(seaColorLinear(s)));
  const xs = seq.map((s) => chromaticity(s).x);
  let bMono = true;
  let xMono = true;
  for (let i = 1; i < seq.length; i++) {
    if (bf[i] >= bf[i - 1]) bMono = false;
    if (xs[i] <= xs[i - 1]) xMono = false;
  }
  check(
    'gyre-to-plume progression',
    bMono && xMono,
    `blueFrac gyre/cal/plume = ${bf.map((v) => v.toFixed(3)).join(', ')} (falling); chroma x = ${xs.map((v) => v.toFixed(3)).join(', ')} (rising)`
  );
}

{
  // The single exposure scalar reproduces the sea's tuned deep-blue
  // luminance at the clear-gyre reference to machine precision, and
  // stays a sane gain (Rrs is tiny, so the gain is large).
  const yRef = luminance(seaColorLinear(REFERENCE_RRS));
  check(
    'exposure anchor',
    Math.abs(yRef - TARGET_LUMINANCE) < 1e-9 && SEA_GAIN > 0,
    `gain ${SEA_GAIN.toExponential(3)} -> ref luminance ${yRef.toFixed(5)} = legacy water 0x${LEGACY_WATER_HEX.toString(16)} (${TARGET_LUMINANCE.toFixed(5)})`
  );
}

{
  // Delivered colour is well-formed for every plausible Rrs spectrum:
  // finite and non-negative.
  let ok = true;
  let worst = '';
  const cases = [
    GYRE,
    CALIFORNIA,
    MISSISSIPPI,
    [0, 0, 0, 0, 0, 0],
    [0.02, 0.015, 0.012, 0.01, 0.008, 0.003]
  ];
  for (const c of cases) {
    const rgb = seaColorLinear(c);
    for (const v of rgb)
      if (!Number.isFinite(v) || v < 0) {
        ok = false;
        worst = `${c.join('/')} -> ${rgb.map((x) => x.toFixed(3)).join(', ')}`;
      }
  }
  check(
    'gamut + finiteness',
    ok,
    ok
      ? 'gyre/coast/plume and extremes finite and non-negative'
      : `bad at ${worst}`
  );
}

process.exit(fail ? 1 : 0);
