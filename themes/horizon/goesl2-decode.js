/**
 * goesl2-decode.js - NOAA's L2 products from the open buckets: the
 * listing and file URLs, the window and vector asks, the decode of a
 * product file (whole, or by HTTP range through hdf5.js's lazy
 * reader) and the bodies the page reads - pure, shared since the
 * 155th pass by the daemon (server/src/index.mjs, which adds node's
 * inflate and the caches) and by the PAGE itself (goesl2-client.js:
 * the buckets are CORS-open with Range, measured in the 151st, so
 * the page reads its own windows when the daemon is unreachable).
 * Written in the 148th-153rd passes inside the daemon, moved here
 * verbatim; gated by server-reference.mjs through the daemon's
 * re-exports and by goesl2-client-reference.mjs.
 *
 * The clear-sky mask (ABI-L2-ACMC: BCM, ACM, Cloud_Probabilities,
 * DQF on the 2-km CONUS grid, every 5 min), the cloud top height
 * (ABI-L2-ACHAC: HT on the 10-km grid), the band-13 imagery
 * (CMIPC), DCOMP (CODC/CPSC), the hourly full-disk SST (SSTF), the
 * 10-minute surface irradiance (DSRF), the 15-minute derived motion
 * winds (DMWC, a point list), since the 156th pass the 5-minute
 * aerosol optical depth at 550 nm (AODC) and since the 157th the
 * hourly land surface temperature (LSTC) from noaa-goes18
 * (GOES-West) and noaa-goes19 (GOES-East). Every file is read by HTTP RANGE
 * (hdf5.js openHdf5Lazy): the first quarter megabyte carries the
 * object headers and coordinate vectors, then only the chunks a
 * window touches - NOAA chunks these files in full-width row strips
 * (52 rows on the 2-km CONUS grid, 24 on the full disk), so a 101 x
 * 101 window is two or three strips; the winds' 0.3 MB file comes
 * whole in its first range. Measured on the files themselves: the 4
 * MB mask in 4 rounds and 0.9 MB, the 3.8 MB band-13 imagery in 3
 * rounds and 0.76 MB, the 32 MB full-disk SST in 6 rounds and 1.1
 * MB - every window pixel equal to the whole-file decode's
 * (hdf5-reference.mjs).
 */
import {openHdf5, physicalValues} from './hdf5.js';
import {
  aodBoxEstimate,
  aodCensus,
  boxMean,
  bucketPrefix,
  cutWindow,
  dcompCensus,
  DMW_BAND,
  dmwColumns,
  dmwLayers,
  dmwWithin,
  fieldCensus,
  fixedGridGeometry,
  goodCensus,
  heightCensus,
  IMAGERY_BAND,
  L2_PRODUCTS,
  maskCensus,
  nearestGood,
  PHASE_MEANINGS,
  phaseCensus,
  fireCensus,
  fireList,
  tpwCensus,
  rainCensus,
  rainList,
  nearestRain,
  rainQuality,
  rainFlagWords,
  ADP_RADIUS_PX,
  adpCensus,
  adpDominant,
  adpFlagBytes,
  adpPixel,
  packArray,
  pixelSizeM,
  productTimeIso,
  qualityCensus,
  solarZenithDeg,
  unscale,
  visCensus,
  windowBox
} from './goesl2.js';

export const L2_HALF_PX = {
  mask: 50,
  height: 10,
  sst: 50,
  dsr: 50,
  aod: 50,
  lst: 50
}; // +-100 km on 2-km / 10-km grids
export const L2_LIST_MS = 60e3; // a bucket listing stands a minute (the cheap part)
export const L2_RETRY_MS = 2 * 60e3; // after a listing or fetch failure
export const L2_WINDOW_MS = 15 * 60e3; // windows outlive their file by design: a new file keys new windows
export const L2_HELD_WINDOWS = 12; // decoded windows held per satellite and product (the newest and the mosaics' stamps, the cells asked)
export const L2_AT_MAX_AGE_MS = 7 * 86400e3; // how far back ?t= may ask
export const L2_RANGE_BLOCK = 65536; // range reads are whole 64 kB blocks (a B-tree node and its neighbours in one)
export const L2_HEAD_BYTES = 262144; // the first read: NetCDF-4's headers and coordinate vectors live up front
export const L2_LIST_KEYS = 1000; // an hour of CMIPC lists 16 bands x 12 files
export function l2ListUrl(bucket, prefix) {
  return (
    `https://${bucket}.s3.amazonaws.com/?list-type=2&prefix=` +
    `${encodeURIComponent(prefix)}&max-keys=${L2_LIST_KEYS}`
  );
}
export function l2FileUrl(bucket, key) {
  return `https://${bucket}.s3.amazonaws.com/${key}`;
}
// The prefixes to list for the latest file: this UTC hour, then the
// hour before when this hour has no file yet (the first file of an
// hour lands ~4 min after its start - measured), then the hour
// before that for the hourly full-disk products - the SST file of
// an hour lands 63 min after the hour's start (s2100 at 22:03:25,
// s2200 at 23:02:47, measured in the 155th pass), so at 23:01 this
// hour and the last held no SST file at all and the product went
// null; a third listing is 2 kB and stands a minute.
export function l2Prefixes(product, now = new Date()) {
  return [
    bucketPrefix(product, now),
    bucketPrefix(product, new Date(now.getTime() - 3600e3)),
    bucketPrefix(product, new Date(now.getTime() - 2 * 3600e3))
  ];
}
// The window's cell: a tenth of a degree, so a window is at most
// ~8 km off the observer (the file, not the window, is the cost).
export function l2Cell(lat, lon) {
  return {lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10};
}
// What each product's decode keeps: raw bytes for the flags, the
// physical field (scale/offset, fill -> NaN) for the heights, and
// the cloud probability as a percent byte (the file's uint16 at
// 1.5e-5 per count, valid_range [0, 1]).
export const L2_MASK_SPEC = {
  BCM: 'raw',
  ACM: 'raw',
  DQF: 'raw',
  Cloud_Probabilities: 'pct'
};
export const L2_HEIGHT_SPEC = {HT: 'phys', DQF: 'raw'};
// The 149th pass: the imagery's brightness temperature (CMI, int16
// counts with the file's scale and offset - kept raw with its
// scaling so the wire carries 2 bytes a pixel) and DCOMP's optical
// depth and particle size (uint16 counts, the same 0.00244163 per
// count) with their shared flag word.
export const L2_IMAGERY_SPEC = {CMI: 'raw16', DQF: 'raw'};
export const L2_COD_SPEC = {COD: 'raw16', DQF: 'raw16'};
// the CPS file's DQF equals the COD file's pixel for pixel (measured,
// 149th), so only the radii are held - 7.5 MB a file kept out of a
// 512 MB service (horizon-live.service MemoryMax)
export const L2_CPS_SPEC = {CPS: 'raw16'};
// The 151st pass: the sea surface (skin) temperature's counts (uint16
// at 0.00244163 K from 180 K, fill 65535) with its flags (0 good, 1
// degraded, 2 severely degraded, 3 unprocessed - the file's own
// flag_meanings, goesl2.SST_DQF_MEANINGS)
export const L2_SST_SPEC = {SST: 'raw16', DQF: 'raw'};
// The 152nd pass: the downward shortwave radiation at the surface
// (uint16 at 0.02289 W/m2 a count, fill 65535; DQF 0 good, 1
// degraded or invalid - the file's own flag_meanings,
// goesl2.DSR_DQF_MEANINGS); full disk, every 10 minutes, so a
// mosaic's minute always has a file within 15 min
export const L2_DSR_SPEC = {DSR: 'raw16', DQF: 'raw'};
// The 153rd pass: the derived motion winds (ABI-L2-DMWC, band 14) -
// a point list, so the "window" is a radius: the vectors within 150
// km of the point (the ATBD's ~38 km spacing gives a few dozen in
// cloud), read whole: the head asks for a megabyte and the bucket
// answers with the 0.3 MB file in one round (kind 'vectors')
export const L2_DMW_RADIUS_KM = 150;
export const L2_DMW_HEAD_BYTES = 1048576;
// The 156th pass: the aerosol optical depth at 550 nm (uint16 at
// 7.706e-5 a count from -0.05, fill 65535) with its four quality
// levels (DQF 0 high, 1 medium, 2 low, 3 none - the file's own
// flag_meanings, goesl2.AOD_DQF_MEANINGS); the Angstrom exponents
// (AE1/AE2, over water only) held out - the ATBD says their
// precision requirement is not met. The scene's own statistics and
// the day's bounds ride as extras (scalar datasets in the file's
// head: no further range).
export const L2_AOD_SPEC = {AOD: 'raw16', DQF: 'raw'};
export const L2_AOD_EXTRAS = [
  'mean_aod550_land',
  'std_dev_aod550_land',
  'mean_aod550_water',
  'std_dev_aod550_water',
  'aod550_retrievals_attempted_land',
  'aod550_retrievals_attempted_water',
  'quantitative_solar_zenith_angle_bounds',
  'sunglint_angle_bounds'
];
// the ATBD's collocation box on the 2-km grid: 25 x 25 px = 50 km
export const L2_AOD_BOX_R = 12;
// The 157th pass: the land surface (skin) temperature (LST uint16 at
// 0.0025 K a count from 190 K, fill 65535) with the quality DQF
// (0..3, the AOD's four names - goesl2.LST_DQF_MEANINGS) and the
// 16-bit PQI word (goesl2.lstPqi: the mask's state, the surface
// cover, the water vapour, the view angle, day or night); the
// scene's own statistics and the angle bounds ride as extras.
export const L2_LST_SPEC = {LST: 'raw16', DQF: 'raw', PQI: 'raw16'};
export const L2_LST_EXTRAS = [
  'mean_lst',
  'min_lst',
  'max_lst',
  'standard_deviation_lst',
  'total_pixels_where_lst_is_retrieved',
  'number_good_retrievals',
  'quantitative_local_zenith_angle_bounds',
  'retrieval_local_zenith_angle_bounds'
];
// how far (Chebyshev, px) the nearest high-quality skin pixel is
// sought from the point: 5 px = about 11 km on the 2-km grid here
export const L2_LST_NEAR_PX = 5;
// The 159th pass: the visible band 2 (0.64 um, the one 500-m band)
// reflectance factor - the CMIP ATBD's rho cos(solar zenith), int16
// counts at 0.00031746 with fill -1 (65535 on the wire, as band 13),
// the file's own kappa, Esun and Earth-Sun distance as extras. The
// daylight field the PAGE reads itself (pageOnly): a 401 x 401
// window is 2.6 MB off the bucket every five minutes by day and a
// 430 kB body - the free tier's egress cannot carry it, the bucket's
// CORS can.
export const L2_VIS_BAND = 'C02';
export const L2_VIS_SPEC = {CMI: 'raw16', DQF: 'raw'};
export const L2_VIS_EXTRAS = [
  'kappa0',
  'esun',
  'earth_sun_distance_anomaly_in_AU',
  'mean_reflectance_factor',
  'max_reflectance_factor',
  'valid_pixel_count'
];
L2_HALF_PX.vis = 200; // +-115 km on the 500-m grid here
// The 161st pass: the cloud top phase (Phase uint8 0..5 by the ATBD's
// Table 31, fill 255; DQF the QF word of Table 32) with the scene's
// cloudy count and angle thresholds as extras.
export const L2_PHASE_SPEC = {Phase: 'raw', DQF: 'raw'};
export const L2_PHASE_EXTRAS = [
  'total_number_cloudy_pixels',
  'quantitative_local_zenith_angle',
  'retrieval_local_zenith_angle',
  'solar_zenith_angle'
];
L2_HALF_PX.phase = 50;
// The 162nd pass: the fire mask (int16 codes of the ATBD's Table
// 3.11, fill -99), the radiative power (float32 MW, fill -9; -99 on
// non-fire pixels), the sub-pixel temperature (uint16 K at 0.0549
// from 400) and area (uint16 m2 at 60.98 from 4000), the QA flag;
// the scene's fire counts and power statistics as extras.
export const L2_FIRE_SPEC = {
  Mask: 'raw16',
  Power: 'phys',
  Temp: 'raw16',
  Area: 'raw16',
  DQF: 'raw'
};
export const L2_FIRE_EXTRAS = [
  'total_number_of_pixels_with_fires_detected',
  'total_number_of_pixels_with_fire_radiative_power',
  'mean_fire_radiative_power',
  'maximum_fire_radiative_power',
  'maximum_fire_temperature',
  'local_zenith_angle',
  'sunglint_angle'
];
L2_HALF_PX.fire = 50;
// The 163rd pass: the total precipitable water (uint16 mm at 0.001526,
// fill 65535) with its overall flag; the scene's statistics and the
// file's thresholds as extras.
export const L2_TPW_SPEC = {TPW: 'raw16', DQF_Overall: 'raw'};
export const L2_TPW_EXTRAS = [
  'mean_total_precipitable_water',
  'minimum_total_precipitable_water',
  'maximum_total_precipitable_water',
  'standard_deviation_total_precipitable_water',
  'total_attempted_retrievals',
  'quantitative_local_zenith_angle',
  'retrieval_local_zenith_angle',
  'latitude'
];
L2_HALF_PX.tpw = 10; // +-100 km on the 10-km grid
// THE RAIN (164th): the rainfall rate window (mm/h as tenths in
// uint16 with the file's scale, Table 6's flag bits) and the file's
// own scene scalars
export const L2_RAIN_SPEC = {RRQPE: 'raw16', DQF: 'raw'};
export const L2_RAIN_EXTRAS = [
  'total_pixels_with_rain',
  'total_rain_volume',
  'mean_rainfall_rate',
  'maximum_rainfall_rate',
  'minimum_rainfall_rate',
  'accounted_rainfall_rate',
  'total_pixels_with_successful_retrieval',
  'rainfall_rate_outlier_pixel_count',
  'quantitative_local_zenith_angle',
  'retrieval_local_zenith_angle',
  'latitude'
];
L2_HALF_PX.rain = 50; // +-100 km on the 2-km grid
// The 169th pass: the aerosol detection (Smoke, Dust int8 0/1 with
// fill -128 - byte codes on the wire; DQF uint16 with a two-bit
// confidence per type; PQI2 uint16 with the glint, land and night
// bits) and the scene's counts and angle thresholds as extras.
export const L2_ADP_SPEC = {
  Smoke: 'raw',
  Dust: 'raw',
  DQF: 'raw16',
  PQI2: 'raw16'
};
export const L2_ADP_EXTRAS = [
  'number_of_good_retrievals_where_smoke_detected',
  'number_of_good_retrievals_where_dust_detected',
  'number_of_good_smoke_retrievals',
  'number_of_good_dust_retrievals',
  'number_good_LZA_pixels',
  'number_good_SZA_pixels',
  'quantitative_local_zenith_angle',
  'retrieval_local_zenith_angle',
  'retrieval_solar_zenith_angle'
];
L2_HALF_PX.adp = 50;
export const L2_RAIN_MIN_MMH = 0.1;
// how far (Chebyshev, px) the nearest good TPW pixel is sought
export const L2_TPW_NEAR_PX = 2;
// what /goesl2 fetches for a point: product, spec, the window's half
// width on the product's grid, the imagery's band (the CMIPC prefix
// lists every band's file); timed false = not asked for a mosaic's
// minute (the hourly full-disk SST has no file within 15 min of it;
// the winds are the decks' drift now, not a mosaic's comparison;
// the haze is the channel's now)
export const L2_ASKS = [
  {id: 'mask', product: L2_PRODUCTS.mask, spec: L2_MASK_SPEC, halfPx: 50},
  {id: 'height', product: L2_PRODUCTS.height, spec: L2_HEIGHT_SPEC, halfPx: 10},
  {
    id: 'imagery',
    product: L2_PRODUCTS.imagery,
    spec: L2_IMAGERY_SPEC,
    band: IMAGERY_BAND,
    halfPx: 50
  },
  {id: 'cod', product: L2_PRODUCTS.cod, spec: L2_COD_SPEC, halfPx: 50},
  {id: 'cps', product: L2_PRODUCTS.cps, spec: L2_CPS_SPEC, halfPx: 50},
  {
    id: 'sst',
    product: L2_PRODUCTS.sst,
    spec: L2_SST_SPEC,
    halfPx: 50,
    timed: false,
    fullDisk: true // a 32 MB file: not for a page whose ranges are ignored
  },
  {
    id: 'dsr',
    product: L2_PRODUCTS.dsr,
    spec: L2_DSR_SPEC,
    halfPx: 50,
    fullDisk: true // 40 MB
  },
  {
    id: 'dmw',
    product: L2_PRODUCTS.dmw,
    band: DMW_BAND,
    kind: 'vectors',
    radiusKm: L2_DMW_RADIUS_KM,
    headBytes: L2_DMW_HEAD_BYTES,
    timed: false
  },
  {
    id: 'aod',
    product: L2_PRODUCTS.aod,
    spec: L2_AOD_SPEC,
    halfPx: 50,
    extras: L2_AOD_EXTRAS,
    timed: false
  },
  // the hourly land skin (157th): the land surface layer's now, not
  // a mosaic's comparison
  {
    id: 'lst',
    product: L2_PRODUCTS.lst,
    spec: L2_LST_SPEC,
    halfPx: 50,
    extras: L2_LST_EXTRAS,
    timed: false
  },
  // the daylight field (159th): the 500-m visible band, the page's
  // own read (pageOnly - the daemon never lists, fetches or serves it)
  {
    id: 'vis',
    product: L2_PRODUCTS.imagery,
    spec: L2_VIS_SPEC,
    band: L2_VIS_BAND,
    halfPx: 200,
    extras: L2_VIS_EXTRAS,
    timed: false,
    pageOnly: true
  },
  // the cloud top phase (161st): the optics' ice-or-water overhead,
  // the phase's now
  {
    id: 'phase',
    product: L2_PRODUCTS.phase,
    spec: L2_PHASE_SPEC,
    halfPx: 50,
    extras: L2_PHASE_EXTRAS,
    timed: false
  },
  // the fire's heat (162nd): the hot spots burning now, never a
  // mosaic's minute
  {
    id: 'fire',
    product: L2_PRODUCTS.fire,
    spec: L2_FIRE_SPEC,
    halfPx: 50,
    extras: L2_FIRE_EXTRAS,
    timed: false
  },
  // the column's water (163rd): the clear-sky reference's now
  {
    id: 'tpw',
    product: L2_PRODUCTS.tpw,
    spec: L2_TPW_SPEC,
    halfPx: 10,
    extras: L2_TPW_EXTRAS,
    timed: false
  },
  // the rain (164th): the rate falling now, full disk every 10 min
  {
    id: 'rain',
    product: L2_PRODUCTS.rain,
    spec: L2_RAIN_SPEC,
    halfPx: 50,
    extras: L2_RAIN_EXTRAS,
    timed: false
  },
  // the haze's kind (169th): the smoke and dust flags of the daytime
  // scene, CONUS every 10 min
  {
    id: 'adp',
    product: L2_PRODUCTS.adp,
    spec: L2_ADP_SPEC,
    halfPx: 50,
    extras: L2_ADP_EXTRAS,
    timed: false
  }
];
const l2Scalar = (a) => (Array.isArray(a) ? a[0] : a);
// The product's frame from its datasets: the projection's
// attributes, the coordinate vectors' scaling and length, the time;
// null when any is missing or unread.
function l2Frame(projD, xd, yd, td) {
  if (!projD || !xd || !yd || !td) return null;
  if (!xd.values || xd.values.unread || !yd.values || yd.values.unread)
    return null;
  if (!td.values || td.values.unread) return null;
  const p = projD.attrs;
  const proj = {
    semi_major_axis: l2Scalar(p.semi_major_axis),
    semi_minor_axis: l2Scalar(p.semi_minor_axis),
    perspective_point_height: l2Scalar(p.perspective_point_height),
    longitude_of_projection_origin: l2Scalar(p.longitude_of_projection_origin)
  };
  if (!Object.values(proj).every(Number.isFinite)) return null;
  const coord = (d) => ({
    scale: l2Scalar(d.attrs.scale_factor),
    offset: l2Scalar(d.attrs.add_offset),
    n: d.values.length
  });
  const x = coord(xd);
  const y = coord(yd);
  if (![x.scale, x.offset, y.scale, y.offset].every(Number.isFinite))
    return null;
  return {proj, x, y, time: productTimeIso(td.values[0])};
}
// One dataset in its spec mode - {value, meta} or null when unread
// or not the expected size: raw bytes, the physical field, the
// counts as stored with the file's own scaling beside them (a
// signed int16 fill of -1 becomes 65535 on the wire), or a percent
// byte.
function l2Convert(d, mode, n) {
  if (!d || !d.values || d.values.unread) return null;
  if (d.values.length !== n) return null;
  if (mode === 'raw') return {value: d.values, meta: null};
  if (mode === 'phys') return {value: physicalValues(d), meta: null};
  if (mode === 'raw16')
    return {
      value: d.values,
      meta: {
        scale: l2Scalar(d.attrs.scale_factor) ?? 1,
        offset: l2Scalar(d.attrs.add_offset) ?? 0,
        fill: l2Scalar(d.attrs._FillValue) ?? 65535,
        units: d.attrs.units ?? null
      }
    };
  const ph = physicalValues(d);
  const pct = new Uint8Array(ph.length);
  for (let q = 0; q < ph.length; q++)
    pct[q] = Number.isFinite(ph[q]) ? Math.round(100 * ph[q]) : 255;
  return {value: pct, meta: null};
}
const l2Tail = (root, lza) => ({
  platform: root.platform_ID ?? null,
  scene: root.scene_id ?? null,
  start: root.time_coverage_start ?? null,
  end: root.time_coverage_end ?? null,
  lzaMaxDeg:
    lza && lza.values && !lza.values.unread ? Number(lza.values[1]) : null
});
// The extras (156th pass): a product's own scalar datasets (the
// scene's statistics, the day's bounds) as plain numbers - a scalar
// as a number, a short vector as an array, null when unread or
// absent; `null` extras = nothing asked.
const l2Extra = (d) => {
  if (!d || !d.values || d.values.unread) return null;
  const v = Array.from(d.values, Number);
  return v.length === 1 ? v[0] : v;
};
// The whole grid from whole bytes (the gate's path, and any caller
// holding a file). null = not a product file the daemon can read
// (the route answers 502 and the journal names the dataset).
export function decodeL2(bytes, spec, inflate, extras = null) {
  const f = openHdf5(bytes, inflate);
  const frame = l2Frame(
    f.dataset('goes_imager_projection'),
    f.dataset('x'),
    f.dataset('y'),
    f.dataset('t')
  );
  if (!frame) return null;
  const data = {};
  const meta = {};
  for (const [name, mode] of Object.entries(spec)) {
    const c = l2Convert(f.dataset(name), mode, frame.x.n * frame.y.n);
    if (!c) return null;
    data[name] = c.value;
    if (c.meta) meta[name] = c.meta;
  }
  const lza =
    f.dataset('quantitative_local_zenith_angle_bounds') ??
    f.dataset('local_zenith_angle_bounds');
  const ex = extras
    ? Object.fromEntries(extras.map((n) => [n, l2Extra(f.dataset(n))]))
    : null;
  return {...frame, ...l2Tail(f.rootAttrs(), lza), data, meta, extras: ex};
}
// The window decode (151st pass) over a range-read handle
// (hdf5.js openHdf5Lazy) - or a whole-buffer one, every call
// awaited either way: the frame first (the projection, the
// coordinate vectors, the time: the file's first quarter megabyte),
// the window's box from the point, then ONLY that window of each
// dataset. null = not a product file; box null = the point is
// outside the scene (nothing more was read).
export async function decodeL2Window(f, spec, lat, lon, halfPx, extras = null) {
  const frame = l2Frame(
    await f.dataset('goes_imager_projection'),
    await f.dataset('x'),
    await f.dataset('y'),
    await f.dataset('t')
  );
  if (!frame) return null;
  const lza =
    (await f.dataset('quantitative_local_zenith_angle_bounds')) ??
    (await f.dataset('local_zenith_angle_bounds'));
  const head = {...frame, ...l2Tail(await f.rootAttrs(), lza)};
  if (extras) {
    head.extras = {};
    for (const n of extras) head.extras[n] = l2Extra(await f.dataset(n));
  } else head.extras = null;
  const g = fixedGridGeometry(frame.proj);
  const box = windowBox(
    lat,
    lon,
    g,
    frame.x,
    frame.y,
    frame.x.n,
    frame.y.n,
    halfPx
  );
  if (!box) return {...head, box: null, pixel: null, data: null, meta: null};
  const window = [
    [box.j0, box.j0 + box.rows],
    [box.i0, box.i0 + box.cols]
  ];
  const data = {};
  const meta = {};
  for (const [name, mode] of Object.entries(spec)) {
    const c = l2Convert(
      await f.dataset(name, {window}),
      mode,
      box.rows * box.cols
    );
    if (!c) return null;
    data[name] = c.value;
    if (c.meta) meta[name] = c.meta;
  }
  return {
    ...head,
    box,
    pixel: pixelSizeM(box, g, frame.x, frame.y),
    data,
    meta
  };
}
// The vectors decode (153rd pass): the DMW file is a point list -
// one row per wind vector (its lat/lon, speed, from-direction, the
// tracked cluster's median cloud-top pressure, the tracer's
// brightness temperature, the flag, the zenith angles, the
// triplet's mid-point time) with the scene's own layer statistics
// beside it - read whole through the same range handle (or a
// whole-buffer one). Keeps the vectors within radiusKm of the
// point, nearest first (goesl2.dmwWithin, gated), and the scene's
// counts by layer. null = not a DMW file.
const l2Values = async (f, name) => {
  const d = await f.dataset(name);
  return d && d.values && !d.values.unread ? d.values : null;
};
export async function decodeL2Vectors(f, lat, lon, radiusKm) {
  const names = {
    lat: 'lat',
    lon: 'lon',
    spdMs: 'wind_speed',
    dirDeg: 'wind_direction',
    hPa: 'pressure',
    tK: 'temperature',
    dqf: 'DQF',
    lzaDeg: 'local_zenith_angle',
    szaDeg: 'solar_zenith_angle'
  };
  const cols = {};
  for (const [k, name] of Object.entries(names)) {
    const v = await l2Values(f, name);
    if (!v) return null;
    cols[k] = v;
  }
  const t = await l2Values(f, 'time');
  if (!t || !t.length) return null;
  const root = await f.rootAttrs();
  const lza = await f.dataset('retrieval_local_zenith_angle_bounds');
  const band = await l2Values(f, 'band_id');
  const gap = await l2Values(f, 'seconds_between_images');
  const layerP = await l2Values(f, 'atmospheric_layer_pressure');
  const layerN = await l2Values(
    f,
    'number_of_wind_vectors_in_atmospheric_layer'
  );
  const layerCtp = await l2Values(
    f,
    'mean_cloud_top_pressure_in_atmospheric_layer'
  );
  const scalar = async (name) => {
    const v = await l2Values(f, name);
    return v && v.length ? Number(v[0]) : null;
  };
  const sceneStats = {
    meanMs: await scalar('mean_wind_speed'),
    sdMs: await scalar('standard_deviation_wind_speed'),
    minMs: await scalar('minimum_wind_speed'),
    maxMs: await scalar('maximum_wind_speed'),
    outliers: await scalar('wind_speed_outlier_count'),
    layers: layerP
      ? Array.from(layerP).map((p, i) => ({
          hPa: Number(p),
          n: layerN ? Number(layerN[i]) : null,
          meanCtpHpa: layerCtp ? Number(layerCtp[i]) : null
        }))
      : null
  };
  return {
    time: productTimeIso(Number(t[0])),
    ...l2Tail(root, lza),
    band: band && band.length ? 'C' + String(band[0]).padStart(2, '0') : null,
    imageGapS: gap && gap.length ? Number(gap[0]) : null,
    total: cols.lat.length,
    radiusKm,
    vectors: dmwWithin(cols, lat, lon, radiusKm),
    sceneStats
  };
}
// The window around a point on a decoded product: the index box,
// the pixel's ground size at the view's slant, and every kept
// dataset cut to it; null when the point is outside the scene. A
// window decode (decodeL2Window) is already cut - its own box and
// arrays, as plain arrays for the bodies.
export function l2Window(dec, lat, lon, halfPx) {
  if (dec.box !== undefined) {
    if (!dec.box || !dec.data) return null;
    const cut = {};
    for (const [n, arr] of Object.entries(dec.data)) cut[n] = Array.from(arr);
    return {box: dec.box, pixel: dec.pixel, cut};
  }
  const g = fixedGridGeometry(dec.proj);
  const box = windowBox(lat, lon, g, dec.x, dec.y, dec.x.n, dec.y.n, halfPx);
  if (!box) return null;
  const pixel = pixelSizeM(box, g, dec.x, dec.y);
  const cut = {};
  for (const [n, arr] of Object.entries(dec.data))
    cut[n] = cutWindow(arr, dec.x.n, box);
  return {box, pixel, cut};
}
const l2Common = (dec, product, key, w) => ({
  product,
  key,
  time: dec.time,
  start: dec.start,
  end: dec.end,
  platform: dec.platform,
  scene: dec.scene,
  lzaMaxDeg: dec.lzaMaxDeg,
  proj: dec.proj,
  x: {scale: dec.x.scale, offset: dec.x.offset, n: dec.x.n},
  y: {scale: dec.y.scale, offset: dec.y.offset, n: dec.y.n},
  box: w.box,
  pixel: w.pixel
    ? {ewM: Math.round(w.pixel.ewM), nsM: Math.round(w.pixel.nsM)}
    : null
});
const l2Has = (dec, spec) =>
  !!dec.data && Object.keys(spec).every((n) => dec.data[n]);
export function l2MaskBody(dec, key, lat, lon) {
  if (!l2Has(dec, L2_MASK_SPEC)) return null;
  const w = l2Window(dec, lat, lon, L2_HALF_PX.mask);
  if (!w) return null;
  return {
    ...l2Common(dec, L2_PRODUCTS.mask, key, w),
    bcm: packArray(w.cut.BCM, 'u8'),
    acm: packArray(w.cut.ACM, 'u8'),
    dqf: packArray(w.cut.DQF, 'u8'),
    prob: packArray(w.cut.Cloud_Probabilities, 'u8'),
    census: maskCensus(w.cut.BCM, w.cut.ACM, w.cut.DQF)
  };
}
export function l2HeightBody(dec, key, lat, lon) {
  if (!l2Has(dec, L2_HEIGHT_SPEC)) return null;
  const w = l2Window(dec, lat, lon, L2_HALF_PX.height);
  if (!w) return null;
  return {
    ...l2Common(dec, L2_PRODUCTS.height, key, w),
    ht: packArray(w.cut.HT, 'f32'),
    dqf: packArray(w.cut.DQF, 'u8'),
    census: heightCensus(w.cut.HT, w.cut.DQF)
  };
}
// raw counts on the wire: a signed fill (-1) becomes 65535, the
// page unscales with the scaling beside it
const l2Counts = (cut, fill) =>
  packArray(
    cut.map((v) => (v === fill || v == null || v < 0 ? 65535 : v)),
    'u16'
  );
// The imagery window (149th pass): band 13's brightness temperature
// as NOAA computed it from the radiance (the CMIP ATBD's modified
// Planck function, the file's own planck_fk1/fk2/bc1/bc2), 12-bit
// counts at 0.0615 K, DQF 0 good.
export function l2ImageryBody(dec, key, lat, lon) {
  if (!l2Has(dec, L2_IMAGERY_SPEC)) return null;
  const w = l2Window(dec, lat, lon, L2_HALF_PX.mask);
  if (!w) return null;
  const m = dec.meta.CMI ?? {scale: 1, offset: 0, fill: -1};
  const btK = unscale(w.cut.CMI, m);
  return {
    ...l2Common(dec, L2_PRODUCTS.imagery, key, w),
    band: IMAGERY_BAND,
    bt: l2Counts(w.cut.CMI, m.fill),
    btScale: m.scale,
    btOffset: m.offset,
    btFill: 65535,
    dqf: packArray(w.cut.DQF, 'u8'),
    census: goodCensus(btK, w.cut.DQF)
  };
}
// The sea surface temperature window (151st pass): ABI's own skin
// SST (ABI-L2-SSTF: full disk, hourly, 2 km) as counts with the
// file's scaling, its flags, and the census over good pixels (DQF
// 0) with the degraded count (DQF 1) beside it. The page sets it
// beside the day-old MUR analysis at the same pixels - a fresher
// measurement, stated on the line.
export function l2SstBody(dec, key, lat, lon) {
  if (!l2Has(dec, L2_SST_SPEC)) return null;
  const w = l2Window(dec, lat, lon, L2_HALF_PX.sst);
  if (!w) return null;
  const m = dec.meta.SST ?? {scale: 1, offset: 0, fill: 65535};
  const sstK = unscale(w.cut.SST, m);
  let degraded = 0;
  for (const q of w.cut.DQF) if (q === 1) degraded++;
  return {
    ...l2Common(dec, L2_PRODUCTS.sst, key, w),
    sst: l2Counts(w.cut.SST, m.fill),
    sstScale: m.scale,
    sstOffset: m.offset,
    sstFill: 65535,
    dqf: packArray(w.cut.DQF, 'u8'),
    census: {...goodCensus(sstK, w.cut.DQF), degraded}
  };
}
// The derived motion winds' body (153rd pass): the vectors within
// the radius as rounded columns (goesl2.dmwColumns), the layers'
// winds the page will recompute from them (goesl2.dmwLayers - the
// vector mean of the good vectors within the tightest radius
// holding three, by ATBD layer), the scene's own statistics, the
// triplet's spacing and the good-wind zenith bound.
export function l2DmwBody(dec, key) {
  if (!dec || !dec.vectors) return null;
  return {
    product: L2_PRODUCTS.dmw,
    key,
    time: dec.time,
    start: dec.start,
    end: dec.end,
    platform: dec.platform,
    scene: dec.scene,
    lzaMaxDeg: dec.lzaMaxDeg,
    band: dec.band,
    imageGapS: dec.imageGapS,
    radiusKm: dec.radiusKm,
    total: dec.total,
    n: dec.vectors.length,
    vectors: dmwColumns(dec.vectors),
    layers: dmwLayers(dec.vectors),
    sceneStats: dec.sceneStats
  };
}
// The surface irradiance window (152nd pass): NOAA's downward
// shortwave radiation at the surface (ABI-L2-DSRF: 0.2-4.0 um,
// direct + diffuse, W/m2, the Enterprise SRB algorithm) as counts
// with the file's scaling, its flags, the census over good pixels
// (DQF 0; W/m2), and the point's own pixel with the mean of the
// good pixels within 5 pixels of it - the ATBD's remedy for a
// pixel read against a point on the ground.
export function l2DsrBody(dec, key, lat, lon) {
  if (!l2Has(dec, L2_DSR_SPEC)) return null;
  const w = l2Window(dec, lat, lon, L2_HALF_PX.dsr);
  if (!w) return null;
  const m = dec.meta.DSR ?? {scale: 1, offset: 0, fill: 65535};
  const wm2 = unscale(w.cut.DSR, m);
  const ci = w.box.i - w.box.i0;
  const cj = w.box.j - w.box.j0;
  const qc = cj * w.box.cols + ci;
  const here =
    Number.isFinite(wm2[qc]) && w.cut.DQF[qc] === 0
      ? +wm2[qc].toFixed(1)
      : null;
  const near = boxMean(wm2, w.cut.DQF, w.box, 5);
  return {
    ...l2Common(dec, L2_PRODUCTS.dsr, key, w),
    dsr: l2Counts(w.cut.DSR, m.fill),
    dsrScale: m.scale,
    dsrOffset: m.offset,
    dsrFill: 65535,
    units: 'W m-2',
    dqf: packArray(w.cut.DQF, 'u8'),
    here,
    near: {
      r: 5,
      n: near.n,
      mean: near.mean === null ? null : +near.mean.toFixed(1),
      min: near.min === null ? null : +near.min.toFixed(1),
      max: near.max === null ? null : +near.max.toFixed(1)
    },
    census: fieldCensus(wm2, w.cut.DQF)
  };
}
// The aerosol optical depth window (156th pass): NOAA's AOD at 550
// nm (ABI-L2-AODC: CONUS every 5 min, 2 km, by day) as counts with
// the file's scaling, its four-level flags, the census by quality
// (goesl2.aodCensus), the point's own pixel with its quality, the
// plain mean of the high-quality pixels within the ATBD's 50-km box
// (`near`) and the ATBD's own collocation estimator over the same
// box (`est`: the lowest 20% and highest 50% screened, the rest
// averaged - the quantity Table 4-6 was measured for), and the
// scene's own statistics from the file's head.
export function l2AodBody(dec, key, lat, lon) {
  if (!l2Has(dec, L2_AOD_SPEC)) return null;
  const w = l2Window(dec, lat, lon, L2_HALF_PX.aod);
  if (!w) return null;
  const m = dec.meta.AOD ?? {scale: 1, offset: 0, fill: 65535};
  const tau = unscale(w.cut.AOD, m);
  const ci = w.box.i - w.box.i0;
  const cj = w.box.j - w.box.j0;
  const qc = cj * w.box.cols + ci;
  const hereDqf = w.cut.DQF[qc];
  const here =
    Number.isFinite(tau[qc]) && hereDqf <= 1 ? +tau[qc].toFixed(4) : null;
  const near = boxMean(tau, w.cut.DQF, w.box, L2_AOD_BOX_R);
  const est = aodBoxEstimate(tau, w.cut.DQF, w.box, L2_AOD_BOX_R);
  const x = dec.extras ?? {};
  const r4 = (v) => (Number.isFinite(v) ? +v.toFixed(4) : null);
  const pair = (v) =>
    Array.isArray(v) && v.length === 2 ? v.map(Number) : null;
  return {
    ...l2Common(dec, L2_PRODUCTS.aod, key, w),
    wavelengthNm: 550,
    aod: l2Counts(w.cut.AOD, m.fill),
    aodScale: m.scale,
    aodOffset: m.offset,
    aodFill: 65535,
    dqf: packArray(w.cut.DQF, 'u8'),
    here,
    hereDqf: hereDqf == null ? null : hereDqf,
    near: {
      r: L2_AOD_BOX_R,
      n: near.n,
      mean: r4(near.mean),
      min: r4(near.min),
      max: r4(near.max)
    },
    est: {
      r: L2_AOD_BOX_R,
      n: est.n,
      kept: est.kept,
      mean: r4(est.mean)
    },
    census: aodCensus(tau, w.cut.DQF),
    sceneStats: {
      meanLand: r4(x.mean_aod550_land),
      sdLand: r4(x.std_dev_aod550_land),
      meanWater: r4(x.mean_aod550_water),
      sdWater: r4(x.std_dev_aod550_water),
      attemptedLand: Number.isFinite(x.aod550_retrievals_attempted_land)
        ? x.aod550_retrievals_attempted_land
        : null,
      attemptedWater: Number.isFinite(x.aod550_retrievals_attempted_water)
        ? x.aod550_retrievals_attempted_water
        : null
    },
    szaBounds: pair(x.quantitative_solar_zenith_angle_bounds),
    glintBounds: pair(x.sunglint_angle_bounds)
  };
}
// THE LAND'S SKIN (157th pass): NOAA's land surface temperature
// (ABI-L2-LSTC: CONUS hourly, 2 km, day and night) as counts with
// the file's scaling, its quality flags and its PQI word, the
// census by quality (goesl2.qualityCensus), the point's own pixel
// with its quality and word (`here`), the nearest high-quality
// pixel within L2_LST_NEAR_PX with its offset and distance
// (`nearest` - the pixel the page's land surface layer stands on
// when the point's own is cloudy or water), and the scene's own
// statistics and angle bounds from the file's head.
export function l2LstBody(dec, key, lat, lon) {
  if (!l2Has(dec, L2_LST_SPEC)) return null;
  const w = l2Window(dec, lat, lon, L2_HALF_PX.lst);
  if (!w) return null;
  const m = dec.meta.LST ?? {scale: 1, offset: 0, fill: 65535};
  const tK = unscale(w.cut.LST, m);
  const ci = w.box.i - w.box.i0;
  const cj = w.box.j - w.box.j0;
  const qc = cj * w.box.cols + ci;
  const r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);
  const num = (v) => (Number.isFinite(v) ? v : null);
  const pair = (v) =>
    Array.isArray(v) && v.length === 2 ? v.map(Number) : null;
  const near = nearestGood(tK, w.cut.DQF, w.box, L2_LST_NEAR_PX, 0);
  const ew = w.pixel ? w.pixel.ewM : 2000;
  const ns = w.pixel ? w.pixel.nsM : 2000;
  const x = dec.extras ?? {};
  return {
    ...l2Common(dec, L2_PRODUCTS.lst, key, w),
    lst: l2Counts(w.cut.LST, m.fill),
    lstScale: m.scale,
    lstOffset: m.offset,
    lstFill: 65535,
    units: 'K',
    dqf: packArray(w.cut.DQF, 'u8'),
    pqi: packArray(w.cut.PQI, 'u16'),
    here: {
      K: r2(tK[qc]),
      dqf: w.cut.DQF[qc] ?? null,
      pqi: w.cut.PQI[qc] ?? null
    },
    nearest: near
      ? {
          K: r2(tK[near.q]),
          di: near.di,
          dj: near.dj,
          km: +(Math.hypot(near.di * ew, near.dj * ns) / 1000).toFixed(1),
          pqi: w.cut.PQI[near.q] ?? null
        }
      : null,
    nearPx: L2_LST_NEAR_PX,
    census: qualityCensus(tK, w.cut.DQF),
    sceneStats: {
      meanK: r2(x.mean_lst),
      minK: r2(x.min_lst),
      maxK: r2(x.max_lst),
      sdK: r2(x.standard_deviation_lst),
      retrieved: num(x.total_pixels_where_lst_is_retrieved),
      good: num(x.number_good_retrievals)
    },
    lzaBounds: pair(x.quantitative_local_zenith_angle_bounds),
    lzaRetrievalBounds: pair(x.retrieval_local_zenith_angle_bounds)
  };
}
// THE DAYLIGHT FIELD (159th pass): the visible band 2 window - the
// 500-m reflectance factor (the CMIP ATBD's rho cos theta0) as counts
// with the file's scaling and flags, the census by flag with the
// good pixels' reflectance-factor and reflectance statistics at the
// observer's sun (the file's own scan time through
// goesl2.solarZenithDeg unless a cosine is handed in), and the file's
// own kappa, Esun and Earth-Sun distance from the head (extras). The
// page turns the factor into reflectance by each fine texel's sun and
// carves the decks' cover with it.
export function l2VisBody(dec, key, lat, lon, {cosSza = null} = {}) {
  if (!l2Has(dec, L2_VIS_SPEC)) return null;
  const w = l2Window(dec, lat, lon, L2_HALF_PX.vis);
  if (!w) return null;
  const m = dec.meta.CMI ?? {scale: 1, offset: 0, fill: -1};
  // the fill rides as 65535 in the raw16 cut (band 13's own rule)
  const rf = unscale(w.cut.CMI, {...m, fill: 65535});
  const x = dec.extras ?? {};
  const num = (v) => (Number.isFinite(v) ? v : null);
  const cs = Number.isFinite(cosSza)
    ? cosSza
    : Math.cos(
        (solarZenithDeg(lat, lon, Date.parse(dec.time)) * Math.PI) / 180
      );
  return {
    ...l2Common(dec, L2_PRODUCTS.imagery, key, w),
    band: L2_VIS_BAND,
    wavelengthUm: 0.64,
    rf: l2Counts(w.cut.CMI, m.fill),
    rfScale: m.scale,
    rfOffset: m.offset,
    rfFill: 65535,
    dqf: packArray(w.cut.DQF, 'u8'),
    kappa0: num(x.kappa0),
    esunWm2Um: num(x.esun),
    dAu: num(x.earth_sun_distance_anomaly_in_AU),
    sceneStats: {
      meanRf: num(x.mean_reflectance_factor),
      maxRf: num(x.max_reflectance_factor),
      validPx: num(x.valid_pixel_count)
    },
    sunZenithDeg: +(
      (Math.acos(Math.max(-1, Math.min(1, cs))) * 180) /
      Math.PI
    ).toFixed(2),
    cosSza: +cs.toFixed(4),
    census: visCensus(rf, w.cut.DQF, cs)
  };
}
// THE CLOUD'S PHASE (161st pass): the phase window as the file's
// categories with the QF word, the point's own pixel, the census by
// phase over the high-quality pixels (goesl2.phaseCensus) and the
// scene's cloudy count and angle thresholds from the head.
export function l2PhaseBody(dec, key, lat, lon) {
  if (!l2Has(dec, L2_PHASE_SPEC)) return null;
  const w = l2Window(dec, lat, lon, L2_HALF_PX.phase);
  if (!w) return null;
  const ci = w.box.i - w.box.i0;
  const cj = w.box.j - w.box.j0;
  const qc = cj * w.box.cols + ci;
  const x = dec.extras ?? {};
  const num = (v) => (Number.isFinite(v) ? v : null);
  return {
    ...l2Common(dec, L2_PRODUCTS.phase, key, w),
    phase: packArray(w.cut.Phase, 'u8'),
    dqf: packArray(w.cut.DQF, 'u8'),
    meanings: PHASE_MEANINGS,
    here: {phase: w.cut.Phase[qc] ?? null, qf: w.cut.DQF[qc] ?? null},
    census: phaseCensus(w.cut.Phase, w.cut.DQF),
    sceneStats: {cloudy: num(x.total_number_cloudy_pixels)},
    lzaQuantitativeDeg: num(x.quantitative_local_zenith_angle),
    lzaRetrievalDeg: num(x.retrieval_local_zenith_angle),
    szaThresholdDeg: num(x.solar_zenith_angle)
  };
}
// THE FIRE'S HEAT (162nd pass): the fire window - the mask codes
// (u16 on the wire, the -99 fill as 65535), the fire pixels navigated
// to their places with their power, temperature and area
// (goesl2.fireList), the census (goesl2.fireCensus) and the scene's
// counts from the head.
export function l2FireBody(dec, key, lat, lon) {
  if (!l2Has(dec, L2_FIRE_SPEC)) return null;
  const w = l2Window(dec, lat, lon, L2_HALF_PX.fire);
  if (!w) return null;
  const mt = dec.meta.Temp ?? {scale: 1, offset: 0, fill: 65535};
  const ma = dec.meta.Area ?? {scale: 1, offset: 0, fill: 65535};
  const tempK = unscale(w.cut.Temp, mt);
  const areaM2 = unscale(w.cut.Area, ma);
  const power = Float32Array.from(w.cut.Power, (v) =>
    Number.isFinite(v) && v >= 0 ? v : NaN
  );
  const mask = Array.from(w.cut.Mask, (v) => (v < 0 ? 65535 : v));
  const x = dec.extras ?? {};
  const num = (v) => (Number.isFinite(v) ? v : null);
  return {
    ...l2Common(dec, L2_PRODUCTS.fire, key, w),
    mask: packArray(mask, 'u16'),
    maskFill: 65535,
    dqf: packArray(w.cut.DQF, 'u8'),
    fires: fireList(
      w.cut.Mask,
      power,
      tempK,
      areaM2,
      w.box,
      dec.g ?? fixedGridGeometry(dec.proj),
      dec.x,
      dec.y
    ),
    census: fireCensus(w.cut.Mask, power, tempK, areaM2, w.cut.DQF),
    sceneStats: {
      fires: num(x.total_number_of_pixels_with_fires_detected),
      withFrp: num(x.total_number_of_pixels_with_fire_radiative_power),
      meanFrpMW: num(x.mean_fire_radiative_power),
      maxFrpMW: num(x.maximum_fire_radiative_power),
      maxTempK: num(x.maximum_fire_temperature)
    },
    lzaThresholdDeg: num(x.local_zenith_angle),
    glintThresholdDeg: num(x.sunglint_angle)
  };
}
// THE COLUMN'S WATER (163rd pass): the TPW window as mm counts with
// the file's scaling and the overall flag, the point's own pixel and
// the nearest good pixel within 2 px, the census by quality, the
// scene's statistics and the file's thresholds.
export function l2TpwBody(dec, key, lat, lon) {
  if (!l2Has(dec, L2_TPW_SPEC)) return null;
  const w = l2Window(dec, lat, lon, L2_HALF_PX.tpw);
  if (!w) return null;
  const m = dec.meta.TPW ?? {scale: 1, offset: 0, fill: 65535};
  const mm = unscale(w.cut.TPW, m);
  const ci = w.box.i - w.box.i0;
  const cj = w.box.j - w.box.j0;
  const qc = cj * w.box.cols + ci;
  const near = nearestGood(mm, w.cut.DQF_Overall, w.box, L2_TPW_NEAR_PX, 0);
  const ew = w.pixel ? w.pixel.ewM : 10000;
  const ns = w.pixel ? w.pixel.nsM : 10000;
  const x = dec.extras ?? {};
  const num = (v) => (Number.isFinite(v) ? v : null);
  const r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);
  return {
    ...l2Common(dec, L2_PRODUCTS.tpw, key, w),
    tpw: l2Counts(w.cut.TPW, m.fill),
    tpwScale: m.scale,
    tpwOffset: m.offset,
    tpwFill: 65535,
    units: 'mm',
    dqf: packArray(w.cut.DQF_Overall, 'u8'),
    here: {mm: r2(mm[qc]), dqf: w.cut.DQF_Overall[qc] ?? null},
    nearest: near
      ? {
          mm: r2(mm[near.q]),
          di: near.di,
          dj: near.dj,
          km: +(Math.hypot(near.di * ew, near.dj * ns) / 1000).toFixed(1)
        }
      : null,
    nearPx: L2_TPW_NEAR_PX,
    census: tpwCensus(mm, w.cut.DQF_Overall),
    sceneStats: {
      meanMm: r2(x.mean_total_precipitable_water),
      minMm: r2(x.minimum_total_precipitable_water),
      maxMm: r2(x.maximum_total_precipitable_water),
      sdMm: r2(x.standard_deviation_total_precipitable_water),
      attempted: num(x.total_attempted_retrievals)
    },
    lzaQuantitativeDeg: num(x.quantitative_local_zenith_angle),
    lzaRetrievalDeg: num(x.retrieval_local_zenith_angle),
    latitudeThresholdDeg: num(x.latitude)
  };
}
// THE RAIN (164th pass): the rainfall rate window as mm/h counts
// with the file's scaling and Table 6's flag word, the point's own
// pixel, the nearest raining pixel and the raining pixels navigated
// to their places (the heaviest first), the census, the scene's own
// rain statistics and the file's thresholds.
// THE HAZE'S KIND (169th pass): the aerosol detection window - the
// smoke and dust flags as byte codes (0 absent, 1 present, 255 fill;
// goesl2.adpFlagBytes), the DQF word (the two-bit confidences) and
// PQI2 (glint, land, night), the point's own pixel with its calls,
// the census by kind and confidence (goesl2.adpCensus), the ATBD's
// own 25-km matchup rule around the point (goesl2.adpDominant, 13 px
// on the 2-km grid) and the scene's counts and thresholds from the
// head.
export function l2AdpBody(dec, key, lat, lon) {
  if (!l2Has(dec, L2_ADP_SPEC)) return null;
  const w = l2Window(dec, lat, lon, L2_HALF_PX.adp);
  if (!w) return null;
  const ci = w.box.i - w.box.i0;
  const cj = w.box.j - w.box.j0;
  const cols = w.box.cols;
  const rows = Math.round(w.cut.DQF.length / cols);
  const qc = cj * cols + ci;
  const smoke = adpFlagBytes(w.cut.Smoke);
  const dust = adpFlagBytes(w.cut.Dust);
  const x = dec.extras ?? {};
  const num = (v) => (Number.isFinite(v) ? v : null);
  return {
    ...l2Common(dec, L2_PRODUCTS.adp, key, w),
    smoke: packArray(smoke, 'u8'),
    dust: packArray(dust, 'u8'),
    dqf: packArray(w.cut.DQF, 'u16'),
    pqi2: packArray(w.cut.PQI2, 'u16'),
    here: {
      smoke: adpPixel(smoke[qc], w.cut.DQF[qc], 'smoke'),
      dust: adpPixel(dust[qc], w.cut.DQF[qc], 'dust'),
      dqf: w.cut.DQF[qc] ?? null,
      pqi2: w.cut.PQI2[qc] ?? null
    },
    census: adpCensus(smoke, dust, w.cut.DQF, w.cut.PQI2),
    matchup: adpDominant(smoke, dust, w.cut.DQF, w.cut.PQI2, {
      cols,
      rows,
      ci,
      cj,
      radiusPx: ADP_RADIUS_PX
    }),
    radiusPx: ADP_RADIUS_PX,
    sceneStats: {
      smokeDetected: num(x.number_of_good_retrievals_where_smoke_detected),
      dustDetected: num(x.number_of_good_retrievals_where_dust_detected),
      goodSmoke: num(x.number_of_good_smoke_retrievals),
      goodDust: num(x.number_of_good_dust_retrievals),
      goodLza: num(x.number_good_LZA_pixels),
      goodSza: num(x.number_good_SZA_pixels)
    },
    lzaQuantitativeDeg: num(x.quantitative_local_zenith_angle),
    lzaRetrievalDeg: num(x.retrieval_local_zenith_angle),
    szaRetrievalDeg: num(x.retrieval_solar_zenith_angle)
  };
}
export function l2RainBody(dec, key, lat, lon) {
  if (!l2Has(dec, L2_RAIN_SPEC)) return null;
  const w = l2Window(dec, lat, lon, L2_HALF_PX.rain);
  if (!w) return null;
  const m = dec.meta.RRQPE ?? {scale: 1, offset: 0, fill: 65535};
  const mmh = unscale(w.cut.RRQPE, m);
  const ci = w.box.i - w.box.i0;
  const cj = w.box.j - w.box.j0;
  const qc = cj * w.box.cols + ci;
  const ew = w.pixel ? w.pixel.ewM : 2000;
  const ns = w.pixel ? w.pixel.nsM : 2000;
  const near = nearestRain(mmh, w.cut.DQF, w.box, {minMmH: L2_RAIN_MIN_MMH});
  const x = dec.extras ?? {};
  const num = (v) => (Number.isFinite(v) ? v : null);
  const r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);
  const hereDqf = w.cut.DQF[qc] ?? null;
  return {
    ...l2Common(dec, L2_PRODUCTS.rain, key, w),
    rain: packArray(w.cut.RRQPE, 'u16'),
    rainScale: m.scale,
    rainOffset: m.offset,
    rainFill: 65535,
    units: 'mm h-1',
    dqf: packArray(w.cut.DQF, 'u8'),
    here: {
      mmh: r2(mmh[qc]),
      dqf: hereDqf,
      quality: rainQuality(hereDqf),
      words: rainFlagWords(hereDqf)
    },
    nearest: near
      ? {
          mmh: r2(near.mmh),
          di: near.di,
          dj: near.dj,
          km: +(Math.hypot(near.di * ew, near.dj * ns) / 1000).toFixed(1)
        }
      : null,
    minMmH: L2_RAIN_MIN_MMH,
    list: rainList(
      mmh,
      w.cut.DQF,
      w.box,
      dec.g ?? fixedGridGeometry(dec.proj),
      dec.x,
      dec.y,
      {
        minMmH: L2_RAIN_MIN_MMH,
        cap: 200
      }
    ).map((r) => ({...r, mmh: r2(r.mmh)})),
    census: rainCensus(mmh, w.cut.DQF),
    sceneStats: {
      rainingPx: num(x.total_pixels_with_rain),
      volumeMmH: r2(x.total_rain_volume),
      meanMmH: r2(x.mean_rainfall_rate),
      maxMmH: r2(x.maximum_rainfall_rate),
      minMmH: r2(x.minimum_rainfall_rate),
      accountedFromMmH: r2(x.accounted_rainfall_rate),
      retrieved: num(x.total_pixels_with_successful_retrieval),
      outliers: num(x.rainfall_rate_outlier_pixel_count)
    },
    lzaQuantitativeDeg: num(x.quantitative_local_zenith_angle),
    lzaRetrievalDeg: num(x.retrieval_local_zenith_angle),
    latitudeThresholdDeg: num(x.latitude)
  };
}
// The DCOMP window (149th pass): the optical depth at 640 nm and
// the effective radius (um) with the flag word the two files share
// (the CPS file's DQF equals the COD file's pixel for pixel,
// measured), censused by value and phase (goesl2.dcompCensus).
export function l2DcompBody(decCod, decCps, keyCod, keyCps, lat, lon) {
  if (!l2Has(decCod, L2_COD_SPEC)) return null;
  const w = l2Window(decCod, lat, lon, L2_HALF_PX.mask);
  if (!w) return null;
  const mc = decCod.meta.COD ?? {scale: 1, offset: 0, fill: 65535};
  let cpsCut = null;
  let mp = null;
  if (decCps && l2Has(decCps, L2_CPS_SPEC)) {
    const wp = l2Window(decCps, lat, lon, L2_HALF_PX.mask);
    if (wp && wp.box.i0 === w.box.i0 && wp.box.j0 === w.box.j0) {
      cpsCut = wp.cut.CPS;
      mp = decCps.meta.CPS ?? mc;
    }
  }
  const cod = unscale(w.cut.COD, mc);
  const cps = cpsCut
    ? unscale(cpsCut, mp)
    : new Float32Array(cod.length).fill(NaN);
  return {
    ...l2Common(decCod, L2_PRODUCTS.cod, keyCod, w),
    cpsKey: cpsCut ? keyCps : null,
    cpsTime: cpsCut && decCps ? decCps.time : null,
    cod: l2Counts(w.cut.COD, mc.fill),
    codScale: mc.scale,
    cps: cpsCut ? l2Counts(cpsCut, mp.fill) : null,
    cpsScale: mp ? mp.scale : null,
    fill: 65535,
    dqf: packArray(w.cut.DQF, 'u16'),
    census: dcompCensus(cod, cps, w.cut.DQF)
  };
}
