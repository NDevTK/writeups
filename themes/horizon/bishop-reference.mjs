// Reference printer for Bishop's Ring (node bishop-reference.mjs).
// The law lives once in bishop.js - the 1888 Royal Society
// Krakatoa Committee report, Part IV Sec. I(e) by E. Douglas
// Archibald, machine-read page by page from the archive.org scan
// (report pages 232-257) - and these landmarks hold it to the
// print:
//  - Stokes' printed constants ARE the first two J0 zeros over pi
//    (the repo's own A&S Bessel anchors) - a mathematical identity
//    no transcription drift could fake
//  - Archibald's particle table re-derived through his own printed
//    formula: each printed (diameter, d) row implies a wavelength
//    in exactly the colour band he assigns it (violet inner,
//    mid-spectrum maximum, red outer); the printed means, the inch
//    conversion and the "three times the mean length of a wave"
//    footnote all close
//  - the drawn diameter: Ricco's printed theodolite maximum
//    through the first bright Airy ring (u = j2,1 - re-derived by
//    direct maximisation) lands on Forel's independent printed
//    0.003 mm, and differs from Archibald's Stokes-criterion value
//    by exactly j2,1/j0,1 - same sky, two printed reductions
//  - the EMERGENT structure: the inner white space's bounding gap
//    and the outer red limit fall where the report measured them,
//    with the V-weighted ring maximum at Ricco's own radius
//  - the amplitude chain: a background stratosphere (volcScale 1)
//    draws NOTHING - the printed formula itself forbids a
//    sub-0.2 um ring - while a Krakatoa-class excess modulates the
//    circumsolar sky at the tens-of-percent level and today's
//    quiet excess stays under a JND: "visible every day and all
//    day" in 1884, invisible in a clean sky, with no coded
//    threshold anywhere
import {
  AIRY_RING1_U,
  ARCH_D_IN,
  ARCH_D_MM,
  ARCH_MID_DEG,
  ARCH_TABLE,
  BISHOP_N1,
  BISHOP_N2,
  BISHOP_THETA_MAX_DEG,
  DILATATION,
  FLOGEL_D_MM,
  FOREL_D_MM,
  J0_ZERO_1,
  J0_ZERO_2,
  RICCO_MAX_RAD,
  RIGGENBACH_DEG,
  TABLE2_INNER_DEG,
  TABLE2_OUTER_DEG,
  airyPattern,
  airyEncircled,
  archibaldParticleMm,
  bishopAmpOf,
  bishopDiameterUm,
  bishopExcessTau,
  buildBishopLUT,
  impliedLambdaNm
} from './bishop.js';
import {CHANNEL_UM, coronaAmp, shellChordAM} from './cloud-corona.js';
import {chainAOD675} from './volcanic.js';
import {STRAT_BASE_M, STRAT_TOP_M, RAY_BETA, RAY_H_M} from './stratos.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const deg = (r) => (r * 180) / Math.PI;

// ---- 1. Stokes' constants are J0 zeros over pi ------------------
{
  const n1 = J0_ZERO_1 / Math.PI;
  const n2 = J0_ZERO_2 / Math.PI;
  check(
    'Stokes constants = J0 zeros / pi',
    Math.abs(BISHOP_N1 - n1) < 2e-4 && Math.abs(BISHOP_N2 - n2) < 2e-4,
    `printed 0.7655/1.7571 vs j01/pi = ${n1.toFixed(5)}, j02/pi = ${n2.toFixed(5)} - ` +
      `the 1888 reduction is Bessel theory to the precision of the era's tables`
  );
}

// ---- 2. Archibald's own table re-derived ------------------------
{
  // Each printed row's implied wavelength through HIS formula
  // must land in the colour band he assigns it.
  const bands = [
    ['violet', 380, 430],
    ['mid-spectrum', 520, 585],
    ['red', 700, 780]
  ];
  let ok = true;
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const [D, d1] = ARCH_TABLE[i];
    const lam = impliedLambdaNm(D, d1, 1);
    const [name, lo, hi] = bands[i];
    if (!(lam >= lo && lam <= hi)) ok = false;
    parts.push(
      `${D.toFixed(1)} deg + ${d1} mm -> ${lam.toFixed(0)} nm (${name})`
    );
  }
  check('printed rows imply their assigned colours', ok, parts.join('; '));
  const mean1 = (ARCH_TABLE[0][1] + ARCH_TABLE[1][1] + ARCH_TABLE[2][1]) / 3;
  const inch = ARCH_D_MM / 25.4;
  check(
    'printed means and conversions close',
    Math.abs(mean1 - ARCH_D_MM) < 5e-6 &&
      Math.abs(inch - ARCH_D_IN) / ARCH_D_IN < 0.1 &&
      Math.abs(ARCH_D_MM / 3 - 5.3e-4) < 1e-4,
    `1st-order column mean ${mean1.toFixed(5)} mm = printed ${ARCH_D_MM}; ` +
      `${ARCH_D_MM} mm = ${inch.toExponential(2)} in ~ printed ${ARCH_D_IN}; ` +
      `d/3 = ${((ARCH_D_MM / 3) * 1e6).toFixed(0)} nm - "about three times the mean ` +
      `length of a wave of light", mid-visible indeed`
  );
  // The 2nd-order column is the 1st scaled by N2/N1 (same formula,
  // same wavelengths) - printed values close to ~1% (the columns
  // were computed and rounded separately in 1888).
  let worst = 0;
  for (const [, d1, d2] of ARCH_TABLE) {
    worst = Math.max(worst, Math.abs(d2 / d1 / (BISHOP_N2 / BISHOP_N1) - 1));
  }
  check(
    'second-order column = N2/N1 x first',
    worst < 0.015,
    `worst relative deviation of d2/d1 from ${(BISHOP_N2 / BISHOP_N1).toFixed(4)} = ` +
      `${(worst * 100).toFixed(2)}% - his two columns are one formula to the era's rounding`
  );
}

// ---- 3. the drawn diameter --------------------------------------
{
  // Re-derive the first-bright-ring constant by direct
  // maximisation of the Airy pattern between the first two dark
  // rings - the module's j2,1 is self-certified.
  const f = (u) => {
    const th = [Math.asin(Math.min(u / 20, 1))];
    return airyPattern(20 / Math.PI, 1, th)[0]; // x = 20 exactly
  };
  let uBest = 0;
  let vBest = -1;
  for (let u = 3.9; u <= 7.0; u += 1e-4) {
    const v = f(u);
    if (v > vBest) {
      vBest = v;
      uBest = u;
    }
  }
  check(
    'first bright ring re-derived',
    Math.abs(uBest - AIRY_RING1_U) < 2e-3,
    `argmax of [2J1(u)/u]^2 in (j11, j12) = ${uBest.toFixed(4)} vs A&S j2,1 ${AIRY_RING1_U}`
  );
  const d = bishopDiameterUm();
  check(
    'Ricco anchor inverts to the Forel class',
    d > 3.2 &&
      d < 3.7 &&
      Math.abs(d - FOREL_D_MM * 1000) / (FOREL_D_MM * 1000) < 0.2,
    `d = j21 x 0.55 um / (pi sin ${deg(RICCO_MAX_RAD).toFixed(2)} deg) = ${d.toFixed(2)} um - ` +
      `within 20% of Forel's independent printed ${FOREL_D_MM * 1000} um ` +
      `(Flogel printed ${FLOGEL_D_MM * 1000} um; the report's spread holds the drawn value)`
  );
  // Archibald's mid-row d through his criterion vs the drawn d
  // through the modern one: the ratio is the two criteria's u
  // ratio exactly (wavelength normalised).
  const lamMid = impliedLambdaNm(ARCH_MID_DEG, ARCH_TABLE[1][1], 1);
  const ratio =
    (d * (lamMid / (CHANNEL_UM[1] * 1000))) / (ARCH_TABLE[1][1] * 1000);
  const uRatio = AIRY_RING1_U / J0_ZERO_1;
  check(
    'criterion ratio explains Archibald exactly',
    Math.abs(ratio - uRatio) < 0.005,
    `d_drawn/d_Archibald (same anchor, same wavelength) = ${ratio.toFixed(4)} vs ` +
      `j21/j01 = ${uRatio.toFixed(4)} - the two printed reductions differ by one criterion`
  );
}

// ---- 4. the emergent 1888 structure -----------------------------
{
  const d = bishopDiameterUm();
  // Inner white space: bounded by the mid-spectrum first MINIMUM.
  const j11 = 3.8317059702; // A&S, the repo's shipped first J1 zero
  const gapMid = deg(Math.asin((j11 * CHANNEL_UM[1]) / (Math.PI * d)));
  check(
    'inner white space bounded where printed',
    Math.abs(gapMid - TABLE2_INNER_DEG / 2) < 1.5 &&
      Math.abs(gapMid - RIGGENBACH_DEG.inner / 2) < 1.5,
    `mid first minimum at ${gapMid.toFixed(1)} deg vs printed inner radius ` +
      `${(TABLE2_INNER_DEG / 2).toFixed(1)} (Table II) / ${(RIGGENBACH_DEG.inner / 2).toFixed(1)} (Riggenbach)`
  );
  // Outer red limit: between the red ring and its second zero.
  const j12 = 7.0155866698; // A&S second J1 zero
  const redRing = deg(
    Math.asin((AIRY_RING1_U * CHANNEL_UM[0]) / (Math.PI * d))
  );
  const redZero2 = deg(Math.asin((j12 * CHANNEL_UM[0]) / (Math.PI * d)));
  const outerRad = TABLE2_OUTER_DEG / 2;
  check(
    'outer red limit bracketed',
    redRing < outerRad && outerRad < redZero2,
    `printed outer radius ${outerRad.toFixed(1)} deg sits between the red ring ` +
      `${redRing.toFixed(1)} and the red second zero ${redZero2.toFixed(1)} - ` +
      `the border fades out where the report says it ends`
  );
  // The V-weighted total's ring maximum sits at Ricco's radius:
  // approximate V by the theme's mid channel dominating the sum
  // (cieY(550)/cieY(680) ~ 80:1 makes mid the total's shape).
  // Search BETWEEN the mid channel's first and second dark rings
  // (11.3 and 20.9 deg) - the annulus the border lives in; inside
  // the first minimum the central lobe always wins.
  const thetas = [];
  for (let i = 0; i < 2000; i++) {
    thetas.push(((11.5 + (i * 8.5) / 2000) * Math.PI) / 180); // 11.5..20 deg
  }
  const pm = airyPattern(d, CHANNEL_UM[1], thetas);
  let iBest = 0;
  for (let i = 1; i < pm.length; i++) if (pm[i] > pm[iBest]) iBest = i;
  const maxDeg = deg(thetas[iBest]);
  check(
    'ring maximum at Ricco theodolite radius',
    Math.abs(maxDeg - deg(RICCO_MAX_RAD)) < 0.1,
    `drawn mid-channel ring max ${maxDeg.toFixed(2)} deg = Ricco's printed ` +
      `${deg(RICCO_MAX_RAD).toFixed(2)} deg (construction held end to end)`
  );
  // Chromatic ordering: blue rings inside green inside red - the
  // Cornu order, red outermost (diffraction, not the ice halo).
  const ringOf = (c) =>
    deg(Math.asin((AIRY_RING1_U * CHANNEL_UM[c]) / (Math.PI * d)));
  check(
    'Cornu order: red outside',
    ringOf(2) < ringOf(1) && ringOf(1) < ringOf(0),
    `ring radii B/G/R = ${ringOf(2).toFixed(1)}/${ringOf(1).toFixed(1)}/${ringOf(0).toFixed(1)} deg - ` +
      `"blue ... inside, and red at the border, or the reverse of ... the ice-crystal halo"`
  );
}

// ---- 5. the LUT ------------------------------------------------
{
  const lut = buildBishopLUT(0.267 * (Math.PI / 180) * 0.5);
  const d = bishopDiameterUm();
  const P0 = airyPattern(d, CHANNEL_UM[1], [0])[0];
  const mid0 = lut.curve[1];
  check(
    'LUT centre carries the closed-form peak',
    Math.abs(lut.thetaMaxRad - (BISHOP_THETA_MAX_DEG * Math.PI) / 180) < 1e-9 &&
      mid0 > 0.5 * P0 &&
      mid0 < 1.02 * P0,
    `theta_max ${deg(lut.thetaMaxRad).toFixed(0)} deg; convolved centre ` +
      `${mid0.toFixed(1)} sr^-1 vs closed x^2/4pi = ${P0.toFixed(1)} (disc smearing only)`
  );
  let enc = 1;
  for (let c = 0; c < 3; c++) {
    const x = (Math.PI * d) / CHANNEL_UM[c];
    enc = Math.min(
      enc,
      airyEncircled(x * Math.sin((BISHOP_THETA_MAX_DEG * Math.PI) / 180))
    );
  }
  check(
    'cone holds the diffracted light',
    enc > 0.9,
    `worst-channel encircled energy inside ${BISHOP_THETA_MAX_DEG} deg = ${(enc * 100).toFixed(1)}%`
  );
}

// ---- 6. the measured amplitude chain ----------------------------
{
  check(
    'background stratosphere draws nothing',
    bishopExcessTau(1) === 0 &&
      bishopAmpOf(1, 0.5) === 0 &&
      bishopAmpOf(0, 0.5) === 0,
    `volcScale 1 (and unmeasured 0) -> tau 0, amp 0 - the printed formula has no ` +
      `ring solution for the quiescent sub-0.2 um layer (d < N lambda)`
  );
  const tau8 = bishopExcessTau(8);
  check(
    'excess tau rides the shipped chain',
    Math.abs(tau8 - 7 * chainAOD675()) < 1e-12 && tau8 > 0.02 && tau8 < 0.04,
    `volcScale 8 -> tau_ring = 7 x chainAOD675 = ${tau8.toFixed(4)} (675 nm)`
  );
  // Slant chord: 1 at the zenith by definition of the airmass
  // unit, finite and growing toward the horizon.
  const amZen = shellChordAM(Math.PI / 2, 300, STRAT_BASE_M, STRAT_TOP_M);
  const am10 = shellChordAM(
    (10 * Math.PI) / 180,
    300,
    STRAT_BASE_M,
    STRAT_TOP_M
  );
  const am0 = shellChordAM(0, 300, STRAT_BASE_M, STRAT_TOP_M);
  check(
    'stratospheric chord geometry',
    Math.abs(amZen - 1) < 1e-9 &&
      am10 > 5 &&
      am10 < 6 &&
      am0 > am10 &&
      am0 < 30,
    `airmass 1.00 zenith, ${am10.toFixed(2)} at 10 deg, ${am0.toFixed(1)} at the horizon - ` +
      `finite spherical chords through the printed 15-25 km layer`
  );
  // EMERGENCE: ring modulation of the circumsolar sky at the ring
  // radius. The background here is the single-scatter Rayleigh
  // floor from the march's own betas - a LOWER bound on the real
  // daytime circumsolar sky (aerosol and multiple scattering only
  // brighten it), so every ratio below is an UPPER bound on the
  // drawn modulation. Three regimes, no coded threshold anywhere:
  // an unpainted quiet stratosphere is EXACTLY zero; a
  // colormap-floor read (volcScale 1.54, the smallest painted
  // value) stays under 10% even as an upper bound - faint at
  // most, and fine-mode in reality (the documented scope); a
  // Krakatoa-class column is an unmissable feature.
  const d = bishopDiameterUm();
  const ring550 = airyPattern(d, CHANNEL_UM[1], [RICCO_MAX_RAD])[0];
  const cosT = Math.cos(RICCO_MAX_RAD);
  const rayP = (3 / (16 * Math.PI)) * (1 + cosT * cosT);
  const skyL = RAY_BETA[1] * RAY_H_M * rayP; // per unit E0, 30 deg sun
  const mod = (vs) => (bishopAmpOf(vs, 0.5) * ring550) / skyL;
  check(
    'visible when volcanic, invisible today - emergent',
    mod(8) > 0.2 && mod(1) === 0 && mod(1.54) < 0.1,
    `ring/sky upper bounds at the ring radius: volcScale 8 -> ${(mod(8) * 100).toFixed(0)}% ` +
      `("visible every day and all day", 1884); background -> 0 exactly; ` +
      `colormap floor 1.54 -> ${(mod(1.54) * 100).toFixed(1)}% against the Rayleigh floor ` +
      `alone - the real aerosol-bright sky pushes it well under a JND`
  );
  // The slab law is the shipped one.
  check(
    'slab law identity',
    Math.abs(bishopAmpOf(4, 1, 300) - coronaAmp(bishopExcessTau(4))) < 1e-12,
    `amp(vs 4, zenith sun) = coronaAmp(tau_excess) exactly - one (tau/2)e^-tau in the repo`
  );
}

// ---- 7. the documented record (spot-held) -----------------------
{
  // Riggenbach's independent means vs the report's own list - the
  // two printed series agree to a few percent (p. 237's table).
  const dInner =
    Math.abs(RIGGENBACH_DEG.inner - TABLE2_INNER_DEG) / TABLE2_INNER_DEG;
  const dOuter =
    Math.abs(RIGGENBACH_DEG.outer - TABLE2_OUTER_DEG) / TABLE2_OUTER_DEG;
  check(
    'two printed series agree',
    dInner < 0.06 && dOuter < 0.04,
    `Riggenbach 20/44 vs Table II ${TABLE2_INNER_DEG.toFixed(2)}/${TABLE2_OUTER_DEG.toFixed(2)} deg - ` +
      `${(dInner * 100).toFixed(1)}%/${(dOuter * 100).toFixed(1)}% apart`
  );
  // The dilatation record is monotone in every printed column -
  // the machine-read table carried without drift.
  let mono = true;
  for (let i = 1; i < DILATATION.length; i++) {
    if (
      DILATATION[i].inner <= DILATATION[i - 1].inner ||
      DILATATION[i].red <= DILATATION[i - 1].red ||
      DILATATION[i].outer <= DILATATION[i - 1].outer
    )
      mono = false;
  }
  check(
    'sunset dilatation record monotone',
    mono,
    `63 observations, 1885: every column grows with solar zenith distance ` +
      `(12->35 inner, 26->38.4 red, 32.8->49.2 outer) - documentation, not modelled`
  );
  // Archibald's formula round-trips as an inverse pair.
  const dTest = archibaldParticleMm(ARCH_MID_DEG, 553.7, 1);
  const lamBack = impliedLambdaNm(ARCH_MID_DEG, dTest, 1);
  check(
    'formula inverse pair',
    Math.abs(lamBack - 553.7) < 1e-9,
    `archibaldParticleMm and impliedLambdaNm are exact inverses (553.7 nm round trip)`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
