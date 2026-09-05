// hdf5-reference.mjs - the gate for hdf5.js (148th pass): the pure
// reader held to what h5py (the HDF Group's own library underneath)
// read from the SAME bytes - a real NOAA GOES-18 cloud-top-height
// file vendored verbatim, and two small files h5py wrote with its
// earliest and latest library bounds. Every dataset's shape, type,
// chunking, filter chain, fill count, sum, minimum, maximum, sampled
// values and CF attributes must match; a layout the reader cannot
// read must be NAMED, not guessed.
import {inflateSync} from 'node:zlib';
import {openHdf5, physicalValues, unshuffle} from './hdf5.js';
import {
  ACHAC_B64,
  ACHAC_EXPECT,
  ACHAC_NAME,
  SYN_EARLIEST_B64,
  SYN_EXPECT,
  SYN_LATEST_B64
} from './hdf5-fixture.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const inflate = (u8) =>
  new Uint8Array(
    inflateSync(Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength))
  );
const bytesOf = (b64) => new Uint8Array(Buffer.from(b64, 'base64'));
const stats = (values, fill) => {
  let fillN = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (fill !== undefined && v === fill) {
      fillN++;
      continue;
    }
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return {fillN, sum, min, max};
};
const scalarAttr = (a) => (Array.isArray(a) ? a[0] : a);

// ---- the shuffle filter's inverse ------------------------------
{
  // three 4-byte elements 0x01020304, 0x05060708, 0x090a0b0c stored
  // byte-plane by byte-plane
  const planes = new Uint8Array([4, 8, 12, 3, 7, 11, 2, 6, 10, 1, 5, 9]);
  const back = unshuffle(planes, 4);
  check(
    'THE SHUFFLE FILTER inverts byte-plane storage',
    Array.from(back).join(',') === '4,3,2,1,8,7,6,5,12,11,10,9' &&
      unshuffle(planes, 1) === planes,
    `three little-endian words come back in element order from their byte planes; an element ` +
      `size of 1 is the identity`
  );
}

// ---- the real product file -------------------------------------
{
  const t0 = Date.now();
  const bytes = bytesOf(ACHAC_B64);
  const f = openHdf5(bytes, inflate);
  const ms = Date.now() - t0;
  const E = ACHAC_EXPECT.datasets;
  const names = f.names();
  const problems = [];
  for (const name of Object.keys(E)) {
    const e = E[name];
    const d = f.dataset(name);
    if (!d) {
      problems.push(name + ' missing');
      continue;
    }
    if (JSON.stringify(d.shape) !== JSON.stringify(e.shape))
      problems.push(`${name} shape ${JSON.stringify(d.shape)}`);
    // numpy's names ('>f4', 'uint16') against the reader's
    const dt = e.dtype
      .replace(/^[<>|=]/, '')
      .replace(/^f4$/, 'float32')
      .replace(/^f8$/, 'float64')
      .replace(/^i(\d)$/, (m, n) => 'int' + n * 8)
      .replace(/^u(\d)$/, (m, n) => 'uint' + n * 8);
    if (d.dtype !== dt) problems.push(`${name} dtype ${d.dtype} vs ${dt}`);
    if (e.dtype.startsWith('>') && d.littleEndian)
      problems.push(`${name} byte order`);
    if (JSON.stringify(d.chunks) !== JSON.stringify(e.chunks))
      problems.push(`${name} chunks ${JSON.stringify(d.chunks)}`);
    const wantFilters =
      e.compression === 'gzip' ? (e.shuffle ? [2, 1] : [1]) : [];
    if (JSON.stringify(d.filters) !== JSON.stringify(wantFilters))
      problems.push(`${name} filters ${JSON.stringify(d.filters)}`);
    const v = d.values;
    if (!v || v.unread) {
      problems.push(`${name} unread ${v && v.unread}`);
      continue;
    }
    if (e.shape.length === 0) {
      if (!near(v[0], e.value, 1e-9 * Math.max(1, Math.abs(e.value))))
        problems.push(`${name} value ${v[0]} vs ${e.value}`);
    } else if (e.shape.length === 1) {
      if (!near(v[0], e.first, 1e-6) || !near(v[v.length - 1], e.last, 1e-6))
        problems.push(`${name} ends ${v[0]} ${v[v.length - 1]}`);
    } else {
      const s = stats(v, scalarAttr(d.attrs._FillValue));
      if (s.fillN !== e.fillCount)
        problems.push(`${name} fill ${s.fillN} vs ${e.fillCount}`);
      if (s.sum !== e.sum) problems.push(`${name} sum ${s.sum} vs ${e.sum}`);
      if (s.min !== e.min || s.max !== e.max)
        problems.push(`${name} range ${s.min}..${s.max}`);
      for (const [i, j, x] of e.samples)
        if (v[i * d.shape[1] + j] !== x)
          problems.push(`${name}[${i},${j}] ${v[i * d.shape[1] + j]} vs ${x}`);
    }
    for (const [k, want] of Object.entries(e.attrs)) {
      const got = d.attrs[k];
      const ok =
        typeof want === 'string'
          ? got === want
          : Array.isArray(want)
            ? want.length === 1
              ? near(
                  scalarAttr(got),
                  want[0],
                  1e-9 * Math.max(1, Math.abs(want[0]))
                )
              : Array.isArray(got) &&
                got.length === want.length &&
                got.every((x, q) =>
                  near(x, want[q], 1e-9 * Math.max(1, Math.abs(want[q])))
                )
            : got === want;
      if (!ok)
        problems.push(
          `${name}.${k} ${JSON.stringify(got)} vs ${JSON.stringify(want)}`
        );
    }
  }
  const ht = f.dataset('HT');
  const phys = physicalValues(ht);
  let nanN = 0;
  let sum = 0;
  for (const x of phys) {
    if (Number.isNaN(x)) nanN++;
    else sum += x;
  }
  const meanM = sum / (phys.length - nanN);
  const g = f.dataset('goes_imager_projection').attrs;
  const root = f.rootAttrs();
  check(
    'THE PRODUCT FILE reads as h5py reads it',
    f.superblock.version === 2 &&
      names.length === 36 &&
      problems.length === 0 &&
      f.skipped.length === 0 &&
      nanN === E.HT.fillCount &&
      near(meanM, E.HT.mean * E.HT.attrs.scale_factor[0], 1e-3) &&
      scalarAttr(g.perspective_point_height) === 35786023 &&
      scalarAttr(g.longitude_of_projection_origin) === -137 &&
      g.sweep_angle_axis === 'x' &&
      root.platform_ID === ACHAC_EXPECT.globalAttrs.platform_ID &&
      root.time_coverage_start ===
        ACHAC_EXPECT.globalAttrs.time_coverage_start &&
      root.scene_id === 'CONUS',
    problems.length
      ? problems.slice(0, 6).join('; ')
      : `${ACHAC_NAME}: superblock 2, ${names.length} variables through the group's fractal heap and ` +
          `name index, ${Object.keys(E).length} checked - HT 300x500 uint16 in one 262-row chunk plus ` +
          `an edge chunk, shuffle then deflate, ${E.HT.fillCount} fill, sum ${E.HT.sum}, ten sampled ` +
          `pixels, dense attributes (scale 0.3052037 m, fill 65535); DQF; the int16 scan-angle axes; ` +
          `scalars t, subpoint -137, LZA bounds [0, 70]; a big-endian float; the projection's dense ` +
          `attributes; the root's dense attributes (${root.platform_ID}, ${root.scene_id}, ` +
          `${root.time_coverage_start}); physical HT mean ${meanM.toFixed(1)} m over the ` +
          `${phys.length - nanN} retrieved pixels; ${ms} ms`
  );
}

// ---- h5py's own files: earliest and latest ---------------------
{
  const E = SYN_EXPECT.earliest;
  const f = openHdf5(bytesOf(SYN_EARLIEST_B64), inflate);
  const m = f.dataset('mask');
  const h = f.dataset('height');
  const be = f.dataset('bigend');
  const x = f.dataset('x');
  const t = f.dataset('t');
  const p = f.dataset('proj');
  const sum = (a) => {
    let s = 0;
    for (const v of a) s += v;
    return s;
  };
  const hist = {};
  for (const v of m.values) hist[v] = (hist[v] || 0) + 1;
  const root = f.rootAttrs();
  check(
    "H5PY'S EARLIEST FILE: symbol-table group, v1 headers, fletcher32, big-endian, vlen strings",
    f.superblock.version === 0 &&
      f.names().sort().join(',') === E.names.join(',') &&
      JSON.stringify(m.chunks) === JSON.stringify(E.mask.chunks) &&
      JSON.stringify(m.filters) === '[2,1]' &&
      sum(m.values) === E.mask.sum &&
      JSON.stringify(hist) === JSON.stringify(E.mask.hist) &&
      E.mask.samples.every(([i, j, v]) => m.values[i * 23 + j] === v) &&
      scalarAttr(m.attrs._FillValue) === 255 &&
      m.attrs.flag_meanings === E.mask.flag_meanings &&
      JSON.stringify(h.filters) === '[2,1,3]' &&
      sum(h.values) === E.height.sum &&
      E.height.samples.every(([i, j, v]) => h.values[i * 11 + j] === v) &&
      near(scalarAttr(h.attrs.scale_factor), E.height.scale, 1e-7) &&
      JSON.stringify(h.attrs.valid_range) ===
        JSON.stringify(E.height.valid_range) &&
      h.attrs.units === 'm' &&
      !be.littleEndian &&
      E.bigend.every((v, i) => near(be.values[i], v, 1e-7)) &&
      Array.from(x.values).join(',') === E.x.join(',') &&
      near(t.values[0], E.t, 1e-6) &&
      near(scalarAttr(p.attrs.perspective_point_height), 35786023) &&
      p.attrs.sweep_angle_axis === 'x' &&
      near(scalarAttr(p.attrs.inverse_flattening), 298.2572221, 1e-9) &&
      root.title === E.title &&
      root.count === 3,
    `superblock 0; ${E.names.length} datasets through the old-style symbol table; the 17x23 uint8 mask in ` +
      `5x7 chunks (edge chunks clipped) sums to ${E.mask.sum} with h5py's histogram; the uint16 heights ` +
      `through shuffle, deflate AND fletcher32 sum to ${E.height.sum}; a big-endian float32 vector; ` +
      `variable-length string attributes through the global heap ("${root.title}")`
  );
}
{
  const E = SYN_EXPECT.latest;
  const f = openHdf5(bytesOf(SYN_LATEST_B64), inflate);
  const m = f.dataset('mask');
  const x = f.dataset('x');
  const p = f.dataset('proj');
  check(
    "H5PY'S LATEST FILE: the reader names what it cannot read",
    f.superblock.version === 3 &&
      f.names().sort().join(',') === E.names.join(',') &&
      m.values &&
      typeof m.values.unread === 'string' &&
      /layout version [45]/.test(m.values.unread) &&
      scalarAttr(m.attrs._FillValue) === 255 &&
      m.attrs.flag_meanings === E.mask.flag_meanings &&
      Array.from(x.values).join(',') === E.x.join(',') &&
      p.attrs.sweep_angle_axis === 'x' &&
      f.rootAttrs().title === E.title,
    `superblock 3 with v2 headers and link messages: the contiguous and attribute paths read ` +
      `(x, the projection's attributes, the root's title), and the chunked datasets answer ` +
      `"${m.values.unread}" - HDF5 1.10+ chunk indexes are outside the reader, stated, never guessed`
  );
}

process.exit(fail ? 1 : 0);
