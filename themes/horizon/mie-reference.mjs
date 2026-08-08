// Reference printer for the exact Mie machinery (node
// mie-reference.mjs). The law lives once in mie.js - van de
// Hulst's Ch. 9 series, the corona machinery's own printed
// source - and these landmarks hold it:
//  - the Rayleigh asymptote and the extinction paradox: the two
//    printed van de Hulst limits bracket the code from both ends
//  - the OPTICAL THEOREM closes to machine precision: the series
//    sum for Qext equals (4/x^2) Re S(0) - an exactness identity
//    no approximate implementation survives
//  - energy conservation: real index -> Qsca = Qext identically
//  - the forward lobe lands on the SHIPPED certified Airy
//    diffraction in the common large-x regime - new exact code
//    and old certified law meet where they must
//  - THE GLORY EMERGES at the fogbow's own printed droplet:
//    backscatter rings a few degrees from the antisolar point,
//    red outside blue, inverse-size similarity - nothing about
//    the glory is coded; it is what the series does at 180 deg
import {
  buildGloryLUT,
  GLORY_CH_UM,
  GLORY_MAX_DEG,
  GLORY_TEX_W,
  gloryRingDeg,
  mieCoeffs,
  mieN,
  miePhase,
  mieQ,
  mieQextOptical,
  mieS12
} from './mie.js';
import {airyPattern} from './cloud-corona.js';
import {waterIndex} from './rainbow.js';
import {FOG_D_DRAWN_UM} from './fogbow.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- 1. the printed limits --------------------------------------
{
  const m = 1.33;
  const x = 0.01;
  const {qsca} = mieQ(x, m);
  const ray = (8 / 3) * Math.pow(x, 4) * Math.pow((m * m - 1) / (m * m + 2), 2);
  check(
    'Rayleigh asymptote (van de Hulst)',
    Math.abs(qsca / ray - 1) < 1e-4,
    `x = 0.01, m = 1.33: Qsca = ${qsca.toExponential(6)} vs the printed ` +
      `(8/3) x^4 |(m^2-1)/(m^2+2)|^2 = ${ray.toExponential(6)} - the small end`
  );
  const big = mieQ(400, 1.33).qext;
  check(
    'extinction paradox (van de Hulst)',
    Math.abs(big - 2) < 0.1,
    `x = 400: Qext = ${big.toFixed(3)} - the printed large-sphere 2 the ` +
      `corona and fogbow already ride, now from the exact series`
  );
}

// ---- 2. exactness identities ------------------------------------
{
  let worstOT = 0;
  let worstE = 0;
  for (const [x, m] of [
    [1, 1.33],
    [10, 1.33],
    [80, 1.331],
    [114.2, 1.335]
  ]) {
    const q = mieQ(x, m);
    const ot = mieQextOptical(x, m);
    worstOT = Math.max(worstOT, Math.abs(ot / q.qext - 1));
    worstE = Math.max(worstE, Math.abs(q.qsca / q.qext - 1));
  }
  check(
    'optical theorem closes',
    worstOT < 1e-10,
    `Qext by series sum vs (4/x^2) Re S(0): worst relative difference ` +
      `${worstOT.toExponential(1)} across x = 1..114 - the identity an ` +
      `approximate code cannot fake`
  );
  check(
    'energy conserved at real index',
    worstE < 1e-9,
    `Qsca = Qext to ${worstE.toExponential(1)} (water is non-absorbing at ` +
      `drawn precision) - no photon lost in the series`
  );
  check(
    'series length is the classic criterion',
    mieN(100) === Math.ceil(100 + 4 * Math.cbrt(100) + 2) && mieN(100) > 100,
    `N = x + 4 x^(1/3) + 2 (Wiscombe's widely printed truncation) - ` +
      `${mieN(100)} terms at x = 100`
  );
}

// ---- 3. the shipped Airy meets the exact code -------------------
{
  const dUm = 20;
  const lam = 0.55;
  const m = waterIndex(lam);
  const x = (Math.PI * dUm) / lam;
  const coeffs = mieCoeffs(x, m);
  const {qsca} = mieQ(x, m);
  // Compare NORMALISED forward-lobe shapes over the inner half
  // of the first Airy lobe (the approximation's own validity
  // core; toward the zero the geometric-ray floor that Airy
  // lacks grows in relative weight).
  const th1 = ((1.22 * lam) / dUm) * 0.45;
  const n = 8;
  let worst = 0;
  const p0 = miePhase(coeffs, x, qsca, 1);
  const thetas = [];
  for (let i = 1; i <= n; i++) thetas.push((th1 * i) / n);
  const airy = airyPattern(dUm, lam, thetas);
  const airy0 = (x * x) / (4 * Math.PI);
  for (let i = 1; i <= n; i++) {
    const mie = miePhase(coeffs, x, qsca, Math.cos(thetas[i - 1])) / p0;
    const ai = airy[i - 1] / airy0;
    worst = Math.max(worst, Math.abs(mie / ai - 1));
  }
  check(
    'forward lobe lands on the certified Airy',
    worst < 0.1,
    `x = ${x.toFixed(0)} (a 20 um droplet): the exact Mie forward lobe and ` +
      `the SHIPPED airyPattern agree within ${(worst * 100).toFixed(1)}% over ` +
      `the inner half-lobe - the new code meets the corona machinery's ` +
      `certified law in their common regime`
  );
}

// ---- 4. the glory emerges ---------------------------------------
{
  const rG = gloryRingDeg(FOG_D_DRAWN_UM, 0.55);
  const rR = gloryRingDeg(FOG_D_DRAWN_UM, 0.68);
  const rB = gloryRingDeg(FOG_D_DRAWN_UM, 0.44);
  const rHalf = gloryRingDeg(FOG_D_DRAWN_UM * 2, 0.55, 4);
  check(
    'rings at the measured droplet, red outside blue',
    rG !== null &&
      rG > 1 &&
      rG < 6 &&
      rR !== null &&
      rB !== null &&
      rR > rB &&
      rHalf !== null &&
      Math.abs(rHalf / rG - 0.5) < 0.25,
    `the fogbow's own 14 um droplet (Mazoyer 2019) makes a first glory ring ` +
      `at ${rG?.toFixed(1)} deg from the antisolar point (green); red ` +
      `${rR?.toFixed(1)} outside blue ${rB?.toFixed(1)} deg; doubling the ` +
      `droplet halves the ring (${rHalf?.toFixed(1)} deg) - diffraction-like ` +
      `similarity EMERGING from the exact series, nothing coded`
  );
  const lut = buildGloryLUT();
  let finite = true;
  let peakCore = 0;
  for (let i = 0; i < lut.w; i++) {
    for (let c = 0; c < 3; c++) {
      const v = lut.data[i * 4 + c];
      if (!Number.isFinite(v) || v < 0) finite = false;
      if (i === 0) peakCore = Math.max(peakCore, v);
    }
  }
  check(
    'glory LUT physical',
    lut.w === GLORY_TEX_W &&
      lut.maxDeg === GLORY_MAX_DEG &&
      finite &&
      peakCore > 0 &&
      GLORY_CH_UM[1] === 0.55,
    `${GLORY_TEX_W} bins over 0-${GLORY_MAX_DEG} deg from antisolar, all ` +
      `channels finite and non-negative, bright core ` +
      `(${peakCore.toFixed(2)} sr^-1) - the normalised phase function, ` +
      `ready for the fog slab's own radiometry`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
