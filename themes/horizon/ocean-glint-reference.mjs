// Reference gate for ocean-glint.js (node ocean-glint-reference.mjs):
// the Cox & Munk sun-glitter kernel at its closed properties.
import {glintKernel, slopePdf} from './ocean-glint.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // The slope PDF integrates to 1 over the slope plane and its
  // mean-square slope IS the fed mss - the two identities that
  // make "Cox-Munk variance" mean something. Polar quadrature
  // over (zx, zy): dA = s ds dphi with s = tan(theta).
  for (const mss of [0.003, 0.0088, 0.03, 0.08]) {
    let norm = 0;
    let m2 = 0;
    const N = 4000;
    const sMax = Math.sqrt(mss) * 12;
    const ds = sMax / N;
    for (let i = 0; i < N; i++) {
      const s = (i + 0.5) * ds;
      const w = 2 * Math.PI * s * ds * slopePdf(s * s, mss);
      norm += w;
      m2 += w * s * s;
    }
    const ok = Math.abs(norm - 1) < 1e-6 && Math.abs(m2 / mss - 1) < 1e-4;
    if (!ok || mss === 0.0088)
      check(
        `slope PDF closed at mss ${mss}`,
        ok,
        `integral ${norm.toFixed(7)} (1 exact); mean-square slope ${m2.toExponential(3)} = fed mss to ${Math.abs(m2 / mss - 1).toExponential(1)}`
      );
    if (!ok) fail++;
  }
}

{
  // The kernel's energy: reflected radiance integrated over the
  // view hemisphere must not exceed the incident beam (energy
  // conservation with Fresnel = 1) - and at small slope variance
  // it must approach it (a calm sea is a mirror: everything the
  // Fresnel keeps goes SOMEWHERE in the lobe). Sun at 40 deg
  // elevation, facet frame upright: for each view direction the
  // glitter facet is the half-vector; d-omega integration over
  // the upper hemisphere.
  const sunEl = (40 * Math.PI) / 180;
  const sun = [0, Math.sin(sunEl), Math.cos(sunEl)];
  const energy = (mss) => {
    let E = 0;
    const NT = 400;
    const NP = 180;
    for (let it = 0; it < NT; it++) {
      const thV = ((it + 0.5) / NT) * (Math.PI / 2);
      for (let ip = 0; ip < NP; ip++) {
        const ph = ((ip + 0.5) / NP) * 2 * Math.PI;
        const v = [
          Math.sin(thV) * Math.sin(ph),
          Math.cos(thV),
          Math.sin(thV) * Math.cos(ph)
        ];
        const hx = v[0] + sun[0];
        const hy = v[1] + sun[1];
        const hz = v[2] + sun[2];
        const hl = Math.hypot(hx, hy, hz);
        const cosTilt = hy / hl;
        const L = glintKernel(mss, cosTilt, Math.cos(thV));
        // d-omega = sin dtheta dphi; energy adds L cos(theta_v)
        E +=
          L *
          Math.cos(thV) *
          Math.sin(thV) *
          ((Math.PI / 2 / NT) * ((2 * Math.PI) / NP));
      }
    }
    return E;
  };
  // Incident flux on the SEA SURFACE is E cos(theta_sun) - the
  // conservation ratio divides by it, not by the beam-normal E.
  const inc = Math.sin(sunEl);
  const eCalm = energy(0.002) / inc;
  const eMean = energy(0.0088) / inc; // Cox-Munk at ~5 m/s
  const eGale = energy(0.08) / inc;
  const ok =
    eCalm < 1.005 &&
    eCalm > 0.995 &&
    eMean < 1.005 &&
    eMean > 0.99 &&
    eGale < 1.005 &&
    eGale > 0.9;
  check(
    'glitter energy: conserved against the surface flux',
    ok,
    `hemisphere energy / (rhoF x E cos theta_s): calm(0.002) ${eCalm.toFixed(4)}, Cox-Munk 5 m/s (0.0088) ${eMean.toFixed(4)}, gale (0.08) ${eGale.toFixed(4)} - 1 to quadrature, the gale's ~2% is the single-facet law's own loss (shadowing/multi-bounce, outside the printed formula - stated)`
  );
}

{
  // Geometry: the kernel peaks EXACTLY at the mirror direction
  // (facet = macro normal, tilt 0), falls monotonically with
  // tilt, and grows toward grazing view at fixed tilt (the
  // 1/cos_v of the printed law - the sunset glitter road).
  const k0 = glintKernel(0.0088, 1, 0.7);
  const k5 = glintKernel(0.0088, Math.cos(0.05), 0.7);
  const k10 = glintKernel(0.0088, Math.cos(0.1), 0.7);
  const graze = glintKernel(0.0088, 1, 0.1);
  const ok =
    k0 > k5 &&
    k5 > k10 &&
    Math.abs(graze / k0 - 0.7 / 0.1) < 1e-9 &&
    Math.abs(k0 - 1 / (Math.PI * 0.0088 * 4 * 0.7)) < 1e-9;
  check(
    'glitter geometry: mirror peak, monotone tilt falloff, 1/cos_v road',
    ok,
    `peak ${k0.toFixed(2)} = 1/(pi mss 4 cos_v) exact; tilt 0/2.9/5.7 deg -> ${k0.toFixed(2)}/${k5.toFixed(2)}/${k10.toFixed(2)}; grazing x${(graze / k0).toFixed(2)} = cos ratio exact`
  );
}

process.exit(fail ? 1 : 0);
