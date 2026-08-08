// Reference printer for the sea smoke (node seasmoke-reference.mjs).
// The law lives once in seasmoke.js - Shen et al. 2022
// (JAS-D-22-0065.1) anchors - and these landmarks hold it to the
// print:
//  - Table 1's classification by air-sea temperature difference:
//    warm advection (SAT > SST), cold advection (SAT < SST), sea
//    smoke (SAT << SST)
//  - the printed pair: no effect at and below the typical winter
//    ASTD band of 5-7 C ("with no fog"), and EXACTLY the printed
//    3.09 km lowest visibility at the printed ~20 C event
//  - Koschmieder consistency: smoke density linear in ASTD excess
//    means vis x (ASTD - 7) is a constant - exact, monotone
//  - the case anchors: the Qingdao buoy morning (air -13.3 C over
//    ~6.7 C water, RH 89 percent) lands on the printed visibility;
//    the 2006 large fog event at ASTD ~3 C classifies as cold
//    advection FOG, not smoke, and leaves the visibility to the
//    measured feed - the paper's own division of labour
import {
  seaFogClass,
  seaSmokeVisM,
  SMOKE_ASTD_EVENT,
  SMOKE_ASTD_NOFOG,
  SMOKE_VIS_EVENT_M
} from './seasmoke.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  check(
    'Table 1 classification',
    seaFogClass(10, 15) === 'warm-advection' &&
      seaFogClass(10, 8) === 'cold-advection' &&
      seaFogClass(6.7, -13.3) === 'sea-smoke' &&
      seaFogClass(8, 5) === 'cold-advection',
    `SAT>SST warm advection; SAT<SST cold advection; SAT<<SST sea smoke (the printed lineage: Willett 1928 / Saunders 1964)`
  );
}

{
  const atNofog = seaSmokeVisM(7 + SMOKE_ASTD_NOFOG - 7, 0); // ASTD exactly 7
  const below = seaSmokeVisM(5, 0); // ASTD 5, inside the printed band
  const atEvent = seaSmokeVisM(SMOKE_ASTD_EVENT, 0);
  check(
    'printed pair (no-fog band and the 2021 event)',
    atNofog === Infinity &&
      below === Infinity &&
      atEvent === SMOKE_VIS_EVENT_M &&
      SMOKE_ASTD_NOFOG === 7 &&
      SMOKE_ASTD_EVENT === 20,
    `ASTD <= 7 C -> no smoke (typical winter 5-7 C "with no fog"); ASTD 20 C -> ${atEvent} m exactly (printed 3.09 km)`
  );
}

{
  // Koschmieder consistency: density linear in ASTD excess means
  // vis x (ASTD - 7) is constant; monotone decreasing.
  const K = SMOKE_VIS_EVENT_M * (SMOKE_ASTD_EVENT - SMOKE_ASTD_NOFOG);
  let worst = 0;
  let mono = true;
  let prev = Infinity;
  for (let astd = 7.5; astd <= 30.001; astd += 0.5) {
    const v = seaSmokeVisM(astd, 0);
    worst = Math.max(worst, Math.abs((v * (astd - SMOKE_ASTD_NOFOG)) / K - 1));
    if (v > prev) mono = false;
    prev = v;
  }
  const half = seaSmokeVisM(13.5, 0);
  check(
    'Koschmieder linearity',
    worst < 1e-12 && mono && Math.abs(half - 2 * SMOKE_VIS_EVENT_M) < 1e-9,
    `vis x (ASTD-7) constant to ${worst.toExponential(1)}; monotone; the half-way ASTD 13.5 C gives exactly twice the event visibility (${(half / 1000).toFixed(2)} km)`
  );
}

{
  // The case anchors. Buoy morning: -13.3 C air over ~6.7 C water
  // (RH 89.0 percent printed) is ASTD 20.0 -> the printed lowest
  // visibility. The 2006 event at ASTD ~3 C: cold-advection FOG,
  // not smoke - this module adds nothing and the measured
  // visibility feed keeps the say.
  const buoy = seaSmokeVisM(6.7, -13.3);
  const ev2006 = seaSmokeVisM(3, 0);
  check(
    'case anchors (Qingdao 2021, Yellow Sea 2006)',
    Math.abs(buoy - SMOKE_VIS_EVENT_M) < 1e-9 &&
      seaFogClass(6.7, -13.3) === 'sea-smoke' &&
      ev2006 === Infinity &&
      seaFogClass(3, 0) === 'cold-advection',
    `-13.3 C air over 6.7 C water -> ${(buoy / 1000).toFixed(2)} km (printed 3.09); ASTD 3 C -> cold-advection fog, smoke silent`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
