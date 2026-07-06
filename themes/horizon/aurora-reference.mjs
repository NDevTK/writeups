// Reference printer for the physical aurora (node
// aurora-reference.mjs). The chain lives once in aurora-lut.js; this
// checks it against published landmarks:
//  - CIRA-72 atmosphere self-consistency (mass density at 100/200 km
//    near the USSA76 values 5.6e-10 / 2.5e-13 g/cm^3)
//  - Fang 2010: f(y) integrates to ~1 over y (energy conservation of
//    the fitted dissipation) and ionization peak altitudes sweep
//    down with energy - ~230 km at 0.1 keV to ~105 km at 10 keV
//    (their figure 2 behaviour)
//  - O(1D) quenching kills 630.0 nm below ~200 km and the
//    red/green column ratio grows as precipitation softens
//  - line colors from the CIE fits: 557.7 green, 630.0 red,
//    427.8 violet-blue
import {
  ATMO_ROWS,
  buildAuroraLUT,
  fangF,
  qMaxwellian,
  quench1D,
  wavelengthToLinearSRGB,
  Z_MAX,
  Z_MIN
} from './aurora-lut.js';

{
  const r100 = ATMO_ROWS.find((r) => r.z === 100);
  const r200 = ATMO_ROWS.find((r) => r.z === 200);
  console.log(
    `REF atmo rho(100) = ${r100.rho.toExponential(2)} g/cm^3 (USSA76 5.60e-10),` +
      ` rho(200) = ${r200.rho.toExponential(2)} (2.54e-13)`
  );
  console.log(
    `REF atmo column(100) = ${r100.col.toExponential(3)} g/cm^2,` +
      ` H(120) = ${(ATMO_ROWS.find((r) => r.z === 120).H / 1e5).toFixed(1)} km`
  );
}

for (const E of [1, 10]) {
  // integral of f over the FITTED y domain, at auroral energies:
  // below 1 because isotropic incidence loses a real
  // backscattered-albedo fraction (largest for soft electrons),
  // approaching ~1 for hard ones.
  let I = 0;
  const M = 4000;
  const l0 = Math.log(0.03);
  const l1 = Math.log(30);
  for (let k = 0; k < M; k++) {
    const y = Math.exp(l0 + ((l1 - l0) * (k + 0.5)) / M);
    I += fangF(y, E) * y * ((l1 - l0) / M);
  }
  console.log(
    `REF fang int f dy (E=${E} keV, fitted domain) = ${I.toFixed(3)}`
  );
}

{
  const peaks = [];
  for (const E of [0.1, 0.3, 1, 3, 10, 30]) {
    const q = qMaxwellian(E === 0.1 ? 0.1 : E); // Maxwellian at E0
    let bi = 0;
    for (let i = 0; i < q.length; i++) if (q[i] > q[bi]) bi = i;
    peaks.push([E, ATMO_ROWS[bi].z]);
  }
  console.log(
    'REF ionization peak km vs E0 keV: ' +
      peaks.map(([e, z]) => `${e}:${z}`).join(' ')
  );
  let mono = true;
  for (let i = 1; i < peaks.length; i++)
    if (peaks[i][1] > peaks[i - 1][1]) mono = false;
  console.log(`REF peaks harden downward monotonically: ${mono}`);
}

{
  const q200 = quench1D(ATMO_ROWS.find((r) => r.z === 200));
  const q150 = quench1D(ATMO_ROWS.find((r) => r.z === 150));
  const q110 = quench1D(ATMO_ROWS.find((r) => r.z === 110));
  const q300 = quench1D(ATMO_ROWS.find((r) => r.z === 300));
  console.log(
    `REF O(1D) survival: 110 km ${q110.toExponential(1)},` +
      ` 150 km ${q150.toFixed(3)}, 200 km ${q200.toFixed(3)},` +
      ` 300 km ${q300.toFixed(3)}`
  );
}

{
  // red/green column ratio vs hardness (soft -> red type-d aurora).
  const ratio = (E0) => {
    const lut = buildAuroraLUT(E0);
    let red = 0;
    let green = 0;
    for (let b = 0; b < lut.bins; b++) {
      red += lut.data[b * 4];
      green += lut.data[b * 4 + 1];
    }
    return red / green;
  };
  const soft = ratio(0.3);
  const hard = ratio(5);
  console.log(
    `REF 6300/5577 column ratio: E0=0.3 keV ${soft.toFixed(2)},` +
      ` E0=5 keV ${hard.toFixed(2)} (soft precipitation redder: ${soft > hard})`
  );
}

{
  const lut = buildAuroraLUT(3);
  const zOf = (b) => Z_MIN + ((b + 0.5) / lut.bins) * (Z_MAX - Z_MIN);
  let bg = 0;
  let br = 0;
  for (let b = 0; b < lut.bins; b++) {
    if (lut.data[b * 4 + 1] > lut.data[bg * 4 + 1]) bg = b;
    if (lut.data[b * 4] > lut.data[br * 4]) br = b;
  }
  console.log(
    `REF E0=3 keV: 5577 peak ${zOf(bg).toFixed(0)} km,` +
      ` 6300 peak ${zOf(br).toFixed(0)} km (red above green: ${br > bg})`
  );
}

for (const nm of [557.7, 630.0, 427.8]) {
  const [r, g, b] = wavelengthToLinearSRGB(nm);
  console.log(
    `REF line ${nm} nm -> linear sRGB (${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)})`
  );
}
