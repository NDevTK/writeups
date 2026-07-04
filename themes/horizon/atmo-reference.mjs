// Double-precision JS reference of the Hillaire chain (node atmo-reference.mjs).
// Mirrors the GLSL/TSL exactly (LUT sizes, bilinear sampling) - the ground
// truth every GPU port is validated against. See WEBGPU-PLAN.md.
const Rb = 6360e3,
  Rt = 6460e3;
const rayS = [5.802e-6, 13.558e-6, 33.1e-6];
const mieS0 = 3.996e-6,
  mieA0 = 4.4e-6,
  MIE = 1;
const ozA = [0.65e-6, 1.881e-6, 0.085e-6];

const dens = (h) => [
  Math.exp(-h / 8000),
  Math.exp(-h / 1200),
  Math.max(0, 1 - Math.abs(h - 25e3) / 15e3)
];
const ext = (h) => {
  const d = dens(h);
  return rayS.map(
    (r, c) => r * d[0] + (mieS0 + mieA0) * MIE * d[1] + ozA[c] * d[2]
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
  const g = 0.8,
    g2 = g * g;
  return (
    ((3 / (8 * Math.PI)) * ((1 - g2) * (1 + c * c))) /
    ((2 + g2) * Math.pow(1 + g2 - 2 * g * c, 1.5))
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
        const scat = rayS.map((rr) => rr * dd[0] + mieS0 * MIE * dd[1]);
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
  let elev;
  if (uyv < 0.5) {
    const c = 1 - uyv * 2;
    elev = hA - c * c * (hA + Math.PI / 2);
  } else {
    const c = uyv * 2 - 1;
    elev = hA + c * c * (Math.PI / 2 - hA);
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
  const dEnd = Math.max(dG > 0 ? dG : dT, 0);
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
    const sM = mieS0 * MIE * dd[1];
    const e = ext(h);
    const muSi = Math.min(Math.max((r * sunMu + ti * cSun) / ri, -1), 1);
    const Ts = sunT(ri, muSi);
    const psi = psiMS(ri, muSi);
    for (let c = 0; c < 3; c++) {
      const S =
        (sR[c] * phaseR(cSun) + sM * phaseM(cSun)) * Ts[c] +
        (sR[c] + sM) * psi[c];
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
