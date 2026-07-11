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
  for (let ri = 0; ri < nR; ri++) {
    const r = radiiU[ri];
    for (let ai = 0; ai < nAz; ai++) {
      const az = (ai / nAz) * 2 * Math.PI;
      const x = Math.sin(az) * r;
      const z = -Math.cos(az) * r;
      const eRaw = elevAt(x, z);
      const e = eRaw - curvatureDrop(r * mpu, k);
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
  return {positions, indices: new Uint32Array(idx), sea, nR, nAz};
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

// Koschmieder transmittance of a horizontal path: the same
// extinction the theme's fog already cites, at the MEASURED
// meteorological visibility V (metres): T = exp(-3.912 d / V).
export function koschmiederT(dM, visM) {
  return Math.exp((-3.912 * dM) / Math.max(visM, 1));
}
