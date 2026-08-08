/**
 * lakeice.js - the drawn lakes freeze, carry ice through the
 * winter and break up in spring, driven by MEASURED daily air
 * temperatures (the open-meteo ERA5 archive at the anchor). The
 * OSM lakes currently ripple blue in January at 61 N; this
 * module gives them the ice cover the measured winter grew.
 *
 * Sources, read in full:
 *  - Yang, Lepparanta, Cheng & Li 2012, "Numerical modelling of
 *    snow and ice thicknesses in Lake Vanajavesi, Finland",
 *    Tellus A 64, 17202. The growth law's structure is theirs,
 *    printed twice: "ice grew to a first order in proportion to
 *    the square root of the freezing-degree days"; and every
 *    constant here is DERIVED from their printed climatology -
 *    no free knobs:
 *      - Table 1 prints the Jokioinen 1971-2000 monthly mean air
 *        temperatures (vendored below);
 *      - "The annual maximum ice thickness was 53 cm in
 *        1971-2000" - with the Table-1 freezing-degree-day sum
 *        to the end of March this pins the Stefan coefficient
 *        a^2 = h_max^2 / (FDD - FDD_ON) = 4.88 cm^2/(degC day),
 *        i.e. a = 2.21 cm/sqrt(degC day) - squarely in the
 *        classic snow-covered-lake range;
 *      - "the average freezing ... date of Lake Vanajavesi was
 *        30 November" (1971-2000, after Korhonen 2005): with
 *        November's printed -0.4 degC mean this pins the ice-on
 *        threshold FDD_ON = 12 degC day of accumulated cooling
 *        (the paper: freezing "largely depends on the lake heat
 *        storage and the cooling rate of the air temperature");
 *      - "2 cm d-1 melting in April" (abstract) at April's
 *        printed +2.7 degC mean pins the melt coefficient
 *        0.741 cm/(degC day);
 *      - what then EMERGES, gated: breakup ~27 April against the
 *        printed observed 30 April (ice season ~148 d vs the
 *        printed 152 d); the Kuivajarvi mid-month ice
 *        thicknesses (their Fig. 7 validation circles); the
 *        printed sensitivities "freezing date by 5 d per degC"
 *        (+1 degC gives +4 d here) and "ice thickness could
 *        change up to ... +-6 cm" per degC (+-6.5 here).
 *      Their printed +-5 degC experiments and the radiation-
 *      driven late-spring melt live beyond a degree-day model's
 *      reach - a documented scope limit (their own words:
 *      "Ice breakup can be explained mainly by the net solar
 *      radiation").
 *  - Pirazzini, Vihma, Granskog & Cheng 2006, "Surface albedo
 *    measurements over sea ice in the Baltic Sea during the
 *    spring snowmelt period", Ann. Glaciol. 44, 7-14. The
 *    albedo law the Vanajavesi model uses (its Eq. 2) is theirs
 *    (their Eq. 3), with the printed parameter values pinning
 *    the units: h_min = 0.001 m (Yang prints the same threshold
 *    as "0.1 cm"), c10 = 0.1 m snow ramp, alpha_ow = 0.15,
 *    alpha_mi = 0.55, alpha_s = 0.75. Bare-ice albedo in the
 *    Vanajavesi form alpha_i = min(0.55, 0.15 h_i^1.5 + 0.15),
 *    h_i in metres. Their melting-ice provenance chain is the
 *    lake one: "Flato and Brown's parameterization for melting
 *    conditions was derived from data of Arctic lake-ice albedo
 *    (Heron and Woo, 1994)" - and their own tuned melting form
 *    alpha_i = min(0.55, 0.4 h_i^2 + 0.15) reproduces their
 *    printed "the albedo of the 0.6 m thick melting ice layer
 *    had dropped to about 0.3" (0.294; printed RMSE 0.032).
 *    Their printed daily-mean albedo range 0.30-0.79 brackets
 *    the whole drawn family.
 *
 * The feed (Horizon.html): open-meteo ERA5 archive API, keyless -
 * daily temperature_2m_mean at the anchor from the season start
 * (1 August north, 1 February south). The integrator runs the
 * measured series day by day: pre-onset, frost days accumulate
 * and warm days erode the cooling budget; once FDD_ON is
 * crossed the ice grows by Stefan's law in increment form
 * d(h^2) = a^2 (-T) dt (the printed sqrt-FDD proportionality is
 * exact over any pure-frost stretch - the gate holds the
 * identity) and melts by the printed climatological pairing on
 * warm days.
 */

// Jokioinen 1971-2000 monthly mean air temperature (degC),
// October-May - Yang et al. 2012 Table 1, verbatim.
export const TABLE1_TA = [4.6, -0.4, -4.1, -5.9, -6.5, -2.7, 2.7, 9.5];
export const TABLE1_MONTHS = [
  'Oct',
  'Nov',
  'Dec',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May'
];
const TABLE1_DAYS = [31, 30, 31, 31, 28, 31, 30, 31];

// The printed anchor pair: 53 cm climatological maximum at the
// Table-1 freezing-degree-day sum (November through March).
export const HMAX_CLIM_CM = 53;

// Climatological freezing-degree days from the season start to
// the end of month index i (inclusive), Table-1 monthly means.
export function climFDD(untilMonth = 5) {
  let fdd = 0;
  for (let m = 0; m <= untilMonth && m < TABLE1_TA.length; m++) {
    if (TABLE1_TA[m] < 0) fdd += -TABLE1_TA[m] * TABLE1_DAYS[m];
  }
  return fdd;
}

// Ice-on threshold (degC day): the printed 30 November mean
// freezing date at November's printed -0.4 degC - the whole
// month's cooling, 12 degC day.
export const FDD_ON = -TABLE1_TA[1] * TABLE1_DAYS[1];

// Stefan coefficient squared (cm^2 per degC day), pinned by the
// printed 53 cm at the printed climatological season:
// a^2 = h^2/(FDD - FDD_ON).
export const STEFAN_A2 = (HMAX_CLIM_CM * HMAX_CLIM_CM) / (climFDD(5) - FDD_ON);

// Melt coefficient (cm per degC day): the printed climatological
// pairing - "2 cm d-1 melting in April" at April's +2.7 degC.
export const MELT_CM_PER_DD = 2 / TABLE1_TA[6];

/**
 * Day-by-day lake ice integrator over a chronological series of
 * daily mean temperatures (degC; non-finite entries skipped).
 * Returns {hCm, on, fdd} - ice thickness (cm), whether ice is
 * present, and the pre-onset cooling budget.
 */
export function lakeIceSeries(dailyT) {
  let fdd = 0;
  let on = false;
  let h = 0;
  for (const T of dailyT || []) {
    if (!Number.isFinite(T)) continue;
    if (!on) {
      // cooling budget: frost accumulates, warmth erodes (the
      // lake heat store refills).
      fdd = Math.max(0, fdd - T);
      if (fdd >= FDD_ON) {
        on = true;
        h = 0;
      }
    } else if (T < 0) {
      // Stefan's law, increment form: d(h^2) = a^2 (-T) dt.
      h = Math.sqrt(h * h + STEFAN_A2 * -T);
    } else if (T > 0) {
      h = Math.max(0, h - MELT_CM_PER_DD * T);
      if (h === 0) {
        on = false;
        fdd = 0;
      }
    }
  }
  return {hCm: h, on: on && h > 0, fdd};
}

// Expand the Table-1 climatology into a daily series (each month
// at its printed mean), October through the given month index.
export function climDailySeries(untilMonth = 7) {
  const days = [];
  for (let m = 0; m <= untilMonth && m < TABLE1_TA.length; m++) {
    for (let d = 0; d < TABLE1_DAYS[m]; d++) days.push(TABLE1_TA[m]);
  }
  return days;
}

// ---- the printed albedo law ----
// Yang et al. 2012 Eq. 2 (after Pirazzini et al. 2006 Eq. 3):
// thicknesses in metres. alpha = 0.15 below the printed 0.001 m
// film threshold; bare ice alpha_i = min(0.55, 0.15 h^1.5 +
// 0.15); snow ramps the surface to alpha_s = 0.75 over the
// printed 0.1 m.
export const ALPHA_OW = 0.15;
export const ALPHA_MI = 0.55;
export const ALPHA_S = 0.75;
export const H_MIN_M = 0.001;
export const SNOW_RAMP_M = 0.1;

export function lakeIceAlphaBare(hiM) {
  if (hiM < H_MIN_M) return ALPHA_OW;
  return Math.min(ALPHA_MI, 0.15 * Math.pow(hiM, 1.5) + 0.15);
}

export function lakeIceAlpha(hiM, hsM = 0) {
  if (hiM < H_MIN_M) return ALPHA_OW;
  const ai = lakeIceAlphaBare(hiM);
  if (hsM > SNOW_RAMP_M) return ALPHA_S;
  return Math.min(ALPHA_S, ai + (hsM * (ALPHA_S - ai)) / SNOW_RAMP_M);
}

// Pirazzini's own tuned melting-ice form (alpha_s = 0.75,
// c12 = 0.4 m^-2; printed RMSE 0.032) - vendored for the gate's
// corroboration: their 0.6 m melting ice reads "about 0.3".
export function pirazziniMeltAlphaBare(hiM) {
  if (hiM < H_MIN_M) return ALPHA_OW;
  return Math.min(ALPHA_MI, 0.4 * hiM * hiM + ALPHA_OW);
}
