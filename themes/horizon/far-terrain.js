/**
 * far-terrain.js - the far horizon. The box ends at 8 km, the
 * real view does not: from Nelson the Arthur Range stands 40 km
 * across Tasman Bay, from Interlaken the Oberland walls the sky.
 * A silhouette ring from the SAME terrarium tiles at coarse zoom
 * carries the view from the box edge to the geometric horizon.
 *
 * The physics this module owns (pure, mirrored by
 * far-terrain-reference.mjs):
 *  - refractionK: the terrestrial refraction coefficient from the
 *    MEASURED surface state - Hirt, Guillaume, Wisbar, Buerki &
 *    Sternberg (2010, JGR 115, D21102): k = 503 P/T^2 (0.0343 +
 *    dT/dh), P in hPa, T in K, dT/dh in K/m. The textbook value
 *    EMERGES: the standard atmosphere (1013.25 hPa, 288.15 K,
 *    -0.0065 K/m) gives k = 0.1706, within 3% of the classic 1/6
 *    curvature rule - it is not assumed anywhere.
 *  - curvatureDrop: the apparent sinking of distant ground below
 *    the observer's horizontal, d^2 / (2 R_eff) with
 *    R_eff = R / (1 - k) (the standard geodetic effective-radius
 *    form; k > 0 means refraction bends rays around the curve and
 *    the drop shrinks).
 *  - farRingGeometry: a polar grid around the anchor -
 *    log-spaced radii from the box edge outward, uniform azimuth
 *    spokes - with real elevations sampled by the caller (the
 *    theme reuses demElev on a coarse-zoom mosaic, after the same
 *    despike), the curvature drop subtracted from each vertex's
 *    METRES before the box's own asinh datum compression, so the
 *    ring speaks the box's exact vertical language and meets it
 *    continuously at the seam (drop(0) = 0).
 */

export const R_EARTH = 6371000; // mean radius, metres

// Hirt et al. 2010 eq. for the refraction coefficient near the
// surface; the theme feeds the measured surface pressure,
// temperature and the measured lapse from its refraction column.
export function refractionK(pHpa, tK, lapseKperM) {
  return 503 * (pHpa / (tK * tK)) * (0.0343 + lapseKperM);
}

// Apparent drop (metres) of ground at distance dM under combined
// Earth curvature and refraction.
export function curvatureDrop(dM, k) {
  return (dM * dM) / (2 * (R_EARTH / (1 - k)));
}

/**
 * Ring vertex grid. radiiU ascending scene-unit radii (first at
 * the box edge), nAz azimuth spokes (angle 0 faces -z, increasing
 * clockwise from above - the box's compass). elevAt(x, z) returns
 * metres AMSL at scene coordinates (the caller closes over its
 * DEM and converters). Returns {positions, indices} for an
 * indexed triangle mesh; y carries the asinh datum compression of
 * (e - drop - centerElev).
 */
export function farRingGeometry({radiiU, nAz, mpu, centerElev, k, elevAt}) {
  const nR = radiiU.length;
  const positions = new Float32Array(nR * nAz * 3);
  const sea = new Uint8Array(nR * nAz);
  // Retained per vertex for the EXACT refraction remap (the
  // mirage path): the pre-drop true elevation and the scene-unit
  // distance - the caller can re-solve every vertex's apparent
  // altitude through the terrestrial ray fan (rayFan /
  // fanBranches below) without resampling the DEM.
  const trueEM = new Float32Array(nR * nAz);
  const distU = new Float32Array(nR * nAz);
  for (let ri = 0; ri < nR; ri++) {
    const r = radiiU[ri];
    for (let ai = 0; ai < nAz; ai++) {
      const az = (ai / nAz) * 2 * Math.PI;
      const x = Math.sin(az) * r;
      const z = -Math.cos(az) * r;
      const eRaw = elevAt(x, z);
      // Terrarium carries bathymetry below the waterline; a coast
      // meets the sea at the SURFACE, so sea vertices (which only
      // survive inside shoreline triangles) clamp to 0 m before
      // the drop - never to the seabed.
      const e =
        Math.max(eRaw, eRaw <= 0.3 ? 0 : eRaw) - curvatureDrop(r * mpu, k);
      const y = 16 * Math.asinh((e - centerElev) / 500);
      // The box's sea rule: at or below the waterline this is
      // open water - the ring does NOT draw it (the sky-view
      // LUT's Payne-lit sea horizon is already the correct far
      // sea; painting ring water over it would replace measured
      // radiometry with a mesh). Sea-only triangles are dropped
      // below; shoreline triangles keep their sea corners so
      // coasts meet the water without gaps.
      sea[ri * nAz + ai] = eRaw <= 0.3 ? 1 : 0;
      const o = (ri * nAz + ai) * 3;
      positions[o] = x;
      positions[o + 1] = y;
      positions[o + 2] = z;
      trueEM[ri * nAz + ai] = Math.max(eRaw, eRaw <= 0.3 ? 0 : eRaw);
      distU[ri * nAz + ai] = r;
    }
  }
  // Quad strips between consecutive rings, wrapping in azimuth;
  // triangles whose three corners are all sea are dropped.
  const idx = [];
  for (let ri = 0; ri + 1 < nR; ri++) {
    for (let ai = 0; ai < nAz; ai++) {
      const a = ri * nAz + ai;
      const b = ri * nAz + ((ai + 1) % nAz);
      const c = (ri + 1) * nAz + ai;
      const d = (ri + 1) * nAz + ((ai + 1) % nAz);
      if (!(sea[a] && sea[c] && sea[b])) idx.push(a, c, b);
      if (!(sea[b] && sea[c] && sea[d])) idx.push(b, c, d);
    }
  }
  return {
    positions,
    indices: new Uint32Array(idx),
    sea,
    nR,
    nAz,
    trueEM,
    distU
  };
}

/**
 * The EXACT far-strip vertical remap - the mirage path. Given a
 * transfer curve's rows (aApp ascending, tTrue = the true
 * altitude each apparent direction sees; refraction.js
 * transferCurve's own output) and one vertex's true angular
 * altitude, return the PRIMARY apparent altitude: the lowest
 * crossing of tTrue(aApp) = aTrue, linearly interpolated between
 * rows. Physics, not display: where the curve folds (a measured
 * duct), higher crossings are additional images - branchCount
 * reports how many, and the primary branch alone already carries
 * the four classical continuous mirage classes (looming,
 * towering, sinking, stooping) because d(apparent)/d(true) is
 * the curve's own slope. Outside the table's true-altitude span
 * the caller keeps its mean-k fallback - stated, never
 * extrapolated.
 */
export function apparentPrimary(aApp, tTrue, aTrue) {
  for (let i = 1; i < aApp.length; i++) {
    const t0 = tTrue[i - 1];
    const t1 = tTrue[i];
    if ((t0 - aTrue) * (t1 - aTrue) <= 0 && t0 !== t1) {
      const f = (aTrue - t0) / (t1 - t0);
      return aApp[i - 1] + f * (aApp[i] - aApp[i - 1]);
    }
  }
  return null;
}

export function branchCount(aApp, tTrue, aTrue) {
  let n = 0;
  for (let i = 1; i < aApp.length; i++) {
    const t0 = tTrue[i - 1];
    const t1 = tTrue[i];
    if ((t0 - aTrue) * (t1 - aTrue) <= 0 && t0 !== t1) n++;
  }
  return n;
}

// ---- The TERRESTRIAL ray fan: the mirage machinery ------------
// The astronomical transfer curve integrates bending to the top
// of the atmosphere and is the WRONG instrument for a target
// 30 km away (measured here before shipping: it mis-lifted a
// sea-level target by +184 m where -59 m belongs). Terrestrial
// rays need the classical flat-earth construction (Wegener's):
// in the flattened frame a ray's height obeys
//   d2h/dx2 = kappa(h) - 1/R,
// kappa = -dn/dh the local ray curvature from the SAME Ciddor
// refractivity the sunset rides. Everything falls out of it:
//  - at the standard lapse, kappa ~ k/R and the ray parabola
//    reproduces the Hirt-k curvatureDrop (gate-held: the mean-k
//    model EMERGES as the uniform-kappa limit);
//  - a measured inversion with kappa > 1/R is a DUCT - the
//    classical super-refraction criterion (dN/dh < -157 N/km)
//    derived, not quoted: kappa = 1/R IS that threshold;
//  - where the fan folds, one target shows several images - the
//    superior mirage's classical stack.
import {ciddorN} from './refraction.js';

// kappa(h) table from a refraction profile (refraction.js
// buildProfile): centred difference of Ciddor n at the green
// channel over dh, from the profile's own measured rows.
export function kappaTable(profile, hMaxM = 3000, dhM = 2) {
  const n = Math.ceil(hMaxM / dhM) + 1;
  const kap = new Float32Array(n);
  const h0 = profile.h0;
  const nAt = (h) => {
    const s = profile.at(h);
    return ciddorN(0.55, s.tC, s.pPa, s.rh ?? 0);
  };
  for (let i = 0; i < n; i++) {
    const h = h0 + i * dhM;
    kap[i] = -(nAt(h + dhM) - nAt(h - dhM < h0 ? h0 : h - dhM)) / (2 * dhM);
  }
  return {kap, h0, dhM, n};
}

/**
 * March a fan of rays from the observer at obsHm through the
 * kappa table out to dMaxM. alphas: launch elevations (radians,
 * ascending). Returns {alphas, hs}: hs[i][j] = ray i's height
 * (m AMSL) at x = (j+1) dsM. Rays that strike the ground (h
 * below the profile floor) carry NaN beyond the strike - a
 * terrain-hidden direction, exactly what the z-buffer needs.
 */
export function rayFan(profile, obsHm, alphas, dMaxM = 200e3, dsM = 100) {
  const kt = kappaTable(profile);
  const kAt = (h) => {
    const i = Math.min(kt.n - 1, Math.max(0, Math.round((h - kt.h0) / kt.dhM)));
    return kt.kap[i];
  };
  const nS = Math.ceil(dMaxM / dsM);
  const hs = alphas.map(() => new Float32Array(nS));
  for (let i = 0; i < alphas.length; i++) {
    let h = obsHm;
    let slope = Math.tan(alphas[i]);
    let dead = false;
    for (let j = 0; j < nS; j++) {
      // Flat-earth transform: the sphere falls away under a
      // straight ray (+1/R), refraction curves it back down
      // (-kappa) - h'' = 1/R - kappa(h). Standard air gives the
      // (1-k)/R effective curvature; kappa > 1/R flips the sign:
      // the duct.
      const acc = 1 / R_EARTH - kAt(h);
      slope += acc * dsM;
      h += slope * dsM;
      if (dead || h < kt.h0 - 1) {
        dead = true;
        hs[i][j] = NaN;
      } else {
        hs[i][j] = h;
      }
    }
  }
  return {alphas, hs, dsM};
}

/**
 * All apparent-elevation branches that see a target at distance
 * dM, height eM, through a rayFan: scan ray pairs bracketing eM
 * at the target column and interpolate the launch angle. Rays
 * already dead (ground-struck) before the column cannot see it.
 * Returns ascending apparent elevations (radians), possibly
 * empty (hidden), length > 1 under a duct - the image stack.
 */
export function fanBranches(fan, dM, eM) {
  const j = Math.min(
    fan.hs[0].length - 1,
    Math.max(0, Math.round(dM / fan.dsM) - 1)
  );
  const out = [];
  for (let i = 1; i < fan.alphas.length; i++) {
    const a = fan.hs[i - 1][j];
    const b = fan.hs[i][j];
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if ((a - eM) * (b - eM) <= 0 && a !== b) {
      const f = (eM - a) / (b - a);
      out.push(fan.alphas[i - 1] + f * (fan.alphas[i] - fan.alphas[i - 1]));
    }
  }
  return out;
}

// Log-spaced radii from the box edge to the far limit: constant
// angular step density toward the horizon, dense where parallax
// still matters.
export function farRadii(r0 = 150, r1 = 3500, n = 44) {
  const out = new Float64Array(n);
  const g = Math.log(r1 / r0) / (n - 1);
  for (let i = 0; i < n; i++) out[i] = r0 * Math.exp(g * i);
  return out;
}

// Transmittance toward the horizon sky at the MEASURED
// meteorological visibility V - the SAME curve the box fog uses
// (aerial-tsl: exp(-(1.98 d / V)^2), FogExp2 calibrated so
// T(V) = e^-3.9204 = 2%, Koschmieder's contrast threshold at
// exactly V). Matching the box's curve keeps the seam from
// stepping; the 2% calibration point is held as a landmark.
export function koschmiederT(dM, visM) {
  const s = (1.98 * dM) / Math.max(visM, 1);
  return Math.exp(-s * s);
}
