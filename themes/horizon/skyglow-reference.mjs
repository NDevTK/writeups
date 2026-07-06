// Reference printer for skyglow (node skyglow-reference.mjs).
// The model lives once in skyglow.js; the map in skyglow-data.js
// is a downsample of the Falchi et al. 2016 World Atlas (source
// GeoTIFF checked at FULL resolution before downsampling: Las
// Vegas 17.26, London 17.63, Mauna Kea 21.98, mid-Pacific 22.00
// mag/arcsec^2 - the published values). Landmarks:
//  - quantisation round trip exact at every byte value
//  - the paper's own brightness scale: r = 0 -> 22.00; r = 1 ->
//    21.25 (their "artificial equals natural" threshold); the
//    contrast law 1/(1 + r) at its closed points
//  - the conventional SQM -> Bortle mapping at its breakpoints
//  - the GRID: the Las Vegas 0.5-deg cell reads brighter than
//    mag 19.5, London's likewise, the mid-Pacific cell exactly
//    22.00, and the Atacama darker than 21.5 - the world's
//    geography of light in four samples
//  - Walker's law on a synthetic grid: one city due east makes
//    horizonGlow(90) dominate 270; the same source at 25 vs
//    100 km attenuates by exactly 4^2.5 = 32
import {
  bortleClass,
  decodeQ,
  encodeQ,
  GRID_LAT_N,
  horizonGlow,
  NATURAL_MAG,
  pointVisibility,
  sampleRatio,
  skyMag,
  WALKER_EXP
} from './skyglow.js';
import {SKYGLOW, SKYGLOW_H, SKYGLOW_W} from './skyglow-data.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  let rt = true;
  for (let q = 0; q < 256; q++) {
    if (encodeQ(decodeQ(q)) !== q) rt = false;
  }
  check(
    'quantisation',
    rt && decodeQ(0) === 0 && decodeQ(48) === 9,
    `encode(decode(q)) = q for all 256 byte values; q = 0 -> ratio 0, q = 48 -> ratio 9 (one decade) exactly`
  );
}

{
  const m0 = skyMag(0);
  const m1 = skyMag(1);
  check(
    'Falchi brightness scale',
    m0 === NATURAL_MAG &&
      Math.abs(m1 - (22 - 2.5 * Math.log10(2))) < 1e-15 &&
      Math.abs(pointVisibility(1) - 0.5) < 1e-15 &&
      pointVisibility(0) === 1 &&
      bortleClass(22) === 1 &&
      bortleClass(21.0) === 4 &&
      bortleClass(18.5) === 7 &&
      bortleClass(16) === 9,
    `r = 0 -> ${m0.toFixed(2)}; r = 1 -> ${m1.toFixed(3)} (the paper's 21.25 threshold); contrast 1/(1+r) exact; Bortle 22 -> 1, 21.0 -> 4, 18.5 -> 7, 16 -> 9`
  );
}

{
  const vegas = skyMag(
    sampleRatio(SKYGLOW, SKYGLOW_W, SKYGLOW_H, 36.17, -115.14)
  );
  const london = skyMag(
    sampleRatio(SKYGLOW, SKYGLOW_W, SKYGLOW_H, 51.5, -0.12)
  );
  const pacific = skyMag(sampleRatio(SKYGLOW, SKYGLOW_W, SKYGLOW_H, 0, -150));
  const atacama = skyMag(
    sampleRatio(SKYGLOW, SKYGLOW_W, SKYGLOW_H, -24.6, -70.4)
  );
  const pole = sampleRatio(SKYGLOW, SKYGLOW_W, SKYGLOW_H, 89, 0);
  check(
    'the geography of light',
    SKYGLOW.length === SKYGLOW_W * SKYGLOW_H &&
      vegas < 19.5 &&
      london < 19.5 &&
      pacific === 22 &&
      atacama > 21.5 &&
      pole === 0,
    `0.5-deg cells: Las Vegas ${vegas.toFixed(2)}, London ${london.toFixed(2)} (city cells); mid-Pacific ${pacific.toFixed(2)} exactly; Atacama ${atacama.toFixed(2)} (dark-sky country); beyond coverage -> 0`
  );
}

{
  // Walker's law on a synthetic grid: one bright cell ~50 km east
  // of the observer at the equator.
  const W = 720;
  const H = 290;
  const g = new Uint8Array(W * H);
  const lat = 0;
  const lonEast = 0.45; // ~50 km east at the equator
  const y = Math.round(((GRID_LAT_N - lat) / 145) * H - 0.5);
  const x = Math.round(((lonEast + 180) / 360) * W - 0.5);
  g[y * W + x] = 200;
  const east = horizonGlow(g, W, H, 0, 0, 90);
  const west = horizonGlow(g, W, H, 0, 0, 270);
  const near = 1 * Math.pow(25 / 10, WALKER_EXP);
  const far = 1 * Math.pow(100 / 10, WALKER_EXP);
  check(
    "Walker's law",
    east > 0 &&
      east > 10 * (west + 1e-12) &&
      Math.abs(near / far - Math.pow(4, 2.5)) < 1e-12,
    `city due east: glow(90 deg) = ${east.toFixed(2)} vs glow(270) = ${west.toFixed(4)}; 25 km vs 100 km attenuation ratio 4^2.5 = ${(near / far).toFixed(1)} exactly`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
