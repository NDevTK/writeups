// Reference gate for forest.js (node forest-reference.mjs): the OSM
// leaf_type/leaf_cycle + the MEASURED phenophase -> canopy colour,
// held to the real taginfo tags and leaf-optics behaviour.
//
//  - kind resolution matches REAL OSM data: broadleaved(+deciduous) is
//    the seasonal case, needleleaved -> conifer, mixed, palm/broadleaf
//    evergreen stay green, leafless is sparse; a bare leaf_cycle alone
//    still resolves.
//  - the phenology is right: deciduous is dark green in summer, GOLD in
//    autumn (red leads), grey-brown bare in winter, brighter green in
//    spring; conifer/evergreen stay green year-round.
//  - NO CALENDAR: month and latitude are gone as arguments. The phase
//    comes from phenology.js's reading of the pixel's own MCD12Q2
//    amplitude crossings, and no measured phase means no season drawn
//    - the canopy holds summer green rather than being run through a
//    guessed year.
//  - every colour sits in the scene's dark forest-albedo space (all
//    channels well under 1), and green canopies are green-dominant.
import {
  FOREST_SRGB,
  SCENE_SCALE,
  forestAlbedoFromTags,
  forestColor,
  forestKind
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
  const summer = forestColor('broadleaved', 'deciduous', 'summer');
  const autumn = forestColor('broadleaved', 'deciduous', 'autumn');
  const winter = forestColor('broadleaved', 'deciduous', 'bare');
  const spring = forestColor('broadleaved', 'deciduous', 'spring');
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
  const cSummer = forestColor('needleleaved', '', 'summer');
  const cWinter = forestColor('needleleaved', '', 'bare');
  const evgAutumn = forestColor('broadleaved', 'evergreen', 'autumn');
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
  // No measured phase means the canopy is NOT run through a season.
  // This is the whole point of deleting the calendar: an unknown
  // season must look like summer green, not like a guessed October.
  const summer = forestColor('broadleaved', 'deciduous', 'summer');
  const unknown = forestColor('broadleaved', 'deciduous');
  const nulled = forestColor('broadleaved', 'deciduous', null);
  const conifUnknown = forestColor('needleleaved', '');
  const conifGreen = forestColor('needleleaved', '', 'summer');
  const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-12);
  // A month number in the phase slot must be INERT - the proof the
  // calendar is gone rather than merely unused, since every old call
  // site passed a month and a latitude there.
  const ok =
    same(unknown, summer) &&
    same(nulled, summer) &&
    same(conifUnknown, conifGreen) &&
    [1, 4, 7, 10].every((m) =>
      same(forestColor('broadleaved', 'deciduous', m), summer)
    );
  check(
    'no calendar behind it',
    ok,
    'forestColor takes (leafType, leafCycle, phase); with no measured phase the canopy holds summer green and the conifer holds its green, and passing a month number - 1, 4, 7, 10, what every old call site sent - moves nothing at all'
  );
}

{
  // The tag entry point + table integrity. leaf-tagged forests get a
  // colour; a tagless forest returns null (keeps the flat class
  // albedo); the SCENE_SCALE keeps everything in the dark albedo space.
  const tagged = forestAlbedoFromTags(
    {leaf_type: 'broadleaved', leaf_cycle: 'deciduous'},
    'autumn'
  );
  const tagless = forestAlbedoFromTags({}, 'autumn');
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

{
  // The alpine August that motivated the whole change. MODIS put the
  // Grindelwald pixel between maturity (14 Jul 2023) and senescence
  // (15 Sep), so August is 'summer' - while the Hopkins shift the
  // drawn canopies used to run had it 87% of the way into autumn
  // colour. The measured phase must reach the table's summer green
  // exactly, and must be nowhere near the autumn gold.
  const tags = {leaf_type: 'broadleaved', leaf_cycle: 'deciduous'};
  const measuredAug = forestAlbedoFromTags(tags, 'summer');
  const autumn = forestAlbedoFromTags(tags, 'autumn');
  const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-12);
  check(
    'the alpine August',
    same(measuredAug, forestColor('broadleaved', 'deciduous', 'summer')) &&
      greenLed(measuredAug) &&
      goldLed(autumn) &&
      !same(measuredAug, autumn),
    `a measured August canopy is ${measuredAug
      .map((v) => v.toFixed(2))
      .join('/')} - green-led summer, not the ${autumn
      .map((v) => v.toFixed(2))
      .join(
        '/'
      )} gold that a 4-days-per-degree calendar shift produced at 1034 m`
  );
}

process.exit(fail ? 1 : 0);
