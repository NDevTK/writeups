// Reference printer for the measured wave spectrum (node
// buoy-reference.mjs). The law lives in buoy.js and
// ocean-spectrum.js's bands mode; the landmarks hold it on
// VENDORED REAL NDBC files (station 46042 Monterey Bay,
// 2026-08-09, newest rows verbatim):
//  - the five spectral products parse back exactly
//  - the printed moment identity Hs = 4 sqrt(m0) reproduces the
//    buoy's OWN reported WVHT at the same timestamp - measured
//    against measured, no model in the loop
//  - the spectral peak reproduces the buoy's own DPD and MWD
//  - the Longuet-Higgins distribution integrates to exactly 1
//  - the k-space change of variables conserves the tabulated
//    variance through the SAME spectrumK the display renders
import {
  BUOY_FRESH_H,
  BUOY_MAX_KM,
  firstSpecRow,
  firstTxtValue,
  hsOfM0,
  lhD,
  m0OfSpec,
  parseSpecRow,
  parseStations
} from './buoy.js';
import {calibrateBuoyBands, spectrumK} from './ocean-spectrum.js';
import {
  NDBC_SPEC,
  NDBC_SWDIR,
  NDBC_SWDIR2,
  NDBC_SWR1,
  NDBC_SWR2,
  NDBC_TXT
} from './buoy-fixture.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const RAD = Math.PI / 180;
// The same met -> world-XZ conversion the display's seaDirRad
// applies (waves come FROM deg; the spectrum wants TOWARD).
const seaDirRad = (deg) => {
  const a = (deg + 180) * RAD;
  return Math.atan2(-Math.cos(a), Math.sin(a));
};

const spec = firstSpecRow(NDBC_SPEC, true);
const a1 = firstSpecRow(NDBC_SWDIR, false);
const a2 = firstSpecRow(NDBC_SWDIR2, false);
const r1 = firstSpecRow(NDBC_SWR1, false);
const r2 = firstSpecRow(NDBC_SWR2, false);

// ---- 1. the parsers read the files back -------------------------
{
  check(
    'realtime2 rows verbatim',
    spec &&
      new Date(spec.at).toISOString() === '2026-08-09T02:20:00.000Z' &&
      spec.sep === 0.15 &&
      spec.f.length === 46 &&
      spec.f[0] === 0.033 &&
      spec.v[0] === 0 &&
      spec.f[5] === 0.058 &&
      spec.v[5] === 1.08 &&
      a1.f.length === 46 &&
      a1.v[5] === 176 &&
      r1.v[5] === 0.37,
    `02:20Z, 46 bands, separation ${spec.sep} Hz; C11(0.058 Hz) = ` +
      `${spec.v[5]} m²/Hz with alpha1 ${a1.v[5]} deg, r1 ${r1.v[5]} - ` +
      `exactly as the files print them`
  );
  check(
    '999 sentinel and MM honesty',
    a1.v.filter((x) => x === null).length === 4 &&
      a1.v[0] === null &&
      spec.v[0] === 0 &&
      parseSpecRow('2026 08 09 03 00 9.999 0.100 (0.100)', true).sep === null,
    `the four empty low-frequency direction bands parse as null (999 ` +
      `sentinel), a measured zero density stays 0, and the 9.999 ` +
      `Sep_Freq flag (hulls that never compute the split - the live ` +
      `46236 answered it) parses null - absence and zero stay distinct`
  );
}

// ---- 2. the printed moment identity, measured vs measured -------
{
  const m0 = m0OfSpec(spec.f, spec.v);
  const hs = hsOfM0(m0);
  const wv = firstTxtValue(NDBC_TXT, 'wvht');
  check(
    'Hs = 4 sqrt(m0) reproduces the buoy WVHT',
    Math.abs(hs - 1.19) < 0.005 &&
      wv.val === 1.2 &&
      wv.at === spec.at &&
      Math.abs(hs - wv.val) < 0.05,
    `4 sqrt(${m0.toFixed(4)}) = ${hs.toFixed(3)} m against the buoy's ` +
      `own WVHT ${wv.val} m at the SAME 02:20Z record - the trapezoid ` +
      `over the file's own bands closes the printed identity to ` +
      `${((Math.abs(hs - wv.val) / wv.val) * 100).toFixed(1)}%`
  );
  const dpd = firstTxtValue(NDBC_TXT, 'dpd');
  const mwd = firstTxtValue(NDBC_TXT, 'mwd');
  let pk = 0;
  for (let i = 0; i < spec.f.length; i++)
    if ((spec.v[i] ?? 0) > (spec.v[pk] ?? 0)) pk = i;
  check(
    'spectral peak reproduces DPD and MWD',
    Math.abs(1 / spec.f[pk] - dpd.val) < 1.5 &&
      Math.abs(a1.v[pk] - mwd.val) <= 8,
    `peak band ${spec.f[pk]} Hz -> ${(1 / spec.f[pk]).toFixed(1)} s vs ` +
      `reported DPD ${dpd.val} s; alpha1 at the peak ${a1.v[pk]} deg vs ` +
      `reported MWD ${mwd.val} deg - the 17 s Pacific swell, twice`
  );
}

// ---- 3. the Longuet-Higgins distribution ------------------------
{
  const A1 = a1.v[5] * RAD;
  const A2 = a2.v[5] * RAD;
  let I = 0;
  const N = 4096;
  for (let i = 0; i < N; i++)
    I +=
      lhD(((i + 0.5) / N) * 2 * Math.PI, A1, A2, r1.v[5], r2.v[5]) *
      ((2 * Math.PI) / N);
  check(
    'D(theta) integrates to exactly 1',
    Math.abs(I - 1) < 1e-9,
    `integral over the circle = ${I.toFixed(9)} at the peak band's own ` +
      `coefficients - the harmonics integrate to zero analytically, the ` +
      `quadrature only confirms it`
  );
  check(
    'documented gates',
    BUOY_MAX_KM === 150 && BUOY_FRESH_H === 3,
    `radius ${BUOY_MAX_KM} km (half the coastal network's spacing - ` +
      `deep-water swell stays coherent over it), freshness ` +
      `${BUOY_FRESH_H} h (hourly-or-faster reporting plus processing) - ` +
      `outside either, the wave model stands`
  );
}

// ---- 4. the variance survives into the DISPLAY's k-space --------
{
  const bands = spec.f.map((f, i) => ({
    f,
    s: spec.v[i],
    a1: a1.v[i] !== null ? seaDirRad(a1.v[i]) : NaN,
    a2: a2.v[i] !== null ? seaDirRad(a2.v[i]) : NaN,
    r1: r1.v[i],
    r2: r2.v[i]
  }));
  const cal = calibrateBuoyBands(bands);
  const params = {D: 3000, U10: 0, F: 150e3, windDir: 0, bands: cal};
  let m0k = 0;
  const NK = 1500;
  const NT = 180;
  const dk = 1.2 / NK;
  const dt = (2 * Math.PI) / NT;
  for (let i = 0; i < NK; i++) {
    const k = (i + 0.5) * dk;
    for (let j = 0; j < NT; j++) {
      const th = (j + 0.5) * dt;
      m0k +=
        spectrumK(k * Math.cos(th), k * Math.sin(th), params) * k * dk * dt;
    }
  }
  const m0 = m0OfSpec(spec.f, spec.v);
  check(
    'k-space change of variables conserves m0',
    m0k / m0 > 0.985 && m0k / m0 < 1.01,
    `integrating spectrumK's bands mode over the k-plane returns ` +
      `${((m0k / m0) * 100).toFixed(1)}% of the tabulated variance ` +
      `(4 sqrt = ${hsOfM0(m0k).toFixed(3)} m) - the dispersion Jacobian ` +
      `and the clamped-renormalised spreading hand the buoy's energy to ` +
      `the FFT unchanged`
  );
  // The buoy SAYS this swell is broad: r1 = 0.37 at the peak. The
  // parametric swell mode would have imposed Goda's s_max = 75.
  const wPk = 2 * Math.PI * spec.f[5];
  const kPk = (wPk * wPk) / 9.81;
  const toward = seaDirRad(a1.v[5]);
  const Sp = spectrumK(kPk * Math.cos(toward), kPk * Math.sin(toward), params);
  const So = spectrumK(
    kPk * Math.cos(toward + Math.PI),
    kPk * Math.sin(toward + Math.PI),
    params
  );
  check(
    'measured spreading beats the imposed one',
    Sp / So > 2 && Sp / So < 4,
    `energy toward 176 deg over its opposite = ${(Sp / So).toFixed(1)} ` +
      `at the swell peak - the buoy measures a BROAD 17 s swell ` +
      `(r1 0.37), where the parametric mode would have imposed the ` +
      `s_max = 75 pencil; the measurement corrects the model's shape`
  );
}

// ---- 5. the station list ----------------------------------------
{
  // The REAL 46042 row, verbatim from activestations.xml.
  const st = parseStations(
    '<station id="46042" lat="36.787" lon="-122.408" elev="0" ' +
      'name="MONTEREY - 27NM WNW of Monterey, CA" owner="NDBC" ' +
      'pgm="NDBC Meteorological/Ocean" type="buoy" met="y" ' +
      'currents="n" waterquality="n" dart="n"/>'
  );
  check(
    'activestations row -> buoy',
    st.length === 1 &&
      st[0].id === '46042' &&
      Math.abs(st[0].lat - 36.787) < 1e-6 &&
      Math.abs(st[0].lon + 122.408) < 1e-6 &&
      st[0].type === 'buoy',
    `46042 at (36.787, -122.408) "${st[0]?.name}" - the vendored ` +
      `spectrum's own station, met="y" gating the search to stations ` +
      `that actually report`
  );
  check(
    'empty honesty',
    calibrateBuoyBands(null) === null &&
      calibrateBuoyBands([{f: 0.1, s: 1}]) === null &&
      m0OfSpec([0.1, 0.2], [null, null]) === 0 &&
      firstSpecRow('', true) === null,
    `no bands, one band, all-null densities and empty files all refuse ` +
      `- the wave model stands unless a real spectrum arrives`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
