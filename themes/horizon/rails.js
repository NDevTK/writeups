/**
 * rails.js - real railways. Around Interlaken the rail network IS
 * the landscape: the standard-gauge Thun line, the metre-gauge
 * Berner Oberland-Bahn, 800 mm rack lines and the Harderbahn
 * funicular. OSM way[railway] through the SAME Overpass mirrors,
 * rendered through the SAME gated ribbon builder as the roads and
 * rivers (roadsGeometry - exactness, terrain following, water
 * strip-breaking and bridge spanning gated ONCE and shared). This
 * module owns only what is rail-specific:
 *  - railWidthOf: the width ladder is MEASURED where the data
 *    allows - the captured census tags gauge on 288 of 300 ways -
 *    bed width = tracks x (gauge + 2.6 m ballast shoulders, ~1.3 m
 *    each side, the standard formation allowance), falling to
 *    tracks x 4 m without a gauge, then per-type defaults.
 *  - parseRailways: tunnelled reaches SKIPPED (the Alps route
 *    trains underground; drawing them would be inventing); the
 *    bridge tag CARRIES to the shared builder - the rail bridges
 *    over the Aare genuinely span it.
 */

import {lengthM, roadsGeometry} from './roads.js';

// Per-type bed widths when neither gauge nor tracks speak.
export const RAIL_WIDTH = {
  rail: 4,
  light_rail: 3.7,
  narrow_gauge: 3.4,
  tram: 3.4,
  funicular: 2.8
};
export const SHOULDER_M = 2.6; // ballast both sides of the gauge

// Ballast-bed albedo (linear); rails vanish below texel size.
export const RAIL_COLOR = [0.19, 0.18, 0.17];

export function railWidthOf(tags = {}) {
  let tracks = parseFloat(tags.tracks);
  if (!Number.isFinite(tracks) || tracks < 1 || tracks > 12) tracks = 1;
  const gauge = parseFloat(tags.gauge);
  if (Number.isFinite(gauge) && gauge >= 300 && gauge <= 3000)
    return tracks * (gauge / 1000 + SHOULDER_M);
  return tracks * (RAIL_WIDTH[tags.railway] ?? 4);
}

/**
 * Overpass railway ways -> ribbon-builder inputs. Tunnelled
 * reaches and unknown types are dropped; the bridge tag rides
 * through so decks span water; longest lines first under the cap.
 */
// cap 1200 / floor 20 m: the old 300-longest cap and 50 m floor
// dropped the switch throats and connectors that make a network -
// drawn lines ended mid-field (and the route graph needed healing
// across the holes). A city box draws whole now; sub-20 m stubs
// remain sub-pixel noise.
export function parseRailways(json, cap = 1200, minLenM = 20) {
  const out = [];
  for (const el of (json && json.elements) || []) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const tags = el.tags || {};
    if (!(tags.railway in RAIL_WIDTH)) continue;
    if (tags.tunnel && tags.tunnel !== 'no') continue; // underground
    const pts = el.geometry.map((g) => [g.lat, g.lon]);
    const len = lengthM(pts);
    if (len < minLenM) continue;
    out.push({
      id: el.id,
      pts,
      len,
      wM: railWidthOf(tags),
      color: RAIL_COLOR,
      bridge: tags.bridge === 'yes' || tags.bridge === 'viaduct',
      kind: tags.railway,
      name: tags.name || ''
    });
  }
  out.sort((a, b) => b.len - a.len);
  return out.slice(0, cap);
}

// The geometry IS the roads' gated ribbon builder (see rivers.js
// for the same reuse) - one exactness gate, three consumers.
export const railsGeometry = roadsGeometry;

/**
 * Map-matching: a train is rail-constrained by definition, but its
 * reported fix is not - radar positions carry GPS-grade error and
 * timetable interpolation cuts curve chords - so the drawn train
 * snaps to the drawn network by nearest-arc projection (the
 * standard light form of map-matching; with one sparse rail
 * corridor per neighbourhood the nearest arc IS the right arc).
 * A fix matching NO drawn arc within the gate stays unmatched -
 * the train is in a tunnel or on a way the cap dropped, and
 * drawing it on the grass would be inventing track.
 *
 * railIndex bins segments into a uniform grid so the per-frame
 * query touches only nearby arcs. Coordinates are the caller's
 * (the theme passes scene units); gate and cell share them.
 */
export function railIndex(polys, cell = 4) {
  const segs = [];
  const ends = []; // way-endpoint coordinates (heal candidates)
  for (const pts of polys) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      if (ax === bx && az === bz) continue;
      segs.push([ax, az, bx, bz]);
    }
    if (pts.length >= 2) ends.push(pts[0], pts[pts.length - 1]);
  }
  const grid = new Map();
  segs.forEach((s, i) => {
    const x0 = Math.floor(Math.min(s[0], s[2]) / cell);
    const x1 = Math.floor(Math.max(s[0], s[2]) / cell);
    const z0 = Math.floor(Math.min(s[1], s[3]) / cell);
    const z1 = Math.floor(Math.max(s[1], s[3]) / cell);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = cx + ':' + cz;
        let list = grid.get(k);
        if (!list) grid.set(k, (list = []));
        list.push(i);
      }
    }
  });
  // The graph over the same arcs: OSM junctions share their node
  // coordinates exactly, so quantized endpoints merge into graph
  // vertices; each segment becomes an edge of its true length.
  const Q = 1e-6;
  const nid = (x, z) => Math.round(x / Q) + ':' + Math.round(z / Q);
  const nodes = new Map(); // id -> [x, z]
  const adj = new Map(); // id -> [{to, len, seg}]
  segs.forEach((s, i) => {
    const a = nid(s[0], s[1]);
    const b = nid(s[2], s[3]);
    if (!nodes.has(a)) nodes.set(a, [s[0], s[1]]);
    if (!nodes.has(b)) nodes.set(b, [s[2], s[3]]);
    const len = Math.hypot(s[2] - s[0], s[3] - s[1]);
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push({to: b, len, seg: i});
    adj.get(b).push({to: a, len, seg: i});
  });
  const idx = {segs, grid, cell, nodes, adj, nid};
  // Heal dropped-connector holes. The parse drops sub-50 m ways -
  // switch throats and crossovers, exactly the pieces that stitch
  // a rail network together - so the graph shatters at junctions
  // (measured: Interlaken West and Ost attach 4 m and 7 m from
  // their arcs yet sit in components 36 m apart at the Ost
  // throat). Every WAY ENDPOINT within `heal` of a foreign,
  // non-incident arc reconnects through that arc's endpoints at
  // the exact partial lengths: station throats are precisely
  // where the dropped crossovers live, the healed gap is
  // sub-pixel at theme scale, and a T ending mid-segment (never
  // a shared vertex) connects exactly with d = 0. Interior
  // vertices do NOT heal - parallel open lines stay separate.
  // An endpoint heals to EVERY non-incident arc within the
  // radius, not just the nearest: at a throat the nearest arc is
  // often a parallel track already in the same component, and a
  // single heal would spend itself there while the real severed
  // continuation sits a few metres further.
  const heal = cell / 4; // ~57 m at the theme's 4-unit cell
  for (const [ux, uz] of ends) {
    const id = nid(ux, uz);
    const seen = new Set();
    const r = Math.max(1, Math.ceil(heal / cell));
    const cx0 = Math.floor(ux / cell);
    const cz0 = Math.floor(uz / cell);
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        for (const i of grid.get(cx0 + dx + ':' + (cz0 + dz)) || []) {
          if (seen.has(i)) continue;
          seen.add(i);
          const s = segs[i];
          // arcs incident to this node are not gaps
          if (nid(s[0], s[1]) === id || nid(s[2], s[3]) === id) continue;
          const vx = s[2] - s[0];
          const vz = s[3] - s[1];
          const t = Math.max(
            0,
            Math.min(
              1,
              ((ux - s[0]) * vx + (uz - s[1]) * vz) / (vx * vx + vz * vz)
            )
          );
          const d = Math.hypot(ux - (s[0] + t * vx), uz - (s[1] + t * vz));
          if (d > heal) continue;
          const L = Math.hypot(vx, vz);
          const a = nid(s[0], s[1]);
          const b = nid(s[2], s[3]);
          const ea = {to: a, len: d + t * L, seg: i};
          const eb = {to: b, len: d + (1 - t) * L, seg: i};
          adj.get(id).push(ea, eb);
          adj.get(a).push({to: id, len: ea.len, seg: i});
          adj.get(b).push({to: id, len: eb.len, seg: i});
        }
      }
    }
  }
  return idx;
}

/**
 * Nearest-arc projection of (x, z) onto the indexed network:
 * closed-form point-to-segment (t clamped to the arc), gated at
 * `gate` in the index's own units. Returns the foot point, the
 * arc's unit direction and the distance, or null past the gate.
 */
/**
 * Route-based map matching (the timetable form of Newson & Krumm's
 * problem): a moving train's two known truths are its stops and its
 * network - the straight chord between stops is neither, cutting
 * hundreds of metres across city blocks. railRoute runs Dijkstra
 * over the drawn rail graph between the two stop projections and
 * returns the routed polyline with its arc length; the caller
 * positions the train BY LENGTH along it (the same constant-speed
 * assumption the chord made, now on the real geometry). Endpoints
 * attach through nearest-arc projection within `gate`; a route
 * longer than `maxDetour` times the chord means the drawn network
 * is missing links for this leg - null, the caller falls back.
 */
export function railRoute(idx, ax, az, bx, bz, gate, maxDetour = 3) {
  const A = snapToRail(idx, ax, az, gate);
  const B = snapToRail(idx, bx, bz, gate);
  if (!A || !B) return null;
  const segOf = (p) => {
    // recover which arc the foot lies on (nearest arc again, but
    // keeping the index this time)
    let best = null;
    idx.segs.forEach((s, i) => {
      const vx = s[2] - s[0];
      const vz = s[3] - s[1];
      const t = Math.max(
        0,
        Math.min(
          1,
          ((p.x - s[0]) * vx + (p.z - s[1]) * vz) / (vx * vx + vz * vz)
        )
      );
      const d = Math.hypot(p.x - (s[0] + t * vx), p.z - (s[1] + t * vz));
      if (!best || d < best.d) best = {i, t, d};
    });
    return best;
  };
  const sa = segOf(A);
  const sb = segOf(B);
  if (!sa || !sb) return null;
  const chord = Math.hypot(bx - ax, bz - az);
  const mkPts = (pts) => {
    let len = 0;
    for (let i = 1; i < pts.length; i++)
      len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return {pts, len};
  };
  if (sa.i === sb.i) {
    // both feet on one arc: the route is the arc between them
    return mkPts([
      [A.x, A.z],
      [B.x, B.z]
    ]);
  }
  // Dijkstra from the two endpoints of A's arc, seeded with the
  // partial lengths from the foot point.
  const s0 = idx.segs[sa.i];
  const s1 = idx.segs[sb.i];
  const la = Math.hypot(s0[2] - s0[0], s0[3] - s0[1]);
  const lb = Math.hypot(s1[2] - s1[0], s1[3] - s1[1]);
  const a0 = idx.nid(s0[0], s0[1]);
  const a1 = idx.nid(s0[2], s0[3]);
  const b0 = idx.nid(s1[0], s1[1]);
  const b1 = idx.nid(s1[2], s1[3]);
  const dist = new Map([
    [a0, sa.t * la],
    [a1, (1 - sa.t) * la]
  ]);
  const prev = new Map();
  const done = new Set();
  const limit = chord * maxDetour + la + lb;
  // Settle the whole reachable ball of radius `limit`; then close
  // through WHICHEVER end of B's arc gives the shorter total - the
  // first-popped end is not necessarily it (the exact treatment of
  // a mid-arc target).
  while (true) {
    let u = null;
    let du = Infinity;
    for (const [k, v] of dist) {
      if (!done.has(k) && v < du) {
        u = k;
        du = v;
      }
    }
    if (u === null || du > limit) break;
    done.add(u);
    for (const e of idx.adj.get(u) || []) {
      const nd = du + e.len;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, u);
      }
    }
  }
  const t0 = (dist.get(b0) ?? Infinity) + sb.t * lb;
  const t1 = (dist.get(b1) ?? Infinity) + (1 - sb.t) * lb;
  const total = Math.min(t0, t1);
  if (!(total <= limit)) return null;
  const pts = [[B.x, B.z]];
  let n = t0 <= t1 ? b0 : b1;
  while (n) {
    pts.push(idx.nodes.get(n));
    n = prev.get(n);
  }
  pts.push([A.x, A.z]);
  pts.reverse();
  return mkPts(pts);
}

/**
 * The point at length fraction f along a routed polyline, with the
 * local unit direction (the track bearing there).
 */
export function routePoint(route, f) {
  const pts = route.pts;
  let want = Math.max(0, Math.min(1, f)) * route.len;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dz = pts[i][1] - pts[i - 1][1];
    const l = Math.hypot(dx, dz);
    if (want <= l || i === pts.length - 1) {
      const t = l > 0 ? want / l : 0;
      return {
        x: pts[i - 1][0] + dx * Math.min(t, 1),
        z: pts[i - 1][1] + dz * Math.min(t, 1),
        dx: l > 0 ? dx / l : 1,
        dz: l > 0 ? dz / l : 0
      };
    }
    want -= l;
  }
  return {x: pts[0][0], z: pts[0][1], dx: 1, dz: 0};
}

export function snapToRail(idx, x, z, gate) {
  const c = idx.cell;
  const r = Math.max(1, Math.ceil(gate / c));
  const cx0 = Math.floor(x / c);
  const cz0 = Math.floor(z / c);
  let best = null;
  const seen = new Set();
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      const list = idx.grid.get(cx0 + dx + ':' + (cz0 + dz));
      if (!list) continue;
      for (const i of list) {
        if (seen.has(i)) continue;
        seen.add(i);
        const [ax, az, bx, bz] = idx.segs[i];
        const vx = bx - ax;
        const vz = bz - az;
        const t = Math.max(
          0,
          Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz))
        );
        const qx = ax + t * vx;
        const qz = az + t * vz;
        const d = Math.hypot(x - qx, z - qz);
        if (d <= gate && (!best || d < best.d)) {
          const L = Math.hypot(vx, vz);
          best = {x: qx, z: qz, dx: vx / L, dz: vz / L, d};
        }
      }
    }
  }
  return best;
}
