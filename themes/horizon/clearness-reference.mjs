// Reference gate for clearness.js (node clearness-reference.mjs):
//  - Haurwitz (1945) at its closed points: zenith
//    1098 e^-0.057, the horizon zero, monotone in cos Z
//  - Erbs, Klein & Duffie (1982) verbatim: the linear branch,
//    and the correlation's OWN near-continuity at both branch
//    boundaries (0.22 and 0.80 - the quartic lands on the 0.165
//    plateau to 4e-4, a fact of the published coefficients)
//  - the clearness index: exact ratio identity, the low-sun
//    null, the clamps
//  - the ambient factor: EXACTLY 1 at the clear anchor kt = 0.8,
//    the thin-overcast brightening (a real, documented effect),
//    the deep-overcast dimming, the clamps
//  - the LIVE capture: pickHour takes the 13:00 row (801 W/m^2,
//    the latest at or before the capture instant), and against
//    the standard solar-declination geometry that afternoon was
//    CLEAR (kt near 1) - which its own 895 W/m^2 late morning
//    corroborates
import {
  ambientFactor,
  clearnessIndex,
  erbsDiffuse,
  haurwitz,
  pickHour
} from './clearness.js';
import {CAPTURE_MS, GHI_FIXTURE} from './clearness-fixture.mjs';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // Haurwitz closed points.
  const zen = haurwitz(1);
  const ok =
    Math.abs(zen - 1098 * Math.exp(-0.057)) < 1e-12 &&
    haurwitz(0) === 0 &&
    haurwitz(-0.3) === 0 &&
    haurwitz(0.9) > haurwitz(0.5) &&
    haurwitz(0.5) > haurwitz(0.2) &&
    Math.abs(haurwitz(0.5) - 1098 * 0.5 * Math.exp(-0.114)) < 1e-12;
  check(
    'Haurwitz clear sky',
    ok,
    `zenith ${zen.toFixed(2)} W/m^2 = 1098 e^-0.057 exactly; zero at the horizon; monotone in cos Z`
  );
}

{
  // Erbs verbatim, and its own near-continuity: the published
  // coefficients make the quartic meet the linear branch at
  // kt = 0.22 and land on the 0.165 plateau at kt = 0.80 - to a
  // few 1e-4, a property OF the correlation, not of our code.
  const gap22 = Math.abs(erbsDiffuse(0.22) - (1 - 0.09 * 0.22));
  const q = (k) =>
    0.9511 - 0.1604 * k + 4.388 * k * k - 16.638 * k ** 3 + 12.336 * k ** 4;
  const gap80 = Math.abs(q(0.8) - 0.165);
  const ok =
    Math.abs(erbsDiffuse(0.1) - 0.991) < 1e-12 &&
    gap22 < 2e-3 &&
    gap80 < 5e-4 &&
    erbsDiffuse(0.95) === 0.165 &&
    erbsDiffuse(0.5) > erbsDiffuse(0.75);
  check(
    'Erbs diffuse fraction',
    ok,
    `kd(0.1) = 0.991 exactly (the linear branch); the quartic meets the branches to ${gap22.toExponential(1)} at 0.22 and ${gap80.toExponential(1)} at 0.80 - the published coefficients' own continuity; clear plateau 0.165`
  );
}

{
  // The clearness index and the ambient factor at their closed
  // points.
  const kt = clearnessIndex(haurwitz(0.7) * 0.5, 0.7);
  const ok =
    Math.abs(kt - 0.5) < 1e-12 &&
    clearnessIndex(500, 0.05) === null &&
    clearnessIndex(-5, 0.7) === null &&
    clearnessIndex(5000, 0.9) === 1.3 &&
    Math.abs(ambientFactor(0.8) - 1) < 1e-12 &&
    ambientFactor(0.35) > 2 &&
    ambientFactor(0.05) < 0.5 &&
    ambientFactor(null) === null;
  check(
    'clearness and ambient factor',
    ok,
    `kt is the exact GHI ratio (half the Haurwitz sky -> 0.5); null below cos Z = 0.1; ambientFactor(0.8) = 1 exactly (the Erbs clear anchor); thin overcast kt 0.35 brightens the diffuse x${ambientFactor(0.35).toFixed(2)} (the real effect), deep overcast dims to ${ambientFactor(0.05).toFixed(2)}`
  );
}

{
  // The LIVE capture: the 13:00 row is the latest at or before
  // 13:21 (801 W/m^2 exactly); with the standard declination
  // geometry for Jul 10 (decl ~ +22.2 deg, eq. of time ~ -5 min,
  // Interlaken 46.69 N 7.86 E -> solar elevation ~ 57 deg at the
  // hour midpoint, cos Z ~ 0.84 +- 0.02) that reads kt ~ 0.9 -
  // a clear afternoon, corroborated by the day's own 895 peak.
  const h = pickHour(
    GHI_FIXTURE.hourly.time,
    GHI_FIXTURE.hourly.shortwave_radiation,
    CAPTURE_MS
  );
  const cosZ = 0.84;
  const kt = clearnessIndex(h.ghi, cosZ);
  const stale = pickHour(
    GHI_FIXTURE.hourly.time,
    GHI_FIXTURE.hourly.shortwave_radiation,
    CAPTURE_MS + 30 * 24 * 3600e3
  );
  const ok =
    h.ghi === 801 &&
    new Date(h.ms).toISOString().startsWith('2026-07-10T13:00') &&
    kt > 0.8 &&
    kt < 1.05 &&
    stale === null &&
    Math.max(...GHI_FIXTURE.hourly.shortwave_radiation) === 895;
  check(
    'live satellite capture',
    ok,
    `pickHour -> 13:00 UTC, ${h.ghi} W/m^2 (the latest at or before 13:21); kt = ${kt.toFixed(2)} at the declination geometry's cos Z - a clear Bernese afternoon; a month later every row is stale`
  );
}

process.exit(fail ? 1 : 0);
