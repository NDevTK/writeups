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
    for (let i = 0; i < W; i++)
      img[j * W + i] = (j * 4001 + i * 257 + 12345) & 0xffff;
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
    td.set(
      [...type].map((ch) => ch.charCodeAt(0)),
      0
    );
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
    for (let i = 3; i < 8; i++)
      if (mid.counts[(j - 2) * 5 + (i - 3)] !== img[j * W + i]) midOk = false;
  let wholeOk = true;
  for (let k = 0; k < img.length; k++)
    if (whole.counts[k] !== img[k]) wholeOk = false;
  // a row unfiltered by hand against the previous
  const prev = raw.subarray(0, W * bpp);
  const cur = new Uint8Array(W * bpp);
  pngUnfilterRow(
    4,
    filtered.subarray(
      1 + 4 * (1 + W * bpp) + 0,
      1 + 4 * (1 + W * bpp) + W * bpp
    ),
    raw.subarray(3 * W * bpp, 4 * W * bpp),
    cur,
    bpp
  );
  let rowOk = true;
  for (let x = 0; x < W * bpp; x++)
    if (cur[x] !== raw[4 * W * bpp + x]) rowOk = false;
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
  const w = await grib2Window(bytes, X.centre.lat, X.centre.lon, 25, {
    createInflate
  });
  const v = w.values;
  const centre = v[(w.box.cj - w.box.j0) * w.box.cols + (w.box.ci - w.box.i0)];
  const tops = Array.from(v)
    .filter((x) => x > 0)
    .sort((a, b) => a - b);
  const noEcho = Array.from(v).filter((x) => x === -1).length;
  const noCov = Array.from(v).filter((x) => x === -3).length;
  const samplesOk = X.samples.every(([r, c, count]) =>
    near(v[r * w.box.cols + c], (X.drt.R + count) / 1000, 1e-9)
  );
  const cen = echoTopCensus(v, w.box, X.centre.lat, X.centre.lon, {
    grid: {ni: X.cols, nj: X.rows, la1: X.la1, lo1: X.lo1},
    cellDeg: X.d
  });
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
  const corner = await grib2Window(bytes, X.la1, X.lo1 - 360, 5, {
    createInflate
  });
  const cornerCen = echoTopCensus(
    corner.values,
    corner.box,
    X.la1,
    X.lo1 - 360,
    {grid: {ni: X.cols, nj: X.rows, la1: X.la1, lo1: X.lo1}, cellDeg: X.d}
  );
  check(
    "THE ECHO TOP, READ: the vendored MRMS crop through the PNG-packed window read agrees with Pillow to the cell, the census places the tallest storm by a plain great-circle, and the facts are the file's own",
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
      cen.storms.length <= 300 &&
      cen.storms[0].km === cen.maxKm &&
      cen.storms.every((s, k) => k === 0 || s.km <= cen.storms[k - 1].km) &&
      cen.storms.every((s) => s.km >= MRMS_TOWER_KM) &&
      cen.stormsTotal >= cen.storms.length &&
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
      `${cen.stormsTotal} cells at or above ${MRMS_TOWER_KM} km, ${cen.storms.length} kept; a window at 10 N is null, one at the crop's corner clips to ${corner.box.rows} x ${corner.box.cols}; the words: "${words.slice(0, 120)}..."`
  );
}

if (fail) {
  console.error(`${fail} landmark(s) failed`);
  process.exit(1);
}
