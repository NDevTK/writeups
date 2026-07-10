/**
 * rainbow.js - the rainbow, by Airy's theory on measured rain.
 * Pure math (node-importable); the sky overlay samples the
 * profile this module computes.
 *
 * Everything follows the sources, no tuned shapes:
 *  - Dispersion: the Sellmeier equation of Daimon & Masumura
 *    (2007, water at 21.5 C, 0.18-1.13 um) - eight measured
 *    coefficients, carried verbatim.
 *  - Geometry: Descartes. The deviation after k internal
 *    reflections is D_k(x) = k pi + 2 asin x - 2(k+1) asin(x/N)
 *    in the impact parameter x = sin i (Adam 2002, Physics
 *    Reports 356, eqs. 1.1a/1.6); its extremum sits at the
 *    closed form x0^2 = ((k+1)^2 - N^2)/((k+1)^2 - 1)
 *    (equivalently cos i = sqrt((N^2-1)/(k(k+2))), eq. 1.3).
 *    Primary bow radius = pi - D1, secondary = D2 - pi;
 *    Alexander's dark band lies between them by construction.
 *  - Diffraction: Airy (1838). Near the rainbow ray the
 *    intensity is Ai^2(-xi) with
 *    xi = (2 k_w^2 a^2 / D''(x0))^(1/3) (D - Dmin) - the form
 *    Adam gives after Jackson - so the supernumerary fringes
 *    tighten as drops grow (spacing ~ (k_w a)^(-2/3)) and the
 *    whole pattern carries the (a^7/lambda)^(1/3) brightness
 *    scaling the review derives.
 *  - Bow strength: the Fresnel factor of the ray path -
 *    (1 - rho)^2 rho^k at the bow's own incidence (Adam sect.
 *    1.4), through the SAME gated unpolarised Fresnel the
 *    Cox-Munk glitter uses (coxmunk.js, per-wavelength n).
 *  - Drops: Marshall & Palmer (1948) - the same paper whose Z-R
 *    relation the radar already inverts - N(D) = N0 exp(-Lambda
 *    D) with Lambda = 4.1 R^-0.21 mm^-1; the median-volume
 *    diameter D0 = 3.67/Lambda sets the Airy drop size from the
 *    measured rain rate.
 *  - The sun is not a point: the profile is convolved with the
 *    solar disk (radius 0.266 deg, chord-weighted), the 0.5 deg
 *    widening Adam notes.
 */

import {fresnelWater} from './coxmunk.js';

// Daimon & Masumura (2007), water, 21.5 C - verbatim.
export const SELLMEIER_A = [
  5.689093832e-1, 1.719708856e-1, 2.062501582e-2, 1.123965424e-1
];
export const SELLMEIER_B = [
  5.110301794e-3, 1.825180155e-2, 2.624158904e-2, 1.067505178e1
];

/** Refractive index of water at lambda (micrometres). */
export function waterIndex(lambdaUm) {
  const l2 = lambdaUm * lambdaUm;
  let s = 0;
  for (let i = 0; i < 4; i++) {
    s += (SELLMEIER_A[i] * l2) / (l2 - SELLMEIER_B[i]);
  }
  return Math.sqrt(1 + s);
}

// The atmosphere's own RGB wavelengths (atmosphere-tsl.js), um.
export const RGB_UM = [0.68, 0.55, 0.44];

/**
 * Descartes geometry for the k-reflection bow at index n:
 * impact parameter x0 (closed form), incidence/refraction at the
 * rainbow ray, minimum deviation D (radians), the bow's angular
 * radius gamma from the antisolar point, and D''(x0) - the
 * curvature that scales Airy's argument.
 */
export function descartes(n, k = 1) {
  const kk = (k + 1) * (k + 1);
  const x0 = Math.sqrt((kk - n * n) / (kk - 1));
  const D = k * Math.PI + 2 * Math.asin(x0) - 2 * (k + 1) * Math.asin(x0 / n);
  const dpp =
    (2 * x0) / (1 - x0 * x0) ** 1.5 -
    (2 * (k + 1) * x0) / (n * n - x0 * x0) ** 1.5;
  const gamma = k === 1 ? Math.PI - D : D - Math.PI;
  return {x0, iM: Math.asin(x0), D, dpp, gamma};
}

// Ai(0) and -Ai'(0) (Abramowitz & Stegun 10.4.4/10.4.5).
const AI0 = 1 / (3 ** (2 / 3) * gamma23());
const AIP0 = 1 / (3 ** (1 / 3) * gamma13());
function gamma13() {
  return 2.678938534707747; // Gamma(1/3)
}
function gamma23() {
  return 1.3541179394264; // Gamma(2/3)
}

/**
 * The Airy function Ai(z) on the real line: the two Maclaurin
 * series (A&S 10.4.2-3) for |z| <= 6, the standard asymptotic
 * forms beyond (oscillatory for z << 0, decaying for z >> 0).
 */
export function airy(z) {
  if (Math.abs(z) <= 6) {
    let f = 1;
    let g = z;
    let tf = 1;
    let tg = z;
    for (let m = 1; m <= 40; m++) {
      tf *= (z * z * z) / (3 * m * (3 * m - 1));
      tg *= (z * z * z) / ((3 * m + 1) * (3 * m));
      f += tf;
      g += tg;
    }
    return AI0 * f - AIP0 * g;
  }
  const az = Math.abs(z);
  const zeta = (2 / 3) * az ** 1.5;
  if (z > 0) {
    return (
      (Math.exp(-zeta) / (2 * Math.sqrt(Math.PI) * z ** 0.25)) *
      (1 - 5 / (72 * zeta))
    );
  }
  return (
    (Math.sin(zeta + Math.PI / 4) / (Math.sqrt(Math.PI) * az ** 0.25)) * 1 +
    (Math.cos(zeta + Math.PI / 4) / (Math.sqrt(Math.PI) * az ** 0.25)) *
      (-5 / (72 * zeta))
  );
}

// Marshall & Palmer (1948): Lambda = 4.1 R^-0.21 mm^-1 (R mm/h),
// N0 = 8000 m^-3 mm^-1; median-volume diameter D0 = 3.67/Lambda.
export const MP_N0 = 8000;
export function mpLambda(R) {
  return 4.1 * Math.max(R, 0.05) ** -0.21;
}
export function mpDropRadiusMm(R) {
  return 3.67 / mpLambda(R) / 2;
}

/**
 * The bow's Fresnel strength: transmit in, reflect k times,
 * transmit out, all at the rainbow ray's own incidence
 * (rho = unpolarised reflectance there): (1-rho)^2 rho^k.
 */
export function bowFresnel(n, k = 1) {
  const {iM} = descartes(n, k);
  const rho = fresnelWater(Math.cos(iM), n);
  return (1 - rho) ** 2 * rho ** k;
}

/**
 * The full profile: intensity per RGB channel over the angle
 * gamma from the antisolar point, primary + secondary bows,
 * Airy-diffracted for the Marshall-Palmer drop of the measured
 * rain rate, Fresnel-weighted, solar-disk smeared. Returns
 * {g0, g1, n, data (RGB triplets, normalised to peak 1), peak
 * (the pre-normalisation peak, carrying the (a^7/lambda)^(1/3)
 * drop-size brightness for the caller's gain), aMm}.
 */
export function rainbowProfile(rainMmH, samples = 512) {
  const g0 = (37 * Math.PI) / 180;
  const g1 = (55 * Math.PI) / 180;
  const aMm = mpDropRadiusMm(rainMmH);
  const a = aMm * 1e-3; // metres
  const data = new Float32Array(samples * 3);
  const sunR = (0.266 * Math.PI) / 180; // solar disk radius
  for (let ch = 0; ch < 3; ch++) {
    const lam = RGB_UM[ch] * 1e-6;
    const kw = (2 * Math.PI) / lam;
    const n = waterIndex(RGB_UM[ch]);
    for (const k of [1, 2]) {
      const geo = descartes(n, k);
      const scale = (2 * kw * kw * a * a) / Math.abs(geo.dpp);
      const s13 = scale ** (1 / 3);
      // Airy cross-section structure: Fresnel path factor x
      // a^2 (kw a)^(1/3) (the review's (a^7/lambda)^(1/3)) x
      // the geometric x0/sin(gamma) throat.
      const pre =
        ((bowFresnel(n, k) * geo.x0) / Math.sin(geo.gamma)) *
        a *
        a *
        (kw * a) ** (1 / 3);
      for (let i = 0; i < samples; i++) {
        const g = g0 + ((g1 - g0) * i) / (samples - 1);
        // Solar-disk smearing: chord-weighted average over the
        // sun's own angular radius.
        let acc = 0;
        let wsum = 0;
        for (let s = -2; s <= 2; s++) {
          const off = (s / 2) * sunR;
          const w = Math.sqrt(1 - (s / 2) ** 2 * 0.999) + 1e-3;
          // deviation past the minimum: primary brightens
          // INSIDE the bow, secondary OUTSIDE - Alexander's
          // band between them falls out of the signs.
          const dTheta = k === 1 ? geo.gamma - (g + off) : g + off - geo.gamma;
          acc += w * airy(-s13 * dTheta) ** 2;
          wsum += w;
        }
        data[3 * i + ch] += (pre * acc) / wsum;
      }
    }
  }
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, data[i]);
  if (peak > 0) for (let i = 0; i < data.length; i++) data[i] /= peak;
  return {g0, g1, n: samples, data, peak, aMm};
}
