/**
 * livery.js - the operator's REAL painted colours. trains.js turns a
 * live journey's category + operator into a consist (car count,
 * gauge); this turns that same category + operator into the livery
 * the operator actually paints its stock - the DB ICE white body with
 * its traffic-red cheatline, the Swiss-regional and RhB reds, the BLS
 * silver-and-lime, the SBB intercity silver. Pure JS (no renderer
 * import), gated by livery-reference.mjs; rollingstock.js turns a
 * livery into the carbody / cheatline-stripe / window-band / roof /
 * cab materials.
 *
 * Each livery is {body, band, stripe, roof, cab} as #rrggbb: body =
 * carbody; stripe = the signature cheatline (solid liveries set it to
 * the body so it reads as one colour); band = the window strip (dark
 * glazing, or a famous light Fensterband like DB Regio's); roof; cab =
 * the dark cab/end face. Colours are what reads from a distance,
 * anchored to brand/RAL specs where published and flagged where not:
 *
 *  - SBB brand red #EB0000 (SBB digital design system, digital.sbb.ch)
 *  - DB Verkehrsrot RAL 3020 #C1121C, Lichtgrau RAL 7035 (Wikipedia
 *    Verkehrsrot / Intercity-Express)
 *  - Swiss regional flame red ~RAL 3000; BLS RAL 9006 + NCS-green
 *    "BLS-Farben" spec (de.wikipedia); OEBB brand #E2002A
 *  - RhB/MGB reds, MOB golds, BOB/WAB/JB/ZB Jungfrau-region colours are
 *    named-but-unpublished: the hex are close conversions/estimates and
 *    are marked LOW/MED confidence inline. For SBB and DB the CATEGORY,
 *    not the operator, picks the livery (grey intercity vs red regional
 *    vs white ICN/ICE) - liveryFor keys on the (operator, category) pair.
 */

// key -> {body, band, stripe, roof, cab}. band is the window strip;
// stripe the cheatline. Confidence noted where the hex is estimated.
export const LIVERIES = {
  // SBB intercity coaches: silver-grey (~RAL 7035) body, red doors, the
  // Re460 all-red loco; brand red #EB0000. (high)
  sbb_ic: {
    body: '#c6c9cb',
    band: '#2c3136',
    stripe: '#eb0000',
    roof: '#9a9da0',
    cab: '#2c3136'
  },
  // SBB ICN (RABe 500 tilting): silver body, slim red waistline + nose. (med-high)
  sbb_icn: {
    body: '#d2d5d7',
    band: '#2c3136',
    stripe: '#eb0000',
    roof: '#8a8d90',
    cab: '#b01018'
  },
  // Swiss regional (NPZ/Domino): flame red ~RAL 3000. (high)
  swiss_regional: {
    body: '#a72920',
    band: '#20181a',
    stripe: '#a72920',
    roof: '#7a7c7e',
    cab: '#20181a'
  },
  // DB ICE: Lichtgrau body, Verkehrsrot RAL 3020 cheatline. (high)
  db_ice: {
    body: '#d0d2ce',
    band: '#2c3136',
    stripe: '#c1121c',
    roof: '#b4b6b3',
    cab: '#2c3136'
  },
  // DB Regio / DB IC: Verkehrsrot body, white Fensterband. (high)
  db_regio: {
    body: '#c1121c',
    band: '#f2f2f2',
    stripe: '#c1121c',
    roof: '#8c8c8c',
    cab: '#7a0f16'
  },
  // ODEG: yellow-green body, yellow accents. Body-green estimated. (med)
  odeg: {
    body: '#93c020',
    band: '#2c3136',
    stripe: '#f6a800',
    roof: '#5a5a5a',
    cab: '#2c3136'
  },
  // NEB: dark blue + yellow doors (Wikipedia NEB). Hex estimated. (med)
  neb: {
    body: '#10284b',
    band: '#2a2e38',
    stripe: '#ffd100',
    roof: '#d5d5d5',
    cab: '#0c1e39'
  },
  // BLS: white-aluminium (RAL 9006) + lime green + blue lower stripe. (med-high)
  bls: {
    body: '#a9abae',
    band: '#2c3136',
    stripe: '#64a70b',
    roof: '#6e6e6e',
    cab: '#003c71'
  },
  // RhB: iconic all-red "RhB-rot" (no published hex). (med)
  rhb: {
    body: '#c8102e',
    band: '#231518',
    stripe: '#c8102e',
    roof: '#6e6e6e',
    cab: '#231518'
  },
  // MOB GoldenPass: white upper, gold lower. (med)
  mob: {
    body: '#f4f4f2',
    band: '#2c3136',
    stripe: '#c6a24a',
    roof: '#8a8d90',
    cab: '#10357f'
  },
  // Zentralbahn ZB (FINK): white body, anthracite band, light-blue accent. (low-med)
  zb: {
    body: '#edeeef',
    band: '#3c3c3b',
    stripe: '#4fc3e8',
    roof: '#5a5a5a',
    cab: '#3c3c3b'
  },
  // BOB: striking blue/yellow. (med)
  bob: {
    body: '#1b3a8b',
    band: '#2a2e38',
    stripe: '#f6c200',
    roof: '#6e6e6e',
    cab: '#12285f'
  },
  // WAB: green + yellow. (low-med)
  wab: {
    body: '#1f6b3a',
    band: '#232a20',
    stripe: '#f6c200',
    roof: '#6e6e6e',
    cab: '#164529'
  },
  // JB Jungfraubahn: dark green/cream tradition. (low)
  jb: {
    body: '#14532c',
    band: '#182619',
    stripe: '#efe6c8',
    roof: '#5a5a5a',
    cab: '#0e3a1e'
  },
  // SPB Schynige Platte: heritage green railcars. (low)
  spb: {
    body: '#14532c',
    band: '#182619',
    stripe: '#14532c',
    roof: '#3e3e3e',
    cab: '#0e3a1e'
  },
  // BLM Lauterbrunnen-Mürren: cream/light heritage cars, blue accent. (low)
  blm: {
    body: '#e9e7df',
    band: '#2c3136',
    stripe: '#1b3a8b',
    roof: '#6e6e6e',
    cab: '#2c3136'
  },
  // MGB Matterhorn Gotthard: red + white band (Glacier Express red). (med)
  mgb: {
    body: '#c8102e',
    band: '#231518',
    stripe: '#ffffff',
    roof: '#6e6e6e',
    cab: '#7a0f16'
  },
  // TGV Lyria: SNCF silver-grey base, Swiss-red accents. (med-high)
  tgv_lyria: {
    body: '#c7cacc',
    band: '#2c3136',
    stripe: '#e30613',
    roof: '#8a8d90',
    cab: '#2c3136'
  },
  // Railjet (OEBB): burgundy upper + grey lower + red stripe. Body est. (med)
  railjet: {
    body: '#7a1f2b',
    band: '#2c3136',
    stripe: '#e2002a',
    roof: '#8a8d90',
    cab: '#6e6e6e'
  },
  // Nightjet / EuroNight (OEBB): dark blue, red accent. (low-med)
  nightjet: {
    body: '#14284b',
    band: '#20242e',
    stripe: '#e2002a',
    roof: '#6e6e6e',
    cab: '#0e1c38'
  },
  // Generic fallbacks for an unknown operator.
  ic_default: {
    body: '#cfd2d4',
    band: '#33383d',
    stripe: '#cfd2d4',
    roof: '#8a8d90',
    cab: '#2c3136'
  },
  regional_default: {
    body: '#b0202e',
    band: '#20181a',
    stripe: '#b0202e',
    roof: '#7a7c7e',
    cab: '#20181a'
  },
  // Swiss lake motorship (BAT boats normally route to vessels.js; here
  // so liveryFor never returns undefined).
  boat: {
    body: '#f4f4f2',
    band: '#2c3136',
    stripe: '#103c6e',
    roof: '#c9a24a',
    cab: '#333333'
  }
};

// Category families for the operator-agnostic default.
const INTERCITY_CATS = new Set(['IC', 'EC', 'IR', 'ICN']);
const REGIONAL_CATS = new Set([
  'RE',
  'R',
  'S',
  'SN',
  'PE',
  'ARZ',
  'EXT',
  'FUN',
  'T'
]);

// The board/radar operator string ('SBB-cff-ffs', 'BLS-bls') carries
// the trilingual/brand suffix - the code is the first token.
export function normOperator(op) {
  return String(op || '')
    .split('-')[0]
    .trim()
    .toUpperCase();
}

// The livery family key for a (category, operator) pair. Pan-national
// products (ICE, Railjet, TGV, EuroNight, lake boats) are picked by
// CATEGORY regardless of operator; SBB and DB are picked by the
// operator+category pair (grey intercity vs red regional vs white
// ICN/ICE); everything else by operator, then a category default.
export function liveryKey(cat, operator) {
  const c = String(cat || '').toUpperCase();
  const op = normOperator(operator);
  if (c === 'ICE') return 'db_ice';
  if (c === 'RJ' || c === 'RJX') return 'railjet';
  if (c === 'TGV') return 'tgv_lyria';
  if (c === 'EN') return 'nightjet';
  if (c === 'BAT') return 'boat';
  switch (op) {
    case 'SBB':
      return c === 'ICN'
        ? 'sbb_icn'
        : INTERCITY_CATS.has(c)
          ? 'sbb_ic'
          : 'swiss_regional';
    case 'BLS':
      return 'bls';
    case 'RHB':
      return 'rhb';
    case 'ZB':
      return 'zb';
    case 'BOB':
      return 'bob';
    case 'WAB':
      return 'wab';
    case 'JB':
      return 'jb';
    case 'SPB':
      return 'spb';
    case 'BLM':
      return 'blm';
    case 'MOB':
      return 'mob';
    case 'MGB':
      return 'mgb';
    case 'DB':
      return 'db_regio'; // DB non-ICE: red IC/Regio stock
    case 'ODEG':
      return 'odeg';
    case 'NEB':
      return 'neb';
  }
  if (c === 'ICN') return 'sbb_icn';
  if (INTERCITY_CATS.has(c)) return 'ic_default';
  if (REGIONAL_CATS.has(c)) return 'regional_default';
  return 'ic_default';
}

// The livery for a journey: {key, body, band, stripe, roof, cab}. The
// key doubles as the caller's material-cache key.
export function liveryFor(cat, operator) {
  const key = liveryKey(cat, operator);
  return {key, ...LIVERIES[key]};
}
