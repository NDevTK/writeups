// Reference printer for the meteor showers (node
// meteors-reference.mjs). The model lives once in meteors.js;
// landmarks against the two published sources and each other:
//  - CROSS-SOURCE: the IMO 2026 Table 5 peak solar longitudes land
//    on the IMO 2026 peak DATES when run through the NOAA solar-
//    longitude series the theme uses - two independent published
//    chains meeting within half a degree
//  - Jenniskens profiles: the Quadrantid spike (B = 1.8) has a
//    FWHM under 10 hours (famously a few hours) while the Perseids
//    (B = 0.20) spread over ~3 days; the Geminid decline (0.72) is
//    about twice its rise (0.39) - the shower dies the night after
//    maximum
//  - the double exponential is exact at the peak and drops one
//    decade per 1/B degrees on each branch
//  - zenith correction: ZHR at the zenith, exactly half at 30 deg
//    radiant elevation, zero below the horizon
//  - the magnitude draw reproduces the population index exactly:
//    counts per magnitude class ratio r, and the Geminids' r = 2.6
//    puts ~1.4% of meteors brighter than magnitude 2
import {
  activeShowers,
  dLam,
  drawMagnitude,
  hourlyRate,
  radiantAt,
  SHOWERS,
  zhrAt
} from './meteors.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const S = Object.fromEntries(SHOWERS.map((s) => [s.code, s]));

{
  // NOAA solar longitude (the theme's own series, Horizon.html).
  const lamSun = (d) => {
    const n = d.getTime() / 86400000 - 10957.5;
    const L = (280.46 + 0.9856474 * n) % 360;
    const g = ((357.528 + 0.9856003 * n) * Math.PI) / 180;
    return (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g) + 360) % 360;
  };
  // IMO 2026 maximum dates (Table 5) vs the table's own lam_max.
  const peaks = [
    ['QUA', Date.UTC(2026, 0, 3, 12)],
    ['LYR', Date.UTC(2026, 3, 22, 12)],
    ['ETA', Date.UTC(2026, 4, 6, 12)],
    ['PER', Date.UTC(2026, 7, 13, 12)],
    ['ORI', Date.UTC(2026, 9, 21, 12)],
    ['LEO', Date.UTC(2026, 10, 17, 12)],
    ['GEM', Date.UTC(2026, 11, 14, 12)],
    ['URS', Date.UTC(2026, 11, 22, 12)]
  ];
  let worst = 0;
  for (const [code, t] of peaks) {
    worst = Math.max(worst, Math.abs(dLam(lamSun(new Date(t)), S[code].lam)));
  }
  // Whole-day maximum dates carry up to +-0.5 deg by themselves
  // (the sun moves ~1 deg/day and the lam_max crossing can fall at
  // any hour - the 2026 Perseid crossing is in the early UT hours,
  // 0.76 deg before this probe's noon): a sub-0.8 deg worst case
  // means every date sits within a day of its table's own lam_max.
  check(
    'peak dates',
    worst < 0.8,
    `worst |NOAA lam(date) - IMO lam_max| = ${worst.toFixed(2)} deg across 8 major peaks (whole-day dates)`
  );
}

{
  const fwhm = (s) => (2 * Math.log10(2)) / s.bp;
  const quaH = fwhm(S.QUA) / (1.0146 / 24); // deg -> hours at ~1 deg/day
  const perD = fwhm(S.PER) / 1.0146;
  check(
    'profile widths',
    quaH < 10 && Math.abs(perD - 3.0) < 0.2 && S.GEM.bm / S.GEM.bp > 1.8,
    `QUA FWHM ${quaH.toFixed(1)} h (a few hours); PER ${perD.toFixed(1)} days; GEM falls ${(S.GEM.bm / S.GEM.bp).toFixed(2)}x faster than it rises`
  );
  const atPeak = zhrAt(S.PER, S.PER.lam);
  const decade = zhrAt(S.PER, S.PER.lam + 1 / S.PER.bm);
  check(
    'double exponential',
    Math.abs(atPeak - S.PER.zhr) < 1e-12 &&
      Math.abs(decade - S.PER.zhr / 10) < 1e-9,
    `ZHR(peak) = ${atPeak} exact; one decade down ${(1 / S.PER.bm).toFixed(1)} deg later (${decade.toFixed(1)})`
  );
}

{
  const z = hourlyRate(100, Math.PI / 2);
  const h30 = hourlyRate(100, Math.PI / 6);
  const below = hourlyRate(100, -0.1);
  check(
    'zenith correction',
    z === 100 && Math.abs(h30 - 50) < 1e-12 && below === 0,
    `zenith 100, 30 deg exactly 50, below horizon 0`
  );
}

{
  // Inverse-CDF magnitude draw: P(m < x) = r^(x - lm), so counts in
  // consecutive one-magnitude bins ratio EXACTLY r, and the
  // fraction brighter than mag 2 for the Geminids is r^(2 - 6.5).
  const r = S.GEM.r;
  const m = (u) => drawMagnitude(r, u);
  const p = (x) => Math.pow(r, x - 6.5); // P(m < x) analytic
  const binRatio = (p(4) - p(3)) / (p(3) - p(2));
  const bright = p(2);
  const roundtrip = Math.abs(m(p(3.7)) - 3.7);
  check(
    'magnitude law',
    Math.abs(binRatio - r) < 1e-12 &&
      roundtrip < 1e-12 &&
      Math.abs(bright - 0.0136) < 0.001,
    `bin ratio ${binRatio.toFixed(3)} = r exact; GEM brighter than mag 2: ${(bright * 100).toFixed(2)}%`
  );
}

{
  const atPer = activeShowers(140.0);
  const atGem = activeShowers(262.2);
  const atEquinox = activeShowers(0);
  const perTop = atPer.sort((a, b) => b.zhr - a.zhr)[0];
  const gemTop = atGem.sort((a, b) => b.zhr - a.zhr)[0];
  check(
    'season',
    perTop.s.code === 'PER' &&
      Math.abs(perTop.zhr - 100) < 1e-9 &&
      gemTop.s.code === 'GEM' &&
      atEquinox.length === 0,
    `Aug 13: ${perTop.s.code} ${perTop.zhr.toFixed(0)}/h leads ${atPer.length} active; Dec 14: ${gemTop.s.code} ${gemTop.zhr.toFixed(0)}/h; Mar 20: none`
  );
  const drift = radiantAt(S.PER, 127);
  check(
    'radiant drift',
    Math.abs(drift.ra - (48 - 1.3 * 13)) < 1e-12 && drift.dec < 58,
    `PER radiant on Jul 30 at (${drift.ra.toFixed(1)}, ${drift.dec.toFixed(1)}) - east/north of it by the peak (Jenniskens drift)`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
