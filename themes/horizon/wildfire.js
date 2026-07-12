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
