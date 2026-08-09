// observatory-reference.mjs - the gate for the living snapshot
// (observatory.js on observatory-fixture.js). The instrument
// composes ONLY gated machinery; what is pinned here splits into
// two kinds since the 123rd pass:
//  - DAY-INVARIANT landmarks: identities, printed envelopes,
//    parse-form checks and engine-agreement checks that hold on
//    ANY frozen day by their form. They live below as code and
//    survive every refreeze untouched.
//  - DAY PINS: the frozen day's own numbers, GENERATED as data
//    (observatory-pins.js, written by observatory-freeze.mjs
//    beside the fixture) and asserted by one generic runner. A
//    refreeze regenerates fixture and pins together; the
//    deliberateness of run-then-pin lives in READING THE DIFF
//    before committing. A stale pins file (generatedFor stamp
//    differing from FIXTURE_AT) fails the gate outright.
// The frozen day at this writing: 2026-08-09, San Diego - the
// +8.7 C marine inversion that folds the fan aloft, the ISSR
// sheets a kilometre under the contrail formation floor, the
// calm-day wave null, the lunar node in the tide ratios, seven
// rocket bodies in the night's top eight passes.
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
  satsPanel,
  seaPanel,
  tidePanel,
  wetPanel
} from './observatory.js';
import {
  ADSB,
  AEROSOL,
  BUOY,
  CITIES,
  FIXTURE_AT,
  GMN,
  HEMI_POWER_TXT,
  KP,
  OVATION,
  PERSEID_NIGHT,
  RADIATION,
  SOLAR_REGIONS,
  SOUNDING,
  SUN,
  SUN_ELON,
  TIDE,
  TIDE_PUBLISHED,
  TLES
} from './observatory-fixture.js';
import {DAY_PINS} from './observatory-pins.js';
import {visibleRateFactor} from './meteors.js';
import {fr3Regime, froude3, FR3_RES_HI, FR3_RES_LO} from './leewave.js';
import {satMagnitude} from './sats.js';
import {FT_M} from './contrails.js';
import {snapshotMap} from './satmags.js';

const AstroEngine = createRequire(import.meta.url)(
  './astronomy.browser.min.js'
);
const satlib = createRequire(import.meta.url)('./satellite.min.js');

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- run every panel once on the frozen day -------------------
const col = columnPanel(SOUNDING.rows);
const [beach, aloft] = col.observers;
const sea = seaPanel({
  u10Ms: BUOY.wspdMs,
  wvhtM: BUOY.wvhtM,
  dpdS: BUOY.dpdS,
  wtmpC: BUOY.wtmpC
});
const wet = wetPanel(CITIES);
const pol = polPanel({sunAltDeg: SUN.altDeg, aod550: AEROSOL.aod550});
const cor = coronaPanel({regionCount: SOLAR_REGIONS.count});
const met = meteorsPanel({
  lamSunDeg: SUN_ELON.elonDeg,
  gmnMedians: GMN.medians,
  radiantAltRad: (PERSEID_NIGHT.radiantAltDeg * Math.PI) / 180
});
const aur = auroraPanel({
  hemiText: HEMI_POWER_TXT,
  ovationCoords: OVATION.cells,
  lonDeg: OVATION.lonDegE,
  kpEst: KP.est
});
const con = contrailPanel(SOUNDING.rows, {ac: ADSB.ac});
const lee = leewavePanel(SOUNDING.rows);
const tid = tidePanel(TIDE, {published: TIDE_PUBLISHED.rows});
const clo = closurePanel({
  sunAltDeg: RADIATION.sunAltDeg,
  aod550: AEROSOL.aod550,
  ghiWm2: RADIATION.ghiWm2,
  dirWm2: RADIATION.dirWm2,
  difWm2: RADIATION.difWm2
});
const satObs = new AstroEngine.Observer(SUN.latDeg, SUN.lonDeg, 30);
const satEq = (ms) => {
  const t = AstroEngine.MakeTime(new Date(ms));
  return {
    t,
    eq: AstroEngine.Equator(AstroEngine.Body.Sun, t, satObs, true, true)
  };
};
const night0 = new Date(FIXTURE_AT.replace('Z', ':00Z'));
const nightStart = new Date(night0);
nightStart.setUTCHours(2, 0, 0, 0);
if (nightStart < night0) nightStart.setUTCDate(nightStart.getUTCDate() + 1);
const sat = satsPanel({
  tleText: TLES.text,
  latDeg: SUN.latDeg,
  lonDeg: SUN.lonDeg,
  startMs: +nightStart,
  hours: 12,
  satlib,
  sunRaDecAtMs: (ms) => {
    const {eq} = satEq(ms);
    return {raH: eq.ra, decDeg: eq.dec};
  },
  sunAltAtMs: (ms) => {
    const {t, eq} = satEq(ms);
    return AstroEngine.Horizon(t, satObs, eq.ra, eq.dec, 'normal').altitude;
  },
  mags: snapshotMap()
});

// ================================================================
// DAY-INVARIANT LANDMARKS - these hold on ANY frozen day.
// ================================================================

// ---- the pins move with the fixture ---------------------------
check(
  'PINS GUARD: fixture and pins move together',
  DAY_PINS.generatedFor === FIXTURE_AT,
  `observatory-pins.js was generated for ${DAY_PINS.generatedFor} and ` +
    `the fixture is ${FIXTURE_AT} - a refreeze regenerates BOTH ` +
    `(observatory-freeze.mjs; --pins-only redoes just the pins), and ` +
    `a mismatch fails the gate before any physics is consulted`
);

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
      `at the fixture's own stamp ${SUN.at}; the fixture froze ` +
      `${SUN.altDeg} - same sun on any refrozen day, so every live ` +
      `panel and this gate share one sky`
  );
}

// ---- the foam law's identities --------------------------------
{
  const closed = 3.84e-6 * Math.pow(BUOY.wspdMs, 3.41);
  const ratio = monahanW(BUOY.wspdMs * 1.5) / monahanW(BUOY.wspdMs);
  let mono = true;
  for (let i = 1; i < sea.curve.length; i++)
    if (sea.curve[i].W < sea.curve[i - 1].W) mono = false;
  check(
    'THE FOAM law holds its printed form at the measured wind',
    Math.abs(sea.W - closed) < 1e-8 &&
      mono &&
      Math.abs(ratio - Math.pow(1.5, 3.41)) < 1e-9,
    `Monahan W at the frozen buoy's ${BUOY.wspdMs} m/s = ` +
      `${(sea.W * 100).toFixed(3)}% of the sea in foam, exactly the ` +
      `closed form; the curve is monotone and keeps the printed 3.41 ` +
      `power exactly (W(1.5u)/W(u) = 1.5^3.41) - identities that hold ` +
      `for whatever wind the day froze`
  );
}

// ---- the polarization identities ------------------------------
{
  const wExp = 0.1085 / (0.1085 + AEROSOL.aod550);
  check(
    'THE DILUTED POLARIZATION keeps its identities',
    Math.abs(pol.maxAt.scatDeg - 90) < 2 &&
      Math.abs(pol.w - wExp) < 1e-9 &&
      Math.abs(pol.maxToday - pol.maxPure * wExp) < 1e-9,
    `the doubling engine's max DoP sits on the ` +
      `${pol.maxAt.scatDeg.toFixed(1)}-degree lobe (the Rayleigh 90, ` +
      `any day); the dilution is exactly w = tauR/(tauR+tauA) = ` +
      `${pol.w.toFixed(3)} at the frozen AOD ${AEROSOL.aod550} - the ` +
      `same w the theme's skyPolLut applies - and maxToday = ` +
      `w x maxPure to 1e-9`
  );
}

// ---- the corona's printed band --------------------------------
{
  const at15 = cor.profiles.find((p) => p.r > 1.5);
  check(
    'THE CORONA stays inside van de Hulst',
    Math.abs(cor.phase - Math.min(1, SOLAR_REGIONS.count / 12)) < 1e-12 &&
      cor.moons > 0.33 &&
      cor.moons < 0.59 &&
      at15.eq / at15.pole >= 1 &&
      at15.eq / at15.pole <= 1.8,
    `${SOLAR_REGIONS.count} frozen regions map through the client's own ` +
      `regions/12 to phase ${cor.phase.toFixed(2)}; the whole-corona ` +
      `illuminance is ${cor.moons.toFixed(2)} full moons - inside the ` +
      `printed third-to-three-fifths band at EVERY phase - and the ` +
      `equator-to-pole ratio at 1.5 solar radii ` +
      `(${(at15.eq / at15.pole).toFixed(2)}) stays within the c = 1.78 ` +
      `sector spread`
  );
}

// ---- the meteor frame's identities ----------------------------
{
  const A = AstroEngine;
  const elon = A.SunPosition(
    A.MakeTime(new Date(SUN_ELON.at.replace('Z', ':00Z')))
  ).elon;
  const norm = visibleRateFactor(met.shower.r, 6.5);
  const compose =
    met.rates[0].perHour -
    met.zhrNow * Math.sin((PERSEID_NIGHT.radiantAltDeg * Math.PI) / 180);
  // The printed lam_max = 140.0 crossing - a YEAR pin (2026), not
  // a day pin; re-derive on a new year's fixture.
  let peakIso = null;
  for (let h = 0; h <= 24 * 370; h += 6) {
    const tt = A.MakeTime(
      new Date(Date.parse('2026-01-01T00:00:00Z') + h * 3600e3)
    );
    if (A.SunPosition(tt).elon >= 140.0 && A.SunPosition(tt).elon < 180) {
      peakIso = new Date(
        Date.parse('2026-01-01T00:00:00Z') + h * 3600e3
      ).toISOString();
      break;
    }
  }
  check(
    'THE METEOR FRAME keeps its identities',
    Math.abs(elon - SUN_ELON.elonDeg) < 0.02 &&
      Math.abs(norm - 1) < 1e-12 &&
      Math.abs(compose) < 1e-9 &&
      peakIso.startsWith('2026-08-12'),
    `the engine's solar longitude at the fixture stamp ` +
      `(${elon.toFixed(2)}) matches the frozen value; the lm 6.5 ` +
      `perception fold is exactly 1 (the ZHR definition's own ` +
      `normalization, 1e-12); tonight's rate composes exactly as ` +
      `hourlyRate x visibleRateFactor; and the printed lam 140.0 ` +
      `Perseid peak lands ${peakIso.slice(0, 10)} in the fixture's year`
  );
}

// ---- the aurora wire parses to sense ---------------------------
check(
  'THE AURORA WIRE parses to sense',
  aur.history.length > 200 &&
    aur.latest.gwN >= 1 &&
    aur.latest.gwN <= 200 &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(aur.latest.at) &&
    (aur.ov.p === 0 || (aur.ov.latDeg >= 45 && aur.ov.latDeg <= 85)) &&
    aur.kpEst >= 0 &&
    aur.kpEst <= 9,
  `${aur.history.length} five-minute rows parse from the frozen SWPC ` +
    `wire with a well-formed latest stamp (${aur.latest.at}); the ` +
    `hemispheric power (${aur.latest.gwN} GW) sits in the physical ` +
    `range, OVATION's meridian maximum falls in the auroral-zone ` +
    `latitudes when present, and Kp is a Kp - form checks that hold ` +
    `for any day's wire`
);

// ---- the contrail scan's internal honesty ---------------------
{
  const bandHonest = con.formBand
    ? con.levels
        .filter((q) => q.hM >= con.formBand.loM && q.hM <= con.formBand.hiM)
        .every((q) => q.tC <= q.a.tlc + 1e-12)
    : true;
  const persistInForm =
    !con.persistBand ||
    (con.formBand &&
      con.persistBand.loM >= con.formBand.loM &&
      con.persistBand.hiM <= con.formBand.hiM);
  const rawMax = Math.max(...ADSB.ac.map((a) => a.alt_baro)) * FT_M;
  check(
    'THE CONTRAIL SCAN is internally honest',
    bandHonest &&
      persistInForm &&
      Math.abs(con.aircraft.maxAltM - rawMax) < 1e-9,
    `every level inside the formation band really is at or under its ` +
      `own critical temperature; any persistence band lies inside the ` +
      `formation band by construction; and the ADS-B ceiling converts ` +
      `through the module's exact international foot ` +
      `(${(con.aircraft.maxAltM / 1000).toFixed(2)} km) - the scan's ` +
      `own bookkeeping, on any day's column`
  );
}

// ---- the wave ladder's printed edges --------------------------
{
  const spot = lee.spot;
  const edgeHi = spot ? froude3(spot.lamM, spot.wLoM) : null;
  const edgeLo = spot ? froude3(spot.lamM, spot.wHiM) : null;
  check(
    'THE WAVE LADDER lands the printed Fr3 band exactly',
    !spot ||
      (Math.abs(edgeHi - FR3_RES_HI) < 1e-12 &&
        Math.abs(edgeLo - FR3_RES_LO) < 1e-12 &&
        fr3Regime(froude3(spot.lamM, spot.lamM / 2)) === 'resonant'),
    `the resonant ridge-width window [lam/4, lam] puts its edges at ` +
      `Fr3 = ${FR3_RES_HI} and ${FR3_RES_LO} exactly (eq. 17.32's own ` +
      `band), and the window's centre is resonant - Stull's ladder in ` +
      `the panel's own algebra, whatever the day's winds`
  );
}

// ---- the tide ratios stay inside Schureman --------------------
{
  const by = Object.fromEntries(tid.amps.map((a) => [a.n, a]));
  const pub = TIDE_PUBLISHED.rows;
  // Schureman's printed nodal extremes (Table 14; the 57th pass's
  // own primary). The SIGN pattern (rM2 < 1 < rO1) is the current
  // node era's - valid while the ascending node rides its
  // diurnal-maximum phase (roughly 2023-2029); re-derive after.
  const F_M2 = [0.963, 1.038];
  const F_K1_MAX = 1.113;
  const F_K2_MAX = 1.317;
  const rM2 = by.M2.ratio;
  const rO1 = by.O1.ratio;
  check(
    'THE TIDE RATIOS stay inside Schureman - and read the node',
    rM2 > F_M2[0] &&
      rM2 < F_M2[1] &&
      rM2 < 1 &&
      rO1 > 1 &&
      rO1 < 1.25 &&
      by.K1.ampM > pub.K1.ampM &&
      by.K1.ampM < pub.K1.ampM * F_K1_MAX + pub.P1.ampM &&
      by.N2.ampM > (pub.N2.ampM - pub.NU2.ampM) * F_M2[0] &&
      by.N2.ampM < (pub.N2.ampM + pub.NU2.ampM) * F_M2[1] &&
      by.S2.ampM > pub.S2.ampM - pub.K2.ampM * F_K2_MAX &&
      by.S2.ampM < pub.S2.ampM + pub.K2.ampM * F_K2_MAX,
    `fitted/published lands M2 x${rM2.toFixed(3)} inside the printed ` +
      `f_M2 band and BELOW 1 while O1 x${rO1.toFixed(2)} runs ABOVE 1 ` +
      `- the 18.6-year node's cross-signature (suppressed ` +
      `semidiurnals, inflated diurnals; the current node era's sign, ` +
      `dated in the source); the sub-Rayleigh lumps (P1 in K1, NU2 in ` +
      `N2, K2 in S2) stay inside their printed envelopes`
  );
}

// ---- the McCants anchor ---------------------------------------
check(
  'THE McCANTS ANCHOR holds exactly',
  Math.abs(satMagnitude(1000, Math.PI / 2, 3.3) - 3.3) < 1e-12 &&
    sat.nSats === parseInt(sat.nSats) &&
    sat.nCatalogued <= sat.nSats,
  `m(1000 km, half phase) = m_std to 1e-12 - the convention anchor ` +
    `the measured catalogue plugs into, on any day's fleet ` +
    `(${sat.nCatalogued}/${sat.nSats} of the frozen TLEs carry ` +
    `measured magnitudes)`
);

// ================================================================
// THE DAY PINS - generated data, asserted generically.
// ================================================================
const near = (v, pin) => {
  if (pin === null) return v === null;
  if (Array.isArray(pin)) return Math.abs(v - pin[0]) <= pin[1];
  return Object.is(v, pin);
};
const pinBlock = (name, rows, extra = '') => {
  const bad = rows.filter(([, v, p]) => !near(v, p));
  check(
    `DAY PINS ${name}`,
    bad.length === 0,
    bad.length === 0
      ? `${rows.length}/${rows.length} hold${extra ? ' - ' + extra : ''}`
      : `MISSED: ` +
          bad
            .map(
              ([label, v, p]) =>
                `${label} = ${JSON.stringify(v)} vs ${JSON.stringify(p)}`
            )
            .join('; ')
  );
};

pinBlock(
  'column',
  [
    ['inversion dT', col.inversion.dT, DAY_PINS.column.invDT],
    ['inversion hM', col.inversion.hM, DAY_PINS.column.invHM],
    ['folds beach', beach.folds, DAY_PINS.column.foldsBeach],
    ['folds aloft', aloft.folds, DAY_PINS.column.foldsAloft],
    ['R0', beach.r0Arcmin, DAY_PINS.column.r0Arcmin],
    ['R0 ISA', beach.r0IsaArcmin, DAY_PINS.column.r0IsaArcmin],
    ['flatten', beach.flatten, DAY_PINS.column.flatten],
    ['rim', beach.rimArcsec, DAY_PINS.column.rimArcsec]
  ],
  `+${col.inversion.dT.toFixed(1)} C at ${col.inversion.hM} m, folds ` +
    `${beach.folds}/${aloft.folds}, sun ${(
      beach.r0Arcmin - beach.r0IsaArcmin
    ).toFixed(1)}' late`
);
pinBlock(
  'wet',
  [
    [
      'order',
      JSON.stringify(
        [...wet.rows].sort((a, b) => a.w - b.w).map((r) => r.name)
      ),
      JSON.stringify(DAY_PINS.wet.order)
    ],
    [
      'raining',
      JSON.stringify(wet.rows.filter((r) => r.raining).map((r) => r.name)),
      JSON.stringify(DAY_PINS.wet.raining)
    ],
    ...wet.rows.map((r) => [`w ${r.name}`, r.w, DAY_PINS.wet.w[r.name]])
  ],
  `${DAY_PINS.wet.raining.join('/') || 'nobody'} in rain, span ` +
    `${wet.rows.reduce((m, r) => Math.min(m, r.w), 1).toFixed(2)}-` +
    `${wet.rows.reduce((m, r) => Math.max(m, r.w), 0).toFixed(2)}`
);
pinBlock(
  'pol',
  [['maxPure', pol.maxPure, DAY_PINS.pol.maxPure]],
  `molecular max DoP ${pol.maxPure.toFixed(3)}, diluted to ` +
    `${pol.maxToday.toFixed(3)}`
);
pinBlock(
  'meteors',
  [
    ['zhrNow', met.zhrNow, DAY_PINS.meteors.zhrNow],
    ['daysToPeak', met.daysToPeak, DAY_PINS.meteors.daysToPeak],
    [
      'top shower',
      met.shares?.filter((s) => s.code !== 'spo')[0]?.code ?? null,
      DAY_PINS.meteors.topCode
    ],
    [
      'top share',
      met.shares?.filter((s) => s.code !== 'spo')[0]?.share ?? null,
      DAY_PINS.meteors.topShare
    ]
  ],
  `ZHR ${met.zhrNow.toFixed(0)}, ${met.daysToPeak.toFixed(1)} days to ` +
    `peak, ${DAY_PINS.meteors.topCode} measured dominant`
);
pinBlock(
  'aurora',
  [
    ['rows', aur.history.length, DAY_PINS.aurora.rows],
    ['latest GW', aur.latest.gwN, DAY_PINS.aurora.latestGwN],
    ['latest at', aur.latest.at, DAY_PINS.aurora.latestAt],
    ['ov p', aur.ov.p, DAY_PINS.aurora.ovP],
    ['ov lat', aur.ov.latDeg, DAY_PINS.aurora.ovLatDeg],
    ['Kp', aur.kpEst, DAY_PINS.aurora.kpEst]
  ],
  `${aur.latest.gwN} GW at ${aur.latest.at.slice(11, 16)}Z, Kp ` +
    `${aur.kpEst}`
);
pinBlock(
  'contrail',
  [
    ['250 hPa T', con.l250.tC, DAY_PINS.contrail.l250TC],
    ['250 hPa T_LC', con.l250.a.tlc, DAY_PINS.contrail.l250Tlc],
    ['250 hPa RHi', con.l250.a.rhi, DAY_PINS.contrail.l250Rhi],
    ['form lo', con.formBand?.loM ?? null, DAY_PINS.contrail.formLoM],
    ['form hi', con.formBand?.hiM ?? null, DAY_PINS.contrail.formHiM],
    ['issr count', con.issrLevels.length, DAY_PINS.contrail.issr.length],
    ...con.issrLevels.map((q, i) => [
      `issr ${i} hM`,
      q.hM,
      DAY_PINS.contrail.issr[i]?.[0] ?? null
    ]),
    ...con.issrLevels.map((q, i) => [
      `issr ${i} RHi`,
      q.rhi,
      DAY_PINS.contrail.issr[i]?.[1] ?? null
    ]),
    ['persist null', con.persistBand === null, DAY_PINS.contrail.persistNull],
    ['aircraft', con.aircraft.n, DAY_PINS.contrail.acN],
    ['ceiling', con.aircraft.maxAltM, DAY_PINS.contrail.acMaxAltM],
    ['in form', con.aircraft.inForm, DAY_PINS.contrail.acInForm],
    ['in persist', con.aircraft.inPersist, DAY_PINS.contrail.acInPersist]
  ],
  `form ${con.formBand ? (con.formBand.loM / 1000).toFixed(1) + '-' + (con.formBand.hiM / 1000).toFixed(1) + ' km' : 'none'}, ` +
    `${con.issrLevels.length} ISSR sheet(s), ` +
    `${DAY_PINS.contrail.persistNull ? 'nothing persists' : 'persistence live'}`
);
pinBlock(
  'leewave',
  [
    ['levels', lee.levels.length, DAY_PINS.leewave.levels],
    ['layer vector', lee.layer.mMs, DAY_PINS.leewave.layerMMs],
    ['layer scalar', lee.layer.scalarMs, DAY_PINS.leewave.layerScalarMs],
    ['spot hM', lee.spot.hM, DAY_PINS.leewave.spotHM],
    ['spot lam', lee.spot.lamM, DAY_PINS.leewave.spotLamM]
  ],
  `vector ${lee.layer.mMs.toFixed(2)} vs scalar ` +
    `${lee.layer.scalarMs.toFixed(2)} m/s, spot lam ` +
    `${lee.spot.lamM.toFixed(0)} m`
);
pinBlock(
  'tide',
  [
    ...tid.amps.map((a) => [`amp ${a.n}`, a.ampM, DAY_PINS.tide.amps[a.n]]),
    ['rmsOut', tid.rmsOutM, DAY_PINS.tide.rmsOutM],
    ['latest resid', tid.latestResidM, DAY_PINS.tide.latestResidM],
    ['max |resid|', tid.maxAbsOut.v, DAY_PINS.tide.maxAbsOutM],
    ['rM2', tid.amps[0].ratio, DAY_PINS.tide.rM2],
    [
      'rO1',
      tid.amps.find((a) => a.n === 'O1')?.ratio ?? null,
      DAY_PINS.tide.rO1
    ]
  ],
  `M2 ${tid.amps[0].ampM.toFixed(3)} m, holds the unseen days to ` +
    `${(tid.rmsOutM * 100).toFixed(1)} cm RMS, surge ` +
    `${(tid.latestResidM * 100).toFixed(1)} cm`
);
pinBlock(
  'sats',
  [
    ['passes', sat.passes.length, DAY_PINS.sats.passes],
    ['naked-eye', sat.nakedEye, DAY_PINS.sats.nakedEye],
    ['dark hours', sat.darkHours, DAY_PINS.sats.darkHours],
    ['best norad', sat.passes[0]?.norad ?? null, DAY_PINS.sats.bestNorad],
    ['best mag', sat.passes[0]?.minMag ?? null, DAY_PINS.sats.bestMag],
    ['best el', sat.passes[0]?.peakElDeg ?? null, DAY_PINS.sats.bestElDeg],
    [
      'R/B in top 8',
      sat.passes.slice(0, 8).filter((p) => p.name.includes('R/B')).length,
      DAY_PINS.sats.rbTop8
    ],
    [
      'ISS tonight',
      sat.passes.some((p) => p.norad === 25544),
      DAY_PINS.sats.issTonight
    ]
  ],
  `${sat.passes.length} passes / ${sat.nakedEye} naked-eye, best ` +
    `${sat.passes[0]?.name?.trim()} mag ` +
    `${sat.passes[0]?.minMag.toFixed(1)}, ${DAY_PINS.sats.rbTop8} of ` +
    `top 8 rocket bodies`
);
pinBlock(
  'closure',
  [
    [
      'global',
      clo.ratios?.globalRatio ?? null,
      DAY_PINS.closure?.globalRatio ?? null
    ],
    [
      'beam',
      clo.ratios?.beamRatio ?? null,
      DAY_PINS.closure?.beamRatio ?? null
    ],
    [
      'diffuse',
      clo.ratios?.diffuseRatio ?? null,
      DAY_PINS.closure?.diffuseRatio ?? null
    ]
  ],
  clo.ratios
    ? `drawn global ${(clo.ratios.globalRatio * 100).toFixed(1)}% of ` +
        `measured, the split leaning molecular (beam ` +
        `${clo.ratios.beamRatio.toFixed(2)}, diffuse ` +
        `${clo.ratios.diffuseRatio.toFixed(2)})`
    : 'night hour - the audit sleeps'
);

process.exit(fail ? 1 : 0);
