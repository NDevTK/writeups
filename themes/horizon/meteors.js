/**
 * Annual meteor showers - the single source shared by the theme's
 * streak system (Horizon.html) and the reference printer
 * (meteors-reference.mjs).
 *
 * Catalogue: the IMO Meteor Shower Calendar 2026, Table 5 (Working
 * List of Visual Meteor Showers) VERBATIM for the twelve principal
 * showers - peak solar longitude lam_max, radiant (alpha, delta) at
 * the peak, geocentric velocity V_inf, population index r, and the
 * peak ZHR "based on recent observed returns". Radiant DRIFT
 * (degrees per degree of solar longitude) comes from Jenniskens
 * 1994 (A&A 287, 990) Table 3a via its machine-readable VizieR
 * catalogue J/A+A/287/990.
 *
 * Activity profile: Jenniskens 1994's double exponential (the
 * catalogue's own Note 1),
 *   ZHR(lam) = ZHRmax 10^(-B |lam - lam_max|),
 * with the slope B from Table 3b verbatim, asymmetric where the
 * paper says so (Note 4: Quadrantids B = 1.8; Geminids B =
 * 0.39 ascending / 0.72 descending - the fall after the Geminid
 * peak really is twice as fast as the rise).
 *
 * Observed rate: the ZHR definition (catalogue Note 2: rates for a
 * clear sky at limiting magnitude 6.5 with the radiant in the
 * zenith) unwinds with the standard zenith correction
 *   HR = ZHR sin(h_R)   for radiant elevation h_R > 0
 * (Koschack & Rendtel 1990) and with the SAME paper's perception
 * machinery at the frame's live Schaefer limiting magnitude (the
 * visibleRateFactor block below) - moonlight, twilight and city
 * glow suppress the shower as they suppress real counts.
 * Meteors per frame are a Poisson process at HR; magnitudes draw
 * from the population-index law N(< m) ~ r^m truncated at lm, so a
 * Geminid-class shower (r = 2.6) shows mostly faint streaks with
 * the occasional bright one, exactly the observed ratio per
 * magnitude class.
 *
 * Solar longitude comes from the theme's NOAA series (J2000-vs-date
 * equinox drift since 2000 is < 0.4 deg - far below every B width
 * except the Quadrantid spike, where it shifts the peak by ~3 h;
 * documented).
 */

// IMO 2026 Table 5 (verbatim): lam = peak solar longitude (deg),
// ra/dec = radiant at peak (deg), v = V_inf (km/s), r = population
// index, zhr = peak ZHR. dra/dde = radiant drift per degree solar
// longitude (Jenniskens 1994 Table 3a). bp/bm = ascending/
// descending profile slope (Jenniskens 1994 Table 3b + notes).
export const SHOWERS = [
  {
    code: 'QUA',
    name: 'Quadrantids',
    lam: 283.15,
    ra: 230,
    dec: 49,
    v: 41,
    r: 2.1,
    zhr: 80,
    dra: 0.6,
    dde: -0.3,
    bp: 1.8,
    bm: 1.8
  },
  {
    code: 'LYR',
    name: 'April Lyrids',
    lam: 32.32,
    ra: 271,
    dec: 34,
    v: 49,
    r: 2.1,
    zhr: 18,
    dra: 1.2,
    dde: 0.2,
    bp: 0.22,
    bm: 0.22
  },
  {
    code: 'ETA',
    name: 'eta-Aquariids',
    lam: 45.5,
    ra: 338,
    dec: -1,
    v: 66,
    r: 2.4,
    zhr: 50,
    dra: 0.9,
    dde: 0.3,
    bp: 0.08,
    bm: 0.08
  },
  {
    code: 'SDA',
    name: 'S. delta-Aquariids',
    lam: 128,
    ra: 340,
    dec: -16,
    v: 41,
    r: 2.5,
    zhr: 25,
    dra: 0.8,
    dde: 0.2,
    bp: 0.091,
    bm: 0.091
  },
  {
    code: 'CAP',
    name: 'alpha-Capricornids',
    lam: 128,
    ra: 307,
    dec: -10,
    v: 23,
    r: 2.5,
    zhr: 5,
    dra: 0.9,
    dde: 0.3,
    bp: 0.041,
    bm: 0.041
  },
  {
    code: 'PER',
    name: 'Perseids',
    lam: 140.0,
    ra: 48,
    dec: 58,
    v: 59,
    r: 2.2,
    zhr: 100,
    dra: 1.3,
    dde: 0.1,
    bp: 0.2,
    bm: 0.2
  },
  {
    code: 'ORI',
    name: 'Orionids',
    lam: 208,
    ra: 95,
    dec: 16,
    v: 66,
    r: 2.5,
    zhr: 20,
    dra: 0.7,
    dde: 0.1,
    bp: 0.12,
    bm: 0.12
  },
  {
    code: 'STA',
    name: 'S. Taurids',
    lam: 223,
    ra: 52,
    dec: 15,
    v: 27,
    r: 2.3,
    zhr: 7,
    dra: 0.3,
    dde: 0.1,
    bp: 0.026,
    bm: 0.026
  },
  {
    code: 'NTA',
    name: 'N. Taurids',
    lam: 230,
    ra: 58,
    dec: 22,
    v: 29,
    r: 2.3,
    zhr: 5,
    dra: 0.3,
    dde: 0.1,
    bp: 0.026,
    bm: 0.026
  },
  {
    code: 'LEO',
    name: 'Leonids',
    lam: 235.27,
    ra: 152,
    dec: 22,
    v: 71,
    r: 2.5,
    zhr: 15,
    dra: 1.0,
    dde: 0.4,
    bp: 0.39,
    bm: 0.39
  },
  {
    code: 'GEM',
    name: 'Geminids',
    lam: 262.2,
    ra: 112,
    dec: 33,
    v: 35,
    r: 2.6,
    zhr: 150,
    dra: 1.0,
    dde: 0.1,
    bp: 0.39,
    bm: 0.72
  },
  {
    code: 'URS',
    name: 'Ursids',
    lam: 270.7,
    ra: 217,
    dec: 76,
    v: 33,
    r: 2.8,
    zhr: 10,
    dra: -0.2,
    dde: -0.3,
    bp: 0.61,
    bm: 0.61
  }
];

// Signed shortest solar-longitude difference (deg, [-180, 180)).
export function dLam(lam, lamMax) {
  return ((((lam - lamMax) % 360) + 540) % 360) - 180;
}

// Jenniskens 1994 double exponential (catalogue Note 1), with the
// asymmetric branches where published.
export function zhrAt(s, lamSun) {
  const d = dLam(lamSun, s.lam);
  return s.zhr * Math.pow(10, -(d >= 0 ? s.bm : s.bp) * Math.abs(d));
}

// Radiant of date: peak radiant plus the drift times the solar
// longitude offset.
export function radiantAt(s, lamSun) {
  const d = dLam(lamSun, s.lam);
  return {ra: s.ra + s.dra * d, dec: s.dec + s.dde * d};
}

// Standard zenith correction (ZHR definition, catalogue Note 2):
// observed hourly rate at radiant elevation hR (radians).
export function hourlyRate(zhr, hR) {
  return hR > 0 ? zhr * Math.sin(hR) : 0;
}

// Magnitude draw from the population-index law N(< m) ~ r^m
// truncated at the limiting magnitude: u uniform in (0, 1] maps to
// m = lm + ln(u)/ln(r) - brighter meteors exponentially rarer, the
// per-magnitude count ratio exactly r.
export function drawMagnitude(r, u, lm = 6.5) {
  return lm + Math.log(u) / Math.log(r);
}

// Active showers and their expected total rate at a given solar
// longitude and observer (rates below floor drop out - showers far
// off-peak contribute nothing visible).
export function activeShowers(lamSun, floor = 0.5) {
  return SHOWERS.map((s) => ({s, zhr: zhrAt(s, lamSun)})).filter(
    (a) => a.zhr >= floor
  );
}

// ---- perception: the rate at ANY limiting magnitude ----
// Koschack & Rendtel 1990 (WGN 18:2, 44 - read in full; the same
// paper as the zenith correction above). Their Table 4 prints the
// MEASURED probability of perception p(dm, R) - dm = lm - m (their
// Eq. 4), R the distance from the field centre - from ~5000
// double-count meteors; blank cells are unobserved (zero). Table 6
// prints the standard field portions A'_R (h_f = 50 deg, r = 2.7,
// H = 100 km); their Eq. 5 field-averages the two - and their
// Table 5 prints the standard-field outcomes (0.00482 / 0.0593 /
// 0.365 / 0.860 at dm = 0.5 / 2 / 3.5 / 6), which the gate
// re-derives EXACTLY from the vendored tables. With the magnitude
// distribution ~ r^m (their Eq. 6), the observed fraction of the
// standard lm = 6.5 rate at any current limiting magnitude
// follows with no new constants - moonlight and city glow
// suppress the drawn shower exactly as they suppress real counts,
// and the textbook r^(lm - 6.5) correction emerges as the
// large-dm asymptote.
export const KR_DM = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8];
export const KR_P = [
  [0.0347, 0.0777, 0.158, 0.33, 0.6, 0.794, 0.912, 0.98, 1, 1, 1, 1, 1],
  [0.0252, 0.055, 0.112, 0.23, 0.445, 0.677, 0.85, 0.95, 0.98, 0.98, 1, 1, 1],
  [
    0.0186, 0.039, 0.0775, 0.162, 0.322, 0.575, 0.813, 0.91, 0.95, 0.98, 0.98,
    1, 1
  ],
  [
    0.0135, 0.0275, 0.055, 0.115, 0.245, 0.49, 0.723, 0.85, 0.91, 0.93, 0.95, 1,
    1
  ],
  [
    0.01, 0.0195, 0.038, 0.079, 0.178, 0.355, 0.575, 0.74, 0.83, 0.87, 0.91,
    0.98, 1
  ],
  [0, 0, 0, 0.059, 0.135, 0.245, 0.416, 0.617, 0.723, 0.81, 0.89, 0.98, 1],
  [0, 0, 0, 0.0415, 0.0954, 0.17, 0.302, 0.478, 0.616, 0.723, 0.85, 0.93, 1],
  [0, 0, 0, 0.0295, 0.0645, 0.118, 0.214, 0.346, 0.5, 0.645, 0.83, 0.93, 0.98],
  [0, 0, 0, 0, 0.0397, 0.066, 0.114, 0.2, 0.362, 0.588, 0.79, 0.89, 0.95],
  [0, 0, 0, 0, 0, 0, 0.0724, 0.112, 0.208, 0.524, 0.76, 0.85, 0.93]
];
export const KR_AREA = [
  0.0202, 0.0381, 0.0598, 0.0804, 0.0963, 0.121, 0.1379, 0.1506, 0.154, 0.1415
];

// Eq. 5: the field-averaged probability of perception at dm =
// lm - m. Linear in dm between the printed columns; zero at and
// below dm = 0 (their own note: p there is under 1e-3).
export function perceptionP(dm) {
  if (!(dm > 0)) return 0;
  const col = (j) => KR_P.reduce((s, row, i) => s + row[j] * KR_AREA[i], 0);
  if (dm >= KR_DM[KR_DM.length - 1]) return col(KR_DM.length - 1);
  if (dm <= KR_DM[0]) return (col(0) * dm) / KR_DM[0];
  let j = 0;
  while (dm > KR_DM[j + 1]) j++;
  const f = (dm - KR_DM[j]) / (KR_DM[j + 1] - KR_DM[j]);
  return col(j) + f * (col(j + 1) - col(j));
}

// The visible fraction of the standard (lm = 6.5) rate for a
// shower of population index r at the CURRENT limiting magnitude:
// the r^m magnitude distribution folded with the perception
// probabilities, normalised at the ZHR definition's own 6.5.
export function visibleRateFactor(r, lm) {
  const sum = (L) => {
    let s = 0;
    for (let m = -3; m <= 9; m++) s += Math.pow(r, m) * perceptionP(L - m);
    return s;
  };
  const ref = sum(6.5);
  if (!(ref > 0) || !Number.isFinite(lm)) return 0;
  return Math.min(Math.max(sum(lm) / ref, 0), 2);
}
