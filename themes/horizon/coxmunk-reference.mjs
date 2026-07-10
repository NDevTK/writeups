// Reference gate for coxmunk.js (node coxmunk-reference.mjs):
//  - the published slope regressions exact at their anchors, the
//    separately fitted total consistent with mu + mc well inside
//    the paper's own +-0.004
//  - the Gram-Charlier structure held by MOMENT IDENTITIES:
//    Hermite orthogonality means the corrections change neither
//    the normalisation nor the second moments, and the upwind
//    third moment equals -C30 exactly - all recovered
//    numerically to quadrature precision
//  - Cox & Munk's own qualitative findings as numbers: mu > mc,
//    negative upwind skewness, the peaked-then-heavy-tailed
//    shape
//  - Fresnel at its closed points (normal incidence
//    ((n-1)/(n+1))^2, grazing -> 1, Brewster's zero)
//  - the glitter geometry at the mirror point exact, and the
//    photographed observable: wind WIDENS the glitter - the peak
//    drops, the off-specular sky brightens
import {
  CM_RANGE,
  fresnelWater,
  gcCoeffs,
  glintFactor,
  mssCross,
  mssUp,
  N_WATER,
  slopePDF
} from './coxmunk.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// Fine-grid quadrature over the slope plane (+-8 sigma).
const quad = (U, f) => {
  const su = Math.sqrt(mssUp(U));
  const sc = Math.sqrt(mssCross(U));
  const N = 400;
  let sum = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = (-8 + (16 * (i + 0.5)) / N) * su;
      const y = (-8 + (16 * (j + 0.5)) / N) * sc;
      sum += f(x, y) * slopePDF(x, y, U);
    }
  }
  return sum * ((16 * su) / N) * ((16 * sc) / N);
};

{
  // The published regressions: exact at U = 10 (mu = 0.0316,
  // mc = 0.0222); the separately fitted total 3e-3 + 5.12e-3 U
  // never strays from mu + mc by more than 5.6e-4 over the data
  // range - an order under the published +-0.004; outside 1-14
  // m/s the laws hold their end values (no extrapolation beyond
  // the measurements).
  let worst = 0;
  for (let U = CM_RANGE[0]; U <= CM_RANGE[1]; U += 0.5) {
    worst = Math.max(
      worst,
      Math.abs(mssUp(U) + mssCross(U) - (3e-3 + 5.12e-3 * U))
    );
  }
  const ok =
    Math.abs(mssUp(10) - 0.0316) < 1e-15 &&
    Math.abs(mssCross(10) - 0.0222) < 1e-15 &&
    worst < 5.7e-4 &&
    mssUp(0) === mssUp(1) &&
    mssCross(30) === mssCross(14);
  check(
    'published slope regressions',
    ok,
    `mu(10) = 0.0316, mc(10) = 0.0222 exact; |mu + mc - total-fit| <= ${worst.toExponential(1)} over 1-14 m/s (paper allows 4e-3); clamped to the measured range`
  );
}

{
  // Gram-Charlier moment identities (Hermite orthogonality): the
  // corrections leave the normalisation and both second moments
  // untouched, and buy the skewness exactly - the upwind third
  // moment of the NORMALISED slope is -C30. All five recovered
  // numerically at U = 10.
  const U = 10;
  const mu = mssUp(U);
  const mc = mssCross(U);
  const {c30} = gcCoeffs(U);
  const norm = quad(U, () => 1);
  const m2u = quad(U, (x) => x * x);
  const m2c = quad(U, (x, y) => y * y);
  const m3u = quad(U, (x) => (x / Math.sqrt(mu)) ** 3);
  const ok =
    Math.abs(norm - 1) < 2e-3 &&
    Math.abs(m2u / mu - 1) < 5e-3 &&
    Math.abs(m2c / mc - 1) < 5e-3 &&
    Math.abs(m3u - -c30) < 2e-2 &&
    c30 < 0 &&
    mu > mc;
  check(
    'Gram-Charlier moments',
    ok,
    `integral ${norm.toFixed(4)}; <su^2>/mu = ${(m2u / mu).toFixed(4)}, <sc^2>/mc = ${(m2c / mc).toFixed(4)}; normalised <u^3> = ${m3u.toFixed(3)} vs -C30 = ${(-c30).toFixed(3)} (negative upwind skew - waves lean with the wind); mu > mc as measured`
  );
}

{
  // Fresnel closed points: normal incidence ((n-1)/(n+1))^2
  // exact; grazing -> 1; Brewster's angle (tan = n) kills the
  // p-polarised half, leaving rho = rs^2/2 exactly.
  const r0 = ((N_WATER - 1) / (N_WATER + 1)) ** 2;
  const thB = Math.atan(N_WATER);
  const cB = Math.cos(thB);
  const s2 = 1 - cB * cB;
  const ct = Math.sqrt(1 - s2 / (N_WATER * N_WATER));
  const rs = (cB - N_WATER * ct) / (cB + N_WATER * ct);
  const ok =
    Math.abs(fresnelWater(1) - r0) < 1e-15 &&
    fresnelWater(0) > 0.999999 &&
    Math.abs(fresnelWater(cB) - (rs * rs) / 2) < 1e-12 &&
    fresnelWater(0.5) > fresnelWater(0.9);
  check(
    'Fresnel closed points',
    ok,
    `normal incidence ${fresnelWater(1).toFixed(5)} = ((n-1)/(n+1))^2 exactly; grazing -> 1; at Brewster's angle rho = rs^2/2 to 1e-12; monotone toward grazing`
  );
}

{
  // The glitter geometry: sun and viewer mirrored about the
  // vertical need a FLAT facet - the factor collapses to the
  // closed form rhoF(cos th) p(0,0) / (4 cos th) exactly. And
  // the observable Cox & Munk photographed: wind WIDENS the
  // glitter - the specular peak drops with U while a facet 12
  // degrees off brightens.
  const th = (30 * Math.PI) / 180;
  const S = {x: Math.sin(th), y: Math.cos(th), z: 0};
  const V = {x: -Math.sin(th), y: Math.cos(th), z: 0};
  const up = {x: 1, z: 0};
  const g = glintFactor(S, V, 8, up);
  const want =
    (fresnelWater(Math.cos(th)) * slopePDF(0, 0, 8)) / (4 * Math.cos(th));
  const peak = (U) => glintFactor(S, V, U, up);
  const tilt = (12 * Math.PI) / 180;
  const V2 = {
    x: -Math.sin(th - 2 * tilt),
    y: Math.cos(th - 2 * tilt),
    z: 0
  };
  const off = (U) => glintFactor(S, V2, U, up);
  const ok =
    Math.abs(g - want) < 1e-15 &&
    peak(2) > peak(8) &&
    peak(8) > peak(14) &&
    off(14) > off(2) &&
    glintFactor({x: 0.6, y: -0.8, z: 0}, V, 8, up) === 0;
  check(
    'glitter geometry',
    ok,
    `mirror case exact: ${g.toExponential(3)} = rhoF p(0,0)/(4 cos 30); peak falls with wind (${peak(2).toFixed(1)} > ${peak(8).toFixed(1)} > ${peak(14).toFixed(1)}) while 12 deg off-specular brightens (${off(2).toExponential(1)} -> ${off(14).toExponential(1)}) - the glitter widens exactly as photographed; no sun below the horizon`
  );
}

{
  // Anisotropy: the upwind variance beats the crosswind one, so
  // a facet tilted along the wind is more probable than the same
  // tilt across it - the glitter ellipse is elongated in the
  // wind's vertical plane (CM's finding a).
  const U = 10;
  const s = 0.15;
  const ok =
    slopePDF(s, 0, U) > slopePDF(0, s, U) &&
    slopePDF(0, 0, U) > slopePDF(s, 0, U) &&
    slopePDF(-s, 0, U) > slopePDF(s, 0, U);
  check(
    'slope anisotropy',
    ok,
    `at 10 m/s a 0.15 slope is likelier along-wind than across (${slopePDF(0.15, 0, U).toFixed(2)} > ${slopePDF(0, 0.15, U).toFixed(2)}), and likelier leaning downwind than up (the negative skew) - the glitter ellipse and its asymmetry`
  );
}

process.exit(fail ? 1 : 0);
