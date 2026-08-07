// Reference gate for volcanic.js (node volcanic-reference.mjs):
// the vendored OMPS-LP colormap at its published structure, the
// floor-vs-background corroboration, and the volcScale contract.
import {
  SAOD_RGB,
  saodOfRGBA,
  sampleSaod,
  volcScaleOfSaod,
  chainAOD675,
  SAOD_LAMBDA_NM
} from './volcanic.js';
import {stratAOD532, ANGSTROM} from './stratos.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // The published colormap, structurally: 201 bins, the interior
  // contiguous (each hi is the next lo exactly), no duplicate
  // colours (the inversion is well defined), the below-floor bin
  // at 6.00e-3 and the open top at 2.50e-2.
  let contiguous = true;
  for (let i = 1; i < SAOD_RGB.length - 2; i++) {
    if (Math.abs(SAOD_RGB[i][4] - SAOD_RGB[i + 1][3]) > 1e-12)
      contiguous = false;
  }
  const keys = new Set(SAOD_RGB.map(([r, g, b]) => (r << 16) | (g << 8) | b));
  const ok =
    SAOD_RGB.length === 201 &&
    contiguous &&
    keys.size === 201 &&
    SAOD_RGB[0][3] === -1 &&
    SAOD_RGB[1][3] === 6e-3 &&
    SAOD_RGB[SAOD_RGB.length - 1][3] === 2.5e-2 &&
    SAOD_RGB[SAOD_RGB.length - 1][4] === -1;
  check(
    'published colormap structure',
    ok,
    `201 bins, contiguous, unique colours; floor 6.00e-3, open top 2.50e-2`
  );
}

{
  // The corroboration: the product's own display floor sits at
  // ~1.5x the shipped background chain at the product wavelength
  // - GIBS only paints where the background ends, and the modern
  // quiet stratosphere (Kremser: 2013 a factor 1.6-2 over the
  // 2002 minimum) reads in the first bins.
  const chain = chainAOD675();
  const ratio = 6e-3 / chain;
  const ok =
    SAOD_LAMBDA_NM === 675 &&
    Math.abs(chain - stratAOD532() * Math.pow(532 / 675, ANGSTROM)) < 1e-15 &&
    ratio > 1.2 &&
    ratio < 2.0;
  check(
    'floor vs background chain',
    ok,
    `chain AOD675 ${chain.toExponential(2)}; map floor 6.0e-3 = x${ratio.toFixed(2)} (Kremser's modern-vs-minimum factor 1.6-2 band)`
  );
}

{
  // Inversion round-trip and value semantics: every bin's colour
  // returns its own value class; nodata and unlisted colours are
  // unknown; interior mids are geometric and monotone.
  let okAll = true;
  let last = 0;
  for (let i = 0; i < SAOD_RGB.length; i++) {
    const [r, g, b, lo, hi] = SAOD_RGB[i];
    const v = saodOfRGBA(r, g, b, 255);
    if (lo === -1) {
      if (v !== 0) okAll = false;
    } else if (hi === -1) {
      if (v !== lo) okAll = false;
    } else {
      if (!(Math.abs(v - Math.sqrt(lo * hi)) < 1e-15 && v > last))
        okAll = false;
      last = v;
    }
  }
  const unknowns =
    saodOfRGBA(255, 255, 255, 0) === -1 && saodOfRGBA(1, 2, 3, 255) === -1;
  check(
    'inversion round-trip',
    okAll && unknowns,
    `201/201 bins return their class; monotone geometric mids; nodata/unlisted -> unknown`
  );
}

{
  // The sampler and the hook: an all-quiet block returns the
  // background exactly (volcScale 1); a painted plume pulls the
  // mean up; the hook clamps at 8 and is monotone.
  const quiet = () => [255, 0, 255, 255];
  const q = sampleSaod(quiet, 100, 100, 4);
  const plumeRGB = [...SAOD_RGB[100].slice(0, 3), 255];
  const plume = (ix) => (ix < 100 ? [255, 0, 255, 255] : plumeRGB);
  const p = sampleSaod((ix) => plume(ix), 100, 100, 4);
  const top = volcScaleOfSaod(1);
  const ok =
    Math.abs(q.saod - chainAOD675()) < 1e-15 &&
    q.painted === 0 &&
    volcScaleOfSaod(q.saod) === 1 &&
    p.saod > q.saod &&
    p.painted > 0 &&
    volcScaleOfSaod(p.saod) > 1 &&
    top === 8 &&
    volcScaleOfSaod(-1) === 1 &&
    volcScaleOfSaod(2e-2) > volcScaleOfSaod(1e-2);
  check(
    'sampler and volcScale contract',
    ok,
    `quiet -> background exactly (scale 1); half-plume mean ${p.saod.toExponential(2)} -> scale ${volcScaleOfSaod(p.saod).toFixed(2)}; clamp 8; unknown -> 1`
  );
}

process.exit(fail ? 1 : 0);
