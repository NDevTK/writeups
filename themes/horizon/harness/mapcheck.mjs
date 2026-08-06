// mapcheck.mjs - PROVE the vector layers land where the real world has
// them, without the WebGPU renderer.
//
// The eye-level scene is the wrong instrument for placement: grazing
// angle, occlusion, one azimuth, and ~9 min a frame on a GPU-less box.
// This draws the SAME data the theme draws - buildings/roads/rails/water,
// through the theme's own parse + LOD modules - as a TOP-DOWN plan, laid
// directly over the real OpenStreetMap raster for the same bbox in Web
// Mercator, so our lines either sit on the real roads or they do not.
// Seconds, no GPU, comparable to ground truth.
//
//   xvfb-run -a node mapcheck.mjs <lat> <lon> [halfM=8000] [out.png]
//
// Everything the page needs (features + OSM tiles as data URIs) is
// fetched here through curl (the agent proxy) and embedded, so the page
// makes no network request; the screenshot is a plain 2-D composite.
import {chromium} from 'playwright-core';
import {spawn, execSync} from 'node:child_process';
import {writeFileSync, readFileSync, rmSync} from 'node:fs';
import {ensureChrome} from './setup-chrome.mjs';
import {parseBuildings} from '../buildings.js';
import {lodFilterOsm, BLD_NEAR_M} from '../bldlod.js';
import {parseRoads, rankOf} from '../roads.js';
import {lodFilterRoads} from '../linelod.js';
import {parseRailways} from '../rails.js';
import {parseWaterways} from '../rivers.js';

const lat = +process.argv[2];
const lon = +process.argv[3];
const halfM = +(process.argv[4] || 8000);
const out = process.argv[5] || '/tmp/mapcheck.png';
if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
  console.error('usage: mapcheck.mjs <lat> <lon> [halfM] [out.png]');
  process.exit(2);
}

const RAD = Math.PI / 180;
const mLat = 111320;
const mLon = Math.max(111320 * Math.cos(lat * RAD), 1e-6);
const boxOf = (rM) => {
  const dLat = rM / mLat;
  const dLon = rM / mLon;
  return {
    s: lat - dLat,
    w: lon - dLon,
    n: lat + dLat,
    e: lon + dLon,
    bbox: `${(lat - dLat).toFixed(4)},${(lon - dLon).toFixed(4)},${(lat + dLat).toFixed(4)},${(lon + dLon).toFixed(4)}`
  };
};
const box = boxOf(halfM);

// ---- curl (honours the agent proxy) ----
const curlText = (url, extra = []) => {
  try {
    return execSync(
      `curl -sS --max-time 60 ${extra.join(' ')} ${JSON.stringify(url)}`,
      {encoding: 'utf8', maxBuffer: 256 * 1024 * 1024}
    );
  } catch {
    return '';
  }
};
const curlB64 = (url, extra = []) => {
  try {
    return execSync(
      `curl -sS --max-time 30 ${extra.join(' ')} ${JSON.stringify(url)} | base64 -w0`,
      {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024}
    ).trim();
  } catch {
    return '';
  }
};
const MIRROR = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter';
const overpass = (q) => {
  const body = curlText(MIRROR, ['--data-urlencode', JSON.stringify('data=' + q)]);
  try {
    return JSON.parse(body);
  } catch {
    return {elements: []};
  }
};

// ---- fetch the same data the theme draws, through its own modules ----
console.error(`mapcheck ${lat},${lon} +/-${halfM}m`);
const nb = boxOf(BLD_NEAR_M).bbox;
const bOsm = overpass(`[out:json][timeout:60];way[building](${nb});out geom;`);
const buildings = parseBuildings(
  {elements: lodFilterOsm(bOsm, lat, lon).elements},
  Infinity,
  12
);

const rn = boxOf(1500).bbox;
const roadNear = overpass(`[out:json][timeout:60];way[highway](${rn});out geom;`);
const roadFar = overpass(
  `[out:json][timeout:60];way[highway~"^(motorway|trunk|primary|secondary|tertiary)(_link)?$"](${box.bbox});out geom;`
);
const seen = new Set();
const relems = [];
for (const s of [roadNear, roadFar])
  for (const el of s.elements || [])
    if (!seen.has(el.id)) {
      seen.add(el.id);
      relems.push(el);
    }
const roads = lodFilterRoads(parseRoads({elements: relems}, Infinity), lat, lon, rankOf);

const rails = parseRailways(
  overpass(
    `[out:json][timeout:60];way[railway~"^(rail|narrow_gauge|funicular|light_rail|tram)$"](${box.bbox});out geom;`
  ),
  Infinity
);
const water = parseWaterways(
  overpass(
    `[out:json][timeout:60];way[waterway~"^(river|stream|canal|drain|ditch)$"](${box.bbox});out geom;`
  ),
  Infinity
);
console.error(
  `  buildings ${buildings.length} · roads ${roads.length} · rails ${rails.length} · waterways ${water.length}`
);

// ---- Web Mercator so our lines and the OSM tiles share one frame ----
const worldPx = (la, lo, z) => {
  const n = 2 ** z * 256;
  const x = ((lo + 180) / 360) * n;
  const s = Math.sin(la * RAD);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
  return [x, y];
};
// zoom so the box is a handful of tiles wide
let z = Math.round(Math.log2((40075016.686 * Math.cos(lat * RAD) * 3) / (2 * halfM)));
z = Math.max(10, Math.min(16, z));
const [x0, y0] = worldPx(box.n, box.w, z); // top-left
const [x1, y1] = worldPx(box.s, box.e, z); // bottom-right
const W = Math.round(x1 - x0);
const H = Math.round(y1 - y0);

// OSM raster tiles covering the box (embedded as data URIs).
const tiles = [];
const tx0 = Math.floor(x0 / 256);
const ty0 = Math.floor(y0 / 256);
const tx1 = Math.floor(x1 / 256);
const ty1 = Math.floor(y1 / 256);
for (let tx = tx0; tx <= tx1; tx++)
  for (let ty = ty0; ty <= ty1; ty++) {
    const b64 = curlB64(`https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`, [
      '-A',
      JSON.stringify('horizon-mapcheck/1.0 (placement QA)')
    ]);
    if (b64)
      tiles.push({px: tx * 256 - x0, py: ty * 256 - y0, uri: 'data:image/png;base64,' + b64});
  }
console.error(`  OSM tiles z${z}: ${tiles.length} · frame ${W}x${H}`);

// Project a geodetic polyline to frame pixels.
const toFrame = (pts) =>
  pts.map(([la, lo]) => {
    const [x, y] = worldPx(la, lo, z);
    return [Math.round(x - x0), Math.round(y - y0)];
  });
// Deliberately NOT map-coloured: our roads are drawn in contrasting
// magenta/cyan so you can see OUR line sitting on (or off) the real OSM
// road underneath - the whole point of an overlay. Shade by class so the
// LOD is legible too.
const roadColor = (kind) => {
  const r = rankOf(kind);
  if (r <= 2) return 'rgba(230,20,140,0.85)'; // motorway/trunk/primary
  if (r <= 4) return 'rgba(230,20,140,0.6)'; // secondary/tertiary
  if (r <= 6) return 'rgba(0,190,210,0.7)'; // unclassified/residential
  return 'rgba(0,190,210,0.45)'; // service/track/path
};

const data = {
  W,
  H,
  tiles,
  buildings: buildings.map((b) => toFrame(b.ring)),
  roads: roads.map((r) => ({p: toFrame(r.pts), c: roadColor(r.kind)})),
  rails: rails.map((r) => toFrame(r.pts)),
  water: water.map((r) => toFrame(r.pts)),
  title: `${lat.toFixed(4)}, ${lon.toFixed(4)} · +/-${(halfM / 1000).toFixed(1)}km · z${z} · our geometry over OpenStreetMap`
};

const html = `<!doctype html><meta charset=utf8><style>html,body{margin:0;background:#111}
#wrap{position:relative;width:${W}px;height:${H}px}
canvas{position:absolute;left:0;top:0}
#cap{position:absolute;left:6px;top:6px;color:#fff;font:12px monospace;background:#000a;padding:3px 6px;border-radius:3px}</style>
<div id=wrap><canvas id=base width=${W} height=${H}></canvas><canvas id=geo width=${W} height=${H}></canvas>
<div id=cap>${data.title}</div></div>
<script>
const D=${JSON.stringify(data)};
const base=document.getElementById('base').getContext('2d');
const g=document.getElementById('geo').getContext('2d');
let pend=D.tiles.length;
function draw(){
  // water
  g.strokeStyle='rgba(40,120,220,0.8)';g.lineWidth=2;
  for(const p of D.water){g.beginPath();p.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();}
  // buildings
  g.fillStyle='rgba(30,30,30,0.55)';g.strokeStyle='rgba(220,60,60,0.9)';g.lineWidth=1;
  for(const r of D.buildings){if(r.length<3)continue;g.beginPath();r.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();g.stroke();}
  // roads
  for(const r of D.roads){g.strokeStyle=r.c;g.lineWidth=1.6;g.beginPath();r.p.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();}
  // rails
  g.strokeStyle='#111';g.lineWidth=2;g.setLineDash([4,3]);
  for(const p of D.rails){g.beginPath();p.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();}
  g.setLineDash([]);
  document.title='MAPCHECK-DONE';
}
if(!pend)draw();
for(const t of D.tiles){const im=new Image();im.onload=im.onerror=()=>{base.drawImage(im,t.px,t.py);if(--pend===0)draw();};im.src=t.uri;}
</script>`;

const htmlPath = `/tmp/mapcheck-${process.pid}.html`;
writeFileSync(htmlPath, html);

// ---- screenshot the 2-D composite (no WebGPU) ----
const port = 9700 + (process.pid % 200);
const profile = `/tmp/mapcheck-prof-${process.pid}`;
const proc = spawn(
  await ensureChrome(),
  [
    '--no-sandbox',
    '--no-first-run',
    '--disable-background-networking',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    'about:blank'
  ],
  {stdio: 'ignore'}
);
process.on('exit', () => {
  try {
    proc.kill('SIGKILL');
    rmSync(profile, {recursive: true, force: true});
    rmSync(htmlPath, {force: true});
  } catch {}
});
let browser = null;
for (let i = 0; i < 60 && !browser; i++) {
  try {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!browser) throw new Error('CDP connect failed');
const page = browser.contexts()[0].pages()[0] || (await browser.contexts()[0].newPage());
await page.setViewportSize({width: W, height: H});
await page.goto('file://' + htmlPath, {waitUntil: 'load', timeout: 60000});
await page
  .waitForFunction(() => document.title === 'MAPCHECK-DONE', {timeout: 30000})
  .catch(() => {});
await page.waitForTimeout(400);
await page.locator('#wrap').screenshot({path: out});
console.error(`wrote ${out} (${W}x${H})`);
await browser.close();
process.exit(0);
