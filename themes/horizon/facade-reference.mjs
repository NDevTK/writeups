// Reference gate for facade.js (node facade-reference.mjs): the OSM
// building:colour/roof:colour + building:material/roof:material tags ->
// a wall and roof colour, held to the real taginfo values.
//
//  - parseColour handles the REAL data: hex (#rgb, #rrggbb, either
//    case) and CSS/German colour names with separators stripped
//    (light_gray == lightgrey), unknown -> null.
//  - the material tones read right: brick reddish, slate dark, weathered
//    copper its verdigris green, glass blue-grey, plaster light.
//  - the tag entry points prefer the explicit colour, fall back to the
//    material, and return null for an untagged building (caller keeps
//    its hash tint / default roof).
import {
  MATERIAL_ROOF,
  MATERIAL_WALL,
  NAMED,
  parseColour,
  roofColour,
  wallColour
} from './facade.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const near = (a, b, t = 0.02) => Math.abs(a - b) < t;
const triple = (c) =>
  Array.isArray(c) && c.length === 3 && c.every((v) => v >= 0 && v <= 1);

{
  // parseColour on the real value forms: hex short/long/either case,
  // CSS + German names, separator-insensitive, unknown -> null.
  const white = parseColour('#ffffff');
  const shortHex = parseColour('#954'); // -> #995544
  const caseA = parseColour('#85552E');
  const caseB = parseColour('#85552e');
  const grey = parseColour('grey');
  const gray = parseColour('gray');
  const lg1 = parseColour('light_gray');
  const lg2 = parseColour('Light Grey');
  const german = parseColour('weiss');
  const ok =
    white[0] === 1 &&
    white[1] === 1 &&
    white[2] === 1 &&
    near(shortHex[0], 0x99 / 255) &&
    near(shortHex[1], 0x55 / 255) &&
    near(shortHex[2], 0x44 / 255) &&
    caseA[0] === caseB[0] &&
    caseA[1] === caseB[1] && // hex case-insensitive
    grey[0] === gray[0] && // grey == gray
    lg1[0] === lg2[0] && // separators + case stripped
    near(lg1[0], 0xd3 / 255) &&
    german[0] === 1 &&
    german[1] === 1 && // weiss == white
    parseColour('notacolour') === null &&
    parseColour('#xyz') === null &&
    parseColour('') === null &&
    parseColour(undefined) === null;
  check(
    'parseColour',
    ok,
    'hex #rgb/#rrggbb (either case), CSS + German names, separator/case-insensitive; unknown/empty -> null'
  );
}

{
  // Material tones read right. Brick reddish (r>g,b); slate dark and
  // near-neutral; copper the verdigris GREEN (g>r,g>b); glass blue-grey
  // (b>=r); plaster light (all high).
  const brick = MATERIAL_WALL.brick;
  const glass = MATERIAL_WALL.glass;
  const plaster = MATERIAL_WALL.plaster;
  const slate = MATERIAL_ROOF.slate;
  const copper = MATERIAL_ROOF.copper;
  const tiles = MATERIAL_ROOF.roof_tiles;
  const ok =
    brick[0] > brick[1] &&
    brick[0] > brick[2] &&
    glass[2] >= glass[0] &&
    plaster.every((v) => v > 0.65) &&
    slate.every((v) => v < 0.4) &&
    Math.max(...slate) - Math.min(...slate) < 0.1 &&
    copper[1] > copper[0] &&
    copper[1] > copper[2] && // verdigris green
    tiles[0] > tiles[1] &&
    tiles[0] > tiles[2]; // terracotta
  check(
    'material tones',
    ok,
    `brick ${brick.join('/')} red; slate dark neutral; copper ${copper.join(
      '/'
    )} verdigris green; roof_tiles terracotta; glass blue-grey; plaster light`
  );
}

{
  // The tag entry points. building:colour beats building:material;
  // material used when no explicit colour; untagged -> null. American
  // spelling (building:color) also accepted.
  const explicit = wallColour({'building:colour': '#eecfaf'});
  const byMaterial = wallColour({'building:material': 'brick'});
  const bothPrefersColour = wallColour({
    'building:colour': 'white',
    'building:material': 'brick'
  });
  const usSpelling = wallColour({'building:color': 'red'});
  const roofExplicit = roofColour({'roof:colour': 'red'});
  const roofMat = roofColour({'roof:material': 'copper'});
  const roofMultiWord = roofColour({'roof:material': 'metal sheet'});
  const tagless = wallColour({});
  const ok =
    triple(explicit) &&
    near(explicit[0], 0xee / 255) &&
    byMaterial[0] > byMaterial[1] && // brick red
    bothPrefersColour[0] === 1 &&
    bothPrefersColour[1] === 1 && // colour wins over material
    usSpelling[0] === 1 &&
    usSpelling[1] === 0 && // color= spelling, red
    roofExplicit[0] === 1 &&
    roofMat[1] > roofMat[0] && // copper green
    triple(roofMultiWord) && // "metal sheet" normalised
    tagless === null &&
    roofColour({}) === null;
  check(
    'wall/roof colour resolution',
    ok,
    'building:colour beats building:material; color= spelling; "metal sheet" normalised; untagged -> null'
  );
}

{
  // Table integrity: every material tone and every named colour is a
  // well-formed sRGB triple / parseable hex.
  let ok = true;
  let worst = '';
  for (const [k, c] of Object.entries(MATERIAL_WALL))
    if (!triple(c)) {
      ok = false;
      worst = `wall ${k}`;
    }
  for (const [k, c] of Object.entries(MATERIAL_ROOF))
    if (!triple(c)) {
      ok = false;
      worst = `roof ${k}`;
    }
  for (const [k, h] of Object.entries(NAMED))
    if (!triple(parseColour(h)) || !/^#[0-9a-f]{6}$/i.test(h)) {
      ok = false;
      worst = `named ${k}=${h}`;
    }
  const nW = Object.keys(MATERIAL_WALL).length;
  const nR = Object.keys(MATERIAL_ROOF).length;
  const nN = Object.keys(NAMED).length;
  check(
    'table integrity',
    ok && nW >= 20 && nR >= 20 && nN >= 30,
    ok
      ? `${nW} wall + ${nR} roof materials, ${nN} named colours, all valid`
      : `bad ${worst}`
  );
}

process.exit(fail ? 1 : 0);
