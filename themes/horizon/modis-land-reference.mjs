// modis-land-reference.mjs - the gate modis-land.js promises.
// Landmarks:
//  - the 0.01-deg cache cell snap, clamped at the poles/antimeridian
//  - the exact /dates and /subset URL forms for both products (the
//    security property: URLs are built HERE from a snapped cell and a
//    validated composite date - never from caller input)
//  - the MODIS Ayyyyddd composite calendar pick (latest entry, format
//    validated, malformed -> null)
//  - MOD13Q1 NDVI decode: *1e-4 over -2000..10000, the -3000 fill and
//    out-of-range read null, empty subset (ocean) is a REAL no-measure
//    answer distinct from an unusable response
//  - MOD09A1 reflectance decode: *1e-4 over -100..16000, small negatives
//    clamp to 0, the -28672 fill reads null, band names b03/b04/b01
//  - the sur_refl_state_500m QA decision (LP DAAC bit layout): clear and
//    assumed-clear pass; cloudy, mixed (the Amazon 138 pixel), shadowed,
//    high-cirrus and internal-cloud pixels are rejected; a malformed
//    state FAILS CLOSED - the one bitfield standing between a measured
//    colour and a cloud painted as ground.
import {
  MOD09_BANDS,
  MOD09_STATE_BAND,
  ndviCell,
  ndviDate,
  ndviDatesUrl,
  ndviUrl,
  parseNdvi,
  parseSurface,
  parseSurfaceState,
  surfaceDatesUrl,
  surfaceQaClean,
  surfaceUrl
} from './modis-land.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  const c = ndviCell(46.6234, 8.0361);
  const pole = ndviCell(91.2, -181.4);
  check(
    'cache cell snap',
    c.lat === 46.62 &&
      c.lon === 8.04 &&
      pole.lat === 90 &&
      pole.lon === -180 &&
      ndviCell(-0.004, 0.004).lat === -0 + 0,
    `0.01-deg snap: (46.6234, 8.0361) -> (${c.lat}, ${c.lon}); out-of-range clamps to (${pole.lat}, ${pole.lon})`
  );
}

{
  const cell = {lat: 46.62, lon: 8.04};
  const dURL = ndviDatesUrl(cell);
  const sURL = ndviUrl(cell, 'A2026185');
  const sdURL = surfaceDatesUrl(cell);
  const ssURL = surfaceUrl(cell, 'A2026185', MOD09_BANDS.red);
  check(
    'URL forms',
    dURL ===
      'https://modis.ornl.gov/rst/api/v1/MOD13Q1/dates?latitude=46.62&longitude=8.04' &&
      sURL ===
        'https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?latitude=46.62&longitude=8.04&startDate=A2026185&endDate=A2026185&band=250m_16_days_NDVI&kmAboveBelow=0&kmLeftRight=0' &&
      sdURL ===
        'https://modis.ornl.gov/rst/api/v1/MOD09A1/dates?latitude=46.62&longitude=8.04' &&
      ssURL ===
        'https://modis.ornl.gov/rst/api/v1/MOD09A1/subset?latitude=46.62&longitude=8.04&startDate=A2026185&endDate=A2026185&band=sur_refl_b01&kmAboveBelow=0&kmLeftRight=0' &&
      MOD09_BANDS.blue === 'sur_refl_b03' &&
      MOD09_BANDS.green === 'sur_refl_b04' &&
      MOD09_STATE_BAND === 'sur_refl_state_500m',
    `point queries only (kmAboveBelow=0&kmLeftRight=0), one composite as start=end, bands b03/b04/b01 + state`
  );
}

{
  const good = ndviDate({
    dates: [{modis_date: 'A2026001'}, {modis_date: 'A2026177'}]
  });
  check(
    'composite calendar pick',
    good === 'A2026177' &&
      ndviDate({dates: [{modis_date: '2026-06-26'}]}) === null &&
      ndviDate({dates: []}) === null &&
      ndviDate({}) === null &&
      ndviDate(null) === null,
    `latest Ayyyyddd wins (${good}); non-MODIS date strings, empty and missing calendars all read null`
  );
}

{
  const full = parseNdvi({
    subset: [{data: [10000], calendar_date: '2026-06-26'}]
  });
  const low = parseNdvi({subset: [{data: [-2000]}]});
  const fill = parseNdvi({subset: [{data: [-3000]}]});
  const over = parseNdvi({subset: [{data: [10001]}]});
  const ocean = parseNdvi({subset: []});
  check(
    'MOD13Q1 NDVI decode',
    full.ndvi === 1 &&
      full.date === '2026-06-26' &&
      low.ndvi === -0.2 &&
      fill.ndvi === null &&
      over.ndvi === null &&
      ocean !== null &&
      ocean.ndvi === null &&
      parseNdvi({subset: [{data: ['x']}]}) === null &&
      parseNdvi(null) === null,
    `1e-4 scale over -2000..10000 (10000 -> ${full.ndvi}, -2000 -> ${low.ndvi}); -3000 fill masked; empty subset is a real ocean answer, garbage is null (-> 502)`
  );
}

{
  const bright = parseSurface({
    subset: [{data: [16000], calendar_date: '2026-06-26'}]
  });
  const dark = parseSurface({subset: [{data: [-100]}]});
  const fill = parseSurface({subset: [{data: [-28672]}]});
  check(
    'MOD09A1 reflectance decode',
    bright.refl === 1.6 &&
      dark.refl === 0 &&
      fill.refl === null &&
      parseSurface({subset: [{data: [16001]}]}).refl === null &&
      parseSurface({subset: []}).refl === null &&
      parseSurface(null) === null &&
      parseSurfaceState({subset: [{data: [138]}]}) === 138 &&
      parseSurfaceState({subset: []}) === null,
    `1e-4 scale over -100..16000 (16000 -> ${bright.refl}); a small negative clamps to ${dark.refl}; the -28672 fill masks; state passes through raw (138)`
  );
}

{
  // sur_refl_state_500m (LP DAAC): bits 0-1 cloud state, bit 2 shadow,
  // bits 8-9 cirrus, bit 10 internal cloud. 138 = 0b10001010: cloud
  // bits read 2 (mixed) - the measured Amazon rejection.
  check(
    'surface QA decision',
    surfaceQaClean(0) === true &&
      surfaceQaClean(3) === true &&
      surfaceQaClean(1 << 8) === true &&
      surfaceQaClean(1) === false &&
      surfaceQaClean(2) === false &&
      surfaceQaClean(138) === false &&
      surfaceQaClean(1 << 2) === false &&
      surfaceQaClean(3 << 8) === false &&
      surfaceQaClean(1 << 10) === false &&
      surfaceQaClean(NaN) === false &&
      surfaceQaClean(undefined) === false &&
      surfaceQaClean('0') === false,
    `clear/assumed-clear/low-cirrus pass; cloudy, mixed (138), shadow, high cirrus, internal cloud reject; malformed state fails CLOSED`
  );
}

process.exit(fail ? 1 : 0);
