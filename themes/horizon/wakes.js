/**
 * wakes.js - wind-farm wake interaction: upstream turbines rob
 * downstream ones of wind, so rotors deep in the farm run
 * slower. Pure math (node-importable), consumed by the theme on
 * top of turbines.js.
 *
 * The model is the industry-standard PARK scheme, followed from
 * its sources rather than approximated:
 *  - Jensen (1983, Risoe-M-2411): a top-hat wake expanding
 *    linearly, r_w = r0 + k s; momentum balance across the rotor
 *    gives the initial reduction (1 - Ct) = (V/U0)^2, so the
 *    centreline deficit is (1 - sqrt(1 - Ct)) (r0/(r0 + k s))^2.
 *  - Katic, Hoejstrup & Jensen (1986, EWEC Rome, "A Simple Model
 *    for Cluster Efficiency"): partial-wake shadowing by the
 *    overlap fraction of the downstream rotor disc with the wake
 *    disc, and multiple wakes combined by root-sum-square of the
 *    individual deficits.
 *  - WAsP (DTU): the wake decay constant k = 0.075 for land
 *    cases (0.04 offshore) - Mont Crosin is land.
 *
 * The thrust coefficient comes from published data end to end:
 *  - Vestas prints the V112's full Ct table in the General
 *    Specification (0011-9181 V03, table 12-2, noise mode 0);
 *    the standard-density 1.225 kg/m^3 column is carried
 *    verbatim below.
 *  - No fetchable source publishes the E-82's or V90's table, so
 *    every other pitch-regulated model rides the SAME published
 *    curve on the non-dimensional axis v / v_rated (its own
 *    sheet's rated wind) - a transfer of published data, not an
 *    invented curve; pitch-controlled thrust curves collapse to
 *    a common shape on that axis (Atlaskin, Suomi & Lindfors,
 *    FMI, EGU21-14402). The E-82's storm control tapers its
 *    thrust across the same published 28-34 m/s window the
 *    rotor-speed law uses.
 *  - The gate holds the transfer against a THEOREM rather than a
 *    feeling: inverting ENERCON's own published Cp curve through
 *    one-dimensional momentum theory (Cp = 4a(1-a)^2,
 *    Ct = 4a(1-a), physical branch a <= 1/3) gives a strict
 *    LOWER bound on the true Ct - real losses only lower Cp at
 *    fixed induction, so the inverted induction understates the
 *    true one. The transferred curve must clear that floor at
 *    every published row and converge to it above rated where
 *    the loss share vanishes (ctFromCp/E82_CP below exist for
 *    that check and for anyone wanting the floor itself).
 */

import {rotorOmega} from './turbines.js';

export const WAKE_K = 0.075; // WAsP wake decay, land
export const RHO = 1.225; // kg/m^3, the sheets' standard density

// Vestas General Specification V112-3.0 MW, table 12-2 (Ct
// values, noise mode 0), air density 1.225 kg/m^3 - verbatim.
export const V112_CT = [
  [3, 0.913],
  [3.5, 0.865],
  [4, 0.833],
  [4.5, 0.821],
  [5, 0.817],
  [5.5, 0.815],
  [6, 0.812],
  [6.5, 0.808],
  [7, 0.804],
  [7.5, 0.8],
  [8, 0.798],
  [8.5, 0.794],
  [9, 0.781],
  [9.5, 0.755],
  [10, 0.711],
  [10.5, 0.643],
  [11, 0.567],
  [11.5, 0.48],
  [12, 0.409],
  [12.5, 0.353],
  [13, 0.308],
  [13.5, 0.272],
  [14, 0.241],
  [14.5, 0.216],
  [15, 0.194],
  [15.5, 0.175],
  [16, 0.159],
  [16.5, 0.145],
  [17, 0.133],
  [17.5, 0.122],
  [18, 0.112],
  [18.5, 0.103],
  [19, 0.096],
  [19.5, 0.089],
  [20, 0.083],
  [20.5, 0.077],
  [21, 0.072],
  [21.5, 0.068],
  [22, 0.064],
  [22.5, 0.06],
  [23, 0.056],
  [23.5, 0.053],
  [24, 0.05],
  [24.5, 0.048],
  [25, 0.045]
];

// ENERCON product overview, E-82 E2 2,300 kW calculated power
// curve - the Cp column, verbatim.
export const E82_CP = [
  [1, 0],
  [2, 0.12],
  [3, 0.29],
  [4, 0.4],
  [5, 0.43],
  [6, 0.46],
  [7, 0.48],
  [8, 0.49],
  [9, 0.5],
  [10, 0.49],
  [11, 0.44],
  [12, 0.38],
  [13, 0.32],
  [14, 0.26],
  [15, 0.22],
  [16, 0.18],
  [17, 0.15],
  [18, 0.12],
  [19, 0.11],
  [20, 0.09],
  [21, 0.08],
  [22, 0.07],
  [23, 0.06],
  [24, 0.05],
  [25, 0.05]
];

const lerpTable = (tab, v) => {
  if (v <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) {
    if (v <= tab[i][0]) {
      const [v0, y0] = tab[i - 1];
      const [v1, y1] = tab[i];
      return y0 + ((y1 - y0) * (v - v0)) / (v1 - v0);
    }
  }
  return tab[tab.length - 1][1];
};

/**
 * One-dimensional momentum (actuator disc) inversion: solve
 * Cp = 4a(1-a)^2 for the induction factor on the physical branch
 * a in [0, 1/3] (bisection to machine precision - the cubic is
 * monotone there), return Ct = 4a(1-a). The Betz point closes it
 * exactly: Cp = 16/27 -> a = 1/3 -> Ct = 8/9.
 */
export function ctFromCp(cp) {
  const c = Math.min(Math.max(cp, 0), 16 / 27);
  let lo = 0;
  let hi = 1 / 3;
  for (let i = 0; i < 100; i++) {
    const a = (lo + hi) / 2;
    if (4 * a * (1 - a) * (1 - a) < c) lo = a;
    else hi = a;
  }
  const a = (lo + hi) / 2;
  return 4 * a * (1 - a);
}

// The V112's published rated wind - the non-dimensional
// transfer's own anchor.
const V112_VRATED = 13;

/**
 * Thrust coefficient of one turbine at free wind v (m/s): the
 * published V112 table, other models on the v / v_rated axis
 * (see header). Zero outside the operating envelope - a parked,
 * feathered rotor sheds no wake; ENERCON storm control tapers
 * the thrust across its published window exactly as it tapers
 * the speed.
 */
export function ctOf(spec, v) {
  if (rotorOmega(spec, v) === 0) return 0;
  const vEq = spec.model === 'V112' ? v : (v * V112_VRATED) / spec.vRated;
  let ct = lerpTable(V112_CT, vEq);
  if (spec.storm && v > spec.storm[0]) {
    ct *= (spec.storm[1] - v) / (spec.storm[1] - spec.storm[0]);
  }
  return ct;
}

/**
 * Overlap fraction of the downstream rotor disc (radius rj,
 * centre a distance c off the wake axis) with the wake disc
 * (radius rw): the circle-circle lens, exact (Katic's partial
 * shadowing).
 */
export function overlapFrac(rw, rj, c) {
  if (c >= rw + rj) return 0;
  if (c + rj <= rw) return 1; // rotor fully inside the wake
  const areaJ = Math.PI * rj * rj;
  if (c + rw <= rj) return (Math.PI * rw * rw) / areaJ; // wake inside rotor
  const lens =
    rw * rw * Math.acos((c * c + rw * rw - rj * rj) / (2 * c * rw)) +
    rj * rj * Math.acos((c * c + rj * rj - rw * rw) / (2 * c * rj)) -
    0.5 *
      Math.sqrt((-c + rw + rj) * (c + rw - rj) * (c - rw + rj) * (c + rw + rj));
  return lens / areaJ;
}

/**
 * Jensen deficit one wake lays on one downstream point: the
 * initial reduction 1 - sqrt(1 - Ct) decayed by
 * (r0/(r0 + k s))^2 and scaled by the overlap fraction.
 * s = downwind distance, c = radial offset off the wake axis
 * (same length units as the radii - the ratios are what matter).
 */
export function wakeDeficit(ct, r0, rj, s, c, k = WAKE_K) {
  if (!(s > 0) || !(ct > 0)) return 0;
  const rw = r0 + k * s;
  const f = overlapFrac(rw, rj, c);
  if (f === 0) return 0;
  const decay = (r0 / rw) ** 2;
  return f * (1 - Math.sqrt(1 - ct)) * decay;
}

/**
 * The farm: every turbine's effective-wind factor v_eff/v under
 * every other turbine's wake, Katic root-sum-square combined.
 * turbines: [{x, y, z, spec}] with x/z horizontal, y the hub
 * CENTRE height, all in METRES (the caller flattens any warped
 * vertical axis first - the spec radii are metres and the lens
 * mixes them with these offsets). wind: {x, z} unit vector
 * pointing DOWNWIND.
 * vAt(i): free wind (m/s) at turbine i's hub (sets Ct).
 * Returns factors[] in (0, 1].
 */
export function farmFactors(turbines, wind, vAt, k = WAKE_K) {
  const n = turbines.length;
  const out = new Array(n).fill(1);
  for (let j = 0; j < n; j++) {
    let sum2 = 0;
    const tj = turbines[j];
    for (let i = 0; i < n; i++) {
      if (i === j) continue;
      const ti = turbines[i];
      const dx = tj.x - ti.x;
      const dz = tj.z - ti.z;
      const s = dx * wind.x + dz * wind.z; // downwind separation
      if (s <= 0) continue;
      const cx = dx - s * wind.x;
      const cz = dz - s * wind.z;
      const c = Math.hypot(cx, cz, tj.y - ti.y);
      const d = wakeDeficit(
        ctOf(ti.spec, vAt(i)),
        ti.spec.r,
        tj.spec.r,
        s,
        c,
        k
      );
      sum2 += d * d;
    }
    out[j] = Math.max(1 - Math.sqrt(sum2), 0);
  }
  return out;
}
