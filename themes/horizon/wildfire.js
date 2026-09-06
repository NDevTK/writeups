/**
 * wildfire.js - real wildfires, glowing where they are actually burning
 * right now. NASA's EONET (Earth Observatory Natural Event Tracker)
 * publishes open natural events - among them active wildfires - as a
 * keyless, CORS-open JSON feed (eonet.gsfc.nasa.gov/api/v3/categories/
 * wildfires), so the browser fetches it DIRECTLY: it is a public NASA
 * service built for many sites, and this one is small. Each event
 * carries a track of dated geometry points; the LAST point is where the
 * fire most recently was. This turns that into a fire the scene can
 * show - a glowing front near the ground, a smoke column leaning on the
 * measured wind - placed by real bearing/distance from the view.
 * Pure JS (no renderer import), gated by wildfire-reference.mjs; the
 * theme fetches and renders it.
 *
 * Only OPEN events with a real point are kept, freshest first, tagged
 * with an age so a days-old fire glows fainter than one seen hours ago.
 * Where no fire is near, nothing is invented - the sky stays clean.
 */

const R_EARTH_KM = 6371;
const RAD = Math.PI / 180;

// Great-circle distance (km) and initial bearing (deg from north,
// clockwise) from (lat0,lon0) to (lat1,lon1).
export function rangeBearing(lat0, lon0, lat1, lon1) {
  const p0 = lat0 * RAD;
  const p1 = lat1 * RAD;
  const dp = (lat1 - lat0) * RAD;
  const dl = (lon1 - lon0) * RAD;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p0) * Math.cos(p1) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const distKm = 2 * R_EARTH_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const y = Math.sin(dl) * Math.cos(p1);
  const x =
    Math.cos(p0) * Math.sin(p1) - Math.sin(p0) * Math.cos(p1) * Math.cos(dl);
  let brg = Math.atan2(y, x) / RAD;
  if (brg < 0) brg += 360;
  return {distKm, bearingDeg: brg};
}

// The latest dated POINT of an EONET event's geometry track, or null.
// Point geometry is [lon, lat]; a Polygon (a burn perimeter) reduces to
// the mean of its outer ring so a fire still gets a location.
function lastPoint(geometry) {
  if (!Array.isArray(geometry)) return null;
  for (let i = geometry.length - 1; i >= 0; i--) {
    const g = geometry[i];
    if (!g || !g.coordinates) continue;
    if (g.type === 'Point' && g.coordinates.length >= 2)
      return {lon: +g.coordinates[0], lat: +g.coordinates[1], date: g.date};
    if (g.type === 'Polygon' && Array.isArray(g.coordinates[0])) {
      let ring = g.coordinates[0];
      // a closed ring repeats its first vertex last - drop it so the
      // centroid is not weighted twice toward that corner
      const f = ring[0];
      const l = ring[ring.length - 1];
      if (
        ring.length > 1 &&
        Array.isArray(f) &&
        Array.isArray(l) &&
        f[0] === l[0] &&
        f[1] === l[1]
      )
        ring = ring.slice(0, -1);
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (const c of ring) {
        if (Array.isArray(c) && c.length >= 2) {
          sx += +c[0];
          sy += +c[1];
          n++;
        }
      }
      if (n) return {lon: sx / n, lat: sy / n, date: g.date};
    }
  }
  return null;
}

const ms = (iso) => (iso ? Date.parse(iso) : NaN);

/**
 * EONET wildfires JSON -> [{id, title, lat, lon, ageH}], the freshest
 * real fire point per open event, sorted newest first. Events with no
 * usable point, or (when nowMs is given) older than maxAgeH, are
 * dropped. ageH is hours since the fire's last report (0 if undated).
 */
export function parseWildfires(json, nowMs = 0, maxAgeH = 240) {
  const out = [];
  for (const e of (json && json.events) || []) {
    if (e.closed) continue; // only active fires
    const p = lastPoint(e.geometry);
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    if (Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) continue;
    const t = ms(p.date);
    const ageH = nowMs && Number.isFinite(t) ? (nowMs - t) / 3600000 : 0;
    if (nowMs && Number.isFinite(t) && ageH > maxAgeH) continue;
    out.push({
      id: e.id || '',
      title: e.title || 'Wildfire',
      lat: p.lat,
      lon: p.lon,
      ageH: Math.max(0, ageH)
    });
  }
  out.sort((a, b) => a.ageH - b.ageH);
  return out;
}

/**
 * THE MEASURED HOT SPOTS (162nd pass): NOAA's fire pixels from the
 * theme's /goesl2 window (goesl2.fireList: each navigated to its
 * place with the ATBD's mask class and, where characterised, its
 * radiative power in MW) as fires the scene can show. The intensity
 * is the fire's own heat, not its age: the radiative power on a log
 * scale from 1 MW (a faint glow, 0.35) to 1000 MW (full, 1.0) -
 * Wooster's MIR law on the ATBD's own scale (its example plates
 * colour 0-1000 MW black to red, 1000-2000 red to yellow) - and a
 * probable fire without a reported power a faint 0.3; the distance
 * fade is firesNear's own. A saturated pixel (the sensor's 411.86 K
 * ceiling) burns full. ageH is the file's age in hours: minutes.
 * Sorted nearest first, capped.
 */
export function goesFiresNear(list, lat, lon, fileMs, nowMs, maxKm = 200, cap = 24) {
  const near = [];
  const ageH = Number.isFinite(fileMs) && Number.isFinite(nowMs) ? Math.max(0, (nowMs - fileMs) / 3600000) : 0;
  for (const f of list || []) {
    const rb = rangeBearing(lat, lon, f.latDeg, f.lonDeg);
    if (rb.distKm > maxKm) continue;
    const distFade = Math.max(0.2, 1 - rb.distKm / maxKm);
    const heat =
      f.kind === 'saturated'
        ? 1
        : Number.isFinite(f.frpMW) && f.frpMW > 0
          ? Math.min(1, Math.max(0.35, 0.35 + (0.65 * Math.log10(1 + f.frpMW)) / 3))
          : 0.3;
    near.push({
      id: `goes-${f.i}-${f.j}`,
      title:
        (f.kind || 'fire') +
        ' fire pixel' +
        (Number.isFinite(f.frpMW) ? ` ${f.frpMW} MW` : '') +
        (f.filtered ? ', seen before' : ''),
      lat: f.latDeg,
      lon: f.lonDeg,
      ageH,
      kind: f.kind,
      filtered: !!f.filtered,
      frpMW: Number.isFinite(f.frpMW) ? f.frpMW : null,
      tempK: Number.isFinite(f.tempK) ? f.tempK : null,
      measured: true,
      distKm: rb.distKm,
      bearingDeg: rb.bearingDeg,
      intensity: heat * distFade
    });
  }
  near.sort((a, b) => a.distKm - b.distKm);
  return near.slice(0, cap);
}
/**
 * The scene's fires: the measured hot spots first, then the EONET
 * events that no hot spot stands within `km` of (an event's point is
 * a day-old centroid; the pixel that burns now outranks it). Sorted
 * nearest first, capped.
 */
export function mergeFires(measured, events, km = 10, cap = 24) {
  const out = [...(measured || [])];
  for (const e of events || []) {
    const close = out.some(
      (m) => m.measured && rangeBearing(m.lat, m.lon, e.lat, e.lon).distKm <= km
    );
    if (!close) out.push(e);
  }
  out.sort((a, b) => a.distKm - b.distKm);
  return out.slice(0, cap);
}
/**
 * The fires within maxKm of (lat, lon), each with its distance, bearing
 * and a 0..1 intensity that fades with age (fresh fires burn bright) and
 * with distance (a far fire is a fainter glow on the horizon). Sorted
 * nearest first, capped.
 */
export function firesNear(fires, lat, lon, maxKm = 200, cap = 24) {
  const near = [];
  for (const f of fires) {
    const rb = rangeBearing(lat, lon, f.lat, f.lon);
    if (rb.distKm > maxKm) continue;
    const ageFade = Math.max(0.15, 1 - f.ageH / 96); // ~4 days to dim
    const distFade = Math.max(0.2, 1 - rb.distKm / maxKm);
    near.push({
      ...f,
      distKm: rb.distKm,
      bearingDeg: rb.bearingDeg,
      intensity: ageFade * distFade
    });
  }
  near.sort((a, b) => a.distKm - b.distKm);
  return near.slice(0, cap);
}
