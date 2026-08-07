// CPU mirror of the Hillaire transmittance integral, so the sun's
// light on the terrain carries its true transmitted colour (sunset
// reddening included) without a per-frame GPU readback. Kept in
// double precision alongside the TSL LUT chain; atmo-reference.mjs is
// the ground truth both are held to.
//
// mie = {scat: [r,g,b], abs: [r,g,b], fDiff?: [r,g,b]} - the same
// per-channel coefficients (1/m at profile h = 0) the shader
// uniforms carry, from aerosol.js (measured GEFS-Aerosols channel
// set, or the Hillaire defaults calibrated to the measured total
// AOD). fDiff, when present, is the aureole pass's delta split
// (aureole.js): the DIRECT beam then carries the coarse-mode
// forward-diffracted share too - the delta-scaled Beer law
// sigma_ext - f sigma_s, exactly the T' every march runs on - so
// the ground's direct light stops losing energy that in fact
// arrives within the quasi-direct cone. Callers whose light is
// the truly UNSCATTERED image (the sunset band's drawn disc: the
// photosphere at sub-degree scale, where 1-3 deg diffracted light
// does not land) pass no fDiff and keep the pure Beer-Lambert;
// the airglow zenith factor also stays unscaled (an extended
// diffuse source is unchanged by forward redistribution to first
// order).
//
// hObs: observer height above the ground sphere in metres. The
// historical callers (sun light tint, airglow zenith) keep the
// original 300 m default; the sunset band feeds the EXACT camera
// altitude - the 2D transmittance LUT's bilinear blend across its
// ~100 m-spaced radius rows mixes transmittances of neighbouring
// grazing geometries (a small but real channel-ratio error at the
// horizon: 0.5% R/G at 130 m per atmo-reference), so the band's
// texture is built from this integral at the true radius instead.
// The same integral cut at the first crossing of radius
// Rb + hTop: the SEGMENT transmittance from the observer to a
// target shell (the twilight pillar's view leg, eye to the
// cirrus deck). The closure identity T_full(eye) = T_seg(eye ->
// deck) x T_full(deck, local direction cosine at the crossing)
// - straight-line geometry, mu' = (r mu + d) / r' - is the
// gate's landmark: the two marches must agree on the same ray.
export function pathToRadiusT(cosZenith, mie, hObs = 300, hTopM = 11020) {
  const Rb = 6360e3;
  const rt = Rb + hTopM;
  const r = Rb + hObs;
  if (r >= rt) return [1, 1, 1];
  const mu = cosZenith;
  const b = r * mu;
  const disc = b * b + rt * rt - r * r;
  if (disc < 0) return [1, 1, 1];
  const d = -b + Math.sqrt(disc);
  if (d <= 0) return [1, 1, 1];
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
  const mieExt = (c) =>
    (mie.scat[c] * (1 - (mie.fDiff ? mie.fDiff[c] : 0)) + mie.abs[c]) * tm;
  const oz = (mie.ozScale ?? 1) * to;
  return [
    Math.exp(-(5.802e-6 * tr + mieExt(0) + 0.65e-6 * oz)),
    Math.exp(-(13.558e-6 * tr + mieExt(1) + 1.881e-6 * oz)),
    Math.exp(-(33.1e-6 * tr + mieExt(2) + 0.085e-6 * oz))
  ];
}

export function sunTransmittanceJS(cosZenith, mie, hObs = 300) {
  const Rb = 6360e3;
  const Rt = 6460e3;
  const r = Rb + hObs;
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
  const mieExt = (c) =>
    (mie.scat[c] * (1 - (mie.fDiff ? mie.fDiff[c] : 0)) + mie.abs[c]) * tm;
  // Measured column ozone (ozone.js): DU/300 scales the term, 1
  // when unmeasured - the same linear correction the shader's
  // ozScale uniform applies.
  const oz = (mie.ozScale ?? 1) * to;
  return [
    Math.exp(-(5.802e-6 * tr + mieExt(0) + 0.65e-6 * oz)),
    Math.exp(-(13.558e-6 * tr + mieExt(1) + 1.881e-6 * oz)),
    Math.exp(-(33.1e-6 * tr + mieExt(2) + 0.085e-6 * oz))
  ];
}

// The SETTING DISC: visible photosphere fraction of a uniform
// disc of angular radius angR whose centre sits at APPARENT
// altitude altApp behind a straight horizon - the circular
// segment in closed form (discObscuration's two-circle lens in
// the occluder-radius -> infinity limit). Half at centre-set
// exactly; refraction belongs in the caller's altApp. Limb
// darkening is deliberately ignored here (a ~% effect on the
// last half-degree, stated) - the drawn disc keeps its own
// Hestroffer & Magnan law.
export function discVisibleFrac(altAppRad, angRRad) {
  if (!(angRRad > 0)) return altAppRad > 0 ? 1 : 0;
  const x = altAppRad / angRRad;
  if (x >= 1) return 1;
  if (x <= -1) return 0;
  return (Math.acos(-x) + x * Math.sqrt(1 - x * x)) / Math.PI;
}
