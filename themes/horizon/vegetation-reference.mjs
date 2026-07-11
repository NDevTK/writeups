// Reference gate for vegetation.js (node vegetation-reference.mjs): the
// NDVI -> fractional cover -> soil/canopy reflectance mixture, held to
// the Carlson & Ripley [1997] relation and to the published visible
// shapes of the two endmember spectra.
//
//  - fractional cover is the scaled NDVI squared: 0 at bare-soil NDVI,
//    1 at full-cover NDVI, monotone and convex between, clamped outside.
//  - the green-canopy endmember has the textbook leaf shape: a green
//    bump at 550, chlorophyll absorption in the red, a red-edge rise.
//  - the soil endmember rises monotonically from blue to red.
//  - the mixture collapses to soil at Fr = 0 and to canopy at Fr = 1,
//    and lies between them in between.
import {
  GREEN_VEG,
  DRY_SOIL,
  NDVI_SOIL,
  NDVI_VEG,
  fractionalCover,
  sampleSpectrum,
  mixedReflectanceAt,
  canopyReflectance
} from './vegetation.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const val = (table, nm) => sampleSpectrum(table, nm);

{
  // Carlson & Ripley: Fr = (N*)^2. Zero at bare-soil NDVI, one at
  // full-cover NDVI, monotone increasing between, convex (below the 1:1
  // line), and clamped to [0, 1] outside the endmembers.
  const f0 = fractionalCover(NDVI_SOIL);
  const f1 = fractionalCover(NDVI_VEG);
  const mid = (NDVI_SOIL + NDVI_VEG) / 2; // N* = 0.5 -> Fr = 0.25
  const fmid = fractionalCover(mid);
  const grid = [0.04, 0.1, 0.2, 0.28, 0.4, 0.52];
  const fs = grid.map((n) => fractionalCover(n));
  let mono = true;
  for (let i = 1; i < fs.length; i++) if (fs[i] < fs[i - 1]) mono = false;
  check(
    'fractional cover Fr = (N*)^2',
    Math.abs(f0) < 1e-12 &&
      Math.abs(f1 - 1) < 1e-12 &&
      Math.abs(fmid - 0.25) < 1e-12 &&
      fmid < 0.5 &&
      mono &&
      fractionalCover(-0.1) === 0 &&
      fractionalCover(0.9) === 1,
    `Fr(${NDVI_SOIL}) = ${f0.toFixed(3)}, Fr(${NDVI_VEG}) = ${f1.toFixed(3)}, Fr(mid ${mid}) = ${fmid.toFixed(3)} (convex, < 0.5); rising, clamped`
  );
}

{
  // Green canopy: the green bump is the visible maximum (551 nm on the
  // native grid; 550 here), the red chlorophyll minimum sits below it,
  // and the red edge climbs back up by 700 nm.
  const peak = val(GREEN_VEG, 550);
  const redMin = val(GREEN_VEG, 670);
  const redEdge = val(GREEN_VEG, 700);
  const blue = val(GREEN_VEG, 450);
  const maxVis = Math.max(...GREEN_VEG.map((r) => r[1]));
  check(
    'green-canopy leaf shape',
    Math.abs(peak - maxVis) < 1e-12 &&
      redMin < peak &&
      blue < peak &&
      redEdge > redMin &&
      redEdge > 1.8 * redMin,
    `R(550) = ${peak} (max), R(670) = ${redMin} (chl min < peak; blue ${blue} also dark), R(700) = ${redEdge} (red edge, ${(redEdge / redMin).toFixed(1)}x the min)`
  );
}

{
  // Bare soil: a smooth monotonic rise from blue to red.
  let mono = true;
  for (let i = 1; i < DRY_SOIL.length; i++)
    if (DRY_SOIL[i][1] < DRY_SOIL[i - 1][1]) mono = false;
  check(
    'soil monotone rise',
    mono &&
      val(DRY_SOIL, 700) > val(DRY_SOIL, 400) &&
      Math.abs(val(DRY_SOIL, 550) - 0.1405) < 1e-9,
    `soil rises ${val(DRY_SOIL, 400)} (400) -> ${val(DRY_SOIL, 700)} (700); R(550) = ${val(DRY_SOIL, 550)}`
  );
}

{
  // The mixture: at Fr = 0 (bare-soil NDVI) it is exactly the soil
  // endmember, at Fr = 1 (full-cover NDVI) exactly the canopy, and at a
  // partial cover it lies strictly between them wavelength by
  // wavelength.
  let atSoil = true;
  let atVeg = true;
  let between = true;
  const midNdvi = 0.28; // Fr = 0.25
  for (const [nm] of GREEN_VEG) {
    if (Math.abs(mixedReflectanceAt(NDVI_SOIL, nm) - val(DRY_SOIL, nm)) > 1e-12)
      atSoil = false;
    if (Math.abs(mixedReflectanceAt(NDVI_VEG, nm) - val(GREEN_VEG, nm)) > 1e-12)
      atVeg = false;
    const m = mixedReflectanceAt(midNdvi, nm);
    const lo = Math.min(val(GREEN_VEG, nm), val(DRY_SOIL, nm));
    const hi = Math.max(val(GREEN_VEG, nm), val(DRY_SOIL, nm));
    if (m < lo - 1e-12 || m > hi + 1e-12) between = false;
  }
  check(
    'endmember mixture',
    atSoil && atVeg && between,
    `Fr=0 -> soil, Fr=1 -> canopy, Fr=0.25 (NDVI ${midNdvi}) strictly between at every wavelength`
  );
}

{
  // The pinned endmember grids are intact: 31 rows each at 10 nm
  // 400-700, and canopyReflectance returns one R per grid row.
  const spec = canopyReflectance(0.3);
  check(
    'endmember grid integrity',
    GREEN_VEG.length === 31 &&
      DRY_SOIL.length === 31 &&
      GREEN_VEG[0][0] === 400 &&
      GREEN_VEG[30][0] === 700 &&
      DRY_SOIL[0][0] === 400 &&
      DRY_SOIL[30][0] === 700 &&
      spec.length === 31,
    `${GREEN_VEG.length} canopy + ${DRY_SOIL.length} soil rows 400-700 nm @10; canopyReflectance -> ${spec.length} rows`
  );
}

process.exit(fail ? 1 : 0);
