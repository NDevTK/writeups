// Reference printer for the nightglow gravity-wave banding
// (node gwaves-reference.mjs). The law lives once in gwaves.js -
// Hwang et al. 2022 (ANGEO, three years of OI 557.7 all-sky
// imaging: the very line and layer the theme's dome draws) and
// Suzuki et al. 2009 (ANGEO, 702 OH events with the printed
// amplitude window), both open access - and these landmarks
// hold it:
//  - the printed statistics are carried verbatim: the Bohyun
//    IQRs (wavelength/speed/period), the ~96 km layer, the
//    150-events-in-144-clear-nights cadence, the Kototabang
//    amplitude window [0.5%, 3%]
//  - INTERNAL CONSISTENCY: the printed medians' own implied
//    period (lambda/c) sits inside the printed period IQR -
//    three independently printed distributions agree
//  - the nightly draw is deterministic per site-night, lands
//    inside every printed window, spreads across nights, and
//    every drawn train's implied period stays physical
//  - the wave-vector bridge is exact: |k| = 2 pi / lambda,
//    omega = k c, compass azimuth to the scene frame
import {
  GW_AMP,
  GW_EVENTS,
  GW_LAMBDA_KM,
  GW_LAMBDA_MED_KM,
  GW_LAYER_KM,
  GW_NIGHTS,
  GW_PERIOD_MIN,
  GW_PERIOD_MED_MIN,
  GW_SPEED_MS,
  GW_SPEED_MED_MS,
  gwNight,
  gwNightIndex,
  gwUniforms
} from './gwaves.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- 1. the printed statistics ----------------------------------
{
  check(
    'printed Bohyun frame carried',
    GW_LAYER_KM === 96 &&
      GW_LAMBDA_KM[0] === 20.5 &&
      GW_LAMBDA_KM[1] === 35.5 &&
      GW_LAMBDA_MED_KM === 27.8 &&
      GW_SPEED_MS[0] === 27.4 &&
      GW_SPEED_MS[1] === 45.0 &&
      GW_SPEED_MED_MS === 36.3 &&
      GW_PERIOD_MIN[0] === 10.8 &&
      GW_PERIOD_MIN[1] === 13.7 &&
      GW_EVENTS === 150 &&
      GW_NIGHTS === 144,
    `OI 557.7 at ~96 km: wavelength IQR 20.5-35.5 km (median 27.8), speed ` +
      `27.4-45.0 m/s (median 36.3), period 10.8-13.7 min, 150 events in 144 ` +
      `clear nights - the imaged statistics of the very line the dome draws`
  );
  const implied = (GW_LAMBDA_MED_KM * 1000) / GW_SPEED_MED_MS / 60;
  check(
    'three printed distributions agree',
    implied > GW_PERIOD_MIN[0] &&
      implied < GW_PERIOD_MIN[1] &&
      Math.abs(implied - GW_PERIOD_MED_MIN) < 1.5,
    `the medians' own implied period 27.8 km / 36.3 m/s = ${implied.toFixed(1)} min ` +
      `sits inside the printed 10.8-13.7 min IQR (printed median 11.7) - ` +
      `wavelength, speed and period printed separately, consistent jointly`
  );
  check(
    'printed amplitude window carried',
    GW_AMP[0] === 0.005 && GW_AMP[1] === 0.03,
    `Suzuki's detection floor 0.5% to the printed "less than 3%" - the drawn ` +
      `modulation depth lives inside the imaged window`
  );
}

// ---- 2. the nightly draw ----------------------------------------
{
  let ok = true;
  const azs = [];
  const lams = [];
  for (let n = 200; n < 240; n++) {
    const d = gwNight(n, 46.6, 8.0);
    const d2 = gwNight(n, 46.6, 8.0);
    const u = gwUniforms(d);
    const periodMin = d.lambdaM / d.speedMs / 60;
    if (
      d.lambdaM !== d2.lambdaM ||
      d.azRad !== d2.azRad ||
      d.lambdaM < GW_LAMBDA_KM[0] * 1000 ||
      d.lambdaM > GW_LAMBDA_KM[1] * 1000 ||
      d.speedMs < GW_SPEED_MS[0] ||
      d.speedMs > GW_SPEED_MS[1] ||
      d.amp < GW_AMP[0] ||
      d.amp > GW_AMP[1] ||
      periodMin < 7 ||
      periodMin > 22 ||
      Math.abs(Math.hypot(u.kx, u.kz) - (2 * Math.PI) / d.lambdaM) > 1e-12 ||
      Math.abs(u.omega - Math.hypot(u.kx, u.kz) * d.speedMs) > 1e-9
    )
      ok = false;
    azs.push(d.azRad);
    lams.push(d.lambdaM);
  }
  const azSpread = Math.max(...azs) - Math.min(...azs);
  const lamSpread = Math.max(...lams) - Math.min(...lams);
  check(
    'deterministic nightly draw inside every printed window',
    ok && azSpread > Math.PI && lamSpread > 5000,
    `40 nights at one site: same night, same train; every wavelength, speed ` +
      `and amplitude inside its printed window; every implied period physical; ` +
      `|k| = 2pi/lambda and omega = kc exact; directions spread ` +
      `${((azSpread * 180) / Math.PI).toFixed(0)} deg, wavelengths ${(lamSpread / 1000).toFixed(1)} km`
  );
  check(
    'one seed per night, noon-anchored',
    gwNightIndex(0, 0) === gwNightIndex(10 * 3600e3, 0) &&
      gwNightIndex(0, 0) !== gwNightIndex(26 * 3600e3, 0) &&
      gwNightIndex(Date.UTC(2026, 7, 8, 22), 8) ===
        gwNightIndex(Date.UTC(2026, 7, 9, 2), 8),
    `the seed anchors at local noon - a night's train never flips at midnight ` +
      `(22:00 and 02:00 share the draw)`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
