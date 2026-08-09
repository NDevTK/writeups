/**
 * looming.js - long-range looming: Lehn & Legal's Bathurst
 * mirage through the repo's own ray machinery. Pure functions,
 * mirrored by looming-reference.mjs.
 *
 * The primary, author-hosted OA and read in full: Lehn & Legal
 * 1998, "Long-range superior mirages" (Appl. Opt. 37, 1489).
 * Their Bathurst observation (3 June 1994, 19:36 CDT, Resolute
 * Bay): a 351 m peak at 105 km, invisible in ordinary air,
 * "suddenly appeared" as an image spanning -12.1 to -9.8 arc min
 * (theodolite), the top 37 m of the peak loomed into view at
 * 2.33x vertical magnification over Claxton Point (28.5 km, just
 * under the printed 50-ft = 15.2 m contour). Their printed
 * standard-air anchors: the -14.2' ray is tangent to the sea at
 * 32.4 km; Claxton's measured angles -12.6'/-12.1' translate to
 * 14 and 18 m. Their favored model 1: ordinary air to Claxton,
 * then a MILD low-level inversion centered on a 60 m elevation
 * spanning 32-68 km of the path ("the weakest inversion that
 * could create the mirage" - their own selection criterion),
 * standard air beyond ("produces the same rays", their print).
 *
 * The march is the mirage fan's flat-earth transform
 * (h'' = 1/R - kappa) with the column GATED IN x (the NZ pass's
 * ladder idea reduced to three fixed regions), over a ground
 * mask that carries the two printed obstacles. The inversion
 * column reuses the NZ pass's own Fermi form (nz.js Eq. B5 -
 * one inversion law for both hindcasts) at their printed
 * center height, with the strength dT LEFT FREE for the gate
 * to minimize exactly as the paper minimized it.
 */

import {kappaTable} from './far-terrain.js';

export const LOOM_R_EARTH = 6371000;
// The printed observation geometry.
export const LOOM_OBS_M = 67;
export const LOOM_PEAK_M = 351;
export const LOOM_PEAK_KM = 105;
export const LOOM_CLAXTON_KM = 28.5;
export const LOOM_CLAXTON_M = 15.2; // the printed 50-ft contour
export const LOOM_SHERINGHAM_KM = 16;
export const LOOM_SHERINGHAM_M = 10; // clears the -14.2' ray (their Fig. 8)
// Their model 1 inversion region and center.
export const LOOM_INV_X0_KM = 32;
export const LOOM_INV_X1_KM = 68;
export const LOOM_INV_CENTER_M = 60;
export const LOOM_INV_HALFW_M = 10; // Fermi a: ~90% of jump in 60 m
// The printed image record.
export const LOOM_TOP_ARCMIN = -9.8;
export const LOOM_BASE_ARCMIN = -12.1;
export const LOOM_CUT_ARCMIN = -12.6; // lowest ray over Claxton
export const LOOM_DEPTH_M = 37;
export const LOOM_MAG = 2.33;
export const LOOM_SURFACE_C = 2;
export const LOOM_SURFACE_HPA = 1010;

/**
 * The paper's own base column (their printed words: "a surface
 * temperature of 2 degC and a standard lapse rate of
 * 0.006 deg/m"), with an optional Fermi inversion of strength
 * dTK centered at their printed 60 m (the NZ pass's Eq. B5
 * form - one inversion law for both hindcasts; a = 10 m puts
 * ~90% of the jump within 60 m). Hydrostatic pressure on a 1 m
 * grid, dry air - the same construction nz.js gates.
 */
export function loomProfile(
  dTK = 0,
  hcM = LOOM_INV_CENTER_M,
  aM = LOOM_INV_HALFW_M
) {
  const surfK = 273.15 + LOOM_SURFACE_C;
  const a = aM;
  const hc = hcM;
  const tail = dTK > 0 ? dTK / (1 + Math.exp(hc / a)) : 0;
  const tAt = (h) =>
    surfK -
    0.006 * h -
    (dTK > 0 ? dTK - dTK / (1 + Math.exp(-(h - hc) / a)) - tail : 0);
  const p0 = LOOM_SURFACE_HPA * 100;
  const top = 4000;
  const B = 9.80665 / 287.058;
  const lnP = new Float64Array(top + 1);
  lnP[0] = Math.log(p0);
  let invPrev = 1 / tAt(0);
  for (let h = 1; h <= top; h++) {
    const inv = 1 / tAt(h);
    lnP[h] = lnP[h - 1] - B * 0.5 * (inv + invPrev);
    invPrev = inv;
  }
  return {
    h0: 0,
    at(h) {
      const tK = tAt(h);
      let pPa;
      if (h <= 0) pPa = p0;
      else if (h >= top)
        pPa = Math.exp(lnP[top]) * Math.exp((-B * (h - top)) / tK);
      else {
        const i = Math.floor(h);
        pPa = Math.exp(lnP[i] + (h - i) * (lnP[i + 1] - lnP[i]));
      }
      return {tC: tK - 273.15, pPa, rh: 0};
    }
  };
}

// The ground mask: open sea with the two printed points.
export function loomGroundM(xM) {
  const km = xM / 1000;
  if (Math.abs(km - LOOM_SHERINGHAM_KM) < 1) return LOOM_SHERINGHAM_M;
  if (Math.abs(km - LOOM_CLAXTON_KM) < 1.5) return LOOM_CLAXTON_M;
  return 0;
}

/**
 * March one ray (launch elevation alphaRad from the observer)
 * through the x-gated columns. Returns {hAt(x), groundKm} - the
 * height samples every dsM and where it struck ground (null if
 * it survived to xMaxM).
 */
export function loomMarch(
  alphaRad,
  dTK,
  {dsM = 50, xMaxM = LOOM_PEAK_KM * 1000, exitHm = 2000, mask = true} = {}
) {
  const ktStd =
    loomMarch._std || (loomMarch._std = kappaTable(loomProfile(0), exitHm, 2));
  let ktInv = null;
  if (dTK > 0) {
    const key = dTK.toFixed(3);
    loomMarch._inv = loomMarch._inv || new Map();
    ktInv = loomMarch._inv.get(key);
    if (!ktInv) {
      ktInv = kappaTable(loomProfile(dTK), exitHm, 2);
      loomMarch._inv.set(key, ktInv);
    }
  }
  const kAt = (kt, h) => {
    const i = Math.min(kt.n - 1, Math.max(0, Math.round((h - kt.h0) / kt.dhM)));
    return kt.kap[i];
  };
  const n = Math.ceil(xMaxM / dsM) + 1;
  const hs = new Float64Array(n);
  let h = LOOM_OBS_M;
  let slope = Math.tan(alphaRad);
  let groundKm = null;
  hs[0] = h;
  for (let i = 1; i < n; i++) {
    const x = i * dsM;
    const inInv =
      dTK > 0 && x >= LOOM_INV_X0_KM * 1000 && x < LOOM_INV_X1_KM * 1000;
    const kt = inInv ? ktInv : ktStd;
    slope += (1 / LOOM_R_EARTH - kAt(kt, Math.max(h, 0))) * dsM;
    h += slope * dsM;
    hs[i] = h;
    if (groundKm === null && h <= (mask ? loomGroundM(x) : 0)) {
      groundKm = x / 1000;
      break;
    }
  }
  return {
    hs,
    dsM,
    groundKm,
    hAt(xM) {
      const i = Math.min(n - 1, Math.max(0, Math.round(xM / dsM)));
      return hs[i];
    }
  };
}

/**
 * The image of the peak column at the printed distance: scan
 * launch elevations, keep rays that survive to the peak, and
 * map target height -> apparent elevation. Returns the visible
 * image {topArcmin, baseArcmin, depthM, mag, visible} - depthM
 * the span of peak heights reached, mag the ratio of apparent
 * to true angular span of that depth.
 */
export function loomImage(
  dTK,
  {aMinArcmin = -16, aMaxArcmin = -6, nA = 401} = {}
) {
  const xPeak = LOOM_PEAK_KM * 1000;
  const hits = [];
  for (let i = 0; i < nA; i++) {
    const aMin = (aMinArcmin / 60 / 180) * Math.PI;
    const aMax = (aMaxArcmin / 60 / 180) * Math.PI;
    const a = aMin + ((aMax - aMin) * i) / (nA - 1);
    const m = loomMarch(a, dTK);
    if (m.groundKm !== null) continue;
    const hT = m.hAt(xPeak);
    if (hT >= 0 && hT <= LOOM_PEAK_M) {
      hits.push({arcmin: (a * 180 * 60) / Math.PI, hM: hT});
    }
  }
  if (!hits.length)
    return {
      visible: false,
      topArcmin: NaN,
      baseArcmin: NaN,
      depthM: 0,
      mag: NaN
    };
  let top = -Infinity;
  let base = Infinity;
  let hLo = Infinity;
  let hHi = -Infinity;
  for (const h of hits) {
    top = Math.max(top, h.arcmin);
    base = Math.min(base, h.arcmin);
    hLo = Math.min(hLo, h.hM);
    hHi = Math.max(hHi, h.hM);
  }
  const trueSpanArcmin = (((hHi - hLo) / xPeak) * 180 * 60) / Math.PI;
  return {
    visible: true,
    topArcmin: top,
    baseArcmin: base,
    depthM: hHi - hLo,
    mag: trueSpanArcmin > 0 ? (top - base) / trueSpanArcmin : NaN
  };
}
