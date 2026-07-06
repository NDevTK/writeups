/**
 * Procedural multiscale snow glints - the single source of constants
 * and the CPU mirror of the counting model shared by the terrain
 * shader (terrain-tsl.js) and the reference printer
 * (glint-reference.mjs). Zirr & Kaplanyan, "Real-time Rendering of
 * Procedural Multiscale Materials" (I3D 2016), applied to snow:
 *
 *  - The snow surface carries RHO specular ice crystals per m^2;
 *    each crystal is a mirror facet whose normal follows a GGX
 *    orientation distribution of width ALPHA_G, and FSPEC is the
 *    area fraction the crystals cover.
 *  - A crystal GLINTS when its normal lies inside the sun cone
 *    around the half vector: p(h) = D(h) (n.h) OMEGA_G (the NDF is
 *    projected-area normalised, int D(m) cos dm = 1).
 *  - Counting: the footprint is covered by a two-level stack of
 *    grid cells (level matched to the footprint edge, bilinear cell
 *    weights, fractional-level blend - the paper's spatial
 *    reconstruction). Each cell's glint count is drawn from
 *    Poisson(nbar_cell) - the binomial's RHO -> infinity limit the
 *    paper itself invokes - by inverse CDF on ONE deterministic
 *    uniform from pcg3d(cell, level, half-vector bin) (Jarzynski &
 *    Olano 2020; uint32-exact, so both GPU backends and this CPU
 *    mirror produce identical integers).
 *  - Above N_GAUSS expected counts the individual crystals are
 *    sub-pixel and only the first two moments are observable; the
 *    count is replaced by a matched mean/variance uniform (the
 *    paper switches to a Gaussian in the same regime).
 *  - Energy conservation by construction: the pixel's glint factor
 *    is sum(w N) / nbar_pixel with E[factor] = 1, multiplying the
 *    analytic smooth facet lobe (GGX D, height-correlated Smith G,
 *    Fresnel F0 of ice). Far away the factor's variance dies as
 *    1/nbar and the sparkle converges to EXACTLY the smooth lobe.
 */

export const RHO = 30000; // crystals per m^2
export const ALPHA_G = 0.35; // GGX orientation spread of the facets
export const F0_ICE = 0.018; // normal-incidence Fresnel of ice
export const FSPEC = 0.12; // area fraction covered by crystals
// Sun cone: the 0.267-deg solar radius widened to 0.5 deg so a
// glint survives the sun's traverse of its own disc (the paper's
// tolerance cone); OMEGA_G = 2 pi (1 - cos 0.5 deg).
export const OMEGA_G = 2 * Math.PI * (1 - Math.cos((0.5 * Math.PI) / 180));
export const CELL0 = 0.03; // finest cell edge, metres
export const LMAX = 14; // coarsest level = CELL0 * 2^LMAX ~ 490 m
export const HBIN = 96; // half-vector bins per unit component
export const N_GAUSS = 3; // Poisson -> matched-moments switch
export const NBAR_MIN = 1e-4; // 1/nbar safety clamp

// pcg3d (Jarzynski & Olano 2020) - uint32 exact.
export function pcg3d(x, y, z) {
  let vx = (Math.imul(x, 1664525) + 1013904223) >>> 0;
  let vy = (Math.imul(y, 1664525) + 1013904223) >>> 0;
  let vz = (Math.imul(z, 1664525) + 1013904223) >>> 0;
  vx = (vx + Math.imul(vy, vz)) >>> 0;
  vy = (vy + Math.imul(vz, vx)) >>> 0;
  vz = (vz + Math.imul(vx, vy)) >>> 0;
  vx ^= vx >>> 16;
  vy ^= vy >>> 16;
  vz ^= vz >>> 16;
  vx = (vx + Math.imul(vy, vz)) >>> 0;
  vy = (vy + Math.imul(vz, vx)) >>> 0;
  vz = (vz + Math.imul(vx, vy)) >>> 0;
  return [vx >>> 0, vy >>> 0, vz >>> 0];
}

// GGX NDF, projected-area normalised: int D(m) (n.m) dm = 1.
export function ggxD(cosNH, alpha) {
  const a2 = alpha * alpha;
  const c2 = cosNH * cosNH;
  const t = c2 * (a2 - 1) + 1;
  return a2 / (Math.PI * t * t);
}

// Height-correlated Smith visibility for GGX (Heitz 2014):
// V = 0.5 / (Lv + Ll); f_spec = F * D * V (the 1/(4 cosv cosl) is
// inside V).
export function smithV(cosNV, cosNL, alpha) {
  const a2 = alpha * alpha;
  const lv = cosNL * Math.sqrt(cosNV * cosNV * (1 - a2) + a2);
  const ll = cosNV * Math.sqrt(cosNL * cosNL * (1 - a2) + a2);
  return 0.5 / Math.max(lv + ll, 1e-9);
}

// Poisson count by inverse CDF on one uniform (k <= 6 suffices for
// nbar <= N_GAUSS: P(N > 6 | nbar = 3) = 3e-2... the tail mass is
// folded into the last step, conserving the mean to ~1%).
export function poissonCount(u, nbar) {
  let p = Math.exp(-nbar);
  let cdf = p;
  let n = 0;
  for (let k = 1; k <= 6; k++) {
    if (u <= cdf) break;
    p = (p * nbar) / k;
    cdf += p;
    n = k;
  }
  return n;
}

// The per-pixel glint factor the shader computes - CPU mirror for
// the reference and the probe. pmX/pmZ metres, footprint edge a
// metres, hb integer 3-vector (half-vector bin), pHit = D (n.h)
// OMEGA_G.
export function glintFactor(pmX, pmZ, a, hb, pHit) {
  const lf = Math.min(Math.max(Math.log2(Math.max(a, CELL0) / CELL0), 0), LMAX);
  const l0 = Math.floor(lf);
  const tl = lf - l0;
  // All hash inputs are kept non-negative (bin/cell offsets below)
  // so the JS mirror and both GPU int conversions agree bit-exactly.
  const zKey =
    (Math.imul(hb[0] + 512, 73856093) ^
      Math.imul(hb[1] + 512, 19349663) ^
      Math.imul(hb[2] + 512, 83492791)) >>>
    0;
  let sum = 0;
  let nbarPix = 0;
  for (let li = 0; li < 2; li++) {
    const l = Math.min(l0 + li, LMAX);
    const wl = li === 0 ? 1 - tl : tl;
    if (wl <= 0) continue;
    const s = CELL0 * Math.pow(2, l);
    const nbarCell = RHO * s * s * pHit;
    nbarPix += wl * nbarCell;
    const fx = pmX / s - 0.5;
    const fz = pmZ / s - 0.5;
    const cx = Math.floor(fx);
    const cz = Math.floor(fz);
    const bx = fx - cx;
    const bz = fz - cz;
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < 2; i++) {
        const w = wl * (i ? bx : 1 - bx) * (j ? bz : 1 - bz);
        const [hx] = pcg3d(
          (cx + i + 1048576) | 0,
          (cz + j + 1048576) | 0,
          (zKey ^ Math.imul(l, 1597334677)) >>> 0
        );
        const u = hx / 4294967296;
        let N;
        if (nbarCell <= N_GAUSS) {
          N = poissonCount(u, nbarCell);
        } else {
          // matched mean/variance uniform (sub-pixel regime)
          N = nbarCell + (u - 0.5) * Math.sqrt(12 * nbarCell);
        }
        sum += w * N;
      }
    }
  }
  return sum / Math.max(nbarPix, NBAR_MIN);
}
