// waterfalls-reference.mjs - the gate for the waterfall layer.
// Landmarks:
//  - parse forms: a measured height keeps the node ("12", "12.5",
//    "12 m" all parse); missing, zero, negative, non-numeric and
//    taller-than-Angel-Falls heights are all SKIPPED - nothing
//    measured, nothing drawn
//  - the width law is the rivers' own gated Leopold & Maddock
//    exponent, re-exported not re-derived: w(ratio)/w(1) =
//    ratio^0.26 exactly, and w(1) is the documented display base
import {B_AT_A_STATION} from './rivers.js';
import {
  FALL_BASE_W_M,
  FALL_H_MAX_M,
  fallWidthM,
  parseWaterfalls
} from './waterfalls.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const node = (id, tags) => ({
  type: 'node',
  id,
  lat: 46.6,
  lon: 8.0,
  tags: {waterway: 'waterfall', ...tags}
});

{
  const falls = parseWaterfalls({
    elements: [
      node(1, {height: '12', name: ' Staubbach '}),
      node(2, {height: '12.5'}),
      node(3, {height: '12 m'}),
      node(4, {}),
      node(5, {height: 'yes'}),
      node(6, {height: '0'}),
      node(7, {height: '-5'}),
      node(8, {height: '1500'}),
      {type: 'way', id: 9, tags: {waterway: 'waterfall', height: '10'}},
      node(10, {waterway: 'stream', height: '10'})
    ]
  });
  check(
    'parse forms',
    falls.length === 3 &&
      falls[0].hM === 12 &&
      falls[0].name === 'Staubbach' &&
      falls[1].hM === 12.5 &&
      falls[2].hM === 12 &&
      FALL_H_MAX_M === 1000,
    `3 of 10 kept: plain, decimal and "12 m" heights parse (name trimmed); missing/yes/0/-5/1500/way/non-waterfall all skipped - nothing measured, nothing drawn`
  );
}

{
  const w1 = fallWidthM(1);
  const w8 = fallWidthM(8);
  check(
    'Leopold width reuse',
    Math.abs(w1 - FALL_BASE_W_M) < 1e-12 &&
      Math.abs(w8 / w1 - Math.pow(8, B_AT_A_STATION)) < 1e-12 &&
      Math.abs(B_AT_A_STATION - 0.26) < 1e-12,
    `w(1) = the ${FALL_BASE_W_M} m display base; w(8)/w(1) = 8^0.26 = ${(w8 / w1).toFixed(3)} exactly - the rivers' own gated exponent, re-exported`
  );
}

process.exit(fail ? 1 : 0);
