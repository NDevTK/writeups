/**
 * warmlayer.js - the sea's diurnal WARM LAYER: by sunset on a calm,
 * sunny day the surface can be tenths of a degree warmer than a
 * thermometer metres down, because the morning's solar heat is
 * trapped in a shallow layer the wind has not stirred through. The
 * 136th pass named "no warm layer" as a stated limit of the pier's
 * skin (the CO-OPS water sensor sits 3.4 m down); this module
 * retires it with the model the flux community runs.
 *
 * PRIMARY: the COARE 3.6 warm-layer code the authors publish
 * (coare36vnWarm_et, NOAA-PSL/COARE-algorithm - the routine PSL
 * ran to produce the dT_warm, dz_warm and dT_warm_to_skin columns
 * of their ship flux archive, the gate's oracle), which implements
 * Fairall, Bradley, Godfrey, Wick, Edson & Young 1996's simplified
 * Price-Weller-Pinkel scheme (the paper is walled; the 2026 JGR
 * Oceans paper's Section 3.1 names it as the version 2.0 warm-layer
 * physics that has stood since). The scheme, as the code runs it:
 *  - the day starts at local 06:00 (local time from the longitude,
 *    (lon + 7.5)/15 hours ahead of UTC, the code's own clock); the
 *    accumulators reset when the local clock wraps;
 *  - each step accumulates the wind stress tau_ac += max(0.002,
 *    tau) dt and, once the net surface heating fxp Rns - (Rnl + Hs
 *    + Hl + Hrain) first reaches 50 W/m^2 ("jamset"), the heat
 *    qcol_ac += (fxp Rns - Qout) dt, with fxp the fraction of the
 *    solar flux absorbed within the layer's depth (Fairall 1996's
 *    three-band form over dz, iterated five times with the depth);
 *  - the layer's depth dz = min(19 m, ctd1 tau_ac / sqrt(qcol_ac))
 *    and its warming dT = ctd2 qcol_ac^1.5 / tau_ac, with ctd1 =
 *    sqrt(2 Ri_c cpw / (Al g rhow)), ctd2 = sqrt(2 Al g / (Ri_c
 *    rhow)) / cpw^1.5 and the critical bulk Richardson number
 *    Ri_c = 0.65 - the PWP mixed-layer closure;
 *  - a thermometer at depth z reads dT x min(1, z/dz) below the
 *    surface's warming (dT_warm_to_skin).
 * The gate reproduces PSL's own columns by integrating the archive's
 * hourly series with the archive's own fluxes.
 *
 * STATED LIMITS: the scheme's own (a slab heated from above and
 * stirred by the stress, no advection, no tide, no surf); the
 * pier's day is integrated from six-minute measured met and a
 * MODELLED hourly solar flux; the 0.94 solar albedo of the code's
 * constant branch stands in for its zenith-angle albedo table.
 */

export const RI_CRITICAL = 0.65; // rich
export const DZ_WARM_MAX_M = 19; // max_pwp
export const Q_JAM_WM2 = 50; // the heating that starts the day's layer
export const TAU_FLOOR = 0.002; // N/m^2, the code's stress floor
export const CP_WATER = 4000;
export const RHO_WATER = 1022;
export const FXP_START = 0.5;
export const FXP_NO_LAYER = 0.75;
export const DAY_START_S = 21600; // local 06:00

/** Seawater thermal expansion at 35 PSU, the code's Al. */
export function thermalExpansion35(tseaC) {
  return 2.1e-5 * Math.pow(tseaC + 3.2, 0.79);
}

/** The fraction of the solar flux absorbed within a layer of depth
 * dz (m): Fairall 1996's three-band form as the code writes it
 * (0.28 with 1.4 cm, 0.27 with 35.7 cm, 0.45 with 12.82 m). */
export function warmSolarFraction(dzM) {
  return (
    1 -
    (0.28 * 0.014 * (1 - Math.exp(-dzM / 0.014)) +
      0.27 * 0.357 * (1 - Math.exp(-dzM / 0.357)) +
      0.45 * 12.82 * (1 - Math.exp(-dzM / 12.82))) /
      dzM
  );
}

/** The code's local clock: seconds into the local day for a UTC
 * instant at longitude lonDeg. */
export function localSeconds(utcMs, lonDeg) {
  const dayFrac = (((utcMs / 86400e3) % 1) + 1) % 1;
  const loc = (lonDeg + 7.5) / 15;
  let chk = loc + dayFrac * 24;
  chk = ((chk % 24) + 24) % 24;
  return chk * 3600;
}

/** A fresh accumulator (the code's initial state). */
export function warmLayerInit() {
  return {
    qcolAc: 0,
    tauAc: 0,
    dTwarm: 0,
    duWarm: 0,
    dzWarm: DZ_WARM_MAX_M,
    fxp: FXP_START,
    qPwp: 0,
    jamset: false,
    jump: true,
    jtime: 0,
    count: 0
  };
}

/**
 * One step of the warm-layer integral, as the code takes it: the
 * PREVIOUS step's stress and fluxes carry the heat of the interval
 * that just elapsed. inputs: {utcMs, lonDeg, tseaC, swNet, lwNet
 * (positive cooling), hsb, hlb, hrain (positive cooling), tau
 * (N/m^2), g}. Returns the new state with dTwarm, dzWarm and the
 * warming above depth zM (dTtoDepth).
 */
export function warmLayerStep(state, inputs, zM = 0.05) {
  const s = {...state};
  const {
    utcMs,
    lonDeg,
    tseaC,
    swNet,
    lwNet,
    hsb,
    hlb,
    hrain = 0,
    tau,
    g = 9.80665
  } = inputs;
  const al = thermalExpansion35(tseaC);
  const ctd1 = Math.sqrt((2 * RI_CRITICAL * CP_WATER) / (al * g * RHO_WATER));
  const ctd2 =
    Math.sqrt((2 * al * g) / (RI_CRITICAL * RHO_WATER)) /
    Math.pow(CP_WATER, 1.5);
  const newtime = localSeconds(utcMs, lonDeg);
  s.count += 1;
  if (s.count > 1) {
    if (newtime <= DAY_START_S || !s.jump) {
      s.jump = false;
      if (newtime < s.jtime) {
        s.jamset = false;
        s.fxp = FXP_START;
        s.dzWarm = DZ_WARM_MAX_M;
        s.tauAc = 0;
        s.qcolAc = 0;
        s.dTwarm = 0;
        s.duWarm = 0;
      } else {
        const dtime = newtime - s.jtime;
        const qrOut = lwNet + hsb + hlb + hrain;
        s.qPwp = s.fxp * swNet - qrOut;
        if (s.qPwp >= Q_JAM_WM2 || s.jamset) {
          s.jamset = true;
          s.tauAc += Math.max(TAU_FLOOR, tau) * dtime;
          let qjoule;
          if (s.qcolAc + s.qPwp * dtime > 0) {
            for (let i = 0; i < 5; i++) {
              s.fxp = warmSolarFraction(s.dzWarm);
              qjoule = (s.fxp * swNet - qrOut) * dtime;
              if (s.qcolAc + qjoule > 0)
                s.dzWarm = Math.min(
                  DZ_WARM_MAX_M,
                  (ctd1 * s.tauAc) / Math.sqrt(s.qcolAc + qjoule)
                );
            }
          } else {
            s.fxp = FXP_NO_LAYER;
            s.dzWarm = DZ_WARM_MAX_M;
            qjoule = (s.fxp * swNet - qrOut) * dtime;
          }
          s.qcolAc += qjoule;
          if (s.qcolAc > 0) {
            s.dTwarm = (ctd2 * Math.pow(s.qcolAc, 1.5)) / s.tauAc;
            s.duWarm = (2 * s.tauAc) / (s.dzWarm * RHO_WATER);
          } else {
            s.dTwarm = 0;
            s.duWarm = 0;
          }
        }
      }
    }
  }
  s.jtime = newtime;
  s.dTtoDepth = s.dzWarm < zM ? s.dTwarm : (s.dTwarm * zM) / s.dzWarm;
  return s;
}
