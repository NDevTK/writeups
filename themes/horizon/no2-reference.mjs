// Reference printer for the NO2 brown horizon (node
// no2-reference.mjs). The law lives once in no2.js - three
// independent laboratory datasets vendored from the MPI-Mainz
// Spectral Atlas (Keller-Rudek et al. 2013 ESSD, read in full)
// under the TROPOMI measured column - and these landmarks hold
// it:
//  - the three laboratories agree at the theme's channels
//    (Bogumil/Vandaele to ~2%; Burrows a documented ~6% low)
//  - the spectral ordering IS the brown tint: blue absorbed
//    ~87x more than red, 5x more than green
//  - the published colormap inverts exactly, open top and
//    no-data included
//  - the beta builder puts the whole measured column under the
//    boundary-layer profile identically
//  - the CPU transmittance twin carries the term on the same
//    1200 m leg (absent -> bit-exact identity)
//  - EMERGENCE: a heavy plume browns the horizon by tens of
//    percent in blue while staying invisible overhead and at a
//    clean background column - no threshold coded anywhere
import {
  NO2_H_M,
  NO2_RGB,
  bandMean,
  no2BetaPerM,
  no2OfRGBA,
  no2SigmaBurrows,
  no2SigmaCm2,
  no2SigmaVandaeleBG,
  sampleNo2
} from './no2.js';
import {NO2_BOGUMIL_B, NO2_BOGUMIL_R} from './no2-xsec-data.js';
import {pathToRadiusT, sunTransmittanceJS} from './sun-transmittance.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const MIE0 = {scat: [0, 0, 0], abs: [0, 0, 0]};

// ---- 1. three laboratories, one spectrum ------------------------
{
  const [sR, sG, sB] = no2SigmaCm2();
  const [vG, vB] = no2SigmaVandaeleBG();
  const [bR, bG, bB] = no2SigmaBurrows();
  const dv = Math.max(Math.abs(vB / sB - 1), Math.abs(vG / sG - 1));
  const db = Math.max(
    Math.abs(bB / sB - 1),
    Math.abs(bG / sG - 1),
    Math.abs(bR / sR - 1)
  );
  check(
    'three laboratories agree at the channels',
    dv < 0.03 && db < 0.08,
    `Bogumil vs Vandaele (B,G): ${(dv * 100).toFixed(1)}% worst; vs Burrows ` +
      `(R,G,B): ${(db * 100).toFixed(1)}% worst (GOME FM's documented low bias; ` +
      `Vandaele's set ends at 667 nm so red rides Bogumil vs Burrows)`
  );
  check(
    'the spectral ordering IS the brown tint',
    sB > sG && sG > sR && sB / sR > 60 && sB / sR < 120 && sB / sG > 4,
    `sigma B/G/R = ${sB.toExponential(2)}/${sG.toExponential(2)}/${sR.toExponential(2)} cm^2 - ` +
      `blue absorbed ${(sB / sR).toFixed(0)}x more than red, ${(sB / sG).toFixed(1)}x more ` +
      `than green: lost blue = the brown of polluted horizons`
  );
  // The band means are means over genuinely banded structure -
  // the vendored slices must show the bands (max/min spread),
  // the stated reason a single-wavelength read is not used.
  const bVals = NO2_BOGUMIL_B.map((r) => r[1]);
  const spreadB = Math.max(...bVals) / Math.min(...bVals);
  check(
    'banded spectrum justifies the band mean',
    NO2_BOGUMIL_B.length === 80 && NO2_BOGUMIL_R.length === 80 && spreadB > 1.3,
    `80 half-nm bins per window; blue-window max/min = ${spreadB.toFixed(2)} - ` +
      `the documented reason the channel value is a window mean`
  );
}

// ---- 2. the published colormap inverts --------------------------
{
  const mids = [];
  for (const [r, g, b, lo, hi] of NO2_RGB) {
    const v = no2OfRGBA(r, g, b, 255);
    if (lo < 0) mids.push(v === 0);
    else if (hi < 0) mids.push(v === lo);
    else mids.push(Math.abs(v - (lo + hi) / 2) < 1e-9 * Math.max(hi, 1));
  }
  check(
    'colormap roundtrip exact',
    NO2_RGB.length === 191 &&
      mids.every(Boolean) &&
      no2OfRGBA(0, 0, 0, 255) === null &&
      no2OfRGBA(255, 0, 0, 40) === null,
    `191 bins 0..2e16 molec/cm^2 roundtrip to their mids; open top reads its ` +
      `floor; off-palette and transparent read null`
  );
  // The neighbourhood census fails closed: an all-unpainted
  // window is a zero column.
  const s = sampleNo2(() => [0, 0, 0, 0], 128, 128, 8);
  check(
    'unpainted sky reads zero column',
    s.col === 0 && s.painted === 0,
    `no data -> column 0 -> beta 0 -> exact identity in every march`
  );
}

// ---- 3. the beta builder and the CPU twin -----------------------
{
  const N = 1.5e16;
  const beta = no2BetaPerM(N);
  const s = no2SigmaCm2();
  const ok =
    Math.abs(beta[2] * NO2_H_M - s[2] * N) < 1e-12 &&
    Math.abs(beta[0] * NO2_H_M - s[0] * N) < 1e-12 &&
    no2BetaPerM(0).every((x) => x === 0);
  check(
    'whole column under the boundary layer',
    ok,
    `beta0 x 1200 m = sigma x N per channel exactly (vertical tau restored); ` +
      `zero column -> zero beta`
  );
  // CPU twin: adding no2 multiplies the vertical transmittance by
  // exp(-tau_v x P) with P the profile fraction above the
  // observer (300 m up: e^-0.25) - held against the quadrature.
  const t0 = sunTransmittanceJS(1, MIE0, 300);
  const t1 = sunTransmittanceJS(1, {...MIE0, no2: beta}, 300);
  const tauV = s[2] * N;
  const expect = Math.exp(-tauV * Math.exp(-300 / NO2_H_M));
  check(
    'CPU twin carries the term on the 1200 m leg',
    Math.abs(t1[2] / t0[2] - expect) < 0.002 &&
      Math.abs(t1[0] / t0[0] - Math.exp(-s[0] * N * Math.exp(-300 / NO2_H_M))) <
        0.002 &&
      sunTransmittanceJS(1, MIE0, 300).every((v, i) => v === t0[i]),
    `zenith blue ratio ${(t1[2] / t0[2]).toFixed(4)} vs analytic ` +
      `${expect.toFixed(4)} (32-step quadrature); no2 absent is bit-exact identity`
  );
}

// ---- 4. emergence: brown at the horizon, invisible overhead -----
{
  const heavy = no2BetaPerM(1.5e16); // the colormap's red zone
  const clean = no2BetaPerM(1e15); // ordinary background
  const ratio = (mie, mu) => {
    const a = pathToRadiusT(mu, MIE0, 300);
    const b = pathToRadiusT(mu, mie, 300);
    return [b[0] / a[0], b[1] / a[1], b[2] / a[2]];
  };
  const hHeavy = ratio({...MIE0, no2: heavy}, 0.001); // horizon
  const upHeavy = ratio({...MIE0, no2: heavy}, 1); // zenith
  const hClean = ratio({...MIE0, no2: clean}, Math.sin(Math.PI / 9)); // 20 deg
  check(
    'heavy plume browns the horizon',
    hHeavy[2] > 0.5 &&
      hHeavy[2] < 0.75 &&
      hHeavy[0] / hHeavy[2] > 1.3 &&
      hHeavy[0] > 0.97,
    `1.5e16 molec/cm^2 at the horizon: blue transmits ${(hHeavy[2] * 100).toFixed(0)}%, ` +
      `red ${(hHeavy[0] * 100).toFixed(1)}% - R/B ratio ${(hHeavy[0] / hHeavy[2]).toFixed(2)}, ` +
      `the brown band over the skyline`
  );
  check(
    'invisible overhead and at background',
    upHeavy[2] > 0.99 && hClean[2] > 0.985,
    `same plume at the zenith: blue ${(upHeavy[2] * 100).toFixed(1)}% (the classic ` +
      `look-up blue over a brown skyline); background 1e15 at 20 deg elevation: ` +
      `${(hClean[2] * 100).toFixed(1)}% - under a JND, no threshold coded`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
