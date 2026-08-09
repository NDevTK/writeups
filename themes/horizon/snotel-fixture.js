// Vendored AWDB REST responses for snotel-reference.mjs,
// fetched 2026-08-09 VERBATIM: Red Mountain Pass (713:CO:SNTL,
// San Juan mountains) station row, and its 2026-02-10..12 daily
// SNWD/WTEQ - a mid-winter storm growing the pack 30 -> 34 in.
export const SNOTEL_STATION_ROWS = [
  {
    stationTriplet: '713:CO:SNTL',
    stationId: '713',
    stateCode: 'CO',
    networkCode: 'SNTL',
    name: 'Red Mountain Pass',
    dcoCode: 'CO',
    countyName: 'San Juan',
    huc: '140801040103',
    elevation: 11060.0,
    latitude: 37.89168,
    longitude: -107.71389,
    dataTimeZone: -8.0,
    shefId: 'RMPC2',
    operator: 'NRCS',
    beginDate: '1979-10-01 00:00',
    endDate: '2100-01-01 00:00'
  }
];

export const SNOTEL_FEB_DATA = [
  {
    stationTriplet: '713:CO:SNTL',
    data: [
      {
        stationElement: {
          elementCode: 'SNWD',
          ordinal: 1,
          durationName: 'DAILY',
          dataPrecision: 0,
          storedUnitCode: 'in',
          originalUnitCode: 'in',
          beginDate: '1996-11-05 15:00',
          endDate: '2100-01-01 00:00',
          derivedData: false
        },
        values: [
          {date: '2026-02-10', value: 30},
          {date: '2026-02-11', value: 32},
          {date: '2026-02-12', value: 34}
        ]
      },
      {
        stationElement: {
          elementCode: 'WTEQ',
          ordinal: 1,
          durationName: 'DAILY',
          dataPrecision: 1,
          storedUnitCode: 'in',
          originalUnitCode: 'in',
          beginDate: '1979-10-01 00:00',
          endDate: '2100-01-01 00:00',
          derivedData: false
        },
        values: [
          {date: '2026-02-10', value: 6.7},
          {date: '2026-02-11', value: 6.8},
          {date: '2026-02-12', value: 7.0}
        ]
      }
    ]
  }
];
