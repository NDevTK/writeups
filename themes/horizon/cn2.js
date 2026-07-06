/**
 * Optical-turbulence profile from the measured winds aloft - the
 * single source shared by Horizon's star scintillation feed and the
 * reference printer (cn2-reference.mjs).
 *
 * Model: the Hufnagel-Valley Cn^2 profile (Hufnagel 1974; Valley
 * 1980; the parameterised form and the wind rule are specified in
 * ITU-R P.1621),
 *   Cn^2(h) = 8.148e-56 v^2 h^10 e^(-h/1000)
 *           + 2.7e-16 e^(-h/1500) + A e^(-h/100)   [h in m]
 * whose upper-atmosphere term is driven by v, the RMS wind speed
 * over the 5-20 km slab,
 *   v = sqrt( (1/15 km) int_5km^20km V(h)^2 dh ),
 * computed here from the MEASURED Open-Meteo pressure-level winds
 * (500..50 hPa speeds + geopotential heights). With the canonical
 * v = 21 m/s and A = 1.7e-14 this is the classic HV5/7 profile -
 * named for giving r0 = 5 cm and theta0 = 7 urad at 0.5 um (SPIE
 * Field Guide to Atmospheric Optics), both asserted by the
 * reference printer from the moment integrals:
 *   r0     = [0.423 k^2 mu_0]^(-3/5)
 *   theta0 = [2.914 k^2 mu_{5/3}]^(-3/5)
 * (Fried 1966; Andrews & Phillips, "Laser Beam Propagation through
 * Random Media").
 *
 * Scintillation: the weak-fluctuation (Rytov) point-receiver index
 * for a plane wave,
 *   sigma_I^2 = 2.25 k^(7/6) (sec Z)^(11/6) mu_{5/6},
 * with the scintillation weighting function W(h) = Cn^2(h) h^(5/6)
 * (Tatarskii; the same weighting the MASS turbulence profilers
 * invert). At HV5/7 and 0.5 um this gives sigma_I ~ 0.26 at zenith
 * - the same order as Young (1967)'s naked-eye 0.255 (Young's is
 * SMALLER because the 0.1 s photopic integration averages over the
 * ~2 ms shadow lifetimes), and the display keeps Young's calibrated
 * value as its anchor. The measured winds enter as the RATIO
 *   sigmaScale(v) = sqrt( mu_{5/6}(v) / mu_{5/6}(21) ),
 * i.e. the display's zenith sigma is Young's, scaled by how much
 * more (or less) scintillation the CURRENT jet stream drives than
 * the canonical profile.
 *
 * Timescale: scintillation "flying shadows" are Fresnel-scale
 * cells, rF = sqrt(lambda h), blown across the line of sight at the
 * layer wind - lifetimes of milliseconds (Dravins et al. 1997 II).
 * The crossing rate here uses the W(h)-weighted mean altitude and
 * the W(h)-weighted wind from the measured profile.
 */

import {gaussLegendre} from './ross-li.js';

export const V_REF = 21; // m/s - the HV5/7 canonical RMS wind
export const A_GROUND = 1.7e-14; // m^(-2/3) - HV5/7 ground turbulence
export const LAMBDA_V = 0.5e-6; // m - visible reference wavelength

// Hufnagel-Valley Cn^2 (m^(-2/3)); h in metres above ground.
export function hvCn2(h, v = V_REF, A = A_GROUND) {
  return (
    8.148e-56 * v * v * Math.pow(h, 10) * Math.exp(-h / 1000) +
    2.7e-16 * Math.exp(-h / 1500) +
    A * Math.exp(-h / 100)
  );
}

// ITU-R P.1621 RMS wind over the 5-20 km slab. The measured
// profile is piecewise LINEAR between levels, so int V^2 is exact
// per panel: (v0^2 + v0 v1 + v1^2)/3 * dh. pts: [{h, v}] in m and
// m/s, any order. Null if the profile does not span the slab.
export function vRms(pts) {
  const p = [...pts].sort((a, b) => a.h - b.h);
  if (!p.length || p[0].h > 5000 || p[p.length - 1].h < 20000) return null;
  const at = (h) => {
    let i = 1;
    while (i < p.length - 1 && p[i].h < h) i++;
    const a = p[i - 1];
    const b = p[i];
    return a.v + ((b.v - a.v) * (h - a.h)) / (b.h - a.h);
  };
  const hs = [
    5000,
    ...p.map((q) => q.h).filter((h) => h > 5000 && h < 20000),
    20000
  ];
  let s = 0;
  for (let i = 1; i < hs.length; i++) {
    const v0 = at(hs[i - 1]);
    const v1 = at(hs[i]);
    s += ((v0 * v0 + v0 * v1 + v1 * v1) / 3) * (hs[i] - hs[i - 1]);
  }
  return Math.sqrt(s / 15000);
}

// Turbulence moment mu_p = int_0^30km Cn^2(h) h^p dh by
// Gauss-Legendre (n = 300; the reference printer checks
// convergence).
export function moment(p, v = V_REF, A = A_GROUND, n = 300) {
  const g = gaussLegendre(n);
  const H = 30000;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const h = (H / 2) * (g.x[i] + 1);
    s += g.w[i] * hvCn2(h, v, A) * Math.pow(h, p);
  }
  return (s * H) / 2;
}

// Fried parameter (m) and isoplanatic angle (rad) at zenith.
export function friedR0(v = V_REF, lambda = LAMBDA_V) {
  const k = (2 * Math.PI) / lambda;
  return Math.pow(0.423 * k * k * moment(0, v), -3 / 5);
}

export function isoplanatic(v = V_REF, lambda = LAMBDA_V) {
  const k = (2 * Math.PI) / lambda;
  return Math.pow(2.914 * k * k * moment(5 / 3, v), -3 / 5);
}

// Weak-fluctuation (Rytov) point-receiver scintillation index for a
// plane wave.
export function rytovVar(v = V_REF, secZ = 1, lambda = LAMBDA_V) {
  const k = (2 * Math.PI) / lambda;
  return 2.25 * Math.pow(k, 7 / 6) * Math.pow(secZ, 11 / 6) * moment(5 / 6, v);
}

// The display's measured-wind modulation of Young's calibrated
// zenith sigma: exactly 1 at the canonical profile.
export function sigmaScale(v) {
  return Math.sqrt(moment(5 / 6, v) / moment(5 / 6, V_REF));
}

// Scintillation-weighted mean altitude (m): int W h dh / int W dh
// with W = Cn^2 h^(5/6) - jet-dominated for HV.
export function weightedAltitude(v = V_REF) {
  return moment(11 / 6, v) / moment(5 / 6, v);
}

// Flying-shadow crossing rate (Hz): the W(h)-weighted wind from the
// measured profile, crossing the Fresnel scale of the weighted
// altitude (Dravins II: shadow cells are rF-sized and live rF/V).
export function shadowRate(pts, v, lambda = LAMBDA_V) {
  const hBar = weightedAltitude(v);
  const rF = Math.sqrt(lambda * hBar);
  const p = [...pts].sort((a, b) => a.h - b.h);
  const at = (h) => {
    if (h <= p[0].h) return p[0].v;
    if (h >= p[p.length - 1].h) return p[p.length - 1].v;
    let i = 1;
    while (i < p.length - 1 && p[i].h < h) i++;
    const a = p[i - 1];
    const b = p[i];
    return a.v + ((b.v - a.v) * (h - a.h)) / (b.h - a.h);
  };
  // W-weighted wind over the measured span (GL on the span).
  const g = gaussLegendre(96);
  const lo = p[0].h;
  const hi = p[p.length - 1].h;
  let num = 0;
  let den = 0;
  for (let i = 0; i < 96; i++) {
    const h = lo + ((hi - lo) / 2) * (g.x[i] + 1);
    const w = g.w[i] * hvCn2(h, v) * Math.pow(h, 5 / 6);
    num += w * at(h);
    den += w;
  }
  return num / den / rF;
}
