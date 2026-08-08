/**
 * psc.js - nacreous clouds (mother-of-pearl; type II polar
 * stratospheric clouds): the MEASURED lower-stratospheric
 * temperature under the printed ice thresholds, with the
 * iridescence from the printed wave-cloud microphysics through
 * the theme's one certified diffraction machinery. Gated by
 * psc-reference.mjs.
 *
 * THE PRIMARIES - both Copernicus open access, both READ IN
 * FULL:
 *  - Pitts, Poole & Gonzalez 2018 (ACP 18, 10881): the 12-year
 *    CALIOP spaceborne-lidar PSC climatology. Their reference
 *    conditions - 50 hPa, 10 ppbv HNO3, 5 ppmv H2O - print the
 *    threshold ladder: T_NAT = 195.7 K (Hanson & Mauersberger
 *    1988), T_STS = 192 K (Carslaw et al. 1995), T_ice =
 *    188.5 K (Murphy & Koop 2005). Their composite 11-year
 *    histograms (their Fig. 12) put the ICE-PSC occurrence mode
 *    "slightly below the frost point with a full width at half
 *    maximum of about 1 K" - the gate's printed softness. Ice
 *    optics: refractive index 1.31; ice size distributions
 *    single-mode lognormal sigma = 1.38. Occurrence:
 *    Antarctic May-October (peak July-August, interannual
 *    +-25%), Arctic December-March (relative std > 100% - some
 *    seasons devoid); wave ice (R532 > 50) is mountain-wave
 *    induced, peaking near the Antarctic Peninsula and, in the
 *    Arctic, in the 60 W-90 E sector (the Scandinavian lee -
 *    where mother-of-pearl clouds are classically reported).
 *  - Reichardt, Doernbrack et al. 2004 (ACP 4, 1149): the
 *    day-long two-lidar Esrange (67.9 N) mountain-wave PSC
 *    case. Printed wave-ice microphysics: ice maximum
 *    dimensions decreasing "from 3 to 1.9 um with time"
 *    through the wave phase (M4 "probably 3 um"; M5 > 1.9 um,
 *    isometric to slightly oblate, aspect 0.75-1.25); NAT
 *    0.7-0.9 um at 8-12 cm^-3; LTA droplets 0.7-0.9 um,
 *    n = 1.39, 7-11 cm^-3; and the KEY licence: "It is assumed
 *    that the size distribution of the optically relevant PSC
 *    particles is narrow. In the case of mountain wave PSCs
 *    this approximation is justified as in situ measurements
 *    ... confirm" - the printed basis for drawing the
 *    iridescence LOCALLY MONODISPERSE, with the size varying
 *    ACROSS the cloud (their printed 3 -> 1.9 um phase
 *    evolution): each strip of the wave cloud diffracts at its
 *    own size, which is exactly the banded mother-of-pearl
 *    look.
 *
 * THE FEED - open-meteo serves temperature_50hPa keylessly
 * (50 hPa ~ 20.5 km, the very level the printed thresholds are
 * stated at); it rides the existing winds-aloft request. The
 * gate is the MEASUREMENT against the print: the drawn
 * probability is a logistic in T centred on the printed T_ice
 * with the printed ~1 K width. Documented scope (Pitts' own
 * caveat, carried verbatim): synoptic analyses under-resolve
 * mountain-wave temperature perturbations, so wave events
 * whose synoptic T sits above threshold are missed -
 * conservative, like the source.
 *
 * THE COLOURS - the certified Airy machinery (cloud-corona.js
 * airyPattern - van de Hulst; x = pi D / lambda ~ 9-17 across
 * the printed 1.9-3 um span) sampled at each cloud point's
 * scattering angle from the sun, at the point's own local size
 * from the printed span. First bright rings land at 17-28 deg
 * in mid-visible - the classic nacreous colour zone. The beam
 * is the drawn shell's twilight geometry (sunTransmittanceJS
 * with the exact planet shadow): the cloud stays sunlit past
 * ground sunset - the 24 km shell's own horizon dip is 5.0 deg,
 * the closed-form end of the display window - and the vivid
 * phase EMERGES as the sky darkens under it. A display note
 * from the pixel verification: against the theme's brightest
 * twilight band the 8-bit output has headroom only in green, so
 * the additive layer reads muted there; full pearl vividness
 * needs the layer inside the dome's tone pipeline (recorded
 * refinement).
 *
 * Documented display constants: the lenticular envelope
 * geometry and ONE additive-layer exposure (PSC_EXPOSURE, the
 * AGLOW_GAIN pattern). The slab amplitude itself is DERIVED:
 * Reichardt's printed lidar chain (S̄par, backscatter ratios,
 * the ~3 km thickness) inverts to a wave-ice optical depth
 * bracket, cross-checked at 532 nm against Pitts' printed
 * wave-ice classification threshold, carried to the visible by
 * van de Hulst's ADT extinction efficiency, and drawn through
 * the corona machinery's own (tau/2) e^-tau thin-slab law.
 */

import {airyPattern, CHANNEL_UM, coronaAmp} from './cloud-corona.js';
import {RAY_BETA} from './stratos.js';

// ---- Pitts et al. 2018, printed ---------------------------------
// Reference conditions: 50 hPa, 10 ppbv HNO3, 5 ppmv H2O.
export const PSC_P_HPA = 50;
export const T_NAT_K = 195.7; // Hanson & Mauersberger 1988
export const T_STS_K = 192; // Carslaw et al. 1995
export const T_ICE_K = 188.5; // Murphy & Koop 2005
export const ICE_FWHM_K = 1; // Fig. 12 mode width, both hemispheres
export const ICE_N = 1.31; // ice refractive index (their optics)
export const ICE_SIGMA_G = 1.38; // ice lognormal width (ensemble)
export const PSC_ALT_M = 24000; // drawn near the ice band's top -
// Pitts prints PSC occurrence "from near the tropopause up to
// > 25 km" with the areal maximum above 20 km early in the
// season; the higher shell keeps the wave cloud sunlit deeper
// into twilight (dip acos(R/(R+h)) = 5.0 deg), which is the
// window the classic displays own. The GATE stays at the 50 hPa
// measurement level where the thresholds are printed.

// ---- Reichardt et al. 2004, printed -----------------------------
export const WAVE_ICE_D_UM = [1.9, 3.0]; // max dimension span, M5/M4
export const WAVE_ICE_ASPECT = [0.75, 1.25]; // isometric-ish
export const LTA_D_UM = [0.7, 0.9]; // droplet diameters
export const LTA_N_CM3 = [7, 11];
export const NAT_D_UM = [0.7, 0.9];
export const NAT_N_CM3 = [8, 12];

// The drawn ice-PSC probability: a logistic in the measured
// 50 hPa temperature centred on the printed frost point with
// the printed ~1 K FWHM (logistic width w gives FWHM of the
// derivative distribution ~ 3.53 w; the histogram's 1 K FWHM
// maps to w = 0.28 K - amplitude 1/2 AT T_ice exactly).
export const ICE_LOGISTIC_W_K = ICE_FWHM_K / 3.53;
export function pscIceAmp(t50K) {
  if (!Number.isFinite(t50K)) return 0;
  return 1 / (1 + Math.exp((t50K - T_ICE_K) / ICE_LOGISTIC_W_K));
}
export const C_TO_K = 273.15; // the feed serves degC

// ---- the iridescence pattern ------------------------------------
// A 2D RGB LUT: rows sweep the printed size span (1.9..3.0 um),
// columns sweep scattering angle 0..thetaMax. Each row is the
// certified monodisperse Airy pattern at that size - locally
// monodisperse by the printed narrow-distribution licence, the
// size gradient ACROSS rows being Reichardt's printed phase
// evolution. Values are sr^-1; the caller normalises for
// display.
export const PSC_TEX_W = 192;
export const PSC_TEX_H = 24;
export const PSC_THETA_MAX_DEG = 32;
export function buildNacreousLUT() {
  const data = new Float32Array(PSC_TEX_W * PSC_TEX_H * 4);
  const thetas = [];
  for (let i = 0; i < PSC_TEX_W; i++) {
    thetas.push(
      ((i + 0.5) / PSC_TEX_W) * ((PSC_THETA_MAX_DEG * Math.PI) / 180)
    );
  }
  for (let j = 0; j < PSC_TEX_H; j++) {
    const dUm =
      WAVE_ICE_D_UM[0] +
      ((WAVE_ICE_D_UM[1] - WAVE_ICE_D_UM[0]) * (j + 0.5)) / PSC_TEX_H;
    for (let c = 0; c < 3; c++) {
      const p = airyPattern(dUm, CHANNEL_UM[c], thetas);
      for (let i = 0; i < PSC_TEX_W; i++) {
        data[(j * PSC_TEX_W + i) * 4 + c] = p[i];
      }
    }
    for (let i = 0; i < PSC_TEX_W; i++) {
      data[(j * PSC_TEX_W + i) * 4 + 3] = 1;
    }
  }
  return {
    data,
    w: PSC_TEX_W,
    h: PSC_TEX_H,
    thetaMaxRad: (PSC_THETA_MAX_DEG * Math.PI) / 180
  };
}

// First bright ring angle (deg) for a size in the printed span at
// a channel - the gate holds the nacreous colour zone with it.
export function nacreousRingDeg(dUm, lambdaUm) {
  const J21 = 5.13562; // first zero of J2 (A&S) - the ring max
  return (Math.asin((J21 * lambdaUm) / (Math.PI * dUm)) * 180) / Math.PI;
}

// ---- the DERIVED optical depth (the 68th pass's recorded
// future work, now done) --------------------------------------
// Reichardt 2004 prints the whole lidar chain for the wave-ice
// phases: PSC geometrical thickness "nearly constant at ~3 km";
// PSC-mean lidar ratios S̄par = 20 sr (M4) and 35 sr (M5) - their
// own definition S̄par = tau / integrated-backscatter; 355 nm
// backscatter ratios R reaching "maximum values of 10-20" in the
// same phases, with the PSC II core hitting the extremes
// "R > 25 at 355 nm, > 150 at 532 nm". Pitts 2018 classifies
// wave ice at R532 > 50 (their Eq. 1 defines R against the
// molecular backscatter). Inverting Reichardt's definition,
//   tau = S̄par x (R - 1) x beta_mol(180 deg) x thickness,
// with beta_mol from the theme's ONE Rayleigh (stratos.js
// RAY_BETA at 440 nm, lambda^-4, the shipped 8 km barometric
// profile, phase 3/(16pi)(1+cos^2 180) = 3/(8pi)).
export const PSC_THICK_M = 3000; // printed "~3 km"
export const S_PAR_ICE_SR = [20, 35]; // printed M4/M5 means
export const R355_ICE_MAX = [10, 20]; // printed M4/M5 maxima
export const R355_EXTREME = 25; // printed PSC II core (355 nm)
export const R532_EXTREME = 150; // printed PSC II core (532 nm)
export const PITTS_R532_WAVE = 50; // Pitts wave-ice class (P11)
export const PSC_LIDAR_UM = 0.355; // the GKSS Raman lidar
export const H_RAY_M = 8000; // the shipped Rayleigh scale height
export function betaMol180(lamUm, hM) {
  const b = RAY_BETA[2] * Math.pow(0.44 / lamUm, 4) * Math.exp(-hM / H_RAY_M);
  return (b * 3) / (8 * Math.PI);
}
export function waveIceTau(
  sSr,
  rMinus1,
  lamUm = PSC_LIDAR_UM,
  dzM = PSC_THICK_M,
  hM = PSC_ALT_M
) {
  return sSr * rMinus1 * betaMol180(lamUm, hM) * dzM;
}
// The printed bracket - M4 (20 sr, R-1 = 9) to M5 (35 sr,
// R-1 = 19) over the printed 3 km - and the drawn value, its
// geometric mean (documented reduction: the event's own phases
// bound it; the 532 nm chain with Pitts' classification floor
// and Reichardt's extreme brackets the same scale, the gate
// holds both).
export function waveIceTauBracket() {
  return [
    waveIceTau(S_PAR_ICE_SR[0], R355_ICE_MAX[0] - 1),
    waveIceTau(S_PAR_ICE_SR[1], R355_ICE_MAX[1] - 1)
  ];
}
export const TAU_WAVE = Math.sqrt(
  waveIceTauBracket()[0] * waveIceTauBracket()[1]
);

// van de Hulst's anomalous-diffraction extinction efficiency
// (1957 - the same printed source the corona machinery's Q -> 2
// share rides): Q(rho) = 2 - 4 sin(rho)/rho + 4(1 - cos rho)/
// rho^2 with rho = 2 x (n - 1) x pi D / lambda. It carries the
// 355 nm tau to the visible: over the printed size span the
// SIZE-ENSEMBLE mean Q sits at the extinction paradox's 2 at
// both wavelengths (individual sizes wiggle - the drawn cloud
// spans the sizes, so the ensemble is what the slab sees).
export function qExtADT(dUm, lamUm, n = ICE_N) {
  const rho = (2 * Math.PI * dUm * (n - 1)) / lamUm;
  return (
    2 - (4 * Math.sin(rho)) / rho + (4 * (1 - Math.cos(rho))) / (rho * rho)
  );
}
export function qExtMeanADT(lamUm, n = ICE_N, steps = 12) {
  let s = 0;
  for (let i = 0; i < steps; i++) {
    const d =
      WAVE_ICE_D_UM[0] +
      ((WAVE_ICE_D_UM[1] - WAVE_ICE_D_UM[0]) * (i + 0.5)) / steps;
    s += qExtADT(d, lamUm, n);
  }
  return s / steps;
}

// The slab's drawn amplitude: the corona machinery's own thin-
// slab law (tau/2) e^-tau at the DERIVED optical depth, times
// one documented additive-layer exposure (the AGLOW_GAIN
// pattern) - chosen as the small integer that lands the
// capture-verified display level of the 68th pass (0.45); the
// physics underneath is now derived, the exposure is the only
// display factor left.
export const PSC_EXPOSURE = 3;
export const PSC_AMP = coronaAmp(TAU_WAVE) * PSC_EXPOSURE;
