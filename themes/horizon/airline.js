/**
 * airline.js - which airline a plane belongs to, and the tail colour
 * that says so. aircraft.js gives an aircraft its real airframe from
 * the ADS-B type; the ADS-B CALLSIGN (readsb 'flight', e.g. DLH441,
 * BAW276, EZY83GH) begins with the 3-letter ICAO airline designator,
 * which names the operator. This turns that code into the carrier's
 * livery - the tail-fin colour a spotter reads at distance (Lufthansa
 * navy, Swiss red, easyJet orange, KLM sky-blue, Emirates red, Qatar
 * maroon, FedEx purple) and, for the few carriers whose fuselage is
 * not white, its body colour. The aerial twin of livery.js (trains):
 * where that paints a train by its operator, this paints a plane's
 * tail by its airline. Pure JS (no renderer import), gated by
 * airline-reference.mjs; airframes.js paints the fin with it.
 *
 * Colours are the real brand/livery tail colours (Wikipedia livery
 * descriptions / brand palettes, fetched 2026-07-11), stored as sRGB
 * hex and returned LINEARISED (the airframe materials work in linear
 * space, like the light-grey default body). ICAO codes are the
 * callsign prefix (DLH, not the IATA LH). Confidence is high on the
 * iconic tails; a handful (Etihad gold, Chair red) are the best
 * published match.
 */

// ICAO airline designator -> {name, tail sRGB hex, fuselage sRGB hex
// only where the real body is not white}.
export const AIRLINE = {
  // European legacy / flag carriers
  DLH: {name: 'Lufthansa', tail: '#05164d'},
  SWR: {name: 'Swiss', tail: '#e30613'},
  AUA: {name: 'Austrian', tail: '#d6002a'},
  BAW: {name: 'British Airways', tail: '#1d4489'},
  AFR: {name: 'Air France', tail: '#002157'},
  KLM: {name: 'KLM', tail: '#00a1de', fuselage: '#a5cdeb'},
  IBE: {name: 'Iberia', tail: '#d40f2d'},
  ITY: {name: 'ITA Airways', tail: '#123b6d', fuselage: '#17457f'},
  SAS: {name: 'SAS', tail: '#003c7e'},
  FIN: {name: 'Finnair', tail: '#0b1560'},
  TAP: {name: 'TAP Air Portugal', tail: '#c8102e'},
  EIN: {name: 'Aer Lingus', tail: '#00843d'},
  LOT: {name: 'LOT Polish', tail: '#11397e'},
  BEL: {name: 'Brussels Airlines', tail: '#00299a'},
  THY: {name: 'Turkish Airlines', tail: '#c90a16'},
  AFL: {name: 'Aeroflot', tail: '#12326e', fuselage: '#9aa0a6'},
  // European low-cost
  RYR: {name: 'Ryanair', tail: '#0a3d91'},
  EZY: {name: 'easyJet', tail: '#ff6600'},
  WZZ: {name: 'Wizz Air', tail: '#c6007e'},
  VLG: {name: 'Vueling', tail: '#ffcc00'},
  EWG: {name: 'Eurowings', tail: '#8f174f'},
  NAX: {name: 'Norwegian', tail: '#c8102e'},
  TRA: {name: 'Transavia', tail: '#4ca22f'},
  EXS: {name: 'Jet2', tail: '#e4002b'},
  // Swiss / regional
  EDW: {name: 'Edelweiss', tail: '#e2001a'},
  OAW: {name: 'Helvetic Airways', tail: '#e30613'},
  CSW: {name: 'Chair Airlines', tail: '#e2001a'},
  // Gulf / global long-haul
  UAE: {name: 'Emirates', tail: '#d71921'},
  QTR: {name: 'Qatar Airways', tail: '#5c0632'},
  ETD: {name: 'Etihad', tail: '#bc9b6a', fuselage: '#ede8dd'},
  SIA: {name: 'Singapore Airlines', tail: '#1a1e5a'},
  CPA: {name: 'Cathay Pacific', tail: '#005d63'},
  QFA: {name: 'Qantas', tail: '#e40000'},
  ANA: {name: 'All Nippon', tail: '#1a3668'},
  JAL: {name: 'Japan Airlines', tail: '#e50012'},
  ACA: {name: 'Air Canada', tail: '#0a0a0a'},
  UAL: {name: 'United', tail: '#0033a0'},
  AAL: {name: 'American', tail: '#c8102e', fuselage: '#c7cacc'},
  DAL: {name: 'Delta', tail: '#072f6b'},
  ELY: {name: 'El Al', tail: '#003399'},
  SVA: {name: 'Saudia', tail: '#004e36'},
  // Cargo (DHL yellow flies under several designators; GEC is
  // Lufthansa Cargo, NOT DHL)
  FDX: {name: 'FedEx', tail: '#4d148c'},
  UPS: {name: 'UPS', tail: '#351c15'},
  CLX: {name: 'Cargolux', tail: '#ce1126'},
  BCS: {name: 'DHL (European Air Transport)', tail: '#ffcc00'},
  DHK: {name: 'DHL Air UK', tail: '#ffcc00'},
  DAE: {name: 'DHL Aero Expreso', tail: '#ffcc00'},
  GEC: {name: 'Lufthansa Cargo', tail: '#05164d', fuselage: '#8a9199'}
};

// sRGB (0-1) -> linear, so the returned colours are right when the
// airframe materials setRGB them into the renderer's linear space.
const s2l = (c) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const hexRGB = (h) => [
  s2l(parseInt(h.slice(1, 3), 16) / 255),
  s2l(parseInt(h.slice(3, 5), 16) / 255),
  s2l(parseInt(h.slice(5, 7), 16) / 255)
];

// The ICAO airline designator from an ADS-B callsign: the leading
// three letters IF followed by a flight number (a digit) - so airline
// callsigns (DLH441, EZY83GH) resolve while aircraft registrations
// (HBPQR, N172SP) and empty callsigns do not.
export function icaoFromCallsign(callsign) {
  const m = String(callsign || '')
    .trim()
    .toUpperCase()
    .match(/^([A-Z]{3})\d/);
  return m ? m[1] : null;
}

// The livery for a callsign: {code, name, tail:[r,g,b], fuselage:[r,g,b]
// or undefined} in LINEAR rgb, or null when the callsign is not an
// airline flight or the airline is not in the table (caller keeps the
// neutral light airframe).
export function liveryForCallsign(callsign) {
  const code = icaoFromCallsign(callsign);
  if (!code) return null;
  const a = AIRLINE[code];
  if (!a) return null;
  return {
    code,
    name: a.name,
    tail: hexRGB(a.tail),
    fuselage: a.fuselage ? hexRGB(a.fuselage) : undefined
  };
}
