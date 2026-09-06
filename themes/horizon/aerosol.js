/**
 * aerosol.js - the sky's Mie term from MEASURED radiative
 * properties instead of one gray knob. GEFS-Aerosols (NOAA's
 * operational GOCART coupling, Bhattacharjee et al. 2023, WAF)
 * publishes, per 0.25-deg cell and 3-hour step:
 *   - total aerosol optical thickness at 7 wavelength bands
 *     (340/440/555/645/859/1640/11100 nm midpoints)
 *   - total SCATTERING optical thickness at the 555 nm band and
 *     single-scattering albedo + asymmetry factor at the 340 nm
 *     band
 *   - per-species AOT + scattering AOT at 555 nm for dust, sea
 *     salt, sulphate, organic matter and black carbon (GRIB2 code
 *     table 4.233)
 * This module turns decoded messages (grib2.js) into the renderer
 * channel set at the theme's Rayleigh wavelengths (680/550/440):
 *   - tau per channel by piecewise Angstrom (1929) interpolation:
 *     log-log linear between the measured bands, which reproduces
 *     any pure power law EXACTLY (gated)
 *   - single-scattering albedo per channel from the two measured
 *     anchors (340 nm SSALBK and 555 nm SCTAOTK/AOTK) linearly in
 *     ln(lambda) - the same wavelength bridging AERONET applies
 *     between its retrieval wavelengths
 *   - asymmetry g from the measured 340 nm ASYSFK (the only band
 *     the feed publishes; it replaces the hardcoded 0.8)
 * and calibrates the Hillaire exp(-h/1200) Mie profile so the
 * column above the local terrain equals the measured tau exactly
 * (algebraic identity, gated).
 */

// WMO GRIB2 code table 4.233 species carried by the a2d product.
export const SPECIES = {
  62001: 'dust',
  62006: 'sulfate',
  62008: 'seaSalt',
  62009: 'blackCarbon',
  62010: 'organic'
};

// Theme channel wavelengths (nm) - the same 680/550/440 the
// Rayleigh triplet 5.802/13.558/33.1 e-6 encodes.
export const CHANNEL_NM = [680, 550, 440];

export const MIE_H = 1200; // Hillaire Mie profile scale height (m)
export const TAU_MIN = 1e-4; // numeric floor per channel
export const TAU_MAX = 3; // thick dust-storm ceiling
export const SURF_MAX = 4000; // profile calibration elevation cap (m)

import {gridValue} from './grib2.js';

const AOTK = 102;
const SSALBK = 103;
const ASYSFK = 104;
const SCTAOTK = 112;

/**
 * Census of decoded GRIB2 messages at (lat, lon): the measured
 * products keyed by band midpoint wavelength in nm. Returns null
 * when the essentials (multi-band total AOT, 555 scattering AOT,
 * 340 SSA + asymmetry) are not all present and finite.
 */
export function aerosolProducts(msgs, lat, lon) {
  const tau = {};
  let sct555 = null;
  let ssalb340 = null;
  let asy340 = null;
  const species = {};
  let refTime = null;
  let forecastHours = null;
  for (const m of msgs) {
    if (m.paramCategory !== 20 || !m.wavelength) continue;
    // Band midpoint in nm, rounded to 0.1 nm so the key is stable
    // against the metre-scaled floats (858.5, not 858.4999...).
    const nm = Math.round((m.wavelength.lo + m.wavelength.hi) * 1e9 * 5) / 10;
    const v = gridValue(m, lat, lon);
    if (!Number.isFinite(v)) continue;
    refTime = m.refTime || refTime;
    forecastHours = m.forecastHours ?? forecastHours;
    if (m.aerosolType === 62000) {
      if (m.paramNumber === AOTK) tau[nm] = v;
      else if (m.paramNumber === SCTAOTK && Math.abs(nm - 555) < 1) sct555 = v;
      else if (m.paramNumber === SSALBK && Math.abs(nm - 340) < 1) ssalb340 = v;
      else if (m.paramNumber === ASYSFK && Math.abs(nm - 340) < 1) asy340 = v;
    } else if (SPECIES[m.aerosolType] && Math.abs(nm - 555) < 1) {
      const s = (species[SPECIES[m.aerosolType]] ||= {});
      if (m.paramNumber === AOTK) s.aot = v;
      else if (m.paramNumber === SCTAOTK) s.sct = v;
    }
  }
  const bands = Object.keys(tau)
    .map(Number)
    .filter((nm) => nm >= 300 && nm <= 900) // optical bands only
    .sort((a, b) => a - b);
  if (
    bands.length < 3 ||
    !bands.some((nm) => Math.abs(nm - 555) < 1) ||
    sct555 === null ||
    ssalb340 === null ||
    asy340 === null
  )
    return null;
  return {
    bands,
    tau,
    sct555,
    ssalb340,
    asy340,
    species,
    refTime,
    forecastHours
  };
}

/**
 * Piecewise Angstrom interpolation: tau at `nm` from measured
 * band points - linear in (ln lambda, ln tau) between the two
 * bracketing bands (clamped to the outermost pair beyond the
 * range). Exact for a pure power law tau = c * lambda^-alpha.
 */
export function angstromTau(bands, tau, nm) {
  let lo = bands[0];
  let hi = bands[1];
  for (let i = 1; i < bands.length; i++) {
    lo = bands[i - 1];
    hi = bands[i];
    if (nm <= hi) break;
  }
  const tLo = Math.max(tau[lo], 1e-9);
  const tHi = Math.max(tau[hi], 1e-9);
  const f = Math.log(nm / lo) / Math.log(hi / lo);
  return Math.exp(Math.log(tLo) + f * (Math.log(tHi) - Math.log(tLo)));
}

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

/**
 * The renderer channel set from measured products:
 *  tau: extinction optical depth per channel [R680, G550, B440]
 *  ssa: single-scattering albedo per channel (two measured
 *       anchors, linear in ln lambda, clamped [0.05, 1])
 *  g:   asymmetry factor (measured 340 nm anchor, clamped)
 *  fractions: species share of the 555 nm extinction column
 */
export function channelSet(prod) {
  const tau = CHANNEL_NM.map((nm) =>
    clamp(angstromTau(prod.bands, prod.tau, nm), TAU_MIN, TAU_MAX)
  );
  const band555 = prod.bands.find((nm) => Math.abs(nm - 555) < 1);
  const s340 = clamp(prod.ssalb340, 0.05, 1);
  const s555 = clamp(prod.sct555 / Math.max(prod.tau[band555], 1e-9), 0.05, 1);
  const slope = (s555 - s340) / Math.log(555 / 340);
  const ssa = CHANNEL_NM.map((nm) =>
    clamp(s340 + slope * Math.log(nm / 340), 0.05, 1)
  );
  const g = clamp(prod.asy340, 0, 0.95);
  const total = Math.max(prod.tau[band555], 1e-9);
  const fractions = {};
  for (const [k, s] of Object.entries(prod.species))
    if (Number.isFinite(s.aot)) fractions[k] = s.aot / total;
  return {tau, ssa, g, fractions};
}

/**
 * THE HAZE'S KIND (169th pass): the measured products with their
 * species split re-weighted - each species' 555 nm extinction AOT
 * set to its new share of the measured 555 nm total, its scattering
 * AOT kept at the species' own single-scattering ratio (the total's
 * ratio for a species the feed had no column for). The totals, the
 * band AOTs, the anchors and the bands are untouched: the satellite's
 * detection says WHICH aerosol, never how much - the amount stays the
 * model's or the photometer's, stated. Returns a new products object;
 * fractions null or the 555 band missing return the input unchanged.
 */
export function reweightSpecies(prod, fractions) {
  if (!prod || !fractions) return prod;
  const band555 = Array.isArray(prod.bands)
    ? prod.bands.find((nm) => Math.abs(nm - 555) < 1)
    : undefined;
  const total = band555 !== undefined ? prod.tau[band555] : NaN;
  if (!Number.isFinite(total) || !(total > 0)) return prod;
  const totalRatio = Number.isFinite(prod.sct555)
    ? clamp(prod.sct555 / total, 0, 1)
    : 1;
  const species = {};
  const keys = new Set([
    ...Object.keys(prod.species || {}),
    ...Object.keys(fractions)
  ]);
  for (const k of keys) {
    const was = (prod.species || {})[k] || {};
    const f = Number.isFinite(fractions[k]) ? Math.max(fractions[k], 0) : 0;
    const aot = f * total;
    const ratio =
      Number.isFinite(was.aot) && was.aot > 0 && Number.isFinite(was.sct)
        ? clamp(was.sct / was.aot, 0, 1)
        : totalRatio;
    species[k] = {...was, aot, sct: aot * ratio};
  }
  return {...prod, species};
}

/**
 * THE KIND'S OWN OPTICS (170th pass): what the satellite's called kind
 * says about the haze's ABSORPTION and ANGULAR scattering, from the
 * climatology the ADP ATBD itself cites - Dubovik et al. 2002 (J.
 * Atmos. Sci. 59, 590-608; read in full): eight years of AERONET sky
 * radiance at twelve sites inverted to the column's single-scattering
 * albedo omega0, phase-function asymmetry g and refractive index at
 * 440, 670, 870 and 1020 nm (Table 1; omega0 good to 0.03 at tau(440)
 * >= 0.5 and solar zenith over 50 deg; the values given for tau(440)
 * >= 0.4, dust for tau(1020) >= 0.3 and alpha <= 0.6). DUST (Cape
 * Verde, the Saharan outflow over the Atlantic, 1993-2000): omega0
 * 0.93 / 0.98 / 0.99 / 0.99 - weak absorption beyond 550 nm,
 * pronounced in the blue, the paper's own conclusion against the
 * 0.63-0.89 of the older models; g 0.73 / 0.71 / 0.71 / 0.71, nearly
 * flat: coarse particles (rvc 1.9 um, Cvc/Cvf ~50); Angstrom alpha
 * -0.1 to 0.7; n 1.48, k 0.0025 at 440 falling to 0.0006. SMOKE
 * (boreal forest, USA and Canada 1994-98 - the continent GOES's CONUS
 * scene burns): omega0 0.94 / 0.935 / 0.92 / 0.91 falling with
 * wavelength (fine particles, rvf 0.15 um, scatter the blue), g 0.69 /
 * 0.61 / 0.55 / 0.53, alpha 1.0-2.3; the African savanna's 0.88 /
 * 0.84 / 0.80 / 0.78 (85% flaming combustion) is the absorbing bound,
 * the Amazon's 0.94 / 0.93 / 0.91 / 0.90 the forest twin. The sky's
 * channels sit at 680, 550 and 440 nm: 440 is the table's own, 550 and
 * 680 interpolate linearly in ln(lambda) between 440-670 and 670-870
 * (the bridging channelSet already applies between the model's
 * anchors). THE MIX: an external mixture's single-scattering albedo is
 * the extinction-weighted mean of its parts, so the called kind's
 * omega0 enters by its share of the column and the model's value
 * stands for the rest; g the same (a scattering weight, approximated
 * by the extinction share - stated); tau's spectral slope turns toward
 * the kind's alpha (the range's midpoint) at fixed 550 nm, so the
 * measured amount is kept and the colour of the haze becomes the
 * kind's - white-brown and flat for dust, blue-steep for smoke. Share
 * 0 is the input itself. The values are the paper's site averages,
 * each with its printed scatter (0.01-0.03 in omega0) - a climatology,
 * not this column's retrieval, stated on the line.
 */
export const DUBOVIK_2002 = {
  source: 'Dubovik et al. 2002, J. Atmos. Sci. 59, 590-608, Table 1',
  wavelengthsNm: [440, 670, 870, 1020],
  dust: {
    site: 'Cape Verde 1993-2000 (Saharan outflow)',
    omega0: [0.93, 0.98, 0.99, 0.99],
    g: [0.73, 0.71, 0.71, 0.71],
    alpha: [-0.1, 0.7],
    n: 1.48,
    k440: 0.0025
  },
  smoke: {
    site: 'boreal forest, USA and Canada 1994-98',
    omega0: [0.94, 0.935, 0.92, 0.91],
    g: [0.69, 0.61, 0.55, 0.53],
    alpha: [1.0, 2.3],
    n: 1.5,
    k440: 0.0094
  },
  smokeSavanna: {
    site: 'African savanna, Zambia 1995-2000',
    omega0: [0.88, 0.84, 0.8, 0.78],
    g: [0.64, 0.53, 0.48, 0.47],
    alpha: [1.4, 2.2],
    n: 1.51,
    k440: 0.021
  },
  smokeAmazon: {
    site: 'Amazonian forest, Brazil and Bolivia 1993-99',
    omega0: [0.94, 0.93, 0.91, 0.9],
    g: [0.69, 0.58, 0.51, 0.48],
    alpha: [1.2, 2.1],
    n: 1.47,
    k440: 0.0093
  },
  oceanic: {
    site: 'Lanai, Hawaii 1995-2000',
    omega0: [0.98, 0.97, 0.97, 0.97],
    g: [0.75, 0.71, 0.69, 0.68],
    alpha: [0, 1.55],
    n: 1.36,
    k440: 0.0015
  }
};
/** Linear in ln(lambda) between the table's wavelengths, held at the
 * ends. */
export function lnInterp(nmTable, values, nm) {
  if (nm <= nmTable[0]) return values[0];
  const last = nmTable.length - 1;
  if (nm >= nmTable[last]) return values[last];
  for (let i = 1; i <= last; i++)
    if (nm <= nmTable[i]) {
      const f = Math.log(nm / nmTable[i - 1]) / Math.log(nmTable[i] / nmTable[i - 1]);
      return values[i - 1] + f * (values[i] - values[i - 1]);
    }
  return values[last];
}
/** The kind's optics at the theme's channels: {kind, site, ssa
 * [680, 550, 440], g (at 550), alpha (the range's midpoint)}; null
 * for a kind the table lacks. */
export function typeOptics(kind) {
  const t = DUBOVIK_2002[kind];
  if (!t || !Array.isArray(t.omega0)) return null;
  const w = DUBOVIK_2002.wavelengthsNm;
  return {
    kind,
    site: t.site,
    ssa: CHANNEL_NM.map((nm) => lnInterp(w, t.omega0, nm)),
    g: lnInterp(w, t.g, 550),
    alpha: (t.alpha[0] + t.alpha[1]) / 2,
    alphaRange: t.alpha
  };
}
/**
 * The channel set with the called kind mixed in by its share of the
 * column: ssa and g the extinction-share means, tau's slope turned
 * toward the kind's alpha at fixed 550 nm (tau[1] unchanged), every
 * value clamped as channelSet clamps. Share 0 (or an unknown kind)
 * returns the input itself; `type` carries what was mixed for the
 * words.
 */
export function mixTypeOptics(set, kind, share) {
  const t = typeOptics(kind);
  if (!set || !t || !(share > 0)) return set;
  const s = clamp(share, 0, 1);
  const tau550 = set.tau[1];
  const tau = set.tau.map((v, c) =>
    clamp((1 - s) * v + s * tau550 * Math.pow(CHANNEL_NM[c] / 550, -t.alpha), TAU_MIN, TAU_MAX)
  );
  const ssa = set.ssa.map((v, c) => clamp((1 - s) * v + s * t.ssa[c], 0.05, 1));
  const g = clamp((1 - s) * set.g + s * t.g, 0, 0.95);
  return {
    ...set,
    tau,
    ssa,
    g,
    type: {
      kind: t.kind,
      site: t.site,
      share: s,
      ssa: t.ssa,
      g: t.g,
      alpha: t.alpha,
      alphaRange: t.alphaRange,
      before: {tau: set.tau, ssa: set.ssa, g: set.g}
    }
  };
}

/**
 * Calibrate the exp(-h/MIE_H) profile so the column ABOVE the
 * local terrain (hSurf metres) integrates to the measured tau:
 * sigma(0) = tau / (MIE_H * exp(-hSurf/MIE_H)), i.e.
 * integral_hSurf^inf sigma(0) exp(-h/MIE_H) dh = tau exactly.
 * Returns per-channel scattering and absorption coefficients at
 * profile h = 0 (1/m) plus the phase asymmetry - the uniforms the
 * sky consumes.
 */
export function mieCoefficients(set, hSurf) {
  const h0 = clamp(hSurf || 0, 0, SURF_MAX);
  const col = MIE_H * Math.exp(-h0 / MIE_H);
  const scat = set.tau.map((t, c) => (t * set.ssa[c]) / col);
  const abs = set.tau.map((t, c) => (t * (1 - set.ssa[c])) / col);
  return {scat, abs, g: set.g};
}
