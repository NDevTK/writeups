/**
 * sounding.js - MEASURED upper air: twice-daily radiosonde
 * ascents outrank the model aloft, exactly as the AERONET pass
 * put the measured sun photometer over the aerosol model. Gated
 * by sounding-reference.mjs on a vendored real ascent.
 *
 * THE FEED - the University of Wyoming sounding server
 * (weather.uwyo.edu/wsgi/sounding, keyless; TEXT:LIST is the
 * classic fixed-width table: PRES HGHT TEMP DWPT RELH MIXR DRCT
 * SPED THTA THTE THTV). Stations resolve through NOAA's IGRA
 * station list (ncei.noaa.gov igra2-station-list.txt, keyless -
 * ~2900 stations with coordinates; the WMO number is embedded in
 * the IGRA identifier). Neither endpoint sends CORS, so the
 * horizon-live daemon proxies (the METAR pattern).
 *
 * WHAT THE MEASUREMENT REPLACES when a fresh ascent exists
 * within range: the freezing level the bow shaft caps at, the
 * 250 hPa temperature/humidity the Schmidt-Appleman contrail
 * criterion and the cirrus-corona cold gate read, and the
 * 250 hPa wind. The 50 hPa nacreous level stays with the model:
 * real ascents often burst below it (the vendored Payerne
 * ascent tops out at 100 hPa) - stated, not patched.
 *
 * DOCUMENTED GATES: SOUNDING_MAX_KM = 300 (the GCOS upper-air
 * network's continental spacing) and SOUNDING_FRESH_H = 13 (the
 * 00/12Z synoptic cadence plus ascent time) - outside either,
 * the model stands. Interpolation between tabulated rows is
 * linear in log(p) (the profile's own quasi-linear coordinate);
 * at a tabulated level the tabulated number returns exactly.
 */

import {CP, EPS, eLiq} from './contrails.js';

export const WYO_BASE = 'https://weather.uwyo.edu/wsgi/sounding';
export const IGRA_STATIONS =
  'https://www.ncei.noaa.gov/data/integrated-global-radiosonde-archive/doc/igra2-station-list.txt';
export const SOUNDING_MAX_KM = 300;
export const SOUNDING_FRESH_H = 13;

// Fixed-width TEXT:LIST columns (7 chars each, 11 fields).
const F = (line, i) => {
  const s = line.slice(i * 7, i * 7 + 7).trim();
  return s === '' ? NaN : parseFloat(s);
};

// Parse the TEXT:LIST table (the <PRE> block's text): one row
// per level. Rows keep the file's own units (hPa, m, degC, %,
// deg, m/s); blank fixed-width fields become NaN.
export function parseWyoText(text) {
  const rows = [];
  for (const line of String(text || '').split('\n')) {
    if (!/^\s*\d/.test(line)) continue;
    const p = F(line, 0);
    const hM = F(line, 1);
    if (!Number.isFinite(p) || !Number.isFinite(hM)) continue;
    rows.push({
      p,
      hM,
      tC: F(line, 2),
      dwC: F(line, 3),
      rh: F(line, 4),
      drct: F(line, 6),
      spdMs: F(line, 7)
    });
  }
  return rows;
}

// Value of a field at an arbitrary pressure: linear in log(p)
// between the bracketing rows that HAVE the field; exact at a
// tabulated level. null outside the sounding's span.
export function levelAt(rows, hPa, field = 'tC') {
  const have = rows.filter(
    (r) => Number.isFinite(r.p) && Number.isFinite(r[field])
  );
  if (!have.length) return null;
  let lo = null;
  let hi = null;
  for (const r of have) {
    if (r.p >= hPa && (!lo || r.p < lo.p)) lo = r;
    if (r.p <= hPa && (!hi || r.p > hi.p)) hi = r;
  }
  if (!lo || !hi) return null;
  if (lo.p === hi.p) return lo[field];
  const f =
    (Math.log(lo.p) - Math.log(hPa)) / (Math.log(lo.p) - Math.log(hi.p));
  return lo[field] + (hi[field] - lo[field]) * f;
}

// The measured freezing level (m a.s.l.): the first 0 degC
// crossing walking up from the lowest level, linear in height
// across the bracketing pair. A surface already at or below
// freezing returns the surface height; a sounding that never
// freezes returns null.
export function freezingLevelM(rows) {
  const have = rows
    .filter((r) => Number.isFinite(r.hM) && Number.isFinite(r.tC))
    .sort((a, b) => a.hM - b.hM);
  if (!have.length) return null;
  if (have[0].tC <= 0) return have[0].hM;
  for (let i = 1; i < have.length; i++) {
    const a = have[i - 1];
    const b = have[i];
    if (a.tC > 0 && b.tC <= 0) {
      return a.hM + ((b.hM - a.hM) * a.tC) / (a.tC - b.tC);
    }
  }
  return null;
}

// ---- The parcel ascent: LCL, LFC, EL, CAPE from the MEASURED
// profile ------------------------------------------------------
// Every constant printed and already in the repo's chain:
// cp = 1004 and eps = 0.622 are contrails.js's gated Appleman
// constants; Rd = 287.053 is refraction.js's own ISA constant;
// the latent heat of vaporisation is DERIVED from FSM's printed
// Table 1 (Essery 2015, the snow model primary): Lv = Ls - Lf =
// 2.835e6 - 0.334e6 J/kg - the exact triple-point identity
// (sublimation = fusion + vaporisation); g = 9.81 from the same
// table. Saturation vapour pressure is the SHIPPED gated eLiq.
// The ascent is the textbook parcel: dry adiabat (Poisson,
// kappa = Rd/cp) conserving mixing ratio to saturation (the
// LCL, solved by bisection inside its pressure step), then the
// pseudoadiabatic saturated lapse in pressure coordinates,
//   dT/dlnp = (Rd T + Lv ws) / (cp + Lv^2 ws eps / (Rd T^2)),
// against the sounding's own environment rows for buoyancy: LFC
// at the first positive crossing, EL at the last, CAPE =
// integral Rd (Tp - Te) dlnp over the positive area. No
// crossing = null - a stable day builds no measured tower.
export const RD_J_KGK = 287.053;
export const LV_J_KG = 2.835e6 - 0.334e6; // Ls - Lf (FSM Table 1)
export const G_M_S2 = 9.81;

const wsat = (tK, pHpa) => {
  const es = eLiq(tK) / 100; // eLiq returns Pa; work in hPa
  return es >= pHpa ? Infinity : (EPS * es) / (pHpa - es);
};

// The 172nd pass adds the lifted-index reading: liHpa names a level
// (500 hPa, Galway 1956) and the result carries the parcel's and the
// environment's temperatures there, both linear in ln p inside the
// step that crosses it, and their difference liK = Tenv - Tparcel
// (negative: the parcel warmer than its surroundings, unstable) -
// the Legacy Soundings ATBD's Eq. 4 with the same parcel the caller
// hands in (the surface's own, or the mean of the lowest 100 hPa).
export function parcelAscent(rows, {liHpa = 500} = {}) {
  const lv = rows
    .filter(
      (r) =>
        Number.isFinite(r.p) && Number.isFinite(r.hM) && Number.isFinite(r.tC)
    )
    .sort((a, b) => b.p - a.p);
  if (lv.length < 5 || !Number.isFinite(lv[0].dwC)) {
    return {
      lclM: null,
      lfcM: null,
      elM: null,
      capeJkg: null,
      liK: null,
      tParcelLiC: null,
      tEnvLiC: null
    };
  }
  let tParcelLi = null;
  let tEnvLi = null;
  const kappa = RD_J_KGK / CP;
  const sfc = lv[0];
  let T = sfc.tC + 273.15;
  const e0 = eLiq(sfc.dwC + 273.15) / 100; // hPa
  const w0 = (EPS * e0) / (sfc.p - e0);
  let saturated = false;
  let lclM = null;
  let lfcM = null;
  let elM = null;
  let cape = 0;
  let prev = {p: sfc.p, hM: sfc.hM, T, Te: T};
  for (let i = 1; i < lv.length; i++) {
    const env = lv[i];
    const dlnp = Math.log(prev.p / env.p);
    let Tnew;
    if (!saturated) {
      Tnew = T * Math.pow(env.p / prev.p, kappa);
      const eNew = (w0 * env.p) / (EPS + w0);
      if (eNew >= eLiq(Tnew) / 100) {
        // saturation inside this step: bisect on log-p for the LCL
        let lo = 0;
        let hi = dlnp;
        for (let k = 0; k < 40; k++) {
          const mid = (lo + hi) / 2;
          const pm = prev.p * Math.exp(-mid);
          const Tm = T * Math.pow(pm / prev.p, kappa);
          const em = (w0 * pm) / (EPS + w0);
          if (em >= eLiq(Tm) / 100) hi = mid;
          else lo = mid;
        }
        const pl = prev.p * Math.exp(-hi);
        const f = Math.log(prev.p / pl) / dlnp;
        lclM = prev.hM + f * (env.hM - prev.hM);
        // finish the step saturated from the LCL
        let Ts = T * Math.pow(pl / prev.p, kappa);
        const sub = 6;
        const rest = Math.log(pl / env.p);
        for (let k = 0; k < sub; k++) {
          const pm = pl * Math.exp((-rest * (k + 0.5)) / sub);
          const ws = wsat(Ts, pm);
          const dT =
            ((RD_J_KGK * Ts + LV_J_KG * ws) /
              (CP + (LV_J_KG * LV_J_KG * ws * EPS) / (RD_J_KGK * Ts * Ts))) *
            (rest / sub);
          Ts -= dT;
        }
        Tnew = Ts;
        saturated = true;
      }
    } else {
      const sub = 4;
      let Ts = T;
      for (let k = 0; k < sub; k++) {
        const pm = prev.p * Math.exp((-dlnp * (k + 0.5)) / sub);
        const ws = wsat(Ts, pm);
        const dT =
          ((RD_J_KGK * Ts + LV_J_KG * ws) /
            (CP + (LV_J_KG * LV_J_KG * ws * EPS) / (RD_J_KGK * Ts * Ts))) *
          (dlnp / sub);
        Ts -= dT;
      }
      Tnew = Ts;
    }
    const Te = env.tC + 273.15;
    const buoyPrev = prev.T - prev.Te;
    const buoy = Tnew - Te;
    if (saturated) {
      if (buoy > 0 && buoyPrev <= 0 && lfcM === null) lfcM = env.hM;
      if (buoy > 0) {
        cape += RD_J_KGK * ((buoy + Math.max(buoyPrev, 0)) / 2) * dlnp;
        elM = env.hM; // keeps extending while buoyant
      }
    }
    // the lifted-index level, crossed inside this step
    if (
      tParcelLi === null &&
      Number.isFinite(liHpa) &&
      liHpa <= prev.p &&
      liHpa >= env.p
    ) {
      const f = dlnp > 0 ? Math.log(prev.p / liHpa) / dlnp : 0;
      tParcelLi = prev.T + f * (Tnew - prev.T);
      tEnvLi = prev.Te + f * (Te - prev.Te);
    }
    prev = {p: env.p, hM: env.hM, T: Tnew, Te};
    T = Tnew;
  }
  return {
    lclM: lclM !== null ? Math.round(lclM) : null,
    lfcM: lfcM !== null ? Math.round(lfcM) : null,
    elM: elM !== null && cape > 0 ? Math.round(elM) : null,
    capeJkg: cape > 0 ? Math.round(cape) : 0,
    liK: tParcelLi !== null ? tEnvLi - tParcelLi : null,
    tParcelLiC: tParcelLi !== null ? tParcelLi - 273.15 : null,
    tEnvLiC: tEnvLi !== null ? tEnvLi - 273.15 : null
  };
}

// Thin an ascent's rows for transport and for the refraction
// column: the lowest KEEP_LOW rows stay verbatim (surface
// inversions - the mirage-making structure - live in the first
// hundred metres and must not be decimated), the remainder is
// strided to fit maxN, and the top row always survives (the
// column's isothermal continuation anchors there). Fields kept
// are what buildProfile consumes - p, hM, tC, rh - plus the
// level wind (drct, spdMs) where the file reports it: the
// lee-wave layer average rides it (consumers treat wind as
// optional - older daemon payloads lack it).
// CONSISTENCY, stated: the daemon's scalar reductions (parcel
// ascent, BLH, levels) run on the FULL rows before thinning;
// only the transported column is strided - refraction varies
// over hundreds of metres, the reductions' crossings do not
// survive a stride and are never asked to.
export function thinRows(rows, maxN = 120, keepLow = 20) {
  const lv = rows
    .filter(
      (r) =>
        Number.isFinite(r.p) && Number.isFinite(r.hM) && Number.isFinite(r.tC)
    )
    .sort((a, b) => b.p - a.p)
    .map((r) => {
      const o = {
        p: r.p,
        hM: r.hM,
        tC: r.tC,
        rh: Number.isFinite(r.rh) ? r.rh : 0
      };
      if (Number.isFinite(r.drct) && Number.isFinite(r.spdMs)) {
        o.drct = r.drct;
        o.spdMs = r.spdMs;
      }
      return o;
    });
  if (lv.length <= maxN) return lv;
  const low = lv.slice(0, keepLow);
  const rest = lv.slice(keepLow);
  const need = maxN - keepLow - 1;
  const stride = Math.ceil((rest.length - 1) / need);
  const out = low;
  for (let i = 0; i < rest.length - 1; i += stride) out.push(rest[i]);
  out.push(rest[rest.length - 1]);
  return out;
}

// ---- The boundary layer's MEASURED depth: bulk Richardson ----
// The radiosonde PBL method (Vogelezang & Holtslag 1996; Seidel
// et al. 2012; the open AMT 16, 4289 (2023) prints the working
// equation): Ri(z) = (g/thv_s)(thv_z - thv_s)(z - z_s) /
// ((u_z-u_s)^2 + (v_z-v_s)^2), the surface-friction term
// "generally ignored ... due to the much smaller magnitude" (the
// paper's own sentence), and the PBL top is the LOWEST level
// where Ri crosses the printed critical value 0.25, interpolated
// between the bracketing rows. Virtual potential temperature
// carries the EXACT factor (1 + w/eps)/(1 + w) - eps is the
// gated Appleman constant, no 0.61 approximation enters; theta
// rides Rd/cp already exported above. Rows missing dewpoint
// contribute dry thv (w = 0, stated); rows missing wind are
// skipped (the shear denominator needs them). Returns metres
// ABOVE GROUND (the column depth consumers integrate over), or
// null when the profile never crosses.
export const RI_CRIT = 0.25;
// The RESIDUAL layer survives one night: "the residual layer
// contains the pollutants and moisture from the previous mixed
// layer" and a night's stable cooling (or the next day's mixing)
// retires it - Stull, Practical Meteorology (open CC, UBC),
// ch. 18. A previous ascent older than a synoptic day carries no
// residual claim.
export const RESIDUAL_MAX_AGE_H = 24;
export function blhRiM(rows, riC = RI_CRIT) {
  const lv = rows
    .filter(
      (r) =>
        Number.isFinite(r.p) &&
        Number.isFinite(r.hM) &&
        Number.isFinite(r.tC) &&
        Number.isFinite(r.drct) &&
        Number.isFinite(r.spdMs)
    )
    .sort((a, b) => b.p - a.p);
  if (lv.length < 3) return null;
  const thetaV = (r) => {
    const th = (r.tC + 273.15) * Math.pow(1000 / r.p, RD_J_KGK / CP);
    if (!Number.isFinite(r.dwC)) return th;
    const e = eLiq(r.dwC + 273.15) / 100;
    const w = (EPS * e) / (r.p - e);
    return (th * (1 + w / EPS)) / (1 + w);
  };
  const uv = (r) => {
    const a = (r.drct * Math.PI) / 180;
    return [-r.spdMs * Math.sin(a), -r.spdMs * Math.cos(a)];
  };
  const s = lv[0];
  const thS = thetaV(s);
  const [us, vs] = uv(s);
  let prev = {ri: 0, hM: s.hM};
  for (let i = 1; i < lv.length; i++) {
    const r = lv[i];
    const [u, v] = uv(r);
    const du2 = (u - us) * (u - us) + (v - vs) * (v - vs);
    const buoy = (G_M_S2 / thS) * (thetaV(r) - thS) * (r.hM - s.hM);
    const ri = du2 > 0 ? buoy / du2 : buoy > 0 ? Infinity : 0;
    if (ri >= riC) {
      const f =
        prev.ri < riC && Number.isFinite(ri)
          ? (riC - prev.ri) / (ri - prev.ri)
          : 0;
      return Math.round(prev.hM + f * (r.hM - prev.hM) - s.hM);
    }
    prev = {ri, hM: r.hM};
  }
  return null;
}

// Parse the IGRA station list into rows usable for a nearest-
// station search: only entries whose identifier embeds a WMO
// number (..M00#####) and whose record reaches recent years.
// Column offsets are the IGRA format document's own (1-based
// ID 1-11, LAT 13-20, LON 22-30, NAME 42-71, LSTYEAR 78-81).
export function parseIgraStations(text, minYear = 2024) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    if (line.length < 81) continue;
    const id = line.slice(0, 11);
    const m = id.match(/^..M000(\d{5})$/);
    if (!m) continue;
    const lat = parseFloat(line.slice(12, 20));
    const lon = parseFloat(line.slice(21, 30));
    const last = parseInt(line.slice(77, 81), 10);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (!(last >= minYear)) continue;
    out.push({
      wmo: m[1],
      lat,
      lon,
      name: line.slice(41, 71).trim()
    });
  }
  return out;
}
