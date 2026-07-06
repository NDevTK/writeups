// Reference printer for the Ross-Li vegetation BRDF (node
// ross-li-reference.mjs). The model lives once in ross-li.js;
// landmarks, all against the published papers:
//  - both BASE kernels vanish exactly at ti = tv = 0 (Lucht 2000:
//    f_iso is the nadir BRF), and both are reciprocal in (ti, tv)
//  - the Maignan 2004 hotspot factor is exactly 2 at the antisolar
//    point and exactly 1.5 at xi = xi0 = 1.5 deg
//  - Gauss-Legendre quadrature of the kernels reproduces Lucht
//    2000's white-sky integrals 0.189184 / -1.377622 and tracks the
//    published cubic black-sky fits h_k(t) across 0..75 deg
//  - the Zhang/Jiao 2016 archetype table is self-consistent: the
//    published AFX column re-derives from the published weights via
//    AFX = 1 + (f_vol/f_iso) H_vol + (f_geo/f_iso) H_geo
//  - the display normaliser dirNorm (view-hemisphere albedo of the
//    hotspot kernel set) exceeds the base-kernel black-sky albedo by
//    the few-percent hotspot energy, never less
import {
  ARCHETYPES,
  bsaAlbedo,
  bsaAlbedoM,
  bsaKernel,
  bsaPoly,
  brf,
  dirNorm,
  fitArchetype,
  G_GEO,
  G_VOL,
  gaussLegendre,
  H_GEO,
  H_VOL,
  liSparseR,
  mod09Clear,
  rossThick,
  rossThickMaignan,
  wsaKernel,
  XI0
} from './ross-li.js';

const deg = (d) => (d * Math.PI) / 180;
let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  const kv = rossThick(0, 0, 1.3);
  const kg = liSparseR(0, 0, 2.1);
  check(
    'nadir zeros',
    Math.abs(kv) < 1e-12 && Math.abs(kg) < 1e-12,
    `Kvol(0,0) = ${kv.toExponential(1)}, Kgeo(0,0) = ${kg.toExponential(1)}`
  );
  const kvM = rossThickMaignan(0, 0, 0.7);
  check(
    'nadir hotspot',
    Math.abs(kvM - Math.PI / 4) < 1e-12,
    `KvolM(0,0) = ${kvM.toFixed(6)} (pi/4 - nadir sun/view IS the hotspot)`
  );
}

{
  let worst = 0;
  for (const [ti, tv, phi] of [
    [0.2, 0.9, 0.6],
    [1.1, 0.4, 2.8],
    [0.7, 1.2, 1.9],
    [1.25, 1.25, 3.1]
  ]) {
    for (const K of [rossThick, rossThickMaignan, liSparseR]) {
      worst = Math.max(worst, Math.abs(K(ti, tv, phi) - K(tv, ti, phi)));
    }
  }
  check(
    'reciprocity',
    worst < 1e-12,
    `worst |K(i,v) - K(v,i)| = ${worst.toExponential(1)}`
  );
}

{
  // Coplanar backscatter: ti = tv = 30 deg, phi = 0 puts xi = 0;
  // tv offset by xi0 puts xi = xi0 exactly. Compare the scattering
  // brackets (K + pi/4)(ci + cv).
  const bracket = (K, ti, tv) =>
    (K(ti, tv, 0) + Math.PI / 4) * (Math.cos(ti) + Math.cos(tv));
  const r0 =
    bracket(rossThickMaignan, deg(30), deg(30)) /
    bracket(rossThick, deg(30), deg(30));
  const r1 =
    bracket(rossThickMaignan, deg(30), deg(30) + XI0) /
    bracket(rossThick, deg(30), deg(30) + XI0);
  check(
    'Maignan hotspot',
    Math.abs(r0 - 2) < 1e-12 && Math.abs(r1 - 1.5) < 1e-9,
    `factor ${r0.toFixed(6)} at xi=0 (exact 2), ${r1.toFixed(6)} at xi=xi0 (exact 1.5)`
  );
}

{
  const hv = wsaKernel(rossThick);
  const hg = wsaKernel(liSparseR);
  check(
    'white-sky integrals',
    Math.abs(hv - H_VOL) < 5e-4 && Math.abs(hg - H_GEO) < 5e-4,
    `quadrature ${hv.toFixed(6)} / ${hg.toFixed(6)} vs Lucht 2000 ${H_VOL} / ${H_GEO}`
  );
}

{
  // Black-sky cubic fits, Lucht 2000 Table 1. These are published
  // least-squares FITS, not identities - the quadrature exposes
  // their true residuals (up to 0.025 on the vol kernel integral at
  // the 75 deg domain edge, converged: n=96 and n=400 agree to
  // 1e-6). The meaningful published claim is albedo accuracy:
  // across all 12 archetypes and 0..75 deg the polynomial black-sky
  // albedo stays within a few percent of the quadrature (Lucht 2000
  // quotes ~1-2% typical fit error; the worst case here is the
  // extreme-volume archetype A6 red, f_vol/f_iso = 2.2, at the
  // 75 deg domain edge - 3.5%).
  let worstV = 0;
  let worstG = 0;
  let worstAlb = 0;
  for (let d = 0; d <= 75; d += 5) {
    const t = deg(d);
    const hv = bsaKernel(rossThick, t, 96);
    const hg = bsaKernel(liSparseR, t, 96);
    worstV = Math.max(worstV, Math.abs(hv - bsaPoly(G_VOL, t)));
    worstG = Math.max(worstG, Math.abs(hg - bsaPoly(G_GEO, t)));
    for (const band of ['red', 'nir']) {
      for (const a of ARCHETYPES[band]) {
        const quad = a.iso + a.vol * hv + a.geo * hg;
        worstAlb = Math.max(worstAlb, Math.abs(bsaAlbedo(a, t) / quad - 1));
      }
    }
  }
  check(
    'black-sky fits',
    worstV < 0.03 && worstG < 0.01 && worstAlb < 0.04,
    `fit residual vol ${worstV.toExponential(1)}, geo ${worstG.toExponential(1)};` +
      ` worst archetype albedo error ${(worstAlb * 100).toFixed(2)}% over 0..75 deg`
  );
}

{
  // Zhang/Jiao 2016 Table 1 self-consistency: re-derive AFX.
  let worst = 0;
  for (const band of ['red', 'nir']) {
    for (const a of ARCHETYPES[band]) {
      const afx = 1 + (a.vol / a.iso) * H_VOL + (a.geo / a.iso) * H_GEO;
      worst = Math.max(worst, Math.abs(afx - a.afx));
    }
  }
  check(
    'archetype AFX',
    worst < 2e-3,
    `worst |AFX(f) - published| = ${worst.toExponential(1)} across 12 rows`
  );
}

{
  // Display normalisation: dirNorm (hotspot kernels, quadrature) vs
  // the base-kernel polynomial BSA - the hotspot only ADDS energy,
  // and only a few percent of it.
  const w = ARCHETYPES.red[3]; // mid archetype
  let minR = Infinity;
  let maxR = 0;
  for (const d of [0, 30, 60, 75]) {
    const r = dirNorm(w, deg(d)) / bsaAlbedo(w, deg(d));
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
  }
  check(
    'hotspot energy',
    minR >= 1 && maxR < 1.1,
    `dirNorm / BSA in [${minR.toFixed(4)}, ${maxR.toFixed(4)}] at 0/30/60/75 deg`
  );
  // And the normalised anisotropy factor really averages to 1 over
  // the view hemisphere (2D quadrature of R_M at fixed sun zenith).
  const ti = deg(40);
  const n = 96;
  const g = gaussLegendre(n);
  let mean = 0;
  for (let a = 0; a < n; a++) {
    const mu = 0.5 * (g.x[a] + 1);
    let inner = 0;
    for (let b = 0; b < n; b++) {
      inner += g.w[b] * brf(w, ti, Math.acos(mu), (Math.PI / 2) * (g.x[b] + 1));
    }
    mean += g.w[a] * mu * inner;
  }
  mean = (mean * 0.5 * (Math.PI / 2) * 2) / Math.PI / dirNorm(w, ti);
  check(
    'anisotropy mean',
    Math.abs(mean - 1) < 1e-6,
    `E_view[R/dirNorm] - 1 = ${(mean - 1).toExponential(1)} at sun zenith 40 deg`
  );
}

{
  // The Maignan-excess cubic (G_DHOT, fitted on Lucht's basis)
  // against direct quadrature of KvolM - Kvol.
  let worst = 0;
  for (let d = 0; d <= 75; d += 5) {
    const t = deg(d);
    const dh = bsaKernel(rossThickMaignan, t, 96) - bsaKernel(rossThick, t, 96);
    const w = ARCHETYPES.red[3];
    worst = Math.max(
      worst,
      Math.abs(bsaAlbedoM(w, t) - (bsaAlbedo(w, t) + w.vol * dh)) / w.vol
    );
  }
  check(
    'hotspot BSA cubic',
    worst < 5e-4,
    `worst |fit - quadrature| = ${worst.toExponential(1)} on the excess integral`
  );
}

{
  // MOD09A1 state-word QC on words MEASURED at the Grindelwald test
  // pixel (A2026089-A2026161): 136 is clear land; 140 adds the
  // cloud-shadow bit, 200 high aerosol, 1033 cloud + internal
  // cloud, 8332/8392 adjacent-to-cloud with shadow/aerosol.
  const states = [8392, 8332, 200, 140, 136, 1033];
  const want = [false, false, false, false, true, false];
  const got = states.map(mod09Clear);
  check(
    'MOD09 QC word',
    got.every((g, i) => g === want[i]),
    states.map((s, i) => `${s}:${got[i] ? 'ok' : 'rej'}`).join(' ')
  );
}

{
  // Archetype identifiability under the REAL sampling: the ten
  // Terra sun/view geometries measured at the Grindelwald pixel
  // (MOD09A1 szen/vzen/raz, scale 0.01 deg). Reflectance series
  // synthesised from each archetype in turn (scaled 0.87) must fit
  // back to that archetype with the exact scale, in both bands -
  // the minimum-RMSE rule separates all twelve shapes from
  // cross-track sampling alone.
  const szen = [
    47.51, 49.2, 50.47, 44.57, 39.91, 34.69, 33.21, 32.71, 37.87, 41.06
  ];
  const vzen = [
    46.15, 22.68, 39.26, 20.95, 44.2, 58.29, 57.63, 57.3, 13.95, 20.03
  ];
  const raz = [
    149.45, 151.39, -21.71, 155.51, 154.95, 155.1, 158.67, 159.99, 167.58,
    -10.69
  ];
  const geom = szen.map((s, j) => ({
    ti: deg(s),
    tv: deg(vzen[j]),
    phi: deg(raz[j])
  }));
  let ok = true;
  let minMargin = Infinity;
  let worstA = 0;
  for (const band of ['red', 'nir']) {
    for (let k = 0; k < 6; k++) {
      const w = ARCHETYPES[band][k];
      const obs = geom.map((g) => ({
        ...g,
        r: 0.87 * brf(w, g.ti, g.tv, g.phi, false)
      }));
      const fit = fitArchetype(obs, band);
      if (!fit || fit.k !== k) ok = false;
      else {
        minMargin = Math.min(minMargin, fit.margin / Math.max(fit.rmse, 1e-12));
        worstA = Math.max(worstA, Math.abs(fit.a - 0.87));
      }
    }
  }
  check(
    'archetype fit',
    ok && worstA < 1e-12,
    ok
      ? `all 12 planted archetypes recovered, |scale err| <= ${worstA.toExponential(1)}`
      : 'recovery FAILED'
  );
  // and it degrades gracefully: too few observations -> null.
  check(
    'fit floor',
    fitArchetype(
      geom.slice(0, 3).map((g) => ({...g, r: 0.1})),
      'red'
    ) === null,
    'fewer than 4 clear observations returns null (Lambertian fallback)'
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
