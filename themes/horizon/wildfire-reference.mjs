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
import {parseWildfires, rangeBearing, firesNear} from './wildfire.js';

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

process.exit(fail ? 1 : 0);
