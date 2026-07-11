/**
 * Ross-Li (RTLSR) kernel-driven vegetation BRDF - the single source
 * shared by the terrain material (terrain-tsl.js mirrors these
 * kernels in TSL) and the reference printer (ross-li-reference.mjs).
 *
 * Model: the MODIS/VIIRS operational BRDF (Lucht, Schaaf & Strahler
 * 2000, IEEE TGRS 38(2) 977-998),
 *   R(ti, tv, phi) = f_iso + f_vol Kvol + f_geo Kgeo
 * with Kvol the RossThick radiative-transfer kernel (Roujean et al.
 * 1992) and Kgeo the LiSparse-Reciprocal geometric-optics kernel at
 * the operational shape constants h/b = 2, b/r = 1.
 *
 * Hotspot: RossThick misses the sharp backscatter peak; Maignan,
 * Breon & Lacaze (2004, RSE 90, 210-220) multiply its scattering
 * bracket by (1 + (1 + xi/xi0)^-1) with xi0 = 1.5 deg, calibrated on
 * POLDER - exactly 2 at the antisolar point, 1.5 at xi = xi0.
 *
 * Albedo integrals (Lucht 2000 eq. 39 + Table 1): the black-sky
 * kernel integrals h_k(t) are the cubic fits g0 + g1 t^2 + g2 t^3
 * and the white-sky integrals are the constants 0.189184 (vol) and
 * -1.377622 (geo); the reference printer re-derives all of them by
 * Gauss-Legendre quadrature of the kernels themselves.
 *
 * Kernel weights: the six BRDF archetypes of Zhang, Jiao et al.
 * (2016, Remote Sensing 8(12):1004, Table 1) - the AFX-binned
 * cluster means of the global MODIS MCD43A1 red/NIR retrievals.
 * The archetype is selected at run time by fitArchetype(): the
 * published minimum-fitting-error rule applied to the visitor
 * pixel's own multi-angular MOD09A1 reflectance record (ORNL
 * subset REST API), because the per-pixel MCD43A1 weights sit
 * behind authenticated archives only.
 */

export const XI0 = (1.5 * Math.PI) / 180; // Maignan et al. 2004 hotspot width
export const THETA_MAX = (75 * Math.PI) / 180; // kernel-fit validity clamp

// Lucht 2000 Table 1: h_k(t) = g0 + g1 t^2 + g2 t^3 (t in radians).
export const G_VOL = [-0.007574, -0.070987, 0.307588];
export const G_GEO = [-1.284909, -0.166314, 0.04184];
// Lucht 2000 white-sky kernel integrals.
export const H_VOL = 0.189184;
export const H_GEO = -1.377622;
// Black-sky integral of the Maignan hotspot EXCESS (KvolM - Kvol),
// fitted on the same cubic basis Lucht fits the kernels themselves
// (least squares over 0..75 deg; the reference printer re-derives
// it by quadrature, residual < 4e-4). Multiplied by f_vol it
// extends the black-sky albedo to the hotspot-corrected kernel, so
// the shader's per-pixel normalisation conserves the hotspot
// energy exactly.
export const G_DHOT = [0.033543, -0.001107, 0.003307];

// RossThick (Roujean 1992 / Lucht 2000 eq. 38). Vanishes at
// ti = tv = 0 by construction, so f_iso is the nadir BRF.
export function rossThick(ti, tv, phi) {
  const ci = Math.cos(ti);
  const cv = Math.cos(tv);
  const cosXi = Math.min(
    1,
    Math.max(-1, ci * cv + Math.sin(ti) * Math.sin(tv) * Math.cos(phi))
  );
  const xi = Math.acos(cosXi);
  return ((Math.PI / 2 - xi) * cosXi + Math.sin(xi)) / (ci + cv) - Math.PI / 4;
}

// RossThick with the Maignan 2004 hotspot factor on the scattering
// bracket. NOTE it does NOT vanish at ti = tv = 0: nadir sun with
// nadir view IS the hotspot (value pi/4).
export function rossThickMaignan(ti, tv, phi) {
  const ci = Math.cos(ti);
  const cv = Math.cos(tv);
  const cosXi = Math.min(
    1,
    Math.max(-1, ci * cv + Math.sin(ti) * Math.sin(tv) * Math.cos(phi))
  );
  const xi = Math.acos(cosXi);
  const hot = 1 + 1 / (1 + xi / XI0);
  return (
    (((Math.PI / 2 - xi) * cosXi + Math.sin(xi)) * hot) / (ci + cv) -
    Math.PI / 4
  );
}

// LiSparse-Reciprocal (Lucht 2000 eqs. 39-44) at h/b = 2, b/r = 1.
// With b/r = 1 the equivalent angles equal the true ones.
export function liSparseR(ti, tv, phi) {
  const HB = 2;
  const ci = Math.cos(ti);
  const cv = Math.cos(tv);
  const si = Math.sin(ti);
  const sv = Math.sin(tv);
  const tanI = si / ci;
  const tanV = sv / cv;
  const secI = 1 / ci;
  const secV = 1 / cv;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const cosXi = Math.min(1, Math.max(-1, ci * cv + si * sv * cosPhi));
  const D2 = tanI * tanI + tanV * tanV - 2 * tanI * tanV * cosPhi;
  const cost = Math.min(
    1,
    Math.max(
      -1,
      (HB *
        Math.sqrt(
          Math.max(0, D2 + tanI * tanV * sinPhi * (tanI * tanV * sinPhi))
        )) /
        (secI + secV)
    )
  );
  const t = Math.acos(cost);
  const O = ((t - Math.sin(t) * cost) * (secI + secV)) / Math.PI;
  return O - secI - secV + 0.5 * (1 + cosXi) * secI * secV;
}

// BRF of a weight set {iso, vol, geo}.
export function brf(w, ti, tv, phi, hotspot = true) {
  const kv = hotspot ? rossThickMaignan(ti, tv, phi) : rossThick(ti, tv, phi);
  return w.iso + w.vol * kv + w.geo * liSparseR(ti, tv, phi);
}

// Gauss-Legendre nodes/weights on [-1, 1] (Newton on P_n).
export function gaussLegendre(n) {
  const x = new Float64Array(n);
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let z = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5));
    let pp = 0;
    for (let it = 0; it < 100; it++) {
      let p0 = 1;
      let p1 = 0;
      for (let j = 0; j < n; j++) {
        const p2 = p1;
        p1 = p0;
        p0 = ((2 * j + 1) * z * p1 - j * p2) / (j + 1);
      }
      pp = (n * (z * p0 - p1)) / (z * z - 1);
      const dz = p0 / pp;
      z -= dz;
      if (Math.abs(dz) < 1e-15) break;
    }
    x[i] = z;
    w[i] = 2 / ((1 - z * z) * pp * pp);
  }
  return {x, w};
}

// Black-sky kernel integral by quadrature:
// h_K(ti) = (1/pi) int_0^2pi int_0^1 K(ti, acos(mu), phi) mu dmu dphi
// (kernels are even in phi, so integrate [0, pi] twice).
export function bsaKernel(K, ti, n = 200) {
  const g = gaussLegendre(n);
  let sum = 0;
  for (let a = 0; a < n; a++) {
    const mu = 0.5 * (g.x[a] + 1); // [0,1]
    const tv = Math.acos(mu);
    let inner = 0;
    for (let b = 0; b < n; b++) {
      const phi = (Math.PI / 2) * (g.x[b] + 1); // [0,pi]
      inner += g.w[b] * K(ti, tv, phi);
    }
    sum += g.w[a] * mu * inner;
  }
  // dmu scale 1/2, dphi scale pi/2, symmetry x2, leading 1/pi
  return (sum * 0.5 * (Math.PI / 2) * 2) / Math.PI;
}

// White-sky kernel integral:
// H_K = 2 int_0^1 h_K(acos(mu)) mu dmu.
export function wsaKernel(K, n = 200, ni = 64) {
  const g = gaussLegendre(ni);
  let sum = 0;
  for (let a = 0; a < ni; a++) {
    const mu = 0.5 * (g.x[a] + 1);
    sum += g.w[a] * mu * bsaKernel(K, Math.acos(mu), n);
  }
  return 2 * sum * 0.5;
}

// Lucht 2000 cubic fit of h_K.
export function bsaPoly(g, t) {
  return g[0] + g[1] * t * t + g[2] * t * t * t;
}

// Black/white-sky albedo of a weight set (polynomial form - the
// MODIS albedo formulation uses the BASE kernels).
export function bsaAlbedo(w, ti) {
  return w.iso + w.vol * bsaPoly(G_VOL, ti) + w.geo * bsaPoly(G_GEO, ti);
}

// Black-sky albedo of the HOTSPOT-corrected kernel set (base
// polynomial + the fitted Maignan excess) - the shader's per-pixel
// directional normaliser.
export function bsaAlbedoM(w, ti) {
  return bsaAlbedo(w, ti) + w.vol * bsaPoly(G_DHOT, ti);
}

export function wsaAlbedo(w) {
  return w.iso + w.vol * H_VOL + w.geo * H_GEO;
}

// Isotropic-sky HDRF at view zenith tv: by kernel reciprocity the
// incident-hemisphere integral of R at fixed view equals the
// black-sky integral at that zenith (Lucht 2000, sec. II-D).
export function skyHdrf(w, tv) {
  return bsaAlbedo(w, tv);
}

// Exact directional-BRF normaliser for the display: the view-
// hemisphere albedo of the HOTSPOT kernel set at the current sun
// zenith, by quadrature (the cubic fits cover the base kernels
// only). Dividing R by this makes the mean of the displayed
// anisotropy factor over the view hemisphere exactly 1 - the
// Ross-Li shape redistributes the existing albedo, it does not
// change it.
export function dirNorm(w, ti, n = 96) {
  return (
    w.iso +
    w.vol * bsaKernel(rossThickMaignan, ti, n) +
    w.geo * bsaKernel(liSparseR, ti, n)
  );
}

/**
 * MOD09A1 500 m "state" QC word (MOD09 User's Guide, table of the
 * sur_refl_state_500m bit field): accept only observations that are
 * clear (bits 0-1 = 00), shadow-free (bit 2), land (bits 3-5 = 001),
 * below the highest aerosol class (bits 6-7 < 11), below the
 * highest cirrus class (bits 8-9 < 11), free of internal cloud
 * (bit 10) and internal snow (bits 12 and 15), and not adjacent to
 * cloud (bit 13).
 */
export function mod09Clear(state) {
  return (
    (state & 0x3) === 0 && // cloud state: clear
    (state & 0x4) === 0 && // cloud shadow
    ((state >> 3) & 0x7) === 1 && // land/water: land
    ((state >> 6) & 0x3) !== 3 && // aerosol: not high
    ((state >> 8) & 0x3) !== 3 && // cirrus: not high
    (state & 0x400) === 0 && // internal cloud
    (state & 0x1000) === 0 && // MOD35 snow/ice
    (state & 0x2000) === 0 && // adjacent to cloud
    (state & 0x8000) === 0 // internal snow
  );
}

/**
 * Archetype selection by minimum fitting error - the published
 * archetype-application rule (Jiao et al. 2014; Zhang et al. 2016;
 * the FY-2G archetype albedo retrieval, Appl. Sci. 13:9859, 2023,
 * uses the same minimum-regression-error selection): each
 * archetype's BRDF shape, scaled by one
 * least-squares factor, is regressed against the MEASURED
 * multi-angular reflectance series of the pixel (MOD09A1 surface
 * reflectance with its per-composite sun/view geometry), and the
 * archetype with the smallest RMSE wins. The scale absorbs
 * brightness; the angular SHAPE picks the archetype. Predictions
 * use the BASE kernels - the archetype weights were retrieved with
 * them.
 *
 * obs: [{r, ti, tv, phi}] (reflectance, radians). Returns
 * {k, a, rmse, margin} - archetype index, scale, fit RMSE and the
 * runner-up RMSE gap - or null when the series cannot separate
 * anything (fewer than 4 clear observations).
 */
/**
 * Full RTLSR inversion - the OPERATIONAL MCD43 retrieval (Lucht,
 * Schaaf & Strahler 2000, sec. III: linear least squares of
 * R = f_iso + f_vol Kvol + f_geo Kgeo over the clear multi-angular
 * record, BASE kernels as the product uses). ORNL's open subset
 * API serves the MOD09A1 record globally but the MCD43 weights
 * only at fixed sites, so the same published inversion runs here
 * on the same observations the archetype fit already pulls.
 * Rules mirror the product: a full inversion needs at least 7
 * clear observations (the MCD43 full-inversion threshold); the
 * normal matrix must be well-conditioned (degenerate repeated
 * geometry refuses rather than extrapolating); and the retrieved
 * set must be physical (f_iso and both integrated albedos inside
 * (0, 1)). Returns {iso, vol, geo, rmse} or null.
 */
export function fitRTLSR(obs) {
  if (!obs || obs.length < 7) return null;
  // Normal equations A^T A x = A^T r for A rows [1, Kvol, Kgeo].
  let s11 = 0;
  let s12 = 0;
  let s13 = 0;
  let s22 = 0;
  let s23 = 0;
  let s33 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  const rows = obs.map((o) => {
    const kv = rossThick(o.ti, o.tv, o.phi);
    const kg = liSparseR(o.ti, o.tv, o.phi);
    s11 += 1;
    s12 += kv;
    s13 += kg;
    s22 += kv * kv;
    s23 += kv * kg;
    s33 += kg * kg;
    b1 += o.r;
    b2 += o.r * kv;
    b3 += o.r * kg;
    return [kv, kg];
  });
  const det =
    s11 * (s22 * s33 - s23 * s23) -
    s12 * (s12 * s33 - s23 * s13) +
    s13 * (s12 * s23 - s22 * s13);
  // Conditioning: identical geometries make the system rank-1; the
  // determinant of the normal matrix scales with the cube of its
  // magnitude, so gate it against that scale, not a bare epsilon.
  const scale = Math.cbrt(Math.abs(s11 * s22 * s33)) || 1;
  if (!(Math.abs(det) > 1e-9 * scale * scale * scale)) return null;
  const iso =
    ((s22 * s33 - s23 * s23) * b1 +
      (s13 * s23 - s12 * s33) * b2 +
      (s12 * s23 - s13 * s22) * b3) /
    det;
  const vol =
    ((s13 * s23 - s12 * s33) * b1 +
      (s11 * s33 - s13 * s13) * b2 +
      (s12 * s13 - s11 * s23) * b3) /
    det;
  const geo =
    ((s12 * s23 - s13 * s22) * b1 +
      (s12 * s13 - s11 * s23) * b2 +
      (s11 * s22 - s12 * s12) * b3) /
    det;
  const w = {iso, vol, geo};
  const wsa = wsaAlbedo(w);
  const bsa45 = bsaAlbedo(w, Math.PI / 4);
  if (!(iso > 0 && iso < 1 && wsa > 0 && wsa < 1 && bsa45 > 0 && bsa45 < 1))
    return null;
  let sse = 0;
  for (let j = 0; j < obs.length; j++) {
    const e = obs[j].r - (iso + vol * rows[j][0] + geo * rows[j][1]);
    sse += e * e;
  }
  return {iso, vol, geo, rmse: Math.sqrt(sse / obs.length)};
}

export function fitArchetype(obs, band = 'red') {
  if (obs.length < 4) return null;
  let best = null;
  let second = Infinity;
  for (let k = 0; k < ARCHETYPES[band].length; k++) {
    const w = ARCHETYPES[band][k];
    let num = 0;
    let den = 0;
    const pred = obs.map((o) => brf(w, o.ti, o.tv, o.phi, false));
    for (let j = 0; j < obs.length; j++) {
      num += obs[j].r * pred[j];
      den += pred[j] * pred[j];
    }
    const a = num / den;
    let sse = 0;
    for (let j = 0; j < obs.length; j++) {
      const e = obs[j].r - a * pred[j];
      sse += e * e;
    }
    const rmse = Math.sqrt(sse / obs.length);
    if (!best || rmse < best.rmse) {
      if (best) second = best.rmse;
      best = {k, a, rmse};
    } else if (rmse < second) {
      second = rmse;
    }
  }
  best.margin = second - best.rmse;
  return best.a > 0 ? best : null;
}

/**
 * Zhang, H., Jiao, Z., Dong, Y., Du, P., Li, Y., Lian, Y. & Cui, T.
 * (2016): "Analysis of Extreme Anisotropic Reflectance ..." Remote
 * Sensing 8(12):1004, Table 1 - the six global RTLSR BRDF archetypes
 * (AFX-binned cluster means of high-quality MCD43A1 retrievals),
 * VERBATIM: {AFX, f_iso, f_vol, f_geo} per band. AFX is the
 * Anisotropic Flat Index (Jiao et al. 2014),
 * AFX = 1 + (f_vol/f_iso) H_vol + (f_geo/f_iso) H_geo;
 * the reference printer re-derives the AFX column from the weights.
 * A1 is the most geometric-optics (shadow-dominated, sparse crowns),
 * A6 the most volume-scattering (dense leaf canopies).
 */
export const ARCHETYPES = {
  red: [
    {afx: 0.618, iso: 0.1424, vol: 0.0082, geo: 0.0406},
    {afx: 0.736, iso: 0.119, vol: 0.0305, geo: 0.027},
    {afx: 0.843, iso: 0.1195, vol: 0.0485, geo: 0.0202},
    {afx: 0.956, iso: 0.1324, vol: 0.0816, geo: 0.0155},
    {afx: 1.107, iso: 0.0893, vol: 0.0862, geo: 0.0049},
    {afx: 1.386, iso: 0.0396, vol: 0.086, geo: 0.0007}
  ],
  nir: [
    {afx: 0.744, iso: 0.3148, vol: 0.0767, geo: 0.069},
    {afx: 0.853, iso: 0.2995, vol: 0.1424, geo: 0.0515},
    {afx: 0.931, iso: 0.2829, vol: 0.1774, geo: 0.0384},
    {afx: 1.002, iso: 0.2819, vol: 0.1985, geo: 0.0269},
    {afx: 1.091, iso: 0.2763, vol: 0.2388, geo: 0.0145},
    {afx: 1.203, iso: 0.2909, vol: 0.3291, geo: 0.0023}
  ]
};
