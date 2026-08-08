// Reference printer for the satellite standard magnitudes (node
// satmags-reference.mjs). The catalogue lives once in satmags.js;
// landmarks:
//  - the parser against the documented satellites.dat format
//    (comments, tabs, empty-magnitude rows) on an embedded sample
//  - the snapshot's anchors: ISS -2.5, Hubble 1.5, Envisat 3.0 -
//    values stable across the McCants lineage (the archived 2014
//    qs.mag prints the same 1.5 / 3.0)
//  - the convention anchor: satMagnitude(1000 km, 90 deg, m)
//    returns m EXACTLY for every vendored value - the catalogue's
//    defining point (McCants: -15.75 + 2.5 log10(1e6/0.5) = 0)
//    is the point where sats.js's Lambert law normalises
//  - the retired default in context: the snapshot median is 3.5,
//    against the old flat 4.0, with a 10-magnitude real spread
//  - the lore check: the ISS overhead (-2.5 at ~420 km) comes out
//    Venus-class, brighter than every star
import {parseSatMags, SATMAG_SNAPSHOT, snapshotMap} from './satmags.js';
import {satMagnitude, STD_MAG_DEFAULT} from './sats.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  const sample = [
    '# comment line',
    '',
    '25544\t-2.5\t399.05',
    '20580\t1.5\t55.44',
    '99999\t\t12.0',
    'garbage line',
    '11111\t4.25\t'
  ].join('\n');
  const m = parseSatMags(sample);
  check(
    'satellites.dat parser (documented format)',
    m.size === 3 &&
      m.get(25544) === -2.5 &&
      m.get(20580) === 1.5 &&
      m.get(11111) === 4.25 &&
      !m.has(99999),
    `3 magnitudes from 7 lines; RCS-only row skipped, comments and garbage dropped`
  );
}

{
  const iss = SATMAG_SNAPSHOT[25544];
  const hst = SATMAG_SNAPSHOT[20580];
  const envisat = SATMAG_SNAPSHOT[27386];
  check(
    'catalogue anchors (McCants lineage)',
    iss === -2.5 && hst === 1.5 && envisat === 3.0,
    `ISS ${iss}, Hubble ${hst}, Envisat ${envisat} (Hubble and Envisat identical in the archived 2014 qs.mag)`
  );
}

{
  // The convention anchor: 1000 km at half phase returns the
  // standard magnitude exactly, for every vendored value.
  let worst = 0;
  for (const m of snapshotMap().values()) {
    worst = Math.max(worst, Math.abs(satMagnitude(1000, Math.PI / 2, m) - m));
  }
  check(
    'convention anchor (1000 km, half illuminated)',
    worst < 1e-12,
    `satMagnitude(1000, 90 deg, m) = m to ${worst.toExponential(1)} across ${snapshotMap().size} satellites`
  );
}

{
  const vals = Object.values(SATMAG_SNAPSHOT).sort((a, b) => a - b);
  const median = vals[Math.floor(vals.length / 2)];
  const span = vals[vals.length - 1] - vals[0];
  check(
    'the retired default in context',
    vals.length >= 130 &&
      median >= 3.0 &&
      median <= 4.0 &&
      median < STD_MAG_DEFAULT &&
      span > 8,
    `${vals.length} vendored ids; median ${median} vs old flat default ${STD_MAG_DEFAULT}; real spread ${vals[0]}..${vals[vals.length - 1]}`
  );
}

{
  // The ISS overhead: -2.5 standard magnitude at ~420 km range,
  // half phase, comes out brighter than magnitude -4 - the
  // Venus-class pass of observing lore - while a 4.0-class
  // rocket body at the same geometry sits near +2.
  const issOverhead = satMagnitude(420, Math.PI / 2, SATMAG_SNAPSHOT[25544]);
  const rbOverhead = satMagnitude(420, Math.PI / 2, 4.0);
  check(
    'ISS Venus-class lore',
    issOverhead < -4 &&
      issOverhead > -5.5 &&
      rbOverhead > 1.5 &&
      rbOverhead < 2.5,
    `ISS overhead ${issOverhead.toFixed(2)} (Venus-class); default-class body ${rbOverhead.toFixed(2)}`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
