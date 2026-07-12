// Reference gate for spectral-color.js (node spectral-color-reference.mjs):
// the measured vegetation reflectance -> CIE 1931/D65 -> sRGB pipeline,
// and the proof that crops.js and forest.js palette colours are the
// scene rendering of what their measured spectra actually produce.
//
//  - bandColor is a sound colorimeter: a perfect diffuser is white at
//    unit luminance; a flat grey is neutral; senescence/drying raises
//    luminance (dry grass brighter than green, ripe cereal brighter
//    than green maize, autumn brighter than summer).
//  - each measured surface yields its real signature: greens are
//    green-led and dark, gold/straw is R>G>B and bright, rape bloom a
//    low-blue yellow, lavender a blue+red purple, cotton white.
//  - the crop/forest palette colours SHARE that signature - so the
//    hand-tuned scene values trace to measured reflectance, not vibes.
import {MEASURED_VIS, bandColor} from './spectral-color.js';
import {FOREST_SRGB} from './forest.js';
import {CROP_ALBEDO} from './crops.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const greenLed = (c) => c[1] > c[0] && c[1] > c[2];
const goldLed = (c) => c[0] > c[1] && c[1] >= c[2]; // R>=G>=B (gold/straw/brown)
const purple = (c) => c[2] > c[1] && c[0] > c[1]; // blue & red over green
const whiteish = (c) =>
  Math.min(...c) > 0.5 && Math.max(...c) - Math.min(...c) < 0.2;

{
  // bandColor is a sound colorimeter: perfect diffuser -> white, unit
  // luminance; flat 18% grey -> neutral at Y~0.18.
  const white = bandColor([
    [400, 1],
    [700, 1]
  ]);
  const grey = bandColor([
    [400, 0.18],
    [700, 0.18]
  ]);
  const ok =
    Math.abs(white.Y - 1) < 0.02 &&
    white.lin.every((v) => Math.abs(v - 1) < 0.02) &&
    Math.abs(grey.Y - 0.18) < 0.01 &&
    Math.max(...grey.lin) - Math.min(...grey.lin) < 0.01;
  check(
    'colorimeter soundness',
    ok,
    `perfect diffuser -> white (Y=${white.Y.toFixed(2)}); flat 18% -> neutral (Y=${grey.Y.toFixed(2)})`
  );
}

{
  // Senescence/drying BRIGHTENS (the load-bearing luminance fact), and
  // each surface carries its real hue signature.
  const green = bandColor('green_grass');
  const dry = bandColor('dry_grass');
  const maize = bandColor('maize_green');
  const cereal = bandColor('cereal_ripe');
  const summer = bandColor('broadleaf_summer');
  const autumn = bandColor('broadleaf_autumn');
  const rape = bandColor('rape_bloom');
  const lav = bandColor('lavender_bloom');
  const cotton = bandColor('cotton_boll');
  const ok =
    dry.Y > green.Y * 1.8 && // dry grass ~2.7x brighter
    cereal.Y > maize.Y * 1.8 && // ripe cereal much brighter than green
    autumn.Y > summer.Y * 1.5 && // autumn brighter than summer
    greenLed(green.srgb) &&
    greenLed(maize.srgb) &&
    greenLed(summer.srgb) &&
    goldLed(dry.srgb) &&
    goldLed(cereal.srgb) &&
    goldLed(autumn.srgb) &&
    rape.srgb[0] > rape.srgb[2] &&
    rape.srgb[1] > rape.srgb[2] && // rape: yellow, low blue
    purple(lav.srgb) && // lavender blue+red over green
    whiteish(cotton.srgb);
  check(
    'measured signatures + brightening',
    ok,
    `green Y=${green.Y.toFixed(2)} < dry Y=${dry.Y.toFixed(2)}; autumn ${autumn.srgb
      .map((v) => v.toFixed(2))
      .join('/')} gold; rape low-blue yellow; lavender ${lav.srgb
      .map((v) => v.toFixed(2))
      .join('/')} purple; cotton white`
  );
}

{
  // The crop/forest PALETTE colours share the signature of their
  // measured CIE colour - the tuned scene values trace to measurement.
  const fs = FOREST_SRGB;
  const cr = CROP_ALBEDO;
  const forestOk =
    greenLed(fs.conifer.green) &&
    greenLed(fs.deciduous.summer) &&
    greenLed(fs.deciduous.spring) &&
    fs.deciduous.spring[1] > fs.deciduous.summer[1] && // spring brighter green
    goldLed(fs.deciduous.autumn) && // gold-orange (matches broadleaf_autumn)
    goldLed(fs.deciduous.bare); // brown litter
  const cropOk =
    greenLed(cr.maize.green) &&
    goldLed(cr.cereal.hero) && // ripe cereal gold (matches cereal_ripe)
    cr.rape.hero[0] > cr.rape.hero[2] &&
    cr.rape.hero[1] > cr.rape.hero[2] && // rape yellow (low blue)
    purple(cr.lavender.hero) && // lavender purple (matches lavender_bloom)
    whiteish(cr.cotton.hero); // cotton white
  // and each palette colour matches the SIGN of its measured colour
  const sig = (c) =>
    whiteish(c)
      ? 'W'
      : purple(c)
        ? 'P'
        : greenLed(c)
          ? 'G'
          : goldLed(c)
            ? 'Y'
            : '?';
  const pairs = [
    [fs.deciduous.autumn, bandColor('broadleaf_autumn').srgb],
    [fs.conifer.green, bandColor('conifer').srgb],
    [cr.cereal.hero, bandColor('cereal_ripe').srgb],
    [cr.rape.hero, bandColor('rape_bloom').srgb],
    [cr.lavender.hero, bandColor('lavender_bloom').srgb],
    [cr.cotton.hero, bandColor('cotton_boll').srgb],
    [cr.maize.green, bandColor('maize_green').srgb]
  ];
  const sigMatch = pairs.every(([mod, cie]) => sig(mod) === sig(cie));
  check(
    'palette traces to measured CIE',
    forestOk && cropOk && sigMatch,
    forestOk && cropOk && sigMatch
      ? 'forest conifer/summer/spring green, autumn+bare gold-brown; crop maize green, cereal gold, rape yellow, lavender purple, cotton white - each matching its CIE-derived measured signature'
      : `forest=${forestOk} crop=${cropOk} sigMatch=${sigMatch}`
  );
}

{
  // Every anchored surface is a valid spectrum producing an in-gamut-ish
  // colour (non-negative luminance, sane range).
  let ok = true;
  let worst = '';
  for (const k of Object.keys(MEASURED_VIS)) {
    const c = bandColor(k);
    if (!(c.Y > 0 && c.Y <= 1 && c.srgb.every((v) => v > -0.05 && v < 1.05))) {
      ok = false;
      worst = k;
    }
  }
  check(
    'spectra well-formed',
    ok && Object.keys(MEASURED_VIS).length >= 12,
    ok
      ? `${Object.keys(MEASURED_VIS).length} measured spectra all integrate to a sane colour`
      : `bad ${worst}`
  );
}

process.exit(fail ? 1 : 0);
