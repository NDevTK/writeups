// Reference printer for the solar-wind layer (node
// solarwind-reference.mjs). The aurora's driver becomes a
// measurement taken 1.5 million km upwind, so the gate holds:
//  - the Newell 2007 coupling function to its own closed form:
//    northward IMF EXACTLY zero, the 4/3 and 2/3 exponents by
//    scaling law, clock-angle symmetry, and the storm/quiet ratio
//  - the two SWPC wire parsers against fixtures captured LIVE
//    from the real endpoints (2026-07-07), including a
//    column-shuffled variant (fields are found by name) and
//    null-tailed rows
//  - the HP rebase factor: linear, clamped, neutral on missing
import {
  clockAngle,
  hpScale,
  leadMinutes,
  newellCoupling,
  parseHemiPower,
  parsePropagated
} from './solarwind.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // Newell 2007: dPhi/dt = v^(4/3) B_T^(2/3) sin^(8/3)(theta/2).
  // Independent closed form for pure southward IMF (theta = pi,
  // the sine factor is exactly 1): exp((4/3)ln v + (2/3)ln B).
  const south = newellCoupling(400, 0, -5);
  const closed = Math.exp((4 / 3) * Math.log(400) + (2 / 3) * Math.log(5));
  const north = newellCoupling(400, 0, 5);
  const vLaw = newellCoupling(800, 0, -5) / south; // 2^(4/3)
  const bLaw = newellCoupling(400, 0, -10) / south; // 2^(2/3)
  const byOnly = newellCoupling(400, 5, 0) / south; // sin^(8/3)(pi/4)
  const sym =
    newellCoupling(400, 5, -3) === newellCoupling(400, -5, -3) &&
    clockAngle(0, -1) === Math.PI;
  const storm = newellCoupling(750, 0, -18);
  const quiet = newellCoupling(380, 0, -3);
  check(
    'Newell coupling',
    Math.abs(south - closed) < 1e-9 &&
      north === 0 &&
      Math.abs(vLaw - Math.pow(2, 4 / 3)) < 1e-12 &&
      Math.abs(bLaw - Math.pow(2, 2 / 3)) < 1e-12 &&
      Math.abs(byOnly - Math.pow(Math.SQRT1_2, 8 / 3)) < 1e-12 &&
      sym &&
      storm / quiet > 7 &&
      storm / quiet < 10,
    `south(400,5) = ${south.toFixed(1)} (closed form exact); north EXACTLY 0 (valve closed); 2x v -> x${vLaw.toFixed(4)} = 2^(4/3); 2x B -> x${bLaw.toFixed(4)} = 2^(2/3); By-only = sin^(8/3)(45°); ±By symmetric; storm/quiet ${(storm / quiet).toFixed(1)}x`
  );
}

{
  // SWPC propagated-solar-wind wire format, captured live
  // 2026-07-07: header row + rows; the parser must key columns by
  // NAME (shuffled fixture) and skip null-tailed rows.
  const HEADER = [
    'time_tag',
    'speed',
    'density',
    'temperature',
    'bx',
    'by',
    'bz',
    'bt',
    'vx',
    'vy',
    'vz',
    'propagated_time_tag'
  ];
  const R = (t, v, n, by, bz, bt, p) => [
    t,
    v,
    n,
    144753.0,
    -5.57,
    by,
    bz,
    bt,
    -414.0,
    11.1,
    14.6,
    p
  ];
  const rows = [
    HEADER,
    R(
      '2026-07-07T01:21:00Z',
      414.4,
      2.13,
      3.74,
      1.75,
      6.93,
      '2026-07-07T02:09:44Z'
    ),
    R(
      '2026-07-07T01:25:00Z',
      415.2,
      2.32,
      4.02,
      2.18,
      7.02,
      '2026-07-07T02:13:39Z'
    ),
    R(
      '2026-07-07T01:26:00Z',
      null,
      2.08,
      null,
      null,
      null,
      '2026-07-07T02:14:53Z'
    )
  ];
  const got = parsePropagated(rows);
  // Same data with the columns permuted: name-keyed, not position.
  const perm = [11, 6, 5, 1, 0, 2, 3, 4, 7, 8, 9, 10];
  const shuffled = rows.map((r) => perm.map((i) => r[i]));
  const got2 = parsePropagated(shuffled);
  const lead = leadMinutes(
    got.propagatedTime,
    Date.parse('2026-07-07T01:26:00Z')
  );
  check(
    'SWPC propagated parser',
    got.time === '2026-07-07T01:25:00Z' &&
      got.speed === 415.2 &&
      got.by === 4.02 &&
      got.bz === 2.18 &&
      got.bt === 7.02 &&
      got.density === 2.32 &&
      got.propagatedTime === '2026-07-07T02:13:39Z' &&
      Math.abs(got.coupling - newellCoupling(415.2, 4.02, 2.18)) === 0 &&
      JSON.stringify(got2) === JSON.stringify(got) &&
      Math.abs(lead - 47.65) < 0.01,
    `null-tailed row skipped -> 01:25 sample (v 415.2, By 4.02, Bz +2.18, coupling ${got.coupling.toFixed(0)}); column-shuffled fixture parses identically; lead ${lead.toFixed(1)} min to the bow shock`
  );
}

{
  // OVATION hemispheric-power text format, captured live
  // 2026-07-07: '#' comments then "obs forecast north south".
  const txt = [
    '#Aurora Hemispheric Power Tabular Values',
    '# Cadence:   5 minutes',
    '#---------------------------------------',
    '2026-07-07_00:35    2026-07-07_01:36      18      20',
    '2026-07-07_00:40    2026-07-07_01:41      18      20',
    ''
  ].join('\n');
  const hp = parseHemiPower(txt);
  check(
    'hemispheric power parser',
    hp.obs === '2026-07-07_00:40' &&
      hp.forecast === '2026-07-07_01:41' &&
      hp.north === 18 &&
      hp.south === 20 &&
      parseHemiPower('# only comments\n') === null,
    `latest row -> obs ${hp.obs}, forecast ${hp.forecast}, N ${hp.north} GW / S ${hp.south} GW; comment-only file -> null`
  );
}

{
  // HP rebase: linear in precipitating power, clamped 0.25..4 so a
  // bad sample can never black out or blow out the curtain,
  // neutral when either side is missing.
  check(
    'HP rebase',
    hpScale(20, 20) === 1 &&
      hpScale(40, 20) === 2 &&
      hpScale(1, 20) === 0.25 &&
      hpScale(200, 20) === 4 &&
      hpScale(null, 20) === 1 &&
      hpScale(20, null) === 1 &&
      hpScale(0, 0) === 1,
    `identity at equal power; 2x power -> 2x curtain; clamped [0.25, 4]; missing data -> neutral 1`
  );
}

process.exit(fail ? 1 : 0);
