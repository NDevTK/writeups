// Reference printer for the sea's diurnal warm layer (node
// warmlayer-reference.mjs). PRIMARY: the COARE 3.6 warm-layer code
// the authors publish (coare36vnWarm_et - Fairall et al. 1996's
// simplified Price-Weller-Pinkel scheme, the routine PSL ran to
// produce the warm-layer columns of their ship flux archive). The
// gate holds:
//  - the code's constants (Ri_c 0.65, the 19-m cap, the 50-W/m^2
//    start, the 0.002-N/m^2 stress floor, the three-band solar
//    absorption over the layer, the 06:00 local start and the
//    longitude clock)
//  - THE PWP CLOSURE as an identity: at every step with an
//    uncapped layer, g Al dT dz / du^2 = Ri_c exactly - the two
//    printed coefficients ctd1, ctd2 are one critical Richardson
//    number
//  - the sqrt(t) law: under steady heating and stress the layer's
//    depth and warming both grow as the square root of elapsed time
//  - the day's shape: a synthetic clear day heats a calm sea by
//    tenths and a windy one by hundredths; the layer resets at the
//    local midnight and does not start before 06:00
//  - THE ARCHIVE: PSL's own dT_warm reproduced by integrating the
//    frozen cruise-days' hourly series with the archive's own
//    fluxes (shipflux-fixture.js SHIPFLUX_WARM) - a statistical
//    closure, hourly steps standing in for PSL's finer ones
import {
  DAY_START_S,
  DZ_WARM_MAX_M,
  FXP_START,
  Q_JAM_WM2,
  RI_CRITICAL,
  RHO_WATER,
  TAU_FLOOR,
  localSeconds,
  thermalExpansion35,
  warmLayerInit,
  warmLayerStep,
  warmSolarFraction
} from './warmlayer.js';
import {SHIPFLUX_WARM, SHIPFLUX_CRUISES} from './shipflux-fixture.js';
import {marinePanel, solarInterpolator, warmLayerDay} from './observatory.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const G = 9.80665;

// 1. the code's constants and clock
{
  const f19 = warmSolarFraction(19);
  const f1 = warmSolarFraction(1);
  const f001 = warmSolarFraction(0.01);
  // local seconds: 0 deg at 12:00 UTC is 12:30 local by the code's
  // (lon + 7.5)/15 clock; -117.16 deg (San Diego) at 02:00 UTC is
  // 18:41 local
  const l0 = localSeconds(Date.UTC(2026, 8, 5, 12, 0, 0), 0);
  const lSd = localSeconds(Date.UTC(2026, 8, 5, 2, 0, 0), -117.16);
  const ok =
    RI_CRITICAL === 0.65 &&
    DZ_WARM_MAX_M === 19 &&
    Q_JAM_WM2 === 50 &&
    TAU_FLOOR === 0.002 &&
    FXP_START === 0.5 &&
    DAY_START_S === 21600 &&
    f001 > 0 &&
    f001 < f1 &&
    f1 < f19 &&
    f19 < 1 &&
    near(
      f1,
      1 -
        (0.28 * 0.014 * (1 - Math.exp(-1 / 0.014)) +
          0.27 * 0.357 * (1 - Math.exp(-1 / 0.357)) +
          0.45 * 12.82 * (1 - Math.exp(-1 / 12.82))),
      1e-15
    ) &&
    near(l0, 12.5 * 3600, 1e-6) &&
    near(lSd, ((2 + (-117.16 + 7.5) / 15 + 24) % 24) * 3600, 1e-6) &&
    near(thermalExpansion35(26.8), 2.1e-5 * Math.pow(30, 0.79), 1e-12);
  check(
    "the code's constants and clock",
    ok,
    `Ri_c ${RI_CRITICAL}, cap ${DZ_WARM_MAX_M} m, start at ${Q_JAM_WM2} W/m^2 of net heating, stress floor ${TAU_FLOOR} N/m^2, fxp ${FXP_START} to begin; the three-band absorption takes ${(f001 * 100).toFixed(1)}% of the solar within 1 cm, ${(f1 * 100).toFixed(1)}% within 1 m, ${(f19 * 100).toFixed(1)}% within the 19-m cap; the longitude clock puts 12:00 UTC at ${(l0 / 3600).toFixed(2)} h local on the meridian and 02:00 UTC at ${(lSd / 3600).toFixed(2)} h at the pier's longitude`
  );
}

// a synthetic day: hourly steps from 00:00 local, steady inputs
// between sunrise and sunset
const day = ({
  tau,
  swPeak,
  qOut,
  tsea = 20,
  lon = 0,
  hours = 24,
  dtS = 3600
}) => {
  let st = warmLayerInit();
  const out = [];
  const t0 = Date.UTC(2026, 5, 21, 0, 0, 0) - ((lon + 7.5) / 15) * 3600e3; // local midnight
  for (let i = 0; i <= (hours * 3600) / dtS; i++) {
    const utc = t0 + i * dtS * 1000;
    const loc = localSeconds(utc, lon) / 3600;
    const sun =
      loc >= 6 && loc <= 18 ? swPeak * Math.sin((Math.PI * (loc - 6)) / 12) : 0;
    st = warmLayerStep(
      st,
      {
        utcMs: utc,
        lonDeg: lon,
        tseaC: tsea,
        swNet: sun,
        lwNet: qOut * 0.6,
        hsb: qOut * 0.1,
        hlb: qOut * 0.3,
        tau,
        g: G
      },
      3.4
    );
    out.push({loc, sun, ...st});
  }
  return out;
};

// 2. THE PWP CLOSURE as an identity
{
  const run = day({tau: 0.03, swPeak: 800, qOut: 120});
  let worst = 0;
  let nUncapped = 0;
  for (const s of run) {
    if (!s.jamset || s.qcolAc <= 0 || s.dzWarm >= DZ_WARM_MAX_M) continue;
    const al = thermalExpansion35(20);
    const ri = (G * al * s.dTwarm * s.dzWarm) / (s.duWarm * s.duWarm);
    worst = Math.max(worst, Math.abs(ri - RI_CRITICAL));
    nUncapped++;
  }
  check(
    'THE PWP CLOSURE holds at every step',
    nUncapped >= 6 && worst < 1e-9,
    `${nUncapped} uncapped hours of a steady day: the layer's bulk Richardson number g Al dT dz / du^2 sits at ${RI_CRITICAL} to ${worst.toExponential(1)} - ctd1 and ctd2 are one critical number, and the scheme is the PWP closure and nothing else`
  );
}

// 3. the sqrt(t) law under steady forcing
{
  // constant heating and stress from 06:00, minute steps
  let st = warmLayerInit();
  const lon = 0;
  const t0 = Date.UTC(2026, 5, 21, 0, 0, 0) - 0.5 * 3600e3;
  const at = {};
  for (let i = 0; i <= 12 * 60; i++) {
    const utc = t0 + i * 60e3;
    const loc = localSeconds(utc, lon) / 3600;
    st = warmLayerStep(
      st,
      {
        utcMs: utc,
        lonDeg: lon,
        tseaC: 20,
        swNet: loc >= 6 ? 700 : 0,
        lwNet: 60,
        hsb: 10,
        hlb: 40,
        tau: 0.02,
        g: G
      },
      3.4
    );
    if (near(loc, 7, 1e-6)) at.h1 = {...st};
    if (near(loc, 10, 1e-6)) at.h4 = {...st};
  }
  // with a FIXED absorbed fraction both would grow exactly as
  // sqrt(t) (tau_ac and qcol_ac linear in t); the three-band
  // absorption deepens with the layer, so the heating grows and
  // the exponents sit near the halves rather than on them -
  // measured here: 0.45 for the depth, 0.63 for the warming
  const pDz = Math.log(at.h4.dzWarm / at.h1.dzWarm) / Math.log(4);
  const pDt = Math.log(at.h4.dTwarm / at.h1.dTwarm) / Math.log(4);
  check(
    'the near-sqrt(t) growth under steady forcing',
    at.h1.jamset &&
      pDz > 0.4 &&
      pDz < 0.5 &&
      pDt > 0.55 &&
      pDt < 0.7 &&
      at.h1.dzWarm < DZ_WARM_MAX_M &&
      at.h4.dzWarm < DZ_WARM_MAX_M,
    `700 W/m^2 net solar and 0.02 N/m^2 from 06:00 over a 20 C sea losing 110 W/m^2: after 1 h the layer is ${at.h1.dzWarm.toFixed(2)} m and ${at.h1.dTwarm.toFixed(3)} K warm, after 4 h ${at.h4.dzWarm.toFixed(2)} m and ${at.h4.dTwarm.toFixed(3)} K - growth exponents ${pDz.toFixed(2)} (depth) and ${pDt.toFixed(2)} (warming) against the fixed-absorption closed form's 0.5 and 0.5: the layer's own deepening lets it absorb more of the sun`
  );
}

// 4. the day's shape: calm vs windy, the reset, the 06:00 start
{
  const calm = day({tau: 0.005, swPeak: 900, qOut: 100});
  const windy = day({tau: 0.3, swPeak: 900, qOut: 150});
  const peakCalm = Math.max(...calm.map((s) => s.dTwarm));
  const peakWindy = Math.max(...windy.map((s) => s.dTwarm));
  const at18 = calm.find((s) => near(s.loc, 18, 1e-6));
  const before6 = calm
    .filter((s) => s.loc < 6 && s.count > 1)
    .every((s) => s.dTwarm === 0);
  // the second day resets: run 48 h and look at 01:00 of day 2
  const two = day({tau: 0.005, swPeak: 900, qOut: 100, hours: 48});
  const day2early = two.find((s, i) => i > 24 && near(s.loc, 1, 1e-6));
  const sensor = at18.dTtoDepth;
  const ok =
    peakCalm > 0.3 &&
    peakCalm < 3 &&
    peakWindy < 0.1 &&
    peakWindy > 0 &&
    before6 &&
    day2early.dTwarm === 0 &&
    day2early.tauAc === 0 &&
    sensor > 0 &&
    sensor <= at18.dTwarm &&
    near(
      sensor,
      at18.dzWarm < 3.4 ? at18.dTwarm : (at18.dTwarm * 3.4) / at18.dzWarm,
      1e-12
    );
  check(
    "the day's shape",
    ok,
    `a 900-W/m^2 June day: calm (0.005 N/m^2) the sea warms ${peakCalm.toFixed(2)} K at the surface, at 18:00 the layer is ${at18.dzWarm.toFixed(1)} m deep and a thermometer 3.4 m down reads ${sensor.toFixed(2)} K under the surface; windy (0.3 N/m^2) it warms ${peakWindy.toFixed(3)} K; nothing accumulates before 06:00 and the second day starts from zero`
  );
}

// 5. THE ARCHIVE: PSL's own warm layer from the archive's own hours
{
  const grv = (lat) => {
    const x = Math.sin((lat * Math.PI) / 180);
    return (
      9.7803267715 *
      (1 +
        0.0052790414 * x ** 2 +
        0.0000232718 * x ** 4 +
        1.262e-7 * x ** 6 +
        7e-10 * x ** 8)
    );
  };
  let n = 0;
  let sb = 0;
  let s2 = 0;
  let nBig = 0;
  let sbBig = 0;
  let s2Big = 0;
  const peaks = [];
  for (const run of SHIPFLUX_WARM) {
    let st = warmLayerInit();
    let peakPort = 0;
    let peakPsl = 0;
    // PSL integrated whole cruises; a run cut from the middle of
    // one must start where PSL's accumulators were empty too - at
    // the first row after a local midnight and before 06:00 (the
    // scheme resets at midnight and arms on a pre-06:00 sample)
    const i0 = run.rows.findIndex(
      (r) => localSeconds(Date.parse(r.time), run.lonDeg) < DAY_START_S
    );
    if (i0 < 0) continue;
    for (const r of run.rows.slice(i0)) {
      const tsk = r.tseaC - (r.dtSkin ?? 0);
      const lwNet = 0.97 * (5.67e-8 * Math.pow(tsk + 273.16, 4) - r.lwDn);
      st = warmLayerStep(
        st,
        {
          utcMs: Date.parse(r.time),
          lonDeg: run.lonDeg,
          tseaC: r.tseaC,
          swNet: 0.945 * Math.max(0, r.swDn),
          lwNet,
          hsb: -r.hsDown,
          hlb: -r.hlDown,
          hrain: Number.isFinite(r.hrainDown) ? -r.hrainDown : 0,
          tau: r.tau,
          g: grv(run.latDeg)
        },
        0.05
      );
      if (st.count > 2 && Number.isFinite(r.dtWarm)) {
        const d = st.dTwarm - r.dtWarm;
        n++;
        sb += d;
        s2 += d * d;
        if (r.dtWarm > 0.2) {
          nBig++;
          sbBig += d;
          s2Big += d * d;
        }
        peakPort = Math.max(peakPort, st.dTwarm);
        peakPsl = Math.max(peakPsl, r.dtWarm);
      }
    }
    peaks.push({cruise: SHIPFLUX_CRUISES[run.c], peakPort, peakPsl});
  }
  const bias = sb / n;
  const rmse = Math.sqrt(s2 / n);
  const biasBig = sbBig / nBig;
  const rmseBig = Math.sqrt(s2Big / nBig);
  const peaksClose = peaks.filter((p) => p.peakPsl > 0.3);
  const peaksOk = peaksClose.filter(
    (p) => Math.abs(p.peakPort - p.peakPsl) < Math.max(0.15, 0.35 * p.peakPsl)
  ).length;
  const ok =
    n >= 300 &&
    Math.abs(bias) < 0.05 &&
    rmse < 0.15 &&
    Math.abs(biasBig) < 0.1 &&
    rmseBig < 0.3 &&
    peaksClose.length >= 4 &&
    peaksOk >= Math.ceil(0.75 * peaksClose.length);
  check(
    "THE ARCHIVE reproduces PSL's warm layer",
    ok,
    `${SHIPFLUX_WARM.length} frozen cruise-runs, ${n} hours: integrating the archive's own hourly stress, fluxes and measured solar, the port's dT_warm sits at bias ${bias.toFixed(3)} K, RMSE ${rmse.toFixed(3)} K against PSL's column (on the ${nBig} hours PSL warmed over 0.2 K: bias ${biasBig.toFixed(3)}, RMSE ${rmseBig.toFixed(3)}); of ${peaksClose.length} runs PSL warmed past 0.3 K the port lands the day's peak within 35% or 0.15 K on ${peaksOk} (${peaks.map((p) => `${p.cruise} ${p.peakPort.toFixed(2)}/${p.peakPsl.toFixed(2)}`).join(', ')}) - hourly steps standing in for PSL's finer clock`
  );
}

// 6. THE COMPOSITION: a synthetic pier day through
// observatory.warmLayerDay and marinePanel - six-minute measured-
// shape met under a sinusoidal 900-W/m^2 sun, the sub-skin surface
// standing above the 3.4-m sensor by what the layer holds there,
// the skin cooling that surface
{
  const lon = -117.26;
  const lat = 32.87;
  const t0 = Date.UTC(2026, 8, 5, 7, 0, 0); // local midnight
  const series = [];
  for (let i = 0; i <= (18 * 60) / 6; i++) {
    const utcMs = t0 + i * 6 * 60e3;
    series.push({utcMs, taC: 19.4, tsC: 20.5, uMs: 1.0, pPa: 101320});
  }
  const hourly = {time: [], vals: []};
  for (let h = 0; h <= 24; h++) {
    const ms = t0 + h * 3600e3;
    hourly.time.push(new Date(ms).toISOString().slice(0, 16));
    const loc = localSeconds(ms, lon) / 3600;
    hourly.vals.push(
      loc >= 6 && loc <= 18 ? 900 * Math.sin((Math.PI * (loc - 6)) / 12) : 0
    );
  }
  const solarAt = solarInterpolator(hourly);
  const warm = warmLayerDay(series, {
    zuM: 17.5,
    ztM: 16.5,
    lonDeg: lon,
    latDeg: lat,
    zSensorM: 3.4,
    dewC: 16.1,
    cf: 0,
    solarAt
  });
  const balloon = [];
  {
    let p = 1013.25 * Math.exp(-134 / 8400);
    let hPrev = 134;
    const tAt = (h) =>
      h < 734
        ? 24 - 0.0065 * (h - 134)
        : 24 - 0.0065 * 600 + 6 - 0.0065 * (h - 734);
    for (const h of [134, 164, 234, 434, 734, 834, 1134, 2134, 5134, 9134]) {
      if (h > 134) {
        const tMean = (tAt(hPrev) + tAt(h)) / 2 + 273.15;
        p *= Math.exp((-(h - hPrev) * 9.80665 * 0.0289644) / (8.31451 * tMean));
      }
      balloon.push({p, hM: h, tC: +tAt(h).toFixed(3), rh: 60});
      hPrev = h;
    }
  }
  const met = {
    uMs: 1.0,
    zuM: 17.5,
    taC: 19.4,
    ztM: 16.5,
    tsC: 20.5,
    pPa: 101320
  };
  const shore = {id: 'KSAN', km: 16, tC: 18.3, dewC: 16.1, cf: 0};
  const bare = marinePanel(met, balloon, {bliM: 600, shore, latDeg: lat});
  const warmed = marinePanel(met, balloon, {
    bliM: 600,
    shore,
    latDeg: lat,
    warm
  });
  const ok =
    warm &&
    warm.armed &&
    warm.dTwarmK > 0.3 &&
    warm.dTwarmK < 3 &&
    warm.dzWarmM > 0.5 &&
    warm.dzWarmM < DZ_WARM_MAX_M &&
    warm.dTtoSensorK > 0 &&
    warm.dTtoSensorK <= warm.dTwarmK &&
    warm.solarKwhM2 > 5 &&
    warm.solarKwhM2 < 8 &&
    warmed &&
    near(warmed.tBaseC, met.tsC + warm.dTtoSensorK, 1e-9) &&
    near(warmed.tInterfaceC, warmed.tBaseC - warmed.skinK, 1e-9) &&
    warmed.tInterfaceC > bare.tInterfaceC &&
    warmed.dTairSkinK < bare.dTairSkinK;
  check(
    'THE COMPOSITION: the pier day through the profile, the skin and the scheme',
    ok,
    warm
      ? `a calm 900-W/m^2 September day at the pier (water 20.5 C, air 19.4, 1 m/s): by 18:00 local the layer holds ${warm.dTwarmK.toFixed(2)} K at the surface over ${warm.dzWarmM.toFixed(1)} m, ${warm.dTtoSensorK.toFixed(2)} K of it above the 3.4-m sensor, from ${warm.solarKwhM2.toFixed(1)} kWh/m^2 of solar (${warm.steps} six-minute steps); the sub-skin surface stands at ${warmed.tBaseC.toFixed(2)} C and the skin cools it to ${warmed.tInterfaceC.toFixed(2)} (bare: ${bare.tInterfaceC.toFixed(2)}) - the air-skin contrast ${warmed.dTairSkinK.toFixed(2)} K instead of ${bare.dTairSkinK.toFixed(2)}`
      : 'warmLayerDay returned null'
  );
}

process.exit(fail ? 1 : 0);
