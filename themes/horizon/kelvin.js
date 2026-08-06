/**
 * kelvin.js - the ship-wake wedge, derived rather than assumed.
 * Pure math (node-importable); water-tsl.js draws the wedge this
 * module computes, per vessel, from MEASURED AIS speed and the
 * box's own bathymetry.
 *
 * The construction is Havelock's (1908, Proc. R. Soc. A 81,
 * 398-430: group-velocity rays under the stationary-phase
 * condition; Thomson 1887 for the deep-water special case):
 *  - a wave component at angle theta to the track is STATIONARY
 *    in the ship frame iff its phase speed matches the track
 *    projection: c(k) = U cos(theta);
 *  - its energy leaves the retarded source point at the GROUP
 *    speed cg = n c, n(kh) = (1 + 2kh/sinh 2kh)/2 from the
 *    finite-depth dispersion c^2 = (g/k) tanh(kh);
 *  - relative to the moving ship the component therefore sits at
 *    an angle psi off the track with
 *      tan(psi) = n cos sin / (1 - n cos^2)   [theta args]
 *    and the visible wedge half-angle is the MAXIMUM of psi over
 *    admissible components.
 * Everything below follows from those three lines; the closed
 * forms the landmarks pin all EMERGE:
 *  - deep water (n = 1/2): sin(alpha) = exactly 1/3, the Kelvin
 *    19.47 deg, independent of speed;
 *  - depth Froude number Frh = U/sqrt(g h) -> 1^-: the wedge
 *    opens toward 90 deg (Havelock's widening);
 *  - supercritical Frh > 1 (n -> 1, non-dispersive shallow
 *    limit): sin(alpha) = 1/Frh, the Mach cone.
 *
 * What is NOT here: wave amplitude. The height field needs hull
 * shape (wave-resistance theory); the theme draws the wedge arms
 * as display furniture (like the hulls themselves) with only the
 * GEOMETRY gated. The high-hull-Froude narrowing of the PEAK
 * (Rabaud & Moisy 2013) concerns amplitude, not the wedge
 * boundary, and displacement hulls in AIS sit well below that
 * regime - documented scope.
 */

// The repo's surface gravity (matches the wave model in
// water-tsl/ocean-spectrum: 9.81 m/s^2).
export const G_M_S2 = 9.81;

// Deep-water Kelvin half-angle, closed form: sin(alpha) = 1/3.
export const KELVIN_DEEP_RAD = Math.asin(1 / 3);

// Group-to-phase speed ratio n(kh) for c^2 = (g/k) tanh(kh).
export function groupRatio(kh) {
  if (kh > 20) return 0.5; // sinh overflows; the deep limit is exact
  if (kh < 1e-8) return 1;
  return 0.5 * (1 + (2 * kh) / Math.sinh(2 * kh));
}

// Depth Froude number from speed (m/s) and depth (m).
export function depthFroude(uMs, depthM, g = G_M_S2) {
  return uMs / Math.sqrt(g * Math.max(depthM, 0.01));
}

/**
 * Wedge half-angle (radians) at depth Froude number frh, by
 * direct maximisation of the ray angle over the admissible
 * component spectrum (parameterised by kh; the stationarity
 * condition fixes cos^2(theta) = tanh(kh)/(kh frh^2), admissible
 * while <= 1). A dense log scan is exact to ~1e-4 rad against
 * every closed-form limit the reference pins; the curve is
 * evaluated per vessel per AIS fix, so cost is irrelevant.
 */
export function wedgeHalfAngleRad(frh) {
  if (!(frh > 0)) return KELVIN_DEEP_RAD;
  const f2 = frh * frh;
  // Admissibility floor: components exist where tanh(kh)/kh <=
  // frh^2. Subcritical, that starts at a finite kh_min (bisected
  // here); supercritical every kh qualifies. The scan then covers
  // [kh_min, kh_min * 1e8] so the deep components a small Froude
  // number pushes to enormous kh stay inside the window.
  let lo = 0;
  if (frh < 1) {
    let a = 1e-8;
    let b = 1e9;
    for (let i = 0; i < 200; i++) {
      const m = Math.sqrt(a * b);
      if (Math.tanh(m) / m > f2) a = m;
      else b = m;
    }
    lo = b;
  }
  let best = 0;
  const N = 3000;
  const lnLo = Math.log(Math.max(lo, 1e-6));
  const lnHi = lnLo + Math.log(1e8);
  for (let i = 0; i <= N; i++) {
    const kh = Math.exp(lnLo + ((lnHi - lnLo) * i) / N);
    const c2 = Math.min(Math.tanh(kh) / (kh * f2), 1);
    const cos = Math.sqrt(c2);
    const sin = Math.sqrt(1 - c2);
    const n = groupRatio(kh);
    const den = 1 - n * c2;
    if (den <= 1e-12) return Math.PI / 2; // Frh -> 1 divergence
    const psi = Math.atan((n * cos * sin) / den);
    if (psi > best) best = psi;
  }
  return best;
}
