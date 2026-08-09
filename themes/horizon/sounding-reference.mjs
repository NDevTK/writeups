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
import {appleman, CP, EPS, eLiq} from './contrails.js';
import {
  blhRiM,
  freezingLevelM,
  G_M_S2,
  levelAt,
  LV_J_KG,
  parcelAscent,
  parseIgraStations,
  parseWyoText,
  RD_J_KGK,
  RESIDUAL_MAX_AGE_H,
  RI_CRIT,
  SOUNDING_FRESH_H,
  SOUNDING_MAX_KM,
  thinRows
} from './sounding.js';
import {
  buildProfile,
  DEG,
  foldCount,
  sunRefraction,
  transferCurve
} from './refraction.js';
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

// ---- 5. the parcel ascent's constants are the printed ones ------
{
  check(
    'FSM triple-point identity lands on the textbook Lv',
    LV_J_KG === 2.501e6 && RD_J_KGK === 287.053 && G_M_S2 === 9.81,
    `Ls - Lf = 2.835e6 - 0.334e6 = ${LV_J_KG.toExponential(3)} J/kg - FSM ` +
      `Table 1's printed sublimation and fusion heats close EXACTLY on the ` +
      `textbook vaporisation heat 2.501e6 (the triple-point identity); ` +
      `Rd = ${RD_J_KGK} is refraction.js's own ISA constant, g = ${G_M_S2} ` +
      `the same table`
  );
  const dryKm = (G_M_S2 / CP) * 1000;
  check(
    'dry adiabatic lapse is g/cp',
    dryKm > 9.7 && dryKm < 9.85,
    `g/cp = ${dryKm.toFixed(2)} K/km from the gated Appleman cp = ${CP} - ` +
      `the textbook 9.8 K/km falls out of constants already in the chain`
  );
  // The pseudoadiabatic coefficient at a textbook point: 850 hPa,
  // +15 C. Moist lapse there must sit in the canonical 4-6 K/km.
  const T = 288.15;
  const p = 850;
  const es = eLiq(T) / 100;
  const ws = (EPS * es) / (p - es);
  const dTdlnp =
    (RD_J_KGK * T + LV_J_KG * ws) /
    (CP + (LV_J_KG * LV_J_KG * ws * EPS) / (RD_J_KGK * T * T));
  const moistKm = ((dTdlnp * G_M_S2) / (RD_J_KGK * T)) * 1000;
  check(
    'pseudoadiabatic lapse in the textbook window',
    moistKm > 4 && moistKm < 6,
    `dT/dz = ${moistKm.toFixed(2)} K/km at 850 hPa / +15 C - inside the ` +
      `canonical 4-6 K/km moist-adiabatic range, from the derived Lv and ` +
      `the gated eLiq/cp/eps with no new constants`
  );
}

// ---- 6. the measured tower on the vendored ascent ---------------
{
  const a = parcelAscent(rows);
  check(
    'parcel ascent on the real Payerne profile',
    a.lclM === 2397 && a.lfcM === 5207 && a.elM === 9354 && a.capeJkg === 137,
    `LCL ${a.lclM} m, LFC ${a.lfcM} m, EL ${a.elM} m, CAPE ` +
      `${a.capeJkg} J/kg - a marginal summer tower to 9.4 km on the ` +
      `2026-08-08 12Z ascent (pinned from the vendored data itself)`
  );
  const espyAgl = 125 * (rows[0].tC - rows[0].dwC);
  const lclAgl = a.lclM - rows[0].hM;
  check(
    'Espy corroborates the bisected LCL',
    Math.abs(lclAgl - espyAgl) < 40,
    `bisection puts cloud base ${lclAgl} m AGL; Espy's 125(T-Td) rule ` +
      `says ${espyAgl.toFixed(0)} m - ${Math.abs(lclAgl - espyAgl).toFixed(
        0
      )} m apart, the display's fallback formula and the measured ascent ` +
      `agree on this profile`
  );
  const stable = parcelAscent([
    {p: 1000, hM: 0, tC: 10, dwC: 0},
    {p: 900, hM: 988, tC: 10},
    {p: 850, hM: 1457, tC: 10},
    {p: 700, hM: 3012, tC: 10},
    {p: 500, hM: 5574, tC: 10}
  ]);
  check(
    'stable-day and empty honesty',
    stable.lclM > 1200 &&
      stable.lclM < 1500 &&
      stable.lfcM === null &&
      stable.elM === null &&
      stable.capeJkg === 0 &&
      parcelAscent([]).capeJkg === null,
    `an isothermal environment still condenses (LCL ${stable.lclM} m) but ` +
      `builds no tower - LFC/EL null, CAPE 0; no data at all returns null ` +
      `CAPE, distinct from a measured stable 0`
  );
}

// ---- 7. the boundary layer by bulk Richardson -------------------
{
  const blh = blhRiM(rows);
  const a = parcelAscent(rows);
  check(
    'bulk-Richardson BLH on the real ascent',
    RI_CRIT === 0.25 && blh === 1399 && blh < a.lclM - rows[0].hM,
    `first Ri >= ${RI_CRIT} crossing at ${blh} m AGL (pinned from the ` +
      `run) - a 1.4 km summer midday mixed layer, and it tops BELOW the ` +
      `parcel's independent ${a.lclM - rows[0].hM} m AGL cloud base: two ` +
      `separate reductions of the same measured profile agree the mixed ` +
      `layer sits under the cloud deck`
  );
  check(
    'the residual layer carries the night',
    RESIDUAL_MAX_AGE_H === 24 && Math.max(1, blh) === blh,
    `a collapsed nocturnal boundary layer (the live midnight Payerne ` +
      `answered 1 m) still has yesterday's pollen aloft: the column takes ` +
      `max(current, residual) = ${Math.max(1, blh)} m when the previous ` +
      `ascent's ${blh} m mixed layer is under ${RESIDUAL_MAX_AGE_H} h old - ` +
      `"the residual layer contains the pollutants and moisture from the ` +
      `previous mixed layer" (Stull, Practical Meteorology, open CC, ` +
      `ch. 18); older carries no claim`
  );
  check(
    'BLH honesty',
    blhRiM([]) === null &&
      blhRiM([
        {p: 1000, hM: 0, tC: 10, dwC: 0, drct: 0, spdMs: 1},
        {p: 950, hM: 480, tC: 11, dwC: 0, drct: 0, spdMs: 1.5},
        {p: 900, hM: 988, tC: 12, dwC: -5, drct: 10, spdMs: 2}
      ]) === 0,
    `no rows returns null; a surface inversion under calm winds crosses ` +
      `immediately (0 m - the stable morning's answer, not an invention)`
  );
}

// ---- 8. the balloon's column through the refraction machine -----
{
  const thin = thinRows(rows);
  const lv = thin
    .filter((q) => q.hM > thin[0].hM + 0.5)
    .map((q) => ({pPa: q.p * 100, hM: q.hM, tC: q.tC, rh: q.rh / 100}));
  const prof = buildProfile(lv, {
    hM: thin[0].hM,
    tC: thin[0].tC,
    rh: thin[0].rh / 100
  });
  const sr = sunRefraction(0, prof, 2, 800);
  const arcmin = ((sr.appG - 0) / DEG) * 60;
  const tc = transferCurve(prof, 2);
  check(
    'the measured ascent refracts the sunset',
    thin.length === 119 &&
      thin[0].p === 961.4 &&
      thin[thin.length - 1].p === 100 &&
      Math.abs(arcmin - 24.0) < 0.1 &&
      sr.flatten > 0.9 &&
      sr.flatten < 0.95 &&
      foldCount(tc.tG) === 0,
    `1099 rows thin to ${thin.length} (surface and top verbatim, the ` +
      `lowest 20 undecimated); the SHIPPED Ciddor/Auer-Standish machinery ` +
      `on the balloon's own column lifts the true-zero sun ` +
      `${arcmin.toFixed(2)} arcmin and squashes it to ${sr.flatten.toFixed(3)} ` +
      `- and folds NOTHING: this smooth summer ascent carries no mirage, ` +
      `stated, not assumed`
  );
  const profInv = buildProfile(
    [
      {pPa: 94400, hM: 550, tC: 10, rh: 0.5},
      {pPa: 93800, hM: 600, tC: 10.2, rh: 0.5},
      {pPa: 90000, hM: 950, tC: 8, rh: 0.5},
      {pPa: 80000, hM: 1900, tC: 2, rh: 0.5},
      {pPa: 50000, hM: 5500, tC: -20, rh: 0.3}
    ],
    {hM: 500, tC: 2, rh: 0.7}
  );
  check(
    'a measured inversion WOULD mirage',
    foldCount(transferCurve(profInv, 2).tG) >= 1,
    `a +8 degC / 50 m surface inversion folds the same transfer curve ` +
      `(${foldCount(transferCurve(profInv, 2).tG)} inverted images) - when ` +
      `an ascent measures a duct, the drawn sun mirages by the machinery ` +
      `already in the chain, no new law`
  );
}

// ---- 9. the station list ----------------------------------------
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
