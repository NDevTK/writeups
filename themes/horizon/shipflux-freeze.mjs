// shipflux-freeze.mjs - freeze a SAMPLE of NOAA PSL's hourly ship
// flux archive (node shipflux-freeze.mjs) into shipflux-fixture.js
// for the cool-skin and sky-longwave gate (coolskin-reference.mjs,
// 137th pass). The archive: 31,914 one-hour observations from
// research cruises 1991-2021 (Fairall et al. 2026, Section 2.1),
// served by the COAPS ERDDAP as NOAA_PSL_Hourly_Ship_Flux -
// measured pyrgeometer/pyranometer fluxes, air and sea-snake
// temperatures, humidity, wind, the bulk fluxes and the COARE
// cool skin PSL computed from them. Three subsets, each sampled
// systematically in time order (a fixed stride, so a refreeze on
// the same archive reproduces the same rows):
//  - NIGHT skin rows (sw_down < 10, no rain, good flags, no warm
//    layer): the archive's own inputs and its COARE dt_skin - the
//    port must reproduce the latter from the former;
//  - CLEAR day rows (sw_down/sw_down_clear >= 0.95 with the
//    clear-sky solar over 300 W/m^2, no rain): measured
//    downwelling longwave against Brunt's screen-level emissivity
//    - the ocean's own test of the land-fitted sky;
//  - NIGHT all-sky rows (any cover, unrecorded by the ships): the
//    sky's scatter when the cover is unknown.
// Read the diff, run the gate, commit fixture and reference
// together (run-then-pin).
import {writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE =
  'https://erddap-misc.coaps.fsu.edu/erddap/tabledap/NOAA_PSL_Hourly_Ship_Flux.csv';
const STRIDE_SKIN = 8;
const STRIDE_ALLSKY = 16;
const STRIDE_CLEAR = 2;
const CLEARNESS_MIN = 0.95;

const fetchCsv = async (query) => {
  const url = `${BASE}?${query}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const text = await r.text();
  const lines = text.trim().split('\n');
  const head = lines[0].split(',');
  const rows = lines.slice(2).map((line) => {
    const c = line.split(',');
    const o = {};
    head.forEach((h, i) => {
      o[h] = h === 'cruise_name' || h === 'time' ? c[i] : parseFloat(c[i]);
    });
    return o;
  });
  return {url, rows};
};
const fin = (o, ks) => ks.every((k) => Number.isFinite(o[k]));
const r3 = (x) => Math.round(x * 1000) / 1000;
const r4 = (x) => Math.round(x * 10000) / 10000;

const at = new Date().toISOString().slice(0, 16) + 'Z';
const nightQ =
  'cruise_name,time,latitude,tair,qair,psealevel,wspd_10N,tsea,dt_skin,depth,dt_warm_to_skin,ustar,hs_bulk,hl_bulk,lw_down,sw_down,rhoair,prate,ssea_ship&sw_down<10&flag_bad_bulk=0&flag_bad_ship=0';
const dayQ =
  'cruise_name,time,latitude,tair,qair,psealevel,lw_down,sw_down,sw_down_clear,prate&sw_down>200&flag_bad_ship=0';
const night = await fetchCsv(nightQ);
const day = await fetchCsv(dayQ);

// night skin rows: the archive's inputs and its own skin
const skinAll = night.rows.filter(
  (o) =>
    fin(o, [
      'latitude',
      'tsea',
      'dt_skin',
      'depth',
      'ustar',
      'hs_bulk',
      'hl_bulk',
      'lw_down',
      'sw_down',
      'rhoair'
    ]) &&
    o.prate === 0 &&
    (!Number.isFinite(o.dt_warm_to_skin) || Math.abs(o.dt_warm_to_skin) < 1e-6)
);
const skin = skinAll
  .filter((_, i) => i % STRIDE_SKIN === 0)
  .map((o) => ({
    cruise: o.cruise_name,
    time: o.time,
    latDeg: r3(o.latitude),
    u10nMs: Number.isFinite(o.wspd_10N) ? r3(o.wspd_10N) : null,
    tseaC: r4(o.tsea),
    rhoA: r4(o.rhoair),
    uStar: r4(o.ustar),
    hsDown: r3(o.hs_bulk),
    hlDown: r3(o.hl_bulk),
    lwDn: r3(o.lw_down),
    swDn: r3(o.sw_down),
    ssPsu: Number.isFinite(o.ssea_ship) ? r3(o.ssea_ship) : null,
    dtSkin: r4(o.dt_skin),
    dzSkinM: o.depth
  }));

// night all-sky longwave rows
const lwAll = night.rows.filter(
  (o) =>
    fin(o, ['tair', 'qair', 'psealevel', 'lw_down']) &&
    o.lw_down > 150 &&
    o.lw_down < 500
);
const allsky = lwAll
  .filter((_, i) => i % STRIDE_ALLSKY === 0)
  .map((o) => ({
    cruise: o.cruise_name,
    time: o.time,
    latDeg: r3(o.latitude),
    taC: r3(o.tair),
    qGkg: r3(o.qair),
    pHpa: r3(o.psealevel),
    lwDn: r3(o.lw_down)
  }));

// clear day rows
const clearAll = day.rows.filter(
  (o) =>
    fin(o, [
      'tair',
      'qair',
      'psealevel',
      'lw_down',
      'sw_down',
      'sw_down_clear'
    ]) &&
    o.sw_down_clear > 300 &&
    o.lw_down > 150 &&
    o.lw_down < 500 &&
    !(o.prate > 0) &&
    o.sw_down / o.sw_down_clear >= CLEARNESS_MIN &&
    o.sw_down / o.sw_down_clear <= 1.15
);
const clear = clearAll
  .filter((_, i) => i % STRIDE_CLEAR === 0)
  .map((o) => ({
    cruise: o.cruise_name,
    time: o.time,
    latDeg: r3(o.latitude),
    taC: r3(o.tair),
    qGkg: r3(o.qair),
    pHpa: r3(o.psealevel),
    lwDn: r3(o.lw_down),
    clearness: r3(o.sw_down / o.sw_down_clear)
  }));

// cruise names once; rows carry an index (a third of the bytes)
const cruiseList = [
  ...new Set([...skin, ...allsky, ...clear].map((o) => o.cruise))
];
const cruises = new Set(cruiseList);
for (const set of [skin, allsky, clear])
  for (const o of set) {
    o.c = cruiseList.indexOf(o.cruise);
    delete o.cruise;
  }
const packed = (set) =>
  '[\n' + set.map((o) => JSON.stringify(o)).join(',\n') + '\n]';
const out = `/**
 * shipflux-fixture.js - a frozen SAMPLE of NOAA PSL's hourly ship
 * flux archive (NOAA_PSL_Hourly_Ship_Flux on the COAPS ERDDAP; the
 * database Fairall et al. 2026 describe in Section 2.1), GENERATED
 * by shipflux-freeze.mjs at ${at}. Measured pyrgeometer longwave,
 * sea-snake and air temperatures, humidity, the bulk fluxes and
 * the COARE cool skin PSL computed from them, on ${cruises.size}
 * research cruises. Systematic samples in time order:
 *  - skin: every ${STRIDE_SKIN}th of ${skinAll.length} night, rain-free,
 *    good-flag, warm-layer-free hours (${skin.length} rows);
 *  - allsky: every ${STRIDE_ALLSKY}th of ${lwAll.length} night hours with a
 *    measured longwave (${allsky.length} rows; the ships log no cover);
 *  - clear: every ${STRIDE_CLEAR}nd of ${clearAll.length} daytime hours whose measured
 *    solar reaches ${CLEARNESS_MIN} of the clear-sky solar (a clear sky by
 *    the sun's own test), rain-free (${clear.length} rows).
 * Downward-positive fluxes as the archive serves them (hsDown,
 * hlDown); coolskin.js takes the ocean's loss, so the sign flips
 * at the gate. Rows carry a cruise index c into SHIPFLUX_CRUISES.
 * Generated data, one row per line - listed in .prettierignore.
 */
export const SHIPFLUX_AT = '${at}';
export const SHIPFLUX_QUERIES = ${JSON.stringify([night.url, day.url], null, 2)};
export const SHIPFLUX_COUNTS = ${JSON.stringify(
  {
    nightRows: night.rows.length,
    skinEligible: skinAll.length,
    skinStride: STRIDE_SKIN,
    allskyEligible: lwAll.length,
    allskyStride: STRIDE_ALLSKY,
    dayRows: day.rows.length,
    clearEligible: clearAll.length,
    clearStride: STRIDE_CLEAR,
    clearnessMin: CLEARNESS_MIN,
    cruises: cruises.size
  },
  null,
  2
)};
export const SHIPFLUX_CRUISES = ${JSON.stringify(cruiseList)};
export const SHIPFLUX_SKIN = ${packed(skin)};
export const SHIPFLUX_ALLSKY = ${packed(allsky)};
export const SHIPFLUX_CLEAR = ${packed(clear)};
`;
const path = resolve(HERE, 'shipflux-fixture.js');
writeFileSync(path, out);
console.log(
  `wrote ${path}: skin ${skin.length}/${skinAll.length}, allsky ${allsky.length}/${lwAll.length}, clear ${clear.length}/${day.rows.length} day rows, ${cruises.size} cruises, ${(out.length / 1024).toFixed(0)} kB`
);
