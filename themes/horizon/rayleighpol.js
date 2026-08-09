/**
 * rayleighpol.js - polarized Rayleigh radiative transfer, stage
 * 1: the doubling engine. Pure functions, mirrored by
 * rayleighpol-reference.mjs; the benchmark ground truth is the
 * IPRT intercomparison case A1 slice vendored in
 * rayleighpol-data.js (Emde et al. 2015 - the open IPRT pages,
 * read in full).
 *
 * WHY: the theme's dome is scalar. The sky is not - Rayleigh
 * scattering polarizes it strongly, water reflects by Fresnel
 * (which splits Rs/Rp), and the Babinet/Brewster neutral points
 * are OBSERVABLES that exist only because multiple scattering
 * displaces the polarization zeros away from the sun. Stage 1
 * builds and gates the exact machinery; wiring the dome and the
 * Fresnel water is the stated next stage.
 *
 * THE METHOD (classical, plane-parallel):
 *  - Stokes (I, Q, U); V decouples for Rayleigh and the
 *    benchmark's own V column is zero to 1e-15 (checked at
 *    vendor time).
 *  - the Rayleigh scattering matrix with depolarization d,
 *    Delta = (1-d)/(1+d/2) (Hansen & Travis's classic form):
 *    F11 = Delta (3/4)(1+c^2) + (1-Delta), F12 = F21 =
 *    -Delta (3/4) s^2, F22 = Delta (3/4)(1+c^2), F33 =
 *    Delta (3/2) c - normalised so the mean of F11 over the
 *    sphere is exactly 1 (gate-held).
 *  - meridian-frame rotations L(-i1), L(pi-i2) by the spherical
 *    triangle; the azimuth dependence is band-limited (modes
 *    |m| <= 2 exactly - the Fourier truncation is EXACT for
 *    Rayleigh, and the gate holds the reconstruction residual
 *    at machine noise).
 *  - complex Fourier modes: Z(dphi) = sum_m Cm e^{i m dphi};
 *    azimuth convolution multiplies the Cm - no hand-derived
 *    sign rules anywhere, and a brute-force double-scattering
 *    integral arbitrates the whole convention in the gate.
 *  - doubling with composite direct/diffuse algebra: operators
 *    {M (diffuse matrix, quadrature-coupled), G (direct
 *    diagonal, plain products)} so the direct beam never leaks
 *    through a quadrature sum; S = (1 - R R)^{-1} by Neumann
 *    (spectral radius ~ reflectance^2, small). Gauss-Legendre
 *    nodes carry the integrals; the exact view and sun cosines
 *    ride along as ZERO-WEIGHT nodes - they read the field and
 *    feed the beam but never approximate an integral.
 *  - normalisation and the U sign are PINNED to the benchmark's
 *    own convention (one global factor and one global sign,
 *    both asserted CONSTANT across all 408 vendored rows - a
 *    convention, not a fit).
 */

// Gauss-Legendre nodes/weights on (0, 1).
export function gauss01(n) {
  const x = new Float64Array(n);
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let t = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5));
    for (let it = 0; it < 100; it++) {
      let p0 = 1;
      let p1 = t;
      for (let k = 2; k <= n; k++) {
        const p2 = ((2 * k - 1) * t * p1 - (k - 1) * p0) / k;
        p0 = p1;
        p1 = p2;
      }
      const dp = (n * (t * p1 - p0)) / (t * t - 1);
      const dt = p1 / dp;
      t -= dt;
      if (Math.abs(dt) < 1e-15) break;
    }
    x[n - 1 - i] = 0.5 + 0.5 * t;
    let p0 = 1;
    let p1 = t;
    for (let k = 2; k <= n; k++) {
      const p2 = ((2 * k - 1) * t * p1 - (k - 1) * p0) / k;
      p0 = p1;
      p1 = p2;
    }
    const dp = (n * (t * p1 - p0)) / (t * t - 1);
    w[n - 1 - i] = 1 / ((1 - t * t) * dp * dp);
  }
  return {x, w};
}

// The Rayleigh scattering matrix (I, Q, U block) at cos Theta.
export function rayleighF(c, depol) {
  const D = (1 - depol) / (1 + depol / 2);
  const s2 = 1 - c * c;
  const a = D * 0.75 * (1 + c * c);
  return [
    [a + (1 - D), -D * 0.75 * s2, 0],
    [-D * 0.75 * s2, a, 0],
    [0, 0, D * 1.5 * c]
  ];
}

// The full phase matrix Z for scattering from propagation
// direction (mu', phi'=0) into (mu, phi=dphi), both mu measured
// along the propagation (positive up). Meridian-frame rotations
// by the spherical triangle (the standard construction; the
// engine's overall U sign is pinned to the benchmark later).
export function zMatrix(mu, mup, dphi, depol) {
  const smu = Math.sqrt(Math.max(0, 1 - mu * mu));
  const smup = Math.sqrt(Math.max(0, 1 - mup * mup));
  let c = mu * mup + smu * smup * Math.cos(dphi);
  c = Math.max(-1, Math.min(1, c));
  const F = rayleighF(c, depol);
  const sTh2 = 1 - c * c;
  if (sTh2 < 1e-24) {
    // Exact forward/backward scattering: the two rotations
    // cancel against each other in the continuous limit.
    return F;
  }
  const sTh = Math.sqrt(sTh2);
  const sd = Math.sin(dphi);
  // Rotation angles (i1 about the incoming ray, i2 about the
  // outgoing) from the spherical triangle: cosines by the
  // analogue formula, sines by the LAW OF SINES (sin i1 =
  // sin(theta) sin(dphi)/sin(Theta)), which carries the sign of
  // sin(dphi) automatically and - unlike sqrt(1 - ci^2) - has no
  // sqrt(eps) noise floor at the meridian plane, where ci -> +-1
  // and the sin-type elements must vanish exactly (the gate's
  // band-limit landmark measures this floor).
  let ci1 = (mu - mup * c) / (sTh * smup);
  let ci2 = (mup - mu * c) / (sTh * smu);
  ci1 = Math.max(-1, Math.min(1, ci1));
  ci2 = Math.max(-1, Math.min(1, ci2));
  const si1 = Math.max(-1, Math.min(1, (smu * sd) / sTh));
  const si2 = Math.max(-1, Math.min(1, (smup * sd) / sTh));
  const c2a = 2 * ci1 * ci1 - 1;
  const s2a = 2 * si1 * ci1;
  const c2b = 2 * ci2 * ci2 - 1;
  const s2b = 2 * si2 * ci2;
  // Z = L(pi - i2) F L(-i1); L(x) rotates (Q, U) by 2x.
  // L(-i1): [[1,0,0],[0,c2a,-s2a],[0,s2a,c2a]]
  // L(pi - i2): cos(2pi-2i2)=c2b, sin(2pi-2i2)=-s2b ->
  //   [[1,0,0],[0,c2b,-(-s2b)],[0,(-s2b),c2b]] with the L(x)
  //   pattern [[1,0,0],[0,cx,sx],[0,-sx,cx]]:
  //   = [[1,0,0],[0,c2b,-s2b],[0,s2b,c2b]]
  const A = F;
  // B = A * L(-i1)
  const B = [
    [A[0][0], A[0][1] * c2a + 0 * s2a, -A[0][1] * s2a],
    [A[1][0], A[1][1] * c2a, -A[1][1] * s2a],
    [A[2][0], A[2][2] * s2a, A[2][2] * c2a]
  ];
  // Z = L(pi - i2) * B
  return [
    [B[0][0], B[0][1], B[0][2]],
    [
      c2b * B[1][0] - s2b * B[2][0],
      c2b * B[1][1] - s2b * B[2][1],
      c2b * B[1][2] - s2b * B[2][2]
    ],
    [
      s2b * B[1][0] + c2b * B[1][0] * 0 + c2b * B[2][0],
      s2b * B[1][1] + c2b * B[2][1],
      s2b * B[1][2] + c2b * B[2][2]
    ]
  ];
}

// Complex Fourier coefficients Cm(mu, mu') of Z over dphi,
// m = 0..2 (band-limited exactly for Rayleigh): Cm =
// (1/2pi) int Z e^{-i m dphi} d dphi, by K-point trapezoid
// (exact for band-limited integrands).
export function zFourier(mu, mup, depol, K = 32) {
  const re = [0, 1, 2].map(() => [0, 1, 2].map(() => [0, 0, 0]));
  const im = [0, 1, 2].map(() => [0, 1, 2].map(() => [0, 0, 0]));
  for (let k = 0; k < K; k++) {
    const p = (2 * Math.PI * k) / K;
    const Z = zMatrix(mu, mup, p, depol);
    for (let m = 0; m <= 2; m++) {
      const cm = Math.cos(m * p) / K;
      const sm = -Math.sin(m * p) / K;
      for (let r = 0; r < 3; r++)
        for (let cCol = 0; cCol < 3; cCol++) {
          re[r][cCol][m] += Z[r][cCol] * cm;
          im[r][cCol][m] += Z[r][cCol] * sm;
        }
    }
  }
  return {re, im};
}

// ---- the doubling engine --------------------------------------
// Complex matrices as {re: Float64Array, im: Float64Array} of
// size n*n, row-major. Composite operators {M, G}: M the diffuse
// matrix (couples through the weighted quadrature sum), G the
// direct diagonal (plain products), null when absent.

function cmat(n) {
  return {re: new Float64Array(n * n), im: new Float64Array(n * n), n};
}

// D-conjugation on the Stokes block: flip the sign of every
// element that couples U to (I, Q) - row or column Stokes index
// 2, but not both (Hovenier's mirror-symmetry relation).
function dConj(A) {
  const n = A.n;
  const out = cmat(n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const s = (i % 3 === 2) !== (j % 3 === 2) ? -1 : 1;
      out.re[i * n + j] = s * A.re[i * n + j];
      out.im[i * n + j] = s * A.im[i * n + j];
    }
  return out;
}

// Quadrature product: (A o B)(i,j) = 2 sum_k A(i,k) mu_k w_k B(k,j).
function mulq(A, B, muw) {
  const n = A.n;
  const out = cmat(n);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const f = 2 * muw[k];
      if (f === 0) continue;
      const ar = A.re[i * n + k] * f;
      const ai = A.im[i * n + k] * f;
      if (ar === 0 && ai === 0) continue;
      for (let j = 0; j < n; j++) {
        out.re[i * n + j] += ar * B.re[k * n + j] - ai * B.im[k * n + j];
        out.im[i * n + j] += ar * B.im[k * n + j] + ai * B.re[k * n + j];
      }
    }
  }
  return out;
}

function addm(A, B, sB = 1) {
  const n = A.n;
  const out = cmat(n);
  for (let i = 0; i < n * n; i++) {
    out.re[i] = A.re[i] + sB * B.re[i];
    out.im[i] = A.im[i] + sB * B.im[i];
  }
  return out;
}

function scaleRows(A, g) {
  const n = A.n;
  const out = cmat(n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      out.re[i * n + j] = g[i] * A.re[i * n + j];
      out.im[i * n + j] = g[i] * A.im[i * n + j];
    }
  return out;
}

function scaleCols(A, g) {
  const n = A.n;
  const out = cmat(n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      out.re[i * n + j] = g[j] * A.re[i * n + j];
      out.im[i * n + j] = g[j] * A.im[i * n + j];
    }
  return out;
}

// Composite product: C = A * B for {M, G} operators.
function mulc(A, B, muw) {
  const M = addm(
    addm(mulq(A.M, B.M, muw), B.G ? scaleCols(A.M, B.G) : cmat(A.M.n), 1),
    A.G ? scaleRows(B.M, A.G) : cmat(A.M.n),
    1
  );
  let G = null;
  if (A.G && B.G) {
    G = new Float64Array(A.G.length);
    for (let i = 0; i < G.length; i++) G[i] = A.G[i] * B.G[i];
  }
  return {M, G};
}

/**
 * Doubling for one Fourier mode m: returns {R, T, G} for the
 * homogeneous Rayleigh layer of optical depth tau - R and T the
 * diffuse reflection/transmission matrices over the node set
 * (Stokes-blocked: n = 3 * nodes), G the direct transmittance
 * diagonal. nodes: {mu (Float64Array), w (weights, 0 for
 * probes)}. The thin-layer initialisation is first-order single
 * scattering at tau0 = tau / 2^25 (error O(tau0^2) ~ 1e-16).
 */
export function doubleLayer(m, tau, nodes, depol, steps = 25, scalar = false) {
  const nm = nodes.mu.length;
  const n = 3 * nm;
  const muw = new Float64Array(n);
  for (let a = 0; a < nm; a++)
    for (let s = 0; s < 3; s++) muw[a * 3 + s] = nodes.mu[a] * nodes.w[a];
  // Fourier blocks for reflection (up <- down) and transmission
  // (down <- down): outgoing propagation +mu / -mu convention:
  // reflection scatters (-mu') -> (+mu): zMatrix(mu, -mup);
  // transmission (-mu') -> (-mu): zMatrix(-mu, -mup).
  const ZR = cmat(n);
  const ZT = cmat(n);
  for (let a = 0; a < nm; a++)
    for (let b = 0; b < nm; b++) {
      const fr = zFourier(nodes.mu[a], -nodes.mu[b], depol);
      const ft = zFourier(-nodes.mu[a], -nodes.mu[b], depol);
      // The SCALAR approximation (the audit mode): keep only the
      // (0,0) phase-matrix element - the classical replacement of
      // every 4x4 matrix by its (1,1)-element (Mishchenko, Lacis
      // & Travis 1994, Sec. 2). The rotations never touch (0,0),
      // so this is exactly scalar radiative transfer riding the
      // same doubling; the Q/U rows stay zero throughout.
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) {
          if (scalar && (r !== 0 || c !== 0)) continue;
          ZR.re[(a * 3 + r) * n + (b * 3 + c)] = fr.re[r][c][m];
          ZR.im[(a * 3 + r) * n + (b * 3 + c)] = fr.im[r][c][m];
          ZT.re[(a * 3 + r) * n + (b * 3 + c)] = ft.re[r][c][m];
          ZT.im[(a * 3 + r) * n + (b * 3 + c)] = ft.im[r][c][m];
        }
    }
  const tau0 = tau / Math.pow(2, steps);
  // Thin-layer single scatter: R0(i,j) = tau0/(4 mu_i mu_j) ZR,
  // T0 likewise; the 1/(4 mu mu') is the classical slab factor
  // (calibrated exactly by the single-scatter gate).
  let R = cmat(n);
  let T = cmat(n);
  for (let a = 0; a < nm; a++)
    for (let b = 0; b < nm; b++) {
      const f = tau0 / (4 * nodes.mu[a] * nodes.mu[b]);
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) {
          const idx = (a * 3 + r) * n + (b * 3 + c);
          R.re[idx] = f * ZR.re[idx];
          R.im[idx] = f * ZR.im[idx];
          T.re[idx] = f * ZT.re[idx];
          T.im[idx] = f * ZT.im[idx];
        }
    }
  let G = new Float64Array(n);
  let t = tau0;
  for (let a = 0; a < nm; a++)
    for (let s = 0; s < 3; s++) G[a * 3 + s] = Math.exp(-tau0 / nodes.mu[a]);
  for (let step = 0; step < steps; step++) {
    // S = (1 - R_up o R_dn)^{-1} by Neumann; up-incident
    // operators are the D-conjugates (Hovenier's mirror
    // symmetry): R_up = D R D, T_up = D T D. At m = 0 the
    // conjugated elements vanish (sin-type azimuth average),
    // which is why a missing conjugation still closes m = 0
    // exactly; the m >= 1 modes need it - found by this gate's
    // own benchmark comparison during development.
    const RR = mulq(dConj(R), R, muw);
    let Spow = RR;
    let Ssum = RR;
    for (let it = 0; it < 60; it++) {
      Spow = mulq(Spow, RR, muw);
      let mx = 0;
      for (let i = 0; i < n * n; i++)
        mx = Math.max(mx, Math.abs(Spow.re[i]), Math.abs(Spow.im[i]));
      Ssum = addm(Ssum, Spow, 1);
      if (mx < 1e-16) break;
    }
    const Scomp = {M: Ssum, G: new Float64Array(n).fill(1)};
    const Tc = {M: T, G};
    const Rc = {M: R, G: null};
    const TupC = {M: dConj(T), G};
    // Application order: mulc(A, B) applies B first. The chains:
    // Dfield = S o (T+E); R2 = R + (T_up+E) o R o Dfield;
    // T2 = (T+E) o Dfield.
    const Df = mulc(Scomp, Tc, muw);
    const RD = mulc(Rc, Df, muw);
    const UpOut = mulc(TupC, RD, muw);
    const Rnew = addm(R, UpOut.M, 1);
    const T2 = mulc(Tc, Df, muw);
    R = Rnew;
    T = T2.M;
    G = T2.G;
    t *= 2;
  }
  return {R, T, G};
}

/**
 * The A1 solution at exact view/sun angles. Returns rows
 * {altitude, vzaDeg, dphiDeg, I, Q, U} for the given case.
 * Normalisation and U sign follow the benchmark's convention
 * via NORM and USIGN (pinned constants, asserted constant by
 * the gate).
 */
export const NORM = 1 / Math.PI;
// The engine's meridian construction lands the OPPOSITE U sign
// from the benchmark's convention, perfectly consistently (the
// gate asserts sign agreement at every row once flipped) - a
// pure orientation convention, adopted from IPOL like the slice
// itself. NORM likewise: the benchmark normalises radiance so
// the engine's raw mode sum carries mu0/pi.
export const USIGN = -1;

export function solveA1({
  tau = 0.5,
  depol = 0,
  mu0 = 1,
  vzaDownDeg = [],
  vzaUpDeg = [],
  dphiDeg = [],
  nGauss = 32,
  nDouble = 25,
  scalar = false
}) {
  const g = gauss01(nGauss);
  // Polar directions (mu = 1) sit at the meridian frame's
  // coordinate singularity; nudge them inside by 1e-9 - the
  // field is smooth there and the rotation limits evaluate
  // numerically (error O(1 - mu^2) ~ 1e-9, far under the gate).
  const nudge = (c) => Math.min(c, 1 - 1e-9);
  const probes = [];
  for (const v of vzaDownDeg) probes.push(nudge(Math.cos((v * Math.PI) / 180)));
  for (const v of vzaUpDeg)
    probes.push(nudge(Math.cos(((180 - v) * Math.PI) / 180)));
  const mus = [];
  const ws = [];
  for (let i = 0; i < nGauss; i++) {
    mus.push(g.x[i]);
    ws.push(g.w[i]);
  }
  const probeIdx = [];
  for (const p of probes) {
    probeIdx.push(mus.length);
    mus.push(Math.max(p, 1e-6));
    ws.push(0);
  }
  const beamIdx = mus.length;
  mus.push(nudge(mu0));
  ws.push(0);
  const nodes = {mu: Float64Array.from(mus), w: Float64Array.from(ws)};
  const modes = [];
  for (let m = 0; m <= 2; m++)
    modes.push(doubleLayer(m, tau, nodes, depol, nDouble, scalar));
  const nm = nodes.mu.length;
  const n = 3 * nm;
  const out = [];
  const push = (alt, vDeg, list, matKey) => {
    for (let vi = 0; vi < list.length; vi++) {
      const pi = probeIdx[matKey === 'R' ? vzaDownDeg.length + vi : vi];
      for (const dp of dphiDeg) {
        const dpr = (dp * Math.PI) / 180;
        let I = 0;
        let Q = 0;
        let U = 0;
        for (let m = 0; m <= 2; m++) {
          const M = matKey === 'R' ? modes[m].R : modes[m].T;
          const fac = m === 0 ? 1 : 2;
          const cr = Math.cos(m * dpr);
          const sr = Math.sin(m * dpr);
          for (let s = 0; s < 3; s++) {
            const idx = (pi * 3 + s) * n + (beamIdx * 3 + 0);
            const re = M.re[idx];
            const im = M.im[idx];
            const val = fac * (re * cr - im * sr);
            if (s === 0) I += val;
            else if (s === 1) Q += val;
            else U += val;
          }
        }
        out.push({
          altitude: alt,
          vzaDeg: list[vi],
          dphiDeg: dp,
          I: I * mu0 * NORM,
          Q: Q * mu0 * NORM,
          U: U * mu0 * NORM * USIGN
        });
      }
    }
  };
  push(0, null, vzaDownDeg, 'T');
  push(1, null, vzaUpDeg, 'R');
  return out;
}

/**
 * Analytic single scattering for the same slab (diffuse only):
 * reflection (alt 1) and transmission (alt 0) of the beam after
 * exactly one scattering event - the small-tau limit the engine
 * must meet, and the CONTRAST for the neutral points (single
 * scattering has polarization zeros only at the sun itself).
 */
export function singleScatterA1({tau, depol, mu0, muV, up, dphiRad}) {
  const mu = Math.abs(muV);
  let geom;
  let Z;
  if (up) {
    Z = zMatrix(mu, -mu0, dphiRad, depol);
    geom = (mu0 / (4 * (mu + mu0))) * (1 - Math.exp(-tau * (1 / mu + 1 / mu0)));
  } else {
    Z = zMatrix(-mu, -mu0, dphiRad, depol);
    geom =
      mu !== mu0
        ? (mu0 / (4 * (mu0 - mu))) *
          (Math.exp(-tau / mu0) - Math.exp(-tau / mu))
        : ((tau / mu0) * Math.exp(-tau / mu0)) / 4;
    geom = Math.abs(geom);
  }
  return {
    I: (Z[0][0] * geom) / Math.PI,
    Q: (Z[1][0] * geom) / Math.PI,
    U: (Z[2][0] * geom) / Math.PI
  };
}

/**
 * Stage 2: the polarized-sky factor for the water's mirrored
 * dome. Fresnel reflection off water splits Rs/Rp, so the
 * reflected SKY differs from the scalar (Rs+Rp)/2 prediction:
 * with Q = I_l - I_r in the meridian frame of the reflected ray
 * (which IS the incidence plane of a flat-water reflection),
 *   I_refl = Rp I_l + Rs I_r
 *          = ((Rs+Rp)/2) I [ 1 + ((Rp-Rs)/(Rp+Rs)) Q/I ],
 * i.e. a multiplicative factor f = 1 + polK q on the scalar
 * mirror term. The engine supplies q at the mirror direction
 * (the benchmark's own bottom-sensor geometry: theta_i = vza,
 * relative azimuth = view azimuth - solar azimuth); the caller
 * supplies polK(theta_i) from the gated Fresnel split
 * (coxmunk.js) so this module stays dependency-free.
 *
 * The pure-Rayleigh q is diluted per channel by the molecular
 * share w = tauR/(tauR + tauA) - the single-scattering mixing
 * of polarized molecular against near-unpolarized aerosol light
 * (a stated approximation with gate-held limits: tauA = 0
 * recovers the engine exactly, tauA >> tauR recovers the scalar
 * water). Black lower boundary (the sea under this sky is dark,
 * albedo ~0.06 - stated); sun only (the moonlit sky polarizes
 * the same way - stated future stage).
 *
 * Returns {nTheta, nDaz, thetaMaxDeg, data} with data a
 * Float32Array of RGBA texels, rows theta_i in [0, thetaMaxDeg]
 * (endpoint grid), cols relative azimuth in [0, 180] (endpoint
 * grid), f per RGB channel, alpha 1.
 */
export function skyPolLut({
  sunAltDeg,
  tauR = [0.0464, 0.1085, 0.2648],
  tauA = [0, 0, 0],
  depol = 0.03,
  polK,
  nTheta = 16,
  nDaz = 19,
  thetaMaxDeg = 88,
  nGauss = 10,
  nDouble = 20
}) {
  const thetaIDeg = [];
  for (let i = 0; i < nTheta; i++)
    thetaIDeg.push((i * thetaMaxDeg) / (nTheta - 1));
  const dazDeg = [];
  for (let j = 0; j < nDaz; j++) dazDeg.push((j * 180) / (nDaz - 1));
  const mu0 = Math.cos(((90 - sunAltDeg) * Math.PI) / 180);
  const data = new Float32Array(nTheta * nDaz * 4).fill(1);
  for (let ch = 0; ch < 3; ch++) {
    const w = tauR[ch] / (tauR[ch] + tauA[ch]);
    const sol = solveA1({
      tau: tauR[ch],
      depol,
      mu0,
      vzaDownDeg: thetaIDeg,
      vzaUpDeg: [],
      dphiDeg: dazDeg,
      nGauss,
      nDouble
    });
    // solveA1 emits rows vza-outer, dphi-inner.
    for (let i = 0; i < nTheta; i++)
      for (let j = 0; j < nDaz; j++) {
        const r = sol[i * nDaz + j];
        const q = r.Q / Math.max(r.I, 1e-12);
        const f = 1 + polK[i] * w * q;
        data[(i * nDaz + j) * 4 + ch] = Math.min(2, Math.max(0, f));
      }
  }
  return {nTheta, nDaz, thetaMaxDeg, data};
}
