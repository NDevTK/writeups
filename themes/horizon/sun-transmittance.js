// CPU mirror of the Hillaire transmittance integral, so the sun's
// light on the terrain carries its true transmitted colour (sunset
// reddening included) without a per-frame GPU readback. Kept in
// double precision alongside the TSL LUT chain; atmo-reference.mjs is
// the ground truth both are held to.
//
// mie = {scat: [r,g,b], abs: [r,g,b]} - the same per-channel
// coefficients (1/m at profile h = 0) the shader uniforms carry,
// from aerosol.js (measured GEFS-Aerosols channel set, or the
// Hillaire defaults calibrated to the measured total AOD).
export function sunTransmittanceJS(cosZenith, mie) {
  const Rb = 6360e3;
  const Rt = 6460e3;
  const r = Rb + 300;
  const mu = cosZenith;
  const b = r * mu;
  // Below the horizon the planet itself shadows the sun.
  if (mu < 0 && b * b - (r * r - Rb * Rb) > 0) return [0, 0, 0];
  const disc = b * b - (r * r - Rt * Rt);
  if (disc < 0) return [0, 0, 0];
  const d = -b + Math.sqrt(disc);
  if (d <= 0) return [0, 0, 0];
  const N = 32;
  const dt = d / N;
  let tr = 0;
  let tm = 0;
  let to = 0;
  for (let i = 0; i < N; i++) {
    const ti = (i + 0.5) * dt;
    const h = Math.sqrt(r * r + ti * ti + 2 * r * ti * mu) - Rb;
    tr += Math.exp(-h / 8000) * dt;
    tm += Math.exp(-h / 1200) * dt;
    to += Math.max(0, 1 - Math.abs(h - 25e3) / 15e3) * dt;
  }
  const mieExt = (c) => (mie.scat[c] + mie.abs[c]) * tm;
  return [
    Math.exp(-(5.802e-6 * tr + mieExt(0) + 0.65e-6 * to)),
    Math.exp(-(13.558e-6 * tr + mieExt(1) + 1.881e-6 * to)),
    Math.exp(-(33.1e-6 * tr + mieExt(2) + 0.085e-6 * to))
  ];
}
