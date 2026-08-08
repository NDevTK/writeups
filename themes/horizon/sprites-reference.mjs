// Reference printer for the red sprites (node sprites-reference.mjs).
// The law lives once in sprites.js - Chen et al. 2008 (ISUAL global
// survey, author-hosted), Hu et al. 2002 / Cummer & Lyons 2005 (Duke
// reprints), Barrington-Leigh 2000 (Stanford thesis, author-hosted)
// and Kuo et al. 2005 (author-hosted) anchors, all read in full -
// and these landmarks hold it to the print:
//  - the thesis's own rayleigh energy conversion (1 kR = 22.6
//    pW cm^-2 sr^-1 at 700 nm) against the theme's shipped SI
//    rayleigh chain - the two photometries are one
//  - the printed quenching pair: red N2(1P) crossover at 50 km,
//    blue N2(2P) at 32 km, and the barometric scale height the
//    printed A/alpha coefficients imply (a handbook mesospheric
//    ~6.7 km - the print is self-consistent)
//  - the EMERGENT colour structure: red body, blue tendril bottoms,
//    with the handover where the printed physics puts it
//  - the Crumey gate on the printed 10 MR halo brightness: visible
//    over a dark rural sky, extinguished by daylight - the printed
//    lore ("sprites are a dark-sky phenomenon") reproduced by the
//    printed threshold, not by a hand ramp
//  - the occurrence chain: corrected ISUAL global rate over the
//    global flash rate, ocean-boosted by the two printed per-area
//    ratios - and the patience it implies over a live storm
//  - the elevation mapping the wiring uses (flat-earth + curvature
//    drop) against exact spherical geometry at feed distances
import {
  A_1P,
  A_2P,
  ALPHA_1P,
  ALPHA_2P,
  BLUE_EXC_W,
  CG_LAND_OCEAN,
  FLASHES_PER_SEC,
  HALO_WIDTH_KM,
  N2_FRAC,
  O2_FRAC,
  QUENCH_1P_KM,
  QUENCH_2P_KM,
  SPRITE_BOT_KM,
  SPRITE_DETECTION_CORR,
  SPRITE_GLOBAL_PER_MIN,
  SPRITE_LAM_RED,
  SPRITE_LC_O,
  SPRITE_MR_MODEL,
  SPRITE_MR_OBS,
  SPRITE_SR,
  SPRITE_TOP_KM,
  quenchBlue,
  quenchRed,
  quenchScaleHeightKm,
  spriteColorMix,
  spriteProbPerFlash
} from './sprites.js';
import {cieY, lineLuminance, lineRadiance} from './airglow.js';
import {extendedVisibility} from './adaptation.js';
import {NATURAL_MCD} from './skyglow.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // Barrington-Leigh 2000 (eq. 3.3ff): 1 kR at 700 nm carries
  // 22.6 pW cm^-2 sr^-1. The theme's SI rayleigh chain
  // (airglow.js lineRadiance, Brandstrom 2012 lineage) must land
  // on the same energy radiance: 22.6 pW cm^-2 sr^-1 =
  // 2.26e-7 W m^-2 sr^-1.
  const r = lineRadiance(1000, SPRITE_LAM_RED);
  const printed = 2.26e-7;
  const err = Math.abs(r / printed - 1);
  check(
    'thesis rayleigh conversion',
    err < 5e-3,
    `1 kR at 700 nm = ${r.toExponential(3)} W m^-2 sr^-1 vs printed 22.6 pW cm^-2 sr^-1 (${(err * 100).toFixed(2)}% off)`
  );
}

{
  // The printed quenching pair and the scale height it implies.
  // A/alpha gives the quencher density at each printed crossover;
  // one exponential through both points must have a handbook
  // mesospheric scale height.
  const H = quenchScaleHeightKm();
  const n50 = A_1P / ALPHA_1P / N2_FRAC;
  const n32 = A_2P / ALPHA_2P / O2_FRAC;
  check(
    'printed quench crossovers',
    Math.abs(quenchRed(QUENCH_1P_KM) - 0.5) < 1e-12 &&
      Math.abs(quenchBlue(QUENCH_2P_KM) - 0.5) < 1e-12 &&
      H > 6.5 &&
      H < 7.0,
    `red survival = 1/2 exactly at ${QUENCH_1P_KM} km, blue at ${QUENCH_2P_KM} km; ` +
      `printed A/alpha put total density ${n50.toExponential(2)} m^-3 at 50 km, ` +
      `${n32.toExponential(2)} at 32 km -> H = ${H.toFixed(2)} km`
  );
}

{
  // Emergent colour structure: red body high, blue tendril
  // bottoms - the handover where the printed crossovers put it.
  const body = spriteColorMix(75);
  const bot = spriteColorMix(SPRITE_BOT_KM);
  let zEq = SPRITE_BOT_KM;
  for (let z = SPRITE_BOT_KM; z <= 60; z += 0.01) {
    const m = spriteColorMix(z);
    if (m.red >= m.blue) {
      zEq = z;
      break;
    }
  }
  check(
    'emergent red/blue split',
    body.red / body.blue > 2.5 &&
      body.red / body.blue < 3.2 &&
      bot.blue > bot.red &&
      zEq > 43 &&
      zEq < 49,
    `75 km body red:blue = ${(body.red / body.blue).toFixed(2)} (red); ` +
      `${SPRITE_BOT_KM} km bottom blue:red = ${(bot.blue / bot.red).toFixed(2)} (blue); ` +
      `handover at ${zEq.toFixed(1)} km`
  );
}

{
  // The Crumey gate on the printed brightness ladder. 10 MR at
  // the thesis's 700 nm convention through the shipped luminance
  // chain, tested against the same adapted backgrounds the aurora
  // matrix uses. Dark rural sky: plainly visible. Daylight:
  // extinguished. The threshold here is steady-state (Crumey's
  // printed validity); the few-tens-of-ms brevity hardening now
  // has its printed constant - Blondel & Rey 1911's a = 0.21 s
  // (blondel.js) - and blondel-reference.mjs holds the hardened
  // sprite to the same landmarks.
  const lum = (mr) =>
    lineLuminance(mr * 1e6, SPRITE_LAM_RED, cieY(SPRITE_LAM_RED));
  const L10 = lum(SPRITE_MR_OBS);
  const dark = NATURAL_MCD * 1e-3;
  const vDark = extendedVisibility(L10, dark, SPRITE_SR);
  const vMoon = extendedVisibility(L10, 5e-3, SPRITE_SR);
  const vDay = extendedVisibility(L10, 3000, SPRITE_SR);
  const vLadder =
    extendedVisibility(lum(1), 5e-3, SPRITE_SR) <=
      extendedVisibility(lum(SPRITE_MR_OBS), 5e-3, SPRITE_SR) &&
    extendedVisibility(lum(SPRITE_MR_OBS), 5e-3, SPRITE_SR) <=
      extendedVisibility(lum(SPRITE_MR_MODEL), 5e-3, SPRITE_SR);
  check(
    'printed 10 MR through the Crumey gate',
    L10 > 5.5e-3 &&
      L10 < 8e-3 &&
      vDark > 0.8 &&
      vDay === 0 &&
      vMoon >= 0 &&
      vMoon <= 1 &&
      vLadder,
    `10 MR at 700 nm = ${L10.toExponential(2)} cd/m^2 (${(L10 / dark).toFixed(0)}x the dark sky); ` +
      `visibility dark ${vDark.toFixed(2)}, full-moon-sky ${vMoon.toFixed(2)}, daylight ${vDay.toFixed(2)}; ` +
      `1 -> ${SPRITE_MR_OBS} -> ${SPRITE_MR_MODEL} MR monotone`
  );
}

{
  // Occurrence: the corrected global sprite rate over the global
  // flash rate, exactly (0.5 x 2)/(45 x 60) = 1/2700 per flash;
  // the ocean boost is the ratio of the two printed per-area
  // ratios (lightning 10:1 land:ocean, sprites 4.1:1).
  const p0 = spriteProbPerFlash(0);
  const p1 = spriteProbPerFlash(1);
  const boost = CG_LAND_OCEAN / SPRITE_LC_O;
  const exact =
    (SPRITE_GLOBAL_PER_MIN * SPRITE_DETECTION_CORR) / (FLASHES_PER_SEC * 60);
  const waitMin = 1 / (30 * p0);
  check(
    'occurrence chain',
    Math.abs(p0 - 1 / 2700) < 1e-15 &&
      Math.abs(p0 - exact) < 1e-15 &&
      Math.abs(p1 / p0 - boost) < 1e-12 &&
      boost > 2.4 &&
      boost < 2.5,
    `P(sprite|flash) = 1/2700 = ${p0.toExponential(3)} (land), ocean x${boost.toFixed(2)}; ` +
      `a 30-flash/min storm sprites every ~${waitMin.toFixed(0)} min - the printed patience of sprite watching`
  );
}

{
  // The wiring's elevation mapping (flat-earth atan with the
  // d^2/2R curvature drop) against exact spherical geometry at
  // stream distances - the aurora pass's uBase lesson, gated.
  const R = 6371;
  const exactEl = (dKm, hKm) => {
    const th = dKm / R;
    return (
      (Math.atan2(Math.cos(th) * (R + hKm) - R, Math.sin(th) * (R + hKm)) *
        180) /
      Math.PI
    );
  };
  const approxEl = (dKm, hKm) =>
    (Math.atan((hKm - (dKm * dKm) / (2 * R)) / dKm) * 180) / Math.PI;
  let worst = 0;
  for (const d of [60, 100, 150, 200]) {
    for (const h of [SPRITE_BOT_KM, 65, SPRITE_TOP_KM]) {
      worst = Math.max(worst, Math.abs(exactEl(d, h) - approxEl(d, h)));
    }
  }
  const top200 = approxEl(200, SPRITE_TOP_KM);
  const bot200 = approxEl(200, SPRITE_BOT_KM);
  check(
    'elevation mapping at feed distances',
    worst < 0.5 && top200 > 20 && bot200 > 8,
    `worst |exact - approx| = ${worst.toFixed(2)} deg over 60-200 km; ` +
      `at 200 km the printed 40-90 km span sits ${bot200.toFixed(1)}-${top200.toFixed(1)} deg up - ` +
      `above the parent storm, exactly the printed viewing geometry (halo ~${HALO_WIDTH_KM} km wide)`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
