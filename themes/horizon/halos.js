/**
 * halos.js - the 22-degree ice halo and the sundogs (parhelia),
 * by the prism optics of hexagonal ice. Pure math
 * (node-importable); the sky overlay samples the profiles this
 * module computes. Sibling of rainbow.js: where the rainbow is
 * water drops behind you, the halo is ice prisms in front of
 * you - gated by the measured HIGH cloud (the cirrus deck the
 * theme already polls), not the rain.
 *
 * The sources:
 *  - Ice index: Warren & Brandt (2008), "Optical constants of
 *    ice from the ultraviolet to the microwave: A revised
 *    compilation" - the table's own rows at the atmosphere's
 *    RGB wavelengths, verbatim: n(0.68) = 1.3073,
 *    n(0.55) = 1.3110, n(0.44) = 1.3163.
 *  - The halo: minimum deviation through the 60-degree prism of
 *    a hexagonal column, D = 2 asin(n sin(A/2)) - A - about
 *    21.8 degrees for red, growing with n so the inner edge is
 *    red (Greenler, "Rainbows, Halos, and Glories"). The
 *    46-degree halo obeys the same law through the 90-degree
 *    basal prism (prismDmin carries it, and the gate checks its
 *    closed point), but its real faintness comes from ray-path
 *    statistics that Fresnel throughput alone does not carry -
 *    so it is OMITTED from the drawn profile rather than
 *    mistuned.
 *  - The sundogs: plate crystals hang c-axis vertical, so an
 *    inclined sun ray crosses the same 60-degree prism on a
 *    skew path. Bravais (1847): a skew ray refracts as if the
 *    index were n' = sqrt(n^2 - sin^2 h)/cos h (h the solar
 *    elevation) - the parhelia sit AT the halo when the sun is
 *    on the horizon, migrate outward as it climbs, and vanish
 *    where n' reaches 1/sin(A/2) = 2: h_max =
 *    asin(sqrt((4 - n^2)/3)), about 61 degrees - the documented
 *    sundog cutoff.
 *  - The profile: minimum deviation is a caustic - the ray
 *    density diverges as 1/sqrt(D - Dmin) on the outside and is
 *    zero inside (the sharp inner edge every photograph shows);
 *    smeared by the same 0.266-degree solar disk as the
 *    rainbow; entry/exit Fresnel throughput (1 - rho)^2 at the
 *    passage's own incidence through the same gated
 *    fresnelWater (it is Fresnel for ANY index).
 */

import {fresnelWater} from './coxmunk.js';

// Warren & Brandt (2008) at the atmosphere's RGB (0.68/0.55/
// 0.44 um) - verbatim table rows.
export const ICE_N = [1.3073, 1.311, 1.3163];

export const PRISM_60 = Math.PI / 3;
export const PRISM_90 = Math.PI / 2;

/** Minimum deviation through an apex-A prism at index n. */
export function prismDmin(n, A = PRISM_60) {
  const s = n * Math.sin(A / 2);
  if (s >= 1) return null; // no transmitted minimum-deviation ray
  return 2 * Math.asin(s) - A;
}

/** Incidence at minimum deviation (symmetric passage). */
export function prismIncidence(n, A = PRISM_60) {
  const D = prismDmin(n, A);
  return D == null ? null : (D + A) / 2;
}

/** Fresnel throughput of the symmetric passage: in and out. */
export function prismThroughput(n, A = PRISM_60) {
  const i = prismIncidence(n, A);
  if (i == null) return 0;
  const rho = fresnelWater(Math.cos(i), n);
  return (1 - rho) ** 2;
}

/** Bravais effective index for a ray inclined h to horizontal. */
export function bravais(n, h) {
  return Math.sqrt(n * n - Math.sin(h) ** 2) / Math.cos(h);
}

/** Where the sundogs die: n' = 1/sin(A/2) = 2 for the 60-degree
 *  prism (closed form). */
export function sundogCutoff(n) {
  return Math.asin(Math.sqrt((4 - n * n) / 3));
}

/**
 * The parhelion's angular distance from the sun at solar
 * elevation h (great-circle), and its azimuthal offset along
 * the almucantar - null past the cutoff.
 */
export function parhelion(n, h) {
  const np = bravais(n, h);
  const D = prismDmin(np, PRISM_60);
  if (D == null) return null;
  const ch = Math.cos(h);
  const cosAz = (Math.cos(D) - Math.sin(h) ** 2) / (ch * ch);
  if (cosAz < -1 || cosAz > 1) return null;
  return {D, az: Math.acos(cosAz), np};
}

/**
 * The caustic of minimum deviation: ray density ~
 * 1/sqrt(D - Dmin) outside, zero inside, solar-disk smeared
 * (5-point chord weighting over the 0.266-degree radius - the
 * rainbow's own kernel). eps floors the divergence at the
 * smearing scale.
 */
const SUN_R = (0.266 * Math.PI) / 180;
export function caustic(dD) {
  let acc = 0;
  let wsum = 0;
  for (let s = -2; s <= 2; s++) {
    const off = (s / 2) * SUN_R;
    const w = Math.sqrt(1 - (s / 2) ** 2 * 0.999) + 1e-3;
    const x = dD + off;
    acc += w * (x > 0 ? 1 / Math.sqrt(Math.max(x, SUN_R / 4)) : 0);
    wsum += w;
  }
  return acc / wsum;
}

/**
 * The circular-halo profile over the angle from the sun: the
 * 22-degree halo of randomly oriented columns, per RGB,
 * Fresnel-weighted, caustic-shaped. Static (depends only on the
 * ice index). Returns {g0, g1, n, data (RGB, normalised)}.
 */
export function haloProfile(samples = 512) {
  const g0 = (18 * Math.PI) / 180;
  const g1 = (30 * Math.PI) / 180;
  const data = new Float32Array(samples * 3);
  for (let ch = 0; ch < 3; ch++) {
    const n = ICE_N[ch];
    const Dm = prismDmin(n, PRISM_60);
    const T = prismThroughput(n, PRISM_60);
    for (let i = 0; i < samples; i++) {
      const g = g0 + ((g1 - g0) * i) / (samples - 1);
      data[3 * i + ch] += T * caustic(g - Dm);
    }
  }
  let peak = 0;
  for (const v of data) peak = Math.max(peak, v);
  if (peak > 0) for (let i = 0; i < data.length; i++) data[i] /= peak;
  return {g0, g1, n: samples, data};
}

/**
 * The sundog profile over azimuthal offset from the sun at
 * solar elevation h: the Bravais-shifted caustic per RGB along
 * the almucantar (the vertical smear from plate wobble is the
 * overlay's). Returns {a0, a1, n, data, any} - any = false past
 * the cutoff (the LUT is zero).
 */
export function parhelionProfile(h, samples = 256) {
  const a0 = (18 * Math.PI) / 180;
  const a1 = (55 * Math.PI) / 180;
  const data = new Float32Array(samples * 3);
  let any = false;
  const sh2 = Math.sin(h) ** 2;
  const ch2 = Math.cos(h) ** 2;
  for (let ch = 0; ch < 3; ch++) {
    const n = ICE_N[ch];
    const np = bravais(n, h);
    const Dm = prismDmin(np, PRISM_60);
    if (Dm == null) continue;
    const T = prismThroughput(np, PRISM_60);
    for (let i = 0; i < samples; i++) {
      const az = a0 + ((a1 - a0) * i) / (samples - 1);
      // great-circle distance to a point az away on the sun's
      // own altitude circle
      const D = Math.acos(Math.min(Math.max(sh2 + ch2 * Math.cos(az), -1), 1));
      const v = T * caustic(D - Dm);
      if (v > 0) any = true;
      data[3 * i + ch] += v;
    }
  }
  let peak = 0;
  for (const v of data) peak = Math.max(peak, v);
  if (peak > 0) for (let i = 0; i < data.length; i++) data[i] /= peak;
  return {a0, a1, n: samples, data, any};
}
