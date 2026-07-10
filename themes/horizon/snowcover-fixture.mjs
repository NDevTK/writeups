// Pixel samples from a REAL MODIS_Terra_NDSI_Snow_Cover tile
// (GIBS epsg3857 z8 r90 c133, 2026-07-08 - the Jungfrau
// region in July): the permanent snow and glaciers answer as
// opaque NDSI ramp pixels, the valleys as measured snow-free
// ground, with cloud and inland-water flags alongside. Each
// row: [x, y, r, g, b, a]. The full tile held 3708 snow pixels.
export const SNOWTILE_SAMPLES = {
  ndsi: [
    [226, 20, 240, 240, 137, 255],
    [228, 20, 240, 240, 137, 255],
    [228, 22, 240, 240, 137, 255],
    [252, 70, 240, 240, 142, 255],
    [254, 70, 240, 210, 133, 255],
    [246, 72, 240, 240, 144, 255]
  ],
  clear: [
    [0, 0, 0, 255, 0, 0],
    [2, 0, 0, 255, 0, 0],
    [4, 0, 0, 255, 0, 0]
  ],
  cloud: [
    [248, 14, 0, 191, 255, 0],
    [248, 16, 0, 191, 255, 0],
    [252, 16, 0, 191, 255, 0]
  ],
  water: [
    [22, 0, 0, 0, 255, 0],
    [240, 0, 0, 0, 255, 0],
    [242, 0, 0, 0, 255, 0]
  ]
};
export const SNOWTILE_SNOW_PIXELS = 3708;
