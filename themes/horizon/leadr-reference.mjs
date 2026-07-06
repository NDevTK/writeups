// Reference printer for the LEADR slope-moment pyramid (node
// leadr-reference.mjs). The construction lives once in leadr.js;
// this checks the moment algebra the shading relies on:
//  - level L moments equal the DIRECT 2^L-footprint box average of
//    the base data (nested boxes compose exactly - machine zero)
//  - the law of total variance holds exactly across levels:
//    Var_parent = E[Var_children] + Var[E_children]
//  - a known sinusoid hits its analytic slope variance
//    (E[sx^2] = (A k)^2 / 2, E[sx] = 0)
//  - variances are non-negative at every texel of every level
import {buildMomentPyramid, slopesFromHeights, texelVariance} from './leadr.js';

const S = 128;
const STEP = 2.0;
const A = 3.0;
const K = (2 * Math.PI * 6) / (S * STEP); // 6 waves across the field
const hs = new Float64Array(S * S);
// sinusoid + a deterministic rough field (LCG) for generality
let seed = 12345;
const rand = () =>
  (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const rough = new Float64Array(S * S);
for (let k = 0; k < S * S; k++) rough[k] = (rand() - 0.5) * 1.5;
for (let j = 0; j < S; j++)
  for (let i = 0; i < S; i++)
    hs[j * S + i] = A * Math.sin(K * i * STEP) + rough[j * S + i];

const {sx, sz} = slopesFromHeights(hs, S, STEP);
const pyr = buildMomentPyramid(sx, sz, S);

// Direct footprint average vs pyramid, at a few (level, texel) picks.
{
  let worst = 0;
  for (const [L, ti, tj] of [
    [3, 5, 9],
    [5, 1, 2],
    [7, 0, 0]
  ]) {
    const n = 1 << L;
    const lev = pyr.levels[L];
    const acc = [0, 0, 0, 0];
    for (let j = tj * n; j < (tj + 1) * n; j++) {
      for (let i = ti * n; i < (ti + 1) * n; i++) {
        acc[0] += sx[j * S + i];
        acc[1] += sz[j * S + i];
        acc[2] += sx[j * S + i] ** 2;
        acc[3] += sz[j * S + i] ** 2;
      }
    }
    for (let c = 0; c < 4; c++) {
      const direct = acc[c] / (n * n);
      const stored = lev.data[(tj * lev.size + ti) * 4 + c];
      worst = Math.max(worst, Math.abs(direct - stored));
    }
  }
  console.log(
    `REF pyramid vs direct footprint: worst |d| = ${worst.toExponential(1)}`
  );
}

// Law of total variance, exact for box pyramids (fp32 storage puts
// it at single-precision epsilon rather than double).
{
  let worst = 0;
  for (let L = 1; L < pyr.levels.length; L++) {
    const P = pyr.levels[L];
    const C = pyr.levels[L - 1];
    for (let j = 0; j < P.size; j++) {
      for (let i = 0; i < P.size; i++) {
        const [vpx] = texelVariance(P, i, j);
        let meanVar = 0;
        let meanMean = 0;
        const kids = [];
        for (const [ci, cj] of [
          [2 * i, 2 * j],
          [2 * i + 1, 2 * j],
          [2 * i, 2 * j + 1],
          [2 * i + 1, 2 * j + 1]
        ]) {
          const [v] = texelVariance(C, ci, cj);
          const m = C.data[(cj * C.size + ci) * 4];
          meanVar += v / 4;
          meanMean += m / 4;
          kids.push(m);
        }
        let varMean = 0;
        for (const m of kids) varMean += (m - meanMean) ** 2 / 4;
        worst = Math.max(worst, Math.abs(vpx - (meanVar + varMean)));
      }
    }
  }
  console.log(
    `REF law of total variance: worst |d| = ${worst.toExponential(1)}`
  );
}

// Analytic sinusoid: at the top level E[sx] ~ 0 and the sinusoid
// contributes (A K)^2 / 2 to E[sx^2] on top of the rough field's
// measured share.
{
  const top = pyr.levels[pyr.levels.length - 1];
  const meanSx = top.data[0];
  const [vx, vz] = texelVariance(top, 0, 0);
  console.log(
    `REF global: E[sx] ${meanSx.toExponential(2)} (~0),` +
      ` Var[sx] ${vx.toFixed(4)} (sinusoid alone ${((A * K) ** 2 / 2).toFixed(4)}),` +
      ` Var[sz] ${vz.toFixed(4)} (rough field only)`
  );
}

// Non-negative variance everywhere.
{
  let neg = 0;
  for (const lev of pyr.levels) {
    for (let j = 0; j < lev.size; j++) {
      for (let i = 0; i < lev.size; i++) {
        const k = (j * lev.size + i) * 4;
        if (
          lev.data[k + 2] - lev.data[k] ** 2 < -1e-6 ||
          lev.data[k + 3] - lev.data[k + 1] ** 2 < -1e-6
        )
          neg++;
      }
    }
  }
  console.log(`REF negative variances: ${neg}`);
}
