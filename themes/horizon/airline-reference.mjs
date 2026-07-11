// Reference gate for airline.js (node airline-reference.mjs): the
// ADS-B callsign -> ICAO airline designator -> the carrier's tail
// livery, held to the real brand colours.
//
//  - the callsign parse matches REAL data: an airline callsign (3
//    letters + flight number) resolves; an aircraft registration
//    (HBPQR, N172SP) and an empty callsign do not.
//  - the iconic tails are right: Swiss/Emirates red, Lufthansa navy,
//    easyJet orange, KLM sky-blue, FedEx purple, Qatar maroon - and
//    the corrections hold (Cargolux red, GEC = Lufthansa Cargo).
//  - fuselage is set only for the real non-white exceptions.
//  - every row is well-formed: a valid ICAO code and a linear rgb tail.
import {AIRLINE, icaoFromCallsign, liveryForCallsign} from './airline.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const rDom = (c) => c[0] > c[1] && c[0] > c[2]; // red-dominant
const bDom = (c) => c[2] > c[0] && c[2] >= c[1]; // blue/navy-dominant
const triple = (c) =>
  Array.isArray(c) && c.length === 3 && c.every((v) => v >= 0 && v <= 1);

{
  // Callsign -> ICAO designator against the real value forms.
  const ok =
    icaoFromCallsign('DLH441') === 'DLH' &&
    icaoFromCallsign('SWR12') === 'SWR' &&
    icaoFromCallsign('EZY83GH') === 'EZY' && // trailing letters in flight no.
    icaoFromCallsign('RYR4KL') === 'RYR' &&
    icaoFromCallsign('klm56a') === 'KLM' && // case-insensitive
    icaoFromCallsign('  BAW276 ') === 'BAW' && // trimmed
    icaoFromCallsign('HBPQR') === null && // registration, not airline
    icaoFromCallsign('N172SP') === null && // N-reg
    icaoFromCallsign('BAW') === null && // no flight number
    icaoFromCallsign('') === null &&
    icaoFromCallsign(undefined) === null;
  check(
    'callsign -> ICAO',
    ok,
    'DLH441->DLH, EZY83GH->EZY, klm56a->KLM (case/trim); registrations HBPQR/N172SP and bare codes -> null'
  );
}

{
  // The iconic tails (linear rgb). Reds, navies, the orange, the
  // sky-blue, the purple, the maroon - each carries its signature.
  const swiss = liveryForCallsign('SWR12');
  const lh = liveryForCallsign('DLH441');
  const ezy = liveryForCallsign('EZY83GH');
  const klm = liveryForCallsign('KLM56A');
  const fdx = liveryForCallsign('FDX1234');
  const qtr = liveryForCallsign('QTR8');
  const ok =
    swiss.code === 'SWR' &&
    rDom(swiss.tail) && // Swiss red
    bDom(lh.tail) && // Lufthansa navy
    ezy.tail[0] > ezy.tail[1] &&
    ezy.tail[1] > ezy.tail[2] && // easyJet orange (r>g>b)
    klm.tail[2] > klm.tail[0] && // KLM sky-blue (blue leads)
    fdx.tail[2] > fdx.tail[1] &&
    fdx.tail[0] > fdx.tail[1] && // FedEx purple (r&b over g)
    qtr.tail[0] > qtr.tail[1] &&
    qtr.tail[0] > qtr.tail[2] && // Qatar maroon (dark red)
    qtr.tail[0] < 0.4; // ...and dark
  check(
    'iconic tails',
    ok,
    `Swiss red, Lufthansa navy, easyJet orange, KLM sky-blue, FedEx purple, Qatar maroon`
  );
}

{
  // The research corrections + fuselage exceptions. Cargolux is red
  // (not blue); GEC is Lufthansa Cargo (navy) not DHL yellow; DHL
  // designators are yellow. Fuselage set only where the body is not
  // white (KLM, ITA, Aeroflot, American, Etihad, Lufthansa Cargo).
  const clx = liveryForCallsign('CLX789');
  const gec = liveryForCallsign('GEC8260');
  const bcs = liveryForCallsign('BCS123'); // DHL yellow
  const klm = liveryForCallsign('KLM56A');
  const ana = liveryForCallsign('ANA7'); // white body -> no fuselage
  const ok =
    rDom(clx.tail) && // Cargolux red, corrected
    bDom(gec.tail) &&
    gec.name.includes('Cargo') && // GEC = Lufthansa Cargo
    bcs.tail[0] > 0.5 &&
    bcs.tail[1] > 0.4 &&
    bcs.tail[2] < 0.2 && // DHL yellow
    triple(klm.fuselage) && // KLM pale-blue body
    klm.fuselage[2] > klm.fuselage[0] &&
    ana.fuselage === undefined; // ANA white body
  check(
    'corrections + fuselage',
    ok,
    'Cargolux red, GEC = Lufthansa Cargo, DHL (BCS) yellow; fuselage only for the non-white bodies (KLM set, ANA not)'
  );
}

{
  // Unknown airline (valid callsign form, absent from the table) and a
  // registration both yield no livery, so the caller stays neutral.
  const ok =
    liveryForCallsign('XYZ12') === null &&
    liveryForCallsign('ZZZ9') === null &&
    liveryForCallsign('HBABC') === null;
  check(
    'unknown -> null',
    ok,
    'an untabled airline code and a registration both return null (neutral airframe kept)'
  );
}

{
  // Table integrity: every code is three uppercase letters and every
  // tail (and any fuselage) is a valid linear rgb triple.
  let ok = true;
  let worst = '';
  const HEX = /^#[0-9a-f]{6}$/i;
  for (const [code, a] of Object.entries(AIRLINE)) {
    const lv = liveryForCallsign(code + '1');
    if (
      !/^[A-Z]{3}$/.test(code) ||
      !HEX.test(a.tail) ||
      !triple(lv.tail) ||
      (a.fuselage && !triple(lv.fuselage))
    ) {
      ok = false;
      worst = code;
    }
  }
  const n = Object.keys(AIRLINE).length;
  check(
    'table integrity',
    ok && n >= 40,
    ok
      ? `${n} airlines, all codes 3-letter, tails valid linear rgb`
      : `bad ${worst}`
  );
}

process.exit(fail ? 1 : 0);
