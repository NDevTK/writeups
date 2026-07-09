/**
 * Wildfire smoke - the single source shared by the horizon-live
 * daemon (server/src/index.mjs; install.sh ships this file beside
 * it), the theme (Horizon.html) and the reference printer
 * (smoke-reference.mjs).
 *
 * NOAA's Hazard Mapping System is ANALYSTS drawing what they see
 * in the satellite imagery: every plume polygon is a human-
 * verified observation of smoke, classified light/medium/heavy -
 * published class concentrations ~5/16/27 ug/m^3 of surface-level
 * smoke (Ruminski et al. 2006, the HMS product description).
 * Coverage is North America (the product's own scope). The daemon
 * fetches the daily KML once per hour and answers point queries
 * from RAM; the theme records the verified plume overhead in the
 * provenance panel and exposes it as state.smoke for the aerosol
 * layer (the CAMS AOD the sky already uses is quantitative and
 * includes smoke - HMS adds the analyst's TYPE verdict; the
 * absorbing-aerosol render hook is deferred until the Mie
 * absorption constant question in WEBGPU-PLAN.md is settled with
 * GPU recertification).
 *
 * Wire format captured live 2026-07-09: KML Placemarks with the
 * density in styleUrl (#Smoke_{Light,Medium,Heavy}_style) and one
 * outer ring of "lon,lat,alt" lines per polygon.
 */

// Published HMS class concentrations, ug/m^3 (Ruminski et al.
// 2006). Exported for the future aerosol hook.
export const HMS_UGM3 = {light: 5, medium: 16, heavy: 27};

// Parse the daily HMS smoke KML: [{density, ring: [[lat, lon]..]}].
// Regex-scoped per Placemark - the files are machine-written with
// one styleUrl and one outer ring each; malformed placemarks are
// dropped, never guessed at.
export function parseHmsKml(kml) {
  const out = [];
  if (typeof kml !== 'string') return out;
  const marks = kml.split('<Placemark>').slice(1);
  for (const m of marks) {
    const style = m.match(/styleUrl>#Smoke_(Light|Medium|Heavy)/);
    const coords = m.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
    if (!style || !coords) continue;
    const ring = [];
    for (const line of coords[1].trim().split(/\s+/)) {
      const [lon, lat] = line.split(',').map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lon)) ring.push([lat, lon]);
    }
    if (ring.length >= 4) {
      out.push({density: style[1].toLowerCase(), ring});
    }
  }
  return out;
}

// Even-odd point-in-polygon (the same test the theme's forests
// use), in geodetic coordinates.
export function inRing(ring, lat, lon) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [lai, loi] = ring[i];
    const [laj, loj] = ring[j];
    if (
      loi > lon !== loj > lon &&
      lat < ((laj - lai) * (lon - loi)) / (loj - loi) + lai
    ) {
      inside = !inside;
    }
  }
  return inside;
}

// The densest analyst-verified plume covering the point, or null.
// Heavy outranks medium outranks light when plumes overlap.
const RANK = {heavy: 3, medium: 2, light: 1};
export function smokeAt(polys, lat, lon) {
  let best = null;
  for (const p of Array.isArray(polys) ? polys : []) {
    if (best && RANK[p.density] <= RANK[best.density]) continue;
    if (inRing(p.ring, lat, lon)) best = p;
  }
  return best ? {density: best.density, ugm3: HMS_UGM3[best.density]} : null;
}
