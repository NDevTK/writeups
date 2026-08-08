// Reference gate for lunar-umbra.js (node lunar-umbra-reference.mjs):
// Mallama's printed shadow profile at its own structure, its
// printed narrative, the EMERGENT reproduction of his integrated
// table, and Ugolnikov's measured umbra.
import {
  UMBRA_MAG_LOST,
  umbralMagLost,
  umbralFactor,
  buildUmbraLUT,
  RAY_MIN_ALT,
  rayMinAltM,
  volcanicMagExtra
} from './lunar-umbra.js';
import {chainAOD675} from './volcanic.js';
import {lunarEclipse} from './eclipses.js';
import {MOON_FULL_VMAG} from './moonlight.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// Table B.2's printed full-moon baselines per band (its Pos'n-0
// row): the green one is also the paper's Sec. 5 "-12.7".
const BASE = {B: -11.82, G: -12.73, R: -13.64};

{
  // The vendored table at its printed structure: 50 rows,
  // positions ascending, every channel monotone non-decreasing,
  // endpoints verbatim (centre B 22.24, V 15.44, R 11.02), and
  // the colour fork where the paper puts it - the three branches
  // "separate about a third of the way in".
  const t = UMBRA_MAG_LOST;
  let asc = true;
  let mono = true;
  for (let i = 1; i < t.length; i++) {
    if (t[i][0] <= t[i - 1][0]) asc = false;
    for (let c = 1; c <= 3; c++) {
      if (t[i][c] < t[i - 1][c] - 1e-9) mono = false;
    }
  }
  const forkAt035 = Math.abs(umbralMagLost(2, 0.33) - umbralMagLost(0, 0.33));
  const forkAt05 = umbralMagLost(2, 0.5) - umbralMagLost(0, 0.5);
  const ok =
    t.length === 50 &&
    asc &&
    mono &&
    t[0][0] === 0 &&
    t[t.length - 1][0] === 1 &&
    t[t.length - 1][1] === 22.24 &&
    t[t.length - 1][2] === 15.44 &&
    t[t.length - 1][3] === 11.02 &&
    forkAt035 < 0.15 &&
    forkAt05 > 1;
  check(
    'Table B.1 structure',
    ok,
    `50 rows, ascending, monotone; centre B/V/R = 22.24/15.44/11.02 verbatim; branches joined at 0.33 (${forkAt035.toFixed(2)} mag), forked by 0.5 (${forkAt05.toFixed(1)} mag)`
  );
}

{
  // The printed narrative numbers: centre blue "has fallen by 22
  // magnitudes, which is almost a billion"; red "down by 11
  // magnitudes, or 20,000 times" - and the deep umbra is red
  // because of that ratio.
  const bDrop = 1 / umbralFactor(2, 1);
  const rDrop = 1 / umbralFactor(0, 1);
  const ok =
    bDrop > 5e8 &&
    bDrop < 1e9 &&
    rDrop > 2e4 &&
    rDrop < 3e4 &&
    umbralFactor(0, 1) / umbralFactor(2, 1) > 1e4;
  check(
    'printed narrative drops',
    ok,
    `centre blue 1/${bDrop.toExponential(2)} ("almost a billion"), red 1/${rDrop.toExponential(2)} ("20,000 times"); red/blue x${(umbralFactor(0, 1) / umbralFactor(2, 1)).toExponential(1)}`
  );
}

{
  // THE EMERGENT REPRODUCTION: disc-integrating the vendored
  // resolved table with the paper's own stated geometry (the
  // penumbral annulus width equals the lunar diameter, so
  // penumbra = umbra + 2 rMoon; mean-distance umbra/rMoon from
  // the theme's own eclipses.js) must land on Table B.2's
  // printed centred-moon endpoints: +7.39 / +1.44 / -3.05 in
  // B/V/R. No fit - the integrated table re-emerges from the
  // resolved one.
  const le = lunarEclipse(0, 1.496e8, 384400);
  const pen = le.umbra + 2 * le.rMoon;
  const N = 400;
  const integ = (c) => {
    let sum = 0;
    let w = 0;
    for (let i = 0; i < N; i++) {
      const s = ((i + 0.5) / N) * le.rMoon;
      sum += umbralFactor(c, 1 - s / pen) * s;
      w += s;
    }
    return -2.5 * Math.log10(sum / w);
  };
  const mB = BASE.B + integ(2);
  const mG = BASE.G + integ(1);
  const mR = BASE.R + integ(0);
  const ok =
    Math.abs(mB - 7.39) < 0.1 &&
    Math.abs(mG - 1.44) < 0.1 &&
    Math.abs(mR - -3.05) < 0.1 &&
    Math.abs(BASE.G - MOON_FULL_VMAG) < 0.05;
  check(
    'emergent Table B.2 endpoints',
    ok,
    `centred moon B ${mB.toFixed(2)} / V ${mG.toFixed(2)} / R ${mR.toFixed(2)} vs printed 7.39 / 1.44 / -3.05; baseline V ${BASE.G} vs shipped MOON_FULL_VMAG ${MOON_FULL_VMAG} (0.01)`
  );
}

{
  // The half-million and the measured umbra: Sec. 5 prints "the
  // brightness ratio between magnitudes -12.7 and +1.4 is nearly
  // one-half million"; Ugolnikov 2011 MEASURED the 503 nm umbra
  // falling "down to about 1e-6" - this table's deep-umbra green
  // factor sits within a factor ~1.5 of that measurement. The
  // LUT is the table (spot row).
  const ratio = Math.pow(10, 0.4 * (1.44 - BASE.G));
  const deepG = umbralFactor(1, 1);
  const lut = buildUmbraLUT(64, 0);
  const ok =
    ratio > 3e5 &&
    ratio < 6e5 &&
    deepG > 3e-7 &&
    deepG < 3e-6 &&
    Math.abs(lut[63 * 4 + 1] - deepG) < 1e-12 &&
    lut[0] === 1;
  check(
    'half-million ratio and the measured umbra',
    ok,
    `integrated span ratio ${ratio.toExponential(2)} ("nearly one-half million"); deep-umbra green ${deepG.toExponential(2)} vs Ugolnikov's measured ~1e-6; LUT ends exact`
  );
}

{
  // The volcanic coupling: Table 3.1's printed ray altitudes
  // verbatim and monotone (deeper shadow = lower graze); the
  // background stratosphere adds only tenths of a magnitude
  // (Mallama's clear table stays right at volcScale 1); at the
  // Pinatubo scale - SAOD675 = 0.1 through the LIVE feed's own
  // conversion - the centre darkens by the observed magnitudes
  // (his Fig. 5.1 outliers sit ~3-4 mag under the clear model)
  // with blue dying fastest; and the extra is exactly linear in
  // the measured volcScale.
  const okTab =
    RAY_MIN_ALT[1][0] === 6420 &&
    RAY_MIN_ALT[1][1] === 50 &&
    RAY_MIN_ALT[6][0] === 3724 &&
    RAY_MIN_ALT[6][1] === 8 &&
    rayMinAltM(0.5) > rayMinAltM(1.0);
  const bgG = volcanicMagExtra(1, 1, 1);
  const vs = 0.1 / chainAOD675();
  const pR = volcanicMagExtra(0, 1, vs);
  const pG = volcanicMagExtra(1, 1, vs);
  const pB = volcanicMagExtra(2, 1, vs);
  const lin =
    Math.abs(volcanicMagExtra(1, 1, 2) - 2 * volcanicMagExtra(1, 1, 1)) < 1e-12;
  const ok =
    okTab && bgG < 0.25 && pG > 3 && pG < 5.5 && pB > pG && pG > pR && lin;
  check(
    'volcanic coupling (the live stratosphere)',
    ok,
    `ray altitudes verbatim, monotone; background centre extra ${bgG.toFixed(2)} mag; Pinatubo scale (volcScale ${vs.toFixed(1)}) R/G/B +${pR.toFixed(1)}/+${pG.toFixed(1)}/+${pB.toFixed(1)} mag (observed ~3-4 in V), blue fastest; exactly linear in volcScale`
  );
}

process.exit(fail ? 1 : 0);
