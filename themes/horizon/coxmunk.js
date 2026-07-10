/**
 * coxmunk.js - the Cox & Munk (1954) sun-glitter model: the sea
 * surface's slope STATISTICS measured from aerial photographs of
 * the sun's glitter, the standard of ocean optical remote sensing
 * to this day (Breon & Henriot 2006 re-measured the same laws
 * from space). Pure math; the terrain shader mirrors these exact
 * expressions on wet pixels, so the lakes' glitter width IS the
 * published law rather than a tuned lobe.
 *
 * From the paper (regressions as reproduced verbatim in Capelle
 * et al. 2023, "Revisiting the Cox and Munk wave-slope statistics
 * using IASI observations", eq. 9-12):
 *  - mean-square slopes, wind U at the 12.5 m "mast height",
 *    valid over their 1-14 m/s data range:
 *      upwind    mu = 3.16e-3 U
 *      crosswind mc = 3.0e-3 + 1.92e-3 U
 *    (their separately fitted total 3e-3 + 5.12e-3 U agrees with
 *    mu + mc to well inside the published +-0.004)
 *  - the Gram-Charlier expansion about the bivariate Gaussian
 *    (x axis upwind, u = su/sqrt(mu), c = sc/sqrt(mc)):
 *      p = (2 pi sqrt(mu mc))^-1 exp(-(u^2+c^2)/2) [ 1
 *          - C12 u (c^2 - 1)/2 - C30 (u^3 - 3u)/6
 *          + C40 (u^4 - 6u^2 + 3)/24
 *          + C22 (u^2 - 1)(c^2 - 1)/4
 *          + C04 (c^4 - 6c^2 + 3)/24 ]
 *    with the measured skewness falling linearly in wind
 *    (C12 = 0.01 - 0.0086 U, C30 = 0.04 - 0.033 U - the surface
 *    is negatively skewed upwind, waves lean with the wind) and
 *    the wind-independent peakedness C40 = 0.23, C22 = 0.12,
 *    C04 = 0.40 (CM's c04/c22/c40 - indices swapped to the
 *    x-upwind convention).
 *  - glitter radiance per unit sun irradiance through the facet
 *    geometry (the Breon & Henriot / MERIS form):
 *      L/E = rhoF(omega) p(su, sc) / (4 cos(thetaV) cos^4(beta))
 *    where beta is the facet tilt, omega the incidence on the
 *    facet, rhoF the unpolarised Fresnel reflectance of water
 *    (n = 1.34, CM used 1.338).
 */

export const CM_RANGE = [1, 14]; // the measurements' wind range
export const N_WATER = 1.34;

const clampU = (U) => Math.min(Math.max(U, CM_RANGE[0]), CM_RANGE[1]);

export function mssUp(U) {
  return 3.16e-3 * clampU(U);
}

export function mssCross(U) {
  return 3.0e-3 + 1.92e-3 * clampU(U);
}

export function gcCoeffs(U) {
  const w = clampU(U);
  return {
    c12: 0.01 - 0.0086 * w,
    c30: 0.04 - 0.033 * w,
    c40: 0.23,
    c22: 0.12,
    c04: 0.4
  };
}

/**
 * The slope probability density at (su, sc) - su the slope
 * component along the UPWIND axis, sc crosswind. The bracket is
 * clamped at zero: the truncated Gram-Charlier series goes
 * (unphysically) negative in the far tails, a documented
 * limitation of the expansion.
 */
export function slopePDF(su, sc, U) {
  const mu = mssUp(U);
  const mc = mssCross(U);
  const {c12, c30, c40, c22, c04} = gcCoeffs(U);
  const u = su / Math.sqrt(mu);
  const c = sc / Math.sqrt(mc);
  const bracket =
    1 -
    (c12 * u * (c * c - 1)) / 2 -
    (c30 * (u * u * u - 3 * u)) / 6 +
    (c40 * (u ** 4 - 6 * u * u + 3)) / 24 +
    (c22 * (u * u - 1) * (c * c - 1)) / 4 +
    (c04 * (c ** 4 - 6 * c * c + 3)) / 24;
  return (
    (Math.max(bracket, 0) / (2 * Math.PI * Math.sqrt(mu * mc))) *
    Math.exp(-(u * u + c * c) / 2)
  );
}

/** Unpolarised Fresnel reflectance of water at cos(incidence). */
export function fresnelWater(cosw, n = N_WATER) {
  const c = Math.min(Math.max(cosw, 0), 1);
  const s2 = 1 - c * c;
  const ct = Math.sqrt(Math.max(1 - s2 / (n * n), 0));
  const rs = (c - n * ct) / (c + n * ct);
  const rp = (n * c - ct) / (n * c + ct);
  return (rs * rs + rp * rp) / 2;
}

/**
 * Glitter radiance per unit sun irradiance: S and V unit vectors
 * from the surface toward the sun and the viewer (y up), `up` the
 * unit upwind direction in the horizontal plane ({x, z}). The
 * facet that mirrors S into V has normal H = (S+V)/|S+V|; its
 * slope lands in the Cox-Munk pdf, and the published geometry
 * factor 1/(4 cos(thetaV) cos^4 beta) turns the density into
 * radiance. Zero when either ray or the facet dips below the
 * horizontal.
 */
export function glintFactor(S, V, U, up) {
  const hx = S.x + V.x;
  const hy = S.y + V.y;
  const hz = S.z + V.z;
  const hl = Math.hypot(hx, hy, hz);
  if (!(hl > 0) || hy <= 0 || S.y <= 0 || V.y <= 0) return 0;
  const H = {x: hx / hl, y: hy / hl, z: hz / hl};
  const sx = -H.x / H.y; // facet slope components
  const sz = -H.z / H.y;
  const su = sx * up.x + sz * up.z;
  const sc = -sx * up.z + sz * up.x;
  const p = slopePDF(su, sc, U);
  const cosw = Math.min(Math.max(S.x * H.x + S.y * H.y + S.z * H.z, 0), 1);
  const cosb = H.y;
  return (fresnelWater(cosw) * p) / (4 * Math.max(V.y, 1e-3) * cosb ** 4);
}
