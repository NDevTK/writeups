// Reference printer for the measured snow depth (node
// snotel-reference.mjs). The law lives in snotel.js; landmarks
// hold it on a VENDORED REAL winter response (Red Mountain Pass,
// 713:CO:SNTL, Feb 2026) - the repo's second CORS-open feed
// (browser-direct, the USGS-rivers pattern).
import {
  IN_M,
  parseSnotelStations,
  snotelLatestM,
  SNOTEL_FRESH_D,
  SNOTEL_MAX_DELEV_M,
  SNOTEL_MAX_KM
} from './snotel.js';
import {FT_M} from './contrails.js';
import {SNOTEL_FEB_DATA, SNOTEL_STATION_ROWS} from './snotel-fixture.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- 1. the station row, verbatim -------------------------------
{
  const st = parseSnotelStations(SNOTEL_STATION_ROWS);
  check(
    'AWDB station row -> SNOTEL pillow',
    st.length === 1 &&
      st[0].triplet === '713:CO:SNTL' &&
      st[0].name === 'Red Mountain Pass' &&
      Math.abs(st[0].lat - 37.89168) < 1e-9 &&
      Math.abs(st[0].elevM - 11060 * FT_M) < 1e-9,
    `713:CO:SNTL "Red Mountain Pass" at (37.89168, -107.71389), ` +
      `11060 ft -> ${st[0]?.elevM.toFixed(1)} m through the gated FT_M - ` +
      `only ':SNTL' triplets pass (the endpoint returns every network)`
  );
}

// ---- 2. the winter readings, exact units ------------------------
{
  const m = snotelLatestM(SNOTEL_FEB_DATA);
  check(
    'daily SNWD/WTEQ verbatim in metres',
    m &&
      m.date === '2026-02-12' &&
      Math.abs(m.snwdM - 34 * IN_M) < 1e-12 &&
      Math.abs(m.wteqM - 7.0 * IN_M) < 1e-12 &&
      IN_M === 0.0254,
    `newest row 2026-02-12: 34 in -> ${m.snwdM.toFixed(4)} m depth, ` +
      `7.0 in -> ${m.wteqM.toFixed(4)} m water equivalent - the ` +
      `international inch is 25.4 mm BY DEFINITION, nothing fitted; a ` +
      `mid-winter San Juan pack growing through its storm`
  );
  const density = m.wteqM / m.snwdM;
  check(
    'the pack density is physical',
    density > 0.15 && density < 0.35,
    `WTEQ/SNWD = ${density.toFixed(3)} - settled mid-winter snowpack ` +
      `density in the textbook 0.15-0.35 band (FSM's own regime), the ` +
      `two independent sensors agreeing on one snowpack`
  );
}

// ---- 3. gates and honesty ---------------------------------------
{
  check(
    'documented gates',
    SNOTEL_MAX_KM === 40 && SNOTEL_MAX_DELEV_M === 300 && SNOTEL_FRESH_D === 2,
    `radius ${SNOTEL_MAX_KM} km (the USGS gauge/basin argument), ` +
      `elevation band ${SNOTEL_MAX_DELEV_M} m (under 2 degC by the ` +
      `chain's own ISA 6.5 K/km lapse - mountain snow is ` +
      `elevation-banded) and freshness ${SNOTEL_FRESH_D} d (daily ` +
      `telemetry plus report lag) - outside any, the model stands`
  );
  check(
    'empty honesty',
    snotelLatestM([]) === null &&
      snotelLatestM(null) === null &&
      parseSnotelStations(null).length === 0 &&
      snotelLatestM([{stationTriplet: 'x', data: []}]) === null,
    `no payload, no rows and no finite values all refuse - a missing ` +
      `sensor is not bare ground, and the model stands`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
