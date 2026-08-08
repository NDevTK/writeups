// Reference gate for lakeice.js (node lakeice-reference.mjs):
// the Vanajavesi paper's printed climatology drives the
// integrator and its printed dates, thicknesses and
// sensitivities must re-emerge; the printed albedo law at its
// own printed values.
import {
  TABLE1_TA,
  HMAX_CLIM_CM,
  climFDD,
  FDD_ON,
  STEFAN_A2,
  MELT_CM_PER_DD,
  lakeIceSeries,
  climDailySeries,
  lakeIceAlphaBare,
  lakeIceAlpha,
  pirazziniMeltAlphaBare,
  ALPHA_OW,
  ALPHA_S,
  ALPHA_MI,
  H_MIN_M,
  SNOW_RAMP_M
} from './lakeice.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const MONTH_DAYS = [31, 30, 31, 31, 28, 31, 30, 31];
const NAMES = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
const dateOf = (day) => {
  let m = 0;
  let x = day;
  while (x > MONTH_DAYS[m]) {
    x -= MONTH_DAYS[m];
    m++;
  }
  return `${NAMES[m]} ${x}`;
};
const runClim = (shift = 0) => {
  const days = climDailySeries(7).map((t) => t + shift);
  const trace = [];
  for (let i = 1; i <= days.length; i++)
    trace.push(lakeIceSeries(days.slice(0, i)));
  const freeze = trace.findIndex((r) => r.on) + 1;
  const maxH = Math.max(...trace.map((r) => r.hCm));
  const maxDay = trace.findIndex((r) => r.hCm === maxH) + 1;
  let breakup = -1;
  for (let i = maxDay; i < trace.length; i++) {
    if (!trace[i].on) {
      breakup = i + 1;
      break;
    }
  }
  return {trace, freeze, maxH, maxDay, breakup};
};

{
  // The derived constants ARE the printed pairs: Table 1
  // verbatim (monthly means, -0.4 November and +2.7 April
  // among them); FDD_ON = November's whole printed cooling
  // (12 degC day <-> the printed 30 November mean freezing
  // date); a^2 pinned by the printed 53 cm maximum over the
  // printed climatological season; the melt rate by the printed
  // "2 cm d-1 melting in April". And the Stefan sqrt-FDD
  // identity the paper prints ("in proportion to the square
  // root of the freezing-degree days") is EXACT over the
  // pure-frost winter: the integrator's end-of-March thickness
  // equals a sqrt(FDD - FDD_ON) to machine precision.
  const t1 =
    TABLE1_TA.length === 8 &&
    TABLE1_TA[0] === 4.6 &&
    TABLE1_TA[1] === -0.4 &&
    TABLE1_TA[2] === -4.1 &&
    TABLE1_TA[3] === -5.9 &&
    TABLE1_TA[4] === -6.5 &&
    TABLE1_TA[5] === -2.7 &&
    TABLE1_TA[6] === 2.7 &&
    TABLE1_TA[7] === 9.5;
  const fdd = climFDD(5);
  const a = Math.sqrt(STEFAN_A2);
  const pureFrost = climDailySeries(5).filter((T) => T < 0);
  const hEnd = lakeIceSeries(pureFrost).hCm;
  const ident = Math.abs(hEnd - a * Math.sqrt(fdd - FDD_ON)) < 1e-9;
  const ok =
    t1 &&
    Math.abs(FDD_ON - 12) < 1e-9 &&
    Math.abs(fdd - 587.7) < 0.2 &&
    a > 2.1 &&
    a < 2.3 &&
    Math.abs(hEnd - HMAX_CLIM_CM) < 1e-9 &&
    ident &&
    Math.abs(MELT_CM_PER_DD - 2 / 2.7) < 1e-12;
  check(
    'printed pairs pin the constants',
    ok,
    `Table 1 verbatim; FDD_ON = ${FDD_ON} degC d (printed 30 Nov at -0.4); climatological FDD ${fdd.toFixed(1)}; a = ${a.toFixed(3)} cm/sqrt(degC d) from the printed 53 cm (classic snow-lake range); sqrt-FDD identity exact (${hEnd.toFixed(3)} cm); melt ${MELT_CM_PER_DD.toFixed(3)} cm/degC d from the printed 2 cm/d at +2.7`
  );
}

{
  // The printed climatology run: freezing at the printed mean
  // date (30 November +- rounding), maximum 53 cm at the end of
  // March, breakup against the printed observed 30 April, and
  // the season length against the printed 152 d. The Kuivajarvi
  // validation circles (their Fig. 7: mid-month observed means
  // ~0.20, 0.35, 0.44, 0.50 m December-March) re-emerge within
  // a few centimetres.
  const {trace, freeze, maxH, maxDay, breakup} = runClim(0);
  const mid = (m) =>
    trace[MONTH_DAYS.slice(0, m).reduce((s, d) => s + d, 0) + 15 - 1].hCm;
  const midDec = mid(2);
  const midJan = mid(3);
  const midFeb = mid(4);
  const midMar = mid(5);
  const ok =
    Math.abs(freeze - 61) <= 2 &&
    Math.abs(maxH - 53) < 0.5 &&
    Math.abs(maxDay - 182) <= 2 &&
    Math.abs(breakup - 209) <= 4 &&
    breakup - freeze > 140 &&
    breakup - freeze < 160 &&
    Math.abs(midDec - 20) < 4 &&
    Math.abs(midJan - 35) < 4 &&
    Math.abs(midFeb - 44) < 3 &&
    Math.abs(midMar - 50) < 3;
  check(
    'printed climatological season re-emerges',
    ok,
    `freeze ${dateOf(freeze)} (printed 30 Nov), max ${maxH.toFixed(1)} cm at ${dateOf(maxDay)} (printed 53 cm), breakup ${dateOf(breakup)} (printed 30 Apr), season ${breakup - freeze} d (printed 152); Kuivajarvi mid-months ${midDec.toFixed(0)}/${midJan.toFixed(0)}/${midFeb.toFixed(0)}/${midMar.toFixed(0)} cm vs observed ~20/35/44/50`
  );
}

{
  // The printed sensitivities: "the air temperature shifts
  // affect the freezing date by 5 d degC-1 and the breakup date
  // by 8 d degC-1"; ice thickness change "up to +-6 cm" per
  // degC. A +1 degC world freezes ~4-6 d later and thins the
  // maximum by ~6-7 cm; -1 degC thickens it the same and holds
  // ice ~a week longer. (The -1 degC freezing date and the
  // printed +-5 degC extremes need the full heat-balance model -
  // the paper's own attribution of breakup to net solar
  // radiation - and are out of a degree-day model's scope.)
  const base = runClim(0);
  const warm = runClim(1);
  const cold = runClim(-1);
  const ok =
    warm.freeze - base.freeze >= 3 &&
    warm.freeze - base.freeze <= 7 &&
    base.maxH - warm.maxH > 5 &&
    base.maxH - warm.maxH < 8 &&
    cold.maxH - base.maxH > 5 &&
    cold.maxH - base.maxH < 8 &&
    base.breakup - warm.breakup >= 5 &&
    base.breakup - warm.breakup <= 12 &&
    cold.breakup - base.breakup >= 5 &&
    cold.breakup - base.breakup <= 12;
  check(
    'printed degC sensitivities',
    ok,
    `+1 degC: freeze +${warm.freeze - base.freeze} d (printed 5 d/degC), max ${(base.maxH - warm.maxH).toFixed(1)} cm thinner (printed ~6), breakup ${base.breakup - warm.breakup} d earlier (printed 8); -1 degC: +${(cold.maxH - base.maxH).toFixed(1)} cm, breakup +${cold.breakup - base.breakup} d`
  );
}

{
  // The printed albedo law at its printed values: 0.15 below
  // the printed 0.001 m film (Yang's "0.1 cm" = Pirazzini's
  // h_min); bare ice min(0.55, 0.15 h^1.5 + 0.15) - dark black
  // ice (0.208 at the climatological 53 cm), capped at 0.55;
  // the snow ramp reaches alpha_s = 0.75 exactly at the printed
  // 0.1 m and stays there; monotone in both arguments. The
  // Pirazzini corroborations: their tuned melting form puts
  // 0.6 m ice at "about 0.3" (0.294 here, their printed RMSE
  // 0.032), and every drawn value sits inside their printed
  // daily-mean range 0.30-0.79 endpoints-inclusive (bare thin
  // ice reaches down to 0.15, their alpha_ow, before snow).
  const film = lakeIceAlphaBare(0.0005) === ALPHA_OW;
  const dark = Math.abs(lakeIceAlphaBare(0.53) - 0.208) < 0.005;
  const cap =
    lakeIceAlphaBare(2) === ALPHA_MI && lakeIceAlphaBare(3) === ALPHA_MI;
  const ramp0 = lakeIceAlpha(0.53, 0) === lakeIceAlphaBare(0.53);
  const ramp1 =
    lakeIceAlpha(0.53, SNOW_RAMP_M) === ALPHA_S &&
    lakeIceAlpha(0.53, 0.3) === ALPHA_S;
  let mono = true;
  for (let i = 1; i <= 20; i++) {
    if (lakeIceAlphaBare(i / 10) < lakeIceAlphaBare((i - 1) / 10) - 1e-12)
      mono = false;
    if (lakeIceAlpha(0.5, i / 100) < lakeIceAlpha(0.5, (i - 1) / 100) - 1e-12)
      mono = false;
  }
  const pz = Math.abs(pirazziniMeltAlphaBare(0.6) - 0.294) < 0.005;
  const ok =
    film && dark && cap && ramp0 && ramp1 && mono && pz && H_MIN_M === 0.001;
  check(
    'printed albedo law',
    ok,
    `film ${ALPHA_OW} below ${H_MIN_M} m; bare 53 cm ice ${lakeIceAlphaBare(0.53).toFixed(3)} (black ice), cap ${ALPHA_MI}; snow ramp hits ${ALPHA_S} at the printed 0.1 m, monotone; Pirazzini melting 0.6 m = ${pirazziniMeltAlphaBare(0.6).toFixed(3)} ("about 0.3", RMSE 0.032 printed)`
  );
}

{
  // Integration gating: a warm series grows nothing; a hard
  // freeze from open water needs the printed cooling budget
  // first (no ice the day frost begins); full melt resets the
  // budget so a late-autumn relapse must re-earn FDD_ON; and
  // the increment form matches the closed form over any pure-
  // frost stretch regardless of how the frost is distributed
  // (the printed proportionality is in the SUM, not the path).
  const warm = lakeIceSeries([5, 3, 8, 2, 6]);
  const firstFrost = lakeIceSeries([2, 1, -3]);
  const relapse = lakeIceSeries([-8, -8, 10, 10, 10, 10, 10, -1]);
  const pathA = lakeIceSeries([-2, -2, -2, -2, -2, -2, -10, -10]);
  const pathB = lakeIceSeries([-10, -2, -2, -10, -2, -2, -2, -2]);
  const ok =
    warm.hCm === 0 &&
    !warm.on &&
    firstFrost.hCm === 0 &&
    !firstFrost.on &&
    !relapse.on &&
    Math.abs(pathA.hCm - pathB.hCm) < 1e-12 &&
    pathA.on;
  check(
    'integration gating',
    ok,
    `all-warm grows nothing; first frost day alone cannot freeze the lake (budget ${FDD_ON} degC d); full melt resets the budget; path-independence of the pure-frost sum exact (${pathA.hCm.toFixed(2)} cm both orders)`
  );
}

process.exit(fail ? 1 : 0);
