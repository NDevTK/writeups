/**
 * spectral-srgb.js - the display projection for the atmosphere's
 * three spectral channels. The whole radiative chain computes
 * monochromatic radiance at 680/550/440 nm; writing those numbers
 * STRAIGHT into sRGB R/G/B (the port's original shortcut, shared
 * by Hillaire's own 3-lambda demo) renders 550 nm as the pure
 * sRGB green primary - but 550 nm is a yellow-green (CIE 1931
 * chromaticity x 0.302, y 0.692), so Rayleigh mixtures drift
 * cyan: the measured teal noon stratum (see WEBGPU-PLAN, Jul 11).
 *
 * The exact treatment for three monochromatic lines:
 *  - project through the CIE 1931 2-degree colour-matching
 *    functions at the three wavelengths (values VERBATIM from the
 *    CVRL ciexyz31 table),
 *  - scale the three lines so EQUAL radiance maps to the D65
 *    white point (the unique positive solution of a 3x3 system) -
 *    neutrality is preserved by construction, so the fix cannot
 *    re-tint greys, only spectrally skewed mixtures,
 *  - then the standard XYZ -> linear-sRGB matrix, DERIVED here
 *    from the sRGB primaries and D65 (IEC 61966-2-1); the
 *    published 3.2406... coefficients emerge in the reference as
 *    a landmark rather than being pasted.
 * The product is one constant 3x3. Out-of-gamut monochromatic
 * saturation clips at zero (the standard gamut clip); a pure
 * 550 nm line clips back to the green primary - the projection
 * changes MIXTURES, exactly where the cast lived. Applied at the
 * DISPLAY ends only (dome, sun disc, sky-radiance export, aerial
 * in-scatter, the CPU ambient/sun tints) - every LUT texel and
 * reference pin upstream is untouched.
 */

// CIE 1931 2-deg CMFs at the atmosphere's wavelengths (CVRL
// ciexyz31 table rows 680, 550, 440 - fetched, not remembered).
export const CMF = {
  680: [0.04677, 0.017, 0.0],
  550: [0.4334499, 0.9949501, 0.008749999],
  440: [0.34828, 0.023, 1.74706]
};

// D65 white point (XYZ, Y = 1) and the sRGB primaries (IEC
// 61966-2-1 chromaticities).
export const D65 = [0.95047, 1.0, 1.08883];
const PRIMS = {
  r: [0.64, 0.33],
  g: [0.3, 0.6],
  b: [0.15, 0.06]
};

const det3 = (m) =>
  m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
  m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
  m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

const solve3 = (A, b) => {
  const D = det3(A);
  return [0, 1, 2].map(
    (i) => det3(A.map((r, j) => r.map((x, k) => (k === i ? b[j] : x)))) / D
  );
};

const mul3 = (P, Q) =>
  P.map((r) => Q[0].map((_, j) => r.reduce((a, x, k) => a + x * Q[k][j], 0)));

const inv3 = (m) => {
  const D = det3(m);
  const c = (i, j) => {
    const s = m
      .filter((_, r) => r !== i)
      .map((r) => r.filter((_, cIdx) => cIdx !== j));
    return ((i + j) % 2 ? -1 : 1) * (s[0][0] * s[1][1] - s[0][1] * s[1][0]);
  };
  return [0, 1, 2].map((j) => [0, 1, 2].map((i) => c(i, j) / D));
};

// XYZ -> linear sRGB, derived from the primaries + D65 (the
// standard construction: primaries' XYZ columns scaled so the
// white point maps to RGB (1,1,1)).
export function xyzToSrgbMatrix() {
  const prim = ['r', 'g', 'b'].map((k) => {
    const [x, y] = PRIMS[k];
    return [x / y, 1, (1 - x - y) / y];
  });
  // A's columns are the primaries' unscaled XYZ.
  const A = [0, 1, 2].map((row) => prim.map((p) => p[row]));
  const s = solve3(A, D65);
  const M = A.map((r) => r.map((x, i) => x * s[i]));
  return inv3(M);
}

// The full projection: (L680, L550, L440) -> linear sRGB.
export function spectralToSrgbMatrix() {
  // Columns ordered R=680, G=550, B=440 to match the channel
  // layout the whole chain uses.
  const A = [0, 1, 2].map((row) => [
    CMF[680][row],
    CMF[550][row],
    CMF[440][row]
  ]);
  const s = solve3(A, D65);
  const M = A.map((r) => r.map((x, i) => x * s[i]));
  return {P: mul3(xyzToSrgbMatrix(), M), scales: s};
}

export const SPECTRAL_TO_SRGB = spectralToSrgbMatrix().P;

// CPU-side application with the gamut clip (for the ambient and
// sun-tint feeds; the shaders carry the same constant matrix).
export function applySpectral(v) {
  return SPECTRAL_TO_SRGB.map((r) =>
    Math.max(r[0] * v[0] + r[1] * v[1] + r[2] * v[2], 0)
  );
}

// TSL-side application: this module stays three-free (the node
// references import it), so the shader files hand in their own
// builders and get back the projection node - the matrix has ONE
// definition either way.
export function spectralNode({vec3, dot, max}) {
  const P = SPECTRAL_TO_SRGB;
  const rows = P.map((r) => [r[0], r[1], r[2]]);
  return (c) =>
    max(
      vec3(
        dot(c, vec3(...rows[0])),
        dot(c, vec3(...rows[1])),
        dot(c, vec3(...rows[2]))
      ),
      0.0
    );
}
