/**
 * trains.js - real trains on the real timetable. The railways
 * (rails.js) gave the towns their lines; the Swiss open transport
 * API (transport.opendata.ch - keyless, CORS-open) gives the
 * lines their TRAFFIC: station boards with each departure's
 * category (IC/ICE/RE/R/PE), number, operator (SBB, BLS, ZB,
 * BOB), real-time delay, and the passList of stops it calls at -
 * WGS84 coordinates with arrival/departure timestamps. Pure JS,
 * gated:
 *  - parseBoard: departures -> journeys; stops without coordinates
 *    or times dropped; per-stop delay minutes applied to the
 *    published times (the real-time layer); the category set
 *    picks the MODE - rail by default, BOAT_CATS parses the lake
 *    sailings from the pier boards (buses stay filtered).
 *  - trainAt: WHERE IS IT NOW - dwelling at a stop between its
 *    arrival and departure, else linearly between the two stops
 *    that bracket now (the timetable's own fixes - the same
 *    dead-reckoning honesty as the AIS ships), null before the
 *    first departure or after the last arrival.
 *  - consistOf: the metadata -> a documented consist: car count
 *    by category (the API does not publish formations), car
 *    dimensions by the operator's gauge - the narrow-gauge
 *    operators (BOB, ZB, WAB...) run ~18 x 2.65 m stock, the
 *    standard network ~25 x 2.85 m.
 * Coverage is the provider's: PROVIDERS registers each regional
 * API with its coverage bbox, and providerFor answers which one
 * (if any) speaks for a point - location-specific APIs are only
 * ever CALLED while the view is inside their scope, so the
 * registry can grow without idle traffic. Where no provider
 * covers, no trains are invented.
 */

// The provider registry: each entry owns a coverage bbox
// [latMin, lonMin, latMax, lonMax] and builds its own request
// URLs. Only the provider whose scope contains the anchor is
// ever called. First entry: the Swiss open transport API
// (transport.opendata.ch - keyless, CORS-open), whose network is
// Switzerland plus its border stations.
export const PROVIDERS = [
  {
    name: 'transport.opendata.ch',
    kind: 'board',
    bbox: [45.6, 5.8, 47.95, 10.7],
    locationsURL: (lat, lon) =>
      'https://transport.opendata.ch/v1/locations?type=station&x=' +
      lat.toFixed(5) +
      '&y=' +
      lon.toFixed(5),
    boardURL: (id) =>
      'https://transport.opendata.ch/v1/stationboard?limit=10&id=' +
      encodeURIComponent(id)
  },
  {
    // Berlin-Brandenburg: the VBB HAFAS radar
    // (v6.vbb.transport.rest - keyless, CORS-open) reports every
    // vehicle MOVING inside a box: its live position plus the
    // line's real metadata (name, product, operator) and the
    // realtime-adjusted stopovers trainAt interpolates - actual
    // vehicle TRACKING, not just a board. The DB instance of the
    // same family stays unregistered: it answered 503 on every
    // probe (2026-07-10).
    name: 'v6.vbb.transport.rest',
    kind: 'radar',
    bbox: [51.3, 11.2, 53.7, 14.9],
    radarURL: (lat, lon) => {
      const d = 0.075; // ~8 km - the visible box
      return (
        'https://v6.vbb.transport.rest/radar?north=' +
        (lat + d).toFixed(4) +
        '&west=' +
        (lon - d).toFixed(4) +
        '&south=' +
        (lat - d).toFixed(4) +
        '&east=' +
        (lon + d).toFixed(4) +
        '&results=120&duration=600&frames=0&polylines=false'
      );
    }
  },
  {
    // The worldwide fallback: transitous.org aggregates public
    // GTFS feeds globally (keyless, CORS-open). Its scope IS the
    // world; national boards richer in metadata stay ahead of it
    // in this registry. ONE box query around the view, a short
    // window, real route shapes included.
    name: 'transitous.org',
    kind: 'trips',
    bbox: [-90, -180, 90, 180],
    tripsURL: (lat, lon, nowMs) => {
      const d = 0.075; // ~8 km - the visible box
      const iso = (t) => new Date(t).toISOString().slice(0, 19) + 'Z';
      return (
        'https://api.transitous.org/api/v6/map/trips?zoom=11&precision=5' +
        '&max=' +
        (lat + d).toFixed(4) +
        ',' +
        (lon - d).toFixed(4) +
        '&min=' +
        (lat - d).toFixed(4) +
        ',' +
        (lon + d).toFixed(4) +
        '&startTime=' +
        iso(nowMs) +
        '&endTime=' +
        iso(nowMs + 15 * 60000)
      );
    }
  }
];

export function providerFor(lat, lon) {
  for (const p of PROVIDERS) {
    const [a0, o0, a1, o1] = p.bbox;
    if (lat >= a0 && lat <= a1 && lon >= o0 && lon <= o1) return p;
  }
  return null;
}

// Rail categories the boards publish (road/water filtered out).
export const RAIL_CATS = new Set([
  'IC',
  'ICE',
  'ICN',
  'EC',
  'EN',
  'IR',
  'RE',
  'R',
  'S',
  'SN',
  'PE',
  'RJ',
  'RJX',
  'TGV',
  'ARZ',
  'EXT',
  'FUN',
  'T'
]);

// Cars per category - typical Swiss formations, documented
// defaults where the API publishes none.
export const CONSIST_CARS = {
  ICE: 8,
  IC: 8,
  ICN: 7,
  EC: 8,
  EN: 8,
  RJ: 8,
  RJX: 8,
  TGV: 8,
  IR: 6,
  RE: 5,
  PE: 5,
  ARZ: 5,
  EXT: 5,
  R: 4,
  S: 4,
  SN: 4,
  T: 2,
  FUN: 1
};
export const DEFAULT_CARS = 3;

// The scheduled BOATS on the same boards (category BAT at the
// pier stations): where AIS coverage misses the lake steamers,
// the timetable still knows them. Dimensions are the documented
// default for the BLS lake motorships (boards publish no vessel
// size); rendering reuses the gated vessels.js passenger hull.
export const BOAT_CATS = new Set(['BAT']);
export const BOAT_DIMS = {len: 48, beam: 9};

// GTFS modes (the transitous aggregator) -> board categories, so
// ONE consist ladder and ONE livery family serve both provider
// kinds. Underground modes are deliberately absent: drawing a
// metro on the surface would be inventing. FERRY routes to the
// boats path.
export const MODE_CAT = {
  HIGHSPEED_RAIL: 'ICE',
  LONG_DISTANCE: 'IC',
  NIGHT_RAIL: 'EN',
  REGIONAL_FAST_RAIL: 'RE',
  REGIONAL_RAIL: 'R',
  SUBURBAN: 'S',
  TRAM: 'T',
  FERRY: 'BAT'
};

// HAFAS products (the radar providers) -> board categories, the
// same single consist ladder. Underground stays absent for the
// same reason as in MODE_CAT - drawing a metro on the surface
// would be inventing; buses are road traffic, not consists.
export const PRODUCT_CAT = {
  express: 'IC',
  regional: 'RE',
  suburban: 'S',
  tram: 'T',
  ferry: 'BAT'
};

/**
 * A HAFAS radar frame -> the SAME journey shape as the boards.
 * Each movement carries its line's real metadata and its
 * remaining stopovers; the arrival/departure fields are already
 * realtime-adjusted upstream (plannedArrival keeps the schedule),
 * so trainAt's interpolation IS the delay-shifted one. The
 * movement's own live fix rides along untouched (`fix`) - the
 * gate holds the interpolation against it. The line's published
 * productName (S, RE, ICE...) picks the consist when the ladder
 * knows it; the product class decides otherwise.
 */
export function parseRadar(json) {
  const out = [];
  for (const m of (json && json.movements) || []) {
    const line = m.line || {};
    const cat0 = PRODUCT_CAT[line.product];
    if (!cat0) continue;
    const pn = String(line.productName || '').toUpperCase();
    const cat = CONSIST_CARS[pn] != null || BOAT_CATS.has(pn) ? pn : cat0;
    const stops = [];
    for (const p of m.nextStopovers || []) {
      const loc = (p.stop && p.stop.location) || {};
      if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude))
        continue;
      const arr = ms(p.arrival || p.plannedArrival);
      const dep = ms(p.departure || p.plannedDeparture);
      if (!Number.isFinite(arr) && !Number.isFinite(dep)) continue;
      stops.push({
        lat: loc.latitude,
        lon: loc.longitude,
        name: (p.stop && p.stop.name) || '',
        arrMs: Number.isFinite(arr) ? arr : dep,
        depMs: Number.isFinite(dep) ? dep : arr
      });
    }
    if (stops.length < 2) continue;
    const loc = m.location || {};
    out.push({
      cat,
      number: '',
      operator: (line.operator && line.operator.name) || '',
      to: m.direction || '',
      label: line.name || cat,
      consist: consistOf(cat, ''),
      stops,
      fix: Number.isFinite(loc.latitude)
        ? {lat: loc.latitude, lon: loc.longitude}
        : null
    });
  }
  return out;
}

// Standard encoded-polyline decoder (the Google algorithm the
// GTFS world shares; transitous emits precision 5). Gated against
// the canonical documented example.
export function decodePolyline(str, precision = 5) {
  const f = 10 ** precision;
  const out = [];
  let lat = 0;
  let lon = 0;
  for (let i = 0; i < str.length; ) {
    for (const which of [0, 1]) {
      let shift = 0;
      let result = 0;
      let b;
      do {
        b = str.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += d;
      else lon += d;
    }
    out.push([lat / f, lon / f]);
  }
  return out;
}

// A point at LENGTH fraction f along a geodetic path (the real
// route shape) - by cumulative arc length, not by vertex count.
export function pathPoint(path, f) {
  const mLat = 111320;
  const segLen = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const dx =
      (path[i][1] - path[i - 1][1]) *
      mLat *
      Math.cos((path[i - 1][0] * Math.PI) / 180);
    const dy = (path[i][0] - path[i - 1][0]) * mLat;
    const l = Math.hypot(dx, dy);
    segLen.push(l);
    total += l;
  }
  if (!total) return {lat: path[0][0], lon: path[0][1], hdgTo: null};
  let want = Math.max(0, Math.min(1, f)) * total;
  for (let i = 0; i < segLen.length; i++) {
    if (want <= segLen[i] || i === segLen.length - 1) {
      const t = segLen[i] ? want / segLen[i] : 0;
      return {
        lat: path[i][0] + (path[i + 1][0] - path[i][0]) * t,
        lon: path[i][1] + (path[i + 1][1] - path[i][1]) * t,
        hdgTo: {lat: path[i + 1][0], lon: path[i + 1][1]}
      };
    }
    want -= segLen[i];
  }
  return {lat: path[0][0], lon: path[0][1], hdgTo: null};
}

/**
 * A transitous map/trips response -> the SAME journey shape the
 * boards produce, so trainAt and the renderers serve both
 * providers. Each leg: two timed stops (departure/arrival already
 * real-time-adjusted upstream - the realTime flag says so) plus
 * the decoded polyline of the actual route, which trainAt follows
 * by arc length instead of the straight line. Modes outside
 * MODE_CAT (bus, coach, plane, underground) are dropped.
 */
export function parseTrips(json) {
  const out = [];
  for (const leg of Array.isArray(json) ? json : []) {
    const cat = MODE_CAT[leg.mode];
    if (!cat) continue;
    const dep = ms(leg.departure);
    const arr = ms(leg.arrival);
    const f = leg.from || {};
    const t = leg.to || {};
    if (
      !Number.isFinite(dep) ||
      !Number.isFinite(arr) ||
      !Number.isFinite(f.lat) ||
      !Number.isFinite(t.lat) ||
      arr <= dep
    )
      continue;
    const name = ((leg.trips || [])[0] && leg.trips[0].displayName) || cat;
    out.push({
      cat,
      number: '',
      operator: '',
      to: t.name || '',
      label: name,
      realTime: !!leg.realTime,
      consist: consistOf(cat, ''),
      stops: [
        {lat: f.lat, lon: f.lon, name: f.name || '', arrMs: dep, depMs: dep},
        {lat: t.lat, lon: t.lon, name: t.name || '', arrMs: arr, depMs: arr}
      ],
      path: leg.polyline ? decodePolyline(leg.polyline) : null
    });
  }
  return out;
}

// The metre-gauge and rack operators run shorter, narrower stock.
export const NARROW_OPS = new Set([
  'BOB',
  'ZB',
  'WAB',
  'BLM',
  'JB',
  'SPB',
  'MOB',
  'MGB',
  'RhB',
  'HB'
]);
export const CAR_STD = {len: 25, w: 2.85, h: 4};
export const CAR_NARROW = {len: 18, w: 2.65, h: 3.6};

export function consistOf(category, operator) {
  const op = String(operator || '').replace(/-.*$/, ''); // 'BLS-bls'
  const dims = NARROW_OPS.has(op) ? CAR_NARROW : CAR_STD;
  return {
    cars: CONSIST_CARS[category] ?? DEFAULT_CARS,
    ...dims,
    narrow: NARROW_OPS.has(op)
  };
}

const ms = (iso) => (iso ? Date.parse(iso) : NaN);

/**
 * A station board -> journeys [{cat, number, operator, to, label,
 * consist, stops: [{lat, lon, arrMs, depMs}]}]. Delay minutes are
 * ADDED to the published stop times (the real-time layer); stops
 * without a coordinate or any time are dropped; journeys need two
 * placed stops to ever be drawn.
 */
export function parseBoard(json, cats = RAIL_CATS) {
  const out = [];
  for (const e of (json && json.stationboard) || []) {
    if (!cats.has(e.category)) continue; // other modes/unknown
    const stops = [];
    for (const p of e.passList || []) {
      const c = (p.station && p.station.coordinate) || {};
      if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;
      const late = (Number.isFinite(p.delay) ? p.delay : 0) * 60000;
      const arr = ms(p.arrival);
      const dep = ms(p.departure);
      if (!Number.isFinite(arr) && !Number.isFinite(dep)) continue;
      stops.push({
        lat: c.x,
        lon: c.y,
        name: (p.station && p.station.name) || '',
        arrMs: (Number.isFinite(arr) ? arr : dep) + late,
        depMs: (Number.isFinite(dep) ? dep : arr) + late
      });
    }
    if (stops.length < 2) continue;
    out.push({
      cat: e.category,
      number: e.number || '',
      operator: e.operator || '',
      to: e.to || '',
      label: (e.category || '') + (e.number ? ' ' + e.number : ''),
      consist: consistOf(e.category, e.operator),
      stops
    });
  }
  return out;
}

/**
 * WHERE IS IT NOW: null before the first departure or after the
 * last arrival; AT a stop while dwelling (arr <= now <= dep);
 * linearly between the bracketing stops otherwise, with the
 * heading of that leg. Positions are the timetable's own fixes -
 * interpolation between real stops at real (delay-shifted) times.
 */
export function trainAt(journey, nowMs) {
  const s = journey.stops;
  if (nowMs < s[0].depMs || nowMs > s[s.length - 1].arrMs) return null;
  for (let i = 0; i < s.length; i++) {
    if (nowMs <= s[i].depMs && nowMs >= s[i].arrMs) {
      // dwelling: heading of the NEXT leg (or the previous at the end)
      const o = s[i + 1] || s[i - 1];
      return {
        lat: s[i].lat,
        lon: s[i].lon,
        hdgTo: o ? {lat: o.lat, lon: o.lon} : null,
        at: s[i].name,
        moving: false
      };
    }
    if (i + 1 < s.length && nowMs > s[i].depMs && nowMs < s[i + 1].arrMs) {
      const f = (nowMs - s[i].depMs) / (s[i + 1].arrMs - s[i].depMs);
      // A journey carrying its real route shape (transitous legs)
      // is followed along the SHAPE by arc length; board journeys
      // interpolate the straight line between their stops.
      if (journey.path && journey.path.length >= 2 && s.length === 2) {
        const p = pathPoint(journey.path, f);
        return {lat: p.lat, lon: p.lon, hdgTo: p.hdgTo, at: '', moving: true};
      }
      return {
        lat: s[i].lat + (s[i + 1].lat - s[i].lat) * f,
        lon: s[i].lon + (s[i + 1].lon - s[i].lon) * f,
        hdgTo: {lat: s[i + 1].lat, lon: s[i + 1].lon},
        at: '',
        moving: true
      };
    }
  }
  return null;
}
