// Reference gate for comets.js (node comets-reference.mjs):
//  - the Stumpff functions at their closed points and the
//    series/closed-form seam
//  - universal Kepler at its exact limits: the circle (constant
//    radius, uniform angle), the parabola (Barker's equation
//    satisfied identically), time-reversal symmetry, and the
//    vis-viva energy integral held along all three orbit types
//  - the MPC Soft00 lines parse to their published element
//    values
//  - PROPAGATION AGAINST JPL HORIZONS, three orbit regimes with
//    one solver: Hale-Bopp (e = 0.9949, 29 years past
//    perihelion, 50.9 AU out), the interstellar 3I/ATLAS
//    (e = 6.14, hyperbolic) and the short-period P/1996 R2 -
//    same-day element sets, independent ephemeris
//  - the magnitude law at its closed points (1 AU / 1 AU gives
//    g exactly; each factor's own slope)
import {
  cometMagnitude,
  cometState,
  GAUSS_K,
  jdOf,
  keplerUniversal,
  MU_SUN,
  parseSoft00,
  stumpffC,
  stumpffS,
  visibleComets
} from './comets.js';
import {
  HORIZONS_JD,
  HORIZONS_KM,
  KM_PER_AU,
  MPC_LINES
} from './comets-fixture.mjs';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // Stumpff closed points: C(0) = 1/2, S(0) = 1/6 (the series);
  // C(pi^2) = 2/pi^2 exactly (cos(pi) = -1); the elliptic and
  // hyperbolic closed forms meet the series at the seam.
  const seamC = Math.abs(stumpffC(1e-6) - stumpffC(1.0000001e-6));
  const ok =
    Math.abs(stumpffC(0) - 0.5) < 1e-15 &&
    Math.abs(stumpffS(0) - 1 / 6) < 1e-15 &&
    Math.abs(stumpffC(Math.PI * Math.PI) - 2 / (Math.PI * Math.PI)) < 1e-15 &&
    Math.abs(stumpffC(-1) - (Math.cosh(1) - 1)) < 1e-15 &&
    seamC < 1e-9;
  check(
    'Stumpff functions',
    ok,
    `C(0) = 1/2, S(0) = 1/6, C(pi^2) = 2/pi^2 exactly; hyperbolic branch C(-1) = cosh(1) - 1; series seam gap ${seamC.toExponential(1)}`
  );
}

{
  // Universal Kepler closed limits. Circle (e = 0, q = a): the
  // radius never moves and the swept angle is n t exactly.
  // Parabola (e = 1): Barker's equation q chi + chi^3/6 =
  // sqrt(mu) t holds identically at the returned chi's position.
  // Time reversal: x(t) = x(-t), y(t) = -y(-t). Vis-viva: the
  // energy integral v^2/2 - mu/r = -mu(1-e)/(2q) held along all
  // three regimes (velocity by central differences).
  const a = 2.5;
  const n = Math.sqrt(MU_SUN / a ** 3);
  const t = 137.25;
  const circ = keplerUniversal(a, 0, t);
  const angErr = Math.abs(
    Math.atan2(circ.y, circ.x) - ((n * t) % (2 * Math.PI))
  );
  const par = keplerUniversal(1.2, 1, 55);
  // recover chi from the parabola: r = q + chi^2/2
  const chiP = Math.sqrt(2 * (par.r - 1.2));
  const barker = Math.abs(1.2 * chiP + chiP ** 3 / 6 - Math.sqrt(MU_SUN) * 55);
  const fw = keplerUniversal(0.9, 0.7, 80);
  const bw = keplerUniversal(0.9, 0.7, -80);
  const visviva = (q, e, tt) => {
    const h = 1e-4;
    const p1 = keplerUniversal(q, e, tt - h);
    const p2 = keplerUniversal(q, e, tt + h);
    const vx = (p2.x - p1.x) / (2 * h);
    const vy = (p2.y - p1.y) / (2 * h);
    const p = keplerUniversal(q, e, tt);
    return (
      (vx * vx + vy * vy) / 2 - MU_SUN / p.r - (-MU_SUN * (1 - e)) / (2 * q)
    );
  };
  const ok =
    Math.abs(circ.r - a) < 1e-12 &&
    angErr < 1e-10 &&
    barker < 1e-12 &&
    Math.abs(fw.x - bw.x) < 1e-10 &&
    Math.abs(fw.y + bw.y) < 1e-10 &&
    Math.abs(visviva(1.0, 0.5, 200)) < 1e-8 &&
    Math.abs(visviva(1.2, 1.0, 200)) < 1e-8 &&
    Math.abs(visviva(1.36, 6.14, 200)) < 1e-8;
  check(
    'universal Kepler',
    ok,
    `circle holds r = a to 1e-12 with the mean motion's own angle; Barker's equation satisfied to ${barker.toExponential(1)} at e = 1; time reversal exact; vis-viva energy held on ellipse, parabola AND the e = 6.14 hyperbola`
  );
}

{
  // The MPC lines parse to their published values.
  const els = parseSoft00(MPC_LINES.join('\n'));
  const hb = els[0];
  const ia = els[1];
  const lk = els[2];
  const ok =
    els.length === 3 &&
    hb.name.startsWith('C/1995 O1') &&
    Math.abs(hb.q - 0.923247) < 1e-12 &&
    Math.abs(hb.e - 0.994902) < 1e-12 &&
    Math.abs(hb.tp - jdOf(1997, 3, 29.0354)) < 1e-9 &&
    hb.g === -2 &&
    ia.name === '3I/ATLAS' &&
    ia.e > 6 &&
    Math.abs(lk.e - 0.313918) < 1e-12;
  check(
    'MPC Soft00 parse',
    ok,
    `${els.length} lines: Hale-Bopp q = ${hb.q}, e = ${hb.e}, T = JD ${hb.tp.toFixed(4)}, g = ${hb.g}; 3I/ATLAS e = ${ia.e} (interstellar); Lagerkvist e = ${lk.e}`
  );
}

{
  // Propagation against JPL Horizons - the independent ephemeris,
  // same-day element sets, all three regimes through ONE solver.
  // Tolerances honest to what osculating two-body can do:
  // Hale-Bopp is 29 years of planetary perturbations from its
  // fit (5e-3 AU at 50.9 AU is 1e-4 relative); the current
  // apparitions hold tighter.
  const els = parseSoft00(MPC_LINES.join('\n'));
  const errAU = (el, key) => {
    const s = cometState(el, HORIZONS_JD);
    const [X, Y, Z] = HORIZONS_KM[key].map((v) => v / KM_PER_AU);
    return Math.hypot(s.x - X, s.y - Y, s.z - Z);
  };
  const eHB = errAU(els[0], 'halebopp');
  const eIA = errAU(els[1], 'atlas3i');
  const eLK = errAU(els[2], 'lagerkvist');
  const rHB = cometState(els[0], HORIZONS_JD).r;
  const ok =
    eHB < 5e-3 && eIA < 5e-3 && eLK < 5e-3 && Math.abs(rHB - 50.9) < 0.1;
  check(
    'Horizons cross-check',
    ok,
    `|ours - JPL|: Hale-Bopp ${eHB.toExponential(1)} AU (at r = ${rHB.toFixed(1)} AU, 29 years from perihelion), 3I/ATLAS ${eIA.toExponential(1)} AU (e = 6.14 hyperbola), Lagerkvist ${eLK.toExponential(1)} AU - one universal solver, three orbit regimes`
  );
}

{
  // The magnitude law at its closed points, and the pipeline:
  // Hale-Bopp at 50.9 AU today computes far below naked-eye and
  // is filtered; a synthetic great comet at r = delta = 0.5 AU
  // with g = 4 comes through brightest-first.
  const els = parseSoft00(MPC_LINES.join('\n'));
  const m0 = cometMagnitude({g: 5, k: 4}, 1, 1);
  const dDelta = cometMagnitude({g: 5, k: 4}, 1, 2) - m0;
  const dR = cometMagnitude({g: 5, k: 4}, 2, 1) - m0;
  const obs = {x: 0.2, y: -0.9, z: 0};
  const none = visibleComets(els, HORIZONS_JD, obs, 6);
  const bright = visibleComets(
    [
      ...els,
      {
        name: 'synthetic great comet',
        tp: HORIZONS_JD,
        q: 0.7,
        e: 0.999,
        peri: 0,
        node: 0,
        incl: 0,
        g: 4,
        k: 4
      }
    ],
    HORIZONS_JD,
    obs,
    6
  );
  const ok =
    m0 === 5 &&
    Math.abs(dDelta - 5 * Math.log10(2)) < 1e-12 &&
    Math.abs(dR - 10 * Math.log10(2)) < 1e-12 &&
    none.length === 0 &&
    bright.length === 1 &&
    bright[0].name === 'synthetic great comet' &&
    bright[0].mag < 6;
  check(
    'magnitude law and filter',
    ok,
    `m(1 AU, 1 AU) = g exactly; doubling Delta adds ${dDelta.toFixed(3)} mag, doubling r adds ${dR.toFixed(3)} (the 2.5k slope); today's three all filter out below mag 6, the synthetic perihelion comet comes through at ${bright[0].mag.toFixed(1)}`
  );
}

process.exit(fail ? 1 : 0);
