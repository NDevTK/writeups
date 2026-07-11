// Land colour: the diffuse body colour of a ground cell, as the CIE
// tristimulus of its vegetation/soil reflectance rho(lambda)
// (vegetation.js) seen under average daylight. This closes the chain
// from a measured vegetation index to a single linear-sRGB albedo the
// terrain shader can wear, so a cell's greenness is a physical
// consequence of its NDVI - the land twin of ocean-color.js.
//
// The colour machinery IS ocean-color.js's: the same CIE 1931 2 deg
// observer and D65 illuminant integrate rho(lambda), the same
// XYZ -> linear-sRGB matrix and gamut clip apply (the model lives
// once). Only the reflectance source differs - a soil/canopy mixture
// here, a Case-1 water reflectance there:
//   X = sum rho*Ed*xbar,  Y = sum rho*Ed*ybar,  Z = sum rho*Ed*zbar
// normalised by N = sum Ed*ybar, so Y is the cell's luminous
// reflectance (its albedo's luminance). rho is a surface reflectance,
// so - unlike the few-percent water body colour - a bright soil sits
// well inside the sRGB gamut.
//
// One global scalar, LAND_GAIN, calibrated once at REFERENCE_NDVI, ties
// this physical colour to the theme's tuned exposure: the terrain's
// hand-picked base grass albedo (terrain-tsl.js GRASS_MEAN). It is an
// exposure anchor, not physics - the hue, the saturation, and the
// brown-to-green progression with NDVI are entirely the endmember
// mixture's.

import {
  CIE_1931_2DEG,
  XYZ_TO_LINEAR_SRGB,
  luminance,
  xyzToLinearSRGB
} from './ocean-color.js';
import {mixedReflectanceAt, NDVI_SOIL, NDVI_VEG} from './vegetation.js';

// The terrain's tuned base grass albedo (terrain-tsl.js GRASS_MEAN, the
// mean of the grass0 ramp) - already a LINEAR albedo, so its luminance
// is the anchor target directly (no sRGB decode, unlike the water hex).
export const LEGACY_GRASS_ALBEDO = [0.14, 0.27, 0.065];
export const TARGET_LUMINANCE = luminance(LEGACY_GRASS_ALBEDO);

// A full grass canopy (Fr = 1) is the exposure-anchor cell - it is the
// NDVI at which the physical colour is scaled to the legacy grass
// luminance.
export const REFERENCE_NDVI = NDVI_VEG;

// Tristimulus of the D65-lit ground reflectance for a measured NDVI,
// normalised so a perfect diffuser gives Y = 1 (Y is then the cell's
// luminous reflectance / albedo luminance).
export function ndviToXYZ(ndvi) {
  let X = 0;
  let Y = 0;
  let Z = 0;
  let N = 0;
  for (const [nm, xb, yb, zb, ed] of CIE_1931_2DEG) {
    const r = mixedReflectanceAt(ndvi, nm);
    X += r * ed * xb;
    Y += r * ed * yb;
    Z += r * ed * zb;
    N += ed * yb;
  }
  return {X: X / N, Y: Y / N, Z: Z / N};
}

// CIE xy chromaticity of the land colour (hue/saturation only).
export function chromaticity(ndvi) {
  const {X, Y, Z} = ndviToXYZ(ndvi);
  const s = X + Y + Z;
  return {x: X / s, y: Y / s};
}

// The single exposure scalar: the physical ground colour at
// REFERENCE_NDVI scaled to the terrain's prior tuned grass luminance.
// Everything else - the hue and the brown-to-green progression - is the
// mixture's own.
export const LAND_GAIN =
  TARGET_LUMINANCE / luminance(xyzToLinearSRGB(ndviToXYZ(REFERENCE_NDVI)));

// The diffuse body colour for a measured NDVI, in the linear-sRGB
// working space three's Color/uniform expects. Returns [r, g, b].
export function landColorLinear(ndvi) {
  const rgb = xyzToLinearSRGB(ndviToXYZ(ndvi));
  return [rgb[0] * LAND_GAIN, rgb[1] * LAND_GAIN, rgb[2] * LAND_GAIN];
}

// Re-export the shared gamut transform and endmember NDVIs so callers
// (and the reference gate) have the land colour surface in one import.
export {XYZ_TO_LINEAR_SRGB, xyzToLinearSRGB, luminance, NDVI_SOIL, NDVI_VEG};
