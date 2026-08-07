// Reference gate for halos.js (node halos-reference.mjs):
//  - the Warren & Brandt (2008) ice rows verbatim, dispersion
//    ordered (blue bends more)
//  - prism minimum deviation at its closed points: the textbook
//    21.8-degree red halo, the 46-degree basal halo, the
//    stationarity identity D'(i_m) = 0
//  - Bravais skew-ray optics: n'(0) = n EXACTLY (sundogs touch
//    the halo at sunrise), monotone outward migration, the
//    closed-form ~61-degree cutoff where they die
//  - the caustic at its exact ratio (1/sqrt: four times farther
//    out is half as bright), dark inside
//  - the halo profile: red inner edge, sharp inside / soft
//    outside - the photographs' signature
//  - the sundogs end-to-end: at the horizon they sit ON the
//    halo; at 25 degrees they have moved out, red nearer the
//    sun; past the cutoff the profile is empty
import {
  bravais,
  caustic,
  haloProfile,
  ICE_N,
  mcHalo,
  mcParhelion,
  mulberry32,
  parhelion,
  parhelionProfile,
  parhelionShare,
  parhelionSigmaAlt,
  PARHELION_ALT_DEG,
  PARHELION_SHARE,
  PARHELION_SIGMA_ALT_DEG,
  PLATE_ALPHA,
  PLATE_ALPHA_RANGE,
  PLATE_C_OVER_A,
  PLATE_D_RANGE_UM,
  PLATE_D_UM,
  PLATE_H_UM,
  PLATE_TILT_THETA,
  HALO_FAMILY_FRACTION,
  haloOccurrence,
  parhelicCircleProfile,
  plateMeanC,
  plateProjArea,
  CIRCLE_SIGMA_ALT_DEG,
  PRISM_60,
  PRISM_90,
  prismDmin,
  prismIncidence,
  sundogCutoff,
  traceCrystal
} from './halos.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

{
  // Warren & Brandt rows verbatim; normal dispersion.
  const ok =
    ICE_N[0] === 1.3073 &&
    ICE_N[1] === 1.311 &&
    ICE_N[2] === 1.3163 &&
    ICE_N[2] > ICE_N[1] &&
    ICE_N[1] > ICE_N[0];
  check(
    'Warren-Brandt ice rows',
    ok,
    `n(680) = ${ICE_N[0]}, n(550) = ${ICE_N[1]}, n(440) = ${ICE_N[2]} - the compilation's own rows at the atmosphere's RGB`
  );
}

{
  // Prism closed points: red 22-degree halo at 21.66 (the
  // textbook ~21.8 rides n = 1.31), blue at 22.34 - red inner
  // edge; the 46-degree halo near 45.7; and stationarity - the
  // deviation D(i) = i + asin(n sin(A - asin(sin i / n))) - A is
  // flat at the symmetric incidence to first order.
  const dRed = prismDmin(ICE_N[0], PRISM_60) * DEG;
  const dBlue = prismDmin(ICE_N[2], PRISM_60) * DEG;
  const d46 = prismDmin(ICE_N[1], PRISM_90) * DEG;
  const n = ICE_N[1];
  const iM = prismIncidence(n, PRISM_60);
  const dev = (i) =>
    i +
    Math.asin(n * Math.sin(PRISM_60 - Math.asin(Math.sin(i) / n))) -
    PRISM_60;
  const slope = (dev(iM + 1e-6) - dev(iM - 1e-6)) / 2e-6;
  const ok =
    Math.abs(dRed - 21.66) < 0.05 &&
    Math.abs(dBlue - 22.34) < 0.05 &&
    dRed < dBlue &&
    Math.abs(d46 - 45.9) < 0.5 &&
    Math.abs(dev(iM) - prismDmin(n, PRISM_60)) < 1e-12 &&
    Math.abs(slope) < 1e-6;
  check(
    'prism minimum deviation',
    ok,
    `60-deg prism: red ${dRed.toFixed(2)} deg, blue ${dBlue.toFixed(2)} (red inner edge); 90-deg prism ${d46.toFixed(1)} deg; the full deviation function is stationary at the symmetric passage (|D'| = ${slope.toExponential(1)})`
  );
}

{
  // Bravais: at the horizon the skew index IS the index (the
  // sundogs sit on the halo); it grows monotonically with
  // elevation; the cutoff where n' = 2 has the closed form
  // asin(sqrt((4 - n^2)/3)) - about 61 degrees, where sundogs
  // are seen to die.
  const n = ICE_N[0];
  const cut = sundogCutoff(n);
  const ok =
    Math.abs(bravais(n, 0) - n) < 1e-15 &&
    bravais(n, 0.5) > bravais(n, 0.2) &&
    Math.abs(bravais(n, cut) - 2) < 1e-12 &&
    Math.abs(cut * DEG - 60.9) < 0.2 &&
    parhelion(n, cut + 0.01) === null &&
    parhelion(n, (50 * Math.PI) / 180) !== null;
  check(
    'Bravais skew rays',
    ok,
    `n'(0) = n exactly; n' = 2 exactly at the closed-form cutoff ${(cut * DEG).toFixed(1)} deg - past it the parhelion is null, the documented death of the sundogs`
  );
}

{
  // The caustic: 1/sqrt means four times farther from the edge
  // is exactly half as bright (beyond the solar smear); inside
  // is dark; the smeared peak is finite.
  const e = 0.02;
  const ratio = caustic(4 * e) / caustic(e);
  const ok =
    Math.abs(ratio - 0.5) < 0.02 &&
    caustic(-0.05) === 0 &&
    caustic(0) > 0 &&
    Number.isFinite(caustic(0.001));
  check(
    'minimum-deviation caustic',
    ok,
    `I(4e)/I(e) = ${ratio.toFixed(3)} (the 1/sqrt law); dark inside the edge; the solar disk keeps the peak finite`
  );
}

{
  // The halo profile: red channel peaks inside blue near 22
  // degrees; the inside flank is SHARP (5 percent two degrees
  // in), the outside soft (still lit three degrees out) - every
  // photograph's signature.
  const p = haloProfile();
  const g = (i) => (p.g0 + ((p.g1 - p.g0) * i) / (p.n - 1)) * DEG;
  const peakIn = (ch, lo, hi) => {
    let bi = 0;
    let bv = -1;
    for (let i = 0; i < p.n; i++) {
      if (g(i) < lo || g(i) > hi) continue;
      if (p.data[3 * i + ch] > bv) {
        bv = p.data[3 * i + ch];
        bi = i;
      }
    }
    return {g: g(bi), v: bv};
  };
  const at = (ch, deg) => {
    const i = Math.round(((deg * RAD - p.g0) / (p.g1 - p.g0)) * (p.n - 1));
    return p.data[3 * i + ch];
  };
  const r = peakIn(0, 19, 25);
  const b = peakIn(2, 19, 25);
  const ok =
    r.g > 21.3 &&
    r.g < 22.1 &&
    b.g > r.g + 0.4 &&
    at(0, 19.5) < 0.05 * r.v &&
    at(0, 25) > 0.1 * r.v;
  check(
    'the 22-degree halo',
    ok,
    `red peak ${r.g.toFixed(2)} deg, blue ${b.g.toFixed(2)} (red inner edge); dark 2 deg inside, still lit 3 deg outside - the caustic's asymmetry`
  );
}

{
  // Sundogs end-to-end: on the horizon the azimuthal offset IS
  // the halo radius (the great-circle identity degenerates); at
  // 25 degrees they have migrated out, red still nearer the sun;
  // past the cutoff the profile carries nothing.
  const ph0 = parhelion(ICE_N[0], 0);
  const d0 = prismDmin(ICE_N[0], PRISM_60);
  const p25r = parhelion(ICE_N[0], 25 * RAD);
  const p25b = parhelion(ICE_N[2], 25 * RAD);
  const prof = parhelionProfile(25 * RAD);
  const dead = parhelionProfile(65 * RAD);
  const ok =
    Math.abs(ph0.az - d0) < 1e-12 &&
    p25r.az > d0 &&
    p25b.az > p25r.az &&
    prof.any &&
    !dead.any &&
    dead.data.every((v) => v === 0);
  check(
    'sundogs',
    ok,
    `at the horizon the dogs sit ON the halo (azimuth = ${(ph0.az * DEG).toFixed(2)} deg exactly); at 25 deg elevation red has moved to ${(p25r.az * DEG).toFixed(1)} deg, blue to ${(p25b.az * DEG).toFixed(1)} (red toward the sun); at 65 deg the profile is empty - the cutoff`
  );
}

{
  // Greenler's Monte Carlo: the null test first - at n = 1 the
  // crystal is optically nothing and EVERY transit exits
  // undeviated (float noise only). Then determinism (same seed,
  // identical histogram), and the emergent structure: the 22 and
  // the 46 both stand at their minimum-deviation edges, and the
  // 46 comes out FAINT (the orientation + Fresnel statistics the
  // throughput-only model missed - it said 0.86; the crystal
  // says ~0.2).
  const rng = mulberry32(7);
  let maxDev = 0;
  let hits = 0;
  for (let i = 0; i < 30000; i++) {
    const h = traceCrystal(1.0, rng);
    if (h) {
      hits++;
      if (h.dev > maxDev) maxDev = h.dev;
    }
  }
  const a = mcHalo(ICE_N, 150000, 1337);
  const b = mcHalo(ICE_N, 150000, 1337);
  let same = true;
  for (let i = 0; i < a.data.length; i++) {
    if (a.data[i] !== b.data[i]) same = false;
  }
  const DEG = 180 / Math.PI;
  const g = (i) => (a.g0 + ((a.g1 - a.g0) * (i + 0.5)) / a.bins) * DEG;
  const peakIn = (lo, hi) => {
    let bi = 0;
    let bv = -1;
    for (let i = 0; i < a.bins; i++) {
      if (g(i) < lo || g(i) > hi) continue;
      if (a.data[i * 3] > bv) {
        bv = a.data[i * 3];
        bi = i;
      }
    }
    return {g: g(bi), v: bv};
  };
  const p22 = peakIn(20, 25);
  const p46 = peakIn(43, 50);
  const ratio = p46.v / p22.v;
  // hits threshold rescaled with the basal-area fix (the sundog
  // pass's audit): the corrected 3 sqrt(3)/2 basal area raises
  // AREA_MAX, so the flux rejection accepts fewer of the same
  // 30000 trials (~4000, was ~7800) - the count follows the
  // sampler, the physics is in the other clauses.
  const ok =
    hits > 2500 &&
    maxDev < 1e-6 &&
    same &&
    Math.abs(p22.g - 21.8) < 0.4 &&
    Math.abs(p46.g - 45.6) < 0.8 &&
    ratio > 0.05 &&
    ratio < 0.45;
  check(
    "Greenler's Monte Carlo",
    ok,
    `n = 1 null test: ${hits} transits, max deviation ${maxDev.toExponential(1)} rad; seeded histogram bit-identical; red 22 at ${p22.g.toFixed(2)} deg, red 46 at ${p46.g.toFixed(2)} deg, EMERGENT 46/22 ratio ${ratio.toFixed(2)} - the statistics Fresnel throughput alone put at 0.86`
  );
}

{
  // The plates behind the dogs, printed: Breon & Dubrulle 2004's
  // area-weighted oriented fraction (PLATE_ALPHA = the log
  // midpoint of their printed 1e-3..1e-2, the range itself
  // shipped), their ~1-degree tilt, their 0.1-to-a-few-mm
  // oriented sizes; Auer & Veal 1970's P1a law h = 2.020 d^0.449
  // turning the size midpoint into the reference aspect. All
  // identities of shipped constants - transcription-proof.
  const midD = Math.sqrt(PLATE_D_RANGE_UM[0] * PLATE_D_RANGE_UM[1]);
  const ok =
    PLATE_ALPHA_RANGE[0] === 1e-3 &&
    PLATE_ALPHA_RANGE[1] === 1e-2 &&
    Math.abs(PLATE_ALPHA - Math.sqrt(1e-5)) < 1e-9 &&
    Math.abs(PLATE_TILT_THETA - Math.PI / 180) < 1e-12 &&
    PLATE_D_RANGE_UM[0] === 100 &&
    PLATE_D_RANGE_UM[1] === 3000 &&
    Math.abs(PLATE_D_UM - midD) < 1e-9 &&
    Math.abs(PLATE_H_UM - 2.02 * midD ** 0.449) < 1e-9 &&
    Math.abs(PLATE_C_OVER_A - PLATE_H_UM / (PLATE_D_UM / 2)) < 1e-12;
  check(
    'plate constants from the printed sources',
    ok,
    `alpha ${PLATE_ALPHA.toExponential(2)} (B&D 1e-3..1e-2), tilt 1 deg, d ${PLATE_D_UM.toFixed(0)} um of [${PLATE_D_RANGE_UM}], h ${PLATE_H_UM.toFixed(1)} um (Auer-Veal P1a), c/a ${PLATE_C_OVER_A.toFixed(4)}`
  );
}

{
  // The plate Monte Carlo lands the caustic at the BRAVAIS
  // AZIMUTH - the cross-implementation position proof (vertical
  // faces conserve the vertical direction cosine; the deflection
  // is a rotation about the vertical), at three sun altitudes.
  // Its books close, and the light-pipe carries the dog to
  // altitude: without following basal total internal reflections
  // a thin plate could only dog at grazing sun.
  const DEG = 180 / Math.PI;
  let ok = true;
  let detail = '';
  for (const hd of [5, 20, 35]) {
    const mc = mcParhelion((hd * Math.PI) / 180, ICE_N, 200000);
    let pk = 0;
    for (let i = 0; i < mc.bins; i++)
      if (mc.data[i * 3] > mc.data[pk * 3]) pk = i;
    const azPk = (mc.a0 + ((pk + 0.5) / mc.bins) * (mc.a1 - mc.a0)) * DEG;
    const want =
      prismDmin(bravais(ICE_N[0], (hd * Math.PI) / 180), PRISM_60) * DEG;
    const A = mc.accepted[0];
    const closure =
      Math.abs(
        mc.binnedT[0] +
          mc.lowT[0] +
          mc.highT[0] +
          mc.offAlmT[0] +
          mc.circleT[0] +
          mc.reflOffAlmT[0] +
          mc.lostT[0] -
          A
      ) / A;
    if (!(Math.abs(azPk - want) < 0.6 && closure < 1e-9)) ok = false;
    detail += `h${hd}: peak ${azPk.toFixed(2)} (Bravais ${want.toFixed(2)}); `;
  }
  check('plate MC caustic at the Bravais azimuth, books closed', ok, detail);
}

{
  // The shipped share/sigma table IS the Monte Carlo: re-derive
  // three rows at the shipping sample count and hold the literals
  // to them (deterministic seed; 3% covers cross-engine float
  // drift). Physics of the whole table: the grazing row is the
  // maximum (a low plate is almost a pure prism to a low sun),
  // the fade past 5 degrees is monotone - why real dogs die as
  // the sun climbs - and the drawn wobble stays under a degree.
  const DEG = 180 / Math.PI;
  let ok = true;
  let detail = '';
  for (const [row, hd] of [
    [1, 5],
    [4, 20],
    [8, 40]
  ]) {
    const mc = mcParhelion((Math.max(hd, 0.5) * Math.PI) / 180, ICE_N, 600000);
    const s = mc.binnedT[1] / mc.accepted[1];
    const sg = mc.sigmaAlt[1] * DEG;
    if (!(Math.abs(s / PARHELION_SHARE[row] - 1) < 0.03)) ok = false;
    if (!(Math.abs(sg / PARHELION_SIGMA_ALT_DEG[row] - 1) < 0.05)) ok = false;
    detail += `h${hd}: share ${s.toFixed(4)} (shipped ${PARHELION_SHARE[row]}), sigma ${sg.toFixed(3)}; `;
  }
  for (let i = 2; i < PARHELION_SHARE.length; i++)
    if (!(PARHELION_SHARE[i] <= PARHELION_SHARE[i - 1] * 1.02)) ok = false;
  if (!(PARHELION_SHARE[0] > Math.max(...PARHELION_SHARE.slice(1)))) ok = false;
  if (!PARHELION_SIGMA_ALT_DEG.every((s) => s > 0.25 && s < 0.9)) ok = false;
  if (!(PARHELION_ALT_DEG.length === 12)) ok = false;
  check('shipped parhelion table = the Monte Carlo', ok, detail);
}

{
  // The interpolator: exact at the knots, zero outside the
  // physical range (fails closed below the horizon and past the
  // Bravais cutoff), sigma in radians.
  const DEG = 180 / Math.PI;
  const ok =
    Math.abs(parhelionShare((20 * Math.PI) / 180) - PARHELION_SHARE[4]) <
      1e-12 &&
    parhelionShare(-0.01) === 0 &&
    parhelionShare((58 * Math.PI) / 180) === 0 &&
    parhelionShare((56 * Math.PI) / 180) > 0 &&
    Math.abs(parhelionSigmaAlt((20 * Math.PI) / 180) * DEG - 0.359) < 1e-9;
  check(
    'share/sigma interpolation, closed outside the range',
    ok,
    `share(20) = ${parhelionShare((20 * Math.PI) / 180).toFixed(5)}, share(-)=0, share(58)=0; sigma(20) = ${(parhelionSigmaAlt((20 * Math.PI) / 180) * DEG).toFixed(3)} deg`
  );
}

{
  // The occurrence gate: Forster 2017's printed instantaneous
  // family rate (27% of cirrus rings), drawn deterministically
  // per site-hour. Landmarks: the long-run rate converges on the
  // printed constant (10^5 hours, one site); the draw is
  // DETERMINISTIC (same inputs, same sky); sites decorrelate;
  // the 5-minute boundary ramp is continuous and monotone; and
  // it fails closed on garbage coordinates or time.
  const lat = 46.62;
  const lon = 8.04;
  let on = 0;
  const N = 100000;
  for (let h = 0; h < N; h++) {
    const t = (h + 0.5) * 3600e3;
    if (haloOccurrence(lat, lon, t) > 0.5) on++;
  }
  const rate = on / N;
  const a = haloOccurrence(lat, lon, 1234 * 3600e3 + 1800e3);
  const b = haloOccurrence(lat, lon, 1234 * 3600e3 + 1800e3);
  // Decorrelation: two distant sites agree on ~rate^2 + (1-rate)^2
  // of hours, not all of them.
  let same = 0;
  const M = 20000;
  for (let h = 0; h < M; h++) {
    const t = (h + 0.5) * 3600e3;
    const x = haloOccurrence(lat, lon, t) > 0.5;
    const y = haloOccurrence(-33.9, 151.2, t) > 0.5;
    if (x === y) same++;
  }
  const expSame = HALO_FAMILY_FRACTION ** 2 + (1 - HALO_FAMILY_FRACTION) ** 2;
  // Ramp continuity at an on->off boundary: find one and walk it.
  let ramps = true;
  for (let h = 1; h < 4000; h++) {
    const t0 = h * 3600e3;
    const before = haloOccurrence(lat, lon, t0 - 1);
    const after = haloOccurrence(lat, lon, t0 + 1);
    if (Math.abs(after - before) > 0.01) ramps = false; // jump at edge
    const mid = haloOccurrence(lat, lon, t0 + 150e3); // 2.5 min in
    const done = haloOccurrence(lat, lon, t0 + 320e3); // 5.33 min in
    if (mid < Math.min(before, done) - 1e-9) ramps = false;
    if (mid > Math.max(before, done) + 1e-9) ramps = false;
    if (done !== haloOccurrence(lat, lon, t0 + 1800e3)) ramps = false;
  }
  const ok =
    HALO_FAMILY_FRACTION === 0.27 &&
    Math.abs(rate - HALO_FAMILY_FRACTION) < 0.01 &&
    a === b &&
    Math.abs(same / M - expSame) < 0.02 &&
    ramps &&
    haloOccurrence(NaN, lon, 1e12) === 0 &&
    haloOccurrence(lat, lon, NaN) === 0;
  check(
    'ring occurrence: printed rate, deterministic, ramped',
    ok,
    `long-run rate ${rate.toFixed(4)} (printed 0.27); deterministic; two sites agree ${((same / M) * 100).toFixed(1)}% (independence expects ${(expSame * 100).toFixed(1)}%); hour boundaries ramp over 5 min; NaN fails closed`
  );
}

{
  // The parhelic circle: the analytic external-reflection profile
  // against the Monte Carlo's own reflected books at two
  // altitudes (10 percent past 90 deg, 20 percent below - the
  // analytic omits the tilt smear that softens the steep
  // near-sun flank; stated). Shape closed points: exactly zero
  // toward the sun (grazing mirrors carry no area), white to a
  // few percent across the ice indices, and the drawn vertical
  // sigma equals the MC's reflected-family sigma at the shipped
  // literal.
  const DEG = 180 / Math.PI;
  let ok = true;
  let detail = '';
  for (const hd of [10, 30]) {
    const mc = mcParhelion((hd * Math.PI) / 180, ICE_N, 400000);
    const A = mc.accepted[1];
    const az = [60, 90, 130, 165].map((d) => (d * Math.PI) / 180);
    const ana = parhelicCircleProfile((hd * Math.PI) / 180, az);
    for (let k = 0; k < az.length; k++) {
      const b = Math.floor((az[k] / Math.PI) * mc.circleBins);
      const mcP =
        (mc.circleData[b * 3 + 1] +
          mc.circleData[(b + 1) * 3 + 1] +
          mc.circleData[(b - 1) * 3 + 1]) /
        3 /
        A /
        (Math.PI / mc.circleBins);
      const tol = az[k] > (Math.PI * 80) / 180 ? 0.12 : 0.25;
      if (!(Math.abs(mcP / ana[1][k] - 1) < tol)) ok = false;
    }
    const sg = mc.circleSigmaAlt[1] * DEG;
    if (!(Math.abs(sg / CIRCLE_SIGMA_ALT_DEG - 1) < 0.08)) ok = false;
    detail += `h${hd}: sigma ${sg.toFixed(3)} deg; `;
  }
  const zero = parhelicCircleProfile((20 * Math.PI) / 180, [0, 1e-6]);
  const white = parhelicCircleProfile((20 * Math.PI) / 180, [Math.PI / 2]);
  const spread =
    (Math.max(...white.map((c) => c[0])) -
      Math.min(...white.map((c) => c[0]))) /
    white[1][0];
  ok =
    ok &&
    zero[1][0] === 0 &&
    zero[1][1] < 1e-6 &&
    spread < 0.05 &&
    plateProjArea(0.5) > 0 &&
    plateMeanC() > 0.1 &&
    plateMeanC() < 0.2;
  check(
    'the parhelic circle: analytic = the traced mirrors',
    ok,
    detail +
      `zero toward the sun; white to ${(spread * 100).toFixed(1)}% across the ice indices; <c> ${plateMeanC().toFixed(3)}`
  );
}

process.exit(fail ? 1 : 0);
