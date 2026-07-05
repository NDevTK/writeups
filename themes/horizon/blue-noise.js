/**
 * Void-and-cluster blue-noise mask (Ulichney 1993, "The
 * void-and-cluster method for dither array generation", SPIE 1913).
 * Full algorithm, not an approximation: prototype relaxation (phase
 * 0), then the three rank-assignment phases - remove tightest
 * clusters below the prototype count, fill largest voids to the
 * half-way point, then track the 0-minority's tightest clusters to
 * the end. Toroidal Gaussian energy (sigma 1.5, Ulichney's value),
 * seeded LCG for the initial pattern so every session and backend
 * generates the identical mask.
 *
 * Returns the full rank ordering (0 .. N*N-1): rank/N^2 is a
 * uniformly distributed threshold with a blue (high-frequency) power
 * spectrum - neighbouring pixels get maximally different values,
 * which is exactly what a raymarch jitter wants (the white-noise
 * hash it replaces clumps: nearby pixels can start their marches in
 * phase, and the un-converged temporal estimate shows it as
 * low-frequency mottle).
 */
export function generateBlueNoise(N = 64, sigma = 1.5) {
  const n = N * N;

  // Toroidal Gaussian kernel, indexed by wrapped (dx, dy).
  const k = new Float64Array(n);
  for (let dy = 0; dy < N; dy++) {
    for (let dx = 0; dx < N; dx++) {
      const wx = Math.min(dx, N - dx);
      const wy = Math.min(dy, N - dy);
      k[dy * N + dx] = Math.exp(-(wx * wx + wy * wy) / (2 * sigma * sigma));
    }
  }

  const energy = new Float64Array(n);
  const bin = new Uint8Array(n);
  const splat = (i, sign) => {
    const x = i % N;
    const y = (i / N) | 0;
    for (let yy = 0; yy < N; yy++) {
      const ky = (yy - y + N) % N;
      const row = ky * N;
      const out = yy * N;
      for (let xx = 0; xx < N; xx++) {
        energy[out + xx] += sign * k[row + ((xx - x + N) % N)];
      }
    }
  };

  let seed = 0x9e3779b9 >>> 0;
  const rand = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;

  // Initial binary pattern: ~10% minority pixels.
  const count = Math.floor(n / 10);
  let placed = 0;
  while (placed < count) {
    const i = Math.floor(rand() * n);
    if (!bin[i]) {
      bin[i] = 1;
      splat(i, 1);
      placed++;
    }
  }

  const tightestOne = () => {
    let bi = -1;
    let bv = -Infinity;
    for (let i = 0; i < n; i++) {
      if (bin[i] && energy[i] > bv) {
        bv = energy[i];
        bi = i;
      }
    }
    return bi;
  };
  const largestVoid = () => {
    let bi = -1;
    let bv = Infinity;
    for (let i = 0; i < n; i++) {
      if (!bin[i] && energy[i] < bv) {
        bv = energy[i];
        bi = i;
      }
    }
    return bi;
  };

  // Phase 0: relax to the prototype pattern - move the tightest
  // cluster into the largest void until they coincide.
  for (;;) {
    const c = tightestOne();
    bin[c] = 0;
    splat(c, -1);
    const v = largestVoid();
    bin[v] = 1;
    splat(v, 1);
    if (v === c) break;
  }

  const rank = new Int32Array(n).fill(-1);
  const proto = bin.slice();

  // Phase 1: ranks count-1 .. 0 by removing tightest clusters.
  for (let r = count - 1; r >= 0; r--) {
    const c = tightestOne();
    bin[c] = 0;
    splat(c, -1);
    rank[c] = r;
  }

  // Restore the prototype and its energy field.
  bin.set(proto);
  energy.fill(0);
  for (let i = 0; i < n; i++) if (bin[i]) splat(i, 1);

  // Phase 2: fill largest voids up to the half-way point.
  for (let r = count; r < n >> 1; r++) {
    const v = largestVoid();
    bin[v] = 1;
    splat(v, 1);
    rank[v] = r;
  }

  // Phase 3: the 0s are the minority now - rebuild the energy field
  // over them and consume their tightest clusters.
  energy.fill(0);
  for (let i = 0; i < n; i++) if (!bin[i]) splat(i, 1);
  for (let r = n >> 1; r < n; r++) {
    let bi = -1;
    let bv = -Infinity;
    for (let i = 0; i < n; i++) {
      if (!bin[i] && energy[i] > bv) {
        bv = energy[i];
        bi = i;
      }
    }
    bin[bi] = 1;
    splat(bi, -1);
    rank[bi] = r;
  }

  return {rank, N};
}
