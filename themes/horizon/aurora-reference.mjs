// Reference printer for the physical aurora (node
// aurora-reference.mjs). The chain lives once in aurora-lut.js; this
// checks it against published landmarks:
//  - CIRA-72 atmosphere self-consistency (mass density at 100/200 km
//    near the USSA76 values 5.6e-10 / 2.5e-13 g/cm^3)
//  - Fang 2010: f(y) integrates to ~1 over y (energy conservation of
//    the fitted dissipation) and ionization peak altitudes sweep
//    down with energy - ~230 km at 0.1 keV to ~105 km at 10 keV
//    (their figure 2 behaviour)
//  - O(1D) quenching kills 630.0 nm below ~200 km and the
//    red/green column ratio grows as precipitation softens
//  - line colors from the CIE fits: 557.7 green, 630.0 red,
//    427.8 violet-blue
//  - Whiter et al. 2023 measured peak altitudes: green near its
//    114.84 km climatological mean with blue above it, the
//    blue-green split growing as precipitation softens
import {
  ATMO_ROWS,
  buildAuroraLUT,
  fangF,
  qMaxwellian,
  quench1D,
  wavelengthToLinearSRGB,
  Z_MAX,
  Z_MIN
} from './aurora-lut.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  const r100 = ATMO_ROWS.find((r) => r.z === 100);
  const r200 = ATMO_ROWS.find((r) => r.z === 200);
  console.log(
    `REF atmo rho(100) = ${r100.rho.toExponential(2)} g/cm^3 (USSA76 5.60e-10),` +
      ` rho(200) = ${r200.rho.toExponential(2)} (2.54e-13)`
  );
  console.log(
    `REF atmo column(100) = ${r100.col.toExponential(3)} g/cm^2,` +
      ` H(120) = ${(ATMO_ROWS.find((r) => r.z === 120).H / 1e5).toFixed(1)} km`
  );
}

for (const E of [1, 10]) {
  // integral of f over the FITTED y domain, at auroral energies:
  // below 1 because isotropic incidence loses a real
  // backscattered-albedo fraction (largest for soft electrons),
  // approaching ~1 for hard ones.
  let I = 0;
  const M = 4000;
  const l0 = Math.log(0.03);
  const l1 = Math.log(30);
  for (let k = 0; k < M; k++) {
    const y = Math.exp(l0 + ((l1 - l0) * (k + 0.5)) / M);
    I += fangF(y, E) * y * ((l1 - l0) / M);
  }
  console.log(
    `REF fang int f dy (E=${E} keV, fitted domain) = ${I.toFixed(3)}`
  );
}

{
  const peaks = [];
  for (const E of [0.1, 0.3, 1, 3, 10, 30]) {
    const q = qMaxwellian(E === 0.1 ? 0.1 : E); // Maxwellian at E0
    let bi = 0;
    for (let i = 0; i < q.length; i++) if (q[i] > q[bi]) bi = i;
    peaks.push([E, ATMO_ROWS[bi].z]);
  }
  console.log(
    'REF ionization peak km vs E0 keV: ' +
      peaks.map(([e, z]) => `${e}:${z}`).join(' ')
  );
  let mono = true;
  for (let i = 1; i < peaks.length; i++)
    if (peaks[i][1] > peaks[i - 1][1]) mono = false;
  console.log(`REF peaks harden downward monotonically: ${mono}`);
}

{
  const q200 = quench1D(ATMO_ROWS.find((r) => r.z === 200));
  const q150 = quench1D(ATMO_ROWS.find((r) => r.z === 150));
  const q110 = quench1D(ATMO_ROWS.find((r) => r.z === 110));
  const q300 = quench1D(ATMO_ROWS.find((r) => r.z === 300));
  console.log(
    `REF O(1D) survival: 110 km ${q110.toExponential(1)},` +
      ` 150 km ${q150.toFixed(3)}, 200 km ${q200.toFixed(3)},` +
      ` 300 km ${q300.toFixed(3)}`
  );
}

{
  // red/green column ratio vs hardness (soft -> red type-d aurora).
  const ratio = (E0) => {
    const lut = buildAuroraLUT(E0);
    let red = 0;
    let green = 0;
    for (let b = 0; b < lut.bins; b++) {
      red += lut.data[b * 4];
      green += lut.data[b * 4 + 1];
    }
    return red / green;
  };
  const soft = ratio(0.3);
  const hard = ratio(5);
  console.log(
    `REF 6300/5577 column ratio: E0=0.3 keV ${soft.toFixed(2)},` +
      ` E0=5 keV ${hard.toFixed(2)} (soft precipitation redder: ${soft > hard})`
  );
}

{
  const lut = buildAuroraLUT(3);
  const zOf = (b) => Z_MIN + ((b + 0.5) / lut.bins) * (Z_MAX - Z_MIN);
  let bg = 0;
  let br = 0;
  for (let b = 0; b < lut.bins; b++) {
    if (lut.data[b * 4 + 1] > lut.data[bg * 4 + 1]) bg = b;
    if (lut.data[b * 4] > lut.data[br * 4]) br = b;
  }
  console.log(
    `REF E0=3 keV: 5577 peak ${zOf(bg).toFixed(0)} km,` +
      ` 6300 peak ${zOf(br).toFixed(0)} km (red above green: ${br > bg})`
  );
}

for (const nm of [557.7, 630.0, 427.8]) {
  const [r, g, b] = wavelengthToLinearSRGB(nm);
  console.log(
    `REF line ${nm} nm -> linear sRGB (${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)})`
  );
}

{
  // Whiter et al. 2023 (Ann. Geophys. 41, 1 - read in full):
  // 57,907 simultaneous green/blue peak-height pairs from seven
  // winters of MIRACLE all-sky cameras. Their printed anchors,
  // held against the LUT (CIRA-72 + Fang vs their MSIS +
  // transport model - band tolerances, not exact):
  //  - both lines typically peak near 114 km (means 114.84 green,
  //    116.55 blue): some E0 in the auroral range must put the
  //    LUT's green peak in 112-118 km, with the blue ABOVE it
  //    there - "contrary to a common misconception that blue
  //    peaks below green"
  //  - the height difference GROWS as precipitation softens
  //    (their Figs. 7-9: blue-green up to ~10 km at the softest)
  //    and shrinks toward the crossover for harder spectra
  //  - below ~110 km the observations converge; the printed
  //    model itself overshoots there (their own caveat - the
  //    low-altitude O(1S) sources beyond N2(A) transfer are
  //    unmodelled in print), so the hard end is gated as a BOUND,
  //    not a convergence claim
  //  - the red 630.0 line stays far above both at every energy
  const peakZ = (lut, c) => {
    let b = 0;
    for (let i = 0; i < lut.bins; i++) {
      if (lut.data[i * 4 + c] > lut.data[b * 4 + c]) b = i;
    }
    return Z_MIN + ((b + 0.5) / lut.bins) * (Z_MAX - Z_MIN);
  };
  const at = (E0) => {
    const l = buildAuroraLUT(E0);
    return {g: peakZ(l, 1), b: peakZ(l, 2), r: peakZ(l, 0)};
  };
  let typical = null;
  for (const E0 of [0.7, 0.8, 0.9, 1.0, 1.1, 1.2]) {
    const p = at(E0);
    if (p.g >= 112 && p.g <= 118) {
      typical = {E0, ...p};
      break;
    }
  }
  const soft = at(0.5);
  const mid = at(1.5);
  const hard = at(3);
  const deep = at(15);
  const softDiff = soft.b - soft.g;
  const ok =
    typical !== null &&
    typical.b - typical.g > 1 &&
    typical.b - typical.g < 12 &&
    softDiff >= 8 &&
    softDiff <= 20 &&
    softDiff > mid.b - mid.g &&
    mid.b - mid.g > hard.b - hard.g - 1e-9 &&
    Math.abs(deep.b - deep.g) <= 8 &&
    soft.r > soft.b &&
    deep.r > deep.g;
  check(
    'Whiter 2023 measured peak altitudes',
    ok,
    `green hits ${typical ? typical.g.toFixed(1) : '-'} km at E0 ${typical ? typical.E0 : '-'} keV (measured mean 114.84) with blue ${typical ? (typical.b - typical.g).toFixed(1) : '-'} km above (measured +1.7, model up to ~10); ` +
      `blue-green softens ${softDiff.toFixed(1)} -> ${(mid.b - mid.g).toFixed(1)} -> ${(hard.b - hard.g).toFixed(1)} km (0.5/1.5/3 keV); ` +
      `hard-end bound |${(deep.b - deep.g).toFixed(1)}| km at 15 keV (printed model's own overshoot regime); red far above`
  );
}

// ---- absolute curtain photometry (gated landmarks) ----
// Sources read in full: Brandstrom et al. 2012 (GI 1, 43) Eqs.
// 1-2 (the SI rayleigh and its 4-pi apparent radiance);
// Baumgardner et al. 2007 (Ann. Geophys. 25, 2593) - SAR-arc
// climatology 500 +- 270 R sub-visual, the 29 Oct 1991 arc at
// 9.5 kR above background "approaches naked-eye visibility",
// the 23-24 Mar 1969 great aurora at ~100 kR greenline + ~200 kR
// redline; Hayakawa et al. 2018 (ApJ 869, 57) - IBC Class IV
// ~ 1000 kR at 557.7 nm with ground illumination equal to full
// moonlight; Dahlgren et al. 2011 (Ann. Geophys. 29, 1699) -
// the same SI definition and few-kR ordinary discrete arcs.
import {
  AURORA_KR_GREAT,
  AURORA_KR_IBC4,
  AURORA_SR,
  curtainKR,
  curtainLuminance
} from './aurora-lut.js';
import {cieY, LINES} from './airglow.js';
import {
  crumeyThresholdDB,
  CRUMEY_B_VALID,
  CRUMEY_F,
  extendedVisibility,
  MOON_FULL_LUX
} from './adaptation.js';
import {NATURAL_MCD} from './skyglow.js';

{
  // The SI chain re-derived independently of the module: 1 kR of
  // 5577 -> 1e10 x 1000 / (4 pi) photons s^-1 m^-2 sr^-1
  // (Brandstrom Eqs. 1-2), times hc/lambda, times 683 lm/W times
  // CIE Y(557.7). The result must equal curtainLuminance exactly
  // and land at ~1.93e-4 cd/m^2 - and that unit rung of the kR
  // ladder sits AT the canonical moonless-sky luminance
  // (skyglow's printed NATURAL_MCD pair), which is why a 1 kR
  // aurora is a threshold object over the natural night sky (the
  // IBC ladder's own bottom-class narrative).
  const H = 6.62607015e-34;
  const C = 2.99792458e8;
  const rad = ((1000 * 1e10) / (4 * Math.PI)) * ((H * C) / 557.7e-9);
  const lum = 683 * cieY(557.7) * rad;
  const ok =
    Math.abs(curtainLuminance(1) / lum - 1) < 1e-12 &&
    lum > 1.9e-4 &&
    lum < 1.95e-4;
  const ratio = curtainLuminance(1) / (NATURAL_MCD * 1e-3);
  check(
    'SI rayleigh chain (Brandstrom Eqs. 1-2)',
    ok && ratio > 1.0 && ratio < 1.25,
    `1 kR at 5577 = ${lum.toExponential(3)} cd/m^2 (independent arithmetic, exact match ${Math.abs(curtainLuminance(1) / lum - 1) < 1e-12}); ` +
      `= ${ratio.toFixed(2)}x the moonless natural sky (${(NATURAL_MCD * 1e-3).toExponential(2)})`
  );
}

{
  // The printed ladder: floor exactly the PALACE green-airglow
  // mean, top exactly the printed 100 kR great aurora, IBC IV a
  // decade above it, and mid-drive in the few-kR band of ordinary
  // discrete arcs (Dahlgren's bright arc: 4 kR at OI 7774).
  const f = curtainKR(0);
  const g = curtainKR(1);
  const m = curtainKR(0.5);
  let mono = true;
  let prev = 0;
  for (let d = 0; d <= 1.0001; d += 0.05) {
    const k = curtainKR(d);
    if (k < prev) mono = false;
    prev = k;
  }
  check(
    'printed kR ladder',
    f === LINES[0].refR / 1000 &&
      Math.abs(g - AURORA_KR_GREAT) < 1e-9 &&
      AURORA_KR_IBC4 / AURORA_KR_GREAT === 10 &&
      Math.abs(m - Math.sqrt((LINES[0].refR / 1000) * AURORA_KR_GREAT)) <
        1e-9 &&
      m > 3.5 &&
      m < 4.5 &&
      mono,
    `floor ${f} kR (PALACE 163 R exact), top ${g.toFixed(6)} kR (printed great aurora), IBC IV ${AURORA_KR_IBC4} kR = 10x; ` +
      `mid-drive ${m.toFixed(2)} kR - the few-kR ordinary-arc band; monotone`
  );
}

{
  // Visibility through the shipped Crumey machinery at the four
  // sky classes the theme lives in. dark = the natural moonless
  // sky; moon = 5e-3 cd/m^2, the full-moon sky class the
  // adaptation gate itself uses; twilight = Crumey's printed
  // validity edge (0.1 cd/m^2, ~15 mag/arcsec^2); day = 3000
  // cd/m^2. What must emerge: the great aurora pierces full
  // moonlight AND the validity-edge twilight sky (great displays
  // really are seen before darkness), the quiet 1 kR arc is full
  // at dark but drowning under the moon and dead in twilight, and
  // daylight extinguishes even the IBC IV extreme - the printed
  // "ground illumination equal to full moonlight" being still
  // ~5 orders below the daytime sky itself.
  const vis = (kR, B) => extendedVisibility(curtainLuminance(kR), B, AURORA_SR);
  const dark = NATURAL_MCD * 1e-3;
  const moon = 5e-3;
  const twil = CRUMEY_B_VALID;
  const day = 3000;
  const vGreatDark = vis(AURORA_KR_GREAT, dark);
  const vGreatMoon = vis(AURORA_KR_GREAT, moon);
  const vGreatTwil = vis(AURORA_KR_GREAT, twil);
  const vGreatDay = vis(AURORA_KR_GREAT, day);
  const vQuietDark = vis(1, dark);
  const vQuietMoon = vis(1, moon);
  const vQuietTwil = vis(1, twil);
  const vIbc4Day = vis(AURORA_KR_IBC4, day);
  const ok =
    vGreatDark === 1 &&
    vGreatMoon === 1 &&
    vGreatTwil === 1 &&
    vGreatDay === 0 &&
    vQuietDark === 1 &&
    vQuietMoon > 0.15 &&
    vQuietMoon < 0.55 &&
    vQuietTwil === 0 &&
    vIbc4Day === 0;
  check(
    'curtain visibility (Crumey, shipped machinery)',
    ok,
    `great 100 kR: dark ${vGreatDark}, full moon ${vGreatMoon}, twilight-edge ${vGreatTwil}, day ${vGreatDay}; ` +
      `quiet 1 kR: dark ${vQuietDark}, moon ${vQuietMoon.toFixed(2)} (drowning), twilight ${vQuietTwil}; ` +
      `IBC IV in daylight ${vIbc4Day}`
  );
}

{
  // Hayakawa's printed IBC IV sentence closes through the theme's
  // own moon: a full-sky IBC IV curtain (1000 kR) delivers
  // pi x L = ~0.6 lx to the ground - about twice the theme's
  // derived full-moon illuminance (MOON_FULL_LUX, itself gated at
  // the textbook 0.25-0.35 lx) - so a curtain covering half the
  // sky gives ground light EQUAL to full moonlight, which is
  // exactly the printed equivalence ("the total illumination on
  // the ground equals to that of full moon", Chamberlain 1961 as
  // printed in Hayakawa et al. 2018). Two independent printed
  // chains - auroral photometry and lunar photometry - meeting at
  // a sentence written six decades before either was vendored.
  const eIbc4 = Math.PI * curtainLuminance(AURORA_KR_IBC4);
  const ratio = eIbc4 / MOON_FULL_LUX;
  check(
    'IBC IV = full-moon ground light (printed narrative)',
    ratio > 1.5 && ratio < 3.2,
    `full-sky IBC IV -> ${eIbc4.toFixed(2)} lx vs full moon ${MOON_FULL_LUX.toFixed(3)} lx ` +
      `(ratio ${ratio.toFixed(2)} - equality at ~half-sky coverage)`
  );
}

{
  // The Weber continuation past Crumey's printed validity edge:
  // continuous at the edge, threshold exactly linear in B beyond
  // it, monotone throughout - the reason daylight can extinguish
  // a curtain that the expired dark-sky fit would have let live.
  const A = AURORA_SR;
  const e = crumeyThresholdDB(CRUMEY_B_VALID, A);
  const eps = crumeyThresholdDB(CRUMEY_B_VALID * (1 + 1e-9), A);
  const w10 = crumeyThresholdDB(CRUMEY_B_VALID * 10, A);
  const w1e4 = crumeyThresholdDB(CRUMEY_B_VALID * 1e4, A);
  let mono = true;
  let prev = 0;
  for (let lb = -4; lb <= 3.5; lb += 0.25) {
    const t = crumeyThresholdDB(Math.pow(10, lb), A);
    if (t < prev) mono = false;
    prev = t;
  }
  check(
    'Weber continuation at the printed edge',
    Math.abs(eps / e - 1) < 1e-6 &&
      Math.abs(w10 / e - 10) < 1e-9 &&
      Math.abs(w1e4 / e - 1e4) < 1e-6 &&
      mono,
    `threshold continuous at ${CRUMEY_B_VALID} cd/m^2 (step ${(eps / e - 1).toExponential(1)}), ` +
      `x10 B -> x${(w10 / e).toFixed(3)} threshold, x1e4 -> x${(w1e4 / e).toExponential(2)}; monotone in B`
  );
}

{
  // Baumgardner's printed red-line pair through the same chain:
  // the typical 500 R SAR arc sits at ORDER UNITY of the
  // achromatic extended threshold over a dark sky (and rods are
  // nearly blind at 630 nm, pushing the real stimulus further
  // down - printed "almost always sub-visual"), while his 9.5 kR
  // event sits well over a decade above it (printed "approaches
  // naked-eye visibility" - reached only by that rod penalty).
  // The two luminances ratio exactly 19 (linearity in R).
  const L = (R) =>
    683 *
    cieY(630.0) *
    (((R * 1e10) / (4 * Math.PI)) *
      ((6.62607015e-34 * 2.99792458e8) / 630.0e-9));
  const th = CRUMEY_F * crumeyThresholdDB(NATURAL_MCD * 1e-3, AURORA_SR);
  const typ = L(500) / th;
  const bright = L(9500) / th;
  check(
    'Baumgardner red-line anchors',
    Math.abs(L(9500) / L(500) - 19) < 1e-12 &&
      typ > 0.8 &&
      typ < 1.6 &&
      bright > 15 &&
      bright < 30,
    `500 R SAR arc = ${typ.toFixed(2)}x the dark-sky achromatic threshold (sub-visual once the 630 nm rod penalty applies); ` +
      `9.5 kR = ${bright.toFixed(1)}x (approaches visibility); luminance ratio exactly 19`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
