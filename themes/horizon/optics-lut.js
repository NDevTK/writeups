/**
 * Atmospheric-optics radiance profiles - the single source shared by
 * the runtime (sky-objects-tsl.js) and the reference gate
 * (optics-reference.mjs). Computed in double precision; the pure
 * physics lives in the library modules and is composed here:
 *
 *  - 22-degree halo: refraction through the 60-degree prism of a
 *    randomly rotating hexagonal ice crystal. For uniform rotation
 *    the emergent-deviation density is the histogram of D(x) over
 *    entrance angle x, weighted by the projected aperture cos(x) and
 *    the two refraction Fresnel transmittances - the 1/sqrt(D - Dmin)
 *    caustic at minimum deviation IS the halo's sharp inner edge.
 *    Ice dispersion: Warren & Brandt (2008), the revised
 *    compilation's own rows at the theme's 680/550/440 nm
 *    (halos.js ICE_N: 1.3073/1.3110/1.3163) - minimum deviations
 *    21.63 / 21.86 / 22.34 degrees.
 *  - Rainbows: AIRY (1838) diffraction at the Descartes caustics
 *    (rainbow.js: the A&S-gated Airy function, the closed-form
 *    Descartes geometry on Daimon & Masumura water, the Fresnel
 *    path factors (1-rho)^2 rho^k) - primary and secondary in ONE
 *    profile, their ratio and Alexander's dark band emerging from
 *    the physics as before, PLUS the supernumerary fringes the old
 *    geometric histogram documented as out of scope. The drop
 *    radius comes from the caller (Marshall-Palmer on the measured
 *    rain via rainbow.js) and sets the fringe spacing
 *    (~(k a)^(-2/3)).
 *  - Sundogs: Bravais (1847) skew-ray parhelia (halos.js) - the
 *    dogs sit on the halo at the horizon, migrate outward with the
 *    source and die at the closed-form ~61-degree cutoff. The dome
 *    samples that library profile directly (buildDogLUT wraps it in
 *    the LUT format).
 *
 * All profiles are convolved with the sun's 0.267-degree-radius
 * disc carrying the same Hestroffer & Magnan limb darkening the dome
 * renders (alpha = 0.4064 / 0.5079 / 0.6406 per channel).
 */

import {ICE_N, parhelionProfile} from './halos.js';
import {
  airy,
  bowFresnel,
  descartes,
  mpDropRadiusMm,
  RGB_UM,
  waterIndex
} from './rainbow.js';

const N_ICE = ICE_N;
const N_WATER = RGB_UM.map(waterIndex);
const SUN_RADIUS = (0.267 * Math.PI) / 180;
const LIMB_ALPHA = [0.4064, 0.5079, 0.6406];

// Convolve a per-channel profile (uniform theta grid) with the
// limb-darkened sun disc: kernel K(dt) = integral over the disc
// chord at offset dt of mu^alpha, mu = sqrt(1 - (rho/R)^2).
function sunConvolve(profile, bins, dTheta) {
  const half = Math.ceil(SUN_RADIUS / dTheta);
  const out = new Float64Array(profile.length);
  for (let c = 0; c < 3; c++) {
    const kernel = [];
    let ksum = 0;
    for (let k = -half; k <= half; k++) {
      const dt = k * dTheta;
      const s = dt / SUN_RADIUS;
      if (Math.abs(s) >= 1) {
        kernel.push(0);
        continue;
      }
      // integrate mu^alpha across the chord (rho^2 = s^2 + t^2)
      const M = 24;
      let w = 0;
      const tMax = Math.sqrt(1 - s * s);
      for (let m = 0; m < M; m++) {
        const t = ((m + 0.5) / M) * tMax;
        const mu = Math.sqrt(Math.max(1 - s * s - t * t, 0));
        w += Math.pow(mu, LIMB_ALPHA[c]);
      }
      kernel.push((2 * w * tMax) / M);
    }
    for (const k of kernel) ksum += k;
    for (let i = 0; i < bins; i++) {
      let acc = 0;
      for (let k = -half; k <= half; k++) {
        const j = Math.min(Math.max(i + k, 0), bins - 1);
        acc += profile[j * 3 + c] * kernel[k + half];
      }
      out[i * 3 + c] = acc / ksum;
    }
  }
  return out;
}

// Polarisation-averaged Fresnel reflectance, incidence i, n1 -> n2.
function fresnelR(ci, n1, n2) {
  const si = Math.sqrt(Math.max(1 - ci * ci, 0));
  const st = (n1 / n2) * si;
  if (st >= 1) return 1; // total internal reflection
  const ct = Math.sqrt(1 - st * st);
  const rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct);
  const rp = (n1 * ct - n2 * ci) / (n1 * ct + n2 * ci);
  return 0.5 * (rs * rs + rp * rp);
}

/**
 * 22-degree halo profile over theta in [thMin, thMax] (radians from
 * the sun), per RGB channel, peak-normalised.
 */
export function buildHaloLUT(bins = 256) {
  const thMin = (15 * Math.PI) / 180;
  const thMax = (35 * Math.PI) / 180;
  const dTheta = (thMax - thMin) / bins;
  const prof = new Float64Array(bins * 3);
  const A = Math.PI / 3; // 60-degree prism
  const SAMPLES = 200000;
  for (let c = 0; c < 3; c++) {
    const n = N_ICE[c];
    for (let s = 0; s < SAMPLES; s++) {
      // entrance angle from grazing to normal; uniform x with
      // aperture weight cos(x) is the uniform-rotation measure.
      const x = ((s + 0.5) / SAMPLES) * (Math.PI / 2);
      const sr1 = Math.sin(x) / n;
      const r1 = Math.asin(sr1);
      const r2 = A - r1;
      const sx2 = n * Math.sin(r2);
      if (sx2 >= 1) continue; // internally reflected out of path
      const x2 = Math.asin(sx2);
      const D = x + x2 - A;
      const i = Math.floor((D - thMin) / dTheta);
      if (i < 0 || i >= bins) continue;
      const T1 = 1 - fresnelR(Math.cos(x), 1, n);
      const T2 = 1 - fresnelR(Math.cos(r2), n, 1);
      prof[i * 3 + c] += Math.cos(x) * T1 * T2;
    }
  }
  const conv = sunConvolve(prof, bins, dTheta);
  let peak = 0;
  for (const v of conv) peak = Math.max(peak, v);
  const out = new Float32Array(bins * 4);
  for (let i = 0; i < bins; i++) {
    out[i * 4] = conv[i * 3] / peak;
    out[i * 4 + 1] = conv[i * 3 + 1] / peak;
    out[i * 4 + 2] = conv[i * 3 + 2] / peak;
    out[i * 4 + 3] = 1;
  }
  return {data: out, bins, thMinDeg: 15, thMaxDeg: 35};
}

/**
 * Rainbow profile over theta in [35, 60] degrees from the ANTISOLAR
 * point, per RGB channel: Airy diffraction at the primary and
 * secondary Descartes caustics (rainbow.js primitives), accumulated
 * into ONE profile - their ratio and the dark band between them
 * come from the Fresnel path factors, and the supernumerary fringe
 * spacing from the drop radius (mm; the caller feeds Marshall-
 * Palmer on the measured rain). Normalised by the primary's peak.
 */
export function buildBowLUT(bins = 256, aMm = mpDropRadiusMm(1)) {
  const thMin = (35 * Math.PI) / 180;
  const thMax = (60 * Math.PI) / 180;
  const dTheta = (thMax - thMin) / bins;
  const prof = new Float64Array(bins * 3);
  const a = aMm * 1e-3; // metres
  for (let c = 0; c < 3; c++) {
    const n = N_WATER[c];
    const kw = (2 * Math.PI) / (RGB_UM[c] * 1e-6);
    for (let k = 1; k <= 2; k++) {
      const geo = descartes(n, k);
      const s13 = ((2 * kw * kw * a * a) / Math.abs(geo.dpp)) ** (1 / 3);
      const pre =
        ((bowFresnel(n, k) * geo.x0) / Math.sin(geo.gamma)) *
        a *
        a *
        (kw * a) ** (1 / 3);
      for (let i = 0; i < bins; i++) {
        const th = thMin + (i + 0.5) * dTheta;
        // primary brightens INSIDE the bow, secondary OUTSIDE -
        // Alexander's band between them falls out of the signs
        const dTh = k === 1 ? geo.gamma - th : th - geo.gamma;
        prof[i * 3 + c] += pre * airy(-s13 * dTh) ** 2;
      }
    }
  }
  const conv = sunConvolve(prof, bins, dTheta);
  // normalise by the PRIMARY peak (theta < 45 deg region)
  let peak = 0;
  for (let i = 0; i < bins; i++) {
    const th = 35 + (i + 0.5) * (25 / bins);
    if (th < 45)
      peak = Math.max(peak, conv[i * 3], conv[i * 3 + 1], conv[i * 3 + 2]);
  }
  const out = new Float32Array(bins * 4);
  for (let i = 0; i < bins; i++) {
    out[i * 4] = conv[i * 3] / peak;
    out[i * 4 + 1] = conv[i * 3 + 1] / peak;
    out[i * 4 + 2] = conv[i * 3 + 2] / peak;
    out[i * 4 + 3] = 1;
  }
  return {data: out, bins, thMinDeg: 35, thMaxDeg: 60};
}

/**
 * Sundog profile over AZIMUTH offset from the source in [18, 55]
 * degrees along its almucantar, at source elevation h (radians):
 * the Bravais parhelia of halos.js in the dome's LUT format,
 * limb-darkened-source convolved like the other profiles. Empty
 * past the ~61-degree cutoff (lut.any = false).
 */
export function buildDogLUT(h, bins = 256) {
  const pp = parhelionProfile(Math.max(h, 0), bins);
  const dAz = (pp.a1 - pp.a0) / bins;
  const prof = new Float64Array(bins * 3);
  for (let i = 0; i < bins; i++) {
    prof[3 * i] = pp.data[3 * i];
    prof[3 * i + 1] = pp.data[3 * i + 1];
    prof[3 * i + 2] = pp.data[3 * i + 2];
  }
  const conv = sunConvolve(prof, bins, dAz);
  let peak = 0;
  for (const v of conv) peak = Math.max(peak, v);
  const out = new Float32Array(bins * 4);
  for (let i = 0; i < bins; i++) {
    out[i * 4] = peak > 0 ? conv[i * 3] / peak : 0;
    out[i * 4 + 1] = peak > 0 ? conv[i * 3 + 1] / peak : 0;
    out[i * 4 + 2] = peak > 0 ? conv[i * 3 + 2] / peak : 0;
    out[i * 4 + 3] = 1;
  }
  return {
    data: out,
    bins,
    azMinDeg: (pp.a0 * 180) / Math.PI,
    azMaxDeg: (pp.a1 * 180) / Math.PI,
    any: pp.any
  };
}
