// daylight-reference.mjs - the gate for daylight.js (159th pass): the
// visible band shaping the decks inside the mask's cloud, on
// synthetic windows laid on GOES-West's REAL fixed grid (the PUG's
// geometry, the CONUS 500-m and 2-km scales) around the home and the
// theme's own mercator window there: a bright cloud disc, a thin
// annulus, a clear sea - the references measured back out of the
// window, the fractions 1, 0.5 and none, the holes keeping the coarse
// cover, the theme's field standing in for the mask, the dark window
// refused, thin references refused.
import {
  cosSolarZenith,
  fixedGridToLatLon,
  latLonToFixedGrid,
  fixedGridGeometry,
  solarGeometry,
  windowBox
} from './goesl2.js';
import {CLS, mercatorLatLon, windowTiles} from './goesir.js';
import {
  DAYLIGHT_DQF_MAX,
  DAYLIGHT_FACTOR,
  DAYLIGHT_SZA_MAX_DEG,
  daylightField,
  fieldClearOf,
  fineFractionAt,
  maskClearOf,
  visReflectance,
  windowScanAngles
} from './daylight.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

const HOME = {lat: 32.85, lon: -117.12};
const AT = '2026-09-06T17:06:00Z'; // the sun 47 deg from the zenith here
// GOES-West's fixed grid (the PUG's constants, GOES-18 at 137 W)
const g = fixedGridGeometry({
  semi_major_axis: 6378137,
  semi_minor_axis: 6356752.31414,
  perspective_point_height: 35786023,
  longitude_of_projection_origin: -137
});
const home = latLonToFixedGrid(HOME.lat, HOME.lon, g);
// a synthetic scene of 6000 x 6000 pixels on each grid with the home
// at (3000, 3000) on the 500-m grid (scale 14 urad, y downward) and
// at (750, 750) on the 2-km grid (56 urad)
const grid = (scaleRad, n, at) => ({
  x: {scale: scaleRad, offset: home.x - at * scaleRad, n},
  y: {scale: -scaleRad, offset: home.y + at * scaleRad, n}
});
const G500 = grid(14e-6, 6000, 3000);
const G2K = grid(56e-6, 1500, 750);
const distKm = (latDeg, lonDeg) => {
  const R = Math.PI / 180;
  const dLat = (latDeg - HOME.lat) * R;
  const dLon = (lonDeg - HOME.lon) * R;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(HOME.lat * R) * Math.cos(latDeg * R) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};
// the scene: a bright cloud within 40 km (reflectance 0.65), a thin
// one to 60 km (0.35), clear sea beyond (0.05)
const RHO_CLOUD = 0.65;
const RHO_THIN = 0.35;
const RHO_CLEAR = 0.05;
const rhoOf = (km) => (km < 40 ? RHO_CLOUD : km < 60 ? RHO_THIN : RHO_CLEAR);

// the visible window: 401 x 401 around the home, the factor = the
// reflectance times the pixel's own cos(sun) at the file's time;
// every 97th pixel flagged no value (fill)
const visBox = windowBox(HOME.lat, HOME.lon, g, G500.x, G500.y, 6000, 6000, 200);
const geo = solarGeometry(Date.parse(AT));
const nVis = visBox.cols * visBox.rows;
const vis = {
  g,
  x: G500.x,
  y: G500.y,
  box: visBox,
  time: AT,
  rfac: new Float32Array(nVis),
  dqf: new Uint8Array(nVis)
};
let flagged = 0;
for (let q = 0; q < nVis; q++) {
  const s = windowScanAngles(vis, q);
  const ll = fixedGridToLatLon(s.x, s.y, g);
  const cs = cosSolarZenith(ll.latDeg, ll.lonDeg, geo);
  if (q % 97 === 0) {
    vis.rfac[q] = NaN;
    vis.dqf[q] = 3;
    flagged++;
  } else {
    vis.rfac[q] = rhoOf(distKm(ll.latDeg, ll.lonDeg)) * cs;
    vis.dqf[q] = 0;
  }
}
// the mask window: 101 x 101 on the 2-km grid, cloudy within 60 km,
// its flag not good in a ring at 60-62 km
const maskBox = windowBox(HOME.lat, HOME.lon, g, G2K.x, G2K.y, 1500, 1500, 50);
const nMask = maskBox.cols * maskBox.rows;
const mask = {
  x: G2K.x,
  y: G2K.y,
  box: maskBox,
  bcm: new Uint8Array(nMask),
  dqf: new Uint8Array(nMask)
};
for (let q = 0; q < nMask; q++) {
  const s = windowScanAngles(mask, q);
  const ll = fixedGridToLatLon(s.x, s.y, g);
  const km = distKm(ll.latDeg, ll.lonDeg);
  mask.bcm[q] = km < 60 ? 1 : 0;
  mask.dqf[q] = km >= 60 && km < 62 ? 1 : 0;
}
// the theme's mercator window and frame at the home (goesir's own)
const win = windowTiles(HOME.lat, HOME.lon);
const i0 = Math.floor(win.px) - win.halfPx;
const j0 = Math.floor(win.py) - win.halfPx;
const ci = Math.floor(win.px - i0);
const cj = Math.floor(win.py - j0);
const frame = {win, i0, j0, ci, cj, halfPx: win.halfPx};
const ww = 2 * win.halfPx + 1;
// the theme's field: every pixel sea, low cloud within 60 km
const field = {ww, wh: ww, cls: new Uint8Array(ww * ww), water: new Uint8Array(ww * ww).fill(1)};
for (let j = 0; j < ww; j++)
  for (let i = 0; i < ww; i++) {
    const ll = mercatorLatLon(win.x0 + i0 + i + 0.5, win.y0 + j0 + j + 0.5, win.z);
    field.cls[j * ww + i] = distKm(ll.latDeg, ll.lonDeg) < 60 ? CLS.low : CLS.clear;
  }
// the coarse deck field as deckField lays it: a zero border, the
// interior texel ii from field pixel ci - halfPx - 1 + ii, low cover
// 0.95 over the cloudy sea, both validities 1
const rm = 2 * win.halfPx + 3;
const deck = {data: new Float32Array(rm * rm * 4), rm};
let cloudyCoarse = 0;
for (let jj = 1; jj < rm - 1; jj++)
  for (let ii = 1; ii < rm - 1; ii++) {
    const i = ci - win.halfPx - 1 + ii;
    const j = cj - win.halfPx - 1 + jj;
    if (i < 0 || j < 0 || i >= ww || j >= ww) continue;
    const k = (jj * rm + ii) * 4;
    const cloudy = field.cls[j * ww + i] === CLS.low;
    deck.data[k] = cloudy ? 0.95 : 0;
    deck.data[k + 2] = 1;
    deck.data[k + 3] = 1;
    if (cloudy) cloudyCoarse++;
  }

// ---- the words at a pixel, the reflectance back out ---------------
{
  const qHome = visBox.j * 0 + (visBox.j - visBox.j0) * visBox.cols + (visBox.i - visBox.i0);
  const clearOf = maskClearOf(vis, mask);
  const ownOf = fieldClearOf(vis, field, frame);
  // a pixel 61 km east: the ring's flag not good -> null from the
  // mask; the theme's field says clear there (beyond 60 km)
  let qRing = -1;
  let qFar = -1;
  for (let q = 0; q < nVis; q++) {
    const s = windowScanAngles(vis, q);
    const ll = fixedGridToLatLon(s.x, s.y, g);
    const km = distKm(ll.latDeg, ll.lonDeg);
    if (qRing < 0 && km > 60.5 && km < 61.5 && Math.abs(ll.latDeg - HOME.lat) < 0.01) qRing = q;
    if (qFar < 0 && km > 80 && km < 85 && Math.abs(ll.latDeg - HOME.lat) < 0.01) qFar = q;
  }
  const refl = visReflectance(vis, Date.parse(AT));
  const dark = visReflectance(vis, Date.parse('2026-09-06T06:00:00Z'));
  check(
    'THE WORDS AT A PIXEL: the mask and the field at the visible pixel’s scan angles, the reflectance at its own sun',
    clearOf(qHome) === false &&
      ownOf(qHome) === false &&
      clearOf(qRing) === null &&
      ownOf(qRing) === true &&
      clearOf(qFar) === true &&
      ownOf(qFar) === true &&
      near(refl.rho[qHome], RHO_CLOUD, 1e-6) &&
      near(refl.rho[qFar], RHO_CLEAR, 1e-6) &&
      Number.isNaN(refl.rho[0]) &&
      refl.lit === nVis - flagged &&
      refl.n === nVis &&
      dark.lit === 0 &&
      DAYLIGHT_DQF_MAX === 1 &&
      DAYLIGHT_FACTOR === 4 &&
      DAYLIGHT_SZA_MAX_DEG === 85,
    `the home's 500-m pixel reads cloudy under both the ACM and the theme's field, a pixel in the mask's not-good ring ` +
      `null under the mask and clear under the field, one 80 km out clear under both; the reflectance back out of the factor ` +
      `at each pixel's own sun ${refl.rho[qHome].toFixed(4)} at the home and ${refl.rho[qFar].toFixed(4)} at sea ` +
      `(${refl.lit.toLocaleString('en-US')} of ${refl.n.toLocaleString('en-US')} pixels lit, ${flagged} flagged no value); ` +
      `at 06Z the window is dark: nothing lit`
  );
}

// ---- the field composed -------------------------------------------
{
  const res = daylightField({vis, deck, frame, mask, ms: Date.parse(AT)});
  const own = daylightField({vis, deck, frame, mask: null, field, ms: Date.parse(AT)});
  const night = daylightField({vis, deck, frame, mask, ms: Date.parse('2026-09-06T06:00:00Z')});
  const allCloud = {...mask, bcm: new Uint8Array(nMask).fill(1), dqf: new Uint8Array(nMask)};
  const thin = daylightField({vis, deck, frame, mask: allCloud, ms: Date.parse(AT)});
  const rf = rm * DAYLIGHT_FACTOR;
  const sum = (d, ch) => {
    let s = 0;
    for (let k = ch; k < d.data.length; k += 4) s += d.data[k];
    return s;
  };
  // an independent count over the fine texel centres: how many lie
  // under cloud within 40 km (fraction 1) and in the annulus (0.5)
  const X0 = win.x0 + i0 + ci - win.halfPx - 1;
  const Y0 = win.y0 + j0 + cj - win.halfPx - 1;
  let bright = 0;
  let annulus = 0;
  let coarseCloudFine = 0;
  for (let fj = 0; fj < rf; fj++)
    for (let fi = 0; fi < rf; fi++) {
      const ii = Math.floor(fi / DAYLIGHT_FACTOR);
      const jj = Math.floor(fj / DAYLIGHT_FACTOR);
      if (!(deck.data[(jj * rm + ii) * 4] > 0)) continue;
      coarseCloudFine++;
      const ll = mercatorLatLon(X0 + (fi + 0.5) / DAYLIGHT_FACTOR, Y0 + (fj + 0.5) / DAYLIGHT_FACTOR, win.z);
      const km = distKm(ll.latDeg, ll.lonDeg);
      if (km < 40) bright++;
      else if (km < 60) annulus++;
    }
  const expectedLow = 0.95 * (bright + 0.5 * annulus);
  const centre = 4 * (win.halfPx + 1) + 2;
  const fracAt = (fi, fj) => res.frac[fj * rf + fi];
  // a fine texel about 50 km east of the home
  const east = centre + Math.round(50e3 / (win.mppM / DAYLIGHT_FACTOR));
  const lowSum = sum(res.fine, 0);
  check(
    'THE DAYLIGHT FIELD composed: the scene’s references measured back out, the fractions 1 and 0.5 and none, the holes kept, the field standing in, the dark and the thin refused',
    res !== null &&
      res.fine !== null &&
      res.sortedBy === 'ACM' &&
      near(res.refs.rhoClear, RHO_CLEAR, 1e-4) &&
      near(res.refs.rhoCloud, RHO_CLOUD, 1e-4) &&
      res.refs.nClear > 20000 &&
      res.refs.nCloud > 20000 &&
      res.fine.rm === rf &&
      res.fine.factor === DAYLIGHT_FACTOR &&
      res.fine.cloudy === 16 * cloudyCoarse &&
      res.fine.cloudy === coarseCloudFine &&
      res.fine.refined < res.fine.cloudy &&
      res.fine.refined > 0.98 * res.fine.cloudy &&
      res.stats.refined === res.fine.refined &&
      res.stats.lit === nVis - flagged &&
      // 1 to the float32 the window carries its reflectance in
      near(fracAt(centre, centre), 1, 1e-6) &&
      near(fracAt(east, centre), 0.5, 1e-3) &&
      Number.isNaN(fracAt(2, 2)) &&
      Number.isNaN(fracAt(rf - 3, rf - 3)) &&
      near(lowSum, expectedLow, 0.02 * expectedLow) &&
      near(sum(res.fine, 1), 0, 1e-9) &&
      near(sum(res.fine, 2), 16 * sum(deck, 2), 1e-6) &&
      near(sum(res.fine, 3), 16 * sum(deck, 3), 1e-6) &&
      res.stats.meanFraction > 0.6 &&
      res.stats.meanFraction < 0.9 &&
      own !== null &&
      own.sortedBy === 'field' &&
      near(own.refs.rhoClear, RHO_CLEAR, 1e-4) &&
      near(own.refs.rhoCloud, RHO_CLOUD, 1e-4) &&
      near(sum(own.fine, 0), lowSum, 1e-6) &&
      night === null &&
      thin !== null &&
      thin.fine === null &&
      thin.refs.rhoClear === null &&
      thin.refs.rhoCloud !== null &&
      thin.stats.refined === 0,
    `${rf}x${rf} fine texels from ${rm}x${rm}: the references measured back out of the window under the ACM - clear ` +
      `${res.refs.rhoClear.toFixed(4)} (median of ${res.refs.nClear.toLocaleString('en-US')} clear px) and cloud ` +
      `${res.refs.rhoCloud.toFixed(4)} (p90 of ${res.refs.nCloud.toLocaleString('en-US')}) against the scene's ${RHO_CLEAR} and ${RHO_CLOUD}; ` +
      `${res.fine.cloudy.toLocaleString('en-US')} fine texels under the ${cloudyCoarse.toLocaleString('en-US')} cloudy coarse ones, ` +
      `${res.fine.refined.toLocaleString('en-US')} shaped (the rest on flagged pixels keep the coarse cover); the fraction 1 over the home, ` +
      `${fracAt(east, centre).toFixed(3)} 50 km east in the thin annulus, none on the border; the low cover sums to ${lowSum.toFixed(0)} ` +
      `against ${expectedLow.toFixed(0)} counted over the fine centres by distance (${((100 * lowSum) / expectedLow - 100).toFixed(2)}%), ` +
      `the validities copied whole, the mean fraction ${res.stats.meanFraction.toFixed(3)}; the theme's field standing in for the mask ` +
      `measures the same references and the same field; the dark window answers null, a mask all cloud leaves the clear reference ` +
      `unmeasurable and the field unrefined`
  );
}

process.exit(fail ? 1 : 0);
