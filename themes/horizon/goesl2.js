/**
 * goesl2.js - NOAA's own operational cloud products on the GOES-R
 * fixed grid (148th pass): the clear-sky mask (ACM: BCM binary,
 * ACM four-level, Cloud_Probabilities) and the cloud top height
 * (ACHA: HT) as the noaa-goes18/19 open buckets serve them, read by
 * hdf5.js, navigated by the PUG's own equations, and cut to the
 * theme's window - the reference the theme's re-implemented ETROP
 * field (goesir.js) closes against.
 *
 * PRIMARIES READ IN FULL:
 *  - GOES-R Series Product Definition and User's Guide (PUG), Volume
 *    5: Level 2+ Products, DCN 7035538 Revision G.2 (08 March 2019),
 *    paragraph 4.2.8 "Navigation of Image Data": Table 4.2.8 (GRS80
 *    req 6378137 m, 1/f 298.257222096, rpol 6356752.31414 m, e
 *    0.0818191910435, perspective_point_height 35786023 m, H =
 *    42164160 m, lambda0 -75 / -137 / -89.5 deg for East / West /
 *    Test), 4.2.8.1 (x, y -> phi, lambda: a = sin^2 x + cos^2 x
 *    (cos^2 y + req^2/rpol^2 sin^2 y), b = -2 H cos x cos y, c = H^2
 *    - req^2, rs = (-b - sqrt(b^2 - 4ac)) / 2a, sx = rs cos x cos y,
 *    sy = -rs sin x, sz = rs cos x sin y, phi = atan(req^2/rpol^2 sz
 *    / sqrt((H - sx)^2 + sy^2)), lambda = lambda0 - atan(sy / (H -
 *    sx))) with its worked example (GOES-East, y(558) = 0.095340,
 *    x(1539) = -0.024052: a 1.000061039, b -83921070.03, c
 *    1.73714E+15, rs 37116295.87, sx 36937048.73, sy 892635.0779,
 *    sz 3532287.213, phi 33.846162 deg, lambda -84.690932 deg), and
 *    4.2.8.2 (phi, lambda -> y, x through the geocentric latitude
 *    phiC = atan(rpol^2/req^2 tan phi), rC = rpol / sqrt(1 - e^2
 *    cos^2 phiC), sx = H - rC cos phiC cos(lambda - lambda0), sy =
 *    -rC cos phiC sin(lambda - lambda0), sz = rC sin phiC, y =
 *    atan(sz / sx), x = asin(-sy / sqrt(sx^2 + sy^2 + sz^2)); the
 *    visibility test H (H - sx) < sy^2 + req^2/rpol^2 sz^2) with its
 *    example (phiC 0.587623849, rC 6371541.614 back to the same y, x).
 *  - The products' own metadata (read with hdf5.js and h5py from
 *    OR_ABI-L2-ACMC-M6_G18_s20262481851177 and
 *    OR_ABI-L2-ACHAC-M6_G18_s20262481846177 on 2026-09-05): BCM
 *    flag_values [0, 1] = clear_or_probably_clear,
 *    cloudy_or_probably_cloudy; ACM [0..3] = clear, probably_clear,
 *    probably_cloudy, cloudy; DQF 0 good; HT in metres (scale
 *    0.3052037, fill 65535, valid_range [0, 65530]), 10-km pixels
 *    (y: 0.000280 rad) beside the mask's 2-km (0.000056 rad); x/y
 *    scan angles as int16 with scale_factor/add_offset in radians;
 *    quantitative_local_zenith_angle_bounds [0, 70] and
 *    local_zenith_angle_bounds [0, 70] - the products' own reach;
 *    t in seconds since 2000-01-01T12:00:00Z.
 *  - (149th pass) The Cloud and Moisture Imagery Product ATBD,
 *    Enterprise version 4 (Schmit & Gunshor, 13 January 2021), read
 *    in full: the CMI of bands 7-16 is the brightness temperature
 *    from the radiance by the modified Planck function T = (fk2 /
 *    ln(fk1/L + 1) - bc1) / bc2 with the file's own planck_fk1,
 *    planck_fk2, planck_bc1, planck_bc2 (band 13: 10803.30, 1392.74
 *    K, 0.07550 K, 0.99975 for GOES-16; the GOES-18 file prints
 *    10818.40, 1393.39, 0.07725, 0.99974); the NEdT specification
 *    0.1 K at 300 K; DQF 0 good, 1 conditionally usable, 2 out of
 *    range, 3 no value, 4 focal-plane temperature exceeded. The
 *    file (OR_ABI-L2-CMIPC-M6C13_G18_s20262482021177): CMI int16
 *    counts 0..4095, scale_factor 0.06145332 K, add_offset 89.62 K,
 *    _FillValue -1, 199.7-324.1 K over the CONUS scene.
 *  - (149th pass) The Daytime Cloud Optical and Microphysical
 *    Properties (DCOMP) ATBD, Enterprise version 1.2 (Walther &
 *    Straka, 9 October 2020), read in full: COD "the vertical
 *    optical thickness between the top and bottom of an atmospheric
 *    column ... almost independent of wavelength in the visible",
 *    CPS the effective radius (third over second moment of the
 *    droplet distribution); daytime = solar zenith <= 65 deg full
 *    quality, 65-82 degraded; retrieved for the mask's probably
 *    cloudy and cloudy pixels; the LUTs span COD 10^-0.6..10^2.2
 *    (0.25-158.5) and r_eff 10^0.4..10^2.0 um; thick clouds set COD
 *    to the upper bound, thin clouds set REF to the a priori;
 *    requirements COD 2 or 20% (liquid) / 3 or 30% (ice), CPS 4 um /
 *    10 um; validation against MODIS: COD water bias 1.59, precision
 *    4.43; CPS water 3.03 um, 4.3 um. The files
 *    (OR_ABI-L2-CODC/CPSC-M6_G18_s20262482021177): uint16 counts at
 *    scale_factor 0.00244163, fill 65535, valid_range [0, 65530];
 *    day_solar_zenith_angle_bounds [0, 65], twilight [65, 90],
 *    day_algorithm [0, 82]; quantitative_local_zenith_angle_bounds
 *    [0, 65]; the DQF flag_masks 1..512 with their flag_meanings
 *    (DCOMP_FLAGS below), MEASURED against the mask of the same
 *    minute before use.
 *  - (156th pass) The GOES-R ABI Suspended Matter / Aerosol Optical
 *    Depth and Aerosol Size Parameter ATBD, version 4.2 (NOAA NESDIS
 *    STAR, 14 February 2018, 112 pp), read in full: the AOD at 550
 *    nm retrieved by day over dark, clear, snow-free land (bands
 *    0.47, 0.64, 2.25 um - the dark-target relationship) and
 *    glint-free water (0.64, 0.86, 1.61, 2.25 um) from look-up
 *    tables of top-of-atmosphere reflectance for candidate aerosol
 *    models; four quality levels (Table 3-9: no retrieval - cloud,
 *    sea ice, shallow water, sunglint; low - out of the [-0.05, 5]
 *    range, solar zenith > 80 deg, satellite zenith > 60 deg, the
 *    internal cloud or cirrus tests failed, coastal, shallow inland
 *    water, residual > 0.3; medium - adjacent to cloud, adjacent to
 *    snow within 3 px, residual > 0.25, shallow ocean, the mask's
 *    'probably clear'; high - the rest; "the high quality retrievals
 *    are recommended for quantitative applications"); the F&PS
 *    requirement (Table 2-1: accuracy over land 0.06 below 0.04,
 *    0.04 from 0.04 to 0.8, 0.12 above; precision 0.13 / 0.25 /
 *    0.35; over water 0.02 below 0.4, 0.10 above; precision 0.15 /
 *    0.23; 2 km, CONUS every 5 min); the validation (Sec. 4.2: the
 *    MODIS strategy of Ichoku et al. 2002 and Remer et al. 2005 -
 *    AERONET averaged within an hour, the satellite pixels averaged
 *    in a 50 x 50 km box centred on the station, the highest 50% and
 *    lowest 20% of the box screened out, the rest averaged); Table
 *    4-6, GOES-16 ABI high-quality AOD against AERONET (29 April 2017
 *    to 15 January 2018): land bias 0.02 / precision 0.07 below 0.04
 *    (4,591 points), 0.04 / 0.11 from 0.04 to 0.8 (38,694), -0.10 /
 *    0.65 above 0.8 (254 - "may not be statistically robust");
 *    water 0.01 / 0.04 below 0.4 (6,758), -0.003 / 0.11 above (54);
 *    overall land 0.04 / 0.12, water 0.01 / 0.04; the Angstrom
 *    exponent meets its accuracy requirement (0.3) and neither
 *    satellite meets its precision one (0.15). The file
 *    (OR_ABI-L2-AODC-M6_G18_s20262482321178): AOD uint16 at
 *    scale_factor 7.706e-5 from -0.05, fill 65535, valid_range [0,
 *    65530]; DQF 0 high, 1 medium, 2 low, 3 no retrieval (the file's
 *    own flag_meanings); quantitative_local_zenith_angle_bounds [0,
 *    78.5] and quantitative_solar_zenith_angle_bounds [0, 78.5]
 *    (the operational bounds, wider than the ATBD's 60 and 80 for
 *    the low flag - the file's own outrank the print, stated);
 *    sunglint_angle_bounds [0, 36]; AE1/AE2 over water only, held
 *    out (the precision the ATBD says is not met).
 *  - (157th pass) The GOES-R ABI Enterprise Land Surface Temperature
 *    ATBD, version 4 (NOAA NESDIS STAR, 4 June 2020, 77 pp), read in
 *    full: the skin temperature of land from the split window (Eq.
 *    3.5: Ts = C + A1 T11 + A2 (T11 - T12) + A3 e + A4 e (T11 - T12)
 *    + A5 de, the coefficients stratified by day/night, water vapour
 *    and view zenith angle, de = e11 - e12 the emissivity difference
 *    the baseline lacked; "all results assume perfect cloud
 *    detection"); the F&PS requirement (Sec. 2: CONUS 2 km hourly,
 *    213-330 K, accuracy 2.5 K - "conditional with known emissivity,
 *    known atmospheric correction and 80% channel correction; 5 K
 *    otherwise" - precision 2.3 K, LZA < 70); the PQI word (Table
 *    3.7: bits 1-0 quality, 3-2 cloud, 4 input, 5 AOD range, 7-6
 *    surface cover, 9-8 water vapour, 10 emissivity source, 11 view
 *    angle > 55, 12 day (SZA <= 85), 13 thin cirrus, 14 fire; the DQF
 *    the quality alone, Table 3.8); the quality rules (Table 3.9: a
 *    valid LST is HIGH when clear within 55 deg of view with no fire,
 *    the AOD in range and no cirrus, MEDIUM past 55 deg or when the
 *    mask says probably clear, LOW under probably cloudy or with
 *    cirrus, fire or the AOD out of range; nothing under cloud); the
 *    validation (Sec. 4.2: SURFRAD's seven stations, the station LST
 *    from the upwelling and downwelling infrared through the AWG
 *    daily emissivity, matched within 0.02 deg and 1 min, a 3 x 3
 *    cloud screen on the mask, the band-14 texture and the in-situ
 *    30-min downwelling scatter); Table 4.1, GOES-16 enterprise
 *    (14 Dec 2017 - 31 Aug 2019) bias / precision in K: Bondville
 *    1.16 / 2.05 (3,227), Boulder -0.44 / 1.59 (3,161), Desert Rock
 *    -2.63 / 1.84 (3,275), Fort Peck -0.32 / 1.88 (2,937), Goodwin
 *    Creek 1.59 / 1.78 (3,566), Penn State 1.80 / 2.26 (1,995), Sioux
 *    Falls 0.62 / 1.96 (3,460); Table 4.2, GOES-17 (12 Aug 2018 - 31
 *    Aug 2019): Bondville 1.41 / 1.94 (395), Boulder -0.35 / 1.28
 *    (1,375), Desert Rock -2.41 / 1.73 (1,736), Fort Peck -0.81 /
 *    2.20 (1,314), Goodwin Creek 1.18 / 2.41 (383), Penn State 1.78 /
 *    1.61 (134), Sioux Falls 0.71 / 1.40 (376) - "significantly
 *    better than the baseline at the dry sites", Desert Rock's
 *    underestimate 3.5 K reduced by ~1 K. The file
 *    (OR_ABI-L2-LSTC-M6_G18_s20262490201178, 1.4 MB): LST uint16 at
 *    scale_factor 0.0025 K from 190 K, fill 65535, valid_range [9200,
 *    61200] (213-343 K - the file's own, wider above than the
 *    requirement's); DQF 0 high, 1 medium, 2 low, 3 no retrieval
 *    (the file's own flag_meanings, the AOD's four names); PQI
 *    uint16 with 26 flag_values through day_qf (4096) - the cirrus
 *    and fire bits of Table 3.7 are not in the file's flag_meanings
 *    (decoded from the ATBD's bit numbers, stated as such);
 *    quantitative_local_zenith_angle_bounds [0, 55],
 *    retrieval_local_zenith_angle_bounds [0, 85]; the scene's own
 *    mean/min/max/sd and its retrieved and good counts as scalar
 *    datasets in the head.
 *
 * OWNERSHIP: this module owns the navigation, the window cut and
 * the comparison census; the daemon lists and fetches the buckets
 * and hands hdf5.js the bytes; the page compares NOAA's mask with
 * the theme's own field and reports the agreement - the decks keep
 * the theme's field (stated: NOAA's mask is the closure's
 * reference, not the drawing's source).
 */

const RAD = Math.PI / 180;

// The GRS80 ellipsoid and the fixed-grid geometry, from the
// product's goes_imager_projection attributes (PUG Table 4.2.8).
export function fixedGridGeometry(proj) {
  const req = proj.semi_major_axis;
  const rpol = proj.semi_minor_axis;
  const h = proj.perspective_point_height;
  return {
    req,
    rpol,
    H: h + req,
    lon0Deg: proj.longitude_of_projection_origin,
    e: Math.sqrt((req * req - rpol * rpol) / (req * req))
  };
}
// PUG 4.2.8.1: scan angles (x east-west, y north-south, radians) to
// geodetic latitude and longitude (degrees), with the intermediate
// values the PUG prints; null past the earth's limb.
export function fixedGridToLatLon(x, y, g) {
  const {req, rpol, H} = g;
  const cx = Math.cos(x);
  const sx = Math.sin(x);
  const cy = Math.cos(y);
  const sy = Math.sin(y);
  const a =
    sx * sx + cx * cx * (cy * cy + ((req * req) / (rpol * rpol)) * sy * sy);
  const b = -2 * H * cx * cy;
  const c = H * H - req * req;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const rs = (-b - Math.sqrt(disc)) / (2 * a);
  const Sx = rs * cx * cy;
  const Sy = -rs * sx;
  const Sz = rs * cx * sy;
  const latDeg =
    Math.atan(
      ((req * req) / (rpol * rpol)) * (Sz / Math.sqrt((H - Sx) ** 2 + Sy * Sy))
    ) / RAD;
  // the PUG's lambda0 - atan(...) can leave [-180, 180) at the
  // western edge of GOES-West's scene (the antimeridian): wrapped
  let lonDeg = g.lon0Deg - Math.atan(Sy / (H - Sx)) / RAD;
  lonDeg = ((((lonDeg + 180) % 360) + 360) % 360) - 180;
  return {latDeg, lonDeg, a, b, c, rs, sx: Sx, sy: Sy, sz: Sz};
}
// PUG 4.2.8.2: geodetic latitude and longitude (degrees) to scan
// angles (radians); null where the point is not visible from the
// satellite (the PUG's inequality).
export function latLonToFixedGrid(latDeg, lonDeg, g) {
  const {req, rpol, H, e} = g;
  const phi = latDeg * RAD;
  const lam = lonDeg * RAD;
  const lam0 = g.lon0Deg * RAD;
  const phiC = Math.atan(((rpol * rpol) / (req * req)) * Math.tan(phi));
  const rC = rpol / Math.sqrt(1 - e * e * Math.cos(phiC) ** 2);
  const Sx = H - rC * Math.cos(phiC) * Math.cos(lam - lam0);
  const Sy = -rC * Math.cos(phiC) * Math.sin(lam - lam0);
  const Sz = rC * Math.sin(phiC);
  if (H * (H - Sx) < Sy * Sy + ((req * req) / (rpol * rpol)) * Sz * Sz)
    return null;
  return {
    y: Math.atan(Sz / Sx),
    x: Math.asin(-Sy / Math.sqrt(Sx * Sx + Sy * Sy + Sz * Sz)),
    phiC,
    rC,
    sx: Sx,
    sy: Sy,
    sz: Sz
  };
}
// The scan angle of pixel index i on a coordinate variable stored
// as int16 with scale_factor/add_offset (the product's x and y).
export function scanAngle(i, coord) {
  return i * coord.scale + coord.offset;
}
export function indexOfScanAngle(angle, coord) {
  return Math.round((angle - coord.offset) / coord.scale);
}
// The product's time: seconds since 2000-01-01T12:00:00Z (the t
// variable's own units) to an ISO string.
export function productTimeIso(tSeconds) {
  return new Date(Date.UTC(2000, 0, 1, 12) + tSeconds * 1000).toISOString();
}
// The window: the (halfPx x 2 + 1)^2 pixels around the point on a
// product grid - the point's own pixel from the inverse navigation,
// clipped to the scene. Returns the index box and the point's pixel
// or null when the point lies outside the scene.
export function windowBox(latDeg, lonDeg, g, xCoord, yCoord, nx, ny, halfPx) {
  const s = latLonToFixedGrid(latDeg, lonDeg, g);
  if (!s) return null;
  const i = indexOfScanAngle(s.x, xCoord);
  const j = indexOfScanAngle(s.y, yCoord);
  if (i < 0 || j < 0 || i >= nx || j >= ny) return null;
  const i0 = Math.max(0, i - halfPx);
  const j0 = Math.max(0, j - halfPx);
  const i1 = Math.min(nx - 1, i + halfPx);
  const j1 = Math.min(ny - 1, j + halfPx);
  return {i, j, i0, j0, cols: i1 - i0 + 1, rows: j1 - j0 + 1, x: s.x, y: s.y};
}
// The window's values cut from a row-major (ny x nx) array.
export function cutWindow(values, nx, box) {
  const out = new Array(box.rows * box.cols);
  for (let r = 0; r < box.rows; r++)
    for (let c = 0; c < box.cols; c++)
      out[r * box.cols + c] = values[(box.j0 + r) * nx + (box.i0 + c)];
  return out;
}
// The ground size of a pixel at the window's centre, metres, from
// the navigation of its neighbours (the PUG's 2-km and 10-km are
// nadir figures; at the view's slant the pixel stretches).
export function pixelSizeM(box, g, xCoord, yCoord) {
  const p0 = fixedGridToLatLon(
    scanAngle(box.i, xCoord),
    scanAngle(box.j, yCoord),
    g
  );
  const px = fixedGridToLatLon(
    scanAngle(box.i + 1, xCoord),
    scanAngle(box.j, yCoord),
    g
  );
  const py = fixedGridToLatLon(
    scanAngle(box.i, xCoord),
    scanAngle(box.j + 1, yCoord),
    g
  );
  if (!p0 || !px || !py) return null;
  const mLat = 111320;
  const mLon = 111320 * Math.cos(p0.latDeg * RAD);
  const dx = Math.hypot(
    (px.lonDeg - p0.lonDeg) * mLon,
    (px.latDeg - p0.latDeg) * mLat
  );
  const dy = Math.hypot(
    (py.lonDeg - p0.lonDeg) * mLon,
    (py.latDeg - p0.latDeg) * mLat
  );
  return {ewM: dx, nsM: dy};
}
// Which product pixel a lat/lon falls in, on a window: the index
// into the window's arrays or -1.
export function windowIndexOf(latDeg, lonDeg, g, xCoord, yCoord, box) {
  const s = latLonToFixedGrid(latDeg, lonDeg, g);
  if (!s) return -1;
  const i = indexOfScanAngle(s.x, xCoord) - box.i0;
  const j = indexOfScanAngle(s.y, yCoord) - box.j0;
  if (i < 0 || j < 0 || i >= box.cols || j >= box.rows) return -1;
  return j * box.cols + i;
}
// The mask's census over a window: NOAA's BCM (0 clear-or-probably,
// 1 cloudy-or-probably) and ACM (0..3) with DQF 0 (good) only.
export const BCM_MEANINGS = [
  'clear_or_probably_clear',
  'cloudy_or_probably_cloudy'
];
export const ACM_MEANINGS = [
  'clear',
  'probably_clear',
  'probably_cloudy',
  'cloudy'
];
export function maskCensus(bcm, acm, dqf) {
  const c = {n: bcm.length, good: 0, cloudy: 0, acm: [0, 0, 0, 0]};
  for (let q = 0; q < bcm.length; q++) {
    if (dqf && dqf[q] !== 0) continue;
    if (bcm[q] !== 0 && bcm[q] !== 1) continue;
    c.good++;
    if (bcm[q] === 1) c.cloudy++;
    if (acm && acm[q] >= 0 && acm[q] <= 3) c.acm[acm[q]]++;
  }
  c.cloudFrac = c.good ? c.cloudy / c.good : null;
  return c;
}
// The agreement between the theme's classification of its own
// window pixels and NOAA's mask at the same places: each theme
// pixel (its lat/lon and whether the theme called it cloud, or
// null where the theme did not measure) looked up in NOAA's window.
// Returns the contingency counts over the pixels both measured.
export function maskAgreement(themePixels, noaa) {
  const {g, xCoord, yCoord, box, bcm, dqf} = noaa;
  const t = {n: 0, bothCloud: 0, bothClear: 0, themeOnly: 0, noaaOnly: 0};
  for (const p of themePixels) {
    if (p.cloud === null || p.cloud === undefined) continue;
    const q = windowIndexOf(p.latDeg, p.lonDeg, g, xCoord, yCoord, box);
    if (q < 0) continue;
    if (dqf && dqf[q] !== 0) continue;
    if (bcm[q] !== 0 && bcm[q] !== 1) continue;
    t.n++;
    const nc = bcm[q] === 1;
    if (p.cloud && nc) t.bothCloud++;
    else if (!p.cloud && !nc) t.bothClear++;
    else if (p.cloud) t.themeOnly++;
    else t.noaaOnly++;
  }
  t.agreement = t.n ? (t.bothCloud + t.bothClear) / t.n : null;
  return t;
}
// The cloud-top heights over a window: the median of the good,
// non-fill HT pixels (metres).
export function heightCensus(htM, dqf) {
  const h = [];
  for (let q = 0; q < htM.length; q++) {
    if (dqf && dqf[q] !== 0) continue;
    const v = htM[q];
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    h.push(v);
  }
  h.sort((a, b) => a - b);
  return {
    n: h.length,
    medianM: h.length ? h[Math.floor(h.length / 2)] : null,
    p10M: h.length ? h[Math.floor(0.1 * h.length)] : null,
    p90M: h.length
      ? h[Math.min(h.length - 1, Math.floor(0.9 * h.length))]
      : null
  };
}
// The bucket's listing (S3 ListObjectsV2 XML) -> the keys, and the
// latest product file by its start stamp (s + YYYYDDDHHMMSSs) -
// the file name carries the start time, as the PUG's naming states.
export function parseS3Keys(xml) {
  const keys = [];
  const re = /<Key>([^<]+)<\/Key>/g;
  let m;
  while ((m = re.exec(xml))) keys.push(m[1]);
  return keys;
}
export function latestByStart(keys) {
  let best = null;
  for (const k of keys) {
    const m = /_s(\d{14})_/.exec(k);
    if (!m) continue;
    if (!best || m[1] > best.stamp) best = {key: k, stamp: m[1]};
  }
  return best;
}
// The file whose start stamp is nearest a time (ISO or ms), within
// maxMs - so the mask compared with the theme's mosaic is the mask
// of the mosaic's own minute, not the newest one (GIBS's tiles lag
// the bucket by tens of minutes to hours - measured 2 h 12 min on
// 2026-09-05 at 20:05Z). Returns {key, stamp, offsetMs} or null.
export function nearestByStart(keys, at, maxMs = 15 * 60e3) {
  const t = typeof at === 'string' ? Date.parse(at) : at;
  if (!Number.isFinite(t)) return null;
  let best = null;
  for (const k of keys) {
    const m = /_s(\d{14})_/.exec(k);
    if (!m) continue;
    const off = Date.parse(stampToIso(m[1])) - t;
    if (Math.abs(off) > maxMs) continue;
    if (!best || Math.abs(off) < Math.abs(best.offsetMs))
      best = {key: k, stamp: m[1], offsetMs: off};
  }
  return best;
}
// The day-of-year/hour prefix a bucket lists under, UTC.
export function bucketPrefix(product, date) {
  const y = date.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const doy = Math.floor((date.getTime() - start) / 86400e3) + 1;
  const hh = date.getUTCHours();
  return `${product}/${y}/${String(doy).padStart(3, '0')}/${String(hh).padStart(2, '0')}/`;
}
// The start stamp's time: YYYYDDDHHMMSS(tenths) -> ISO.
export function stampToIso(stamp) {
  const y = +stamp.slice(0, 4);
  const doy = +stamp.slice(4, 7);
  const hh = +stamp.slice(7, 9);
  const mm = +stamp.slice(9, 11);
  const ss = +stamp.slice(11, 13);
  return (
    new Date(Date.UTC(y, 0, doy, hh, mm, ss)).toISOString().slice(0, 19) + 'Z'
  );
}
// The buckets by satellite (the operators' open S3 buckets on the
// NOAA Open Data Dissemination program): GOES-West is GOES-18,
// GOES-East GOES-19; Himawari's products are not on AWS in this
// form (stated).
export const L2_BUCKETS = {
  'goes-west': 'noaa-goes18',
  'goes-east': 'noaa-goes19'
};
// The products the daemon reads (149th pass adds the imagery band
// 13 - the brightness temperature itself, 2 km - and DCOMP's
// daytime optical depth and particle size, both 2 km).
export const L2_PRODUCTS = {
  mask: 'ABI-L2-ACMC',
  height: 'ABI-L2-ACHAC',
  imagery: 'ABI-L2-CMIPC',
  cod: 'ABI-L2-CODC',
  cps: 'ABI-L2-CPSC',
  // the 151st pass: the sea surface (skin) temperature - full disk
  // only (no CONUS SST product), hourly, 2 km, 32 MB a file, read
  // by HTTP range (its window costs ~1 MB)
  sst: 'ABI-L2-SSTF',
  // the 161st pass: the cloud top phase (CONUS every 5 min, 2 km,
  // day and night; 0.5 MB a file, its window a few tens of kB)
  phase: 'ABI-L2-ACTPC',
  // the 162nd pass: the fire / hot spot characterization (CONUS every
  // 5 min, 2 km, day and night; 0.3 MB a file)
  fire: 'ABI-L2-FDCC',
  // the 163rd pass: the total precipitable water (CONUS every 5 min,
  // 10 km, day and night; 0.3 MB a file)
  tpw: 'ABI-L2-TPWC',
  // the rain (164th): the rainfall rate / QPE, full disk every 10 min
  rain: 'ABI-L2-RRQPEF',
  // the haze's kind (169th): the aerosol detection - smoke and dust
  // flags, CONUS every 10 min, 2 km, daytime; 0.8 MB a file
  adp: 'ABI-L2-ADPC',
  // the column from orbit (171st): the legacy temperature and moisture
  // profiles, 101 levels on the 10-km grid, CONUS every 5 min, day and
  // night; 9.7 MB a file, a point's column one 200-kB chunk
  lvt: 'ABI-L2-LVTPC',
  lvm: 'ABI-L2-LVMPC',
  // the 152nd pass: the downward shortwave radiation at the surface
  // (0.2-4.0 um, direct + diffuse, W/m2) - full disk only, every 10
  // min, 2 km (the Enterprise SRB algorithm: Laszlo, Kim & Liu, ATBD
  // v5.0 EPS 2.0, 2020 - read in full), 40 MB a file, its window
  // ~1.4 MB by range
  dsr: 'ABI-L2-DSRF',
  // the 153rd pass: the derived motion winds - not a grid but a list
  // of vectors: features (cloud edges; in clear sky the moisture
  // gradients of the water-vapour bands) tracked through three
  // sequential images 5 min apart, the height the median cloud-top
  // pressure of the tracked cluster (the DMW ATBD v4.4, Daniels,
  // Bailey & Bresky, 2025, read in full); CONUS every 15 min, one
  // file per band, band 14 (11.2 um) day and night, ~38 km between
  // vectors; 0.3 MB a file, read whole in one range
  dmw: 'ABI-L2-DMWC',
  // the 156th pass: the aerosol optical depth at 550 nm (the AOD
  // ATBD v4.2, read in full) - CONUS every 5 min, 2 km, retrieved
  // by day over dark land and glint-free water; the files run all
  // night with nothing retrieved (listed at 06Z, measured); 8.3 MB
  // a file, the window ~0.4 MB by range
  aod: 'ABI-L2-AODC',
  // the 157th pass: the land surface (skin) temperature (the
  // Enterprise LST ATBD v4, read in full) - CONUS hourly, 2 km, day
  // and night, quantitative to 55 deg of local zenith (the file's
  // own bound); 1.4 MB a file, the window ~0.6 MB by range
  lst: 'ABI-L2-LSTC'
};
// The DSR file's own flag meanings (DQF flag_values 0..1): the
// ATBD's overall quality flag is 1 when the solar or local zenith
// angle exceeds 70 degrees, the cloud mask's quality is degraded,
// the flux falls outside 0-1500 W/m2, or the retrieval failed.
export const DSR_DQF_MEANINGS = [
  'good_quality_qf',
  'degraded_quality_or_invalid_qf'
];
// The ATBD's own numbers (Tables 2-1, 4-10, 4-11; Fig. 4-9): the
// requirement and the measured accuracy/precision of DSR from ABI
// against SURFRAD/SOLRAD ground stations in 50-km squares - the
// figure to read a single 2-km pixel's value with, stated on the
// line (the ATBD: a pixel and a pyranometer's hemisphere are
// spatially incompatible at the instant; average in space).
export const DSR_ATBD = {
  accuracyPct: 2, // "about 2%" overall, ABI six months
  precisionPct: 17, // "17%", 74 W/m2 overall
  precisionWm2: 74,
  accuracyWm2: 10,
  requirementWm2: {low: 110, mid: 65, high: 85}, // <200, 200-500, >500
  quantitativeSzaDeg: 70
};
// The SST file's own flag meanings (DQF flag_values 0..3, read from
// OR_ABI-L2-SSTF-M6_G18_s20262482000212...nc): only 0 is a
// retrieval to use; 1 is degraded (kept, counted apart).
export const SST_DQF_MEANINGS = [
  'good_quality_qf',
  'degraded_quality_qf',
  'severely_degraded_quality_qf',
  'invalid_due_to_unprocessed_qf'
];
// THE MEASURED MOTION (153rd pass): the derived motion winds' band
// (the DMWC prefix lists a file per band - C02, C07, C08, C09, C10,
// C14; the 11.2 um window band runs day and night), the ATBD's
// three layers (Sec. 3.4.2's per-layer statistics, the file's own
// atmospheric_layer_pressure_bounds), the file's own flag meanings
// (DQF flag_values 0..22 - the CONUS file writes good winds only,
// 7008 of 7008 on 2026-09-05 21:46Z; the codes name why a target
// failed) and the ATBD's own numbers: the requirement (its
// specification table: mean vector difference 7.5 m/s accuracy,
// 4.2 m/s precision, 3-155 m/s, quantitative to 70 degrees LZA)
// and Table 16's GOES-17 band-14 validation against radiosondes
// (Nov 2018 - Nov 2019, the range of its four seasons, by layer -
// the low layer the tightest, the errors growing with height and
// speed, the ATBD's own reading).
export const DMW_BAND = 'C14';
export const DMW_LAYERS = [
  {id: 'high', hPa: [100, 399.9]},
  {id: 'mid', hPa: [400, 699.9]},
  {id: 'low', hPa: [700, 1000]}
];
export const DMW_DQF_MEANINGS = [
  'good_wind_qf',
  'invalid_due_to_max_gradient_below_threshold_qf',
  'invalid_due_to_location_on_earth_limb_qf',
  'invalid_due_to_cloud_amount_below_or_exceeds_threshold_qf',
  'invalid_due_to_median_pressure_retrieval_failure_qf',
  'invalid_due_to_bad_or_missing_brightness_temp_or_reflectance_qf',
  'invalid_due_to_multiple_cloud_layers_qf',
  'invalid_due_to_insufficient_structure_for_reliable_tracking_qf',
  'invalid_due_to_cloud_tracking_correlation_below_threshold_qf',
  'invalid_due_to_u_component_acceleration_exceeds_threshold_qf',
  'invalid_due_to_v_component_acceleration_exceeds_threshold_qf',
  'invalid_due_to_u_and_v_components_acceleration_exceeds_threshold_qf',
  'invalid_due_to_wind_speed_below_threshold_qf',
  'invalid_due_to_day_night_terminator_proximity_below_threshold_qf',
  'invalid_due_to_cloud_height_median_pressure_below_or_exceeds_threshold_qf',
  'invalid_due_to_feature_match_at_search_region_boundary_qf',
  'invalid_due_to_difference_with_forecast_wind_exceeds_threshold_qf',
  'invalid_due_to_difference_in_image_pairs_cloud_height_median_pressure_exceeds_threshold_qf',
  'invalid_due_to_data_needed_for_search_region_unavailable_qf',
  'invalid_due_to_falure_of_quality_indicator_and_expected_error_method_checks_qf',
  'invalid_due_to_missing_data_in_search_region_qf',
  'invalid_due_to_winds_not_found_qf',
  'invalid_due_to_feature_cluster_not_found_qf'
];
export const DMW_ATBD = {
  requirement: {accuracyMs: 7.5, precisionMs: 4.2},
  speedRangeMs: [3, 155],
  lzaQuantitativeDeg: 70,
  lzaGoodDeg: 62, // the file's own retrieval_local_zenith_angle bound
  targetBoxPx: 19, // band 14's target scene (the file's target_box_size)
  imageGapS: 300, // CONUS: three images 5 min apart (seconds_between_images)
  // Table 16, GOES-17 LWIR (11.2 um) vs radiosondes: [winter..fall]
  // range of the accuracy (mean vector difference) and precision
  // (its standard deviation), m/s
  lwirVsRaob: {
    all: {accuracyMs: [4.6, 4.97], precisionMs: [3.02, 3.28]},
    high: {accuracyMs: [4.91, 5.29], precisionMs: [3.14, 3.32]},
    mid: {accuracyMs: [4.35, 5.27], precisionMs: [2.9, 3.53]},
    low: {accuracyMs: [3.52, 3.69], precisionMs: [2.3, 2.46]}
  }
};
// THE MEASURED HAZE (156th pass): the AOD file's own flag meanings
// (DQF flag_values 0..3) and the ATBD's own numbers - the F&PS
// requirement by AOD range and surface (Table 2-1) and Table 4-6's
// GOES-16 validation of the HIGH-quality product against AERONET
// (bias = accuracy, standard deviation = precision, the count of
// matchups), the overall figures of Sec. 4.2, the collocation the
// figures were measured with (a 50 x 50 km box, the highest 50% and
// lowest 20% screened, the rest averaged) and the angle rules of
// the low flag.
export const AOD_DQF_MEANINGS = [
  'high_quality_retrieval_qf',
  'medium_quality_retrieval_qf',
  'low_quality_retrieval_qf',
  'no_retrieval_qf'
];
export const AOD_ATBD = {
  wavelengthNm: 550,
  rangeValid: [-0.05, 5],
  // Table 2-1 (accuracy, precision) and Table 4-6 (bias, sd, n) by
  // AOD range: [upper bound of the range (Infinity for the last),
  // requirement accuracy, requirement precision, measured bias,
  // measured precision, matchups]
  land: [
    {
      below: 0.04,
      reqAccuracy: 0.06,
      reqPrecision: 0.13,
      bias: 0.02,
      precision: 0.07,
      n: 4591
    },
    {
      below: 0.8,
      reqAccuracy: 0.04,
      reqPrecision: 0.25,
      bias: 0.04,
      precision: 0.11,
      n: 38694
    },
    {
      below: Infinity,
      reqAccuracy: 0.12,
      reqPrecision: 0.35,
      bias: -0.1,
      precision: 0.65,
      n: 254
    }
  ],
  water: [
    {
      below: 0.4,
      reqAccuracy: 0.02,
      reqPrecision: 0.15,
      bias: 0.01,
      precision: 0.04,
      n: 6758
    },
    {
      below: Infinity,
      reqAccuracy: 0.1,
      reqPrecision: 0.23,
      bias: -0.003,
      precision: 0.11,
      n: 54
    }
  ],
  overall: {
    land: {bias: 0.04, precision: 0.12},
    water: {bias: 0.01, precision: 0.04}
  },
  validation: {from: '2017-04-29', to: '2018-01-15', craft: 'GOES-16'},
  boxKm: 50, // the collocation box centred on the station
  screenLow: 0.2, // the lowest 20% of the box's AODs screened out
  screenHigh: 0.5, // and the highest 50%
  lowFlagSzaDeg: 80, // the ATBD's low-quality rules (Table 3-9)
  lowFlagLzaDeg: 60,
  aeAccuracyReq: 0.3, // met (Table 4-5)
  aePrecisionReq: 0.15 // not met, by either satellite (Sec. 4.2)
};
// ---------------------------------------------------------------
// THE LAND'S SKIN (157th pass): the Enterprise LST product's own
// flags and the ATBD's printed numbers (the header's entry).
// ---------------------------------------------------------------
// The LST file's DQF flag_meanings (flag_values 0..3): the quality
// alone (Table 3.8) - the AOD's four names.
export const LST_DQF_MEANINGS = [
  'high_quality_retrieval_qf',
  'medium_quality_retrieval_qf',
  'low_quality_retrieval_qf',
  'no_retrieval_qf'
];
// The PQI word's two-bit fields (Table 3.7; the file's flag_meanings
// name the same states)
export const LST_PQI_QUALITY = ['high', 'medium', 'low', 'no retrieval'];
export const LST_PQI_CLOUD = [
  'clear',
  'probably clear',
  'probably cloudy',
  'cloudy'
];
export const LST_PQI_SURFACE = ['land', 'snow/ice', 'inland water', 'coastal'];
export const LST_PQI_WV = [
  'very dry (< 1.5 g/cm²)',
  'dry (1.5–3)',
  'moist (3–4.5)',
  'very moist (≥ 4.5)'
];
/**
 * The PQI word decoded by Table 3.7's bit numbers: {quality, cloud,
 * inputBad, aodOut, surface, waterVapour, emissivityOther, viewLarge,
 * day, cirrus, fire}; null for the fill (65535). The cirrus (bit 13)
 * and fire (bit 14) flags are the ATBD's - the file's own
 * flag_meanings stop at day_qf (bit 12), stated.
 */
export function lstPqi(v) {
  if (!Number.isFinite(v) || v === 65535) return null;
  return {
    quality: v & 3,
    cloud: (v >> 2) & 3,
    inputBad: (v & 16) !== 0,
    aodOut: (v & 32) !== 0,
    surface: (v >> 6) & 3,
    waterVapour: (v >> 8) & 3,
    emissivityOther: (v & 1024) !== 0,
    viewLarge: (v & 2048) !== 0,
    day: (v & 4096) !== 0,
    cirrus: (v & 8192) !== 0,
    fire: (v & 16384) !== 0
  };
}
// The ATBD's numbers: the requirement (Sec. 2), the angle bounds,
// the quality rules (Table 3.9) and the SURFRAD validation of both
// satellites (Tables 4.1 and 4.2: bias, precision, matchups by site).
export const LST_ATBD = {
  units: 'K',
  requirement: {
    accuracyK: 2.5, // conditional (known emissivity, atmospheric correction, 80% channel correction)
    unconditionalK: 5,
    precisionK: 2.3,
    rangeK: [213, 330],
    lzaMaxDeg: 70,
    resolutionKm: 2,
    refreshMin: 60
  },
  quantitativeLzaDeg: 55, // the product's own bound (the file's quantitative_local_zenith_angle_bounds)
  dayMaxSzaDeg: 85, // Table 3.7: day = solar zenith <= 85
  aodInRangeMax: 1, // Table 3.7: the AOD flag's range
  // Table 3.9 by the mask's state for a valid LST: [clear, probably
  // clear, probably cloudy]
  qualityRules: [
    {when: 'thin cirrus', quality: ['low', 'low', 'low']},
    {when: 'AOD out of range', quality: ['low', 'low', 'low']},
    {when: 'fire', quality: ['low', 'low', 'low']},
    {when: 'view angle > 55°', quality: ['medium', 'medium', 'low']},
    {when: 'view angle ≤ 55°', quality: ['high', 'medium', 'low']}
  ],
  matchup: {maxDeg: 0.02, maxMin: 1, cloudBoxPx: 3},
  validation: {
    'GOES-16': {
      from: '2017-12-14',
      to: '2019-08-31',
      table: '4.1',
      sites: [
        {site: 'Bondville', n: 3227, biasK: 1.16, precisionK: 2.05},
        {site: 'Boulder', n: 3161, biasK: -0.44, precisionK: 1.59},
        {site: 'Desert Rock', n: 3275, biasK: -2.63, precisionK: 1.84},
        {site: 'Fort Peck', n: 2937, biasK: -0.32, precisionK: 1.88},
        {site: 'Goodwin Creek', n: 3566, biasK: 1.59, precisionK: 1.78},
        {site: 'Penn State', n: 1995, biasK: 1.8, precisionK: 2.26},
        {site: 'Sioux Falls', n: 3460, biasK: 0.62, precisionK: 1.96}
      ]
    },
    'GOES-17': {
      from: '2018-08-12',
      to: '2019-08-31',
      table: '4.2',
      sites: [
        {site: 'Bondville', n: 395, biasK: 1.41, precisionK: 1.94},
        {site: 'Boulder', n: 1375, biasK: -0.35, precisionK: 1.28},
        {site: 'Desert Rock', n: 1736, biasK: -2.41, precisionK: 1.73},
        {site: 'Fort Peck', n: 1314, biasK: -0.81, precisionK: 2.2},
        {site: 'Goodwin Creek', n: 383, biasK: 1.18, precisionK: 2.41},
        {site: 'Penn State', n: 134, biasK: 1.78, precisionK: 1.61},
        {site: 'Sioux Falls', n: 376, biasK: 0.71, precisionK: 1.4}
      ]
    }
  }
};
/**
 * The span of a satellite's SURFRAD validation (Table 4.1 or 4.2):
 * the matchups, the biases' and precisions' ranges over the seven
 * sites and their matchup-weighted means. The West slot's own table
 * is GOES-17's - the craft that flew it through the validation, not
 * GOES-18 - so a GOES-West view names it as such.
 */
export function lstValidationSpan(craft = 'GOES-16') {
  const v = LST_ATBD.validation[craft] ?? LST_ATBD.validation['GOES-16'];
  let n = 0;
  let sb = 0;
  let sp = 0;
  let bLo = Infinity;
  let bHi = -Infinity;
  let pLo = Infinity;
  let pHi = -Infinity;
  for (const s of v.sites) {
    n += s.n;
    sb += s.n * s.biasK;
    sp += s.n * s.precisionK;
    bLo = Math.min(bLo, s.biasK);
    bHi = Math.max(bHi, s.biasK);
    pLo = Math.min(pLo, s.precisionK);
    pHi = Math.max(pHi, s.precisionK);
  }
  return {
    craft: LST_ATBD.validation[craft] ? craft : 'GOES-16',
    table: v.table,
    from: v.from,
    to: v.to,
    sites: v.sites.length,
    n,
    biasK: [bLo, bHi],
    precisionK: [pLo, pHi],
    meanBiasK: sb / n,
    meanPrecisionK: sp / n
  };
}
// ---------------------------------------------------------------
// THE CLOUD'S PHASE (161st pass): NOAA's cloud top phase
// (ABI-L2-ACTPC: CONUS every 5 min, 2 km, day and night) - the
// Enterprise Cloud Type and Cloud Phase ATBD v3 (Pavolonis, 1 Jun
// 2020, 113 pp; read in full). The phase is derived from the cloud
// type (Table 29): clear; liquid water (a liquid-topped cloud whose
// opaque 11-um cloud temperature exceeds 273 K); supercooled liquid
// water (under 273 K); mixed phase (a high probability of liquid and
// ice near the top); ice (thick ice with infrared optical depth over
// 2, thin ice, multilayered ice); undetermined (bad input). The
// homogeneous-freezing test calls any top at or under 238 K ice (233
// K the spontaneous-freezing temperature of small droplets, Rogers &
// Yau 1989; Korolev et al. 2003 found ice dominant to 238 K). A 3x3
// median filter finishes the type, kept consistent with the mask
// (Sec. 3.4.2.7). Requirement (Table 1): 80% correct classification
// over liquid / solid / supercooled / mixed for clouds of optical
// depth over 1, quantitative to 65 deg local zenith and qualitative
// beyond, precision 1.5 categories. Validation (Tables 40-41,
// SEVIRI against CALIOP, 95,249 cloudy matchups over all seasons,
// the potentially mixed 268-238 K tops set aside): liquid and
// supercooled together 90.48% agreed of 49,642, ice 84.84% of
// 45,607, 87.78% in all; with the optical-depth-over-1 qualifier
// 90.30% of 34,446, 98.44% of 17,597, 93.05% of 52,043. The file's
// QF word (Table 32): bit 0 overall low quality, 1 L1b, 2 a beta
// ratio outside 0.1-10, 3 an ice call on a weak signal (epsilon
// under 0.05), 4 a low surface emissivity mattering, 5 the satellite
// zenith past cos 0.15 (~82 deg).
// ---------------------------------------------------------------
export const PHASE_MEANINGS = [
  'clear_sky',
  'liquid_water',
  'super_cooled_liquid_water',
  'mixed_phase',
  'ice',
  'unknown'
];
export const PHASE_WORDS = [
  'clear',
  'liquid water',
  'supercooled water',
  'mixed phase',
  'ice',
  'undetermined'
];
export const PHASE_QF = {
  low: 1,
  l1b: 2,
  beta: 4,
  weakIce: 8,
  emissivity: 16,
  zenith: 32
};
export const PHASE_ATBD = {
  version: 'Enterprise Cloud Type and Cloud Phase ATBD v3, 2020-06-01',
  requirement: {
    correctFraction: 0.8,
    minOpticalDepth: 1,
    lzaQuantitativeDeg: 65,
    precisionCategories: 1.5
  },
  liquidTopK: 273,
  homogeneousFreezingK: 238,
  spontaneousFreezingK: 233,
  medianFilterPx: 3,
  validation: {
    source: 'SEVIRI vs CALIOP, Tables 40-41',
    matchups: 95249,
    all: {
      liquid: {n: 49642, agree: 0.9048},
      ice: {n: 45607, agree: 0.8484},
      total: {n: 95249, agree: 0.8778}
    },
    thick: {
      liquid: {n: 34446, agree: 0.903},
      ice: {n: 17597, agree: 0.9844},
      total: {n: 52043, agree: 0.9305}
    },
    mixedSetAside: {
      all: 21434,
      thick: 13087,
      tolerableErrorAll: 0.54,
      tolerableErrorThick: 0.72
    }
  }
};
/** The phase's word for a pixel value, or null for the fill. */
export function phaseWords(v) {
  return v >= 0 && v <= 5 ? PHASE_WORDS[v] : null;
}
/** A pixel's quality by the QF word: 'high' (no bit set), else the
 * low-quality reasons named. */
export function phaseQuality(qf) {
  if (!Number.isFinite(qf) || qf === 255) return null;
  const why = [];
  if (qf & PHASE_QF.l1b) why.push('L1b');
  if (qf & PHASE_QF.beta) why.push('beta ratio');
  if (qf & PHASE_QF.weakIce) why.push('weak ice signal');
  if (qf & PHASE_QF.emissivity) why.push('surface emissivity');
  if (qf & PHASE_QF.zenith) why.push('satellite zenith');
  return {high: !(qf & PHASE_QF.low), why};
}
/**
 * The window's census by phase over the high-quality pixels (the
 * overall bit clear): counts per category, the cloudy total, the
 * low-quality and fill counts, and the ice and water shares of the
 * cloudy pixels (liquid + supercooled + mixed count as water-topped
 * for the corona's purposes, stated).
 */
export function phaseCensus(phase, dqf) {
  const c = {
    n: phase.length,
    clear: 0,
    liquid: 0,
    supercooled: 0,
    mixed: 0,
    ice: 0,
    unknown: 0,
    low: 0,
    fill: 0
  };
  for (let q = 0; q < phase.length; q++) {
    const v = phase[q];
    if (v === 255 || v === undefined) {
      c.fill++;
      continue;
    }
    const qf = dqf ? dqf[q] : 0;
    if (qf === 255 || qf & PHASE_QF.low) {
      c.low++;
      continue;
    }
    if (v === 0) c.clear++;
    else if (v === 1) c.liquid++;
    else if (v === 2) c.supercooled++;
    else if (v === 3) c.mixed++;
    else if (v === 4) c.ice++;
    else c.unknown++;
  }
  const cloudy = c.liquid + c.supercooled + c.mixed + c.ice;
  return {
    ...c,
    cloudy,
    iceFrac: cloudy ? c.ice / cloudy : null,
    waterFrac: cloudy ? (c.liquid + c.supercooled + c.mixed) / cloudy : null
  };
}
// ---------------------------------------------------------------
// THE HAZE'S KIND (169th pass): NOAA's aerosol detection (ABI-L2-ADPC:
// CONUS every 10 min, 2 km, daytime) - the Enterprise Aerosol
// Detection Product ATBD v1.0 (Ciren & Kondragunta, 1 Oct 2020, 87
// pp; read in full). Two binary flags a pixel, smoke and dust, from
// threshold tests on the reflectances at 0.47, 0.64, 0.86, 1.38, 1.61
// and 2.25 um and the brightness temperatures at 3.9, 10.3, 11.2 and
// 12.3 um. DUST absorbs more at 12 um than at 11 (Sec. 3.5.1: the
// split window BT11 - BT12 at or under 0.4 K thin and under -0.4 K
// thick over land, with BT3.9 - BT11 against towering cumulus and the
// 1.38-um reflectance under 0.055 against cirrus, MNDVI against the
// surface; over water BT3.9 - BT10.3 in 3-10 K thin and over 20 K
// thick with NDVI in -0.3..0.05) and looks brown (0.47/0.64 under
// 1.5). SMOKE is transparent at 2.25 um and bright at 0.64 against the
// surface the 2.25-um band predicts (four NDVI classes, the intercept
// and slope with the Sun's zenith), the Rayleigh term 5.0 x 0.75 x (1
// + cos^2 of the scattering angle), 1.2-1.8 in 0.47/0.64 and 1.0-1.8
// in 0.86/0.64, uniform within 3 x 3 (StdR0.64 at or under 0.04); a
// fire pixel (BT3.9 over 350 K and 10 K over BT11) is smoke by
// assumption; over water the Rayleigh-corrected 0.47/1.61 ratio (6
// thick, 10 thin) with 2.25/1.61 under 0.5-0.7 and the 0.86-um
// uniformity in 0.0025-0.05. Daytime only (solar zenith at or under
// 87 deg), quantitative to 60 deg local zenith, sun glint within 40
// deg excluded over water, a 3 x 3 buddy check (under five of nine
// reverses a call), the confidence from the crucial test's margin
// (under 1% of the threshold low, over 2% high) and low past 60 deg
// solar or 70 deg view zenith. REQUIREMENT (Table 1): binary
// detection above 0.2 optical depth, 80% correct for dust, 80% for
// smoke over land, 70% for smoke over water. VALIDATION on GOES-16
// (Dec 2017 - Oct 2018, Tables 15-16): dust against AERONET 98.5%
// accuracy, 88.4% of the dust caught, 2.6% false; against CALIPSO
// 99.4 / 87.4 / 24.2; smoke against CALIPSO 99.6 / 94.5 / 18.1,
// against AERONET 95.4 / 87.4 / 22.4. The AERONET matchup's own rule
// (Sec. 5.1.2): within 25 km of the site, 80% of the pixels cloud-,
// snow- and glint-free, the dominant type the type of more than half
// the valid retrievals. LIMITS (Sec. 7): daytime only, smoke over
// land on dark surfaces, thin aerosol not optimal, co-existing types
// untested. THE FILE (measured 2026-09-06, GOES-19 20:01Z): Smoke,
// Dust, Cloud and SnowIce int8 0/1 with fill -128; DQF uint16 with a
// two-bit confidence per type (bits 0-1 ash, 2-3 smoke, 4-5 dust, 6-7
// none/unknown/clear: 0 high, 1 medium, 2 low, 3 bad or missing, fill
// 65535); PQI2's bits 1 (within sun glint), 2 (land), 3 (night); the
// CONUS scene 624 smoke and 3,089 dust pixels of 3.7 million.
// ---------------------------------------------------------------
export const ADP_ATBD = {
  version: 'Enterprise Aerosol Detection Product ATBD v1.0, 2020-10-01',
  requirement: {
    aodThreshold: 0.2,
    dust: 0.8,
    smokeLand: 0.8,
    smokeWater: 0.7,
    refreshMin: 15,
    lzaQuantitativeDeg: 60,
    szaDayDeg: 87,
    glintDeg: 40,
    buddyMin: 5,
    resolutionKm: 2
  },
  confidence: {lowSzaDeg: 60, lowVzaDeg: 70, marginLow: 0.01, marginHigh: 0.02},
  dust: {
    thinBtdK: 0.4,
    thickBtdK: -0.4,
    cirrusR138: 0.055,
    waterThinBtd39K: [3, 10],
    waterThickBtd39K: 20
  },
  smoke: {
    fireBt39K: 350,
    fireBtdK: 10,
    r1: [1.2, 1.8],
    r2: [1.0, 1.8],
    stdR064: 0.04,
    waterR3Thick: 6,
    waterR3Thin: 10
  },
  matchup: {radiusKm: 25, coverageMin: 0.8, dominantFrac: 0.5},
  validation: {
    period: '2017-12-14 to 2018-10-13, GOES-16',
    dust: {
      aeronet: {
        tp: 6540,
        fp: 173,
        fn: 883,
        tn: 57439,
        accuracy: 0.985,
        pocd: 0.884,
        pofd: 0.026
      },
      calipso: {
        tp: 4612,
        fp: 1476,
        fn: 667,
        tn: 488749,
        accuracy: 0.994,
        pocd: 0.874,
        pofd: 0.242
      }
    },
    smoke: {
      calipso: {
        tp: 794,
        fp: 176,
        fn: 46,
        tn: 1034572,
        accuracy: 0.996,
        pocd: 0.945,
        pofd: 0.181
      },
      aeronet: {
        tp: 2205,
        fp: 6371,
        fn: 3202,
        tn: 289476,
        accuracy: 0.954,
        pocd: 0.874,
        pofd: 0.224
      }
    }
  }
};
// the DQF word's two-bit fields (Table 4; the file's flag_masks)
export const ADP_DQF_SHIFT = {ash: 0, smoke: 2, dust: 4, nuc: 6};
export const ADP_CONFIDENCE_WORDS = ['high', 'medium', 'low', null];
export const ADP_DQF_FILL = 65535;
// the flags on the wire: a byte code 0 absent, 1 present, 255 fill
// (the file's int8 -128 - a byte view reads it as 128; both are the
// fill here)
export const ADP_FLAG_FILL = 255;
export function adpFlagBytes(values) {
  const out = new Uint8Array(values.length);
  for (let q = 0; q < values.length; q++) {
    const v = values[q];
    out[q] =
      v === -128 || v === 128 || v === 255 || !Number.isFinite(v)
        ? 255
        : v === 1
          ? 1
          : 0;
  }
  return out;
}
// PQI2's bits (Table 6)
export const ADP_PQI2 = {glintInternal: 1, withinGlint: 2, land: 4, night: 8};
// the ATBD's 25-km matchup circle on the nominal 2-km grid
export const ADP_RADIUS_PX = 13;
/** The ATBD's accuracy, probability of correct detection and false
 * alarm ratio from a confusion table (Eq. 4.3.1-4.3.3). */
export function adpScores({tp, fp, fn, tn}) {
  return {
    accuracy: (tp + tn) / (tp + fp + fn + tn),
    pocd: tp / (tp + fn),
    pofd: fp / (fp + tp)
  };
}
/** A pixel's confidence for a kind ('smoke' | 'dust' | 'ash' | 'nuc')
 * from the DQF word: 'high', 'medium', 'low', or null when the test
 * did not run (bad or missing) or the word is the fill. */
export function adpConfidence(dqf, kind) {
  if (!Number.isFinite(dqf) || dqf === ADP_DQF_FILL) return null;
  return ADP_CONFIDENCE_WORDS[(dqf >> ADP_DQF_SHIFT[kind]) & 3];
}
/** A pixel's call for a kind: {present, confidence} - present null
 * for the fill; a present flag with a null confidence is a call the
 * ATBD's own quality word disowns (kept, stated). */
export function adpPixel(flag, dqf, kind) {
  if (!Number.isFinite(flag) || flag === ADP_FLAG_FILL)
    return {present: null, confidence: null};
  return {present: flag === 1, confidence: adpConfidence(dqf, kind)};
}
/**
 * The window's census: pixels, fill, night, within glint, land and
 * water (PQI2), and for smoke and dust the retrieved count (the test
 * ran: a non-bad confidence), the present count and its confidence
 * split.
 */
export function adpCensus(smoke, dust, dqf, pqi2 = null) {
  const kind = () => ({
    retrieved: 0,
    present: 0,
    high: 0,
    medium: 0,
    low: 0,
    disowned: 0
  });
  const c = {
    n: smoke.length,
    fill: 0,
    night: 0,
    glint: 0,
    land: 0,
    water: 0,
    smoke: kind(),
    dust: kind()
  };
  for (let q = 0; q < smoke.length; q++) {
    const s = smoke[q];
    const d = dust[q];
    if (s === ADP_FLAG_FILL || d === ADP_FLAG_FILL || s === undefined) {
      c.fill++;
      continue;
    }
    const p2 = pqi2 ? pqi2[q] : 0;
    if (p2 & ADP_PQI2.night) c.night++;
    if (p2 & ADP_PQI2.withinGlint) c.glint++;
    if (p2 & ADP_PQI2.land) c.land++;
    else c.water++;
    const w = dqf ? dqf[q] : ADP_DQF_FILL;
    for (const [k, flag] of [
      ['smoke', s],
      ['dust', d]
    ]) {
      const conf = adpConfidence(w, k);
      const t = c[k];
      if (conf) t.retrieved++;
      if (flag === 1) {
        t.present++;
        if (conf) t[conf]++;
        else t.disowned++;
      }
    }
  }
  return c;
}
/**
 * The ATBD's own matchup rule around a point (Sec. 5.1.2): within
 * radiusPx of (ci, cj) on a cols-wide window, the valid retrievals
 * are the pixels whose smoke or dust test ran outside sun glint; the
 * coverage is their share of the circle's pixels (0.8 required); the
 * dominant type is the type of more than half the valid retrievals,
 * 'none' when neither, 'both' when both (co-existing types the ATBD
 * left untested), null when the coverage falls short (a cloudy or
 * night circle: no call). Counts and the confidence split come with
 * the verdict.
 */
export function adpDominant(
  smoke,
  dust,
  dqf,
  pqi2,
  {cols, rows, ci, cj, radiusPx}
) {
  const r2 = radiusPx * radiusPx;
  let inCircle = 0;
  let valid = 0;
  const s = {present: 0, high: 0, medium: 0, low: 0};
  const d = {present: 0, high: 0, medium: 0, low: 0};
  for (
    let j = Math.max(0, cj - radiusPx);
    j <= Math.min(rows - 1, cj + radiusPx);
    j++
  ) {
    for (
      let i = Math.max(0, ci - radiusPx);
      i <= Math.min(cols - 1, ci + radiusPx);
      i++
    ) {
      if ((i - ci) * (i - ci) + (j - cj) * (j - cj) > r2) continue;
      inCircle++;
      const q = j * cols + i;
      const sf = smoke[q];
      const df = dust[q];
      if (sf === ADP_FLAG_FILL || df === ADP_FLAG_FILL || sf === undefined)
        continue;
      const p2 = pqi2 ? pqi2[q] : 0;
      if (p2 & ADP_PQI2.withinGlint) continue;
      const w = dqf ? dqf[q] : ADP_DQF_FILL;
      const cs = adpConfidence(w, 'smoke');
      const cd = adpConfidence(w, 'dust');
      if (!cs && !cd) continue;
      valid++;
      if (sf === 1) {
        s.present++;
        if (cs) s[cs]++;
      }
      if (df === 1) {
        d.present++;
        if (cd) d[cd]++;
      }
    }
  }
  const coverage = inCircle ? valid / inCircle : 0;
  const enough = coverage >= ADP_ATBD.matchup.coverageMin;
  const half = valid * ADP_ATBD.matchup.dominantFrac;
  const smokeDom = enough && s.present > half;
  const dustDom = enough && d.present > half;
  return {
    inCircle,
    valid,
    coverage,
    enough,
    smoke: s,
    dust: d,
    smokeFrac: valid ? s.present / valid : null,
    dustFrac: valid ? d.present / valid : null,
    dominant: !enough
      ? null
      : smokeDom && dustDom
        ? 'both'
        : smokeDom
          ? 'smoke'
          : dustDom
            ? 'dust'
            : 'none'
  };
}
/**
 * The measured kind over the model's split: a dominant dust call makes
 * dust the majority of the species fractions (at least floor, the
 * others scaled to fit); a dominant smoke call does the same for the
 * fine absorbing pair (organic + black carbon, keeping their ratio,
 * organic alone when the model has neither); 'both', 'none' and null
 * leave the split alone. Returns {fractions, changed, from, to}.
 */
export const ADP_CALLED_FLOOR = 0.6;
export function adpReweight(fractions, dominant, floor = ADP_CALLED_FLOOR) {
  const f = {...(fractions || {})};
  const keys = Object.keys(f);
  const sum = keys.reduce((a, k) => a + Math.max(f[k] ?? 0, 0), 0);
  if (
    !(dominant === 'dust' || dominant === 'smoke') ||
    !keys.length ||
    !(sum > 0)
  )
    return {fractions: f, changed: false, from: null, to: null};
  const group = dominant === 'dust' ? ['dust'] : ['organic', 'blackCarbon'];
  const gSum = group.reduce((a, k) => a + Math.max(f[k] ?? 0, 0), 0);
  const gShare = gSum / sum;
  if (gShare >= floor)
    return {fractions: f, changed: false, from: gShare, to: gShare};
  const target = floor * sum;
  const restKeys = keys.filter((k) => !group.includes(k));
  const restSum = restKeys.reduce((a, k) => a + Math.max(f[k] ?? 0, 0), 0);
  const restScale = restSum > 0 ? (sum - target) / restSum : 0;
  const out = {};
  for (const k of restKeys) out[k] = Math.max(f[k] ?? 0, 0) * restScale;
  if (gSum > 0)
    for (const k of group) out[k] = (Math.max(f[k] ?? 0, 0) / gSum) * target;
  else {
    out[group[0]] = target;
    for (const k of group.slice(1)) out[k] = 0;
  }
  return {fractions: out, changed: true, from: gShare, to: floor};
}
// ---------------------------------------------------------------
// THE COLUMN FROM ORBIT (171st pass): NOAA's legacy vertical
// temperature and moisture profiles (ABI-L2-LVTPC and LVMPC: CONUS
// every 5 min - measured, the requirement says 30 - 10 km, day and
// night, clear fields of regard) - the Enterprise Legacy Soundings
// ATBD v3.1 (Li, Schmit, Jin, Martin, Li 2019, read in full in the
// 163rd for the column's water; its profile requirements here). A
// regression first guess from the ABI's infrared bands and the NWP
// forecast, then a physical retrieval on the 101 RTTOV pressure
// levels (1100 to 0.005 hPa), over a 5 x 5 field of regard of 2-km
// pixels of which a fifth must be clear. REQUIREMENT (Tables 1.1-1.2):
// "inherent vertical resolution is only 3 to 5 km"; temperature to 1
// K (precision 2 K) below 400 hPa AND above the boundary layer;
// relative humidity to 18% from the surface to 300 hPa and 20% from
// 300 to 100; quantitative to 67 deg local zenith; the temperature
// useful below 100 hPa only, the humidity below 300 hPa only (Table
// 7); the skin temperature retrieved over land only. So the satellite
// says what the balloon says ABOVE the boundary layer - the freezing
// level, the contrail criterion's levels, the cold gate's 250 hPa, the
// infrared reference's water and warmth aloft - and nothing of the
// surface layer the mirages live in: that stays the balloon's or
// nobody's, stated. THE FILE (measured 2026-09-06): LVT (300 x 500 x
// 101) uint16 K at 0.00236533 from 165 K, LVM the same shape as a
// FRACTION of relative humidity at 1.526e-5 (the units attribute says
// percent; the counts top out at 1.0), fill 65535; chunks of two rows
// by the full width by all levels, so a point's column is one chunk;
// DQF_Overall 0-10, DQF_Retrieval 0-5 (fill 255 where nothing was
// retrieved), DQF_SkinTemp 0-2; at 20:51Z 73,949 of 150,000 fields of
// regard good, 71,942 invalid for cloud.
// ---------------------------------------------------------------
import {eLiq} from './contrails.js';
export const LAP_ATBD = {
  version: 'Enterprise Legacy Soundings ATBD v3.1, 2019-11-01',
  requirement: {
    tAccuracyK: 1,
    tPrecisionK: 2,
    tAccuracyBelowHpa: 400,
    rhAccuracyPct: {surfaceTo500: 18, to300: 18, to100: 20},
    verticalResolutionKm: [3, 5],
    horizontalKm: 10,
    lzaQuantitativeDeg: 67,
    clearFraction: 0.2,
    levels: 101,
    tUsefulBelowHpa: 100,
    rhUsefulBelowHpa: 300,
    refreshMinConus: 30
  }
};
export const LAP_DQF_OVERALL = [
  'good',
  'invalid: not geolocated or past the retrieval zenith',
  'degraded: latitude threshold',
  'degraded: quantitative zenith threshold',
  'invalid: insufficient clear pixels in the field of regard',
  'invalid: missing NWP',
  'invalid: missing L1b or a fatal error',
  'invalid: bad NWP surface pressure index',
  'invalid: indeterminate land emissivity',
  'invalid: bad TPW sigma level',
  'invalid: not a number'
];
export const LAP_DQF_RETRIEVAL = [
  'good',
  'nonconvergent',
  'brightness temperature residual past the threshold',
  'incomplete convergence',
  'unrealistic value',
  'invalid radiative-transfer brightness temperature'
];
export const LAP_FILL = 65535;
export const LAP_RD = 287.053;
export const LAP_G = 9.80665;
/** A field of regard's usability from its two flags: good (0), degraded
 * (2, 3: past the latitude or the quantitative zenith - the retrieval
 * ran), else invalid; the words say why. */
export function lapQuality(overall, retrieval) {
  const o = Number.isFinite(overall) && overall !== 255 ? overall : null;
  const r = Number.isFinite(retrieval) && retrieval !== 255 ? retrieval : null;
  const usable = o === 0 || o === 2 || o === 3;
  return {
    usable,
    degraded: o === 2 || o === 3,
    overall: o,
    retrieval: r,
    words:
      (o === null ? 'no flag' : (LAP_DQF_OVERALL[o] ?? `flag ${o}`)) +
      (r !== null && r !== 0
        ? `; ${LAP_DQF_RETRIEVAL[r] ?? `retrieval flag ${r}`}`
        : '')
  };
}
/** The standard atmosphere's pressure (hPa) at a height (m): the
 * surface the satellite column stands on where the page carries no
 * measured pressure - a 10-hPa error moves every height 80 m,
 * nothing against the ATBD's 3-5 km resolution, stated. */
export function isaPressureHpa(zM) {
  return (
    1013.25 * Math.pow(Math.max(1 - 2.25577e-5 * (zM || 0), 0.01), 5.25588)
  );
}
/** Specific humidity (kg/kg) from the vapour pressure and the pressure
 * (both Pa): the usual 0.622 e / (p - 0.378 e). */
export function specificHumidity(ePa, pPa) {
  return (0.622 * ePa) / Math.max(pPa - 0.378 * ePa, 1);
}
/** The dew point (C) whose Murphy-Koop saturation pressure is ePa: a
 * bisection on the theme's own eLiq (monotonic in T). */
export function dewPointC(ePa) {
  if (!(ePa > 0)) return null;
  let lo = 150;
  let hi = 340;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (eLiq(mid) > ePa) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2 - 273.15;
}
/** T (K) and RH (fraction) interpolated linearly in ln p between two
 * levels. */
const lnInterpLevel = (p, p0, p1, v0, v1) =>
  v0 + ((v1 - v0) * Math.log(p / p0)) / Math.log(p1 / p0);
/**
 * The satellite's column as sounding rows [{p (hPa), hM, tC, tdC, rh
 * (%)}] from the surface upward: the surface row at pSfcHpa and zSfcM
 * (the temperature and humidity interpolated in ln p between the
 * levels that bracket the surface), then every level above it to
 * tUsefulBelowHpa (the ATBD's 100 hPa), the heights by the hypsometric
 * equation on the layer-mean virtual temperature (the specific
 * humidity from the retrieved relative humidity over Murphy-Koop
 * water), the humidity dropped above rhUsefulBelowHpa (the ATBD's 300
 * hPa: null there). pressureHpa descends with the index (1100 first);
 * tK and rhFrac are the physical values with NaN for the fill. null
 * when fewer than four levels are usable.
 */
export function lapColumnRows(
  pressureHpa,
  tK,
  rhFrac,
  {
    pSfcHpa = 1013.25,
    zSfcM = 0,
    tUsefulBelowHpa = LAP_ATBD.requirement.tUsefulBelowHpa,
    rhUsefulBelowHpa = LAP_ATBD.requirement.rhUsefulBelowHpa
  } = {}
) {
  const n = pressureHpa.length;
  // the levels at or above the surface (p <= pSfc) with a finite T
  const idx = [];
  for (let i = 0; i < n; i++)
    if (
      pressureHpa[i] < pSfcHpa &&
      pressureHpa[i] >= tUsefulBelowHpa &&
      Number.isFinite(tK[i])
    )
      idx.push(i);
  if (idx.length < 4) return null;
  // the surface's own values: bracket pSfc between the level below
  // (p > pSfc, the retrieval extrapolates under the ground) and the
  // first level above; without a level below, hold the first above
  const first = idx[0];
  let below = -1;
  for (let i = first - 1; i >= 0; i--)
    if (Number.isFinite(tK[i])) {
      below = i;
      break;
    }
  const rhOf = (i) =>
    Number.isFinite(rhFrac[i]) ? Math.min(Math.max(rhFrac[i], 0), 1) : null;
  const tSfcK =
    below >= 0
      ? lnInterpLevel(
          pSfcHpa,
          pressureHpa[below],
          pressureHpa[first],
          tK[below],
          tK[first]
        )
      : tK[first];
  const rhSfc =
    below >= 0 && rhOf(below) !== null && rhOf(first) !== null
      ? lnInterpLevel(
          pSfcHpa,
          pressureHpa[below],
          pressureHpa[first],
          rhOf(below),
          rhOf(first)
        )
      : rhOf(first);
  const row = (pHpa, hM, tKv, rh) => {
    const rhUse = pHpa >= rhUsefulBelowHpa ? rh : null;
    const ePa = rhUse !== null ? rhUse * eLiq(tKv) : null;
    return {
      p: pHpa,
      hM,
      tC: tKv - 273.15,
      rh: rhUse !== null ? 100 * rhUse : null,
      tdC: ePa !== null && ePa > 0 ? dewPointC(ePa) : null,
      q: ePa !== null ? specificHumidity(ePa, pHpa * 100) : 0
    };
  };
  const rows = [row(pSfcHpa, zSfcM, tSfcK, rhSfc)];
  let z = zSfcM;
  let pPrev = pSfcHpa;
  let tvPrev = tSfcK * (1 + 0.608 * rows[0].q);
  for (const i of idx) {
    const p = pressureHpa[i];
    const r = row(p, 0, tK[i], rhOf(i));
    const tv = tK[i] * (1 + 0.608 * r.q);
    z += ((LAP_RD * (tvPrev + tv)) / 2 / LAP_G) * Math.log(pPrev / p);
    r.hM = z;
    rows.push(r);
    pPrev = p;
    tvPrev = tv;
  }
  return rows;
}
/** The column's precipitable water (mm): the specific humidity
 * integrated over pressure, q dp / g, layer by layer. */
export function lapPwMm(rows) {
  let pw = 0;
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    pw += ((((a.q ?? 0) + (b.q ?? 0)) / 2) * ((a.p - b.p) * 100)) / LAP_G;
  }
  return pw;
}
/** The freezing level (m): the first upward crossing of 0 C, linear in
 * height between the rows; null when the column never freezes (or
 * starts frozen: 0 at the surface, stated by the caller). */
export function lapFreezingLevelM(rows) {
  if (!rows || !rows.length) return null;
  if (rows[0].tC <= 0) return rows[0].hM;
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (a.tC > 0 && b.tC <= 0)
      return a.hM + ((b.hM - a.hM) * a.tC) / (a.tC - b.tC);
  }
  return null;
}
/** The rows' values at a pressure level (hPa), linear in ln p: {tC,
 * rh, tdC, hM}, null outside the column. */
export function lapLevelAt(rows, hPa) {
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (hPa <= a.p && hPa >= b.p) {
      const f = Math.log(hPa / a.p) / Math.log(b.p / a.p);
      const mix = (u, v) => (u === null || v === null ? null : u + f * (v - u));
      return {
        tC: mix(a.tC, b.tC),
        rh: mix(a.rh, b.rh),
        tdC: mix(a.tdC, b.tdC),
        hM: mix(a.hM, b.hM)
      };
    }
  }
  return null;
}
/** The window's census by the overall flag: good, degraded, and the
 * invalid by reason, with the fields of regard whose retrieval ran. */
export function lapCensus(overall, retrieval) {
  const c = {
    n: overall.length,
    good: 0,
    degraded: 0,
    cloud: 0,
    zenith: 0,
    nwp: 0,
    other: 0,
    fill: 0,
    retrieved: 0
  };
  for (let q = 0; q < overall.length; q++) {
    const o = overall[q];
    if (o === 255 || o === undefined) {
      c.fill++;
      continue;
    }
    if (o === 0) c.good++;
    else if (o === 2 || o === 3) c.degraded++;
    else if (o === 4) c.cloud++;
    else if (o === 1) c.zenith++;
    else if (o === 5 || o === 7) c.nwp++;
    else c.other++;
    if (retrieval && retrieval[q] === 0) c.retrieved++;
  }
  return c;
}
/** The usable field of regard nearest the window's centre: the centre
 * itself when usable, else the nearest by distance, else null. */
export function lapNearestUsable(overall, retrieval, {cols, rows, ci, cj}) {
  let best = null;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const q = j * cols + i;
      if (!lapQuality(overall[q], retrieval ? retrieval[q] : null).usable)
        continue;
      const d2 = (i - ci) * (i - ci) + (j - cj) * (j - cj);
      if (!best || d2 < best.d2) best = {q, i, j, d2};
    }
  return best;
}
// ---------------------------------------------------------------
// THE FIRE'S HEAT (162nd pass): NOAA's fire / hot spot
// characterization (ABI-L2-FDCC: CONUS every 5 min, 2 km, day and
// night) - the Enterprise Fire / Hot Spot Characterization ATBD
// v2.7 (Schmidt et al., 31 Oct 2020, 73 pp; read in full): the
// WFABBA heritage, a dynamic multispectral thresholding contextual
// algorithm on the 3.9-um and 11.2-um windows (bands 7 and 14; band
// 2 by day and band 15 when available for cloud screening). A fire
// pixel's 3.9-um brightness temperature must clear 285 K at night,
// 285 + 15 cos(solar zenith) K by day (the reflectivity product's
// threshold 315 / 315 + 5 cos), and stand above its background
// window (expanded until a fifth of it is clear land, to 111 x 111
// pixels) by scaled standard deviations; opaque cloud is called at
// T11.2 < 270 K, T3.9 - T11.2 < -4 K, > 20 K with T3.9 < 285 K, an
// albedo over 0.38 by day, T12.3 <= 265 K; local zenith past 80 deg
// and sun glint or the sub-solar point within 10 deg are blocked
// out; band 7 saturates at 411.86 K, band 14 at 340 K. A modified
// Dozier (1981) solution gives the sub-pixel fire's size and
// temperature (15 bisections then Newton; a fire under 400 K is not
// characterised, 350-400 K may smoulder), and the fire radiative
// power follows the middle-infrared law (Wooster et al. 2003, Eq.
// 3.4): FRP = A_pixel sigma / a (L_MIR - L_background) with a =
// 3.0e-9 W m^-2 sr^-1 um^-1 K^-4, valid for 600-1400 K fires; FRP is
// not reported for saturated, cloud-contaminated or low-probability
// pixels. Codes 10-15 are this scan's fires (processed, saturated,
// cloud-contaminated, high / medium / low probability), 30-35 the
// same seen within 12 h and a pixel of an earlier fire (the temporal
// filter, Sec. 3.4.2.16); the QA flag folds the mask (Table 3.12).
// Requirement (Table 2.1): 2 km, 5 min, 275-400 K at 2.0 K on band
// 7, quantitative to 65 deg local zenith; the minimum detectable
// fire about 0.004 km^2 at 800 K at the sub-satellite point.
// Validation (Sec. 4): deep-dive against Landsat-8 OLI (Hall et al.
// 2019 found severe false positives in the first FDCA; the 25 Jul
// 2019 update cut them); the Topaz solar farm's reflection gave
// high-confidence false alarms - stated on the line as the ATBD's
// own caution.
// ---------------------------------------------------------------
export const FIRE_CODES = {
  10: 'processed',
  11: 'saturated',
  12: 'cloud-contaminated',
  13: 'high probability',
  14: 'medium probability',
  15: 'low probability'
};
export const FIRE_QA_WORDS = [
  'fire',
  'fire-free land',
  'opaque cloud',
  'unusable surface, glint or off the disk',
  'bad input',
  'algorithm failed'
];
export const FIRE_ATBD = {
  version: 'Enterprise Fire / Hot Spot Characterization ATBD v2.7, 2020-10-31',
  requirement: {
    rangeK: [275, 400],
    accuracyK: 2,
    lzaQuantitativeDeg: 65,
    refreshMin: 5,
    resolutionKm: 2
  },
  t39MinNightK: 285,
  t39MinDayAddK: 15,
  reflThresholdNightK: 315,
  reflThresholdDayAddK: 5,
  cloud: {
    t112BelowK: 270,
    diffBelowK: -4,
    diffAboveK: 20,
    warmBelowK: 285,
    albedoAbove: 0.38,
    t123AtOrBelowK: 265
  },
  blockOut: {lzaDeg: 80, glintDeg: 10, subSolarDeg: 10},
  saturationK: {band7: 411.86, band14: 340},
  minFireK: 400,
  smoulderingK: 350,
  minDetectableKm2: 0.004,
  minDetectableAtK: 800,
  mir: {a: 3.0e-9, rangeK: [600, 1400]},
  sigma: 5.67e-8,
  temporalFilterH: 12,
  backgroundMaxPx: 111,
  backgroundValidFrac: 0.2,
  frpUnreportedCodes: [11, 12, 15, 31, 32, 35]
};
/** The mask code's class: {fire, filtered, kind, words}; a non-fire
 * code names its reason (Table 3.11's families). */
export function fireClass(code) {
  const c = Number(code);
  if (c >= 10 && c <= 15)
    return {
      fire: true,
      filtered: false,
      kind: FIRE_CODES[c],
      words: FIRE_CODES[c] + ' fire pixel'
    };
  if (c >= 30 && c <= 35)
    return {
      fire: true,
      filtered: true,
      kind: FIRE_CODES[c - 20],
      words: FIRE_CODES[c - 20] + ' fire pixel, seen before'
    };
  let words = 'unprocessed';
  if (c === 40) words = 'space';
  else if (c === 50) words = 'local zenith past 80 deg';
  else if (c === 60) words = 'sun glint or sub-solar block-out';
  else if (c === 100) words = 'fire-free land';
  else if (c >= 120 && c <= 127) words = 'bad input data';
  else if (c >= 150 && c <= 155) words = 'water, coast or invalid surface';
  else if (c === 160) words = 'invalid emissivity';
  else if (c >= 170 && c <= 188) words = 'a calculation failed';
  else if (c >= 200 && c <= 245) words = 'an opaque cloud test';
  return {fire: false, filtered: false, kind: null, words};
}
/** The middle-infrared fire radiative power (Eq. 3.4): the pixel's
 * area (m^2) times sigma / a times the 3.9-um radiance above the
 * background (W m^-2 sr^-1 um^-1), in megawatts. */
export function frpMir(lMir, lBackground, areaM2) {
  return (
    (((areaM2 * FIRE_ATBD.sigma) / FIRE_ATBD.mir.a) * (lMir - lBackground)) /
    1e6
  );
}
/**
 * The window's census: fire pixels by class (this scan's and the
 * temporally filtered), the reported radiative power's count, sum
 * and maximum (MW), the characterised temperature's maximum (K) and
 * the QA flag's six counts. `power`, `tempK` and `areaM2` are the
 * physical arrays (NaN where not reported).
 */
export function fireCensus(mask, power, tempK, areaM2, dqf) {
  const c = {
    n: mask.length,
    fires: 0,
    filtered: 0,
    processed: 0,
    saturated: 0,
    cloudy: 0,
    high: 0,
    medium: 0,
    low: 0,
    frp: {n: 0, sumMW: 0, maxMW: null},
    temp: {n: 0, maxK: null},
    area: {n: 0, sumM2: 0},
    qa: [0, 0, 0, 0, 0, 0],
    qaOther: 0
  };
  for (let q = 0; q < mask.length; q++) {
    const d = dqf ? dqf[q] : 255;
    if (d >= 0 && d <= 5) c.qa[d]++;
    else c.qaOther++;
    const k = fireClass(mask[q]);
    if (!k.fire) continue;
    c.fires++;
    if (k.filtered) c.filtered++;
    const key = {
      processed: 'processed',
      saturated: 'saturated',
      'cloud-contaminated': 'cloudy',
      'high probability': 'high',
      'medium probability': 'medium',
      'low probability': 'low'
    }[k.kind];
    c[key]++;
    const p = power ? power[q] : NaN;
    if (Number.isFinite(p) && p >= 0) {
      c.frp.n++;
      c.frp.sumMW += p;
      c.frp.maxMW = c.frp.maxMW === null ? p : Math.max(c.frp.maxMW, p);
    }
    const t = tempK ? tempK[q] : NaN;
    if (Number.isFinite(t)) {
      c.temp.n++;
      c.temp.maxK = c.temp.maxK === null ? t : Math.max(c.temp.maxK, t);
    }
    const a = areaM2 ? areaM2[q] : NaN;
    if (Number.isFinite(a)) {
      c.area.n++;
      c.area.sumM2 += a;
    }
  }
  return c;
}
/**
 * The fire pixels of a window as a list, each navigated to its
 * place (the fixed grid's own equations): {q, i, j, latDeg, lonDeg,
 * code, kind, filtered, frpMW, tempK, areaM2}, the strongest
 * radiative power first (unreported last).
 */
export function fireList(mask, power, tempK, areaM2, box, g, xCoord, yCoord) {
  const out = [];
  for (let q = 0; q < mask.length; q++) {
    const k = fireClass(mask[q]);
    if (!k.fire) continue;
    const i = box.i0 + (q % box.cols);
    const j = box.j0 + Math.floor(q / box.cols);
    const ll = fixedGridToLatLon(
      xCoord.offset + i * xCoord.scale,
      yCoord.offset + j * yCoord.scale,
      g
    );
    if (!ll) continue;
    const p = power ? power[q] : NaN;
    const t = tempK ? tempK[q] : NaN;
    const a = areaM2 ? areaM2[q] : NaN;
    out.push({
      q,
      i,
      j,
      latDeg: +ll.latDeg.toFixed(4),
      lonDeg: +ll.lonDeg.toFixed(4),
      code: mask[q],
      kind: k.kind,
      filtered: k.filtered,
      frpMW: Number.isFinite(p) && p >= 0 ? +p.toFixed(1) : null,
      tempK: Number.isFinite(t) ? +t.toFixed(0) : null,
      areaM2: Number.isFinite(a) ? +a.toFixed(0) : null
    });
  }
  out.sort((a, b) => (b.frpMW ?? -1) - (a.frpMW ?? -1));
  return out;
}
// ---------------------------------------------------------------
// THE COLUMN'S WATER (163rd pass): NOAA's total precipitable water
// (ABI-L2-TPWC: CONUS every 5 min at 10 km, day and night) - the
// Enterprise Legacy Soundings ATBD v3.1 (Li et al., 1 Nov 2019, 110
// pp; read in full): the Legacy Atmospheric Profile retrieval on a
// field of regard of 5 x 5 ABI pixels (at least a fifth clear), a
// regression first guess on the seven emissive bands (6.2-13.3 um)
// with the NWP forecast, then a physical iteration with a fast
// radiative transfer model and a discrepancy-principle
// regularisation; the profile at 101 levels, the total precipitable
// water its integral. The requirement (Table 1.2, the moisture
// profile): 10 km, 18% accuracy from the surface to 300 hPa and 20%
// above, quantitative to 67 deg local zenith, day and night, clear
// sky only. Validation (Sec. 4.3.2.5, SEVIRI as the proxy): an
// average error of 11.5% against radiosondes over land (August
// 2006); r = 0.96 against AMSR-E over the ocean on 2,822,939
// matchups within 15 min and 10 km (a slight wet bias under 25 mm,
// dry above, as MODIS shows); about 9% against the ECMWF analysis
// over land and ocean, the retrieval improving the forecast by 0.7
// mm over the ocean and 0.4 mm over land. The file's DQF_Overall
// (11 values): 0 good, 1 invalid (not geolocated or past the
// retrieval zenith), 2 degraded past the latitude threshold (70
// deg), 3 degraded past the quantitative zenith (70 deg in the
// file, 67 in the requirement), 4-10 invalid (too few clear pixels,
// missing NWP or L1b, a bad surface pressure index, an
// indeterminate emissivity, ...). The theme's use: the balloon's
// humidity profile keeps its shape and the satellite's column sets
// its total (goesir.clearSkyReference's pwMmMeasured).
// ---------------------------------------------------------------
export const TPW_DQF_MEANINGS = [
  'good_quality_qf',
  'invalid_due_to_not_geolocated_or_retrieval_LZA_threshold_exceeded_qf',
  'degraded_due_to_latitude_threshold_exceeded_qf',
  'degraded_due_to_quantitative_LZA_threshold_exceeded_qf',
  'invalid_due_to_insufficient_clear_pixels_in_field_of_regard_qf',
  'invalid_due_to_missing_NWP_data_qf',
  'invalid_due_to_missing_L1b_data_or_fatal_processing_error_qf',
  'invalid_due_to_bad_NWP_surface_pressure_index_qf',
  'invalid_due_to_indeterminate_land_surface_emissivity_qf',
  'invalid_9_qf',
  'invalid_10_qf'
];
export const TPW_ATBD = {
  version: 'Enterprise Legacy Soundings ATBD v3.1, 2019-11-01',
  resolutionKm: 10,
  fieldOfRegardPx: 5,
  clearFractionMin: 0.2,
  requirement: {
    moistureAccuracyPct: {sfcTo300hPa: 18, above300hPa: 20},
    lzaQuantitativeDeg: 67,
    refreshMinConus: 30
  },
  file: {lzaQuantitativeDeg: 70, lzaRetrievalDeg: 80, latitudeDeg: 70},
  validation: {
    raobLandErrorPct: 11.5,
    amsreR: 0.96,
    amsreN: 2822939,
    amsreWetBiasBelowMm: 25,
    ecmwfErrorPct: 9,
    forecastGainMm: {ocean: 0.7, land: 0.4}
  },
  // the scale the balloon's column may be stretched by (stated: a
  // ratio past it says the two do not describe one air mass)
  scaleBounds: [0.25, 4]
};
/** The overall flag's quality: 'good' (0), 'degraded' (2, 3) or
 * 'invalid' (1, 4-10); null for the fill. */
export function tpwQuality(dqf) {
  if (!Number.isFinite(dqf) || dqf === 255) return null;
  if (dqf === 0) return 'good';
  if (dqf === 2 || dqf === 3) return 'degraded';
  return 'invalid';
}
/** The window's census: counts by quality and the good pixels' mm
 * statistics (degraded ones counted apart, their mm stated). */
export function tpwCensus(mm, dqf) {
  const c = {n: mm.length, good: 0, degraded: 0, invalid: 0, fill: 0};
  const good = [];
  const degraded = [];
  for (let q = 0; q < mm.length; q++) {
    const d = dqf ? dqf[q] : 0;
    const k = tpwQuality(d);
    // an invalid flag counts as invalid whatever the value (the file
    // leaves such pixels at the fill); a good or degraded flag over
    // no value is fill
    if (k === null || (k !== 'invalid' && !Number.isFinite(mm[q]))) {
      c.fill++;
      continue;
    }
    c[k]++;
    if (k === 'good') good.push(mm[q]);
    else if (k === 'degraded') degraded.push(mm[q]);
  }
  good.sort((a, b) => a - b);
  degraded.sort((a, b) => a - b);
  const stats = (v) =>
    v.length
      ? {
          n: v.length,
          minMm: +v[0].toFixed(2),
          medianMm: +quantile(v, 0.5).toFixed(2),
          maxMm: +v[v.length - 1].toFixed(2)
        }
      : {n: 0, minMm: null, medianMm: null, maxMm: null};
  return {...c, goodStats: stats(good), degradedStats: stats(degraded)};
}

// ---- THE RAIN (164th pass) ------------------------------------------
// NOAA's Rainfall Rate / QPE (ABI-L2-RRQPEF: full disk every 10 min,
// 2 km at nadir, day and night). THE PRIMARY, read in full: the
// Enterprise Rainfall Rate ATBD v3.0 (Kuligowski, 10 Jul 2020, 46
// pp) - SCaMPR (Kuligowski 2002; 2013; 2016): the ABI brightness
// temperatures are parallax-shifted by the GFS-derived cloud-top
// height (Vicente et al. 2002, an ellipsoid of 6378.1 / 6356.6 km),
// matched to CPC's combined microwave rain rates (MWCOMB, 0.073 deg,
// 8-km footprints assumed, ABI 2 km, area-weighted), and the
// retrieval calibrated per CLASS - 15 x 15 deg boxes times three
// cloud types from the 9 x 9 window: water (T7.34 < T11.2 and
// T8.5 - T11.2 < -0.3 K), ice (T7.34 < T11.2, the difference at or
// above -0.3), cold-top convective (T7.34 >= T11.2) - 330 classes on
// GOES-16 (440 on GOES-17, band 14 alone under the loop heat pipe).
// Rain / no rain by discriminant analysis on two of nine predictors
// (Table 5: T6.2, S = 0.568 (Tmin,11.2 - 217 K), Tavg - Tmin - S,
// four brightness-temperature differences, T11.2), the threshold at
// the best Heidke skill with the raining count within 5%; the rate by
// linear regression on two of fourteen predictors (the nine and
// their power-law transforms, gamma stepped by 25 to 2500 for the
// best correlation), then a distribution-matching lookup at 0.01
// mm/h (identity from 50 to 100 mm/h), the 3 x 3 neighbouring
// boxes' retrievals blended by inverse cube distance, and the GFS
// lowest-third relative humidity adjusting for evaporation below
// cloud base (Eq. 35-36). The training set keeps 10,000 pixels
// above 2.5 mm/h and rolls with the newest matches. Output: tenths
// of mm/h as short integers, 0-100 mm/h, with Table 6's flag bits.
// REQUIREMENT (Table 1): 2 km, 10 min, 0-100 mm/h, accuracy 6 mm/h
// and precision 9 mm/h at 10 mm/h (68% within), quantitative to 70
// deg local zenith or 60 deg latitude. VALIDATION (Sec. 4, June 2019
// - May 2020, a 10-km "fuzzy" neighbourhood): against gauge-adjusted
// MRMS r 0.32 (GOES-16) / 0.28 (GOES-17), accuracy 4.36 / 5.50 mm/h,
// precision 7.81 / 9.39 over 11,201,180 / 6,867,843 points (GOES-17
// misses the precision spec); against GPM DPR r 0.127 / 0.170,
// accuracy 5.21 / 5.91, precision 8.69 / 8.96 over 161,680 / 347,934;
// a systematic dry bias at high rates; skill best in the tropics and
// the convective warm season, worst for stratiform winter rain and
// orography (Sec. 6) - the ATBD's own caution, on the line.
// ---------------------------------------------------------------------
// Table 6's bits as the file's flag values: 0 good; 1 bad data; 2 the
// local zenith angle past 70 deg or latitude past 60 deg; 4, 8 the
// first / second rain-or-no-rain predictor's input bad; 16, 32 the
// first / second rate predictor's; 64 the retrieval coefficients
// missing (a box without calibration).
export const RAIN_DQF_BITS = {
  bad: 1,
  blockOut: 2,
  detect1: 4,
  detect2: 8,
  rate1: 16,
  rate2: 32,
  coefficients: 64
};
export const RAIN_DQF_WORDS = {
  1: 'bad data',
  2: 'past 70° zenith or 60° latitude',
  4: 'first rain predictor bad',
  8: 'second rain predictor bad',
  16: 'first rate predictor bad',
  32: 'second rate predictor bad',
  64: 'no retrieval coefficients'
};
export const RAIN_ATBD = {
  version: 'Enterprise Rainfall Rate ATBD v3.0, 2020-07-10',
  resolutionKm: 2,
  refreshMin: 10,
  requirement: {
    rangeMmH: [0, 100],
    accuracyMmHAt10: 6,
    precisionMmHAt10: 9,
    lzaQuantitativeDeg: 70,
    latitudeDeg: 60
  },
  method: {
    classes: 330,
    classesG17: 440,
    boxDeg: 15,
    cloudTypes: 3,
    typeThresholdK: -0.3,
    rainThresholdMmH: 1,
    detectBiasTolerance: 0.05,
    predictors: 9,
    selected: 2,
    gammaStep: 25,
    gammaMax: 2500,
    lutStepMmH: 0.01,
    lutIdentityFromMmH: 50,
    trainingRainPx: 10000,
    trainingRainMinMmH: 2.5,
    mwFootprintKm: 8,
    mwGridDeg: 0.073,
    evaporation: {
      addSlope: 0.115825,
      addOffset: -10.7354,
      addRhFloor: 61,
      multA: 0.000112891,
      multB: -0.00504012,
      multC: 0.476117,
      multRhFloor: 22.32
    }
  },
  validation: {
    period: '2019-06-01 to 2020-05-31',
    neighbourhoodKm: 10,
    mrms: {
      r: {g16: 0.32, g17: 0.28},
      accuracyMmH: {g16: 4.36, g17: 5.5},
      precisionMmH: {g16: 7.81, g17: 9.39},
      n: {g16: 11201180, g17: 6867843},
      cdf68MmH: {g16: 7.8, g17: 9.4}
    },
    dpr: {
      r: {g16: 0.127, g17: 0.17},
      accuracyMmH: {g16: 5.21, g17: 5.91},
      precisionMmH: {g16: 8.69, g17: 8.96},
      n: {g16: 161680, g17: 347934}
    }
  }
};
/**
 * The ATBD's evaporation adjustment (Eq. 35-36): the retrieved rate
 * corrected by the GFS lowest-third mean-layer relative humidity
 * (percent) - an additive step floored at 61% RH, then a
 * multiplicative one floored at 22.32%. The product has applied it;
 * this is the law pinned, not re-applied.
 */
export function rainEvaporationAdjust(rrMmH, rhPct) {
  const e = RAIN_ATBD.method.evaporation;
  const add = rrMmH + e.addSlope * Math.max(rhPct, e.addRhFloor) + e.addOffset;
  const rh = Math.max(rhPct, e.multRhFloor);
  return add * (e.multA * rh * rh + e.multB * rh + e.multC);
}
/** A flag word's quality: 'good' (0), 'degraded' (the block-out bit
 * alone), 'invalid' (any other bit); null for the fill. */
export function rainQuality(dqf) {
  if (!Number.isFinite(dqf) || dqf === 255) return null;
  if (dqf === 0) return 'good';
  if (dqf === RAIN_DQF_BITS.blockOut) return 'degraded';
  return 'invalid';
}
/** The words of a flag word's set bits. */
export function rainFlagWords(dqf) {
  if (!Number.isFinite(dqf) || dqf === 255) return ['fill'];
  if (dqf === 0) return ['good'];
  const out = [];
  for (const [bit, words] of Object.entries(RAIN_DQF_WORDS))
    if (dqf & +bit) out.push(words);
  return out.length ? out : [`flag ${dqf}`];
}
/**
 * The window's census: counts by quality, the raining pixels among
 * the good and degraded ones (any rate above 0, and above the file's
 * own 1 mm/h "raining" definition), the heaviest rate, the mean over
 * the raining pixels and the sum (mm/h summed over pixels, the
 * file's total_rain_volume in kind).
 */
export function rainCensus(mmh, dqf) {
  const c = {
    n: mmh.length,
    good: 0,
    degraded: 0,
    invalid: 0,
    fill: 0,
    raining: 0,
    rainingGE1: 0,
    maxMmH: 0,
    meanRainingMmH: null,
    sumMmH: 0
  };
  let sum = 0;
  for (let q = 0; q < mmh.length; q++) {
    const k = rainQuality(dqf ? dqf[q] : 0);
    const v = mmh[q];
    if (k === null || (k !== 'invalid' && !Number.isFinite(v))) {
      c.fill++;
      continue;
    }
    c[k]++;
    if (k === 'invalid' || !(v > 0)) continue;
    c.raining++;
    if (v >= 1) c.rainingGE1++;
    sum += v;
    if (v > c.maxMmH) c.maxMmH = v;
  }
  c.sumMmH = sum;
  c.meanRainingMmH = c.raining ? sum / c.raining : null;
  return c;
}
/**
 * The raining pixels of a window (good or degraded, at or above
 * minMmH), each navigated to its place: {q, i, j, latDeg, lonDeg,
 * mmh, quality}, the heaviest first, capped.
 */
export function rainList(
  mmh,
  dqf,
  box,
  g,
  xCoord,
  yCoord,
  {minMmH = 0.1, cap = 200} = {}
) {
  const out = [];
  for (let q = 0; q < mmh.length; q++) {
    const k = rainQuality(dqf ? dqf[q] : 0);
    if (k === null || k === 'invalid') continue;
    const v = mmh[q];
    if (!(v >= minMmH)) continue;
    const i = box.i0 + (q % box.cols);
    const j = box.j0 + Math.floor(q / box.cols);
    const ll = fixedGridToLatLon(
      xCoord.offset + i * xCoord.scale,
      yCoord.offset + j * yCoord.scale,
      g
    );
    if (!ll) continue;
    out.push({
      q,
      i,
      j,
      latDeg: ll.latDeg,
      lonDeg: ll.lonDeg,
      mmh: v,
      quality: k
    });
  }
  out.sort((a, b) => b.mmh - a.mmh);
  return out.slice(0, cap);
}
/**
 * The nearest raining pixel (good or degraded, at or above minMmH)
 * to the window's centre, by pixel distance: {q, di, dj, mmh} or null.
 */
export function nearestRain(mmh, dqf, box, {minMmH = 0.1} = {}) {
  const ci = box.i - box.i0;
  const cj = box.j - box.j0;
  let best = null;
  for (let q = 0; q < mmh.length; q++) {
    const k = rainQuality(dqf ? dqf[q] : 0);
    if (k === null || k === 'invalid') continue;
    const v = mmh[q];
    if (!(v >= minMmH)) continue;
    const di = (q % box.cols) - ci;
    const dj = Math.floor(q / box.cols) - cj;
    const d2 = di * di + dj * dj;
    if (!best || d2 < best.d2) best = {q, di, dj, mmh: v, d2};
  }
  if (!best) return null;
  const {d2, ...rest} = best;
  return rest;
}
// ---------------------------------------------------------------
// THE DAYLIGHT FIELD (159th pass): the reflective bands' CMI - the
// CMIP ATBD's reflectance factor - and the sun that lit it. The
// Cloud and Moisture Imagery Product ATBD, Enterprise v4 (Schmit &
// Gunshor, 13 Jan 2021; the header's 149th entry), Sec. 3.4.1.2:
// Eq. 3-2 rho_f = kappa L with kappa = pi d^2 / Esun ("the incident
// Lambertian-equivalent radiance", d the instantaneous Earth-Sun
// distance in AU, Esun the bandpass solar irradiance) - the file's
// own kappa0, esun and earth_sun_distance_anomaly_in_AU; Eq. 3-3
// rho_f = rho cos(theta0), the reflectance factor being the
// reflectance times the cosine of the solar zenith angle (the CMI's
// standard_name says the same); DQF 0 good, 1 conditionally usable,
// 2 out of range, 3 no value, 4 focal-plane temperature exceeded (5
// added for GOES-17's loop heat pipe). Band 2 (0.64 um) is the one
// 500-m band; its CMI is int16 counts 0..4095 at 0.00031746 a count,
// fill -1 (65535 on the wire, as band 13's).
// ---------------------------------------------------------------
export const VIS_BAND = 'C02';
export const VIS_DQF_MEANINGS = [
  'good_pixel_qf',
  'conditionally_usable_pixel_qf',
  'out_of_range_pixel_qf',
  'no_value_pixel_qf',
  'focal_plane_temperature_threshold_exceeded_qf'
];
export const VIS_ATBD = {
  bandUm: 0.64,
  resolutionM: 500,
  kappaLaw: 'kappa = pi d^2 / Esun (Eq. 3-2)',
  factorLaw: 'rho_f = rho cos(solar zenith) (Eq. 3-3)',
  // the file's own (OR_ABI-L2-CMIPC-M6C02_G18_s20262490951178)
  file: {
    kappa0: 0.0019647,
    esunWm2Um: 1624.774,
    dAu: 1.00802,
    scale: 0.00031746,
    countsValid: [0, 4095],
    sizeMbNight: 33.6
  }
};
/** Eq. 3-2's kappa from the file's own Earth-Sun distance (AU) and
 * bandpass solar irradiance (W m^-2 um^-1). */
export function kappaFactor(dAu, esunWm2Um) {
  return (Math.PI * dAu * dAu) / esunWm2Um;
}
/** Eq. 3-3 inverted: the reflectance from the reflectance factor and
 * the cosine of the solar zenith angle; NaN where the sun is too low
 * for the division to mean anything (cos below minCos). */
export function reflectanceOfFactor(rf, cosSza, {minCos = 0.05} = {}) {
  return Number.isFinite(rf) && cosSza > minCos ? rf / cosSza : NaN;
}
/**
 * The solar zenith angle (deg) at a place and a time: the USNO
 * "Approximate Solar Coordinates" low-precision series the page's
 * own sun rides (mean longitude 280.460 + 0.9856474 n, anomaly
 * 357.528 + 0.9856003 n, ecliptic longitude L + 1.915 sin g + 0.020
 * sin 2g, obliquity 23.439 - 0.0000004 n, Greenwich sidereal time
 * 18.697374558 + 24.06570982441908 n hours; good to about a minute of
 * arc across 1950-2050 - the satellite pixel's own sun to a tenth of
 * a percent of its cosine).
 */
export function solarZenithDeg(latDeg, lonDeg, ms) {
  const cosZ = cosSolarZenith(latDeg, lonDeg, solarGeometry(ms));
  return (Math.acos(Math.max(-1, Math.min(1, cosZ))) * 180) / Math.PI;
}
/** The sun's place at a moment (the series above, once): its
 * declination and right ascension and Greenwich's sidereal angle,
 * radians - the part a whole window of pixels shares. */
export function solarGeometry(ms) {
  const n = (ms - Date.UTC(2000, 0, 1, 12)) / 86400e3;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) * Math.PI) / 180;
  const lam =
    ((L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * Math.PI) / 180;
  const eps = ((23.439 - 0.0000004 * n) * Math.PI) / 180;
  const gmstH = (18.697374558 + 24.06570982441908 * n) % 24;
  return {
    raRad: Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)),
    decRad: Math.asin(Math.sin(eps) * Math.sin(lam)),
    gmstRad: (gmstH * 15 * Math.PI) / 180
  };
}
/** cos(solar zenith) at a place from the sun's geometry: three trig
 * calls a pixel, the per-pixel part of the series. */
export function cosSolarZenith(latDeg, lonDeg, geo) {
  const ha = geo.gmstRad + (lonDeg * Math.PI) / 180 - geo.raRad;
  const la = (latDeg * Math.PI) / 180;
  return (
    Math.sin(la) * Math.sin(geo.decRad) +
    Math.cos(la) * Math.cos(geo.decRad) * Math.cos(ha)
  );
}
/**
 * THE COVER FRACTION of a fine pixel from its reflectance between the
 * scene's own clear and cloudy reflectances (a plane-parallel pixel
 * partly filled with cloud reflects the linear mix of the two - the
 * fraction is the position between them, clamped): NaN without a
 * reflectance or a span. The clear and cloudy references are
 * MEASURED under the mask (visReferences), never quoted.
 */
export function coverFraction(rho, rhoClear, rhoCloud) {
  if (!Number.isFinite(rho)) return NaN;
  const span = rhoCloud - rhoClear;
  if (!(span > 1e-3)) return NaN;
  return Math.min(1, Math.max(0, (rho - rhoClear) / span));
}
/**
 * The window's census by the file's five flags (255 fill) with the
 * good pixels' reflectance-factor and reflectance statistics at one
 * cosine of the solar zenith (the observer's: the sun's angle moves
 * about a degree across the window, stated).
 */
export function visCensus(rf, dqf, cosSza) {
  const c = {
    n: rf.length,
    good: 0,
    usable: 0,
    outOfRange: 0,
    noValue: 0,
    fpt: 0,
    fill: 0
  };
  const good = [];
  for (let q = 0; q < rf.length; q++) {
    const d = dqf ? dqf[q] : 0;
    if (d === 0) c.good++;
    else if (d === 1) c.usable++;
    else if (d === 2) c.outOfRange++;
    else if (d === 3) c.noValue++;
    else if (d === 4) c.fpt++;
    else c.fill++;
    if (d === 0 && Number.isFinite(rf[q])) good.push(rf[q]);
  }
  good.sort((a, b) => a - b);
  const rho = (v) => (v === null ? null : reflectanceOfFactor(v, cosSza));
  const med = quantile(good, 0.5);
  return {
    ...c,
    rfMin: good.length ? good[0] : null,
    rfMedian: med,
    rfMax: good.length ? good[good.length - 1] : null,
    cosSza,
    rhoMin: rho(good.length ? good[0] : null),
    rhoMedian: rho(med),
    rhoMax: rho(good.length ? good[good.length - 1] : null)
  };
}
/**
 * OTSU'S THRESHOLD (Otsu 1979, IEEE Trans. SMC 9(1) 62-66): the split
 * of a sorted sample into two classes that maximises the between-class
 * variance sigma_b^2 = w0 w1 (mu0 - mu1)^2 - every split tried, the
 * class sums running. Returns the threshold (the midpoint between the
 * two values the best split parts), the effectiveness eta = sigma_b^2
 * / sigma^2 (0..1: Otsu's own measure of how well two classes explain
 * the sample - a normal sample splits at its mean with eta = 2/pi,
 * two separated modes approach 1) and the classes' counts and means.
 * A constant sample has eta 0 and the value itself as threshold.
 */
export function otsuThreshold(sorted) {
  const n = sorted.length;
  if (!n) return null;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += sorted[i];
  const mean = sum / n;
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (sorted[i] - mean) ** 2;
  const variance = ss / n;
  let best = -1;
  let k = 0;
  let acc = 0;
  for (let i = 1; i < n; i++) {
    acc += sorted[i - 1];
    const w0 = i / n;
    const w1 = 1 - w0;
    const mu0 = acc / i;
    const mu1 = (sum - acc) / (n - i);
    const sb = w0 * w1 * (mu0 - mu1) ** 2;
    if (sb > best) {
      best = sb;
      k = i;
    }
  }
  // a constant sample (its range within rounding of zero: a hundred
  // 0.3s sum to 30.000000000000004) has no classes at all
  const range = sorted[n - 1] - sorted[0];
  if (
    !(range > 1e-9 * Math.max(1, Math.abs(mean))) ||
    !(variance > 0) ||
    best <= 0
  ) {
    return {
      t: sorted[0],
      eta: 0,
      nLow: n,
      nHigh: 0,
      meanLow: mean,
      meanHigh: null
    };
  }
  let low = 0;
  for (let i = 0; i < k; i++) low += sorted[i];
  return {
    t: (sorted[k - 1] + sorted[k]) / 2,
    eta: best / variance,
    nLow: k,
    nHigh: n - k,
    meanLow: low / k,
    meanHigh: (sum - low) / (n - k)
  };
}
// a cloudy population split this well (Otsu's eta) into two classes is
// two things - the sub-pixel gaps and the cloud (an equal mixture of
// two normals 4 sigma apart gives 0.8; one normal 0.64, one uniform
// 0.75); below it the population is one mode
export const OTSU_BIMODAL_ETA = 0.8;
/**
 * THE SCENE'S OWN REFERENCES: the reflectance of the clear and of the
 * cloudy pixels as the mask sorts them - `clearOf(q)` says whether the
 * fine pixel q lies under a clear (true), cloudy (false) or unknown
 * (null) mask pixel. The clear reference is the clear pixels' median
 * reflectance. THE CLOUD REFERENCE IS A COVERAGE EDGE (160th pass):
 * the fine pixels under a cloudy 2-km pixel are two populations - the
 * cloud, and the clear sub-pixels inside its gaps - so when Otsu's
 * threshold parts them well (eta at or over OTSU_BIMODAL_ETA) the
 * reference is that threshold: a fine pixel at or above it is covered
 * whole and only the darker ones, the gaps and edges, read partial;
 * when the population is one mode (a solid deck, a veil) the reference
 * is its own dim tenth (the 10th percentile), so the deck stays whole
 * whatever its brightness - the fraction is a coverage, never a
 * thickness (the 159th's 90th percentile read a dim solid deck as
 * gaps). rhoBright is the 90th percentile still, for the line.
 * {rhoClear, rhoCloud, rhoBright, mode, eta, threshold, nClear,
 * nCloud} with null references where either side is thin (under minN).
 */
export function visReferences(rho, clearOf, {minN = 50} = {}) {
  const clear = [];
  const cloud = [];
  for (let q = 0; q < rho.length; q++) {
    if (!Number.isFinite(rho[q])) continue;
    const c = clearOf(q);
    if (c === true) clear.push(rho[q]);
    else if (c === false) cloud.push(rho[q]);
  }
  clear.sort((a, b) => a - b);
  cloud.sort((a, b) => a - b);
  const enough = cloud.length >= minN;
  const otsu = enough ? otsuThreshold(cloud) : null;
  const bimodal = !!otsu && otsu.eta >= OTSU_BIMODAL_ETA;
  const rhoClear = clear.length >= minN ? quantile(clear, 0.5) : null;
  const rhoCloud = enough ? (bimodal ? otsu.t : quantile(cloud, 0.1)) : null;
  // THE INVERTED PAIR (166th pass, measured at the home under a high
  // deck: the mask's 1,056 "clear" pixels sat at cloud edges at rho
  // 0.765 above the cloud's dim tenth 0.480): a clear reference at or
  // above the coverage edge is no reference - a fraction between them
  // would run backwards. Both values are kept for the words; the mode
  // says so and the cut withdraws (daylight.js).
  const inverted =
    rhoClear !== null && rhoCloud !== null && rhoClear >= rhoCloud;
  return {
    rhoClear,
    rhoCloud,
    rhoBright: enough ? quantile(cloud, 0.9) : null,
    mode: inverted
      ? 'inverted'
      : enough
        ? bimodal
          ? 'bimodal'
          : 'unimodal'
        : null,
    inverted,
    eta: otsu ? otsu.eta : null,
    threshold: otsu ? otsu.t : null,
    nClear: clear.length,
    nCloud: cloud.length
  };
}
// The imagery bucket lists every band's file under one prefix
// (OR_ABI-L2-CMIPC-M6C13_G18_s...): the band from a key, and the
// keys of one band.
export const IMAGERY_BAND = 'C13';
export function keyBand(key) {
  const m = /-M\d(C\d\d)_/.exec(key);
  return m ? m[1] : null;
}
export function bandKeys(keys, band) {
  return keys.filter((k) => keyBand(k) === band);
}
// The window's arrays on the wire: typed arrays as base64 (a 101x101
// uint8 mask is 13.6 kB instead of 20.4 kB of JSON digits - measured
// in the gate; a float is 4 bytes instead of up to 18 characters),
// NaN in a float array standing for fill. Pure, so the daemon packs
// and the page unpacks with the same code.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function bytesToBase64(u8) {
  let out = '';
  for (let i = 0; i < u8.length; i += 3) {
    const a = u8[i];
    const b = i + 1 < u8.length ? u8[i + 1] : 0;
    const c = i + 2 < u8.length ? u8[i + 2] : 0;
    out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < u8.length ? B64[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < u8.length ? B64[c & 63] : '=';
  }
  return out;
}
export function base64ToBytes(s) {
  const lookup = new Uint8Array(128);
  for (let i = 0; i < B64.length; i++) lookup[B64.charCodeAt(i)] = i;
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((s.length / 4) * 3 - pad);
  let k = 0;
  for (let i = 0; i < s.length; i += 4) {
    const n =
      (lookup[s.charCodeAt(i)] << 18) |
      (lookup[s.charCodeAt(i + 1)] << 12) |
      (lookup[s.charCodeAt(i + 2)] << 6) |
      lookup[s.charCodeAt(i + 3)];
    if (k < out.length) out[k++] = (n >> 16) & 255;
    if (k < out.length) out[k++] = (n >> 8) & 255;
    if (k < out.length) out[k++] = n & 255;
  }
  return out;
}
export function packArray(values, kind) {
  let ta;
  if (kind === 'u8') ta = Uint8Array.from(values, (v) => (v == null ? 255 : v));
  else if (kind === 'u16')
    ta = Uint16Array.from(values, (v) => (v == null ? 65535 : v));
  else if (kind === 'f32')
    ta = Float32Array.from(values, (v) => (v == null ? NaN : v));
  else throw new Error('packArray kind ' + kind);
  // little-endian bytes on every platform
  const u8 = new Uint8Array(ta.length * ta.BYTES_PER_ELEMENT);
  const dv = new DataView(u8.buffer);
  for (let i = 0; i < ta.length; i++) {
    if (kind === 'u8') u8[i] = ta[i];
    else if (kind === 'u16') dv.setUint16(i * 2, ta[i], true);
    else dv.setFloat32(i * 4, ta[i], true);
  }
  return {kind, n: ta.length, b64: bytesToBase64(u8)};
}
export function unpackArray(packed) {
  const u8 = base64ToBytes(packed.b64);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const n = packed.n;
  if (packed.kind === 'u8') return Uint8Array.from(u8.subarray(0, n));
  if (packed.kind === 'u16') {
    const out = new Uint16Array(n);
    for (let i = 0; i < n; i++) out[i] = dv.getUint16(i * 2, true);
    return out;
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = dv.getFloat32(i * 4, true);
  return out;
}

// ---------------------------------------------------------------
// The imagery and DCOMP (149th pass)
// ---------------------------------------------------------------
// The products' own scaling: raw counts to the physical value with
// the fill as NaN (CMI: int16 counts 0..4095 at 0.0614533 K per
// count from 89.62 K, fill -1 - carried on the wire as 65535; COD
// and CPS: uint16 at 0.00244163 per count, fill 65535).
export function unscale(raw, {scale = 1, offset = 0, fill = 65535} = {}) {
  const out = new Float32Array(raw.length);
  for (let q = 0; q < raw.length; q++)
    out[q] = raw[q] === fill ? NaN : raw[q] * scale + offset;
  return out;
}
export function quantile(sorted, f) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))];
}
// THE HOUR'S SKIN AGAINST THE DAY-OLD ANALYSIS (151st pass): every
// good SST pixel of the window (DQF 0) navigated to its lat/lon and
// looked up in the analysis field through `lookup(latDeg, lonDeg)`
// (the page passes its MUR grid's bilinear read; null where the
// analysis has no sea). Differences ABI minus analysis in kelvin:
// the count, median, p10, p90 and mean. ABI's product is the SKIN
// temperature of the hour; MUR's analysed_sst is a foundation
// temperature (below the diurnal warm layer), so a daytime
// difference carries the warm layer as well as the day between them
// - stated on the line, never blended.
export function sstAgainstGrid(sstK, dqf, {g, xCoord, yCoord, box}, lookup) {
  const d = [];
  let sum = 0;
  for (let q = 0; q < sstK.length; q++) {
    if (!Number.isFinite(sstK[q]) || (dqf && dqf[q] !== 0)) continue;
    const i = box.i0 + (q % box.cols);
    const j = box.j0 + Math.floor(q / box.cols);
    const p = fixedGridToLatLon(scanAngle(i, xCoord), scanAngle(j, yCoord), g);
    if (!p) continue;
    const ref = lookup(p.latDeg, p.lonDeg);
    if (!Number.isFinite(ref)) continue;
    const diff = sstK[q] - 273.15 - ref; // the analysis is in degrees C
    d.push(diff);
    sum += diff;
  }
  d.sort((a, b) => a - b);
  return {
    n: d.length,
    medianK: quantile(d, 0.5),
    p10K: quantile(d, 0.1),
    p90K: quantile(d, 0.9),
    meanK: d.length ? sum / d.length : null
  };
}
// The census of a field over a window, DQF 0 (good) only: how many
// pixels, how many good, their minimum, median, maximum (the
// field's own units).
export function fieldCensus(values, dqf) {
  const good = [];
  for (let q = 0; q < values.length; q++)
    if (Number.isFinite(values[q]) && (!dqf || dqf[q] === 0))
      good.push(values[q]);
  good.sort((a, b) => a - b);
  return {
    n: values.length,
    good: good.length,
    min: good.length ? good[0] : null,
    median: quantile(good, 0.5),
    max: good.length ? good[good.length - 1] : null
  };
}
// The same for a kelvin field, the keys saying so. The imagery's
// brightness temperature and the SST share it.
export function goodCensus(valuesK, dqf) {
  const c = fieldCensus(valuesK, dqf);
  return {n: c.n, good: c.good, minK: c.min, medianK: c.median, maxK: c.max};
}
// The mean of a field's good pixels within r pixels of the window's
// own centre (the point's pixel: box.i, box.j) - the ATBD's remedy
// for reading a pixel product against a point on the ground, where
// a pyranometer sees the whole hemisphere and a pixel one column:
// average in space. {n, mean, min, max} over the (2r+1)^2 box,
// clipped to the window.
export function boxMean(values, dqf, box, r) {
  const ci = box.i - box.i0;
  const cj = box.j - box.j0;
  let n = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let dj = -r; dj <= r; dj++) {
    const j = cj + dj;
    if (j < 0 || j >= box.rows) continue;
    for (let di = -r; di <= r; di++) {
      const i = ci + di;
      if (i < 0 || i >= box.cols) continue;
      const q = j * box.cols + i;
      const v = values[q];
      if (!Number.isFinite(v) || (dqf && dqf[q] !== 0)) continue;
      n++;
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return {
    n,
    mean: n ? sum / n : null,
    min: n ? min : null,
    max: n ? max : null
  };
}
// THE MEASURED HAZE (156th pass): the AOD window's census by the
// file's own quality levels (DQF 0 high, 1 medium, 2 low, 3 no
// retrieval, 255 fill) with the statistics of the high-quality
// pixels (the ones the ATBD recommends for quantitative use) and,
// beside them, the count and median of high + medium ("usable" -
// reported, never driving).
export function aodCensus(tau, dqf) {
  const c = {n: tau.length, high: 0, medium: 0, low: 0, none: 0, fill: 0};
  const hi = [];
  const usable = [];
  for (let q = 0; q < tau.length; q++) {
    const d = dqf ? dqf[q] : 0;
    if (d === 0) c.high++;
    else if (d === 1) c.medium++;
    else if (d === 2) c.low++;
    else if (d === 3) c.none++;
    else c.fill++;
    if (!Number.isFinite(tau[q])) continue;
    if (d === 0) hi.push(tau[q]);
    if (d <= 1) usable.push(tau[q]);
  }
  hi.sort((a, b) => a - b);
  usable.sort((a, b) => a - b);
  return {
    ...c,
    min: hi.length ? hi[0] : null,
    median: quantile(hi, 0.5),
    max: hi.length ? hi[hi.length - 1] : null,
    usableN: usable.length,
    usableMedian: quantile(usable, 0.5)
  };
}
// The same census for any product flagged by the four levels (the
// LST's DQF 0..3 carries the AOD's own names): the window by
// quality with the high-quality statistics.
export const qualityCensus = aodCensus;
/**
 * THE NEAREST PIXEL OF A QUALITY (157th pass): the pixel nearest the
 * window's centre whose flag is `good` and whose value is finite,
 * searched ring by ring out to maxR (Chebyshev), ties within a ring
 * broken by Euclidean distance. {q, di, dj, r} or null - the LST
 * body stands the land surface layer on it when the point's own
 * pixel is cloudy or water.
 */
export function nearestGood(values, dqf, box, maxR, good = 0) {
  const ci = box.i - box.i0;
  const cj = box.j - box.j0;
  for (let r = 0; r <= maxR; r++) {
    let best = null;
    for (let dj = -r; dj <= r; dj++) {
      const j = cj + dj;
      if (j < 0 || j >= box.rows) continue;
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = ci + di;
        if (i < 0 || i >= box.cols) continue;
        const q = j * box.cols + i;
        if (!Number.isFinite(values[q]) || (dqf && dqf[q] !== good)) continue;
        const d2 = di * di + dj * dj;
        if (!best || d2 < best.d2) best = {q, di, dj, r, d2};
      }
    }
    if (best) return {q: best.q, di: best.di, dj: best.dj, r};
  }
  return null;
}
// The ATBD's own collocation estimator (Sec. 4.2, after Ichoku et
// al. 2002 and Remer et al. 2005): the high-quality pixels within r
// of the window's centre (r = 12 on the 2-km grid is the 50 x 50 km
// box), sorted, the lowest `low` and highest `high` fractions
// screened out, the rest averaged - the quantity Table 4-6's bias
// and precision were measured for, so the figures apply to it and
// to nothing else. {n, kept, mean, min, max}: n the high-quality
// pixels in the box, kept how many survived the screen, min/max
// over the n.
export function aodBoxEstimate(
  tau,
  dqf,
  box,
  r,
  {low = AOD_ATBD.screenLow, high = AOD_ATBD.screenHigh} = {}
) {
  const ci = box.i - box.i0;
  const cj = box.j - box.j0;
  const vals = [];
  for (let dj = -r; dj <= r; dj++) {
    const j = cj + dj;
    if (j < 0 || j >= box.rows) continue;
    for (let di = -r; di <= r; di++) {
      const i = ci + di;
      if (i < 0 || i >= box.cols) continue;
      const q = j * box.cols + i;
      const v = tau[q];
      if (!Number.isFinite(v) || (dqf && dqf[q] !== 0)) continue;
      vals.push(v);
    }
  }
  vals.sort((a, b) => a - b);
  const n = vals.length;
  if (!n) return {n: 0, kept: 0, mean: null, min: null, max: null};
  const a = Math.round(n * low);
  const b = Math.max(a + 1, Math.round(n * (1 - high)));
  let sum = 0;
  let kept = 0;
  for (let k = a; k < b && k < n; k++) {
    sum += vals[k];
    kept++;
  }
  return {n, kept, mean: sum / kept, min: vals[0], max: vals[n - 1]};
}
// The requirement and the measured figures for an AOD over a
// surface (Table 2-1 and Table 4-6 by range): the row the value
// falls in, with its range named.
export function aodFigures(tau, surface = 'land') {
  if (!Number.isFinite(tau)) return null;
  const rows = AOD_ATBD[surface] ?? AOD_ATBD.land;
  for (let k = 0; k < rows.length; k++) {
    const row = rows[k];
    if (tau < row.below || k === rows.length - 1) {
      const range =
        k === 0
          ? `< ${row.below}`
          : k === rows.length - 1
            ? `> ${rows[k - 1].below}`
            : `${rows[k - 1].below}–${row.below}`;
      return {surface: AOD_ATBD[surface] ? surface : 'land', range, ...row};
    }
  }
  return null;
}
// THE RANKING ON THE CHANNEL: the model's channel set (tau at the
// theme's 680/550/440 nm) re-scaled so its 550 nm value equals the
// satellite's, the spectral shape (the model's Angstrom slope, or
// AERONET's when the photometer wrote the set) kept; a set at the
// floor (no shape to keep) becomes flat at the satellite's value;
// every channel clamped to [floor, ceil]. Pure, so the page and the
// gate run one law.
export function aodChannelTau(tau3, tau550, {floor = 1e-4, ceil = 3} = {}) {
  const t = Math.min(ceil, Math.max(floor, tau550));
  const ref = tau3[1];
  if (!(ref > floor)) return [t, t, t];
  const s = t / ref;
  return tau3.map((v) => Math.min(ceil, Math.max(floor, v * s)));
}
// THE MEASURED MOTION (153rd pass): the derived motion winds are a
// point list, so the window is a radius. Great-circle distance on
// the mean sphere (the file gives geodetic lat/lon per vector).
const DMW_EARTH_KM = 6371.0088;
export function dmwDistanceKm(lat1, lon1, lat2, lon2) {
  const R = Math.PI / 180;
  const p1 = lat1 * R;
  const p2 = lat2 * R;
  const a =
    Math.sin(((lat2 - lat1) * R) / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(((lon2 - lon1) * R) / 2) ** 2;
  return 2 * DMW_EARTH_KM * Math.asin(Math.sqrt(Math.min(1, a)));
}
export function dmwLayerOf(hPa) {
  for (const l of DMW_LAYERS)
    if (hPa >= l.hPa[0] && hPa <= l.hPa[1]) return l.id;
  return null;
}
// The vectors within a radius of a point from the file's columns
// ({lat, lon, spdMs, dirDeg, hPa, tK, dqf, lzaDeg, szaDeg}, one
// entry per vector, the file's -999 fill and any value outside the
// product's own ranges left out), nearest first, each with its
// distance. The flag rides along: the layers take DQF 0 only.
export function dmwWithin(cols, latDeg, lonDeg, radiusKm) {
  const out = [];
  for (let i = 0; i < cols.lat.length; i++) {
    const la = cols.lat[i];
    const lo = cols.lon[i];
    const spd = cols.spdMs[i];
    const dir = cols.dirDeg[i];
    const p = cols.hPa[i];
    if (!(Math.abs(la) <= 90) || !(Math.abs(lo) <= 180)) continue;
    if (!(spd >= 0) || !(dir >= 0 && dir <= 360) || !(p > 0 && p <= 1100))
      continue;
    const km = dmwDistanceKm(latDeg, lonDeg, la, lo);
    if (!(km <= radiusKm)) continue;
    out.push({
      km,
      lat: la,
      lon: lo,
      spdMs: spd,
      dirDeg: dir,
      hPa: p,
      tK: cols.tK ? cols.tK[i] : NaN,
      dqf: cols.dqf ? cols.dqf[i] : 0,
      lzaDeg: cols.lzaDeg ? cols.lzaDeg[i] : NaN,
      szaDeg: cols.szaDeg ? cols.szaDeg[i] : NaN
    });
  }
  out.sort((a, b) => a.km - b.km);
  return out;
}
// The wire: the vectors as rounded columns (a few hundred numbers),
// and the same objects back from them - the daemon packs, the page
// unpacks, the layers are computed from the unpacked list on both.
const dmwRound = (v, d) => (Number.isFinite(v) ? +v.toFixed(d) : null);
export function dmwColumns(vectors) {
  const cols = {
    km: [],
    lat: [],
    lon: [],
    spdMs: [],
    dirDeg: [],
    hPa: [],
    tK: [],
    dqf: [],
    lzaDeg: [],
    szaDeg: []
  };
  for (const v of vectors) {
    cols.km.push(dmwRound(v.km, 1));
    cols.lat.push(dmwRound(v.lat, 4));
    cols.lon.push(dmwRound(v.lon, 4));
    cols.spdMs.push(dmwRound(v.spdMs, 2));
    cols.dirDeg.push(dmwRound(v.dirDeg, 1));
    cols.hPa.push(dmwRound(v.hPa, 1));
    cols.tK.push(dmwRound(v.tK, 2));
    cols.dqf.push(v.dqf);
    cols.lzaDeg.push(dmwRound(v.lzaDeg, 1));
    cols.szaDeg.push(dmwRound(v.szaDeg, 1));
  }
  return cols;
}
export function dmwUnpack(cols) {
  const out = [];
  if (!cols || !cols.km) return out;
  for (let i = 0; i < cols.km.length; i++)
    out.push({
      km: cols.km[i],
      lat: cols.lat[i],
      lon: cols.lon[i],
      spdMs: cols.spdMs[i],
      dirDeg: cols.dirDeg[i],
      hPa: cols.hPa[i],
      tK: cols.tK[i],
      dqf: cols.dqf[i],
      lzaDeg: cols.lzaDeg[i],
      szaDeg: cols.szaDeg[i]
    });
  return out;
}
// The nearest good vector to a point within maxKm, or null.
export function dmwNearest(vectors, latDeg, lonDeg, maxKm) {
  let best = null;
  for (const v of vectors) {
    if (v.dqf !== 0) continue;
    const km = dmwDistanceKm(latDeg, lonDeg, v.lat, v.lon);
    if (km <= maxKm && (!best || km < best.km)) best = {...v, km};
  }
  return best;
}
// THE LAYERS' WINDS - what the decks drift with: for each ATBD layer
// the good vectors (DQF 0) in it within the TIGHTEST of the radii
// holding at least minN of them (the nearest sufficient sample -
// three vectors span the ATBD's ~38 km spacing once over), their
// VECTOR mean (u = -V sin(dir), v = -V cos(dir): the meteorological
// from-direction, the file's own convention; the mean vector's
// speed and from-direction - two winds 20 degrees apart average to
// the direction between them, a whisker slower), the speeds' scalar
// mean, median, min, max and standard deviation, the median
// pressure, the nearest vector's distance. n counts the layer's
// good vectors in the whole list; radiusKm null (with the rest
// null) when no radius holds minN.
export function dmwLayers(vectors, {minN = 3, radiiKm = [50, 100, 150]} = {}) {
  const R = Math.PI / 180;
  const out = {};
  for (const l of DMW_LAYERS) {
    const mine = vectors.filter(
      (v) => v.dqf === 0 && v.hPa >= l.hPa[0] && v.hPa <= l.hPa[1]
    );
    let take = null;
    let radius = null;
    for (const r of radiiKm) {
      const s = mine.filter((v) => v.km <= r);
      if (s.length >= minN) {
        take = s;
        radius = r;
        break;
      }
    }
    if (!take) {
      out[l.id] = {
        n: mine.length,
        used: 0,
        radiusKm: null,
        spdMs: null,
        dirDeg: null,
        meanMs: null,
        medianMs: null,
        minMs: null,
        maxMs: null,
        sdMs: null,
        medianHpa: null,
        nearestKm: mine.length ? mine[0].km : null
      };
      continue;
    }
    let su = 0;
    let sv = 0;
    let ss = 0;
    const speeds = [];
    const press = [];
    for (const v of take) {
      su += -v.spdMs * Math.sin(v.dirDeg * R);
      sv += -v.spdMs * Math.cos(v.dirDeg * R);
      ss += v.spdMs;
      speeds.push(v.spdMs);
      press.push(v.hPa);
    }
    const n = take.length;
    const mu = su / n;
    const mv = sv / n;
    const mean = ss / n;
    let sq = 0;
    for (const s of speeds) sq += (s - mean) * (s - mean);
    speeds.sort((a, b) => a - b);
    press.sort((a, b) => a - b);
    // the from-direction to a microdegree (the file's own float32
    // directions carry ~1e-5), so a mean pointing north reads 0,
    // never 359.999999
    const dir =
      Math.round(((Math.atan2(-mu, -mv) / R + 360) % 360) * 1e6) / 1e6;
    out[l.id] = {
      n: mine.length,
      used: n,
      radiusKm: radius,
      spdMs: Math.hypot(mu, mv),
      dirDeg: dir % 360,
      meanMs: mean,
      medianMs: quantile(speeds, 0.5),
      minMs: speeds[0],
      maxMs: speeds[n - 1],
      sdMs: Math.sqrt(sq / n),
      medianHpa: quantile(press, 0.5),
      nearestKm: take[0].km
    };
  }
  return out;
}
// THE DECODER AUDITED: the theme's brightness temperatures (read
// off GIBS's colour-mapped tiles, C) against NOAA's own CMI (K) at
// the same places - each theme pixel looked up in the imagery
// window, DQF 0 only; differences theme minus NOAA in kelvin, all
// pixels and the clear and cloud classes apart (the theme's call).
export function btDifference(themePixels, noaa) {
  const {g, xCoord, yCoord, box, btK, dqf} = noaa;
  const all = [];
  const clear = [];
  const cloud = [];
  for (const p of themePixels) {
    if (!Number.isFinite(p.btC)) continue;
    const q = windowIndexOf(p.latDeg, p.lonDeg, g, xCoord, yCoord, box);
    if (q < 0) continue;
    if (dqf && dqf[q] !== 0) continue;
    const t = btK[q];
    if (!Number.isFinite(t)) continue;
    const d = p.btC + 273.15 - t;
    all.push(d);
    if (p.cloud === true) cloud.push(d);
    else if (p.cloud === false) clear.push(d);
  }
  const stats = (a) => {
    const s = [...a].sort((x, y) => x - y);
    let sum = 0;
    let sq = 0;
    for (const v of s) {
      sum += v;
      sq += v * v;
    }
    return {
      n: s.length,
      medianK: quantile(s, 0.5),
      p10K: quantile(s, 0.1),
      p90K: quantile(s, 0.9),
      meanK: s.length ? sum / s.length : null,
      rmsK: s.length ? Math.sqrt(sq / s.length) : null
    };
  };
  return {...stats(all), clear: stats(clear), cloud: stats(cloud)};
}
// DCOMP's flag bits as the product files print them
// (OR_ABI-L2-CODC-M6_G18_s20262482021177, flag_masks and
// flag_meanings, read 2026-09-05). MEASURED on that file against
// the mask of the same minute: every retrieved pixel (COD > 0)
// carries the "degraded" and "nonconvergence" bits and every clear
// pixel the "ice phase" bit, so those three bits cannot be read by
// their names (product version v02r03, stated); the ice, thick,
// thin, glint, snow and twilight bits sort the retrievals as the
// ATBD says (ice r_eff median 41 um against water 17; thick at the
// LUT's upper bound 158.5; thin under tau 3.5). The theme reads a
// retrieval by its VALUE: fill = none, 0 = clear, > 0 = retrieved.
export const DCOMP_FLAGS = {
  notDay: 1,
  notNight: 2,
  degraded: 4,
  snow: 8,
  twilight: 16,
  nonconvergence: 32,
  glint: 64,
  ice: 128,
  thick: 256,
  thin: 512
};
export const DCOMP_COD_MAX = 158.49; // the LUT's 10^2.2, where thick clouds saturate
// The census of a DCOMP window: the retrievals (COD > 0) with
// their optical depths and effective radii, by phase, and the
// flags' counts. cod/cps physical (NaN fill); dqf the raw flags.
export function dcompCensus(cod, cps, dqf, water = null) {
  const c = {
    n: cod.length,
    fill: 0,
    clear: 0,
    retrieved: 0,
    sea: 0,
    thin: 0,
    thick: 0,
    glint: 0,
    twilight: 0,
    snow: 0,
    water: {n: 0, cod: [], cps: []},
    ice: {n: 0, cod: [], cps: []}
  };
  const all = [];
  for (let q = 0; q < cod.length; q++) {
    const v = cod[q];
    if (!Number.isFinite(v)) {
      c.fill++;
      continue;
    }
    if (v <= 0) {
      c.clear++;
      continue;
    }
    c.retrieved++;
    if (water && water[q]) c.sea++;
    const d = dqf ? dqf[q] : 0;
    if (d & DCOMP_FLAGS.thin) c.thin++;
    if (d & DCOMP_FLAGS.thick) c.thick++;
    if (d & DCOMP_FLAGS.glint) c.glint++;
    if (d & DCOMP_FLAGS.twilight) c.twilight++;
    if (d & DCOMP_FLAGS.snow) c.snow++;
    const ph = d & DCOMP_FLAGS.ice ? c.ice : c.water;
    ph.n++;
    ph.cod.push(v);
    if (Number.isFinite(cps[q])) ph.cps.push(cps[q]);
    all.push(v);
  }
  const fin = (ph) => {
    const cs = ph.cod.sort((a, b) => a - b);
    const rs = ph.cps.sort((a, b) => a - b);
    return {
      n: ph.n,
      codMedian: quantile(cs, 0.5),
      codP10: quantile(cs, 0.1),
      codP90: quantile(cs, 0.9),
      reffN: rs.length,
      reffMedian: quantile(rs, 0.5),
      reffP10: quantile(rs, 0.1),
      reffP90: quantile(rs, 0.9)
    };
  };
  const s = all.sort((a, b) => a - b);
  c.codMedian = quantile(s, 0.5);
  c.codP10 = quantile(s, 0.1);
  c.codP90 = quantile(s, 0.9);
  c.water = fin(c.water);
  c.ice = fin(c.ice);
  return c;
}
// DCOMP over the theme's own pixels (its sea, say): each theme
// pixel looked up in the DCOMP window, every NOAA pixel counted
// once, then the census - so the daemon's window (all surfaces)
// and the theme's sea read the same law.
export function dcompOverPixels(themePixels, noaa) {
  const {g, xCoord, yCoord, box, cod, cps, dqf} = noaa;
  const seen = new Set();
  const c2 = [];
  const p2 = [];
  const d2 = [];
  for (const p of themePixels) {
    const q = windowIndexOf(p.latDeg, p.lonDeg, g, xCoord, yCoord, box);
    if (q < 0 || seen.has(q)) continue;
    seen.add(q);
    c2.push(cod[q]);
    p2.push(cps ? cps[q] : NaN);
    d2.push(dqf ? dqf[q] : 0);
  }
  return dcompCensus(c2, p2, d2);
}
// DCOMP at one window index: {tau, reff, ice, thin, thick} or null
// where nothing was retrieved (clear or fill).
export function dcompAt(q, cod, cps, dqf) {
  if (q < 0 || q >= cod.length) return null;
  const v = cod[q];
  if (!Number.isFinite(v) || v <= 0) return null;
  const d = dqf ? dqf[q] : 0;
  return {
    tau: v,
    reff: Number.isFinite(cps[q]) ? cps[q] : null,
    ice: !!(d & DCOMP_FLAGS.ice),
    thin: !!(d & DCOMP_FLAGS.thin),
    thick: !!(d & DCOMP_FLAGS.thick),
    glint: !!(d & DCOMP_FLAGS.glint)
  };
}
