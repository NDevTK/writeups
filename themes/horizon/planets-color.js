/**
 * planets-color.js - the naked-eye planets' colours from printed
 * photometry, through the SAME chain the stars ride. The five
 * drawn planets carried fifteen hand-picked tint numbers; they
 * now carry Mallama's measured band albedos, and Uranus - inside
 * the theme's own naked-eye magnitude limit - joins the sky.
 *
 * Source, read in full (49 pp): Mallama, Krobusek & Pavlov 2017,
 * "Comprehensive wide-band magnitudes and albedos for the
 * planets, with applications to exo-planets and Planet Nine",
 * Icarus 282, 19-33 (arXiv:1609.05048). Vendored verbatim:
 *  - Table 6, the solar magnitudes (Livingston 2001 via Allen's
 *    Astrophysical Quantities; Rc/Ic after Binney & Merrifield):
 *    the printed solar B - V = -26.10 - (-26.75) = 0.65 run
 *    through the repo's own Ballesteros relation
 *    (stars-color.js) gives T_sun = 5779 K - seven kelvin from
 *    the real effective temperature, so the stars' Planck frame
 *    and the printed solar photometry agree with each other
 *    before any planet is drawn (gated).
 *  - Table 7, the Johnson-Cousins geometric albedos per band.
 *    The B (0.436 um), V (0.549) and R (0.700) effective
 *    wavelengths (their Table 1) sit on the theme's 440/550/680
 *    channels within 4/1/20 nm, so the drawn tint is simply the
 *    sunlight carrier times the printed per-band albedo:
 *    tint_c = starTintRGB(T_sun)[c] x p_c, normalised max-1
 *    like every star. This is what makes Uranus and Neptune
 *    come out BLUE-GREEN - their printed albedo collapses from
 *    0.56 in B to 0.20/0.18 in R ("heavily blanketed by methane
 *    absorption bands, giving it a distinctly blue color",
 *    printed) - where any colour-index shortcut through a
 *    Planck fit would have called them sun-like white.
 *  - Table 3, the V reference magnitudes M(1,0) per planet, and
 *    the paper's own worked example (their Eqs. 3-4): Saturn's
 *    luminosity ratio 10^((-26.75 + 8.91)/2.5) = 7.31e-8 over
 *    the area factor 1.46e-7 (radius 57,240 km printed) gives
 *    the geometric albedo 0.499 - the gate reproduces the
 *    printed example exactly from the vendored tables.
 *  - The appendix phase machinery used by the gate's
 *    corroborations: Venus's observed V illumination polynomial
 *    (their Table A-2.2; its zero-order term IS Table 3's
 *    -4.384) whose printed coefficients plus plain circular
 *    geometry reproduce the classic greatest brilliancy near
 *    -4.8; Jupiter's quadratic (Table A-5.2) whose 12-degree
 *    dimming lands on the printed "about 6%" cross-check
 *    against Dyudina's Pioneer-based curves.
 *
 * The live magnitudes stay with the ephemeris engine
 * (Astronomy Engine's Illumination) - this module is the
 * COLOUR and the printed reference frame that corroborates it.
 */

import {ballesterosT, starTintRGB} from './stars-color.js';

// Table 6 - solar magnitudes, verbatim. [U, B, V, R, I, Rc, Ic]
export const SOLAR_MAG = {
  U: -25.9,
  B: -26.1,
  V: -26.75,
  R: -27.29,
  I: -27.63,
  Rc: -27.15,
  Ic: -27.49
};

// The printed solar colour through the repo's own Ballesteros
// relation - the one temperature every planet's sunlight carrier
// uses.
export const SUN_BV = SOLAR_MAG.B - SOLAR_MAG.V;
export const T_SUN = ballesterosT(SUN_BV);

// Table 7 - Johnson-Cousins geometric albedos, verbatim.
// [U, B, V, R, I, Rc, Ic] per planet.
export const PLANET_ALBEDO = {
  Mercury: [0.087, 0.105, 0.142, 0.172, 0.208, 0.158, 0.18],
  Venus: [0.348, 0.658, 0.689, 0.708, 0.584, 0.658, 0.64],
  Earth: [0.688, 0.512, 0.434, 0.418, 0.43, 0.392, 0.396],
  Mars: [0.06, 0.088, 0.17, 0.288, 0.33, 0.25, 0.285],
  Jupiter: [0.358, 0.443, 0.538, 0.495, 0.321, 0.513, 0.389],
  Saturn: [0.203, 0.339, 0.499, 0.568, 0.423, 0.646, 0.543],
  Uranus: [0.502, 0.561, 0.488, 0.202, 0.079, 0.264, 0.089],
  Neptune: [0.578, 0.562, 0.442, 0.181, 0.067, 0.226, 0.072]
};

// Table 3 - V-band reference magnitudes M(1,0), verbatim.
export const PLANET_VREF = {
  Mercury: -0.69,
  Venus: -4.38,
  Earth: -3.99,
  Mars: -1.6,
  Jupiter: -9.4,
  Saturn: -8.91,
  Uranus: -7.11,
  Neptune: -6.94
};

// The paper's worked example inputs (their Eqs. 3-4).
export const SATURN_RADIUS_KM = 57240; // printed, incl. oblateness
export const KM_PER_AU = 149.6e6; // printed in the example

// Venus's observed V illumination phase polynomial (Table A-2.2,
// V column, verbatim; valid to the printed 165 degrees).
export const VENUS_PHASE_V = [-4.384, -1.044e-3, 3.687e-4, -2.814e-6, 8.938e-9];

// Jupiter's V illumination quadratic (Table A-5.2, verbatim;
// observed 0-12 degrees).
export const JUPITER_PHASE_V = [-9.395, -3.7e-4, 6.16e-4];

export function phasePoly(coeffs, alphaDeg) {
  let m = 0;
  let p = 1;
  for (const c of coeffs) {
    m += c * p;
    p *= alphaDeg;
  }
  return m;
}

// The drawn tint: the sunlight carrier (the stars' own Planck
// chain at the printed solar colour) times the printed B/V/R
// geometric albedos on the theme's matching 440/550/680
// channels, normalised max-1 (a chromaticity carrier, exactly
// like every star - brightness stays in the magnitude term).
export function planetTintRGB(name) {
  const p = PLANET_ALBEDO[name];
  if (!p) return [1, 1, 1];
  const sun = starTintRGB(T_SUN);
  const rgb = [
    sun[0] * p[3], // R band 0.700 um -> the 680 channel
    sun[1] * p[2], // V band 0.549 um -> the 550 channel
    sun[2] * p[1] // B band 0.436 um -> the 440 channel
  ];
  const mx = Math.max(...rgb);
  return rgb.map((v) => v / mx);
}
