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
  AOD_ATBD,
  AOD_DQF_MEANINGS,
  aodBoxEstimate,
  aodCensus,
  aodChannelTau,
  aodFigures,
  BCM_MEANINGS,
  DCOMP_COD_MAX,
  DCOMP_FLAGS,
  IMAGERY_BAND,
  L2_BUCKETS,
  L2_PRODUCTS,
  LST_ATBD,
  LST_DQF_MEANINGS,
  LST_PQI_CLOUD,
  LST_PQI_QUALITY,
  LST_PQI_SURFACE,
  LST_PQI_WV,
  lstPqi,
  lstValidationSpan,
  nearestGood,
  qualityCensus,
  VIS_ATBD,
  VIS_BAND,
  VIS_DQF_MEANINGS,
  coverFraction,
  cosSolarZenith,
  kappaFactor,
  OTSU_BIMODAL_ETA,
  otsuThreshold,
  TPW_ATBD,
  TPW_DQF_MEANINGS,
  tpwCensus,
  tpwQuality,
  PHASE_ATBD,
  PHASE_MEANINGS,
  PHASE_QF,
  phaseCensus,
  phaseQuality,
  phaseWords,
  FIRE_ATBD,
  FIRE_QA_WORDS,
  fireCensus,
  fireClass,
  fireList,
  frpMir,
  reflectanceOfFactor,
  solarGeometry,
  solarZenithDeg,
  visCensus,
  visReferences,
  bandKeys,
  btDifference,
  bucketPrefix,
  cutWindow,
  dcompAt,
  dcompCensus,
  dcompOverPixels,
  fixedGridGeometry,
  fixedGridToLatLon,
  RAIN_ATBD,
  RAIN_DQF_BITS,
  rainCensus,
  rainEvaporationAdjust,
  rainFlagWords,
  rainList,
  rainQuality,
  nearestRain,
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
  quantile,
  scanAngle,
  stampToIso,
  unpackArray,
  unscale,
  windowBox,
  windowIndexOf
} from './goesl2.js';
import {
  LAP_ATBD,
  LAP_DQF_OVERALL,
  lapCensus,
  lapColumnRows,
  lapFreezingLevelM,
  lapLevelAt,
  lapNearestUsable,
  lapPwMm,
  lapQuality,
  dewPointC,
  specificHumidity
} from './goesl2.js';
import {eLiq} from './contrails.js';
import {LAP_EXPECT, LVMPC_B64, LVTPC_B64} from './lap-fixture.js';
import {DSI_EXPECT, DSIC_B64} from './dsi-fixture.js';
import {
  DSI_ATBD,
  DSI_NAMES,
  dsiAgreement,
  dsiVerdict,
  lapIndicesFromRows,
  lapMeanLayerStart,
  lapParcelRows,
  lapStability
} from './goesl2.js';
import {parcelAscent} from './sounding.js';
import {
  ACHA_ATBD,
  heightBands,
  towerTopsFromOrbit,
  towerTopsWords
} from './goesl2.js';
import {
  ADP_ATBD,
  ADP_CALLED_FLOOR,
  ADP_FLAG_FILL,
  ADP_PQI2,
  ADP_RADIUS_PX,
  adpCensus,
  adpConfidence,
  adpDominant,
  adpFlagBytes,
  adpPixel,
  adpReweight,
  adpScores
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

// ---- THE MEASURED HAZE (156th pass) ------------------------------
// aodCensus: the window by the file's four quality levels with the
// high-quality statistics and the usable (high + medium) count and
// median beside them; aodBoxEstimate: the ATBD's own collocation
// estimator - the high-quality pixels within r of the centre,
// sorted, the lowest 20% and highest 50% screened, the rest
// averaged; aodFigures: Table 2-1's requirement and Table 4-6's
// measured bias and precision for a value's range over a surface;
// aodChannelTau: the channel set re-scaled to the satellite's 550
// nm value with its shape kept, flat from a floored set, clamped;
// the product, the flag meanings and the ATBD's numbers.
{
  // a 4x4 window, centre (1, 1): tau = 0.1 .. 1.6 with a fill at
  // index 10; DQF 0 high at ten pixels, medium at 1 and 8, low at 3
  // and 12, no retrieval at 6, fill (255) at 10
  const tau = [
    0.1,
    0.2,
    0.3,
    0.4,
    0.5,
    0.6,
    0.7,
    0.8,
    0.9,
    1.0,
    NaN,
    1.2,
    1.3,
    1.4,
    1.5,
    1.6
  ];
  const dqf = [0, 1, 0, 2, 0, 0, 3, 0, 1, 0, 255, 0, 2, 0, 0, 0];
  const box = {i: 11, j: 21, i0: 10, j0: 20, cols: 4, rows: 4};
  const c = aodCensus(tau, dqf);
  // r = 1: the 3x3 block rows 0-2, cols 0-2 holds the high pixels
  // 0.1, 0.3, 0.5, 0.6, 1.0 -> the lowest 20% (one) and the highest
  // 50% (from the third) screened -> 0.3 and 0.5 kept, mean 0.4
  const e1 = aodBoxEstimate(tau, dqf, box, 1);
  // r = 0: the centre pixel alone (index 5, 0.6, high)
  const e0 = aodBoxEstimate(tau, dqf, box, 0);
  // r = 3: the whole window's ten high values -> two and five
  // screened, 0.5, 0.6, 0.8 kept
  const e3 = aodBoxEstimate(tau, dqf, box, 3);
  // no high pixel in reach: a centre on the flagged corner (3, 0)
  const eNone = aodBoxEstimate(tau, dqf, {...box, i: 13, j: 20}, 0);
  const fLand = aodFigures(0.11, 'land');
  const fHigh = aodFigures(1, 'land');
  const fWater = aodFigures(0.03, 'water');
  const fWaterHi = aodFigures(0.5, 'water');
  const ch = aodChannelTau([0.2, 0.1, 0.05], 0.2);
  const chFlat = aodChannelTau([1e-4, 1e-4, 1e-4], 0.15);
  const chClamp = aodChannelTau([2, 2.5, 3], 3.5);
  const chNeg = aodChannelTau([0.2, 0.1, 0.05], -0.02);
  check(
    'THE MEASURED HAZE: the quality census, the ATBD’s collocation estimator, its figures by range, the channel re-scaled',
    c.n === 16 &&
      c.high === 10 &&
      c.medium === 2 &&
      c.low === 2 &&
      c.none === 1 &&
      c.fill === 1 &&
      c.high + c.medium + c.low + c.none + c.fill === c.n &&
      near(c.min, 0.1) &&
      near(c.median, 1.0) &&
      near(c.max, 1.6) &&
      c.usableN === 12 &&
      near(c.usableMedian, 0.9) &&
      e1.n === 5 &&
      e1.kept === 2 &&
      near(e1.mean, 0.4) &&
      near(e1.min, 0.1) &&
      near(e1.max, 1.0) &&
      e0.n === 1 &&
      e0.kept === 1 &&
      near(e0.mean, 0.6) &&
      e3.n === 10 &&
      e3.kept === 3 &&
      near(e3.mean, (0.5 + 0.6 + 0.8) / 3) &&
      eNone.n === 0 &&
      eNone.mean === null &&
      fLand.range === '0.04–0.8' &&
      fLand.surface === 'land' &&
      fLand.bias === 0.04 &&
      fLand.precision === 0.11 &&
      fLand.n === 38694 &&
      fLand.reqAccuracy === 0.04 &&
      fLand.reqPrecision === 0.25 &&
      aodFigures(0.02, 'land').range === '< 0.04' &&
      fHigh.range === '> 0.8' &&
      fHigh.bias === -0.1 &&
      fHigh.precision === 0.65 &&
      fHigh.n === 254 &&
      fWater.range === '< 0.4' &&
      fWater.bias === 0.01 &&
      fWater.precision === 0.04 &&
      fWater.n === 6758 &&
      fWaterHi.range === '> 0.4' &&
      fWaterHi.bias === -0.003 &&
      aodFigures(NaN, 'land') === null &&
      aodFigures(0.1, 'moon').surface === 'land' &&
      near(ch[0], 0.4) &&
      near(ch[1], 0.2) &&
      near(ch[2], 0.1) &&
      chFlat.every((v) => near(v, 0.15)) &&
      near(chClamp[0], 2.4) &&
      chClamp[1] === 3 &&
      chClamp[2] === 3 &&
      near(chNeg[1], 1e-4) &&
      chNeg[2] === 1e-4 &&
      L2_PRODUCTS.aod === 'ABI-L2-AODC' &&
      AOD_DQF_MEANINGS.length === 4 &&
      AOD_DQF_MEANINGS[0] === 'high_quality_retrieval_qf' &&
      AOD_DQF_MEANINGS[3] === 'no_retrieval_qf' &&
      AOD_ATBD.wavelengthNm === 550 &&
      AOD_ATBD.land.length === 3 &&
      AOD_ATBD.water.length === 2 &&
      AOD_ATBD.land[0].reqAccuracy === 0.06 &&
      AOD_ATBD.land[2].reqPrecision === 0.35 &&
      AOD_ATBD.water[1].reqAccuracy === 0.1 &&
      AOD_ATBD.overall.land.precision === 0.12 &&
      AOD_ATBD.overall.water.bias === 0.01 &&
      AOD_ATBD.boxKm === 50 &&
      AOD_ATBD.screenLow === 0.2 &&
      AOD_ATBD.screenHigh === 0.5 &&
      AOD_ATBD.lowFlagSzaDeg === 80 &&
      AOD_ATBD.lowFlagLzaDeg === 60 &&
      AOD_ATBD.aeAccuracyReq === 0.3 &&
      AOD_ATBD.aePrecisionReq === 0.15 &&
      AOD_ATBD.validation.craft === 'GOES-16',
    `of 16 px ${c.high} high, ${c.medium} medium, ${c.low} low, ${c.none} none, ${c.fill} fill; the high-quality ` +
      `min/median/max ${c.min}/${c.median}/${c.max}, ${c.usableN} usable with median ${c.usableMedian}; the ATBD's ` +
      `estimator over the 3x3 keeps ${e1.kept} of ${e1.n} high px (the lowest 20% and highest 50% screened) for ` +
      `${e1.mean.toFixed(2)}, the centre alone gives ${e0.mean}, the whole window keeps ${e3.kept} of ${e3.n} for ` +
      `${e3.mean.toFixed(4)}, a flagged corner none; 0.11 over land falls in ${fLand.range} (Table 4-6 bias ` +
      `${fLand.bias}, precision ${fLand.precision} over ${fLand.n}; the requirement ${fLand.reqAccuracy} / ` +
      `${fLand.reqPrecision}), 1.0 in ${fHigh.range} (${fHigh.bias} / ${fHigh.precision} over ${fHigh.n}), 0.03 over ` +
      `water in ${fWater.range} (${fWater.bias} / ${fWater.precision} over ${fWater.n}); a set 0.2/0.1/0.05 re-scaled ` +
      `to 0.2 at 550 nm is ${ch.map((v) => v.toFixed(2)).join('/')} (the shape kept), a floored set becomes flat ` +
      `${chFlat[1]}, 3.5 clamps to ${chClamp.join('/')}, a negative retrieval floors to ${chNeg[1]}; ` +
      `${L2_PRODUCTS.aod} with ${AOD_DQF_MEANINGS.length} flag meanings; the ATBD's box ${AOD_ATBD.boxKm} km, ` +
      `the low flag past ${AOD_ATBD.lowFlagSzaDeg} deg sun and ${AOD_ATBD.lowFlagLzaDeg} deg satellite zenith, ` +
      `the Angstrom precision requirement ${AOD_ATBD.aePrecisionReq} not met`
  );
}

// ---- THE LAND'S SKIN (157th pass) --------------------------------
// lstPqi: the PQI word by Table 3.7's bit numbers - two words read
// from the 02Z file of 6 Sep 2026 (the home pixel 1583: no retrieval
// under cloud, land, moist, the emissivity not the AWG's, the AOD
// flag "out of range or missing" at night; its northern neighbour
// 1568: high quality, clear), synthetic words for the bits the file
// never set here, the fill null; nearestGood: the nearest pixel of a
// quality ring by ring, ties by Euclidean distance; the ATBD's
// numbers and the validation spans of both satellites (the
// matchup-weighted means recomputed from the tables).
{
  const home = lstPqi(1583);
  const north = lstPqi(1568);
  // day (4096) + view angle large (2048) + coastal (192) + probably
  // cloudy (8) + medium (1)
  const syn = lstPqi(4096 + 2048 + 192 + 8 + 1);
  // cirrus (8192) + fire (16384) + snow/ice (64) + very moist (768)
  const syn2 = lstPqi(8192 + 16384 + 64 + 768);
  // a 5x5 window, centre (2, 2) flagged no retrieval; high pixels at
  // (1, 2) [di -1, dj 0], (2, 0) [dj -2] and (4, 4); a medium at (3, 2)
  const vals = new Float32Array(25).fill(300);
  const dqf = new Uint8Array(25).fill(3);
  const at = (i, j) => j * 5 + i;
  dqf[at(2, 2)] = 3;
  dqf[at(1, 2)] = 0;
  dqf[at(2, 0)] = 0;
  dqf[at(4, 4)] = 0;
  dqf[at(3, 2)] = 1;
  vals[at(1, 2)] = 301;
  vals[at(2, 0)] = 302;
  vals[at(4, 4)] = 303;
  const box = {i: 12, j: 22, i0: 10, j0: 20, cols: 5, rows: 5};
  const n0 = nearestGood(vals, dqf, box, 4, 0);
  const n1 = nearestGood(vals, dqf, box, 4, 1);
  const nNone = nearestGood(vals, dqf, box, 0, 0);
  const nFar = nearestGood(vals, dqf, {...box, i: 10, j: 20}, 4, 0);
  // a finite-value rule: a good flag over a NaN value is skipped
  const vals2 = Float32Array.from(vals);
  vals2[at(1, 2)] = NaN;
  const n0b = nearestGood(vals2, dqf, box, 4, 0);
  const s16 = lstValidationSpan('GOES-16');
  const s17 = lstValidationSpan('GOES-17');
  const sX = lstValidationSpan('GOES-18');
  const near4 = (a, b) => Math.abs(a - b) < 1e-4;
  check(
    'THE LAND’S SKIN: the PQI word by the ATBD’s bits, the nearest pixel of a quality, the validation spans',
    home !== null &&
      home.quality === 3 &&
      home.cloud === 3 &&
      home.inputBad === false &&
      home.aodOut === true &&
      home.surface === 0 &&
      home.waterVapour === 2 &&
      home.emissivityOther === true &&
      home.viewLarge === false &&
      home.day === false &&
      home.cirrus === false &&
      home.fire === false &&
      north.quality === 0 &&
      north.cloud === 0 &&
      north.surface === 0 &&
      north.waterVapour === 2 &&
      syn.day === true &&
      syn.viewLarge === true &&
      syn.surface === 3 &&
      syn.cloud === 2 &&
      syn.quality === 1 &&
      syn.cirrus === false &&
      syn2.cirrus === true &&
      syn2.fire === true &&
      syn2.surface === 1 &&
      syn2.waterVapour === 3 &&
      syn2.quality === 0 &&
      lstPqi(65535) === null &&
      lstPqi(NaN) === null &&
      LST_PQI_QUALITY[home.quality] === 'no retrieval' &&
      LST_PQI_CLOUD[home.cloud] === 'cloudy' &&
      LST_PQI_SURFACE[syn.surface] === 'coastal' &&
      LST_PQI_WV[syn2.waterVapour].startsWith('very moist') &&
      n0 !== null &&
      n0.q === at(1, 2) &&
      n0.di === -1 &&
      n0.dj === 0 &&
      n0.r === 1 &&
      n1 !== null &&
      n1.q === at(3, 2) &&
      n1.r === 1 &&
      nNone === null &&
      nFar !== null &&
      nFar.q === at(2, 0) &&
      nFar.di === 2 &&
      nFar.dj === 0 &&
      nFar.r === 2 &&
      n0b !== null &&
      n0b.q === at(2, 0) &&
      n0b.dj === -2 &&
      n0b.r === 2 &&
      L2_PRODUCTS.lst === 'ABI-L2-LSTC' &&
      LST_DQF_MEANINGS.length === 4 &&
      LST_DQF_MEANINGS[0] === 'high_quality_retrieval_qf' &&
      LST_DQF_MEANINGS[3] === 'no_retrieval_qf' &&
      LST_DQF_MEANINGS.join() === AOD_DQF_MEANINGS.join() &&
      qualityCensus === aodCensus &&
      LST_ATBD.requirement.accuracyK === 2.5 &&
      LST_ATBD.requirement.precisionK === 2.3 &&
      LST_ATBD.requirement.unconditionalK === 5 &&
      LST_ATBD.requirement.rangeK[0] === 213 &&
      LST_ATBD.requirement.rangeK[1] === 330 &&
      LST_ATBD.requirement.lzaMaxDeg === 70 &&
      LST_ATBD.quantitativeLzaDeg === 55 &&
      LST_ATBD.dayMaxSzaDeg === 85 &&
      LST_ATBD.qualityRules.length === 5 &&
      LST_ATBD.qualityRules[4].quality.join() === 'high,medium,low' &&
      LST_ATBD.qualityRules[3].quality.join() === 'medium,medium,low' &&
      LST_ATBD.matchup.maxDeg === 0.02 &&
      s16.n === 21621 &&
      s16.sites === 7 &&
      s16.biasK[0] === -2.63 &&
      s16.biasK[1] === 1.8 &&
      s16.precisionK[0] === 1.59 &&
      s16.precisionK[1] === 2.26 &&
      near4(s16.meanBiasK, 0.1945) &&
      near4(s16.meanPrecisionK, 1.8883) &&
      s16.table === '4.1' &&
      s17.n === 5713 &&
      s17.biasK[0] === -2.41 &&
      s17.biasK[1] === 1.78 &&
      s17.precisionK[0] === 1.28 &&
      s17.precisionK[1] === 2.41 &&
      near4(s17.meanBiasK, -0.7378) &&
      near4(s17.meanPrecisionK, 1.7654) &&
      s17.table === '4.2' &&
      s17.from === '2018-08-12' &&
      sX.craft === 'GOES-16',
    `the home word 1583 reads ${LST_PQI_QUALITY[home.quality]} under ${LST_PQI_CLOUD[home.cloud]} over ${LST_PQI_SURFACE[home.surface]}, ` +
      `${LST_PQI_WV[home.waterVapour]}, night, the AOD flag out of range or missing (no retrieval at night), the emissivity not the AWG's; ` +
      `its neighbour 1568 ${LST_PQI_QUALITY[north.quality]} under ${LST_PQI_CLOUD[north.cloud]}; the synthetic words set day, the large view angle, ` +
      `${LST_PQI_SURFACE[syn.surface]}, cirrus and fire as the ATBD numbers them, the fill null; the nearest high pixel of a 5x5 window sits ` +
      `at (${n0.di}, ${n0.dj}) ring ${n0.r} (ties broken by distance: with the ring-1 pixel's value NaN the ring-2 corner at (2, 2) loses ` +
      `to (${n0b.di}, ${n0b.dj})), a medium at ring ${n1.r}, none within 0; GOES-16's seven SURFRAD sites (Table 4.1): ${s16.n.toLocaleString('en-US')} matchups, ` +
      `bias ${s16.biasK[0]} to +${s16.biasK[1]} K, precision ${s16.precisionK[0]}-${s16.precisionK[1]} K, the weighted mean bias ` +
      `${s16.meanBiasK.toFixed(3)} and precision ${s16.meanPrecisionK.toFixed(3)} K; GOES-17's (Table 4.2, the West slot's own craft): ` +
      `${s17.n.toLocaleString('en-US')} matchups, bias ${s17.biasK[0]} to +${s17.biasK[1]}, precision ${s17.precisionK[0]}-${s17.precisionK[1]}, ` +
      `weighted ${s17.meanBiasK.toFixed(3)} / ${s17.meanPrecisionK.toFixed(3)} K; the requirement ${LST_ATBD.requirement.accuracyK} / ` +
      `${LST_ATBD.requirement.precisionK} K over ${LST_ATBD.requirement.rangeK.join('-')} K within ${LST_ATBD.requirement.lzaMaxDeg} deg, ` +
      `quantitative to ${LST_ATBD.quantitativeLzaDeg}; an unknown craft answers GOES-16's table`
  );
}

// ---- THE CLOUD'S PHASE (161st pass) ------------------------------
// The ATBD's categories (Table 31) as the file numbers them, the QF
// word's bits (Table 32), the census on a synthetic window (every
// category, a low-quality word, the fill), the requirement and the
// validation tables recomputed: the agreed counts over the matchups.
{
  const ph = new Uint8Array(40);
  const qf = new Uint8Array(40);
  for (let q = 0; q < 40; q++) ph[q] = q % 8 === 7 ? 255 : q % 6;
  qf[1] = PHASE_QF.low | PHASE_QF.beta; // a liquid pixel of low quality
  qf[4] = PHASE_QF.weakIce; // a bit without the overall bit: still high
  qf[10] = 255;
  const c = phaseCensus(ph, qf);
  const qLow = phaseQuality(qf[1]);
  const qHigh = phaseQuality(qf[4]);
  const v = PHASE_ATBD.validation;
  const agreeAll = Math.round(v.all.total.n * v.all.total.agree);
  check(
    'THE CLOUD’S PHASE: the ATBD’s categories and quality bits, the census by phase, the validation tables',
    L2_PRODUCTS.phase === 'ABI-L2-ACTPC' &&
      PHASE_MEANINGS.length === 6 &&
      PHASE_MEANINGS[0] === 'clear_sky' &&
      PHASE_MEANINGS[2] === 'super_cooled_liquid_water' &&
      PHASE_MEANINGS[4] === 'ice' &&
      phaseWords(4) === 'ice' &&
      phaseWords(255) === null &&
      PHASE_QF.zenith === 32 &&
      qLow.high === false &&
      qLow.why.join() === 'beta ratio' &&
      qHigh.high === true &&
      qHigh.why.join() === 'weak ice signal' &&
      phaseQuality(255) === null &&
      c.n === 40 &&
      c.fill === 5 &&
      c.low === 2 &&
      c.clear +
        c.liquid +
        c.supercooled +
        c.mixed +
        c.ice +
        c.unknown +
        c.low +
        c.fill ===
        40 &&
      c.cloudy === c.liquid + c.supercooled + c.mixed + c.ice &&
      near(c.iceFrac, c.ice / c.cloudy, 1e-12) &&
      near(c.waterFrac + c.iceFrac, 1, 1e-12) &&
      PHASE_ATBD.requirement.correctFraction === 0.8 &&
      PHASE_ATBD.requirement.minOpticalDepth === 1 &&
      PHASE_ATBD.requirement.lzaQuantitativeDeg === 65 &&
      PHASE_ATBD.homogeneousFreezingK === 238 &&
      PHASE_ATBD.liquidTopK === 273 &&
      v.matchups === 95249 &&
      v.all.liquid.n + v.all.ice.n === v.all.total.n &&
      Math.abs(
        v.all.liquid.n * v.all.liquid.agree +
          v.all.ice.n * v.all.ice.agree -
          agreeAll
      ) < 60 &&
      v.thick.liquid.n + v.thick.ice.n === v.thick.total.n &&
      Math.abs(
        v.thick.liquid.n * v.thick.liquid.agree +
          v.thick.ice.n * v.thick.ice.agree -
          Math.round(v.thick.total.n * v.thick.total.agree)
      ) < 60 &&
      v.thick.total.agree > PHASE_ATBD.requirement.correctFraction &&
      v.all.ice.agree > PHASE_ATBD.requirement.correctFraction,
    `${PHASE_MEANINGS.length} categories as the file numbers them (${PHASE_MEANINGS.join(', ')}), the QF word's six bits; a 40-px window ` +
      `censuses ${c.clear} clear, ${c.liquid} liquid, ${c.supercooled} supercooled, ${c.mixed} mixed, ${c.ice} ice, ${c.unknown} undetermined, ` +
      `${c.low} low quality (one liquid pixel's word ${qf[1]}: ${qLow.why.join(', ')}), ${c.fill} fill - every pixel counted once, ice ` +
      `${(100 * c.iceFrac).toFixed(0)}% of ${c.cloudy} cloudy; a weak-ice bit without the overall bit stays high quality; the ATBD's Tables 40-41 ` +
      `recomputed: ${v.all.liquid.n.toLocaleString('en-US')} liquid at ${(100 * v.all.liquid.agree).toFixed(2)}% and ${v.all.ice.n.toLocaleString('en-US')} ice at ` +
      `${(100 * v.all.ice.agree).toFixed(2)}% make ${agreeAll.toLocaleString('en-US')} agreed of ${v.all.total.n.toLocaleString('en-US')} (${(100 * v.all.total.agree).toFixed(2)}%), ` +
      `the thick-cloud qualifier ${(100 * v.thick.total.agree).toFixed(2)}% of ${v.thick.total.n.toLocaleString('en-US')} against the 80% requirement; ` +
      `tops at or under ${PHASE_ATBD.homogeneousFreezingK} K are ice, liquid tops over ${PHASE_ATBD.liquidTopK} K are warm`
  );
}

// ---- THE COLUMN FROM ORBIT (171st pass) ----------------------------
// The flags' words, the humidity and dew-point helpers against the
// theme's own Murphy-Koop water, a synthetic isothermal dry column
// whose hypsometric heights close in closed form, the freezing level,
// the level interpolation, the census and the nearest usable field of
// regard; then the REAL crop: the centre column through hdf5.js and
// the law against h5py's independent hypsometric column.
{
  const qGood = lapQuality(0, 0);
  const qDeg = lapQuality(3, 0);
  const qCloud = lapQuality(4, 255);
  const qBad = lapQuality(0, 2);
  const tK = 280;
  const e = eLiq(tK);
  const tdBack = dewPointC(e);
  // an isothermal dry column: z = (Rd T / g) ln(p0 / p) exactly
  const pr = [1100, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100, 50];
  const tCol = pr.map(() => tK);
  const rhCol = pr.map(() => NaN);
  const dry = lapColumnRows(pr, tCol, rhCol, {pSfcHpa: 1000, zSfcM: 0});
  const zClosed = (p) => ((287.053 * tK) / 9.80665) * Math.log(1000 / p);
  // a column crossing 0 C between two levels
  const pr2 = [1100, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100];
  const tC2 = [20, 18, 12, 6, 1, -5, -12, -22, -35, -50, -60];
  const wet = lapColumnRows(
    pr2,
    tC2.map((c) => c + 273.15),
    pr2.map(() => 0.5),
    {pSfcHpa: 1000, zSfcM: 0}
  );
  const fz = lapFreezingLevelM(wet);
  const a700 = lapLevelAt(wet, 700);
  const pw = lapPwMm(wet);
  const overall = Uint8Array.from([4, 0, 4, 255, 4, 0, 3, 1, 5]);
  const retrieval = Uint8Array.from([255, 0, 255, 255, 255, 2, 0, 255, 255]);
  const cen = lapCensus(overall, retrieval);
  const nearest = lapNearestUsable(overall, retrieval, {
    cols: 3,
    rows: 3,
    ci: 1,
    cj: 1
  });
  const noneUsable = lapNearestUsable(Uint8Array.from([4, 4, 4, 4]), null, {
    cols: 2,
    rows: 2,
    ci: 0,
    cj: 0
  });
  const tooFew = lapColumnRows(
    [1000, 900, 800],
    [280, 275, 270],
    [0.5, 0.5, 0.5],
    {pSfcHpa: 1013}
  );
  check(
    'THE COLUMN FROM ORBIT: the flags, the water helpers, a closed-form column, the freezing level, the census',
    qGood.usable === true &&
      qGood.words === 'good' &&
      qDeg.usable === true &&
      qDeg.degraded === true &&
      qDeg.words === LAP_DQF_OVERALL[3] &&
      qCloud.usable === false &&
      qCloud.words.startsWith('invalid: insufficient clear') &&
      qBad.usable === true &&
      qBad.words.includes('residual') &&
      lapQuality(255, 255).usable === false &&
      near(tdBack, tK - 273.15, 1e-9) &&
      near(
        specificHumidity(e, 100000),
        (0.622 * e) / (100000 - 0.378 * e),
        1e-15
      ) &&
      dry !== null &&
      // the surface row and the nine levels from 900 to 100 hPa (50
      // is past the ATBD's useful top, 1100 under the surface)
      dry.length === 10 &&
      dry[0].p === 1000 &&
      dry[0].hM === 0 &&
      near(dry[0].tC, tK - 273.15, 1e-12) &&
      dry.every((r) => near(r.hM, zClosed(r.p), 1e-6)) &&
      dry.every((r) => r.rh === null && r.q === 0) &&
      dry[dry.length - 1].p === 100 &&
      wet.length === 10 &&
      wet[0].rh === 50 &&
      wet[0].q > 0 &&
      wet.filter((r) => r.rh === null).length === 2 &&
      fz !== null &&
      // rows: the surface, 900, 800, 700 (+1 C), 600 (-5 C) ...
      wet[3].p === 700 &&
      fz > wet[3].hM &&
      fz < wet[4].hM &&
      near(fz, wet[3].hM + ((wet[4].hM - wet[3].hM) * 1) / 6, 1e-9) &&
      near(a700.tC, 1, 1e-12) &&
      near(a700.hM, wet[3].hM, 1e-9) &&
      pw > 10 &&
      pw < 60 &&
      cen.n === 9 &&
      cen.good === 2 &&
      cen.degraded === 1 &&
      cen.cloud === 3 &&
      cen.zenith === 1 &&
      cen.nwp === 1 &&
      cen.fill === 1 &&
      cen.retrieved === 2 &&
      nearest !== null &&
      nearest.q === 1 &&
      nearest.d2 === 1 &&
      noneUsable === null &&
      tooFew === null &&
      LAP_ATBD.requirement.verticalResolutionKm.join() === '3,5' &&
      LAP_ATBD.requirement.tAccuracyK === 1 &&
      LAP_ATBD.requirement.rhAccuracyPct.to100 === 20 &&
      LAP_ATBD.requirement.tUsefulBelowHpa === 100 &&
      LAP_ATBD.requirement.rhUsefulBelowHpa === 300 &&
      LAP_ATBD.requirement.levels === 101,
    `good / degraded (${qDeg.words}) / cloud (${qCloud.words}) / a bad retrieval (${qBad.words}); Murphy-Koop water at 280 K round-trips through the dew point to ${tdBack.toFixed(9)} C; ` +
      `an isothermal 280-K dry column from 1000 hPa: ${dry.length} rows whose heights match (Rd T / g) ln(p0/p) to a micrometre (${dry[dry.length - 1].hM.toFixed(1)} m at 100 hPa); ` +
      `a moist column crossing 0 C between 700 and 600 hPa freezes at ${fz.toFixed(1)} m (${wet[3].hM.toFixed(0)}-${wet[4].hM.toFixed(0)} m, one sixth of the way), holds ${pw.toFixed(1)} mm, and drops its humidity above 300 hPa (${wet.filter((r) => r.rh === null).length} rows); ` +
      `a 3 x 3 census: ${cen.good} good, ${cen.degraded} degraded, ${cen.cloud} cloud, ${cen.zenith} zenith, ${cen.nwp} NWP, ${cen.fill} fill, ${cen.retrieved} retrieved; the nearest usable field to a cloudy centre is q ${nearest.q}; the ATBD: ${LAP_ATBD.requirement.verticalResolutionKm.join('-')} km resolution, 1 K, 18/20% humidity`
  );
}

{
  // THE COLUMN, READ: the vendored Ontario crop's centre column through
  // hdf5.js, the physical values and the hypsometric column held to
  // h5py's independent numbers
  const X = LAP_EXPECT;
  const t = openHdf5(new Uint8Array(Buffer.from(LVTPC_B64, 'base64')), inflate);
  const m = openHdf5(new Uint8Array(Buffer.from(LVMPC_B64, 'base64')), inflate);
  const pr = Array.from(t.dataset('pressure').values);
  const lvt = t.dataset('LVT', {
    window: [
      [X.centre.row, X.centre.row + 1],
      [X.centre.col, X.centre.col + 1],
      [0, X.levels]
    ]
  });
  const lvm = m.dataset('LVM', {
    window: [
      [X.centre.row, X.centre.row + 1],
      [X.centre.col, X.centre.col + 1],
      [0, X.levels]
    ]
  });
  const sc = (a) => (Array.isArray(a) ? a[0] : a);
  const tK = Array.from(lvt.values).map((v) =>
    v === 65535
      ? NaN
      : v * sc(lvt.attrs.scale_factor) + sc(lvt.attrs.add_offset)
  );
  const rh = Array.from(lvm.values).map((v) =>
    v === 65535 ? NaN : v * sc(lvm.attrs.scale_factor)
  );
  const rows = lapColumnRows(pr, tK, rh, {
    pSfcHpa: X.column.pSfcHpa,
    zSfcM: X.column.zSfcM
  });
  const top = rows[rows.length - 1];
  const at250 = lapLevelAt(rows, 250);
  const at700 = lapLevelAt(rows, 700);
  const h500 = lapLevelAt(rows, 500).hM;
  const ov = t.dataset('DQF_Overall');
  const cen = lapCensus(ov.values, t.dataset('DQF_Retrieval').values);
  check(
    'THE COLUMN, READ: the vendored profile crop through the reader and the law agrees with h5py to the millimetre of water',
    pr.length === X.levels &&
      near(pr[0], X.pressureFirst, 1e-6) &&
      near(pr[100], X.pressureLast, 1e-9) &&
      near(sc(lvt.attrs.scale_factor), X.tScale, 1e-15) &&
      near(sc(lvt.attrs.add_offset), X.tOffset, 1e-9) &&
      near(sc(lvm.attrs.scale_factor), X.rhScale, 1e-15) &&
      near(tK[3], X.tK.i3, 1e-9) &&
      near(tK[25], X.tK.i25, 1e-9) &&
      near(tK[52], X.tK.i52, 1e-9) &&
      near(rh[7], X.rh.i7, 1e-9) &&
      rows !== null &&
      rows.length === X.column.nRows &&
      near(rows[0].tC, X.column.tSfcC, 1e-9) &&
      near(rows[0].rh, X.column.rhSfcPct, 1e-9) &&
      near(top.p, X.column.topHpa, 1e-9) &&
      near(top.hM, X.column.topM, 1e-6) &&
      near(lapPwMm(rows), X.column.pwMm, 1e-9) &&
      near(lapFreezingLevelM(rows), X.column.freezingM, 1e-6) &&
      near(at250.tC, X.column.at250.tC, 1e-9) &&
      near(at250.hM, X.column.at250.hM, 1e-6) &&
      at250.rh === null &&
      near(at700.tC, X.column.at700.tC, 1e-9) &&
      near(at700.rh, X.column.at700.rh, 1e-9) &&
      near(h500, X.column.h500, 1e-6) &&
      cen.n === X.rows * X.cols &&
      cen.good === X.census['0'] &&
      cen.cloud === 0,
    `${X.fileT.slice(0, 24)} at ${X.centre.lat.toFixed(2)} N ${(-X.centre.lon).toFixed(2)} W: ${pr.length} levels ${pr[0]} to ${pr[100]} hPa, the centre column's 1013.9-hPa temperature ${tK[3].toFixed(3)} K, ` +
      `500-hPa ${tK[25].toFixed(3)} K, 134-hPa ${tK[52].toFixed(3)} K and 905-hPa humidity ${(100 * rh[7]).toFixed(2)}% as h5py read them; the column from a 1013.25-hPa sea level: ${rows.length} rows to ${top.p.toFixed(1)} hPa at ${top.hM.toFixed(1)} m, ` +
      `${lapPwMm(rows).toFixed(3)} mm of water, freezing at ${lapFreezingLevelM(rows).toFixed(1)} m, 250 hPa ${at250.tC.toFixed(2)} C at ${at250.hM.toFixed(1)} m (no humidity above 300 hPa), 700 hPa ${at700.tC.toFixed(2)} C at ${at700.rh.toFixed(1)}% - every number h5py's; ${cen.good} of ${cen.n} fields good`
  );

  // ---- THE TOWER'S CEILING FROM ORBIT (172nd pass) -------------------
  // The ATBD's words at their thresholds; TT and KI in closed form on
  // a column whose 850, 700 and 500 hPa rows are exact; the mean
  // lowest-100-hPa parcel of a linear column is its midpoint; the
  // parcel adapter; a stable column builds no tower, a hot moist
  // surface through the same column does; then the SAME Ontario
  // column against NOAA's own DSIC indices at the same field.
  {
    const V = dsiVerdict({li: -2, cape: 1500, tt: 50, si: -4, ki: 31});
    const V2 = dsiVerdict({li: 3, cape: 3500, tt: 57, si: 1, ki: 20});
    const V3 = dsiVerdict(
      {li: NaN, cape: 0, tt: 38, si: null, ki: 25},
      {west: true}
    );
    const V4 = dsiVerdict({tt: 57, cape: 200}, {west: true});
    // a column with exact rows at the discrete levels: T 20/10/0/-15 C
    // at 1000/850/700/500, Td 15/5/-10 (none at 500 needed)
    const syn = [
      {p: 1000, hM: 0, tC: 20, rh: 70, tdC: 15, q: 0.01},
      {p: 850, hM: 1450, tC: 10, rh: 70, tdC: 5, q: 0.006},
      {p: 700, hM: 3000, tC: 0, rh: 50, tdC: -10, q: 0.002},
      {p: 500, hM: 5600, tC: -15, rh: 40, tdC: -25, q: 0.001},
      {p: 300, hM: 9200, tC: -45, rh: null, tdC: null, q: 0},
      {p: 200, hM: 11800, tC: -55, rh: null, tdC: null, q: 0},
      {p: 100, hM: 16200, tC: -60, rh: null, tdC: null, q: 0}
    ];
    const ix = lapIndicesFromRows(syn);
    const ttClosed = 10 - -15 + (5 - -15); // 45
    const kiClosed = 10 - -15 + 5 - (0 - -10); // 20
    // a column linear in p from 1000 to 900 hPa (T 20 -> 10, Td 10 ->
    // 0): the 100-hPa mean is the midpoint's 15 / 5 at 950 hPa
    const lin = [];
    for (let p = 1000; p >= 500; p -= 25)
      lin.push({
        p,
        hM: (1000 - p) * 9,
        tC: 20 - (1000 - p) / 10,
        rh: 50,
        tdC: 10 - (1000 - p) / 10,
        q: 0.005
      });
    const mean = lapMeanLayerStart(lin);
    const pr = lapParcelRows(syn, {p: 950, hM: 450, tC: 18, tdC: 12});
    const stable = lapStability(syn, {sfcTC: 12, sfcTdC: 0});
    const hot = lapStability(syn, {sfcTC: 32, sfcTdC: 24});
    const own = lapStability(syn);
    const tooFew = lapStability(syn.slice(0, 4));
    // the real column (the rows of THE COLUMN, READ above) against
    // NOAA's own indices at the same field of regard and scan
    const noaa = {};
    for (const id of DSI_NAMES)
      noaa[id] = DSI_EXPECT.here[id.toUpperCase()].value;
    const st = lapStability(rows);
    const mine = {
      li: st.li,
      cape: st.capeMeanLayer,
      tt: st.tt,
      si: st.si,
      ki: st.ki
    };
    const agree = dsiAgreement(noaa, mine);
    const d = openHdf5(
      new Uint8Array(Buffer.from(DSIC_B64, 'base64')),
      inflate
    );
    const qcen =
      DSI_EXPECT.centre.row * DSI_EXPECT.cols + DSI_EXPECT.centre.col;
    const read = {};
    for (const id of DSI_NAMES) {
      const ds = d.dataset(id.toUpperCase());
      const v = ds.values[qcen];
      read[id] =
        v === 65535
          ? NaN
          : v * sc(ds.attrs.scale_factor) + sc(ds.attrs.add_offset);
    }
    const A = DSI_ATBD.requirement.accuracy;
    check(
      "THE TOWER'S CEILING FROM ORBIT: the ATBD's words, TT and KI in closed form, the mean-layer parcel, the tower, and the Ontario column's five indices against NOAA's own at the same field",
      V.li.startsWith('unstable') &&
        V.cape === 'moderate potential energy' &&
        V.tt === 'thunderstorms possible' &&
        V.si.startsWith('severe weather possible') &&
        V.ki.startsWith('severe weather very likely') &&
        V2.li === 'stable' &&
        V2.cape.startsWith('very large') &&
        V2.tt.startsWith('considerable severe weather (over 55') &&
        V2.si === 'no severe signal' &&
        V2.ki === 'not conducive to severe weather' &&
        V3.li === null &&
        V3.cape === 'none' &&
        V3.tt === 'little or no thunderstorm activity' &&
        V3.si === null &&
        V4.tt === 'thunderstorms possible' &&
        V4.cape === 'little potential energy' &&
        ix !== null &&
        near(ix.tt, ttClosed, 1e-12) &&
        near(ix.ki, kiClosed, 1e-12) &&
        near(ix.t850C, 10, 1e-12) &&
        near(ix.td700C, -10, 1e-12) &&
        mean !== null &&
        near(mean.p, 950, 1e-12) &&
        near(mean.tC, 15, 1e-9) &&
        near(mean.tdC, 5, 1e-9) &&
        mean.depthHpa === 100 &&
        pr.length === 7 &&
        pr[0].p === 950 &&
        pr[0].dwC === 12 &&
        pr[1].p === 850 &&
        pr[1].dwC === 5 &&
        pr.every((r, i) => i === 0 || r.p < 950) &&
        stable !== null &&
        stable.tower.capeJkg === 0 &&
        stable.tower.elM === null &&
        stable.tower.liK > 0 &&
        stable.tower.source.startsWith("the station's") &&
        near(stable.tt, ttClosed, 1e-12) &&
        hot.tower.capeJkg > 1000 &&
        hot.tower.elM > 9000 &&
        hot.tower.lfcM !== null &&
        hot.tower.lfcM < hot.tower.elM &&
        hot.tower.liK < -5 &&
        hot.tower.start.tC === 32 &&
        own.tower.source.startsWith("the column's own surface row") &&
        own.tower.start.tC === 20 &&
        tooFew === null &&
        // the real field: TT and KI re-derived from the profile match
        // NOAA's to a hundredth of a kelvin, LI to half a kelvin, the
        // mean-layer CAPE to a hundred J/kg, SI to two kelvin - all
        // inside Table 1.3's accuracies, and the file's counts unscale
        // to h5py's values
        DSI_NAMES.every((id) => near(read[id], noaa[id], 1e-9)) &&
        near(agree.tt.diff, 0, 0.01) &&
        near(agree.ki.diff, 0, 0.01) &&
        Math.abs(agree.li.diff) < 0.5 &&
        Math.abs(agree.cape.diff) < 100 &&
        Math.abs(agree.si.diff) < 2 &&
        DSI_NAMES.every((id) => agree[id].withinAccuracy) &&
        A.tt === 1 &&
        A.ki === 2 &&
        A.li === 2 &&
        A.cape === 1000 &&
        A.si === 2 &&
        DSI_ATBD.requirement.precision.cape === 2500 &&
        DSI_ATBD.parcel.layerHpa === 100 &&
        DSI_ATBD.parcel.liLevelHpa === 500 &&
        DSI_EXPECT.finalHpa === 500 &&
        st.tower.elM > 0 &&
        // the hand check (numpy) interpolates the humidity to the level
        // and takes the dew point there; the law takes each level's
        // dew point and interpolates it - a thousandth of a kelvin
        near(st.tt, DSI_EXPECT.fromColumn.TT, 0.01) &&
        near(st.ki, DSI_EXPECT.fromColumn.KI, 0.01),
      `LI -2 / CAPE 1500 / TT 50 / SI -4 / KI 31 read "${V.li.split(':')[0]}", "${V.cape}", "${V.tt}", "${V.si.split(' (')[0]}", "${V.ki.split(' (')[0]}"; TT 57 is severe east of the Rockies and only possible west; ` +
        `an exact column gives TT ${ix.tt} and KI ${ix.ki} (closed form ${ttClosed}, ${kiClosed}); the lowest 100 hPa of a linear column averages to its midpoint (${mean.tC.toFixed(6)} / ${mean.tdC.toFixed(6)} C at ${mean.p} hPa); ` +
        `a 12 / 0 C screen through that column builds no tower (CAPE 0, LI +${stable.tower.liK.toFixed(1)} K), a 32 / 24 C screen ${hot.tower.capeJkg} J/kg to an EL of ${hot.tower.elM} m (LFC ${hot.tower.lfcM} m, LI ${hot.tower.liK.toFixed(1)} K); ` +
        `THE REAL FIELD (${DSI_EXPECT.file.slice(0, 23)}, the profile crops' own scan and field): the file's counts unscale to LI ${read.li.toFixed(3)} K, CAPE ${read.cape.toFixed(1)} J/kg, TT ${read.tt.toFixed(3)}, SI ${read.si.toFixed(3)}, KI ${read.ki.toFixed(3)} (h5py's); ` +
        `the column re-derives TT ${st.tt.toFixed(3)} (${agree.tt.diff >= 0 ? '+' : ''}${agree.tt.diff.toFixed(3)}), KI ${st.ki.toFixed(3)} (${agree.ki.diff >= 0 ? '+' : ''}${agree.ki.diff.toFixed(3)}), LI ${st.li.toFixed(2)} (${agree.li.diff >= 0 ? '+' : ''}${agree.li.diff.toFixed(2)} K), ` +
        `mean-layer CAPE ${st.capeMeanLayer} (${agree.cape.diff >= 0 ? '+' : ''}${agree.cape.diff.toFixed(0)}), SI ${st.si.toFixed(2)} (${agree.si.diff >= 0 ? '+' : ''}${agree.si.diff.toFixed(2)} K; the ATBD's own SI still uses the 1000-hPa polynomial, "needs to be improved") - every index inside Table 1.3's accuracy (TT 1, KI 2, LI 2, CAPE 1000, SI 2); ` +
        `the column's own smeared surface (${st.tower.start.tC.toFixed(1)} / ${st.tower.start.tdC.toFixed(1)} C) lifts to an EL of ${st.tower.elM} m on ${st.tower.capeJkg} J/kg`
    );
  }
}

// ---- THE TOPS FROM ORBIT (173rd pass) ------------------------------
// The ATBD's numbers; the ISCCP bands on a synthetic window (a
// marginal pixel and a fill skipped); then the vendored ACHAC file's
// home window (21 x 21 fields around column 424, row 127 - the server
// gate's own) censused by layer against a plain count written here,
// the file's counts unscaled as h5py sampled them.
{
  const synth = [500, 1200, 2500, 3300, 4000, 6600, 9000, 11000, NaN, 7000];
  const dq = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
  const b = heightBands(synth, dq);
  const f = openHdf5(new Uint8Array(Buffer.from(ACHAC_B64, 'base64')), inflate);
  const ht = f.dataset('HT');
  const dqf = f.dataset('DQF');
  const sc = (a) => (Array.isArray(a) ? a[0] : a);
  const scale = sc(ht.attrs.scale_factor);
  const cols = 500;
  const ci = 424;
  const cj = 127;
  const half = 10;
  const win = [];
  const winQ = [];
  for (let j = cj - half; j <= cj + half; j++)
    for (let i = ci - half; i <= ci + half; i++) {
      const q = j * cols + i;
      const v = ht.values[q];
      win.push(v === 65535 ? NaN : v * scale);
      winQ.push(dqf.values[q]);
    }
  const bands = heightBands(win, winQ);
  const good = win
    .filter((v, k) => winQ[k] === 0 && Number.isFinite(v))
    .sort((x, y) => x - y);
  const nLow = good.filter((v) => v < 3240).length;
  const nMid = good.filter((v) => v >= 3240 && v < 6508).length;
  const nHigh = good.filter((v) => v >= 6508).length;
  const p90 = good.length
    ? good[Math.min(good.length - 1, Math.floor(0.9 * good.length))]
    : null;
  const sample = ACHAC_EXPECT.datasets.HT.samples.find(
    (x) => x[0] === 200 && x[1] === 100
  );
  const vs = ht.values[200 * cols + 100];
  const R = ACHA_ATBD.requirement;
  check(
    "THE TOPS FROM ORBIT: the ATBD's accuracy and precision, the ISCCP bands on a synthetic window, and the vendored file's home window censused by layer against a plain count",
    R.accuracyM === 500 &&
      R.precisionM === 1500 &&
      R.emissivityFloor === 0.8 &&
      R.horizontalKm === 10 &&
      R.blockPx === 5 &&
      R.lzaQuantitativeDeg === 62 &&
      ACHA_ATBD.layers.highHpa === 440 &&
      ACHA_ATBD.layers.lowHpa === 680 &&
      ACHA_ATBD.errorBudget.sdKm === 0.94 &&
      ACHA_ATBD.inversion.lapseKPerKm === 9.8 &&
      b.n === 8 &&
      b.nLow === 3 &&
      b.nMid === 1 &&
      b.nHigh === 4 &&
      b.lowM === 1200 &&
      b.midM === 3300 &&
      b.highM === 9000 &&
      b.p90M === 11000 &&
      b.maxM === 11000 &&
      b.lowTopM === 3240 &&
      b.midTopM === 6508 &&
      heightBands([], null).n === 0 &&
      heightBands([], null).highM === null &&
      win.length === 441 &&
      bands.n === good.length &&
      bands.n > 0 &&
      bands.nLow === nLow &&
      bands.nMid === nMid &&
      bands.nHigh === nHigh &&
      bands.p90M === p90 &&
      bands.maxM === good[good.length - 1] &&
      (bands.lowM === null || (bands.lowM < 3240 && bands.lowM >= good[0])) &&
      (bands.highM === null || bands.highM >= 6508) &&
      sample !== undefined &&
      vs === sample[2] &&
      near(vs * scale, sample[2] * 0.30520370602607727, 1e-6),
    `Table 1: ${R.accuracyM} m accuracy, ${R.precisionM} m precision for emissivity > ${R.emissivityFloor}, ${R.horizontalKm} km from ${R.blockPx} x ${R.blockPx} blocks, quantitative to ${R.lzaQuantitativeDeg} deg; Table 6: sd ${ACHA_ATBD.errorBudget.sdKm} km against CALIPSO; ` +
      `a synthetic window of ten (one marginal, one fill) bands ${b.nLow} / ${b.nMid} / ${b.nHigh} with medians ${b.lowM} / ${b.midM} / ${b.highM} m, its tallest tenth ${b.p90M} m; ` +
      `the vendored ${ACHAC_EXPECT.file.slice(0, 24)} home window (21 x 21 fields at 424, 127): ${bands.n} good tops of ${win.length} - ${bands.nLow} low (median ${bands.lowM === null ? 'none' : bands.lowM.toFixed(0) + ' m'}), ${bands.nMid} mid (${bands.midM === null ? 'none' : bands.midM.toFixed(0) + ' m'}), ${bands.nHigh} high (${bands.highM === null ? 'none' : bands.highM.toFixed(0) + ' m'}), ` +
      `the tallest tenth ${bands.p90M.toFixed(0)} m and the tallest ${bands.maxM.toFixed(0)} m - the plain count agrees to the pixel; h5py's count ${sample[2]} at (200, 100) unscales to ${(vs * scale).toFixed(1)} m`
  );
}

// ---- THE HAZE'S KIND (169th pass) ----------------------------------
// The DQF word's two-bit confidences as the file lays them, the
// flags' fill through the byte view, a synthetic window censused by
// kind and confidence with the night, glint, land and water bits, the
// ATBD's 25-km matchup rule (the coverage bar, the majority, both,
// none, no call), the measured kind over the model's split, and the
// ATBD's validation tables recomputed from their confusion counts.
{
  // a word with smoke high (0), dust low (2), ash bad (3), NUC medium (1)
  const word = (3 << 0) | (0 << 2) | (2 << 4) | (1 << 6);
  const fb = adpFlagBytes(Int8Array.from([-128, 0, 1, 1]));
  const fb2 = adpFlagBytes(Uint8Array.from([128, 255, 1, 0]));
  // a 21 x 21 window: dust present with medium confidence on the
  // west half's rows 3..17, smoke present (high) on a 3 x 3 patch at
  // the east, one disowned smoke flag (bad confidence), night on the
  // last row, glint on the last column, land on the north half
  const W = 21;
  const sm = new Uint8Array(W * W);
  const du = new Uint8Array(W * W);
  const dq = new Uint16Array(W * W);
  const p2 = new Uint16Array(W * W);
  for (let j = 0; j < W; j++)
    for (let i = 0; i < W; i++) {
      const q = j * W + i;
      // both tests ran with high confidence by default
      dq[q] = (3 << 0) | (0 << 2) | (0 << 4) | (3 << 6);
      if (i < 10 && j >= 3 && j <= 17) {
        du[q] = 1;
        dq[q] = (3 << 0) | (0 << 2) | (1 << 4) | (3 << 6); // dust medium
      }
      if (i >= 16 && i <= 18 && j >= 8 && j <= 10) sm[q] = 1;
      if (j === W - 1) p2[q] |= ADP_PQI2.night;
      if (i === W - 1) p2[q] |= ADP_PQI2.withinGlint;
      if (j < 10) p2[q] |= ADP_PQI2.land;
    }
  sm[5 * W + 15] = 1;
  dq[5 * W + 15] = (3 << 0) | (3 << 2) | (0 << 4) | (3 << 6); // a smoke flag the word disowns
  sm[0] = ADP_FLAG_FILL;
  du[0] = ADP_FLAG_FILL;
  const c = adpCensus(sm, du, dq, p2);
  // the matchup circles: at (5, 10) the dust half - every valid pixel
  // within 4 px carries dust; at (17, 9) the smoke patch is 9 of the
  // circle's valid pixels; a circle in the fill-less clear east has
  // no call of either; a circle of radius 4 at (19, 19) touches the
  // glint column and the night row
  const circ = (ci, cj, r = 4) =>
    adpDominant(sm, du, dq, p2, {cols: W, rows: W, ci, cj, radiusPx: r});
  const dustC = circ(5, 10);
  const smokeC = circ(17, 9);
  const noneC = circ(14, 14, 1);
  // a circle whose valid coverage falls short: every word bad but one
  const dqBad = new Uint16Array(W * W).fill(0xffff);
  dqBad[10 * W + 10] = 0;
  const shortC = adpDominant(sm, du, dqBad, p2, {
    cols: W,
    rows: W,
    ci: 10,
    cj: 10,
    radiusPx: 4
  });
  // both: a window where every valid pixel carries both flags
  const both = adpDominant(
    new Uint8Array(9).fill(1),
    new Uint8Array(9).fill(1),
    new Uint16Array(9).fill(0),
    null,
    {cols: 3, rows: 3, ci: 1, cj: 1, radiusPx: 1}
  );
  const model = {
    dust: 0.1,
    seaSalt: 0.3,
    sulfate: 0.4,
    organic: 0.15,
    blackCarbon: 0.05
  };
  const rwD = adpReweight(model, 'dust');
  const rwS = adpReweight(model, 'smoke');
  const rwN = adpReweight(model, 'none');
  const rwAlready = adpReweight({dust: 0.7, seaSalt: 0.3}, 'dust');
  const rwNoFine = adpReweight({dust: 0.5, seaSalt: 0.5}, 'smoke');
  const sumD = Object.values(rwD.fractions).reduce((a, v) => a + v, 0);
  const sumS = Object.values(rwS.fractions).reduce((a, v) => a + v, 0);
  const v = ADP_ATBD.validation;
  const sc = adpScores(v.dust.aeronet);
  const sc2 = adpScores(v.smoke.calipso);
  check(
    "THE HAZE'S KIND: the confidence word, the flags' fill, the census, the ATBD's 25-km rule, the measured kind over the model's split, the validation recomputed",
    adpConfidence(word, 'smoke') === 'high' &&
      adpConfidence(word, 'dust') === 'low' &&
      adpConfidence(word, 'ash') === null &&
      adpConfidence(word, 'nuc') === 'medium' &&
      adpConfidence(65535, 'dust') === null &&
      fb.join() === '255,0,1,1' &&
      fb2.join() === '255,255,1,0' &&
      adpPixel(1, word, 'dust').present === true &&
      adpPixel(1, word, 'dust').confidence === 'low' &&
      adpPixel(ADP_FLAG_FILL, word, 'dust').present === null &&
      c.n === W * W &&
      c.fill === 1 &&
      c.night === W &&
      c.glint === W &&
      c.land === 10 * W - 1 &&
      c.water === 11 * W &&
      c.land + c.water + c.fill === W * W &&
      c.dust.present === 10 * 15 &&
      c.dust.medium === 150 &&
      c.dust.high === 0 &&
      c.dust.retrieved === W * W - 1 &&
      c.smoke.present === 10 &&
      c.smoke.high === 9 &&
      c.smoke.disowned === 1 &&
      c.smoke.retrieved === W * W - 2 &&
      dustC.dominant === 'dust' &&
      dustC.inCircle === 49 &&
      dustC.valid === 49 &&
      dustC.dust.present === 49 &&
      dustC.dust.medium === 49 &&
      smokeC.dominant === 'none' &&
      smokeC.smoke.present === 9 &&
      // 49 lattice points within 4 px, one column past the grid's
      // east edge (48 in the window), five in the glint column
      smokeC.inCircle === 48 &&
      smokeC.valid === 43 &&
      near(smokeC.smokeFrac, 9 / 43, 1e-12) &&
      noneC.dominant === 'none' &&
      noneC.inCircle === 5 &&
      shortC.dominant === null &&
      shortC.valid === 1 &&
      shortC.enough === false &&
      near(shortC.coverage, 1 / 49, 1e-12) &&
      both.dominant === 'both' &&
      both.valid === 5 &&
      rwD.changed === true &&
      near(rwD.fractions.dust, ADP_CALLED_FLOOR, 1e-12) &&
      near(sumD, 1, 1e-12) &&
      near(rwD.fractions.seaSalt / rwD.fractions.sulfate, 0.75, 1e-12) &&
      near(rwD.from, 0.1, 1e-12) &&
      rwS.changed === true &&
      near(
        rwS.fractions.organic + rwS.fractions.blackCarbon,
        ADP_CALLED_FLOOR,
        1e-12
      ) &&
      near(rwS.fractions.organic / rwS.fractions.blackCarbon, 3, 1e-12) &&
      near(sumS, 1, 1e-12) &&
      rwN.changed === false &&
      rwAlready.changed === false &&
      near(rwAlready.from, 0.7, 1e-12) &&
      rwNoFine.changed === true &&
      near(rwNoFine.fractions.organic, ADP_CALLED_FLOOR, 1e-12) &&
      rwNoFine.fractions.blackCarbon === 0 &&
      near(rwNoFine.fractions.dust, 0.2, 1e-12) &&
      ADP_RADIUS_PX === 13 &&
      ADP_ATBD.matchup.radiusKm === 25 &&
      ADP_ATBD.matchup.coverageMin === 0.8 &&
      ADP_ATBD.requirement.dust === 0.8 &&
      ADP_ATBD.requirement.smokeWater === 0.7 &&
      ADP_ATBD.requirement.aodThreshold === 0.2 &&
      ADP_ATBD.requirement.glintDeg === 40 &&
      ADP_ATBD.requirement.szaDayDeg === 87 &&
      ADP_ATBD.dust.thinBtdK === 0.4 &&
      ADP_ATBD.smoke.fireBt39K === 350 &&
      // the ATBD's printed percentages reproduce from its own counts
      // only to within half a percent (dust against AERONET: 98.4%
      // accuracy and 88.1% caught from the counts, 98.5 and 88.4
      // printed) - the tables' arithmetic, stated
      near(sc.accuracy, v.dust.aeronet.accuracy, 5e-3) &&
      near(sc.pocd, v.dust.aeronet.pocd, 5e-3) &&
      near(sc.pofd, v.dust.aeronet.pofd, 5e-3) &&
      near(sc2.accuracy, v.smoke.calipso.accuracy, 5e-3) &&
      near(sc2.pocd, v.smoke.calipso.pocd, 5e-3) &&
      near(sc2.pofd, v.smoke.calipso.pofd, 5e-3) &&
      sc.pocd > ADP_ATBD.requirement.dust &&
      sc2.pocd > ADP_ATBD.requirement.smokeLand,
    `word ${word}: smoke ${adpConfidence(word, 'smoke')}, dust ${adpConfidence(word, 'dust')}, ash ${adpConfidence(word, 'ash')}, none/unknown/clear ${adpConfidence(word, 'nuc')}; ` +
      `the int8 fill -128 and the byte view's 128 both read ${ADP_FLAG_FILL}; a ${W} x ${W} window: ${c.dust.present} dust px (${c.dust.medium} medium) of ${c.dust.retrieved} retrieved, ` +
      `${c.smoke.present} smoke px (${c.smoke.high} high, ${c.smoke.disowned} disowned by the word), ${c.night} night, ${c.glint} in glint, ${c.land} land and ${c.water} water, ${c.fill} fill; ` +
      `the 25-km rule: a circle in the dust calls dust (${dustC.dust.present} of ${dustC.valid} valid), the smoke patch is ${smokeC.smoke.present} of ${smokeC.valid} - ${smokeC.dominant}, ` +
      `a circle with ${shortC.valid} valid of ${shortC.inCircle} (${(100 * shortC.coverage).toFixed(0)}% coverage) makes no call, every pixel both makes '${both.dominant}'; ` +
      `the model's split (dust 10%) under a dust call goes to ${(100 * rwD.fractions.dust).toFixed(0)}% dust with the rest scaled (sea salt ${(100 * rwD.fractions.seaSalt).toFixed(1)}%, sulphate ${(100 * rwD.fractions.sulfate).toFixed(1)}%), ` +
      `under a smoke call organic + black carbon to ${(100 * (rwS.fractions.organic + rwS.fractions.blackCarbon)).toFixed(0)}% at their 3:1, a split already past the floor untouched, a model without fine absorbers puts it all in organic; ` +
      `the ATBD's Tables 15-16 recomputed from their counts: dust against AERONET ${(100 * sc.accuracy).toFixed(1)}% accuracy, ${(100 * sc.pocd).toFixed(1)}% caught, ${(100 * sc.pofd).toFixed(1)}% false (printed ${(100 * v.dust.aeronet.accuracy).toFixed(1)} / ${(100 * v.dust.aeronet.pocd).toFixed(1)} / ${(100 * v.dust.aeronet.pofd).toFixed(1)}: the tables' own arithmetic is off by up to 0.3%); smoke against CALIPSO ${(100 * sc2.accuracy).toFixed(1)} / ${(100 * sc2.pocd).toFixed(1)} / ${(100 * sc2.pofd).toFixed(1)} - both past the 80% requirement`
  );
}

// ---- THE COLUMN'S WATER (163rd pass) -----------------------------
// The file's eleven overall flags as qualities, the census on a
// synthetic window (good, degraded, invalid, fill - every pixel
// counted once, the good and degraded statistics apart), the ATBD's
// requirement and validation numbers.
{
  const mm = new Float32Array(30);
  const dqf = new Uint8Array(30);
  for (let q = 0; q < 30; q++) {
    mm[q] = 10 + q;
    dqf[q] =
      q % 10 === 9
        ? 4
        : q % 7 === 6
          ? 3
          : q % 5 === 4
            ? 2
            : q % 11 === 10
              ? 1
              : 0;
  }
  mm[3] = NaN;
  dqf[8] = 255;
  const c = tpwCensus(mm, dqf);
  check(
    'THE COLUMN’S WATER: the overall flag’s qualities, the census by quality, the ATBD’s numbers',
    L2_PRODUCTS.tpw === 'ABI-L2-TPWC' &&
      TPW_DQF_MEANINGS.length === 11 &&
      TPW_DQF_MEANINGS[0] === 'good_quality_qf' &&
      TPW_DQF_MEANINGS[3].startsWith('degraded_due_to_quantitative_LZA') &&
      tpwQuality(0) === 'good' &&
      tpwQuality(2) === 'degraded' &&
      tpwQuality(3) === 'degraded' &&
      tpwQuality(1) === 'invalid' &&
      tpwQuality(10) === 'invalid' &&
      tpwQuality(255) === null &&
      c.n === 30 &&
      c.good + c.degraded + c.invalid + c.fill === 30 &&
      c.fill === 2 &&
      c.goodStats.n === c.good &&
      c.degradedStats.n === c.degraded &&
      c.goodStats.minMm === 10 &&
      c.goodStats.maxMm <= 39 &&
      c.goodStats.medianMm > c.goodStats.minMm &&
      c.goodStats.medianMm < c.goodStats.maxMm &&
      TPW_ATBD.resolutionKm === 10 &&
      TPW_ATBD.fieldOfRegardPx === 5 &&
      TPW_ATBD.clearFractionMin === 0.2 &&
      TPW_ATBD.requirement.moistureAccuracyPct.sfcTo300hPa === 18 &&
      TPW_ATBD.requirement.lzaQuantitativeDeg === 67 &&
      TPW_ATBD.file.lzaQuantitativeDeg === 70 &&
      TPW_ATBD.validation.raobLandErrorPct === 11.5 &&
      TPW_ATBD.validation.amsreR === 0.96 &&
      TPW_ATBD.validation.amsreN === 2822939 &&
      TPW_ATBD.validation.forecastGainMm.ocean === 0.7 &&
      TPW_ATBD.scaleBounds[0] === 0.25 &&
      TPW_ATBD.scaleBounds[1] === 4,
    `${TPW_DQF_MEANINGS.length} overall flags: 0 good, 2 and 3 degraded (latitude, quantitative zenith), the rest invalid, 255 the fill; ` +
      `a 30-px window censuses ${c.good} good (${c.goodStats.minMm}-${c.goodStats.maxMm} mm, median ${c.goodStats.medianMm}), ${c.degraded} degraded ` +
      `(median ${c.degradedStats.medianMm} mm), ${c.invalid} invalid, ${c.fill} fill - every pixel once; the ATBD: a 5x5 field of regard at least a fifth clear, ` +
      `18% moisture accuracy to 300 hPa, quantitative to ${TPW_ATBD.requirement.lzaQuantitativeDeg} deg (the file says ${TPW_ATBD.file.lzaQuantitativeDeg}), ` +
      `${TPW_ATBD.validation.raobLandErrorPct}% against radiosondes over land, r ${TPW_ATBD.validation.amsreR} against AMSR-E on ` +
      `${TPW_ATBD.validation.amsreN.toLocaleString('en-US')} ocean matchups, the forecast improved by ${TPW_ATBD.validation.forecastGainMm.ocean} mm over the ocean`
  );
}

// ---- THE RAIN (164th pass) -----------------------------------------
// Table 6's flag bits as qualities and words, the ATBD's evaporation
// adjustment (Eq. 35-36) by hand, the census and the navigated list
// on a synthetic window laid on GOES-West's real fixed grid: a
// downpour, drizzle, a dry good pixel, a pixel past the zenith
// block-out that still rains, an invalid one, the fill; the ATBD's
// requirement and validation numbers.
{
  const g = fixedGridGeometry({
    semi_major_axis: 6378137,
    semi_minor_axis: 6356752.31414,
    perspective_point_height: 35786023,
    longitude_of_projection_origin: -137
  });
  const home = latLonToFixedGrid(32.85, -117.12, g);
  const x = {scale: 56e-6, offset: home.x - 750 * 56e-6, n: 1500};
  const y = {scale: -56e-6, offset: home.y + 750 * 56e-6, n: 1500};
  const box = {i: 750, j: 750, i0: 748, j0: 748, cols: 5, rows: 5};
  const n = 25;
  const mmh = new Float32Array(n).fill(0);
  const dqf = new Uint8Array(n).fill(0);
  const at = (i, j) => j * 5 + i;
  mmh[at(4, 4)] = 25.4; // a downpour, two pixels off diagonally
  mmh[at(3, 2)] = 0.6; // drizzle next door (the nearest raining)
  mmh[at(0, 0)] = 3.2;
  dqf[at(0, 0)] = RAIN_DQF_BITS.blockOut; // rains, past the block-out: degraded
  mmh[at(0, 4)] = 9;
  dqf[at(0, 4)] = RAIN_DQF_BITS.bad; // invalid whatever the value
  mmh[at(4, 0)] = NaN;
  dqf[at(4, 0)] = 255; // the fill
  mmh[at(1, 3)] = 0.05; // under the 0.1 mm/h listing floor, still raining
  const c = rainCensus(mmh, dqf);
  const list = rainList(mmh, dqf, box, g, x, y, {minMmH: 0.1, cap: 10});
  const nr = nearestRain(mmh, dqf, box, {minMmH: 0.1});
  const homeLL = fixedGridToLatLon(
    x.offset + 750 * x.scale,
    y.offset + 750 * y.scale,
    g
  );
  const heavyLL = fixedGridToLatLon(
    x.offset + 752 * x.scale,
    y.offset + 752 * y.scale,
    g
  );
  // Eq. 35-36 by hand at 10 mm/h: RH 100 -> (10 + 11.5825 - 10.7354) x (1.12891 - 0.504012 + 0.476117)
  const e100 =
    (10 + 0.115825 * 100 - 10.7354) *
    (0.000112891 * 1e4 - 0.00504012 * 100 + 0.476117);
  const e61 =
    (10 + 0.115825 * 61 - 10.7354) *
    (0.000112891 * 61 * 61 - 0.00504012 * 61 + 0.476117);
  const e30 =
    (10 + 0.115825 * 61 - 10.7354) *
    (0.000112891 * 30 * 30 - 0.00504012 * 30 + 0.476117);
  check(
    'THE RAIN: the flag bits as qualities, the evaporation law, the census and the navigated list',
    L2_PRODUCTS.rain === 'ABI-L2-RRQPEF' &&
      rainQuality(0) === 'good' &&
      rainQuality(2) === 'degraded' &&
      rainQuality(1) === 'invalid' &&
      rainQuality(6) === 'invalid' &&
      rainQuality(64) === 'invalid' &&
      rainQuality(255) === null &&
      rainFlagWords(66).join(' + ') ===
        'past 70° zenith or 60° latitude + no retrieval coefficients' &&
      rainFlagWords(0)[0] === 'good' &&
      c.n === 25 &&
      c.good + c.degraded + c.invalid + c.fill === 25 &&
      c.good === 22 &&
      c.degraded === 1 &&
      c.invalid === 1 &&
      c.fill === 1 &&
      c.raining === 4 &&
      c.rainingGE1 === 2 &&
      near(c.maxMmH, 25.4, 1e-5) &&
      near(c.sumMmH, 25.4 + 0.6 + 3.2 + 0.05, 1e-5) &&
      list.length === 3 &&
      near(list[0].mmh, 25.4, 1e-5) &&
      list[0].i === 752 &&
      list[0].j === 752 &&
      near(list[0].latDeg, heavyLL.latDeg, 1e-9) &&
      near(list[0].lonDeg, heavyLL.lonDeg, 1e-9) &&
      list[1].quality === 'degraded' &&
      near(list[1].mmh, 3.2, 1e-5) &&
      near(list[2].mmh, 0.6, 1e-5) &&
      near(homeLL.latDeg, 32.85, 1e-6) &&
      nr !== null &&
      nr.di === 1 &&
      nr.dj === 0 &&
      near(nr.mmh, 0.6, 1e-5) &&
      near(rainEvaporationAdjust(10, 100), e100, 1e-9) &&
      near(rainEvaporationAdjust(10, 61), e61, 1e-9) &&
      near(rainEvaporationAdjust(10, 30), e30, 1e-9) &&
      e30 < e61 &&
      e100 > 10 &&
      e61 < 5 &&
      RAIN_ATBD.resolutionKm === 2 &&
      RAIN_ATBD.refreshMin === 10 &&
      RAIN_ATBD.requirement.accuracyMmHAt10 === 6 &&
      RAIN_ATBD.requirement.precisionMmHAt10 === 9 &&
      RAIN_ATBD.requirement.lzaQuantitativeDeg === 70 &&
      RAIN_ATBD.method.classes === 330 &&
      RAIN_ATBD.method.trainingRainPx === 10000 &&
      RAIN_ATBD.validation.mrms.r.g16 === 0.32 &&
      RAIN_ATBD.validation.mrms.precisionMmH.g16 === 7.81 &&
      RAIN_ATBD.validation.mrms.precisionMmH.g17 === 9.39 &&
      RAIN_ATBD.validation.mrms.n.g16 === 11201180 &&
      RAIN_ATBD.validation.dpr.accuracyMmH.g16 === 5.21,
    `flag 0 good, 2 (past 70° zenith / 60° latitude) degraded, any other bit invalid, 255 the fill (66 reads "${rainFlagWords(66).join(' + ')}"); ` +
      `a 5x5 window on the fixed grid censuses ${c.good} good, ${c.degraded} degraded, ${c.invalid} invalid, ${c.fill} fill - every pixel once - with ${c.raining} raining ` +
      `(${c.rainingGE1} at or above the file's 1 mm/h), the heaviest ${c.maxMmH.toFixed(1)} mm/h, ${c.sumMmH.toFixed(2)} mm/h summed; the list navigates ${list.length} pixels at or above 0.1 mm/h, ` +
      `the downpour first at ${list[0].latDeg.toFixed(4)}, ${list[0].lonDeg.toFixed(4)} (the fixed grid's own equations; the window's centre ${homeLL.latDeg.toFixed(4)}, ${homeLL.lonDeg.toFixed(4)}), ` +
      `the degraded 3.2 mm/h kept and named, the invalid 9 mm/h dropped; the nearest raining pixel is the drizzle one pixel east (${nr.mmh.toFixed(1)} mm/h); ` +
      `Eq. 35-36 by hand: 10 mm/h under a saturated lowest third becomes ${e100.toFixed(2)} mm/h, under 61% (the additive floor) ${e61.toFixed(2)}, under 30% ${e30.toFixed(2)} (the multiplicative term's own floor at 22.32%) - the product's own evaporation term, pinned not re-applied; ` +
      `the ATBD: ${RAIN_ATBD.resolutionKm} km every ${RAIN_ATBD.refreshMin} min, ${RAIN_ATBD.requirement.accuracyMmHAt10} / ${RAIN_ATBD.requirement.precisionMmHAt10} mm/h accuracy / precision at 10 mm/h, ` +
      `${RAIN_ATBD.method.classes} classes; validation r ${RAIN_ATBD.validation.mrms.r.g16} against MRMS over ${RAIN_ATBD.validation.mrms.n.g16.toLocaleString('en-US')} points ` +
      `(precision ${RAIN_ATBD.validation.mrms.precisionMmH.g16} mm/h on GOES-16, ${RAIN_ATBD.validation.mrms.precisionMmH.g17} on GOES-17 past the spec), DPR accuracy ${RAIN_ATBD.validation.dpr.accuracyMmH.g16}`
  );
}

// ---- THE FIRE'S HEAT (162nd pass) --------------------------------
// The ATBD's mask codes and QA flags as classes, the MIR radiative
// power law (Eq. 3.4) by hand, the census and the navigated list on
// a synthetic window laid on GOES-West's real fixed grid: a
// processed fire with power, a saturated one seen before, a
// cloud-contaminated one, a low-probability one, a fire-free land
// pixel, cloud and water, the fill.
{
  const g = fixedGridGeometry({
    semi_major_axis: 6378137,
    semi_minor_axis: 6356752.31414,
    perspective_point_height: 35786023,
    longitude_of_projection_origin: -137
  });
  const home = latLonToFixedGrid(32.85, -117.12, g);
  const x = {scale: 56e-6, offset: home.x - 750 * 56e-6, n: 1500};
  const y = {scale: -56e-6, offset: home.y + 750 * 56e-6, n: 1500};
  const box = {i: 750, j: 750, i0: 748, j0: 748, cols: 5, rows: 5};
  const n = 25;
  const mask = new Int16Array(n).fill(100);
  const power = new Float32Array(n).fill(NaN);
  const temp = new Float32Array(n).fill(NaN);
  const area = new Float32Array(n).fill(NaN);
  const dqf = new Uint8Array(n).fill(1);
  const at = (i, j) => j * 5 + i;
  mask[at(2, 2)] = 10;
  power[at(2, 2)] = 120.5;
  temp[at(2, 2)] = 850;
  area[at(2, 2)] = 60000;
  dqf[at(2, 2)] = 0;
  mask[at(3, 2)] = 31;
  dqf[at(3, 2)] = 0; // saturated, seen before: no power reported
  mask[at(1, 1)] = 12;
  dqf[at(1, 1)] = 0; // cloud-contaminated
  mask[at(4, 4)] = 15;
  power[at(4, 4)] = 3;
  dqf[at(4, 4)] = 0; // low probability (a power the file would not report; counted as reported here)
  mask[at(0, 0)] = 200;
  dqf[at(0, 0)] = 2; // opaque cloud
  mask[at(0, 4)] = 151;
  dqf[at(0, 4)] = 3; // sea water
  mask[at(4, 0)] = -99;
  dqf[at(4, 0)] = 255; // fill
  const c = fireCensus(mask, power, temp, area, dqf);
  const list = fireList(mask, power, temp, area, box, g, x, y);
  const homeLL = fixedGridToLatLon(
    x.offset + 750 * x.scale,
    y.offset + 750 * y.scale,
    g
  );
  // Eq. 3.4 by hand: a 4-km2 pixel, 0.5 W m^-2 sr^-1 um^-1 above the
  // background -> 4e6 x 5.67e-8 / 3e-9 x 0.5 W = 37.8 MW
  const frp = frpMir(1.2, 0.7, 4e6);
  check(
    'THE FIRE’S HEAT: the mask codes as classes, the MIR power law, the census and the navigated list',
    L2_PRODUCTS.fire === 'ABI-L2-FDCC' &&
      fireClass(10).fire === true &&
      fireClass(10).kind === 'processed' &&
      fireClass(35).filtered === true &&
      fireClass(35).kind === 'low probability' &&
      fireClass(100).fire === false &&
      fireClass(100).words === 'fire-free land' &&
      fireClass(60).words.startsWith('sun glint') &&
      fireClass(215).words === 'an opaque cloud test' &&
      fireClass(151).words.startsWith('water') &&
      FIRE_QA_WORDS.length === 6 &&
      FIRE_ATBD.mir.a === 3.0e-9 &&
      FIRE_ATBD.saturationK.band7 === 411.86 &&
      FIRE_ATBD.t39MinNightK === 285 &&
      FIRE_ATBD.blockOut.lzaDeg === 80 &&
      FIRE_ATBD.minFireK === 400 &&
      FIRE_ATBD.temporalFilterH === 12 &&
      FIRE_ATBD.frpUnreportedCodes.join() === '11,12,15,31,32,35' &&
      near(frp, (((4e6 * 5.67e-8) / 3e-9) * 0.5) / 1e6, 1e-9) &&
      Math.abs(frp - 37.8) < 1e-9 &&
      c.n === 25 &&
      c.fires === 4 &&
      c.filtered === 1 &&
      c.processed === 1 &&
      c.saturated === 1 &&
      c.cloudy === 1 &&
      c.low === 1 &&
      c.high === 0 &&
      c.frp.n === 2 &&
      near(c.frp.sumMW, 123.5, 1e-6) &&
      near(c.frp.maxMW, 120.5, 1e-6) &&
      c.temp.n === 1 &&
      c.temp.maxK === 850 &&
      c.area.n === 1 &&
      c.qa.join() === '4,18,1,1,0,0' &&
      c.qaOther === 1 &&
      list.length === 4 &&
      list[0].code === 10 &&
      list[0].frpMW === 120.5 &&
      list[0].tempK === 850 &&
      list[0].areaM2 === 60000 &&
      list[0].i === 750 &&
      list[0].j === 750 &&
      Math.abs(list[0].latDeg - homeLL.latDeg) < 1e-3 &&
      Math.abs(list[0].lonDeg - homeLL.lonDeg) < 1e-3 &&
      list[1].code === 15 &&
      list[1].frpMW === 3 &&
      list[2].frpMW === null &&
      list[3].frpMW === null &&
      list.some((f) => f.code === 31 && f.filtered && f.kind === 'saturated'),
    `codes 10-15 and 30-35 are fires (35: ${fireClass(35).words}), 100 ${fireClass(100).words}, 60 ${fireClass(60).words}, 215 ${fireClass(215).words}; ` +
      `Eq. 3.4 by hand: a 4-km2 pixel 0.5 W m^-2 sr^-1 um^-1 above its background radiates ${frp.toFixed(1)} MW; a 5x5 window censuses ${c.fires} fires ` +
      `(${c.processed} processed, ${c.saturated} saturated, ${c.cloudy} cloud-contaminated, ${c.low} low probability; ${c.filtered} seen before), ` +
      `${c.frp.n} with power (${c.frp.sumMW.toFixed(1)} MW in all, ${c.frp.maxMW} at most), the hottest ${c.temp.maxK} K, QA ${c.qa.join('/')} with ${c.qaOther} fill; ` +
      `the list navigates the processed pixel to ${list[0].latDeg}, ${list[0].lonDeg} (the home's own pixel) and orders it first by power`
  );
}

// ---- THE DAYLIGHT FIELD (159th pass) -----------------------------
// The CMIP ATBD's Eq. 3-2 kappa recomputed from the band-2 file's own
// Earth-Sun distance and Esun against the kappa0 the file carries;
// Eq. 3-3 inverted (the reflectance from the factor and the sun's
// cosine, NaN under a low sun); the solar zenith series held to Meeus
// (Astronomical Algorithms ch. 25 with apparent sidereal time,
// computed independently: agreement within 0.005 deg at every point,
// the NOAA calculator's Spencer series 0.1-0.4 deg off both) at the
// equator's noon, the home's day and night, Cape Hatteras at 12Z and
// 13:30Z, the June solstice's noon on the tropic and Meeus's own
// 1992 example; the cover fraction's clamp and its refusals; the
// census of a synthetic window by the five flags; the scene's own
// references and their thin-side nulls.
{
  const kappa = kappaFactor(VIS_ATBD.file.dAu, VIS_ATBD.file.esunWm2Um);
  const fileKappa = 0.0019646999; // the file's kappa0 attribute
  const sun = (la, lo, iso) => solarZenithDeg(la, lo, Date.parse(iso));
  const sunPins = [
    [0, 0, '2026-09-06T11:58:00Z', 6.326],
    [32.85, -117.12, '2026-09-06T17:00:00Z', 46.953],
    [32.85, -117.12, '2026-09-06T02:00:00Z', 89.206],
    [35.25, -75.5, '2026-09-06T12:00:00Z', 74.193],
    [35.25, -75.5, '2026-09-06T13:30:00Z', 56.186],
    [23.44, 0, '2026-06-21T12:00:00Z', 0.421],
    [0, 0, '2026-09-06T00:00:00Z', 173.479],
    [0, 0, '1992-10-13T00:00:00Z', 171.501]
  ];
  const sunErr = Math.max(
    ...sunPins.map(([la, lo, iso, z]) => Math.abs(sun(la, lo, iso) - z))
  );
  // the split series (the sun's place once, the cosine a pixel) is
  // the whole series at every pin
  const geoErr = Math.max(
    ...sunPins.map(([la, lo, iso]) =>
      Math.abs(
        cosSolarZenith(la, lo, solarGeometry(Date.parse(iso))) -
          Math.cos((sun(la, lo, iso) * Math.PI) / 180)
      )
    )
  );
  // a synthetic 20x20 window: counts of reflectance factor, the flags
  // by a pattern - every 7th pixel conditionally usable, every 11th
  // out of range, every 13th no value, every 17th the focal plane,
  // the last row fill (255); the good pixels' factor 0.1..0.5
  const n = 400;
  const rf = new Float32Array(n);
  const dqf = new Uint8Array(n);
  for (let q = 0; q < n; q++) {
    rf[q] = 0.1 + (0.4 * (q % 100)) / 99;
    dqf[q] =
      q >= 380
        ? 255
        : q % 17 === 0
          ? 4
          : q % 13 === 0
            ? 3
            : q % 11 === 0
              ? 2
              : q % 7 === 0
                ? 1
                : 0;
  }
  const vc = visCensus(rf, dqf, 0.5);
  const counted =
    vc.good + vc.usable + vc.outOfRange + vc.noValue + vc.fpt + vc.fill;
  const goodRf = [];
  for (let q = 0; q < n; q++) if (dqf[q] === 0) goodRf.push(rf[q]);
  goodRf.sort((a, b) => a - b);
  // references: 120 clear pixels at 0.05..0.15, 80 cloudy at 0.4..0.9
  // (the p90 near 0.85), 40 under an unknown mask, some NaN
  const rho = new Float32Array(240);
  const kind = new Array(240);
  for (let q = 0; q < 240; q++) {
    if (q < 120) {
      rho[q] = 0.05 + (0.1 * q) / 119;
      kind[q] = true;
    } else if (q < 200) {
      rho[q] = 0.4 + (0.5 * (q - 120)) / 79;
      kind[q] = false;
    } else {
      rho[q] = q % 2 ? NaN : 0.3;
      kind[q] = null;
    }
  }
  const refs = visReferences(rho, (q) => kind[q]);
  const thin = visReferences(rho, (q) =>
    q < 120 ? true : q < 130 ? false : null
  );
  const frac = coverFraction(0.5, refs.rhoClear, refs.rhoCloud);
  // THE COVERAGE EDGE (160th pass): the cloudy side above is one
  // uniform mode (eta 0.75 for a uniform sample, under the 0.8 rule),
  // so the reference is its dim tenth; a cloudy side made of clear
  // sub-pixels at 0.08 and cloud at 0.55 is two modes (eta near 1)
  // and the reference is Otsu's threshold between them
  const rho2 = new Float32Array(240);
  for (let q = 0; q < 240; q++) {
    if (q < 120) rho2[q] = 0.05 + (0.1 * q) / 119;
    else if (q < 150) rho2[q] = 0.07 + (0.02 * (q - 120)) / 29;
    else rho2[q] = 0.5 + (0.1 * (q - 150)) / 89;
  }
  const refs2 = visReferences(rho2, (q) => kind[q]);
  // THE INVERTED PAIR (166th pass): the same pixels with the kinds
  // swapped - the bright side called clear, the dim side cloud (the
  // home under a high deck, where the mask's few clear pixels sat at
  // cloud edges above the cloud's dim tenth) - is no reference: the
  // mode says 'inverted', both values are kept for the words
  const inv = visReferences(rho, (q) => (kind[q] === null ? null : !kind[q]));
  // Otsu's own pins: a normal sample splits at its mean with eta 2/pi
  // (a fixed-seed Box-Muller draw), two deltas at 0.1 and 0.6 part at
  // 0.35 with eta 1, an equal mixture of two normals 4 sigma apart
  // gives eta 0.8, a constant sample eta 0
  let seed = 12345;
  const rnd = () => {
    seed = (1103515245 * seed + 12345) % 2147483648;
    return (seed + 0.5) / 2147483648;
  };
  const gauss = () =>
    Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd());
  const normal = Float64Array.from(
    {length: 20000},
    () => 5 + 2 * gauss()
  ).sort();
  const deltas = Float64Array.from({length: 200}, (_, i) =>
    i < 100 ? 0.1 : 0.6
  );
  const mix = Float64Array.from(
    {length: 20000},
    (_, i) => (i < 10000 ? -2 : 2) + gauss()
  ).sort();
  const flat = new Float64Array(100).fill(0.3);
  const oN = otsuThreshold(normal);
  const oD = otsuThreshold(deltas);
  const oM = otsuThreshold(mix);
  const oF = otsuThreshold(flat);
  check(
    'THE DAYLIGHT FIELD: kappa from the file’s own d and Esun, Eq. 3-3 inverted, the sun held to Meeus, the cover fraction, the census and the references',
    VIS_BAND === 'C02' &&
      VIS_DQF_MEANINGS.length === 5 &&
      VIS_DQF_MEANINGS[0] === 'good_pixel_qf' &&
      VIS_DQF_MEANINGS[4].startsWith('focal_plane') &&
      VIS_ATBD.bandUm === 0.64 &&
      VIS_ATBD.resolutionM === 500 &&
      Math.abs(kappa - fileKappa) < 1e-8 &&
      Math.abs(kappa - VIS_ATBD.file.kappa0) < 1e-8 &&
      near(reflectanceOfFactor(0.4, 0.8), 0.5, 1e-12) &&
      Number.isNaN(reflectanceOfFactor(0.4, 0.04)) &&
      Number.isNaN(reflectanceOfFactor(0.4, 0.05)) &&
      near(reflectanceOfFactor(0.4, 0.06, {minCos: 0.05}), 0.4 / 0.06, 1e-12) &&
      Number.isNaN(reflectanceOfFactor(NaN, 0.8)) &&
      sunErr < 0.02 &&
      geoErr < 1e-12 &&
      sun(32.85, -117.12, '2026-09-06T02:00:00Z') > 85 &&
      sun(32.85, -117.12, '2026-09-06T20:00:00Z') < 30 &&
      near(coverFraction(0.5, 0.2, 0.8), 0.5, 1e-12) &&
      coverFraction(0.1, 0.2, 0.8) === 0 &&
      coverFraction(0.9, 0.2, 0.8) === 1 &&
      Number.isNaN(coverFraction(NaN, 0.2, 0.8)) &&
      Number.isNaN(coverFraction(0.5, 0.5, 0.5)) &&
      Number.isNaN(coverFraction(0.5, 0.8, 0.2)) &&
      vc.n === n &&
      counted === n &&
      vc.fill === 20 &&
      vc.fpt === 23 &&
      vc.good === goodRf.length &&
      vc.good > 250 &&
      near(vc.rfMin, goodRf[0], 1e-9) &&
      near(vc.rfMax, goodRf[goodRf.length - 1], 1e-9) &&
      near(vc.rfMedian, quantile(goodRf, 0.5), 1e-9) &&
      vc.cosSza === 0.5 &&
      near(vc.rhoMedian, vc.rfMedian / 0.5, 1e-9) &&
      near(vc.rhoMax, vc.rfMax / 0.5, 1e-9) &&
      refs.nClear === 120 &&
      refs.nCloud === 80 &&
      // the median as the theme's quantile takes it: element floor(n/2)
      near(refs.rhoClear, 0.05 + (0.1 * 60) / 119, 1e-6) &&
      // one uniform mode: the reference is its dim tenth (element 8)
      refs.mode === 'unimodal' &&
      refs.eta > 0.7 &&
      refs.eta < OTSU_BIMODAL_ETA &&
      near(refs.rhoCloud, 0.4 + (0.5 * 8) / 79, 1e-6) &&
      refs.rhoBright > 0.84 &&
      refs.rhoBright < 0.86 &&
      thin.rhoClear !== null &&
      thin.rhoCloud === null &&
      thin.mode === null &&
      thin.nCloud === 10 &&
      frac === 1 &&
      near(
        coverFraction(0.3, refs.rhoClear, refs.rhoCloud),
        (0.3 - refs.rhoClear) / (refs.rhoCloud - refs.rhoClear),
        1e-9
      ) &&
      // two modes: Otsu's threshold between the gaps and the cloud
      refs2.mode === 'bimodal' &&
      refs2.eta > 0.95 &&
      refs2.rhoCloud > 0.09 &&
      refs2.rhoCloud < 0.5 &&
      near(refs2.rhoCloud, (0.09 + 0.5) / 2, 1e-6) &&
      refs2.threshold === refs2.rhoCloud &&
      refs2.nCloud === 80 &&
      refs.inverted === false &&
      refs2.inverted === false &&
      thin.inverted === false &&
      inv.inverted === true &&
      inv.mode === 'inverted' &&
      inv.nClear === 80 &&
      inv.nCloud === 120 &&
      inv.rhoClear > inv.rhoCloud &&
      near(inv.rhoClear, 0.4 + (0.5 * 40) / 79, 1e-6) &&
      near(inv.rhoCloud, 0.05 + (0.1 * 12) / 119, 1e-6) &&
      near(coverFraction(0.55, refs2.rhoClear, refs2.rhoCloud), 1, 1e-9) &&
      coverFraction(0.2, refs2.rhoClear, refs2.rhoCloud) > 0.4 &&
      coverFraction(0.2, refs2.rhoClear, refs2.rhoCloud) < 0.6 &&
      Math.abs(oN.eta - 2 / Math.PI) < 0.02 &&
      Math.abs(oN.t - 5) < 0.1 &&
      near(oD.t, 0.35, 1e-12) &&
      near(oD.eta, 1, 1e-9) &&
      oD.nLow === 100 &&
      oD.nHigh === 100 &&
      near(oD.meanLow, 0.1, 1e-12) &&
      near(oD.meanHigh, 0.6, 1e-12) &&
      Math.abs(oM.eta - 0.8) < 0.02 &&
      Math.abs(oM.t) < 0.1 &&
      oF.eta === 0 &&
      oF.t === 0.3 &&
      oF.nHigh === 0 &&
      OTSU_BIMODAL_ETA === 0.8,
    `kappa = pi d^2 / Esun from the file's d ${VIS_ATBD.file.dAu} AU and Esun ${VIS_ATBD.file.esunWm2Um} W/m2/um is ${kappa.toExponential(6)} ` +
      `against the file's kappa0 ${fileKappa} (${Math.abs(kappa - fileKappa).toExponential(1)} apart); rho = rho_f / cos(sza): 0.4 / 0.8 = ` +
      `${reflectanceOfFactor(0.4, 0.8)}, NaN at cos 0.05 and below; the sun's zenith within ${sunErr.toFixed(3)} deg of Meeus at ${sunPins.length} points ` +
      `(the equator's noon ${sun(0, 0, '2026-09-06T11:58:00Z').toFixed(2)}, the home at 17Z ${sun(32.85, -117.12, '2026-09-06T17:00:00Z').toFixed(2)} ` +
      `and at 02Z ${sun(32.85, -117.12, '2026-09-06T02:00:00Z').toFixed(2)}, Hatteras at 12Z ${sun(35.25, -75.5, '2026-09-06T12:00:00Z').toFixed(2)}, ` +
      `the solstice noon on the tropic ${sun(23.44, 0, '2026-06-21T12:00:00Z').toFixed(2)}); the cover fraction 0.5 between 0.2 and 0.8, clamped to 0 and 1 ` +
      `outside, NaN without a reflectance or a span; a 20x20 window censuses ${vc.good} good, ${vc.usable} usable, ${vc.outOfRange} out of range, ` +
      `${vc.noValue} no value, ${vc.fpt} focal-plane, ${vc.fill} fill (every pixel counted once), the good factor ${vc.rfMin.toFixed(3)}-${vc.rfMax.toFixed(3)} ` +
      `median ${vc.rfMedian.toFixed(3)}, reflectance ${vc.rhoMedian.toFixed(3)} at cos ${vc.cosSza}; the scene's references from ${refs.nClear} clear ` +
      `and ${refs.nCloud} cloudy pixels: clear median ${refs.rhoClear.toFixed(3)}, the cloudy side one mode (eta ${refs.eta.toFixed(3)}) so its dim tenth ` +
      `(the same pixels with the kinds swapped are an INVERTED pair - clear ${inv.rhoClear.toFixed(3)} above the edge ${inv.rhoCloud.toFixed(3)} - and no reference: mode '${inv.mode}') ` +
      `${refs.rhoCloud.toFixed(3)} is the coverage edge (its p90 ${refs.rhoBright.toFixed(3)} the bright cloud; ten cloudy pixels answer null), ` +
      `a 0.5 reflectance ${(frac * 100).toFixed(0)}% covered; a cloudy side of gaps at 0.08 and cloud at 0.55 is two modes (eta ${refs2.eta.toFixed(3)}) ` +
      `parted at Otsu's ${refs2.rhoCloud.toFixed(3)}, a 0.2 reflectance ${(100 * coverFraction(0.2, refs2.rhoClear, refs2.rhoCloud)).toFixed(0)}% covered; ` +
      `Otsu's own: a normal sample splits at ${oN.t.toFixed(2)} with eta ${oN.eta.toFixed(3)} (2/pi = ${(2 / Math.PI).toFixed(3)}), two deltas at ${oD.t} with eta ${oD.eta.toFixed(3)}, ` +
      `an equal mixture 4 sigma apart eta ${oM.eta.toFixed(3)}, a constant eta ${oF.eta}`
  );
}

// ---- THE TOP OVER THE CORE (176th pass) ----------------------------
// The vendored ACHAC file's own grid (GOES-West's CONUS at 10 km, the
// 148th's fixture): a storm under a good, tall pixel takes that
// pixel's height over a lower echo top through the parallax shift -
// the lookup lands on the pixel only when the shift goes AWAY from
// the sub-satellite point by h tan(zenith); the wrong direction lands
// two shifts off, on a pixel whose top differs by a kilometre or more
// - keeps the radar's top where the satellite's is lower, reports a
// flagged pixel and a point outside the window, and its spherical
// view zenith stands within a quarter degree of the ellipsoid's own
// geometry (the geodetic normal against the line to the satellite).
{
  const D2R = Math.PI / 180;
  const f = openHdf5(new Uint8Array(Buffer.from(ACHAC_B64, 'base64')), inflate);
  const proj = f.dataset('goes_imager_projection').attrs;
  const sc = (a) => (Array.isArray(a) ? a[0] : a);
  const g = fixedGridGeometry({
    semi_major_axis: sc(proj.semi_major_axis),
    semi_minor_axis: sc(proj.semi_minor_axis),
    perspective_point_height: sc(proj.perspective_point_height),
    longitude_of_projection_origin: sc(proj.longitude_of_projection_origin)
  });
  const xd = f.dataset('x');
  const yd = f.dataset('y');
  const xc = {
    scale: sc(xd.attrs.scale_factor),
    offset: sc(xd.attrs.add_offset)
  };
  const yc = {
    scale: sc(yd.attrs.scale_factor),
    offset: sc(yd.attrs.add_offset)
  };
  const nx = xd.values.length;
  const ny = yd.values.length;
  const ht = physicalValues(f.dataset('HT'));
  const dqf = f.dataset('DQF').values;
  const zenithEllipsoid = (latDeg, lonDeg) => {
    const a = g.req;
    const e2 = 1 - (g.rpol * g.rpol) / (a * a);
    const phi = latDeg * D2R;
    const lam = lonDeg * D2R;
    const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    const P = [
      N * Math.cos(phi) * Math.cos(lam),
      N * Math.cos(phi) * Math.sin(lam),
      N * (1 - e2) * Math.sin(phi)
    ];
    const lam0 = g.lon0Deg * D2R;
    const Sat = [g.H * Math.cos(lam0), g.H * Math.sin(lam0), 0];
    const v = [Sat[0] - P[0], Sat[1] - P[1], Sat[2] - P[2]];
    const n = [
      Math.cos(phi) * Math.cos(lam),
      Math.cos(phi) * Math.sin(lam),
      Math.sin(phi)
    ];
    return (
      Math.acos(
        (v[0] * n[0] + v[1] * n[1] + v[2] * n[2]) / Math.hypot(v[0], v[1], v[2])
      ) / D2R
    );
  };
  const bearing = (lat1, lon1, lat2, lon2) => {
    const dl = (lon2 - lon1) * D2R;
    const y = Math.sin(dl) * Math.cos(lat2 * D2R);
    const x =
      Math.cos(lat1 * D2R) * Math.sin(lat2 * D2R) -
      Math.sin(lat1 * D2R) * Math.cos(lat2 * D2R) * Math.cos(dl);
    return (Math.atan2(y, x) / D2R + 360) % 360;
  };
  const moved = (lat, lon, brg, dM) => ({
    lat: lat + (dM * Math.cos(brg * D2R)) / 111320,
    lon: lon + (dM * Math.sin(brg * D2R)) / (111320 * Math.cos(lat * D2R))
  });
  // a good pixel at or above 10 km with a good 5 x 5 neighbourhood
  // whose pixel two parallax shifts back toward the satellite (where
  // a wrong-way lookup would land) differs by a kilometre or more
  let pick = null;
  for (let j = 5; j < ny - 5 && !pick; j++)
    for (let i = 5; i < nx - 5 && !pick; i++) {
      const q = j * nx + i;
      if (dqf[q] !== 0 || !(ht[q] >= 10000)) continue;
      let ok = true;
      for (let dj = -2; dj <= 2 && ok; dj++)
        for (let di = -2; di <= 2 && ok; di++) {
          const r = (j + dj) * nx + (i + di);
          if (dqf[r] !== 0 || !Number.isFinite(ht[r])) ok = false;
        }
      if (!ok) continue;
      const c = fixedGridToLatLon(scanAngle(i, xc), scanAngle(j, yc), g);
      if (!c) continue;
      const vz = zenithEllipsoid(c.latDeg, c.lonDeg);
      const h0 = ht[q] - 500;
      const d = h0 * Math.tan(vz * D2R);
      const toward = bearing(c.latDeg, c.lonDeg, 0, g.lon0Deg);
      const box = windowBox(c.latDeg, c.lonDeg, g, xc, yc, nx, ny, 10);
      if (!box) continue;
      const wrong = moved(c.latDeg, c.lonDeg, toward, 2 * d);
      const qW = windowIndexOf(wrong.lat, wrong.lon, g, xc, yc, box);
      const qC = windowIndexOf(c.latDeg, c.lonDeg, g, xc, yc, box);
      if (qW < 0 || qW === qC) continue;
      const wHt = cutWindow(ht, nx, box)[qW];
      const wDq = cutWindow(dqf, nx, box)[qW];
      if (wDq !== 0 || !Number.isFinite(wHt) || Math.abs(wHt - ht[q]) < 1000)
        continue;
      pick = {i, j, q, htM: ht[q], c, vz, h0, d, toward, box, qC, qW, wHt};
    }
  const hwin = pick && {
    ht: cutWindow(ht, nx, pick.box),
    dqf: cutWindow(dqf, nx, pick.box),
    box: pick.box,
    x: xc,
    y: yc,
    g,
    time: 'the fixture'
  };
  // A: under the pixel's top, placed a shift toward the satellite so
  // the parallax lands the lookup on the pixel; B: parallax off at the
  // centre; C: an echo top above the satellite's; D: the centre flagged
  // in a copy of the window; E: a point outside the window and a km-0
  // entry
  const A = pick && {
    ...moved(pick.c.latDeg, pick.c.lonDeg, pick.toward, pick.d),
    km: pick.h0 / 1000,
    distKm: 3,
    bearingDeg: 90
  };
  const rA = pick && towerTopsFromOrbit([A], hwin);
  const sA = rA && rA.storms[0];
  const B = pick && {lat: pick.c.latDeg, lon: pick.c.lonDeg, km: 8};
  const rB = pick && towerTopsFromOrbit([B], hwin, {parallax: false});
  const C = pick && {
    lat: pick.c.latDeg,
    lon: pick.c.lonDeg,
    km: pick.htM / 1000 + 2
  };
  const rC = pick && towerTopsFromOrbit([C], hwin, {parallax: false});
  const dqFlag = pick && Uint8Array.from(hwin.dqf);
  if (pick) dqFlag[pick.qC] = 2;
  const rD =
    pick && towerTopsFromOrbit([B], {...hwin, dqf: dqFlag}, {parallax: false});
  const rE =
    pick &&
    towerTopsFromOrbit(
      [
        {lat: 10, lon: -60, km: 9},
        {lat: 0, lon: 0, km: 0}
      ],
      hwin
    );
  const words = pick && towerTopsWords(rA.summary);
  const vzLaw = sA ? sA.viewZenithDeg : NaN;
  check(
    "THE TOP OVER THE CORE: a storm cell takes the satellite's height at its own parallax-shifted pixel where that is higher, the shift going away from the sub-satellite point by h tan(zenith), keeps the radar's top where the satellite's is lower, and names a flagged pixel and a point outside the window",
    !!pick &&
      sA.from === 'satellite' &&
      near(sA.satM, pick.htM, 1e-9) &&
      near(sA.liftM, 500, 1e-6) &&
      near(sA.km, pick.htM / 1000, 1e-12) &&
      near(sA.echoKm, pick.h0 / 1000, 1e-12) &&
      sA.q === pick.qC &&
      near(sA.shiftM, pick.h0 * Math.tan(vzLaw * D2R), 1e-6) &&
      Math.abs(vzLaw - pick.vz) < 0.25 &&
      Math.abs(sA.shiftM - pick.d) < 150 &&
      Math.abs(pick.wHt - pick.htM) >= 1000 &&
      rA.summary.n === 1 &&
      rA.summary.lifted === 1 &&
      near(rA.summary.maxLiftM, 500, 1e-6) &&
      rA.summary.satLonDeg === g.lon0Deg &&
      rB.storms[0].satM === pick.htM &&
      rB.storms[0].shiftM === 0 &&
      rB.storms[0].q === pick.qC &&
      near(rB.storms[0].liftM, pick.htM - 8000, 1e-9) &&
      rC.storms[0].from === 'radar' &&
      rC.storms[0].km === C.km &&
      rC.storms[0].liftM === 0 &&
      rC.summary.satBelow === 1 &&
      rD.storms[0].reason === 'flagged' &&
      rD.storms[0].km === 8 &&
      rD.summary.flagged === 1 &&
      rE.storms[0].reason === 'outside the window' &&
      rE.summary.outside === 1 &&
      rE.summary.n === 1 &&
      rE.storms[1].km === 0 &&
      words.includes("1 of 1 storm cells took the satellite's top") &&
      words.includes('the largest lift 0.5 km'),
    pick
      ? `the vendored ${ACHAC_EXPECT.file.slice(0, 24)} pixel (${pick.i}, ${pick.j}) at ${pick.c.latDeg.toFixed(3)} N ${(-pick.c.lonDeg).toFixed(3)} W holds ${pick.htM.toFixed(0)} m; ` +
          `a ${(pick.h0 / 1000).toFixed(2)}-km core placed ${(pick.d / 1000).toFixed(2)} km toward GOES-West (${g.lon0Deg} E) looks up its top ${(sA.shiftM / 1000).toFixed(2)} km away from it at ${vzLaw.toFixed(2)}° zenith (the ellipsoid's own ${pick.vz.toFixed(2)}°) and lands on the pixel - lifted 500 m to ${sA.km.toFixed(3)} km; ` +
          `the wrong way would land on a ${pick.wHt.toFixed(0)}-m pixel; parallax off at the centre lifts an 8-km core by ${(rB.storms[0].liftM / 1000).toFixed(3)} km; a ${C.km.toFixed(2)}-km core keeps its own top; a flagged centre and a point at 10 N are named; the words: "${words.slice(0, 150)}..."`
      : 'no pixel in the fixture met the search (a good 10-km top with a good 5 x 5 neighbourhood and a differing pixel two shifts back)'
  );
}

process.exit(fail ? 1 : 0);
