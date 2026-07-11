/**
 * Atmospheric refraction - the single source shared by the theme
 * (Horizon.html) and the reference printer (refraction-reference.mjs).
 *
 * The low sun is refracted, flattened and dispersed by the real
 * temperature profile, and the green flash is the visible edge of
 * that dispersion. Nothing here is a lookup curve: rays are traced
 * through the measured profile.
 *
 *  - Refractivity of air: Ciddor (1996, Applied Optics 35, 1566) -
 *    the CIPM standard equation. Dispersion of standard dry air,
 *    the water-vapour refractivity term, CIPM-81/91 densities with
 *    the full compressibility Z(p,T,x_w), and the two-density-ratio
 *    composition. Saturation vapour pressure reuses the repo's
 *    gated Murphy & Koop (contrails.js) - the svp choice moves n
 *    by parts in 1e10. Cross-checked in the reference against the
 *    independent Birch & Downs (1994) revised Edlen equation.
 *  - Ray bending: Auer & Standish (2000, AJ 119, 2472) - the exact
 *    integral for a spherically stratified atmosphere,
 *      R = INT_0^z0 [ r n' / (n + r n') ] dz,
 *    parametrised by the LOCAL zenith angle z (their change of
 *    variable is what keeps the horizon integrable), with the ray
 *    radius r(z) recovered at every node from the Snell invariant
 *    n r sin z = n0 r0 sin z0 by Newton. Composite Simpson over z.
 *  - The profile is MEASURED: pressure-level temperatures and
 *    humidities (open-meteo, the same request the Cn2 scintillation
 *    already makes) with geopotential heights - (p, h, T, rh)
 *    triples need no hydrostatic assumption at the nodes; between
 *    nodes T and rh interpolate linearly and ln p linearly (exact
 *    for an isothermal layer). Above the top level the atmosphere
 *    continues isothermally to 86 km, below the first level it
 *    meets the measured surface temperature.
 *  - apparentAltitude solves a = a_true + R(a) by fixed point (R
 *    is arcminutes-smooth, three iterations reach microarcseconds),
 *    giving: per-wavelength apparent sun directions (the green rim
 *    IS app(green) - app(red)), the vertical flattening ratio
 *    (d app / d true across the disc), and the true dip of the
 *    apparent horizon.
 */

import {eLiq} from './contrails.js';

export const R_EARTH_M = 6371008.8; // IAU mean radius
export const DEG = Math.PI / 180;
export const ARCSEC = DEG / 3600;

// Sun disc angular radius the sky shader draws (cos 0.9999893,
// the atmosphere-tsl constant): ~0.265 deg.
export const SUN_DISC_RAD = Math.acos(0.9999893);

// The three wavelengths the theme's scattering/limb model uses
// (um): red 680, green 550, blue 440.
export const LAMBDAS_UM = [0.68, 0.55, 0.44];

// ---- Ciddor 1996 ----------------------------------------------------

// Saturation vapour pressure enhancement factor (Ciddor eq. after
// A1.2): f(p, t) with p in Pa, t in degC.
function enhancement(p, t) {
  return 1.00062 + 3.14e-8 * p + 5.6e-7 * t * t;
}

// CIPM-81/91 compressibility of moist air.
function compressibility(p, tK, xw) {
  const t = tK - 273.15;
  const a0 = 1.58123e-6;
  const a1 = -2.9331e-8;
  const a2 = 1.1043e-10;
  const b0 = 5.707e-6;
  const b1 = -2.051e-8;
  const c0 = 1.9898e-4;
  const c1 = -2.376e-6;
  const d = 1.83e-11;
  const e = -0.765e-8;
  const pt = p / tK;
  return (
    1 -
    pt *
      (a0 +
        a1 * t +
        a2 * t * t +
        (b0 + b1 * t) * xw +
        (c0 + c1 * t) * xw * xw) +
    pt * pt * (d + e * xw * xw)
  );
}

// CIPM-81/91 density of (moist) air, kg/m^3. xc = CO2 in ppm.
const R_GAS = 8.31451; // Ciddor's value
const M_W = 0.018015; // kg/mol water
function density(p, tK, xw, xc) {
  const Ma = 1e-3 * (28.9635 + 12.011e-6 * (xc - 400));
  const Z = compressibility(p, tK, xw);
  return ((p * Ma) / (Z * R_GAS * tK)) * (1 - xw * (1 - M_W / Ma));
}

// Refractive index of air, Ciddor 1996. lambda in um, t in degC,
// p in Pa, rh in [0,1], xc CO2 ppm (450 matches the published
// check values).
export function ciddorN(lambdaUm, t, p, rh = 0, xc = 450) {
  const s2 = 1 / (lambdaUm * lambdaUm);
  // Standard dry air at 15 C, 101325 Pa, 450 ppm (eq. 1)...
  const nas = (5792105 / (238.0185 - s2) + 167917 / (57.362 - s2)) * 1e-8;
  // ...adjusted to the actual CO2 content (eq. 2).
  const naxs = nas * (1 + 0.534e-6 * (xc - 450));
  // Water vapour refractivity at 20 C, 1333 Pa (eq. 3).
  const nws =
    1.022e-8 *
    (295.235 + 2.6422 * s2 - 0.03238 * s2 * s2 + 0.004028 * s2 * s2 * s2);
  const tK = t + 273.15;
  // Molar fraction of water vapour in the sample.
  const svp = eLiq(tK);
  const xw = p > 0 ? Math.min((enhancement(p, t) * rh * svp) / p, 1) : 0;
  // The two density ratios (eq. 5): the sample's dry-air and
  // vapour partial densities against their reference states.
  const rhoAxs = density(101325, 288.15, 0, xc); // dry standard air
  const rhoWs = density(1333, 293.15, 1, xc); // pure vapour reference
  const Ma = 1e-3 * (28.9635 + 12.011e-6 * (xc - 400));
  const Z = compressibility(p, tK, xw);
  const rhoDry = ((p * Ma) / (Z * R_GAS * tK)) * (1 - xw);
  const rhoVap = ((p * M_W) / (Z * R_GAS * tK)) * xw;
  return 1 + (rhoDry / rhoAxs) * naxs + (rhoVap / rhoWs) * nws;
}

// ---- The measured profile -------------------------------------------

// levels: [{pPa, hM, tC, rh}] (any order), surface {hM, tC, rh}.
// Returns samplers T(h), rh(h), p(h): linear T/rh in h, linear
// ln p in h (exact for an isothermal layer); isothermal
// continuation above the top level, and the surface observation
// closing the profile below the first level.
export function buildProfile(levels, surface) {
  const L = [...levels].sort((a, b) => a.hM - b.hM);
  if (surface && (!L.length || surface.hM < L[0].hM - 1)) {
    // Close the column at the ground with the measured surface
    // temperature; its pressure follows hydrostatically from the
    // first level through the layer-mean temperature.
    if (L.length) {
      const tMean = (surface.tC + L[0].tC) / 2 + 273.15;
      const H = (R_GAS * tMean) / (0.0289644 * 9.80665);
      L.unshift({
        pPa: L[0].pPa * Math.exp((L[0].hM - surface.hM) / H),
        hM: surface.hM,
        tC: surface.tC,
        rh: surface.rh ?? L[0].rh
      });
    } else {
      L.unshift({
        pPa: 101325,
        hM: surface.hM,
        tC: surface.tC,
        rh: surface.rh ?? 0
      });
    }
  }
  const top = L[L.length - 1];
  const H_TOP = (R_GAS * (top.tC + 273.15)) / (0.0289644 * 9.80665);
  const at = (h) => {
    if (h <= L[0].hM) return L[0];
    if (h >= top.hM) {
      return {
        tC: top.tC,
        rh: 0,
        pPa: top.pPa * Math.exp(-(h - top.hM) / H_TOP)
      };
    }
    let i = 1;
    while (L[i].hM < h) i++;
    const a = L[i - 1];
    const b = L[i];
    const f = (h - a.hM) / (b.hM - a.hM);
    return {
      tC: a.tC + (b.tC - a.tC) * f,
      rh: (a.rh ?? 0) + ((b.rh ?? 0) - (a.rh ?? 0)) * f,
      pPa: Math.exp(Math.log(a.pPa) + (Math.log(b.pPa) - Math.log(a.pPa)) * f)
    };
  };
  return {at, h0: L[0].hM, hTop: top.hM};
}

// The ICAO standard atmosphere as a profile fixture (reference +
// offline fallback): 15 C and 101325 Pa at sea level, -6.5 K/km
// to 11 km, isothermal 216.65 K above, dry.
export function standardProfile() {
  const levels = [];
  for (let h = 0; h <= 32000; h += 500) {
    const tK = h <= 11000 ? 288.15 - 0.0065 * h : 216.65;
    const p =
      h <= 11000
        ? 101325 * Math.pow(288.15 / tK, -9.80665 / (0.0065 * 287.053))
        : 22632.06 * Math.exp((-9.80665 * (h - 11000)) / (287.053 * 216.65));
    levels.push({pPa: p, hM: h, tC: tK - 273.15, rh: 0});
  }
  return buildProfile(levels, null);
}

// ---- Auer & Standish 2000 -------------------------------------------

// Refraction (radians) for a ray OBSERVED at apparent altitude
// appAltRad by an observer at height obsHm, at wavelength
// lambdaUm, through the profile. Composite Simpson over the local
// zenith angle; r(z) from the Snell invariant by Newton at every
// node; dn/dr by central difference over the profile (10 m step).
export function refractionRad(
  appAltRad,
  profile,
  lambdaUm,
  obsHm = 0,
  N = 800
) {
  const nOf = (h) => {
    const s = profile.at(h);
    return ciddorN(lambdaUm, s.tC, s.pPa, s.rh ?? 0);
  };
  const dh = 10;
  // One-sided at the bottom: the profile is clamped below its
  // first sample, and a central stencil straddling that clamp
  // would halve the ground-level gradient - exactly where the
  // horizon ray spends its densest metres.
  const nPrime = (h) =>
    h - dh < profile.h0
      ? (nOf(h + dh) - nOf(h)) / dh
      : (nOf(h + dh) - nOf(h - dh)) / (2 * dh); // per metre
  const h0 = Math.max(obsHm, profile.h0);
  const r0 = R_EARTH_M + h0;
  const n0 = nOf(h0);
  const z0 = Math.PI / 2 - appAltRad;
  if (z0 <= 0) return 0;
  const C = n0 * r0 * Math.sin(z0); // Snell invariant
  // The bending along the ray is dR = -tan(z) dn/n, and the Snell
  // invariant gives the local zenith angle DIRECTLY at any height:
  // sin z(h) = C / (n(h) (R+h)). So integrate in height,
  //   R = -INT (n'(h)/n(h)) tan z(h) dh
  // along the path. A ray observed BELOW the horizontal (an
  // elevated observer watching the sun set into the dip) descends
  // to its tangent height first - the height where n r = C - and
  // climbs out; both legs carry bending, so the integral anchors
  // at the tangent point and the down-leg (tangent -> observer)
  // adds to the up-leg (tangent -> space). The substitution
  // h = hAnchor + s^2 removes the integrable 1/sqrt singularity
  // of tan z at the anchor exactly (tan z * dh/ds stays finite at
  // s = 0; the s = 0 node uses the analytic limit 2/sqrt(2K),
  // K = |n'|/n + 1/r).
  let hAnchor = h0;
  let CRay = C;
  if (z0 > Math.PI / 2) {
    // Tangent height: the FIRST h below the observer with
    // n(h) (R+h) = C. Newton is unreliable here (f is
    // non-monotone under an inversion and the root sits metres
    // above the ground at the graze), so bracket by a downward
    // scan and bisect. A ray whose tangent would be underground
    // is occluded: the transfer saturates at the GRAZE ray -
    // anchor at the profile bottom AND integrate with the graze
    // ray's own Snell constant (keeping the aimed constant there
    // integrates a ray that never existed and folds the curve
    // artificially - the old Newton+floor did exactly that).
    const hBot = profile.h0;
    const f = (h) => nOf(h) * (R_EARTH_M + h) - CRay;
    const STEPS = 240;
    let hi = h0;
    let lo = h0;
    let found = false;
    for (let i = 1; i <= STEPS; i++) {
      lo = h0 - ((h0 - hBot) * i) / STEPS;
      if (f(lo) <= 0) {
        found = true;
        break;
      }
      hi = lo;
    }
    if (found) {
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (f(mid) <= 0) lo = mid;
        else hi = mid;
        if (hi - lo < 1e-4) break;
      }
      hAnchor = (lo + hi) / 2;
    } else {
      hAnchor = hBot;
      CRay = nOf(hBot) * (R_EARTH_M + hBot);
    }
  }
  const hMax = profile.hTop + 45000; // refractivity ~1e-9 up there
  const leg = (hEnd) => {
    if (hEnd <= hAnchor) return 0;
    const sMax = Math.sqrt(hEnd - hAnchor);
    // N (even) is a caller knob: 800 for reference-grade, the theme uses
    // less after the gate pins the error (see refraction-reference).
    const ds = sMax / N;
    let sum = 0;
    for (let k = 0; k <= N; k++) {
      const s = k * ds;
      const h = hAnchor + s * s;
      const sp = profile.at(h);
      const n = ciddorN(lambdaUm, sp.tC, sp.pPa, sp.rh ?? 0);
      const np = nPrime(h);
      const r = R_EARTH_M + h;
      const sinz = Math.min(CRay / (n * r), 1);
      const cosz = Math.sqrt(Math.max(1 - sinz * sinz, 0));
      let term;
      if (cosz < 1e-7) {
        // Analytic limit of tan(z) * 2s at the anchor.
        const K = Math.abs(np) / n + 1 / r;
        term = (-np / n) * sinz * (2 / Math.sqrt(2 * K));
      } else {
        term = (-np / n) * (sinz / cosz) * 2 * s;
      }
      sum += term * (k === 0 || k === N ? 1 : k % 2 ? 4 : 2);
    }
    return (sum * ds) / 3;
  };
  // Up-leg always; down-leg only when the ray dips below the
  // observer (zero-length otherwise).
  return leg(hMax) + (hAnchor < h0 ? leg(h0) : 0);
}

// Apparent altitude for a TRUE (geometric) altitude: solves
// a = a_true + R(a) by fixed point (converges in a few rounds -
// dR/da is a few percent at the horizon).
export function apparentAltitude(
  trueAltRad,
  profile,
  lambdaUm,
  obsHm = 0,
  N = 800
) {
  let a = trueAltRad;
  for (let i = 0; i < 6; i++) {
    const next = trueAltRad + refractionRad(a, profile, lambdaUm, obsHm, N);
    if (Math.abs(next - a) < 1e-9) return next;
    a = next;
  }
  return a;
}

/**
 * The sunset transfer curve (van der Werf 2003's method): TRUE
 * altitude as a function of APPARENT altitude, per wavelength.
 * Indexed by the OBSERVED direction it is single-valued - each
 * apparent altitude sees exactly one ray, trueAlt(a) = a - R(a),
 * no fixed point - and mirage phenomenology appears as structure
 * of the curve itself: an inferior mirage (superadiabatic surface
 * layer) or a mock mirage (elevated inversion past the ducting
 * lapse) folds it, several apparent altitudes seeing the SAME
 * true altitude = multiple images, and the folded branch runs
 * BACKWARD (the reflected image is inverted). The curve is
 * SUN-INDEPENDENT - profile and observer height only - so the
 * theme rebuilds its small LUT on profile cadence and the sun's
 * true altitude slides against it every frame.
 * Returns {a, tR, tG, tB} (radians; rows ascending in a).
 */
export function transferCurve(
  profile,
  obsHm = 0,
  aMinRad = -0.6 * DEG,
  aMaxRad = 2 * DEG,
  rows = 160,
  N = 200
) {
  const a = new Float64Array(rows);
  const out = [
    new Float64Array(rows),
    new Float64Array(rows),
    new Float64Array(rows)
  ];
  // Visibility: an apparent direction whose ray runs into the
  // surface shows GROUND, not sky - the Snell constant tells
  // directly (the ray still points down at the profile bottom
  // when C < n r there), so those rows carry vis = 0 and the
  // drawn sun ends exactly at the true sea horizon, wherever the
  // drawn water plane happens to end.
  const vis = new Uint8Array(rows);
  const h0 = Math.max(obsHm, profile.h0);
  const sG = profile.at(h0);
  const n0 = ciddorN(LAMBDAS_UM[1], sG.tC, sG.pPa, sG.rh ?? 0);
  const sB = profile.at(profile.h0);
  const nBotRBot =
    ciddorN(LAMBDAS_UM[1], sB.tC, sB.pPa, sB.rh ?? 0) *
    (R_EARTH_M + profile.h0);
  for (let i = 0; i < rows; i++) {
    a[i] = aMinRad + ((aMaxRad - aMinRad) * i) / (rows - 1);
    const z0 = Math.PI / 2 - a[i];
    const C = n0 * (R_EARTH_M + h0) * Math.sin(Math.min(z0, Math.PI));
    vis[i] = a[i] >= 0 || z0 <= Math.PI / 2 || C >= nBotRBot ? 1 : 0;
    for (let c = 0; c < 3; c++)
      out[c][i] = a[i] - refractionRad(a[i], profile, LAMBDAS_UM[c], obsHm, N);
  }
  return {a, tR: out[0], tG: out[1], tB: out[2], vis};
}

// Fold count of a transfer branch: the number of maximal
// BACKWARD runs whose cumulative drop exceeds minDrop (radians) -
// 0 for a single erect image, each counted run is an inverted
// image. The threshold keeps integrator ripple (well under an
// arcsecond) from reading as imagery.
export function foldCount(t, minDrop = 5e-6) {
  let folds = 0;
  let drop = 0;
  for (let i = 1; i < t.length; i++) {
    const d = t[i] - t[i - 1];
    if (d < 0) {
      drop += -d;
    } else if (drop > 0) {
      if (drop > minDrop) folds++;
      drop = 0;
    }
  }
  if (drop > minDrop) folds++;
  return folds;
}

// Everything the drawn sun needs, from one true altitude:
// per-wavelength apparent altitudes (the green rim IS
// app[green] - app[red]) and the vertical flattening ratio -
// d(apparent)/d(true) across the disc, evaluated at the green
// wavelength (the dispersion of the flattening itself is second
// order).
export function sunRefraction(trueAltRad, profile, obsHm = 0, N = 800) {
  const app = LAMBDAS_UM.map((l) =>
    apparentAltitude(trueAltRad, profile, l, obsHm, N)
  );
  const up = apparentAltitude(
    trueAltRad + SUN_DISC_RAD,
    profile,
    LAMBDAS_UM[1],
    obsHm,
    N
  );
  const dn = apparentAltitude(
    trueAltRad - SUN_DISC_RAD,
    profile,
    LAMBDAS_UM[1],
    obsHm,
    N
  );
  return {
    appR: app[0],
    appG: app[1],
    appB: app[2],
    flatten: Math.min((up - dn) / (2 * SUN_DISC_RAD), 1)
  };
}
