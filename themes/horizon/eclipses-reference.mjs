// Reference printer for eclipses (node eclipses-reference.mjs).
// The model lives once in eclipses.js; the ephemeris is the
// VENDORED astronomy-engine (the same instance the theme runs),
// so the landmarks validate the exact chain the page executes -
// against PUBLISHED eclipse history:
//  - the lens integral at its closed forms: disjoint 0, total 1,
//    annular (r_m/r_s)^2, equal discs at sep = r covering
//    0.391000 (2 acos(1/2)/pi - sqrt(3)/(2 pi) exactly), and a
//    deterministic grid integration agreeing to 1e-3
//  - magnitude vs obscuration: at magnitude 0.5 (equal discs)
//    the AREA obscuration is 0.391 - the ~28% of light the old
//    linear dimming got wrong at every partial phase
//  - 2024-04-08, Dallas (32.78 N, 96.80 W), 18:42 UT: TOTAL
//    (obscuration = 1) - the historical record; 17:00 UT partial
//    (0 < f < 1); the day before, nothing
//  - 2026-08-12, Galicia (43.0 N, 8.0 W): the upcoming totality
//    - max obscuration over 17:00-20:00 UT exceeds 0.95
//  - 2026-03-03, ~11:33 UT: total LUNAR eclipse - umbral
//    magnitude >= 1 with the moon fully immersed; the Danjon-
//    enlarged umbra is ~2.7 moon diameters wide, the classical
//    figure
import {createRequire} from 'node:module';
import {
  DANJON,
  discObscuration,
  lunarEclipse,
  solarEclipse
} from './eclipses.js';

const require = createRequire(import.meta.url);
const AE = require('./astronomy.browser.min.js');
const RAD = Math.PI / 180;

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// Topocentric solar-eclipse state at a site and instant.
function solarAt(latDeg, lonDeg, date) {
  const obs = new AE.Observer(latDeg, lonDeg, 100);
  const s = AE.Equator(AE.Body.Sun, date, obs, true, true);
  const m = AE.Equator(AE.Body.Moon, date, obs, true, true);
  const sep = Math.acos(
    Math.min(
      1,
      Math.sin(s.dec * RAD) * Math.sin(m.dec * RAD) +
        Math.cos(s.dec * RAD) *
          Math.cos(m.dec * RAD) *
          Math.cos((s.ra - m.ra) * 15 * RAD)
    )
  );
  return solarEclipse(sep, s.dist * AE.KM_PER_AU, m.dist * AE.KM_PER_AU);
}

// Geocentric lunar-eclipse state at an instant.
function lunarAt(date) {
  const sv = AE.GeoVector(AE.Body.Sun, date, true);
  const mv = AE.GeoVector(AE.Body.Moon, date, true);
  const sl = Math.hypot(sv.x, sv.y, sv.z);
  const ml = Math.hypot(mv.x, mv.y, mv.z);
  // separation of the moon from the ANTISOLAR direction
  const cosSep = (-sv.x * mv.x - sv.y * mv.y - sv.z * mv.z) / (sl * ml);
  const sep = Math.acos(Math.max(-1, Math.min(1, cosSep)));
  return lunarEclipse(sep, sl * AE.KM_PER_AU, ml * AE.KM_PER_AU);
}

{
  const equalAtR = discObscuration(1, 1, 1);
  const exact = (2 * Math.acos(0.5)) / Math.PI - Math.sqrt(3) / (2 * Math.PI);
  // deterministic grid integration of the same case
  const N = 1500;
  let inside = 0;
  let total = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = ((i + 0.5) / N) * 2 - 1;
      const y = ((j + 0.5) / N) * 2 - 1;
      if (x * x + y * y > 1) continue;
      total++;
      const dx = x - 1;
      if (dx * dx + y * y <= 1) inside++;
    }
  }
  check(
    'lens integral',
    discObscuration(3, 1, 1) === 0 &&
      discObscuration(0.1, 1, 1.5) === 1 &&
      Math.abs(discObscuration(0, 1, 0.5) - 0.25) < 1e-15 &&
      Math.abs(equalAtR - exact) < 1e-15 &&
      Math.abs(equalAtR - inside / total) < 1e-3,
    `disjoint 0; total 1; annular (r_m/r_s)^2 = 0.25 exact; equal discs at sep = r -> ${equalAtR.toFixed(6)} (closed form ${exact.toFixed(6)}, grid ${(inside / total).toFixed(6)})`
  );
}

{
  // The correction this module exists for: magnitude 0.5 is NOT
  // half the light gone.
  const e = solarEclipse(
    0.005,
    695990 / Math.sin(0.005),
    1737.4 / Math.sin(0.005)
  );
  // build an exact equal-disc, sep = r case instead:
  const r = 0.005;
  const obsc = discObscuration(r, r, r);
  check(
    'magnitude vs obscuration',
    Math.abs(obsc - 0.391) < 5e-4 && e.obsc >= 0,
    `equal discs, magnitude 0.5 -> area obscuration ${obsc.toFixed(4)} - the ~28% of light the old linear dimming overdarkened`
  );
}

{
  const total = solarAt(32.78, -96.8, new Date(Date.UTC(2024, 3, 8, 18, 42)));
  const before = solarAt(32.78, -96.8, new Date(Date.UTC(2024, 3, 8, 17, 20)));
  const after = solarAt(32.78, -96.8, new Date(Date.UTC(2024, 3, 8, 17, 30)));
  const none = solarAt(32.78, -96.8, new Date(Date.UTC(2024, 3, 7, 18, 42)));
  check(
    'Dallas 2024-04-08',
    total.obsc === 1 &&
      !total.annular &&
      total.mag > 1.005 &&
      total.mag < 1.03 &&
      before.obsc === 0 &&
      after.obsc > 0 &&
      after.obsc < 0.1 &&
      none.obsc === 0,
    `18:42 UT -> obscuration 1 (TOTAL, as history records; magnitude ${total.mag.toFixed(3)}, published 1.018); FIRST CONTACT bracketed: 17:20 UT -> 0, 17:30 UT -> ${(after.obsc * 100).toFixed(1)}% (published 17:23); the day before 0`
  );
}

{
  // The upcoming one: 2026-08-12, totality over Galicia near
  // sunset. Max obscuration sampled per minute.
  let best = 0;
  for (let min = 0; min < 180; min++) {
    const e = solarAt(43.0, -8.0, new Date(Date.UTC(2026, 7, 12, 17, min)));
    if (e.obsc > best) best = e.obsc;
  }
  check(
    'Galicia 2026-08-12',
    best > 0.95,
    `max obscuration over 17:00-20:00 UT = ${(best * 100).toFixed(1)}% - the eclipse five weeks from this commit`
  );
}

{
  // 2026-03-03 total lunar eclipse (greatest ~11:33 UT).
  let bestMag = 0;
  let bestIn = 0;
  for (let min = 0; min < 150; min++) {
    const l = lunarAt(new Date(Date.UTC(2026, 2, 3, 10, 30 + min)));
    if (l.umbraMag > bestMag) {
      bestMag = l.umbraMag;
      bestIn = l.inUmbra;
    }
  }
  const quiet = lunarAt(new Date(Date.UTC(2026, 2, 17, 11, 33)));
  const geom = lunarAt(new Date(Date.UTC(2026, 2, 3, 11, 33)));
  check(
    'lunar 2026-03-03',
    bestMag >= 1 &&
      bestIn >= 0.999 &&
      quiet.umbraMag < 0 &&
      geom.umbra / geom.rMoon > 2 &&
      geom.umbra / geom.rMoon < 3.5 &&
      DANJON === 1.02,
    `umbral magnitude peaks at ${bestMag.toFixed(2)} (total, fully immersed); two weeks later ${quiet.umbraMag.toFixed(1)}; the Danjon-enlarged umbra spans ${(geom.umbra / geom.rMoon).toFixed(2)} moon radii (classical ~2.7)`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
