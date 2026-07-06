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
  decodeRed,
  dbzOfRain,
  dbzOfSnow,
  metresPerPixel,
  rainRate,
  snowRate,
  tileAt,
  windowStats
} from './radar.js';

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
  // synthetic tile: a rain block at 40 dBZ, a snow block at 30 dBZ,
  // an uncovered hole - windowStats must reproduce the analytic
  // means and fractions exactly.
  const data = new Uint8Array(256 * 256 * 4); // all alpha 0
  const put = (i, j, r) => {
    const k = (j * 256 + i) * 4;
    data[k] = r;
    data[k + 3] = 255;
  };
  for (let j = 100; j < 110; j++)
    for (let i = 100; i < 110; i++) put(i, j, 40 + 32); // rain 40 dBZ
  for (let j = 100; j < 110; j++)
    for (let i = 110; i < 120; i++) put(i, j, 128 + (30 + 32)); // snow 30 dBZ
  const s = windowStats(data, 109, 104, 10);
  const nRain = 10 * 10;
  const nSnow = 10 * 10;
  // window x 99..119, y 94..114: rain cells x100-109,y100-109 in
  // window: all 100; snow cells x110-119: all 100; covered 200 of
  // 21*21=441
  const expRain = (rainRate(40) * nRain) / 200;
  const expSnow = (snowRate(30) * nSnow) / 200;
  console.log(
    `REF windowStats: rain ${s.rain.toFixed(4)} (${expRain.toFixed(4)}),` +
      ` snow ${s.snow.toFixed(4)} (${expSnow.toFixed(4)}),` +
      ` coverage ${s.coverage.toFixed(4)} (${(200 / 441).toFixed(4)}),` +
      ` snowFrac ${s.snowFrac.toFixed(2)} (0.50)`
  );
}
