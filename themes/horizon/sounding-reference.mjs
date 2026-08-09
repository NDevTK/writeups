// Reference printer for the measured-upper-air machinery (node
// sounding-reference.mjs). The law lives in sounding.js and the
// landmarks hold it on a VENDORED REAL ascent (Payerne WMO
// 06610, 2026-08-08 12Z, every third TEXT:LIST row verbatim):
//  - the fixed-width parser reads the file's own first and last
//    rows back exactly
//  - the measured freezing level falls between its bracketing
//    tabulated rows (a summer Alpine 0 degC near 4.4 km)
//  - log-p interpolation returns tabulated values exactly at
//    tabulated levels and brackets between them
//  - the measured 250 hPa level feeds the SHIPPED
//    Schmidt-Appleman criterion (contrails.js) - cross-module,
//    same numbers the display consumes
//  - the IGRA station list parser finds Payerne itself at its
//    published coordinates
import {appleman} from './contrails.js';
import {
  freezingLevelM,
  levelAt,
  parseIgraStations,
  parseWyoText,
  SOUNDING_FRESH_H,
  SOUNDING_MAX_KM
} from './sounding.js';
import {WYO_FIXTURE_TEXT} from './sounding-fixture.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const rows = parseWyoText(WYO_FIXTURE_TEXT);

// ---- 1. the parser reads the file back --------------------------
{
  const a = rows[0];
  const z = rows[rows.length - 1];
  check(
    'fixed-width rows verbatim',
    rows.length > 1000 &&
      a.p === 961.4 &&
      a.hM === 491 &&
      a.tC === 28.3 &&
      a.dwC === 13.1 &&
      z.p === 100.0 &&
      z.hM === 16684 &&
      z.tC === -59.0,
    `${rows.length} levels; surface 961.4 hPa / 491 m / 28.3 C and top ` +
      `100 hPa / 16684 m / -59.0 C exactly as the Wyoming table prints ` +
      `them - the parser adds nothing`
  );
}

// ---- 2. the measured freezing level -----------------------------
{
  const f = freezingLevelM(rows);
  const below = rows
    .filter((r) => r.tC > 0)
    .reduce((m, r) => Math.max(m, r.hM), 0);
  check(
    'freezing level between its bracketing rows',
    f !== null && f > 4395 && f <= 4409 && below <= 4395,
    `measured 0 C at ${f?.toFixed(0)} m - between the tabulated +0.1 C at ` +
      `4395 m and 0.0 C at 4409 m (the ascent's own bracket); the summer ` +
      `Alpine freezing level the bow shaft will cap at`
  );
  const frozen = freezingLevelM([
    {hM: 100, tC: -3},
    {hM: 1000, tC: -10}
  ]);
  check(
    'frozen surface and never-freezing honesty',
    frozen === 100 &&
      freezingLevelM([
        {hM: 100, tC: 5},
        {hM: 1000, tC: 3}
      ]) === null,
    `a below-zero surface freezes at the surface (${frozen} m); a sounding ` +
      `that never crosses returns null - no invented level either way`
  );
}

// ---- 3. log-p interpolation -------------------------------------
{
  const exact = levelAt(rows, 961.4, 'tC');
  const mid = levelAt(rows, 250, 'tC');
  const rh = levelAt(rows, 250, 'rh');
  check(
    'log-p interpolation exact at tabulated levels',
    exact === 28.3 &&
      mid !== null &&
      mid > -47.4 &&
      mid < -47.2 &&
      rh > 23 &&
      rh < 26,
    `961.4 hPa returns 28.3 C untouched; 250 hPa interpolates to ` +
      `${mid?.toFixed(2)} C / ${rh?.toFixed(0)}% RH between the ascent's ` +
      `250.8 and 249.9 hPa rows - the measured jet-level state`
  );
}

// ---- 4. the measured level feeds the shipped criterion ----------
{
  const t250 = levelAt(rows, 250, 'tC');
  const rh250 = levelAt(rows, 250, 'rh');
  const c = appleman(25000, t250, rh250 / 100);
  check(
    'measured 250 hPa through the SHIPPED Schmidt-Appleman',
    c && typeof c.forms === 'boolean' && Number.isFinite(c.tlc),
    `appleman(25000 ft, ${t250.toFixed(1)} C, ${(rh250 / 100).toFixed(2)}) ` +
      `-> forms=${c.forms}${c.forms ? `, persists=${c.persists}` : ''} ` +
      `(T_LC ${c.tlc.toFixed(1)} C) - the very function the display ` +
      `consumes, now on the balloon's numbers`
  );
  check(
    'documented gates',
    SOUNDING_MAX_KM === 300 && SOUNDING_FRESH_H === 13,
    `radius ${SOUNDING_MAX_KM} km (continental network spacing), ` +
      `freshness ${SOUNDING_FRESH_H} h (00/12Z cadence + ascent) - outside ` +
      `either, the model stands`
  );
}

// ---- 5. the station list ----------------------------------------
{
  // The REAL Payerne row, verbatim from the fetched list.
  const line =
    'SZM00006610  46.8116    6.9425  490.0    PAYERNE (6610-0)               1943 2026  78734';
  const st = parseIgraStations(line + '\n');
  check(
    'IGRA row -> WMO station',
    st.length === 1 &&
      st[0].wmo === '06610' &&
      Math.abs(st[0].lat - 46.8116) < 1e-6 &&
      Math.abs(st[0].lon - 6.9425) < 1e-6 &&
      st[0].name === 'PAYERNE (6610-0)',
    `SZM00006610 -> WMO 06610 at (46.8116, 6.9425) "PAYERNE (6610-0)", ` +
      `active through 2026 - the vendored ascent's own station, verbatim ` +
      `from the NOAA list`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
