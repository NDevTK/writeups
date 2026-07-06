/**
 * Atmospheric-optics radiance profiles - the single source shared by
 * the runtime (sky-objects-tsl.js) and the reference printer
 * (optics-reference.mjs). Geometric-optics level, computed in double
 * precision at init; wave effects (Airy supernumeraries) are out of
 * scope and documented as such.
 *
 *  - 22-degree halo: refraction through the 60-degree prism of a
 *    randomly rotating hexagonal ice crystal. For uniform rotation
 *    the emergent-deviation density is the histogram of D(x) over
 *    entrance angle x, weighted by the projected aperture cos(x) and
 *    the two refraction Fresnel transmittances - the 1/sqrt(D - Dmin)
 *    caustic at minimum deviation IS the halo's sharp inner edge.
 *    Ice dispersion (Warren 1984, at the theme's 680/550/440 nm):
 *    n = 1.3070 / 1.3110 / 1.3170, putting the per-channel minimum
 *    deviations at 21.61 / 21.92 / 22.37 degrees.
 *  - Rainbows: Descartes geometric scattering by spherical drops.
 *    Deviation D(b) = 2(i - r) + k(pi - 2r) for k internal
 *    reflections, histogrammed over the impact parameter b with its
 *    annulus weight and the Fresnel chain T1 R^k T2 (polarisation
 *    averaged) - the primary/secondary brightness ratio and
 *    Alexander's dark band between them EMERGE from the physics.
 *    Water dispersion (Hale & Querry): 1.3308 / 1.3339 / 1.3390.
 *
 * Both profiles are convolved with the sun's 0.267-degree-radius
 * disc carrying the same Hestroffer & Magnan limb darkening the dome
 * renders (alpha = 0.4064 / 0.5079 / 0.6406 per channel).
 */

const N_ICE = [1.307, 1.311, 1.317];
const N_WATER = [1.3308, 1.3339, 1.339];
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
 * point, per RGB channel: primary (k = 1) and secondary (k = 2)
 * accumulated into ONE profile - their ratio and the dark band
 * between them come from the Fresnel chain, not from tuning.
 * Normalised by the primary's peak.
 */
export function buildBowLUT(bins = 256) {
  const thMin = (35 * Math.PI) / 180;
  const thMax = (60 * Math.PI) / 180;
  const dTheta = (thMax - thMin) / bins;
  const prof = new Float64Array(bins * 3);
  const SAMPLES = 400000;
  for (let c = 0; c < 3; c++) {
    const n = N_WATER[c];
    for (let k = 1; k <= 2; k++) {
      for (let s = 0; s < SAMPLES; s++) {
        const b = (s + 0.5) / SAMPLES; // impact parameter
        const i = Math.asin(b);
        const r = Math.asin(b / n);
        const D = 2 * (i - r) + k * (Math.PI - 2 * r);
        // scattering angle from the antisolar direction
        let th = Math.PI - (D % (2 * Math.PI));
        th = Math.abs(th);
        if (th > Math.PI) th = 2 * Math.PI - th;
        const bin = Math.floor((th - thMin) / dTheta);
        if (bin < 0 || bin >= bins) continue;
        const ci = Math.cos(i);
        const cr = Math.cos(r);
        const R = fresnelR(cr, n, 1); // internal reflection
        const T = (1 - fresnelR(ci, 1, n)) * (1 - R);
        prof[bin * 3 + c] += b * T * Math.pow(R, k);
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
