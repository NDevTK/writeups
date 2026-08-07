// Reference gate for the atmospheric-optics LUTs
// (node optics-reference.mjs). The physics lives in the library
// modules (rainbow.js - Airy/Descartes/Marshall-Palmer on
// Daimon-Masumura water; halos.js - Warren-Brandt ice, Bravais
// parhelia; each with its own gate) and optics-lut.js COMPOSES
// them into the dome's LUTs with the Monte-Carlo halo histogram
// and the limb-darkened source convolution. This gate holds the
// composition:
//  - halo inner edges at the Warren-Brandt minimum deviations
//    (21.63 / 21.86 / 22.34 deg), red inside blue
//  - the bow LUT: Airy primary near 42 deg with the colour
//    order, the secondary reversed, Alexander's dark band
//    between, the secondary/primary ratio in the Fresnel range -
//    AND the supernumerary fringes the old geometric histogram
//    could not carry, tightening with drop size
//  - the dog LUT: alive and outside the halo at 25 deg
//    elevation, red toward the source, EMPTY past the Bravais
//    cutoff
import {buildBowLUT, buildDogLUT, buildHaloLUT} from './optics-lut.js';
import {bravais, prismDmin, ICE_N, PRISM_60} from './halos.js';
import {
  bowGeometric,
  bowSlab,
  bowWindowEnergy,
  mpLambda,
  mpSigmaExt,
  MP_N0,
  RGB_UM,
  waterIndex
} from './rainbow.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const halo = buildHaloLUT();
const bow = buildBowLUT(256, 0.63); // ~5 mm/h Marshall-Palmer drop

function edgeAndPeak(lut, c) {
  const {data, bins, thMinDeg, thMaxDeg} = lut;
  const dth = (thMaxDeg - thMinDeg) / bins;
  let peakI = 0;
  let peakV = 0;
  for (let i = 0; i < bins; i++) {
    const v = data[i * 4 + c];
    if (v > peakV) {
      peakV = v;
      peakI = i;
    }
  }
  // Threshold relative to the channel peak: BOTH LUTs are
  // ABSOLUTE now (sr^-1 per unit geometric-interaction depth) -
  // 2% of peak reads the same edge on both.
  let first = -1;
  for (let i = 0; i < bins; i++) {
    if (data[i * 4 + c] > 0.02 * peakV) {
      first = i;
      break;
    }
  }
  return {
    edge: thMinDeg + (first + 0.5) * dth,
    peak: thMinDeg + (peakI + 0.5) * dth,
    peakV
  };
}

{
  // Halo inner edges: the Monte-Carlo histogram's 2%-threshold
  // edge sits at the Warren-Brandt minimum deviation per channel
  // (within the bin width + solar smear), red inside blue.
  const DEG = 180 / Math.PI;
  const r = edgeAndPeak(halo, 0);
  const g = edgeAndPeak(halo, 1);
  const b = edgeAndPeak(halo, 2);
  const want = ICE_N.map((n) => prismDmin(n, PRISM_60) * DEG);
  const ok =
    Math.abs(r.edge - want[0]) < 0.45 &&
    Math.abs(g.edge - want[1]) < 0.45 &&
    Math.abs(b.edge - want[2]) < 0.45 &&
    r.edge < b.edge &&
    r.peak < b.peak;
  check(
    'halo inner edges',
    ok,
    `red ${r.edge.toFixed(2)} / green ${g.edge.toFixed(2)} / blue ${b.edge.toFixed(2)} deg against the Warren-Brandt minima ${want.map((w) => w.toFixed(2)).join('/')} - red inside blue`
  );
}

{
  // The ABSOLUTE accounting that retires the halo's display gain
  // (deterministic seed - these are exact facts of the traced
  // ensemble, green channel): the energy books close (binned +
  // low + high + lost = accepted), the parallel-face pass-through
  // (<15 deg) outweighs the whole histogram window, the untraced
  // remainder (Fresnel reflections + TIR continuations the
  // 2-refraction trace does not follow) stays under 60% and is
  // STATED, and the 22-degree window's share of the geometric-
  // interaction unit is ~8.5% at peak ~0.83/sr. (Re-pinned by the
  // sundog pass's basal-area audit: the basal faces had entered
  // the flux rejection at HALF their 3 sqrt(3)/2 area, so side
  // transits were over-weighted - the shipped ring read share
  // 0.111 at peak 1.15/sr, ~1.4x too bright, and the 46/22 share
  // ratio was 0.33 where the corrected books say 0.43.) The
  // convolved LUT's own integral reproduces binned/accepted - the
  // sr^-1 conversion is self-consistent.
  const a = halo.accounting;
  const A = a.accepted[1];
  const closure =
    Math.abs(a.binnedT[1] + a.lowT[1] + a.highT[1] + a.lostT[1] - A) / A;
  const dth = ((halo.thMaxDeg - halo.thMinDeg) * (Math.PI / 180)) / halo.bins;
  let integ = 0;
  for (let i = 0; i < halo.bins; i++) {
    const th = (halo.thMinDeg * Math.PI) / 180 + (i + 0.5) * dth;
    integ += halo.data[i * 4 + 1] * 2 * Math.PI * Math.sin(th) * dth;
  }
  const binnedFrac = a.binnedT[1] / A;
  const ok =
    closure < 1e-9 &&
    a.lowT[1] > a.binnedT[1] &&
    a.lostT[1] / A < 0.6 &&
    Math.abs(halo.share22 - 0.0854) < 0.008 &&
    Math.abs(halo.peakAbs - 0.828) < 0.08 &&
    Math.abs(integ / binnedFrac - 1) < 0.02 &&
    halo.share46 / halo.share22 > 0.35 &&
    halo.share46 / halo.share22 < 0.5;
  check(
    'halo absolute accounting',
    ok,
    `books close to ${closure.toExponential(1)}; pass-through ${(a.lowT[1] / A).toFixed(3)} > binned ${binnedFrac.toFixed(3)}; lost (untraced refl/TIR) ${(a.lostT[1] / A).toFixed(3)}; 22-deg share ${halo.share22.toFixed(4)} at peak ${halo.peakAbs.toFixed(3)}/sr; LUT integral ${integ.toFixed(4)} = binned share (${(integ / binnedFrac).toFixed(4)}x); 46/22 share ratio ${(halo.share46 / halo.share22).toFixed(3)}`
  );
}

function bowStats(c, lo, hi) {
  const {data, bins, thMinDeg, thMaxDeg} = bow;
  const dth = (thMaxDeg - thMinDeg) / bins;
  let peakI = 0;
  let peakV = 0;
  for (let i = 0; i < bins; i++) {
    const th = thMinDeg + (i + 0.5) * dth;
    if (th < lo || th > hi) continue;
    const v = data[i * 4 + c];
    if (v > peakV) {
      peakV = v;
      peakI = i;
    }
  }
  return {peak: thMinDeg + (peakI + 0.5) * dth, peakV};
}

{
  // The bow: Airy primary near 42 with blue INSIDE red, the
  // secondary reversed near 51, Alexander's dark band between
  // them, the ratio in the Fresnel range.
  const rp = bowStats(0, 38, 45);
  const bp = bowStats(2, 38, 45);
  const rs = bowStats(0, 46, 56);
  const bs = bowStats(2, 46, 56);
  let band = 0;
  let cnt = 0;
  const {data, bins, thMinDeg, thMaxDeg} = bow;
  const dth = (thMaxDeg - thMinDeg) / bins;
  for (let i = 0; i < bins; i++) {
    const th = thMinDeg + (i + 0.5) * dth;
    if (th < 44.5 || th > 48.5) continue;
    band += Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    cnt++;
  }
  band /= cnt;
  const ok =
    rp.peak > 41.5 &&
    rp.peak < 42.6 &&
    bp.peak < rp.peak - 0.8 &&
    rs.peak > 49.5 &&
    rs.peak < 53 &&
    bs.peak > rs.peak + 0.8 &&
    band < 0.05 * rp.peakV &&
    rs.peakV / rp.peakV > 0.05 &&
    rs.peakV / rp.peakV < 0.25;
  check(
    'the bow LUT',
    ok,
    `red primary ${rp.peak.toFixed(2)} deg (blue ${bp.peak.toFixed(2)}, inside); secondary ${rs.peak.toFixed(2)} (blue ${bs.peak.toFixed(2)}, reversed); Alexander's band ${((band / rp.peakV) * 100).toFixed(1)}% of peak; secondary/primary ${(rs.peakV / rp.peakV).toFixed(3)} - the classic tenth, now from energy alone`
  );
}

{
  // The Airy upgrade the geometric histogram could not carry:
  // supernumerary fringes inside the primary, tightening as the
  // drop grows - count the green-channel local maxima below the
  // primary peak in drizzle vs downpour LUTs.
  const fringes = (aMm) => {
    const l = buildBowLUT(256, aMm);
    const dth = (l.thMaxDeg - l.thMinDeg) / l.bins;
    const g = (i) => l.data[i * 4 + 1];
    let pi = 0;
    for (let i = 0; i < l.bins; i++) {
      const th = l.thMinDeg + (i + 0.5) * dth;
      if (th < 45 && g(i) > g(pi)) pi = i;
    }
    let count = 0;
    let firstGap = null;
    for (let i = pi - 2; i > 1; i--) {
      if (g(i) > g(i - 1) && g(i) > g(i + 1) && g(i) > 0.02 * l.peakAbs) {
        count++;
        if (firstGap === null) firstGap = (pi - i) * dth;
      }
    }
    return {count, firstGap};
  };
  const drizzle = fringes(0.45); // 1 mm/h MP drop
  const pour = fringes(0.73); // 10 mm/h
  const ok =
    drizzle.count >= 1 && pour.count >= 1 && drizzle.firstGap > pour.firstGap;
  check(
    'supernumerary fringes',
    ok,
    `drizzle drop: ${drizzle.count} fringes, first ${drizzle.firstGap.toFixed(2)} deg inside; downpour: first ${pour.firstGap.toFixed(2)} deg - tighter, the (ka)^(-2/3) law through the LUT`
  );
}

{
  // The dog LUT: alive at 25 deg elevation with its peak OUTSIDE
  // the halo edge (the Bravais migration), red toward the
  // source; empty past the cutoff.
  const DEG = 180 / Math.PI;
  const d25 = buildDogLUT((25 * Math.PI) / 180);
  const dead = buildDogLUT((65 * Math.PI) / 180);
  const peakAz = (c) => {
    let bi = 0;
    for (let i = 0; i < d25.bins; i++) {
      if (d25.data[i * 4 + c] > d25.data[bi * 4 + c]) bi = i;
    }
    return (
      d25.azMinDeg + ((bi + 0.5) * (d25.azMaxDeg - d25.azMinDeg)) / d25.bins
    );
  };
  const haloEdge = prismDmin(ICE_N[0], PRISM_60) * DEG;
  // The drawn caustic must sit at the BRAVAIS AZIMUTH - vertical
  // faces conserve the vertical direction cosine, so the whole
  // deflection is azimuthal (the plate Monte Carlo's independent
  // trace arbitrated this; the old great-circle mapping drew the
  // dog ~2.8 deg too far out at this altitude).
  const wantAz =
    prismDmin(bravais(ICE_N[0], (25 * Math.PI) / 180), PRISM_60) * DEG;
  // Unit azimuth integral per channel - the absolute scale rides
  // the amp (PLATE_ALPHA x share x Gaussian peak), so the LUT
  // must carry exactly one unit of azimuthal distribution.
  const dAzR = (((d25.azMaxDeg - d25.azMinDeg) / d25.bins) * Math.PI) / 180;
  const integ = [0, 0, 0];
  for (let i = 0; i < d25.bins; i++)
    for (let c = 0; c < 3; c++) integ[c] += d25.data[i * 4 + c] * dAzR;
  const ok =
    d25.any &&
    peakAz(0) > haloEdge + 4 &&
    Math.abs(peakAz(0) - wantAz) < 0.5 &&
    peakAz(2) > peakAz(0) &&
    integ.every((v) => Math.abs(v - 1) < 1e-3) &&
    !dead.any &&
    dead.data.every((v, i) => i % 4 === 3 || v === 0);
  check(
    'the dog LUT',
    ok,
    `at 25 deg the red dog sits ${peakAz(0).toFixed(1)} deg out (Bravais azimuth ${wantAz.toFixed(1)}, halo edge ${haloEdge.toFixed(1)}), blue at ${peakAz(2).toFixed(1)} (red toward the source); unit integrals [${integ.map((v) => v.toFixed(4)).join(', ')}]; at 65 deg the LUT is empty`
  );
}

{
  // Dog WIDTH: the landmark that was missing when the profile was
  // solar-smeared twice (caustic()'s 5-point disc smear AND the
  // limb-darkened LUT convolution - dogs came out ~sqrt(2) wide
  // and no gate could see it). The profile now arrives RAW
  // (halos.js causticBin) and the disc enters exactly once, so
  // the red half-maximum width at 25 deg elevation sits near
  // 0.72 deg, and doubling the source disc must widen it by well
  // over a quarter - a reintroduced double smear lands ~1.0 deg
  // and fails the band; a dropped convolution lands ~0.4 and
  // fails it too.
  const h = (25 * Math.PI) / 180;
  const fwhm = (lut, c) => {
    const dAz = (lut.azMaxDeg - lut.azMinDeg) / lut.bins;
    let pV = 0;
    let pI = 0;
    for (let i = 0; i < lut.bins; i++) {
      const v = lut.data[i * 4 + c];
      if (v > pV) {
        pV = v;
        pI = i;
      }
    }
    let lo = pI;
    let hi = pI;
    while (lo > 0 && lut.data[(lo - 1) * 4 + c] > pV / 2) lo--;
    while (hi < lut.bins - 1 && lut.data[(hi + 1) * 4 + c] > pV / 2) hi++;
    return (hi - lo + 1) * dAz;
  };
  const one = fwhm(buildDogLUT(h), 0);
  const twice = fwhm(buildDogLUT(h, 256, 2 * 4.6524e-3), 0);
  check(
    'single solar convolution',
    one > 0.6 && one < 0.85 && twice > one * 1.3,
    `red dog FWHM ${one.toFixed(2)} deg at the true disc; a doubled source disc widens it to ${twice.toFixed(2)} - the width finally answers to the radius, once`
  );
}

{
  // Marshall-Palmer extinction, closed vs quadrature: sigma =
  // pi N0 / Lambda^3 x 1e-6 m^-1 (Q = 2, the extinction-paradox
  // asymptote at x ~ 10^4). Printed constants N0 = 8000 m^-3
  // mm^-1, Lambda = 4.1 R^-0.21; at 5 mm/h the column is ~1e-3
  // m^-1 - optical depth 1 per kilometre of shower. R <= 0 is
  // exactly 0: no rain, no bow.
  let ok = MP_N0 === 8000 && mpSigmaExt(0) === 0 && mpSigmaExt(-3) === 0;
  let detail = '';
  for (const R of [1, 5, 20]) {
    const L = mpLambda(R);
    let q = 0;
    const M = 100000;
    const Dmax = 14;
    for (let i = 0; i < M; i++) {
      const D = ((i + 0.5) / M) * Dmax;
      q += D * D * MP_N0 * Math.exp(-L * D) * (Dmax / M);
    }
    const quad = 2 * (Math.PI / 4) * q * 1e-6;
    if (!(Math.abs(mpSigmaExt(R) / quad - 1) < 1e-4)) ok = false;
    detail += `R${R}: ${mpSigmaExt(R).toExponential(2)}/m; `;
  }
  ok = ok && Math.abs(mpSigmaExt(5) * 1000 - 1.0) < 0.15;
  check(
    'Marshall-Palmer extinction closed form',
    ok,
    detail + 'closed = quadrature; tau ~ 1/km at 5 mm/h; fails closed dry'
  );
}

{
  // The energy frame that makes the bow LUT absolute: the window
  // energy in the impact-parameter domain equals the solid-angle
  // integral of the geometric mapping (change of variables) on a
  // sub-window clear of the caustic singularity; the default
  // quadrature matches a 10x finer pass; and the k-bow energies
  // land where the Fresnel chain puts them (secondary/primary
  // window ratio ~ 0.17 of the geometric energy - the drawn peak
  // ratio is smaller still because the secondary spreads wider).
  const n = waterIndex(RGB_UM[1]);
  const sub = [(36 * Math.PI) / 180, (40 * Math.PI) / 180];
  let eTheta = 0;
  const M = 20000;
  for (let i = 0; i < M; i++) {
    const th = sub[0] + ((i + 0.5) / M) * (sub[1] - sub[0]);
    eTheta +=
      bowGeometric(n, 1, th) *
      2 *
      Math.PI *
      Math.sin(th) *
      ((sub[1] - sub[0]) / M);
  }
  const eX = bowWindowEnergy(n, 1, sub[0], sub[1]);
  const w = [(35 * Math.PI) / 180, (60 * Math.PI) / 180];
  const e1 = bowWindowEnergy(n, 1, w[0], w[1]);
  const e1f = bowWindowEnergy(n, 1, w[0], w[1], 200000);
  const e2 = bowWindowEnergy(n, 2, w[0], w[1]);
  const ok =
    Math.abs(eTheta / eX - 1) < 5e-3 &&
    Math.abs(e1 / e1f - 1) < 1e-3 &&
    e2 / e1 > 0.12 &&
    e2 / e1 < 0.22;
  check(
    'bow window energy: two domains, one integral',
    ok,
    `sub-window theta/x ${(eTheta / eX).toFixed(4)}; default/fine ${(e1 / e1f).toFixed(5)}; window energies k1 ${e1.toFixed(4)} k2 ${e2.toFixed(4)} (ratio ${(e2 / e1).toFixed(3)})`
  );
}

{
  // The absolute scale holds pointwise, not just in the integral:
  // away from the caustic the FRINGE-AVERAGED Airy curve must ride
  // the geometric-optics mapping (the classical asymptotic match).
  // Averaged over +-1 deg at 39.5 deg (several fringes inside the
  // primary, secondary negligible there), green channel, on the
  // UNCONVOLVED profile via a fine rebuild - here approximated by
  // the drawn LUT itself (the disc kernel is 0.27 deg wide, well
  // under the averaging window).
  const l = buildBowLUT(512, 0.63);
  const dth = (l.thMaxDeg - l.thMinDeg) / l.bins;
  const n = waterIndex(RGB_UM[1]);
  const avg = (c) => {
    let s = 0;
    let cnt = 0;
    for (let i = 0; i < l.bins; i++) {
      const th = l.thMinDeg + (i + 0.5) * dth;
      if (th < 38.5 || th > 40.5) continue;
      s += l.data[i * 4 + c];
      cnt++;
    }
    return s / cnt;
  };
  let gGeo = 0;
  const M = 6000;
  for (let i = 0; i < M; i++) {
    const th = ((38.5 + ((i + 0.5) / M) * 2) * Math.PI) / 180;
    gGeo += bowGeometric(n, 1, th) / M;
  }
  const ratio = avg(1) / gGeo;
  check(
    'Airy rides the geometric mapping away from the caustic',
    Math.abs(ratio - 1) < 0.12,
    `fringe-averaged LUT / geometric = ${ratio.toFixed(3)} over 38.5-40.5 deg (green)`
  );
}

{
  // The shaft's closed slab law against direct quadrature of the
  // two-leg integral, across the angle grid: upward rays that
  // exit the layer top, the removable point alpha = h, rays
  // ABOVE the source, grazing and downward rays (untruncated
  // tail), thin and thick shafts. And the closed points: no rain
  // -> 0; sigma H -> 0 -> 0.
  const quad = (sigH, sinH, sinA) => {
    const tauT = sigH / Math.min(Math.max(sinA, 1e-4), 1);
    const T = Math.min(tauT, 60);
    const M = 200000;
    let s = 0;
    for (let i = 0; i < M; i++) {
      const t = ((i + 0.5) / M) * T;
      s +=
        0.5 *
        Math.exp(-t) *
        Math.exp(-(sigH - t * sinA) / Math.max(sinH, 1e-3)) *
        (T / M);
    }
    return s;
  };
  let ok = bowSlab(0, 0.5, 0.3) === 0 && bowSlab(-1, 0.5, 0.3) === 0;
  let worst = 0;
  for (const sigH of [0.1, 1, 3]) {
    for (const [h, a] of [
      [0.5, 0.25],
      [0.5, 0.5001],
      [0.5, 0.9],
      [0.17, 0.02],
      [0.17, -0.2],
      [0.7, 0.0001]
    ]) {
      const c = bowSlab(sigH, h, a);
      const q = quad(sigH, h, a);
      const rel = Math.abs(c / Math.max(q, 1e-300) - 1);
      worst = Math.max(worst, rel);
      if (!(rel < 2e-3)) ok = false;
    }
  }
  check(
    'two-leg slab: closed form = quadrature',
    ok,
    `worst rel ${worst.toExponential(1)} over sigH x (h, alpha) grid incl. removable point, above-source and downward rays; dry -> exactly 0`
  );
}

process.exit(fail ? 1 : 0);
