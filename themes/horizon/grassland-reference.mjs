// Reference gate for grassland.js (node grassland-reference.mjs): the
// turf colour at a MEASURED phenophase, held to the ECOSTRESS
// dry-grass spectra.
//
//  - the growing season keeps the class's own green.
//  - a measured dormancy reaches the full warm straw (R>G>B, and
//    BRIGHTER than the green - the load-bearing measured fact), the
//    shoulder a milder warm blend between the two.
//  - NO CALENDAR: there is no month or latitude argument left. A pixel
//    with no measured cycle gets no seasonal modulation, because the
//    product not retrieving a cycle IS the measurement that the pixel
//    has no strong season. The old latitude month lists, the 26-40 deg
//    amplitude ramp and the 52 deg straw/olive split are gone.
import {GRASS_AUTUMN, GRASS_DORMANT, grassColor} from './grassland.js';

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
  // No measured phase means no season drawn - not a guessed one.
  // A month number in the phase slot must be INERT: that is the proof
  // the calendar is gone rather than merely unused, since every old
  // call site passed a month there.
  const ok =
    same(grassColor(BASE), BASE) &&
    same(grassColor(BASE, null), BASE) &&
    same(grassColor(BASE, 'green'), BASE) &&
    [1, 7, 10, 12].every((m) => same(grassColor(BASE, m), BASE));
  check(
    'no calendar behind it',
    ok,
    'grassColor takes (base, phase) only; an absent phase returns the class green untouched, and passing a month number - 1, 7, 10, 12, what every old call site sent - moves nothing at all'
  );
}

{
  // A measured dormancy is a real one, so it reaches the measured
  // cured-grass direction in full: red-led and brighter than green.
  const dormant = grassColor(BASE, 'dormant');
  const shoulder = grassColor(BASE, 'shoulder');
  // The measured direction is warm AND brighter - and brighter in
  // EVERY channel, green included: the ECOSTRESS dry-grass spectrum
  // rises ~14% blue / 21% green / 32% red against green grass's
  // ~4-11%, so cured turf does not darken its green, it lifts it.
  const ok =
    redLed(dormant) &&
    bright(dormant) > bright(BASE) &&
    dormant.every((v, i) => v > BASE[i]) &&
    !same(shoulder, BASE) &&
    !same(shoulder, dormant) &&
    Math.abs(shoulder[0] - BASE[0]) < Math.abs(dormant[0] - BASE[0]);
  check(
    'measured dormancy cures',
    ok,
    `dormant ${dormant
      .map((v) => v.toFixed(3))
      .join(
        '/'
      )} is warm straw (R>G>B) and brighter in every channel - the ECOSTRESS dry-grass direction, which lifts green rather than dropping it; the shoulder ${shoulder
      .map((v) => v.toFixed(3))
      .join('/')} sits between base and straw`
  );
}

{
  // The surviving targets are well-formed and warm. GRASS_OLIVE is
  // gone: it existed to soften a maritime winter that the latitude
  // calendar browned wrongly, and a measured dormancy needs no such
  // apology.
  const ok =
    redLed(GRASS_DORMANT) &&
    bright(GRASS_DORMANT) > bright(BASE) &&
    redLed(GRASS_AUTUMN) &&
    [GRASS_DORMANT, GRASS_AUTUMN].every(
      (c) => c.length === 3 && c.every((v) => v >= 0 && v <= 1)
    );
  check(
    'senescence targets',
    ok,
    `straw ${GRASS_DORMANT.join('/')} (R>G>B, bright); autumn shoulder ${GRASS_AUTUMN.join(
      '/'
    )}; the maritime-winter olive is deleted with the calendar that needed it`
  );
}

{
  // Every phase is stable and total: an unknown string must not
  // silently brown anything.
  const ok =
    same(grassColor(BASE, 'summer'), BASE) &&
    same(grassColor(BASE, ''), BASE) &&
    same(grassColor(BASE, 'green'), BASE);
  check(
    'unknown phases never brown',
    ok,
    'only the two phases with a measured meaning ("shoulder", "dormant") move the colour; anything else keeps the class green'
  );
}

process.exit(fail ? 1 : 0);
