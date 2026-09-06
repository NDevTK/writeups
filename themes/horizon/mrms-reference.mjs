// mrms-reference.mjs - the gate for grib2.js's PNG-packed window read
// (template 5.41) and mrms.js's echo-top census (174th pass). Three
// anchors: a synthetic 16-bit PNG built here with every row filter
// and inflated back exactly; the vendored MRMS crop (mrms-fixture.js)
// through the streaming window read against Pillow's independent
// numbers; and the census's placing of the tallest cell against a
// plain great-circle written here.
import zlib from 'node:zlib';
import {
  grib2Header,
  grib2Window,
  pngChunks,
  pngUnfilterRow,
  pngWindow16
} from './grib2.js';
import {
  bearingDeg,
  echoTopCensus,
  echoTopField,
  echoTopWords,
  MRMS_FACTS,
  MRMS_TOWER_KM,
  mrmsCell,
  mrmsCellCentre
} from './mrms.js';
import {haversineKm} from './lightning.js';
import {ECHOTOP_B64, MRMS_EXPECT} from './mrms-fixture.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const createInflate = () => zlib.createInflate();

// ---- THE PNG ROWS -----------------------------------------------------
// A 16-bit greyscale image of 9 columns by 7 rows with a known
// pattern, filtered row by row with filter types 0, 1, 2, 3, 4, 2, 4
// (each applied as RFC 2083 defines it, bytes modulo 256), deflated by
// zlib and wrapped as PNG chunks; the streaming window read must give
// the pattern back exactly, in a middle window and in the whole.
{
  const W = 9;
  const H = 7;
  const img = new Uint16Array(W * H);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) img[j * W + i] = (j * 4001 + i * 257 + 12345) & 0xffff;
  const raw = new Uint8Array(H * W * 2);
  for (let k = 0; k < img.length; k++) {
    raw[k * 2] = img[k] >> 8;
    raw[k * 2 + 1] = img[k] & 255;
  }
  const types = [0, 1, 2, 3, 4, 2, 4];
  const bpp = 2;
  const filtered = new Uint8Array(H * (1 + W * bpp));
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let j = 0; j < H; j++) {
    const ft = types[j];
    filtered[j * (1 + W * bpp)] = ft;
    for (let x = 0; x < W * bpp; x++) {
      const v = raw[j * W * bpp + x];
      const a = x >= bpp ? raw[j * W * bpp + x - bpp] : 0;
      const up = j > 0 ? raw[(j - 1) * W * bpp + x] : 0;
      const c = j > 0 && x >= bpp ? raw[(j - 1) * W * bpp + x - bpp] : 0;
      let f = v;
      if (ft === 1) f = v - a;
      else if (ft === 2) f = v - up;
      else if (ft === 3) f = v - ((a + up) >> 1);
      else if (ft === 4) f = v - paeth(a, up, c);
      filtered[j * (1 + W * bpp) + 1 + x] = f & 255;
    }
  }
  const z = zlib.deflateSync(filtered);
  const chunk = (type, data) => {
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, data.length);
    const td = new Uint8Array(4 + data.length);
    td.set([...type].map((ch) => ch.charCodeAt(0)), 0);
    td.set(data, 4);
    const crc = new Uint8Array(4); // the reader ignores the CRC
    return [len, td, crc];
  };
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W);
  dv.setUint32(4, H);
  ihdr[8] = 16;
  ihdr[9] = 0;
  const parts = [
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ...chunk('IHDR', ihdr),
    ...chunk('IDAT', z.subarray(0, 7)),
    ...chunk('IDAT', z.subarray(7)),
    ...chunk('IEND', new Uint8Array(0))
  ];
  const png = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    png.set(p, o);
    o += p.length;
  }
  const c = pngChunks(png);
  const mid = await pngWindow16(png, 2, 5, 3, 8, {createInflate});
  const whole = await pngWindow16(png, 0, H, 0, W, {createInflate});
  let midOk = true;
  for (let j = 2; j < 5; j++)
    for (let i = 3; i < 8; i++) if (mid.counts[(j - 2) * 5 + (i - 3)] !== img[j * W + i]) midOk = false;
  let wholeOk = true;
  for (let k = 0; k < img.length; k++) if (whole.counts[k] !== img[k]) wholeOk = false;
  // a row unfiltered by hand against the previous
  const prev = raw.subarray(0, W * bpp);
  const cur = new Uint8Array(W * bpp);
  pngUnfilterRow(4, filtered.subarray(1 + 4 * (1 + W * bpp) + 0, 1 + 4 * (1 + W * bpp) + W * bpp), raw.subarray(3 * W * bpp, 4 * W * bpp), cur, bpp);
  let rowOk = true;
  for (let x = 0; x < W * bpp; x++) if (cur[x] !== raw[4 * W * bpp + x]) rowOk = false;
  let threw = null;
  try {
    await pngWindow16(png, 0, H + 1, 0, W, {createInflate});
  } catch (e) {
    threw = e.message;
  }
  check(
    'THE PNG ROWS: a 16-bit image filtered with every row filter comes back exactly through the streaming window read, in a middle window and whole; a window past the image throws',
    c.width === W &&
      c.height === H &&
      c.depth === 16 &&
      c.ctype === 0 &&
      c.idat.length === 2 &&
      midOk &&
      mid.counts.length === 15 &&
      mid.rowsRead === 5 &&
      wholeOk &&
      whole.rowsRead === H &&
      rowOk &&
      threw === 'PNG window outside the image' &&
      prev.length === W * bpp,
    `${W} x ${H} pixels through filters ${types.join('/')} and zlib (${z.length} bytes in two IDAT chunks): rows 2-4, columns 3-7 exact (${mid.rowsRead} rows read, the rest never inflated), the whole image exact; row 4's Paeth filter undone by hand; a window one row past the image throws "${threw}"`
  );
}

// ---- THE ECHO TOP, READ -------------------------------------------------
// The vendored crop through grib2Header and the windowed read against
// Pillow's numbers; the census against a plain count and a plain
// great-circle; the module's own facts.
{
  const X = MRMS_EXPECT;
  const bytes = new Uint8Array(Buffer.from(ECHOTOP_B64, 'base64'));
  const h = grib2Header(bytes);
  const w = await grib2Window(bytes, X.centre.lat, X.centre.lon, 25, {createInflate});
  const v = w.values;
  const centre = v[(w.box.cj - w.box.j0) * w.box.cols + (w.box.ci - w.box.i0)];
  const tops = Array.from(v).filter((x) => x > 0).sort((a, b) => a - b);
  const noEcho = Array.from(v).filter((x) => x === -1).length;
  const noCov = Array.from(v).filter((x) => x === -3).length;
  const samplesOk = X.samples.every(([r, c, count]) => near(v[r * w.box.cols + c], (X.drt.R + count) / 1000, 1e-9));
  const cen = echoTopCensus(v, w.box, X.centre.lat, X.centre.lon, {grid: {ni: X.cols, nj: X.rows, la1: X.la1, lo1: X.lo1}, cellDeg: X.d});
  // the tallest cell placed by a plain great-circle from the crop's grid
  const tl = X.tallest;
  const tLat = X.la1 - tl.row * X.d;
  const tLon = X.lo1 + tl.col * X.d - 360;
  const plainKm = haversineKm(X.centre.lat, X.centre.lon, tLat, tLon);
  const plainBrg = bearingDeg(X.centre.lat, X.centre.lon, tLat, tLon);
  const cell = mrmsCell(X.centre.lat, X.centre.lon);
  const back = mrmsCellCentre(cell.j, cell.i);
  const words = echoTopWords(cen, {refTimeIso: h.refTimeIso, halfKm: 25});
  // a window off the grid is null; a window at the crop's corner clips
  const off = await grib2Window(bytes, 10, -81.1, 25, {createInflate});
  const corner = await grib2Window(bytes, X.la1, X.lo1 - 360, 5, {createInflate});
  const cornerCen = echoTopCensus(corner.values, corner.box, X.la1, X.lo1 - 360, {grid: {ni: X.cols, nj: X.rows, la1: X.la1, lo1: X.lo1}, cellDeg: X.d});
  // the deck's box (175th): a storm's centre within 9 km east-west and
  // north-south of the observer, in the census's own metric
  const mLonC = 111320 * Math.cos((X.centre.lat * Math.PI) / 180);
  const nearBox = (s) => Math.abs((s.lon - X.centre.lon) * mLonC) <= 9000 && Math.abs((s.lat - X.centre.lat) * 111320) <= 9000;
  const sortedDesc = (a) => a.every((s, k) => k === 0 || s.km <= a[k - 1].km);
  const deckField = echoTopField(cen.storms, X.centre.lat, X.centre.lon, {rm: 16, worldM: 16000});
  const nearOnly = echoTopField(cen.storms.slice(0, cen.stormsNear), X.centre.lat, X.centre.lon, {rm: 16, worldM: 16000});
  // the window's own counts by hand: every echoing cell within the
  // deck's box, the cells at or above the tower height anywhere and
  // within the box
  let nearEchoes = 0;
  let towerCells = 0;
  let nearTowers = 0;
  for (let q = 0; q < w.values.length; q++) {
    const v = w.values[q];
    if (!(v > 0)) continue;
    const jq = w.box.j0 + Math.floor(q / w.box.cols);
    const iq = w.box.i0 + (q % w.box.cols);
    const c = mrmsCellCentre(jq, iq, {ni: X.cols, nj: X.rows, la1: X.la1, lo1: X.lo1}, X.d);
    const isNear = nearBox(c);
    if (isNear) nearEchoes++;
    if (v >= MRMS_TOWER_KM) {
      towerCells++;
      if (isNear) nearTowers++;
    }
  }
  check(
    'THE ECHO TOP, READ: the vendored MRMS crop through the PNG-packed window read agrees with Pillow to the cell, the census places the tallest storm by a plain great-circle, and the facts are the file\'s own',
    h.discipline === 209 &&
      h.drt.tmpl === 41 &&
      near(h.drt.R, X.drt.R, 1e-6) &&
      h.drt.D === X.drt.D &&
      h.drt.nbits === 16 &&
      h.grid.ni === X.cols &&
      h.grid.nj === X.rows &&
      near(h.grid.la1, X.la1, 1e-9) &&
      near(h.grid.lo1, X.lo1, 1e-9) &&
      near(h.grid.di, X.d, 1e-12) &&
      h.refTimeIso === X.refTime &&
      h.paramCategory === 3 &&
      h.paramNumber === 44 &&
      w.box.rows === X.rows &&
      w.box.cols === X.cols &&
      w.box.cj - w.box.j0 === X.centre.row &&
      w.box.ci - w.box.i0 === X.centre.col &&
      near(centre, X.centre.value, 1e-9) &&
      samplesOk &&
      tops.length === X.echo &&
      noEcho === X.noEcho &&
      noCov === X.noCoverage &&
      near(tops[tops.length - 1], X.maxKm, 1e-9) &&
      near(tops[Math.floor(0.9 * tops.length)], X.p90Km, 1e-9) &&
      cen.n === X.rows * X.cols &&
      cen.covered === X.rows * X.cols - X.noCoverage &&
      cen.echo === X.echo &&
      near(cen.maxKm, X.maxKm, 1e-9) &&
      near(cen.p90Km, X.p90Km, 1e-9) &&
      near(cen.medianKm, X.medianKm, 1e-9) &&
      cen.here.code === 'echo' &&
      near(cen.here.km, X.centre.value, 1e-9) &&
      cen.tallest !== null &&
      near(cen.tallest.km, tl.km, 1e-9) &&
      near(cen.tallest.distKm, plainKm, 0.06) &&
      near(cen.tallest.bearingDeg, plainBrg, 0.06) &&
      cen.storms.length > 0 &&
      // the storms kept: every cell within the deck's ±9 km east-west
      // and north-south (175th), tallest first, then the tallest beyond
      // up to the cap - the near part is what a deck-sized field paints
      cen.stormsNear > 0 &&
      cen.stormsNear === nearEchoes &&
      cen.storms.length === cen.stormsNear + Math.min(cen.stormsTotal - nearTowers, 300) &&
      cen.storms.slice(0, cen.stormsNear).every(nearBox) &&
      cen.storms.slice(0, cen.stormsNear).every((s) => s.km > 0) &&
      cen.storms.slice(0, cen.stormsNear).some((s) => s.km < MRMS_TOWER_KM) &&
      cen.storms.slice(cen.stormsNear).every((s) => !nearBox(s) && s.km >= MRMS_TOWER_KM) &&
      sortedDesc(cen.storms.slice(0, cen.stormsNear)) &&
      sortedDesc(cen.storms.slice(cen.stormsNear)) &&
      Math.max(...cen.storms.map((s) => s.km)) === cen.maxKm &&
      cen.stormsTotal === towerCells &&
      deckField.cells >= nearOnly.cells &&
      nearOnly.cells > 0 &&
      nearOnly.cells <= cen.stormsNear &&
      cell !== null &&
      Math.abs(back.lat - X.centre.lat) <= X.d / 2 + 1e-9 &&
      Math.abs(back.lon - X.centre.lon) <= X.d / 2 + 1e-9 &&
      off === null &&
      corner.box.j0 === 0 &&
      corner.box.i0 === 0 &&
      corner.box.rows === 6 &&
      corner.box.cols === 6 &&
      cornerCen.n === 36 &&
      words.includes('18-dBZ echo') &&
      words.includes(`tallest ${X.maxKm.toFixed(1)} km`) &&
      MRMS_FACTS.cadenceS === 120 &&
      MRMS_FACTS.cellDeg === 0.01 &&
      MRMS_FACTS.codes.noCoverage === -3 &&
      MRMS_FACTS.codes.noEcho === -1 &&
      MRMS_FACTS.drt.R === -3000 &&
      MRMS_FACTS.documentation.includes('not reachable'),
    `${X.file.slice(0, 16)} ${h.refTimeIso}, discipline ${h.discipline} category ${h.paramCategory} number ${h.paramNumber}, template 5.${h.drt.tmpl} R ${h.drt.R} D ${h.drt.D}: a ${w.box.rows} x ${w.box.cols} window read in ${w.rowsRead} rows and ${w.chunks} chunks; ` +
      `the centre cell ${centre} km (Pillow ${X.centre.value}), ${X.samples.length} sampled counts exact, ${tops.length} echoing cells, ${noEcho} echo-free, ${noCov} uncovered; tops median ${cen.medianKm}, tallest tenth ${cen.p90Km}, tallest ${cen.maxKm} km at ${cen.tallest.bearingDeg}° and ${cen.tallest.distKm} km (a plain great-circle: ${plainBrg.toFixed(1)}°, ${plainKm.toFixed(1)} km); ` +
      `${cen.stormsTotal} cells at or above ${MRMS_TOWER_KM} km, ${cen.storms.length} kept (every echoing cell within the deck's ±${cen.nearKm} km, ${cen.stormsNear} of them ${nearTowers} at or above ${MRMS_TOWER_KM} km, then the tallest ${cen.storms.length - cen.stormsNear} beyond; a 16-km field takes ${nearOnly.cells} of the near cells and ${deckField.cells - nearOnly.cells} far flanks reaching in); a window at 10 N is null, one at the crop's corner clips to ${corner.box.rows} x ${corner.box.cols}; the words: "${words.slice(0, 120)}..."`
  );
}

// ---- THE TOWERS' FIELD (175th pass) -----------------------------------
// Storms painted onto the low deck's texel field: a cell's 1-km
// footprint touches the texels the rain cover field's own rule says,
// the taller value keeps a texel, the border ring stays zero, storms
// outside the box are skipped, the caller's y mapping is applied; the
// vendored crop's census list paints its towers.
{
  const rm = 16;
  const worldM = 16000; // 1 km a texel
  const lat = 32.075;
  const lon = -81.105;
  const mLon = 111320 * Math.cos((lat * Math.PI) / 180);
  // a storm centred on texel (10, 5): x = +2.5 km, z = -2.5 km -> its
  // 1-km footprint [2, 3) km holds texel 10's centre only; a second
  // storm 0.6 km east of it holds texel 11's; a taller one on the
  // first cell keeps the texel; the flanks fall 2 km a kilometre
  // beyond the footprints; one 20 km away reaches 7.5 km at most and
  // stays outside the box; a km-0 entry is no storm
  const at = (xKm, zKm, km) => ({lat: lat - (zKm * 1000) / 111320, lon: lon + (xKm * 1000) / mLon, km});
  const storms = [at(2.5, -2.5, 9), at(3.1, -2.5, 8.2), at(2.5, -2.5, 12), at(20, 0, 15), {lat, lon, km: 0}];
  const f = echoTopField(storms, lat, lon, {rm, worldM, cellM: 1000}, (m) => m / 1000);
  const k = (ii, jj) => (jj * rm + ii) * 4;
  const border = [];
  for (let ii = 0; ii < rm; ii++) border.push(f.data[k(ii, 0) + 3], f.data[k(ii, rm - 1) + 3], f.data[k(0, ii) + 3], f.data[k(rm - 1, ii) + 3]);
  // the reference's own field, every texel by the rule in kilometres:
  // the tallest over the storms of the top less twice the texel
  // centre's distance beyond the footprint, a core where the centre
  // lies on a footprint
  const ref = new Float64Array(rm * rm);
  const refCore = new Uint8Array(rm * rm);
  for (let jj = 1; jj < rm - 1; jj++)
    for (let ii = 1; ii < rm - 1; ii++) {
      const xc = ii - 7.5;
      const zc = jj - 7.5;
      let best = 0;
      let core = 0;
      for (const s of storms) {
        if (!(s.km > 0)) continue;
        const xs = ((s.lon - lon) * mLon) / 1000;
        const zs = (-(s.lat - lat) * 111320) / 1000;
        const rx = Math.abs(xc - xs) - 0.5;
        const rz = Math.abs(zc - zs) - 0.5;
        if (rx <= 1e-6 && rz <= 1e-6) core = 1;
        best = Math.max(best, s.km - 2 * Math.hypot(Math.max(0, rx), Math.max(0, rz)));
      }
      ref[jj * rm + ii] = best;
      refCore[jj * rm + ii] = core;
    }
  const fieldExact = Array.from({length: rm * rm}).every((_, t) =>
    ref[t] > 0
      ? near(f.data[t * 4], ref[t], 1e-5) && f.data[t * 4 + 3] === 1 && f.data[t * 4 + 1] === refCore[t]
      : f.data[t * 4 + 3] === 0 && f.data[t * 4] === 0 && f.data[t * 4 + 1] === 0
  );
  const refPainted = ref.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);
  // the vendored crop's own storms through the field with the page's
  // mapping (16 asinh((top - elev)/500) + 8 at an elevation of 0)
  const X = MRMS_EXPECT;
  const bytes = new Uint8Array(Buffer.from(ECHOTOP_B64, 'base64'));
  const w = await grib2Window(bytes, X.centre.lat, X.centre.lon, 25, {createInflate});
  const cen = echoTopCensus(w.values, w.box, X.centre.lat, X.centre.lon, {grid: {ni: X.cols, nj: X.rows, la1: X.la1, lo1: X.lo1}, cellDeg: X.d});
  const yOf = (m) => 16 * Math.asinh(m / 500) + 8;
  const g = echoTopField(cen.storms, X.centre.lat, X.centre.lon, {rm: 64, worldM: 60000, cellM: 1000}, yOf);
  const empty = echoTopField([], lat, lon, {rm, worldM});
  check(
    "THE TOWERS' FIELD: storms paint their own texels with their tops and their flanks at the stated 2:1 slope through the caller's mapping, the taller keeps a texel, a measured footprint is marked, the ring stays zero, a storm beyond reach is skipped",
    fieldExact &&
      f.cells === 3 &&
      f.painted === refPainted &&
      f.painted > 20 &&
      near(f.data[k(10, 5)], 12, 1e-12) && // the 12-km core over the 9-km one
      f.data[k(10, 5) + 1] === 1 &&
      f.data[k(10, 5) + 3] === 1 &&
      near(f.data[k(11, 5)], 11, 1e-5) && // the 12-km flank 0.5 km out beats the 8.2-km core there
      f.data[k(11, 5) + 1] === 1 &&
      near(f.data[k(9, 5)], 11, 1e-5) &&
      f.data[k(9, 5) + 1] === 0 &&
      near(f.data[k(12, 5)], 9, 1e-5) && // 1.5 km out
      near(f.data[k(10, 3)], 9, 1e-5) &&
      near(f.data[k(12, 3)], 12 - 2 * Math.hypot(1.5, 1.5), 1e-5) && // the diagonal
      near(f.data[k(4, 5)], 1, 1e-5) && // 5.5 km out: a flank almost at the ground
      f.data[k(3, 5) + 3] === 0 && // 6.5 km out: nothing
      border.every((v) => v === 0) &&
      near(f.maxTop, 12, 1e-12) &&
      f.maxKm === 12 &&
      empty.painted === 0 &&
      empty.cells === 0 &&
      empty.maxTop === null &&
      g.cells === cen.storms.length &&
      g.painted > cen.storms.length &&
      g.painted <= 62 * 62 &&
      near(g.maxTop, yOf(cen.maxKm * 1000), 1e-4) && // the field is float32; maxTop is the stored value
      g.maxKm === cen.maxKm &&
      Array.from({length: 64 * 64}).every((_, t) => g.data[t * 4 + 3] === 0 || (g.data[t * 4] >= yOf(0) - 1e-9 && g.data[t * 4] <= g.maxTop)),
    `a 16 x 16 field a kilometre a texel matches the reference's own texel-by-texel rule (${f.painted} texels painted): a 9-km storm centred on texel (10, 5) and a 12-km one on the same cell keep the texel at 12 (a core), ` +
      `the 12-km flank at 11 on the neighbours beats the 8.2-km storm's own core on texel 11, 9 at 1.5 km out, ${(12 - 2 * Math.hypot(1.5, 1.5)).toFixed(3)} on the diagonal, 1 at 5.5 km, nothing at 6.5 km; the ring is zero; ` +
      `a storm 20 km out and a km-0 entry are skipped (${f.cells} of the 5 entries counted); ` +
      `the vendored crop's ${cen.storms.length} cells (${cen.stormsNear} echoing within ±${cen.nearKm} km, then those at or above ${MRMS_TOWER_KM} km) paint ${g.painted} texels of a 64 x 64 field over 60 km, the tallest ${g.maxKm} km at scene y ${g.maxTop.toFixed(2)} (the page's asinh mapping), every painted texel between the ground's y and that`
  );
}

if (fail) {
  console.error(`${fail} landmark(s) failed`);
  process.exit(1);
}
