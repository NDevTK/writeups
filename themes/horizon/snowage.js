/**
 * snowage.js - the snow on the ground ages by the printed law.
 * The terrain's snow class was a fixed fresh-white display colour
 * whatever the snow's history; this module darkens it with age
 * and brightens it with fresh snowfall, all from FSM 1.0 (Essery
 * 2015, GMD 8, 3867 - read in full, CC-BY), the Edinburgh
 * factorial snowpack model whose prognostic albedo option is the
 * classic ISBA/Douville-lineage scheme as FSM itself prints it
 * (his Sect. 2: "similar parametrizations can be found in CLASS,
 * CLM, HTESSEL, ISBA, JULES, MOSES and ORCHIDEE").
 *
 * FSM Eq. 10 verbatim:
 *   d(alpha)/dt = (alb_min - alpha)/tau + (Sf/S_alpha)(alb_max - alpha)
 * with tau = tau_cold for cold snow and tau_melt for melting
 * snow, Sf the snowfall rate. Table 2 verbatim: alb_max = 0.8,
 * alb_min = 0.5, S_alpha = 10 kg/m^2 (snowfall required to
 * refresh the albedo), T_alpha = 2 degC (diagnostic range),
 * tau_cold = 1000 h, tau_melt = 100 h - the printed 10x: a
 * melting snowpack darkens in days (the spring collapse), a cold
 * one over months. FSM Eq. 11 (the diagnostic variant) is
 * carried for the reference gate's cross-check:
 *   alpha(Ts) = alb_min + (alb_max - alb_min)(Tm - Ts)/T_alpha,
 * clamped to [alb_min, alb_max].
 *
 * Driver: the same keyless open-meteo ERA5 archive the lake-ice
 * Stefan integrator uses - daily snowfall_sum and
 * temperature_2m_mean for the trailing window at the visitor.
 * open-meteo serves snowfall in CENTIMETRES of depth and its
 * docs print the conversion "for the water equivalent in
 * millimeter, divide by 7"; 1 mm w.e. = 1 kg/m^2, so
 * Sf [kg/m^2] = 10 x cm / 7. The daily step solves the linear
 * ODE exactly (constant coefficients over the day), so the
 * result is sub-step-count independent. Cold-vs-melting uses the
 * feed's daily mean temperature against 0 degC - the archive
 * proxy for FSM's snow-surface state, documented as such.
 *
 * Display fold: the theme's fresh snow class (0.87, 0.9, 0.93)
 * is PINNED at alb_max - visible-band reflectance sits above the
 * broadband albedo for snow, so the class riding the printed
 * broadband factor alpha/alb_max keeps that ordering at every
 * age; the aged floor is alb_min/alb_max = 0.625 of fresh. The
 * darkening of real old snow in the VISIBLE is impurity- and
 * wetness-driven; FSM's broadband range folds those in, and this
 * module states that fold rather than inventing a spectral one.
 */

export const FSM_ALB_MAX = 0.8; // Table 2: maximum albedo, fresh snow
export const FSM_ALB_MIN = 0.5; // Table 2: minimum albedo, aged snow
export const FSM_S_ALPHA = 10; // Table 2: refresh snowfall, kg/m^2
export const FSM_T_ALPHA = 2; // Table 2: diagnostic range, degC
export const FSM_TAU_COLD = 1000; // Table 2: cold decay timescale, h
export const FSM_TAU_MELT = 100; // Table 2: melting decay timescale, h

// The theme's fresh-snow display class, pinned at FSM_ALB_MAX.
export const SNOW_FRESH_RGB = [0.87, 0.9, 0.93];

// open-meteo's printed depth-to-water-equivalent conversion:
// snowfall_sum is cm of depth, "divide by 7" for cm w.e.;
// 1 mm w.e. = 1 kg/m^2.
export function snowfallCmToKgM2(cm) {
  return (10 * cm) / 7;
}

// One exact step of FSM Eq. 10 over dtH hours with constant
// forcing: snowfall snowKgM2 spread over the step, daily-mean
// air temperature tC choosing the printed timescale. Linear ODE
// d(alpha)/dt = A - B alpha integrates in closed form.
export function snowAlbedoStep(alpha, snowKgM2, tC, dtH = 24) {
  const tau = tC >= 0 ? FSM_TAU_MELT : FSM_TAU_COLD;
  const sf = snowKgM2 / dtH; // kg/m^2/h
  const B = 1 / tau + sf / FSM_S_ALPHA;
  const A = FSM_ALB_MIN / tau + (sf / FSM_S_ALPHA) * FSM_ALB_MAX;
  const eq = A / B;
  return eq + (alpha - eq) * Math.exp(-B * dtH);
}

// FSM Eq. 11, the diagnostic variant (Ts in degC, Tm = 0),
// clamped to the printed range - the reference gate's
// cross-check that both printed forms agree about which
// temperatures mean dark snow.
export function snowAlbedoDiagnostic(tsC) {
  const a =
    FSM_ALB_MIN + ((FSM_ALB_MAX - FSM_ALB_MIN) * (0 - tsC)) / FSM_T_ALPHA;
  return Math.min(Math.max(a, FSM_ALB_MIN), FSM_ALB_MAX);
}

// Integrate a chronological daily series [{snowCm, tC}] from the
// fresh start. Starting at alb_max is exact where the window
// opens snowless (nothing is drawn without snow cover anyway)
// and decays through the window's own storms where it does not.
export function snowAlbedoFromSeries(days) {
  let a = FSM_ALB_MAX;
  for (const d of days) {
    a = snowAlbedoStep(a, snowfallCmToKgM2(d.snowCm || 0), d.tC);
  }
  return a;
}

// The display class at albedo alpha: the fresh RGB scaled by the
// printed broadband factor (1 at alb_max, 0.625 at the aged
// floor).
export function snowDisplayRGB(alpha) {
  const f = Math.min(Math.max(alpha / FSM_ALB_MAX, 0), 1);
  return SNOW_FRESH_RGB.map((c) => c * f);
}

// FSM Eq. 13, the printed snow-cover fraction of the ground for
// snow depth h: fs = tanh(h / hf) with Table 2's hf = 0.1 m. The
// paper's own printed pair - "Snow of depth equal to parameter
// hf thus covers 76 % of the ground and depth 2 hf covers 96 %"
// - is the gate's landmark. Driven live by the measured model
// snow depth (open-meteo current snow_depth, metres).
export const FSM_HF = 0.1;
export function snowCoverFraction(hM) {
  return Math.tanh(Math.max(hM, 0) / FSM_HF);
}
