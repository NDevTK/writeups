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
  cps: 'ABI-L2-CPSC'
};
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
