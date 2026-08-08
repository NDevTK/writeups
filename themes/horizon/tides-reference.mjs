// Reference printer for the tide harmonic frame (node
// tides-reference.mjs). The law lives once in tides.js -
// Schureman 1941 (SP-98, archive.org scan, Tables 1 and 38
// machine-read from the page images) against the vendored NOAA
// CO-OPS fixture (tide-fixture.js, San Francisco 9414290) - and
// these landmarks hold it to the print:
//  - the printed speed table DERIVES from four printed
//    astronomical rates through the standard lunisolar arguments
//  - the compound constituents are exact sums in the print
//  - NOAA's served speeds ARE the 1941 table, and the single
//    exception (M1) closes in print through the perigee rate
//  - a fit at the printed speeds to NOAA's own prediction series
//    reproduces a held-out week at the sub-millimetre level and
//    the published M2 inside the nodal envelope
import {
  FT_TO_M,
  H_RATE,
  M1_SERVED,
  N_RATE,
  P_RATE,
  S_RATE,
  T_RATE,
  TIDE_ARG,
  TIDE_SPEED,
  argSpeed,
  fitAmplitude,
  harmonicFit,
  nearestTideStation,
  synthesisSpeeds,
  tideSynth
} from './tides.js';
import {
  TIDE_FIT_M,
  TIDE_HARCON,
  TIDE_OOS_M,
  TIDE_STATION
} from './tide-fixture.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- 1. Table 38 derives from Table 1 ---------------------------
{
  let worst = 0;
  let worstName = '';
  let count = 0;
  for (const name of Object.keys(TIDE_ARG)) {
    const d = Math.abs(argSpeed(name) - TIDE_SPEED[name]);
    count++;
    if (d > worst) {
      worst = d;
      worstName = name;
    }
  }
  check(
    'printed speeds derive from printed rates',
    count >= 24 && worst < 2.5e-7,
    `${count} lunisolar arguments through T/s/h/p = 15/${S_RATE}/${H_RATE}/${P_RATE} ` +
      `deg/hr (Table 1, machine-read) land on Table 38's seven decimals - worst ` +
      `|composed - printed| = ${worst.toExponential(1)} deg/hr (${worstName}, print rounding)`
  );
}

// ---- 2. the compounds are exact sums ----------------------------
{
  const S = TIDE_SPEED;
  const pairs = [
    ['O1 + K1 = M2', S.O1 + S.K1, S.M2],
    ['K1 + P1 = S2', S.K1 + S.P1, S.S2],
    ['2 K1 = K2', 2 * S.K1, S.K2],
    ['M2 + K1 = MK3', S.M2 + S.K1, S.MK3],
    ['2 M2 - K1 = 2MK3', 2 * S.M2 - S.K1, S['2MK3']],
    ['M2 + N2 = MN4', S.M2 + S.N2, S.MN4],
    ['M2 + S2 = MS4', S.M2 + S.S2, S.MS4],
    ['2 S2 - M2 = 2SM2', 2 * S.S2 - S.M2, S['2SM2']],
    ['S2 + SA = R2', S.S2 + S.SA, S.R2],
    ['S2 - SA = T2', S.S2 - S.SA, S.T2],
    ['K1 - SA = S1', S.K1 - S.SA, S.S1],
    ['2 SA = SSA', 2 * S.SA, S.SSA],
    ['K1 - O1 = MF', S.K1 - S.O1, S.MF],
    ['S2 - M2 = MSF', S.S2 - S.M2, S.MSF],
    ['M2 - N2 = MM', S.M2 - S.N2, S.MM],
    ['2 M2 = M4', 2 * S.M2, S.M4],
    ['3 M2 = M6', 3 * S.M2, S.M6],
    ['4 M2 = M8', 4 * S.M2, S.M8]
  ];
  let worst = 0;
  for (const [, a, b] of pairs) worst = Math.max(worst, Math.abs(a - b));
  check(
    'compound speeds are exact printed sums',
    worst < 1.5e-7,
    `${pairs.length} identities (O1+K1=M2, K1+P1=S2, K1-O1=MF, ...) hold on the ` +
      `printed values - worst ${worst.toExponential(1)} deg/hr, the table's own ` +
      `seventh-decimal rounding: one astronomy, one table`
  );
}

// ---- 3. the feed serves the 1941 print --------------------------
{
  let worst = 0;
  let worstName = '';
  let m1 = null;
  for (const [name, , , served] of TIDE_HARCON) {
    if (name === 'M1') {
      m1 = served;
      continue;
    }
    const d = Math.abs(TIDE_SPEED[name] - served);
    if (d > worst) {
      worst = d;
      worstName = name;
    }
  }
  check(
    'NOAA serves Schureman verbatim',
    worst < 1.2e-5 && TIDE_HARCON.length === 37,
    `36 of 37 served speeds equal Table 38 to NOAA's own rounding - worst ` +
      `${worst.toExponential(1)} deg/hr (${worstName})`
  );
  check(
    'the M1 exception closes in print',
    Math.abs(m1 - M1_SERVED) < 1e-6,
    `served M1 ${m1} = printed M1 ${TIDE_SPEED.M1} + printed perigee rate ` +
      `${P_RATE} (= ${M1_SERVED.toFixed(7)}) - the modern convention folds the ` +
      `p-dependence into the speed instead of Schureman's nodal u; a definitional ` +
      `split, closed by Table 1 itself`
  );
}

// ---- 4. the fit at printed speeds -------------------------------
{
  const names = TIDE_HARCON.map((r) => r[0]);
  const speeds = synthesisSpeeds(names);
  const fit = harmonicFit(TIDE_FIT_M, speeds);
  let se = 0;
  for (let t = 0; t < TIDE_FIT_M.length; t++) {
    se += (tideSynth(fit, t) - TIDE_FIT_M[t]) ** 2;
  }
  const rmsIn = Math.sqrt(se / TIDE_FIT_M.length);
  let seO = 0;
  const t0 = TIDE_FIT_M.length; // OOS starts one step after the fit window
  for (let i = 0; i < TIDE_OOS_M.length; i++) {
    seO += (tideSynth(fit, t0 + i) - TIDE_OOS_M[i]) ** 2;
  }
  const rmsOut = Math.sqrt(seO / TIDE_OOS_M.length);
  check(
    'NOAA predictions ARE a synthesis at the printed speeds',
    rmsIn < 0.002 && rmsOut < 0.005,
    `60-day fit at the ${names.length} printed speeds: in-sample RMS ` +
      `${(rmsIn * 1000).toFixed(2)} mm, held-out week RMS ${(rmsOut * 1000).toFixed(2)} mm - ` +
      `the served product and the 1941 machine table are one physics`
  );
  const m2Fit = fitAmplitude(fit, 'M2', names);
  const m2Pub = TIDE_HARCON.find((r) => r[0] === 'M2')[1] * FT_TO_M;
  check(
    'published M2 recovered inside the nodal envelope',
    Math.abs(m2Fit - m2Pub) / m2Pub < 0.05,
    `fitted M2 ${m2Fit.toFixed(4)} m vs published 5-yr mean ${m2Pub.toFixed(4)} m ` +
      `(${((m2Fit / m2Pub - 1) * 100).toFixed(1)}%) - the 2026-epoch lunar-nodal ` +
      `factor, a few percent by construction (f and V0+u are documented scope: ` +
      `the fit absorbs them, which is what synthesis needs)`
  );
  const ordered =
    m2Fit > fitAmplitude(fit, 'K1', names) &&
    fitAmplitude(fit, 'K1', names) > fitAmplitude(fit, 'O1', names) &&
    fitAmplitude(fit, 'O1', names) > fitAmplitude(fit, 'S2', names);
  check(
    'San Francisco mixed-tide hierarchy',
    ordered && Math.abs(fit.mean) < 0.03,
    `M2 > K1 > O1 > S2 as published for the station; fit mean ` +
      `${(fit.mean * 100).toFixed(1)} cm (predictions ride the MSL datum)`
  );
}

// ---- 5. the live-feed helpers -----------------------------------
{
  const st = [
    {id: '9414290', name: 'San Francisco', lat: 37.806305, lng: -122.46589},
    {id: '9414750', name: 'Alameda', lat: 37.7717, lng: -122.3, tidal: true}
  ];
  const near = nearestTideStation(st, 37.81, -122.47, 75);
  const far = nearestTideStation(st, 46.62, 8.04, 75);
  check(
    'nearest-gauge discovery',
    near && near.id === '9414290' && near.km < 2 && far === null,
    `from the city front: ${near.name} at ${near.km.toFixed(1)} km; from the ` +
      `Alps: null - no gauge, the model fallback stands (fails closed)`
  );
  check(
    'fixture provenance sane',
    TIDE_STATION.id === '9414290' &&
      TIDE_FIT_M.length === 1464 &&
      TIDE_OOS_M.length === 168 &&
      Math.min(...TIDE_FIT_M) > -2 &&
      Math.max(...TIDE_FIT_M) < 2 &&
      Math.abs(N_RATE + 0.00220641) < 1e-12,
    `station ${TIDE_STATION.id}, 1464 + 168 hourly points, range ` +
      `${Math.min(...TIDE_FIT_M).toFixed(2)}..${Math.max(...TIDE_FIT_M).toFixed(2)} m ` +
      `(SF mixed tide); node rate carried for the documented f/u scope`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
