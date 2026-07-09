// Double-precision JS reference of the Hillaire chain (node atmo-reference.mjs).
// Mirrors the GLSL/TSL exactly (LUT sizes, bilinear sampling) - the ground
// truth every GPU port is validated against. See WEBGPU-PLAN.md.
const Rb = 6360e3,
  Rt = 6460e3;
const rayS = [5.802e-6, 13.558e-6, 33.1e-6];
// Per-channel Mie uniforms (aerosol.js can set a measured channel
// set); the REFERENCE runs the Hillaire (2020) defaults, so the
// texel values below are the paper's sky.
const mieS0 = 3.996e-6,
  mieA0 = 4.44e-7;
const mieS = [mieS0, mieS0, mieS0];
const mieA = [mieA0, mieA0, mieA0];
const G = 0.8;
const ozA = [0.65e-6, 1.881e-6, 0.085e-6];

// Radiative-constant landmark (Hillaire 2020, table 1): Mie
// scattering 3.996e-6 with EXTINCTION 4.440e-6 = sigma_s / 0.9
// (Bruneton's convention), i.e. absorption 4.44e-7 and a
// single-scattering albedo of exactly 0.9. The original port
// carried 4.4e-6 as the ABSORPTION (SSA 0.48) - this pins every
// mirror (shader, CPU transmittance, this reference) to the paper.
{
  const ssa = mieS0 / (mieS0 + mieA0);
  const ok =
    Math.abs(ssa - 0.9) < 1e-12 &&
    Math.abs((mieS0 + mieA0) / 4.44e-6 - 1) < 1e-12;
  console.log(
    `${ok ? 'REF' : 'FAIL'} mie SSA: sigma_s ${mieS0.toExponential(4)} / sigma_t ${(mieS0 + mieA0).toExponential(4)} = ${ssa.toFixed(12)} (Hillaire 2020: 0.9 exactly)`
  );
  if (!ok) process.exit(1);
}

const dens = (h) => [
  Math.exp(-h / 8000),
  Math.exp(-h / 1200),
  Math.max(0, 1 - Math.abs(h - 25e3) / 15e3)
];
const ext = (h) => {
  const d = dens(h);
  return rayS.map(
    (r, c) => r * d[0] + (mieS[c] + mieA[c]) * d[1] + ozA[c] * d[2]
  );
};
const raySphere = (r, mu, R) => {
  const b = r * mu,
    c = r * r - R * R,
    disc = b * b - c;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc);
  let t = -b - s;
  if (t > 0) return t;
  t = -b + s;
  return t > 0 ? t : -1;
};
const H = Math.sqrt(Rt * Rt - Rb * Rb);
const tUv = (r, mu) => {
  const rho = Math.sqrt(Math.max(r * r - Rb * Rb, 0));
  const disc = r * r * (mu * mu - 1) + Rt * Rt;
  const d = Math.max(-r * mu + Math.sqrt(Math.max(disc, 0)), 0);
  return [(d - (Rt - r)) / (rho + H - (Rt - r)), rho / H];
};
const phaseR = (c) => (3 / (16 * Math.PI)) * (1 + c * c);
const phaseM = (c) => {
  const g2 = G * G;
  return (
    ((3 / (8 * Math.PI)) * ((1 - g2) * (1 + c * c))) /
    ((2 + g2) * Math.pow(1 + g2 - 2 * G * c, 1.5))
  );
};

// transmittance LUT 256x64
const TW = 256,
  TH = 64;
const tLut = new Float64Array(TW * TH * 3);
for (let j = 0; j < TH; j++)
  for (let i = 0; i < TW; i++) {
    const ux = (i + 0.5) / TW,
      uy = (j + 0.5) / TH;
    const rho = H * uy,
      r = Math.sqrt(rho * rho + Rb * Rb);
    const dMin = Rt - r,
      dMax = rho + H;
    const d = dMin + ux * (dMax - dMin);
    let mu = d === 0 ? 1 : (H * H - rho * rho - d * d) / (2 * r * d);
    mu = Math.min(Math.max(mu, -1), 1);
    const dt = d / 40,
      tau = [0, 0, 0];
    for (let s = 0; s < 40; s++) {
      const ti = (s + 0.5) * dt;
      const h = Math.sqrt(r * r + ti * ti + 2 * r * ti * mu) - Rb;
      const e = ext(h);
      for (let c = 0; c < 3; c++) tau[c] += e[c] * dt;
    }
    for (let c = 0; c < 3; c++) tLut[(j * TW + i) * 3 + c] = Math.exp(-tau[c]);
  }
const bilinear = (lut, W, Hh, u, v) => {
  const x = Math.min(Math.max(u * W - 0.5, 0), W - 1.001),
    y = Math.min(Math.max(v * Hh - 0.5, 0), Hh - 1.001);
  const i = Math.floor(x),
    j = Math.floor(y),
    fx = x - i,
    fy = y - j;
  const g = (ii, jj, c) => lut[(jj * W + Math.min(ii, W - 1)) * 3 + c];
  return [0, 1, 2].map(
    (c) =>
      (g(i, j, c) * (1 - fx) + g(i + 1, j, c) * fx) * (1 - fy) +
      (g(i, j + 1, c) * (1 - fx) + g(i + 1, j + 1, c) * fx) * fy
  );
};
const sunT = (r, mu) => {
  const [u, v] = tUv(r, mu);
  return bilinear(tLut, TW, TH, u, v);
};

// MS LUT 32x32
const MW = 32;
const msLut = new Float64Array(MW * MW * 3);
for (let j = 0; j < MW; j++)
  for (let i = 0; i < MW; i++) {
    const muS = ((i + 0.5) / MW) * 2 - 1;
    const r = Rb + ((j + 0.5) / MW) * (Rt - Rb) + 1;
    const sd = [Math.sqrt(Math.max(1 - muS * muS, 0)), muS, 0];
    const L2 = [0, 0, 0],
      fms = [0, 0, 0];
    for (let k = 0; k < 64; k++) {
      const fi = k + 0.5;
      const cosT = 1 - (2 * fi) / 64;
      const sinT = Math.sqrt(Math.max(1 - cosT * cosT, 0));
      const phi = fi * 2.399963;
      const dir = [sinT * Math.cos(phi), cosT, sinT * Math.sin(phi)];
      const mu = dir[1];
      const dG = raySphere(r, mu, Rb),
        dT = raySphere(r, mu, Rt);
      const dEnd = dG > 0 ? dG : dT;
      const dt = dEnd / 20;
      const T = [1, 1, 1],
        Li = [0, 0, 0],
        f3 = [0, 0, 0];
      const cSun = dir[0] * sd[0] + dir[1] * sd[1] + dir[2] * sd[2];
      for (let s = 0; s < 20; s++) {
        const ti = (s + 0.5) * dt;
        const ri = Math.sqrt(r * r + ti * ti + 2 * r * ti * mu);
        const h = ri - Rb;
        const dd = dens(h);
        const scat = rayS.map((rr, cc) => rr * dd[0] + mieS[cc] * dd[1]);
        const e = ext(h);
        const muSi = Math.min(Math.max((r * muS + ti * cSun) / ri, -1), 1);
        const Ts = sunT(ri, muSi);
        const ph = (phaseR(cSun) + phaseM(cSun)) * 0.5;
        for (let c = 0; c < 3; c++) {
          const S = scat[c] * ph * Ts[c];
          const st = Math.exp(-e[c] * dt);
          Li[c] += (T[c] * (S - S * st)) / Math.max(e[c], 1e-9);
          f3[c] += (T[c] * (scat[c] - scat[c] * st)) / Math.max(e[c], 1e-9);
          T[c] *= st;
        }
      }
      if (dG > 0) {
        const muSg = Math.min(Math.max((r * muS + dG * cSun) / Rb, -1), 1);
        const Ts = sunT(Rb, muSg);
        for (let c = 0; c < 3; c++)
          Li[c] += (T[c] * Ts[c] * Math.max(muSg, 0) * 0.3) / Math.PI;
      }
      for (let c = 0; c < 3; c++) {
        L2[c] += Li[c] / 64;
        fms[c] += f3[c] / 64;
      }
    }
    for (let c = 0; c < 3; c++)
      msLut[(j * MW + i) * 3 + c] = L2[c] / Math.max(1 - fms[c], 1e-4);
  }
const psiMS = (r, mu) =>
  bilinear(msLut, MW, MW, mu * 0.5 + 0.5, (r - Rb) / (Rt - Rb));

// sky-view at selected texels, 192x108, camH=300, sunMu given
const sunMu = 0.28 / Math.hypot(0.94, 0.28); // matches the A/B pages' normalize
const SW = 192,
  SH = 108;
const sky = (i, j) => {
  const ux = (i + 0.5) / SW,
    uyv = (j + 0.5) / SH;
  const r = Rb + 300;
  const horizon = -Math.sqrt(Math.max(r * r - Rb * Rb, 0)) / r;
  const hA = Math.asin(Math.min(Math.max(horizon, -1), 1));
  // Guarded split (Bruneton) - mirrors atmosphere-tsl.js exactly:
  // half-texel guards at the v=0.5 horizon seam, ray class by half.
  const guard = 0.5 / SH,
    span = 0.5 - 1 / SH;
  let elev;
  if (uyv < 0.5) {
    const s = Math.min(Math.max((0.5 - guard - uyv) / span, 0), 1);
    elev = hA - s * s * (hA + Math.PI / 2);
  } else {
    const s = Math.min(Math.max((uyv - 0.5 - guard) / span, 0), 1);
    elev = hA + s * s * (Math.PI / 2 - hA);
  }
  const relAz = ux * Math.PI;
  const se = Math.sin(elev),
    ce = Math.cos(elev);
  const dir = [ce * Math.cos(relAz), se, ce * Math.sin(relAz)];
  const sunS = Math.sqrt(Math.max(1 - sunMu * sunMu, 0));
  const sd = [sunS, sunMu, 0];
  const mu = dir[1];
  const dG = raySphere(r, mu, Rb),
    dT = raySphere(r, mu, Rt);
  const dTan = Math.sqrt(Math.max(r * r - Rb * Rb, 0));
  const dEnd = Math.max(uyv < 0.5 ? (dG > 0 ? dG : dTan) : dT, 0);
  const dt = dEnd / 32;
  const T = [1, 1, 1],
    L = [0, 0, 0];
  const cSun = dir[0] * sd[0] + dir[1] * sd[1] + dir[2] * sd[2];
  for (let s = 0; s < 32; s++) {
    const ti = (s + 0.5) * dt;
    const ri = Math.sqrt(r * r + ti * ti + 2 * r * ti * mu);
    const h = ri - Rb;
    const dd = dens(h);
    const sR = rayS.map((rr) => rr * dd[0]);
    const sM = mieS.map((ss) => ss * dd[1]);
    const e = ext(h);
    const muSi = Math.min(Math.max((r * sunMu + ti * cSun) / ri, -1), 1);
    const Ts = sunT(ri, muSi);
    const psi = psiMS(ri, muSi);
    for (let c = 0; c < 3; c++) {
      const S =
        (sR[c] * phaseR(cSun) + sM[c] * phaseM(cSun)) * Ts[c] +
        (sR[c] + sM[c]) * psi[c];
      const st = Math.exp(-e[c] * dt);
      L[c] += (T[c] * (S - S * st)) / Math.max(e[c], 1e-9);
      T[c] *= st;
    }
  }
  return L;
};

const fmt = (a) => a.map((v) => v.toExponential(4)).join();
console.log('REF ms(16,8):', fmt(bilinearAt(16, 8)));
function bilinearAt(i, j) {
  return [0, 1, 2].map((c) => msLut[(j * MW + i) * 3 + c]);
}
console.log('REF ms(20,0):', fmt(bilinearAt(20, 0)));
console.log('REF ms(28,16):', fmt(bilinearAt(28, 16)));
console.log('REF sky(30,80):', fmt(sky(30, 80)));
console.log('REF sky(96,60):', fmt(sky(96, 60)));
console.log('REF sky(5,90):', fmt(sky(5, 90)));
console.log('REF sky(30,20):', fmt(sky(30, 20)));
// The guard rows either side of the horizon seam: the one-sided
// limits (below: ground at the tangent distance; above: full path).
console.log('REF sky(30,53):', fmt(sky(30, 53)));
console.log('REF sky(30,54):', fmt(sky(30, 54)));

// ---- aerial march with volumetric shadow (crepuscular rays) ----
// Mirrors atmosphere-tsl's marchAerial20: a horizontal 20-step
// march at camera height over the full SIGNED azimuth circle,
// where chi(t) - the cloud shadow map's sun visibility at the
// marched point - multiplies the DIRECT single-scatter term only
// (Hillaire 2020's aerial perspective with volumetric shadow;
// multiple scattering stays unshadowed).
const AER_MAX = 25700;
const aer = (uAz, uDist, chi, mode) => {
  // mode: 'full' (the engine), 'nodirect' (ambient only),
  // 'directonly' (per-step direct contributions, for linearity)
  const az = (uAz - 0.5) * 2 * Math.PI;
  const dEnd = uDist * AER_MAX;
  const r = Rb + 300;
  const steps = 20;
  const dt = dEnd / steps;
  const sunS = Math.sqrt(Math.max(1 - sunMu * sunMu, 0));
  const cSun = Math.cos(az) * sunS;
  const T = [1, 1, 1];
  const L = [0, 0, 0];
  const D = []; // per-step direct contributions (directonly)
  for (let s = 0; s < steps; s++) {
    const ti = (s + 0.5) * dt;
    const ri = Math.sqrt(r * r + ti * ti);
    const h = ri - Rb;
    const dd = dens(h);
    const sR = rayS.map((rr) => rr * dd[0]);
    const sM = mieS.map((ss) => ss * dd[1]);
    const e = ext(h);
    const muSi = Math.min(Math.max((r * sunMu + ti * cSun) / ri, -1), 1);
    const Ts = sunT(ri, muSi);
    const psi = psiMS(ri, muSi);
    const x = chi ? chi(ti) : 1;
    const Ds = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const dir = (sR[c] * phaseR(cSun) + sM[c] * phaseM(cSun)) * Ts[c];
      const amb = (sR[c] + sM[c]) * psi[c];
      const S =
        mode === 'nodirect' ? amb : mode === 'directonly' ? dir : dir * x + amb;
      const st = Math.exp(-e[c] * dt);
      const add = (T[c] * (S - S * st)) / Math.max(e[c], 1e-9);
      if (mode === 'directonly') Ds[c] = add;
      else L[c] += add;
      T[c] *= st;
    }
    if (mode === 'directonly') D.push(Ds);
  }
  return mode === 'directonly' ? D : L;
};

let aerFail = 0;
const aerCheck = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) aerFail++;
};

{
  // chi = 1 must be EXACTLY the unshadowed march, chi = 0 exactly
  // the ambient-only march - together they pin that the shadow
  // multiplies the direct term and nothing else.
  let worst = 0;
  for (const [u, v] of [
    [0.5, 1],
    [0.25, 0.5],
    [0.9, 0.75]
  ]) {
    const lit = aer(u, v, () => 1, 'full');
    const un = aer(u, v, null, 'full');
    const dark = aer(u, v, () => 0, 'full');
    const amb = aer(u, v, null, 'nodirect');
    for (let c = 0; c < 3; c++)
      worst = Math.max(
        worst,
        Math.abs(lit[c] - un[c]),
        Math.abs(dark[c] - amb[c])
      );
  }
  aerCheck(
    'aerial shadow bounds',
    worst === 0,
    `chi=1 IS the unshadowed march and chi=0 IS the ambient-only march (exact, 3 texels x 3 channels): the shadow touches only the direct term`
  );
}

{
  // Linearity restatement: the march is linear in per-step chi, so
  // for ANY chi, L(chi) = L(0) + sum_s chi_s * D_s with D_s
  // harvested from an independent direct-only pass. Check a hard
  // half-lit chi (a cloud bank covering the near half of the ray).
  const u = 0.35;
  const v = 0.8;
  const half = AER_MAX * v * 0.5;
  const chi = (t) => (t < half ? 0 : 1);
  const got = aer(u, v, chi, 'full');
  const amb = aer(u, v, null, 'nodirect');
  const D = aer(u, v, null, 'directonly');
  const dt = (v * AER_MAX) / 20;
  const want = [0, 1, 2].map(
    (c) =>
      amb[c] + D.reduce((a, Ds, s) => a + (chi((s + 0.5) * dt) ? Ds[c] : 0), 0)
  );
  const worst = Math.max(
    ...[0, 1, 2].map(
      (c) => Math.abs(got[c] - want[c]) / Math.max(want[c], 1e-12)
    )
  );
  aerCheck(
    'aerial shadow linearity',
    worst < 1e-12,
    `half-lit ray equals ambient + the lit steps' direct contributions (independent pass) to ${worst.toExponential(1)}`
  );
}

{
  // Azimuth convention roundtrip: the LUT fill rotates the sun
  // azimuth vector by az (counterclockwise in the xz basis); the
  // sampler reads az back as atan(cross, dot). Mirrors of both
  // formulas must invert each other over the full circle for any
  // sun azimuth - a sign slip here would mirror every shaft.
  let worst = 0;
  for (let k = 0; k < 24; k++) {
    const az = -Math.PI + ((k + 0.5) / 24) * 2 * Math.PI;
    for (const t of [0.3, 2.1, 4.4]) {
      const s = [Math.cos(t), Math.sin(t)];
      const d = [
        s[0] * Math.cos(az) - s[1] * Math.sin(az),
        s[0] * Math.sin(az) + s[1] * Math.cos(az)
      ];
      const back = Math.atan2(
        s[0] * d[1] - s[1] * d[0],
        s[0] * d[0] + s[1] * d[1]
      );
      worst = Math.max(worst, Math.abs(back - az));
    }
  }
  aerCheck(
    'aerial azimuth roundtrip',
    worst < 1e-12,
    `fill rotation and sampler atan(cross, dot) invert each other to ${worst.toExponential(1)} over the full signed circle (72 cases)`
  );
}

console.log('REF aerial(0.5,1.0):', fmt(aer(0.5, 1, null, 'full')));
console.log('REF aerial(0.25,0.5):', fmt(aer(0.25, 0.5, null, 'full')));
console.log('REF aerial(0.0,1.0):', fmt(aer(0, 1, null, 'full')));
if (aerFail) process.exit(1);
