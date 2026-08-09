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
  columnPanel,
  coronaPanel,
  monahanW,
  polPanel,
  seaPanel,
  wetPanel
} from './observatory.js';
import {
  AEROSOL,
  BUOY,
  CITIES,
  SOLAR_REGIONS,
  SOUNDING,
  SUN
} from './observatory-fixture.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- the engine's sun -----------------------------------------
{
  const A = createRequire(import.meta.url)('./astronomy.browser.min.js');
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

process.exit(fail ? 1 : 0);
