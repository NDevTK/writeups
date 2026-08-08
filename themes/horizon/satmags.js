/**
 * satmags.js - per-satellite standard magnitudes for the visual
 * fleet. sats.js carried the naked-eye class default 4.0 for
 * every satellite because intrinsic values are not distributed
 * with GP data; this module supplies the MEASURED catalogue.
 *
 * Source: the Stellarium project's satellites.dat (GPL data file,
 * plugins/Satellites/resources in the Stellarium repository,
 * fetched keyless from raw.githubusercontent.com), whose own
 * header states its provenance: Mike McCants' magnitude files
 * (mmccants.org), the MMT-9 automated photometric observatory
 * (Mini-MegaTORTORA, Beskin et al.), and CelesTrak RCS data. The
 * lineage checks out both ways: on the 126 satellites of today's
 * CelesTrak visual group present in BOTH the live file and the
 * community's archived 2014 qs.mag, every value agrees within
 * 0.5 mag (median difference 0.00) - one catalogue carried
 * forward, extended by observatory photometry for new objects
 * (Tianhe, recent rocket bodies).
 *
 * Convention, as McCants' own file description prints it (quoted
 * verbatim in the GPL plugin source):
 *   mag = stdmag - 15.75 + 2.5 log10(range^2 / fracil)
 * (range in km, fracil the illuminated fraction) - so stdmag is
 * the magnitude at 1000 km range, HALF illuminated:
 * -15.75 + 2.5 log10(1e6/0.5) = +0.003. That anchor is exactly
 * where sats.js's Lambert-sphere law normalises (beta = 90 deg),
 * so catalogue values plug straight into satMagnitude() - the
 * two conventions differ only in the phase LAW away from the
 * anchor (Lambert sphere vs geometric fraction), which is the
 * module's documented choice. The 1000-km standard-magnitude
 * system itself is the one printed in the open photometric
 * literature (Mallama 2021, arXiv:2111.09735 - read in full -
 * "a distance of 1000 km is commonly chosen as the standard";
 * his MMT-9-derived means, e.g. OneWeb 7.18 +/- 0.03 and
 * VisorSat 7.21, are the same observatory-and-convention chain
 * this catalogue extends).
 *
 * SATMAG_SNAPSHOT vendors the intersection of the catalogue with
 * the CelesTrak visual group of 2026-08-08 (138 of 157 ids, plus
 * the ISS) so the fleet is served offline; the live file refresh
 * (SATMAG_URL, gzip - the browser's own DecompressionStream
 * inflates it) overrides the snapshot and covers visual-group
 * drift. Ids absent from both keep STD_MAG_DEFAULT - the
 * default's own retirement note: the catalogue median of the
 * matched fleet is 3.5, so the old flat 4.0 sat half a magnitude
 * dim of the real fleet's middle.
 */

// Stellarium satellites.dat, gzip; keyless and CORS-open.
export const SATMAG_URL =
  'https://raw.githubusercontent.com/Stellarium/stellarium/master/' +
  'plugins/Satellites/resources/satellites.dat';

// NORAD id -> standard magnitude (1000 km, half illuminated).
// Snapshot 2026-08-08: satellites.dat x CelesTrak visual group.
export const SATMAG_SNAPSHOT = {
  694: 2.0,
  733: 3.5,
  877: 3.5,
  2802: 4.0,
  3230: 4.5,
  3597: 5.0,
  3669: 7.5,
  4327: 5.0,
  5118: 3.5,
  5560: 3.5,
  5730: 3.5,
  6153: 4.5,
  6155: 3.5,
  8459: 4.5,
  10114: 4.0,
  10967: 2.5,
  11267: 4.0,
  11574: 3.5,
  11672: 3.5,
  12139: 3.5,
  12465: 3.5,
  12904: 3.5,
  13068: 3.5,
  13154: 4.0,
  13403: 3.5,
  13553: 4.0,
  13819: 4.0,
  14208: 3.5,
  14699: 3.5,
  14820: 4.0,
  15483: 4.0,
  15772: 3.5,
  15945: 4.0,
  16182: 2.5,
  16496: 4.0,
  16719: 3.5,
  16792: 4.0,
  16882: 4.0,
  16908: 3.5,
  17567: 4.0,
  17589: 4.0,
  17590: 2.5,
  17912: 4.0,
  17973: 3.5,
  18153: 4.0,
  18187: 3.5,
  18749: 4.0,
  18958: 4.0,
  19046: 3.5,
  19120: 2.0,
  19210: 3.0,
  19257: 4.0,
  19573: 3.5,
  19574: 3.5,
  19650: 2.0,
  20261: 4.5,
  20262: 5.0,
  20323: 4.0,
  20443: 3.5,
  20453: 4.0,
  20465: 3.5,
  20466: 3.5,
  20511: 3.5,
  20580: 1.5,
  20625: 2.0,
  20663: 4.0,
  20666: 4.0,
  20775: 3.5,
  21088: 3.5,
  21397: 4.0,
  21422: 3.5,
  21423: 4.0,
  21574: 4.5,
  21610: 3.0,
  21819: 4.0,
  21876: 4.0,
  21938: 3.5,
  21949: 4.0,
  22219: 3.0,
  22220: 2.0,
  22236: 3.0,
  22285: 2.0,
  22286: 3.5,
  22566: 2.0,
  22626: 3.5,
  22803: 2.0,
  22830: 3.5,
  23087: 3.5,
  23088: 2.0,
  23343: 2.0,
  23405: 2.0,
  23561: 3.0,
  23705: 2.0,
  24298: 2.0,
  25400: 2.0,
  25407: 2.0,
  25544: -2.5,
  25732: 3.5,
  25860: 3.0,
  25861: 2.0,
  25876: 3.5,
  25977: 5.0,
  25994: 2.0,
  26070: 2.0,
  26474: 2.0,
  27386: 3.0,
  27422: 2.5,
  27424: 4.0,
  27432: 3.0,
  27597: 2.0,
  27601: 2.0,
  28059: 4.0,
  28222: 3.5,
  28353: 2.0,
  28415: 3.5,
  28480: 3.0,
  28738: 4.0,
  28931: 2.5,
  28932: 3.0,
  29228: 3.0,
  29507: 2.0,
  31114: 2.5,
  31598: 3.0,
  31792: 2.5,
  31793: 2.0,
  38341: 2.5,
  46265: 1.43,
  48274: 1.87,
  54039: 2.91,
  54149: 4.0,
  61045: 5.83,
  61046: 6.03,
  61047: 6.0,
  61048: 5.2,
  61049: 5.56,
  66004: 3.24,
  66515: 5.1,
  67232: 1.48
};

// Parse the satellites.dat text (uncompressed): '#' comments,
// tab-separated NORAD id / standard magnitude / RCS - exactly the
// format the Stellarium loader documents. Empty magnitude fields
// are skipped (RCS-only rows).
export function parseSatMags(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line[0] === '#') continue;
    const parts = line.split('\t');
    const id = parseInt(parts[0], 10);
    if (!Number.isFinite(id)) continue;
    const s = (parts[1] || '').trim();
    if (!s) continue;
    const m = Number(s);
    if (Number.isFinite(m)) map.set(id, m);
  }
  return map;
}

// The snapshot as a Map, the fleet's offline floor.
export function snapshotMap() {
  return new Map(
    Object.entries(SATMAG_SNAPSHOT).map(([k, v]) => [Number(k), v])
  );
}
