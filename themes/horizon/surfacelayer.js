/**
 * surfacelayer.js - the MARINE SURFACE LAYER from measured air-sea
 * contrast: Monin-Obukhov similarity in the printed Kansas forms.
 * Three primaries, all READ IN FULL:
 *  - Businger, Wyngaard, Izumi & Bradley 1971, "Flux-Profile
 *    Relationships in the Atmospheric Surface Layer" (J. Atmos.
 *    Sci. 28, 181-189): the Kansas tower's dimensionless
 *    gradients - phi_m = (1 - 15 zeta)^-1/4 and phi_h =
 *    0.74 (1 - 9 zeta)^-1/2 unstable (their Eqs. 8, 12), 1 + 4.7
 *    zeta and 0.74 + 4.7 zeta stable (Eqs. 10, 14); von Karman's
 *    constant MEASURED at 0.35 "rather than 0.40 as usually
 *    assumed" (COARE later pairs these same forms with 0.40 -
 *    the value this module runs, see KAPPA); the
 *    eddy-diffusivity ratio 1.35 at neutrality; the
 *    Ri(zeta) relations (Eqs. 26, 28) and the stable Richardson
 *    limit "about 0.21"; the integrated stable profiles (Eqs. 29,
 *    30) with theta* defined as -w'theta'/(k u*).
 *  - Paulson 1970, "The Mathematical Representation of Wind Speed
 *    and Temperature Profiles in the Unstable Atmospheric Surface
 *    Layer" (J. Appl. Meteor. 9, 857-861): the closed-form
 *    integrals psi_1 = 2 ln((1+x)/2) + ln((1+x^2)/2) - 2 atan x +
 *    pi/2 and psi_2 = 2 ln((1+x^2)/2), x = (1 - gamma zeta)^1/4,
 *    of the Businger-Dyer gradients - held here as identities
 *    against numerical integration of Businger's own phi.
 *  - Fairall, Bradley, Hare, Grachev & Edson 2003, "Bulk
 *    Parameterization of Air-Sea Fluxes: Updates and Verification
 *    for the COARE Algorithm" (J. Climate 16, 571-591): the sea's
 *    roughness - Charnock's z0 = alpha u*^2/g + 0.11 nu/u* (their
 *    Eq. 6) with alpha 0.011 rising linearly to 0.018 between
 *    10 and 18 m/s (their Fig. 1 and text), the scalar roughness
 *    z0q = min(1.1e-4, 5.5e-5 Rr^-0.6) (Eq. 28, adopted for heat
 *    and moisture alike), the 0.98 saturation over seawater, the
 *    gustiness velocity Ug = beta W*, beta = 1.25 (Eq. 8), and
 *    the bulk Richardson first guess.
 *
 * WHY: the theme's refraction column is a radiosonde launched
 * inland (Miramar, 134 m); below its floor the drawn sea horizon
 * had a constant-temperature extrapolation, and the far-horizon
 * fan declined to apply at beach eye heights ("column floor sits
 * above the eye"). NOAA CO-OPS piers measure air temperature,
 * water temperature, wind and pressure at the shore (keyless,
 * CORS-open, the tide pass's own feed); the similarity theory
 * turns that contrast into the lowest hundred metres over the
 * water - warm air over cold upwelled water (the California
 * summer) is a stable film that looms and towers, water warmer
 * than air an unstable one that sinks and mirages - and the
 * Fleagle instrument can read that film back from the drawn
 * horizon and close against the pier.
 *
 * STATED LIMITS: the Kansas forms are used within their observed
 * range (zeta clamped to [-2.5, 2] - Businger's Fig. 1 span);
 * COARE 3.0's convective blend and Beljaars-Holtslag stable forms
 * are not implemented; the water temperature is the pier's bulk
 * sensor (COARE's cool-skin correction, "several tenths", is not
 * applied); the humidity profile rides only when an air-side
 * dewpoint is supplied.
 */

/** Von Karman's constant AS COARE 3.0 USES IT with the Kansas
 * profile forms (Fairall et al. 2003: "the velocity von Karman
 * constant was adjusted to ... 0.40"); Businger's own measured
 * 0.35 is kept below as his printed landmark. The choice is
 * consistency: COARE's roughness constants were fitted with
 * 0.40, and Businger notes u* from profiles scales with k
 * ("about 15% high" at 0.40 against his 0.35). */
export const KAPPA = 0.4;
export const BUSINGER_KAPPA = 0.35;
export const GAMMA_M = 15;
export const GAMMA_H = 9;
export const PR_NEUTRAL = 0.74;
export const BETA_STABLE = 4.7;
export const ALPHA_EDDY_NEUTRAL = 1.35;
export const CHARNOCK_LO = 0.011;
export const CHARNOCK_HI = 0.018;
export const GUST_BETA = 1.25;
export const SEAWATER_SAT = 0.98;
export const NU_AIR = 1.5e-5;
export const ZETA_MIN = -2.5;
export const ZETA_MAX = 2;
const G = 9.80665;
const CP = 1004.7;
const R_DRY = 287.053;

/** Businger's dimensionless wind shear (Eqs. 8, 10). */
export function phiM(zeta) {
  return zeta < 0
    ? Math.pow(1 - GAMMA_M * zeta, -0.25)
    : 1 + BETA_STABLE * zeta;
}

/** Businger's dimensionless temperature gradient (Eqs. 12, 14). */
export function phiH(zeta) {
  return zeta < 0
    ? PR_NEUTRAL * Math.pow(1 - GAMMA_H * zeta, -0.5)
    : PR_NEUTRAL + BETA_STABLE * zeta;
}

/** Paulson's psi_1 for the wind profile (his Eq. after (6)):
 * unstable closed form; stable -4.7 zeta (Businger Eq. 29). */
export function psiM(zeta) {
  if (zeta >= 0) return -BETA_STABLE * zeta;
  const x = Math.pow(1 - GAMMA_M * zeta, 0.25);
  return (
    2 * Math.log((1 + x) / 2) +
    Math.log((1 + x * x) / 2) -
    2 * Math.atan(x) +
    Math.PI / 2
  );
}

/** Paulson's psi_2 for the NORMALIZED temperature gradient
 * phi_h / 0.74 (his form for phi_2 = (1 - gamma zeta)^-1/2);
 * stable: -4.7 zeta / 0.74, so that 0.74 [ln(z/z0) - psi_h]
 * reproduces Businger's Eq. (30). */
export function psiH(zeta) {
  if (zeta >= 0) return (-BETA_STABLE * zeta) / PR_NEUTRAL;
  const x = Math.pow(1 - GAMMA_H * zeta, 0.25);
  return 2 * Math.log((1 + x * x) / 2);
}

/** Businger's Ri(zeta): Eq. (26) unstable, Eq. (28) stable - both
 * the identity Ri = zeta phi_h / phi_m^2. */
export function richardsonOfZeta(zeta) {
  const pm = phiM(zeta);
  return (zeta * phiH(zeta)) / (pm * pm);
}

/** COARE 3.0 Eq. (6): z0 = alpha u*^2/g + 0.11 nu/u*, alpha from
 * the 10-m neutral wind (0.011 to 0.018 across 10-18 m/s). */
export function charnockAlpha(u10nMs) {
  const f = Math.min(1, Math.max(0, (u10nMs - 10) / 8));
  return CHARNOCK_LO + (CHARNOCK_HI - CHARNOCK_LO) * f;
}
export function roughnessZ0(uStar, u10nMs) {
  return (charnockAlpha(u10nMs) * uStar * uStar) / G + (0.11 * NU_AIR) / uStar;
}

/** COARE 3.0 Eq. (28): the scalar roughness from the roughness
 * Reynolds number Rr = z0 u* /nu (heat and moisture alike). */
export function roughnessScalar(z0, uStar) {
  const rr = (z0 * uStar) / NU_AIR;
  return Math.min(1.1e-4, 5.5e-5 * Math.pow(rr, -0.6));
}

/** Saturation vapour pressure (Pa) over water - the Magnus form
 * the repo's refraction module uses (eLiq); kept local so the
 * layer needs no import from the ray code. */
export function eSatPa(tC) {
  return 610.94 * Math.exp((17.625 * tC) / (tC + 243.04));
}
export function specificHumidity(ePa, pPa) {
  return (0.622 * ePa) / (pPa - 0.378 * ePa);
}

/**
 * THE BULK SOLUTION: from wind at zuM, air temperature at ztM
 * (and optional dewpoint there), water temperature and pressure,
 * find u*, theta* (Businger's definition, -w'theta'/(k u*)), q*
 * and the Obukhov length by fixed-point iteration on the Kansas
 * profiles with COARE's roughness and gustiness. bliM is the
 * convective boundary-layer depth for the gustiness velocity
 * (the balloon's own measured BLH when it has one; COARE's 600 m
 * class otherwise).
 */
export function moBulk({
  uMs,
  zuM,
  taC,
  ztM,
  tsC,
  pPa = 101325,
  dewC = null,
  bliM = 600
}) {
  const tK = taC + 273.15;
  // potential temperatures referenced to the surface: theta(z) =
  // T(z) + (g/cp) z (dry adiabatic, over the surface layer)
  const thetaA = taC + (G / CP) * ztM;
  const thetaS = tsC;
  const dTheta = thetaA - thetaS;
  const qS = SEAWATER_SAT * specificHumidity(eSatPa(tsC), pPa);
  const qA =
    dewC === null || !Number.isFinite(dewC)
      ? null
      : specificHumidity(eSatPa(dewC), pPa);
  const dq = qA === null ? 0 : qA - qS;
  const tV = tK * (1 + 0.61 * (qA ?? qS));
  let uStar = 0.3;
  let thetaStar = 0;
  let qStar = 0;
  let L = Infinity;
  let zeta = 0;
  let z0 = 1e-4;
  let z0s = 1e-4;
  let gust = 0;
  let iter = 0;
  for (iter = 0; iter < 60; iter++) {
    const S = Math.sqrt(uMs * uMs + gust * gust);
    const zetaU = Number.isFinite(L) ? clampZeta(zuM / L) : 0;
    const zetaT = Number.isFinite(L) ? clampZeta(ztM / L) : 0;
    // roughness from the CURRENT friction velocity (a lagging z0
    // leaves the fixed point a fraction of a percent off the log
    // law - measured in the neutral gate)
    const uEff = Math.max(uStar, 1e-3);
    const z0n = roughnessZ0(
      uEff,
      Math.max((uEff / KAPPA) * Math.log(10 / z0), 0)
    );
    z0 = roughnessZ0(uEff, Math.max((uEff / KAPPA) * Math.log(10 / z0n), 0));
    z0s = roughnessScalar(z0, uEff);
    const uNew =
      (KAPPA * Math.max(S, 0.05)) / (Math.log(zuM / z0) - psiM(zetaU));
    const denomT = PR_NEUTRAL * (Math.log(ztM / z0s) - psiH(zetaT));
    const tNew = dTheta / denomT;
    const qNew = dq / denomT;
    // Obukhov length with theta* in Businger's k-carrying
    // definition: w'theta' = -k u* theta*, so
    // L = theta_v u*^2 / (k^2 g theta_v*).
    const tvStar = tNew * (1 + 0.61 * (qA ?? qS)) + 0.61 * tK * qNew;
    const LNew =
      Math.abs(tvStar) < 1e-9
        ? Infinity
        : (tV * uNew * uNew) / (KAPPA * KAPPA * G * tvStar);
    // COARE Eq. (8): gustiness from the convective velocity scale
    // when the surface heats the air (w'theta_v' > 0).
    const wtv = -KAPPA * uNew * tvStar;
    gust = wtv > 0 ? GUST_BETA * Math.cbrt((G / tV) * wtv * bliM) : 0;
    const dU = Math.abs(uNew - uStar);
    uStar = 0.5 * uStar + 0.5 * uNew;
    thetaStar = 0.5 * thetaStar + 0.5 * tNew;
    qStar = 0.5 * qStar + 0.5 * qNew;
    L = LNew;
    zeta = Number.isFinite(L) ? zuM / L : 0;
    if (iter > 5 && dU < 1e-8) break;
  }
  return {
    uStar,
    thetaStar,
    qStar,
    L,
    zetaU: Number.isFinite(L) ? zuM / L : 0,
    clamped: Number.isFinite(L) && (zuM / L < ZETA_MIN || zuM / L > ZETA_MAX),
    z0,
    z0s,
    gust,
    dTheta,
    dq,
    thetaS,
    qS,
    qA,
    iterations: iter,
    /** Potential temperature at height z (C, surface-referenced). */
    thetaAt: (z) => {
      const zz = Math.max(z, z0s);
      const zt = Number.isFinite(L) ? clampZeta(zz / L) : 0;
      return thetaS + thetaStar * PR_NEUTRAL * (Math.log(zz / z0s) - psiH(zt));
    },
    /** Actual temperature at height z (C): theta minus g/cp z. */
    tAt: (z) => {
      const zz = Math.max(z, z0s);
      const zt = Number.isFinite(L) ? clampZeta(zz / L) : 0;
      return (
        thetaS +
        thetaStar * PR_NEUTRAL * (Math.log(zz / z0s) - psiH(zt)) -
        (G / CP) * zz
      );
    },
    qAt: (z) => {
      if (qA === null) return null;
      const zz = Math.max(z, z0s);
      const zt = Number.isFinite(L) ? clampZeta(zz / L) : 0;
      return qS + qStar * PR_NEUTRAL * (Math.log(zz / z0s) - psiH(zt));
    },
    uAt: (z) => {
      const zz = Math.max(z, z0);
      const zt = Number.isFinite(L) ? clampZeta(zz / L) : 0;
      return (uStar / KAPPA) * (Math.log(zz / z0) - psiM(zt));
    }
  };
}

function clampZeta(z) {
  return Math.min(ZETA_MAX, Math.max(ZETA_MIN, z));
}

/** The base of the ascent's first capping inversion above fromM
 * (the last row before a rise of at least 1 K within 300 m), or
 * null when none lies below toM. */
export function inversionBaseM(rows, fromM, toM) {
  for (let i = 0; i + 2 < rows.length; i++) {
    const a = rows[i];
    if (a.hM < fromM) continue;
    if (a.hM > toM) break;
    const b = rows[i + 1];
    if (b.tC > a.tC) {
      let j = i + 1;
      let rise = 0;
      while (j < rows.length && rows[j].hM - a.hM <= 300) {
        rise = Math.max(rise, rows[j].tC - a.tC);
        j++;
      }
      if (rise >= 1) return a.hM;
    }
  }
  return null;
}

/**
 * THE COMPOSED COLUMN: three segments, each with its own
 * authority, each row tagged with its source.
 *  - 'pier':   the similarity profile from the shore station's
 *              measured air-sea contrast, surface to topM (the
 *              surface layer, Businger's "lowest 50 m or so");
 *  - 'mixed':  a well-mixed marine layer (potential temperature
 *              constant at the surface layer's top) up to the
 *              balloon's own mixed-layer depth - MODELLED, not
 *              measured: the inland ascent's lowest hundreds of
 *              metres are the LAND boundary layer (an inland
 *              mesa's sea-breeze air is not the sea's), and no
 *              instrument here measures the marine layer between
 *              the pier and the inversion; the balloon's bulk-
 *              Richardson depth stands as the inversion's height
 *              proxy, stated;
 *  - 'balloon': the ascent above that depth - the free
 *              atmosphere both columns share.
 * The modelled band is returned so any closure that would lean
 * on it can decline. Rows are daemon-shape [{p hPa, hM, tC, rh,
 * src}] with hM absolute (sea level = 0).
 */
export function marineColumnRows(
  balloonRows,
  met,
  {topM = 100, skipM = 30, bliM = null} = {}
) {
  const h0 = balloonRows[0].hM;
  // Where the balloon becomes the sea's column: at the base of
  // its capping inversion when it carries one (the marine layer's
  // lid is the free atmosphere both columns share above it), else
  // at its mixed-layer depth, else just above its own film.
  const base = inversionBaseM(balloonRows, h0 + skipM, h0 + 2500);
  const zJoin =
    base !== null
      ? base
      : Number.isFinite(bliM) && bliM > topM + 50
        ? h0 + bliM
        : h0 + skipM;
  const kept = balloonRows.filter((q) => q.hM >= zJoin);
  if (kept.length < 5) return null;
  const pSea = Number.isFinite(met.pPa)
    ? met.pPa
    : balloonRows[0].p *
      100 *
      Math.exp((h0 * G) / (R_DRY * (balloonRows[0].tC + 273.15)));
  // The air-side humidity: the pier's own dewpoint when it has a
  // hygrometer, else the ascent's SURFACE row (the launch site's
  // near-surface dewpoint stands in for the shore's - stated).
  let dewC = met.dewC ?? null;
  let dewSource = 'pier';
  if (dewC === null || !Number.isFinite(dewC)) {
    const r0 = balloonRows[0];
    if (Number.isFinite(r0.rh) && r0.rh > 0) {
      const e = (r0.rh / 100) * eSatPa(r0.tC);
      const ln = Math.log(e / 610.94);
      dewC = (243.04 * ln) / (17.625 - ln);
      dewSource = 'ascent surface';
    } else {
      dewC = null;
      dewSource = 'none';
    }
  }
  const mo = moBulk({
    uMs: met.uMs,
    zuM: met.zuM,
    taC: met.taC,
    ztM: met.ztM,
    tsC: met.tsC,
    pPa: pSea,
    dewC,
    bliM: bliM ?? 600
  });
  const first = kept[0];
  const zTop = Math.min(topM, Math.max(5, first.hM - 5));
  const rhRef = (balloonRows[0].rh ?? first.rh ?? 50) / 100;
  const out = [];
  let p = pSea;
  let zPrev = 0;
  let tPrev = null;
  const push = (z, tC, rh, src) => {
    if (tPrev !== null && z > zPrev) {
      const tMean = (tPrev + tC) / 2 + 273.15;
      p *= Math.exp((-(z - zPrev) * G) / (R_DRY * tMean));
    }
    out.push({p: p / 100, hM: z, tC, rh: Math.round(rh * 100), src});
    zPrev = z;
    tPrev = tC;
  };
  const rhOfQ = (q, tC, p) => {
    if (q === null) return rhRef;
    const e = (q * p) / (0.622 + 0.378 * q);
    return Math.min(1, Math.max(0, e / eSatPa(tC)));
  };
  const rhOf = (z, tC) => rhOfQ(mo.qAt(z), tC, pSea);
  const zs = [0, 0.1, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 100].filter(
    (z) => z <= zTop
  );
  if (zs[zs.length - 1] < zTop) zs.push(zTop);
  for (const z of zs) push(z, mo.tAt(z), rhOf(z, mo.tAt(z)), 'pier');
  // the mixed layer: potential temperature AND specific humidity
  // constant from the surface layer's top (well-mixed), so the
  // relative humidity rises with height as the air cools; the
  // last hundred metres blend to the balloon's own value at the
  // join, so the lid is never a zero-thickness step (a step
  // would be a fictitious duct).
  const thetaMix = mo.thetaAt(zTop);
  const qMix = mo.qAt(zTop);
  let mixedTop = zTop;
  if (first.hM > zTop + 20) {
    const tAtMix = (z) => thetaMix - (G / CP) * z;
    const zBlend = Math.max(zTop, first.hM - 150);
    const zs2 = [];
    for (let z = zTop + 100; z < zBlend; z += 100) zs2.push(z);
    for (let z = zBlend; z < first.hM - 1; z += 30) zs2.push(z);
    for (const z of zs2) {
      let tC = tAtMix(z);
      if (z >= zBlend) {
        const f = (z - zBlend) / (first.hM - zBlend);
        tC = tAtMix(zBlend) + f * (first.tC - tAtMix(zBlend));
      }
      push(z, tC, rhOfQ(qMix, tC, p), 'mixed');
      mixedTop = z;
    }
  }
  for (const q of kept)
    push(q.hM, q.tC, (q.rh ?? rhRef * 100) / 100, 'balloon');
  return {
    rows: out,
    mo,
    pierTopM: zTop,
    modelBand: mixedTop > zTop ? [zTop, first.hM] : null,
    joinM: first.hM,
    pSeaPa: pSea,
    dewC,
    dewSource
  };
}
