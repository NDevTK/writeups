/**
 * mrms.js - NCEP's Multi-Radar/Multi-Sensor 2-D grids for the scene
 * (174th pass): the 18-dBZ echo top as the storms' measured heights
 * within reach of the observer, every 2 minutes at 1 km.
 *
 * WHAT IS KNOWN FROM THE SOURCE ITSELF (measured 2026-09-06 22:06Z
 * on mrms.ncep.noaa.gov): the server lists ~150 CONUS 2-D products
 * under /2D/ (EchoTop_18/30/50/60, MergedReflectivityQCComposite,
 * PrecipRate, PrecipFlag, VIL, MESH, the bright band's top and
 * bottom, NLDN lightning densities ...) plus ALASKA, HAWAII, CARIB
 * and GUAM roots; each product's latest file is
 * MRMS_<product>.latest.grib2.gz. The EchoTop_18 file (1.70 MB
 * gzipped, 1.75 MB GRIB2): discipline 209 (a local table), section 1
 * reference time to the minute, grid template 3.0 - 7000 x 3500
 * cells at 0.01 deg from 54.995 N 230.005 E (129.995 W) to 20.005 N
 * 299.995 E (60.005 W), rows from the north; product template 4.0,
 * category 3 number 44; data representation template 5.41
 * (PNG-packed), 16 bits, R = -3000, E = 0, D = 3, so value = (X -
 * 3000) / 1000: the cells hold -3 (no radar coverage: 8.2 million of
 * 24.5 million), -1 (coverage, no 18-dBZ echo) or the echo top in
 * kilometres (3.9% of the grid at 22:06Z; p50 8.1, p95 14.6, max 19).
 *
 * WHAT COULD NOT BE READ HERE, stated: the MRMS product guide and the
 * papers that define these fields (Smith et al. 2016, BAMS 97,
 * 1617-1630, "Multi-Radar Multi-Sensor (MRMS) Severe Weather and
 * Aviation Products: Initial Operating Capabilities"; the NSSL
 * operational tables) sit behind hosts this sandbox cannot reach
 * (AMS 403/404, nssl.noaa.gov blocked, vlab and NCEI 404). Only the
 * paper's abstract came through CrossRef: MRMS products "at a spatial
 * resolution of approximately 1 km, with 33 vertical levels, updating
 * every 2 min over the conterminous United States and southern
 * Canada". So this module claims only what the file and the catalogue
 * carry: the product's name says the 18-dBZ echo top; its scaling
 * says kilometres; MRMS heights are above mean sea level by the
 * system's convention, taken here and marked unverified. The bright
 * band and the precipitation-type flag were measured too (18 MB a
 * file, model-blended over 94% of the grid; a code table nobody here
 * could read) and are NOT used.
 */
import {haversineKm} from './lightning.js';

export const MRMS_FACTS = {
  source: 'NCEP MRMS 2-D grids (mrms.ncep.noaa.gov/2D)',
  product: 'EchoTop_18',
  meaning: 'the height of the 18-dBZ radar echo top, kilometres (MSL by the MRMS convention, unverified here)',
  cadenceS: 120,
  cellDeg: 0.01,
  cellKm: 1,
  grid: {ni: 7000, nj: 3500, la1: 54.995, lo1: 230.005, la2: 20.005, lo2: 299.995},
  drt: {tmpl: 41, R: -3000, E: 0, D: 3, nbits: 16},
  codes: {noCoverage: -3, noEcho: -1},
  // measured 22:26Z: a +-50-km window in the open Gulf 300 km from the
  // nearest radar came back all -1 - the mosaic's domain reaches past
  // the radars' range, so -1 marks "no echo in a cell the mosaic
  // holds", not clear air seen by a radar; an echo is a measurement,
  // its absence is not
  absenceCaveat:
    '-1 also marks cells the mosaic holds with no radar in range: an echo is a measurement, its absence is not clear air',
  documentation:
    'the MRMS product guide and Smith et al. 2016 (BAMS) were not reachable from the build sandbox; the abstract only (CrossRef): ~1 km, 33 levels, every 2 min over CONUS and southern Canada'
};
// a storm worth drawing as a tower: an 18-dBZ echo top at or above
// this height - the theme's own rule (the deep convection of the
// summer afternoon tops the freezing level by kilometres), stated
export const MRMS_TOWER_KM = 8;
// what the scene keeps of a window: the tallest cells first
export const MRMS_STORM_CAP = 300;

/** The MRMS cell containing (lat, lon), floor(x + 0.5) as the reader;
 * null off the grid. */
export function mrmsCell(lat, lon, g = MRMS_FACTS.grid, d = MRMS_FACTS.cellDeg) {
  const lo = ((lon % 360) + 360) % 360;
  const j = Math.floor((g.la1 - lat) / d + 0.5);
  const i = Math.floor((lo - g.lo1) / d + 0.5);
  if (j < 0 || j >= g.nj || i < 0 || i >= g.ni) return null;
  return {j, i};
}
/** The cell's centre (lat, lon) for a grid row/column. */
export function mrmsCellCentre(j, i, g = MRMS_FACTS.grid, d = MRMS_FACTS.cellDeg) {
  let lon = g.lo1 + i * d;
  if (lon > 180) lon -= 360;
  return {lat: g.la1 - j * d, lon};
}
/** Initial bearing (deg, 0 = north, clockwise) from A to B. */
export function bearingDeg(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const dl = (lon2 - lon1) * r;
  const y = Math.sin(dl) * Math.cos(lat2 * r);
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
/** The window's census: the cells covered, the cells with an echo,
 * the tops' median, tallest tenth and tallest, the tallest cell placed
 * by bearing and distance from the observer, the observer's own cell,
 * and the storms - the cells at or above MRMS_TOWER_KM, tallest first,
 * capped - each with its bearing, distance and top. `values` is the
 * window row-major (rows from the north), `box` the reader's. */
export function echoTopCensus(values, box, lat, lon, {towerKm = MRMS_TOWER_KM, cap = MRMS_STORM_CAP, grid = MRMS_FACTS.grid, cellDeg = MRMS_FACTS.cellDeg} = {}) {
  const n = values.length;
  let covered = 0;
  const tops = [];
  const cells = [];
  let tallest = null;
  for (let k = 0; k < n; k++) {
    const v = values[k];
    if (!(v > -3)) continue;
    covered++;
    if (v > 0) {
      tops.push(v);
      const j = box.j0 + Math.floor(k / box.cols);
      const i = box.i0 + (k % box.cols);
      if (v >= towerKm) cells.push({j, i, km: v});
      if (!tallest || v > tallest.km) tallest = {j, i, km: v};
    }
  }
  tops.sort((a, b) => a - b);
  const place = (c) => {
    const p = mrmsCellCentre(c.j, c.i, grid, cellDeg);
    return {
      km: c.km,
      lat: +p.lat.toFixed(4),
      lon: +p.lon.toFixed(4),
      distKm: +haversineKm(lat, lon, p.lat, p.lon).toFixed(1),
      bearingDeg: +bearingDeg(lat, lon, p.lat, p.lon).toFixed(1)
    };
  };
  cells.sort((a, b) => b.km - a.km);
  const hereK = (box.cj - box.j0) * box.cols + (box.ci - box.i0);
  const hereV = hereK >= 0 && hereK < n ? values[hereK] : NaN;
  return {
    n,
    covered,
    echo: tops.length,
    coverage: n ? covered / n : 0,
    medianKm: tops.length ? tops[tops.length >> 1] : null,
    p90Km: tops.length ? tops[Math.min(tops.length - 1, Math.floor(0.9 * tops.length))] : null,
    maxKm: tops.length ? tops[tops.length - 1] : null,
    tallest: tallest ? place(tallest) : null,
    here: {
      km: hereV > 0 ? hereV : null,
      code: hereV > 0 ? 'echo' : hereV === -1 ? 'no echo' : hereV === -3 ? 'no coverage' : Number.isFinite(hereV) ? 'other' : 'off the window'
    },
    towerKm,
    storms: cells.slice(0, cap).map(place),
    stormsTotal: cells.length
  };
}
/** The words for a census. */
export function echoTopWords(c, {refTimeIso = null, halfKm = null} = {}) {
  const km = (v) => (v === null ? 'none' : `${v.toFixed(1)} km`);
  const when = refTimeIso ? `${refTimeIso.slice(11, 16)}Z · ` : '';
  const reach = halfKm !== null ? `within ±${halfKm} km` : 'in the window';
  if (!c.covered)
    return `${when}no radar coverage ${reach} (${c.n} cells at -3)`;
  const here =
    c.here.code === 'echo'
      ? `overhead ${c.here.km.toFixed(1)} km`
      : c.here.code === 'no echo'
        ? 'nothing overhead'
        : c.here.code === 'no coverage'
          ? 'the observer\'s own cell uncovered'
          : `overhead ${c.here.code}`;
  if (!c.echo)
    return `${when}${Math.round(100 * c.coverage)}% of the ${reach} cells in the mosaic, no 18-dBZ echo in any (${MRMS_FACTS.absenceCaveat}) · ${here}`;
  return (
    `${when}${c.echo.toLocaleString('en-US')} cells with an 18-dBZ echo of ${c.covered.toLocaleString('en-US')} covered ${reach} · ` +
    `tops median ${km(c.medianKm)}, tallest tenth ${km(c.p90Km)}, tallest ${km(c.maxKm)}` +
    (c.tallest ? ` at ${c.tallest.bearingDeg.toFixed(0)}° and ${c.tallest.distKm.toFixed(0)} km` : '') +
    ` · ${c.stormsTotal} cells at or above ${c.towerKm} km` +
    ` · ${here}`
  );
}
