// Reference printer for the Fleagle 1950 inferior-mirage
// instrument (node fleagle-reference.mjs). Two primaries, both
// READ IN FULL: Fleagle, "The Optical Measurement of Lapse Rate"
// (Bull. AMS 31(2), 51-55, 1950) and Baum, "Note on the Theory of
// Super-Autoconvective Lapse Rates Near the Ground" (J. Meteor.
// 8, 196-198, 1951). The gate holds:
//  - his constants against their own printings and the repo's
//    independent machinery (the autoconvective g/R against
//    Lehn's g*beta and the NZ gate's hydrostatic exponent -
//    three printings of one number; his two-constant moist
//    refractivity against Ciddor)
//  - his internal identities: the 0.114 humidity coefficient IS
//    1 - A2 eps/A1; the printed "1 C/cm = 32 mb/cm" equivalence
//    is Eq. (8)'s coefficient ratio
//  - his printed ladders: the Eq. (12) curvature corrections
//    (0.78 mm at 100 m ... 785 m at 100 km) and the Eq. (13/14)
//    quarter-layer sampling depth
//  - Eq. (11) against TWO independent integrators (far-terrain's
//    Ciddor fan; the Lehn forward march) at Johnson & Roberts'
//    own 362/724-m baselines, with the appears-lower sign flip
//    exactly at the autoconvective rate
//  - Baum's Eq. (5) evaluations from his own printed inputs
//  - the film-fit round trip: a family member forwarded to a
//    tower-eye TC and recovered from the image alone.
import {
  AUTOCONVECTIVE_K_PER_M,
  baumExcessKpM,
  fleagleEq11H,
  fleagleEq12Delta,
  fleagleEq13Y,
  fleagleFitFilm,
  fleagleHumidityCoeff,
  fleagleN1
} from './fleagle.js';
import {lehnForwardTC, tcCriticalPoints, LEHN_G, LEHN_BETA} from './lehn.js';
import {ciddorN} from './refraction.js';
import {profileFromRows} from './observatory.js';
import {rayFan} from './far-terrain.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const MIN = Math.PI / 180 / 60;

// ---- 1. constants meet the printings --------------------------
{
  const auto = AUTOCONVECTIVE_K_PER_M * 1000;
  const lehnGB = LEHN_G * LEHN_BETA * 1000;
  const nzExp = 34.18;
  const n1F = fleagleN1({tK: 288.15, pPa: 101325});
  const n1C = ciddorN(0.55, 15, 101325, 0) - 1;
  check(
    'constants meet three printings and Ciddor',
    Math.abs(auto - 34) < 0.5 &&
      Math.abs(auto - lehnGB) < 0.1 &&
      Math.abs(auto - nzExp) < 0.1 &&
      Math.abs(n1F / n1C - 1) < 0.01,
    `g/R = ${auto.toFixed(2)} K/km vs his printed 34, Lehn's g*beta ${lehnGB.toFixed(2)}, the NZ gate's ${nzExp} - three independent printings of the autoconvective rate; his two-constant n-1 = ${(n1F * 1e6).toFixed(1)}e-6 sits ${((n1F / n1C - 1) * 100).toFixed(2)}% from Ciddor's ${(n1C * 1e6).toFixed(1)}e-6 at 15 C`
  );
}

// ---- 2. internal identities -----------------------------------
{
  const hc = fleagleHumidityCoeff();
  const equiv = 101325 / 100 / (hc * 273);
  check(
    'his 0.114 and his 32 mb/cm are not new numbers',
    Math.abs(hc - 0.114) < 0.001 && Math.abs(equiv - 32) < 1,
    `1 - A2 eps/A1 = ${hc.toFixed(4)} (he prints 0.114, his Eq. 7); the Eq. (8) coefficient ratio p/(0.114 T) at his standard conditions = ${equiv.toFixed(1)} mb/cm per 1 C/cm (he prints 32)`
  );
}

// ---- 3. the printed curvature ladder --------------------------
{
  const printed = [
    [100, 0.78e-3],
    [1000, 7.8e-2],
    [10000, 7.8],
    [100000, 785]
  ];
  const worst = Math.max(
    ...printed.map(([x, d]) => Math.abs(fleagleEq12Delta(x) / d - 1))
  );
  check(
    'Eq. (12) reproduces his printed corrections',
    worst < 0.015,
    `delta at 100 m / 1 km / 10 km / 100 km = ${printed.map(([x]) => fleagleEq12Delta(x).toPrecision(3)).join(' / ')} m vs his printed 0.78 mm / 7.8 cm / 7.8 m / 785 m (worst ${(worst * 100).toFixed(2)}%)`
  );
}

// ---- 4. the quarter-layer sampling depth ----------------------
{
  const r = fleagleEq13Y(0.01, 500) / 0.01;
  check(
    'Eq. (13) collapses to his y = h/4',
    Math.abs(r - 0.25) < 1e-3 &&
      Math.abs(fleagleEq13Y(300, 300) / 300 - 1 / (2 * (1 + Math.SQRT2))) <
        1e-9,
    `h << x limit: y/h = ${r.toFixed(4)} (his Eq. 14 prints 1/4); the exact form holds off-limit too`
  );
}

// ---- 5. Baum's evaluations from his own inputs ----------------
{
  const b10 =
    baumExcessKpM({KM2S: 1, etaKgMS: 1, tK: 300, rhoKgM3: 1.2, dzM: 10}) * 100;
  const b2 =
    baumExcessKpM({KM2S: 0.1, etaKgMS: 0.2, tK: 300, rhoKgM3: 1.2, dzM: 2}) *
    100;
  check(
    "Baum's Eq. (5) reproduces his printed limits",
    Math.abs(b10 - 170) < 15 && Math.abs(b2 - 2100) < 150,
    `27 pi^4 K eta T / (4 rho g dz^4) with his printed K/eta: lowest 10 m -> ${b10.toFixed(0)} C/100 m (he prints ~170); lowest 2 m -> ${b2.toFixed(0)} C/100 m (he prints ~2100) - the stability excess falls as the fourth power of depth, so the thin films the watch meets are printed-normal`
  );
}

// ---- 6. Eq. (11) meets two independent integrators ------------
// Johnson & Roberts' own geometry (his Application section):
// baselines 362 and 724 m at a 175-cm eye, uniform dry lapses.
{
  const EYE = 1.75;
  const mkRows = (gamma) => {
    const rows = [];
    let p = 1013.25;
    let hPrev = 0;
    const tAt = (h) => 15 + gamma * h;
    for (const h of [0, 2, 5, 10, 20, 50, 100, 300, 1000, 3000, 9000]) {
      if (h > 0) {
        const tMean = (tAt(hPrev) + tAt(h)) / 2 + 273.15;
        p *= Math.exp((-(h - hPrev) * 9.80665 * 0.0289644) / (8.31451 * tMean));
      }
      rows.push({p, hM: h, tC: tAt(h), rh: 0});
      hPrev = h;
    }
    return rows;
  };
  let worstLehn = 0;
  let worstFan = 0;
  for (const gamma of [-0.1, -0.01, 0.02]) {
    const rows = mkRows(gamma);
    const profile = profileFromRows(rows);
    const tK = 273.15 + 15 + gamma * EYE;
    const n1 = ciddorN(0.55, tK - 273.15, 101325, 0) - 1;
    const fan = rayFan(profile, EYE, [0], 1600, 2);
    const truth = {hM: rows.map((q) => q.hM), tC: rows.map((q) => q.tC)};
    for (const x of [362, 724]) {
      const delta = fleagleEq12Delta(x);
      const hC = fleagleEq11H(x, {tK, pPa: 101325, n1, dTdzKpM: gamma});
      const zF = fan.hs[0][Math.round(x / fan.dsM) - 1];
      const hFan = EYE + delta - zF;
      const fwd = lehnForwardTC(truth, {eyeM: EYE, distM: x, alphas: [0]});
      const hLehn = EYE + delta - fwd.zAt[0];
      worstLehn = Math.max(worstLehn, Math.abs(hLehn - hC));
      worstFan = Math.max(worstFan, Math.abs(hFan - hC));
    }
  }
  // the sign flip: his "34 C per km" threshold, exact in the
  // closed form
  const hBelow = fleagleEq11H(724, {
    tK: 288.15,
    pPa: 101325,
    n1: 2.78e-4,
    dTdzKpM: -(AUTOCONVECTIVE_K_PER_M - 0.001)
  });
  const hAbove = fleagleEq11H(724, {
    tK: 288.15,
    pPa: 101325,
    n1: 2.78e-4,
    dTdzKpM: -(AUTOCONVECTIVE_K_PER_M + 0.001)
  });
  check(
    'Eq. (11) meets the fan and the march at his baselines',
    worstLehn < 2e-4 && worstFan < 4e-4 && hBelow > 0 && hAbove < 0,
    `apparent-minus-true across 362/724 m and three lapses: closed form vs the Lehn march within ${(worstLehn * 1000).toFixed(2)} mm, vs the Ciddor fan within ${(worstFan * 1000).toFixed(2)} mm (his Figs. 2-4 read h at these scales); the object appears LOWER only past the autoconvective rate - h flips ${(hBelow * 1000).toFixed(2)} -> ${(hAbove * 1000).toFixed(2)} mm across g/R exactly as he states`
  );
}

// ---- 7. the film-fit round trip -------------------------------
// A family member (film -0.24 K/m over 10 m, background -6.5
// K/km, anchored 18 C at the 22-m tower eye) forwarded to a
// 30-km TC and recovered from the image alone - the corpus's
// Morrish-strategy pattern on Fleagle's geometry.
{
  const gF = -0.24;
  const hF = 10;
  const g = -0.0065;
  const EYE = 22;
  const raw = (z) => (z <= hF ? gF * z : gF * hF + g * (z - hF));
  const off = 18 - raw(EYE);
  const tT = (z) => raw(z) + off;
  const truth = {hM: [0, hF, 3000], tC: [0, hF, 3000].map(tT)};
  const alphas = [];
  for (let a = -80; a <= 10; a += 0.25) alphas.push(a * MIN);
  const obs = lehnForwardTC(truth, {eyeM: EYE, distM: 30e3, alphas});
  const {iP, iM} = tcCriticalPoints(obs, 6);
  let hi = -Infinity;
  for (let i = 0; i < alphas.length; i++)
    if (Number.isFinite(obs.zAt[i])) hi = Math.max(hi, obs.zAt[i]);
  const fit = fleagleFitFilm(obs, {
    eyeM: EYE,
    distM: 30e3,
    TzeC: 18,
    spanHiM: hi
  });
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
    for (let z = 0; z <= Math.max(hi, fit.params.filmM); z += 1) {
      const d = tFit(z) - tT(z);
      s2 += d * d;
      n++;
    }
    rms = Math.sqrt(s2 / n);
  }
  check(
    'the film fit round-trips its family',
    iP >= 0 &&
      iM > iP + 2 &&
      fit !== null &&
      Math.abs(fit.params.gammaFilmKpM - gF) < 0.02 &&
      Math.abs(fit.params.filmM - hF) < 1 &&
      Math.abs(fit.params.gammaKpM - g) < 0.002 &&
      fit.tcRmsM < 1 &&
      rms < 0.05,
    fit
      ? `the tower-eye fold at 30 km (pivot ${(obs.alphas[iP] / MIN).toFixed(1)}' z ${obs.zAt[iP].toFixed(1)} m - the film fold classifies superior-band and every warm family refuses it); the film family recovers ${(fit.params.gammaFilmKpM * 1000).toFixed(0)} K/km over ${fit.params.filmM.toFixed(1)} m (truth ${gF * 1000}/${hF}) on background ${(fit.params.gammaKpM * 1000).toFixed(2)} K/km (truth ${g * 1000}); TC to ${fit.tcRmsM.toFixed(2)} m, profile to ${rms.toFixed(4)} K RMS - Fleagle's layer read from its own mirage`
      : 'fit returned null'
  );
}

process.exit(fail ? 1 : 0);
