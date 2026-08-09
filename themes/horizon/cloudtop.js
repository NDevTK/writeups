/**
 * cloudtop.js - MEASURED cloud-top heights: the VIIRS afternoon
 * pass retrieves cloud-top height at 750 m, GIBS serves it as
 * palettized PNGs over the SAME keyless CORS-open WMTS the snow
 * and night-lights censuses ride, and the deck tops - previously
 * a hand thickness (yCloud + 8 + cType*9) everywhere but the
 * storm case - become the satellite's numbers. Gated by
 * cloudtop-reference.mjs on pixels from a REAL tile.
 *
 * THE FEED - VIIRS_SNPP_Cloud_Top_Height_Day (EPSG:3857 "best",
 * GoogleMapsCompatible_Level7 native). The published colormap
 * (colormaps/v1.3/MODIS_VIIRS_Cloud_Top_Height.xml, fetched
 * 2026-08-09) is embedded VERBATIM below: 240 bands of 50 m from
 * [0,50) to [11950,12000), one open top class [12000,+INF), and
 * a transparent fill. NOTE the GIBS colormap files were RENAMED
 * upstream between July and August 2026 (the snow census's old
 * URL now 404s while its vendored ramp keeps working) - vendoring
 * verbatim is what makes these censuses survive the churn.
 *
 * WHAT A PIXEL MEANS: an opaque palette pixel is a RETRIEVED
 * cloud top; a transparent pixel is clear sky OR no retrieval -
 * the product does not distinguish, so the census reports the
 * height statistics of the cloud it saw and NOTHING about cover
 * (cover stays with METAR/model - separate instruments). The
 * open top class carries "at least 12 km" - its value is the
 * class floor, stated, not an invented height.
 *
 * BAND SPLIT: the ISCCP low/mid/high pressure boundaries the
 * repo already carries (cloud-climatology.js: low > 680 mb, mid
 * 440-680, high < 440) - the census takes the two boundary
 * HEIGHTS as arguments so the caller can supply them from the
 * measured radiosonde column (levelAt hM at 680/440 hPa) or from
 * the ISA fallback below (independently derivable from the ISA
 * barometric formula the refraction chain rides: h(680 hPa) =
 * 3240 m, h(440 hPa) = 6508 m).
 */

import {sceneToGeo} from './roam.js';
import {pixelOf} from './nightlights.js';

export const CTOP_LAYER = 'VIIRS_SNPP_Cloud_Top_Height_Day';
export const CTOP_Z = 7; // GoogleMapsCompatible_Level7 (native max)
export const CTOP_TILES =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/' +
  CTOP_LAYER +
  '/default/{d}/GoogleMapsCompatible_Level7/{z}/{r}/{c}.png';
// The VIIRS product is daily; two days is the walkback before the
// sky's tops are a different regime - stated: the census gives
// the DAY's deck-top levels, not the instant (the tops move
// faster than an afternoon polar pass).
export const CTOP_FRESH_D = 2;
// ISCCP boundary heights from the ISA barometric formula
// (T0 = 288.15 K, L = 6.5 K/km, exponent 5.255):
// h = (T0/L) (1 - (p/1013.25)^(1/5.255)).
export const ISCCP_LOW_TOP_M = 3240; // 680 hPa
export const ISCCP_MID_TOP_M = 6508; // 440 hPa

// The published colormap, verbatim: [r, g, b, loM, hiM] per band.
export const CTOP_RGB = [
  [255, 0, 0, 0, 50],
  [255, 0, 1, 50, 100],
  [255, 1, 0, 100, 150],
  [255, 1, 1, 150, 200],
  [254, 0, 0, 200, 250],
  [254, 0, 1, 250, 300],
  [254, 1, 0, 300, 350],
  [254, 1, 1, 350, 400],
  [254, 2, 1, 400, 450],
  [254, 2, 0, 450, 500],
  [254, 2, 2, 500, 550],
  [253, 0, 0, 550, 600],
  [253, 0, 1, 600, 650],
  [253, 1, 0, 650, 700],
  [253, 1, 1, 700, 750],
  [253, 1, 2, 750, 800],
  [170, 0, 0, 800, 850],
  [170, 0, 1, 850, 900],
  [170, 1, 0, 900, 950],
  [170, 1, 1, 950, 1000],
  [171, 0, 0, 1000, 1050],
  [171, 0, 1, 1050, 1100],
  [171, 1, 0, 1100, 1150],
  [171, 1, 1, 1150, 1200],
  [171, 2, 1, 1200, 1250],
  [171, 2, 0, 1250, 1300],
  [171, 2, 2, 1300, 1350],
  [172, 0, 0, 1350, 1400],
  [172, 0, 1, 1400, 1450],
  [172, 1, 0, 1450, 1500],
  [172, 1, 1, 1500, 1550],
  [172, 1, 2, 1550, 1600],
  [110, 0, 0, 1600, 1650],
  [110, 0, 1, 1650, 1700],
  [110, 1, 0, 1700, 1750],
  [110, 1, 1, 1750, 1800],
  [111, 0, 0, 1800, 1850],
  [111, 0, 1, 1850, 1900],
  [111, 1, 0, 1900, 1950],
  [111, 1, 1, 1950, 2000],
  [111, 2, 1, 2000, 2050],
  [111, 2, 0, 2050, 2100],
  [111, 2, 2, 2100, 2150],
  [112, 0, 0, 2150, 2200],
  [112, 0, 1, 2200, 2250],
  [112, 1, 0, 2250, 2300],
  [112, 1, 1, 2300, 2350],
  [112, 1, 2, 2350, 2400],
  [122, 90, 3, 2400, 2450],
  [122, 90, 4, 2450, 2500],
  [122, 91, 3, 2500, 2550],
  [122, 91, 4, 2550, 2600],
  [123, 90, 3, 2600, 2650],
  [123, 90, 4, 2650, 2700],
  [123, 91, 3, 2700, 2750],
  [123, 91, 4, 2750, 2800],
  [123, 92, 4, 2800, 2850],
  [123, 92, 3, 2850, 2900],
  [123, 92, 5, 2900, 2950],
  [124, 90, 3, 2950, 3000],
  [124, 90, 4, 3000, 3050],
  [124, 91, 3, 3050, 3100],
  [124, 91, 4, 3100, 3150],
  [124, 91, 5, 3150, 3200],
  [187, 136, 0, 3200, 3250],
  [187, 136, 1, 3250, 3300],
  [187, 137, 0, 3300, 3350],
  [187, 137, 1, 3350, 3400],
  [188, 136, 0, 3400, 3450],
  [188, 136, 1, 3450, 3500],
  [188, 137, 0, 3500, 3550],
  [188, 137, 1, 3550, 3600],
  [188, 138, 1, 3600, 3650],
  [188, 138, 0, 3650, 3700],
  [188, 138, 2, 3700, 3750],
  [189, 136, 0, 3750, 3800],
  [189, 136, 1, 3800, 3850],
  [189, 137, 0, 3850, 3900],
  [189, 137, 1, 3900, 3950],
  [189, 137, 2, 3950, 4000],
  [240, 190, 64, 4000, 4050],
  [240, 190, 65, 4050, 4100],
  [240, 191, 64, 4100, 4150],
  [240, 191, 65, 4150, 4200],
  [241, 190, 64, 4200, 4250],
  [241, 190, 65, 4250, 4300],
  [241, 191, 64, 4300, 4350],
  [241, 191, 65, 4350, 4400],
  [241, 192, 65, 4400, 4450],
  [241, 192, 64, 4450, 4500],
  [241, 192, 66, 4500, 4550],
  [242, 190, 64, 4550, 4600],
  [242, 190, 65, 4600, 4650],
  [242, 191, 64, 4650, 4700],
  [242, 191, 65, 4700, 4750],
  [242, 191, 66, 4750, 4800],
  [255, 255, 0, 4800, 4850],
  [255, 255, 1, 4850, 4900],
  [255, 254, 0, 4900, 4950],
  [255, 254, 1, 4950, 5000],
  [254, 255, 0, 5000, 5050],
  [254, 255, 1, 5050, 5100],
  [254, 254, 0, 5100, 5150],
  [254, 254, 1, 5150, 5200],
  [254, 253, 1, 5200, 5250],
  [254, 253, 0, 5250, 5300],
  [254, 253, 2, 5300, 5350],
  [253, 255, 0, 5350, 5400],
  [253, 255, 1, 5400, 5450],
  [253, 254, 0, 5450, 5500],
  [253, 254, 1, 5500, 5550],
  [253, 254, 2, 5550, 5600],
  [0, 220, 0, 5600, 5650],
  [0, 220, 1, 5650, 5700],
  [0, 221, 0, 5700, 5750],
  [0, 221, 1, 5750, 5800],
  [1, 220, 0, 5800, 5850],
  [1, 220, 1, 5850, 5900],
  [1, 221, 0, 5900, 5950],
  [1, 221, 1, 5950, 6000],
  [1, 222, 1, 6000, 6050],
  [1, 222, 0, 6050, 6100],
  [1, 222, 2, 6100, 6150],
  [2, 220, 0, 6150, 6200],
  [2, 220, 1, 6200, 6250],
  [2, 221, 0, 6250, 6300],
  [2, 221, 1, 6300, 6350],
  [2, 221, 2, 6350, 6400],
  [0, 136, 0, 6400, 6450],
  [0, 136, 1, 6450, 6500],
  [0, 137, 0, 6500, 6550],
  [0, 137, 1, 6550, 6600],
  [1, 136, 0, 6600, 6650],
  [1, 136, 1, 6650, 6700],
  [1, 137, 0, 6700, 6750],
  [1, 137, 1, 6750, 6800],
  [1, 138, 1, 6800, 6850],
  [1, 138, 0, 6850, 6900],
  [1, 138, 2, 6900, 6950],
  [2, 136, 0, 6950, 7000],
  [2, 136, 1, 7000, 7050],
  [2, 137, 0, 7050, 7100],
  [2, 137, 1, 7100, 7150],
  [2, 137, 2, 7150, 7200],
  [0, 80, 0, 7200, 7250],
  [0, 80, 1, 7250, 7300],
  [0, 81, 0, 7300, 7350],
  [0, 81, 1, 7350, 7400],
  [1, 80, 0, 7400, 7450],
  [1, 80, 1, 7450, 7500],
  [1, 81, 0, 7500, 7550],
  [1, 81, 1, 7550, 7600],
  [1, 82, 1, 7600, 7650],
  [1, 82, 0, 7650, 7700],
  [1, 82, 2, 7700, 7750],
  [2, 80, 0, 7750, 7800],
  [2, 80, 1, 7800, 7850],
  [2, 81, 0, 7850, 7900],
  [2, 81, 1, 7900, 7950],
  [2, 81, 2, 7950, 8000],
  [0, 136, 238, 8000, 8050],
  [0, 136, 239, 8050, 8100],
  [0, 137, 238, 8100, 8150],
  [0, 137, 239, 8150, 8200],
  [1, 136, 238, 8200, 8250],
  [1, 136, 239, 8250, 8300],
  [1, 137, 238, 8300, 8350],
  [1, 137, 239, 8350, 8400],
  [1, 138, 239, 8400, 8450],
  [1, 138, 238, 8450, 8500],
  [1, 138, 240, 8500, 8550],
  [2, 136, 238, 8550, 8600],
  [2, 136, 239, 8600, 8650],
  [2, 137, 238, 8650, 8700],
  [2, 137, 239, 8700, 8750],
  [2, 137, 240, 8750, 8800],
  [0, 0, 255, 8800, 8850],
  [0, 0, 254, 8850, 8900],
  [0, 1, 255, 8900, 8950],
  [0, 1, 254, 8950, 9000],
  [1, 0, 255, 9000, 9050],
  [1, 0, 254, 9050, 9100],
  [1, 1, 255, 9100, 9150],
  [1, 1, 254, 9150, 9200],
  [1, 2, 254, 9200, 9250],
  [1, 2, 255, 9250, 9300],
  [1, 2, 253, 9300, 9350],
  [2, 0, 253, 9350, 9400],
  [2, 0, 254, 9400, 9450],
  [2, 1, 253, 9450, 9500],
  [2, 1, 254, 9500, 9550],
  [2, 1, 255, 9550, 9600],
  [0, 0, 170, 9600, 9650],
  [0, 0, 171, 9650, 9700],
  [0, 1, 170, 9700, 9750],
  [0, 1, 171, 9750, 9800],
  [1, 0, 170, 9800, 9850],
  [1, 0, 171, 9850, 9900],
  [1, 1, 170, 9900, 9950],
  [1, 1, 171, 9950, 10000],
  [1, 2, 171, 10000, 10050],
  [1, 2, 170, 10050, 10100],
  [1, 2, 172, 10100, 10150],
  [2, 0, 170, 10150, 10200],
  [2, 0, 171, 10200, 10250],
  [2, 1, 170, 10250, 10300],
  [2, 1, 171, 10300, 10350],
  [2, 1, 172, 10350, 10400],
  [0, 0, 100, 10400, 10450],
  [0, 0, 101, 10450, 10500],
  [0, 1, 100, 10500, 10550],
  [0, 1, 101, 10550, 10600],
  [1, 0, 100, 10600, 10650],
  [1, 0, 101, 10650, 10700],
  [1, 1, 100, 10700, 10750],
  [1, 1, 101, 10750, 10800],
  [1, 2, 101, 10800, 10850],
  [1, 2, 100, 10850, 10900],
  [1, 2, 102, 10900, 10950],
  [2, 0, 100, 10950, 11000],
  [2, 0, 101, 11000, 11050],
  [2, 1, 100, 11050, 11100],
  [2, 1, 101, 11100, 11150],
  [2, 1, 102, 11150, 11200],
  [183, 15, 141, 11200, 11250],
  [183, 15, 142, 11250, 11300],
  [183, 16, 141, 11300, 11350],
  [183, 16, 142, 11350, 11400],
  [184, 15, 141, 11400, 11450],
  [184, 15, 142, 11450, 11500],
  [184, 16, 141, 11500, 11550],
  [184, 16, 142, 11550, 11600],
  [184, 17, 142, 11600, 11650],
  [184, 17, 141, 11650, 11700],
  [184, 17, 143, 11700, 11750],
  [185, 15, 141, 11750, 11800],
  [185, 15, 142, 11800, 11850],
  [185, 16, 141, 11850, 11900],
  [185, 16, 142, 11900, 11950],
  [185, 16, 143, 11950, 12000],
  // the open top class [12000, +INF): the value is the FLOOR
  [102, 0, 119, 12000, Infinity]
];

const LUT = new Map(CTOP_RGB.map((e) => [e[0] + ',' + e[1] + ',' + e[2], e]));

// One census pixel: opaque palette colours are retrieved tops
// (band midpoint; the open class returns its floor), anything
// else - transparent fill, off-palette - is UNSEEN (clear sky or
// no retrieval, the product does not say which).
export function classifyCtop(p) {
  if (!p) return {kind: 'unseen'};
  const [r, g, b, a] = p;
  if (a === 0) return {kind: 'unseen'};
  const e = LUT.get(r + ',' + g + ',' + b);
  if (!e) return {kind: 'unseen'};
  if (e[4] === Infinity) return {kind: 'top12', m: e[3]};
  return {kind: 'height', m: (e[3] + e[4]) / 2};
}

const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[s.length >> 1];
};

/**
 * Cloud-top statistics over the roam box, sampled through the
 * SAME Earth anchoring as the terrain and the other censuses.
 * sample(ix, iy) -> [r,g,b,a] global pixel or null. Band split at
 * the caller's low/mid boundary heights (measured column or ISA).
 * Returns {cloudFrac, n, lowM, midM, highM, nLow, nMid, nHigh}:
 * medians in metres a.s.l. per ISCCP band, null where the
 * satellite saw no such cloud - the hand thickness stands there.
 * The MEDIAN is a deliberate reduction: the drawn deck is one
 * slab per band, so a bimodal band (two stratocumulus levels)
 * collapses to its median top - the display's own single-slab
 * limit, stated, not a claim about the field.
 */
export function ctopStats(
  sample,
  anchor,
  world,
  n,
  lowTopM = ISCCP_LOW_TOP_M,
  midTopM = ISCCP_MID_TOP_M
) {
  const low = [];
  const mid = [];
  const high = [];
  let seen = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * world - world / 2;
      const z = ((j + 0.5) / n) * world - world / 2;
      const g = sceneToGeo(x, z, anchor);
      const p = pixelOf(g.lat, g.lon, CTOP_Z);
      const c = classifyCtop(sample(Math.floor(p.px), Math.floor(p.py)));
      if (c.kind === 'unseen') continue;
      seen++;
      if (c.kind === 'top12' || c.m >= midTopM) high.push(c.m);
      else if (c.m >= lowTopM) mid.push(c.m);
      else low.push(c.m);
    }
  }
  return {
    cloudFrac: seen / (n * n),
    n: seen,
    lowM: median(low),
    midM: median(mid),
    highM: median(high),
    nLow: low.length,
    nMid: mid.length,
    nHigh: high.length
  };
}
