/**
 * daylight.js - THE DAYLIGHT FIELD (159th pass): the visible band
 * shaping the cloud decks inside the mask's cloud.
 *
 * The decks' texel field (goesir.deckField) is the band-13 mosaic's
 * 2-km classes: a texel is cloud or clear whole. By day the ABI's
 * band 2 (0.64 um) sees the same sky at 500 m - the one 500-m band,
 * every five minutes over CONUS - and a partly filled 2-km pixel
 * reflects the linear mix of its clear and cloudy parts. This module
 * composes the gated laws into that field:
 *
 *  - goesl2.solarGeometry / cosSolarZenith: the sun over every 500-m
 *    pixel at the file's scan time (the USNO series, held to Meeus);
 *  - goesl2.reflectanceOfFactor: the CMIP ATBD's Eq. 3-3 inverted -
 *    the reflectance from the file's reflectance factor and the
 *    pixel's own cos(solar zenith);
 *  - goesl2.visReferences: the scene's OWN clear reflectance and its
 *    COVERAGE EDGE, sorted by the mask - NOAA's ACM at the same scan
 *    angles when a mask window stands (the two windows lie on one
 *    fixed grid: a 500-m pixel's angle falls in one 2-km pixel), else
 *    the theme's own band-13 field; the result says which. The edge
 *    (160th pass) is Otsu's threshold between the sub-pixel gaps and
 *    the cloud when the cloudy pixels are two modes, else the one
 *    mode's dim tenth - so a solid deck or a veil stays whole and
 *    only true gaps and edges read partial;
 *  - goesl2.coverFraction: each fine texel's position between them;
 *  - goesir.refineDeckField: the coarse field split four ways, the
 *    fraction applied only where the coarse texel holds cloud - the
 *    mask decides where cloud is, the visible band shapes it inside.
 *
 * Nothing here is quoted: the references are measured from the
 * window itself, the sun computed, the fraction clamped. Where no
 * reflectance stands (night, fill, a low sun, off the window) the
 * coarse cover is kept, so the field degrades to the 143rd pass's.
 * Gated by daylight-reference.mjs on synthetic windows on the real
 * fixed grid.
 */
import {
  cosSolarZenith,
  coverFraction,
  fixedGridToLatLon,
  indexOfScanAngle,
  reflectanceOfFactor,
  solarGeometry,
  visReferences,
  windowIndexOf
} from './goesl2.js';
import {CLS, mercatorLatLon, mercatorPx, refineDeckField} from './goesir.js';

// the split: four 500-m texels across a 2-km one
export const DAYLIGHT_FACTOR = 4;
// the day: the observer's solar zenith under this (the LST ATBD's own
// day rule, 85 deg); the pixel's own sun must keep cos above minCos
// (goesl2.reflectanceOfFactor's 0.05, 87 deg) besides
export const DAYLIGHT_SZA_MAX_DEG = 85;
// a "good" or "conditionally usable" flag reads; the rest are NaN
export const DAYLIGHT_DQF_MAX = 1;

/** The scan angles of a window pixel q (its absolute grid index from
 * the box). */
export function windowScanAngles(win, q) {
  const cols = win.box.cols;
  const i = win.box.i0 + (q % cols);
  const j = win.box.j0 + Math.floor(q / cols);
  return {x: win.x.offset + i * win.x.scale, y: win.y.offset + j * win.y.scale};
}

/**
 * The mask's word for a visible pixel: NOAA's ACM window at the same
 * scan angles. true clear-or-probably-clear, false cloudy-or-probably
 * -cloudy (DQF 0 only), null where the mask window does not reach or
 * its flag is not good. Both windows must be one satellite's.
 */
export function maskClearOf(vis, mask) {
  return (q) => {
    const s = windowScanAngles(vis, q);
    const mi = indexOfScanAngle(s.x, mask.x) - mask.box.i0;
    const mj = indexOfScanAngle(s.y, mask.y) - mask.box.j0;
    if (mi < 0 || mj < 0 || mi >= mask.box.cols || mj >= mask.box.rows)
      return null;
    const mq = mj * mask.box.cols + mi;
    if (mask.dqf && mask.dqf[mq] !== 0) return null;
    return mask.bcm[mq] === 0;
  };
}

/**
 * The theme's own word for a visible pixel (no mask window): the
 * band-13 field's class at the pixel's place on the mosaic. true
 * clear, false low/mid/high, null unmeasured, no data or off the
 * field. `field` is goesPanel's field ({cls, ww, wh}); `frame` the
 * mosaic's ({win, i0, j0}).
 */
export function fieldClearOf(vis, field, frame) {
  const {win, i0, j0} = frame;
  return (q) => {
    const s = windowScanAngles(vis, q);
    const ll = fixedGridToLatLon(s.x, s.y, vis.g);
    if (!ll) return null;
    const p = mercatorPx(ll.latDeg, ll.lonDeg, win.z);
    const i = Math.floor(p.x - win.x0) - i0;
    const j = Math.floor(p.y - win.y0) - j0;
    if (i < 0 || j < 0 || i >= field.ww || j >= field.wh) return null;
    const c = field.cls[j * field.ww + i];
    if (c === CLS.clear) return true;
    if (c === CLS.low || c === CLS.mid || c === CLS.high) return false;
    return null;
  };
}

/**
 * Every visible pixel's reflectance: Eq. 3-3 inverted at the pixel's
 * own sun at the file's time. NaN where the flag is past dqfMax, the
 * factor fill, the pixel off the earth or the sun under minCos.
 * Returns {rho, n, lit, geo}: lit = the pixels that answered.
 */
export function visReflectance(
  vis,
  ms,
  {dqfMax = DAYLIGHT_DQF_MAX, minCos = 0.05} = {}
) {
  const geo = solarGeometry(ms);
  const n = vis.rfac.length;
  const rho = new Float32Array(n);
  let lit = 0;
  for (let q = 0; q < n; q++) {
    const d = vis.dqf ? vis.dqf[q] : 0;
    const rf = vis.rfac[q];
    if (d > dqfMax || !Number.isFinite(rf)) {
      rho[q] = NaN;
      continue;
    }
    const s = windowScanAngles(vis, q);
    const ll = fixedGridToLatLon(s.x, s.y, vis.g);
    if (!ll) {
      rho[q] = NaN;
      continue;
    }
    const r = reflectanceOfFactor(
      rf,
      cosSolarZenith(ll.latDeg, ll.lonDeg, geo),
      {minCos}
    );
    rho[q] = r;
    if (Number.isFinite(r)) lit++;
  }
  return {rho, n, lit, geo};
}

/**
 * The fraction at a fine texel of the refined deck field: the texel's
 * centre on the mosaic (the coarse texel ii spans the mosaic pixel
 * win.x0 + i0 + ci - halfPx - 1 + ii, goesir.deckField's own index
 * rule) to its place, to the visible window's pixel there, to its
 * cover fraction between the references. NaN on the border ring, off
 * the window or without a reflectance. `frame` = {win, i0, j0, ci, cj,
 * halfPx}; `refs` = visReferences' answer.
 */
export function fineFractionAt(
  frame,
  vis,
  rho,
  refs,
  factor = DAYLIGHT_FACTOR
) {
  const {win, i0, j0, ci, cj, halfPx} = frame;
  const X0 = win.x0 + i0 + ci - halfPx - 1;
  const Y0 = win.y0 + j0 + cj - halfPx - 1;
  const rm = 2 * halfPx + 3;
  const rf = rm * factor;
  return (fi, fj) => {
    if (fi < factor || fj < factor || fi >= rf - factor || fj >= rf - factor)
      return NaN;
    const ll = mercatorLatLon(
      X0 + (fi + 0.5) / factor,
      Y0 + (fj + 0.5) / factor,
      win.z
    );
    const q = windowIndexOf(ll.latDeg, ll.lonDeg, vis.g, vis.x, vis.y, vis.box);
    if (q < 0) return NaN;
    return coverFraction(rho[q], refs.rhoClear, refs.rhoCloud);
  };
}

/**
 * THE DAYLIGHT FIELD composed: the visible window `vis` ({g, x, y,
 * box, rfac (reflectance factor, NaN fill), dqf, time}) over the
 * coarse deck field `deck` (goesir.deckField's {data, rm}) in the
 * mosaic's frame; `mask` NOAA's ACM window ({x, y, box, bcm, dqf}) or
 * null for the theme's own `field`. `ms` is the moment the sun is
 * taken at - the file's scan time. Returns null when the references
 * cannot be measured (either side thin: under minN pixels) or the
 * window lies in the dark; else {fine, frac, refs, sortedBy, rho,
 * stats} - fine = refineDeckField's answer for cloudSys.setGoesCover,
 * frac the fraction every fine texel took (NaN = the coarse cover
 * kept), stats the counts the line reads.
 */
export function daylightField({
  vis,
  deck,
  frame,
  mask = null,
  field = null,
  ms,
  factor = DAYLIGHT_FACTOR,
  minN = 50
}) {
  const refl = visReflectance(vis, ms);
  if (!refl.lit) return null;
  const clearOf = mask
    ? maskClearOf(vis, mask)
    : field
      ? fieldClearOf(vis, field, frame)
      : null;
  if (!clearOf) return null;
  const refs = visReferences(refl.rho, clearOf, {minN});
  // no reference at all: too few of either, or the pair INVERTED
  // (the clear median at or above the coverage edge - the mask's few
  // clear pixels at cloud edges under a high deck; 166th) - the 2-km
  // cover stands whole and the caller says why
  if (refs.rhoClear === null || refs.rhoCloud === null || refs.inverted) {
    return {
      fine: null,
      frac: null,
      refs,
      sortedBy: mask ? 'ACM' : 'field',
      rho: refl.rho,
      stats: {
        lit: refl.lit,
        n: refl.n,
        refined: 0,
        cloudy: 0,
        meanFraction: null
      }
    };
  }
  const at = fineFractionAt(frame, vis, refl.rho, refs, factor);
  const rf = deck.rm * factor;
  const frac = new Float32Array(rf * rf).fill(NaN);
  let sum = 0;
  let took = 0;
  const fine = refineDeckField(
    deck,
    (fi, fj) => {
      const f = at(fi, fj);
      frac[fj * rf + fi] = f;
      if (Number.isFinite(f)) {
        sum += f;
        took++;
      }
      return f;
    },
    factor
  );
  return {
    fine,
    frac,
    refs,
    sortedBy: mask ? 'ACM' : 'field',
    rho: refl.rho,
    stats: {
      lit: refl.lit,
      n: refl.n,
      refined: fine.refined,
      cloudy: fine.cloudy,
      meanFraction: took ? sum / took : null
    }
  };
}
