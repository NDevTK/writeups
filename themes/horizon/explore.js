/**
 * Explore - the single source shared by the theme's destination
 * system (Horizon.html) and the reference printer
 * (explore-reference.mjs).
 *
 * The wallpaper boots at the visitor, but the measured world is
 * not uniformly rich: the busiest shipping lane, the auroral
 * oval, the darkest surveyed sky and the most electrified storm
 * on Earth are each ONE place. Every destination below is a
 * documented, measured superlative (cited per entry), and
 * wherever the repo itself already holds the measurement the
 * menu is annotated by the project's own gated models rather
 * than by prose: zenith sky brightness and Bortle class from the
 * Falchi et al. 2016 atlas shipped in skyglow-data.js,
 * geomagnetic latitude from IGRF-14 (igrf.js).
 *
 * Relocation is a clean re-boot, never a pin: the produced URL
 * carries only lat/lon/place plus infrastructure params
 * (KEEP_PARAMS), so every live source re-anchors and fetches the
 * destination's REAL now. Weather pins (WEATHER_PINS - the same
 * list the theme's `overridden` flag reads, the model lives
 * once) are deliberately dropped on the way.
 */

import {SKYGLOW, SKYGLOW_H, SKYGLOW_W} from './skyglow-data.js';
import {bortleClass, sampleRatio, skyMag} from './skyglow.js';
import {geomagneticLatitude} from './igrf.js';

// Query params that PIN the sky (harness/debug). Any of these
// present = the URL owns the weather and the live fetches stand
// down. lat/lon are NOT pins: choosing where to stand still
// means seeing that place's real sky.
export const WEATHER_PINS = [
  'cloud',
  'wind',
  'precip',
  'snow',
  'temp',
  'winddir',
  'gust',
  'dew',
  'code'
];

// Params that survive a relocation: infrastructure only (the
// debug panel, the DEM opt-out, endpoint overrides). Everything
// else is a pin or a stale place and dies with the old view.
export const KEEP_PARAMS = [
  'debug',
  'dem',
  'demtiles',
  'adsb',
  'ais',
  'live',
  'tles',
  'space',
  'metar',
  'smoke',
  'aerosol',
  'lights',
  'water',
  'buildings',
  'roads',
  'landuse',
  'rivers',
  'rails',
  'trains',
  'aerialways',
  'peaks',
  'discharge',
  'roam'
];

// The measured superlatives. `why` is what the visitor is
// promised; `cite` is the measurement behind the promise.
export const DESTINATIONS = [
  {
    name: 'Dover Strait',
    lat: 51.1,
    lon: 1.35,
    why: 'the busiest shipping lane on Earth: COLREGS-lit vessels stream past all night while cross-Channel jets write contrails overhead',
    cite: 'UK Dept for Transport: ~400 vessel transits/day'
  },
  {
    name: 'Tromsø',
    lat: 69.65,
    lon: 18.96,
    why: 'inside the auroral oval: OVATION probabilities peak here, with polar night in winter and the noctilucent window in midsummer',
    cite: 'IGRF-14 geomagnetic latitude 67.5° - the Feldstein oval'
  },
  {
    name: 'Cerro Paranal',
    lat: -24.63,
    lon: -70.4,
    why: 'the darkest sky on this menu: the Gaia Milky Way, zodiacal light and airglow at full contrast over the Atacama',
    cite: 'Falchi et al. 2016 atlas: pristine zenith (Bortle 1)'
  },
  {
    name: 'Lake Maracaibo',
    lat: 9.36,
    lon: -71.65,
    why: 'the most electrified place on Earth: Catatumbo storms most nights, streamed strike by strike from Blitzortung',
    cite: 'Albrecht et al. 2016 (LIS/OTD): 233 flashes/km²/yr'
  },
  {
    name: 'Grindelwald',
    lat: 46.62,
    lon: 8.04,
    why: 'the Eiger wall: kilometres of measured relief, LEADR-filtered slopes, treeline, seasonal snow and alpenglow',
    cite: 'Copernicus DEM: ~3 km of in-tile relief'
  },
  {
    name: 'Galicia',
    lat: 43.0,
    lon: -8.0,
    why: 'stand in the path: the 2026-08-12 total solar eclipse, computed by this page from its own sun-moon ephemeris',
    cite: 'eclipses-reference.mjs: 100.0% obscuration at maximum'
  },
  {
    name: 'Singapore Strait',
    lat: 1.25,
    lon: 103.85,
    why: 'the densest anchorage on the menu under its brightest sky: shipping without end beneath heavy urban skyglow',
    cite: 'MPA Singapore: busiest transshipment port'
  },
  {
    name: 'Mauna Kea',
    lat: 19.82,
    lon: -155.47,
    why: '4.2 km above the Pacific inversion: the calmest seeing on the menu and a dark mid-ocean sky',
    cite: 'Falchi et al. 2016 atlas: Bortle 1 at the summit'
  }
];

// Annotate a destination with the repo's OWN measurements: the
// Falchi zenith ratio -> mag/arcsec² -> Bortle class, and the
// IGRF-14 geomagnetic latitude (auroral geometry).
export function annotate(d, year = 2026.5) {
  const r = sampleRatio(SKYGLOW, SKYGLOW_W, SKYGLOW_H, d.lat, d.lon);
  const mag = skyMag(r);
  return {
    ratio: r,
    mag,
    bortle: bortleClass(mag),
    gmLat: geomagneticLatitude(d.lat, d.lon, year)
  };
}

// Build the relocation query string from the current one: keep
// KEEP_PARAMS, drop everything else, set the destination (4 dp
// ~= 11 m - more precision than any of the data grids). dest =
// {name, lat, lon}; null/undefined dest = home (the visitor's
// own IP location decides again).
export function relocateURL(search, dest) {
  const p = new URLSearchParams(search);
  const out = new URLSearchParams();
  for (const k of KEEP_PARAMS) if (p.has(k)) out.set(k, p.get(k));
  if (dest && Number.isFinite(dest.lat) && Number.isFinite(dest.lon)) {
    out.set('lat', dest.lat.toFixed(4));
    out.set('lon', dest.lon.toFixed(4));
    if (dest.name) out.set('place', dest.name);
  }
  return '?' + out.toString();
}
