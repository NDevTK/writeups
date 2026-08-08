// Reference printer for the GVP eruption machinery (node
// gvp-reference.mjs). The law lives in gvp.js - the weekly
// report's own printed plume heights, the GVP list's own summit
// elevations - and these landmarks hold it on VENDORED REAL
// report items (30 July-5 August 2026):
//  - every printed height grammar parses to the hand-read value
//    ("7 km (23,000 ft) a.s.l.", "1.1 km above the summit",
//    "1-3 km above the summit" ranges, "300-1,600 m above the
//    crater rim" comma thousands)
//  - the plume-context guard EXCLUDES the report's ballistic
//    heights and exclusion radii (Fuego's "incandescent
//    material as high as 300 m above the summit" must not
//    become a plume bottom)
//  - the a.s.l./above-summit conversion is exact against the
//    vendored WFS elevations; no parsed height = no plume
//  - the apparent-altitude geometry drops d^2/2R exactly
import {
  apparentAltRad,
  GVP_R_E_KM,
  gvpPlainText,
  parseGvpItemHeights,
  parseGvpRss,
  plumeTopM
} from './gvp.js';
import {GVP_FIXTURE_ELEV, GVP_FIXTURE_ITEMS} from './gvp-fixture.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const byName = {};
for (const it of GVP_FIXTURE_ITEMS) {
  const name = it.title.split(' (')[0].trim();
  byName[name] = parseGvpItemHeights(it.desc);
}

// ---- 1. the printed heights parse exactly -----------------------
{
  const b = byName;
  check(
    'a.s.l. grammar with the feet parenthetical',
    b.Etna.aslM === 7000 && b.Etna.aboveM === null,
    `Etna: "Ash plumes rose to 7 km (23,000 ft) a.s.l." -> ` +
      `${b.Etna.aslM} m a.s.l., no above-summit reading - the INGV number ` +
      `carried verbatim`
  );
  check(
    'above-summit grammar, ballistics excluded',
    b.Fuego.aboveM === 1100 && b.Fuego.aslM === null,
    `Fuego: plumes "rose as high as 1.1 km above the summit" -> ` +
      `${b.Fuego.aboveM} m; the SAME item's "incandescent material as ` +
      `high as 300 m above the summit" is refused by the plume-context ` +
      `guard - ballistics are not plumes`
  );
  check(
    'range grammar keeps the upper end',
    b.Aira.aboveM === 3000,
    `Aira (Sakurajima): "ash plumes that rose 1-3 km above the summit" ` +
      `-> ${b.Aira.aboveM} m - the week's highest reported plume`
  );
  check(
    'comma thousands and "crater rim"',
    b.Reventador.aboveM === 1600 && b.Sabancaya.aboveM === 2500,
    `Reventador "300-1,600 m above the crater rim" -> ` +
      `${b.Reventador.aboveM} m; Sabancaya "2.5 km above the crater rim" ` +
      `-> ${b.Sabancaya.aboveM} m`
  );
  check(
    'both grammars in one item',
    b.Krakatau.aboveM === 100 && b.Krakatau.aslM === 1500,
    `Krakatau: white plumes "rising 100 m above the summit" AND the ` +
      `Darwin VAAC steam plume "1.5 km (5,000 ft) a.s.l." -> ` +
      `${b.Krakatau.aboveM} m above / ${b.Krakatau.aslM} m a.s.l. - both ` +
      `printed numbers carried`
  );
}

// ---- 2. the full-RSS parser and the top conversion --------------
{
  const xml = GVP_FIXTURE_ITEMS.map(
    (it) =>
      `<item><title>${it.title}</title><georss:point>${it.point}` +
      `</georss:point><description>${it.desc}</description></item>`
  ).join('\n');
  const rows = parseGvpRss(xml);
  const etna = rows.find((r) => r.name === 'Etna');
  const fuego = rows.find((r) => r.name === 'Fuego');
  const krak = rows.find((r) => r.name === 'Krakatau');
  const topEtna = plumeTopM(etna, GVP_FIXTURE_ELEV.Etna[2]);
  const topFuego = plumeTopM(fuego, GVP_FIXTURE_ELEV.Fuego[2]);
  const topKrak = plumeTopM(krak, GVP_FIXTURE_ELEV.Krakatau[2]);
  check(
    'RSS rows carry names, coordinates and heights',
    rows.length === 6 &&
      Math.abs(etna.lat - 37.748) < 1e-6 &&
      Math.abs(etna.lon - 14.999) < 1e-6,
    `${rows.length} items parsed; Etna at (${etna.lat}, ${etna.lon}) - ` +
      `the georss point verbatim`
  );
  check(
    'plume tops: a.s.l. stands, above-summit adds the GVP elevation',
    topEtna === 7000 &&
      topFuego === GVP_FIXTURE_ELEV.Fuego[2] + 1100 &&
      topKrak === 1500,
    `Etna top ${topEtna} m (printed a.s.l.); Fuego ${topFuego} m ` +
      `(${GVP_FIXTURE_ELEV.Fuego[2]} m summit + 1100 printed); Krakatau ` +
      `${topKrak} m (the VAAC a.s.l. beats the 100 m white puffs) - one ` +
      `institution's elevations under its own report`
  );
  check(
    'no height, no plume',
    plumeTopM({aboveM: null, aslM: null}, 3000) === null &&
      parseGvpItemHeights(
        'The Alert Level remained at 2 and the public ' +
          'was warned to stay 2 km away from the summit.'
      ).aboveM === null,
    `an item without a printed plume height draws nothing, and exclusion ` +
      `radii never parse - fails to data, never to style`
  );
}

// ---- 3. the horizon geometry ------------------------------------
{
  // A 7000 m top at 100 km from a 500 m observer: drop
  // d^2/2R = 0.785 km; alt = atan((6.5 - 0.785)/100).
  const a = apparentAltRad(100, 7000, 500);
  const want = Math.atan((6.5 - (100 * 100) / (2 * GVP_R_E_KM)) / 100);
  const sinks =
    apparentAltRad(350, 7000, 500) < 0 &&
    apparentAltRad(280, 7000, 500) > 0 &&
    apparentAltRad(30, 7000, 500) > a;
  check(
    'curvature drops the far plume exactly',
    Math.abs(a - want) < 1e-12 && sinks,
    `Etna-class top at 100 km: ${((a * 180) / Math.PI).toFixed(2)} deg ` +
      `above the horizontal (d^2/2R = 785 m already eaten); the same 7 km ` +
      `top still peeks past 280 km and sinks by 350 - the sprite pass's ` +
      `own drop, reused`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
