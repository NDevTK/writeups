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
