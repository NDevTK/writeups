// Reference printer for the satellite fleet (node
// sats-reference.mjs). The model lives once in sats.js; the
// element set below is REAL (CelesTrak visual group, fetched
// 2026-07-06: ATLAS CENTAUR 2, in orbit since 1963). Landmarks:
//  - the TLE format's own integrity check: both lines' modulo-10
//    checksums recompute to their column-69 digits; corrupting
//    one digit is caught and the set is dropped
//  - the vendored satellite.js (Vallado's SGP4) propagates the
//    set to a radius inside its own orbit band: mean motion
//    14.1255 rev/day -> a = 7233 km, e = 0.0546 -> r in
//    6838..7628 km
//  - Vallado's cylindrical shadow: sunward always lit; behind
//    the Earth on-axis shadowed; behind but one radius off-axis
//    lit; the boundary is R_eq exactly
//  - the McCants magnitude law: m = m_std exactly at 1000 km and
//    half phase; +5 mag at 10x the range (inverse square in
//    magnitudes); full phase brighter by 2.5 log10(pi) = 1.24
//    mag (the Lambert law is IMPORTED from earthshine.js - one
//    phase law for moon, earthshine and satellites)
import {createRequire} from 'node:module';
import {
  parseTLEs,
  satMagnitude,
  STD_MAG_DEFAULT,
  sunlitEci,
  tleChecksum
} from './sats.js';

const require = createRequire(import.meta.url);
const satellite = require('./satellite.min.js');

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const NAME = 'ATLAS CENTAUR 2';
const L1 =
  '1 00694U 63047A   26187.22180987  .00001171  00000+0  13245-3 0  9997';
const L2 =
  '2 00694  30.3521 252.9455 0545738  45.3796 319.0018 14.12553441148390';

{
  const parsed = parseTLEs(NAME + '\n' + L1 + '\n' + L2 + '\n');
  const corrupted = parseTLEs(
    NAME + '\n' + L1.slice(0, 20) + '9' + L1.slice(21) + '\n' + L2 + '\n'
  );
  check(
    'TLE checksums',
    tleChecksum(L1) === Number(L1[68]) &&
      tleChecksum(L2) === Number(L2[68]) &&
      parsed.length === 1 &&
      parsed[0].norad === 694 &&
      parsed[0].name === NAME &&
      corrupted.length === 0,
    `both lines recompute to their column-69 digits (${L1[68]}/${L2[68]}); norad 694 parsed; a one-digit corruption drops the set`
  );
}

{
  const rec = satellite.twoline2satrec(L1, L2);
  const pv = satellite.propagate(rec, new Date(Date.UTC(2026, 6, 6, 12)));
  const r = Math.hypot(pv.position.x, pv.position.y, pv.position.z);
  // n = 14.12553441 rev/day -> a = (mu/n^2)^(1/3) = 7233 km;
  // e = 0.0545738 -> r in [a(1-e), a(1+e)]
  const n = (14.12553441 * 2 * Math.PI) / 86400;
  const a = Math.cbrt(398600.4418 / (n * n));
  const lo = a * (1 - 0.0545738);
  const hi = a * (1 + 0.0545738);
  check(
    'SGP4 orbit band',
    r > lo && r < hi && Math.abs(a - 7233) < 5,
    `propagated |r| = ${r.toFixed(0)} km inside [${lo.toFixed(0)}, ${hi.toFixed(0)}] from the set's own n and e (a = ${a.toFixed(0)} km)`
  );
}

{
  const s = {x: 1, y: 0, z: 0};
  const lit = sunlitEci({x: 7000, y: 0, z: 0}, s);
  const behind = sunlitEci({x: -7000, y: 0, z: 0}, s);
  const offAxis = sunlitEci({x: -7000, y: 6400, z: 0}, s);
  const justIn = sunlitEci({x: -7000, y: 6378, z: 0}, s);
  check(
    'shadow cylinder',
    lit && !behind && offAxis && !justIn,
    `sunward lit; on-axis behind shadowed; 6400 km off-axis lit, 6378 km (R_eq boundary) still shadowed - Vallado sec. 5.3`
  );
}

{
  const half = satMagnitude(1000, Math.PI / 2);
  const far = satMagnitude(10000, Math.PI / 2);
  const full = satMagnitude(1000, 0);
  check(
    'McCants magnitude law',
    Math.abs(half - STD_MAG_DEFAULT) < 1e-12 &&
      Math.abs(far - half - 5) < 1e-12 &&
      Math.abs(half - full - 2.5 * Math.log10(Math.PI)) < 1e-12,
    `m(1000 km, 90 deg) = m_std = ${half}; 10x range -> +5.000 mag exactly; full phase -> ${(half - full).toFixed(3)} mag brighter (2.5 log10(pi) exactly, Lambert law shared with earthshine)`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
