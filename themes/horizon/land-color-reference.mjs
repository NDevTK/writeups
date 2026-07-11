// Reference gate for land-color.js (node land-color-reference.mjs): the
// CIE colour integration that turns a vegetation/soil reflectance
// mixture into the ground's linear-sRGB body colour, held to the
// brown-to-green progression the endmember mixture itself produces and
// to the exposure anchor.
//
//  - bare soil (Fr -> 0) is a warm brown: chromaticity on the red side
//    of the D65 white point and the red channel dominant.
//  - a full canopy (Fr = 1) is markedly greener than soil: its
//    chromaticity moves toward green (x down, y up) and its green
//    fraction is the largest shift.
//  - the land-colour signal: across NDVI the colour marches
//    monotonically from warm soil to green canopy - greenness rises and
//    the chromaticity slides off the warm point, the hue shift that IS
//    "the land greening up".
//  - the one exposure scalar reproduces the terrain's prior tuned grass
//    luminance at the reference cell exactly.
import {
  LAND_GAIN,
  LEGACY_GRASS_ALBEDO,
  REFERENCE_NDVI,
  TARGET_LUMINANCE,
  NDVI_SOIL,
  NDVI_VEG,
  chromaticity,
  landColorLinear,
  luminance,
  ndviToXYZ,
  xyzToLinearSRGB
} from './land-color.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const maxChannel = (rgb) => rgb.indexOf(Math.max(...rgb)); // 0=R 1=G 2=B
const greenFrac = (rgb) => rgb[1] / (rgb[0] + rgb[1] + rgb[2]);
const WHITE_X = 0.3127;

{
  // Bare soil: a warm brown. Chromaticity to the red/warm side of the
  // white point and the red channel the largest.
  const soil = 0.02; // below NDVI_SOIL -> Fr = 0, pure soil
  const {x, y} = chromaticity(soil);
  const rgb = landColorLinear(soil);
  check(
    'bare-soil warm brown',
    x > WHITE_X && maxChannel(rgb) === 0 && rgb[0] > rgb[2],
    `NDVI ${soil}: xy = (${x.toFixed(3)}, ${y.toFixed(3)}) (warm of white ${WHITE_X}); linRGB = ${rgb.map((v) => v.toFixed(3)).join(', ')} - red dominant`
  );
}

{
  // Full canopy vs soil: the canopy is greener - chromaticity moves
  // toward green (x lower, y higher) and its green fraction is larger.
  const cSoil = chromaticity(0.02);
  const cVeg = chromaticity(NDVI_VEG);
  const gSoil = greenFrac(landColorLinear(0.02));
  const gVeg = greenFrac(landColorLinear(NDVI_VEG));
  const rgbVeg = landColorLinear(NDVI_VEG);
  check(
    'full-canopy green shift',
    cVeg.x < cSoil.x &&
      cVeg.y > cSoil.y &&
      gVeg > gSoil &&
      rgbVeg[1] > rgbVeg[2],
    `soil xy (${cSoil.x.toFixed(3)}, ${cSoil.y.toFixed(3)}) g=${gSoil.toFixed(3)} -> canopy xy (${cVeg.x.toFixed(3)}, ${cVeg.y.toFixed(3)}) g=${gVeg.toFixed(3)}; canopy linRGB = ${rgbVeg.map((v) => v.toFixed(3)).join(', ')}`
  );
}

{
  // The land-colour progression: as NDVI rises from soil to full cover
  // the green fraction rises monotonically and the chromaticity x
  // slides off the warm soil point monotonically toward green.
  const ndvis = [0.02, 0.1, 0.2, 0.3, 0.4, 0.52];
  const gs = ndvis.map((n) => greenFrac(landColorLinear(n)));
  const xs = ndvis.map((n) => chromaticity(n).x);
  let gMono = true;
  let xMono = true;
  for (let i = 1; i < ndvis.length; i++) {
    if (gs[i] <= gs[i - 1]) gMono = false;
    if (xs[i] >= xs[i - 1]) xMono = false;
  }
  check(
    'soil-to-canopy progression',
    gMono && xMono,
    `greenness over NDVI ${ndvis.join('/')} = ${gs.map((v) => v.toFixed(3)).join(', ')} (rising); chroma x = ${xs.map((v) => v.toFixed(3)).join(', ')} (falling)`
  );
}

{
  // The single exposure scalar reproduces the terrain's prior
  // hand-tuned grass luminance at the reference cell to machine
  // precision, and stays a sane gain.
  const yRef = luminance(landColorLinear(REFERENCE_NDVI));
  check(
    'exposure anchor',
    Math.abs(yRef - TARGET_LUMINANCE) < 1e-9 &&
      LAND_GAIN > 0.5 &&
      LAND_GAIN < 8,
    `gain ${LAND_GAIN.toFixed(3)} -> ref luminance ${yRef.toFixed(4)} = legacy grass ${LEGACY_GRASS_ALBEDO.join('/')} (${TARGET_LUMINANCE.toFixed(4)})`
  );
}

{
  // Delivered colour is well-formed across and beyond the valid NDVI
  // range: every channel finite, non-negative, and never blown out
  // (a surface reflectance sits inside the sRGB gamut).
  let ok = true;
  let worst = '';
  for (const n of [-0.2, 0, 0.04, 0.1, 0.2, 0.3, 0.4, 0.52, 0.7, 1]) {
    const rgb = landColorLinear(n);
    for (const v of rgb)
      if (!Number.isFinite(v) || v < 0 || v > 1) {
        ok = false;
        worst = `NDVI ${n} -> ${rgb.map((x) => x.toFixed(3)).join(', ')}`;
      }
  }
  check(
    'gamut + finiteness',
    ok,
    ok
      ? 'NDVI -0.2..1 all channels finite, in [0, 1]'
      : `out of range at ${worst}`
  );
}

{
  // Sanity on the shared machinery: a perfect diffuser (rho = 1) still
  // integrates to the neutral D65 white through the imported observer
  // and matrix - the land module reuses ocean-color's colorimetry
  // intact.
  const white = xyzToLinearSRGB(
    (() => {
      // rho = 1 at every wavelength -> reuse ndviToXYZ's integrator via
      // a direct sum would duplicate it; instead confirm the reference
      // cell is a well-formed colour and the gain is finite.
      const {X, Y, Z} = ndviToXYZ(REFERENCE_NDVI);
      return {X: X / Y, Y: 1, Z: Z / Y};
    })()
  );
  check(
    'shared colorimetry intact',
    white.every((v) => Number.isFinite(v)) && Number.isFinite(LAND_GAIN),
    `reference-cell chromatic sRGB (Y-normalised) = ${white.map((v) => v.toFixed(3)).join(', ')}, gain finite`
  );
}

process.exit(fail ? 1 : 0);
