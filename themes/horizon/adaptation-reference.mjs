// Reference gate for adaptation.js (node adaptation-reference.mjs):
// the LBNL 39882 visual-adaptation frame at its printed closed
// points, the derived photometric bridge against the textbook
// values it must reproduce, and the sky-transfer table's physics.
import {
  adaptExposure,
  ARCSEC2_SR,
  E0_LUX,
  EXPO_DAY,
  LA_DAY_ANCHOR_CDM2,
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
  skyTransferE,
  limitingMagnitude,
  crumeyThresholdDB,
  extendedVisibility,
  milkyWayVisibility,
  CRUMEY_R1,
  CRUMEY_K1,
  CRUMEY_Q,
  CRUMEY_F,
  DETECT_HALF_MAG,
  NL_TO_CDM2,
  COLOR_LIMIT_NL
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
  // Below the table edge the march's own log-slope carries the
  // collapse on: by astronomical twilight (sun -18 deg, the
  // printed no-sunlight definition) the sun's sky must sit AT OR
  // BELOW the Falchi natural floor - deep night belongs to the
  // moon and the skyglow, never to a clamped table row.
  const eM18 = skyTransferE((-18 * Math.PI) / 180);
  const sunL18 = (lum3(...eM18) * E0_LUX) / Math.PI;
  const eM14 = skyTransferE((-14 * Math.PI) / 180);
  ok =
    ok &&
    lum3(...eM10) / lum3(...e45) < 1e-3 &&
    dayL > 1000 &&
    dayL < 6000 &&
    nightL > 2e-3 &&
    nightL < 2e-2 &&
    sunL18 < NATURAL_MCD * 1e-3 &&
    lum3(...eM14) < lum3(...eM10) &&
    lum3(...eM18) < lum3(...eM14) &&
    lum3(...eM18) > 0 &&
    skyTransferE(NaN).every((v) => v === 0);
  check(
    'sky transfer: Rayleigh order, twilight collapse, absolute corroborations',
    ok,
    `clear-day mean sky ${dayL.toFixed(0)} cd/m^2 (textbook 1000-6000); full-moon sky ${(nightL * 1e3).toFixed(1)} mcd/m^2 (classic ~5); twilight -10 deg down x${(lum3(...e45) / lum3(...eM10)).toExponential(1)}; extrapolated -18 deg ${(sunL18 * 1e3).toExponential(1)} mcd/m^2 < the Falchi floor ${NATURAL_MCD}`
  );
}

{
  // The point-source colour floor (Schaefer 1993, Sec. 2.12 +
  // his p. 319 unit table): 1500 nL x his own printed
  // 3.18e-6 nit/nL lands within 15% of Ferwerda/LBNL's printed
  // mesopic floor - two independent printed sources on ONE
  // colour boundary - and his 26.33 mag/arcsec^2 per nL row
  // closes a THIRD way through this module's Falchi-anchored
  // bridge: magArcsec2ToCdM2(26.33) must reproduce his nit
  // conversion to ~1.5% with no shared constants.
  const {NL_TO_CDM2, COLOR_LIMIT_CDM2} = await import('./adaptation.js');
  const bridge = magArcsec2ToCdM2(26.33);
  const ok =
    Math.abs(COLOR_LIMIT_CDM2 / MESOPIC_LO_CDM2 - 1) < 0.15 &&
    Math.abs(bridge / NL_TO_CDM2 - 1) < 0.02;
  check(
    'colour floor: Schaefer 1500 nL corroborates the mesopic edge',
    ok,
    `1500 nL = ${(COLOR_LIMIT_CDM2 * 1e3).toFixed(2)} mcd/m^2 vs Ferwerda ${MESOPIC_LO_CDM2 * 1e3} (${((COLOR_LIMIT_CDM2 / MESOPIC_LO_CDM2 - 1) * 100).toFixed(0)}%); his 26.33 mag/arcsec^2-per-nL through the Falchi bridge: ${bridge.toExponential(3)} vs printed 3.18e-6 (${((bridge / NL_TO_CDM2 - 1) * 100).toFixed(1)}%)`
  );
}

{
  // The dome-source crossover: the theme switches the one march
  // from the sun to the moon when the moon's sky (its transfer at
  // its altitude, times its own E0) outshines the sun's. Derived
  // here from the SHIPPED tables alone for a full moon at 45 deg:
  // the crossover must sit in nautical twilight (sun -18..-9 deg,
  // where the extrapolated collapse meets moonlight), the two
  // skies must be EQUAL at the solved point (continuity of the
  // switch), and the ordering must flip across it.
  const e0Full = MOON_FULL_LUX / E0_LUX;
  const moonL = lum3(...skyTransferE(Math.PI / 4)) * e0Full;
  const sunL = (a) => lum3(...skyTransferE((a * Math.PI) / 180));
  let lo = -25;
  let hi = 0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (sunL(mid) < moonL) lo = mid;
    else hi = mid;
  }
  const cross = (lo + hi) / 2;
  const ok =
    cross > -18 &&
    cross < -9 &&
    Math.abs(sunL(cross) / moonL - 1) < 1e-6 &&
    sunL(cross + 2) > moonL &&
    sunL(cross - 2) < moonL;
  check(
    'dome source crossover: full moon takes the march in nautical twilight',
    ok,
    `sun ${cross.toFixed(2)} deg (band -18..-9); skies equal there to ${Math.abs(sunL(cross) / moonL - 1).toExponential(1)}; ordering flips across`
  );
}

{
  // The display map: EXACTLY the built daytime exposure at the
  // derived clear-day anchor (continuity by construction), the
  // JND ratio elsewhere - full-moon night lands at the ~7e5 the
  // 3e4 adaptation gain implies over the anchor - and garbage
  // returns the day value (fail-bright, never black).
  const ok =
    adaptExposure(LA_DAY_ANCHOR_CDM2) === EXPO_DAY &&
    EXPO_DAY === 24 &&
    LA_DAY_ANCHOR_CDM2 > 1000 &&
    LA_DAY_ANCHOR_CDM2 < 6000 &&
    adaptExposure(5e-3) > 3e5 &&
    adaptExposure(5e-3) < 1.2e6 &&
    adaptExposure(0.22) > 1e4 &&
    adaptExposure(0.22) < 1e5 &&
    adaptExposure(LA_DAY_ANCHOR_CDM2 / 2) > EXPO_DAY &&
    adaptExposure(NaN) === EXPO_DAY;
  check(
    'display map: anchored day, adapted night',
    ok,
    `anchor ${LA_DAY_ANCHOR_CDM2.toFixed(0)} cd/m^2 -> ${EXPO_DAY} exact; civil twilight ${adaptExposure(0.22).toExponential(2)}; full-moon ${adaptExposure(5e-3).toExponential(2)}; NaN -> day`
  );
}

{
  // Schaefer's naked-eye limiting magnitude at its own printed
  // numbers: the worked example EXACT (B = 136 nL, k_v = 0.3 ->
  // 6.05, "in excellent agreement with common lore"); his
  // printed sky pairings against the module's own
  // Falchi-anchored bridge (21.0 mag/arcsec^2 <-> 136 nL, 21.8
  // <-> 65 nL - two independent printed conversions within a
  // few percent); the day branch puts the daytime limit near
  // -4, so Venus at greatest brilliancy (-4.8) pierces daylight
  // while Jupiter (-2.9 at best) cannot - the classic; the
  // moonlit and light-polluted skies land on lore (full-moon
  // zenith ~4-5); monotone in B; and the branch seam sits at
  // the SAME printed 1500 nL as the colour floor.
  const mTyp = limitingMagnitude(136 * NL_TO_CDM2);
  const mBest = limitingMagnitude(65 * NL_TO_CDM2);
  const bridge21 = magArcsec2ToCdM2(21.0) / NL_TO_CDM2;
  const bridge218 = magArcsec2ToCdM2(21.8) / NL_TO_CDM2;
  const mDay = limitingMagnitude(5000);
  const mMoon = limitingMagnitude(1100 * NL_TO_CDM2);
  let mono = true;
  let prev = Infinity;
  for (let lg = -1; lg <= 10; lg += 0.25) {
    const m = limitingMagnitude(Math.pow(10, lg) * NL_TO_CDM2);
    if (m > prev + 1e-9) mono = false;
    prev = m;
  }
  const ok =
    Math.abs(mTyp - 6.05) < 0.01 &&
    mBest > 6.2 &&
    mBest < 6.7 &&
    Math.abs(bridge21 / 136 - 1) < 0.06 &&
    Math.abs(bridge218 / 65 - 1) < 0.06 &&
    mDay > -4.6 &&
    mDay < -3.8 &&
    -4.8 < mDay &&
    mDay < -2.9 &&
    mMoon > 3.8 &&
    mMoon < 5.2 &&
    mono &&
    Math.abs(Math.log10(COLOR_LIMIT_NL) - 3.17) < 0.01 &&
    DETECT_HALF_MAG === 0.5;
  check(
    'Schaefer limiting magnitude (printed anchors)',
    ok,
    `typical sky 136 nL -> ${mTyp.toFixed(2)} (printed 6.05 exact); best sky 65 nL -> ${mBest.toFixed(2)} vs the catalogue's 6.5 limit; bridge pairings 21.0 -> ${bridge21.toFixed(0)} nL (printed 136), 21.8 -> ${bridge218.toFixed(0)} nL (printed 65); daylight 5000 cd/m^2 -> ${mDay.toFixed(2)} (Venus -4.8 visible, Jupiter -2.9 not); full-moon sky -> ${mMoon.toFixed(2)} (lore 4-5); monotone; seam = the printed 1500 nL colour floor; +-${DETECT_HALF_MAG} mag printed detection width`
  );
}

{
  // Crumey's scotopic extended-source threshold at its printed
  // constants, doing what the flash JND provably cannot (the
  // fiftieth-push verdict): the gegenschein-class feature (the
  // zodiacal module's own ~22.0 mag/arcsec^2 anchor, ~0.03 sr)
  // sits WELL ABOVE threshold at the natural dark sky - visible,
  // as it really is - and falls to the marginal band under a
  // full-moon sky with his printed notional field factor F = 2;
  // the milky way's drawn fade runs his printed Bigourdan band
  // (on at 20.25 mag/arcsec^2, full by the printed 21.25 black
  // boundary); thresholds monotone in B; the printed
  // zero-background floor holds (no divergence below 1e-5).
  const dL = magArcsec2ToCdM2(22.0);
  const dark = dL / crumeyThresholdDB(1.9e-4, 0.03);
  const moonR = dL / (CRUMEY_F * crumeyThresholdDB(4e-3, 0.03));
  const visDark = extendedVisibility(dL, 1.9e-4, 0.03);
  const visMoon = extendedVisibility(dL, 4e-3, 0.03);
  const visTwi = extendedVisibility(dL, 0.05, 0.03);
  let mono = true;
  let prev = 0;
  for (let lg = -5; lg <= -1; lg += 0.25) {
    const th = crumeyThresholdDB(Math.pow(10, lg), 0.03);
    if (th < prev - 1e-15) mono = false;
    prev = th;
  }
  const floorOk =
    Math.abs(crumeyThresholdDB(1e-7, 0.03) - crumeyThresholdDB(1e-5, 0.03)) <
    1e-15;
  const mw =
    milkyWayVisibility(magArcsec2ToCdM2(20.3)) < 0.1 &&
    milkyWayVisibility(magArcsec2ToCdM2(21.25)) === 1 &&
    milkyWayVisibility(magArcsec2ToCdM2(19.5)) === 0;
  const ok =
    CRUMEY_R1 === 7.31e-4 &&
    CRUMEY_K1 === 7.633e-3 &&
    CRUMEY_Q === 0.6 &&
    dark > 8 &&
    dark < 30 &&
    visDark === 1 &&
    moonR > 0.5 &&
    moonR < 1.3 &&
    visMoon > 0.05 &&
    visMoon < 0.7 &&
    visTwi === 0 &&
    mono &&
    floorOk &&
    mw;
  check(
    'Crumey extended-source threshold (printed constants)',
    ok,
    `gegenschein-class feature ${dark.toFixed(0)}x threshold at the dark sky (visible ${visDark}), ratio ${moonR.toFixed(2)} with printed F=2 under full moon (vis ${visMoon.toFixed(2)} - marginal, as real), 0 in twilight; milky way on at the printed Bigourdan 20.25, full at 21.25; monotone, printed 1e-5 floor exact`
  );
}

process.exit(fail ? 1 : 0);
