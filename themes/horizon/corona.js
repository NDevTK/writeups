/**
 * corona.js - the solar corona's radial brightness, from Baumbach
 * (1937, Astronomische Nachrichten 263, 121 - equation and unit
 * convention read from the original scan). Pure math; the dome
 * (atmosphere-tsl.js) draws the profile this module states, and
 * the gate (corona-reference.mjs) holds it to its own closed
 * forms.
 *
 * Baumbach's eq. (5), the mean brightness over 1-6 solar radii
 * (his measured range) fitted to every eclipse photometry series
 * he reduced:
 *
 *   I(rho) = 0.0532 rho^-2.5 + 1.425 rho^-7 + 2.565 rho^-17
 *
 * in units of 1e-6 of the DISC-CENTRE surface brightness: p. 124
 * fixes "die Zentralflaechenhelligkeit der Sonne ... zu 10^6
 * Intensitaetseinheiten", with Abbot's limb-darkening coefficient
 * U = 0.6 for integrated light and the paper's own eq. (2)
 * relating mean to centre, I_mean/I_0 = 1 - U/3. That centre
 * normalisation is exactly the drawn disc's convention (the
 * dome's central-intensity constant), so the corona ties to the
 * photosphere with no conversion.
 *
 * Documented scope: eq. (5) is the angle-averaged profile - the
 * K/F split (van de Hulst 1950), streamers, and the solar-cycle
 * Ludendorff flattening are not modelled; beyond 6 R_sun the fit
 * is extrapolation and the dome's ~4.3-degree-window never asks
 * for it.
 */

export const BAUMBACH_C = [0.0532, 1.425, 2.565];
export const BAUMBACH_E = [2.5, 7, 17];

// Abbot's limb-darkening coefficient for integrated light, as
// adopted by the paper (p. 124/126).
export const U_INTEGRATED = 0.6;

// I(rho) in units of 1e-6 of the disc-centre brightness (the
// paper's own units; multiply by 1e-6 and the display's central
// intensity to draw it).
export function coronaCentreUnits(rho) {
  let s = 0;
  for (let i = 0; i < 3; i++)
    s += BAUMBACH_C[i] * Math.pow(rho, -BAUMBACH_E[i]);
  return s;
}

// The corona's total light as a fraction of the sun's, in closed
// form: flux_corona = 2 pi sum c_i/(e_i - 2) (each power law
// integrates exactly), against the limb-darkened disc flux
// pi (1 - U/3) in the same centre units.
export function coronaToSunFluxRatio(U = U_INTEGRATED) {
  let cor = 0;
  for (let i = 0; i < 3; i++) cor += BAUMBACH_C[i] / (BAUMBACH_E[i] - 2);
  return (2 * cor * 1e-6) / (1 - U / 3);
}

// Corona RADIANCE per unit solar irradiance - the radiometrically
// consistent anchor for a renderer whose atmosphere is driven by
// E0 = 1: the disc-centre brightness implied by that irradiance
// is B_centre = E0 / ((1 - U/3) pi sunRad^2) (the limb-darkened
// disc integral closed with the paper's own eq. (2)), and the
// corona is Baumbach's millionths of THAT. A drawn disc may
// compress its own brightness for display, but the corona must
// share the sky's radiometric frame or it vanishes beneath it -
// which is exactly how a 120x-compressed first attempt failed.
export function coronaRadiancePerIrradiance(rho, sunRadRad, U = U_INTEGRATED) {
  const bCentre = 1 / ((1 - U / 3) * Math.PI * sunRadRad * sunRadRad);
  return coronaCentreUnits(rho) * 1e-6 * bCentre;
}
