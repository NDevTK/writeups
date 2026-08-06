// kelvin-reference.mjs - the gate for the ship-wake wedge.
// Landmarks, all closed forms the construction must reproduce:
//  - the group ratio's two exact limits (1 in shallow, 1/2 deep)
//  - the deep-water Kelvin angle: sin(alpha) = 1/3 EXACTLY
//    (Thomson 1887), speed-independent
//  - Havelock's widening: alpha rises monotonically toward 90 deg
//    as the depth Froude number approaches 1 from below
//  - the supercritical Mach cone: sin(alpha) = 1/Frh emerges from
//    the same maximisation (n -> 1 non-dispersive limit), pinned
//    at Frh = 1.5 and 2.0
//  - the deep-water maximising component sits at cos^2 = 2/3
//    (the classic cusp), verified through the ray formula
import {
  depthFroude,
  G_M_S2,
  groupRatio,
  KELVIN_DEEP_RAD,
  wedgeHalfAngleRad
} from './kelvin.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const DEG = 180 / Math.PI;

{
  check(
    'group ratio limits',
    Math.abs(groupRatio(1e-9) - 1) < 1e-9 &&
      Math.abs(groupRatio(30) - 0.5) < 1e-9 &&
      groupRatio(1) > 0.5 &&
      groupRatio(1) < 1,
    `n(0) = 1 (non-dispersive shallow), n(inf) = 1/2 (deep); intermediate strictly between`
  );
}

{
  // Deep water: the wedge is Kelvin's 19.47 deg, sin = 1/3
  // exactly, and the same for ANY small Frh (speed-independent -
  // the scale-free property that makes the deep wake universal).
  const a1 = wedgeHalfAngleRad(0.05);
  const a2 = wedgeHalfAngleRad(0.005);
  check(
    'Kelvin deep angle',
    Math.abs(Math.sin(KELVIN_DEEP_RAD) - 1 / 3) < 1e-15 &&
      Math.abs(a1 - KELVIN_DEEP_RAD) < 2e-4 &&
      Math.abs(a2 - KELVIN_DEEP_RAD) < 2e-4,
    `sin(alpha) = 1/3 closed form -> ${(KELVIN_DEEP_RAD * DEG).toFixed(4)} deg; the scan reproduces it at Frh 0.05 and 0.005 (speed-independent)`
  );
}

{
  // The deep-water maximising component: cos^2(theta) = 2/3 (the
  // cusp). Plugging it into the ray formula with n = 1/2 gives
  // tan(psi) = 1/(2 sqrt 2), whose sine is exactly 1/3.
  const c2 = 2 / 3;
  const tanPsi = (0.5 * Math.sqrt(c2) * Math.sqrt(1 - c2)) / (1 - 0.5 * c2);
  check(
    'deep cusp component',
    Math.abs(tanPsi - 1 / (2 * Math.sqrt(2))) < 1e-15 &&
      Math.abs(Math.sin(Math.atan(tanPsi)) - 1 / 3) < 1e-15,
    `cos^2(theta*) = 2/3 -> tan(psi) = 1/(2 sqrt 2) -> sin(psi) = 1/3, the same closed form by the independent route`
  );
}

{
  // Havelock's widening toward the critical depth Froude number.
  const a6 = wedgeHalfAngleRad(0.6);
  const a9 = wedgeHalfAngleRad(0.9);
  const a99 = wedgeHalfAngleRad(0.99);
  check(
    'Havelock widening',
    a6 > KELVIN_DEEP_RAD &&
      a9 > a6 &&
      a99 > a9 &&
      a99 > 60 / DEG &&
      wedgeHalfAngleRad(0.3) - KELVIN_DEEP_RAD < 0.5 / DEG,
    `alpha(0.6) = ${(a6 * DEG).toFixed(1)}, alpha(0.9) = ${(a9 * DEG).toFixed(1)}, alpha(0.99) = ${(a99 * DEG).toFixed(1)} deg - monotone toward 90; at Frh 0.3 still within half a degree of Kelvin`
  );
}

{
  // Supercritical: the Mach cone emerges. sin(alpha) = 1/Frh.
  const a15 = wedgeHalfAngleRad(1.5);
  const a20 = wedgeHalfAngleRad(2.0);
  check(
    'supercritical Mach cone',
    Math.abs(Math.sin(a15) - 1 / 1.5) < 2e-3 &&
      Math.abs(Math.sin(a20) - 0.5) < 2e-3,
    `sin(alpha) at Frh 1.5 -> ${Math.sin(a15).toFixed(4)} (2/3), at 2.0 -> ${Math.sin(a20).toFixed(4)} (1/2) - the non-dispersive limit is the Mach angle`
  );
}

{
  // The Frh = 3 crossover: the supercritical Mach cone
  // sin(alpha) = 1/Frh passes EXACTLY through the deep Kelvin
  // sine 1/3 at Frh = 3 - two entirely different constructions
  // (the dispersive cusp maximisation and the non-dispersive
  // Mach front) meeting at one number. Only beyond Frh = 3 is a
  // wake NARROWER than Kelvin's; between 1 and 3 the cone is
  // WIDER (43.6 deg at 1.5) - the trap a "fast boats have narrow
  // wakes" intuition falls into.
  const a3 = wedgeHalfAngleRad(3.0);
  const a4 = wedgeHalfAngleRad(4.0);
  check(
    'Frh = 3 crossover',
    Math.abs(a3 - KELVIN_DEEP_RAD) < 2e-3 &&
      a4 < a3 &&
      Math.abs(Math.sin(a4) - 0.25) < 2e-3 &&
      wedgeHalfAngleRad(1.5) > KELVIN_DEEP_RAD,
    `alpha(3.0) = ${((a3 * 180) / Math.PI).toFixed(2)} deg = the deep Kelvin angle by the OTHER construction; alpha(4.0) = ${((a4 * 180) / Math.PI).toFixed(2)} deg, finally narrower; alpha(1.5) is WIDER than Kelvin`
  );
}

{
  // The Froude helper: 12 kt over 10 m of water is subcritical
  // (0.62); the same speed over 1 m is supercritical (1.97).
  const u = 12 * 0.514444;
  check(
    'depth Froude',
    Math.abs(depthFroude(u, 10) - u / Math.sqrt(G_M_S2 * 10)) < 1e-15 &&
      depthFroude(u, 10) < 1 &&
      depthFroude(u, 1) > 1,
    `12 kt: Frh(10 m) = ${depthFroude(u, 10).toFixed(2)} subcritical, Frh(1 m) = ${depthFroude(u, 1).toFixed(2)} supercritical`
  );
}

process.exit(fail ? 1 : 0);
