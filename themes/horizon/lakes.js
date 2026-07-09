/**
 * lakes.js - real inland water. The terrain's sea rule (elevation
 * <= 0.3 m) can never see a lake: Interlaken rendered as a town
 * between two grass basins. OSM knows better - natural=water
 * polygons via the SAME Overpass endpoint the forests already
 * use. Big lakes arrive as RELATIONS whose outer boundary is
 * split across dozens of ways (Thunersee: 42), so this module
 * owns the geometry work, all of it gated:
 *  - stitchRings: assemble outer/inner member ways into closed
 *    rings by exact endpoint matching (reversing segments as
 *    needed) - inner rings ride along so islands stay dry under
 *    the even-odd rule
 *  - decimate: thin shoreline vertices to a minimum separation
 *    (endpoints kept - stitching happened first); the wet mask
 *    lives on ~60 m texels, so metre-scale shoreline detail is
 *    invisible and point-in-polygon cost is not
 *  - lakeMask: project the geodetic rings onto the current roam
 *    box (roam.geoToScene - the same gated Earth anchoring as
 *    everything else) and scanline-rasterise them even-odd into
 *    an N x N index grid: the terrain sampler's hot path is an
 *    O(1) lookup, and the raster is gated against the pointwise
 *    even-odd test (smoke.js inRing - one polygon model)
 * Each lake's SURFACE LEVEL is measured: the median DEM elevation
 * of its shoreline vertices - the shore is at lake level by
 * definition. The sampler draws the surface FLAT at that level
 * through the same asinh datum and settle offset as the sea.
 */

import {inRing} from './smoke.js';
import {geoToScene} from './roam.js';

// Assemble relation member ways (role outer/inner, each a list of
// [lat, lon]) into closed rings by endpoint matching. Returns the
// closed rings (first point == last point removed); segments that
// cannot close are dropped (a truncated bbox crop, not an error).
export function stitchRings(segments) {
  const segs = segments.filter((s) => s.length >= 2).map((s) => s.slice());
  const rings = [];
  const key = (p) => p[0].toFixed(7) + ',' + p[1].toFixed(7);
  while (segs.length) {
    const ring = segs.shift().slice();
    let grew = true;
    while (grew && key(ring[0]) !== key(ring[ring.length - 1])) {
      grew = false;
      const tail = key(ring[ring.length - 1]);
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (key(s[0]) === tail) {
          ring.push(...s.slice(1));
        } else if (key(s[s.length - 1]) === tail) {
          ring.push(...s.slice(0, -1).reverse());
        } else continue;
        segs.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (ring.length >= 4 && key(ring[0]) === key(ring[ring.length - 1])) {
      ring.pop(); // drop the duplicated closing point
      rings.push(ring);
    }
  }
  return rings;
}

// Thin a ring to >= minSepM between kept vertices (equirectangular
// metres; first vertex always kept). Shoreline detail below the
// wet-mask texel is invisible - this bounds the raster cost.
export function decimate(ring, minSepM = 25) {
  if (ring.length <= 8) return ring.slice();
  const mLat = 111320;
  const out = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    const a = out[out.length - 1];
    const b = ring[i];
    const dx = (b[1] - a[1]) * mLat * Math.cos((a[0] * Math.PI) / 180);
    const dy = (b[0] - a[0]) * mLat;
    if (Math.hypot(dx, dy) >= minSepM) out.push(b);
  }
  return out.length >= 4 ? out : ring.slice(0, 4);
}

/**
 * Overpass water elements -> lakes: [{id, name, rings}] with rings
 * geodetic [[lat, lon], ...], outer and inner together (even-odd).
 * Ways are single rings; relations are stitched. Tiny features
 * (bbox under minSpanM) are dropped - smaller than a mask texel.
 */
export function parseWater(json, minSpanM = 120) {
  const out = [];
  const mLat = 111320;
  const spanOk = (rings) => {
    let la0 = 90;
    let la1 = -90;
    let lo0 = 180;
    let lo1 = -180;
    for (const r of rings)
      for (const [la, lo] of r) {
        la0 = Math.min(la0, la);
        la1 = Math.max(la1, la);
        lo0 = Math.min(lo0, lo);
        lo1 = Math.max(lo1, lo);
      }
    const w = (lo1 - lo0) * mLat * Math.cos((la0 * Math.PI) / 180);
    return (la1 - la0) * mLat >= minSpanM && w >= minSpanM;
  };
  for (const el of (json && json.elements) || []) {
    if (el.type === 'way' && el.geometry && el.geometry.length >= 4) {
      const ring = el.geometry.map((g) => [g.lat, g.lon]);
      const rings = [decimate(ring)];
      if (spanOk(rings))
        out.push({id: el.id, name: (el.tags && el.tags.name) || '', rings});
    } else if (el.type === 'relation' && el.members) {
      const grab = (role) =>
        el.members
          .filter((m) => m.type === 'way' && m.role === role && m.geometry)
          .map((m) => m.geometry.map((g) => [g.lat, g.lon]));
      const rings = [
        ...stitchRings(grab('outer')),
        ...stitchRings(grab('inner'))
      ].map((r) => decimate(r));
      if (rings.length && spanOk(rings))
        out.push({id: el.id, name: (el.tags && el.tags.name) || '', rings});
    }
  }
  return out;
}

// Median of an array (its own copy; even length takes the lower).
const median = (a) => {
  const s = a.slice().sort((x, y) => x - y);
  return s[(s.length - 1) >> 1];
};

/**
 * The wet mask for one roam box: project each lake's rings through
 * the gated Earth anchoring, measure its surface level (median DEM
 * elevation over up to 24 evenly spread shoreline vertices), and
 * scanline-rasterise even-odd into an n x n Int16 grid of lake
 * indices (-1 = no lake), row j = north to south (+z). demElev is
 * the theme's (x, z) -> metres sampler. Lakes whose rings miss the
 * box entirely are skipped; the returned {grid, n, world, elevs}
 * plugs straight into terrain-sample.sampleDem.
 */
export function lakeMask(lakes, anchor, world, n, demElev) {
  const grid = new Int16Array(n * n).fill(-1);
  const elevs = [];
  const half = world / 2;
  let idx = 0;
  for (const lake of lakes) {
    const scene = lake.rings.map((r) =>
      r.map(([la, lo]) => {
        const s = geoToScene(la, lo, anchor);
        return [s.x, s.z];
      })
    );
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const r of scene)
      for (const [x, z] of r) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        z0 = Math.min(z0, z);
        z1 = Math.max(z1, z);
      }
    if (x1 < -half || x0 > half || z1 < -half || z0 > half) continue;
    // Measured surface level: the shoreline IS the lake level.
    const verts = scene.flat();
    const step = Math.max(1, Math.floor(verts.length / 24));
    const es = [];
    for (let k = 0; k < verts.length; k += step) {
      const [x, z] = verts[k];
      if (Math.abs(x) <= half && Math.abs(z) <= half) es.push(demElev(x, z));
    }
    if (!es.length) continue;
    const elev = median(es);
    elevs.push(elev);
    // Even-odd scanline fill over the grid rows this lake spans.
    const j0 = Math.max(0, Math.floor(((z0 + half) / world) * n));
    const j1 = Math.min(n - 1, Math.ceil(((z1 + half) / world) * n));
    for (let j = j0; j <= j1; j++) {
      const z = ((j + 0.5) / n) * world - half;
      const xs = [];
      for (const r of scene) {
        for (let i = 0; i < r.length; i++) {
          const [ax, az] = r[i];
          const [bx, bz] = r[(i + 1) % r.length];
          if (az <= z !== bz <= z)
            xs.push(ax + ((z - az) / (bz - az)) * (bx - ax));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil(((xs[k] + half) / world) * n - 0.5));
        const i1 = Math.min(
          n - 1,
          Math.floor(((xs[k + 1] + half) / world) * n - 0.5)
        );
        for (let i = i0; i <= i1; i++) grid[j * n + i] = idx;
      }
    }
    idx++;
  }
  return {grid, n, world, elevs};
}

// O(1) hot-path lookup: the lake index under scene (x, z), or -1.
export function lakeAt(mask, x, z) {
  if (!mask) return -1;
  const {grid, n, world} = mask;
  const i = Math.floor(((x + world / 2) / world) * n);
  const j = Math.floor(((z + world / 2) / world) * n);
  if (i < 0 || i >= n || j < 0 || j >= n) return -1;
  return grid[j * n + i];
}

// The pointwise truth the raster is gated against: even-odd over
// the same scene-projected rings (smoke.js inRing - one model).
export function inLakeExact(sceneRings, x, z) {
  let inside = false;
  for (const r of sceneRings) if (inRing(r, x, z)) inside = !inside;
  return inside;
}
