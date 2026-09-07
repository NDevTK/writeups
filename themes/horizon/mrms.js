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
  meaning:
    'the height of the 18-dBZ radar echo top, kilometres (MSL by the MRMS convention, unverified here)',
  cadenceS: 120,
  cellDeg: 0.01,
  cellKm: 1,
  grid: {
    ni: 7000,
    nj: 3500,
    la1: 54.995,
    lo1: 230.005,
    la2: 20.005,
    lo2: 299.995
  },
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
// what the scene keeps of a window: every storm cell within the low
// deck's own reach (THE TOWERS AT THEIR PLACES, 175th: the deck's
// world is 8 km each way from the observer - roam.js's DEM_HALF_M -
// plus a cell's footprint; these paint the towers at their places),
// then the tallest cells beyond, capped
export const MRMS_NEAR_KM = 9;
export const MRMS_STORM_CAP = 300;
// the flank of a tower beyond its cell's 1-km footprint: the top falls
// this many metres per metre outward (2:1, a 63-degree wall) until it
// meets the deck's ordinary top or the ground. The radar measures each
// cell's own echo top - the flank between the last echoing cell and
// the deck is the theme's rule, stated (a cumulonimbus wall is steep
// and not vertical; the 18-dBZ top is the precipitation core's top,
// the cloud around it is not measured here)
export const MRMS_FLANK_SLOPE = 2;

/** The MRMS cell containing (lat, lon), floor(x + 0.5) as the reader;
 * null off the grid. */
export function mrmsCell(
  lat,
  lon,
  g = MRMS_FACTS.grid,
  d = MRMS_FACTS.cellDeg
) {
  const lo = ((lon % 360) + 360) % 360;
  const j = Math.floor((g.la1 - lat) / d + 0.5);
  const i = Math.floor((lo - g.lo1) / d + 0.5);
  if (j < 0 || j >= g.nj || i < 0 || i >= g.ni) return null;
  return {j, i};
}
/** The cell's centre (lat, lon) for a grid row/column. */
export function mrmsCellCentre(
  j,
  i,
  g = MRMS_FACTS.grid,
  d = MRMS_FACTS.cellDeg
) {
  let lon = g.lo1 + i * d;
  if (lon > 180) lon -= 360;
  return {lat: g.la1 - j * d, lon};
}
/** Initial bearing (deg, 0 = north, clockwise) from A to B. */
export function bearingDeg(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const dl = (lon2 - lon1) * r;
  const y = Math.sin(dl) * Math.cos(lat2 * r);
  const x =
    Math.cos(lat1 * r) * Math.sin(lat2 * r) -
    Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
/** The window's census: the cells covered, the cells with an echo,
 * the tops' median, tallest tenth and tallest, the tallest cell placed
 * by bearing and distance from the observer, the observer's own cell,
 * and the storms: every echoing cell within nearKm of the observer
 * east-west and north-south (the low deck's own world, any top,
 * tallest first), then the cells at or above MRMS_TOWER_KM beyond it,
 * tallest first, capped - each with its bearing, distance and top;
 * stormsNear counts the first kind, stormsTotal the cells at or above
 * MRMS_TOWER_KM anywhere in the window. `values` is the window
 * row-major (rows from the north), `box` the reader's. */
export function echoTopCensus(
  values,
  box,
  lat,
  lon,
  {
    towerKm = MRMS_TOWER_KM,
    cap = MRMS_STORM_CAP,
    nearKm = MRMS_NEAR_KM,
    grid = MRMS_FACTS.grid,
    cellDeg = MRMS_FACTS.cellDeg
  } = {}
) {
  const n = values.length;
  let covered = 0;
  const tops = [];
  const near = []; // every echoing cell in the deck's world
  const far = []; // the cells at or above towerKm beyond it
  let towers = 0; // the cells at or above towerKm anywhere
  let tallest = null;
  // the deck's world: a cell whose centre lies within nearKm east-west
  // and north-south of the observer (the field's own box) - every echo
  // there is kept whatever its top, since the deck's field needs the
  // flanks below the tower height as much as the cores above it
  const mLon = Math.max(111320 * Math.cos((lat * Math.PI) / 180), 1e-6);
  const isNear = (c) => {
    const p = mrmsCellCentre(c.j, c.i, grid, cellDeg);
    return (
      Math.abs((p.lon - lon) * mLon) <= nearKm * 1000 &&
      Math.abs((p.lat - lat) * 111320) <= nearKm * 1000
    );
  };
  for (let k = 0; k < n; k++) {
    const v = values[k];
    if (!(v > -3)) continue;
    covered++;
    if (v > 0) {
      tops.push(v);
      const j = box.j0 + Math.floor(k / box.cols);
      const i = box.i0 + (k % box.cols);
      const c = {j, i, km: v};
      if (v >= towerKm) towers++;
      if (isNear(c)) near.push(c);
      else if (v >= towerKm) far.push(c);
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
  // each kind tallest first; the near cells are never cut (at most
  // (2 nearKm + 1)^2 of them), the far ones are capped
  near.sort((a, b) => b.km - a.km);
  far.sort((a, b) => b.km - a.km);
  const hereK = (box.cj - box.j0) * box.cols + (box.ci - box.i0);
  const hereV = hereK >= 0 && hereK < n ? values[hereK] : NaN;
  return {
    n,
    covered,
    echo: tops.length,
    coverage: n ? covered / n : 0,
    medianKm: tops.length ? tops[tops.length >> 1] : null,
    p90Km: tops.length
      ? tops[Math.min(tops.length - 1, Math.floor(0.9 * tops.length))]
      : null,
    maxKm: tops.length ? tops[tops.length - 1] : null,
    tallest: tallest ? place(tallest) : null,
    here: {
      km: hereV > 0 ? hereV : null,
      code:
        hereV > 0
          ? 'echo'
          : hereV === -1
            ? 'no echo'
            : hereV === -3
              ? 'no coverage'
              : Number.isFinite(hereV)
                ? 'other'
                : 'off the window'
    },
    towerKm,
    nearKm,
    storms: near.concat(far.slice(0, cap)).map(place),
    stormsNear: near.length,
    stormsTotal: towers
  };
}
/**
 * THE TOWERS AT THEIR PLACES (175th): the storms as the low deck's
 * measured TOP field - RM x RM RGBA float32 (R the tower's top in the
 * deck's own units through yOf(metres), A 1 where a storm stands, a
 * zero border ring; G = 1 where the texel centre lies on an echoing
 * cell's own footprint) spanning worldM metres centred on (lat, lon). A
 * texel's top is the tallest over every cell of the cell's echo top
 * less the flank's fall (slope metres per metre) over the texel
 * centre's distance beyond the cell's cellM footprint, painted where
 * that stands above the ground; the deck decides where its ordinary
 * top is higher. cells counts the storms that touched a texel, maxKm
 * the tallest of them. Returns {data, rm, painted, cells, maxKm,
 * maxTop}. Storms are {lat, lon, km} (echoTopCensus's list).
 */
export function echoTopField(
  storms,
  lat,
  lon,
  {rm = 64, worldM = 16000, cellM = 1000, slope = MRMS_FLANK_SLOPE} = {},
  yOf = (m) => m
) {
  const data = new Float32Array(rm * rm * 4);
  const mPerTexel = worldM / rm;
  const mLon = Math.max(111320 * Math.cos((lat * Math.PI) / 180), 1e-6);
  const half = cellM / 2;
  // the field in metres first: a texel's top is the tallest of every
  // cell's top less the flank's fall over the texel centre's distance
  // beyond that cell's footprint (0 inside it)
  const topM = new Float64Array(rm * rm);
  const core = new Uint8Array(rm * rm); // 1 where a texel centre lies on a cell's own footprint
  let cells = 0;
  let maxKm = null;
  for (const s of storms || []) {
    if (!(s.km > 0)) continue;
    const hM = s.km * 1000;
    const xM = (s.lon - lon) * mLon;
    const zM = -(s.lat - lat) * 111320;
    const reach = hM / slope; // beyond this the flank has fallen to nothing
    const i0 = Math.max(
      1,
      Math.floor((xM - half - reach + worldM / 2) / mPerTexel)
    );
    const i1 = Math.min(
      rm - 2,
      Math.floor((xM + half + reach + worldM / 2) / mPerTexel)
    );
    const j0 = Math.max(
      1,
      Math.floor((zM - half - reach + worldM / 2) / mPerTexel)
    );
    const j1 = Math.min(
      rm - 2,
      Math.floor((zM + half + reach + worldM / 2) / mPerTexel)
    );
    if (i0 > i1 || j0 > j1) continue;
    let touched = false;
    for (let jj = j0; jj <= j1; jj++) {
      const rz = Math.abs((jj + 0.5) * mPerTexel - worldM / 2 - zM) - half;
      const dz = Math.max(0, rz);
      for (let ii = i0; ii <= i1; ii++) {
        const rx = Math.abs((ii + 0.5) * mPerTexel - worldM / 2 - xM) - half;
        const dx = Math.max(0, rx);
        const t = hM - slope * Math.hypot(dx, dz);
        if (t <= 0) continue;
        const k = jj * rm + ii;
        if (t > topM[k]) topM[k] = t;
        if (rx <= 1e-3 && rz <= 1e-3) core[k] = 1; // on the footprint (a millimetre's grace)
        touched = true;
      }
    }
    if (touched) {
      cells++;
      if (maxKm === null || s.km > maxKm) maxKm = s.km;
    }
  }
  let painted = 0;
  let maxTop = null;
  for (let k = 0; k < rm * rm; k++) {
    if (!(topM[k] > 0)) continue;
    const y = yOf(topM[k]);
    if (!Number.isFinite(y)) continue;
    painted++;
    data[k * 4] = y;
    data[k * 4 + 1] = core[k];
    data[k * 4 + 3] = 1;
    // maxTop is the tallest value as STORED (float32), so a march
    // bound set from it is never under the field's own top
    const y32 = data[k * 4];
    if (maxTop === null || y32 > maxTop) maxTop = y32;
  }
  return {data, rm, painted, cells, maxKm, maxTop};
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
          ? "the observer's own cell uncovered"
          : `overhead ${c.here.code}`;
  if (!c.echo)
    return `${when}${Math.round(100 * c.coverage)}% of the ${reach} cells in the mosaic, no 18-dBZ echo in any (${MRMS_FACTS.absenceCaveat}) · ${here}`;
  return (
    `${when}${c.echo.toLocaleString('en-US')} cells with an 18-dBZ echo of ${c.covered.toLocaleString('en-US')} covered ${reach} · ` +
    `tops median ${km(c.medianKm)}, tallest tenth ${km(c.p90Km)}, tallest ${km(c.maxKm)}` +
    (c.tallest
      ? ` at ${c.tallest.bearingDeg.toFixed(0)}° and ${c.tallest.distKm.toFixed(0)} km`
      : '') +
    ` · ${c.stormsTotal} cells at or above ${c.towerKm} km` +
    ` · ${here}`
  );
}
