// Reference gate for cloud-corona.js (node cloud-corona-reference.mjs):
// the cirrus diffraction corona, held to A&S printed Bessel values,
// the closed Airy forms, the papers' printed microphysics, and the
// slab radiometry's closed points.
import {
  j0,
  airyPattern,
  airyEncircled,
  cirrusSlantTau,
  coronaAmp,
  coronaColdGate,
  buildCloudCoronaLUT,
  CIRRUS_TAU_FULL,
  CORONA_T250_MAX,
  CORONA_D_UM,
  CORONA_N,
  CORONA_THETA_MAX_DEG,
  CHANNEL_UM
} from './cloud-corona.js';
import {j1} from './aureole.js';
import {sunAngularRadiusRad} from './eclipses.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const near = (a, b, t) => Math.abs(a - b) < t;

{
  // A&S Table 9.1 printed values hold the new J0 polynomial (J1 is
  // aureole.js's, already gated there): J0(1) = 0.7651976866,
  // J0(2) = 0.2238907791; and Table 9.5's first zero 2.4048255577
  // sits inside a bracketing sign change.
  const ok =
    near(j0(1), 0.7651976866, 2e-7) &&
    near(j0(2), 0.2238907791, 2e-7) &&
    j0(2.40482) > 0 !== j0(2.40484) > 0;
  check(
    'A&S J0 printed values + first zero',
    ok,
    `J0(1)=${j0(1).toFixed(10)} (printed 0.7651976866), J0(2)=${j0(2).toFixed(10)} (printed 0.2238907791); zero brackets 2.4048255577`
  );
}

{
  // Airy closed forms: central value exactly x^2/4pi, and the first
  // GREEN minimum at u = 3.8317059702 (A&S Table 9.5) - theta =
  // asin(u/x). At the printed 22 um that is 1.75 deg in green -
  // rings of "a few degrees", as G&L describe.
  const x = (Math.PI * CORONA_D_UM) / CHANNEL_UM[1];
  const p0 = airyPattern(CORONA_D_UM, CHANNEL_UM[1], [0])[0];
  const thMin = Math.asin(3.8317059702 / x);
  const eps = 1e-5;
  const pm = airyPattern(CORONA_D_UM, CHANNEL_UM[1], [thMin])[0];
  const pl = airyPattern(CORONA_D_UM, CHANNEL_UM[1], [thMin - eps])[0];
  const pr = airyPattern(CORONA_D_UM, CHANNEL_UM[1], [thMin + eps])[0];
  const ok =
    near(p0, (x * x) / (4 * Math.PI), 1e-9 * p0) &&
    pm < pl &&
    pm < pr &&
    pm < 1e-4 * p0;
  check(
    'Airy central value + first minimum',
    ok,
    `P(0)=${p0.toFixed(2)}/sr = x^2/4pi (x=${x.toFixed(2)}); first green minimum at ${((thMin * 180) / Math.PI).toFixed(3)} deg`
  );
}

{
  // The diameter inversion IS Sassen's method run backward: scan
  // the red channel's drawn pattern for its first minimum and
  // invert D = 3.8317059702 lambda / (pi sin theta) - the printed
  // 22 um comes back from the pattern's own geometry.
  const xR = (Math.PI * CORONA_D_UM) / CHANNEL_UM[0];
  const M = 20000;
  const thetas = [];
  for (let i = 0; i < M; i++)
    thetas.push(((i + 0.5) / M) * ((CORONA_THETA_MAX_DEG * Math.PI) / 180));
  const p = airyPattern(CORONA_D_UM, CHANNEL_UM[0], thetas);
  let iMin = -1;
  for (let i = 1; i < M - 1; i++) {
    if (p[i] < p[i - 1] && p[i] < p[i + 1]) {
      iMin = i;
      break;
    }
  }
  const dInv =
    (3.8317059702 * CHANNEL_UM[0]) / (Math.PI * Math.sin(thetas[iMin]));
  const ok = iMin > 0 && near(dInv, CORONA_D_UM, 0.02);
  check(
    'Sassen ring-to-diameter inversion',
    ok,
    `first red minimum ${((thetas[iMin] * 180) / Math.PI).toFixed(3)} deg -> D = ${dInv.toFixed(3)} um (printed ${CORONA_D_UM}); x_red=${xR.toFixed(1)}`
  );
}

{
  // Wavelength ordering - the corona's red-outside signature: the
  // first minimum moves outward with wavelength, exactly as u/x.
  const th1 = (c) =>
    Math.asin((3.8317059702 * CHANNEL_UM[c]) / (Math.PI * CORONA_D_UM));
  const ok = th1(0) > th1(1) && th1(1) > th1(2);
  check(
    'red ring outside green outside blue',
    ok,
    `first minima R/G/B ${((th1(0) * 180) / Math.PI).toFixed(3)}/${((th1(1) * 180) / Math.PI).toFixed(3)}/${((th1(2) * 180) / Math.PI).toFixed(3)} deg`
  );
}

{
  // Pattern quadrature against the closed encircled energy
  // E(u) = 1 - J0^2 - J1^2 (Rayleigh / Born & Wolf 8.5.2) - unit
  // diffraction efficiency truncated at the drawn cone. The iota
  // of slack is the exact 1/cos(theta) obliquity the small-angle
  // closed form drops (<= 0.6% at 6 deg).
  const M = 40000;
  const thMax = (CORONA_THETA_MAX_DEG * Math.PI) / 180;
  const x = (Math.PI * CORONA_D_UM) / CHANNEL_UM[1];
  let integ = 0;
  for (let i = 0; i < M; i++) {
    const th = ((i + 0.5) / M) * thMax;
    const p = airyPattern(CORONA_D_UM, CHANNEL_UM[1], [th])[0];
    integ += p * 2 * Math.PI * Math.sin(th) * (thMax / M);
  }
  const uMax = x * Math.sin(thMax);
  const closed = airyEncircled(uMax);
  const ok = near(integ / closed, 1, 6e-3) && closed > 0.9 && closed < 1;
  check(
    'encircled-energy identity at the cone edge',
    ok,
    `quadrature ${integ.toFixed(5)} vs closed E(${uMax.toFixed(1)}) = ${closed.toFixed(5)} (ratio ${(integ / closed).toFixed(5)}); the cone holds ${(closed * 100).toFixed(1)}% of the diffracted light`
  );
}

{
  // Slab radiometry closed points: zero at zero (no cirrus, no
  // corona), initial slope EXACTLY the extinction-paradox half,
  // maximum at tau = 1 with value 1/(2e).
  const h = 1e-9;
  const slope = coronaAmp(h) / h;
  const ok =
    coronaAmp(0) === 0 &&
    near(slope, 0.5, 1e-6) &&
    near(coronaAmp(1), 0.5 / Math.E, 1e-15) &&
    coronaAmp(0.999) < coronaAmp(1) &&
    coronaAmp(1.001) < coronaAmp(1) &&
    coronaAmp(4) < coronaAmp(1);
  check(
    'slab factor closed points',
    ok,
    `amp(0)=0; slope(0)=${slope.toFixed(9)} (paradox 1/2); max at tau=1 = ${coronaAmp(1).toFixed(9)} = 1/2e`
  );
}

{
  // The measured cirrus column: full cover at the zenith is the
  // printed FARS mean 0.75 exactly; cover scales linearly; the
  // grazing floor matches cirrusT's documented 0.08.
  const ok =
    CIRRUS_TAU_FULL === 0.75 &&
    cirrusSlantTau(1, 1) === 0.75 &&
    near(cirrusSlantTau(0.5, 0.5), 0.75, 1e-15) &&
    near(cirrusSlantTau(1, 0.01), 0.75 / 0.08, 1e-12) &&
    cirrusSlantTau(0, 1) === 0;
  check(
    'Sassen & Comstock column',
    ok,
    `full-cover zenith tau ${cirrusSlantTau(1, 1)} (printed mean 0.75); zero cover -> 0; grazing floor 0.08`
  );
}

{
  // The cold gate holds the printed range edge both ways and fails
  // CLOSED without the measurement: -60 (Sassen's warm edge) and
  // the 1998 case's -71 pass; -59.9 refuses; null/NaN refuse.
  const ok =
    coronaColdGate(CORONA_T250_MAX) === true &&
    coronaColdGate(-71) === true &&
    coronaColdGate(-59.9) === false &&
    coronaColdGate(null) === false &&
    coronaColdGate(undefined) === false &&
    coronaColdGate(NaN) === false;
  check(
    'cold gate at the printed edge, closed without measurement',
    ok,
    `-60 and -71 pass, -59.9 refuses, null/NaN refuse (edge ${CORONA_T250_MAX} C)`
  );
}

{
  // The drawn LUT: source-disc convolution preserves the pattern's
  // energy scale (kernel normalised - central value only smears
  // DOWN) and the first GREEN ring SURVIVES the sun's disc at the
  // printed 22 um - the modulation Sassen photographed; its
  // contrast is printed by this landmark.
  const srcR = sunAngularRadiusRad();
  const lut = buildCloudCoronaLUT(srcR);
  const x = (Math.PI * CORONA_D_UM) / CHANNEL_UM[1];
  const raw0 = ((x * x) / (4 * Math.PI)) * 1;
  const c0 = lut.curve[1];
  const dTheta = lut.thetaMaxRad / CORONA_N;
  const iMinG = Math.round(Math.asin(3.8317059702 / x) / dTheta - 0.5);
  let minV = Infinity;
  let minI = -1;
  for (let i = iMinG - 12; i <= iMinG + 12; i++) {
    const v = lut.curve[i * 4 + 1];
    if (v < minV) {
      minV = v;
      minI = i;
    }
  }
  let max2 = 0;
  for (let i = minI; i < Math.min(minI + 60, CORONA_N); i++)
    max2 = Math.max(max2, lut.curve[i * 4 + 1]);
  const contrast = (max2 - minV) / Math.max(max2, 1e-12);
  const ok =
    c0 < raw0 &&
    c0 > 0.2 * raw0 &&
    minI > 0 &&
    contrast > 0.05 &&
    lut.thetaMaxRad === (CORONA_THETA_MAX_DEG * Math.PI) / 180;
  check(
    'convolved LUT: smeared centre, first ring survives the disc',
    ok,
    `P(0) ${raw0.toFixed(1)} -> ${c0.toFixed(1)}/sr through the ${((srcR * 2 * 180) / Math.PI).toFixed(3)} deg disc; ring modulation ${(contrast * 100).toFixed(1)}% at ${(((minI + 0.5) * dTheta * 180) / Math.PI).toFixed(2)} deg`
  );
}

{
  // Degeneration to nothing, every road: warm sky, no cover, no
  // measurement, night (the caller multiplies by day) - each kills
  // the amplitude; and the gate never resurrects on garbage.
  const ampOf = (t250, cover, sinAlt) =>
    coronaColdGate(t250) ? coronaAmp(cirrusSlantTau(cover, sinAlt)) : 0;
  const ok =
    ampOf(-40, 0.5, 0.5) === 0 &&
    ampOf(-65, 0, 0.5) === 0 &&
    ampOf(null, 0.5, 0.5) === 0 &&
    ampOf(-65, 0.5, 0.5) > 0;
  check(
    'degenerates to no corona',
    ok,
    `warm/no-cover/unmeasured -> 0; cold measured cover -> ${ampOf(-65, 0.5, 0.5).toFixed(4)}`
  );
}

process.exit(fail ? 1 : 0);
