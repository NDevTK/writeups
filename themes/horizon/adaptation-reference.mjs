// Reference gate for adaptation.js (node adaptation-reference.mjs):
// the LBNL 39882 visual-adaptation frame at its printed closed
// points, the derived photometric bridge against the textbook
// values it must reproduce, and the sky-transfer table's physics.
import {
  ARCSEC2_SR,
  E0_LUX,
  exposureShape,
  jnd,
  jndLog10,
  lum3,
  magArcsec2ToCdM2,
  magToLux,
  mesopicBlend,
  MESOPIC_HI_CDM2,
  MESOPIC_LO_CDM2,
  MOON_FULL_LUX,
  MOONSKY_ALT_DEG,
  MOONSKY_E_B,
  MOONSKY_E_G,
  MOONSKY_E_R,
  scotopicY,
  skyTransferE
} from './adaptation.js';
import {NATURAL_MCD, NATURAL_MAG} from './skyglow.js';
import {SUN_VMAG} from './moonlight.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // Table 1 verbatim: the scotopic floor, the two Weber branches
  // at slope exactly 1, the printed rod/cone crossover, and the
  // fit's own seam sizes at the four branch boundaries (a few
  // percent - printed fit, measured here, stated).
  const seam = (x) => Math.abs(jndLog10(x - 1e-9) - jndLog10(x + 1e-9));
  const slope = (x) => (jndLog10(x + 1e-6) - jndLog10(x - 1e-6)) / 2e-6;
  const seams = [-3.94, -1.44, -0.0184, 1.9].map(seam);
  const ok =
    jndLog10(-5) === -2.86 &&
    jndLog10(-10) === -2.86 &&
    Math.abs(slope(-0.7) - 1) < 1e-6 &&
    Math.abs(slope(3) - 1) < 1e-6 &&
    Math.abs(jndLog10(3) - (3 - 1.255)) < 1e-12 &&
    Math.abs(jndLog10(-0.7) - (-0.7 - 0.395)) < 1e-12 &&
    seams.every((s) => s < 0.05) &&
    jnd(1) > 0 &&
    Number.isNaN(jndLog10(NaN));
  check(
    'LBNL 39882 Table 1 verbatim',
    ok,
    `floor -2.86; Weber slopes 1 exactly in both linear branches; seams at the printed boundaries ${seams.map((s) => s.toFixed(3)).join('/')} (fit artefact, stated)`
  );
}

{
  // The contrast-matching exposure shape: monotone in adaptation
  // luminance, Weber-flat by day (exposure x luminance constant),
  // and the day-to-moonlit-night gain lands at the ~3e4 the
  // scene-light dead-end measured as missing.
  const eDay = exposureShape(1880); // clear-day mean sky, cd/m^2
  const eNight = exposureShape(5e-3); // full-moon sky
  const gain = eNight / eDay;
  let mono = true;
  let prev = Infinity;
  for (let lg = -4; lg <= 4.01; lg += 0.1) {
    const v = exposureShape(Math.pow(10, lg));
    if (v > prev * (1 + 1e-9)) mono = false;
    prev = v;
  }
  const weber = (exposureShape(2000) * 2000) / (exposureShape(200) * 200);
  const ok =
    mono &&
    gain > 2e4 &&
    gain < 4e4 &&
    Math.abs(weber - 1) < 1e-6 &&
    exposureShape(1e9) > 0;
  check(
    'exposure shape: Weber by day, ~3e4 gain to moonlight',
    ok,
    `gain day->moonlit ${gain.toExponential(2)}; Weber product constant to ${Math.abs(weber - 1).toExponential(1)}; monotone`
  );
}

{
  // The photometric bridge, DERIVED from shipped constants and
  // held to the textbook values it must reproduce: the solar
  // illuminance constant (120-135 klx), the full-moon
  // illuminance (0.25-0.35 lx), the Falchi anchor exact, and
  // the closed-form zero point 2.58e-6 lux at V = 0.
  const ok =
    E0_LUX > 120e3 &&
    E0_LUX < 135e3 &&
    MOON_FULL_LUX > 0.25 &&
    MOON_FULL_LUX < 0.35 &&
    Math.abs(magArcsec2ToCdM2(NATURAL_MAG) / (NATURAL_MCD * 1e-3) - 1) <
      1e-12 &&
    Math.abs(magToLux(0) / 2.58e-6 - 1) < 0.02 &&
    Math.abs(ARCSEC2_SR / 2.3504e-11 - 1) < 1e-4 &&
    Math.abs(E0_LUX / magToLux(SUN_VMAG) - 1) < 1e-12;
  check(
    'photometric bridge from shipped constants',
    ok,
    `E0 ${(E0_LUX / 1000).toFixed(1)} klx (textbook 120-135, derived); full moon ${MOON_FULL_LUX.toFixed(3)} lx (textbook 0.25-0.35); V=0 zero point ${magToLux(0).toExponential(3)} lux`
  );
}

{
  // Eq. 13 scotopic luminance at its closed point (equal-energy
  // grey: Y_scot = 2.31 Y exactly) and the Purkinje ordering
  // (blue-rich beats red-rich); the mesopic ramp at the printed
  // bounds.
  const grey = scotopicY(1, 1, 1);
  const blue = scotopicY(0.9, 1, 1.5);
  const red = scotopicY(1.2, 1, 0.4);
  const ok =
    Math.abs(grey - 2.31) < 1e-12 &&
    blue > red &&
    scotopicY(0, 1, 1) === 0 &&
    mesopicBlend(MESOPIC_LO_CDM2) === 0 &&
    mesopicBlend(MESOPIC_HI_CDM2) === 1 &&
    mesopicBlend(1e-4) === 0 &&
    mesopicBlend(50) === 1 &&
    mesopicBlend(0.5) > 0 &&
    mesopicBlend(0.5) < 1;
  check(
    'scotopic luminance and the printed mesopic ramp',
    ok,
    `equal-energy Y_scot/Y = ${grey.toFixed(3)} (closed 2.31); Purkinje ordering blue ${blue.toFixed(2)} > red ${red.toFixed(2)}; ramp closed at 0.0056/5.6 cd/m^2`
  );
}

{
  // The sky-transfer table: Rayleigh-blue ordering everywhere,
  // monotone with source altitude, four-decade twilight collapse,
  // and the two corroborations the bridge makes absolute - the
  // clear-day mean sky luminance in its textbook band, and the
  // full-moon night sky in its own.
  // Blue on top at EVERY altitude (Rayleigh); green over red only
  // once the source clears ~2 deg - below that the grazing path
  // REDDENS the transfer (the twilight sky's own colour, emerging
  // from the march; R > G through the twilight rows).
  let ok = true;
  for (let i = 0; i < MOONSKY_ALT_DEG.length; i++) {
    if (!(MOONSKY_E_B[i] > MOONSKY_E_G[i] && MOONSKY_E_B[i] > MOONSKY_E_R[i]))
      ok = false;
    if (MOONSKY_ALT_DEG[i] >= 2 && !(MOONSKY_E_G[i] > MOONSKY_E_R[i]))
      ok = false;
    if (MOONSKY_ALT_DEG[i] <= 0 && !(MOONSKY_E_R[i] >= MOONSKY_E_G[i]))
      ok = false;
    if (i > 0) {
      if (!(MOONSKY_E_R[i] >= MOONSKY_E_R[i - 1])) ok = false;
      if (!(MOONSKY_E_G[i] >= MOONSKY_E_G[i - 1])) ok = false;
      if (!(MOONSKY_E_B[i] >= MOONSKY_E_B[i - 1])) ok = false;
    }
  }
  const e45 = skyTransferE((45 * Math.PI) / 180);
  const eM10 = skyTransferE((-10 * Math.PI) / 180);
  const dayL = (lum3(...e45) * E0_LUX) / Math.PI;
  const nightL = (lum3(...e45) * MOON_FULL_LUX) / Math.PI;
  ok =
    ok &&
    lum3(...eM10) / lum3(...e45) < 1e-3 &&
    dayL > 1000 &&
    dayL < 6000 &&
    nightL > 2e-3 &&
    nightL < 2e-2 &&
    skyTransferE(NaN).every((v) => v === 0);
  check(
    'sky transfer: Rayleigh order, twilight collapse, absolute corroborations',
    ok,
    `clear-day mean sky ${dayL.toFixed(0)} cd/m^2 (textbook 1000-6000); full-moon sky ${(nightL * 1e3).toFixed(1)} mcd/m^2 (classic ~5); twilight -10 deg down x${(lum3(...e45) / lum3(...eM10)).toExponential(1)}`
  );
}

process.exit(fail ? 1 : 0);
