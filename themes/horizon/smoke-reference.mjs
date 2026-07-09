// Reference printer for the wildfire-smoke layer (node
// smoke-reference.mjs). Every HMS plume is an analyst's verified
// observation, so the gate holds the decoding of their product to
// a VERBATIM fixture captured live from the real daily KML
// (2026-07-06 file, fetched 2026-07-09):
//  - the parser recovers exactly the placemarks in the file -
//    densities from styleUrl, rings from the coordinate lines
//  - point-in-polygon: interior points of each real plume hit
//    with the right class, heavy outranks light in overlaps, a
//    concave notch is OUTSIDE (the even-odd test, not a bbox)
//  - the published class concentrations (Ruminski et al. 2006:
//    light/medium/heavy = 5/16/27 ug/m^3)
import {HMS_UGM3, inRing, parseHmsKml, smokeAt} from './smoke.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// Three placemarks copied VERBATIM from the live daily file (one
// per density; the shortest ring of each class).
const FIXTURE =
  '<kml><Document><Placemark><description><![CDATA[<div style="width:170px;">Start Time: 2026187 1700UTC<br>End Time: 2026187 2000UTC<br>Density: Light<br>Satellite: GOES-WEST</div>]]></description>\n<styleUrl>#Smoke_Light_style</styleUrl>\n<Polygon>\n  <tessellate>1</tessellate>\n  <gx:drawOrder>0</gx:drawOrder>\n  <outerBoundaryIs>\n    <LinearRing>\n      <coordinates>\n        -77.487670,47.716114,0\n        -77.487670,47.874222,0\n        -77.608575,48.078831,0\n        -77.738781,48.255539,0\n        -77.999193,48.385745,0\n        -78.203802,48.404346,0\n        -78.454914,48.329942,0\n        -78.547918,48.209037,0\n        -78.566519,48.041629,0\n        -78.436313,47.688213,0\n        -78.250304,47.595209,0\n        -77.980592,47.502205,0\n        -77.748082,47.474304,0\n        -77.571374,47.567308,0\n        -77.487670,47.716114,0\n      </coordinates>\n    </LinearRing>\n  </outerBoundaryIs>\n</Polygon>\n</Placemark>\n<Placemark><description><![CDATA[<div style="width:170px;">Start Time: 2026187 1500UTC<br>End Time: 2026187 1700UTC<br>Density: Medium<br>Satellite: GOES-WEST</div>]]></description>\n<styleUrl>#Smoke_Medium_style</styleUrl>\n<Polygon>\n  <tessellate>1</tessellate>\n  <gx:drawOrder>1</gx:drawOrder>\n  <outerBoundaryIs>\n    <LinearRing>\n      <coordinates>\n        -75.136055,54.050601,0\n        -75.136055,54.156006,0\n        -75.136055,54.255210,0\n        -75.098853,54.311012,0\n        -75.030650,54.342014,0\n        -74.974848,54.342014,0\n        -74.919045,54.292412,0\n        -74.956247,54.156006,0\n        -75.012049,54.100203,0\n        -75.067852,54.044401,0\n        -75.136055,54.050601,0\n      </coordinates>\n    </LinearRing>\n  </outerBoundaryIs>\n</Polygon>\n</Placemark>\n<Placemark><description><![CDATA[<div style="width:170px;">Start Time: 2026187 1200UTC<br>End Time: 2026187 1500UTC<br>Density: Heavy<br>Satellite: GOES-EAST</div>]]></description>\n<styleUrl>#Smoke_Heavy_style</styleUrl>\n<Polygon>\n  <tessellate>1</tessellate>\n  <gx:drawOrder>2</gx:drawOrder>\n  <outerBoundaryIs>\n    <LinearRing>\n      <coordinates>\n        -78.735066,50.227056,0\n        -78.747041,50.228145,0\n        -78.759651,50.221522,0\n        -78.764550,50.205601,0\n        -78.755977,50.183555,0\n        -78.742505,50.170083,0\n        -78.719235,50.160285,0\n        -78.706398,50.168631,0\n        -78.703857,50.191856,0\n        -78.713655,50.209638,0\n        -78.722909,50.221522,0\n        -78.735066,50.227056,0\n      </coordinates>\n    </LinearRing>\n  </outerBoundaryIs>\n</Polygon>\n</Placemark></Document></kml>';

{
  const polys = parseHmsKml(FIXTURE);
  const sig = polys.map((p) => p.density + ':' + p.ring.length).join(' ');
  check(
    'HMS parser',
    polys.length === 3 &&
      sig === 'light:15 medium:11 heavy:12' &&
      parseHmsKml('<kml>junk</kml>').length === 0 &&
      parseHmsKml(null).length === 0,
    `verbatim fixture -> ${sig}; junk and null -> empty`
  );
}

{
  // Interior probes of the real plumes (mean of three adjacent
  // vertices - locally convex) hit with the right class; a point
  // an ocean away misses everything.
  const polys = parseHmsKml(FIXTURE);
  const probe = (p) => {
    const c = [0, 1, 2].reduce(
      (a, i) => [a[0] + p.ring[i][0] / 3, a[1] + p.ring[i][1] / 3],
      [0, 0]
    );
    return smokeAt(polys, c[0], c[1]);
  };
  const hits = polys.map(probe);
  check(
    'plume lookup',
    hits[0].ugm3 === 5 &&
      hits[1].ugm3 === 16 &&
      hits[2].ugm3 === 27 &&
      smokeAt(polys, 51.48, 0) === null &&
      HMS_UGM3.light === 5 &&
      HMS_UGM3.medium === 16 &&
      HMS_UGM3.heavy === 27,
    `real-plume interiors -> 5/16/27 ug/m^3 (Ruminski et al. 2006 classes); Greenwich -> null`
  );
}

{
  // Geometry discipline: heavy outranks light where plumes
  // overlap, and a concave notch is genuinely outside - the
  // even-odd test, not a bounding box (a centroid can lie outside
  // its own concave plume; the lookup must not).
  const light = {
    density: 'light',
    ring: [
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0]
    ]
  };
  const heavy = {
    density: 'heavy',
    ring: [
      [4, 4],
      [4, 6],
      [6, 6],
      [6, 4]
    ]
  };
  // A "U" in lat/lon: the notch (5, 5) is outside the smoke.
  const u = [
    [0, 0],
    [10, 0],
    [10, 4],
    [2, 4],
    [2, 6],
    [10, 6],
    [10, 10],
    [0, 10]
  ];
  check(
    'overlap and concavity',
    smokeAt([light, heavy], 5, 5).density === 'heavy' &&
      smokeAt([light], 5, 5).density === 'light' &&
      inRing(u, 5, 5) === false &&
      inRing(u, 1, 5) === true &&
      smokeAt([light], 11, 5) === null,
    `heavy outranks light in the overlap; the U-notch is outside (even-odd), its arm inside; beyond the edge -> null`
  );
}

process.exit(fail ? 1 : 0);
