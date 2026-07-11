// Reference gate for forest.js (node forest-reference.mjs): the OSM
// leaf_type/leaf_cycle + month/latitude -> phenology-grounded canopy
// colour, held to the real taginfo tags and leaf-optics behaviour.
//
//  - kind resolution matches REAL OSM data: broadleaved(+deciduous) is
//    the seasonal case, needleleaved -> conifer, mixed, palm/broadleaf
//    evergreen stay green, leafless is sparse; a bare leaf_cycle alone
//    still resolves.
//  - the phenology is right: deciduous is dark green in summer, GOLD in
//    autumn (red leads), grey-brown bare in winter, brighter green in
//    spring; conifer/evergreen stay green year-round; the autumn window
//    shifts earlier at high latitude and +6 months in the south.
//  - every colour sits in the scene's dark forest-albedo space (all
//    channels well under 1), and green canopies are green-dominant.
import {
  FOREST_SRGB,
  SCENE_SCALE,
  forestAlbedoFromTags,
  forestColor,
  forestKind,
  phenophase
} from './forest.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const greenLed = (c) => c[1] > c[0] && c[1] > c[2];
const goldLed = (c) => c[0] > c[1] && c[1] > c[2]; // r>g>b
const inScene = (c) => c.every((v) => v >= 0 && v < 0.5); // dark albedo space

{
  // Kind resolution against the real leaf_type/leaf_cycle strings.
  const ok =
    forestKind('broadleaved', 'deciduous') === 'deciduous' &&
    forestKind('broadleaved', '') === 'deciduous' && // unspecified -> decid.
    forestKind('broadleaved', 'evergreen') === 'broadleaf_evergreen' &&
    forestKind('needleleaved', '') === 'conifer' &&
    forestKind('needleleaved', 'evergreen') === 'conifer' &&
    forestKind('needleleaved', 'deciduous') === 'deciduous' && // larch
    forestKind('mixed', '') === 'mixed' &&
    forestKind('palm', '') === 'broadleaf_evergreen' &&
    forestKind('leafless', '') === 'leafless' &&
    forestKind('', 'evergreen') === 'conifer' && // cycle alone
    forestKind('', 'deciduous') === 'deciduous' &&
    forestKind('', '') === null && // nothing usable
    forestKind('Broadleaved', 'Deciduous') === 'deciduous'; // case-insens.
  check(
    'leaf-type resolution',
    ok,
    'broadleaved(+decid/unspec)->deciduous, +evergreen->broadleaf_evergreen; needleleaved->conifer (larch->decid); mixed; palm->evergreen; leafless; cycle-only resolves; nothing->null'
  );
}

{
  // Deciduous phenology (mid-latitude temperate ~47N): dark green in
  // summer, GOLD in autumn, grey-brown bare in winter, green in spring.
  const lat = 47;
  const summer = forestColor('broadleaved', 'deciduous', 7, lat);
  const autumn = forestColor('broadleaved', 'deciduous', 10, lat);
  const winter = forestColor('broadleaved', 'deciduous', 1, lat);
  const spring = forestColor('broadleaved', 'deciduous', 4, lat);
  const ok =
    greenLed(summer) &&
    inScene(summer) &&
    goldLed(autumn) && // r>g>b = gold/orange
    autumn[0] > summer[0] && // autumn redder than summer
    inScene(autumn) &&
    winter[0] >= winter[1] && // bare: brown, not green-dominant
    spring[1] > summer[1] && // spring brighter green than summer
    greenLed(spring);
  check(
    'deciduous phenology',
    ok,
    `summer ${summer.map((v) => v.toFixed(2)).join('/')} green; autumn ${autumn
      .map((v) => v.toFixed(2))
      .join('/')} gold (r>g>b); winter brown; spring greener than summer`
  );
}

{
  // Conifer / evergreen stay green year-round (winter only duller);
  // broadleaf evergreen has no autumn gold.
  const cSummer = forestColor('needleleaved', '', 7, 47);
  const cWinter = forestColor('needleleaved', '', 1, 47);
  const evgAutumn = forestColor('broadleaved', 'evergreen', 10, 47);
  const ok =
    greenLed(cSummer) &&
    greenLed(cWinter) && // conifer green even in winter
    inScene(cSummer) &&
    greenLed(evgAutumn) && // evergreen broadleaf: still green in Oct
    !goldLed(evgAutumn);
  check(
    'evergreen year-round',
    ok,
    `conifer green summer AND winter; broadleaf-evergreen still green in October (no autumn gold)`
  );
}

{
  // Latitude & hemisphere: autumn comes earlier at high latitude, and
  // the whole calendar shifts +6 months in the southern hemisphere.
  const borealSep = phenophase(9, 62); // boreal: Sep is autumn
  const tempSep = phenophase(9, 47); // temperate: Sep still summer
  const tempOct = phenophase(10, 47); // temperate: Oct is autumn
  const southApr = phenophase(4, -45); // S. temperate: Apr = autumn
  const southOct = phenophase(10, -45); // S. temperate: Oct = spring/summer
  const ok =
    borealSep === 'autumn' &&
    tempSep === 'summer' &&
    tempOct === 'autumn' &&
    southApr === 'autumn' &&
    (southOct === 'spring' || southOct === 'summer');
  check(
    'latitude + hemisphere phenology',
    ok,
    'boreal autumn in Sep, temperate in Oct; southern hemisphere autumn in Apr, growing in Oct'
  );
}

{
  // The tag entry point + table integrity. leaf-tagged forests get a
  // colour; a tagless forest returns null (keeps the flat class
  // albedo); the SCENE_SCALE keeps everything in the dark albedo space.
  const tagged = forestAlbedoFromTags(
    {leaf_type: 'broadleaved', leaf_cycle: 'deciduous'},
    10,
    47
  );
  const tagless = forestAlbedoFromTags({}, 10, 47);
  let allDark = true;
  for (const t of Object.values(FOREST_SRGB))
    for (const c of Object.values(t))
      if (!(c.every((v) => v >= 0 && v <= 1) && c.length === 3))
        allDark = false;
  const ok =
    tagged &&
    goldLed(tagged) &&
    tagless === null &&
    allDark &&
    SCENE_SCALE > 0 &&
    SCENE_SCALE < 1;
  check(
    'tag entry + table',
    ok,
    `leaf_type=broadleaved+deciduous in Oct -> gold; tagless -> null; ${
      Object.keys(FOREST_SRGB).length
    } kinds, all sRGB well-formed; SCENE_SCALE ${SCENE_SCALE}`
  );
}

process.exit(fail ? 1 : 0);
