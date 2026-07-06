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
 * (Koschack & Rendtel 1990); the display keeps lm = 6.5 and lets
 * the night/cloud gates hide meteors exactly as they hide stars.
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
