/**
 * Physical aurora emission profiles - the single source shared by
 * the curtain material (sky-objects-tsl.js) and the reference
 * printer (aurora-reference.mjs). Double precision at init.
 *
 * Chain, each piece from the literature:
 *  - Upper atmosphere: the CIRA-72 Mean Reference Atmosphere as
 *    tabulated in the AFGL Handbook of Geophysics and the Space
 *    Environment (1985), ch. 14 tables 14-7 (75-120 km) and 14-9
 *    (120-500 km): T and log10 number densities of N2, O2, O, Ar
 *    (m^-3). Mass density, mean molecular weight and scale height
 *    are derived from the table itself; column mass integrates the
 *    piecewise-exponential profile analytically.
 *  - Electron energy deposition: Fang, Randall, Lummerzheim, Wang,
 *    Lu, Solomon & Frahm (2010, GRL 37, L22106) parameterization of
 *    ISOTROPIC monoenergetic 100 eV - 1 MeV electron impact
 *    ionization: y = (2/E)(rho H / 6e-6)^0.7,
 *    f(y,E) = C1 y^C2 exp(-C3 y^C4) + C5 y^C6 exp(-C7 y^C8),
 *    Ci = exp(sum_j Pij ln(E)^j) with their table-1 coefficients
 *    verbatim, q = f Q / (0.035 keV * H). A Maxwellian spectrum of
 *    characteristic energy E0 (flux ~ E exp(-E/E0), the standard
 *    auroral form) is integrated by log-E quadrature.
 *  - Ionization partitioning between species: the standard Rees
 *    (1989, "Physics and chemistry of the upper atmosphere")
 *    apportionment weights 0.92 n(N2) : 1.0 n(O2) : 0.56 n(O).
 *  - Lines: 427.8 nm N2+ 1NG follows the N2 ionization share.
 *    557.7 nm O(1S) ALSO follows the N2 share: its dominant source
 *    at the emission peak is the N2(A3Sigma) energy-transfer chain
 *    (Rees 1989 ch. 5) - which is why the photometric 5577/4278
 *    ratio is famously near-constant - modulated by O(1S) O2
 *    quenching at the lower border. 630.0 nm O(1D) follows the
 *    atomic-oxygen share (direct impact / recombination on O). The
 *    absolute excitation-transfer yields fold into the calibrated
 *    per-line display gains - profiles are the physics, gains are
 *    exposure. O(1D) collisional quenching uses
 *    A = 0.0091 s^-1 (tau ~ 110 s) against
 *    k(N2) = 2.0e-11 exp(107.8/T) and
 *    k(O2) = 2.9e-11 exp(67.5/T) cm^3/s (Streit et al. 1976) - the
 *    quenching TRANSITION altitude is what matters and it is
 *    insensitive to factor-level rate error because n(N2) falls an
 *    order of magnitude every ~20 km. O(1S) quenching by O2
 *    (A = 1.35 s^-1, k = 4.0e-12 exp(-865/T)) only nibbles below
 *    ~95 km.
 *  - Line colors: CIE 1931 CMFs via the Wyman, Sloan & Shirley
 *    (2013, JCGT) multi-lobe Gaussian fits, XYZ -> linear sRGB.
 *
 * What emerges without tuning: the green lower border near 100 km,
 * ionization peaks sweeping 230 -> 105 km as electrons harden from
 * 0.1 to 10 keV, red 630.0 nm confined above ~200 km by quenching
 * (soft precipitation -> red-dominated tall aurora, hard -> green
 * curtains with a purple N2+ fringe at the bottom).
 */

// [z km, T K, log10 n m^-3: N2, O2, O, Ar] - CIRA-72 mean (AFGL
// Handbook 1985 tables 14-7 / 14-9; the 120 km row is identical in
// both tables, which pins the column alignment).
const ATMO = [
  [90, 183.4, 19.747, 19.153, 17.22, 17.802],
  [95, 189.3, 19.346, 18.739, 17.28, 17.389],
  [100, 199.4, 18.94, 18.299, 17.618, 16.945],
  [105, 216.6, 18.556, 17.823, 17.647, 16.435],
  [110, 245.1, 18.2, 17.398, 17.509, 15.961],
  [115, 285.2, 17.872, 17.036, 17.332, 15.539],
  [120, 334.5, 17.579, 16.734, 17.153, 15.173],
  [125, 389.7, 17.322, 16.449, 16.978, 14.835],
  [130, 445.4, 17.098, 16.203, 16.826, 14.541],
  [135, 499.0, 16.903, 15.987, 16.693, 14.284],
  [140, 549.0, 16.731, 15.796, 16.577, 14.056],
  [145, 594.5, 16.577, 15.624, 16.474, 13.85],
  [150, 635.2, 16.437, 15.469, 16.381, 13.663],
  [155, 671.3, 16.308, 15.325, 16.298, 13.49],
  [160, 703.1, 16.189, 15.192, 16.221, 13.328],
  [165, 731.3, 16.077, 15.066, 16.15, 13.176],
  [170, 756.2, 15.971, 14.947, 16.083, 13.031],
  [175, 778.4, 15.87, 14.834, 16.02, 12.892],
  [180, 798.1, 15.773, 14.724, 15.96, 12.758],
  [185, 815.9, 15.679, 14.619, 15.902, 12.629],
  [190, 831.9, 15.589, 14.517, 15.847, 12.504],
  [195, 846.3, 15.501, 14.418, 15.794, 12.382],
  [200, 859.3, 15.415, 14.321, 15.742, 12.262],
  [210, 882.0, 15.25, 14.133, 15.642, 12.031],
  [220, 900.7, 15.09, 13.952, 15.547, 11.807],
  [230, 916.4, 14.936, 13.777, 15.456, 11.59],
  [240, 929.4, 14.785, 13.606, 15.367, 11.378],
  [250, 940.2, 14.638, 13.438, 15.281, 11.171],
  [260, 949.3, 14.494, 13.274, 15.197, 10.967],
  [270, 956.8, 14.352, 13.112, 15.114, 10.766],
  [280, 963.1, 14.212, 12.953, 15.033, 10.567],
  [290, 968.4, 14.073, 12.795, 14.953, 10.371],
  [300, 972.8, 13.937, 12.639, 14.874, 10.177],
  [310, 976.5, 13.801, 12.485, 14.796, 9.984],
  [320, 979.7, 13.667, 12.332, 14.719, 9.793],
  [330, 982.3, 13.533, 12.179, 14.642, 9.604],
  [340, 984.6, 13.401, 12.028, 14.566, 9.415],
  [350, 986.5, 13.269, 11.878, 14.49, 9.228],
  [360, 988.1, 13.139, 11.729, 14.415, 9.041],
  [370, 989.5, 13.008, 11.58, 14.341, 8.856],
  [380, 990.7, 12.879, 11.432, 14.267, 8.672],
  [390, 991.7, 12.75, 11.285, 14.193, 8.488],
  [400, 992.6, 12.621, 11.138, 14.119, 8.305]
];

// Fang et al. (2010) table 1: Pij for isotropically incident
// monoenergetic electrons, i = 1..8 rows, j = 0..3 columns.
const PIJ = [
  [1.24616, 1.45903, -0.242269, 0.0595459],
  [2.23976, -4.22918e-7, 0.0136458, 0.00253332],
  [1.41754, 0.144597, 0.0170433, 6.39717e-4],
  [0.248775, -0.15089, 6.30894e-9, 0.00123707],
  [-0.465119, -0.105081, -0.0895701, 0.012245],
  [0.386019, 0.0017543, -7.4296e-4, 4.60881e-4],
  [-0.645454, 8.49555e-4, -0.0428581, -0.00299302],
  [0.94893, 0.197385, -0.0025066, -0.00206938]
];

const AMU = 1.6605390666e-24; // g
const KB = 1.380649e-16; // erg/K
const M_N2 = 28.0134;
const M_O2 = 31.9988;
const M_O = 15.9994;
const M_AR = 39.948;

// Per-row derived state (number densities cm^-3, rho g/cm^3, mean
// molecular mass g, scale height cm, column mass g/cm^2).
function atmosphere() {
  const rows = ATMO.map(([z, T, lN2, lO2, lO, lAr]) => {
    const n2 = Math.pow(10, lN2) * 1e-6;
    const o2 = Math.pow(10, lO2) * 1e-6;
    const o = Math.pow(10, lO) * 1e-6;
    const ar = Math.pow(10, lAr) * 1e-6;
    const rho = (n2 * M_N2 + o2 * M_O2 + o * M_O + ar * M_AR) * AMU;
    const ntot = n2 + o2 + o + ar;
    const mbar = ((n2 * M_N2 + o2 * M_O2 + o * M_O + ar * M_AR) / ntot) * AMU;
    const g = 980.665 * Math.pow(6371 / (6371 + z), 2); // cm/s^2
    const H = (KB * T) / (mbar * g); // cm
    return {z, T, n2, o2, o, ar, rho, mbar, H};
  });
  // Column mass from above, integrating each piecewise-exponential
  // segment analytically: rho(z) = rho_i exp(-(z-z_i)/h) with h from
  // the row pair; integral = h (rho_i - rho_{i+1}). Above the table
  // the exponential tail h_top rho_top closes the integral.
  const n = rows.length;
  const col = new Array(n).fill(0);
  const hTop =
    ((ATMO[n - 1][0] - ATMO[n - 2][0]) * 1e5) /
    Math.log(rows[n - 2].rho / rows[n - 1].rho);
  col[n - 1] = rows[n - 1].rho * hTop;
  for (let i = n - 2; i >= 0; i--) {
    const dzCm = (ATMO[i + 1][0] - ATMO[i][0]) * 1e5;
    const h = dzCm / Math.log(rows[i].rho / rows[i + 1].rho);
    col[i] = col[i + 1] + h * (rows[i].rho - rows[i + 1].rho);
  }
  rows.forEach((r, i) => (r.col = col[i]));
  return rows;
}
const ROWS = atmosphere();

// Fang et al. (2010): normalized dissipation f(y, E) (E in keV).
export function fangF(y, E) {
  const lE = Math.log(E);
  const C = PIJ.map(([p0, p1, p2, p3]) =>
    Math.exp(p0 + p1 * lE + p2 * lE * lE + p3 * lE * lE * lE)
  );
  return (
    C[0] * Math.pow(y, C[1]) * Math.exp(-C[2] * Math.pow(y, C[3])) +
    C[4] * Math.pow(y, C[5]) * Math.exp(-C[6] * Math.pow(y, C[7]))
  );
}

// Total ionization rate profile (cm^-3 s^-1 per unit incident energy
// flux of 1 keV cm^-2 s^-1) for monoenergetic isotropic electrons.
export function qMono(E) {
  return ROWS.map((r) => {
    const y = (2 / E) * Math.pow((r.rho * r.H) / 6e-6, 0.7);
    return (fangF(y, E) * 1) / (0.035 * r.H);
  });
}

// Maxwellian of characteristic energy E0 (keV): number flux
// ~ E exp(-E/E0); each monoenergetic profile is weighted by its
// share of the TOTAL energy flux (Fang's q scales with Qmono).
export function qMaxwellian(E0) {
  const NE = 60;
  const eMin = Math.max(0.1, E0 / 30);
  const eMax = Math.min(1000, E0 * 12);
  const lmin = Math.log(eMin);
  const dl = (Math.log(eMax) - lmin) / NE;
  const q = new Array(ROWS.length).fill(0);
  let wsum = 0;
  for (let k = 0; k < NE; k++) {
    const E = Math.exp(lmin + (k + 0.5) * dl);
    // energy-flux weight: E * (number flux E exp(-E/E0)) * dE
    const w = E * E * Math.exp(-E / E0) * E * dl;
    wsum += w;
    const qm = qMono(E);
    for (let i = 0; i < q.length; i++) q[i] += w * qm[i];
  }
  return q.map((v) => v / wsum);
}

// O(1D) 630.0 nm quenching survival (Streit et al. 1976 rates).
export function quench1D(r) {
  const A = 0.0091; // s^-1, tau ~ 110 s
  const kN2 = 2.0e-11 * Math.exp(107.8 / r.T);
  const kO2 = 2.9e-11 * Math.exp(67.5 / r.T);
  return A / (A + kN2 * r.n2 + kO2 * r.o2);
}

// O(1S) 557.7 nm quenching survival (O2; only bites below ~95 km).
export function quench1S(r) {
  const A = 1.35; // s^-1
  const kO2 = 4.0e-12 * Math.exp(-865 / r.T);
  return A / (A + kO2 * r.o2);
}

// CIE 1931 CMFs - Wyman, Sloan & Shirley (2013) multi-lobe fits.
function gauss(x, mu, s1, s2) {
  const s = x < mu ? s1 : s2;
  const t = (x - mu) / s;
  return Math.exp(-0.5 * t * t);
}
export function wavelengthToLinearSRGB(nm) {
  const X =
    1.056 * gauss(nm, 599.8, 37.9, 31.0) +
    0.362 * gauss(nm, 442.0, 16.0, 26.7) -
    0.065 * gauss(nm, 501.1, 20.4, 26.2);
  const Y =
    0.821 * gauss(nm, 568.8, 46.9, 40.5) + 0.286 * gauss(nm, 530.9, 16.3, 31.1);
  const Z =
    1.217 * gauss(nm, 437.0, 11.8, 36.0) + 0.681 * gauss(nm, 459.0, 26.0, 13.8);
  // XYZ -> linear sRGB (IEC 61966-2-1), then clip out-of-gamut
  // (spectral lines sit outside sRGB) and peak-normalise.
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.204 * Y + 1.057 * Z;
  r = Math.max(r, 0);
  g = Math.max(g, 0);
  b = Math.max(b, 0);
  const m = Math.max(r, g, b, 1e-9);
  return [r / m, g / m, b / m];
}

export const Z_MIN = 90;
export const Z_MAX = 400;

/**
 * The curtain's altitude LUT for characteristic energy E0 (keV):
 * bins rows over z in [Z_MIN, Z_MAX] km, RGBA =
 * (I_6300, I_5577, I_4278, 1) volume-emission profiles, jointly
 * normalised (the max over all three lines is 1) so the
 * INTER-LINE ratios and altitude structure are preserved; the
 * material applies per-line colors and calibrated display gains.
 */
export function buildAuroraLUT(E0, bins = 128) {
  const q = qMaxwellian(E0);
  const prof = [];
  for (let i = 0; i < ROWS.length; i++) {
    const r = ROWS[i];
    const denom = 0.92 * r.n2 + r.o2 + 0.56 * r.o;
    const pN2 = (0.92 * r.n2) / denom;
    const fO = r.o / (r.n2 + r.o2 + r.o + r.ar);
    prof.push([
      q[i] * fO * quench1D(r), // 630.0: O(1D), oxygen share
      q[i] * pN2 * quench1S(r), // 557.7: N2(A) transfer chain
      q[i] * pN2 // 427.8: N2+ 1NG
    ]);
  }
  // resample the table rows onto a uniform altitude grid
  const out = new Float32Array(bins * 4);
  let peak = 0;
  const at = (z) => {
    let i = 0;
    while (i < ROWS.length - 2 && ATMO[i + 1][0] < z) i++;
    const t = (z - ATMO[i][0]) / (ATMO[i + 1][0] - ATMO[i][0]);
    const tt = Math.min(Math.max(t, 0), 1);
    return [0, 1, 2].map((c) => prof[i][c] * (1 - tt) + prof[i + 1][c] * tt);
  };
  const vals = [];
  for (let b = 0; b < bins; b++) {
    const z = Z_MIN + ((b + 0.5) / bins) * (Z_MAX - Z_MIN);
    const v = at(z);
    vals.push(v);
    peak = Math.max(peak, v[0], v[1], v[2]);
  }
  for (let b = 0; b < bins; b++) {
    out[b * 4] = vals[b][0] / peak;
    out[b * 4 + 1] = vals[b][1] / peak;
    out[b * 4 + 2] = vals[b][2] / peak;
    out[b * 4 + 3] = 1;
  }
  return {data: out, bins, zMin: Z_MIN, zMax: Z_MAX};
}

// Exposed for the reference printer.
export {ROWS as ATMO_ROWS};
