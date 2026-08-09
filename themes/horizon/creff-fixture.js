// Pixel samples from a REAL VIIRS_SNPP_Cloud_Effective_Radius
// tile (GIBS epsg3857 z7 r45 c66, 2026-08-07 - the same Alpine
// convective afternoon the cloudtop fixture reads): water-phase
// droplets in the growing cumulus, ice-phase crystals in the
// anvils, transparent unseen sky. Each row: [x, y, r, g, b, a].
// The FULL tile held 6014 water pixels (median 11.05 um) and
// 1222 ice pixels (median 24.13 um).
export const CREFF_SAMPLES = {
  water: [
    [111, 0, 255, 255, 0, 255],
    [104, 1, 255, 255, 77, 255],
    [105, 1, 255, 255, 25, 255],
    [107, 1, 255, 255, 25, 255],
    [105, 2, 255, 255, 0, 255]
  ],
  ice: [
    [247, 128, 11, 107, 241, 255],
    [248, 128, 33, 78, 218, 255],
    [249, 128, 0, 157, 188, 255],
    [248, 129, 26, 88, 226, 255],
    [249, 129, 26, 88, 226, 255]
  ],
  unseen: [
    [0, 0, 220, 220, 255, 0],
    [1, 0, 220, 220, 255, 0],
    [2, 0, 220, 220, 255, 0]
  ]
};
