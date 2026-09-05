// pick-reference.mjs - the gate for the pick geometry (pick.js) and
// the vendored IAU star names (starnames-data.js). Identities that
// hold by form: the compass convention round-trips through scene
// directions and matches the harness pose; separations are
// symmetric and right at the cardinal points; the texel index
// reproduces the shader's sampling and inverts goesir.deckField's
// mapping; the sea-horizon walk finds the open sea on a synthetic
// coast; the IAU slice keeps its provenance shape and its brightest
// entries are the sky's brightest stars by the catalogue's own
// magnitudes.
import {
  azAltFromDir,
  catalogueIndexNear,
  dirFromAzAlt,
  fieldPixelOfTexel,
  nearestByAngle,
  rayPlaneY,
  seaHorizonAzimuth,
  sepDeg,
  texelIndex,
  yawPitchFor
} from './pick.js';
import {STAR_NAMES} from './starnames-data.js';

const RAD = Math.PI / 180;
let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

{
  const n = dirFromAzAlt(0, 0);
  const e = dirFromAzAlt(90, 0);
  const up = dirFromAzAlt(123, 90);
  let round = true;
  for (const [az, alt] of [
    [0, 0],
    [45, 10],
    [123.4, -5.6],
    [270, 60],
    [359.9, 0.5]
  ]) {
    const b = azAltFromDir(dirFromAzAlt(az, alt));
    if (!near(b.azDeg, az, 1e-9) || !near(b.altDeg, alt, 1e-9)) round = false;
  }
  const yp = yawPitchFor(247, 5);
  // the camera's forward (sin yaw, -sin pitch, cos yaw) is the same
  // direction the compass gives
  const fwd = {
    x: Math.sin(yp.yaw) * Math.cos(yp.pitch),
    y: -Math.sin(yp.pitch),
    z: Math.cos(yp.yaw) * Math.cos(yp.pitch)
  };
  const d = dirFromAzAlt(247, 5);
  check(
    'THE COMPASS CONVENTION round-trips and matches the camera',
    near(n.z, -1) &&
      near(n.x, 0) &&
      near(e.x, 1) &&
      near(e.z, 0) &&
      near(up.y, 1) &&
      round &&
      near(fwd.x, d.x) &&
      near(fwd.y, d.y) &&
      near(fwd.z, d.z),
    `north is -z, east is +x, the zenith +y; five directions round-trip through ` +
      `azAltFromDir to 1e-9; yaw pi - az and pitch -alt aim the free camera along ` +
      `the same vector the compass gives (az 247, alt 5)`
  );
}

{
  const N = {azDeg: 0, altDeg: 0};
  const E = {azDeg: 90, altDeg: 0};
  const Z = {azDeg: 0, altDeg: 90};
  const items = [
    {azDeg: 10, altDeg: 20, name: 'a'},
    {azDeg: 12, altDeg: 21, name: 'b'},
    {azDeg: 200, altDeg: 5, name: 'c'}
  ];
  const hit = nearestByAngle({azDeg: 11.5, altDeg: 20.5}, items, 3);
  const miss = nearestByAngle({azDeg: 100, altDeg: 40}, items, 3);
  check(
    'SEPARATIONS are right at the cardinal points and the nearest item is found',
    near(sepDeg(N, E), 90) &&
      near(sepDeg(N, Z), 90) &&
      near(sepDeg(E, N), 90) &&
      near(sepDeg(N, N), 0) &&
      near(sepDeg({azDeg: 0, altDeg: 0}, {azDeg: 180, altDeg: 0}), 180) &&
      hit &&
      hit.item.name === 'b' &&
      hit.sepDeg < 1 &&
      miss === null,
    `north-east 90 deg, north-zenith 90, north-south 180, symmetric, zero at identity; ` +
      `the click at (11.5, 20.5) picks item b at ${hit.sepDeg.toFixed(2)} deg, ` +
      `nothing within 3 deg of (100, 40)`
  );
}

{
  const t = rayPlaneY({x: 0, y: 10, z: 0}, {x: 0, y: 0.5, z: 0.5}, 20);
  const behind = rayPlaneY({x: 0, y: 30, z: 0}, {x: 0, y: 0.5, z: 0.5}, 20);
  const flat = rayPlaneY({x: 0, y: 10, z: 0}, {x: 1, y: 0, z: 0}, 20);
  // the shader samples pg = p / world + 0.5 on rm texels: a point at
  // -world/2 is texel 0, at 0 the centre texel, at +world/2 outside
  const rm = 101;
  const c = texelIndex(0, 0, 3632, rm);
  const edge0 = texelIndex(-1816, -1816, 3632, rm);
  const out = texelIndex(1816, 0, 3632, rm);
  // deckField maps texel ii to field pixel ci - halfPx - 1 + ii: the
  // centre texel (halfPx + 1) is the observer's own pixel
  const halfPx = 49;
  const fp = fieldPixelOfTexel(halfPx + 1, halfPx + 1, halfPx, 49, 49, rm);
  const border = fieldPixelOfTexel(0, 5, halfPx, 49, 49, rm);
  check(
    'THE TEXEL INDEX reproduces the shader and inverts the deck field',
    near(t, 20) &&
      behind === null &&
      flat === null &&
      c.ii === 50 &&
      c.jj === 50 &&
      edge0.ii === 0 &&
      edge0.jj === 0 &&
      out === null &&
      fp.i === 49 &&
      fp.j === 49 &&
      border === null,
    `a ray from y 10 reaches y 20 at t ${t}; behind and parallel are null; the scene ` +
      `origin is texel (50, 50) of 101, -world/2 is texel 0, +world/2 is outside; the ` +
      `centre texel maps back to the observer's field pixel (49, 49); border texels map nowhere`
  );
}

{
  // a synthetic coast: sea (bathymetry, -20 m) everywhere west of
  // x = 0 within 150 km, land (200 m) east; the walk must find west
  const mpu = 57.14;
  const elevAt = (x, z) => {
    const xm = x * mpu;
    const zm = z * mpu;
    if (Math.hypot(xm, zm) > 150e3) return 500;
    return xm < 0 ? -20 : 200;
  };
  const sea = seaHorizonAzimuth(elevAt, {mpu, n: 36, stepM: 1000});
  const none = seaHorizonAzimuth(() => 100, {mpu, n: 12});
  // the same coast seen from a mesa 20 km inland (the 150-km limit
  // now the observer's): the walk crosses the land first and still
  // finds the west, its sea run shorter by the land it crossed
  const inland = seaHorizonAzimuth(
    (x, z) =>
      Math.hypot(x * mpu, z * mpu) > 150e3 ? 500 : elevAt(x + 20e3 / mpu, z),
    {mpu, n: 36, stepM: 1000}
  );
  const all = seaHorizonAzimuth(() => -50, {
    mpu,
    n: 12,
    maxM: 20e3,
    stepM: 5e3
  });
  // a bay opening to the north-east across the wrap of the circle
  const bay = seaHorizonAzimuth(
    (x, z) => {
      const az = (((Math.atan2(x, -z) / RAD) % 360) + 360) % 360;
      return az >= 350 || az <= 30 ? -10 : 300;
    },
    {mpu, n: 36, maxM: 20e3, stepM: 5e3}
  );
  check(
    'THE SEA HORIZON walk finds the open sea',
    sea &&
      sea.azDeg === 270 &&
      sea.runM === 150e3 &&
      near(sea.arcDeg, 170, 1e-9) &&
      inland &&
      inland.azDeg === 270 &&
      inland.runM < sea.runM &&
      inland.runM > 100e3 &&
      none === null &&
      all.arcDeg === 360 &&
      bay &&
      near(bay.azDeg, 10, 1e-9) &&
      near(bay.arcDeg, 50, 1e-9),
    `on a coast running north-south with the sea to the west the open arc is ` +
      `${sea.arcDeg.toFixed(0)} deg wide, centred at ${sea.azDeg} deg, running ` +
      `${(sea.runM / 1000).toFixed(0)} km; from a mesa 20 km inland the walk crosses the land ` +
      `and still finds ${inland.azDeg} deg with ${(inland.runM / 1000).toFixed(0)} km of sea; ` +
      `an all-land ring answers null; an all-sea ring is the whole circle; a bay open from 350 ` +
      `to 30 deg centres at ${bay.azDeg} deg across the wrap`
  );
}

{
  const byMag = [...STAR_NAMES].sort((a, b) => a.mag - b.mag);
  const shape = STAR_NAMES.every(
    (s) =>
      typeof s.name === 'string' &&
      typeof s.bayer === 'string' &&
      Number.isFinite(s.mag) &&
      s.mag <= 2.5 &&
      s.raDeg >= 0 &&
      s.raDeg < 360 &&
      Math.abs(s.decDeg) <= 90
  );
  // Sirius (alpha CMa, RA 101.287, Dec -16.716 J2000) is the sky's
  // brightest star and heads the IAU list at its printed V -1.45
  const sirius = STAR_NAMES.find((s) => s.name === 'Sirius');
  const cat = [
    [101.2872, -16.7161, -1.46, 9900],
    [95.9879, -52.6957, -0.72, 7400],
    [213.9153, 19.1824, -0.04, 4300]
  ];
  const idx = catalogueIndexNear(sirius.raDeg, sirius.decDeg, cat);
  const far = catalogueIndexNear(0, 0, cat);
  check(
    'THE IAU NAMES keep their shape and Sirius heads them',
    STAR_NAMES.length > 30 &&
      STAR_NAMES.length < 120 &&
      shape &&
      byMag[0].name === 'Sirius' &&
      near(sirius.mag, -1.45, 1e-9) &&
      near(sirius.raDeg, 101.287155, 1e-4) &&
      near(sirius.decDeg, -16.716116, 1e-4) &&
      byMag[1].name === 'Canopus' &&
      idx === 0 &&
      far === -1,
    `${STAR_NAMES.length} IAU names to V 2.5 with J2000 coordinates and Bayer ` +
      `designations; Sirius (${sirius.bayer}) at V ${sirius.mag} heads the list, ` +
      `Canopus second; the catalogue match finds Sirius's row within 0.1 deg and ` +
      `nothing at the origin`
  );
}

process.exit(fail ? 1 : 0);
