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
// (140th pass: the skin rows also carry the BULK INPUTS - air
// temperature, humidity and wind at their measured heights, the
// skin temperature PSL fed the algorithm, the pressure - and PSL's
// own t* and q*, so the profile forms can be gated on the same hours)
const nightQ =
  'cruise_name,time,latitude,tair,qair,z_tair,z_qair,wspd_sfc,z_wspd,tskin,tstar,qstar,psealevel,wspd_10N,tsea,dt_skin,depth,dt_warm_to_skin,ustar,hs_bulk,hl_bulk,lw_down,sw_down,rhoair,prate,ssea_ship&sw_down<10&flag_bad_bulk=0&flag_bad_ship=0';
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
    dzSkinM: o.depth,
    // the bulk inputs and PSL's scaling parameters (140th pass)
    taC: Number.isFinite(o.tair) ? r3(o.tair) : null,
    qGkg: Number.isFinite(o.qair) ? r3(o.qair) : null,
    ztM: Number.isFinite(o.z_tair) ? o.z_tair : null,
    zqM: Number.isFinite(o.z_qair) ? o.z_qair : null,
    uMs: Number.isFinite(o.wspd_sfc) ? r3(o.wspd_sfc) : null,
    zuM: Number.isFinite(o.z_wspd) ? o.z_wspd : null,
    tskinC: Number.isFinite(o.tskin) ? r4(o.tskin) : null,
    pHpa: Number.isFinite(o.psealevel) ? r3(o.psealevel) : null,
    tStar: Number.isFinite(o.tstar) ? r4(o.tstar) : null,
    qStar: Number.isFinite(o.qstar) ? Math.round(o.qstar * 1e7) / 1e7 : null
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

// WARM-LAYER RUNS (139th pass): contiguous hourly stretches of a
// cruise, each spanning at least 36 hours with the warm-layer
// inputs and PSL's own dT_warm/dz_warm present, chosen by the
// strongest daily warming PSL found (the eight largest peaks) and
// by a fixed stride through the rest (every 12th eligible run) -
// the port integrates each run from its start.
const warmQ =
  'cruise_name,time,latitude,longitude,tsea,dt_skin,dt_warm,dz_warm,dt_warm_to_skin,tau_bulk,hs_bulk,hl_bulk,hrain,lw_down,sw_down,prate&flag_bad_ship=0';
const warmAll = await fetchCsv(warmQ);
const warmNeed = [
  'latitude',
  'longitude',
  'tsea',
  'dt_warm',
  'dz_warm',
  'tau_bulk',
  'hs_bulk',
  'hl_bulk',
  'lw_down',
  'sw_down'
];
const byCruise = {};
for (const o of warmAll.rows) (byCruise[o.cruise_name] ??= []).push(o);
const runsAll = [];
for (const [cruise, seq] of Object.entries(byCruise)) {
  seq.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  let cur = [];
  const flush = () => {
    if (cur.length >= 36) {
      const span =
        (Date.parse(cur[cur.length - 1].time) - Date.parse(cur[0].time)) /
        3600e3;
      if (span >= 36 && span <= cur.length * 1.5)
        runsAll.push({
          cruise,
          rows: cur,
          peak: Math.max(...cur.map((o) => o.dt_warm))
        });
    }
    cur = [];
  };
  for (const o of seq) {
    if (!fin(o, warmNeed)) {
      flush();
      continue;
    }
    if (
      cur.length &&
      Date.parse(o.time) - Date.parse(cur[cur.length - 1].time) > 2 * 3600e3
    )
      flush();
    cur.push(o);
    if (cur.length >= 72) flush();
  }
  flush();
}
runsAll.sort((a, b) => b.peak - a.peak);
const STRIDE_WARM = 12;
const warmPick = [
  ...runsAll.slice(0, 8),
  ...runsAll.slice(8).filter((_, i) => i % STRIDE_WARM === 0)
];
const warm = warmPick.map((r) => ({
  cruise: r.cruise,
  latDeg: r3(r.rows[0].latitude),
  lonDeg: r3(r.rows[0].longitude),
  peakPsl: r3(r.peak),
  rows: r.rows.map((o) => ({
    time: o.time,
    tseaC: r3(o.tsea),
    dtSkin: Number.isFinite(o.dt_skin) ? r4(o.dt_skin) : null,
    dtWarm: r4(o.dt_warm),
    dzWarm: r3(o.dz_warm),
    tau: r4(o.tau_bulk),
    hsDown: r3(o.hs_bulk),
    hlDown: r3(o.hl_bulk),
    hrainDown: Number.isFinite(o.hrain) ? r3(o.hrain) : null,
    lwDn: r3(o.lw_down),
    swDn: r3(o.sw_down)
  }))
}));

// cruise names once; rows carry an index (a third of the bytes)
const cruiseList = [
  ...new Set([...skin, ...allsky, ...clear, ...warm].map((o) => o.cruise))
];
const cruises = new Set(cruiseList);
for (const set of [skin, allsky, clear, warm])
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
 *    good-flag, warm-layer-free hours (${skin.length} rows) - since the
 *    140th pass also carrying the bulk inputs (air temperature,
 *    humidity and wind at their measured heights, the skin
 *    temperature PSL fed the algorithm, the pressure) and PSL's
 *    own u*, t*, q* and fluxes, so the profile forms are gated on
 *    the same hours as the skin;
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
// warm-layer runs (139th): ${warm.length} contiguous stretches (the ${Math.min(8, runsAll.length)} strongest of ${runsAll.length} eligible, then every ${STRIDE_WARM}th), rows per run below
export const SHIPFLUX_WARM = ${packed(warm)};
`;
const path = resolve(HERE, 'shipflux-fixture.js');
writeFileSync(path, out);
console.log(
  `wrote ${path}: skin ${skin.length}/${skinAll.length}, allsky ${allsky.length}/${lwAll.length}, clear ${clear.length}/${day.rows.length} day rows, ${cruises.size} cruises, ${(out.length / 1024).toFixed(0)} kB`
);
