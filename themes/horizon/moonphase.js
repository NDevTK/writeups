/**
 * The moon's disk-integrated Hapke phase curve - the single
 * source shared by the reference printer (moon-reference.mjs,
 * which holds it to Rougier's observed curve) and the theme's
 * PARASELENIC optics (Horizon.html: the 22-deg halo, moon dogs
 * and moonbows around the moon scale with how much light the
 * moon actually sends - this curve).
 *
 * Hapke (1981) IMSA with the (2002) H-function approximation and
 * the SHOE opposition surge, single-lobe Henyey-Greenstein;
 * lunar parameters from Helfenstein & Veverka (1987):
 *   w = 0.21, B0 = 2.0, h = 0.07, xi = -0.18.
 */

export const W_SS = 0.21;
export const B0 = 2.0;
export const HW = 0.07;
export const XI = -0.18;

const GAMMA = Math.sqrt(1 - W_SS);
const R0 = (1 - GAMMA) / (1 + GAMMA);

export const hapkeHfn = (x) =>
  1 / (1 - W_SS * x * (R0 + ((1 - 2 * R0 * x) / 2) * Math.log((1 + x) / x)));
export const hgP = (g) =>
  (1 - XI * XI) / Math.pow(1 + 2 * XI * Math.cos(g) + XI * XI, 1.5);
export const shoeB = (g) => B0 / (1 + Math.tan(g / 2) / HW);

// Disk-resolved bidirectional reflectance (times 4pi/w).
export function hapkeR(mu0, mu, g) {
  if (mu0 <= 0) return 0;
  return (
    (mu0 / (mu0 + mu)) *
    ((1 + shoeB(g)) * hgP(g) + hapkeHfn(mu0) * hapkeHfn(mu) - 1)
  );
}

// Disk-integrated brightness at phase angle g (deg): integrate
// over the visible lit disc, viewer along +z.
export function diskIntegrated(gDeg, N = 400) {
  const g = (gDeg * Math.PI) / 180;
  const sun = [Math.sin(g), 0, Math.cos(g)];
  let sum = 0;
  for (let iy = 0; iy < N; iy++) {
    for (let ix = 0; ix < N; ix++) {
      const x = ((ix + 0.5) / N) * 2 - 1;
      const y = ((iy + 0.5) / N) * 2 - 1;
      const rr = x * x + y * y;
      if (rr > 1) continue;
      const z = Math.sqrt(1 - rr);
      sum += hapkeR(x * sun[0] + z * sun[2], z, g);
    }
  }
  return sum;
}

// Brightness relative to full moon at phase angle g (deg) - the
// theme's per-frame value (evaluated at 1 Hz with a coarse but
// converged grid; the reference holds the N=400 curve).
const FULL = diskIntegrated(0.01, 120);
export function relPhase(gDeg) {
  return diskIntegrated(Math.max(gDeg, 0.01), 120) / FULL;
}
