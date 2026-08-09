/**
 * nz.js - the Novaya Zemlya effect: de Veer's 1597 sun through
 * the repo's own refraction machinery. Pure functions, mirrored
 * by nz-reference.mjs.
 *
 * The primary, author-hosted OA and read in full: van der Werf,
 * Konnen, Lehn, Steenhuisen & Davidson 2003, "Gerrit de Veer's
 * true and perfect description of the Novaya Zemlya effect,
 * 24-27 January 1597" (Appl. Opt. 42, 379). The documented
 * observations (their Sec. 1A, all printed):
 *  - 24 Jan 1597: a glimpse of the sun while its centre was
 *    geometrically 5 deg 26' below the horizon;
 *  - 27 Jan 1597: the sun "in its full roundness, [its lower
 *    limb] just free of the horizon" at 4 deg 41' below;
 *  - corroborations: Nansen 1894 (-2 deg 22'), Shackleton 1915
 *    (-2 deg 37'), Liljequist 1951 (-4 deg 18').
 * Their model (Sec. 2B + Appendix B, all printed): eye 14 m over
 * the frozen Kara Sea; Eq. (B5), a Fermi-step inversion on the
 * -6.5 K/km background,
 *   T(h) = Tciso - 0.0065 (h - hciso) - dT
 *          + dT / (1 + exp(-(h - hciso)/a)),
 * with Tciso = 250 K at hciso = 80 m, dT = 12 K, a = 5 m
 * ("90% of the jump takes place within a width ~ 6a" - the
 * form's own property, gate-held), sea-level pressure 1040 hPa;
 * a is "fixed at 5 m from the observer's position till
 * x = 200 km and is then allowed to increase gradually" - their
 * OWN stated requirement, because "if an inversion extends over
 * an indefinite horizontal distance without any change in its
 * parameters, it cannot duct light that enters from above" (the
 * gate proves that sentence with the same march). Their
 * refractive index (Eq. B4) uses the hydrostatic exponent
 * B = 3.4177e-2 K/m - the repo's own g/Rd reproduces it to
 * 0.02% (landmark), and the march runs the repo's gated Ciddor
 * kappa chain at its 0.55 um channel (theirs is 580 nm - a
 * stated ~0.15% refractivity difference).
 *
 * The march is the mirage fan's own flat-earth transform
 * (h'' = 1/R - kappa) with two extensions the geometry needs:
 * the duct RELEASES gradually beyond x = 200 km (their stated
 * requirement - see nzDtAtX for what the machinery taught about
 * their two release laws), and a ray that climbs out of the
 * weather (30 km) is assigned its celestial altitude
 * ALT = slope - x/R (vacuum identity: a ray launched at slope s
 * through empty space keeps ALT = s; the residual bending above
 * 30 km is under 2 arcsec, stated). Rays that strike the ice
 * are ground; rays still airborne at the cap are TRAPPED - the
 * dark band de Veer took for haze.
 */

import {kappaTable} from './far-terrain.js';
import {G_M_S2, RD_J_KGK} from './sounding.js';

export const R_EARTH = 6371000;
// Eq. (B5)'s printed 1597 parameters.
export const NZ_TCISO_K = 250;
export const NZ_HCISO_M = 80;
export const NZ_DT_K = 12;
export const NZ_A_M = 5;
export const NZ_P0_HPA = 1040;
export const NZ_EYE_M = 14;
export const NZ_X_SWITCH_M = 200e3;
// The hydrostatic exponent from the repo's own gated constants;
// van der Werf prints B = 3.4177e-2 K/m (Eq. B4).
export const B_HYDRO = G_M_S2 / RD_J_KGK;

// Eq. (B5), verbatim.
export function nzTempK(
  hM,
  {tCisoK = NZ_TCISO_K, hCisoM = NZ_HCISO_M, dTK = NZ_DT_K, aM = NZ_A_M} = {}
) {
  return (
    tCisoK -
    0.0065 * (hM - hCisoM) -
    dTK +
    dTK / (1 + Math.exp(-(hM - hCisoM) / aM))
  );
}

/**
 * The 1597 column as a profile object ({h0, at}) the repo's
 * kappa chain consumes: Eq. (B5) temperature (closed form) and
 * hydrostatic pressure P(h) = P0 exp(-B int dh'/T) integrated on
 * a 1 m grid to 35 km (trapezoid; above the grid the local
 * exponential continues). Dry air (rh 0) - their Eq. (B4) is a
 * dry-air refractivity, stated.
 */
export function buildNzProfile(opts = {}) {
  const p0 = (opts.p0HPa ?? NZ_P0_HPA) * 100;
  const top = 35000;
  const lnP = new Float64Array(top + 1);
  lnP[0] = Math.log(p0);
  let invPrev = 1 / nzTempK(0, opts);
  for (let h = 1; h <= top; h++) {
    const inv = 1 / nzTempK(h, opts);
    lnP[h] = lnP[h - 1] - B_HYDRO * 0.5 * (inv + invPrev);
    invPrev = inv;
  }
  return {
    h0: 0,
    at(h) {
      const tK = nzTempK(h, opts);
      let pPa;
      if (h <= 0) pPa = p0;
      else if (h >= top) {
        pPa = Math.exp(lnP[top]) * Math.exp((-B_HYDRO * (h - top)) / tK);
      } else {
        const i = Math.floor(h);
        pPa = Math.exp(lnP[i] + (h - i) * (lnP[i + 1] - lnP[i]));
      }
      return {tC: tK - 273.15, pPa, rh: 0};
    }
  };
}

export const NZ_SPACE = 0;
export const NZ_GROUND = 1;
export const NZ_TRAPPED = 2;

// Their duct release. The paper states two equivalent ways to
// let back-traced rays escape ("allowing the temperature jump,
// dT, to decrease gradually with x, or by letting the width
// parameter, a, increase... both methods are nearly
// equivalent") and quantifies neither law. The machinery here
// found them NOT equivalent for forward rays from an eye under
// the duct, and the reason is classical mechanics: widening a at
// fixed dT keeps the well's ACTION capacity growing (depth falls
// but width grows faster), so adiabatic invariance holds every
// trapped ray until the duct dies as a whole - an all-at-once
// collapse and a narrow deep band. Shrinking dT at fixed a
// shrinks the capacity monotonically, releasing rays
// progressively by their action - the continuous transformation
// curve of their Fig. 3B. The theme ships the dT release (their
// own first-stated method), exponential with scale L - a stated
// reading, run-then-pinned; the duct dies entirely once the
// Fermi peak gradient dT/(4a) falls under the mirage pass's own
// kappa = 1/R criterion (dT ~ 2.3 K), which bounds the deepest
// reachable depression with no tuning.
export function nzDtAtX(
  x,
  dTK = NZ_DT_K,
  xSwitchM = NZ_X_SWITCH_M,
  lM = 400e3
) {
  return x <= xSwitchM ? dTK : dTK * Math.exp(-(x - xSwitchM) / lM);
}

/**
 * The gradual-release duct march: apparent altitudes (alphas,
 * rad) from the eye, h'' = 1/R - kappa(h, x) with the kappa of
 * the LOCAL jump dT(x) (a geometric ladder of pre-built kappa
 * tables, nearest entry - stated discretisation), until the ray
 * exits the weather (exitHm), hits the ice, or runs out the cap
 * (TRAPPED - the dark band). Returns per ray the celestial ALT
 * (rad, NaN unless SPACE; the vacuum identity ALT = slope - x/R)
 * and a status code.
 */
export function nzTransfer({
  obsHm = NZ_EYE_M,
  alphas,
  dtOfX = nzDtAtX,
  dtMinK = 1.5,
  xCapM = 1500e3,
  dsM = 25,
  exitHm = 30e3,
  ladderStep = Math.pow(2, 1 / 16),
  rePickM = 1e3,
  profOpts = {}
}) {
  // The jump ladder: geometric steps from the full dT down to
  // the died-out duct, one kappa table each (the stated
  // discretisation of their gradual release).
  const ladder = [];
  for (let dt = dtOfX(0); dt >= dtMinK / ladderStep; dt /= ladderStep) {
    ladder.push({
      dtK: dt,
      kt: kappaTable(buildNzProfile({...profOpts, dTK: dt}), exitHm + 2000, 2)
    });
  }
  const ktFor = (dt) => {
    let best = ladder[0];
    for (const e of ladder)
      if (Math.abs(Math.log(e.dtK / dt)) < Math.abs(Math.log(best.dtK / dt)))
        best = e;
    return best.kt;
  };
  const kAt = (kt, h) => {
    const i = Math.min(kt.n - 1, Math.max(0, Math.round((h - kt.h0) / kt.dhM)));
    return kt.kap[i];
  };
  const alt = new Float64Array(alphas.length).fill(NaN);
  const status = new Uint8Array(alphas.length).fill(NZ_TRAPPED);
  for (let i = 0; i < alphas.length; i++) {
    let h = obsHm;
    let slope = Math.tan(alphas[i]);
    let x = 0;
    let kt = ktFor(dtOfX(0));
    let nextPick = 0;
    while (x < xCapM) {
      if (x >= nextPick) {
        kt = ktFor(dtOfX(x));
        nextPick = x + rePickM;
      }
      slope += (1 / R_EARTH - kAt(kt, h)) * dsM;
      h += slope * dsM;
      x += dsM;
      if (h <= 0) {
        status[i] = NZ_GROUND;
        break;
      }
      if (h >= exitHm) {
        status[i] = NZ_SPACE;
        alt[i] = Math.atan(slope) - x / R_EARTH;
        break;
      }
    }
  }
  return {alphas, alt, status};
}

/**
 * Is a celestial altitude (rad) reachable through a transfer?
 * The fanBranches idiom on the transformation curve: adjacent
 * SPACE rays bracketing the target imply coverage by the
 * intermediate-value theorem - the ODE flow is continuous in
 * the launch angle, so even an arcsecond-steep segment attains
 * every value it spans (the march's only true discontinuities
 * are the ladder re-picks, bounded by rePickM/R ~ 0.01 deg).
 * The optional maxGapRad guard remains for callers who want to
 * exclude steep segments anyway.
 */
export function nzReaches(tr, altRad, maxGapRad = Infinity) {
  for (let i = 1; i < tr.alphas.length; i++) {
    if (tr.status[i] !== NZ_SPACE || tr.status[i - 1] !== NZ_SPACE) continue;
    const a = tr.alt[i - 1];
    const b = tr.alt[i];
    if (Math.abs(b - a) > maxGapRad) continue;
    if ((a - altRad) * (b - altRad) <= 0) return true;
  }
  return false;
}
