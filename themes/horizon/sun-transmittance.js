// CPU mirror of the Hillaire transmittance integral, so the sun's
// light on the terrain carries its true transmitted colour (sunset
// reddening included) without a per-frame GPU readback. Kept in
// double precision alongside the TSL LUT chain; atmo-reference.mjs is
// the ground truth both are held to.
export function sunTransmittanceJS(cosZenith, mieScale) {
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
  // Mie extinction 4.440e-6 = scattering 3.996e-6 + absorption
  // 4.44e-7 (Hillaire 2020, SSA 0.9) - same split as the shader.
  const mie = (3.996e-6 + 4.44e-7) * mieScale * tm;
  return [
    Math.exp(-(5.802e-6 * tr + mie + 0.65e-6 * to)),
    Math.exp(-(13.558e-6 * tr + mie + 1.881e-6 * to)),
    Math.exp(-(33.1e-6 * tr + mie + 0.085e-6 * to))
  ];
}
