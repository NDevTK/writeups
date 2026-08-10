/**
 * fleagle.js - the INFERIOR mirage as instrument: Fleagle 1950,
 * "The Optical Measurement of Lapse Rate" (Bull. AMS 31(2), 51-55,
 * READ IN FULL), with the persistence of its target licensed by
 * Baum 1951, "Note on the Theory of Super-Autoconvective Lapse
 * Rates Near the Ground" (J. Meteor. 8, 196-198, READ IN FULL).
 *
 * Fleagle's problem is the mirror of Lehn's: not "what inversion
 * hangs aloft" but "how hot is the air in the lowest metres,
 * where thermometers fail under radiation". His answer: the
 * apparent-minus-true elevation h of a target at range x reads
 * the mean lapse of the layer the ray skims, in closed form
 * (his Eq. 11):
 *
 *   2 h n / (x^2 (n-1)) = (1/T)(g/R + dT/dz) + (0.114/p) de/dz
 *
 * so h grows as x^2 - the same parabolic flat-earth frame as
 * Lehn's arcs - and the sign flips at dT/dz = -g/R: an object
 * appears LOWER than truth (the sinking that becomes the inferior
 * mirage) only when the lapse exceeds the AUTOCONVECTIVE rate,
 * his printed "34 C per km". The repo already carries this
 * constant twice (Lehn's g*beta 0.03413; the NZ gate's printed
 * hydrostatic exponent 0.03418); Fleagle's 34 is a third
 * independent printing of the same number.
 *
 * His moist-air refractivity (Eq. 3) is two-constant:
 *   n - 1 = A1 (p-e)/(R T) + A2 eps e/(R T),  A1 2.28, A2 3.25
 * (footnote: computed from the Handbook of Chemistry and Physics
 * 1947 indices), and the 0.114 in Eq. (11) is not a new number:
 * it is 1 - A2 eps / A1 exactly (his Eq. 7) - an internal
 * identity the gate holds. His printed equivalence "a temperature
 * lapse of 1 C/cm results in the same refraction as a vapor
 * pressure lapse of 32 mb/cm" is Eq. (8)'s coefficient ratio
 * p/(0.114 T) at standard conditions. His Eq. (12) earth
 * correction delta = r (1-cos(x/r))/cos(x/r) carries a printed
 * ladder (0.78 mm at 100 m ... 785 m at 100 km), and his Eq.
 * (13)/(14) say the ray's sampled layer is a QUARTER of h.
 *
 * Baum's note (Rayleigh 1916 via eddy coefficients) gives the
 * limiting stable lapse -dT/dz < gamma_auto + 27 pi^4 K eta T /
 * (4 rho g dz^4): the excess falls as the fourth power of layer
 * depth, so the thin films are printed-normal - his evaluations
 * (170 C/100 m across the lowest 10 m; 2100 C/100 m across 2 m)
 * are held as internal identities of his own Eq. (5).
 *
 * The RETRIEVAL (fleagleFitFilm) is the corpus's Morrish-strategy
 * pattern on Fleagle's geometry: a two-segment surface family
 * (film lapse gammaFilm over depth filmM, background lapse gamma
 * above, anchored at the eye), fitted to a ground-based
 * short-range transfer characteristic by optical residuals, with
 * the forward march shared with the Lehn machinery
 * (lehnForwardTC). Degeneracy guards mirror the 133rd's lessons:
 * the film must be at least as deep as Fleagle's own sampled
 * quarter-layer scale, and a film shallower than the fold-probed
 * span's floor resolution declines.
 */

import {lehnForwardTC} from './lehn.js';

/** His footnote constants (Handbook 1947), in units where
 * n - 1 = A * rho with rho in kg/m^3 and A in 1e-4 m^3/kg. */
export const FLEAGLE_A1 = 2.28;
export const FLEAGLE_A2 = 3.25;
/** Molecular-weight ratio water/dry air (his eps). */
export const FLEAGLE_EPS = 0.622;
/** g/R: his printed "34 C per km" threshold - the autoconvective
 * lapse rate, K per m. */
export const AUTOCONVECTIVE_K_PER_M = 9.80665 / 287.053;

/** His Eq. (3): two-constant moist refractivity. tK kelvin,
 * pPa/ePa pascals; R = 287.053 J/(kg K). */
export function fleagleN1({tK, pPa, ePa = 0}) {
  const R = 287.053;
  return (
    (FLEAGLE_A1 * 1e-4 * (pPa - ePa)) / (R * tK) +
    (FLEAGLE_A2 * 1e-4 * FLEAGLE_EPS * ePa) / (R * tK)
  );
}

/** The humidity coefficient of his Eq. (7)/(11): 1 - A2 eps/A1
 * (he prints it rounded to 0.114). */
export function fleagleHumidityCoeff() {
  return 1 - (FLEAGLE_A2 * FLEAGLE_EPS) / FLEAGLE_A1;
}

/**
 * His Eq. (11), solved for h: the apparent-minus-true height of a
 * target at range xM through a uniform-gradient layer. n1 = n - 1
 * is supplied by the caller (his two-constant form or the repo's
 * Ciddor - the equation is geometry, not refractivity).
 * dTdz in K/m, dedz in Pa/m; pPa pascals.
 */
export function fleagleEq11H(xM, {tK, pPa, n1, dTdzKpM, dedzPaPerM = 0}) {
  const n = 1 + n1;
  return (
    ((xM * xM * n1) / (2 * n)) *
    ((1 / tK) * (AUTOCONVECTIVE_K_PER_M + dTdzKpM) +
      (fleagleHumidityCoeff() / pPa) * dedzPaPerM)
  );
}

/** His Eq. (12): the sea-level correction for earth curvature at
 * range xM (exact form, not the parabola). */
export function fleagleEq12Delta(xM, rM = 6371000) {
  const c = Math.cos(xM / rM);
  return (rM * (1 - c)) / c;
}

/** His Eq. (13): the thickness of the layer the ray samples, given
 * h and x; Eq. (14) is the h << x limit y -> h/4. */
export function fleagleEq13Y(hM, xM) {
  return hM / (2 * (1 + Math.sqrt(1 + (hM * hM) / (xM * xM))));
}

/**
 * Baum's Eq. (5) excess term: the amount by which the limiting
 * stable lapse exceeds the autoconvective rate for a layer of
 * depth dzM, with eddy conductivity KM2S (m^2/s) and eddy
 * viscosity etaKgMS (kg/(m s)) - his 27 pi^4 K eta T /
 * (4 rho g dz^4), returned in K/m.
 */
export function baumExcessKpM({KM2S, etaKgMS, tK, rhoKgM3, dzM}) {
  const pi4 = Math.PI ** 4;
  return (27 * pi4 * KM2S * etaKgMS * tK) / (4 * rhoKgM3 * 9.80665 * dzM ** 4);
}

/**
 * THE FILM FIT (Fleagle's instrument as the corpus builds
 * instruments): from a ground-based short-range transfer
 * characteristic alone - obs {alphas, zAt} at the object plane
 * distM, the eye height (his telescope class: Johnson & Roberts
 * observed at 175 cm), the eye-level temperature and surface
 * pressure - fit the two-segment surface family
 *
 *   t(z) = anchor + gammaFilm * z            for z <= filmM
 *          anchor + gammaFilm*filmM + gamma*(z - filmM)  above
 *
 * (anchored so t(eyeM) = TzeC), by TC residuals through the
 * shared forward march. Guards, each a lesson made code:
 *  - the film must be deeper than half a metre (a balloon's own
 *    first-row resolution class) - slivers decline;
 *  - the film must be STEEPER than the background (gammaFilm <
 *    gamma - 0.005 K/m); a fit that needs no film declines
 *    (|gammaFilm| exceeding autoconvective is the physical
 *    regime, but the guard is the family shape, not the
 *    threshold - the closure against the balloon referees);
 *  - the film may not claim deeper than the fold-probed span top
 *    spanHiM (the heights the fold rays actually fly).
 */
export function fleagleFitFilm(
  obs,
  {eyeM, distM, TzeC, p0Pa = 101325, spanHiM, topM = 3000}
) {
  const use = [];
  for (let i = 0; i < obs.alphas.length; i++)
    if (Number.isFinite(obs.zAt[i])) use.push(i);
  if (use.length < 12) return null;
  const alphas = use.map((i) => obs.alphas[i]);
  const zObs = use.map((i) => obs.zAt[i]);
  const nodesOf = (gF, hF, g) => {
    const raw = (z) => (z <= hF ? gF * z : gF * hF + g * (z - hF));
    const off = TzeC - raw(eyeM);
    const hM = [0, hF, topM];
    return {hM, tC: hM.map((z) => raw(z) + off)};
  };
  const cost = (gF, hF, g) => {
    if (hF < 0.5 || hF > spanHiM || hF > 60) return Infinity;
    if (!(gF < g - 0.005)) return Infinity;
    if (gF < -8 || g < -0.02 || g > 0.02) return Infinity;
    const f = lehnForwardTC(nodesOf(gF, hF, g), {
      eyeM,
      distM,
      alphas,
      p0Pa
    });
    let s2 = 0;
    let n = 0;
    for (let k = 0; k < alphas.length; k++) {
      if (!Number.isFinite(f.zAt[k])) {
        s2 += 30 * 30;
        n++;
        continue;
      }
      const d = f.zAt[k] - zObs[k];
      s2 += d * d;
      n++;
    }
    return Math.sqrt(s2 / n);
  };
  let best = null;
  for (const hF0 of [2, 6, 15, 35]) {
    for (const gF0 of [-0.08, -0.3, -1.2]) {
      let p = [gF0, hF0, -0.0065];
      let c = cost(...p);
      const steps = [Math.abs(gF0) / 2, hF0 / 2, 0.003];
      for (let round = 0; round < 26; round++) {
        let moved = false;
        for (let j = 0; j < 3; j++) {
          for (const dir of [1, -1]) {
            const q = p.slice();
            q[j] += dir * steps[j];
            const cq = cost(...q);
            if (cq < c) {
              p = q;
              c = cq;
              moved = true;
            }
          }
        }
        if (!moved) for (let j = 0; j < 3; j++) steps[j] *= 0.55;
        if (steps[1] < 0.05) break;
      }
      if (!best || c < best.c) best = {p, c};
    }
  }
  if (!best || !Number.isFinite(best.c) || best.c > 25) return null;
  const [gF, hF, g] = best.p;
  // A film that barely differs from the background is no film -
  // and a claim SMALLER than the closure referee's own half-kelvin
  // tolerance floor is unfalsifiable against the balloon (measured:
  // a 0.35-K "film" passed the floor while the balloon mildly
  // warmed). Claims below the floor decline rather than invent.
  if ((g - gF) * hF < 0.5) return null;
  return {
    nodes: nodesOf(gF, hF, g),
    params: {gammaFilmKpM: gF, filmM: hF, gammaKpM: g},
    tcRmsM: best.c
  };
}
