// Reference printer for nacreous clouds (node psc-reference.mjs).
// The law lives once in psc.js - Pitts, Poole & Gonzalez 2018
// (ACP, the 12-year CALIOP PSC climatology) and Reichardt et al.
// 2004 (ACP, the Esrange mountain-wave PSC case), both open
// access and read in full - and these landmarks hold it:
//  - the printed threshold ladder at the printed conditions
//    (T_NAT > T_STS > T_ice at 50 hPa) with the gate a logistic
//    of the printed ~1 K occurrence width, 1/2 AT the frost
//    point exactly
//  - the iridescence rings of the printed 1.9-3 um wave-ice
//    span land in the classic nacreous colour zone (17-28 deg)
//    with the exact inverse-size similarity and red outside
//  - the LUT carries the closed-form Airy centre per size row
//  - the slab's optical depth is DERIVED: Reichardt's printed
//    lidar chain (S̄par 20/35 sr, R355 maxima 10-20, ~3 km) on
//    the theme's one Rayleigh brackets tau, Pitts' printed
//    wave-ice classification cross-checks it at 532 nm, van de
//    Hulst's ADT carries it to the visible, and the corona
//    machinery's (tau/2) e^-tau draws it - one documented
//    exposure left (AGLOW_GAIN pattern)
//  - the twilight window EMERGES from the shipped transmittance
//    geometry: lit and reddened past ground sunset, planet-
//    shadowed at the drawn shell's exact 4.97 deg horizon dip
//  - fails closed: no measurement, no cloud
import {
  betaMol180,
  buildNacreousLUT,
  C_TO_K,
  H_RAY_M,
  ICE_FWHM_K,
  ICE_LOGISTIC_W_K,
  ICE_N,
  ICE_SIGMA_G,
  nacreousRingDeg,
  PITTS_R532_WAVE,
  PSC_ALT_M,
  PSC_AMP,
  PSC_EXPOSURE,
  PSC_LIDAR_UM,
  PSC_TEX_H,
  PSC_TEX_W,
  PSC_THETA_MAX_DEG,
  PSC_THICK_M,
  pscIceAmp,
  qExtADT,
  qExtMeanADT,
  R355_ICE_MAX,
  R532_EXTREME,
  S_PAR_ICE_SR,
  T_ICE_K,
  T_NAT_K,
  T_STS_K,
  TAU_WAVE,
  WAVE_ICE_D_UM,
  waveIceTau,
  waveIceTauBracket
} from './psc.js';
import {CHANNEL_UM, coronaAmp} from './cloud-corona.js';
import {RAY_BETA} from './stratos.js';
import {sunTransmittanceJS} from './sun-transmittance.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- 1. the printed thresholds and the gate ---------------------
{
  check(
    'printed threshold ladder',
    T_NAT_K === 195.7 &&
      T_STS_K === 192 &&
      T_ICE_K === 188.5 &&
      T_NAT_K > T_STS_K &&
      T_STS_K > T_ICE_K,
    `at 50 hPa, 10 ppbv HNO3, 5 ppmv H2O: T_NAT 195.7 K > T_STS 192 K > ` +
      `T_ice 188.5 K (Hanson & Mauersberger / Carslaw / Murphy & Koop, as ` +
      `printed in Pitts 2018)`
  );
  const half = pscIceAmp(T_ICE_K);
  const below = pscIceAmp(T_ICE_K - 1);
  const above = pscIceAmp(T_ICE_K + 1);
  check(
    'gate is the printed occurrence width',
    Math.abs(half - 0.5) < 1e-12 &&
      below > 0.95 &&
      above < 0.05 &&
      Math.abs(ICE_LOGISTIC_W_K * 3.53 - ICE_FWHM_K) < 1e-12 &&
      pscIceAmp(NaN) === 0,
    `amp(T_ice) = 1/2 exactly; +-1 K -> ${below.toFixed(3)}/${above.toFixed(3)} ` +
      `(the printed "FWHM of about 1 K" mode); unmeasured -> 0, fails closed`
  );
  check(
    'feed unit bridge',
    C_TO_K === 273.15 && Math.abs(T_ICE_K - C_TO_K - -84.65) < 1e-9,
    `open-meteo serves degC; the printed frost point is ${(T_ICE_K - C_TO_K).toFixed(2)} degC ` +
      `at the served 50 hPa level`
  );
}

// ---- 2. the iridescence physics ---------------------------------
{
  const rSmall = nacreousRingDeg(WAVE_ICE_D_UM[0], CHANNEL_UM[1]);
  const rLarge = nacreousRingDeg(WAVE_ICE_D_UM[1], CHANNEL_UM[1]);
  check(
    'printed sizes ring in the nacreous zone',
    rSmall > 27 && rSmall < 30 && rLarge > 16 && rLarge < 19,
    `mid-visible first bright rings: ${rLarge.toFixed(1)} deg (3.0 um) to ` +
      `${rSmall.toFixed(1)} deg (1.9 um) - the classic 10-30 deg mother-of-pearl ` +
      `colour zone, and the banding IS Reichardt's printed size gradient`
  );
  // Inverse-size similarity (small angle): ring(d1)/ring(d2) =
  // d2/d1 - the same law the droplet corona gate states.
  const simRatio =
    (Math.sin((rLarge * Math.PI) / 180) * WAVE_ICE_D_UM[1]) /
    (Math.sin((rSmall * Math.PI) / 180) * WAVE_ICE_D_UM[0]);
  check(
    'exact inverse-size similarity',
    Math.abs(simRatio - 1) < 1e-9,
    `sin(ring) x d identical across the span (${simRatio.toFixed(6)}) - one ` +
      `Airy law, sizes only`
  );
  const rB = nacreousRingDeg(2.4, CHANNEL_UM[2]);
  const rR = nacreousRingDeg(2.4, CHANNEL_UM[0]);
  check(
    'red outside at fixed size',
    rR > rB,
    `at 2.4 um: blue ring ${rB.toFixed(1)} deg inside red ${rR.toFixed(1)} deg - ` +
      `diffraction order, the pearl fringes run blue-in red-out`
  );
  const lut = buildNacreousLUT();
  let worst = 0;
  for (const j of [0, PSC_TEX_H - 1]) {
    const dUm =
      WAVE_ICE_D_UM[0] +
      ((WAVE_ICE_D_UM[1] - WAVE_ICE_D_UM[0]) * (j + 0.5)) / PSC_TEX_H;
    for (let c = 0; c < 3; c++) {
      const x = (Math.PI * dUm) / CHANNEL_UM[c];
      const closed = (x * x) / (4 * Math.PI);
      const v = lut.data[(j * PSC_TEX_W + 0) * 4 + c];
      worst = Math.max(worst, Math.abs(v / closed - 1));
    }
  }
  check(
    'LUT centre carries the closed form per row',
    lut.w === PSC_TEX_W &&
      lut.h === PSC_TEX_H &&
      worst < 0.01 &&
      Math.abs(lut.thetaMaxRad - (PSC_THETA_MAX_DEG * Math.PI) / 180) < 1e-12,
    `first-column values sit on x^2/4pi per size row (worst ${(worst * 100).toFixed(2)}%); ` +
      `${PSC_TEX_W}x${PSC_TEX_H} over 0-${PSC_THETA_MAX_DEG} deg`
  );
  check(
    'documented ensemble context',
    ICE_N === 1.31 && ICE_SIGMA_G === 1.38,
    `ice n = 1.31 and ensemble sigma_g = 1.38 carried from the print; the ` +
      `LOCALLY monodisperse draw rides Reichardt's stated narrow-distribution ` +
      `licence for wave PSCs`
  );
}

// ---- 2b. the DERIVED optical depth ------------------------------
// Reichardt 2004's own lidar chain, inverted (S̄par = tau over
// integrated backscatter): the printed S̄par, backscatter-ratio
// maxima and ~3 km thickness make a wave-ice optical depth
// bracket on the theme's own Rayleigh; Pitts 2018's printed
// wave-ice classification cross-checks the scale at 532 nm; van
// de Hulst's ADT carries it to the visible.
{
  const bSea = betaMol180(0.44, 0);
  check(
    'molecular backscatter hinges on the shipped Rayleigh',
    Math.abs(bSea - (RAY_BETA[2] * 3) / (8 * Math.PI)) < 1e-18 &&
      Math.abs(
        betaMol180(0.355, 24000) / betaMol180(0.532, 24000) -
          Math.pow(532 / 355, 4)
      ) < 1e-9 &&
      Math.abs(betaMol180(0.44, H_RAY_M) / bSea - Math.E ** -1) < 1e-12,
    `at 440 nm sea level exactly RAY_BETA x 3/(8pi) (the Rayleigh 180-deg ` +
      `phase); lambda^-4 across the two lidar colours exact; one scale height ` +
      `= one e-fold - the theme's ONE Rayleigh, no second constant`
  );
  const [lo, hi] = waveIceTauBracket();
  check(
    'printed lidar chain brackets the optical depth',
    lo > 0.2 &&
      lo < 0.3 &&
      hi > 0.8 &&
      hi < 1.0 &&
      Math.abs(TAU_WAVE - Math.sqrt(lo * hi)) < 1e-12 &&
      TAU_WAVE > 0.4 &&
      TAU_WAVE < 0.6,
    `M4 (20 sr, R-1 = 9) to M5 (35 sr, R-1 = 19) over the printed 3 km at ` +
      `355 nm: tau ${lo.toFixed(2)}-${hi.toFixed(2)}; drawn TAU_WAVE = ` +
      `${TAU_WAVE.toFixed(2)}, the bracket's geometric mean - a real nacreous ` +
      `display is a thin-cirrus-class cloud, derived not styled`
  );
  const tPitts = waveIceTau(S_PAR_ICE_SR[0], PITTS_R532_WAVE - 1, 0.532);
  const tExtreme = waveIceTau(S_PAR_ICE_SR[1], R532_EXTREME - 1, 0.532);
  check(
    'the 532 nm chain agrees across instruments',
    tPitts > 0.2 &&
      tPitts < 0.35 &&
      tPitts < TAU_WAVE &&
      tExtreme > 1 &&
      tExtreme < 2 &&
      TAU_WAVE < tExtreme,
    `Pitts' wave-ice classification floor (R532 > 50) at the printed lidar ` +
      `ratios: tau ${tPitts.toFixed(2)} - INSIDE the 355 nm bracket's low end; ` +
      `Reichardt's PSC II extreme (R532 = 150): ${tExtreme.toFixed(2)} caps it; ` +
      `the drawn value sits between the classification floor and the extreme - ` +
      `two instruments, two wavelengths, one tau scale`
  );
  const q355 = qExtMeanADT(PSC_LIDAR_UM);
  const q550 = qExtMeanADT(CHANNEL_UM[1]);
  check(
    'ADT carries the tau to the visible',
    Math.abs(q355 - 2) < 0.4 &&
      Math.abs(q550 - 2) < 0.4 &&
      Math.abs(q550 / q355 - 1) < 0.15 &&
      Math.abs(qExtADT(2.4, 0.532) - 2) < 0.5,
    `size-ensemble mean Q_ext(ADT): ${q355.toFixed(2)} at 355 nm, ` +
      `${q550.toFixed(2)} at 550 nm (ratio ${(q550 / q355).toFixed(2)}) - both ` +
      `at van de Hulst's extinction-paradox 2, so the lidar tau IS the visible ` +
      `tau across the printed sizes`
  );
  check(
    'slab amplitude derived through the corona law',
    Math.abs(PSC_AMP - coronaAmp(TAU_WAVE) * PSC_EXPOSURE) < 1e-15 &&
      PSC_EXPOSURE === 3 &&
      PSC_AMP > 0.4 &&
      PSC_AMP < 0.5 &&
      Math.abs(PSC_THICK_M - 3000) < 1e-9 &&
      Math.abs(R355_ICE_MAX[1] / R355_ICE_MAX[0] - 2) < 1e-12,
    `(tau/2) e^-tau at the derived TAU_WAVE x the one documented exposure ` +
      `(x${PSC_EXPOSURE}, AGLOW_GAIN pattern) = ${PSC_AMP.toFixed(3)} - the ` +
      `68th pass's capture-verified level (0.45) recovered with the physics ` +
      `underneath derived; printed thickness and R-ratio carried`
  );
}

// ---- 3. the twilight window emerges -----------------------------
{
  const MIE0 = {scat: [3e-6, 3e-6, 3e-6], abs: [3e-7, 3e-7, 3e-7]};
  const beam = (altDeg) =>
    sunTransmittanceJS(Math.sin((altDeg * Math.PI) / 180), MIE0, PSC_ALT_M);
  // The straight-line horizon dip from the layer: acos(Rb/r) -
  // the EXACT twilight window boundary the shipped geometry
  // implies (refraction ~0.5 deg is the documented repo-wide
  // grazing scope).
  const dip = (Math.acos(6360e3 / (6360e3 + PSC_ALT_M)) * 180) / Math.PI;
  const civil = beam(-3);
  const nearDip = beam(-(dip - 0.1));
  const pastDip = beam(-(dip + 0.1));
  const day = beam(10);
  check(
    'lit past ground sunset, shadowed at the exact dip',
    civil[0] > 0 &&
      civil[0] / Math.max(civil[2], 1e-12) > 2 &&
      nearDip[0] > 0 &&
      pastDip[0] + pastDip[1] + pastDip[2] === 0 &&
      Math.abs(dip - 4.97) < 0.05 &&
      day[2] > 0.3,
    `24 km beam at sun -3 deg: R ${civil[0].toFixed(3)}, R/B ` +
      `${(civil[0] / Math.max(civil[2], 1e-9)).toFixed(1)} (the reddened pearl ` +
      `light after ground sunset); still lit 0.1 deg above the ${dip.toFixed(2)} deg ` +
      `dip, exactly dark 0.1 deg past it - the planet shadow, closed form; ` +
      `+10 deg: lit but competing with full daylight - the vivid window is ` +
      `twilight, emergent`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
