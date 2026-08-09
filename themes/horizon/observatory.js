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
