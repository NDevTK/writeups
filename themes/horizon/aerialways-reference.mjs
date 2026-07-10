// Reference gate for aerialways.js (node aerialways-reference.mjs):
//  - the TRUE catenary: Newton hits the requested mid-span sag
//    through the cosh identity exactly, and the answer measurably
//    differs from the parabola approximation
//  - unequal support heights: both endpoints exact through the
//    asinh vertex closed form; the cable hangs strictly below the
//    chord
//  - the LIVE Jungfrau fixture: 44 installations with their
//    names, pylon lines verbatim
//  - cabins: deterministic hash positions, counts by kind
import {
  cabinFractions,
  catenaryPoints,
  parseAerialways,
  SAG_FRAC,
  solveCatenaryA
} from './aerialways.js';
import {AERIAL_FIXTURE} from './aerialways-fixture.mjs';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // Newton on d = a (cosh(L/2a) - 1): the solved a reproduces the
  // requested sag to 1e-9, and is NOT the parabolic seed
  // L^2/(8d) - the curve is the catenary, not its approximation.
  const L = 400;
  const d = 12;
  const a = solveCatenaryA(L, d);
  const resid = a * (Math.cosh(L / (2 * a)) - 1) - d;
  const parab = (L * L) / (8 * d);
  // The symmetric span drawn with that a: midpoint exactly d below
  // the (level) supports.
  const pts = catenaryPoints([0, 50, 0], [L, 50, 0], 16, d / L);
  const mid = pts[8][1];
  check(
    'true catenary solve',
    Math.abs(resid) < 1e-9 &&
      Math.abs(a - parab) > 1 &&
      Math.abs(mid - (50 - d)) < 1e-9,
    `a = ${a.toFixed(3)} reproduces the 12 m sag to ${Math.abs(resid).toExponential(1)} (the parabola would say ${parab.toFixed(3)}); the drawn midpoint hangs exactly 12 m below the supports`
  );
}

{
  // Unequal support heights, arbitrary heading: both endpoints
  // exact via the asinh vertex form, every interior point
  // strictly below the chord (a cable hangs - it never rises
  // above its supports' line).
  const p0 = [10, 100, -5];
  const p1 = [190, 160, 250];
  const pts = catenaryPoints(p0, p1, 20);
  const e0 = Math.hypot(
    pts[0][0] - p0[0],
    pts[0][1] - p0[1],
    pts[0][2] - p0[2]
  );
  const e1 = Math.hypot(
    pts[20][0] - p1[0],
    pts[20][1] - p1[1],
    pts[20][2] - p1[2]
  );
  let below = true;
  let maxDrop = 0;
  for (let i = 1; i < 20; i++) {
    const t = i / 20;
    const chordY = p0[1] + (p1[1] - p0[1]) * t;
    const drop = chordY - pts[i][1];
    if (drop <= 0) below = false;
    maxDrop = Math.max(maxDrop, drop);
  }
  check(
    'unequal supports',
    e0 < 1e-9 && e1 < 1e-9 && below && maxDrop > 0,
    `a 60 m climb over a ${Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(0)} m span: endpoints exact to ${Math.max(e0, e1).toExponential(1)}, every interior point below the chord (deepest ${maxDrop.toFixed(2)})`
  );
}

const ways = parseAerialways(AERIAL_FIXTURE);

{
  // The LIVE fixture: the region's aerial installations parse with
  // their identity - the Schilthorn approach, Niederhorn, the
  // Firstbahn - pylon lines verbatim (nothing thinned).
  const kinds = new Set(ways.map((w) => w.kind));
  const names = new Set(ways.map((w) => w.name));
  const first = ways[0];
  const ok =
    ways.length === 44 &&
    kinds.size === 3 &&
    names.has('Luftseilbahn Beatenberg-Niederhorn') &&
    names.has('Firstbahn') &&
    ways.every((w) => w.pts.length >= 2) &&
    first.pts.length === 13; // the capture's first pylon line, intact
  check(
    'live Jungfrau fixture',
    ok,
    `${ways.length} installations (${[...kinds].join('/')}) - Niederhorn and the Firstbahn by name, pylon lines verbatim`
  );
}

{
  // Cabins: a cable car runs one per direction; a gondola
  // circulates by spacing; fractions live in [0, 1) and are
  // deterministic in the OSM id.
  const cc = cabinFractions({id: 42, kind: 'cable_car'}, 3000);
  const gd = cabinFractions({id: 42, kind: 'gondola'}, 2200);
  const gd2 = cabinFractions({id: 42, kind: 'gondola'}, 2200);
  const ok =
    cc.length === 2 &&
    gd.length === 10 &&
    gd.every((f, i) => f >= 0 && f < 1 && f === gd2[i]);
  check(
    'cabin positions',
    ok,
    `cable car 2 cars, a 2.2 km gondola ${gd.length} cabins at deterministic hash fractions`
  );
}

process.exit(fail ? 1 : 0);
