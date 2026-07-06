/**
 * Depth-induced wave breaking - the single source shared by the
 * water material (water-tsl.js) and the reference printer
 * (surf-reference.mjs). Replaces the McCowan H > 0.78 d smoothstep
 * heuristic with the standard engineering surf model, computed in
 * double precision:
 *
 *  - Battjes & Janssen (1978): with wave heights clipped-Rayleigh at
 *    the local maximum Hm, the fraction of breaking waves Qb solves
 *    (1 - Qb) / ln(Qb) = -(Hrms / Hm)^2. Solved by bisection - no
 *    closed-form or series approximation.
 *  - Miche-type maximum height Hm = (0.88 / k) tanh(gamma k d / 0.88)
 *    (B&J eq. 8): steepness-limited in deep water, gamma*d in the
 *    shallow limit.
 *  - Battjes & Stive (1985) recalibration of the breaker parameter:
 *    gamma = 0.5 + 0.4 tanh(33 s0) with the offshore steepness
 *    s0 = Hrms0 / L0, L0 = g Tp^2 / 2 pi.
 *  - Linear shoaling: Hrms(d) = Hrms0 sqrt(cg(ref) / cg(d)) (energy
 *    flux conservation at the peak frequency), bounded by Hm - the
 *    clipped-Rayleigh model itself has no heights above Hm, so the
 *    bound is internal consistency, not an extra assumption.
 *  - Exact finite-depth dispersion: k(omega, d) by Newton on
 *    omega^2 = g k tanh(k d) (no Hunt/Eckart explicit fit), and
 *    cg = dw/dk from the same relation.
 *
 * Scope, documented: this is the LOCAL (pointwise) application of
 * the B&J breaking fraction. The full model closes an energy-balance
 * ODE along the propagation path (and refracts over the 2D
 * bathymetry - SWAN territory); pointwise Qb over the real depth
 * field is the standard quick-estimate form and is exact at the
 * formula level.
 */

const G = 9.81;

// Exact k(omega, d): Newton on f(k) = g k tanh(k d) - omega^2,
// seeded with the deep-water k0 (f is monotonic in k).
export function waveNumber(omega, d) {
  let k = (omega * omega) / G;
  for (let it = 0; it < 50; it++) {
    const kd = Math.min(k * d, 50);
    const t = Math.tanh(kd);
    const sech2 = 1 - t * t;
    const f = G * k * t - omega * omega;
    const df = G * (t + kd * sech2);
    const dk = f / df;
    k -= dk;
    if (Math.abs(dk) < 1e-14 * k) break;
  }
  return k;
}

// Group velocity at (omega, d) from the exact dispersion.
export function groupVelocity(omega, d) {
  const k = waveNumber(omega, d);
  const kd = Math.min(k * d, 50);
  const t = Math.tanh(kd);
  return (G * (t + kd * (1 - t * t))) / (2 * omega);
}

// Battjes & Stive (1985) breaker parameter from offshore steepness.
export function gammaBS(s0) {
  return 0.5 + 0.4 * Math.tanh(33 * s0);
}

// Battjes & Janssen (1978) breaking fraction: (1-Qb)/ln Qb = -x^2,
// x = Hrms/Hm. Bisection in [1e-300, 1]; Qb -> 0 as x -> 0 and
// Qb(x >= 1) = 1 (every wave at the cap is breaking).
export function qbFraction(x) {
  if (x >= 1) return 1;
  if (x <= 1e-6) return 0;
  const target = x * x;
  // f(q) = (1-q)/ln q + x^2 falls from x^2 (q -> 0) to x^2 - 1
  // (q -> 1); the root is where the clipped-Rayleigh identity holds.
  const f = (q) => (1 - q) / Math.log(q) + target;
  let lo = 1e-300;
  let hi = 1 - 1e-15;
  for (let it = 0; it < 200; it++) {
    const mid = Math.sqrt(lo * hi); // geometric: Qb spans decades
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return Math.sqrt(lo * hi);
}

// Inverse standard-normal CDF (probit), Wichura (1988) algorithm
// AS 241 (PPND16) - the double-precision standard (R's qnorm):
// |error| < 1e-15 over the full domain.
export function probit(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const q = p - 0.5;
  let r;
  if (Math.abs(q) <= 0.425) {
    r = 0.180625 - q * q;
    return (
      (q *
        (((((((2509.0809287301226727 * r + 33430.575583588128105) * r +
          67265.770927008700853) *
          r +
          45921.953931549871457) *
          r +
          13731.693765509461125) *
          r +
          1971.5909503065514427) *
          r +
          133.14166789178437745) *
          r +
          3.387132872796366608)) /
      (((((((5226.495278852545703 * r + 28729.085735721942674) * r +
        39307.89580009271061) *
        r +
        21213.794301586595867) *
        r +
        5394.1960214247511077) *
        r +
        687.1870074920579083) *
        r +
        42.313330701600911252) *
        r +
        1)
    );
  }
  r = q < 0 ? p : 1 - p;
  r = Math.sqrt(-Math.log(r));
  let v;
  if (r <= 5) {
    r -= 1.6;
    v =
      (((((((7.7454501427834140764e-4 * r + 0.0227238449892691845833) * r +
        0.24178072517745061177) *
        r +
        1.27045825245236838258) *
        r +
        3.64784832476320460504) *
        r +
        5.7694972214606914055) *
        r +
        4.6303378461565452959) *
        r +
        1.42343711074968357734) /
      (((((((1.05075007164441684324e-9 * r + 5.475938084995344946e-4) * r +
        0.0151986665636164571966) *
        r +
        0.14810397642748007459) *
        r +
        0.68976733498510000455) *
        r +
        1.6763848301838038494) *
        r +
        2.05319162663775882187) *
        r +
        1);
  } else {
    r -= 5;
    v =
      (((((((2.01033439929228813265e-7 * r + 2.71155556874348757815e-5) * r +
        0.0012426609473880784386) *
        r +
        0.026532189526576123093) *
        r +
        0.29656057182850489123) *
        r +
        1.7848265399172913358) *
        r +
        5.4637849111641143699) *
        r +
        6.6579046435011037772) /
      (((((((2.04426310338993978564e-15 * r + 1.4215117583164458887e-7) * r +
        1.8463183175100546818e-5) *
        r +
        7.868691311456132591e-4) *
        r +
        0.0148753612908506148525) *
        r +
        0.13692988092273580531) *
        r +
        0.59983220655588793769) *
        r +
        1);
  }
  return q < 0 ? -v : v;
}

/**
 * Surf profile for the shader: bins samples over d in (0, dMax],
 * from the sea state {hs (total significant height, m), tp (peak
 * period, s)} referenced at depthRef (where hs was observed/built -
 * the TMA depth of the spectrum). Returns Float32Array(bins * 4)
 * RGBA rows: R = Qb(d), G = z(d) = probit(1 - Qb) clamped to [-4, 4]
 * - the crest threshold in units of the elevation std sigma = Hs/4,
 * so a mask on eta > z sigma has coverage EXACTLY Qb and rides the
 * breaking crests (the clipped-Rayleigh picture: the highest waves
 * are the ones that break).
 */
export function buildSurfLUT({hs, tp, depthRef, dMax = 40, bins = 256}) {
  const out = new Float32Array(bins * 4);
  for (let i = 0; i < bins; i++) {
    out[i * 4 + 1] = 4; // no surf: threshold above every crest
    out[i * 4 + 3] = 1;
  }
  if (!(hs > 0.01) || !(tp > 0.5)) return out;
  const omega = (2 * Math.PI) / tp;
  const Hrms0 = hs / Math.SQRT2;
  const L0 = (G * tp * tp) / (2 * Math.PI);
  const gamma = gammaBS(Hrms0 / L0);
  const cgRef = groupVelocity(omega, Math.max(depthRef, 1));
  for (let i = 0; i < bins; i++) {
    const d = Math.max(((i + 0.5) / bins) * dMax, 0.01);
    const k = waveNumber(omega, d);
    const Hm = (0.88 / k) * Math.tanh((gamma * k * d) / 0.88);
    const cg = groupVelocity(omega, d);
    const Hrms = Math.min(Hrms0 * Math.sqrt(cgRef / cg), Hm);
    const qb = qbFraction(Hrms / Hm);
    out[i * 4] = qb;
    out[i * 4 + 1] = Math.min(Math.max(probit(1 - qb), -4), 4);
  }
  return out;
}
