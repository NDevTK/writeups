/**
 * glm.js - lightning seen from orbit. GOES's Geostationary Lightning
 * Mapper (GLM) stares at the whole disk through a 777.4-nm filter
 * and reports every optical flash as a Level 2 product (GLM-L2-LCFA:
 * a 20-second file every 20 seconds, events clustered into groups
 * and flashes). Where the ground network is thin - the sea, the
 * tropics, the far side of a coast - the satellite's flashes are the
 * measured lightning the scene can show. Pure JS (no renderer, no
 * fetch); the daemon and the page read the files, this decodes and
 * composes.
 *
 * THE PRIMARY, read in full: the GLM Lightning Cluster-Filter
 * Algorithm ATBD v3.0 (Goodman, Mach, Koshak, Blakeslee, 30 Jul
 * 2012, 73 pp). An EVENT is one pixel over its background in one
 * 2-ms frame; a GROUP is the adjacent events of one frame; a FLASH
 * is the groups within 330 ms and 16.5 km of one another (any two
 * events of two groups meeting both), located by the amplitude-
 * weighted centroid (Appendix 4: the weight is the pixel's energy,
 * the solid angle included where a table gives it). The instrument:
 * a 1372 x 1300 CCD, 8-14 km pixels matched to the 5-10 km a stroke
 * lights at cloud top, the OI(1) 777.4-nm line, 2-ms integration
 * against the 400-us pulse, a frame-to-frame background subtraction
 * against a daytime background 150 times the signal; the cloud
 * scatters but hardly absorbs the near infrared, so every flash type
 * is seen from above (a cloud-to-ground and an intracloud flash
 * alike; the two cannot be told apart optically), rise times
 * lengthened 215 us and widths 210 us by the scattering (Christian
 * and Goodman 1987; 90% of 79 discharges above 4.7 uJ m^-2 sr^-1),
 * the lit cloud top typically 10 km across, up to 60 km. The flash
 * "energy" is the summed event energy densities times the pixels'
 * solid angles (Appendix 2-3: uJ m^-2 sr^-1 um^-1 per event, joules
 * per flash in the file). REQUIREMENT (Table 2): detection
 * efficiency 70% or better, false alarms under 5%, location within
 * 5 km (about half a pixel), 20 s latency (4 s of it the LCFA's),
 * up to 20,000 events a second. MEASURED (2026-09-06, three 20-s
 * files of GOES-19): 2,876 flashes a minute on the disk, energies
 * 3.3e-15 to 4.4e-12 J (median 4.2e-14, p90 3.1e-13, p99 1.3e-12),
 * areas 64-4,271 km^2 (median 222), durations median 199 ms (p90
 * 549, max 1,966), 98% flagged good (flag 3 the rest); a 20-s file
 * about 400 kB, read whole in 0.1 s.
 */
import {rangeBearing} from './wildfire.js';

export const GLM_ATBD = {
  version: 'GLM Lightning Cluster-Filter Algorithm ATBD v3.0, 2012-07-30',
  wavelengthNm: 777.4,
  frameMs: 2,
  pixelKm: [8, 14],
  flash: {timeMs: 330, distanceKm: 16.5},
  requirement: {
    detectionEfficiencyMin: 0.7,
    falseAlarmMax: 0.05,
    locationKm: 5,
    latencyS: 20,
    eventsPerSecondMax: 20000
  },
  optics: {riseLengthenedUs: 215, widthLengthenedUs: 210, litTopKm: 10, litTopMaxKm: 60},
  fileSeconds: 20
};
// the file's flash quality flag (flash_quality_flag: 0 good; 1, 3, 5
// degraded by the LCFA's own filters and warnings - stated)
export const GLM_QUALITY_WORDS = {
  0: 'good',
  1: 'degraded',
  3: 'degraded',
  5: 'degraded'
};
// MEASURED energy quantiles of the day's population (J), the display
// scale's anchors - stated as the day's, not a law
export const GLM_ENERGY_J = {floor: 3.3e-15, median: 4.2e-14, p90: 3.1e-13, p99: 1.3e-12, max: 4.4e-12};

// The file stores its counts as int16 with an UNSIGNED valid range
// ([0, -6] reads as 0..65530): a negative count is the count plus
// 65536.
export const u16 = (v) => (v < 0 ? v + 65536 : v);

/**
 * The flashes of an opened LCFA file (hdf5.js's handle): [{id, lat,
 * lon, energyJ, areaKm2, quality, words, tFirstMs, tLastMs,
 * durationMs}] with the file's start and end, its platform, the
 * disk's flash count. Missing datasets give null.
 */
export function parseGlmFlashes(f) {
  const d = (n) => f.dataset(n);
  const lat = d('flash_lat');
  const lon = d('flash_lon');
  const e = d('flash_energy');
  const a = d('flash_area');
  const q = d('flash_quality_flag');
  const t0 = d('flash_time_offset_of_first_event');
  const t1 = d('flash_time_offset_of_last_event');
  const id = d('flash_id');
  if (!lat || !lon || !e || !lat.values || !lon.values || !e.values) return null;
  const sc = (ds, k = 'scale_factor', dflt = 1) => (ds && ds.attrs && Number.isFinite(ds.attrs[k]) ? ds.attrs[k] : dflt);
  const es = sc(e);
  const eo = sc(e, 'add_offset', 0);
  const as = sc(a);
  const ts = sc(t0);
  const to = sc(t0, 'add_offset', 0);
  const ra = f.rootAttrs ? f.rootAttrs() : {};
  const startMs = ra.time_coverage_start ? Date.parse(ra.time_coverage_start) : NaN;
  const n = lat.values.length;
  const flashes = [];
  for (let i = 0; i < n; i++) {
    const qv = q && q.values ? q.values[i] : 0;
    const tf = t0 && t0.values ? u16(t0.values[i]) * ts + to : NaN;
    const tl = t1 && t1.values ? u16(t1.values[i]) * ts + to : NaN;
    flashes.push({
      id: id && id.values ? u16(id.values[i]) : i,
      lat: lat.values[i],
      lon: lon.values[i],
      energyJ: u16(e.values[i]) * es + eo,
      areaKm2: a && a.values ? (u16(a.values[i]) * as) / 1e6 : null,
      quality: qv,
      words: GLM_QUALITY_WORDS[qv] ?? `flag ${qv}`,
      tFirstMs: Number.isFinite(startMs) && Number.isFinite(tf) ? startMs + tf * 1000 : null,
      durationMs: Number.isFinite(tf) && Number.isFinite(tl) ? Math.max(0, (tl - tf) * 1000) : null
    });
  }
  const fc = d('flash_count');
  return {
    flashes,
    n,
    startMs,
    endMs: ra.time_coverage_end ? Date.parse(ra.time_coverage_end) : NaN,
    platform: ra.platform_ID ?? null,
    diskFlashes: fc && fc.values ? Number(fc.values[0]) : n
  };
}

/**
 * The flash's display strength from its optical energy: 0.4 at 1e-14
 * J (a little under the day's median), rising with the logarithm to
 * about 1 at 4e-12 J (the day's brightest), floored at 0.3 - the
 * day's own population the anchor, stated.
 */
export function flashStrength(energyJ) {
  if (!(energyJ > 0)) return 0.3;
  return Math.min(1.6, Math.max(0.3, 0.4 + (0.6 * Math.log10(energyJ / 1e-14)) / 2.5));
}

/**
 * The flashes within maxKm of (lat, lon), each with its distance,
 * bearing and strength, earliest first, capped.
 */
export function glmFlashesNear(flashes, lat, lon, {maxKm = 200, cap = 200} = {}) {
  const out = [];
  for (const f of flashes || []) {
    if (!Number.isFinite(f.lat) || !Number.isFinite(f.lon)) continue;
    const rb = rangeBearing(lat, lon, f.lat, f.lon);
    if (rb.distKm > maxKm) continue;
    out.push({...f, distKm: rb.distKm, bearingDeg: rb.bearingDeg, strength: flashStrength(f.energyJ)});
  }
  out.sort((a, b) => (a.tFirstMs ?? 0) - (b.tFirstMs ?? 0) || a.distKm - b.distKm);
  return out.slice(0, cap);
}

/**
 * The satellite's flashes that the ground network did not already
 * report: a network strike within km and ms of a flash is the same
 * lightning (the network's own strike, closer located, stands); the
 * rest are the satellite's alone. strikes: [{lat, lon, tMs}].
 */
export function flashesNotInNetwork(flashes, strikes, {km = 20, ms = 30000} = {}) {
  const out = [];
  for (const f of flashes || []) {
    let seen = false;
    for (const s of strikes || []) {
      if (Number.isFinite(f.tFirstMs) && Number.isFinite(s.tMs) && Math.abs(f.tFirstMs - s.tMs) > ms) continue;
      if (rangeBearing(f.lat, f.lon, s.lat, s.lon).distKm <= km) {
        seen = true;
        break;
      }
    }
    if (!seen) out.push(f);
  }
  return out;
}

/** The words: how many within reach, the nearest, the brightest. */
export function glmSummary(near) {
  if (!near || !near.length) return null;
  let nearest = near[0];
  let brightest = near[0];
  for (const f of near) {
    if (f.distKm < nearest.distKm) nearest = f;
    if (f.energyJ > brightest.energyJ) brightest = f;
  }
  return {
    n: near.length,
    nearestKm: nearest.distKm,
    nearestBearingDeg: nearest.bearingDeg,
    nearestEnergyJ: nearest.energyJ,
    brightestEnergyJ: brightest.energyJ,
    brightestKm: brightest.distKm,
    brightestStrength: brightest.strength
  };
}
