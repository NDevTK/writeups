/**
 * Zodiacal light - the single source shared by the sky dome
 * (sky-objects-tsl.js) and the reference printer
 * (zodiacal-reference.mjs).
 *
 * Brightness: Leinert et al. (1998), "The 1997 reference of diffuse
 * night sky brightness" (A&AS 127, 1), Table 17 VERBATIM - the
 * zodiacal light observed from Earth at 500 nm in units of
 * 1e-8 W m^-2 sr^-1 um^-1, tabulated over the helioecliptic
 * quarter-sphere (differential ecliptic longitude dlam = 0..180 deg
 * x ecliptic latitude beta = 0..75 deg; the light is symmetric
 * about the ecliptic and the helioecliptic meridian). Toward the
 * ecliptic pole the paper gives 77 (= 60 +- 3 S10sun times its own
 * conversion factor 1.28e-8 from its Table 2), which closes the
 * beta axis at 90 deg. The five cells within ~15 deg of the Sun are
 * unobservable (blank in the paper) and are filled by constant
 * extrapolation along the column - that close to the Sun the scene
 * is daylight and the values are never displayed.
 *
 * Modulation (Masana et al. 2021, MNRAS, eqs. 15-18, following
 * Leinert): the brightness scales with the Earth's heliocentric
 * distance as fR = r^-2.3 (r in AU, from the ephemeris - a real
 * +-4% annual swing), and carries the symmetry-plane factor
 * fS = 1 + 0.1 sin(LamE - Omega) for |beta| >= 60 deg with the
 * ascending node Omega = 96 deg (the interplanetary dust cloud is
 * tilted; high-latitude brightness breathes +-10% over the year).
 *
 * Photometry: the tabulated spectral radiance at 500 nm converts to
 * luminance with the solar spectrum (the zodiacal light IS
 * scattered sunlight): L_v = 683 lm/W x value x 1e-8 x
 * int V(lambda) S(lambda)/S(500nm) dlambda, S a 5772 K Planck
 * proxy and V the same CIE-Y fit the airglow uses. The classic
 * checks land: the ecliptic pole (77) comes out ~23.2 V mag
 * arcsec^-2 and the Gegenschein (230) ~22.0 - the published
 * surface brightnesses. The display then shares the airglow's ONE
 * documented exposure: the shader multiplies the table value by
 * ZL_PER_GREEN (zodiacal luminance per table unit over the
 * luminance of the airglow's reference green line) so both effects
 * sit on the same photometric scale under AGLOW_GAIN.
 */

import {gaussLegendre} from './ross-li.js';
import {cieY, lineLuminance} from './airglow.js';

// Leinert et al. 1998 Table 17 rows (dlam deg) x columns (beta
// deg), 1e-8 W m^-2 sr^-1 um^-1 at 500 nm; null = unobservable.
export const ZL_BETA = [0, 5, 10, 15, 20, 25, 30, 45, 60, 75];
export const ZL_DLAM = [
  0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180
];
export const ZL_TABLE = [
  [null, null, null, 3140, 1610, 985, 640, 275, 150, 100],
  [null, null, null, 2940, 1540, 945, 625, 271, 150, 100],
  [null, null, 4740, 2470, 1370, 865, 590, 264, 148, 100],
  [11500, 6780, 3440, 1860, 1110, 755, 525, 251, 146, 100],
  [6400, 4480, 2410, 1410, 910, 635, 454, 237, 141, 99],
  [3840, 2830, 1730, 1100, 749, 545, 410, 223, 136, 97],
  [2480, 1870, 1220, 845, 615, 467, 365, 207, 131, 95],
  [1650, 1270, 910, 680, 510, 397, 320, 193, 125, 93],
  [1180, 940, 700, 530, 416, 338, 282, 179, 120, 92],
  [910, 730, 555, 442, 356, 292, 250, 166, 116, 90],
  [505, 442, 352, 292, 243, 209, 183, 134, 104, 86],
  [338, 317, 269, 227, 196, 172, 151, 116, 93, 82],
  [259, 251, 225, 193, 166, 147, 132, 104, 86, 79],
  [212, 210, 197, 170, 150, 133, 119, 96, 82, 77],
  [188, 186, 177, 154, 138, 125, 113, 90, 77, 74],
  [179, 178, 166, 147, 134, 122, 110, 90, 77, 73],
  [179, 178, 165, 148, 137, 127, 116, 96, 79, 72],
  [196, 192, 179, 165, 151, 141, 131, 104, 82, 72],
  [230, 212, 195, 178, 163, 148, 134, 105, 83, 72]
];
// Ecliptic pole (beta = 90): 60 +- 3 S10sun x 1.28e-8 (both from
// the paper) = 77 in table units, closing the beta axis.
export const ZL_POLE = 77;

// The table with the five sun-proximal blanks filled by constant
// extrapolation DOWN the column (toward the Sun the brightness only
// grows; never displayed - it is daylight there).
export function filledTable() {
  const t = ZL_TABLE.map((r) => r.slice());
  for (let j = 0; j < ZL_BETA.length; j++) {
    let first = 0;
    while (first < t.length && t[first][j] === null) first++;
    for (let i = 0; i < first; i++) t[i][j] = t[first][j];
  }
  return t;
}

// Bilinear sample of the irregular grid (double precision), with
// the symmetry folds: dlam mod 360 folded to [0, 180], beta to
// |beta| and the pole row appended.
export function sampleZL(dlamDeg, betaDeg) {
  let dl = Math.abs(dlamDeg % 360);
  if (dl > 180) dl = 360 - dl;
  const be = Math.min(Math.abs(betaDeg), 90);
  const t = filledTable();
  const betas = [...ZL_BETA, 90];
  const rows = t.map((r) => [...r, ZL_POLE]);
  let i = 0;
  while (i < ZL_DLAM.length - 2 && ZL_DLAM[i + 1] < dl) i++;
  let j = 0;
  while (j < betas.length - 2 && betas[j + 1] < be) j++;
  const fx = (dl - ZL_DLAM[i]) / (ZL_DLAM[i + 1] - ZL_DLAM[i]);
  const fy = (be - betas[j]) / (betas[j + 1] - betas[j]);
  return (
    rows[i][j] * (1 - fx) * (1 - fy) +
    rows[i + 1][j] * fx * (1 - fy) +
    rows[i][j + 1] * (1 - fx) * fy +
    rows[i + 1][j + 1] * fx * fy
  );
}

// Regular grid for the shader's one hardware-bilinear sample:
// W x H texels spanning dlam 0..180 (u) x beta 0..90 (v), texel
// CENTRES on the span ends.
export function buildZodiacalGrid(W = 96, H = 48) {
  const g = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      g[y * W + x] = sampleZL((x / (W - 1)) * 180, (y / (H - 1)) * 90);
    }
  }
  return g;
}

// Ecliptic coordinates of a direction in the theme's CELESTIAL
// basis (x = cos dec sin ra, y = sin dec, z = cos dec cos ra - the
// star dome's frame): rotate about the equinox axis (+z) by the
// obliquity. The dome shader mirrors this exactly.
export const OBLIQUITY = 23.439 * (Math.PI / 180);
export function eclipticOfDir(x, y, z) {
  const c = Math.cos(OBLIQUITY);
  const s = Math.sin(OBLIQUITY);
  const ex = z;
  const ey = x * c + y * s;
  const ez = y * c - x * s;
  return {
    lam: Math.atan2(ey, ex),
    beta: Math.asin(Math.max(-1, Math.min(1, ez)))
  };
}

// Heliocentric-distance factor (Masana eq. before 17; Leinert
// 1980): brightness at Earth ~ r^-2.3.
export function fR(rAU) {
  return Math.pow(rAU, -2.3);
}

// Symmetry-plane factor (Masana eq. 17): the dust cloud's node at
// Omega = 96 deg makes high-latitude brightness breathe +-10% with
// the Earth's ecliptic longitude LamE (= sun longitude + 180).
export const ZL_OMEGA = 96;
export function fS(betaDeg, lamEarthDeg) {
  return Math.abs(betaDeg) >= 60
    ? 1 + 0.1 * Math.sin((lamEarthDeg - ZL_OMEGA) * (Math.PI / 180))
    : 1;
}

// Luminance per table unit (cd m^-2 per 1e-8 W m^-2 sr^-1 um^-1):
// 683 x 1e-8 x int V(lambda) B(lambda, 5772K)/B(500nm) dlambda,
// by Gauss-Legendre over 0.36-0.83 um.
export function lumPerUnit() {
  const planck = (lamNm) => {
    const l = lamNm * 1e-9;
    return 1 / (Math.pow(l, 5) * (Math.exp(0.0143877688 / (l * 5772)) - 1));
  };
  const b500 = planck(500);
  const g = gaussLegendre(96);
  let s = 0;
  for (let i = 0; i < 96; i++) {
    const lam = 360 + ((830 - 360) / 2) * (g.x[i] + 1);
    s += g.w[i] * cieY(lam) * (planck(lam) / b500);
  }
  const integral = ((s * (830 - 360)) / 2) * 1e-3; // nm -> um
  return 683 * 1e-8 * integral;
}

// The display cross-calibration: zodiacal luminance per table unit
// over the luminance of the airglow's reference green line (163 R,
// the airglow shader's unit strength) - both effects share ONE
// documented exposure, AGLOW_GAIN.
export function zlPerGreen() {
  return lumPerUnit() / lineLuminance(163, 557.7, cieY(557.7));
}
