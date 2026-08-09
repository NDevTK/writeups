/**
 * whitecap.js - the foam's own printed optics. The COVERAGE side
 * already ships (Monahan & O Muircheartaigh 1980's robust fit is
 * the Jacobian mask's calibration statistic - ocean-reference
 * bisects the folding threshold to it, and the paper's Eq. 4/5
 * twins are gate-held there). This module owns what that coverage
 * PAINTS - the whitecap reflectance - so the last hand foam
 * colour retires. Mirrored by whitecap-reference.mjs.
 *
 * Printed sources, both read in full:
 *  - Dierssen 2019 (Front. Earth Sci. 7:14, open access):
 *    Eq. (7), the average whitecap reflectance (%) as a cubic in
 *    the LOGARITHM of liquid water absorption aw (m^-1):
 *      Rf = 0.47 x^3 - 1.62 x^2 - 8.66 x + 31.81,  x = log(aw).
 *    The paper leaves the log base implicit; base 10 is PROVEN
 *    internally and gate-held: with log10 the polynomial
 *    reproduces her own printed anchors ("average reflectance of
 *    ~40% in visible wavelengths"; the SWIR collapse Frouin
 *    measured as an 85% reduction at 1650 nm), while a natural
 *    log drives visible reflectance NEGATIVE - impossible.
 *  - the LEVEL: Koepke 1984's time-averaged effective whitecap
 *    reflectance of 22%, carried verbatim in Dierssen's open
 *    text ("reflectance varied from 20 to 55% upon initial wave
 *    breaking to 3-10% after 10 s and a time-averaged effective
 *    reflectance of whitecaps of 22% was derived") and
 *    corroborated by her own thin-foam measurement ("~18% ...
 *    nearly equivalent to 22% ... used as an average whitecap
 *    reflectance in current atmospheric correction algorithms").
 *    The Monahan mask marks the photographic whitecap area, and
 *    the effective reflectance is defined ON that area - the
 *    operational pairing.
 *  - the MIXED PIXEL: Rt = A Rf + (1 - A) Rw (Dierssen Eq. 12,
 *    "consistent with the standard model used in most
 *    atmospheric correction routines"; Gordon 1997's
 *    "area-weighted averages"). The water material's foam mix IS
 *    this equation - so its coverage weights are exact, not
 *    diluted.
 *  - the absorption input: the repo's own vendored Morel &
 *    Maritorena (2001) Table 2 Kw (m^-1, the clearest-water
 *    diffuse attenuation) stands in for the Rottgers pure-water
 *    aw the fit used - a DOCUMENTED substitution: Kw and aw agree
 *    to well under a factor two across the visible, and the
 *    reference gate BOUNDS what that can do - a full factor-two
 *    absorption error moves the raw polynomial under 3% absolute
 *    and the DRAWN colour (level re-pinned at 550 nm) under 1.5%.
 *
 * The composition (stated): the cubic carries the SPECTRAL SHAPE
 * across the theme's channels, pinned to the printed effective
 * level at the 550 nm channel - foam[c] = 0.22 Rf(aw_c)/Rf(aw_550).
 * Physics the shape delivers: the red channel dips below blue and
 * green (the liquid-water absorption side of her printed 600 nm
 * trough - aged foam is faintly cyan), and the visible stays
 * "nearly spectrally flat" (her sentence), both gate-held.
 */

import {TABLE2} from './morel.js';

// Dierssen 2019 Eq. (7) coefficients (percent reflectance).
export const DIERSSEN_POLY = [0.47, -1.62, -8.66, 31.81];
// Koepke 1984 via Dierssen's open text: the time-averaged
// effective whitecap reflectance, and the printed decay span it
// averages (fresh 20-55%, aged-after-10-s 3-10%).
export const FOAM_EFF_550 = 0.22;
export const KOEPKE_FRESH = [0.2, 0.55];
export const KOEPKE_AGED = [0.03, 0.1];
// Dierssen's own thin-foam visible reflectance ("~18%").
export const DIERSSEN_THIN = 0.18;
// The theme's channel wavelengths (cloud-corona's CHANNEL_UM
// order: r, g, b) in nm for the Table 2 lookup.
export const FOAM_CHANNEL_NM = [680, 550, 440];

// Kw (m^-1) at an exact Table 2 row - the vendored print, no
// interpolation (the three channels sit on 5 nm rows).
export function kwAt(nm) {
  const row = TABLE2.find((r) => r[0] === nm);
  if (!row) throw new Error('no Table 2 row at ' + nm + ' nm');
  return row[1];
}

// Eq. (7): average whitecap reflectance (fraction, 0-1) at a
// liquid water absorption aw (m^-1). Base-10 log, proven by the
// reference's internal anchors.
export function rfOfAw(awM1) {
  const x = Math.log10(awM1);
  const [a3, a2, a1, a0] = DIERSSEN_POLY;
  return (a3 * x * x * x + a2 * x * x + a1 * x + a0) / 100;
}

// The foam colour the Jacobian mask paints: Eq. (7)'s shape at
// the theme's channels, pinned to the printed effective level at
// the 550 nm channel.
export function foamRGB() {
  const g = rfOfAw(kwAt(FOAM_CHANNEL_NM[1]));
  return FOAM_CHANNEL_NM.map((nm) => (FOAM_EFF_550 * rfOfAw(kwAt(nm))) / g);
}

// Dierssen Eq. (12) - the mixed pixel, exact.
export function mixedPixel(rw, A, rf) {
  return A * rf + (1 - A) * rw;
}
