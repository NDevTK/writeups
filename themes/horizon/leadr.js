/**
 * LEADR slope-moment pyramid - the single source shared by the
 * terrain bake (Horizon.html) and the reference printer
 * (leadr-reference.mjs). Dupuy, Heitz, Iehl, Poulin & Neyret 2013,
 * "Linear Efficient Antialiased Displacement and Reflectance
 * Mapping": filtering a normal map is wrong (normals do not average
 * into shading), but SLOPE MOMENTS are linear - a box-filtered mip
 * of (sx, sz, sx^2, sz^2) carries the exact first and second
 * moments of the surface slope distribution inside any footprint.
 * The mean slope is the filtered shading normal; the central
 * variance sigma^2 = E[s^2] - E[s]^2 adds to the microfacet lobe:
 * alpha_eff^2 = alpha^2 + 2 sigma^2 (Beckmann-convention inflation,
 * applied to the GGX lobes as is standard practice - the paper's
 * own real-time path).
 *
 * The pyramid is built ONCE on the CPU in double precision (box
 * filter, so level L is exactly the 2^L x 2^L footprint average -
 * nested boxes compose exactly) and uploaded as hand-built float32
 * mips (probed: upload, per-level LOD reads and trilinear filtering
 * are exact on the WebGPU stack). The covariance E[sx sz] is NOT
 * stored: every BRDF in this pipeline is isotropic, so only the
 * trace sigma_x^2 + sigma_z^2 enters shading (documented, not
 * hidden - storing it would only feed an anisotropic lobe we do not
 * have).
 */

/**
 * Slopes from a heightfield: hs is S*S heights (scene units) on a
 * grid of spacing `step`, central differences (same stencil the old
 * normal bake used). Returns {sx, sz} Float64Arrays.
 */
export function slopesFromHeights(hs, S, step) {
  const sx = new Float64Array(S * S);
  const sz = new Float64Array(S * S);
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const iL = Math.max(i - 1, 0);
      const iR = Math.min(i + 1, S - 1);
      const jU = Math.max(j - 1, 0);
      const jD = Math.min(j + 1, S - 1);
      sx[j * S + i] = (hs[j * S + iR] - hs[j * S + iL]) / ((iR - iL) * step);
      sz[j * S + i] = (hs[jD * S + i] - hs[jU * S + i]) / ((jD - jU) * step);
    }
  }
  return {sx, sz};
}

/**
 * The moment pyramid: level 0 is S x S texels of
 * (sx, sz, sx^2, sz^2); each coarser level is the exact 2x2 box
 * mean of the finer one (double precision throughout). Returns
 * {levels: [{data: Float32Array, size}]} down to 1x1.
 */
export function buildMomentPyramid(sx, sz, S) {
  if ((S & (S - 1)) !== 0) throw new Error('pyramid needs power-of-two size');
  let cur = new Float64Array(S * S * 4);
  for (let k = 0; k < S * S; k++) {
    cur[k * 4] = sx[k];
    cur[k * 4 + 1] = sz[k];
    cur[k * 4 + 2] = sx[k] * sx[k];
    cur[k * 4 + 3] = sz[k] * sz[k];
  }
  const levels = [];
  let n = S;
  for (;;) {
    levels.push({data: Float32Array.from(cur), size: n});
    if (n === 1) break;
    const half = n >> 1;
    const next = new Float64Array(half * half * 4);
    for (let j = 0; j < half; j++) {
      for (let i = 0; i < half; i++) {
        for (let c = 0; c < 4; c++) {
          next[(j * half + i) * 4 + c] =
            0.25 *
            (cur[(2 * j * n + 2 * i) * 4 + c] +
              cur[(2 * j * n + 2 * i + 1) * 4 + c] +
              cur[((2 * j + 1) * n + 2 * i) * 4 + c] +
              cur[((2 * j + 1) * n + 2 * i + 1) * 4 + c]);
        }
      }
    }
    cur = next;
    n = half;
  }
  return {levels};
}

// Central slope variance (per axis) of one texel of a level.
export function texelVariance(level, i, j) {
  const k = (j * level.size + i) * 4;
  const d = level.data;
  return [
    Math.max(d[k + 2] - d[k] * d[k], 0),
    Math.max(d[k + 3] - d[k + 1] * d[k + 1], 0)
  ];
}
