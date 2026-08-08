/**
 * blondel.js - the visibility of BRIEF lights: the Blondel-Rey
 * law from its own primary. Gated by blondel-reference.mjs.
 *
 * THE PRIMARY - A. Blondel & J. Rey, "Sur la perception des
 * lumieres breves a la limite de leur portee", J. Phys. Theor.
 * Appl. 1 (1911) 530-550, and the companion "Application aux
 * signaux ...", same volume 643-655 (HAL jpa-00241701 /
 * jpa-00241711, the EDP scans of the 1911 journal). Both READ IN
 * FULL; the scans carry an OCR layer, so per the standing rule
 * every shipped value was ALSO machine-read from the page images
 * (pages 547, 548, 652, 653, 655) - the machine read corrected
 * one OCR slip on the way (probable error "12 et 25 0/0", not
 * 23).
 *
 * WHAT THE PAPERS PRINT
 *  - The problem: Bloch's law E t = constant (Bloch 1885,
 *    Charpentier) cannot hold near threshold - a light exactly at
 *    the steady threshold would need infinite time, so the E(t)
 *    curve must be a hyperbola asymptotic to E = E0, not to the
 *    axis (their a-priori argument, sec. 1). The eye at the
 *    threshold of a brief flash behaves as a BALLISTIC
 *    galvanometer integrating the excitation.
 *  - The measurement: two purpose-built flash comparators (Rey's
 *    and Blondel's, described to the screw), 25 series over 17
 *    observers of all common eyesights, flash durations 1/1000 to
 *    3 s (a 1:3000 span), equalising two flashes at their common
 *    range limit; geometric means; probable relative error 12-25%
 *    (p. 547, machine-read).
 *  - The law (p. 548, machine-read - all four printed forms):
 *      (1) E t = E0 (0.21 + t) = E0 (a + t)
 *      (2) (E - E0) t = 0.21 E0
 *      (3) E / E0 = (0.21 + t) / t
 *      (4) t = 0.21 E0 / (E - E0)
 *    "la droite representative de Et coupe l'axe des abscisses a
 *    une distance representant 21/100 de seconde a gauche de
 *    l'origine" - the time constant a = 0.21 s, restated in the
 *    application paper's eq. (8) "(a = 0,21 environ)" and its
 *    conclusion ("une constante de temps, de 0,21 seconde
 *    environ"). Their own footnote keeps the honest general form
 *    (E - b E0) t = a E0 should later work refine either
 *    constant.
 *  - The equivalent fixed light (their eq. (5) road): a flash of
 *    duration t at intensity I ranges like a STEADY light of
 *    intensity I t / (a + t) - the reduction this module exports.
 *    Their own worked example (p. 648 footnote): doubling the
 *    duration of a t = 0.21 s flash gains only 33%, "au lieu de
 *    100 0/0" - a closed landmark the gate re-derives.
 *  - The ballistic integral for non-uniform flashes (p. 652,
 *    machine-read): range limit where
 *      (7) int_t1^t2 (E - E0) dt = a E0,
 *    equivalent fixed intensity
 *      (10) I'h = int I dt / (a + (t2 - t1))
 *    - the effective-intensity form signal optics still uses.
 *    They admit the integration only for flashes up to ~1 s
 *    (their own stated bound); the linear law itself is "bien
 *    serieusement verifiee entre 0 et 1 seconde".
 *  - Threshold documentation (p. 542 note + p. 652 note): the
 *    point-source minimum perceptible E0 is 0.5-0.6 x 10^-7 lux
 *    in laboratory darkness, ~10^-7 lux in open air (Reynaud/
 *    Allard lineage) - corroborating, not replacing, the theme's
 *    own Schaefer/Crumey threshold machinery.
 *
 * WHERE IT WIRES - the sprite Crumey gate carried a recorded
 * unmodelled hardening: the printed threshold is steady-state
 * while a sprite lives a few tens of ms. The printed reduction
 * closes it: the drawn transient's luminance enters the gate as
 * L x t/(a + t) (t the display lifetime inside the printed
 * "several-to-tens of milliseconds"), an 8x hardening at 30 ms -
 * the printed 10 MR halo stays a dark-sky object (4.7x the
 * extended threshold instead of 38x) and dies EARLIER into
 * twilight, which is exactly the printed lore. Stated reduction:
 * the 1911 experiments are point-source; the temporal-summation
 * constant is applied to the extended sprite unchanged (their
 * ballistic-integration argument is per-receptor and carries no
 * area term).
 *
 * WHERE IT DOES NOT WIRE (checked, documented):
 *  - meteors.js gates on a perception-probability table MEASURED
 *    ON REAL METEORS (visibleRateFactor) - the transient penalty
 *    is already inside the measurement; applying Blondel-Rey on
 *    top would count it twice.
 *  - lightning flashes and glints are drawn radiometrically with
 *    no threshold gate to harden (suprathreshold when drawn at
 *    all).
 *  - stars, planets, aurora, airglow are steady sources - the
 *    t -> infinity limit, factor 1 exactly.
 */

// The printed time constant (pp. 548, 652, 655 - machine-read).
export const BLONDEL_A_S = 0.21;
// The printed validity window: measured from 1/1000 s; the
// linear law "seriously verified" to 1 s (their own words), the
// ballistic integration admitted to ~1 s.
export const BLONDEL_T_MIN_S = 0.001;
export const BLONDEL_T_MAX_S = 1;
// Threshold documentation (lux, point source): laboratory pair
// and the open-air practical figure (p. 542 note).
export const E0_LAB_LUX = [0.5e-7, 0.6e-7];
export const E0_FIELD_LUX = 1e-7;

// The equivalent-fixed-light reduction: a uniform flash of
// duration tS ranges like a steady source dimmed by t/(a + t)
// (their eq. (3) inverted / eq. (5) road; eq. (10) with a
// uniform integrand). 0 duration -> 0 (no flash, no light);
// steady -> 1 exactly.
export function blondelReyFactor(tS) {
  if (!(tS > 0)) return 0;
  return tS / (BLONDEL_A_S + tS);
}

// The same law as the over-threshold requirement: a flash of
// duration tS must exceed the steady threshold by (a + t)/t
// (their printed form (3): E/E0 = 1 + 0.21/t).
export function blondelReyThreshold(tS) {
  if (!(tS > 0)) return Infinity;
  return (BLONDEL_A_S + tS) / tS;
}
