/**
 * usgs-fixture.js - REAL USGS instantaneous-values responses
 * (waterservices.usgs.gov, fetched 2026-08-09): the Lees Ferry
 * bounding-box query (three gauges, latest readings verbatim)
 * and the 09380000 P30D series thinned to every 48th row (rows
 * verbatim; the thinning is stated).
 */

export const USGS_BBOX_FIXTURE = {
  value: {
    timeSeries: [
      {
        sourceInfo: {
          siteName: 'COLORADO RIVER AT LEES FERRY, AZ',
          siteCode: [
            {
              value: '09380000',
              network: 'NWIS',
              agencyCode: 'USGS'
            }
          ],
          timeZoneInfo: {
            defaultTimeZone: {
              zoneOffset: '-07:00',
              zoneAbbreviation: 'MST'
            },
            daylightSavingsTimeZone: {
              zoneOffset: '-06:00',
              zoneAbbreviation: 'MDT'
            },
            siteUsesDaylightSavingsTime: false
          },
          geoLocation: {
            geogLocation: {
              srs: 'EPSG:4326',
              latitude: 36.86433333,
              longitude: -111.58787222
            },
            localSiteXY: []
          },
          note: [],
          siteType: [],
          siteProperty: [
            {
              value: 'ST',
              name: 'siteTypeCd'
            },
            {
              value: '140700061105',
              name: 'hucCd'
            },
            {
              value: '04',
              name: 'stateCd'
            },
            {
              value: '04005',
              name: 'countyCd'
            }
          ]
        },
        values: [
          {
            value: [
              {
                value: '8070',
                qualifiers: ['P'],
                dateTime: '2026-08-08T17:00:00.000-07:00'
              }
            ]
          }
        ]
      },
      {
        sourceInfo: {
          siteName: 'PARIA RIVER NEAR KANAB, UTAH',
          siteCode: [
            {
              value: '09381800',
              network: 'NWIS',
              agencyCode: 'USGS'
            }
          ],
          timeZoneInfo: {
            defaultTimeZone: {
              zoneOffset: '-07:00',
              zoneAbbreviation: 'MST'
            },
            daylightSavingsTimeZone: {
              zoneOffset: '-06:00',
              zoneAbbreviation: 'MDT'
            },
            siteUsesDaylightSavingsTime: true
          },
          geoLocation: {
            geogLocation: {
              srs: 'EPSG:4326',
              latitude: 37.10748428,
              longitude: -111.9060102
            },
            localSiteXY: []
          },
          note: [],
          siteType: [],
          siteProperty: [
            {
              value: 'ST',
              name: 'siteTypeCd'
            },
            {
              value: '14070007',
              name: 'hucCd'
            },
            {
              value: '49',
              name: 'stateCd'
            },
            {
              value: '49025',
              name: 'countyCd'
            }
          ]
        },
        values: [
          {
            value: [
              {
                value: '0.52',
                qualifiers: ['P'],
                dateTime: '2026-08-08T18:10:00.000-06:00'
              }
            ]
          }
        ]
      },
      {
        sourceInfo: {
          siteName: 'PARIA RIVER AT LEES FERRY, AZ',
          siteCode: [
            {
              value: '09382000',
              network: 'NWIS',
              agencyCode: 'USGS'
            }
          ],
          timeZoneInfo: {
            defaultTimeZone: {
              zoneOffset: '-07:00',
              zoneAbbreviation: 'MST'
            },
            daylightSavingsTimeZone: {
              zoneOffset: '-06:00',
              zoneAbbreviation: 'MDT'
            },
            siteUsesDaylightSavingsTime: false
          },
          geoLocation: {
            geogLocation: {
              srs: 'EPSG:4326',
              latitude: 36.87221098,
              longitude: -111.59462862
            },
            localSiteXY: []
          },
          note: [],
          siteType: [],
          siteProperty: [
            {
              value: 'ST',
              name: 'siteTypeCd'
            },
            {
              value: '140700070706',
              name: 'hucCd'
            },
            {
              value: '04',
              name: 'stateCd'
            },
            {
              value: '04005',
              name: 'countyCd'
            }
          ]
        },
        values: [
          {
            value: [
              {
                value: '1.80',
                qualifiers: ['P'],
                dateTime: '2026-08-08T17:00:00.000-07:00'
              }
            ]
          }
        ]
      }
    ]
  }
};

export const USGS_P30_FIXTURE = {
  value: {
    timeSeries: [
      {
        sourceInfo: {
          siteName: 'COLORADO RIVER AT LEES FERRY, AZ',
          siteCode: [
            {
              value: '09380000',
              network: 'NWIS',
              agencyCode: 'USGS'
            }
          ],
          timeZoneInfo: {
            defaultTimeZone: {
              zoneOffset: '-07:00',
              zoneAbbreviation: 'MST'
            },
            daylightSavingsTimeZone: {
              zoneOffset: '-06:00',
              zoneAbbreviation: 'MDT'
            },
            siteUsesDaylightSavingsTime: false
          },
          geoLocation: {
            geogLocation: {
              srs: 'EPSG:4326',
              latitude: 36.86433333,
              longitude: -111.58787222
            },
            localSiteXY: []
          },
          note: [],
          siteType: [],
          siteProperty: [
            {
              value: 'ST',
              name: 'siteTypeCd'
            },
            {
              value: '140700061105',
              name: 'hucCd'
            },
            {
              value: '04',
              name: 'stateCd'
            },
            {
              value: '04005',
              name: 'countyCd'
            }
          ]
        },
        values: [
          {
            value: [
              {
                value: '8110',
                qualifiers: ['P'],
                dateTime: '2026-07-09T18:00:00.000-07:00'
              },
              {
                value: '6320',
                qualifiers: ['P'],
                dateTime: '2026-07-10T06:00:00.000-07:00'
              },
              {
                value: '8140',
                qualifiers: ['P'],
                dateTime: '2026-07-10T18:00:00.000-07:00'
              },
              {
                value: '6350',
                qualifiers: ['P'],
                dateTime: '2026-07-11T06:00:00.000-07:00'
              },
              {
                value: '8070',
                qualifiers: ['P'],
                dateTime: '2026-07-11T18:00:00.000-07:00'
              },
              {
                value: '6290',
                qualifiers: ['P'],
                dateTime: '2026-07-12T06:00:00.000-07:00'
              },
              {
                value: '8140',
                qualifiers: ['P'],
                dateTime: '2026-07-12T18:00:00.000-07:00'
              },
              {
                value: '6320',
                qualifiers: ['P'],
                dateTime: '2026-07-13T06:00:00.000-07:00'
              },
              {
                value: '8140',
                qualifiers: ['P'],
                dateTime: '2026-07-13T18:00:00.000-07:00'
              },
              {
                value: '6320',
                qualifiers: ['P'],
                dateTime: '2026-07-14T06:00:00.000-07:00'
              },
              {
                value: '8040',
                qualifiers: ['P'],
                dateTime: '2026-07-14T18:00:00.000-07:00'
              },
              {
                value: '6260',
                qualifiers: ['P'],
                dateTime: '2026-07-15T06:00:00.000-07:00'
              },
              {
                value: '8210',
                qualifiers: ['P'],
                dateTime: '2026-07-15T18:00:00.000-07:00'
              },
              {
                value: '6320',
                qualifiers: ['P'],
                dateTime: '2026-07-16T06:00:00.000-07:00'
              },
              {
                value: '8140',
                qualifiers: ['P'],
                dateTime: '2026-07-16T18:00:00.000-07:00'
              },
              {
                value: '6290',
                qualifiers: ['P'],
                dateTime: '2026-07-17T06:00:00.000-07:00'
              },
              {
                value: '8070',
                qualifiers: ['P'],
                dateTime: '2026-07-17T18:00:00.000-07:00'
              },
              {
                value: '6290',
                qualifiers: ['P'],
                dateTime: '2026-07-18T06:00:00.000-07:00'
              },
              {
                value: '8110',
                qualifiers: ['P'],
                dateTime: '2026-07-18T18:00:00.000-07:00'
              },
              {
                value: '6290',
                qualifiers: ['P'],
                dateTime: '2026-07-19T06:00:00.000-07:00'
              },
              {
                value: '8070',
                qualifiers: ['P'],
                dateTime: '2026-07-19T18:00:00.000-07:00'
              },
              {
                value: '6240',
                qualifiers: ['P'],
                dateTime: '2026-07-20T06:00:00.000-07:00'
              },
              {
                value: '8110',
                qualifiers: ['P'],
                dateTime: '2026-07-20T18:00:00.000-07:00'
              },
              {
                value: '6530',
                qualifiers: ['P'],
                dateTime: '2026-07-21T06:00:00.000-07:00'
              },
              {
                value: '8110',
                qualifiers: ['P'],
                dateTime: '2026-07-21T18:00:00.000-07:00'
              },
              {
                value: '6290',
                qualifiers: ['P'],
                dateTime: '2026-07-22T06:00:00.000-07:00'
              },
              {
                value: '8070',
                qualifiers: ['P'],
                dateTime: '2026-07-22T18:00:00.000-07:00'
              },
              {
                value: '6290',
                qualifiers: ['P'],
                dateTime: '2026-07-23T06:00:00.000-07:00'
              },
              {
                value: '8040',
                qualifiers: ['P'],
                dateTime: '2026-07-23T18:00:00.000-07:00'
              },
              {
                value: '6290',
                qualifiers: ['P'],
                dateTime: '2026-07-24T06:00:00.000-07:00'
              },
              {
                value: '8070',
                qualifiers: ['P'],
                dateTime: '2026-07-24T18:00:00.000-07:00'
              },
              {
                value: '6290',
                qualifiers: ['P'],
                dateTime: '2026-07-25T06:00:00.000-07:00'
              },
              {
                value: '8040',
                qualifiers: ['P'],
                dateTime: '2026-07-25T18:00:00.000-07:00'
              },
              {
                value: '6290',
                qualifiers: ['P'],
                dateTime: '2026-07-26T06:00:00.000-07:00'
              },
              {
                value: '8040',
                qualifiers: ['P'],
                dateTime: '2026-07-26T18:00:00.000-07:00'
              },
              {
                value: '6320',
                qualifiers: ['P'],
                dateTime: '2026-07-27T06:00:00.000-07:00'
              },
              {
                value: '8140',
                qualifiers: ['P'],
                dateTime: '2026-07-27T18:00:00.000-07:00'
              },
              {
                value: '6320',
                qualifiers: ['P'],
                dateTime: '2026-07-28T06:00:00.000-07:00'
              },
              {
                value: '8110',
                qualifiers: ['P'],
                dateTime: '2026-07-28T18:00:00.000-07:00'
              },
              {
                value: '6350',
                qualifiers: ['P'],
                dateTime: '2026-07-29T06:00:00.000-07:00'
              },
              {
                value: '8140',
                qualifiers: ['P'],
                dateTime: '2026-07-29T18:00:00.000-07:00'
              },
              {
                value: '6350',
                qualifiers: ['P'],
                dateTime: '2026-07-30T06:00:00.000-07:00'
              },
              {
                value: '8170',
                qualifiers: ['P'],
                dateTime: '2026-07-30T18:00:00.000-07:00'
              },
              {
                value: '6380',
                qualifiers: ['P'],
                dateTime: '2026-07-31T06:00:00.000-07:00'
              },
              {
                value: '8070',
                qualifiers: ['P'],
                dateTime: '2026-07-31T18:00:00.000-07:00'
              },
              {
                value: '6350',
                qualifiers: ['P'],
                dateTime: '2026-08-01T06:00:00.000-07:00'
              },
              {
                value: '8040',
                qualifiers: ['P'],
                dateTime: '2026-08-01T18:00:00.000-07:00'
              },
              {
                value: '6350',
                qualifiers: ['P'],
                dateTime: '2026-08-02T06:00:00.000-07:00'
              },
              {
                value: '8070',
                qualifiers: ['P'],
                dateTime: '2026-08-02T18:00:00.000-07:00'
              },
              {
                value: '6380',
                qualifiers: ['P'],
                dateTime: '2026-08-03T06:00:00.000-07:00'
              },
              {
                value: '8110',
                qualifiers: ['P'],
                dateTime: '2026-08-03T18:00:00.000-07:00'
              },
              {
                value: '6410',
                qualifiers: ['P'],
                dateTime: '2026-08-04T06:00:00.000-07:00'
              },
              {
                value: '8110',
                qualifiers: ['P'],
                dateTime: '2026-08-04T18:00:00.000-07:00'
              },
              {
                value: '6350',
                qualifiers: ['P'],
                dateTime: '2026-08-05T06:00:00.000-07:00'
              },
              {
                value: '8210',
                qualifiers: ['P'],
                dateTime: '2026-08-05T18:00:00.000-07:00'
              },
              {
                value: '6380',
                qualifiers: ['P'],
                dateTime: '2026-08-06T06:00:00.000-07:00'
              },
              {
                value: '8170',
                qualifiers: ['P'],
                dateTime: '2026-08-06T18:00:00.000-07:00'
              },
              {
                value: '6350',
                qualifiers: ['P'],
                dateTime: '2026-08-07T06:00:00.000-07:00'
              },
              {
                value: '8070',
                qualifiers: ['P'],
                dateTime: '2026-08-07T18:00:00.000-07:00'
              },
              {
                value: '6380',
                qualifiers: ['P'],
                dateTime: '2026-08-08T06:00:00.000-07:00'
              }
            ]
          }
        ]
      }
    ]
  }
};
