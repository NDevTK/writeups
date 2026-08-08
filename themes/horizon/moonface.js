/**
 * moonface.js - the moon's orientation and its measured face's
 * access math. The drawn moon was a uniform-albedo Hapke sphere;
 * with moon-albedo-data.js (LROC WAC mosaic, mean-1 modulation)
 * it wears the real maria - IF the sphere is oriented as the
 * real moon is. The orientation needs no rotation series: the
 * vendored astronomy engine's Libration() gives the sub-observer
 * selenographic point (elat, elon - the optical libration), the
 * moon-to-earth direction is the drawn moon's own vector
 * negated, and the lunar spin pole is the IAU frame's printed
 * constant direction (Archinal et al. 2011, "Report of the IAU
 * Working Group on Cartographic Coordinates and Rotational
 * Elements: 2009", Celest. Mech. Dyn. Astron. 109, 101: the
 * Moon's alpha0 = 269.9949, delta0 = 66.5392 deg, J2000 - the
 * report's small trigonometric series, under 0.05 deg, are
 * dropped as a stated reduction). Those three facts fix the
 * body frame completely: rotate so the sub-observer meridian
 * faces the observer with the pole in its measured sky
 * position.
 *
 * Conventions (the star-dome ones): a body direction at
 * selenographic (lat, lon) is (cos lat sin lon, sin lat,
 * cos lat cos lon) - +y is the north pole, lon 0 at +z, east
 * positive; the albedo map's row 0 is +90, column 0 is lon 0.
 */

import {MOON_ALB, MOON_ALB_W, MOON_ALB_H} from './moon-albedo-data.js';

// IAU 2009 lunar pole (J2000 equatorial), printed.
export const MOON_POLE_RA_DEG = 269.9949;
export const MOON_POLE_DEC_DEG = 66.5392;

const D2R = Math.PI / 180;

// Map access: modulation (mean 1 over the sphere) at
// selenographic lat/lon degrees.
export function moonAlbAt(latDeg, lonDeg) {
  const j = Math.min(
    MOON_ALB_H - 1,
    Math.max(0, Math.floor((0.5 - latDeg / 180) * MOON_ALB_H))
  );
  const i =
    Math.floor((((lonDeg % 360) + 360) / 360) * MOON_ALB_W) % MOON_ALB_W;
  return MOON_ALB[j * MOON_ALB_W + i] / 128;
}

// Area-weighted sphere mean of the map (the gate holds it at 1).
export function moonAlbMean() {
  let tot = 0;
  let wsum = 0;
  for (let j = 0; j < MOON_ALB_H; j++) {
    const lat = (0.5 - (j + 0.5) / MOON_ALB_H) * Math.PI;
    const w = Math.cos(lat);
    for (let i = 0; i < MOON_ALB_W; i++) {
      tot += (MOON_ALB[j * MOON_ALB_W + i] / 128) * w;
      wsum += w;
    }
  }
  return tot / wsum;
}

const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// The rotation body -> world as a column-major 3x3 (array of 9),
// from the sub-observer selenographic point (the engine's
// libration angles), the world direction moon -> observer, and
// the world direction of the lunar pole. Triad construction:
// the sub-observer body vector maps to the earth direction, and
// the pole's component perpendicular to it maps likewise - two
// consistent pairs fix the frame.
export function moonOrientation(elatDeg, elonDeg, earthDir, poleDir) {
  const el = elatDeg * D2R;
  const eo = elonDeg * D2R;
  const uB = [
    Math.cos(el) * Math.sin(eo),
    Math.sin(el),
    Math.cos(el) * Math.cos(eo)
  ];
  const yB = [0, 1, 0];
  const e1 = uB;
  let e2 = [
    yB[0] - dot(yB, e1) * e1[0],
    yB[1] - dot(yB, e1) * e1[1],
    yB[2] - dot(yB, e1) * e1[2]
  ];
  e2 = norm(e2);
  const e3 = cross(e1, e2);
  const f1 = norm(earthDir);
  let f2 = [
    poleDir[0] - dot(poleDir, f1) * f1[0],
    poleDir[1] - dot(poleDir, f1) * f1[1],
    poleDir[2] - dot(poleDir, f1) * f1[2]
  ];
  f2 = norm(f2);
  const f3 = cross(f1, f2);
  // R = F E^T with F = [f1 f2 f3], E = [e1 e2 e3].
  const R = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      R[c * 3 + r] = f1[r] * e1[c] + f2[r] * e2[c] + f3[r] * e3[c];
    }
  }
  return R;
}

// Apply the column-major 3x3 to a vector (gate helper).
export function rotApply(R, v) {
  return [
    R[0] * v[0] + R[3] * v[1] + R[6] * v[2],
    R[1] * v[0] + R[4] * v[1] + R[7] * v[2],
    R[2] * v[0] + R[5] * v[1] + R[8] * v[2]
  ];
}
