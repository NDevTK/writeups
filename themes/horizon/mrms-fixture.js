// mrms-fixture.js - a real window of NCEP's MRMS 18-dBZ echo-top grid,
// vendored for the gates (174th pass): 51 x 51 cells (0.01 deg, ~1 km)
// around Savannah (32.08 N 81.10 W) cut from the 22:06Z file of
// 2026-09-06 (MRMS_EchoTop_18.latest.grib2.gz, mrms.ncep.noaa.gov)
// and re-packed by python as a complete GRIB2 message of its own:
// the original sections 1, 4 and 5 (template 5.41, R -3000, D 3, 16
// bits), section 3 re-based to the crop's grid, the crop's counts as a
// 16-bit greyscale PNG written by Pillow (4120 bytes in all). MRMS_EXPECT
// was computed INDEPENDENTLY of grib2.js and mrms.js by Pillow and
// numpy: the centre cell (asked at its own centre, 32.075 N 81.105 W -
// Savannah's 32.08 sits on a cell edge), the counts at sample cells,
// the number of covered / echo-free / echoing cells, the tops' median,
// tallest tenth and tallest, and the tallest cell's place. Gate-only:
// install.sh does not ship this file.
export const MRMS_EXPECT = {
  file: 'MRMS_EchoTop_18 2026-09-06 22:06Z (NCEP mrms.ncep.noaa.gov/2D/EchoTop_18/MRMS_EchoTop_18.latest.grib2.gz)',
  rows: 51,
  cols: 51,
  row0: 2267,
  col0: 4864,
  la1: 32.324999999999996,
  lo1: 278.645,
  la2: 31.824999999999996,
  lo2: 279.145,
  d: 0.01,
  centre: {
    lat: 32.075,
    lon: -81.105,
    row: 25,
    col: 25,
    value: 8.0,
    count: 11000,
    near: 'Savannah, 32.08 N 81.10 W (a point on a cell edge; the gate asks at the cell centre)'
  },
  drt: {tmpl: 41, R: -3000.0, E: 0, D: 3, nbits: 16},
  noCoverage: 0,
  noEcho: 125,
  echo: 2476,
  maxKm: 13.0,
  p90Km: 10.571,
  medianKm: 9.4,
  samples: [
    [0, 0, 11750],
    [50, 50, 13000],
    [25, 25, 11000],
    [10, 40, 12250],
    [40, 10, 9875]
  ],
  refTime: '2026-09-06T22:06:40Z',
  tallest: {row: 16, col: 44, km: 13.0}
};
export const ECHOTOP_B64 =
  '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';

// THE RAIN AT A KILOMETRE (179th): the rainiest 51 x 51 window of the
// 07:46Z PrecipRate file, re-packed as its own GRIB2 message, and the
// facts Pillow read from the same counts
export const RATE_EXPECT = {
  file: 'MRMS_PrecipRate.latest.grib2.gz',
  refTime: '2026-09-07T07:46:00Z',
  rows: 51,
  cols: 51,
  row0: 595,
  col0: 2278,
  la1: 49.045,
  lo1: 252.785,
  la2: 48.545,
  lo2: 253.285,
  d: 0.01,
  centre: {lat: 48.795, lon: -106.965, row: 25, col: 25, count: 780, mmh: 75.0},
  drt: {tmpl: 41, R: -30, E: 0, D: 1},
  discipline: 209,
  category: 6,
  number: 1,
  noCoverage: 0,
  zero: 123,
  raining: 2478,
  maxMmH: 89.5,
  medianMmH: 24.7,
  p90MmH: 75.0,
  sumMmH: 79644.7,
  samples: [
    [0, 0, 85],
    [25, 25, 780],
    [50, 50, 30],
    [10, 40, 36],
    [40, 10, 780]
  ],
  nearest: {row: 25, col: 25, mmh: 75.0, distKm: 0.0, bearingDeg: 0.0},
  top: {
    row: 12,
    col: 23,
    mmh: 89.5,
    count: 925,
    distKm: 14.529,
    bearingDeg: 354.2
  },
  scene: 'the rainiest 51 x 51 window of the 07:46Z file, north-east Montana'
};
export const PRECIPRATE_B64 =
  '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';
