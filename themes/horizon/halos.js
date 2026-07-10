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
 *    basal prism - and its real faintness EMERGES from the
 *    crystal Monte Carlo below (mcHalo): random orientations
 *    over SO(3), flux-correct face entry, the actual hexagonal
 *    geometry - exactly Greenler's computation, gated.
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

// ---- Greenler's Monte Carlo: random hexagonal ice prisms ----
// Deterministic PRNG (mulberry32) so the histogram - and the
// gate's landmarks on it - are bit-reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Uniform random rotation (Shoemake's quaternion method) applied
// to a vector: v' = q v q*.
function randomRotate(v, rng) {
  const u1 = rng();
  const u2 = rng();
  const u3 = rng();
  const s1 = Math.sqrt(1 - u1);
  const s2 = Math.sqrt(u1);
  const qx = s1 * Math.sin(2 * Math.PI * u2);
  const qy = s1 * Math.cos(2 * Math.PI * u2);
  const qz = s2 * Math.sin(2 * Math.PI * u3);
  const qw = s2 * Math.cos(2 * Math.PI * u3);
  // rotate v by quaternion (x,y,z,w)
  const tx = 2 * (qy * v.z - qz * v.y);
  const ty = 2 * (qz * v.x - qx * v.z);
  const tz = 2 * (qx * v.y - qy * v.x);
  return {
    x: v.x + qw * tx + (qy * tz - qz * ty),
    y: v.y + qw * ty + (qz * tx - qx * tz),
    z: v.z + qw * tz + (qx * ty - qy * tx)
  };
}

// The hexagonal prism, crystal frame: c-axis = z, side length
// a = 1, aspect c/a = 1 (the compact "blocky" crystal of the
// classical random-orientation halo model - a documented model
// parameter). Six side faces (apothem sqrt(3)/2), two basals.
const APOTHEM = Math.sqrt(3) / 2;
const HEX_C = 1; // c/a aspect
const FACES = (() => {
  const f = [];
  for (let k = 0; k < 6; k++) {
    const phi = (k * Math.PI) / 3;
    f.push({
      n: {x: Math.cos(phi), y: Math.sin(phi), z: 0},
      d: APOTHEM,
      area: 1 * HEX_C // side width a=1 x height c
    });
  }
  f.push({n: {x: 0, y: 0, z: 1}, d: HEX_C / 2, area: (3 * APOTHEM) / 2});
  f.push({n: {x: 0, y: 0, z: -1}, d: HEX_C / 2, area: (3 * APOTHEM) / 2});
  return f;
})();
const AREA_MAX = Math.max(...FACES.map((f) => f.area));

const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

// Vector Snell refraction through a face with OUTWARD normal nrm,
// from index n1 into n2; null on total internal reflection.
// Returns {dir, T} with the polarisation-averaged Fresnel
// transmittance (fresnelWater generalises: it is Fresnel for any
// pair via the relative index).
function refract(d, nrm, n1, n2) {
  const cosi = -dot3(d, nrm); // entering: d against the normal
  const eta = n1 / n2;
  const k = 1 - eta * eta * (1 - cosi * cosi);
  if (k <= 0) return null; // TIR
  const cost = Math.sqrt(k);
  const dir = {
    x: eta * d.x + (eta * cosi - cost) * nrm.x,
    y: eta * d.y + (eta * cosi - cost) * nrm.y,
    z: eta * d.z + (eta * cosi - cost) * nrm.z
  };
  // unpolarised Fresnel with the relative index
  const rel = n2 / n1;
  const rs = (cosi - rel * cost) / (cosi + rel * cost);
  const rp = (rel * cosi - cost) / (rel * cosi + cost);
  return {dir, T: 1 - (rs * rs + rp * rp) / 2};
}

// A point uniform on face f (crystal frame, ON the face plane).
function facePoint(f, rng) {
  if (f.n.z !== 0) {
    // basal hexagon: rejection from the bounding box
    for (;;) {
      const x = (rng() * 2 - 1) * 1;
      const y = (rng() * 2 - 1) * APOTHEM;
      // inside the hexagon (flat-top orientation: apothem along
      // the six side normals)
      if (
        Math.abs(y) <= APOTHEM &&
        Math.abs(y + Math.sqrt(3) * x) <= 2 * APOTHEM &&
        Math.abs(y - Math.sqrt(3) * x) <= 2 * APOTHEM
      ) {
        return {x, y, z: f.n.z * (HEX_C / 2)};
      }
    }
  }
  // side rectangle: width a = 1 along the face tangent, height c
  const t = {x: -f.n.y, y: f.n.x, z: 0};
  const u = rng() - 0.5;
  const v = (rng() - 0.5) * HEX_C;
  return {
    x: f.n.x * f.d + t.x * u,
    y: f.n.y * f.d + t.y * u,
    z: v
  };
}

/**
 * ONE crystal transit (Greenler's Monte Carlo step): a random
 * orientation (uniform over SO(3) - the sun is rotated instead
 * of the crystal, same thing), flux-correct entry-face selection
 * (rejection on projected area), a uniform entry point, Snell
 * in, the convex-prism exit face, Snell out. Returns
 * {dev (radians), T} for the 2-refraction transit, or null (no
 * entry face accepted this trial, or TIR at the exit - the
 * internally reflected families make OTHER arcs, documented out
 * of scope). n = 1 must return dev = 0 exactly - the gate holds
 * that null test.
 */
export function traceCrystal(n, rng) {
  const d = randomRotate({x: 0, y: 0, z: 1}, rng); // sun in crystal frame
  // rejection-select the entry face by projected area
  const f = FACES[Math.floor(rng() * 8)];
  const proj = -dot3(d, f.n);
  if (proj <= 0) return null;
  if (rng() * AREA_MAX > f.area * proj) return null;
  const rin = refract(d, f.n, 1, n);
  if (!rin) return null;
  const p0 = facePoint(f, rng);
  // exit: nearest forward face plane (convex prism), skip entry
  let tMin = Infinity;
  let fOut = null;
  for (const g of FACES) {
    if (g === f) continue;
    const dn = dot3(rin.dir, g.n);
    if (dn <= 1e-12) continue;
    const t = (g.d - dot3(p0, g.n)) / dn;
    if (t > 1e-9 && t < tMin) {
      tMin = t;
      fOut = g;
    }
  }
  if (!fOut) return null;
  const rout = refract(
    rin.dir,
    {x: -fOut.n.x, y: -fOut.n.y, z: -fOut.n.z},
    n,
    1
  );
  if (!rout) return null; // TIR at the exit
  const cosDev = Math.min(Math.max(dot3(d, rout.dir), -1), 1);
  return {dev: Math.acos(cosDev), T: rin.T * rout.T};
}

/**
 * The full random-orientation histogram: every 2-refraction
 * transit of SAMPLES crystals per channel, binned by deviation.
 * The 22-degree halo (side-side, 60-deg wedge) and the
 * 46-degree halo (side-basal, 90-deg wedge) both EMERGE, with
 * their relative strengths set by the geometry and Fresnel - the
 * statistics the caustic model could not carry. Deterministic
 * (seeded), so the gate can hold exact facts about the output.
 */
export function mcHalo(nRGB = ICE_N, samples = 400000, seed = 1337) {
  const g0 = (15 * Math.PI) / 180;
  const g1 = (52 * Math.PI) / 180;
  const bins = 512;
  const data = new Float64Array(bins * 3);
  for (let ch = 0; ch < nRGB.length; ch++) {
    const rng = mulberry32(seed + ch);
    for (let i = 0; i < samples; i++) {
      const hit = traceCrystal(nRGB[ch], rng);
      if (!hit) continue;
      const b = Math.floor(((hit.dev - g0) / (g1 - g0)) * bins);
      if (b >= 0 && b < bins) data[b * 3 + ch] += hit.T;
    }
  }
  return {g0, g1, bins, data};
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
