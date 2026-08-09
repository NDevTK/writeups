/**
 * wetground.js - the wet world: rain finally darkens the ground.
 * Pure functions, mirrored by wetground-reference.mjs.
 *
 * THE PRIMARY (read in full - the paper is openly served in an
 * annotated rendering by Fermat's Library): Lekner & Dorf 1988,
 * "Why some things are darker when wet" (Appl. Opt. 27, 1278).
 * Angstrom's 1925 mechanism - a rough surface reflects
 * diffusely, so under a water film much of that light strikes
 * the liquid-air interface beyond the critical angle and is
 * turned BACK onto the absorbing surface - with their two
 * extensions. Their machinery, verbatim:
 *  - Eq. (1): the absorption ladder. With R1 the air-liquid
 *    reflectance, a the single-interaction absorption and p the
 *    probability that surface-reflected light returns from the
 *    film's upper interface,
 *      A = (1 - R1) a / [1 - p (1 - a)].
 *  - Eq. (2): Angstrom's estimate p = cos^2(theta_c) = 1 - 1/n^2
 *    (0.437 for water, their print).
 *  - Eq. (9): their improvement - the sub-critical Fresnel
 *    reflection counts too: p = 1 - (1/n^2)[1 - Rbar(n)], where
 *    Rbar(n) is Stern's average reflectance of an isotropically
 *    illuminated interface (their Eq. 7). For water their print
 *    is p = 0.475. HERE Rbar is not transcribed from their
 *    closed form: it is INTEGRATED from the repo's own gated
 *    Fresnel split (coxmunk.js fresnelRsRp, the 107th pass) -
 *    the same machinery that polarizes the drawn sea now sets
 *    how dark the wet ground goes, and the gate holds both
 *    printed p values.
 *  - Eq. (5): the reciprocity R(x, n) = R(x/n^2, 1/n) (Stern) -
 *    held numerically against the shipped Fresnel as a landmark.
 *  - Eq. (11): wetting lowers the RELATIVE index at the surface
 *    (liquid-to-material instead of air-to-material), so the
 *    single-interaction absorption itself rises:
 *      a_w = (1 - a_d) a_d [1-Rbar(nr/nl)]/[1-Rbar(nr)] + a_d^2,
 *    with their printed small-absorption ratios 1.07/1.08/1.10
 *    at nr = 1.5/2/2.5 for water.
 *  - Their figures set R1 at normal incidence, (nl-1)^2/(nl+1)^2.
 * Wet albedo = 1 - A against dry albedo = 1 - a_d; the gate holds
 * Angstrom's own measured pairs the paper plots (sand
 * 0.182 -> 0.091, black mold 0.141 -> 0.084) at the paper's
 * "good agreement" scatter, and their sentence that the effect
 * is strongest where absorption is weak. Their stated scope -
 * "rough solid surfaces, such as blackboards, asphalt, or
 * concrete" - is exactly the theme's roads and ground.
 *
 * THE WETNESS STATE combines two live sources: the top-layer
 * soil moisture (open-meteo soil_moisture_0_to_1cm, m^3/m^3, on
 * the SAME weather request the theme already makes) normalized
 * by a stated field-saturation scale, and the current rain (a
 * skin film exists while rain falls - the surface saturates
 * regardless of what the soil column has absorbed, stated).
 */

import {fresnelRsRp} from './coxmunk.js';

export const N_WATER_FILM = 4 / 3; // the paper's water index
export const NR_MINERAL = 2; // their figures' surface index
// Wetness normalization: top-layer volumetric moisture at which
// the surface reads fully wet. Field saturation of common soils
// sits near 0.35-0.45 m^3/m^3; 0.35 is the stated display scale
// (the optics above is exact; this one number maps a measured
// moisture onto it).
export const SOIL_SAT_M3M3 = 0.35;
export const RAIN_SKIN_WETNESS = 0.9; // while rain falls, stated

/** Unpolarized reflectance at x = sin^2(theta), relative index n. */
export function rUnpol(x, n) {
  const c = Math.sqrt(Math.max(1 - x, 0));
  const {Rs, Rp} = fresnelRsRp(c, n);
  return (Rs + Rp) / 2;
}

/**
 * Stern's average reflectance of an isotropically illuminated
 * interface (their Eq. 7): Rbar(n) = int_0^1 R(x, n) dx -
 * integrated from the shipped Fresnel split (midpoint rule; the
 * integrand is bounded and piecewise smooth).
 */
const rBarMemo = new Map();
export function rBarIso(n, N = 2048) {
  const key = n + '|' + N;
  const hit = rBarMemo.get(key);
  if (hit !== undefined) return hit;
  let s = 0;
  for (let i = 0; i < N; i++) s += rUnpol((i + 0.5) / N, n);
  const v = s / N;
  rBarMemo.set(key, v);
  return v;
}

/** Angstrom's Eq. (2): p = 1 - 1/n^2. */
export function pAngstrom(n = N_WATER_FILM) {
  return 1 - 1 / (n * n);
}

/** Their Eq. (9): p = 1 - (1/n^2)[1 - Rbar(n)]. */
export function pInternal(n = N_WATER_FILM) {
  return 1 - (1 / (n * n)) * (1 - rBarIso(n));
}

/** Their figures' air-liquid entry reflectance (normal incidence). */
export function r1Normal(n = N_WATER_FILM) {
  return ((n - 1) / (n + 1)) ** 2;
}

/** Their Eq. (11): the wetted single-interaction absorption. */
export function aWet(aDry, nl = N_WATER_FILM, nr = NR_MINERAL) {
  const ratio = (1 - rBarIso(nr / nl)) / (1 - rBarIso(nr));
  return (1 - aDry) * aDry * ratio + aDry * aDry;
}

/**
 * The wet albedo of a rough surface of dry albedo rhoDry under a
 * water film: 1 - A with A from Eq. (1), a from Eq. (11), p from
 * Eq. (9), R1 at normal incidence - the paper's own assembly.
 */
export function wetAlbedo(rhoDry, nl = N_WATER_FILM, nr = NR_MINERAL) {
  const aDry = 1 - Math.min(Math.max(rhoDry, 0), 1);
  const aw = aWet(aDry, nl, nr);
  const p = pInternal(nl);
  const A = ((1 - r1Normal(nl)) * aw) / (1 - p * (1 - aw));
  return Math.max(1 - A, 0);
}

/**
 * The client's multiplier: dry -> wet albedo ratio at wetness w
 * (0 dry .. 1 saturated), linear in w between the dry surface
 * and the fully wetted one (a partially wet surface is a
 * patchwork of the two - area-weighted mixing, stated).
 */
export function wetDarkenFactor(rhoDry, w) {
  const rho = Math.min(Math.max(rhoDry, 1e-3), 0.95);
  const f = wetAlbedo(rho) / rho;
  const ww = Math.min(Math.max(w, 0), 1);
  return 1 + ww * (f - 1);
}

/**
 * Wetness from the two live sources: top-layer soil moisture
 * (m^3/m^3, null when the feed is silent) and the current
 * precipitation (mm in the current interval). Rain saturates
 * the skin while it falls; otherwise the measured soil column
 * speaks.
 */
export function wetnessFrom(soilM3M3, precipMm) {
  const soil = Number.isFinite(soilM3M3)
    ? Math.min(Math.max(soilM3M3 / SOIL_SAT_M3M3, 0), 1)
    : 0;
  const raining = Number.isFinite(precipMm) && precipMm >= 0.1;
  return raining ? Math.max(soil, RAIN_SKIN_WETNESS) : soil;
}
