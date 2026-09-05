/**
 * goesir.js - the MEASURED cloud field: GOES-West ABI Band 13
 * (10.35 um clean infrared window) brightness temperatures, served
 * keyless and CORS-open by NASA GIBS as colour-mapped 2-km tiles,
 * read back to temperature, tested for cloud against the theme's
 * OWN clear-sky reference (the pier's COARE skin temperature seen
 * through the balloon-plus-sea column at the satellite's slant
 * path), and lifted to opaque cloud-top heights on the same column
 * by the GOES-R algorithm's own rules. The theme's cloud decks then
 * carve their coverage from where the satellite MEASURED cloud over
 * the sea within 100 km, instead of from a model's cloud fraction
 * (143rd pass).
 *
 * PRIMARIES READ IN FULL:
 *  - Heidinger, A. K., "GOES-R ABI Cloud Mask ATBD", NOAA NESDIS
 *    STAR, version 2.0, October 2012 (the baseline ACM). Section
 *    3.4.1.2.1 defines the ETROP test: the 11-um emissivity
 *    referenced to the tropopause,
 *        eps = (I - I_clear) / (I_bb - I_clear),
 *    I the observed radiance, I_clear the clear-sky radiance, I_bb
 *    the blackbody radiance at the tropopause temperature; Table 3
 *    prints the CALIPSO-derived thresholds at a 2% false-cloud
 *    rate: ETROP 0.10 ocean, 0.30 land, 0.4 snow/ice. Two printed
 *    constraints travel with it: a non-coast pixel whose 3x3 11-um
 *    standard deviation exceeds 0.50 K is cloud even under the
 *    threshold (eps < 0.20), and a near-land pixel called cloud
 *    with a 3x3 standard deviation under 1.0 K and eps < 0.20 is
 *    RESTORED to clear ("where the sst field is often erroneous").
 *  - Heidinger, A. K., "GOES-R ABI Cloud Height ATBD" (ACHA), NOAA
 *    NESDIS STAR, version 3.0 (2012). Section 1.11.2.7: the opaque
 *    cloud temperature is placed on the NWP profile ("profile
 *    lookup"), searched from the tropopause down; over WATER, for
 *    water/supercooled/mixed clouds, when any layer between 700 hPa
 *    and (surface - 50 hPa) is warmer than the one below it the
 *    cloud is assumed to sit in the inversion and its height is
 *    (T_surface - T_cloud) / 9.8 K per km. Section 1.11.2.8: the
 *    ISCCP layers - high above 440 hPa, low below 680 hPa, mid
 *    between.
 *  - NASA GIBS colormap v1.3 "Clean_Longwave_Infrared_Window_Band"
 *    (fetched with the tiles; vendored below VERBATIM: 238 bins of
 *    brightness temperature in degrees C plus one no-data entry).
 *    The map runs white/purple below -80.1 C, a GREY ramp over
 *    (-80.1, -70.1] C, a colour ramp over (-70.1, -19.1] C and a
 *    second GREY ramp from -19.1 C to +INF - the two grey ramps
 *    share grey levels, so a grey pixel is ambiguous by itself;
 *    resampled tiles carry intermediate greys. The rule below
 *    resolves each CONNECTED grey region by the colour border
 *    that encloses it.
 *  - AER-RC/LBLRTM v12.13 (the MT_CKD water-vapour continuum as
 *    shipped in contnm.f90: BLOCK DATA BS296 self-continuum at
 *    296 K, BSP its temperature exponents, BFH2O the foreign
 *    continuum, the mt_ckd_2.4 foreign correction constants; the
 *    radiation term RADFN in oprop.f90; RADCN2 in phys_consts.f90).
 *    The band-13 window is the ABI's "clean" window: the clear
 *    column's absorption there is the water-vapour continuum, and
 *    the theme integrates it through its own column at the slant
 *    path (line absorption, ozone and CO2 neglected - stated).
 *  - Hale & Querry 1973 (Appl. Opt. 12, 555), the complex index of
 *    water, as transcribed in the CC0 refractiveindex.info
 *    database: n = 1.218, k = 0.0508 at 10.0 um and n = 1.185,
 *    k = 0.0662 at 10.5 um; the sea's emissivity at the view angle
 *    is 1 - the mean Fresnel reflectance of that index (flat sea).
 *  - GOES-R Program (goes-r.gov, Mission): "GOES-18 became the
 *    operational GOES West satellite at 137.0 degrees west
 *    longitude on January 4, 2023"; the same site's overview: "GOES
 *    East is located at 75.2 W" with GOES-19 in operational service
 *    (146th pass; the overview also prints "GOES West is located at
 *    137.2 W", GOES-17's former station - the GOES-18 sentence is
 *    taken).
 *  - JMA (jma.go.jp, Meteorological Satellites): Himawari-9 sits
 *    "35,800 km above the equator at around 140.7 degrees east
 *    longitude"; JMA's AHI band table (mscweb, Himawari-8/9 AHI):
 *    band 13 central wavelength 10.4073 um ("changed from 11.2 um
 *    to 10.4 um on 31 October, 2013").
 *  - NASA Worldview's layer configuration (wv.json): the GOES-West,
 *    GOES-East and Himawari Band 13 layers all declare the palette
 *    Clean_Longwave_Infrared_Window_Band - ONE colormap, so the
 *    tile law below reads all three; the visible-band layers
 *    declare no palette (their grey levels carry no stated scale).
 *  - NOAA's operational L2 files (noaa-goes18 open bucket, read
 *    with h5py on 2026-09-05): the clear-sky mask (ACMC) and cloud
 *    top height (ACHAC) files print the qualified local zenith
 *    range [0, 70] degrees in their own metadata and the platform
 *    longitude -137.0 - the reach rule below and the GOES-West
 *    station, from the products themselves.
 *
 * OWNERSHIP: this module owns the tile-to-temperature law, the grey
 * rule, the clear-sky reference, the ETROP test and the height
 * rule. observatory.js composes it; Horizon.html feeds it the live
 * tiles and the far ring's DEM. Nothing here reads the network or
 * the DOM: tiles arrive as RGBA bytes, the DEM as an elevation
 * window.
 */

import {BOLTZMANN_K, LIGHT_C, PLANCK_H} from './stars-color.js';
import {eSatPa} from './surfacelayer.js';

// ---------------------------------------------------------------
// The layer and its geometry
// ---------------------------------------------------------------
export const GIBS_WMTS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';
export const GIBS_LAYER = 'GOES-West_ABI_Band13_Clean_Infrared';
export const GIBS_TMS = 'GoogleMapsCompatible_Level6';
export const GIBS_ZOOM = 6;
export const GIBS_COLORMAP_URL =
  'https://gibs.earthdata.nasa.gov/colormaps/v1.3/Clean_Longwave_Infrared_Window_Band.xml';
// The tile URL; time null asks for the layer's default (its latest
// image - the response's layer-time-actual header, exposed to CORS,
// says which); layer defaults to GOES-West's (pickSatellite names
// the one that reaches an observer).
export function gibsTileUrl(row, col, time = null, layer = GIBS_LAYER) {
  return (
    `${GIBS_WMTS}/${layer}/default/` +
    (time ? time + '/' : '') +
    `${GIBS_TMS}/${GIBS_ZOOM}/${row}/${col}.png`
  );
}
// The layer's time domain (WMTS DescribeDomains, CORS-open, cached
// half an hour by GIBS): the periods the layer holds between two
// stamps, e.g. "2026-09-05T09:00:00Z/2026-09-05T16:30:00Z/PT10M".
// The page asks for the LATEST image by its explicit stamp rather
// than the layer's default (the default URL's layer-time-actual
// header, though exposed to CORS, reaches the page unreliably).
export function gibsDomainsUrl(startIso, endIso, layer = GIBS_LAYER) {
  return (
    `${GIBS_WMTS}/1.0.0/${layer}/default/${GIBS_TMS}/all/` +
    `${startIso}--${endIso}.xml`
  );
}
export function latestTimeFromDomains(xml) {
  const m = /<Domain>([^<]*)<\/Domain>/.exec(xml);
  if (!m) return null;
  const periods = m[1].split(',').filter((p) => p.trim());
  if (!periods.length) return null;
  const last = periods[periods.length - 1].trim().split('/');
  const end = last.length >= 2 ? last[1] : last[0];
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(end)
    ? end
    : /^\d{4}-\d{2}-\d{2}$/.test(end)
      ? end + 'T00:00:00Z'
      : null;
}
export const GOES_WEST_LON_DEG = -137.0; // goes-r.gov: GOES-18 since 2023-01-04
export const BAND13_UM = 10.35; // ABI band 13 centre, 10.1-10.6 um
export const BAND13_NU_CM = 1e4 / BAND13_UM; // 966.18 cm^-1
export const WINDOW_HALF_M = 100e3; // the field's reach around the observer
// The three geostationary window channels GIBS serves on ONE
// colormap (146th pass): Worldview's layer configuration declares
// the palette Clean_Longwave_Infrared_Window_Band for each, so the
// tile law reads all three. Sub-satellite longitudes from the
// operators (header): GOES-West/GOES-18 at 137.0 W, GOES-East/
// GOES-19 at 75.2 W, Himawari-9 at 140.7 E; band centres 10.35 um
// (ABI band 13) and 10.4073 um (AHI band 13, JMA's table). Meteosat
// is not on GIBS: longitudes no satellite reaches answer unmeasured.
export const GIBS_PALETTE_ID = 'Clean_Longwave_Infrared_Window_Band';
export const SATELLITES = [
  {
    id: 'goes-west',
    name: 'GOES-West',
    craft: 'GOES-18',
    lonDeg: GOES_WEST_LON_DEG,
    layer: 'GOES-West_ABI_Band13_Clean_Infrared',
    instrument: 'ABI',
    bandUm: BAND13_UM
  },
  {
    id: 'goes-east',
    name: 'GOES-East',
    craft: 'GOES-19',
    lonDeg: -75.2,
    layer: 'GOES-East_ABI_Band13_Clean_Infrared',
    instrument: 'ABI',
    bandUm: BAND13_UM
  },
  {
    id: 'himawari',
    name: 'Himawari',
    craft: 'Himawari-9',
    lonDeg: 140.7,
    layer: 'Himawari_AHI_Band13_Clean_Infrared',
    instrument: 'AHI',
    bandUm: 10.4073
  }
];
// THE REACH: the operational products print their own qualified
// range - the ACMC file's quantitative_local_zenith_angle_bounds
// [0, 70] "local zenith angle degree range where good quality clear
// sky mask data is produced" and the ACHAC file's
// local_zenith_angle_bounds [0, 70] for cloud top height (read from
// OR_ABI-L2-ACMC-M6_G18_s20262481851177 and OR_ABI-L2-ACHAC-M6_G18_
// s20262481846177 on 2026-09-05; both files also print
// nominal_satellite_subpoint_lon -137.0). The theme takes the same
// 70 deg for every satellite (Himawari's products are not read -
// stated).
export const VIEW_ZENITH_MAX_DEG = 70;
// The satellite that sees an observer at the smallest view zenith,
// or none within the reach: {sat, viewZenithDeg, nearest}.
export function pickSatellite(
  latDeg,
  lonDeg,
  sats = SATELLITES,
  maxDeg = VIEW_ZENITH_MAX_DEG
) {
  let best = null;
  for (const s of sats) {
    const vz = viewZenithDeg(latDeg, lonDeg, s.lonDeg);
    if (!best || vz < best.viewZenithDeg) best = {sat: s, viewZenithDeg: vz};
  }
  if (!best) return {sat: null, viewZenithDeg: null, nearest: null};
  if (best.viewZenithDeg > maxDeg)
    return {sat: null, viewZenithDeg: best.viewZenithDeg, nearest: best.sat};
  return {...best, nearest: best.sat};
}

const RAD = Math.PI / 180;

// Web Mercator at zoom z with 256-px tiles: global pixel of a point.
export function mercatorPx(latDeg, lonDeg, z = GIBS_ZOOM) {
  const n = 2 ** z * 256;
  const r = latDeg * RAD;
  return {
    x: ((lonDeg + 180) / 360) * n,
    y: ((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * n
  };
}
export function mercatorLatLon(x, y, z = GIBS_ZOOM) {
  const n = 2 ** z * 256;
  return {
    lonDeg: (x / n) * 360 - 180,
    latDeg: Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) / RAD
  };
}
export function metresPerPixel(latDeg, z = GIBS_ZOOM) {
  return (40075016.686 * Math.cos(latDeg * RAD)) / (2 ** z * 256);
}

// The tiles a +/-halfM window around (lat, lon) needs at zoom z, and
// the observer's pixel inside their mosaic. At zoom 6 a 100-km half
// window is 49 px, so at most a 2x2 mosaic.
export function windowTiles(
  latDeg,
  lonDeg,
  halfM = WINDOW_HALF_M,
  z = GIBS_ZOOM
) {
  const {x, y} = mercatorPx(latDeg, lonDeg, z);
  const mpp = metresPerPixel(latDeg, z);
  const halfPx = Math.ceil(halfM / mpp);
  const c0 = Math.floor((x - halfPx) / 256);
  const c1 = Math.floor((x + halfPx) / 256);
  const r0 = Math.floor((y - halfPx) / 256);
  const r1 = Math.floor((y + halfPx) / 256);
  const tiles = [];
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++)
      tiles.push({row: r, col: c, ox: (c - c0) * 256, oy: (r - r0) * 256});
  return {
    z,
    tiles,
    x0: c0 * 256,
    y0: r0 * 256,
    w: (c1 - c0 + 1) * 256,
    h: (r1 - r0 + 1) * 256,
    px: x - c0 * 256,
    py: y - r0 * 256,
    halfPx,
    mppM: mpp
  };
}

// Satellite view zenith angle from a geostationary satellite at
// satLonDeg: the central angle gamma between the point and the
// sub-satellite point (cos gamma = cos lat cos dlon), then the
// elevation triangle with the satellite radius 42164 km and the
// Earth radius 6371 km.
export function viewZenithDeg(
  latDeg,
  lonDeg,
  satLonDeg = GOES_WEST_LON_DEG,
  {rEkm = 6371, rSkm = 42164} = {}
) {
  const cg = Math.cos(latDeg * RAD) * Math.cos((lonDeg - satLonDeg) * RAD);
  const sg = Math.sqrt(Math.max(0, 1 - cg * cg));
  return Math.atan2(sg, cg - rEkm / rSkm) / RAD;
}

// ---------------------------------------------------------------
// The vendored colormap and the tile-to-temperature law
// ---------------------------------------------------------------
// [r, g, b, lower, upper] per bin, the bin being (lower, upper] in
// degrees C; null bounds are the map's own -INF/+INF. VERBATIM from
// GIBS colormap v1.3 Clean_Longwave_Infrared_Window_Band.xml (the
// freeze script refetches it and refuses a changed map).
export const B13_COLORMAP = [
  [255, 255, 255, -92.1, -91.1],
  [127, 0, 127, -91.1, -90.1],
  [140, 13, 135, -90.1, -89.1],
  [153, 25, 142, -89.1, -88.1],
  [165, 38, 150, -88.1, -87.1],
  [178, 51, 157, -87.1, -86.1],
  [191, 64, 165, -86.1, -85.1],
  [204, 76, 173, -85.1, -84.1],
  [217, 89, 180, -84.1, -83.1],
  [229, 102, 188, -83.1, -82.1],
  [242, 114, 195, -82.1, -81.1],
  [255, 127, 203, -81.1, -80.1],
  [230, 230, 230, -80.1, -79.1],
  [204, 204, 204, -79.1, -78.1],
  [177, 177, 177, -78.1, -77.1],
  [155, 155, 155, -77.1, -76.1],
  [129, 129, 129, -76.1, -75.1],
  [102, 102, 102, -75.1, -74.1],
  [76, 76, 76, -74.1, -73.1],
  [54, 54, 54, -73.1, -72.1],
  [27, 27, 27, -72.1, -71.1],
  [5, 5, 5, -71.1, -70.1],
  [26, 0, 0, -70.1, -69.1],
  [51, 0, 0, -69.1, -68.1],
  [77, 0, 0, -68.1, -67.1],
  [102, 0, 0, -67.1, -66.1],
  [128, 0, 0, -66.1, -65.1],
  [153, 0, 0, -65.1, -64.1],
  [179, 0, 0, -64.1, -63.1],
  [204, 0, 0, -63.1, -62.1],
  [230, 0, 0, -62.1, -61.1],
  [255, 0, 0, -61.1, -60.1],
  [255, 26, 0, -60.1, -59.1],
  [255, 51, 0, -59.1, -58.1],
  [255, 77, 0, -58.1, -57.1],
  [255, 102, 0, -57.1, -56.1],
  [255, 128, 0, -56.1, -55.1],
  [255, 153, 0, -55.1, -54.1],
  [255, 179, 0, -54.1, -53.1],
  [255, 204, 0, -53.1, -52.1],
  [255, 230, 0, -52.1, -51.1],
  [255, 255, 0, -51.1, -50.1],
  [230, 255, 0, -50.1, -49.1],
  [204, 255, 0, -49.1, -48.1],
  [179, 255, 0, -48.1, -47.1],
  [153, 255, 0, -47.1, -46.1],
  [128, 255, 0, -46.1, -45.1],
  [102, 255, 0, -45.1, -44.1],
  [77, 255, 0, -44.1, -43.1],
  [51, 255, 0, -43.1, -42.1],
  [26, 255, 0, -42.1, -41.1],
  [0, 255, 0, -41.1, -40.1],
  [0, 234, 10, -40.1, -39.1],
  [0, 212, 19, -39.1, -38.1],
  [0, 191, 29, -38.1, -37.1],
  [0, 170, 38, -37.1, -36.1],
  [0, 149, 48, -36.1, -35.1],
  [0, 128, 58, -35.1, -34.1],
  [0, 106, 67, -34.1, -33.1],
  [0, 85, 77, -33.1, -32.1],
  [0, 64, 86, -32.1, -31.1],
  [0, 42, 96, -31.1, -30.6],
  [0, 21, 105, -30.6, -30.1],
  [0, 0, 115, -30.1, -29.6],
  [0, 0, 125, -29.6, -29.1],
  [0, 13, 122, -29.1, -28.6],
  [0, 26, 129, -28.6, -28.1],
  [0, 38, 136, -28.1, -27.6],
  [0, 51, 143, -27.6, -27.1],
  [0, 64, 150, -27.1, -26.6],
  [0, 76, 157, -26.6, -26.1],
  [0, 89, 164, -26.1, -25.6],
  [0, 102, 171, -25.6, -25.1],
  [0, 115, 178, -25.1, -24.6],
  [0, 128, 185, -24.6, -24.1],
  [0, 140, 192, -24.1, -23.6],
  [0, 153, 199, -23.6, -23.1],
  [0, 166, 206, -23.1, -22.6],
  [0, 178, 213, -22.6, -22.1],
  [0, 191, 220, -22.1, -21.6],
  [0, 204, 227, -21.6, -21.1],
  [0, 217, 234, -21.1, -20.6],
  [0, 230, 241, -20.6, -20.1],
  [0, 242, 248, -20.1, -19.6],
  [0, 255, 255, -19.6, -19.1],
  [197, 197, 197, -19.1, -18.6],
  [196, 196, 196, -18.6, -18.1],
  [194, 194, 194, -18.1, -17.6],
  [193, 193, 193, -17.6, -17.1],
  [192, 192, 192, -17.1, -16.6],
  [191, 191, 191, -16.6, -16.1],
  [189, 189, 189, -16.1, -15.6],
  [188, 188, 188, -15.6, -15.1],
  [187, 187, 187, -15.1, -14.6],
  [185, 185, 185, -14.6, -14.1],
  [184, 184, 184, -14.1, -13.6],
  [183, 183, 183, -13.6, -13.1],
  [181, 181, 181, -13.1, -12.6],
  [180, 180, 180, -12.6, -12.1],
  [179, 179, 179, -12.1, -11.6],
  [178, 178, 178, -11.6, -11.1],
  [176, 176, 176, -11.1, -10.6],
  [175, 175, 175, -10.6, -10.1],
  [174, 174, 174, -10.1, -9.6],
  [172, 172, 172, -9.6, -9.1],
  [171, 171, 171, -9.1, -8.6],
  [170, 170, 170, -8.6, -8.1],
  [169, 169, 169, -8.1, -7.6],
  [167, 167, 167, -7.6, -7.1],
  [166, 166, 166, -7.1, -6.6],
  [165, 165, 165, -6.6, -6.1],
  [163, 163, 163, -6.1, -5.6],
  [162, 162, 162, -5.6, -5.1],
  [161, 161, 161, -5.1, -4.6],
  [159, 159, 159, -4.6, -4.1],
  [158, 158, 158, -4.1, -3.6],
  [157, 157, 157, -3.6, -3.1],
  [156, 156, 156, -3.1, -2.6],
  [154, 154, 154, -2.6, -2.1],
  [153, 153, 153, -2.1, -1.6],
  [152, 152, 152, -1.6, -1.1],
  [150, 150, 150, -1.1, -0.6],
  [149, 149, 149, -0.6, -0.1],
  [148, 148, 148, -0.1, 0.4],
  [147, 147, 147, 0.4, 0.9],
  [145, 145, 145, 0.9, 1.4],
  [144, 144, 144, 1.4, 1.9],
  [143, 143, 143, 1.9, 2.4],
  [141, 141, 141, 2.4, 2.9],
  [140, 140, 140, 2.9, 3.4],
  [139, 139, 139, 3.4, 3.9],
  [138, 138, 138, 3.9, 4.4],
  [136, 136, 136, 4.4, 4.9],
  [135, 135, 135, 4.9, 5.4],
  [134, 134, 134, 5.4, 5.9],
  [132, 132, 132, 5.9, 6.4],
  [131, 131, 131, 6.4, 6.9],
  [130, 130, 130, 6.9, 7.4],
  [128, 128, 128, 7.4, 7.9],
  [127, 127, 127, 7.9, 8.4],
  [126, 126, 126, 8.4, 8.9],
  [125, 125, 125, 8.9, 9.4],
  [123, 123, 123, 9.4, 9.9],
  [122, 122, 122, 9.9, 10.4],
  [121, 121, 121, 10.4, 10.9],
  [119, 119, 119, 10.9, 11.4],
  [118, 118, 118, 11.4, 11.9],
  [117, 117, 117, 11.9, 12.4],
  [116, 116, 116, 12.4, 12.9],
  [114, 114, 114, 12.9, 13.4],
  [113, 113, 113, 13.4, 13.9],
  [112, 112, 112, 13.9, 14.4],
  [110, 110, 110, 14.4, 14.9],
  [109, 109, 109, 14.9, 15.4],
  [108, 108, 108, 15.4, 15.9],
  [106, 106, 106, 15.9, 16.4],
  [105, 105, 105, 16.4, 16.9],
  [104, 104, 104, 16.9, 17.4],
  [103, 103, 103, 17.4, 17.9],
  [101, 101, 101, 17.9, 18.4],
  [100, 100, 100, 18.4, 18.9],
  [99, 99, 99, 18.9, 19.4],
  [97, 97, 97, 19.4, 19.9],
  [96, 96, 96, 19.9, 20.4],
  [95, 95, 95, 20.4, 20.9],
  [94, 94, 94, 20.9, 21.4],
  [92, 92, 92, 21.4, 21.9],
  [91, 91, 91, 21.9, 22.4],
  [90, 90, 90, 22.4, 22.9],
  [88, 88, 88, 22.9, 23.4],
  [87, 87, 87, 23.4, 23.9],
  [86, 86, 86, 23.9, 24.4],
  [84, 84, 84, 24.4, 24.9],
  [83, 83, 83, 24.9, 25.4],
  [82, 82, 82, 25.4, 25.9],
  [81, 81, 81, 25.9, 26.4],
  [79, 79, 79, 26.4, 26.9],
  [78, 78, 78, 26.9, 27.4],
  [77, 77, 77, 27.4, 27.9],
  [75, 75, 75, 27.9, 28.4],
  [74, 74, 74, 28.4, 28.9],
  [73, 73, 73, 28.9, 29.4],
  [72, 72, 72, 29.4, 29.9],
  [70, 70, 70, 29.9, 30.4],
  [69, 69, 69, 30.4, 30.9],
  [68, 68, 68, 30.9, 31.4],
  [66, 66, 66, 31.4, 31.9],
  [65, 65, 65, 31.9, 32.4],
  [64, 64, 64, 32.4, 32.9],
  [62, 62, 62, 32.9, 33.4],
  [61, 61, 61, 33.4, 33.9],
  [60, 60, 60, 33.9, 34.4],
  [59, 59, 59, 34.4, 34.9],
  [57, 57, 57, 34.9, 35.4],
  [56, 56, 56, 35.4, 35.9],
  [55, 55, 55, 35.9, 36.4],
  [53, 53, 53, 36.4, 36.9],
  [52, 52, 52, 36.9, 37.4],
  [51, 51, 51, 37.4, 37.9],
  [50, 50, 50, 37.9, 38.4],
  [48, 48, 48, 38.4, 38.9],
  [47, 47, 47, 38.9, 39.4],
  [46, 46, 46, 39.4, 39.9],
  [44, 44, 44, 39.9, 40.4],
  [43, 43, 43, 40.4, 40.9],
  [42, 42, 42, 40.9, 41.4],
  [41, 41, 41, 41.4, 41.9],
  [39, 39, 39, 41.9, 42.4],
  [38, 38, 38, 42.4, 42.9],
  [37, 37, 37, 42.9, 43.4],
  [35, 35, 35, 43.4, 43.9],
  [34, 34, 34, 43.9, 44.4],
  [33, 33, 33, 44.4, 44.9],
  [31, 31, 31, 44.9, 45.4],
  [30, 30, 30, 45.4, 45.9],
  [29, 29, 29, 45.9, 46.4],
  [28, 28, 28, 46.4, 46.9],
  [26, 26, 26, 46.9, 47.4],
  [25, 25, 25, 47.4, 47.9],
  [24, 24, 24, 47.9, 48.4],
  [22, 22, 22, 48.4, 48.9],
  [21, 21, 21, 48.9, 49.4],
  [20, 20, 20, 49.4, 49.9],
  [19, 19, 19, 49.9, 50.4],
  [17, 17, 17, 50.4, 50.9],
  [16, 16, 16, 50.9, 51.4],
  [15, 15, 15, 51.4, 51.9],
  [13, 13, 13, 51.9, 52.4],
  [12, 12, 12, 52.4, 52.9],
  [11, 11, 11, 52.9, 53.4],
  [9, 9, 9, 53.4, 53.9],
  [8, 8, 8, 53.9, 54.4],
  [7, 7, 7, 54.4, 54.9],
  [6, 6, 6, 54.9, 55.4],
  [4, 4, 4, 55.4, 55.9],
  [3, 3, 3, 55.9, 56.4],
  [2, 2, 2, 56.4, 56.9],
  [1, 1, 1, 56.9, null]
];
const isGreyRgb = (r, g, b) => r === g && g === b;
export const B13_BINS = B13_COLORMAP.map(([r, g, b, lo, hi]) => ({
  r,
  g,
  b,
  lo,
  hi,
  // the bin's reading: its midpoint (a quarter-bin in from an open
  // end, the map's outermost half-degree)
  tC: lo === null ? hi - 0.25 : hi === null ? lo + 0.25 : (lo + hi) / 2,
  grey: isGreyRgb(r, g, b)
}));
// The three grey families of this map: the cold grey ramp (bins
// over (-80.1, -70.1] C, levels 230 down to 5), the warm grey ramp
// (from -19.1 C to +INF, levels 197 down to 1) and the single white
// bin at the cold end ((-92.1, -91.1] C).
const greyRun = (bins) => [...bins].sort((a, b) => a.r - b.r);
// The map's coldest grey bin is the single white one.
export const WHITE_BIN = B13_BINS.filter((e) => e.grey).reduce((a, e) =>
  e.tC < a.tC ? e : a
);
// THE THEME'S OWN RULES, STATED (the 144th sweep): the grey ramps
// are split at COLD_BORDER_C, a cut INSIDE the colour ramp
// (-70.1..-19.1 C) chosen so that an anvil's ring (colder than
// -60 C) counts as cold context and a mid-cloud edge (-19..-45 C)
// does not; the white split is the midpoint between the cold
// ramp's top level and white (derived below, not typed).
export const COLD_BORDER_C = -60;
export const COLD_GREYS = greyRun(
  B13_BINS.filter((e) => e.grey && e !== WHITE_BIN && e.tC < COLD_BORDER_C)
);
export const WARM_GREYS = greyRun(
  B13_BINS.filter((e) => e.grey && e.tC > COLD_BORDER_C)
);
export const WHITE_SPLIT_LEVEL =
  (Math.max(...COLD_GREYS.map((e) => e.r)) + WHITE_BIN.r) / 2;
export const COLOUR_BINS = B13_BINS.filter((e) => !e.grey);

// A grey level read on one grey ramp: linear between the ramp's own
// levels, clamped at its ends (resampled tiles carry in-between
// greys; the reading interpolates the bins' midpoints).
export function greyReading(ramp, level) {
  if (level <= ramp[0].r) return ramp[0].tC;
  const last = ramp[ramp.length - 1];
  if (level >= last.r) return last.tC;
  for (let i = 1; i < ramp.length; i++) {
    if (level <= ramp[i].r) {
      const a = ramp[i - 1];
      const f = (level - a.r) / (ramp[i].r - a.r);
      return a.tC + f * (ramp[i].tC - a.tC);
    }
  }
  return last.tC;
}
// A colour pixel reads as its nearest colour bin (RGB distance).
export function colourReading(r, g, b) {
  let best = COLOUR_BINS[0];
  let bd = Infinity;
  for (const e of COLOUR_BINS) {
    const d = (e.r - r) ** 2 + (e.g - g) ** 2 + (e.b - b) ** 2;
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best.tC;
}
// A pixel is grey when max(rgb) - min(rgb) is at or under this: the
// resampler's near-greys must pass, and the palette's least
// saturated colour is 26 levels from grey (the (-70.1, -69.1] bin,
// rgb 26,0,0) - the tolerance stays under half of that (gated).
export const GREY_SAT_MAX = 6;

/**
 * RGBA bytes (w x h, alpha 0 = no data) -> brightness temperature
 * per pixel (NaN where no data). Greys are read on the WARM ramp
 * here; resolveGreys then moves whole connected grey regions onto
 * the cold ramp (or white) where their colour border says so.
 */
export function decodeTile(rgba, w, h) {
  const n = w * h;
  const bt = new Float32Array(n).fill(NaN);
  const grey = new Uint8Array(n);
  const level = new Uint8Array(n);
  const colour = new Uint8Array(n);
  for (let q = 0; q < n; q++) {
    const k = q * 4;
    if (rgba[k + 3] === 0) continue;
    const r = rgba[k];
    const g = rgba[k + 1];
    const b = rgba[k + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) <= GREY_SAT_MAX) {
      grey[q] = 1;
      level[q] = Math.round((r + g + b) / 3);
      bt[q] = greyReading(WARM_GREYS, level[q]);
    } else {
      colour[q] = 1;
      bt[q] = colourReading(r, g, b);
    }
  }
  return {w, h, bt, grey, level, colour};
}

/**
 * THE GREY RULE. Grey pixels are grouped into 4-connected regions;
 * a region reads on the COLD ramp only when (a) at least half of
 * the colour pixels bordering it are colder than COLD_BORDER_C (a
 * cold cloud top's grey core is ringed by the map's -70..-60
 * colours) AND (b) that cold border ENCLOSES it - the region's
 * bounding box lies within the bounding box of its cold contacts.
 * (b) is what tells the anvil's core from the warm continent
 * around the anvil: both touch the same cold ring, but the ring
 * surrounds only the core (a scene of clear sea and one storm has
 * no other colour at all, and a bare majority would flip the whole
 * sea cold). White (level >= 240) inside a cold region is the
 * map's coldest bin. Every other grey region - the continent and
 * any isolated grey the resampler produced inside it - keeps the
 * warm ramp. No propagation runs through greys themselves, so a
 * cold seed can never flood the continent (the flood is what a
 * pixel-continuity rule does on these tiles: measured, 258,634 of
 * 258,636 greys). Mutates dec.bt; returns the region census.
 */
export function resolveGreys(dec) {
  const {w, h, bt, grey, level, colour} = dec;
  const n = w * h;
  const comp = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  const regions = [];
  for (let s = 0; s < n; s++) {
    if (!grey[s] || comp[s] >= 0) continue;
    const id = regions.length;
    let size = 0;
    let coldB = 0;
    let warmB = 0;
    let sp = 0;
    // bounding boxes of the region and of its cold contacts
    let x0 = w;
    let x1 = -1;
    let y0 = h;
    let y1 = -1;
    let cx0 = w;
    let cx1 = -1;
    let cy0 = h;
    let cy1 = -1;
    stack[sp++] = s;
    comp[s] = id;
    while (sp) {
      const q = stack[--sp];
      size++;
      const x = q % w;
      const y = (q - x) / w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const visit = (m, mx, my) => {
        if (grey[m]) {
          if (comp[m] < 0) {
            comp[m] = id;
            stack[sp++] = m;
          }
        } else if (colour[m]) {
          if (bt[m] < COLD_BORDER_C) {
            coldB++;
            if (mx < cx0) cx0 = mx;
            if (mx > cx1) cx1 = mx;
            if (my < cy0) cy0 = my;
            if (my > cy1) cy1 = my;
          } else warmB++;
        }
      };
      if (x > 0) visit(q - 1, x - 1, y);
      if (x < w - 1) visit(q + 1, x + 1, y);
      if (y > 0) visit(q - w, x, y - 1);
      if (y < h - 1) visit(q + w, x, y + 1);
    }
    const enclosed =
      coldB > 0 && cx0 <= x0 && cx1 >= x1 && cy0 <= y0 && cy1 >= y1;
    regions.push({
      size,
      coldBorder: coldB,
      warmBorder: warmB,
      enclosed,
      cold: enclosed && coldB >= 0.5 * (coldB + warmB)
    });
  }
  let coldPixels = 0;
  for (let q = 0; q < n; q++) {
    if (!grey[q] || !regions[comp[q]].cold) continue;
    bt[q] =
      level[q] >= WHITE_SPLIT_LEVEL
        ? WHITE_BIN.tC
        : greyReading(COLD_GREYS, level[q]);
    coldPixels++;
  }
  return {
    regions: regions.length,
    coldRegions: regions.filter((r) => r.cold).length,
    coldPixels,
    largest: regions.reduce((a, r) => (r.size > a.size ? r : a), regions[0])
  };
}

// Assemble a mosaic of decoded tiles ({ox, oy, rgba}) into one
// decoded field (w x h) and resolve its greys.
export function decodeMosaic(tiles, w, h) {
  const rgba = new Uint8Array(w * h * 4);
  for (const t of tiles) {
    for (let j = 0; j < 256; j++) {
      const src = j * 256 * 4;
      const dst = ((t.oy + j) * w + t.ox) * 4;
      rgba.set(t.rgba.subarray(src, src + 256 * 4), dst);
    }
  }
  const dec = decodeTile(rgba, w, h);
  dec.greys = resolveGreys(dec);
  return dec;
}

// ---------------------------------------------------------------
// Planck at the band centre (SI constants the theme already ships)
// ---------------------------------------------------------------
const LAM_M = BAND13_UM * 1e-6;
const C1 = 2 * PLANCK_H * LIGHT_C * LIGHT_C;
const C2 = (PLANCK_H * LIGHT_C) / BOLTZMANN_K; // m K
export const RADCN2_CM_K = C2 * 100; // the code's RADCN2 (1.4387752) in cm K
export function planckB(tK) {
  return C1 / LAM_M ** 5 / Math.expm1(C2 / (LAM_M * tK));
}
export function planckT(B) {
  return C2 / LAM_M / Math.log1p(C1 / (LAM_M ** 5 * B));
}
export const T_ZERO_K = 273.15;

// ---------------------------------------------------------------
// The clean window's clear column: MT_CKD continuum (LBLRTM v12.13)
// ---------------------------------------------------------------
// contnm.f90 BLOCK DATA BS296 (self continuum at 296 K, units
// (cm^3/molecule) x 1e-20), BSP (its temperature exponents, unitless)
// and BFH2O (foreign continuum, same units), all on the 10 cm^-1
// grid from -20 cm^-1 (index = (nu + 20) / 10 + 1); the entries that
// bracket band 13, copied verbatim.
export const MT_CKD_WINDOW = {
  t0K: 296,
  nuCm: [940, 950, 960, 970, 980, 990, 1000],
  self296: [2.445e-5, 2.305e-5, 2.187e-5, 2.08e-5, 1.98e-5, 1.885e-5, 1.796e-5],
  selfExp: [5.898, 5.91, 5.88, 5.842, 5.819, 5.772, 5.775],
  foreign: [9.891e-9, 8.709e-9, 7.652e-9, 6.759e-9, 5.975e-9, 5.31e-9, 4.728e-9]
};
export function mtCkdAt(nuCm) {
  const T = MT_CKD_WINDOW;
  const v = T.nuCm;
  if (nuCm <= v[0] || nuCm >= v[v.length - 1])
    throw new Error('MT_CKD window slice covers 940-1000 cm^-1 only');
  let i = 1;
  while (v[i] < nuCm) i++;
  const f = (nuCm - v[i - 1]) / (v[i] - v[i - 1]);
  const at = (a) => a[i - 1] + f * (a[i] - a[i - 1]);
  return {
    self296: at(T.self296),
    selfExp: at(T.selfExp),
    foreign: at(T.foreign)
  };
}
// contnm.f90 "CORRECTION TO FOREIGN CONTINUUM mt_ckd_2.4": for
// nu > 600 cm^-1 the foreign coefficient is scaled by FSCAL built
// from the printed constants (f0 0.06, V0F1 255.67, HWSQ1 240^2,
// BETA1 57.83, C_1 -0.42, N_1 8, C_2 0.3, BETA2 630, N_2 8).
export function foreignScale(nuCm) {
  const f0 = 0.06;
  const V0F1 = 255.67;
  const HWSQ1 = 240 ** 2;
  const BETA1 = 57.83;
  const C_1 = -0.42;
  const N_1 = 8;
  const C_2 = 0.3;
  const BETA2 = 630;
  const N_2 = 8;
  const vdelsq1 = (nuCm - V0F1) ** 2;
  const vdelmsq1 = (nuCm + V0F1) ** 2;
  const VF1 = ((nuCm - V0F1) / BETA1) ** N_1;
  const VmF1 = ((nuCm + V0F1) / BETA1) ** N_1;
  const VF2 = (nuCm / BETA2) ** N_2;
  return (
    1 +
    (f0 +
      C_1 *
        (HWSQ1 / (vdelsq1 + HWSQ1 + VF1) + HWSQ1 / (vdelmsq1 + HWSQ1 + VmF1))) /
      (1 + C_2 * VF2)
  );
}
// oprop.f90 FUNCTION RADFN: the radiation term nu tanh(nu / 2 XKT)
// with XKT = T / RADCN2, in the code's three branches.
export function radfn(nuCm, tK) {
  const xkt = tK / RADCN2_CM_K;
  if (!(xkt > 0)) return nuCm;
  const xviokt = nuCm / xkt;
  if (xviokt <= 0.01) return 0.5 * xviokt * nuCm;
  if (xviokt <= 10) {
    const e = Math.exp(-xviokt);
    return (nuCm * (1 - e)) / (1 + e);
  }
  return nuCm;
}
// One layer's continuum optical depth at nadir. contnm.f90:
// cself = WK(1) SH2O Rself RADFN with SH2O = S296 (T0/T)^SP,
// Rself = x_h2o RHOave 1e-20, RHOave = (P/P0)(T0/T); the foreign
// term FH2O FSCAL (1 - x_h2o) RHOave 1e-20 RADFN. WK(1) is the
// layer's water-vapour column in molecules per cm^2.
export function layerContinuumTau({pPa, tK, ePa, dzM}, nuCm = BAND13_NU_CM) {
  const c = mtCkdAt(nuCm);
  const wk = ((ePa / (BOLTZMANN_K * tK)) * dzM) / 1e4; // molecules / cm^2
  const x = ePa / pPa;
  const rho = (pPa / 101325) * (MT_CKD_WINDOW.t0K / tK);
  const rad = radfn(nuCm, tK);
  const self =
    wk *
    c.self296 *
    (MT_CKD_WINDOW.t0K / tK) ** c.selfExp *
    x *
    rho *
    1e-20 *
    rad;
  const foreign =
    wk * c.foreign * foreignScale(nuCm) * (1 - x) * rho * 1e-20 * rad;
  return {self, foreign, tau: self + foreign, wk};
}
// The column's layers from rows {p hPa, hM, tC, rh %} (any order),
// each layer between consecutive rows at their mean state.
export function columnLayers(rows, {topM = 20000} = {}) {
  const rs = rows
    .filter(
      (r) =>
        Number.isFinite(r.hM) && Number.isFinite(r.tC) && Number.isFinite(r.p)
    )
    .sort((a, b) => a.hM - b.hM)
    .filter((r, i, a) => i === 0 || r.hM > a[i - 1].hM);
  const out = [];
  for (let i = 0; i + 1 < rs.length; i++) {
    const a = rs[i];
    const b = rs[i + 1];
    if (a.hM >= topM) break;
    const tK = (a.tC + b.tC) / 2 + T_ZERO_K;
    const rhA = Number.isFinite(a.rh) ? a.rh : 0;
    const rhB = Number.isFinite(b.rh) ? b.rh : 0;
    const ePa = ((rhA / 100) * eSatPa(a.tC) + (rhB / 100) * eSatPa(b.tC)) / 2;
    out.push({
      hM: a.hM,
      dzM: Math.min(b.hM, topM) - a.hM,
      pPa: ((a.p + b.p) / 2) * 100,
      tK,
      ePa
    });
  }
  return out;
}
export function columnWindowTau(rows, nuCm = BAND13_NU_CM) {
  const layers = columnLayers(rows);
  let tau = 0;
  let self = 0;
  let foreign = 0;
  let pwMm = 0;
  for (const L of layers) {
    const t = layerContinuumTau(L, nuCm);
    L.tau = t.tau;
    tau += t.tau;
    self += t.self;
    foreign += t.foreign;
    // precipitable water: rho_v dz = e / (Rv T) dz, in mm
    pwMm += ((L.ePa / (461.5 * L.tK)) * L.dzM) / 1;
  }
  return {layers, tau, self, foreign, pwMm};
}

// ---------------------------------------------------------------
// The sea's emissivity: Fresnel with the complex index (flat sea)
// ---------------------------------------------------------------
// Hale & Querry 1973 at 10.0 and 10.5 um, interpolated linearly to
// the band centre (10.35 um for ABI, 10.4073 for AHI - both inside
// the two tabulated points).
export const WATER_INDEX_10UM = {n: 1.218, k: 0.0508};
export const WATER_INDEX_10_5UM = {n: 1.185, k: 0.0662};
export function waterIndexAt(um) {
  const f = (um - 10.0) / 0.5;
  return {
    n: WATER_INDEX_10UM.n + f * (WATER_INDEX_10_5UM.n - WATER_INDEX_10UM.n),
    k: WATER_INDEX_10UM.k + f * (WATER_INDEX_10_5UM.k - WATER_INDEX_10UM.k)
  };
}
export const WATER_INDEX_B13 = waterIndexAt(BAND13_UM);
// Unpolarized Fresnel reflectance of a smooth interface with complex
// index m = n + ik at incidence theta, and Kirchhoff's emissivity
// 1 - R. Complex arithmetic written out (q = sqrt(m^2 - sin^2)).
export function fresnelReflectance(thetaDeg, {n, k} = WATER_INDEX_B13) {
  const ct = Math.cos(thetaDeg * RAD);
  const s2 = Math.sin(thetaDeg * RAD) ** 2;
  // m^2 = (n^2 - k^2) + i 2nk
  const m2r = n * n - k * k;
  const m2i = 2 * n * k;
  // z = m^2 - sin^2, q = sqrt(z)
  const zr = m2r - s2;
  const zi = m2i;
  const zm = Math.hypot(zr, zi);
  const qr = Math.sqrt((zm + zr) / 2);
  const qi = Math.sign(zi) * Math.sqrt(Math.max(0, (zm - zr) / 2));
  const abs2 = (ar, ai) => ar * ar + ai * ai;
  const ratio2 = (ar, ai, br, bi) => abs2(ar, ai) / abs2(br, bi);
  const rs = ratio2(ct - qr, -qi, ct + qr, qi);
  // (m^2 cos - q) / (m^2 cos + q)
  const pr = m2r * ct;
  const pi = m2i * ct;
  const rp = ratio2(pr - qr, pi - qi, pr + qr, pi + qi);
  return {rs, rp, r: (rs + rp) / 2};
}
export function seaEmissivity(thetaDeg, index = WATER_INDEX_B13) {
  return 1 - fresnelReflectance(thetaDeg, index).r;
}

// ---------------------------------------------------------------
// The clear-sky reference: the skin seen through the column at the
// satellite's slant path
// ---------------------------------------------------------------
/**
 * Radiance the satellite would see over clear sea: the skin's
 * emission (emis B(Ts)) plus the sky's window radiance reflected
 * specularly from the same slant direction, both attenuated by
 * every layer above and topped up by each layer's own emission.
 * Returns the reference temperature and its parts.
 */
export function clearSkyReference({
  tSkinC,
  rows,
  viewZenithDeg: vz,
  bandUm = BAND13_UM,
  nuCm = null,
  emis = null
}) {
  const sec = 1 / Math.cos(Math.min(vz, 85) * RAD);
  // the band centre sets the continuum's wavenumber and the sea's
  // index (the ETROP test's Planck weighting keeps the ABI centre
  // for every satellite - a 0.6% wavenumber difference, stated)
  const col = columnWindowTau(rows, nuCm ?? 1e4 / bandUm);
  const eps = emis ?? seaEmissivity(vz, waterIndexAt(bandUm));
  // downwelling along the mirror direction: top of column downward
  let down = 0;
  for (let i = col.layers.length - 1; i >= 0; i--) {
    const L = col.layers[i];
    const tr = Math.exp(-L.tau * sec);
    down = down * tr + planckB(L.tK) * (1 - tr);
  }
  let up = eps * planckB(tSkinC + T_ZERO_K) + (1 - eps) * down;
  for (const L of col.layers) {
    const tr = Math.exp(-L.tau * sec);
    up = up * tr + planckB(L.tK) * (1 - tr);
  }
  const tClrC = planckT(up) - T_ZERO_K;
  return {
    tClrC,
    bandUm,
    depressionK: tSkinC - tClrC,
    emissivity: eps,
    tauNadir: col.tau,
    tauSlant: col.tau * sec,
    secTheta: sec,
    pwMm: col.pwMm,
    skyDownTC: down > 0 ? planckT(down) - T_ZERO_K : null,
    emissionOnlyTC: planckT(eps * planckB(tSkinC + T_ZERO_K)) - T_ZERO_K
  };
}

// ---------------------------------------------------------------
// The ETROP test (ACM 3.4.1.2.1, Table 3)
// ---------------------------------------------------------------
export const ETROP_THRESH = {ocean: 0.1, land: 0.3, snow: 0.4};
export const ETROP_LRC_THRESH = {ocean: 0.28, land: 0.3, snow: 0.5};
export const RTCT_THRESH_K = {ocean: 3.2, land: 4.1};
export const ETROP_SIGMA_CLOUD_K = 0.5; // non-coast, sigma above this: cloud when eps < 0.20
export const ETROP_SIGMA_RESTORE_K = 1.0; // near land, sigma under this and eps < 0.20: clear
export const ETROP_LOW_EPS = 0.2;
export function etrop(btC, tClrC, tTropC) {
  const iClr = planckB(tClrC + T_ZERO_K);
  const iBb = planckB(tTropC + T_ZERO_K);
  return (planckB(btC + T_ZERO_K) - iClr) / (iBb - iClr);
}
// The brightness temperature at which eps crosses a threshold (the
// test's own margin in kelvin, for the research line).
export function btAtEtrop(eps, tClrC, tTropC) {
  const iClr = planckB(tClrC + T_ZERO_K);
  const iBb = planckB(tTropC + T_ZERO_K);
  return planckT(iClr + eps * (iBb - iClr)) - T_ZERO_K;
}

// ---------------------------------------------------------------
// The column for heights (ACHA 1.11.2.7-8)
// ---------------------------------------------------------------
const sortedRows = (rows) =>
  rows
    .filter(
      (r) =>
        Number.isFinite(r.hM) && Number.isFinite(r.tC) && Number.isFinite(r.p)
    )
    .sort((a, b) => a.hM - b.hM);
// The cold point between pLoHpa and pHiHpa (the tropopause the
// theme's contrail scan already uses this way).
export function coldPoint(rows, {pLoHpa = 70, pHiHpa = 500} = {}) {
  const c = sortedRows(rows).filter((r) => r.p >= pLoHpa && r.p <= pHiHpa);
  if (!c.length) return null;
  return c.reduce((a, r) => (r.tC < a.tC ? r : a));
}
// ACHA: "if any layer below 700 hPa and 50 hPa above the surface is
// found to be warmer than the layer below it, the clouds are assumed
// to reside in an inversion".
export function lowLevelInversion(rows) {
  const rs = sortedRows(rows);
  if (rs.length < 2) return false;
  const pSfc = rs[0].p;
  for (let i = 1; i < rs.length; i++) {
    const r = rs[i];
    if (r.p > pSfc - 50 || r.p < 700) continue;
    if (r.tC > rs[i - 1].tC) return true;
  }
  return false;
}
export const INVERSION_LAPSE_K_PER_KM = 9.8; // ACHA's "dry adiabatic value"
// Profile lookup: the height whose temperature matches tC, searched
// from the tropopause DOWN (the highest crossing when the profile
// folds); at or above the surface temperature the height is 0, at
// or below the tropopause temperature the tropopause.
export function heightOfTemperature(rows, tC, tropHm) {
  const rs = sortedRows(rows).filter((r) => r.hM <= tropHm);
  if (!rs.length) return 0;
  if (tC >= rs[0].tC) return 0;
  const top = rs[rs.length - 1];
  if (tC <= top.tC) return top.hM;
  for (let i = rs.length - 1; i > 0; i--) {
    const hi = rs[i];
    const lo = rs[i - 1];
    if ((lo.tC - tC) * (hi.tC - tC) <= 0 && lo.tC !== hi.tC) {
      const f = (lo.tC - tC) / (lo.tC - hi.tC);
      return lo.hM + f * (hi.hM - lo.hM);
    }
  }
  return 0;
}
export function pressureOfHeight(rows, hM) {
  const rs = sortedRows(rows);
  if (hM <= rs[0].hM) return rs[0].p;
  for (let i = 1; i < rs.length; i++) {
    if (rs[i].hM >= hM) {
      const a = rs[i - 1];
      const b = rs[i];
      const f = (hM - a.hM) / (b.hM - a.hM);
      // log-linear in pressure
      return Math.exp(Math.log(a.p) + f * (Math.log(b.p) - Math.log(a.p)));
    }
  }
  return rs[rs.length - 1].p;
}
export function heightOfPressure(rows, pHpa) {
  const rs = sortedRows(rows);
  if (pHpa >= rs[0].p) return rs[0].hM;
  for (let i = 1; i < rs.length; i++) {
    if (rs[i].p <= pHpa) {
      const a = rs[i - 1];
      const b = rs[i];
      const f =
        (Math.log(a.p) - Math.log(pHpa)) / (Math.log(a.p) - Math.log(b.p));
      return a.hM + f * (b.hM - a.hM);
    }
  }
  return rs[rs.length - 1].hM;
}
export function temperatureAtHeight(rows, hM) {
  const rs = sortedRows(rows);
  if (hM <= rs[0].hM) return rs[0].tC;
  for (let i = 1; i < rs.length; i++) {
    if (rs[i].hM >= hM) {
      const a = rs[i - 1];
      const b = rs[i];
      const f = (hM - a.hM) / (b.hM - a.hM);
      return a.tC + f * (b.tC - a.tC);
    }
  }
  return rs[rs.length - 1].tC;
}
export const ISCCP_LOW_HPA = 680;
export const ISCCP_HIGH_HPA = 440;
export function isccpLayer(pHpa) {
  return pHpa > ISCCP_LOW_HPA ? 'low' : pHpa < ISCCP_HIGH_HPA ? 'high' : 'mid';
}

// ---------------------------------------------------------------
// The field: every pixel of the window classified
// ---------------------------------------------------------------
export const CLS = {
  nodata: 0,
  unmeasured: 1,
  clear: 2,
  low: 3,
  mid: 4,
  high: 5
};
// The ATBD's coast class comes from an ancillary 1-km coast mask
// (COAST_MASK_NASA_1KM, described in the AIADD) the theme does not
// fetch; its proxy, stated: water within COAST_PX pixels (Chebyshev,
// about 6 km) of a land pixel is "near land".
export const COAST_PX = 3;
export const HOMOGENEOUS_FREEZING_C = -40;
/**
 * Classify the window. bt: the decoded mosaic's temperatures;
 * elevM: the window's elevation (metres, terrarium bathymetry kept:
 * water at or under 0.3 m, the theme's own sea rule); the window is
 * pixels [i0, i0+ww) x [j0, j0+wh) of the mosaic. Over WATER the
 * reference is the sea's clear-sky temperature and the ocean
 * threshold; over LAND the reference is the column's free-air
 * temperature at the pixel's elevation (a surface skin the theme
 * does not measure - stated) and the land threshold, which detects
 * mid and high cloud only; the low deck over land stays with the
 * ceilometer. Returns per-pixel class, opaque-top height, pressure
 * and eps, in window coordinates.
 */
export function classifyField({
  bt,
  w,
  i0,
  j0,
  ww,
  wh,
  elevM,
  tClrC,
  tSkinC,
  tTropC,
  tropHm,
  rows,
  landReference = true,
  // the per-pixel clear-sky reference (147th pass): q -> C, when a
  // foundation-SST field gives each sea pixel its own skin; null
  // keeps the one point reference for every water pixel
  refAt = null
}) {
  const n = ww * wh;
  const tClr = new Float32Array(n).fill(NaN);
  const water = new Uint8Array(n);
  for (let q = 0; q < n; q++) water[q] = elevM[q] <= 0.3 ? 1 : 0;
  // near-land water: within COAST_PX (Chebyshev) of a land pixel
  const coastal = new Uint8Array(n);
  for (let j = 0; j < wh; j++)
    for (let i = 0; i < ww; i++) {
      const q = j * ww + i;
      if (!water[q]) continue;
      let near = 0;
      for (let dj = -COAST_PX; dj <= COAST_PX && !near; dj++)
        for (let di = -COAST_PX; di <= COAST_PX && !near; di++) {
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= ww || jj >= wh) continue;
          if (!water[jj * ww + ii]) near = 1;
        }
      coastal[q] = near;
    }
  const at = (i, j) => bt[(j0 + j) * w + (i0 + i)];
  const cls = new Uint8Array(n);
  const topM = new Float32Array(n).fill(NaN);
  const pHpa = new Float32Array(n).fill(NaN);
  const eps = new Float32Array(n).fill(NaN);
  const sigma = new Float32Array(n).fill(NaN);
  const inversion = lowLevelInversion(rows);
  for (let j = 0; j < wh; j++)
    for (let i = 0; i < ww; i++) {
      const q = j * ww + i;
      const t = at(i, j);
      if (!Number.isFinite(t)) {
        cls[q] = CLS.nodata;
        continue;
      }
      // 3x3 standard deviation of the brightness temperature
      let s = 0;
      let s2 = 0;
      let m = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= ww || jj >= wh) continue;
          const v = at(ii, jj);
          if (!Number.isFinite(v)) continue;
          s += v;
          s2 += v * v;
          m++;
        }
      const sd = m > 1 ? Math.sqrt(Math.max(0, s2 / m - (s / m) ** 2)) : 0;
      sigma[q] = sd;
      let cloud;
      let ref;
      if (water[q]) {
        ref = refAt ? refAt(q) : tClrC;
        tClr[q] = ref;
        const e = etrop(t, ref, tTropC);
        eps[q] = e;
        cloud = e >= ETROP_THRESH.ocean;
        if (!coastal[q] && sd > ETROP_SIGMA_CLOUD_K && e < ETROP_LOW_EPS)
          cloud = true;
        if (
          cloud &&
          coastal[q] &&
          sd < ETROP_SIGMA_RESTORE_K &&
          e < ETROP_LOW_EPS
        )
          cloud = false;
      } else {
        if (!landReference) {
          cls[q] = CLS.unmeasured;
          continue;
        }
        ref = temperatureAtHeight(rows, Math.max(0, elevM[q]));
        const e = etrop(t, ref, tTropC);
        eps[q] = e;
        cloud = e >= ETROP_THRESH.land;
      }
      if (!cloud) {
        cls[q] = CLS.clear;
        continue;
      }
      // opaque top: the pixel's temperature on the column. ACHA's
      // inversion rule is for "Water, Supercooled or Mixed" cloud
      // types over water; without the phase product the theme
      // reads a top warmer than the homogeneous-freezing limit of
      // supercooled water (-40 C) as one of those (stated).
      let h;
      if (water[q] && inversion && t > HOMOGENEOUS_FREEZING_C) {
        h = Math.max(0, ((tSkinC - t) / INVERSION_LAPSE_K_PER_KM) * 1000);
      } else {
        h = heightOfTemperature(rows, t, tropHm);
      }
      const p = pressureOfHeight(rows, h);
      topM[q] = h;
      pHpa[q] = p;
      const layer = isccpLayer(p);
      cls[q] = layer === 'low' ? CLS.low : layer === 'mid' ? CLS.mid : CLS.high;
    }
  return {
    ww,
    wh,
    cls,
    topM,
    pHpa,
    eps,
    sigma,
    water,
    coastal,
    inversion,
    tClr
  };
}

// ---------------------------------------------------------------
// The foundation-SST field and the per-pixel reference (147th pass)
// ---------------------------------------------------------------
// A gridded SST box as the daemon serves it from JPL's MUR analysis
// (0.01 deg, daily foundation temperature - the temperature under
// the diurnal skin, GHRSST's definition; the theme's /sst serves a
// 3-deg box at 0.05 deg): {time, lat0, lon0, dLat, dLon, nLat, nLon,
// sst} with sst row-major (latitude outer), null over land and
// where the analysis has no value.
export function sstAt(grid, latDeg, lonDeg) {
  if (!grid || !Array.isArray(grid.sst)) return null;
  const fi = (latDeg - grid.lat0) / grid.dLat;
  const fj = (lonDeg - grid.lon0) / grid.dLon;
  if (fi < 0 || fj < 0 || fi > grid.nLat - 1 || fj > grid.nLon - 1) return null;
  const i0 = Math.min(Math.floor(fi), grid.nLat - 2);
  const j0 = Math.min(Math.floor(fj), grid.nLon - 2);
  const ti = fi - i0;
  const tj = fj - j0;
  // bilinear over the valid neighbours, weights renormalised where
  // a neighbour is land or unanalysed
  let sum = 0;
  let wsum = 0;
  for (let di = 0; di <= 1; di++)
    for (let dj = 0; dj <= 1; dj++) {
      const v = grid.sst[(i0 + di) * grid.nLon + (j0 + dj)];
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      const w = (di ? ti : 1 - ti) * (dj ? tj : 1 - tj);
      sum += w * v;
      wsum += w;
    }
  return wsum > 1e-9 ? sum / wsum : null;
}
// The nearest analysed grid value to a point, within maxDeg (an
// observer on land has no MUR value under them; the pier's skin is
// tied to the sea beside them).
export function sstNearest(grid, latDeg, lonDeg, maxDeg = 0.3) {
  if (!grid || !Array.isArray(grid.sst)) return null;
  let best = null;
  for (let i = 0; i < grid.nLat; i++) {
    const la = grid.lat0 + i * grid.dLat;
    if (Math.abs(la - latDeg) > maxDeg) continue;
    for (let j = 0; j < grid.nLon; j++) {
      const v = grid.sst[i * grid.nLon + j];
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      const lo = grid.lon0 + j * grid.dLon;
      const dlo = (lo - lonDeg) * Math.cos(latDeg * RAD);
      const d = Math.hypot(la - latDeg, dlo);
      if (d <= maxDeg && (!best || d < best.d))
        best = {d, sstC: v, latDeg: la, lonDeg: lo};
    }
  }
  return best;
}
// The anomaly of each window pixel's foundation SST against the
// base point (the observer's own sea): the field the per-pixel
// reference rides on. latLonAt(q) -> {latDeg, lonDeg}. Pixels the
// analysis does not cover (land, or off the box) take 0 - the point
// reference stands there. Returns {anomK, baseC, base, coveredN,
// minK, maxK}; baseC null (no analysed sea within reach of the base
// point) leaves every anomaly 0.
export function sstAnomalyField({grid, latLonAt, n, baseLat, baseLon}) {
  const anomK = new Float32Array(n);
  const base = sstNearest(grid, baseLat, baseLon);
  if (!base) return {anomK, baseC: null, base: null, coveredN: 0};
  let coveredN = 0;
  let minK = Infinity;
  let maxK = -Infinity;
  for (let q = 0; q < n; q++) {
    const p = latLonAt(q);
    const v = sstAt(grid, p.latDeg, p.lonDeg);
    if (v === null) continue;
    const a = v - base.sstC;
    anomK[q] = a;
    coveredN++;
    if (a < minK) minK = a;
    if (a > maxK) maxK = a;
  }
  return {
    anomK,
    baseC: base.sstC,
    base,
    coveredN,
    minK: coveredN ? minK : null,
    maxK: coveredN ? maxK : null
  };
}
// The per-pixel reference on the anomaly field: the point skin plus
// the pixel's foundation anomaly through the same column and view
// (the offshore gradient from the analysis, the absolute skin and
// its diurnal state from the pier - stated), memoised on 0.02-K
// steps of the anomaly.
export function referenceAtFactory({
  anomK,
  tSkinC,
  rows,
  viewZenithDeg: vz,
  bandUm = BAND13_UM,
  stepK = 0.02
}) {
  const memo = new Map();
  const point = clearSkyReference({
    tSkinC,
    rows,
    viewZenithDeg: vz,
    bandUm
  }).tClrC;
  return (q) => {
    const a = anomK[q];
    if (!a) return point;
    const k = Math.round(a / stepK);
    let v = memo.get(k);
    if (v === undefined) {
      v = clearSkyReference({
        tSkinC: tSkinC + k * stepK,
        rows,
        viewZenithDeg: vz,
        bandUm
      }).tClrC;
      memo.set(k, v);
    }
    return v;
  };
}
// The warm-pixel closure per pixel: the 95th percentile and the
// median of (BT - the pixel's own reference) over the measured
// water pixels within a radius - the point closure's cousin that
// the offshore gradient can no longer feed.
export function fieldClosure(field, cx, cy, radiusPx) {
  const {ww, wh, cls, water, tClr} = field;
  const d = [];
  const clear = [];
  for (let j = 0; j < wh; j++)
    for (let i = 0; i < ww; i++) {
      const dx = i + 0.5 - cx;
      const dy = j + 0.5 - cy;
      if (dx * dx + dy * dy > radiusPx * radiusPx) continue;
      const q = j * ww + i;
      if (!water[q] || cls[q] === CLS.nodata || cls[q] === CLS.unmeasured)
        continue;
      if (!field.btAt) continue;
      const t = field.btAt(q);
      if (!Number.isFinite(t) || !Number.isFinite(tClr[q])) continue;
      d.push(t - tClr[q]);
      if (cls[q] === CLS.clear) clear.push(t - tClr[q]);
    }
  const p95 = (a) => a[Math.min(a.length - 1, Math.floor(0.95 * a.length))];
  const med = (a) => a[Math.floor(a.length / 2)];
  d.sort((a, b) => a - b);
  clear.sort((a, b) => a - b);
  return {
    n: d.length,
    p95K: d.length ? p95(d) : null,
    medianK: d.length ? med(d) : null,
    // the pixels the test itself called clear: what the clear sea
    // reads against its own reference (a cloudy median is the
    // cloud's, not the closure's)
    clearN: clear.length,
    clearMedianK: clear.length ? med(clear) : null,
    clearP95K: clear.length ? p95(clear) : null
  };
}

// Census of the field inside a radius (pixels) of a centre (window
// coordinates): counts per class, cloud fraction of the measured
// water, median opaque top per class, and the warm-pixel closure
// (the 95th percentile of the water pixels' temperature).
export function fieldStats(field, cx, cy, radiusPx) {
  const {ww, wh, cls, topM, water} = field;
  const c = {
    nodata: 0,
    unmeasured: 0,
    land: 0,
    water: 0,
    clear: 0,
    low: 0,
    mid: 0,
    high: 0
  };
  const cw = {clear: 0, low: 0, mid: 0, high: 0};
  const tops = {low: [], mid: [], high: []};
  const bts = [];
  let n = 0;
  for (let j = 0; j < wh; j++)
    for (let i = 0; i < ww; i++) {
      const dx = i + 0.5 - cx;
      const dy = j + 0.5 - cy;
      if (dx * dx + dy * dy > radiusPx * radiusPx) continue;
      const q = j * ww + i;
      n++;
      const k = cls[q];
      if (k === CLS.nodata) {
        c.nodata++;
        continue;
      }
      if (water[q]) c.water++;
      else c.land++;
      if (k === CLS.unmeasured) {
        c.unmeasured++;
        continue;
      }
      const name =
        k === CLS.clear
          ? 'clear'
          : k === CLS.low
            ? 'low'
            : k === CLS.mid
              ? 'mid'
              : 'high';
      c[name]++;
      if (water[q]) {
        cw[name]++;
        if (field.btAt) bts.push(field.btAt(q));
      }
      if (name !== 'clear') tops[name].push(topM[q]);
    }
  const med = (a) => {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
  };
  const waterMeasured = cw.clear + cw.low + cw.mid + cw.high;
  bts.sort((a, b) => a - b);
  return {
    n,
    ...c,
    waterMeasured,
    waterCloudFrac: waterMeasured
      ? (cw.low + cw.mid + cw.high) / waterMeasured
      : null,
    waterLow: cw.low,
    waterMid: cw.mid,
    waterHigh: cw.high,
    waterClear: cw.clear,
    measured: c.clear + c.low + c.mid + c.high,
    highFrac:
      c.clear + c.low + c.mid + c.high
        ? c.high / (c.clear + c.low + c.mid + c.high)
        : null,
    topMedianM: {low: med(tops.low), mid: med(tops.mid), high: med(tops.high)},
    warmP95C: bts.length
      ? bts[Math.min(bts.length - 1, Math.floor(bts.length * 0.95))]
      : null,
    warmP50C: bts.length ? bts[Math.floor(bts.length * 0.5)] : null
  };
}

/**
 * The field by compass sector (145th pass, the panel's look-here
 * target): n sectors of 360/n degrees around the observer, each the
 * measured-sea cloud fraction within radiusPx; azimuth clockwise
 * from north (pixel +i east, +j south). Returns the sectors and the
 * cloudiest one (ties to the first; null when no sector holds a
 * measured sea pixel).
 */
export function sectorCensus(field, cx, cy, radiusPx, n = 16) {
  const {ww, wh, cls, water} = field;
  const sectors = [];
  for (let s = 0; s < n; s++)
    sectors.push({
      azDeg: (360 * (s + 0.5)) / n,
      measured: 0,
      cloud: 0,
      frac: null
    });
  for (let j = 0; j < wh; j++)
    for (let i = 0; i < ww; i++) {
      const dx = i + 0.5 - cx;
      const dy = j + 0.5 - cy;
      const r2 = dx * dx + dy * dy;
      if (r2 > radiusPx * radiusPx || r2 === 0) continue;
      const q = j * ww + i;
      if (!water[q]) continue;
      const c = cls[q];
      if (c === CLS.nodata || c === CLS.unmeasured) continue;
      const az = ((((Math.atan2(dx, -dy) * 180) / Math.PI) % 360) + 360) % 360;
      const s = Math.min(n - 1, Math.floor((az / 360) * n));
      sectors[s].measured++;
      if (c !== CLS.clear) sectors[s].cloud++;
    }
  let cloudiest = null;
  for (const sec of sectors) {
    if (!sec.measured) continue;
    sec.frac = sec.cloud / sec.measured;
    if (!cloudiest || sec.frac > cloudiest.frac) cloudiest = sec;
  }
  return {sectors, cloudiest};
}

/**
 * THE DECK FIELD for the volumetric clouds: an RM x RM RGBA float
 * field, one texel per satellite pixel around the observer with a
 * zero border ring, in the SAME orientation as the radar field
 * (texel i east, j south). R = low-deck cover, G = mid-deck cover,
 * B = mid validity (measured there), A = low validity (measured
 * water). A cloudy texel is 0.95 (the theme's own cover cap).
 * The split rule (the theme's, stated): a single-window height
 * cannot tell a thin mid cloud from a low one - the ATBD's known
 * bias reads thin mid cloud low - so where the ceilometer measured
 * NO low layer but reports a mid or high one, satellite "low"
 * pixels are handed to the mid deck; a satellite "mid" or "high"
 * pixel never becomes low.
 */
export function deckField(
  field,
  cx,
  cy,
  halfPx,
  {metar = null, cap = 0.95} = {}
) {
  const rm = 2 * halfPx + 3;
  const data = new Float32Array(rm * rm * 4);
  const lowToMid =
    !!metar && metar.low === 0 && (metar.mid > 0 || metar.high > 0);
  const ci = Math.floor(cx);
  const cj = Math.floor(cy);
  let highN = 0;
  let midN = 0;
  let measuredN = 0;
  for (let jj = 0; jj < rm; jj++)
    for (let ii = 0; ii < rm; ii++) {
      const k = (jj * rm + ii) * 4;
      if (ii === 0 || jj === 0 || ii === rm - 1 || jj === rm - 1) continue;
      const i = ci - halfPx - 1 + ii;
      const j = cj - halfPx - 1 + jj;
      if (i < 0 || j < 0 || i >= field.ww || j >= field.wh) continue;
      const q = j * field.ww + i;
      const c = field.cls[q];
      if (c === CLS.nodata || c === CLS.unmeasured) continue;
      measuredN++;
      const water = field.water[q] === 1;
      const asMid = c === CLS.mid || (c === CLS.low && lowToMid);
      const asLow = c === CLS.low && !lowToMid;
      data[k] = water && asLow ? cap : 0;
      data[k + 1] = asMid ? cap : 0;
      // mid validity: the sea's test is trusted both ways; the
      // land's (the column's free air for a skin the theme does not
      // measure, at the 0.30 threshold) only where it FOUND cloud -
      // a land "clear" adds nothing and removes nothing
      data[k + 2] = water || asMid || c === CLS.high ? 1 : 0;
      data[k + 3] = water ? 1 : 0; // low measured over water only
      if (c === CLS.high) highN++;
      if (asMid) midN++;
    }
  return {
    data,
    rm,
    lowToMid,
    highFrac: measuredN ? highN / measuredN : null,
    midDeckFrac: measuredN ? midN / measuredN : null
  };
}

/**
 * The whole instrument on one mosaic - what the page and the gate
 * both run. Returns the field, the reference, the stats within 100
 * and 30 km and the deck field.
 */
export function goesPanel({
  dec,
  win,
  elevM,
  i0,
  j0,
  ww,
  wh,
  tSkinC,
  rows,
  latDeg,
  lonDeg,
  metar = null,
  landReference = true,
  sat = SATELLITES[0],
  // the foundation-SST anomaly field over the window (147th pass):
  // {anomK, baseC, coveredN, minK, maxK, time} from sstAnomalyField
  sst = null
}) {
  const vz = viewZenithDeg(latDeg, lonDeg, sat.lonDeg);
  const ref = clearSkyReference({
    tSkinC,
    rows,
    viewZenithDeg: vz,
    bandUm: sat.bandUm
  });
  const trop = coldPoint(rows);
  if (!trop) return null;
  const perPixel = !!(sst && sst.anomK && sst.baseC !== null && sst.coveredN);
  const refAt = perPixel
    ? referenceAtFactory({
        anomK: sst.anomK,
        tSkinC,
        rows,
        viewZenithDeg: vz,
        bandUm: sat.bandUm
      })
    : null;
  const field = classifyField({
    bt: dec.bt,
    w: dec.w,
    i0,
    j0,
    ww,
    wh,
    elevM,
    tClrC: ref.tClrC,
    tSkinC,
    tTropC: trop.tC,
    tropHm: trop.hM,
    rows,
    landReference,
    refAt
  });
  field.btAt = (q) => {
    const i = q % ww;
    const j = (q - i) / ww;
    return dec.bt[(j0 + j) * dec.w + (i0 + i)];
  };
  const cx = win.px - i0;
  const cy = win.py - j0;
  const pxPerKm = 1000 / win.mppM;
  const closure = fieldClosure(field, cx, cy, 100 * pxPerKm);
  const r100 = fieldStats(field, cx, cy, 100 * pxPerKm);
  const r30 = fieldStats(field, cx, cy, 30 * pxPerKm);
  const sectors = sectorCensus(field, cx, cy, 100 * pxPerKm);
  const deck = deckField(field, cx, cy, win.halfPx, {metar});
  // the decks' tops: the low deck's from the field's own heights;
  // the mid deck's from its mid pixels plus, when the ceilometer
  // handed the "low" pixels over, THOSE pixels re-placed by the
  // profile lookup WITHOUT the inversion rule (the rule assumed a
  // water cloud in the inversion; the ceilometer says otherwise)
  const med = (a) => {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
  };
  const midTops = [];
  const lowTops = [];
  for (let q = 0; q < ww * wh; q++) {
    const c = field.cls[q];
    if (c === CLS.mid) midTops.push(field.topM[q]);
    else if (c === CLS.low) {
      if (deck.lowToMid)
        midTops.push(heightOfTemperature(rows, field.btAt(q), trop.hM));
      else if (field.water[q]) lowTops.push(field.topM[q]);
    }
  }
  deck.midTopM = med(midTops);
  deck.lowTopM = med(lowTops);
  const oq = Math.floor(cy) * ww + Math.floor(cx);
  return {
    satellite: sat,
    viewZenithDeg: vz,
    reference: ref,
    tropopause: trop,
    inversion: field.inversion,
    thresholdBtC: btAtEtrop(ETROP_THRESH.ocean, ref.tClrC, trop.tC),
    field,
    r100,
    r30,
    sectors,
    deck,
    observer: {
      btC: field.btAt(oq),
      water: field.water[oq] === 1,
      cls: field.cls[oq],
      eps: field.eps[oq],
      topM: field.topM[oq]
    },
    warmClosureK: r100.warmP95C === null ? null : r100.warmP95C - ref.tClrC,
    // the same closure against each pixel's own reference (the
    // point closure when no SST field rides the window)
    closure,
    sst: perPixel
      ? {
          time: sst.time ?? null,
          baseC: sst.baseC,
          coveredN: sst.coveredN,
          minK: sst.minK,
          maxK: sst.maxK
        }
      : null,
    // the column's own ISCCP boundaries, for the line
    isccpM: {
      lowTopM: heightOfPressure(rows, ISCCP_LOW_HPA),
      highBaseM: heightOfPressure(rows, ISCCP_HIGH_HPA)
    }
  };
}

// ---------------------------------------------------------------
// A PNG reader for the node side (freeze and gate): 8-bit RGB, RGBA
// and palette PNGs without interlace - the GIBS and terrarium tiles.
// The page decodes through the canvas instead.
// ---------------------------------------------------------------
export function decodePngRgba(bytes, inflate) {
  const u32 = (o) =>
    ((bytes[o] << 24) |
      (bytes[o + 1] << 16) |
      (bytes[o + 2] << 8) |
      bytes[o + 3]) >>>
    0;
  let o = 8;
  let w = 0;
  let h = 0;
  let ct = 0;
  let plte = null;
  let trns = null;
  const idat = [];
  while (o < bytes.length) {
    const len = u32(o);
    const typ = String.fromCharCode(
      bytes[o + 4],
      bytes[o + 5],
      bytes[o + 6],
      bytes[o + 7]
    );
    const body = bytes.subarray(o + 8, o + 8 + len);
    if (typ === 'IHDR') {
      w = u32(o + 8);
      h = u32(o + 12);
      ct = bytes[o + 17];
      if (
        bytes[o + 16] !== 8 ||
        bytes[o + 20] !== 0 ||
        ![0, 2, 3, 6].includes(ct)
      )
        throw new Error(
          `png: 8-bit grey/RGB/palette/RGBA, no interlace (depth ${bytes[o + 16]} type ${ct})`
        );
    } else if (typ === 'PLTE') plte = body;
    else if (typ === 'tRNS') trns = body;
    else if (typ === 'IDAT') idat.push(body);
    o += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 1;
  const stride = w * bpp;
  let total = 0;
  for (const b of idat) total += b.length;
  const z = new Uint8Array(total);
  let p = 0;
  for (const b of idat) {
    z.set(b, p);
    p += b.length;
  }
  const raw = inflate(z);
  const out = new Uint8Array(stride * h);
  let prev = new Uint8Array(stride);
  for (let j = 0; j < h; j++) {
    const f = raw[j * (stride + 1)];
    const line = raw.subarray(j * (stride + 1) + 1, (j + 1) * (stride + 1));
    const cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let x = line[i];
      if (f === 1) x = (x + a) & 255;
      else if (f === 2) x = (x + b) & 255;
      else if (f === 3) x = (x + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        x = (x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      } else if (f !== 0) throw new Error('png: bad filter ' + f);
      cur[i] = x;
    }
    out.set(cur, j * stride);
    prev = cur;
  }
  const rgba = new Uint8Array(w * h * 4);
  for (let q = 0; q < w * h; q++) {
    if (ct === 6) rgba.set(out.subarray(q * 4, q * 4 + 4), q * 4);
    else if (ct === 2) {
      rgba[q * 4] = out[q * 3];
      rgba[q * 4 + 1] = out[q * 3 + 1];
      rgba[q * 4 + 2] = out[q * 3 + 2];
      rgba[q * 4 + 3] = 255;
    } else if (ct === 0) {
      rgba[q * 4] = rgba[q * 4 + 1] = rgba[q * 4 + 2] = out[q];
      rgba[q * 4 + 3] = 255;
    } else {
      const i = out[q];
      rgba[q * 4] = plte[i * 3];
      rgba[q * 4 + 1] = plte[i * 3 + 1];
      rgba[q * 4 + 2] = plte[i * 3 + 2];
      rgba[q * 4 + 3] = trns && i < trns.length ? trns[i] : 255;
    }
  }
  return {w, h, rgba, colorType: ct};
}

// The colormap XML -> the same [r, g, b, lo, hi] rows this module
// vendors (the freeze compares them).
export function parseColormapXml(xml) {
  const out = [];
  for (const m of xml.matchAll(
    /<ColorMapEntry rgb="(\d+),(\d+),(\d+)"([^>]*)\/>/g
  )) {
    const sv = /sourceValue="\(([-\d.]+|-INF),([-\d.]+|\+INF)[\])]"/.exec(m[4]);
    if (!sv) continue;
    out.push([
      +m[1],
      +m[2],
      +m[3],
      sv[1] === '-INF' ? null : +sv[1],
      sv[2] === '+INF' ? null : +sv[2]
    ]);
  }
  return out;
}
