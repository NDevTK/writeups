// Reference printer for the lightning model (node
// lightning-reference.mjs). The model lives once in lightning.js;
// landmarks against Rakov & Uman (2003) climatology and exact
// geometry:
//  - haversine: 1 degree of longitude on the equator is exactly
//    2 pi R / 360 = 111.1949 km; the antipodal distance is pi R
//  - Koschmieder: transmission at d = V is exp(-3.912) = 0.0200
//    EXACTLY - the 2% contrast threshold that DEFINES visibility
//  - flash statistics over 20k seeded draws: single-stroke
//    fraction 15-20%, mean multiplicity 3-5 (median 3),
//    interstroke geometric mean near 60 ms, subsequent strokes
//    ~0.4 of the first, continuing current in 30-50% of flashes
//  - flashAmplitude peaks AT the strokes, is zero before the
//    flash, and holds the continuing-current plateau between them
//  - bearing: a strike due east of the observer is at 90 deg
import {
  apparentFlash,
  CC_FRACTION,
  flashAmplitude,
  haversineKm,
  KOSCHMIEDER,
  R_EARTH,
  strikeBearing,
  strokeSequence,
  transmission
} from './lightning.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  const oneDeg = haversineKm(0, 0, 0, 1);
  const exact = (2 * Math.PI * R_EARTH) / 360;
  const anti = haversineKm(0, 0, 0, 180);
  check(
    'haversine',
    Math.abs(oneDeg - exact) < 1e-9 &&
      Math.abs(anti - Math.PI * R_EARTH) < 1e-6,
    `1 deg equatorial lon = ${oneDeg.toFixed(4)} km (2 pi R/360 = ${exact.toFixed(4)}); antipodal = pi R exactly`
  );
}

{
  const t = transmission(25, 25);
  const near = apparentFlash(10);
  const far = apparentFlash(100);
  check(
    'Koschmieder',
    Math.abs(t - Math.exp(-KOSCHMIEDER)) < 1e-15 &&
      Math.abs(t - 0.02) < 2e-4 &&
      near === 1 &&
      far < 0.01 * near,
    `T(d=V) = ${t.toFixed(5)} (exp(-3.912), the 2% contrast definition); flash at 10 km = 1 by construction, at 100 km ${(far / near).toExponential(2)} of it`
  );
}

{
  // Seeded LCG - the generator consumes explicit uniforms.
  let s = 12345;
  const lcg = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const draw = () => Array.from({length: 64}, lcg);
  const N = 20000;
  let singles = 0;
  let totalStrokes = 0;
  let cc = 0;
  let logIvl = 0;
  let nIvl = 0;
  let subRatios = [];
  const counts = [];
  for (let i = 0; i < N; i++) {
    const q = strokeSequence(draw());
    counts.push(q.strokes.length);
    totalStrokes += q.strokes.length;
    if (q.strokes.length === 1) singles++;
    if (q.cc) cc++;
    for (let k = 1; k < q.strokes.length; k++) {
      logIvl += Math.log((q.strokes[k].t - q.strokes[k - 1].t) * 1000);
      nIvl++;
      subRatios.push(q.strokes[k].amp);
    }
  }
  counts.sort((a, b) => a - b);
  subRatios.sort((a, b) => a - b);
  const mean = totalStrokes / N;
  const median = counts[N / 2];
  const gmIvl = Math.exp(logIvl / nIvl);
  const medSub = subRatios[Math.floor(subRatios.length / 2)];
  check(
    'Rakov-Uman statistics',
    singles / N > 0.14 &&
      singles / N < 0.2 &&
      mean > 3 &&
      mean < 5 &&
      median === 3 &&
      gmIvl > 50 &&
      gmIvl < 72 &&
      medSub > 0.34 &&
      medSub < 0.46 &&
      cc / N > 0.3 &&
      cc / N < 0.5 &&
      Math.abs(cc / N - CC_FRACTION) < 0.02,
    `20k flashes: single-stroke ${((singles / N) * 100).toFixed(1)}% (15-20); mean multiplicity ${mean.toFixed(2)} (3-5), median ${median}; interstroke geometric mean ${gmIvl.toFixed(1)} ms (~60); subsequent/first median ${medSub.toFixed(2)} (~0.4); continuing current ${((cc / N) * 100).toFixed(1)}% (30-50)`
  );
}

{
  // Shape: zero before the flash, peak AT each stroke, plateau
  // during continuing current.
  const seq = {
    strokes: [
      {t: 0, amp: 1},
      {t: 0.06, amp: 0.4}
    ],
    cc: {t0: 0.06, dur: 0.1, amp: 0.12},
    dur: 0.21
  };
  const before = flashAmplitude(seq, -0.001);
  const p1 = flashAmplitude(seq, 0);
  const between = flashAmplitude(seq, 0.04);
  const p2 = flashAmplitude(seq, 0.06);
  const plateau = flashAmplitude(seq, 0.12);
  check(
    'flash amplitude',
    before === 0 &&
      Math.abs(p1 - 1) < 1e-12 &&
      between < 0.01 &&
      p2 > 0.5 &&
      Math.abs(plateau - 0.12) < 0.01,
    `0 before; 1.000 at first stroke; ${between.toFixed(4)} mid-gap; ${p2.toFixed(2)} at the restrike; continuing-current plateau ${plateau.toFixed(3)} (0.12)`
  );
}

{
  const east = strikeBearing({lat: 46.6, lon: 8.0}, {lat: 46.6, lon: 8.5});
  const north = strikeBearing({lat: 46.6, lon: 8.0}, {lat: 47.0, lon: 8.0});
  const sw = strikeBearing({lat: 46.6, lon: 8.0}, {lat: 46.2, lon: 7.5});
  check(
    'strike bearing',
    Math.abs(east - 90) < 1e-9 &&
      Math.abs(north - 0) < 1e-9 &&
      sw > 180 &&
      sw < 270,
    `due east -> ${east.toFixed(1)} deg, due north -> ${north.toFixed(1)}, southwest quadrant -> ${sw.toFixed(1)}`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
