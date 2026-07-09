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
