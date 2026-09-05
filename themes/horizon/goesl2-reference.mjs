// goesl2-reference.mjs - the gate for goesl2.js (148th pass): the
// GOES-R fixed-grid navigation held to the PUG's own printed
// example (both directions, every intermediate the PUG prints), the
// window cut and the censuses on the vendored ACHAC file and on
// synthetic masks, and the bucket-listing helpers.
import {inflateSync} from 'node:zlib';
import {openHdf5, physicalValues} from './hdf5.js';
import {ACHAC_B64, ACHAC_EXPECT} from './hdf5-fixture.js';
import {
  ACM_MEANINGS,
  BCM_MEANINGS,
  L2_BUCKETS,
  L2_PRODUCTS,
  bucketPrefix,
  cutWindow,
  fixedGridGeometry,
  fixedGridToLatLon,
  heightCensus,
  indexOfScanAngle,
  latLonToFixedGrid,
  latestByStart,
  maskAgreement,
  maskCensus,
  nearestByStart,
  packArray,
  parseS3Keys,
  pixelSizeM,
  productTimeIso,
  scanAngle,
  stampToIso,
  unpackArray,
  windowBox,
  windowIndexOf
} from './goesl2.js';

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

// ---- the PUG's worked example, both ways -------------------------
{
  // PUG Table 4.2.8 and 4.2.8.1/4.2.8.2: GOES-East, y(558) = 0.095340,
  // x(1539) = -0.024052 -> 33.846162 N, 84.690932 W and back
  const g = fixedGridGeometry({
    semi_major_axis: 6378137,
    semi_minor_axis: 6356752.31414,
    perspective_point_height: 35786023,
    longitude_of_projection_origin: -75
  });
  const f = fixedGridToLatLon(-0.024052, 0.09534, g);
  const b = latLonToFixedGrid(33.846162, -84.690932, g);
  const sub = fixedGridToLatLon(0, 0, g);
  const limb = fixedGridToLatLon(0.16, 0, g);
  const far = latLonToFixedGrid(33.85, 120, g);
  check(
    "THE FIXED GRID navigates the PUG's own example, both ways",
    near(g.H, 42164160, 1e-6) &&
      near(g.e, 0.0818191910435, 1e-12) &&
      near(f.a, 1.000061039, 5e-10) &&
      near(f.b, -83921070.03, 0.01) &&
      near(f.c, 1.73714e15, 1e10) &&
      near(f.rs, 37116295.87, 0.01) &&
      near(f.sx, 36937048.73, 0.01) &&
      near(f.sy, 892635.0779, 1e-3) &&
      near(f.sz, 3532287.213, 1e-3) &&
      near(f.latDeg, 33.846162, 1e-6) &&
      near(f.lonDeg, -84.690932, 1e-6) &&
      near(b.phiC, 0.587623849, 1e-9) &&
      near(b.rC, 6371541.614, 1e-3) &&
      near(b.sx, 36937048.71, 0.01) &&
      near(b.sy, 892635.07, 0.01) &&
      near(b.sz, 3532287.186, 1e-3) &&
      near(b.y, 0.09534, 1e-9) &&
      near(b.x, -0.024052, 1e-9) &&
      near(sub.latDeg, 0, 1e-12) &&
      near(sub.lonDeg, -75, 1e-12) &&
      near(sub.rs, 35786023, 1e-6) &&
      limb === null &&
      far === null,
    `H 42164160 m, e 0.0818191910435; x -0.024052, y 0.095340 -> a ${f.a.toFixed(9)}, b ${f.b.toFixed(2)}, ` +
      `rs ${f.rs.toFixed(2)}, sx ${f.sx.toFixed(2)}, sy ${f.sy.toFixed(4)}, sz ${f.sz.toFixed(3)} -> ` +
      `${f.latDeg.toFixed(6)} N ${(-f.lonDeg).toFixed(6)} W, the PUG's 33.846162 / -84.690932; back through ` +
      `phiC ${b.phiC.toFixed(9)}, rC ${b.rC.toFixed(3)} to y ${b.y.toFixed(6)}, x ${b.x.toFixed(6)}; the ` +
      `sub-point is 0 N 75 W at rs = the satellite height; a 0.16-rad scan angle is past the limb and ` +
      `120 E is not visible from 75 W`
  );
}

// ---- the product's own window ---------------------------------
{
  const f = openHdf5(new Uint8Array(Buffer.from(ACHAC_B64, 'base64')), inflate);
  const proj = f.dataset('goes_imager_projection').attrs;
  const g = fixedGridGeometry({
    semi_major_axis: proj.semi_major_axis[0] ?? proj.semi_major_axis,
    semi_minor_axis: proj.semi_minor_axis[0] ?? proj.semi_minor_axis,
    perspective_point_height:
      proj.perspective_point_height[0] ?? proj.perspective_point_height,
    longitude_of_projection_origin:
      proj.longitude_of_projection_origin[0] ??
      proj.longitude_of_projection_origin
  });
  const xd = f.dataset('x');
  const yd = f.dataset('y');
  const xc = {
    scale: xd.attrs.scale_factor[0] ?? xd.attrs.scale_factor,
    offset: xd.attrs.add_offset[0] ?? xd.attrs.add_offset
  };
  const yc = {
    scale: yd.attrs.scale_factor[0] ?? yd.attrs.scale_factor,
    offset: yd.attrs.add_offset[0] ?? yd.attrs.add_offset
  };
  const nx = xd.values.length;
  const ny = yd.values.length;
  const ht = physicalValues(f.dataset('HT'));
  const dqf = f.dataset('DQF').values;
  // the home: San Diego's Miramar; a 100-km half window on the
  // 10-km height grid is 10 pixels
  const box = windowBox(32.85, -117.12, g, xc, yc, nx, ny, 10);
  const home = fixedGridToLatLon(scanAngle(box.i, xc), scanAngle(box.j, yc), g);
  const size = pixelSizeM(box, g, xc, yc);
  const win = cutWindow(ht, nx, box);
  const dq = cutWindow(dqf, nx, box);
  const hc = heightCensus(win, dq);
  const qHome = windowIndexOf(32.85, -117.12, g, xc, yc, box);
  const outside = windowBox(0, -137, g, xc, yc, nx, ny, 10); // the sub-point: not in the CONUS scene
  const t = productTimeIso(f.dataset('t').values[0]);
  const nw = fixedGridToLatLon(scanAngle(0, xc), scanAngle(0, yc), g);
  const se = fixedGridToLatLon(scanAngle(nx - 1, xc), scanAngle(ny - 1, yc), g);
  check(
    "THE WINDOW cuts the home from the product's own grid",
    box &&
      box.rows === 21 &&
      box.cols === 21 &&
      near(home.latDeg, 32.85, 0.06) &&
      near(home.lonDeg, -117.12, 0.06) &&
      size.ewM > 10000 &&
      size.ewM < 16000 &&
      size.nsM > 10000 &&
      size.nsM < 16000 &&
      win.length === 441 &&
      qHome === 10 * 21 + 10 &&
      hc.n > 0 &&
      hc.n <= 441 &&
      hc.medianM > 0 &&
      hc.medianM < 20000 &&
      outside === null &&
      t.startsWith('2026-09-05T18:4') &&
      nw.latDeg > 50 &&
      nw.lonDeg > 150 &&
      se.latDeg < 20 &&
      se.lonDeg > -120,
    `the home falls in pixel (${box.i}, ${box.j}) of the 10-km CONUS grid, navigated back to ` +
      `${home.latDeg.toFixed(3)} N ${(-home.lonDeg).toFixed(3)} W; that pixel spans ${size.ewM.toFixed(0)} x ` +
      `${size.nsM.toFixed(0)} m at the view's slant (10 km at nadir); the 21x21 window holds ${hc.n} retrieved ` +
      `tops (median ${hc.medianM.toFixed(0)} m, p10 ${hc.p10M.toFixed(0)}, p90 ${hc.p90M.toFixed(0)}) ` +
      `at ${t}; the scene runs from ${nw.latDeg.toFixed(1)} N ${nw.lonDeg.toFixed(1)} E (past the ` +
      `antimeridian, wrapped) to ${se.latDeg.toFixed(1)} N ${(-se.lonDeg).toFixed(1)} W; the ` +
      `sub-satellite point is outside it`
  );
  // run-then-pin on the frozen file: the home window's census
  check(
    'PINNED the home window of the frozen ACHAC file',
    hc.n === 340 &&
      hc.medianM !== null &&
      near(hc.medianM, 3056.6, 1) &&
      box.i === 424 &&
      box.j === 127,
    `pixel (424, 127); ${hc.n} retrieved tops in the window, median ${hc.medianM?.toFixed(1)} m ` +
      `(${ACHAC_EXPECT.file})`
  );
}

// ---- the censuses on synthetic masks ------------------------------
{
  const bcm = [0, 1, 1, 0, 1, 255, 0, 1];
  const acm = [0, 3, 2, 1, 3, 255, 0, 3];
  const dqf = [0, 0, 0, 0, 1, 0, 0, 0];
  const c = maskCensus(bcm, acm, dqf);
  // a 3 x 3 NOAA window around (32, -117) at 0.1 deg per pixel, and
  // four theme pixels: two agree, one theme-only, one NOAA-only
  const g = fixedGridGeometry({
    semi_major_axis: 6378137,
    semi_minor_axis: 6356752.31414,
    perspective_point_height: 35786023,
    longitude_of_projection_origin: -137
  });
  const centre = latLonToFixedGrid(32, -117, g);
  const step = 0.000056 * 40; // ~80 km per synthetic pixel
  const xc = {scale: step, offset: centre.x - step};
  const yc = {scale: -step, offset: centre.y + step};
  const box = {i0: 0, j0: 0, rows: 3, cols: 3};
  const noaaBcm = [0, 0, 0, 0, 1, 0, 0, 0, 1];
  const at = (i, j) => fixedGridToLatLon(scanAngle(i, xc), scanAngle(j, yc), g);
  const p11 = at(1, 1);
  const p22 = at(2, 2);
  const p00 = at(0, 0);
  const p10 = at(1, 0);
  const themePixels = [
    {latDeg: p11.latDeg, lonDeg: p11.lonDeg, cloud: true}, // both cloud
    {latDeg: p00.latDeg, lonDeg: p00.lonDeg, cloud: false}, // both clear
    {latDeg: p10.latDeg, lonDeg: p10.lonDeg, cloud: true}, // theme only
    {latDeg: p22.latDeg, lonDeg: p22.lonDeg, cloud: false}, // NOAA only
    {latDeg: p22.latDeg, lonDeg: p22.lonDeg, cloud: null}, // unmeasured
    {latDeg: 0, lonDeg: -137, cloud: true} // outside the window
  ];
  const a = maskAgreement(themePixels, {
    g,
    xCoord: xc,
    yCoord: yc,
    box,
    bcm: noaaBcm,
    dqf: null
  });
  const keys = parseS3Keys(
    '<ListBucketResult><Contents><Key>ABI-L2-ACMC/2026/248/18/OR_ABI-L2-ACMC-M6_G18_s20262481846177_e1_c1.nc</Key></Contents>' +
      '<Contents><Key>ABI-L2-ACMC/2026/248/18/OR_ABI-L2-ACMC-M6_G18_s20262481851177_e1_c1.nc</Key></Contents></ListBucketResult>'
  );
  const latest = latestByStart(keys);
  // the mosaic's own minute: 18:50Z is nearest the 18:51:17 file
  // (-77 s), 18:44Z the 18:46:17 file (+137 s); 19:30Z has no file
  // within 15 min; a bad time is null
  const at1850 = nearestByStart(keys, '2026-09-05T18:50:00Z');
  const at1844 = nearestByStart(keys, Date.parse('2026-09-05T18:44:00Z'));
  const none = nearestByStart(keys, '2026-09-05T19:30:00Z');
  check(
    'THE CENSUSES read the mask as the product defines it',
    c.good === 6 &&
      c.cloudy === 3 &&
      near(c.cloudFrac, 0.5) &&
      c.acm.join(',') === '2,1,1,2' &&
      BCM_MEANINGS[1] === 'cloudy_or_probably_cloudy' &&
      ACM_MEANINGS[3] === 'cloudy' &&
      a.n === 4 &&
      a.bothCloud === 1 &&
      a.bothClear === 1 &&
      a.themeOnly === 1 &&
      a.noaaOnly === 1 &&
      near(a.agreement, 0.5) &&
      keys.length === 2 &&
      latest.stamp === '20262481851177' &&
      at1850.stamp === '20262481851177' &&
      at1850.offsetMs === 77e3 &&
      at1844.stamp === '20262481846177' &&
      at1844.offsetMs === 137e3 &&
      none === null &&
      nearestByStart(keys, 'not a time') === null &&
      stampToIso('20262481851177') === '2026-09-05T18:51:17Z' &&
      bucketPrefix('ABI-L2-ACMC', new Date('2026-09-05T18:51:00Z')) ===
        'ABI-L2-ACMC/2026/248/18/' &&
      bucketPrefix('ABI-L2-ACHAC', new Date('2026-01-01T00:05:00Z')) ===
        'ABI-L2-ACHAC/2026/001/00/' &&
      L2_BUCKETS['goes-west'] === 'noaa-goes18' &&
      L2_BUCKETS['goes-east'] === 'noaa-goes19' &&
      L2_PRODUCTS.mask === 'ABI-L2-ACMC' &&
      indexOfScanAngle(scanAngle(7, xc), xc) === 7,
    `eight pixels: a DQF 1 and a 255 fill drop out, 3 of 6 good pixels cloudy, ACM ${c.acm.join('/')}; the ` +
      `agreement table over four measured theme pixels reads both-cloud 1, both-clear 1, theme-only 1, ` +
      `NOAA-only 1 (an unmeasured pixel and one outside the window skipped); the bucket listing's latest ` +
      `start stamp 20262481851177 is 2026-09-05T18:51:17Z under the day-of-year/hour prefix ` +
      `ABI-L2-ACMC/2026/248/18/; the file nearest a mosaic's 18:50Z is the 18:51:17 one (+77 s), ` +
      `nearest 18:44Z the 18:46:17 one (+137 s), none within 15 min of 19:30Z`
  );
}

// ---- the window's arrays on the wire -----------------------------
{
  // the daemon packs, the page unpacks: bytes, 16-bit words and
  // floats (with NaN for fill) come back exact, in every length
  // modulo 3 (the base64 padding cases), and node's own base64
  // reads the daemon's
  const u8 = [0, 1, 2, 255, 17, 3, 200];
  const u16 = [0, 1, 65535, 258, 4660, 43981];
  const f32 = [0, -1.5, 3052.5, NaN, 1e-3, 65530 * 0.3052037, null];
  const p8 = packArray(u8, 'u8');
  const p16 = packArray(u16, 'u16');
  const pf = packArray(f32, 'f32');
  const b8 = unpackArray(p8);
  const b16 = unpackArray(p16);
  const bf = unpackArray(pf);
  const lens = [1, 2, 3, 4, 5, 6, 100, 101 * 101].every((n) => {
    const src = Array.from({length: n}, (_, i) => (i * 37) % 256);
    const back = unpackArray(packArray(src, 'u8'));
    return back.length === n && src.every((v, i) => back[i] === v);
  });
  const nodeReads = Buffer.from(p8.b64, 'base64').toString('hex');
  const mask = new Array(101 * 101).fill(1);
  const wire = JSON.stringify(packArray(mask, 'u8')).length;
  const digits = JSON.stringify(mask).length;
  check(
    'THE WIRE: packed windows round-trip exact',
    p8.kind === 'u8' &&
      p8.n === 7 &&
      b8 instanceof Uint8Array &&
      Array.from(b8).join(',') === u8.join(',') &&
      b16 instanceof Uint16Array &&
      Array.from(b16).join(',') === u16.join(',') &&
      bf instanceof Float32Array &&
      bf.length === 7 &&
      bf[0] === 0 &&
      bf[1] === -1.5 &&
      bf[2] === 3052.5 &&
      Number.isNaN(bf[3]) &&
      near(bf[4], 1e-3, 1e-10) &&
      near(bf[5], 65530 * 0.3052037, 1e-2) &&
      Number.isNaN(bf[6]) &&
      unpackArray(packArray([null, 7], 'u8'))[0] === 255 &&
      unpackArray(packArray([null, 7], 'u16'))[0] === 65535 &&
      lens &&
      nodeReads === '000102ff1103c8' &&
      wire < digits &&
      JSON.stringify(packArray(f32, 'f32')).length <
        JSON.stringify(f32).length + 40,
    `u8 ${u8.join('/')}, u16 ${u16.join('/')} and float32 (with NaN and null as fill) come back exact; ` +
      `every length 1..6 and 10201 round-trips; node's Buffer reads the daemon's base64 (${nodeReads}); ` +
      `a 101x101 mask is ${wire} bytes on the wire against ${digits} as JSON digits`
  );
}

process.exit(fail ? 1 : 0);
