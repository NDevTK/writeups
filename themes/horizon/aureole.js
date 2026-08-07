/**
 * aureole.js - the solar aureole from the measured aerosol, by way
 * of the delta similarity transformation. Gated by
 * aureole-reference.mjs.
 *
 * The problem: the sky march carries ONE Cornette-Shanks lobe at the
 * measured asymmetry g (GEFS-Aerosols ASYSFK). A single smooth lobe
 * cannot hold the real forward DIFFRACTION SPIKE of coarse
 * particles, so the drawn sky is too flat within a few degrees of
 * the sun and slightly too bright far from it - the circumsolar
 * aureole (dust's own signature) never forms. Hillaire (2020)
 * conditions his low-frequency sky-view LUT on exactly this
 * assumption ("fairly smooth for realistic phase g values") and
 * composites the sun disc per pixel because the LUT cannot hold it;
 * the aureole is the same kind of feature and takes the same road.
 *
 * The physics is the classic delta decomposition (Joseph, Wiscombe
 * & Weinman 1976; Wiscombe's multi-level formulas, NCAR TN-121+STR
 * 1977, read from the scan): split the phase function into a
 * forward spike and a smooth remainder,
 *     P(theta) = f * P_spike(theta) + (1 - f) * CS(g'),
 * run every LUT march in the SCALED system (scattering (1-f)
 * sigma_s, extinction sigma_e - f sigma_s, asymmetry g' with
 * f g_spike + (1 - f) g' = g exactly), and draw the spike term
 * explicitly, per pixel, at first scattering order - light
 * forward-scattered again stays in the quasi-direct beam, which is
 * what the scaled transmittance already says. At f = 0 every
 * relation collapses to identity (the gate pins it), and at
 * g_spike = 1, f = g^2 the g' relation reproduces Wiscombe's
 * printed g/(1+g) verbatim (the gate pins that too).
 *
 * The spike's SHAPE and SHARE are derived, not tuned, from the
 * documents behind the live feed itself:
 *  - GEFS-Aerosols computes its published AODs through the GOCART
 *    optics LUT (Zhang et al. 2022, GMD 15, 5337, Sect. 2.2), whose
 *    per-species size distributions are the GADS/OPAC set printed
 *    in Chin et al. 2002 (JAS 59, 461) Table 2 and Hess, Koepke &
 *    Schult 1998 (BAMS 79, 831) Table 1c - both read from the
 *    papers.
 *  - The spike is Fraunhofer diffraction: a particle of radius r
 *    diffracts exactly its geometric cross-section pi r^2 into the
 *    Airy pattern of that aperture (Babinet; van de Hulst 1957
 *    Sec. 8.31 is the classic statement) - efficiency 1 of the
 *    extinction-paradox total Q -> 2. Both papers PRINT the Q that
 *    signature demands: sea-salt coarse 2.143, the r_e 2.4 um dust
 *    row 2.277 (Chin Table 2) - so each coarse mode's diffracted
 *    share of extinction is 1/Q, a printed number, and its share of
 *    scattering divides by the species' MEASURED single-scattering
 *    albedo (the feed's own SCTAOTK/AOTK at 555 nm).
 *  - Which modes spike is the sources' own coarse/fine terminology,
 *    not an invented bound: sea salt "coa. mode" (SSCM, r_modN
 *    1.75 um dry - Chin's operational row r_m 1.64 is used) and
 *    OPAC's "mineral transported" (MITR, r_modN 0.50 um, sigma
 *    2.20, r_min 0.02, r_max 5 um - the dataset's own component
 *    "to describe desert dust that is transported over long
 *    distances"; its r_e 2.36 um lands on Chin's printed 2.40 um
 *    row). Components the sources label accumulation/nucleation/
 *    submicron (SSAM, sulfate, OC, BC - "all submicron aerosols
 *    with a maximum radius at 0.5 um", Chin's own footnote) carry
 *    no separable diffraction spike: their forward lobes stay
 *    inside the smooth CS term where they always were.
 *  - Within sea salt, the SSAM:SSCM number ratio 20 : 3.2e-3 is
 *    OPAC Table 4's printed maritime-clean mixture (the 20 cm^-3
 *    the paper anchors to a measured 8.9 m/s wind); the coarse
 *    mode's extinction share follows from that ratio, the two
 *    printed Q values and the modes' second moments - computed, not
 *    chosen. Dust is all MITR (documented scope: inside a source
 *    region the three-mode desert mixture would carry more large
 *    particles; the aureole there reads slightly soft).
 *  - Sea salt swells with humidity: Chin Table 3's printed growth
 *    factors (1.6/1.8/2.0/2.4/2.9/4.8 at RH 50/70/80/90/95/99)
 *    scale the mode radius AND the limiting radii ("the mode radius
 *    as well as the limiting radii are increased... sigma_i is
 *    assumed to remain unchanged" - OPAC Sec. 3c, printed words).
 *    Dust does not grow (both papers).
 *
 * Wavelengths: a settled-regime particle diffracts its geometric
 * cross-section at EVERY wavelength, so the spike's absolute
 * scattering tau_spike is channel-independent; only the PATTERN
 * narrows as x = 2 pi r / lambda grows. f per channel is
 * tau_spike over the channel's own Mie scattering tau*ssa. The
 * printed Q at 500 nm serves all three channels (for settled coarse
 * modes Q moves a few percent across 440-680 nm; documented
 * convention, same spirit as the feed's single 340 nm asymmetry).
 */

// ---- printed constants, with their sources ----

// Chin et al. 2002 Table 2 (read from the scan): sea salt coarse
// mode, dry. r_m um, geometric std dev, extinction efficiency Q at
// 500 nm.
export const SSCM = {rm: 1.64, sigma: 2.03, q: 2.143};
// Sea salt accumulation mode (same row set) - needed only for the
// within-species extinction split; it contributes NO spike.
export const SSAM = {rm: 0.228, sigma: 2.03, q: 2.696};
// OPAC Table 1c (Hess et al. 1998, read from the scan): mineral
// transported - r_modN um, sigma, and the PRINTED limiting radii.
// Q from Chin's r_e 2.40 um dust row (MITR's own r_e is 2.36 um).
export const MITR = {rm: 0.5, sigma: 2.2, rMin: 0.02, rMax: 5.0, q: 2.277};
// OPAC Table 4, maritime clean (printed): number densities cm^-3.
export const SS_N_ACC = 20;
export const SS_N_COA = 3.2e-3;
// OPAC Table 1c printed limiting radii for the sea-salt modes (um).
export const SS_R_MIN = 0.005;
export const SS_R_MAX = 60.0;
// Chin et al. 2002 Table 3 (read from the scan): sea-salt
// hygroscopic growth factors r/r_dry at RH %. Dust does not grow.
export const SS_GROWTH_RH = [0, 50, 70, 80, 90, 95, 99];
export const SS_GROWTH_F = [1, 1.6, 1.8, 2.0, 2.4, 2.9, 4.8];

// Theme channels (aerosol.js CHANNEL_NM) in um.
const CHANNEL_UM = [0.68, 0.55, 0.44];

// ---- Bessel J1 (Abramowitz & Stegun 9.4.4 / 9.4.6) ----
// Polynomial approximations, |eps| < 1.3e-8 (small) / ~1e-7
// (large); the gate holds them at A&S printed values and at the
// printed first zero 3.8317059702 (A&S Table 9.5).
export function j1(x) {
  const ax = Math.abs(x);
  let out;
  if (ax < 3) {
    const t = (x / 3) * (x / 3);
    out =
      x *
      (0.5 +
        t *
          (-0.56249985 +
            t *
              (0.21093573 +
                t *
                  (-0.03954289 +
                    t * (0.00443319 + t * (-0.00031761 + t * 0.00001109))))));
  } else {
    const t = 3 / ax;
    const f1 =
      0.79788456 +
      t *
        (0.00000156 +
          t *
            (0.01659667 +
              t *
                (0.00017105 +
                  t * (-0.00249511 + t * (0.00113653 + t * -0.00020033)))));
    const th =
      ax -
      2.35619449 +
      t *
        (0.12499612 +
          t *
            (0.0000565 +
              t *
                (-0.00637879 +
                  t * (0.00074348 + t * (0.00079824 + t * -0.00029166)))));
    out = ((f1 * Math.cos(th)) / Math.sqrt(ax)) * Math.sign(x);
  }
  return out;
}

// ---- truncated-lognormal machinery ----
// dN/d(ln r) ~ exp(-(ln r - ln rm)^2 / (2 ln^2 sigma)); Gauss-
// Legendre in ln r over the printed [rMin, rMax]. The gate holds
// the quadrature against the closed-form moments
// <r^k> = rm^k exp(k^2 ln^2 sigma / 2) with wide bounds.
const GL_N = 96;
let glNodes = null;
function gaussLegendre(n) {
  // Newton on Legendre P_n roots (standard; exact to fp for n=96).
  const nodes = [];
  for (let i = 0; i < n; i++) {
    let x = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5));
    for (let it = 0; it < 100; it++) {
      let p0 = 1;
      let p1 = x;
      for (let k = 2; k <= n; k++) {
        const p2 = ((2 * k - 1) * x * p1 - (k - 1) * p0) / k;
        p0 = p1;
        p1 = p2;
      }
      const dp = (n * (x * p1 - p0)) / (x * x - 1);
      const dx = p1 / dp;
      x -= dx;
      if (Math.abs(dx) < 1e-15) break;
    }
    let p0 = 1;
    let p1 = x;
    for (let k = 2; k <= n; k++) {
      const p2 = ((2 * k - 1) * x * p1 - (k - 1) * p0) / k;
      p0 = p1;
      p1 = p2;
    }
    const dp = (n * (x * p1 - p0)) / (x * x - 1);
    nodes.push([x, 2 / ((1 - x * x) * dp * dp)]);
  }
  return nodes;
}

// Integrate w(r) * weight over the truncated lognormal number
// distribution (unnormalised - ratios of these integrals are what
// the physics uses, so the overall N cancels).
export function lnIntegral(rm, sigma, rMin, rMax, fn) {
  glNodes = glNodes || gaussLegendre(GL_N);
  const a = Math.log(rMin);
  const b = Math.log(rMax);
  const mu = Math.log(rm);
  const s = Math.log(sigma);
  let sum = 0;
  for (const [xi, wi] of glNodes) {
    const u = ((b - a) / 2) * xi + (a + b) / 2; // ln r
    const r = Math.exp(u);
    const g = Math.exp((-0.5 * (u - mu) * (u - mu)) / (s * s));
    sum += wi * g * fn(r);
  }
  return ((b - a) / 2) * sum;
}

// Closed-form untruncated k-th moment ratio helper (gate use).
export function lognormalMomentRatio(rm, sigma, k1, k2) {
  const s2 = Math.log(sigma) ** 2;
  return rm ** (k1 - k2) * Math.exp(((k1 * k1 - k2 * k2) * s2) / 2);
}

// ---- the ensemble diffraction pattern ----
// P(theta) for one mode at wavelength lambda (um): the geometric-
// cross-section-weighted Airy pattern of the truncated lognormal,
//   P = int r^2 (x^2/4pi) [2 J1(x sin)/(x sin)]^2 dN
//       / int r^2 dN            (sr^-1, integrates to 1),
// with x = 2 pi r / lambda. Central value has the closed form
// pi <r^4> / (lambda^2 <r^2>) - a gate landmark.
export function diffractionPattern(mode, lambdaUm, thetasRad, grow = 1) {
  const rm = mode.rm * grow;
  const rMin = (mode.rMin ?? SS_R_MIN) * grow;
  const rMax = (mode.rMax ?? SS_R_MAX) * grow;
  const norm = lnIntegral(rm, mode.sigma, rMin, rMax, (r) => r * r);
  return thetasRad.map((th) => {
    const s = Math.sin(th);
    const num = lnIntegral(rm, mode.sigma, rMin, rMax, (r) => {
      const x = (2 * Math.PI * r) / lambdaUm;
      const u = x * s;
      const core = u < 1e-9 ? 1 : (2 * j1(u)) / u;
      return r * r * ((x * x) / (4 * Math.PI)) * core * core;
    });
    return num / Math.max(norm, 1e-300);
  });
}

// Sea-salt growth factor at RH% - Chin Table 3, linear between the
// printed knots, clamped to the table's range.
export function ssGrowth(rhPct) {
  const rh = Math.min(Math.max(rhPct ?? 80, 0), 99);
  let i = 1;
  while (i < SS_GROWTH_RH.length - 1 && SS_GROWTH_RH[i] < rh) i++;
  const r0 = SS_GROWTH_RH[i - 1];
  const r1 = SS_GROWTH_RH[i];
  const f = (rh - r0) / Math.max(r1 - r0, 1e-9);
  return SS_GROWTH_F[i - 1] + f * (SS_GROWTH_F[i] - SS_GROWTH_F[i - 1]);
}

// SSCM's share of the sea-salt species EXTINCTION: the printed
// maritime-clean number ratio through each mode's printed Q and
// second moment (wet radii; Q at 500 nm by the documented
// convention). Computed, never chosen.
export function sscmExtinctionShare(grow) {
  const m2 = (mode, g) =>
    lnIntegral(
      mode.rm * g,
      mode.sigma,
      SS_R_MIN * g,
      SS_R_MAX * g,
      (r) => r * r
    );
  const acc = SS_N_ACC * SSAM.q * m2(SSAM, grow);
  const coa = SS_N_COA * SSCM.q * m2(SSCM, grow);
  return coa / Math.max(acc + coa, 1e-300);
}

// ---- the delta similarity set ----
// From the live channel set (aerosol.js channelSet: tau/ssa/g per
// channel + species fractions) and the raw products' per-species
// 555 nm AOT + scattering AOT, build everything the scaled system
// and the drawn spike need. Returns null when no coarse spike
// exists (no products, no dust/sea salt) - the caller then runs
// the unscaled system, identical to before this module existed.
export const CURVE_N = 256;
export const THETA_MAX_DEG = 30;

export function aureoleSet(set, products, rhPct) {
  if (!set || !products || !products.species) return null;
  const du = products.species.dust;
  const ss = products.species.seaSalt;
  const band555 = 0.555;
  // Species 555 nm extinction AOTs and measured single-scattering
  // albedos (SCTAOTK/AOTK - the feed's own per-species split).
  const tauDu = Number.isFinite(du?.aot) ? Math.max(du.aot, 0) : 0;
  const tauSs = Number.isFinite(ss?.aot) ? Math.max(ss.aot, 0) : 0;
  if (tauDu + tauSs <= 0) return null;
  const grow = ssGrowth(rhPct);
  const shareCoa = sscmExtinctionShare(grow);
  // Diffracted scattering: per coarse mode, extinction share times
  // the printed 1/Q (the extinction-paradox share). This is a
  // GEOMETRIC cross-section - the same absolute tau at every
  // wavelength for settled modes.
  const tauSpikeDu = tauDu / MITR.q;
  const tauSpikeSs = (tauSs * shareCoa) / SSCM.q;
  const tauSpike = tauSpikeDu + tauSpikeSs;
  if (!(tauSpike > 0)) return null;
  // Per-channel spike fraction of the MIE SCATTERING the marches
  // carry: the channel's own tau * ssa (aerosol.js channel set).
  const fDiff = set.tau.map((t, c) => {
    const sca = Math.max(t * set.ssa[c], 1e-9);
    return Math.min(tauSpike / sca, 0.9);
  });
  // The blended spike pattern per channel: dust + sea-salt coarse
  // patterns weighted by their diffracted-scattering shares.
  const wDu = tauSpikeDu / tauSpike;
  const wSs = tauSpikeSs / tauSpike;
  const thetas = [];
  for (let i = 0; i < CURVE_N; i++)
    thetas.push(((i + 0.5) / CURVE_N) * ((THETA_MAX_DEG * Math.PI) / 180));
  const curve = new Float32Array(CURVE_N * 4);
  const gSpike = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const um = CHANNEL_UM[c];
    const pDu = wDu > 0 ? diffractionPattern(MITR, um, thetas) : null;
    const pSs = wSs > 0 ? diffractionPattern(SSCM, um, thetas, grow) : null;
    let gNum = 0;
    let gDen = 0;
    for (let i = 0; i < CURVE_N; i++) {
      const p = (pDu ? wDu * pDu[i] : 0) + (pSs ? wSs * pSs[i] : 0);
      curve[i * 4 + c] = p;
      const dOm = 2 * Math.PI * Math.sin(thetas[i]);
      gNum += p * Math.cos(thetas[i]) * dOm;
      gDen += p * dOm;
    }
    // Asymmetry of the DRAWN pattern (near 1; exactly 1 recovers
    // the JWW delta limit - the gate pins that identity).
    gSpike[c] = gDen > 0 ? gNum / gDen : 1;
  }
  // Similarity: f g_spike + (1-f) g' = g, exactly (gate identity).
  const gPrime = fDiff.map((f, c) =>
    Math.min(
      Math.max((set.g - f * gSpike[c]) / Math.max(1 - f, 1e-9), -0.99),
      0.99
    )
  );
  // The drawn cone: where the spike's single-scatter source falls
  // under 1% of the FULL smooth source it adds to - Rayleigh at its
  // fixed column plus the scaled Mie lobe, phase-weighted, per
  // channel - beyond that the addition is invisible at any exposure
  // because every term scales with the same sun and column. The
  // Rayleigh channel columns are the march's own constants
  // (5.802/13.558/33.1e-6 /m over the 8 km scale height).
  const cs = (g, cosT) =>
    ((3 / (8 * Math.PI)) * ((1 - g * g) / (2 + g * g)) * (1 + cosT * cosT)) /
    Math.pow(1 + g * g - 2 * g * cosT, 1.5);
  const pR = (cosT) => (3 / (16 * Math.PI)) * (1 + cosT * cosT);
  const TAU_RAYLEIGH = [5.802e-6, 13.558e-6, 33.1e-6].map((s) => s * 8000);
  // Scan the WHOLE curve (the ensemble pattern is ring-averaged,
  // but a mid-curve dip below the floor must not end the scan) and
  // keep the outermost visible angle, padded by one grid step.
  const step = (THETA_MAX_DEG * Math.PI) / 180 / CURVE_N;
  let coneRad = step;
  for (let i = 0; i < CURVE_N; i++) {
    const th = thetas[i];
    const cosT = Math.cos(th);
    for (let c = 0; c < 3; c++) {
      const tauM = Math.max(set.tau[c] * set.ssa[c], 1e-9);
      const spike = fDiff[c] * tauM * curve[i * 4 + c];
      const smooth =
        TAU_RAYLEIGH[c] * pR(cosT) +
        (1 - fDiff[c]) * tauM * cs(gPrime[c], cosT);
      if (spike > 0.01 * smooth) {
        coneRad = Math.min(th + step, (THETA_MAX_DEG * Math.PI) / 180);
        break;
      }
    }
  }
  return {
    fDiff,
    gPrime,
    gSpike,
    curve,
    thetaMaxRad: (THETA_MAX_DEG * Math.PI) / 180,
    coneRad,
    tauSpike,
    shareCoa,
    grow
  };
}

// The similarity scalings of the OTHER optical parameters, printed
// in Wiscombe (1977): tau' = (1 - w f) tau, w' = (1-f) w / (1 - w f).
// The marches apply them per step from the coefficients directly;
// these closed forms exist for the gate to hold both derivations
// to each other (and to reproduce the technote's f = g^2 forms).
export function similarityScale(tau, w, g, f, gSpike = 1) {
  return {
    tau: (1 - w * f) * tau,
    w: ((1 - f) * w) / Math.max(1 - w * f, 1e-12),
    g: (g - f * gSpike) / Math.max(1 - f, 1e-12)
  };
}
