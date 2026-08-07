/**
 * cloud-corona.js - the diffraction corona through thin, cold cirrus,
 * from measured microphysics. Gated by cloud-corona-reference.mjs.
 *
 * The phenomenon: rings of a few degrees around the sun or moon when
 * a thin ice veil stands in front of it - Fraunhofer diffraction by
 * the cloud's own particles, the exact machinery the aerosol aureole
 * already runs (aureole.js), at cloud-droplet-and-crystal sizes
 * instead of aerosol sizes. Gedzelman & Lock 2003 (Appl. Opt. 42,
 * 497, read in full): coronas form "when sunlight or moonlight
 * penetrates optically thin clouds", the ring radius is inversely
 * proportional to particle radius, and ice clouds ring only when
 * their size distribution is NARROW - which the measured record says
 * happens in one specific regime:
 *
 *  - Sassen 1991 (Appl. Opt. 30, 3421): eleven corona-producing
 *    cirrus cases - subvisual to thin cirrostratus at or above the
 *    tropopause, temperatures BETWEEN -60 AND -70 C, crystal mean
 *    diameters 12-30 um from the ring angles themselves.
 *  - Sassen, Mace, Hallett & Poellot 1998 (Appl. Opt. 37, 1477):
 *    the instrumented case - a -71 C, 14 km layer whose corona
 *    rings invert to an EFFECTIVE PARTICLE DIAMETER OF ~22 UM,
 *    corroborated in situ ("simple solid crystals" at cloud top).
 *    That printed 22 um is this module's drawn diameter - one
 *    measured case study, the Morteratsch-albedo pattern.
 *  - Jaervinen, Vochezer, Moehler & Schnaiter 2014 (Appl. Opt. 53,
 *    7566): AIDA chamber coronas from "a narrow distribution of
 *    small (median Dp = 19-32 um) and compact ice crystals" grown
 *    by homogeneous freezing - the lab confirming both the size
 *    range and WHY it is narrow (uniform growth from homogeneous
 *    nucleation in cold, clean air).
 *
 * The GATE is therefore a measurement the theme already fetches:
 * the 250 hPa temperature (syncAloft feeds the Schmidt-Appleman
 * criterion from it). At or below -60 C - Sassen's printed range
 * edge - the high veil's crystals sit in the homogeneous-freezing
 * small-crystal regime and the corona draws; warmer cirrus keeps
 * its halos and draws no rings. No measurement, no corona (fails
 * closed).
 *
 * The pattern: the monodisperse Airy diffraction of the printed
 * 22 um diameter - monodisperse is not a convenience but the
 * sources' own model (Sassen inverts ring angles through it; G&L:
 * monodisperse droplets with a >= 5 um "exhibit the color sequences
 * given by the classical diffraction theory"; x = pi D/lambda ~ 126
 * at 550 nm sits deep in that regime). The physical smearing that
 * remains is the SOURCE DISC, convolved exactly once at its true
 * angular radius (optics-lut sunConvolve - the same certified
 * convolution the halo/bow/dog LUTs ride).
 *
 * The radiometry: single scattering through a thin slab. Per unit
 * of direct irradiance arriving at the eye WITHOUT the cirrus
 * (E0 = 1 frame: the transmittance LUT's own value), the corona
 * radiance is
 *     L(theta) = P(theta) * (tau/2) * exp(-tau),
 * tau the veil's slant extinction optical depth: every singly
 * scattered photon crosses the same total column at small theta, so
 * the source integral closes to tau_d exp(-tau); and tau_d =
 * tau / 2 exactly because a large particle diffracts its geometric
 * cross-section - half its extinction-paradox total (van de Hulst
 * 1957 Sec. 8.31, the aureole's own citation; at x ~ 126 the
 * asymptote IS the value, no printed Q needed; visible ice
 * absorption is nil at these depths so scattering = extinction).
 * The (tau/2) e^-tau shape rises linearly from zero (no cirrus, no
 * corona), peaks at tau = 1 and dies exponentially - the
 * single-scatter core of Gedzelman & Lock's measured visibility
 * arc ("first ... visible ... when tau ~ 0.001", washed out
 * "when tau >= 4"; their wash-out is multiple scattering
 * brightening the BACKGROUND, which in the theme is the veil and
 * the decks doing their own drawing over the dome).
 *
 * The veil's optical depth itself sheds its uncited "tau_vis = 1
 * at full high cover": Sassen & Comstock 2001 (JAS 58, 2113, read
 * in full) measured the midlatitude cirrus visible optical depth
 * over ~860 h of FARS lidar+radiometer: MEAN 0.75 (+-0.91, median
 * 0.61). CIRRUS_TAU_FULL carries the printed mean; Horizon.html's
 * cirrusT and this module's slant tau both read it, so the
 * sunlight's dimming and the corona's brightness ride ONE measured
 * column.
 *
 * Documented scope: the LUNAR corona (the classic naked-eye case)
 * needs the moonlight irradiance in the sky's radiometric frame
 * before it can be drawn honestly - named follow-up, not a display
 * gain here. Droplet coronas through altocumulus (G&L's most
 * common producer) wait on a mid-deck optical-depth model. Corona
 * ellipticity from oriented crystals: out of scope (Jaervinen's
 * compact crystals justify the circular pattern).
 */

import {j1} from './aureole.js';
import {sunConvolve} from './optics-lut.js';

// ---- printed constants, with their sources ----

// Sassen & Comstock 2001 (JAS 58, 2113): mean midlatitude cirrus
// visible optical depth at full cover (median 0.61; the paper's
// Table 2 midcloud temperature -42.6 C marks how much colder the
// corona subset below is).
export const CIRRUS_TAU_FULL = 0.75;
// Sassen 1991: corona-producing cirrus at "temperatures between
// -60 and -70 C" - the warm edge is the gate.
export const CORONA_T250_MAX = -60;
// Sassen, Mace, Hallett & Poellot 1998: "an effective particle
// diameter of ~22 um", in-situ corroborated. Inside Sassen 1991's
// 12-30 um field range and Jaervinen 2014's 19-32 um lab medians.
export const CORONA_D_UM = 22;

// Theme channels (aerosol.js CHANNEL_NM) in um.
export const CHANNEL_UM = [0.68, 0.55, 0.44];

export const CORONA_N = 256;
// LUT reach: u = x sin(theta) ~ 13 in green at 6 deg - through the
// third ring; the encircled-energy landmark states exactly how much
// of the diffracted light the cone holds (~95%), the remainder
// lying in rings too faint to draw over the smooth sky.
export const CORONA_THETA_MAX_DEG = 6;

// ---- Bessel J0 (Abramowitz & Stegun 9.4.1 / 9.4.3) ----
// Polynomial approximations, |eps| < 5e-8 (small) / ~1e-7 (large);
// the gate holds them at A&S Table 9.1 printed values and the
// printed first zero 2.4048255577 (Table 9.5). J1 is imported from
// aureole.js - one implementation each.
export function j0(x) {
  const ax = Math.abs(x);
  if (ax < 3) {
    const t = (x / 3) * (x / 3);
    return (
      1 +
      t *
        (-2.2499997 +
          t *
            (1.2656208 +
              t *
                (-0.3163866 +
                  t * (0.0444479 + t * (-0.0039444 + t * 0.00021)))))
    );
  }
  const t = 3 / ax;
  const f0 =
    0.79788456 +
    t *
      (-0.00000077 +
        t *
          (-0.0055274 +
            t *
              (-0.00009512 +
                t * (0.00137237 + t * (-0.00072805 + t * 0.00014476)))));
  const th =
    ax -
    0.78539816 +
    t *
      (-0.04166397 +
        t *
          (-0.00003954 +
            t *
              (0.00262573 +
                t * (-0.00054125 + t * (-0.00029333 + t * 0.00013558)))));
  return (f0 * Math.cos(th)) / Math.sqrt(ax);
}

// ---- the monodisperse Airy pattern ----
// P(theta) for diameter dUm at lambdaUm (sr^-1, normalised so the
// full pattern integrates to 1 - efficiency 1 of the geometric
// cross-section):
//   P = (x^2 / 4 pi) [2 J1(u)/u]^2,  u = x sin(theta), x = pi D/lambda.
// Central value has the closed form x^2/(4 pi) - a gate landmark;
// first minimum at u = 3.8317059702 (A&S Table 9.5) - the ring
// Sassen inverts for the diameter.
export function airyPattern(dUm, lambdaUm, thetasRad) {
  const x = (Math.PI * dUm) / lambdaUm;
  return thetasRad.map((th) => {
    const u = x * Math.sin(th);
    const core = u < 1e-9 ? 1 : (2 * j1(u)) / u;
    return ((x * x) / (4 * Math.PI)) * core * core;
  });
}

// Encircled energy of the Airy pattern inside u = x sin(theta):
// the classic closed form E(u) = 1 - J0(u)^2 - J1(u)^2 (Rayleigh;
// Born & Wolf Sec. 8.5.2). The gate holds the pattern quadrature
// to it - the identity no tuned curve could fake.
export function airyEncircled(u) {
  const a = j0(u);
  const b = j1(u);
  return 1 - a * a - b * b;
}

// ---- the slab radiometry ----

// Slant extinction optical depth of the high veil: the measured
// full-cover mean scaled by the fractional cover, over the flat-air
// slant 1/sin(alt) with the same 0.08 floor Horizon.html's cirrusT
// has always used at grazing sun.
export function cirrusSlantTau(coverFrac, sinAlt) {
  const c = Math.min(Math.max(coverFrac ?? 0, 0), 1);
  return (CIRRUS_TAU_FULL * c) / Math.max(sinAlt, 0.08);
}

// Corona amplitude per unit pre-cirrus direct irradiance at the
// eye: (tau/2) e^-tau. Closed points the gate pins: 0 at tau = 0
// (no cirrus, no corona), initial slope exactly 1/2 (the
// extinction-paradox diffracted share), maximum at tau = 1.
export function coronaAmp(tauSlant) {
  const t = Math.max(tauSlant, 0);
  return 0.5 * t * Math.exp(-t);
}

// The cold gate: the MEASURED 250 hPa temperature at or below the
// printed corona-cirrus edge. Fails closed without the measurement
// - an unmeasured sky draws no rings.
export function coronaColdGate(t250) {
  return typeof t250 === 'number' && Number.isFinite(t250)
    ? t250 <= CORONA_T250_MAX
    : false;
}

// ---- the drawn LUT ----
// Per-channel pattern over theta in [0, CORONA_THETA_MAX_DEG],
// convolved exactly once with the limb-darkened source disc at its
// TRUE angular radius (optics-lut sunConvolve - the one certified
// convolution; the caller passes the live sun radius, and a lunar
// consumer would pass the moon's). RGBA Float32Array in the
// aureole-curve texture format; values stay in sr^-1 - the dome
// multiplies by transmittance, amplitude and eclipse factor only.
export function buildCloudCoronaLUT(srcRadRad, dUm = CORONA_D_UM) {
  const thetaMaxRad = (CORONA_THETA_MAX_DEG * Math.PI) / 180;
  const dTheta = thetaMaxRad / CORONA_N;
  const thetas = [];
  for (let i = 0; i < CORONA_N; i++) thetas.push((i + 0.5) * dTheta);
  const prof = new Float64Array(CORONA_N * 3);
  for (let c = 0; c < 3; c++) {
    const p = airyPattern(dUm, CHANNEL_UM[c], thetas);
    for (let i = 0; i < CORONA_N; i++) prof[i * 3 + c] = p[i];
  }
  const conv = sunConvolve(prof, CORONA_N, dTheta, srcRadRad);
  const curve = new Float32Array(CORONA_N * 4);
  for (let i = 0; i < CORONA_N; i++) {
    curve[i * 4] = conv[i * 3];
    curve[i * 4 + 1] = conv[i * 3 + 1];
    curve[i * 4 + 2] = conv[i * 3 + 2];
    curve[i * 4 + 3] = 1;
  }
  return {curve, thetaMaxRad, coneRad: thetaMaxRad};
}
