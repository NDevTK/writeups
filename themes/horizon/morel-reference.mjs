// Reference gate for morel.js (node morel-reference.mjs): the Case-1
// reflectance model of Morel and Maritorena [2001] held to the
// paper's own published numbers.
//
//  - Table 2 integrity: the asymptotic blue-to-green ratio the paper
//    states the model collapses to at high Chl, chi(555)/chi(443) ~
//    0.38, is exactly the tabulated chi ratio.
//  - the clearest water reflects ~10% in the blue (R(420) ~ 0.10 at
//    Chl = 0.03, paper p.7171) with its spectral maximum pushed into
//    the near-UV by the steep molecular + particle backscattering.
//  - the ocean-colour signal itself: R(490)/R(555) collapses
//    monotonically from ~5 in the clearest water toward < 1 in
//    eutrophic water (Figure 11a).
//  - the backscattering law pins: bp550 = 0.416 at Chl = 1 exactly
//    (12), the efficiency slope v is 0 at Chl = 2 and -1 at Chl = 0.02
//    (14), and Morel [1974] molecular backscattering bbw = 0.5*bw
//    hits 0.0038 m^-1 at 400 nm and 0.00035 m^-1 at 700 nm.
//  - the paper's three-loop iteration has converged: R is settled to
//    ~2% at three loops (worst in the clearest blue water) and a
//    fourth loop moves it under 1%, so the sequence is contracting.
import {
  TABLE2,
  BP_COEF,
  backscatter,
  backscatterSlope,
  bbp,
  bp550,
  bwSeawater,
  reflectanceAt,
  reflectanceRow,
  reflectanceSpectrum
} from './morel.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const row = (nm) => TABLE2.find((r) => r[0] === nm);
const chiAt = (nm) => row(nm)[3];

{
  // The paper: "At very high [Chl] ... the asymptotic value of
  // R(443)/R(555) in the model reduces to the ratio chi(555)/chi(443)
  // (i.e., about 0.38)". On the 5 nm grid that is chi(555)/chi(445).
  const ratio = chiAt(555) / chiAt(445);
  // And the modelled R(445)/R(555) really does collapse toward it as
  // Chl grows (the residual offset is the paper's "extent that these
  // exponents are extremely close" caveat - the 100^(e555-e445)
  // factor pulls it a little below the pure chi ratio).
  const modelled = reflectanceAt(100, 445) / reflectanceAt(100, 555);
  check(
    'asymptotic blue/green',
    Math.abs(ratio - 0.38) < 0.005 && modelled > 0.28 && modelled < 0.42,
    `chi(555)/chi(445) = ${ratio.toFixed(4)} (paper's ~0.38); modelled R(445)/R(555) at Chl=100 = ${modelled.toFixed(4)}`
  );
}

{
  // Clearest water (Chl = 0.03): "R reaches 10% around 420 nm" and
  // "slightly exceeds 10% in the near-UV domain, around 370 nm, where
  // the reflectance spectrum experiences its maximum".
  const r420 = reflectanceAt(0.03, 420);
  const spec = reflectanceSpectrum(0.03);
  let max = spec[0];
  for (const s of spec) if (s.R > max.R) max = s;
  check(
    'clear-water blue reflectance',
    r420 > 0.085 &&
      r420 < 0.115 &&
      max.nm <= 420 &&
      max.R > 0.1 &&
      max.R > reflectanceAt(0.03, 550),
    `R(420) = ${r420.toFixed(4)} (~10%); spectral max ${max.R.toFixed(4)} at ${max.nm} nm (near-UV), far above R(550) = ${reflectanceAt(0.03, 550).toFixed(4)}`
  );
}

{
  // The ocean-colour signal (Figure 11a): R(490)/R(555) falls
  // monotonically with [Chl], from ~5 in the clearest water to below
  // 1 once phytoplankton dominates the blue absorption.
  const chls = [0.03, 0.1, 0.3, 1, 3, 10];
  const ratios = chls.map((c) => reflectanceAt(c, 490) / reflectanceAt(c, 555));
  let mono = true;
  for (let i = 1; i < ratios.length; i++)
    if (ratios[i] >= ratios[i - 1]) mono = false;
  check(
    'blue-to-green collapse',
    mono && ratios[0] > 4 && ratios[ratios.length - 1] < 1,
    `R(490)/R(555) over Chl ${chls.join('/')} = ${ratios.map((x) => x.toFixed(2)).join(', ')} - strictly decreasing, ~5 to <1`
  );
}

{
  // Backscattering pins. bp550 = 0.416*Chl^0.766 is 0.416 exactly at
  // Chl = 1; the efficiency slope v (eq 14) is 0 at Chl = 2 and -1 at
  // the Chl = 0.02 lower bound.
  const v2 = backscatterSlope(2);
  const vlow = backscatterSlope(0.02);
  check(
    'particle backscatter law',
    Math.abs(bp550(1) - BP_COEF) < 1e-12 &&
      Math.abs(v2) < 1e-6 &&
      Math.abs(vlow + 1) < 1e-3 &&
      bbp(0.5, 440) > 0,
    `bp550(1) = ${bp550(1).toFixed(4)}; v(2) = ${v2.toFixed(4)}, v(0.02) = ${vlow.toFixed(4)} (lambda^-1 held at the low end)`
  );
}

{
  // Molecular scattering cross-check (Morel 1974): bbw = 0.5*bw with
  // bw(550) = 0.00193 m^-1 and a lambda^-4.32 law reproduces the
  // commonly quoted 0.0038 m^-1 at 400 nm and 0.00035 m^-1 at 700 nm.
  const bbw = (nm) => 0.5 * bwSeawater(nm);
  check(
    'molecular backscatter',
    Math.abs(bbw(400) - 0.0038) < 5e-5 && Math.abs(bbw(700) - 0.00035) < 5e-5,
    `bbw(400) = ${bbw(400).toFixed(5)} (~0.0038), bbw(700) = ${bbw(700).toFixed(5)} (~0.00035)`
  );
}

{
  // The paper reports stable R "within three loops" of its iteration.
  // At the paper's three loops R is settled to ~2% (worst in the
  // clearest blue water, where R is largest and the Gershun feedback
  // contracts slowest); a fourth loop then moves R by under 1%,
  // confirming the sequence has converged, not stalled.
  let w23 = 0;
  let w34 = 0;
  let at = 0;
  for (const [nm, kw, e, chi] of TABLE2) {
    for (const chl of [0.03, 0.3, 3]) {
      const r2 = reflectanceRow(chl, nm, kw, e, chi, 2);
      const r3 = reflectanceRow(chl, nm, kw, e, chi, 3);
      const r4 = reflectanceRow(chl, nm, kw, e, chi, 4);
      if (Math.abs(r3 - r2) / r3 > w23) {
        w23 = Math.abs(r3 - r2) / r3;
        at = nm;
      }
      w34 = Math.max(w34, Math.abs(r4 - r3) / r4);
    }
  }
  check(
    'three-loop convergence',
    w23 < 2.5e-2 && w34 < 1e-2 && w34 < w23,
    `|R3 - R2|/R3 <= ${w23.toExponential(2)} (at ${at} nm) at the paper's three loops; the 3->4 loop change contracts to ${w34.toExponential(2)}`
  );
}

{
  // Backscatter assembles molecular + particle correctly and the full
  // Table 2 grid is intact (71 rows, 350-700 nm at 5 nm).
  const bb555 = backscatter(0.3, 555);
  check(
    'spectral grid + assembly',
    TABLE2.length === 71 &&
      TABLE2[0][0] === 350 &&
      TABLE2[70][0] === 700 &&
      Math.abs(bb555 - (0.5 * bwSeawater(555) + bbp(0.3, 555))) < 1e-15,
    `${TABLE2.length} rows 350-700 nm; bb(0.3, 555) = ${bb555.toExponential(4)} = 0.5*bw + bbp`
  );
}

process.exit(fail ? 1 : 0);
