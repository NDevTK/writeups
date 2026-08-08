/**
 * aeronet.js - MEASURED direct-sun aerosol optical depth from
 * the nearest AERONET station: ground-truth Sun photometry
 * outranking the aerosol model where a photometer actually
 * looked, exactly as a fresh METAR outranks the cloud model and
 * a NOAA gauge outranks the tide model. Gated by
 * aeronet-reference.mjs against a vendored real data row.
 *
 * THE PRIMARY - Giles et al. 2019 ("Advancements in the AERONET
 * Version 3 database...", AMT 12, 169-209, open access, READ IN
 * FULL): the V3 algorithm paper. What it prints and this module
 * carries:
 *  - the network: 600+ autonomously operated Cimel Sun
 *    photometers; direct-Sun AOD is "considered the ground
 *    truth in the measurement of AOD given minimal assumptions,
 *    reliable calibration, and weak dependency on trace gases"
 *  - nominal standard aerosol wavelengths 340, 380, 440, 500,
 *    675, 870, 1020, 1640 nm (the served columns; each
 *    instrument's EXACT filter wavelengths ride along and this
 *    parser keys by them)
 *  - measurement triplets every 3 min (modern instruments;
 *    15 min for old model 4s) - the freshness scale
 *  - V3 Level 1.5 = NEAR-REAL-TIME automatic cloud screening
 *    and instrument-anomaly quality control; Level 2.0 adds
 *    pre- and post-field calibration. The near-real-time L1.5
 *    estimated uncertainty: "+0.02 bias and one sigma
 *    uncertainty of 0.02, spectrally"; field-instrument AOD
 *    uncertainty 0.01-0.02 (maximum in the UV channels)
 *  - the V3 quality controls this feed arrives through: the
 *    triplet-variability cloud screen (> MAX{0.01 or
 *    0.015 tau} at 675/870/1020 simultaneously), the physical
 *    Angstrom-exponent window (rows with AE440-870 outside
 *    [-1.0, 3.0] eliminated), smoothness and aureole-curvature
 *    checks
 *  - their Eq. (3): tau_aerosol = tau_total - Rayleigh - H2O -
 *    O3 - NO2 - CO2 - CH4, with the NO2 term computed from the
 *    OMI climatology and the Burrows et al. 1998 absorption
 *    coefficients - the SAME laboratory dataset this theme's
 *    no2 gate vendors from the MPI-Mainz atlas: the feed's own
 *    gas correction and the theme's drawn absorber share a
 *    printed source
 *  - the served Angstrom-exponent columns are the log-log
 *    LINEAR REGRESSION of AOD on wavelength over 440-870 nm
 *    (Eck et al. 1999) - the gate recomputes it from the same
 *    row's AODs and lands on the served value
 *
 * THE FEED - the AERONET v3 web service (print_web_data_v3,
 * keyless, no CORS header -> served through the theme's
 * horizon-live daemon like METAR/ADS-B) and the station list
 * (aeronet_locations_v3.txt, ~1700 sites). The theme asks the
 * daemon for the nearest station's latest Level 1.5 direct-sun
 * observation; the channel bridge to 680/550/440 nm is the
 * aerosol module's own piecewise Angstrom interpolation
 * (aerosol.js angstromTau - one wavelength bridge for the model
 * bands and the measured ones; Giles' own 935 nm extrapolation
 * uses the same Eck 1999 log-log construction).
 *
 * THE SPLIT, documented: direct-sun photometry measures
 * EXTINCTION optical depth only - the measured taus replace the
 * model's per-channel tau while single-scattering albedo,
 * asymmetry and the species split stay with the model (those
 * are inversion/model quantities; the direct measurement cannot
 * override them).
 *
 * Fails closed everywhere: no station within the radius, no
 * fresh daylight observation, malformed row -> the model
 * continues exactly as before.
 */

import {angstromTau} from './aerosol.js';

// ---- Giles et al. 2019, printed ---------------------------------
export const AERONET_WL_NM = [340, 380, 440, 500, 675, 870, 1020, 1640];
export const AERONET_UNC = [0.01, 0.02]; // field AOD uncertainty (max = UV)
export const AERONET_NRT_BIAS = 0.02; // printed L1.5 NRT bias estimate
export const AERONET_NRT_SIGMA = 0.02; // printed L1.5 NRT one-sigma
export const AE_RANGE = [-1.0, 3.0]; // printed physical AE window
export const TRIPLET_MIN = 3; // printed modern cadence (minutes)

// Documented display constants (not printed): the point
// measurement's representativity radius, and the freshness
// window (~30 triplets at the printed cadence; direct sun exists
// only in daylight, so night hands back to the model by
// construction).
export const AERONET_MAX_KM = 75;
export const AERONET_FRESH_MIN = 90;

// ---- the v3 CSV -------------------------------------------------
// Header-driven parse of a print_web_data_v3 response (Version 3
// Direct Sun, AOD10/15/20). Returns observation rows with AOD
// keyed by each channel's EXACT filter wavelength (nm; the
// nominal column name is the fallback), -999 dropped, times UTC.
export function parseAeronetV3(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length);
  const hi = lines.findIndex((l) => l.startsWith('AERONET_Site,'));
  if (hi < 0) return [];
  const cols = lines[hi].split(',');
  const idx = {};
  cols.forEach((c, i) => {
    if (!(c in idx)) idx[c] = i;
  });
  const aodCols = [];
  for (const c of cols) {
    const m = /^AOD_(\d+)nm$/.exec(c);
    if (m) {
      aodCols.push({
        nm: +m[1],
        i: idx[c],
        ix: idx['Exact_Wavelengths_of_AOD(um)_' + m[1] + 'nm']
      });
    }
  }
  const num = (v) => {
    const x = parseFloat(v);
    return Number.isFinite(x) && x > -998 ? x : null;
  };
  const out = [];
  for (let li = hi + 1; li < lines.length; li++) {
    const f = lines[li].split(',');
    if (f.length < cols.length - 5) continue;
    const dm = /^(\d{2}):(\d{2}):(\d{4})$/.exec(f[idx['Date(dd:mm:yyyy)']]);
    const tm = /^(\d{2}):(\d{2}):(\d{2})$/.exec(f[idx['Time(hh:mm:ss)']]);
    if (!dm || !tm) continue;
    const tUtcMs = Date.UTC(+dm[3], +dm[2] - 1, +dm[1], +tm[1], +tm[2], +tm[3]);
    const aod = {};
    for (const c of aodCols) {
      const v = num(f[c.i]);
      if (v === null || v < 0) continue;
      const ex = c.ix !== undefined ? num(f[c.ix]) : null;
      const nm = ex && ex > 0.2 && ex < 2 ? Math.round(ex * 1e4) / 10 : c.nm;
      aod[nm] = v;
    }
    out.push({
      site: f[idx['AERONET_Site_Name']] || f[0],
      tUtcMs,
      aod,
      ae440_870: num(f[idx['440-870_Angstrom_Exponent']]),
      ae440_675: num(f[idx['440-675_Angstrom_Exponent']]),
      lev: f[idx['Data_Quality_Level']] || null,
      lat: num(f[idx['Site_Latitude(Degrees)']]),
      lon: num(f[idx['Site_Longitude(Degrees)']]),
      elevM: num(f[idx['Site_Elevation(m)']]),
      o3DU: num(f[idx['Ozone(Dobson)']]),
      no2DU: num(f[idx['NO2(Dobson)']])
    });
  }
  return out;
}

// The newest observation still inside the freshness window, with
// the printed AE window as a sanity fence (Giles' own row
// eliminator) - null fails closed to the model.
export function latestFresh(rows, nowMs, freshMin = AERONET_FRESH_MIN) {
  let best = null;
  for (const r of rows) {
    if (!Number.isFinite(r.tUtcMs)) continue;
    if (nowMs - r.tUtcMs > freshMin * 60e3 || r.tUtcMs > nowMs + 15 * 60e3)
      continue;
    if (Object.keys(r.aod).length < 3) continue;
    if (
      r.ae440_870 !== null &&
      (r.ae440_870 < AE_RANGE[0] || r.ae440_870 > AE_RANGE[1])
    )
      continue;
    if (!best || r.tUtcMs > best.tUtcMs) best = r;
  }
  return best;
}

// Log-log linear-regression Angstrom exponent over 440-870 nm
// (Eck et al. 1999, as Giles prints the served columns) - the
// gate lands this on the row's own served value.
export function angstromRegression(aod, loNm = 440, hiNm = 870) {
  const pts = [];
  for (const k of Object.keys(aod)) {
    const nm = +k;
    if (nm >= loNm - 5 && nm <= hiNm + 5 && aod[k] > 0) {
      pts.push([Math.log(nm), Math.log(aod[k])]);
    }
  }
  if (pts.length < 2) return null;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const [x, y] of pts) {
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
  }
  const n = pts.length;
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  return -b;
}

// The channel bridge: the measured bands to the theme's
// 680/550/440 nm through the aerosol module's own piecewise
// Angstrom interpolation - one bridge for model and measurement.
export function aeronetChannelTau(obs) {
  const bands = Object.keys(obs.aod)
    .map(Number)
    .sort((a, b) => a - b);
  if (bands.length < 2) return null;
  return [680, 550, 440].map((nm) => angstromTau(bands, obs.aod, nm));
}

// ---- the station list -------------------------------------------
export function parseAeronetSites(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const f = line.split(',');
    if (f.length < 4) continue;
    const lon = parseFloat(f[1]);
    const lat = parseFloat(f[2]);
    const elev = parseFloat(f[3]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({name: f[0], lat, lon, elevM: Number.isFinite(elev) ? elev : 0});
  }
  return out;
}
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * R) / 2) ** 2 +
    Math.cos(lat1 * R) *
      Math.cos(lat2 * R) *
      Math.sin(((lon2 - lon1) * R) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}
export function nearestAeronetSite(sites, lat, lon, maxKm = AERONET_MAX_KM) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  let best = null;
  let bestD = maxKm;
  for (const s of sites) {
    const d = haversineKm(lat, lon, s.lat, s.lon);
    if (d < bestD) {
      bestD = d;
      best = {...s, distKm: d};
    }
  }
  return best;
}
