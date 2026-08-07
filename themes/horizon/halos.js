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
import {sunAngularRadiusRad} from './eclipses.js';

// Warren & Brandt (2008) at the atmosphere's RGB (0.68/0.55/
// 0.44 um) - verbatim table rows.
export const ICE_N = [1.3073, 1.311, 1.3163];

// The measured smooth-crystal fraction: Forster & Mayer 2022
// (ACP 22, 15179, read in full - the HaloCam retrieval over 4400
// halo images). Only SMOOTH hexagonal crystals make the ring;
// rough crystals scatter featurelessly (Jaervinen et al. 2018's
// 61-81% mesoscopically deformed, cited therein). The paper's
// per-habit average for SOLID COLUMNS - the habit this module's
// MC traces (HEX_C = 1 compact column) - is ~37% smooth
// ("Averaged over all 4400 images, the SCF for columnar, hollow,
// and plate-shaped crystals amounts to about ~37%, ~47%, and
// ~73%"; the abstract's headline mixture is the same 37/63).
// Documented scope: the retrieval sees HALO-PRODUCING cirrus -
// Forster et al. 2017's "at least 25% of all cirrus" - so a veil
// drawn always-ringing overdraws the OCCURRENCE statistic; a
// per-scene discriminator is its own research item, and the
// rough remainder's featureless glare is conservatively not
// drawn.
export const SCF_COLUMN = 0.37;

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
 * The parhelion's position at solar elevation h: the Bravais
 * minimum deviation D is the deviation of the HORIZONTAL
 * projection (vertical side faces conserve the vertical
 * direction cosine), so the dog's AZIMUTH offset from the sun is
 * D itself - az = D. (Shipped until the sundog pass with a
 * great-circle conversion that pushed the position outward with
 * altitude; the plate Monte Carlo's independent trace arbitrated
 * the convention.) The great-circle distance, if wanted, is
 * acos(sin^2 h + cos^2 h cos D) < D. Null past the cutoff.
 */
export function parhelion(n, h) {
  const np = bravais(n, h);
  const D = prismDmin(np, PRISM_60);
  if (D == null) return null;
  return {D, az: D, np};
}

/**
 * The caustic of minimum deviation: ray density ~
 * 1/sqrt(D - Dmin) outside, zero inside, solar-disk smeared
 * (5-point chord weighting over the 0.266-degree radius - the
 * rainbow's own kernel). eps floors the divergence at the
 * smearing scale.
 */
const SUN_R = sunAngularRadiusRad(); // the shared IAU disc at 1 au
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
 * The UNSMEARED caustic, integrated exactly over one profile bin:
 * mean of 1/sqrt(max(x, 0)) over [x0, x1], via the closed form
 * int x^-1/2 dx = 2 sqrt(x). The 1/sqrt divergence at the
 * minimum-deviation edge is integrable, so a bin average needs no
 * floor and no smearing - the SOLAR DISC enters exactly once,
 * downstream, through the limb-darkened convolution the LUT
 * builders apply (optics-lut.js). caustic() above keeps its own
 * disc smear for the legacy gated profiles; feeding ITS output to
 * the LUT convolution would smear the disc twice and widen the
 * dogs by ~sqrt(2), which is the bug this function removes.
 */
export function causticBin(x0, x1) {
  const lo = Math.min(x0, x1);
  const hi = Math.max(x0, x1);
  if (hi <= 0) return 0;
  const a = Math.max(lo, 0);
  const w = hi - lo;
  if (w <= 0) return hi > 0 ? 1 / Math.sqrt(hi) : 0;
  return (2 * (Math.sqrt(hi) - Math.sqrt(a))) / w;
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
  // Basal hexagon, side a = 1: area = 6 x (a x apothem / 2) =
  // 3 sqrt(3) / 2 = 2.598. (Shipped as 3 x apothem / 2 = half of
  // that until the sundog pass's audit - the basal faces entered
  // the flux rejection at HALF their true area, over-weighting
  // side-face transits: the 22-deg ring's absolute phase function
  // read ~1.5x too bright and the 46-deg/pass-through books were
  // mis-split. The gate's re-pinned accounting carries the fix.)
  f.push({n: {x: 0, y: 0, z: 1}, d: HEX_C / 2, area: (3 * Math.sqrt(3)) / 2});
  f.push({n: {x: 0, y: 0, z: -1}, d: HEX_C / 2, area: (3 * Math.sqrt(3)) / 2});
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
export function traceCrystal(n, rng, acceptedCount, ch) {
  const d = randomRotate({x: 0, y: 0, z: 1}, rng); // sun in crystal frame
  // rejection-select the entry face by projected area
  const f = FACES[Math.floor(rng() * 8)];
  const proj = -dot3(d, f.n);
  if (proj <= 0) return null;
  if (rng() * AREA_MAX > f.area * proj) return null;
  // Past the rejections this sample IS one unit of incident flux
  // on the crystal - the absolute accounting counts it here, so
  // Fresnel/TIR losses below stay inside the energy books.
  if (acceptedCount) acceptedCount[ch] += 1;
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
 *
 * ABSOLUTE accounting (the radiometric halo rides it): the entry
 * rejection sampling IS flux weighting - every ACCEPTED sample
 * is one unit of light incident on the crystal's projected area,
 * so per channel the trace also books where that unit went:
 *   accepted - incident units (the geometric-interaction total);
 *   binnedT  - energy landing in the [15, 52] deg histogram;
 *   lowT     - exits deviated under 15 deg (dominated by the
 *              parallel-face pass-through at 0: quasi-direct);
 *   highT    - exits deviated past 52 deg (wide scatter);
 *   lostT    - accepted minus every traced exit: entry/exit
 *              Fresnel reflections and TIR continuations the
 *              2-refraction trace does not follow (they exit
 *              eventually, at angles this histogram cannot
 *              claim - stated, never lumped into the ring).
 * data[b]/accepted / dOmega(b) is then the absolute phase
 * function of the traced channels in sr^-1 per unit
 * geometric-interaction optical depth - the number that retires
 * the halo's display gain (see optics-lut buildHaloLUT).
 */
export function mcHalo(nRGB = ICE_N, samples = 400000, seed = 1337) {
  const g0 = (15 * Math.PI) / 180;
  const g1 = (52 * Math.PI) / 180;
  const bins = 512;
  const data = new Float64Array(bins * 3);
  const accepted = [0, 0, 0];
  const binnedT = [0, 0, 0];
  const lowT = [0, 0, 0];
  const highT = [0, 0, 0];
  for (let ch = 0; ch < nRGB.length; ch++) {
    const rng = mulberry32(seed + ch);
    for (let i = 0; i < samples; i++) {
      const hit = traceCrystal(nRGB[ch], rng, accepted, ch);
      if (!hit) continue;
      const b = Math.floor(((hit.dev - g0) / (g1 - g0)) * bins);
      if (b >= 0 && b < bins) {
        data[b * 3 + ch] += hit.T;
        binnedT[ch] += hit.T;
      } else if (hit.dev < g0) lowT[ch] += hit.T;
      else highT[ch] += hit.T;
    }
  }
  const lostT = accepted.map((a, ch) => a - binnedT[ch] - lowT[ch] - highT[ch]);
  return {g0, g1, bins, data, accepted, binnedT, lowT, highT, lostT};
}

// ---- The oriented plates behind the parhelia ----
// Breon & Dubrulle 2004 (JAS 61, 2888, read in full): POLDER's
// glint-direction reflectance measures the plates directly - "the
// typical effective fraction (area weighted) of oriented plates in
// clouds lies between 10^-3 and 10^-2" (their retrievals: "a
// typical fraction of oriented plates in the range from 0.1 % to
// 1 %"). PLATE_ALPHA carries the printed range's log midpoint,
// the range itself stated; area-weighted IS interaction-share,
// exactly the frame the halo's absolute accounting uses. Their
// tilt statistics - "most retrievals are between 0.4 and 1.5
// degrees", "most Theta are found close to 1 degree", with their
// own Gaussian form f = (1/pi Theta^2) exp(-(theta_n/Theta)^2) -
// give the wobble the drawn dog spreads over, replacing the old
// hand quoted ~1.5 degrees. Their aerodynamic model prints the
// oriented sizes: "the horizontal plate diameters are in the
// range 0.1 to a few millimeters" - PLATE_D_UM is that range's
// log midpoint, and Auer & Veal 1970 (JAS 27, 919, read in full;
// Table 1, code P1a hexagonal plates) turns it into the aspect:
// h = 2.020 d^0.449 (microns). The plate's thinness then does
// real optical work: basal faces dominate its cross-section, so
// only a small computed share of the plate's interaction takes
// the side-to-side prism path - the Monte Carlo below books it.
export const PLATE_ALPHA_RANGE = [1e-3, 1e-2];
export const PLATE_ALPHA = Math.sqrt(
  PLATE_ALPHA_RANGE[0] * PLATE_ALPHA_RANGE[1]
);
export const PLATE_TILT_THETA = Math.PI / 180; // B&D: "close to 1 degree"
export const PLATE_D_RANGE_UM = [100, 3000];
export const PLATE_D_UM = Math.sqrt(PLATE_D_RANGE_UM[0] * PLATE_D_RANGE_UM[1]);
export const PLATE_H_UM = 2.02 * PLATE_D_UM ** 0.449; // Auer-Veal P1a
export const PLATE_C_OVER_A = PLATE_H_UM / (PLATE_D_UM / 2); // ~0.125

// Rodrigues rotation of v about unit axis u by angle t.
function rotAxis(v, u, t) {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const d = dot3(u, v) * (1 - c);
  return {
    x: v.x * c + (u.y * v.z - u.z * v.y) * s + u.x * d,
    y: v.y * c + (u.z * v.x - u.x * v.z) * s + u.y * d,
    z: v.z * c + (u.x * v.y - u.y * v.x) * s + u.z * d
  };
}

/**
 * The parhelion Monte Carlo: the SAME traced hexagonal prism,
 * with the orientation statistics of the plates that actually
 * make sundogs - uniform spin about the vertical, tilt drawn
 * from Breon & Dubrulle's own Gaussian (their eq. 1; Rayleigh in
 * the tilt magnitude), aspect c/a from Auer & Veal's printed
 * plate law at B&D's printed oriented sizes. Sun at elevation h.
 *
 * ABSOLUTE accounting exactly like mcHalo's: entry rejection on
 * projected face area IS flux weighting, so per channel every
 * accepted sample is one unit of light incident on the PLATE's
 * whole projected area (basal faces at their true 3 sqrt(3)/2 -
 * the audit's fix - so the thin plate's basal dominance is in
 * the books). The azimuth histogram over [18, 55] degrees from
 * the sun then divides to sr-free "per radian of azimuth per
 * unit plate-interaction depth"; the vertical spread is RETURNED
 * as moments (sigmaAlt) for the drawn Gaussian - the tilt
 * distribution mapped through the actual refraction, not a
 * hand-doubled mirror rule. data[b]/accepted/dAz x the drawn
 * vertical Gaussian is the dog's absolute surface brightness per
 * unit plate interaction; PLATE_ALPHA converts cloud-column
 * interaction to plate interaction in the amp.
 */
export function mcParhelion(
  h,
  nRGB = ICE_N,
  samples = 400000,
  seed = 4711,
  tiltTheta = PLATE_TILT_THETA,
  dRangeUm = PLATE_D_RANGE_UM
) {
  const a0 = (18 * Math.PI) / 180;
  const a1 = (55 * Math.PI) / 180;
  const bins = 256;
  const data = new Float64Array(bins * 3);
  const accepted = [0, 0, 0];
  const binnedT = [0, 0, 0];
  const lowT = [0, 0, 0];
  const highT = [0, 0, 0];
  const offAlmT = [0, 0, 0];
  const sumY = [0, 0, 0];
  const sumY2 = [0, 0, 0];
  // Per-trial plate: diameter log-uniform over B&D's printed
  // oriented range, aspect from Auer & Veal's law - the
  // POPULATION average, not one resonant slab (a single exact
  // c/a light-pipes with geometric windows that a real size
  // spread washes out; measured: the fixed-aspect share was
  // non-monotone in sun altitude).
  const lnLo = Math.log(dRangeUm[0]);
  const lnHi = Math.log(dRangeUm[1]);
  const sideN = [];
  for (let k = 0; k < 6; k++) {
    const phi = (k * Math.PI) / 3;
    sideN.push({x: Math.cos(phi), y: Math.sin(phi), z: 0});
  }
  const BASAL_AREA = (3 * Math.sqrt(3)) / 2;
  const facePointP = (f, rng, cA) => {
    if (f.n.z !== 0) {
      for (;;) {
        const x = (rng() * 2 - 1) * 1;
        const y = (rng() * 2 - 1) * APOTHEM;
        if (
          Math.abs(y) <= APOTHEM &&
          Math.abs(y + Math.sqrt(3) * x) <= 2 * APOTHEM &&
          Math.abs(y - Math.sqrt(3) * x) <= 2 * APOTHEM
        ) {
          return {x, y, z: f.n.z * (cA / 2)};
        }
      }
    }
    const t = {x: -f.n.y, y: f.n.x, z: 0};
    const u = rng() - 0.5;
    const v = (rng() - 0.5) * cA;
    return {x: f.n.x * f.d + t.x * u, y: f.n.y * f.d + t.y * u, z: v};
  };
  // Photon direction in the world: sun at elevation h, azimuth 0.
  const w = {x: Math.cos(h), y: 0, z: -Math.sin(h)};
  for (let ch = 0; ch < nRGB.length; ch++) {
    const n = nRGB[ch];
    const rng = mulberry32(seed + ch);
    for (let i = 0; i < samples; i++) {
      // This trial's plate from the printed population.
      const dUm = Math.exp(lnLo + rng() * (lnHi - lnLo));
      const cA = (2.02 * dUm ** 0.449) / (dUm / 2);
      const faces = [];
      for (const nn of sideN) faces.push({n: nn, d: APOTHEM, area: cA});
      faces.push({n: {x: 0, y: 0, z: 1}, d: cA / 2, area: BASAL_AREA});
      faces.push({n: {x: 0, y: 0, z: -1}, d: cA / 2, area: BASAL_AREA});
      const areaMax = BASAL_AREA;
      // Orientation: tilt theta_n (Rayleigh from B&D's Gaussian)
      // about a horizontal axis at uniform psi, spin phi about
      // the crystal axis.
      const thN = tiltTheta * Math.sqrt(-Math.log(Math.max(rng(), 1e-12)));
      const psi = rng() * 2 * Math.PI;
      const phi = rng() * 2 * Math.PI;
      const axis = {x: Math.cos(psi), y: Math.sin(psi), z: 0};
      // world -> crystal: untilt, then unspin
      const dTilt = rotAxis(w, axis, -thN);
      const cph = Math.cos(-phi);
      const sph = Math.sin(-phi);
      const dC = {
        x: dTilt.x * cph - dTilt.y * sph,
        y: dTilt.x * sph + dTilt.y * cph,
        z: dTilt.z
      };
      // flux-correct entry face
      const f = faces[Math.floor(rng() * 8)];
      const proj = -dot3(dC, f.n);
      if (proj <= 0) continue;
      if (rng() * areaMax > f.area * proj) continue;
      accepted[ch] += 1;
      const rin = refract(dC, f.n, 1, n);
      if (!rin) continue;
      // The internal walk FOLLOWS total internal reflections (up
      // to 12 face events): in a thin plate the skew ray reaches
      // the alternate side face by light-piping between the basal
      // faces - beyond ~10 degrees of sun the basal incidence
      // sits past the critical angle, the bounce is LOSSLESS, the
      // azimuthal (Bravais) deviation is untouched and the
      // vertical cosine flips sign per bounce. Greenler's own
      // parhelion mechanism at elevation; without it thin plates
      // could draw dogs only at grazing sun. Partial reflections
      // at transmitting faces stay untraced (the lost bucket, as
      // in mcHalo).
      let dir = rin.dir;
      let Tacc = rin.T;
      let p = facePointP(f, rng, cA);
      let out = null;
      for (let ev = 0; ev < 12; ev++) {
        let tMin = Infinity;
        let fOut = null;
        for (const g of faces) {
          const dn = dot3(dir, g.n);
          if (dn <= 1e-12) continue;
          const t = (g.d - dot3(p, g.n)) / dn;
          if (t > 1e-9 && t < tMin) {
            tMin = t;
            fOut = g;
          }
        }
        if (!fOut) break;
        p = {
          x: p.x + dir.x * tMin,
          y: p.y + dir.y * tMin,
          z: p.z + dir.z * tMin
        };
        const rout = refract(
          dir,
          {x: -fOut.n.x, y: -fOut.n.y, z: -fOut.n.z},
          n,
          1
        );
        if (rout) {
          out = {dir: rout.dir, T: Tacc * rout.T};
          break;
        }
        // TIR: lossless mirror, walk on.
        const dn = dot3(dir, fOut.n);
        dir = {
          x: dir.x - 2 * dn * fOut.n.x,
          y: dir.y - 2 * dn * fOut.n.y,
          z: dir.z - 2 * dn * fOut.n.z
        };
      }
      if (!out) continue;
      // crystal -> world: spin, then tilt
      const oc = out.dir;
      const cph2 = Math.cos(phi);
      const sph2 = Math.sin(phi);
      const oSpun = {
        x: oc.x * cph2 - oc.y * sph2,
        y: oc.x * sph2 + oc.y * cph2,
        z: oc.z
      };
      const oW = rotAxis(oSpun, axis, thN);
      // Apparent sky positions: the source (-w) sits at azimuth
      // pi, altitude h in this frame; the exit light appears from
      // -oW. Azimuth offset wrapped about the sun's, mirror pair
      // folded.
      const alt = Math.asin(Math.min(Math.max(-oW.z, -1), 1));
      let dAzS = Math.atan2(-oW.y, -oW.x) - Math.PI;
      if (dAzS > Math.PI) dAzS -= 2 * Math.PI;
      if (dAzS < -Math.PI) dAzS += 2 * Math.PI;
      const dAz = Math.abs(dAzS);
      const dAlt = alt - h;
      const T = out.T;
      // The DOG books take only light near the sun's almucantar:
      // side-to-side transits keep the vertical direction cosine
      // (vertical faces conserve it, the tilt wobble moves it by
      // ~Theta), while side-to-basal transits land the same
      // azimuth window tens of degrees off in altitude (the 46
      // family and the subparhelion region - real light, OTHER
      // optics: booked offAlm, stated, never in the dog).
      if (dAz >= a0 && dAz < a1 && Math.abs(dAlt) < (5 * Math.PI) / 180) {
        const b = Math.floor(((dAz - a0) / (a1 - a0)) * bins);
        data[b * 3 + ch] += T;
        binnedT[ch] += T;
        sumY[ch] += T * dAlt;
        sumY2[ch] += T * dAlt * dAlt;
      } else if (dAz >= a0 && dAz < a1) offAlmT[ch] += T;
      else if (dAz < a0) lowT[ch] += T;
      else highT[ch] += T;
    }
  }
  const lostT = accepted.map(
    (a, ch) => a - binnedT[ch] - lowT[ch] - highT[ch] - offAlmT[ch]
  );
  const sigmaAlt = binnedT.map((B, ch) => {
    if (B <= 0) return 0;
    const m = sumY[ch] / B;
    return Math.sqrt(Math.max(sumY2[ch] / B - m * m, 0));
  });
  return {
    a0,
    a1,
    bins,
    data,
    accepted,
    binnedT,
    lowT,
    highT,
    offAlmT,
    lostT,
    sigmaAlt
  };
}

// The parhelion's share of the PLATE's geometric interaction and
// the drawn dog's vertical spread, tabulated from mcParhelion at
// 600k samples per altitude (deterministic seed 4711; green
// channel - the share is achromatic within the MC noise, colour
// lives in the caustic profile). The gate RE-RUNS the Monte Carlo
// at three altitudes and holds these literals to it - shipped
// numbers that cannot drift from the code that made them. The
// grazing spike (a low plate is almost a pure prism to a low sun)
// and the monotone fade to the ~57-degree Bravais cutoff both
// EMERGE from the traced geometry; the fade is why real dogs die
// as the sun climbs. Linear interpolation between rows; zero past
// the end.
// ---- the occurrence of the ring family ----
// Forster et al. 2017 (AMT 10, 2499, read in full - the HaloCam
// climatology): "during the campaign about 27% of the cirrus
// clouds produced 22 deg halos, sundogs or upper tangent arcs"
// (ACCEPT, visual evaluation - the instantaneous family rate),
// and the automated algorithm's "about 25% of the detected
// cirrus clouds occurred together with a 22 deg halo". The other
// ~3/4 of cirrus is rough/aggregate-dominated and rings NOT AT
// ALL - drawing every veil with a ring overdrew the occurrence
// statistic (the SCF comment's own documented gap; the retrieved
// 37% smooth fraction was measured ON halo images, so scoping
// the ring to halo-producing scenes also uses that number in its
// own population). The drawn model: a DETERMINISTIC per-site,
// per-UTC-hour draw at the printed instantaneous rate - the same
// sky for every visitor and every harness run, a new draw each
// hour (displays come and go on cirrus advection timescales),
// with a 5-minute ramp at the boundary so rings fade in rather
// than pop. Documented limit, printed in the same paper: 1-hour
// BINNED statistics read higher ("more than 50%"; Sassen et al.
// 2003's 54% of cirrus hours, as printed there) because real
// displays flicker within the hour - the binary hour gate holds
// the instantaneous rate exact and underdraws the binned one; a
// within-hour intermittency model stays named.
export const HALO_FAMILY_FRACTION = 0.27;
function hourDraw(latQ, lonQ, hourIdx) {
  // One mulberry32 draw per (site, hour) - quantized site so a
  // pan across a town does not reroll the sky.
  const seed =
    (Math.imul(latQ + 900, 2654435761) ^
      Math.imul(lonQ + 1800, 40503) ^
      Math.imul(hourIdx, 668265263)) >>>
    0;
  return mulberry32(seed)() < HALO_FAMILY_FRACTION;
}
export function haloOccurrence(latDeg, lonDeg, utcMs) {
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg)) return 0;
  if (!Number.isFinite(utcMs)) return 0;
  const latQ = Math.round(latDeg * 10);
  const lonQ = Math.round(lonDeg * 10);
  const hour = Math.floor(utcMs / 3600e3);
  const cur = hourDraw(latQ, lonQ, hour) ? 1 : 0;
  const prev = hourDraw(latQ, lonQ, hour - 1) ? 1 : 0;
  const minIn = (utcMs / 3600e3 - hour) * 60;
  const f = Math.min(Math.max(minIn / 5, 0), 1);
  return prev + (cur - prev) * f;
}

export const PARHELION_ALT_DEG = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
export const PARHELION_SHARE = [
  0.46593, 0.1363, 0.07013, 0.06406, 0.06236, 0.05291, 0.04016, 0.02912,
  0.02142, 0.01464, 0.00794, 0.00231
];
export const PARHELION_SIGMA_ALT_DEG = [
  0.756, 0.321, 0.338, 0.344, 0.359, 0.377, 0.408, 0.433, 0.483, 0.53, 0.584,
  0.448
];
function lerpTable(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const f = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return ys[i - 1] + f * (ys[i] - ys[i - 1]);
    }
  }
  return 0;
}
export function parhelionShare(hRad) {
  const d = (hRad * 180) / Math.PI;
  if (d < 0 || d > 57.5) return 0;
  return d > 55
    ? (PARHELION_SHARE[11] * (57.5 - d)) / 2.5
    : lerpTable(PARHELION_ALT_DEG, PARHELION_SHARE, d);
}
export function parhelionSigmaAlt(hRad) {
  const d = Math.min(Math.max((hRad * 180) / Math.PI, 0), 55);
  return (
    (lerpTable(PARHELION_ALT_DEG, PARHELION_SIGMA_ALT_DEG, d) * Math.PI) / 180
  );
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
  for (let ch = 0; ch < 3; ch++) {
    const n = ICE_N[ch];
    const np = bravais(n, h);
    const Dm = prismDmin(np, PRISM_60);
    if (Dm == null) continue;
    const T = prismThroughput(np, PRISM_60);
    // The Bravais minimum deviation is the deviation of the
    // HORIZONTAL projection - vertical side faces conserve the
    // vertical direction cosine, so the whole deflection is a
    // rotation about the vertical and the caustic sits at
    // AZIMUTH offset Dm from the sun, directly. (Shipped until
    // the sundog pass as gc(az) = Dm - the great-circle
    // conversion pushed the drawn dog outward with altitude,
    // ~1.6 deg at a 20-degree sun, ~4 at 35; the plate Monte
    // Carlo's independent vector-Snell trace lands the caustic
    // at Dm in azimuth at every altitude and arbitrated the
    // convention. Tape's printed positions agree.)
    const hbin = (a1 - a0) / (samples - 1) / 2;
    for (let i = 0; i < samples; i++) {
      const az = a0 + ((a1 - a0) * i) / (samples - 1);
      // Exact bin average of the RAW 1/sqrt caustic over this
      // sample's cell - no disc smear here; the limb-darkened
      // solar convolution is applied exactly once by the LUT
      // builder (see causticBin).
      const x0 = Math.max(az - hbin, a0) - Dm;
      const x1 = Math.min(az + hbin, a1) - Dm;
      const v = T * causticBin(x0, x1);
      if (v > 0) any = true;
      data[3 * i + ch] += v;
    }
  }
  let peak = 0;
  for (const v of data) peak = Math.max(peak, v);
  if (peak > 0) for (let i = 0; i < data.length; i++) data[i] /= peak;
  return {a0, a1, n: samples, data, any};
}
