/**
 * seaice.js - white sea ice reflectance from the printed model,
 * stage 1 of the sea-ice pass (the polar ocean currently draws
 * liquid water year-round - the theme has measured snow for land
 * but no ice for the sea). This module is the optics; the GIBS
 * concentration feed and the drawn water blend are the named
 * next stage.
 *
 * Source, read in full: Malinka, Zege, Heygster & Istomina,
 * "Reflective properties of white sea ice and snow" (The
 * Cryosphere 10, 2541, 2016 - the author manuscript). White ice
 * is any ice topped by a granular scattering layer (drained melt
 * surface); its reflectance is closed-form in THREE parameters
 * (their Table 1): the layer optical thickness tau, the
 * effective grain size a (the mean chord of the ice-air random
 * mixture), and the yellow-substance absorption. The machinery
 * transcribed here:
 *  - Eq. 10: the Fresnel diffuse transmittance T_diff(n) closed
 *    form; the paper prints 1 - T_diff spanning 6.11e-2..6.95e-2
 *    over n = 1.300..1.334 (the gate holds the transcription to
 *    that printed interval).
 *  - Eqs. 7-9: the single-scattering albedo of the mixture,
 *    omega0 = 1 - x T_diff / (x + T_diff) with x = alpha n^2 a
 *    and alpha = 4 pi kappa / lambda.
 *  - Eqs. 20-21, 25, 29: the asymptotic albedos of the finite
 *    bright layer, G(theta) = (3/7)(1 + 2 cos theta),
 *    y = 4 sqrt((1-omega0)/(3(1-omega0 g))),
 *    gamma = sqrt(3(1-omega0)(1-omega0 g)),
 *      r(theta0) = sinh(gamma tau + y[1 - G(theta0)]) /
 *                  sinh(gamma tau + y),
 *      r_d = sinh(gamma tau) / sinh(gamma tau + y),
 *    with the printed mean cosine g ~ 0.67 of the ice-air
 *    mixture (their Sec. 2.2/3.3) - and the printed structural
 *    facts the gate holds: at 550 nm absorption is negligible
 *    and r_d collapses to Eq. 30's tau/(tau+4); the direct and
 *    diffuse albedos cross at theta0 = arccos(2/3) ~ 48 deg
 *    (their Sec. 4.2), which is EXACT here because
 *    G(arccos(2/3)) = 1.
 *  - The parameters: the conclusion prints ordinary bare white
 *    ice at tau = 7..15 with grains 1-4 mm (Table 2's typical
 *    white ice: tau 9.3-20, a 2.2-2.8 mm, yellow substance
 *    negligible in the pure cases) - the drawn ice carries the
 *    log-mid of the printed ranges, pure (alpha_y = 0, a stated
 *    reduction backed by the printed pure-case values ~1e-4).
 *
 * Ice optical constants: Warren & Brandt 2008 (JGR 113, D14220,
 * "Optical constants of ice from the ultraviolet to the
 * microwave: a revised compilation") - the rows at the theme's
 * three channels VERBATIM from the published ASCII table
 * (atmos.uw.edu/ice_optical_constants, fetched 2026-08-07).
 */

// [lambda nm, n, kappa] - Warren & Brandt 2008 table rows.
export const ICE_NK = [
  [680, 1.3073, 2.09e-8],
  [550, 1.311, 2.289e-9],
  [440, 1.3163, 6.268e-11]
];

// Malinka 2016, printed white-ice parameter ranges (log-mids).
export const WHITE_ICE_TAU_RANGE = [7, 15];
export const WHITE_ICE_A_RANGE_MM = [1, 4];
export const WHITE_ICE_TAU = Math.sqrt(
  WHITE_ICE_TAU_RANGE[0] * WHITE_ICE_TAU_RANGE[1]
);
export const WHITE_ICE_A_M =
  Math.sqrt(WHITE_ICE_A_RANGE_MM[0] * WHITE_ICE_A_RANGE_MM[1]) * 1e-3;
export const ICE_G = 0.67; // printed mean cosine of the mixture

// Eq. 10: Fresnel transmittance of diffuse light through the
// air-ice boundary, closed form in the real index n.
export function tDiff(n) {
  const n2 = n * n;
  const n3 = n2 * n;
  const n4 = n2 * n2;
  const n5 = n4 * n;
  const n6 = n4 * n2;
  return (
    (2 * (5 * n6 + 8 * n5 + 6 * n4 - 5 * n3 - n - 1)) /
      (3 * (n3 + n2 + n + 1) * (n4 - 1)) +
    ((n2 * (n2 - 1) * (n2 - 1)) / Math.pow(n2 + 1, 3)) *
      Math.log((n + 1) / (n - 1)) -
    ((8 * n4 * (n4 + 1)) / ((n4 - 1) * (n4 - 1) * (n2 + 1))) * Math.log(n)
  );
}

// Eqs. 7-9: single-scattering albedo of the ice-air mixture at
// channel c for grain size aM (m).
export function iceOmega0(c, aM = WHITE_ICE_A_M) {
  const [nm, n, kappa] = ICE_NK[c];
  const alpha = (4 * Math.PI * kappa) / (nm * 1e-9);
  const x = alpha * n * n * aM;
  const T = tDiff(n);
  return 1 - (x * T) / (x + T);
}

// Eqs. 20/25 helpers at channel c.
function yGamma(c, aM) {
  const w0 = iceOmega0(c, aM);
  const y = 4 * Math.sqrt((1 - w0) / (3 * (1 - w0 * ICE_G)));
  const gamma = Math.sqrt(3 * (1 - w0) * (1 - w0 * ICE_G));
  return {y, gamma};
}

// Eq. 20: the escape function.
export function iceGFn(cosTheta) {
  return (3 / 7) * (1 + 2 * cosTheta);
}

// Eq. 29: bihemispherical (diffuse-incidence) albedo.
export function iceAlbedoDiffuse(c, tau = WHITE_ICE_TAU, aM = WHITE_ICE_A_M) {
  const {y, gamma} = yGamma(c, aM);
  return Math.sinh(gamma * tau) / Math.sinh(gamma * tau + y);
}

// Eq. 29: directional-hemispherical albedo at solar cosine.
export function iceAlbedoDirect(
  c,
  cosTheta0,
  tau = WHITE_ICE_TAU,
  aM = WHITE_ICE_A_M
) {
  const {y, gamma} = yGamma(c, aM);
  return (
    Math.sinh(gamma * tau + y * (1 - iceGFn(cosTheta0))) /
    Math.sinh(gamma * tau + y)
  );
}
