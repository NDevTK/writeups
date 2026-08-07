// Reference gate for cloud-corona.js (node cloud-corona-reference.mjs):
// the cirrus and droplet diffraction coronas, held to A&S printed
// Bessel values, the closed Airy and lognormal forms, the papers'
// printed microphysics, and the slab radiometry's closed points.
import {
  j0,
  airyPattern,
  airyEncircled,
  cirrusSlantTau,
  coronaAmp,
  coronaColdGate,
  buildCloudCoronaLUT,
  buildDropletCoronaLUT,
  dropletMode,
  shellChordAM,
  shellFirstExit,
  CIRRUS_BASE_M,
  CIRRUS_TOP_M,
  CIRRUS_TAU_FULL,
  CORONA_T250_MAX,
  CORONA_D_UM,
  CORONA_N,
  CORONA_THETA_MAX_DEG,
  CHANNEL_UM,
  DROPLET_SIGMA_LOG,
  DROPLET_DN_UM,
  DROPLET_DE_OBS_UM,
  DROPLET_DIFF_SHARE
} from './cloud-corona.js';
import {
  j1,
  diffractionPattern,
  lnIntegral,
  lognormalMomentRatio
} from './aureole.js';
import {sunAngularRadiusRad} from './eclipses.js';
import {pathToRadiusT, sunTransmittanceJS} from './sun-transmittance.js';
import {pillarShare, PILLAR_SIGMA_ALT} from './halos.js';

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
  // First-order energy conservation of the drawn pair: the disc
  // dims by e^-tau while the singly scattered light returns as
  // (tau/2) e^-tau diffracted (the drawn corona) plus the equal
  // large-angle geometric half - so e^-tau (1 + tau) accounts for
  // ALL first-order light and misses total energy only at second
  // scattering order: 1 - e^-tau (1 + tau) = tau^2/2 - ... The
  // gate holds the deficit under tau^2/2 across the physical
  // range - extinction is redistribution, not loss.
  let ok = true;
  let worst = 0;
  for (const tau of [0.01, 0.1, 0.3, 0.75, 1, 2]) {
    const first = Math.exp(-tau) * (1 + tau);
    const deficit = 1 - first;
    worst = Math.max(worst, deficit / ((tau * tau) / 2));
    if (!(deficit >= 0 && deficit <= (tau * tau) / 2)) ok = false;
    if (!near(2 * coronaAmp(tau), tau * Math.exp(-tau), 1e-15)) ok = false;
  }
  check(
    'disc + corona conserve at first order',
    ok,
    `1 - e^-tau(1+tau) in [0, tau^2/2] over tau 0.01..2 (worst fraction ${worst.toFixed(3)}); the drawn corona is exactly half the scattered first order`
  );
}

{
  // The measured cirrus column: full cover at the zenith is the
  // printed FARS mean 0.75 exactly (the shell chord is exactly 1
  // vertical), cover scales linearly, and the slant is now the
  // EXACT chord through Sassen & Campbell's printed shell - the
  // 0.08 grazing floor is retired. Closed points: the FARS Part I
  // heights verbatim; vertical air mass 1 exact; convergence on
  // the plane-parallel 1/sin where it was ever right (0.5% at 30
  // deg) with the honest geometric correction at 10 deg (~4.5%);
  // the horizon chord equals its own sqrt(2 R dH) closed form and
  // BEATS the old floor (18.2 vs the clamped 12.5); even in
  // elevation from below the shell; brute-force ray-sample match
  // from the eye AND from inside the shell (the crystal frame) at
  // positive and negative elevations; first-exit is never longer
  // than the full chord and equals it whenever there is no
  // far-side re-entry; garbage fails closed.
  const R = 6360e3;
  const brute = (e, hEye) => {
    const r0 = R + hEye;
    let L = 0;
    const ds = 20;
    for (let s = ds / 2; s < 3e6; s += ds) {
      const r = Math.sqrt(r0 * r0 + s * s + 2 * r0 * s * Math.sin(e));
      const h = r - R;
      if (h >= CIRRUS_BASE_M && h <= CIRRUS_TOP_M) L += ds;
      if (h > CIRRUS_TOP_M + 2e5 && s > 4e5) break;
    }
    return L / (CIRRUS_TOP_M - CIRRUS_BASE_M);
  };
  let ok =
    CIRRUS_BASE_M === 8790 &&
    CIRRUS_TOP_M === 11020 &&
    CIRRUS_TAU_FULL === 0.75 &&
    shellChordAM(Math.PI / 2) === 1 &&
    cirrusSlantTau(1, 1) === 0.75 &&
    cirrusSlantTau(0, 1) === 0 &&
    cirrusSlantTau(1, NaN) === 0 &&
    shellChordAM(NaN) === 0;
  const am30 = shellChordAM((30 * Math.PI) / 180, 300);
  const am10 = shellChordAM((10 * Math.PI) / 180, 300);
  ok = ok && near(am30 * Math.sin((30 * Math.PI) / 180), 1, 0.005);
  ok = ok && am10 < 1 / Math.sin((10 * Math.PI) / 180) && am10 > 5.3;
  const g = shellChordAM(0, 300);
  const gClosed =
    (Math.sqrt((R + CIRRUS_TOP_M) ** 2 - (R + 300) ** 2) -
      Math.sqrt((R + CIRRUS_BASE_M) ** 2 - (R + 300) ** 2)) /
    (CIRRUS_TOP_M - CIRRUS_BASE_M);
  ok = ok && near(g / gClosed, 1, 1e-9) && g > 1 / 0.08;
  ok =
    ok &&
    shellChordAM((-5 * Math.PI) / 180, 300) ===
      shellChordAM((5 * Math.PI) / 180, 300);
  const Hm = (CIRRUS_BASE_M + CIRRUS_TOP_M) / 2;
  let worstB = 0;
  for (const [eDeg, hE] of [
    [15, 300],
    [2, 300],
    [0, 300],
    [-1, 300],
    [5, Hm],
    [0, Hm],
    [-1, Hm],
    [-2, Hm],
    [-3, Hm]
  ]) {
    const e = (eDeg * Math.PI) / 180;
    const rel = Math.abs(shellChordAM(e, hE) / brute(e, hE) - 1);
    worstB = Math.max(worstB, rel);
    if (!(rel < 1e-3)) ok = false;
    const fx = shellFirstExit(e, hE);
    if (!(fx <= shellChordAM(e, hE) + 1e-12)) ok = false;
    if (hE === 300 || eDeg >= 0) {
      // no far-side re-entry from below the shell, nor ascending
      // from inside: first exit IS the chord
      if (!near(fx, shellChordAM(e, hE), 1e-9)) ok = false;
    }
  }
  // The patch assumption, measured: at the crystal frame the
  // grazing sun leg's near branch vs the full chord.
  const nf1 = shellFirstExit((-2 * Math.PI) / 180, Hm);
  const nf2 = shellChordAM((-2 * Math.PI) / 180, Hm);
  ok = ok && nf1 < nf2;
  check(
    'Sassen & Comstock column through the Sassen & Campbell shell',
    ok,
    `heights 8.79/11.02 km verbatim; vertical AM 1 exact; 30-deg vs 1/sin ${((am30 * Math.sin((30 * Math.PI) / 180) - 1) * 100).toFixed(2)}%; 10-deg correction ${((1 - am10 * Math.sin((10 * Math.PI) / 180)) * 100).toFixed(1)}%; horizon chord ${g.toFixed(1)} = closed form (old floor said ${(1 / 0.08).toFixed(1)}); brute-force worst ${worstB.toExponential(1)}; near/full at the crystal, -2 deg: ${nf1.toFixed(1)}/${nf2.toFixed(1)}`
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

{
  // Miles, Verlinde & Clothiaux 2000 Table 3, printed: median
  // diameters 13.1 um (marine) / 7.7 um (continental), sigma_log
  // 0.38 for both classes. Internal corroboration - their Eq. (7a)
  // D_e = D_n exp(5 sigma^2/2) computed from the two fitted
  // parameters must land inside the printed spread of the
  // INDEPENDENTLY tabulated D_e,obs (19.2 +- 4.7 / 10.8 +- 4.1):
  // two survey columns agreeing through the lognormal's own
  // closed moment, not through anything this module chose.
  const de = (cls) =>
    DROPLET_DN_UM[cls] * Math.exp(2.5 * DROPLET_SIGMA_LOG ** 2);
  const ok =
    DROPLET_DN_UM.marine === 13.1 &&
    DROPLET_DN_UM.continental === 7.7 &&
    DROPLET_SIGMA_LOG === 0.38 &&
    near(de('marine'), 18.8, 0.05) &&
    Math.abs(de('marine') - DROPLET_DE_OBS_UM.marine) < 4.7 &&
    near(de('continental'), 11.05, 0.05) &&
    Math.abs(de('continental') - DROPLET_DE_OBS_UM.continental) < 4.1;
  check(
    'Miles Table 3 printed classes, Eq. 7a corroboration',
    ok,
    `D_e from (D_n, sigma): marine ${de('marine').toFixed(2)} um (printed obs 19.2 +- 4.7), continental ${de('continental').toFixed(2)} um (printed obs 10.8 +- 4.1)`
  );
}

{
  // The paper reports UNTRUNCATED fits; the module's quadrature
  // bounds (1 um - the survey's FSSP floor - to 100 um) must be
  // effectively untruncated: the second-to-third moment ratio from
  // the bounded quadrature agrees with the closed untruncated
  // lognormal form to < 1e-4 relative, both classes.
  let ok = true;
  let detail = '';
  for (const cls of ['marine', 'continental']) {
    const m = dropletMode(cls);
    const q =
      lnIntegral(m.rm, m.sigma, m.rMin, m.rMax, (r) => r * r * r) /
      lnIntegral(m.rm, m.sigma, m.rMin, m.rMax, (r) => r * r);
    const cl = lognormalMomentRatio(m.rm, m.sigma, 3, 2);
    const rel = Math.abs(q / cl - 1);
    if (!(rel < 1e-4)) ok = false;
    detail += `${cls} rel ${rel.toExponential(1)}; `;
  }
  check(
    'droplet bounds effectively untruncated',
    ok,
    detail + 'closed lognormal moments reproduced'
  );
}

{
  // The ensemble pattern's central closed form - the aureole
  // machinery's own documented identity, at the droplet modes:
  // P(0) = pi <r^4> / (lambda^2 <r^2>).
  let ok = true;
  let detail = '';
  for (const cls of ['marine', 'continental']) {
    const m = dropletMode(cls);
    const p0 = diffractionPattern(m, CHANNEL_UM[1], [1e-7])[0];
    const closed =
      (Math.PI * lognormalMomentRatio(m.rm, m.sigma, 4, 2)) /
      (CHANNEL_UM[1] * CHANNEL_UM[1]);
    if (!near(p0 / closed, 1, 1e-4)) ok = false;
    detail += `${cls} P(0) ${p0.toFixed(1)}/sr (closed ${closed.toFixed(1)}); `;
  }
  check('droplet ensemble central closed form', ok, detail);
}

{
  // Degeneration: as sigma_g -> 1 the ensemble collapses onto the
  // monodisperse Airy pattern of the same median - the droplet and
  // cirrus coronas are ONE machinery at different widths. (Angles
  // away from the Airy minima, where a vanishing spread must not
  // matter.)
  const rm = 11;
  const tight = {
    rm,
    sigma: Math.exp(0.01),
    rMin: rm * Math.exp(-0.05),
    rMax: rm * Math.exp(0.05)
  };
  const th = [0.3, 0.8, 1.2].map((d) => (d * Math.PI) / 180);
  const pe = diffractionPattern(tight, CHANNEL_UM[1], th);
  const pa = airyPattern(2 * rm, CHANNEL_UM[1], th);
  const ok = th.every((t, i) => near(pe[i] / pa[i], 1, 0.01));
  check(
    'ensemble degenerates to the monodisperse Airy',
    ok,
    `sigma_g -> 1 at D = 22 um: ratios ${th.map((t, i) => (pe[i] / pa[i]).toFixed(4)).join(', ')}`
  );
}

{
  // At the PRINTED width the rings are gone: every channel of both
  // classes is strictly monotone decreasing across the drawn 6 deg
  // grid - G&L's flat-and-wide washout ("interference that results
  // from flat and wide droplet size distributions washes out the
  // outer rings"), from the survey's own sigma. The cirrus pattern
  // above keeps its rings; the deck's corona is the smooth aureole.
  const thMax = (CORONA_THETA_MAX_DEG * Math.PI) / 180;
  const grid = [];
  for (let i = 0; i < CORONA_N; i++) grid.push(((i + 0.5) / CORONA_N) * thMax);
  let ok = true;
  for (const cls of ['marine', 'continental']) {
    const m = dropletMode(cls);
    for (const um of CHANNEL_UM) {
      const p = diffractionPattern(m, um, grid);
      for (let i = 1; i < CORONA_N; i++) if (p[i] > p[i - 1]) ok = false;
    }
  }
  check(
    'printed width leaves an aureole, not rings',
    ok,
    `both classes, all channels monotone over 0..${CORONA_THETA_MAX_DEG} deg at sigma_log ${DROPLET_SIGMA_LOG}`
  );
}

{
  // G&L's inverse size law as exact similarity: with equal
  // sigma_log and bounds scaled with the median, the continental
  // pattern IS the marine one stretched by D_mar/D_cont in angle
  // and dimmed by its square - P_mar(asin(sin th / s)) =
  // s^2 P_cont(th), s = 13.1/7.7. Held at four angles to 0.1%.
  const s = DROPLET_DN_UM.marine / DROPLET_DN_UM.continental;
  const th = [0.5, 1.5, 3, 5].map((d) => (d * Math.PI) / 180);
  const pc = diffractionPattern(dropletMode('continental'), CHANNEL_UM[1], th);
  const pm = diffractionPattern(
    dropletMode('marine'),
    CHANNEL_UM[1],
    th.map((t) => Math.asin(Math.sin(t) / s))
  );
  const ok = th.every((t, i) => near(pm[i] / (s * s * pc[i]), 1, 1e-3));
  check(
    'inverse size law: continental = marine stretched by D ratio',
    ok,
    `s = ${s.toFixed(3)}; similarity ratios ${th.map((t, i) => (pm[i] / (s * s * pc[i])).toFixed(4)).join(', ')}`
  );
}

{
  // The deck amp partition: the dome carries DROPLET_DIFF_SHARE *
  // tau (the paradox half, NO e^-tau) because the volumetric
  // composite extinguishes the dome behind every deck pixel -
  // multiplying the two legs back together must reproduce the
  // cirrus corona's whole slab law EXACTLY, at every tau: same
  // physics, the extinction carried by the compositor instead of
  // the amp. And with no deck (tau 0, the unattached map's zero
  // texture) the corona is exactly nothing - fails closed.
  let ok = DROPLET_DIFF_SHARE === 0.5;
  for (const tau of [0, 0.01, 0.3, 0.75, 1, 2, 4]) {
    const domeLeg = DROPLET_DIFF_SHARE * tau;
    const compositeLeg = Math.exp(-tau);
    if (!near(domeLeg * compositeLeg, coronaAmp(tau), 1e-15)) ok = false;
  }
  check(
    'deck amp * composite extinction = the slab law',
    ok,
    `share ${DROPLET_DIFF_SHARE} (van de Hulst paradox half); (tau/2) * e^-tau reassembled exactly over tau 0..4; tau 0 -> nothing`
  );
}

{
  // The drawn droplet LUTs: the sun's limb-darkened disc and the
  // moon's flat disc each smear the centre DOWN (normalised
  // kernel), and the convolved curves stay monotone - the drawn
  // aureole keeps the ensemble's ringless shape through the disc.
  const srcR = sunAngularRadiusRad();
  let ok = true;
  let detail = '';
  for (const [name, lut] of [
    ['sun/marine', buildDropletCoronaLUT(srcR, 'marine')],
    ['moon/continental', buildDropletCoronaLUT(srcR, 'continental', [0, 0, 0])]
  ]) {
    const cls = name.split('/')[1];
    const m = dropletMode(cls);
    const raw0 =
      (Math.PI * lognormalMomentRatio(m.rm, m.sigma, 4, 2)) /
      (CHANNEL_UM[1] * CHANNEL_UM[1]);
    const c0 = lut.curve[1];
    if (!(c0 < raw0 && c0 > 0.5 * raw0)) ok = false;
    for (let i = 1; i < CORONA_N; i++)
      if (lut.curve[i * 4 + 1] > lut.curve[(i - 1) * 4 + 1] * 1.0001)
        ok = false;
    detail += `${name} P(0) ${raw0.toFixed(0)} -> ${c0.toFixed(0)}/sr; `;
  }
  check('droplet LUTs: smeared centre, monotone through the disc', ok, detail);
}

{
  // The TWILIGHT PILLAR composition - the exact chain the theme
  // draws (crystal-local frame): visible-centroid view elevation
  // (truncated-Gaussian closed form), the crystal where that ray
  // meets the deck mid-shell, the LOCAL sun altitude there
  // (horizon-dip arc - at h = -2 the crystal 180 km sunward sees
  // the sun only 0.4 deg below ITS horizon), the deck-frame beam
  // through the Hillaire integral (its own planet shadow IS the
  // twilight cutoff), the view leg's air (pathToRadiusT) and its
  // in-veil extinction, the sun leg's in-veil slab on the
  // first-exit chord (the stated single-patch assumption), and
  // the tilt-folded share. Landmarks: finite and non-negative
  // everywhere; CONTINUOUS through sunset (the fold's point); the
  // drawn peak in deep twilight (h in [-4, -2] at thin cover);
  // strongly RED there (the photographs' pillar); exactly zero
  // once the deck's sun sets (~-4.6 deg); zero cover kills it.
  const mie = {scat: [4e-6, 4e-6, 4e-6], abs: [4.4e-7, 4.4e-7, 4.4e-7]};
  const Rb = 6360e3;
  const Hm = (CIRRUS_BASE_M + CIRRUS_TOP_M) / 2;
  const Rm = Rb + Hm;
  const R1 = Rb + CIRRUS_BASE_M;
  const RAD = Math.PI / 180;
  const erf = (x) => {
    const s = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    return (
      s *
      (1 -
        ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t -
          0.284496736) *
          t +
          0.254829592) *
          t *
          Math.exp(-x * x))
    );
  };
  const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  const phiN = (z) => Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI);
  const E = (hDeg, c, eyeH = 300) => {
    const h = hDeg * RAD;
    const sigV = Math.hypot(PILLAR_SIGMA_ALT, 0.00465 / 2);
    const vis = 1 - Phi(h / sigV);
    if (!(vis > 1e-12)) return [0, 0, 0];
    const eVis = -h + (sigV * phiN(h / sigV)) / vis;
    const r0 = Rb + eyeH;
    const se = Math.sin(eVis);
    const sMid = -r0 * se + Math.sqrt(r0 * se * r0 * se + Rm * Rm - r0 * r0);
    const sBase = -r0 * se + Math.sqrt(r0 * se * r0 * se + R1 * R1 - r0 * r0);
    const aC = Math.atan2(sMid * Math.cos(eVis), r0 + sMid * se);
    const hLoc = h + aC;
    const tB = sunTransmittanceJS(Math.sin(hLoc), mie, Hm);
    const tV = pathToRadiusT(se, mie, eyeH, Hm);
    const dens = (CIRRUS_TAU_FULL * c) / (CIRRUS_TOP_M - CIRRUS_BASE_M);
    const tVeil = Math.exp(-dens * (sMid - sBase));
    const amp = coronaAmp(CIRRUS_TAU_FULL * c * shellFirstExit(hLoc, Hm));
    const sh = pillarShare(h);
    return [0, 1, 2].map((k) => tB[k] * tV[k] * tVeil * amp * sh[k] * vis);
  };
  let ok = true;
  let peak = 0;
  let pH = 0;
  for (let hd = -5; hd <= 3.001; hd += 0.05) {
    const v = E(hd, 0.1);
    if (!v.every((x) => Number.isFinite(x) && x >= 0)) ok = false;
    if (v[0] > peak) {
      peak = v[0];
      pH = hd;
    }
  }
  const atPeak = E(pH, 0.1);
  const cross = E(-0.02, 0.1)[0] / E(0.02, 0.1)[0];
  let p3 = 0;
  let pH3 = 0;
  for (let hd = -5; hd <= 0.001; hd += 0.05) {
    const v = E(hd, 0.3)[0];
    if (v > p3) {
      p3 = v;
      pH3 = hd;
    }
  }
  ok =
    ok &&
    pH > -4 &&
    pH < -2 &&
    pH3 > -4.5 &&
    pH3 < -2.5 &&
    E(-4.6, 0.1).every((v) => v === 0) &&
    E(-3, 0.1)[0] > 0 &&
    E(-1, 0.1)[0] > E(1, 0.1)[0] &&
    atPeak[0] / atPeak[1] > 5 &&
    atPeak[0] / atPeak[2] > 100 &&
    Math.abs(cross - 1) < 0.1 &&
    E(-3, 0).every((v) => v === 0);
  check(
    'the twilight pillar: continuous through sunset, red, then the deck sets',
    ok,
    `peak at h = ${pH.toFixed(2)} deg (cover 0.1; ${pH3.toFixed(2)} at 0.3), R/G ${(atPeak[0] / atPeak[1]).toFixed(1)}, R/B ${(atPeak[0] / atPeak[2]).toFixed(0)}; cross-sunset ratio ${cross.toFixed(3)}; dark at -4.6 (the deck's own sunset); zero cover -> 0`
  );
}

process.exit(fail ? 1 : 0);
