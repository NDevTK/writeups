/**
 * pollen.js - the pollen corona: on big birch days the measured
 * bloom rings the sun through the SAME certified Airy law the
 * cloud coronae ride. Gated by pollen-reference.mjs.
 *
 * THE PRIMARY - Filioglou et al. 2023 (EGUsphere/AMT, CC BY,
 * READ): a three-lidar closure study of birch and pine pollen
 * whose mass conversion PRINTS the grain sizes - "particle
 * diameter of 25 and 75 um and a particle density of 0.8 and
 * 0.4 g cm-3 for birch and pine pollen, respectively ...
 * (Gregory, 1961)" - the classic aerobiology numbers, carried
 * verbatim. (The elliptical-corona subtlety - pollen air sacs
 * making vertically elliptical rings - lives in Applied Optics
 * papers this environment cannot open; the ellipticity is
 * documented UNDRAWN, the circular first-order corona is what
 * the printed diameter gives.)
 *
 * THE FEED - open-meteo's air-quality API (keyless, CORS):
 * hourly pollen concentrations in grains/m3 by species, and the
 * forecast API's boundary_layer_height for the column depth -
 * both the same measured-model family the theme already rides.
 * Only BIRCH is drawn: it is the classic corona species and the
 * one with an open printed diameter; other species contribute
 * no display for want of one - fails to data, never to style.
 *
 * THE OPTICAL DEPTH - every factor measured or printed:
 *   tau = N [grains/m3] x Qext x pi (d/2)^2 x BLH [m],
 * Qext = 2 exactly (the extinction paradox - the printed
 * large-sphere limit the corona family already rides; a 25 um
 * grain at x ~ 140 sits deep in it). A large birch day
 * (20,000 grains/m3 under a 1.5 km boundary layer) gives
 * tau ~ 0.03 - a faint ring, exactly as real pollen coronae
 * are; the display amplitude is the shipped coronaAmp(tau),
 * nothing scaled by hand.
 */

import {airyPattern, CHANNEL_UM} from './cloud-corona.js';

// Printed grain properties (Filioglou 2023 <- Gregory 1961).
export const BIRCH_D_UM = 25;
export const BIRCH_RHO_G_CM3 = 0.8;
export const PINE_D_UM = 75; // printed; undrawn (not in the feed)
export const PINE_RHO_G_CM3 = 0.4;
// The extinction paradox limit (van de Hulst; the corona
// machinery's own printed large-sphere Qext).
export const POLLEN_QEXT = 2;

// The measured column's optical depth. Zero unless both the
// concentration and the boundary-layer depth are real.
export function pollenTau(grainsM3, blhM, dUm = BIRCH_D_UM) {
  if (!(grainsM3 > 0) || !(blhM > 0)) return 0;
  const r = (dUm * 1e-6) / 2;
  return grainsM3 * POLLEN_QEXT * Math.PI * r * r * blhM;
}

// The corona pattern at the printed birch diameter: a radial
// RGB LUT over 0..POLLEN_MAX_DEG from the sun, per theme
// channel, straight from the SHIPPED certified airyPattern -
// the same sr^-1 normalisation family the glory LUT carries,
// ready for coronaAmp x transmittance x exposure.
export const POLLEN_TEX_W = 160;
export const POLLEN_MAX_DEG = 5;
export function buildPollenLUT(dUm = BIRCH_D_UM) {
  const data = new Float32Array(POLLEN_TEX_W * 4);
  const thetas = [];
  for (let i = 0; i < POLLEN_TEX_W; i++) {
    thetas.push((((i + 0.5) / POLLEN_TEX_W) * POLLEN_MAX_DEG * Math.PI) / 180);
  }
  for (let c = 0; c < 3; c++) {
    const pat = airyPattern(dUm, CHANNEL_UM[c], thetas);
    for (let i = 0; i < POLLEN_TEX_W; i++) data[i * 4 + c] = pat[i];
  }
  for (let i = 0; i < POLLEN_TEX_W; i++) data[i * 4 + 3] = 1;
  return {data, w: POLLEN_TEX_W, maxDeg: POLLEN_MAX_DEG};
}

// The first bright ring (deg from the sun) at a wavelength: the
// glory pass's dark-gap-then-climb finder on the Airy curve.
export function pollenRingDeg(dUm, lamUm, gMaxDeg = POLLEN_MAX_DEG) {
  const n = 800;
  const thetas = [];
  for (let i = 1; i <= n; i++)
    thetas.push(((gMaxDeg * i) / n) * (Math.PI / 180));
  const v = airyPattern(dUm, lamUm, thetas);
  let runMin = v[0];
  let climbing = false;
  let peakV = -1;
  let peakG = null;
  for (let i = 1; i < n; i++) {
    const g = (gMaxDeg * (i + 1)) / n;
    if (!climbing) {
      if (v[i] < runMin) runMin = v[i];
      else if (v[i] > runMin * 1.35) climbing = true;
    }
    if (climbing) {
      if (v[i] > peakV) {
        peakV = v[i];
        peakG = g;
      } else if (v[i] < peakV * 0.9) return peakG;
    }
  }
  return peakG;
}
