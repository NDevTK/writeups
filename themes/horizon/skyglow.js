/**
 * Skyglow - the single source shared by the theme's light
 * pollution system (Horizon.html) and the reference printer
 * (skyglow-reference.mjs).
 *
 * The honesty gap this closes: the theme rendered the same
 * pristine Gaia galaxy over Manhattan as over the Atacama. The
 * night sky most visitors actually have is set by ARTIFICIAL
 * skyglow, and it is MEASURED: skyglow-data.js is a downsample
 * of the World Atlas of Artificial Night Sky Brightness (Falchi
 * et al. 2016, Science Advances 2, e1600377; data DOI
 * 10.5880/GFZ.1.4.2016.001, CC BY-NC 4.0) - VIIRS satellite
 * radiances propagated through Garstang atmospheric modelling,
 * validated by that paper against thousands of ground SQM
 * measurements. Processing provenance lives in the data file's
 * header.
 *
 * Conventions (the paper's own):
 *  - the grid stores r = artificial / natural zenith luminance;
 *    the natural reference is 0.174 mcd/m^2 = 22.00 mag/arcsec^2
 *  - total zenith brightness: mag/arcsec^2 = 22.00 -
 *    2.5 log10(1 + r) (exact; r = 1 - "light pollution equals
 *    nature" - reads 21.25, the paper's own threshold examples)
 *  - byte quantisation: q = round(48 log10(1 + r)), reaching
 *    r ~ 2e5 at q = 255 - far beyond any city core (~x100)
 *
 * What the value drives:
 *  - point sources (stars, planets, meteors, satellites) and
 *    diffuse glows (Milky Way, zodiacal light) wash by CONTRAST:
 *    the eye detects them against the background, and contrast
 *    falls exactly as 1/(1 + r) when the background gains r
 *    parts artificial light
 *  - the sky itself gains an additive glow dome. Its horizonward
 *    growth toward nearby cities uses Walker's law (Walker 1977,
 *    PASP 89, 405: skyglow from a city falls as d^-2.5) summed
 *    over ring samples of the SAME grid - the classical
 *    propagation law on the measured map.
 *  - the record panel quotes the conventional SQM -> Bortle
 *    class mapping (documented convention, not physics).
 */

export const NATURAL_MCD = 0.174; // Falchi 2016 natural reference
export const NATURAL_MAG = 22.0; // mag/arcsec^2 of the same
export const Q_SCALE = 48; // byte log quantisation
export const WALKER_EXP = -2.5; // Walker 1977 propagation law

export function encodeQ(r) {
  return Math.max(0, Math.min(255, Math.round(Q_SCALE * Math.log10(1 + r))));
}

export function decodeQ(q) {
  return Math.pow(10, q / Q_SCALE) - 1;
}

// Total zenith sky brightness in mag/arcsec^2 at artificial/
// natural ratio r.
export function skyMag(r) {
  return NATURAL_MAG - 2.5 * Math.log10(1 + r);
}

// Contrast survival of a celestial source against a background
// brightened by ratio r.
export function pointVisibility(r) {
  return 1 / (1 + r);
}

// ---- Clouds amplify skyglow: Kyba et al. (2011, PLoS ONE 6,
// e17307) ----. Overcast multiplies zenith sky luminance by a
// MEASURED 10.1 inside Berlin and 2.8 at 32 km out - the
// amplification grows with how much artificial light is overhead,
// which is exactly what the Falchi ratio measures. The two
// published anchors are log-interpolated in the ratio (the
// assigned anchor ratios below are the documented closure: a
// bright urban core ~20, the city edge ~3 on the Falchi scale),
// clamped to the measured range and to >= 1 (a pristine sky has
// nothing to amplify - the rendered clouds already occlude its
// stars directly). Partial cover scales linearly with cloud
// fraction (the paper's okta bins rise monotonically).
export const KYBA_URBAN = {ratio: 20, amp: 10.1}; // central Berlin
export const KYBA_EDGE = {ratio: 3, amp: 2.8}; // 32 km out
export function cloudAmp(ratio, cloudFrac) {
  const c = Math.min(Math.max(cloudFrac ?? 0, 0), 1);
  if (!(ratio > 0) || c === 0) return 1;
  const slope =
    (KYBA_URBAN.amp - KYBA_EDGE.amp) /
    (Math.log10(KYBA_URBAN.ratio) - Math.log10(KYBA_EDGE.ratio));
  const overcast = Math.min(
    Math.max(
      KYBA_EDGE.amp + slope * (Math.log10(ratio) - Math.log10(KYBA_EDGE.ratio)),
      1
    ),
    KYBA_URBAN.amp
  );
  return 1 + (overcast - 1) * c;
}

// Conventional SQM -> Bortle class mapping (the widely used
// table; Bortle's 2001 scale is descriptive, this is the
// documented convention).
export function bortleClass(mag) {
  if (mag >= 21.75) return 1;
  if (mag >= 21.6) return 2;
  if (mag >= 21.3) return 3;
  if (mag >= 20.8) return 4;
  if (mag >= 20.1) return 5;
  if (mag >= 19.1) return 6;
  if (mag >= 18.0) return 7;
  if (mag >= 17.0) return 8;
  return 9;
}

// Bilinear sample of the byte grid (decoded to ratio). The grid
// covers lat +85..-60 (the atlas extent) in H rows, lon
// -180..180 in W columns wrapping; outside coverage the
// artificial ratio is 0 (polar oceans - honest for the atlas).
export const GRID_LAT_N = 85;
export const GRID_LAT_S = -60;

export function sampleRatio(grid, W, H, lat, lon) {
  if (lat > GRID_LAT_N || lat < GRID_LAT_S) return 0;
  const fy = ((GRID_LAT_N - lat) / (GRID_LAT_N - GRID_LAT_S)) * H - 0.5;
  let fx = (((lon + 180) % 360) / 360) * W - 0.5;
  if (fx < 0) fx += W;
  const y0 = Math.max(0, Math.min(H - 1, Math.floor(fy)));
  const y1 = Math.min(H - 1, y0 + 1);
  const x0 = Math.floor(fx) % W;
  const x1 = (x0 + 1) % W;
  const ty = Math.min(Math.max(fy - y0, 0), 1);
  const tx = fx - Math.floor(fx);
  const v00 = decodeQ(grid[y0 * W + x0]);
  const v01 = decodeQ(grid[y0 * W + x1]);
  const v10 = decodeQ(grid[y1 * W + x0]);
  const v11 = decodeQ(grid[y1 * W + x1]);
  return (
    v00 * (1 - ty) * (1 - tx) +
    v01 * (1 - ty) * tx +
    v10 * ty * (1 - tx) +
    v11 * ty * tx
  );
}

// Horizonward glow anisotropy: Walker's law over ring samples of
// the measured grid. For azimuth az (deg, 0 = north), sum the
// ratios at the ring distances, each attenuated by (d/d0)^-2.5
// with d0 = 10 km (inside d0 the local zenith value already
// carries it). Returns a relative weight to shape the glow dome.
export const RING_KM = [25, 50, 100];

export function horizonGlow(grid, W, H, lat, lon, azDeg) {
  const az = (azDeg * Math.PI) / 180;
  let g = 0;
  for (const dKm of RING_KM) {
    const dLat = (dKm / 111.195) * Math.cos(az);
    const dLon =
      ((dKm / 111.195) * Math.sin(az)) /
      Math.max(Math.cos((lat * Math.PI) / 180), 0.05);
    const r = sampleRatio(grid, W, H, lat + dLat, lon + dLon);
    g += r * Math.pow(dKm / 10, WALKER_EXP);
  }
  return g;
}
