// Reference printer for the winds-aloft optical-turbulence profile
// (node cn2-reference.mjs). The model lives once in cn2.js;
// landmarks, all against published values:
//  - the HV5/7 profile (v = 21 m/s, A = 1.7e-14) is NAMED for its
//    landmarks: r0 = 5 cm and theta0 = 7 urad at 0.5 um (SPIE Field
//    Guide to Atmospheric Optics; Andrews & Phillips) - both
//    re-derived here from the moment integrals
//  - the INSTANTANEOUS Rytov point-receiver scintillation index at
//    HV5/7 zenith lands at sigma_I ~ 0.5 - the same order as Young
//    1967's naked-eye 0.255 (scintillation.js), which is smaller
//    because the 0.1 s photopic integration averages the ~2 ms
//    flying shadows; Young stays the display's calibrated anchor
//  - sigmaScale(21) = 1 exactly and grows monotonically with the
//    measured RMS wind
//  - the ITU-R P.1621 RMS wind integral is exact on constant and
//    linear analytic profiles
//  - the scintillation weighting Cn^2 h^(5/6) puts the mean
//    altitude in the jet (6-12 km), and the flying-shadow crossing
//    rate for a 30 m/s jet sits at the published
//    milliseconds-lifetime scale (Dravins et al. 1997 II)
import {
  A_GROUND,
  friedR0,
  hvCn2,
  isoplanatic,
  moment,
  rytovVar,
  shadowRate,
  sigmaScale,
  V_REF,
  vRms,
  weightedAltitude
} from './cn2.js';
import {EYE_D_CM, youngSigma} from './scintillation.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  const r0 = friedR0();
  const t0 = isoplanatic();
  check(
    'HV5/7 canon',
    Math.abs(r0 - 0.05) < 0.003 && Math.abs(t0 - 7e-6) < 0.5e-6,
    `r0 = ${(r0 * 100).toFixed(2)} cm (named 5), theta0 = ${(t0 * 1e6).toFixed(2)} urad (named 7) at 0.5 um`
  );
}

{
  const s2 = rytovVar();
  const young = youngSigma(EYE_D_CM, 1);
  const ratio = Math.sqrt(s2) / young;
  check(
    'Rytov vs Young',
    s2 < 1 && ratio > 1 && ratio < 4,
    `instantaneous sigma_I = ${Math.sqrt(s2).toFixed(3)} at HV5/7 zenith (weak regime), ` +
      `vs Young's 0.1 s eye ${young.toFixed(3)} - averaging suppresses ${ratio.toFixed(1)}x`
  );
}

{
  const sRef = sigmaScale(V_REF);
  const s12 = sigmaScale(12);
  const s40 = sigmaScale(40);
  check(
    'wind modulation',
    Math.abs(sRef - 1) < 1e-12 && s12 < 1 && s40 > 1 && s40 < 3,
    `scale(12) = ${s12.toFixed(3)}, scale(21) = ${sRef.toFixed(6)} (exact 1), scale(40) = ${s40.toFixed(3)}`
  );
}

{
  // ITU-R P.1621 RMS wind: constant profile is exact; a linear
  // profile V = a + b h has the analytic slab mean of V^2.
  const flat = vRms([4, 6, 9, 12, 16, 21].map((km) => ({h: km * 1000, v: 30})));
  const a = 5;
  const b = 1.2e-3;
  const lin = vRms(
    [4, 5, 8, 11, 14, 17, 20, 22].map((km) => ({
      h: km * 1000,
      v: a + b * km * 1000
    }))
  );
  const exact = Math.sqrt(
    (a * a * 15000 +
      a * b * (20000 ** 2 - 5000 ** 2) +
      (b * b * (20000 ** 3 - 5000 ** 3)) / 3) /
      15000
  );
  const short = vRms([
    {h: 5000, v: 10},
    {h: 12000, v: 20}
  ]);
  check(
    'ITU RMS wind',
    Math.abs(flat - 30) < 1e-9 &&
      Math.abs(lin - exact) < 1e-9 &&
      short === null,
    `flat 30 -> ${flat.toFixed(6)}, linear -> ${lin.toFixed(6)} (analytic ${exact.toFixed(6)}), short profile -> null`
  );
}

{
  const hBar = weightedAltitude();
  const rate = shadowRate(
    [5, 9, 11, 13, 16, 20].map((km) => ({h: km * 1000, v: 30})),
    V_REF
  );
  check(
    'shadow timescale',
    hBar > 6000 && hBar < 12000 && rate > 100 && rate < 1200,
    `weighted altitude ${(hBar / 1000).toFixed(1)} km (jet), 30 m/s crossing rate ${rate.toFixed(0)} Hz (~${(1000 / rate).toFixed(1)} ms lifetime)`
  );
}

{
  // Moment quadrature convergence and the profile's own shape: the
  // upper term must dominate mu_{5/6} (scintillation lives in the
  // jet, not in the ground layer) even though the ground layer has
  // the larger pointwise Cn^2.
  const m300 = moment(5 / 6, V_REF, A_GROUND, 300);
  const m600 = moment(5 / 6, V_REF, A_GROUND, 600);
  const noGround = moment(5 / 6, V_REF, 0);
  check(
    'moment integrals',
    Math.abs(m300 / m600 - 1) < 1e-6 && noGround / m300 > 0.5,
    `mu_5/6 converged (${Math.abs(m300 / m600 - 1).toExponential(1)}), upper terms carry ${((noGround / m300) * 100).toFixed(0)}%; Cn2(100m) = ${hvCn2(100).toExponential(2)} > Cn2(10.8km) = ${hvCn2(10833).toExponential(2)}`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
