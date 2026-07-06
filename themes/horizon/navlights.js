/**
 * Aviation exterior lights - the single source shared by the
 * theme's night-aircraft system (Horizon.html) and the reference
 * printer (navlights-reference.mjs).
 *
 * The aircraft are MEASURED (live ADS-B via the daemon; the same
 * feed that lays the Schmidt-Appleman contrails by day) - after
 * sunset they carry the lights the REGULATIONS prescribe, exactly
 * as the ships carry COLREGS:
 *
 *  - 14 CFR 25.1385(c): forward position lights - RED on the
 *    left, GREEN on the right - each covering a dihedral from
 *    dead ahead to 110 degrees aft of it; 25.1389: the rear
 *    position light is WHITE over the remaining 140 degrees
 *    (70 to each side of dead astern). 110 + 110 + 140 = 360.
 *  - 25.1391 fixes the minimum in-flight intensities of the
 *    forward lights BY ANGLE FROM DEAD AHEAD: 40 cd inside 10
 *    degrees, 30 cd from 10 to 20, 5 cd from 20 to 110; the rear
 *    light holds 20 cd across its whole field.
 *  - 25.1401: anti-collision lights - the white wingtip strobes
 *    and the red beacon - flash 40 to 100 times per minute with
 *    at least 400 cd effective intensity near the horizontal.
 *  - 14 CFR 91.209: lighted from sunset to sunrise - the same
 *    -50 arcmin solar boundary the ships use (SUNSET_ELEV,
 *    imported: the model lives once).
 *
 * Sight line: Allard's law through the same apparentLux the
 * ships use, against the same 2e-7 lux threshold - so a 40 cd
 * position light dies at ~4.7 nm in clear air, and a 400 cd
 * strobe carries ~3x farther, exactly the night-sky experience.
 * Ranges are SLANT ranges: a jet 10 km up is 10 km away even
 * overhead.
 */

import {apparentLux} from './ships.js';

// 25.1385/25.1389 arcs. rel = relative bearing of the OBSERVER
// from the aircraft's nose, degrees clockwise [0, 360). Both
// forward lights reach dead ahead (visible together head-on).
export function lightArcsAir(rel) {
  const r = ((rel % 360) + 360) % 360;
  const green = r <= 110;
  const red = r >= 250 || r === 0;
  const tail = r > 110 && r < 250;
  return {green, red, tail};
}

// 25.1391 minimum intensity (candela) for the light seen at
// relative bearing rel - the table is symmetric about the nose
// for the two forward lights; the rear light is flat 20 cd.
export function positionIntensity(rel) {
  const r = ((rel % 360) + 360) % 360;
  const a = lightArcsAir(r);
  if (a.tail) return 20;
  const off = Math.min(r, 360 - r); // angle from dead ahead
  if (off <= 10) return 40;
  if (off <= 20) return 30;
  return 5;
}

// 25.1401: anti-collision effective intensity and flash-rate
// band (per MINUTE). The display picks a rate inside the band
// per aircraft (deterministic from its hex) - the band itself is
// the regulation.
export const ANTICOLLISION_CD = 400;
export const FLASH_PER_MIN = [40, 100];

// Deterministic strobe schedule for one aircraft: rate inside
// the certified band, phase spread by the 24-bit ICAO hex so a
// sky of aircraft never blinks in unison. Returns true when the
// strobe is lit at time t (s); pulses last `dutyMs`.
export function strobeOn(hex, t, dutyMs = 60) {
  const h = parseInt(String(hex), 16) || 0;
  const rate = (FLASH_PER_MIN[0] + (h % 41)) / 60; // 40..80 per min
  const phase = ((h >> 8) % 1000) / 1000;
  const cyc = t * rate + phase;
  return cyc - Math.floor(cyc) < (dutyMs / 1000) * rate;
}

// Visual range of a light of I candela: the distance (metres)
// where Allard's law (the ships' apparentLux, K transmissivity
// per nautical mile) meets the 2e-7 lux threshold. Bisection -
// exact to a metre.
export function visRangeM(I, K = 0.8, T = 2e-7) {
  let lo = 1;
  let hi = 200e3;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (apparentLux(I, mid, K) >= T) lo = mid;
    else hi = mid;
  }
  return lo;
}
