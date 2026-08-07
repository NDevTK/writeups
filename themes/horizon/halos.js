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
  dRangeUm = PLATE_D_RANGE_UM,
  maxEv = 40
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
  // The externally reflected family: the parhelic circle's
  // almucantar histogram over |dAz| in [0, pi] plus its vertical
  // moments, and the off-almucantar remainder (pillar family).
  const circleBins = 128;
  const circleData = new Float64Array(circleBins * 3);
  const circleT = [0, 0, 0];
  const circleY = [0, 0, 0];
  const circleY2 = [0, 0, 0];
  const reflOffAlmT = [0, 0, 0];
  // The pillar sub-bucket of reflOffAlmT: apparent-altitude
  // histogram (dAlt in [-15, +15] degrees) of reflections within
  // 3 degrees of the sun's azimuth, plus azimuth moments for the
  // drawn column's width.
  const pillarBins = 128;
  const pillarData = new Float64Array(pillarBins * 3);
  const pillarT = [0, 0, 0];
  const pillarAz = [0, 0, 0];
  const pillarAz2 = [0, 0, 0];
  // The TRANSMITTED basal-entry families on the almucantar (the
  // parhelic circle's internal light): enter the top basal face,
  // light-pipe with k side-mirror TIR events, exit the bottom -
  // both basal refractions cancel, so the exit rides the sun's
  // almucantar at the k-fold azimuth. k = 1 is the TIR-bright
  // inner circle with the blue-spot cutoff; k = 2 off adjacent
  // faces is the 120-degree parhelion (the corner reflector);
  // k = 0 is the straight-through forward beam (booked, not
  // drawn - it IS the disc's transmitted image). Same [0, pi]
  // azimuth grid as the reflected circle.
  const trans1Data = new Float64Array(circleBins * 3);
  const trans2Data = new Float64Array(circleBins * 3);
  const trans1T = [0, 0, 0];
  const trans2T = [0, 0, 0];
  const transThroughT = [0, 0, 0];
  const transOffAlmT = [0, 0, 0];
  const transY = [0, 0, 0];
  const transY2 = [0, 0, 0];
  // The 120-degree spot's azimuth moments about 2 pi / 3 (the
  // corner-reflector angle) - its drawn width.
  const trans2Az = [0, 0, 0];
  const trans2Az2 = [0, 0, 0];
  // The 90-degree-wedge ARCS, booked by their transit routes:
  // basal entry + SIDE exit rising = the CIRCUMZENITHAL ARC
  // (azimuth fold histogram + apparent-altitude moments - the
  // altitude is the closed form asin(sqrt(n^2 - cos^2 h)), the
  // dispersion pure vertical); side entry + BASAL exit = the
  // CIRCUMHORIZONTAL ARC family (asin(sqrt(1 + sin^2 h - n^2)),
  // open only past ~58 deg of sun).
  const czaData = new Float64Array(circleBins * 3);
  const czaT = [0, 0, 0];
  const czaAltS = [0, 0, 0];
  const czaAltS2 = [0, 0, 0];
  const chaData = new Float64Array(circleBins * 3);
  const chaT = [0, 0, 0];
  const chaAltS = [0, 0, 0];
  const chaAltS2 = [0, 0, 0];
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
      // The EXTERNALLY REFLECTED share of this entry - Fresnel's
      // 1 - T off the entry face, no extra rng draws (the shipped
      // share table stays bit-identical). A vertical side face
      // conserves the vertical direction cosine, so its
      // reflection lands ON the almucantar at some azimuth: the
      // PARHELIC CIRCLE's light, booked into its own histogram.
      // Basal-face reflections (the sun-pillar family) and
      // tilt-strayed side reflections land off the almucantar -
      // booked reflOffAlmT, stated, not drawn here.
      {
        const wR = 1 - rin.T;
        const dnR = dot3(dC, f.n);
        const dR = {
          x: dC.x - 2 * dnR * f.n.x,
          y: dC.y - 2 * dnR * f.n.y,
          z: dC.z - 2 * dnR * f.n.z
        };
        const cphR = Math.cos(phi);
        const sphR = Math.sin(phi);
        const rSpun = {
          x: dR.x * cphR - dR.y * sphR,
          y: dR.x * sphR + dR.y * cphR,
          z: dR.z
        };
        const rW = rotAxis(rSpun, axis, thN);
        const altR = Math.asin(Math.min(Math.max(-rW.z, -1), 1));
        let dAzR = Math.atan2(-rW.y, -rW.x) - Math.PI;
        if (dAzR > Math.PI) dAzR -= 2 * Math.PI;
        if (dAzR < -Math.PI) dAzR += 2 * Math.PI;
        const azAbs = Math.abs(dAzR);
        if (Math.abs(altR - h) < (5 * Math.PI) / 180) {
          const b = Math.floor((azAbs / Math.PI) * circleBins);
          if (b >= 0 && b < circleBins) {
            circleData[b * 3 + ch] += wR;
            circleT[ch] += wR;
            circleY[ch] += wR * (altR - h);
            circleY2[ch] += wR * (altR - h) * (altR - h);
          }
        } else {
          reflOffAlmT[ch] += wR;
          // The PILLAR: basal-face reflections near the sun's own
          // azimuth, off the almucantar - the tilt distribution
          // through the horizontal mirror. Histogram over the
          // apparent altitude around the sun (a sub-bucket of
          // reflOffAlmT - the books above are untouched).
          if (azAbs < (3 * Math.PI) / 180) {
            const dA = altR - h;
            const pb = Math.floor(
              ((dA + (15 * Math.PI) / 180) / ((30 * Math.PI) / 180)) *
                pillarBins
            );
            if (pb >= 0 && pb < pillarBins) {
              pillarData[pb * 3 + ch] += wR;
              pillarT[ch] += wR;
              pillarAz[ch] += wR * azAbs;
              pillarAz2[ch] += wR * azAbs * azAbs;
            }
          }
        }
      }
      // The internal walk FOLLOWS total internal reflections (up
      // to maxEv face events - 40 default: the near-sun circle
      // folds are grazing side approaches that light-pipe the
      // longest, and a 12-event cap measurably starved them; the
      // gate holds the shape's cap convergence): in a thin plate
      // the skew ray reaches
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
      const basalEntry = f.n.z !== 0;
      let kSide = 0;
      for (let ev = 0; ev < maxEv; ev++) {
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
          out = {dir: rout.dir, T: Tacc * rout.T, exitBasal: fOut.n.z !== 0};
          break;
        }
        // TIR: lossless mirror, walk on. Side-face mirrors fold
        // the azimuth (counted - the k of the circle families);
        // basal mirrors only flip the vertical cosine.
        if (fOut.n.z === 0) kSide++;
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
      // BASAL-ENTRY transits are the circle families, booked by
      // their side-mirror count; they no longer leak into the dog
      // books (the shipped share/sigma tables were re-derived
      // with the entry-face scoping - the old books carried a
      // few-percent basal-entry contamination in the window).
      if (basalEntry) {
        if (!out.exitBasal) {
          // side exit: the CZA when it rises (the subhorizon
          // mirror-image stays a stated bucket)
          if (alt > 0) {
            const b = Math.min(
              Math.floor((dAz / Math.PI) * circleBins),
              circleBins - 1
            );
            czaData[b * 3 + ch] += T;
            czaT[ch] += T;
            czaAltS[ch] += T * alt;
            czaAltS2[ch] += T * alt * alt;
          } else transOffAlmT[ch] += T;
        } else if (Math.abs(dAlt) < (5 * Math.PI) / 180) {
          if (kSide === 0) transThroughT[ch] += T;
          else {
            const b = Math.min(
              Math.floor((dAz / Math.PI) * circleBins),
              circleBins - 1
            );
            (kSide === 1 ? trans1Data : trans2Data)[b * 3 + ch] += T;
            (kSide === 1 ? trans1T : trans2T)[ch] += T;
            transY[ch] += T * dAlt;
            transY2[ch] += T * dAlt * dAlt;
            if (kSide !== 1) {
              const dA2 = dAz - (2 * Math.PI) / 3;
              trans2Az[ch] += T * dA2;
              trans2Az2[ch] += T * dA2 * dA2;
            }
          }
        } else transOffAlmT[ch] += T;
        continue;
      }
      // SIDE-ENTRY basal exits are the circumhorizontal family -
      // booked before the window tests (they land ~46 deg under
      // the source, never near the dog books).
      if (out.exitBasal) {
        const b = Math.min(
          Math.floor((dAz / Math.PI) * circleBins),
          circleBins - 1
        );
        chaData[b * 3 + ch] += T;
        chaT[ch] += T;
        chaAltS[ch] += T * alt;
        chaAltS2[ch] += T * alt * alt;
        continue;
      }
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
    (a, ch) =>
      a -
      binnedT[ch] -
      lowT[ch] -
      highT[ch] -
      offAlmT[ch] -
      circleT[ch] -
      reflOffAlmT[ch] -
      trans1T[ch] -
      trans2T[ch] -
      transThroughT[ch] -
      transOffAlmT[ch] -
      czaT[ch] -
      chaT[ch]
  );
  const sigmaAlt = binnedT.map((B, ch) => {
    if (B <= 0) return 0;
    const m = sumY[ch] / B;
    return Math.sqrt(Math.max(sumY2[ch] / B - m * m, 0));
  });
  const circleSigmaAlt = circleT.map((B, ch) => {
    if (B <= 0) return 0;
    const m = circleY[ch] / B;
    return Math.sqrt(Math.max(circleY2[ch] / B - m * m, 0));
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
    sigmaAlt,
    circleBins,
    circleData,
    circleT,
    reflOffAlmT,
    circleSigmaAlt,
    pillarBins,
    pillarData,
    pillarT,
    pillarAz,
    pillarAz2,
    trans1Data,
    trans2Data,
    trans1T,
    trans2T,
    transThroughT,
    transOffAlmT,
    trans2Az,
    trans2Az2,
    czaData,
    czaT,
    czaAltS,
    czaAltS2,
    chaData,
    chaT,
    chaAltS,
    chaAltS2,
    transSigmaAlt: [0, 1, 2].map((c) => {
      const B = trans1T[c] + trans2T[c];
      if (B <= 0) return 0;
      const mB = transY[c] / B;
      return Math.sqrt(Math.max(transY2[c] / B - mB * mB, 0));
    })
  };
}

// ---- the parhelic circle, analytically ----
// External reflection off the oriented plates' VERTICAL side
// faces: the mirror conserves the vertical direction cosine, so
// every reflection lands on the sun's almucantar - the white
// circle. With the spin uniform, the face-normal azimuth psi is
// uniform; the mirror law folds it to the apparent azimuth
// offset dAz = 2 psi - pi, so psi = (dAz + pi)/2 and the
// incidence obeys cos i = cos h sin(dAz/2): GRAZING mirrors
// (rho -> 1) send light next to the sun where the dogs already
// live, NEAR-NORMAL mirrors (rho small) to the anthelic point.
// Per unit of the plate's geometric interaction, per radian of
// azimuth (both mirror-image faces fold into [0, pi]; the
// vertical spread is the tilt Gaussian through the mirror,
// carried separately). BOTH faces of the mirror pair (+-psi)
// fold into the same |dAz|, so the pair doubles the one-branch
// Jacobian:
//     P(dAz) = <c> cos h sin(dAz/2) rho(cos h sin(dAz/2))
//              / A_tot(h),
// A_tot(h) = (3 sqrt(3)/2) sin h + (6/pi) <c> cos h the
// spin-averaged projected area (one basal + the side ring), <c>
// the population-mean aspect over B&D's printed size range
// through Auer & Veal's law. The Monte Carlo's own reflected
// books hold this closed form (gate landmark) - and the circle
// comes out WHITE: rho barely moves across the ice indices
// (landmark holds the channel spread to ~1%).
export function plateMeanC(dRangeUm = PLATE_D_RANGE_UM, M = 4000) {
  const lnLo = Math.log(dRangeUm[0]);
  const lnHi = Math.log(dRangeUm[1]);
  let s = 0;
  for (let i = 0; i < M; i++) {
    const d = Math.exp(lnLo + ((i + 0.5) / M) * (lnHi - lnLo));
    s += (2.02 * d ** 0.449) / (d / 2);
  }
  return s / M;
}
export function plateProjArea(h, meanC = plateMeanC()) {
  return (
    ((3 * Math.sqrt(3)) / 2) * Math.max(Math.sin(h), 0) +
    (6 / Math.PI) * meanC * Math.max(Math.cos(h), 0)
  );
}
export function parhelicCircleProfile(h, thetasRad, nIce = ICE_N) {
  const meanC = plateMeanC();
  const A = plateProjArea(h, meanC);
  return nIce.map((n) =>
    thetasRad.map((dAz) => {
      const s = Math.sin(Math.min(Math.max(dAz, 0), Math.PI) / 2);
      const ci = Math.cos(h) * s;
      if (!(ci > 0) || !(A > 0)) return 0;
      const rho = 1 - fresnelT(ci, n);
      return (meanC * Math.cos(h) * s * rho) / A;
    })
  );
}
// The drawn circle's vertical spread: the reflected family's own
// sigmaAlt from the plate Monte Carlo - the printed ~1-degree
// tilt through the actual mirror geometry - measured flat in sun
// altitude (0.83-0.85 deg over h 10-30); the gate re-derives it
// and holds this literal.
export const CIRCLE_SIGMA_ALT_DEG = 0.84;

// ---- the sun pillar / subsun, analytically ----
// External reflection off the SAME oriented plates' BASAL faces:
// the horizontal mirror images the source at altitude -h. B&D's
// tilt density f = (1/pi Theta^2) exp(-theta_n^2 / Theta^2) has
// per-component sigma Theta/sqrt(2) and the mirror doubles the
// in-plane component, so the image is a vertical Gaussian of
// sigma sqrt(2) Theta about -h - the plate Monte Carlo's own
// reflected books measure exactly this (rms 1.40 deg at h = 5 vs
// sqrt(2) x 1 deg). Azimuthally the out-of-plane component b
// deflects the grazing ray by only 2 b tan|h| (in the mirror
// plane the graze is blind to the sideways tilt - the MC holds
// the folded-Gaussian moments to two digits), so the crystal's
// azimuth spread DIES at the horizon and the drawn column's
// width is the source disc's own (optics-lut buildPillarLUT
// carries the limb-darkened marginal through this sigma). The
// share of the plate's geometric interaction is the top basal
// face's projected area times the grazing Fresnel reflectance:
//     share(h) = (3 sqrt(3)/2) sin|h| rho(sin|h|) / A_tot(|h|),
// MC-held at the few-percent level (the tilt's curvature of
// sin h and of the grazing Fresnel is the residual). Above the
// horizon the column survives only while the Gaussian's upper
// tail clears alt 0 - share x (1 - Phi(h / sigma)): the pillar
// is a HORIZON optic, peaking near h ~ 1 deg, gone by ~5 (the
// gate pins the emergence). h < 0 mirrors: the photon enters the
// LOWER basal face and the image lands at +|h| ABOVE the horizon
// - the twilight pillar's geometry, in the same books (the MC
// runs it unchanged; the drawn feed still needs the deck's own
// twilight illumination, a named limit).
export const PILLAR_SIGMA_ALT = Math.SQRT2 * PLATE_TILT_THETA;
// The basal projection is TILT-FOLDED: the beam's sine on the
// tilted normal is x = sin|h| + t cos h with t the Gaussian tilt
// component (sigma Theta/sqrt(2) - the same linearised model the
// image Gaussian above rides). The opposite tilt sign presents
// the OTHER basal face - the same mirror plane - so the glint
// folds |x|: E[|x|] = sigma sqrt(2/pi) > 0 at the horizon and
// the pillar is CONTINUOUS through sunset, where the flat-plate
// sin|h| died wrongly. Numerator and flux denominator both fold;
// the Fresnel rides inside the fold (no Jensen shortcut -
// grazing rho curves hard). A 48-point quadrature over the tilt
// component; the gate holds it against a direct orientation
// Monte Carlo.
export function pillarShare(h, nRGB = ICE_N) {
  if (!Number.isFinite(h)) return nRGB.map(() => 0);
  const m = Math.abs(Math.sin(h));
  const ch = Math.abs(Math.cos(h));
  const sig = (PLATE_TILT_THETA / Math.SQRT2) * ch;
  const A_side = (6 / Math.PI) * plateMeanC() * ch;
  const B = (3 * Math.sqrt(3)) / 2;
  const N = 48;
  let eProj = 0;
  const eRho = nRGB.map(() => 0);
  for (let i = 0; i < N; i++) {
    const z = -5 + (10 * (i + 0.5)) / N;
    const w = Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI);
    const ax = Math.abs(m + sig * z);
    if (ax <= 0) continue;
    const ci = Math.min(ax, 1);
    eProj += w * ax;
    for (let c = 0; c < nRGB.length; c++)
      eRho[c] += w * ax * (1 - fresnelT(ci, nRGB[c]));
  }
  const dz = 10 / N;
  eProj *= dz;
  const A = B * eProj + A_side;
  if (!(A > 0)) return nRGB.map(() => 0);
  return eRho.map((r) => (B * r * dz) / A);
}
// The crystal part of the column's azimuth sigma (radians).
export function pillarAzSigma(h, tiltTheta = PLATE_TILT_THETA) {
  return Math.SQRT2 * tiltTheta * Math.abs(Math.tan(h));
}

// Unpolarised Fresnel transmittance into index n at cos(i) = ci -
// the same formula refract() applies, exposed for the analytic
// circle (and its landmark) without a vector trace.
function fresnelT(ci, n) {
  const cost = Math.sqrt(Math.max(1 - (1 - ci * ci) / (n * n), 0));
  const rs = (ci - n * cost) / (ci + n * cost);
  const rp = (n * ci - cost) / (n * ci + cost);
  return 1 - (rs * rs + rp * rp) / 2;
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
// The EPISODE process (the occurrence pass's documented 1-h
// binning limit, resolved): Forster 2017 prints BOTH ends of
// the intermittency - the instantaneous family rate (27% of
// cirrus) AND "the fraction of halo-producing cirrus clouds
// increases to more than 50% if the HaloCam observations are
// binned to 1 h intervals" (Sassen et al. 2003's 54% of 1-h
// cirrus periods corroborating). A single per-hour draw cannot
// satisfy both. The process here: cosine-interpolated value
// noise on a node grid, pushed through its own EXACT trapezoid
// CDF - the instantaneous marginal is exactly uniform at every
// phase, so thresholding at the printed 0.27 pins the
// instantaneous rate BY CONSTRUCTION - and the node spacing is
// the one derived constant, fit so the 1-h binned any-on rate
// lands in the printed band (43 min -> 0.538, between the
// paper's own > 0.50 and Sassen's 0.54; mean episode ~53 min).
// Deterministic per quantized site; continuous in time (the
// old hour-boundary ramp is retired - the threshold crossing
// itself ramps over ~2 minutes of the smooth field).
export const HALO_EPISODE_NODE_MIN = 43;
function episodeNode(latQ, lonQ, k) {
  const seed =
    (Math.imul(latQ + 900, 2654435761) ^
      Math.imul(lonQ + 1800, 40503) ^
      Math.imul(k, 668265263)) >>>
    0;
  return mulberry32(seed)();
}
// CDF of w U1 + (1 - w) U2 (trapezoid) - maps the lerped noise
// back to an exactly uniform variate at every phase.
function trapCDF(x, w) {
  const a = Math.min(w, 1 - w);
  const b = Math.max(w, 1 - w);
  if (a === 0) return Math.min(Math.max(x, 0), 1);
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (x < a) return (x * x) / (2 * a * b);
  if (x < b) return (2 * x - a) / (2 * b);
  const y = 1 - x;
  return 1 - (y * y) / (2 * a * b);
}
export function haloOccurrence(latDeg, lonDeg, utcMs) {
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg)) return 0;
  if (!Number.isFinite(utcMs)) return 0;
  const latQ = Math.round(latDeg * 10);
  const lonQ = Math.round(lonDeg * 10);
  const s = utcMs / 60000 / HALO_EPISODE_NODE_MIN;
  const k = Math.floor(s);
  const f = s - k;
  const ca = (1 - Math.cos(Math.PI * f)) / 2;
  const x =
    (1 - ca) * episodeNode(latQ, lonQ, k) + ca * episodeNode(latQ, lonQ, k + 1);
  const u = trapCDF(x, 1 - ca);
  // Soft edge at the threshold crossing (~2 min of the field's
  // drift): no pop, and the >0.5 rate stays the printed one.
  return Math.min(Math.max((HALO_FAMILY_FRACTION - u) / 0.01 + 0.5, 0), 1);
}

export const PARHELION_ALT_DEG = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
// Re-derived with the ENTRY-FACE scoping and the 40-event walk
// (the internal-circle pass): the dog books are side-entry pure
// now - the old rows carried a few-percent basal-entry leak in
// the window (up to 5% at h = 20, and MOST of the h = 55 row,
// where the true side-entry dogs are nearly dead) - and the
// longer light-pipe recovers the grazing tails the 12-event cap
// starved (+3% at h = 25, converged against an 80-event run).
export const PARHELION_SHARE = [
  0.48229, 0.13604, 0.06902, 0.06234, 0.06021, 0.051, 0.03884, 0.02801, 0.02095,
  0.0143, 0.00691, 0.00037
];
export const PARHELION_SIGMA_ALT_DEG = [
  0.616, 0.32, 0.333, 0.338, 0.357, 0.372, 0.405, 0.424, 0.49, 0.549, 0.624,
  0.469
];
// The TRANSMITTED basal-entry circle families (the plate MC's
// own books, same 400k derivation): the k = 1 side-mirror share
// per channel (TIR-bright, the blue-spot cutoff lives in the
// SHAPE - circleInternalProfile), the 120-degree corner share
// (k = 2 adjacent faces, white), the families' vertical sigma,
// and the corner spot's azimuth sigma (tilt-driven; empty rows
// at the tails are below the derivation's statistics and lerp
// to the neighbours harmlessly - the shares there are 1e-5).
export const CIRCLE_INT_SHARE_R = [
  0.00004, 0.00332, 0.01056, 0.0183, 0.0238, 0.02889, 0.0362, 0.04577, 0.04115,
  0.03697, 0.03275, 0.02738
];
export const CIRCLE_INT_SHARE_G = [
  0.00003, 0.00327, 0.01007, 0.01746, 0.02337, 0.02928, 0.03688, 0.04376,
  0.04037, 0.03651, 0.03204, 0.02704
];
export const CIRCLE_INT_SHARE_B = [
  0.00005, 0.00302, 0.01001, 0.01763, 0.0245, 0.02976, 0.03974, 0.04327,
  0.03938, 0.03612, 0.03189, 0.02712
];
export const CIRCLE_INT_120_SHARE = [
  0, 0.000053, 0.000127, 0.00019, 0.000232, 0.000195, 0.00016, 0.00013,
  0.000052, 0.000016, 0, 0
];
export const CIRCLE_INT_SIGMA_ALT_DEG = [
  1.305, 0.878, 0.892, 0.942, 0.984, 1.035, 1.108, 1.157, 1.164, 1.148, 1.143,
  1.14
];
export const CIRCLE_INT_120_SIGMA_DEG = [
  0.052, 0.052, 0.239, 0.422, 0.536, 0.634, 0.72, 0.805, 0.553, 0.553, 0.553,
  0.553
];
// The 90-degree-wedge arcs' MC shares (600k, same derivation):
// per channel - the WINDOW EDGES stagger by dispersion, blue
// dying first at the CZA's top (h ~ 30: R 0.85% > G 0.59% > B
// 0.37%) and red opening the CHA first (h = 58: R 2.1% >> B
// 0.2%) - and the tilt sigma of the drawn band (green; inflated
// rows at the window edges are the edge smear itself).
export const CZA_SHARE_R = [
  0.00024, 0.00973, 0.01795, 0.02141, 0.02096, 0.01636, 0.00845, 0, 0, 0, 0, 0
];
export const CZA_SHARE_G = [
  0.00023, 0.00811, 0.01618, 0.02032, 0.01912, 0.01478, 0.0059, 0, 0, 0, 0, 0
];
export const CZA_SHARE_B = [
  0.00027, 0.00833, 0.01612, 0.01947, 0.01876, 0.01394, 0.00372, 0, 0, 0, 0, 0
];
export const CZA_SIGMA_ALT_DEG = [
  0.548, 0.534, 0.43, 0.351, 0.283, 0.397, 1.12, 1.12, 1.12, 1.12, 1.12, 1.12
];
export const CHA_ALT_DEG = [55, 58, 60, 63, 66, 70, 75, 80, 85, 90];
export const CHA_SHARE_R = [
  0, 0.02106, 0.03506, 0.03609, 0.03235, 0.02585, 0.01756, 0.00946, 0.00317,
  0.00016
];
export const CHA_SHARE_G = [
  0, 0.01105, 0.03324, 0.03607, 0.03324, 0.02689, 0.01853, 0.01014, 0.00324,
  0.00015
];
export const CHA_SHARE_B = [
  0, 0.00183, 0.02566, 0.03389, 0.03173, 0.02598, 0.01783, 0.00959, 0.00311,
  0.00014
];
export const CHA_SIGMA_ALT_DEG = [
  1.577, 1.577, 1.142, 0.503, 0.312, 0.277, 0.358, 0.467, 0.591, 0.453
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
export function circleIntShare(hRad) {
  const d = Math.min(Math.max((hRad * 180) / Math.PI, 0), 55);
  return [CIRCLE_INT_SHARE_R, CIRCLE_INT_SHARE_G, CIRCLE_INT_SHARE_B].map((t) =>
    lerpTable(PARHELION_ALT_DEG, t, d)
  );
}
export function circleInt120Share(hRad) {
  const d = Math.min(Math.max((hRad * 180) / Math.PI, 0), 55);
  return lerpTable(PARHELION_ALT_DEG, CIRCLE_INT_120_SHARE, d);
}
export function circleIntSigmaAlt(hRad) {
  const d = Math.min(Math.max((hRad * 180) / Math.PI, 0), 55);
  return (
    (lerpTable(PARHELION_ALT_DEG, CIRCLE_INT_SIGMA_ALT_DEG, d) * Math.PI) / 180
  );
}
export function circleInt120Sigma(hRad) {
  const d = Math.min(Math.max((hRad * 180) / Math.PI, 0), 55);
  return (
    (lerpTable(PARHELION_ALT_DEG, CIRCLE_INT_120_SIGMA_DEG, d) * Math.PI) / 180
  );
}
export function czaShare(hRad) {
  const d = (hRad * 180) / Math.PI;
  if (d < 0 || d > 35) return [0, 0, 0];
  return [CZA_SHARE_R, CZA_SHARE_G, CZA_SHARE_B].map((t) =>
    lerpTable(PARHELION_ALT_DEG, t, Math.min(d, 55))
  );
}
export function czaSigmaAlt(hRad) {
  const d = Math.min(Math.max((hRad * 180) / Math.PI, 0), 55);
  return (lerpTable(PARHELION_ALT_DEG, CZA_SIGMA_ALT_DEG, d) * Math.PI) / 180;
}
export function chaShare(hRad) {
  const d = (hRad * 180) / Math.PI;
  if (d < 55 || d > 90) return [0, 0, 0];
  return [CHA_SHARE_R, CHA_SHARE_G, CHA_SHARE_B].map((t) =>
    lerpTable(CHA_ALT_DEG, t, d)
  );
}
export function chaSigmaAlt(hRad) {
  const d = Math.min(Math.max((hRad * 180) / Math.PI, 55), 90);
  return (lerpTable(CHA_ALT_DEG, CHA_SIGMA_ALT_DEG, d) * Math.PI) / 180;
}

// ---- the 90-degree-wedge arcs, analytically ----
// Tangential wave vectors through the plate's PERPENDICULAR
// face pairs give both arc altitudes in closed form. CZA (basal
// entry, side exit): the horizontal momentum cos h survives the
// top face, the VERTICAL internal momentum sqrt(n^2 - cos^2 h)
// survives the side face - the arc stands at
//     alt = asin(sqrt(n^2 - cos^2 h)),
// real only while cos h >= sqrt(n^2 - 1): the sun below ~32.1
// deg, the arc's documented window (the same critical geometry
// as the circle's blue spot - the same faces). CHA (side entry,
// basal exit): sin h survives the side face, the internal
// horizontal sqrt(n^2 - sin^2 h) must fit under the basal exit:
//     alt = asin(sqrt(1 + sin^2 h - n^2)),
// real only past sin h >= sqrt(n^2 - 1): the sun above ~58 deg -
// the fire rainbow's documented season. Dispersion is PURE
// VERTICAL: per-channel n moves only the altitude - red sits
// low on the CZA (toward the sun) and high on the CHA (toward
// the sun again). Null outside the windows.
export function czaAltitude(n, h) {
  const v = n * n - Math.cos(h) ** 2;
  if (!(v <= 1) || !(v >= 0)) return null;
  return Math.asin(Math.sqrt(v));
}
export function chaAltitude(n, h) {
  const v = 1 + Math.sin(h) ** 2 - n * n;
  if (!(v >= 0)) return null;
  return Math.asin(Math.sqrt(v));
}

// The arcs' AZIMUTH profiles: the horizontal fold of the wedge
// transit, parametric in the side-face azimuth psi (spin
// uniform). Tangentials conserved at every face give the exit's
// horizontal vector in closed form per psi; the profile is the
// fold of the uniform spin through that map, weighted by the
// side face's Fresnel (entry for the CHA, exit for the CZA -
// the basal Fresnel is psi-independent and normalises away) and
// the face's flux interception. Numeric fold on a fine psi
// grid, normalised to unit azimuth integral per channel; the MC
// holds it in windows (the hexagon first-hit correction the
// circle documented applies here too, stated). Rows are zero
// outside the arc's existence window - the CZA loses BLUE first
// as the sun climbs to the window top, exactly as observed.
export function arcAzProfile(h, thetasRad, arc, nIce = ICE_N) {
  const bins = thetasRad.length;
  return nIce.map((n) => {
    const acc = new Float64Array(bins);
    // CZA: exit needs cos^2 h cos^2 psi >= n^2 - 1 - empty when
    // even psi = 0 cannot satisfy it (the window top). CHA: the
    // window lives in the closed altitude (1 + sin^2 h >= n^2).
    if (arc === 'cza' && (n * n - 1) / Math.cos(h) ** 2 > 1) return [...acc];
    if (arc === 'cha' && 1 + Math.sin(h) ** 2 - n * n < 0) return [...acc];
    const M = 4000;
    const ch = Math.cos(h);
    for (let i = 0; i < M; i++) {
      const psi = (((i + 0.5) / M) * Math.PI) / 2; // fold psi > 0, doubled
      const cp = Math.cos(psi);
      const sp = Math.sin(psi);
      let hx;
      let hy;
      let w;
      if (arc === 'cza') {
        const kn2 = ch * ch * cp * cp - (n * n - 1);
        if (kn2 <= 0) continue;
        const kn = Math.sqrt(kn2);
        const kt = -ch * sp;
        hx = kn * cp - kt * sp;
        hy = kn * sp + kt * cp;
        // exit Fresnel from inside (reciprocity: external cosine
        // IS kn), flux interception of the face inside ~ cos psi
        w = fresnelT(kn, n) * cp;
      } else {
        const ci = ch * cp;
        const knIn2 = n * n - Math.sin(h) ** 2 - ch * ch * sp * sp;
        if (knIn2 <= 0) continue;
        const knIn = Math.sqrt(knIn2);
        const kt = -ch * sp;
        hx = knIn * cp - kt * sp;
        hy = knIn * sp + kt * cp;
        // entry Fresnel + the face's external flux interception
        w = fresnelT(ci, n) * ci;
      }
      const dAz = Math.abs(Math.atan2(hy, hx));
      const b = Math.min(Math.floor((dAz / Math.PI) * bins), bins - 1);
      acc[b] += w;
    }
    let integ = 0;
    const dTh = Math.PI / bins;
    for (let i = 0; i < bins; i++) integ += acc[i] * dTh;
    return [...acc].map((v) => (integ > 0 ? v / integ : 0));
  });
}

// ---- the internal circle families, analytically ----
// Basal-entry light that side-mirrors k times inside the plate
// and exits the other basal face: both basal refractions cancel,
// so the exit rides the almucantar at the k-fold azimuth. The
// k = 1 SHAPE is closed-form: the fold density sin(dAz/2) (the
// same mirror law as the external circle - uniform spin, the
// hit-weighted fold), times the internal mirror's Fresnel - and
// the internal mirror is TOTAL below the critical azimuth
//     dAz_c = 2 asin(sqrt(n^2 - 1) / cos h)
// (internal incidence cos i = (cos h / n) sin(dAz/2) crossing
// sin i = 1/n): a TIR-BRIGHT plateau, then the light escapes the
// side face instead (landing far off the almucantar - booked
// transOffAlm by the MC) and the basal-exit circle DIES. Warren
// dispersion orders the cutoffs red < green < blue: between them
// only the bluer channels survive - KOENNEN'S BLUE SPOT, here
// emerging from the traced indices with no new constant. Above
// cos h < sqrt(n^2 - 1) (h ~ 32 deg) there is no cutoff and the
// plateau runs to the anthelic point. The edge is smeared by the
// tilt through d(dAz_c)/dh; the MC holds shape, cutoffs and the
// spot's colour. Past-cutoff light from PARTIAL internal
// reflections stays untraced (the walk's lost bucket, stated) -
// the anthelic segment below 32 deg keeps only the external
// family. Returns per-channel rows over thetasRad, each row
// normalised to unit azimuth integral (the absolute scale is the
// shipped MC share table).
export function circleInternalProfile(h, thetasRad, nIce = ICE_N) {
  const ch = Math.abs(Math.cos(h));
  const sigE = circleIntSigmaAlt(h);
  return nIce.map((n) => {
    const s = Math.sqrt(n * n - 1) / Math.max(ch, 1e-9);
    const azc = 2 * Math.asin(Math.min(s, 1));
    // the tilt-smeared edge width: the cutoff's own altitude
    // derivative through the families' vertical sigma
    const dAzcDh =
      s < 1
        ? (2 * s * Math.abs(Math.tan(h))) / Math.sqrt(Math.max(1 - s * s, 1e-9))
        : 0;
    const sigEdge = Math.max(dAzcDh * sigE, 1e-4);
    const row = thetasRad.map((dAz) => {
      const a = Math.min(Math.max(dAz, 0), Math.PI);
      const step =
        s >= 1 ? 1 : 0.5 * (1 - erfApprox((a - azc) / (Math.SQRT2 * sigEdge)));
      return Math.sin(a / 2) * step;
    });
    let integ = 0;
    for (let i = 1; i < thetasRad.length; i++)
      integ += ((row[i] + row[i - 1]) / 2) * (thetasRad[i] - thetasRad[i - 1]);
    return row.map((v) => (integ > 0 ? v / integ : 0));
  });
}
function erfApprox(x) {
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  return (
    s *
    (1 -
      ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
        t +
        0.254829592) *
        t *
        Math.exp(-x * x))
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
