// Pixel samples from a REAL VIIRS_SNPP_Cloud_Top_Height_Day tile
// (GIBS epsg3857 z7 r45 c66, 2026-08-07 - the Alps on a summer
// convective afternoon): banded retrievals up a growing cumulus
// field, open-class [12000,+INF) anvil tops, and transparent
// unseen sky. Each row: [x, y, r, g, b, a]. The FULL tile held
// 16258 opaque pixels of 65536 (24.8% cloud), 474 of them the
// open top class, banded median 5575 m.
export const CTOP_SAMPLES = {
  banded: [
    [103, 0, 124, 91, 3, 255],
    [104, 0, 188, 136, 0, 255],
    [105, 0, 187, 136, 1, 255],
    [106, 0, 188, 136, 0, 255],
    [110, 0, 188, 138, 2, 255],
    [111, 0, 188, 136, 1, 255],
    [112, 0, 188, 136, 0, 255],
    [113, 0, 187, 136, 0, 255]
  ],
  top12: [
    [236, 138, 102, 0, 119, 255],
    [237, 138, 102, 0, 119, 255],
    [238, 138, 102, 0, 119, 255],
    [239, 138, 102, 0, 119, 255]
  ],
  unseen: [
    [0, 0, 220, 220, 255, 0],
    [1, 0, 220, 220, 255, 0],
    [2, 0, 220, 220, 255, 0],
    [3, 0, 220, 220, 255, 0]
  ]
};
