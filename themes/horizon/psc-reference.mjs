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
//  - the twilight window EMERGES from the shipped transmittance
//    geometry: lit and reddened past ground sunset, planet-
//    shadowed at the drawn shell's exact 4.97 deg horizon dip
//  - fails closed: no measurement, no cloud
import {
  buildNacreousLUT,
  C_TO_K,
  ICE_FWHM_K,
  ICE_LOGISTIC_W_K,
  ICE_N,
  ICE_SIGMA_G,
  nacreousRingDeg,
  PSC_ALT_M,
  PSC_TEX_H,
  PSC_TEX_W,
  PSC_THETA_MAX_DEG,
  pscIceAmp,
  T_ICE_K,
  T_NAT_K,
  T_STS_K,
  WAVE_ICE_D_UM
} from './psc.js';
import {CHANNEL_UM} from './cloud-corona.js';
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
