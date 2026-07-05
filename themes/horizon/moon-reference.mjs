// Double-precision reference of the moon's Hapke photometry
// (node moon-reference.mjs). Mirrors sky-objects-tsl.js exactly:
// Hapke (1981) IMSA with the (2002) H-function approximation and the
// SHOE opposition surge, single-lobe Henyey-Greenstein, lunar
// parameters from Helfenstein & Veverka (1987):
//   w = 0.21, B0 = 2.0, h = 0.07, xi = -0.18
// (macroscopic roughness theta-bar omitted - sub-pixel at the
// theme's 6-px disc; documented, not hidden).
//
// Sanity target: the disk-integrated phase curve. Observed lunar
// V-band (Rougier 1933): brightness at 90 deg phase is ~8% of full
// moon; the ~40% step from the opposition surge inside |g| < 7 deg.
const W = 0.21;
const B0 = 2.0;
const HW = 0.07;
const XI = -0.18;

const gamma = Math.sqrt(1 - W);
const r0 = (1 - gamma) / (1 + gamma);
const H = (x) =>
  1 / (1 - W * x * (r0 + ((1 - 2 * r0 * x) / 2) * Math.log((1 + x) / x)));
const P = (g) =>
  (1 - XI * XI) / Math.pow(1 + 2 * XI * Math.cos(g) + XI * XI, 1.5);
const B = (g) => B0 / (1 + Math.tan(g / 2) / HW);

// Disk-resolved bidirectional reflectance (times 4pi/w).
function r(mu0, mu, g) {
  if (mu0 <= 0) return 0;
  return (mu0 / (mu0 + mu)) * ((1 + B(g)) * P(g) + H(mu0) * H(mu) - 1);
}
// Full-moon disc-centre value - the normalisation anchor that keeps
// the theme's calibrated full-moon brightness.
const R_FULL_CENTRE = r(1, 1, 0);
console.log('REF hapke: r_full_centre =', R_FULL_CENTRE.toFixed(5));

// Disk-integrated brightness at phase angle g: integrate over the
// visible+lit disc. Surface normal n on the unit sphere; sun at
// angle g from the viewer.
function diskIntegrated(gDeg) {
  const g = (gDeg * Math.PI) / 180;
  const sun = [Math.sin(g), 0, Math.cos(g)];
  const N = 400;
  let sum = 0;
  for (let iy = 0; iy < N; iy++) {
    for (let ix = 0; ix < N; ix++) {
      const x = ((ix + 0.5) / N) * 2 - 1;
      const y = ((iy + 0.5) / N) * 2 - 1;
      const rr = x * x + y * y;
      if (rr > 1) continue;
      const z = Math.sqrt(1 - rr);
      const mu = z; // viewer along +z
      const mu0 = x * sun[0] + z * sun[2];
      sum += r(mu0, mu, g);
    }
  }
  return sum;
}

const full = diskIntegrated(0.01);
for (const g of [0.01, 5, 20, 45, 90, 120]) {
  console.log(
    `REF phase g=${String(g).padStart(5)} deg: I/I_full = ${(
      diskIntegrated(g) / full
    ).toFixed(4)}`
  );
}
