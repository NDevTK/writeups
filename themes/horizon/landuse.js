/**
 * landuse.js - real ground cover. The terrain paints one grass
 * everywhere the DEM is low and dry, but the ground is not one
 * grass: OSM landuse/natural polygons say where the farmland,
 * meadows, residential blocks, allotments and bare rock actually
 * are - through the SAME Overpass mirrors as forests, lakes,
 * buildings and roads. Pure JS (no renderer import), gated:
 *  - CLASS_ALBEDO: the class -> linear albedo table; only classes
 *    in the table are kept (unknown landuse stays base grass -
 *    the truthful default)
 *  - parseLanduse: ways are single rings, relations stitch via
 *    the lakes' gated endpoint matching; rings thinned by the
 *    lakes' gated decimate (the tint raster texel is ~80 m)
 *  - landTint: project rings through the gated Earth anchoring
 *    and scanline-rasterise even-odd into an n x n RGBA field
 *    (rgb = class albedo, a = coverage), painted LARGEST FIRST so
 *    an orchard inside farmland wins its own texels; gated
 *    against the pointwise even-odd test (smoke.js inRing - the
 *    one polygon model, same as the lake mask)
 * The terrain shader mixes the field into its grass albedo only -
 * rock faces, snow and the sea never read it.
 */

import {decimate, stitchRings} from './lakes.js';
import {geoToScene} from './roam.js';
import {cropAlbedoFromTags} from './crops.js';
import {forestAlbedoFromTags} from './forest.js';
import {grassColor} from './grassland.js';

// Linear albedos per OSM class (same space as the terrain's grass
// vec3(0.09..0.19, 0.21..0.33, 0.05..0.08) ramp).
export const CLASS_ALBEDO = {
  farmland: [0.28, 0.23, 0.11],
  farmyard: [0.27, 0.21, 0.13],
  meadow: [0.13, 0.29, 0.06],
  grass: [0.13, 0.3, 0.07],
  grassland: [0.15, 0.28, 0.08],
  orchard: [0.1, 0.24, 0.06],
  vineyard: [0.15, 0.22, 0.08],
  allotments: [0.17, 0.24, 0.1],
  cemetery: [0.12, 0.25, 0.08],
  recreation_ground: [0.12, 0.28, 0.07],
  village_green: [0.13, 0.3, 0.07],
  forest: [0.07, 0.16, 0.05],
  wood: [0.07, 0.16, 0.05], // natural=wood - same dark canopy as forest
  residential: [0.2, 0.2, 0.16],
  industrial: [0.26, 0.25, 0.24],
  commercial: [0.25, 0.24, 0.23],
  retail: [0.25, 0.24, 0.23],
  railway: [0.22, 0.19, 0.17],
  quarry: [0.33, 0.3, 0.25],
  bare_rock: [0.32, 0.29, 0.25],
  scree: [0.3, 0.28, 0.24],
  sand: [0.45, 0.4, 0.3],
  beach: [0.45, 0.4, 0.3]
};

// Equirectangular span check (like parseWater's) - features under
// minSpanM are below the tint raster texel.
const spanOk = (rings, minSpanM) => {
  const mLat = 111320;
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

// Geodetic ring area (shoelace, m^2) for the paint order.
const ringArea = (r) => {
  const mLat = 111320;
  const mLon = mLat * Math.cos((r[0][0] * Math.PI) / 180);
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const [la1, lo1] = r[i];
    const [la2, lo2] = r[(i + 1) % r.length];
    s += lo1 * mLon * (la2 * mLat) - lo2 * mLon * (la1 * mLat);
  }
  return Math.abs(s) / 2;
};

// The classes that carry a real crop (farm parcels and orchards):
// on these, an OSM crop/produce/trees tag overrides the flat class
// albedo with the crop's own canopy colour (crops.js).
export const CROP_HOSTS = new Set([
  'farmland',
  'farmyard',
  'allotments',
  'orchard',
  'vineyard'
]);

// The classes that carry a real forest: on these an OSM
// leaf_type/leaf_cycle overrides the flat class albedo with the
// leaf-type + seasonal canopy colour (forest.js).
export const FOREST_HOSTS = new Set(['forest', 'wood']);

// The grass-family classes: turf that greens and browns with the
// season (grassland.js) - a month/latitude modulation of the base
// green, no OSM tag needed.
export const GRASS_CLASSES = new Set([
  'grass',
  'meadow',
  'grassland',
  'village_green',
  'recreation_ground',
  'cemetery'
]);

/**
 * Overpass landuse/natural elements -> [{id, cls, albedo, rings,
 * area}], largest area LAST in paint order terms (the caller
 * paints in array order; we sort area-DESCENDING so small parcels
 * painted later win their texels). Classes outside CLASS_ALBEDO
 * are dropped - base grass is the truthful unknown.
 *
 * When `month` is supplied, a CROP_HOST parcel carrying a recognised
 * crop/produce/trees tag wears its crop canopy colour (crops.js), and a
 * FOREST_HOST parcel carrying leaf_type/leaf_cycle wears its leaf-type +
 * seasonal canopy colour (forest.js), and a GRASS_CLASS parcel's green
 * greens and browns with the season (grassland.js), all shifted by
 * `month`/`lat`; an unrecognised or absent tag keeps the flat class
 * albedo, so the tagless default is unchanged.
 */
export function parseLanduse(json, minSpanM = 60, cap = 400, month = 0, lat) {
  const out = [];
  for (const el of (json && json.elements) || []) {
    const tags = el.tags || {};
    const cls = tags.landuse || tags.natural;
    let albedo = CLASS_ALBEDO[cls];
    if (!albedo) continue;
    if (month && CROP_HOSTS.has(cls)) {
      const crop = cropAlbedoFromTags(tags, month, lat);
      if (crop) albedo = crop;
    } else if (month && FOREST_HOSTS.has(cls)) {
      const canopy = forestAlbedoFromTags(tags, month, lat);
      if (canopy) albedo = canopy;
    } else if (month && GRASS_CLASSES.has(cls)) {
      albedo = grassColor(albedo, month, lat);
    }
    let rings = null;
    if (el.type === 'way' && el.geometry && el.geometry.length >= 4) {
      let ring = el.geometry.map((g) => [g.lat, g.lon]);
      const f = ring[0];
      const l = ring[ring.length - 1];
      if (f[0] === l[0] && f[1] === l[1]) ring = ring.slice(0, -1);
      if (ring.length >= 3) rings = [decimate(ring, 20)];
    } else if (el.type === 'relation' && el.members) {
      const grab = (role) =>
        el.members
          .filter((m) => m.type === 'way' && m.role === role && m.geometry)
          .map((m) => m.geometry.map((g) => [g.lat, g.lon]));
      rings = [
        ...stitchRings(grab('outer')),
        ...stitchRings(grab('inner'))
      ].map((r) => decimate(r, 20));
      if (!rings.length) rings = null;
    }
    if (!rings || !spanOk(rings, minSpanM)) continue;
    out.push({
      id: el.id,
      cls,
      albedo,
      rings,
      area: rings.reduce((s, r) => s + ringArea(r), 0)
    });
  }
  out.sort((a, b) => b.area - a.area); // paint large first, small win
  return out.slice(0, cap);
}

/**
 * The tint field for one roam box: n x n RGBA Float32Array (rgb =
 * class albedo, a = coverage 1/0), row 0 = SOUTH edge (the same
 * orientation the terrain shader samples: v = 0.5 - z/world).
 * Polygons painted in array order (parseLanduse sorted them
 * largest first). Returns null when nothing painted - the caller
 * keeps the base grass.
 */
export function landTint(polys, anchor, world, n, soilFactor = 1) {
  const data = new Float32Array(n * n * 4);
  const half = world / 2;
  let painted = 0;
  for (const p of polys) {
    const scene = p.rings.map((r) =>
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
    let hit = false;
    // Row j = north to south in +z; the TEXTURE row is flipped to
    // south-first at write time (n - 1 - j) to match the shader.
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
      const row = n - 1 - j;
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil(((xs[k] + half) / world) * n - 0.5));
        const i1 = Math.min(
          n - 1,
          Math.floor(((xs[k + 1] + half) / world) * n - 0.5)
        );
        const f = SOIL_CLASSES.has(p.cls) ? soilFactor : 1;
        for (let i = i0; i <= i1; i++) {
          const o = (row * n + i) * 4;
          data[o] = p.albedo[0] * f;
          data[o + 1] = p.albedo[1] * f;
          data[o + 2] = p.albedo[2] * f;
          data[o + 3] = 1;
          hit = true;
        }
      }
    }
    if (hit) painted++;
  }
  return painted ? {data, n, world, painted} : null;
}

// ---- Wet soil darkens: Lobell & Asner (2002, SSSAJ 66) ----
// Their laboratory result: soil reflectance falls EXPONENTIALLY
// with moisture expressed as degree of saturation, similarly
// across soil types - R = b + a exp(-c theta_sat) - and in the
// visible band the decay saturates by ~0.20 m3/m3 volumetric.
// Two documented parameters close the per-soil unknowns: the
// classic visible-band figure that saturated soil reflects about
// HALF of dry (SAT_RATIO), and a typical loam porosity to convert
// the forecast's volumetric moisture to degree of saturation. The
// decay constant is DERIVED from the paper's saturation point:
// exp(-c * 0.20/porosity) = 1/20 (95% of the decay spent there).
export const SOIL_POROSITY = 0.45;
export const SOIL_SAT_RATIO = 0.5;
export const SOIL_C = Math.log(20) / (0.2 / SOIL_POROSITY);

// The bare-soil classes the darkening applies to - vegetated
// tints (meadow, grass, forest) hide their soil under canopy.
export const SOIL_CLASSES = new Set([
  'farmland',
  'farmyard',
  'allotments',
  'quarry',
  'sand',
  'beach'
]);

// Volumetric topsoil moisture (m3/m3, the forecast's
// soil_moisture_0_to_1cm) -> albedo factor. Dry ground is 1;
// missing data is 1 - nothing invented.
export function soilDarkening(theta) {
  if (!Number.isFinite(theta) || theta <= 0) return 1;
  const sat = Math.min(1, theta / SOIL_POROSITY);
  return SOIL_SAT_RATIO + (1 - SOIL_SAT_RATIO) * Math.exp(-SOIL_C * sat);
}

// The pointwise probe the raster is gated against (and the smoke
// checks with): the painted albedo under scene (x, z), or null.
export function tintAt(tint, x, z) {
  if (!tint) return null;
  const {data, n, world} = tint;
  const i = Math.floor(((x + world / 2) / world) * n);
  const j = Math.floor(((z + world / 2) / world) * n);
  if (i < 0 || i >= n || j < 0 || j >= n) return null;
  const o = ((n - 1 - j) * n + i) * 4;
  return data[o + 3] ? [data[o], data[o + 1], data[o + 2]] : null;
}
