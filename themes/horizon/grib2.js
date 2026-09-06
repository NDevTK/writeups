/**
 * grib2.js - a minimal, certified GRIB2 (FM 92 edition 2) decoder
 * for the aerosol feed. NOMADS retired OpenDAP (SCN 25-81, Feb
 * 2026); the supported subsetting path returns raw GRIB2, so the
 * daemon decodes it here. Scope is exactly what the GEFS-Aerosols
 * a2d product uses - decoded against the WMO FM 92 GRIB edition 2
 * specification, and gated against an eccodes ground-truth decode
 * of a live subset (grib2-reference.mjs):
 *  - grid definition template 3.0 (regular lat/lon), scan modes
 *    +i rows with j either direction
 *  - product definition templates 4.0/4.48 (4.48 = optical
 *    properties of aerosol: type code 4.233, wavelength interval)
 *  - data representation template 5.0 (simple packing), with or
 *    without a section-6 bitmap
 * All GRIB2 signed integers are SIGN-MAGNITUDE (top bit = sign),
 * not two's complement - the classic port trap, held by landmarks.
 */

const u16 = (b, o) => (b[o] << 8) | b[o + 1];
const u32 = (b, o) =>
  ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u64 = (b, o) => u32(b, o) * 4294967296 + u32(b, o + 4);
// GRIB2 negative numbers: sign bit + magnitude.
const sm8 = (b, o) => (b[o] & 0x80 ? -(b[o] & 0x7f) : b[o]);
const sm16 = (b, o) => {
  const v = u16(b, o);
  return v & 0x8000 ? -(v & 0x7fff) : v;
};
const sm32 = (b, o) => {
  const v = u32(b, o);
  return v & 0x80000000 ? -(v & 0x7fffffff) : v;
};
const f32 = (b, o) => {
  const dv = new DataView(b.buffer, b.byteOffset + o, 4);
  return dv.getFloat32(0, false);
};

// Read `count` big-endian `nbits`-wide integers from `b` starting
// at byte `off`.
function unpackBits(b, off, nbits, count) {
  const out = new Float64Array(count);
  if (nbits === 0) return out;
  let acc = 0;
  let bits = 0;
  let p = off;
  for (let i = 0; i < count; i++) {
    while (bits < nbits) {
      acc = acc * 256 + b[p++];
      bits += 8;
    }
    const excess = bits - nbits;
    const div = 2 ** excess;
    const q = Math.floor(acc / div);
    out[i] = q;
    acc -= q * div;
    bits = excess;
  }
  return out;
}

const MICRO = 1e-6; // template 3.0 angles are in 1e-6 degrees

/**
 * Parse a GRIB2 buffer into an array of decoded messages:
 * {discipline, refTime, forecastHours, paramCategory, paramNumber,
 *  aerosolType, wavelength: {lo, hi} (metres) | null,
 *  grid: {ni, nj, la1, lo1, la2, lo2, di, dj, iNeg, jPos},
 *  values: Float64Array (NaN where the bitmap masks)}.
 * Unsupported templates throw - a feed change must fail loudly,
 * never decode as garbage.
 */
export function parseGrib2(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const msgs = [];
  let o = 0;
  while (o + 4 <= b.length) {
    if (
      b[o] !== 0x47 ||
      b[o + 1] !== 0x52 ||
      b[o + 2] !== 0x49 ||
      b[o + 3] !== 0x42
    ) {
      o++; // tolerate padding between messages
      continue;
    }
    const total = u64(b, o + 8);
    // A message shorter than its own 16-byte indicator section is
    // corruption; NaN (truncated read) fails this test too. Throw
    // rather than loop - this parser runs in the daemon's request
    // path, and a non-advancing offset would wedge the process.
    if (!(total >= 16))
      throw new Error(`corrupt GRIB2 message length ${total}`);
    msgs.push(parseMessage(b.subarray(o, o + total)));
    o += total;
  }
  return msgs;
}

function parseMessage(b) {
  const m = {discipline: b[6]};
  if (b[7] !== 2) throw new Error('not GRIB edition 2');
  let o = 16;
  let bitmap = null;
  let drt = null;
  while (o < b.length - 4) {
    if (
      b[o] === 0x37 &&
      b[o + 1] === 0x37 &&
      b[o + 2] === 0x37 &&
      b[o + 3] === 0x37
    )
      break;
    const len = u32(b, o);
    // 4 length octets + 1 section number is the floor; a zero or
    // truncated length would stop the walk advancing - same
    // liveness rule as the message loop: fail loudly, never hang.
    if (!(len >= 5)) throw new Error(`corrupt GRIB2 section length ${len}`);
    const sec = b[o + 4];
    if (sec === 1) {
      m.refTime = {
        y: u16(b, o + 12),
        m: b[o + 14],
        d: b[o + 15],
        H: b[o + 16],
        M: b[o + 17],
        S: b[o + 18]
      };
    } else if (sec === 3) {
      const tmpl = u16(b, o + 12);
      if (tmpl !== 0) throw new Error(`unsupported grid template 3.${tmpl}`);
      const scan = b[o + 71];
      if (scan & 0x20 || scan & 0x10)
        throw new Error(`unsupported scan mode 0x${scan.toString(16)}`);
      // Octets 39-46: basic angle + subdivisions. Regulation
      // 92.1.6: zero (or missing, all-ones) means the 1e-6 degree
      // unit MICRO assumes; any other ratio rescales every angle
      // in the section, so decoding it with MICRO would be silent
      // garbage - the one unsupported case that previously slipped
      // through quietly. Fail loudly like every other template gap.
      const basicAngle = u32(b, o + 38);
      const basicSub = u32(b, o + 42);
      if (
        (basicAngle !== 0 && basicAngle !== 0xffffffff) ||
        (basicSub !== 0 && basicSub !== 0xffffffff)
      )
        throw new Error(
          `unsupported basic angle ${basicAngle}/${basicSub} (not 1e-6 deg)`
        );
      m.grid = {
        ni: u32(b, o + 30),
        nj: u32(b, o + 34),
        la1: sm32(b, o + 46) * MICRO,
        lo1: sm32(b, o + 50) * MICRO,
        la2: sm32(b, o + 55) * MICRO,
        lo2: sm32(b, o + 59) * MICRO,
        di: u32(b, o + 63) * MICRO,
        dj: u32(b, o + 67) * MICRO,
        iNeg: !!(scan & 0x80),
        jPos: !!(scan & 0x40)
      };
    } else if (sec === 4) {
      const tmpl = u16(b, o + 7);
      if (tmpl !== 0 && tmpl !== 48)
        throw new Error(`unsupported product template 4.${tmpl}`);
      m.paramCategory = b[o + 9];
      m.paramNumber = b[o + 10];
      if (tmpl === 48) {
        m.aerosolType = u16(b, o + 11);
        // Wavelength interval: scale factor + scaled value pairs
        // (octets 26-35 of the template), value = scaled/10^scale.
        const s1 = sm8(b, o + 25);
        const v1 = sm32(b, o + 26);
        const s2 = sm8(b, o + 30);
        const v2 = sm32(b, o + 31);
        m.wavelength = {lo: v1 / 10 ** s1, hi: v2 / 10 ** s2};
        const unit = b[o + 41];
        const ft = sm32(b, o + 42);
        m.forecastHours = timeToHours(unit, ft);
      } else {
        m.aerosolType = null;
        m.wavelength = null;
        const unit = b[o + 17];
        const ft = sm32(b, o + 18);
        m.forecastHours = timeToHours(unit, ft);
      }
    } else if (sec === 5) {
      const tmpl = u16(b, o + 9);
      if (tmpl !== 0)
        throw new Error(`unsupported data representation template 5.${tmpl}`);
      drt = {
        n: u32(b, o + 5),
        R: f32(b, o + 11),
        E: sm16(b, o + 15),
        D: sm16(b, o + 17),
        nbits: b[o + 19]
      };
    } else if (sec === 6) {
      const ind = b[o + 5];
      if (ind === 0) bitmap = b.subarray(o + 6, o + len);
      else if (ind !== 255)
        throw new Error(`unsupported bitmap indicator ${ind}`);
    } else if (sec === 7) {
      if (!drt) throw new Error('data before representation section');
      const packed = unpackBits(b, o + 5, drt.nbits, drt.n);
      const scale = 2 ** drt.E / 10 ** drt.D;
      const R = drt.R / 10 ** drt.D;
      const total = m.grid ? m.grid.ni * m.grid.nj : drt.n;
      const values = new Float64Array(total);
      if (bitmap) {
        let k = 0;
        for (let i = 0; i < total; i++) {
          const on = (bitmap[i >> 3] >> (7 - (i & 7))) & 1;
          values[i] = on ? R + packed[k++] * scale : NaN;
        }
      } else {
        for (let i = 0; i < total; i++) values[i] = R + packed[i] * scale;
      }
      m.values = values;
    }
    o += len;
  }
  return m;
}

function timeToHours(unit, t) {
  // Code table 4.4 - the units the feed can plausibly carry.
  if (unit === 0) return t / 60;
  if (unit === 1) return t;
  if (unit === 2) return t * 24;
  if (unit === 10) return t * 3;
  if (unit === 11) return t * 6;
  if (unit === 12) return t * 12;
  if (unit === 13) return t / 3600;
  throw new Error(`unsupported time unit ${unit}`);
}

/**
 * Value at (lat, lon) from a decoded message: nearest grid cell,
 * honouring scan direction, with longitude folded into the grid's
 * own convention (NOMADS grids are 0..360). Returns NaN outside
 * the grid or on a bitmap hole.
 */
export function gridValue(msg, lat, lon) {
  const g = msg.grid;
  let lo = lon;
  while (lo < Math.min(g.lo1, g.lo2) - g.di / 2) lo += 360;
  while (lo > Math.max(g.lo1, g.lo2) + g.di / 2) lo -= 360;
  const i = Math.round((g.iNeg ? g.lo1 - lo : lo - g.lo1) / g.di);
  const j = Math.round((g.jPos ? lat - g.la1 : g.la1 - lat) / g.dj);
  if (i < 0 || i >= g.ni || j < 0 || j >= g.nj) return NaN;
  return msg.values[j * g.ni + i];
}

// ---------------------------------------------------------------
// THE RADAR'S OWN HEIGHTS (174th pass): a WINDOWED read of a message
// packed by data representation template 5.41 (PNG, WMO FM 92 code
// table 5.0) - the form NCEP's MRMS 2-D grids take: a 7000 x 3500
// 16-bit greyscale PNG of the scaled counts, value = (R + X 2^E) /
// 10^D, 49 MB raw. A whole-message decode is the wrong tool for a
// point: the PNG's rows depend only on the row above (the five row
// filters of the PNG specification, RFC 2083 section 6: None, Sub,
// Up, Average, Paeth), so the compressed stream is fed to an
// inflater chunk by chunk, each finished row unfiltered against the
// one before it and dropped unless it lies in the window, and the
// inflater closed once the window's last row is out - a few rows of
// memory, not the raster (measured: 93 MB peak RSS for three windows
// in node, the 49-MB raster never allocated). The inflater is
// injected (node's zlib.createInflate; the module stays runtime-free).
// ---------------------------------------------------------------
/** The message's sections by number: {n: {pos, len}}; throws on a
 * message that is not GRIB edition 2 or whose walk does not advance. */
export function grib2Sections(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (b[0] !== 0x47 || b[1] !== 0x52 || b[2] !== 0x49 || b[3] !== 0x42)
    throw new Error('not a GRIB2 message');
  if (b[7] !== 2) throw new Error('not GRIB edition 2');
  const secs = {};
  let o = 16;
  while (o < b.length - 4) {
    if (b[o] === 0x37 && b[o + 1] === 0x37 && b[o + 2] === 0x37 && b[o + 3] === 0x37) break;
    const len = u32(b, o);
    if (!(len >= 5)) throw new Error(`corrupt GRIB2 section length ${len}`);
    secs[b[o + 4]] = {pos: o, len};
    o += len;
  }
  return secs;
}
/** The message's head without its data: the reference time, the
 * parameter (discipline, category, number), the grid (template 3.0)
 * and the data representation (template 5.0 or 5.41 fields). */
export function grib2Header(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const secs = grib2Sections(b);
  const h = {discipline: b[6], secs};
  if (secs[1]) {
    const o = secs[1].pos;
    h.refTime = {y: u16(b, o + 12), m: b[o + 14], d: b[o + 15], H: b[o + 16], M: b[o + 17], S: b[o + 18]};
    h.refTimeIso = `${String(h.refTime.y).padStart(4, '0')}-${String(h.refTime.m).padStart(2, '0')}-${String(h.refTime.d).padStart(2, '0')}T${String(h.refTime.H).padStart(2, '0')}:${String(h.refTime.M).padStart(2, '0')}:${String(h.refTime.S).padStart(2, '0')}Z`;
  }
  if (secs[3]) {
    const o = secs[3].pos;
    const tmpl = u16(b, o + 12);
    if (tmpl !== 0) throw new Error(`unsupported grid template 3.${tmpl}`);
    const scan = b[o + 71];
    h.grid = {
      n: u32(b, o + 6),
      ni: u32(b, o + 30),
      nj: u32(b, o + 34),
      la1: sm32(b, o + 46) * MICRO,
      lo1: sm32(b, o + 50) * MICRO,
      la2: sm32(b, o + 55) * MICRO,
      lo2: sm32(b, o + 59) * MICRO,
      di: u32(b, o + 63) * MICRO,
      dj: u32(b, o + 67) * MICRO,
      iNeg: !!(scan & 0x80),
      jPos: !!(scan & 0x40),
      scan
    };
  }
  if (secs[4]) {
    const o = secs[4].pos;
    h.productTemplate = u16(b, o + 7);
    h.paramCategory = b[o + 9];
    h.paramNumber = b[o + 10];
  }
  if (secs[5]) {
    const o = secs[5].pos;
    h.drt = {
      tmpl: u16(b, o + 9),
      n: u32(b, o + 5),
      R: f32(b, o + 11),
      E: sm16(b, o + 15),
      D: sm16(b, o + 17),
      nbits: b[o + 19]
    };
  }
  if (secs[6]) h.bitmapIndicator = b[secs[6].pos + 5];
  return h;
}
/** The PNG's header and IDAT chunks: {width, height, depth, ctype,
 * idat: Uint8Array[]}. */
export function pngChunks(png) {
  if (u32(png, 0) !== 0x89504e47) throw new Error('not a PNG');
  const out = {idat: []};
  let p = 8;
  while (p + 8 <= png.length) {
    const len = u32(png, p);
    const type = String.fromCharCode(png[p + 4], png[p + 5], png[p + 6], png[p + 7]);
    const data = png.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      out.width = u32(data, 0);
      out.height = u32(data, 4);
      out.depth = data[8];
      out.ctype = data[9];
    } else if (type === 'IDAT') out.idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  return out;
}
const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
/** Unfilter one PNG row in place: `cur` receives the row's bytes from
 * `src` (the row without its filter byte) against `prev`, the row
 * above (zeros for the first). Exported for the gate. */
export function pngUnfilterRow(ft, src, prev, cur, bpp) {
  const n = src.length;
  for (let x = 0; x < n; x++) {
    const a = x >= bpp ? cur[x - bpp] : 0;
    const up = prev[x];
    const c = x >= bpp ? prev[x - bpp] : 0;
    let v = src[x];
    if (ft === 1) v += a;
    else if (ft === 2) v += up;
    else if (ft === 3) v += (a + up) >> 1;
    else if (ft === 4) v += paeth(a, up, c);
    else if (ft !== 0) throw new Error(`PNG filter type ${ft}`);
    cur[x] = v & 255;
  }
}
/** Rows [j0, j1) and columns [i0, i1) of a 16-bit greyscale PNG as
 * raw counts (Uint16Array, row-major), streaming through an injected
 * inflater (node's zlib.createInflate: an object with on('data'),
 * on('error'), on('end'), write(chunk) -> boolean, once('drain'),
 * end(), close()). Resolves {counts, rowsRead, chunks}. */
export function pngWindow16(png, j0, j1, i0, i1, {createInflate} = {}) {
  if (typeof createInflate !== 'function') throw new Error('pngWindow16 needs createInflate');
  const c = pngChunks(png);
  if (c.depth !== 16 || c.ctype !== 0)
    throw new Error(`unsupported PNG ${c.depth}-bit colour type ${c.ctype}`);
  if (j0 < 0 || i0 < 0 || j1 > c.height || i1 > c.width || j1 <= j0 || i1 <= i0)
    throw new Error('PNG window outside the image');
  const bpp = 2;
  const width = c.width;
  const rowLen = width * bpp;
  const rowBytes = 1 + rowLen;
  const cols = i1 - i0;
  const out = new Uint16Array((j1 - j0) * cols);
  return new Promise((resolve, reject) => {
    const inf = createInflate();
    let prev = new Uint8Array(rowLen);
    let cur = new Uint8Array(rowLen);
    let pending = new Uint8Array(0);
    let row = 0;
    let done = false;
    let chunks = 0;
    const finish = (err) => {
      if (done) return;
      done = true;
      try {
        inf.close();
      } catch {
        // already closed
      }
      if (err) reject(err);
      else resolve({counts: out, rowsRead: row, chunks});
    };
    const consume = (chunk) => {
      let data;
      if (pending.length) {
        data = new Uint8Array(pending.length + chunk.length);
        data.set(pending, 0);
        data.set(chunk, pending.length);
      } else data = chunk;
      let off = 0;
      while (data.length - off >= rowBytes && row < j1) {
        pngUnfilterRow(data[off], data.subarray(off + 1, off + rowBytes), prev, cur, bpp);
        if (row >= j0) {
          const base = (row - j0) * cols;
          for (let i = i0; i < i1; i++) out[base + i - i0] = (cur[i * 2] << 8) | cur[i * 2 + 1];
        }
        const t = prev;
        prev = cur;
        cur = t;
        row++;
        off += rowBytes;
      }
      pending = row < j1 ? data.slice(off) : new Uint8Array(0);
      if (row >= j1) finish();
    };
    inf.on('data', (chunk) => {
      chunks++;
      if (done) return;
      try {
        consume(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
      } catch (e) {
        finish(e);
      }
    });
    inf.on('error', (e) => finish(e));
    inf.on('end', () => finish(row >= j1 ? null : new Error(`PNG ended at row ${row} of ${j1}`)));
    (async () => {
      for (const d of c.idat) {
        if (done) break;
        if (!inf.write(d)) await new Promise((r) => inf.once('drain', r));
      }
      if (!done) inf.end();
    })().catch((e) => finish(e));
  });
}
/** A window of a template-5.41 message around (lat, lon), halfCells
 * each way, clipped to the grid: {values (Float64Array of physical
 * values), box: {j0, j1, i0, i1, cj, ci, rows, cols}, header}. The
 * grid's rows must run from the north (scan bit 2 clear), as MRMS's
 * do; the cell containing the point is floor(x + 0.5). null when the
 * point lies outside the grid. */
export async function grib2Window(buf, lat, lon, halfCells, opts = {}) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const h = grib2Header(b);
  const g = h.grid;
  const d = h.drt;
  if (!g || !d) throw new Error('grid or data representation missing');
  if (d.tmpl !== 41) throw new Error(`unsupported data representation template 5.${d.tmpl} for a window`);
  if (g.jPos || g.iNeg) throw new Error('window needs rows from the north and columns eastward');
  if (h.bitmapIndicator !== undefined && h.bitmapIndicator !== 255)
    throw new Error(`unsupported bitmap indicator ${h.bitmapIndicator}`);
  const lo = ((lon % 360) + 360) % 360;
  const cj = Math.floor((g.la1 - lat) / g.dj + 0.5);
  const ci = Math.floor((lo - g.lo1) / g.di + 0.5);
  if (cj < 0 || cj >= g.nj || ci < 0 || ci >= g.ni) return null;
  const j0 = Math.max(0, cj - halfCells);
  const j1 = Math.min(g.nj, cj + halfCells + 1);
  const i0 = Math.max(0, ci - halfCells);
  const i1 = Math.min(g.ni, ci + halfCells + 1);
  const s7 = h.secs[7];
  const png = b.subarray(s7.pos + 5, s7.pos + s7.len);
  const w = await pngWindow16(png, j0, j1, i0, i1, opts);
  const scale = 2 ** d.E / 10 ** d.D;
  const R = d.R / 10 ** d.D;
  const values = new Float64Array(w.counts.length);
  for (let k = 0; k < values.length; k++) values[k] = R + w.counts[k] * scale;
  return {
    values,
    box: {j0, j1, i0, i1, cj, ci, rows: j1 - j0, cols: i1 - i0},
    header: {refTimeIso: h.refTimeIso, discipline: h.discipline, paramCategory: h.paramCategory, paramNumber: h.paramNumber, grid: g, drt: d},
    rowsRead: w.rowsRead,
    chunks: w.chunks
  };
}
