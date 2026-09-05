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
  DCOMP_COD_MAX,
  DCOMP_FLAGS,
  IMAGERY_BAND,
  L2_BUCKETS,
  L2_PRODUCTS,
  bandKeys,
  btDifference,
  bucketPrefix,
  cutWindow,
  dcompAt,
  dcompCensus,
  dcompOverPixels,
  fixedGridGeometry,
  fixedGridToLatLon,
  heightCensus,
  indexOfScanAngle,
  keyBand,
  goodCensus,
  sstAgainstGrid,
  SST_DQF_MEANINGS,
  boxMean,
  DSR_ATBD,
  DSR_DQF_MEANINGS,
  DMW_ATBD,
  DMW_BAND,
  DMW_DQF_MEANINGS,
  DMW_LAYERS,
  dmwColumns,
  dmwDistanceKm,
  dmwLayerOf,
  dmwLayers,
  dmwNearest,
  dmwUnpack,
  dmwWithin,
  fieldCensus,
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
  unscale,
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

// ---- the imagery and DCOMP (149th pass) ----------------------------
{
  const keys = [
    'ABI-L2-CMIPC/2026/248/20/OR_ABI-L2-CMIPC-M6C02_G18_s20262482016177_e1_c1.nc',
    'ABI-L2-CMIPC/2026/248/20/OR_ABI-L2-CMIPC-M6C13_G18_s20262482016177_e1_c1.nc',
    'ABI-L2-CMIPC/2026/248/20/OR_ABI-L2-CMIPC-M6C13_G18_s20262482021177_e1_c1.nc',
    'ABI-L2-CMIPC/2026/248/20/OR_ABI-L2-CMIPC-M3C13_G18_s20262482026177_e1_c1.nc'
  ];
  const c13 = bandKeys(keys, 'C13');
  // the CMI scaling: counts 0 and 4095 to kelvin, the fill to NaN
  const k = unscale([0, 4095, 65535], {
    scale: 0.06145332,
    offset: 89.62,
    fill: 65535
  });
  // a 3 x 3 NOAA imagery window at 0.1 deg per pixel around (32,
  // -117) and the theme's pixels at its centres, 0.5 K warmer over
  // the clear ones and 2 K colder over the cloud ones; a DQF 1
  // pixel and a fill pixel drop out
  const g = fixedGridGeometry({
    semi_major_axis: 6378137,
    semi_minor_axis: 6356752.31414,
    perspective_point_height: 35786023,
    longitude_of_projection_origin: -137
  });
  const centre = latLonToFixedGrid(32, -117, g);
  const step = 0.000056 * 40;
  const xc = {scale: step, offset: centre.x - step};
  const yc = {scale: -step, offset: centre.y + step};
  const box = {i0: 0, j0: 0, rows: 3, cols: 3, i: 1, j: 1};
  const btK = new Float32Array([280, 281, 282, 283, 284, 285, 286, 287, NaN]);
  const dqf = new Uint8Array([0, 0, 0, 0, 1, 0, 0, 0, 0]);
  const at = (i, j) => fixedGridToLatLon(scanAngle(i, xc), scanAngle(j, yc), g);
  const px = [];
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 3; i++) {
      const p = at(i, j);
      const q = j * 3 + i;
      const cloud = q % 2 === 1;
      px.push({
        latDeg: p.latDeg,
        lonDeg: p.lonDeg,
        btC: btK[q] - 273.15 + (cloud ? -2 : 0.5),
        cloud
      });
    }
  px.push({latDeg: 0, lonDeg: -137, btC: 10, cloud: false}); // outside
  px.push({latDeg: px[0].latDeg, lonDeg: px[0].lonDeg, btC: NaN, cloud: false}); // unmeasured
  const bd = btDifference(px, {g, xCoord: xc, yCoord: yc, box, btK, dqf});
  // DCOMP's census: a fill, a clear, four retrievals (three water,
  // one ice; one thin, one at the thick bound)
  const cod = [NaN, 0, 5, 10, 2, 150];
  const cps = [NaN, NaN, 12, 30, 20, 8];
  const fl = [0, 0, 0, 128, 512, 256];
  const dc = dcompCensus(cod, cps, fl);
  const a3 = dcompAt(3, cod, cps, fl);
  // over the theme's pixels: the same 3 x 3 window carrying the six
  // values (and three more retrievals), the nine theme pixels plus
  // one outside and one duplicate
  const cod9 = [NaN, 0, 5, 10, 2, 150, 7, 7, 7];
  const cps9 = [NaN, NaN, 12, 30, 20, 8, 9, 9, 9];
  const fl9 = [0, 0, 0, 128, 512, 256, 0, 0, 0];
  const over = dcompOverPixels(
    [...px.slice(0, 9), px[0], {latDeg: 0, lonDeg: -137}],
    {g, xCoord: xc, yCoord: yc, box, cod: cod9, cps: cps9, dqf: fl9}
  );
  check(
    'THE IMAGERY AND DCOMP: the decoder audited, the retrievals censused',
    keyBand(keys[1]) === 'C13' &&
      keyBand(keys[0]) === 'C02' &&
      keyBand('ABI-L2-ACMC/2026/248/18/OR_ABI-L2-ACMC-M6_G18_s1_e1_c1.nc') ===
        null &&
      c13.length === 3 &&
      latestByStart(c13).stamp === '20262482026177' &&
      IMAGERY_BAND === 'C13' &&
      L2_PRODUCTS.imagery === 'ABI-L2-CMIPC' &&
      L2_PRODUCTS.cod === 'ABI-L2-CODC' &&
      L2_PRODUCTS.cps === 'ABI-L2-CPSC' &&
      near(k[0], 89.62, 1e-5) &&
      near(k[1], 89.62 + 4095 * 0.06145332, 1e-3) &&
      Number.isNaN(k[2]) &&
      // nine window pixels: the DQF 1 pixel (q 4, clear) and the
      // fill pixel (q 8, clear) drop out - 3 clear, 4 cloud remain
      bd.n === 7 &&
      bd.clear.n === 3 &&
      bd.cloud.n === 4 &&
      near(bd.clear.medianK, 0.5, 1e-4) &&
      near(bd.cloud.medianK, -2, 1e-4) &&
      near(bd.meanK, (3 * 0.5 - 4 * 2) / 7, 1e-4) &&
      near(bd.p10K, -2, 1e-4) &&
      near(bd.p90K, 0.5, 1e-4) &&
      near(bd.rmsK, Math.sqrt((3 * 0.25 + 4 * 4) / 7), 1e-4) &&
      dc.n === 6 &&
      dc.fill === 1 &&
      dc.clear === 1 &&
      dc.retrieved === 4 &&
      dc.water.n === 3 &&
      dc.ice.n === 1 &&
      dc.thin === 1 &&
      dc.thick === 1 &&
      dc.water.codMedian === 5 &&
      dc.water.reffMedian === 12 &&
      dc.ice.codMedian === 10 &&
      dc.ice.reffMedian === 30 &&
      dc.codMedian === 10 &&
      a3 !== null &&
      a3.tau === 10 &&
      a3.reff === 30 &&
      a3.ice === true &&
      a3.thin === false &&
      dcompAt(1, cod, cps, fl) === null &&
      dcompAt(0, cod, cps, fl) === null &&
      dcompAt(4, cod, cps, fl).thin === true &&
      dcompAt(5, cod, cps, fl).thick === true &&
      over.n === 9 &&
      over.retrieved === 7 &&
      over.water.n === 6 &&
      over.ice.n === 1 &&
      DCOMP_FLAGS.ice === 128 &&
      DCOMP_FLAGS.thick === 256 &&
      DCOMP_FLAGS.thin === 512 &&
      DCOMP_FLAGS.glint === 64 &&
      DCOMP_FLAGS.nonconvergence === 32 &&
      near(DCOMP_COD_MAX, 158.49, 1e-9),
    `the imagery prefix's keys sort by band (three C13 files of four, the newest 20:26:17; an ACMC key has ` +
      `no band); counts 0 and 4095 unscale to 89.62 and 341.27 K, the fill to NaN; the theme's nine pixels ` +
      `against a 3x3 imagery window read ${bd.n} differences (a DQF 1 pixel and a fill pixel out, an ` +
      `outside pixel and an unmeasured one skipped): clear median +0.50 K over ${bd.clear.n}, cloud -2.00 K ` +
      `over ${bd.cloud.n}, rms ${bd.rmsK.toFixed(3)} K; six DCOMP values census to 1 fill, 1 clear, 4 ` +
      `retrievals (3 water, tau median 5, r_eff 12 um; 1 ice, tau 10, r_eff 30), 1 thin, 1 at the thick ` +
      `bound; dcompAt reads the ice pixel and refuses the clear and fill ones; over the theme's pixels the ` +
      `window's ${over.retrieved} retrievals are counted once each`
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

// ---- THE HOUR'S SKIN (151st pass) --------------------------------
// goodCensus over a kelvin field with flags; sstAgainstGrid: every
// good pixel navigated to its lat/lon and looked up in an analysis
// field, ABI minus analysis in kelvin; the SST product and the
// file's own flag meanings.
{
  const cen = goodCensus([300, NaN, 290, 310, 305], [0, 0, 1, 0, 0]);
  const g = fixedGridGeometry({
    semi_major_axis: 6378137,
    semi_minor_axis: 6356752.31414,
    perspective_point_height: 35786023,
    longitude_of_projection_origin: -137
  });
  const x = {scale: 0.000056, offset: -0.069972, n: 2500};
  const y = {scale: -0.000056, offset: 0.128212, n: 1500};
  const box = windowBox(32.85, -117.12, g, x, y, x.n, y.n, 1);
  // a 3x3 window: kelvin at the corners and centre, NaN and a
  // degraded pixel left out; the "analysis" answers 20 C everywhere
  // except at one pixel it does not cover
  const sstK = [
    295.15,
    NaN,
    293.15,
    296.15,
    294.15,
    293.15,
    NaN,
    297.15,
    293.15
  ];
  const dqf = [0, 0, 1, 0, 0, 0, 0, 0, 3];
  const seen = [];
  const au = sstAgainstGrid(
    sstK,
    dqf,
    {g, xCoord: x, yCoord: y, box},
    (la, lo) => {
      seen.push([la, lo]);
      return seen.length === 3 ? null : 20;
    }
  );
  // good pixels: q0 +2, q3 +3, q4 +1, q5 0, q7 +4 -> the third lookup
  // (q4) is null -> diffs [2, 3, 0, 4] sorted [0, 2, 3, 4]
  check(
    "THE HOUR'S SKIN: the census and the analysis comparison",
    cen.n === 5 &&
      cen.good === 3 &&
      cen.minK === 300 &&
      cen.medianK === 305 &&
      cen.maxK === 310 &&
      box !== null &&
      box.rows === 3 &&
      box.cols === 3 &&
      au.n === 4 &&
      au.medianK === 3 &&
      au.p10K === 0 &&
      au.p90K === 4 &&
      near(au.meanK, 2.25, 1e-9) &&
      seen.length === 5 &&
      seen.every(
        ([la, lo]) => Math.abs(la - 32.85) < 0.1 && Math.abs(lo + 117.12) < 0.1
      ) &&
      L2_PRODUCTS.sst === 'ABI-L2-SSTF' &&
      SST_DQF_MEANINGS.length === 4 &&
      SST_DQF_MEANINGS[0] === 'good_quality_qf' &&
      SST_DQF_MEANINGS[1] === 'degraded_quality_qf',
    `goodCensus counts ${cen.good} good of ${cen.n} (a NaN and a degraded pixel out), min/median/max ` +
      `${cen.minK}/${cen.medianK}/${cen.maxK} K; over a 3x3 home window five good pixels are navigated ` +
      `within a tenth of a degree of the point, the analysis covers four, and ABI minus analysis ` +
      `reads median +${au.medianK} K (p10/p90 +${au.p10K}/+${au.p90K}, mean +${au.meanK}); the SST product ` +
      `is ${L2_PRODUCTS.sst} with the file's four flag meanings`
  );
}

// ---- THE DAYLIGHT, MEASURED (152nd pass) -------------------------
// fieldCensus in the field's own units (goodCensus is the kelvin
// spelling of it); boxMean: the good pixels within r of the
// window's own centre pixel, clipped to the window - the SRB
// ATBD's spatial average for reading a pixel against a point; the
// DSR product, its two flag meanings and the ATBD's printed
// validation figures.
{
  const vals = [
    100,
    200,
    300,
    400,
    500,
    600,
    700,
    800,
    900,
    1000,
    NaN,
    1200,
    1300,
    1400,
    1500,
    1600
  ];
  const dqf = [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const fc = fieldCensus(vals, dqf);
  const gc = goodCensus(vals, dqf);
  // a 4x4 window whose centre pixel is (1, 1): r = 1 takes the 3x3
  // block rows 0-2, cols 0-2 -> values 100..1100 minus the flagged
  // 600 and the NaN 1100: 100,200,300,500,700,900,1000 (7)
  const box = {i: 11, j: 21, i0: 10, j0: 20, cols: 4, rows: 4};
  const bm = boxMean(vals, dqf, box, 1);
  // r = 0: the centre pixel alone (index 5 = 600, flagged -> none)
  const bm0 = boxMean(vals, dqf, box, 0);
  // a centre at the window's corner: the box clips to the window
  const corner = boxMean(vals, dqf, {...box, i: 10, j: 20}, 1);
  check(
    'THE DAYLIGHT, MEASURED: the census, the spatial mean and the ATBD figures',
    fc.n === 16 &&
      fc.good === 14 &&
      fc.min === 100 &&
      fc.median === 900 &&
      fc.max === 1600 &&
      gc.good === 14 &&
      gc.minK === 100 &&
      gc.medianK === 900 &&
      gc.maxK === 1600 &&
      bm.n === 7 &&
      near(bm.mean, 3700 / 7, 1e-9) &&
      bm.min === 100 &&
      bm.max === 1000 &&
      bm0.n === 0 &&
      bm0.mean === null &&
      corner.n === 3 &&
      near(corner.mean, (100 + 200 + 500) / 3, 1e-9) &&
      L2_PRODUCTS.dsr === 'ABI-L2-DSRF' &&
      DSR_DQF_MEANINGS.length === 2 &&
      DSR_DQF_MEANINGS[1] === 'degraded_quality_or_invalid_qf' &&
      DSR_ATBD.accuracyPct === 2 &&
      DSR_ATBD.precisionPct === 17 &&
      DSR_ATBD.precisionWm2 === 74 &&
      DSR_ATBD.requirementWm2.mid === 65 &&
      DSR_ATBD.quantitativeSzaDeg === 70,
    `fieldCensus counts ${fc.good} good of ${fc.n} (a flag and a NaN out), min/median/max ${fc.min}/${fc.median}/${fc.max}; ` +
      `goodCensus is its kelvin spelling; boxMean over a 3x3 around the window's centre takes ${bm.n} good px ` +
      `(mean ${bm.mean.toFixed(1)}), r = 0 on a flagged centre takes none, a corner centre clips to ${corner.n}; ` +
      `${L2_PRODUCTS.dsr} with its two flag meanings; the ATBD's ABI validation - accuracy ~${DSR_ATBD.accuracyPct}%, ` +
      `precision ${DSR_ATBD.precisionPct}% (${DSR_ATBD.precisionWm2} W/m2), requirement 110/65/85 W/m2 by range, ` +
      `quantitative to ${DSR_ATBD.quantitativeSzaDeg} degrees`
  );
}

// ---- THE MEASURED MOTION (153rd pass) ----------------------------
// dmwWithin: the vectors within a radius from the file's columns,
// nearest first, fill and out-of-range rows left out, the flag
// carried; dmwLayerOf at the ATBD's own boundaries; dmwLayers: the
// tightest radius holding three good vectors, the vector mean (the
// meteorological from-direction), the scalar statistics; the wire's
// columns round-trip; dmwNearest; the product, band, flags and the
// ATBD's figures.
{
  const home = [32.85, -117.12];
  // ten rows: the home's own point (low, from 350), 0.3 deg north
  // (33.4 km; low, from 10), 0.6 deg north (66.7 km; low, from 0 -
  // the three low winds 20 degrees apart), 0.9 deg north (100 km;
  // 399.9 hPa = high's floor), 0.9 deg south (100 km; 400 hPa =
  // mid's ceiling), 1.2 deg east (~112 km; 699.9 hPa = mid), 1.2 deg
  // west (700 hPa = low, 112 km), 2 deg north (222 km: outside), a
  // flagged low vector 0.2 deg south (22 km, DQF 3), a fill row
  const cols = {
    lat: [32.85, 33.15, 33.45, 33.75, 31.95, 32.85, 32.85, 34.85, 32.65, -999],
    lon: [
      -117.12, -117.12, -117.12, -117.12, -117.12, -115.92, -118.32, -117.12,
      -117.12, -999
    ],
    spdMs: [10, 10, 10, 20, 20, 15, 12, 30, 9, -999],
    dirDeg: [350, 10, 0, 90, 90, 180, 270, 45, 200, -999],
    hPa: [900, 850, 1000, 399.9, 400, 699.9, 700, 300, 950, -999],
    tK: [280, 281, 283, 230, 231, 250, 270, 220, 285, -999],
    dqf: [0, 0, 0, 0, 0, 0, 0, 0, 3, -128],
    lzaDeg: [40, 40, 40, 40, 40, 40, 40, 40, 40, -999],
    szaDeg: [50, 50, 50, 50, 50, 50, 50, 50, 50, -999]
  };
  const w = dmwWithin(cols, home[0], home[1], 150);
  const kms = w.map((v) => v.km);
  const ordered = kms.every((k, i) => i === 0 || k >= kms[i - 1]);
  const L = dmwLayers(w);
  // the low layer: within 50 km only the home's own and the 33-km
  // vector are good (the 22-km one is flagged) -> 100 km takes the
  // three 20 degrees apart: u = 10(sin 10 - sin 10 + 0)/3 = 0, v =
  // -(10 cos 10 + 10 cos 10 + 10)/3 -> from 0 at 9.899 m/s (the 112-km
  // 700 hPa vector waits outside the 100-km radius, counted in n)
  const lowSpd = (2 * 10 * Math.cos((10 * Math.PI) / 180) + 10) / 3;
  const back = dmwUnpack(dmwColumns(w));
  const Lb = dmwLayers(back);
  const nearHome = dmwNearest(w, 32.86, -117.12, 30);
  const nearNone = dmwNearest(w, 40, -117.12, 30);
  const d0 = dmwDistanceKm(0, 0, 0, 1); // a degree of longitude on the equator
  check(
    'THE MEASURED MOTION: the radius, the layers, the vector mean',
    w.length === 8 &&
      ordered &&
      near(w[0].km, 0, 1e-9) &&
      w[0].dirDeg === 350 &&
      w[1].dqf === 3 &&
      near(w[1].km, dmwDistanceKm(32.85, -117.12, 32.65, -117.12), 1e-9) &&
      w[1].km > 22 &&
      w[1].km < 22.5 &&
      w.every((v) => v.km <= 150) &&
      !w.some((v) => v.hPa === 300) &&
      !w.some((v) => v.lat === -999) &&
      dmwLayerOf(399.9) === 'high' &&
      dmwLayerOf(400) === 'mid' &&
      dmwLayerOf(699.9) === 'mid' &&
      dmwLayerOf(700) === 'low' &&
      dmwLayerOf(1000) === 'low' &&
      dmwLayerOf(99) === null &&
      dmwLayerOf(1001) === null &&
      L.low.n === 4 &&
      L.low.used === 3 &&
      L.low.radiusKm === 100 &&
      near(L.low.spdMs, lowSpd, 1e-9) &&
      near(L.low.dirDeg, 0, 1e-9) &&
      L.low.meanMs === 10 &&
      L.low.medianMs === 10 &&
      L.low.minMs === 10 &&
      L.low.maxMs === 10 &&
      L.low.sdMs === 0 &&
      L.low.medianHpa === 900 &&
      L.low.nearestKm === 0 &&
      L.mid.n === 2 &&
      L.mid.used === 0 &&
      L.mid.radiusKm === null &&
      L.mid.spdMs === null &&
      L.mid.nearestKm !== null &&
      L.high.n === 1 &&
      L.high.radiusKm === null &&
      JSON.stringify(Lb.low) === JSON.stringify(L.low) &&
      Lb.mid.n === L.mid.n &&
      Lb.mid.radiusKm === null &&
      // the wire rounds a distance to 0.1 km
      near(Lb.mid.nearestKm, L.mid.nearestKm, 0.05) &&
      back.length === 8 &&
      back[0].lat === 32.85 &&
      back[1].dqf === 3 &&
      nearHome !== null &&
      nearHome.dirDeg === 350 &&
      nearHome.km < 1.2 &&
      nearNone === null &&
      near(d0, 111.195, 1e-2) &&
      L2_PRODUCTS.dmw === 'ABI-L2-DMWC' &&
      DMW_BAND === 'C14' &&
      DMW_LAYERS.length === 3 &&
      DMW_LAYERS[0].id === 'high' &&
      DMW_DQF_MEANINGS.length === 23 &&
      DMW_DQF_MEANINGS[0] === 'good_wind_qf' &&
      DMW_DQF_MEANINGS[22] === 'invalid_due_to_feature_cluster_not_found_qf' &&
      DMW_ATBD.requirement.accuracyMs === 7.5 &&
      DMW_ATBD.requirement.precisionMs === 4.2 &&
      DMW_ATBD.lwirVsRaob.low.accuracyMs[1] === 3.69 &&
      DMW_ATBD.lwirVsRaob.high.precisionMs[0] === 3.14 &&
      DMW_ATBD.imageGapS === 300 &&
      DMW_ATBD.targetBoxPx === 19,
    `of ten rows eight lie within 150 km (the 222-km and the fill row out), nearest first (the home's own at 0 km, ` +
      `the flagged one at ${w[1].km.toFixed(1)} km); the ATBD's boundaries 399.9/400 and 699.9/700 hPa fall high/mid and mid/low; ` +
      `the low layer holds ${L.low.n} good vectors, takes ${L.low.used} within ${L.low.radiusKm} km (50 km held only two) ` +
      `and their vector mean is ${L.low.spdMs.toFixed(3)} m/s from ${L.low.dirDeg.toFixed(1)} deg against a scalar mean of ` +
      `${L.low.meanMs} (three winds 20 degrees apart); mid (2) and high (1) hold too few for a mean; the wire's rounded ` +
      `columns give the same layers; the nearest good vector 1 km from the home is the home's own; a degree of longitude ` +
      `on the equator is ${d0.toFixed(3)} km; ${L2_PRODUCTS.dmw} band ${DMW_BAND}, ${DMW_DQF_MEANINGS.length} flag meanings, ` +
      `the requirement 7.5 / 4.2 m/s and Table 16's GOES-17 low-layer accuracy ${DMW_ATBD.lwirVsRaob.low.accuracyMs.join('-')} m/s`
  );
}

process.exit(fail ? 1 : 0);
