// Live VBB HAFAS radar capture (v6.vbb.transport.rest),
// 2026-07-10 07:45 CEST, central Berlin box 52.48..52.55 N,
// 13.35..13.45 E. The full frame held 80 movements (48 S-Bahn,
// 24 buses, 7 trams, 1 regional); this fixture carries a
// VERBATIM subset - the ODEG RE8 (dwelling at Potsdamer Platz,
// its live fix equal to the stop's own coordinates), the first
// 12 S-Bahn, 3 trams and 4 buses (the drop check). Movements are
// untouched; only the selection is ours.
export const CAPTURE_MS = Date.parse('2026-07-10T07:45:30+02:00');
export const RADAR_FIXTURE = {
  movements: [
    {
      direction: 'Elsterwerda, Bahnhof',
      tripId: '1|109294|0|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-r-bahn-re8',
        fahrtNr: null,
        name: 'RE8',
        public: true,
        productName: 'RE',
        mode: 'train',
        product: 'regional',
        operator: {
          type: 'operator',
          id: 'odeg-ostdeutsche-eisenbahn-gmbh',
          name: 'ODEG Ostdeutsche Eisenbahn GmbH'
        }
      },
      location: {
        type: 'location',
        latitude: 52.509355,
        longitude: 13.376551
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900500351',
            name: 'Wismar, Bahnhof',
            location: {
              type: 'location',
              id: '900500351',
              latitude: 53.896822,
              longitude: 11.469409
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: true
            },
            ids: {
              ifopt: 'de:13074:1011'
            },
            stationDHID: 'de:13074:1011'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T04:26:00+02:00',
          plannedDeparture: '2026-07-10T04:26:00+02:00',
          departureDelay: 0,
          departurePlatform: '1',
          departurePrognosisType: null,
          plannedDeparturePlatform: '1'
        },
        {
          stop: {
            type: 'stop',
            id: '900100020',
            name: 'S+U Potsdamer Platz Bhf (Berlin)',
            location: {
              type: 'location',
              id: '900100020',
              latitude: 52.509355,
              longitude: 13.376551
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: true
            },
            ids: {
              ifopt: 'de:11000:900100020'
            },
            stationDHID: 'de:11000:900100020'
          },
          arrival: '2026-07-10T07:45:00+02:00',
          plannedArrival: '2026-07-10T07:45:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '1',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '1',
          departure: '2026-07-10T07:46:00+02:00',
          plannedDeparture: '2026-07-10T07:46:00+02:00',
          departureDelay: 0,
          departurePlatform: '1',
          departurePrognosisType: null,
          plannedDeparturePlatform: '1'
        },
        {
          stop: {
            type: 'stop',
            id: '900058101',
            name: 'S Südkreuz Bhf (Berlin)',
            location: {
              type: 'location',
              id: '900058101',
              latitude: 52.475501,
              longitude: 13.365548
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: true,
              regional: true
            },
            ids: {
              ifopt: 'de:11000:900058101'
            },
            stationDHID: 'de:11000:900058101'
          },
          arrival: '2026-07-10T07:49:00+02:00',
          plannedArrival: '2026-07-10T07:49:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '3',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '3',
          departure: '2026-07-10T07:51:00+02:00',
          plannedDeparture: '2026-07-10T07:51:00+02:00',
          departureDelay: 0,
          departurePlatform: '3',
          departurePrognosisType: null,
          plannedDeparturePlatform: '3'
        },
        {
          stop: {
            type: 'stop',
            id: '900415502',
            name: 'Elsterwerda, Bahnhof',
            location: {
              type: 'location',
              id: '900415502',
              latitude: 51.459801,
              longitude: 13.516414
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: true,
              regional: true
            },
            ids: {
              ifopt: 'de:12062:900415502'
            },
            stationDHID: 'de:12062:900415502'
          },
          arrival: '2026-07-10T09:14:00+02:00',
          plannedArrival: '2026-07-10T09:14:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900100020',
            name: 'S+U Potsdamer Platz Bhf (Berlin)',
            location: {
              type: 'location',
              id: '900100020',
              latitude: 52.509355,
              longitude: 13.376551
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: true
            },
            ids: {
              ifopt: 'de:11000:900100020'
            },
            stationDHID: 'de:11000:900100020'
          },
          destination: {
            type: 'stop',
            id: '900058101',
            name: 'S Südkreuz Bhf (Berlin)',
            location: {
              type: 'location',
              id: '900058101',
              latitude: 52.475501,
              longitude: 13.365548
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: true,
              regional: true
            },
            ids: {
              ifopt: 'de:11000:900058101'
            },
            stationDHID: 'de:11000:900058101'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900100020',
            name: 'S+U Potsdamer Platz Bhf (Berlin)',
            location: {
              type: 'location',
              id: '900100020',
              latitude: 52.509355,
              longitude: 13.376551
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: true
            },
            ids: {
              ifopt: 'de:11000:900100020'
            },
            stationDHID: 'de:11000:900100020'
          },
          destination: {
            type: 'stop',
            id: '900058101',
            name: 'S Südkreuz Bhf (Berlin)',
            location: {
              type: 'location',
              id: '900058101',
              latitude: 52.475501,
              longitude: 13.365548
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: true,
              regional: true
            },
            ids: {
              ifopt: 'de:11000:900058101'
            },
            stationDHID: 'de:11000:900058101'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.37655, 52.50936]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.37218, 52.4917]
            }
          }
        ]
      }
    },
    {
      direction: 'Ringbahn S 42',
      tripId: '1|105628|0|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-s-bahn-s42',
        fahrtNr: null,
        name: 'S42',
        public: true,
        productName: 'S',
        mode: 'train',
        product: 'suburban',
        operator: {
          type: 'operator',
          id: 's-bahn-berlin-gmbh',
          name: 'S-Bahn Berlin GmbH'
        },
        color: {
          fg: '#fff',
          bg: '#cb6318'
        }
      },
      location: {
        type: 'location',
        latitude: 52.536215,
        longitude: 13.344325
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: '2026-07-10T06:47:00+02:00',
          plannedArrival: '2026-07-10T06:47:00+02:00',
          arrivalDelay: null,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T06:48:00+02:00',
          plannedDeparture: '2026-07-10T06:48:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900001201',
            name: 'S+U Westhafen (Berlin)',
            location: {
              type: 'location',
              id: '900001201',
              latitude: 52.536179,
              longitude: 13.343839
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900001201'
            },
            stationDHID: 'de:11000:900001201'
          },
          arrival: '2026-07-10T07:45:00+02:00',
          plannedArrival: '2026-07-10T07:45:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:46:00+02:00',
          plannedDeparture: '2026-07-10T07:46:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: '2026-07-10T07:47:00+02:00',
          plannedArrival: '2026-07-10T07:47:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:48:00+02:00',
          plannedDeparture: '2026-07-10T07:48:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: '2026-07-10T08:47:00+02:00',
          plannedArrival: '2026-07-10T08:47:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900001201',
            name: 'S+U Westhafen (Berlin)',
            location: {
              type: 'location',
              id: '900001201',
              latitude: 52.536179,
              longitude: 13.343839
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900001201'
            },
            stationDHID: 'de:11000:900001201'
          },
          destination: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          destination: {
            type: 'stop',
            id: '900020201',
            name: 'S+U Jungfernheide Bhf (Berlin)',
            location: {
              type: 'location',
              id: '900020201',
              latitude: 52.530452,
              longitude: 13.300125
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: true
            },
            ids: {
              ifopt: 'de:11000:900020201'
            },
            stationDHID: 'de:11000:900020201'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.34433, 52.53622]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.32936, 52.53446]
            }
          }
        ]
      }
    },
    {
      direction: 'Ringbahn S 42',
      tripId: '1|105561|0|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-s-bahn-s42',
        fahrtNr: null,
        name: 'S42',
        public: true,
        productName: 'S',
        mode: 'train',
        product: 'suburban',
        operator: {
          type: 'operator',
          id: 's-bahn-berlin-gmbh',
          name: 'S-Bahn Berlin GmbH'
        },
        color: {
          fg: '#fff',
          bg: '#cb6318'
        }
      },
      location: {
        type: 'location',
        latitude: 52.549213,
        longitude: 13.389891
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900079221',
            name: 'S+U Hermannstr. (Berlin)',
            location: {
              type: 'location',
              id: '900079221',
              latitude: 52.467546,
              longitude: 13.431295
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900079221'
            },
            stationDHID: 'de:11000:900079221'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T05:23:00+02:00',
          plannedDeparture: '2026-07-10T05:21:00+02:00',
          departureDelay: 120,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900007102',
            name: 'S+U Gesundbrunnen Bhf (Berlin)',
            location: {
              type: 'location',
              id: '900007102',
              latitude: 52.548638,
              longitude: 13.388372
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: true,
              regional: true
            },
            ids: {
              ifopt: 'de:11000:900007102'
            },
            stationDHID: 'de:11000:900007102'
          },
          arrival: '2026-07-10T07:45:00+02:00',
          plannedArrival: '2026-07-10T07:45:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:46:00+02:00',
          plannedDeparture: '2026-07-10T07:46:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900009104',
            name: 'S+U Wedding (Berlin)',
            location: {
              type: 'location',
              id: '900009104',
              latitude: 52.542732,
              longitude: 13.366061
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900009104'
            },
            stationDHID: 'de:11000:900009104'
          },
          arrival: '2026-07-10T07:48:00+02:00',
          plannedArrival: '2026-07-10T07:48:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:48:00+02:00',
          plannedDeparture: '2026-07-10T07:48:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: '2026-07-10T07:52:00+02:00',
          plannedArrival: '2026-07-10T07:52:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900007102',
            name: 'S+U Gesundbrunnen Bhf (Berlin)',
            location: {
              type: 'location',
              id: '900007102',
              latitude: 52.548638,
              longitude: 13.388372
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: true,
              regional: true
            },
            ids: {
              ifopt: 'de:11000:900007102'
            },
            stationDHID: 'de:11000:900007102'
          },
          destination: {
            type: 'stop',
            id: '900009104',
            name: 'S+U Wedding (Berlin)',
            location: {
              type: 'location',
              id: '900009104',
              latitude: 52.542732,
              longitude: 13.366061
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900009104'
            },
            stationDHID: 'de:11000:900009104'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900007102',
            name: 'S+U Gesundbrunnen Bhf (Berlin)',
            location: {
              type: 'location',
              id: '900007102',
              latitude: 52.548638,
              longitude: 13.388372
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: true,
              regional: true
            },
            ids: {
              ifopt: 'de:11000:900007102'
            },
            stationDHID: 'de:11000:900007102'
          },
          destination: {
            type: 'stop',
            id: '900009104',
            name: 'S+U Wedding (Berlin)',
            location: {
              type: 'location',
              id: '900009104',
              latitude: 52.542732,
              longitude: 13.366061
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900009104'
            },
            stationDHID: 'de:11000:900009104'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.38989, 52.54922]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.37092, 52.54451]
            }
          }
        ]
      }
    },
    {
      direction: 'Ringbahn S 42',
      tripId: '1|105557|2|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-s-bahn-s42',
        fahrtNr: null,
        name: 'S42',
        public: true,
        productName: 'S',
        mode: 'train',
        product: 'suburban',
        operator: {
          type: 'operator',
          id: 's-bahn-berlin-gmbh',
          name: 'S-Bahn Berlin GmbH'
        },
        color: {
          fg: '#fff',
          bg: '#cb6318'
        }
      },
      location: {
        type: 'location',
        latitude: 52.47267,
        longitude: 13.367769
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900068201',
            name: 'S+U Tempelhof (Berlin)',
            location: {
              type: 'location',
              id: '900068201',
              latitude: 52.470575,
              longitude: 13.3859
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900068201'
            },
            stationDHID: 'de:11000:900068201'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T05:48:00+02:00',
          plannedDeparture: '2026-07-10T05:48:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900058101',
            name: 'S Südkreuz Bhf (Berlin)',
            location: {
              type: 'location',
              id: '900058101',
              latitude: 52.475501,
              longitude: 13.365548
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: true,
              regional: true
            },
            ids: {
              ifopt: 'de:11000:900058101'
            },
            stationDHID: 'de:11000:900058101'
          },
          arrival: '2026-07-10T07:45:00+02:00',
          plannedArrival: '2026-07-10T07:45:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '12',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '12',
          departure: '2026-07-10T07:45:00+02:00',
          plannedDeparture: '2026-07-10T07:45:00+02:00',
          departureDelay: 0,
          departurePlatform: '12',
          departurePrognosisType: null,
          plannedDeparturePlatform: '12'
        },
        {
          stop: {
            type: 'stop',
            id: '900068201',
            name: 'S+U Tempelhof (Berlin)',
            location: {
              type: 'location',
              id: '900068201',
              latitude: 52.470575,
              longitude: 13.3859
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900068201'
            },
            stationDHID: 'de:11000:900068201'
          },
          arrival: '2026-07-10T07:47:00+02:00',
          plannedArrival: '2026-07-10T07:47:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:48:00+02:00',
          plannedDeparture: '2026-07-10T07:48:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: '2026-07-10T08:22:00+02:00',
          plannedArrival: '2026-07-10T08:22:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900058101',
            name: 'S Südkreuz Bhf (Berlin)',
            location: {
              type: 'location',
              id: '900058101',
              latitude: 52.475501,
              longitude: 13.365548
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: true,
              regional: true
            },
            ids: {
              ifopt: 'de:11000:900058101'
            },
            stationDHID: 'de:11000:900058101'
          },
          destination: {
            type: 'stop',
            id: '900068201',
            name: 'S+U Tempelhof (Berlin)',
            location: {
              type: 'location',
              id: '900068201',
              latitude: 52.470575,
              longitude: 13.3859
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900068201'
            },
            stationDHID: 'de:11000:900068201'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900068201',
            name: 'S+U Tempelhof (Berlin)',
            location: {
              type: 'location',
              id: '900068201',
              latitude: 52.470575,
              longitude: 13.3859
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900068201'
            },
            stationDHID: 'de:11000:900068201'
          },
          destination: {
            type: 'stop',
            id: '900079221',
            name: 'S+U Hermannstr. (Berlin)',
            location: {
              type: 'location',
              id: '900079221',
              latitude: 52.467546,
              longitude: 13.431295
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900079221'
            },
            stationDHID: 'de:11000:900079221'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.36777, 52.47267]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.38442, 52.47093]
            }
          }
        ]
      }
    },
    {
      direction: 'Ringbahn S 42',
      tripId: '1|105557|1|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-s-bahn-s42',
        fahrtNr: null,
        name: 'S42',
        public: true,
        productName: 'S',
        mode: 'train',
        product: 'suburban',
        operator: {
          type: 'operator',
          id: 's-bahn-berlin-gmbh',
          name: 'S-Bahn Berlin GmbH'
        },
        color: {
          fg: '#fff',
          bg: '#cb6318'
        }
      },
      location: {
        type: 'location',
        latitude: 52.477686,
        longitude: 13.457166
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900068201',
            name: 'S+U Tempelhof (Berlin)',
            location: {
              type: 'location',
              id: '900068201',
              latitude: 52.470575,
              longitude: 13.3859
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900068201'
            },
            stationDHID: 'de:11000:900068201'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T05:38:00+02:00',
          plannedDeparture: '2026-07-10T05:38:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900077106',
            name: 'S Sonnenallee (Berlin)',
            location: {
              type: 'location',
              id: '900077106',
              latitude: 52.473847,
              longitude: 13.455989
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900077106'
            },
            stationDHID: 'de:11000:900077106'
          },
          arrival: '2026-07-10T07:45:00+02:00',
          plannedArrival: '2026-07-10T07:45:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:45:00+02:00',
          plannedDeparture: '2026-07-10T07:45:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900190001',
            name: 'S Treptower Park (Berlin)',
            location: {
              type: 'location',
              id: '900190001',
              latitude: 52.49383,
              longitude: 13.461823
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: false,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900190001'
            },
            stationDHID: 'de:11000:900190001'
          },
          arrival: '2026-07-10T07:47:00+02:00',
          plannedArrival: '2026-07-10T07:47:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:48:00+02:00',
          plannedDeparture: '2026-07-10T07:48:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: '2026-07-10T08:12:00+02:00',
          plannedArrival: '2026-07-10T08:12:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900077106',
            name: 'S Sonnenallee (Berlin)',
            location: {
              type: 'location',
              id: '900077106',
              latitude: 52.473847,
              longitude: 13.455989
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900077106'
            },
            stationDHID: 'de:11000:900077106'
          },
          destination: {
            type: 'stop',
            id: '900190001',
            name: 'S Treptower Park (Berlin)',
            location: {
              type: 'location',
              id: '900190001',
              latitude: 52.49383,
              longitude: 13.461823
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: false,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900190001'
            },
            stationDHID: 'de:11000:900190001'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900190001',
            name: 'S Treptower Park (Berlin)',
            location: {
              type: 'location',
              id: '900190001',
              latitude: 52.49383,
              longitude: 13.461823
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: false,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900190001'
            },
            stationDHID: 'de:11000:900190001'
          },
          destination: {
            type: 'stop',
            id: '900120003',
            name: 'S Ostkreuz Bhf (Berlin)',
            location: {
              type: 'location',
              id: '900120003',
              latitude: 52.503116,
              longitude: 13.469221
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: true,
              regional: true
            },
            ids: {
              ifopt: 'de:11000:900120003'
            },
            stationDHID: 'de:11000:900120003'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.45717, 52.47769]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.46173, 52.49367]
            }
          }
        ]
      }
    },
    {
      direction: 'Ringbahn S 42',
      tripId: '1|105557|0|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-s-bahn-s42',
        fahrtNr: null,
        name: 'S42',
        public: true,
        productName: 'S',
        mode: 'train',
        product: 'suburban',
        operator: {
          type: 'operator',
          id: 's-bahn-berlin-gmbh',
          name: 'S-Bahn Berlin GmbH'
        },
        color: {
          fg: '#fff',
          bg: '#cb6318'
        }
      },
      location: {
        type: 'location',
        latitude: 52.524708,
        longitude: 13.461859
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900068201',
            name: 'S+U Tempelhof (Berlin)',
            location: {
              type: 'location',
              id: '900068201',
              latitude: 52.470575,
              longitude: 13.3859
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900068201'
            },
            stationDHID: 'de:11000:900068201'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T05:28:00+02:00',
          plannedDeparture: '2026-07-10T05:28:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900110012',
            name: 'S Storkower Str. (Berlin)',
            location: {
              type: 'location',
              id: '900110012',
              latitude: 52.523872,
              longitude: 13.464708
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900110012'
            },
            stationDHID: 'de:11000:900110012'
          },
          arrival: '2026-07-10T07:45:00+02:00',
          plannedArrival: '2026-07-10T07:45:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:45:00+02:00',
          plannedDeparture: '2026-07-10T07:45:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900110004',
            name: 'S Landsberger Allee (Berlin)',
            location: {
              type: 'location',
              id: '900110004',
              latitude: 52.528771,
              longitude: 13.455944
            },
            products: {
              suburban: true,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900110004'
            },
            stationDHID: 'de:11000:900110004'
          },
          arrival: '2026-07-10T07:47:00+02:00',
          plannedArrival: '2026-07-10T07:47:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:47:00+02:00',
          plannedDeparture: '2026-07-10T07:47:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: '2026-07-10T08:02:00+02:00',
          plannedArrival: '2026-07-10T08:02:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900110012',
            name: 'S Storkower Str. (Berlin)',
            location: {
              type: 'location',
              id: '900110012',
              latitude: 52.523872,
              longitude: 13.464708
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900110012'
            },
            stationDHID: 'de:11000:900110012'
          },
          destination: {
            type: 'stop',
            id: '900110004',
            name: 'S Landsberger Allee (Berlin)',
            location: {
              type: 'location',
              id: '900110004',
              latitude: 52.528771,
              longitude: 13.455944
            },
            products: {
              suburban: true,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900110004'
            },
            stationDHID: 'de:11000:900110004'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900110004',
            name: 'S Landsberger Allee (Berlin)',
            location: {
              type: 'location',
              id: '900110004',
              latitude: 52.528771,
              longitude: 13.455944
            },
            products: {
              suburban: true,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900110004'
            },
            stationDHID: 'de:11000:900110004'
          },
          destination: {
            type: 'stop',
            id: '900110003',
            name: 'S Greifswalder Str. (Berlin)',
            location: {
              type: 'location',
              id: '900110003',
              latitude: 52.540727,
              longitude: 13.438352
            },
            products: {
              suburban: true,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900110003'
            },
            stationDHID: 'de:11000:900110003'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.46186, 52.52471]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.45168, 52.53247]
            }
          }
        ]
      }
    },
    {
      direction: 'Ringbahn S 42',
      tripId: '1|105555|0|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-s-bahn-s42',
        fahrtNr: null,
        name: 'S42',
        public: true,
        productName: 'S',
        mode: 'train',
        product: 'suburban',
        operator: {
          type: 'operator',
          id: 's-bahn-berlin-gmbh',
          name: 'S-Bahn Berlin GmbH'
        },
        color: {
          fg: '#fff',
          bg: '#cb6318'
        }
      },
      location: {
        type: 'location',
        latitude: 52.549213,
        longitude: 13.389891
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: '2026-07-10T05:52:00+02:00',
          plannedArrival: '2026-07-10T05:52:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T05:53:00+02:00',
          plannedDeparture: '2026-07-10T05:53:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900007102',
            name: 'S+U Gesundbrunnen Bhf (Berlin)',
            location: {
              type: 'location',
              id: '900007102',
              latitude: 52.548638,
              longitude: 13.388372
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: true,
              regional: true
            },
            ids: {
              ifopt: 'de:11000:900007102'
            },
            stationDHID: 'de:11000:900007102'
          },
          arrival: '2026-07-10T07:45:00+02:00',
          plannedArrival: '2026-07-10T07:45:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:46:00+02:00',
          plannedDeparture: '2026-07-10T07:46:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900009104',
            name: 'S+U Wedding (Berlin)',
            location: {
              type: 'location',
              id: '900009104',
              latitude: 52.542732,
              longitude: 13.366061
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900009104'
            },
            stationDHID: 'de:11000:900009104'
          },
          arrival: '2026-07-10T07:48:00+02:00',
          plannedArrival: '2026-07-10T07:48:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:48:00+02:00',
          plannedDeparture: '2026-07-10T07:48:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: '2026-07-10T07:52:00+02:00',
          plannedArrival: '2026-07-10T07:52:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900007102',
            name: 'S+U Gesundbrunnen Bhf (Berlin)',
            location: {
              type: 'location',
              id: '900007102',
              latitude: 52.548638,
              longitude: 13.388372
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: true,
              regional: true
            },
            ids: {
              ifopt: 'de:11000:900007102'
            },
            stationDHID: 'de:11000:900007102'
          },
          destination: {
            type: 'stop',
            id: '900009104',
            name: 'S+U Wedding (Berlin)',
            location: {
              type: 'location',
              id: '900009104',
              latitude: 52.542732,
              longitude: 13.366061
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900009104'
            },
            stationDHID: 'de:11000:900009104'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900007102',
            name: 'S+U Gesundbrunnen Bhf (Berlin)',
            location: {
              type: 'location',
              id: '900007102',
              latitude: 52.548638,
              longitude: 13.388372
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: true,
              regional: true
            },
            ids: {
              ifopt: 'de:11000:900007102'
            },
            stationDHID: 'de:11000:900007102'
          },
          destination: {
            type: 'stop',
            id: '900009104',
            name: 'S+U Wedding (Berlin)',
            location: {
              type: 'location',
              id: '900009104',
              latitude: 52.542732,
              longitude: 13.366061
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900009104'
            },
            stationDHID: 'de:11000:900009104'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.38989, 52.54922]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.37092, 52.54451]
            }
          }
        ]
      }
    },
    {
      direction: 'Ringbahn S 42',
      tripId: '1|105399|5|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-s-bahn-s42',
        fahrtNr: null,
        name: 'S42',
        public: true,
        productName: 'S',
        mode: 'train',
        product: 'suburban',
        operator: {
          type: 'operator',
          id: 's-bahn-berlin-gmbh',
          name: 'S-Bahn Berlin GmbH'
        },
        color: {
          fg: '#fff',
          bg: '#cb6318'
        }
      },
      location: {
        type: 'location',
        latitude: 52.477973,
        longitude: 13.336612
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T06:28:00+02:00',
          plannedDeparture: '2026-07-10T06:28:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900044202',
            name: 'S+U Bundesplatz (Berlin)',
            location: {
              type: 'location',
              id: '900044202',
              latitude: 52.477668,
              longitude: 13.32863
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900044202'
            },
            stationDHID: 'de:11000:900044202'
          },
          arrival: '2026-07-10T07:45:00+02:00',
          plannedArrival: '2026-07-10T07:44:00+02:00',
          arrivalDelay: 60,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:45:00+02:00',
          plannedDeparture: '2026-07-10T07:45:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900054105',
            name: 'S+U Innsbrucker Platz (Berlin)',
            location: {
              type: 'location',
              id: '900054105',
              latitude: 52.478099,
              longitude: 13.342878
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900054105'
            },
            stationDHID: 'de:11000:900054105'
          },
          arrival: '2026-07-10T07:46:00+02:00',
          plannedArrival: '2026-07-10T07:46:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:47:00+02:00',
          plannedDeparture: '2026-07-10T07:47:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: '2026-07-10T08:27:00+02:00',
          plannedArrival: '2026-07-10T08:27:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900044202',
            name: 'S+U Bundesplatz (Berlin)',
            location: {
              type: 'location',
              id: '900044202',
              latitude: 52.477668,
              longitude: 13.32863
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900044202'
            },
            stationDHID: 'de:11000:900044202'
          },
          destination: {
            type: 'stop',
            id: '900054105',
            name: 'S+U Innsbrucker Platz (Berlin)',
            location: {
              type: 'location',
              id: '900054105',
              latitude: 52.478099,
              longitude: 13.342878
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900054105'
            },
            stationDHID: 'de:11000:900054105'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900054105',
            name: 'S+U Innsbrucker Platz (Berlin)',
            location: {
              type: 'location',
              id: '900054105',
              latitude: 52.478099,
              longitude: 13.342878
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900054105'
            },
            stationDHID: 'de:11000:900054105'
          },
          destination: {
            type: 'stop',
            id: '900054104',
            name: 'S Schöneberg (Berlin)',
            location: {
              type: 'location',
              id: '900054104',
              latitude: 52.479807,
              longitude: 13.352847
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900054104'
            },
            stationDHID: 'de:11000:900054104'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.33661, 52.47798]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.34798, 52.47842]
            }
          }
        ]
      }
    },
    {
      direction: 'Ringbahn S 42',
      tripId: '1|105399|4|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-s-bahn-s42',
        fahrtNr: null,
        name: 'S42',
        public: true,
        productName: 'S',
        mode: 'train',
        product: 'suburban',
        operator: {
          type: 'operator',
          id: 's-bahn-berlin-gmbh',
          name: 'S-Bahn Berlin GmbH'
        },
        color: {
          fg: '#fff',
          bg: '#cb6318'
        }
      },
      location: {
        type: 'location',
        latitude: 52.466773,
        longitude: 13.42512
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T06:18:00+02:00',
          plannedDeparture: '2026-07-10T06:18:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900068201',
            name: 'S+U Tempelhof (Berlin)',
            location: {
              type: 'location',
              id: '900068201',
              latitude: 52.470575,
              longitude: 13.3859
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900068201'
            },
            stationDHID: 'de:11000:900068201'
          },
          arrival: '2026-07-10T07:42:00+02:00',
          plannedArrival: '2026-07-10T07:42:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:43:00+02:00',
          plannedDeparture: '2026-07-10T07:43:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900079221',
            name: 'S+U Hermannstr. (Berlin)',
            location: {
              type: 'location',
              id: '900079221',
              latitude: 52.467546,
              longitude: 13.431295
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900079221'
            },
            stationDHID: 'de:11000:900079221'
          },
          arrival: '2026-07-10T07:46:00+02:00',
          plannedArrival: '2026-07-10T07:46:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:46:00+02:00',
          plannedDeparture: '2026-07-10T07:46:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: '2026-07-10T08:17:00+02:00',
          plannedArrival: '2026-07-10T08:17:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900068201',
            name: 'S+U Tempelhof (Berlin)',
            location: {
              type: 'location',
              id: '900068201',
              latitude: 52.470575,
              longitude: 13.3859
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900068201'
            },
            stationDHID: 'de:11000:900068201'
          },
          destination: {
            type: 'stop',
            id: '900079221',
            name: 'S+U Hermannstr. (Berlin)',
            location: {
              type: 'location',
              id: '900079221',
              latitude: 52.467546,
              longitude: 13.431295
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900079221'
            },
            stationDHID: 'de:11000:900079221'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900079221',
            name: 'S+U Hermannstr. (Berlin)',
            location: {
              type: 'location',
              id: '900079221',
              latitude: 52.467546,
              longitude: 13.431295
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900079221'
            },
            stationDHID: 'de:11000:900079221'
          },
          destination: {
            type: 'stop',
            id: '900078201',
            name: 'S+U Neukölln (Berlin)',
            location: {
              type: 'location',
              id: '900078201',
              latitude: 52.469281,
              longitude: 13.443692
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900078201'
            },
            stationDHID: 'de:11000:900078201'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.42512, 52.46678]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.44118, 52.46915]
            }
          }
        ]
      }
    },
    {
      direction: 'Ringbahn S 42',
      tripId: '1|105399|3|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-s-bahn-s42',
        fahrtNr: null,
        name: 'S42',
        public: true,
        productName: 'S',
        mode: 'train',
        product: 'suburban',
        operator: {
          type: 'operator',
          id: 's-bahn-berlin-gmbh',
          name: 'S-Bahn Berlin GmbH'
        },
        color: {
          fg: '#fff',
          bg: '#cb6318'
        }
      },
      location: {
        type: 'location',
        latitude: 52.503314,
        longitude: 13.469607
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T06:08:00+02:00',
          plannedDeparture: '2026-07-10T06:08:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900120003',
            name: 'S Ostkreuz Bhf (Berlin)',
            location: {
              type: 'location',
              id: '900120003',
              latitude: 52.503116,
              longitude: 13.469221
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: true,
              regional: true
            },
            ids: {
              ifopt: 'de:11000:900120003'
            },
            stationDHID: 'de:11000:900120003'
          },
          arrival: '2026-07-10T07:45:00+02:00',
          plannedArrival: '2026-07-10T07:45:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '12',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '12',
          departure: '2026-07-10T07:46:00+02:00',
          plannedDeparture: '2026-07-10T07:46:00+02:00',
          departureDelay: 0,
          departurePlatform: '12',
          departurePrognosisType: null,
          plannedDeparturePlatform: '12'
        },
        {
          stop: {
            type: 'stop',
            id: '900120001',
            name: 'S+U Frankfurter Allee (Berlin)',
            location: {
              type: 'location',
              id: '900120001',
              latitude: 52.51358,
              longitude: 13.475846
            },
            products: {
              suburban: true,
              subway: true,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900120001'
            },
            stationDHID: 'de:11000:900120001'
          },
          arrival: '2026-07-10T07:48:00+02:00',
          plannedArrival: '2026-07-10T07:48:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:48:00+02:00',
          plannedDeparture: '2026-07-10T07:48:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: '2026-07-10T08:07:00+02:00',
          plannedArrival: '2026-07-10T08:07:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900120003',
            name: 'S Ostkreuz Bhf (Berlin)',
            location: {
              type: 'location',
              id: '900120003',
              latitude: 52.503116,
              longitude: 13.469221
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: true,
              regional: true
            },
            ids: {
              ifopt: 'de:11000:900120003'
            },
            stationDHID: 'de:11000:900120003'
          },
          destination: {
            type: 'stop',
            id: '900120001',
            name: 'S+U Frankfurter Allee (Berlin)',
            location: {
              type: 'location',
              id: '900120001',
              latitude: 52.51358,
              longitude: 13.475846
            },
            products: {
              suburban: true,
              subway: true,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900120001'
            },
            stationDHID: 'de:11000:900120001'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900120003',
            name: 'S Ostkreuz Bhf (Berlin)',
            location: {
              type: 'location',
              id: '900120003',
              latitude: 52.503116,
              longitude: 13.469221
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: true,
              regional: true
            },
            ids: {
              ifopt: 'de:11000:900120003'
            },
            stationDHID: 'de:11000:900120003'
          },
          destination: {
            type: 'stop',
            id: '900120001',
            name: 'S+U Frankfurter Allee (Berlin)',
            location: {
              type: 'location',
              id: '900120001',
              latitude: 52.51358,
              longitude: 13.475846
            },
            products: {
              suburban: true,
              subway: true,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900120001'
            },
            stationDHID: 'de:11000:900120001'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.46961, 52.50332]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.47498, 52.51441]
            }
          }
        ]
      }
    },
    {
      direction: 'Ringbahn S 42',
      tripId: '1|105399|2|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-s-bahn-s42',
        fahrtNr: null,
        name: 'S42',
        public: true,
        productName: 'S',
        mode: 'train',
        product: 'suburban',
        operator: {
          type: 'operator',
          id: 's-bahn-berlin-gmbh',
          name: 'S-Bahn Berlin GmbH'
        },
        color: {
          fg: '#fff',
          bg: '#cb6318'
        }
      },
      location: {
        type: 'location',
        latitude: 52.544143,
        longitude: 13.427781
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T05:58:00+02:00',
          plannedDeparture: '2026-07-10T05:58:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900110003',
            name: 'S Greifswalder Str. (Berlin)',
            location: {
              type: 'location',
              id: '900110003',
              latitude: 52.540727,
              longitude: 13.438352
            },
            products: {
              suburban: true,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900110003'
            },
            stationDHID: 'de:11000:900110003'
          },
          arrival: '2026-07-10T07:44:00+02:00',
          plannedArrival: '2026-07-10T07:44:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:44:00+02:00',
          plannedDeparture: '2026-07-10T07:44:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900110002',
            name: 'S Prenzlauer Allee (Berlin)',
            location: {
              type: 'location',
              id: '900110002',
              latitude: 52.544799,
              longitude: 13.427421
            },
            products: {
              suburban: true,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900110002'
            },
            stationDHID: 'de:11000:900110002'
          },
          arrival: '2026-07-10T07:46:00+02:00',
          plannedArrival: '2026-07-10T07:46:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:46:00+02:00',
          plannedDeparture: '2026-07-10T07:46:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: '2026-07-10T07:57:00+02:00',
          plannedArrival: '2026-07-10T07:57:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900110003',
            name: 'S Greifswalder Str. (Berlin)',
            location: {
              type: 'location',
              id: '900110003',
              latitude: 52.540727,
              longitude: 13.438352
            },
            products: {
              suburban: true,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900110003'
            },
            stationDHID: 'de:11000:900110003'
          },
          destination: {
            type: 'stop',
            id: '900110002',
            name: 'S Prenzlauer Allee (Berlin)',
            location: {
              type: 'location',
              id: '900110002',
              latitude: 52.544799,
              longitude: 13.427421
            },
            products: {
              suburban: true,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900110002'
            },
            stationDHID: 'de:11000:900110002'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900110002',
            name: 'S Prenzlauer Allee (Berlin)',
            location: {
              type: 'location',
              id: '900110002',
              latitude: 52.544799,
              longitude: 13.427421
            },
            products: {
              suburban: true,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900110002'
            },
            stationDHID: 'de:11000:900110002'
          },
          destination: {
            type: 'stop',
            id: '900110001',
            name: 'S+U Schönhauser Allee (Berlin)',
            location: {
              type: 'location',
              id: '900110001',
              latitude: 52.549339,
              longitude: 13.415142
            },
            products: {
              suburban: true,
              subway: true,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900110001'
            },
            stationDHID: 'de:11000:900110001'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.42778, 52.54415]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.41756, 52.5487]
            }
          }
        ]
      }
    },
    {
      direction: 'Ringbahn S 42',
      tripId: '1|105399|1|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-s-bahn-s42',
        fahrtNr: null,
        name: 'S42',
        public: true,
        productName: 'S',
        mode: 'train',
        product: 'suburban',
        operator: {
          type: 'operator',
          id: 's-bahn-berlin-gmbh',
          name: 'S-Bahn Berlin GmbH'
        },
        color: {
          fg: '#fff',
          bg: '#cb6318'
        }
      },
      location: {
        type: 'location',
        latitude: 52.536322,
        longitude: 13.344298
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T05:48:00+02:00',
          plannedDeparture: '2026-07-10T05:48:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900001201',
            name: 'S+U Westhafen (Berlin)',
            location: {
              type: 'location',
              id: '900001201',
              latitude: 52.536179,
              longitude: 13.343839
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900001201'
            },
            stationDHID: 'de:11000:900001201'
          },
          arrival: '2026-07-10T07:45:00+02:00',
          plannedArrival: '2026-07-10T07:45:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:46:00+02:00',
          plannedDeparture: '2026-07-10T07:46:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: '2026-07-10T07:47:00+02:00',
          plannedArrival: '2026-07-10T07:47:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        },
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: '2026-07-10T07:47:00+02:00',
          plannedArrival: '2026-07-10T07:47:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900001201',
            name: 'S+U Westhafen (Berlin)',
            location: {
              type: 'location',
              id: '900001201',
              latitude: 52.536179,
              longitude: 13.343839
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900001201'
            },
            stationDHID: 'de:11000:900001201'
          },
          destination: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900001201',
            name: 'S+U Westhafen (Berlin)',
            location: {
              type: 'location',
              id: '900001201',
              latitude: 52.536179,
              longitude: 13.343839
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900001201'
            },
            stationDHID: 'de:11000:900001201'
          },
          destination: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.3443, 52.53632]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.3443, 52.53632]
            }
          }
        ]
      }
    },
    {
      direction: 'Ringbahn S 42',
      tripId: '1|105376|0|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-s-bahn-s42',
        fahrtNr: null,
        name: 'S42',
        public: true,
        productName: 'S',
        mode: 'train',
        product: 'suburban',
        operator: {
          type: 'operator',
          id: 's-bahn-berlin-gmbh',
          name: 'S-Bahn Berlin GmbH'
        },
        color: {
          fg: '#fff',
          bg: '#cb6318'
        }
      },
      location: {
        type: 'location',
        latitude: 52.506811,
        longitude: 13.282776
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T06:38:00+02:00',
          plannedDeparture: '2026-07-10T06:38:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900024106',
            name: 'S Messe Nord/ZOB (Berlin)',
            location: {
              type: 'location',
              id: '900024106',
              latitude: 52.506622,
              longitude: 13.282884
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900024106'
            },
            stationDHID: 'de:11000:900024106'
          },
          arrival: '2026-07-10T07:45:00+02:00',
          plannedArrival: '2026-07-10T07:45:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: '2026-07-10T07:45:00+02:00',
          plannedDeparture: '2026-07-10T07:45:00+02:00',
          departureDelay: 0,
          departurePlatform: '2',
          departurePrognosisType: null,
          plannedDeparturePlatform: '2'
        },
        {
          stop: {
            type: 'stop',
            id: '900024102',
            name: 'S Westkreuz (Berlin)',
            location: {
              type: 'location',
              id: '900024102',
              latitude: 52.501148,
              longitude: 13.283036
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900024102'
            },
            stationDHID: 'de:11000:900024102'
          },
          arrival: '2026-07-10T07:47:00+02:00',
          plannedArrival: '2026-07-10T07:47:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '12',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '12',
          departure: '2026-07-10T07:47:00+02:00',
          plannedDeparture: '2026-07-10T07:47:00+02:00',
          departureDelay: 0,
          departurePlatform: '12',
          departurePrognosisType: null,
          plannedDeparturePlatform: '12'
        },
        {
          stop: {
            type: 'stop',
            id: '900020202',
            name: 'S Beusselstr. (Berlin)',
            location: {
              type: 'location',
              id: '900020202',
              latitude: 52.534318,
              longitude: 13.328702
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900020202'
            },
            stationDHID: 'de:11000:900020202'
          },
          arrival: '2026-07-10T08:37:00+02:00',
          plannedArrival: '2026-07-10T08:37:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: '2',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: '2',
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900024106',
            name: 'S Messe Nord/ZOB (Berlin)',
            location: {
              type: 'location',
              id: '900024106',
              latitude: 52.506622,
              longitude: 13.282884
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900024106'
            },
            stationDHID: 'de:11000:900024106'
          },
          destination: {
            type: 'stop',
            id: '900024102',
            name: 'S Westkreuz (Berlin)',
            location: {
              type: 'location',
              id: '900024102',
              latitude: 52.501148,
              longitude: 13.283036
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900024102'
            },
            stationDHID: 'de:11000:900024102'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900024102',
            name: 'S Westkreuz (Berlin)',
            location: {
              type: 'location',
              id: '900024102',
              latitude: 52.501148,
              longitude: 13.283036
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900024102'
            },
            stationDHID: 'de:11000:900024102'
          },
          destination: {
            type: 'stop',
            id: '900040101',
            name: 'S Halensee (Berlin)',
            location: {
              type: 'location',
              id: '900040101',
              latitude: 52.496698,
              longitude: 13.290147
            },
            products: {
              suburban: true,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900040101'
            },
            stationDHID: 'de:11000:900040101'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.28278, 52.50681]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.28782, 52.49803]
            }
          }
        ]
      }
    },
    {
      direction: 'Prenzlauer Allee/Ostseestr. -> Bus',
      tripId: '1|104394|11|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-tram-m13',
        fahrtNr: null,
        name: 'M13',
        public: true,
        productName: 'Tram',
        mode: 'train',
        product: 'tram',
        operator: {
          type: 'operator',
          id: 'berliner-verkehrsbetriebe',
          name: 'Berliner Verkehrsbetriebe'
        },
        color: {
          fg: '#fff',
          bg: '#00A092'
        }
      },
      location: {
        type: 'location',
        latitude: 52.509535,
        longitude: 13.451368
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900120021',
            name: 'Revaler Str. (Berlin)',
            location: {
              type: 'location',
              id: '900120021',
              latitude: 52.509535,
              longitude: 13.451368
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: false,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900120021'
            },
            stationDHID: 'de:11000:900120021'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:46:00+02:00',
          plannedDeparture: '2026-07-10T07:46:00+02:00',
          departureDelay: 0,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        },
        {
          stop: {
            type: 'stop',
            id: '900120021',
            name: 'Revaler Str. (Berlin)',
            location: {
              type: 'location',
              id: '900120021',
              latitude: 52.509535,
              longitude: 13.451368
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: false,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900120021'
            },
            stationDHID: 'de:11000:900120021'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:46:00+02:00',
          plannedDeparture: '2026-07-10T07:46:00+02:00',
          departureDelay: 0,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        },
        {
          stop: {
            type: 'stop',
            id: '900120527',
            name: 'Libauer Str. (Berlin)',
            location: {
              type: 'location',
              id: '900120527',
              latitude: 52.51011,
              longitude: 13.454811
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: false,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900120527'
            },
            stationDHID: 'de:11000:900120527'
          },
          arrival: '2026-07-10T07:47:00+02:00',
          plannedArrival: '2026-07-10T07:47:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:47:00+02:00',
          plannedDeparture: '2026-07-10T07:47:00+02:00',
          departureDelay: 0,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        },
        {
          stop: {
            type: 'stop',
            id: '900100024',
            name: 'S+U Alexanderplatz Bhf/Dircksenstr. (Berlin)',
            location: {
              type: 'location',
              id: '900100024',
              latitude: 52.521481,
              longitude: 13.411924
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: false,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900100024'
            },
            stationDHID: 'de:11000:900100024'
          },
          arrival: '2026-07-10T08:35:00+02:00',
          plannedArrival: '2026-07-10T08:35:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: 'Pos. 13',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: 'Pos. 13',
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900120021',
            name: 'Revaler Str. (Berlin)',
            location: {
              type: 'location',
              id: '900120021',
              latitude: 52.509535,
              longitude: 13.451368
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: false,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900120021'
            },
            stationDHID: 'de:11000:900120021'
          },
          destination: {
            type: 'stop',
            id: '900120527',
            name: 'Libauer Str. (Berlin)',
            location: {
              type: 'location',
              id: '900120527',
              latitude: 52.51011,
              longitude: 13.454811
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: false,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900120527'
            },
            stationDHID: 'de:11000:900120527'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900120527',
            name: 'Libauer Str. (Berlin)',
            location: {
              type: 'location',
              id: '900120527',
              latitude: 52.51011,
              longitude: 13.454811
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: false,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900120527'
            },
            stationDHID: 'de:11000:900120527'
          },
          destination: {
            type: 'stop',
            id: '900120529',
            name: 'Wühlischstr./Gärtnerstr. (Berlin)',
            location: {
              type: 'location',
              id: '900120529',
              latitude: 52.508887,
              longitude: 13.460456
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: false,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900120529'
            },
            stationDHID: 'de:11000:900120529'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.45137, 52.50954]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.45798, 52.50942]
            }
          }
        ]
      }
    },
    {
      direction: 'Prenzlauer Allee/Ostseestr. -> Bus',
      tripId: '1|104394|10|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-tram-m13',
        fahrtNr: null,
        name: 'M13',
        public: true,
        productName: 'Tram',
        mode: 'train',
        product: 'tram',
        operator: {
          type: 'operator',
          id: 'berliner-verkehrsbetriebe',
          name: 'Berliner Verkehrsbetriebe'
        },
        color: {
          fg: '#fff',
          bg: '#00A092'
        }
      },
      location: {
        type: 'location',
        latitude: 52.51473,
        longitude: 13.478201
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900120021',
            name: 'Revaler Str. (Berlin)',
            location: {
              type: 'location',
              id: '900120021',
              latitude: 52.509535,
              longitude: 13.451368
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: false,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900120021'
            },
            stationDHID: 'de:11000:900120021'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:36:00+02:00',
          plannedDeparture: '2026-07-10T07:36:00+02:00',
          departureDelay: 0,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        },
        {
          stop: {
            type: 'stop',
            id: '900120001',
            name: 'S+U Frankfurter Allee (Berlin)',
            location: {
              type: 'location',
              id: '900120001',
              latitude: 52.51358,
              longitude: 13.475846
            },
            products: {
              suburban: true,
              subway: true,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900120001'
            },
            stationDHID: 'de:11000:900120001'
          },
          arrival: '2026-07-10T07:45:00+02:00',
          plannedArrival: '2026-07-10T07:44:00+02:00',
          arrivalDelay: 60,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:45:00+02:00',
          plannedDeparture: '2026-07-10T07:44:00+02:00',
          departureDelay: 60,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        },
        {
          stop: {
            type: 'stop',
            id: '900160544',
            name: 'Rathaus Lichtenberg (Berlin)',
            location: {
              type: 'location',
              id: '900160544',
              latitude: 52.515908,
              longitude: 13.479073
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: false,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900160544'
            },
            stationDHID: 'de:11000:900160544'
          },
          arrival: '2026-07-10T07:46:00+02:00',
          plannedArrival: '2026-07-10T07:45:00+02:00',
          arrivalDelay: 60,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:46:00+02:00',
          plannedDeparture: '2026-07-10T07:45:00+02:00',
          departureDelay: 60,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        },
        {
          stop: {
            type: 'stop',
            id: '900100024',
            name: 'S+U Alexanderplatz Bhf/Dircksenstr. (Berlin)',
            location: {
              type: 'location',
              id: '900100024',
              latitude: 52.521481,
              longitude: 13.411924
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: false,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900100024'
            },
            stationDHID: 'de:11000:900100024'
          },
          arrival: '2026-07-10T08:25:00+02:00',
          plannedArrival: '2026-07-10T08:25:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: 'Pos. 13',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: 'Pos. 13',
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900120001',
            name: 'S+U Frankfurter Allee (Berlin)',
            location: {
              type: 'location',
              id: '900120001',
              latitude: 52.51358,
              longitude: 13.475846
            },
            products: {
              suburban: true,
              subway: true,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900120001'
            },
            stationDHID: 'de:11000:900120001'
          },
          destination: {
            type: 'stop',
            id: '900160544',
            name: 'Rathaus Lichtenberg (Berlin)',
            location: {
              type: 'location',
              id: '900160544',
              latitude: 52.515908,
              longitude: 13.479073
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: false,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900160544'
            },
            stationDHID: 'de:11000:900160544'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900160544',
            name: 'Rathaus Lichtenberg (Berlin)',
            location: {
              type: 'location',
              id: '900160544',
              latitude: 52.515908,
              longitude: 13.479073
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: false,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900160544'
            },
            stationDHID: 'de:11000:900160544'
          },
          destination: {
            type: 'stop',
            id: '900160017',
            name: 'Loeperplatz (Berlin)',
            location: {
              type: 'location',
              id: '900160017',
              latitude: 52.52007,
              longitude: 13.479918
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: false,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900160017'
            },
            stationDHID: 'de:11000:900160017'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.4782, 52.51473]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.48021, 52.51988]
            }
          }
        ]
      }
    },
    {
      direction: 'Prenzlauer Allee/Ostseestr. -> Bus',
      tripId: '1|104394|9|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-tram-m13',
        fahrtNr: null,
        name: 'M13',
        public: true,
        productName: 'Tram',
        mode: 'train',
        product: 'tram',
        operator: {
          type: 'operator',
          id: 'berliner-verkehrsbetriebe',
          name: 'Berliner Verkehrsbetriebe'
        },
        color: {
          fg: '#fff',
          bg: '#00A092'
        }
      },
      location: {
        type: 'location',
        latitude: 52.546957,
        longitude: 13.467765
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900120021',
            name: 'Revaler Str. (Berlin)',
            location: {
              type: 'location',
              id: '900120021',
              latitude: 52.509535,
              longitude: 13.451368
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: false,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900120021'
            },
            stationDHID: 'de:11000:900120021'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:26:00+02:00',
          plannedDeparture: '2026-07-10T07:26:00+02:00',
          departureDelay: 0,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        },
        {
          stop: {
            type: 'stop',
            id: '900150518',
            name: 'Betriebshof Indira-Gandhi-Str. (Berlin)',
            location: {
              type: 'location',
              id: '900150518',
              latitude: 52.54435,
              longitude: 13.468637
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900150518'
            },
            stationDHID: 'de:11000:900150518'
          },
          arrival: '2026-07-10T07:45:00+02:00',
          plannedArrival: '2026-07-10T07:46:00+02:00',
          arrivalDelay: -60,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:45:00+02:00',
          plannedDeparture: '2026-07-10T07:46:00+02:00',
          departureDelay: -60,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        },
        {
          stop: {
            type: 'stop',
            id: '900150522',
            name: 'Gounodstr. (Berlin)',
            location: {
              type: 'location',
              id: '900150522',
              latitude: 52.548368,
              longitude: 13.46718
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900150522'
            },
            stationDHID: 'de:11000:900150522'
          },
          arrival: '2026-07-10T07:46:00+02:00',
          plannedArrival: '2026-07-10T07:47:00+02:00',
          arrivalDelay: -60,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:46:00+02:00',
          plannedDeparture: '2026-07-10T07:47:00+02:00',
          departureDelay: -60,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        },
        {
          stop: {
            type: 'stop',
            id: '900100024',
            name: 'S+U Alexanderplatz Bhf/Dircksenstr. (Berlin)',
            location: {
              type: 'location',
              id: '900100024',
              latitude: 52.521481,
              longitude: 13.411924
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: false,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900100024'
            },
            stationDHID: 'de:11000:900100024'
          },
          arrival: '2026-07-10T08:15:00+02:00',
          plannedArrival: '2026-07-10T08:15:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: 'Pos. 13',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: 'Pos. 13',
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900150518',
            name: 'Betriebshof Indira-Gandhi-Str. (Berlin)',
            location: {
              type: 'location',
              id: '900150518',
              latitude: 52.54435,
              longitude: 13.468637
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900150518'
            },
            stationDHID: 'de:11000:900150518'
          },
          destination: {
            type: 'stop',
            id: '900150522',
            name: 'Gounodstr. (Berlin)',
            location: {
              type: 'location',
              id: '900150522',
              latitude: 52.548368,
              longitude: 13.46718
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900150522'
            },
            stationDHID: 'de:11000:900150522'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900150522',
            name: 'Gounodstr. (Berlin)',
            location: {
              type: 'location',
              id: '900150522',
              latitude: 52.548368,
              longitude: 13.46718
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900150522'
            },
            stationDHID: 'de:11000:900150522'
          },
          destination: {
            type: 'stop',
            id: '900140006',
            name: 'Weißer See (Berlin)',
            location: {
              type: 'location',
              id: '900140006',
              latitude: 52.551883,
              longitude: 13.465481
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900140006'
            },
            stationDHID: 'de:11000:900140006'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.46777, 52.54696]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.46617, 52.55127]
            }
          }
        ]
      }
    },
    {
      direction: 'Schmargendorf, Elsterplatz',
      tripId: '1|108909|4|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-bus-249',
        fahrtNr: null,
        name: '249',
        public: true,
        productName: 'Bus',
        mode: 'bus',
        product: 'bus',
        operator: {
          type: 'operator',
          id: 'berliner-verkehrsbetriebe',
          name: 'Berliner Verkehrsbetriebe'
        }
      },
      location: {
        type: 'location',
        latitude: 52.481569,
        longitude: 13.314813
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900004181',
            name: 'Hertzallee (Berlin)',
            location: {
              type: 'location',
              id: '900004181',
              latitude: 52.509229,
              longitude: 13.332612
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900004181'
            },
            stationDHID: 'de:11000:900004181'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:32:00+02:00',
          plannedDeparture: '2026-07-10T07:32:00+02:00',
          departureDelay: 0,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        },
        {
          stop: {
            type: 'stop',
            id: '900044151',
            name: 'Brabanter Platz (Berlin)',
            location: {
              type: 'location',
              id: '900044151',
              latitude: 52.48183,
              longitude: 13.315892
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900044151'
            },
            stationDHID: 'de:11000:900044151'
          },
          arrival: '2026-07-10T07:45:00+02:00',
          plannedArrival: '2026-07-10T07:47:00+02:00',
          arrivalDelay: -120,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:45:00+02:00',
          plannedDeparture: '2026-07-10T07:47:00+02:00',
          departureDelay: -120,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        },
        {
          stop: {
            type: 'stop',
            id: '900045102',
            name: 'S+U Heidelberger Platz (Berlin)',
            location: {
              type: 'location',
              id: '900045102',
              latitude: 52.480122,
              longitude: 13.312287
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900045102'
            },
            stationDHID: 'de:11000:900045102'
          },
          arrival: '2026-07-10T07:47:00+02:00',
          plannedArrival: '2026-07-10T07:49:00+02:00',
          arrivalDelay: -120,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:47:00+02:00',
          plannedDeparture: '2026-07-10T07:49:00+02:00',
          departureDelay: -120,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        },
        {
          stop: {
            type: 'stop',
            id: '900045172',
            name: 'S+U Heidelberger Platz (Berlin) [Barstr.]',
            location: {
              type: 'location',
              id: '900045172',
              latitude: 52.480877,
              longitude: 13.313474
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900045172'
            },
            stationDHID: 'de:11000:900045172'
          },
          arrival: '2026-07-10T08:04:00+02:00',
          plannedArrival: '2026-07-10T08:04:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900044151',
            name: 'Brabanter Platz (Berlin)',
            location: {
              type: 'location',
              id: '900044151',
              latitude: 52.48183,
              longitude: 13.315892
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900044151'
            },
            stationDHID: 'de:11000:900044151'
          },
          destination: {
            type: 'stop',
            id: '900045102',
            name: 'S+U Heidelberger Platz (Berlin)',
            location: {
              type: 'location',
              id: '900045102',
              latitude: 52.480122,
              longitude: 13.312287
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900045102'
            },
            stationDHID: 'de:11000:900045102'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900045102',
            name: 'S+U Heidelberger Platz (Berlin)',
            location: {
              type: 'location',
              id: '900045102',
              latitude: 52.480122,
              longitude: 13.312287
            },
            products: {
              suburban: true,
              subway: true,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900045102'
            },
            stationDHID: 'de:11000:900045102'
          },
          destination: {
            type: 'stop',
            id: '900045156',
            name: 'Mecklenburgische Str./Binger Str. (Berlin)',
            location: {
              type: 'location',
              id: '900045156',
              latitude: 52.478243,
              longitude: 13.308889
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900045156'
            },
            stationDHID: 'de:11000:900045156'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.31481, 52.48157]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.31036, 52.47918]
            }
          }
        ]
      }
    },
    {
      direction: 'Elsterplatz -> 249 Schmargendorf Kirche',
      tripId: '1|108831|5|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-bus-215',
        fahrtNr: null,
        name: '215',
        public: true,
        productName: 'Bus',
        mode: 'bus',
        product: 'bus',
        operator: {
          type: 'operator',
          id: 'berliner-verkehrsbetriebe',
          name: 'Berliner Verkehrsbetriebe'
        }
      },
      location: {
        type: 'location',
        latitude: 52.482028,
        longitude: 13.290524
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900045172',
            name: 'S+U Heidelberger Platz (Berlin) [Barstr.]',
            location: {
              type: 'location',
              id: '900045172',
              latitude: 52.480877,
              longitude: 13.313474
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900045172'
            },
            stationDHID: 'de:11000:900045172'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:40:00+02:00',
          plannedDeparture: '2026-07-10T07:40:00+02:00',
          departureDelay: 0,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        },
        {
          stop: {
            type: 'stop',
            id: '900046153',
            name: 'Cunostr. (Berlin)',
            location: {
              type: 'location',
              id: '900046153',
              latitude: 52.481156,
              longitude: 13.295801
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900046153'
            },
            stationDHID: 'de:11000:900046153'
          },
          arrival: '2026-07-10T07:44:00+02:00',
          plannedArrival: '2026-07-10T07:44:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:44:00+02:00',
          plannedDeparture: '2026-07-10T07:44:00+02:00',
          departureDelay: 0,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        },
        {
          stop: {
            type: 'stop',
            id: '900046151',
            name: 'Forckenbeckstr. (Berlin)',
            location: {
              type: 'location',
              id: '900046151',
              latitude: 52.481938,
              longitude: 13.289688
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900046151'
            },
            stationDHID: 'de:11000:900046151'
          },
          arrival: '2026-07-10T07:46:00+02:00',
          plannedArrival: '2026-07-10T07:46:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:46:00+02:00',
          plannedDeparture: '2026-07-10T07:46:00+02:00',
          departureDelay: 0,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        },
        {
          stop: {
            type: 'stop',
            id: '900004181',
            name: 'Hertzallee (Berlin)',
            location: {
              type: 'location',
              id: '900004181',
              latitude: 52.509229,
              longitude: 13.332612
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900004181'
            },
            stationDHID: 'de:11000:900004181'
          },
          arrival: '2026-07-10T08:13:00+02:00',
          plannedArrival: '2026-07-10T08:13:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900046153',
            name: 'Cunostr. (Berlin)',
            location: {
              type: 'location',
              id: '900046153',
              latitude: 52.481156,
              longitude: 13.295801
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900046153'
            },
            stationDHID: 'de:11000:900046153'
          },
          destination: {
            type: 'stop',
            id: '900046151',
            name: 'Forckenbeckstr. (Berlin)',
            location: {
              type: 'location',
              id: '900046151',
              latitude: 52.481938,
              longitude: 13.289688
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900046151'
            },
            stationDHID: 'de:11000:900046151'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900046273',
            name: 'Elsterplatz (Berlin) [Berkaer Str.]',
            location: {
              type: 'location',
              id: '900046273',
              latitude: 52.479295,
              longitude: 13.285742
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900046273'
            },
            stationDHID: 'de:11000:900046273'
          },
          destination: {
            type: 'stop',
            id: '900046251',
            name: 'Rathaus Schmargendorf (Berlin)',
            location: {
              type: 'location',
              id: '900046251',
              latitude: 52.477389,
              longitude: 13.287846
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900046251'
            },
            stationDHID: 'de:11000:900046251'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.29052, 52.48203]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.28691, 52.47816]
            }
          }
        ]
      }
    },
    {
      direction: 'S+U Zoologischer Garten',
      tripId: '1|108831|4|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-bus-249',
        fahrtNr: null,
        name: '249',
        public: true,
        productName: 'Bus',
        mode: 'bus',
        product: 'bus',
        operator: {
          type: 'operator',
          id: 'berliner-verkehrsbetriebe',
          name: 'Berliner Verkehrsbetriebe'
        }
      },
      location: {
        type: 'location',
        latitude: 52.498298,
        longitude: 13.32454
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900045172',
            name: 'S+U Heidelberger Platz (Berlin) [Barstr.]',
            location: {
              type: 'location',
              id: '900045172',
              latitude: 52.480877,
              longitude: 13.313474
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900045172'
            },
            stationDHID: 'de:11000:900045172'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:20:00+02:00',
          plannedDeparture: '2026-07-10T07:20:00+02:00',
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        },
        {
          stop: {
            type: 'stop',
            id: '900023352',
            name: 'Pariser Str. (Berlin)',
            location: {
              type: 'location',
              id: '900023352',
              latitude: 52.497912,
              longitude: 13.324423
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900023352'
            },
            stationDHID: 'de:11000:900023352'
          },
          arrival: '2026-07-10T07:45:00+02:00',
          plannedArrival: '2026-07-10T07:45:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:45:00+02:00',
          plannedDeparture: '2026-07-10T07:45:00+02:00',
          departureDelay: 0,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        },
        {
          stop: {
            type: 'stop',
            id: '900023305',
            name: 'Lietzenburger Str./Uhlandstr. (Berlin)',
            location: {
              type: 'location',
              id: '900023305',
              latitude: 52.500024,
              longitude: 13.325456
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900023305'
            },
            stationDHID: 'de:11000:900023305'
          },
          arrival: '2026-07-10T07:47:00+02:00',
          plannedArrival: '2026-07-10T07:47:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:47:00+02:00',
          plannedDeparture: '2026-07-10T07:47:00+02:00',
          departureDelay: 0,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        },
        {
          stop: {
            type: 'stop',
            id: '900004181',
            name: 'Hertzallee (Berlin)',
            location: {
              type: 'location',
              id: '900004181',
              latitude: 52.509229,
              longitude: 13.332612
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900004181'
            },
            stationDHID: 'de:11000:900004181'
          },
          arrival: '2026-07-10T07:53:00+02:00',
          plannedArrival: '2026-07-10T07:53:00+02:00',
          arrivalDelay: 0,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900023352',
            name: 'Pariser Str. (Berlin)',
            location: {
              type: 'location',
              id: '900023352',
              latitude: 52.497912,
              longitude: 13.324423
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900023352'
            },
            stationDHID: 'de:11000:900023352'
          },
          destination: {
            type: 'stop',
            id: '900023305',
            name: 'Lietzenburger Str./Uhlandstr. (Berlin)',
            location: {
              type: 'location',
              id: '900023305',
              latitude: 52.500024,
              longitude: 13.325456
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900023305'
            },
            stationDHID: 'de:11000:900023305'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900023305',
            name: 'Lietzenburger Str./Uhlandstr. (Berlin)',
            location: {
              type: 'location',
              id: '900023305',
              latitude: 52.500024,
              longitude: 13.325456
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900023305'
            },
            stationDHID: 'de:11000:900023305'
          },
          destination: {
            type: 'stop',
            id: '900023354',
            name: 'Friedrich-Hollaender-Platz (Berlin)',
            location: {
              type: 'location',
              id: '900023354',
              latitude: 52.500446,
              longitude: 13.330733
            },
            products: {
              suburban: false,
              subway: false,
              tram: false,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900023354'
            },
            stationDHID: 'de:11000:900023354'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.32454, 52.4983]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.32943, 52.50032]
            }
          }
        ]
      }
    },
    {
      direction: 'Wilhelmsruh, Fontanestr.',
      tripId: '1|108459|7|86|10072026',
      line: {
        type: 'line',
        id: 'de-vbb-11000000-bus-155',
        fahrtNr: null,
        name: '155',
        public: true,
        productName: 'Bus',
        mode: 'bus',
        product: 'bus',
        operator: {
          type: 'operator',
          id: 'berliner-verkehrsbetriebe',
          name: 'Berliner Verkehrsbetriebe'
        }
      },
      location: {
        type: 'location',
        latitude: 52.569142,
        longitude: 13.411528
      },
      nextStopovers: [
        {
          stop: {
            type: 'stop',
            id: '900130002',
            name: 'S+U Pankow (Berlin)',
            location: {
              type: 'location',
              id: '900130002',
              latitude: 52.567281,
              longitude: 13.412283
            },
            products: {
              suburban: true,
              subway: true,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900130002'
            },
            stationDHID: 'de:11000:900130002'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:45:00+02:00',
          plannedDeparture: '2026-07-10T07:45:00+02:00',
          departureDelay: null,
          departurePlatform: 'Pos. 4',
          departurePrognosisType: null,
          plannedDeparturePlatform: 'Pos. 4'
        },
        {
          stop: {
            type: 'stop',
            id: '900130002',
            name: 'S+U Pankow (Berlin)',
            location: {
              type: 'location',
              id: '900130002',
              latitude: 52.567281,
              longitude: 13.412283
            },
            products: {
              suburban: true,
              subway: true,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900130002'
            },
            stationDHID: 'de:11000:900130002'
          },
          arrival: null,
          plannedArrival: null,
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: '2026-07-10T07:45:00+02:00',
          plannedDeparture: '2026-07-10T07:45:00+02:00',
          departureDelay: null,
          departurePlatform: 'Pos. 4',
          departurePrognosisType: null,
          plannedDeparturePlatform: 'Pos. 4'
        },
        {
          stop: {
            type: 'stop',
            id: '900130013',
            name: 'Pankow Kirche (Berlin)',
            location: {
              type: 'location',
              id: '900130013',
              latitude: 52.570769,
              longitude: 13.410135
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900130013'
            },
            stationDHID: 'de:11000:900130013'
          },
          arrival: '2026-07-10T07:46:00+02:00',
          plannedArrival: '2026-07-10T07:46:00+02:00',
          arrivalDelay: null,
          arrivalPlatform: 'Pos. 5',
          arrivalPrognosisType: null,
          plannedArrivalPlatform: 'Pos. 5',
          departure: '2026-07-10T07:46:00+02:00',
          plannedDeparture: '2026-07-10T07:46:00+02:00',
          departureDelay: null,
          departurePlatform: 'Pos. 5',
          departurePrognosisType: null,
          plannedDeparturePlatform: 'Pos. 5'
        },
        {
          stop: {
            type: 'stop',
            id: '900130512',
            name: 'Masurenstr. (Berlin)',
            location: {
              type: 'location',
              id: '900130512',
              latitude: 52.563569,
              longitude: 13.413164
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900130512'
            },
            stationDHID: 'de:11000:900130512'
          },
          arrival: '2026-07-10T08:29:00+02:00',
          plannedArrival: '2026-07-10T08:29:00+02:00',
          arrivalDelay: null,
          arrivalPlatform: null,
          arrivalPrognosisType: null,
          plannedArrivalPlatform: null,
          departure: null,
          plannedDeparture: null,
          departureDelay: null,
          departurePlatform: null,
          departurePrognosisType: null,
          plannedDeparturePlatform: null
        }
      ],
      frames: [
        {
          origin: {
            type: 'stop',
            id: '900130002',
            name: 'S+U Pankow (Berlin)',
            location: {
              type: 'location',
              id: '900130002',
              latitude: 52.567281,
              longitude: 13.412283
            },
            products: {
              suburban: true,
              subway: true,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900130002'
            },
            stationDHID: 'de:11000:900130002'
          },
          destination: {
            type: 'stop',
            id: '900130013',
            name: 'Pankow Kirche (Berlin)',
            location: {
              type: 'location',
              id: '900130013',
              latitude: 52.570769,
              longitude: 13.410135
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900130013'
            },
            stationDHID: 'de:11000:900130013'
          },
          t: 0
        },
        {
          origin: {
            type: 'stop',
            id: '900130013',
            name: 'Pankow Kirche (Berlin)',
            location: {
              type: 'location',
              id: '900130013',
              latitude: 52.570769,
              longitude: 13.410135
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900130013'
            },
            stationDHID: 'de:11000:900130013'
          },
          destination: {
            type: 'stop',
            id: '900130501',
            name: 'Rathaus Pankow (Berlin)',
            location: {
              type: 'location',
              id: '900130501',
              latitude: 52.569385,
              longitude: 13.403456
            },
            products: {
              suburban: false,
              subway: false,
              tram: true,
              bus: true,
              ferry: false,
              express: false,
              regional: false
            },
            ids: {
              ifopt: 'de:11000:900130501'
            },
            stationDHID: 'de:11000:900130501'
          },
          t: 120000
        }
      ],
      polyline: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.41153, 52.56914]
            }
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [13.40523, 52.56989]
            }
          }
        ]
      }
    }
  ],
  realtimeDataUpdatedAt: 1783662294
};
