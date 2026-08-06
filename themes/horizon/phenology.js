/**
 * phenology.js - the MEASURED growing calendar, replacing three
 * separate guessed ones.
 *
 * Until now the theme decided when leaves came out and when grass
 * cured from latitude arithmetic: grassland.js and forest.js each
 * carried a hardcoded month list per latitude band, and the drawn
 * tree canopies ran Hopkins' bioclimatic law (4 days per degree of
 * latitude, one day per 122 m of elevation). Hopkins is a real 1918
 * rule, but it is a SHIFT applied to a fixed reference calendar, and
 * at a high, high-latitude site the shift is large enough to push
 * leaf-out past the onset of senescence - a Grindelwald August came
 * out 87% autumn while the meadow outside is at full maturity.
 *
 * The satellites have measured the answer for that exact 500 m pixel
 * every year since 2001. MCD12Q2 (MODIS Land Cover Dynamics) fits a
 * QA-weighted penalised cubic smoothing spline to the pixel's
 * NBAR-EVI2 time series and records the dates at which the curve
 * crosses fixed fractions of the vegetation cycle's own amplitude.
 *
 * Primary source read directly, and it must be the RIGHT one: the
 * ORNL service serves product years through 2024, which is
 * Collection 6.1, so the governing document is "User Guide to
 * Collection 6.1 MODIS Land Cover Dynamics (MCD12Q2) Product", Josh
 * Gray, Damien Sulla-Menashe and Mark A. Friedl, 14 March 2022 (LP
 * DAAC document 1417). Every number gated below was checked against
 * that edition, not the 2019 Collection 6 guide it supersedes. The
 * two agree on all of them - Table 1, the 15/50/90% definitions,
 * Figure 2's bit packing and Table 2's worked QA values are
 * unchanged - but C6.1 carries two facts of its own:
 *  - it fixes "spuriously early detection of greenup dates in a
 *    small proportion of pixels caused by a discontinuity in
 *    vegetation index time series across calendar years arising from
 *    the way that splines are fit to the data";
 *  - its pipeline generates a product year 6 months after that year
 *    ends rather than 12. The service is nonetheless further behind
 *    than that in practice - asked in 2026 it offers 2024 - which is
 *    why the measured season has to be carried forward explicitly
 *    (phenoAlign below).
 * The C5-era logistic-curvature method this superseded is Zhang et
 * al., Remote Sensing of Environment 84:471-475 (2003), the citation
 * grassland.js already carried.
 *
 * Section 2.3 and Table 1 define the metrics EXACTLY, and that
 * definition is the whole reason this is usable as a curve rather
 * than a set of labels: each date is the crossing of a known
 * fraction of the segment amplitude. Greenup / MidGreenup / Maturity
 * are the FIRST dates EVI2 crosses 15% / 50% / 90% of the greenup
 * segment amplitude; Senescence / MidGreendown / Dormancy are the
 * LAST dates it crosses 90% / 50% / 15% of the greendown amplitude;
 * Peak is the segment maximum. So the product hands over seven
 * (date, greenness) knots of the pixel's own measured season, and
 * interpolating between them reconstructs the season shape without
 * inventing anything.
 *
 * One honesty note on that reconstruction: the guide defines the
 * greenup amplitude as (peak - segment START EVI2) and the greendown
 * amplitude as (peak - segment END EVI2), and those two are not the
 * same number unless the season begins and ends at the same
 * greenness. The knot LEVELS below are therefore a normalised season
 * SHAPE - 50% on the way up and 50% on the way down are the product's
 * own two half-way marks, not a claim that they are the same EVI2
 * value. Nothing here converts them back to absolute EVI2, so the
 * distinction never has to be papered over.
 *
 * Two cautions from the same document, both honoured below:
 *  - Section 3.2, "Known Issues" (still present in C6.1 even after
 *    the greenup fix): Greenup and Dormancy are anomalously
 *    early/late where the NBAR-EVI2 variation is small, because the
 *    spline assumes too low a dormant value; the authors tell users
 *    to prefer the "more realistic and stable" MidGreenup and
 *    MidGreendown to capture season start and end. So the GREEN
 *    season here is bounded by the 50% crossings, and the 15% ones
 *    only open and close the shoulder.
 *  - A cycle is only retrieved at all when its NBAR-EVI2 amplitude
 *    is at least 0.1 AND at least 35% of the three-year range
 *    (section 2.2). A pixel with no cycle is therefore not a failure
 *    to measure a season - it is a measurement that the pixel has no
 *    strong one. THAT is why there is no fallback calendar anywhere
 *    behind this file: a pixel with no retrieved cycle gets no
 *    seasonal modulation at all, which is what "no strong season"
 *    actually looks like. The latitude month lists and Hopkins' law
 *    that used to answer in this case are gone, not demoted - a
 *    guess kept as a backstop is still drawn, and still wrong.
 *
 * Pure JS, gated by phenology-reference.mjs. The 0.01-deg cell snap
 * is modis-land.js's own ndviCell, re-exported not re-derived - the
 * two feeds ride the same ORNL DAAC point service (keyless, CORS-
 * open, one MODIS pixel as JSON) and must land on the same cell.
 */

import {ndviCell} from './modis-land.js';

// One cell model for every ORNL point query in the theme.
export {ndviCell};

const ORNL_MCD12Q2 = 'https://modis.ornl.gov/rst/api/v1/MCD12Q2';

// Table 1: every SDS is INT16 with fill 32767; the date layers carry
// days since 1-1-1970 over 11138..32766 (2000-06-30 .. 2059-09-17).
export const PHENO_FILL = 32767;
export const PHENO_DAY_MIN = 11138;
export const PHENO_DAY_MAX = 32766;

// Table 1: the greenness layers' valid ranges and scale factors.
export const EVI_AMP_MAX = 10000;
export const EVI_SCALE = 1e-4;

// Section 2.2: the global minimum amplitude for a valid cycle.
export const EVI_AMP_MIN_VALID = 0.1;

// Section 2.3 / Table 1: the fraction of the segment amplitude each
// dated metric marks. These ARE the product's definition - the knot
// heights of the measured season, not a curve fitted here.
export const PHENO_LEVEL = {
  greenup: 0.15,
  midGreenup: 0.5,
  maturity: 0.9,
  peak: 1,
  senescence: 0.9,
  midGreendown: 0.5,
  dormancy: 0.15
};

// The knots in season order; also the QA_Detailed bit-pair order
// (Figure 2: bits 0-1 Greenup ... bits 12-13 Dormancy, top 2 unused).
export const PHENO_KEYS = [
  'greenup',
  'midGreenup',
  'maturity',
  'peak',
  'senescence',
  'midGreendown',
  'dormancy'
];

// Cycle-1 band names AS THE ORNL SERVICE ACTUALLY SERVES THEM
// (Num_Modes_01 is the higher-amplitude cycle; a second cycle exists
// for multicrop and is deliberately not consumed - one canopy is
// drawn). Asked for its inventory, the service answers with 23 bands
// and Peak IS NOT ONE OF THEM, though Table 1 of the user guide lists
// Peak among the product's SDS: the point service exposes a subset of
// the HDF layers. So no Peak here - a band that is not served cannot
// be requested, and the level-1.0 knot is simply absent rather than
// guessed. Peak keeps its place in PHENO_KEYS regardless, because the
// QA_Detailed bit packing counts it (Figure 2, bits 6-7).
export const PHENO_BANDS = {
  greenup: 'Greenup.Num_Modes_01',
  midGreenup: 'MidGreenup.Num_Modes_01',
  maturity: 'Maturity.Num_Modes_01',
  senescence: 'Senescence.Num_Modes_01',
  midGreendown: 'MidGreendown.Num_Modes_01',
  dormancy: 'Dormancy.Num_Modes_01',
  amplitude: 'EVI_Amplitude.Num_Modes_01',
  qa: 'QA_Overall.Num_Modes_01'
};

// Section 5: QA_Overall 0..3 = best/good/fair/poor. Poor is refused -
// a poor retrieval is a spline the product itself does not stand
// behind, so the heuristic calendar is the more honest answer.
export const QA_BEST = 0;
export const QA_GOOD = 1;
export const QA_FAIR = 2;
export const QA_POOR = 3;
export const PHENO_QA_MAX = QA_FAIR;

export function phenoDatesUrl(cell) {
  return `${ORNL_MCD12Q2}/dates?latitude=${cell.lat}&longitude=${cell.lon}`;
}

export function phenoUrl(cell, date, band) {
  return (
    `${ORNL_MCD12Q2}/subset?latitude=${cell.lat}&longitude=${cell.lon}` +
    `&startDate=${date}&endDate=${date}&band=${band}` +
    '&kmAboveBelow=0&kmLeftRight=0'
  );
}

// The raw integer of a one-pixel /subset response; null when the
// response is unusable OR when the service answers with no pixel
// (empty subset over ocean/off-land - a real "no measure" answer).
export function parsePhenoRaw(j) {
  if (!j || !Array.isArray(j.subset)) return null;
  const s = j.subset[0];
  if (!s || !Array.isArray(s.data) || typeof s.data[0] !== 'number')
    return null;
  return s.data[0];
}

// A dated metric as days since 1-1-1970, or null for the fill value
// and anything outside the documented valid range.
export function phenoDay(raw) {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  if (raw === PHENO_FILL) return null;
  if (raw < PHENO_DAY_MIN || raw > PHENO_DAY_MAX) return null;
  return raw;
}

// NBAR-EVI2 amplitude of the cycle (scale 1e-4, valid 0..10000).
export function phenoAmplitude(raw) {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  if (raw === PHENO_FILL || raw < 0 || raw > EVI_AMP_MAX) return null;
  return raw * EVI_SCALE;
}

/**
 * Unpack QA_Detailed (Figure 2): a 16-bit integer holding seven
 * 2-bit scores, least-significant pair first, in PHENO_KEYS order.
 * Returns {greenup, midGreenup, ...} of 0..3, or null if unusable.
 */
export function unpackDetailedQa(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  if (v === PHENO_FILL || v < 0 || v > 16383) return null;
  const out = {};
  PHENO_KEYS.forEach((k, i) => {
    out[k] = (v >> (2 * i)) & 0b11;
  });
  return out;
}

// Days since 1-1-1970 for a Date (UTC midnight floor) - the product's
// own time base.
export function epochDay(date) {
  return Math.floor(date.getTime() / 86400000);
}

/**
 * Normalise a raw band bundle into a usable cycle, or null.
 * A cycle is usable when QA is not "poor", the amplitude is a real
 * measure, and the four STABLE dates (the 50% and 90% crossings)
 * are present and monotonic - those are the ones section 3.2 says to
 * trust. The 15% crossings are optional: when absent (or out of
 * order) the shoulder simply collapses onto the 50% bound rather
 * than being invented.
 */
export function phenoCycle(raw) {
  if (!raw) return null;
  const qa =
    typeof raw.qa === 'number' && raw.qa !== PHENO_FILL ? raw.qa : null;
  if (qa === null || qa < QA_BEST || qa > PHENO_QA_MAX) return null;
  const amp = phenoAmplitude(raw.amplitude);
  if (amp === null || amp < EVI_AMP_MIN_VALID) return null;
  const d = {};
  for (const k of PHENO_KEYS) d[k] = phenoDay(raw[k]);
  const core = ['midGreenup', 'maturity', 'senescence', 'midGreendown'];
  for (const k of core) if (d[k] === null) return null;
  for (let i = 1; i < core.length; i++)
    if (d[core[i]] < d[core[i - 1]]) return null;
  // Peak is optional furniture for the plateau centre; clamp it in.
  if (d.peak !== null && (d.peak < d.maturity || d.peak > d.senescence))
    d.peak = null;
  // The weak 15% crossings only count when they bracket the stable ones.
  if (d.greenup !== null && d.greenup > d.midGreenup) d.greenup = null;
  if (d.dormancy !== null && d.dormancy < d.midGreendown) d.dormancy = null;
  return {...d, amplitude: amp, qa};
}

// Shift an epoch day by whole calendar years, keeping month and day.
function shiftYears(day, years) {
  const d = new Date(day * 86400000);
  return Math.round(
    Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate()) /
      86400000
  );
}

/**
 * Carry a measured season onto the year being drawn.
 *
 * The product runs about eighteen months behind - the newest product
 * year the service offers is 2024 - so the measured cycle is nearly
 * always from an earlier year than the scene's date, and comparing
 * raw epoch days would put every scene outside its own season. The
 * cycle is therefore shifted by WHOLE CALENDAR YEARS (month and day
 * preserved, so no 365.2425 drift accumulates) onto the year that
 * brings the scene day closest to the measured season. Three
 * candidate shifts are tried because a southern-hemisphere cycle
 * straddles the new year: C6 files a cycle under the product year of
 * its Peak (section 1.1), so a southern season can begin in the
 * preceding calendar year.
 *
 * This is a re-use of last season's measured dates, not a claim that
 * this year's season fell on them.
 */
export function phenoAlign(cycle, day) {
  if (!cycle || typeof day !== 'number' || !Number.isFinite(day)) return null;
  const base =
    new Date(day * 86400000).getUTCFullYear() -
    new Date(cycle.midGreenup * 86400000).getUTCFullYear();
  let best = null;
  for (const k of [base - 1, base, base + 1]) {
    const start = shiftYears(cycle.greenup ?? cycle.midGreenup, k);
    const end = shiftYears(cycle.dormancy ?? cycle.midGreendown, k);
    const dist = day < start ? start - day : day > end ? day - end : 0;
    if (!best || dist < best.dist) best = {k, dist};
  }
  const out = {amplitude: cycle.amplitude, qa: cycle.qa};
  for (const key of PHENO_KEYS)
    out[key] = cycle[key] == null ? null : shiftYears(cycle[key], best.k);
  return out;
}

// The measured season's knots as [{day, level}], ascending. Missing
// optional knots are dropped, never filled.
export function phenoKnots(cycle) {
  if (!cycle) return [];
  const out = [];
  for (const k of PHENO_KEYS)
    if (cycle[k] != null) out.push({day: cycle[k], level: PHENO_LEVEL[k]});
  return out;
}

/**
 * The measured greenness at a day, as a fraction of the cycle's own
 * NBAR-EVI2 amplitude: 0 at the dormant floor, 1 at peak. Linear
 * between the product's knots; flat at 0 outside the season (the
 * spline's dormant plateau). Null when there is no usable cycle -
 * nothing measured, nothing drawn.
 */
export function phenoGreenness(cycle, day) {
  const ks = phenoKnots(phenoAlign(cycle, day));
  if (ks.length < 2 || typeof day !== 'number' || !Number.isFinite(day))
    return null;
  // Strictly outside the dated season the spline sits on its dormant
  // plateau (fraction 0); the first and last knots themselves are
  // crossings and must read their own documented level.
  if (day < ks[0].day || day > ks[ks.length - 1].day) return 0;
  for (let i = 1; i < ks.length; i++) {
    if (day <= ks[i].day) {
      const a = ks[i - 1];
      const b = ks[i];
      if (b.day === a.day) return b.level;
      return a.level + ((b.level - a.level) * (day - a.day)) / (b.day - a.day);
    }
  }
  return 0;
}

/**
 * The turf phase grassland.js speaks, from measured dates instead of
 * a latitude month list: green above the 50% crossings (the stable
 * season bounds of section 3.2), shoulder on the 15%-50% ramps,
 * dormant outside. Null when there is no usable cycle.
 */
export function phenoGrassPhase(cycle, day) {
  const c = phenoAlign(cycle, day);
  if (!c) return null;
  if (day >= c.midGreenup && day <= c.midGreendown) return 'green';
  const start = c.greenup ?? c.midGreenup;
  const end = c.dormancy ?? c.midGreendown;
  if (day >= start && day <= end) return 'shoulder';
  return 'dormant';
}

/**
 * The canopy phase forest.js speaks, from the same measured knots:
 * bare outside the 15% crossings, spring on the green-up ramp,
 * summer across the >=90% plateau (maturity to senescence), autumn
 * on the green-down ramp. Null when there is no usable cycle.
 */
export function phenoForestPhase(cycle, day) {
  const c = phenoAlign(cycle, day);
  if (!c) return null;
  const start = c.greenup ?? c.midGreenup;
  const end = c.dormancy ?? c.midGreendown;
  if (day < start || day > end) return 'bare';
  if (day < c.maturity) return 'spring';
  if (day <= c.senescence) return 'summer';
  return 'autumn';
}
