// Reference gate for grassland.js (node grassland-reference.mjs): the
// month/latitude modulation of turf colour, held to grassland
// remote-sensing phenology (MODIS LSP; ECOSTRESS dry-grass spectra).
//
//  - the growing season keeps the class's own green; NO summer browning
//    in any band (the alpine-meadow guardrail).
//  - winter browning is LATITUDE-GRADED: a gentle olive dulling that
//    stays green-led in the maritime/mild temperate band, but the full
//    warm straw (R>G>B, brighter) in the continental/boreal band.
//  - amplitude ramps in above |lat| 26 deg; below it grass is
//    evergreen; no month keeps green; the hemisphere flips the calendar.
import {
  GRASS_AUTUMN,
  GRASS_DORMANT,
  GRASS_OLIVE,
  grassColor,
  grassPhase
} from './grassland.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// A representative meadow base green (landuse.js CLASS_ALBEDO.meadow).
const BASE = [0.13, 0.29, 0.06];
const greenLed = (c) => c[1] > c[0] && c[1] > c[2];
const redLed = (c) => c[0] > c[1] && c[1] >= c[2];
const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
const bright = (c) => c[0] + c[1] + c[2];

{
  // Summer stays the class green in EVERY band - the alpine-meadow
  // guardrail (no summer browning anywhere). Northern summer is July;
  // southern summer is January.
  const ok =
    same(grassColor(BASE, 7, 47), BASE) && // mid-temperate July
    same(grassColor(BASE, 7, 62), BASE) && // boreal July
    same(grassColor(BASE, 7, 34), BASE) && // warm July
    same(grassColor(BASE, 1, -45), BASE); // southern summer (Jan)
  check(
    'no summer browning',
    ok,
    'a July meadow stays the class green in every northern band; the southern summer (Jan) too - no Mediterranean-style summer browning fired by latitude alone'
  );
}

{
  // Winter is LATITUDE-GRADED. Maritime/mild temperate (47 deg): a
  // gentle olive dulling that is STILL green-led (not straw).
  // Continental/boreal (62 deg): the full warm straw, red-led and
  // brighter than the green. This is the key correction from the
  // phenology research - do not straw-brown an alpine winter meadow.
  const midWinter = grassColor(BASE, 1, 47);
  const borealWinter = grassColor(BASE, 1, 62);
  const summer = BASE;
  const ok =
    greenLed(midWinter) && // temperate winter stays green-olive
    !same(midWinter, summer) && // ...but is duller than summer
    midWinter[1] < summer[1] && // green channel drops
    redLed(borealWinter) && // continental winter is warm straw (R>G>B)
    bright(borealWinter) > bright(summer) && // ...and brighter (dry grass)
    borealWinter[0] > midWinter[0]; // continental browner than temperate
  check(
    'latitude-graded winter',
    ok,
    `mid-temperate Jan ${midWinter
      .map((v) => v.toFixed(2))
      .join('/')} green-olive; boreal Jan ${borealWinter
      .map((v) => v.toFixed(2))
      .join('/')} warm straw (R>G>B, brighter)`
  );
}

{
  // Phase windows & hemisphere: mid-temperate peak (Jul) green, Sep
  // senescence shoulder, Jan dormant; boreal Oct dormant; warm still
  // green in Oct; the southern hemisphere is dormant in Jul, green in
  // Jan; the tropics and no-month stay green.
  const ok =
    grassPhase(7, 47) === 'green' &&
    grassPhase(9, 47) === 'shoulder' && // Sep-Oct senescence
    grassPhase(1, 47) === 'dormant' &&
    grassPhase(10, 62) === 'dormant' && // boreal browns early
    grassPhase(10, 34) === 'green' && // warm still green
    grassPhase(7, -45) === 'dormant' && // southern winter
    grassPhase(1, -45) === 'green' && // southern summer
    same(grassColor(BASE, 0, 47), BASE) && // no month -> green
    same(grassColor(BASE, 1, 10), BASE); // tropics -> green even in Jan
  check(
    'phase windows + hemisphere',
    ok,
    'mid-temperate peak Jul / senescence Sep / dormant Jan; boreal dormant by Oct; warm green in Oct; southern winter in Jul; tropics + no-month stay green'
  );
}

{
  // The amplitude taper: no hard seam at the evergreen cutoff. At 26
  // deg the seasonal effect is zero (base); it ramps to full by 40 deg;
  // a mid-band latitude (33 deg) is partial.
  const at26 = grassColor(BASE, 1, 26);
  const at33 = grassColor(BASE, 1, 33);
  const at40 = grassColor(BASE, 1, 40);
  const ok =
    same(at26, BASE) && // evergreen at the cutoff
    !same(at33, BASE) && // partial in the ramp
    !same(at40, BASE) && // full by 40
    // 33 deg is a weaker shift than 40 deg (closer to base)
    Math.abs(at33[0] - BASE[0]) < Math.abs(at40[0] - BASE[0]);
  check(
    'amplitude taper',
    ok,
    'seasonal amplitude 0 at |lat| 26 deg (evergreen), partial at 33, full by 40 - no seam'
  );
}

{
  // The dormancy/shoulder targets are well-formed and warm (straw
  // red-led and brighter; olive still green-led; autumn between).
  const ok =
    redLed(GRASS_DORMANT) && // full straw warm
    bright(GRASS_DORMANT) > bright(BASE) && // and brighter than green
    greenLed(GRASS_OLIVE) && // olive still green-led (gentle)
    redLed(GRASS_AUTUMN) &&
    [GRASS_DORMANT, GRASS_OLIVE, GRASS_AUTUMN].every(
      (c) => c.length === 3 && c.every((v) => v >= 0 && v <= 1)
    );
  check(
    'senescence targets',
    ok,
    `straw ${GRASS_DORMANT.join('/')} (R>G>B, bright); olive ${GRASS_OLIVE.join(
      '/'
    )} (green-led); autumn ${GRASS_AUTUMN.join('/')}`
  );
}

process.exit(fail ? 1 : 0);
