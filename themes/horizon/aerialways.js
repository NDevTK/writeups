/**
 * aerialways.js - real cable cars. The Jungfrau region's aerial
 * installations ARE its transport skyline: the Schilthorn cable
 * cars, Beatenberg-Niederhorn, the Firstbahn. OSM way[aerialway]
 * through the SAME Overpass mirrors; the way nodes are the PYLON
 * positions, so the spans are real. Pure JS, gated:
 *  - parseAerialways: cable_car/gondola/mixed_lift/chair_lift
 *    ways with their names; nodes kept verbatim (every node is a
 *    support - nothing is thinned).
 *  - solveCatenaryA: the TRUE catenary, not the parabola
 *    approximation - Newton on the sag identity
 *    d = a (cosh(L/2a) - 1) for the tension parameter a of a
 *    span of horizontal length L hanging to mid-span sag d.
 *  - catenaryPoints: the hanging curve between two supports at
 *    UNEQUAL heights: y(x) = a cosh((x - xv)/a) + C with the
 *    vertex from the closed form
 *    xv = L/2 - a asinh( h / (2a sinh(L/2a)) ), h the height
 *    difference - both support points hit exactly.
 * Sag defaults to 3% of the span (aerial tramways run 2-6%);
 * cabins hang at deterministic positions via the shared hash.
 */

import {hash3} from './roam.js';

export const SAG_FRAC = 0.03;
export const PYLON_M = 12; // support height over ground
export const STATION_M = 6; // end stations hold the cable lower

const KINDS = new Set(['cable_car', 'gondola', 'mixed_lift', 'chair_lift']);

/**
 * Overpass aerialway ways -> [{id, kind, name, pts}] with pts
 * geodetic [[lat, lon], ...] - the pylon line, verbatim.
 */
export function parseAerialways(json, cap = 60) {
  const out = [];
  for (const el of (json && json.elements) || []) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const tags = el.tags || {};
    if (!KINDS.has(tags.aerialway)) continue;
    out.push({
      id: el.id,
      kind: tags.aerialway,
      name: tags.name || '',
      pts: el.geometry.map((g) => [g.lat, g.lon])
    });
  }
  return out.slice(0, cap);
}

// Newton for the tension parameter a of a symmetric span:
// sag d = a (cosh(L/2a) - 1). Monotone in a, so it converges
// from the parabolic seed a0 = L^2 / (8 d).
export function solveCatenaryA(L, d) {
  let a = (L * L) / (8 * d); // the parabola's answer seeds Newton
  for (let k = 0; k < 60; k++) {
    const u = L / (2 * a);
    const f = a * (Math.cosh(u) - 1) - d;
    // df/da = cosh(u) - 1 - u sinh(u)
    const df = Math.cosh(u) - 1 - u * Math.sinh(u);
    const step = f / df;
    a -= step;
    if (!Number.isFinite(a) || a <= 0) return (L * L) / (8 * d);
    if (Math.abs(step) < 1e-12 * a) break;
  }
  return a;
}

/**
 * n+1 points of the hanging cable between two 3D supports
 * p0 = [x, y, z] and p1 (scene units), sagging by sagFrac of the
 * horizontal span. The curve lives in the vertical plane through
 * the supports: y(x) = a cosh((x - xv)/a) + C, the vertex xv from
 * the closed form for unequal support heights, so BOTH endpoints
 * are exact. Degenerate (vertical/zero) spans fall back to the
 * straight line.
 */
export function catenaryPoints(p0, p1, n = 12, sagFrac = SAG_FRAC) {
  const dx = p1[0] - p0[0];
  const dz = p1[2] - p0[2];
  const L = Math.hypot(dx, dz);
  const out = [];
  if (L < 1e-9) {
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      out.push([p0[0] + dx * t, p0[1] + (p1[1] - p0[1]) * t, p0[2] + dz * t]);
    }
    return out;
  }
  const h = p1[1] - p0[1];
  const a = solveCatenaryA(L, Math.max(sagFrac * L, 1e-6));
  const sh = 2 * a * Math.sinh(L / (2 * a));
  const xv = L / 2 - a * Math.asinh(h / sh);
  const C = p0[1] - a * Math.cosh((0 - xv) / a);
  for (let i = 0; i <= n; i++) {
    const x = (L * i) / n;
    const t = x / L;
    out.push([p0[0] + dx * t, a * Math.cosh((x - xv) / a) + C, p0[2] + dz * t]);
  }
  return out;
}

// ---- The cabin pendulum: measured wind swings real cabins ----
// A suspended cabin IS a pendulum. Statics: the drag equation
// balanced against gravity - tan(theta) = 0.5 rho v^2 Cd A/(m g)
// - leans the hanger along the wind; dynamics: gusts excite it at
// the pendulum's OWN natural frequency omega = sqrt(g/L). The
// documented cabin is an 8-seat monocable gondola: 600 kg tare,
// 2.6 m^2 frontal area, Cd 1.1 (bluff body), 2.5 m hanger arm;
// air density thins with altitude on the 8.4 km scale height.
export const CABIN = {m: 600, A: 2.6, Cd: 1.1, arm: 2.5};
export const G_MS2 = 9.81;
export const PEND_W = Math.sqrt(G_MS2 / CABIN.arm); // rad/s

// The static lean under a steady wind (m/s) at elevation (m).
export function windAngle(vMs, elevM = 0) {
  if (!Number.isFinite(vMs) || vMs <= 0) return 0;
  const rho = 1.225 * Math.exp(-Math.max(elevM, 0) / 8400);
  return Math.atan(
    (0.5 * rho * vMs * vMs * CABIN.Cd * CABIN.A) / (CABIN.m * G_MS2)
  );
}

// The swing at time t: the mean-wind lean, plus the gust-lull
// cycle riding the pendulum's own frequency between the mean and
// gust deflections; per-cabin phase decorrelates a line of them.
export function cabinSwing(vMeanMs, vGustMs, elevM, tSec, phase = 0) {
  const a0 = windAngle(vMeanMs, elevM);
  const a1 = windAngle(Math.max(vGustMs || 0, vMeanMs || 0), elevM);
  return a0 + (a1 - a0) * (0.5 + 0.5 * Math.sin(PEND_W * tSec + phase));
}

/**
 * Deterministic cabin positions for one installation: gondolas
 * circulate a cabin roughly every spacing metres, a cable car
 * runs one car per direction - positions from the shared hash on
 * the OSM id, as fractions [0..1] along the line.
 */
export function cabinFractions(way, lineLenM, spacingM = 220) {
  const n =
    way.kind === 'cable_car'
      ? 2
      : Math.max(2, Math.min(24, Math.round(lineLenM / spacingM)));
  const out = [];
  const phase = hash3(way.id | 0, 0, 17);
  for (let k = 0; k < n; k++) out.push((k / n + phase) % 1);
  return out;
}
