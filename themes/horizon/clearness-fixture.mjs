// Live capture of the Open-Meteo satellite radiation API
// (satellite-api.open-meteo.com, keyless, CORS-open),
// 2026-07-10 13:21 UTC, Interlaken: the geostationary
// constellation's observed global horizontal irradiance, hourly.
// Verbatim response body (hourly block). The capture instant
// matters: pickHour must choose the 13:00 row (801 W/m^2), the
// latest at or before the capture.
export const CAPTURE_MS = Date.parse('2026-07-10T13:21:00Z');
export const GHI_FIXTURE = {
  hourly: {
    time: [
      '2026-07-10T00:00',
      '2026-07-10T01:00',
      '2026-07-10T02:00',
      '2026-07-10T03:00',
      '2026-07-10T04:00',
      '2026-07-10T05:00',
      '2026-07-10T06:00',
      '2026-07-10T07:00',
      '2026-07-10T08:00',
      '2026-07-10T09:00',
      '2026-07-10T10:00',
      '2026-07-10T11:00',
      '2026-07-10T12:00',
      '2026-07-10T13:00',
      '2026-07-10T14:00',
      '2026-07-10T15:00',
      '2026-07-10T16:00',
      '2026-07-10T17:00',
      '2026-07-10T18:00',
      '2026-07-10T19:00',
      '2026-07-10T20:00',
      '2026-07-10T21:00',
      '2026-07-10T22:00',
      '2026-07-10T23:00'
    ],
    shortwave_radiation: [
      0.0, 0.0, 0.0, 0.0, 1.0, 62.0, 207.0, 376.0, 548.0, 705.0, 829.0, 895.0,
      868.0, 801.0, 727.0, 570.0, 518.0, 377.0, 208.0, 65.0, 2.0, 0.0, 0.0, 0.0
    ]
  },
  latitude: 46.71353,
  longitude: 7.8387094
};
