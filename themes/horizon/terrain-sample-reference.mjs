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
  despikeDEM,
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

{
  // Hampel despike (Davies & Gather 1993; Pearson 2002): the AWS
  // terrarium tiles rarely carry garbage streaks - the MEASURED
  // Nelson needle (tile 12/4019/2564: a column of -92/134/448/531
  // m flanked by -248/-276 m inside a 3-6 m harbour, which baked
  // into a 500-m waterfront spike). Landmarks: (1) that exact
  // captured patch planted on a 5 m plain repairs completely (every
  // repaired cell lands on its neighbourhood median, here the
  // plain) and the un-spiked cells are bit-identical; (2) a
  // genuine 800-m ridge five pixels wide survives BIT-IDENTICAL
  // (the neighbourhood median climbs with the feature); (3) a
  // 120-m single-pixel sea stack survives (the 150 m floor - Old
  // Man of Hoy, 137 m, is the tallest real one).
  const W = 32;
  const mk = (fill) => {
    const e = new Float32Array(W * W).fill(fill);
    return e;
  };
  // (1) the measured streak
  const e1 = mk(5);
  const streak = [
    [15, 14, -92],
    [15, 15, 134],
    [15, 16, 448],
    [15, 17, 531],
    [16, 15, -248],
    [16, 16, -276]
  ];
  for (const [x, y, v] of streak) e1[y * W + x] = v;
  const before = Float32Array.from(e1);
  const n1 = despikeDEM(e1, W, W);
  // The four cells >150 m from their 3x3 median (134->448->531 and
  // the -248/-276 pair) MUST repair to the 5 m plain; the -92 and
  // 134 sit UNDER the documented floor (97 and 129 m deviations)
  // and MUST survive - the boundary of the rule, asserted both
  // ways. Everything unplanted stays bit-identical.
  let cleanOk = true;
  let othersOk = true;
  for (let k = 0; k < W * W; k++) {
    const pl = streak.find(([x, y]) => y * W + x === k);
    if (pl) {
      const big = Math.abs(pl[2] - 5) > 150;
      if (big && e1[k] !== 5) cleanOk = false;
      if (!big && e1[k] !== pl[2]) cleanOk = false;
    } else if (e1[k] !== before[k]) othersOk = false;
  }
  check(
    'DEM despike: measured streak',
    n1 === 4 && cleanOk && othersOk,
    `the captured Nelson garbage repairs in exactly 4 replacements (448/531/-248/-276 -> the 5 m median); the -92 and 134 survive under the 150 m floor by 97 and 129 m deviations - the rule boundary held both ways; every unplanted cell bit-identical`
  );
  // (2) a real knife ridge: 700 m of relief at sigma = 2 px - a
  // 75 deg maximum slope, already past anything a 30 m radar DEM
  // resolves - stays BIT-IDENTICAL because the neighbourhood
  // median climbs with the feature (crest deviation 75 m).
  const e2 = mk(100);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++)
      e2[y * W + x] = 100 + 700 * Math.exp(-((x - 14) * (x - 14)) / 8);
  const b2 = Float32Array.from(e2);
  const n2 = despikeDEM(e2, W, W);
  check(
    'DEM despike: ridge survives',
    n2 === 0 && e2.every((v, k) => v === b2[k]),
    'an 800-m knife ridge (sigma 2 px, ~75 deg flanks) is BIT-IDENTICAL through the filter - the neighbourhood median climbs with real terrain'
  );
  // (3) the sea stack under the floor
  const e3 = mk(0);
  e3[16 * W + 16] = 120;
  const n3 = despikeDEM(e3, W, W);
  check(
    'DEM despike: sea stack floor',
    n3 === 0 && e3[16 * W + 16] === 120,
    'a 120-m single-pixel stack survives the 150 m floor (Old Man of Hoy, 137 m, is the tallest real one)'
  );
}

process.exit(fail ? 1 : 0);
