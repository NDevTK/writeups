// Reference gate for rainshafts.js (node rainshafts-reference.mjs):
// Atlas's extinction law by hand, the opacity of a pixel's curtain,
// Koschmieder's range inside the rain, and the shafts composed from
// a navigated list - placed by real bearing and distance, the
// drizzle left out, the far ones left out, nearest first, capped.
import {
  RAIN_EXTINCTION,
  rainExtinctionPerKm,
  rainOpticalDepth,
  rainShaftsNear,
  rainShaftsSummary,
  rainVisibilityKm,
  shaftOpacity
} from './rainshafts.js';
import {rangeBearing} from './wildfire.js';

let fail = false;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail = true;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

{
  // Atlas 1953: sigma = 0.25 R^0.63 km^-1; by hand at 1, 10 and 0.2 mm/h
  const s1 = 0.25;
  const s10 = 0.25 * Math.pow(10, 0.63);
  const s02 = 0.25 * Math.pow(0.2, 0.63);
  const o1 = 1 - Math.exp(-2 * s1);
  const o10 = 1 - Math.exp(-2 * s10);
  const o02 = 1 - Math.exp(-2 * s02);
  check(
    "THE CURTAIN'S OPACITY is Atlas's extinction over the pixel's own path",
    RAIN_EXTINCTION.a === 0.25 &&
      RAIN_EXTINCTION.b === 0.63 &&
      RAIN_EXTINCTION.pixelPathKm === 2 &&
      RAIN_EXTINCTION.orographicA[0] === 1.25 &&
      RAIN_EXTINCTION.orographicA[1] === 2.6 &&
      near(rainExtinctionPerKm(1), s1, 1e-12) &&
      near(rainExtinctionPerKm(10), s10, 1e-12) &&
      rainExtinctionPerKm(0) === 0 &&
      rainExtinctionPerKm(-1) === 0 &&
      near(rainOpticalDepth(10), 2 * s10, 1e-12) &&
      near(shaftOpacity(1), o1, 1e-12) &&
      near(shaftOpacity(10), o10, 1e-12) &&
      near(shaftOpacity(0.2), o02, 1e-12) &&
      shaftOpacity(0) === 0 &&
      near(shaftOpacity(1, 4), 1 - Math.exp(-4 * s1), 1e-12) &&
      near(rainVisibilityKm(1), 3 / s1, 1e-9) &&
      near(rainVisibilityKm(10), 3 / s10, 1e-9) &&
      rainVisibilityKm(0) === Infinity &&
      // the orographic band: an order of magnitude denser at the same rate
      rainExtinctionPerKm(1, 1.25) === 1.25 &&
      rainExtinctionPerKm(1, 2.6) === 2.6,
    `sigma = ${RAIN_EXTINCTION.a} R^${RAIN_EXTINCTION.b} km^-1 (${RAIN_EXTINCTION.source}): ${s1.toFixed(3)} at 1 mm/h, ${s10.toFixed(3)} at 10, ${s02.toFixed(3)} at 0.2; ` +
      `through the pixel's ${RAIN_EXTINCTION.pixelPathKm} km the curtain hides ${(100 * o1).toFixed(0)}% at 1 mm/h, ${(100 * o10).toFixed(0)}% at 10, ${(100 * o02).toFixed(0)}% in drizzle at 0.2 (nothing at 0); ` +
      `Koschmieder's range inside the rain ${rainVisibilityKm(1).toFixed(1)} km at 1 mm/h, ${rainVisibilityKm(10).toFixed(1)} km at 10; orographic rain a = ${RAIN_EXTINCTION.orographicA.join('-')}, an order of magnitude denser`
  );
}

{
  // a navigated list around the home: a downpour 30 km north-east,
  // rain 12 km west, drizzle 5 km south (under the floor), a shower
  // 150 km east (past the reach), a degraded pixel 40 km north
  const home = [32.85, -117.12];
  const at = (km, brg) => {
    const dLat = (km * Math.cos((brg * Math.PI) / 180)) / 111.2;
    const dLon = (km * Math.sin((brg * Math.PI) / 180)) / (111.2 * Math.cos((home[0] * Math.PI) / 180));
    return {latDeg: home[0] + dLat, lonDeg: home[1] + dLon};
  };
  const list = [
    {...at(30, 45), mmh: 12, quality: 'good'},
    {...at(12, 270), mmh: 1.5, quality: 'good'},
    {...at(5, 180), mmh: 0.1, quality: 'good'},
    {...at(150, 90), mmh: 20, quality: 'good'},
    {...at(40, 0), mmh: 3, quality: 'degraded'}
  ];
  const shafts = rainShaftsNear(list, home[0], home[1], {maxKm: 100, cap: 160, minMmH: 0.2});
  const capped = rainShaftsNear(list, home[0], home[1], {maxKm: 100, cap: 2});
  const sum = rainShaftsSummary(shafts);
  const rbW = rangeBearing(home[0], home[1], list[1].latDeg, list[1].lonDeg);
  check(
    'THE SHAFTS stand where the pixels fall: by real bearing and distance, the drizzle and the far shower left out, nearest first',
    shafts.length === 3 &&
      near(shafts[0].distKm, 12, 0.05) &&
      near(shafts[0].bearingDeg, 270, 0.2) &&
      near(shafts[0].distKm, rbW.distKm, 1e-9) &&
      shafts[0].mmh === 1.5 &&
      near(shafts[1].distKm, 30, 0.05) &&
      near(shafts[1].bearingDeg, 45, 0.2) &&
      shafts[1].mmh === 12 &&
      near(shafts[1].opacity, shaftOpacity(12), 1e-12) &&
      near(shafts[1].tau, rainOpticalDepth(12), 1e-12) &&
      shafts[2].quality === 'degraded' &&
      near(shafts[2].bearingDeg, 0, 0.2) &&
      !shafts.some((s) => s.mmh === 0.1 || s.mmh === 20) &&
      capped.length === 2 &&
      capped[1].mmh === 12 &&
      sum.n === 3 &&
      near(sum.nearestKm, 12, 0.05) &&
      sum.heaviestMmH === 12 &&
      near(sum.heaviestKm, 30, 0.05) &&
      near(sum.heaviestOpacity, shaftOpacity(12), 1e-12) &&
      rainShaftsSummary([]) === null &&
      rainShaftsNear(null, 0, 0).length === 0,
    `${shafts.length} shafts of 5 pixels: the rain 12 km west first (${shafts[0].distKm.toFixed(1)} km at ${shafts[0].bearingDeg.toFixed(0)}°, ${shafts[0].mmh} mm/h), ` +
      `the downpour 30 km north-east (${shafts[1].distKm.toFixed(1)} km at ${shafts[1].bearingDeg.toFixed(0)}°, ${shafts[1].mmh} mm/h, opacity ${shafts[1].opacity.toFixed(2)}), ` +
      `the degraded 3 mm/h 40 km north kept and flagged; the 0.1 mm/h drizzle under the ${0.2} mm/h floor and the 20 mm/h shower 150 km east past the 100-km reach left out; ` +
      `a cap of 2 keeps the two nearest; the summary names ${sum.n}, the nearest ${sum.nearestKm.toFixed(0)} km, the heaviest ${sum.heaviestMmH} mm/h at ${sum.heaviestKm.toFixed(0)} km`
  );
}

process.exit(fail ? 1 : 0);
