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
  eveningKey,
  flashFromProfile,
  flashLedgerVerdict,
  flashPanel,
  leewavePanel,
  retrievalPanel,
  marinePanel,
  meteorsPanel,
  monahanW,
  polPanel,
  satsPanel,
  seaPanel,
  tidePanel,
  wetPanel,
  solarInterpolator,
  warmLayerDay,
  SEA_RETRIEVAL_DISTS_M
} from './observatory.js';
import {buildProfile, standardProfile} from './refraction.js';
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
  TLES,
  COOPS_MET,
  SOLAR_HOURLY
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
// (the SWPC wire is a since-midnight file: a fixture frozen at
// 09Z carries ~110 five-minute rows, one frozen at 21Z ~250 - the
// row floor is two hours of rows, not a day's worth; measured on
// the 135th pass's morning refreeze)
check(
  'THE AURORA WIRE parses to sense',
  aur.history.length >= 24 &&
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
  // An empty ADS-B window (a small-hours refreeze can catch no
  // aircraft at all - measured on the 136th pass's 10Z freeze)
  // leaves the ceiling check vacuous: the scan must then report
  // no ceiling rather than a converted one.
  const rawMax = ADSB.ac.length
    ? Math.max(...ADSB.ac.map((a) => a.alt_baro)) * FT_M
    : null;
  const ceilingOk =
    rawMax === null
      ? !(con.aircraft.maxAltM > 0)
      : Math.abs(con.aircraft.maxAltM - rawMax) < 1e-9;
  check(
    'THE CONTRAIL SCAN is internally honest',
    bandHonest && persistInForm && ceilingOk,
    `every level inside the formation band really is at or under its ` +
      `own critical temperature; any persistence band lies inside the ` +
      `formation band by construction; and the ADS-B ceiling ` +
      (rawMax === null
        ? `is absent with the frozen window's ${ADSB.ac.length} aircraft (no invented ceiling)`
        : `converts through the module's exact international foot ` +
          `(${(con.aircraft.maxAltM / 1000).toFixed(2)} km)`) +
      ` - the scan's own bookkeeping, on any day's column`
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

// ---- the flash taxonomy (Young, read in full) ------------------
// flashFromProfile against Young's own model atmospheres, at the
// equatorial sunset rate (the sun's hour-angle rate, 15"/s of
// true altitude - his animations' clock). Day-invariant: these
// synthetic columns are Young's, not the fixture's.
{
  const EQ = 360.98565 / 86400;
  const mkProf = (tAt) => {
    const hs = [];
    for (let h = 0; h <= 300; h += 5) hs.push(h);
    hs.push(350, 400, 500, 700, 1000, 1500, 2000, 4000, 8000);
    const levels = [];
    let p = 101325;
    let hPrev = 0;
    for (const h of hs) {
      if (h > 0) {
        const tMean = (tAt(hPrev) + tAt(h)) / 2 + 273.15;
        p *= Math.exp((-(h - hPrev) * 9.80665 * 0.0289644) / (8.31451 * tMean));
      }
      levels.push({pPa: p, hM: h, tC: tAt(h), rh: 0});
      hPrev = h;
    }
    return buildProfile(levels, null);
  };
  // The textbook sunset: ISA, low eye. Young: the bare rim makes
  // "a (very feeble) green flash" lasting about a second - and
  // Dietze showed it is sub-naked-eye at a sea horizon.
  const tb = flashFromProfile(standardProfile(), {eyeM: 2, rateDegPerS: EQ});
  check(
    'FLASH textbook (Young/Dietze)',
    tb.type === 'textbook' &&
      tb.flash &&
      !tb.nakedEye &&
      tb.nMinima === 0 &&
      tb.durationS > 0.7 &&
      tb.durationS < 1.3,
    `ISA from 2 m: no transfer-curve minimum, the flash is the bare ` +
      `rim - ${tb.durationS.toFixed(2)} s at the equatorial rate ` +
      `(Young's "a second or so"), binoculars only`
  );
  // Young's weak mock mirage (0.8 K inversion, 30-50 m, eye 38 m
  // inside it): a shallow-but-real minimum at the line of sight
  // tangent to the inversion base, a preceding red-flash maximum
  // to its left, and a magnified flash.
  const wm = flashFromProfile(
    mkProf((h) => {
      if (h >= 50) return 15 - 0.0065 * h;
      const tBase = 15 - 0.0065 * 50 - 0.8;
      if (h >= 30) return tBase + (0.8 * (h - 30)) / 20;
      return tBase + 0.0065 * (30 - h);
    }),
    {eyeM: 38, rateDegPerS: EQ}
  );
  check(
    'FLASH mock-mirage (Young)',
    wm.type === 'mock-mirage' &&
      wm.flash &&
      wm.nakedEye &&
      wm.minG.aArcmin < 0 &&
      wm.minG.aArcmin > -8 &&
      wm.redFlash?.kind === 'preceding' &&
      wm.redFlash.aArcmin < wm.minG.aArcmin + 0.5 &&
      wm.durationS > 0.4 &&
      wm.durationS < 1.6 &&
      wm.magX > 1.5,
    `0.8 K / 30-50 m inversion, eye 38 m: minimum at ` +
      `${wm.minG.aArcmin.toFixed(1)}' apparent (below the astronomical ` +
      `horizon, above the sea), preceded by the red-flash maximum at ` +
      `${wm.redFlash?.aArcmin.toFixed(1)}'; ${wm.durationS.toFixed(2)} s, ` +
      `x${wm.magX.toFixed(1)} the bare rim`
  );
  // Young's ducted mock mirage (2 K over 50-60 m, eye above the
  // duct): the duct draws the green minimum to a point - "in
  // practice, these sunsets never produce green flashes" - while
  // the broad maximum survives as a red flash. From inside the
  // same duct: Wegener's blank strip, no flash at all.
  const dp = mkProf((h) => {
    if (h >= 60) return 15 - 0.0065 * h;
    const tBase = 15 - 0.0065 * 60 - 2;
    if (h >= 50) return tBase + (2 * (h - 50)) / 10;
    return tBase + 0.0065 * (50 - h);
  });
  const dAbove = flashFromProfile(dp, {eyeM: 70, rateDegPerS: EQ});
  const dIn = flashFromProfile(dp, {eyeM: 45, rateDegPerS: EQ});
  check(
    'FLASH ducted family (Young/Wegener)',
    dAbove.type === 'ducted-mock-mirage' &&
      !dAbove.flash &&
      dAbove.redFlash?.kind === 'preceding' &&
      dAbove.durationS === null &&
      dIn.type === 'in-duct' &&
      !dIn.flash &&
      dAbove.ducts.length === 1 &&
      Math.abs(dAbove.ducts[0].topM - 60) < 3,
    `2 K / 50-60 m duct: from 70 m the green minimum is a point - no ` +
      `flash, red flash at ${dAbove.redFlash?.aArcmin.toFixed(1)}'; from ` +
      `45 m (inside) the blank strip - no flash; the scan's duct top ` +
      `${dAbove.ducts[0].topM.toFixed(0)} m`
  );
  // The sub-duct flash (Young's Santa Ana model): eye just under
  // the duct floor sees minima "very nearly at the astronomical
  // horizon" and a flash "about three times the duration of a
  // normal flash" - here against the textbook second. A few
  // metres lower the minima are gone and only an extended rim
  // remains (his 131 m: "not a proper flash at all").
  const santa = mkProf((h) => {
    if (h >= 250) return 15 - 0.0065 * h;
    const tBase = 15 - 0.0065 * 250 - 15;
    if (h >= 200) return tBase + (15 * (h - 200)) / 50;
    return tBase + 0.0065 * (200 - h);
  });
  const sd = flashFromProfile(santa, {eyeM: 129, rateDegPerS: EQ});
  const sdLow = flashFromProfile(santa, {eyeM: 120, rateDegPerS: EQ});
  check(
    'FLASH sub-duct (Young)',
    sd.type === 'sub-duct' &&
      sd.flash &&
      sd.nakedEye &&
      Math.abs(sd.minG.aArcmin) < 3 &&
      sd.durationS > 2.5 * tb.durationS &&
      sd.durationS < 12 * tb.durationS &&
      sdLow.type === 'sub-duct' &&
      !sdLow.flash,
    `15 K / 200-250 m Santa Ana duct, eye 129 m (1 m under the green ` +
      `floor): minimum at ${sd.minG.aArcmin.toFixed(1)}' apparent - the ` +
      `astronomical horizon - lasting ${sd.durationS.toFixed(1)} s = ` +
      `${(sd.durationS / tb.durationS).toFixed(1)}x the textbook flash ` +
      `(Young: "about three times", with more green still to fade); at ` +
      `120 m the minima are gone - extended rim only, his too-low case`
  );
}

// ---- the Lehn retrieval, end to end ---------------------------
// The whole inverse-problem pipeline through the PANEL's own code
// path: a Whitefish-class day (Lehn's geometry - a +6 K inversion
// at 12-24 m over a 0-m station, dry arctic air) as daemon rows;
// the theme's Ciddor fan photographs it, lehn.js inverts the
// image alone, and the closure against the same rows' balloon
// must land. Day-invariant: the synthetic day is Lehn's, not the
// fixture's.
{
  const rows = [];
  let p = 1013.25;
  const tAt = (h) => {
    if (h >= 24) {
      if (h >= 60) return 3.55 - 0.0065 * (h - 60);
      return 3.73 + ((3.55 - 3.73) * (h - 24)) / 36;
    }
    if (h >= 12) return -2.27 + (6 * (h - 12)) / 12;
    return -2.03 - 0.02 * h;
  };
  let hPrev = 0;
  for (const h of [
    0, 4, 8, 12, 15, 18, 21, 24, 30, 40, 60, 120, 300, 800, 2000, 5000, 9000
  ]) {
    if (h > 0) {
      const tMean = (tAt(hPrev) + tAt(h)) / 2 + 273.15;
      p *= Math.exp((-(h - hPrev) * 9.80665 * 0.0289644) / (8.31451 * tMean));
    }
    rows.push({p, hM: h, tC: +tAt(h).toFixed(3), rh: 5});
    hPrev = h;
  }
  const r = retrievalPanel(rows);
  const ok =
    r.retrieved !== null &&
    r.distM === 20000 &&
    r.retrieved.rmsK < 1.3 &&
    r.retrieved.dTretr / r.retrieved.dTballoon > 0.5 &&
    r.retrieved.dTretr / r.retrieved.dTballoon < 1.05 &&
    r.retrieved.tcRmsM[7] < r.retrieved.tcRmsM[0] &&
    r.retrieved.probedTopM > 18 &&
    r.retrieved.probedTopM < 30;
  check(
    'LEHN RETRIEVAL closes on a Whitefish-class day',
    ok,
    r.retrieved
      ? `the fan folds at ${(r.distM / 1000).toFixed(0)} km (his own range); from the image + eye-level temperature alone the profile comes back to ` +
          `${r.retrieved.rmsK.toFixed(2)} K RMS over eye..${r.retrieved.probedTopM.toFixed(0)} m, warming ${r.retrieved.dTretr.toFixed(1)} K vs the balloon's ${r.retrieved.dTballoon.toFixed(1)} K over the probed span; TC error ${r.retrieved.tcRmsM[0].toFixed(0)} -> ${r.retrieved.tcRmsM[7].toFixed(0)} m`
      : `no retrieval: ${r.note}`
  );
}

// ---- the Lehn retrieval, elevated eye -------------------------
// The mirrored geometry end to end through the panel: an SD-like
// day (station 134 m, +4 K marine cap at 380-430 m) seen from the
// theme's 450-m ridge eye. The cascade must pick the ELEVATED
// mode (the S's pivot sits below the eye) and the Morrish-
// strategy fit must close on the balloon.
{
  const tSD = (z) =>
    z >= 430
      ? 18 - 0.0065 * (z - 450)
      : z >= 380
        ? 18 - 0.0065 * (430 - 450) - (4 * (430 - z)) / 50
        : 18 - 0.0065 * (430 - 450) - 4 - 0.0065 * (z - 380);
  const rows = [];
  let p = 1013.25;
  let hPrev = 134;
  for (const h of [
    134, 200, 280, 340, 380, 395, 410, 430, 450, 500, 600, 900, 1500, 3000, 6000
  ]) {
    if (h > 134) {
      const tMean = (tSD(hPrev) + tSD(h)) / 2 + 273.15;
      p *= Math.exp((-(h - hPrev) * 9.80665 * 0.0289644) / (8.31451 * tMean));
    }
    rows.push({p, hM: h, tC: +tSD(h).toFixed(3), rh: 30});
    hPrev = h;
  }
  const r = retrievalPanel(rows);
  const ok =
    r.retrieved !== null &&
    r.mode === 'elevated' &&
    r.eyeM === 450 &&
    Math.abs(r.retrieved.params.zBaseM - 380) < 8 &&
    Math.abs(r.retrieved.params.dTK - 4) < 0.5 &&
    r.retrieved.onePerigee &&
    r.retrieved.rmsK < 0.4;
  check(
    'LEHN RETRIEVAL, elevated: the ridge reads the marine cap',
    ok,
    r.retrieved
      ? `the 450-m eye's fan folds at ${(r.distM / 1000).toFixed(0)} km with the pivot BELOW the eye (mock geometry, auto-selected); the Morrish-strategy fit lands base ${r.retrieved.params.zBaseM.toFixed(1)} m (truth 380), +${r.retrieved.params.dTK.toFixed(2)} K (truth 4), closing on the balloon at ${r.retrieved.rmsK.toFixed(3)} K RMS down to ${r.retrieved.probedFloorM.toFixed(0)} m - the elevated coastal eye can now read the layer below it`
      : `declined: ${r.note}`
  );
}

// ---- the Lehn retrieval, superior fallback --------------------
// The 133rd pass end to end: an Oakland-class day - beach film
// (superadiabatic 0-10 m), isothermal marine layer, and a strong
// +15 K subsidence cap at 310-560 m right over the 300-m ridge
// eye - through the panel's cascade. The early 90-km graze fold
// must be attempted and REFUSED (first CLOSING fold wins, not
// first fold - the brittleness the live days taught: one graze
// ray's ground strike, moved metres by an rh difference, used to
// flip the whole outcome); at 130 km the zones starve and the
// 1986-strategy fallback recovers the cap and closes.
// Day-invariant: all hand numbers.
{
  const tOak = (h) =>
    h >= 560
      ? 32.6 - 0.0065 * (h - 560)
      : h >= 310
        ? 17.6 + (60 * (h - 310)) / 1000
        : h <= 10
          ? 21.6 - 0.4 * h
          : 17.6;
  const rows = [];
  let p = 1013.25;
  let hPrev = 0;
  for (const h of [
    0, 5, 10, 20, 50, 110, 180, 250, 310, 360, 420, 480, 560, 700, 1000, 2000,
    5000, 9000
  ]) {
    if (h > 0) {
      const tMean = (tOak(hPrev) + tOak(h)) / 2 + 273.15;
      p *= Math.exp((-(h - hPrev) * 9.80665 * 0.0289644) / (8.31451 * tMean));
    }
    rows.push({p, hM: h, tC: +tOak(h).toFixed(3), rh: 40});
    hPrev = h;
  }
  const r = retrievalPanel(rows, {eyesM: [2, 300]});
  const R = r.retrieved;
  const ok =
    R !== null &&
    r.mode === 'superior' &&
    R.method === 'fit' &&
    R.closes &&
    r.distM === 130000 &&
    r.eyeM === 300 &&
    Math.abs(R.params.zBaseM - 310) < 15 &&
    R.params.dTK > 10 &&
    R.params.dTK < 18 &&
    R.rmsK < 1.5 &&
    r.tried.some((t) => t.distM === 90000);
  check(
    'LEHN RETRIEVAL, superior fallback: the cascade closes the cap',
    ok,
    R
      ? `the 300-m eye's 90-km graze fold is attempted and refused (${r.tried.find((t) => t.distM === 90000)?.why ?? 'not tried'}); at ${(r.distM / 1000).toFixed(0)} km the zones starve and the parametric fallback lands base ${R.params.zBaseM.toFixed(0)} m (truth 310), +${R.params.dTK.toFixed(1)} K claimed vs the balloon's +${R.dTballoon.toFixed(1)} K over the same interval, closing at ${R.rmsK.toFixed(2)} K RMS over the fold-probed span - the cascade walks past the unretrievable fold to the one the image can defend`
      : `declined: ${r.note}`
  );
}

// ---- the Lehn retrieval, inferior film ------------------------
// The 134th pass end to end: Fleagle 1950's geometry through the
// panel's cascade. A super-autoconvective surface film (-240
// K/km over 10 m - printed-normal by Baum's Eq. 5) under an
// ordinary lapse, seen from the panel's own tower eye (22 m,
// above every balloon-resolvable film): the fold at 40 km
// classifies superior-band, the zones' claim is indicted by the
// endpoint-sampled closure (they read +14 K where the balloon
// cools), the warm families refuse, and the film fallback reads
// the layer Fleagle built his instrument for. Day-invariant:
// all hand numbers.
{
  const gF = -0.24;
  const hF = 10;
  const gB = -0.0065;
  const rawT = (z) => (z <= hF ? gF * z : gF * hF + gB * (z - hF));
  const offT = 18 - rawT(22);
  const rows = [];
  let p = 1013.25;
  let hPrev = 0;
  for (const h of [0, 2, 5, 10, 15, 25, 50, 120, 300, 1000, 3000, 9000]) {
    if (h > 0) {
      const tMean = (rawT(hPrev) + rawT(h)) / 2 + offT + 273.15;
      p *= Math.exp((-(h - hPrev) * 9.80665 * 0.0289644) / (8.31451 * tMean));
    }
    rows.push({p, hM: h, tC: +(rawT(h) + offT).toFixed(3), rh: 30});
    hPrev = h;
  }
  const r = retrievalPanel(rows);
  const R = r.retrieved;
  const ok =
    R !== null &&
    r.mode === 'inferior' &&
    R.method === 'fit' &&
    R.closes &&
    r.eyeM === 22 &&
    r.distM === 40000 &&
    Math.abs(R.params.gammaFilmKpM - gF) < 0.02 &&
    Math.abs(R.params.wM - hF) < 1.5 &&
    Math.abs(R.dTretr - gF * hF) < 0.3 &&
    R.rmsK < 0.5 &&
    r.tried.some((t) => t.why && t.why.startsWith('superior does not close'));
  check(
    'LEHN RETRIEVAL, inferior film: Fleagle reads the beach layer',
    ok,
    R
      ? `the 22-m tower eye's fold at ${(r.distM / 1000).toFixed(0)} km lands in the superior band; the zones' +14-K invention is indicted (${r.tried.find((t) => t.why?.startsWith('superior'))?.why ?? '?'}) and the film family reads ${(R.params.gammaFilmKpM * 1000).toFixed(0)} K/km over ${R.params.wM.toFixed(1)} m (truth ${gF * 1000}/${hF}), drop ${(-R.dTretr).toFixed(2)} K vs the balloon's ${(-R.dTballoon).toFixed(2)} K, closing at ${R.rmsK.toFixed(3)} K RMS - the third mirage family joins the instrument`
      : `declined: ${r.note}`
  );
}

// ---- the forecast ledger's pure parts -------------------------
// The page stores; these decide. The pairing identity IS the
// design: a station's 12Z ascent and the FOLLOWING 00Z ascent key
// to one local evening (the morning forecast and its evening
// verifier), while the next 12Z opens a new evening. Verdicts:
// Young's taxonomy is the claim, the duration its size.
{
  const pdt = 420;
  const pair =
    eveningKey('2026-08-09T12:00:00Z', pdt) === '2026-08-09' &&
    eveningKey('2026-08-10T00:00:00Z', pdt) === '2026-08-09' &&
    eveningKey('2026-08-10T12:00:00Z', pdt) === '2026-08-10' &&
    eveningKey('2026-08-10T00:00:00Z', 0) === '2026-08-10';
  const held = flashLedgerVerdict(
    {type: 'mock-mirage', durationS: 1.65},
    {type: 'mock-mirage', durationS: 1.5}
  );
  const revT = flashLedgerVerdict(
    {type: 'mock-mirage', durationS: 1.65},
    {type: 'textbook', durationS: 1.2}
  );
  const revD = flashLedgerVerdict(
    {type: 'textbook', durationS: 1.0},
    {type: 'textbook', durationS: 1.9}
  );
  const nulls = flashLedgerVerdict(
    {type: 'in-duct', durationS: null},
    {type: 'in-duct', durationS: null}
  );
  check(
    'FORECAST LEDGER pure parts',
    pair &&
      held.held &&
      !revT.held &&
      !revD.held &&
      nulls.held &&
      held.label.includes('held (mock-mirage') &&
      revT.label.includes('revised (mock-mirage'),
    `12Z and the following 00Z key to ONE local evening (PDT pair -> 2026-08-09; the next 12Z opens 2026-08-10; at Greenwich the 00Z belongs to its own date); same type within 0.5 s holds, a type change or a ${'>'}0.5-s drift revises, and matching null durations (flashless types) hold`
  );
}

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
{
  // The flash pins: tonight's prediction from the frozen ascent.
  // The sunset rate is pinned data, cross-checked here against an
  // INDEPENDENT engine sampling (airless altitudes +-60 s around
  // the sunset after the fixture stamp) - then the frozen rows
  // run through flashPanel at the research view's two eyes.
  const A = AstroEngine;
  const t0 = A.MakeTime(new Date(FIXTURE_AT.replace('Z', ':00Z')));
  const sunset = A.SearchRiseSet(A.Body.Sun, satObs, -1, t0, 2);
  const airless = (t) => {
    const eq = A.Equator(A.Body.Sun, t, satObs, true, true);
    return A.Horizon(t, satObs, eq.ra, eq.dec, null).altitude;
  };
  const rateEng =
    (airless(sunset.AddDays(-60 / 86400)) -
      airless(sunset.AddDays(60 / 86400))) /
    120;
  const rate = DAY_PINS.flash.rateArcsecS[0] / 3600;
  const flB = flashPanel(SOUNDING.rows, {eyeM: 15, rateDegPerS: rate});
  const flA = flashPanel(SOUNDING.rows, {eyeM: 450, rateDegPerS: rate});
  pinBlock(
    'flash',
    [
      ['rate "/s (engine)', rateEng * 3600, DAY_PINS.flash.rateArcsecS],
      ['beach type', flB.type, DAY_PINS.flash.beachType],
      ['beach s', flB.durationS, DAY_PINS.flash.beachS],
      ['aloft type', flA.type, DAY_PINS.flash.aloftType],
      ['aloft s', flA.durationS, DAY_PINS.flash.aloftS],
      ['aloft width "', flA.widthArcsec, DAY_PINS.flash.aloftWidth],
      ['aloft mag x', flA.magX, DAY_PINS.flash.aloftMagX],
      ["aloft app '", flA.appArcmin, DAY_PINS.flash.aloftAppArcmin],
      ['ducts', flA.ducts.length, DAY_PINS.flash.ducts]
    ],
    `sunset drops ${DAY_PINS.flash.rateArcsecS[0].toFixed(1)}"/s; beach ` +
      `${flB.type} ${flB.durationS?.toFixed(1)}s, 450 m ${flA.type} ` +
      `${flA.durationS?.toFixed(1)}s${flA.magX ? ' x' + flA.magX.toFixed(1) : ''}`
  );
}

{
  // The Lehn pins: what the frozen day's own column says to the
  // inverse problem. A sub-critical day declines (that refusal is
  // the pinned fact); a ducting day pins its closure numbers.
  const leh = retrievalPanel(SOUNDING.rows);
  pinBlock(
    'lehn',
    [
      ['eye', leh.eyeM, DAY_PINS.lehn.eyeM],
      ['dist', leh.distM, DAY_PINS.lehn.distM],
      ['declined', leh.retrieved === null, DAY_PINS.lehn.declined],
      ...(DAY_PINS.lehn.declined
        ? []
        : [
            ['rms K', leh.retrieved?.rmsK ?? null, DAY_PINS.lehn.rmsK],
            ['dT retr', leh.retrieved?.dTretr ?? null, DAY_PINS.lehn.dTretr],
            [
              'dT balloon',
              leh.retrieved?.dTballoon ?? null,
              DAY_PINS.lehn.dTballoon
            ],
            [
              'probed',
              leh.retrieved?.probedTopM ?? null,
              DAY_PINS.lehn.probedTopM
            ]
          ])
    ],
    DAY_PINS.lehn.declined
      ? `no superior mirage in the frozen column from eye ${leh.eyeM} m - ` +
          `the instrument declines rather than invent (the marine ` +
          `inversion is sub-critical: the flash pins carry ducts 0)`
      : `retrieved to ${leh.retrieved?.rmsK?.toFixed(2)} K RMS at ` +
          `${(leh.distM / 1000).toFixed(0)} km`
  );
}

// The marine surface layer on the frozen pier contrast (135th
// pass): the composed sea column's own numbers, pinned as data.
// Fixtures frozen before the pass carry no pier met and skip.
if (COOPS_MET && DAY_PINS.marine) {
  // the warm layer from the frozen day's own six-minute series under
  // the frozen hourly solar (139th pass; fixtures frozen earlier
  // carry neither and skip)
  const solarAt =
    typeof SOLAR_HOURLY !== 'undefined' && SOLAR_HOURLY
      ? solarInterpolator(SOLAR_HOURLY)
      : null;
  const warm =
    Array.isArray(COOPS_MET.series) && solarAt
      ? warmLayerDay(COOPS_MET.series, {
          zuM: COOPS_MET.zuM,
          ztM: COOPS_MET.ztM,
          lonDeg: COOPS_MET.lonDeg,
          latDeg: COOPS_MET.latDeg,
          zSensorM: COOPS_MET.waterSensorM ?? 3.4,
          dewC: COOPS_MET.shore?.dewC ?? null,
          cf: COOPS_MET.shore?.cf ?? 0,
          solarAt
        })
      : null;
  const mar = marinePanel(COOPS_MET, SOUNDING.rows, {
    bliM: null,
    shore: COOPS_MET.shore ?? null,
    latDeg: COOPS_MET.latDeg ?? null,
    warm
  });
  const P = DAY_PINS.marine;
  pinBlock(
    'marine',
    [
      ['stability', mar.stability, P.stability],
      ['air-sea K', mar.dTairSeaK, P.dTairSeaK],
      ['film K/km', mar.filmLapseKm, P.filmLapseKm],
      ['film drop K', mar.filmDropK, P.filmDropK],
      ['pier top', mar.pierTopM, P.pierTopM],
      ['join', mar.joinM, P.joinM],
      ['clamped', mar.clamped, P.clamped],
      [
        'model band',
        JSON.stringify(mar.modelBand),
        JSON.stringify(P.modelBand)
      ],
      // the skin (136th pass) - pinned since; older pins skip
      ...(P.skinK !== undefined
        ? [
            ['skin K', mar.skinK, P.skinK],
            ['air-skin K', mar.dTairSkinK, P.dTairSkinK],
            ['sky W/m2', mar.lwDnWm2, P.lwDnWm2],
            ['Q0 W/m2', mar.q0Wm2, P.q0Wm2],
            ['dew source', mar.dewSource, P.dewSource],
            ['sky source', mar.lwSource, P.lwSource]
          ]
        : []),
      // the pier's wind on the sea's footing (138th pass)
      ...(P.u10nMs !== undefined
        ? [
            ['wind measured m/s', mar.uMeasMs, P.uMeasMs],
            ['U10N m/s', mar.u10nMs, P.u10nMs],
            ['u(10 m) m/s', mar.u10Ms, P.u10Ms]
          ]
        : []),
      // the warm layer from the day's own series (139th pass)
      ...(P.warmK !== undefined
        ? [
            ['warm above sensor K', mar.warmK, P.warmK],
            ['warm surface K', mar.warmSurfaceK, P.warmSurfaceK],
            ['warm depth m', mar.warmDzM, P.warmDzM],
            ['day solar kWh/m2', mar.warmSolarKwhM2, P.warmSolarKwhM2]
          ]
        : []),
      // the bulk fluxes on COARE 3.6's own profile forms (140th
      // pass), the forms gated on PSL's measured ship hours
      ...(P.uStarMs !== undefined
        ? [
            ['profile forms', mar.forms, P.forms],
            ['first-pass rule', mar.k50, P.k50],
            ['u* m/s', mar.uStar, P.uStarMs],
            ['sensible W/m2', mar.hsbWm2, P.hsbWm2],
            ['latent W/m2', mar.hlbWm2, P.hlbWm2],
            ['stress N/m2', mar.tauNm2, P.tauNm2]
          ]
        : [])
    ],
    `${COOPS_MET.name}: air-sea ${mar.dTairSeaK >= 0 ? '+' : ''}${mar.dTairSeaK.toFixed(1)} K, ${mar.stability}, film ${mar.filmLapseKm.toFixed(0)} K/km in the lowest 10 m - ${mar.klass}; the mixed layer modelled over ${mar.modelBand ? mar.modelBand.map((z) => z.toFixed(0)).join('-') + ' m' : 'no band'}` +
      (P.skinK !== undefined
        ? `; skin ${mar.skinK.toFixed(2)} K cooler than the bulk (${mar.lwSource}; sky ${mar.lwDnWm2?.toFixed(0)} W/m2, loss ${mar.q0Wm2?.toFixed(0)} W/m2), humidity from ${mar.dewSource}`
        : '') +
      (P.u10nMs !== undefined
        ? `; the pier's ${mar.uMeasMs.toFixed(1)} m/s at ${mar.zuM.toFixed(1)} m is ${mar.u10nMs.toFixed(2)} m/s on the 10-m neutral footing (actual 10-m wind ${mar.u10Ms.toFixed(2)})`
        : '') +
      (P.warmK !== undefined
        ? mar.warmSurfaceK === null
          ? '; warm layer not integrated'
          : `; the day's warm layer holds ${mar.warmSurfaceK.toFixed(2)} K at the surface over ${mar.warmDzM.toFixed(1)} m (${mar.warmK.toFixed(2)} K above the ${(COOPS_MET.waterSensorM ?? 3.4).toFixed(1)}-m sensor) from ${mar.warmSolarKwhM2.toFixed(1)} kWh/m^2 of solar`
        : '') +
      (P.uStarMs !== undefined
        ? `; on ${mar.forms}'s forms u* ${mar.uStar.toFixed(4)} m/s, the sea losing ${mar.hsbWm2.toFixed(1)} W/m^2 sensible and ${mar.hlbWm2.toFixed(1)} latent under a stress of ${mar.tauNm2.toFixed(4)} N/m^2${mar.k50 ? ' (zeta_u > 50: the code keeps its first pass)' : ''}`
        : '')
  );
  // The sea column's own retrieval - the line the page prints for
  // this day. A non-closure is pinned as such: the composed
  // column's folds sit on the modelled band or read back far from
  // the balloon, and the instrument says so rather than lean.
  if (DAY_PINS.lehnSea) {
    const ls = retrievalPanel(mar.rows, {
      modelBand: mar.modelBand,
      distsM: SEA_RETRIEVAL_DISTS_M
    });
    const P = DAY_PINS.lehnSea;
    pinBlock(
      'lehnSea',
      [
        ['eye', ls.eyeM, P.eyeM],
        ['dist', ls.distM, P.distM],
        ['declined', ls.retrieved === null, P.declined],
        ...(P.declined
          ? []
          : [
              ['mode', ls.mode ?? null, P.mode],
              ['method', ls.retrieved?.method ?? null, P.method],
              ['closes', ls.retrieved?.closes ?? null, P.closes],
              ['rms K', ls.retrieved?.rmsK ?? null, P.rmsK],
              ['dT balloon', ls.retrieved?.dTballoon ?? null, P.dTballoon]
            ])
      ],
      P.declined
        ? `the sea column folds from no eye - the instrument declines`
        : `${ls.mode}/${ls.retrieved?.method} from ${ls.eyeM} m at ` +
            `${(ls.distM / 1000).toFixed(0)} km ` +
            (ls.retrieved?.closes
              ? `closes to ${ls.retrieved.rmsK.toFixed(2)} K RMS`
              : `does not close (${ls.retrieved?.rmsK?.toFixed(2)} K RMS) - ` +
                `reported as a non-closure, not a layer`)
    );
  }
}

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
