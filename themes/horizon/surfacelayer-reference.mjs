// Reference printer for the marine surface layer (node
// surfacelayer-reference.mjs). Three primaries, all READ IN FULL
// (see surfacelayer.js): Businger, Wyngaard, Izumi & Bradley 1971
// (the Kansas flux-profile relations), Paulson 1970 (their
// closed-form integrals), Fairall et al. 2003 (COARE 3.0's sea
// roughness, gustiness and bulk iteration). The gate holds:
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
//    film.
import {
  ALPHA_EDDY_NEUTRAL,
  BETA_STABLE,
  BUSINGER_KAPPA,
  CHARNOCK_HI,
  CHARNOCK_LO,
  KAPPA,
  PR_NEUTRAL,
  charnockAlpha,
  inversionBaseM,
  marineColumnRows,
  moBulk,
  phiH,
  phiM,
  psiH,
  psiM,
  richardsonOfZeta,
  roughnessScalar,
  roughnessZ0
} from './surfacelayer.js';
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
    pPa: 101325
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
    pPa: 101325
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
// in the similarity profile), composed under the same synthetic
// balloon, through the panel's own cascade from the tower eye:
// the Fleagle instrument must read the film back from the drawn
// horizon and close INSIDE the pier's measured band - never
// leaning on the modelled mixed layer. Two frames, one film. And
// the mirror case - warm air over cold water - must show up as a
// surface DUCT with one of Young's ducted flash classes: the
// looming side of the same contrast.
{
  const rows = balloon(134, 24);
  const warm = marineColumnRows(
    rows,
    {uMs: 0.5, zuM: 8, taC: 15, ztM: 7, tsC: 20, pPa: 101325},
    {bliM: 600}
  );
  const r = retrievalPanel(warm.rows, {
    modelBand: warm.modelBand,
    eyesM: [22, 30],
    distsM: [10e3, 15e3, 20e3, 25e3, 30e3, 40e3, 60e3]
  });
  const R = r.retrieved;
  const filmMo = ((warm.mo.tAt(10) - warm.mo.tAt(0.5)) / 9.5) * 1000;
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
    ducts.length >= 1 &&
    ['in-duct', 'ducted-mock-mirage', 'sub-duct'].includes(fl.type);
  check(
    'Fleagle reads Businger: the cross-closure, and the looming class',
    ok,
    R
      ? `water +5 K, calm: the similarity film is ${filmMo.toFixed(0)} K/km over 0.5-10 m; the tower eye's fold at ${(r.distM / 1000).toFixed(0)} km is read by the film family as ${(R.params.gammaFilmKpM * 1000).toFixed(0)} K/km over ${R.params.wM.toFixed(0)} m (drop ${(-R.dTretr).toFixed(2)} K vs the profile's ${(-R.dTballoon).toFixed(2)} K), closing at ${R.rmsK.toFixed(3)} K RMS over ${R.spanM[0].toFixed(0)}-${R.spanM[1].toFixed(0)} m - inside the pier's ${warm.pierTopM}-m band, no lean on the modelled layer; air +4 K over cold water: ${ducts.length} surface duct(s), flash class "${fl.type}" - the looming side of the same measured contrast`
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

process.exit(fail ? 1 : 0);
