// Real sunspots on the drawn sun. Every constant below traces to a
// source read in full, and the feed semantics were pinned by
// testing (see WEBGPU-PLAN research log, Jul 11):
//
//  - NOAA SWPC solar_regions.json is a 30-DAY HISTORY; each row's
//    'longitude' is the east-positive CMD valid at that row's OWN
//    date 2400Z (cross-checked against the SRS text product:
//    JSON -33 on 2026-07-10 = SRS "W33"). Placement therefore uses
//    the row's carrington_longitude against L0(t) computed at
//    RENDER time - continuous, never a day stale.
//  - Disc geometry: Meeus, Astronomical Algorithms ch. 29 (P, B0,
//    L0); held to Meeus's own worked example 29.a by the gate.
//  - Sizes: SWPC 'area' is the corrected whole-group area in
//    millionths of the solar hemisphere -> equivalent spot radius
//    r/R = sqrt(2 A 1e-6). The umbra takes 1/(1 + 5.5) of the spot
//    area - the mean penumbra/umbra area ratio of 8 solar cycles
//    of Kodaikanal white-light data (Jha, Mandal & Banerjee 2018,
//    arXiv:1805.06307; size-stable above 100 uhem).
//  - Brightness at 676.8 nm: Mathew, Martinez Pillet, Solanki &
//    Krivova 2007 (A&A 465, 291) Table 2 double-linear fits
//    (their lowest-chi^2 form): mean umbral and mean penumbral
//    intensity vs radius in arcsec, stray-light and Ni-line
//    corrected, 160+ spots. Their headline: a single umbral
//    brightness for all spots is "a very poor approximation".
//  - Wavelength transfer to the theme's 680/550/440 nm: Maltby et
//    al. 1986 (ApJ 306, 284) Table 3 mid-cycle umbra/photosphere
//    ratios define the umbral brightness-temperature curve
//    T_b(lambda); a spot of a given size shifts that whole curve
//    by a constant Delta-T anchored at Mathew's 676.8 nm value.
//    Maltby themselves found cycle-to-cycle brightness changes act
//    as a near-uniform T_b shift across all ten of their bands -
//    the same mechanism reused for the size dependence. The
//    penumbra sits close enough to the photosphere that a single
//    Planck temperature carries its (order-of-magnitude smaller,
//    Maltby p. 287) wavelength dependence.
//  - Contrast limb-darkening is IGNORED with cause: Maltby Table 1
//    gives |b(lambda)| <= 0.012 for lambda < 0.7 um. Cycle-phase
//    dependence is ignored with cause: Mathew 2007 Sec. 5 found it
//    statistically insignificant in their larger sample.

export const T_PHOTOSPHERE = 5772; // K, IAU 2015 B3 (Planck anchor)
export const LAMBDAS_NM = [680, 550, 440];
const DEG = Math.PI / 180;

// Maltby et al. 1986, Table 3, middle phase (t/t0 = 0.5): broadband
// umbra/photosphere intensity ratios, limb-darkening corrected -
// the visible + nearest-IR rows that bracket the theme's channels.
export const MALTBY_MID = [
  [387, 0.008],
  [579, 0.066],
  [669, 0.09],
  [876, 0.215]
];

// Mathew et al. 2007, Table 2, double-linear fits at 676.8 nm
// (radius in arcsec; the two size regimes are independent
// regressions - the small step at 10 arcsec is theirs, kept).
export const MATHEW_NM = 676.8;
export const MATHEW = {
  umbralMean: {lo: [0.6536, -0.0266], hi: [0.4858, -0.0087], split: 10},
  penumbralMean: [0.8561, -0.0016]
};

// Jha, Mandal & Banerjee 2018: mean penumbra/umbra area ratio.
export const PU_AREA_RATIO = 5.5;

// Mean solar angular radius (arcsec) - converts area-equivalent
// radii (fractions of the solar radius) to Mathew's arcsec axis.
export const SUN_RADIUS_ARCSEC = 959.63;

// ---- Planck machinery -------------------------------------------

// Spectral radiance ratio B(tA)/B(tB) at wavelength nm (the c1
// factors cancel; c2 = 1.438777e-2 m K, 2018 CODATA).
export function planckRatio(nm, tA, tB) {
  const c2l = 1.438776877e-2 / (nm * 1e-9);
  return Math.expm1(c2l / tB) / Math.expm1(c2l / tA);
}

// Brightness temperature of an intensity ratio against the
// photosphere at wavelength nm (exact Planck inversion).
export function brightnessT(nm, ratio) {
  const c2l = 1.438776877e-2 / (nm * 1e-9);
  return c2l / Math.log1p(Math.expm1(c2l / T_PHOTOSPHERE) / ratio);
}

// Maltby's umbral brightness-temperature curve, piecewise linear
// in wavelength between the measured Table 3 nodes (clamped ends).
export function maltbyTb(nm) {
  const pts = MALTBY_MID.map(([l, r]) => [l, brightnessT(l, r)]);
  if (nm <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++)
    if (nm <= pts[i][0]) {
      const f = (nm - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
      return pts[i - 1][1] + f * (pts[i][1] - pts[i - 1][1]);
    }
  return pts[pts.length - 1][1];
}

// ---- Photometry: size -> per-channel tints ----------------------

// Mathew mean umbral intensity at 676.8 nm for an umbral radius in
// arcsec (their double-linear form, floored at 0.05 - the fits are
// regressions, not asymptotes).
export function mathewUmbralMean(rArcsec) {
  const m = MATHEW.umbralMean;
  const c = rArcsec < m.split ? m.lo : m.hi;
  return Math.max(c[0] + c[1] * rArcsec, 0.05);
}

export function mathewPenumbralMean(rSpotArcsec) {
  const p = MATHEW.penumbralMean;
  return Math.min(Math.max(p[0] + p[1] * rSpotArcsec, 0.6), 0.95);
}

// Per-channel umbra and penumbra intensities for a spot: Mathew's
// 676.8 nm value anchors a constant Delta-T shift of the Maltby
// T_b(lambda) curve (umbra); the penumbra is a single Planck
// temperature (see header).
export function spotPhotometry(rUmbraArcsec, rSpotArcsec) {
  const i676 = mathewUmbralMean(rUmbraArcsec);
  const dT = brightnessT(MATHEW_NM, i676) - maltbyTb(MATHEW_NM);
  const umbra = LAMBDAS_NM.map((nm) =>
    planckRatio(nm, maltbyTb(nm) + dT, T_PHOTOSPHERE)
  );
  const tPen = brightnessT(MATHEW_NM, mathewPenumbralMean(rSpotArcsec));
  const penumbra = LAMBDAS_NM.map((nm) => planckRatio(nm, tPen, T_PHOTOSPHERE));
  return {umbra, penumbra};
}

// ---- Meeus ch. 29 disc geometry ---------------------------------

// P, B0, L0 (degrees) from a UT julian day. Delta-T moves L0 by
// < 0.02 deg - far below a spot radius. Gate: Meeus ex. 29.a.
export function solarDiscGeometry(jd) {
  const T = (jd - 2451545) / 36525;
  const theta = ((jd - 2398220) * 360) / 25.38;
  const I = 7.25;
  const K = 73.6667 + (1.3958333 * (jd - 2396758)) / 36525;
  const L0m = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * DEG;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
    0.000289 * Math.sin(3 * M);
  const omega = (125.04 - 1934.136 * T) * DEG;
  const lam = L0m + C - 0.00569;
  const lamApp = lam - 0.00478 * Math.sin(omega);
  const eps0 = 23.43929111 - (46.815 * T + 0.00059 * T * T) / 3600;
  const eps = eps0 + 0.00256 * Math.cos(omega);
  const x = Math.atan(-Math.cos(lamApp * DEG) * Math.tan(eps * DEG)) / DEG;
  const y = Math.atan(-Math.cos((lam - K) * DEG) * Math.tan(I * DEG)) / DEG;
  const B0 = Math.asin(Math.sin((lam - K) * DEG) * Math.sin(I * DEG)) / DEG;
  const eta =
    Math.atan2(
      -Math.sin((lam - K) * DEG) * Math.cos(I * DEG),
      -Math.cos((lam - K) * DEG)
    ) / DEG;
  return {P: x + y, B0, L0: (((eta - theta) % 360) + 360) % 360};
}

// Carrington longitude -> east-positive CMD at the given L0
// (carr - L0 is west-positive; SWPC's own 'longitude' field and
// spotOnDisc below are east-positive).
export function cmdFromCarrington(carrDeg, L0deg) {
  return -((((carrDeg - L0deg) % 360) + 540) % 360) + 180;
}

// Heliographic (lat, east-positive CMD) -> disc coordinates in
// solar radii: +y solar north on the disc, +x toward the WEST limb
// (the side rotation carries spots toward); z > 0 visible.
export function spotOnDisc(latDeg, cmdDeg, B0deg) {
  const phi = latDeg * DEG;
  const d = cmdDeg * DEG;
  const b0 = B0deg * DEG;
  return {
    x: -Math.cos(phi) * Math.sin(d),
    y:
      Math.sin(phi) * Math.cos(b0) - Math.cos(phi) * Math.sin(b0) * Math.cos(d),
    z: Math.sin(phi) * Math.sin(b0) + Math.cos(phi) * Math.cos(b0) * Math.cos(d)
  };
}

// Solar-frame disc offsets -> the local vertical frame of the
// drawn disc: rotate by the axis position angle P (solar N ->
// celestial N), then by the parallactic angle q (celestial N ->
// zenith). {v, h} in solar radii: v toward the zenith, h toward
// increasing azimuth.
export function discToAltAz(x, y, Pdeg, qDeg) {
  const a = (Pdeg - qDeg) * DEG;
  return {
    v: y * Math.cos(a) - x * Math.sin(a),
    h: -(x * Math.cos(a) + y * Math.sin(a))
  };
}

// Parallactic angle (Meeus ch. 14): 0 on the meridian, positive
// west of it for northern observers. hourAngleRad = LST - RA.
export function parallacticAngle(hourAngleRad, latRad, decRad) {
  return Math.atan2(
    Math.sin(hourAngleRad),
    Math.tan(latRad) * Math.cos(decRad) -
      Math.sin(latRad) * Math.cos(hourAngleRad)
  );
}

// ---- The live feed -> drawable spots ----------------------------

// regions: SWPC solar_regions.json rows (the 30-day history). jd:
// UT julian day at RENDER time; qDeg: the sun's parallactic angle.
// Keeps the latest observed date's rows with real areas, places
// them from carrington_longitude against L0(jd) (never the staled
// 'longitude' field), drops the far side. Largest first, max 8:
// {v, h, rU, rP (solar radii), shorten, umbra[3], penumbra[3]}.
export function buildSpots(regions, jd, qDeg, max = 8) {
  if (!Array.isArray(regions) || !regions.length) return [];
  const latest = regions.reduce(
    (a, r) => (r.observed_date > a ? r.observed_date : a),
    ''
  );
  const geo = solarDiscGeometry(jd);
  const out = [];
  for (const r of regions) {
    if (r.observed_date !== latest) continue;
    if (
      !Number.isFinite(r.latitude) ||
      !Number.isFinite(r.carrington_longitude)
    )
      continue;
    const area = +r.area || 0;
    if (area <= 0) continue;
    const cmd = cmdFromCarrington(r.carrington_longitude, geo.L0);
    const p = spotOnDisc(r.latitude, cmd, geo.B0);
    if (p.z <= 0.05) continue;
    const rP = Math.sqrt(2 * area * 1e-6); // solar radii
    const rU = rP / Math.sqrt(1 + PU_AREA_RATIO);
    const {v, h} = discToAltAz(p.x, p.y, geo.P, qDeg);
    const photo = spotPhotometry(
      rU * SUN_RADIUS_ARCSEC,
      rP * SUN_RADIUS_ARCSEC
    );
    out.push({
      v,
      h,
      rU,
      rP,
      shorten: p.z,
      umbra: photo.umbra,
      penumbra: photo.penumbra,
      region: r.region
    });
  }
  out.sort((a, b) => b.rP - a.rP);
  return out.slice(0, max);
}
