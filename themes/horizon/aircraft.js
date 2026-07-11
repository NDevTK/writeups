// Aircraft identity: the real airframe dimensions and body class of an
// aircraft from its MEASURED ADS-B ICAO type designator (readsb 't',
// e.g. A320/B789/GLF6), with the DO-260B emitter category as a fallback
// when the type is missing. The aerial twin of ships.js: where that
// turns an AIS M.1371 type + measured length/beam into a vessel
// silhouette, this turns the ICAO type into a real airframe. The
// geometry lives in airframes.js (the aerial vessels.js); this is the
// pure data, held to published dimensions by aircraft-reference.mjs.
//
// Wingspan/length (metres) are the manufacturer type dimensions (ACAPS
// / spec sheets, fetched 2026-07-11), winglet-era spans where a type has
// both (A320 35.8 with sharklets, 737NG 35.79 with winglets).
// Helicopters: wingspan = main-rotor diameter, length = fuselage.

// [wingspanM, lengthM, engines, mount, class, wake]. mount is where the
// engines hang (wing | fuselage/tail | nose prop for GA). class drives
// the airframe arrangement in airframes.js; wake is the ICAO category
// (L light, M medium, H heavy, J super).
export const TYPE_DIMS = {
  // Airbus narrowbody
  A318: [34.1, 31.44, 2, 'wing', 'narrowbody', 'M'],
  A319: [35.8, 33.84, 2, 'wing', 'narrowbody', 'M'],
  A320: [35.8, 37.57, 2, 'wing', 'narrowbody', 'M'],
  A20N: [35.8, 37.57, 2, 'wing', 'narrowbody', 'M'],
  A321: [35.8, 44.51, 2, 'wing', 'narrowbody', 'M'],
  A21N: [35.8, 44.51, 2, 'wing', 'narrowbody', 'M'],
  BCS1: [35.1, 35.0, 2, 'wing', 'narrowbody', 'M'],
  BCS3: [35.1, 38.71, 2, 'wing', 'narrowbody', 'M'],
  // Boeing narrowbody
  B737: [35.79, 33.63, 2, 'wing', 'narrowbody', 'M'],
  B738: [35.79, 39.47, 2, 'wing', 'narrowbody', 'M'],
  B739: [35.79, 42.11, 2, 'wing', 'narrowbody', 'M'],
  B38M: [35.9, 39.52, 2, 'wing', 'narrowbody', 'M'],
  B39M: [35.9, 42.16, 2, 'wing', 'narrowbody', 'M'],
  B752: [38.05, 47.32, 2, 'wing', 'narrowbody', 'M'],
  // Widebody twins
  A332: [60.3, 58.82, 2, 'wing', 'widebody', 'H'],
  A333: [60.3, 63.66, 2, 'wing', 'widebody', 'H'],
  A339: [64.0, 63.66, 2, 'wing', 'widebody', 'H'],
  A359: [64.75, 66.8, 2, 'wing', 'widebody', 'H'],
  A35K: [64.75, 73.79, 2, 'wing', 'widebody', 'H'],
  A306: [44.84, 54.08, 2, 'wing', 'widebody', 'H'],
  A310: [43.9, 46.66, 2, 'wing', 'widebody', 'H'],
  B772: [60.93, 63.73, 2, 'wing', 'widebody', 'H'],
  B773: [60.93, 73.86, 2, 'wing', 'widebody', 'H'],
  B77W: [64.8, 73.86, 2, 'wing', 'widebody', 'H'],
  B788: [60.12, 56.72, 2, 'wing', 'widebody', 'H'],
  B789: [60.12, 62.81, 2, 'wing', 'widebody', 'H'],
  B78X: [60.12, 68.28, 2, 'wing', 'widebody', 'H'],
  // Heavy quads
  B744: [64.44, 70.66, 4, 'wing', 'heavy_quad', 'H'],
  B748: [68.45, 76.25, 4, 'wing', 'heavy_quad', 'H'],
  A388: [79.75, 72.72, 4, 'wing', 'heavy_quad', 'J'],
  // Regional jets
  E170: [26.0, 29.9, 2, 'wing', 'regional_jet', 'M'],
  E75L: [26.0, 31.68, 2, 'wing', 'regional_jet', 'M'],
  E190: [28.72, 36.24, 2, 'wing', 'regional_jet', 'M'],
  E195: [28.72, 38.65, 2, 'wing', 'regional_jet', 'M'],
  E290: [33.72, 36.24, 2, 'wing', 'regional_jet', 'M'],
  E295: [35.12, 41.5, 2, 'wing', 'regional_jet', 'M'],
  CRJ2: [21.21, 26.77, 2, 'fuselage', 'regional_jet', 'M'],
  CRJ7: [23.24, 32.51, 2, 'fuselage', 'regional_jet', 'M'],
  CRJ9: [24.87, 36.4, 2, 'fuselage', 'regional_jet', 'M'],
  // Turboprops
  AT72: [27.05, 27.17, 2, 'wing', 'turboprop', 'M'],
  AT45: [24.57, 22.67, 2, 'wing', 'turboprop', 'M'],
  AT46: [24.57, 22.67, 2, 'wing', 'turboprop', 'M'],
  DH8D: [28.42, 32.84, 2, 'wing', 'turboprop', 'M'],
  // Bizjets (aft-fuselage engines, T-tail)
  GLF6: [30.36, 30.41, 2, 'fuselage', 'bizjet', 'M'],
  GLF5: [28.5, 29.39, 2, 'fuselage', 'bizjet', 'M'],
  C56X: [17.17, 15.79, 2, 'fuselage', 'bizjet', 'M'],
  C68A: [21.99, 18.97, 2, 'fuselage', 'bizjet', 'M'],
  CL60: [19.61, 20.85, 2, 'fuselage', 'bizjet', 'M'],
  E55P: [16.21, 15.64, 2, 'fuselage', 'bizjet', 'M'],
  // GA piston (nose prop)
  C172: [11.0, 8.28, 1, 'fuselage', 'ga_piston', 'L'],
  C152: [10.16, 7.34, 1, 'fuselage', 'ga_piston', 'L'],
  PA28: [10.67, 7.25, 1, 'fuselage', 'ga_piston', 'L'],
  SR22: [11.68, 7.92, 1, 'fuselage', 'ga_piston', 'L'],
  DA40: [11.94, 8.06, 1, 'fuselage', 'ga_piston', 'L'],
  // Helicopters (wingspan = rotor diameter, length = fuselage)
  EC35: [10.2, 10.2, 2, 'fuselage', 'helicopter', 'L'],
  R44: [10.06, 9.07, 1, 'fuselage', 'helicopter', 'L'],
  AS50: [10.69, 10.93, 1, 'fuselage', 'helicopter', 'L'],
  H60: [16.36, 15.26, 2, 'fuselage', 'helicopter', 'M']
};

export const CLASS_ORDER = [
  'ga_piston',
  'helicopter',
  'bizjet',
  'turboprop',
  'regional_jet',
  'narrowbody',
  'widebody',
  'heavy_quad'
];

// Per-class arrangement defaults (engines, mount, wake) used when only
// the class is known (a category fallback), not the exact type.
const CLASS_ARR = {
  ga_piston: [1, 'fuselage', 'L'],
  helicopter: [1, 'fuselage', 'L'],
  bizjet: [2, 'fuselage', 'M'],
  turboprop: [2, 'wing', 'M'],
  regional_jet: [2, 'wing', 'M'],
  narrowbody: [2, 'wing', 'M'],
  widebody: [2, 'wing', 'H'],
  heavy_quad: [4, 'wing', 'H']
};

// DO-260B emitter category -> a representative [class, wingspanM,
// lengthM] when the ICAO type is unknown/missing (Set A weight-based,
// plus a few Set B). A0/B0/C0 = no data (fall through to the default).
export const CATEGORY_FALLBACK = {
  A1: ['ga_piston', 12, 9],
  A2: ['turboprop', 27, 27],
  A3: ['narrowbody', 35, 38],
  A4: ['narrowbody', 38, 47], // 757-class high vortex
  A5: ['widebody', 64, 67],
  A6: ['bizjet', 20, 20], // high performance
  A7: ['helicopter', 11, 11],
  B1: ['ga_piston', 15, 6], // glider
  B4: ['ga_piston', 10, 5], // ultralight
  B6: ['ga_piston', 4, 3] // UAV (small)
};

// Fallback when neither a known type nor a mapped category is present.
const DEFAULT_DIMS = ['narrowbody', 35, 38];

function fromClass(cls, wingspanM, lengthM, src) {
  const [engines, mount, wake] = CLASS_ARR[cls] || CLASS_ARR.narrowbody;
  return {wingspanM, lengthM, engines, mount, cls, wake, src};
}

// The airframe identity for an aircraft: prefer the exact ICAO type,
// else the emitter category, else a narrowbody default. Returns
// {wingspanM, lengthM, engines, mount, cls, wake, src}.
export function aircraftDims(type, cat) {
  const t = String(type || '')
    .toUpperCase()
    .trim();
  if (TYPE_DIMS[t]) {
    const [wingspanM, lengthM, engines, mount, cls, wake] = TYPE_DIMS[t];
    return {wingspanM, lengthM, engines, mount, cls, wake, src: 'type'};
  }
  const c = String(cat || '')
    .toUpperCase()
    .trim();
  if (CATEGORY_FALLBACK[c]) {
    const [cls, w, l] = CATEGORY_FALLBACK[c];
    return fromClass(cls, w, l, 'category');
  }
  const [cls, w, l] = DEFAULT_DIMS;
  return fromClass(cls, w, l, 'default');
}
