// Reference gate for crops.js (node crops-reference.mjs): the OSM
// crop/produce/trees tag -> research-grounded canopy colour, held to
// the real taginfo tag strings and the cited crop-colour behaviour.
//
//  - tag normalisation matches REAL OSM data: rapeseed is `rape`,
//    corn and maize both map, `;`/`,` multi-values take the first
//    token, produce/trees suffixes strip (olive_trees -> olive).
//  - the iconic colours are correct: rape flowering yellow, ripe
//    cereal gold, deep maize green, lavender purple, cotton bolls
//    white - and green is a dark desaturated canopy, never a bright
//    saturated green (chlorophyll absorbs blue+red).
//  - the seasonal shift only wears the hero colour inside the crop's
//    real Northern-Hemisphere window, and flips +6 months south.
//  - every table row is well-formed (triples in 0-1, valid months).
import {
  CROP_ALBEDO,
  CROP_ALIAS,
  CROP_GREEN,
  cropColor,
  cropAlbedoFromTags,
  normalizeCrop
} from './crops.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // Tag normalisation against the REAL taginfo strings: rapeseed is
  // `rape`; corn AND maize; `;`/`,` multi-value takes the first
  // token; produce/trees suffixes strip; case-insensitive; the
  // Portuguese sugarcane; unknown -> null.
  const ok =
    normalizeCrop('rape') === 'rape' &&
    normalizeCrop('Rapeseed') === 'rape' &&
    normalizeCrop('canola') === 'rape' &&
    normalizeCrop('corn') === 'maize' &&
    normalizeCrop('maize') === 'maize' &&
    normalizeCrop('wheat') === 'cereal' &&
    normalizeCrop('wheat;barley;sunflower') === 'cereal' &&
    normalizeCrop('grape') === 'grape' &&
    normalizeCrop('vineyard') === 'grape' &&
    normalizeCrop('olive_trees') === 'olive' &&
    normalizeCrop('coffea_plants') === 'coffee' &&
    normalizeCrop('oil_palms') === 'orchard' &&
    normalizeCrop('apple_trees') === 'orchard' &&
    normalizeCrop('cana-de-açúcar') === 'sugarcane' &&
    normalizeCrop('sugar_beet') === 'sugarbeet' &&
    normalizeCrop('   Lavender  ') === 'lavender' &&
    normalizeCrop('unobtanium') === null &&
    normalizeCrop('') === null &&
    normalizeCrop(undefined) === null;
  check(
    'tag normalisation',
    ok,
    'rape/canola->rape; corn+maize; wheat;barley;sunflower->cereal (first token); olive_trees->olive; coffea_plants->coffee; cana-de-açúcar->sugarcane; unknown/empty->null'
  );
}

{
  // The iconic colours (spectral-literature grounded). Green canopy
  // is DARK and desaturated (green channel leads, all channels low);
  // hero colours carry their signature.
  const rape = cropColor('rape', 4);
  const rapeYellow =
    rape[0] > 0.7 && rape[1] > 0.6 && rape[2] < 0.3 && rape[0] >= rape[1];
  const wheat = cropColor('cereal', 7);
  const wheatGold =
    wheat[0] > wheat[1] && wheat[1] > wheat[2] && wheat[2] < 0.4;
  const maize = cropColor('maize', 7); // July: green (hero is Sep-Oct)
  const maizeGreen =
    maize[1] > maize[0] && maize[1] > maize[2] && maize[1] < 0.4;
  const lav = cropColor('lavender', 6);
  const lavPurple = lav[2] > lav[0] && lav[2] > lav[1]; // blue leads = purple
  const cotton = cropColor('cotton', 9);
  const cottonWhite =
    cotton[0] > 0.6 &&
    cotton[1] > 0.6 &&
    cotton[2] > 0.6 &&
    Math.max(...cotton) - Math.min(...cotton) < 0.15;
  // a plain green crop: green channel dominates, everything low
  const tea = cropColor('tea', 6);
  const teaGreen = tea[1] > tea[0] && tea[1] > tea[2] && Math.max(...tea) < 0.4;
  check(
    'iconic canopy colours',
    rapeYellow &&
      wheatGold &&
      maizeGreen &&
      lavPurple &&
      cottonWhite &&
      teaGreen,
    `rape ${rape.join('/')} yellow; cereal ${wheat.join('/')} gold; maize green (off-window); lavender ${lav.join('/')} purple; cotton bolls white; tea a dark green`
  );
}

{
  // Seasonal shift: hero only inside the NH window; green outside;
  // southern hemisphere flips the window +6 months; no month -> green.
  const rapeApr = cropColor('rape', 4); // NH bloom
  const rapeAug = cropColor('rape', 8); // NH out of bloom
  const rapeNone = cropColor('rape', 0); // no month -> green
  const rapeSouthOct = cropColor('rape', 10, -35); // S. hemisphere bloom
  const rapeSouthApr = cropColor('rape', 4, -35); // S. hemisphere out
  const bloom = (c) => c[0] > 0.7 && c[2] < 0.3;
  const green = (c) => c[1] >= c[0] && c[2] < 0.2;
  const cerealJul = cropColor('cereal', 7); // gold
  const cerealMar = cropColor('cereal', 3); // green
  check(
    'seasonal + hemisphere window',
    bloom(rapeApr) &&
      green(rapeAug) &&
      green(rapeNone) &&
      bloom(rapeSouthOct) &&
      green(rapeSouthApr) &&
      cerealJul[0] > cerealJul[1] &&
      green(cerealMar),
    'rape yellow only Apr-May NH (Oct-Nov S); green otherwise and with no month; cereal gold Jul, green Mar'
  );
}

{
  // The tag-driven entry point landuse.js calls, and CROP_GREEN.
  const wheatField = cropAlbedoFromTags({crop: 'wheat'}, 7);
  const vineyard = cropAlbedoFromTags({crop: 'grape'}, 6);
  const orchard = cropAlbedoFromTags({produce: 'olive'}, 6);
  const tagless = cropAlbedoFromTags({}, 7);
  const unknown = cropAlbedoFromTags({crop: 'unobtanium'}, 7);
  check(
    'tag entry point',
    wheatField &&
      wheatField[0] > wheatField[2] &&
      vineyard &&
      vineyard[1] >= vineyard[2] &&
      orchard &&
      orchard[1] > orchard[2] &&
      tagless === null &&
      unknown === null &&
      CROP_GREEN.length === 3,
    'crop=wheat->gold, crop=grape->olive-green, produce=olive->grey-green; no/unknown tag->null (keep class albedo)'
  );
}

{
  // Table integrity: every row well-formed. Green triples in 0-1;
  // hero rows have a valid inclusive month window; aliases point at
  // real canonical keys.
  let ok = true;
  let worst = '';
  const triple = (t) =>
    Array.isArray(t) && t.length === 3 && t.every((v) => v >= 0 && v <= 1);
  for (const [k, e] of Object.entries(CROP_ALBEDO)) {
    let good = triple(e.green);
    if (e.hero)
      good =
        good &&
        triple(e.hero) &&
        e.months &&
        e.months.lo >= 1 &&
        e.months.lo <= 12 &&
        e.months.hi >= 1 &&
        e.months.hi <= 12;
    if (!good) {
      ok = false;
      worst = k;
    }
  }
  for (const [alias, canon] of Object.entries(CROP_ALIAS))
    if (!CROP_ALBEDO[canon]) {
      ok = false;
      worst = `alias ${alias}->${canon}`;
    }
  const nCrops = Object.keys(CROP_ALBEDO).length;
  const heroes = Object.values(CROP_ALBEDO).filter((e) => e.hero).length;
  check(
    'table integrity',
    ok && nCrops >= 15 && heroes >= 6,
    ok
      ? `${nCrops} crops (${heroes} with a seasonal hero colour); all aliases resolve to real keys`
      : `bad row ${worst}`
  );
}

process.exit(fail ? 1 : 0);
