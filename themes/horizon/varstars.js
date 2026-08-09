/**
 * varstars.js - the drawn sky's classical variable stars, phased
 * by PRINTED elements: the catalogue sky stops being a still
 * photograph. Gated by varstars-reference.mjs.
 *
 * THE PRIMARIES - all read in full:
 *  - Goodricke 1783 (Phil. Trans. 73, 474 - the DISCOVERY of
 *    Algol's periodicity, public domain, READ): "changes from
 *    the second to about the fourth magnitude in nearly three
 *    hours and a half, and from thence to the second magnitude
 *    again in the same space of time; so that the whole duration
 *    of this singular variation is only about seven hours", and
 *    the period "recurs regularly and periodically about every
 *    two days and nearly twenty hours and three quarters" -
 *    within 0.1% of the modern element, from 1783 - plus the
 *    eclipse conjecture itself ("the interposition of a large
 *    body revolving round Algol").
 *  - Stebbins 1910 (ApJ 32, 185 - the first photoelectric
 *    photometry of a star, selenium cell in an ice pack, READ;
 *    scanned tables machine-read from page images): discovered
 *    Algol's SECONDARY minimum ("the variation of 0.06
 *    magnitude") and the continuous reflection variation
 *    between minima, L = L1 + s(1 - cos phi) with L1 = 0.8507,
 *    s = 0.0201 (alpha-Per light units); printed the ADOPTED
 *    LIGHT-CURVE (Table VI, vendored verbatim below), system
 *    elements (Table IV: kappa 1.14, i 82.3 deg, r 4.77), the
 *    9.80 h eclipse duration, and the range 1.22 mag vs
 *    alpha Persei (Table V).
 *  - GCVS 5.1 (Samus et al. 2017, ARep 61, 80; catalogue rows
 *    vendored verbatim): the citable elements - max/min
 *    magnitudes, epoch (HJD), period, and the catalogue's own
 *    shape parameters (D = eclipse duration in % of period for
 *    eclipsers; M-m = rise duration in % for pulsators).
 *
 * THE DRAWN MODELS - printed numbers only, class by class:
 *  - bet Per (EA): Stebbins' own printed Table VI IS the curve
 *    (eclipse + reflection + his secondary dip), phase-folded on
 *    the GCVS epoch/period and anchored to the GCVS V endpoints
 *    (max 2.12 at the curve's brightest tabulated point, Min I
 *    3.39 at phase 0 - a stated 1.02x stretch of the selenium
 *    scale onto V; both endpoints printed).
 *  - other EA (lam Tau): the GCVS class definition itself -
 *    light CONSTANT between eclipses - with raised-cosine dips
 *    of the printed D width and printed Min I / Min II depths.
 *  - EB (bet Lyr): no constant phase (the class definition
 *    again) - back-to-back cos^2 lobes to the printed depths.
 *  - DCEP / M (del Cep, eta Aql, zet Gem, omi Cet): a raised
 *    cosine warped by the catalogue's own M-m rise fraction -
 *    fall over (1 - f) of the period, rise over f (del Cep's
 *    printed 25% fast rise; zet Gem's printed 50% = symmetric,
 *    as observed). Epoch = MAXIMUM for pulsators, = minimum for
 *    eclipsers (the GCVS convention).
 * STATED REDUCTIONS: HJD-vs-UT light-time (< 8.3 min) ignored;
 * Mira-class maxima wander cycle to cycle (the GCVS's own
 * caveat) and old eclipser epochs accumulate O-C drift (period
 * changes) - elements are carried verbatim as the citable
 * objects; the semiregulars (Betelgeuse) are NOT drawn varying:
 * no strict phase exists to fold.
 */

// ---- GCVS 5.1 rows, verbatim (B/gcvs via VizieR) ----------------
// raDeg/decDeg are J2000 identification aids for the BSC match.
export const VARSTARS = [
  {
    name: 'bet Per',
    type: 'EA',
    max: 2.12,
    min1: 3.39,
    min2: null,
    epoch: 2445641.5135,
    period: 2.8673043,
    dPct: 14,
    raDeg: 47.042,
    decDeg: 40.956
  },
  {
    name: 'lam Tau',
    type: 'EA',
    max: 3.37,
    min1: 3.91,
    min2: 3.54,
    epoch: 2421506.8506,
    period: 3.9529478,
    dPct: 15,
    raDeg: 60.17,
    decDeg: 12.49
  },
  {
    name: 'bet Lyr',
    type: 'EB',
    max: 3.25,
    min1: 4.36,
    min2: 3.85,
    epoch: 2408247.95,
    period: 12.913834,
    // beta Lyr's period GROWS at the printed 19 s/yr (Mennickent
    // & Djurasevic 2013, arXiv:1303.5812, quoting Harmanec &
    // Scholz 1993) - by 2026 the 1882 linear elements are ~65
    // DAYS of accumulated O-C (five whole cycles: a meaningless
    // phase). The drawn phase therefore uses the MODERN printed
    // locally-linear elements (Rucinski et al. 2019,
    // arXiv:1906.04831, quoting the Ak et al. 2007 quadratic
    // ephemeris at cycle E = 3875): Min I = HJD 2458347.0119,
    // P = 12.94379 d - carried verbatim; the gate closes the
    // 144-year loop between all three printed sources.
    epoch2: 2458347.0119,
    period2: 12.94379,
    pdotSyr: 19,
    dPct: null,
    raDeg: 282.52,
    decDeg: 33.363
  },
  {
    name: 'del Cep',
    type: 'DCEP',
    max: 3.48,
    min1: 4.37,
    min2: null,
    epoch: 2455479.905,
    period: 5.366208,
    mmPct: 25,
    raDeg: 337.293,
    decDeg: 58.415
  },
  {
    name: 'eta Aql',
    type: 'DCEP',
    max: 3.48,
    min1: 4.33,
    min2: null,
    epoch: 2450323.31,
    period: 7.176915,
    mmPct: 32,
    raDeg: 298.118,
    decDeg: 1.006
  },
  {
    name: 'zet Gem',
    type: 'DCEP',
    max: 3.62,
    min1: 4.18,
    min2: null,
    epoch: 2443805.927,
    period: 10.15073,
    mmPct: 50,
    raDeg: 106.027,
    decDeg: 20.57
  },
  {
    name: 'omi Cet',
    type: 'M',
    max: 2.0,
    min1: 10.1,
    min2: null,
    epoch: 2444839.0,
    period: 331.96,
    mmPct: 38,
    raDeg: 34.837,
    decDeg: -2.978
  }
];

// ---- Goodricke 1783, printed ------------------------------------
export const GOODRICKE_P_D = 2 + 20.75 / 24; // "two days and nearly
// twenty hours and three quarters"
export const GOODRICKE_ECLIPSE_H = 7; // "the whole duration ...
// only about seven hours" (3.5 h fall + 3.5 h rise)
// His minima table's own quotient column (interval / revolutions,
// "2 d" plus the tabulated hours) - the tenth entry is his own
// footnote's near-not-at-minimum outlier, carried as printed:
export const GOODRICKE_QUOTIENTS_H = [
  20.8, 20.6, 20.8, 21.0, 20.6, 21.5, 20.9, 20.8, 22.1, 20.7
];

// ---- Stebbins 1910, printed (machine-read page images) ----------
export const STEBBINS_P_H = 68.816; // "P = the period = 68.816 hours"
export const STEBBINS_DUR_H = 9.8; // "Duration of eclipse = 9.80"
export const STEBBINS_L1 = 0.8507; // reflection fit, alpha-Per units
export const STEBBINS_S = 0.0201;
export const STEBBINS_SEC_DEPTH = 0.06; // "the variation of 0.06 mag"
// Table VI - ADOPTED LIGHT-CURVE OF ALGOL: [phase (hours from
// principal minimum), difference of magnitude vs alpha Persei].
// The +-0h..+-4.90 block is symmetric about minimum (his stated
// assumption); 5.0..60.0 runs forward through the secondary.
export const STEBBINS_CURVE = [
  [0.0, 1.37],
  [0.5, 1.31],
  [1.0, 1.15],
  [1.5, 0.95],
  [2.0, 0.77],
  [2.5, 0.61],
  [3.0, 0.47],
  [3.5, 0.35],
  [4.0, 0.265],
  [4.5, 0.2],
  [4.9, 0.174],
  [5.0, 0.174],
  [7.5, 0.17],
  [10.0, 0.166],
  [15.0, 0.156],
  [20.0, 0.144],
  [25.0, 0.134],
  [29.8, 0.128],
  [30.0, 0.129],
  [31.0, 0.138],
  [32.0, 0.152],
  [33.0, 0.17],
  [34.0, 0.186],
  [34.67, 0.189],
  [35.0, 0.188],
  [36.0, 0.177],
  [37.0, 0.16],
  [38.0, 0.142],
  [39.0, 0.131],
  [39.6, 0.128],
  [40.0, 0.128],
  [45.0, 0.136],
  [50.0, 0.147],
  [55.0, 0.158],
  [60.0, 0.168]
];
export const STEBBINS_BRIGHTEST = 0.128; // the curve's high light

// Phase fraction in [0,1) from a JD and the GCVS elements. The
// epoch convention rides with the class (minimum for EA/EB,
// maximum for DCEP/M) - callers fold and the models place their
// features accordingly. HJD light-time stated ignored.
export function phaseOf(jd, epoch, period) {
  const f = (jd - epoch) / period;
  return f - Math.floor(f);
}

// Stebbins' printed curve at a phase fraction of the modern
// period: piecewise-linear on the printed points, the +- block
// mirrored onto the approach side (his own symmetry statement),
// and the 60 h -> first-contact gap bridged linearly between the
// two printed endpoints.
export function algolDmag(phaseFrac) {
  const P = STEBBINS_P_H;
  let h = ((phaseFrac % 1) + 1) % 1;
  h *= P;
  if (h > P / 2) h = P - h; // symmetric fold onto the printed side
  // beyond the last printed forward point the fold has already
  // brought h into [0, 34.408]; every value interpolates.
  const T = STEBBINS_CURVE;
  if (h <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) {
    if (h <= T[i][0]) {
      const [h0, m0] = T[i - 1];
      const [h1, m1] = T[i];
      return m0 + ((m1 - m0) * (h - h0)) / (h1 - h0);
    }
  }
  return T[T.length - 1][1];
}

// The drawn V for Algol: Stebbins' curve shape between the GCVS
// V endpoints (max at the brightest tabulated light, Min I at
// phase 0) - a stated ~1.02x stretch of the selenium scale.
export function algolV(phaseFrac, g) {
  const d = algolDmag(phaseFrac);
  const span = STEBBINS_CURVE[0][1] - STEBBINS_BRIGHTEST; // 1.242
  return g.max + ((d - STEBBINS_BRIGHTEST) * (g.min1 - g.max)) / span;
}

// EA without a printed curve (lam Tau): the GCVS class definition
// - light constant between eclipses - with raised-cosine dips of
// the printed D total width at phase 0 (Min I) and 0.5 (Min II).
export function eaV(phaseFrac, g) {
  const w = g.dPct / 100 / 2; // half-width in phase
  const dip = (c, depth) => {
    let d = Math.abs(phaseFrac - c);
    d = Math.min(d, 1 - d);
    if (d >= w) return 0;
    return depth * 0.5 * (1 + Math.cos((Math.PI * d) / w));
  };
  return (
    g.max + dip(0, g.min1 - g.max) + (g.min2 ? dip(0.5, g.min2 - g.max) : 0)
  );
}

// EB (bet Lyr): no constant light (the class definition) -
// back-to-back cos^2 lobes to the printed Min I / Min II depths,
// maxima at quadrature.
export function ebV(phaseFrac, g) {
  const c = Math.cos(2 * Math.PI * phaseFrac);
  return g.max + (c > 0 ? (g.min1 - g.max) * c * c : (g.min2 - g.max) * c * c);
}

// DCEP / M: raised cosine warped by the catalogue's own M-m rise
// fraction f - epoch at MAXIMUM (phase 0), fall over (1 - f),
// rise over f back to the next maximum.
export function pulseV(phaseFrac, g) {
  const f = g.mmPct / 100;
  const p = ((phaseFrac % 1) + 1) % 1;
  const amp = g.min1 - g.max;
  if (p < 1 - f) {
    return g.max + (amp * (1 - Math.cos((Math.PI * p) / (1 - f)))) / 2;
  }
  return g.min1 - (amp * (1 - Math.cos((Math.PI * (p - (1 - f))) / f))) / 2;
}

// The dispatcher: drawn V magnitude of a roster star at a JD.
// A star carrying modern locally-linear elements (epoch2 /
// period2 - beta Lyr's growing period) folds on those; the
// residual of constant-P against the printed 19 s/yr growth is
// ~0.2 d by 2026 (1.6% of the period), stated.
export function varV(g, jd) {
  const p = g.epoch2
    ? phaseOf(jd, g.epoch2, g.period2)
    : phaseOf(jd, g.epoch, g.period);
  if (g.name === 'bet Per') return algolV(p, g);
  if (g.type === 'EA') return eaV(p, g);
  if (g.type === 'EB') return ebV(p, g);
  return pulseV(p, g);
}

// BSC identification: index of the single catalogue row within
// tolDeg of the roster coordinates (rows are [raDeg, decDeg,
// mag, K]). Returns -1 unless exactly one star matches.
export function bscIndexOf(g, stars, tolDeg = 0.3) {
  let hit = -1;
  let n = 0;
  for (let i = 0; i < stars.length; i++) {
    const dRa =
      Math.abs(((stars[i][0] - g.raDeg + 540) % 360) - 180) *
      Math.cos((g.decDeg * Math.PI) / 180);
    const dDec = Math.abs(stars[i][1] - g.decDeg);
    if (Math.sqrt(dRa * dRa + dDec * dDec) < tolDeg) {
      hit = i;
      n++;
    }
  }
  return n === 1 ? hit : -1;
}
