// corona-reference.mjs - the gate for the Baumbach corona.
// Landmarks, all against the paper's own numbers and closed forms:
//  - eq. (5) at the limb: I(1) = 0.0532 + 1.425 + 2.565 = 4.0432
//    millionths of the disc centre, exactly the coefficient sum
//  - the closed-form total flux (each power law integrates
//    exactly: 2 pi c/(e-2)) matches a numeric quadrature, and
//    with the paper's U = 0.6 the corona carries ~1.4 millionths
//    of the sun's light - the classical "of order the full moon"
//  - the paper's eq. (2) mean-to-centre relation at U = 0.6:
//    I_mean/I_0 = 1 - U/3 = 0.8 exactly
//  - monotone decline across the measured 1-6 R_sun range, with
//    the steep terms dead by rho = 3 (the outer corona is the
//    rho^-2.5 term alone to better than 1%)
import {
  BAUMBACH_C,
  BAUMBACH_E,
  coronaCentreUnits,
  coronaRadiancePerIrradiance,
  coronaToSunFluxRatio,
  U_INTEGRATED
} from './corona.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  const limb = coronaCentreUnits(1);
  const sum = BAUMBACH_C[0] + BAUMBACH_C[1] + BAUMBACH_C[2];
  check(
    'Baumbach eq. (5) at the limb',
    Math.abs(limb - sum) < 1e-15 && Math.abs(sum - 4.0432) < 1e-12,
    `I(1) = ${limb.toFixed(4)} millionths of the disc centre - the coefficient sum verbatim (0.0532 + 1.425 + 2.565)`
  );
}

{
  // Closed form vs quadrature: 2 pi int_1^inf I rho d rho, each
  // term exactly 2 pi c/(e-2); trapezoid to rho = 400 with the
  // analytic tail appended must agree.
  const closed = coronaToSunFluxRatio();
  let num = 0;
  const N = 200000;
  const lnHi = Math.log(400);
  for (let i = 0; i < N; i++) {
    const a = Math.exp((lnHi * i) / N);
    const b = Math.exp((lnHi * (i + 1)) / N);
    num +=
      0.5 * (b - a) * (coronaCentreUnits(a) * a + coronaCentreUnits(b) * b);
  }
  num += (BAUMBACH_C[0] * Math.pow(400, -0.5)) / 0.5; // rho^-2.5 tail
  const numRatio = (2 * num * 1e-6) / (1 - U_INTEGRATED / 3);
  check(
    'total flux closed form',
    Math.abs(closed - numRatio) / closed < 1e-5 &&
      Math.abs(closed - 1.406e-6) < 0.01e-6,
    `corona/sun = ${(closed * 1e6).toFixed(3)}e-6 (closed) vs ${(numRatio * 1e6).toFixed(3)}e-6 (quadrature) - about 1.4 millionths of the sun, the classical of-order-the-full-moon total`
  );
}

{
  check(
    'mean-to-centre relation',
    Math.abs(1 - U_INTEGRATED / 3 - 0.8) < 1e-15,
    `the paper's eq. (2) with Abbot's U = 0.6: I_mean/I_0 = 0.8 exactly - the centre normalisation the drawn disc shares`
  );
}

{
  let mono = true;
  for (let r = 1; r < 6; r += 0.05)
    if (coronaCentreUnits(r + 0.05) >= coronaCentreUnits(r)) mono = false;
  const at3 = (BAUMBACH_C[0] * Math.pow(3, -2.5)) / coronaCentreUnits(3);
  const at6 = (BAUMBACH_C[0] * Math.pow(6, -2.5)) / coronaCentreUnits(6);
  check(
    'radial structure',
    mono &&
      Math.abs(at3 - 0.84) < 0.01 &&
      at6 > 0.99 &&
      coronaCentreUnits(6) < 1e-3,
    `monotone across the measured 1-6 R_sun; the rho^-2.5 term carries ${(at3 * 100).toFixed(0)}% at rho = 3 and ${(at6 * 100).toFixed(1)}% at the range edge - the steep inner terms die exactly where the fit ends; I(6) = ${coronaCentreUnits(6).toExponential(2)}`
  );
}

{
  // The irradiance closure: the limb-darkened disc at the implied
  // centre brightness must integrate back to EXACTLY the unit
  // irradiance - B_centre (1 - U/3) pi r^2 = 1 - and the corona
  // radiance at the limb is then 4.04 millionths of that centre.
  // At the 1 au disc (959.6"), B_centre = 18,382 per steradian
  // per unit irradiance: the corona's limb radiance 0.0743 sits
  // in the same frame as the model's sky (order 1e-2..1e-1), so
  // it emerges at totality and hides beneath the daytime aureole
  // - both on radiometry alone.
  const r1au = Math.asin(696000 / 149597870.7);
  const bCentre = 1 / ((1 - U_INTEGRATED / 3) * Math.PI * r1au * r1au);
  const closure = bCentre * (1 - U_INTEGRATED / 3) * Math.PI * r1au * r1au;
  const limb = coronaRadiancePerIrradiance(1, r1au);
  check(
    'irradiance closure',
    Math.abs(closure - 1) < 1e-15 &&
      Math.abs(limb - coronaCentreUnits(1) * 1e-6 * bCentre) < 1e-15 &&
      Math.abs(bCentre - 18382) < 20 &&
      Math.abs(limb - 0.0743) < 0.001,
    `disc integral closes to unit irradiance exactly; B_centre = ${bCentre.toFixed(0)} sr^-1, corona limb radiance ${limb.toFixed(4)} - the sky's own frame`
  );
}

process.exit(fail ? 1 : 0);
