/**
 * buoy.js - MEASURED sea state: NOAA NDBC wave buoys report the
 * ocean's own spectrum, and the FFT ocean can ride it directly -
 * the radiosonde pattern (measured outranks model) applied to the
 * wave model. Gated by buoy-reference.mjs on vendored real files
 * (station 46042, Monterey Bay).
 *
 * THE FEED - ndbc.noaa.gov/data/realtime2/<id>.<product>
 * (keyless; no CORS, so the horizon-live daemon proxies - the
 * METAR pattern). Five products join into a directional spectrum:
 *   .data_spec  C11(f): spectral density m^2/Hz, ~46 bands, plus
 *               NDBC's own wind-sea/swell separation frequency
 *   .swdir      alpha1(f): mean wave direction per band (deg true)
 *   .swdir2     alpha2(f): principal direction per band
 *   .swr1/.swr2 r1(f), r2(f): first/second normalised polar
 *               Fourier coefficients (dimensionless, 0..1)
 *   .txt        the standard met row (WVHT, DPD, MWD, WTMP...)
 * Stations resolve through activestations.xml (~1350 entries).
 * 999.0 is NDBC's missing sentinel in the directional files.
 *
 * THE LAW - Longuet-Higgins, Cartwright & Smith (1963): a buoy's
 * pitch-roll (or GPS) motion yields the first two harmonics of
 * the directional distribution at each frequency,
 *   D(theta | f) = (1/pi) (1/2 + r1 cos(theta - alpha1)
 *                         + r2 cos 2(theta - alpha2)),
 * which integrates to exactly 1 over the circle (the harmonics
 * integrate to zero) - held as a landmark, and truncated negative
 * lobes are clamped at draw time (stated, the standard practice).
 * The spectral moment identity Hs = 4 sqrt(m0), m0 = integral of
 * C11(f) df (trapezoid over the file's own bands), ties the
 * spectrum to the buoy's own reported WVHT - measured against
 * measured, no model in the loop.
 *
 * DOCUMENTED GATES: BUOY_MAX_KM = 150 (half the coastal network's
 * ~300 km spacing; deep-water swell stays coherent over that
 * range) and BUOY_FRESH_H = 3 (hourly-or-faster reporting plus
 * processing lag) - outside either, the wave model stands.
 */

export const NDBC_BASE = 'https://www.ndbc.noaa.gov/data/realtime2/';
export const NDBC_STATIONS = 'https://www.ndbc.noaa.gov/activestations.xml';
export const BUOY_MAX_KM = 150;
export const BUOY_FRESH_H = 3;

// One spectral-file row: "YY MM DD hh mm [sep] v (f) v (f) ..."
// -> {at: Date-ms, sep: Hz|null, f: [Hz], v: [values]}. The
// data_spec rows carry the separation frequency before the pairs;
// the four directional products go straight to pairs. 999-valued
// bands are NDBC's missing sentinel -> null.
export function parseSpecRow(line, hasSep) {
  const m = String(line || '').match(
    /^(\d{4}) (\d{2}) (\d{2}) (\d{2}) (\d{2}) +(.*)$/
  );
  if (!m) return null;
  const at = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let rest = m[6].trim();
  let sep = null;
  if (hasSep) {
    const s = rest.match(/^([\d.]+)\s+(.*)$/);
    if (!s) return null;
    // 9.999 is NDBC's missing flag for Sep_Freq (some hulls
    // never compute the wind-sea/swell split).
    sep = parseFloat(s[1]);
    if (sep >= 9.99) sep = null;
    rest = s[2];
  }
  const f = [];
  const v = [];
  const re = /(-?[\d.]+)\s*\(([\d.]+)\)/g;
  let p;
  while ((p = re.exec(rest))) {
    const val = parseFloat(p[1]);
    f.push(parseFloat(p[2]));
    v.push(val >= 999 ? null : val);
  }
  if (!f.length) return null;
  return {at, sep, f, v};
}

// First (= newest) data row of a realtime2 spectral file.
export function firstSpecRow(text, hasSep) {
  for (const line of String(text || '').split('\n')) {
    if (line.startsWith('#')) continue;
    const r = parseSpecRow(line, hasSep);
    if (r) return r;
  }
  return null;
}

// The newest .txt met row with a finite value in the named field
// (rows interleave 10-min met and hourly wave records, so the
// newest row often has WVHT = MM). Fields per the file's own
// header: WVHT 8, DPD 9, APD 10, MWD 11, WTMP 14.
// realtime2 .txt columns: YY MM DD hh mm WDIR WSPD GST WVHT DPD APD
// MWD PRES ATMP WTMP DEWP VIS PTDY TIDE (the wind - 138th pass -
// is the buoy's anemometer wind in m/s, height per station)
const TXT_FIELDS = {
  wdir: 5,
  wspd: 6,
  gst: 7,
  wvht: 8,
  dpd: 9,
  apd: 10,
  mwd: 11,
  wtmp: 14
};
export function firstTxtValue(text, field) {
  const idx = TXT_FIELDS[field];
  if (idx === undefined) return null;
  for (const line of String(text || '').split('\n')) {
    if (line.startsWith('#')) continue;
    const c = line.trim().split(/\s+/);
    if (c.length < 15) continue;
    const val = parseFloat(c[idx]);
    if (Number.isFinite(val)) {
      return {
        at: Date.UTC(+c[0], +c[1] - 1, +c[2], +c[3], +c[4]),
        val
      };
    }
  }
  return null;
}

// Zeroth spectral moment m0 = integral C11(f) df by trapezoid on
// the file's own (irregular) bands, and the printed identity
// Hs = 4 sqrt(m0).
export function m0OfSpec(f, s) {
  let m0 = 0;
  for (let i = 1; i < f.length; i++) {
    const a = s[i - 1];
    const b = s[i];
    if (a === null || b === null) continue;
    m0 += ((a + b) / 2) * (f[i] - f[i - 1]);
  }
  return m0;
}
export const hsOfM0 = (m0) => 4 * Math.sqrt(Math.max(m0, 0));

// Longuet-Higgins truncated directional distribution at one band.
// theta and the alphas in RADIANS here; alpha convention (from
// true north, meteorological) is the caller's concern - this is
// the printed series itself. Negative lobes of the truncated
// series are clamped by the CALLER at draw time (stated).
export function lhD(theta, a1, a2, r1, r2) {
  return (
    (1 / Math.PI) *
    (0.5 + r1 * Math.cos(theta - a1) + r2 * Math.cos(2 * (theta - a2)))
  );
}

// Parse activestations.xml into rows for a nearest search. Only
// stations flagged met="y" (they report the realtime2 products).
export function parseStations(xml) {
  const out = [];
  const re =
    /<station id="([^"]+)" lat="([-\d.]+)" lon="([-\d.]+)"[^>]*? name="([^"]*)"[^>]*?type="([^"]*)"[^>]*?met="y"/g;
  let m;
  while ((m = re.exec(String(xml || '')))) {
    out.push({
      id: m[1],
      lat: parseFloat(m[2]),
      lon: parseFloat(m[3]),
      name: m[4],
      type: m[5]
    });
  }
  return out;
}
