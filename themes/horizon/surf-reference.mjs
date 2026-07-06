// Reference printer for the Battjes-Janssen surf model
// (node surf-reference.mjs). The physics lives once in surf.js;
// this checks it against published landmarks:
//  - Qb solves its implicit equation to machine residual, with the
//    known magnitudes (Qb ~ 0.02 at Hrms/Hm = 0.5, -> 1 at 1)
//  - k(omega, d): T = 10 s in d = 10 m gives L = 92.3 m (standard
//    wave tables; deep-water L0 = 156.1 m)
//  - Battjes & Stive gamma: 0.627 at s0 = 0.01, 0.803 at 0.03
//  - a monotonic surf profile over the depth ramp for the project's
//    reference sea (Hs 2.5 m, Tp 13 s at 60 m reference depth)
import {
  buildSurfLUT,
  gammaBS,
  groupVelocity,
  probit,
  qbFraction,
  waveNumber
} from './surf.js';

for (const x of [0.3, 0.5, 0.707, 0.9, 0.99, 1.0]) {
  const q = qbFraction(x);
  const resid = q > 0 && q < 1 ? (1 - q) / Math.log(q) + x * x : 0;
  console.log(
    `REF Qb(${x}) = ${q.toExponential(4)}  residual ${resid.toExponential(1)}`
  );
}

{
  const T = 10;
  const omega = (2 * Math.PI) / T;
  const k = waveNumber(omega, 10);
  const L = (2 * Math.PI) / k;
  const L0 = (9.81 * T * T) / (2 * Math.PI);
  console.log(
    `REF dispersion: T=10s d=10m -> L = ${L.toFixed(1)} m (tables 92.3;` +
      ` L0 = ${L0.toFixed(1)})`
  );
  console.log(
    `REF cg: d=10m ${groupVelocity(omega, 10).toFixed(3)} m/s,` +
      ` deep ${groupVelocity(omega, 1e4).toFixed(3)} m/s` +
      ` (deep limit g T / 4 pi = ${((9.81 * T) / (4 * Math.PI)).toFixed(3)})`
  );
}

console.log(
  `REF gammaBS: s0=0.01 -> ${gammaBS(0.01).toFixed(3)} (0.627),` +
    ` s0=0.03 -> ${gammaBS(0.03).toFixed(3)} (0.803)`
);

// AS 241 probit against published quantiles, and the coverage
// roundtrip: numeric Phi(z) must give back 1 - Qb (the crest mask
// eta > z sigma then covers exactly Qb of the Gaussian sea).
{
  console.log(
    `REF probit: 0.975 -> ${probit(0.975).toFixed(6)} (1.959964),` +
      ` 0.5 -> ${probit(0.5).toFixed(6)},` +
      ` 0.02 -> ${probit(0.02).toFixed(6)} (-2.053749)`
  );
  const phi = (z) => {
    // Phi(z) = 0.5 + integral of the normal pdf over [0, z], by fine
    // midpoint quadrature (sign-aware).
    const M = 400000;
    const dz = Math.abs(z) / M || 1e-12;
    let acc = 0;
    for (let i = 0; i < M; i++) {
      const t = (i + 0.5) * dz;
      acc += (Math.exp((-t * t) / 2) / Math.sqrt(2 * Math.PI)) * dz;
    }
    return 0.5 + Math.sign(z) * acc;
  };
  let worst = 0;
  for (const qb of [0.02, 0.2, 0.5, 0.9]) {
    const z = probit(1 - qb);
    worst = Math.max(worst, Math.abs(1 - phi(z) - qb));
  }
  console.log(
    `REF probit coverage roundtrip: worst |dQb| = ${worst.toExponential(1)}`
  );
}

// The project's reference sea over the harness depth ramp.
{
  const lut = buildSurfLUT({hs: 2.5, tp: 13, depthRef: 60});
  const at = (d) => {
    const i = Math.min(Math.floor((d / 40) * 256), 255);
    return [lut[i * 4], lut[i * 4 + 1]];
  };
  for (const d of [1, 2, 4, 6, 10, 20, 40]) {
    const [qb, z] = at(d);
    console.log(`REF surf at d=${d} m: Qb ${qb.toFixed(4)}  z ${z.toFixed(3)}`);
  }
  let mono = true;
  for (let i = 1; i < 256; i++)
    if (lut[i * 4] > lut[(i - 1) * 4] + 1e-9) mono = false;
  console.log(`REF surf profile monotonic (deeper -> calmer): ${mono}`);
}

// The measured-tide depth chain (Horizon bakes SIGNED bathymetry
// clamp(-e/40, -1, 1); water-tsl computes max(store*40 + tide, 0)):
// equal to the true local depth max(tide - e, 0) for every bed
// elevation within the +-40 m float range, at any tide - the surf
// breakpoint migrates with the water level exactly.
{
  let worst = 0;
  for (const e of [-35, -12, -3, -0.4, 0, 0.4, 2, 25]) {
    for (const tide of [-2, -0.7, 0, 0.9, 1.8]) {
      const store = Math.min(Math.max(-e / 40, -1), 1);
      const d = Math.max(store * 40 + tide, 0);
      worst = Math.max(worst, Math.abs(d - Math.max(tide - e, 0)));
    }
  }
  console.log(
    `REF tide depth chain: worst |d - max(tide-e,0)| = ${worst.toExponential(1)} over e in [-35,25] m, tide in [-2,1.8] m`
  );
  if (worst > 1e-12) {
    console.log('TIDE DEPTH CHAIN FAILED');
    process.exit(1);
  }
}
