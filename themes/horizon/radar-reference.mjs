// Reference printer for the radar decode and Z-R inversion (node
// radar-reference.mjs). The formulas live once in radar.js; this
// checks them against the textbook landmarks:
//  - Marshall-Palmer round-trips to machine precision, and the
//    canonical rates hold: 23 dBZ ~ 1 mm/h drizzle boundary,
//    40 dBZ ~ 11.5 mm/h heavy rain, 50 dBZ ~ 48.6 mm/h downpour
//  - Sekhon-Srivastava round-trips; at equal dBZ snow reads a DRIER
//    liquid-equivalent rate than Marshall-Palmer rain (the steeper
//    exponent) - mistaking one for the other overstates snowfall
//  - the RainViewer red-channel decode: dBZ range, snow bit
//  - Web Mercator: (0, 0) sits at the exact centre of the tile grid
//    and Greenwich (51.48, 0) lands in the documented z8 tile
import {
  DBZ_MIN,
  PALETTE_COLOURS,
  UNIVERSAL_BLUE_FLOOR_DBZ,
  UNIVERSAL_BLUE_RAIN,
  UNIVERSAL_BLUE_SNOW,
  decodePixel,
  decodeRed,
  decodeUniversalBlue,
  detectScheme,
  dbzOfRain,
  dbzOfSnow,
  metresPerPixel,
  rainRate,
  snowRate,
  tileAt,
  windowStats
} from './radar.js';

let fail = false;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail = true;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

{
  let worst = 0;
  for (const R of [0.1, 1, 5, 25, 100]) {
    worst = Math.max(worst, Math.abs(rainRate(dbzOfRain(R)) - R) / R);
    worst = Math.max(worst, Math.abs(snowRate(dbzOfSnow(R)) - R) / R);
  }
  console.log(`REF Z-R round-trip: worst rel err = ${worst.toExponential(1)}`);
  console.log(
    `REF MP rates: 23 dBZ ${rainRate(23).toFixed(2)} mm/h (~1),` +
      ` 40 dBZ ${rainRate(40).toFixed(1)} (~11.5),` +
      ` 50 dBZ ${rainRate(50).toFixed(1)} (~48.6)`
  );
  console.log(
    `REF SS snow: 25 dBZ ${snowRate(25).toFixed(2)} mm/h liq eq` +
      ` (rain at 25 dBZ ${rainRate(25).toFixed(2)})`
  );
}

{
  const a = decodeRed(0);
  const b = decodeRed(127);
  const c = decodeRed(128 + 60);
  console.log(
    `REF decode: R=0 -> ${a.dbz} dBZ (min -32), R=127 -> ${b.dbz} (max 95),` +
      ` R=188 -> ${c.dbz} dBZ snow=${c.snow}`
  );
}

{
  const o = tileAt(0, 0, 8);
  const g = tileAt(51.48, 0, 8);
  console.log(
    `REF mercator: (0,0)@z8 tile ${o.tx}/${o.ty} px ${o.px},${o.py}` +
      ` (128/128 at 0,0); Greenwich tile ${g.tx}/${g.ty}` +
      ` (128/85 expected), m/px ${metresPerPixel(51.48, 8).toFixed(0)}`
  );
}

{
  // synthetic grey-scheme tile: a rain block at 40 dBZ, a snow block
  // at 30 dBZ, the rest transparent (no echo) - windowStats reads
  // the scheme from the pixels and gives the AREAL means over every
  // covered pixel (no mask: all 441 covered), the echo fraction, the
  // pixel at the point and the window's maximum.
  const data = new Uint8Array(256 * 256 * 4); // all alpha 0
  const put = (i, j, r) => {
    const k = (j * 256 + i) * 4;
    data[k] = data[k + 1] = data[k + 2] = r;
    data[k + 3] = 255;
  };
  for (let j = 100; j < 110; j++)
    for (let i = 100; i < 110; i++) put(i, j, 40 + 32); // rain 40 dBZ
  for (let j = 100; j < 110; j++)
    for (let i = 110; i < 120; i++) put(i, j, 128 + (30 + 32)); // snow 30 dBZ
  const s = windowStats(data, 109, 104, 10);
  // window x 99..119, y 94..114 = 441 px: rain cells x100-109,
  // y100-109 all inside (100), snow cells x110-119 (100)
  const expRain = (rainRate(40) * 100) / 441;
  const expSnow = (snowRate(30) * 100) / 441;
  check(
    'THE GREY WINDOW reads its scheme from the pixels and means over the ground',
    s.scheme === 'bw' &&
      near(s.rain, expRain, 1e-12) &&
      near(s.snow, expSnow, 1e-12) &&
      s.coverage === 1 &&
      near(s.echoFrac, 200 / 441, 1e-12) &&
      near(s.snowFrac, 0.5, 1e-12) &&
      s.here && !s.here.snow && s.here.dbz === 40 && near(s.here.rate, rainRate(40), 1e-12) &&
      near(s.maxRate, rainRate(40), 1e-12),
    `scheme ${s.scheme}; rain ${s.rain.toFixed(4)} mm/h (${expRain.toFixed(4)} = 40 dBZ over 100 of 441 px), snow ${s.snow.toFixed(4)} (${expSnow.toFixed(4)}), ` +
      `coverage ${s.coverage} without a mask, echo ${s.echoFrac.toFixed(4)} (${(200 / 441).toFixed(4)}), snow fraction of the echoes ${s.snowFrac.toFixed(2)}, ` +
      `the point's own pixel ${s.here.dbz} dBZ rain ${s.here.rate.toFixed(2)} mm/h, the window's maximum ${s.maxRate.toFixed(2)}`
  );
}

// ---- THE PALETTE (164th pass) ------------------------------------
// MEASURED 2026-09-06: RainViewer's public tiles serve the Universal
// Blue palette whatever colour index the URL asks (nine indices, one
// identical tile), and "Maximum zoom level is 7" - a zoom-8 tile is a
// "Zoom Level Not Supported" placeholder drawn in black, white and
// grey. The theme had read the grey dBZ rule on zoom-8 placeholders:
// the placeholder's white (255) was snow at 95 dBZ, its black no
// echo. The palette is vendored from RainViewer's own table and
// decoded by colour.
{
  const hex = (h) => h.toLowerCase();
  const rain24 = hex(UNIVERSAL_BLUE_RAIN[24 + 32]);
  const snow24 = hex(UNIVERSAL_BLUE_SNOW[24 + 32]);
  const blue = decodeUniversalBlue(0, 127, 180, 255);
  const sand = decodeUniversalBlue(222, 208, 151, 190);
  const faint = decodeUniversalBlue(130, 123, 105, 73);
  const light = decodeUniversalBlue(136, 221, 238, 255);
  const off = decodeUniversalBlue(2, 128, 181, 255);
  const snow = decodeUniversalBlue(0x65, 0xa5, 0xff, 255);
  const clear = decodeUniversalBlue(0, 0, 0, 0);
  const oldBlue = decodeRed(0);
  const oldLight = decodeRed(136);
  const oldWhite = decodeRed(255);
  const rainSet = new Set(UNIVERSAL_BLUE_RAIN.filter((h) => h !== '00000000'));
  const snowSet = new Set(UNIVERSAL_BLUE_SNOW.filter((h) => h !== '00000000'));
  let overlap = 0;
  for (const h of rainSet) if (snowSet.has(h)) overlap++;
  check(
    "THE PALETTE decodes RainViewer's Universal Blue by colour, the grey rule misread it",
    UNIVERSAL_BLUE_RAIN.length === 128 &&
      UNIVERSAL_BLUE_SNOW.length === 128 &&
      rain24 === '007fb4ff' &&
      snow24 === '65a5ffff' &&
      UNIVERSAL_BLUE_FLOOR_DBZ === -10 &&
      PALETTE_COLOURS === 163 &&
      overlap === 0 &&
      blue.dbz === 24 && !blue.snow && blue.exact &&
      sand.dbz === 14 && !sand.snow && sand.exact &&
      faint.dbz === 0 && faint.exact &&
      light.dbz === 15 && !light.snow &&
      off.dbz === 24 && !off.exact && near(off.dist, Math.sqrt(6), 1e-9) &&
      snow.dbz === 24 && snow.snow && snow.exact &&
      clear.dbz === DBZ_MIN && clear.exact &&
      oldBlue.dbz === -32 &&
      oldLight.snow && oldLight.dbz === -24 &&
      oldWhite.snow && oldWhite.dbz === 95,
    `128 rain and 128 snow rows for -32..95 dBZ (24 dBZ rain ${rain24}, snow ${snow24}); the palette's floor ${UNIVERSAL_BLUE_FLOOR_DBZ} dBZ, ` +
      `${PALETTE_COLOURS} colours, the rain and snow ramps sharing none; the measured tile's (0,127,180) is ${blue.dbz} dBZ, its sand (222,208,151,190) ${sand.dbz} dBZ, ` +
      `the faint (130,123,105,73) ${faint.dbz} dBZ, the light blue (136,221,238) ${light.dbz} dBZ; a colour off by one in three channels takes the nearest, ${off.dbz} dBZ at distance ${off.dist.toFixed(2)}; ` +
      `(101,165,255) is the SNOW ramp's ${snow.dbz} dBZ; transparent is ${clear.dbz} dBZ (no echo) - the grey rule had read that blue as ${oldBlue.dbz} dBZ, ` +
      `the light blue as snow at ${oldLight.dbz} dBZ and the placeholder's white as snow at ${oldWhite.dbz} dBZ`
  );
}

// ---- THE SCHEME AND THE MASK ----------------------------------------
{
  const grey = new Uint8Array(256 * 256 * 4);
  const blue = new Uint8Array(256 * 256 * 4);
  const empty = new Uint8Array(256 * 256 * 4);
  const mask = new Uint8Array(256 * 256 * 4); // all transparent: covered everywhere
  const paint = (t, i, j, rgba) => {
    const k = (j * 256 + i) * 4;
    t[k] = rgba[0];
    t[k + 1] = rgba[1];
    t[k + 2] = rgba[2];
    t[k + 3] = rgba[3];
  };
  for (let j = 100; j < 110; j++)
    for (let i = 100; i < 110; i++) {
      paint(grey, i, j, [72, 72, 72, 255]); // 40 dBZ grey
      paint(blue, i, j, [0, 127, 180, 255]); // 24 dBZ blue
    }
  for (let j = 100; j < 110; j++)
    for (let i = 110; i < 120; i++) paint(blue, i, j, [0x65, 0xa5, 0xff, 255]); // 24 dBZ snow
  // the mask's black over the eastern half of the window: no radar there
  for (let j = 90; j < 120; j++) for (let i = 110; i < 130; i++) paint(mask, i, j, [0, 0, 0, 255]);
  const sg = windowStats(grey, 104, 104, 10);
  const sb = windowStats(blue, 109, 104, 10);
  const sm = windowStats(blue, 109, 104, 10, {mask});
  const sOut = windowStats(blue, 115, 104, 10, {mask});
  const px24 = decodePixel(blue, (104 * 256 + 104) * 4, 'universal-blue');
  // the window x 99..119, y 94..114: 441 px; the mask blacks x 110..119 (10 columns) x 21 rows = 210 -> 231 covered
  check(
    'THE SCHEME is told from the pixels and THE MASK bounds the ground the radar sees',
    detectScheme(grey) === 'bw' &&
      detectScheme(blue) === 'universal-blue' &&
      detectScheme(empty) === null &&
      sg.scheme === 'bw' && sg.here.dbz === 40 &&
      sb.scheme === 'universal-blue' && px24.dbz === 24 &&
      near(sb.rain, (rainRate(24) * 100) / 441, 1e-12) &&
      near(sb.snow, (snowRate(24) * 100) / 441, 1e-12) &&
      sb.coverage === 1 &&
      sm.covered === 231 && near(sm.coverage, 231 / 441, 1e-12) &&
      near(sm.rain, (rainRate(24) * 100) / 231, 1e-12) &&
      sm.snow === 0 &&
      near(sm.echoFrac, 100 / 231, 1e-12) &&
      sm.here && sm.here.dbz === 24 &&
      sOut.here === null && near(sOut.coverage, 105 / 441, 1e-12),
    `a grey tile is 'bw' (40 dBZ read at the point), a blue one 'universal-blue' (${px24.dbz} dBZ), an empty one null; without a mask 441 px are covered: ` +
      `rain ${sb.rain.toFixed(4)} mm/h (24 dBZ over 100 px), snow ${sb.snow.toFixed(4)} (the snow ramp's 100 px); the mask's black over the eastern ten columns leaves ${sm.covered} covered ` +
      `(coverage ${sm.coverage.toFixed(3)}): the snow block is out of the radar's sight (snow 0), rain ${sm.rain.toFixed(4)} over the 231 seen, echo ${sm.echoFrac.toFixed(4)}; ` +
      `a point under the mask's black has no pixel of its own (here null) while its window still reports the ${sOut.covered} of 441 px the radar sees`
  );
}
process.exit(fail ? 1 : 0);
