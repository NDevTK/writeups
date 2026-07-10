// Reference gate for landuse.js (node landuse-reference.mjs):
//  - the class table and parse forms: known classes keep their
//    albedo, unknown classes are the base grass (dropped), the
//    span filter and ring dedup do their jobs
//  - relations stitch through the lakes' gated endpoint matching
//  - the raster is gated against the pointwise even-odd test
//    (smoke.js inRing - one polygon model) AND against the
//    terrain shader's row orientation (v = 0.5 - z/world)
//  - paint order: a small parcel inside a large one wins its own
//    texels, the large one keeps the rest
//  - the LIVE Interlaken fixture parses to the real ground cover
//    and paints the box
import {
  CLASS_ALBEDO,
  landTint,
  parseLanduse,
  SOIL_C,
  SOIL_POROSITY,
  SOIL_SAT_RATIO,
  soilDarkening,
  tintAt
} from './landuse.js';
import {LANDUSE_FIXTURE} from './landuse-fixture.mjs';
import {geoToScene} from './roam.js';
import {inRing} from './smoke.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// A geodetic square ring around (lat, lon), half-side in metres.
const square = (lat, lon, halfM) => {
  const dLat = halfM / 111320;
  const dLon = halfM / (111320 * Math.cos((lat * Math.PI) / 180));
  return [
    [lat - dLat, lon - dLon],
    [lat - dLat, lon + dLon],
    [lat + dLat, lon + dLon],
    [lat + dLat, lon - dLon]
  ];
};
const way = (id, ring, tags) => ({
  type: 'way',
  id,
  geometry: [...ring, ring[0]].map(([lat, lon]) => ({lat, lon})),
  tags
});

const anchor = {lat: 46.6863, lon: 7.8632};

{
  // Parse forms: the closing point deduped, known landuse AND
  // natural classes keep their table albedo, unknown classes and
  // sub-texel parcels are dropped.
  const polys = parseLanduse({
    elements: [
      way(1, square(46.687, 7.86, 200), {landuse: 'farmland'}),
      way(2, square(46.684, 7.867, 150), {natural: 'grassland'}),
      way(3, square(46.69, 7.855, 150), {landuse: 'construction'}),
      way(4, square(46.688, 7.868, 20), {landuse: 'meadow'})
    ]
  });
  const farm = polys.find((p) => p.cls === 'farmland');
  const ok =
    polys.length === 2 &&
    farm &&
    farm.albedo === CLASS_ALBEDO.farmland &&
    polys.some((p) => p.cls === 'grassland') &&
    farm.rings[0].length === 4 &&
    polys[0].area > polys[1].area;
  check(
    'classes and parse forms',
    ok,
    'farmland + natural=grassland kept with their table albedos (closing point deduped, largest first); unknown landuse and a 40 m parcel dropped'
  );
}

{
  // A relation arriving as four outer segments - shuffled, two
  // reversed - stitches into one polygon (the lakes' gated path).
  const ring = square(46.687, 7.86, 300);
  const seg = (a, b) => [ring[a], ring[b]];
  const rel = {
    type: 'relation',
    id: 9,
    tags: {landuse: 'meadow'},
    members: [
      {
        type: 'way',
        role: 'outer',
        geometry: seg(2, 1).map(([lat, lon]) => ({lat, lon}))
      },
      {
        type: 'way',
        role: 'outer',
        geometry: seg(0, 1).map(([lat, lon]) => ({lat, lon}))
      },
      {
        type: 'way',
        role: 'outer',
        geometry: seg(3, 0).map(([lat, lon]) => ({lat, lon}))
      },
      {
        type: 'way',
        role: 'outer',
        geometry: seg(2, 3).map(([lat, lon]) => ({lat, lon}))
      }
    ]
  };
  const polys = parseLanduse({elements: [rel]});
  check(
    'relation stitching',
    polys.length === 1 &&
      polys[0].rings.length === 1 &&
      polys[0].rings[0].length === 4,
    '4 shuffled outer segments (2 reversed) -> one meadow polygon of 4 corners'
  );
}

const N = 192;
const WORLD = 280;

{
  // Raster vs pointwise even-odd on a NORTH-half square, texels
  // away from the edges agreeing exactly - and the painted rows
  // living in the flipped half the terrain shader samples
  // (v = 0.5 - z/world puts north in the upper texture rows).
  const g = square(46.696, 7.8632, 400); // ~1.1 km north of anchor
  const polys = parseLanduse({elements: [way(1, g, {landuse: 'farmland'})]});
  const tint = landTint(polys, anchor, WORLD, N);
  const scene = [
    g.map(([la, lo]) => {
      const s = geoToScene(la, lo, anchor);
      return [s.x, s.z];
    })
  ];
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
  let bad = 0;
  let wet = 0;
  for (let j = 0; j < N; j += 2)
    for (let i = 0; i < N; i += 2) {
      const x = ((i + 0.5) / N) * WORLD - WORLD / 2;
      const z = ((j + 0.5) / N) * WORLD - WORLD / 2;
      const raster = tintAt(tint, x, z) !== null;
      if (raster) wet++;
      const exact = inRing(scene[0], x, z);
      if (raster !== exact && distToEdge(x, z) > texel * 1.5) bad++;
    }
  // shader orientation: every painted DATA row must be in the
  // upper (north, v > 0.5) half of the texture
  let southPainted = false;
  for (let row = 0; row < N / 2; row++)
    for (let i = 0; i < N; i++)
      if (tint.data[(row * N + i) * 4 + 3]) southPainted = true;
  check(
    'raster vs even-odd and orientation',
    bad === 0 && wet > 20 && tint.painted === 1 && !southPainted,
    `every sampled texel away from the shoreline agrees with the pointwise even-odd test (${wet} painted); a north-half square paints only upper texture rows (v = 0.5 - z/world)`
  );
}

{
  // Paint order: a meadow inside farmland wins its own texels;
  // the farmland keeps the ring around it.
  const polys = parseLanduse({
    elements: [
      way(1, square(46.6863, 7.8632, 500), {landuse: 'farmland'}),
      way(2, square(46.6863, 7.8632, 120), {landuse: 'meadow'})
    ]
  });
  const tint = landTint(polys, anchor, WORLD, N);
  const centre = tintAt(tint, 0, 0);
  const ring = tintAt(tint, 0, 5); // ~285 m out: farmland, not meadow
  // float32 storage tolerance on the table albedos
  const is = (v, a) => v && v.every((c, k) => Math.abs(c - a[k]) < 1e-6);
  check(
    'paint order',
    tint.painted === 2 &&
      is(centre, CLASS_ALBEDO.meadow) &&
      is(ring, CLASS_ALBEDO.farmland),
    'the small meadow inside the large farmland wins the centre texel; the farmland keeps the ring'
  );
}

{
  // The LIVE fixture: the captured Interlaken ground cover parses
  // (classes present on both the landuse and natural sides) and
  // paints a real share of the box.
  const polys = parseLanduse(LANDUSE_FIXTURE);
  const cls = new Set(polys.map((p) => p.cls));
  const tint = landTint(polys, anchor, WORLD, N);
  let covered = 0;
  for (let k = 3; k < tint.data.length; k += 4) if (tint.data[k]) covered++;
  const share = covered / (N * N);
  check(
    'live Interlaken fixture',
    polys.length > 100 &&
      cls.has('farmland') &&
      cls.has('residential') &&
      cls.has('grassland') &&
      cls.has('bare_rock') &&
      tint.painted > 80 &&
      // the capture bbox is ~3.3 km of the 16 km box (~4% of the
      // area) - 2% painted texels is the honest expectation
      share > 0.015 &&
      share < 0.2,
    `${polys.length} polygons (${cls.size} classes), ${tint.painted} painted onto the box, ${(share * 100).toFixed(0)}% of texels covered`
  );
}

{
  // Wet soil darkens (Lobell & Asner 2002): the exponential form
  // exact - dry ground 1, the decay constant DERIVED from the
  // paper's visible-band saturation point (95% of the decay spent
  // by 0.20 m3/m3), the saturated floor at the documented half,
  // monotone throughout, and factor 1 whenever the data cannot
  // speak. Painted through landTint: a farmland texel darkens by
  // exactly the factor, a meadow texel (canopy over its soil)
  // does not.
  const f02 = soilDarkening(0.2);
  const wantAt02 =
    SOIL_SAT_RATIO +
    (1 - SOIL_SAT_RATIO) * Math.exp(-SOIL_C * (0.2 / SOIL_POROSITY));
  const mono =
    soilDarkening(0.05) > soilDarkening(0.1) &&
    soilDarkening(0.1) > soilDarkening(0.2) &&
    soilDarkening(0.2) > soilDarkening(0.45);
  const anchor2 = {lat: 46.6863, lon: 7.8632};
  const sq = (halfM) => {
    const dLat = halfM / 111320;
    const dLon = halfM / (111320 * Math.cos((46.6863 * Math.PI) / 180));
    return [
      [46.6863 - dLat, 7.8632 - dLon],
      [46.6863 - dLat, 7.8632 + dLon],
      [46.6863 + dLat, 7.8632 + dLon],
      [46.6863 + dLat, 7.8632 - dLon]
    ];
  };
  const mkWay = (id, ring, tags) => ({
    type: 'way',
    id,
    geometry: [...ring, ring[0]].map(([lat, lon]) => ({lat, lon})),
    tags
  });
  const polys2 = parseLanduse({
    elements: [
      mkWay(1, sq(500), {landuse: 'farmland'}),
      mkWay(2, sq(120), {landuse: 'meadow'})
    ]
  });
  const wet = landTint(polys2, anchor2, 280, 192, soilDarkening(0.108));
  const centreMeadow = tintAt(wet, 0, 0);
  const ringFarm = tintAt(wet, 0, 5);
  const fNow = soilDarkening(0.108);
  const farmOk =
    ringFarm &&
    ringFarm.every(
      (v, k) =>
        Math.abs(v - Math.fround(CLASS_ALBEDO.farmland[k] * fNow)) < 1e-7
    );
  const meadowOk =
    centreMeadow &&
    centreMeadow.every(
      (v, k) => Math.abs(v - Math.fround(CLASS_ALBEDO.meadow[k])) < 1e-7
    );
  check(
    'wet soil darkens',
    Math.abs(f02 - wantAt02) < 1e-15 &&
      Math.abs(Math.exp(-SOIL_C * (0.2 / SOIL_POROSITY)) - 0.05) < 1e-12 &&
      mono &&
      soilDarkening(0) === 1 &&
      soilDarkening(NaN) === 1 &&
      soilDarkening(9) > SOIL_SAT_RATIO &&
      farmOk &&
      meadowOk,
    `Lobell-Asner exponential exact; c = ${SOIL_C.toFixed(2)} derived from the paper's 0.20 m3/m3 visible saturation; at the live capture's 0.108 m3/m3 the farmland texel darkens by x${fNow.toFixed(3)} while the meadow (canopy) stands`
  );
}

process.exit(fail ? 1 : 0);
