// Reference gate for grib2.js (node grib2-reference.mjs). Two
// independent anchors:
//  - a LIVE GEFS-Aerosols subset (grib2-fixture.mjs) decoded by
//    ECMWF ecCodes at capture time - every message's parameter
//    identity, wavelength interval, and texel values held to 1e-12,
//    including one full 81-value grid
//  - SYNTHETIC messages built octet-by-octet from the WMO FM 92
//    GRIB2 spec to exercise what the live file does not: negative
//    sign-magnitude fields (binary/decimal scale, latitudes), a
//    section-6 bitmap with holes, a 0-bit constant field, and
//    longitude folding across the 0/360 seam
import {gridValue, parseGrib2} from './grib2.js';
import {AER_SUBSET_B64, GRID4, PINS} from './grib2-fixture.mjs';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const bytes = Uint8Array.from(atob(AER_SUBSET_B64), (c) => c.charCodeAt(0));
const msgs = parseGrib2(bytes);

{
  // Every live message against the ecCodes pins.
  let metaBad = 0;
  let worst = 0;
  for (let i = 0; i < PINS.length; i++) {
    const m = msgs[i];
    const p = PINS[i];
    if (
      m.paramCategory !== p.cat ||
      m.paramNumber !== p.num ||
      m.aerosolType !== p.aero ||
      Math.abs(m.wavelength.lo - p.wlLo) > 1e-20 ||
      Math.abs(m.wavelength.hi - p.wlHi) > 1e-20
    )
      metaBad++;
    for (const [k, idx] of [
      ['v0', 0],
      ['v40', 40],
      ['v80', 80]
    ])
      worst = Math.max(worst, Math.abs(m.values[idx] - p[k]));
    let mn = Infinity;
    let mx = -Infinity;
    for (const v of m.values) {
      mn = Math.min(mn, v);
      mx = Math.max(mx, v);
    }
    worst = Math.max(worst, Math.abs(mn - p.min), Math.abs(mx - p.max));
  }
  for (let k = 0; k < GRID4.length; k++)
    worst = Math.max(worst, Math.abs(msgs[4].values[k] - GRID4[k]));
  const g = msgs[0].grid;
  const t = msgs[0].refTime;
  check(
    'live fixture vs ecCodes',
    msgs.length === 20 &&
      metaBad === 0 &&
      worst < 1e-12 &&
      g.ni === 9 &&
      g.nj === 9 &&
      g.la1 === 46 &&
      g.lo1 === 7 &&
      g.di === 0.25 &&
      g.jPos === true &&
      g.iNeg === false &&
      msgs[0].forecastHours === 3 &&
      t.y === 2026 &&
      t.m === 7 &&
      t.d === 9 &&
      t.H === 12,
    `20 GEFS-Aerosols messages, identity+wavelength exact, values (incl. a full 81-texel grid) to ${worst.toExponential(1)} of the ecCodes decode; grid 9x9 @0.25deg from (46N, 7E), cycle 2026-07-09 12z f003`
  );
}

{
  // Nearest-cell extraction on the live 550 nm total-AOT message:
  // (46.5828N, 8.04E) must land on cell (j=2, i=4) = index 22.
  const m = msgs[4];
  const want = m.values[2 * 9 + 4];
  check(
    'nearest cell',
    gridValue(m, 46.5828, 8.04) === want &&
      Number.isNaN(gridValue(m, 40, 8.04)),
    `Grindelwald reads texel (j2, i4) = ${want} exactly; a point off the grid reads NaN`
  );
}

// ---- synthetic message builder (spec octets, 1-based comments) ----
function synth({R, E, D, nbits, xs, bitmap, la1, lo1, dj, di, ni, nj, scan}) {
  const out = [];
  const push = (...b) => out.push(...b);
  const p16 = (v) => push((v >> 8) & 255, v & 255);
  const p32 = (v) =>
    push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  const sm32 = (v) => p32(v < 0 ? 0x80000000 | -v : v);
  const sm16v = (v) => p16(v < 0 ? 0x8000 | -v : v);
  // sec 0 (16): GRIB, reserved, discipline 0, edition 2, length (patched)
  push(0x47, 0x52, 0x49, 0x42, 0, 0, 0, 2);
  push(0, 0, 0, 0, 0, 0, 0, 0);
  // sec 1 (21): centre 7, subcentre, tables, refTime 2026-07-09 12:00
  const s1 = out.length;
  p32(21);
  push(1);
  p16(7);
  p16(0);
  push(2, 1, 1);
  p16(2026);
  push(7, 9, 12, 0, 0, 0, 1);
  if (out.length - s1 !== 21) throw new Error('sec1 length');
  // sec 3: template 3.0
  const s3 = out.length;
  p32(72);
  push(3, 0);
  p32(ni * nj);
  push(0, 0);
  p16(0);
  push(6, 0);
  p32(0);
  push(0);
  p32(0);
  push(0);
  p32(0);
  p32(ni);
  p32(nj);
  p32(0);
  p32(0);
  sm32(Math.round(la1 * 1e6));
  sm32(Math.round(lo1 * 1e6));
  push(0x30);
  sm32(Math.round((la1 + (scan & 0x40 ? 1 : -1) * (nj - 1) * dj) * 1e6));
  sm32(Math.round((lo1 + (ni - 1) * di) * 1e6));
  p32(Math.round(di * 1e6));
  p32(Math.round(dj * 1e6));
  push(scan);
  if (out.length - s3 !== 72) throw new Error('sec3 length');
  // sec 4: template 4.48, AOTK (20/102), aerosol 62000, wl 550nm, +3h
  const s4 = out.length;
  p32(58);
  push(4);
  p16(0);
  p16(48);
  push(20, 102);
  p16(62000);
  push(2, 0);
  p32(0);
  push(0);
  p32(0);
  push(2, 9);
  p32(545);
  push(9);
  p32(565);
  push(2, 0, 0);
  p16(0);
  push(0, 1);
  p32(3);
  push(10, 0);
  p32(0);
  push(255, 0);
  p32(0);
  if (out.length - s4 !== 58) throw new Error('sec4 length');
  // sec 5: template 5.0
  p32(21);
  push(5);
  p32(xs.length);
  p16(0);
  const rb = new DataView(new ArrayBuffer(4));
  rb.setFloat32(0, R, false);
  push(rb.getUint8(0), rb.getUint8(1), rb.getUint8(2), rb.getUint8(3));
  sm16v(E);
  sm16v(D);
  push(nbits, 0);
  // sec 6
  if (bitmap) {
    const bm = new Uint8Array(Math.ceil(bitmap.length / 8));
    bitmap.forEach((on, i) => {
      if (on) bm[i >> 3] |= 0x80 >> (i & 7);
    });
    p32(6 + bm.length);
    push(6, 0, ...bm);
  } else {
    p32(6);
    push(6, 255);
  }
  // sec 7: packed data
  let bits = [];
  for (const x of xs)
    for (let k = nbits - 1; k >= 0; k--) bits.push((x >> k) & 1);
  const db = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((v, i) => {
    if (v) db[i >> 3] |= 0x80 >> (i & 7);
  });
  p32(5 + db.length);
  push(7, ...db);
  push(0x37, 0x37, 0x37, 0x37);
  const buf = Uint8Array.from(out);
  const dv = new DataView(buf.buffer);
  dv.setUint32(12, buf.length, false);
  return buf;
}

{
  // Negative binary/decimal scale + negative reference + southern
  // latitudes, values Y = (R + X*2^E) / 10^D from the spec.
  const xs = [0, 3, 7, 12, 1, 5];
  const R = -3.5;
  const E = -2;
  const D = 1;
  const m = parseGrib2(
    synth({
      R,
      E,
      D,
      nbits: 4,
      xs,
      la1: -10,
      lo1: 350,
      di: 0.5,
      dj: 0.5,
      ni: 3,
      nj: 2,
      scan: 0x40
    })
  )[0];
  let worst = 0;
  for (let i = 0; i < xs.length; i++)
    worst = Math.max(
      worst,
      Math.abs(m.values[i] - (R + xs[i] * 2 ** E) / 10 ** D)
    );
  check(
    'sign-magnitude packing',
    worst < 1e-12 &&
      m.grid.la1 === -10 &&
      m.aerosolType === 62000 &&
      m.forecastHours === 3,
    `E=-2, D=1, R=-3.5 decode to ${worst.toExponential(1)}; southern latitude -10 survives the sign-magnitude read`
  );
}

{
  // Bitmap holes -> NaN in place, packed values land on set cells
  // only; and a 0-bit field is the constant R/10^D everywhere.
  const m = parseGrib2(
    synth({
      R: 2,
      E: 0,
      D: 0,
      nbits: 3,
      xs: [1, 2, 3],
      bitmap: [1, 0, 1, 0, 0, 1],
      la1: 46,
      lo1: 7,
      di: 0.25,
      dj: 0.25,
      ni: 3,
      nj: 2,
      scan: 0x40
    })
  )[0];
  const want = [3, NaN, 4, NaN, NaN, 5];
  const ok = want.every((w, i) =>
    Number.isNaN(w) ? Number.isNaN(m.values[i]) : m.values[i] === w
  );
  const c = parseGrib2(
    synth({
      R: 42,
      E: 0,
      D: 1,
      nbits: 0,
      xs: [0, 0, 0, 0, 0, 0],
      la1: 46,
      lo1: 7,
      di: 0.25,
      dj: 0.25,
      ni: 3,
      nj: 2,
      scan: 0x40
    })
  )[0];
  check(
    'bitmap and constant field',
    ok && c.values.length === 6 && c.values.every((v) => v === 4.2),
    `holes read NaN, set cells read [3, 4, 5]; a 0-bit field is R/10^D = 4.2 at all 6 points`
  );
}

{
  // Longitude folding: a grid starting at 350E must serve a query
  // at -7.75 (= 352.25E), and a jPos=false grid counts rows from
  // the north edge.
  const m = parseGrib2(
    synth({
      R: 0,
      E: 0,
      D: 0,
      nbits: 4,
      xs: [0, 1, 2, 3, 4, 5],
      la1: -10,
      lo1: 350,
      di: 0.5,
      dj: 0.5,
      ni: 3,
      nj: 2,
      scan: 0x40
    })
  )[0];
  const n = parseGrib2(
    synth({
      R: 0,
      E: 0,
      D: 0,
      nbits: 4,
      xs: [0, 1, 2, 3, 4, 5],
      la1: 48,
      lo1: 7,
      di: 0.25,
      dj: 0.25,
      ni: 3,
      nj: 2,
      scan: 0x00
    })
  )[0];
  check(
    'longitude folding and scan',
    gridValue(m, -9.5, -9) === 5 && gridValue(n, 47.75, 7.25) === 4,
    `-9E folds onto the 350..351E grid (row j=1, col i=2 -> 5); a north-first grid reads row 1 for lat 47.75 -> 4`
  );
}

process.exit(fail ? 1 : 0);
