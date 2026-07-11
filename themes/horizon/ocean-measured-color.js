// Measured ocean colour: the sea's body colour taken DIRECTLY from the
// satellite's measured remote-sensing reflectance Rrs(lambda), not
// modelled from chlorophyll. Where ocean-color.js runs the Morel &
// Maritorena Case-1 model - which assumes chlorophyll is the ONLY thing
// colouring the water and so misreads turbid Case-2 coasts (sediment,
// CDOM) - this reads the six measured visible Rrs bands for the cell and
// integrates them, so a Mississippi-plume pixel wears its real muddy
// green and a subtropical gyre its real deep blue, because those ARE the
// measured spectra. The exact sea-side analogue of surface-color.js:
// the land colour became the measurement; now the sea colour does too.
//
// The bands are ESA Ocean Colour CCI v6.0 (merged multi-sensor, daily)
// Rrs_412/443/490/510/560/665 (sr^-1) at their centres. They are
// treated as spectral samples, joined piecewise-linearly and held flat
// past the end centres, and run through the SAME CIE 1931 2 deg observer
// + D65 + XYZ -> linear-sRGB machinery ocean-color.js uses (the model
// lives once). Rrs is a radiance reflectance in sr^-1; only its spectral
// SHAPE sets the hue, and the one exposure scalar SEA_GAIN - calibrated
// so a clear gyre reproduces the sea's tuned deep-blue luminance - fixes
// the absolute level, exactly as BODY_GAIN does for the Morel colour.
//
// Caveat: CCI is science-quality with ~6-month latency (not near-real-
// time); Horizon.html uses this as the PRIMARY colour and falls back to
// the NRT Morel colour (ocean-color.js) on a cloud-gap null.

import {
  CIE_1931_2DEG,
  XYZ_TO_LINEAR_SRGB,
  LEGACY_WATER_HEX,
  TARGET_LUMINANCE,
  luminance,
  xyzToLinearSRGB
} from './ocean-color.js';

// ESA CCI Rrs band centres (nm).
export const RRS_BANDS_NM = [412, 443, 490, 510, 560, 665];

// Rrs at a wavelength from the six measured bands: piecewise-linear
// between band centres, held flat below 412 and above 665 (the CIE
// observer is small in the near-UV and deep red, and clear water's Rrs
// is already near zero past 665).
export function rrsAt(rrs, nm) {
  const B = RRS_BANDS_NM;
  if (nm <= B[0]) return rrs[0];
  if (nm >= B[B.length - 1]) return rrs[rrs.length - 1];
  let i = 0;
  while (i < B.length - 2 && nm > B[i + 1]) i++;
  const t = (nm - B[i]) / (B[i + 1] - B[i]);
  return rrs[i] + (rrs[i + 1] - rrs[i]) * t;
}

// Tristimulus of the D65-lit Rrs spectrum, normalised so a flat unit
// spectrum gives Y = 1 (Y is then proportional to the water's luminous
// reflectance; the absolute scale is set by SEA_GAIN).
export function rrsToXYZ(rrs) {
  let X = 0;
  let Y = 0;
  let Z = 0;
  let N = 0;
  for (const [nm, xb, yb, zb, ed] of CIE_1931_2DEG) {
    const r = rrsAt(rrs, nm);
    X += r * ed * xb;
    Y += r * ed * yb;
    Z += r * ed * zb;
    N += ed * yb;
  }
  return {X: X / N, Y: Y / N, Z: Z / N};
}

// CIE xy chromaticity of the measured sea colour.
export function chromaticity(rrs) {
  const {X, Y, Z} = rrsToXYZ(rrs);
  const s = X + Y + Z;
  return {x: X / s, y: Y / s};
}

// A canonical clear oligotrophic gyre Rrs spectrum (ESA CCI, 25N 140W,
// 2025-12-31) - the exposure-anchor reflectance: the clearest blue
// water, tied to the sea's tuned deep-blue luminance.
export const REFERENCE_RRS = [
  0.0095712375, 0.008005913, 0.0055653746, 0.0032426326, 0.0012882876,
  1.4774383e-4
];

// The single exposure scalar: the clear-gyre measured colour scaled to
// the sea's prior tuned body luminance (LEGACY_WATER_HEX, via
// ocean-color.js). The hue and how much greener a turbid coast is than
// the gyre are entirely the measurement's.
export const SEA_GAIN =
  TARGET_LUMINANCE / luminance(xyzToLinearSRGB(rrsToXYZ(REFERENCE_RRS)));

// The measured sea body colour for a six-band Rrs spectrum, in the
// linear-sRGB working space three expects. Returns [r, g, b].
export function seaColorLinear(rrs) {
  const rgb = xyzToLinearSRGB(rrsToXYZ(rrs));
  return [rgb[0] * SEA_GAIN, rgb[1] * SEA_GAIN, rgb[2] * SEA_GAIN];
}

export {XYZ_TO_LINEAR_SRGB, luminance, LEGACY_WATER_HEX, TARGET_LUMINANCE};
