// Morel & Maritorena (2001), "Bio-optical properties of oceanic
// waters: a reappraisal", J. Geophys. Res. 106(C4), 7163-7180
// (doi:10.1029/2000JC000319). The Case-1 reflectance model, read
// straight off the paper and transcribed here verbatim so the water
// colour of an ocean cell is a physical consequence of that cell's
// measured chlorophyll (the daemon /chlor feed), not a hand-tuned
// gradient.
//
// The chain, by the paper's own equation numbers:
//   K(lambda)   = Kw(lambda) + chi(lambda) * Chl^e(lambda)      (3),(5)
//                 - the diffuse attenuation coefficient; Kw, chi, e
//                   are Table 2 (statistical fit to JGOFS AOPs).
//   R(lambda)   = f * bb(lambda) / a(lambda),   f = 0.33         (7)
//   a(lambda)   = Kd * mu_d * [1 + R*(mu_d/mu_u)]^-1 * [1 - R]   (8)
//                 - Gershun inversion, dR/dZ neglected; mu_u = 0.40,
//                   mu_d from Table 3 (varies 0.77 blue -> 0.91 red,
//                   theta_s = 30 deg). Solved by the paper's own
//                   iteration: seed a = 0.75*K, three loops.
//   bb(lambda)  = 0.5*bw(lambda) + bbp(lambda)                   (11)
//   bp550       = 0.416 * Chl^0.766                              (12)
//   bbp(lambda) = {0.002 + 0.01*[0.50 - 0.25*log10 Chl]
//                  * (lambda/550)^v} * bp550                     (13)
//   v           = 0.5*(log10 Chl - 0.3),  0.02 < Chl < 2;        (14)
//                 v = 0 for Chl > 2; the lambda^-1 slope is held
//                 at the low end (v -> -1 as Chl -> 0.02).
//
// The one input the paper references but tabulates elsewhere is the
// molecular scattering of pure seawater bw(lambda) [Morel, 1974]:
// bw(550) = 0.00193 m^-1 with a lambda^-4.32 law. That anchor
// reproduces the commonly quoted backscattering bbw = 0.5*bw of
// 0.0038 m^-1 at 400 nm and 0.00035 m^-1 at 700 nm - the internal
// cross-check in morel-reference.mjs.
//
// morel-reference.mjs holds this model to the paper's published
// numbers: the asymptotic R(443)/R(555) -> chi(555)/chi(443) ~ 0.38
// at high Chl, R(420) ~ 0.10 in the clearest water, the blue-to-green
// collapse of R(490)/R(555) with rising Chl (Figure 11), and the
// three-loop convergence.

// Table 2 - spectral values from the present statistical analysis:
// Kw (m^-1), the exponent e, and chi, at 5 nm from 350 to 700 nm.
// [lambda, Kw, e, chi]
export const TABLE2 = [
  [350, 0.0271, 0.778, 0.153],
  [355, 0.0238, 0.767, 0.149],
  [360, 0.0216, 0.756, 0.144],
  [365, 0.0188, 0.737, 0.14],
  [370, 0.0177, 0.72, 0.136],
  [375, 0.01595, 0.7, 0.131],
  [380, 0.0151, 0.685, 0.127],
  [385, 0.01376, 0.673, 0.123],
  [390, 0.01271, 0.67, 0.119],
  [395, 0.01208, 0.66, 0.118],
  [400, 0.01042, 0.64358, 0.11748],
  [405, 0.0089, 0.64776, 0.12066],
  [410, 0.00812, 0.65175, 0.12259],
  [415, 0.00765, 0.65555, 0.12326],
  [420, 0.00758, 0.65917, 0.12259],
  [425, 0.00768, 0.66259, 0.12086],
  [430, 0.0077, 0.66583, 0.11779],
  [435, 0.00792, 0.66889, 0.11372],
  [440, 0.00885, 0.67175, 0.10963],
  [445, 0.0099, 0.67443, 0.1056],
  [450, 0.01148, 0.67692, 0.10165],
  [455, 0.01182, 0.67923, 0.09776],
  [460, 0.01188, 0.68134, 0.09393],
  [465, 0.01211, 0.68327, 0.09018],
  [470, 0.01251, 0.68501, 0.08649],
  [475, 0.0132, 0.68657, 0.08287],
  [480, 0.01444, 0.68794, 0.07932],
  [485, 0.01526, 0.68903, 0.07584],
  [490, 0.0166, 0.68955, 0.07242],
  [495, 0.01885, 0.68947, 0.06907],
  [500, 0.02188, 0.6888, 0.06579],
  [505, 0.02701, 0.68753, 0.06257],
  [510, 0.03385, 0.68567, 0.05943],
  [515, 0.0409, 0.6832, 0.05635],
  [520, 0.04214, 0.68015, 0.05341],
  [525, 0.04287, 0.67649, 0.05072],
  [530, 0.04454, 0.67224, 0.04829],
  [535, 0.0463, 0.66739, 0.04611],
  [540, 0.04846, 0.66195, 0.04419],
  [545, 0.05212, 0.65591, 0.04253],
  [550, 0.05746, 0.64927, 0.04111],
  [555, 0.06053, 0.64204, 0.03996],
  [560, 0.0628, 0.64, 0.039],
  [565, 0.06507, 0.63, 0.0375],
  [570, 0.07034, 0.623, 0.036],
  [575, 0.07801, 0.615, 0.034],
  [580, 0.09038, 0.61, 0.033],
  [585, 0.11076, 0.614, 0.0328],
  [590, 0.13584, 0.618, 0.0325],
  [595, 0.16792, 0.622, 0.033],
  [600, 0.2231, 0.626, 0.034],
  [605, 0.25838, 0.63, 0.034],
  [610, 0.26506, 0.63, 0.036],
  [615, 0.26843, 0.638, 0.0375],
  [620, 0.27612, 0.642, 0.0385],
  [625, 0.284, 0.647, 0.04],
  [630, 0.29218, 0.653, 0.042],
  [635, 0.30176, 0.658, 0.043],
  [640, 0.31134, 0.663, 0.044],
  [645, 0.32553, 0.667, 0.0445],
  [650, 0.34052, 0.667, 0.045],
  [655, 0.3715, 0.677, 0.046],
  [660, 0.41048, 0.682, 0.0475],
  [665, 0.42947, 0.687, 0.049],
  [670, 0.43946, 0.695, 0.0515],
  [675, 0.44844, 0.697, 0.052],
  [680, 0.46543, 0.693, 0.0505],
  [685, 0.48642, 0.665, 0.044],
  [690, 0.5164, 0.64, 0.039],
  [695, 0.55939, 0.62, 0.034],
  [700, 0.62438, 0.6, 0.03]
];

// Table 3 - the average cosine mu_d of the downwelling field, an
// example given for theta_s = 30 deg, as a function of wavelength and
// [Chl]. This is the varying mu_d the complete revised model uses
// (Figure 8b); the flat mu_d = 0.90 of the simplified scheme (8')
// only reproduces the older Figure 8a. Columns are Chl = 0.03, 0.1,
// 0.3, 1, 3 mg m^-3.
export const MUD_CHL = [0.03, 0.1, 0.3, 1, 3];
export const MUD_TABLE = [
  [400, [0.77, 0.769, 0.766, 0.767, 0.767]],
  [412, [0.765, 0.77, 0.774, 0.779, 0.782]],
  [443, [0.8, 0.797, 0.796, 0.797, 0.799]],
  [490, [0.841, 0.824, 0.808, 0.797, 0.791]],
  [510, [0.872, 0.855, 0.834, 0.811, 0.796]],
  [555, [0.892, 0.879, 0.858, 0.827, 0.795]],
  [620, [0.911, 0.908, 0.902, 0.89, 0.871]],
  [670, [0.914, 0.912, 0.909, 0.901, 0.89]]
];

export const F_REFLECTANCE = 0.33; // f in (7), theta_s in [0, 25] deg
export const MU_U = 0.4; // upwelling average cosine, eq (8)
export const A_SEED = 0.75; // u1, seed a = u1*K before iterating
export const BW_550 = 0.00193; // pure seawater scattering, Morel 1974
export const BW_SLOPE = 4.32; // lambda^-4.32 molecular law
export const BP_COEF = 0.416; // bp550 = 0.416 * Chl^0.766, eq (12)
export const BP_EXP = 0.766;

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const log10 = (x) => Math.log(x) / Math.LN10;

// Molecular scattering coefficient of pure seawater (Morel 1974).
export function bwSeawater(nm) {
  return BW_550 * Math.pow(550 / nm, BW_SLOPE);
}

// Spectral slope of the particle backscattering efficiency, eq (14).
export function backscatterSlope(chl) {
  if (chl > 2) return 0;
  // 0.5*(log10 Chl - 0.3) is -1 at Chl = 0.02 (the lambda^-1 slope
  // the paper holds at the low end) and 0 at Chl = 2.
  return clamp(0.5 * (log10(chl) - 0.3), -1, 0);
}

// Particle scattering coefficient at 550 nm, eq (12) [Loisel and
// Morel, 1998, transformed to 550 nm].
export function bp550(chl) {
  return BP_COEF * Math.pow(chl, BP_EXP);
}

// Particle backscattering coefficient at a wavelength, eq (13).
export function bbp(chl, nm) {
  const v = backscatterSlope(chl);
  // The efficiency's chlorophyll term goes to zero at Chl = 100 and
  // is not allowed to turn negative beyond it.
  const eff =
    0.002 + 0.01 * Math.max(0, 0.5 - 0.25 * log10(chl)) * Math.pow(nm / 550, v);
  return eff * bp550(chl);
}

// Total backscattering coefficient, eq (11): half the molecular
// scattering (the backscatter fraction of Rayleigh-like scattering
// is exactly 1/2) plus the particle backscattering.
export function backscatter(chl, nm) {
  return 0.5 * bwSeawater(nm) + bbp(chl, nm);
}

// Diffuse attenuation Kd(lambda) = Kw + chi*Chl^e, eqs (3),(5).
export function kd(chl, kw, e, chi) {
  return kw + chi * Math.pow(chl, e);
}

// mu_d(lambda, Chl) bilinearly interpolated from Table 3 in
// wavelength and in log10(Chl), clamped to the table edges.
export function mud(chl, nm) {
  const lc = log10(clamp(chl, MUD_CHL[0], MUD_CHL[MUD_CHL.length - 1]));
  // Chl weights (log spacing).
  let ci = 0;
  while (ci < MUD_CHL.length - 2 && lc > log10(MUD_CHL[ci + 1])) ci++;
  const c0 = log10(MUD_CHL[ci]);
  const c1 = log10(MUD_CHL[ci + 1]);
  const ct = c1 > c0 ? (lc - c0) / (c1 - c0) : 0;
  const rowMu = (row) => row[1][ci] + (row[1][ci + 1] - row[1][ci]) * ct;
  // Wavelength weights (linear), clamped to [400, 670].
  const w = clamp(nm, MUD_TABLE[0][0], MUD_TABLE[MUD_TABLE.length - 1][0]);
  let li = 0;
  while (li < MUD_TABLE.length - 2 && w > MUD_TABLE[li + 1][0]) li++;
  const l0 = MUD_TABLE[li][0];
  const l1 = MUD_TABLE[li + 1][0];
  const lt = l1 > l0 ? (w - l0) / (l1 - l0) : 0;
  return (
    rowMu(MUD_TABLE[li]) +
    (rowMu(MUD_TABLE[li + 1]) - rowMu(MUD_TABLE[li])) * lt
  );
}

// Irradiance reflectance R(lambda) = Eu/Ed at null depth for a single
// wavelength row, by the paper's iteration: seed a = 0.75*Kd, then
// alternate R = f*bb/a (7) with the Gershun inversion (8) for a. The
// paper reports stable R within three loops.
export function reflectanceRow(chl, nm, kw, e, chi, loops = 3) {
  const K = kd(chl, kw, e, chi);
  const bb = backscatter(chl, nm);
  const md = mud(chl, nm);
  const ratio = md / MU_U; // = 2.25 when mu_d = 0.90
  let a = A_SEED * K;
  let R = 0;
  for (let i = 0; i < loops; i++) {
    R = (F_REFLECTANCE * bb) / a;
    a = (K * md * (1 - R)) / (1 + ratio * R);
  }
  return (F_REFLECTANCE * bb) / a;
}

// R(lambda) across the full Table 2 grid for a chlorophyll
// concentration (mg m^-3). Returns [{nm, R}].
export function reflectanceSpectrum(chl, loops = 3) {
  return TABLE2.map(([nm, kw, e, chi]) => ({
    nm,
    R: reflectanceRow(chl, nm, kw, e, chi, loops)
  }));
}

// R at an arbitrary wavelength, linearly interpolated on the 5 nm
// grid (convenience for band ratios and the colour integration).
export function reflectanceAt(chl, nm, loops = 3) {
  const spec = reflectanceSpectrum(chl, loops);
  if (nm <= spec[0].nm) return spec[0].R;
  if (nm >= spec[spec.length - 1].nm) return spec[spec.length - 1].R;
  let i = 0;
  while (i < spec.length - 2 && nm > spec[i + 1].nm) i++;
  const t = (nm - spec[i].nm) / (spec[i + 1].nm - spec[i].nm);
  return spec[i].R + (spec[i + 1].R - spec[i].R) * t;
}
