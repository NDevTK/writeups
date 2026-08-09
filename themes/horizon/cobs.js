/**
 * cobs.js - MEASURED comet brightness: the COBS network's
 * magnitude estimates outrank the MPC g/k formula prediction,
 * the AERONET pattern applied to comets. Gated by
 * cobs-reference.mjs on vendored real observations.
 *
 * THE FEED - the Comet Observation Database (cobs.si, keyless
 * JSON API; no CORS, so the horizon-live daemon proxies - the
 * METAR pattern): dated magnitude estimates from the worldwide
 * visual/CCD observer network, each tagged with the ICQ
 * observation method (Bobrovnikoff / Sidgwick / Morris /
 * In-Out...) and the comet's MPC designation. The estimates ARE
 * the community's standard total-coma magnitudes - the same
 * quantity the g/k law predicts - so a fresh measured median
 * can stand in the drawn magnitude's place directly.
 *
 * THE REDUCTION (daemon-side): per-comet MEDIAN of the last
 * COBS_WINDOW_DAYS of estimates, with a documented COBS_MIN_N
 * floor so a single outlier estimate never steers the sky (the
 * GMN medians pattern). Visual and CCD total magnitudes are
 * pooled - the ICQ archive treats both as m1 - and the median
 * absorbs the method spread. Comets with no fresh measured
 * median keep the g/k formula: fails to DATA, never to style.
 *
 * THE JOIN: COBS fullname ("220P/McNaught", "C/2024 J3
 * (ATLAS)") matches the SOFT00 name column verbatim for both
 * numbered and unnumbered comets; the designation prefix
 * (before the parenthesised discoverer) is the documented
 * fallback key.
 */

export const COBS_API =
  'https://cobs.si/api/obs_list.api?des=&format=json&exclude_faint=True';
export const COBS_WINDOW_DAYS = 10;
export const COBS_MIN_N = 3;

// The designation part of a comet name: "C/2024 J3 (ATLAS)" ->
// "C/2024 J3"; "220P/McNaught" -> "220P" (before the slash for
// numbered, before the parenthesis for unnumbered).
export function cometKey(name) {
  const s = String(name || '').trim();
  const paren = s.split(' (')[0].trim();
  const m = paren.match(/^(\d+[PDI])\b/i);
  return m ? m[1].toUpperCase() : paren;
}

// Reduce raw COBS objects to per-comet medians of the recent
// window. nowMs is injectable for the gate.
export function cobsMedians(objects, nowMs, windowDays = COBS_WINDOW_DAYS) {
  const cutoff = nowMs - windowDays * 86400e3;
  const by = new Map();
  for (const o of objects || []) {
    const mag = parseFloat(o.magnitude);
    const t = Date.parse(String(o.obs_date).replace(' ', 'T') + 'Z');
    const full = o.fullname ?? o.comet?.fullname;
    if (!Number.isFinite(mag) || !Number.isFinite(t) || !full) continue;
    if (t < cutoff) continue;
    const k = cometKey(full);
    if (!by.has(k)) by.set(k, {fullname: full, mags: [], newest: 0});
    const e = by.get(k);
    e.mags.push(mag);
    e.newest = Math.max(e.newest, t);
  }
  const out = {};
  for (const [k, e] of by) {
    if (e.mags.length < COBS_MIN_N) continue;
    const s = [...e.mags].sort((a, b) => a - b);
    const med =
      s.length % 2
        ? s[(s.length - 1) / 2]
        : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    out[k] = {
      fullname: e.fullname,
      mag: Math.round(med * 10) / 10,
      n: e.mags.length,
      newest: e.newest
    };
  }
  return out;
}

// The measured magnitude for a SOFT00 element row, or null.
export function measuredMag(soft00Name, medians) {
  if (!medians) return null;
  const k = cometKey(soft00Name);
  const hit = medians[k];
  return hit ? hit.mag : null;
}
