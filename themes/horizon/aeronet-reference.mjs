// Reference printer for the AERONET direct-sun feed (node
// aeronet-reference.mjs). The law lives once in aeronet.js -
// Giles et al. 2019 (AMT, the Version 3 algorithm paper, open
// access, read in full) over a VENDORED REAL response (site
// GSFC, Level 1.5, fetched 2026-08-08) - and these landmarks
// hold it:
//  - the parser reads the row the way the print defines it: the
//    served Angstrom-exponent columns are Eck 1999 log-log
//    regressions over the exact filter wavelengths, and
//    recomputing them from the same row's AODs lands on the
//    served values to ~1e-5
//  - the channel bridge is the aerosol module's own piecewise
//    Angstrom interpolation - exact on a power law, inside the
//    measured neighbours on the real row
//  - the printed quality frame is carried: standard
//    wavelengths, field uncertainty 0.01-0.02, NRT L1.5 bias
//    +0.02 / sigma 0.02, the physical AE window [-1, 3], the
//    3-min triplet cadence
//  - freshness and the AE fence fail closed - no station, no
//    fresh daylight triplet, out-of-window AE -> the model
//    continues untouched
//  - the station list parses and the nearest-site pick is the
//    haversine minimum inside the documented radius
import {
  AE_RANGE,
  AERONET_FRESH_MIN,
  AERONET_MAX_KM,
  AERONET_NRT_BIAS,
  AERONET_NRT_SIGMA,
  AERONET_UNC,
  AERONET_WL_NM,
  TRIPLET_MIN,
  aeronetChannelTau,
  angstromRegression,
  haversineKm,
  latestFresh,
  nearestAeronetSite,
  parseAeronetSites,
  parseAeronetV3
} from './aeronet.js';
import {AERONET_FIXTURE, AERONET_SITES_FIXTURE} from './aeronet-fixture.js';
import {angstromTau} from './aerosol.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const rows = parseAeronetV3(AERONET_FIXTURE);
const r = rows[rows.length - 1];

// ---- 1. the vendored real row parses exactly --------------------
{
  check(
    'real Level 1.5 row parsed',
    rows.length === 3 &&
      r.site === 'GSFC' &&
      r.lev === 'lev15' &&
      r.tUtcMs === Date.UTC(2026, 7, 8, 18, 3, 47) &&
      Math.abs(r.aod[440.1] - 0.321124) < 1e-9 &&
      Math.abs(r.aod[675.3] - 0.151574) < 1e-9 &&
      Math.abs(r.lat - 38.9925) < 1e-6 &&
      Math.abs(r.lon - -76.839833) < 1e-6 &&
      !(865 in r.aod) &&
      Object.keys(r.aod).length === 8,
    `3 verbatim rows; the newest: 2026-08-08 18:03:47 UT, 8 channels keyed by ` +
      `EXACT filter wavelengths (440.1, 675.3 ... nm), -999 columns dropped ` +
      `(no phantom 865 nm), site coordinates carried`
  );
  check(
    'the feed carries its own gas frame',
    r.o3DU > 250 && r.o3DU < 400 && r.no2DU > 0 && r.no2DU < 1,
    `ozone ${r.o3DU.toFixed(0)} DU and NO2 ${r.no2DU.toFixed(3)} DU ride the ` +
      `row - Giles Eq. (3) subtracts them with the Burrows coefficients, the ` +
      `same laboratory dataset the theme's no2 gate vendors`
  );
}

// ---- 2. the served Angstrom columns re-derive -------------------
{
  const ae1 = angstromRegression(r.aod, 440, 870);
  const ae2 = angstromRegression(r.aod, 440, 675);
  check(
    'served AE columns are the Eck regression, recovered',
    Math.abs(ae1 - r.ae440_870) < 2e-5 &&
      Math.abs(ae2 - r.ae440_675) < 2e-5 &&
      ae1 > AE_RANGE[0] &&
      ae1 < AE_RANGE[1],
    `log-log regression over the exact wavelengths: ${ae1.toFixed(6)} vs ` +
      `served ${r.ae440_870} (440-870); ${ae2.toFixed(6)} vs served ` +
      `${r.ae440_675} (440-675) - the file is read exactly the way the print ` +
      `defines it, and the row sits inside the printed physical window`
  );
}

// ---- 3. the channel bridge --------------------------------------
{
  const ch = aeronetChannelTau(r);
  const alpha = 1.3;
  const syn = {};
  for (const nm of AERONET_WL_NM) syn[nm] = 0.2 * Math.pow(nm / 550, -alpha);
  const bands = AERONET_WL_NM.slice();
  const syn550 = angstromTau(bands, syn, 550);
  check(
    'one wavelength bridge for model and measurement',
    ch &&
      ch[1] < r.aod[499.9] &&
      ch[1] > r.aod[675.3] &&
      Math.abs(ch[2] - r.aod[440.1]) < 1e-3 &&
      ch[2] > ch[1] &&
      ch[1] > ch[0] &&
      Math.abs(syn550 - 0.2) < 1e-12,
    `550 nm lands between the measured 500 and 675 neighbours ` +
      `(${ch[1].toFixed(3)}); 440 on the 440.1 measurement; fine-mode day ` +
      `orders B>G>R; exact on a pure power law (alpha 1.3 roundtrip) - ` +
      `aerosol.js angstromTau serves both feeds`
  );
}

// ---- 4. freshness and fences fail closed ------------------------
{
  const t = r.tUtcMs;
  const fresh = latestFresh(rows, t + 30 * 60e3);
  const stale = latestFresh(rows, t + 4 * 3600e3);
  const badAE = latestFresh([{...r, ae440_870: 3.5}], t + 10 * 60e3);
  check(
    'fails closed to the model',
    fresh === r &&
      stale === null &&
      badAE === null &&
      latestFresh([], Date.now()) === null,
    `30 min after the triplet: served; 4 h after (night): null; AE 3.5 ` +
      `(outside the printed [-1, 3] eliminator): null; no rows: null - the ` +
      `GEFS model resumes in every case, no seams`
  );
  check(
    'printed quality frame carried',
    AERONET_WL_NM.length === 8 &&
      AERONET_WL_NM[0] === 340 &&
      AERONET_WL_NM[7] === 1640 &&
      AERONET_UNC[0] === 0.01 &&
      AERONET_UNC[1] === 0.02 &&
      AERONET_NRT_BIAS === 0.02 &&
      AERONET_NRT_SIGMA === 0.02 &&
      TRIPLET_MIN === 3 &&
      AERONET_FRESH_MIN / TRIPLET_MIN === 30,
    `standard wavelengths 340..1640 nm, field uncertainty 0.01-0.02 (UV max), ` +
      `NRT L1.5 +0.02 bias / 0.02 sigma, 3-min triplets - Giles 2019; the ` +
      `90-min freshness window is 30 printed triplet periods (documented)`
  );
}

// ---- 5. the station list ----------------------------------------
{
  const sites = parseAeronetSites(AERONET_SITES_FIXTURE);
  const nearGSFC = nearestAeronetSite(sites, 38.99, -76.84, AERONET_MAX_KM);
  const nearBerlin = nearestAeronetSite(sites, 52.52, 13.4);
  const midAtlantic = nearestAeronetSite(sites, 40, -40);
  check(
    'nearest station by haversine, radius fails closed',
    sites.length === 6 &&
      nearGSFC &&
      nearGSFC.name === 'GSFC' &&
      nearGSFC.distKm < 1 &&
      nearBerlin &&
      nearBerlin.name === 'Berlin_FUB' &&
      nearBerlin.distKm > 5 &&
      nearBerlin.distKm < 15 &&
      midAtlantic === null &&
      nearestAeronetSite(sites, NaN, 0) === null &&
      Math.abs(haversineKm(38.9925, -76.839833, 38.9925, -76.839833)) < 1e-9,
    `6 verbatim site rows; Greenbelt resolves to GSFC at ` +
      `${nearGSFC.distKm.toFixed(2)} km, Berlin to Berlin_FUB at ` +
      `${nearBerlin.distKm.toFixed(1)} km; mid-Atlantic (no station inside ` +
      `${AERONET_MAX_KM} km) and unmeasured coordinates: null`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
