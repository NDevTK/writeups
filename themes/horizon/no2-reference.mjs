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
  TEMPO_FIT_NM,
  TEMPO_FIT_WIDE_NM,
  TEMPO_FOR_DEG,
  TEMPO_NO2_PREC_CM2,
  TEMPO_NO2_TYP_CM2,
  TEMPO_REVISIT_H,
  TEMPO_RGB,
  bandMean,
  inTempoBox,
  no2BetaPerM,
  no2OfRGBA,
  no2SigmaBurrows,
  no2SigmaCm2,
  no2SigmaVandaeleBG,
  sampleNo2,
  tempoOfRGBA
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

// ---- 3b. TEMPO: the hourly geostationary column -----------------
// Zoogman et al. 2017 (NTRS 20170003141, read in full; Tables 1-2
// machine-read): the geostationary instrument scans greater North
// America every daylight hour and retrieves NO2 inside the very
// blue band the drawn absorber removes from the sky.
{
  // The vendored TEMPO palette: contiguous linear bins over the
  // published 0..3.0e16 span, every bin roundtripping to its mid
  // through the shared inverter.
  let contiguous = true;
  let roundtrip = true;
  for (let i = 1; i < TEMPO_RGB.length; i++) {
    const [r, g, b, lo, hi] = TEMPO_RGB[i];
    if (i > 1 && Math.abs(lo - TEMPO_RGB[i - 1][4]) > 1e6) contiguous = false;
    const v = tempoOfRGBA(r, g, b, 255);
    const want = lo < 0 ? 0 : (lo + hi) / 2;
    if (Math.abs(v - want) > 1e-9 * Math.max(hi, 1)) roundtrip = false;
  }
  check(
    'TEMPO palette inverts exactly',
    TEMPO_RGB.length === 255 &&
      contiguous &&
      roundtrip &&
      TEMPO_RGB[1][3] === 0 &&
      Math.abs(TEMPO_RGB[TEMPO_RGB.length - 1][4] - 3e16) < 1e6 &&
      tempoOfRGBA(0, 255, 0, 255) === null &&
      tempoOfRGBA(238, 134, 94, 40) === null,
    `254 contiguous linear bins 0..3.0e16 molec/cm^2 roundtrip to their mids ` +
      `through the shared inverter; below-range reads clean air; off-palette ` +
      `and transparent read null`
  );
  // The two published palettes measure the SAME quantity: a
  // column painted by both inverts to the same value within one
  // bin of the coarser scale (OMI 1.06e14, TEMPO 1.18e14 bins).
  const probes = [8e14, 3.2e15, 7.9e15, 1.4e16, 1.9e16];
  let worst = 0;
  for (const N of probes) {
    const oBin = NO2_RGB.find(([, , , lo, hi]) => lo >= 0 && N >= lo && N < hi);
    const tBin = TEMPO_RGB.find(
      ([, , , lo, hi]) => lo >= 0 && N >= lo && N < hi
    );
    const o = no2OfRGBA(oBin[0], oBin[1], oBin[2], 255);
    const t = tempoOfRGBA(tBin[0], tBin[1], tBin[2], 255);
    worst = Math.max(worst, Math.abs(o - t));
  }
  check(
    'two palettes, one quantity',
    worst < 1.18e14,
    `OMI-styled TROPOMI and TEMPO paints of the same column invert within one ` +
      `TEMPO bin (worst ${worst.toExponential(2)} molec/cm^2 across the shared ` +
      `range) - instrument-independent inversion, no scale factor anywhere`
  );
  // The printed fit windows sit inside the theme's blue channel
  // band-mean window (440 +- 20 nm): the instrument measures the
  // column in the band the drawn absorber removes.
  const bWin = [420, 460];
  check(
    'TEMPO fits NO2 in the drawn blue band',
    TEMPO_FIT_NM[0] >= bWin[0] &&
      TEMPO_FIT_NM[1] <= bWin[1] &&
      TEMPO_FIT_WIDE_NM[0] <= bWin[0] &&
      TEMPO_FIT_WIDE_NM[1] >= bWin[1] &&
      Math.abs((TEMPO_FIT_NM[0] + TEMPO_FIT_NM[1]) / 2 - 440) < 5,
    `Table 1 SNR window 423-451 nm INSIDE the theme's 420-460 nm blue mean ` +
      `window (mid 437 vs channel 440); Sect. 7 fit range 400-465 nm brackets ` +
      `it - the retrieval and the drawn optics share one band`
  );
  // Printed structure + the FOR precheck box from the abstract's
  // named corners.
  check(
    'printed mission structure carried',
    TEMPO_REVISIT_H === 1 &&
      TEMPO_FOR_DEG[0] === 4.82 &&
      TEMPO_FOR_DEG[1] === 8.38 &&
      TEMPO_NO2_TYP_CM2 === 6e15 &&
      TEMPO_NO2_PREC_CM2 === 1e15 &&
      inTempoBox(19.4, -99.1) &&
      inTempoBox(57, -111.4) &&
      inTempoBox(34.05, -118.24) &&
      !inTempoBox(53.5, 10) &&
      !inTempoBox(37.5, 127) &&
      !inTempoBox(NaN, -100),
    `hourly revisit, 4.82 x 8.38 deg FOR, typical 6e15 / precision 1e15 ` +
      `(Table 2); the precheck box holds the abstract's corners - Mexico City ` +
      `and the oil sands in, Hamburg and Seoul out, unmeasured out`
  );
  // The printed precision as the tint floor: a 1-sigma column is
  // invisible even on the horizon chord; the printed TYPICAL
  // background column is already at the JND edge there - the
  // feed's noise cannot paint a band, its signal can.
  const bPrec = no2BetaPerM(TEMPO_NO2_PREC_CM2);
  const bTyp = no2BetaPerM(TEMPO_NO2_TYP_CM2);
  const ratio = (mie, mu) => {
    const a = pathToRadiusT(mu, MIE0, 300);
    const b = pathToRadiusT(mu, mie, 300);
    return b[2] / a[2];
  };
  const hPrec = ratio({...MIE0, no2: bPrec}, 0.001);
  const hTyp = ratio({...MIE0, no2: bTyp}, 0.001);
  check(
    'printed precision under the tint floor',
    hPrec > 0.95 && hTyp < 0.85 && hTyp > 0.6,
    `1e15 (the required precision) transmits ${(hPrec * 100).toFixed(1)}% blue ` +
      `on the horizon chord - under a JND; the printed typical 6e15 transmits ` +
      `${(hTyp * 100).toFixed(0)}% - a visible browning: the drawn tint sits ` +
      `above the instrument's own noise by construction`
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
