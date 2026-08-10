#!/usr/bin/env node
/**
 * observatory-freeze.mjs - refreeze the observatory's fixture day
 * in one command. The 114th-118th passes froze 2026-08-09 by
 * hand across a session; this script IS that procedure, so any
 * future session (or the repo's owner) can re-anchor the
 * instrument to a new real day:
 *
 *   node observatory-freeze.mjs --out observatory-fixture.js
 *
 * It fetches every feed the observatory reads (the api.ndev.tk
 * daemon's sounding/gmn/adsb digests, NDBC realtime2, open-meteo
 * weather/air-quality/radiation, SWPC regions + hemispheric power
 * + OVATION + Kp, NOAA CO-OPS water levels), computes the
 * engine-owned geometry (sun, solar longitude, the shower
 * radiant) with the vendored astronomy engine at the fetch
 * stamps, writes a COMPLETE fixture module in the exact shape
 * the page and reference consume, then runs every panel on the
 * fresh fixture and prints the headline numbers.
 *
 * THE RUN-THEN-PIN CONTRACT (since the 123rd pass): the
 * reference's DAY-INVARIANT landmarks (identities, printed
 * envelopes, form checks) hold on any frozen day untouched; the
 * DAY-PINNED numbers are generated DATA - this script writes
 * observatory-pins.js beside the fixture, and the reference's
 * generic runner asserts them. A refreeze is therefore: run this
 * script, READ THE DIFF of fixture and pins (that reading is
 * where run-then-pin's deliberateness lives), run the gate,
 * commit both. --pins-only regenerates just the pins from the
 * existing fixture; --out elsewhere leaves the shipped files
 * untouched (the dry-run posture used to verify this script).
 *
 * Feed posture: all feeds must answer - a refreeze is worth
 * doing on a day when the world is fully measurable; on a
 * partial day, retry (the daemon's 119th-pass time budget makes
 * its routes answer fast, stale or fresh). Failures are listed
 * by name.
 */

import {writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const A = createRequire(import.meta.url)('./astronomy.browser.min.js');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
};
const OUT = resolve(HERE, opt('out', 'observatory-fixture.js'));
const LAT = parseFloat(opt('lat', '32.72'));
const LON = parseFloat(opt('lon', '-117.16'));
const TIDE_STATION = opt('tidestation', '9410170');
// The wet-world city set: fixed, alphabetical by label.
const CITIES = [
  ['Bergen', 60.39, 5.32],
  ['London', 51.51, -0.13],
  ['Mumbai', 19.08, 72.88],
  ['Phoenix', 33.45, -112.07],
  ['San Diego', 32.72, -117.16],
  ['Singapore', 1.29, 103.85]
];

const stampIso = () => new Date().toISOString().slice(0, 16) + 'Z';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Polite retries: a refreeze is a rare deliberate operation, so
// transient upstream states wait it out - 429 (rate limit, often
// a shared egress IP's window: measured here) sleeps 30 s then
// 60 s across up to three attempts; 5xx/network get one 5 s
// retry; hard 4xx fail immediately.
const get = async (url, read) => {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, {signal: AbortSignal.timeout(60000)});
      if (!r.ok) {
        if (r.status === 429 && attempt < 2) {
          await sleep(attempt === 0 ? 30000 : 60000);
          continue;
        }
        if (r.status >= 500 && attempt === 0) {
          await sleep(5000);
          continue;
        }
        throw new Error('HTTP ' + r.status);
      }
      return read(r);
    } catch (e) {
      if (attempt === 0 && !String(e.message).startsWith('HTTP 4')) {
        await sleep(5000);
        continue;
      }
      throw e;
    }
  }
};
const jget = (url) => get(url, (r) => r.json());
const tget = (url) => get(url, (r) => r.text());
const sunAt = (iso, latDeg, lonDeg) => {
  const t = A.MakeTime(new Date(iso.replace('Z', ':00Z')));
  const obs = new A.Observer(latDeg, lonDeg, 30);
  const eq = A.Equator(A.Body.Sun, t, obs, true, true);
  const hor = A.Horizon(t, obs, eq.ra, eq.dec, 'normal');
  return {altDeg: +hor.altitude.toFixed(3), azDeg: +hor.azimuth.toFixed(2)};
};
const num = (v) => (v == null || !Number.isFinite(v) ? 'null' : String(v));

async function main() {
  const failures = [];
  const feed = async (name, fn) => {
    try {
      const v = await fn();
      console.log(`[ok]   ${name}`);
      return v;
    } catch (e) {
      failures.push(`${name}: ${e.message}`);
      console.log(`[FAIL] ${name}: ${e.message}`);
      return null;
    }
  };

  const at = stampIso();
  const snd = await feed('sounding (api.ndev.tk)', () =>
    jget(`https://api.ndev.tk/sounding?lat=${LAT}&lon=${LON}`)
  );
  const buoyTxt = await feed('buoy met (NDBC realtime2)', async () => {
    // The nearest spectral buoy is the daemon's job at draw time;
    // the frozen sea state reads one named met file - 46047 for
    // the default point, override with --buoy.
    const id = opt('buoy', '46047');
    const txt = await tget(
      `https://www.ndbc.noaa.gov/data/realtime2/${id}.txt`
    );
    const lines = txt.split('\n');
    const hdr = lines[0].split(/\s+/).map((h) => h.replace('#', ''));
    for (let i = 2; i < lines.length; i++) {
      const p = lines[i].split(/\s+/);
      if (p.length < hdr.length) continue;
      const row = Object.fromEntries(hdr.map((h, j) => [h, p[j]]));
      if (row.WSPD !== 'MM')
        return {
          id,
          at: `${row.YY}-${row.MM}-${row.DD}T${row.hh}:${row.mm}Z`,
          wspdMs: parseFloat(row.WSPD),
          gustMs: parseFloat(row.GST),
          wvhtM: parseFloat(row.WVHT),
          dpdS: parseFloat(row.DPD),
          wtmpC: parseFloat(row.WTMP)
        };
    }
    throw new Error('no non-MM row');
  });
  const aq = await feed('aerosol (open-meteo air quality)', () =>
    jget(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=aerosol_optical_depth,dust,pm2_5`
    )
  );
  const regions = await feed('solar regions (SWPC)', async () => {
    const reg = await jget(
      'https://services.swpc.noaa.gov/json/solar_regions.json'
    );
    const dates = {};
    let area = {};
    for (const r of reg)
      if (r.observed_date) {
        dates[r.observed_date] = (dates[r.observed_date] ?? 0) + 1;
        area[r.observed_date] = (area[r.observed_date] ?? 0) + (r.area || 0);
      }
    const latest = Object.keys(dates).sort().pop();
    return {at: latest, count: dates[latest], areaMillionths: area[latest]};
  });
  const cities = await feed('cities (open-meteo soil/rain)', async () => {
    // Sequential with spacing - a burst of parallel requests
    // rate-limits (429) on the free tier, measured.
    const out = [];
    for (const [name, la, lo] of CITIES) {
      const j = await jget(
        `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=precipitation,temperature_2m,weather_code&hourly=soil_moisture_0_to_1cm&forecast_hours=1`
      );
      out.push({
        name,
        latDeg: j.latitude,
        lonDeg: j.longitude,
        soilM3M3: j.hourly.soil_moisture_0_to_1cm[0],
        precipMm: j.current.precipitation,
        tC: j.current.temperature_2m,
        at: j.current.time + 'Z'
      });
      await sleep(1200);
    }
    return out;
  });
  const gmn = await feed('meteors (api.ndev.tk/gmn)', async () => {
    const g = await jget('https://api.ndev.tk/gmn');
    const top = Object.entries(g.medians)
      .filter(([k]) => k !== 'all')
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 10);
    return {
      at: g.at,
      meteors: g.meteors,
      medians: {all: g.medians.all, ...Object.fromEntries(top)}
    };
  });
  const hemi = await feed('hemispheric power (SWPC)', () =>
    tget('https://services.swpc.noaa.gov/text/aurora-nowcast-hemi-power.txt')
  );
  const ovation = await feed('OVATION oval (SWPC)', async () => {
    const ov = await jget(
      'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json'
    );
    const our = ((LON % 360) + 360) % 360;
    const cells = ov.coordinates.filter(([lo]) => {
      let dl = Math.abs(lo - our);
      if (dl > 180) dl = 360 - dl;
      return dl <= 3;
    });
    return {obsAt: ov['Observation Time'], lonDegE: +our.toFixed(2), cells};
  });
  const kp = await feed('Kp (SWPC)', async () => {
    const k = await jget(
      'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json'
    );
    const last = k[k.length - 1];
    return {at: last.time_tag + 'Z', est: last.estimated_kp};
  });
  const rad = await feed('radiation (open-meteo)', async () => {
    const w = await jget(
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=shortwave_radiation,direct_radiation,diffuse_radiation`
    );
    const radAt = w.current.time + 'Z';
    return {
      at: radAt,
      ghiWm2: w.current.shortwave_radiation,
      dirWm2: w.current.direct_radiation,
      difWm2: w.current.diffuse_radiation,
      sunAltDeg: sunAt(radAt, LAT, LON).altDeg
    };
  });
  const adsb = await feed('aircraft (api.ndev.tk/adsb)', async () => {
    const j = await jget(
      `https://api.ndev.tk/adsb?lat=${LAT}&lon=${LON}&dist=60`
    );
    return {
      at,
      distNm: 60,
      ac: j.ac
        .filter((a) => Number.isFinite(a.alt_baro))
        .map((a) => ({
          hex: a.hex,
          flight: a.flight,
          alt_baro: a.alt_baro,
          t: a.t
        }))
    };
  });
  const tide = await feed('tide gauge (NOAA CO-OPS)', async () => {
    const t = await jget(
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_level&application=horizon&range=720&datum=MSL&units=metric&time_zone=gmt&format=json&station=${TIDE_STATION}`
    );
    const hourly = t.data.filter((_, i) => i % 10 === 0);
    const values = hourly.map((q) => parseFloat(q.v)).filter(Number.isFinite);
    if (values.length < 700) throw new Error('short record');
    return {
      stationId: TIDE_STATION,
      name: TIDE_STATION === '9410170' ? 'San Diego Bay' : TIDE_STATION,
      t0: hourly[0].t.replace(' ', 'T') + 'Z',
      stepHours: 1,
      values
    };
  });
  const tles = await feed('TLEs (api.ndev.tk/tles)', async () => {
    const txt = (await tget('https://api.ndev.tk/tles')).trim();
    if (!txt.startsWith('1 ') && !txt.includes('\n1 '))
      throw new Error('not TLE text');
    if (txt.includes('`') || txt.includes('${'))
      throw new Error('unsafe characters for the template literal');
    return {at, text: txt};
  });
  const harcon = await feed('published harcon (NOAA CO-OPS)', async () => {
    const h = await jget(
      `https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/${TIDE_STATION}/harcon.json?units=metric`
    );
    const want = ['M2', 'S2', 'N2', 'K1', 'O1', 'M4', 'P1', 'NU2', 'K2'];
    const rows = {};
    for (const r of h.HarmonicConstituents)
      if (want.includes(r.name))
        rows[r.name] = {ampM: r.amplitude, phaseDeg: r.phase_GMT};
    if (Object.keys(rows).length < 9) throw new Error('constituents missing');
    return {at, stationId: TIDE_STATION, units: 'metric', rows};
  });

  if (failures.length) {
    console.error(
      `\nREFREEZE ABORTED - ${failures.length} feed(s) failed:\n  ` +
        failures.join('\n  ')
    );
    process.exit(1);
  }

  // The engine-owned geometry, at the stamps just fetched.
  const sun = {at, latDeg: LAT, lonDeg: LON, ...sunAt(at, LAT, LON)};
  const elon = A.SunPosition(
    A.MakeTime(new Date(at.replace('Z', ':00Z')))
  ).elon;
  // The shower spotlight: the next local-2am radiant altitude
  // (meteors.js radiantAt drift at the engine's solar longitude).
  const {radiantAt, SHOWERS} = await import('./meteors.js');
  const now = new Date(at.replace('Z', ':00Z'));
  let utc2 = new Date(now);
  utc2.setUTCHours((((2 - LON / 15) % 24) + 24) % 24, 0, 0, 0);
  if (utc2 <= now) utc2 = new Date(+utc2 + 86400e3);
  const per = SHOWERS.find((s) => s.code === 'PER');
  const lam2 = A.SunPosition(A.MakeTime(utc2)).elon;
  const radp = radiantAt(per, lam2);
  const obs2 = new A.Observer(LAT, LON, 30);
  const horR = A.Horizon(
    A.MakeTime(utc2),
    obs2,
    radp.ra / 15,
    radp.dec,
    'normal'
  );

  const sndRows = snd.rows
    .map(
      (r) =>
        `    [${r.p}, ${r.hM}, ${r.tC}, ${r.rh ?? 0}, ${num(r.drct)}, ${num(r.spdMs)}]`
    )
    .join(',\n');
  const fixture = `/**
 * observatory-fixture.js - one real snapshot, frozen so the gate
 * can pin the instrument. GENERATED by observatory-freeze.mjs at
 * ${at} (feeds stamped individually below) - regenerate with:
 *   node observatory-freeze.mjs --out observatory-fixture.js
 * then RE-PIN observatory-reference.mjs from the printed numbers
 * (run-then-pin: the old day's bands are expected to fail on a
 * new day - re-pin deliberately, landmark by landmark).
 */

export const FIXTURE_AT = '${at}';

export const SOUNDING = {
  wmo: '${snd.wmo}',
  name: ${JSON.stringify(snd.name)},
  at: '${snd.at}',
  latDeg: ${snd.lat},
  lonDeg: ${snd.lon},
  // [p hPa, hM, tC, rh %, wind-from deg, wind m/s]
  rows: [
${sndRows}
  ].map(([p, hM, tC, rh, drct, spdMs]) => ({p, hM, tC, rh, drct, spdMs}))
};

export const BUOY = {
  id: '${buoyTxt.id}',
  name: 'NDBC ${buoyTxt.id}',
  at: '${buoyTxt.at}',
  anemometerM: 4.1,
  wspdMs: ${buoyTxt.wspdMs},
  gustMs: ${buoyTxt.gustMs},
  wvhtM: ${buoyTxt.wvhtM},
  dpdS: ${buoyTxt.dpdS},
  wtmpC: ${buoyTxt.wtmpC}
};

export const AEROSOL = {
  at: '${aq.current.time}Z',
  latDeg: ${LAT},
  lonDeg: ${LON},
  aod550: ${aq.current.aerosol_optical_depth},
  dustUgM3: ${aq.current.dust},
  pm25UgM3: ${aq.current.pm2_5}
};

export const SOLAR_REGIONS = ${JSON.stringify(regions)};

export const CITIES = [
${cities.map((c) => '  ' + JSON.stringify(c)).join(',\n')}
];

export const SUN = ${JSON.stringify(sun)};

export const GMN = ${JSON.stringify(gmn)};

export const HEMI_POWER_TXT = \`${hemi.trim()}\`;

export const OVATION = {
  obsAt: '${ovation.obsAt}',
  lonDegE: ${ovation.lonDegE},
  cells: ${JSON.stringify(ovation.cells)}
};

export const KP = ${JSON.stringify(kp)};

export const RADIATION = ${JSON.stringify(rad)};

export const SUN_ELON = {at: '${at}', elonDeg: ${+elon.toFixed(4)}};

export const PERSEID_NIGHT = {
  at: '${utc2.toISOString().slice(0, 16)}Z',
  radiantAltDeg: ${+horR.altitude.toFixed(2)}
};

export const ADSB = ${JSON.stringify(adsb)};

export const TIDE = {
  stationId: '${tide.stationId}',
  name: '${tide.name}',
  t0: '${tide.t0}',
  stepHours: 1,
  values: [${tide.values.map((v) => v.toFixed(3)).join(', ')}]
};

export const TIDE_PUBLISHED = ${JSON.stringify(harcon)};

export const TLES = {
  at: '${tles.at}',
  text: \`${tles.text}\`
};
`;
  writeFileSync(OUT, fixture);
  console.log(`\nwrote ${OUT} (${fixture.length} bytes)`);
  await emitPins(OUT);
}

/**
 * Run every panel on a fixture and write observatory-pins.js -
 * the DAY-PINNED numbers as data, [value, tolerance] pairs the
 * reference's generic runner asserts. Tolerances are stated per
 * quantity at its physical noise scale (regression-tight, not
 * loose). The reference refuses pins whose generatedFor stamp
 * differs from the fixture's - fixture and pins move together.
 */
async function emitPins(fixturePath) {
  const O = await import('./observatory.js');
  const F = await import('file://' + fixturePath + '?t=' + Date.now());
  const col = O.columnPanel(F.SOUNDING.rows);
  const [beach, aloft] = col.observers;
  const sea = O.seaPanel({u10Ms: F.BUOY.wspdMs, wvhtM: F.BUOY.wvhtM});
  const wet = O.wetPanel(F.CITIES);
  const pol = O.polPanel({
    sunAltDeg: Math.max(F.SUN.altDeg, 1),
    aod550: F.AEROSOL.aod550
  });
  const cor = O.coronaPanel({regionCount: F.SOLAR_REGIONS.count});
  const met = O.meteorsPanel({
    lamSunDeg: F.SUN_ELON.elonDeg,
    gmnMedians: F.GMN.medians,
    radiantAltRad: (F.PERSEID_NIGHT.radiantAltDeg * Math.PI) / 180
  });
  const aur = O.auroraPanel({
    hemiText: F.HEMI_POWER_TXT,
    ovationCoords: F.OVATION.cells,
    lonDeg: F.OVATION.lonDegE,
    kpEst: F.KP.est
  });
  const con = O.contrailPanel(F.SOUNDING.rows, {ac: F.ADSB.ac});
  const lee = O.leewavePanel(F.SOUNDING.rows);
  const tid = O.tidePanel(F.TIDE, {published: F.TIDE_PUBLISHED?.rows});
  const clo = O.closurePanel({
    sunAltDeg: F.RADIATION.sunAltDeg,
    aod550: F.AEROSOL.aod550,
    ghiWm2: F.RADIATION.ghiWm2,
    dirWm2: F.RADIATION.dirWm2,
    difWm2: F.RADIATION.difWm2
  });
  // Tonight's passes: the night starting at the first 02:00Z at
  // or after the fixture stamp - the same deterministic window
  // convention the reference uses.
  const satlib = createRequire(import.meta.url)('./satellite.min.js');
  const M = await import('./satmags.js');
  const satObs = new A.Observer(F.SUN.latDeg, F.SUN.lonDeg, 30);
  const satEq = (ms) => {
    const t = A.MakeTime(new Date(ms));
    return {t, eq: A.Equator(A.Body.Sun, t, satObs, true, true)};
  };
  const night0 = new Date(F.FIXTURE_AT.replace('Z', ':00Z'));
  const nightStart = new Date(night0);
  nightStart.setUTCHours(2, 0, 0, 0);
  if (nightStart < night0) nightStart.setUTCDate(nightStart.getUTCDate() + 1);
  const sat = O.satsPanel({
    tleText: F.TLES.text,
    latDeg: F.SUN.latDeg,
    lonDeg: F.SUN.lonDeg,
    startMs: +nightStart,
    hours: 12,
    satlib,
    sunRaDecAtMs: (ms) => {
      const {eq} = satEq(ms);
      return {raH: eq.ra, decDeg: eq.dec};
    },
    sunAltAtMs: (ms) => {
      const {t, eq} = satEq(ms);
      return A.Horizon(t, satObs, eq.ra, eq.dec, 'normal').altitude;
    },
    mags: M.snapshotMap()
  });
  // Tonight's green flash: the sunset after the fixture stamp,
  // its true-altitude rate from airless engine altitudes +-60 s,
  // then the frozen ascent through flashPanel at the research
  // view's two eyes (the beach clamp and the 450 m ridge).
  const sunsetT = A.SearchRiseSet(
    A.Body.Sun,
    satObs,
    -1,
    A.MakeTime(new Date(F.FIXTURE_AT.replace('Z', ':00Z'))),
    2
  );
  const airless = (t) => {
    const eq = A.Equator(A.Body.Sun, t, satObs, true, true);
    return A.Horizon(t, satObs, eq.ra, eq.dec, null).altitude;
  };
  const rateDegPerS =
    (airless(sunsetT.AddDays(-60 / 86400)) -
      airless(sunsetT.AddDays(60 / 86400))) /
    120;
  const flB = O.flashPanel(F.SOUNDING.rows, {eyeM: 15, rateDegPerS});
  const flA = O.flashPanel(F.SOUNDING.rows, {eyeM: 450, rateDegPerS});
  const perTop = met.shares?.filter((s) => s.code !== 'spo')[0];
  const best = sat.passes[0];
  const pins = {
    generatedFor: F.FIXTURE_AT,
    column: {
      invDT: [col.inversion.dT, 0.05],
      invHM: col.inversion.hM,
      foldsBeach: beach.folds,
      foldsAloft: aloft.folds,
      r0Arcmin: [beach.r0Arcmin, 0.3],
      r0IsaArcmin: [beach.r0IsaArcmin, 0.3],
      flatten: [beach.flatten, 0.05],
      rimArcsec: [beach.rimArcsec, 8]
    },
    wet: {
      order: [...wet.rows].sort((a, b) => a.w - b.w).map((r) => r.name),
      raining: wet.rows.filter((r) => r.raining).map((r) => r.name),
      w: Object.fromEntries(wet.rows.map((r) => [r.name, [r.w, 0.03]]))
    },
    pol: {maxPure: [pol.maxPure, 0.02]},
    meteors: {
      zhrNow: [met.zhrNow, 0.5],
      daysToPeak: [met.daysToPeak, 0.1],
      topCode: perTop?.code ?? null,
      topShare: perTop ? [perTop.share, 0.03] : null
    },
    aurora: {
      rows: aur.history.length,
      latestGwN: aur.latest.gwN,
      latestAt: aur.latest.at,
      ovP: [aur.ov.p, 0.02],
      ovLatDeg: aur.ov.latDeg,
      kpEst: [aur.kpEst, 0.01]
    },
    contrail: {
      l250TC: [con.l250.tC, 0.5],
      l250Tlc: [con.l250.a.tlc, 0.2],
      l250Rhi: [con.l250.a.rhi, 0.01],
      formLoM: con.formBand ? con.formBand.loM : null,
      formHiM: con.formBand ? con.formBand.hiM : null,
      issr: con.issrLevels.map((q) => [q.hM, [q.rhi, 0.01]]),
      persistNull: con.persistBand === null,
      acN: con.aircraft.n,
      acMaxAltM: [con.aircraft.maxAltM, 0.5],
      acInForm: con.aircraft.inForm,
      acInPersist: con.aircraft.inPersist
    },
    leewave: {
      levels: lee.levels.length,
      layerMMs: [lee.layer.mMs, 0.05],
      layerScalarMs: [lee.layer.scalarMs, 0.05],
      spotHM: lee.spot.hM,
      spotLamM: [lee.spot.lamM, 5]
    },
    tide: {
      amps: Object.fromEntries(tid.amps.map((a) => [a.n, [a.ampM, 0.01]])),
      rmsOutM: [tid.rmsOutM, 0.01],
      latestResidM: [tid.latestResidM, 0.02],
      maxAbsOutM: [tid.maxAbsOut.v, 0.02],
      rM2: tid.amps[0].ratio ? [tid.amps[0].ratio, 0.01] : null,
      rO1: (() => {
        const o = tid.amps.find((a) => a.n === 'O1');
        return o?.ratio ? [o.ratio, 0.02] : null;
      })()
    },
    sats: {
      passes: sat.passes.length,
      nakedEye: sat.nakedEye,
      darkHours: [sat.darkHours, 0.15],
      bestNorad: best?.norad ?? null,
      bestMag: best ? [best.minMag, 0.1] : null,
      bestElDeg: best ? [best.peakElDeg, 1] : null,
      rbTop8: sat.passes.slice(0, 8).filter((p) => p.name.includes('R/B'))
        .length,
      issTonight: sat.passes.some((p) => p.norad === 25544)
    },
    flash: {
      rateArcsecS: [rateDegPerS * 3600, 0.05],
      beachType: flB.type,
      beachS: flB.durationS === null ? null : [flB.durationS, 0.15],
      aloftType: flA.type,
      aloftS: flA.durationS === null ? null : [flA.durationS, 0.2],
      aloftWidth: flA.widthArcsec === null ? null : [flA.widthArcsec, 12],
      aloftMagX: flA.magX === null ? null : [flA.magX, 0.6],
      aloftAppArcmin: flA.appArcmin === null ? null : [flA.appArcmin, 1],
      ducts: flA.ducts.length
    },
    closure: clo.ratios
      ? {
          globalRatio: [clo.ratios.globalRatio, 0.01],
          beamRatio: [clo.ratios.beamRatio, 0.02],
          diffuseRatio: [clo.ratios.diffuseRatio, 0.02]
        }
      : null
  };
  const pinsPath = resolve(HERE, opt('pins', 'observatory-pins.js'));
  writeFileSync(
    pinsPath,
    `/**
 * observatory-pins.js - the frozen day's DAY-PINNED numbers as
 * data, GENERATED by observatory-freeze.mjs (--pins-only reruns
 * just this file from the existing fixture). Scalars are exact;
 * [value, tolerance] pairs are asserted within their stated
 * physical noise scale by the reference's generic runner. The
 * generatedFor stamp must equal the fixture's FIXTURE_AT - the
 * reference refuses stale pins. Regenerate, READ THE DIFF, then
 * commit fixture and pins together: the review is where
 * run-then-pin's deliberateness now lives.
 */

export const DAY_PINS = ${JSON.stringify(pins, null, 2)};
`
  );
  console.log(`wrote ${pinsPath}`);

  const f3 = (v) => (v == null ? 'null' : (+v).toFixed(3));
  console.log(`
THE DAY (${F.FIXTURE_AT}, ${F.SOUNDING.wmo} ${F.SOUNDING.at})
 column   inversion +${f3(col.inversion.dT)} C at ${col.inversion.hM} m; folds ${beach.folds}/${aloft.folds}; R0 ${f3(beach.r0Arcmin)}' vs ISA ${f3(beach.r0IsaArcmin)}'; flatten ${f3(beach.flatten)}; rim ${f3(beach.rimArcsec)}"
 sea      W(${F.BUOY.wspdMs}) = ${f3(sea.W * 100)} %
 wet      ${wet.rows.map((r) => `${r.name} ${f3(r.w)}`).join('; ')}
 pol      maxPure ${f3(pol.maxPure)}; w ${f3(pol.w)}; maxToday ${f3(pol.maxToday)}; scat ${f3(pol.maxAt.scatDeg)}
 corona   phase ${f3(cor.phase)}; moons ${f3(cor.moons)}
 meteors  ZHR ${f3(met.zhrNow)}; daysToPeak ${f3(met.daysToPeak)}; top ${met.shares?.filter((s) => s.code !== 'spo')[0]?.code} share ${f3(met.shares?.filter((s) => s.code !== 'spo')[0]?.share)}
 aurora   rows ${aur.history.length}; latest ${aur.latest?.gwN} GW at ${aur.latest?.at}; ov p ${f3(aur.ov?.p)} lat ${aur.ov?.latDeg}; Kp ${aur.kpEst}
 contrail form ${con.formBand ? con.formBand.loM + '-' + con.formBand.hiM : 'none'}; issr ${con.issrLevels.map((q) => q.hM + '@' + f3(q.rhi)).join(',') || 'none'}; persist ${con.persistBand ? con.persistBand.loM + '-' + con.persistBand.hiM : 'null'}; ac ${con.aircraft?.n} max ${f3(con.aircraft?.maxAltM)}
 leewave  levels ${lee.levels.length}; layer mMs ${f3(lee.layer?.mMs)} scalar ${f3(lee.layer?.scalarMs)}; spot ${lee.spot?.hM} m lam ${f3(lee.spot?.lamM)}
 tide     ${tid.amps.map((a) => `${a.n} ${f3(a.ampM)}`).join('; ')}; rmsOut ${f3(tid.rmsOutM)}; latest resid ${f3(tid.latestResidM)}; vs published M2 x${f3(tid.amps[0].ratio)} O1 x${f3(tid.amps.find((a) => a.n === 'O1')?.ratio)}
 sats     ${sat.passes.length} passes / ${sat.nakedEye} naked-eye over ${f3(sat.darkHours)} dark h; best ${best?.name?.trim()} mag ${f3(best?.minMag)} at ${f3(best?.peakElDeg)} deg
 closure  global ${f3(clo.ratios?.globalRatio)}; beam ${f3(clo.ratios?.beamRatio)}; diffuse ${f3(clo.ratios?.diffuseRatio)}

Fixture and pins are regenerated TOGETHER. Read the git diff of
observatory-pins.js - the day's story in numbers - then run the
gate and commit both. The reference's invariant landmarks hold on
any day by form; the day pins hold because you just reviewed them.`);
}

if (args.includes('--pins-only')) {
  emitPins(resolve(HERE, opt('fixture', 'observatory-fixture.js'))).then(() =>
    console.log('pins regenerated from the existing fixture')
  );
} else {
  main();
}
