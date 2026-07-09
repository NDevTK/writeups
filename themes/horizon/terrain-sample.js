/**
 * Terrain sampling - the single source shared by the theme
 * (Horizon.html), the terrain worker (terrain-worker.js, which
 * moves the roam hop's heavy bakes off the main thread) and the
 * reference printer (terrain-sample-reference.mjs).
 *
 * This is the exact math that turns the fetched DEM into the
 * scene surface - it lived inline in the theme (ungated) until
 * the worker needed it too, and the model must live once:
 *  - img kind (AWS terrarium tiles): scene x/z -> the box's
 *    equirectangular lat/lon -> Web-Mercator pixel -> bilinear
 *    over the stitched canvas, clamped at its edges.
 *  - grid kind (open-meteo elevation fallback): bilinear over the
 *    N x N box-aligned grid.
 *  - sample: the asinh height compression around the box's
 *    elevation datum (16 * asinh((e - c)/500)), the sea rule
 *    (e <= WATER_E metres reads as water, drawn at sea level with
 *    the WATER_Y_OFF settle), and the Earth-anchored micro-relief
 *    seasoning (roam.js microRelief - the same hillside dresses
 *    the same from any roam box, a gated landmark) at MICRO_IMG
 *    for 30 m tile data and MICRO_GRID for the coarse fallback.
 */

import {microRelief} from './roam.js';

export const WATER_E = 0.3; // metres AMSL at or below: the sea
export const WATER_Y_OFF = -0.6; // scene settle below the waterline
export const MICRO_IMG = 0.5; // micro-relief amplitude, tile DEM
export const MICRO_GRID = 1.6; // ...and the coarse grid fallback

const RAD = Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Elevation (metres AMSL) at scene x/z through the fetched DEM.
export function demElev(dem, x, z, world) {
  if (dem.kind === 'img') {
    // Scene x/z -> lat/lon -> mercator pixel, bilinear on the tiles.
    const la = dem.lat - (z / world) * 2 * dem.dLat;
    const lo = dem.lon + (x / world) * 2 * dem.dLon;
    const r = la * RAD;
    const gx = clamp(
      ((lo + 180) / 360) * dem.worldPx - dem.ox,
      0,
      dem.w - 1.001
    );
    const gy = clamp(
      ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) *
        dem.worldPx -
        dem.oy,
      0,
      dem.h - 1.001
    );
    const i = Math.floor(gx);
    const j = Math.floor(gy);
    const e = dem.elev;
    const w = dem.w;
    return lerp(
      lerp(e[j * w + i], e[j * w + i + 1], gx - i),
      lerp(e[(j + 1) * w + i], e[(j + 1) * w + i + 1], gx - i),
      gy - j
    );
  }
  // x east, z south, in scene units -> bilinear over the DEM grid.
  const N = dem.n;
  const u = clamp(x / world + 0.5, 0, 1) * (N - 1);
  const v = clamp(1 - (z / world + 0.5), 0, 1) * (N - 1);
  const i = Math.min(Math.floor(u), N - 2);
  const j = Math.min(Math.floor(v), N - 2);
  const g = dem.grid;
  return lerp(
    lerp(g[j * N + i], g[j * N + i + 1], u - i),
    lerp(g[(j + 1) * N + i], g[(j + 1) * N + i + 1], u - i),
    v - j
  );
}

// The scene surface at x/z: real metres asinh-compressed around
// the box datum, the sea rule, and the Earth-anchored seasoning.
export function sampleDem(dem, x, z, centerElev, anchor, world, lakes) {
  const e = demElev(dem, x, z, world);
  let water = e <= WATER_E;
  let waterE = 0; // the sea sits at the datum
  // Real inland water (lakes.js): the OSM wet mask puts a FLAT
  // surface at the lake's measured level - the sea rule alone can
  // never see a lake above 0.3 m.
  if (!water && lakes) {
    const {grid, n, world: lw, elevs} = lakes;
    const i = Math.floor(((x + lw / 2) / lw) * n);
    const j = Math.floor(((z + lw / 2) / lw) * n);
    if (i >= 0 && i < n && j >= 0 && j < n) {
      const li = grid[j * n + i];
      if (li >= 0) {
        water = true;
        waterE = elevs[li];
      }
    }
  }
  let y = 16 * Math.asinh((e - centerElev) / 500);
  if (water) {
    y = 16 * Math.asinh((waterE - centerElev) / 500) + WATER_Y_OFF;
  } else {
    const micro = dem.kind === 'img' ? MICRO_IMG : MICRO_GRID;
    y += micro * (microRelief(x, z, anchor) - 0.5);
  }
  return {e, y, water};
}
