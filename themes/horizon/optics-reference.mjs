// Reference gate for the atmospheric-optics LUTs
// (node optics-reference.mjs). The physics lives in the library
// modules (rainbow.js - Airy/Descartes/Marshall-Palmer on
// Daimon-Masumura water; halos.js - Warren-Brandt ice, Bravais
// parhelia; each with its own gate) and optics-lut.js COMPOSES
// them into the dome's LUTs with the Monte-Carlo halo histogram
// and the limb-darkened source convolution. This gate holds the
// composition:
//  - halo inner edges at the Warren-Brandt minimum deviations
//    (21.63 / 21.86 / 22.34 deg), red inside blue
//  - the bow LUT: Airy primary near 42 deg with the colour
//    order, the secondary reversed, Alexander's dark band
//    between, the secondary/primary ratio in the Fresnel range -
//    AND the supernumerary fringes the old geometric histogram
//    could not carry, tightening with drop size
//  - the dog LUT: alive and outside the halo at 25 deg
//    elevation, red toward the source, EMPTY past the Bravais
//    cutoff
import {buildBowLUT, buildDogLUT, buildHaloLUT} from './optics-lut.js';
import {prismDmin, ICE_N, PRISM_60} from './halos.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const halo = buildHaloLUT();
const bow = buildBowLUT(256, 0.63); // ~5 mm/h Marshall-Palmer drop

function edgeAndPeak(lut, c) {
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

{
  // Halo inner edges: the Monte-Carlo histogram's 2%-threshold
  // edge sits at the Warren-Brandt minimum deviation per channel
  // (within the bin width + solar smear), red inside blue.
  const DEG = 180 / Math.PI;
  const r = edgeAndPeak(halo, 0);
  const g = edgeAndPeak(halo, 1);
  const b = edgeAndPeak(halo, 2);
  const want = ICE_N.map((n) => prismDmin(n, PRISM_60) * DEG);
  const ok =
    Math.abs(r.edge - want[0]) < 0.45 &&
    Math.abs(g.edge - want[1]) < 0.45 &&
    Math.abs(b.edge - want[2]) < 0.45 &&
    r.edge < b.edge &&
    r.peak < b.peak;
  check(
    'halo inner edges',
    ok,
    `red ${r.edge.toFixed(2)} / green ${g.edge.toFixed(2)} / blue ${b.edge.toFixed(2)} deg against the Warren-Brandt minima ${want.map((w) => w.toFixed(2)).join('/')} - red inside blue`
  );
}

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

{
  // The bow: Airy primary near 42 with blue INSIDE red, the
  // secondary reversed near 51, Alexander's dark band between
  // them, the ratio in the Fresnel range.
  const rp = bowStats(0, 38, 45);
  const bp = bowStats(2, 38, 45);
  const rs = bowStats(0, 46, 56);
  const bs = bowStats(2, 46, 56);
  let band = 0;
  let cnt = 0;
  const {data, bins, thMinDeg, thMaxDeg} = bow;
  const dth = (thMaxDeg - thMinDeg) / bins;
  for (let i = 0; i < bins; i++) {
    const th = thMinDeg + (i + 0.5) * dth;
    if (th < 44.5 || th > 48.5) continue;
    band += Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    cnt++;
  }
  band /= cnt;
  const ok =
    rp.peak > 41.5 &&
    rp.peak < 42.6 &&
    bp.peak < rp.peak - 0.8 &&
    rs.peak > 49.5 &&
    rs.peak < 53 &&
    bs.peak > rs.peak + 0.8 &&
    band < 0.05 &&
    rs.peakV / rp.peakV > 0.15 &&
    rs.peakV / rp.peakV < 0.7;
  check(
    'the bow LUT',
    ok,
    `red primary ${rp.peak.toFixed(2)} deg (blue ${bp.peak.toFixed(2)}, inside); secondary ${rs.peak.toFixed(2)} (blue ${bs.peak.toFixed(2)}, reversed); Alexander's band ${(band * 100).toFixed(1)}%; ratio ${(rs.peakV / rp.peakV).toFixed(2)}`
  );
}

{
  // The Airy upgrade the geometric histogram could not carry:
  // supernumerary fringes inside the primary, tightening as the
  // drop grows - count the green-channel local maxima below the
  // primary peak in drizzle vs downpour LUTs.
  const fringes = (aMm) => {
    const l = buildBowLUT(256, aMm);
    const dth = (l.thMaxDeg - l.thMinDeg) / l.bins;
    const g = (i) => l.data[i * 4 + 1];
    let pi = 0;
    for (let i = 0; i < l.bins; i++) {
      const th = l.thMinDeg + (i + 0.5) * dth;
      if (th < 45 && g(i) > g(pi)) pi = i;
    }
    let count = 0;
    let firstGap = null;
    for (let i = pi - 2; i > 1; i--) {
      if (g(i) > g(i - 1) && g(i) > g(i + 1) && g(i) > 0.02) {
        count++;
        if (firstGap === null) firstGap = (pi - i) * dth;
      }
    }
    return {count, firstGap};
  };
  const drizzle = fringes(0.45); // 1 mm/h MP drop
  const pour = fringes(0.73); // 10 mm/h
  const ok =
    drizzle.count >= 1 && pour.count >= 1 && drizzle.firstGap > pour.firstGap;
  check(
    'supernumerary fringes',
    ok,
    `drizzle drop: ${drizzle.count} fringes, first ${drizzle.firstGap.toFixed(2)} deg inside; downpour: first ${pour.firstGap.toFixed(2)} deg - tighter, the (ka)^(-2/3) law through the LUT`
  );
}

{
  // The dog LUT: alive at 25 deg elevation with its peak OUTSIDE
  // the halo edge (the Bravais migration), red toward the
  // source; empty past the cutoff.
  const DEG = 180 / Math.PI;
  const d25 = buildDogLUT((25 * Math.PI) / 180);
  const dead = buildDogLUT((65 * Math.PI) / 180);
  const peakAz = (c) => {
    let bi = 0;
    for (let i = 0; i < d25.bins; i++) {
      if (d25.data[i * 4 + c] > d25.data[bi * 4 + c]) bi = i;
    }
    return (
      d25.azMinDeg + ((bi + 0.5) * (d25.azMaxDeg - d25.azMinDeg)) / d25.bins
    );
  };
  const haloEdge = prismDmin(ICE_N[0], PRISM_60) * DEG;
  const ok =
    d25.any &&
    peakAz(0) > haloEdge + 4 &&
    peakAz(2) > peakAz(0) &&
    !dead.any &&
    dead.data.every((v, i) => i % 4 === 3 || v === 0);
  check(
    'the dog LUT',
    ok,
    `at 25 deg the red dog sits ${peakAz(0).toFixed(1)} deg out (halo edge ${haloEdge.toFixed(1)} - migrated), blue at ${peakAz(2).toFixed(1)} (red toward the source); at 65 deg the LUT is empty`
  );
}

process.exit(fail ? 1 : 0);
