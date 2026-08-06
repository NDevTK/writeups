// powerlines-reference.mjs - the gate for the transmission layer.
// Landmarks:
//  - parse forms: line and minor_line kept with their vertex
//    chains; power=cable, location=underground (the tunnel
//    doctrine - buried plant is not drawn) and 1-vertex ways all
//    skipped; a sane height tag overrides the display default,
//    junk heights fall back (35 m towers, 10 m poles)
//  - the catenary is the aerialways' own gated solver,
//    re-exported not re-derived: endpoints exact, midpoint sag =
//    SAG_FRAC x span for equal supports - the identity that
//    proves one sag law serves gondolas and grid alike
import {
  catenaryPoints,
  parsePowerLines,
  POLE_M,
  SAG_FRAC,
  TOWER_M
} from './powerlines.js';
import {
  catenaryPoints as aerialCatenary,
  SAG_FRAC as AERIAL_SAG
} from './aerialways.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const way = (id, tags, n = 3) => ({
  type: 'way',
  id,
  tags,
  geometry: Array.from({length: n}, (_, i) => ({
    lat: 46.6 + i * 0.001,
    lon: 8.0
  }))
});

{
  const lines = parsePowerLines({
    elements: [
      way(1, {power: 'line'}),
      way(2, {power: 'minor_line'}),
      way(3, {power: 'line', height: '52'}),
      way(4, {power: 'line', height: '900'}),
      way(5, {power: 'cable'}),
      way(6, {power: 'line', location: 'underground'}),
      way(7, {power: 'line'}, 1),
      way(8, {power: 'generator'})
    ]
  });
  check(
    'parse forms',
    lines.length === 4 &&
      lines[0].hM === TOWER_M &&
      !lines[0].minor &&
      lines[1].hM === POLE_M &&
      lines[1].minor &&
      lines[2].hM === 52 &&
      lines[3].hM === TOWER_M &&
      lines[0].pts.length === 3,
    `4 of 8 kept: line (35 m default), minor_line (10 m pole), tagged 52 m honoured, junk 900 m falls back; cable/underground (the tunnel doctrine), 1-vertex and non-line skipped`
  );
}

{
  // One sag law: the re-export IS the aerialways solver, and an
  // equal-support span sags SAG_FRAC x span at midpoint.
  const span = 100;
  const pts = catenaryPoints([0, 20, 0], [span, 20, 0], 16);
  const mid = pts[8];
  const sag = 20 - mid[1];
  check(
    'one sag law',
    catenaryPoints === aerialCatenary &&
      SAG_FRAC === AERIAL_SAG &&
      Math.abs(pts[0][0] - 0) < 1e-9 &&
      Math.abs(pts[16][0] - span) < 1e-9 &&
      Math.abs(sag - SAG_FRAC * span) < 0.02 * span,
    `catenaryPoints IS the aerialways export (identity); endpoints exact; 100 m equal span sags ${sag.toFixed(2)} m ~ ${(SAG_FRAC * 100).toFixed(0)}% - gondolas and grid on one gated law`
  );
}

process.exit(fail ? 1 : 0);
