// Reference gate for wakes.js (node wakes-reference.mjs):
//  - the published V112 thrust curve carried exactly (spot rows
//    of GS 0011-9181 table 12-2), physical and monotone
//  - the actuator-disc floor: the momentum inversion exact at
//    its closed points (a = 1/4 round trip; the Betz point to
//    the sqrt(eps) the flat optimum permits), and the THEOREM -
//    the transferred thrust clears the floor inverted from
//    ENERCON's own published Cp at every row, converging above
//    rated where the loss share vanishes
//  - Jensen's wake at its closed points: the initial reduction
//    1 - sqrt(1 - Ct) exact at s -> 0, the (r0/(r0 + k s))^2
//    decay exactly 1/4 when the wake has doubled its radius
//  - Katic partial shadowing: the circle-circle lens at its
//    exact cases, monotone in offset
//  - Katic root-sum-square: two equal wakes -> sqrt(2) times one
//  - the LIVE Juvent farm: a west wind at 8 m/s wakes the
//    downwind rows and nothing upwind of them
import {
  ctFromCp,
  ctOf,
  E82_CP,
  farmFactors,
  overlapFrac,
  V112_CT,
  WAKE_K,
  wakeDeficit
} from './wakes.js';
import {parseTurbines, specOf} from './turbines.js';
import {TURBINES_FIXTURE} from './turbines-fixture.mjs';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // The published thrust curve: spot rows verbatim, all rows in
  // (0, 1), monotone non-increasing (thrust coefficient falls as
  // the pitch sheds load), the full 3-25 m/s domain at 0.5
  // steps.
  const at = (v) => V112_CT.find((r) => r[0] === v)?.[1];
  let mono = true;
  for (let i = 1; i < V112_CT.length; i++) {
    if (V112_CT[i][1] > V112_CT[i - 1][1]) mono = false;
  }
  const ok =
    V112_CT.length === 45 &&
    at(3) === 0.913 &&
    at(8) === 0.798 &&
    at(12) === 0.409 &&
    at(25) === 0.045 &&
    mono &&
    V112_CT.every((r) => r[1] > 0 && r[1] < 1) &&
    WAKE_K === 0.075;
  check(
    'published thrust curve',
    ok,
    `GS table 12-2 at 1.225 kg/m^3: Ct(3) = 0.913, Ct(8) = 0.798, Ct(12) = 0.409, Ct(25) = 0.045 verbatim; 45 rows, monotone, physical; k = ${WAKE_K} (WAsP land)`
  );
}

{
  // The actuator-disc floor. Closed points first: a = 1/4
  // (Cp = 0.5625 -> Ct = 0.75) exact to 1e-12; the Betz point
  // (Cp = 16/27 -> Ct = 8/9) exact to the ~sqrt(eps) the FLAT
  // optimum permits (dCp/da = 0 there - no inversion can do
  // better in doubles). Then the theorem: real losses only
  // lower Cp at fixed induction, so inverting a MEASURED Cp
  // understates the induction and the floor sits under the true
  // thrust - the transferred E-82 curve must clear it at every
  // published row, and converge to it above rated where the
  // loss share vanishes.
  const betz = ctFromCp(16 / 27);
  const quarter = ctFromCp(0.5625);
  const e = specOf({model: 'E82'});
  let floorOk = true;
  let farGap = 0;
  for (const [v, cp] of E82_CP) {
    if (!(cp > 0) || v < e.cutIn || v > 25) continue;
    const floor = ctFromCp(cp);
    const ct = ctOf(e, v);
    if (ct < floor - 1e-9) floorOk = false;
    if (v >= 20) farGap = Math.max(farGap, ct / floor - 1);
  }
  const ok =
    Math.abs(quarter - 0.75) < 1e-12 &&
    Math.abs(betz - 8 / 9) < 1e-6 &&
    ctFromCp(0) < 1e-12 &&
    floorOk &&
    farGap < 0.35;
  check(
    'actuator-disc floor',
    ok,
    `a = 1/4: Cp 0.5625 -> Ct 0.75 exact; Betz -> ${betz.toFixed(9)} (flat-optimum precision); the transferred E-82 thrust clears the floor from ENERCON's own Cp at every row and sits within ${(farGap * 100).toFixed(0)}% of it above 20 m/s`
  );
}

{
  // Jensen at its closed points: full wake on the axis at s -> 0
  // gives the initial reduction 1 - sqrt(1 - Ct) exactly; when
  // the wake has doubled its radius (s = r0/k) the deficit is
  // exactly a quarter of that; the far field decays as s^-2.
  const ct = 0.798; // the V112's own 8 m/s thrust
  const init = 1 - Math.sqrt(1 - ct);
  const d0 = wakeDeficit(ct, 45, 45, 1e-9, 0);
  const dDouble = wakeDeficit(ct, 45, 1e-9, 45 / WAKE_K, 0);
  const far1 = wakeDeficit(ct, 45, 1e-9, 8000, 0);
  const far2 = wakeDeficit(ct, 45, 1e-9, 16000, 0);
  const ok =
    Math.abs(d0 - init) < 1e-9 &&
    Math.abs(dDouble - init / 4) < 1e-12 &&
    far2 > 0 &&
    Math.abs(far1 / far2 - ((45 + 0.075 * 16000) / (45 + 0.075 * 8000)) ** 2) <
      1e-9 &&
    wakeDeficit(ct, 45, 45, -10, 0) === 0 &&
    wakeDeficit(0, 45, 45, 100, 0) === 0;
  check(
    "Jensen's wake",
    ok,
    `initial reduction 1 - sqrt(1 - ${ct}) = ${init.toFixed(4)} exact at the rotor; exactly /4 where the wake has doubled (s = r0/k = ${(45 / WAKE_K).toFixed(0)} m); far field ~ s^-2; nothing upwind, no wake when parked`
  );
}

{
  // Katic partial shadowing - the lens at its exact cases:
  // separated discs 0, rotor swallowed 1, wake swallowed
  // rw^2/rj^2, and the equal-circles closed form - two discs of
  // radius r a distance r apart overlap exactly
  // (2 pi/3 - sqrt(3)/2) r^2; monotone in the offset.
  const swallowed = overlapFrac(10, 30, 5);
  const equal = overlapFrac(30, 30, 30);
  const equalWant = ((2 * Math.PI) / 3 - Math.sqrt(3) / 2) / Math.PI;
  let mono = true;
  let prev = Infinity;
  for (let c = 0; c <= 80; c += 2) {
    const f = overlapFrac(30, 20, c);
    if (f > prev + 1e-12) mono = false;
    prev = f;
  }
  const ok =
    overlapFrac(30, 20, 60) === 0 &&
    overlapFrac(30, 20, 5) === 1 &&
    Math.abs(swallowed - 100 / 900) < 1e-12 &&
    Math.abs(equal - equalWant) < 1e-12 &&
    mono;
  check(
    'Katic partial shadowing',
    ok,
    `disjoint 0, swallowed rotor 1, swallowed wake rw^2/rj^2 = ${swallowed.toFixed(4)} exact, equal circles at one radius = ${equal.toFixed(6)} = (2pi/3 - sqrt(3)/2)/pi exactly; monotone in offset`
  );
}

{
  // Katic root-sum-square: two identical upstream turbines side
  // by side lay exactly sqrt(2) times one turbine's deficit on a
  // common downstream point; zero downwind separation lays no
  // wake (Jensen's s > 0 domain), so the coincident pair and the
  // front row all keep the free wind.
  const spec = specOf({model: 'V112'});
  const wind = {x: 1, z: 0};
  const v = () => 8;
  const one = farmFactors(
    [
      {x: 0, y: 84, z: 0, spec},
      {x: 500, y: 84, z: 0, spec}
    ],
    wind,
    v
  );
  const two = farmFactors(
    [
      {x: 0, y: 84, z: 0, spec},
      {x: 0, y: 84, z: 1e-6, spec},
      {x: 500, y: 84, z: 0, spec}
    ],
    wind,
    v
  );
  const dOne = 1 - one[1];
  const dTwo = 1 - two[2];
  const ok =
    one[0] === 1 &&
    dOne > 0.05 &&
    Math.abs(dTwo - Math.SQRT2 * dOne) < 1e-6 &&
    two[0] === 1 &&
    two[1] === 1;
  check(
    'Katic superposition',
    ok,
    `one V112 500 m upwind at 8 m/s costs ${(dOne * 100).toFixed(1)}%; two coincident upwind cost ${(dTwo * 100).toFixed(1)}% = sqrt(2) x one exactly; the front row keeps the free wind`
  );
}

{
  // The LIVE farm: Juvent's 19 turbines in metres (equirect at
  // the farm centre), a west wind at 8 m/s. The east-west spread
  // of the farm guarantees waked machines; front-row machines
  // (no neighbour upwind within the fan) keep factor 1; every
  // factor stays physical; calm air wakes nothing.
  const t = parseTurbines(TURBINES_FIXTURE);
  const lat0 = 47.19;
  const lon0 = 7.01;
  const mLat = 111320;
  const mLon = mLat * Math.cos((lat0 * Math.PI) / 180);
  const farm = t.map((x) => ({
    x: (x.lon - lon0) * mLon,
    z: (x.lat - lat0) * mLat,
    y: x.spec.hub,
    spec: x.spec
  }));
  const f = farmFactors(farm, {x: 1, z: 0}, () => 8);
  const waked = f.filter((v) => v < 0.999).length;
  const free = f.filter((v) => v === 1).length;
  const worst = Math.min(...f);
  const calm = farmFactors(farm, {x: 1, z: 0}, () => 1);
  const ok =
    f.length === 19 &&
    waked >= 4 &&
    free >= 4 &&
    worst > 0.5 &&
    f.every((v) => v > 0 && v <= 1) &&
    calm.every((v) => v === 1);
  check(
    'live Juvent farm',
    ok,
    `west wind, 8 m/s: ${waked} of 19 turbines waked, ${free} keep the free wind, deepest runs at ${(worst * 100).toFixed(0)}% of it; below cut-in the farm lays no wakes`
  );
}

process.exit(fail ? 1 : 0);
