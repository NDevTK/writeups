/**
 * satellites.js - the geostationary window-channel satellites the
 * theme reads (146th pass; moved here in the 148th so the daemon
 * can pick a satellite without goesir's physics chain): their
 * stations, GIBS layers and band centres, the view geometry, and
 * the pick by reach. goesir.js re-exports everything here - the
 * table lives once.
 *
 * PRIMARIES READ IN FULL:
 *  - GOES-R Program (goes-r.gov, Mission): "GOES-18 became the
 *    operational GOES West satellite at 137.0 degrees west longitude
 *    on January 4, 2023"; the same site's overview: "GOES East is
 *    located at 75.2 W" with GOES-19 in operational service (the
 *    overview also prints "GOES West is located at 137.2 W",
 *    GOES-17's former station - the GOES-18 sentence is taken).
 *  - JMA (jma.go.jp, Meteorological Satellites): Himawari-9 sits
 *    "35,800 km above the equator at around 140.7 degrees east
 *    longitude"; JMA's AHI band table: band 13 central wavelength
 *    10.4073 um.
 *  - NASA Worldview's layer configuration (wv.json): the GOES-West,
 *    GOES-East and Himawari Band 13 layers all declare the palette
 *    Clean_Longwave_Infrared_Window_Band - one colormap.
 *  - NOAA's operational L2 files (noaa-goes18 open bucket): the
 *    clear-sky mask (ACMC) and cloud top height (ACHAC) files print
 *    the qualified local zenith range [0, 70] degrees in their own
 *    metadata (quantitative_local_zenith_angle_bounds,
 *    local_zenith_angle_bounds) and the platform longitude -137.0.
 */

const RAD = Math.PI / 180;

export const GOES_WEST_LON_DEG = -137.0; // goes-r.gov: GOES-18 since 2023-01-04
export const BAND13_UM = 10.35; // ABI band 13 centre, 10.1-10.6 um
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
// THE REACH: the operational products' own qualified range - the
// ACMC file's quantitative_local_zenith_angle_bounds [0, 70] "local
// zenith angle degree range where good quality clear sky mask data
// is produced" and the ACHAC file's local_zenith_angle_bounds
// [0, 70] (read from OR_ABI-L2-ACMC-M6_G18_s20262481851177 and
// OR_ABI-L2-ACHAC-M6_G18_s20262481846177 on 2026-09-05). The theme
// takes the same 70 deg for every satellite (Himawari's products
// are not read - stated).
export const VIEW_ZENITH_MAX_DEG = 70;

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
