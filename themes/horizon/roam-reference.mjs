// Reference printer for the roam/terrain-streaming system (node
// roam-reference.mjs). Roaming is a chain of anchor swaps, so the
// gate holds the swap to closed-form exactness:
//  - the forward mapping IS the fleet's mapping (aisToScene,
//    adsbToScene) - one model, held equal here
//  - sceneToGeo is the algebraic inverse (roundtrip at fp)
//  - a hop is exact: the camera's geodetic point becomes the new
//    origin, its absolute altitude survives the datum change, and
//    a 1000-hop random walk accumulates nothing
//  - the trigger geometry leaves real data between the camera and
//    the void for the whole fetch
import {
  DEM_HALF_M,
  WORLD,
  MPU,
  M_LAT,
  MICRO_M,
  ROAM_TRIGGER_M,
  ROAM_SETTLE_MS,
  ROAM_FORCE_HOPS,
  TREE_CELL_M,
  geoToScene,
  sceneToGeo,
  yOfElev,
  elevOfY,
  microRelief,
  roamDecision,
  roamURL,
  settleDue,
  treeCandidates
} from './roam.js';
import {aisToScene, KT_MS} from './ships.js';
import {adsbToScene} from './contrails.js';
import {haversineKm} from './lightning.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const REF = (lat, lon) => ({
  lat,
  lon,
  halfM: DEM_HALF_M,
  world: WORLD,
  centerElev: 0,
  mpu: MPU
});

{
  // One mapping: roam's forward equals the embedded maps in
  // ships.aisToScene and contrails.adsbToScene at diverse anchors
  // (equator, mid, high latitude, southern hemisphere), and MPU
  // is exactly what the box implies - a 1 kt ship moves exactly
  // KT_MS/MPU scene units per second through it.
  const anchors = [
    [0.0, 103.85],
    [46.62, 8.04],
    [69.65, 18.96],
    [-41.27, 173.28]
  ];
  let agree = true;
  for (const [la, lo] of anchors) {
    const p = {lat: la + 0.031, lon: lo - 0.047};
    const r = geoToScene(p.lat, p.lon, {lat: la, lon: lo});
    const ship = aisToScene({...p, sog: 0, cog: 0}, REF(la, lo));
    const ac = adsbToScene(
      {...p, alt_baro: 30000, gs: 0, track: 0},
      REF(la, lo)
    );
    if (
      Math.abs(r.x - ship.x) > 0 ||
      Math.abs(r.z - ship.z) > 0 ||
      Math.abs(r.x - ac.x) > 0 ||
      Math.abs(r.z - ac.z) > 0
    )
      agree = false;
  }
  const kt = aisToScene(
    {lat: 46.62, lon: 8.04, sog: 1, cog: 90},
    REF(46.62, 8.04)
  );
  check(
    'one mapping',
    agree &&
      MPU === (2 * DEM_HALF_M) / WORLD &&
      Math.abs(kt.sp * MPU - KT_MS) < 1e-15 &&
      Math.abs(MPU - 57.14) < 0.005,
    `geoToScene === aisToScene === adsbToScene at ${anchors.length} anchors (bit-exact); MPU ${MPU.toFixed(6)} m/unit (the old 57.14 literal was ${(((MPU - 57.14) / MPU) * 1e6).toFixed(0)} ppm off); 1 kt -> exactly KT_MS m/s`
  );
}

{
  // Exact inverse: geo -> scene -> geo and scene -> geo -> scene
  // roundtrip at fp across the box, including the corners and the
  // anchor itself (which must map to the exact origin).
  const anchor = {lat: 51.1, lon: 1.35};
  let worst = 0;
  for (const [x, z] of [
    [0, 0],
    [140, 140],
    [-140, 140],
    [130, -95],
    [-0.001, 0.001]
  ]) {
    const g = sceneToGeo(x, z, anchor);
    const s = geoToScene(g.lat, g.lon, anchor);
    worst = Math.max(worst, Math.abs(s.x - x), Math.abs(s.z - z));
  }
  const o = geoToScene(anchor.lat, anchor.lon, anchor);
  check(
    'exact inverse',
    worst < 1e-9 && o.x === 0 && o.z === 0,
    `scene->geo->scene roundtrip worst ${worst.toExponential(1)} units (~${(worst * MPU * 1000).toExponential(1)} mm); anchor -> exact origin`
  );
}

{
  // Altitude datum rewrite: absolute elevation is the invariant.
  // Exact at the extremes of Earth's surface, and a 1000-swap
  // chain (random datums 0..4000 m) drifts less than a nanometre.
  const dead = yOfElev(-430, 300);
  const everest = yOfElev(8849, 5000);
  const exact =
    Math.abs(elevOfY(dead, 300) - -430) < 1e-9 &&
    Math.abs(elevOfY(everest, 5000) - 8849) < 1e-9;
  let y = yOfElev(1234.5, 300);
  let center = 300;
  let seed = 42;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 1000; i++) {
    const next = rnd() * 4000;
    y = yOfElev(elevOfY(y, center), next);
    center = next;
  }
  const drift = Math.abs(elevOfY(y, center) - 1234.5);
  check(
    'altitude datum rewrite',
    exact && drift < 1e-9,
    `Dead Sea and Everest roundtrip exact; 1000 datum swaps drift ${drift.toExponential(1)} m`
  );
}

{
  // A hop is exact and nothing accumulates: walk 300 random legs
  // (each ending in a re-anchor at the camera's geodetic point).
  // After every hop the camera sits at the exact origin of the
  // new anchor, and the hop's ground distance agrees with the
  // scene displacement (haversine vs MPU*units). The bound is the
  // map's own convention: the theme uses 111320 m/deg latitude
  // (as do its OSM/DEM layers) while the haversine sphere
  // (R = 6371.0088 km) gives 111194.9 m/deg - a documented 0.113%
  // scale convention - plus the curvature of a 4 km step: <0.2%.
  let anchor = {lat: 46.62, lon: 8.04};
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let worstDist = 0;
  let originExact = true;
  for (let i = 0; i < 300; i++) {
    const ang = rnd() * 2 * Math.PI;
    const units = ROAM_TRIGGER_M / MPU; // trigger radius in scene units
    const x = Math.sin(ang) * units;
    const z = Math.cos(ang) * units;
    const geo = sceneToGeo(x, z, anchor);
    const kmScene = (Math.hypot(x, z) * MPU) / 1000;
    const kmEarth = haversineKm(anchor.lat, anchor.lon, geo.lat, geo.lon);
    worstDist = Math.max(worstDist, Math.abs(kmEarth - kmScene) / kmScene);
    const back = geoToScene(geo.lat, geo.lon, geo);
    if (back.x !== 0 || back.z !== 0) originExact = false;
    anchor = geo;
    if (Math.abs(anchor.lat) > 66) anchor = {lat: 46.62, lon: 8.04};
  }
  check(
    'hop exactness',
    originExact && worstDist > 1e-3 && worstDist < 2e-3,
    `300-hop random walk: camera -> exact origin after every swap; scene vs haversine hop distance worst ${(worstDist * 100).toFixed(4)}% (the 0.113% m/deg convention + step curvature)`
  );
}

{
  // The roam gate: geometry and state machine. The trigger ring
  // leaves DEM_HALF_M - ROAM_TRIGGER_M metres of real data beyond
  // it (half the box), and the camera clamp (130 units) also sits
  // inside the box, so terrain never runs out mid-fetch.
  const st = {pending: false, notBefore: 0};
  const margin = DEM_HALF_M - ROAM_TRIGGER_M;
  check(
    'roam gate',
    roamDecision(ROAM_TRIGGER_M - 1, st, 0) === 'stay' &&
      roamDecision(ROAM_TRIGGER_M, st, 0) === 'go' &&
      roamDecision(9000, {pending: true, notBefore: 0}, 0) === 'wait' &&
      roamDecision(9000, {pending: false, notBefore: 100}, 99) === 'cooldown' &&
      roamDecision(9000, {pending: false, notBefore: 100}, 100) === 'go' &&
      margin === ROAM_TRIGGER_M &&
      130 * MPU < DEM_HALF_M,
    `stay below ${ROAM_TRIGGER_M} m, go at it, wait while pending, cooldown until notBefore; ${margin} m of data beyond the trigger; clamp ${(130 * MPU).toFixed(0)} m < box ${DEM_HALF_M} m`
  );
}

{
  // Earth-anchored micro-relief: the SAME geodetic point must
  // dress the same from ANY box. Two anchors 3 km apart render an
  // overlapping strip - the noise there agrees to the roundtrip
  // epsilon, its wavelength is the theme's historic 400 m
  // (MICRO_M === 7*MPU exactly), and the field actually varies
  // (mean near 0.5, spread over the box).
  const A = {lat: 46.62, lon: 8.04};
  const gB = sceneToGeo(35, 35, A); // ~2.8 km away
  const B = {lat: gB.lat, lon: gB.lon};
  let worst = 0;
  const vals = [];
  for (let k = 0; k < 200; k++) {
    const x = ((k * 37) % 100) - 50;
    const z = ((k * 61) % 100) - 50;
    const g = sceneToGeo(x, z, A);
    const sB = geoToScene(g.lat, g.lon, B);
    const rA = microRelief(x, z, A);
    const rB = microRelief(sB.x, sB.z, B);
    worst = Math.max(worst, Math.abs(rA - rB));
    vals.push(rA);
  }
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const spread = Math.max(...vals) - Math.min(...vals);
  check(
    'earth-anchored micro-relief',
    worst < 1e-9 &&
      MICRO_M === 7 * MPU &&
      vals.every((v) => v >= 0 && v <= 1) &&
      Math.abs(mean - 0.5) < 0.1 &&
      spread > 0.3,
    `200 overlap points agree to ${worst.toExponential(1)} across a 2.8 km re-anchor; MICRO_M = 7*MPU = ${MICRO_M} m exactly; range [0,1], mean ${mean.toFixed(3)}, spread ${spread.toFixed(2)}`
  );
}

{
  // Earth-anchored trees: candidates are keyed by fixed geodetic
  // cells, so two overlapping boxes grow IDENTICAL trees where
  // they overlap (bit-exact positions and per-tree uniforms), the
  // set is deterministic, everything respects the box margin, and
  // the cos(lat) acceptance holds areal density flat: candidates
  // per km² at 60° match the equator.
  const A = {lat: 46.62, lon: 8.04};
  const gB = sceneToGeo(30, 30, A);
  const B = {lat: gB.lat, lon: gB.lon};
  const setA = treeCandidates(A);
  const setB = treeCandidates(B);
  const idx = (list) => new Map(list.map((c) => [c.lat + ':' + c.lon, c]));
  const mapB = idx(setB);
  let shared = 0;
  let exact = true;
  for (const c of setA) {
    const m = mapB.get(c.lat + ':' + c.lon);
    if (!m) continue;
    shared++;
    if (m.key !== c.key || m.r.some((v, i) => v !== c.r[i])) exact = false;
  }
  const again = treeCandidates(A);
  const deterministic =
    again.length === setA.length &&
    again.every((c, i) => c.lat === setA[i].lat && c.lon === setA[i].lon);
  const lim = (WORLD - 40) / 2;
  const inBox = setA.every((c) => Math.abs(c.x) <= lim && Math.abs(c.z) <= lim);
  const areaKm2 = ((2 * lim * MPU) / 1000) ** 2;
  const d0 = treeCandidates({lat: 0, lon: 0}).length / areaKm2;
  const d60 = treeCandidates({lat: 60, lon: 0}).length / areaKm2;
  check(
    'earth-anchored trees',
    shared > 100 &&
      exact &&
      deterministic &&
      inBox &&
      Math.abs(d60 / d0 - 1) < 0.1,
    `${shared} candidates shared across a 2.4 km re-anchor, all bit-exact (position + uniforms); deterministic; margin held; density ${d0.toFixed(1)} vs ${d60.toFixed(1)} per km² at 0°/60° (cos acceptance)`
  );
}

{
  // roam URL: the same session walking - EVERYTHING survives
  // (weather pins, time pin, infra) except the stale place label;
  // only the coordinates move (4 dp). Idempotent. This is the
  // deliberate opposite of explore's relocateURL, which drops
  // pins because a destination means that place's real now.
  const s = '?cloud=90&time=2026-01-01T00:00&debug=1&lat=1&lon=2&place=Old';
  const once = roamURL(s, 46.5822, 8.04);
  const twice = roamURL(once, 46.5822, 8.04);
  const p = new URLSearchParams(once);
  check(
    'roam URL',
    p.get('lat') === '46.5822' &&
      p.get('lon') === '8.0400' &&
      p.get('cloud') === '90' &&
      p.get('time') === '2026-01-01T00:00' &&
      p.get('debug') === '1' &&
      !p.has('place') &&
      once === twice,
    `coords -> 46.5822/8.0400; cloud/time/debug pins survive the walk; place dropped; idempotent`
  );
}

{
  // Settle gate: terrain re-anchors per hop but API re-syncs wait
  // for the camera to rest (ROAM_SETTLE_MS) - unless the pilot
  // never stops, where ROAM_FORCE_HOPS caps the staleness.
  check(
    'settle gate',
    settleDue(false, 1e9, 1e9) === false &&
      settleDue(true, ROAM_SETTLE_MS - 1, 0) === false &&
      settleDue(true, ROAM_SETTLE_MS, 0) === true &&
      settleDue(true, 0, ROAM_FORCE_HOPS - 1) === false &&
      settleDue(true, 0, ROAM_FORCE_HOPS) === true,
    `clean never fires; fires at ${ROAM_SETTLE_MS} ms idle or ${ROAM_FORCE_HOPS} hops while moving`
  );
}

process.exit(fail ? 1 : 0);
