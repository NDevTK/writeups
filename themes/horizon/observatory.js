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
  ductScan,
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
import {parseTLEs, satMagnitude, sunlitEci} from './sats.js';
import {rayFan} from './far-terrain.js';
import {fleagleFitFilm} from './fleagle.js';
import {AUTOCONVECTIVE_K_PER_M} from './fleagle.js';
import {eSatPa, marineColumnRows, moBulk} from './surfacelayer.js';
import {coolSkin, lwDown, lwDownDefault} from './coolskin.js';
import {localSeconds, warmLayerInit, warmLayerStep} from './warmlayer.js';
import {
  lehnFitElevated,
  lehnFitSuperior,
  lehnInvertTC,
  tcCriticalPoints
} from './lehn.js';

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
 * THE GREEN FLASH PREDICTOR (Young, aty.sdsu.edu, read in full):
 * tonight's flash type and duration from the measured column.
 * Everything is read off the wavelength-split transfer curves the
 * repo already ray-traces (refraction.js) plus the duct scan -
 * Young's frame, quantified:
 *  - "if there's a smooth minimum in the transfer curves, there
 *    will be a green flash when the Sun's upper limb reaches that
 *    true altitude" (his transfer-curve page, the general
 *    principle). The upper limb crosses the RED minimum first
 *    (red image gone) and the GREEN minimum second (flash over),
 *    and true altitude is nearly linear in time near the horizon,
 *    so duration = (minTrue_red - minTrue_green) / sunset rate.
 *    His own sub-duct numbers close on this: 0.5' of true
 *    altitude at the equatorial rate (15"/s) is his printed "two
 *    seconds (near the equator) or three (at about 50 deg)".
 *  - flash WIDTH by his tangent construction: the horizontal
 *    tangent at the red minimum cuts the green curve at two
 *    apparent altitudes; their gap is the flash's apparent size.
 *  - taxonomy by curve + duct geometry: textbook (no minimum -
 *    the bare rim, sub-naked-eye at a sea horizon per Dietze),
 *    inferior-mirage (superadiabatic surface, minimum at the
 *    fold), mock-mirage (elevated inversion below eye; a broad
 *    maximum left of the minimum = the preceding red flash),
 *    ducted-mock-mirage (eye above a duct: the minimum is drawn
 *    to a point - red flash only, no green), in-duct (Wegener's
 *    blank strip - no flash), sub-duct (eye under the duct floor:
 *    deep green-vs-red minima split, "the most spectacular",
 *    about three times a normal flash's duration).
 * The sunset RATE is injected (deg of true altitude per second,
 * positive; the astronomy engine owns sun kinematics) - with no
 * rate the panel still classifies, durations null.
 */
export function flashFromProfile(
  profile,
  {eyeM = 15, rateDegPerS = null, fast = false} = {}
) {
  const eye = Math.max(eyeM, profile.h0 + 2);
  const dipRad = Math.sqrt((2 * (eye - profile.h0 + 2)) / (R_EARTH_M / 1.2));
  // Ducts first: rays grazing a super-critical layer make the
  // refraction integrand near-singular INSIDE the inversion, far
  // from the anchor where the sqrt substitution protects it - at
  // the everyday node count the whole duct region is noise and
  // the sub-duct minima (Young: "very nearly at the astronomical
  // horizon") simply do not exist. Duct days buy reference-grade
  // nodes; duct-free days (San Diego's usual) stay cheap - and
  // the page's live view (fast) cheaper still, cached per ascent.
  const ducts = ductScan(profile, {topM: Math.min(eye + 3000, 5000)});
  const nRows = ducts.length ? 600 : fast ? 500 : 900;
  const N = ducts.length ? 2400 : fast ? 240 : 400;
  const t = transferCurve(
    profile,
    eye,
    -(dipRad + 0.45 * DEG),
    0.6 * DEG,
    nRows,
    N
  );
  let first = 0;
  while (first < nRows - 1 && !t.vis[first]) first++;
  const rowRad = t.a[1] - t.a[0];
  // The per-row integrals still carry ~1" jitter, so extrema are
  // read off lightly smoothed curves (3-point boxcar - well under
  // the 24"-wide weak-mock dip, far under arcmin duct structure)
  // and only count with real prominence.
  const smooth = (arr) => {
    const out = Float64Array.from(arr);
    for (let i = first; i < nRows; i++) {
      let s = 0;
      let n = 0;
      for (
        let k = Math.max(first, i - 1);
        k <= Math.min(nRows - 1, i + 1);
        k++
      ) {
        s += arr[k];
        n++;
      }
      out[i] = s / n;
    }
    return out;
  };
  const gS = smooth(t.tG);
  const rS = smooth(t.tR);
  const PROM = 6 * ARCSEC;
  // Interior local minima of the green curve with prominence: the
  // flash minima of Young's principle. (The global minimum is the
  // sea-horizon graze - the disk keeps setting below a mock-mirage
  // line - so argmin is NOT the flash.)
  // Skip the arcminute just above the sea horizon: the graze zone
  // flips between ray families row to row (an alternation
  // artifact, not structure), and no flash minimum lives at the
  // horizon itself - the inferior-mirage fold sits arcminutes up.
  const skipTo = first + Math.max(4, Math.round((60 * ARCSEC) / rowRad));
  const localMins = (arr) => {
    const out = [];
    for (let i = skipTo; i < nRows - 4; i++) {
      if (arr[i] > arr[i - 1] || arr[i] > arr[i + 1]) continue;
      if (out.length && i - out[out.length - 1].i < 4) continue;
      let rise = Infinity;
      for (const dir of [-1, 1]) {
        let best = 0;
        for (let k = i + dir; k >= first && k < nRows; k += dir) {
          if (arr[k] < arr[i]) break;
          best = Math.max(best, arr[k] - arr[i]);
        }
        rise = Math.min(rise, best);
      }
      if (rise >= PROM) out.push({i, prom: rise});
    }
    return out;
  };
  const mins = localMins(gS);
  let iG = -1;
  let prom = 0;
  for (const m of mins)
    if (m.prom > prom) {
      prom = m.prom;
      iG = m.i;
    }
  const interior = iG >= 0;
  // The matched red minimum: the red curve's OWN local minimum of
  // the same structure (Young reads the flash between the red and
  // green minima; a windowed argmin slides onto the sea-horizon
  // branch and collapses the split). Fallback when red has no
  // minimum there: the red curve's value at the green minimum.
  let iR = -1;
  if (interior) {
    const minsR = localMins(rS);
    let bestD = 151;
    for (const m of minsR) {
      const d = Math.abs(m.i - iG);
      if (d < bestD) {
        bestD = d;
        iR = m.i;
      }
    }
  }
  const dIn = ducts.find((d) => eye >= d.floorM && eye < d.topM) ?? null;
  const dBelowEye = [...ducts].reverse().find((d) => d.topM <= eye) ?? null;
  const dOverhead = ducts.find((d) => d.floorM > eye) ?? null;
  // Profile signatures for the inferior/mock split.
  const T = (h) => profile.at(h).tC;
  const infSig = T(profile.h0) - T(profile.h0 + 5) > 0.3;
  let mockSig = false;
  for (let h = profile.h0 + 5; h + 5 <= eye; h += 5)
    if (T(h + 5) - T(h) > 0.05) mockSig = true;
  // Position helper: is the flash minimum in the lowest quarter of
  // the visible window (the miraged strip at the sea horizon)?
  const lowQuarter = interior && t.a[iG] < t.a[first] + 0.25 * (0 - t.a[first]);
  // ---- classify (Young's taxonomy) ----
  let type;
  let flash;
  let nakedEye = false;
  const notes = [];
  if (dIn) {
    type = 'in-duct';
    flash = false;
    notes.push(
      `eye inside the duct (${dIn.floorM.toFixed(0)}-${dIn.topM.toFixed(0)} m): Wegener's blank strip, no green flash`
    );
  } else if (dBelowEye && !(interior && infSig && lowQuarter)) {
    type = 'ducted-mock-mirage';
    flash = false;
    notes.push(
      `duct below eye (top ${dBelowEye.topM.toFixed(0)} m): the green minimum is drawn to a point - red flash only ("in practice, these sunsets never produce green flashes")`
    );
  } else if (interior && dOverhead) {
    type = 'sub-duct';
    flash = true;
    nakedEye = true;
    const fR = ductScan(profile, {
      lambdaUm: 0.68,
      topM: Math.min(eye + 3000, 5000)
    }).find((d) => d.floorM > eye);
    const fB = ductScan(profile, {
      lambdaUm: 0.44,
      topM: Math.min(eye + 3000, 5000)
    }).find((d) => d.floorM > eye);
    notes.push(
      `eye ${(dOverhead.floorM - eye).toFixed(0)} m under the duct floor (green ${dOverhead.floorM.toFixed(1)} m` +
        (fR && fB
          ? `; red ${fR.floorM.toFixed(1)}, blue ${fB.floorM.toFixed(1)} m - the floor is lower in blue`
          : '') +
        `): the most spectacular flash, metre-sensitive to eye height`
    );
  } else if (!interior && dOverhead) {
    type = 'sub-duct';
    flash = false;
    notes.push(
      `eye ${(dOverhead.floorM - eye).toFixed(0)} m under the duct floor but no transfer-curve minimum: extended green rim only (too low)`
    );
  } else if (interior && infSig && (lowQuarter || !mockSig)) {
    type = 'inferior-mirage';
    flash = true;
    nakedEye = true;
    notes.push(
      'superadiabatic surface layer: the Omega sunset; flash at the fold where erect and inverted images join' +
        (dBelowEye ? " (below the overhead duct's strip)" : '')
    );
  } else if (interior) {
    type = 'mock-mirage';
    flash = true;
    nakedEye = true;
    notes.push(
      mockSig
        ? 'elevated inversion below eye: flash below the astronomical horizon as the plume pinches off'
        : 'interior transfer-curve minimum without a textbook layer signature'
    );
  } else {
    type = 'textbook';
    flash = true;
    nakedEye = false;
    notes.push(
      'no minimum: the bare green rim - sub-naked-eye at a sea horizon (Dietze); binoculars, or an elevated horizon at 1-2 deg apparent altitude'
    );
  }
  // ---- Young's quantities ----
  // The bare rim at the same eye (green-over-red refraction split
  // at the astronomical horizon, one integral per channel - the
  // graze zone is never differenced): the magnification baseline
  // AND the textbook flash's own span. Meaningless when the a = 0
  // ray threads a duct, so nulled for the ducted eyes.
  const ducted = dIn !== null || dBelowEye !== null;
  const rimArcsec = ducted
    ? null
    : (refractionRad(0, profile, 0.55, eye) -
        refractionRad(0, profile, 0.68, eye)) /
      ARCSEC;
  // Duration: the upper limb crosses the red minimum (red image
  // gone), then the green minimum (flash over); true altitude is
  // linear in time. The textbook flash is the same construction
  // collapsed onto the horizon ray: its span is the rim itself.
  const redMinVal = interior ? (iR >= 0 ? rS[iR] : rS[iG]) : null;
  const splitArcsec = interior
    ? Math.max((redMinVal - gS[iG]) / ARCSEC, 0)
    : rimArcsec;
  const durationS =
    flash && rateDegPerS > 0 && splitArcsec !== null
      ? splitArcsec / 3600 / rateDegPerS
      : null;
  // Width at onset: with the upper limb at the red minimum's true
  // altitude (Young's tangent moment), the green-not-red span is
  // the contiguous run of apparent altitudes around the minimum
  // where the green curve sits below the cut and the red above it
  // - the drawn flash, the same sliver the refraction gate pins.
  let widthArcsec = null;
  if (flash && interior) {
    const cut = redMinVal;
    let lo = iG;
    let hi = iG;
    while (lo - 1 >= first && gS[lo - 1] <= cut && rS[lo - 1] >= cut) lo--;
    while (hi + 1 < nRows && gS[hi + 1] <= cut && rS[hi + 1] >= cut) hi++;
    widthArcsec = ((hi - lo + 1) * rowRad) / ARCSEC;
  }
  const magX =
    widthArcsec !== null && rimArcsec ? widthArcsec / rimArcsec : null;
  // The preceding red flash: a prominent interior maximum of the
  // red curve left of the flash minimum (mock-mirage family); for
  // the inferior mirage the only maximum is the sea-horizon ray -
  // the telescopic red rim as the inverted image first rises.
  let redFlash = null;
  if (interior) {
    let iM = first;
    for (let i = first; i <= iG; i++) if (rS[i] > rS[iM]) iM = i;
    if (iM > first + 2 && iM < iG - 2)
      redFlash = {
        aArcmin: (t.a[iM] / DEG) * 60,
        tArcmin: (rS[iM] / DEG) * 60,
        kind: 'preceding'
      };
  }
  if (!redFlash && type === 'inferior-mirage')
    redFlash = {
      aArcmin: (t.a[first] / DEG) * 60,
      tArcmin: (rS[first] / DEG) * 60,
      kind: 'horizon-rim (telescopic)'
    };
  return {
    eyeM: eye,
    type,
    flash,
    nakedEye,
    durationS,
    splitArcsec,
    widthArcsec,
    rimArcsec,
    magX,
    promArcsec: interior ? prom / ARCSEC : null,
    nMinima: mins.length,
    appArcmin: interior ? (t.a[iG] / DEG) * 60 : null,
    minR: interior
      ? {
          aArcmin: (t.a[iR >= 0 ? iR : iG] / DEG) * 60,
          tArcmin: (redMinVal / DEG) * 60
        }
      : null,
    minG: interior
      ? {aArcmin: (t.a[iG] / DEG) * 60, tArcmin: (gS[iG] / DEG) * 60}
      : null,
    redFlash,
    ducts,
    dipArcmin: (dipRad / DEG) * 60,
    rateDegPerS: rateDegPerS ?? null,
    notes
  };
}

/** The daemon-row adapter (the theme and pins call this). */
export function flashPanel(rows, opts = {}) {
  return flashFromProfile(profileFromRows(rows), opts);
}

/**
 * THE FORECAST LEDGER's pure parts (the page stores, these
 * decide). A station's 12Z ascent and the FOLLOWING 00Z ascent
 * both describe the same local sunset evening (San Diego: 12Z is
 * 5 am, next 00Z is 5 pm, sunset near 8 pm) - so the evening
 * ascent is the morning forecast's natural verifier. eveningKey
 * maps an ascent stamp to its local evening (tzOffsetMin in the
 * getTimezoneOffset convention: minutes BEHIND UTC); two ascents
 * with one key score one forecast.
 */
export function eveningKey(iso, tzOffsetMin) {
  const t = new Date(iso).getTime() - tzOffsetMin * 60000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Held or revised: same type and duration within half a second
 * (Young's taxonomy is the claim; the duration is its size). */
export function flashLedgerVerdict(prev, next) {
  if (!prev || !next) return null;
  const sameType = prev.type === next.type;
  const dOk =
    prev.durationS === null || next.durationS === null
      ? prev.durationS === next.durationS
      : Math.abs(prev.durationS - next.durationS) <= 0.5;
  const dur = (r) =>
    r.durationS === null ? '' : ` ~${r.durationS.toFixed(1)} s`;
  return {
    held: sameType && dOk,
    label:
      sameType && dOk
        ? `held (${next.type}${prev.durationS !== null && next.durationS !== null ? ` ${prev.durationS.toFixed(1)}→${next.durationS.toFixed(1)} s` : ''})`
        : `revised (${prev.type}${dur(prev)} → ${next.type}${dur(next)})`
  };
}

/**
 * THE MIRAGE INVERSION RETRIEVAL (the sunset-as-instrument
 * program's inverse problem): the theme's own terrestrial fan
 * (far-terrain's rayFan - Ciddor refractivity, the machinery that
 * warps the drawn far ridges) plays the photograph; lehn.js
 * recovers a temperature profile knowing ONLY the image, the eye
 * height, the eye-level temperature and the surface pressure; and
 * the retrieval is closed against the balloon's measured column,
 * which never entered it above eye level. TWO candidate eyes,
 * each in its own printed geometry:
 *  - the SHORE eye just above the station (Lehn 1983's own 2.5-m
 *    camera posture): a superior mirage's S with the pivot ABOVE
 *    the eye, inverted by his three zones (lehnInvertTC);
 *  - the theme's 450-m RIDGE eye (columnPanel's reference
 *    altitude) above the marine layer: a mock mirage's S with the
 *    pivot BELOW the eye, inverted by Lehn & Morrish 1986's
 *    parametric strategy (lehnFitElevated).
 * The mode is read off the OBSERVABLE geometry (pivot vs eye),
 * the object plane is the nearest range where the fan actually
 * folds, and a day that folds from neither eye is DECLINED with
 * the accounting - never an invented inversion.
 */
/**
 * The object-plane ladder for the COMPOSED sea column (135th
 * pass): the pier's film folds at Fleagle's short ranges from a
 * tower eye (his 20-45 km), so the sea column is probed from 10 km
 * out, then on through the balloon-only ladder's far rungs. One
 * definition for the page, the freeze and the day pins.
 */
export const SEA_RETRIEVAL_DISTS_M = [
  10e3, 15e3, 20e3, 25e3, 30e3, 40e3, 60e3, 90e3, 130e3, 180e3
];
export function retrievalPanel(
  rows,
  {eyesM = null, distsM = null, modelBand = null} = {}
) {
  // A closure is a comparison against MEASURED air: when the
  // column carries a modelled segment (the composed marine
  // column's mixed layer, 135th pass), any closure span that
  // overlaps it is not a closure - the instrument declines to
  // claim agreement with air nobody measured.
  const leans = (loAbs, hiAbs) =>
    Array.isArray(modelBand) && hiAbs > modelBand[0] && loAbs < modelBand[1];
  const profile = profileFromRows(rows);
  const h0 = rows[0].hM;
  // The balloon's inversion headline (columnPanel's convention).
  let tMax = rows[0];
  for (const q of rows) {
    if (q.hM > 2500) break;
    if (q.tC > tMax.tC) tMax = q;
  }
  const balloon = {invHM: tMax.hM, invDTc: tMax.tC - rows[0].tC};
  const p0Pa = rows[0].p * 100;
  const MINR = Math.PI / 180 / 60;
  const dists = distsM ?? [20e3, 40e3, 60e3, 90e3, 130e3, 180e3];
  const eyes = eyesM ?? [h0 + 2, ...(450 > h0 + 60 ? [450] : []), h0 + 22];
  const tries = [];
  // THE CASCADE (133rd pass): the ladder no longer bets the whole
  // retrieval on the FIRST detectable S - a graze fold at one
  // distance can mask a retrievable cap fold farther out, and
  // which S the detector meets first is delicate at the sea-
  // horizon boundary (measured: one ray's ground strike, moved
  // metres by an rh difference, flipped the whole outcome). Every
  // folding distance from every eye gets its attempt; the first
  // retrieval that CLOSES on the balloon wins; if none closes,
  // the first honest non-closure is reported as before - and a
  // day with no defensible fold declines with the accounting.
  let firstNonCloser = null;
  let fitBudget = 4;
  for (const eye of eyes) {
    const TzeC = profile.at(eye).tC;
    const alphas = [];
    for (let a = -80; a <= 40; a += 0.25) alphas.push(a * MINR);
    const fan = rayFan(profile, eye, alphas, 200e3, 100);
    let folded = false;
    for (const dM of dists) {
      const j = Math.min(
        fan.hs[0].length - 1,
        Math.max(0, Math.round(dM / fan.dsM) - 1)
      );
      const tc = {
        alphas: Float64Array.from(alphas),
        zAt: Float64Array.from(alphas, (_, i) => {
          const h = fan.hs[i][j];
          return Number.isFinite(h) ? h - h0 : NaN;
        })
      };
      // A real S, not fan noise: the stepped Float32 fan wiggles
      // at the metre scale, so the pivot needs mirage-scale
      // prominence and the inverted branch must span more than a
      // couple of samples.
      const {iP, iM} = tcCriticalPoints(tc, 6);
      if (!(iP >= 0 && iM > iP + 2)) continue;
      folded = true;
      const pivotAbs = h0 + tc.zAt[iP];
      const common = {
        eyeM: eye,
        TzeC,
        balloon,
        distM: dM,
        pivot: {
          phiArcmin: tc.alphas[iP] / MINR,
          zM: h0 + tc.zAt[iP]
        },
        min: {
          phiArcmin: tc.alphas[iM] / MINR,
          zM: h0 + tc.zAt[iM]
        },
        tried: tries
      };
      // The fold-probed span first (the heights the fold-window
      // rays that reach the object plane actually traverse, read
      // off the fan): the parametric families are confined to it,
      // and a span floor at the ground marks the graze/inferior
      // class for the film fallback.
      let sLo = Infinity;
      let sHi = -Infinity;
      const jTop = Math.round(dM / fan.dsM);
      for (
        let i = Math.max(0, iP - 8);
        i <= Math.min(alphas.length - 1, iM + 8);
        i++
      ) {
        if (!Number.isFinite(tc.zAt[i])) continue;
        const hh = fan.hs[i];
        for (let k = 0; k <= Math.min(jTop, hh.length - 1); k++) {
          const h = hh[k];
          if (!Number.isFinite(h)) break;
          if (h - h0 < sLo) sLo = h - h0;
          if (h - h0 > sHi) sHi = h - h0;
        }
      }
      sLo = Math.max(0, sLo);
      // Superior pivots HUG a low eye (Whitefish: 13 m above a
      // 2.5-m camera); mock pivots sit well below a ridge eye - so
      // the mode bands are asymmetric.
      if (pivotAbs > eye + 5) {
        // Superior geometry: the 1983 zones first - they own the
        // short/medium-range class the reference gate pins on
        // Whitefish. A closing zone retrieval returns as before.
        const inv = lehnInvertTC(tc, {
          eyeM: eye - h0,
          distM: dM,
          TzeC,
          p0Pa,
          iterations: 8
        });
        let zonesOut = null;
        if (inv) {
          const probedTopM = h0 + Math.max(...inv.vertexEl, eye - h0);
          const tRetr = (hAbs) => {
            const {hM, tC} = inv.nodes;
            const h = hAbs - h0;
            let i = 0;
            while (i < hM.length - 2 && hM[i + 1] <= h) i++;
            const f = Math.min(
              1,
              Math.max(0, (h - hM[i]) / (hM[i + 1] - hM[i]))
            );
            return tC[i] + (tC[i + 1] - tC[i]) * f;
          };
          let s2 = 0;
          let n2 = 0;
          for (let h = eye; h <= probedTopM; h += 5) {
            const d = tRetr(h) - profile.at(h).tC;
            s2 += d * d;
            n2++;
          }
          // The probed TOP is itself a sample: the 5-m grid can
          // step over a top node carrying the whole claimed
          // warming (measured on a film day - +14 K in the last
          // 3 m of span, invisible to the grid, visible to
          // dTretr). The endpoint always testifies.
          {
            const d = tRetr(probedTopM) - profile.at(probedTopM).tC;
            s2 += d * d;
            n2++;
          }
          const rmsK = n2 ? Math.sqrt(s2 / n2) : null;
          zonesOut = {
            ...common,
            mode: 'superior',
            // The closure against the balloon is the instrument's
            // own verdict: a retrieval that misses the measured
            // column by kelvins is a FOLD WITHOUT A CLOSURE -
            // reported as such, never as a reading (the 1983
            // iteration leaves its stated short/medium-range
            // domain gracelessly; measured on a 130-km, 600-m-high
            // structure).
            retrieved: {
              method: 'zones',
              nodesHM: inv.nodes.hM.map((h) => h + h0),
              nodesTC: inv.nodes.tC,
              tcRmsM: inv.rms,
              probedTopM,
              rmsK,
              // A closure is only a closure over a real span: a
              // probed top hugging the eye leaves the RMS integral
              // one anchored sample, which any retrieval passes
              // (measured on a film day whose zone vertices sat
              // 3 m over the tower eye while claiming +14 K).
              closes:
                rmsK !== null &&
                rmsK < 2.5 &&
                probedTopM - eye >= 10 &&
                !leans(eye, probedTopM),
              dTretr: tRetr(probedTopM) - tRetr(eye),
              dTballoon: profile.at(probedTopM).tC - profile.at(eye).tC
            }
          };
          if (zonesOut.retrieved.closes) return zonesOut;
        }
        // The zones left their domain (or starved): Lehn & Morrish
        // 1986's parametric fallback on the same fold. The fitted
        // layer is confined to the FOLD-PROBED SPAN - the heights
        // the fold-window rays (those that actually reach the
        // object plane) traverse, read off the fan - and the claim
        // must survive TWO closures: profile RMS over the probed-
        // plus-claimed span, and the claimed layer strength
        // against the balloon over the claimed interval itself
        // (max(1 K, 35%) - the tolerance a fictitious layer cannot
        // meet). Only a fit that survives both replaces the zones'
        // honest non-closure.
        const fitAllowed = Number.isFinite(sHi) && fitBudget-- > 0;
        const fit = fitAllowed
          ? lehnFitSuperior(tc, {
              eyeM: eye - h0,
              distM: dM,
              TzeC,
              p0Pa,
              spanLoM: sLo,
              spanHiM: sHi
            })
          : null;
        if (fit) {
          const zTRel = fit.params.zBaseM + fit.params.wM;
          const tFit = (hAbs) => {
            const {hM, tC} = fit.nodes;
            const h = hAbs - h0;
            let i = 0;
            while (i < hM.length - 2 && hM[i + 1] <= h) i++;
            const f = Math.min(
              1,
              Math.max(0, (h - hM[i]) / (hM[i + 1] - hM[i]))
            );
            return tC[i] + (tC[i + 1] - tC[i]) * f;
          };
          let s2 = 0;
          let n2 = 0;
          for (let h = h0 + sLo; h <= h0 + Math.max(sHi, zTRel); h += 5) {
            const d = tFit(h) - profile.at(h).tC;
            s2 += d * d;
            n2++;
          }
          const rmsK = n2 ? Math.sqrt(s2 / n2) : null;
          const dTb =
            profile.at(h0 + zTRel).tC - profile.at(h0 + fit.params.zBaseM).tC;
          const layerOK =
            Math.abs(dTb - fit.params.dTK) <=
            Math.max(1.0, 0.35 * fit.params.dTK);
          if (
            rmsK !== null &&
            rmsK < 2.5 &&
            layerOK &&
            !leans(h0 + sLo, h0 + Math.max(sHi, zTRel))
          ) {
            return {
              ...common,
              mode: 'superior',
              retrieved: {
                method: 'fit',
                nodesHM: fit.nodes.hM.map((h) => h + h0),
                nodesTC: fit.nodes.tC,
                tcRmsM: fit.tcRmsM,
                probedTopM: h0 + Math.max(sHi, zTRel),
                spanM: [h0 + sLo, h0 + sHi],
                rmsK,
                closes: true,
                params: {
                  zBaseM: h0 + fit.params.zBaseM,
                  wM: fit.params.wM,
                  dTK: fit.params.dTK,
                  gammaKm: fit.params.gammaKm
                },
                dTretr: fit.params.dTK,
                dTballoon: dTb
              }
            };
          }
        }
        if (zonesOut) {
          if (!firstNonCloser) firstNonCloser = zonesOut;
          tries.push({
            eyeM: eye,
            distM: dM,
            why: `superior does not close (${zonesOut.retrieved.rmsK === null ? 'no span' : zonesOut.retrieved.rmsK.toFixed(1) + ' K'})`
          });
        } else {
          tries.push({
            eyeM: eye,
            distM: dM,
            why: fitAllowed ? 'zone I starved' : 'fit budget spent'
          });
        }
      } else if (pivotAbs < eye - 20) {
        // Mock geometry: the 1986 parametric strategy.
        const fitAllowed = fitBudget-- > 0;
        const fit = fitAllowed
          ? lehnFitElevated(tc, {
              eyeM: eye - h0,
              distM: dM,
              TzeC,
              p0Pa,
              groundM: 0
            })
          : null;
        if (!fit) {
          tries.push({
            eyeM: eye,
            distM: dM,
            why: fitAllowed ? 'fit failed' : 'fit budget spent'
          });
        } else {
          const floorAbs = h0 + Math.max(0, fit.probedFloorM);
          const tFit = (hAbs) => {
            const {hM, tC} = fit.nodes;
            const h = hAbs - h0;
            let i = 0;
            while (i < hM.length - 2 && hM[i + 1] <= h) i++;
            const f = Math.min(
              1,
              Math.max(0, (h - hM[i]) / (hM[i + 1] - hM[i]))
            );
            return tC[i] + (tC[i + 1] - tC[i]) * f;
          };
          let s2 = 0;
          let n2 = 0;
          for (let h = floorAbs; h <= eye; h += 5) {
            const d = tFit(h) - profile.at(h).tC;
            s2 += d * d;
            n2++;
          }
          const baseAbs = h0 + fit.params.zBaseM;
          const topAbs = baseAbs + fit.params.wM;
          const rmsKe = n2 ? Math.sqrt(s2 / n2) : null;
          const elevOut = {
            ...common,
            mode: 'elevated',
            retrieved: {
              method: 'fit',
              nodesHM: fit.nodes.hM.map((h) => h + h0),
              nodesTC: fit.nodes.tC,
              tcRmsM: fit.tcRmsM,
              probedFloorM: floorAbs,
              onePerigee: fit.onePerigee,
              closes:
                rmsKe !== null &&
                rmsKe < 2.5 &&
                eye - floorAbs >= 10 &&
                !leans(floorAbs, eye),
              params: {
                zBaseM: baseAbs,
                wM: fit.params.wM,
                dTK: fit.params.dTK,
                gammaKm: fit.params.gammaKm
              },
              rmsK: rmsKe,
              dTretr: fit.params.dTK,
              dTballoon: profile.at(topAbs).tC - profile.at(baseAbs).tC
            }
          };
          if (elevOut.retrieved.closes) return elevOut;
          if (!firstNonCloser) firstNonCloser = elevOut;
          tries.push({
            eyeM: eye,
            distM: dM,
            why: `elevated does not close (${elevOut.retrieved.rmsK === null ? 'no span' : elevOut.retrieved.rmsK.toFixed(1) + ' K'})`
          });
        }
      } else {
        tries.push({eyeM: eye, distM: dM, why: 'pivot at the eye'});
      }
      // THE FILM FALLBACK (Fleagle 1950, the 134th pass): any fold
      // no family closed, whose rays HUG THE GROUND (span floor
      // under 2 m), gets the inferior-mirage reading - the
      // two-segment surface film fitted by optical residuals, the
      // layer Fleagle built his instrument to measure. The claim
      // survives the same two-closure referee: profile RMS over
      // the probed-plus-claimed span, and the claimed film DROP
      // against the balloon over the film itself.
      if (sLo < 2 && Number.isFinite(sHi) && fitBudget-- > 0) {
        const film = fleagleFitFilm(tc, {
          eyeM: eye - h0,
          distM: dM,
          TzeC,
          p0Pa,
          spanHiM: sHi
        });
        if (film) {
          const hF = film.params.filmM;
          const tFit = (hAbs) => {
            const {hM, tC} = film.nodes;
            const h = hAbs - h0;
            let i = 0;
            while (i < hM.length - 2 && hM[i + 1] <= h) i++;
            const f = Math.min(
              1,
              Math.max(0, (h - hM[i]) / (hM[i + 1] - hM[i]))
            );
            return tC[i] + (tC[i + 1] - tC[i]) * f;
          };
          let s2 = 0;
          let n2 = 0;
          for (let h = h0; h <= h0 + Math.max(sHi, hF); h += 2) {
            const d = tFit(h) - profile.at(h).tC;
            s2 += d * d;
            n2++;
          }
          const rmsK = n2 ? Math.sqrt(s2 / n2) : null;
          const dropClaim = -film.params.gammaFilmKpM * hF;
          const dropBalloon = profile.at(h0).tC - profile.at(h0 + hF).tC;
          const filmOK =
            Math.abs(dropBalloon - dropClaim) <=
            Math.max(0.5, 0.35 * dropClaim);
          if (
            rmsK !== null &&
            rmsK < 2.5 &&
            filmOK &&
            !leans(h0, h0 + Math.max(sHi, hF))
          ) {
            return {
              ...common,
              mode: 'inferior',
              retrieved: {
                method: 'fit',
                nodesHM: film.nodes.hM.map((h) => h + h0),
                nodesTC: film.nodes.tC,
                tcRmsM: film.tcRmsM,
                probedTopM: h0 + Math.max(sHi, hF),
                spanM: [h0 + sLo, h0 + sHi],
                rmsK,
                closes: true,
                params: {
                  zBaseM: h0,
                  wM: hF,
                  dTK: -dropClaim,
                  gammaKm: film.params.gammaKpM,
                  gammaFilmKpM: film.params.gammaFilmKpM
                },
                dTretr: -dropClaim,
                dTballoon: -dropBalloon
              }
            };
          }
          tries.push({
            eyeM: eye,
            distM: dM,
            why: `film does not close (${rmsK === null ? 'no span' : rmsK.toFixed(1) + ' K'})`
          });
        } else {
          tries.push({eyeM: eye, distM: dM, why: 'film declined'});
        }
      }
    }
    if (!folded) tries.push({eyeM: eye, distM: null, why: 'no fold'});
  }
  if (firstNonCloser) return firstNonCloser;
  return {
    eyeM: eyes[0],
    TzeC: profile.at(eyes[0]).tC,
    balloon,
    distM: null,
    retrieved: null,
    tried: tries,
    note:
      'no invertible mirage today: ' +
      tries
        .map(
          (t) =>
            `eye ${t.eyeM.toFixed(0)} m ${t.distM ? `folds at ${(t.distM / 1000).toFixed(0)} km but ${t.why}` : 'sees no fold'}`
        )
        .join('; ') +
      ' - the instrument declines rather than invent'
  };
}

/**
 * THE MARINE SURFACE LAYER (the 135th pass): the shore station's
 * measured air-sea contrast through Monin-Obukhov similarity
 * (surfacelayer.js - Businger 1971 / Paulson 1970 / COARE 3.0),
 * composed under the balloon into the SEA's column - the pier's
 * film below, a tagged modelled mixed layer, the ascent above.
 * met: {taC, ztM, tsC, uMs, zuM, pPa?, dewC?, at?, station?};
 * rows: the ascent's daemon rows; bliM: the ascent's measured
 * mixed-layer depth. Returns the composed rows for every other
 * panel to read, the model band no closure may lean on, and the
 * film's verdict in Fleagle's own terms.
 *
 * THE SKIN (136th pass): the pier's thermometer reads the bulk
 * water metres down; the air touches an interface a few tenths
 * cooler (coolskin.js - COARE 3.6's skin model, Fairall et al.
 * 2026). The skin depends on the fluxes and the fluxes on the
 * skin, so the similarity profile and the skin budget are solved
 * together as one fixed point; the composed column then stands on
 * the INTERFACE temperature. shore: the nearest coastal METAR
 * {id, km, tC, dewC, cf, rhPct} - its dewpoint stands in for the
 * pier's missing hygrometer, its screen and cover feed the
 * modelled sky longwave (named as modelled, with the fit's own
 * RMSE); latDeg: COARE's latitude default when no shore screen
 * is fresh. Without either, the skin is not claimed (skinK 0).
 */
export function marinePanel(
  met,
  rows,
  {bliM = null, shore = null, latDeg = null, swNetWm2 = 0, warm = null} = {}
) {
  const pierDew = Number.isFinite(met.dewC) ? met.dewC : null;
  const shoreDew =
    pierDew === null && shore && Number.isFinite(shore.dewC)
      ? shore.dewC
      : null;
  // THE WARM LAYER (139th pass): the pier's thermometer reads the
  // bulk metres down; the day's warm layer (warmLayerDay) lifts the
  // sub-skin surface above it by what the layer holds above the
  // sensor. The skin then cools that surface, not the sensor.
  const warmK =
    warm && Number.isFinite(warm.dTtoSensorK) && warm.dTtoSensorK > 0
      ? warm.dTtoSensorK
      : 0;
  const tsBase = met.tsC + warmK;
  const metQ = {...met, tsC: tsBase, dewC: pierDew ?? shoreDew ?? null};
  let lw = null;
  if (shore && Number.isFinite(shore.dewC)) {
    // The screen temperature is the PIER's own measured air (the
    // marine air the sky radiates onto); the shore lends only what
    // the pier lacks - its dewpoint and its cloud cover. An inland
    // aerodrome's night screen is the land's, not the sea's.
    const eHpa = Math.min(eSatPa(shore.dewC), eSatPa(met.taC)) / 100;
    const rhPct = (100 * eHpa * 100) / eSatPa(met.taC);
    const cf = Number.isFinite(shore.cf) ? shore.cf : 0;
    const d = lwDown({taC: met.taC, eHpa, cf, rhPct});
    lw = {
      wm2: d.wm2,
      rmseWm2: d.rmseWm2,
      source: `modelled sky: Brunt on the pier's air + ${(cf * 100).toFixed(0)}% cover from METAR ${shore.id}`
    };
  } else if (Number.isFinite(latDeg)) {
    lw = {
      wm2: lwDownDefault(latDeg),
      rmseWm2: null,
      source: 'COARE latitude default (no fresh shore screen)'
    };
  }
  let skin = 0;
  let cs = null;
  let flux = null;
  let comp = null;
  for (let i = 0; i < 12; i++) {
    comp = marineColumnRows(rows, {...metQ, tsC: tsBase - skin}, {bliM});
    if (!comp) return null;
    if (!lw) break;
    const mo = comp.mo;
    // the fluxes are the module's own (140th pass: COARE 3.6's loop
    // returns them in the code's frame - its density at the
    // thermometer's height, its latent heat; positive when the
    // ocean loses heat) - the composition owns no flux law
    const hsb = mo.hsbWm2;
    const hlb = mo.hlbWm2;
    cs = coolSkin({
      uStar: mo.uStar,
      rhoA: mo.rhoA,
      tsC: tsBase,
      hsb,
      hlb,
      lwDn: lw.wm2,
      swNet: swNetWm2
    });
    flux = {hsb, hlb, rhoA: mo.rhoA};
    const converged = Math.abs(cs.dTK - skin) < 1e-5;
    skin = cs.dTK;
    if (converged) {
      comp = marineColumnRows(rows, {...metQ, tsC: tsBase - skin}, {bliM});
      if (!comp) return null;
      break;
    }
  }
  const mo = comp.mo;
  const lapse = ((mo.tAt(10) - mo.tAt(0.5)) / 9.5) * 1000;
  const dTairSea = met.taC - met.tsC;
  const dewSource =
    pierDew !== null
      ? 'pier'
      : shoreDew !== null
        ? `METAR ${shore.id} (${Number.isFinite(shore.km) ? shore.km.toFixed(0) : '?'} km)`
        : comp.dewSource;
  const stability =
    !Number.isFinite(mo.L) || Math.abs(mo.L) > 1e4
      ? 'neutral'
      : mo.L < 0
        ? 'unstable'
        : 'stable';
  const klass =
    stability === 'unstable'
      ? lapse < -AUTOCONVECTIVE_K_PER_M * 1000
        ? 'sinking (inferior-mirage class: film past autoconvective)'
        : 'sinking (sub-autoconvective film)'
      : stability === 'stable'
        ? 'looming (surface inversion: ducted/towering class)'
        : 'neutral film';
  return {
    rows: comp.rows,
    modelBand: comp.modelBand,
    pierTopM: comp.pierTopM,
    joinM: comp.joinM,
    dTairSeaK: dTairSea,
    stability,
    klass,
    L: mo.L,
    zetaU: mo.zetaU,
    clamped: mo.clamped,
    // the profile forms the column rides (140th pass: COARE 3.6's,
    // gated on PSL's archive) and the code's first-pass rule for
    // zeta_u > 50 (a very stable film: the first pass is kept)
    forms: mo.forms,
    k50: mo.k50,
    uStar: mo.uStar,
    thetaStar: mo.thetaStar,
    tauNm2: mo.tauNm2,
    rhoAKgM3: mo.rhoA,
    cd10n: mo.cd10n,
    filmLapseKm: lapse,
    filmDropK: mo.tAt(0.5) - mo.tAt(10),
    tSurfaceC: mo.tAt(0),
    t10C: mo.tAt(10),
    t100C: mo.tAt(comp.pierTopM),
    gustMs: mo.gust,
    dewC: comp.dewC,
    dewSource,
    z0M: mo.z0,
    iterations: mo.iterations,
    // the pier's wind on the sea's own footing (138th pass): the
    // measured wind at its sensor height, the profile's actual
    // 10-m wind, and COARE's 10-m NEUTRAL wind U10N = (u* / kappa)
    // ln(10/z0) - the wind the whitecap and slope laws were
    // fitted to.
    uMeasMs: met.uMs,
    zuM: met.zuM,
    u10Ms: mo.uAt(10),
    // COARE's u10N = usr / von / gf x ln(10/zo): the gust factor
    // gf = sqrt(U^2 + gust^2) / U takes the convective gustiness
    // back OUT, so a calm pier under a warm sea reports a calm
    // neutral wind, not the gust velocity's (the module's own,
    // since the 140th)
    u10nMs: mo.u10nMs,
    // the skin (136th pass)
    skinK: skin,
    skinDzM: cs ? cs.dzM : null,
    skinLambda: cs ? cs.lambda : null,
    tInterfaceC: tsBase - skin,
    dTairSkinK: met.taC - (tsBase - skin),
    // the warm layer (139th pass): what the day left above the sensor
    warmK,
    warmDzM: warm && Number.isFinite(warm.dzWarmM) ? warm.dzWarmM : null,
    warmSurfaceK: warm && Number.isFinite(warm.dTwarmK) ? warm.dTwarmK : null,
    warmSolarKwhM2:
      warm && Number.isFinite(warm.solarKwhM2) ? warm.solarKwhM2 : null,
    tBaseC: tsBase,
    lwDnWm2: lw ? lw.wm2 : null,
    lwSource: lw ? lw.source : 'none',
    lwRmseWm2: lw ? lw.rmseWm2 : null,
    // the bulk fluxes (positive: the ocean loses heat) - the
    // module's own, on whatever surface the column stands on
    hsbWm2: flux ? flux.hsb : mo.hsbWm2,
    hlbWm2: flux ? flux.hlb : mo.hlbWm2,
    rnlWm2: cs ? cs.rnlWm2 : null,
    q0Wm2: cs ? cs.qcolWm2 : null,
    shore: shore ? {id: shore.id, km: shore.km} : null
  };
}

/**
 * THE PIER'S WARM LAYER FROM THE DAY'S OWN HISTORY (139th pass):
 * the CO-OPS water sensor sits metres down; on a sunny, light-wind
 * day the surface can be tenths warmer by sunset (warmlayer.js -
 * COARE 3.6's warm-layer scheme, Fairall 1996's simplified PWP).
 * The pier's six-minute series since the morning (air and water
 * temperature, wind, pressure - measured), the hourly solar (the
 * satellite-derived series the page already holds - modelled at
 * the sky, not measured at the pier) and the modelled sky longwave
 * drive the integral: at each step the similarity profile gives
 * the stress and the fluxes, the skin the net infrared, and the
 * scheme accumulates. series: [{utcMs, taC, tsC, uMs, pPa?}] in
 * time order; opts: {zuM, ztM, lonDeg, latDeg, zSensorM, dewC,
 * cf, solarAt: (utcMs) => W/m^2 downwelling, albedo}. Returns the
 * layer now: its warming at the surface, its depth, the warming
 * above the sensor (what the interface carries over the bulk
 * reading), the day's absorbed solar and the number of steps.
 */
/** An hourly irradiance series {time: [ISO], vals: [W/m^2]} (the
 * page's satellite-derived shortwave, GMT stamps without a zone)
 * as a function of UTC milliseconds, linear between the hours and
 * zero outside the series. */
export function solarInterpolator(hourly) {
  if (!hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly.vals))
    return null;
  const ts = hourly.time.map((t) =>
    Date.parse(/Z$|[+-]\d\d:?\d\d$/.test(t) ? t : t + 'Z')
  );
  const vs = hourly.vals.map((v) => (Number.isFinite(v) ? v : 0));
  return (utcMs) => {
    if (!ts.length || utcMs < ts[0] || utcMs > ts[ts.length - 1]) return 0;
    let i = 0;
    while (i + 1 < ts.length && ts[i + 1] <= utcMs) i++;
    if (i + 1 >= ts.length) return vs[i];
    const f = (utcMs - ts[i]) / (ts[i + 1] - ts[i]);
    return vs[i] + f * (vs[i + 1] - vs[i]);
  };
}

export function warmLayerDay(
  series,
  {
    zuM,
    ztM,
    lonDeg,
    latDeg = null,
    zSensorM = 3.4,
    dewC = null,
    cf = 0,
    solarAt,
    albedo = 0.055
  }
) {
  if (
    !Array.isArray(series) ||
    series.length < 4 ||
    typeof solarAt !== 'function'
  )
    return null;
  let st = warmLayerInit();
  let solarJ = 0;
  let steps = 0;
  let prevMs = null;
  // the day's solar: summed from the scheme's own local midnight
  // (the series runs three days; the layer belongs to the last)
  const lastMs = series[series.length - 1].utcMs;
  const dayStartMs = lastMs - localSeconds(lastMs, lonDeg) * 1000;
  const g = Number.isFinite(latDeg)
    ? 9.7803267715 *
      (1 +
        0.0052790414 * Math.sin((latDeg * Math.PI) / 180) ** 2 +
        0.0000232718 * Math.sin((latDeg * Math.PI) / 180) ** 4)
    : 9.80665;
  for (const s of series) {
    if (![s.utcMs, s.taC, s.tsC, s.uMs].every(Number.isFinite)) continue;
    const pPa = Number.isFinite(s.pPa) ? s.pPa : 101325;
    const mo = moBulk({
      uMs: s.uMs,
      zuM,
      taC: s.taC,
      ztM,
      tsC: s.tsC,
      pPa,
      dewC,
      latDeg,
      bliM: 600
    });
    // the module's own fluxes and stress (140th pass): the stress
    // WITHOUT the gustiness, as the code reports tau and as its
    // warm-layer routine consumes it
    const rhoA = mo.rhoA;
    const hsb = mo.hsbWm2;
    const hlb = mo.hlbWm2;
    const tau = mo.tauNm2;
    const eHpa =
      dewC === null ? null : Math.min(eSatPa(dewC), eSatPa(s.taC)) / 100;
    const lwDn =
      eHpa === null
        ? lwDownDefault(latDeg ?? 30)
        : lwDown({
            taC: s.taC,
            eHpa,
            cf,
            rhPct: (100 * eHpa * 100) / eSatPa(s.taC)
          }).wm2;
    const swNet = Math.max(0, solarAt(s.utcMs)) * (1 - albedo);
    const cs = coolSkin({
      uStar: mo.uStar,
      rhoA,
      tsC: s.tsC,
      hsb,
      hlb,
      lwDn,
      swNet
    });
    st = warmLayerStep(
      st,
      {
        utcMs: s.utcMs,
        lonDeg,
        tseaC: s.tsC,
        swNet,
        lwNet: cs.rnlWm2,
        hsb,
        hlb,
        tau,
        g
      },
      zSensorM
    );
    if (prevMs !== null && s.utcMs >= dayStartMs)
      solarJ += swNet * ((s.utcMs - prevMs) / 1000);
    prevMs = s.utcMs;
    steps++;
  }
  return {
    dTwarmK: st.dTwarm,
    dzWarmM: st.dzWarm,
    dTtoSensorK: st.dTtoDepth,
    zSensorM,
    solarKwhM2: solarJ / 3.6e6,
    armed: st.jamset,
    steps,
    fromMs: series[0].utcMs,
    toMs: series[series.length - 1].utcMs
  };
}

/**
 * THE PIER'S WIND ON THE SEA'S FOOTING (138th pass): the shore
 * station's anemometer sits at its own height in air of its own
 * stability; the whitecap law (Monahan), the slope law (Cox-Munk)
 * and the wave spectrum were fitted to the 10-m wind - Monahan's
 * and COARE's neutral-equivalent U10N in particular. The profile
 * already solved for the pier (surfacelayer.js) brings the measured
 * wind down: u* from the bulk iteration, U10N = (u* / kappa)
 * ln(10/z0) (COARE's definition), and the actual 10-m wind for
 * the record. met: {uMs, zuM, taC, ztM, tsC, pPa?, dewC?}.
 */
export function pierWindPanel(met, {bliM = 600} = {}) {
  const mo = moBulk({
    uMs: met.uMs,
    zuM: met.zuM,
    taC: met.taC,
    ztM: met.ztM,
    tsC: met.tsC,
    pPa: Number.isFinite(met.pPa) ? met.pPa : 101325,
    dewC: Number.isFinite(met.dewC) ? met.dewC : null,
    latDeg: Number.isFinite(met.latDeg) ? met.latDeg : null,
    bliM: Number.isFinite(bliM) ? bliM : 600
  });
  const stability =
    !Number.isFinite(mo.L) || Math.abs(mo.L) > 1e4
      ? 'neutral'
      : mo.L < 0
        ? 'unstable'
        : 'stable';
  return {
    uMeasMs: met.uMs,
    zuM: met.zuM,
    uStar: mo.uStar,
    z0M: mo.z0,
    gustMs: mo.gust,
    L: mo.L,
    stability,
    forms: mo.forms,
    k50: mo.k50,
    u10Ms: mo.uAt(10),
    // COARE's u10N = usr / von / gf x ln(10/zo): the gust factor
    // gf = sqrt(U^2 + gust^2) / U takes the convective gustiness
    // back OUT, so a calm pier under a warm sea reports a calm
    // neutral wind, not the gust velocity's (the module's own,
    // since the 140th)
    u10nMs: mo.u10nMs
  };
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

/**
 * TONIGHT'S PASSES: the measured bright fleet (CelesTrak visual
 * group via the daemon, TLE checksums enforced by sats.js
 * parseTLEs) propagated with the vendored SGP4 across the coming
 * dark hours, each culmination graded by the MEASURED
 * standard-magnitude catalogue (satmags.js - the McCants/MMT-9
 * lineage, the same 1000 km half-phase convention Mallama 2021
 * prints for the constellation-brightness debate) through the
 * gated Lambert-sphere law and cylindrical shadow test. The
 * heavy dependencies stay with the CALLER: satlib is the
 * vendored satellite.js (a browser global on the page,
 * createRequire in the reference), and the sun arrives as two
 * callables from the astronomy engine - sunRaDecAtMs (equatorial
 * of date, taken as the propagation frame's sun: the sub-degree
 * frame difference is far below the shadow and phase geometry it
 * feeds) and sunAltAtMs at the observer.
 */
export function satsPanel({
  tleText,
  latDeg,
  lonDeg,
  startMs,
  hours = 12,
  satlib,
  sunRaDecAtMs,
  sunAltAtMs,
  mags = null,
  minElDeg = 20,
  elGateDeg = 10,
  sunMaxDeg = -6,
  coarseS = 60,
  fineS = 5
}) {
  const sats = parseTLEs(tleText).map((t) => ({
    ...t,
    rec: satlib.twoline2satrec(t.l1, t.l2),
    // satmags.js snapshotMap() is a Map keyed by norad number.
    mStd: mags?.get ? mags.get(t.norad) : mags?.[t.norad]
  }));
  const gd = {
    latitude: (latDeg * Math.PI) / 180,
    longitude: (lonDeg * Math.PI) / 180,
    height: 0.03
  };
  const sunEci = (ms) => {
    const {raH, decDeg} = sunRaDecAtMs(ms);
    const ra = (raH * Math.PI) / 12;
    const dec = (decDeg * Math.PI) / 180;
    return {
      x: Math.cos(dec) * Math.cos(ra),
      y: Math.cos(dec) * Math.sin(ra),
      z: Math.sin(dec)
    };
  };
  // One look: elevation/range/magnitude of one satellite at one
  // moment (null when the propagator declines the epoch).
  const look = (s, ms, sun) => {
    const d = new Date(ms);
    const pv = satlib.propagate(s.rec, d);
    if (!pv.position) return null;
    const gmst = satlib.gstime(d);
    const la = satlib.ecfToLookAngles(gd, satlib.eciToEcf(pv.position, gmst));
    const lit = sunlitEci(pv.position, sun);
    // Phase angle at the satellite: observer direction vs the
    // (at-infinity) sun direction.
    const oEcf = satlib.geodeticToEcf(gd);
    const cg = Math.cos(gmst);
    const sg = Math.sin(gmst);
    const oEci = {
      x: oEcf.x * cg - oEcf.y * sg,
      y: oEcf.x * sg + oEcf.y * cg,
      z: oEcf.z
    };
    const to = {
      x: oEci.x - pv.position.x,
      y: oEci.y - pv.position.y,
      z: oEci.z - pv.position.z
    };
    const n = Math.hypot(to.x, to.y, to.z);
    const beta = Math.acos(
      Math.max(
        -1,
        Math.min(1, (to.x * sun.x + to.y * sun.y + to.z * sun.z) / n)
      )
    );
    return {
      elDeg: (la.elevation * 180) / Math.PI,
      azDeg: ((la.azimuth * 180) / Math.PI + 360) % 360,
      rangeKm: la.rangeSat,
      lit,
      mag: satMagnitude(la.rangeSat, beta, s.mStd)
    };
  };
  const passes = [];
  const open = new Map(); // norad -> running pass
  const endMs = startMs + hours * 3600e3;
  let darkSteps = 0;
  for (let ms = startMs; ms <= endMs; ms += coarseS * 1000) {
    if (sunAltAtMs(ms) > sunMaxDeg) {
      // Daylight closes every running pass.
      for (const p of open.values()) passes.push(p);
      open.clear();
      continue;
    }
    darkSteps++;
    const sun = sunEci(ms);
    for (const s of sats) {
      const q = look(s, ms, sun);
      const up = q && q.elDeg > elGateDeg && q.lit;
      const run = open.get(s.norad);
      if (up) {
        if (!run) {
          open.set(s.norad, {
            name: s.name,
            norad: s.norad,
            mStd: s.mStd ?? null,
            startMs: ms,
            endMs: ms,
            peakMs: ms,
            peakElDeg: q.elDeg,
            azAtPeakDeg: q.azDeg,
            minMag: q.mag
          });
        } else {
          run.endMs = ms;
          if (q.elDeg > run.peakElDeg) {
            run.peakElDeg = q.elDeg;
            run.peakMs = ms;
            run.azAtPeakDeg = q.azDeg;
          }
          if (q.mag < run.minMag) run.minMag = q.mag;
        }
      } else if (run) {
        passes.push(run);
        open.delete(s.norad);
      }
    }
  }
  for (const p of open.values()) passes.push(p);
  // Refine each culmination on a fine grid around the coarse peak.
  for (const p of passes) {
    const s = sats.find((q) => q.norad === p.norad);
    for (
      let ms = p.peakMs - coarseS * 1000;
      ms <= p.peakMs + coarseS * 1000;
      ms += fineS * 1000
    ) {
      if (sunAltAtMs(ms) > sunMaxDeg) continue;
      const q = look(s, ms, sunEci(ms));
      if (!q || !q.lit) continue;
      if (q.elDeg > p.peakElDeg) {
        p.peakElDeg = q.elDeg;
        p.peakMs = ms;
        p.azAtPeakDeg = q.azDeg;
      }
      if (q.mag < p.minMag) p.minMag = q.mag;
    }
  }
  const kept = passes
    .filter((p) => p.peakElDeg >= minElDeg)
    .sort((a, b) => a.minMag - b.minMag);
  return {
    nSats: sats.length,
    nCatalogued: sats.filter((s) => Number.isFinite(s.mStd)).length,
    darkHours: (darkSteps * coarseS) / 3600,
    passes: kept,
    nakedEye: kept.filter((p) => p.minMag <= 4).length
  };
}
