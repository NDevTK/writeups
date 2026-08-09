/**
 * observatory.js - the living snapshot: today's measured world
 * pushed through the repo's own gated machinery and returned as
 * drawable numbers. NO new physics lives here - every quantity
 * below is composed from modules that already carry their own
 * primaries and reference gates:
 *  - the COLUMN rides refraction.js (Ciddor n, Auer-Standish
 *    integration, transferCurve/foldCount - the 88th/92nd/98th
 *    passes): the latest radiosonde ascent, in the daemon's own
 *    row shape, answers "does today's air mirage, and how hard
 *    does tonight's sun squash?"
 *  - the SEA rides the Monahan & O'Muircheartaigh 1980 whitecap
 *    law the drawn ocean uses (terrain-tsl.js writes
 *    W = 3.84e-6 U^3.41 on the GPU; ocean-reference bisects it) -
 *    the CPU twin here answers "how much of the sea is foam right
 *    now?"
 *  - the WET GROUND rides wetground.js (Lekner & Dorf 1988, the
 *    112th pass): measured topsoil moisture and live rain from
 *    several cities land on the wet-vs-dry albedo curve.
 *  - the POLARIZED SKY rides rayleighpol.js (the doubling engine
 *    vs the Coulson-Natraj tables, passes 106-110): the current
 *    sun altitude and the measured aerosol optical depth give
 *    today's degree-of-polarization map, diluted exactly as the
 *    theme's skyPolLut dilutes it (w = tauR/(tauR+tauA)).
 *  - the CORONA rides kcorona.js (van de Hulst 1950, the 109th
 *    pass): today's SWPC active-region count sets the activity
 *    phase the client already uses (regions/12), and the K+F
 *    profiles say what totality would look like right now.
 * The fixture (observatory-fixture.js) freezes one real snapshot
 * so observatory-reference.mjs can pin these compositions in the
 * validation gate; harness/observatory.html draws the same
 * numbers live, falling back to the fixture feed-by-feed.
 */

import {
  ARCSEC,
  DEG,
  buildProfile,
  foldCount,
  refractionRad,
  standardProfile,
  transferCurve,
  R_EARTH_M
} from './refraction.js';
import {
  wetAlbedo,
  wetDarkenFactor,
  wetnessFrom,
  SOIL_SAT_M3M3
} from './wetground.js';
import {solveA1} from './rayleighpol.js';
import {
  coronaCdM2,
  coronaIlluminanceLux,
  coronaSurfB,
  fSurfB
} from './kcorona.js';
import {E0_LUX} from './adaptation.js';
import {E_FULL_RATIO} from './moonlight.js';
import {
  dLam,
  hourlyRate,
  SHOWERS,
  visibleRateFactor,
  zhrAt
} from './meteors.js';
import {mieCoefficients} from './aerosol.js';
import {closureRatios} from './closure.js';
import {appleman, FT_M} from './contrails.js';
import {
  fr3Regime,
  froude3,
  FR3_RES_HI,
  FR3_RES_LO,
  naturalWavelengthM,
  nBV,
  virtualTk
} from './leewave.js';
import {
  fitAmplitude,
  harmonicFit,
  synthesisSpeeds,
  tideSynth
} from './tides.js';

// The drawn ocean's whitecap coverage law (Monahan &
// O'Muircheartaigh 1980, W = 3.84e-6 U10^3.41) - the GPU copy
// lives in terrain-tsl.js and ocean-reference.mjs bisects it;
// this is the same law as a callable for the instrument.
export function monahanW(u10Ms) {
  const u = Math.max(u10Ms, 0);
  return Math.min(3.84e-6 * Math.pow(u, 3.41), 0.6);
}

/** The theme's applySounding row mapping, verbatim: daemon rows
 * [{p hPa, hM, tC, rh %}] -> the gated buildProfile. */
export function profileFromRows(rows) {
  const lv = rows
    .filter((q) => q.hM > rows[0].hM + 0.5)
    .map((q) => ({pPa: q.p * 100, hM: q.hM, tC: q.tC, rh: (q.rh ?? 0) / 100}));
  return buildProfile(lv, {
    hM: rows[0].hM,
    tC: rows[0].tC,
    rh: (rows[0].rh ?? 0) / 100
  });
}

/**
 * THE COLUMN: the measured ascent against the ICAO standard.
 * Returns the low-level temperature series, the inversion
 * headline, and per-observer transfer diagnostics: fold counts
 * (each fold is an inverted image in the fan - foldCount's own
 * definition), horizon refraction vs the ISA at the same eye,
 * the sunset flattening d(app)/d(true) at the apparent horizon,
 * and the green rim (0.44 um vs 0.68 um refraction split).
 */
export function columnPanel(rows, {obsHms = [15, 450], topM = 3000} = {}) {
  const profile = profileFromRows(rows);
  const isa = standardProfile();
  const temps = rows
    .filter((q) => q.hM <= topM)
    .map((q) => ({hM: q.hM, tC: q.tC, dwptC: dewpointC(q.tC, q.rh)}));
  // The inversion headline: warmest level below 2.5 km vs surface.
  let tMax = rows[0];
  for (const q of rows) {
    if (q.hM > 2500) break;
    if (q.tC > tMax.tC) tMax = q;
  }
  const observers = obsHms.map((obsHm) => {
    // The apparent-altitude window follows the eye: from just
    // under the dip (k ~ 1.2 standard) to +1 degree.
    const dipRad = Math.sqrt((2 * Math.max(obsHm, 2)) / (R_EARTH_M / 1.2));
    const t = transferCurve(
      profile,
      obsHm,
      -(dipRad + 0.35 * DEG),
      1 * DEG,
      240
    );
    const folds = foldCount(t.tG);
    const r0 = refractionRad(0, profile, 0.55, obsHm);
    const r0Isa = refractionRad(0, isa, 0.55, obsHm);
    // Flattening at the apparent horizon: d(app)/d(true) by
    // central difference across the a = 0 row of the curve.
    let i0 = 0;
    for (let i = 0; i < t.a.length; i++)
      if (Math.abs(t.a[i]) < Math.abs(t.a[i0])) i0 = i;
    const i1 = Math.max(1, Math.min(t.a.length - 2, i0));
    const flatten = (t.a[i1 + 1] - t.a[i1 - 1]) / (t.tG[i1 + 1] - t.tG[i1 - 1]);
    const rimArcsec =
      (refractionRad(0, profile, 0.44, obsHm) -
        refractionRad(0, profile, 0.68, obsHm)) /
      ARCSEC;
    return {
      obsHm,
      folds,
      r0Arcmin: r0 / ARCSEC / 60,
      r0IsaArcmin: r0Isa / ARCSEC / 60,
      flatten,
      rimArcsec,
      curve: {
        aDeg: Array.from(t.a, (v) => v / DEG),
        tRDeg: Array.from(t.tR, (v) => v / DEG),
        tGDeg: Array.from(t.tG, (v) => v / DEG),
        tBDeg: Array.from(t.tB, (v) => v / DEG),
        vis: Array.from(t.vis)
      }
    };
  });
  return {
    temps,
    surface: {hM: rows[0].hM, tC: rows[0].tC},
    inversion: {hM: tMax.hM, tC: tMax.tC, dT: tMax.tC - rows[0].tC},
    observers
  };
}

/** Magnus dewpoint (display only - the optics reads rh). */
function dewpointC(tC, rhPct) {
  const rh = Math.min(Math.max(rhPct ?? 0, 0.1), 100);
  const g = Math.log(rh / 100) + (17.62 * tC) / (243.12 + tC);
  return (243.12 * g) / (17.62 - g);
}

/**
 * THE SEA: the whitecap law with today's wind on it, plus the
 * measured sea state carried through for the caption.
 */
export function seaPanel({u10Ms, wvhtM, dpdS, wtmpC}, uMax = 20) {
  const curve = [];
  for (let u = 0; u <= uMax + 1e-9; u += 0.25) curve.push({u, W: monahanW(u)});
  return {curve, u10Ms, W: monahanW(u10Ms), wvhtM, dpdS, wtmpC};
}

/**
 * THE WET GROUND: the Lekner-Dorf wet-vs-dry albedo curve, its
 * gloss-floor crossover, and each city's measured wetness state
 * landed on the client's own darkening factor at the stated
 * display albedo.
 */
export function wetPanel(cities, {rhoDisplay = 0.2} = {}) {
  const curve = [];
  for (let i = 0; i <= 120; i++) {
    const rho = 0.005 + (i / 120) * (0.9 - 0.005);
    curve.push({rho, wet: wetAlbedo(rho)});
  }
  // The sign-change floor (wet coal glints), bisected as the
  // reference does.
  let lo = 0.001;
  let hi = 0.2;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (wetAlbedo(mid) > mid) lo = mid;
    else hi = mid;
  }
  const rows = cities.map((c) => {
    const w = wetnessFrom(c.soilM3M3, c.precipMm);
    return {
      ...c,
      w,
      raining: Number.isFinite(c.precipMm) && c.precipMm >= 0.1,
      factor: wetDarkenFactor(rhoDisplay, w)
    };
  });
  return {curve, crossRho: (lo + hi) / 2, rhoDisplay, rows, SOIL_SAT_M3M3};
}

/**
 * THE POLARIZED SKY: the doubling engine solves the molecular
 * dome at the current sun, and the measured aerosol dilutes the
 * degree of polarization exactly as skyPolLut dilutes its water
 * factor: p_today = w p_Rayleigh, w = tauR/(tauR+tauA) at the
 * green channel. Aerosol optical depth arrives measured at
 * 550 nm; the map is the green channel, so no spectral transfer
 * is invented here.
 */
export function polPanel({
  sunAltDeg,
  aod550,
  tauRGreen = 0.1085,
  depol = 0.03,
  nGauss = 10,
  nDouble = 20,
  vzaStep = 4,
  dphiStep = 7.5
}) {
  const vza = [];
  for (let v = 0; v <= 88; v += vzaStep) vza.push(v);
  const dphi = [];
  for (let d = 0; d <= 180 + 1e-9; d += dphiStep) dphi.push(d);
  const mu0 = Math.cos((90 - sunAltDeg) * DEG);
  const sol = solveA1({
    tau: tauRGreen,
    depol,
    mu0,
    vzaDownDeg: vza,
    vzaUpDeg: [],
    dphiDeg: dphi,
    nGauss,
    nDouble
  });
  const w = tauRGreen / (tauRGreen + Math.max(aod550, 0));
  const dopPure = [];
  let max = {dop: 0, vza: 0, dphi: 0};
  for (let i = 0; i < vza.length; i++) {
    const row = [];
    for (let j = 0; j < dphi.length; j++) {
      const r = sol[i * dphi.length + j];
      const p = Math.hypot(r.Q, r.U) / Math.max(r.I, 1e-12);
      row.push(p);
      if (p > max.dop) max = {dop: p, vza: vza[i], dphi: dphi[j]};
    }
    dopPure.push(row);
  }
  // Scattering angle at the maximum (the Rayleigh 90-degree lobe
  // should own it).
  const ts = (90 - sunAltDeg) * DEG;
  const tv = max.vza * DEG;
  const cosTh =
    Math.cos(tv) * Math.cos(ts) +
    Math.sin(tv) * Math.sin(ts) * Math.cos(max.dphi * DEG);
  return {
    vza,
    dphi,
    dopPure,
    w,
    sunAltDeg,
    aod550,
    maxPure: max.dop,
    maxToday: max.dop * w,
    maxAt: {vza: max.vza, dphi: max.dphi, scatDeg: Math.acos(cosTh) / DEG}
  };
}

/**
 * THE CORONA: today's active-region count through the client's
 * own phase mapping (regions/12, the kcorona setup), onto the
 * van de Hulst K profiles with the F corona alongside - in
 * mean-disc units and cd/m^2 - and the whole-corona illuminance
 * in full moons.
 */
export function coronaPanel({regionCount}) {
  const phase = Math.min(1, Math.max(0, regionCount / 12));
  const rs = [];
  for (let i = 0; i <= 47; i++) rs.push(1.02 * Math.pow(6 / 1.02, i / 47));
  const profiles = rs.map((r) => ({
    r,
    eq: coronaSurfB(r, 'eq', phase),
    pole: coronaSurfB(r, 'pole', phase),
    f: fSurfB(r),
    eqCd: coronaCdM2(r, 'eq', phase)
  }));
  const lux = coronaIlluminanceLux(phase);
  return {
    phase,
    regionCount,
    profiles,
    lux,
    moons: lux / E0_LUX / E_FULL_RATIO
  };
}

/**
 * THE PERSEIDS (or any coded shower): the printed IMO/Jenniskens
 * calendar (meteors.js SHOWERS, the double-exponential activity
 * profile) against the LIVE Global Meteor Network count share -
 * yesterday's measured meteors by shower, the daemon's own
 * medians digest - plus tonight's expected visible rate at the
 * point through the gated zenith and perception corrections
 * (hourlyRate, visibleRateFactor). lamSunDeg and the radiant
 * altitude come from the caller (the astronomy engine owns
 * time -> geometry).
 */
export function meteorsPanel({
  code = 'PER',
  lamSunDeg,
  gmnMedians = null,
  radiantAltRad = null,
  lms = [6.5, 5.0],
  lamHalfSpanDeg = 14
}) {
  const s = SHOWERS.find((q) => q.code === code);
  const curve = [];
  for (let i = 0; i <= 140; i++) {
    const lam = s.lam - lamHalfSpanDeg + (i / 140) * 2 * lamHalfSpanDeg;
    // Solar longitude advances 360/365.2422 deg per day - the
    // calendar axis in days from the peak.
    curve.push({
      lam,
      days: dLam(lam, s.lam) / (360 / 365.2422),
      zhr: zhrAt(s, lam)
    });
  }
  const zhrNow = zhrAt(s, lamSunDeg);
  const daysToPeak = -dLam(lamSunDeg, s.lam) / (360 / 365.2422);
  // The measured side: shower shares of yesterday's GMN count.
  let shares = null;
  if (gmnMedians && gmnMedians.all?.n > 0) {
    shares = Object.entries(gmnMedians)
      .filter(([k]) => k !== 'all')
      .map(([k, v]) => ({code: k, n: v.n, share: v.n / gmnMedians.all.n}))
      .sort((a, b) => b.n - a.n);
  }
  const rates = lms.map((lm) => ({
    lm,
    perHour:
      radiantAltRad != null
        ? hourlyRate(zhrNow, radiantAltRad) * visibleRateFactor(s.r, lm)
        : null
  }));
  return {shower: s, curve, lamSunDeg, zhrNow, daysToPeak, shares, rates};
}

/**
 * THE AURORA SUPPLY: the measured hemispheric power (SWPC
 * OVATION, 5-minute cadence - the same file the theme scales its
 * drawn curtain by, emission linear in precipitating power) as a
 * day-long history, the OVATION oval's probability on the
 * point's meridian (the theme's own extraction as a pure
 * function), and the live Kp. Parsers here are the instrument's
 * only code: no physics.
 */
export function parseHemiPower(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const p = line.trim().split(/\s+/);
    if (p.length < 4) continue;
    const at = p[0].replace('_', 'T') + 'Z';
    const n = parseInt(p[2], 10);
    const s = parseInt(p[3], 10);
    if (Number.isFinite(n)) rows.push({at, gwN: n, gwS: s});
  }
  return rows;
}

/** The theme's oval extraction, pure: strongest probability
 * within 3 deg of the meridian on the northern hemisphere. */
export function ovationAtMeridian(coords, lonDeg) {
  const our = ((lonDeg % 360) + 360) % 360;
  let best = 0;
  let bestLat = null;
  for (const [lo, la, val] of coords) {
    if (la < 0) continue;
    let dl = Math.abs(lo - our);
    if (dl > 180) dl = 360 - dl;
    if (dl > 3) continue;
    if (val > best) {
      best = val;
      bestLat = la;
    }
  }
  return {p: best / 100, latDeg: bestLat};
}

export function auroraPanel({hemiText, ovationCoords, lonDeg, kpEst}) {
  const history = parseHemiPower(hemiText);
  const latest = history[history.length - 1] ?? null;
  const ov = ovationCoords ? ovationAtMeridian(ovationCoords, lonDeg) : null;
  return {history, latest, ov, kpEst};
}

/**
 * THE DOME AUDITS ITSELF: the 91st pass's radiative closure, run
 * on the CURRENT measured irradiance - the drawn dome's beam and
 * diffuse integrals (closure.js, luminous-efficacy bridge and
 * all) against the measured GHI/direct/diffuse at the point,
 * every load. The aerosol enters as the closure reference's own
 * gray set at the MEASURED 550 nm depth (stated: one measured
 * number, no invented spectrum).
 */
export function closurePanel({
  sunAltDeg,
  aod550,
  ghiWm2,
  dirWm2,
  difWm2,
  eyeHM = 0
}) {
  const mie = mieCoefficients(
    {
      tau: [aod550, aod550, aod550],
      ssa: [0.9, 0.9, 0.9],
      g: 0.8
    },
    eyeHM
  );
  const r = closureRatios({
    sunAltRad: sunAltDeg * DEG,
    mieRad: mie,
    eyeHM,
    ghiWm2,
    dirWm2,
    difWm2
  });
  return {sunAltDeg, aod550, ratios: r};
}

/**
 * THE CONTRAIL LAYER: the Schmidt-Appleman criterion
 * (contrails.js, the exact tangency construction the theme
 * already applies at its single 250 hPa level) run over EVERY
 * measured level of the ascent between 500 and 100 hPa - the
 * ice-supersaturated layer that contrail-avoidance research
 * reroutes around, read straight off today's balloon. A trail
 * FORMS where T <= T_LC at the measured humidity; it PERSISTS
 * where it forms into ice-supersaturated air (RHi > 1). Bands
 * are the longest contiguous height runs of each. The live
 * ADS-B state vectors (the daemon's readsb digest, alt_baro in
 * feet - the module's own exact FT_M) then say who is actually
 * up there writing.
 */
export function contrailPanel(rows, {ac = null, eta = 0.3} = {}) {
  const levels = rows
    .filter((q) => q.p <= 500 && q.p >= 100)
    .map((q) => ({
      ...q,
      a: appleman(q.p * 100, q.tC, (q.rh ?? 0) / 100, eta)
    }));
  const run = (flag) => {
    let best = null;
    let cur = null;
    for (const q of levels) {
      if (flag(q)) {
        if (!cur) cur = {loM: q.hM, hiM: q.hM, n: 0};
        cur.hiM = q.hM;
        cur.n++;
        if (!best || cur.hiM - cur.loM > best.hiM - best.loM) best = cur;
      } else cur = null;
    }
    return best;
  };
  const formBand = run((q) => q.a.forms);
  // The ice-supersaturated layer on its own (RHi > 1, whether or
  // not a trail can form there) - natural-cirrus-capable air, the
  // region the avoidance literature maps...
  const issrBand = run((q) => q.a.persists);
  // ...and the overlap: where a trail both forms AND lands in
  // supersaturated air. Empty whenever the two bands miss.
  const persistBand = run((q) => q.a.forms && q.a.persists);
  // The theme's own level: the measured row nearest 250 hPa.
  let l250 = levels[0] ?? null;
  for (const q of levels)
    if (Math.abs(q.p - 250) < Math.abs(l250.p - 250)) l250 = q;
  // How close the column comes to ice saturation, and where -
  // the margin the avoidance literature watches - plus every
  // supersaturated level individually (thin sheets survive the
  // daemon's row thinning as single levels).
  let maxRhi = null;
  for (const q of levels)
    if (!maxRhi || q.a.rhi > maxRhi.rhi) maxRhi = {rhi: q.a.rhi, hM: q.hM};
  const issrLevels = levels
    .filter((q) => q.a.persists)
    .map((q) => ({hM: q.hM, rhi: q.a.rhi}));
  let aircraft = null;
  if (Array.isArray(ac)) {
    const list = ac
      .filter((q) => Number.isFinite(q.alt_baro))
      .map((q) => ({...q, altM: q.alt_baro * FT_M}));
    aircraft = {
      n: list.length,
      maxAltM: list.reduce((m, q) => Math.max(m, q.altM), 0),
      inForm: formBand
        ? list.filter((q) => q.altM >= formBand.loM && q.altM <= formBand.hiM)
            .length
        : 0,
      inPersist: persistBand
        ? list.filter(
            (q) => q.altM >= persistBand.loM && q.altM <= persistBand.hiM
          ).length
        : 0,
      list
    };
  }
  return {
    levels,
    formBand,
    issrBand,
    issrLevels,
    persistBand,
    l250,
    maxRhi,
    aircraft,
    eta
  };
}

/**
 * THE WAVE LADDER: Stull's ch. 17 machinery (leewave.js - exact
 * virtual temperature, eq. 5.4a Brunt-Vaisala, eq. 17.30 natural
 * wavelength, eq. 17.32 Froude regime - the same chain the theme
 * runs against its DEM-hunted ridge) applied per-level to the
 * measured ascent, WITHOUT the terrain hunt: for every stable
 * wind-bearing level, the wavelength today's air would oscillate
 * at, and the ridge-width window [lam/4, lam] that would resonate
 * it into standing lenticular rows (Fr3 = lam/2w in the printed
 * 0.5..2.0 band). The panel answers the glider pilot's question -
 * "would MY ridge work today?" - from the balloon alone; the
 * theme's own DEM verdict stays in the theme.
 */
export function leewavePanel(rows, {zLoM = 400, zHiM = 7000} = {}) {
  const wr = rows.filter(
    (q) =>
      q.hM >= zLoM &&
      q.hM <= zHiM &&
      Number.isFinite(q.drct) &&
      Number.isFinite(q.spdMs)
  );
  const levels = [];
  for (let i = 1; i < wr.length - 1; i++) {
    const a = wr[i - 1];
    const q = wr[i];
    const b = wr[i + 1];
    if (!(b.hM > a.hM)) continue;
    const lapse = (b.tC - a.tC) / (b.hM - a.hM);
    const tv = virtualTk(q.tC, (q.rh ?? 0) / 100, q.p * 100);
    const n = nBV(tv, lapse);
    const lamM = n && q.spdMs > 0.5 ? naturalWavelengthM(q.spdMs, n) : null;
    levels.push({
      hM: q.hM,
      uMs: q.spdMs,
      dirFrom: q.drct,
      nBv: n,
      lamM,
      wLoM: lamM ? lamM / (2 * FR3_RES_HI) : null,
      wHiM: lamM ? lamM / (2 * FR3_RES_LO) : null
    });
  }
  // The vector-mean wind of the classic crest layer (1-3 km) -
  // arithmetic, the theme's own leeLayerWind form.
  let u = 0;
  let v = 0;
  let s = 0;
  let n = 0;
  for (const q of wr) {
    if (q.hM < 1000 || q.hM > 3000) continue;
    const a = (q.drct * Math.PI) / 180;
    u += -q.spdMs * Math.sin(a);
    v += -q.spdMs * Math.cos(a);
    s += q.spdMs;
    n++;
  }
  // Vector mean vs scalar mean: when they differ the layer's
  // winds are swirling, and no single ridge faces the flow.
  const layer =
    n >= 2
      ? {
          mMs: Math.hypot(u / n, v / n),
          scalarMs: s / n,
          dirFrom: ((Math.atan2(-u / n, -v / n) * 180) / Math.PI + 360) % 360,
          n
        }
      : null;
  // The spotlight level: nearest wave-capable level to 2 km (a
  // typical ridge-crest height, stated).
  let spot = null;
  for (const q of levels)
    if (q.lamM && (!spot || Math.abs(q.hM - 2000) < Math.abs(spot.hM - 2000)))
      spot = q;
  return {levels, layer, spot, fr3: {lo: FR3_RES_LO, hi: FR3_RES_HI}};
}

// The short-period constituents a 30-day hourly window resolves
// (every pair separated by more than the Rayleigh 0.5 deg/hr of
// a 720 h record; P1 hides inside K1 and NU2 inside N2 at this
// length - stated, not fitted).
export const TIDE_FIT_NAMES = ['M2', 'S2', 'N2', 'K1', 'O1', 'M4'];

/**
 * THE SURGE GAUGE: the 57th pass's Schureman machinery
 * (tides.js - the printed constituent speeds, the least-squares
 * harmonic fit, the synthesis) run on the LIVE gauge: fit the
 * first fitHours of the measured hourly record, synthesize
 * across the whole window, and read the residual - the
 * non-tidal, weather-driven part of the water level. The last
 * hours' residual IS the surge right now.
 */
export function tidePanel(
  {values, stepHours = 1},
  {fitHours = 600, names = TIDE_FIT_NAMES, published = null} = {}
) {
  const speeds = synthesisSpeeds(names);
  const nFit = Math.min(fitHours / stepHours, values.length);
  const fit = harmonicFit(values.slice(0, nFit), speeds, stepHours);
  const synth = values.map((_, i) => tideSynth(fit, i * stepHours));
  const resid = values.map((v, i) => v - synth[i]);
  const rms = (arr) =>
    Math.sqrt(arr.reduce((s, v) => s + v * v, 0) / arr.length);
  const out = resid.slice(nFit);
  let maxAbs = {v: 0, i: nFit};
  for (let i = nFit; i < resid.length; i++)
    if (Math.abs(resid[i]) > Math.abs(maxAbs.v)) maxAbs = {v: resid[i], i};
  // The cross-closure column: NOAA's own long-record constants
  // beside the 25-day fit. Published amplitudes are MEAN (nodal
  // corrections divided out), the raw fit is at THIS epoch - so
  // the ratio fitted/published carries the 18.6-year nodal
  // factor of the moment (plus each row's sub-Rayleigh lump).
  const amps = names.map((n) => {
    const ampM = fitAmplitude(fit, n, names);
    const pub = published?.[n]?.ampM;
    return {
      n,
      ampM,
      pubM: Number.isFinite(pub) ? pub : null,
      ratio: Number.isFinite(pub) && pub > 0 ? ampM / pub : null
    };
  });
  return {
    names,
    amps,
    fit,
    nFit,
    synth,
    resid,
    rmsFitM: rms(resid.slice(0, nFit)),
    rmsOutM: out.length ? rms(out) : null,
    maxAbsOut: maxAbs,
    latestResidM: resid[resid.length - 1]
  };
}
