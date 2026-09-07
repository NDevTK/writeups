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
 * WHAT THE PAPER SAYS (Smith et al. 2016, BAMS 97, 1617-1630,
 * "Multi-Radar Multi-Sensor (MRMS) Severe Weather and Aviation
 * Products: Initial Operating Capabilities" - unreachable at the AMS
 * in the 174th, read in full in the 184th from NOAA's repository
 * copy, noaa_32168_DS1.pdf, 14 pp): the 3-D reflectivity mosaic is
 * blended from 143 WSR-88Ds and 30 Canadian radars by exponential
 * distance weighting onto 0.01 x 0.01 deg cells with 33 vertical
 * levels FROM 0 TO 20 KM MSL (250 m to 3 km, 500 m to 9 km, 1 km to
 * 20 km), rewritten every 2 min; an echo top is "the highest altitude
 * in the vertical column where the particular reflectivity value is
 * found (18, 30, 50, or 60 dBZ)" by Lakshmanan et al. 2013's
 * interpolation, the 18-dBZ top the aviation field for anvil
 * turbulence, the 50- and 60-dBZ tops the hail forecaster's; the
 * domain runs from 55 N 130 W to 20 N 60 W. So the height convention
 * this module took on trust in the 174th (MSL) is the paper's own
 * grid. What still could not be read: the NSSL operational tables
 * (nssl.noaa.gov blocked) and Witt et al. 1998 (AMS 403). The bright
 * band and the precipitation-type flag were measured too (18 MB a
 * file, model-blended over 94% of the grid; a code table nobody here
 * could read) and are NOT used.
 */
import {haversineKm} from './lightning.js';

export const MRMS_FACTS = {
  source: 'NCEP MRMS 2-D grids (mrms.ncep.noaa.gov/2D)',
  product: 'EchoTop_18',
  meaning:
    'the height of the 18-dBZ radar echo top, kilometres MSL (the 3-D grid runs 0-20 km MSL; Smith et al. 2016)',
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
    "Smith et al. 2016 (BAMS 97, 1617-1630; NOAA repository copy) read in full in the 184th: 0.01-deg cells, 33 levels 0-20 km MSL, every 2 min over CONUS and southern Canada, an echo top the highest altitude in the column where the reflectivity is found (Lakshmanan et al. 2013's interpolation); the NSSL tables still not reachable from the build sandbox"
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

// ---- THE RAIN AT A KILOMETRE (179th pass) ----------------------------
// NCEP's PrecipRate on the same grid and cadence as the echo top: a
// 1-km radar precipitation rate every 2 minutes, PNG-packed the same
// way (template 5.41), the file a third the size (689 kB gzipped on
// 2026-09-07 07:46Z - the field is sparse). The facts below are the
// file's own: discipline 209 category 6 number 1, R -30, E 0, D 1 -
// a count c is (c - 30) / 10 mm/h, so 0 is no coverage's -3 and 30
// is no rain; the catalogue names the product PrecipRate and the
// units follow from the scaling (a 175 mm/h maximum in that file);
// the product guide could not be read from the build sandbox
// (MRMS_FACTS.documentation). A cell that rains is measured; a cell
// at 0 under the mosaic's reach is measured dry; -3 is unmeasured.
export const MRMS_RATE_FACTS = {
  source:
    'NCEP MRMS (mrms.ncep.noaa.gov/2D/PrecipRate/MRMS_PrecipRate.latest.grib2.gz)',
  product: 'PrecipRate',
  meaning:
    "the radar precipitation rate at the surface, mm/h (the catalogue's name; the scaling the file's own)",
  cadenceS: 120,
  cellDeg: 0.01,
  cellKm: 1,
  discipline: 209,
  category: 6,
  number: 1,
  drt: {tmpl: 41, R: -30, E: 0, D: 1, words: '(count - 30) / 10 mm/h'},
  codes: {noCoverage: -3, noRain: 0},
  documentation: MRMS_FACTS.documentation
};
// what the daemon sends of a rate window: the raining cells nearest
// first, capped (the shafts take the nearest 160 within 100 km, the
// deck's cover field the cells within its own 8 km)
export const MRMS_RATE_CAP = 400;
/** The rate window's census: the cells covered and raining, the rates'
 * median, tallest tenth and max, the observer's own cell, the heaviest
 * cell placed, and the raining cells nearest first (each with lat/lon
 * - as latDeg/lonDeg too, the shafts' own names - its rate, distance
 * and bearing), capped. */
export function precipRateCensus(
  values,
  box,
  lat,
  lon,
  {
    cap = MRMS_RATE_CAP,
    grid = MRMS_FACTS.grid,
    cellDeg = MRMS_FACTS.cellDeg
  } = {}
) {
  const n = values.length;
  let covered = 0;
  const rates = [];
  const cells = [];
  let heaviest = null;
  for (let k = 0; k < n; k++) {
    const v = values[k];
    if (!(v > -3)) continue;
    covered++;
    if (v > 0) {
      rates.push(v);
      const j = box.j0 + Math.floor(k / box.cols);
      const i = box.i0 + (k % box.cols);
      cells.push({j, i, mmh: v});
      if (!heaviest || v > heaviest.mmh) heaviest = {j, i, mmh: v};
    }
  }
  rates.sort((a, b) => a - b);
  const place = (c) => {
    const p = mrmsCellCentre(c.j, c.i, grid, cellDeg);
    const la = +p.lat.toFixed(4);
    const lo = +p.lon.toFixed(4);
    return {
      mmh: c.mmh,
      lat: la,
      lon: lo,
      latDeg: la,
      lonDeg: lo,
      distKm: +haversineKm(lat, lon, p.lat, p.lon).toFixed(1),
      bearingDeg: +bearingDeg(lat, lon, p.lat, p.lon).toFixed(1)
    };
  };
  const placed = cells.map(place).sort((a, b) => a.distKm - b.distKm);
  const hereK = (box.cj - box.j0) * box.cols + (box.ci - box.i0);
  const hereV = hereK >= 0 && hereK < n ? values[hereK] : NaN;
  return {
    n,
    covered,
    raining: rates.length,
    coverage: n ? covered / n : 0,
    medianMmH: rates.length ? rates[rates.length >> 1] : null,
    p90MmH: rates.length
      ? rates[Math.min(rates.length - 1, Math.floor(0.9 * rates.length))]
      : null,
    maxMmH: rates.length ? rates[rates.length - 1] : null,
    heaviest: heaviest ? place(heaviest) : null,
    here: {
      mmh: hereV > 0 ? hereV : null,
      code:
        hereV > 0
          ? 'rain'
          : hereV === 0
            ? 'no rain'
            : hereV === -3
              ? 'no coverage'
              : Number.isFinite(hereV)
                ? 'other'
                : 'off the window'
    },
    cells: placed.slice(0, cap),
    cellsTotal: cells.length
  };
}
/** The words for a rate census. */
export function precipRateWords(c, {refTimeIso = null, halfKm = null} = {}) {
  const when = refTimeIso ? `${refTimeIso.slice(11, 16)}Z · ` : '';
  const reach = halfKm !== null ? `within ±${halfKm} km` : 'in the window';
  if (!c.covered)
    return `${when}no radar coverage ${reach} (${c.n} cells at -3)`;
  const here =
    c.here.code === 'rain'
      ? `overhead ${c.here.mmh.toFixed(1)} mm/h`
      : c.here.code === 'no rain'
        ? 'dry overhead'
        : c.here.code === 'no coverage'
          ? "the observer's own cell uncovered"
          : `overhead ${c.here.code}`;
  if (!c.raining)
    return `${when}${Math.round(100 * c.coverage)}% of the ${reach} cells in the mosaic, none raining (${MRMS_FACTS.absenceCaveat}) · ${here}`;
  return (
    `${when}${c.raining.toLocaleString('en-US')} raining cells of ${c.covered.toLocaleString('en-US')} covered ${reach} · ` +
    `rates median ${c.medianMmH.toFixed(1)} mm/h, heaviest tenth ${c.p90MmH.toFixed(1)}, heaviest ${c.maxMmH.toFixed(1)}` +
    (c.heaviest
      ? ` at ${c.heaviest.bearingDeg.toFixed(0)}° and ${c.heaviest.distKm.toFixed(0)} km`
      : '') +
    ` · the nearest ${c.cells.length ? `${c.cells[0].mmh.toFixed(1)} mm/h at ${c.cells[0].bearingDeg.toFixed(0)}° and ${c.cells[0].distKm.toFixed(0)} km` : 'none'}` +
    ` · ${here}`
  );
}
// ---- THE RADAR'S OWN DOUBT (184th pass) ------------------------------
// NCEP's RadarQualityIndex on the same grid and cadence: Zhang et al.
// 2016 (BAMS 97, 621-638, read in full from NOAA's repository copy)
// define it as the product of a blockage factor (1 with no blockage,
// falling linearly to 0 at 50% blockage; the terrain under standard
// refraction, static) and a beam-height factor (1 while the beam axis
// stands below the melting layer, falling exponentially with the beam
// height once the beam reaches it or the bright band sits on the
// ground) - "RQI = RQI_blk x RQI_hgt" in the WDTD's words - and say
// what it does NOT carry: the Z-R relation's, the calibration's and
// the attenuation's uncertainties. The file's own facts (measured
// 2026-09-07 09:42Z): discipline 209 category 8 number 0, template
// 5.41 at 8 bits, R -30 E 0 D 1 - a count c is (c - 30) / 10, so 0 is
// no coverage's -3 and the values run 0.0 to 1.0 in tenths (12
// distinct counts in the whole grid); 2.5 million cells of the 16.3
// million the mosaic holds stand at 0.0 - the domain reaches past the
// radars' useful range - and 5.4 million at 1.0.
export const MRMS_RQI_FACTS = {
  source:
    'NCEP MRMS (mrms.ncep.noaa.gov/2D/RadarQualityIndex/MRMS_RadarQualityIndex.latest.grib2.gz)',
  product: 'RadarQualityIndex',
  meaning:
    "the radar QPE's quality index, 0 (no usable beam) to 1 (the beam unblocked and below the melting layer): RQI = RQI_blk x RQI_hgt (Zhang et al. 2016)",
  cadenceS: 120,
  cellDeg: 0.01,
  cellKm: 1,
  discipline: 209,
  category: 8,
  number: 0,
  drt: {
    tmpl: 41,
    R: -30,
    E: 0,
    D: 1,
    nbits: 8,
    words: '(count - 30) / 10, an 8-bit count; the scaling is read from each file'
  },
  codes: {noCoverage: -3},
  law: {
    blockage:
      'RQI_blk = 1 with no beam blockage, falling linearly to 0 at 50% blockage (the terrain under standard refraction; static)',
    height:
      'RQI_hgt = 1 while the beam axis stands below the melting layer, falling exponentially with the beam height once the beam reaches it or the bright band sits on the ground',
    caveat:
      "the RQI carries the beam's sampling only - blockage, height and the melting layer - not the Z-R relation, the calibration or the attenuation (Zhang et al. 2016)"
  },
  documentation:
    "Zhang et al. 2016 (BAMS 97, 621-638; NOAA repository copy) read in full in the 184th, with the WDTD's RQI page; Zhang et al. 2012 (Weather Radar and Hydrology 351, 388-393), the index's own paper, not reachable from the build sandbox"
};
/** The quality window's census: the cells covered, the observer's own
 * cell, the covered cells' median, mean, range and histogram by
 * tenths, and the share below a half - the theme's own summary of the
 * window, the meaning the paper's. */
export function rqiCensus(values, box, lat, lon) {
  const n = values.length;
  let covered = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  let belowHalf = 0;
  const hist = new Array(11).fill(0);
  const vs = [];
  for (let k = 0; k < n; k++) {
    const v = values[k];
    if (!(v > -3)) continue;
    covered++;
    sum += v;
    vs.push(v);
    if (v < min) min = v;
    if (v > max) max = v;
    if (v < 0.5) belowHalf++;
    const bin = Math.round(v * 10);
    if (bin >= 0 && bin <= 10) hist[bin]++;
  }
  vs.sort((a, b) => a - b);
  const hereK = (box.cj - box.j0) * box.cols + (box.ci - box.i0);
  const hereV = hereK >= 0 && hereK < n ? values[hereK] : NaN;
  return {
    n,
    covered,
    coverage: n ? covered / n : 0,
    medianRqi: vs.length ? vs[vs.length >> 1] : null,
    meanRqi: vs.length ? +(sum / vs.length).toFixed(4) : null,
    minRqi: vs.length ? min : null,
    maxRqi: vs.length ? max : null,
    belowHalf,
    belowHalfShare: vs.length ? belowHalf / vs.length : null,
    hist,
    here: {
      rqi: hereV > -3 ? hereV : null,
      code:
        hereV > -3
          ? 'rqi'
          : hereV === -3
            ? 'no coverage'
            : Number.isFinite(hereV)
              ? 'other'
              : 'off the window'
    }
  };
}
/** The words for a quality census. */
export function rqiWords(c, {refTimeIso = null, halfKm = null} = {}) {
  const when = refTimeIso ? `${refTimeIso.slice(11, 16)}Z · ` : '';
  const reach = halfKm !== null ? `within ±${halfKm} km` : 'in the window';
  if (!c.covered)
    return `${when}no radar coverage ${reach} (${c.n} cells at -3)`;
  const here =
    c.here.code === 'rqi'
      ? `RQI ${c.here.rqi.toFixed(1)} at the observer's own cell`
      : c.here.code === 'no coverage'
        ? "the observer's own cell uncovered"
        : `the observer's cell ${c.here.code}`;
  return (
    `${when}${here} · ${c.covered.toLocaleString('en-US')} covered cells ${reach}: median ${c.medianRqi.toFixed(1)}, mean ${c.meanRqi.toFixed(2)}, ${c.minRqi.toFixed(1)}-${c.maxRqi.toFixed(1)}, ` +
    `${Math.round(100 * c.belowHalfShare)}% below 0.5` +
    ` · ${MRMS_RQI_FACTS.law.caveat}`
  );
}
// ---- THE HAIL'S SIZE (184th pass) -------------------------------------
// NCEP's MESH - the maximum estimated size of hail - on the same grid
// and cadence. Smith et al. 2016 (BAMS 97, 1617-1630, read in full
// from NOAA's repository copy): "an estimate of hail size that is
// based on the vertical profiles of radar reflectivity and
// environmental temperature (Witt et al. 1998; Lakshmanan et al.
// 2006b) ... calculated for each horizontal grid point; thus, the data
// show the spatial extent and hail-size distribution of hail cores
// within thunderstorms". The WDTD's MESH and SHI pages (read): the
// Severe Hail Index is a thermally weighted vertical integral of the
// hail kinetic energy flux from the 3-D reflectivity, the reflectivity
// weighted between 40 and 50 dBZ and the temperature between the 0 and
// -20 C heights of the model analysis, and MESH is a fit to it,
// computed in millimetres; it underestimates in tilted storms under
// strong shear, left-moving supercells, giant bounded weak echo
// regions and low-density dry hail, and carries the model profile's
// biases. Witt et al. 1998 (Wea. Forecasting 13, 286-303), the
// algorithm's own paper, sits behind an AMS host this sandbox cannot
// reach (403): the fit's constants are NOT claimed here. The file's
// own facts (measured 2026-09-07 09:42Z): discipline 209 category 3
// number 28, template 5.41 at 8 bits, R -30 E 0 D 1 - a count c is (c
// - 30) / 10 mm, so 0 is no coverage's -3, 20 is -1 (covered, no
// hail) and 7,864 cells held 0.8-20.5 mm; an 8-bit count at this
// scaling reaches 22.5 mm, and whether the packer rescales for larger
// hail is unmeasured (the scaling is read from each file).
export const MRMS_MESH_FACTS = {
  source: 'NCEP MRMS (mrms.ncep.noaa.gov/2D/MESH/MRMS_MESH.latest.grib2.gz)',
  product: 'MESH',
  meaning:
    'the maximum estimated size of hail, mm - a thermally weighted vertical integral of the 3-D reflectivity between the 0 and -20 C heights (the Severe Hail Index of Witt et al. 1998, the reflectivity weighted between 40 and 50 dBZ) fitted to hail size (Smith et al. 2016; the WDTD)',
  cadenceS: 120,
  cellDeg: 0.01,
  cellKm: 1,
  discipline: 209,
  category: 3,
  number: 28,
  drt: {
    tmpl: 41,
    R: -30,
    E: 0,
    D: 1,
    nbits: 8,
    words:
      '(count - 30) / 10 mm, an 8-bit count (22.5 mm at most at this scaling; the scaling is read from each file)'
  },
  codes: {noCoverage: -3, noHail: -1},
  limits:
    "underestimates in tilted storms under strong deep-layer shear, left-moving supercells, giant bounded weak echo regions and low-density dry hail, and carries the model temperature profile's biases (the WDTD's MESH page)",
  documentation:
    "Smith et al. 2016 (BAMS 97, 1617-1630; NOAA repository copy) read in full in the 184th, with the WDTD's MESH and SHI pages; Witt et al. 1998 (Wea. Forecasting 13, 286-303) not reachable from the build sandbox (AMS 403), so the fit's constants are not claimed"
};
// what the daemon sends of a hail window: the hail cells nearest
// first, capped (the shafts within 100 km are 160 at most)
export const MRMS_HAIL_CAP = 200;
/** The hail window's census: the cells covered and holding hail, the
 * sizes' median, largest tenth and largest, the largest cell placed,
 * the observer's own cell, and the hail cells nearest first (each
 * with lat/lon - as latDeg/lonDeg too - its size, distance and
 * bearing), capped. */
export function meshCensus(
  values,
  box,
  lat,
  lon,
  {
    cap = MRMS_HAIL_CAP,
    grid = MRMS_FACTS.grid,
    cellDeg = MRMS_FACTS.cellDeg
  } = {}
) {
  const n = values.length;
  let covered = 0;
  const sizes = [];
  const cells = [];
  let largest = null;
  for (let k = 0; k < n; k++) {
    const v = values[k];
    if (!(v > -3)) continue;
    covered++;
    if (v > 0) {
      sizes.push(v);
      const j = box.j0 + Math.floor(k / box.cols);
      const i = box.i0 + (k % box.cols);
      cells.push({j, i, mm: v});
      if (!largest || v > largest.mm) largest = {j, i, mm: v};
    }
  }
  sizes.sort((a, b) => a - b);
  const place = (c) => {
    const p = mrmsCellCentre(c.j, c.i, grid, cellDeg);
    const la = +p.lat.toFixed(4);
    const lo = +p.lon.toFixed(4);
    return {
      mm: c.mm,
      lat: la,
      lon: lo,
      latDeg: la,
      lonDeg: lo,
      distKm: +haversineKm(lat, lon, p.lat, p.lon).toFixed(1),
      bearingDeg: +bearingDeg(lat, lon, p.lat, p.lon).toFixed(1)
    };
  };
  const placed = cells.map(place).sort((a, b) => a.distKm - b.distKm);
  const hereK = (box.cj - box.j0) * box.cols + (box.ci - box.i0);
  const hereV = hereK >= 0 && hereK < n ? values[hereK] : NaN;
  return {
    n,
    covered,
    hail: sizes.length,
    coverage: n ? covered / n : 0,
    medianMm: sizes.length ? sizes[sizes.length >> 1] : null,
    p90Mm: sizes.length
      ? sizes[Math.min(sizes.length - 1, Math.floor(0.9 * sizes.length))]
      : null,
    maxMm: sizes.length ? sizes[sizes.length - 1] : null,
    largest: largest ? place(largest) : null,
    here: {
      mm: hereV > 0 ? hereV : null,
      code:
        hereV > 0
          ? 'hail'
          : hereV > -3
            ? 'no hail'
            : hereV === -3
              ? 'no coverage'
              : Number.isFinite(hereV)
                ? 'other'
                : 'off the window'
    },
    cells: placed.slice(0, cap),
    cellsTotal: cells.length
  };
}
/** The words for a hail census. */
export function meshWords(c, {refTimeIso = null, halfKm = null} = {}) {
  const when = refTimeIso ? `${refTimeIso.slice(11, 16)}Z · ` : '';
  const reach = halfKm !== null ? `within ±${halfKm} km` : 'in the window';
  if (!c.covered)
    return `${when}no radar coverage ${reach} (${c.n} cells at -3)`;
  const here =
    c.here.code === 'hail'
      ? `hail ${c.here.mm.toFixed(1)} mm overhead`
      : c.here.code === 'no hail'
        ? 'no hail overhead'
        : c.here.code === 'no coverage'
          ? "the observer's own cell uncovered"
          : `overhead ${c.here.code}`;
  if (!c.hail)
    return `${when}no hail ${reach} (${c.covered.toLocaleString('en-US')} covered cells, none with hail) · ${here}`;
  return (
    `${when}${c.hail.toLocaleString('en-US')} hail cells of ${c.covered.toLocaleString('en-US')} covered ${reach} · ` +
    `sizes median ${c.medianMm.toFixed(1)} mm, largest tenth ${c.p90Mm.toFixed(1)}, largest ${c.maxMm.toFixed(1)}` +
    (c.largest
      ? ` at ${c.largest.bearingDeg.toFixed(0)}° and ${c.largest.distKm.toFixed(0)} km`
      : '') +
    ` · the nearest ${c.cells.length ? `${c.cells[0].mm.toFixed(1)} mm at ${c.cells[0].bearingDeg.toFixed(0)}° and ${c.cells[0].distKm.toFixed(0)} km` : 'none'}` +
    ` · ${here}`
  );
}
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
