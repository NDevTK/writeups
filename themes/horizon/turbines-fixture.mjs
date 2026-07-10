// Live Overpass capture (maps.mail.ru mirror), 2026-07-10:
// power=generator + generator:source=wind over 47.15,6.95,47.30,
// 7.15 - the Juvent wind farm on Mont Crosin above St-Imier,
// Switzerland's largest. 19 turbines, three models (Vestas V90
// and V112, ENERCON E-82), 16 carrying their JUV plant refs.
// Captured verbatim; only the envelope key order is ours.
export const TURBINES_FIXTURE = {
  elements: [
    {
      type: 'node',
      id: 795367185,
      lat: 47.2016179,
      lon: 7.0740223,
      tags: {
        'generator:method': 'wind_turbine',
        'generator:output:electricity': '2000 kW',
        'generator:source': 'wind',
        'generator:type': 'horizontal_axis',
        manufacturer: 'Vestas',
        model: 'V90',
        power: 'generator',
        ref: 'JUV 16'
      }
    },
    {
      type: 'node',
      id: 795367902,
      lat: 47.19626,
      lon: 7.050503,
      tags: {
        'generator:method': 'wind_turbine',
        'generator:output:electricity': '2000 kW',
        'generator:source': 'wind',
        'generator:type': 'horizontal_axis',
        manufacturer: 'Vestas',
        model: 'V90',
        power: 'generator',
        ref: 'JUV 15'
      }
    },
    {
      type: 'node',
      id: 1145566831,
      lat: 47.2048283,
      lon: 6.9712451,
      tags: {
        'generator:method': 'wind_turbine',
        'generator:output:electricity': '2300 kW',
        'generator:source': 'wind',
        'generator:type': 'horizontal_axis',
        manufacturer: 'Enercon',
        model: 'E82',
        power: 'generator'
      }
    },
    {
      type: 'node',
      id: 2012328785,
      lat: 47.1654703,
      lon: 6.9878369,
      tags: {
        'generator:method': 'wind_turbine',
        'generator:output:electricity': '3300 kW',
        'generator:source': 'wind',
        'generator:type': 'horizontal_axis',
        manufacturer: 'Vestas',
        model: 'V112',
        operator: 'Juvent',
        power: 'generator',
        ref: 'JUV 7'
      }
    },
    {
      type: 'node',
      id: 2012328787,
      lat: 47.202176,
      lon: 6.9629197,
      tags: {
        'generator:method': 'wind_turbine',
        'generator:output:electricity': '2300 kW',
        'generator:source': 'wind',
        'generator:type': 'horizontal_axis',
        manufacturer: 'Enercon',
        model: 'E82',
        power: 'generator'
      }
    },
    {
      type: 'node',
      id: 2012328804,
      lat: 47.2000504,
      lon: 6.9553558,
      tags: {
        'generator:method': 'wind_turbine',
        'generator:output:electricity': '2300 kW',
        'generator:source': 'wind',
        'generator:type': 'horizontal_axis',
        manufacturer: 'Enercon',
        model: 'E82',
        power: 'generator'
      }
    },
    {
      type: 'node',
      id: 2026305183,
      lat: 47.1809168,
      lon: 7.0197664,
      tags: {
        'generator:method': 'wind_turbine',
        'generator:output:electricity': '2000 kW',
        'generator:source': 'wind',
        'generator:type': 'horizontal_axis',
        manufacturer: 'Vestas',
        model: 'V90',
        power: 'generator',
        ref: 'JUV 12'
      }
    },
    {
      type: 'node',
      id: 2026305184,
      lat: 47.180208,
      lon: 7.0123584,
      tags: {
        'generator:method': 'wind_turbine',
        'generator:output:electricity': '2000 kW',
        'generator:source': 'wind',
        'generator:type': 'horizontal_axis',
        manufacturer: 'Vestas',
        model: 'V90',
        power: 'generator',
        ref: 'JUV 3'
      }
    },
    {
      type: 'node',
      id: 2026305186,
      lat: 47.198692,
      lon: 7.059437,
      tags: {
        'generator:method': 'wind_turbine',
        'generator:output:electricity': '3300 kW',
        'generator:source': 'wind',
        'generator:type': 'horizontal_axis',
        manufacturer: 'Vestas',
        model: 'V112',
        power: 'generator',
        ref: 'JUV 5'
      }
    },
    {
      type: 'node',
      id: 2026305187,
      lat: 47.1862058,
      lon: 7.0225376,
      tags: {
        'generator:method': 'wind_turbine',
        'generator:output:electricity': '2000 kW',
        'generator:source': 'wind',
        'generator:type': 'horizontal_axis',
        manufacturer: 'Vestas',
        model: 'V90',
        power: 'generator',
        ref: 'JUV 13'
      }
    },
    {
      type: 'node',
      id: 2026305188,
      lat: 47.1765224,
      lon: 7.0092142,
      tags: {
        'generator:method': 'wind_turbine',
        'generator:output:electricity': '2000 kW',
        'generator:source': 'wind',
        'generator:type': 'horizontal_axis',
        manufacturer: 'Vestas',
        model: 'V90',
        power: 'generator',
        ref: 'JUV 10'
      }
    },
    {
      type: 'node',
      id: 2026305190,
      lat: 47.1986541,
      lon: 7.0638697,
      tags: {
        'generator:method': 'wind_turbine',
        'generator:output:electricity': '3300 kW',
        'generator:source': 'wind',
        'generator:type': 'horizontal_axis',
        manufacturer: 'Vestas',
        model: 'V112',
        power: 'generator',
        ref: 'JUV 6'
      }
    },
    {
      type: 'node',
      id: 2026305191,
      lat: 47.1822666,
      lon: 7.0102525,
      tags: {
        'generator:method': 'wind_turbine',
        'generator:output:electricity': '2000 kW',
        'generator:source': 'wind',
        'generator:type': 'horizontal_axis',
        manufacturer: 'Vestas',
        power: 'generator',
        ref: 'JUV 4'
      }
    },
    {
      type: 'node',
      id: 2026305192,
      lat: 47.1768918,
      lon: 7.0157049,
      tags: {
        'generator:method': 'wind_turbine',
        'generator:output:electricity': '2000 kW',
        'generator:source': 'wind',
        'generator:type': 'horizontal_axis',
        manufacturer: 'Vestas',
        model: 'V90',
        power: 'generator',
        ref: 'JUV 1'
      }
    },
    {
      type: 'node',
      id: 2026305193,
      lat: 47.1876856,
      lon: 7.0251293,
      tags: {
        'generator:method': 'wind_turbine',
        'generator:output:electricity': '2000 kW',
        'generator:source': 'wind',
        'generator:type': 'horizontal_axis',
        manufacturer: 'Vestas',
        model: 'V90',
        power: 'generator',
        ref: 'JUV 14'
      }
    },
    {
      type: 'node',
      id: 3683030445,
      lat: 47.1841162,
      lon: 7.0141507,
      tags: {
        'generator:method': 'wind_turbine',
        'generator:output:electricity': '2000 kW',
        'generator:source': 'wind',
        'generator:type': 'horizontal_axis',
        manufacturer: 'Vestas',
        model: 'V90',
        power: 'generator',
        ref: 'JUV 11'
      }
    },
    {
      type: 'node',
      id: 9169006416,
      lat: 47.16013,
      lon: 6.9692872,
      tags: {
        'generator:method': 'wind_turbine',
        'generator:output:electricity': '3300 kW',
        'generator:source': 'wind',
        'generator:type': 'horizontal_axis',
        manufacturer: 'Vestas',
        model: 'V112',
        operator: 'Juvent',
        power: 'generator',
        ref: 'JUV 8'
      }
    },
    {
      type: 'node',
      id: 9169042317,
      lat: 47.1626467,
      lon: 6.9860041,
      tags: {
        'generator:method': 'wind_turbine',
        'generator:output:electricity': '2000 kW',
        'generator:source': 'wind',
        'generator:type': 'horizontal_axis',
        manufacturer: 'Vestas',
        model: 'V90',
        operator: 'Juvent',
        power: 'generator',
        ref: 'JUV 9'
      }
    },
    {
      type: 'node',
      id: 9169042318,
      lat: 47.1716638,
      lon: 7.0033473,
      tags: {
        'generator:method': 'wind_turbine',
        'generator:output:electricity': '2000 kW',
        'generator:source': 'wind',
        'generator:type': 'horizontal_axis',
        manufacturer: 'Vestas',
        model: 'V90',
        operator: 'Juvent',
        power: 'generator',
        ref: 'JUV 2'
      }
    }
  ]
};
