// Reference gate for turbines.js (node turbines-reference.mjs):
//  - the spec ladder: model sheets, explicit-tag overrides, and
//    the fleet-median fallback computed from the sheets
//  - the variable-speed control law at its published landmarks:
//    the rotor reaches its published top speed EXACTLY at its
//    published rated wind (the closure identity), tracks
//    lambda_opt v / R in region 2, and never leaves the
//    published operational interval
//  - ENERCON storm control: a linear speed taper across the
//    published 28-34 m/s window instead of a hard stop
//  - ENERCON's own calculated power curve (published verbatim
//    below) closes the E-82 constants: cut-in and rated wind are
//    READ OFF the table, Cp peaks at 0.50
//  - the log-profile hub wind: exact at the forecast model's own
//    10/80/120 m anchors
//  - the LIVE Mont Crosin fixture: 19 real turbines, three
//    models, refs carried
import {
  GENERIC,
  hubWind,
  MODEL_SPECS,
  parseTurbines,
  rotorOmega,
  specOf,
  YAW_DEG_S
} from './turbines.js';
import {TURBINES_FIXTURE} from './turbines-fixture.mjs';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const RPM = Math.PI / 30;

// ENERCON product overview, E-82 E2 2,300 kW "calculated power
// curve" - wind speed [m/s], power [kW], Cp [-]. Verbatim.
const E82_CURVE = [
  [1, 0, 0],
  [2, 3, 0.12],
  [3, 25, 0.29],
  [4, 82, 0.4],
  [5, 174, 0.43],
  [6, 321, 0.46],
  [7, 532, 0.48],
  [8, 815, 0.49],
  [9, 1180, 0.5],
  [10, 1580, 0.49],
  [11, 1890, 0.44],
  [12, 2100, 0.38],
  [13, 2250, 0.32],
  [14, 2350, 0.26],
  [15, 2350, 0.22],
  [16, 2350, 0.18],
  [17, 2350, 0.15],
  [18, 2350, 0.12],
  [19, 2350, 0.11],
  [20, 2350, 0.09],
  [21, 2350, 0.08],
  [22, 2350, 0.07],
  [23, 2350, 0.06],
  [24, 2350, 0.05],
  [25, 2350, 0.05]
];

{
  // The ladder: a model tag resolves the published sheet; an
  // explicit rotor:diameter beats it (rpm clamps stay published,
  // the closure recomputes); height - d/2 recovers a hub from a
  // tip height; an unknown model with a power tag sizes its
  // rotor from the fleet-median specific power of the sheets.
  const v90 = specOf({manufacturer: 'Vestas', model: 'V90'});
  const oride = specOf({model: 'V90', 'rotor:diameter': '100', height: '130'});
  const unk = specOf({
    model: 'Windmatic X',
    'generator:output:electricity': '2000 kW'
  });
  const bare = specOf({});
  const dFromP = Math.sqrt((4 * 2e6) / (Math.PI * GENERIC.specificPower));
  const ok =
    v90.d === 90 &&
    v90.hub === 80 &&
    v90.cutIn === 4 &&
    v90.vRated === 12 &&
    v90.cutOut === 25 &&
    Math.abs(v90.omMin - 9.3 * RPM) < 1e-12 &&
    Math.abs(v90.omMax - 16.6 * RPM) < 1e-12 &&
    oride.d === 100 &&
    Math.abs(oride.hub - 80) < 1e-12 &&
    Math.abs(oride.omMax - 16.6 * RPM) < 1e-12 &&
    unk.model === null &&
    Math.abs(unk.d - dFromP) < 1e-12 &&
    bare.d === GENERIC.d &&
    bare.hub === GENERIC.hub &&
    YAW_DEG_S === 0.5;
  check(
    'spec ladder',
    ok,
    `V90 tag -> the published sheet (D 90, hub 80, 9.3-16.6 rpm, cut-in 4, rated 12, cut-out 25); rotor:diameter 100 + tip height 130 override to D 100/hub 80; unknown model with 2000 kW sizes D ${unk.d.toFixed(1)} m from the fleet-median ${GENERIC.specificPower.toFixed(0)} W/m^2; yaw ${YAW_DEG_S} deg/s as published`
  );
}

{
  // The control law: below cut-in parked; region 2 EXACTLY
  // lambda_opt v / R between the published clamps; the closure
  // identity Omega(vRated) = Omega_max holds to machine
  // precision; above rated constant top speed; hard stop at the
  // Vestas cut-out; the whole sweep stays inside the published
  // operational interval.
  const s = specOf({model: 'V90'});
  const mid = 10; // inside region 2 for the V90
  let within = true;
  for (let v = s.cutIn; v < s.cutOut; v += 0.1) {
    const om = rotorOmega(s, v);
    if (om < s.omMin - 1e-12 || om > s.omMax + 1e-12) within = false;
  }
  const ok =
    rotorOmega(s, 3.9) === 0 &&
    Math.abs(rotorOmega(s, mid) - (s.lambda * mid) / s.r) < 1e-12 &&
    Math.abs(rotorOmega(s, s.vRated) - s.omMax) < 1e-15 &&
    rotorOmega(s, 20) === s.omMax &&
    rotorOmega(s, 25) === 0 &&
    rotorOmega(s, 5) === s.omMin &&
    within;
  check(
    'variable-speed law',
    ok,
    `V90: parked below cut-in, Omega = lambda v / R in region 2 (lambda ${s.lambda.toFixed(2)}), Omega(12 m/s) = ${(s.omMax / RPM).toFixed(1)} rpm exactly (the closure), constant to cut-out, 0 at 25; every speed within the published 9.3-16.6 rpm`
  );
}

{
  // ENERCON storm control: full speed to the window's edge, a
  // linear taper across the published 28-34 m/s (half speed at
  // 31), zero at 34 - no hard stop ("merely reduces power output
  // by slowing down the rotational speed").
  const e = specOf({manufacturer: 'Enercon', model: 'E82'});
  const ok =
    e.storm &&
    e.storm[0] === 28 &&
    e.storm[1] === 34 &&
    Math.abs(rotorOmega(e, 28) - e.omMax) < 1e-12 &&
    Math.abs(rotorOmega(e, 31) - e.omMax / 2) < 1e-12 &&
    rotorOmega(e, 34) === 0 &&
    rotorOmega(e, 33.9) > 0 &&
    specOf({model: 'V90'}).storm === null;
  check(
    'ENERCON storm control',
    ok,
    `E-82 runs at full ${(e.omMax / RPM).toFixed(0)} rpm to 28 m/s, half at 31, feathered at 34 - the published window, linearly; the Vestas sheets keep their hard cut-out`
  );
}

{
  // The published E-82 power curve closes the module constants:
  // cut-in = its first powered row, rated wind = its first
  // plateau row at/above the 2,300 kW nameplate, Cp peaks at
  // 0.50 (near the region-2 middle), and the published top speed
  // keeps the tip below the V90-median tip speed band.
  const e = MODEL_SPECS.E82;
  const firstPowered = E82_CURVE.find((r) => r[1] > 0)[0];
  const firstRated = E82_CURVE.find((r) => r[1] >= e.powerKW)[0];
  const cpMax = Math.max(...E82_CURVE.map((r) => r[2]));
  const cpAt = E82_CURVE.find((r) => r[2] === cpMax)[0];
  const tip = (e.rpmMax * RPM * e.d) / 2;
  const ok =
    firstPowered === e.cutIn &&
    firstRated === e.vRated &&
    cpMax === 0.5 &&
    cpAt === 9 &&
    tip < GENERIC.tipMax + 1 &&
    E82_CURVE.every((r, i) => i === 0 || r[1] >= E82_CURVE[i - 1][1]);
  check(
    'published power curve',
    ok,
    `ENERCON's own table: first power at ${firstPowered} m/s (= the sheet cut-in), 2,350 kW plateau from ${firstRated} m/s (= the sheet rated wind), Cp max ${cpMax} at ${cpAt} m/s, monotone; tip speed at 18 rpm = ${tip.toFixed(1)} m/s`
  );
}

{
  // The log-profile hub wind: exact at the forecast model's own
  // anchors, log-linear between them, monotone for an increasing
  // profile, floored at zero.
  const ok =
    hubWind(5, 8, 9, 10) === 5 &&
    hubWind(5, 8, 9, 80) === 8 &&
    hubWind(5, 8, 9, 120) === 9 &&
    Math.abs(hubWind(5, 8, 9, 40) - (5 + (3 * Math.log(4)) / Math.log(8))) <
      1e-12 &&
    hubWind(5, 8, 9, 98) > 8 &&
    hubWind(5, 8, 9, 98) < 9 &&
    hubWind(0, 0, 0, 78) === 0;
  check(
    'log-profile hub wind',
    ok,
    `exact at 10/80/120 m; 40 m interpolates on ln z between 10 and 80 (${hubWind(5, 8, 9, 40).toFixed(3)} m/s); hub 98 sits between the 80 and 120 m winds; calm stays calm`
  );
}

{
  // The LIVE fixture: 19 Juvent turbines on Mont Crosin, all
  // three models resolving their published sheets, 16 with their
  // JUV plant refs, one Vestas without a model tag falling to
  // the power rung, every position inside the capture box.
  const t = parseTurbines(TURBINES_FIXTURE);
  const byModel = {};
  for (const x of t) byModel[x.spec.model] = (byModel[x.spec.model] || 0) + 1;
  const refs = t.filter((x) => /^JUV \d+$/.test(x.ref || '')).length;
  const inBox = t.every(
    (x) => x.lat > 47.15 && x.lat < 47.3 && x.lon > 6.95 && x.lon < 7.15
  );
  const ok =
    t.length === 19 &&
    byModel.V90 === 11 &&
    byModel.E82 === 3 &&
    byModel.V112 === 4 &&
    byModel.null === 1 &&
    refs === 16 &&
    inBox &&
    t.every((x) => x.spec.hub >= 78 && x.spec.d >= 82);
  check(
    'live Mont Crosin fixture',
    ok,
    `19 turbines: ${byModel.V90} V90 + ${byModel.E82} E-82 + ${byModel.V112} V112 on their sheets, 1 model-less Vestas on the power rung, ${refs} JUV refs, all inside the capture box`
  );
}

process.exit(fail ? 1 : 0);
