/**
 * closure.js - the radiative closure audit: the drawn sky's own
 * integral against the satellite's measured irradiance. The first
 * of the "validate against recorded reality" instruments: every
 * layer so far is gated against printed theory; this one makes
 * the assembled frame PREDICT a number somebody independently
 * measures every hour - the global horizontal irradiance already
 * fetched for the clearness index - and reports how far the
 * prediction lands. Mirrored by closure-reference.mjs.
 *
 * The drawn side is entirely the frame's own gated machinery:
 *  - diffuse: skyTransferE (adaptation.js) - the Hillaire dome
 *    hemisphere-integrated per unit TOA source, the SAME table
 *    the adaptation luminance rides (re-derived by the atmo
 *    gate's own march) - times the derived solar illuminance
 *    E0_LUX (128.2 klx, the magnitude bridge).
 *  - beam: sunTransmittanceJS (the gated Hillaire transmittance
 *    with the LIVE measured aerosol channel set) times E0_LUX
 *    times sin(alt) for the horizontal projection.
 *
 * The measured side arrives in W/m^2 (Open-Meteo satellite
 * radiation: shortwave_radiation = GHI, direct_radiation = the
 * beam on the horizontal, diffuse_radiation). The bridge is a
 * LUMINOUS EFFICACY derived EXACTLY - no assumed constant - from
 * the vendored ASTM G173-03 reference spectra (g173-data.js)
 * through the repo's own gated CIE Y (airglow.js) and 683 lm/W:
 * K = 683 int V(l) E(l) dl / int E(l) dl. The gate holds the
 * vendored table to the standard's own printed broadband totals
 * and the derived efficacies to the textbook window; the
 * standard's AM1.5 scope is stated (efficacy drifts of a few
 * percent across sky states are part of the printed-budget
 * discussion in the reference).
 *
 * TWO INDEPENDENT SOLAR CONSTANTS MEET HERE, the audit's own
 * cross-check: E0_LUX descends from Falchi's sky brightness pair
 * + the sun's visual magnitude (astronomy), while the G173 ETR
 * column integrates to its own solar illuminance (radiometry).
 * The gate holds their agreement to a stated band - two chains
 * that share no constant landing on one number.
 *
 * Stated scope: the transfer table is the CLEAR sky (the
 * Hillaire march), so the audit conditions on the Erbs
 * correlation's own printed clear branch (kt > 0.8, already the
 * repo's clearness anchor); cloudy-hour closure through the veil
 * chain is the stated next stage. E0_LUX is mean-distance - the
 * +-3.4% annual eccentricity envelope rides the stated budget.
 */

import {cieY} from './airglow.js';
import {E0_LUX, lum3, skyTransferE} from './adaptation.js';
import {sunTransmittanceJS} from './sun-transmittance.js';
import {G173_DIRECT, G173_ETR, G173_GLOBAL, G173_NM} from './g173-data.js';

// Trapezoid integral of a column (optionally weighted) over the
// vendored wavelength grid.
export function g173Integral(col, weight = null) {
  let s = 0;
  for (let i = 1; i < G173_NM.length; i++) {
    const w0 = G173_NM[i - 1];
    const w1 = G173_NM[i];
    let v0 = col[i - 1];
    let v1 = col[i];
    if (weight) {
      v0 *= weight(w0);
      v1 *= weight(w1);
    }
    s += 0.5 * (v0 + v1) * (w1 - w0);
  }
  return s;
}

// Broadband totals (W/m^2) - held to the standard's own prints.
export function g173Broadband() {
  return {
    etr: g173Integral(G173_ETR),
    global: g173Integral(G173_GLOBAL),
    direct: g173Integral(G173_DIRECT)
  };
}

// Luminous efficacy (lm/W) of a G173 column through the repo's
// gated CIE Y: K = 683 int V E / int E.
export function efficacyLmW(col) {
  return (683 * g173Integral(col, cieY)) / g173Integral(col);
}

export const K_GLOBAL_LMW = efficacyLmW(G173_GLOBAL);
export const K_DIRECT_LMW = efficacyLmW(G173_DIRECT);
export const K_ETR_LMW = efficacyLmW(G173_ETR);
// The standard's own solar illuminance (lux at mean distance):
// the ETR column's luminous integral - the radiometric twin of
// the astronomically derived E0_LUX.
export const G173_E0_LUX = K_ETR_LMW * g173Integral(G173_ETR);

// ---- the drawn side (lux, horizontal) -------------------------
export function drawnDiffuseLux(sunAltRad) {
  const e = skyTransferE(sunAltRad);
  return lum3(e[0], e[1], e[2]) * E0_LUX;
}
export function drawnBeamLux(sunAltRad, mieRad, eyeHM = 0) {
  const s = Math.sin(sunAltRad);
  if (!(s > 0)) return 0;
  const t = sunTransmittanceJS(s, mieRad, eyeHM);
  return lum3(t[0], t[1], t[2]) * E0_LUX * s;
}

// ---- the measured side (lux, horizontal) ----------------------
export function measuredLux({ghiWm2, dirWm2, difWm2}) {
  return {
    global: Number.isFinite(ghiWm2) ? ghiWm2 * K_GLOBAL_LMW : null,
    beam: Number.isFinite(dirWm2) ? dirWm2 * K_DIRECT_LMW : null,
    diffuse: Number.isFinite(difWm2) ? difWm2 * K_GLOBAL_LMW : null
  };
}

/**
 * The closure: drawn vs measured, as ratios (drawn/measured).
 * Returns null when the sun is below 5 deg (the Haurwitz/kt
 * chain's own validity floor - grazing geometry swamps both
 * sides) or the measurement is missing. The caller conditions on
 * the Erbs clear branch before treating the ratios as a
 * clear-sky audit.
 */
export function closureRatios({
  sunAltRad,
  mieRad,
  eyeHM,
  ghiWm2,
  dirWm2,
  difWm2
}) {
  if (!(sunAltRad > (5 * Math.PI) / 180)) return null;
  const m = measuredLux({ghiWm2, dirWm2, difWm2});
  if (m.global == null || !(m.global > 0)) return null;
  const dBeam = drawnBeamLux(sunAltRad, mieRad, eyeHM);
  const dDiff = drawnDiffuseLux(sunAltRad);
  const out = {
    drawnBeamLux: dBeam,
    drawnDiffuseLux: dDiff,
    drawnGlobalLux: dBeam + dDiff,
    measGlobalLux: m.global,
    globalRatio: (dBeam + dDiff) / m.global
  };
  if (m.beam != null && m.beam > 0) out.beamRatio = dBeam / m.beam;
  if (m.diffuse != null && m.diffuse > 0) out.diffuseRatio = dDiff / m.diffuse;
  return out;
}
