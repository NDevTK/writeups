// Captured Swiss open transport API response (2026-07-10,
// transport.opendata.ch/v1/stationboard?station=Interlaken
// Ost&limit=12 - keyless, CORS-open): 14 real departures with
// their metadata - category (IC/ICE/RE/R/PE), number,
// operator (SBB, BLS, ZB Zentralbahn, BOB Berner
// Oberland-Bahn), real-time delay, and the passList of stops
// each train calls at (WGS84 coordinates + arrival/departure
// timestamps) - everything the position interpolation and
// the consist ladder consume. Trimmed to those fields.
export const BOARD_FIXTURE = {
  station: {
    name: 'Interlaken Ost',
    coordinate: {type: 'WGS84', x: 46.690492, y: 7.868992}
  },
  stationboard: [
    {
      category: 'IC',
      number: '61',
      operator: 'SBB',
      to: 'Basel SBB',
      name: '000956',
      stop: {departure: '2026-07-10T04:56:00+0200', delay: 0},
      passList: [
        {
          station: {name: null, coordinate: {x: null, y: null}},
          arrival: null,
          departure: '2026-07-10T04:56:00+0200',
          delay: 0
        },
        {
          station: {
            name: 'Interlaken West',
            coordinate: {x: 46.682623, y: 7.85144}
          },
          arrival: '2026-07-10T05:00:00+0200',
          departure: '2026-07-10T05:01:00+0200',
          delay: 0
        },
        {
          station: {name: 'Spiez', coordinate: {x: 46.686389, y: 7.680098}},
          arrival: '2026-07-10T05:17:00+0200',
          departure: '2026-07-10T05:18:00+0200',
          delay: 0
        },
        {
          station: {name: 'Thun', coordinate: {x: 46.754841, y: 7.629595}},
          arrival: '2026-07-10T05:27:00+0200',
          departure: '2026-07-10T05:29:00+0200',
          delay: 0
        },
        {
          station: {name: 'Münsingen', coordinate: {x: 46.873343, y: 7.559433}},
          arrival: '2026-07-10T05:38:00+0200',
          departure: '2026-07-10T05:39:00+0200',
          delay: 0
        },
        {
          station: {name: 'Bern', coordinate: {x: 46.948823, y: 7.439123}},
          arrival: '2026-07-10T05:53:00+0200',
          departure: '2026-07-10T06:04:00+0200',
          delay: 1
        },
        {
          station: {
            name: 'Bahn-2000-Strecke',
            coordinate: {x: 47.196371, y: 7.689354}
          },
          arrival: null,
          departure: null,
          delay: null
        },
        {
          station: {name: 'Olten', coordinate: {x: 47.351927, y: 7.907693}},
          arrival: '2026-07-10T06:31:00+0200',
          departure: '2026-07-10T06:33:00+0200',
          delay: 0
        },
        {
          station: {name: 'Liestal', coordinate: {x: 47.484453, y: 7.731377}},
          arrival: '2026-07-10T06:53:00+0200',
          departure: '2026-07-10T06:55:00+0200',
          delay: 0
        },
        {
          station: {name: 'Basel SBB', coordinate: {x: 47.547403, y: 7.589564}},
          arrival: '2026-07-10T07:05:00+0200',
          departure: null,
          delay: 0
        }
      ]
    },
    {
      category: 'RE',
      number: '9',
      operator: 'BLS-bls',
      to: 'Spiez',
      name: '004207',
      stop: {departure: '2026-07-10T05:30:00+0200', delay: null},
      passList: [
        {
          station: {name: null, coordinate: {x: null, y: null}},
          arrival: null,
          departure: '2026-07-10T05:30:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Interlaken West',
            coordinate: {x: 46.682623, y: 7.85144}
          },
          arrival: '2026-07-10T05:33:00+0200',
          departure: '2026-07-10T05:34:00+0200',
          delay: null
        },
        {
          station: {name: 'Spiez', coordinate: {x: 46.686389, y: 7.680098}},
          arrival: '2026-07-10T05:49:00+0200',
          departure: null,
          delay: null
        }
      ]
    },
    {
      category: 'R',
      number: '70',
      operator: 'ZB',
      to: 'Meiringen',
      name: '009057',
      stop: {departure: '2026-07-10T05:57:00+0200', delay: null},
      passList: [
        {
          station: {name: null, coordinate: {x: null, y: null}},
          arrival: null,
          departure: '2026-07-10T05:57:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Ringgenberg',
            coordinate: {x: 46.703847, y: 7.899814}
          },
          arrival: '2026-07-10T06:00:00+0200',
          departure: '2026-07-10T06:00:00+0200',
          delay: null
        },
        {
          station: {name: 'Niederried', coordinate: {x: 46.71642, y: 7.928683}},
          arrival: '2026-07-10T06:03:00+0200',
          departure: '2026-07-10T06:03:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Oberried am Brienzersee',
            coordinate: {x: 46.736544, y: 7.95892}
          },
          arrival: '2026-07-10T06:08:00+0200',
          departure: '2026-07-10T06:08:00+0200',
          delay: null
        },
        {
          station: {name: 'Ebligen', coordinate: {x: 46.752617, y: 7.990028}},
          arrival: '2026-07-10T06:11:00+0200',
          departure: '2026-07-10T06:11:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Brienz West',
            coordinate: {x: 46.757306, y: 8.020377}
          },
          arrival: '2026-07-10T06:15:00+0200',
          departure: '2026-07-10T06:15:00+0200',
          delay: null
        },
        {
          station: {name: 'Brienz', coordinate: {x: 46.754835, y: 8.038937}},
          arrival: '2026-07-10T06:18:00+0200',
          departure: '2026-07-10T06:19:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Brienzwiler',
            coordinate: {x: 46.745673, y: 8.090618}
          },
          arrival: '2026-07-10T06:23:00+0200',
          departure: '2026-07-10T06:23:00+0200',
          delay: null
        },
        {
          station: {name: 'Meiringen', coordinate: {x: 46.727324, y: 8.184247}},
          arrival: '2026-07-10T06:30:00+0200',
          departure: null,
          delay: null
        }
      ]
    },
    {
      category: 'ICE',
      number: '000374',
      operator: 'SBB',
      to: 'Basel Bad Bf',
      name: '000374',
      stop: {departure: '2026-07-10T05:59:00+0200', delay: null},
      passList: [
        {
          station: {name: null, coordinate: {x: null, y: null}},
          arrival: null,
          departure: '2026-07-10T05:59:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Interlaken West',
            coordinate: {x: 46.682623, y: 7.85144}
          },
          arrival: '2026-07-10T06:03:00+0200',
          departure: '2026-07-10T06:04:00+0200',
          delay: null
        },
        {
          station: {name: 'Spiez', coordinate: {x: 46.686389, y: 7.680098}},
          arrival: '2026-07-10T06:23:00+0200',
          departure: '2026-07-10T06:23:00+0200',
          delay: null
        },
        {
          station: {name: 'Thun', coordinate: {x: 46.754841, y: 7.629595}},
          arrival: '2026-07-10T06:34:00+0200',
          departure: '2026-07-10T06:34:00+0200',
          delay: null
        },
        {
          station: {name: 'Bern', coordinate: {x: 46.948823, y: 7.439123}},
          arrival: '2026-07-10T06:56:00+0200',
          departure: '2026-07-10T07:04:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Bahn-2000-Strecke',
            coordinate: {x: 47.196371, y: 7.689354}
          },
          arrival: null,
          departure: null,
          delay: null
        },
        {
          station: {name: 'Olten', coordinate: {x: 47.351927, y: 7.907693}},
          arrival: '2026-07-10T07:30:00+0200',
          departure: '2026-07-10T07:33:00+0200',
          delay: null
        },
        {
          station: {name: 'Liestal', coordinate: {x: 47.484453, y: 7.731377}},
          arrival: '2026-07-10T07:53:00+0200',
          departure: '2026-07-10T07:54:00+0200',
          delay: null
        },
        {
          station: {name: 'Basel SBB', coordinate: {x: 47.547403, y: 7.589564}},
          arrival: '2026-07-10T08:04:00+0200',
          departure: '2026-07-10T08:16:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Basel Bad Bf',
            coordinate: {x: 47.567301, y: 7.606922}
          },
          arrival: '2026-07-10T08:23:00+0200',
          departure: null,
          delay: null
        }
      ]
    },
    {
      category: 'R',
      number: '62',
      operator: 'BOB',
      to: 'Lauterbrunnen',
      name: '000135',
      stop: {departure: '2026-07-10T06:02:00+0200', delay: null},
      passList: [
        {
          station: {name: null, coordinate: {x: null, y: null}},
          arrival: null,
          departure: '2026-07-10T06:02:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Matten b. Interlaken',
            coordinate: {x: 46.674123, y: 7.872847}
          },
          arrival: '2026-07-10T06:04:00+0200',
          departure: '2026-07-10T06:05:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Wilderswil',
            coordinate: {x: 46.665689, y: 7.869461}
          },
          arrival: '2026-07-10T06:07:00+0200',
          departure: '2026-07-10T06:08:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Zweilütschinen',
            coordinate: {x: 46.632692, y: 7.89969}
          },
          arrival: '2026-07-10T06:14:00+0200',
          departure: '2026-07-10T06:15:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Lauterbrunnen',
            coordinate: {x: 46.59842, y: 7.908077}
          },
          arrival: '2026-07-10T06:24:00+0200',
          departure: null,
          delay: null
        }
      ]
    },
    {
      category: 'R',
      number: '61',
      operator: 'BOB',
      to: 'Grindelwald',
      name: '000235',
      stop: {departure: '2026-07-10T06:02:00+0200', delay: null},
      passList: [
        {
          station: {name: null, coordinate: {x: null, y: null}},
          arrival: null,
          departure: '2026-07-10T06:02:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Matten b. Interlaken',
            coordinate: {x: 46.674123, y: 7.872847}
          },
          arrival: '2026-07-10T06:04:00+0200',
          departure: '2026-07-10T06:05:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Wilderswil',
            coordinate: {x: 46.665689, y: 7.869461}
          },
          arrival: '2026-07-10T06:07:00+0200',
          departure: '2026-07-10T06:08:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Zweilütschinen',
            coordinate: {x: 46.632692, y: 7.89969}
          },
          arrival: '2026-07-10T06:14:00+0200',
          departure: '2026-07-10T06:16:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Lütschental',
            coordinate: {x: 46.637087, y: 7.948977}
          },
          arrival: '2026-07-10T06:20:00+0200',
          departure: '2026-07-10T06:20:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Burglauenen',
            coordinate: {x: 46.635896, y: 7.97532}
          },
          arrival: '2026-07-10T06:25:00+0200',
          departure: '2026-07-10T06:26:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Schwendi bei Grindelwald',
            coordinate: {x: 46.630463, y: 8.003068}
          },
          arrival: '2026-07-10T06:28:00+0200',
          departure: '2026-07-10T06:29:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Grindelwald Terminal',
            coordinate: {x: 46.625499, y: 8.017105}
          },
          arrival: '2026-07-10T06:32:00+0200',
          departure: '2026-07-10T06:33:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Grindelwald',
            coordinate: {x: 46.624345, y: 8.033296}
          },
          arrival: '2026-07-10T06:38:00+0200',
          departure: null,
          delay: null
        }
      ]
    },
    {
      category: 'R',
      number: '70',
      operator: 'ZB',
      to: 'Meiringen',
      name: '009059',
      stop: {departure: '2026-07-10T06:27:00+0200', delay: null},
      passList: [
        {
          station: {name: null, coordinate: {x: null, y: null}},
          arrival: null,
          departure: '2026-07-10T06:27:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Ringgenberg',
            coordinate: {x: 46.703847, y: 7.899814}
          },
          arrival: '2026-07-10T06:30:00+0200',
          departure: '2026-07-10T06:30:00+0200',
          delay: null
        },
        {
          station: {name: 'Niederried', coordinate: {x: 46.71642, y: 7.928683}},
          arrival: '2026-07-10T06:33:00+0200',
          departure: '2026-07-10T06:33:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Oberried am Brienzersee',
            coordinate: {x: 46.736544, y: 7.95892}
          },
          arrival: '2026-07-10T06:38:00+0200',
          departure: '2026-07-10T06:38:00+0200',
          delay: null
        },
        {
          station: {name: 'Ebligen', coordinate: {x: 46.752617, y: 7.990028}},
          arrival: '2026-07-10T06:41:00+0200',
          departure: '2026-07-10T06:41:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Brienz West',
            coordinate: {x: 46.757306, y: 8.020377}
          },
          arrival: '2026-07-10T06:45:00+0200',
          departure: '2026-07-10T06:45:00+0200',
          delay: null
        },
        {
          station: {name: 'Brienz', coordinate: {x: 46.754835, y: 8.038937}},
          arrival: '2026-07-10T06:48:00+0200',
          departure: '2026-07-10T06:50:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Brienzwiler',
            coordinate: {x: 46.745673, y: 8.090618}
          },
          arrival: '2026-07-10T06:54:00+0200',
          departure: '2026-07-10T06:55:00+0200',
          delay: null
        },
        {
          station: {name: 'Meiringen', coordinate: {x: 46.727324, y: 8.184247}},
          arrival: '2026-07-10T07:04:00+0200',
          departure: null,
          delay: null
        }
      ]
    },
    {
      category: 'IC',
      number: '61',
      operator: 'SBB',
      to: 'Basel SBB',
      name: '000608',
      stop: {departure: '2026-07-10T06:29:00+0200', delay: null},
      passList: [
        {
          station: {name: null, coordinate: {x: null, y: null}},
          arrival: null,
          departure: '2026-07-10T06:29:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Interlaken West',
            coordinate: {x: 46.682623, y: 7.85144}
          },
          arrival: '2026-07-10T06:33:00+0200',
          departure: '2026-07-10T06:34:00+0200',
          delay: null
        },
        {
          station: {name: 'Spiez', coordinate: {x: 46.686389, y: 7.680098}},
          arrival: '2026-07-10T06:53:00+0200',
          departure: '2026-07-10T06:54:00+0200',
          delay: null
        },
        {
          station: {name: 'Thun', coordinate: {x: 46.754841, y: 7.629595}},
          arrival: '2026-07-10T07:03:00+0200',
          departure: '2026-07-10T07:04:00+0200',
          delay: null
        },
        {
          station: {name: 'Bern', coordinate: {x: 46.948823, y: 7.439123}},
          arrival: '2026-07-10T07:25:00+0200',
          departure: '2026-07-10T07:33:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Bahn-2000-Strecke',
            coordinate: {x: 47.196371, y: 7.689354}
          },
          arrival: null,
          departure: null,
          delay: null
        },
        {
          station: {name: 'Olten', coordinate: {x: 47.351927, y: 7.907693}},
          arrival: '2026-07-10T08:00:00+0200',
          departure: '2026-07-10T08:05:00+0200',
          delay: null
        },
        {
          station: {name: 'Basel SBB', coordinate: {x: 47.547403, y: 7.589564}},
          arrival: '2026-07-10T08:33:00+0200',
          departure: null,
          delay: null
        }
      ]
    },
    {
      category: 'R',
      number: '62',
      operator: 'BOB',
      to: 'Lauterbrunnen',
      name: '000137',
      stop: {departure: '2026-07-10T06:34:00+0200', delay: null},
      passList: [
        {
          station: {name: null, coordinate: {x: null, y: null}},
          arrival: null,
          departure: '2026-07-10T06:34:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Matten b. Interlaken',
            coordinate: {x: 46.674123, y: 7.872847}
          },
          arrival: '2026-07-10T06:36:00+0200',
          departure: '2026-07-10T06:37:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Wilderswil',
            coordinate: {x: 46.665689, y: 7.869461}
          },
          arrival: '2026-07-10T06:39:00+0200',
          departure: '2026-07-10T06:40:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Zweilütschinen',
            coordinate: {x: 46.632692, y: 7.89969}
          },
          arrival: '2026-07-10T06:46:00+0200',
          departure: '2026-07-10T06:47:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Lauterbrunnen',
            coordinate: {x: 46.59842, y: 7.908077}
          },
          arrival: '2026-07-10T06:56:00+0200',
          departure: null,
          delay: null
        }
      ]
    },
    {
      category: 'R',
      number: '61',
      operator: 'BOB',
      to: 'Grindelwald',
      name: '000237',
      stop: {departure: '2026-07-10T06:34:00+0200', delay: null},
      passList: [
        {
          station: {name: null, coordinate: {x: null, y: null}},
          arrival: null,
          departure: '2026-07-10T06:34:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Matten b. Interlaken',
            coordinate: {x: 46.674123, y: 7.872847}
          },
          arrival: '2026-07-10T06:36:00+0200',
          departure: '2026-07-10T06:37:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Wilderswil',
            coordinate: {x: 46.665689, y: 7.869461}
          },
          arrival: '2026-07-10T06:39:00+0200',
          departure: '2026-07-10T06:40:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Zweilütschinen',
            coordinate: {x: 46.632692, y: 7.89969}
          },
          arrival: '2026-07-10T06:46:00+0200',
          departure: '2026-07-10T06:48:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Lütschental',
            coordinate: {x: 46.637087, y: 7.948977}
          },
          arrival: '2026-07-10T06:52:00+0200',
          departure: '2026-07-10T06:52:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Burglauenen',
            coordinate: {x: 46.635896, y: 7.97532}
          },
          arrival: '2026-07-10T06:57:00+0200',
          departure: '2026-07-10T06:57:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Schwendi bei Grindelwald',
            coordinate: {x: 46.630463, y: 8.003068}
          },
          arrival: '2026-07-10T07:00:00+0200',
          departure: '2026-07-10T07:00:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Grindelwald Terminal',
            coordinate: {x: 46.625499, y: 8.017105}
          },
          arrival: '2026-07-10T07:03:00+0200',
          departure: '2026-07-10T07:04:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Grindelwald',
            coordinate: {x: 46.624345, y: 8.033296}
          },
          arrival: '2026-07-10T07:10:00+0200',
          departure: null,
          delay: null
        }
      ]
    },
    {
      category: 'IC',
      number: '81',
      operator: 'SBB',
      to: 'Romanshorn',
      name: '000809',
      stop: {departure: '2026-07-10T06:59:00+0200', delay: null},
      passList: [
        {
          station: {name: null, coordinate: {x: null, y: null}},
          arrival: null,
          departure: '2026-07-10T06:59:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Interlaken West',
            coordinate: {x: 46.682623, y: 7.85144}
          },
          arrival: '2026-07-10T07:03:00+0200',
          departure: '2026-07-10T07:04:00+0200',
          delay: null
        },
        {
          station: {name: 'Spiez', coordinate: {x: 46.686389, y: 7.680098}},
          arrival: '2026-07-10T07:23:00+0200',
          departure: '2026-07-10T07:23:00+0200',
          delay: null
        },
        {
          station: {name: 'Thun', coordinate: {x: 46.754841, y: 7.629595}},
          arrival: '2026-07-10T07:34:00+0200',
          departure: '2026-07-10T07:34:00+0200',
          delay: null
        },
        {
          station: {name: 'Bern', coordinate: {x: 46.948823, y: 7.439123}},
          arrival: '2026-07-10T07:56:00+0200',
          departure: '2026-07-10T08:02:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Bahn-2000-Strecke',
            coordinate: {x: 47.196371, y: 7.689354}
          },
          arrival: null,
          departure: null,
          delay: null
        },
        {
          station: {name: 'Zürich HB', coordinate: {x: 47.377847, y: 8.540502}},
          arrival: '2026-07-10T08:58:00+0200',
          departure: '2026-07-10T09:04:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Zürich Flughafen',
            coordinate: {x: 47.450379, y: 8.562398}
          },
          arrival: '2026-07-10T09:14:00+0200',
          departure: '2026-07-10T09:15:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Winterthur',
            coordinate: {x: 47.500322, y: 8.723808}
          },
          arrival: '2026-07-10T09:29:00+0200',
          departure: '2026-07-10T09:31:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Frauenfeld',
            coordinate: {x: 47.558159, y: 8.896546}
          },
          arrival: '2026-07-10T09:42:00+0200',
          departure: '2026-07-10T09:42:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Weinfelden',
            coordinate: {x: 47.566215, y: 9.106353}
          },
          arrival: '2026-07-10T09:54:00+0200',
          departure: '2026-07-10T09:55:00+0200',
          delay: null
        },
        {
          station: {name: 'Amriswil', coordinate: {x: 47.550449, y: 9.302213}},
          arrival: '2026-07-10T10:06:00+0200',
          departure: '2026-07-10T10:06:00+0200',
          delay: null
        },
        {
          station: {name: 'Romanshorn', coordinate: {x: 47.56552, y: 9.379358}},
          arrival: '2026-07-10T10:12:00+0200',
          departure: null,
          delay: null
        }
      ]
    },
    {
      category: 'R',
      number: '62',
      operator: 'BOB',
      to: 'Lauterbrunnen',
      name: '000139',
      stop: {departure: '2026-07-10T07:04:00+0200', delay: null},
      passList: [
        {
          station: {name: null, coordinate: {x: null, y: null}},
          arrival: null,
          departure: '2026-07-10T07:04:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Matten b. Interlaken',
            coordinate: {x: 46.674123, y: 7.872847}
          },
          arrival: '2026-07-10T07:06:00+0200',
          departure: '2026-07-10T07:07:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Wilderswil',
            coordinate: {x: 46.665689, y: 7.869461}
          },
          arrival: '2026-07-10T07:09:00+0200',
          departure: '2026-07-10T07:10:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Zweilütschinen',
            coordinate: {x: 46.632692, y: 7.89969}
          },
          arrival: '2026-07-10T07:16:00+0200',
          departure: '2026-07-10T07:17:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Lauterbrunnen',
            coordinate: {x: 46.59842, y: 7.908077}
          },
          arrival: '2026-07-10T07:26:00+0200',
          departure: null,
          delay: null
        }
      ]
    },
    {
      category: 'R',
      number: '61',
      operator: 'BOB',
      to: 'Grindelwald',
      name: '000239',
      stop: {departure: '2026-07-10T07:04:00+0200', delay: null},
      passList: [
        {
          station: {name: null, coordinate: {x: null, y: null}},
          arrival: null,
          departure: '2026-07-10T07:04:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Matten b. Interlaken',
            coordinate: {x: 46.674123, y: 7.872847}
          },
          arrival: '2026-07-10T07:06:00+0200',
          departure: '2026-07-10T07:07:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Wilderswil',
            coordinate: {x: 46.665689, y: 7.869461}
          },
          arrival: '2026-07-10T07:09:00+0200',
          departure: '2026-07-10T07:10:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Zweilütschinen',
            coordinate: {x: 46.632692, y: 7.89969}
          },
          arrival: '2026-07-10T07:16:00+0200',
          departure: '2026-07-10T07:18:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Lütschental',
            coordinate: {x: 46.637087, y: 7.948977}
          },
          arrival: '2026-07-10T07:22:00+0200',
          departure: '2026-07-10T07:22:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Burglauenen',
            coordinate: {x: 46.635896, y: 7.97532}
          },
          arrival: '2026-07-10T07:27:00+0200',
          departure: '2026-07-10T07:27:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Schwendi bei Grindelwald',
            coordinate: {x: 46.630463, y: 8.003068}
          },
          arrival: '2026-07-10T07:30:00+0200',
          departure: '2026-07-10T07:30:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Grindelwald Terminal',
            coordinate: {x: 46.625499, y: 8.017105}
          },
          arrival: '2026-07-10T07:33:00+0200',
          departure: '2026-07-10T07:34:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Grindelwald',
            coordinate: {x: 46.624345, y: 8.033296}
          },
          arrival: '2026-07-10T07:40:00+0200',
          departure: null,
          delay: null
        }
      ]
    },
    {
      category: 'PE',
      number: 'LIX',
      operator: 'ZB',
      to: 'Luzern',
      name: '002915',
      stop: {departure: '2026-07-10T07:04:00+0200', delay: null},
      passList: [
        {
          station: {name: null, coordinate: {x: null, y: null}},
          arrival: null,
          departure: '2026-07-10T07:04:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Oberried am Brienzersee',
            coordinate: {x: 46.736544, y: 7.95892}
          },
          arrival: '2026-07-10T07:13:00+0200',
          departure: '2026-07-10T07:15:00+0200',
          delay: null
        },
        {
          station: {name: 'Brienz', coordinate: {x: 46.754835, y: 8.038937}},
          arrival: '2026-07-10T07:22:00+0200',
          departure: '2026-07-10T07:25:00+0200',
          delay: null
        },
        {
          station: {name: 'Meiringen', coordinate: {x: 46.727324, y: 8.184247}},
          arrival: '2026-07-10T07:35:00+0200',
          departure: '2026-07-10T07:41:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Brünig-Hasliberg',
            coordinate: {x: 46.757749, y: 8.138645}
          },
          arrival: '2026-07-10T07:50:00+0200',
          departure: '2026-07-10T07:51:00+0200',
          delay: null
        },
        {
          station: {name: 'Lungern', coordinate: {x: 46.786344, y: 8.163559}},
          arrival: '2026-07-10T08:03:00+0200',
          departure: '2026-07-10T08:04:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Kaiserstuhl OW',
            coordinate: {x: 46.814353, y: 8.175519}
          },
          arrival: '2026-07-10T08:09:00+0200',
          departure: '2026-07-10T08:10:00+0200',
          delay: null
        },
        {
          station: {name: 'Giswil', coordinate: {x: 46.83652, y: 8.18631}},
          arrival: '2026-07-10T08:18:00+0200',
          departure: '2026-07-10T08:21:00+0200',
          delay: null
        },
        {
          station: {name: 'Sachseln', coordinate: {x: 46.870955, y: 8.238299}},
          arrival: '2026-07-10T08:28:00+0200',
          departure: '2026-07-10T08:29:00+0200',
          delay: null
        },
        {
          station: {name: 'Sarnen', coordinate: {x: 46.894594, y: 8.247495}},
          arrival: '2026-07-10T08:32:00+0200',
          departure: '2026-07-10T08:35:00+0200',
          delay: null
        },
        {
          station: {name: 'Luzern', coordinate: {x: 47.050165, y: 8.310172}},
          arrival: '2026-07-10T08:55:00+0200',
          departure: null,
          delay: null
        }
      ]
    }
  ]
};

// Captured the same day from the PIER station next door
// (Interlaken Ost (See), icon "ship" in the locations
// response): the BLS Brienzersee sailings - category BAT,
// operator BLS-brs, each with its passList of pier
// coordinates and times. The boats the AIS coverage gap
// misses arrive by schedule instead.
export const BOAT_FIXTURE = {
  station: {
    name: 'Interlaken Ost (See)',
    coordinate: {type: 'WGS84', x: 46.691688, y: 7.869171}
  },
  stationboard: [
    {
      category: 'BAT',
      number: '59',
      operator: 'BLS-brs',
      to: 'Brienz (See)',
      name: '000059',
      stop: {departure: '2026-07-10T09:07:00+0200', delay: null},
      passList: [
        {
          station: {name: null, coordinate: {x: null, y: null}},
          arrival: null,
          departure: '2026-07-10T09:07:00+0200',
          delay: null
        },
        {
          station: {name: 'Bönigen', coordinate: {x: 46.68938, y: 7.898043}},
          arrival: '2026-07-10T09:25:00+0200',
          departure: '2026-07-10T09:25:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Ringgenberg (See)',
            coordinate: {x: 46.701361, y: 7.898407}
          },
          arrival: '2026-07-10T09:33:00+0200',
          departure: '2026-07-10T09:33:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Niederried (See)',
            coordinate: {x: 46.717735, y: 7.932305}
          },
          arrival: '2026-07-10T09:43:00+0200',
          departure: '2026-07-10T09:43:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Iseltwald (See)',
            coordinate: {x: 46.711816, y: 7.962539}
          },
          arrival: '2026-07-10T09:51:00+0200',
          departure: '2026-07-10T09:52:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Giessbach See',
            coordinate: {x: 46.734813, y: 8.019454}
          },
          arrival: '2026-07-10T10:09:00+0200',
          departure: '2026-07-10T10:09:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Brienz (See)',
            coordinate: {x: 46.753786, y: 8.038388}
          },
          arrival: '2026-07-10T10:20:00+0200',
          departure: null,
          delay: null
        }
      ]
    },
    {
      category: 'BAT',
      number: '63',
      operator: 'BLS-brs',
      to: 'Brienz (See)',
      name: '000063',
      stop: {departure: '2026-07-10T11:07:00+0200', delay: null},
      passList: [
        {
          station: {name: null, coordinate: {x: null, y: null}},
          arrival: null,
          departure: '2026-07-10T11:07:00+0200',
          delay: null
        },
        {
          station: {name: 'Bönigen', coordinate: {x: 46.68938, y: 7.898043}},
          arrival: '2026-07-10T11:25:00+0200',
          departure: '2026-07-10T11:25:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Ringgenberg (See)',
            coordinate: {x: 46.701361, y: 7.898407}
          },
          arrival: '2026-07-10T11:33:00+0200',
          departure: '2026-07-10T11:33:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Iseltwald (See)',
            coordinate: {x: 46.711816, y: 7.962539}
          },
          arrival: '2026-07-10T11:51:00+0200',
          departure: '2026-07-10T11:52:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Giessbach See',
            coordinate: {x: 46.734813, y: 8.019454}
          },
          arrival: '2026-07-10T12:09:00+0200',
          departure: '2026-07-10T12:09:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Brienz (See)',
            coordinate: {x: 46.753786, y: 8.038388}
          },
          arrival: '2026-07-10T12:20:00+0200',
          departure: null,
          delay: null
        }
      ]
    },
    {
      category: 'BAT',
      number: '65',
      operator: 'BLS-brs',
      to: 'Brienz (See)',
      name: '000065',
      stop: {departure: '2026-07-10T12:07:00+0200', delay: null},
      passList: [
        {
          station: {name: null, coordinate: {x: null, y: null}},
          arrival: null,
          departure: '2026-07-10T12:07:00+0200',
          delay: null
        },
        {
          station: {name: 'Bönigen', coordinate: {x: 46.68938, y: 7.898043}},
          arrival: '2026-07-10T12:25:00+0200',
          departure: '2026-07-10T12:25:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Iseltwald (See)',
            coordinate: {x: 46.711816, y: 7.962539}
          },
          arrival: '2026-07-10T12:45:00+0200',
          departure: '2026-07-10T12:46:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Oberried am Brienzersee (See)',
            coordinate: {x: 46.73658, y: 7.96278}
          },
          arrival: '2026-07-10T12:56:00+0200',
          departure: '2026-07-10T12:56:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Giessbach See',
            coordinate: {x: 46.734813, y: 8.019454}
          },
          arrival: '2026-07-10T13:09:00+0200',
          departure: '2026-07-10T13:09:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Brienz (See)',
            coordinate: {x: 46.753786, y: 8.038388}
          },
          arrival: '2026-07-10T13:20:00+0200',
          departure: null,
          delay: null
        }
      ]
    },
    {
      category: 'BAT',
      number: '69',
      operator: 'BLS-brs',
      to: 'Brienz (See)',
      name: '000069',
      stop: {departure: '2026-07-10T14:07:00+0200', delay: null},
      passList: [
        {
          station: {name: null, coordinate: {x: null, y: null}},
          arrival: null,
          departure: '2026-07-10T14:07:00+0200',
          delay: null
        },
        {
          station: {name: 'Bönigen', coordinate: {x: 46.68938, y: 7.898043}},
          arrival: '2026-07-10T14:25:00+0200',
          departure: '2026-07-10T14:25:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Ringgenberg (See)',
            coordinate: {x: 46.701361, y: 7.898407}
          },
          arrival: '2026-07-10T14:33:00+0200',
          departure: '2026-07-10T14:33:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Iseltwald (See)',
            coordinate: {x: 46.711816, y: 7.962539}
          },
          arrival: '2026-07-10T14:51:00+0200',
          departure: '2026-07-10T14:52:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Giessbach See',
            coordinate: {x: 46.734813, y: 8.019454}
          },
          arrival: '2026-07-10T15:09:00+0200',
          departure: '2026-07-10T15:09:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Brienz (See)',
            coordinate: {x: 46.753786, y: 8.038388}
          },
          arrival: '2026-07-10T15:20:00+0200',
          departure: null,
          delay: null
        }
      ]
    },
    {
      category: 'BAT',
      number: '73',
      operator: 'BLS-brs',
      to: 'Brienz (See)',
      name: '000073',
      stop: {departure: '2026-07-10T16:07:00+0200', delay: null},
      passList: [
        {
          station: {name: null, coordinate: {x: null, y: null}},
          arrival: null,
          departure: '2026-07-10T16:07:00+0200',
          delay: null
        },
        {
          station: {name: 'Bönigen', coordinate: {x: 46.68938, y: 7.898043}},
          arrival: '2026-07-10T16:25:00+0200',
          departure: '2026-07-10T16:25:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Ringgenberg (See)',
            coordinate: {x: 46.701361, y: 7.898407}
          },
          arrival: '2026-07-10T16:33:00+0200',
          departure: '2026-07-10T16:33:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Niederried (See)',
            coordinate: {x: 46.717735, y: 7.932305}
          },
          arrival: '2026-07-10T16:43:00+0200',
          departure: '2026-07-10T16:43:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Iseltwald (See)',
            coordinate: {x: 46.711816, y: 7.962539}
          },
          arrival: '2026-07-10T16:51:00+0200',
          departure: '2026-07-10T16:52:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Giessbach See',
            coordinate: {x: 46.734813, y: 8.019454}
          },
          arrival: '2026-07-10T17:09:00+0200',
          departure: '2026-07-10T17:09:00+0200',
          delay: null
        },
        {
          station: {
            name: 'Brienz (See)',
            coordinate: {x: 46.753786, y: 8.038388}
          },
          arrival: '2026-07-10T17:20:00+0200',
          departure: null,
          delay: null
        }
      ]
    }
  ]
};

// Captured transitous.org response (2026-07-10, api/v6/map/
// trips over Frankfurt, 10-minute window - keyless, CORS-open,
// worldwide GTFS aggregation): rail legs operating in the box
// right then - ICE/regional/S-Bahn and a tram sample - each
// with its line name, mode, real-time-adjusted departure/
// arrival (realTime flag), the from/to stops, and the encoded
// POLYLINE of the actual route shape. Buses, coaches and
// planes dropped; night-train megalines (>6 KB) and trams
// beyond a 10-leg sample dropped for size.
export const TRIPS_FIXTURE = [
  {
    trips: [{displayName: 'ICE 698'}],
    mode: 'HIGHSPEED_RAIL',
    from: {
      name: 'Frankfurt (Main) Hauptbahnhof',
      lat: 50.106205,
      lon: 8.663015
    },
    to: {name: 'Aschaffenburg Hbf', lat: 49.98065, lon: 9.14343},
    departure: '2026-07-10T01:55:00Z',
    arrival: '2026-07-10T02:25:00Z',
    scheduledDeparture: '2026-07-10T01:31:00Z',
    scheduledArrival: '2026-07-10T02:05:00Z',
    realTime: true,
    polyline:
      'sjypH}~zs@x@tCp@dCPh@Pp@Pn@DNn@dCj@tBX~@Lb@FTRn@Pn@H`@BN\\`BNr@Nt@Nr@lAfEb@xA\\nANh@\\rAJb@BF~AnG`@vA`@lARb@Tf@Vf@`@n@JNFHTTRTRPNLXRPJPHZNLDNFPDLBD@L@NBTBN@T@\\AXCNA\\GXGVI\\Od@WHENMPOFGVWRS\\a@NSRUpA_BvA_BX]j@o@tEmFDEjEgFb@i@^e@T]NWTc@Vi@Ti@\\_AZgAd@sBDUT_BPyAFm@JyANoCBu@Bo@B]HwBBgAB{@@eADsB@_CAeE?ECgB?WA]Ay@Cu@IkAGu@Is@Ku@Km@Mq@GSYkAa@mAeA_DUq@]cA_AwCW{@e@{A]mAa@{AYsAi@cDS}AK}@CYIq@]{Ca@eDW{BIm@QwAs@qE}@eFa@sBKk@Qw@YuAOm@a@_Bc@{Ac@}Ae@uAGQ]aACGAECK[{@Ys@Qg@a@kA[}@M[Oe@M[_@iAGOa@mAEMg@qAc@eAOc@CEO[]y@Q_@MWWm@g@aAw@gBa@eAEMc@uAGUIYU}@WmAO{@g@oDYyBAKo@cFE[[kCS_B]mCs@mFEYUeBIo@QwAm@cEWuBU{BAUKwAE{@KwBGaD?OAaB?iB?eD?eEAkB?gA?kBAo@AgDOyc@?kAAy@AiDEyJUgLIgEe@kSg@aUCgAAeAC}A@iFJgED}@TqDn@}F\\oBTwANu@Ns@\\yA@Ef@qBj@}BlBuH`AwDJc@pD}N`@_Bb@gBLc@t@}ClDqNNo@Ps@DK~AwGBKl@aCH]FYLm@Ns@F]BQPeANmADm@Fm@Do@Di@B_@@o@BgABuAAkA?gACu@EeAE}@Eo@AGSiCAQCY?M]eE[gEEq@Ek@McBI_AEg@Gg@KoAMsAEg@Go@Gm@AGCYGg@OaBAKSwBAIWeCC[AKCSEg@m@iGCSSyBAO_@wDQkBEe@QeBAIAKe@_F_@sDIaA_@wDGq@YoCcAmKeA_LQaBk@_GUkCKaBIkAGmAMkDYmIC]EmAEyAAMIyB?EGcAG}@KgAY}CI{@Go@Ee@E]QoAIe@Mw@AGG[GYOy@UaASs@eA{D{@eD]oAU}@e@cBOi@g@{AWw@GUg@_B[aA]eAw@eCKYg@aBu@{BkFqP_A{CoD_Le@{AYcAGUs@}Cm@oCCMCI_@cBU{@GYOc@EKWw@yAyEqBuGgAyDu@mC_AkDoC}JAEcBkGc@}Ac@aBgA_EmC_KyJq^eAyDa@{AWcAU_AYuAYwAI_@AIIg@UsAOeAK{@QyAGi@Gm@MmAGu@Ca@IoAIqBEiAEoAK}CE}AEeBGqBCaACy@A{@EqBOgGWyJ_Ay_@]qOG{BImCCm@IkDGcCSaHAw@KyDmAyh@y@{\\g@}TQcGE}ACcAUmJc@gRw@e]aAg`@?KW{KSoICm@GsCG_DAuA@}@?q@@mAB}@FmAFsAHgAHkARiBPmAzAwIZcBLq@p@uD\\qBRgAn@sDFe@Hk@L_AJeADe@Bg@HoADqABcB@}@Au@CwAG_BE{@I_AKcAMgAMq@Im@Ou@GYI]Ke@Oi@W}@Sk@[}@m@_Bo@_BeBcEa@cAWm@CGCKeG_OOa@EICECISk@GOMa@Sq@K_@Ke@Mo@O{@O{@OqAG}@Ei@EgACi@CiBAyB@y@D}AFsALkAJs@V{ANo@Ru@jA}C\\gAXgANq@Li@@O^_C~@uGJo@@ILk@d@mBTw@Pk@HUx@}BRc@HOvAqCf@{@Zm@Xi@\\q@lAgCZo@`@}@t@}ADGN]v@_BvBqEdCmFdBuDJSBGv@eBBEFKzA_Dv@cBjA_C|AiC|@gA`AcA`Ay@jBgAFC|@_@XGxA_@f@IlAQrB]ZEzA]n@Sj@Sj@Wj@Yh@Y`Aq@l@e@~@y@x@y@p@y@`ByBDIhEmGXa@R]NWR[NUb@q@t@oA\\m@tAaCf@aAvAkCVg@Tc@r@yAfA}B|AgDJW^_AFOZu@Vq@n@cBvHiStAmDnJwVnFwNpG}P~DsKrG}PBEf@sABEh@wAd@oA|AcEPc@fAuCpBmFbJcVbEwKdF_N\\_ABIJUpAgD@EbAqCXu@tAsDJWjA}Cx@uB`AkC`DqIlAaDrAmDfKsX`@cAbDsIx@yBjC_Hh@uAbAoCFMl@cBNc@`AmCrCwHpBeFd@eAxBaFVg@fAyBx@uAxBuDf@s@xAmBhAwAHI|@cAvCaDzA{APOdImHTSrRcP\\Y|FaFbA{@xMeLvMaLlJcIdYiVfPgN`NkL|G{FpGsFlB_B~GaG`FcE`A}@bCsBbBwArBgBpBeBnFsEfDkCj@i@pGqFtIkHnM{KhLuJzVgTpr@}l@hJcIhOgMjOmMrSeQvIqHzMiLbJ{HfEqD|BmBjCwBbFoE~EcEdK{Id@_@nBcBdUuRrEsEzCgDjDuEjDqFLUb@y@nBkDt@wALUJQbByChAuB|A{CfBgElAwCnAsDdAsCnBiHbAaEhAuEtBiLnBiMfAaIRkBf@wEb@oH\\gHRwEBeA@]ByAHgFRcQ@cB?M@KFyG@a@LwMFgFJwIB{BByCLcKXoU?EBoBFuFBgD@YL}K?IFyD@_@F{G?UFgF@iAFmF@s@@QAyE?IA}C?g@AaA?gB?_B@oCHmI'
  },
  {
    trips: [{displayName: 'ICE 699'}],
    mode: 'HIGHSPEED_RAIL',
    from: {
      name: 'Frankfurt (Main) Hauptbahnhof',
      lat: 50.106205,
      lon: 8.663015
    },
    to: {name: 'Mannheim, Hauptbahnhof', lat: 49.479134, lon: 8.4699},
    departure: '2026-07-10T01:58:00Z',
    arrival: '2026-07-10T02:35:00Z',
    scheduledDeparture: '2026-07-10T01:12:00Z',
    scheduledArrival: '2026-07-10T01:51:00Z',
    realTime: true,
    polyline:
      'sjypH}~zs@x@tCp@dCPh@Pp@Pn@DNn@dCj@tBX~@Lb@FTRn@Pn@Tt@Tt@d@lAt@fBb@fAh@tAp@`Bd@bBl@tBt@hCVdAl@~Bh@xBFZLd@FVf@pBlAjEvA~EX~@zAhFdAlD~AtFlAbErBhH\\jAp@|B~@vCfAfDVv@Nn@F^H\\Hf@Jp@Jx@JlADx@FdA@d@BnAB|@B~@Bj@Bn@BTD`@Hv@Lt@H`@T~@`AdDLZv@fCBDX|@Xv@Zv@FNVf@DHVd@b@p@\\d@XZVXd@`@f@`@p@^f@X`@Nj@Ph@LRBTBZBN?d@@^AVAPCb@EPCPCZGD?NEdAUbC_ARGnJsDVKVKHEd@QNINGNINILILIRMROtDoCfGqE`@[fAw@jBqARM|@q@TQbEuClAy@NKn@c@|AgAFGHGz@k@~@q@`CcBt@i@d@[`DmB`Am@lA}@PMhCiBdCkBfA}@n@i@p@i@j@_@d@YlAe@DCRGZIh@Ix@It@Cl@@D?d@BjAV\\Hd@Lz@\\n@\\t@f@`@Xn@l@j@l@VZBDLP`@n@Zf@Zp@`@~@Vn@Tt@DLBJHVFXFTNn@d@`CDT^fBBJBNBLFTFVJ\\FVPl@Pl@DPDNFRDRDRFXDRp@hDZzA\\bB@FvCbOz@lEbA~EXnANr@f@hBj@`BXr@r@~AVf@l@bAp@`Av@`A~@|@`@\\xAdAx@h@x@f@h@\\^TfAp@rAx@r@b@FDbDnBVPjC`B~A`ADBnKrGdEhCnBlAl@^j@\\hAp@xA~@|BvA^TdBdAlC`BbDpBb@VDB|A~@dAp@nLjHPJrBpAfF~CjBhAnBlAxA|@FBrCfBxInFfEhCzBtATLxA~@jDtBlElCFF~A`A|D`Cr@d@|@h@pBlArAx@r@d@|@h@PJTLz@h@dGtDn@^hF`DXPd@ZdBdAfC|AdCzAj@\\t@f@rDxB^Vv@f@bEfCXPdEdC~CpBdDpBlEnCdGtDfKlG`@VfAn@hF`DxIlFXPdCzAr@`@dEjCHDhEjCf@ZrEpC~BvAhEfCdIdFFDnElCf@ZHDbBdAZRz@f@hLdHb@VLF`BdA|@j@pAv@fAr@t@b@DBdAp@lDrBp@b@\\RNJLHhAp@zA|@DDbDrBnAt@v@d@PLb@XxEtCjAr@|@h@vBpAlF`DhDtB~@j@pAv@~BxAJFbI|E~A`AfGvDzA~@NHPJn@`@`Al@jBhA|D`Cf@Z~@j@tHtEbDnBdDrBvAz@nGzD^TRL`GpDXPh@ZhDtBLHn@`@p@b@fAp@^RhBfAFDx@f@n@`@dCzAvBtArAz@HFf@^d@^pAdAJLRPb@b@RTDDJLpBbCl@v@nBfCvEjGFHHJ|ArBT\\jExFpI`LTZdChDdArARXpH|JX^tCxDp@z@j@v@dArA|ErG`FvGnI`L|DhF`@j@tH~JtIhLpAbBbCbDzEnGvAlBpFjHLPrAfBzEnGn@z@dDlE\\d@lBdCPTrCvD~EpGNRr@bArAhBhChDfAvArAfBpDzEzBvCvEhGpCrDxAnB`BxB~ErGlDtEZ`@HJ`JvL^f@vDbFDFx@dA\\d@hExFpAdBbC`D|@lAnGnIjGjILP~ErGvFrHhAzALPlAxARZzDbF^f@HJlAxAl@r@b@d@RRd@f@p@l@DDLJ`@\\h@d@l@f@p@f@t@f@ZRXNx@f@b@XHDn@\\x@`@z@`@f@RTLlAb@FBz@Vx@Vb@JRFd@JxB`@vBZ|ANvAHD?z@Bv@Dx@@X@D?dABD?Z@tBDpCDlBD`HNrBD~EJl@@f@@rGLnEHh@Bv@@H?R@|@B\\?`@@hCHdCBlFDrDBrKJxBBvEDj@@R?`@?nFB^@vA@jEDzFDfC@hIFdBB|EB~@@v@@zBB|FDlA@jED~DB~B@n@@N?bB@hFD`DBhCBV@nA@r@@dFBP?p@@`G@hA@`A@~GFh@@`JJfBB\\?fA?vBDzGHl@?vKD~GDpFD|DBbIFhEDdDBjNJnC@v@@rEBjFBbCDp@?`B?|BFpHDt@@xB@nA@jBFp@?|GFrG@t@@hAA~CAnCCr@Aj@AbDErBAr@BpADbBHpALv@Jr@Jz@Nr@Nl@NPD\\Jp@RpAb@vAf@h@TvAp@j@XJFdDhB|BvAhAt@tA|@l@\\jAt@rAz@d@ZHDhC|AtBlAnAt@`CrAr@`@RL`B~@pAx@tBlAVNlIrFHDdAp@zGhEz@j@xA|@JHr@b@bC|A`@V|A`AZRd@Xb@XRNlAt@|A~@~FtDz@j@rAx@`CzA~B|ArBnAjBpApA|@pEpCj@\\zDfC`@V^TTNhEpChC`BpBpAdC~AnAx@dDrBnCbBVN\\RhBfArBbAvAj@hC|@bBf@|AZlB\\lBTl@FfAHZBl@Bx@@jA@hBAbBKp@Ev@IhCWxBWr@IpIiAnDc@zASRCzC]RClC]jAOXERCfDc@pBYlBUfAQFA|Ca@PClBW`AKdAMpBYTCb@GhBUnDc@z@MfIcA`AMvFs@t@KtGw@tC_@d@Gr@Kp@K~AYhAUHC|A[bBg@ZIn@UHCv@Yf@SlAe@|BmAr@c@lDyBnBwAz@m@b@]rBwAbBkAfCcBlBuAtAcAb@[pCsBlDeCZUpCoBnBwARO~CyBhDcClA}@l@c@nF{Dn@e@dAw@tB}AbAu@bCeBxAcAtBoAVQzBgA~@a@bBo@PG`Bg@jBc@zA[HAzAYhASx@ObB]NEdB[vBa@j@MJA~AWhAUpCe@vAYh@IrBa@jAUjB]bASZGnCg@bKmBhCc@PEHAhF_AFA~@Sf@KrDo@DAxCk@n@KbCg@pCg@|Ba@bAO^El@I`@CvAMbBGN?`BArBD\\BJ?nAHh@Ft@Hh@DPDpATj@Lt@P~Ad@dA^XJdA^dIpDDBD@|@`@bAb@`CdAnClAdGpCpEpBfF~BnD`B~Ap@tAn@nBz@jAf@~@`@dFzBjD`BbAh@pAz@n@b@p@d@l@b@hB|AxBvBzB|BzB|B~A~ATTxCzCdCdCJJ`@^hDhDbAbAbBbBhEfEr@r@lAnAz@x@HHvBvBf@h@f@f@VVZZ~A~A^^zAzANPNNNLjCnCxIxIn@n@`F`FbHbHfAfAVV~A~AxBxBpFpF\\\\jIhIJLvAvA`E`EFFHHl@l@~G~GfCfCdCdCzFzFVXXXlClC`B~AjAjAdDfDh@j@`DbDl@p@tBrCdA|A~CzE`DdFn@bAjAjBBDV`@fAfBFLvAvBzBlDhC`El@~@b@r@b@j@x@bAj@l@PN`Av@d@ZXNh@VPFFBVHn@Rx@Nr@JxBF\\AXA^E^E\\G\\GdAWdAY|@YFCpAa@j@QLCzFeBrFaB\\MDAt@Un@Q~CaALEjCw@|Ae@hCy@^KLE~KkDLEfGkBxAc@fIgClGoBt@SjJ{CzEyALEh@Qz@W`Cs@lDgArAa@xH}BnDgAxH_CXKx@YjA]~Ag@JCbCw@|Bq@vFeBdCu@~E}Ar@UtAc@j@QxH_CrA_@f@Q~DoAzEyAJCTGnAa@HCNGnJuCbA[FCf@OrDkAz@WtDiAd@OjCy@tDiA|@Yf@OdA[|GuBj@Q`EmAXIt@UpJyC|CaARGRGfA]d@OtAa@pCy@|Bu@n@SrH}BLErEwAjA]jIgC~Bs@tEwA`AY`Bi@zHaCrGqBjBi@^MvGqBtGqBdBi@tH_C~CaAxBq@lKcDfCw@fCu@h@Q^KvGsBbIcCdA]DAlDgADAtAc@dFcBbC{@p@UTKd@OtHoC`Cy@pBm@xLuDdCu@bCu@dEiAbCs@^I\\IxA_@l@O|Bk@FA^IfAW~Be@|B]jBQrBMbACV?pAA~AEfJCT?dGCjFCzDAj@CR?jB?tDAxIERAhGC~BAD?dDApB?|JGp@?rCAdCAF?xKER?xECfA?xDCvECf@AvFAnEAfD?f@?NAbCAJ?~JG|DA~GAvJGfD?pEChJGF?zCCD?n@?lCApDAf@AX?H?vAA|BAdCAJ?`A?lBApGCbEAhD?bA@xB@F?v@?tB@Z?rIBR?rDAtDArIEhGAjACr@?x@?fCA|BC^?~BA\\?x@AT?vAARAN?vBEfAAdAAZAX?tBCRAhCCNAbAAb@AzAAfC?\\?p@@H@D?jAFP@ZB^Bl@FVDn@HF@h@Hb@HNDjAVnAZlA^`@Nr@VvAn@zAr@bB`AhBjAt@j@z@p@hB`BPNxAzAp@v@n@t@`AlA^h@BDlBpCtAxBFFfC|Dt@lAzAbCrFvIl@~@hDlFpApBnB~CT\\tBdDpB~C\\h@hBrCT^tCpE^l@rAtBnApBlBxCn@bAHJtApBvAjBpA`BHJJLd@h@l@n@fBnBl@n@`AbA^^nArAj@l@`@^xAxAtAjAnA`AvCpBdBbAlHfEtBfAxB~@zBv@tBh@tB`@|BZtBV~@Hv@Hj@HbAHH@n@H`@DxAN`@B\\D\\B^Bd@@X@|@?l@?FApAGnBOTChBWLAzBYbC[zBY`@EfAOjAObAODAxA]tAi@x@a@JGj@]`@[n@i@b@c@HK`@e@^g@d@o@T]f@y@BEd@}@Vg@Vi@Rg@Ri@Ro@Rs@PaADQBMBQB]Ho@Do@B[Bk@FaB?MH}BD}@@GBk@JuARiBToBHq@Ly@BKHi@Nq@T{@b@aBV{@V_AXu@Vm@Xq@l@eBPe@L]Na@DI@Gt@iBj@wAd@oADKHQTk@JY'
  },
  {
    trips: [{displayName: 'ICE 618'}],
    mode: 'HIGHSPEED_RAIL',
    from: {name: 'Mannheim, Hauptbahnhof', lat: 49.47923, lon: 8.470026},
    to: {
      name: 'Frankfurt (Main) Hauptbahnhof',
      lat: 50.106964,
      lon: 8.662199000000001
    },
    departure: '2026-07-10T02:01:00Z',
    arrival: '2026-07-10T02:38:00Z',
    scheduledDeparture: '2026-07-10T02:01:00Z',
    scheduledArrival: '2026-07-10T02:38:00Z',
    realTime: true,
    polyline:
      'c|~lHshur@e@hAGPGLw@pB_@bA_@`AITIXO`@GPIVUt@_@lAAHQj@Uv@Ut@W~@Wz@c@`BUz@Op@Ih@CJMx@Ip@UnBShBKtACj@AFE|@I|B?HGdBCj@CZEn@In@C\\CPCLEPQ`ASr@Sn@Sh@Sf@Wh@Wf@e@|@CDg@x@U\\e@n@_@f@a@d@IJc@b@o@h@a@Zg@ZOHy@`@uAh@yA\\E@cANkANgANa@D{BXcCZ{BXM@iBVUBoBNqAFG@m@?}@?YAe@A_@C]C]Ca@EyAOa@Eo@IIAcAIk@Iw@I_AIuBW}B[uBa@uBi@{Bw@yB_AuBgAmHgEeBcAwCqBoAaAuAkAyAyAa@_@k@m@oAsA_@_@aAcAm@o@gBoBm@o@e@i@KMIKqAaBsAgByAuBIKo@cAmByCoAqBsAuB_@m@uCqEU_@iBsC]i@qB_DuBeDU]oB_DqAqBiDmFm@_AsFwI{AcCu@mAgC}DEEwA{BmBqCCE_@i@aAmAo@u@q@w@yA{AMMmBcB{@q@u@k@gBkAeBaA{As@wAo@s@Wa@OmA_@oA[kAWOEc@Ie@GKCo@IWEm@G_@C[CQAkAGE?IAq@A]?gC?{A@a@@eA@O@iCBS@uBBY?[@eA@gA@wBDO?S@wA@U?y@@]?_C@_@?}BBgC@y@?s@?kABiG@sIDuD@sD@S?sIC[?uBAw@?G?yBAcAAeD?gE@qGBmB@aA?K?eC@}B@wA@I?Y?g@@qD@mC@o@?E?{CBG?iJFqEBgD?wJF_H@}D@_KFK?cC@O@g@?gD?oE@wF@g@@wEByDBgA?yEBS?yKDG?eC@sC@q@?}JFqB?eD@E?_C@iGBS@yIDuD@kB?S?k@B{D@kFBeGBU?cJBcBDqA@W?cABsBLkBP}B\\_Cd@gAV_@HG@}Bj@m@NyA^]H_@HcCr@eEhAcCt@eCt@yLtDqBl@aCx@uHnCe@NUJq@TcCz@eFbBuAb@E@mDfAE@eA\\_I`C{GtB_@Ji@PgCt@gCv@mKbDyBp@_D`AuH~BeBh@uGpBwGpB_@LkBh@sGpB{H`CaBh@aAXuEvA_Cr@kIfCkA\\sEvAMDsH|Bo@R}Bt@qCx@uA`@e@NgA\\SFSF}C`AqJxCu@TYHaElAk@P}GtBeAZg@N}@XuDhAkCx@e@NuDhA{@VsDjAg@NGBcAZoJtCOFIBoA`@UFKB{ExA_EnAg@PsA^yH~Bk@PuAb@s@T_F|AeCt@wFdB}Bp@cCv@KB_Bf@kA\\y@XYJyH~BoDfAyH|BsA`@mDfAaCr@{@Vi@PMD{ExAkJzCu@RmGnBgIfCyAb@gGjBMD_LjDMD_@JiCx@}Ad@kCv@MD_D`Ao@Pu@TE@]LsF`B{FdBMBk@PqA`@GB}@XeAXeAV]F]F_@D_@DY@[@{BGs@Ky@Oo@SWIGCQGi@WYOe@[aAw@QOk@m@y@cAc@k@c@s@k@}@kCcE{BmDwAwBCIkAkBWa@CEkAkBo@cAaDeF_D{EeA}AuBsCm@q@aDcDi@k@eDgDkAkAaB_BiCiC]]WY{F{FeCeCgCgC_H_Hm@m@IIGGaEaEwAwAKMkIiI]]qFqFyByB_B_BWWgAgAcHcHaFaFo@o@yIyIkCoCOMOOOQ{A{A_@_@_B_B[[WWg@g@g@i@wBwBII{@y@mAoAs@s@iEgEcBcBcAcAiDiDa@_@KKeCeCyC{CSSaBaB{B}B{B}ByBwBiB}Am@c@q@e@o@c@qA{@cAi@kDaBeF{B_Aa@kAg@oB{@uAo@_Bq@oDaBgF_CqEqBeGqCoCmAaCeAcAc@}@a@EAECeIqDeA_@YKeA_@_Be@u@Qk@MqAUQEi@Eu@Ii@GoAIK?]CsBEaB@O?cBFwALa@Bm@H_@DcAN}B`@qCf@cCf@o@JyCj@E@sDn@g@J_ARG@iF~@I@QDiCb@cKlBoCf@[FcARgBZoAVsB`@i@HwAXqCd@iAT_BVK@g@J{Bb@eBZODcB\\y@NiAR{AXI@{AZkBb@aBf@QFcBn@_A`@{BfAWPuBnAyAbAcCdBcAt@uB|AeAv@o@d@oFzDm@b@mA|@iDbC_DxBSNoBvAqCnB[TmDdCqCrBc@ZuAbAmBtAgCbBcBjAsBvAc@\\{@l@oBvAmDxBs@b@}BlAmAd@g@Rw@XIBo@T[HcBf@}AZIBiAT_BXq@Js@Je@FqC\\yGx@u@JwFr@aALgIbA{@LoDb@iBTa@FWBqBXeALaAJmBVQB}C`@G@gAPmBTqBXgDb@SBYDkANmC\\SB{C\\SB{ARoDb@qIhAs@HyBViCVw@Hq@DcBJiB@kAAy@Am@C[CgAIm@GmBUmB]}A[cBg@iC}@wAk@sBcAiBgA]SWOoCcBeDsBoAy@eC_BqBqAiCaBiEqCUO_@Ua@W{DgCk@]qEqCqA}@kBqAsBoA_C}AaC{AsAy@{@k@_GuD}A_AmAu@SOc@Ya@W_@U}AaAa@WcC}As@c@KIyA}@{@k@{GiEeAq@IEmIsFWOuBmAqAy@aB_ASMs@a@aCsAoAu@uBmAiC}AIEe@[sA{@kAu@m@]uA}@iAu@}BwAeDiBKGk@YwAq@i@UwAg@qAc@q@S]KQEm@Os@O{@Os@Kw@KqAMcBIqAEs@CsB@cDDk@@s@@oCB_D@iA@u@AsGA}GGq@?kBGoAAyBAu@AmHEaCGaB?q@?cCEkFCsECw@AoCAkNKeDCiEEcIG}DCqFE_HEwKEm@?{GIwBEgA?]?gBCaJKi@A_HGaAAiAAaGAq@AQ?eFCs@AoAAWAiCCaDCiFEcBAO?o@A{BAcECkEEmAA}FE{BCw@A_AA}ECeBCiIGgCA{FEkEEsAAc@AoFCa@?S?k@AwEEyBCsKKsDCmFEeCCiCIa@A]?}@CO?MAw@Ai@CoEIsGMg@Am@A_FKsBEaHOmBEqCEuBE[AE?eACE?YAy@Aw@E{@CE?wAI}AOwB[yBa@e@KSGc@Ky@W{@WGCmAc@UMg@S{@a@y@a@o@]IEc@Yy@g@YO[Su@g@q@g@m@g@i@e@a@]MKEEq@m@e@g@SSc@e@m@s@mAyAIK_@g@{DcFS[mAyAMQiA{AwFsH_FsGMQkGkIoGoI}@mAcCaDqAeBiEyF]e@y@eAEGwDcF_@g@aJwLIK[a@mDuE_FsGaByByAoBqCsDwEiG{BwCqD{EsAgBgAwAiCiDsAiBq@_AQW_FqGsCwDQUmBeC]e@eDmEo@{@{EoGsAgBMQoFiHyAoB{EoGcCcDqAcBuIiLuH_Ka@k@}DiFoIaLaFwG}EsGeAsAk@w@q@{@uCyDU[uHaKSYeAsAeCiDU[qIaLkEyFSY_BwBIKGIwEkGoBgCm@w@qBcCKMEESUc@c@SQKMqAeAe@_@g@_@IGsA{@uBuAgC{Ao@a@y@g@GEiBgA_@SgAq@q@c@o@a@MIiDuBi@[YQaGqDSM_@UoG{DwA{@eDsBcDoBuHuE_Ak@g@[}DaCkBiA}@k@s@c@QKOI{A_AgGwD_BaAcI}EKG_CyAqAw@_Ak@iDuBmFaDwBqA}@i@kAs@yEuCc@YQMw@e@oAu@cDsBEE{A}@iAq@MIOK]Sq@c@mDsBeAq@ECu@c@gAs@qAw@}@k@aBeAMGc@WiLeH{@g@[ScBeAIEc@WsEqCGEeIeFeEeCcCyAsEqCg@[iEkCIEeEkCs@a@eC{AYQyImFiFaDgAo@a@WgKmGeGuDmEoCeDqB_DqBeEeCYQcEgCw@g@_@WsDyBu@g@k@]eC{AgC}AeBeAe@[YQiFaDo@_@eGuD{@i@UMQK}@i@s@e@sAy@qBmA}@i@s@e@}DaC_BaAGGmEmCkDuByA_AUM{BuAgEiCyIoFsCgBGCyA}@oBmAkBiAeF_DuBqAQKoLkHeAq@}A_AECc@WcDqBmCaBeBeA_@U}BwAyA_AiAq@k@]m@_@oBmAeEiCoKsGEC_BaAkCaBWQcDoBGEq@a@uA{@gAq@_@Ui@]y@g@y@i@yAeAa@]_A}@w@aAq@aAm@cAWg@s@_BYs@k@aBg@iBOs@YoAcA_F{@mEwCcOAG]cB[{Aq@iDESGYESESGSEOEQQm@Qm@GWK]GWGUCMCOCK_@gBEUe@aCOm@GWGYIWCKEMUu@Wo@a@_A[q@[g@a@o@MQCEW[k@m@o@m@a@Yu@g@o@]{@]e@M]IkAWe@CE?m@Au@By@Hi@H[HSFEBmAd@e@Xk@^q@h@o@h@gA|@eCjBiChBQLmA|@aAl@aDlBe@Zu@h@aCbB_Ap@{@j@IFGF}AfAo@b@KHqAz@_ErCYR}@p@SLkBpAcAt@e@\\gGpEqDlCWPSLMHMHOHOHOFOHe@PIDSH[LoJrDSFcC~@m@TUJG@MD[HYDKBc@D[B]?W?]Am@Eg@Gk@Kc@Oc@Oe@Sw@e@_@[k@c@c@c@a@e@SWOUw@qAWi@CGWo@Sk@_@gAIU[eAg@aBsAoEi@gBy@mCmA{D_@mAWy@a@sAEMOi@Mc@Y}@aAeDMc@m@sBW}@iAyDWy@g@aB{@qCaBsFkA_ESq@K]{@{Cw@gCuBkHM_@Me@EOaAiDsBuHk@sBk@uB_@qAwA}Ee@_BQy@Kg@YuAQw@aAgDkA{Dm@uBAEwAsEgAsDQm@i@iB_AaD'
  },
  {
    trips: [{displayName: 'RB58 (24300)'}],
    mode: 'REGIONAL_RAIL',
    from: {name: 'Hanau Hauptbahnhof', lat: 50.12111000000001, lon: 8.929427},
    to: {
      name: 'Frankfurt (Main) Südbahnhof',
      lat: 50.099068,
      lon: 8.686112999999999
    },
    departure: '2026-07-10T02:02:00Z',
    arrival: '2026-07-10T02:23:00Z',
    scheduledDeparture: '2026-07-10T02:02:00Z',
    scheduledArrival: '2026-07-10T02:23:00Z',
    realTime: true,
    polyline:
      'sd|pHq{nu@OXy@fBIPKRiA~Bm@|@a@z@Wh@aAvBu@fBQj@Qn@St@WdACJKb@QdA}@nGADSnAMz@Mj@Mp@[hA]dAw@tBUl@WbAUfAKp@Il@MfAIlAEdBAx@@fA@n@D~BF|AL`BPrAL`ANx@R|@Rz@J^Nf@N^Tn@Rh@fG~NFP\\z@Zt@p@`Br@dBn@|Al@|AZ|@Ph@X`ANf@Jd@J^FZLr@Nv@J|@Hp@LlAH`AFvADhA@lA@x@?t@CfBEpAEn@C^KjAKlAKz@Ij@G`@o@nDAFQhA]jBaAlF]lBsAxHSvAUpBIdAIhAIpAEjAC~@AnAAnB@rA@x@@VDfCFfCTpIVdL~@h`@f@vTt@tZTjJBlADbBLrFbBxr@dAnb@HdE`@vO@r@ZvLFpBPnHLjFJxDr@`ZN`GDtBVxJ@z@Bx@DdAJrED|AJ|CBjA@XD~@H~AHpABb@Fp@JjANrAPxA\\`CRvAJh@@JH\\VrAZzAT|@p@nCjAfEbC~ItFtSlC~JfA~Db@`Bb@|AbBjG@DjCrJ`DlLr@`C|AdFBHnA|Dp@rB~HxVJZBHtFhQNf@rF`Qz@nCn@pBnBdG`@tAdAfDr@~Bd@hB^zA\\dBFZNx@V|ATxAHp@Hl@NvALtAVxDHzAJ`CB`@H`C@P?JFxADlAD|@NzE@NRjFDhAHpALdBH~@HbAj@|F@DN`B@Ld@bF\\hDHt@x@tIXtCHl@^|DH|@^rDd@bFD\\@JZ~C?DNzA?D@H@D?D@JNvALrAZhDVlCPdBJfAPlBh@pFDf@D^Fn@Fn@Ff@Ft@VrCRxBPdCFz@TrCZbE@JF|@T|C?HDl@F|@BbABz@@dA?lAAtAA\\Ad@Ch@Cj@Ch@Gn@En@Gj@OlAQhACPGXOt@Ml@GXI\\k@`CEJEP_BrGc@bBcFlSKd@c@fBa@~AqD|NIZ_AtDqB~Hk@|Be@nBCHQv@WbASbAs@jEo@vF[pFKbE?hF@|ABhABbAf@`Ub@hSJfETfL@`BBzG@fD?x@@nAD~GHtZ@fD?n@@jB@fA?jB@rB@dB@jCDdDD`EJxCDx@J`B@HPtBRrBz@tG@FHl@ZzBj@jE`@~CDVFh@Jp@b@fCf@pDXbCNlA^lCF^N~@XnATv@Pj@Pf@Rl@l@nA^v@Td@v@`BDH^v@b@dADFDLN`@FN`@hAHRZz@d@rADNFNJ^'
  },
  {
    trips: [{displayName: 'RB68 (15301)'}],
    mode: 'REGIONAL_RAIL',
    from: {
      name: 'Frankfurt (Main) Hauptbahnhof',
      lat: 50.106472000000004,
      lon: 8.662692000000002
    },
    to: {name: 'Langen (Hessen) Bahnhof', lat: 49.993546, lon: 8.656926},
    departure: '2026-07-10T02:06:00Z',
    arrival: '2026-07-10T02:16:00Z',
    scheduledDeparture: '2026-07-10T02:06:00Z',
    scheduledArrival: '2026-07-10T02:15:00Z',
    realTime: true,
    polyline:
      'klypH}|zs@t@jCr@fCBHNf@DN@FX`An@~BZjARz@Lb@BPDLH\\n@xBj@vAVp@Tj@j@vAb@vAf@dBHXZdAh@jBDL\\pALf@@Hr@pCt@pCZlA`@nARh@FLJTBDl@bA\\d@FHPRDDNLRRRNPL`@TRJ\\LVHPDHBTDNBT@L@X?\\?`@Ch@KTGXIXMRKTOPKNKNOHGFGPQX[^a@hAsAPSp@w@v@}@dAqArDgEf@m@fE{E\\c@V[\\e@LUNYNYTg@Vk@`@kA`@oAb@sBFWT}AN}Ab@oF@EDw@Hw@L{AFk@Hy@Hm@LaAHe@Fa@Jk@Hc@Ha@Li@XiANo@V_ARs@Ne@L_@Ri@Ne@Vs@xA_DbAkBnAiBh@q@|@gAp@q@bAaAjA}@DCh@c@f@[j@Y`Ag@^QTKj@SbA]fAWj@K\\IVEr@G|@Ip@Cj@Ab@?^?t@@`@Bt@DN@~ALvGf@^DR@vKz@zBNbF^vBR`@BbF^fDVfE\\bAHnDXfJt@|DX`AHnBN`@Dx@F`BLrCTbCRZ@bEZz@HN@`BNtBN`CP|ALdHh@jDX~Jx@tCR^BfCTbCPdAFP@~BT~BPr@Dj@F`AFnALh@DfBNlAJz@HvCV`BPl@Dp@FhBPjAJ`AHn@Dz@FdDTh@B|@Fl@DvCPtCTf@D~Fb@tAJjJt@D?PBD?bAJdGd@x@FdBNlCRbAHdAHfHh@dF`@fM`AzE`@zE\\nDZdAFrAJxE^VBfBNb@BRBbGd@dCPhPpAVB|ALfBLhHj@vOlAP@L@\\BtHl@P@|Ir@`Jp@xIp@dF^~ANN@jJr@D?z@HhAHvOnApAJrAJzALl@Dv@FpCTtCTlAHzJv@|E^`CRbAHlDVzDZF@'
  },
  {
    trips: [{displayName: 'S6'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Louisa Bahnhof',
      lat: 50.083679999999994,
      lon: 8.670312999999998
    },
    to: {
      name: 'Frankfurt (Main) Stresemannallee Bahnhof',
      lat: 50.09454,
      lon: 8.671271999999998
    },
    departure: '2026-07-10T01:59:00Z',
    arrival: '2026-07-10T02:01:00Z',
    scheduledDeparture: '2026-07-10T01:59:00Z',
    scheduledArrival: '2026-07-10T02:01:00Z',
    realTime: true,
    polyline:
      '_~tpH}k|s@y@EoAG_@Aa@?]?u@@G@c@B{@F[B[Fw@Lk@Ji@N}@Te@Ni@Tw@\\mBbAEBc@Xm@b@GD}AnAaBvA[Tc@\\YPEB}@b@uAZYDI@c@@{@Cy@Ku@Qg@Sk@_@II_@[k@k@k@w@a@s@Q]IWYm@GMSg@g@iAu@eBk@qAO_@MYM_@CI'
  },
  {
    trips: [{displayName: 'S6'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Stresemannallee Bahnhof',
      lat: 50.09454,
      lon: 8.671271999999998
    },
    to: {
      name: 'Frankfurt (Main) Südbahnhof',
      lat: 50.099030000000006,
      lon: 8.685512000000001
    },
    departure: '2026-07-10T02:01:00Z',
    arrival: '2026-07-10T02:03:00Z',
    scheduledDeparture: '2026-07-10T02:01:00Z',
    scheduledArrival: '2026-07-10T02:03:00Z',
    realTime: true,
    polyline:
      'mbwpHyq|s@M[GSGSCIOa@M]ISQk@K]Ia@Kk@SoAIa@]aCa@mCo@mFk@qDs@{E}@{F[sB]oB]eBCGe@_CKa@Ma@GUq@{BCIOu@UmAI]I[Og@AGISM_@e@uAu@wBk@}A'
  },
  {
    trips: [{displayName: 'S6'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Südbahnhof',
      lat: 50.099030000000006,
      lon: 8.685512000000001
    },
    to: {name: 'Frankfurt (Main) Lokalbahnhof', lat: 50.101936, lon: 8.692943},
    departure: '2026-07-10T02:03:00Z',
    arrival: '2026-07-10T02:05:00Z',
    scheduledDeparture: '2026-07-10T02:03:00Z',
    scheduledArrival: '2026-07-10T02:05:00Z',
    realTime: true,
    polyline:
      '}}wpHmk_t@Qi@Uq@GMIY[{@Sk@M_@M[[u@q@yAkAcCO]Ym@EKO]M[KUIUQg@aAyCM_@Mc@EQOk@Om@I]I]E]CMO_Ag@_D'
  },
  {
    trips: [{displayName: 'S6'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Lokalbahnhof',
      lat: 50.101936,
      lon: 8.692943
    },
    to: {
      name: 'Frankfurt (Main) Ostendstraße',
      lat: 50.112495,
      lon: 8.697118999999999
    },
    departure: '2026-07-10T02:05:00Z',
    arrival: '2026-07-10T02:07:00Z',
    scheduledDeparture: '2026-07-10T02:05:00Z',
    scheduledArrival: '2026-07-10T02:07:00Z',
    realTime: true,
    polyline:
      'mqxpHay`t@CMEWCS]uBAGUwAO_A[yAk@uBSi@]}@aAoBWe@q@{@eA_Ak@[u@_@aA_@c@Mi@Mo@Kw@OaBYw@MkCe@m@M_B[IAqAWuDSyADyAX_Bh@gAn@g@f@KJy@x@i@h@GF[\\KHq@r@'
  },
  {
    trips: [{displayName: 'S6'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Ostendstraße',
      lat: 50.112495,
      lon: 8.697118999999999
    },
    to: {
      name: 'Frankfurt (Main) Konstablerwache',
      lat: 50.114708,
      lon: 8.684584000000001
    },
    departure: '2026-07-10T02:07:00Z',
    arrival: '2026-07-10T02:08:00Z',
    scheduledDeparture: '2026-07-10T02:07:00Z',
    scheduledArrival: '2026-07-10T02:08:00Z',
    realTime: true,
    polyline:
      'crzpH_tat@UVQNKLg@f@c@h@g@l@[b@]l@Yj@IRYr@Wr@ADEPQn@CFQt@Ov@GXG`@Mx@Ih@UrBAHEb@AXCXKxBEhB?LAX?bB?\\?z@@p@@z@RnCFv@Bh@@Z?pD?b@?P?h@AbC?H?FAjB?nA@z@'
  },
  {
    trips: [{displayName: 'S6'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Konstablerwache',
      lat: 50.114708,
      lon: 8.684584000000001
    },
    to: {
      name: 'Frankfurt (Main) Hauptwache',
      lat: 50.114059999999995,
      lon: 8.678142999999999
    },
    departure: '2026-07-10T02:09:00Z',
    arrival: '2026-07-10T02:10:00Z',
    scheduledDeparture: '2026-07-10T02:09:00Z',
    scheduledArrival: '2026-07-10T02:10:00Z',
    realTime: true,
    polyline:
      'w_{pHue_t@?Z@TB|@Bf@B`@HbAFl@D`@Jx@@FBJRtADXHl@PlAB^Fj@BRHdBDx@A^GpBEvAEdAAf@AH?HAR'
  },
  {
    trips: [{displayName: 'S6'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Hauptwache',
      lat: 50.114059999999995,
      lon: 8.678142999999999
    },
    to: {
      name: 'Frankfurt (Main) Taunusanlage',
      lat: 50.113482999999995,
      lon: 8.668766
    },
    departure: '2026-07-10T02:10:00Z',
    arrival: '2026-07-10T02:12:00Z',
    scheduledDeparture: '2026-07-10T02:10:00Z',
    scheduledArrival: '2026-07-10T02:12:00Z',
    realTime: true,
    polyline:
      'e|zpHm}}s@Ct@Ex@Ex@Ex@GdAI|@AHMrAIz@C^C\\El@AZEj@E^OlAK~@Gn@ALC`@Eb@A`B@ZBfBHvAd@~Cj@tBVh@`@|@pA|B`@n@'
  },
  {
    trips: [{displayName: 'S7'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Hauptbahnhof',
      lat: 50.106903,
      lon: 8.662241
    },
    to: {
      name: 'Frankfurt (Main) Niederrad Bahnhof',
      lat: 50.081061999999996,
      lon: 8.637008999999999
    },
    departure: '2026-07-10T01:58:00Z',
    arrival: '2026-07-10T02:03:00Z',
    scheduledDeparture: '2026-07-10T01:58:00Z',
    scheduledArrival: '2026-07-10T02:02:00Z',
    realTime: true,
    polyline:
      '_oypHczzs@dBlGPj@bAfDZdATt@@FPp@Pz@RdANr@\\bB^hBd@zA@Db@zAf@bBd@bBd@~AvA|E^pAj@tBj@rBrBtH`AhDDNLd@L^tBjHv@fCz@zCJZRr@jA~D`BrFz@pCf@`BVx@hAxDV|@l@rBLb@`AdDX|@Lb@Nh@DL`@rAVx@^lAlAzDx@lCh@fBrAnEf@~AZfAHT^fARj@Vn@BFVh@v@pANTRV`@d@b@b@j@b@ZXz@f@d@Rb@Nb@Nj@Jf@Fj@D^@V?\\?ZCb@EJCXEZILEFATKl@UbC_ARGnJsDVKVKHEd@QNINGNINILILIRMROtDoCfGqE`@[fAw@jBqARMj@_@l@]f@S`Ai@HEHGrCgBLK~@m@rA}@'
  },
  {
    trips: [{displayName: 'S7'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Niederrad Bahnhof',
      lat: 50.081061999999996,
      lon: 8.637008999999999
    },
    to: {
      name: 'Frankfurt (Main) Stadion',
      lat: 50.067795000000004,
      lon: 8.632444000000001
    },
    departure: '2026-07-10T02:04:00Z',
    arrival: '2026-07-10T02:06:00Z',
    scheduledDeparture: '2026-07-10T02:03:00Z',
    scheduledArrival: '2026-07-10T02:05:00Z',
    realTime: true,
    polyline:
      'omtpH{{us@nA}@z@o@r@g@`Au@RQh@c@d@]xAgAv@g@n@c@j@_@dBkAPOpA_AbAu@rAcAnAcAf@c@r@k@j@]d@YjAe@DCTGVGh@Kx@It@Cp@@H@\\BhAR^Jb@Lz@Zl@\\p@d@d@\\l@l@j@n@VZBDLP`@l@Xh@Zl@`@~@Tn@Tr@Rr@Lh@d@vB^jBjA~FBJDVPt@DRFVHT\\lATx@DRFRFTTbAh@nCh@jCHd@'
  },
  {
    trips: [{displayName: 'S7'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Stadion',
      lat: 50.067795000000004,
      lon: 8.632444000000001
    },
    to: {
      name: 'Neu-Isenburg-Zeppelinheim Bahnhof',
      lat: 50.036297,
      lon: 8.604942
    },
    departure: '2026-07-10T02:07:00Z',
    arrival: '2026-07-10T02:09:00Z',
    scheduledDeparture: '2026-07-10T02:06:00Z',
    scheduledArrival: '2026-07-10T02:09:00Z',
    realTime: true,
    polyline:
      'g{qpHk_us@zAtHbAdFbAbFZnAPt@d@fBh@`BXv@p@vAZl@l@bAr@bAv@`A~@|@j@d@pA~@TNb@Vv@f@\\RLH^TdDrBn@`@LFjAt@`BbApFfDDBjKpG`HfERLtAz@jAr@TNdAn@dCzAVPdCzAhBhAjElCDBzA~@dAn@vD~BrAv@~DfCjBhA^TfEhChBhAnBlA|A~@xChBtFhDp@b@tG~D~A`AlBlApAv@zA|@rHtE|DbCd@XlAr@nBnA'
  },
  {
    trips: [{displayName: 'S7'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Neu-Isenburg-Zeppelinheim Bahnhof',
      lat: 50.036297,
      lon: 8.604942
    },
    to: {
      name: 'Mörfelden-Walldorf-Walldorf Bahnhof',
      lat: 50.00154,
      lon: 8.580910999999999
    },
    departure: '2026-07-10T02:10:00Z',
    arrival: '2026-07-10T02:13:00Z',
    scheduledDeparture: '2026-07-10T02:10:00Z',
    scheduledArrival: '2026-07-10T02:13:00Z',
    realTime: true,
    polyline:
      'yukpHatos@tAz@dBdATLz@h@fAp@LHZPlEnCrAx@DBjAt@j@\\l@^hAr@dCxAnAv@fC|Ab@XfAp@rEpCv@f@dBfAzA~@XPdJvFdDrBnElCdGtDfKlG`@VhHjEFDvIlFZPbCzAr@`@zK|G\\RrErCHDDB|BvAbEbCfIbFlJ|FnDxBj@\\bHfEd@XJH\\RbAp@r@b@PJjBhAn@`@xBpAlBjA'
  },
  {
    trips: [{displayName: 'S3'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Lokalbahnhof',
      lat: 50.101936,
      lon: 8.692943
    },
    to: {
      name: 'Frankfurt (Main) Ostendstraße',
      lat: 50.112495,
      lon: 8.697118999999999
    },
    departure: '2026-07-10T02:00:00Z',
    arrival: '2026-07-10T02:02:00Z',
    scheduledDeparture: '2026-07-10T02:00:00Z',
    scheduledArrival: '2026-07-10T02:01:00Z',
    realTime: true,
    polyline:
      'mqxpHay`t@CMEWCS]uBAGUwAO_A[yAk@uBSi@]}@aAoBWe@q@{@eA_Ak@[u@_@aA_@c@Mi@Mo@Kw@OaBYw@MkCe@m@M_B[IAqAWuDSyADyAX_Bh@gAn@g@f@KJy@x@i@h@GF[\\KHq@r@'
  },
  {
    trips: [{displayName: 'S3'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Ostendstraße',
      lat: 50.112495,
      lon: 8.697118999999999
    },
    to: {
      name: 'Frankfurt (Main) Konstablerwache',
      lat: 50.114708,
      lon: 8.684584000000001
    },
    departure: '2026-07-10T02:02:00Z',
    arrival: '2026-07-10T02:03:00Z',
    scheduledDeparture: '2026-07-10T02:02:00Z',
    scheduledArrival: '2026-07-10T02:03:00Z',
    realTime: true,
    polyline:
      'crzpH_tat@UVQNKLg@f@c@h@g@l@[b@]l@Yj@IRYr@Wr@ADEPQn@CFQt@Ov@GXG`@Mx@Ih@UrBAHEb@AXCXKxBEhB?LAX?bB?\\?z@@p@@z@RnCFv@Bh@@Z?pD?b@?P?h@AbC?H?FAjB?nA@z@'
  },
  {
    trips: [{displayName: 'S3'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Konstablerwache',
      lat: 50.114708,
      lon: 8.684584000000001
    },
    to: {
      name: 'Frankfurt (Main) Hauptwache',
      lat: 50.114059999999995,
      lon: 8.678142999999999
    },
    departure: '2026-07-10T02:04:00Z',
    arrival: '2026-07-10T02:05:00Z',
    scheduledDeparture: '2026-07-10T02:04:00Z',
    scheduledArrival: '2026-07-10T02:05:00Z',
    realTime: true,
    polyline:
      'w_{pHue_t@?Z@TB|@Bf@B`@HbAFl@D`@Jx@@FBJRtADXHl@PlAB^Fj@BRHdBDx@A^GpBEvAEdAAf@AH?HAR'
  },
  {
    trips: [{displayName: 'S3'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Hauptwache',
      lat: 50.114059999999995,
      lon: 8.678142999999999
    },
    to: {
      name: 'Frankfurt (Main) Taunusanlage',
      lat: 50.113482999999995,
      lon: 8.668766
    },
    departure: '2026-07-10T02:06:00Z',
    arrival: '2026-07-10T02:07:00Z',
    scheduledDeparture: '2026-07-10T02:05:00Z',
    scheduledArrival: '2026-07-10T02:06:00Z',
    realTime: true,
    polyline:
      'e|zpHm}}s@Ct@Ex@Ex@Ex@GdAI|@AHMrAIz@C^C\\El@AZEj@E^OlAK~@Gn@ALC`@Eb@A`B@ZBfBHvAd@~Cj@tBVh@`@|@pA|B`@n@'
  },
  {
    trips: [{displayName: 'S3'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Taunusanlage',
      lat: 50.113482999999995,
      lon: 8.668766
    },
    to: {
      name: 'Frankfurt (Main) Hauptbahnhof tief',
      lat: 50.10714,
      lon: 8.662477
    },
    departure: '2026-07-10T02:07:00Z',
    arrival: '2026-07-10T02:08:00Z',
    scheduledDeparture: '2026-07-10T02:07:00Z',
    scheduledArrival: '2026-07-10T02:08:00Z',
    realTime: true,
    polyline:
      'exzpH{b|s@bBhCLP~@jA\\b@^ZrAjAj@Xp@\\NFPHZNRHn@TFBtBj@t@ZbAb@ZJVNbAp@dAt@\\ZVVPPLPHNJVJRf@dAz@hBFNBHDLRp@d@|A'
  },
  {
    trips: [{displayName: 'S3'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Hauptbahnhof tief',
      lat: 50.10714,
      lon: 8.662477
    },
    to: {
      name: 'Frankfurt (Main) Galluswarte',
      lat: 50.1042,
      lon: 8.644521999999998
    },
    departure: '2026-07-10T02:09:00Z',
    arrival: '2026-07-10T02:11:00Z',
    scheduledDeparture: '2026-07-10T02:09:00Z',
    scheduledArrival: '2026-07-10T02:11:00Z',
    realTime: true,
    polyline:
      'cpypH}{zs@Ph@v@pCdAjDPh@h@fBp@xBTp@dAjDDNBDz@jCb@nABLhBpFBLf@hBdAlDL`@l@fB`@hAv@`CXz@JZp@zBNh@FXBLZxALn@Hl@Fh@B\\@NB^B\\@Z@d@?n@Aj@Af@Ab@Cb@Gl@EZE\\EXEVGVEVGTCHIXUr@a@~@Q^KPOVo@z@QRo@n@m@h@[ZGFQPu@p@'
  },
  {
    trips: [{displayName: 'S6'}],
    mode: 'SUBURBAN',
    from: {name: 'Bad Vilbel Bahnhof', lat: 50.188410000000005, lon: 8.739714},
    to: {name: 'Bad Vilbel Südbahnhof', lat: 50.178474, lon: 8.732834},
    departure: '2026-07-10T02:10:00Z',
    arrival: '2026-07-10T02:12:00Z',
    scheduledDeparture: '2026-07-10T02:10:00Z',
    scheduledArrival: '2026-07-10T02:12:00Z',
    realTime: true,
    polyline:
      'sliqH_~it@~Bv@nDnAXL|ElCl@Xd@RpAb@xCbAz@X~MnE|Al@\\LXNTN^Vd@`@f@d@ZX\\`@\\f@\\f@^p@\\p@Zt@Tn@\\`AZbAJV'
  },
  {
    trips: [{displayName: 'S7'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Niederrad Bahnhof',
      lat: 50.081089999999996,
      lon: 8.637106
    },
    to: {name: 'Frankfurt (Main) Hauptbahnhof', lat: 50.106903, lon: 8.662241},
    departure: '2026-07-10T01:59:00Z',
    arrival: '2026-07-10T02:04:00Z',
    scheduledDeparture: '2026-07-10T01:59:00Z',
    scheduledArrival: '2026-07-10T02:04:00Z',
    realTime: true,
    polyline:
      'ymtpH}|us@_BhAo@b@KHqAz@_ErCYR}@p@SLkBpAcAt@e@\\gGpEqDlCWPSLMHMHOHOHOFOHe@PIDSH[LoJrDSFcC~@m@TUJG@MD[HYDKBc@D[B]?W?]Am@Eg@Gk@Kc@Oc@Oe@Sw@e@_@[k@c@c@c@a@e@SWOUw@qAWi@CGWo@Sk@_@gAIU[eAg@aBsAoEi@gBy@mCmA{D_@mAWy@a@sAEMOi@Mc@Y}@aAeDMc@m@sBW}@iAyDWy@g@aB{@qCaBsFkA_ESq@K]{@{Cw@gCuBkHM_@Me@EOaAiDsBuHk@sBk@uB_@qAwA}Ee@_Be@cBg@cBc@{AAEe@{A_@iB]cBOs@SeAQ{@Qq@AGUu@[eAcAgDQk@eBmG'
  },
  {
    trips: [{displayName: 'S8'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Flughafen Regionalbahnhof',
      lat: 50.051143999999994,
      lon: 8.571204
    },
    to: {
      name: 'Frankfurt (Main) Gateway Gardens',
      lat: 50.056582999999996,
      lon: 8.594049
    },
    departure: '2026-07-10T02:00:00Z',
    arrival: '2026-07-10T02:02:00Z',
    scheduledDeparture: '2026-07-10T01:57:00Z',
    scheduledArrival: '2026-07-10T01:59:00Z',
    realTime: true,
    polyline:
      'srnpHaais@]uB{@mFw@}Eg@}Ca@uCOeAGg@Km@Gc@k@qDeAcGqAqF]{@sAcDiA}BeAgB]k@_@k@OWKOQ[IQGMO[Qc@Si@Ma@Kc@S{@O_AOcAQcBs@oGY}BMkAUmBMwAIkAEgACyA@gBB{@DaAFaBFuAJkD@UHuD'
  },
  {
    trips: [{displayName: 'S8'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Gateway Gardens',
      lat: 50.056582999999996,
      lon: 8.594049
    },
    to: {
      name: 'Frankfurt (Main) Stadion',
      lat: 50.068220000000004,
      lon: 8.632622
    },
    departure: '2026-07-10T02:03:00Z',
    arrival: '2026-07-10T02:05:00Z',
    scheduledDeparture: '2026-07-10T01:59:00Z',
    scheduledArrival: '2026-07-10T02:03:00Z',
    realTime: true,
    polyline:
      'utopHyoms@FiCNiG?MHgFDmBBwB@kDFwCFmCDgCF{BBwADqBBeC?eBC{@ImBQgBS_BUyA]aBi@qBy@}BWi@Uc@S_@CGWc@_@m@]c@m@m@mAcAw@i@YM}@c@w@Yg@K{B[eCB}A?e@@Y?sCKs@I}@Ou@Qy@[q@][Sy@m@{@w@aAiA]g@QWOYS]Sa@Q]Qc@Qc@Qg@Qg@Me@Oi@Kg@Mg@Mu@Mu@E[E_@E]E[Ek@Ek@CWAYAYCe@A[Ak@Ak@?y@AkDEaK?i@AcCAqD?gA?mAAmAAm@Am@CcACi@C_ACi@GsAAK[wGImBAWCa@C[OsBKeAMqAMcAKw@OgASkAGa@]kB]kBIg@a@qB'
  },
  {
    trips: [{displayName: 'S8'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Stadion',
      lat: 50.068220000000004,
      lon: 8.632622
    },
    to: {
      name: 'Frankfurt (Main) Niederrad Bahnhof',
      lat: 50.080943999999995,
      lon: 8.636954
    },
    departure: '2026-07-10T02:06:00Z',
    arrival: '2026-07-10T02:08:00Z',
    scheduledDeparture: '2026-07-10T02:03:00Z',
    scheduledArrival: '2026-07-10T02:05:00Z',
    realTime: true,
    polyline:
      'k}qpH{`us@SiAi@oCMm@o@gDAIa@wB_@kBaAgFCKe@_CEWe@{BQo@Me@Us@Sk@Wk@[s@Wc@MUS[OSYa@k@q@k@i@a@]u@g@i@Y{@_@[Iw@Qy@Kk@Em@?e@@k@DcAPq@Rg@NWLq@\\i@^EBm@b@}ApAeDbCiDbCgAv@kAt@iAr@}@l@kA~@}AlAYROJ_Ar@aAp@'
  },
  {
    trips: [{displayName: 'S8'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Niederrad Bahnhof',
      lat: 50.080943999999995,
      lon: 8.636954
    },
    to: {
      name: 'Frankfurt (Main) Hauptbahnhof tief',
      lat: 50.10714,
      lon: 8.662477
    },
    departure: '2026-07-10T02:09:00Z',
    arrival: '2026-07-10T02:13:00Z',
    scheduledDeparture: '2026-07-10T02:06:00Z',
    scheduledArrival: '2026-07-10T02:12:00Z',
    realTime: true,
    polyline:
      '{ltpH}{us@GDKF}@n@}@n@GBYRiAr@u@d@cAn@IFGDqAx@e@ZaAr@YPa@XaBlAc@\\mBtAKFgBrAoEdD_Ap@_BbAMHcBz@wI|DQFw@\\_A\\m@P]H[F[DUBYB[@]?Y?K?QAUAWCYE[EWGk@Oe@Q_@Oi@Wi@_@}@u@s@q@i@q@a@i@a@u@g@_A_@y@Ys@Sg@Qg@Sk@{@oCMc@IYwA_Fi@iBGUyBsHOg@i@mBK[q@_C}@yCuAyEwAuE{@oCc@wAWy@]gA[gAY_AWy@s@_CUu@Sq@a@qAu@gCW_A_@sAQi@]mAEKg@cBGWQo@iA{DUw@EMAE{AsFEQ]sAYkAOi@cAeEqAyEOo@g@iBmAgEcB_Gc@uAe@yAiAsDy@sCsAoEe@cBQk@AE'
  },
  {
    trips: [{displayName: 'S8'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Südbahnhof',
      lat: 50.09897000000001,
      lon: 8.685764
    },
    to: {
      name: 'Offenbach (Main)-Zentrum Hauptbahnhof',
      lat: 50.098892000000006,
      lon: 8.758987
    },
    departure: '2026-07-10T01:56:00Z',
    arrival: '2026-07-10T02:02:00Z',
    scheduledDeparture: '2026-07-10T01:56:00Z',
    scheduledArrival: '2026-07-10T02:00:00Z',
    realTime: true,
    polyline:
      's}wpH_m_t@K]_@gASk@]aAYw@M]Ui@Se@O_@EIc@}@Yk@KS_@q@a@w@u@cBk@yAa@qAIYGSU}@WoACGMs@g@oDWwBw@iG]mCIs@Gi@EWa@_Dk@kE[{BIm@AG{@uGSsBQuBAIKaBEy@KyCEaEEeDAkCAeBAsB?kBAgAAkB?o@AgDIuZE_HAoA?y@AgDC{GAaBUgLKgEc@iSg@aUCcACiAA}A?iFJcEZqFn@wFr@kERcAVcAPw@BId@oBj@}BpB_I~@uDH[pD}N`@_Bb@gBJe@bFmSb@cB~AsGDQDKj@aCH]FYLm@Nu@FYBQPiANmAFk@Do@Fo@Bi@Bk@Bi@@e@@]@uA?mAAeAC{@CcAG}@Em@?IU{CG_AAK[cEUsCG{@QeC'
  },
  {
    trips: [{displayName: 'S8'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Offenbach (Main)-Zentrum Hauptbahnhof',
      lat: 50.098892000000006,
      lon: 8.758987
    },
    to: {
      name: 'Offenbach (Main)-Offenbach Ost Ostbahnhof',
      lat: 50.10275300000001,
      lon: 8.784505
    },
    departure: '2026-07-10T02:03:00Z',
    arrival: '2026-07-10T02:04:00Z',
    scheduledDeparture: '2026-07-10T02:01:00Z',
    scheduledArrival: '2026-07-10T02:04:00Z',
    realTime: true,
    polyline:
      'k}wpHqvmt@QuBWsCGu@Gg@Go@Go@E_@Eg@i@qFQmBKgAQeBWmC[iDMsAOwAAK?EAEAI?EO{A?E[_DAKE]e@cF_@sDI}@_@}DIm@YuCy@uIIu@]iDe@cFAMOaBAEk@}FIcAI_AMeBIqAEiASkFAOO{EE}@EmAGyA?KAQEqA'
  },
  {
    trips: [{displayName: 'S8'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Offenbach (Main)-Offenbach Ost Ostbahnhof',
      lat: 50.10275300000001,
      lon: 8.784505
    },
    to: {name: 'Mühlheim (Main) Bahnhof', lat: 50.11932, lon: 8.83818},
    departure: '2026-07-10T02:05:00Z',
    arrival: '2026-07-10T02:08:00Z',
    scheduledDeparture: '2026-07-10T02:05:00Z',
    scheduledArrival: '2026-07-10T02:09:00Z',
    realTime: true,
    polyline:
      'wuxpHavrt@Co@Ca@KaCI{AWyDMuAOwAIm@Iq@UyAW}AMw@I]]eB_@{Ae@iBs@_CeAgDa@uAoBeGo@qB{@oCsFaQOg@uFiQCIK[_IyVq@sBoA}DCI}AeFs@aCaDmLkCsJAEcBkGc@}Ac@aBgA_EmC_KuFuScC_JkAgEq@oCU}@[{AWsAI]AKKi@SwA]aCQyAOsAKkAGq@Cc@IqAI_BE_AAYCkAK}CE}AKsEEeACy@A{@WyJEuBO_G'
  },
  {
    trips: [{displayName: 'S9'}],
    mode: 'SUBURBAN',
    from: {name: 'Raunheim Bahnhof', lat: 50.009530000000005, lon: 8.454294},
    to: {name: 'Kelsterbach Bahnhof', lat: 50.061855, lon: 8.528861999999998},
    departure: '2026-07-10T02:05:00Z',
    arrival: '2026-07-10T02:09:00Z',
    scheduledDeparture: '2026-07-10T02:04:00Z',
    scheduledArrival: '2026-07-10T02:09:00Z',
    realTime: true,
    polyline:
      'qnfpHkfrr@cAyB[q@Sa@GOe@aAoAmCEIEIQ_@uCgGgBmDm@eAiBaD_BqCS_@u@mA{AaCoCcEsAqBsAkBmBgCyBsC{CuDyCuD{@eAiEkFW[EGaAmAeLoNoCiDmCeDeKkMkB}BsDsEa@g@g@m@gAuAqCiD}MqPiCcDiCaD_AkAcDaE}CuDmBcCm@u@}CyDuUuYcBsBgDgEgDcEgAuAgAsAeBwBwAkB_BwB}A{B}A_C}AcCg@w@_A{Aq@kAq@kAmA{BmA}Bi@eAg@aAkAeCcAuBo@yAQ]cBsDq@{AkM}XqHgPe@eAYm@O_@e@cAy@gBw@cBkBeEyA_D{AgDwCoG_BmD_BkDyAeDiB_EeCqF{@sBYo@cAiCi@sAg@kAa@_Aa@_A[u@Sg@Sk@s@oBQa@Ws@Ug@c@cAO]'
  },
  {
    trips: [{displayName: 'S9'}],
    mode: 'SUBURBAN',
    from: {name: 'Kelsterbach Bahnhof', lat: 50.061855, lon: 8.528861999999998},
    to: {
      name: 'Frankfurt (Main) Flughafen Regionalbahnhof',
      lat: 50.051143999999994,
      lon: 8.571204
    },
    departure: '2026-07-10T02:10:00Z',
    arrival: '2026-07-10T02:14:00Z',
    scheduledDeparture: '2026-07-10T02:09:00Z',
    scheduledArrival: '2026-07-10T02:13:00Z',
    realTime: true,
    polyline:
      'ouppHox`s@EIa@{@i@eAm@eAa@q@o@iAS[w@yAq@uA[q@Ys@Si@Si@e@wA]kAc@aBCMIWI[e@wB[{AWoAWaBOmAMy@Ec@MqAI{@KeAGeAGgAGgAEmAEoAE{BAa@?oAAoA?qA@qADkD@i@Bi@Bm@Bg@Dq@Ds@Fo@Fq@Hk@Fm@Hi@L_APy@Nw@R}@Le@J]HYRq@Ro@Tm@Vo@Rc@Pa@h@cAf@{@f@w@^g@\\c@`@c@^a@FETU\\[n@e@l@a@l@]n@[`@QbA[dAY|@O^EXA^A\\A\\Ah@@L?X@XBd@Db@Fv@Lv@Nt@Pz@TjA\\rAZtAZh@Hh@F|@H\\@\\@|@Az@En@Gn@Il@Ml@Qj@Qh@Sj@Wh@Yv@g@\\UZWZWZ[XYZ]TWTYj@u@Zg@Zg@Xg@P_@Ra@N]rAkDX_AV}@R}@RaADQVaB\\eCTcCNiCHeDAoBAyBKyCMoCoAsSCYYqFSoCQqBu@cFi@cDw@aF'
  },
  {
    trips: [{displayName: 'S8'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Offenbach (Main)-Offenbach Ost Ostbahnhof',
      lat: 50.10275300000001,
      lon: 8.784505
    },
    to: {
      name: 'Offenbach (Main)-Zentrum Marktplatz',
      lat: 50.10530500000001,
      lon: 8.764909999999999
    },
    departure: '2026-07-10T02:00:00Z',
    arrival: '2026-07-10T02:01:00Z',
    scheduledDeparture: '2026-07-10T01:58:00Z',
    scheduledArrival: '2026-07-10T02:00:00Z',
    realTime: true,
    polyline:
      'qtxpHgvrt@@ZDnA@V@p@Bx@@n@?J@b@@PFpE@N@j@@j@Bf@J`DFfA`@rGF`B@`A?n@A`@A`@Ex@Gv@Ed@CPQlA[dB{AbHg@`CU`Ai@fCoBfJs@~CUx@a@|A]lAU~@_@nB_@bCg@lF[dC'
  },
  {
    trips: [{displayName: 'S8'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Offenbach (Main)-Zentrum Marktplatz',
      lat: 50.10530500000001,
      lon: 8.764909999999999
    },
    to: {
      name: 'Offenbach (Main)-Westend Ledermuseum',
      lat: 50.106030000000004,
      lon: 8.751166
    },
    departure: '2026-07-10T02:02:00Z',
    arrival: '2026-07-10T02:03:00Z',
    scheduledDeparture: '2026-07-10T02:01:00Z',
    scheduledArrival: '2026-07-10T02:02:00Z',
    realTime: true,
    polyline:
      'kfypHi|nt@Gb@[vBc@rD}@|GIr@QnAQzACZGr@CVKhBA^EvB?V@x@@jA@n@DxA@RHjCF~AB`AJlCD`AZnG\\vH@l@Bv@@n@'
  },
  {
    trips: [{displayName: 'S8'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Offenbach (Main)-Westend Ledermuseum',
      lat: 50.106030000000004,
      lon: 8.751166
    },
    to: {
      name: 'Offenbach (Main)-Kaiserlei Kaiserlei',
      lat: 50.105267,
      lon: 8.738490999999998
    },
    departure: '2026-07-10T02:04:00Z',
    arrival: '2026-07-10T02:05:00Z',
    scheduledDeparture: '2026-07-10T02:03:00Z',
    scheduledArrival: '2026-07-10T02:04:00Z',
    realTime: true,
    polyline:
      'kiypHyelt@JjDRnI@PDlCBbBBvC?JJ`E?FDtAD|A@X@d@@`@?^?v@@Z?Z@X@^@j@HjCJbDDtA?FF|B?LFzBJvE'
  },
  {
    trips: [{displayName: 'S8'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Offenbach (Main)-Kaiserlei Kaiserlei',
      lat: 50.105267,
      lon: 8.738490999999998
    },
    to: {
      name: 'Frankfurt (Main) Mühlberg',
      lat: 50.101966999999995,
      lon: 8.700644
    },
    departure: '2026-07-10T02:05:00Z',
    arrival: '2026-07-10T02:08:00Z',
    scheduledDeparture: '2026-07-10T02:04:00Z',
    scheduledArrival: '2026-07-10T02:07:00Z',
    realTime: true,
    polyline:
      '}dypHqvit@B`BLxE@t@?D@PFxBFzBHrD@hANbN?JLzJHhF@LFtD?L@j@Bz@FjG@zBB|B?HJvDHhCHvBN`ENzDHdDNzGBtLBzE?H@r@\\pG\\hC`@zBj@xB`@fA`@hAxAnDDJfAjC\\~@FNPd@Xz@VdAVfA@F^fCTxBHpABbA@h@?V?|@Az@AHAd@Cx@Eb@GfAE`@KlAMdAYjBOx@Ml@Mf@GX'
  },
  {
    trips: [{displayName: 'S8'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Mühlberg',
      lat: 50.101966999999995,
      lon: 8.700644
    },
    to: {
      name: 'Frankfurt (Main) Ostendstraße',
      lat: 50.112495,
      lon: 8.697118999999999
    },
    departure: '2026-07-10T02:08:00Z',
    arrival: '2026-07-10T02:10:00Z',
    scheduledDeparture: '2026-07-10T02:07:00Z',
    scheduledArrival: '2026-07-10T02:09:00Z',
    realTime: true,
    polyline:
      'gpxpH_jbt@EPKh@aAnCEHa@|@ADk@v@g@h@}@|@q@^WNy@\\g@Hq@HU@cBEOAUAi@Io@Iw@OaBYw@MkCe@m@M_B[IAqAWuDSyADyAX_Bh@gAn@g@f@KJy@x@i@h@GF[\\KHq@r@'
  },
  {
    trips: [{displayName: 'S1'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Hattersheim (Main) Bahnhof',
      lat: 50.06711000000001,
      lon: 8.488877999999998
    },
    to: {
      name: 'Frankfurt (Main) Sindlingen Bahnhof',
      lat: 50.087303,
      lon: 8.512084000000002
    },
    departure: '2026-07-10T02:01:00Z',
    arrival: '2026-07-10T02:03:00Z',
    scheduledDeparture: '2026-07-10T01:59:00Z',
    scheduledArrival: '2026-07-10T02:01:00Z',
    realTime: true,
    polyline:
      'ovqpHk~xr@[_@{@eAsA}Ac@c@q@w@k@k@]_@WYqB_CoGwHcFgGyQcUaT{VqA_BsCmDuAcBcUsXaNiPgDcEmAwAg@o@'
  },
  {
    trips: [{displayName: 'S1'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Sindlingen Bahnhof',
      lat: 50.087303,
      lon: 8.512084000000002
    },
    to: {
      name: 'Frankfurt (Main) Höchst Bahnhof',
      lat: 50.10242,
      lon: 8.542372999999998
    },
    departure: '2026-07-10T02:04:00Z',
    arrival: '2026-07-10T02:07:00Z',
    scheduledDeparture: '2026-07-10T02:02:00Z',
    scheduledArrival: '2026-07-10T02:08:00Z',
    realTime: true,
    polyline:
      'utupHmo}r@GIMO]c@EC{AiBaAmAaD{DwNeQ{AcBcAcAwBkByAsAaA{@oAwAa@k@a@k@i@aAc@{@c@aAa@eAc@iAcAmC_DeIIWWu@Wu@y@gCY_AwAeFEMM]_@oAYy@aA{CaA_DSm@CKmAcEeAqDmAsEe@gBqCcLYoAUcAUeAq@uD_@yBOcAIy@MsAIiAMsBMqBKkBOgCKcBC_@'
  },
  {
    trips: [{displayName: 'S1'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Höchst Bahnhof',
      lat: 50.10242,
      lon: 8.542372999999998
    },
    to: {name: 'Frankfurt (Main) Nied Bahnhof', lat: 50.102066, lon: 8.572288},
    departure: '2026-07-10T02:09:00Z',
    arrival: '2026-07-10T02:11:00Z',
    scheduledDeparture: '2026-07-10T02:09:00Z',
    scheduledArrival: '2026-07-10T02:11:00Z',
    realTime: true,
    polyline:
      'gsxpHylcs@IqASsDWaEKoB_@gGEy@KyASoDEu@EwACa@OkHKyE?YE_BCsAAu@?oB@mBFwHBiC?uFDgV?]DiX?{A?gBB}ABoABw@Bo@Bi@Dg@Dm@Fk@Fe@Fe@Fe@Ji@Lu@ZaB@KXuAVoAf@wBd@qB'
  },
  {
    trips: [{displayName: 'S1'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Offenbach (Main)-Kaiserlei Kaiserlei',
      lat: 50.105267,
      lon: 8.738490999999998
    },
    to: {
      name: 'Frankfurt (Main) Mühlberg',
      lat: 50.101966999999995,
      lon: 8.700644
    },
    departure: '2026-07-10T01:59:00Z',
    arrival: '2026-07-10T02:02:00Z',
    scheduledDeparture: '2026-07-10T01:59:00Z',
    scheduledArrival: '2026-07-10T02:01:00Z',
    realTime: true,
    polyline:
      '}dypHqvit@B`BLxE@t@?D@PFxBFzBHrD@hANbN?JLzJHhF@LFtD?L@j@Bz@FjG@zBB|B?HJvDHhCHvBN`ENzDHdDNzGBtLBzE?H@r@\\pG\\hC`@zBj@xB`@fA`@hAxAnDDJfAjC\\~@FNPd@Xz@VdAVfA@F^fCTxBHpABbA@h@?V?|@Az@AHAd@Cx@Eb@GfAE`@KlAMdAYjBOx@Ml@Mf@GX'
  },
  {
    trips: [{displayName: 'S1'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Mühlberg',
      lat: 50.101966999999995,
      lon: 8.700644
    },
    to: {
      name: 'Frankfurt (Main) Ostendstraße',
      lat: 50.112495,
      lon: 8.697118999999999
    },
    departure: '2026-07-10T02:03:00Z',
    arrival: '2026-07-10T02:04:00Z',
    scheduledDeparture: '2026-07-10T02:02:00Z',
    scheduledArrival: '2026-07-10T02:04:00Z',
    realTime: true,
    polyline:
      'gpxpH_jbt@EPKh@aAnCEHa@|@ADk@v@g@h@}@|@q@^WNy@\\g@Hq@HU@cBEOAUAi@Io@Iw@OaBYw@MkCe@m@M_B[IAqAWuDSyADyAX_Bh@gAn@g@f@KJy@x@i@h@GF[\\KHq@r@'
  },
  {
    trips: [{displayName: 'S1'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Ostendstraße',
      lat: 50.112495,
      lon: 8.697118999999999
    },
    to: {
      name: 'Frankfurt (Main) Konstablerwache',
      lat: 50.114708,
      lon: 8.684584000000001
    },
    departure: '2026-07-10T02:05:00Z',
    arrival: '2026-07-10T02:06:00Z',
    scheduledDeparture: '2026-07-10T02:04:00Z',
    scheduledArrival: '2026-07-10T02:06:00Z',
    realTime: true,
    polyline:
      'crzpH_tat@UVQNKLg@f@c@h@g@l@[b@]l@Yj@IRYr@Wr@ADEPQn@CFQt@Ov@GXG`@Mx@Ih@UrBAHEb@AXCXKxBEhB?LAX?bB?\\?z@@p@@z@RnCFv@Bh@@Z?pD?b@?P?h@AbC?H?FAjB?nA@z@'
  },
  {
    trips: [{displayName: 'S1'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Konstablerwache',
      lat: 50.114708,
      lon: 8.684584000000001
    },
    to: {
      name: 'Frankfurt (Main) Hauptwache',
      lat: 50.114059999999995,
      lon: 8.678142999999999
    },
    departure: '2026-07-10T02:07:00Z',
    arrival: '2026-07-10T02:08:00Z',
    scheduledDeparture: '2026-07-10T02:06:00Z',
    scheduledArrival: '2026-07-10T02:07:00Z',
    realTime: true,
    polyline:
      'w_{pHue_t@?Z@TB|@Bf@B`@HbAFl@D`@Jx@@FBJRtADXHl@PlAB^Fj@BRHdBDx@A^GpBEvAEdAAf@AH?HAR'
  },
  {
    trips: [{displayName: 'S1'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Hauptwache',
      lat: 50.114059999999995,
      lon: 8.678142999999999
    },
    to: {
      name: 'Frankfurt (Main) Taunusanlage',
      lat: 50.113482999999995,
      lon: 8.668766
    },
    departure: '2026-07-10T02:08:00Z',
    arrival: '2026-07-10T02:09:00Z',
    scheduledDeparture: '2026-07-10T02:08:00Z',
    scheduledArrival: '2026-07-10T02:09:00Z',
    realTime: true,
    polyline:
      'e|zpHm}}s@Ct@Ex@Ex@Ex@GdAI|@AHMrAQvAOxA_@hDSjBCZCh@GtB@v@@fABf@Dp@@HT`BHf@^fBPh@Tt@^x@z@`BJPBD`@p@DF'
  },
  {
    trips: [{displayName: 'S1'}],
    mode: 'SUBURBAN',
    from: {
      name: 'Frankfurt (Main) Taunusanlage',
      lat: 50.113482999999995,
      lon: 8.668766
    },
    to: {
      name: 'Frankfurt (Main) Hauptbahnhof tief',
      lat: 50.10714,
      lon: 8.662477
    },
    departure: '2026-07-10T02:10:00Z',
    arrival: '2026-07-10T02:11:00Z',
    scheduledDeparture: '2026-07-10T02:09:00Z',
    scheduledArrival: '2026-07-10T02:11:00Z',
    realTime: true,
    polyline:
      'wxzpH_b|s@z@rAz@jA~@dA`BhBdCzAFBjAf@THf@PdAXn@Px@ZRHnAn@lAz@LH~@|@DDDFFFV`@Xd@fApBx@bB@DBDFR^lAXdA'
  },
  {
    trips: [{displayName: '16'}],
    mode: 'TRAM',
    from: {
      name: 'Frankfurt (Main) Platz der Republik',
      lat: 50.108917000000005,
      lon: 8.661724
    },
    to: {name: 'Frankfurt (Main) Hauptbahnhof', lat: 50.10762, lon: 8.664683},
    departure: '2026-07-10T02:04:00Z',
    arrival: '2026-07-10T02:06:00Z',
    scheduledDeparture: '2026-07-10T02:00:00Z',
    scheduledArrival: '2026-07-10T02:02:00Z',
    realTime: true,
    polyline: 'y{ypH{vzs@DKVu@Ne@j@gBRm@HUTy@Ha@Fe@BU@IBQBIBMFQFODGx@gA'
  },
  {
    trips: [{displayName: '16'}],
    mode: 'TRAM',
    from: {name: 'Frankfurt (Main) Hauptbahnhof', lat: 50.10762, lon: 8.664683},
    to: {name: 'Frankfurt (Main) Baseler Platz', lat: 50.10425, lon: 8.664706},
    departure: '2026-07-10T02:06:00Z',
    arrival: '2026-07-10T02:08:00Z',
    scheduledDeparture: '2026-07-10T02:02:00Z',
    scheduledArrival: '2026-07-10T02:04:00Z',
    realTime: true,
    polyline:
      'wsypHmi{s@V]DCPWNMFGHEHEDADCLEJADAHAJAL?L?J@F@TBVDH@D@^DRBL@VH^Jb@Nl@NXDVDTBP@bA@n@B'
  },
  {
    trips: [{displayName: '16'}],
    mode: 'TRAM',
    from: {
      name: 'Frankfurt (Main) Baseler Platz',
      lat: 50.10425,
      lon: 8.664706
    },
    to: {
      name: 'Frankfurt (Main) Friedensbrücke',
      lat: 50.099464,
      lon: 8.668583
    },
    departure: '2026-07-10T02:08:00Z',
    arrival: '2026-07-10T02:10:00Z',
    scheduledDeparture: '2026-07-10T02:04:00Z',
    scheduledArrival: '2026-07-10T02:06:00Z',
    realTime: true,
    polyline:
      'q~xpHqi{s@H?T@P@D?F?|ABT?VCTCTGRING\\OTKPITQRUFI`BuB|C{D|CwDRULSBENWDKDIDGFKFIDGZ[HM'
  },
  {
    trips: [{displayName: '16'}],
    mode: 'TRAM',
    from: {
      name: 'Frankfurt (Main) Friedensbrücke',
      lat: 50.099464,
      lon: 8.668583
    },
    to: {
      name: 'Frankfurt (Main) Otto-Hahn-Platz',
      lat: 50.101943999999996,
      lon: 8.676072
    },
    departure: '2026-07-10T02:10:00Z',
    arrival: '2026-07-10T02:12:00Z',
    scheduledDeparture: '2026-07-10T02:06:00Z',
    scheduledArrival: '2026-07-10T02:08:00Z',
    realTime: true,
    polyline:
      'y`xpH}a|s@FI@EDI?IBK?E?E?KAGAGAGGUU{@o@}BCKcCaJeBoGkAiEQo@CGKi@EWEUEQe@aB]kA'
  },
  {
    trips: [{displayName: '18'}],
    mode: 'TRAM',
    from: {
      name: 'Frankfurt (Main) Stresemannallee Bahnhof',
      lat: 50.09465,
      lon: 8.671354999999998
    },
    to: {
      name: 'Frankfurt (Main) Friedensbrücke',
      lat: 50.099106000000006,
      lon: 8.669095
    },
    departure: '2026-07-10T01:59:00Z',
    arrival: '2026-07-10T02:01:00Z',
    scheduledDeparture: '2026-07-10T01:59:00Z',
    scheduledArrival: '2026-07-10T02:01:00Z',
    realTime: true,
    polyline:
      'obwpHcr|s@K@[@M@uAFaABM?]@yCP}AJq@NOH]PMJMLMNcAlAYZMNKJSRIFGHOPaAhAMNCD'
  },
  {
    trips: [{displayName: '18'}],
    mode: 'TRAM',
    from: {
      name: 'Frankfurt (Main) Friedensbrücke',
      lat: 50.099106000000006,
      lon: 8.669095
    },
    to: {
      name: 'Frankfurt (Main) Otto-Hahn-Platz',
      lat: 50.101943999999996,
      lon: 8.676072
    },
    departure: '2026-07-10T02:01:00Z',
    arrival: '2026-07-10T02:03:00Z',
    scheduledDeparture: '2026-07-10T02:01:00Z',
    scheduledArrival: '2026-07-10T02:03:00Z',
    realTime: true,
    polyline:
      'm~wpH}d|s@EBEDGBE?E?E?ECECGGEGCGAEUy@o@}BCKcCaJeBoGkAiEQo@CGKi@EWEUEQe@aB]kA'
  },
  {
    trips: [{displayName: '18'}],
    mode: 'TRAM',
    from: {
      name: 'Frankfurt (Main) Otto-Hahn-Platz',
      lat: 50.101943999999996,
      lon: 8.676072
    },
    to: {
      name: 'Frankfurt (Main) Schweizer-/Gartenstraße',
      lat: 50.103176000000005,
      lon: 8.679307
    },
    departure: '2026-07-10T02:03:00Z',
    arrival: '2026-07-10T02:04:00Z',
    scheduledDeparture: '2026-07-10T02:03:00Z',
    scheduledArrival: '2026-07-10T02:04:00Z',
    realTime: true,
    polyline: 'kpxpHep}s@AEIWM]W}@GQ{BqI_AcDAE'
  },
  {
    trips: [{displayName: '18'}],
    mode: 'TRAM',
    from: {
      name: 'Frankfurt (Main) Schweizer-/Gartenstraße',
      lat: 50.103176000000005,
      lon: 8.679307
    },
    to: {
      name: 'Frankfurt (Main) Schwanthalerstraße',
      lat: 50.10114,
      lon: 8.681192999999999
    },
    departure: '2026-07-10T02:04:00Z',
    arrival: '2026-07-10T02:06:00Z',
    scheduledDeparture: '2026-07-10T02:04:00Z',
    scheduledArrival: '2026-07-10T02:06:00Z',
    realTime: true,
    polyline: 'cxxpHmd~s@AEAIAG?E?E?G@G@GBE@EDEDGpDiCFEXSfAu@XSHEjAy@'
  },
  {
    trips: [{displayName: '18'}],
    mode: 'TRAM',
    from: {
      name: 'Frankfurt (Main) Schwanthalerstraße',
      lat: 50.10114,
      lon: 8.681192999999999
    },
    to: {
      name: 'Frankfurt (Main) Südbahnhof',
      lat: 50.099940000000004,
      lon: 8.685953
    },
    departure: '2026-07-10T02:06:00Z',
    arrival: '2026-07-10T02:08:00Z',
    scheduledDeparture: '2026-07-10T02:06:00Z',
    scheduledArrival: '2026-07-10T02:08:00Z',
    realTime: true,
    polyline:
      'ekxpHsp~s@d@]~DqCjBqAfA}@HIDEDG@EBG@I@M@KAIAKCMAG_BqESk@I[CGCOCQCKAKAGAMESISGUUq@CGCG'
  },
  {
    trips: [{displayName: '18'}],
    mode: 'TRAM',
    from: {
      name: 'Frankfurt (Main) Südbahnhof',
      lat: 50.099940000000004,
      lon: 8.685953
    },
    to: {
      name: 'Frankfurt (Main) Brücken-/Textorstraße',
      lat: 50.101696,
      lon: 8.687046
    },
    departure: '2026-07-10T02:08:00Z',
    arrival: '2026-07-10T02:09:00Z',
    scheduledDeparture: '2026-07-10T02:08:00Z',
    scheduledArrival: '2026-07-10T02:09:00Z',
    realTime: true,
    polyline:
      '}cxpH{m_t@AGEICEECEEEAE?G?G@E@KFGBE@I?GAqCm@ICGCECIGMMKOGOISGSOo@'
  }
];
