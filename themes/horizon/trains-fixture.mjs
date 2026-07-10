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
