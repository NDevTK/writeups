// Reference gate for rainbow.js (node rainbow-reference.mjs):
//  - the Daimon-Masumura dispersion at its checkpoints (sodium D
//    near 1.3330; monotone normal dispersion; Adam's own red and
//    violet anchors within the old-table tolerance)
//  - Descartes closed forms: the review's own numbers - N=1.3318
//    -> 42.3 deg, N=1.3435 -> 40.6 deg, n=4/3 secondary -> 51
//    deg; the extremum identity D'(x0) = 0 to machine precision
//  - the Airy function against Abramowitz & Stegun: Ai(0) and
//    Ai'(0) from the Gamma constants, Ai(1), the first zero at
//    -2.33810741, the primary-peak abscissa (first zero of Ai'),
//    and the series/asymptotic seam
//  - Marshall-Palmer drops: Lambda(1) = 4.1 exactly, drops grow
//    with rain rate
//  - THE BOW: red primary peaks just inside 42 deg, blue inside
//    red (colour order), the secondary reversed near 51 deg,
//    Alexander's dark band between them, supernumeraries
//    TIGHTENING as the rain hardens (spacing ~ a^(-2/3)), the
//    secondary at the Fresnel-predicted fraction of the primary
import {
  airy,
  bowFresnel,
  descartes,
  mpDropRadiusMm,
  mpLambda,
  rainbowProfile,
  waterIndex
} from './rainbow.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const DEG = 180 / Math.PI;

{
  // Dispersion: sodium D near the handbook 1.3330 (we sit at
  // 21.5 C, a whisker under the 20 C tables); normal dispersion
  // (n falls with wavelength) across the visible; Adam's red and
  // violet anchors (older 20 C table values) within 2e-3.
  const nD = waterIndex(0.5893);
  const ok =
    nD > 1.3325 &&
    nD < 1.3335 &&
    waterIndex(0.44) > waterIndex(0.55) &&
    waterIndex(0.55) > waterIndex(0.68) &&
    Math.abs(waterIndex(0.6563) - 1.3318) < 2e-3 &&
    Math.abs(waterIndex(0.4047) - 1.3435) < 2e-3;
  check(
    'Daimon-Masumura dispersion',
    ok,
    `n(589.3 nm) = ${nD.toFixed(5)} (handbook 1.3330); normal dispersion over RGB; Adam's 6563/4047 A anchors matched to ${Math.max(Math.abs(waterIndex(0.6563) - 1.3318), Math.abs(waterIndex(0.4047) - 1.3435)).toExponential(1)}`
  );
}

{
  // Descartes at the review's own numbers, and the extremum
  // identity: D'(x0) = 2/sqrt(1-x0^2) - 2(k+1)/sqrt(N^2-x0^2)
  // vanishes at the closed-form x0.
  const red = descartes(1.3318, 1);
  const violet = descartes(1.3435, 1);
  const sec = descartes(4 / 3, 2);
  const dp = (n, k, x) =>
    2 / Math.sqrt(1 - x * x) - (2 * (k + 1)) / Math.sqrt(n * n - x * x);
  const ok =
    Math.abs(red.gamma * DEG - 42.3) < 0.05 &&
    Math.abs(violet.gamma * DEG - 40.6) < 0.05 &&
    Math.abs(sec.gamma * DEG - 51) < 0.5 &&
    Math.abs(dp(1.3318, 1, red.x0)) < 1e-12 &&
    Math.abs(dp(4 / 3, 2, sec.x0)) < 1e-12 &&
    red.dpp > 0 &&
    red.gamma > violet.gamma;
  check(
    'Descartes closed forms',
    ok,
    `N = 1.3318 -> ${(red.gamma * DEG).toFixed(2)} deg, N = 1.3435 -> ${(violet.gamma * DEG).toFixed(2)} deg, n = 4/3 secondary -> ${(sec.gamma * DEG).toFixed(1)} deg - the review's own numbers; D'(x0) = 0 to 1e-12 at the closed form`
  );
}

{
  // Airy against Abramowitz & Stegun: Ai(0) = 0.35502805,
  // Ai(1) = 0.13529242, the first zero at -2.33810741, the first
  // maximum of Ai(-xi) at xi = 1.01879297 (the zero of Ai'), and
  // the series meeting the asymptotics at the seam.
  const peakXi = 1.01879297;
  const dAi = (z) => (airy(z + 1e-6) - airy(z - 1e-6)) / 2e-6;
  const seam = Math.abs(airy(-5.999) - airy(-6.001));
  const ok =
    Math.abs(airy(0) - 0.3550280539) < 1e-9 &&
    Math.abs(airy(1) - 0.1352924163) < 1e-9 &&
    Math.abs(airy(-2.33810741)) < 1e-8 &&
    Math.abs(dAi(-peakXi)) < 1e-6 &&
    seam < 2e-3 &&
    airy(4) < 1e-3;
  check(
    'Airy function (A&S)',
    ok,
    `Ai(0) = ${airy(0).toFixed(10)}, Ai(1) = ${airy(1).toFixed(10)}, Ai(-2.33810741) = ${airy(-2.33810741).toExponential(1)} (the first zero); Ai' vanishes at -1.01879297 (the primary peak); series/asymptotic seam gap ${seam.toExponential(1)}`
  );
}

{
  // Marshall-Palmer: Lambda(1 mm/h) = 4.1 mm^-1 exactly (the
  // paper's fit), the median-volume drop D0 = 3.67/Lambda, drops
  // growing with rain rate.
  const ok =
    Math.abs(mpLambda(1) - 4.1) < 1e-12 &&
    Math.abs(mpDropRadiusMm(1) - 3.67 / 4.1 / 2) < 1e-12 &&
    mpDropRadiusMm(10) > mpDropRadiusMm(1) &&
    mpDropRadiusMm(5) > 0.4 &&
    mpDropRadiusMm(5) < 0.9;
  check(
    'Marshall-Palmer drops',
    ok,
    `Lambda(1) = 4.1 mm^-1 exactly; median-volume radius ${mpDropRadiusMm(1).toFixed(2)} mm at 1 mm/h -> ${mpDropRadiusMm(10).toFixed(2)} mm at 10 - harder rain, bigger drops`
  );
}

{
  // THE BOW at 5 mm/h: peak positions per channel, colour order,
  // the reversed secondary, Alexander's dark band, and the
  // Fresnel-predicted secondary strength.
  const p = rainbowProfile(5);
  const g = (i) => (p.g0 + ((p.g1 - p.g0) * i) / (p.n - 1)) * DEG;
  const peakIn = (ch, lo, hi) => {
    let bi = -1;
    let bv = -1;
    for (let i = 0; i < p.n; i++) {
      const gg = g(i);
      if (gg < lo || gg > hi) continue;
      if (p.data[3 * i + ch] > bv) {
        bv = p.data[3 * i + ch];
        bi = i;
      }
    }
    return {g: g(bi), v: bv};
  };
  const r1 = peakIn(0, 38, 45);
  const b1 = peakIn(2, 38, 45);
  const r2 = peakIn(0, 48, 54);
  const b2 = peakIn(2, 48, 54);
  let band = 0;
  let bn = 0;
  for (let i = 0; i < p.n; i++) {
    const gg = g(i);
    if (gg > 44.5 && gg < 48.5) {
      band += Math.max(p.data[3 * i], p.data[3 * i + 1], p.data[3 * i + 2]);
      bn++;
    }
  }
  band /= bn;
  const fr = bowFresnel(waterIndex(0.68), 2) / bowFresnel(waterIndex(0.68), 1);
  const ok =
    r1.g > 41.5 &&
    r1.g < 42.5 &&
    b1.g < r1.g - 0.8 &&
    r2.g > 49.5 &&
    r2.g < 52.5 &&
    b2.g > r2.g + 0.8 &&
    band < 0.05 &&
    r2.v / r1.v > 0.15 &&
    r2.v / r1.v < 0.7 &&
    fr > 0.25 &&
    fr < 0.45;
  check(
    'the bow itself',
    ok,
    `red primary ${r1.g.toFixed(2)} deg, blue ${b1.g.toFixed(2)} (inside - the colour order); secondary red ${r2.g.toFixed(2)}, blue ${b2.g.toFixed(2)} (reversed); Alexander's band at ${(band * 100).toFixed(1)}% of peak; secondary/primary ${(r2.v / r1.v).toFixed(2)} against the Fresnel path ratio ${fr.toFixed(2)}`
  );
}

{
  // Supernumeraries: Airy's signature. The spacing between the
  // primary peak and the first supernumerary shrinks as drops
  // grow - fine drizzle spreads the fringes, a downpour packs
  // them (xi scale ~ (k a)^(2/3)).
  const spacing = (R) => {
    const p = rainbowProfile(R);
    const g = (i) => (p.g0 + ((p.g1 - p.g0) * i) / (p.n - 1)) * DEG;
    const green = (i) => p.data[3 * i + 1];
    // walk down from the primary green peak toward smaller gamma,
    // find the next local max
    let pi = 0;
    for (let i = 1; i < p.n; i++) if (green(i) > green(pi)) pi = i;
    let i = pi - 1;
    while (i > 1 && green(i) >= green(i - 1)) i--;
    while (i > 1 && green(i) <= green(i - 1)) i--;
    return g(pi) - g(i);
  };
  const s1 = spacing(0.5);
  const s10 = spacing(10);
  const ok = s1 > s10 && s10 > 0.15 && s1 < 3;
  check(
    'supernumerary fringes',
    ok,
    `first fringe sits ${s1.toFixed(2)} deg inside the bow in drizzle (0.5 mm/h) and ${s10.toFixed(2)} deg in a downpour (10 mm/h) - Airy's drop-size signature, invisible to geometric optics`
  );
}

process.exit(fail ? 1 : 0);
