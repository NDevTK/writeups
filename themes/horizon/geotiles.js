/**
 * geotiles.js - slippy-tile math for the OSM vector layers, gated by
 * geotiles-reference.mjs.
 *
 * The layers used to fetch ONE Overpass box per anchor: roam 4 km and the
 * new box re-downloaded almost everything the old box already held,
 * because the cache key was the anchor, not the ground. Like a map, the
 * data should be fetched in TILES - fixed geographic cells (standard
 * OSM/Google slippy grid, so a tile's identity is universal) - each
 * fetched once, cached by its own key, and reassembled for whatever box
 * the view needs. Roam to the next anchor and only the edge tiles are
 * new; everything else is already on disk. This is also the foundation
 * for loading tiles PAST the current box toward wherever the camera
 * looks: a tile is a tile, wherever it is.
 *
 * A way that crosses a tile edge is returned by Overpass for every tile
 * it intersects, so reassembly dedupes by element id (unionElements).
 * Pure math + pure merge - no fetch here; the theme does its own fetches
 * through its mirrors and caches through geocache.
 */

const RAD = Math.PI / 180;

/** The slippy tile {x, y} containing (lat, lon) at zoom z. */
export function tileOf(lat, lon, z) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const s = Math.sin(Math.max(-85.0511, Math.min(85.0511, lat)) * RAD);
  const y = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n);
  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y)),
    z
  };
}

/** The geodetic bounds {s, w, n, e} of a slippy tile. */
export function tileBounds(x, y, z) {
  const n = 2 ** z;
  const lonOf = (tx) => (tx / n) * 360 - 180;
  const latOf = (ty) => {
    const a = Math.PI * (1 - (2 * ty) / n);
    return (Math.atan(Math.sinh(a)) / Math.PI) * 180;
  };
  return {s: latOf(y + 1), w: lonOf(x), n: latOf(y), e: lonOf(x + 1)};
}

/** The tile's Overpass bbox string "s,w,n,e" (4 dp, as the theme uses). */
export function tileBbox(x, y, z) {
  const b = tileBounds(x, y, z);
  return (
    b.s.toFixed(4) +
    ',' +
    b.w.toFixed(4) +
    ',' +
    b.n.toFixed(4) +
    ',' +
    b.e.toFixed(4)
  );
}

/** A stable cache-key fragment for a tile. */
export function tileKey(x, y, z) {
  return z + '/' + x + '/' + y;
}

/**
 * Every tile at zoom z that intersects the geodetic box {s, w, n, e},
 * row-major. The box a view needs is covered exactly - no more, no less.
 */
export function tilesCovering(s, w, n, e, z) {
  const tl = tileOf(n, w, z);
  const br = tileOf(s, e, z);
  const out = [];
  for (let y = tl.y; y <= br.y; y++)
    for (let x = tl.x; x <= br.x; x++) out.push({x, y, z});
  return out;
}

/**
 * Merge per-tile Overpass element arrays into one, deduped by element id
 * (a way crossing a tile edge is returned by every tile it touches).
 * Order is first-seen, so nearer-first tile order is preserved.
 */
export function unionElements(arrays) {
  const seen = new Set();
  const out = [];
  for (const arr of arrays || []) {
    for (const el of arr || []) {
      if (!el || seen.has(el.id)) continue;
      seen.add(el.id);
      out.push(el);
    }
  }
  return out;
}
