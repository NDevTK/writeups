// Reference gate for glm.js (node glm-reference.mjs): the ATBD's
// numbers, the file's unsigned counts, the display strength at the
// day's quantiles, the flashes placed by real bearing and distance,
// the network's strikes standing where they saw the same flash, and
// a real 20-s file read through the gated HDF5 reader against h5py's
// independent read of the same bytes.
import {inflateSync} from 'node:zlib';
import {
  GLM_ATBD,
  GLM_ENERGY_J,
  flashStrength,
  flashesNotInNetwork,
  glmFlashesNear,
  glmSummary,
  parseGlmFlashes,
  u16
} from './glm.js';
import {GLM_B64, GLM_EXPECT, GLM_NAME} from './glm-fixture.js';
import {openHdf5} from './hdf5.js';
import {rangeBearing} from './wildfire.js';

let fail = false;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail = true;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const inflateNode = (u8) =>
  new Uint8Array(
    inflateSync(Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength))
  );

{
  // a synthetic LCFA handle: the file's own scalings (energy int16 at
  // 1e-15 J from 2.85e-16, area at 152,601.86 m^2, time offsets at
  // 0.000381 s from -5 s), counts past 32767 stored negative
  const at = (values, attrs = {}) => ({values, attrs});
  const es = 9.999959802209943e-16;
  const eo = 2.8514998886357517e-16;
  const as = 152601.859375;
  const ts = 0.00038147560553625226;
  const f = {
    dataset: (n) =>
      ({
        flash_lat: at(Float32Array.from([29.5, 13.2, 40.0])),
        flash_lon: at(Float32Array.from([-95.0, -95.2, -70.0])),
        flash_energy: at(Int16Array.from([14, 4000, -6]), {
          scale_factor: es,
          add_offset: eo,
          valid_range: [0, -6]
        }),
        flash_area: at(Int16Array.from([428, 28000, 1000]), {
          scale_factor: as,
          add_offset: 0
        }),
        flash_quality_flag: at(Int16Array.from([0, 3, 0])),
        flash_time_offset_of_first_event: at(
          Int16Array.from([11710, 13000, 13100]),
          {scale_factor: ts, add_offset: -5}
        ),
        flash_time_offset_of_last_event: at(
          Int16Array.from([11971, 14000, 13100]),
          {scale_factor: ts, add_offset: -5}
        ),
        flash_id: at(Int16Array.from([24964, -1, 7])),
        flash_count: at(Int32Array.from([856]))
      })[n] ?? null,
    rootAttrs: () => ({
      time_coverage_start: '2026-09-06T19:31:20.0Z',
      time_coverage_end: '2026-09-06T19:31:40.0Z',
      platform_ID: 'G19'
    })
  };
  const p = parseGlmFlashes(f);
  const a = p.flashes[0];
  const b = p.flashes[1];
  const c = p.flashes[2];
  check(
    "THE FILE'S FLASHES: unsigned counts, the scalings, the times from the file's start",
    u16(-6) === 65530 &&
      u16(14) === 14 &&
      p.n === 3 &&
      p.platform === 'G19' &&
      p.diskFlashes === 856 &&
      near(a.energyJ, 14 * es + eo, 1e-30) &&
      near(c.energyJ, 65530 * es + eo, 1e-28) &&
      near(a.areaKm2, (428 * as) / 1e6, 1e-9) &&
      a.quality === 0 &&
      a.words === 'good' &&
      b.words === 'degraded' &&
      a.id === 24964 &&
      b.id === 65535 &&
      near(
        a.tFirstMs,
        Date.parse('2026-09-06T19:31:20.0Z') + (11710 * ts - 5) * 1000,
        1e-6
      ) &&
      near(a.durationMs, (11971 - 11710) * ts * 1000, 1e-6) &&
      c.durationMs === 0 &&
      parseGlmFlashes({dataset: () => null, rootAttrs: () => ({})}) === null,
    `an int16 -6 is the count 65530; three flashes on ${p.platform} with the disk's ${p.diskFlashes}: the first ${a.energyJ.toExponential(3)} J ` +
      `(count 14 at 1e-15 J from 2.85e-16), ${a.areaKm2.toFixed(1)} km^2, ${a.words}, id ${a.id}, first light ${((a.tFirstMs - p.startMs) / 1000).toFixed(3)} s into the file, ` +
      `${a.durationMs.toFixed(1)} ms long; the third's count -6 is the ceiling ${c.energyJ.toExponential(3)} J; a handle without the datasets is null`
  );
}

{
  const s = (e) => flashStrength(e);
  check(
    "THE FLASH'S STRENGTH follows the logarithm of its energy on the day's own scale",
    s(0) === 0.3 &&
      near(s(1e-14), 0.4, 1e-12) &&
      s(GLM_ENERGY_J.floor) === 0.3 &&
      s(GLM_ENERGY_J.median) > 0.4 &&
      s(GLM_ENERGY_J.median) < 0.6 &&
      s(GLM_ENERGY_J.p90) > s(GLM_ENERGY_J.median) &&
      s(GLM_ENERGY_J.p99) > s(GLM_ENERGY_J.p90) &&
      near(
        s(GLM_ENERGY_J.max),
        0.4 + (0.6 * Math.log10(4.4e-12 / 1e-14)) / 2.5,
        1e-12
      ) &&
      s(1e-9) === 1.6 &&
      GLM_ATBD.wavelengthNm === 777.4 &&
      GLM_ATBD.frameMs === 2 &&
      GLM_ATBD.flash.timeMs === 330 &&
      GLM_ATBD.flash.distanceKm === 16.5 &&
      GLM_ATBD.requirement.detectionEfficiencyMin === 0.7 &&
      GLM_ATBD.requirement.locationKm === 5 &&
      GLM_ATBD.requirement.latencyS === 20 &&
      GLM_ATBD.pixelKm[0] === 8 &&
      GLM_ATBD.pixelKm[1] === 14,
    `0.3 at the day's floor ${GLM_ENERGY_J.floor} J, ${s(GLM_ENERGY_J.median).toFixed(2)} at the median ${GLM_ENERGY_J.median}, ${s(GLM_ENERGY_J.p90).toFixed(2)} at p90, ` +
      `${s(GLM_ENERGY_J.p99).toFixed(2)} at p99, ${s(GLM_ENERGY_J.max).toFixed(2)} at the day's brightest ${GLM_ENERGY_J.max}, capped 1.6; the ATBD: ${GLM_ATBD.wavelengthNm} nm, ` +
      `${GLM_ATBD.frameMs}-ms frames, a flash within ${GLM_ATBD.flash.timeMs} ms and ${GLM_ATBD.flash.distanceKm} km, ${GLM_ATBD.pixelKm.join('-')} km pixels, ` +
      `detection ${GLM_ATBD.requirement.detectionEfficiencyMin * 100}% or better, ${GLM_ATBD.requirement.locationKm} km, ${GLM_ATBD.requirement.latencyS} s`
  );
}

{
  // flashes around Houston: one 30 km north-east (bright), one 12 km
  // west (faint, earlier), one 250 km south (out of reach); a network
  // strike 5 km from the western flash within 10 s claims it
  const home = [29.76, -95.37];
  const at = (km, brg) => ({
    lat: home[0] + (km * Math.cos((brg * Math.PI) / 180)) / 111.2,
    lon:
      home[1] +
      (km * Math.sin((brg * Math.PI) / 180)) /
        (111.2 * Math.cos((home[0] * Math.PI) / 180))
  });
  const t = Date.parse('2026-09-06T19:31:25Z');
  const flashes = [
    {id: 1, ...at(30, 45), energyJ: 1e-12, tFirstMs: t + 3000, quality: 0},
    {id: 2, ...at(12, 270), energyJ: 2e-14, tFirstMs: t, quality: 0},
    {id: 3, ...at(250, 180), energyJ: 1e-13, tFirstMs: t + 1000, quality: 0}
  ];
  const nearBy = glmFlashesNear(flashes, home[0], home[1], {maxKm: 200});
  const strikes = [{...at(12, 265), tMs: t + 8000}];
  const alone = flashesNotInNetwork(nearBy, strikes, {km: 20, ms: 30000});
  const late = flashesNotInNetwork(nearBy, [{...at(12, 265), tMs: t + 60000}], {
    km: 20,
    ms: 30000
  });
  const sm = glmSummary(nearBy);
  const rbW = rangeBearing(home[0], home[1], flashes[1].lat, flashes[1].lon);
  check(
    'THE FLASHES stand where the satellite put them, the network keeping the ones it saw',
    nearBy.length === 2 &&
      nearBy[0].id === 2 &&
      near(nearBy[0].distKm, 12, 0.05) &&
      near(nearBy[0].bearingDeg, 270, 0.2) &&
      near(nearBy[0].distKm, rbW.distKm, 1e-9) &&
      nearBy[1].id === 1 &&
      near(nearBy[1].distKm, 30, 0.05) &&
      near(nearBy[1].strength, flashStrength(1e-12), 1e-12) &&
      alone.length === 1 &&
      alone[0].id === 1 &&
      late.length === 2 &&
      sm.n === 2 &&
      near(sm.nearestKm, 12, 0.05) &&
      sm.brightestEnergyJ === 1e-12 &&
      near(sm.brightestKm, 30, 0.05) &&
      glmSummary([]) === null &&
      glmFlashesNear(null, 0, 0).length === 0,
    `${nearBy.length} of 3 flashes within 200 km, the earlier faint one 12 km west first (${nearBy[0].distKm.toFixed(1)} km at ${nearBy[0].bearingDeg.toFixed(0)}°), ` +
      `the bright one 30 km north-east next (strength ${nearBy[1].strength.toFixed(2)}), the 250-km one out of reach; a network strike 5 km from the western flash 8 s later ` +
      `claims it (${alone.length} left to the satellite: id ${alone[0].id}), a strike a minute later does not (${late.length} left); the summary names ${sm.n}, the nearest ${sm.nearestKm.toFixed(0)} km, the brightest ${sm.brightestEnergyJ} J at ${sm.brightestKm.toFixed(0)} km`
  );
}

{
  // THE FILE, READ: GOES-19's real 20-s file of 19:51:00-19:51:20Z on
  // 2026-09-06 (vendored) through hdf5.js and parseGlmFlashes, held
  // to h5py's independent read of the same bytes - every count, the
  // scalings, the first flash's every field, the quality census, the
  // energy population, and the flashes within 200 km of Tampa with
  // the nearest and the brightest by the daemon's own haversine.
  const X = GLM_EXPECT;
  const bytes = new Uint8Array(Buffer.from(GLM_B64, 'base64'));
  const p = parseGlmFlashes(openHdf5(bytes, inflateNode));
  const startMs = Date.parse(X.start);
  const f0 = p.flashes[0];
  const energies = p.flashes.map((f) => f.energyJ).sort((a, b) => a - b);
  // the median as numpy takes it (the mean of the two middle values
  // of an even count)
  const median =
    energies.length % 2
      ? energies[(energies.length - 1) / 2]
      : (energies[energies.length / 2 - 1] + energies[energies.length / 2]) / 2;
  const good = p.flashes.filter((f) => f.quality === 0).length;
  const flagged3 = p.flashes.filter((f) => f.quality === 3).length;
  const nr = glmFlashesNear(p.flashes, X.home[0], X.home[1], {
    maxKm: 200,
    cap: 300
  });
  const sm = glmSummary(nr);
  const nearest = nr.reduce((a, f) => (f.distKm < a.distKm ? f : a), nr[0]);
  const brightest = nr.reduce((a, f) => (f.energyJ > a.energyJ ? f : a), nr[0]);
  const ids = new Set(p.flashes.map((f) => f.id));
  check(
    "THE FILE, READ: the vendored 20-s file through the gated reader agrees with h5py's independent read to the flash",
    GLM_NAME === X.file &&
      p !== null &&
      p.n === X.n &&
      p.diskFlashes === X.flashCount &&
      p.platform === X.platform &&
      p.startMs === startMs &&
      p.endMs === Date.parse(X.end) &&
      ids.size === X.n &&
      f0.id === X.first.id &&
      near(f0.lat, X.first.lat, 1e-6) &&
      near(f0.lon, X.first.lon, 1e-6) &&
      near(f0.energyJ, X.first.energyJ, 1e-27) &&
      near(f0.areaKm2, X.first.areaKm2, 1e-9) &&
      f0.quality === X.first.quality &&
      near(f0.tFirstMs, startMs + X.first.tFirstS * 1000, 1e-6) &&
      near(f0.durationMs, X.first.durationMs, 1e-6) &&
      good === X.quality['0'] &&
      flagged3 === X.quality['3'] &&
      good + flagged3 === X.n &&
      near(energies[0], X.energy.min, 1e-29) &&
      near(energies[energies.length - 1], X.energy.max, 1e-26) &&
      near(median, X.energy.median, 1e-27) &&
      nr.length === X.within200 &&
      nr.every((f) => f.quality === 0) === (X.degradedWithin200 === 0) &&
      nr[0].id === X.earliestWithin200.id &&
      near(
        nr[0].tFirstMs,
        startMs + X.earliestWithin200.tFirstS * 1000,
        1e-6
      ) &&
      nearest.id === X.nearest.id &&
      near(nearest.distKm, X.nearest.km, 1e-6) &&
      near(nearest.bearingDeg, X.nearest.bearingDeg, 1e-6) &&
      near(nearest.energyJ, X.nearest.energyJ, 1e-27) &&
      brightest.id === X.brightest.id &&
      near(brightest.distKm, X.brightest.km, 1e-6) &&
      near(brightest.energyJ, X.brightest.energyJ, 1e-25) &&
      near(brightest.areaKm2, X.brightest.areaKm2, 1e-6) &&
      near(brightest.durationMs, X.brightest.durationMs, 1e-6) &&
      sm.n === X.within200 &&
      near(sm.nearestKm, X.nearest.km, 1e-6) &&
      near(sm.brightestEnergyJ, X.brightest.energyJ, 1e-25) &&
      near(
        flashStrength(brightest.energyJ),
        0.4 + (0.6 * Math.log10(X.brightest.energyJ / 1e-14)) / 2.5,
        1e-12
      ),
    `${X.file.slice(0, 40)}: ${p.n} flashes on ${p.platform}'s disk (the file's own count ${p.diskFlashes}), ${good} good and ${flagged3} flagged 3, ids all distinct; ` +
      `the first (id ${f0.id}) at ${f0.lat.toFixed(4)}, ${f0.lon.toFixed(4)}: ${f0.energyJ.toExponential(4)} J, ${f0.areaKm2.toFixed(2)} km^2, first light ${((f0.tFirstMs - startMs) / 1000).toFixed(4)} s ` +
      `${f0.tFirstMs < startMs ? 'before' : 'after'} the file's start, ${f0.durationMs.toFixed(2)} ms - each as h5py read it; energies ${energies[0].toExponential(3)} to ${energies[energies.length - 1].toExponential(3)} J, median ${median.toExponential(3)}; ` +
      `${nr.length} within 200 km of Tampa, the nearest id ${nearest.id} ${nearest.distKm.toFixed(2)} km at ${nearest.bearingDeg.toFixed(2)}° (${nearest.energyJ.toExponential(3)} J), ` +
      `the brightest id ${brightest.id} ${brightest.energyJ.toExponential(3)} J ${brightest.distKm.toFixed(1)} km off (${brightest.areaKm2.toFixed(0)} km^2, ${brightest.durationMs.toFixed(0)} ms, strength ${flashStrength(brightest.energyJ).toFixed(3)})`
  );
}

process.exit(fail ? 1 : 0);
