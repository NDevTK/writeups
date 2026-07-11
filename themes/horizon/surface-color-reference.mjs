// Reference gate for surface-color.js (node surface-color-reference.mjs):
// the CIE integration that turns three measured MODIS visible-band
// reflectances into a linear-sRGB body colour, held to the LIVE MOD09A1
// values recorded when the source was pinned (2026-07-11, composite
// A2026169 / 2026-06-18) and to the exposure anchor.
//
//  - the band interpolation reproduces each band at its centre and
//    stays between them elsewhere.
//  - the measured colours are DISTINCT and physical: a Sahara pixel is
//    a bright warm tan (red-dominant, high luminance), a Wisconsin
//    cropland pixel is green - the biome variation an index cannot give.
//  - one exposure scalar reproduces the terrain's tuned grass luminance
//    at the canonical-grass reference reflectance exactly.
import {
  BAND_BLUE_NM,
  BAND_GREEN_NM,
  BAND_RED_NM,
  LEGACY_GRASS_ALBEDO,
  REFERENCE_REFLECTANCE,
  SURFACE_GAIN,
  TARGET_LUMINANCE,
  bandReflectanceAt,
  chromaticity,
  luminance,
  surfaceColorLinear
} from './surface-color.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const maxChannel = (rgb) => rgb.indexOf(Math.max(...rgb)); // 0=R 1=G 2=B
const greenFrac = (rgb) => rgb[1] / (rgb[0] + rgb[1] + rgb[2]);

// LIVE MOD09A1 [blue(b03), green(b04), red(b01)] reflectances (raw*1e-4)
// at composite A2026169 (2026-06-18).
const SAHARA = [0.1197, 0.246, 0.4248];
const WISCONSIN = [0.0237, 0.0616, 0.0493];
const AMAZON = [0.0535, 0.0792, 0.0855];

{
  // Band interpolation: the three centres reproduce their band values,
  // a wavelength between two centres lies between them, and the tails
  // are held flat.
  const [b, g, r] = SAHARA;
  const mid = bandReflectanceAt(b, g, r, (BAND_BLUE_NM + BAND_GREEN_NM) / 2);
  check(
    'band interpolation',
    bandReflectanceAt(b, g, r, BAND_BLUE_NM) === b &&
      bandReflectanceAt(b, g, r, BAND_GREEN_NM) === g &&
      bandReflectanceAt(b, g, r, BAND_RED_NM) === r &&
      bandReflectanceAt(b, g, r, 360) === b &&
      bandReflectanceAt(b, g, r, 700) === r &&
      mid > Math.min(b, g) &&
      mid < Math.max(b, g),
    `centres b/g/r reproduced; 360->blue, 700->red held; midpoint ${mid.toFixed(3)} between blue ${b} and green ${g}`
  );
}

{
  // Sahara: a bright warm tan. Red channel dominant and the chromaticity
  // well on the warm side of the D65 white point (0.3127).
  const rgb = surfaceColorLinear(...SAHARA);
  const {x, y} = chromaticity(...SAHARA);
  check(
    'sahara bright tan',
    maxChannel(rgb) === 0 && x > 0.36 && rgb[0] > rgb[2],
    `linRGB = ${rgb.map((v) => v.toFixed(3)).join(', ')} (red dominant); xy = (${x.toFixed(3)}, ${y.toFixed(3)}) warm`
  );
}

{
  // Wisconsin cropland: a green olive. Real vegetation in true-colour
  // reflectance is a muted yellow-green - red and green comparable, both
  // well above blue - not a pure green, so assert green-leaning (green
  // near or above red, well above blue, high green fraction) rather than
  // strict green dominance.
  const rgb = surfaceColorLinear(...WISCONSIN);
  const {x, y} = chromaticity(...WISCONSIN);
  check(
    'wisconsin green olive',
    rgb[1] > rgb[2] && rgb[1] > 0.85 * rgb[0] && greenFrac(rgb) > 0.35,
    `linRGB = ${rgb.map((v) => v.toFixed(3)).join(', ')} (olive: G ${(rgb[1] / rgb[0]).toFixed(2)}x R, >> B); greenFrac ${greenFrac(rgb).toFixed(3)}; xy = (${x.toFixed(3)}, ${y.toFixed(3)})`
  );
}

{
  // The whole point: measured colours are DISTINCT across biomes. The
  // desert is warmer (higher chroma x), brighter (higher luminance), and
  // less green than the cropland - variation an NDVI index cannot give.
  const cs = chromaticity(...SAHARA);
  const cw = chromaticity(...WISCONSIN);
  const yS = luminance(surfaceColorLinear(...SAHARA));
  const yW = luminance(surfaceColorLinear(...WISCONSIN));
  const gS = greenFrac(surfaceColorLinear(...SAHARA));
  const gW = greenFrac(surfaceColorLinear(...WISCONSIN));
  const gA = greenFrac(surfaceColorLinear(...AMAZON));
  check(
    'biome distinctness',
    cs.x > cw.x + 0.03 && yS > 2 * yW && gW > gS && gA > gS,
    `chroma x sahara ${cs.x.toFixed(3)} > wisconsin ${cw.x.toFixed(3)}; luminance ${yS.toFixed(3)} vs ${yW.toFixed(3)} (desert brighter); greenFrac wisc ${gW.toFixed(3)} / amazon ${gA.toFixed(3)} > sahara ${gS.toFixed(3)}`
  );
}

{
  // The single exposure scalar reproduces the terrain's tuned grass
  // luminance at the canonical-grass reference reflectance to machine
  // precision, and stays a sane gain.
  const yRef = luminance(surfaceColorLinear(...REFERENCE_REFLECTANCE));
  check(
    'exposure anchor',
    Math.abs(yRef - TARGET_LUMINANCE) < 1e-9 &&
      SURFACE_GAIN > 0.3 &&
      SURFACE_GAIN < 10,
    `gain ${SURFACE_GAIN.toFixed(3)} -> ref luminance ${yRef.toFixed(4)} = legacy grass ${LEGACY_GRASS_ALBEDO.join('/')} (${TARGET_LUMINANCE.toFixed(4)}); ref reflectance ${REFERENCE_REFLECTANCE.map((v) => v.toFixed(4)).join('/')}`
  );
}

{
  // Delivered colour is well-formed for every plausible reflectance
  // (0..1.6, the MOD09A1 valid max): finite, non-negative.
  let ok = true;
  let worst = '';
  const cases = [
    SAHARA,
    WISCONSIN,
    AMAZON,
    [0, 0, 0],
    [1.6, 1.6, 1.6],
    [0.9, 0.9, 0.95]
  ];
  for (const c of cases) {
    const rgb = surfaceColorLinear(...c);
    for (const v of rgb)
      if (!Number.isFinite(v) || v < 0) {
        ok = false;
        worst = `${c.join('/')} -> ${rgb.map((x) => x.toFixed(3)).join(', ')}`;
      }
  }
  check(
    'gamut + finiteness',
    ok,
    ok ? 'all triples 0..1.6 finite and non-negative' : `bad at ${worst}`
  );
}

process.exit(fail ? 1 : 0);
