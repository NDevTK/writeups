// PPM (P6) -> PNG without ImageMagick: node ppm2png.mjs in.ppm out.png
// Minimal PNG encoder (one IDAT, zlib via node).
import {readFileSync, writeFileSync} from 'fs';
import {deflateSync} from 'zlib';

const [, , inF, outF] = process.argv;
const ppm = readFileSync(inF);
const hdr = ppm.toString('latin1', 0, 64);
const m = hdr.match(/^P6\s+(\d+)\s+(\d+)\s+255\s/);
if (!m) throw new Error('not a P6/255 ppm');
const w = +m[1];
const h = +m[2];
const off = m[0].length;
const raw = Buffer.alloc(h * (w * 3 + 1));
for (let y = 0; y < h; y++) {
  raw[y * (w * 3 + 1)] = 0;
  ppm.copy(raw, y * (w * 3 + 1) + 1, off + y * w * 3, off + (y + 1) * w * 3);
}
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(w, 0);
ihdr.writeUInt32BE(h, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // truecolour
writeFileSync(
  outF,
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, {level: 6})),
    chunk('IEND', Buffer.alloc(0))
  ])
);
console.log('png ok ' + outF);
