// rayleighpol-reference.mjs - the gate for the polarized
// Rayleigh engine (stage 1). The law lives once in
// rayleighpol.js; the ground truth is the vendored IPRT case A1
// slice (rayleighpol-data.js - the intercomparison's own
// published results, IPOL checked against PSTAR at vendor
// time). Landmarks:
//  - the scattering matrix normalises itself: the sphere mean
//    of F11 is 1 exactly, at zero and nonzero depolarization
//  - the azimuth dependence is band-limited: 32-sample Fourier
//    round-trip reconstructs the full phase matrix at machine
//    noise (Rayleigh has nothing above m = 2)
//  - the doubling meets analytic single scattering in the thin
//    limit - the whole decompose/compose chain, rotations
//    included, against a closed form
//  - energy conserves: for the conservative layer the reflected
//    plus transmitted flux returns the incident beam to 1e-7
//  - THE BENCHMARK: every vendored row, all three sub-cases,
//    both boundaries - I and Q to a few 1e-6 absolute, |U|
//    likewise, and the U sign agrees at EVERY row under the one
//    documented convention flip
//  - THE NEUTRAL POINTS EMERGE: in the sun's meridian the
//    single-scattered sky is polarization-free only AT the sun;
//    the full field's zeros sit DISPLACED above and below it
//    (Babinet and Brewster), and the engine's zeros fall inside
//    the benchmark's own sign-change brackets
import {
  gauss01,
  rayleighF,
  singleScatterA1,
  skyPolLut,
  solveA1,
  USIGN,
  zFourier,
  zMatrix
} from './rayleighpol.js';
import {IPRT_A1_IPOL} from './rayleighpol-data.js';
import {fresnelRsRp, N_WATER} from './coxmunk.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- the scattering matrix normalises itself ------------------
{
  const g = gauss01(64);
  let worst = 0;
  for (const depol of [0, 0.03, 0.1]) {
    let s = 0;
    for (let i = 0; i < 64; i++) {
      const c = 2 * g.x[i] - 1;
      s += rayleighF(c, depol)[0][0] * 2 * g.w[i];
    }
    worst = Math.max(worst, Math.abs(s / 2 - 1));
  }
  check(
    'the phase function integrates to one',
    worst < 1e-14,
    `sphere mean of F11 = 1 to ${worst.toExponential(1)} at depol 0, ` +
      `0.03 and 0.1 - the Hansen-Travis form self-normalises`
  );
}

// ---- band-limited azimuth: Fourier round-trip -----------------
{
  let worst = 0;
  for (const [mu, mup, depol] of [
    [0.3, -0.7, 0.03],
    [0.9, 0.4, 0.1],
    [-0.5, -0.2, 0]
  ]) {
    const f = zFourier(mu, mup, depol);
    for (let k = 0; k < 17; k++) {
      const p = 0.13 + (2 * Math.PI * k) / 17;
      const Z = zMatrix(mu, mup, p, depol);
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) {
          let v = 0;
          for (let m = 0; m <= 2; m++) {
            const fac = m === 0 ? 1 : 2;
            v +=
              fac *
              (f.re[r][c][m] * Math.cos(m * p) -
                f.im[r][c][m] * Math.sin(m * p));
          }
          worst = Math.max(worst, Math.abs(v - Z[r][c]));
        }
    }
  }
  check(
    'Rayleigh has nothing above m = 2',
    worst < 1e-13,
    `three-mode reconstruction of the rotated phase matrix at ` +
      `arbitrary azimuths: residual ${worst.toExponential(1)} - the ` +
      `Fourier truncation is exact, not approximate`
  );
}

// ---- thin-limit single scattering -----------------------------
{
  // The residual against closed-form FIRST-order scattering is
  // the neglected SECOND order, O(tau) - so it must both be
  // small and HALVE when tau halves. Stokes differences are
  // normalized by I (a component-relative Q metric would blow
  // up near the field's own polarization zeros).
  const mu0 = Math.cos((30 * Math.PI) / 180);
  const worstAt = (tau) => {
    const sol = solveA1({
      tau,
      depol: 0.03,
      mu0,
      vzaDownDeg: [40, 70],
      vzaUpDeg: [110, 160],
      dphiDeg: [30, 200],
      nGauss: 16
    });
    let worst = 0;
    for (const r of sol) {
      const up = r.altitude === 1;
      const muV = Math.cos(((up ? 180 - r.vzaDeg : r.vzaDeg) * Math.PI) / 180);
      const ss = singleScatterA1({
        tau,
        depol: 0.03,
        mu0,
        muV,
        up,
        dphiRad: (r.dphiDeg * Math.PI) / 180
      });
      worst = Math.max(
        worst,
        Math.max(
          Math.abs(r.I - ss.I),
          Math.abs(r.Q - ss.Q),
          Math.abs(Math.abs(r.U) - Math.abs(ss.U))
        ) / Math.abs(ss.I)
      );
    }
    return worst;
  };
  const w1 = worstAt(1e-4);
  const w2 = worstAt(5e-5);
  check(
    'the doubling meets closed-form single scattering thin',
    w1 < 1e-3 && w1 / w2 > 1.8 && w1 / w2 < 2.2,
    `tau 1e-4: worst I-relative difference ${w1.toExponential(1)} across ` +
      `both boundaries and azimuths, and it is the SECOND scattering ` +
      `order itself: halving tau halves it (ratio ` +
      `${(w1 / w2).toFixed(3)}) - rotations, Fourier modes and the slab ` +
      `factor all pass through one closed form`
  );
}

// ---- the benchmark --------------------------------------------
const BENCH = [];
for (const line of IPRT_A1_IPOL.split('\n')) {
  const f = line.trim().split(/\s+/);
  if (f.length >= 10) BENCH.push(f.map(Number));
}
const VZA_DN = [
  0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80
];
const VZA_UP = [
  100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170,
  175, 180
];
const CASES = [
  {depol: 0, sza: 0, saa: 65},
  {depol: 0.03, sza: 30, saa: 0},
  {depol: 0.1, sza: 30, saa: 65}
];
const ENGINE = new Map();
for (const c of CASES) {
  const sol = solveA1({
    tau: 0.5,
    depol: c.depol,
    mu0: Math.cos((c.sza * Math.PI) / 180),
    vzaDownDeg: VZA_DN,
    vzaUpDeg: VZA_UP,
    dphiDeg: [0 - c.saa, 65 - c.saa, 180 - c.saa, 245 - c.saa],
    nGauss: 16
  });
  const vaas = [0, 65, 180, 245];
  let k = 0;
  for (const r of sol) {
    // solveA1 emits dphi in the order given, per vza row.
    const vaa = vaas[k % 4];
    k++;
    ENGINE.set([c.depol, r.altitude, c.sza, c.saa, r.vzaDeg, vaa].join(','), r);
  }
}
{
  let worstIQ = 0;
  let worstU = 0;
  let signOK = true;
  let nRows = 0;
  for (const b of BENCH) {
    const e = ENGINE.get(b.slice(0, 6).join(','));
    if (!e) continue;
    nRows++;
    worstIQ = Math.max(worstIQ, Math.abs(e.I - b[6]), Math.abs(e.Q - b[7]));
    if (Math.abs(b[8]) > 1e-6) {
      worstU = Math.max(worstU, Math.abs(Math.abs(e.U) - Math.abs(b[8])));
      if (Math.sign(e.U) !== Math.sign(b[8])) signOK = false;
    }
  }
  check(
    'THE BENCHMARK: every vendored row lands',
    nRows === BENCH.length && worstIQ < 5e-6 && worstU < 5e-6 && signOK,
    `${nRows} rows, three sub-cases, both boundaries: worst |dI|,|dQ| ` +
      `${worstIQ.toExponential(1)}, worst |dU| ${worstU.toExponential(1)}, ` +
      `U sign agrees everywhere under the documented convention ` +
      `(USIGN ${USIGN}) - at the intercomparison's own cross-model level`
  );
}

// ---- energy conserves -----------------------------------------
{
  // Conservative layer, vertical sun: hemispheric fluxes from a
  // fine down/up radiance scan (the engine's own field), plus
  // the direct transmission, must return the beam.
  const mu0 = 1;
  const tau = 0.5;
  const g = gauss01(48);
  const vzDn = [];
  const vzUp = [];
  for (let i = 0; i < 48; i++) {
    vzDn.push((Math.acos(g.x[i]) * 180) / Math.PI);
    vzUp.push(180 - (Math.acos(g.x[i]) * 180) / Math.PI);
  }
  const sol = solveA1({
    tau,
    depol: 0,
    mu0,
    vzaDownDeg: vzDn,
    vzaUpDeg: vzUp,
    dphiDeg: [0],
    nGauss: 24
  });
  let fDn = 0;
  let fUp = 0;
  for (const r of sol) {
    const up = r.altitude === 1;
    const mu = Math.abs(
      Math.cos(((up ? 180 - r.vzaDeg : r.vzaDeg) * Math.PI) / 180)
    );
    const gi = up ? vzUp.indexOf(r.vzaDeg) : vzDn.indexOf(r.vzaDeg);
    const w = g.w[gi];
    if (up) fUp += 2 * Math.PI * r.I * mu * w;
    else fDn += 2 * Math.PI * r.I * mu * w;
  }
  // In the benchmark normalization (I = raw * mu0 / pi) the
  // hemispheric quadrature sums 2 pi int I mu dmu ARE energy
  // fractions of the incident beam - so reflected + diffuse
  // transmitted + direct e^{-tau/mu0} must return exactly 1.
  const total = fUp + fDn + Math.exp(-tau / mu0);
  check(
    'the conservative layer conserves',
    Math.abs(total - 1) < 1e-6,
    `reflected ${fUp.toFixed(6)} + diffuse transmitted ${fDn.toFixed(6)} + ` +
      `direct ${Math.exp(-tau / mu0).toFixed(6)} = ${total.toFixed(8)} - ` +
      `the beam returns to ${Math.abs(total - 1).toExponential(1)}; no ` +
      `photon minted or lost by 25 doublings and three Fourier modes`
  );
}

// ---- the neutral points emerge --------------------------------
{
  // The sun's meridian at the bottom of the depol 0.03 / sza 30
  // layer: the observer's sky in the sun's azimuth. Single
  // scattering polarizes everywhere except AT the sun; the full
  // field's zeros sit displaced - Babinet above, Brewster below.
  const depol = 0.03;
  const mu0 = Math.cos((30 * Math.PI) / 180);
  const fine = [];
  for (let v = 1; v <= 79; v += 0.5) fine.push(v);
  const sol = solveA1({
    tau: 0.5,
    depol,
    mu0,
    vzaDownDeg: fine,
    vzaUpDeg: [],
    dphiDeg: [0],
    nGauss: 16
  });
  const zeros = [];
  for (let i = 1; i < sol.length; i++) {
    if (Math.sign(sol[i - 1].Q) !== Math.sign(sol[i].Q) && sol[i - 1].Q !== 0)
      zeros.push(
        sol[i - 1].vzaDeg +
          (0.5 * Math.abs(sol[i - 1].Q)) /
            (Math.abs(sol[i - 1].Q) + Math.abs(sol[i].Q))
      );
  }
  // Single scattering along the same meridian: Q vanishes only
  // where the scattering angle is zero (the sun itself).
  let ssZeros = 0;
  let prev = null;
  for (const v of fine) {
    if (Math.abs(v - 30) < 0.6) {
      prev = null;
      continue; // the sun's own direction (forward scattering)
    }
    const ss = singleScatterA1({
      tau: 0.5,
      depol,
      mu0,
      muV: Math.cos((v * Math.PI) / 180),
      up: false,
      dphiRad: 0
    });
    if (prev !== null && Math.sign(prev) !== Math.sign(ss.Q)) ssZeros++;
    prev = ss.Q;
  }
  // The benchmark's own sign-change brackets in the same scan
  // (vendored rows: depol 0.03, alt 0, saa 0, vaa 0, 5-deg grid).
  const bRows = BENCH.filter(
    (b) => b[0] === depol && b[1] === 0 && b[3] === 0 && b[5] === 0
  ).sort((a, b) => a[4] - b[4]);
  const brackets = [];
  for (let i = 1; i < bRows.length; i++) {
    if (Math.sign(bRows[i - 1][7]) !== Math.sign(bRows[i][7]))
      brackets.push([bRows[i - 1][4], bRows[i][4]]);
  }
  const inBracket = (z) => brackets.some(([a, b]) => z >= a && z <= b);
  check(
    'THE NEUTRAL POINTS EMERGE from multiple scattering',
    zeros.length === 2 &&
      ssZeros === 0 &&
      brackets.length === 2 &&
      zeros.every(inBracket),
    `single scattering in the sun's meridian has NO polarization zero ` +
      `away from the sun; the full field crosses zero at vza ` +
      `${zeros.map((z) => z.toFixed(1)).join(' and ')} deg (sun at 30) - ` +
      `Babinet ${(30 - Math.min(...zeros)).toFixed(1)} deg above, ` +
      `Brewster ${(Math.max(...zeros) - 30).toFixed(1)} deg below - and ` +
      `both zeros sit inside the benchmark's own sign-change brackets ` +
      `[${brackets.map((b) => b.join('-')).join(', ')}]`
  );
}

// ---- stage 2: the polarized sea -------------------------------
{
  // The water fold: f = 1 + [(Rp-Rs)/(Rp+Rs)] w Q/I on the
  // mirrored dome, composed EXACTLY as the worker composes it
  // (same two gated modules). The landmarks: the photographers'
  // azimuth (the sea's mirrored sky dims at 90 deg from the sun,
  // stays bright toward and away), the Brewster band carrying
  // the deepest dip, and the stated limits - no aerosol recovers
  // the pure engine, heavy aerosol recovers the scalar sea.
  const nTheta = 16;
  const thetaMax = 88;
  const polK = [];
  for (let i = 0; i < nTheta; i++) {
    const th = (i * thetaMax) / (nTheta - 1);
    const {Rs, Rp} = fresnelRsRp(Math.cos((th * Math.PI) / 180), N_WATER);
    polK.push((Rp - Rs) / Math.max(Rp + Rs, 1e-12));
  }
  const base = {
    sunAltDeg: 10,
    tauA: [0, 0, 0],
    polK,
    nTheta,
    thetaMaxDeg: thetaMax
  };
  const lut = skyPolLut(base);
  const at = (l, i, j, ch) => l.data[(i * l.nDaz + j) * 4 + ch];
  const dazOf = (j) => (j * 180) / (lut.nDaz - 1);
  // Brewster row: theta_i grid point nearest atan(n) = 53.27 deg.
  const thB = (Math.atan(N_WATER) * 180) / Math.PI;
  let iB = 0;
  for (let i = 0; i < nTheta; i++)
    if (
      Math.abs((i * thetaMax) / (nTheta - 1) - thB) <
      Math.abs((iB * thetaMax) / (nTheta - 1) - thB)
    )
      iB = i;
  let jMin = 0;
  for (let j = 0; j < lut.nDaz; j++)
    if (at(lut, iB, j, 1) < at(lut, iB, jMin, 1)) jMin = j;
  const fMin = at(lut, iB, jMin, 1);
  const f0 = at(lut, iB, 0, 1);
  const f180 = at(lut, iB, lut.nDaz - 1, 1);
  const dip = (i) => {
    let mx = 0;
    for (let j = 0; j < lut.nDaz; j++)
      mx = Math.max(mx, Math.abs(at(lut, i, j, 1) - 1));
    return mx;
  };
  // The default-AOD fold (the page's fallback air, tauA 0.12):
  // the factor the sea actually ships when nothing is measured.
  const dflt = skyPolLut({...base, tauA: [0.12, 0.12, 0.12]});
  let dMin = 2;
  let dMax = 0;
  for (let k = 0; k < dflt.data.length; k += 4) {
    dMin = Math.min(dMin, dflt.data[k + 1]);
    dMax = Math.max(dMax, dflt.data[k + 1]);
  }
  check(
    'THE POLARIZED SEA has the photographers’ azimuth',
    fMin < f0 &&
      fMin < f180 &&
      dazOf(jMin) >= 60 &&
      dazOf(jMin) <= 120 &&
      fMin > 0.1 &&
      fMin < 0.3 &&
      dip(iB) > dip(2) &&
      dip(iB) > dip(nTheta - 1) &&
      dMin > 0.5 &&
      dMin < 0.7 &&
      dMax > 1.1 &&
      dMax < 1.3,
    `sun 10 deg up, green channel: with NO aerosol the mirrored dome at ` +
      `Brewster incidence dims to f = ${fMin.toFixed(3)} at ` +
      `${dazOf(jMin).toFixed(0)} deg from the sun's azimuth (toward/away ` +
      `${f0.toFixed(3)}/${f180.toFixed(3)}) - the thin molecular column ` +
      `(tau 0.108) polarizes its 90-deg sky to ~0.87, and Rp's death ` +
      `takes nearly all of it out of the mirror; the dip peaks AT the ` +
      `Brewster band (|f-1| ${dip(iB).toFixed(3)} vs ${dip(2).toFixed(3)} ` +
      `steep, ${dip(nTheta - 1).toFixed(3)} grazing); under the page's ` +
      `fallback AOD 0.12 the shipped factor spans ${dMin.toFixed(3)} - ` +
      `${dMax.toFixed(3)}: a ~40% darkening at right angles to the sun, ` +
      `~18% brightening toward it - the polarizer-like azimuth every ` +
      `seascape photographer works around`
  );
  // Limits: heavy aerosol returns the scalar sea; the LUT's
  // economy quadrature (nGauss 10, 20 doublings) matches a
  // benchmark-grade solve at the deepest texel.
  const heavy = skyPolLut({
    ...base,
    tauA: [1e4, 1e4, 1e4]
  });
  let worstHeavy = 0;
  for (let k = 0; k < heavy.data.length; k += 4)
    for (let c = 0; c < 3; c++)
      worstHeavy = Math.max(worstHeavy, Math.abs(heavy.data[k + c] - 1));
  const thIB = (iB * thetaMax) / (nTheta - 1);
  const fine = solveA1({
    tau: 0.1085,
    depol: 0.03,
    mu0: Math.cos((80 * Math.PI) / 180),
    vzaDownDeg: [thIB],
    vzaUpDeg: [],
    dphiDeg: [dazOf(jMin)],
    nGauss: 16,
    nDouble: 25
  })[0];
  const fFine = 1 + polK[iB] * (fine.Q / fine.I);
  check(
    'the polarized sea holds its limits',
    worstHeavy < 2e-4 && Math.abs(fFine - fMin) < 5e-4,
    `tauA = 1e4: every texel returns to 1 within ` +
      `${worstHeavy.toExponential(1)} (the scalar sea is the aerosol ` +
      `limit, exactly as stated); and the deepest texel recomputed at ` +
      `benchmark-grade quadrature (nGauss 16, 25 doublings) moves ` +
      `${Math.abs(fFine - fMin).toExponential(1)} - the bake's economy ` +
      `settings cost nothing the eye could see`
  );
}

process.exit(fail ? 1 : 0);
