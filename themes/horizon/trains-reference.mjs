// Reference gate for trains.js (node trains-reference.mjs):
//  - the consist ladder: cars by category, dimensions by the
//    operator's gauge (narrow ops run shorter, narrower stock)
//  - the LIVE Interlaken Ost station board parses with its
//    metadata - categories, operators, numbered trains
//  - interpolation EXACT: dwelling at a stop, the linear fraction
//    between the bracketing stops, null outside the journey
//  - the real-time layer: delay minutes shift the stop times
//    exactly; road/water modes never become trains
import {
  BOAT_CATS,
  BOAT_DIMS,
  CAR_NARROW,
  CAR_STD,
  CONSIST_CARS,
  consistOf,
  DEFAULT_CARS,
  parseBoard,
  providerFor,
  trainAt
} from './trains.js';
import {BOARD_FIXTURE, BOAT_FIXTURE} from './trains-fixture.mjs';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // The consist ladder: category picks the car count, the
  // operator's gauge picks the stock dimensions.
  const ic = consistOf('IC', 'SBB');
  const bob = consistOf('R', 'BOB');
  const bls = consistOf('RE', 'BLS-bls'); // operator string as published
  const unk = consistOf('XX', 'SBB');
  const ok =
    ic.cars === CONSIST_CARS.IC &&
    ic.len === CAR_STD.len &&
    !ic.narrow &&
    bob.cars === CONSIST_CARS.R &&
    bob.len === CAR_NARROW.len &&
    bob.w === CAR_NARROW.w &&
    bob.narrow &&
    bls.cars === CONSIST_CARS.RE &&
    !bls.narrow &&
    unk.cars === DEFAULT_CARS;
  check(
    'consist ladder',
    ok,
    `cars by category (IC ${CONSIST_CARS.IC}, RE ${CONSIST_CARS.RE}, R ${CONSIST_CARS.R}, default ${DEFAULT_CARS}); the BOB runs ${CAR_NARROW.len} x ${CAR_NARROW.w} m narrow stock, the standard net ${CAR_STD.len} x ${CAR_STD.w} m`
  );
}

const journeys = parseBoard(BOARD_FIXTURE);

{
  // The LIVE board: 14 real departures parse with their metadata -
  // the BOB regionals, SBB InterCitys, the ICE, the ZB Panorama
  // Express - every journey with two placed, timed stops.
  const cats = new Set(journeys.map((j) => j.cat));
  const ops = new Set(journeys.map((j) => j.operator));
  const ok =
    journeys.length >= 12 &&
    cats.has('IC') &&
    cats.has('R') &&
    cats.has('PE') &&
    ops.has('SBB') &&
    ops.has('BOB') &&
    journeys.every((j) => j.stops.length >= 2) &&
    journeys.every((j) =>
      j.stops.every(
        (s) =>
          Number.isFinite(s.lat) &&
          Number.isFinite(s.lon) &&
          Number.isFinite(s.depMs)
      )
    ) &&
    journeys.every((j) => j.consist.cars >= 1) &&
    journeys.some((j) => j.consist.narrow) &&
    journeys.some((j) => !j.consist.narrow);
  check(
    'live Interlaken Ost board',
    ok,
    `${journeys.length} departures (${[...cats].join('/')}) by ${[...ops].join(', ')} - every stop placed and timed, narrow and standard consists both present`
  );
}

{
  // Interpolation exactness on a synthetic three-stop journey.
  const j = {
    stops: [
      {lat: 0, lon: 7, name: 'A', arrMs: 1000, depMs: 1000},
      {lat: 1, lon: 8, name: 'B', arrMs: 2000, depMs: 2400},
      {lat: 1, lon: 9, name: 'C', arrMs: 3000, depMs: 3000}
    ]
  };
  const mid1 = trainAt(j, 1500); // half of leg 1
  const dwell = trainAt(j, 2200); // sitting at B
  const mid2 = trainAt(j, 2700); // half of leg 2
  const ok =
    trainAt(j, 999) === null &&
    trainAt(j, 3001) === null &&
    mid1.lat === 0.5 &&
    mid1.lon === 7.5 &&
    mid1.moving === true &&
    dwell.lat === 1 &&
    dwell.lon === 8 &&
    dwell.moving === false &&
    dwell.at === 'B' &&
    mid2.lat === 1 &&
    mid2.lon === 8.5 &&
    mid2.hdgTo.lon === 9;
  check(
    'timetable interpolation',
    ok,
    'null before departure/after arrival; exactly at B while dwelling; exact linear fractions on both legs with the leg heading'
  );
}

{
  // The real-time layer: a 5-minute delay shifts every affected
  // stop time by exactly 300000 ms; a bus on the same board never
  // becomes a train.
  const mk = (delay) => ({
    stationboard: [
      {
        category: 'R',
        number: '70',
        operator: 'ZB',
        to: 'Meiringen',
        passList: [
          {
            station: {name: 'A', coordinate: {x: 46.7, y: 7.9}},
            arrival: null,
            departure: '2026-07-10T06:00:00+0200',
            delay
          },
          {
            station: {name: 'B', coordinate: {x: 46.8, y: 8.0}},
            arrival: '2026-07-10T06:10:00+0200',
            departure: '2026-07-10T06:11:00+0200',
            delay
          }
        ]
      },
      {
        category: 'B',
        number: '104',
        operator: 'PAG',
        to: 'Beatenberg',
        passList: [
          {
            station: {name: 'A', coordinate: {x: 46.7, y: 7.9}},
            arrival: null,
            departure: '2026-07-10T06:00:00+0200',
            delay: 0
          },
          {
            station: {name: 'B', coordinate: {x: 46.75, y: 7.95}},
            arrival: '2026-07-10T06:20:00+0200',
            departure: null,
            delay: 0
          }
        ]
      }
    ]
  });
  const on = parseBoard(mk(0));
  const late = parseBoard(mk(5));
  const ok =
    on.length === 1 &&
    late.length === 1 &&
    on[0].cat === 'R' &&
    late[0].stops[0].depMs - on[0].stops[0].depMs === 5 * 60000 &&
    late[0].stops[1].arrMs - on[0].stops[1].arrMs === 5 * 60000;
  check(
    'delay and mode filter',
    ok,
    'a 5-minute delay shifts the stop times by exactly 300000 ms; the bus on the same board is filtered (boats parse separately via BOAT_CATS)'
  );
}

{
  // The LIVE pier board: the BLS Brienzersee sailings parse as
  // BOATS (category BAT, the piers placed and timed) through the
  // SAME parser and interpolation the trains use - and the rail
  // parse of the same board yields nothing (one board, two modes,
  // no cross-talk). Where AIS misses the lake steamers, the
  // timetable still knows them.
  const boats = parseBoard(BOAT_FIXTURE, BOAT_CATS);
  const rail = parseBoard(BOAT_FIXTURE);
  const ok =
    boats.length >= 4 &&
    boats.every((b) => b.cat === 'BAT' && b.operator === 'BLS-brs') &&
    boats.every((b) => b.stops.length >= 4) &&
    boats.every((b) =>
      b.stops.every((s) => Number.isFinite(s.lat) && Number.isFinite(s.depMs))
    ) &&
    rail.length === 0 &&
    BOAT_DIMS.len > 20 &&
    BOAT_DIMS.beam > 4;
  check(
    'live pier board (boats)',
    ok,
    `${boats.length} BLS-brs sailings with placed piers via parseBoard(.., BOAT_CATS); the rail parse of the pier board yields 0 - one parser, two modes`
  );
}

{
  // Scope: location-specific APIs are only called inside their
  // coverage - Interlaken and border Basel resolve the Swiss
  // provider, Paris and New York resolve NONE (no idle traffic).
  const ch = providerFor(46.69, 7.87);
  const basel = providerFor(47.55, 7.59);
  const ok =
    ch &&
    ch.name === 'transport.opendata.ch' &&
    basel === ch &&
    providerFor(48.85, 2.35) === null &&
    providerFor(40.71, -74.0) === null &&
    ch.boardURL('8507492').includes('stationboard') &&
    ch.locationsURL(46.69, 7.87).includes('locations');
  check(
    'provider scope',
    ok,
    'Interlaken and Basel resolve the Swiss provider; Paris and New York resolve none - outside a scope the API is never called'
  );
}

process.exit(fail ? 1 : 0);
