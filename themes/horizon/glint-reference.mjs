// Reference printer for the Zirr-Kaplanyan snow glints
// (node glint-reference.mjs). The model lives once in
// snow-glints.js; this checks:
//  - pcg3d test vectors (the GPU probe must print the same integers)
//  - the GGX NDF is projected-area normalised (int D cos dm = 1)
//  - the hash-driven Poisson counts reproduce Poisson moments and
//    E[N / nbar] = 1 (energy conservation)
//  - the full glint factor: mean 1 at every scale, variance dying
//    as the footprint grows (convergence to the smooth lobe)
import {
  ALPHA_G,
  CELL0,
  ggxD,
  glintFactor,
  OMEGA_G,
  pcg3d,
  poissonCount,
  RHO,
  smithV
} from './snow-glints.js';

for (const [x, y, z] of [
  [0, 0, 0],
  [1, 2, 3],
  [-7, 123456, 42],
  [2147483647, -2147483648, 999999999]
]) {
  const v = pcg3d(x | 0, y | 0, z | 0);
  console.log(`REF pcg3d(${x},${y},${z}) = ${v[0]} ${v[1]} ${v[2]}`);
}

{
  // int D(m) cos dm over the hemisphere (polar quadrature).
  let I = 0;
  const M = 200000;
  for (let i = 0; i < M; i++) {
    const th = ((i + 0.5) / M) * (Math.PI / 2);
    I +=
      ggxD(Math.cos(th), ALPHA_G) *
      Math.cos(th) *
      Math.sin(th) *
      (Math.PI / 2 / M) *
      2 *
      Math.PI;
  }
  console.log(`REF ggx projected-area integral = ${I.toFixed(5)} (1)`);
  console.log(
    `REF smithV(1,1,${ALPHA_G}) = ${smithV(1, 1, ALPHA_G).toFixed(4)} (0.25 =` +
      ` 1/(4 cosv cosl) limit)`
  );
}

// Hash-driven Poisson: moments and energy over 200k cells.
for (const nbar of [0.02, 0.5, 2.5]) {
  let m = 0;
  let m2 = 0;
  const M = 200000;
  for (let i = 0; i < M; i++) {
    const u = pcg3d(i, 17, 4242)[0] / 4294967296;
    const n = poissonCount(u, nbar);
    m += n;
    m2 += n * n;
  }
  m /= M;
  m2 /= M;
  console.log(
    `REF poisson nbar=${nbar}: mean ${m.toFixed(4)} var ${(m2 - m * m).toFixed(
      4
    )} E[N/nbar] ${(m / nbar).toFixed(4)}`
  );
}

// Full factor statistics across a snow field at three footprints:
// mean must be 1 (energy) at all scales; the sparse scale must have
// huge relative variance (that IS the sparkle), the coarse scale
// must be quiet (converged to the smooth lobe).
{
  const pHit = ggxD(0.995, ALPHA_G) * 0.995 * OMEGA_G;
  console.log(
    `REF p(h) near peak = ${pHit.toExponential(3)}, nbar in a finest cell =` +
      ` ${(RHO * CELL0 * CELL0 * pHit).toExponential(3)}`
  );
  for (const a of [0.04, 0.5, 8]) {
    let m = 0;
    let m2 = 0;
    const M = 40000;
    for (let i = 0; i < M; i++) {
      const x = (i % 200) * 1.37;
      const z = Math.floor(i / 200) * 1.61;
      const f = glintFactor(x, z, a, [31, 7, 90], pHit);
      m += f;
      m2 += f * f;
    }
    m /= M;
    m2 /= M;
    const rsd = Math.sqrt(Math.max(m2 - m * m, 0)) / m;
    console.log(
      `REF factor a=${a} m: mean ${m.toFixed(3)} rel-sd ${rsd.toFixed(3)}`
    );
  }
}
