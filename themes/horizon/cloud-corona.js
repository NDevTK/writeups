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
 * THE DROPLET CORONA (the deck's own): G&L's most common producer
 * is the liquid water cloud, and the theme's volumetric decks are
 * exactly that. Their measured microphysics is Miles, Verlinde &
 * Clothiaux 2000 (JAS 57, 295, read in full): a survey of every
 * published in-situ stratus droplet spectrum, separated marine vs
 * continental by the source papers' own classification, each
 * distribution fitted by the lognormal (their Eq. 6)
 *     n(D) = N_t / (sqrt(2 pi) sigma_log D)
 *            * exp(-[ln(D / D_n,log)]^2 / (2 sigma_log^2)),
 * D_n,log the median diameter and sigma_log the NATURAL-log width.
 * Table 3's printed averages are this module's two droplet classes:
 * marine D_n 13.1 um, continental 7.7 um, sigma_log 0.38 for both
 * (the survey's own striking coincidence). The paper states the
 * fitted parameters describe the UNTRUNCATED distributions ("the
 * parameters reported in the database are the untruncated
 * distributions that reproduce the measurements"), so the ensemble
 * integrals run wide bounds and a gate landmark holds their moments
 * at the closed lognormal forms. The corona pattern is the
 * cross-section-weighted Airy ensemble over that lognormal - the
 * aureole's own diffractionPattern, one implementation - and at
 * sigma_log 0.38 the rings wash out entirely: the drawn corona is
 * the smooth bright aureole G&L predict for broad distributions
 * ("interference that results from flat and wide droplet size
 * distributions washes out the outer rings"; "the most vibrant,
 * multiringed coronas are produced by optically thin clouds with
 * NARROW droplet size distributions"), rings appearing only for
 * the narrow cirrus pattern above. Marine vs continental is the
 * measured air mass: sea salt carrying the majority of the CAMS
 * 555 nm extinction column (the desert gate's own majority test,
 * mirrored). The deck's slant optical depth is read per fragment
 * from the cloud shadow map (clouds-tsl tauSlant - the SAME map
 * terrain shadows ride), and the amplitude is tau/2 WITHOUT the
 * e^-tau: the volumetric composite extinguishes the dome behind
 * every deck pixel, so the slab law's extinction leg already runs
 * per pixel in the compositor - DROPLET_DIFF_SHARE * tau * e^-tau
 * would count it twice. The identity landmark states the partition.
 *
 * Documented residuals: the mid deck (altocumulus) rides the same
 * two stratus classes - Miles's survey is boundary-layer stratus,
 * and a printed altocumulus size climatology would be its own
 * source. Corona ellipticity from oriented crystals: out of scope
 * (Jaervinen's compact crystals justify the circular pattern).
 */

import {diffractionPattern, j1} from './aureole.js';
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

// Miles, Verlinde & Clothiaux 2000 Table 3 (printed averages of
// the whole published in-situ stratus record): lognormal median
// diameters D_n,log 13.1 um (marine) / 7.7 um (continental), and
// the logarithmic width sigma_log 0.38 - identical for both
// classes in the printed table. Their Eq. (6) is the natural-log
// form, so the aureole machinery's geometric standard deviation is
// exp(0.38); rm is the median RADIUS D_n/2 (medians scale exactly
// under D = 2r). Bounds: 1 um radius is the survey's own FSSP
// floor (2 um diameter); 100 um sits far beyond every moment the
// pattern uses - the paper reports UNTRUNCATED fits ("the
// parameters reported in the database are the untruncated
// distributions that reproduce the measurements"), and the
// closed-moment landmark holds these bounds effectively
// untruncated. Internal corroboration: their Eq. (7a)
// D_e = D_n exp(5 sigma^2 / 2) reproduces the independently
// printed D_e,obs for both classes (18.8 vs 19.2 +- 4.7 um;
// 11.0 vs 10.8 +- 4.1 um) - held by a gate landmark.
export const DROPLET_SIGMA_LOG = 0.38;
export const DROPLET_DN_UM = {marine: 13.1, continental: 7.7};
export const DROPLET_DE_OBS_UM = {marine: 19.2, continental: 10.8};
export const dropletMode = (cls) => ({
  rm: DROPLET_DN_UM[cls] / 2,
  sigma: Math.exp(DROPLET_SIGMA_LOG),
  rMin: 1,
  rMax: 100
});

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

// Sassen & Campbell 2001 (JAS 58, 481, read in full - FARS Part
// I, the same instrument family as the tau above): 10-yr annual
// mean cirrus cloud-base and cloud-top heights, Table 3 - 8.79
// and 11.02 km MSL (the printed layer envelope 2.23 km is their
// difference exactly; the abstract's 11.2 rounds the table's
// value). The veil is drawn as this uniform spherical shell.
export const CIRRUS_BASE_M = 8790;
export const CIRRUS_TOP_M = 11020;

// Exact path length of a straight ray through the spherical
// shell [H1, H2], in units of the shell thickness (an air-mass
// factor for the veil): eye at height hEye, elevation elev. Pure
// shell geometry along the FORWARD ray - u is the along-ray
// coordinate with u = 0 at the closest approach (impact
// parameter p = r0 cos elev), the shell occupies |u| in [q1, q2]
// and the eye sits at u_e = r0 sin elev. Replaces the
// plane-parallel 1 / max(sin alt, 0.08) - at 10 degrees the two
// agree to ~1%, at the horizon this is FINITE (the closed
// sqrt(2R dH) chord) where the old floor was a display-era
// clamp, and below the horizon it keeps meaning down to the
// shell's own tangent: the twilight geometry. No ground test
// here - the beam's planet shadow is sunTransmittanceJS's own
// (the same Hillaire sphere).
export function shellChordAM(
  elevRad,
  hEyeM = 300,
  H1M = CIRRUS_BASE_M,
  H2M = CIRRUS_TOP_M,
  RM = 6360e3
) {
  if (!Number.isFinite(elevRad)) return 0;
  const e = Math.min(Math.max(elevRad, -Math.PI / 2), Math.PI / 2);
  const r0 = RM + hEyeM;
  const R1 = RM + H1M;
  const R2 = RM + H2M;
  const p2 = r0 * Math.cos(e) * (r0 * Math.cos(e));
  if (p2 >= R2 * R2) return 0;
  const ue = r0 * Math.sin(e);
  const q2 = Math.sqrt(R2 * R2 - p2);
  const q1 = p2 < R1 * R1 ? Math.sqrt(R1 * R1 - p2) : 0;
  const seg = (a, b) => Math.max(0, b - Math.max(a, ue));
  return (seg(-q2, -q1) + seg(q1, q2)) / (H2M - H1M);
}

// The same geometry cut at the FIRST shell exit: the in-veil
// path from a crystal at hEye (inside the shell) outward toward
// elevation elev, NOT counting a far-side re-entry. The twilight
// pillar's sun leg uses this as the stated single-patch
// assumption: FARS's cirrus are mesoscale systems, and the far
// branch of a grazing chord re-enters the shell 200+ km beyond
// the measured local cover's domain - the emergence landmark
// measures both branches so the assumption stays a number, not a
// mood.
export function shellFirstExit(
  elevRad,
  hEyeM,
  H1M = CIRRUS_BASE_M,
  H2M = CIRRUS_TOP_M,
  RM = 6360e3
) {
  if (!Number.isFinite(elevRad)) return 0;
  const e = Math.min(Math.max(elevRad, -Math.PI / 2), Math.PI / 2);
  const r0 = RM + hEyeM;
  const R1 = RM + H1M;
  const R2 = RM + H2M;
  const p2 = r0 * Math.cos(e) * (r0 * Math.cos(e));
  if (p2 >= R2 * R2) return 0;
  const ue = r0 * Math.sin(e);
  const q2 = Math.sqrt(R2 * R2 - p2);
  const q1 = p2 < R1 * R1 ? Math.sqrt(R1 * R1 - p2) : 0;
  // Descending from inside the shell above the base: out through
  // the base. Otherwise (ascending, or the tangent sits inside
  // the shell): out through the top.
  const L = ue < -q1 && q1 > 0 ? -q1 - ue : q2 - Math.max(ue, q1);
  return Math.max(L, 0) / (H2M - H1M);
}

// Slant extinction optical depth of the high veil: the measured
// full-cover mean scaled by the fractional cover, over the EXACT
// shell chord at the eye's height (the 0.08 grazing floor is
// retired - the geometry is finite on its own). Fails closed on
// garbage.
export function cirrusSlantTau(coverFrac, sinAlt, eyeHM = 300) {
  const c = Math.min(Math.max(coverFrac ?? 0, 0), 1);
  if (!(c > 0) || !Number.isFinite(sinAlt)) return 0;
  const e = Math.asin(Math.min(Math.max(sinAlt, -1), 1));
  return CIRRUS_TAU_FULL * c * shellChordAM(e, eyeHM);
}

// Corona amplitude per unit pre-cirrus direct irradiance at the
// eye: (tau/2) e^-tau. Closed points the gate pins: 0 at tau = 0
// (no cirrus, no corona), initial slope exactly 1/2 (the
// extinction-paradox diffracted share), maximum at tau = 1.
export function coronaAmp(tauSlant) {
  const t = Math.max(tauSlant, 0);
  return 0.5 * t * Math.exp(-t);
}

// The deck droplet corona's amplitude PER UNIT slant optical
// depth: exactly the extinction-paradox diffracted half (van de
// Hulst 1957 Sec. 8.31 - x = pi D/lambda ~ 44-75 for the Miles
// diameters, deep in the Q -> 2 regime; liquid water absorbs
// nothing at visible depths, scattering = extinction). The dome
// multiplies by the fragment ray's own deck tau from the cloud
// shadow map and by NO e^-tau: the volumetric composite already
// extinguishes the dome behind every deck pixel, which IS the
// slab law's extinction leg -
//   DROPLET_DIFF_SHARE * tau * e^-tau === coronaAmp(tau)
// (the gate landmark) - the same law, the e^-tau carried by the
// compositor instead of the amp. The march's dual-lobe HG phase
// never resolves the diffraction spike (a few sr^-1 at these
// angles against the ensemble's ~10^3 sr^-1 peak), so the pair
// partitions Q = 2 cleanly: diffraction half exact on the dome,
// geometric half in the march.
export const DROPLET_DIFF_SHARE = 0.5;

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
// convolved exactly once with the source disc at its TRUE angular
// radius (optics-lut sunConvolve - the one certified convolution).
// The sun passes its Hestroffer-Magnan limb darkening by default;
// the MOON passes limbAlpha [0, 0, 0] - the flat full-moon disc
// its own Hapke rendering draws. RGBA Float32Array in the
// aureole-curve texture format; values stay in sr^-1 - the dome
// multiplies by transmittance, amplitude and eclipse factor only.
function packCoronaLUT(profFor, srcRadRad, limbAlpha, thetaMaxDeg) {
  const thetaMaxRad = ((thetaMaxDeg ?? CORONA_THETA_MAX_DEG) * Math.PI) / 180;
  const dTheta = thetaMaxRad / CORONA_N;
  const thetas = [];
  for (let i = 0; i < CORONA_N; i++) thetas.push((i + 0.5) * dTheta);
  const prof = new Float64Array(CORONA_N * 3);
  for (let c = 0; c < 3; c++) {
    const p = profFor(CHANNEL_UM[c], thetas);
    for (let i = 0; i < CORONA_N; i++) prof[i * 3 + c] = p[i];
  }
  const conv =
    limbAlpha === undefined
      ? sunConvolve(prof, CORONA_N, dTheta, srcRadRad)
      : sunConvolve(prof, CORONA_N, dTheta, srcRadRad, limbAlpha);
  const curve = new Float32Array(CORONA_N * 4);
  for (let i = 0; i < CORONA_N; i++) {
    curve[i * 4] = conv[i * 3];
    curve[i * 4 + 1] = conv[i * 3 + 1];
    curve[i * 4 + 2] = conv[i * 3 + 2];
    curve[i * 4 + 3] = 1;
  }
  return {curve, thetaMaxRad, coneRad: thetaMaxRad};
}

export function buildCloudCoronaLUT(
  srcRadRad,
  dUm = CORONA_D_UM,
  limbAlpha = undefined,
  thetaMaxDeg = undefined
) {
  return packCoronaLUT(
    (um, thetas) => airyPattern(dUm, um, thetas),
    srcRadRad,
    limbAlpha,
    thetaMaxDeg
  );
}

// The deck droplet corona's pattern: the cross-section-weighted
// Airy ensemble over the Miles lognormal for the measured air-mass
// class - the aureole's diffractionPattern, the one ensemble
// implementation - convolved once with the live source disc like
// every drawn optic. At the printed sigma_log the pattern is a
// smooth monotone aureole (the gate landmark holds it ringless);
// its similarity landmark states G&L's inverse size law: the
// continental pattern IS the marine one stretched by D_mar/D_cont
// and dimmed by its square.
export function buildDropletCoronaLUT(
  srcRadRad,
  cls = 'continental',
  limbAlpha = undefined
) {
  return packCoronaLUT(
    (um, thetas) => diffractionPattern(dropletMode(cls), um, thetas),
    srcRadRad,
    limbAlpha
  );
}

// The plate family's beam in the CRYSTAL-LOCAL frame: the drawn
// halo/dog/circle/arc crystals live on the deck mid-shell along
// the sun sight line, where the horizon dips a_C below the
// ground frame. PRE-SUNSET this is the ground transmittance
// EXACTLY - deck-beam x view-segment = full path, the closure
// identity the atmo gate holds to 1% - so swapping the family
// onto this frame changes nothing while the sun is up. PAST
// ground sunset the ground formula freezes (sin clamped at 0)
// while the deck's crystals still see the sun: this frame
// carries the ring, the dogs, the circle and the arcs on
// still-lit cirrus - reddening like the pillar - until the
// EXACT planet shadow closes it: the horizon-ward crystal sits
// where the earth's curvature has rotated the frame a full
// horizon dip (~3.2 deg from the deck), so its window runs to
// ground altitude ~ -6.4 deg - two dips down, further than the
// pillar's own centroid geometry (-4.6). The in-veil leg and
// the slab stay with the caller.
import {pathToRadiusT, sunTransmittanceJS} from './sun-transmittance.js';
export function crystalBeamT(hAltRad, eyeHM, mie) {
  const Rb = 6360e3;
  const Hm = (CIRRUS_BASE_M + CIRRUS_TOP_M) / 2;
  const Rm = Rb + Hm;
  const r0 = Rb + Math.min(Math.max(eyeHM ?? 300, 0), CIRRUS_BASE_M - 1);
  // The sight line to the deck: at and below the horizon the
  // drawn crystals sit toward the horizon point (the family's
  // display hugs the sunset), so the elevation floor keeps the
  // chord geometric.
  const e = Math.max(hAltRad, 0.001);
  const se = Math.sin(e);
  const sMid = -r0 * se + Math.sqrt(r0 * se * r0 * se + Rm * Rm - r0 * r0);
  const aC = Math.atan2(sMid * Math.cos(e), r0 + sMid * se);
  const hLoc = hAltRad + aC;
  // The EXACT planet shadow: below the crystal's own horizon dip
  // (cos dip = Rb/Rm) the sun ray from the deck intersects the
  // earth - the transmittance integral alone cannot know this
  // (it only meets the top sphere; a sub-surface path merely
  // underflows), so the geometry closes the window here.
  if (Math.sin(hLoc) < -Math.sqrt(1 - (Rb / Rm) * (Rb / Rm))) {
    return [0, 0, 0];
  }
  const tB = sunTransmittanceJS(Math.sin(hLoc), mie, Hm);
  const tV = pathToRadiusT(se, mie, r0 - Rb, Hm);
  return [0, 1, 2].map((k) => tB[k] * tV[k]);
}
