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
 * THE RUN-THEN-PIN CONTRACT: after a real refreeze the
 * reference's pinned bands describe the OLD day and will fail -
 * that is the method working, not breaking. The printed numbers
 * are the new pin candidates; re-pin observatory-reference.mjs
 * deliberately, landmark by landmark, before committing the new
 * day. (--out elsewhere leaves the shipped fixture untouched -
 * the dry-run posture used to verify this script itself.)
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
`;
  writeFileSync(OUT, fixture);
  console.log(`\nwrote ${OUT} (${fixture.length} bytes)`);

  // ---- run every panel on the fresh day: the pin candidates ----
  const O = await import('./observatory.js');
  const F = await import('file://' + OUT + '?t=' + Date.now());
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
  const tid = O.tidePanel(F.TIDE);
  const clo = O.closurePanel({
    sunAltDeg: F.RADIATION.sunAltDeg,
    aod550: F.AEROSOL.aod550,
    ghiWm2: F.RADIATION.ghiWm2,
    dirWm2: F.RADIATION.dirWm2,
    difWm2: F.RADIATION.difWm2
  });
  const f3 = (v) => (v == null ? 'null' : (+v).toFixed(3));
  console.log(`
PIN CANDIDATES (${at}, ${F.SOUNDING.wmo} ${F.SOUNDING.at})
 column   inversion +${f3(col.inversion.dT)} C at ${col.inversion.hM} m; folds ${beach.folds}/${aloft.folds}; R0 ${f3(beach.r0Arcmin)}' vs ISA ${f3(beach.r0IsaArcmin)}'; flatten ${f3(beach.flatten)}; rim ${f3(beach.rimArcsec)}"
 sea      W(${F.BUOY.wspdMs}) = ${f3(sea.W * 100)} %
 wet      ${wet.rows.map((r) => `${r.name} ${f3(r.w)}`).join('; ')}
 pol      maxPure ${f3(pol.maxPure)}; w ${f3(pol.w)}; maxToday ${f3(pol.maxToday)}; scat ${f3(pol.maxAt.scatDeg)}
 corona   phase ${f3(cor.phase)}; moons ${f3(cor.moons)}
 meteors  ZHR ${f3(met.zhrNow)}; daysToPeak ${f3(met.daysToPeak)}; top ${met.shares?.filter((s) => s.code !== 'spo')[0]?.code} share ${f3(met.shares?.filter((s) => s.code !== 'spo')[0]?.share)}
 aurora   rows ${aur.history.length}; latest ${aur.latest?.gwN} GW at ${aur.latest?.at}; ov p ${f3(aur.ov?.p)} lat ${aur.ov?.latDeg}; Kp ${aur.kpEst}
 contrail form ${con.formBand ? con.formBand.loM + '-' + con.formBand.hiM : 'none'}; issr ${con.issrLevels.map((q) => q.hM + '@' + f3(q.rhi)).join(',') || 'none'}; persist ${con.persistBand ? con.persistBand.loM + '-' + con.persistBand.hiM : 'null'}; ac ${con.aircraft?.n} max ${f3(con.aircraft?.maxAltM)}
 leewave  levels ${lee.levels.length}; layer mMs ${f3(lee.layer?.mMs)} scalar ${f3(lee.layer?.scalarMs)}; spot ${lee.spot?.hM} m lam ${f3(lee.spot?.lamM)}
 tide     ${tid.amps.map((a) => `${a.n} ${f3(a.ampM)}`).join('; ')}; rmsOut ${f3(tid.rmsOutM)}; latest resid ${f3(tid.latestResidM)}
 closure  global ${f3(clo.ratios?.globalRatio)}; beam ${f3(clo.ratios?.beamRatio)}; diffuse ${f3(clo.ratios?.diffuseRatio)}

Now RE-PIN observatory-reference.mjs from these numbers before
committing the new fixture (the old day's bands are expected to
fail - that is run-then-pin working).`);
}

main();
