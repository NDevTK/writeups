// Reference gate for rainshafts.js (node rainshafts-reference.mjs):
// Atlas's extinction law by hand, the opacity of a pixel's curtain,
// Koschmieder's range inside the rain, and the shafts composed from
// a navigated list - placed by real bearing and distance, the
// drizzle left out, the far ones left out, nearest first, capped.
import {
  COVER_CAP,
  coverOfRate,
  isSnowKind,
  mergeCoverFields,
  rainCoverField,
  RAIN_EXTINCTION,
  rainExtinctionPerKm,
  rainOpticalDepth,
  rainShaftsNear,
  rainShaftsSummary,
  rainVisibilityKm,
  shaftOpacity,
  SNOW_EXTINCTION,
  snowExtinctionPerKm,
  snowOpticalDepth,
  snowVisibilityKm
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
    const dLon =
      (km * Math.sin((brg * Math.PI) / 180)) /
      (111.2 * Math.cos((home[0] * Math.PI) / 180));
    return {latDeg: home[0] + dLat, lonDeg: home[1] + dLon};
  };
  const list = [
    {...at(30, 45), mmh: 12, quality: 'good'},
    {...at(12, 270), mmh: 1.5, quality: 'good'},
    {...at(5, 180), mmh: 0.1, quality: 'good'},
    {...at(150, 90), mmh: 20, quality: 'good'},
    {...at(40, 0), mmh: 3, quality: 'degraded'}
  ];
  const shafts = rainShaftsNear(list, home[0], home[1], {
    maxKm: 100,
    cap: 160,
    minMmH: 0.2
  });
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

{
  // THE SNOW'S CURTAIN (185th): Rasmussen et al. 1999's Eq. 13 by hand
  // - S = 1.3 C3 Vt / Vis in cgs, so sigma = 3 S / (C3 Vt) with
  // Koschmieder's 3.912 - at 2 mm/h liquid equivalent: dry aggregates
  // (C3 0.017 g/cm^2, Vt 100 cm/s) and wet or rimed (0.072, 200); the
  // wet/dry visibility ratio 8.47 (the paper: "over a factor of 8");
  // the equation's 0.40 and 3.37 km against the text's Fig. 10
  // readings 0.3 and 2.6 (a log-log plot read by eye, within a factor
  // 1.35); the visibility Eq. 13 turned round; the NWS intensity
  // thresholds; the snow kinds; and the shafts: a snow cell and a rain
  // cell at the same rate take their own laws, dry or wet by the
  // caller, a cell without a kind Atlas's rain, the summary counting
  const S2 = 2 / 10 / 3600; // 2 mm/h in cm/s
  const sigDry = ((3 * S2) / (0.017 * 100)) * 1e5; // km^-1
  const sigWet = ((3 * S2) / (0.072 * 200)) * 1e5;
  const visDry = 3.912 / sigDry;
  const visWet = 3.912 / sigWet;
  const visEq13Dry = ((1.304 * 0.017 * 100) / S2) * 1e-5; // Vis = 1.304 C3 Vt / S, cm -> km
  const home = [40.0, -105.25];
  const at = (km, brg) => {
    const dLat = (km * Math.cos((brg * Math.PI) / 180)) / 111.2;
    const dLon =
      (km * Math.sin((brg * Math.PI) / 180)) /
      (111.2 * Math.cos((home[0] * Math.PI) / 180));
    return {latDeg: home[0] + dLat, lonDeg: home[1] + dLon};
  };
  const list = [
    {...at(10, 90), mmh: 2, kind: 3}, // snow
    {...at(10, 270), mmh: 2, kind: 1}, // warm stratiform rain
    {...at(20, 0), mmh: 2}, // no kind: rain
    {...at(20, 180), mmh: 2, kind: 4} // snow, the beam high
  ];
  const dry = rainShaftsNear(list, home[0], home[1], {maxKm: 100, cap: 10});
  const wet = rainShaftsNear(list, home[0], home[1], {
    maxKm: 100,
    cap: 10,
    wetSnow: true
  });
  const snowD = dry.find((s) => s.kind === 3);
  const rainD = dry.find((s) => s.kind === 1);
  const noneD = dry.find((s) => s.kind === null);
  const snowW = wet.find((s) => s.kind === 3);
  const highW = wet.find((s) => s.kind === 4);
  const sumD = rainShaftsSummary(dry);
  check(
    "THE SNOW'S CURTAIN: Rasmussen 1999's Eq. 13 gives the snow's extinction from its liquid-equivalent rate, dry or wet aggregates, a factor 8.5 apart; a cell the radar calls snow takes it and a rain cell keeps Atlas's",
    SNOW_EXTINCTION.eq === 13 &&
      SNOW_EXTINCTION.koschmieder === 3.912 &&
      SNOW_EXTINCTION.dry.c3 === 0.017 &&
      SNOW_EXTINCTION.dry.vtCmS === 100 &&
      SNOW_EXTINCTION.wet.c3 === 0.072 &&
      SNOW_EXTINCTION.wet.vtCmS === 200 &&
      SNOW_EXTINCTION.wetAtOrAboveC === -1 &&
      near(snowExtinctionPerKm(2), sigDry, 1e-9) &&
      near(snowExtinctionPerKm(2, {wet: true}), sigWet, 1e-9) &&
      snowExtinctionPerKm(0) === 0 &&
      snowExtinctionPerKm(-1) === 0 &&
      near(snowVisibilityKm(2), visDry, 1e-9) &&
      near(snowVisibilityKm(2, {wet: true}), visWet, 1e-9) &&
      near(snowVisibilityKm(2), visEq13Dry, 1e-6) &&
      near(visWet / visDry, (0.072 * 200) / (0.017 * 100), 1e-9) &&
      visDry > 0.39 &&
      visDry < 0.41 &&
      visWet > 3.3 &&
      visWet < 3.4 &&
      visDry / SNOW_EXTINCTION.fig10Km.dry < 1.35 &&
      visWet / SNOW_EXTINCTION.fig10Km.wet < 1.35 &&
      snowVisibilityKm(0) === Infinity &&
      near(snowOpticalDepth(2), 2 * sigDry, 1e-9) &&
      near(snowOpticalDepth(2, {wet: true}, 1), sigWet, 1e-9) &&
      // dry snow at 2 mm/h through the pixel's 2 km is opaque; the
      // same liquid rate as rain (Atlas) hides about half
      1 - Math.exp(-snowOpticalDepth(2)) > 0.999 &&
      shaftOpacity(2) < 0.6 &&
      SNOW_EXTINCTION.nwsIntensity.heavyKmMax === 0.402 &&
      SNOW_EXTINCTION.nwsIntensity.moderateKmMax === 1.0 &&
      isSnowKind(3) &&
      isSnowKind(4) &&
      !isSnowKind(1) &&
      !isSnowKind(7) &&
      !isSnowKind(undefined) &&
      dry.length === 4 &&
      snowD.law === 'snow-dry' &&
      near(snowD.tau, snowOpticalDepth(2), 1e-12) &&
      rainD.law === 'rain' &&
      near(rainD.tau, rainOpticalDepth(2), 1e-12) &&
      noneD.law === 'rain' &&
      near(noneD.tau, rainOpticalDepth(2), 1e-12) &&
      snowW.law === 'snow-wet' &&
      near(snowW.tau, snowOpticalDepth(2, {wet: true}), 1e-12) &&
      highW.law === 'snow-wet' &&
      snowD.tau > 10 * rainD.tau &&
      snowW.tau > rainD.tau &&
      sumD.snow === 2 &&
      sumD.rain === 2 &&
      sumD.typed === 3,
    `sigma = 3 S / (C3 Vt) (${SNOW_EXTINCTION.source}): at 2 mm/h dry ${sigDry.toFixed(2)} km^-1 (visibility ${visDry.toFixed(3)} km; Fig. 10 read ${SNOW_EXTINCTION.fig10Km.dry}), wet or rimed ${sigWet.toFixed(2)} (${visWet.toFixed(2)} km; Fig. 10 ${SNOW_EXTINCTION.fig10Km.wet}), the ratio ${(visWet / visDry).toFixed(2)}; ` +
      `through the pixel's 2 km dry snow at 2 mm/h hides ${(100 * (1 - Math.exp(-snowOpticalDepth(2)))).toFixed(1)}% where Atlas's rain hides ${(100 * shaftOpacity(2)).toFixed(0)}%; ` +
      `the shafts: the snow cell tau ${snowD.tau.toFixed(1)} (${snowD.law}), the rain cell ${rainD.tau.toFixed(2)}, the kind-less cell Atlas's; wet: the snow cell ${snowW.tau.toFixed(2)} (${snowW.law}); the summary ${sumD.snow} snow, ${sumD.rain} rain, ${sumD.typed} typed`
  );
}

{
  // THE RAIN'S COVER (167th): a 10 mm/h pixel at the centre of a 16-km
  // box paints the 8 x 8 texels of its 2-km footprint (250-m texels)
  // at the cap, a drizzle pixel 3 km east paints its own footprint at
  // its lesser cover, a pixel 20 km north is outside the box, the
  // border ring stays zero; the merge takes the radar's texel where
  // the mask says covered and the satellite's where it says black
  const lat = 32.85;
  const lon = -117.12;
  const mLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const list = [
    {latDeg: lat, lonDeg: lon, mmh: 10},
    {latDeg: lat, lonDeg: lon + 3000 / mLon, mmh: 0.3},
    {latDeg: lat + 20000 / 111320, lonDeg: lon, mmh: 50}
  ];
  const f = rainCoverField(list, lat, lon, {
    rm: 64,
    worldM: 16000,
    pixelM: 2000
  });
  const at = (ii, jj) => f.data[(jj * 64 + ii) * 4];
  // the centre pixel spans metres -1000..+1000 -> texels 28..35 (250 m each, index floor((m+8000)/250))
  let centreOk = true;
  for (let jj = 28; jj <= 35; jj++)
    for (let ii = 28; ii <= 35; ii++)
      if (Math.abs(at(ii, jj) - COVER_CAP) > 1e-6) centreOk = false;
  // the drizzle pixel at +3000 m east: metres 2000..4000 -> texels 40..47, rows 28..35
  const drizzle = coverOfRate(0.3);
  let eastOk = true;
  for (let jj = 28; jj <= 35; jj++)
    for (let ii = 40; ii <= 47; ii++)
      if (Math.abs(at(ii, jj) - drizzle) > 1e-7) eastOk = false;
  let border = 0;
  for (let t = 0; t < 64; t++)
    border += at(t, 0) + at(t, 63) + at(0, t) + at(63, t);
  let paintedCount = 0;
  for (let k = 0; k < f.data.length; k += 4) if (f.data[k] > 0) paintedCount++;
  // the merge: a radar field with cover 0.5 everywhere, the mask covered on the west half
  const radar = new Float32Array(64 * 64 * 4);
  for (let k = 0; k < radar.length; k += 4) radar[k] = 0.5;
  const covered = new Uint8Array(64 * 64);
  for (let t = 0; t < 64 * 64; t++) covered[t] = t % 64 < 32 ? 1 : 0;
  const m = mergeCoverFields(radar, f.data, covered, 64);
  const mAt = (ii, jj) => m.data[(jj * 64 + ii) * 4];
  const allRadar = mergeCoverFields(radar, f.data, null, 64);
  check(
    "THE RAIN'S COVER paints each pixel's footprint and the merge takes the radar where it sees",
    near(coverOfRate(10), COVER_CAP, 1e-12) &&
      coverOfRate(0) === 0 &&
      coverOfRate(0.05) === 0 &&
      near(coverOfRate(1), COVER_CAP, 1e-12) &&
      drizzle > 0 &&
      drizzle < COVER_CAP &&
      f.pixels === 2 &&
      centreOk &&
      eastOk &&
      at(27, 31) === 0 &&
      at(36, 31) === 0 &&
      at(31, 27) === 0 &&
      at(31, 36) === 0 &&
      border === 0 &&
      paintedCount === 128 &&
      f.painted === 128 &&
      mAt(31, 31) === 0.5 &&
      near(mAt(44, 31), drizzle, 1e-6) &&
      mAt(36, 31) === 0 &&
      m.fromRadar === 32 * 64 &&
      m.fromSatellite === 96 &&
      allRadar.fromRadar === 64 * 64 &&
      allRadar.fromSatellite === 0,
    `a 10 mm/h pixel at the centre paints its 8 x 8 texels at ${COVER_CAP} (the texels around them 0), a 0.3 mm/h pixel 3 km east its own 64 at ${drizzle.toFixed(3)}, ` +
      `the 50 mm/h pixel 20 km north is outside the 16-km box (${f.pixels} of 3 pixels painted, ${f.painted} texels), the border ring 0; ` +
      `merged with a radar field of 0.5 seen over the west half: the centre keeps the radar's 0.5, the drizzle's texels in the east take the satellite's ${drizzle.toFixed(3)}, ` +
      `an unpainted eastern texel stays 0 - ${m.fromRadar} texels from the radar, ${m.fromSatellite} from the satellite (the drizzle's 64 and the centre pixel's four eastern columns); without a mask every texel is the radar's`
  );
}
process.exit(fail ? 1 : 0);
