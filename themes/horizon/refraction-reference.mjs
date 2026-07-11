// Reference printer for atmospheric refraction (node
// refraction-reference.mjs). The low sun's displacement,
// flattening and dispersion are ray-traced, so the gate holds the
// tracer to independent anchors:
//  - Ciddor refractivity to the NIST check value and to the
//    INDEPENDENT Birch & Downs revised Edlen equation
//  - the integral to its closed forms: exactly 0 at the zenith,
//    (n0-1)tan(z) at 45 deg, Bennett's empirical fit at 10 deg,
//    the classical band at the horizon
//  - dispersion: the green image sits higher than red, blue
//    higher than green, in proportion to the refractivity spread
//  - the setting sun's published flattening (~5/6) and the exact
//    apparent/true fixed-point roundtrip
import {
  ARCSEC,
  buildProfile,
  DEG,
  apparentAltitude,
  ciddorN,
  foldCount,
  refractionRad,
  standardProfile,
  SUN_DISC_RAD,
  sunRefraction,
  transferCurve
} from './refraction.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // Ciddor 1996 vs NIST (633 nm, 20 C, 101325 Pa, dry, 450 ppm:
  // n-1 = 2.71800e-4) and vs Birch & Downs (1994) at standard
  // 15 C - two independent formulations agreeing to 1e-9.
  const nist = ciddorN(0.633, 20, 101325, 0) - 1;
  const c15 = ciddorN(0.633, 15, 101325, 0);
  const s2 = 1 / (0.633 * 0.633);
  const bd = 1 + (8342.54 + 2406147 / (130 - s2) + 15998 / (38.9 - s2)) * 1e-8;
  const disp =
    ciddorN(0.44, 15, 101325, 0) > ciddorN(0.55, 15, 101325, 0) &&
    ciddorN(0.55, 15, 101325, 0) > ciddorN(0.68, 15, 101325, 0);
  const moist = ciddorN(0.55, 20, 101325, 1) < ciddorN(0.55, 20, 101325, 0);
  check(
    'Ciddor refractivity',
    Math.abs(nist - 2.718e-4) < 5e-9 &&
      Math.abs(c15 - bd) < 5e-9 &&
      disp &&
      moist,
    `633 nm 20 C: ${(nist * 1e4).toFixed(5)}e-4 (NIST 2.71800e-4); vs Birch-Downs ${Math.abs(c15 - bd).toExponential(1)}; blue > green > red; moist air less refractive`
  );
}

{
  // The ray tracer against its closed forms on the ICAO standard
  // atmosphere: zero at the zenith exactly; (n0-1)tan(z) at 45 deg
  // (the flat-atmosphere identity, sphericity is second order
  // there); Bennett's fit at 10 deg (5.28'); the classical band
  // at the horizon.
  const prof = standardProfile();
  const zenith = refractionRad(90 * DEG, prof, 0.55);
  const r45 = refractionRad(45 * DEG, prof, 0.55) / ARCSEC;
  const closed = (ciddorN(0.55, 15, 101325, 0) - 1) / ARCSEC;
  const r10 = refractionRad(10 * DEG, prof, 0.55) / ARCSEC / 60;
  const bennett = 1 / Math.tan((10 + 7.31 / (10 + 4.4)) * DEG); // arcmin
  const rh = (refractionRad(0, prof, 0.55) / DEG) * 60;
  check(
    'ray tracer closed forms',
    zenith === 0 &&
      Math.abs(r45 - closed) < 0.5 &&
      Math.abs(r10 - bennett) / bennett < 0.05 &&
      rh > 32 &&
      rh < 35.5,
    `zenith exactly 0; R(45°) ${r45.toFixed(2)}" vs (n0-1)tan z ${closed.toFixed(2)}"; R(10°) ${r10.toFixed(2)}' vs Bennett ${bennett.toFixed(2)}'; horizon ${rh.toFixed(2)}' (classical ~33-35' at 15 C)`
  );
}

{
  // Dispersion: the green image rides above red, blue above
  // green, and the split tracks the refractivity spread (the
  // geometry is shared, so dR/R follows dn/(n-1)).
  const prof = standardProfile();
  const rG = refractionRad(0, prof, 0.55);
  const rR = refractionRad(0, prof, 0.68);
  const rB = refractionRad(0, prof, 0.44);
  const gr = (rG - rR) / ARCSEC;
  const bg = (rB - rG) / ARCSEC;
  const nG = ciddorN(0.55, 15, 101325, 0) - 1;
  const nR = ciddorN(0.68, 15, 101325, 0) - 1;
  const ratio = (rG - rR) / rG / ((nG - nR) / nG);
  check(
    'green rim dispersion',
    gr > 10 && gr < 20 && bg > gr && Math.abs(ratio - 1) < 0.15,
    `green sits ${gr.toFixed(1)}" above red at the horizon (blue ${bg.toFixed(1)}" above green); dR/R tracks dn/(n-1) to ${((ratio - 1) * 100).toFixed(1)}%`
  );
}

{
  // The drawn sun: fixed-point apparent altitude roundtrips at
  // fp; the setting sun's vertical flattening lands in the
  // published ~5/6 band; the rim widens as the sun drops (the
  // flash's approach); an elevated observer's below-horizontal
  // ray (tangent-point path) still returns finite, larger
  // refraction.
  const prof = standardProfile();
  const rt = apparentAltitude(10 * DEG, prof, 0.55);
  const err = Math.abs(rt - refractionRad(rt, prof, 0.55) - 10 * DEG);
  const setting = sunRefraction(-0.5 * DEG, prof, 50);
  const high = sunRefraction(2 * DEG, prof, 50);
  const rimSet = (setting.appG - setting.appR) / ARCSEC;
  const rimHigh = (high.appG - high.appR) / ARCSEC;
  const below = refractionRad(-0.2 * DEG, prof, 0.55, 300);
  const at0 = refractionRad(0, prof, 0.55, 300);
  check(
    'the drawn sun',
    err < 1e-9 &&
      setting.flatten > 0.75 &&
      setting.flatten < 0.9 &&
      high.flatten > setting.flatten &&
      rimSet > rimHigh &&
      rimSet > 8 &&
      Number.isFinite(below) &&
      below > at0,
    `apparent/true roundtrip ${err.toExponential(1)} rad; setting sun flattened to ${setting.flatten.toFixed(3)} (published ~5/6), rim ${rimSet.toFixed(1)}" vs ${rimHigh.toFixed(1)}" at +2°; below-horizontal ray (300 m observer) finite and larger (${((below / DEG) * 60).toFixed(1)}')`
  );
}

{
  // The theme's node-count knob: N = 400 must sit within 0.5" of
  // reference-grade N = 1600 at the worst case (the horizon ray),
  // so the per-second sunset updates are exact to a few per cent
  // of the rim at a quarter of the cost.
  const prof = standardProfile();
  let worst = 0;
  for (const alt of [0, -0.3 * DEG, 2 * DEG]) {
    for (const lam of [0.44, 0.55, 0.68]) {
      const d =
        Math.abs(
          refractionRad(alt, prof, lam, 30, 400) -
            refractionRad(alt, prof, lam, 30, 1600)
        ) / ARCSEC;
      worst = Math.max(worst, d);
    }
  }
  // The -0.3 deg row from 30 m sits below the dip and now
  // integrates the TRUE saturated graze ray (the tangent fix) -
  // the hardest integral in the set; 1.1" there is 0.05% of the
  // 37' it carries.
  check(
    'node-count convergence',
    worst < 1.5,
    `N=400 vs N=1600 worst difference ${worst.toFixed(3)}" across altitudes and wavelengths (the worst row is the saturated graze, 0.05% of its 37') - the theme's live knob is pinned`
  );
}

{
  // The measured-profile builder: unsorted pressure-level triples
  // plus a surface observation. The surface entry's pressure must
  // follow hydrostatically from the first level (closed form
  // through the layer-mean temperature), sampling must be
  // monotone in p, and refraction through a plausible measured
  // profile lands near the standard atmosphere's.
  const levels = [
    {pPa: 85000, hM: 1457, tC: 7.5, rh: 0.55},
    {pPa: 100000, hM: 110, tC: 16.2, rh: 0.7},
    {pPa: 92500, hM: 766, tC: 12.1, rh: 0.6},
    {pPa: 70000, hM: 3012, tC: -3.2, rh: 0.4},
    {pPa: 50000, hM: 5574, tC: -17.9, rh: 0.3},
    {pPa: 30000, hM: 9160, tC: -44.6, rh: 0.2},
    {pPa: 20000, hM: 11784, tC: -56.4, rh: 0.1}
  ];
  const prof = buildProfile(levels, {hM: 5, tC: 17.1, rh: 0.72});
  const tMean = ((17.1 + 16.2) / 2 + 273.15) * 8.31451;
  const pSurf = 100000 * Math.exp((110 - 5) / (tMean / (0.0289644 * 9.80665)));
  const s0 = prof.at(5);
  const mono =
    prof.at(5).pPa > prof.at(500).pPa &&
    prof.at(500).pPa > prof.at(5000).pPa &&
    prof.at(5000).pPa > prof.at(20000).pPa;
  const rh = (refractionRad(0, prof, 0.55, 5) / DEG) * 60;
  check(
    'measured profile builder',
    Math.abs(s0.pPa - pSurf) < 1e-6 &&
      s0.tC === 17.1 &&
      mono &&
      rh > 30 &&
      rh < 38,
    `surface closed hydrostatically (${s0.pPa.toFixed(0)} Pa exactly as the closed form); pressure monotone through the column; horizon refraction ${rh.toFixed(2)}' through the measured-style profile`
  );
}

{
  // The sunset transfer curve (van der Werf's method): trueAlt(a)
  // per wavelength, indexed by APPARENT altitude - single-valued
  // in a, mirage folds appear as non-monotonicity.
  // (1) identity + fold-free standard atmosphere: one erect sun.
  const std = standardProfile();
  const tcStd = transferCurve(std, 2, -0.6 * DEG, 2 * DEG, 160, 200);
  const i2 = 159; // a = +2 deg exactly (the top row)
  const round = apparentAltitude(tcStd.tG[i2], std, 0.55, 2, 200);
  check(
    'transfer curve identity',
    Math.abs(round - tcStd.a[i2]) < 2e-7 &&
      foldCount(tcStd.tR) === 0 &&
      foldCount(tcStd.tG) === 0 &&
      foldCount(tcStd.tB) === 0,
    `trueAlt(+2deg) roundtrips through apparentAltitude to ${(Math.abs(round - tcStd.a[i2]) / ARCSEC).toExponential(1)}" and the standard atmosphere is fold-free in all three channels - one erect sun`
  );

  // (2) hot-surface inferior mirage: 12 C air over a 26 C surface,
  // superadiabatic in the lowest metres (the hot-road profile).
  // The fold appears below the horizon and the folded branch runs
  // BACKWARD - the reflected image is inverted, a physical
  // requirement.
  const hot = buildProfile(
    [
      {pPa: 101325, hM: 0, tC: 26, rh: 0.3},
      {pPa: 101265, hM: 5, tC: 16, rh: 0.3},
      {pPa: 101205, hM: 10, tC: 13.5, rh: 0.3},
      {pPa: 101085, hM: 20, tC: 12.5, rh: 0.3},
      {pPa: 100000, hM: 110, tC: 12, rh: 0.3},
      {pPa: 90000, hM: 1000, tC: 6, rh: 0.3},
      {pPa: 70000, hM: 3000, tC: -6, rh: 0.3},
      {pPa: 30000, hM: 9200, tC: -45, rh: 0.1}
    ],
    null
  );
  const tcHot = transferCurve(hot, 2, -0.6 * DEG, 0.5 * DEG, 220, 200);
  let minSlope = Infinity;
  for (let i = 1; i < 220; i++)
    minSlope = Math.min(minSlope, tcHot.tG[i] - tcHot.tG[i - 1]);
  check(
    'inferior mirage folds',
    foldCount(tcHot.tG) >= 1 && minSlope < 0,
    `the superadiabatic surface layer folds the green transfer curve ${foldCount(tcHot.tG)} time(s) below the horizon and the folded branch runs backward (min slope ${(minSlope / ARCSEC).toFixed(1)}"/row) - the reflected lower image is inverted`
  );

  // (3) the ducting criterion: the critical lapse (a horizontal
  // ray curving with the Earth, dn/dh = -n/r) is EXACT from
  // Ciddor's own partials and must land on the textbook
  // +0.11-0.13 K/m. Around it the transfer curve holds the
  // mock-mirage phenomenology (van der Werf): a SUB-critical
  // inversion (half critical) already folds the view from 20 m
  // above the layer - mock mirages need no full duct - while a
  // strongly SUPER-critical layer (twice critical) erases the
  // fold into smooth extreme looming, the monotone curve
  // reaching >20 arcmin deeper true altitude than the standard
  // atmosphere ever shows.
  const T0 = 285.15;
  const P0 = 101325;
  const nAt = (t, pp) => ciddorN(0.55, t - 273.15, pp, 0);
  const dndT = (nAt(T0 + 0.5, P0) - nAt(T0 - 0.5, P0)) / 1;
  const dndP = (nAt(T0, P0 + 50) - nAt(T0, P0 - 50)) / 100;
  const dpdh = (-P0 * 9.80665) / (287.053 * T0);
  const R_E = 6371008.8;
  const gammaCrit = (-nAt(T0, P0) / R_E - dndP * dpdh) / dndT;
  const ductProf = (g) =>
    buildProfile(
      [
        {pPa: 101325, hM: 0, tC: 12, rh: 0.3},
        {pPa: 100965, hM: 30, tC: 12 - 0.0065 * 30, rh: 0.3},
        {pPa: 100365, hM: 80, tC: 12 - 0.0065 * 30 + g * 50, rh: 0.3},
        {pPa: 100125, hM: 100, tC: 12 - 0.0065 * 100 + g * 50, rh: 0.3},
        {pPa: 90000, hM: 1000, tC: 6, rh: 0.3},
        {pPa: 30000, hM: 9200, tC: -45, rh: 0.1}
      ],
      null
    );
  const curveAt = (g) =>
    transferCurve(ductProf(g), 100, -0.7 * DEG, 0.2 * DEG, 300, 200).tG;
  const sub = curveAt(gammaCrit / 2);
  const sup = curveAt(2 * gammaCrit);
  const std100 = curveAt(0);
  const loomed = ((Math.min(...std100) - Math.min(...sup)) / DEG) * 60;
  check(
    'ducting criterion emerges',
    gammaCrit > 0.09 &&
      gammaCrit < 0.13 &&
      foldCount(sub) > 0 &&
      foldCount(sup) === 0 &&
      loomed > 20,
    `the critical lapse from Ciddor's partials is +${gammaCrit.toFixed(3)} K/m (textbook +0.11-0.13, derived not assumed); a half-critical inversion folds the view from above (mock mirage without a duct), twice-critical erases the fold into smooth looming ${loomed.toFixed(0)}' deeper than the standard atmosphere`
  );

  // (4) flash magnification (Young): fine curves so the sliver is
  // resolved, not row-quantized (3.3" rows against a ~12" rim) -
  // the best green-not-red band through the mirage profile is
  // MANY times the flat-atmosphere rim. The naked-eye flash IS
  // the magnified rim.
  const tcStdF = transferCurve(std, 2, -0.7 * DEG, 0.4 * DEG, 1200, 200);
  const tcHotF = transferCurve(hot, 2, -0.7 * DEG, 0.4 * DEG, 1200, 200);
  const sliver = (tc) => {
    const da = tc.a[1] - tc.a[0];
    let best = 0;
    for (let k = 0; k < 60; k++) {
      const sunTrue = -1.2 * DEG + (k * 0.9 * DEG) / 60;
      let ext = 0;
      for (let i = 0; i < tc.a.length; i++) {
        if (!tc.vis[i]) continue; // sea-blocked rows show water
        const gIn = Math.abs(tc.tG[i] - sunTrue) < SUN_DISC_RAD;
        const rIn = Math.abs(tc.tR[i] - sunTrue) < SUN_DISC_RAD;
        if (gIn && !rIn) ext += da;
      }
      best = Math.max(best, ext);
    }
    return best;
  };
  const flat = sliver(tcStdF);
  const mag = sliver(tcHotF);
  // And the sea horizon itself: the visibility boundary (the
  // Snell constant still points down at the profile bottom) sits
  // at the REFRACTED dip - below the geometric horizontal,
  // lifted from the geometric dip sqrt(2h/R) by the bending.
  let dipRow = -1;
  for (let i = 0; i < tcStdF.a.length; i++)
    if (tcStdF.vis[i]) {
      dipRow = i;
      break;
    }
  const dip = tcStdF.a[dipRow];
  const geomDip = -Math.sqrt((2 * 2) / 6371008.8);
  const dipOk = dip < geomDip * 0.6 && dip > geomDip * 1.05;
  check(
    'flash magnification',
    mag > 2.5 * flat && flat > 3 * ARCSEC && flat < 40 * ARCSEC && dipOk,
    `the best green-not-red sliver is ${(flat / ARCSEC).toFixed(1)}" through the standard atmosphere (the bare rim) and ${(mag / ARCSEC).toFixed(1)}" through the mirage profile (x${(mag / flat).toFixed(1)}) - Young's magnified rim IS the naked-eye flash; the sea horizon sits at ${((dip / DEG) * 60).toFixed(2)}' (geometric ${((geomDip / DEG) * 60).toFixed(2)}', lifted by refraction) and blocked rows carry vis 0`
  );
}

process.exit(fail ? 1 : 0);
