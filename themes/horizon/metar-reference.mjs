// Reference printer for the METAR layer (node metar-reference.mjs).
// Aerodromes measure the sky, so the gate holds the conversion of
// their report into the theme's cloud model to the published
// conventions, against fixtures captured LIVE from
// aviationweather.gov (2026-07-07):
//  - FMH-1 okta bands (band midpoints; sky-clear codes exactly 0,
//    indefinite ceiling exactly 8)
//  - WMO etage boundaries with exact foot/mile conversions
//  - the Glasgow fixture (FEW013 BKN025 OVC030) decodes to the
//    exact measured deck: 100% low cover, base 396.24 m
//  - nearest-fresh station selection: staleness disqualifies
//    before distance ranks
import {
  ETAGE_LOW_M,
  ETAGE_MID_M,
  FT_M,
  METAR_MAX_AGE_S,
  SM_M,
  coverFraction,
  etageCovers,
  normalizeMetars,
  pickStation,
  visibilityM
} from './metar.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // FMH-1 ch. 9: FEW 1-2, SCT 3-4, BKN 5-7, OVC 8 oktas - band
  // midpoints as fractions; every sky-clear code exactly 0; VV
  // (indefinite ceiling) exactly 8/8; unknown code -> null.
  check(
    'okta convention',
    coverFraction('FEW') === 1.5 / 8 &&
      coverFraction('SCT') === 3.5 / 8 &&
      coverFraction('BKN') === 6 / 8 &&
      coverFraction('OVC') === 1 &&
      coverFraction('VV') === 1 &&
      ['CAVOK', 'CLR', 'SKC', 'NCD', 'NSC'].every(
        (c) => coverFraction(c) === 0
      ) &&
      coverFraction('???') === null,
    `FEW ${(1.5 / 8) * 100}% · SCT ${(3.5 / 8) * 100}% · BKN 75% · OVC/VV 100% · five clear codes 0 · unknown null`
  );
}

{
  // Visibility: exact statute mile; the API's "N+" floor; junk null.
  check(
    'visibility',
    visibilityM(2.5) === 2.5 * 1609.344 &&
      visibilityM('6+') === 6 * 1609.344 &&
      visibilityM('10+') === 16093.44 &&
      SM_M === 1609.344 &&
      visibilityM(null) === null &&
      visibilityM('fog') === null,
    `2.5 SM -> ${2.5 * SM_M} m; "6+" -> ${6 * SM_M} m (documented at-least floor); mile exact; junk -> null`
  );
}

{
  // The Glasgow fixture, captured live 2026-07-07 02:00Z:
  // FEW013 BKN025 OVC030. All three bases sit under the WMO low
  // etage (2000 m), so low cover is the MAX layer (OVC = 100%)
  // and the measured deck base is 1300 ft = 396.24 m exactly.
  const egpf = [
    {cover: 'FEW', base: 1300},
    {cover: 'BKN', base: 2500},
    {cover: 'OVC', base: 3000}
  ];
  const e = etageCovers(egpf);
  // Synthetic three-etage sky: SCT080 is middle (2438.4 m), a
  // BKN250 cirrus deck is high (7620 m); low stays clear so
  // baseM stays null.
  const split = etageCovers([
    {cover: 'SCT', base: 8000},
    {cover: 'BKN', base: 25000}
  ]);
  const cavok = etageCovers([]);
  check(
    'etage split',
    e.low === 100 &&
      e.mid === 0 &&
      e.high === 0 &&
      e.baseM === 1300 * FT_M &&
      Math.abs(e.baseM - 396.24) < 1e-9 &&
      split.low === 0 &&
      split.mid === 43.75 &&
      split.high === 75 &&
      split.baseM === null &&
      8000 * FT_M > ETAGE_LOW_M &&
      25000 * FT_M > ETAGE_MID_M &&
      cavok.low === 0 &&
      cavok.baseM === null,
    `Glasgow FEW013 BKN025 OVC030 -> low 100% (max of layers), measured base ${e.baseM} m exactly; SCT080/BKN250 -> mid 43.75% high 75% (WMO 2/7 km etages); CAVOK -> clear`
  );
}

{
  // Live-captured API shape through the normalizer, then station
  // selection: the nearest station is STALE (2 h old) and must
  // lose to the fresh one further out; out-of-range fresh loses
  // too; everything stale -> null.
  const NOW = 1783390800 + 600; // 10 min after the fixture obs
  const api = [
    {
      icaoId: 'EGPF',
      obsTime: 1783390800,
      visib: '6+',
      temp: 15,
      dewp: 13,
      lat: 55.867,
      lon: -4.433,
      elev: 8,
      cover: 'OVC',
      clouds: [
        {cover: 'FEW', base: 1300},
        {cover: 'BKN', base: 2500},
        {cover: 'OVC', base: 3000}
      ],
      name: 'Glasgow Arpt, SC, GB'
    },
    {
      icaoId: 'EGPK',
      obsTime: NOW - 7200, // stale: two hours old
      visib: '6+',
      temp: 15,
      dewp: 13,
      lat: 55.869,
      lon: -4.43,
      elev: 14,
      cover: 'BKN',
      clouds: [{cover: 'BKN', base: 1600}]
    },
    {icaoId: 'JUNK', clouds: []} // no position/time: dropped
  ];
  const metars = normalizeMetars(api);
  const near = pickStation(metars, 55.87, -4.44, NOW);
  const none = pickStation(metars, 40.0, -4.44, NOW); // out of range
  const allStale = pickStation(metars, 55.87, -4.44, NOW + 2 * METAR_MAX_AGE_S);
  check(
    'nearest fresh station',
    metars.length === 2 &&
      near.id === 'EGPF' &&
      near.km < 1 &&
      near.visib === '6+' &&
      none === null &&
      allStale === null,
    `junk entry dropped by the normalizer; stale-but-nearer EGPK loses to fresh EGPF ${near.km.toFixed(2)} km away; out of range -> null; all stale -> null`
  );
}

process.exit(fail ? 1 : 0);
