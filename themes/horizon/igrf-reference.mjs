// Reference printer for the IGRF-14 field (node igrf-reference.mjs).
// The model lives once in igrf.js; the machinery is validated on
// ANALYTIC identities plus the published IGRF-14 landmarks:
//  - hand-written Schmidt semi-normalised P_n^m (n <= 3) equal the
//    recursion at machine precision
//  - the tilted-dipole closed form equals the n = 1 evaluation at
//    machine precision (checked at the equator, where the
//    geodetic-geocentric rotation is exactly the identity)
//  - the 2025 geomagnetic north pole sits at the published
//    80.9 N, 72.7 W; the dipole moment field ~ 29.7 uT
//  - full-field values land in the observed envelope (equator
//    22-35 uT, poles 48-62 uT) and declinations carry the known
//    signs: Iceland WEST (~ -11 to -14), New Zealand EAST
//    (~ +20 to +26), central Europe small EAST
import {dipole, geomagneticLatitude, igrfField, legendre} from './igrf.js';

const YEAR = 2026.5;

{
  const th = 1.1;
  const ct = Math.cos(th);
  const st = Math.sin(th);
  const {P} = legendre(3, ct, st);
  const hand = [
    [1, 0, ct],
    [1, 1, st],
    [2, 0, 1.5 * ct * ct - 0.5],
    [2, 1, Math.sqrt(3) * ct * st],
    [2, 2, (Math.sqrt(3) / 2) * st * st],
    [3, 0, 2.5 * ct * ct * ct - 1.5 * ct],
    [3, 1, (Math.sqrt(6) / 4) * st * (5 * ct * ct - 1)],
    [3, 2, (Math.sqrt(15) / 2) * ct * st * st],
    [3, 3, (Math.sqrt(10) / 4) * st * st * st]
  ];
  let worst = 0;
  for (const [n, m, v] of hand) worst = Math.max(worst, Math.abs(P[n][m] - v));
  console.log(
    `REF schmidt n<=3 vs hand forms: worst |d| = ${worst.toExponential(1)}`
  );
}

{
  // Tilted-dipole closed form vs igrfField(maxDegree = 1) at the
  // equator: colat 90 deg (ct = 0, st = 1), rotation = identity,
  // r = WGS84 equatorial radius. There
  //   X = -B_theta = -(a/r)^3 g10 ... sign worked per P10' = -st:
  //   B_theta = -(a/r)^3 (-g10) so X = -(a/r)^3 g10
  //   Z = -B_r = -2 (a/r)^3 (g11 cos + h11 sin)
  //   Y =  B_phi = -(a/r)^3 (-g11 sin + h11 cos) * -1 ... explicit:
  //   B_phi = -(1/st)(a/r)^3 m(-g11 sin + h11 cos) P11 with m=1,P=1.
  const {g10, g11, h11} = dipole(YEAR);
  let worst = 0;
  for (const lon of [0, 37, 121, -111]) {
    const r = 6378.137;
    const phi = (lon * Math.PI) / 180;
    const ar3 = Math.pow(6371.2 / r, 3);
    const Xa = -ar3 * g10;
    const Za = -2 * ar3 * (g11 * Math.cos(phi) + h11 * Math.sin(phi));
    const Ya = -ar3 * (-g11 * Math.sin(phi) + h11 * Math.cos(phi));
    const f = igrfField(0, lon, 0, YEAR, 1);
    worst = Math.max(
      worst,
      Math.abs(f.x - Xa),
      Math.abs(f.y - Ya),
      Math.abs(f.z - Za)
    );
  }
  console.log(
    `REF dipole identity (equator): worst |dB| = ${worst.toExponential(1)} nT`
  );
}

{
  const d = dipole(YEAR);
  console.log(
    `REF dipole: B0 ${(d.B0 / 1000).toFixed(2)} uT, geomagnetic N pole` +
      ` ${d.latP.toFixed(1)} N ${(-d.lonP).toFixed(1)} W (published 80.9 N 72.7 W)`
  );
}

{
  const pts = [
    ['Reykjavik', 64.13, -21.9],
    ['Grindelwald', 46.62, 8.04],
    ['Nelson NZ', -41.27, 173.28],
    ['equator 0E', 0, 0],
    ['N dip region', 86, -150]
  ];
  for (const [name, la, lo] of pts) {
    const f = igrfField(la, lo, 0, YEAR);
    console.log(
      `REF ${name}: D ${f.d.toFixed(1)} deg, I ${f.i.toFixed(1)} deg,` +
        ` F ${(f.f / 1000).toFixed(1)} uT, gm lat ` +
        `${geomagneticLatitude(la, lo, YEAR).toFixed(1)}`
    );
  }
}
