/**
 * Earthshine - the single source shared by the theme's moon
 * (Horizon.html / sky-objects-tsl.js createMoonMaterial) and the
 * reference printer (earthshine-reference.mjs).
 *
 * "The old moon in the new moon's arms": the dark side of the
 * Moon glows with sunlight reflected off the EARTH. The chain is
 * closed-form and anchored by measurement:
 *
 *  - The Earth's phase seen from the Moon is the exact
 *    complement of the Moon's phase seen from Earth:
 *    alpha_E = pi - alpha_M. New moon = FULL Earth - maximum
 *    ashen light on the thinnest crescent, which is why the
 *    phenomenon lives at the month's edges.
 *  - The Earth's effective albedo A* = 0.297: the Big Bear
 *    earthshine programme's measured value (Goode et al. 2001,
 *    GRL 28, 1671 - they measured exactly this quantity by
 *    watching the ashen light itself).
 *  - The phase law of a Lambertian sphere,
 *    f(alpha) = [sin(alpha) + (pi - alpha) cos(alpha)] / pi,
 *    normalised to f(0) = 1 (f(pi/2) = 1/pi exactly).
 *  - Geometry: the Earth subtends (R_E / d)^2 from the Moon
 *    (R_E the IUGG mean radius shared with lightning.js - the
 *    model lives once; d the 384,400 km mean distance).
 *
 * The earthlight-to-sunlight illuminance ratio on the near side,
 *   E_e / E_sun = A* f(pi - alpha_M) (R_E / d)^2,
 * is ~8.2e-5 at new moon: the ashen side sits ~10.2 magnitudes
 * below the sunlit crescent - the classical Danjon-scale
 * contrast - and the full Earth from the Moon shines at
 * magnitude -16.5, some 30-50 times brighter than the full Moon
 * from Earth. The dark limb then scatters this light back to us
 * in TRUE OPPOSITION geometry (the light arrives from where we
 * look), so the theme's Hapke term applies with incidence along
 * the view and the g = 0 opposition surge - the same photometry
 * as the sunlit side, no separate model.
 */

import {R_EARTH} from './lightning.js';

export const A_STAR = 0.297; // Goode et al. 2001, measured
export const D_MOON_KM = 384400; // mean Earth-Moon distance
export const M_SUN = -26.74; // apparent V magnitude of the sun

// Lambertian sphere phase law, f(0) = 1.
export function lambertPhase(a) {
  return (Math.sin(a) + (Math.PI - a) * Math.cos(a)) / Math.PI;
}

// The Earth's phase angle from the Moon: the exact complement.
export function earthPhaseAngle(moonPhaseAngle) {
  return Math.PI - moonPhaseAngle;
}

// Earthlight / sunlight illuminance ratio on the lunar near side
// at lunar phase angle alpha_M (rad).
export function earthshineRatio(moonPhaseAngle, dKm = D_MOON_KM) {
  return (
    A_STAR *
    lambertPhase(earthPhaseAngle(moonPhaseAngle)) *
    (R_EARTH / dKm) ** 2
  );
}

// Apparent V magnitude of the Earth as seen from the Moon.
export function earthMagFromMoon(moonPhaseAngle, dKm = D_MOON_KM) {
  const r = earthshineRatio(moonPhaseAngle, dKm);
  return r > 0 ? M_SUN - 2.5 * Math.log10(r) : Infinity;
}
