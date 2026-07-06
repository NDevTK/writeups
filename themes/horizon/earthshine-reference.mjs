// Reference printer for earthshine (node earthshine-reference.mjs).
// The model lives once in earthshine.js; landmarks against the Big
// Bear measurements (Goode et al. 2001) and exact solves:
//  - the Lambertian sphere phase law at its closed-form nodes:
//    f(0) = 1, f(pi/2) = 1/pi, f(pi) = 0 - all exact
//  - phase complementarity: new moon -> FULL Earth (alpha_E = 0),
//    quarter -> quarter, full moon -> new Earth (no ashen light)
//  - the full Earth from the Moon shines at magnitude -16.5,
//    inside the published -17 .. -16.1 band, and 30-50x brighter
//    than the full Moon from Earth (V = -12.73)
//  - the ashen-light contrast: earthlight/sunlight = ~8.2e-5 at
//    new moon - the dark side sits ~10.2 magnitudes below the
//    sunlit surface, the classical Danjon-scale figure
//  - A* = 0.297 verbatim (they MEASURED the Earth's reflectance
//    by watching exactly the glow this module draws)
import {
  A_STAR,
  D_MOON_KM,
  earthMagFromMoon,
  earthPhaseAngle,
  earthshineRatio,
  lambertPhase
} from './earthshine.js';
import {R_EARTH} from './lightning.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  const f0 = lambertPhase(0);
  const fq = lambertPhase(Math.PI / 2);
  const fp = lambertPhase(Math.PI);
  check(
    'Lambert phase law',
    Math.abs(f0 - 1) < 1e-15 &&
      Math.abs(fq - 1 / Math.PI) < 1e-15 &&
      Math.abs(fp) < 1e-15,
    `f(0) = ${f0}, f(pi/2) = ${fq.toFixed(6)} (1/pi exactly), f(pi) = ${fp} - the closed-form nodes`
  );
}

{
  check(
    'phase complementarity',
    Math.abs(earthPhaseAngle(Math.PI)) < 1e-15 &&
      Math.abs(earthPhaseAngle(0) - Math.PI) < 1e-15 &&
      Math.abs(earthPhaseAngle(Math.PI / 2) - Math.PI / 2) < 1e-15,
    `new moon -> alpha_E = 0 (FULL Earth), full moon -> alpha_E = pi (new Earth), quarter -> quarter - exact complements`
  );
}

{
  const mFull = earthMagFromMoon(Math.PI); // new moon: full Earth
  const vsMoon = Math.pow(10, -0.4 * (mFull - -12.73));
  check(
    'full Earth from the Moon',
    mFull > -17.0 && mFull < -16.1 && vsMoon > 25 && vsMoon < 55,
    `V = ${mFull.toFixed(2)} (published band -17 .. -16.1); ${vsMoon.toFixed(0)}x the full Moon's -12.73 (classical 30-50x)`
  );
}

{
  const rNew = earthshineRatio(Math.PI);
  const rQuarter = earthshineRatio(Math.PI / 2);
  const rFull = earthshineRatio(0);
  const danjon = -2.5 * Math.log10(rNew);
  const exact = A_STAR * (R_EARTH / D_MOON_KM) ** 2;
  check(
    'ashen-light contrast',
    Math.abs(rNew - exact) < 1e-18 &&
      rNew > 6e-5 &&
      rNew < 1.1e-4 &&
      Math.abs(rQuarter / rNew - 1 / Math.PI) < 1e-12 &&
      rFull < 1e-19 && // f(pi) is float-zero (~4e-17 of f(0))
      danjon > 9.8 &&
      danjon < 10.7 &&
      A_STAR === 0.297,
    `earthlight/sunlight at new moon = ${rNew.toExponential(3)} (= A* (R_E/d)^2 exactly); dark side ${danjon.toFixed(1)} mag below the sunlit surface; quarter = new/pi exactly; full moon -> 0; A* = 0.297 (Goode 2001, measured)`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
