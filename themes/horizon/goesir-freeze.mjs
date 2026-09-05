#!/usr/bin/env node
/**
 * goesir-freeze.mjs - freeze the measured cloud field's fixture:
 * the GOES-West Band 13 tiles (NASA GIBS) around the observatory's
 * home at the observatory's own stamp, the terrarium elevation
 * window that separates sea from land, and the frozen day's pins
 * (run-then-pin, the 123rd-pass contract):
 *
 *   node goesir-freeze.mjs --time 2026-09-05T12:20:00Z
 *   node goesir-freeze.mjs                  (the layer's latest image)
 *
 * The clear-sky reference and the height column come from the
 * observatory fixture's sea column (marinePanel on COOPS_MET and
 * the balloon) - the GOES fixture is therefore bound to the
 * observatory's frozen day, and the reference refuses a GOES stamp
 * from another day. GIBS keeps a few days of imagery: refreeze the
 * two together while the day is still served.
 *
 * The published colormap is refetched and compared ENTRY BY ENTRY
 * with the module's vendored copy - a changed map fails the freeze
 * (the law would be reading the wrong temperatures).
 */

import {writeFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {
  B13_COLORMAP,
  GIBS_COLORMAP_URL,
  decodeMosaic,
  decodePngRgba,
  gibsTileUrl,
  goesPanel,
  parseColormapXml,
  windowTiles
} from './goesir.js';
import {marinePanel} from './observatory.js';
import {COOPS_MET, FIXTURE_AT, SOUNDING} from './observatory-fixture.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
};
const OUT = resolve(HERE, opt('out', 'goesir-fixture.js'));
const LAT = parseFloat(opt('lat', '32.85'));
const LON = parseFloat(opt('lon', '-117.12'));
const TIME = opt('time', null);
const TERRARIUM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';

const inflate = (z) => new Uint8Array(inflateSync(Buffer.from(z)));
async function getBytes(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return {bytes: new Uint8Array(await r.arrayBuffer()), headers: r.headers};
}

async function main() {
  // the colormap must be the vendored one
  const xml = await (await fetch(GIBS_COLORMAP_URL)).text();
  const live = parseColormapXml(xml);
  const same =
    live.length === B13_COLORMAP.length &&
    live.every((e, i) => e.every((v, k) => v === B13_COLORMAP[i][k]));
  if (!same)
    throw new Error(
      `the published colormap differs from the vendored one (${live.length} vs ${B13_COLORMAP.length} entries) - re-vendor before freezing`
    );
  console.log(
    `colormap: ${live.length} entries, identical to the vendored copy`
  );

  const win = windowTiles(LAT, LON);
  const tiles = [];
  let stamp = TIME;
  for (const t of win.tiles) {
    const url = gibsTileUrl(t.row, t.col, TIME);
    const {bytes, headers} = await getBytes(url);
    const actual = headers.get('layer-time-actual');
    if (!stamp) stamp = actual;
    if (actual && stamp && actual !== stamp)
      throw new Error(
        `tile ${t.row}/${t.col} served ${actual}, expected ${stamp}`
      );
    const png = decodePngRgba(bytes, inflate);
    if (png.w !== 256 || png.h !== 256) throw new Error('tile is not 256 px');
    tiles.push({...t, bytes, rgba: png.rgba});
    console.log(
      `tile ${t.row}/${t.col}: ${bytes.length} bytes, ${actual ?? 'time as requested'}`
    );
  }
  if (!stamp) throw new Error('no layer-time-actual header and no --time');
  // the elevation window from the terrarium tiles at the same zoom
  const i0 = Math.floor(win.px) - win.halfPx;
  const j0 = Math.floor(win.py) - win.halfPx;
  const ww = 2 * win.halfPx + 1;
  const wh = ww;
  const terr = [];
  for (const t of win.tiles) {
    const {bytes} = await getBytes(
      `${TERRARIUM}/${win.z}/${t.col}/${t.row}.png`
    );
    terr.push({...t, ...decodePngRgba(bytes, inflate)});
  }
  const elev = new Int16Array(ww * wh);
  let water = 0;
  for (let j = 0; j < wh; j++)
    for (let i = 0; i < ww; i++) {
      const X = i0 + i;
      const Y = j0 + j;
      const t = terr.find(
        (t) => X >= t.ox && X < t.ox + 256 && Y >= t.oy && Y < t.oy + 256
      );
      const k = ((Y - t.oy) * 256 + (X - t.ox)) * 4;
      const e = t.rgba[k] * 256 + t.rgba[k + 1] + t.rgba[k + 2] / 256 - 32768;
      elev[j * ww + i] = Math.max(-32768, Math.min(32767, Math.round(e)));
      if (e <= 0.3) water++;
    }
  console.log(
    `elevation window ${ww}x${wh} at (${i0},${j0}): ${water} water px`
  );

  // run the instrument on the frozen day's own column
  const mar = marinePanel(COOPS_MET, SOUNDING.rows, {
    bliM: null,
    shore: COOPS_MET.shore,
    latDeg: COOPS_MET.latDeg
  });
  const dec = decodeMosaic(tiles, win.w, win.h);
  const elevM = Float32Array.from(elev);
  const P = goesPanel({
    dec,
    win,
    elevM,
    i0,
    j0,
    ww,
    wh,
    tSkinC: mar.tInterfaceC,
    rows: mar.rows,
    latDeg: LAT,
    lonDeg: LON,
    metar: null
  });
  const f = (v, d = 2) =>
    v === null || v === undefined ? 'null' : (+v).toFixed(d);
  console.log(
    `\n${stamp}: view zenith ${f(P.viewZenithDeg)} deg; clear-sky reference ${f(P.reference.tClrC)} C ` +
      `(skin ${f(mar.tInterfaceC)} - ${f(P.reference.depressionK)} K; emissivity ${f(P.reference.emissivity, 4)}, ` +
      `window tau ${f(P.reference.tauNadir, 3)} nadir, PW ${f(P.reference.pwMm, 1)} mm); tropopause ${P.tropopause.tC} C at ${P.tropopause.hM} m; ` +
      `inversion ${P.inversion}; cloud at BT under ${f(P.thresholdBtC)} C`
  );
  console.log(
    `greys: ${dec.greys.regions} regions, ${dec.greys.coldRegions} cold, ${dec.greys.coldPixels} px read on the cold ramp`
  );
  for (const [name, s] of [
    ['100 km', P.r100],
    ['30 km', P.r30]
  ])
    console.log(
      `${name}: ${s.n} px, ${s.water} water / ${s.land} land; water clear ${s.waterClear} low ${s.waterLow} mid ${s.waterMid} high ${s.waterHigh} ` +
        `(cloud ${f(s.waterCloudFrac * 100, 1)}%); land mid ${s.mid - s.waterMid} high ${s.high - s.waterHigh}; ` +
        `tops low ${f(s.topMedianM.low, 0)} mid ${f(s.topMedianM.mid, 0)} high ${f(s.topMedianM.high, 0)} m; warm p95 ${f(s.warmP95C)} C`
    );
  console.log(
    `observer pixel: BT ${f(P.observer.btC)} C, ${P.observer.water ? 'water' : 'land'}, class ${P.observer.cls}, eps ${f(P.observer.eps, 3)}; ` +
      `warm closure ${f(P.warmClosureK)} K; deck field ${P.deck.rm}x${P.deck.rm}`
  );

  const b64 = (u8) =>
    Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');
  const pins = {
    generatedFor: stamp,
    observatoryAt: FIXTURE_AT,
    viewZenithDeg: [P.viewZenithDeg, 0.01],
    tSkinC: [mar.tInterfaceC, 0.01],
    tClrC: [P.reference.tClrC, 0.02],
    depressionK: [P.reference.depressionK, 0.02],
    emissivity: [P.reference.emissivity, 0.0005],
    tauNadir: [P.reference.tauNadir, 0.002],
    pwMm: [P.reference.pwMm, 0.1],
    tropTC: P.tropopause.tC,
    tropHm: P.tropopause.hM,
    inversion: P.inversion,
    thresholdBtC: [P.thresholdBtC, 0.02],
    greyRegions: dec.greys.regions,
    coldRegions: dec.greys.coldRegions,
    coldPixels: dec.greys.coldPixels,
    r100: {
      n: P.r100.n,
      water: P.r100.water,
      land: P.r100.land,
      waterClear: P.r100.waterClear,
      waterLow: P.r100.waterLow,
      waterMid: P.r100.waterMid,
      waterHigh: P.r100.waterHigh,
      mid: P.r100.mid,
      high: P.r100.high,
      lowTopM:
        P.r100.topMedianM.low === null ? null : [P.r100.topMedianM.low, 1],
      warmP95C: [P.r100.warmP95C, 0.01]
    },
    r30: {
      n: P.r30.n,
      water: P.r30.water,
      waterClear: P.r30.waterClear,
      waterLow: P.r30.waterLow,
      waterMid: P.r30.waterMid,
      waterHigh: P.r30.waterHigh
    },
    observerBtC: [P.observer.btC, 0.01],
    observerWater: P.observer.water,
    observerCls: P.observer.cls,
    warmClosureK: [P.warmClosureK, 0.02],
    shoreCover: COOPS_MET.shore?.cover ?? null
  };
  const fixture = `/**
 * goesir-fixture.js - GENERATED by goesir-freeze.mjs: the measured
 * cloud field's frozen scene. GOES-West ABI Band 13 tiles from NASA
 * GIBS (layer GOES-West_ABI_Band13_Clean_Infrared, zoom 6, the
 * 2x2 mosaic around the observatory's home) at the observatory
 * fixture's own stamp, stored as the PNG bytes GIBS served (base64,
 * verbatim); the terrarium elevation window (Int16 metres, little
 * endian, base64; bathymetry kept - water is at or under 0.3 m by
 * the theme's sea rule) over the +/-100 km window; and the day's
 * pins. Refreeze with the observatory fixture; READ THE DIFF.
 */

export const GOESIR_AT = '${stamp}';
export const GOESIR_HOME = {latDeg: ${LAT}, lonDeg: ${LON}};
export const GOESIR_WINDOW = ${JSON.stringify({
    z: win.z,
    x0: win.x0,
    y0: win.y0,
    w: win.w,
    h: win.h,
    px: win.px,
    py: win.py,
    halfPx: win.halfPx,
    mppM: win.mppM,
    i0,
    j0,
    ww,
    wh
  })};
export const GOESIR_TILES = [
${tiles
  .map(
    (t) =>
      `  {row: ${t.row}, col: ${t.col}, ox: ${t.ox}, oy: ${t.oy}, png: '${b64(t.bytes)}'}`
  )
  .join(',\n')}
];
export const GOESIR_ELEV = '${b64(new Uint8Array(elev.buffer))}';
export const GOESIR_PINS = ${JSON.stringify(pins, null, 2)};
`;
  writeFileSync(OUT, fixture);
  console.log(`\nwrote ${OUT} (${fixture.length} bytes)`);
}

main().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
