/**
 * gwaves.js - gravity-wave banding on the nightglow: the striped
 * structure every all-sky airglow imager records, drawn on the
 * theme's own 557.7 nm line with printed statistics. Gated by
 * gwaves-reference.mjs.
 *
 * THE PRIMARIES - both Annales Geophysicae, both open access,
 * both read:
 *  - Hwang et al. 2022 (ANGEO 40, 247): three years of OI
 *    557.7 nm all-sky imaging at Mt. Bohyun - THE line the
 *    theme's airglow dome draws, at its printed ~96 km layer.
 *    150 wave events in 144 clear nights (about one per clear
 *    night - the drawn cadence). Printed interquartile ranges:
 *    horizontal wavelength 20.5-35.5 km (median 27.8), observed
 *    phase speed 27.4-45.0 m/s (median 36.3), observed period
 *    10.8-13.7 min (median 11.7). Internal consistency the gate
 *    holds: the medians' own implied period, 27.8 km / 36.3 m/s
 *    = 12.8 min, sits inside the printed period IQR.
 *  - Suzuki et al. 2009 (ANGEO 27, 1625): 702 events of OH
 *    imaging at Kototabang with an auto-detection scheme whose
 *    printed detection floor is an intensity amplitude of 0.5%,
 *    and whose printed result is "the intensity amplitudes were
 *    less than 3%" - the AMPLITUDE WINDOW [0.5%, 3%] the drawn
 *    modulation lives in. (Their wavelengths 30-90 km and
 *    speeds 40-70 m/s bracket the Bohyun IQRs from the
 *    equatorial side - two stations, one phenomenon.)
 *
 * THE DRAWN FORM: one dominant wave train per night (the
 * printed ~1 event/clear night), its wavelength, speed,
 * direction and amplitude hashed per site-night INSIDE the
 * printed windows (the halo episode-node pattern - deterministic
 * display cadence on printed statistics), modulating the GREEN
 * line of the airglow dome as 1 + a sin(k.h - omega t) where h
 * is the view ray's horizontal position AT THE PRINTED 96 km
 * LAYER - so the bands compress toward the horizon by pure
 * perspective, exactly as the all-sky images show, and drift at
 * the printed phase speed. The red doublet (250 km) and Na D
 * layers are left unmodulated (the imaged statistics are the
 * green/OH mesopause region; the ionospheric red line's
 * structure is a different animal). Visibility is the dome's
 * own Crumey gate - the banding is a few percent of an
 * already-threshold-gated glow, a whisper at 1x exactly like
 * the real thing.
 */

import {mulberry32} from './halos.js';

// ---- Hwang et al. 2022, printed (OI 557.7, ~96 km) --------------
export const GW_LAYER_KM = 96;
export const GW_LAMBDA_KM = [20.5, 35.5]; // IQR
export const GW_LAMBDA_MED_KM = 27.8;
export const GW_SPEED_MS = [27.4, 45.0]; // IQR
export const GW_SPEED_MED_MS = 36.3;
export const GW_PERIOD_MIN = [10.8, 13.7]; // IQR
export const GW_PERIOD_MED_MIN = 11.7;
export const GW_EVENTS = 150;
export const GW_NIGHTS = 144; // clear nights - ~1 event per night

// ---- Suzuki et al. 2009, printed (OH, Kototabang) ---------------
export const GW_AMP = [0.005, 0.03]; // detection floor .. "less than 3%"

// One seed per site-night, anchored at local noon so the draw
// never flips mid-night.
export function gwNightIndex(utcMs, lonDeg) {
  return Math.floor((utcMs / 3600e3 + lonDeg / 15 - 12) / 24);
}

// The night's dominant wave train: wavelength, speed and
// amplitude uniform INSIDE the printed windows, direction
// uniform on the circle (Hwang's seasonal direction biases are
// real but wind-filtered - the drawn direction stays a fair
// draw, documented).
export function gwNight(night, latDeg, lonDeg) {
  const seed =
    (Math.imul(night, 2654435761) ^
      Math.imul(Math.round(latDeg * 10) + 900, 668265263) ^
      Math.imul(Math.round(lonDeg * 10) + 1800, 40503)) >>>
    0;
  const rng = mulberry32(seed);
  const lambdaM =
    (GW_LAMBDA_KM[0] + rng() * (GW_LAMBDA_KM[1] - GW_LAMBDA_KM[0])) * 1000;
  const speedMs = GW_SPEED_MS[0] + rng() * (GW_SPEED_MS[1] - GW_SPEED_MS[0]);
  const azRad = rng() * 2 * Math.PI;
  const amp = GW_AMP[0] + rng() * (GW_AMP[1] - GW_AMP[0]);
  return {lambdaM, speedMs, azRad, amp};
}

// Wave-vector components in the scene frame (east = +x,
// north = -z) and the phase rate - everything the dome's
// modulation needs from one draw.
export function gwUniforms(draw) {
  const k = (2 * Math.PI) / draw.lambdaM;
  return {
    kx: k * Math.sin(draw.azRad),
    kz: -k * Math.cos(draw.azRad),
    omega: k * draw.speedMs,
    amp: draw.amp
  };
}
