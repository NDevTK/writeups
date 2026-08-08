/**
 * steve.js - STEVE (Strong Thermal Emission Velocity
 * Enhancement): the narrow mauve subauroral arc and its green
 * picket fence, from two open primaries READ IN FULL. Gated by
 * steve-reference.mjs.
 *
 * THE PRIMARIES
 *  - MacDonald et al. 2018 (Science Advances 4, eaaq0030, via
 *    the PMC deposit - the discovery paper): STEVE is a thin
 *    east-west-aligned mauve arc "significantly equatorward of
 *    the auroral oval during enhanced activity", "typically
 *    observed during premidnight hours (MLT), lasting for
 *    approximately an hour", with "small green auroral
 *    features, resembling a picket fence". The conjunction
 *    event: arc "just below 60 deg MLAT" (peak 59.5), westward
 *    ion flow 5.5 km/s with FWHM < 0.5 deg MLAT, electron
 *    temperature 6000 K, density trough 1e10 m^-3; optical
 *    mapping assumed peak emission altitudes 170-230 km; the
 *    proton aurora sat >= 2 deg poleward. The SAID climatology
 *    they quote: ~60.1 deg MLAT around 22:30 MLT, average
 *    half-width 0.57 deg, substorm-associated, spring/fall
 *    preference "consistent with the seasonal distribution of
 *    citizen science STEVE reports". Faint in 630 nm narrowband
 *    yet bright broadband - the mauve is a continuum-bearing
 *    mixture ("exotic emissions").
 *  - Chu, Malaspina, Gallardo-Lacourt et al. 2019 ("Identifying
 *    the magnetospheric driver of STEVE", GRL; arXiv:1906.08886
 *    read in full, the equation page machine-read): the driver
 *    is an SAID at a sharp plasmapause; "STEVE lasted about one
 *    hour, ... consistent with the duration of an SAID"; and the
 *    PRINTED photometric chain this module ships - the Carlson
 *    et al. 2013 O(1D) thermal excitation rate
 *      alpha(Te) = 0.15 sqrt(Te) (8537 + Te)/(34191 + Te)^3
 *                  exp(-22756/Te)  [cm^3/s]
 *    integrated 250-650 km, anchored on Foster et al. 1994's SAR
 *    arc (350 R at Te 3500-4000 K, Ne 2.0e4 cm^-3) against the
 *    event's Te ~ 7600 K, Ne 1.3e4: "red auroral emission of 7
 *    to 17 kR which is visible to the human eye", with their own
 *    caveat that flow-channel depletion may lower it. The gate
 *    RE-DERIVES their bracket from the formula and anchors -
 *    and finds the printed window IS the Foster Te span alone:
 *    350 x alpha(7600)/alpha(4000) = 7.1 kR, 350 x
 *    alpha(7600)/alpha(3500) = 16.9 kR. The Ne difference
 *    (x0.65) is their separate depletion caveat, not folded in.
 *
 * THE DRAWN CHAIN - all on shipped machinery:
 *  - occurrence: the theme's live SWPC/OVATION aurora state
 *    (solarwind.js Newell coupling + hemispheric power) already
 *    says when the oval is active; STEVE draws in the printed
 *    premidnight window at the printed subauroral position,
 *    for the printed ~1 h episode;
 *  - geometry: the arc sits at the printed ~60 deg MLAT with the
 *    observer's own geomagnetic latitude (igrf.js gmLat) setting
 *    the viewing elevation through the same curvature-drop
 *    mapping the sprites gate (170-230 km printed altitudes);
 *  - brightness: the printed 7-17 kR redline estimate through
 *    the theme's SI rayleigh chain (airglow.js lineLuminance at
 *    630 nm) and the same Crumey extended-source gate the
 *    aurora and sprites ride - dark-sky visible ("visible to
 *    the human eye"), extinguished by daylight and city glow;
 *  - colour: the redline 630 nm share is printed; the continuum
 *    share of the mauve is NOT explained by the primaries
 *    ("exotic emissions") and is carried as a documented display
 *    mixture; the picket fence draws in the aurora's own
 *    certified 557.7 nm green (aurora-lut machinery),
 *    westward-stepping per the print.
 *
 * A display finding from the capture session: the drawn colours
 * enter the frame photopic (the camera's mauve), and the theme's
 * cited mesopic machinery then mutes the 630 nm share at night
 * exactly as rod vision does (Purkinje) - the 1x ribbon reads
 * pale with green pickets, which is what naked-eye reports of
 * STEVE describe; the mauve is the long-exposure camera's
 * colour. The hue downstream of the adaptation chain is that
 * chain's cited business, not this module's.
 */

import {mulberry32} from './halos.js';

// ---- MacDonald et al. 2018, printed -----------------------------
export const STEVE_MLAT = 60; // "just below 60 deg" (event 59.5)
export const SAID_MLAT = 60.1; // quoted SAID climatology
export const SAID_MLT_H = 22.5; // "around 22:30 in MLT"
export const SAID_HALF_W_DEG = 0.57; // average half-width
export const STEVE_FLOW_KMS = 5.5; // event westward peak
export const STEVE_TE_ION_K = 6000; // event ionospheric Te
export const STEVE_ALT_KM = [170, 230]; // assumed emission peaks
export const STEVE_DUR_MIN = 60; // "approximately an hour"
export const PROTON_OFFSET_DEG = 2; // proton aurora >= 2 deg poleward
export const STEVE_LAM_RED = 630; // the REGO redline (nm)
export const PICKET_LAM = 557.7; // the green picket fence (nm)

// ---- Chu et al. 2019, printed (equation machine-read) -----------
export const ALPHA_A = 0.15;
export const ALPHA_B = 8537;
export const ALPHA_C = 34191;
export const ALPHA_E = 22756;
export const FOSTER_R = 350; // Foster 1994 SAR arc brightness (R)
export const FOSTER_TE_K = [3500, 4000];
export const FOSTER_NE = 2.0e4; // cm^-3 at 450 km
export const EVENT_NE = 1.3e4; // cm^-3 at 530 km
export const EVENT_TE_K = 7600;
export const STEVE_KR = [7, 17]; // their printed estimate window

// The O(1D) thermal electron excitation rate (Carlson et al. 2013
// as printed in Chu et al. 2019, cm^3/s).
export function alphaO1D(teK) {
  return (
    ALPHA_A *
    Math.sqrt(teK) *
    ((ALPHA_B + teK) / Math.pow(ALPHA_C + teK, 3)) *
    Math.exp(-ALPHA_E / teK)
  );
}

// Re-derivation of the printed 7-17 kR bracket: scale Foster's
// 350 R by the alpha ratio across the Foster Te span - and
// NOTHING else. The gate finds both printed ends land on the
// pure Te bracket (7.1 and 16.9 kR); the Ne depletion factor
// (EVENT_NE/FOSTER_NE = 0.65) is the paper's separately stated
// "may lower it" caveat, not part of the printed window.
export function steveKrBracket() {
  const s = (FOSTER_R * alphaO1D(EVENT_TE_K)) / 1000;
  return [s / alphaO1D(FOSTER_TE_K[1]), s / alphaO1D(FOSTER_TE_K[0])];
}

// ---- the drawn geometry ----------------------------------------
// Viewing elevation of the arc for an observer at geomagnetic
// latitude gmLat: ground distance to the printed MLAT along the
// magnetic meridian (111.2 km/deg), the sprite pass's
// curvature-drop mapping at the printed altitude band. Negative
// gmLat mirrors (southern hemisphere). Returns null when the arc
// is out of the practical viewing range.
export const KM_PER_DEG = 111.2;
function elRawDeg(dKm, altKm) {
  const drop = (dKm * dKm) / (2 * 6371);
  return (Math.atan2(altKm - drop, dKm) * 180) / Math.PI;
}
export function steveElevationDeg(gmLat, altKm = 200) {
  if (!Number.isFinite(gmLat)) return null;
  const d = Math.abs(STEVE_MLAT - Math.abs(gmLat)) * KM_PER_DEG;
  if (d < 30) return 80; // essentially overhead
  const el = elRawDeg(d, altKm);
  return el > 3 ? el : null; // below ~3 deg: refraction/murk, not drawn
}
// The drawn slab: viewing elevations of the printed 170 and
// 230 km emission edges (the ribbon's vertical extent on the
// sky), with the arc's slant range. Null when the slab top sits
// in the murk - fails closed like the centre.
export function steveSlabDeg(gmLat) {
  if (!Number.isFinite(gmLat)) return null;
  const d = Math.max(Math.abs(STEVE_MLAT - Math.abs(gmLat)) * KM_PER_DEG, 30);
  const lo = elRawDeg(d, STEVE_ALT_KM[0]);
  const hi = elRawDeg(d, STEVE_ALT_KM[1]);
  if (hi <= 3) return null;
  return {
    lo,
    hi,
    dKm: d,
    rangeKm: Math.hypot(d, (STEVE_ALT_KM[0] + STEVE_ALT_KM[1]) / 2)
  };
}
// The printed 5.5 km/s westward flow as the display's angular
// drift rate at the observer's slant range (rad/s) - the picket
// structures visibly stream westward at the printed speed.
export function steveDriftRadPerS(gmLat) {
  const s = steveSlabDeg(gmLat);
  return s ? STEVE_FLOW_KMS / s.rangeKm : 0;
}
// Poleward or equatorward of the observer? +1 = toward the
// magnetic pole (observer below the arc's MLAT), -1 = toward the
// equator.
export function steveSideSign(gmLat) {
  return Math.abs(gmLat) < STEVE_MLAT ? 1 : -1;
}
// The ribbon's Crumey solid angle: a thin arc a degree or two
// tall spanning tens of degrees - 0.01 sr is the conservative
// envelope (smaller than the full-curtain AURORA_SR 0.1; the
// threshold RISES as sources shrink, so the gate errs dark).
export const STEVE_SR = 0.01;

// The premidnight window (printed "premidnight hours" around the
// quoted 22:30 MLT): local mean solar time is the display's MLT
// proxy (documented approximation - the offset between MLT and
// LT at the drawn sites is folded into the window width). The
// window crosses midnight: [21:00, 00:30].
export const STEVE_LT_WINDOW = [21, 24.5];
export function inSteveWindow(localHours) {
  if (!Number.isFinite(localHours)) return false;
  const h = ((localHours % 24) + 24) % 24;
  return h >= STEVE_LT_WINDOW[0] || h <= STEVE_LT_WINDOW[1] - 24;
}
export function localSolarHours(utcMs, lonDeg) {
  if (!Number.isFinite(utcMs) || !Number.isFinite(lonDeg)) return NaN;
  return (((utcMs / 3600e3) % 24) + lonDeg / 15 + 48) % 24;
}

// ---- the printed ~1 h episode -----------------------------------
// "lasting for approximately an hour" inside the premidnight
// window. No per-night occurrence rate is printed, so the onset
// is hashed per site-night (deterministic display cadence - the
// halo episode-node pattern): each active night's episode lands
// somewhere in the window, runs the printed duration, and gets
// raised-cosine edges (~5 min).
export function eveningIndex(utcMs, lonDeg) {
  return Math.floor((utcMs / 3600e3 + lonDeg / 15 - STEVE_LT_WINDOW[0]) / 24);
}
export function steveOnsetHour(evening, latDeg, lonDeg) {
  const seed =
    (Math.imul(evening, 2654435761) ^
      Math.imul(Math.round(latDeg * 10) + 900, 40503) ^
      Math.imul(Math.round(lonDeg * 10) + 1800, 668265263)) >>>
    0;
  const u = mulberry32(seed)();
  return (
    STEVE_LT_WINDOW[0] +
    u * (STEVE_LT_WINDOW[1] - STEVE_LT_WINDOW[0] - STEVE_DUR_MIN / 60)
  );
}
export function steveEnvelope(localHours, onsetH) {
  if (!Number.isFinite(localHours) || !Number.isFinite(onsetH)) return 0;
  const m = ((((localHours - onsetH) % 24) + 24) % 24) * 60; // min since onset
  if (m > STEVE_DUR_MIN) return 0;
  const edge = 5;
  const s = (x) => (1 - Math.cos(Math.PI * Math.min(Math.max(x, 0), 1))) / 2;
  return s(m / edge) * s((STEVE_DUR_MIN - m) / edge);
}
