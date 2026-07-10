// Reference gate for snowcover.js (node snowcover-reference.mjs):
//  - the published colormap inverts VERBATIM (ramp injective,
//    flags distinct even at alpha 0)
//  - Salomonson & Appel (2004) held exact: FSC = -0.01 + 1.45
//    NDSI with the physical clamps
//  - the LIVE July tile: the Jungfrau glaciers answer as measured
//    snow, the valleys as measured bare ground, cloud and water
//    as unknown
//  - the field raster: exact FSC per cell, unknown propagated,
//    the terrain shader's row orientation held
import {
  classifyPixel,
  fscOf,
  NDSI_RGB,
  snowField,
  SNOW_Z
} from './snowcover.js';
import {SNOWTILE_SAMPLES, SNOWTILE_SNOW_PIXELS} from './snowcover-fixture.mjs';
import {pixelOf} from './nightlights.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // The verbatim colormap: known entries invert exactly, the
  // 100-row ramp is injective, and the transparent classes stay
  // tellable apart by RGB alone.
  const keys = new Set(NDSI_RGB.map((c) => c.join(',')));
  const a = classifyPixel([240, 240, 128, 255]);
  const b = classifyPixel([240, 180, 137, 255]);
  const c = classifyPixel([255, 0, 0, 255]);
  const clear = classifyPixel([0, 255, 0, 0]);
  const cloud = classifyPixel([0, 191, 255, 0]);
  const night = classifyPixel([189, 0, 189, 0]);
  const junk = classifyPixel([1, 2, 3, 255]);
  const ok =
    NDSI_RGB.length === 100 &&
    keys.size === 100 &&
    a.kind === 'ndsi' &&
    a.v === 0.01 &&
    b.kind === 'ndsi' &&
    b.v === 0.5 &&
    c.kind === 'ndsi' &&
    c.v === 1 &&
    clear.kind === 'clear' &&
    cloud.kind === 'unknown' &&
    cloud.flag === 250 &&
    night.kind === 'unknown' &&
    night.flag === 211 &&
    junk.kind === 'unknown';
  check(
    'colormap inversion',
    ok,
    'ramp rows 1/50/100 invert to NDSI 0.01/0.50/1.00 verbatim (100 injective rows); clear ground, cloud 250 and night 211 all tellable at alpha 0; junk is unknown'
  );
}

{
  // Salomonson & Appel exact: the printed coefficients, the
  // physical clamps at both ends.
  const ok =
    fscOf(0.4) === -0.01 + 1.45 * 0.4 &&
    fscOf(0.1) === -0.01 + 1.45 * 0.1 &&
    fscOf(0) === 0 && // -0.01 clamps to the physical floor
    fscOf(1) === 1 && // 1.44 clamps to full cover
    fscOf(1.01 / 1.45) > 0.999 &&
    fscOf(0.006) === 0; // below the regression's zero crossing
  check(
    'Salomonson-Appel FSC',
    ok,
    'FSC = -0.01 + 1.45 NDSI exactly (printed coefficients), clamped [0, 1] at the physical ends'
  );
}

{
  // The LIVE tile (GIBS z8 r90 c133, 2026-07-08): every sampled
  // glacier pixel classifies as measured snow with FSC > 0, the
  // valley pixels as measured bare ground, cloud as flag 250 and
  // the lakes as flag 237 - and the July tile carries thousands
  // of snow pixels (the permanent snow the freezing-level
  // heuristic can only guess at).
  const s = SNOWTILE_SAMPLES;
  const ok =
    s.ndsi.length >= 5 &&
    s.ndsi.every((p) => {
      const c = classifyPixel(p.slice(2));
      return c.kind === 'ndsi' && fscOf(c.v) > 0;
    }) &&
    s.clear.every((p) => classifyPixel(p.slice(2)).kind === 'clear') &&
    s.cloud.every((p) => {
      const c = classifyPixel(p.slice(2));
      return c.kind === 'unknown' && c.flag === 250;
    }) &&
    s.water.every((p) => {
      const c = classifyPixel(p.slice(2));
      return c.kind === 'unknown' && c.flag === 237;
    }) &&
    SNOWTILE_SNOW_PIXELS > 3000;
  check(
    'live July tile',
    ok,
    `glacier pixels -> measured snow, valleys -> measured bare ground, cloud -> 250, the lakes -> 237; ${SNOWTILE_SNOW_PIXELS} snow pixels on the tile in July`
  );
}

{
  // The field: a sampler answering NDSI 0.50 north of the anchor
  // and bare ground south of it. Every northern cell must read
  // EXACTLY fscOf(0.5), every southern cell exactly 0, and the
  // north must land in the UPPER texture rows (v = 0.5 - z/world);
  // a cloud sampler yields all-unknown and known = 0.
  const anchor = {lat: 46.7, lon: 7.9};
  const N = 32;
  const WORLD = 280;
  const anchorPy = pixelOf(anchor.lat, anchor.lon, SNOW_Z).py;
  const split = (ix, iy) =>
    iy < anchorPy ? [240, 180, 137, 255] : [0, 255, 0, 0];
  const f = snowField(split, anchor, WORLD, N);
  // float32 storage: the exact expectation is fround(FSC)
  const want = Math.fround(fscOf(0.5));
  let ok = f.known === 1 && Math.abs(f.snowy - want / 2) < 0.05;
  for (let row = 0; row < N && ok; row++)
    for (let i = 0; i < N; i++) {
      const v = f.data[row * N + i];
      if (row >= N / 2 + 1 && v !== want) ok = false; // north rows
      if (row <= N / 2 - 2 && v !== 0) ok = false; // south rows
    }
  const clouded = snowField(() => [0, 191, 255, 0], anchor, WORLD, N);
  check(
    'snow field raster',
    ok &&
      clouded.known === 0 &&
      clouded.data.every((v) => v === -1) &&
      clouded.snowy === 0,
    `north half exactly FSC(0.5) = ${want.toFixed(4)} (float32) in the upper texture rows, south half exactly 0; a fully clouded box is all-unknown with known = 0`
  );
}

process.exit(fail ? 1 : 0);
