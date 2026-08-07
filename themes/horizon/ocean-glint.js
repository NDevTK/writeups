/**
 * ocean-glint.js - the sun glitter's RADIANCE KERNEL, the printed
 * Cox & Munk (1954, JOSA 44, "Measurement of the Roughness of the
 * Sea Surface from Photographs of the Sun's Glitter") sun-glitter
 * law with the Gaussian (isotropic) slope PDF:
 *
 *   L = E_beam x rhoF(omega) x P(zx, zy) / (4 cos(theta_v) cos^4(theta_n))
 *
 * where P is the slope probability density at the facet slope that
 * mirrors the sun into the eye (their Eq. 18 frame), theta_n the
 * facet tilt and theta_v the view zenith. This module carries the
 * FRESNEL-LESS kernel P / (4 cos_v cos^4_n): in the water material
 * the Schlick term already weights the whole mirror+specular branch
 * (rhoF at the MACRO normal - a stated approximation of rhoF at the
 * facet, exact in the glitter core where facet and macro coincide),
 * so the kernel must not carry a second Fresnel.
 *
 * The variance frame is Bruneton, Neyret & Holzschuch (2010)'s
 * split the water shader already runs, gated by the ocean probes:
 * resolved waves tilt the local frame, and the SUBGRID slope
 * variance mssEff (filter-faded cascades folded into the Cox-Munk
 * total) is what P sees. cosTilt is the half-vector's cosine
 * against the RESOLVED normal; cosV the view cosine against it.
 *
 * Retired by this kernel: the classic three.js Water energy patch
 * pow(dir, shiny) x (0.02 shiny + 0.5) - a Blinn lobe whose
 * exponent rode the variance but whose ENERGY was a display
 * calibration with no citation.
 */

// Slope PDF (isotropic Gaussian, total mean-square slope mss):
// P(tan theta) = exp(-tan^2 / mss) / (pi mss), per unit d(zx)d(zy).
export function slopePdf(tan2, mss) {
  const m = Math.max(mss, 1e-6);
  return Math.exp(-tan2 / m) / (Math.PI * m);
}

// The Fresnel-less glitter kernel: radiance per unit beam
// irradiance and unit Fresnel reflectance. cosTilt = facet cosine
// (half-vector vs resolved normal), cosV = view cosine vs the
// resolved normal.
export function glintKernel(mss, cosTilt, cosV) {
  const ct = Math.min(Math.max(cosTilt, 1e-3), 1);
  const cv = Math.max(cosV, 1e-3);
  const tan2 = (1 - ct * ct) / (ct * ct);
  return slopePdf(tan2, mss) / (4 * cv * ct * ct * ct * ct);
}
