// Reference gate for wildfire.js (node wildfire-reference.mjs): the
// EONET wildfire feed -> real fire points, held to the feed's shape and
// to great-circle geodesy.
//
//  - parseWildfires reads the REAL EONET schema: geometry is a dated
//    track of [lon, lat] points (last = most recent); a Polygon burn
//    perimeter reduces to its centroid; closed and stale events drop;
//    freshest first; age in hours.
//  - rangeBearing is exact great-circle: 1 deg north ~111 km bearing 0,
//    1 deg east at the equator ~111 km bearing 90.
//  - firesNear filters by distance and fades intensity with age and
//    range (a fresh near fire burns bright, an old far one is a faint
//    horizon glow).
import {
  firesNear,
  goesFiresNear,
  mergeFires,
  parseWildfires,
  rangeBearing
} from './wildfire.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const near = (a, b, t) => Math.abs(a - b) < t;
const NOW = Date.parse('2026-07-12T00:00:00Z');
const iso = (hAgo) => new Date(NOW - hAgo * 3600000).toISOString();

// An EONET-shaped fixture: a fresh point fire, an older one, a fire
// whose latest geometry is a polygon perimeter, a closed (out) fire,
// and a stale fire beyond the age cap.
const FIXTURE = {
  events: [
    {
      id: 'EONET_A',
      title: 'Fresh Fire',
      geometry: [
        {type: 'Point', date: iso(30), coordinates: [-120.0, 39.0]},
        {type: 'Point', date: iso(2), coordinates: [-120.5, 39.2]} // latest
      ]
    },
    {
      id: 'EONET_B',
      title: 'Older Fire',
      geometry: [{type: 'Point', date: iso(50), coordinates: [8.0, 46.0]}]
    },
    {
      id: 'EONET_C',
      title: 'Perimeter Fire',
      geometry: [
        {
          type: 'Polygon',
          date: iso(10),
          coordinates: [
            [
              [10, 20],
              [12, 20],
              [12, 22],
              [10, 22],
              [10, 20]
            ]
          ]
        }
      ]
    },
    {
      id: 'EONET_OUT',
      title: 'Contained Fire',
      closed: iso(5),
      geometry: [{type: 'Point', date: iso(20), coordinates: [1, 1]}]
    },
    {
      id: 'EONET_STALE',
      title: 'Stale Fire',
      geometry: [{type: 'Point', date: iso(500), coordinates: [2, 2]}]
    }
  ]
};

{
  const fires = parseWildfires(FIXTURE, NOW, 240);
  const a = fires.find((f) => f.id === 'EONET_A');
  const c = fires.find((f) => f.id === 'EONET_C');
  const ok =
    fires.length === 3 && // A, B, C kept; OUT (closed) + STALE dropped
    a &&
    near(a.lat, 39.2, 1e-9) &&
    near(a.lon, -120.5, 1e-9) && // [lon,lat] order, latest point
    near(a.ageH, 2, 0.01) &&
    c &&
    near(c.lat, 21, 1e-9) &&
    near(c.lon, 11, 1e-9) && // polygon centroid
    fires[0].id === 'EONET_A' && // freshest first
    !fires.some((f) => f.id === 'EONET_OUT' || f.id === 'EONET_STALE');
  check(
    'parse EONET wildfires',
    ok,
    ok
      ? `3 open fires (fresh first); [lon,lat] latest point read (A 39.2/-120.5 @ ${a.ageH}h); polygon -> centroid (11,21); closed + stale dropped`
      : `got ${fires.length}: ${fires.map((f) => f.id).join(',')}`
  );
}

{
  // Great-circle sanity: 1 deg ~ 111.19 km; bearings due N / due E.
  const nn = rangeBearing(0, 0, 1, 0);
  const ee = rangeBearing(0, 0, 0, 1);
  const ok =
    near(nn.distKm, 111.19, 0.5) &&
    near(nn.bearingDeg, 0, 0.5) &&
    near(ee.distKm, 111.19, 0.5) &&
    near(ee.bearingDeg, 90, 0.5);
  check(
    'range + bearing',
    ok,
    `1deg N -> ${nn.distKm.toFixed(1)}km brg ${nn.bearingDeg.toFixed(0)}; 1deg E -> ${ee.distKm.toFixed(1)}km brg ${ee.bearingDeg.toFixed(0)}`
  );
}

{
  // firesNear: a viewpoint near the fresh California fire sees it close
  // and bright; the Swiss fire is far and excluded at 200 km; a distant
  // in-range fire is fainter than a near one; sorted nearest first.
  const fires = parseWildfires(FIXTURE, NOW, 240);
  const atCA = firesNear(fires, 39.3, -120.6, 200);
  const a = atCA.find((f) => f.id === 'EONET_A');
  // add a synthetic far-but-in-range fresh fire to test the distance fade
  const twoFires = [
    {id: 'NEAR', title: 't', lat: 39.3, lon: -120.55, ageH: 2},
    {id: 'FAR', title: 't', lat: 40.5, lon: -120.6, ageH: 2}
  ];
  const nf = firesNear(twoFires, 39.3, -120.6, 200);
  const ok =
    a &&
    a.distKm < 40 &&
    a.intensity > 0.5 && // near + fresh -> bright
    a.bearingDeg >= 0 &&
    a.bearingDeg < 360 &&
    !atCA.some((f) => f.id === 'EONET_B') && // Swiss fire out of 200 km
    nf[0].id === 'NEAR' && // nearest first
    nf[0].intensity > nf[1].intensity; // near brighter than far
  check(
    'fires near a viewpoint',
    ok,
    ok
      ? `California fire ${a.distKm.toFixed(0)}km intensity ${a.intensity.toFixed(2)}; Swiss fire excluded at 200km; nearer fire brighter`
      : `atCA=${atCA.map((f) => f.id).join(',')}`
  );
}

// ---- THE MEASURED HOT SPOTS (162nd pass) -------------------------
// NOAA's fire pixels as the scene's fires: the intensity from the
// radiative power on a log scale (1 MW faint, 1000 MW full, a
// saturated pixel full, a probable fire without power 0.3) times the
// distance fade; the merge keeps every measured pixel and drops the
// EONET events a measured pixel stands within 10 km of.
{
  const now = Date.parse('2026-09-06T14:00:00Z');
  const fileMs = now - 6 * 60e3; // a six-minute-old file
  const list = [
    {
      i: 1,
      j: 1,
      latDeg: 33.0,
      lonDeg: -117.2,
      code: 10,
      kind: 'processed',
      filtered: false,
      frpMW: 100,
      tempK: 800,
      areaM2: 50000
    },
    {
      i: 2,
      j: 1,
      latDeg: 33.4,
      lonDeg: -117.5,
      code: 31,
      kind: 'saturated',
      filtered: true,
      frpMW: null,
      tempK: null,
      areaM2: null
    },
    {
      i: 3,
      j: 1,
      latDeg: 33.1,
      lonDeg: -117.0,
      code: 15,
      kind: 'low probability',
      filtered: false,
      frpMW: null,
      tempK: null,
      areaM2: null
    },
    {
      i: 4,
      j: 1,
      latDeg: 34.2,
      lonDeg: -117.1,
      code: 10,
      kind: 'processed',
      filtered: false,
      frpMW: 1000,
      tempK: 900,
      areaM2: 90000
    },
    {
      i: 5,
      j: 1,
      latDeg: 36.0,
      lonDeg: -117.1,
      code: 10,
      kind: 'processed',
      filtered: false,
      frpMW: 5,
      tempK: 600,
      areaM2: 5000
    }
  ];
  const near = goesFiresNear(list, 32.85, -117.12, fileMs, now, 200);
  const byId = Object.fromEntries(near.map((n) => [n.id, n]));
  const events = [
    {
      id: 'E-close',
      title: 'Event beside the processed pixel',
      lat: 33.02,
      lon: -117.2,
      distKm: 19,
      bearingDeg: 0,
      intensity: 0.5,
      ageH: 20
    },
    {
      id: 'E-far',
      title: 'Event on its own',
      lat: 32.6,
      lon: -116.5,
      distKm: 64,
      bearingDeg: 110,
      intensity: 0.4,
      ageH: 30
    }
  ];
  const merged = mergeFires(near, events, 10);
  check(
    'THE MEASURED HOT SPOTS: the heat sets the glow, the merge keeps the pixel over the event',
    near.length === 4 && // the 36 N pixel is 350 km off, past 200
      near[0].id === 'goes-1-1' &&
      near[0].measured === true &&
      near[0].kind === 'processed' &&
      near[0].frpMW === 100 &&
      near[0].title === 'processed fire pixel 100 MW' &&
      Math.abs(near[0].ageH - 0.1) < 1e-9 &&
      near[0].intensity > 0.7 &&
      near[0].intensity < 0.9 && // heat 0.35 + 0.65 log10(101)/3 = 0.784, the distance fade ~0.9
      byId['goes-2-1'].intensity > byId['goes-1-1'].intensity * 0.9 && // saturated: heat 1 (farther, faded)
      byId['goes-2-1'].title.endsWith(', seen before') &&
      byId['goes-3-1'].intensity < 0.31 && // a low-probability pixel without power: 0.3 x fade
      byId['goes-4-1'].intensity < byId['goes-1-1'].intensity && // 1000 MW (full heat) but 150 km off: the distance fade wins
      merged.length === 5 &&
      merged.some((m) => m.id === 'E-far') &&
      !merged.some((m) => m.id === 'E-close') &&
      merged[0].distKm <= merged[1].distKm,
    `${near.length} measured pixels within 200 km (a fifth 350 km off dropped); the 100-MW processed pixel glows at ${near[0].intensity.toFixed(2)} ` +
      `and the 1000-MW pixel 150 km off at ${byId['goes-4-1'].intensity.toFixed(2)} ` +
      `(heat ${(0.35 + (0.65 * Math.log10(101)) / 3).toFixed(3)} times its distance fade), the saturated pixel full heat, the low-probability one ` +
      `${byId['goes-3-1'].intensity.toFixed(2)}; the file ${(near[0].ageH * 60).toFixed(0)} min old; the merge keeps the EONET event 64 km away ` +
      `and drops the one 2 km from the processed pixel: ${merged.map((m) => m.id).join(', ')}`
  );
}

process.exit(fail ? 1 : 0);
