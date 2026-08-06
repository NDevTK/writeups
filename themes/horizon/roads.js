/**
 * roads.js - real roads from real OSM ways. The towns have their
 * buildings (buildings.js) but nothing connects them; OSM
 * way[highway] through the SAME Overpass mirrors gives every town
 * its actual street network. Pure JS geometry (no renderer
 * import), all of it gated:
 *  - widthOf: the OSM width ladder - the `width` tag in metres
 *    when present, else lanes x 3.5 m (the OSM/AASHTO default
 *    lane), else documented defaults by highway type. The
 *    captured census says the ladder matters: width was tagged on
 *    38 of 400 Interlaken ways, lanes on 138.
 *  - surfaceColor: measured provenance for the LOOK - the OSM
 *    surface tag (320 of 400 ways carry one) picks the albedo;
 *    untagged ways default by class (paved families asphalt,
 *    track/path families bare ground).
 *  - densify/thin: bound the vertex spacing both ways, so ribbons
 *    follow the terrain (max separation) without exploding the
 *    vertex budget (min separation); endpoints exact.
 *  - roadsGeometry: polylines projected through the gated Earth
 *    anchoring (roam.geoToScene), extruded to flat ribbons of the
 *    ladder width seated on the sampled ground. Water breaks a
 *    ribbon into strips - unless the way carries OSM's bridge
 *    tag, in which case the deck spans the gap on a straight
 *    grade between the shores (how real bridges cross).
 */

import {geoToScene} from './roam.js';

// The OSM width ladder. 3.5 m is the default lane width.
export const LANE_M = 3.5;
export const TYPE_WIDTH = {
  motorway: 11,
  motorway_link: 6,
  trunk: 10,
  trunk_link: 6,
  primary: 8,
  primary_link: 6,
  secondary: 7,
  secondary_link: 6,
  tertiary: 6.5,
  tertiary_link: 5.5,
  unclassified: 5,
  residential: 5,
  living_street: 4.5,
  pedestrian: 4,
  service: 3.5,
  track: 3,
  cycleway: 2,
  footway: 1.8,
  steps: 1.8,
  bridleway: 2,
  path: 1.5
};
export const DEFAULT_WIDTH = 4;

export function widthOf(tags = {}) {
  const w = parseFloat(String(tags.width || '').replace(',', '.'));
  if (Number.isFinite(w) && w > 0.5 && w < 60) return w;
  const l = parseFloat(tags.lanes);
  if (Number.isFinite(l) && l > 0 && l < 12) return l * LANE_M;
  return TYPE_WIDTH[tags.highway] ?? DEFAULT_WIDTH;
}

// Albedo by the tagged surface (linear-ish tones).
export const SURFACE_COLOR = {
  asphalt: [0.16, 0.16, 0.17],
  paved: [0.2, 0.2, 0.21],
  concrete: [0.32, 0.32, 0.3],
  paving_stones: [0.28, 0.27, 0.26],
  sett: [0.24, 0.23, 0.22],
  cobblestone: [0.24, 0.23, 0.22],
  gravel: [0.34, 0.31, 0.27],
  fine_gravel: [0.36, 0.33, 0.28],
  compacted: [0.33, 0.29, 0.24],
  ground: [0.28, 0.23, 0.17],
  dirt: [0.27, 0.21, 0.15],
  earth: [0.27, 0.21, 0.15],
  grass: [0.2, 0.26, 0.14],
  wood: [0.3, 0.22, 0.14],
  unpaved: [0.3, 0.26, 0.2]
};
const UNPAVED_TYPES = new Set(['track', 'path', 'bridleway']);
export function surfaceColor(tags = {}) {
  const c = SURFACE_COLOR[tags.surface];
  if (c) return c;
  return UNPAVED_TYPES.has(tags.highway)
    ? SURFACE_COLOR.ground
    : SURFACE_COLOR.asphalt;
}

// Ways that are not (yet) roads.
const NOT_ROADS = new Set([
  'proposed',
  'construction',
  'razed',
  'abandoned',
  'corridor',
  'elevator',
  'raceway'
]);

// Rough class rank so the display cap keeps the network's spine.
const RANK = [
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
  'living_street',
  'pedestrian',
  'service',
  'track',
  'cycleway',
  'footway',
  'steps',
  'bridleway',
  'path'
];
export const rankOf = (hw) => {
  const i = RANK.indexOf(String(hw).replace(/_link$/, ''));
  return i < 0 ? RANK.length : i;
};

// Equirectangular length of a geodetic polyline, metres.
export function lengthM(pts) {
  const mLat = 111320;
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx =
      (pts[i][1] - pts[i - 1][1]) *
      mLat *
      Math.cos((pts[i - 1][0] * Math.PI) / 180);
    const dy = (pts[i][0] - pts[i - 1][0]) * mLat;
    s += Math.hypot(dx, dy);
  }
  return s;
}

/**
 * Overpass highway ways -> [{id, pts, wM, color, bridge, kind}]
 * with pts geodetic [[lat, lon], ...]. Stubs under minLenM are
 * dropped (invisible at wallpaper distances); the cap keeps the
 * most important classes first, longest first within a class.
 */
export function parseRoads(json, cap = 500, minLenM = 25) {
  const out = [];
  for (const el of (json && json.elements) || []) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const tags = el.tags || {};
    if (!tags.highway || NOT_ROADS.has(tags.highway)) continue;
    const pts = el.geometry.map((g) => [g.lat, g.lon]);
    const len = lengthM(pts);
    if (len < minLenM) continue;
    out.push({
      id: el.id,
      pts,
      len,
      wM: widthOf(tags),
      color: surfaceColor(tags),
      bridge: tags.bridge === 'yes' || tags.bridge === 'viaduct',
      kind: tags.highway
    });
  }
  out.sort((a, b) => rankOf(a.kind) - rankOf(b.kind) || b.len - a.len);
  return out.slice(0, cap);
}

// Insert points so no scene-space gap exceeds maxSep (original
// vertices all kept - the shape is never simplified here).
export function densify(line, maxSep) {
  const out = [line[0]];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.ceil(d / maxSep);
    for (let k = 1; k <= n; k++)
      out.push([
        a[0] + ((b[0] - a[0]) * k) / n,
        a[1] + ((b[1] - a[1]) * k) / n
      ]);
  }
  return out;
}

// Drop interior points closer than minSep to the last kept one
// (endpoints exact) - bounds the ribbon's vertex budget.
export function thin(line, minSep) {
  if (line.length <= 2) return line.slice();
  const out = [line[0]];
  for (let i = 1; i < line.length - 1; i++) {
    const a = out[out.length - 1];
    if (Math.hypot(line[i][0] - a[0], line[i][1] - a[1]) >= minSep)
      out.push(line[i]);
  }
  out.push(line[line.length - 1]);
  return out;
}

/**
 * Merged ribbon geometry for the current box. roads from
 * parseRoads; groundY(x, z) -> scene y or null for water (the
 * theme's sampler, lift included by the caller); U = scene units
 * per metre; lim = half box. Water and the box edge break a road
 * into strips; a bridge way instead spans interior water on a
 * straight grade between its shores. Returns {position, normal,
 * color, count, placed} raw Float32Arrays like buildings.js.
 */
export function roadsGeometry(roads, anchor, groundY, U, lim) {
  const P = [];
  const N = [];
  const C = [];
  let placed = 0;
  const tri = (a, b, c, col) => {
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
    for (const p of [a, b, c]) {
      P.push(...p);
      N.push(nx, ny, nz);
      C.push(...col);
    }
  };
  const maxSep = 15 * U; // follow the terrain every ~15 m
  const minSep = 4 * U;
  for (const r of roads) {
    const line = thin(
      densify(
        r.pts.map(([la, lo]) => {
          const s = geoToScene(la, lo, anchor);
          return [s.x, s.z];
        }),
        maxSep
      ),
      minSep
    );
    // Heights: null marks water or off-box; a bridge fills
    // interior water runs on a straight grade.
    const ys = line.map(([x, z]) =>
      Math.abs(x) > lim || Math.abs(z) > lim ? null : groundY(x, z)
    );
    if (r.bridge) {
      let i = 0;
      while (i < ys.length) {
        if (ys[i] !== null) {
          i++;
          continue;
        }
        const j0 = i;
        while (i < ys.length && ys[i] === null) i++;
        const a = j0 - 1;
        const b = i;
        if (a >= 0 && b < ys.length)
          for (let k = j0; k < b; k++)
            ys[k] = ys[a] + ((ys[b] - ys[a]) * (k - a)) / (b - a);
      }
    }
    // Ribbon strips between the remaining gaps.
    const h = (r.wM * U) / 2;
    let any = false;
    let s0 = -1;
    for (let i = 0; i <= line.length; i++) {
      const valid = i < line.length && ys[i] !== null;
      if (valid && s0 < 0) s0 = i;
      if (!valid && s0 >= 0) {
        const n = i - s0;
        if (n >= 2) {
          any = true;
          const L = [];
          const R = [];
          for (let k = s0; k < i; k++) {
            const p0 = line[Math.max(s0, k - 1)];
            const p1 = line[Math.min(i - 1, k + 1)];
            let dx = p1[0] - p0[0];
            let dz = p1[1] - p0[1];
            const dl = Math.hypot(dx, dz) || 1;
            dx /= dl;
            dz /= dl;
            const [x, z] = line[k];
            L.push([x - dz * h, ys[k], z + dx * h]);
            R.push([x + dz * h, ys[k], z - dx * h]);
          }
          for (let k = 0; k + 1 < n; k++) {
            tri(L[k], R[k + 1], R[k], r.color);
            tri(L[k], L[k + 1], R[k + 1], r.color);
          }
        }
        s0 = -1;
      }
    }
    if (any) placed++;
  }
  return {
    position: new Float32Array(P),
    normal: new Float32Array(N),
    color: new Float32Array(C),
    count: P.length / 3,
    placed
  };
}
