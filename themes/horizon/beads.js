/**
 * beads.js - Baily's beads and the graze: the 2017 August 21
 * eclipse marched along the REAL lunar limb. Pure functions,
 * mirrored by beads-reference.mjs; both vendored legs (the
 * primary's printed computational model and the LOLA-derived
 * limb ring) live in beads-data.js with their provenance.
 *
 * The construction is the paper's own (Quaglia et al. 2021,
 * read in full): at time t the solar limb's apparent height
 * over the lunar datum along position angle psi is
 *   h_sun(psi, t) = c(t) . d(psi) + sqrt(Sigma(t)^2 - c_perp^2)
 *                   - S_moon(t),
 * the radial extent of the solar disc from the Moon's centre
 * minus the datum semidiameter - exactly what their Figures 6-8
 * plot against the limb profile. Photosphere shows at psi when
 * h_sun exceeds the measured limb height; totality (complete
 * photospheric extinction) is the interval where NO psi is
 * exposed; each maximal exposed arc is a Baily's bead. The
 * position-angle convention is pinned by the frame itself:
 * psi = atan2(-x, y) reproduces their printed C2/C3 valleys
 * (the Table 2 frame has y toward the projected lunar north
 * pole).
 */

import {
  LDF_ALPHA_A,
  LDF_ALPHA_B,
  LIMB_RING_ARCSEC,
  LIMB_RING_STEP_DEG,
  MOON_SEMIDIAM_POLY,
  SUN_POLY_BASIS_ARCSEC,
  SUN_SEMIDIAM_POLY,
  SUN_X_POLY,
  SUN_Y_POLY
} from './beads-data.js';

export function poly3(c, t) {
  return c[0] + t * (c[1] + t * (c[2] + t * c[3]));
}

/** Limb height (arcsec over datum) at psi (deg), ring lerp. */
export function limbHeight(psiDeg) {
  const n = LIMB_RING_ARCSEC.length;
  const x = (((psiDeg % 360) + 360) % 360) / LIMB_RING_STEP_DEG;
  const i = Math.floor(x);
  const f = x - i;
  return LIMB_RING_ARCSEC[i % n] * (1 - f) + LIMB_RING_ARCSEC[(i + 1) % n] * f;
}

/**
 * Solar limb height over the lunar datum along psi at t (minutes
 * from T0) for eclipse solar radius sArcsec; -Infinity where the
 * ray misses the solar disc entirely.
 */
export function sunLimbHeight(psiDeg, tMin, sArcsec) {
  const sig =
    poly3(SUN_SEMIDIAM_POLY, tMin) * (sArcsec / SUN_POLY_BASIS_ARCSEC);
  const sm = poly3(MOON_SEMIDIAM_POLY, tMin);
  const X = poly3(SUN_X_POLY, tMin);
  const Y = poly3(SUN_Y_POLY, tMin);
  const p = (psiDeg * Math.PI) / 180;
  const cd = -X * Math.sin(p) + Y * Math.cos(p);
  const perp2 = X * X + Y * Y - cd * cd;
  if (sig * sig < perp2) return -Infinity;
  return cd + Math.sqrt(sig * sig - perp2) - sm;
}

/**
 * The exposed photosphere at time t: bead arcs (maximal runs of
 * exposed psi) with their peak height over the limb, plus the
 * global maximum. minPeakArcsec filters glints below a
 * visibility floor when COUNTING beads (0 = geometric).
 */
export function exposedState(tMin, sArcsec, minPeakArcsec = 0) {
  const n = LIMB_RING_ARCSEC.length;
  const step = LIMB_RING_STEP_DEG;
  const over = new Float64Array(n);
  let maxOver = -Infinity;
  let maxPsi = NaN;
  for (let i = 0; i < n; i++) {
    const psi = i * step;
    const o = sunLimbHeight(psi, tMin, sArcsec) - LIMB_RING_ARCSEC[i];
    over[i] = o;
    if (o > maxOver) {
      maxOver = o;
      maxPsi = psi;
    }
  }
  const arcs = [];
  let cur = null;
  for (let i = 0; i <= n; i++) {
    const o = over[i % n];
    if (o > 0) {
      if (!cur) cur = {startDeg: (i % n) * step, peak: o};
      else if (o > cur.peak) cur.peak = o;
    } else if (cur) {
      cur.endDeg = ((((i - 1) % n) + n) % n) * step;
      arcs.push(cur);
      cur = null;
    }
    if (i === n && cur) {
      // exposed across the wrap: merge with the first arc
      if (arcs.length && arcs[0].startDeg === 0) {
        arcs[0].startDeg = cur.startDeg;
        arcs[0].peak = Math.max(arcs[0].peak, cur.peak);
      } else {
        cur.endDeg = (n - 1) * step;
        arcs.push(cur);
      }
    }
  }
  const beads = arcs.filter((a) => a.peak >= minPeakArcsec);
  return {maxOver, maxPsi, arcs, beads, beadCount: beads.length};
}

/** Their Eq. (6) exponent alpha at wavelength lambda (um). */
export function ldfAlpha(lambdaUm) {
  return LDF_ALPHA_A + LDF_ALPHA_B / lambdaUm;
}

/**
 * The exposed photosphere's ILLUMINANCE as a fraction of the
 * whole disc, LDF-weighted - their Eq. (7) integral over the
 * region above the lunar limb, against the closed-form full-disc
 * integral 2 pi Sigma^2 / (alpha + 2). Small angles throughout
 * (sin phi / sin Sigma -> phi / Sigma at 0.005 rad discs).
 */
export function exposedIllumFraction(tMin, sArcsec, lambdaUm = 0.55) {
  const alpha = ldfAlpha(lambdaUm);
  const sig =
    poly3(SUN_SEMIDIAM_POLY, tMin) * (sArcsec / SUN_POLY_BASIS_ARCSEC);
  const sm = poly3(MOON_SEMIDIAM_POLY, tMin);
  const X = poly3(SUN_X_POLY, tMin);
  const Y = poly3(SUN_Y_POLY, tMin);
  const n = LIMB_RING_ARCSEC.length;
  const dPsi = (LIMB_RING_STEP_DEG * Math.PI) / 180;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const p = (i * LIMB_RING_STEP_DEG * Math.PI) / 180;
    const sp = Math.sin(p);
    const cp = Math.cos(p);
    const cd = -X * sp + Y * cp;
    const perp2 = X * X + Y * Y - cd * cd;
    const q2 = sig * sig - perp2;
    if (q2 <= 0) continue;
    const q = Math.sqrt(q2);
    const rLo = Math.max(sm + LIMB_RING_ARCSEC[i], cd - q);
    const rHi = cd + q;
    if (rHi <= rLo) continue;
    const steps = Math.max(8, Math.ceil((rHi - rLo) / 0.02));
    const dr = (rHi - rLo) / steps;
    for (let k = 0; k < steps; k++) {
      const rho = rLo + (k + 0.5) * dr;
      const px = -rho * sp - X;
      const py = rho * cp - Y;
      const phi = Math.hypot(px, py);
      const x2 = Math.min(1, (phi * phi) / (sig * sig));
      sum += Math.pow(1 - x2, alpha / 2) * rho * dr * dPsi;
    }
  }
  const disc = (2 * Math.PI * sig * sig) / (alpha + 2);
  return sum / disc;
}

/**
 * March the graze: totality (complete photospheric extinction)
 * interval and contact position angles for eclipse solar radius
 * sArcsec. Times in seconds from T0; dtS the march step.
 */
export function grazeMarch(sArcsec, {spanS = 60, dtS = 0.05} = {}) {
  let c2S = null;
  let c3S = null;
  let wasTotal = false;
  for (let ts = -spanS; ts <= spanS; ts += dtS) {
    const total = exposedState(ts / 60, sArcsec).maxOver <= 0;
    if (total && !wasTotal && c2S === null) c2S = ts;
    if (!total && wasTotal && c3S === null) c3S = ts;
    wasTotal = total;
  }
  if (c2S === null || c3S === null)
    return {c2S: null, c3S: null, durationS: 0, c2PaDeg: NaN, c3PaDeg: NaN};
  const c2PaDeg = exposedState((c2S - dtS) / 60, sArcsec).maxPsi;
  const c3PaDeg = exposedState((c3S + dtS) / 60, sArcsec).maxPsi;
  return {c2S, c3S, durationS: c3S - c2S, c2PaDeg, c3PaDeg};
}
