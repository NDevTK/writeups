// Reference printer for the snow-age albedo (node
// snowage-reference.mjs). The law lives once in snowage.js - FSM
// 1.0 (Essery 2015, GMD 8, 3867) Eq. 10 with Table 2 verbatim -
// and these landmarks hold it to the print:
//  - the closed-form daily step IS Eq. 10: it matches brute
//    Euler sub-stepping and composes exactly (path independence)
//  - Fig. 3a re-derived: cold snow e-folds toward the aged floor
//    in exactly tau_cold = 1000 h, melting snow in 100 h - the
//    printed 10x; a fortnight of melt erases what a fortnight of
//    cold barely dents
//  - the printed refresh mass: 7 cm of open-meteo snowfall IS
//    S_alpha = 10 kg/m^2 through the feed's own printed
//    depth-to-water conversion, and one such day recovers more
//    than half the gap to the fresh albedo
//  - FSM Eq. 11 (diagnostic variant) agrees about temperature:
//    -2 degC fresh, 0 degC aged, exact midpoint at -1
//  - a synthetic winter: weekly storms hold the pack bright for
//    months, then the spring melt collapses it below 0.6 within
//    three days - the famous spring darkening emerges from the
//    two printed timescales
//  - the display fold: fresh class exact at alb_max, aged floor
//    exactly alb_min/alb_max = 0.625 of fresh
import {
  FSM_ALB_MAX,
  FSM_ALB_MIN,
  FSM_S_ALPHA,
  FSM_T_ALPHA,
  FSM_TAU_COLD,
  FSM_TAU_MELT,
  SNOW_FRESH_RGB,
  snowAlbedoDiagnostic,
  snowAlbedoFromSeries,
  snowAlbedoStep,
  snowDisplayRGB,
  snowfallCmToKgM2
} from './snowage.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // Table 2 verbatim.
  check(
    'FSM Table 2 verbatim',
    FSM_ALB_MAX === 0.8 &&
      FSM_ALB_MIN === 0.5 &&
      FSM_S_ALPHA === 10 &&
      FSM_T_ALPHA === 2 &&
      FSM_TAU_COLD === 1000 &&
      FSM_TAU_MELT === 100,
    `alb 0.8/0.5, S_alpha 10 kg/m^2, T_alpha 2 C, tau 1000/100 h`
  );
}

{
  // The closed-form step IS Eq. 10: brute Euler with 200000
  // sub-steps converges on it, and two half-day steps compose to
  // one day exactly (constant coefficients - path independence).
  const a0 = 0.71;
  const snow = 4.2; // kg/m^2 over the day
  const tC = -3;
  const exact = snowAlbedoStep(a0, snow, tC);
  let euler = a0;
  const N = 200000;
  const dt = 24 / N;
  const sf = snow / 24;
  for (let i = 0; i < N; i++) {
    euler +=
      dt *
      ((FSM_ALB_MIN - euler) / FSM_TAU_COLD +
        (sf / FSM_S_ALPHA) * (FSM_ALB_MAX - euler));
  }
  const half = snowAlbedoStep(
    snowAlbedoStep(a0, snow / 2, tC, 12),
    snow / 2,
    tC,
    12
  );
  check(
    'Eq. 10 exact step',
    Math.abs(exact - euler) < 1e-7 && Math.abs(half - exact) < 1e-12,
    `closed form ${exact.toFixed(8)} vs Euler ${euler.toFixed(8)} (first-order residual); two half-days compose to ${half.toFixed(10)} (path independent)`
  );
}

{
  // Fig. 3a re-derived from the printed constants: pure decay
  // from the fresh albedo e-folds toward the aged floor in
  // exactly tau; the melting timescale is the printed 10x
  // faster; a fortnight of melt lands within 0.011 of the floor
  // while a fortnight of cold keeps 71 percent of the range.
  // The closed step at dtH = tau IS the e-fold (one exact step of
  // arbitrary length - constant coefficients).
  const target = FSM_ALB_MIN + (FSM_ALB_MAX - FSM_ALB_MIN) / Math.E;
  const cold = snowAlbedoStep(FSM_ALB_MAX, 0, -5, FSM_TAU_COLD);
  const melt = snowAlbedoStep(FSM_ALB_MAX, 0, 2, FSM_TAU_MELT);
  const cold14 = [...Array(14)].reduce((a) => snowAlbedoStep(a, 0, -5), 0.8);
  const melt14 = [...Array(14)].reduce((a) => snowAlbedoStep(a, 0, 2), 0.8);
  check(
    'Fig. 3a decay (printed timescales)',
    Math.abs(cold - target) < 1e-12 &&
      Math.abs(melt - target) < 1e-12 &&
      FSM_TAU_COLD / FSM_TAU_MELT === 10 &&
      cold14 > 0.71 &&
      melt14 < 0.511,
    `e-fold at tau exact (${cold.toFixed(6)} / ${melt.toFixed(6)} vs ${target.toFixed(6)}); ` +
      `tau ratio 10; after 14 days: cold ${cold14.toFixed(3)}, melting ${melt14.toFixed(3)}`
  );
}

{
  // The printed refresh mass through the feed's own printed
  // conversion: 7 cm of snowfall depth is exactly S_alpha = 10
  // kg/m^2 ("divide by 7" for water equivalent, 1 mm w.e. = 1
  // kg/m^2), and one such day at -5 C recovers 62 percent of the
  // gap from 0.55 back toward the fresh albedo.
  const kg = snowfallCmToKgM2(7);
  const after = snowAlbedoStep(0.55, kg, -5);
  const frac = (after - 0.55) / (FSM_ALB_MAX - 0.55);
  check(
    'refresh mass (printed S_alpha)',
    kg === FSM_S_ALPHA && frac > 0.5 && after > 0.7 && after < 0.71,
    `7 cm depth = ${kg} kg/m^2 exact; 0.55 -> ${after.toFixed(4)} in one storm day (${(frac * 100).toFixed(0)}% of the gap)`
  );
}

{
  // FSM Eq. 11, the diagnostic variant, agrees about which
  // temperatures mean dark snow: fresh at and below -T_alpha,
  // the aged floor at the melting point, the exact midpoint at
  // -1 C, clamped both sides.
  check(
    'Eq. 11 diagnostic cross-check',
    snowAlbedoDiagnostic(-2) === FSM_ALB_MAX &&
      snowAlbedoDiagnostic(-10) === FSM_ALB_MAX &&
      snowAlbedoDiagnostic(0) === FSM_ALB_MIN &&
      snowAlbedoDiagnostic(5) === FSM_ALB_MIN &&
      Math.abs(snowAlbedoDiagnostic(-1) - 0.65) < 1e-12,
    `alpha(-2) = 0.8, alpha(0) = 0.5, alpha(-1) = 0.65 exact; clamped beyond`
  );
}

{
  // A synthetic season: sixty cold days (-8 C) with a 3.5 cm
  // storm every seventh day hold the pack near two-thirds
  // bright; twenty melt days (+4 C, no snow) collapse it - below
  // 0.6 within three days, within 0.02 of the floor by day 15.
  // The spring darkening emerges from the two printed
  // timescales; nothing else is tuned.
  const days = [];
  for (let d = 0; d < 60; d++) {
    days.push({snowCm: d % 7 === 0 ? 3.5 : 0, tC: -8});
  }
  const winter = snowAlbedoFromSeries(days);
  let a = winter;
  let cross = -1;
  const trace = [];
  for (let d = 1; d <= 20; d++) {
    a = snowAlbedoStep(a, 0, 4);
    trace.push(a);
    if (cross < 0 && a < 0.6) cross = d;
  }
  check(
    'seasonal narrative (spring collapse emerges)',
    winter > 0.63 &&
      winter < 0.78 &&
      cross >= 2 &&
      cross <= 6 &&
      trace[14] < FSM_ALB_MIN + 0.02,
    `winter-end albedo ${winter.toFixed(3)} (weekly storms hold it); melt crosses 0.6 on day ${cross}; day 15 ${trace[14].toFixed(3)}`
  );
}

{
  // Display fold: the theme's fresh class rides the printed
  // broadband factor - exact at alb_max, exactly alb_min/alb_max
  // = 0.625 of fresh at the aged floor, monotone between.
  const fresh = snowDisplayRGB(FSM_ALB_MAX);
  const aged = snowDisplayRGB(FSM_ALB_MIN);
  const okFresh = fresh.every((c, i) => c === SNOW_FRESH_RGB[i]);
  const okAged = aged.every(
    (c, i) => Math.abs(c / SNOW_FRESH_RGB[i] - 0.625) < 1e-12
  );
  let mono = true;
  let prev = -1;
  for (let al = 0.5; al <= 0.801; al += 0.02) {
    const g = snowDisplayRGB(al)[1];
    if (g < prev) mono = false;
    prev = g;
  }
  check(
    'display fold (pinned at alb_max)',
    okFresh && okAged && mono,
    `fresh class exact (${fresh.map((c) => c.toFixed(2)).join('/')}); aged floor 0.625x fresh exact; monotone`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
