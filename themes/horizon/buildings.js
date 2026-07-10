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
    out.push({
      id: el.id,
      ring,
      area,
      h: heightOf(tags),
      // typed as a house family at all -> tiled roof tone even
      // when the footprint is too complex for a ridge
      house: GABLED.has(tags.building),
      gabled: GABLED.has(tags.building) && ring.length <= 6
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
    // Roof: gabled ridge for near-rectangular small-house types,
    // ear-clipped flat cap otherwise.
    if (b.gabled && pts.length === 4) {
      // ridge along the longer axis' midpoints
      const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const len = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
      const e01 = len(pts[0], pts[1]);
      const e12 = len(pts[1], pts[2]);
      // ridge connects midpoints of the two SHORT edges
      const [s1, s2, l1, l2] =
        e01 < e12
          ? [mid(pts[0], pts[1]), mid(pts[2], pts[3]), [0, 1], [2, 3]]
          : [mid(pts[1], pts[2]), mid(pts[3], pts[0]), [1, 2], [3, 0]];
      const gH = Math.min(0.35 * Math.min(e01, e12), 4.5 * U);
      const r1 = [s1[0], top + gH, s1[1]];
      const r2 = [s2[0], top + gH, s2[1]];
      const q = (i) => [pts[i][0], top, pts[i][1]];
      // two roof planes + two gable triangles
      tri(q(l1[1]), q(l2[0]), r2, ROOF, glow);
      tri(q(l1[1]), r2, r1, ROOF, glow);
      tri(q(l2[1]), q(l1[0]), r1, ROOF, glow);
      tri(q(l2[1]), r1, r2, ROOF, glow);
      tri(q(l1[0]), q(l1[1]), r1, facade, glow);
      tri(q(l2[0]), q(l2[1]), r2, facade, glow);
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
