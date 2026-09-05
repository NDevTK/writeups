/**
 * surfacelayer.js - the MARINE SURFACE LAYER from measured air-sea
 * contrast: Monin-Obukhov similarity, in COARE 3.6's profile forms
 * as the authors' published code runs them (the forms the page
 * runs, since the 140th pass) and in the printed Kansas forms (the
 * landmarks the module is anchored to). Four primaries, all READ
 * IN FULL:
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
 *    gustiness velocity Ug = beta W*, beta = 1.25 (Eq. 8), the
 *    bulk Richardson first guess, and the convective profile
 *    forms (their Eq. 13: Kansas blended into Grachev's free-
 *    convection limit by zeta^2/(1 + zeta^2)).
 *  - THE COARE 3.6 CODE (coare36vn_zrf_et - Edson and Fairall's
 *    MATLAB as PSL's Python port publishes it, NOAA-PSL/COARE-
 *    algorithm, READ IN FULL): the algorithm as it actually runs
 *    - psiu_26 / psit_26 / psiu_40 with their written constants
 *    (the stable velocity form's a 0.7, b 3/4, c 5, d 0.35; the
 *    scalar's (1 + 2/3 zeta)^1.5 with the rounded 14.28 and
 *    8.525), Buck's saturation with its pressure enhancement, the
 *    salinity reduction 1 - 0.02 Ss/35, the wind-dependent
 *    Charnock alpha = 0.0017 U10N - 0.005 capped at 19 m/s (the
 *    COARE 3.5 fit the code cites to Edson et al. 2013), z0q =
 *    min(1.6e-4, 5.8e-5 Rr^-0.72), beta 1.2 with the 0.2-m/s
 *    gustiness floor, fdg 1.0, ten iterations, the first-pass
 *    rule for zeta_u > 50, and the latitude-dependent gravity.
 *    This is the routine NOAA PSL ran for the bulk fluxes of
 *    their hourly ship archive (Fairall et al. 2026, Section 2.1;
 *    shipflux-fixture.js) - the module reproduces PSL's u*, Hs
 *    and Hl from the archive's own inputs, hour by hour.
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
 * WHY TWO FORMS (140th pass): the 135th ran the Kansas forms with
 * COARE 3.0's roughness - printed physics, gated as identities.
 * Measured against PSL's archive (surfacelayer-reference), that
 * pairing returns the latent flux tens of W/m^2 high (Businger's
 * 0.74 Prandtl factor on the scalar profile, where COARE runs
 * fdg 1.0 with its own scalar roughness); the COARE 3.6 forms
 * return PSL's own fluxes to a fraction of a W/m^2. The page runs
 * COARE 3.6 (forms 'coare36', the default); the Kansas forms stay
 * as the module's printed anchor (forms 'kansas') and for the
 * Businger/Paulson landmarks.
 *
 * STATED LIMITS: no ice branch (the code's Andreas roughness and
 * ice saturation are not ported - the pier's water never freezes);
 * no wave-age Charnock (the code's cp/sigH branch - the pier has
 * no measured phase speed; the wind-speed form is the code's own
 * fallback); the cool skin is solved outside this module
 * (coolskin.js, observatory.marinePanel - jcool 0 here, the
 * caller passes the interface temperature); the water temperature
 * this module is given is whatever the caller measured or
 * corrected - the pier's bulk sensor alone, or (since the 136th
 * pass) the interface under COARE 3.6's cool skin, lifted (since
 * the 139th) by the day's warm layer; the humidity profile rides
 * only when an air-side humidity is supplied (a dewpoint - the
 * pier's own, the shore METAR's, or the ascent's surface row - or
 * a specific humidity; the caller names which).
 */

/** Von Karman's constant AS COARE USES IT (Fairall et al. 2003:
 * "the velocity von Karman constant was adjusted to ... 0.40";
 * the 3.6 code's von = 0.4); Businger's own measured 0.35 is kept
 * below as his printed landmark. The choice is consistency:
 * COARE's roughness constants were fitted with 0.40, and Businger
 * notes u* from profiles scales with k ("about 15% high" at 0.40
 * against his 0.35). */
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

/** COARE 3.6 AS THE CODE SETS IT (coare36vn_zrf_et): the constants
 * of the bulk loop, named as the code names them. */
export const COARE36 = Object.freeze({
  vonKarman: 0.4,
  /** gustiness: gust = Beta (Bf zi)^0.333 when the buoyancy flux
   * heats the air, else the 0.2-m/s floor; 0.5 m/s first guess */
  beta: 1.2,
  gustFloorMs: 0.2,
  gustFirstMs: 0.5,
  ziDefaultM: 600,
  /** the scalar profile factor (Kansas ran 0.74) */
  fdg: 1.0,
  /** the wind-dependent Charnock: alpha = a1 U10N + a2, U10N
   * capped at umax (the COARE 3.5 fit); 0.011 for the first guess */
  charnockA1: 0.0017,
  charnockA2: -0.005,
  charnockUmaxMs: 19,
  charnockFirst: 0.011,
  /** z0q = min(1.6e-4, 5.8e-5 Rr^-0.72), heat and moisture alike */
  zoqCapM: 1.6e-4,
  zoqCoef: 5.8e-5,
  zoqExp: 0.72,
  /** the first guess's 10-m Stanton number */
  ch10First: 0.00115,
  /** the wave-state branch: zoS = sigH Ad (usr/cp)^Bd, the wave
   * height parameterized as max(0.25, (0.02 (cp/u10)^1.1 - 0.0025)
   * u10^2) when not measured */
  waveAd: 0.2,
  waveBd: 2.2,
  waveHsigMinM: 0.25,
  nits: 10,
  /** zeta_u > 50 at the bulk-Richardson first guess: the code
   * keeps its first pass through the loop */
  zetaFirstPass: 50,
  t2k: 273.16,
  rGas: 287.1,
  cpa: 1004.67,
  ssDefaultPsu: 35,
  latDefaultDeg: 45
});

/**
 * THE BULK'S MEASURED RESIDUAL (141st pass): what NOAA PSL's directly
 * measured fluxes say about COARE 3.6's bulk values on the same
 * hours, by 10-m neutral wind class - the covariance stress along
 * the wind, the covariance sensible and latent heat fluxes
 * (shipflux-cov-fixture.js; the module's bulk minus the measured,
 * hour by hour). PINNED FROM THE GATE (surfacelayer-reference
 * recomputes every number from the frozen rows and fails on a
 * drift): bias and RMSE in the flux's own unit, ratio = mean bulk
 * / mean measured, hours = the rows behind each. The page states
 * the RMSE at the pier's wind class as the bulk's uncertainty -
 * the archive's scatter, which at low winds is as much the
 * measurement's (Fairall et al. 2003: covariance stress "slightly
 * lower at low wind speed", "could be overestimated by about 10%
 * because of ship flow distortion") as the algorithm's.
 */
export const BULK_RESIDUALS = Object.freeze({
  at: '2026-09-05T11:54Z',
  classes: [
    {
      u10nMs: [0, 3],
      hours: {tau: 162, hs: 161, hl: 96},
      tau: {bias: -0.0021, rmse: 0.0206, ratio: 0.7},
      uStar: {bias: 0.0242, rmse: 0.1022},
      hs: {bias: -1.91, rmse: 10.21, ratio: 0.727},
      hl: {bias: 11.95, rmse: 38.56, ratio: 1.276}
    },
    {
      u10nMs: [3, 6],
      hours: {tau: 595, hs: 592, hl: 447},
      tau: {bias: -0.0019, rmse: 0.0291, ratio: 0.928},
      uStar: {bias: 0.0144, rmse: 0.0851},
      hs: {bias: 0.12, rmse: 9.96, ratio: 1.023},
      hl: {bias: 0.86, rmse: 22.65, ratio: 1.01}
    },
    {
      u10nMs: [6, 9],
      hours: {tau: 548, hs: 537, hl: 420},
      tau: {bias: -0.0048, rmse: 0.0394, ratio: 0.935},
      uStar: {bias: 0.0033, rmse: 0.0908},
      hs: {bias: -1.3, rmse: 7.63, ratio: 0.84},
      hl: {bias: -5.38, rmse: 33.66, ratio: 0.959}
    },
    {
      u10nMs: [9, 12],
      hours: {tau: 181, hs: 176, hl: 138},
      tau: {bias: -0.0132, rmse: 0.0553, ratio: 0.928},
      uStar: {bias: -0.0076, rmse: 0.0677},
      hs: {bias: -2.49, rmse: 18.27, ratio: 0.825},
      hl: {bias: -16.21, rmse: 40.89, ratio: 0.92}
    },
    {
      u10nMs: [12, Infinity],
      hours: {tau: 39, hs: 36, hl: 34},
      tau: {bias: -0.0029, rmse: 0.1445, ratio: 0.993},
      uStar: {bias: 0.0191, rmse: 0.1508},
      hs: {bias: -3.09, rmse: 23.94, ratio: 0.925},
      hl: {bias: 23.97, rmse: 65.47, ratio: 1.14}
    }
  ]
});
/** The residual class for a 10-m neutral wind (m/s): the pinned
 * entry whose band holds it (the last class is open above). */
export function bulkResidual(u10nMs) {
  const cls = BULK_RESIDUALS.classes;
  if (!cls.length || !Number.isFinite(u10nMs)) return null;
  const u = Math.max(0, u10nMs);
  const c =
    cls.find((k) => u >= k.u10nMs[0] && u < k.u10nMs[1]) ?? cls[cls.length - 1];
  return {
    ...c,
    label:
      c.u10nMs[1] === Infinity
        ? `${c.u10nMs[0]}+ m/s`
        : `${c.u10nMs[0]}-${c.u10nMs[1]} m/s`
  };
}

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
 * layer needs no import from the ray code. The Kansas branch's
 * humidity; the COARE branch runs the code's own Buck form. */
export function eSatPa(tC) {
  return 610.94 * Math.exp((17.625 * tC) / (tC + 243.04));
}
export function specificHumidity(ePa, pPa) {
  return (0.622 * ePa) / (pPa - 0.378 * ePa);
}

// ---- COARE 3.6's own forms, as the code writes them --------------

/** The Grachev free-convection limb the code blends into the
 * Kansas forms (psic in psiu_26/psit_26/psiu_40; Fairall 2003
 * Eq. 13): the integral of phi = (1 - a zeta)^-1/3, with
 * y = (1 - a zeta)^0.3333 as the code rounds the exponent. */
export function psiConvective(zeta, a) {
  const y = Math.pow(1 - a * zeta, 0.3333);
  return (
    1.5 * Math.log((1 + y + y * y) / 3) -
    Math.sqrt(3) * Math.atan((1 + 2 * y) / Math.sqrt(3)) +
    Math.PI / Math.sqrt(3)
  );
}
/** The code's stable form -(a zeta + b (zeta - c/d) e^-d zeta +
 * b c/d) with the exponent's argument capped at 50. */
function psiStable(zeta, a, b, c, d) {
  const dz = Math.min(50, d * zeta);
  return -(a * zeta + b * (zeta - c / d) * Math.exp(-dz) + (b * c) / d);
}
/** The Kansas limb of the velocity form: Paulson's psi_1 with the
 * code's gamma. */
function psiKansasM(zeta, gamma) {
  const x = Math.pow(1 - gamma * zeta, 0.25);
  return (
    2 * Math.log((1 + x) / 2) +
    Math.log((1 + x * x) / 2) -
    2 * Math.atan(x) +
    Math.PI / 2
  );
}
/** The blend weight f = zeta^2 / (1 + zeta^2) (Fairall 2003 Eq.
 * 13): Kansas near neutral, free convection far from it. */
export function convectiveBlend(zeta) {
  return (zeta * zeta) / (1 + zeta * zeta);
}

/** psiu_26: COARE 3.6's velocity profile function. Unstable: the
 * Kansas form (gamma 15) blended into Grachev's (10.15) by f;
 * stable: the code's a 0.7, b 3/4, c 5, d 0.35. */
export function psiM26(zeta) {
  if (zeta >= 0) return psiStable(zeta, 0.7, 0.75, 5, 0.35);
  const f = convectiveBlend(zeta);
  return (1 - f) * psiKansasM(zeta, 15) + f * psiConvective(zeta, 10.15);
}

/** psit_26: COARE 3.6's scalar profile function. Unstable: the
 * Kansas scalar form 2 ln((1+x)/2), x = (1 - 15 zeta)^1/2,
 * blended into the convective form with 34.15; stable: the
 * code's -((1 + 0.6667 zeta)^1.5 + 0.6667 (zeta - 14.28) e^-d +
 * 8.525) - its rounded constants leave psit_26(0) = -0.0045, a
 * step the code carries (surfacelayer-reference measures it). */
export function psiH26(zeta) {
  if (zeta >= 0) {
    const dz = Math.min(50, 0.35 * zeta);
    return -(
      Math.pow(1 + 0.6667 * zeta, 1.5) +
      0.6667 * (zeta - 14.28) * Math.exp(-dz) +
      8.525
    );
  }
  const x = Math.pow(1 - 15 * zeta, 0.5);
  const psik = 2 * Math.log((1 + x) / 2);
  const f = convectiveBlend(zeta);
  return (1 - f) * psik + f * psiConvective(zeta, 34.15);
}

/** psiu_40: the code's first-guess velocity form (gamma 18,
 * convective 10, stable a 1). */
export function psiM40(zeta) {
  if (zeta >= 0) return psiStable(zeta, 1, 0.75, 5, 0.35);
  const f = convectiveBlend(zeta);
  return (1 - f) * psiKansasM(zeta, 18) + f * psiConvective(zeta, 10);
}

/** bucksat: Buck's saturation vapour pressure over water (hPa)
 * with the code's pressure enhancement (1.0007 + 3.46e-6 P). The
 * code's ice branch (T below the freezing point) is not ported. */
export function buckSatHpa(tC, pHpa) {
  return (
    6.1121 * Math.exp((17.502 * tC) / (tC + 240.97)) * (1.0007 + 3.46e-6 * pHpa)
  );
}
/** qsat26sea: the sea's saturation specific humidity (g/kg) under
 * the salinity reduction fs = 1 - 0.02 Ss/35 (0.98 at 35 PSU). */
export function qSatSeaGkg(tsC, pHpa, ssPsu = COARE36.ssDefaultPsu) {
  const es = buckSatHpa(tsC, pHpa) * (1 - (0.02 * ssPsu) / 35);
  return (622 * es) / (pHpa - 0.378 * es);
}
/** Specific humidity (g/kg) of a vapour pressure e (hPa) at P
 * (hPa) - the code's 622 e / (P - 0.378 e). */
export function qOfVapourGkg(eHpa, pHpa) {
  return (622 * eHpa) / (pHpa - 0.378 * eHpa);
}
/** visa: the code's kinematic viscosity of air (m^2/s) at t (C). */
export function airViscosity(tC) {
  return (
    1.326e-5 * (1 + 0.006542 * tC + 8.301e-6 * tC * tC - 4.84e-9 * tC * tC * tC)
  );
}
/** grv: the code's gravity (m/s^2) at a latitude. */
export function gravityOfLat(latDeg) {
  const x = Math.sin((latDeg * Math.PI) / 180);
  return (
    9.7803267715 *
    (1 +
      0.0052790414 * x ** 2 +
      0.0000232718 * x ** 4 +
      1.262e-7 * x ** 6 +
      7e-10 * x ** 8)
  );
}
/** The COARE 3.5 Charnock parameter: a1 U10N + a2, U10N capped. */
export function charnock36(u10nMs) {
  return (
    COARE36.charnockA1 * Math.min(u10nMs, COARE36.charnockUmaxMs) +
    COARE36.charnockA2
  );
}
/** The code's scalar roughness from the roughness Reynolds number. */
export function roughnessScalar36(rr) {
  return Math.min(
    COARE36.zoqCapM,
    COARE36.zoqCoef / Math.pow(rr, COARE36.zoqExp)
  );
}

/**
 * THE BULK SOLUTION: from wind at zuM, air temperature at ztM
 * (and an optional air-side humidity - a dewpoint there, or a
 * specific humidity at zqM), water temperature and pressure, find
 * u*, theta* (Businger's definition, -w'theta'/(k u*)), q* and
 * the Obukhov length. forms 'coare36' (default): the COARE 3.6
 * code's own loop - its profile forms, roughness, gustiness,
 * humidity and density, ten iterations, the first-pass rule;
 * forms 'kansas': fixed-point iteration on the Kansas profiles
 * with COARE 3.0's roughness and gustiness (the 135th's pairing,
 * kept for the printed landmarks). bliM is the convective
 * boundary-layer depth for the gustiness velocity (the balloon's
 * own measured BLH when it has one; COARE's 600 m class
 * otherwise); latDeg sets the code's gravity, ssPsu the sea's
 * saturation. Both forms return the same shape, the fluxes
 * included (hsbWm2, hlbWm2 positive when the ocean loses heat;
 * tauNm2 without the gustiness, as the code reports it).
 */
export function moBulk({
  uMs,
  zuM,
  taC,
  ztM,
  zqM = null,
  tsC,
  pPa = 101325,
  dewC = null,
  qAKgKg = null,
  ssPsu = null,
  latDeg = null,
  bliM = 600,
  forms = 'coare36',
  waves = null
}) {
  const args = {
    uMs,
    zuM,
    taC,
    ztM,
    zqM,
    tsC,
    pPa,
    dewC,
    qAKgKg,
    ssPsu,
    latDeg,
    bliM,
    waves
  };
  return forms === 'kansas' ? kansasBulk(args) : coareBulk(args);
}

/** The COARE 3.6 loop as the code runs it (jcool 0: tsC is the
 * surface the air touches). */
function coareBulk({
  uMs,
  zuM,
  taC,
  ztM,
  zqM,
  tsC,
  pPa,
  dewC,
  qAKgKg,
  ssPsu,
  latDeg,
  bliM,
  waves = null
}) {
  const C = COARE36;
  const von = C.vonKarman;
  const {beta: Beta, fdg, t2k: T2K, rGas: Rgas, cpa} = C;
  const P = pPa / 100;
  const Ss = Number.isFinite(ssPsu) ? ssPsu : C.ssDefaultPsu;
  const grav = gravityOfLat(Number.isFinite(latDeg) ? latDeg : C.latDefaultDeg);
  const zq = Number.isFinite(zqM) ? zqM : ztM;
  const zi = Number.isFinite(bliM) && bliM > 0 ? bliM : C.ziDefaultM;
  const Qs = qSatSeaGkg(tsC, P, Ss) / 1000;
  // the code's pressure at the thermometer's height
  const Ptq = P - 0.125 * ztM;
  let Q = null;
  if (Number.isFinite(qAKgKg)) Q = qAKgKg;
  else if (Number.isFinite(dewC))
    Q = qOfVapourGkg(buckSatHpa(dewC, Ptq), Ptq) / 1000;
  // density and buoyancy carry the sea's own humidity when the air
  // side has none (no latent flux is then claimed: dq = 0)
  const Qd = Q ?? Qs;
  const Le = (2.501 - 0.00237 * tsC) * 1e6;
  const rhoa = (Ptq * 100) / (Rgas * (taC + T2K) * (1 + 0.61 * Qd));
  const visa = airViscosity(taC);
  const lapse = grav / cpa;
  // sea minus potential air ("dT = Tskin - Ta - lapse zt")
  const dT = tsC - taC - lapse * ztM;
  const dq = Q === null ? 0 : Qs - Q;
  const ta = taC + T2K;
  const du = Math.max(uMs, 0);
  // ---- first guess ------------------------------------------------
  let gust = C.gustFirstMs;
  let ut = Math.sqrt(du * du + gust * gust);
  const u10 = (ut * Math.log(10 / 1e-4)) / Math.log(zuM / 1e-4);
  let usr = 0.035 * u10;
  const zo10 = (C.charnockFirst * usr * usr) / grav + (0.11 * visa) / usr;
  const Cd10 = (von / Math.log(10 / zo10)) ** 2;
  const Ct10 = C.ch10First / Math.sqrt(Cd10);
  const zot10 = 10 / Math.exp(von / Ct10);
  const Cd = (von / Math.log(zuM / zo10)) ** 2;
  const Ct = von / Math.log(ztM / zot10);
  const CC = (von * Ct) / Cd;
  const Ribcu = -zuM / zi / 0.004 / Beta ** 3;
  const Ribu = (((-grav * zuM) / ta) * (dT + 0.61 * ta * dq)) / (ut * ut);
  const zetau =
    Ribu < 0
      ? (CC * Ribu) / (1 + Ribu / Ribcu)
      : CC * Ribu * (1 + ((27 / 9) * Ribu) / CC);
  const k50 = zetau > C.zetaFirstPass;
  const L10 = zuM / zetau;
  let gf = du > 0 ? ut / du : Infinity;
  usr = (ut * von) / (Math.log(zuM / zo10) - psiM40(zuM / L10));
  let tsr = (-dT * von * fdg) / (Math.log(ztM / zot10) - psiH26(ztM / L10));
  let qsr = (-dq * von * fdg) / (Math.log(zq / zot10) - psiH26(zq / L10));
  // the code's wave-state Charnock when a phase speed is given
  // (charnS = zoS g / usr^2 with zoS = sigH Ad (usr/cp)^Bd; the
  // wave height parameterized from the wave age when not
  // measured) - tried on the archive's wave hours in
  // surfacelayer-reference and NOT what the page runs (measured:
  // it worsens the stress closure; see the 141st pass)
  const cp =
    waves && Number.isFinite(waves.cpMs) && waves.cpMs > 0 ? waves.cpMs : null;
  const sigH =
    cp === null
      ? null
      : Number.isFinite(waves.sigHm) && waves.sigHm > 0
        ? waves.sigHm
        : Math.max(
            C.waveHsigMinM,
            (0.02 * Math.pow(cp / u10, 1.1) - 0.0025) * u10 * u10
          );
  const charnWave = (usrNow) =>
    (sigH * C.waveAd * Math.pow(usrNow / cp, C.waveBd) * grav) /
    (usrNow * usrNow);
  let charn = cp === null ? charnock36(u10) : charnWave(usr);
  let L = L10;
  let zeta = zetau;
  let zo = zo10;
  let zoq = zot10;
  let first = null;
  // ---- the bulk loop ----------------------------------------------
  for (let i = 1; i <= C.nits; i++) {
    zeta = (((von * grav * zuM) / ta) * (tsr + 0.61 * ta * qsr)) / (usr * usr);
    L = zuM / zeta;
    zo = (charn * usr * usr) / grav + (0.11 * visa) / usr;
    const rr = (zo * usr) / visa;
    zoq = roughnessScalar36(rr);
    const zot = zoq;
    const cdhf = von / (Math.log(zuM / zo) - psiM26(zuM / L));
    const cqhf = (von * fdg) / (Math.log(zq / zoq) - psiH26(zq / L));
    const cthf = (von * fdg) / (Math.log(ztM / zot) - psiH26(ztM / L));
    usr = ut * cdhf;
    qsr = -dq * cqhf;
    tsr = -dT * cthf;
    // the buoyancy flux "from Stull (1988) page 146"
    const tvsr = tsr * (1 + 0.61 * Qd) + 0.61 * ta * qsr;
    const Bf = (-grav / ta) * usr * tvsr;
    gust = Bf > 0 ? Beta * Math.pow(Bf * zi, 0.333) : C.gustFloorMs;
    ut = Math.sqrt(du * du + gust * gust);
    gf = du > 0 ? ut / du : Infinity;
    if (i === 1) first = {usr, tsr, qsr, L, zeta};
    const u10N = du > 0 ? (usr / von / gf) * Math.log(10 / zo) : 0;
    charn = cp === null ? charnock36(u10N) : charnWave(usr);
  }
  if (k50 && first) ({usr, tsr, qsr, L, zeta} = first);
  // ---- the fluxes ---------------------------------------------------
  const hsb = -rhoa * cpa * usr * tsr;
  const hlb = -rhoa * Le * usr * qsr;
  const tau = Number.isFinite(gf) ? (rhoa * usr * usr) / gf : 0;
  const u10n = du > 0 ? (usr / von / gf) * Math.log(10 / zo) : 0;
  const thetaS = tsC;
  const thetaStar = tsr / von;
  const qStar = qsr / von;
  const zetaAt = (z) => (Number.isFinite(L) ? z / L : 0);
  const thetaAt = (z) => {
    const zz = Math.max(z, zoq);
    return thetaS + thetaStar * (Math.log(zz / zoq) - psiH26(zetaAt(zz)));
  };
  return {
    forms: 'coare36',
    uStar: usr,
    thetaStar,
    qStar,
    L,
    zetaU: Number.isFinite(L) ? zuM / L : 0,
    clamped: false,
    k50,
    z0: zo,
    z0s: zoq,
    gust,
    gf,
    dTheta: -dT,
    dq: Q === null ? 0 : Q - Qs,
    thetaS,
    qS: Qs,
    qA: Q,
    rhoA: rhoa,
    hsbWm2: hsb,
    hlbWm2: hlb,
    tauNm2: tau,
    u10nMs: u10n,
    cd10n: (von / Math.log(10 / zo)) ** 2,
    iterations: C.nits,
    /** Potential temperature at height z (C, surface-referenced). */
    thetaAt,
    /** Actual temperature at height z (C): theta minus g/cp z. */
    tAt: (z) => thetaAt(z) - lapse * Math.max(z, zoq),
    qAt: (z) => {
      if (Q === null) return null;
      const zz = Math.max(z, zoq);
      return Qs + qStar * (Math.log(zz / zoq) - psiH26(zetaAt(zz)));
    },
    uAt: (z) => {
      const zz = Math.max(z, zo);
      return (usr / von) * (Math.log(zz / zo) - psiM26(zetaAt(zz)));
    }
  };
}

/** The Kansas forms with COARE 3.0's roughness and gustiness (the
 * 135th's pairing): fixed-point iteration on Businger's profiles. */
function kansasBulk({uMs, zuM, taC, ztM, tsC, pPa, dewC, bliM}) {
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
  const zi = Number.isFinite(bliM) && bliM > 0 ? bliM : 600;
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
    gust = wtv > 0 ? GUST_BETA * Math.cbrt((G / tV) * wtv * zi) : 0;
    const dU = Math.abs(uNew - uStar);
    uStar = 0.5 * uStar + 0.5 * uNew;
    thetaStar = 0.5 * thetaStar + 0.5 * tNew;
    qStar = 0.5 * qStar + 0.5 * qNew;
    L = LNew;
    zeta = Number.isFinite(L) ? zuM / L : 0;
    if (iter > 5 && dU < 1e-8) break;
  }
  // the fluxes in the same frame as the COARE branch (the code's
  // density at the thermometer's height, its latent heat)
  const Ptq = pPa / 100 - 0.125 * ztM;
  const rhoA =
    (Ptq * 100) /
    (COARE36.rGas * (taC + COARE36.t2k) * (1 + 0.61 * (qA ?? qS)));
  const gf = uMs > 0 ? Math.sqrt(uMs * uMs + gust * gust) / uMs : Infinity;
  return {
    forms: 'kansas',
    uStar,
    thetaStar,
    qStar,
    L,
    zetaU: Number.isFinite(L) ? zuM / L : 0,
    clamped: Number.isFinite(L) && (zuM / L < ZETA_MIN || zuM / L > ZETA_MAX),
    k50: false,
    z0,
    z0s,
    gust,
    gf,
    dTheta,
    dq,
    thetaS,
    qS,
    qA,
    rhoA,
    hsbWm2: -rhoA * CP * KAPPA * uStar * thetaStar,
    hlbWm2:
      qA === null
        ? 0
        : -rhoA * (2.501 - 0.00237 * tsC) * 1e6 * KAPPA * uStar * qStar,
    tauNm2: Number.isFinite(gf) ? (rhoA * uStar * uStar) / gf : 0,
    u10nMs: uMs > 0 ? ((uStar / KAPPA) * Math.log(10 / z0)) / gf : 0,
    cd10n: (KAPPA / Math.log(10 / z0)) ** 2,
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
 * src}] with hM absolute (sea level = 0). met may carry latDeg
 * (the code's gravity) and ssPsu (the sea's saturation); opts.forms
 * picks the profile forms (moBulk's default otherwise).
 */
export function marineColumnRows(
  balloonRows,
  met,
  {topM = 100, skipM = 30, bliM = null, forms = undefined} = {}
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
    latDeg: Number.isFinite(met.latDeg) ? met.latDeg : null,
    ssPsu: Number.isFinite(met.ssPsu) ? met.ssPsu : null,
    bliM: bliM ?? 600,
    ...(forms ? {forms} : {})
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
