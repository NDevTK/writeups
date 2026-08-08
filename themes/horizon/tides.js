/**
 * tides.js - the harmonic frame under the measured tide, from the
 * method's own printed manual. Gated by tides-reference.mjs
 * against a vendored NOAA fixture (tide-fixture.js).
 *
 * THE PRIMARY - Paul Schureman, "Manual of Harmonic Analysis and
 * Prediction of Tides", U. S. Coast and Geodetic Survey Special
 * Publication 98 (1941 revised edition; archive.org item
 * manualofharmonic00usco, a 340-page scan). Public-domain
 * government print - the manual behind the constants NOAA still
 * serves. Per the standing scan rule the shipped constants were
 * MACHINE-READ FROM THE PAGE IMAGES:
 *  - Table 1, "Fundamental astronomical data" (report p. 163):
 *    the hourly rates of the mean longitudes - sun h
 *    0.04106864 deg/hr, moon s 0.54901653, lunar perigee p
 *    0.00464183, moon's node N -0.00220641, solar perigee p1
 *    0.00000196 - with T = 15 deg/hr the mean solar hour angle
 *    by definition.
 *  - Table 38, "tide-predicting machine No. 2 - constituent
 *    gears" (report p. 308): the "Theoretical speed per hour" of
 *    every constituent to seven decimals - the column the
 *    Survey's brass computer was geared to, and the speeds this
 *    module ships (M1 row re-read at high magnification:
 *    14.4920521).
 *
 * THE LIVE FEED - NOAA CO-OPS, keyless with open CORS:
 *  - station list: /mdapi/prod/webapi/stations.json?type=waterlevels
 *    (301 gauges, US + territories);
 *  - measured water level: /api/prod/datagetter product=
 *    water_level, date=latest, datum=MSL, metric - the real
 *    gauge, tides plus surge;
 *  - published constants: /mdapi/.../stations/{id}/harcon.json.
 * Where a gauge sits within reach the theme's tide rides the
 * MEASUREMENT; elsewhere the existing open-meteo model value
 * stands (sea_level_height_msl - tides + surge from a model).
 * The harmonic machinery below is the gate's frame: it proves
 * feed and print are one physics, the same road the snow-cover
 * pass took through the published colormap.
 *
 * WHAT THE GATE PROVES (tides-reference.mjs):
 *  - the printed Table 38 speeds DERIVE from Table 1's four
 *    rates through the standard lunisolar arguments (M2 =
 *    2T - 2s + 2h, K1 = T + h, ... - two dozen compositions,
 *    each landing on the printed seven decimals);
 *  - the compound constituents are EXACT sums in print
 *    (O1 + K1 = M2, K1 + P1 = S2, M2 + K1 = MK3, ...);
 *  - NOAA's served speeds ARE the 1941 print (36 of 37 to their
 *    rounding) - and the one exception is a definitional finding
 *    closed IN PRINT: the served M1 speed equals Schureman's M1
 *    plus his printed lunar-perigee rate exactly (the modern
 *    no-nodal-M1 convention);
 *  - a least-squares fit AT THE PRINTED SPEEDS to NOAA's own
 *    60-day prediction series reproduces a held-out week to
 *    under a millimetre - the served product IS a synthesis at
 *    these speeds - and recovers the station's published M2
 *    amplitude inside the lunar-nodal few-percent envelope.
 *
 * Documented scope: equilibrium arguments (V0 + u) and node
 * factors (f) are not implemented - the fit absorbs the epoch's
 * f x H and V0 + u into effective amplitude and phase, which is
 * exactly what synthesis needs; published-mean amplitude
 * comparisons carry the nodal envelope, and phase lags (kappa)
 * are not compared. The drawn tide is the measured gauge value,
 * never a local synthesis.
 */

// ---- Table 1 (report p. 163), machine-read ----------------------
export const T_RATE = 15; // mean solar hour angle, deg/hr (definition)
export const S_RATE = 0.54901653; // moon s
export const H_RATE = 0.04106864; // sun h
export const P_RATE = 0.00464183; // lunar perigee p
export const N_RATE = -0.00220641; // moon's node N
export const P1_RATE = 0.00000196; // solar perigee p1

// ---- Table 38 (report p. 308), machine-read ---------------------
// name -> printed theoretical speed (deg per mean solar hour).
export const TIDE_SPEED = {
  J1: 15.5854433,
  K1: 15.0410686,
  K2: 30.0821372,
  L2: 29.5284788,
  M1: 14.4920521,
  M2: 28.9841042,
  M3: 43.4761563,
  M4: 57.9682084,
  M6: 86.9523126,
  M8: 115.9364168,
  N2: 28.4397296,
  '2N2': 27.8953548,
  O1: 13.9430356,
  OO1: 16.1391016,
  P1: 14.9589314,
  Q1: 13.3986609,
  '2Q1': 12.8542862,
  R2: 30.0410686,
  S1: 15.0,
  S2: 30.0,
  S4: 60.0,
  S6: 90.0,
  T2: 29.9589314,
  LAM2: 29.4556254,
  MU2: 27.9682084,
  NU2: 28.512583,
  RHO: 13.4715144,
  MK3: 44.0251728,
  '2MK3': 42.9271398,
  MN4: 57.4238338,
  MS4: 58.9841042,
  '2SM2': 31.0158958,
  MF: 1.098033,
  MSF: 1.0158958,
  MM: 0.5443747,
  SA: 0.0410686,
  SSA: 0.0821372
};

// The standard lunisolar argument compositions [T, s, h, p] whose
// rates land on the printed speeds (Schureman's development,
// secs. 404-450; the compounds are covered by the exact-sum
// family instead). LAM2's argument mixes higher terms and stays
// with the served-vs-printed check only.
export const TIDE_ARG = {
  M2: [2, -2, 2, 0],
  S2: [2, 0, 0, 0],
  N2: [2, -3, 2, 1],
  K1: [1, 0, 1, 0],
  O1: [1, -2, 1, 0],
  P1: [1, 0, -1, 0],
  Q1: [1, -3, 1, 1],
  K2: [2, 0, 2, 0],
  T2: [2, 0, -1, 0],
  R2: [2, 0, 1, 0],
  S1: [1, 0, 0, 0],
  J1: [1, 1, 1, -1],
  M1: [1, -1, 1, 0],
  OO1: [1, 2, 1, 0],
  MU2: [2, -4, 4, 0],
  NU2: [2, -3, 4, -1],
  '2N2': [2, -4, 2, 2],
  L2: [2, -1, 2, -1],
  RHO: [1, -3, 3, -1],
  '2Q1': [1, -4, 1, 2],
  M3: [3, -3, 3, 0],
  M4: [4, -4, 4, 0],
  M6: [6, -6, 6, 0],
  M8: [8, -8, 8, 0],
  MF: [0, 2, 0, 0],
  MM: [0, 1, 0, -1],
  SA: [0, 0, 1, 0],
  SSA: [0, 0, 2, 0],
  MSF: [0, 2, -2, 0]
};
export function argSpeed(name) {
  const a = TIDE_ARG[name];
  if (!a) return null;
  return a[0] * T_RATE + a[1] * S_RATE + a[2] * H_RATE + a[3] * P_RATE;
}

// The modern served M1: Schureman's M1 plus his printed perigee
// rate (NOAA folds the p-dependence into the speed instead of
// the nodal u - the gate holds served == this to their rounding).
export const M1_SERVED = TIDE_SPEED.M1 + P_RATE;

// The synthesis speed set for fitting NOAA products: printed
// Table 38 with M1 at the served convention.
export function synthesisSpeeds(names) {
  return names.map((n) => (n === 'M1' ? M1_SERVED : TIDE_SPEED[n]));
}

// ---- least-squares harmonic fit ---------------------------------
// values: hourly series (metres); speeds: deg/hr per constituent.
// Returns {mean, cos[], sin[]} such that
//   v(t) = mean + sum_k cos[k] cos(w_k t) + sin[k] sin(w_k t),
// t in hours from the series start. Normal equations by Gaussian
// elimination with partial pivoting - 2K+1 unknowns.
export function harmonicFit(values, speeds, stepHours = 1) {
  const n = values.length;
  const K = speeds.length;
  const M = 2 * K + 1;
  const cols = [new Float64Array(n).fill(1)];
  for (const sp of speeds) {
    const w = (sp * Math.PI) / 180;
    const c = new Float64Array(n);
    const s = new Float64Array(n);
    for (let t = 0; t < n; t++) {
      c[t] = Math.cos(w * t * stepHours);
      s[t] = Math.sin(w * t * stepHours);
    }
    cols.push(c, s);
  }
  const A = [];
  const b = new Float64Array(M);
  for (let i = 0; i < M; i++) {
    A.push(new Float64Array(M));
    for (let j = 0; j < M; j++) {
      let sum = 0;
      for (let t = 0; t < n; t++) sum += cols[i][t] * cols[j][t];
      A[i][j] = sum;
    }
    let sum = 0;
    for (let t = 0; t < n; t++) sum += cols[i][t] * values[t];
    b[i] = sum;
  }
  for (let i = 0; i < M; i++) {
    let piv = i;
    for (let r = i + 1; r < M; r++)
      if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    [A[i], A[piv]] = [A[piv], A[i]];
    [b[i], b[piv]] = [b[piv], b[i]];
    for (let r = i + 1; r < M; r++) {
      const f = A[r][i] / A[i][i];
      for (let c = i; c < M; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const x = new Float64Array(M);
  for (let i = M - 1; i >= 0; i--) {
    let sum = b[i];
    for (let c = i + 1; c < M; c++) sum -= A[i][c] * x[c];
    x[i] = sum / A[i][i];
  }
  return {
    mean: x[0],
    cos: Array.from({length: K}, (_, k) => x[1 + 2 * k]),
    sin: Array.from({length: K}, (_, k) => x[2 + 2 * k]),
    speeds
  };
}

// Synthesis at hour t from a fit (t in the fit's own time frame).
export function tideSynth(fit, tHours) {
  let v = fit.mean;
  for (let k = 0; k < fit.speeds.length; k++) {
    const w = (fit.speeds[k] * Math.PI) / 180;
    v += fit.cos[k] * Math.cos(w * tHours) + fit.sin[k] * Math.sin(w * tHours);
  }
  return v;
}

// Constituent amplitude from a fit.
export function fitAmplitude(fit, name, names) {
  const k = names.indexOf(name);
  if (k < 0) return 0;
  return Math.hypot(fit.cos[k], fit.sin[k]);
}

// ---- the live feed ---------------------------------------------
export const COOPS_BASE = 'https://api.tidesandcurrents.noaa.gov';
export function tideStationsUrl() {
  return COOPS_BASE + '/mdapi/prod/webapi/stations.json?type=waterlevels';
}
export function tideLatestUrl(id) {
  return (
    COOPS_BASE +
    '/api/prod/datagetter?product=water_level&application=horizon&date=latest&datum=MSL&units=metric&time_zone=gmt&format=json&station=' +
    id
  );
}
// Nearest gauge within maxKm (haversine; stations as served by
// the mdapi list: {id, name, lat, lng}). Null when none is near -
// the model fallback stands.
export function nearestTideStation(stations, lat, lon, maxKm = 75) {
  const R = 6371;
  const rad = Math.PI / 180;
  let best = null;
  let bestKm = maxKm;
  for (const s of stations) {
    const dLat = (s.lat - lat) * rad;
    const dLon = (s.lng - lon) * rad;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat * rad) * Math.cos(s.lat * rad) * Math.sin(dLon / 2) ** 2;
    const km = 2 * R * Math.asin(Math.sqrt(a));
    if (km < bestKm) {
      bestKm = km;
      best = {...s, km};
    }
  }
  return best;
}
export const FT_TO_M = 0.3048; // exact international foot
