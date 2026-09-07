/**
 * rainshafts.js - the rain the satellite measures, seen falling where
 * it falls. NOAA's rainfall rate pixels within reach of the view
 * (goesl2.rainList, navigated to their places by the fixed grid's
 * own equations) become rain shafts: a grey curtain hung from the
 * cloud base to the ground at each pixel's bearing and distance,
 * its opacity the optical depth of the rain itself. Pure JS (no
 * renderer import), gated by rainshafts-reference.mjs; the theme
 * places and draws them.
 *
 * THE LAW: Atlas (1953), "Optical extinction by rainfall", J.
 * Meteor. 10, 486-488 - the extinction coefficient of rain per
 * kilometre of path from the Marshall-Palmer drop spectrum:
 * sigma_e = 0.25 R^0.63 km^-1 for Bergeron-process rain (R in
 * mm/h), an order of magnitude more for orographic rain (a between
 * 1.25 and 2.6) - as quoted by two open sources (US patent 9,621,265
 * and Reyes et al. 2025, Atmosfera; the AMS page itself is behind a
 * wall, stated). A shaft seen through its own 2-km pixel has optical
 * depth tau = sigma_e L; what the eye sees of the world behind it is
 * exp(-tau), so the curtain's opacity is 1 - exp(-tau): 1 mm/h
 * through 2 km is 0.39, 10 mm/h 0.88, drizzle at 0.2 mm/h 0.18.
 * Koschmieder's 3/sigma gives the visibility inside the rain (12 km
 * at 1 mm/h, 2.8 km at 10) - stated beside it, not drawn.
 */
import {rangeBearing} from './wildfire.js';
import {mrmsCell, MRMS_CUBE_LEVELS_KM, zrKind, zrRate} from './mrms.js';

export const RAIN_EXTINCTION = {
  source: 'Atlas 1953, J. Meteor. 10, 486-488',
  a: 0.25, // km^-1 at 1 mm/h, Bergeron-process rain
  b: 0.63,
  orographicA: [1.25, 2.6],
  pixelPathKm: 2, // the ABI pixel the shaft is measured over
  koschmieder: 3 // MOR = 3 / sigma (contrast threshold 0.05)
};

/** Atlas's extinction coefficient (km^-1) at a rain rate (mm/h). */
export function rainExtinctionPerKm(
  mmh,
  a = RAIN_EXTINCTION.a,
  b = RAIN_EXTINCTION.b
) {
  return mmh > 0 ? a * Math.pow(mmh, b) : 0;
}

/** The optical depth of a path (km) through rain at a rate. */
export function rainOpticalDepth(mmh, pathKm = RAIN_EXTINCTION.pixelPathKm) {
  return rainExtinctionPerKm(mmh) * pathKm;
}

/** What a curtain of rain hides: 1 - exp(-tau) over the pixel's path. */
export function shaftOpacity(mmh, pathKm = RAIN_EXTINCTION.pixelPathKm) {
  return 1 - Math.exp(-rainOpticalDepth(mmh, pathKm));
}

/** Koschmieder's meteorological optical range inside the rain (km). */
export function rainVisibilityKm(mmh) {
  const s = rainExtinctionPerKm(mmh);
  return s > 0 ? RAIN_EXTINCTION.koschmieder / s : Infinity;
}

// ---- THE SNOW'S CURTAIN (185th pass) ----------------------------------
// A cell the radar calls snow is not rain: Rasmussen, Vivekanandan,
// Cole, Myers and Masters 1999, "The estimation of snowfall rate
// using visibility", J. Appl. Meteor. 38, 1542-1563 (NCAR's OpenSky
// copy read in full; the AMS page is behind a wall) derive, for
// aggregates whose bulk density falls as one over the diameter (rho_s
// D = C3, Holroyd 1971 for dry snow, Rogers 1974 for wet or rimed),
// the snowfall rate against the visibility independent of the size
// distribution: S = 1.3 C3 Vt / Vis (their Eq. 13; S the liquid
// equivalent in cm/s, Vt the fall speed in cm/s, Vis in cm, C3 in
// g/cm^2 - the 1.3 is Koschmieder's 3.912 over 3, their Eq. 3 with a
// contrast threshold of 0.02). So the extinction coefficient is sigma
// = 3 S / (C3 Vt). Dry aggregates: C3 0.017 g/cm^2 and Vt 100 cm/s;
// wet or rimed: 0.072 and 200 - a factor of 8.5 in visibility at the
// same rate (the paper's Fig. 10 reads 0.3 km dry and 2.6 km wet at
// 2 mm/h; Eq. 13 gives 0.40 and 3.37 - the text's readings of a
// log-log plot, stated). Their Table 6 splits the wetter case at -1
// C (at or above it wet snow and riming are the more frequent), which
// is the caller's rule here. What the paper says the law is NOT: a
// unique relation - crystal type, riming, aggregation and wetness
// spread the visibility at one rate over a factor of 3 to 10 storm to
// storm, and the eye sees a 25-candle light at night about twice as
// far as a black object by day at the same extinction (Allard's law
// against Koschmieder's; their Sec. 6). The curtain drawn here is the
// aggregates' law for the radar's liquid-equivalent rate - measured
// rate, stated law, the scatter stated.
export const SNOW_EXTINCTION = {
  source:
    'Rasmussen, Vivekanandan, Cole, Myers and Masters 1999, J. Appl. Meteor. 38, 1542-1563 (Eq. 13; NCAR OpenSky copy read in full)',
  eq: 13,
  koschmieder: 3.912, // the paper's Eq. 3 (a contrast threshold of 0.02)
  dry: {
    c3: 0.017,
    vtCmS: 100,
    words:
      'dry aggregates - unmelted, unrimed (Holroyd 1971 / Magono and Nakamura 1965)'
  },
  wet: {c3: 0.072, vtCmS: 200, words: 'wet or rimed aggregates (Rogers 1974)'},
  wetAtOrAboveC: -1, // the paper's Table 6 split
  fig10Km: {dry: 0.3, wet: 2.6, atMmH: 2}, // the text's readings of Fig. 10
  scatter:
    'a factor of 3 to 10 in visibility at one rate storm to storm (crystal type, riming, aggregation, wetness); the night eye sees about twice as far',
  nwsIntensity: {heavyKmMax: 0.402, moderateKmMax: 1.0} // 1/4 and 5/8 statute miles
};
/** Rasmussen 1999's extinction coefficient (km^-1) at a liquid
 * equivalent snowfall rate (mm/h): sigma = 3 S / (C3 Vt) in cgs. */
export function snowExtinctionPerKm(mmh, {wet = false} = {}) {
  if (!(mmh > 0)) return 0;
  const p = wet ? SNOW_EXTINCTION.wet : SNOW_EXTINCTION.dry;
  const sCmS = mmh / 10 / 3600;
  return ((3 * sCmS) / (p.c3 * p.vtCmS)) * 1e5;
}
/** The optical depth of a path (km) through snow at a rate. */
export function snowOpticalDepth(
  mmh,
  opts = {},
  pathKm = RAIN_EXTINCTION.pixelPathKm
) {
  return snowExtinctionPerKm(mmh, opts) * pathKm;
}
/** The paper's own visibility (km) inside the snow, Eq. 13 turned
 * round: Vis = 1.304 C3 Vt / S. */
export function snowVisibilityKm(mmh, opts = {}) {
  const s = snowExtinctionPerKm(mmh, opts);
  return s > 0 ? SNOW_EXTINCTION.koschmieder / s : Infinity;
}
/** The MRMS precipitation types that are snow: 3 (snow) and 4 (snow
 * at the ground with the beam 1.5 km or more above it). */
export function isSnowKind(kind) {
  return kind === 3 || kind === 4;
}

/**
 * The raining pixels within maxKm of (lat, lon) as shafts: each with
 * its distance, bearing, rate, optical depth and opacity, nearest
 * first, capped. Pixels under minMmH (drizzle the eye would not see
 * as a curtain) are left out; a degraded pixel (past the zenith
 * block-out) is kept and flagged.
 */
export function rainShaftsNear(
  list,
  lat,
  lon,
  {maxKm = 100, cap = 160, minMmH = 0.2, wetSnow = false} = {}
) {
  const out = [];
  for (const p of list || []) {
    if (!(p.mmh >= minMmH)) continue;
    const rb = rangeBearing(lat, lon, p.latDeg, p.lonDeg);
    if (rb.distKm > maxKm) continue;
    // THE RAIN'S KIND (185th): a cell the radar calls snow (MRMS
    // PrecipFlag 3, or 4 with the beam high) takes Rasmussen 1999's
    // extinction for its liquid-equivalent rate, dry or wet by the
    // caller's surface temperature; every other kind - and a cell
    // without a kind - Atlas's rain
    const snow = isSnowKind(p.kind);
    const tau = snow
      ? snowOpticalDepth(p.mmh, {wet: wetSnow})
      : rainOpticalDepth(p.mmh);
    out.push({
      lat: p.latDeg,
      lon: p.lonDeg,
      mmh: p.mmh,
      quality: p.quality ?? 'good',
      kind: Number.isFinite(p.kind) ? p.kind : null,
      law: snow ? (wetSnow ? 'snow-wet' : 'snow-dry') : 'rain',
      distKm: rb.distKm,
      bearingDeg: rb.bearingDeg,
      tau,
      opacity: 1 - Math.exp(-tau)
    });
  }
  out.sort((a, b) => a.distKm - b.distKm);
  return out.slice(0, cap);
}

/** The shafts' words for a line: how many, the nearest, the heaviest,
 * and since the 185th how many took the snow law and how many the
 * rain's. */
export function rainShaftsSummary(shafts) {
  if (!shafts || !shafts.length) return null;
  let heaviest = shafts[0];
  let snow = 0;
  let typed = 0;
  for (const s of shafts) {
    if (s.mmh > heaviest.mmh) heaviest = s;
    if (s.law && s.law !== 'rain') snow++;
    if (Number.isFinite(s.kind)) typed++;
  }
  const nearest = shafts[0];
  return {
    n: shafts.length,
    nearestKm: nearest.distKm,
    nearestBearingDeg: nearest.bearingDeg,
    nearestMmH: nearest.mmh,
    heaviestMmH: heaviest.mmh,
    heaviestKm: heaviest.distKm,
    heaviestOpacity: heaviest.opacity,
    snow,
    rain: shafts.length - snow,
    typed
  };
}

// ---- THE RAIN'S COVER WHERE NO RADAR SEES (167th pass) --------------
// The decks' measured cover field (the radar's, RM x RM texels over
// the world box, R = the local cover mapped from the rain rate: 0.95
// x smoothstep(rate, 0.05, 1)) says nothing under RainViewer's black.
// The satellite's raining pixels give the same field the same way:
// each pixel's 2-km footprint splatted over the texels it covers
// (equirectangular offsets from the observer, +x east, +z south, the
// mapping roam.geoToScene uses), the strongest rate keeping a texel,
// a zero border ring so the field fades at the world edge.
export const COVER_RATE_FLOOR_MMH = 0.05; // below drizzle nothing shows
export const COVER_RATE_FULL_MMH = 1; // saturate toward the cap by 1 mm/h
export const COVER_CAP = 0.95;
const M_LAT = 111320;
const smooth = (x, a, b) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** The local cover a rain rate maps to (the radar field's own rule). */
export function coverOfRate(mmh) {
  return COVER_CAP * smooth(mmh, COVER_RATE_FLOOR_MMH, COVER_RATE_FULL_MMH);
}
/**
 * The satellite's cover field: RM x RM RGBA float32 (R the cover, A
 * 1) spanning worldM metres centred on (lat, lon). Each raining pixel
 * within the box paints the texels its pixelM footprint touches with
 * coverOfRate, the larger value keeping a texel; the border ring
 * stays zero. Returns {data, rm, painted, pixels}.
 */
export function rainCoverField(
  list,
  lat,
  lon,
  {rm = 64, worldM = 16000, pixelM = 2000} = {}
) {
  const data = new Float32Array(rm * rm * 4);
  for (let k = 3; k < data.length; k += 4) data[k] = 1;
  const mPerTexel = worldM / rm;
  const mLon = Math.max(M_LAT * Math.cos((lat * Math.PI) / 180), 1e-6);
  let painted = 0;
  let pixels = 0;
  const half = pixelM / 2;
  for (const p of list || []) {
    const cover = coverOfRate(p.mmh);
    if (!(cover > 0)) continue;
    const xM = (p.lonDeg - lon) * mLon;
    const zM = -(p.latDeg - lat) * M_LAT;
    if (Math.abs(xM) > worldM / 2 + half || Math.abs(zM) > worldM / 2 + half)
      continue;
    pixels++;
    // the footprint [a, b) touches texels floor(a/T) .. ceil(b/T) - 1: a
    // pixel ending exactly on a texel edge does not paint the texel beyond
    // (an epsilon of a millionth of a texel keeps a footprint that ends
    // on a texel edge, to floating error, on its own side of it)
    const EPS = 1e-6;
    const i0 = Math.floor((xM - half + worldM / 2) / mPerTexel + EPS);
    const i1 = Math.ceil((xM + half + worldM / 2) / mPerTexel - EPS) - 1;
    const j0 = Math.floor((zM - half + worldM / 2) / mPerTexel + EPS);
    const j1 = Math.ceil((zM + half + worldM / 2) / mPerTexel - EPS) - 1;
    for (let jj = Math.max(j0, 1); jj <= Math.min(j1, rm - 2); jj++)
      for (let ii = Math.max(i0, 1); ii <= Math.min(i1, rm - 2); ii++) {
        const k = (jj * rm + ii) * 4;
        if (data[k] === 0) painted++;
        if (cover > data[k]) data[k] = cover;
      }
  }
  return {data, rm, painted, pixels};
}
/**
 * The merged measured cover: the radar's texel where the radar sees
 * it (covered[k] true), the satellite's where it does not. Returns
 * {data, fromRadar, fromSatellite} - the counts of texels each
 * measurement gave a cover above zero.
 */
export function mergeCoverFields(radar, satellite, covered, rm) {
  const data = new Float32Array(rm * rm * 4);
  let fromRadar = 0;
  let fromSatellite = 0;
  for (let t = 0; t < rm * rm; t++) {
    const k = t * 4;
    const useRadar = !covered || covered[t];
    const src = useRadar ? radar : satellite;
    data[k] = src ? src[k] : 0;
    data[k + 3] = 1;
    if (data[k] > 0) {
      if (useRadar) fromRadar++;
      else fromSatellite++;
    }
  }
  return {data, fromRadar, fromSatellite};
}

// ---------------------------------------------------------------
// THE STORM'S BODY (187th pass): the cube's extinction. Each cell of
// NCEP's 3-D reflectivity mosaic (mrms.js: MRMS_CUBE_FACTS) gives a
// rain rate by Zhang et al. 2016's relation for its PrecipFlag kind
// (mrms.zrRate) and that rate an extinction: Atlas 1953's for rain
// under the freezing level, Rasmussen et al. 1999's dry aggregates
// (snowExtinctionPerKm) above it - the theme's two laws already gated
// here. The field over the roam box: rm x rm texels at each of the
// heights asked (metres MSL - the page's own scene-y slices), each
// texel's cell looked up in the cube's window and its level the
// nearest of the 33 to the height; the extinction in 1/km packed to a
// byte at CUBE_EXTINCTION.codeScale. Where the cube has no coverage or
// no echo the texel is 0: the radar sees precipitation-sized particles
// only, so the field is a FLOOR under the deck's own density where the
// storm is filled with precipitation, never a ceiling (the caveat in
// mrms.MRMS_CUBE_FACTS.law); the bright band's enhanced reflectivity
// under the freezing level reads as heavier rain there (stated).
// ---------------------------------------------------------------
export const CUBE_EXTINCTION = {
  source:
    "Zhang et al. 2016's Z-R relations (mrms.MRMS_ZR) with Atlas 1953 (RAIN_EXTINCTION) under the freezing level and Rasmussen et al. 1999 (SNOW_EXTINCTION, dry aggregates) above it",
  codeScale: 25, // a byte holds 0-10.2 /km at 0.04 /km
  words:
    "a cell's rain rate from its reflectivity by the kind's Z-R relation, then the rate's extinction by the rain law under the freezing level and the snow law above it"
};
/** The extinction (1/km) of a cell's reflectivity for a kind: 0 where
 * the cube has no coverage or no echo. */
export function cubeExtinctionPerKm(
  dbz,
  kind = 'stratiform',
  {frozen = false, wet = false} = {}
) {
  const mmh = zrRate(dbz, kind);
  if (!(mmh > 0)) return 0;
  return frozen
    ? snowExtinctionPerKm(mmh, {wet})
    : rainExtinctionPerKm(mmh);
}
/** The nearest of the cube's levels (index) to a height in metres MSL. */
export function cubeLevelAt(hM, levelsKm = MRMS_CUBE_LEVELS_KM) {
  let best = 0;
  let bd = Infinity;
  for (let k = 0; k < levelsKm.length; k++) {
    const d = Math.abs(levelsKm[k] * 1000 - hM);
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  return best;
}
/**
 * The extinction field over the roam box: rm x rm texels spanning
 * worldM metres centred on (lat, lon) at each height of heightsM
 * (metres MSL), packed height-major as bytes (extinction x codeScale,
 * capped 255). levels: the cube's windows (mrms.cubeUnpack's arrays)
 * on `box`; kinds: the PrecipFlag window on the same box (or null:
 * stratiform); freezingM: the column's 0 C height (null: rain at every
 * level); wet: the snow law's wet aggregates. Returns {data, rm, nz,
 * painted (texels with any extinction), maxPerKm, cells (echoing
 * cells the box's texels fell in)}.
 */
export function cubeExtinctionField(
  levelsKm,
  levels,
  box,
  lat,
  lon,
  heightsM,
  {
    rm = 64,
    worldM = 16000,
    kinds = null,
    freezingM = null,
    wet = false,
    codeScale = CUBE_EXTINCTION.codeScale,
    echoDbz = 5,
    grid = undefined, // the cube's own grid (a vendored crop's, in the gate)
    cellDeg = undefined
  } = {}
) {
  const nz = heightsM.length;
  const data = new Uint8Array(nz * rm * rm);
  const mPerTexel = worldM / rm;
  const mLon = Math.max(111320 * Math.cos((lat * Math.PI) / 180), 1e-6);
  const levelOf = heightsM.map((h) => cubeLevelAt(h, levelsKm));
  const frozenAt = heightsM.map((h) => freezingM !== null && h > freezingM);
  const cellsSeen = new Set();
  let painted = 0;
  let maxPerKm = 0;
  const cache = new Map(); // "q,k" -> byte
  for (let jj = 0; jj < rm; jj++) {
    const zM = (jj + 0.5) * mPerTexel - worldM / 2;
    const cLat = lat - zM / 111320;
    for (let ii = 0; ii < rm; ii++) {
      const xM = (ii + 0.5) * mPerTexel - worldM / 2;
      const cLon = lon + xM / mLon;
      const cell = mrmsCell(cLat, cLon, grid, cellDeg);
      if (!cell) continue;
      const r = cell.j - box.j0;
      const c = cell.i - box.i0;
      if (r < 0 || c < 0 || r >= box.rows || c >= box.cols) continue;
      const q = r * box.cols + c;
      const kind = kinds ? zrKind(kinds[q]) : 'stratiform';
      let any = false;
      for (let z = 0; z < nz; z++) {
        const k = levelOf[z];
        const ck = q * 64 + k;
        let byte = cache.get(ck);
        if (byte === undefined) {
          const dbz = levels[k][q];
          const beta =
            dbz >= echoDbz
              ? cubeExtinctionPerKm(dbz, kind, {frozen: frozenAt[z], wet})
              : 0;
          byte = Math.min(255, Math.round(beta * codeScale));
          cache.set(ck, byte);
          if (beta > maxPerKm) maxPerKm = beta;
        }
        if (byte > 0) {
          any = true;
          cellsSeen.add(q);
        }
        data[z * rm * rm + jj * rm + ii] = byte;
      }
      if (any) painted++;
    }
  }
  return {data, rm, nz, painted, maxPerKm, cells: cellsSeen.size};
}
