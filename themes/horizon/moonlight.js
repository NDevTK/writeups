/**
 * moonlight.js - the moonlight irradiance in the sky's own E0
 * units, from printed anchors and the gated phase curve. Gated by
 * moonlight-reference.mjs.
 *
 * The sky's radiometric frame drives every drawn radiance from a
 * unit solar irradiance (E0 = 1). Anything lit by the MOON needs
 * the moon's irradiance in that same unit, and until now no such
 * frame existed - the moon optics dome runs display gains instead.
 * This module states it from two printed values and physics the
 * repo already gates:
 *
 *  - NASA NSSDC Moon Fact Sheet (read from the archived page):
 *    "Mean values at opposition from Earth: Distance from Earth
 *    378,000 km, Apparent diameter 1896 seconds of arc, Apparent
 *    visual magnitude -12.74." Also printed there: geometric
 *    albedo 0.12, volumetric mean radius 1737.4 km.
 *  - NASA NSSDC Sun Fact Sheet (same family, read from the
 *    archived page): apparent V magnitude -26.74.
 *
 * Full-moon irradiance over solar irradiance is then EXACTLY
 * 10^(-(26.74 - 12.74)/2.5) = 10^-5.6 = 2.512e-6 at the printed
 * 378,000 km - no invented brightness anywhere. Phase scales it
 * by the disk-integrated Hapke curve the repo already ships and
 * gates against Rougier's observed curve (moonphase.js relPhase -
 * the SAME value the theme computes each frame as astro.moonRel),
 * and distance scales it by (378,000/d)^2 with the live ephemeris
 * distance. A lunar eclipse dims it by the un-immersed fraction
 * (1 - inUmbra) from the exact umbral geometry (eclipses.js) -
 * linear in the source, the same argument as the solar sunE;
 * penumbral dimming (a few percent) and the umbral copper glow
 * (~1e-4 of full, refracted light) are documented second-order
 * scope.
 *
 * Documented conventions: the printed V-band anchor serves all
 * three channels (the moon is nearly grey; per-channel lunar
 * albedo would need its own citation - same spirit as the
 * aureole's Q at 500 nm). The Hapke-integral CROSS-CHECK: the
 * shipped Helfenstein & Veverka parameters, integrated
 * absolutely over the disc, give E_full/E0 = 2.90e-6 at the mean
 * distance - within 16% of the printed anchor. The printed value
 * anchors (it is a measurement); the agreement is a gate
 * landmark showing the shipped photometry and the printed anchor
 * describe the same moon, untuned.
 */

import {hapkeR, relPhase, W_SS} from './moonphase.js';

// NASA NSSDC fact sheets (archived pages, read directly).
export const MOON_FULL_VMAG = -12.74; // at the printed opposition distance
export const MOON_OPPOSITION_KM = 378000;
export const SUN_VMAG = -26.74;
export const MOON_RADIUS_KM = 1737.4;
export const MOON_GEOMETRIC_ALBEDO = 0.12; // printed; cross-check only

// The printed anchor: full-moon irradiance per unit solar
// irradiance at 378,000 km. 10^-5.6 exactly.
export const E_FULL_RATIO = Math.pow(10, -(MOON_FULL_VMAG - SUN_VMAG) / 2.5);

/**
 * Moonlight irradiance in E0 units. `rel` is the disk-integrated
 * phase brightness relative to full (moonphase.js relPhase - the
 * theme passes its per-frame astro.moonRel so one evaluation
 * serves everything), `distKm` the live Earth-moon distance,
 * `unImmersed` the (1 - inUmbra) lunar-eclipse factor (1 outside
 * eclipses). Fails closed to 0 on any missing input - an unlit
 * moon lights nothing.
 */
export function moonIrradianceE0(rel, distKm, unImmersed = 1) {
  if (
    !Number.isFinite(rel) ||
    !Number.isFinite(distKm) ||
    !(rel > 0) ||
    !(distKm > 0)
  )
    return 0;
  const u = Number.isFinite(unImmersed)
    ? Math.min(Math.max(unImmersed, 0), 1)
    : 1;
  return E_FULL_RATIO * rel * (MOON_OPPOSITION_KM / distKm) ** 2 * u;
}

// The Hapke-integral absolute cross-check (gate use): the shipped
// disk-resolved photometry integrated over the visible disc,
// times the geometric (R/d)^2, with no anchor applied -
// E_full/E0 as the MODEL alone states it.
export function hapkeFullE0(N = 400) {
  const g = 0.01 * (Math.PI / 180);
  return (MOON_RADIUS_KM / MOON_OPPOSITION_KM) ** 2 * hapkeDiskIntegralIF(g, N);
}

// Disk-integrated bidirectional reflectance integral INT r dxdy
// over the unit projected disc (r = (w/4pi) * moonphase.hapkeR),
// which IS the geometric-albedo-like disk-integrated I/F at the
// given phase.
export function hapkeDiskIntegralIF(g, N = 400) {
  const sun = [Math.sin(g), 0, Math.cos(g)];
  let sum = 0;
  for (let iy = 0; iy < N; iy++) {
    for (let ix = 0; ix < N; ix++) {
      const x = ((ix + 0.5) / N) * 2 - 1;
      const y = ((iy + 0.5) / N) * 2 - 1;
      const rr = x * x + y * y;
      if (rr > 1) continue;
      const z = Math.sqrt(1 - rr);
      sum += hapkeR(x * sun[0] + z * sun[2], z, g);
    }
  }
  return (W_SS / (4 * Math.PI)) * sum * (2 / N) * (2 / N);
}

// Re-exported so consumers state phase through the same gated
// curve (one implementation).
export {relPhase};
