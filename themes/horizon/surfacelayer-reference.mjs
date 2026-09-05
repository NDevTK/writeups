// Reference printer for the marine surface layer (node
// surfacelayer-reference.mjs). Four primaries, all READ IN FULL
// (see surfacelayer.js): Businger, Wyngaard, Izumi & Bradley 1971
// (the Kansas flux-profile relations), Paulson 1970 (their
// closed-form integrals), Fairall et al. 2003 (COARE 3.0's sea
// roughness, gustiness and bulk iteration), and the COARE 3.6
// code itself (coare36vn_zrf_et - the profile forms the page runs
// since the 140th pass, gated below on NOAA PSL's measured ship
// hours). The Kansas landmarks (1-6, 8) run the module's 'kansas'
// forms where they test Businger's printed physics; the
// composition and wind landmarks (7, 9) run the page's default.
// The gate holds:
//  - the printed constants and the printed neutral values
//    (kappa 0.35, phi_h(0) 0.74, the eddy-diffusivity ratio 1.35,
//    the near-neutral slope 3.0 of both phi's)
//  - Paulson's psi_1/psi_2 as IDENTITIES: the closed forms equal
//    the numerical integral of Businger's own phi (both
//    branches, several zeta)
//  - Businger's Ri(zeta) Eqs. (26)/(28) and the printed stable
//    limit "about 0.21"
//  - the neutral limit: the profiles collapse to the log law
//  - COARE 3.0's printed roughness ladder (alpha 0.011 -> 0.018
//    across 10-18 m/s; the 1.1e-4 scalar cap) and the neutral
//    10-m drag identity kappa^2 / ln^2(10/z0) in the class of
//    Fig. 5 (COARE 3.0 curve: ~1.2e-3 at 10 m/s)
//  - the bulk round trip: fluxes chosen, profiles sampled at the
//    pier's sensor heights, fluxes recovered from the samples
//  - the stability signs: water warmer than air gives a
//    super-autoconvective film (the inferior class), warm air over
//    cold water a surface inversion (the looming class) - the
//    physics the drawn horizon now rides
//  - the composed column's contract: pier rows below, a tagged
//    modelled band, the balloon above; no zero-thickness step at
//    the join
//  - the CROSS-CLOSURE: the Fleagle instrument reads the pier's
//    film back from the composed column's own fan and closes
//    against the similarity profile inside the measured band -
//    two frames (Fleagle's mean lapse, Businger's profile), one
//    film - and the same contrast on COARE's forms, measured
//  - COARE 3.6's PROFILE FORMS AS THE CODE WRITES THEM (140th
//    pass): the convective limb as the integral of (1 - a zeta)^-1/3
//    (to the code's own rounding of the exponent), the blend
//    weights, the neutral values and slopes of both branches (the
//    scalar form's rounded constants leave a 0.0045 step at
//    neutrality - the code's, measured), the Charnock cap, the
//    scalar-roughness cap, the gustiness floor, the first-pass rule
//    and the latitude gravity
//  - THE ARCHIVE: PSL's measured hours through the module - the
//    archive's own air, humidity, wind and skin temperature in,
//    PSL's u*, t*, Hs, Hl, density and U10N out, hour by hour; and
//    the Kansas pairing measured on the same hours (the reason for
//    the switch, in W/m^2)
import {
  ALPHA_EDDY_NEUTRAL,
  BETA_STABLE,
  BUSINGER_KAPPA,
  CHARNOCK_HI,
  CHARNOCK_LO,
  COARE36,
  KAPPA,
  PR_NEUTRAL,
  charnock36,
  charnockAlpha,
  convectiveBlend,
  gravityOfLat,
  inversionBaseM,
  marineColumnRows,
  moBulk,
  phiH,
  phiM,
  psiConvective,
  psiH,
  psiH26,
  psiM,
  psiM26,
  psiM40,
  richardsonOfZeta,
  roughnessScalar,
  roughnessScalar36,
  roughnessZ0
} from './surfacelayer.js';
import {SHIPFLUX_AT, SHIPFLUX_SKIN} from './shipflux-fixture.js';
import {retrievalPanel, flashPanel} from './observatory.js';
import {ductScan} from './refraction.js';
import {profileFromRows} from './observatory.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- 1. the printed constants and neutral values --------------
{
  // slopes at the origin from the UNSTABLE side (his Businger-Dyer
  // forms; the stable side has its own printed 4.7)
  const slopeM = (phiM(0) - phiM(-1e-4)) / 1e-4;
  const slopeH = (phiH(0) - phiH(-1e-4)) / 1e-4 / PR_NEUTRAL;
  const alpha0 = phiM(0) / phiH(0);
  check(
    'the Kansas constants meet their printings',
    BUSINGER_KAPPA === 0.35 &&
      KAPPA === 0.4 &&
      phiH(0) === 0.74 &&
      Math.abs(alpha0 - ALPHA_EDDY_NEUTRAL) < 0.005 &&
      Math.abs(slopeM - 3.75) < 0.02 &&
      Math.abs(slopeH - 4.5) < 0.05,
    `von Karman's k measured at ${BUSINGER_KAPPA} ("rather than 0.40 as usually assumed"), run here at COARE's ${KAPPA} with the same Kansas forms (Fairall 2003's printed pairing); phi_h(0) = ${phiH(0)}; alpha = phi_m/phi_h = ${alpha0.toFixed(3)} at neutrality (printed 1.35); the Businger-Dyer slopes at the origin - gamma_m/4 = ${slopeM.toFixed(2)} for phi_m (he prints 3.75 against a measured 3.0) and gamma_h/2 = ${slopeH.toFixed(2)} for the normalized phi_h`
  );
}

// ---- 2. Paulson's integrals as identities ---------------------
{
  const integ = (f, a, b, n = 40000) => {
    let s = 0;
    const h = (b - a) / n;
    for (let i = 0; i < n; i++) {
      const x0 = a + i * h;
      s += (f(x0) + 4 * f(x0 + h / 2) + f(x0 + h)) * (h / 6);
    }
    return s;
  };
  let worst = 0;
  const rows = [];
  for (const zeta of [-2.4, -1, -0.3, -0.05, 0.05, 0.5, 1.9]) {
    const a = zeta < 0 ? zeta : 1e-9;
    const b = zeta < 0 ? -1e-9 : zeta;
    const sgn = zeta < 0 ? -1 : 1;
    const n1 = sgn * integ((z) => (1 - phiM(z)) / z, a, b);
    const n2 = sgn * integ((z) => (1 - phiH(z) / PR_NEUTRAL) / z, a, b);
    worst = Math.max(
      worst,
      Math.abs(n1 - psiM(zeta)),
      Math.abs(n2 - psiH(zeta))
    );
    rows.push(`${zeta}: ${psiM(zeta).toFixed(4)}/${psiH(zeta).toFixed(4)}`);
  }
  check(
    "Paulson's closed forms integrate Businger's phi",
    worst < 1e-5,
    `psi_1/psi_2 at zeta ${rows.join(', ')} - closed forms vs numerical integrals of (1 - phi)/zeta agree to ${worst.toExponential(1)} on both branches`
  );
}

// ---- 3. Businger's Ri(zeta) and the stable limit --------------
{
  const eq26 = (z) =>
    (PR_NEUTRAL * z * Math.sqrt(1 - 15 * z)) / Math.sqrt(1 - 9 * z);
  const eq28 = (z) =>
    (z * (PR_NEUTRAL + BETA_STABLE * z)) / Math.pow(1 + BETA_STABLE * z, 2);
  const dU = Math.abs(richardsonOfZeta(-0.7) - eq26(-0.7));
  const dS = Math.abs(richardsonOfZeta(0.8) - eq28(0.8));
  const lim = richardsonOfZeta(1e7);
  const nearNeutral = richardsonOfZeta(1e-3) / 1e-3;
  check(
    'Ri(zeta) reproduces Eqs. (26)/(28) and the 0.21 limit',
    dU < 1e-12 &&
      dS < 1e-12 &&
      Math.abs(lim - 0.21) < 0.005 &&
      Math.abs(nearNeutral - PR_NEUTRAL) < 0.05,
    `zeta phi_h/phi_m^2 equals his printed Eq. (26) unstable and Eq. (28) stable to 1e-12; Ri -> ${lim.toFixed(4)} as zeta -> infinity (he prints "about 0.21"); near neutral Ri ~ ${nearNeutral.toFixed(3)} zeta (his Eq. 27: 0.74 zeta)`
  );
}

// ---- 4. the neutral limit and COARE's roughness ---------------
{
  // neutral means equal POTENTIAL temperatures: the 10-m air must
  // sit g/cp x 10 m below the water's temperature (a first run
  // with equal actual temperatures found the solver honestly
  // reporting weak stability, L ~ 2 km)
  const mo = moBulk({
    uMs: 10,
    zuM: 10,
    taC: 20 - (9.80665 / 1004.7) * 10,
    ztM: 10,
    tsC: 20,
    pPa: 101325,
    forms: 'kansas'
  });
  const logLaw = (mo.uStar / KAPPA) * Math.log(10 / mo.z0);
  const cd10n = Math.pow(KAPPA / Math.log(10 / mo.z0), 2);
  check(
    'neutral air collapses to the log law with COARE roughness',
    Math.abs(mo.L) > 1e5 &&
      Math.abs(logLaw - 10) < 5e-3 &&
      Math.abs(charnockAlpha(9) - CHARNOCK_LO) < 1e-12 &&
      Math.abs(charnockAlpha(18) - CHARNOCK_HI) < 1e-12 &&
      Math.abs(charnockAlpha(14) - (CHARNOCK_LO + CHARNOCK_HI) / 2) < 1e-12 &&
      roughnessScalar(1e-3, 0.3) <= 1.1e-4 &&
      cd10n > 1.1e-3 &&
      cd10n < 1.4e-3,
    `equal potential temperatures: |L| = ${Math.abs(mo.L) > 1e9 ? 'infinity' : Math.abs(mo.L).toExponential(1) + ' m'}, u* = ${mo.uStar.toFixed(4)} m/s returns U(10 m) = ${logLaw.toFixed(4)} m/s through ln(z/z0); z0 = ${mo.z0.toExponential(2)} m from Eq. (6) (alpha 0.011 -> 0.018 across 10-18 m/s as printed); C_D10n = kappa^2/ln^2(10/z0) = ${(cd10n * 1e3).toFixed(2)}e-3 - the class of his Fig. 5 (COARE 3.0 ~1.2e-3 at 10 m/s); the scalar roughness capped at 1.1e-4 m (Eq. 28)`
  );
}

// ---- 5. the bulk round trip ------------------------------------
{
  // choose fluxes, build the profiles, sample at pier heights,
  // recover the fluxes from the samples alone
  const uS = 0.2;
  const tS = -0.25; // Businger theta* (k-carrying), unstable
  const tsC = 18;
  const z0 = roughnessZ0(uS, (uS / KAPPA) * Math.log(10 / 1e-4));
  const z0s = roughnessScalar(z0, uS);
  const tK = 291.15;
  const L = (tK * uS * uS) / (KAPPA * KAPPA * 9.80665 * tS);
  const Uat = (z) => (uS / KAPPA) * (Math.log(z / z0) - psiM(z / L));
  const Tat = (z) =>
    tsC +
    tS * PR_NEUTRAL * (Math.log(z / z0s) - psiH(z / L)) -
    (9.80665 / 1004.7) * z;
  const mo = moBulk({
    uMs: Uat(8),
    zuM: 8,
    taC: Tat(7),
    ztM: 7,
    tsC,
    pPa: 101325,
    forms: 'kansas'
  });
  check(
    'the bulk solution round-trips its own profiles',
    Math.abs(mo.uStar - uS) / uS < 0.02 &&
      Math.abs(mo.thetaStar - tS) / Math.abs(tS) < 0.03 &&
      Math.abs(mo.L / L - 1) < 0.06,
    `u* ${uS} -> ${mo.uStar.toFixed(4)}, theta* ${tS} -> ${mo.thetaStar.toFixed(4)}, L ${L.toFixed(2)} -> ${mo.L.toFixed(2)} m from wind at 8 m and air temperature at 7 m alone (${mo.iterations} iterations; COARE's gustiness ${mo.gust.toFixed(2)} m/s)`
  );
}

// ---- 6. the stability signs -----------------------------------
{
  const warmWater = moBulk({
    uMs: 3,
    zuM: 8,
    taC: 17,
    ztM: 7,
    tsC: 20,
    pPa: 101325
  });
  const coldWater = moBulk({
    uMs: 3,
    zuM: 8,
    taC: 21,
    ztM: 7,
    tsC: 17,
    pPa: 101325
  });
  const lapse = (m) => ((m.tAt(10) - m.tAt(0.5)) / 9.5) * 1000;
  check(
    'water warmer than air sinks, warm air over cold water looms',
    warmWater.L < 0 &&
      lapse(warmWater) < -34.16 &&
      coldWater.L > 0 &&
      lapse(coldWater) > 0,
    `water +3 K: L = ${warmWater.L.toFixed(1)} m, film ${lapse(warmWater).toFixed(0)} K/km over 0.5-10 m - past Fleagle's autoconvective 34 K/km, the inferior class; air +4 K: L = ${coldWater.L.toFixed(1)} m, a surface inversion of ${lapse(coldWater).toFixed(0)} K/km - the looming class`
  );
}

// ---- 7. the composed column's contract ------------------------
const balloon = (h0, tSurf, invBaseAgl = 600) => {
  const rows = [];
  let p = 1013.25 * Math.exp(-h0 / 8400);
  let hPrev = h0;
  const tAt = (h) =>
    h < h0 + invBaseAgl
      ? tSurf - 0.0065 * (h - h0)
      : tSurf - 0.0065 * invBaseAgl + 6 - 0.0065 * (h - h0 - invBaseAgl);
  for (const h of [
    h0,
    h0 + 30,
    h0 + 100,
    h0 + 300,
    h0 + invBaseAgl,
    h0 + invBaseAgl + 100,
    h0 + 1000,
    h0 + 2000,
    h0 + 5000,
    h0 + 9000
  ]) {
    if (h > h0) {
      const tMean = (tAt(hPrev) + tAt(h)) / 2 + 273.15;
      p *= Math.exp((-(h - hPrev) * 9.80665 * 0.0289644) / (8.31451 * tMean));
    }
    rows.push({p, hM: h, tC: +tAt(h).toFixed(3), rh: 60});
    hPrev = h;
  }
  return rows;
};
{
  const rows = balloon(134, 24);
  const comp = marineColumnRows(
    rows,
    {uMs: 3, zuM: 8, taC: 17, ztM: 7, tsC: 20, pPa: 101325},
    {bliM: 600}
  );
  const srcs = comp.rows.map((q) => q.src);
  const firstMixed = srcs.indexOf('mixed');
  const firstBalloon = srcs.indexOf('balloon');
  // steepest gradient across the modelled lid (K per m)
  let steepest = 0;
  for (let i = 1; i < comp.rows.length; i++) {
    const a = comp.rows[i - 1];
    const b = comp.rows[i];
    if (b.hM > 100 && b.hM <= comp.joinM + 1)
      steepest = Math.max(steepest, (b.tC - a.tC) / (b.hM - a.hM));
  }
  const prof = profileFromRows(comp.rows);
  const ducts = ductScan(prof, 0.55, 1500);
  check(
    'the composed column keeps its segments honest',
    inversionBaseM(rows, 164, 2634) === 434 &&
      comp.joinM === 434 &&
      comp.rows[0].hM === 0 &&
      Math.abs(comp.rows[0].tC - 20) < 1e-3 &&
      firstMixed > 0 &&
      firstBalloon > firstMixed &&
      srcs.slice(0, firstMixed).every((x) => x === 'pier') &&
      comp.modelBand[0] === comp.pierTopM &&
      comp.modelBand[1] === 434 &&
      steepest < 0.15 &&
      ducts.length === 0,
    `the ascent's inversion base found at ${inversionBaseM(rows, 164, 2634)} m (the last row before the synthetic's +6 K rise at 734); pier rows 0-${comp.pierTopM} m anchored at the water (${comp.rows[0].tC.toFixed(2)} C), the modelled mixed layer tagged over ${comp.modelBand.join('-')} m, the balloon above; the lid's steepest gradient ${(steepest * 1000).toFixed(0)} K/km - no zero-thickness step, and the duct scan finds ${ducts.length} duct(s) in a column whose only inversion is the balloon's own`
  );
}

// ---- 8. the cross-closure, and the looming class --------------
// A calm pier with water 5 K warmer than the air (film -169 K/km
// in the Kansas similarity profile), composed under the same
// synthetic balloon, through the panel's own cascade from the
// tower eye: the Fleagle instrument must read the film back from
// the drawn horizon and close INSIDE the pier's measured band -
// never leaning on the modelled mixed layer. Two frames, one film.
// And the mirror case - warm air over cold water - must show up as
// a surface DUCT with one of Young's ducted flash classes: the
// looming side of the same contrast. Since the 140th pass the
// same contrast is also run on COARE 3.6's forms (the page's):
// the free-convection limb puts the calm film in the lowest
// metre, the 0.5-10 m band weaker by a factor of three, and the
// tower eye's fan is asked the same question - MEASURED, not
// assumed (the outcome is printed either way).
{
  const rows = balloon(134, 24);
  const met = {uMs: 0.5, zuM: 8, taC: 15, ztM: 7, tsC: 20, pPa: 101325};
  const warm = marineColumnRows(rows, met, {bliM: 600, forms: 'kansas'});
  const ladder = {
    eyesM: [22, 30],
    distsM: [10e3, 15e3, 20e3, 25e3, 30e3, 40e3, 60e3]
  };
  const r = retrievalPanel(warm.rows, {modelBand: warm.modelBand, ...ladder});
  const R = r.retrieved;
  const film = (mo) => ((mo.tAt(10) - mo.tAt(0.5)) / 9.5) * 1000;
  const filmMo = film(warm.mo);
  const warmC = marineColumnRows(rows, met, {bliM: 600});
  const rC = retrievalPanel(warmC.rows, {
    modelBand: warmC.modelBand,
    ...ladder
  });
  const filmC = film(warmC.mo);
  const cold = marineColumnRows(
    rows,
    {uMs: 3, zuM: 8, taC: 21, ztM: 7, tsC: 17, pPa: 101325},
    {bliM: 600}
  );
  const ducts = ductScan(profileFromRows(cold.rows), 0.55, 1500);
  const fl = flashPanel(cold.rows, {eyeM: 30, rateDegPerS: 0.0033, fast: true});
  const ok =
    R !== null &&
    r.mode === 'inferior' &&
    R.method === 'fit' &&
    R.closes &&
    r.eyeM === 22 &&
    r.distM === 30000 &&
    R.spanM[1] < warm.pierTopM &&
    R.rmsK < 0.5 &&
    R.params.gammaFilmKpM < -0.08 &&
    R.params.gammaFilmKpM > -0.25 &&
    Math.abs(R.dTretr - R.dTballoon) < 0.6 &&
    warmC.mo.forms === 'coare36' &&
    filmC < -34.16 &&
    filmC > filmMo &&
    warmC.mo.tAt(0) - warmC.mo.tAt(1) > warm.mo.tAt(0) - warm.mo.tAt(1) &&
    ducts.length >= 1 &&
    ['in-duct', 'ducted-mock-mirage', 'sub-duct'].includes(fl.type);
  check(
    'Fleagle reads Businger: the cross-closure, and the looming class',
    ok,
    R
      ? `water +5 K, calm, Kansas forms: the similarity film is ${filmMo.toFixed(0)} K/km over 0.5-10 m; the tower eye's fold at ${(r.distM / 1000).toFixed(0)} km is read by the film family as ${(R.params.gammaFilmKpM * 1000).toFixed(0)} K/km over ${R.params.wM.toFixed(0)} m (drop ${(-R.dTretr).toFixed(2)} K vs the profile's ${(-R.dTballoon).toFixed(2)} K), closing at ${R.rmsK.toFixed(3)} K RMS over ${R.spanM[0].toFixed(0)}-${R.spanM[1].toFixed(0)} m - inside the pier's ${warm.pierTopM}-m band, no lean on the modelled layer; the SAME contrast on COARE 3.6's forms: ${filmC.toFixed(0)} K/km over 0.5-10 m (the free-convection limb holds ${(warmC.mo.tAt(0) - warmC.mo.tAt(1)).toFixed(2)} K in the lowest metre against Kansas's ${(warm.mo.tAt(0) - warm.mo.tAt(1)).toFixed(2)}), and the same fan from 22/30 m over 10-60 km ${rC.retrieved ? `folds at ${(rC.distM / 1000).toFixed(0)} km (${rC.mode}, ${rC.retrieved.closes ? 'closes' : 'does not close'})` : 'finds no fold - the archive-gated forms keep the calm film below what the 100-m fan resolves'}; air +4 K over cold water: ${ducts.length} surface duct(s), flash class "${fl.type}" - the looming side of the same measured contrast`
      : `declined: ${r.note}`
  );
}

// 9. THE 10-m NEUTRAL WIND (138th pass): COARE's U10N = (u*/kappa)
// ln(10/z0), the footing the whitecap and slope laws were fitted
// on, recovered from the pier's sensor-height wind through the
// profile: u* = sqrt(Cd10n) U10N exactly, and the ACTUAL 10-m wind
// sits under U10N in unstable air (psi_m > 0) and over it in
// stable air - the profile's own bracket.
{
  const cases = [
    {name: 'unstable (water +3 K, 3 m/s at 17.5 m)', uMs: 3, taC: 17, tsC: 20},
    {name: 'stable (air +4 K, 3 m/s at 17.5 m)', uMs: 3, taC: 21, tsC: 17},
    {
      // neutral in the dry sense: equal potential temperatures and
      // no humidity gradient (a dewpoint would add its own buoyancy)
      name: 'neutral (equal potential temperatures, dry, 6 m/s)',
      uMs: 6,
      taC: 20 - (9.80665 / 1004.67) * 16.5,
      tsC: 20,
      dry: true
    }
  ];
  const outs = cases.map((c) => {
    const mo = moBulk({
      uMs: c.uMs,
      zuM: 17.5,
      taC: c.taC,
      ztM: 16.5,
      tsC: c.tsC,
      pPa: 101325,
      dewC: c.dry ? null : 15,
      bliM: 600
    });
    // COARE's gust factor takes the convective gustiness back out
    // of the neutral wind (u10N = usr / von / gf x ln(10/zo))
    const gf = Math.sqrt(c.uMs * c.uMs + mo.gust * mo.gust) / c.uMs;
    const u10n = ((mo.uStar / KAPPA) * Math.log(10 / mo.z0)) / gf;
    const cd10n = (KAPPA / Math.log(10 / mo.z0)) ** 2;
    return {
      ...c,
      mo,
      gf,
      u10n,
      u10: mo.uAt(10),
      cd10n,
      uStarBack: Math.sqrt(cd10n) * u10n * gf
    };
  });
  const [un, st, ne] = outs;
  const ok =
    outs.every((o) => Math.abs(o.uStarBack - o.mo.uStar) < 1e-9) &&
    un.mo.L < 0 &&
    un.u10 < un.u10n &&
    st.mo.L > 0 &&
    st.u10 > st.u10n &&
    Math.abs(ne.u10 - ne.u10n) < 0.03 * ne.u10n &&
    // U10N is the neutral wind that would carry this stress: it
    // can EXCEED the sensor-height wind in unstable, gusty air
    // (momentum crosses a convective layer more easily) and sit
    // far under it in stable air (the stress is small) - a band,
    // not an ordering
    outs.every((o) => o.u10n > 0.3 * o.uMs && o.u10n < 1.4 * o.uMs);
  check(
    'THE 10-m NEUTRAL WIND from the pier',
    ok,
    outs
      .map(
        (o) =>
          `${o.name}: U10N ${o.u10n.toFixed(3)} m/s (u* ${o.mo.uStar.toFixed(4)} = sqrt(Cd10n ${o.cd10n.toExponential(3)}) x U10N to 1e-9), actual 10-m wind ${o.u10.toFixed(3)}`
      )
      .join('; ') +
      ' - the actual wind sits under the neutral wind when the water heats the air and over it when the air is the warmer, meeting it at neutrality'
  );
}

// 10. COARE 3.6's PROFILE FORMS AS THE CODE WRITES THEM (140th
// pass): psiu_26 / psit_26 / psiu_40 and the loop's rules, held as
// identities and printed measurements of the code's own text.
{
  const integ = (f, a, b, n = 40000) => {
    let s = 0;
    const h = (b - a) / n;
    for (let i = 0; i < n; i++) {
      const x0 = a + i * h;
      s += (f(x0) + 4 * f(x0 + h / 2) + f(x0 + h)) * (h / 6);
    }
    return s;
  };
  // (a) the convective limb is the integral of phi = (1 - a zeta)^-1/3
  // (Fairall 2003 Eq. 13's stated origin), to the code's rounding
  // of the exponent (0.3333)
  let worstC = 0;
  for (const a of [10.15, 34.15, 10])
    for (const zeta of [-0.3, -2, -10]) {
      const num = -integ(
        (z) => (1 - Math.pow(1 - a * z, -1 / 3)) / z,
        zeta,
        -1e-9
      );
      worstC = Math.max(worstC, Math.abs(num - psiConvective(zeta, a)));
    }
  // (b) the blend weights and the Kansas limb near neutral
  const f = [-0.1, -1, -10].map(convectiveBlend);
  const kansasNear = Math.abs(psiM26(-0.01) - psiM(-0.01));
  // (c) the neutral values: the velocity forms vanish exactly; the
  // scalar form's rounded constants (0.6667 x 14.28 against 8.525
  // + 1) leave it 0.0045 short - a step the code carries
  const stepH = psiH26(0);
  // (d) the slopes at neutrality, both sides of both forms
  const slope = (fn, side) => (fn(side * 1e-7) - fn(0)) / (side * 1e-7);
  const sM = [slope(psiM26, -1), slope(psiM26, 1)];
  // (the unstable branch reaches 0 at neutrality, the stable branch
  // its rounded step: each side's slope against its own limit)
  const sH = [psiH26(-1e-7) / -1e-7, slope(psiH26, 1)];
  // (e) the stable forms' far limit: linear in zeta once the
  // exponential term has died (a zeta + b c / d)
  const farM = psiM26(100) + (0.7 * 100 + (0.75 * 5) / 0.35);
  // (f) the loop's rules
  const cap =
    charnock36(19) === charnock36(25) && charnock36(19) === charnock36(19.5);
  const zoqCap = roughnessScalar36(1e-3) === COARE36.zoqCapM;
  const stable = moBulk({
    uMs: 3,
    zuM: 17.5,
    taC: 21,
    ztM: 16.5,
    tsC: 17,
    pPa: 101325
  });
  const veryStable = moBulk({
    uMs: 0.3,
    zuM: 17.5,
    taC: 30,
    ztM: 16.5,
    tsC: 15,
    pPa: 101325
  });
  const calmWarm = moBulk({
    uMs: 0.5,
    zuM: 17.5,
    taC: 17,
    ztM: 16.5,
    tsC: 20,
    pPa: 101325,
    latDeg: 32.87
  });
  const g0 = gravityOfLat(0);
  const g90 = gravityOfLat(90);
  const ok =
    worstC < 2e-3 &&
    Math.abs(f[0] - 0.0099) < 1e-4 &&
    f[1] === 0.5 &&
    Math.abs(f[2] - 0.9901) < 1e-4 &&
    kansasNear < 1e-4 &&
    psiM26(0) === 0 &&
    psiM40(0) === 0 &&
    Math.abs(stepH + 0.0045) < 2e-4 &&
    Math.abs(sM[0] + 3.75) < 1e-3 &&
    Math.abs(sM[1] + 5.2) < 1e-3 &&
    Math.abs(sH[0] + 7.5) < 1e-3 &&
    Math.abs(sH[1] + (1.5 * 0.6667 + 0.6667 + 0.6667 * 14.28 * 0.35)) < 1e-4 &&
    Math.abs(farM) < 1e-9 &&
    cap &&
    Math.abs(charnock36(10) - 0.012) < 1e-12 &&
    zoqCap &&
    stable.gust === COARE36.gustFloorMs &&
    !stable.k50 &&
    veryStable.k50 &&
    Number.isFinite(veryStable.uStar) &&
    veryStable.uStar > 0 &&
    calmWarm.gust > COARE36.gustFloorMs &&
    calmWarm.z0 > 0 &&
    calmWarm.forms === 'coare36' &&
    calmWarm.iterations === COARE36.nits &&
    g0 === 9.7803267715 &&
    Math.abs(g90 - 9.8322) < 1e-3;
  check(
    "COARE 3.6's profile forms as the code writes them",
    ok,
    `the convective limb integrates (1 - a zeta)^-1/3 to ${worstC.toExponential(1)} for a = 10.15, 34.15, 10 (the residual is the code's 0.3333 for 1/3); blend weights zeta^2/(1+zeta^2) = ${f.map((x) => x.toFixed(4)).join(', ')} at zeta -0.1, -1, -10 (psiu_26 is Paulson's psi_1 to ${kansasNear.toExponential(1)} at -0.01); at neutrality psiu_26 = ${psiM26(0)}, psiu_40 = ${psiM40(0)}, psit_26 = ${stepH.toFixed(4)} (the rounded 14.28 / 8.525 leave a step the code carries); slopes at neutrality: velocity ${sM[0].toFixed(2)} unstable (Kansas gamma/4) vs ${sM[1].toFixed(2)} stable (a + b + b c = 0.7 + 0.75 + 3.75), scalar ${sH[0].toFixed(2)} vs ${sH[1].toFixed(2)} (1.5 x 2/3 + 2/3 + 2/3 x 14.28 x 0.35) - both forms change slope across neutral; the stable forms go linear (a zeta + b c/d) once e^-d zeta dies (${farM.toExponential(1)} at zeta 100); Charnock alpha ${charnock36(10).toFixed(4)} at U10N 10 m/s, capped at 19 m/s; z0q capped at ${COARE36.zoqCapM} m; stable air takes the ${COARE36.gustFloorMs}-m/s gustiness floor; air +15 K over calm water trips the first-pass rule (zeta_u > 50: u* ${veryStable.uStar.toFixed(4)} m/s from pass 1, L ${veryStable.L.toFixed(1)} m); calm warm water gusts ${calmWarm.gust.toFixed(2)} m/s over ${COARE36.ziDefaultM} m; g(0) = ${g0}, g(90) = ${g90.toFixed(4)} (grv)`
  );
}

// 11. THE ARCHIVE (140th pass): NOAA PSL's measured hours through
// the module - the frozen skin rows (shipflux-fixture.js) that
// carry the bulk inputs: air temperature, humidity and wind at
// their measured heights, the skin temperature PSL fed the
// algorithm, the pressure, latitude and salinity in; PSL's own u*,
// t*, Hs, Hl, air density and U10N out. Then the Kansas pairing on
// the same hours: the 135th's forms, measured in W/m^2.
{
  const rows = SHIPFLUX_SKIN.filter((r) =>
    [
      r.taC,
      r.qGkg,
      r.ztM,
      r.zqM,
      r.uMs,
      r.zuM,
      r.tskinC,
      r.pHpa,
      r.uStar,
      r.hsDown,
      r.hlDown,
      r.rhoA
    ].every(Number.isFinite)
  );
  const dewOfQ = (q, pHpa) => {
    const e = (q * pHpa * 100) / (0.622 + 0.378 * q);
    const ln = Math.log(e / 610.94);
    return (243.04 * ln) / (17.625 - ln);
  };
  const run = (forms) => {
    const acc = {
      u: [0, 0],
      ts: [0, 0],
      hs: [0, 0],
      hl: [0, 0],
      rho: [0, 0],
      u10n: [0, 0]
    };
    let n = 0;
    let nU10 = 0;
    let far = 0;
    let uMax = 0;
    let hlMax = 0;
    for (const r of rows) {
      const mo = moBulk({
        uMs: r.uMs,
        zuM: r.zuM,
        taC: r.taC,
        ztM: r.ztM,
        zqM: r.zqM,
        qAKgKg: r.qGkg / 1000,
        dewC: forms === 'kansas' ? dewOfQ(r.qGkg / 1000, r.pHpa) : null,
        tsC: r.tskinC,
        pPa: r.pHpa * 100,
        latDeg: r.latDeg,
        ssPsu: r.ssPsu ?? 35,
        bliM: 600,
        forms
      });
      const d = {
        u: mo.uStar - r.uStar,
        ts: Number.isFinite(r.tStar) ? mo.thetaStar * KAPPA - r.tStar : 0,
        hs: mo.hsbWm2 - -r.hsDown,
        hl: mo.hlbWm2 - -r.hlDown,
        rho: mo.rhoA - r.rhoA,
        u10n: Number.isFinite(r.u10nMs) ? mo.u10nMs - r.u10nMs : null
      };
      for (const k of ['u', 'ts', 'hs', 'hl', 'rho']) {
        acc[k][0] += d[k];
        acc[k][1] += d[k] * d[k];
      }
      if (d.u10n !== null) {
        acc.u10n[0] += d.u10n;
        acc.u10n[1] += d.u10n * d.u10n;
        nU10++;
      }
      n++;
      uMax = Math.max(uMax, Math.abs(d.u));
      hlMax = Math.max(hlMax, Math.abs(d.hl));
      if (Math.abs(d.hl) > 5 || Math.abs(d.u) > 0.01) far++;
    }
    const st = (k, m = n) => ({
      bias: acc[k][0] / m,
      rmse: Math.sqrt(acc[k][1] / m)
    });
    return {
      n,
      far,
      uMax,
      hlMax,
      u: st('u'),
      ts: st('ts'),
      hs: st('hs'),
      hl: st('hl'),
      rho: st('rho'),
      u10n: st('u10n', nU10),
      nU10
    };
  };
  const c = run('coare36');
  const k = run('kansas');
  const ok =
    c.n >= 200 &&
    c.u.rmse < 1e-3 &&
    Math.abs(c.u.bias) < 5e-4 &&
    c.ts.rmse < 1e-3 &&
    c.hs.rmse < 0.1 &&
    Math.abs(c.hs.bias) < 0.05 &&
    c.hl.rmse < 2.5 &&
    Math.abs(c.hl.bias) < 1.5 &&
    c.rho.rmse < 1e-3 &&
    c.u10n.rmse < 0.05 &&
    c.far <= Math.ceil(0.01 * c.n) &&
    k.hl.bias > 10 &&
    k.hl.rmse > c.hl.rmse * 5;
  const fmt = (s, d) => `bias ${s.bias.toFixed(d)}, RMSE ${s.rmse.toFixed(d)}`;
  check(
    "THE ARCHIVE: PSL's measured hours through the module",
    ok,
    `${c.n} frozen night hours (${SHIPFLUX_AT}) with the bulk inputs: on COARE 3.6's forms the module returns PSL's u* to ${fmt(c.u, 5)} m/s (worst ${c.uMax.toFixed(4)}), t* to ${fmt(c.ts, 5)} K, sensible flux ${fmt(c.hs, 3)} W/m^2, latent flux ${fmt(c.hl, 2)} W/m^2 (worst ${c.hlMax.toFixed(1)}; the archive's humidity is printed to 0.1 g/kg), air density ${fmt(c.rho, 5)} kg/m^3, U10N ${fmt(c.u10n, 3)} m/s on ${c.nU10} hours - ${c.far} hour(s) off by more than 5 W/m^2 latent or 0.01 m/s in u*; the Kansas pairing (0.74 Prandtl, COARE 3.0 roughness) on the same hours: u* ${fmt(k.u, 4)}, sensible ${fmt(k.hs, 2)}, latent ${fmt(k.hl, 1)} W/m^2 - the measured reason the page switched forms`
  );
}

process.exit(fail ? 1 : 0);
