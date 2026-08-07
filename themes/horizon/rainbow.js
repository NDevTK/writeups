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
 *  - Drops: Marshall & Palmer (1948, J. Meteor. 5, 165 - read in
 *    full; the same paper whose Z-R relation the radar already
 *    inverts) - N(D) = N0 exp(-Lambda D), their printed
 *    N0 = 0.08 cm^-4 and Lambda = 41 R^-0.21 cm^-1; the
 *    median-volume diameter D0 = 3.67/Lambda sets the Airy drop
 *    size, and the closed second moment sets the shaft's
 *    extinction (mpSigmaExt) - one distribution feeding fringe
 *    spacing, radar inversion and radiometry alike.
 *  - The shaft: the two-leg single-scatter slab (bowSlab) - the
 *    corona/halo family's own certified law, here with the sun
 *    leg climbing to the MEASURED freezing level - normalised
 *    absolutely by the Descartes/Fresnel ray mapping
 *    (bowGeometric / bowWindowEnergy): energy conservation pins
 *    the Airy curve's scale, no display gain left.
 *  - The sun is not a point: the profile is convolved with the
 *    solar disk (radius 0.266 deg, chord-weighted), the 0.5 deg
 *    widening Adam notes.
 */

import {fresnelWater} from './coxmunk.js';
import {sunAngularRadiusRad} from './eclipses.js';

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
 * Extinction coefficient (m^-1) of Marshall-Palmer rain at rate R
 * (mm/h). The distribution is the paper's own (Marshall & Palmer
 * 1948, J. Meteor. 5, 165, read in full - two pages): their
 * eq. (1) N_D = N0 e^(-Lambda D), eq. (2) N0 = 0.08 cm^-4 "for
 * any intensity of rainfall" (= 8000 m^-3 mm^-1), eq. (3)
 * Lambda = 41 R^-0.21 cm^-1 (= 4.1 mm^-1 - mpLambda above).
 * sigma = Q (pi/4) INT D^2 N(D) dD with Q = 2 exactly (the van de
 * Hulst extinction paradox at x ~ pi D/lambda ~ 10^4 - the same
 * asymptote the cirrus corona and desert coarse mode already
 * ride). The exponential integrates in closed form:
 *   INT D^2 N0 e^(-Lambda D) dD = 2 N0 / Lambda^3   (D in mm)
 * so sigma = pi N0 / Lambda^3 x 1e-6 m^-1 (the 1e-6 converts the
 * mm^2 cross-sections to m^2). At 5 mm/h this is ~1.0e-3 m^-1 -
 * optical depth 1 over a kilometre of shower. Documented
 * uncertainty, the paper's own: "for diameters less than about
 * 1.5 mm, both sets of observations fall short of the value for
 * N_D given by equation (1)" - their Table 1 puts the fitted
 * moments 10-20% above the measured ones (M: 89 R^0.84 from the
 * equations vs 72-80 R^0.88 direct), so this sigma leans the
 * same way; the fitted exponential is the citable object and is
 * carried uncorrected. Gate landmark holds the closed form
 * against direct quadrature of N(D). R <= 0 returns exactly 0 -
 * no rain, no bow.
 */
export function mpSigmaExt(R) {
  if (!(R > 0)) return 0;
  const L = mpLambda(R);
  return (Math.PI * MP_N0 * 1e-6) / (L * L * L);
}

/**
 * The rain shaft's slab factor - the two-leg single-scatter
 * integral through a homogeneous Marshall-Palmer layer from the
 * eye (layer base) to the freezing level, per unit
 * geometric-interaction depth, in closed form. This is the
 * REFERENCE implementation of the optics dome's per-fragment
 * formula (sky-objects-tsl transcribes it to TSL): for a ray of
 * elevation alpha under a source at elevation h,
 *   slab = (1/2) INT sigma e^-(sigma s) e^-(sigma (H - s sin
 *          alpha)/sin h) ds
 *        = (1/2) (e^-tau0 - e^-tauV) / kc,
 * tau0 = sigma H / sin h, tauV = sigma H / sin alpha, kc = 1 -
 * sin(alpha)/sin(h) - the identity tau0 + sigma smax kc = tauV
 * keeps both exponents non-negative (no overflow at any angle
 * pair). Upward rays exit the layer top; grazing/downward rays
 * run the untruncated convergent tail (the same 1e-4 floor);
 * kc -> 0 is the removable point (1/2) e^-tau0 tauV. The gate
 * holds this against direct quadrature across the angle grid,
 * removable point and downward rays included.
 */
export function bowSlab(sigH, sinH, sinA) {
  if (!(sigH > 0)) return 0;
  const sh = Math.max(sinH, 1e-3);
  const kc = 1 - sinA / sh;
  const tau0 = sigH / sh;
  const tauV = sigH / Math.min(Math.max(sinA, 1e-4), 1);
  if (Math.abs(kc) < 1e-4) return 0.5 * Math.exp(-tau0) * tauV;
  return (0.5 * (Math.exp(-tau0) - Math.exp(-tauV))) / kc;
}

/**
 * The k-bow's window energy per unit geometric-interaction depth:
 * the SAME ray mapping integrated in the impact-parameter domain,
 *   E = INT 2 x (1-rho(x))^2 rho(x)^k dx over {x: theta(x) in
 *       [th0, th1]},
 * which is bowGeometric's solid-angle integral by exact change of
 * variables - but free of the caustic's integrable (gamma-theta)
 * ^(-1/2) singularity, so plain quadrature converges (the theta-
 * domain midpoint rule was measured 2x wrong at 2048 bins - the
 * singular endpoint). buildBowLUT normalises each Airy curve to
 * carry exactly this energy; the gate holds the two domains equal
 * and pins the default M's accuracy against a 10x finer pass.
 */
export function bowWindowEnergy(n, k, th0, th1, M = 20000) {
  const thOf = (x) => {
    const D = k * Math.PI + 2 * Math.asin(x) - 2 * (k + 1) * Math.asin(x / n);
    return k === 1 ? Math.PI - D : D - Math.PI;
  };
  let E = 0;
  for (let i = 0; i < M; i++) {
    const x = (i + 0.5) / M;
    const th = thOf(x);
    if (th < th0 || th > th1) continue;
    const rho = fresnelWater(Math.cos(Math.asin(x)), n);
    E += 2 * x * (1 - rho) ** 2 * rho ** k * (1 / M);
  }
  return E;
}

/**
 * The k-bow's geometric-optics intensity at theta from the
 * antisolar point, in sr^-1 PER UNIT GEOMETRIC-INTERACTION DEPTH
 * (the halo LUT's own absolute frame): flux through the impact
 * annulus, Fresnel-chained, spread over the deviation annulus -
 *   P(theta) = sum_branches x (1-rho(x))^2 rho(x)^k
 *              / (pi sin(theta) |dD/dx|),
 * with D(x) = k pi + 2 asin x - 2(k+1) asin(x/n) (Adam 2002,
 * eq. 1.1a) and dD/dx = 2/sqrt(1-x^2) - 2(k+1)/sqrt(n^2-x^2).
 * The a^2 of the annulus cancels against the pi a^2 of the
 * geometric cross-section: the absolute geometric pattern is
 * SIZE-INDEPENDENT, so it normalises the Airy profile for the
 * whole Marshall-Palmer ensemble at once. Both x-branches of the
 * fold (the caustic at x0) are summed; theta outside the bow's
 * geometric range contributes zero. Used by the gate and by
 * buildBowLUT's energy normalisation - the drawn Airy pattern
 * carries exactly this much light, fringe structure and all.
 */
export function bowGeometric(n, k, thetaRad) {
  const geo = descartes(n, k);
  // Deviation D as a function of x, folded to the antisolar
  // angle: primary theta = pi - D, secondary theta = D - pi.
  const thOf = (x) => {
    const D = k * Math.PI + 2 * Math.asin(x) - 2 * (k + 1) * Math.asin(x / n);
    return k === 1 ? Math.PI - D : D - Math.PI;
  };
  // The deviation extremum at x0 folds the mapping: the primary's
  // geometric light lies INSIDE its caustic (theta < gamma), the
  // secondary's OUTSIDE (theta > gamma) - Alexander's band between
  // them receives no ray from either, by construction.
  if (k === 1 ? thetaRad >= geo.gamma || thetaRad < 0 : thetaRad <= geo.gamma)
    return 0;
  const dDdx = (x) =>
    2 / Math.sqrt(1 - x * x) - (2 * (k + 1)) / Math.sqrt(n * n - x * x);
  let sum = 0;
  for (const [lo, hi] of [
    [1e-6, geo.x0],
    [geo.x0, 1 - 1e-9]
  ]) {
    // Bisect theta(x) = theta on the monotone branch (theta
    // increases toward x0 from both sides).
    let a = lo;
    let b = hi;
    const thLo = thOf(lo);
    const thHi = thOf(hi);
    const rising = thHi > thLo;
    const thMin = Math.min(thLo, thHi);
    const thMax = Math.max(thLo, thHi);
    if (thetaRad < thMin || thetaRad > thMax) continue;
    for (let i = 0; i < 60; i++) {
      const m = (a + b) / 2;
      if (thOf(m) < thetaRad === rising) a = m;
      else b = m;
    }
    const x = (a + b) / 2;
    const rho = fresnelWater(Math.cos(Math.asin(x)), n);
    sum +=
      (x * (1 - rho) ** 2 * rho ** k) /
      (Math.PI * Math.sin(thetaRad) * Math.abs(dDdx(x)));
  }
  return sum;
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
  const sunR = sunAngularRadiusRad(); // the shared IAU disc at 1 au
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
