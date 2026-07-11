// Surface colour: the diffuse body colour of a ground cell taken
// DIRECTLY from its measured visible reflectance, not inferred from an
// index. Where land-color.js imputes a colour from NDVI through a fixed
// soil/canopy mixture (one green for the whole planet), this reads the
// three measured MODIS visible bands for the cell and integrates them
// as a spectrum - so a desert wears its real bright tan, a rainforest
// its real deep green, a snowfield its real neutral, because those ARE
// the measured reflectances. The most direct land analogue of the sea:
// the ocean measures chlorophyll and models the colour; here the colour
// itself is the measurement.
//
// The three bands are MOD09A1 (Terra surface reflectance, 8-day, 500 m,
// atmospherically corrected) sur_refl_b03/b04/b01 at their instrument
// band centres. They are treated as spectral samples, joined
// piecewise-linearly and held flat past the end centres, and run
// through the SAME CIE 1931 2 deg observer + D65 illuminant + XYZ ->
// linear-sRGB machinery ocean-color.js uses (the model lives once).
// Caveat: MOD09A1 is raw surface reflectance, NOT the BRDF-normalised
// NBAR (MCD43A4 is not point-queryable on the ORNL host), so the colour
// carries some residual sun/view-angle dependence.
//
// One exposure scalar SURFACE_GAIN, calibrated at a canonical green
// grassland (vegetation.js GREEN_VEG sampled in the three bands), ties
// the measured colour to the terrain's tuned grass luminance - an
// exposure anchor only; the hue is entirely the measurement's.

import {
  CIE_1931_2DEG,
  XYZ_TO_LINEAR_SRGB,
  luminance,
  xyzToLinearSRGB
} from './ocean-color.js';
import {GREEN_VEG, sampleSpectrum} from './vegetation.js';
import {LEGACY_GRASS_ALBEDO, TARGET_LUMINANCE} from './land-color.js';

// MODIS land-band centres (nm), the instrument spec: sur_refl_b03
// (459-479), b04 (545-565), b01 (620-670).
export const BAND_BLUE_NM = 469;
export const BAND_GREEN_NM = 555;
export const BAND_RED_NM = 645;

// A visible reflectance spectrum from the three measured bands: the
// band centres are spectral samples, joined linearly and held flat
// beyond the blue/red centres (the CIE observer is small in the violet
// and deep red, so the clamped tails carry little colour).
export function bandReflectanceAt(blue, green, red, nm) {
  if (nm <= BAND_BLUE_NM) return blue;
  if (nm >= BAND_RED_NM) return red;
  if (nm <= BAND_GREEN_NM)
    return (
      blue +
      ((green - blue) * (nm - BAND_BLUE_NM)) / (BAND_GREEN_NM - BAND_BLUE_NM)
    );
  return (
    green +
    ((red - green) * (nm - BAND_GREEN_NM)) / (BAND_RED_NM - BAND_GREEN_NM)
  );
}

// Tristimulus of the D65-lit measured reflectance, normalised so a
// perfect diffuser gives Y = 1 (Y is then the cell's luminous
// reflectance / albedo luminance).
export function bandsToXYZ(blue, green, red) {
  let X = 0;
  let Y = 0;
  let Z = 0;
  let N = 0;
  for (const [nm, xb, yb, zb, ed] of CIE_1931_2DEG) {
    const r = bandReflectanceAt(blue, green, red, nm);
    X += r * ed * xb;
    Y += r * ed * yb;
    Z += r * ed * zb;
    N += ed * yb;
  }
  return {X: X / N, Y: Y / N, Z: Z / N};
}

// CIE xy chromaticity of the measured surface colour.
export function chromaticity(blue, green, red) {
  const {X, Y, Z} = bandsToXYZ(blue, green, red);
  const s = X + Y + Z;
  return {x: X / s, y: Y / s};
}

// The canonical green grassland, sampled in the three MODIS bands - the
// exposure-anchor reflectance. Using vegetation.js's GREEN_VEG ties
// this measured-colour anchor to the same grass the NDVI model uses.
export const REFERENCE_REFLECTANCE = [
  sampleSpectrum(GREEN_VEG, BAND_BLUE_NM),
  sampleSpectrum(GREEN_VEG, BAND_GREEN_NM),
  sampleSpectrum(GREEN_VEG, BAND_RED_NM)
];

// The single exposure scalar: the canonical grass's measured colour
// scaled to the terrain's tuned grass luminance. Everything else - the
// hue and how bright a desert is versus a forest - is the measurement's.
export const SURFACE_GAIN =
  TARGET_LUMINANCE /
  luminance(xyzToLinearSRGB(bandsToXYZ(...REFERENCE_REFLECTANCE)));

// The diffuse body colour for a measured [blue, green, red] reflectance
// triple, in the linear-sRGB working space three expects. Returns
// [r, g, b].
export function surfaceColorLinear(blue, green, red) {
  const rgb = xyzToLinearSRGB(bandsToXYZ(blue, green, red));
  return [rgb[0] * SURFACE_GAIN, rgb[1] * SURFACE_GAIN, rgb[2] * SURFACE_GAIN];
}

export {XYZ_TO_LINEAR_SRGB, luminance, LEGACY_GRASS_ALBEDO, TARGET_LUMINANCE};
