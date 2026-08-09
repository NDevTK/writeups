// Reference printer for the measured-comet-brightness machinery
// (node cobs-reference.mjs). The law lives in cobs.js and the
// landmarks hold it on VENDORED REAL COBS observations
// (2026-08-08, three currently observed comets):
//  - the per-comet median of the vendored week reproduces the
//    hand-computed values (220P's four estimates 6.7-7.2 ->
//    median 6.9)
//  - the window and min-count floors are honest: stale rows
//    fall out, a two-estimate comet never steers the sky
//  - the designation key joins COBS fullnames to SOFT00 names
//    for numbered and unnumbered comets alike
import {
  COBS_MIN_N,
  COBS_WINDOW_DAYS,
  cobsMedians,
  cometKey,
  measuredMag
} from './cobs.js';
import {COBS_FIXTURE} from './cobs-fixture.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const NOW = Date.parse('2026-08-09T12:00:00Z');
const med = cobsMedians(COBS_FIXTURE, NOW);

// ---- 1. the medians are the observations' own -------------------
{
  check(
    'per-comet medians reproduce the vendored week',
    med['220P'] &&
      med['220P'].mag === 6.9 &&
      med['220P'].n === 4 &&
      med['10P'] &&
      med['10P'].n >= COBS_MIN_N,
    `220P's four estimates (6.7, 6.8, 7.0, 7.2) -> median ` +
      `${med['220P']?.mag} of n=${med['220P']?.n}; 10P carries ` +
      `n=${med['10P']?.n} - the network's own numbers, reduced`
  );
}

// ---- 2. window and floor honesty --------------------------------
{
  const stale = cobsMedians(
    COBS_FIXTURE,
    NOW + (COBS_WINDOW_DAYS + 2) * 86400e3
  );
  const two = cobsMedians(COBS_FIXTURE.slice(0, 2), NOW);
  check(
    'stale rows fall out; two estimates never steer',
    Object.keys(stale).length === 0 && Object.keys(two).length === 0,
    `the same rows ${COBS_WINDOW_DAYS + 2} days later reduce to nothing, ` +
      `and ${COBS_MIN_N - 1} estimates stay below the documented ` +
      `COBS_MIN_N=${COBS_MIN_N} floor - no single-observer sky`
  );
}

// ---- 3. the SOFT00 join -----------------------------------------
{
  const k1 = cometKey('220P/McNaught');
  const k2 = cometKey('C/2024 J3 (ATLAS)');
  const m = measuredMag('220P/McNaught', med);
  check(
    'designations join both catalogues',
    k1 === '220P' &&
      k2 === 'C/2024 J3' &&
      m === 6.9 &&
      measuredMag('C/1995 O1 (Hale-Bopp)', med) === null,
    `"220P/McNaught" -> ${k1}; "C/2024 J3 (ATLAS)" -> ${k2}; the SOFT00 ` +
      `name finds its measured ${m}; an unobserved comet returns null and ` +
      `keeps the g/k formula - fails to data, never to style`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
