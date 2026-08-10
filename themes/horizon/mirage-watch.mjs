#!/usr/bin/env node
/**
 * mirage-watch.mjs - the hunt for a day that folds. The Lehn
 * retrieval (127th-128th passes) is gated end to end on synthetic
 * days but has never closed on a real balloon: San Diego's column
 * declines from both eyes. The sounding daemon is not San Diego -
 * it serves the nearest IGRA ascent to ANY point - and the
 * retrievalPanel's S-detector is exactly a hunt criterion. This
 * script sweeps a small station list, each chosen because the
 * mirage literature the repo already leans on lives there, and
 * reports which columns fold a terrestrial transfer characteristic
 * today, from which eye, at what range - with the full closure
 * numbers when one does.
 *
 *   node mirage-watch.mjs [--json hits.json]
 *
 * On a hit, freeze the day for the archive:
 *   the JSON carries {station, at, rows} in the exact shape a
 *   lehn fixture wants; lehn-reference then pins the closure on
 *   the frozen real day. FIRST BLOOD, the day this script was
 *   born: 2026-08-10 00Z Resolute - Lehn & Legal's own site -
 *   folded at 130 km and closed at 0.43 K RMS (lehn-fixture.js,
 *   pinned in lehn-reference). Only CLOSING retrievals count as
 *   hits; folds that do not close are reported as the method's
 *   measured edges.
 *
 * The list (all IGRA-covered; the reason is the literature):
 *  - San Diego         the theme's own point (control)
 *  - Vandenberg        California bight subsidence cap, south
 *  - Oakland           California bight, north
 *  - Quillayute        NE Pacific marine layer
 *  - Utqiagvik         arctic shore - the classic superior-mirage
 *                      coast (Barrow)
 *  - Inuvik            the Beaufort coast: Lehn's Tuktoyaktuk
 *                      range (Whitefish Summit, 20 km) is next door
 *  - Resolute          Lehn & Legal 1994's looming site - the
 *                      repo's own hindcast (looming-reference)
 *  - Novaya Zemlya     Malye Karmakuly: de Veer 1597's effect -
 *                      the repo's own hindcast (nz-reference)
 */

import {writeFileSync} from 'node:fs';
import {retrievalPanel} from './observatory.js';

const STATIONS = [
  ['San Diego', 32.85, -117.12],
  ['Vandenberg', 34.75, -120.57],
  ['Oakland', 37.75, -122.22],
  ['Quillayute', 47.95, -124.55],
  ['Utqiagvik', 71.29, -156.78],
  ['Inuvik', 68.32, -133.52],
  ['Resolute', 74.72, -94.98],
  ['Novaya Zemlya', 72.38, 52.73]
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jget = async (url) => {
  // The daemon's first touch of a cold arctic station can blow
  // its own 25-s budget (a 502 own-JSON) while WARMING its cache -
  // the second or third attempt usually answers from it.
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, {signal: AbortSignal.timeout(45000)});
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      if (attempt < 3) {
        await sleep([5000, 10000, 20000][attempt]);
        continue;
      }
      throw e;
    }
  }
};

const args = process.argv.slice(2);
const jsonPath = (() => {
  const i = args.indexOf('--json');
  return i >= 0 ? args[i + 1] : null;
})();

const hits = [];
for (const [name, lat, lon] of STATIONS) {
  let line = name.padEnd(14);
  try {
    const snd = await jget(
      `https://api.ndev.tk/sounding?lat=${lat}&lon=${lon}`
    );
    const rows = snd?.rows;
    if (!Array.isArray(rows) || rows.length < 10) {
      console.log(line + 'no usable ascent');
      continue;
    }
    const h0 = rows[0].hM;
    // The station's own geometry: the shore eye just above the
    // field elevation, and a generic ridge eye 300 m over it (San
    // Diego keeps the theme's 450-m AMSL convention).
    const eyes = name === 'San Diego' ? null : {eyesM: [h0 + 2, h0 + 300]};
    const r = retrievalPanel(rows, eyes ?? {});
    let tMax = rows[0];
    for (const q of rows) {
      if (q.hM > 2500) break;
      if (q.tC > tMax.tC) tMax = q;
    }
    line +=
      `${(snd.at ?? '?').slice(0, 16).padEnd(17)} h0 ${String(h0).padStart(4)} m  ` +
      `inv +${(tMax.tC - rows[0].tC).toFixed(1)} K @ ${tMax.hM} m  `;
    if (r.retrieved) {
      line +=
        `${r.retrieved.closes ? 'FOLDS+CLOSES' : 'folds, DOES NOT CLOSE'}: ` +
        `${r.mode} eye ${r.eyeM.toFixed(0)} m @ ${(r.distM / 1000).toFixed(0)} km  ` +
        (r.mode === 'elevated'
          ? `layer +${r.retrieved.params.dTK.toFixed(1)} K at ${r.retrieved.params.zBaseM.toFixed(0)}-${(r.retrieved.params.zBaseM + r.retrieved.params.wM).toFixed(0)} m  `
          : `+${r.retrieved.dTretr.toFixed(1)} K to ${r.retrieved.probedTopM.toFixed(0)} m  `) +
        `vs balloon +${r.retrieved.dTballoon.toFixed(1)} K  RMS ${r.retrieved.rmsK.toFixed(2)} K`;
      if (r.retrieved.closes)
        hits.push({
          station: name,
          latDeg: lat,
          lonDeg: lon,
          at: snd.at,
          rows,
          panel: {
            mode: r.mode,
            eyeM: r.eyeM,
            distM: r.distM,
            retrieved: r.retrieved
          }
        });
    } else {
      line +=
        'declines (' +
        r.tried
          .map((t) => `${t.eyeM.toFixed(0)}m:${t.distM ? t.why : 'no fold'}`)
          .join(', ') +
        ')';
    }
    console.log(line);
  } catch (e) {
    console.log(line + 'FEED FAIL: ' + e.message);
  }
  await sleep(800);
}

console.log(
  `\n${hits.length} of ${STATIONS.length} stations fold AND close today` +
    (hits.length ? ' - a freezable day' : ' - the hunt continues')
);
if (jsonPath && hits.length) {
  writeFileSync(jsonPath, JSON.stringify(hits, null, 1));
  console.log('hits written to ' + jsonPath);
}
