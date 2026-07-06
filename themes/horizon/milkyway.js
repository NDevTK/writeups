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
