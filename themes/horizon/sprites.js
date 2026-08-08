/**
 * Red sprites - transient luminous events above the measured
 * Blitzortung strikes. The single source shared by the theme's
 * sprite layer (Horizon.html + sky-objects-tsl.js mirrors the
 * colour split in TSL) and the reference printer
 * (sprites-reference.mjs).
 *
 * Every constant below is a printed value from a source read in
 * full for this pass:
 *
 * OCCURRENCE - Chen et al. 2008 (JGR 113, A08306, author-hosted
 * reprint): the ISUAL/FORMOSAT-2 three-year survey recorded 633
 * sprites for a global observed rate of 0.50 sprites/min (their
 * section 4; Sato & Fukunishi 2003's independent Schumann-
 * resonance estimate, quoted there, is the same 0.5/min), with a
 * conjectured factor-two detection correction to ~1/min (their
 * section 6). Global lightning runs ~45 flashes/s (Christian
 * 2003/Cecil 2014, printed in Perez-Invernon et al. 2023,
 * egusphere-2023-2403, read in full). Sprites per unit area
 * land:coast:ocean = 4.7:3.2:1 while CG lightning is 10:1
 * land:ocean (both printed in Chen 2008, Table 2 and section 4) -
 * an OCEANIC flash is therefore ~2.4x more likely to sprite than
 * a continental one. The parent physics (not measurable from the
 * polarity-blind Blitzortung feed, so documentation rather than
 * gate): >90% sprite probability for +CG charge moment >1000
 * C km in <6 ms, <10% below 600 C km, ~60% between (Hu et al.
 * 2002 GRL 29(8), read in full); sharp nightly thresholds of
 * ~600/~600/~350 C km with zero sprites from ~900 analysed -CGs
 * (Cummer & Lyons 2005 JGR 110, A04304, read in full).
 *
 * GEOMETRY - Chen et al. 2008: "A sprite consists of one or
 * several vertical columns of light and spans the region between
 * 40 and 90 km altitudes. A halo is a featureless luminous disk
 * at 75-85 km altitudes." Halo lateral extent ~70 km and descent
 * from 85 to 70 km (Barrington-Leigh 2000, Stanford PhD thesis,
 * author-hosted, ch. 5). Streamer initiation ~75 km (Stanley et
 * al. 1999, quoted in Cummer & Lyons 2005).
 *
 * TIMING - lightning-to-sprite delay >= 1.5 ms, short-delay
 * class < 6 ms (Hu et al. 2002); long-delayed sprites ride
 * continuing current tens of ms after the stroke (Cummer & Lyons
 * 2005); sprite lifetime "several-to-tens of milliseconds"
 * (Barrington-Leigh 2000, sec. 2.3).
 *
 * PHOTOMETRY - Barrington-Leigh 2000: Fly's Eye photometer
 * surface brightnesses are expressed in kR at 700 nm (his
 * eq. 3.3ff), with the printed conversion 1 kR = 22.6 pW cm^-2
 * sr^-1 - the SAME SI rayleigh the theme's airglow/aurora chain
 * carries (Brandstrom 2012 lineage), so his numbers plug into
 * lineLuminance() unchanged. His Figure 5-2 sprite halo:
 * observed photometer signals of order 10 MR (N2 1P) against a
 * modeled quasi-electrostatic flash reaching 60 MR; elves print
 * >1 MR (his sec. 4.1.2) and the modeled elve is <1/6 of the QE
 * halo flash. The characteristic display brightness rides the
 * OBSERVED 10 MR; Crumey's extended-source threshold then decides
 * visibility against the same adapted sky luminance the stars
 * use.
 *
 * COLOUR - the sprite body is N2 first-positive red (Mende 1995 /
 * Hampton 1996, quoted in Kuo et al. 2005 GRL 32, L19103, read in
 * full - author-hosted reprint); the lower tendrils turn blue
 * because quenching kills the red first: with the printed Pasko
 * et al. 1997 coefficients (Barrington-Leigh 2000, sec. 2.3.3)
 * A(1P) = 1.7e5 s^-1 vs alpha1 = 1e-17 m^3/s on N2 and A(2P) =
 * 2e7 s^-1 vs alpha2 = 3e-16 m^3/s on O2, "the quenching rate
 * terms ... become comparable to the Einstein coefficient Ak only
 * below altitudes of 32 km for N2(2P) and 50 km for N2(1P)".
 * Blue display wavelength 427.8 nm - the N2+ first negative band
 * photometered through the sprite campaigns (Armstrong et al.
 * 1998, quoted in Kuo et al. 2005; its printed 1N(0-0) quench
 * height is 48 km). The red/blue split EMERGES from the two
 * printed crossovers through the barometric law - no hand
 * colour ramp.
 */

// ---- occurrence --------------------------------------------------
export const SPRITE_GLOBAL_PER_MIN = 0.5; // Chen 2008 observed rISUAL
export const SPRITE_DETECTION_CORR = 2; // Chen 2008 sec. 6 conjecture
export const FLASHES_PER_SEC = 45; // Christian 2003/Cecil 2014
export const SPRITE_AREA_RATIO = {land: 4.7, coast: 3.2, ocean: 1}; // Chen 2008
export const CG_LAND_OCEAN = 10; // Christian 2003, printed in Chen 2008

// Sprite probability per located flash: the corrected global
// sprite rate over the global flash rate. land/ocean folds the
// two printed per-area ratios: sprites/flash over ocean vs land =
// (1/4.1)/(1/10) ~ 2.4 (Chen 2008 prints L&C:O 4.1:1 for sprites
// against 10:1 for lightning; seaFrac interpolates).
export const SPRITE_LC_O = 4.1; // Chen 2008 Table 2, L&C:O per-area
export function spriteProbPerFlash(seaFrac = 0) {
  const base =
    (SPRITE_GLOBAL_PER_MIN * SPRITE_DETECTION_CORR) / (FLASHES_PER_SEC * 60);
  const oceanBoost = CG_LAND_OCEAN / SPRITE_LC_O;
  return base * (1 + (oceanBoost - 1) * Math.min(Math.max(seaFrac, 0), 1));
}

// Parent-physics documentation (Hu et al. 2002; the feed carries
// no charge moment, so these gate nothing directly - they are the
// printed ladder the single per-flash probability compresses).
export const CMC_P90_CKM = 1000; // >90% sprite probability above
export const CMC_P10_CKM = 600; // <10% below
export const CMC_P_MID = 0.6; // ~60% in the 600-1000 transition

// ---- geometry (km) -----------------------------------------------
export const SPRITE_BOT_KM = 40; // Chen 2008 column span
export const SPRITE_TOP_KM = 90;
export const HALO_LO_KM = 75; // Chen 2008 halo disk
export const HALO_HI_KM = 85;
export const HALO_WIDTH_KM = 70; // Barrington-Leigh 2000 ch. 5
export const SPRITE_INIT_KM = 75; // Stanley 1999 via Cummer & Lyons 2005

// ---- timing ------------------------------------------------------
export const SPRITE_DELAY_MIN_MS = 1.5; // Hu 2002
export const SPRITE_DELAY_SHORT_MS = 6; // Hu 2002 short-delay class
export const SPRITE_LIFE_MS = 30; // display persistence inside the
// printed "several-to-tens of milliseconds" lifetime

// ---- photometry --------------------------------------------------
export const SPRITE_MR_OBS = 10; // Barrington-Leigh 2000 Fig. 5-2 observed
export const SPRITE_MR_MODEL = 60; // his modeled QE flash ceiling
export const ELVE_MR_MIN = 1; // his sec. 4.1.2 prose
export const SPRITE_LAM_RED = 700; // his calibration convention (nm)
export const SPRITE_LAM_BLUE = 427.8; // 1N band, Armstrong 1998 via Kuo 2005
// Solid angle of a sprite cluster for Crumey's extended-source
// threshold: the ~70 km halo width at 150-300 km viewing range
// subtends 10-25 degrees - of order 0.05 sr.
export const SPRITE_SR = 0.05;

// ---- colour: quenching crossovers (km) ---------------------------
export const QUENCH_1P_KM = 50; // N2(1P) red dies below (thesis print)
export const QUENCH_2P_KM = 32; // N2(2P)/blue survives to (thesis print)
export const QUENCH_1N_KM = 48; // 1N(0-0), Kuo 2005 Table 1 note
// Barometric scale height DERIVED from the two printed crossovers
// and the printed coefficients: A/alpha gives the quencher number
// density at each crossover (N2: 1.7e5/1e-17 = 1.7e22 m^-3 at
// 50 km; O2: 2e7/3e-16 = 6.67e22 m^-3 at 32 km); with the printed
// 78%/21% composition the TOTAL densities are 2.18e22 and
// 3.17e23 m^-3, and one exponential through both points has
//   H = (50-32) / ln(3.17e23/2.18e22) = 6.72 km,
// squarely the handbook mesospheric scale height - the printed
// pair is self-consistent.
export const A_1P = 1.7e5; // s^-1 (Pasko 1997 via thesis)
export const ALPHA_1P = 1e-17; // m^3/s on N2
export const A_2P = 2e7; // s^-1
export const ALPHA_2P = 3e-16; // m^3/s on O2
export const N2_FRAC = 0.78; // printed composition
export const O2_FRAC = 0.21;
export function quenchScaleHeightKm() {
  const n50 = A_1P / ALPHA_1P / N2_FRAC;
  const n32 = A_2P / ALPHA_2P / O2_FRAC;
  return (QUENCH_1P_KM - QUENCH_2P_KM) / Math.log(n32 / n50);
}

// Emission survival q = A/(A + alpha N(z)): exactly a logistic in
// altitude for barometric N(z), centred on the printed crossover.
export function quenchRed(zKm) {
  const H = quenchScaleHeightKm();
  return 1 / (1 + Math.exp((QUENCH_1P_KM - zKm) / H));
}
export function quenchBlue(zKm) {
  const H = quenchScaleHeightKm();
  return 1 / (1 + Math.exp((QUENCH_2P_KM - zKm) / H));
}

// The drawn red:blue mix at altitude z: each system's survival,
// red normalised to 1 high above the crossovers. The relative
// EXCITATION of the two systems inside a streamer is folded into
// one documented display weight (blue tendrils carry a visible
// but subordinate fraction; the ionised bands are the minority
// emission - Armstrong 1998 via Kuo 2005); the ALTITUDE structure
// is the printed quenching physics above.
export const BLUE_EXC_W = 0.35; // documented display weight
export function spriteColorMix(zKm) {
  const r = quenchRed(zKm);
  const b = quenchBlue(zKm) * BLUE_EXC_W;
  return {red: r, blue: b};
}
