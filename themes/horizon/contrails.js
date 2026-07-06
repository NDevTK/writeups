/**
 * Contrail formation - the single source shared by the theme's
 * contrail system (Horizon.html) and the reference printer
 * (contrails-reference.mjs).
 *
 * Criterion: Schmidt-Appleman as formulated by Schumann (1996, "On
 * conditions for contrail formation from aircraft exhausts",
 * Meteorol. Z. 5, 4-23). The exhaust plume mixes with ambient air
 * along a line of slope
 *   G = EI_H2O cp P / (eps Q (1 - eta))   [Pa/K]
 * in (T, e) space, with EI_H2O = 1.223 kg/kg water per kg kerosene,
 * cp = 1004 J/(kg K), eps = 0.622, Q = 43.2 MJ/kg and eta the
 * engine propulsion efficiency (0.3 here - a modern turbofan;
 * higher eta means colder exhaust per unit water, so contrails form
 * MORE easily). A contrail forms when the mixing line reaches
 * liquid-water saturation: at 100% ambient humidity that happens
 * below the threshold
 *   T_LM [degC] = -46.46 + 9.43 ln(G - 0.053)
 *                 + 0.720 ln^2(G - 0.053)
 * (Schumann's closed-form fit; the reference printer re-derives the
 * EXACT threshold - the tangency de_w/dT = G - by Newton and holds
 * the fit to it). For ambient humidity U < 1 the threshold T_LC
 * solves
 *   U e_w(T_LC) = e_w(T_LM) - G (T_LM - T_LC),
 * with the closed-form anchor T_LC(0) = T_LM - e_w(T_LM)/G.
 *
 * Persistence: a formed contrail PERSISTS (spreads into cirrus
 * instead of evaporating in seconds) if the ambient air is
 * supersaturated with respect to ICE: RHi = U e_w(T)/e_i(T) > 1.
 *
 * Saturation pressures: Murphy & Koop (2005, QJRMS 131, 1539),
 * eqs. (7) ice and (10) supercooled liquid - the frontier-standard
 * formulation, anchored at the triple point 611.657 Pa.
 *
 * Ingredients are MEASURED: Open-Meteo's temperature_250hPa and
 * relative_humidity_250hPa at the visitor (the 250 hPa surface is
 * jet cruise level), and the aircraft themselves are live ADS-B
 * traffic around the visitor via the horizon-adsb Cloudflare
 * worker (worker/src/index.js: adsb.lol / adsb.fi readsb feeds
 * with OpenSky state vectors normalized in as the fallback - no
 * public feed is browser-reachable directly, so the worker adds
 * the CORS header). Ambient Poisson traffic only fills in when
 * the feed has nothing overhead. The PHYSICS decides whether any
 * aircraft's trail exists at all and whether it lingers, which is
 * what makes today's sky look like today's sky.
 */

// Murphy & Koop (2005) eq. (7): saturation vapour pressure over
// ice, Pa, T in K (valid above 110 K).
export function eIce(T) {
  return Math.exp(
    9.550426 - 5723.265 / T + 3.53068 * Math.log(T) - 0.00728332 * T
  );
}

// Murphy & Koop (2005) eq. (10): saturation vapour pressure over
// (supercooled) liquid water, Pa, T in K (valid 123 < T < 332 K).
export function eLiq(T) {
  return Math.exp(
    54.842763 -
      6763.22 / T -
      4.21 * Math.log(T) +
      0.000367 * T +
      Math.tanh(0.0415 * (T - 218.8)) *
        (53.878 - 1331.22 / T - 9.44523 * Math.log(T) + 0.014025 * T)
  );
}

// Schumann (1996) mixing-line slope, Pa/K. P in Pa.
export const EI_H2O = 1.223;
export const CP = 1004;
export const EPS = 0.622;
export const Q_FUEL = 43.2e6;
export function slopeG(P, eta = 0.3) {
  return (EI_H2O * CP * P) / (EPS * Q_FUEL * (1 - eta));
}

// Schumann's closed-form threshold at liquid saturation (degC).
export function tlmApprox(G) {
  const x = Math.log(G - 0.053);
  return -46.46 + 9.43 * x + 0.72 * x * x;
}

// The EXACT liquid-saturation threshold: the mixing line of slope G
// is tangent to e_w(T), i.e. de_w/dT (T_LM) = G. Newton in double
// precision (analytic derivative via central difference of the
// exact e_w; 1e-4 K step keeps 9 significant digits).
export function tlmExact(G) {
  let T = 273.15 + tlmApprox(G);
  for (let i = 0; i < 60; i++) {
    const h = 1e-4;
    const d1 = (eLiq(T + h) - eLiq(T - h)) / (2 * h);
    const d2 = (eLiq(T + h) - 2 * eLiq(T) + eLiq(T - h)) / (h * h);
    const step = (d1 - G) / d2;
    T -= step;
    if (Math.abs(step) < 1e-9) break;
  }
  return T - 273.15;
}

// Threshold for ambient relative humidity U (over liquid, 0..1):
// solve U e_w(T_LC) = e_w(T_LM) - G (T_LM - T_LC) by Newton.
// T_LC(1) = T_LM; T_LC(0) = T_LM - e_w(T_LM)/G exactly.
export function tlcAt(G, U, eta) {
  const tlm = tlmExact(G);
  if (U >= 1) return tlm;
  const eTlm = eLiq(tlm + 273.15);
  if (U <= 0) return tlm - eTlm / G;
  let T = tlm - (eTlm / G) * (1 - U);
  for (let i = 0; i < 60; i++) {
    const TK = T + 273.15;
    const f = U * eLiq(TK) - (eTlm - G * (tlm - T));
    const h = 1e-4;
    const df = (U * (eLiq(TK + h) - eLiq(TK - h))) / (2 * h) - G;
    const step = f / df;
    T -= step;
    if (Math.abs(step) < 1e-9) break;
  }
  return T;
}

// The full criterion at pressure P (Pa), ambient temperature tC
// (degC) and relative humidity over LIQUID U (0..1): does a
// contrail form, does it persist (ice supersaturation), and the
// diagnostics behind both.
export function appleman(P, tC, U, eta = 0.3) {
  const G = slopeG(P, eta);
  const tlc = tlcAt(G, U, eta);
  const TK = tC + 273.15;
  const rhi = (U * eLiq(TK)) / eIce(TK);
  return {forms: tC <= tlc, persists: rhi > 1, tlc, rhi, G};
}

// ---- Live-aircraft mapping (the Cloudflare worker feeds adsb.lol
// state vectors; see worker/src/index.js) ------------------------
// Exact unit constants: international foot and knot.
export const FT_M = 0.3048;
export const KT_MS = 0.514444;

// Map one ADS-B state vector into the scene: equirectangular
// offsets from the reference (the same mapping the theme uses for
// its OSM and DEM layers), the asinh altitude compression, and the
// track/groundspeed as a scene-space velocity. ref = {lat, lon,
// halfM, world, centerElev, mpu} with mpu = metres per scene unit.
export function adsbToScene(ac, ref) {
  const mLat = 111320;
  const mLon = Math.max(mLat * Math.cos((ref.lat * Math.PI) / 180), 1e-6);
  const dLat = ref.halfM / mLat;
  const dLon = ref.halfM / mLon;
  const x = ((ac.lon - ref.lon) / (2 * dLon)) * ref.world;
  const z = (-(ac.lat - ref.lat) / (2 * dLat)) * ref.world;
  const altM = ac.alt_baro * FT_M;
  const y = 16 * Math.asinh((altM - ref.centerElev) / 500);
  const sp = (ac.gs * KT_MS) / ref.mpu; // scene units per second
  const tr = (ac.track * Math.PI) / 180;
  return {x, z, y, vx: sp * Math.sin(tr), vz: -sp * Math.cos(tr), sp, altM};
}
