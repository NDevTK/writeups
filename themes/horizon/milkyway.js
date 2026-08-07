/**
 * Milky Way - the single source shared by the theme's galaxy
 * dome (Horizon.html) and the reference printer
 * (milkyway-reference.mjs).
 *
 * The galaxy is MEASURED - literally star by star. The map in
 * milkyway-data.js comes from TWO server-side aggregations over
 * the ENTIRE Gaia DR3 catalogue (ESA TAP, queries recorded in
 * that file's header): the G, BP and RP fluxes of all 1.8
 * billion sources summed per HEALPix level-5 cell (12288 cells
 * of 3.36 deg^2), MINUS the same sums restricted to G < 5.5 -
 * because the theme already draws the bright end as individual
 * points (Yale BSC to V 5.5), the dome carries only the light
 * fainter than that. This is the very construction of the
 * Pioneer 10/11 background maps (bright stars excluded), and it
 * is the integrated starlight itself - no model, no artist's
 * panorama - complete to G~21 (Vallenari et al. 2023, A&A 674,
 * A1). Gaia's own bright limit (G ~ 3, saturated stars missing)
 * lands on the drawn side of the split: consistent both ways.
 *
 * This module owns the exact machinery around the data:
 *  - HEALPix NESTED pix2ang, the Gorski et al. 2005 (ApJ 622,
 *    759) construction: 12 base pixels, bit-interleaved (x, y)
 *    in-face coordinates, the polar/equatorial zone split at
 *    |z| = 2/3. Gaia source_id embeds this pixelisation
 *    (level-12 nested in the top bits; integer division by
 *    2^35 * 4^7 yields level 5).
 *  - the exact J2000 equatorial <-> galactic rotation (IAU
 *    frame: NGP at RA 192.85948, Dec +27.12825, theta_0 =
 *    122.93192 deg - Perryman & ESA 1997, the Hipparcos
 *    definition Gaia inherits).
 *  - Gaia G -> Johnson V via the DR3 photometric relationship
 *    (Riello et al. 2021, A&A 649, A3, Landolt table):
 *      G - V = -0.02704 + 0.01424 c - 0.2156 c^2 + 0.01426 c^3
 *    with c = BP - RP, applied per cell with the CELL's
 *    integrated colour.
 *  - conversion to S10 units (one V = 10 mag solar-type star
 *    per square degree) - the SAME unit the zodiacal light item
 *    uses from the SAME Leinert et al. 1998 framework, so the
 *    existing zodiacal display calibration (zlPerGreen) sets
 *    the Milky Way's absolute brightness with NO new free
 *    parameter: the galaxy/zodiacal contrast is right by
 *    construction.
 *
 * Zero point: V flux for the S10 reference is VEGAMAG; the DR3
 * G-band VEGAMAG zero point is 25.6874 (e-/s; Riello 2021).
 */

// ---- HEALPix (nested), Gorski et al. 2005 ----------------------
export const HPX_LEVEL = 5;
export const HPX_NSIDE = 1 << HPX_LEVEL; // 32
export const HPX_NPIX = 12 * HPX_NSIDE * HPX_NSIDE; // 12288
// Gaia source_id -> level-5 nested pixel: floor division by
// 2^35 * 4^(12-5).
export const GAIA_HPX5_DIV = 2 ** 35 * 4 ** 7;

// Face centres (Gorski Fig. 4): F1 = row of the face (0..2),
// F2 = column offset. Faces 0-3 north polar, 4-7 equatorial,
// 8-11 south polar.
const F1 = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4];
const F2 = [1, 3, 5, 7, 0, 2, 4, 6, 1, 3, 5, 7];

// De-interleave the even bits (compressed) of a nested index.
function extractBits(n) {
  let x = 0;
  for (let b = 0; b < 16; b++) {
    x |= ((n >> (2 * b)) & 1) << b;
  }
  return x;
}

// Nested pixel centre -> {z: cos(colatitude), phi (rad)}.
// The Gorski construction, exact: in-face coordinates (ix, iy)
// from bit de-interleaving, vertical index jr = F1*nside - ix -
// iy - 1 selects the ring; north polar cap (jr < nside), the
// equatorial belt, and south cap (jr > 3 nside) each have their
// closed-form z and azimuth.
export function pix2ang(pix, nside = HPX_NSIDE) {
  const npface = nside * nside;
  const face = Math.floor(pix / npface);
  const p = pix % npface;
  const ix = extractBits(p);
  const iy = extractBits(p >> 1);
  const jr = F1[face] * nside - ix - iy - 1;
  let z;
  let kshift;
  let nr;
  let jp;
  if (jr < nside) {
    // north polar cap: ring index IS jr (Gorski/healpy)
    nr = jr;
    z = 1 - (nr * nr) / (3 * nside * nside);
    kshift = 0;
  } else if (jr > 3 * nside) {
    // south polar cap
    nr = 4 * nside - jr;
    z = -1 + (nr * nr) / (3 * nside * nside);
    kshift = 0;
  } else {
    // equatorial belt
    nr = nside;
    z = ((2 * nside - jr) * 2) / (3 * nside);
    kshift = (jr - nside) & 1;
  }
  jp = (F2[face] * nr + ix - iy + 1 + kshift) / 2;
  if (jp > 4 * nside) jp -= 4 * nside;
  if (jp < 1) jp += 4 * nside;
  const phi = ((jp - (kshift + 1) * 0.5) * Math.PI) / (2 * nr);
  return {z, phi};
}

// Interleave bits: (ix, iy) -> nested in-face index.
function interleaveBits(ix, iy) {
  let p = 0;
  for (let b = 0; b < 16; b++) {
    p |= ((ix >> b) & 1) << (2 * b);
    p |= ((iy >> b) & 1) << (2 * b + 1);
  }
  return p;
}

// Direction -> nested pixel (the Gorski inverse; gated by a full
// round trip with pix2ang over every pixel).
export function ang2pix(z, phi, nside = HPX_NSIDE) {
  const za = Math.abs(z);
  let tt = (phi / (Math.PI / 2)) % 4;
  if (tt < 0) tt += 4;
  let face;
  let ix;
  let iy;
  if (za <= 2 / 3) {
    // equatorial belt
    const temp1 = nside * (0.5 + tt);
    const temp2 = nside * z * 0.75;
    const jp = Math.floor(temp1 - temp2);
    const jm = Math.floor(temp1 + temp2);
    const ifp = Math.floor(jp / nside);
    const ifm = Math.floor(jm / nside);
    if (ifp === ifm) face = (ifp & 3) + 4;
    else if (ifp < ifm) face = ifp & 3;
    else face = (ifm & 3) + 8;
    ix = jm & (nside - 1);
    iy = nside - 1 - (jp & (nside - 1));
  } else {
    // polar caps
    const ntt = Math.min(3, Math.floor(tt));
    const tp = tt - ntt;
    const tmp = nside * Math.sqrt(3 * (1 - za));
    let jp = Math.floor(tp * tmp);
    let jm = Math.floor((1 - tp) * tmp);
    jp = Math.min(jp, nside - 1);
    jm = Math.min(jm, nside - 1);
    if (z >= 0) {
      face = ntt;
      ix = nside - jm - 1;
      iy = nside - jp - 1;
    } else {
      face = ntt + 8;
      ix = jp;
      iy = jm;
    }
  }
  return face * nside * nside + interleaveBits(ix, iy);
}

// ---- J2000 equatorial <-> galactic (exact rotation) ------------
const D2R = Math.PI / 180;
export const NGP_RA = 192.85948;
export const NGP_DEC = 27.12825;
export const GAL_THETA0 = 122.93192; // position angle of the NCP
// Rotation matrix equatorial -> galactic, built from the three
// defining angles (no rounded literals beyond the IAU values).
function galMatrix() {
  const a = NGP_RA * D2R;
  const d = NGP_DEC * D2R;
  const t = GAL_THETA0 * D2R;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const cd = Math.cos(d);
  const sd = Math.sin(d);
  const ct = Math.cos(t);
  const st = Math.sin(t);
  // R = Rz(theta0 - 90) * Rx(90 - dec_NGP) * Rz(ra_NGP + 90),
  // composed explicitly:
  return [
    [-sa * st - ca * sd * ct, ca * st - sa * sd * ct, cd * ct],
    [sa * ct - ca * sd * st, -ca * ct - sa * sd * st, cd * st],
    [ca * cd, sa * cd, sd]
  ];
}
const GAL_M = galMatrix();

// RA/Dec (deg) -> galactic l, b (deg).
export function equToGal(raDeg, decDeg) {
  const ra = raDeg * D2R;
  const dec = decDeg * D2R;
  const v = [
    Math.cos(dec) * Math.cos(ra),
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec)
  ];
  const g = [
    GAL_M[0][0] * v[0] + GAL_M[0][1] * v[1] + GAL_M[0][2] * v[2],
    GAL_M[1][0] * v[0] + GAL_M[1][1] * v[1] + GAL_M[1][2] * v[2],
    GAL_M[2][0] * v[0] + GAL_M[2][1] * v[1] + GAL_M[2][2] * v[2]
  ];
  const b = Math.asin(Math.max(-1, Math.min(1, g[2]))) / D2R;
  let l = Math.atan2(g[1], g[0]) / D2R;
  if (l < 0) l += 360;
  return {l, b};
}

// Galactic l, b (deg) -> RA/Dec (deg) (transpose - rotation
// matrices invert by transposition).
export function galToEqu(lDeg, bDeg) {
  const l = lDeg * D2R;
  const b = bDeg * D2R;
  const g = [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)];
  const v = [
    GAL_M[0][0] * g[0] + GAL_M[1][0] * g[1] + GAL_M[2][0] * g[2],
    GAL_M[0][1] * g[0] + GAL_M[1][1] * g[1] + GAL_M[2][1] * g[2],
    GAL_M[0][2] * g[0] + GAL_M[1][2] * g[1] + GAL_M[2][2] * g[2]
  ];
  const dec = Math.asin(Math.max(-1, Math.min(1, v[2]))) / D2R;
  let ra = Math.atan2(v[1], v[0]) / D2R;
  if (ra < 0) ra += 360;
  return {ra, dec};
}

// ---- Gaia photometry -> S10 surface brightness -----------------
export const G_ZP_VEGA = 25.6874; // DR3 G VEGAMAG zero point
// Riello et al. 2021 (DR3), G - V vs (BP - RP), Landolt table.
export function gMinusV(bpRp) {
  const c = bpRp;
  return -0.02704 + 0.01424 * c - 0.2156 * c * c + 0.01426 * c * c * c;
}

// One cell's integrated fluxes -> S10(V) surface brightness.
// fg in e-/s summed over the cell; the cell's integrated colour
// BP-RP from the summed BP and RP fluxes (BP zero point 25.3385,
// RP 24.7479 - Riello 2021); area in deg^2.
export const BP_ZP_VEGA = 25.3385;
export const RP_ZP_VEGA = 24.7479;
export function cellS10(fg, fbp, frp, areaDeg2) {
  if (!(fg > 0)) return {s10: 0, bpRp: 0.8};
  const g = -2.5 * Math.log10(fg) + G_ZP_VEGA;
  let bpRp = 0.8; // solar-ish fallback when BP/RP missing
  if (fbp > 0 && frp > 0) {
    bpRp =
      -2.5 * Math.log10(fbp) +
      BP_ZP_VEGA -
      (-2.5 * Math.log10(frp) + RP_ZP_VEGA);
  }
  const v = g - gMinusV(bpRp);
  // S10: one V=10 star per deg^2 -> total V mag of the cell vs
  // a 10th-mag star, spread over its area.
  const s10 = Math.pow(10, -0.4 * (v - 10)) / areaDeg2;
  return {s10, bpRp};
}

export const CELL_AREA_DEG2 = 41252.96125 / HPX_NPIX; // 3.357

// ---- the EDR3 passbands: a cell's colour as a temperature ------
// The BP and RP response curves S(lambda) from the EDR3 passband
// release (Riello et al. 2021, A&A 649, A3 - read in full; files
// distributed "in electronic tabular format as a part of this
// paper", fetched from the DPAC passband page, version 2),
// decimated to the 5 nm grid below (the gate re-derives the
// paper's Table 3 pivot wavelengths, 510.97 / 776.91 nm, from
// these rows to 0.1 nm). With the paper's own synthetic-
// photometry frame (its Eqs. 13-17: photon-weighted VEGAMAG,
// f_nu-weighted AB, and one printed zero point per band per
// system) a blackbody's VEGAMAG colour needs NO Vega spectrum:
// per band m_VEG - m_AB = ZP_VEG - ZP_AB (both printed in
// Table 3), so
//   (BP-RP)_VEG = (BP-RP)_AB + (BP_ZP_VEGA - BP_ZP_AB)
//                            - (RP_ZP_VEGA - RP_ZP_AB),
// and (BP-RP)_AB comes from the vendored curves and Planck's law
// alone. Inverting that monotone relation reads each cell's
// integrated colour as a blackbody temperature - the SAME frame
// the star sprites' tints ride (stars-color.js), so the galaxy
// and the drawn stars share one cited colour chain. Stated
// reduction: a cell's light is a mixed population, drawn here as
// the single blackbody of the same EDR3 colour (line blanketing
// shifts real stars a few hundredths of a mag in BP-RP off the
// blackbody locus - the solar-Teff blackbody sits at 0.868 where
// the Sun measures ~0.82).
export const BP_ZP_AB = 25.354; // Riello 2021 Table 3
export const RP_ZP_AB = 25.104;
export const BPRP_VEGA_MINUS_AB =
  BP_ZP_VEGA - BP_ZP_AB - (RP_ZP_VEGA - RP_ZP_AB);
export const GAIA_BP_PASSBAND = [
  [325, 3.8705e-5],
  [330, 0.010946],
  [335, 0.096035],
  [340, 0.20978],
  [345, 0.24624],
  [350, 0.18465],
  [355, 0.19699],
  [360, 0.23526],
  [365, 0.22397],
  [370, 0.20435],
  [375, 0.17832],
  [380, 0.16214],
  [385, 0.18406],
  [390, 0.25435],
  [395, 0.34762],
  [400, 0.43218],
  [405, 0.49247],
  [410, 0.53347],
  [415, 0.56057],
  [420, 0.5783],
  [425, 0.5899],
  [430, 0.59902],
  [435, 0.60758],
  [440, 0.6153],
  [445, 0.62321],
  [450, 0.62699],
  [455, 0.62786],
  [460, 0.62703],
  [465, 0.62757],
  [470, 0.6292],
  [475, 0.63221],
  [480, 0.63464],
  [485, 0.63534],
  [490, 0.63529],
  [495, 0.63406],
  [500, 0.63146],
  [505, 0.63079],
  [510, 0.63012],
  [515, 0.63018],
  [520, 0.63001],
  [525, 0.62766],
  [530, 0.62335],
  [535, 0.62122],
  [540, 0.62017],
  [545, 0.61996],
  [550, 0.62269],
  [555, 0.62295],
  [560, 0.61933],
  [565, 0.61428],
  [570, 0.60859],
  [575, 0.60527],
  [580, 0.61329],
  [585, 0.63077],
  [590, 0.6432],
  [595, 0.64122],
  [600, 0.62786],
  [605, 0.61363],
  [610, 0.61317],
  [615, 0.62558],
  [620, 0.64953],
  [625, 0.66653],
  [630, 0.66687],
  [635, 0.65093],
  [640, 0.62067],
  [645, 0.5787],
  [650, 0.52838],
  [655, 0.46237],
  [660, 0.3412],
  [665, 0.15848],
  [670, 0.035156],
  [675, 0.0037052],
  [680, 0.00072891]
];
export const GAIA_RP_PASSBAND = [
  [610, 0.00010668],
  [615, 0.00070504],
  [620, 0.0089591],
  [625, 0.089419],
  [630, 0.39453],
  [635, 0.68322],
  [640, 0.72846],
  [645, 0.67837],
  [650, 0.69325],
  [655, 0.69917],
  [660, 0.70683],
  [665, 0.71687],
  [670, 0.72586],
  [675, 0.73146],
  [680, 0.73177],
  [685, 0.72955],
  [690, 0.73113],
  [695, 0.7342],
  [700, 0.73759],
  [705, 0.73776],
  [710, 0.73519],
  [715, 0.73177],
  [720, 0.73223],
  [725, 0.73412],
  [730, 0.73956],
  [735, 0.74395],
  [740, 0.74344],
  [745, 0.74019],
  [750, 0.73839],
  [755, 0.74007],
  [760, 0.73919],
  [765, 0.73783],
  [770, 0.72999],
  [775, 0.72344],
  [780, 0.71484],
  [785, 0.70811],
  [790, 0.70454],
  [795, 0.7029],
  [800, 0.70376],
  [805, 0.70378],
  [810, 0.70123],
  [815, 0.69833],
  [820, 0.69046],
  [825, 0.68302],
  [830, 0.67502],
  [835, 0.66688],
  [840, 0.65525],
  [845, 0.64375],
  [850, 0.62786],
  [855, 0.61422],
  [860, 0.59849],
  [865, 0.58175],
  [870, 0.56643],
  [875, 0.55057],
  [880, 0.53206],
  [885, 0.51569],
  [890, 0.49984],
  [895, 0.48171],
  [900, 0.46318],
  [905, 0.44331],
  [910, 0.42365],
  [915, 0.4042],
  [920, 0.38373],
  [925, 0.36112],
  [930, 0.34096],
  [935, 0.32011],
  [940, 0.2992],
  [945, 0.27841],
  [950, 0.25554],
  [955, 0.23721],
  [960, 0.21654],
  [965, 0.19773],
  [970, 0.17879],
  [975, 0.16347],
  [980, 0.14539],
  [985, 0.13186],
  [990, 0.11426],
  [995, 0.098733],
  [1000, 0.081517],
  [1005, 0.066117],
  [1010, 0.052165],
  [1015, 0.040046],
  [1020, 0.030169],
  [1025, 0.022855],
  [1030, 0.016592],
  [1035, 0.012222],
  [1040, 0.0086189],
  [1045, 0.006114],
  [1050, 0.0042268],
  [1055, 0.0028113],
  [1060, 0.001905],
  [1065, 0.0012324],
  [1070, 0.00076934],
  [1075, 0.00049053],
  [1080, 0.00030284]
];

import {planckSpectralRadiance, LIGHT_C} from './stars-color.js';

// A blackbody's VEGAMAG BP-RP: the paper's Eq. 14/16 AB colour
// (per band <f_nu> = int f_lam S lam dlam / int S (c/lam) dlam,
// the -56.10 zero point cancelling in the band difference) plus
// the printed VEGAMAG-AB offset above.
export function bpRpOfPlanck(kelvin) {
  const band = (tab) => {
    let num = 0;
    let den = 0;
    for (const [nm, S] of tab) {
      const lam = nm * 1e-9;
      num += planckSpectralRadiance(nm, kelvin) * S * lam;
      den += (S * LIGHT_C) / lam;
    }
    return num / den;
  };
  return (
    -2.5 * Math.log10(band(GAIA_BP_PASSBAND) / band(GAIA_RP_PASSBAND)) +
    BPRP_VEGA_MINUS_AB
  );
}

// Monotone inversion over the star sprites' own catalogue span;
// colours outside the blackbody range clamp to the end
// temperatures.
export const BPRP_T_LO = 2300;
export const BPRP_T_HI = 45000;
export function kelvinFromBpRp(bpRp) {
  let lo = BPRP_T_LO;
  let hi = BPRP_T_HI;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    if (bpRpOfPlanck(mid) > bpRp) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}
