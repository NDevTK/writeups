/**
 * buildings.js - real buildings from real footprints. Towns were
 * lamp points floating on empty grass; OSM way[building] gives
 * every town its actual shape through the SAME Overpass endpoints
 * the forests and lakes use. Pure JS geometry (no renderer
 * import), so ALL of it is gated:
 *  - heightOf: the OSM height ladder - the `height` tag in metres
 *    when present, else building:levels x 3 m (the Simple 3D
 *    Buildings convention), else documented defaults by building
 *    type. The captured census says this matters: height was
 *    tagged on 1 of 400 Interlaken buildings.
 *  - areaM2: shoelace area in equirectangular metres.
 *  - earClip: ear-clipping triangulation for the (possibly
 *    concave) flat roofs - gated by the exactness identity that
 *    the triangle areas sum to the polygon area.
 *  - buildingsGeometry: footprints projected through the gated
 *    Earth anchoring (roam.geoToScene), walls as quads, roofs
 *    ear-clipped flat or gabled (near-rectangular footprints get
 *    a ridge along their long axis), positions/normals/colors/
 *    glow as raw Float32Arrays - the theme wraps them in a
 *    BufferGeometry, the asset viewer renders them identically.
 * Deterministic per-building facade tint via roam's shared hash
 * on the OSM id; the glow attribute carries the town's MEASURED
 * Black Marble radiance so windows warm exactly where the night
 * lights say the town is lit.
 */

import {geoToScene, hash3} from './roam.js';

// The OSM height ladder. Simple 3D Buildings: one level = 3 m.
export const LEVEL_M = 3;
export const TYPE_HEIGHT = {
  garage: 3,
  garages: 3,
  shed: 3,
  hut: 3,
  house: 7,
  detached: 7,
  residential: 7,
  bungalow: 4,
  church: 13,
  chapel: 8
};
export const DEFAULT_HEIGHT = 9;

export function heightOf(tags = {}) {
  const h = parseFloat(String(tags.height || '').replace(',', '.'));
  if (Number.isFinite(h) && h > 1 && h < 300) return h;
  const lv = parseFloat(tags['building:levels']);
  if (Number.isFinite(lv) && lv > 0 && lv < 80) return lv * LEVEL_M;
  return TYPE_HEIGHT[tags.building] ?? DEFAULT_HEIGHT;
}

// Gabled roofs belong to the small-house families; everything
// else (and every non-quad footprint) is flat.
const GABLED = new Set([
  'house',
  'detached',
  'residential',
  'hut',
  'shed',
  'garage',
  'garages',
  'bungalow',
  'chapel',
  'church'
]);

// Andrew monotone-chain convex hull of [x, y] points (CCW).
export function convexHull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length <= 2) return p;
  const cross = (o, a, b) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) {
    while (
      lo.length >= 2 &&
      cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0
    )
      lo.pop();
    lo.push(q);
  }
  const hi = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (
      hi.length >= 2 &&
      cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0
    )
      hi.pop();
    hi.push(q);
  }
  lo.pop();
  hi.pop();
  return lo.concat(hi);
}

/**
 * Minimum-area enclosing rectangle by rotating calipers. Freeman
 * & Shapira (1975): the minimum-area rectangle enclosing a convex
 * polygon has a side COLLINEAR with one of its edges - so testing
 * every hull edge direction is EXACT, not a search. Returns
 * {cx, cy, ux, uy, L, W, area}: centre, unit LONG axis, long and
 * short extents.
 */
export function minAreaRect(pts) {
  const hull = convexHull(pts);
  if (hull.length < 3) {
    const [a, b] = [hull[0], hull[hull.length - 1] || hull[0]];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return {
      cx: (a[0] + b[0]) / 2,
      cy: (a[1] + b[1]) / 2,
      ux: dx / l,
      uy: dy / l,
      L: Math.hypot(dx, dy),
      W: 0,
      area: 0
    };
  }
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const [ax, ay] = hull[i];
    const [bx, by] = hull[(i + 1) % hull.length];
    const el = Math.hypot(bx - ax, by - ay);
    if (!el) continue;
    const ux = (bx - ax) / el;
    const uy = (by - ay) / el;
    let u0 = Infinity;
    let u1 = -Infinity;
    let v0 = Infinity;
    let v1 = -Infinity;
    for (const [x, y] of hull) {
      const u = x * ux + y * uy;
      const v = -x * uy + y * ux;
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) {
      const cu = (u0 + u1) / 2;
      const cv = (v0 + v1) / 2;
      const du = u1 - u0;
      const dv = v1 - v0;
      const long = du >= dv;
      best = {
        cx: cu * ux - cv * uy,
        cy: cu * uy + cv * ux,
        ux: long ? ux : -uy,
        uy: long ? uy : ux,
        L: Math.max(du, dv),
        W: Math.min(du, dv),
        area
      };
    }
  }
  return best;
}

// Shoelace area of a geodetic ring, in m^2 (equirectangular).
export function areaM2(ring) {
  const mLat = 111320;
  const mLon = mLat * Math.cos((ring[0][0] * Math.PI) / 180);
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [la1, lo1] = ring[i];
    const [la2, lo2] = ring[(i + 1) % ring.length];
    s += lo1 * mLon * (la2 * mLat) - lo2 * mLon * (la1 * mLat);
  }
  return Math.abs(s) / 2;
}

/**
 * Overpass building ways -> [{id, ring, h, gabled}] with ring
 * geodetic and deduped (closing point dropped), sorted nearest
 * the bbox centre first and capped. Footprints under minAreaM2
 * are dropped (smaller than a pixel at wallpaper distances).
 */
export function parseBuildings(json, cap = 400, minAreaM2 = 25) {
  const out = [];
  for (const el of (json && json.elements) || []) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 4) continue;
    let ring = el.geometry.map((g) => [g.lat, g.lon]);
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) ring = ring.slice(0, -1);
    if (ring.length < 3) continue;
    const area = areaM2(ring);
    if (area < minAreaM2) continue;
    const tags = el.tags || {};
    // The ridge decision is MEASURED, not vertex-counted: the
    // footprint's minimum-area rectangle (rotating calipers,
    // exact) against its true area. A near-rectangular house -
    // whatever its vertex count - fills >= 80% of its rectangle
    // and takes a ridge; an L-shape does not.
    const mLat = 111320;
    const mLon = mLat * Math.cos((ring[0][0] * Math.PI) / 180);
    const local = ring.map(([la, lo]) => [
      (lo - ring[0][1]) * mLon,
      (la - ring[0][0]) * mLat
    ]);
    const obb = minAreaRect(local);
    const fill = obb.area > 0 ? area / obb.area : 0;
    out.push({
      id: el.id,
      ring,
      area,
      h: heightOf(tags),
      // typed as a house family at all -> tiled roof tone even
      // when the footprint is too complex for a ridge
      house: GABLED.has(tags.building),
      gabled: GABLED.has(tags.building) && fill >= 0.8,
      // churches and chapels carry their spire (a documented
      // designed asset on the real tag, like the vessel
      // silhouettes) at a deterministic gable end
      spire: tags.building === 'church' || tags.building === 'chapel'
    });
  }
  // centroid-of-centroids -> nearest first, then the display cap
  let cla = 0;
  let clo = 0;
  for (const b of out) {
    cla += b.ring[0][0];
    clo += b.ring[0][1];
  }
  cla /= out.length || 1;
  clo /= out.length || 1;
  out.sort(
    (a, b) =>
      (a.ring[0][0] - cla) ** 2 +
      (a.ring[0][1] - clo) ** 2 -
      ((b.ring[0][0] - cla) ** 2 + (b.ring[0][1] - clo) ** 2)
  );
  return out.slice(0, cap);
}

// Ear-clipping triangulation of a simple polygon (pts: [[x,z]]).
// Returns index triples. Works either winding (normalised to CCW
// in the shoelace sense internally).
export function earClip(pts) {
  const n = pts.length;
  if (n < 3) return [];
  let s = 0;
  for (let i = 0; i < n; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[(i + 1) % n];
    s += ax * bz - bx * az;
  }
  const idx = [];
  for (let i = 0; i < n; i++) idx.push(i);
  if (s < 0) idx.reverse();
  const cross = (a, b, c) =>
    (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) -
    (pts[c][0] - pts[a][0]) * (pts[b][1] - pts[a][1]);
  const inTri = (p, a, b, c) => {
    const d1 = cross2(pts[a], pts[b], pts[p]);
    const d2 = cross2(pts[b], pts[c], pts[p]);
    const d3 = cross2(pts[c], pts[a], pts[p]);
    return d1 >= 0 && d2 >= 0 && d3 >= 0;
  };
  const cross2 = (A, B, P) =>
    (B[0] - A[0]) * (P[1] - A[1]) - (P[0] - A[0]) * (B[1] - A[1]);
  const tris = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < 10000) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const a = idx[(i + idx.length - 1) % idx.length];
      const b = idx[i];
      const c = idx[(i + 1) % idx.length];
      if (cross(a, b, c) <= 0) continue; // reflex
      let contains = false;
      for (const p of idx) {
        if (p === a || p === b || p === c) continue;
        if (inTri(p, a, b, c)) {
          contains = true;
          break;
        }
      }
      if (contains) continue;
      tris.push([a, b, c]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break; // degenerate input - ship what we have
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

// Deterministic facade tints (linear-ish plaster/stone tones).
export const FACADES = [
  [0.85, 0.8, 0.72],
  [0.78, 0.72, 0.62],
  [0.72, 0.66, 0.58],
  [0.88, 0.85, 0.8],
  [0.65, 0.58, 0.52],
  [0.75, 0.63, 0.52]
];
export const ROOF = [0.42, 0.3, 0.24]; // tiled-roof brown
export const ROOF_FLAT = [0.38, 0.38, 0.4]; // gravel/steel grey

/**
 * Merged geometry for the current box. builds from parseBuildings;
 * groundY(x, z) -> scene y (the theme's sampler); glowAt(x, z) ->
 * measured night radiance [0..1] (0 offline); U = scene units per
 * metre. Returns {position, normal, color, glow, count, placed}.
 * Buildings whose footprint leaves the box or stands in water
 * (groundY returns null) are skipped.
 */
export function buildingsGeometry(builds, anchor, groundY, glowAt, U, lim) {
  const P = [];
  const Nrm = [];
  const C = [];
  const G = [];
  let placed = 0;
  const push = (p, nrm, col, glow) => {
    P.push(...p);
    Nrm.push(...nrm);
    C.push(...col);
    G.push(glow);
  };
  const tri = (a, b, c, col, glow) => {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    for (const p of [a, b, c]) push(p, [nx, ny, nz], col, glow);
  };
  for (const b of builds) {
    const pts = b.ring.map(([la, lo]) => {
      const s = geoToScene(la, lo, anchor);
      return [s.x, s.z];
    });
    if (pts.some(([x, z]) => Math.abs(x) > lim || Math.abs(z) > lim)) continue;
    // Normalise winding so every wall faces OUTWARD (OSM rings
    // arrive in either direction).
    let sw = 0;
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[(i + 1) % pts.length];
      sw += ax * bz - bx * az;
    }
    if (sw > 0) pts.reverse();
    let base = Infinity;
    let wet = false;
    for (const [x, z] of pts) {
      const y = groundY(x, z);
      if (y === null) {
        wet = true;
        break;
      }
      base = Math.min(base, y);
    }
    if (wet || !Number.isFinite(base)) continue;
    const hU = b.h * U;
    const top = base + hU;
    const facade = FACADES[Math.floor(hash3(b.id | 0, 0, 31) * FACADES.length)];
    const glow = glowAt(pts[0][0], pts[0][1]);
    // Walls: one quad (two tris) per edge, sunk 2 m below base
    // (slope seating).
    const sink = 2 * U;
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[(i + 1) % pts.length];
      const a0 = [ax, base - sink, az];
      const b0 = [bx, base - sink, bz];
      const a1 = [ax, top, az];
      const b1 = [bx, top, bz];
      tri(a0, b0, b1, facade, glow);
      tri(a0, b1, a1, facade, glow);
    }
    // Roof: the ridge rides the footprint's MEASURED minimum-area
    // rectangle (rotating calipers - exact by Freeman & Shapira),
    // so a near-rectangular house takes a correctly ORIENTED
    // ridge whatever its vertex count, with the real 0.4 m eave
    // overhang past the walls; ear-clipped flat cap otherwise.
    const obb = minAreaRect(pts);
    let gH = 0;
    if (b.gabled && obb && obb.W > 0) {
      const EAVE = 0.4 * U;
      const hl = obb.L / 2 + EAVE;
      const hw = obb.W / 2 + EAVE;
      const px = -obb.uy; // perpendicular unit axis
      const py = obb.ux;
      gH = Math.min(0.35 * (obb.W + 2 * EAVE), 4.5 * U);
      const P3 = (du, dv, y) => [
        obb.cx + obb.ux * du + px * dv,
        y,
        obb.cy + obb.uy * du + py * dv
      ];
      const A = P3(-hl, -hw, top);
      const B = P3(hl, -hw, top);
      const C = P3(hl, hw, top);
      const D = P3(-hl, hw, top);
      const R1 = P3(-hl, 0, top + gH);
      const R2 = P3(hl, 0, top + gH);
      // two roof planes + two gable triangles (orders hand-checked
      // for outward normals under the axis convention)
      tri(A, R2, B, ROOF, glow);
      tri(A, R1, R2, ROOF, glow);
      tri(C, R1, D, ROOF, glow);
      tri(C, R2, R1, ROOF, glow);
      tri(A, D, R1, facade, glow);
      tri(C, B, R2, facade, glow);
    } else {
      // earClip emits shoelace-positive triangles - clockwise seen
      // from +y in x-z coords - so emit REVERSED for an up normal.
      const cap = b.house ? ROOF : ROOF_FLAT;
      for (const [a, bb, c] of earClip(pts)) {
        tri(
          [pts[a][0], top, pts[a][1]],
          [pts[c][0], top, pts[c][1]],
          [pts[bb][0], top, pts[bb][1]],
          cap,
          glow
        );
      }
    }
    // The spire: churches and chapels raise one over a gable end.
    // The END is not tagged anywhere - a deterministic pick via
    // the shared hash, the same convention as the facade tints.
    if (b.spire && obb && obb.W > 0) {
      const e = hash3(b.id | 0, 1, 7) < 0.5 ? -1 : 1;
      const s2 = 0.25 * obb.W; // half the base side
      const y0 = top + gH;
      const spireH = Math.max(1.1 * b.h, 8) * U;
      const px = -obb.uy;
      const py = obb.ux;
      const qcx = obb.cx + obb.ux * e * (obb.L / 2 - s2);
      const qcy = obb.cy + obb.uy * e * (obb.L / 2 - s2);
      const S = (du, dv) => [
        qcx + obb.ux * du + px * dv,
        y0,
        qcy + obb.uy * du + py * dv
      ];
      const q1 = S(-s2, -s2);
      const q2 = S(s2, -s2);
      const q3 = S(s2, s2);
      const q4 = S(-s2, s2);
      const apex = [qcx, y0 + spireH, qcy];
      const SPIRE = [0.24, 0.23, 0.26]; // slate
      tri(q2, q1, apex, SPIRE, glow);
      tri(q3, q2, apex, SPIRE, glow);
      tri(q4, q3, apex, SPIRE, glow);
      tri(q1, q4, apex, SPIRE, glow);
    }
    placed++;
  }
  return {
    position: new Float32Array(P),
    normal: new Float32Array(Nrm),
    color: new Float32Array(C),
    glow: new Float32Array(G),
    count: P.length / 3,
    placed
  };
}
