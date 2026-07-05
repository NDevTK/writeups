// Reference printer for the atmospheric-optics LUTs
// (node optics-reference.mjs). The physics lives once in
// optics-lut.js; this checks its outputs against the published
// geometric-optics landmarks:
//  - 22-deg halo inner (minimum-deviation) edges per channel:
//    2 asin(n sin 30) - 60 = 21.61 / 21.92 / 22.37 deg
//  - primary bow peaks near 42.4 (red) .. 41.3 deg (440 nm blue),
//    secondary near 50.4 .. 52+, Alexander's dark band between,
//    secondary/primary peak ratio ~0.4-0.5 from the Fresnel chain
import {buildBowLUT, buildHaloLUT} from './optics-lut.js';

const halo = buildHaloLUT();
const bow = buildBowLUT();

function channelStats(lut, c) {
  const {data, bins, thMinDeg, thMaxDeg} = lut;
  const dth = (thMaxDeg - thMinDeg) / bins;
  let peakI = 0;
  let peakV = 0;
  let first = -1;
  for (let i = 0; i < bins; i++) {
    const v = data[i * 4 + c];
    if (first < 0 && v > 0.02) first = i;
    if (v > peakV) {
      peakV = v;
      peakI = i;
    }
  }
  return {
    edge: thMinDeg + (first + 0.5) * dth,
    peak: thMinDeg + (peakI + 0.5) * dth,
    peakV
  };
}

for (const [name, c] of [
  ['red  ', 0],
  ['green', 1],
  ['blue ', 2]
]) {
  const s = channelStats(halo, c);
  console.log(
    `REF halo ${name}: edge ${s.edge.toFixed(2)} deg, peak ${s.peak.toFixed(2)} deg`
  );
}

// Bow: report primary and secondary regions separately.
function bowStats(c, lo, hi) {
  const {data, bins, thMinDeg, thMaxDeg} = bow;
  const dth = (thMaxDeg - thMinDeg) / bins;
  let peakI = 0;
  let peakV = 0;
  for (let i = 0; i < bins; i++) {
    const th = thMinDeg + (i + 0.5) * dth;
    if (th < lo || th > hi) continue;
    const v = data[i * 4 + c];
    if (v > peakV) {
      peakV = v;
      peakI = i;
    }
  }
  return {peak: thMinDeg + (peakI + 0.5) * dth, peakV};
}
for (const [name, c] of [
  ['red  ', 0],
  ['green', 1],
  ['blue ', 2]
]) {
  const p = bowStats(c, 35, 46);
  const s = bowStats(c, 46, 60);
  console.log(
    `REF bow ${name}: primary ${p.peak.toFixed(2)} deg (I ${p.peakV.toFixed(3)}),` +
      ` secondary ${s.peak.toFixed(2)} deg (I ${s.peakV.toFixed(3)}),` +
      ` ratio ${(s.peakV / p.peakV).toFixed(3)}`
  );
}
// Alexander's dark band: mean intensity 44..49 deg vs the primary.
{
  const {data, bins, thMinDeg, thMaxDeg} = bow;
  const dth = (thMaxDeg - thMinDeg) / bins;
  let band = 0;
  let cnt = 0;
  for (let i = 0; i < bins; i++) {
    const th = thMinDeg + (i + 0.5) * dth;
    if (th < 44 || th > 49) continue;
    band += data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2];
    cnt += 3;
  }
  console.log(`REF Alexander band mean I = ${(band / cnt).toFixed(4)}`);
}
