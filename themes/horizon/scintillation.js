/**
 * Stellar scintillation - the single source shared by the star
 * sprites (sky-objects-tsl.js) and the reference printer
 * (scintillation-reference.mjs).
 *
 *  - Amplitude: Young (1967)'s classic scintillation formula,
 *    sigma = 0.09 D^(-2/3) X^(7/4) exp(-h/8 km) (2 dt)^(-1/2)
 *    with D the aperture in cm, X the airmass, h the observer
 *    altitude and dt the integration time in seconds. For the
 *    naked eye D ~ 0.7 cm and dt ~ 0.1 s (photopic integration).
 *  - Statistics: scintillated intensity is log-normal (Dravins et
 *    al. 1997, PASP series): I = exp(sigma s) / E[exp(sigma s)].
 *    The display waveform s is a deterministic sinusoid, so the
 *    normaliser is the EXACT mean of exp(sigma sin) - the modified
 *    Bessel function I0(sigma), evaluated by its power series
 *    (truncated where terms fall below 1e-12; the shader uses the
 *    first five terms, exact to better than 1e-6 over the clamped
 *    sigma range) - so the mean intensity of every star is conserved at
 *    every airmass: twinkling redistributes light in time, it does
 *    not brighten or dim the star.
 *  - Timescale: the flicker rides turbulence blown across the line
 *    of sight (Dravins II) - crossing time D/V for tropopause wind
 *    V. The true crossing rate is kHz, far above frame rate; the
 *    DISPLAY frequency scales linearly with the measured 250 hPa
 *    wind (documented mapping), so a fast jet visibly speeds the
 *    twinkle.
 */

export const EYE_D_CM = 0.7;
export const EYE_DT_S = 0.1;
export const SIGMA_MAX = 1.2; // log-normal clamp near the horizon

// Young (1967): rms fractional intensity.
export function youngSigma(Dcm, airmass, hKm = 0, dtS = EYE_DT_S) {
  return (
    0.09 *
    Math.pow(Dcm, -2 / 3) *
    Math.pow(airmass, 7 / 4) *
    Math.exp(-hKm / 8) *
    Math.pow(2 * dtS, -1 / 2)
  );
}

// Modified Bessel I0 by power series (exact normaliser of
// E[exp(sigma sin)] over a full period).
export function besselI0(x) {
  let term = 1;
  let sum = 1;
  let k = 0;
  while (term > 1e-12 * sum) {
    k++;
    term *= (x * x) / (4 * k * k);
    sum += term;
  }
  return sum;
}

// The shader's 5-term I0 (documented truncation; relative error
// below 1e-6 on [0, SIGMA_MAX]).
export function besselI0Shader(x) {
  const q = (x * x) / 4;
  const q2 = q * q;
  return 1 + q + q2 / 4 + (q2 * q) / 36 + (q2 * q2) / 576;
}

// Instantaneous intensity factor for waveform value s in [-1, 1]:
// mean over a full sinusoidal period is EXACTLY 1.
export function intensity(sigma, s) {
  return Math.exp(sigma * s) / besselI0(sigma);
}
