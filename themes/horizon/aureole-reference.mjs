// Reference gate for aureole.js (node aureole-reference.mjs): the
// solar aureole's delta similarity set, held to closed forms and to
// the printed numbers of its sources (Chin et al. 2002 Table 2/3;
// Hess et al. 1998 OPAC Tables 1c/4; Wiscombe NCAR TN-121+STR;
// Abramowitz & Stegun 9.4).
import {
  aureoleSet,
  diffractionPattern,
  j1,
  lnIntegral,
  lognormalMomentRatio,
  MITR,
  similarityScale,
  ssGrowth,
  sscmExtinctionShare,
  SSCM,
  CURVE_N,
  THETA_MAX_DEG
} from './aureole.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const near = (a, b, t) => Math.abs(a - b) < t;

{
  // Bessel J1 at Abramowitz & Stegun printed values (Table 9.1) and
  // the printed first zero j_{1,1} = 3.8317059702 (Table 9.5).
  const ok =
    near(j1(1), 0.4400505857, 2e-7) &&
    near(j1(2), 0.5767248078, 2e-7) &&
    near(j1(5), -0.3275791376, 2e-7) &&
    Math.abs(j1(3.8317059702)) < 2e-7;
  check(
    'A&S Bessel J1',
    ok,
    `J1(1)=${j1(1).toFixed(9)} J1(2)=${j1(2).toFixed(9)} J1(5)=${j1(5).toFixed(9)} J1(j11)=${j1(3.8317059702).toExponential(1)}`
  );
}

{
  // Truncated-lognormal quadrature vs the closed-form moment ratio
  // <r^4>/<r^2> = rm^2 exp(6 ln^2 sigma) with wide bounds.
  const rm = 1.64;
  const sg = 2.03;
  const m4 = lnIntegral(rm, sg, 1e-4, 1e4, (r) => r ** 4);
  const m2 = lnIntegral(rm, sg, 1e-4, 1e4, (r) => r ** 2);
  const closed = lognormalMomentRatio(rm, sg, 4, 2);
  check(
    'lognormal moments closed form',
    near(m4 / m2 / closed, 1, 1e-9),
    `<r4>/<r2> quadrature/closed = ${(m4 / m2 / closed).toFixed(12)}`
  );
}

{
  // The Airy pattern of one large sphere integrates to exactly its
  // geometric cross-section share: 2 pi INT P sin th dth = 1 (van
  // de Hulst's diffraction unit efficiency), and the ensemble
  // central value hits the closed form pi <r^4> / (lambda^2 <r^2>).
  const mono = {rm: 5, sigma: 1.0000001, rMin: 4.999, rMax: 5.001};
  const N = 4000;
  const thetas = [];
  for (let i = 0; i < N; i++) thetas.push(((i + 0.5) / N) * (Math.PI / 2));
  const P = diffractionPattern(mono, 0.55, thetas);
  let integ = 0;
  for (let i = 0; i < N; i++)
    integ += P[i] * 2 * Math.PI * Math.sin(thetas[i]) * (Math.PI / 2 / N);
  const p0 = diffractionPattern(mono, 0.55, [0])[0];
  const closed0 = (Math.PI * 5 ** 4) / (0.55 ** 2 * 5 ** 2);
  const ok = near(integ, 1, 5e-3) && near(p0 / closed0, 1, 1e-3);
  check(
    'Airy diffraction: unit efficiency + central closed form',
    ok,
    `integral ${integ.toFixed(4)} (=1); P(0)=${p0.toFixed(1)} vs pi r^2/lambda^2 = ${closed0.toFixed(1)} /sr`
  );
}

{
  // The monodisperse first minimum sits at the printed Bessel zero:
  // sin(theta_min) = 3.8317/x (the Airy radius of the aperture).
  const r = 5;
  const x = (2 * Math.PI * r) / 0.55;
  const thMin = Math.asin(3.8317059702 / x);
  const mono = {rm: r, sigma: 1.0000001, rMin: r - 0.001, rMax: r + 0.001};
  const eps = 2e-4;
  const [pa, pb, pc] = diffractionPattern(mono, 0.55, [
    thMin - eps,
    thMin,
    thMin + eps
  ]);
  check(
    'first Airy minimum at j11/x',
    pb < pa && pb < pc && pb < 1e-3 * diffractionPattern(mono, 0.55, [0])[0],
    `theta_min ${(thMin * 180) / Math.PI}deg: P dips to ${pb.toExponential(2)}`
  );
}

{
  // Wiscombe (NCAR TN-121+STR, printed forms): at f = g^2 and a
  // pure delta spike the similarity relations reproduce
  // g' = g/(1+g), tau' = (1 - w g^2) tau, w' = (1-g^2) w/(1 - w g^2).
  const g = 0.73;
  const w = 0.92;
  const tau = 0.3;
  const s = similarityScale(tau, w, g, g * g, 1);
  const ok =
    near(s.g, g / (1 + g), 1e-14) &&
    near(s.tau, (1 - w * g * g) * tau, 1e-14) &&
    near(s.w, ((1 - g * g) * w) / (1 - w * g * g), 1e-14);
  check(
    'Wiscombe printed forms at f = g^2',
    ok,
    `g' ${s.g.toFixed(6)} = g/(1+g) ${(g / (1 + g)).toFixed(6)}; tau'/tau ${(s.tau / tau).toFixed(6)}; w' ${s.w.toFixed(6)}`
  );
}

{
  // Chin Table 3 growth: exact at the printed knots, monotone.
  const ok =
    ssGrowth(0) === 1 &&
    ssGrowth(80) === 2.0 &&
    ssGrowth(99) === 4.8 &&
    ssGrowth(85) > 2.0 &&
    ssGrowth(85) < 2.4;
  check(
    'sea-salt growth at printed knots',
    ok,
    `f(0)=1 f(80)=${ssGrowth(80)} f(99)=${ssGrowth(99)} f(85)=${ssGrowth(85).toFixed(2)}`
  );
}

{
  // SSCM's extinction share within sea salt from OPAC's printed
  // maritime-clean numbers (20 : 3.2e-3) and both printed Qs: the
  // coarse mode carries ~0.5-2% of the species extinction dry, and
  // MORE when humidity swells the r^2 moments equally... the ratio
  // is growth-invariant by construction (both modes scale by the
  // same factor; the bounds truncate asymmetrically only in the
  // far tails). Pin dry value and invariance.
  const dry = sscmExtinctionShare(1);
  const wet = sscmExtinctionShare(2.0);
  check(
    'SSCM share from printed ratios',
    dry > 0.003 && dry < 0.03 && near(wet / dry, 1, 0.05),
    `dry ${(dry * 100).toFixed(2)}% of sea-salt extinction; at 2x growth ${(wet * 100).toFixed(2)}% (scale-invariant)`
  );
}

{
  // The full set on a dust-forward synthetic day (tau_du 0.30 of
  // 0.40 total at 555, measured w 0.90): f lands where the printed
  // 1/Q says it must - tau_spike = 0.30/2.277 + ss coarse term -
  // and the conservation identity f g_spike + (1-f) g' = g holds
  // per channel to 1e-12.
  const set = {
    tau: [0.36, 0.4, 0.46],
    ssa: [0.9, 0.9, 0.9],
    g: 0.73,
    fractions: {dust: 0.75, seaSalt: 0.1}
  };
  const products = {
    species: {
      dust: {aot: 0.3, sct: 0.27},
      seaSalt: {aot: 0.04, sct: 0.04}
    }
  };
  const a = aureoleSet(set, products, 80);
  const tauSpikeExpect = 0.3 / MITR.q + (0.04 * a.shareCoa) / SSCM.q;
  let consOk = true;
  for (let c = 0; c < 3; c++) {
    const lhs = a.fDiff[c] * a.gSpike[c] + (1 - a.fDiff[c]) * a.gPrime[c];
    if (!near(lhs, set.g, 1e-12)) consOk = false;
  }
  const ok =
    near(a.tauSpike, tauSpikeExpect, 1e-12) &&
    consOk &&
    a.fDiff[1] > 0.2 &&
    a.fDiff[1] < 0.5 &&
    a.gSpike[1] > 0.9 &&
    a.curve[4 * 4 + 1] > a.curve[200 * 4 + 1];
  check(
    'delta set on a dust day',
    ok,
    `tau_spike ${a.tauSpike.toFixed(4)} (printed 1/Q), f550 ${a.fDiff[1].toFixed(3)}, g_spike ${a.gSpike[1].toFixed(3)}, g' ${a.gPrime[1].toFixed(3)}, cone ${((a.coneRad * 180) / Math.PI).toFixed(1)}deg, conservation 1e-12`
  );
}

{
  // Wavelength behaviour: the spike pattern NARROWS toward the blue
  // (x grows), while tau_spike is channel-independent (geometric
  // cross-sections diffract at every wavelength) - f differs only
  // through each channel's own Mie scattering.
  const thetas = [(1 * Math.PI) / 180];
  const pR = diffractionPattern(MITR, 0.68, thetas)[0];
  const pB = diffractionPattern(MITR, 0.44, thetas)[0];
  const p0R = diffractionPattern(MITR, 0.68, [0])[0];
  const p0B = diffractionPattern(MITR, 0.44, [0])[0];
  check(
    'blue spike narrower, red wider',
    p0B > p0R && pB / p0B < pR / p0R,
    `P(0): blue ${p0B.toFixed(0)} > red ${p0R.toFixed(0)} /sr; at 1deg blue holds ${((pB / p0B) * 100).toFixed(0)}% vs red ${((pR / p0R) * 100).toFixed(0)}%`
  );
}

{
  // MITR's printed truncation (r_max 5 um) is load-bearing: the
  // untruncated tail would carry r^4-weighted mass the dataset
  // says transported dust does not have.
  const p0Trunc = diffractionPattern(MITR, 0.55, [0])[0];
  const p0Open = diffractionPattern(
    {rm: MITR.rm, sigma: MITR.sigma, rMin: 1e-4, rMax: 1e4},
    0.55,
    [0]
  )[0];
  check(
    'MITR printed r_max is load-bearing',
    p0Trunc < 0.5 * p0Open,
    `P(0) truncated ${p0Trunc.toFixed(0)} vs untruncated ${p0Open.toFixed(0)} /sr`
  );
}

{
  // Degeneration: no products, or a mix with no coarse species,
  // yields NO set - the caller runs the unscaled system, identical
  // to the pre-aureole build (f = 0 collapses every similarity
  // relation to identity: also pinned algebraically).
  const setNull = aureoleSet(null, null, 80);
  const noCoarse = aureoleSet(
    {tau: [0.1, 0.1, 0.1], ssa: [0.9, 0.9, 0.9], g: 0.7, fractions: {}},
    {species: {sulfate: {aot: 0.1, sct: 0.09}}},
    80
  );
  const id = similarityScale(0.3, 0.92, 0.73, 0, 1);
  const ok =
    setNull === null &&
    noCoarse === null &&
    id.tau === 0.3 &&
    id.w === 0.92 &&
    near(id.g, 0.73, 1e-15);
  check(
    'degeneration to the unscaled system',
    ok,
    `no products -> null; sulfate-only -> null; f=0 scalings are identity`
  );
}

{
  // The terrain direct beam's scaled Beer law
  // (sun-transmittance.js fDiff): absent fDiff is bit-identical to
  // fDiff = 0 (every historical caller unchanged), and a full
  // fDiff = 1 with zero absorption removes the Mie term EXACTLY -
  // the scaled extinction sigma_ext - f sigma_s at its algebraic
  // endpoints.
  const {sunTransmittanceJS} = await import('./sun-transmittance.js');
  const mu = 0.05; // low sun, where the Mie term bites hardest
  const s = [4e-6, 4e-6, 4e-6];
  const base = sunTransmittanceJS(mu, {scat: s, abs: [0, 0, 0]});
  const f0 = sunTransmittanceJS(mu, {
    scat: s,
    abs: [0, 0, 0],
    fDiff: [0, 0, 0]
  });
  const f1 = sunTransmittanceJS(mu, {
    scat: s,
    abs: [0, 0, 0],
    fDiff: [1, 1, 1]
  });
  const noMie = sunTransmittanceJS(mu, {scat: [0, 0, 0], abs: [0, 0, 0]});
  const ok =
    base.every((v, c) => v === f0[c]) &&
    f1.every((v, c) => v === noMie[c]) &&
    f1[1] > base[1];
  check(
    'terrain beam scaled Beer endpoints',
    ok,
    `no-fDiff === fDiff 0 (bit); fDiff 1 + abs 0 === no Mie (bit); T' ${f1[1].toFixed(4)} > T ${base[1].toFixed(4)} at graze`
  );
}

process.exit(fail ? 1 : 0);
