// Reference gate for livery.js (node livery-reference.mjs): the
// (category, operator) pair -> the operator's real painted livery,
// held to the documented brand/RAL colours.
//
//  - resolution: pan-national products by category (ICE->DB white+red,
//    Railjet, TGV, EuroNight, lake boats); SBB and DB by the
//    operator+category pair (silver intercity vs red regional vs white
//    ICN/ICE); the Swiss/German regionals by operator; a category
//    default for the unknown operator.
//  - the iconic liveries carry their signature: DB ICE light body +
//    traffic-red cheatline, RhB/Swiss-regional/DB-Regio red bodies, BLS
//    lime-green stripe, SBB intercity silver.
//  - every livery is well-formed: five #rrggbb fields.
import {LIVERIES, liveryFor, liveryKey, normOperator} from './livery.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const HEX = /^#[0-9a-f]{6}$/;
const rgb = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16)
];
const isRed = (h) => {
  const [r, g, b] = rgb(h);
  return r > 150 && r > g + 60 && r > b + 60;
};
const isGreen = (h) => {
  const [r, g, b] = rgb(h);
  return g > 120 && g > r + 40 && g > b + 40;
};
const isLight = (h) => rgb(h).every((c) => c > 180);

{
  // Resolution: category-driven pan-national products, then the
  // operator+category pairs, then operator, then category default.
  const ok =
    liveryKey('ICE', 'DB') === 'db_ice' &&
    liveryKey('ICE', '') === 'db_ice' &&
    liveryKey('RJX', 'OEBB') === 'railjet' &&
    liveryKey('TGV', 'SBB') === 'tgv_lyria' &&
    liveryKey('EN', '') === 'nightjet' &&
    liveryKey('BAT', 'BLS') === 'boat' &&
    liveryKey('IC', 'SBB') === 'sbb_ic' &&
    liveryKey('IC', 'SBB-cff-ffs') === 'sbb_ic' && // brand suffix stripped
    liveryKey('ICN', 'SBB') === 'sbb_icn' &&
    liveryKey('RE', 'SBB') === 'swiss_regional' &&
    liveryKey('RE', 'BLS-bls') === 'bls' &&
    liveryKey('R', 'RhB') === 'rhb' &&
    liveryKey('R', 'BOB') === 'bob' &&
    liveryKey('RB', 'DB') === 'db_regio' &&
    liveryKey('RE', 'ODEG') === 'odeg' &&
    liveryKey('RB', 'NEB') === 'neb' &&
    liveryKey('IC', 'ZZZ') === 'ic_default' && // unknown op, intercity
    liveryKey('RE', 'ZZZ') === 'regional_default' && // unknown op, regional
    liveryKey('ICN', 'ZZZ') === 'sbb_icn' && // ICN is an SBB-only product
    normOperator('SBB-cff-ffs') === 'SBB' &&
    normOperator('BLS-bls') === 'BLS';
  check(
    'livery resolution',
    ok,
    'ICE/RJ/TGV/EN/BAT by category; SBB IC->silver, ICN->icn, RE->red; BLS/RhB/BOB/DB/ODEG/NEB by operator; unknown->category default'
  );
}

{
  // Iconic signatures. DB ICE: light body + red cheatline. The reds
  // (RhB, Swiss regional, DB Regio). BLS lime-green stripe. SBB
  // intercity silver (light, not red).
  const ice = liveryFor('ICE', 'DB');
  const rhb = liveryFor('R', 'RhB');
  const reg = liveryFor('RE', 'SBB');
  const regio = liveryFor('RB', 'DB');
  const bls = liveryFor('RE', 'BLS-bls');
  const sbbIc = liveryFor('IC', 'SBB');
  const ok =
    isLight(ice.body) &&
    isRed(ice.stripe) &&
    isRed(rhb.body) &&
    isRed(reg.body) &&
    isRed(regio.body) &&
    isGreen(bls.stripe) &&
    isLight(sbbIc.body) &&
    !isRed(sbbIc.body);
  check(
    'iconic signatures',
    ok,
    `ICE ${ice.body}+${ice.stripe} (light+red cheatline); RhB ${rhb.body}, SBB-reg ${reg.body}, DB-Regio ${regio.body} red; BLS stripe ${bls.stripe} green; SBB-IC ${sbbIc.body} silver`
  );
}

{
  // The BLS lower-blue and DB-Regio white Fensterband details, and the
  // cache key round-trips through liveryFor.
  const bls = liveryFor('RE', 'BLS-bls');
  const regio = liveryFor('RB', 'DB');
  // BLS silver (~RAL 9006) is a mid grey: near-neutral, not red/green.
  const [br, bg, bb] = rgb(bls.body);
  const blsSilver =
    br > 150 && Math.max(br, bg, bb) - Math.min(br, bg, bb) < 20;
  const ok =
    bls.key === 'bls' &&
    blsSilver && // silver body under the green
    isLight(regio.band) && // white window band
    liveryFor('IC', 'SBB').key === 'sbb_ic';
  check(
    'livery detail + key',
    ok,
    `BLS silver body ${bls.body} + green stripe; DB Regio white Fensterband ${regio.band}; key echoes the family`
  );
}

{
  // Table integrity: every livery has five well-formed #rrggbb fields,
  // and liveryFor always resolves to a real row (never undefined).
  let ok = true;
  let worst = '';
  const fields = ['body', 'band', 'stripe', 'roof', 'cab'];
  for (const [k, lv] of Object.entries(LIVERIES)) {
    for (const f of fields)
      if (!HEX.test(lv[f] || '')) {
        ok = false;
        worst = `${k}.${f}=${lv[f]}`;
      }
  }
  // a spread of operator strings never falls through to undefined
  const probes = [
    ['IC', 'SBB'],
    ['ICN', 'SBB'],
    ['RE', 'BLS-bls'],
    ['R', 'ZB'],
    ['R', 'BOB'],
    ['R', 'WAB'],
    ['R', 'JB'],
    ['R', 'MOB'],
    ['R', 'RhB'],
    ['R', 'MGB'],
    ['ICE', 'DB'],
    ['RB', 'ODEG'],
    ['RB', 'NEB'],
    ['RJX', 'OEBB'],
    ['S', 'unknown-operator'],
    ['', '']
  ];
  for (const [c, o] of probes) {
    const lv = liveryFor(c, o);
    if (!lv || !HEX.test(lv.body) || !LIVERIES[lv.key]) {
      ok = false;
      worst = `${c}/${o}`;
    }
  }
  const n = Object.keys(LIVERIES).length;
  check(
    'table integrity',
    ok && n >= 20,
    ok
      ? `${n} liveries, all five fields valid #rrggbb; ${probes.length} operator probes all resolve`
      : `bad ${worst}`
  );
}

process.exit(fail ? 1 : 0);
