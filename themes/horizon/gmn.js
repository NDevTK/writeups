/**
 * gmn.js - the Global Meteor Network's measured meteors shape
 * the drawn streaks: yesterday's triangulated begin/end heights,
 * speeds and durations replace the display kinematics. Gated by
 * gmn-reference.mjs against vendored real rows.
 *
 * THE PRIMARY - Vida et al. 2021 ("The Global Meteor Network -
 * Methodology and first results", MNRAS 506, 5046; open on arXiv
 * as 2107.12335, READ): the network system paper. What it prints
 * and this module carries:
 *  - the network: wide-field video cameras (88 x 48 deg, 25 fps)
 *    at stellar limiting magnitude +6.0 +/- 0.5, over 220,000
 *    precise orbits (2018-2021), median radiant precision 0.47
 *    deg - the world's largest open optical meteor survey, CC BY
 *  - THEIR OWN validity fences, applied verbatim by this parser:
 *    trajectories are rejected when the end height exceeds the
 *    begin height, when the meteor begins outside 50-150 km, or
 *    ends above 130 or below 20 km
 *
 * THE FEED - the daily trajectory summary
 * (globalmeteornetwork.org/data/traj_summary_data/daily/,
 * CC BY 4.0, keyless, CORS-open): every meteor the network
 * triangulated in the last day - IAU shower code, entry
 * elevation, velocities, begin/end heights, measured duration,
 * peak magnitude. ~6-7000 meteors on an August day. The theme's
 * horizon-live daemon reduces the ~6 MB file to per-shower
 * MEDIANS (heights, duration, speed) served as a
 * few-hundred-byte JSON; raw COUNTS are deliberately NOT turned
 * into rates - flux needs the network's own collecting-area
 * weighting (their separate methodology paper), and the theme's
 * rates stay with the printed IMO/Jenniskens machinery.
 *
 * THE KINEMATIC BRIDGE - exact geometry replacing the old
 * documented display mapping ("~20 deg/s x (V/72) x sin D"):
 *  - a meteor travels ALONG the radiant direction, so its entry
 *    slope at the observer's site is the radiant's own elevation;
 *    the luminous path is (HtBeg - HtEnd)/sin(radiant elevation)
 *  - the streak's angular rate seen at radiant distance D is
 *    EXACTLY V sin(D) / range, with the slant range to the
 *    streak's mean height at the sky point's elevation through
 *    the spherical-shell chord (the sprites/STEVE passes' own
 *    curvature geometry)
 *  - duration = path / V - and the gate PROVES this bridge reads
 *    the file right: on the vendored real rows, path/sin(elev)/V
 *    reproduces the network's own measured Duration column
 * The old hand mapping's fixed ~200 km range and 14-degree
 * length scale retire; every drawn number now traces to
 * yesterday's measurements (or the vendored real-day medians
 * when the feed is unreachable - fails to DATA, never to style).
 */

// ---- Vida et al. 2021, printed ----------------------------------
export const GMN_LM = 6.0; // stellar limiting magnitude (+/- 0.5)
export const GMN_ORBITS = 220000; // orbits 2018-2021 (paper)
export const GMN_RADIANT_PREC_DEG = 0.47; // median radiant precision
export const GMN_HT_BEG_KM = [50, 150]; // their begin-height fence
export const GMN_HT_END_KM = [20, 130]; // their end-height fence

// Fixed column indices of the daily trajectory summary (the
// format's own header; the gate pins them on vendored real rows).
export const GMN_COL = {
  code: 4,
  elev: 57,
  vinit: 59,
  vavg: 61,
  htBeg: 67,
  htEnd: 73,
  dur: 75,
  peakMag: 76
};

// Parse the daily summary: one row per triangulated meteor,
// Vida's own validity fences applied. code '...' = sporadic.
export function parseTrajSummary(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    if (line.startsWith('#') || line.split(';').length < 80) continue;
    const f = line.split(';').map((x) => x.trim());
    const code = f[GMN_COL.code];
    const elev = parseFloat(f[GMN_COL.elev]);
    const v = parseFloat(f[GMN_COL.vavg]);
    const hb = parseFloat(f[GMN_COL.htBeg]);
    const he = parseFloat(f[GMN_COL.htEnd]);
    const dur = parseFloat(f[GMN_COL.dur]);
    const mag = parseFloat(f[GMN_COL.peakMag]);
    if (
      !Number.isFinite(hb) ||
      !Number.isFinite(he) ||
      !Number.isFinite(dur) ||
      !Number.isFinite(v) ||
      hb <= he ||
      hb < GMN_HT_BEG_KM[0] ||
      hb > GMN_HT_BEG_KM[1] ||
      he < GMN_HT_END_KM[0] ||
      he > GMN_HT_END_KM[1] ||
      dur <= 0 ||
      v <= 5
    )
      continue;
    out.push({
      code: code === '...' ? 'spo' : code,
      elevDeg: elev,
      vKms: v,
      htBegKm: hb,
      htEndKm: he,
      durS: dur,
      peakMag: mag
    });
  }
  return out;
}

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2
    ? s[(s.length - 1) / 2]
    : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

// Per-shower medians (plus 'spo' and 'all'), the daemon's whole
// payload. minN keeps single-meteor "showers" from steering the
// draw (documented floor).
export function gmnMedians(rows, minN = 20) {
  const by = {};
  for (const r of rows) {
    (by[r.code] = by[r.code] || []).push(r);
    (by.all = by.all || []).push(r);
  }
  const out = {};
  for (const k of Object.keys(by)) {
    if (by[k].length < minN && k !== 'all') continue;
    out[k] = {
      n: by[k].length,
      htBegKm: Math.round(median(by[k].map((r) => r.htBegKm)) * 10) / 10,
      htEndKm: Math.round(median(by[k].map((r) => r.htEndKm)) * 10) / 10,
      durS: Math.round(median(by[k].map((r) => r.durS)) * 100) / 100,
      vKms: Math.round(median(by[k].map((r) => r.vKms)) * 10) / 10
    };
  }
  return out;
}

// ---- the exact kinematics ---------------------------------------
export const R_E_KM = 6371;
// Slant range (km) to a shell at height hKm seen at elevation
// elRad: the spherical chord, exact.
export function slantRangeKm(hKm, elRad) {
  const se = Math.sin(Math.max(elRad, 0.05));
  return (
    Math.sqrt(R_E_KM * R_E_KM * se * se + 2 * R_E_KM * hKm + hKm * hKm) -
    R_E_KM * se
  );
}
// Everything the drawn streak needs: med = a medians entry
// {htBegKm, htEndKm, vKms}, radAltRad = the radiant's current
// elevation (the meteor's own entry slope at this site), sinD =
// sin(radiant distance of the sky point), elPointRad = the sky
// point's elevation. Returns angular length (rad), angular rate
// (rad/s) and the luminous duration (s) - all exact geometry on
// measured numbers.
export function streakKinematics(med, radAltRad, sinD, elPointRad) {
  const slope = Math.max(Math.sin(Math.max(radAltRad, 0)), 0.2);
  const pathKm = (med.htBegKm - med.htEndKm) / slope;
  const hMid = (med.htBegKm + med.htEndKm) / 2;
  const range = slantRangeKm(hMid, elPointRad);
  return {
    lenRad: (pathKm * sinD) / range,
    rateRadS: (med.vKms * sinD) / range,
    durS: pathKm / med.vKms,
    rangeKm: range,
    pathKm
  };
}
