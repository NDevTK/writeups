// observatory-reference.mjs - the gate for the living snapshot
// (observatory.js on observatory-fixture.js). The instrument
// composes ONLY gated machinery; what is pinned here is the
// composition itself, on one real frozen day - 2026-08-09, San
// Diego. Landmarks:
//  - THE ENGINE'S SUN: the vendored astronomy engine at the
//    fixture stamp reproduces the frozen sun altitude
//  - TODAY'S COLUMN MIRAGES ALOFT: the 12Z Miramar ascent holds
//    a +8.7 C elevated marine inversion; the transfer fan folds
//    ONCE for an observer at 450 m (an inverted second image
//    exists today) and not at all from the beach at 15 m
//  - THE LIFTED, SQUASHED SUN: horizon refraction through
//    today's column beats the ISA by ~5 arcmin at eye 15 m, the
//    disc flattens to ~0.70, and the green-rim split is tens of
//    arcsec across the 93%-humid marine surface layer
//  - THE FOAM: the Monahan law at the measured 6.0 m/s buoy wind
//    gives 0.17% coverage, and the curve keeps the printed 3.41
//    power exactly
//  - THE WET WORLD TODAY: Mumbai's live drizzle engages the rain
//    skin yet its monsoon topsoil already reads wetter; Bergen
//    darkens near the saturation floor with no rain falling;
//    Phoenix stays within 4% of dry - one law, six cities
//  - THE DILUTED POLARIZATION: the doubling engine's max DoP
//    sits on the 90-degree Rayleigh lobe; today's measured
//    AOD(550) = 0.15 dilutes it by the same w = tauR/(tauR+tauA)
//    the theme's LUT uses
//  - THE CORONA AT SIX REGIONS: today's SWPC count maps to
//    phase 0.5 and a whole-corona illuminance inside the printed
//    third-to-three-fifths-of-a-full-moon band
import {createRequire} from 'module';
import {
  auroraPanel,
  closurePanel,
  columnPanel,
  contrailPanel,
  coronaPanel,
  leewavePanel,
  meteorsPanel,
  monahanW,
  polPanel,
  seaPanel,
  wetPanel
} from './observatory.js';
import {fr3Regime, froude3, FR3_RES_HI, FR3_RES_LO} from './leewave.js';
import {tidePanel} from './observatory.js';
import {TIDE, TIDE_PUBLISHED} from './observatory-fixture.js';
import {
  ADSB,
  AEROSOL,
  BUOY,
  CITIES,
  GMN,
  HEMI_POWER_TXT,
  KP,
  OVATION,
  PERSEID_NIGHT,
  RADIATION,
  SOLAR_REGIONS,
  SOUNDING,
  SUN,
  SUN_ELON
} from './observatory-fixture.js';
import {visibleRateFactor} from './meteors.js';

const AstroEngine = createRequire(import.meta.url)(
  './astronomy.browser.min.js'
);

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- the engine's sun -----------------------------------------
{
  const A = AstroEngine;
  const t = A.MakeTime(new Date(SUN.at.replace('Z', ':00Z')));
  const obs = new A.Observer(SUN.latDeg, SUN.lonDeg, 30);
  const eq = A.Equator(A.Body.Sun, t, obs, true, true);
  const hor = A.Horizon(t, obs, eq.ra, eq.dec, 'normal');
  check(
    "THE ENGINE'S SUN matches the frozen stamp",
    Math.abs(hor.altitude - SUN.altDeg) < 0.05,
    `the vendored engine puts the sun at ${hor.altitude.toFixed(3)} deg ` +
      `over San Diego at ${SUN.at}; the fixture froze ${SUN.altDeg} - ` +
      `same sun, so every live panel and this gate share one sky`
  );
}

// ---- today's column mirages aloft -----------------------------
const col = columnPanel(SOUNDING.rows);
{
  const [beach, aloft] = col.observers;
  check(
    "TODAY'S COLUMN MIRAGES ALOFT",
    Math.abs(col.inversion.dT - 8.7) < 0.05 &&
      Math.abs(col.inversion.hM - 878) < 1 &&
      beach.folds === 0 &&
      aloft.folds === 1,
    `the ${SOUNDING.at} Miramar ascent climbs +` +
      `${col.inversion.dT.toFixed(1)} C from the ${col.surface.tC} C ` +
      `surface to ${col.inversion.hM} m - the marine subsidence ` +
      `inversion; the transfer fan through it folds ` +
      `${aloft.folds}x at eye 450 m (one inverted second image in ` +
      `today's air) and ${beach.folds}x at 15 m - the mirage lives ` +
      `above the beach today, not on it`
  );
}
{
  const [beach] = col.observers;
  const lift = beach.r0Arcmin - beach.r0IsaArcmin;
  check(
    'THE LIFTED, SQUASHED SUN at the beach eye',
    lift > 4 &&
      lift < 6.5 &&
      beach.flatten > 0.6 &&
      beach.flatten < 0.8 &&
      beach.rimArcsec > 25 &&
      beach.rimArcsec < 70,
    `horizon refraction ${beach.r0Arcmin.toFixed(1)} arcmin vs ISA ` +
      `${beach.r0IsaArcmin.toFixed(1)} - tonight's sun sets ` +
      `${lift.toFixed(1)} arcmin late; the disc flattens to ` +
      `${beach.flatten.toFixed(2)} of round (ISA evenings run ~0.85), ` +
      `and the 0.44-vs-0.68 um split at the horizon is ` +
      `${beach.rimArcsec.toFixed(0)} arcsec of green-rim budget ` +
      `through the 93%-humid marine layer`
  );
}

// ---- the foam -------------------------------------------------
{
  const sea = seaPanel({
    u10Ms: BUOY.wspdMs,
    wvhtM: BUOY.wvhtM,
    dpdS: BUOY.dpdS,
    wtmpC: BUOY.wtmpC
  });
  const closed = 3.84e-6 * Math.pow(6, 3.41);
  const ratio = monahanW(9) / monahanW(6);
  let mono = true;
  for (let i = 1; i < sea.curve.length; i++)
    if (sea.curve[i].W < sea.curve[i - 1].W) mono = false;
  check(
    'THE FOAM from the measured buoy wind',
    Math.abs(sea.W - closed) < 1e-8 &&
      mono &&
      Math.abs(ratio - Math.pow(1.5, 3.41)) < 1e-9,
    `Monahan W at Tanner Bank's measured ${BUOY.wspdMs} m/s = ` +
      `${(sea.W * 100).toFixed(3)}% of the sea in foam (Hs ` +
      `${BUOY.wvhtM} m, ${BUOY.dpdS} s swell alongside); the curve ` +
      `keeps the printed 3.41 power exactly ` +
      `(W(9)/W(6) = ${ratio.toFixed(3)} = 1.5^3.41)`
  );
}

// ---- the wet world today --------------------------------------
{
  const wet = wetPanel(CITIES);
  const by = Object.fromEntries(wet.rows.map((r) => [r.name, r]));
  const order = [
    'Phoenix',
    'London',
    'San Diego',
    'Singapore',
    'Bergen',
    'Mumbai'
  ];
  let ordered = true;
  for (let i = 1; i < order.length; i++)
    if (by[order[i]].w <= by[order[i - 1]].w) ordered = false;
  check(
    'THE WET WORLD TODAY across six cities',
    by['Mumbai'].raining &&
      by['Mumbai'].w > 0.9 &&
      !by['Bergen'].raining &&
      by['Bergen'].w > 0.9 &&
      by['Phoenix'].w < 0.12 &&
      ordered &&
      by['Mumbai'].factor < 0.66 &&
      by['Phoenix'].factor > 0.95 &&
      wet.crossRho < 0.05,
    `Mumbai in live drizzle reads w = ${by['Mumbai'].w.toFixed(2)} - ` +
      `its monsoon topsoil (0.338 of the 0.35 scale) already beats the ` +
      `0.9 rain skin; Bergen reaches ${by['Bergen'].w.toFixed(2)} with ` +
      `no rain falling (the column speaks); Phoenix reads ` +
      `${by['Phoenix'].w.toFixed(2)}; the darkening factor at display ` +
      `albedo 0.2 spans ${by['Mumbai'].factor.toFixed(2)} (Mumbai) to ` +
      `${by['Phoenix'].factor.toFixed(2)} (Phoenix), and the gloss ` +
      `floor sits at rho ${wet.crossRho.toFixed(3)}`
  );
}

// ---- the diluted polarization ---------------------------------
{
  const pol = polPanel({sunAltDeg: SUN.altDeg, aod550: AEROSOL.aod550});
  const wExp = 0.1085 / (0.1085 + AEROSOL.aod550);
  check(
    'THE DILUTED POLARIZATION under the measured aerosol',
    pol.maxPure > 0.85 &&
      pol.maxPure < 0.9 &&
      Math.abs(pol.maxAt.scatDeg - 90) < 2 &&
      Math.abs(pol.w - wExp) < 1e-9 &&
      Math.abs(pol.maxToday - pol.maxPure * wExp) < 1e-9,
    `the doubling engine's molecular dome peaks at DoP ` +
      `${pol.maxPure.toFixed(3)} on the ${pol.maxAt.scatDeg.toFixed(1)}` +
      `-degree lobe (the Rayleigh 90); today's measured AOD(550) = ` +
      `${AEROSOL.aod550} dilutes by w = ${pol.w.toFixed(3)} - the same ` +
      `w the theme's skyPolLut applies - leaving max DoP ` +
      `${pol.maxToday.toFixed(3)}: the aerosol takes ` +
      `${((1 - pol.w) * 100).toFixed(0)}% of the sky's polarization ` +
      `signal today`
  );
}

// ---- the corona at six regions --------------------------------
{
  const cor = coronaPanel({regionCount: SOLAR_REGIONS.count});
  const at15 = cor.profiles.find((p) => p.r > 1.5);
  check(
    'THE CORONA AT SIX REGIONS',
    Math.abs(cor.phase - 0.5) < 1e-9 &&
      cor.moons > 0.33 &&
      cor.moons < 0.59 &&
      at15.eq / at15.pole > 1.2 &&
      at15.eq / at15.pole < 1.45,
    `${SOLAR_REGIONS.count} numbered regions (${SOLAR_REGIONS.at}, ` +
      `${SOLAR_REGIONS.areaMillionths} millionths) map to the ` +
      `client's phase ${cor.phase}; were totality now, the corona ` +
      `would shine ${cor.lux.toFixed(2)} lux = ` +
      `${cor.moons.toFixed(2)} full moons - inside van de Hulst's ` +
      `third-to-three-fifths band - with the equator ` +
      `${(at15.eq / at15.pole).toFixed(2)}x the pole at 1.5 solar radii`
  );
}

// ---- the Perseids at the door ---------------------------------
{
  const A = AstroEngine;
  const elon = A.SunPosition(
    A.MakeTime(new Date(SUN_ELON.at.replace('Z', ':00Z')))
  ).elon;
  const m = meteorsPanel({
    lamSunDeg: SUN_ELON.elonDeg,
    gmnMedians: GMN.medians,
    radiantAltRad: (PERSEID_NIGHT.radiantAltDeg * Math.PI) / 180
  });
  // The ZHR definition's own normalization: at lm = 6.5 the
  // perception fold is exactly 1.
  const norm = visibleRateFactor(m.shower.r, 6.5);
  const topShower = m.shares.filter((s) => s.code !== 'spo')[0];
  // When does the engine's sun cross the printed lam_max = 140.0?
  let peakIso = null;
  for (let h = 0; h <= 180; h += 3) {
    const tt = A.MakeTime(
      new Date(Date.parse('2026-08-09T00:00:00Z') + h * 3600e3)
    );
    if (A.SunPosition(tt).elon >= 140.0) {
      peakIso = new Date(
        Date.parse('2026-08-09T00:00:00Z') + h * 3600e3
      ).toISOString();
      break;
    }
  }
  check(
    'THE PERSEIDS AT THE DOOR',
    Math.abs(elon - SUN_ELON.elonDeg) < 0.02 &&
      Math.abs(m.zhrNow - 28.9) < 0.5 &&
      m.daysToPeak > 2.5 &&
      m.daysToPeak < 3.0 &&
      topShower.code === 'PER' &&
      topShower.share > 0.25 &&
      topShower.share < 0.45 &&
      Math.abs(norm - 1) < 1e-12 &&
      Math.abs(
        m.rates[0].perHour -
          m.zhrNow * Math.sin((PERSEID_NIGHT.radiantAltDeg * Math.PI) / 180)
      ) < 1e-9 &&
      peakIso.startsWith('2026-08-12'),
    `the engine's sun sits at ecliptic longitude ` +
      `${elon.toFixed(2)} deg; the printed Jenniskens profile puts the ` +
      `Perseids at ZHR ${m.zhrNow.toFixed(0)} today, ` +
      `${m.daysToPeak.toFixed(1)} days before the lam 140.0 peak the ` +
      `engine dates ${peakIso.slice(0, 10)}; the LIVE Global Meteor ` +
      `Network counted ${topShower.n} Perseids = ` +
      `${(topShower.share * 100).toFixed(0)}% of yesterday's ` +
      `${GMN.medians.all.n} meteors - the measured shower already ` +
      `dominates the sky; tonight at the point the gated corrections ` +
      `give ${m.rates[0].perHour.toFixed(0)}/h dark-sky and ` +
      `${m.rates[1].perHour.toFixed(0)}/h suburban (the lm 6.5 ` +
      `perception fold is exactly 1 - the ZHR definition's own ` +
      `normalization, held to 1e-12)`
  );
}

// ---- the aurora supply ----------------------------------------
{
  const a = auroraPanel({
    hemiText: HEMI_POWER_TXT,
    ovationCoords: OVATION.cells,
    lonDeg: OVATION.lonDegE,
    kpEst: KP.est
  });
  check(
    'THE AURORA SUPPLY, measured at five-minute cadence',
    a.history.length === 258 &&
      a.latest.at === '2026-08-09T21:25Z' &&
      a.latest.gwN === 13 &&
      a.latest.gwN >= 5 &&
      a.latest.gwN <= 60 &&
      a.ov.latDeg >= 60 &&
      a.ov.latDeg <= 80 &&
      a.ov.p > 0 &&
      a.ov.p < 0.5 &&
      a.kpEst < 3,
    `${a.history.length} five-minute rows parse from the frozen SWPC ` +
      `wire; the northern hemisphere is drawing ${a.latest.gwN} GW at ` +
      `${a.latest.at} (the same file the theme's curtain scales by - ` +
      `emission linear in precipitating power); OVATION puts ` +
      `${(a.ov.p * 100).toFixed(0)}% at lat ${a.ov.latDeg} N on the ` +
      `fixture meridian, Kp ${a.kpEst} - a quiet magnetosphere under ` +
      `an active-region-rich sun, and every number here is a ` +
      `measurement, not a mood`
  );
}

// ---- the contrail layer ---------------------------------------
{
  const c = contrailPanel(SOUNDING.rows, {ac: ADSB.ac});
  // Every form-band level really is at or under its own critical
  // temperature, and every persistent level would lie inside a
  // form run by construction - checked on the day's data.
  const bandHonest = c.levels
    .filter((q) => q.hM >= c.formBand.loM && q.hM <= c.formBand.hiM)
    .every((q) => q.tC <= q.a.tlc + 1e-12);
  const missM = c.formBand.loM - c.issrLevels[c.issrLevels.length - 1].hM;
  check(
    'THE CONTRAIL LAYER read off the ascent',
    Math.abs(c.l250.p - 250) < 2 &&
      Math.abs(c.l250.tC - -41.3) < 0.5 &&
      c.l250.a.forms === false &&
      Math.abs(c.l250.a.tlc - -48.18) < 0.1 &&
      c.l250.a.rhi > 0.99 &&
      c.l250.a.rhi < 1 &&
      Math.abs(c.formBand.loM - 12431) < 1 &&
      Math.abs(c.formBand.hiM - 16578) < 1 &&
      c.issrLevels.length === 2 &&
      Math.abs(c.issrLevels[0].hM - 10769) < 1 &&
      Math.abs(c.issrLevels[0].rhi - 1.097) < 0.005 &&
      Math.abs(c.issrLevels[1].hM - 11470) < 1 &&
      c.persistBand === null &&
      missM > 900 &&
      missM < 1000 &&
      bandHonest &&
      c.aircraft.n === 74 &&
      Math.abs(c.aircraft.maxAltM - 29025 * 0.3048) < 0.1 &&
      c.aircraft.inForm === 0 &&
      c.aircraft.inPersist === 0,
    `at the theme's own level (${c.l250.p} hPa, ` +
      `${c.l250.tC} C) the exact tangency construction says NO trail ` +
      `forms - the air is ${(c.l250.tC - c.l250.a.tlc).toFixed(1)} K ` +
      `too warm against T_LC ${c.l250.a.tlc.toFixed(1)}; the column ` +
      `DOES hold ice-supersaturated air - two thin sheets at ` +
      `${c.issrLevels.map((q) => (q.hM / 1000).toFixed(1)).join(' and ')} ` +
      `km (RHi ${c.issrLevels.map((q) => q.rhi.toFixed(2)).join(', ')}, ` +
      `cirrus-capable) - but the formation zone starts at ` +
      `${(c.formBand.loM / 1000).toFixed(1)} km: the two conditions ` +
      `MISS by ${missM} m, so nothing persists today (the overlap ` +
      `band is empty), and the ${c.aircraft.n} live ADS-B aircraft ` +
      `top out at ${(c.aircraft.maxAltM / 1000).toFixed(1)} km, below ` +
      `even the form floor - today San Diego's sky writes nothing, ` +
      `for a reason the scan can point at`
  );
}

// ---- the wave ladder ------------------------------------------
{
  const w = leewavePanel(SOUNDING.rows);
  const capable = w.levels.filter((q) => q.lamM);
  // The window edges are the printed Fr3 band, exactly.
  const edgeHi = froude3(w.spot.lamM, w.spot.wLoM);
  const edgeLo = froude3(w.spot.lamM, w.spot.wHiM);
  check(
    'THE WAVE LADDER on a calm marine day',
    w.levels.length === 29 &&
      capable.length === 29 &&
      w.layer.n === 10 &&
      Math.abs(w.layer.mMs - 0.43) < 0.05 &&
      w.layer.scalarMs > 2 * w.layer.mMs &&
      Math.abs(w.spot.hM - 1908) < 1 &&
      Math.abs(w.spot.lamM - 657) < 5 &&
      Math.abs(edgeHi - FR3_RES_HI) < 1e-12 &&
      Math.abs(edgeLo - FR3_RES_LO) < 1e-12 &&
      fr3Regime(froude3(w.spot.lamM, w.spot.lamM / 2)) === 'resonant' &&
      w.layer.mMs < 1,
    `every one of the ${w.levels.length} wind-bearing levels ` +
      `oscillates (N^2 > 0 throughout - the same static stability ` +
      `that holds the marine inversion); but the 1-3 km crest layer's ` +
      `VECTOR-mean wind is ${w.layer.mMs.toFixed(2)} m/s against a ` +
      `scalar mean of ${w.layer.scalarMs.toFixed(2)} - the light ` +
      `winds swirl, no single ridge faces the flow; the spotlight ` +
      `level (${w.spot.hM} m) would write lam = ` +
      `${w.spot.lamM.toFixed(0)} m waves resonating only toy ridges ` +
      `${w.spot.wLoM.toFixed(0)}-${w.spot.wHiM.toFixed(0)} m wide ` +
      `(the window's edges land the printed Fr3 band ` +
      `${FR3_RES_LO}..${FR3_RES_HI} exactly), and the theme's own ` +
      `wind gate (>= 1 m/s) reports no wave claim - the calm-day ` +
      `null, stated with its reason`
  );
}

// ---- the surge gauge ------------------------------------------
{
  const t = tidePanel(TIDE);
  const by = Object.fromEntries(t.amps.map((a) => [a.n, a.ampM]));
  const ordered =
    by.M2 > by.K1 &&
    by.K1 > by.O1 &&
    by.O1 > by.S2 &&
    by.S2 > by.N2 &&
    by.N2 > by.M4;
  check(
    'THE SURGE GAUGE: the Schureman frame predicts the unseen water',
    Math.abs(by.M2 - 0.526) < 0.01 &&
      by.K1 > 0.4 &&
      by.K1 < 0.46 &&
      ordered &&
      t.rmsFitM < 0.08 &&
      t.rmsOutM < 0.09 &&
      Math.abs(t.latestResidM) < 0.03 &&
      Math.abs(t.maxAbsOut.v - -0.189) < 0.01 &&
      t.nFit === 600,
    `a 25-day fit of the measured San Diego Bay gauge at the printed ` +
      `Schureman speeds lands M2 ${by.M2.toFixed(3)} m, ` +
      `K1 ${by.K1.toFixed(3)} (carrying P1 inside it - the stated ` +
      `Rayleigh lump of a 720 h record), O1 ${by.O1.toFixed(3)}, ` +
      `S2 ${by.S2.toFixed(3)} - the classic mixed-semidiurnal ordering ` +
      `held; the synthesis then predicts the UNSEEN last five days to ` +
      `${(t.rmsOutM * 100).toFixed(1)} cm RMS, reads the surge right ` +
      `now at ${(t.latestResidM * 100).toFixed(1)} cm (a calm Pacific ` +
      `evening), and catches a real ${(t.maxAbsOut.v * 100).toFixed(0)} ` +
      `cm anomaly inside the held-out window - the weather in the ` +
      `water, separated from the astronomy by the repo's own frame`
  );
}

// ---- the fit meets the publication ----------------------------
{
  const t = tidePanel(TIDE, {published: TIDE_PUBLISHED.rows});
  const by = Object.fromEntries(t.amps.map((a) => [a.n, a]));
  const pub = TIDE_PUBLISHED.rows;
  // Schureman's printed nodal extremes (Table 14; the 57th
  // pass's own primary): published amplitudes are means, a raw
  // epoch fit sees amp x f(now).
  const F_M2 = [0.963, 1.038];
  const F_O1 = [0.806, 1.194];
  const F_K1_MAX = 1.113;
  const F_K2_MAX = 1.317;
  const rM2 = by.M2.ratio;
  const rO1 = by.O1.ratio;
  const k1Lump =
    by.K1.ampM > pub.K1.ampM &&
    by.K1.ampM < pub.K1.ampM * F_K1_MAX + pub.P1.ampM;
  const n2Env =
    by.N2.ampM > (pub.N2.ampM - pub.NU2.ampM) * F_M2[0] &&
    by.N2.ampM < (pub.N2.ampM + pub.NU2.ampM) * F_M2[1];
  const s2Env =
    by.S2.ampM > pub.S2.ampM - pub.K2.ampM * F_K2_MAX &&
    by.S2.ampM < pub.S2.ampM + pub.K2.ampM * F_K2_MAX;
  check(
    'THE FIT MEETS THE PUBLICATION - and reads the lunar node',
    rM2 > F_M2[0] &&
      rM2 < 1 &&
      rO1 > 1.15 &&
      rO1 < 1.25 &&
      k1Lump &&
      n2Env &&
      s2Env,
    `NOAA's long-record constants for the same gauge land beside the ` +
      `25-day fit: M2 ${by.M2.ampM.toFixed(3)} vs published ` +
      `${pub.M2.ampM} (ratio ${rM2.toFixed(3)}, inside Schureman's ` +
      `printed f_M2 band ${F_M2[0]}..${F_M2[1]} and BELOW 1) while O1 ` +
      `${by.O1.ampM.toFixed(3)} vs ${pub.O1.ampM} runs ` +
      `${rO1.toFixed(2)}x (at the printed f_O1 maximum 1.194 plus its ` +
      `sub-Rayleigh neighbours) - opposite signs, exactly the ` +
      `18.6-year node's cross-signature: 2026 sits at the lunar-node ` +
      `phase that SUPPRESSES semidiurnals and INFLATES diurnals, and ` +
      `a 25-day gauge fit reads it; the lumps stay inside their ` +
      `printed envelopes (K1 ${by.K1.ampM.toFixed(3)} between ` +
      `published K1 ${pub.K1.ampM} and K1 x f_max + P1 = ` +
      `${(pub.K1.ampM * F_K1_MAX + pub.P1.ampM).toFixed(3)}, phases ` +
      `2.5 deg apart; N2 carries NU2; S2 absorbs K2 at its printed ` +
      `f up to ${F_K2_MAX})`
  );
}

// ---- the dome audits itself, live -----------------------------
{
  const A = AstroEngine;
  const t = A.MakeTime(new Date(RADIATION.at.replace('Z', ':00Z')));
  const obs = new A.Observer(SUN.latDeg, SUN.lonDeg, 30);
  const eq = A.Equator(A.Body.Sun, t, obs, true, true);
  const alt = A.Horizon(t, obs, eq.ra, eq.dec, 'normal').altitude;
  const c = closurePanel({
    sunAltDeg: RADIATION.sunAltDeg,
    aod550: AEROSOL.aod550,
    ghiWm2: RADIATION.ghiWm2,
    dirWm2: RADIATION.dirWm2,
    difWm2: RADIATION.difWm2
  });
  const r = c.ratios;
  check(
    'THE DOME AUDITS ITSELF on the current measured irradiance',
    Math.abs(alt - RADIATION.sunAltDeg) < 0.05 &&
      r &&
      r.globalRatio > 0.9 &&
      r.globalRatio < 1.05 &&
      r.beamRatio > 1 &&
      r.diffuseRatio < 0.5,
    `at the radiation hour's engine sun (${alt.toFixed(2)} deg) the ` +
      `drawn dome's integral lands ${(r.globalRatio * 100).toFixed(1)}% ` +
      `of the measured ${RADIATION.ghiWm2} W/m2 global - the 91st ` +
      `pass's closure holding LIVE at the measured AOD ` +
      `${AEROSOL.aod550}; the split leans exactly as the frame states ` +
      `it must (beam ${r.beamRatio.toFixed(2)}, diffuse ` +
      `${r.diffuseRatio.toFixed(2)}: the drawn diffuse is the ` +
      `molecular Hillaire dome, so the gray aerosol's forward scatter ` +
      `stays in the beam channel's loss)`
  );
}

process.exit(fail ? 1 : 0);
