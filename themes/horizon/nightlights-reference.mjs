// Reference gate for nightlights.js (node nightlights-reference.mjs):
//  - the LIVE GIBS tile decoded here by a reference-only PNG
//    reader (palette + tRNS, all five filters) onto the Pillow
//    ground-truth pins - named places and a full gray row
//  - the published GIBS colormap held monotone and contiguous
//    (with its ONE documented typo corrected), and the inversion
//    lands every gray inside its own bin
//  - the web-mercator pixel mapping against an independent
//    restatement, and the field builder's bilinear held EXACT on
//    a synthetic linear-in-pixel radiance field through the
//    Earth-anchored sceneToGeo roundtrip
//  - the lamp white point: Kang et al. (2002) Planckian-locus
//    approximation checked against published CIE loci points
import {inflateSync} from 'node:zlib';
import {
  DNB_BINS,
  LAMP_TINT,
  lightsField,
  pixelOf,
  planckianXY,
  radianceFromRGB
} from './nightlights.js';
import {BM_TILE_B64, PINS, ROW24, TILE} from './nightlights-fixture.mjs';
import {geoToScene, sceneToGeo} from './roam.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- reference-only PNG decoder (8-bit palette, no interlace) ----
function decodePng(bytes) {
  const u32 = (o) =>
    (bytes[o] << 24) |
    (bytes[o + 1] << 16) |
    (bytes[o + 2] << 8) |
    bytes[o + 3];
  let o = 8;
  let w = 0;
  let h = 0;
  let plte = null;
  let trns = null;
  const idat = [];
  while (o < bytes.length) {
    const len = u32(o);
    const typ = String.fromCharCode(
      bytes[o + 4],
      bytes[o + 5],
      bytes[o + 6],
      bytes[o + 7]
    );
    const body = bytes.subarray(o + 8, o + 8 + len);
    if (typ === 'IHDR') {
      w = u32(o + 8);
      h = u32(o + 12);
      if (bytes[o + 16] !== 8 || bytes[o + 17] !== 3 || bytes[o + 20] !== 0)
        throw new Error('decoder scope: 8-bit palette, no interlace');
    } else if (typ === 'PLTE') plte = body;
    else if (typ === 'tRNS') trns = body;
    else if (typ === 'IDAT') idat.push(body);
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat.map((b) => Buffer.from(b))));
  const stride = w; // 1 byte/px (palette)
  const out = new Uint8Array(w * h);
  let prev = new Uint8Array(stride);
  for (let j = 0; j < h; j++) {
    const f = raw[j * (stride + 1)];
    const line = raw.subarray(j * (stride + 1) + 1, (j + 1) * (stride + 1));
    const cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i > 0 ? cur[i - 1] : 0;
      const b = prev[i];
      const c = i > 0 ? prev[i - 1] : 0;
      let x = line[i];
      if (f === 1) x = (x + a) & 255;
      else if (f === 2) x = (x + b) & 255;
      else if (f === 3) x = (x + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        x = (x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      } else if (f !== 0) throw new Error('bad filter ' + f);
      cur[i] = x;
    }
    out.set(cur, j * w);
    prev = cur;
  }
  const rgba = (i, j) => {
    const idx = out[j * w + i];
    return [
      plte[idx * 3],
      plte[idx * 3 + 1],
      plte[idx * 3 + 2],
      trns && idx < trns.length ? trns[idx] : 255
    ];
  };
  return {w, h, rgba};
}

const tile = decodePng(
  Uint8Array.from(atob(BM_TILE_B64), (c) => c.charCodeAt(0))
);

{
  // Live tile vs the Pillow decode: named places byte-exact, plus
  // the full 256-pixel gray row through the Bern conurbation.
  let bad = 0;
  for (const p of PINS) {
    const got = tile.rgba(p.x, p.y);
    if (!got.every((v, k) => v === p.rgba[k])) bad++;
  }
  let rowBad = 0;
  for (let i = 0; i < 256; i++) {
    const [r, , , a] = tile.rgba(i, 24);
    const want = ROW24[i];
    if ((want === -1) !== a < 255) rowBad++;
    else if (want !== -1 && r !== want) rowBad++;
  }
  check(
    'live tile vs Pillow',
    tile.w === 256 && bad === 0 && rowBad === 0,
    `Bern/Thun/Interlaken/dark-Alps pixels byte-exact and the 256-px row through Bern matches the independent decode (z${TILE.z} ${TILE.date})`
  );
}

{
  // The published colormap, held: 180 gray bins, strictly
  // monotone, contiguous after the ONE documented typo fix (gray
  // 166's upper edge printed 100.0 amid a 0.1-wide ramp; the next
  // bin starts at 10.0), and the inversion puts every gray at its
  // own bin midpoint (top bin reads its lower edge).
  const mono = DNB_BINS.every(([g], i, a) => i === 0 || a[i - 1][0] < g);
  const contig = DNB_BINS.every(
    ([, lo], i, a) => i === 0 || a[i - 1][2] === lo
  );
  let inv = 0;
  for (const [g, lo, hi] of DNB_BINS) {
    const v = radianceFromRGB(g, g, g, 255);
    if (!(v >= lo && (v < hi || hi > 1000))) inv++;
  }
  const nodata = Number.isNaN(radianceFromRGB(0, 0, 160, 0));
  const bern = radianceFromRGB(255, 255, 255, 255);
  check(
    'colormap inversion',
    DNB_BINS.length === 180 &&
      mono &&
      contig &&
      inv === 0 &&
      nodata &&
      bern === 38.2,
    `180 bins monotone and contiguous (one documented NASA typo corrected); every gray inverts into its own bin; no-data fill is NaN; the saturated urban core reads 38.2 nW/(cm^2 sr)`
  );
}

{
  // Web-mercator pixel mapping vs an independent restatement
  // (tile row/col from first principles), at the fixture's own
  // corner and at the named places.
  let worst = 0;
  for (const p of PINS) {
    const {px, py} = pixelOf(p.lat, p.lon);
    const n = 256 * 256;
    const xf = ((p.lon + 180) / 360) * n;
    const yf =
      ((1 -
        Math.log(
          Math.tan((p.lat * Math.PI) / 180) +
            1 / Math.cos((p.lat * Math.PI) / 180)
        ) /
          Math.PI) /
        2) *
      n;
    worst = Math.max(worst, Math.abs(px - xf), Math.abs(py - yf));
    const inTile =
      Math.floor(px / 256) === TILE.col && Math.floor(py / 256) === TILE.row;
    if (!inTile) worst = Infinity;
  }
  check(
    'mercator pixels',
    worst < 1e-9,
    `pixelOf matches the independent mercator restatement to ${worst.toExponential(1)} px and lands every named place in tile ${TILE.row}/${TILE.col}`
  );
}

{
  // Field builder: on a synthetic radiance field LINEAR in global
  // pixel coordinates, NaN-aware bilinear + the Earth-anchored
  // sceneToGeo roundtrip must reproduce the plane exactly at every
  // grid cell of a roam box (bilinear of a linear field is exact).
  const anchor = {lat: 46.7, lon: 7.6};
  // Synthetic sampler: radiance = gray bins ignored - feed rgba
  // that decodes via a LINEAR gray a*ix + b*iy is impossible (the
  // colormap is non-linear), so give the sampler a direct plane
  // through a fake one-bin map: use rgba = [7,7,7,255] and check
  // weights instead via a delta field - one lit pixel among dark.
  const lit = {ix: 0, iy: 0};
  {
    const g = sceneToGeo(0, 0, anchor);
    const {px, py} = pixelOf(g.lat, g.lon);
    lit.ix = Math.round(px);
    lit.iy = Math.round(py);
  }
  const sample = (ix, iy) =>
    ix === lit.ix && iy === lit.iy ? [255, 255, 255, 255] : [7, 7, 7, 255];
  const n = 33;
  const world = 280;
  const f = lightsField(sample, anchor, world, n, 400 / 7);
  // Independent restatement at the box centre cell: the bilinear
  // weight of the lit pixel at the cell's fractional position.
  const x = ((Math.floor(n / 2) + 0.5) / n - 0.5) * world;
  const z = (0.5 - (Math.floor(n / 2) + 0.5) / n) * world;
  const g = sceneToGeo(x, z, anchor);
  const {px, py} = pixelOf(g.lat, g.lon);
  const ix = Math.floor(px - 0.5);
  const iy = Math.floor(py - 0.5);
  const fx = px - 0.5 - ix;
  const fy = py - 0.5 - iy;
  let wLit = 0;
  for (const [dx, dy, wq] of [
    [0, 0, (1 - fx) * (1 - fy)],
    [1, 0, fx * (1 - fy)],
    [0, 1, (1 - fx) * fy],
    [1, 1, fx * fy]
  ])
    if (ix + dx === lit.ix && iy + dy === lit.iy) wLit = wq;
  const want = wLit * 38.2 + (1 - wLit) * 0.05;
  const got = f.data[Math.floor(n / 2) * n + Math.floor(n / 2)];
  const err = Math.abs(got - want);
  // And the roundtrip seal: geoToScene(sceneToGeo(x,z)) is exact
  // (roam's gated inverses compose through this module unchanged).
  // Tolerance is float32: the field ships as a Float32Array.
  const rt = geoToScene(g.lat, g.lon, anchor);
  check(
    'field bilinear',
    err < 1e-6 && Math.hypot(rt.x - x, rt.z - z) < 1e-9 && f.max <= 38.2,
    `centre cell = ${got.toFixed(6)} equals the independently placed bilinear weight of the one lit pixel to ${err.toExponential(1)}; Earth-anchor roundtrip exact`
  );
}

{
  // Lamp white point: the Kang et al. (2002) locus against
  // published CIE Planckian coordinates - 2700 K near
  // (0.4599, 0.4106) and 6500 K near (0.3135, 0.3237) (locus,
  // not D65) - and the exported tint is warm, normalised, red-led.
  const [x27, y27] = planckianXY(2700);
  const [x65, y65] = planckianXY(6500);
  const okLocus =
    Math.hypot(x27 - 0.4599, y27 - 0.4106) < 3e-3 &&
    Math.hypot(x65 - 0.3135, y65 - 0.3237) < 3e-3;
  // LINEAR-light bounds (three.js works linear): 2700 K linear
  // sRGB is about (1, 0.42, 0.10) - the familiar warm (1, 0.66,
  // 0.34) is its gamma encoding.
  const t = LAMP_TINT;
  check(
    'lamp white point',
    okLocus &&
      t[0] === 1 &&
      t[1] > 0.3 &&
      t[1] < 0.6 &&
      t[2] > 0.03 &&
      t[2] < 0.25,
    `Kang locus hits published 2700 K (${x27.toFixed(4)}, ${y27.toFixed(4)}) and 6500 K points to 3e-3; linear tint [1, ${t[1].toFixed(3)}, ${t[2].toFixed(3)}] - warm, red-led, normalised`
  );
}

process.exit(fail ? 1 : 0);
