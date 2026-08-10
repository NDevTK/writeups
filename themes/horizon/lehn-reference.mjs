// Reference printer for the Lehn 1983 mirage inversion (node
// lehn-reference.mjs). The module recovers a temperature profile
// from a superior-mirage transfer characteristic (JOSA 73, 1622,
// read in full), so the gate holds it to:
//  - its own constants against the repo's independent machinery
//    (g beta vs the nz gate's printed hydrostatic exponent; his
//    eps rho refractivity vs Ciddor)
//  - the closed-form tangency identities (A5)/(A6) exactly
//  - the vertex-temperature equation (2) against the ray tracer
//    it feeds (the invariant the whole zone-II iteration rides)
//  - the forward TC against far-terrain's INDEPENDENT Ciddor fan
//  - the round trip: a Whitefish-class synthetic inversion,
//    forward to a TC, inverted from the TC alone - his printed
//    convergence ("reasonable ... in three iterations and a good
//    approximation in eight") and profile recovery
//  - the stated domain: a fold-free day inverts to null, not to
//    an invented inversion.
import {
  LEHN_BETA,
  LEHN_EPS,
  LEHN_G,
  LEHN_R_E,
  gradientFromCurvature,
  lehnDensity,
  lehnFitElevated,
  lehnForwardTC,
  lehnInvertTC,
  rayCurvature,
  tangentDistance,
  tangentRadius,
  tcCriticalPoints,
  vertexTemperature
} from './lehn.js';
import {buildProfile, ciddorN} from './refraction.js';
import {rayFan} from './far-terrain.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const MIN = Math.PI / 180 / 60;

// The Whitefish-class truth: his geometry (eye 2.5 m over ice at
// -2 C, object plane 20 km) under a +6 K inversion 12-24 m with
// his Fig. 7 gradient class (~0.5 K/m), weak surface lapse below.
const TRUTH = {
  hM: [0, 12, 24, 60, 4000],
  tC: [-2.03, -2.27, 3.73, 3.55, -22.06]
};
const tTruth = (h) => {
  const {hM, tC} = TRUTH;
  let i = 0;
  while (i < hM.length - 2 && hM[i + 1] <= h) i++;
  const f = Math.min(1, Math.max(0, (h - hM[i]) / (hM[i + 1] - hM[i])));
  return tC[i] + (tC[i + 1] - tC[i]) * f;
};
const EYE = 2.5;
const DIST = 20000;

{
  // Constants against the repo's own machinery: g beta is the
  // autoconvective gradient the nz gate cross-closes against van
  // der Werf's printed 3.4177e-2 K/m; his refractivity n - 1 =
  // eps rho meets Ciddor at the green channel.
  const gb = LEHN_G * LEHN_BETA;
  const rho0 = lehnDensity(101325, 288.15);
  const nm1 = LEHN_EPS * rho0;
  const cid = ciddorN(0.55, 15, 101325, 0) - 1;
  check(
    'constants meet the repo',
    Math.abs(gb - 3.4177e-2) < 2e-4 && Math.abs(nm1 / cid - 1) < 0.03,
    `g beta = ${gb.toFixed(5)} K/m vs the printed hydrostatic exponent 0.03418 (nz gate); n - 1 = eps rho = ${(nm1 * 1e6).toFixed(1)}e-6 vs Ciddor ${(cid * 1e6).toFixed(1)}e-6 at 15 C - his two-constant air model sits ${((nm1 / cid - 1) * 100).toFixed(1)}% from the repo's Ciddor`
  );
}

{
  // (A5)/(A6) exactly: the closed-form radius makes the parabola
  // from the eye tangent to the parabolic Earth - equal height
  // AND slope at the closed-form distance.
  const zE = 2.5;
  const phiH = -3 * MIN;
  const r = tangentRadius(zE, phiH);
  const x = tangentDistance(zE, phiH);
  const zGap =
    -(x * x) / (2 * r) + x * Math.tan(phiH) + zE - -(x * x) / (2 * LEHN_R_E);
  const sGap = -x / r + Math.tan(phiH) - -x / LEHN_R_E;
  const g = gradientFromCurvature(271.15, 101325, 1 / r);
  const back = rayCurvature(271.15, 101325, g);
  check(
    'tangency and gradient identities',
    Math.abs(zGap) < 1e-9 &&
      Math.abs(sGap) < 1e-12 &&
      Math.abs(back * r - 1) < 1e-12,
    `the (A5) radius r = ${(r / 1000).toFixed(0)} km grazes the surface at x_h = ${(x / 1000).toFixed(2)} km with height gap ${zGap.toExponential(1)} m and slope gap ${sGap.toExponential(1)}; (A1) inverts its own curvature to 1e-12`
  );
}

{
  // The vertex invariant: trace zone-II rays through the truth
  // and read Eq. (2) at each traced vertex - the equation must
  // return (nearly) the profile's own temperature there, because
  // that is precisely how the inversion writes temperatures.
  const alphas = [0.5, 2, 3.5].map((m) => m * MIN);
  const f = lehnForwardTC(TRUTH, {eyeM: EYE, distM: DIST, alphas});
  let worst = 0;
  const rows = [];
  for (let k = 0; k < alphas.length; k++) {
    const tv =
      vertexTemperature(alphas[k], f.zVertex[k], {
        zE: EYE,
        TzeK: tTruth(EYE) + 273.15,
        TmK: tTruth(EYE) + 273.15,
        p0Pa: 101325
      }) - 273.15;
    const tp = tTruth(f.zVertex[k]);
    worst = Math.max(worst, Math.abs(tv - tp));
    rows.push(
      `phi ${(alphas[k] / MIN).toFixed(1)}': vertex ${f.zVertex[k].toFixed(1)} m, Eq.(2) ${tv.toFixed(2)} C vs profile ${tp.toFixed(2)} C`
    );
  }
  check(
    'vertex temperatures (Eq. 2) meet the tracer',
    Number.isFinite(worst) && worst < 0.6,
    `${rows.join('; ')} - worst ${worst.toFixed(2)} K between the closed form and the traced profile`
  );
}

{
  // The forward TC against far-terrain's fan: same truth
  // atmosphere, INDEPENDENT machinery (Ciddor refractivity and a
  // 100-m stepped march there; his two-constant air and exact
  // parabolic arcs here). Sub-pivot rays land within metres.
  const levels = [];
  let p = 101325;
  let hPrev = 0;
  for (const h of [0, 6, 12, 16, 20, 24, 40, 60, 300, 1000, 4000]) {
    if (h > 0) {
      const tMean = ((tTruth(hPrev) + tTruth(h)) / 2 + 273.15) / LEHN_BETA;
      p *= Math.exp((-(h - hPrev) * LEHN_G) / tMean);
    }
    levels.push({pPa: p, hM: h, tC: tTruth(h), rh: 0});
    hPrev = h;
  }
  const prof = buildProfile(levels, null);
  const alphas = [-2.6, -2.2, 8, 12].map((m) => m * MIN);
  const fan = rayFan(prof, EYE, alphas, DIST + 200, 100);
  const jD = Math.round(DIST / 100) - 1;
  const mine = lehnForwardTC(TRUTH, {eyeM: EYE, distM: DIST, alphas});
  let worst = 0;
  for (let i = 0; i < alphas.length; i++)
    worst = Math.max(worst, Math.abs(fan.hs[i][jD] - mine.zAt[i]));
  check(
    'forward TC meets the Ciddor fan',
    worst < 4,
    `four rays (below the pivot and above the minimum) land within ${worst.toFixed(2)} m of far-terrain's independent march at ${(DIST / 1000).toFixed(0)} km - two refractivity models, two integrators, one image`
  );
}

{
  // The round trip (his Whitefish procedure on a known truth):
  // forward to a 74-sample TC, invert from the TC alone with only
  // the eye height, eye-level temperature and surface pressure -
  // his printed convergence and a recovered profile.
  const alphas = [];
  for (let a = -4; a <= 18; a += 0.3) alphas.push(a * MIN);
  const tc = lehnForwardTC(TRUTH, {eyeM: EYE, distM: DIST, alphas});
  const {iP, iM} = tcCriticalPoints(tc);
  const oneVertex = Array.from(tc.nVertex).every((v) => v <= 1);
  const inv = lehnInvertTC(tc, {
    eyeM: EYE,
    distM: DIST,
    TzeC: tTruth(EYE),
    iterations: 8
  });
  const tRetr = (h) => {
    const {hM, tC} = inv.nodes;
    let i = 0;
    while (i < hM.length - 2 && hM[i + 1] <= h) i++;
    const f = Math.min(1, Math.max(0, (h - hM[i]) / (hM[i + 1] - hM[i])));
    return tC[i] + (tC[i + 1] - tC[i]) * f;
  };
  let s2 = 0;
  let n2 = 0;
  for (let h = 0; h <= 50; h += 1) {
    const d = tRetr(h) - tTruth(h);
    s2 += d * d;
    n2++;
  }
  const rms = Math.sqrt(s2 / n2);
  const probed = Math.max(...inv.vertexEl);
  const g1 = inv.zone1Grads[1];
  check(
    'the round trip recovers the profile',
    iP >= 0 &&
      iM > iP &&
      oneVertex &&
      inv.rms[2] < inv.rms[0] &&
      inv.rms[7] < 0.55 * inv.rms[0] &&
      rms < 1.3 &&
      Math.abs(g1 - -0.02) < 0.012,
    `the S-curve found (pivot ${(tc.alphas[iP] / MIN).toFixed(1)}', minimum ${(tc.alphas[iM] / MIN).toFixed(1)}'), every ray one-vertex (his stated domain); TC error ${inv.rms[0].toFixed(1)} -> ${inv.rms[2].toFixed(1)} m by iteration 3 ("a reasonable approximation") -> ${inv.rms[7].toFixed(1)} m by 8 ("a good approximation"); profile recovered to ${rms.toFixed(2)} K RMS over 0-50 m from the image alone (vertices probed to ${probed.toFixed(1)} m); the sub-inversion gradient lands ${g1.toFixed(4)} K/m vs the truth's -0.02`
  );
}

{
  // The stated domain, failed closed: a fold-free column (the
  // inversion too far above the eye for a 20-km object plane to
  // catch a vertex) has no pivot, and the inversion returns null
  // instead of inventing structure.
  const flat = {
    hM: [0, 20, 40, 70, 4000],
    tC: [-2.02, -2.42, 1.58, 1.4, -24.15]
  };
  const alphas = [];
  for (let a = -4; a <= 16; a += 0.5) alphas.push(a * MIN);
  const tc = lehnForwardTC(flat, {eyeM: EYE, distM: DIST, alphas});
  const {iP} = tcCriticalPoints(tc);
  const inv = lehnInvertTC(tc, {eyeM: EYE, distM: DIST, TzeC: -2});
  check(
    'fold-free days invert to null',
    iP < 0 && inv === null,
    `the same machinery under a +4 K inversion hoisted to 20-40 m shows a monotone TC at 20 km (no pivot: the vertex-and-return does not fit the range) and the inversion declines - no invented inversions on quiet days`
  );
}

{
  // The ELEVATED eye (beyond the printed corpus by its own
  // methods - Lehn & Morrish 1986's parametric fit on the 1983
  // tracer, mirrored): an eye at 450 m over a +4 K inversion at
  // 280-330 m. First the invariant that licenses the mirror:
  // Eq. (1)/(2) is a TURNING-POINT condition - at a traced ray's
  // PERIGEE the same closed form must return the profile's own
  // temperature, exactly as it does at a vertex.
  const T450 = 18;
  const tTruth = (z) =>
    z >= 330
      ? T450 - 0.0065 * (z - 450)
      : z >= 280
        ? T450 - 0.0065 * (330 - 450) - (4 * (330 - z)) / 50
        : T450 - 0.0065 * (330 - 450) - 4 - 0.0065 * (z - 280);
  const truth = {
    hM: [0, 280, 330, 450, 3450],
    tC: [0, 280, 330, 450, 3450].map(tTruth)
  };
  const alphas = [];
  for (let a = -75; a <= 5; a += 0.25) alphas.push(a * MIN);
  const obs = lehnForwardTC(truth, {eyeM: 450, distM: 90000, alphas});
  const {iP, iM} = tcCriticalPoints(obs, 6);
  let periWorst = 0;
  let periChecked = 0;
  for (let k = 0; k < alphas.length; k++) {
    if (obs.nPerigee[k] !== 1 || !Number.isFinite(obs.zPerigee[k])) continue;
    if (obs.zPerigee[k] > 440 || obs.zPerigee[k] < 250) continue;
    // phi at the TURN is zero; the launch angle phi enters Eq. (2)
    // squared - the invariant is direction-agnostic in it.
    const tv =
      vertexTemperature(Math.abs(alphas[k]), obs.zPerigee[k], {
        zE: 450,
        TzeK: T450 + 273.15,
        TmK: T450 + 273.15,
        p0Pa: 101325
      }) - 273.15;
    periWorst = Math.max(periWorst, Math.abs(tv - tTruth(obs.zPerigee[k])));
    periChecked++;
  }
  check(
    'the turning invariant holds at perigees',
    periChecked > 10 && periWorst < 0.7,
    `${periChecked} single-perigee rays from the 450-m eye: Eq. (2) at each traced perigee returns the profile's own temperature to ${periWorst.toFixed(2)} K worst - the vertex equation IS a turning-point equation, whichever side the ray turns from`
  );
  // The elevated round trip: fit the below-eye family from the
  // 90-km image alone.
  const fit = lehnFitElevated(obs, {eyeM: 450, distM: 90000, TzeC: T450});
  let rms = Infinity;
  if (fit) {
    const tFit = (z) => {
      const {hM, tC} = fit.nodes;
      let i = 0;
      while (i < hM.length - 2 && hM[i + 1] <= z) i++;
      const f = Math.min(1, Math.max(0, (z - hM[i]) / (hM[i + 1] - hM[i])));
      return tC[i] + (tC[i + 1] - tC[i]) * f;
    };
    let s2 = 0;
    let n = 0;
    for (let z = Math.max(0, fit.probedFloorM); z <= 450; z += 5) {
      const d = tFit(z) - tTruth(z);
      s2 += d * d;
      n++;
    }
    rms = Math.sqrt(s2 / n);
  }
  check(
    'the elevated eye retrieves its inversion',
    iP >= 0 &&
      iM > iP + 2 &&
      fit !== null &&
      Math.abs(fit.params.zBaseM - 280) < 8 &&
      Math.abs(fit.params.dTK - 4) < 0.5 &&
      Math.abs(fit.params.wM - 50) < 15 &&
      fit.onePerigee &&
      fit.tcRmsM < 3 &&
      rms < 0.3,
    fit
      ? `the mock-mirage S at 90 km (pivot ${(obs.alphas[iP] / MIN).toFixed(1)}'), inverted by the Morrish strategy (parametric family + TC-residual search): base ${fit.params.zBaseM.toFixed(1)} m (truth 280), strength ${fit.params.dTK.toFixed(2)} K (truth 4), thickness ${fit.params.wM.toFixed(0)} m (truth 50); TC reproduced to ${fit.tcRmsM.toFixed(2)} m, profile to ${rms.toFixed(3)} K RMS over ${fit.probedFloorM.toFixed(0)}-450 m - from the image and the eye-level temperature alone`
      : 'fit returned null'
  );
}

process.exit(fail ? 1 : 0);
