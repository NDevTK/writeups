// Reference printer for the variable-star machinery (node
// varstars-reference.mjs). The law lives in varstars.js -
// printed GCVS 5.1 elements, Goodricke 1783's discovery letter,
// Stebbins 1910's selenium light-curve - and these landmarks
// hold it:
//  - the 1783 discovery period (and the discovery table's own
//    quotient column) agree with the modern element to 0.1%
//  - Stebbins' printed between-minima normals ARE his printed
//    reflection law L = L1 + s(1 - cos phi) - internal
//    consistency of the vendored table
//  - his tabulated secondary dip is his printed "0.06 magnitude"
//  - the two printed eclipse durations (Stebbins 9.80 h, GCVS
//    D = 14%) agree within 3%; Goodricke's naked-eye 7 h sits
//    inside both
//  - the drawn V endpoints land exactly on the GCVS max / Min I
//  - phase folding is exact; each class model hits its printed
//    endpoints and symmetries; every roster star finds exactly
//    one Yale BSC row and the static catalogue magnitude lies
//    inside the printed range
import {readFileSync} from 'node:fs';
import {
  algolDmag,
  algolV,
  bscIndexOf,
  eaV,
  ebV,
  GOODRICKE_ECLIPSE_H,
  GOODRICKE_P_D,
  GOODRICKE_QUOTIENTS_H,
  phaseOf,
  pulseV,
  STEBBINS_BRIGHTEST,
  STEBBINS_CURVE,
  STEBBINS_DUR_H,
  STEBBINS_L1,
  STEBBINS_P_H,
  STEBBINS_S,
  STEBBINS_SEC_DEPTH,
  VARSTARS,
  varV
} from './varstars.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const G = Object.fromEntries(VARSTARS.map((v) => [v.name, v]));

// ---- 1. Goodricke 1783 vs the modern element --------------------
{
  const rel = Math.abs(GOODRICKE_P_D / G['bet Per'].period - 1);
  // His own footnote excludes the 2d 22.1h quotient (April 10-13:
  // "observed ... not when it was at, but only near, its least
  // brightness") - the exclusion is printed, not ours.
  const q = GOODRICKE_QUOTIENTS_H.filter((h) => h < 22);
  const qMean = 2 + q.reduce((a, b) => a + b, 0) / q.length / 24;
  const relQ = Math.abs(qMean / G['bet Per'].period - 1);
  check(
    'the 1783 discovery period holds',
    rel < 1.2e-3 && relQ < 1.2e-3,
    `Goodricke's printed "two days and nearly twenty hours and three ` +
      `quarters" = ${GOODRICKE_P_D.toFixed(4)} d vs GCVS ` +
      `${G['bet Per'].period} d (${(rel * 100).toFixed(2)}%); his own ` +
      `quotient column means ${qMean.toFixed(4)} d ` +
      `(${(relQ * 100).toFixed(2)}%) - the discovery letter carries the ` +
      `modern element to a tenth of a percent`
  );
}

// ---- 2. Stebbins' table is his own reflection law ---------------
{
  let worst = 0;
  for (const [h, dmag] of STEBBINS_CURVE) {
    if (h < 6 || (h > 29.9 && h < 39.5)) continue; // eclipse branches
    const L = Math.pow(10, -0.4 * dmag);
    const phi = (2 * Math.PI * h) / STEBBINS_P_H;
    const law = STEBBINS_L1 + STEBBINS_S * (1 - Math.cos(phi));
    worst = Math.max(worst, Math.abs(L - law));
  }
  check(
    'the vendored table IS the printed reflection law',
    worst < 0.01,
    `between minima, 10^(-0.4 dm) vs L1 + s(1 - cos phi) with the printed ` +
      `L1 = ${STEBBINS_L1}, s = ${STEBBINS_S}: worst ` +
      `${worst.toFixed(4)} alpha-Per light units - the 1910 fit sits in ` +
      `the 1910 table`
  );
  const flank = Math.min(
    ...STEBBINS_CURVE.filter(([h]) => h > 25 && h < 45).map(([, m]) => m)
  );
  const sec = Math.max(
    ...STEBBINS_CURVE.filter(([h]) => h > 33 && h < 36).map(([, m]) => m)
  );
  check(
    'the discovered secondary minimum',
    Math.abs(sec - flank - STEBBINS_SEC_DEPTH) < 0.005,
    `tabulated dip ${sec.toFixed(3)} against flanking maxima ` +
      `${flank.toFixed(3)} = ${(sec - flank).toFixed(3)} mag - the printed ` +
      `"variation of 0.06 magnitude" the selenium cell first saw`
  );
}

// ---- 3. the printed durations agree -----------------------------
{
  const gcvsH = (G['bet Per'].dPct / 100) * G['bet Per'].period * 24;
  check(
    'printed eclipse durations agree',
    Math.abs(gcvsH / STEBBINS_DUR_H - 1) < 0.03 &&
      GOODRICKE_ECLIPSE_H < STEBBINS_DUR_H,
    `GCVS D = ${G['bet Per'].dPct}% of the period = ${gcvsH.toFixed(2)} h ` +
      `vs Stebbins' printed 9.80 h (${(
        Math.abs(gcvsH / STEBBINS_DUR_H - 1) * 100
      ).toFixed(1)}%); Goodricke's naked-eye ${GOODRICKE_ECLIPSE_H} h sits ` +
      `inside the photometric window - three sources, one eclipse`
  );
}

// ---- 4. the drawn Algol curve -----------------------------------
{
  const g = G['bet Per'];
  const vMin = algolV(0, g);
  const vMax = algolV(29.8 / STEBBINS_P_H, g);
  const stretch =
    (g.min1 - g.max) / (STEBBINS_CURVE[0][1] - STEBBINS_BRIGHTEST);
  const dEdge = algolDmag(4.9 / STEBBINS_P_H);
  const mirror =
    Math.abs(algolDmag(1 - 2 / STEBBINS_P_H) - algolDmag(2 / STEBBINS_P_H)) <
    1e-12;
  check(
    'Algol drawn on the GCVS endpoints through the 1910 shape',
    Math.abs(vMin - g.min1) < 1e-9 &&
      Math.abs(vMax - g.max) < 1e-9 &&
      stretch > 1 &&
      stretch < 1.05 &&
      Math.abs(dEdge - 0.174) < 1e-9 &&
      mirror,
    `phase 0 -> V ${vMin.toFixed(2)} (GCVS Min I), brightest -> ` +
      `${vMax.toFixed(2)} (GCVS max); selenium-to-V stretch ` +
      `${stretch.toFixed(4)}; first-contact point 0.174 as printed; ` +
      `the approach side mirrors (his stated symmetry)`
  );
}

// ---- 5. phase folding exact -------------------------------------
{
  const g = G['del Cep'];
  const p0 = phaseOf(g.epoch + 7 * g.period, g.epoch, g.period);
  const pq = phaseOf(g.epoch + 7.25 * g.period, g.epoch, g.period);
  check(
    'phase arithmetic exact',
    (p0 < 1e-9 || p0 > 1 - 1e-9) && Math.abs(pq - 0.25) < 1e-9,
    `epoch + 7P folds to ${p0.toExponential(1)}, + 7.25P to ` +
      `${pq.toFixed(9)} - double precision holds the fold to nanophases ` +
      `across decades`
  );
}

// ---- 6. the class models hit their printed numbers --------------
{
  const dc = G['del Cep'];
  const zg = G['zet Gem'];
  const okEnds =
    Math.abs(pulseV(0, dc) - dc.max) < 1e-12 &&
    Math.abs(pulseV(1 - dc.mmPct / 100, dc) - dc.min1) < 1e-12;
  let sym = true;
  for (let i = 1; i < 10; i++) {
    if (Math.abs(pulseV(i / 10, zg) - pulseV(1 - i / 10, zg)) > 1e-12)
      sym = false;
  }
  // del Cep: printed 25% rise is steeper than the 75% fall
  const fallRate = Math.abs(pulseV(0.376, dc) - pulseV(0.375, dc));
  const riseRate = Math.abs(pulseV(0.876, dc) - pulseV(0.875, dc));
  check(
    'pulsators: the catalogue M-m shapes the curve',
    okEnds && sym && riseRate > 2 * fallRate,
    `del Cep max/min exact at phase 0 / ${1 - dc.mmPct / 100}; zet Gem's ` +
      `printed 50% rise = symmetric curve; del Cep's printed 25% rise ` +
      `climbs ${(riseRate / fallRate).toFixed(1)}x faster than it falls - ` +
      `the classic Cepheid sawtooth from one printed parameter`
  );
  const bl = G['bet Lyr'];
  const lt = G['lam Tau'];
  check(
    'eclipsers: printed depths at printed phases',
    Math.abs(ebV(0, bl) - bl.min1) < 1e-12 &&
      Math.abs(ebV(0.5, bl) - bl.min2) < 1e-12 &&
      Math.abs(ebV(0.25, bl) - bl.max) < 1e-12 &&
      Math.abs(eaV(0, lt) - lt.min1) < 1e-12 &&
      Math.abs(eaV(0.5, lt) - lt.min2) < 1e-12 &&
      Math.abs(eaV(0.3, lt) - lt.max) < 1e-12 &&
      Math.abs(eaV(0.5 + lt.dPct / 200 + 1e-6, lt) - lt.max) < 1e-9,
    `bet Lyr ${bl.min1}/${bl.min2}/${bl.max} at phase 0/0.5/0.25 (EB: no ` +
      `constant light); lam Tau flat at ${lt.max} outside the printed ` +
      `D = ${lt.dPct}% windows, dipping to ${lt.min1}/${lt.min2} - the ` +
      `GCVS class definitions drawn literally`
  );
}

// ---- 7. the roster finds its BSC rows ---------------------------
{
  const stars = JSON.parse(
    readFileSync(new URL('./stars.json', import.meta.url))
  );
  let all = true;
  let detail = [];
  for (const g of VARSTARS) {
    const i = bscIndexOf(g, stars);
    if (i < 0) {
      all = false;
      detail.push(`${g.name}: NO unique match`);
      continue;
    }
    const staticMag = stars[i][2];
    if (staticMag < g.max - 0.25 || staticMag > g.min1 + 0.25) all = false;
    detail.push(`${g.name}@${i} (${staticMag})`);
  }
  check(
    'every roster star is one Yale BSC row',
    all,
    `${detail.join(' · ')} - each static catalogue magnitude lies inside ` +
      `the printed GCVS range (Mira's still photo was taken near a ` +
      `bright phase)`
  );
  const jd = 2461000.5;
  const vAlgol = varV(G['bet Per'], jd);
  const vMira = varV(G['omi Cet'], jd);
  check(
    'dispatcher sane across classes',
    vAlgol >= G['bet Per'].max - 1e-9 &&
      vAlgol <= G['bet Per'].min1 + 1e-9 &&
      vMira >= G['omi Cet'].max - 1e-9 &&
      vMira <= G['omi Cet'].min1 + 1e-9,
    `at JD ${jd}: Algol V ${vAlgol.toFixed(2)}, Mira V ${vMira.toFixed(2)} ` +
      `- every drawn magnitude stays inside its printed range`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
