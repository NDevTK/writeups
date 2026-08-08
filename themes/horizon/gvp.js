/**
 * gvp.js - live volcanic eruptions on the horizon: the
 * Smithsonian/USGS Weekly Volcanic Activity Report puts every
 * currently erupting volcano on the terrain, with the plume
 * drawn to the REPORT'S OWN printed height. Gated by
 * gvp-reference.mjs on vendored real report items.
 *
 * THE FEED - the Global Volcanism Program weekly report
 * (volcano.si.edu/news/WeeklyVolcanoRSS.xml, keyless; a
 * cooperative Smithsonian/USGS research product): one item per
 * volcano with georss coordinates and a prose summary from the
 * responsible observatory (INGV, JMA, PVMBG, IG-EPN, ...). The
 * summaries PRINT plume heights in two grammars - "rose 1-3 km
 * above the summit / crater rim" and "rose to 7 km (23,000 ft)
 * a.s.l." - and this parser carries exactly those printed
 * numbers: the drawn plume top is the observatory's reported
 * height, nothing modelled. (The Mastin 2009 height-flux
 * relation stays uncited - no open copy: Elsevier closed, the
 * MTU deposit 403s, the USGS warehouse page carries no PDF -
 * and it is NOT needed: the report prints the height itself.)
 * Summit elevations for the a.s.l. conversion come from the
 * GVP's own Holocene volcano list (webservices.volcano.si.edu
 * WFS, keyless; 1214 volcanoes with Elevation) - one
 * institution, both numbers.
 *
 * PARSER HONESTY: a height is accepted only when the preceding
 * text window names a plume/emission/cloud/column - the reports
 * also print ballistic heights ("ejected incandescent material
 * as high as 300 m above the summit") and exclusion radii
 * ("stay 2 km away from the summit") that must not become
 * plumes. Ranges keep their upper end (the week's highest
 * reported plume). No height parsed = no plume drawn - fails
 * to data, never to style.
 */

export const GVP_RSS = 'https://volcano.si.edu/news/WeeklyVolcanoRSS.xml';
export const GVP_WFS =
  'https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows' +
  '?service=WFS&version=2.0.0&request=GetFeature' +
  '&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes' +
  '&outputFormat=json&propertyName=Volcano_Name,Latitude,Longitude,Elevation' +
  '&count=1300';
// Look-back window that must name the rising thing (chars).
export const GVP_PLUME_CTX = 120;

// Decode the RSS description entities and strip markup to the
// plain prose the observatories wrote.
export function gvpPlainText(desc) {
  return String(desc || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ');
}

const NUM = (s) => parseFloat(String(s).replace(/,/g, ''));

// Scan one item's prose for printed plume heights. Returns
// {aboveM, aslM} - each the MAX found (metres), or null.
export function parseGvpItemHeights(text) {
  const t = gvpPlainText(text);
  const re =
    /(\d[\d.,]*)(?:\s*[-–]\s*(\d[\d.,]*))?\s*(m|km)\s*(?:\([^)]{0,24}\)\s*)?(a\.s\.l|above the (?:summit|crater rim|crater|vent))/gi;
  let aboveM = null;
  let aslM = null;
  let m;
  while ((m = re.exec(t)) !== null) {
    const ctx = t.slice(Math.max(0, m.index - GVP_PLUME_CTX), m.index);
    if (!/plume|emission|cloud|column/i.test(ctx)) continue;
    const v = Math.max(NUM(m[1]), m[2] ? NUM(m[2]) : -Infinity);
    const metres = m[3].toLowerCase() === 'km' ? v * 1000 : v;
    if (/^a\.s\.l/i.test(m[4])) aslM = Math.max(aslM ?? 0, metres);
    else aboveM = Math.max(aboveM ?? 0, metres);
  }
  return {aboveM, aslM};
}

// Parse the weekly RSS: one entry per item with coordinates and
// any printed plume heights.
export function parseGvpRss(xml) {
  const out = [];
  const items = String(xml || '')
    .split(/<item>/)
    .slice(1);
  for (const it of items) {
    const title = (it.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    const name = title.split(' (')[0].trim();
    const pt = (it.match(/<georss:point>([\s\S]*?)<\/georss:point>/) || [])[1];
    const desc = (it.match(/<description>([\s\S]*?)<\/description>/) || [])[1];
    if (!name || !pt) continue;
    const [lat, lon] = pt.trim().split(/\s+/).map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const h = parseGvpItemHeights(desc);
    out.push({name, lat, lon, aboveM: h.aboveM, aslM: h.aslM});
  }
  return out;
}

// The drawn plume top (metres a.s.l.) from the parsed heights
// and the GVP list's summit elevation: above-summit heights add
// to the summit; a.s.l. heights stand as printed; both present
// keeps the higher (the week's max). No height, no plume.
export function plumeTopM(entry, elevM) {
  const cands = [];
  if (entry.aboveM !== null && Number.isFinite(elevM))
    cands.push(elevM + entry.aboveM);
  if (entry.aslM !== null) cands.push(entry.aslM);
  return cands.length ? Math.max(...cands) : null;
}

// Apparent altitude (rad) of a point at hM metres a.s.l. seen
// from obsElevM at distKm - the same curvature-drop form the
// sprite geometry uses: the earth drops d^2/(2R) between here
// and there.
export const GVP_R_E_KM = 6371;
export function apparentAltRad(distKm, hM, obsElevM) {
  const d = Math.max(distKm, 0.1);
  const dropKm = (d * d) / (2 * GVP_R_E_KM);
  return Math.atan(((hM - obsElevM) / 1000 - dropKm) / d);
}
