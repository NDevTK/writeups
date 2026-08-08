// Reference printer for the Blondel-Rey brief-light law (node
// blondel-reference.mjs). The law lives once in blondel.js -
// Blondel & Rey 1911, J. Phys. Theor. Appl. 1, 530 + 643 (HAL
// scans, read in full, constants machine-read from the page
// images) - and these landmarks hold it to the print:
//  - the four printed forms of the law are one algebra: the
//    axis cut at -0.21 s, the half-efficiency point at t = a
//    exactly, the Bloch limit E t -> a E0 for brief-intense
//    flashes, the steady limit factor -> 1
//  - the paper's own worked example re-derived: doubling a
//    0.21 s flash gains exactly a third ("33 0/0, au lieu de
//    100 0/0" - their p. 648 footnote)
//  - the sprite hardening: the printed 10 MR halo at its 30 ms
//    display life needs 8x the steady threshold and KEEPS its
//    dark-sky visibility (4.7x over the extended threshold) -
//    the printed "dark-sky phenomenon" survives its own
//    printed brevity - while the twilight extinction point
//    moves earlier by the same printed factor
//  - the negative wirings stated in numbers: a steady source is
//    untouched (factor 1), and the ~0.3 s meteor factor is
//    printed for the record but NOT applied - meteors gate on a
//    perception table measured on real meteors, transientness
//    included
import {
  BLONDEL_A_S,
  BLONDEL_T_MAX_S,
  BLONDEL_T_MIN_S,
  E0_FIELD_LUX,
  E0_LAB_LUX,
  blondelReyFactor,
  blondelReyThreshold
} from './blondel.js';
import {
  SPRITE_LAM_RED,
  SPRITE_LIFE_MS,
  SPRITE_MR_OBS,
  SPRITE_SR
} from './sprites.js';
import {cieY, lineLuminance} from './airglow.js';
import {extendedVisibility} from './adaptation.js';
import {NATURAL_MCD} from './skyglow.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- 1. the printed law's closed identities ---------------------
{
  const half = blondelReyFactor(BLONDEL_A_S);
  const steady = blondelReyFactor(1e9);
  const brief = 0.001;
  // Bloch's limit: for t << a the REQUIRED E t product is the
  // constant a E0 (their hyperbola-I asymptote statement).
  const blochEt = blondelReyThreshold(brief) * brief;
  check(
    'printed forms are one algebra',
    Math.abs(half - 0.5) < 1e-12 &&
      steady > 0.9999 &&
      Math.abs(blochEt - (BLONDEL_A_S + brief)) < 1e-12 &&
      Math.abs(blochEt - BLONDEL_A_S) / BLONDEL_A_S < 0.005 &&
      blondelReyFactor(0) === 0 &&
      blondelReyThreshold(0) === Infinity,
    `factor(a) = ${half} exactly 1/2 (the t = a half-efficiency point); ` +
      `steady -> ${steady.toFixed(4)}; Bloch limit E t -> ${blochEt.toFixed(4)} ` +
      `= a E0 within 0.5% at 1 ms; zero-duration flash carries nothing`
  );
  check(
    'axis cut at -a',
    Math.abs(BLONDEL_A_S - 0.21) < 1e-12 &&
      BLONDEL_T_MIN_S === 0.001 &&
      BLONDEL_T_MAX_S === 1,
    `Et = E0(a + t) cuts t at -${BLONDEL_A_S} s ("21/100 de seconde a gauche ` +
      `de l'origine", p. 548 machine-read); measured span ${BLONDEL_T_MIN_S}-3 s, ` +
      `law admitted to ${BLONDEL_T_MAX_S} s (their own bound)`
  );
}

// ---- 2. the paper's own worked example --------------------------
{
  // p. 648 footnote: double the duration of a flash that lasted
  // a = 0.21 s and the equivalent fixed intensity rises by only
  // a third - "l'augmentation ne sera que 33 0/0, au lieu de
  // 100 0/0".
  // Their compare: same source, doubled diameter -> doubled t
  // AND doubled I t at the same E; the equivalent fixed
  // intensity I t/(a + t) then moves from I a/(2a) to
  // 2 I a/(3a/2 x 2) - the ratio of the two factors, 1/2 -> 2/3.
  const ratio =
    blondelReyFactor(2 * BLONDEL_A_S) / blondelReyFactor(BLONDEL_A_S);
  check(
    'their 33% worked example re-derived',
    Math.abs(ratio - 4 / 3) < 1e-12,
    `doubling t from a: equivalent-intensity ratio (2a/(a+2a))/(1/2) = ` +
      `${ratio.toFixed(4)} = 4/3 exactly - the printed "33 0/0, au lieu de 100 0/0"`
  );
}

// ---- 3. the sprite hardening ------------------------------------
{
  const tS = SPRITE_LIFE_MS / 1000;
  const f = blondelReyFactor(tS);
  const need = blondelReyThreshold(tS);
  const L10 = lineLuminance(
    SPRITE_MR_OBS * 1e6,
    SPRITE_LAM_RED,
    cieY(SPRITE_LAM_RED)
  );
  const dark = NATURAL_MCD * 1e-3;
  const vDarkSteady = extendedVisibility(L10, dark, SPRITE_SR);
  const vDarkFlash = extendedVisibility(L10 * f, dark, SPRITE_SR);
  const vDayFlash = extendedVisibility(L10 * f, 3000, SPRITE_SR);
  check(
    'sprite: dark-sky object survives its own brevity',
    tS > BLONDEL_T_MIN_S &&
      tS < BLONDEL_T_MAX_S &&
      Math.abs(need - 8) < 0.01 &&
      vDarkFlash > 0.8 &&
      vDayFlash === 0,
    `30 ms inside the printed validity; threshold x${need.toFixed(2)}; the 10 MR ` +
      `halo effective luminance ${(L10 * f).toExponential(2)} cd/m^2 still reads ` +
      `${vDarkFlash.toFixed(2)} over a dark rural sky (steady ${vDarkSteady.toFixed(2)}) ` +
      `and 0 in daylight - the printed lore, now through the printed constant`
  );
  // The extinction point moves: find the adapted luminance where
  // visibility dies, with and without the printed factor - the
  // hardened sprite dies into brighter twilight EARLIER.
  const dieAt = (Lx) => {
    let lo = 1e-4;
    let hi = 1e4;
    for (let i = 0; i < 60; i++) {
      const mid = Math.sqrt(lo * hi);
      if (extendedVisibility(Lx, mid, SPRITE_SR) > 0) lo = mid;
      else hi = mid;
    }
    return Math.sqrt(lo * hi);
  };
  const laSteady = dieAt(L10);
  const laFlash = dieAt(L10 * f);
  check(
    'twilight extinction moves earlier',
    laFlash < laSteady && laSteady / laFlash > 3 && laSteady / laFlash < 20,
    `steady 10 MR dies at ${laSteady.toFixed(3)} cd/m^2 adapted sky, the 30 ms ` +
      `flash at ${laFlash.toFixed(3)} - a x${(laSteady / laFlash).toFixed(1)} darker ` +
      `sky needed, the brevity hardening in the same units the stars use`
  );
}

// ---- 4. the negative wirings, in numbers ------------------------
{
  const meteor = blondelReyFactor(0.3);
  check(
    'steady sources untouched; meteors documented, not double-counted',
    blondelReyFactor(3600) > 0.9999 && meteor > 0.55 && meteor < 0.65,
    `stars/aurora (steady) factor 1; a ~0.3 s meteor would carry ` +
      `${meteor.toFixed(2)} (~${(-2.5 * Math.log10(meteor)).toFixed(2)} mag) - ` +
      `NOT applied: the meteor chain's perception table is measured on real ` +
      `meteors, its transientness is already inside the measurement`
  );
  check(
    'threshold documentation carried',
    E0_LAB_LUX[0] === 0.5e-7 &&
      E0_LAB_LUX[1] === 0.6e-7 &&
      E0_FIELD_LUX === 1e-7,
    `printed point-source E0: 0.5-0.6e-7 lux (laboratory), 1e-7 practical - ` +
      `corroborates the theme's own Schaefer/Crumey frame, replaces nothing`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
