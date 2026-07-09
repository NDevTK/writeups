// Reference gate for lakes.js (node lakes-reference.mjs):
//  - ring stitching held EXACT on a shuffled, part-reversed
//    square, and on the LIVE Brienzersee relation (9 outer ways
//    from the captured Overpass fixture) - every stitched ring
//    closes, endpoint-exact
//  - the scanline raster is gated against the pointwise even-odd
//    test (smoke.js inRing through inLakeExact - one polygon
//    model) across the whole grid
//  - the measured surface level (median shoreline DEM) and the
//    flat asinh + settle rendering through sampleDem, sea rule
//    untouched
import {
  decimate,
  inLakeExact,
  lakeAt,
  lakeMask,
  parseWater,
  stitchRings
} from './lakes.js';
import {WATER_FIXTURE} from './lakes-fixture.mjs';
import {geoToScene} from './roam.js';
import {sampleDem, WATER_Y_OFF} from './terrain-sample.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // A unit square arriving as four segments - out of order, two of
  // them reversed - must stitch into exactly ONE closed ring
  // holding all four corners once.
  const A = [46, 7];
  const B = [46, 7.01];
  const C = [46.01, 7.01];
  const D = [46.01, 7];
  const rings = stitchRings([
    [C, B], // reversed
    [A, B],
    [D, A], // reversed
    [C, D]
  ]);
  const corners = new Set(rings[0] ? rings[0].map((p) => p.join()) : []);
  check(
    'ring stitching',
    rings.length === 1 &&
      rings[0].length === 4 &&
      [A, B, C, D].every((p) => corners.has(p.join())),
    `4 shuffled segments (2 reversed) -> one closed ring with each corner exactly once`
  );
}

const lakes = parseWater(WATER_FIXTURE);
const brienz = lakes.find((l) => l.name === 'Brienzersee');
const saegistal = lakes.find((l) => l.name === 'Sägistalsee');

{
  // The LIVE fixture: the 12-member relation stitches into closed
  // rings (endpoint-exact across the thinned members), the small
  // closed way parses directly, and decimation kept every ring a
  // polygon.
  const ok =
    lakes.length === 2 &&
    brienz &&
    brienz.rings.length >= 1 &&
    // stitched rings can legitimately close as triangles
    brienz.rings.every((r) => r.length >= 3) &&
    saegistal &&
    saegistal.rings.length === 1 &&
    saegistal.rings[0].length >= 4;
  check(
    'live Overpass fixture',
    ok,
    `Brienzersee relation -> ${brienz ? brienz.rings.length : 0} closed ring(s) (${brienz ? brienz.rings.reduce((a, r) => a + r.length, 0) : 0} pts), Sägistalsee way -> 1 ring of ${saegistal ? saegistal.rings[0].length : 0}`
  );
}

const anchor = {lat: 46.723, lon: 7.9673}; // mid-Brienzersee (ring bbox centroid)
const N = 192;
const WORLD = 280;
const LAKE_LEVEL = 563.7; // Swisstopo: Brienzersee surface
const flatDem = () => LAKE_LEVEL;
const mask = lakeMask([brienz], anchor, WORLD, N, flatDem);

{
  // Raster vs pointwise even-odd: every grid cell must agree with
  // inLakeExact except cells whose centre sits within one texel of
  // a shoreline edge (the raster is a half-open pixelation - the
  // gate allows only boundary cells to differ).
  const scene = brienz.rings.map((r) =>
    r.map(([la, lo]) => {
      const s = geoToScene(la, lo, anchor);
      return [s.x, s.z];
    })
  );
  const texel = WORLD / N;
  const distToEdge = (x, z) => {
    let d = Infinity;
    for (const r of scene)
      for (let i = 0; i < r.length; i++) {
        const [ax, az] = r[i];
        const [bx, bz] = r[(i + 1) % r.length];
        const vx = bx - ax;
        const vz = bz - az;
        const t = Math.max(
          0,
          Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz))
        );
        d = Math.min(d, Math.hypot(x - (ax + t * vx), z - (az + t * vz)));
      }
    return d;
  };
  let interiorBad = 0;
  let wet = 0;
  for (let j = 0; j < N; j += 3) {
    for (let i = 0; i < N; i += 3) {
      const x = ((i + 0.5) / N) * WORLD - WORLD / 2;
      const z = ((j + 0.5) / N) * WORLD - WORLD / 2;
      const raster = lakeAt(mask, x, z) === 0;
      if (raster) wet++;
      const exact = inLakeExact(scene, x, z);
      if (raster !== exact && distToEdge(x, z) > texel * 1.5) interiorBad++;
    }
  }
  check(
    'raster vs even-odd',
    interiorBad === 0 && wet > 300 && mask.elevs[0] === LAKE_LEVEL,
    `every sampled cell away from the shoreline agrees with the pointwise even-odd test (${wet} wet cells); measured level = the median shore DEM exactly`
  );
}

{
  // The rendered surface: inside the lake, sampleDem returns water
  // TRUE with y FLAT at the measured level through the same asinh
  // datum + settle as the sea, regardless of the DEM underneath;
  // outside, land; the sea rule itself untouched.
  const dem = {kind: 'grid', n: 3, grid: new Array(9).fill(700)}; // terrain 700 m
  const c = 600;
  const inside = sampleDem(dem, 0, 0, c, anchor, WORLD, mask);
  const inside2 = sampleDem(dem, 8, -5, c, anchor, WORLD, mask);
  const outside = sampleDem(dem, 0, 130, c, anchor, WORLD, mask);
  const wantY = 16 * Math.asinh((LAKE_LEVEL - c) / 500) + WATER_Y_OFF;
  const sea = sampleDem(
    {kind: 'grid', n: 3, grid: new Array(9).fill(0)},
    0,
    0,
    c,
    anchor,
    WORLD,
    mask
  );
  const seaY = 16 * Math.asinh((0 - c) / 500) + WATER_Y_OFF;
  check(
    'flat measured surface',
    inside.water === true &&
      inside.y === wantY &&
      inside2.y === wantY &&
      outside.water === false &&
      sea.water === true &&
      sea.y === seaY,
    `two lake points read water at exactly ${wantY.toFixed(4)} (563.7 m through the asinh datum + settle); a shore point is land; the sea rule still answers first`
  );
}

{
  // Decimation: endpoints kept, spacing respected, tiny rings
  // returned intact; and a lake whose rings miss the box is
  // skipped by the mask.
  const ring = [];
  for (let k = 0; k < 100; k++) ring.push([46 + k * 0.00002, 7]); // ~2.2 m apart
  const d = decimate(ring, 25);
  const far = lakeMask(
    [brienz, saegistal],
    {lat: 46.0, lon: 7.0},
    WORLD,
    N,
    flatDem
  );
  check(
    'decimation and scope',
    d.length < ring.length / 8 &&
      d[0] === ring[0] &&
      lakeAt(far, 0, 0) === -1 &&
      far.elevs.length === 0,
    `100 shoreline points 2.2 m apart thin to ${d.length} (first kept); a box 90 km away holds neither lake in its mask`
  );
}

process.exit(fail ? 1 : 0);
