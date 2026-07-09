// Reference printer for the terrain sampler (node
// terrain-sample-reference.mjs). This math was inline in the
// theme (ungated) until the terrain worker needed it too - now it
// lives once and the gate holds it:
//  - img kind: the mercator pixel mapping reproduced independently
//    here, and bilinear held EXACT on a field linear in pixel
//    coordinates; edge clamping
//  - grid kind: corners exact, centre the exact mean, clamped
//    outside the box
//  - the sea rule and datum: e <= 0.3 m draws at sea level with
//    the -0.6 settle, land carries the asinh compression plus the
//    Earth-anchored micro-relief IDENTITY against roam.microRelief
//  - anchor independence at the sample() level: the same geodetic
//    point over a flat DEM reads the same y from two roam boxes
import {
  MICRO_GRID,
  MICRO_IMG,
  WATER_E,
  WATER_Y_OFF,
  demElev,
  sampleDem
} from './terrain-sample.js';
import {geoToScene, microRelief, sceneToGeo} from './roam.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const WORLD = 280;

// A synthetic stitched-canvas DEM whose elevation is LINEAR in
// mercator pixel coordinates - bilinear interpolation of a linear
// field is exact, so the sampler must reproduce it to fp.
function imgDem(lat, lon) {
  const worldPx = 2 ** 12 * 256;
  const px = (lo) => ((lo + 180) / 360) * worldPx;
  const py = (la) => {
    const r = (la * Math.PI) / 180;
    return (
      ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * worldPx
    );
  };
  const mLat = 111320;
  const mLon = Math.max(mLat * Math.cos((lat * Math.PI) / 180), 1e-6);
  const dLat = 8000 / mLat;
  const dLon = 8000 / mLon;
  const ox = Math.floor(px(lon - dLon) / 256) * 256;
  const oy = Math.floor(py(lat + dLat) / 256) * 256;
  const w = 1024;
  const h = 1024;
  const elev = new Float32Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) elev[j * w + i] = 500 + 0.25 * i + 0.5 * j;
  return {
    kind: 'img',
    w,
    h,
    elev,
    ox,
    oy,
    worldPx,
    lat,
    lon,
    dLat,
    dLon,
    px,
    py
  };
}

{
  // img kind: at scene (x, z) the sampler must land on the exact
  // linear field value at the independently computed mercator
  // pixel; beyond the canvas it clamps to the edge sample.
  const dem = imgDem(46.62, 8.04);
  let worst = 0;
  for (const [x, z] of [
    [0, 0],
    [55.5, -87.25],
    [-140, 140],
    [3.1, 4.9]
  ]) {
    const la = dem.lat - (z / WORLD) * 2 * dem.dLat;
    const lo = dem.lon + (x / WORLD) * 2 * dem.dLon;
    const gx = dem.px(lo) - dem.ox;
    const gy = dem.py(la) - dem.oy;
    const want = 500 + 0.25 * gx + 0.5 * gy;
    worst = Math.max(worst, Math.abs(demElev(dem, x, z, WORLD) - want));
  }
  const edge = demElev(dem, 1e6, 0, WORLD); // clamped at gx = w-1.001
  const gyC = dem.py(dem.lat) - dem.oy;
  const edgeWant = 500 + 0.25 * (dem.w - 1.001) + 0.5 * gyC;
  check(
    'mercator bilinear',
    worst < 1e-9 && Math.abs(edge - edgeWant) < 1e-9,
    `linear-in-pixel field reproduced to ${worst.toExponential(1)} m at 4 scene points (independent mercator mapping); far east clamps to the edge column exactly`
  );
}

{
  // grid kind: corners exact, centre of a 2x2 cell the exact mean,
  // outside the box clamped to the border.
  const dem = {kind: 'grid', n: 3, grid: [10, 20, 30, 40, 50, 60, 70, 80, 90]};
  // u/v mapping: x=-140 -> u=0, x=+140 -> u=2; z=+140 -> v=0.
  const c00 = demElev(dem, -140, 140, WORLD); // grid[0]
  const c22 = demElev(dem, 140, -140, WORLD); // grid[8]
  const mid = demElev(dem, 0, 0, WORLD); // centre = 50
  const clamped = demElev(dem, -500, 140, WORLD);
  check(
    'grid bilinear',
    c00 === 10 && c22 === 90 && mid === 50 && clamped === 10,
    `corners exact (10, 90), centre the exact mean (50), outside the box clamps to the border`
  );
}

{
  // The sea rule and the datum: at or below WATER_E the surface is
  // the sea drawn at the exact settled level; just above it is
  // land carrying asinh(e - c) plus EXACTLY the Earth-anchored
  // micro-relief (identity vs roam.microRelief - one model).
  const flat = (e) => ({
    kind: 'grid',
    n: 3,
    grid: new Array(9).fill(e)
  });
  const anchor = {lat: 46.62, lon: 8.04};
  const c = 300;
  const sea = sampleDem(flat(WATER_E), 12, -7, c, anchor, WORLD);
  const land = sampleDem(flat(120), 12, -7, c, anchor, WORLD);
  const wantSea = 16 * Math.asinh((0 - c) / 500) + WATER_Y_OFF;
  const wantLand =
    16 * Math.asinh((120 - c) / 500) +
    MICRO_GRID * (microRelief(12, -7, anchor) - 0.5);
  check(
    'sea rule and datum',
    sea.water === true &&
      sea.y === wantSea &&
      land.water === false &&
      land.y === wantLand &&
      MICRO_IMG === 0.5 &&
      MICRO_GRID === 1.6,
    `e = ${WATER_E} m -> water at ${wantSea.toFixed(4)} (exact settle); 120 m land = asinh datum + ${MICRO_GRID} x Earth-anchored relief, identity vs roam.microRelief`
  );
}

{
  // Anchor independence at the sample() level: over a FLAT img box
  // the same geodetic point must read the same surface from two
  // roam anchors (the DEM part is constant; the micro-relief part
  // is Earth-anchored by roam's gated overlap landmark - this
  // seals the composition).
  const A = {lat: 46.62, lon: 8.04};
  const gB = sceneToGeo(30, 30, A);
  const B = {lat: gB.lat, lon: gB.lon};
  const mk = (an) => {
    const d = imgDem(an.lat, an.lon);
    d.elev.fill(777);
    return d;
  };
  const demA = mk(A);
  const demB = mk(B);
  let worst = 0;
  for (const [x, z] of [
    [5, 5],
    [-40, 33],
    [61.7, -8.2]
  ]) {
    const g = sceneToGeo(x, z, A);
    const sB = geoToScene(g.lat, g.lon, B);
    worst = Math.max(
      worst,
      Math.abs(
        sampleDem(demA, x, z, 300, A, WORLD).y -
          sampleDem(demB, sB.x, sB.z, 300, B, WORLD).y
      )
    );
  }
  check(
    'anchor independence',
    worst < 1e-9,
    `flat 777 m box: the same geodetic points read the same y from two anchors to ${worst.toExponential(1)} (the roam overlap property survives the full sampler)`
  );
}

process.exit(fail ? 1 : 0);
