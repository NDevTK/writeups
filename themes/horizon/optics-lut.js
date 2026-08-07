/**
 * Atmospheric-optics radiance profiles - the single source shared by
 * the runtime (sky-objects-tsl.js) and the reference gate
 * (optics-reference.mjs). Computed in double precision; the pure
 * physics lives in the library modules and is composed here:
 *
 *  - Halos: GREENLER'S MONTE CARLO (halos.js mcHalo) - hexagonal
 *    ice prisms at uniform random orientation (Shoemake
 *    quaternions), flux-correct face entry, the actual crystal
 *    geometry, Snell + Fresnel per interface. The 22-degree halo
 *    (side-side, 60-deg wedge) and the 46-degree halo
 *    (side-basal, 90-deg wedge) both EMERGE from one tracer,
 *    with their relative strength (~0.2) set by orientation
 *    statistics and Fresnel - the number a throughput-only model
 *    got wrong (0.86) and this composition's gate now pins.
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
 * All profiles are convolved EXACTLY ONCE with the source disc at
 * its TRUE angular radius (IAU photospheric radius over the true
 * distance, eclipses.js - the callers pass the live value; 959.6
 * arcsec at 1 au stands in offline), carrying the same Hestroffer &
 * Magnan limb darkening the dome renders (alpha = 0.4064 / 0.5079 /
 * 0.6406 per channel). The dog profile arrives RAW from halos.js
 * (causticBin - no internal smear), so this convolution is the only
 * one; paraselenae pass the MOON's own disc radius instead.
 */

import {ICE_N, mcHalo, parhelionProfile} from './halos.js';
import {sunAngularRadiusRad} from './eclipses.js';
import {
  airy,
  bowWindowEnergy,
  descartes,
  mpDropRadiusMm,
  RGB_UM,
  waterIndex
} from './rainbow.js';

const N_ICE = ICE_N;
const N_WATER = RGB_UM.map(waterIndex);
const SUN_RADIUS = sunAngularRadiusRad(); // IAU disc at 1 au (default)
const LIMB_ALPHA = [0.4064, 0.5079, 0.6406];

// Convolve a per-channel profile (uniform theta grid) with the
// limb-darkened sun disc: kernel K(dt) = integral over the disc
// chord at offset dt of mu^alpha, mu = sqrt(1 - (rho/R)^2).
// Exported: cloud-corona.js rides the same certified convolution.
// limbAlpha overrides the per-channel exponents - [0, 0, 0] is a
// FLAT disc (mu^0 = 1), the moon's own full-disc profile (the
// Hapke rendering's flat disc at full phase).
export function sunConvolve(
  profile,
  bins,
  dTheta,
  srcR = SUN_RADIUS,
  limbAlpha = LIMB_ALPHA
) {
  const half = Math.ceil(srcR / dTheta);
  const out = new Float64Array(profile.length);
  for (let c = 0; c < 3; c++) {
    const kernel = [];
    let ksum = 0;
    for (let k = -half; k <= half; k++) {
      const dt = k * dTheta;
      const s = dt / srcR;
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
        w += Math.pow(mu, limbAlpha[c]);
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
 * Halo profile over theta in [15, 52] degrees from the sun, per
 * RGB channel: Greenler's crystal Monte Carlo (halos.js mcHalo -
 * deterministic seed, so this LUT is reproducible), limb-darkened
 * sun convolution. The 22 and the 46 both live here at their
 * EMERGENT relative strengths - and, since the MC's rejection
 * sampling is flux weighting, at their ABSOLUTE level: each bin
 * is converted to the phase function of the traced channels,
 *   P(theta_b) = (T_b / accepted) / (2 pi sin(theta_b) dTheta),
 * in sr^-1 per unit geometric-interaction optical depth. The
 * drawn ring is then L = E_src (tau/2) e^-tau SCF P(theta) - the
 * corona's own slab radiometry with the measured smooth-crystal
 * fraction - and the display gain retires. peakAbs (green
 * channel) is returned for consumers holding calibrated ratios
 * against the ring (the sundogs), share22/share46 for the gate.
 */
export function buildHaloLUT(samples = 400000, srcR = SUN_RADIUS) {
  const mc = mcHalo(ICE_N, samples, 1337);
  const dTheta = (mc.g1 - mc.g0) / mc.bins;
  // Absolute conversion BEFORE the convolution (the kernel is
  // normalised, so convolving the sr^-1 curve stays sr^-1).
  const abs = new Float64Array(mc.bins * 3);
  for (let i = 0; i < mc.bins; i++) {
    const th = mc.g0 + (i + 0.5) * dTheta;
    const dOm = 2 * Math.PI * Math.sin(th) * dTheta;
    for (let c = 0; c < 3; c++)
      abs[i * 3 + c] = mc.data[i * 3 + c] / mc.accepted[c] / dOm;
  }
  const conv = sunConvolve(abs, mc.bins, dTheta, srcR);
  let peakAbs = 0;
  const out = new Float32Array(mc.bins * 4);
  for (let i = 0; i < mc.bins; i++) {
    out[i * 4] = conv[i * 3];
    out[i * 4 + 1] = conv[i * 3 + 1];
    out[i * 4 + 2] = conv[i * 3 + 2];
    out[i * 4 + 3] = 1;
    peakAbs = Math.max(peakAbs, conv[i * 3 + 1]);
  }
  // Windowed shares of the geometric-interaction unit (green):
  // the 22-degree ring [20, 26] and the 46-degree ring [43, 52].
  const share = (lo, hi) => {
    let s = 0;
    for (let i = 0; i < mc.bins; i++) {
      const th = (mc.g0 + (i + 0.5) * dTheta) * (180 / Math.PI);
      if (th >= lo && th < hi) s += mc.data[i * 3 + 1];
    }
    return s / mc.accepted[1];
  };
  return {
    data: out,
    bins: mc.bins,
    thMinDeg: 15,
    thMaxDeg: 52,
    peakAbs,
    share22: share(20, 26),
    share46: share(43, 52),
    accounting: {
      accepted: mc.accepted,
      binnedT: mc.binnedT,
      lowT: mc.lowT,
      highT: mc.highT,
      lostT: mc.lostT
    }
  };
}

/**
 * Rainbow profile over theta in [35, 60] degrees from the ANTISOLAR
 * point, per RGB channel: Airy diffraction at the primary and
 * secondary Descartes caustics (rainbow.js primitives), accumulated
 * into ONE profile - their ratio and the dark band between them
 * come from the physics, and the supernumerary fringe spacing from
 * the drop radius (mm; the caller feeds Marshall-Palmer on the
 * measured rain).
 *
 * ABSOLUTE since the rain-shaft radiometry pass: sr^-1 per unit
 * GEOMETRIC-INTERACTION DEPTH - the halo LUT's own frame. The
 * scale is pinned by energy conservation, not by a prefactor from
 * a book: each k-bow's Airy curve is normalised so its window
 * integral carries exactly the energy the DESCARTES/FRESNEL ray
 * mapping puts there (rainbow.js bowGeometric - flux through the
 * impact annulus, Fresnel-chained, spread over the deviation
 * annulus; size-independent once per unit geometric depth, so one
 * normalisation serves the whole Marshall-Palmer ensemble). Airy
 * theory then does what it is for: redistribute that energy into
 * the caustic's fringes. The gate holds the window identity, the
 * fringe-averaged asymptotic match to the geometric mapping away
 * from the caustic, and Alexander's band staying dark in absolute
 * terms.
 */
export function buildBowLUT(
  bins = 256,
  aMm = mpDropRadiusMm(1),
  srcR = SUN_RADIUS
) {
  const thMin = (35 * Math.PI) / 180;
  const thMax = (60 * Math.PI) / 180;
  const dTheta = (thMax - thMin) / bins;
  const prof = new Float64Array(bins * 3);
  const a = aMm * 1e-3; // metres
  const epsWin = [[], []];
  for (let c = 0; c < 3; c++) {
    const n = N_WATER[c];
    const kw = (2 * Math.PI) / (RGB_UM[c] * 1e-6);
    for (let k = 1; k <= 2; k++) {
      const geo = descartes(n, k);
      const s13 = ((2 * kw * kw * a * a) / Math.abs(geo.dpp)) ** (1 / 3);
      // The k-bow's Airy shape over the window (unit prefactor -
      // the energy normalisation below sets the scale).
      const shape = new Float64Array(bins);
      let eAiry = 0;
      for (let i = 0; i < bins; i++) {
        const th = thMin + (i + 0.5) * dTheta;
        // primary brightens INSIDE the bow, secondary OUTSIDE -
        // Alexander's band between them falls out of the signs
        const dTh = k === 1 ? geo.gamma - th : th - geo.gamma;
        shape[i] = airy(-s13 * dTh) ** 2;
        eAiry += shape[i] * 2 * Math.PI * Math.sin(th) * dTheta;
      }
      // The geometric window energy per unit geometric depth -
      // the exact ray mapping this curve must carry (integrated in
      // the impact-parameter domain: the caustic's (gamma-theta)
      // ^(-1/2) singularity breaks theta-domain quadrature).
      const eGeo = bowWindowEnergy(n, k, thMin, thMax);
      const scale = eGeo / Math.max(eAiry, 1e-300);
      epsWin[k - 1][c] = eGeo;
      for (let i = 0; i < bins; i++) prof[i * 3 + c] += scale * shape[i];
    }
  }
  const conv = sunConvolve(prof, bins, dTheta, srcR);
  let peakAbs = 0;
  for (let i = 0; i < bins; i++) {
    const th = 35 + (i + 0.5) * (25 / bins);
    if (th < 45) peakAbs = Math.max(peakAbs, conv[i * 3 + 1]);
  }
  const out = new Float32Array(bins * 4);
  for (let i = 0; i < bins; i++) {
    out[i * 4] = conv[i * 3];
    out[i * 4 + 1] = conv[i * 3 + 1];
    out[i * 4 + 2] = conv[i * 3 + 2];
    out[i * 4 + 3] = 1;
  }
  return {data: out, bins, thMinDeg: 35, thMaxDeg: 60, peakAbs, epsWin};
}

/**
 * Sundog profile over AZIMUTH offset from the source in [18, 55]
 * degrees along its almucantar, at source elevation h (radians):
 * the Bravais parhelia of halos.js (caustic at azimuth Dm - the
 * plate Monte Carlo's arbitrated convention) in the dome's LUT
 * format, limb-darkened-source convolved like the other profiles.
 * NORMALISED to unit azimuth integral per channel (1/rad): the
 * absolute scale rides the amp as PLATE_ALPHA x parhelionShare(h)
 * x the vertical Gaussian's peak density - the Monte Carlo's own
 * flux accounting, so the drawn dog is sr^-1 per unit CLOUD
 * geometric-interaction depth once the theme multiplies the
 * slab. Empty past the Bravais cutoff (lut.any = false).
 */
export function buildDogLUT(h, bins = 256, srcR = SUN_RADIUS) {
  const pp = parhelionProfile(Math.max(h, 0), bins);
  const dAz = (pp.a1 - pp.a0) / bins;
  const prof = new Float64Array(bins * 3);
  for (let i = 0; i < bins; i++) {
    prof[3 * i] = pp.data[3 * i];
    prof[3 * i + 1] = pp.data[3 * i + 1];
    prof[3 * i + 2] = pp.data[3 * i + 2];
  }
  const conv = sunConvolve(prof, bins, dAz, srcR);
  const integ = [0, 0, 0];
  for (let i = 0; i < bins; i++)
    for (let c = 0; c < 3; c++) integ[c] += conv[i * 3 + c] * dAz;
  const out = new Float32Array(bins * 4);
  for (let i = 0; i < bins; i++) {
    for (let c = 0; c < 3; c++)
      out[i * 4 + c] = integ[c] > 0 ? conv[i * 3 + c] / integ[c] : 0;
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
