// Reference printer for the GMN measured-meteor kinematics
// (node gmn-reference.mjs). The law lives once in gmn.js - Vida
// et al. 2021 (MNRAS/arXiv, the network system paper) over
// VENDORED REAL rows of the daily trajectory summary (fetched
// 2026-08-08, CC BY 4.0) - and these landmarks hold it:
//  - the parser reads the fixed-format file at its own printed
//    validity fences (begin 50-150 km, end 20-130 km, end below
//    begin) and the sporadic '...' code
//  - THE BRIDGE READS THE PHYSICS RIGHT: on every vendored real
//    row, path/sin(entry elevation)/V reproduces the network's
//    own measured Duration column - the kinematics the theme
//    draws are the ones the network measured
//  - the medians machinery is robust (odd/even, the minN floor)
//    and the vendored real-day medians are physical: the fast
//    Perseids ablate high (109 -> 95 km), the slow Capricornids
//    low (94 -> 83 km) - the height-velocity physics visible in
//    one day of data
//  - the exact slant-range chord hinges (vertical = the shell
//    height exactly; grazing floor) and the streak kinematics
//    scale exactly as V sin(D) / range - the old fixed-range
//    "20 deg/s" display mapping retires against derived numbers
import {
  GMN_COL,
  GMN_HT_BEG_KM,
  GMN_HT_END_KM,
  GMN_LM,
  GMN_ORBITS,
  GMN_RADIANT_PREC_DEG,
  gmnMedians,
  parseTrajSummary,
  R_E_KM,
  slantRangeKm,
  streakKinematics
} from './gmn.js';
import {GMN_DEFAULT_MEDIANS, GMN_FIXTURE_ROWS} from './gmn-fixture.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const rows = parseTrajSummary(GMN_FIXTURE_ROWS);

// ---- 1. the vendored real rows parse ----------------------------
{
  check(
    'real rows parse at the printed fences',
    rows.length === 4 &&
      rows.some((r) => r.code === 'PER') &&
      rows.some((r) => r.code === 'spo') &&
      rows.some((r) => r.code === 'CAP') &&
      rows.every(
        (r) =>
          r.htBegKm > r.htEndKm &&
          r.htBegKm >= GMN_HT_BEG_KM[0] &&
          r.htBegKm <= GMN_HT_BEG_KM[1] &&
          r.htEndKm >= GMN_HT_END_KM[0] &&
          r.htEndKm <= GMN_HT_END_KM[1] &&
          r.durS > 0 &&
          r.vKms > 5
      ) &&
      GMN_COL.htBeg === 67 &&
      GMN_COL.dur === 75,
    `a Perseid, a sporadic ('...' -> spo), a Capricornid and an SDA parse ` +
      `with Vida's own validity fences (begin 50-150 km, end 20-130 km) and ` +
      `the fixed column map; malformed and out-of-fence rows drop`
  );
  check(
    'printed network frame carried',
    GMN_LM === 6.0 && GMN_ORBITS === 220000 && GMN_RADIANT_PREC_DEG === 0.47,
    `limiting magnitude +6.0, 220,000+ orbits, 0.47 deg median radiant ` +
      `precision - Vida 2021's own numbers, the world's largest open optical ` +
      `meteor survey (CC BY)`
  );
}

// ---- 2. the bridge reads the measured physics -------------------
{
  let worst = 0;
  for (const r of rows) {
    const pred =
      (r.htBegKm - r.htEndKm) / Math.sin((r.elevDeg * Math.PI) / 180) / r.vKms;
    worst = Math.max(worst, Math.abs(pred / r.durS - 1));
  }
  check(
    'path/sin(elev)/V reproduces the measured durations',
    worst < 0.2,
    `on every vendored real row the kinematic bridge lands within ` +
      `${(worst * 100).toFixed(0)}% of the network's own measured Duration ` +
      `column (the residual is in-flight deceleration, mostly absorbed by ` +
      `Vavg) - the drawn kinematics are the measured ones`
  );
}

// ---- 3. medians ---------------------------------------------------
{
  const med = gmnMedians(rows, 1);
  const floored = gmnMedians(rows, 3);
  const d = GMN_DEFAULT_MEDIANS;
  check(
    'medians machinery and the vendored real day',
    med.PER &&
      med.all.n === 4 &&
      floored.PER === undefined &&
      floored.all.n === 4 &&
      d.PER.htBegKm === 109.1 &&
      d.PER.htEndKm === 95.0 &&
      d.CAP.htBegKm === 94.3 &&
      d.CAP.htEndKm === 82.8 &&
      d.PER.vKms > 2 * d.CAP.vKms &&
      d.PER.htBegKm > d.CAP.htBegKm + 10 &&
      d.all.n === 6916,
    `per-code medians with the documented minN floor; the vendored day ` +
      `(6916 meteors): fast Perseids (${d.PER.vKms} km/s) ablate at ` +
      `${d.PER.htBegKm}-${d.PER.htEndKm} km, slow Capricornids ` +
      `(${d.CAP.vKms} km/s) at ${d.CAP.htBegKm}-${d.CAP.htEndKm} km - the ` +
      `height-velocity physics visible in one day of measurements`
  );
}

// ---- 4. the exact kinematics ------------------------------------
{
  const vert = slantRangeKm(100, Math.PI / 2);
  const graze = slantRangeKm(100, 0);
  check(
    'slant chord hinges',
    Math.abs(vert - 100) < 1e-9 &&
      graze > 700 &&
      graze < 1000 &&
      Math.abs(
        graze -
          (Math.sqrt(
            R_E_KM * R_E_KM * Math.sin(0.05) ** 2 + 2 * R_E_KM * 100 + 1e4
          ) -
            R_E_KM * Math.sin(0.05))
      ) < 1e-9,
    `straight up = the shell height exactly (${vert.toFixed(1)} km); the ` +
      `grazing floor caps the chord at ${graze.toFixed(0)} km - no infinite ` +
      `horizon ranges`
  );
  const med = GMN_DEFAULT_MEDIANS.PER;
  const k = streakKinematics(
    med,
    (40 * Math.PI) / 180,
    0.8,
    (30 * Math.PI) / 180
  );
  const rateDeg = (k.rateRadS * 180) / Math.PI;
  const lenDeg = (k.lenRad * 180) / Math.PI;
  check(
    'streak kinematics derived, not styled',
    Math.abs(k.pathKm - (109.1 - 95.0) / Math.sin((40 * Math.PI) / 180)) <
      1e-9 &&
      Math.abs(k.durS - k.pathKm / med.vKms) < 1e-12 &&
      rateDeg > 10 &&
      rateDeg < 20 &&
      lenDeg > 3 &&
      lenDeg < 9 &&
      k.durS > 0.2 &&
      k.durS < 0.6 &&
      Math.abs(k.rateRadS - (med.vKms * 0.8) / k.rangeKm) < 1e-12,
    `a Perseid-median streak (radiant 40 deg up, seen at D with sinD 0.8, ` +
      `point 30 deg up): path ${k.pathKm.toFixed(1)} km at range ` +
      `${k.rangeKm.toFixed(0)} km -> ${lenDeg.toFixed(1)} deg long, sweeping ` +
      `${rateDeg.toFixed(1)} deg/s for ${k.durS.toFixed(2)} s - V sin(D)/range ` +
      `exactly, on yesterday's measured heights and speeds`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
