/**
 * overcast.js - the overcast sky as radiative transfer, from two
 * read papers and the stratus microphysics the theme already
 * ships. Pure math (node-importable); gated by
 * overcast-reference.mjs. Retires the hand-picked veil
 * (#79838c/#a2abb3, alpha = cloudy^2 x 0.85).
 *
 * The column: Wood 2012 (MWR 140, 2373, read in full - the
 * stratocumulus review): "typical climatological mean liquid
 * water paths ... are 40-150 g m^-2" - OVERCAST_LWP carries the
 * printed range's log midpoint, the range stated. The optical
 * depth follows the review's own relation (their Eq. 2: tau is
 * the vertical integral of liquid water over the effective
 * radius),
 *     tau = (3/2) LWP / (rho_w r_e),
 * with r_e from Miles, Verlinde & Clothiaux 2000's printed
 * D_e,obs (cloud-corona.js DROPLET_DE_OBS_UM - the SAME survey
 * Wood's own thickness compilation cites) by the measured
 * air-mass class: continental 5.4 um -> tau ~ 21.5, marine
 * 9.6 um -> tau ~ 12.1 - inside Wood's printed overcast range
 * ("less than 1 to more than 20").
 *
 * The transfer: Meador & Weaver 1980 (JAS 37, 630, read in
 * full). Their Table 1 Eddington row at omega_0 = 1 gives
 * gamma_1 = 1/4 [7 - (4+3g)] = (3/4)(1-g) = gamma_2, and their
 * Eq. (29) prints the conservative closed form
 *     R = gamma_1 tau / (1 + gamma_1 tau),  T = 1 - R.
 * g = 0.84, the middle of Wood's printed "g = 0.82-0.86 (Liou
 * 1992)"; conservative scattering (Wood: "omega = 1" in the
 * visible) makes T a function of (1-g) tau alone, so the
 * delta-scaling question dissolves - the similarity invariant.
 * CORROBORATION, printed in Wood himself: the analytic albedo
 * "a = tau/(tau+7) [Seinfeld and Pandis 1997]" IS this formula
 * at g = 1 - 4/21 = 0.8095 - inside the printed g range; the
 * gate holds the two within their g-spread.
 *
 * The sky under the deck: Meador & Weaver's Eq. (30) prints the
 * Eddington intensity ansatz
 *     I(tau, mu) = 1/2 [(2+3mu) I+ + (2-3mu) I-],
 * so at the cloud base over a dark lower boundary (I+ = 0) the
 * emergent DOWNWARD radiance carries the (2+3mu) gradation -
 * zenith 2.5x the horizon, the overcast sky's classic soft
 * brightening toward the top. Flux closure fixes the scale:
 *     E = INT L mu dOmega = 2 pi C INT (2mu + 3mu^2) dmu
 *       = 4 pi C   =>   L(mu) = E (2 + 3mu) / (4 pi).
 * (The empirical CIE/Moon-Spencer overcast sky grades steeper,
 * 3:1 - documented context, not read, not used: the drawn law is
 * the read paper's own ansatz, consistent with its T.)
 *
 * The veil's opacity becomes the COVER fraction itself: at the
 * drawn tau the direct-pattern transmission e^-tau is ~1e-6 -
 * the covered sky is opaque, and the cover measures how much of
 * it is covered. The old cloudy^2 x 0.85 fade and the day gate
 * retire: day/night lives in the fed irradiance (sun, moon
 * through moonlight.js, and the measured sky ambient).
 *
 * Documented scope: single slab over a dark lower boundary (no
 * ground-albedo multiple reflection - snow under overcast would
 * brighten it, its own pass); horizontal homogeneity (Wood: the
 * inhomogeneity correction to tau is "generally 10% or less"
 * for stratocumulus regions).
 */

// Wood 2012, printed: climatological mean LWP 40-150 g/m^2 for
// stratocumulus regions; the log midpoint is carried, the range
// stated (the drawn overcast can honestly be ~2x thinner or
// thicker).
export const OVERCAST_LWP_RANGE = [40, 150];
export const OVERCAST_LWP = Math.sqrt(
  OVERCAST_LWP_RANGE[0] * OVERCAST_LWP_RANGE[1]
);
// Wood 2012, printed: "g = 0.82-0.86 (Liou 1992)" in the visible;
// the middle is carried, the range stated.
export const CLOUD_G_RANGE = [0.82, 0.86];
export const CLOUD_G = 0.84;
export const RHO_WATER = 1000; // kg/m^3

// tau = (3/2) LWP / (rho_w r_e) - Wood's Eq. (2) relation with
// LWP in g/m^2 and r_e in microns. Zero or invalid r_e fails
// closed (no microphysics, no overcast model).
export function overcastTau(reUm, lwp = OVERCAST_LWP) {
  if (!(reUm > 0) || !(lwp > 0)) return 0;
  return (1.5 * (lwp * 1e-3)) / (RHO_WATER * reUm * 1e-6);
}

// Meador & Weaver Table 1, Eddington, omega_0 = 1:
// gamma_1 = (3/4)(1 - g) (= gamma_2 - their own remark before
// Eq. 29).
export function overcastGamma1(g = CLOUD_G) {
  return 0.75 * (1 - g);
}

// Meador & Weaver Eq. (29), conservative scattering:
// R = gamma_1 tau / (1 + gamma_1 tau); T = 1 - R exactly (the
// slab absorbs nothing).
export function overcastAlbedo(tau, g = CLOUD_G) {
  const gt = overcastGamma1(g) * Math.max(tau, 0);
  return gt / (1 + gt);
}
export function overcastT(tau, g = CLOUD_G) {
  return 1 - overcastAlbedo(tau, g);
}

// The emergent radiance under the deck: MW Eq. (30) with a dark
// lower boundary - L(mu) = E_below (2 + 3 mu) / (4 pi), mu the
// view direction's cosine above the horizon. The 4 pi is the
// exact flux closure (gate landmark).
export function overcastRadiance(mu, eBelow) {
  const m = Math.min(Math.max(mu, 0), 1);
  return (Math.max(eBelow, 0) * (2 + 3 * m)) / (4 * Math.PI);
}

// ---- the ground-coupled overcast (the white-out) ----
// The slab reflects downwelling light BACK at the ground with the
// same conservative R (a symmetric diffuse slab), so a bright
// surface and the deck multiply-reflect: the downwelling under
// the slab is the geometric series
//     E_dn = T E0 (1 + aR + (aR)^2 + ...) = T E0 / (1 - a R),
// the adding method on Meador & Weaver's own R. Energy stays
// exactly closed (gate landmark): R + a T^2 F + (1-a) T F = 1
// with F = 1/(1-aR) - what space gets back plus what the ground
// keeps. a = 0 is the shipped dark-base law unchanged; over full
// fresh snow at the continental column the factor reaches ~3.4x
// - the white-out, where Wiscombe & Warren's own Sec. 4 remark
// points the same way ("the formation of cloud cover over snow
// should raise its spectral albedo for solar elevations
// exceeding ~40 deg" - the diffuse albedo is the one that
// matters under a deck, their statement too).
export function overcastGroundFactor(tau, albedo, g = CLOUD_G) {
  const R = overcastAlbedo(tau, g);
  const a = Math.min(Math.max(albedo || 0, 0), 1);
  return 1 / (1 - a * R);
}

// Snow's DIFFUSE visible albedo: Wiscombe & Warren 1980 (JAS 37,
// 2712, read in full), Fig. 9 at their standard 100 um new-fallen
// grain - ~0.985 at 0.4 um, ~0.94 at 0.8 um - interpolated
// linearly in wavelength to the theme's 0.68/0.55/0.44 um
// channels (blue highest: snow's visible slope). Their printed
// bound carries the age spread: visible reductions with grain
// growth "never exceeding 10-15%". Figure-read values, stated as
// such.
export const SNOW_ALBEDO_RGB = [0.953, 0.968, 0.98];
