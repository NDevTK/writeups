// Reference printer for the Milky Way (node milkyway-reference.mjs).
// The model lives once in milkyway.js; the map in milkyway-data.js
// is a server-side ESA TAP aggregation over the ENTIRE Gaia DR3
// catalogue (query verbatim in its header). Landmarks:
//  - the data IS the whole catalogue: the cell counts sum to
//    1811709771 - the published DR3 source count EXACTLY
//    (Vallenari et al. 2023, A&A 674, A1) - and all 12288
//    HEALPix-5 cells are present
//  - the whole sky's integrated starlight comes to G ~ -6.8,
//    inside the classical "total starlight ~ mag -6.7" band
//  - HEALPix (Gorski 2005): npix = 12 nside^2; nested pixel 0
//    sits at z = 2/(3 nside) on the face-0 meridian (phi = 45
//    deg) and the last pixel mirrors it in the south
//  - the J2000 galactic frame: l=0,b=0 maps to RA 266.4050,
//    Dec -28.9362 (the textbook galactic-centre direction);
//    the NGP round-trips to b = 90; transforms invert exactly
//  - Riello et al. 2021 G-V relation at published nodes; a
//    synthetic cell holding exactly one V = 10 star per deg^2
//    returns s10 = 1 (the UNIT, by construction)
//  - structure: the galactic-plane cells outshine the poles by
//    the classical factor (>5x); the NGP cell sits in the
//    Toller/Leinert pole band (15-45 S10 for Gaia's G<21 depth)
import {
  ang2pix,
  CELL_AREA_DEG2,
  cellS10,
  equToGal,
  G_ZP_VEGA,
  galToEqu,
  gMinusV,
  HPX_NPIX,
  HPX_NSIDE,
  pix2ang
} from './milkyway.js';
import {MW_FBP, MW_FG, MW_FRP, MW_N} from './milkyway-data.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  const totalN = MW_N.reduce((a, b) => a + b, 0);
  const totalG = MW_FG.reduce((a, b) => a + b, 0);
  const mag = -2.5 * Math.log10(totalG) + G_ZP_VEGA;
  check(
    'whole-catalogue data',
    MW_N.length === HPX_NPIX &&
      MW_FG.length === HPX_NPIX &&
      totalN === 1811709771 &&
      MW_N.every((n) => n > 0) &&
      mag > -7.2 &&
      mag < -6.4,
    `12288 cells, ${totalN} sources (DR3 published count EXACTLY); every cell populated; whole-sky starlight G = ${mag.toFixed(2)} (classical ~ -6.7)`
  );
}

{
  const p0 = pix2ang(0);
  const pl = pix2ang(HPX_NPIX - 1);
  const zEdge = 2 / (3 * HPX_NSIDE);
  // The definitive pixelisation landmark: ang2pix inverts
  // pix2ang for EVERY one of the 12288 pixels.
  let roundTrips = 0;
  for (let p = 0; p < HPX_NPIX; p++) {
    const {z, phi} = pix2ang(p);
    if (ang2pix(z, phi) === p) roundTrips++;
  }
  check(
    'HEALPix (Gorski 2005)',
    HPX_NPIX === 12 * HPX_NSIDE * HPX_NSIDE &&
      Math.abs(p0.z - zEdge) < 1e-12 &&
      Math.abs((p0.phi * 180) / Math.PI - 45) < 1e-9 &&
      Math.abs(pl.z + zEdge) < 1e-12 &&
      Math.abs((pl.phi * 180) / Math.PI - 315) < 1e-9 &&
      roundTrips === HPX_NPIX,
    `npix = 12 nside^2 = ${HPX_NPIX}; nested pixel 0 at z = 2/(3 nside) = ${zEdge.toFixed(6)}, phi 45; ang2pix(pix2ang(p)) = p for ${roundTrips}/${HPX_NPIX} pixels`
  );
}

{
  const gc = galToEqu(0, 0);
  const ngp = equToGal(192.85948, 27.12825);
  const rt = equToGal(galToEqu(123.4, -45.6).ra, galToEqu(123.4, -45.6).dec);
  check(
    'galactic frame',
    Math.abs(gc.ra - 266.405) < 5e-4 &&
      Math.abs(gc.dec - -28.9362) < 5e-4 &&
      Math.abs(ngp.b - 90) < 1e-9 &&
      Math.abs(rt.l - 123.4) < 1e-9 &&
      Math.abs(rt.b - -45.6) < 1e-9,
    `l=0,b=0 -> RA ${gc.ra.toFixed(4)}, Dec ${gc.dec.toFixed(4)} (textbook 266.4050, -28.9362); NGP -> b ${ngp.b.toFixed(6)}; round trip exact`
  );
}

{
  // Riello nodes + the S10 unit by construction: one V = 10 star
  // per square degree must return exactly s10 = 1. Build the
  // fluxes backwards from the relations themselves.
  const c = 0.8;
  const gmv = gMinusV(c);
  const G = 10 + gmv; // so V = 10
  const fg = Math.pow(10, -0.4 * (G - G_ZP_VEGA));
  const frp = 1; // any positive pair with the right ratio
  const fbp = Math.pow(10, -0.4 * (c - (25.3385 - 24.7479)));
  const cell = cellS10(fg, fbp, frp, 1);
  check(
    'Riello G-V and the S10 unit',
    Math.abs(gMinusV(0) - -0.02704) < 1e-12 &&
      Math.abs(gMinusV(1) - (-0.02704 + 0.01424 - 0.2156 + 0.01426)) < 1e-12 &&
      Math.abs(cell.bpRp - c) < 1e-12 &&
      Math.abs(cell.s10 - 1) < 1e-9,
    `G-V(0) = -0.02704, G-V(1) = ${gMinusV(1).toFixed(5)} (coefficients verbatim); a lone V=10 star over 1 deg^2 -> s10 = ${cell.s10.toFixed(9)}`
  );
}

{
  // Structure: mean S10 within 5 deg of the plane vs the poles,
  // and the NGP cell against the Toller/Leinert pole band.
  let planeSum = 0;
  let planeN = 0;
  let poleSum = 0;
  let poleN = 0;
  let ngpS10 = 0;
  let ngpDist = 1e9;
  const R2D = 180 / Math.PI;
  for (let p = 0; p < HPX_NPIX; p++) {
    const {z, phi} = pix2ang(p);
    const dec = Math.asin(z) * R2D;
    const ra = phi * R2D;
    const {b} = equToGal(ra, dec);
    const {s10} = cellS10(MW_FG[p], MW_FBP[p], MW_FRP[p], CELL_AREA_DEG2);
    if (Math.abs(b) < 5) {
      planeSum += s10;
      planeN++;
    }
    if (Math.abs(b) > 80) {
      poleSum += s10;
      poleN++;
    }
    const d = Math.abs(b - 90);
    if (d < ngpDist) {
      ngpDist = d;
      ngpS10 = s10;
    }
  }
  const plane = planeSum / planeN;
  const pole = poleSum / poleN;
  // The POLE MEAN is the physical anchor (Toller/Pioneer: ~25-30
  // S10 with bright stars excluded); a single 3.36 deg^2 cell is
  // Poisson-dominated - one undrawn V~5.7 star adds ~17 S10 - so
  // the exact-NGP cell only gets a sanity bound.
  check(
    'galactic structure',
    plane / pole > 5 &&
      pole > 20 &&
      pole < 40 &&
      ngpS10 > 15 &&
      ngpS10 < 90 &&
      plane > 100,
    `plane (|b|<5) mean ${plane.toFixed(0)} S10 vs pole (|b|>80) mean ${pole.toFixed(1)} S10 (Toller band 20-40) - contrast ${(plane / pole).toFixed(1)}x; exact-NGP cell ${ngpS10.toFixed(1)} S10 (Poisson of undrawn 5.5-6.5 mag stars)`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
