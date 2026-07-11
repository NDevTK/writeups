// Reference gate for aircraft.js (node aircraft-reference.mjs): the ICAO
// type -> real airframe dimensions lookup and its category/default
// fallbacks, held to the published type dimensions.
//
//  - a known ICAO type resolves to its manufacturer wingspan/length and
//    body class (A320 narrowbody 35.8/37.57, A388 super-heavy quad).
//  - an unknown type falls back to the DO-260B emitter category (a
//    heavy A5 -> widebody), then to a narrowbody default.
//  - every table row is well-formed: sane metres, class in the set,
//    wake in L/M/H/J, engine count matching the class.
import {
  TYPE_DIMS,
  CLASS_ORDER,
  CATEGORY_FALLBACK,
  aircraftDims
} from './aircraft.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // Known ICAO types resolve to their published dimensions and class.
  const a320 = aircraftDims('A320');
  const a388 = aircraftDims('a388'); // case-insensitive
  const b789 = aircraftDims('B789');
  const c172 = aircraftDims('C172');
  const glf6 = aircraftDims('GLF6');
  check(
    'known type dimensions',
    a320.wingspanM === 35.8 &&
      a320.lengthM === 37.57 &&
      a320.cls === 'narrowbody' &&
      a320.engines === 2 &&
      a320.src === 'type' &&
      a388.cls === 'heavy_quad' &&
      a388.engines === 4 &&
      a388.wake === 'J' &&
      a388.wingspanM === 79.75 &&
      b789.cls === 'widebody' &&
      b789.wingspanM === 60.12 &&
      c172.cls === 'ga_piston' &&
      c172.engines === 1 &&
      glf6.cls === 'bizjet' &&
      glf6.mount === 'fuselage',
    `A320 -> 35.8/37.57 narrowbody 2eng; A388 -> heavy_quad 4eng super(J) 79.75m; B789 widebody; C172 ga 1eng; GLF6 bizjet aft-engine`
  );
}

{
  // Unknown type -> emitter-category fallback -> narrowbody default.
  const heavyCat = aircraftDims('ZZZZ', 'A5'); // heavy
  const lightCat = aircraftDims('', 'A1');
  const heli = aircraftDims('XXXX', 'A7');
  const def = aircraftDims('', '');
  check(
    'category + default fallback',
    heavyCat.cls === 'widebody' &&
      heavyCat.src === 'category' &&
      heavyCat.wingspanM === 64 &&
      heavyCat.engines === 2 &&
      lightCat.cls === 'ga_piston' &&
      heli.cls === 'helicopter' &&
      def.cls === 'narrowbody' &&
      def.src === 'default',
    `unknown+A5 -> widebody (category); +A1 -> ga; +A7 -> helicopter; nothing -> narrowbody default`
  );
}

{
  // Table integrity: every row well-formed, and class-specific engine
  // counts (heavy_quad = 4, GA/most helis = 1).
  let ok = true;
  let worst = '';
  const wakes = new Set(['L', 'M', 'H', 'J']);
  for (const [t, row] of Object.entries(TYPE_DIMS)) {
    const [w, l, e, m, c, wk] = row;
    const good =
      row.length === 6 &&
      w > 3 &&
      w < 82 &&
      l > 3 &&
      l < 82 &&
      e >= 1 &&
      e <= 4 &&
      (m === 'wing' || m === 'fuselage') &&
      CLASS_ORDER.includes(c) &&
      wakes.has(wk) &&
      (c !== 'heavy_quad' || e === 4) &&
      (c !== 'ga_piston' || e === 1);
    if (!good) {
      ok = false;
      worst = `${t} -> ${row.join('/')}`;
    }
  }
  const nTypes = Object.keys(TYPE_DIMS).length;
  const onlySuper =
    Object.entries(TYPE_DIMS).filter(([, r]) => r[5] === 'J').length === 1 &&
    TYPE_DIMS.A388[5] === 'J';
  check(
    'type table integrity',
    ok && nTypes >= 55 && onlySuper && CATEGORY_FALLBACK.A5[0] === 'widebody',
    ok
      ? `${nTypes} types well-formed (3-82 m, 1-4 engines, class/wake valid); A388 the only super(J)`
      : `bad row ${worst}`
  );
}

{
  // The A380 is the largest span, a light GA the smallest - the size
  // ordering the renderer relies on to make a heavy dwarf a Cessna.
  const spans = Object.values(TYPE_DIMS).map((r) => r[0]);
  check(
    'size ordering',
    Math.max(...spans) === 79.75 &&
      Math.min(...spans) < 11 &&
      aircraftDims('A388').wingspanM > 2 * aircraftDims('C172').wingspanM,
    `max span ${Math.max(...spans)} m (A380), min ${Math.min(...spans)} m; A380 span > 2x C172`
  );
}

process.exit(fail ? 1 : 0);
