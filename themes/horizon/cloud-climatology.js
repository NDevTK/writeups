/**
 * cloud-climatology.js - the printed ISCCP layer partition for
 * the per-layer cloud-cover fallback. When the weather model
 * serves only TOTAL cover (open-meteo almost always serves the
 * three layers, so this is the rarely-hit fallback), the theme
 * used to split it low/mid/high by an invented overlapping
 * 0.7/0.5/0.3. The measured split is printed:
 *
 * Rossow & Schiffer 1999 (BAMS 80, 2261, "Advances in
 * Understanding Clouds from ISCCP" - read in full), Table 5:
 * the D-series global annual means for 1986-93. Cloud-type
 * amounts (%, ice with liquid in parentheses, daytime only -
 * the caption's own caveat): cumulus 1.2 (11.3),
 * stratocumulus 0.9 (11.2), stratus 0.2 (1.7); altocumulus
 * 5.1 (4.2), altostratus 3.8 (4.0), nimbostratus 1.0 (1.1);
 * cirrus 13.2, cirrostratus 5.8, deep convection 2.6 (high
 * clouds all ice). The level sums - low 26.5, middle 19.2,
 * high 21.6 - partition the printed total cloud amount 67.6
 * to 0.3% (their Fig. 2 defines the levels by cloud-top
 * pressure: low > 680 mb, middle 440-680, high < 440), and
 * the abstract's long-term global mean 0.675 +- 0.012
 * brackets it. ISCCP classifies each cloudy pixel ONCE, at
 * its top - so under a high deck the lower layers are
 * understated relative to true per-layer covers (the old 1.5x
 * overlapping guess aimed at that, uncited); the fallback now
 * carries the measured top-view partition, the stated
 * semantics.
 */

// Table 5, verbatim (percent of sky, global annual 1986-93;
// [ice, liquid] per type - high clouds are all ice).
export const ISCCP_TOTAL = 0.676;
export const ISCCP_TYPES = {
  cumulus: [1.2, 11.3],
  stratocumulus: [0.9, 11.2],
  stratus: [0.2, 1.7],
  altocumulus: [5.1, 4.2],
  altostratus: [3.8, 4.0],
  nimbostratus: [1.0, 1.1],
  cirrus: [13.2, 0],
  cirrostratus: [5.8, 0],
  deepConvection: [2.6, 0]
};

const sumOf = (names) =>
  names.reduce((a, n) => a + (ISCCP_TYPES[n][0] + ISCCP_TYPES[n][1]) / 100, 0);
export const ISCCP_LOW = sumOf(['cumulus', 'stratocumulus', 'stratus']);
export const ISCCP_MID = sumOf(['altocumulus', 'altostratus', 'nimbostratus']);
export const ISCCP_HIGH = sumOf(['cirrus', 'cirrostratus', 'deepConvection']);

// The fallback fractions: each level's share of the total.
export const LOW_FRAC = ISCCP_LOW / ISCCP_TOTAL; // 0.392
export const MID_FRAC = ISCCP_MID / ISCCP_TOTAL; // 0.284
export const HIGH_FRAC = ISCCP_HIGH / ISCCP_TOTAL; // 0.320
