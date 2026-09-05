/**
 * hdf5.js - a reader for the HDF5 files NOAA's GOES-R Level 2
 * products are written in (NetCDF-4 = HDF5 as netCDF 4.9 / HDF5 1.14
 * write it), enough to read a product's datasets, their attributes
 * and the group's links with no library at all: the daemon and the
 * gate call it with node's zlib, the page could with pako. Written
 * from the HDF5 File Format Specification (version 3, the HDF Group)
 * and held, in hdf5-reference.mjs, to what h5py reads from the same
 * bytes - every dataset's shape, type, chunking, filters, fill
 * count, sum, sampled values and attributes (148th pass).
 *
 * WHAT IS READ:
 *  - superblock versions 0, 1 (the root symbol-table entry) and 2, 3
 *  - object headers version 1 and version 2 ("OHDR" with its
 *    continuation blocks "OCHK"), the messages: dataspace (1 and 2),
 *    datatype (fixed point, floating point, string; references and
 *    others are named and skipped), fill value, link, link info,
 *    attribute (1 and 3), attribute info, layout version 3 (compact,
 *    contiguous, chunked), filter pipeline (1 and 2), symbol table
 *  - the fractal heap ("FRHP" with "FHIB" indirect and "FHDB" direct
 *    blocks) that new-style groups keep their links in and dense
 *    attribute storage keeps its attributes in, read as a SEQUENCE of
 *    managed objects in the direct blocks - what a freshly written
 *    file holds (no free-space fragments between objects: the heap's
 *    own managed-object count says when all are read); tiny and huge
 *    objects are not read (an attribute longer than the heap's
 *    managed limit is skipped, named)
 *  - old-style groups: the symbol table's local heap and v1 B-tree of
 *    symbol-table nodes ("SNOD")
 *  - chunked datasets through the version-1 B-tree ("TREE") chunk
 *    index, each chunk run back through its pipeline: deflate (id 1,
 *    the inflate the caller supplies), shuffle (id 2, the byte
 *    de-interleave), fletcher32 (id 3, the 4-byte checksum dropped,
 *    not verified - stated); edge chunks clipped to the dataset
 *
 * NOT READ (stated): layout version 4 indexes (fixed/extensible
 * arrays, v2 B-trees - HDF5 1.10+ "latest" files), compound and
 * variable-length types, huge/tiny heap objects, external files.
 * Everything unknown is reported by name in the result, never guessed.
 *
 * All multi-byte integers are little-endian in the file format;
 * datasets and attributes carry their own byte order in the datatype
 * message and are decoded accordingly.
 */

const dec = new TextDecoder();

class Reader {
  constructor(bytes) {
    this.b = bytes;
    this.v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  u8(p) {
    return this.b[p];
  }
  u16(p) {
    return this.v.getUint16(p, true);
  }
  u32(p) {
    return this.v.getUint32(p, true);
  }
  u64(p) {
    const lo = this.v.getUint32(p, true);
    const hi = this.v.getUint32(p + 4, true);
    return hi * 4294967296 + lo;
  }
  // an "undefined address" is all ones
  addr(p, size = 8) {
    if (size === 8) {
      const lo = this.v.getUint32(p, true);
      const hi = this.v.getUint32(p + 4, true);
      if (lo === 0xffffffff && hi === 0xffffffff) return null;
      return hi * 4294967296 + lo;
    }
    const x = this.uint(p, size);
    return x === 2 ** (8 * size) - 1 ? null : x;
  }
  // an unsigned little-endian integer of any byte width (heap
  // offsets are 5 bytes in the products' attribute heaps)
  uint(p, size) {
    if (size === 1) return this.u8(p);
    if (size === 2) return this.u16(p);
    if (size === 4) return this.u32(p);
    if (size === 8) return this.u64(p);
    let x = 0;
    for (let i = size - 1; i >= 0; i--) x = x * 256 + this.b[p + i];
    return x;
  }
  str(p, n) {
    return dec.decode(this.b.subarray(p, p + n));
  }
  sig(p) {
    return this.str(p, 4);
  }
}

// ---------------------------------------------------------------
// The superblock
// ---------------------------------------------------------------
export const HDF5_SIGNATURE = [0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a];
export function readSuperblock(r) {
  if (!HDF5_SIGNATURE.every((x, i) => r.u8(i) === x))
    throw new Error('not an HDF5 file');
  const version = r.u8(8);
  if (version === 0 || version === 1) {
    const so = r.u8(13);
    const sl = r.u8(14);
    let p = 24;
    if (version === 1) p += 4;
    const base = r.addr(p, so);
    p += so * 4; // base, free-space info, EOF, driver info
    // the root group's symbol table entry
    const ent = readSymbolEntry(r, p, so);
    return {version, so, sl, base: base ?? 0, root: ent.ohdr};
  }
  if (version === 2 || version === 3) {
    const so = r.u8(9);
    const sl = r.u8(10);
    const base = r.addr(12, so) ?? 0;
    const root = r.addr(12 + 3 * so, so);
    return {version, so, sl, base, root};
  }
  throw new Error('superblock version ' + version);
}
function readSymbolEntry(r, p, so) {
  const nameOff = r.uint(p, so);
  const ohdr = r.addr(p + so, so);
  const cacheType = r.u32(p + 2 * so);
  const scratch = p + 2 * so + 8;
  const out = {nameOff, ohdr, cacheType, size: 2 * so + 8 + 16};
  if (cacheType === 1) {
    out.btree = r.addr(scratch, so);
    out.heap = r.addr(scratch + so, so);
  }
  return out;
}

// ---------------------------------------------------------------
// Object headers (v1 and v2) -> messages
// ---------------------------------------------------------------
export function readObjectHeader(r, addr, so, sl) {
  const msgs = [];
  if (r.sig(addr) === 'OHDR') {
    const version = r.u8(addr + 4);
    if (version !== 2) throw new Error('OHDR version ' + version);
    const flags = r.u8(addr + 5);
    let p = addr + 6;
    if (flags & 0x20) p += 16; // access/modification/change/birth times
    if (flags & 0x10) p += 4; // attribute phase-change thresholds
    const csize = [1, 2, 4, 8][flags & 3];
    const chunk0 = r.uint(p, csize);
    p += csize;
    const parseChunk = (start, len) => {
      let q = start;
      const end = start + len;
      while (q + 4 <= end) {
        const type = r.u8(q);
        const size = r.u16(q + 1);
        const mflags = r.u8(q + 3);
        q += 4;
        if (flags & 4) q += 2; // creation order
        if (type === 0x10) {
          // continuation: another chunk "OCHK" of (address, length)
          const a = r.addr(q, so);
          const n = r.uint(q + so, sl);
          if (a !== null && r.sig(a) === 'OCHK') parseChunk(a + 4, n - 4 - 4);
        } else msgs.push({type, size, flags: mflags, p: q});
        q += size;
      }
    };
    parseChunk(p, chunk0 - 4); // the chunk ends with a 4-byte checksum
    return {version: 2, msgs};
  }
  const version = r.u8(addr);
  if (version !== 1) throw new Error('object header version ' + version);
  const nmsgs = r.u16(addr + 2);
  const size = r.u32(addr + 8);
  let p = addr + 16; // header is 12 bytes padded to 16
  const parseV1 = (start, len, remaining) => {
    let q = start;
    const end = start + len;
    let n = 0;
    while (q + 8 <= end && n < remaining) {
      const type = r.u16(q);
      const msize = r.u16(q + 2);
      const mflags = r.u8(q + 4);
      q += 8;
      n++;
      if (type === 0x10) {
        const a = r.addr(q, so);
        const sz = r.uint(q + so, sl);
        if (a !== null) n += parseV1(a, sz, remaining - n);
      } else msgs.push({type, size: msize, flags: mflags, p: q});
      q += msize;
    }
    return n;
  };
  parseV1(p, size, nmsgs);
  return {version: 1, msgs};
}

// ---------------------------------------------------------------
// Messages
// ---------------------------------------------------------------
export function readDataspace(r, p, sl) {
  const version = r.u8(p);
  const rank = r.u8(p + 1);
  const flags = r.u8(p + 2);
  let q;
  let type = 1; // simple
  if (version === 1) q = p + 8;
  else {
    type = r.u8(p + 3);
    q = p + 4;
  }
  const dims = [];
  for (let i = 0; i < rank; i++) {
    dims.push(r.uint(q, sl));
    q += sl;
  }
  if (flags & 1) q += rank * sl; // max dims
  return {
    version,
    rank,
    dims,
    scalar: version === 2 ? type === 0 : rank === 0,
    null: version === 2 && type === 2
  };
}
export function readDatatype(r, p) {
  const b0 = r.u8(p);
  const cls = b0 & 0x0f;
  const version = b0 >> 4;
  const bits = r.u8(p + 1) | (r.u8(p + 2) << 8) | (r.u8(p + 3) << 16);
  const size = r.u32(p + 4);
  const t = {cls, version, size, bits, littleEndian: !(bits & 1)};
  let q = p + 8;
  if (cls === 0) {
    t.kind = 'int';
    t.signed = !!(bits & 8);
    q += 4;
  } else if (cls === 1) {
    t.kind = 'float';
    q += 12;
  } else if (cls === 3) {
    t.kind = 'string';
    t.padding = bits & 0x0f;
    t.charset = (bits >> 4) & 0x0f;
  } else if (cls === 7) {
    t.kind = 'reference';
  } else if (cls === 9) {
    t.kind = 'vlen';
  } else if (cls === 6) {
    t.kind = 'compound';
  } else t.kind = 'class' + cls;
  t.end = q;
  return t;
}
// The bytes of one element of type t at p, as a JS number/string.
function decodeElement(r, t, p) {
  const le = t.littleEndian;
  if (t.kind === 'int') {
    if (t.size === 1) return t.signed ? r.v.getInt8(p) : r.v.getUint8(p);
    if (t.size === 2)
      return t.signed ? r.v.getInt16(p, le) : r.v.getUint16(p, le);
    if (t.size === 4)
      return t.signed ? r.v.getInt32(p, le) : r.v.getUint32(p, le);
    if (t.size === 8)
      return Number(
        t.signed ? r.v.getBigInt64(p, le) : r.v.getBigUint64(p, le)
      );
  }
  if (t.kind === 'float') {
    if (t.size === 4) return r.v.getFloat32(p, le);
    if (t.size === 8) return r.v.getFloat64(p, le);
  }
  if (t.kind === 'string') {
    let s = r.str(p, t.size);
    const z = s.indexOf('\0');
    if (z >= 0) s = s.slice(0, z);
    return t.padding === 1 ? s : s.replace(/ +$/, '');
  }
  return null;
}
export function readAttribute(r, p, sl) {
  const version = r.u8(p);
  let q;
  let nameLen;
  let typeLen;
  let spaceLen;
  if (version === 1) {
    nameLen = r.u16(p + 2);
    typeLen = r.u16(p + 4);
    spaceLen = r.u16(p + 6);
    q = p + 8;
    const name = r.str(q, nameLen - 1);
    q += Math.ceil(nameLen / 8) * 8;
    const t = readDatatype(r, q);
    q += Math.ceil(typeLen / 8) * 8;
    const ds = readDataspace(r, q, sl);
    q += Math.ceil(spaceLen / 8) * 8;
    return {name, type: t, space: ds, data: q, version};
  }
  const flags = r.u8(p + 1);
  nameLen = r.u16(p + 2);
  typeLen = r.u16(p + 4);
  spaceLen = r.u16(p + 6);
  q = p + 8;
  if (version === 3) q += 1; // name character set
  const name = r.str(q, nameLen - 1);
  q += nameLen;
  const t = flags & 1 ? {kind: 'shared'} : readDatatype(r, q);
  q += typeLen;
  const ds =
    flags & 2 ? {rank: 0, dims: [], scalar: true} : readDataspace(r, q, sl);
  q += spaceLen;
  return {name, type: t, space: ds, data: q, version, flags};
}
// The attribute's value: a scalar, an array, or a string (fixed
// length, or variable length through the global heap).
export function attributeValue(r, a, so = 8) {
  const t = a.type;
  if (!t || t.kind === 'shared' || t.kind === 'reference')
    return {unread: t ? t.kind : 'unknown'};
  const n = a.space.dims.reduce((s, d) => s * d, 1);
  if (t.kind === 'vlen') {
    // variable-length strings (class 9 with a string base type) are
    // what h5py writes for a Python str; other vlens are named
    if (((t.bits >> 0) & 0x0f) !== 1) return {unread: 'vlen'};
    const one = (p) => {
      const raw = readVlenBytes(r, p, so);
      return raw ? dec.decode(raw).replace(/\0+$/, '') : null;
    };
    if (a.space.scalar || n === 1) return one(a.data);
    const out = [];
    for (let i = 0; i < n; i++) out.push(one(a.data + i * t.size));
    return out;
  }
  if (a.space.scalar || n === 1) return decodeElement(r, t, a.data);
  const out = [];
  for (let i = 0; i < n; i++)
    out.push(decodeElement(r, t, a.data + i * t.size));
  return out;
}
export function readLink(r, p, so) {
  const version = r.u8(p);
  if (version !== 1) return null;
  const flags = r.u8(p + 1);
  let q = p + 2;
  let ltype = 0;
  if (flags & 8) {
    ltype = r.u8(q);
    q += 1;
  }
  if (flags & 4) q += 8; // creation order
  if (flags & 0x10) q += 1; // charset
  const nsize = [1, 2, 4, 8][flags & 3];
  const nameLen = r.uint(q, nsize);
  q += nsize;
  const name = r.str(q, nameLen);
  q += nameLen;
  if (ltype === 0) {
    const addr = r.addr(q, so);
    return {name, addr, end: q + so, ltype};
  }
  if (ltype === 1) {
    const len = r.u16(q);
    return {name, addr: null, soft: r.str(q + 2, len), end: q + 2 + len, ltype};
  }
  const len = r.u16(q);
  return {name, addr: null, end: q + 2 + len, ltype};
}
export function readLayout(r, p, so, sl) {
  const version = r.u8(p);
  // version 3 is what netCDF's default ("earliest") library bounds
  // write; 4 and later (HDF5 1.10+ "latest": fixed/extensible-array
  // and v2 B-tree chunk indexes) are named and left unread
  if (version !== 3)
    return {version, cls: 'unread', unread: 'layout version ' + version};
  const cls = r.u8(p + 1);
  let q = p + 2;
  if (cls === 0) {
    const size = r.u16(q);
    return {version, cls: 'compact', size, data: q + 2};
  }
  if (cls === 1) {
    const addr = r.addr(q, so);
    const size = r.uint(q + so, sl);
    return {version, cls: 'contiguous', addr, size};
  }
  if (cls === 2) {
    const dim = r.u8(q);
    q += 1;
    const btree = r.addr(q, so);
    q += so;
    const chunk = [];
    for (let i = 0; i < dim; i++) {
      chunk.push(r.u32(q));
      q += 4;
    }
    // the last chunk dimension is the element size
    return {
      version,
      cls: 'chunked',
      btree,
      chunk: chunk.slice(0, -1),
      elemSize: chunk[dim - 1],
      dim: dim - 1
    };
  }
  return {version, cls: 'class' + cls, unread: 'layout class ' + cls};
}
export function readPipeline(r, p) {
  const version = r.u8(p);
  const n = r.u8(p + 1);
  let q = version === 1 ? p + 8 : p + 2;
  const filters = [];
  for (let i = 0; i < n; i++) {
    const id = r.u16(q);
    q += 2;
    let nameLen = 0;
    if (version === 1 || id >= 256) {
      nameLen = r.u16(q);
      q += 2;
    }
    const flags = r.u16(q);
    const ncd = r.u16(q + 2);
    q += 4;
    let name = '';
    if (nameLen) {
      name = r.str(q, nameLen).replace(/\0+$/, '');
      q += version === 1 ? Math.ceil(nameLen / 8) * 8 : nameLen;
    }
    const cd = [];
    for (let k = 0; k < ncd; k++) {
      cd.push(r.u32(q));
      q += 4;
    }
    if (version === 1 && ncd % 2) q += 4;
    filters.push({id, name, flags, cd});
  }
  return {version, filters};
}

// ---------------------------------------------------------------
// The fractal heap: managed objects in direct blocks, in sequence
// ---------------------------------------------------------------
export function readFractalHeapObjects(r, addr, so, sl) {
  if (r.sig(addr) !== 'FRHP') throw new Error('no fractal heap at ' + addr);
  let p = addr + 5;
  const heapIdLen = r.u16(p);
  const ioFilterLen = r.u16(p + 2);
  const flags = r.u8(p + 4);
  p += 5;
  const maxManaged = r.u32(p);
  p += 4;
  p += 4 * sl; // next huge id, huge B-tree, free space, free-space manager
  const managedSpace = r.uint(p, sl);
  p += sl;
  p += sl; // allocated managed space
  p += sl; // direct block allocation iterator offset
  const managedObjs = r.uint(p, sl);
  p += sl;
  p += 2 * sl; // huge objects: size, count
  p += 2 * sl; // tiny objects: size, count
  const tableWidth = r.u16(p);
  p += 2;
  const startBlk = r.uint(p, sl);
  p += sl;
  const maxDirect = r.uint(p, sl);
  p += sl;
  const maxHeapBits = r.u16(p);
  p += 2;
  const startRows = r.u16(p);
  p += 2;
  const rootAddr = r.addr(p, so);
  p += so;
  const curRows = r.u16(p);
  const offBytes = Math.ceil(maxHeapBits / 8);
  const checksummed = !!(flags & 2);
  // direct blocks in address order of the doubling table
  const blocks = []; // {addr, size}
  const blockSize = (row) => startBlk * 2 ** Math.max(0, row - 1);
  const walk = (a, rows) => {
    if (a === null) return;
    const s = r.sig(a);
    if (s === 'FHDB') {
      blocks.push({addr: a, size: blocks.length ? null : startBlk});
      return;
    }
    if (s !== 'FHIB') throw new Error('bad heap block ' + s + ' at ' + a);
    let q = a + 5 + so + offBytes;
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < tableWidth; col++) {
        const child = r.addr(q, so);
        q += so;
        if (ioFilterLen) q += sl + 4; // filtered size + mask
        if (child === null) continue;
        const nrow = row;
        if (nrow < Math.log2(maxDirect / startBlk) + 2) {
          if (r.sig(child) === 'FHDB')
            blocks.push({addr: child, size: blockSize(row)});
          else walk(child, curRows);
        } else walk(child, curRows);
      }
  };
  if (rootAddr !== null) {
    if (r.sig(rootAddr) === 'FHDB')
      blocks.push({addr: rootAddr, size: startBlk});
    else walk(rootAddr, curRows);
  }
  // the objects: raw byte ranges the caller parses (link or
  // attribute messages); the heap's address space counts each
  // direct block's header, so a managed object's heap offset maps
  // to blockAddr + (offset - blockOffset)
  const objects = [];
  const headerLen = 5 + so + offBytes + (checksummed ? 4 : 0);
  for (const blk of blocks) {
    const size = blk.size ?? startBlk;
    const blockOffset = r.uint(blk.addr + 5 + so, offBytes);
    objects.push({
      addr: blk.addr,
      start: blk.addr + headerLen,
      end: blk.addr + size,
      blockOffset,
      size
    });
  }
  const lenBytes = Math.max(1, heapIdLen - 1 - offBytes);
  // a managed heap ID -> the object's byte position, or null
  const locate = (idBytes) => {
    const flags = idBytes[0];
    if ((flags & 0x30) !== 0) return null; // tiny (0x20) or huge (0x10)
    let off = 0;
    for (let i = offBytes - 1; i >= 0; i--) off = off * 256 + idBytes[1 + i];
    let len = 0;
    for (let i = lenBytes - 1; i >= 0; i--)
      len = len * 256 + idBytes[1 + offBytes + i];
    for (const blk of objects)
      if (off >= blk.blockOffset && off < blk.blockOffset + blk.size)
        return {p: blk.addr + (off - blk.blockOffset), len};
    return null;
  };
  return {
    heapIdLen,
    offBytes,
    lenBytes,
    maxManaged,
    managedObjs,
    managedSpace,
    blocks: objects,
    locate
  };
}
// The records of a version-2 B-tree ("BTHD"): each record's raw
// bytes, leaves walked in order through the internal nodes.
export function readBtreeV2Records(r, addr, so) {
  if (addr === null || r.sig(addr) !== 'BTHD') return null;
  const type = r.u8(addr + 5);
  const nodeSize = r.u32(addr + 6);
  const recSize = r.u16(addr + 10);
  const depth = r.u16(addr + 12);
  const root = r.addr(addr + 16, so);
  const nRoot = r.u16(addr + 16 + so);
  const total = r.u64(addr + 18 + so);
  const out = [];
  // bytes needed to count the records a node at a depth can hold
  const bytesFor = (n) =>
    n < 256 ? 1 : n < 65536 ? 2 : n < 2 ** 24 ? 3 : n < 2 ** 32 ? 4 : 8;
  const maxLeaf = Math.floor((nodeSize - 10) / recSize);
  const maxAt = [maxLeaf];
  for (let d = 1; d <= depth; d++) {
    const childPtr =
      so + bytesFor(maxAt[d - 1]) + (d > 1 ? bytesFor(maxAt[d - 1] * 2) : 0);
    const n = Math.floor((nodeSize - 10 - childPtr) / (recSize + childPtr));
    maxAt.push(n);
  }
  const node = (a, n, d) => {
    if (a === null) return;
    const s = r.sig(a);
    let p = a + 6;
    if (s === 'BTLF') {
      for (let i = 0; i < n; i++) {
        out.push(r.b.subarray(p, p + recSize));
        p += recSize;
      }
      return;
    }
    if (s !== 'BTIN') throw new Error('B-tree v2 node ' + s);
    const cntBytes = bytesFor(maxAt[d - 1]);
    const totBytes = d > 1 ? bytesFor(maxAt[d - 1] * 4) : 0;
    // the node's n records, then its n + 1 child pointers (address,
    // record count, and the subtree total below depth 1)
    const recs = [];
    for (let i = 0; i < n; i++) {
      recs.push(r.b.subarray(p, p + recSize));
      p += recSize;
    }
    const kids = [];
    for (let i = 0; i <= n; i++) {
      const child = r.addr(p, so);
      p += so;
      const cnt = r.uint(p, cntBytes);
      p += cntBytes;
      if (d > 1) p += totBytes;
      kids.push({child, cnt});
    }
    for (let i = 0; i <= n; i++) {
      node(kids[i].child, kids[i].cnt, d - 1);
      if (i < n) out.push(recs[i]);
    }
  };
  node(root, nRoot, depth);
  return {type, recSize, depth, total, records: out};
}
// Every link message in a link-info fractal heap: by the name index
// B-tree's heap IDs when the group has one, else in storage order.
function linksFromHeap(r, heapAddr, btreeAddr, so, sl) {
  const heap = readFractalHeapObjects(r, heapAddr, so, sl);
  const links = [];
  const bt = readBtreeV2Records(r, btreeAddr, so);
  if (bt && bt.type === 5) {
    for (const rec of bt.records) {
      const loc = heap.locate(rec.subarray(4, 4 + heap.heapIdLen));
      if (!loc) continue;
      const l = readLink(r, loc.p, so);
      if (l) links.push(l);
    }
    return links;
  }
  for (const blk of heap.blocks) {
    let q = blk.start;
    while (q < blk.end && links.length < heap.managedObjs) {
      const l = readLink(r, q, so);
      if (!l) break;
      links.push(l);
      q = l.end;
    }
  }
  return links;
}
// Every attribute in an attribute-info fractal heap: by the name
// index B-tree (type 8 records: heap ID, message flags, creation
// order, hash) when there is one, else in storage order.
function attributesFromHeap(r, heapAddr, btreeAddr, so, sl) {
  const heap = readFractalHeapObjects(r, heapAddr, so, sl);
  const attrs = [];
  const bt = readBtreeV2Records(r, btreeAddr, so);
  if (bt && bt.type === 8) {
    for (const rec of bt.records) {
      const loc = heap.locate(rec.subarray(0, heap.heapIdLen));
      if (!loc) continue;
      const ver = r.u8(loc.p);
      if (ver === 1 || ver === 3) attrs.push(readAttribute(r, loc.p, sl));
    }
    return attrs;
  }
  for (const blk of heap.blocks) {
    let q = blk.start;
    while (q < blk.end && attrs.length < heap.managedObjs) {
      const ver = r.u8(q);
      if (ver !== 1 && ver !== 3) break;
      const a = readAttribute(r, q, sl);
      const n = a.space.dims.reduce((s, d) => s * d, 1) || 1;
      const dataLen = a.type.size ? n * a.type.size : 0;
      attrs.push(a);
      q = a.data + dataLen;
    }
  }
  return attrs;
}
// A variable-length element {length, global heap address, index}:
// the bytes of that object in its global heap collection ("GCOL").
export function readVlenBytes(r, p, so) {
  const len = r.u32(p);
  const heap = r.addr(p + 4, so);
  const index = r.u32(p + 4 + so);
  if (heap === null || r.sig(heap) !== 'GCOL') return null;
  let q = heap + 16; // signature, version, reserved, collection size
  const end = heap + r.u64(heap + 8);
  while (q + 16 <= end) {
    const idx = r.u16(q);
    const size = r.u64(q + 8);
    if (idx === 0) break; // the free-space object ends the list
    if (idx === index)
      return r.b.subarray(q + 16, q + 16 + Math.min(size, len));
    q += 16 + Math.ceil(size / 8) * 8;
  }
  return null;
}

// ---------------------------------------------------------------
// Old-style groups: symbol table -> local heap + v1 B-tree
// ---------------------------------------------------------------
function linksFromSymbolTable(r, btree, heap, so, sl) {
  // local heap: "HEAP" version(1) reserved(3) data size(sl) free list(sl) data address(so)
  const dataAddr = r.addr(heap + 8 + 2 * sl, so);
  const links = [];
  const node = (a) => {
    if (a === null) return;
    if (r.sig(a) === 'TREE') {
      const level = r.u8(a + 5);
      const used = r.u16(a + 6);
      let q = a + 8 + 2 * so;
      for (let i = 0; i < used; i++) {
        q += sl; // key
        const child = r.addr(q, so);
        q += so;
        node(child);
      }
      return;
    }
    if (r.sig(a) === 'SNOD') {
      const n = r.u16(a + 6);
      let q = a + 8;
      for (let i = 0; i < n; i++) {
        const e = readSymbolEntry(r, q, so);
        const name = (() => {
          let s = '';
          let k = dataAddr + e.nameOff;
          while (r.u8(k) !== 0) s += String.fromCharCode(r.u8(k++));
          return s;
        })();
        links.push({name, addr: e.ohdr, ltype: 0});
        q += e.size;
      }
    }
  };
  node(btree);
  return links;
}

// ---------------------------------------------------------------
// The v1 B-tree chunk index
// ---------------------------------------------------------------
function chunkEntries(r, addr, so, sl, dim) {
  const out = [];
  const node = (a) => {
    if (a === null || r.sig(a) !== 'TREE') return;
    const type = r.u8(a + 4);
    const level = r.u8(a + 5);
    const used = r.u16(a + 6);
    if (type !== 1) throw new Error('B-tree type ' + type + ' for chunks');
    let q = a + 8 + 2 * so;
    const keySize = 8 + 8 * (dim + 1);
    for (let i = 0; i < used; i++) {
      const size = r.u32(q);
      const mask = r.u32(q + 4);
      const offsets = [];
      for (let d = 0; d < dim; d++) offsets.push(r.u64(q + 8 + 8 * d));
      q += keySize;
      const child = r.addr(q, so);
      q += so;
      if (level > 0) node(child);
      else out.push({addr: child, size, mask, offsets});
    }
  };
  node(addr);
  return out;
}

// ---------------------------------------------------------------
// The file
// ---------------------------------------------------------------
export function openHdf5(bytes, inflate) {
  const r = new Reader(bytes);
  const sb = readSuperblock(r);
  const {so, sl} = sb;
  const skipped = [];
  const object = (addr) => {
    const oh = readObjectHeader(r, addr, so, sl);
    const out = {
      addr,
      links: [],
      attrs: [],
      space: null,
      type: null,
      layout: null,
      pipeline: null,
      fill: null
    };
    for (const m of oh.msgs) {
      switch (m.type) {
        case 0x01:
          out.space = readDataspace(r, m.p, sl);
          break;
        case 0x03:
          out.type = readDatatype(r, m.p);
          break;
        case 0x02: {
          // link info: flags, [max creation index], fractal heap, name B-tree
          const flags = r.u8(m.p + 1);
          let q = m.p + 2;
          if (flags & 1) q += 8;
          const heap = r.addr(q, so);
          const btree = r.addr(q + so, so);
          if (heap !== null)
            out.links.push(...linksFromHeap(r, heap, btree, so, sl));
          break;
        }
        case 0x06: {
          const l = readLink(r, m.p, so);
          if (l) out.links.push(l);
          break;
        }
        case 0x11: {
          const btree = r.addr(m.p, so);
          const heap = r.addr(m.p + so, so);
          out.links.push(...linksFromSymbolTable(r, btree, heap, so, sl));
          break;
        }
        case 0x08:
          out.layout = readLayout(r, m.p, so, sl);
          break;
        case 0x0b:
          out.pipeline = readPipeline(r, m.p);
          break;
        case 0x0c:
          out.attrs.push(readAttribute(r, m.p, sl));
          break;
        case 0x15: {
          const flags = r.u8(m.p + 1);
          let q = m.p + 2;
          if (flags & 1) q += 2; // max creation index
          const heap = r.addr(q, so);
          const btree = r.addr(q + so, so);
          if (heap !== null)
            out.attrs.push(...attributesFromHeap(r, heap, btree, so, sl));
          break;
        }
        case 0x04:
        case 0x05:
          out.fill = {p: m.p, version: r.u8(m.p)};
          break;
        case 0x00:
        case 0x0a:
        case 0x0e:
        case 0x12:
        case 0x16:
          break;
        default:
          skipped.push('message type ' + m.type + ' at ' + m.p);
      }
    }
    return out;
  };
  const root = object(sb.root);
  const byName = new Map(root.links.map((l) => [l.name, l]));
  const attrsOf = (obj) => {
    const out = {};
    for (const a of obj.attrs) out[a.name] = attributeValue(r, a, so);
    return out;
  };
  const typedArray = (t, n) => {
    if (t.kind === 'int') {
      if (t.size === 1) return t.signed ? new Int8Array(n) : new Uint8Array(n);
      if (t.size === 2)
        return t.signed ? new Int16Array(n) : new Uint16Array(n);
      if (t.size === 4)
        return t.signed ? new Int32Array(n) : new Uint32Array(n);
      return new Float64Array(n);
    }
    if (t.kind === 'float')
      return t.size === 4 ? new Float32Array(n) : new Float64Array(n);
    return null;
  };
  // the dataset's values as a typed array in row-major order (a
  // scalar dataset answers a one-element array)
  const readDataset = (obj) => {
    const t = obj.type;
    const ds = obj.space;
    const dims = ds.dims.length ? ds.dims : [1];
    const n = dims.reduce((s, d) => s * d, 1);
    const arr = typedArray(t, n);
    if (!arr) return {unread: 'datatype ' + t.kind};
    const elemAt = (bytes, off) => {
      const rr = new Reader(bytes);
      return decodeElement(rr, t, off);
    };
    const L = obj.layout;
    if (L.cls === 'compact' || L.cls === 'contiguous') {
      const start = L.cls === 'compact' ? L.data : L.addr;
      if (start === null) return arr; // never written: fill
      for (let i = 0; i < n; i++)
        arr[i] = decodeElement(r, t, start + i * t.size);
      return arr;
    }
    if (L.cls !== 'chunked' || L.unread) return {unread: L.unread ?? L.cls};
    const dim = L.dim;
    const chunk = L.chunk;
    const filters = obj.pipeline ? obj.pipeline.filters : [];
    const entries = chunkEntries(r, L.btree, so, sl, dim);
    const chunkN = chunk.reduce((s, d) => s * d, 1);
    for (const e of entries) {
      if (e.addr === null) continue;
      let raw = r.b.subarray(e.addr, e.addr + e.size);
      // filters are listed in application order; undo them in reverse
      for (let k = filters.length - 1; k >= 0; k--) {
        const f = filters[k];
        if (e.mask & (1 << k)) continue; // filter skipped for this chunk
        if (f.id === 1) raw = inflate(raw);
        else if (f.id === 2) raw = unshuffle(raw, f.cd[0] || t.size);
        else if (f.id === 3) raw = raw.subarray(0, raw.length - 4);
        else return {unread: 'filter ' + f.id + (f.name ? ' ' + f.name : '')};
      }
      if (raw.length < chunkN * t.size)
        return {unread: 'short chunk at ' + e.addr};
      // copy the chunk into place, clipped at the dataset's edges
      const copy = (d, srcBase, dstBase) => {
        const cnt = Math.min(chunk[d], dims[d] - e.offsets[d]);
        if (cnt <= 0) return;
        if (d === dim - 1) {
          for (let i = 0; i < cnt; i++)
            arr[dstBase + i] = elemAt(raw, (srcBase + i) * t.size);
          return;
        }
        let srcStride = 1;
        let dstStride = 1;
        for (let k = d + 1; k < dim; k++) {
          srcStride *= chunk[k];
          dstStride *= dims[k];
        }
        for (let i = 0; i < cnt; i++)
          copy(d + 1, srcBase + i * srcStride, dstBase + i * dstStride);
      };
      let dst = 0;
      for (let d = 0; d < dim; d++) {
        let stride = 1;
        for (let k = d + 1; k < dim; k++) stride *= dims[k];
        dst += e.offsets[d] * stride;
      }
      copy(0, 0, dst);
    }
    return arr;
  };
  const datasetCache = new Map();
  const api = {
    superblock: sb,
    names: () => root.links.map((l) => l.name),
    rootAttrs: () => attrsOf(root),
    skipped,
    // {shape, dtype, chunks, filters, attrs, values}
    dataset(name) {
      if (datasetCache.has(name)) return datasetCache.get(name);
      const l = byName.get(name);
      if (!l || l.addr === null) return null;
      const obj = object(l.addr);
      const t = obj.type;
      const info = {
        name,
        shape: obj.space ? obj.space.dims : [],
        dtype: t
          ? t.kind === 'int'
            ? (t.signed ? 'int' : 'uint') + t.size * 8
            : t.kind === 'float'
              ? 'float' + t.size * 8
              : t.kind
          : 'unknown',
        littleEndian: t ? t.littleEndian : true,
        layout: obj.layout ? obj.layout.cls : null,
        chunks:
          obj.layout && obj.layout.cls === 'chunked' ? obj.layout.chunk : null,
        filters: obj.pipeline ? obj.pipeline.filters.map((f) => f.id) : [],
        attrs: attrsOf(obj),
        values: null
      };
      info.values = obj.layout && t ? readDataset(obj) : {unread: 'no layout'};
      datasetCache.set(name, info);
      return info;
    }
  };
  return api;
}
// The shuffle filter's inverse: bytes stored byte-plane by byte-plane
// (all first bytes, then all second bytes ...) back to element order.
export function unshuffle(raw, elemSize) {
  if (elemSize <= 1) return raw;
  const n = Math.floor(raw.length / elemSize);
  const out = new Uint8Array(raw.length);
  for (let j = 0; j < elemSize; j++) {
    const base = j * n;
    for (let i = 0; i < n; i++) out[i * elemSize + j] = raw[base + i];
  }
  // a trailing remainder (never in HDF5's own writes) is copied through
  for (let k = n * elemSize; k < raw.length; k++) out[k] = raw[k];
  return out;
}
// A dataset's values with the CF scale_factor/add_offset applied and
// its _FillValue as NaN: the physical field.
export function physicalValues(info) {
  const v = info.values;
  if (!v || v.unread) return null;
  const a = info.attrs;
  const scale = Array.isArray(a.scale_factor)
    ? a.scale_factor[0]
    : (a.scale_factor ?? 1);
  const off = Array.isArray(a.add_offset)
    ? a.add_offset[0]
    : (a.add_offset ?? 0);
  const fill = Array.isArray(a._FillValue) ? a._FillValue[0] : a._FillValue;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++)
    out[i] = fill !== undefined && v[i] === fill ? NaN : v[i] * scale + off;
  return out;
}
