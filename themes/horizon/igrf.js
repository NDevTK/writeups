/**
 * IGRF-14 geomagnetic field - the single source shared by the theme
 * (aurora geometry in Horizon.html) and the reference printer
 * (igrf-reference.mjs). The International Geomagnetic Reference
 * Field, 14th generation (IAGA Working Group V-MOD, 2024):
 * Schmidt semi-normalised spherical-harmonic coefficients to degree
 * 13, epoch 2025.0 plus the 2025-2030 secular variation, extracted
 * verbatim from NOAA's igrf14coeffs.txt. Evaluation is the standard
 * algorithm: geodetic (WGS84) to geocentric conversion, Schmidt
 * semi-normalised associated Legendre recursion, the B_r/B_theta/
 * B_phi sums at reference radius a = 6371.2 km, rotated back to the
 * geodetic north/east/down frame.
 *
 * The reference validates the machinery on analytic identities (the
 * tilted-dipole closed form must equal the n = 1 evaluation at
 * machine precision; hand-written Schmidt P_n^m for n <= 3 must
 * equal the recursion) plus the published IGRF-14 landmarks (the
 * 2025 geomagnetic north pole at 80.9 N, 72.7 W).
 */

// [g(0)/h(1), n, m, main field nT at 2025.0, SV nT/yr 2025-2030]
const COEFFS = [
  [0, 1, 0, -29350.0, 12.6],
  [0, 1, 1, -1410.3, 10.0],
  [1, 1, 1, 4545.5, -21.5],
  [0, 2, 0, -2556.2, -11.2],
  [0, 2, 1, 2950.9, -5.3],
  [1, 2, 1, -3133.6, -27.3],
  [0, 2, 2, 1648.7, -8.3],
  [1, 2, 2, -814.2, -11.1],
  [0, 3, 0, 1360.9, -1.5],
  [0, 3, 1, -2404.2, -4.4],
  [1, 3, 1, -56.9, 3.8],
  [0, 3, 2, 1243.8, 0.4],
  [1, 3, 2, 237.6, -0.2],
  [0, 3, 3, 453.4, -15.6],
  [1, 3, 3, -549.6, -3.9],
  [0, 4, 0, 894.7, -1.7],
  [0, 4, 1, 799.6, -2.3],
  [1, 4, 1, 278.6, -1.3],
  [0, 4, 2, 55.8, -5.8],
  [1, 4, 2, -134.0, 4.1],
  [0, 4, 3, -281.1, 5.4],
  [1, 4, 3, 212.0, 1.6],
  [0, 4, 4, 12.0, -6.8],
  [1, 4, 4, -375.4, -4.1],
  [0, 5, 0, -232.9, 0.6],
  [0, 5, 1, 369.0, 1.3],
  [1, 5, 1, 45.3, -0.5],
  [0, 5, 2, 187.2, 0.0],
  [1, 5, 2, 220.0, 2.1],
  [0, 5, 3, -138.7, 0.7],
  [1, 5, 3, -122.9, 0.5],
  [0, 5, 4, -141.9, 2.3],
  [1, 5, 4, 42.9, 1.7],
  [0, 5, 5, 20.9, 1.0],
  [1, 5, 5, 106.2, 1.9],
  [0, 6, 0, 64.3, -0.2],
  [0, 6, 1, 63.8, -0.3],
  [1, 6, 1, -18.4, 0.3],
  [0, 6, 2, 76.7, 0.8],
  [1, 6, 2, 16.8, -1.6],
  [0, 6, 3, -115.7, 1.2],
  [1, 6, 3, 48.9, -0.4],
  [0, 6, 4, -40.9, -0.8],
  [1, 6, 4, -59.8, 0.8],
  [0, 6, 5, 14.9, 0.4],
  [1, 6, 5, 10.9, 0.7],
  [0, 6, 6, -60.8, 0.9],
  [1, 6, 6, 72.8, 0.9],
  [0, 7, 0, 79.6, -0.1],
  [0, 7, 1, -76.9, -0.1],
  [1, 7, 1, -48.9, 0.6],
  [0, 7, 2, -8.8, -0.1],
  [1, 7, 2, -14.4, 0.5],
  [0, 7, 3, 59.3, 0.5],
  [1, 7, 3, -1.0, -0.7],
  [0, 7, 4, 15.8, -0.1],
  [1, 7, 4, 23.5, 0.0],
  [0, 7, 5, 2.5, -0.8],
  [1, 7, 5, -7.4, -0.9],
  [0, 7, 6, -11.2, -0.8],
  [1, 7, 6, -25.1, 0.5],
  [0, 7, 7, 14.3, 0.9],
  [1, 7, 7, -2.2, -0.3],
  [0, 8, 0, 23.1, -0.1],
  [0, 8, 1, 10.9, 0.2],
  [1, 8, 1, 7.2, -0.3],
  [0, 8, 2, -17.5, 0.0],
  [1, 8, 2, -12.6, 0.4],
  [0, 8, 3, 2.0, 0.4],
  [1, 8, 3, 11.5, -0.3],
  [0, 8, 4, -21.8, -0.1],
  [1, 8, 4, -9.7, 0.4],
  [0, 8, 5, 16.9, 0.3],
  [1, 8, 5, 12.7, -0.5],
  [0, 8, 6, 14.9, 0.1],
  [1, 8, 6, 0.7, -0.6],
  [0, 8, 7, -16.8, 0.0],
  [1, 8, 7, -5.2, 0.3],
  [0, 8, 8, 1.0, 0.3],
  [1, 8, 8, 3.9, 0.2],
  [0, 9, 0, 4.7, 0.0],
  [0, 9, 1, 8.0, 0.0],
  [1, 9, 1, -24.8, 0.0],
  [0, 9, 2, 3.0, 0.0],
  [1, 9, 2, 12.1, 0.0],
  [0, 9, 3, -0.2, 0.0],
  [1, 9, 3, 8.3, 0.0],
  [0, 9, 4, -2.5, 0.0],
  [1, 9, 4, -3.4, 0.0],
  [0, 9, 5, -13.1, 0.0],
  [1, 9, 5, -5.3, 0.0],
  [0, 9, 6, 2.4, 0.0],
  [1, 9, 6, 7.2, 0.0],
  [0, 9, 7, 8.6, 0.0],
  [1, 9, 7, -0.6, 0.0],
  [0, 9, 8, -8.7, 0.0],
  [1, 9, 8, 0.8, 0.0],
  [0, 9, 9, -12.8, 0.0],
  [1, 9, 9, 9.8, 0.0],
  [0, 10, 0, -1.3, 0.0],
  [0, 10, 1, -6.4, 0.0],
  [1, 10, 1, 3.3, 0.0],
  [0, 10, 2, 0.2, 0.0],
  [1, 10, 2, 0.1, 0.0],
  [0, 10, 3, 2.0, 0.0],
  [1, 10, 3, 2.5, 0.0],
  [0, 10, 4, -1.0, 0.0],
  [1, 10, 4, 5.4, 0.0],
  [0, 10, 5, -0.5, 0.0],
  [1, 10, 5, -9.0, 0.0],
  [0, 10, 6, -0.9, 0.0],
  [1, 10, 6, 0.4, 0.0],
  [0, 10, 7, 1.5, 0.0],
  [1, 10, 7, -4.2, 0.0],
  [0, 10, 8, 0.9, 0.0],
  [1, 10, 8, -3.8, 0.0],
  [0, 10, 9, -2.6, 0.0],
  [1, 10, 9, 0.9, 0.0],
  [0, 10, 10, -3.9, 0.0],
  [1, 10, 10, -9.0, 0.0],
  [0, 11, 0, 3.0, 0.0],
  [0, 11, 1, -1.4, 0.0],
  [1, 11, 1, 0.0, 0.0],
  [0, 11, 2, -2.5, 0.0],
  [1, 11, 2, 2.8, 0.0],
  [0, 11, 3, 2.4, 0.0],
  [1, 11, 3, -0.6, 0.0],
  [0, 11, 4, -0.6, 0.0],
  [1, 11, 4, 0.1, 0.0],
  [0, 11, 5, 0.0, 0.0],
  [1, 11, 5, 0.5, 0.0],
  [0, 11, 6, -0.6, 0.0],
  [1, 11, 6, -0.3, 0.0],
  [0, 11, 7, -0.1, 0.0],
  [1, 11, 7, -1.2, 0.0],
  [0, 11, 8, 1.1, 0.0],
  [1, 11, 8, -1.7, 0.0],
  [0, 11, 9, -1.0, 0.0],
  [1, 11, 9, -2.9, 0.0],
  [0, 11, 10, -0.1, 0.0],
  [1, 11, 10, -1.8, 0.0],
  [0, 11, 11, 2.6, 0.0],
  [1, 11, 11, -2.3, 0.0],
  [0, 12, 0, -2.0, 0.0],
  [0, 12, 1, -0.1, 0.0],
  [1, 12, 1, -1.2, 0.0],
  [0, 12, 2, 0.4, 0.0],
  [1, 12, 2, 0.6, 0.0],
  [0, 12, 3, 1.2, 0.0],
  [1, 12, 3, 1.0, 0.0],
  [0, 12, 4, -1.2, 0.0],
  [1, 12, 4, -1.5, 0.0],
  [0, 12, 5, 0.6, 0.0],
  [1, 12, 5, 0.0, 0.0],
  [0, 12, 6, 0.5, 0.0],
  [1, 12, 6, 0.6, 0.0],
  [0, 12, 7, 0.5, 0.0],
  [1, 12, 7, -0.2, 0.0],
  [0, 12, 8, -0.1, 0.0],
  [1, 12, 8, 0.8, 0.0],
  [0, 12, 9, -0.5, 0.0],
  [1, 12, 9, 0.1, 0.0],
  [0, 12, 10, -0.2, 0.0],
  [1, 12, 10, -0.9, 0.0],
  [0, 12, 11, -1.2, 0.0],
  [1, 12, 11, 0.1, 0.0],
  [0, 12, 12, -0.7, 0.0],
  [1, 12, 12, 0.2, 0.0],
  [0, 13, 0, 0.2, 0.0],
  [0, 13, 1, -0.9, 0.0],
  [1, 13, 1, -0.9, 0.0],
  [0, 13, 2, 0.6, 0.0],
  [1, 13, 2, 0.7, 0.0],
  [0, 13, 3, 0.7, 0.0],
  [1, 13, 3, 1.2, 0.0],
  [0, 13, 4, -0.2, 0.0],
  [1, 13, 4, -0.3, 0.0],
  [0, 13, 5, 0.5, 0.0],
  [1, 13, 5, -1.3, 0.0],
  [0, 13, 6, 0.1, 0.0],
  [1, 13, 6, -0.1, 0.0],
  [0, 13, 7, 0.7, 0.0],
  [1, 13, 7, 0.2, 0.0],
  [0, 13, 8, 0.0, 0.0],
  [1, 13, 8, -0.2, 0.0],
  [0, 13, 9, 0.3, 0.0],
  [1, 13, 9, 0.5, 0.0],
  [0, 13, 10, 0.2, 0.0],
  [1, 13, 10, 0.6, 0.0],
  [0, 13, 11, 0.4, 0.0],
  [1, 13, 11, -0.6, 0.0],
  [0, 13, 12, -0.5, 0.0],
  [1, 13, 12, -0.3, 0.0],
  [0, 13, 13, -0.4, 0.0],
  [1, 13, 13, -0.5, 0.0]
];

const A_REF = 6371.2; // IGRF reference radius, km
const WGS84_A = 6378.137;
const WGS84_B = 6356.7523142;

// Schmidt semi-normalised P and dP/dtheta by the standard stable
// recursion, up to degree N.
export function legendre(N, ct, st) {
  const P = [];
  const dP = [];
  for (let n = 0; n <= N; n++) {
    P.push(new Float64Array(n + 1));
    dP.push(new Float64Array(n + 1));
  }
  P[0][0] = 1;
  dP[0][0] = 0;
  for (let n = 1; n <= N; n++) {
    for (let m = 0; m <= n; m++) {
      if (n === m) {
        // Schmidt semi-normalisation: P(1,1) = sin(theta) exactly;
        // the sqrt((2m-1)/(2m)) diagonal factor starts at m = 2.
        const k = m === 1 ? 1 : Math.sqrt(1 - 1 / (2 * m));
        P[n][m] = k * st * P[n - 1][m - 1];
        dP[n][m] = k * (st * dP[n - 1][m - 1] + ct * P[n - 1][m - 1]);
      } else {
        // Schmidt off-diagonal recursion:
        // P(n,m) = [(2n-1) ct P(n-1,m) - sqrt((n-1+m)(n-1-m))
        //           P(n-2,m)] / sqrt((n+m)(n-m))
        const c1 = 2 * n - 1;
        const c2 = Math.sqrt((n - 1 + m) * (n - 1 - m));
        const c3 = Math.sqrt((n + m) * (n - m));
        const Pm2 = n - 2 >= m ? P[n - 2][m] : 0;
        const dPm2 = n - 2 >= m ? dP[n - 2][m] : 0;
        P[n][m] = (c1 * ct * P[n - 1][m] - c2 * Pm2) / c3;
        dP[n][m] =
          (c1 * (ct * dP[n - 1][m] - st * P[n - 1][m]) - c2 * dPm2) / c3;
      }
    }
  }
  return {P, dP};
}

/**
 * Field at geodetic (latDeg, lonDeg, altKm) and decimal year, to
 * maxDegree (default 13). Returns {x, y, z, h, f, d, i}: north/
 * east/down nT, horizontal, total, declination and inclination in
 * DEGREES.
 */
export function igrfField(latDeg, lonDeg, altKm, year, maxDegree = 13) {
  const dt = Math.min(Math.max(year - 2025, 0), 5);
  const rad = Math.PI / 180;
  const slat = Math.sin(latDeg * rad);
  const clat = Math.cos(latDeg * rad);
  // Geodetic (WGS84) -> geocentric, the geomag70 formulation: r is
  // the geocentric radius, (sd, cd) rotate vectors between the two
  // frames in the meridian plane.
  const a2 = WGS84_A * WGS84_A;
  const b2 = WGS84_B * WGS84_B;
  const rho = Math.sqrt(a2 * clat * clat + b2 * slat * slat);
  const r = Math.sqrt(
    altKm * altKm +
      2 * altKm * rho +
      (a2 * a2 * clat * clat + b2 * b2 * slat * slat) / (rho * rho)
  );
  const cd = (altKm + rho) / r;
  const sd = (((a2 - b2) / rho) * clat * slat) / r;
  const slatGC = slat * cd - clat * sd;
  const ct = slatGC; // cos(colat) = sin(geocentric lat)
  const st = Math.max(Math.sqrt(1 - ct * ct), 1e-12);
  const phi = lonDeg * rad;

  const N = maxDegree;
  const {P, dP} = legendre(N, ct, st);
  const cm = new Float64Array(N + 1);
  const sm = new Float64Array(N + 1);
  for (let m = 0; m <= N; m++) {
    cm[m] = Math.cos(m * phi);
    sm[m] = Math.sin(m * phi);
  }
  const g = [];
  for (let n = 0; n <= N; n++) g.push(new Float64Array(2 * (n + 1)));
  for (const [gh, n, m, main, sv] of COEFFS) {
    if (n > N) continue;
    g[n][2 * m + gh] = main + sv * dt;
  }
  let Br = 0;
  let Bt = 0;
  let Bp = 0;
  const ar = A_REF / r;
  let arn = ar * ar; // becomes (a/r)^{n+2} inside the loop
  for (let n = 1; n <= N; n++) {
    arn *= ar;
    let sr = 0;
    let stt = 0;
    let sp = 0;
    for (let m = 0; m <= n; m++) {
      const gc = g[n][2 * m];
      const hc = g[n][2 * m + 1];
      const t = gc * cm[m] + hc * sm[m];
      sr += t * P[n][m];
      stt += t * dP[n][m];
      sp += m * (-gc * sm[m] + hc * cm[m]) * P[n][m];
    }
    Br += arn * (n + 1) * sr;
    Bt -= arn * stt;
    Bp -= (arn * sp) / st;
  }
  // Geocentric spherical components -> geodetic north/east/down
  // (geomag70: x = x' cd + z' sd, z = z' cd - x' sd).
  const xGC = -Bt;
  const zGC = -Br;
  const X = xGC * cd + zGC * sd;
  const Z = zGC * cd - xGC * sd;
  const Y = Bp;
  const H = Math.hypot(X, Y);
  const F = Math.hypot(H, Z);
  const deg = 180 / Math.PI;
  return {
    x: X,
    y: Y,
    z: Z,
    h: H,
    f: F,
    d: Math.atan2(Y, X) * deg,
    i: Math.atan2(Z, H) * deg
  };
}

// Dipole (n = 1) terms at a decimal year - for the analytic checks
// and the geomagnetic pole/latitude.
export function dipole(year) {
  const dt = Math.min(Math.max(year - 2025, 0), 5);
  let g10 = 0;
  let g11 = 0;
  let h11 = 0;
  for (const [gh, n, m, main, sv] of COEFFS) {
    if (n !== 1) continue;
    const v = main + sv * dt;
    if (gh === 0 && m === 0) g10 = v;
    else if (gh === 0 && m === 1) g11 = v;
    else h11 = v;
  }
  const B0 = Math.hypot(g10, g11, h11);
  // North geomagnetic pole (boreal axis end; g10 < 0)
  const latP = Math.asin(-g10 / B0) * (180 / Math.PI);
  const lonP = Math.atan2(-h11, -g11) * (180 / Math.PI);
  return {g10, g11, h11, B0, latP, lonP};
}

// Geomagnetic (dipole) latitude of a geodetic point, degrees.
export function geomagneticLatitude(latDeg, lonDeg, year) {
  const {latP, lonP} = dipole(year);
  const rad = Math.PI / 180;
  const s =
    Math.sin(latDeg * rad) * Math.sin(latP * rad) +
    Math.cos(latDeg * rad) *
      Math.cos(latP * rad) *
      Math.cos((lonDeg - lonP) * rad);
  return Math.asin(Math.min(Math.max(s, -1), 1)) * (180 / Math.PI);
}
