// Reference printer for the explore/destination system (node
// explore-reference.mjs). The menu is a set of measured claims,
// so the gate holds the menu to the measurements the repo itself
// ships:
//  - the Falchi 2016 atlas annotates every destination: Paranal
//    must floor the atlas (pristine, Bortle 1) and Singapore must
//    top it - the menu's dark/bright poles are data, not copy
//  - IGRF-14 places Tromsø inside the auroral zone (the only
//    entry there) and the equatorial entries far outside it
//  - relocation URL hygiene: weather pins die, infrastructure
//    params survive, coordinates land at 4 dp, home strips the
//    location entirely - and the pin list explore exports is the
//    one the theme's `overridden` flag reads (no drift possible)
import {
  DESTINATIONS,
  KEEP_PARAMS,
  WEATHER_PINS,
  annotate,
  relocateURL
} from './explore.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  const names = new Set(DESTINATIONS.map((d) => d.name));
  check(
    'destination table',
    DESTINATIONS.length === 8 &&
      names.size === DESTINATIONS.length &&
      DESTINATIONS.every(
        (d) =>
          Math.abs(d.lat) <= 90 &&
          Math.abs(d.lon) <= 180 &&
          d.why.length > 0 &&
          d.cite.length > 0
      ),
    `${DESTINATIONS.length} destinations, unique names, coords in range, every promise cited`
  );
}

{
  // The Falchi atlas (skyglow-data.js) annotates the menu; the
  // ENSEMBLE ordering is the landmark. Paranal floors the atlas
  // exactly: ratio 0 -> skyMag 22.00 (the Falchi natural
  // reference) -> Bortle 1. Singapore is the bright pole.
  const a = new Map(DESTINATIONS.map((d) => [d.name, annotate(d)]));
  const mags = [...a.values()].map((x) => x.mag);
  const paranal = a.get('Cerro Paranal');
  const singapore = a.get('Singapore Strait');
  check(
    'Falchi annotations',
    paranal.ratio === 0 &&
      paranal.mag === 22 &&
      paranal.bortle === 1 &&
      paranal.mag === Math.max(...mags) &&
      singapore.mag === Math.min(...mags) &&
      singapore.bortle >= 7 &&
      a.get('Mauna Kea').bortle === 1 &&
      a.get('Lake Maracaibo').bortle === 1,
    `Paranal ratio 0 -> 22.00 mag/arcsec² Bortle 1 (darkest of ${mags.length}); Singapore ${singapore.mag.toFixed(2)} Bortle ${singapore.bortle} (brightest); Mauna Kea + Maracaibo Bortle 1`
  );
}

{
  // IGRF-14 auroral geometry: Tromsø sits inside the classical
  // auroral zone (|gmLat| 64-70, Feldstein oval at quiet Kp) and
  // is the ONLY destination that does; the equatorial entries
  // are nowhere near it.
  const gm = new Map(DESTINATIONS.map((d) => [d.name, annotate(d).gmLat]));
  const inZone = DESTINATIONS.filter((d) => {
    const g = Math.abs(gm.get(d.name));
    return g >= 64 && g <= 70;
  });
  check(
    'IGRF oval geometry',
    inZone.length === 1 &&
      inZone[0].name === 'Tromsø' &&
      Math.abs(gm.get('Singapore Strait')) < 12 &&
      Math.abs(gm.get('Lake Maracaibo')) < 25,
    `Tromsø gmLat ${gm.get('Tromsø').toFixed(1)}° - the one entry in the 64-70° auroral zone; Singapore ${gm.get('Singapore Strait').toFixed(1)}°, Maracaibo ${gm.get('Lake Maracaibo').toFixed(1)}°`
  );
}

{
  // Relocation hygiene: pins dropped, infrastructure kept, 4 dp
  // coords, place carried; home strips the location so the IP
  // decides again. The exported pin list is the theme's
  // `overridden` list (single source) - it must not contain
  // lat/lon (location is not a pin) and must not overlap the
  // keep list (a kept pin would survive relocation).
  const search =
    '?cloud=90&code=3&hsw=2&time=2026-01-01T00:00&debug=1&dem=0' +
    '&adsb=https://x.test/adsb&lat=1&lon=2&place=Old';
  const dover = DESTINATIONS[0];
  const out = new URLSearchParams(relocateURL(search, dover));
  const home = new URLSearchParams(relocateURL(search, null));
  const overlap = WEATHER_PINS.filter((k) => KEEP_PARAMS.includes(k));
  check(
    'relocate hygiene',
    out.get('lat') === '51.1000' &&
      out.get('lon') === '1.3500' &&
      out.get('place') === 'Dover Strait' &&
      out.get('debug') === '1' &&
      out.get('dem') === '0' &&
      out.get('adsb') === 'https://x.test/adsb' &&
      !out.has('cloud') &&
      !out.has('code') &&
      !out.has('hsw') &&
      !out.has('time') &&
      !home.has('lat') &&
      !home.has('lon') &&
      !home.has('place') &&
      home.get('debug') === '1' &&
      !WEATHER_PINS.includes('lat') &&
      !WEATHER_PINS.includes('lon') &&
      overlap.length === 0,
    `Dover -> lat=51.1000 lon=1.3500 place kept, debug/dem/adsb survive, cloud/code/hsw/time dropped; home strips the location; pin/keep lists disjoint`
  );
}

process.exit(fail ? 1 : 0);
