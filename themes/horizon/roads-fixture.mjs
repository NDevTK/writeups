// Captured Overpass response (maps.mail.ru mirror, 2026-07-10):
// way[highway](46.675,7.847,46.697,7.879);out geom 400; - the
// real Interlaken road network around the buildings fixture.
// Tags trimmed to highway/width/lanes/surface/bridge/name;
// coordinates to 6 dp; interior vertices thinned to >= 6 m
// (endpoints exact - connectivity preserved). Tag census on
// the 400 ways: surface 320, lanes 138, width 38, bridge 19 -
// the width ladder's lower rungs do the work, like the height
// ladder's.
export const ROADS_FIXTURE = {
  elements: [
    {
      type: 'way',
      id: 1342527,
      geometry: [
        {lat: 46.686049, lon: 7.853026},
        {lat: 46.686123, lon: 7.853179},
        {lat: 46.686157, lon: 7.853273},
        {lat: 46.686208, lon: 7.853407},
        {lat: 46.686252, lon: 7.853523},
        {lat: 46.686447, lon: 7.85402},
        {lat: 46.686574, lon: 7.854354},
        {lat: 46.686619, lon: 7.854512},
        {lat: 46.686649, lon: 7.854702}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Neugasse'
      }
    },
    {
      type: 'way',
      id: 1342533,
      geometry: [
        {lat: 46.686327, lon: 7.864103},
        {lat: 46.68577, lon: 7.864329},
        {lat: 46.685154, lon: 7.864578}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Sportweg'
      }
    },
    {
      type: 'way',
      id: 1342534,
      geometry: [
        {lat: 46.687047, lon: 7.867724},
        {lat: 46.68692, lon: 7.867775},
        {lat: 46.68649, lon: 7.867956},
        {lat: 46.686228, lon: 7.868055},
        {lat: 46.686075, lon: 7.868113},
        {lat: 46.686004, lon: 7.868142},
        {lat: 46.685662, lon: 7.868281},
        {lat: 46.685451, lon: 7.868366},
        {lat: 46.685125, lon: 7.868493},
        {lat: 46.685068, lon: 7.86851},
        {lat: 46.684934, lon: 7.868533},
        {lat: 46.684898, lon: 7.868546}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Freiestrasse'
      }
    },
    {
      type: 'way',
      id: 4539918,
      geometry: [
        {lat: 46.684027, lon: 7.851151},
        {lat: 46.683983, lon: 7.851262}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Bahnhofstrasse'
      }
    },
    {
      type: 'way',
      id: 4539920,
      geometry: [
        {lat: 46.68441, lon: 7.850194},
        {lat: 46.684333, lon: 7.850386}
      ],
      tags: {
        highway: 'secondary',
        lanes: '2',
        surface: 'asphalt',
        bridge: 'yes',
        name: 'Bahnhofstrasse'
      }
    },
    {
      type: 'way',
      id: 4695518,
      geometry: [
        {lat: 46.679506, lon: 7.852394},
        {lat: 46.679665, lon: 7.852755},
        {lat: 46.679719, lon: 7.852877},
        {lat: 46.679794, lon: 7.853049},
        {lat: 46.67986, lon: 7.853199},
        {lat: 46.6801, lon: 7.853748},
        {lat: 46.680154, lon: 7.85387},
        {lat: 46.680186, lon: 7.853944},
        {lat: 46.680239, lon: 7.854065},
        {lat: 46.680306, lon: 7.85422},
        {lat: 46.680353, lon: 7.854327},
        {lat: 46.680498, lon: 7.854674},
        {lat: 46.680599, lon: 7.85492}
      ],
      tags: {
        highway: 'residential',
        width: '5.8',
        lanes: '1',
        surface: 'asphalt',
        name: 'Rothornstrasse'
      }
    },
    {
      type: 'way',
      id: 4695520,
      geometry: [
        {lat: 46.680599, lon: 7.85492},
        {lat: 46.680956, lon: 7.854584},
        {lat: 46.681586, lon: 7.85403},
        {lat: 46.681716, lon: 7.853915},
        {lat: 46.68181, lon: 7.853833}
      ],
      tags: {
        highway: 'residential',
        width: '6',
        lanes: '1',
        surface: 'asphalt',
        name: 'Suleggstrasse'
      }
    },
    {
      type: 'way',
      id: 4695521,
      geometry: [
        {lat: 46.679114, lon: 7.855382},
        {lat: 46.679471, lon: 7.855027},
        {lat: 46.679585, lon: 7.854918},
        {lat: 46.679853, lon: 7.854661},
        {lat: 46.680306, lon: 7.85422},
        {lat: 46.680779, lon: 7.853763},
        {lat: 46.680896, lon: 7.853649},
        {lat: 46.681011, lon: 7.85354},
        {lat: 46.68149, lon: 7.853071},
        {lat: 46.681756, lon: 7.852816},
        {lat: 46.681936, lon: 7.852639},
        {lat: 46.682035, lon: 7.852543},
        {lat: 46.682138, lon: 7.852443}
      ],
      tags: {
        highway: 'residential',
        width: '5.9',
        lanes: '1',
        surface: 'asphalt',
        name: 'Bernastrasse'
      }
    },
    {
      type: 'way',
      id: 4695522,
      geometry: [
        {lat: 46.681236, lon: 7.856911},
        {lat: 46.68124, lon: 7.857004},
        {lat: 46.681323, lon: 7.85725},
        {lat: 46.681358, lon: 7.857355},
        {lat: 46.681617, lon: 7.858281},
        {lat: 46.681624, lon: 7.858416},
        {lat: 46.681588, lon: 7.858485},
        {lat: 46.681053, lon: 7.858804}
      ],
      tags: {
        highway: 'residential',
        width: '6',
        lanes: '1',
        surface: 'asphalt',
        name: 'Pfarrweg'
      }
    },
    {
      type: 'way',
      id: 4695523,
      geometry: [
        {lat: 46.681326, lon: 7.860422},
        {lat: 46.681803, lon: 7.860259},
        {lat: 46.682445, lon: 7.860054},
        {lat: 46.682507, lon: 7.860051},
        {lat: 46.682568, lon: 7.860084},
        {lat: 46.682597, lon: 7.860117}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Jungfraublickallee'
      }
    },
    {
      type: 'way',
      id: 4695525,
      geometry: [
        {lat: 46.683919, lon: 7.852305},
        {lat: 46.684001, lon: 7.852469}
      ],
      tags: {
        highway: 'residential',
        width: '5.8',
        surface: 'asphalt',
        name: 'Bahnhofstrasse'
      }
    },
    {
      type: 'way',
      id: 8066082,
      geometry: [
        {lat: 46.680352, lon: 7.856623},
        {lat: 46.680211, lon: 7.856544},
        {lat: 46.680025, lon: 7.856438},
        {lat: 46.67995, lon: 7.856398},
        {lat: 46.679843, lon: 7.856344},
        {lat: 46.679683, lon: 7.856255},
        {lat: 46.679618, lon: 7.856202},
        {lat: 46.679567, lon: 7.856151},
        {lat: 46.679524, lon: 7.856097},
        {lat: 46.679425, lon: 7.855929}
      ],
      tags: {
        highway: 'primary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Waldeggstrasse'
      }
    },
    {
      type: 'way',
      id: 8066085,
      geometry: [
        {lat: 46.680352, lon: 7.856623},
        {lat: 46.68034, lon: 7.856712},
        {lat: 46.680368, lon: 7.856829},
        {lat: 46.680401, lon: 7.85692},
        {lat: 46.680451, lon: 7.857015},
        {lat: 46.680493, lon: 7.857092},
        {lat: 46.680551, lon: 7.857205},
        {lat: 46.680641, lon: 7.857373},
        {lat: 46.6807, lon: 7.857496},
        {lat: 46.680787, lon: 7.857723},
        {lat: 46.680826, lon: 7.857857},
        {lat: 46.680882, lon: 7.858089},
        {lat: 46.681053, lon: 7.858804},
        {lat: 46.681181, lon: 7.859356},
        {lat: 46.681222, lon: 7.859571},
        {lat: 46.681261, lon: 7.859807},
        {lat: 46.681284, lon: 7.859972},
        {lat: 46.681306, lon: 7.860169},
        {lat: 46.681326, lon: 7.860422},
        {lat: 46.681354, lon: 7.860794},
        {lat: 46.681364, lon: 7.860926},
        {lat: 46.681376, lon: 7.861076},
        {lat: 46.681445, lon: 7.861746},
        {lat: 46.68149, lon: 7.861987},
        {lat: 46.681507, lon: 7.862089}
      ],
      tags: {
        highway: 'primary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Wychelstrasse'
      }
    },
    {
      type: 'way',
      id: 8066086,
      geometry: [
        {lat: 46.68194, lon: 7.862027},
        {lat: 46.681931, lon: 7.862239},
        {lat: 46.681907, lon: 7.862465},
        {lat: 46.681823, lon: 7.863249},
        {lat: 46.681857, lon: 7.86343},
        {lat: 46.681875, lon: 7.863531},
        {lat: 46.68194, lon: 7.863808},
        {lat: 46.681962, lon: 7.863905},
        {lat: 46.681994, lon: 7.864043},
        {lat: 46.682011, lon: 7.864138},
        {lat: 46.682021, lon: 7.864219},
        {lat: 46.682045, lon: 7.864447},
        {lat: 46.682048, lon: 7.864497}
      ],
      tags: {
        highway: 'residential',
        lanes: '2',
        surface: 'asphalt',
        name: 'Unterdorfstrasse'
      }
    },
    {
      type: 'way',
      id: 8066087,
      geometry: [
        {lat: 46.684461, lon: 7.868709},
        {lat: 46.684241, lon: 7.868479},
        {lat: 46.684195, lon: 7.868433},
        {lat: 46.684026, lon: 7.868277},
        {lat: 46.683772, lon: 7.868023},
        {lat: 46.683537, lon: 7.867788},
        {lat: 46.683492, lon: 7.867743},
        {lat: 46.683187, lon: 7.867446},
        {lat: 46.683126, lon: 7.867381},
        {lat: 46.682925, lon: 7.867184},
        {lat: 46.68251, lon: 7.866775},
        {lat: 46.682344, lon: 7.866632},
        {lat: 46.682195, lon: 7.866545}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Oelestrasse'
      }
    },
    {
      type: 'way',
      id: 8066088,
      geometry: [
        {lat: 46.679566, lon: 7.867471},
        {lat: 46.679523, lon: 7.867572},
        {lat: 46.679455, lon: 7.867826},
        {lat: 46.679278, lon: 7.868366},
        {lat: 46.679209, lon: 7.868587},
        {lat: 46.679178, lon: 7.86875},
        {lat: 46.679164, lon: 7.868937},
        {lat: 46.679168, lon: 7.869144}
      ],
      tags: {
        highway: 'unclassified',
        lanes: '1',
        surface: 'asphalt',
        name: 'Aegertenstrasse'
      }
    },
    {
      type: 'way',
      id: 8066090,
      geometry: [
        {lat: 46.675747, lon: 7.866031},
        {lat: 46.675843, lon: 7.866368},
        {lat: 46.676295, lon: 7.868859},
        {lat: 46.676434, lon: 7.869495}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Kreuzackerweg'
      }
    },
    {
      type: 'way',
      id: 8066091,
      geometry: [
        {lat: 46.680633, lon: 7.866632},
        {lat: 46.68061, lon: 7.866555},
        {lat: 46.680569, lon: 7.866216},
        {lat: 46.680535, lon: 7.865932},
        {lat: 46.680476, lon: 7.865497},
        {lat: 46.68043, lon: 7.864561},
        {lat: 46.680417, lon: 7.864403},
        {lat: 46.680408, lon: 7.864311},
        {lat: 46.6804, lon: 7.864187}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Metzgergasse'
      }
    },
    {
      type: 'way',
      id: 8066092,
      geometry: [
        {lat: 46.686182, lon: 7.863123},
        {lat: 46.686129, lon: 7.863031},
        {lat: 46.686057, lon: 7.862935},
        {lat: 46.686012, lon: 7.862876},
        {lat: 46.685958, lon: 7.862809},
        {lat: 46.685772, lon: 7.862597},
        {lat: 46.685629, lon: 7.862435},
        {lat: 46.68532, lon: 7.862085},
        {lat: 46.685053, lon: 7.861779},
        {lat: 46.684961, lon: 7.861674},
        {lat: 46.68489, lon: 7.861593},
        {lat: 46.684821, lon: 7.861529}
      ],
      tags: {
        highway: 'primary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Klosterstrasse'
      }
    },
    {
      type: 'way',
      id: 8066093,
      geometry: [
        {lat: 46.681507, lon: 7.862089},
        {lat: 46.681616, lon: 7.862083},
        {lat: 46.68194, lon: 7.862027}
      ],
      tags: {
        highway: 'primary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Hauptstrasse'
      }
    },
    {
      type: 'way',
      id: 8066094,
      geometry: [
        {lat: 46.680999, lon: 7.851816},
        {lat: 46.681012, lon: 7.851922},
        {lat: 46.681059, lon: 7.852056},
        {lat: 46.681209, lon: 7.852404},
        {lat: 46.681315, lon: 7.852658},
        {lat: 46.681451, lon: 7.852972},
        {lat: 46.68149, lon: 7.853071},
        {lat: 46.681551, lon: 7.853225},
        {lat: 46.681662, lon: 7.853487},
        {lat: 46.68181, lon: 7.853833},
        {lat: 46.681922, lon: 7.854096},
        {lat: 46.68207, lon: 7.85444},
        {lat: 46.68233, lon: 7.855047},
        {lat: 46.68247, lon: 7.855373},
        {lat: 46.682586, lon: 7.855634},
        {lat: 46.682652, lon: 7.855808},
        {lat: 46.68267, lon: 7.855856}
      ],
      tags: {
        highway: 'residential',
        lanes: '2',
        surface: 'asphalt',
        name: 'General-Guisan-Strasse'
      }
    },
    {
      type: 'way',
      id: 8066098,
      geometry: [
        {lat: 46.684601, lon: 7.868832},
        {lat: 46.684646, lon: 7.868905},
        {lat: 46.6848, lon: 7.869098},
        {lat: 46.684847, lon: 7.869161},
        {lat: 46.684894, lon: 7.869224},
        {lat: 46.68494, lon: 7.869286},
        {lat: 46.684984, lon: 7.86934},
        {lat: 46.685046, lon: 7.869411},
        {lat: 46.685104, lon: 7.869468},
        {lat: 46.685164, lon: 7.869519},
        {lat: 46.685246, lon: 7.869571},
        {lat: 46.685332, lon: 7.869617},
        {lat: 46.685409, lon: 7.869649},
        {lat: 46.685483, lon: 7.869671},
        {lat: 46.68555, lon: 7.869685},
        {lat: 46.685625, lon: 7.869693},
        {lat: 46.685784, lon: 7.869691},
        {lat: 46.68625, lon: 7.869635},
        {lat: 46.687009, lon: 7.869546},
        {lat: 46.687198, lon: 7.869527},
        {lat: 46.687264, lon: 7.869519},
        {lat: 46.687289, lon: 7.869516}
      ],
      tags: {
        highway: 'residential',
        lanes: '2',
        surface: 'asphalt',
        name: 'Allmendstrasse'
      }
    },
    {
      type: 'way',
      id: 8066100,
      geometry: [
        {lat: 46.684576, lon: 7.868677},
        {lat: 46.684513, lon: 7.868681},
        {lat: 46.684461, lon: 7.868709}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Tenne-Kreisel'
      }
    },
    {
      type: 'way',
      id: 8066101,
      geometry: [
        {lat: 46.684466, lon: 7.868835},
        {lat: 46.684387, lon: 7.868919},
        {lat: 46.684288, lon: 7.869052},
        {lat: 46.684235, lon: 7.869125},
        {lat: 46.68412, lon: 7.869282},
        {lat: 46.684042, lon: 7.869409},
        {lat: 46.683881, lon: 7.86965},
        {lat: 46.683813, lon: 7.869783},
        {lat: 46.68378, lon: 7.869888},
        {lat: 46.683766, lon: 7.869986},
        {lat: 46.68376, lon: 7.870104},
        {lat: 46.683764, lon: 7.870196},
        {lat: 46.683786, lon: 7.870711},
        {lat: 46.683781, lon: 7.87098},
        {lat: 46.683771, lon: 7.871219},
        {lat: 46.683762, lon: 7.871395},
        {lat: 46.683746, lon: 7.871689},
        {lat: 46.683737, lon: 7.871842},
        {lat: 46.683689, lon: 7.872583},
        {lat: 46.683669, lon: 7.872814},
        {lat: 46.68365, lon: 7.872954},
        {lat: 46.683614, lon: 7.87317},
        {lat: 46.683579, lon: 7.873343},
        {lat: 46.683568, lon: 7.873386}
      ],
      tags: {
        highway: 'residential',
        surface: 'asphalt',
        name: 'Obere Bönigstrasse'
      }
    },
    {
      type: 'way',
      id: 8066103,
      geometry: [
        {lat: 46.683299, lon: 7.874415},
        {lat: 46.683287, lon: 7.874564},
        {lat: 46.683285, lon: 7.8751},
        {lat: 46.683285, lon: 7.875109}
      ],
      tags: {highway: 'unclassified', name: 'Bönigstrasse'}
    },
    {
      type: 'way',
      id: 8066105,
      geometry: [
        {lat: 46.687475, lon: 7.869469},
        {lat: 46.687558, lon: 7.869445},
        {lat: 46.687852, lon: 7.869359},
        {lat: 46.687951, lon: 7.869329},
        {lat: 46.688082, lon: 7.86929},
        {lat: 46.688279, lon: 7.869231},
        {lat: 46.688797, lon: 7.869076},
        {lat: 46.688983, lon: 7.869019},
        {lat: 46.689139, lon: 7.868972},
        {lat: 46.689217, lon: 7.868947},
        {lat: 46.689325, lon: 7.868914},
        {lat: 46.689546, lon: 7.868849},
        {lat: 46.689838, lon: 7.868748},
        {lat: 46.689908, lon: 7.868729},
        {lat: 46.690001, lon: 7.868706}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Allmendstrasse'
      }
    },
    {
      type: 'way',
      id: 8066107,
      geometry: [
        {lat: 46.694548, lon: 7.8713},
        {lat: 46.694569, lon: 7.871184},
        {lat: 46.694574, lon: 7.871129}
      ],
      tags: {
        highway: 'unclassified',
        lanes: '2',
        surface: 'asphalt',
        bridge: 'yes',
        name: 'Hauptstrasse'
      }
    },
    {
      type: 'way',
      id: 8066108,
      geometry: [
        {lat: 46.694005, lon: 7.870447},
        {lat: 46.69395, lon: 7.870388},
        {lat: 46.693854, lon: 7.870265},
        {lat: 46.693783, lon: 7.870162},
        {lat: 46.693712, lon: 7.870038},
        {lat: 46.692982, lon: 7.868594},
        {lat: 46.69283, lon: 7.868313},
        {lat: 46.692786, lon: 7.868245},
        {lat: 46.692741, lon: 7.868198},
        {lat: 46.692675, lon: 7.868141},
        {lat: 46.692613, lon: 7.868101},
        {lat: 46.692549, lon: 7.868073},
        {lat: 46.692471, lon: 7.868053},
        {lat: 46.692347, lon: 7.868036},
        {lat: 46.69229, lon: 7.868021},
        {lat: 46.692235, lon: 7.867994},
        {lat: 46.692179, lon: 7.867952},
        {lat: 46.6921, lon: 7.867862},
        {lat: 46.692064, lon: 7.867799},
        {lat: 46.692034, lon: 7.867731},
        {lat: 46.691978, lon: 7.867563},
        {lat: 46.691901, lon: 7.867336},
        {lat: 46.691856, lon: 7.867236},
        {lat: 46.691805, lon: 7.86716},
        {lat: 46.691735, lon: 7.867101},
        {lat: 46.691497, lon: 7.866946},
        {lat: 46.691268, lon: 7.866794},
        {lat: 46.691214, lon: 7.866757},
        {lat: 46.691163, lon: 7.866715},
        {lat: 46.691119, lon: 7.866665},
        {lat: 46.691059, lon: 7.866562},
        {lat: 46.691012, lon: 7.866435},
        {lat: 46.690989, lon: 7.86635},
        {lat: 46.690972, lon: 7.866262},
        {lat: 46.690952, lon: 7.866109},
        {lat: 46.690895, lon: 7.865471},
        {lat: 46.690888, lon: 7.865402}
      ],
      tags: {
        highway: 'unclassified',
        lanes: '2',
        surface: 'asphalt',
        name: 'Brienzstrasse'
      }
    },
    {
      type: 'way',
      id: 8066111,
      geometry: [
        {lat: 46.688611, lon: 7.876829},
        {lat: 46.688693, lon: 7.876794},
        {lat: 46.688782, lon: 7.876756},
        {lat: 46.68887, lon: 7.876711},
        {lat: 46.688944, lon: 7.876659},
        {lat: 46.689036, lon: 7.876575},
        {lat: 46.689122, lon: 7.876464},
        {lat: 46.68919, lon: 7.876354},
        {lat: 46.689225, lon: 7.876276},
        {lat: 46.689274, lon: 7.876142},
        {lat: 46.689307, lon: 7.876011},
        {lat: 46.689321, lon: 7.875938}
      ],
      tags: {highway: 'primary_link', lanes: '2', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 8066117,
      geometry: [
        {lat: 46.686313, lon: 7.863237},
        {lat: 46.686398, lon: 7.863219},
        {lat: 46.686477, lon: 7.863195},
        {lat: 46.686575, lon: 7.863155},
        {lat: 46.686627, lon: 7.863128},
        {lat: 46.686752, lon: 7.86304},
        {lat: 46.687289, lon: 7.862665},
        {lat: 46.687892, lon: 7.86224}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Klosterstrasse'
      }
    },
    {
      type: 'way',
      id: 8066118,
      geometry: [
        {lat: 46.687332, lon: 7.85984},
        {lat: 46.687406, lon: 7.859796},
        {lat: 46.688027, lon: 7.859399}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Strandbadstrasse'
      }
    },
    {
      type: 'way',
      id: 8066121,
      geometry: [
        {lat: 46.689933, lon: 7.858416},
        {lat: 46.689945, lon: 7.858548},
        {lat: 46.689965, lon: 7.858827},
        {lat: 46.689981, lon: 7.859023},
        {lat: 46.69, lon: 7.859242},
        {lat: 46.690025, lon: 7.859497},
        {lat: 46.690056, lon: 7.859836},
        {lat: 46.690075, lon: 7.860068},
        {lat: 46.690095, lon: 7.860315},
        {lat: 46.690118, lon: 7.860597},
        {lat: 46.690134, lon: 7.860749},
        {lat: 46.690155, lon: 7.861006},
        {lat: 46.690177, lon: 7.861256},
        {lat: 46.690185, lon: 7.861359},
        {lat: 46.690212, lon: 7.86166},
        {lat: 46.690224, lon: 7.861838},
        {lat: 46.69023, lon: 7.861927},
        {lat: 46.690234, lon: 7.862018}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 8066122,
      geometry: [
        {lat: 46.68495, lon: 7.854357},
        {lat: 46.685109, lon: 7.854025},
        {lat: 46.685207, lon: 7.853887}
      ],
      tags: {
        highway: 'residential',
        width: '6',
        surface: 'asphalt',
        name: 'Marktgasse'
      }
    },
    {
      type: 'way',
      id: 8066123,
      geometry: [
        {lat: 46.683735, lon: 7.852012},
        {lat: 46.683678, lon: 7.852023}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Bahnhofstrasse'
      }
    },
    {
      type: 'way',
      id: 8066768,
      geometry: [
        {lat: 46.694687, lon: 7.871395},
        {lat: 46.694783, lon: 7.871502},
        {lat: 46.694853, lon: 7.871602},
        {lat: 46.694892, lon: 7.871665},
        {lat: 46.694943, lon: 7.871757},
        {lat: 46.695078, lon: 7.871996},
        {lat: 46.695367, lon: 7.872536},
        {lat: 46.695462, lon: 7.872727},
        {lat: 46.695558, lon: 7.872994}
      ],
      tags: {
        highway: 'primary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Hauptstrasse'
      }
    },
    {
      type: 'way',
      id: 8227334,
      geometry: [
        {lat: 46.683133, lon: 7.870475},
        {lat: 46.683212, lon: 7.870512}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Bühlstrasse'}
    },
    {
      type: 'way',
      id: 8227335,
      geometry: [
        {lat: 46.683764, lon: 7.870196},
        {lat: 46.683692, lon: 7.870221},
        {lat: 46.683626, lon: 7.870256},
        {lat: 46.683452, lon: 7.870361},
        {lat: 46.683367, lon: 7.870403},
        {lat: 46.68331, lon: 7.870423},
        {lat: 46.683242, lon: 7.870467},
        {lat: 46.683195, lon: 7.870548},
        {lat: 46.683177, lon: 7.870657},
        {lat: 46.683163, lon: 7.870933},
        {lat: 46.683146, lon: 7.871265},
        {lat: 46.683089, lon: 7.872406},
        {lat: 46.683097, lon: 7.87253},
        {lat: 46.683123, lon: 7.872661},
        {lat: 46.683162, lon: 7.87279},
        {lat: 46.683213, lon: 7.872897},
        {lat: 46.683472, lon: 7.873275},
        {lat: 46.683579, lon: 7.873343}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Bühlstrasse'}
    },
    {
      type: 'way',
      id: 8265318,
      geometry: [
        {lat: 46.69066, lon: 7.864945},
        {lat: 46.690648, lon: 7.864838},
        {lat: 46.690605, lon: 7.864709}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 8265328,
      geometry: [
        {lat: 46.690071, lon: 7.865057},
        {lat: 46.690062, lon: 7.864974},
        {lat: 46.689965, lon: 7.864149},
        {lat: 46.689836, lon: 7.862931},
        {lat: 46.689796, lon: 7.862547}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 8265330,
      geometry: [
        {lat: 46.689781, lon: 7.865413},
        {lat: 46.689743, lon: 7.865304},
        {lat: 46.689727, lon: 7.865224}
      ],
      tags: {highway: 'footway', surface: 'fine_gravel'}
    },
    {
      type: 'way',
      id: 8265333,
      geometry: [
        {lat: 46.676653, lon: 7.869477},
        {lat: 46.676724, lon: 7.870382}
      ],
      tags: {highway: 'service'}
    },
    {
      type: 'way',
      id: 8265336,
      geometry: [
        {lat: 46.68548, lon: 7.874043},
        {lat: 46.685342, lon: 7.874057},
        {lat: 46.685229, lon: 7.874068},
        {lat: 46.684935, lon: 7.87412},
        {lat: 46.68469, lon: 7.874166},
        {lat: 46.6846, lon: 7.874179},
        {lat: 46.684525, lon: 7.874189},
        {lat: 46.684461, lon: 7.874193},
        {lat: 46.684163, lon: 7.874177},
        {lat: 46.684094, lon: 7.874178},
        {lat: 46.683745, lon: 7.874233},
        {lat: 46.683536, lon: 7.874271},
        {lat: 46.683451, lon: 7.874284},
        {lat: 46.683338, lon: 7.874252}
      ],
      tags: {highway: 'service', name: 'Obere Bönigstrasse'}
    },
    {
      type: 'way',
      id: 8877306,
      geometry: [
        {lat: 46.689532, lon: 7.864635},
        {lat: 46.689447, lon: 7.864593},
        {lat: 46.689235, lon: 7.864647},
        {lat: 46.689185, lon: 7.86466}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Höheweg'}
    },
    {
      type: 'way',
      id: 8877326,
      geometry: [
        {lat: 46.688704, lon: 7.866107},
        {lat: 46.688746, lon: 7.866198},
        {lat: 46.688826, lon: 7.866518},
        {lat: 46.688845, lon: 7.8666},
        {lat: 46.688937, lon: 7.867002},
        {lat: 46.688953, lon: 7.867122},
        {lat: 46.689046, lon: 7.86799},
        {lat: 46.689052, lon: 7.868082},
        {lat: 46.689028, lon: 7.868193},
        {lat: 46.688979, lon: 7.868271},
        {lat: 46.688928, lon: 7.868316},
        {lat: 46.688552, lon: 7.86843},
        {lat: 46.688187, lon: 7.868543},
        {lat: 46.688054, lon: 7.868584},
        {lat: 46.687875, lon: 7.868641},
        {lat: 46.687498, lon: 7.868753},
        {lat: 46.687433, lon: 7.868746}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Schwalmerenweg'}
    },
    {
      type: 'way',
      id: 19785243,
      geometry: [
        {lat: 46.691485, lon: 7.871078},
        {lat: 46.691576, lon: 7.871102},
        {lat: 46.691632, lon: 7.87113},
        {lat: 46.691752, lon: 7.871219},
        {lat: 46.691975, lon: 7.87138},
        {lat: 46.69205, lon: 7.871434},
        {lat: 46.692182, lon: 7.871533},
        {lat: 46.692243, lon: 7.871607},
        {lat: 46.692284, lon: 7.871726},
        {lat: 46.6923, lon: 7.87181},
        {lat: 46.692391, lon: 7.872496},
        {lat: 46.692455, lon: 7.872975},
        {lat: 46.692715, lon: 7.874883},
        {lat: 46.69279, lon: 7.875454},
        {lat: 46.692841, lon: 7.875807},
        {lat: 46.692955, lon: 7.876626},
        {lat: 46.692977, lon: 7.876706}
      ],
      tags: {
        highway: 'residential',
        width: '4',
        surface: 'asphalt',
        name: 'Lanzenen'
      }
    },
    {
      type: 'way',
      id: 20160729,
      geometry: [
        {lat: 46.68495, lon: 7.854357},
        {lat: 46.684834, lon: 7.854604},
        {lat: 46.684771, lon: 7.854738},
        {lat: 46.684725, lon: 7.854813}
      ],
      tags: {
        highway: 'residential',
        width: '6',
        surface: 'asphalt',
        name: 'Centralstrasse'
      }
    },
    {
      type: 'way',
      id: 20163339,
      geometry: [
        {lat: 46.684136, lon: 7.856332},
        {lat: 46.684251, lon: 7.85643},
        {lat: 46.684331, lon: 7.856498},
        {lat: 46.68455, lon: 7.856685},
        {lat: 46.684502, lon: 7.856795},
        {lat: 46.684452, lon: 7.856891},
        {lat: 46.684305, lon: 7.857107},
        {lat: 46.684226, lon: 7.857223},
        {lat: 46.684143, lon: 7.857337},
        {lat: 46.68412, lon: 7.857418},
        {lat: 46.684079, lon: 7.857506},
        {lat: 46.684062, lon: 7.857563}
      ],
      tags: {
        highway: 'living_street',
        lanes: '1',
        surface: 'asphalt',
        name: 'Jungfraustrasse'
      }
    },
    {
      type: 'way',
      id: 20163419,
      geometry: [
        {lat: 46.68455, lon: 7.856685},
        {lat: 46.684582, lon: 7.856611},
        {lat: 46.684747, lon: 7.856261},
        {lat: 46.684874, lon: 7.85602},
        {lat: 46.685089, lon: 7.855608},
        {lat: 46.68516, lon: 7.85551},
        {lat: 46.685269, lon: 7.855399}
      ],
      tags: {
        highway: 'pedestrian',
        surface: 'paving_stones',
        name: 'Jungfraustrasse'
      }
    },
    {
      type: 'way',
      id: 20166688,
      geometry: [
        {lat: 46.689396, lon: 7.868808},
        {lat: 46.689338, lon: 7.868304},
        {lat: 46.689291, lon: 7.868242},
        {lat: 46.689112, lon: 7.868267},
        {lat: 46.689092, lon: 7.86809},
        {lat: 46.689052, lon: 7.868082}
      ],
      tags: {highway: 'footway'}
    },
    {
      type: 'way',
      id: 20166804,
      geometry: [
        {lat: 46.6898, lon: 7.866348},
        {lat: 46.689439, lon: 7.866454},
        {lat: 46.689303, lon: 7.866487},
        {lat: 46.689117, lon: 7.866543},
        {lat: 46.688978, lon: 7.866585},
        {lat: 46.688852, lon: 7.86663}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 20168838,
      geometry: [
        {lat: 46.689933, lon: 7.858416},
        {lat: 46.689896, lon: 7.858003},
        {lat: 46.689869, lon: 7.857691},
        {lat: 46.689862, lon: 7.857611},
        {lat: 46.68985, lon: 7.857479},
        {lat: 46.689829, lon: 7.857264},
        {lat: 46.689811, lon: 7.857063},
        {lat: 46.68978, lon: 7.856804},
        {lat: 46.689742, lon: 7.856469},
        {lat: 46.689713, lon: 7.856248},
        {lat: 46.689691, lon: 7.856101},
        {lat: 46.689685, lon: 7.855989},
        {lat: 46.689679, lon: 7.855906},
        {lat: 46.689656, lon: 7.855831}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 20452582,
      geometry: [
        {lat: 46.687311, lon: 7.868606},
        {lat: 46.68734, lon: 7.868591}
      ],
      tags: {highway: 'footway'}
    },
    {
      type: 'way',
      id: 20634665,
      geometry: [
        {lat: 46.68564, lon: 7.870701},
        {lat: 46.685678, lon: 7.870844},
        {lat: 46.685701, lon: 7.870927},
        {lat: 46.685733, lon: 7.871062},
        {lat: 46.685808, lon: 7.871379},
        {lat: 46.685837, lon: 7.871509},
        {lat: 46.685881, lon: 7.871706},
        {lat: 46.685945, lon: 7.87207},
        {lat: 46.685965, lon: 7.8722},
        {lat: 46.685972, lon: 7.872304}
      ],
      tags: {
        highway: 'residential',
        surface: 'asphalt',
        name: 'Mittengrabenstrasse'
      }
    },
    {
      type: 'way',
      id: 20634667,
      geometry: [
        {lat: 46.686306, lon: 7.870625},
        {lat: 46.686551, lon: 7.872234},
        {lat: 46.686576, lon: 7.872401},
        {lat: 46.686663, lon: 7.872928}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Spühlibachweg'}
    },
    {
      type: 'way',
      id: 20634669,
      geometry: [
        {lat: 46.687444, lon: 7.870503},
        {lat: 46.687197, lon: 7.870544},
        {lat: 46.68712, lon: 7.870558},
        {lat: 46.687108, lon: 7.870566}
      ],
      tags: {highway: 'footway', name: 'Burgerweg'}
    },
    {
      type: 'way',
      id: 20634672,
      geometry: [
        {lat: 46.688092, lon: 7.873696},
        {lat: 46.688145, lon: 7.873672},
        {lat: 46.688157, lon: 7.87359},
        {lat: 46.688105, lon: 7.873543},
        {lat: 46.688089, lon: 7.873548}
      ],
      tags: {highway: 'footway'}
    },
    {
      type: 'way',
      id: 23916949,
      geometry: [
        {lat: 46.68942, lon: 7.870673},
        {lat: 46.689366, lon: 7.870218},
        {lat: 46.689326, lon: 7.869873},
        {lat: 46.689274, lon: 7.869437},
        {lat: 46.689233, lon: 7.869087},
        {lat: 46.689222, lon: 7.868993},
        {lat: 46.689217, lon: 7.868947}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Burgerweg'}
    },
    {
      type: 'way',
      id: 23916950,
      geometry: [
        {lat: 46.68821, lon: 7.870188},
        {lat: 46.688153, lon: 7.869789},
        {lat: 46.688093, lon: 7.869372},
        {lat: 46.688082, lon: 7.86929}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Allmendstrasse'}
    },
    {
      type: 'way',
      id: 23916951,
      geometry: [
        {lat: 46.689323, lon: 7.869847},
        {lat: 46.688714, lon: 7.870037},
        {lat: 46.68821, lon: 7.870188},
        {lat: 46.688073, lon: 7.870228},
        {lat: 46.687984, lon: 7.870337},
        {lat: 46.687881, lon: 7.87037},
        {lat: 46.687668, lon: 7.87044},
        {lat: 46.68764, lon: 7.870447}
      ],
      tags: {highway: 'footway', name: 'Burgerweg'}
    },
    {
      type: 'way',
      id: 23916952,
      geometry: [
        {lat: 46.689326, lon: 7.869873},
        {lat: 46.689872, lon: 7.86973}
      ],
      tags: {highway: 'footway'}
    },
    {
      type: 'way',
      id: 24759934,
      geometry: [
        {lat: 46.681366, lon: 7.875462},
        {lat: 46.681284, lon: 7.875463},
        {lat: 46.681183, lon: 7.875466},
        {lat: 46.681139, lon: 7.875469}
      ],
      tags: {highway: 'motorway', lanes: '2', surface: 'asphalt', bridge: 'yes'}
    },
    {
      type: 'way',
      id: 24759935,
      geometry: [
        {lat: 46.681139, lon: 7.875469},
        {lat: 46.680917, lon: 7.875487},
        {lat: 46.680652, lon: 7.875523},
        {lat: 46.680095, lon: 7.875621},
        {lat: 46.679963, lon: 7.875644},
        {lat: 46.679718, lon: 7.875681},
        {lat: 46.679513, lon: 7.87572},
        {lat: 46.679295, lon: 7.875747},
        {lat: 46.679068, lon: 7.875768},
        {lat: 46.678883, lon: 7.875775},
        {lat: 46.678596, lon: 7.875773},
        {lat: 46.678315, lon: 7.875744},
        {lat: 46.678091, lon: 7.875704},
        {lat: 46.677824, lon: 7.875641},
        {lat: 46.677579, lon: 7.875557},
        {lat: 46.677343, lon: 7.875465},
        {lat: 46.677102, lon: 7.875362},
        {lat: 46.676846, lon: 7.875221},
        {lat: 46.676594, lon: 7.875066},
        {lat: 46.676384, lon: 7.874916},
        {lat: 46.676062, lon: 7.874651},
        {lat: 46.675769, lon: 7.874362},
        {lat: 46.6755, lon: 7.874064},
        {lat: 46.675173, lon: 7.873664},
        {lat: 46.67469, lon: 7.872988},
        {lat: 46.674195, lon: 7.872251},
        {lat: 46.673953, lon: 7.87187},
        {lat: 46.673726, lon: 7.871495}
      ],
      tags: {highway: 'motorway', lanes: '2', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 24849730,
      geometry: [
        {lat: 46.684103, lon: 7.851784},
        {lat: 46.684081, lon: 7.852035}
      ],
      tags: {highway: 'service', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 24849731,
      geometry: [
        {lat: 46.685162, lon: 7.848325},
        {lat: 46.685125, lon: 7.848418},
        {lat: 46.685063, lon: 7.848557},
        {lat: 46.68502, lon: 7.848659},
        {lat: 46.684953, lon: 7.848822},
        {lat: 46.684907, lon: 7.84894}
      ],
      tags: {
        highway: 'secondary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Bahnhofstrasse'
      }
    },
    {
      type: 'way',
      id: 24849732,
      geometry: [
        {lat: 46.684333, lon: 7.850386},
        {lat: 46.684305, lon: 7.850457},
        {lat: 46.684273, lon: 7.850537},
        {lat: 46.684222, lon: 7.850664}
      ],
      tags: {
        highway: 'secondary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Bahnhofstrasse'
      }
    },
    {
      type: 'way',
      id: 24849733,
      geometry: [
        {lat: 46.6842, lon: 7.850719},
        {lat: 46.684027, lon: 7.851151}
      ],
      tags: {
        highway: 'secondary',
        lanes: '2',
        surface: 'asphalt',
        bridge: 'yes',
        name: 'Bahnhofstrasse'
      }
    },
    {
      type: 'way',
      id: 24849738,
      geometry: [
        {lat: 46.683851, lon: 7.851737},
        {lat: 46.683925, lon: 7.851749},
        {lat: 46.684103, lon: 7.851784},
        {lat: 46.684166, lon: 7.851815},
        {lat: 46.684373, lon: 7.85186},
        {lat: 46.684556, lon: 7.851906},
        {lat: 46.684661, lon: 7.851942}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Aareckstrasse'
      }
    },
    {
      type: 'way',
      id: 24849739,
      geometry: [
        {lat: 46.684661, lon: 7.851942},
        {lat: 46.684816, lon: 7.851997},
        {lat: 46.684978, lon: 7.852081},
        {lat: 46.685321, lon: 7.8523},
        {lat: 46.685374, lon: 7.852337},
        {lat: 46.685559, lon: 7.85249},
        {lat: 46.685634, lon: 7.852571},
        {lat: 46.685763, lon: 7.852727},
        {lat: 46.685835, lon: 7.852805},
        {lat: 46.685905, lon: 7.852843}
      ],
      tags: {
        highway: 'residential',
        width: '5',
        lanes: '1',
        surface: 'asphalt',
        name: 'Aareckstrasse'
      }
    },
    {
      type: 'way',
      id: 24849740,
      geometry: [
        {lat: 46.686055, lon: 7.853019},
        {lat: 46.68596, lon: 7.852893},
        {lat: 46.685905, lon: 7.852843}
      ],
      tags: {
        highway: 'residential',
        width: '2.40',
        lanes: '1',
        surface: 'asphalt',
        name: 'Aareckstrasse'
      }
    },
    {
      type: 'way',
      id: 24849741,
      geometry: [
        {lat: 46.688707, lon: 7.855744},
        {lat: 46.688652, lon: 7.855783},
        {lat: 46.688587, lon: 7.855804},
        {lat: 46.688337, lon: 7.855823},
        {lat: 46.688294, lon: 7.855747},
        {lat: 46.688284, lon: 7.855747}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Viktoriastrasse'
      }
    },
    {
      type: 'way',
      id: 24849743,
      geometry: [
        {lat: 46.688165, lon: 7.861854},
        {lat: 46.688258, lon: 7.861942},
        {lat: 46.68831, lon: 7.862061}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Höheweg'
      }
    },
    {
      type: 'way',
      id: 25676756,
      geometry: [
        {lat: 46.67152, lon: 7.838028},
        {lat: 46.671773, lon: 7.838488},
        {lat: 46.671887, lon: 7.838701},
        {lat: 46.67271, lon: 7.840165},
        {lat: 46.672949, lon: 7.840601},
        {lat: 46.67302, lon: 7.840745},
        {lat: 46.673161, lon: 7.840985},
        {lat: 46.673315, lon: 7.84126},
        {lat: 46.673713, lon: 7.841995},
        {lat: 46.674001, lon: 7.842504},
        {lat: 46.674325, lon: 7.843088},
        {lat: 46.67462, lon: 7.843635},
        {lat: 46.675201, lon: 7.844679},
        {lat: 46.675284, lon: 7.84482},
        {lat: 46.67549, lon: 7.845151},
        {lat: 46.67576, lon: 7.845552},
        {lat: 46.675944, lon: 7.845805},
        {lat: 46.676065, lon: 7.845963},
        {lat: 46.676168, lon: 7.846078},
        {lat: 46.676477, lon: 7.8464},
        {lat: 46.67675, lon: 7.846651},
        {lat: 46.677015, lon: 7.846875},
        {lat: 46.677262, lon: 7.847076},
        {lat: 46.677394, lon: 7.847162},
        {lat: 46.678166, lon: 7.847714},
        {lat: 46.678538, lon: 7.847968},
        {lat: 46.678693, lon: 7.84809},
        {lat: 46.678983, lon: 7.848291},
        {lat: 46.679016, lon: 7.848316}
      ],
      tags: {highway: 'track', surface: 'compacted', name: 'Kanalpromenade'}
    },
    {
      type: 'way',
      id: 25676757,
      geometry: [
        {lat: 46.679016, lon: 7.848316},
        {lat: 46.680073, lon: 7.84907},
        {lat: 46.680265, lon: 7.849184},
        {lat: 46.680318, lon: 7.849207},
        {lat: 46.680373, lon: 7.849222},
        {lat: 46.680431, lon: 7.849225},
        {lat: 46.680489, lon: 7.849224},
        {lat: 46.68056, lon: 7.849214},
        {lat: 46.680657, lon: 7.849174},
        {lat: 46.680784, lon: 7.849144},
        {lat: 46.680904, lon: 7.8491},
        {lat: 46.680976, lon: 7.849068},
        {lat: 46.680996, lon: 7.849063}
      ],
      tags: {
        highway: 'residential',
        width: '3.5',
        lanes: '1',
        surface: 'asphalt',
        name: 'Kanalpromenade'
      }
    },
    {
      type: 'way',
      id: 25676760,
      geometry: [
        {lat: 46.682783, lon: 7.850335},
        {lat: 46.683018, lon: 7.85041},
        {lat: 46.68308, lon: 7.850432},
        {lat: 46.6832, lon: 7.850519},
        {lat: 46.683307, lon: 7.850617},
        {lat: 46.683607, lon: 7.85089},
        {lat: 46.683656, lon: 7.850934},
        {lat: 46.683711, lon: 7.850983},
        {lat: 46.683783, lon: 7.851059},
        {lat: 46.683806, lon: 7.851092}
      ],
      tags: {
        highway: 'residential',
        width: '4.7',
        lanes: '1',
        surface: 'asphalt',
        name: 'Kanalpromenade'
      }
    },
    {
      type: 'way',
      id: 25676761,
      geometry: [
        {lat: 46.683618, lon: 7.853553},
        {lat: 46.683549, lon: 7.853408},
        {lat: 46.68343, lon: 7.853139},
        {lat: 46.683127, lon: 7.852454}
      ],
      tags: {
        highway: 'residential',
        width: '4.5',
        lanes: '1',
        surface: 'asphalt',
        name: 'Aarmühlestrasse'
      }
    },
    {
      type: 'way',
      id: 25676762,
      geometry: [
        {lat: 46.684286, lon: 7.855031},
        {lat: 46.684156, lon: 7.854728},
        {lat: 46.684031, lon: 7.854451}
      ],
      tags: {
        highway: 'residential',
        width: '4.5',
        lanes: '1',
        surface: 'asphalt',
        name: 'Aarmühlestrasse'
      }
    },
    {
      type: 'way',
      id: 25676764,
      geometry: [
        {lat: 46.682138, lon: 7.852443},
        {lat: 46.682201, lon: 7.852382},
        {lat: 46.682279, lon: 7.85238},
        {lat: 46.682316, lon: 7.852441},
        {lat: 46.68239, lon: 7.852829},
        {lat: 46.682783, lon: 7.854917},
        {lat: 46.682864, lon: 7.855345},
        {lat: 46.682929, lon: 7.855718}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Niesenstrasse'
      }
    },
    {
      type: 'way',
      id: 25676766,
      geometry: [
        {lat: 46.68239, lon: 7.852829},
        {lat: 46.682458, lon: 7.852823},
        {lat: 46.682644, lon: 7.852888},
        {lat: 46.682697, lon: 7.852927},
        {lat: 46.682745, lon: 7.853025},
        {lat: 46.682967, lon: 7.854018},
        {lat: 46.683139, lon: 7.854766},
        {lat: 46.683174, lon: 7.854917},
        {lat: 46.683314, lon: 7.855523}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Florastrasse'
      }
    },
    {
      type: 'way',
      id: 25676767,
      geometry: [
        {lat: 46.68273, lon: 7.85298},
        {lat: 46.682747, lon: 7.852893},
        {lat: 46.682785, lon: 7.852729},
        {lat: 46.68288, lon: 7.852358}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 25676768,
      geometry: [
        {lat: 46.684433, lon: 7.855484},
        {lat: 46.684611, lon: 7.855681},
        {lat: 46.68472, lon: 7.855811},
        {lat: 46.684821, lon: 7.855955},
        {lat: 46.684874, lon: 7.85602}
      ],
      tags: {
        highway: 'pedestrian',
        surface: 'paving_stones',
        name: 'Unionsgasse'
      }
    },
    {
      type: 'way',
      id: 25676772,
      geometry: [
        {lat: 46.687892, lon: 7.86224},
        {lat: 46.68792, lon: 7.862328},
        {lat: 46.687945, lon: 7.862429},
        {lat: 46.687964, lon: 7.862511},
        {lat: 46.688013, lon: 7.862733},
        {lat: 46.68811, lon: 7.863159},
        {lat: 46.688136, lon: 7.863272},
        {lat: 46.688158, lon: 7.863368},
        {lat: 46.688179, lon: 7.863461},
        {lat: 46.688177, lon: 7.863542},
        {lat: 46.688178, lon: 7.863641},
        {lat: 46.688168, lon: 7.863846},
        {lat: 46.688147, lon: 7.863948},
        {lat: 46.688129, lon: 7.864492},
        {lat: 46.688115, lon: 7.864945},
        {lat: 46.688054, lon: 7.866599},
        {lat: 46.68808, lon: 7.866722},
        {lat: 46.688107, lon: 7.866792}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Schlossstrasse'
      }
    },
    {
      type: 'way',
      id: 25676773,
      geometry: [
        {lat: 46.689255, lon: 7.868362},
        {lat: 46.689315, lon: 7.868833},
        {lat: 46.689325, lon: 7.868914}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Allmendstrasse'}
    },
    {
      type: 'way',
      id: 25676774,
      geometry: [
        {lat: 46.684659, lon: 7.86128},
        {lat: 46.684649, lon: 7.861116},
        {lat: 46.684622, lon: 7.860876},
        {lat: 46.684382, lon: 7.85918},
        {lat: 46.684301, lon: 7.858616},
        {lat: 46.684178, lon: 7.857752},
        {lat: 46.684173, lon: 7.85773}
      ],
      tags: {
        highway: 'tertiary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Alpenstrasse'
      }
    },
    {
      type: 'way',
      id: 25676775,
      geometry: [
        {lat: 46.684689, lon: 7.861541},
        {lat: 46.684709, lon: 7.86166},
        {lat: 46.684747, lon: 7.861903},
        {lat: 46.684766, lon: 7.862034},
        {lat: 46.684807, lon: 7.862333},
        {lat: 46.684873, lon: 7.86285},
        {lat: 46.684894, lon: 7.86302},
        {lat: 46.684925, lon: 7.863254}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Alpenstrasse'
      }
    },
    {
      type: 'way',
      id: 25676776,
      geometry: [
        {lat: 46.684573, lon: 7.861412},
        {lat: 46.684594, lon: 7.861497},
        {lat: 46.684645, lon: 7.861543},
        {lat: 46.684689, lon: 7.861541}
      ],
      tags: {
        highway: 'primary',
        lanes: '1',
        surface: 'asphalt',
        name: 'Sonnenhof'
      }
    },
    {
      type: 'way',
      id: 26172051,
      geometry: [
        {lat: 46.689366, lon: 7.870218},
        {lat: 46.689672, lon: 7.870135},
        {lat: 46.689935, lon: 7.870072},
        {lat: 46.69007, lon: 7.87004},
        {lat: 46.690153, lon: 7.87002}
      ],
      tags: {highway: 'footway', name: 'Burgerweg'}
    },
    {
      type: 'way',
      id: 26172053,
      geometry: [
        {lat: 46.690214, lon: 7.871447},
        {lat: 46.690276, lon: 7.871439},
        {lat: 46.69031, lon: 7.871366},
        {lat: 46.690272, lon: 7.870478},
        {lat: 46.690297, lon: 7.870398},
        {lat: 46.690362, lon: 7.87037},
        {lat: 46.690397, lon: 7.870419}
      ],
      tags: {highway: 'service', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 26172056,
      geometry: [
        {lat: 46.689367, lon: 7.879559},
        {lat: 46.689338, lon: 7.879443},
        {lat: 46.689277, lon: 7.879256},
        {lat: 46.689178, lon: 7.878958},
        {lat: 46.688864, lon: 7.878055}
      ],
      tags: {
        highway: 'tertiary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Lindenallee'
      }
    },
    {
      type: 'way',
      id: 26172058,
      geometry: [
        {lat: 46.688369, lon: 7.87877},
        {lat: 46.688438, lon: 7.878881},
        {lat: 46.688594, lon: 7.879134},
        {lat: 46.68867, lon: 7.879258},
        {lat: 46.688764, lon: 7.879412},
        {lat: 46.688896, lon: 7.879631},
        {lat: 46.68896, lon: 7.879737},
        {lat: 46.689002, lon: 7.879789},
        {lat: 46.689067, lon: 7.879815},
        {lat: 46.689136, lon: 7.879803},
        {lat: 46.689254, lon: 7.879761},
        {lat: 46.689306, lon: 7.879737}
      ],
      tags: {highway: 'residential', name: 'Untere Bönigstrasse'}
    },
    {
      type: 'way',
      id: 26172060,
      geometry: [
        {lat: 46.688369, lon: 7.87877},
        {lat: 46.688329, lon: 7.878699},
        {lat: 46.688279, lon: 7.878615},
        {lat: 46.688221, lon: 7.878546},
        {lat: 46.687987, lon: 7.878387},
        {lat: 46.687898, lon: 7.878331},
        {lat: 46.687523, lon: 7.878095},
        {lat: 46.687392, lon: 7.878004},
        {lat: 46.687319, lon: 7.877934},
        {lat: 46.687219, lon: 7.877801}
      ],
      tags: {highway: 'track', surface: 'paved'}
    },
    {
      type: 'way',
      id: 26172063,
      geometry: [
        {lat: 46.683376, lon: 7.876223},
        {lat: 46.683296, lon: 7.87616},
        {lat: 46.683233, lon: 7.876112}
      ],
      tags: {highway: 'motorway', lanes: '2', surface: 'asphalt', bridge: 'yes'}
    },
    {
      type: 'way',
      id: 26172064,
      geometry: [
        {lat: 46.683233, lon: 7.876112},
        {lat: 46.683003, lon: 7.875951},
        {lat: 46.682863, lon: 7.875866},
        {lat: 46.682611, lon: 7.875735},
        {lat: 46.682351, lon: 7.875629},
        {lat: 46.682228, lon: 7.875588},
        {lat: 46.682103, lon: 7.875552},
        {lat: 46.681833, lon: 7.875496},
        {lat: 46.6817, lon: 7.875478},
        {lat: 46.681551, lon: 7.875465},
        {lat: 46.681366, lon: 7.875462}
      ],
      tags: {highway: 'motorway', lanes: '2', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 26172065,
      geometry: [
        {lat: 46.683218, lon: 7.876246},
        {lat: 46.683281, lon: 7.876296},
        {lat: 46.683355, lon: 7.876357}
      ],
      tags: {highway: 'trunk', lanes: '1', surface: 'asphalt', bridge: 'yes'}
    },
    {
      type: 'way',
      id: 26172066,
      geometry: [
        {lat: 46.683355, lon: 7.876357},
        {lat: 46.683531, lon: 7.876513},
        {lat: 46.683723, lon: 7.876706},
        {lat: 46.683878, lon: 7.876881},
        {lat: 46.684128, lon: 7.877202},
        {lat: 46.684196, lon: 7.877302},
        {lat: 46.684275, lon: 7.877427}
      ],
      tags: {highway: 'trunk', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 26172068,
      geometry: [
        {lat: 46.683932, lon: 7.8753},
        {lat: 46.683752, lon: 7.875228},
        {lat: 46.683654, lon: 7.875188},
        {lat: 46.683414, lon: 7.875115},
        {lat: 46.683348, lon: 7.875103},
        {lat: 46.683285, lon: 7.8751}
      ],
      tags: {highway: 'service', surface: 'paved', name: 'Bönigstrasse'}
    },
    {
      type: 'way',
      id: 26172069,
      geometry: [
        {lat: 46.682244, lon: 7.870302},
        {lat: 46.682543, lon: 7.870399},
        {lat: 46.682683, lon: 7.870434},
        {lat: 46.682815, lon: 7.870452},
        {lat: 46.682905, lon: 7.870458},
        {lat: 46.683117, lon: 7.870471},
        {lat: 46.683133, lon: 7.870475}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Bühlweg'}
    },
    {
      type: 'way',
      id: 26172071,
      geometry: [
        {lat: 46.682195, lon: 7.866545},
        {lat: 46.681948, lon: 7.866526},
        {lat: 46.681408, lon: 7.866541}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Kesslergasse'
      }
    },
    {
      type: 'way',
      id: 26172072,
      geometry: [
        {lat: 46.683519, lon: 7.867769},
        {lat: 46.683492, lon: 7.867856},
        {lat: 46.683502, lon: 7.867934},
        {lat: 46.68353, lon: 7.868025},
        {lat: 46.683573, lon: 7.868117},
        {lat: 46.683747, lon: 7.868384},
        {lat: 46.683792, lon: 7.868466},
        {lat: 46.683839, lon: 7.868626},
        {lat: 46.683863, lon: 7.868727},
        {lat: 46.683897, lon: 7.868853},
        {lat: 46.683927, lon: 7.868947},
        {lat: 46.68412, lon: 7.869282}
      ],
      tags: {
        highway: 'residential',
        surface: 'asphalt',
        name: 'Alte Oelestrasse'
      }
    },
    {
      type: 'way',
      id: 26172073,
      geometry: [
        {lat: 46.68764, lon: 7.870447},
        {lat: 46.687444, lon: 7.870503}
      ],
      tags: {highway: 'footway', name: 'Burgerweg'}
    },
    {
      type: 'way',
      id: 26172075,
      geometry: [
        {lat: 46.687532, lon: 7.870399},
        {lat: 46.687405, lon: 7.87043},
        {lat: 46.687124, lon: 7.870484}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 26172076,
      geometry: [
        {lat: 46.687445, lon: 7.872784},
        {lat: 46.687489, lon: 7.872837},
        {lat: 46.687571, lon: 7.872845},
        {lat: 46.687735, lon: 7.872808},
        {lat: 46.687793, lon: 7.872838},
        {lat: 46.687904, lon: 7.873545},
        {lat: 46.687931, lon: 7.873623},
        {lat: 46.687963, lon: 7.873843},
        {lat: 46.68801, lon: 7.87414},
        {lat: 46.68803, lon: 7.874282},
        {lat: 46.688026, lon: 7.87438},
        {lat: 46.687999, lon: 7.874458},
        {lat: 46.687956, lon: 7.874543},
        {lat: 46.687934, lon: 7.874567}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 26172077,
      geometry: [
        {lat: 46.688029, lon: 7.874585},
        {lat: 46.687942, lon: 7.874616},
        {lat: 46.687651, lon: 7.874705},
        {lat: 46.687573, lon: 7.874731},
        {lat: 46.687511, lon: 7.874794},
        {lat: 46.687496, lon: 7.874882},
        {lat: 46.6875, lon: 7.874915}
      ],
      tags: {highway: 'service'}
    },
    {
      type: 'way',
      id: 26172078,
      geometry: [
        {lat: 46.688092, lon: 7.873696},
        {lat: 46.687922, lon: 7.873724}
      ],
      tags: {highway: 'footway', bridge: 'yes'}
    },
    {
      type: 'way',
      id: 26172079,
      geometry: [
        {lat: 46.687909, lon: 7.873572},
        {lat: 46.687847, lon: 7.873591},
        {lat: 46.687825, lon: 7.873669},
        {lat: 46.687866, lon: 7.873729},
        {lat: 46.687922, lon: 7.873724}
      ],
      tags: {highway: 'footway'}
    },
    {
      type: 'way',
      id: 26172085,
      geometry: [
        {lat: 46.688202, lon: 7.874976},
        {lat: 46.688198, lon: 7.874817},
        {lat: 46.688197, lon: 7.874719},
        {lat: 46.688208, lon: 7.874662}
      ],
      tags: {
        highway: 'primary',
        lanes: '1',
        surface: 'asphalt',
        name: 'Lindenallee'
      }
    },
    {
      type: 'way',
      id: 26172087,
      geometry: [
        {lat: 46.687617, lon: 7.870362},
        {lat: 46.687633, lon: 7.870524},
        {lat: 46.687642, lon: 7.870598}
      ],
      tags: {highway: 'footway'}
    },
    {
      type: 'way',
      id: 26646030,
      geometry: [
        {lat: 46.685162, lon: 7.848325},
        {lat: 46.68525, lon: 7.848417},
        {lat: 46.68533, lon: 7.848565},
        {lat: 46.685427, lon: 7.848695},
        {lat: 46.685627, lon: 7.848944},
        {lat: 46.68568, lon: 7.849004},
        {lat: 46.685906, lon: 7.849253},
        {lat: 46.686043, lon: 7.849392},
        {lat: 46.686076, lon: 7.849419}
      ],
      tags: {
        highway: 'residential',
        width: '5',
        surface: 'asphalt',
        name: 'Hauptstrasse'
      }
    },
    {
      type: 'way',
      id: 26646117,
      geometry: [
        {lat: 46.686492, lon: 7.852308},
        {lat: 46.686574, lon: 7.851998}
      ],
      tags: {
        highway: 'residential',
        width: '5.6',
        lanes: '1',
        surface: 'asphalt',
        bridge: 'yes',
        name: 'Spielmatte'
      }
    },
    {
      type: 'way',
      id: 26646118,
      geometry: [
        {lat: 46.687134, lon: 7.850542},
        {lat: 46.687142, lon: 7.850484}
      ],
      tags: {
        highway: 'residential',
        width: '5.5',
        surface: 'asphalt',
        name: 'Kreuzgasse'
      }
    },
    {
      type: 'way',
      id: 26957130,
      geometry: [
        {lat: 46.687142, lon: 7.850484},
        {lat: 46.687194, lon: 7.850507},
        {lat: 46.687279, lon: 7.850538},
        {lat: 46.687343, lon: 7.850569},
        {lat: 46.687435, lon: 7.850627},
        {lat: 46.687512, lon: 7.850684},
        {lat: 46.687568, lon: 7.850701},
        {lat: 46.68762, lon: 7.850675},
        {lat: 46.687628, lon: 7.850666}
      ],
      tags: {
        highway: 'residential',
        width: '5.1',
        surface: 'asphalt',
        name: 'Beatenbergstrasse'
      }
    },
    {
      type: 'way',
      id: 26957133,
      geometry: [
        {lat: 46.687976, lon: 7.848045},
        {lat: 46.687898, lon: 7.847983},
        {lat: 46.687714, lon: 7.847639},
        {lat: 46.687618, lon: 7.847435},
        {lat: 46.687436, lon: 7.847016},
        {lat: 46.687161, lon: 7.846389},
        {lat: 46.687122, lon: 7.846315},
        {lat: 46.687073, lon: 7.846224},
        {lat: 46.68699, lon: 7.846077},
        {lat: 46.686938, lon: 7.845989},
        {lat: 46.686886, lon: 7.845904},
        {lat: 46.686745, lon: 7.845692}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Gartenstrasse'}
    },
    {
      type: 'way',
      id: 27225432,
      geometry: [
        {lat: 46.688794, lon: 7.853105},
        {lat: 46.689123, lon: 7.852839},
        {lat: 46.689262, lon: 7.85271}
      ],
      tags: {highway: 'residential', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 27252037,
      geometry: [
        {lat: 46.681222, lon: 7.875617},
        {lat: 46.681539, lon: 7.875649},
        {lat: 46.681629, lon: 7.875661},
        {lat: 46.681759, lon: 7.875685},
        {lat: 46.681898, lon: 7.875723},
        {lat: 46.682089, lon: 7.8758},
        {lat: 46.682274, lon: 7.875903},
        {lat: 46.682337, lon: 7.875946},
        {lat: 46.682465, lon: 7.876049},
        {lat: 46.6826, lon: 7.876183},
        {lat: 46.682653, lon: 7.876242},
        {lat: 46.682822, lon: 7.876463},
        {lat: 46.682893, lon: 7.876581},
        {lat: 46.682991, lon: 7.876764}
      ],
      tags: {highway: 'motorway_link', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 27378743,
      geometry: [
        {lat: 46.699462, lon: 7.877093},
        {lat: 46.699335, lon: 7.876874},
        {lat: 46.699107, lon: 7.876755},
        {lat: 46.698994, lon: 7.876624},
        {lat: 46.698902, lon: 7.876386},
        {lat: 46.698846, lon: 7.87624},
        {lat: 46.698781, lon: 7.876136},
        {lat: 46.698712, lon: 7.876048},
        {lat: 46.698572, lon: 7.875889},
        {lat: 46.698455, lon: 7.875758},
        {lat: 46.698347, lon: 7.875649},
        {lat: 46.698255, lon: 7.875573},
        {lat: 46.698108, lon: 7.875475},
        {lat: 46.697985, lon: 7.87539},
        {lat: 46.697862, lon: 7.875271},
        {lat: 46.69773, lon: 7.875134},
        {lat: 46.697553, lon: 7.874945},
        {lat: 46.697509, lon: 7.874887},
        {lat: 46.697452, lon: 7.874781},
        {lat: 46.69734, lon: 7.874598},
        {lat: 46.697229, lon: 7.874424},
        {lat: 46.697122, lon: 7.874263},
        {lat: 46.697049, lon: 7.874141},
        {lat: 46.696997, lon: 7.874043},
        {lat: 46.696959, lon: 7.873949},
        {lat: 46.696924, lon: 7.873836},
        {lat: 46.696838, lon: 7.873617},
        {lat: 46.696757, lon: 7.873401},
        {lat: 46.696665, lon: 7.873139},
        {lat: 46.696571, lon: 7.872834},
        {lat: 46.696481, lon: 7.87256},
        {lat: 46.696452, lon: 7.872432},
        {lat: 46.696435, lon: 7.872335},
        {lat: 46.696408, lon: 7.872237},
        {lat: 46.696349, lon: 7.872155},
        {lat: 46.696299, lon: 7.872122},
        {lat: 46.696224, lon: 7.871988},
        {lat: 46.696203, lon: 7.871908},
        {lat: 46.696191, lon: 7.871777},
        {lat: 46.696182, lon: 7.871643},
        {lat: 46.696157, lon: 7.871518},
        {lat: 46.69613, lon: 7.871391},
        {lat: 46.696103, lon: 7.871302},
        {lat: 46.696065, lon: 7.871214},
        {lat: 46.696026, lon: 7.871147},
        {lat: 46.695982, lon: 7.871083},
        {lat: 46.695929, lon: 7.870979},
        {lat: 46.695863, lon: 7.870824},
        {lat: 46.695781, lon: 7.87066},
        {lat: 46.695712, lon: 7.870465},
        {lat: 46.695654, lon: 7.870312},
        {lat: 46.695625, lon: 7.870203},
        {lat: 46.695582, lon: 7.870103},
        {lat: 46.695548, lon: 7.870031},
        {lat: 46.695511, lon: 7.869911}
      ],
      tags: {highway: 'track'}
    },
    {
      type: 'way',
      id: 27781656,
      geometry: [
        {lat: 46.68901, lon: 7.864145},
        {lat: 46.688955, lon: 7.86414},
        {lat: 46.688851, lon: 7.864123},
        {lat: 46.688731, lon: 7.864083},
        {lat: 46.68855, lon: 7.863994}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Schlossstrasse'
      }
    },
    {
      type: 'way',
      id: 32856627,
      geometry: [
        {lat: 46.69149, lon: 7.864531},
        {lat: 46.691415, lon: 7.864393},
        {lat: 46.691372, lon: 7.864345},
        {lat: 46.691315, lon: 7.864294},
        {lat: 46.691249, lon: 7.864252},
        {lat: 46.691177, lon: 7.864196},
        {lat: 46.691106, lon: 7.864073},
        {lat: 46.691054, lon: 7.863944},
        {lat: 46.691018, lon: 7.863854},
        {lat: 46.690994, lon: 7.863771},
        {lat: 46.690987, lon: 7.863595},
        {lat: 46.690987, lon: 7.863411},
        {lat: 46.690987, lon: 7.863094},
        {lat: 46.690989, lon: 7.862902},
        {lat: 46.691002, lon: 7.862814},
        {lat: 46.691025, lon: 7.862736},
        {lat: 46.691042, lon: 7.862661}
      ],
      tags: {highway: 'service', name: 'Brienzstrasse'}
    },
    {
      type: 'way',
      id: 32856650,
      geometry: [
        {lat: 46.69149, lon: 7.864531},
        {lat: 46.691429, lon: 7.864495},
        {lat: 46.691346, lon: 7.864484},
        {lat: 46.691289, lon: 7.864521},
        {lat: 46.691311, lon: 7.864627},
        {lat: 46.691384, lon: 7.864636},
        {lat: 46.691445, lon: 7.864687},
        {lat: 46.69149, lon: 7.864765},
        {lat: 46.691401, lon: 7.864768},
        {lat: 46.691325, lon: 7.864799},
        {lat: 46.691234, lon: 7.864796},
        {lat: 46.691153, lon: 7.864748},
        {lat: 46.691094, lon: 7.864699},
        {lat: 46.69111, lon: 7.864819},
        {lat: 46.691151, lon: 7.864937},
        {lat: 46.691191, lon: 7.865},
        {lat: 46.691216, lon: 7.865098},
        {lat: 46.691116, lon: 7.865072},
        {lat: 46.691067, lon: 7.865017},
        {lat: 46.691014, lon: 7.86498},
        {lat: 46.690965, lon: 7.864908},
        {lat: 46.690945, lon: 7.865003},
        {lat: 46.690963, lon: 7.865086},
        {lat: 46.690981, lon: 7.865178},
        {lat: 46.690944, lon: 7.865242}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 33645970,
      geometry: [
        {lat: 46.682495, lon: 7.872891},
        {lat: 46.682563, lon: 7.873019},
        {lat: 46.683162, lon: 7.874199},
        {lat: 46.683201, lon: 7.874269},
        {lat: 46.68325, lon: 7.874332},
        {lat: 46.68331, lon: 7.874366}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Kupfergasse'}
    },
    {
      type: 'way',
      id: 33682678,
      geometry: [
        {lat: 46.679276, lon: 7.851706},
        {lat: 46.679009, lon: 7.851935},
        {lat: 46.678813, lon: 7.85209},
        {lat: 46.678731, lon: 7.852156},
        {lat: 46.678301, lon: 7.852513},
        {lat: 46.678044, lon: 7.852738}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Friedweg'
      }
    },
    {
      type: 'way',
      id: 33682706,
      geometry: [
        {lat: 46.677362, lon: 7.851297},
        {lat: 46.677293, lon: 7.851142},
        {lat: 46.67723, lon: 7.851},
        {lat: 46.677174, lon: 7.850855},
        {lat: 46.677114, lon: 7.850682},
        {lat: 46.67708, lon: 7.850582},
        {lat: 46.677016, lon: 7.8504},
        {lat: 46.676966, lon: 7.850275},
        {lat: 46.676882, lon: 7.850085},
        {lat: 46.676594, lon: 7.849551}
      ],
      tags: {
        highway: 'primary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Därligenstrasse'
      }
    },
    {
      type: 'way',
      id: 33682814,
      geometry: [
        {lat: 46.680587, lon: 7.85493},
        {lat: 46.680234, lon: 7.85531},
        {lat: 46.680161, lon: 7.855355},
        {lat: 46.680311, lon: 7.855809},
        {lat: 46.680337, lon: 7.855887},
        {lat: 46.680289, lon: 7.856015},
        {lat: 46.680238, lon: 7.85609}
      ],
      tags: {highway: 'footway', surface: 'pebblestone'}
    },
    {
      type: 'way',
      id: 33682958,
      geometry: [
        {lat: 46.68125, lon: 7.856556},
        {lat: 46.681353, lon: 7.856519},
        {lat: 46.681434, lon: 7.85646},
        {lat: 46.681523, lon: 7.856398},
        {lat: 46.681643, lon: 7.856332},
        {lat: 46.681756, lon: 7.856282},
        {lat: 46.68232, lon: 7.856011},
        {lat: 46.682466, lon: 7.855945},
        {lat: 46.682558, lon: 7.855884},
        {lat: 46.682652, lon: 7.855808}
      ],
      tags: {
        highway: 'service',
        lanes: '1',
        surface: 'asphalt',
        name: 'Rosenstrasse'
      }
    },
    {
      type: 'way',
      id: 33683396,
      geometry: [
        {lat: 46.681507, lon: 7.862089},
        {lat: 46.681515, lon: 7.862171},
        {lat: 46.681501, lon: 7.862282},
        {lat: 46.681482, lon: 7.862372},
        {lat: 46.681468, lon: 7.862464},
        {lat: 46.681448, lon: 7.862636},
        {lat: 46.681426, lon: 7.862795},
        {lat: 46.681401, lon: 7.862901},
        {lat: 46.681372, lon: 7.862994},
        {lat: 46.681344, lon: 7.863082},
        {lat: 46.681275, lon: 7.863233},
        {lat: 46.681179, lon: 7.863406},
        {lat: 46.681118, lon: 7.8635},
        {lat: 46.681061, lon: 7.863579},
        {lat: 46.680987, lon: 7.863666},
        {lat: 46.680862, lon: 7.863797},
        {lat: 46.680701, lon: 7.863956},
        {lat: 46.680604, lon: 7.864038},
        {lat: 46.680558, lon: 7.864073}
      ],
      tags: {
        highway: 'secondary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Hauptstrasse'
      }
    },
    {
      type: 'way',
      id: 33683412,
      geometry: [
        {lat: 46.679542, lon: 7.861626},
        {lat: 46.680013, lon: 7.86311},
        {lat: 46.680076, lon: 7.863307},
        {lat: 46.680139, lon: 7.863507},
        {lat: 46.680278, lon: 7.863944},
        {lat: 46.680338, lon: 7.864221}
      ],
      tags: {highway: 'residential', name: 'Tellweg'}
    },
    {
      type: 'way',
      id: 33683448,
      geometry: [
        {lat: 46.679553, lon: 7.864655},
        {lat: 46.679841, lon: 7.865871},
        {lat: 46.679866, lon: 7.865975},
        {lat: 46.680085, lon: 7.86688}
      ],
      tags: {highway: 'unclassified', lanes: '1', name: 'Baumgartenstrasse'}
    },
    {
      type: 'way',
      id: 33683462,
      geometry: [
        {lat: 46.678376, lon: 7.864816},
        {lat: 46.678341, lon: 7.864958},
        {lat: 46.678315, lon: 7.865111},
        {lat: 46.678291, lon: 7.865313},
        {lat: 46.678316, lon: 7.865428},
        {lat: 46.678343, lon: 7.865523}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Brunngasse'
      }
    },
    {
      type: 'way',
      id: 33683466,
      geometry: [
        {lat: 46.680633, lon: 7.866632},
        {lat: 46.680573, lon: 7.866784},
        {lat: 46.68053, lon: 7.866866},
        {lat: 46.680478, lon: 7.866892},
        {lat: 46.680292, lon: 7.86699},
        {lat: 46.680126, lon: 7.867063}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Dorfstrasse'
      }
    },
    {
      type: 'way',
      id: 33683555,
      geometry: [
        {lat: 46.676745, lon: 7.865398},
        {lat: 46.676775, lon: 7.86555},
        {lat: 46.676914, lon: 7.866239},
        {lat: 46.676936, lon: 7.866357},
        {lat: 46.677002, lon: 7.866718},
        {lat: 46.677061, lon: 7.867014},
        {lat: 46.677206, lon: 7.867774},
        {lat: 46.677357, lon: 7.868568},
        {lat: 46.677397, lon: 7.868774},
        {lat: 46.677397, lon: 7.869429}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Mattenstrasse'
      }
    },
    {
      type: 'way',
      id: 33683569,
      geometry: [
        {lat: 46.679278, lon: 7.868366},
        {lat: 46.679131, lon: 7.868285},
        {lat: 46.679017, lon: 7.868226},
        {lat: 46.678783, lon: 7.868135},
        {lat: 46.678654, lon: 7.868003},
        {lat: 46.678517, lon: 7.867918},
        {lat: 46.678224, lon: 7.868046},
        {lat: 46.678151, lon: 7.868093}
      ],
      tags: {highway: 'service', name: 'Eyacheri'}
    },
    {
      type: 'way',
      id: 33683954,
      geometry: [
        {lat: 46.673166, lon: 7.869882},
        {lat: 46.673199, lon: 7.870025},
        {lat: 46.673245, lon: 7.870162},
        {lat: 46.67374, lon: 7.871112},
        {lat: 46.673894, lon: 7.871379},
        {lat: 46.674068, lon: 7.871666},
        {lat: 46.67435, lon: 7.87213},
        {lat: 46.674538, lon: 7.872398},
        {lat: 46.674789, lon: 7.872797},
        {lat: 46.675255, lon: 7.873447},
        {lat: 46.675635, lon: 7.873917},
        {lat: 46.675811, lon: 7.874101},
        {lat: 46.676096, lon: 7.874378},
        {lat: 46.676522, lon: 7.874713}
      ],
      tags: {highway: 'track', surface: 'compacted', name: 'Senggigässli'}
    },
    {
      type: 'way',
      id: 33683985,
      geometry: [
        {lat: 46.680991, lon: 7.870489},
        {lat: 46.680618, lon: 7.870588},
        {lat: 46.68043, lon: 7.870558},
        {lat: 46.680271, lon: 7.870417},
        {lat: 46.679901, lon: 7.870032},
        {lat: 46.679598, lon: 7.869688},
        {lat: 46.679295, lon: 7.869341},
        {lat: 46.679173, lon: 7.869221}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Herziggässli'
      }
    },
    {
      type: 'way',
      id: 33684089,
      geometry: [
        {lat: 46.687105, lon: 7.859637},
        {lat: 46.68721, lon: 7.85954}
      ],
      tags: {highway: 'footway', surface: 'asphalt', name: 'Peter-Ober-Allee'}
    },
    {
      type: 'way',
      id: 33684202,
      geometry: [
        {lat: 46.688179, lon: 7.863461},
        {lat: 46.688239, lon: 7.863558},
        {lat: 46.688291, lon: 7.863689},
        {lat: 46.688337, lon: 7.863778},
        {lat: 46.68838, lon: 7.863838},
        {lat: 46.688473, lon: 7.863936},
        {lat: 46.68855, lon: 7.863994}
      ],
      tags: {
        highway: 'residential',
        width: '4.2',
        lanes: '1',
        surface: 'asphalt',
        name: 'Schlossstrasse'
      }
    },
    {
      type: 'way',
      id: 33684316,
      geometry: [
        {lat: 46.686876, lon: 7.866907},
        {lat: 46.686643, lon: 7.867005},
        {lat: 46.686284, lon: 7.867168},
        {lat: 46.686041, lon: 7.867266},
        {lat: 46.68619, lon: 7.868069}
      ],
      tags: {highway: 'residential', name: 'Lindenallee'}
    },
    {
      type: 'way',
      id: 33684372,
      geometry: [
        {lat: 46.683373, lon: 7.86158},
        {lat: 46.68346, lon: 7.862082},
        {lat: 46.683483, lon: 7.862188},
        {lat: 46.683508, lon: 7.862306},
        {lat: 46.683577, lon: 7.862551},
        {lat: 46.683598, lon: 7.862626},
        {lat: 46.683593, lon: 7.862706},
        {lat: 46.683177, lon: 7.862902},
        {lat: 46.682699, lon: 7.863105},
        {lat: 46.682532, lon: 7.863182},
        {lat: 46.682371, lon: 7.863257},
        {lat: 46.682183, lon: 7.863352},
        {lat: 46.681875, lon: 7.863531}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Birkenweg'
      }
    },
    {
      type: 'way',
      id: 33684382,
      geometry: [
        {lat: 46.684925, lon: 7.863254},
        {lat: 46.684801, lon: 7.863315},
        {lat: 46.684681, lon: 7.863383},
        {lat: 46.684628, lon: 7.863417},
        {lat: 46.68454, lon: 7.86347},
        {lat: 46.684422, lon: 7.863555},
        {lat: 46.684281, lon: 7.863671},
        {lat: 46.68415, lon: 7.863784},
        {lat: 46.684021, lon: 7.863888},
        {lat: 46.683867, lon: 7.864012},
        {lat: 46.683757, lon: 7.864082},
        {lat: 46.683606, lon: 7.864158},
        {lat: 46.683536, lon: 7.864192},
        {lat: 46.683189, lon: 7.864306},
        {lat: 46.682705, lon: 7.864411},
        {lat: 46.682601, lon: 7.864424},
        {lat: 46.682507, lon: 7.864437},
        {lat: 46.682048, lon: 7.864497}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Klostergässli'
      }
    },
    {
      type: 'way',
      id: 33684383,
      geometry: [
        {lat: 46.682195, lon: 7.866545},
        {lat: 46.682206, lon: 7.866657},
        {lat: 46.682212, lon: 7.867054},
        {lat: 46.682242, lon: 7.867336}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Rütistrasse'
      }
    },
    {
      type: 'way',
      id: 33684763,
      geometry: [
        {lat: 46.677801, lon: 7.864717},
        {lat: 46.677779, lon: 7.864638},
        {lat: 46.677755, lon: 7.864564},
        {lat: 46.677636, lon: 7.864345}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Rugenstrasse'}
    },
    {
      type: 'way',
      id: 33684855,
      geometry: [
        {lat: 46.677636, lon: 7.864345},
        {lat: 46.677344, lon: 7.864768}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Feldgässli'}
    },
    {
      type: 'way',
      id: 34138408,
      geometry: [
        {lat: 46.691042, lon: 7.862661},
        {lat: 46.691087, lon: 7.862721},
        {lat: 46.691142, lon: 7.862729},
        {lat: 46.691227, lon: 7.862744},
        {lat: 46.691301, lon: 7.862799},
        {lat: 46.691351, lon: 7.862839},
        {lat: 46.691392, lon: 7.862885}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 34138410,
      geometry: [
        {lat: 46.692945, lon: 7.861752},
        {lat: 46.692904, lon: 7.861677},
        {lat: 46.692866, lon: 7.861605},
        {lat: 46.692876, lon: 7.861499},
        {lat: 46.692898, lon: 7.861342},
        {lat: 46.692906, lon: 7.861221},
        {lat: 46.692929, lon: 7.861104},
        {lat: 46.692978, lon: 7.860989},
        {lat: 46.693037, lon: 7.861115},
        {lat: 46.693084, lon: 7.861236},
        {lat: 46.69312, lon: 7.861327},
        {lat: 46.693163, lon: 7.86139},
        {lat: 46.693179, lon: 7.861282},
        {lat: 46.693191, lon: 7.861161},
        {lat: 46.693232, lon: 7.861046},
        {lat: 46.693317, lon: 7.861055},
        {lat: 46.693389, lon: 7.861049},
        {lat: 46.693454, lon: 7.860998},
        {lat: 46.693454, lon: 7.861124},
        {lat: 46.693466, lon: 7.861239},
        {lat: 46.693517, lon: 7.861325},
        {lat: 46.693594, lon: 7.861425},
        {lat: 46.693655, lon: 7.861514},
        {lat: 46.693686, lon: 7.861603},
        {lat: 46.69371, lon: 7.861468},
        {lat: 46.693706, lon: 7.861333},
        {lat: 46.693724, lon: 7.861196},
        {lat: 46.693787, lon: 7.86131},
        {lat: 46.693843, lon: 7.861436},
        {lat: 46.693889, lon: 7.861545},
        {lat: 46.693897, lon: 7.861689},
        {lat: 46.693897, lon: 7.861772},
        {lat: 46.693859, lon: 7.861895},
        {lat: 46.693794, lon: 7.862004},
        {lat: 46.693678, lon: 7.862056},
        {lat: 46.693625, lon: 7.862081},
        {lat: 46.693547, lon: 7.862119},
        {lat: 46.693509, lon: 7.862193},
        {lat: 46.693507, lon: 7.862305},
        {lat: 46.69357, lon: 7.862457},
        {lat: 46.6936, lon: 7.862523},
        {lat: 46.693629, lon: 7.862603},
        {lat: 46.693647, lon: 7.862718},
        {lat: 46.693671, lon: 7.862838},
        {lat: 46.69371, lon: 7.862956},
        {lat: 46.693787, lon: 7.863025},
        {lat: 46.693842, lon: 7.863048},
        {lat: 46.693895, lon: 7.863073},
        {lat: 46.693952, lon: 7.863102},
        {lat: 46.694038, lon: 7.86318},
        {lat: 46.694111, lon: 7.863234},
        {lat: 46.694119, lon: 7.863237}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 34206687,
      geometry: [
        {lat: 46.699091, lon: 7.845827},
        {lat: 46.699095, lon: 7.845945},
        {lat: 46.699138, lon: 7.846},
        {lat: 46.699175, lon: 7.846119},
        {lat: 46.699217, lon: 7.846195},
        {lat: 46.6993, lon: 7.846267},
        {lat: 46.699346, lon: 7.846349},
        {lat: 46.699222, lon: 7.846374},
        {lat: 46.699115, lon: 7.84632},
        {lat: 46.699044, lon: 7.846233},
        {lat: 46.698927, lon: 7.846215},
        {lat: 46.698589, lon: 7.846066},
        {lat: 46.698468, lon: 7.846004},
        {lat: 46.698272, lon: 7.845917},
        {lat: 46.698191, lon: 7.845873},
        {lat: 46.698138, lon: 7.845833},
        {lat: 46.698014, lon: 7.845793},
        {lat: 46.697959, lon: 7.845758},
        {lat: 46.697893, lon: 7.845706},
        {lat: 46.697665, lon: 7.845647},
        {lat: 46.697538, lon: 7.845637},
        {lat: 46.697181, lon: 7.845572},
        {lat: 46.69694, lon: 7.84547},
        {lat: 46.696678, lon: 7.845405},
        {lat: 46.696601, lon: 7.845405},
        {lat: 46.69665, lon: 7.845464},
        {lat: 46.696708, lon: 7.84556},
        {lat: 46.696772, lon: 7.845688},
        {lat: 46.696678, lon: 7.845687},
        {lat: 46.696515, lon: 7.845657},
        {lat: 46.696449, lon: 7.845698},
        {lat: 46.696404, lon: 7.845753},
        {lat: 46.696548, lon: 7.845909},
        {lat: 46.696602, lon: 7.845988},
        {lat: 46.696536, lon: 7.845998},
        {lat: 46.696317, lon: 7.84597},
        {lat: 46.696221, lon: 7.845935},
        {lat: 46.696139, lon: 7.845913},
        {lat: 46.696016, lon: 7.845757},
        {lat: 46.695945, lon: 7.845599},
        {lat: 46.695826, lon: 7.845426},
        {lat: 46.695754, lon: 7.845343},
        {lat: 46.695704, lon: 7.845384},
        {lat: 46.6957, lon: 7.845585},
        {lat: 46.695733, lon: 7.84577},
        {lat: 46.695781, lon: 7.845924},
        {lat: 46.695817, lon: 7.846032},
        {lat: 46.695861, lon: 7.846127},
        {lat: 46.69596, lon: 7.846227},
        {lat: 46.696107, lon: 7.846395},
        {lat: 46.696166, lon: 7.846475},
        {lat: 46.696054, lon: 7.846506},
        {lat: 46.695902, lon: 7.846437},
        {lat: 46.695625, lon: 7.846443},
        {lat: 46.695545, lon: 7.846357},
        {lat: 46.695435, lon: 7.846186},
        {lat: 46.695326, lon: 7.845994},
        {lat: 46.695267, lon: 7.845869},
        {lat: 46.695197, lon: 7.845775},
        {lat: 46.695122, lon: 7.845705},
        {lat: 46.69505, lon: 7.845708},
        {lat: 46.69503, lon: 7.84581},
        {lat: 46.69511, lon: 7.846055},
        {lat: 46.695158, lon: 7.846462},
        {lat: 46.695208, lon: 7.846642},
        {lat: 46.695272, lon: 7.846801},
        {lat: 46.695361, lon: 7.847},
        {lat: 46.695446, lon: 7.847187},
        {lat: 46.695539, lon: 7.847294},
        {lat: 46.695659, lon: 7.847395},
        {lat: 46.695876, lon: 7.847529},
        {lat: 46.695981, lon: 7.847674},
        {lat: 46.696086, lon: 7.847846},
        {lat: 46.696147, lon: 7.847926},
        {lat: 46.69627, lon: 7.847973},
        {lat: 46.696389, lon: 7.848025},
        {lat: 46.696501, lon: 7.848103},
        {lat: 46.696624, lon: 7.848253},
        {lat: 46.696716, lon: 7.848373},
        {lat: 46.696879, lon: 7.848607},
        {lat: 46.69699, lon: 7.848754},
        {lat: 46.697075, lon: 7.848897},
        {lat: 46.697205, lon: 7.849129},
        {lat: 46.697276, lon: 7.849257},
        {lat: 46.697352, lon: 7.84942},
        {lat: 46.697441, lon: 7.849612},
        {lat: 46.697504, lon: 7.849747},
        {lat: 46.697573, lon: 7.849864},
        {lat: 46.697528, lon: 7.849918},
        {lat: 46.697469, lon: 7.84989},
        {lat: 46.69741, lon: 7.849818},
        {lat: 46.697258, lon: 7.849719},
        {lat: 46.697068, lon: 7.849761},
        {lat: 46.696905, lon: 7.849788},
        {lat: 46.696806, lon: 7.849782},
        {lat: 46.696596, lon: 7.849773},
        {lat: 46.696407, lon: 7.849773},
        {lat: 46.696296, lon: 7.849742},
        {lat: 46.696206, lon: 7.849741},
        {lat: 46.696185, lon: 7.849794}
      ],
      tags: {highway: 'path', surface: 'unpaved'}
    },
    {
      type: 'way',
      id: 34206692,
      geometry: [
        {lat: 46.689613, lon: 7.853621},
        {lat: 46.689368, lon: 7.853789},
        {lat: 46.689308, lon: 7.853845},
        {lat: 46.689244, lon: 7.853886},
        {lat: 46.68907, lon: 7.85401}
      ],
      tags: {highway: 'footway', surface: 'paving_stones'}
    },
    {
      type: 'way',
      id: 34206694,
      geometry: [
        {lat: 46.687655, lon: 7.854119},
        {lat: 46.687708, lon: 7.854138},
        {lat: 46.687936, lon: 7.854279},
        {lat: 46.688066, lon: 7.854366},
        {lat: 46.688209, lon: 7.854462},
        {lat: 46.688642, lon: 7.85473},
        {lat: 46.68872, lon: 7.854779}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Postgasse'
      }
    },
    {
      type: 'way',
      id: 34321735,
      geometry: [
        {lat: 46.691228, lon: 7.865149},
        {lat: 46.691281, lon: 7.865209},
        {lat: 46.69137, lon: 7.865181},
        {lat: 46.691443, lon: 7.865203},
        {lat: 46.691494, lon: 7.865246},
        {lat: 46.691521, lon: 7.865364}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 34723022,
      geometry: [
        {lat: 46.675283, lon: 7.854209},
        {lat: 46.674916, lon: 7.853961},
        {lat: 46.674791, lon: 7.853916},
        {lat: 46.674705, lon: 7.85391},
        {lat: 46.67462, lon: 7.853912},
        {lat: 46.674222, lon: 7.854151},
        {lat: 46.674125, lon: 7.854204},
        {lat: 46.673972, lon: 7.854207},
        {lat: 46.673754, lon: 7.854103},
        {lat: 46.67317, lon: 7.853852},
        {lat: 46.673081, lon: 7.853797},
        {lat: 46.672502, lon: 7.853421},
        {lat: 46.672253, lon: 7.85326},
        {lat: 46.672117, lon: 7.85315}
      ],
      tags: {
        highway: 'unclassified',
        lanes: '1',
        surface: 'asphalt',
        name: 'Heimwehfluhstrasse'
      }
    },
    {
      type: 'way',
      id: 34917947,
      geometry: [
        {lat: 46.682733, lon: 7.865952},
        {lat: 46.682542, lon: 7.86602},
        {lat: 46.682484, lon: 7.866034},
        {lat: 46.682168, lon: 7.866027}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Lärchenweg'
      }
    },
    {
      type: 'way',
      id: 34917948,
      geometry: [
        {lat: 46.683687, lon: 7.866083},
        {lat: 46.683487, lon: 7.866525},
        {lat: 46.683373, lon: 7.866776},
        {lat: 46.682899, lon: 7.866304},
        {lat: 46.682846, lon: 7.866251},
        {lat: 46.682763, lon: 7.866093},
        {lat: 46.682733, lon: 7.865952},
        {lat: 46.682821, lon: 7.865914},
        {lat: 46.682918, lon: 7.865872},
        {lat: 46.682995, lon: 7.86584},
        {lat: 46.683052, lon: 7.86582},
        {lat: 46.683217, lon: 7.865801},
        {lat: 46.68337, lon: 7.865857},
        {lat: 46.683687, lon: 7.866083}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Lärchenweg'}
    },
    {
      type: 'way',
      id: 34917950,
      geometry: [
        {lat: 46.682054, lon: 7.864607},
        {lat: 46.681996, lon: 7.864699},
        {lat: 46.681958, lon: 7.864821},
        {lat: 46.681935, lon: 7.864897},
        {lat: 46.681881, lon: 7.865009},
        {lat: 46.681828, lon: 7.865086},
        {lat: 46.681817, lon: 7.865187},
        {lat: 46.681842, lon: 7.865346},
        {lat: 46.681877, lon: 7.865468},
        {lat: 46.681913, lon: 7.86555},
        {lat: 46.68196, lon: 7.865666},
        {lat: 46.681984, lon: 7.86579},
        {lat: 46.681983, lon: 7.865926},
        {lat: 46.681975, lon: 7.866014},
        {lat: 46.681932, lon: 7.866318},
        {lat: 46.681917, lon: 7.866526}
      ],
      tags: {
        highway: 'residential',
        width: '3.3',
        lanes: '1',
        surface: 'asphalt',
        name: 'Alte Unterdorfstrasse'
      }
    },
    {
      type: 'way',
      id: 34917951,
      geometry: [
        {lat: 46.681834, lon: 7.863308},
        {lat: 46.681334, lon: 7.864164},
        {lat: 46.68122, lon: 7.864474},
        {lat: 46.681118, lon: 7.864942},
        {lat: 46.681012, lon: 7.865475},
        {lat: 46.680941, lon: 7.865697},
        {lat: 46.680835, lon: 7.865898}
      ],
      tags: {highway: 'footway', width: '1', name: 'Hobachergässli'}
    },
    {
      type: 'way',
      id: 34917952,
      geometry: [
        {lat: 46.680835, lon: 7.865898},
        {lat: 46.680899, lon: 7.866587}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Hobachergässli'}
    },
    {
      type: 'way',
      id: 34917953,
      geometry: [
        {lat: 46.682045, lon: 7.864447},
        {lat: 46.681334, lon: 7.864164}
      ],
      tags: {highway: 'footway', surface: 'asphalt', name: 'Hobachergässli'}
    },
    {
      type: 'way',
      id: 34917954,
      geometry: [
        {lat: 46.681823, lon: 7.863249},
        {lat: 46.681379, lon: 7.8631},
        {lat: 46.681344, lon: 7.863082}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 34917955,
      geometry: [
        {lat: 46.680309, lon: 7.868718},
        {lat: 46.680673, lon: 7.868604},
        {lat: 46.680779, lon: 7.868573}
      ],
      tags: {highway: 'unclassified', surface: 'asphalt', name: 'Rütigässli'}
    },
    {
      type: 'way',
      id: 34917956,
      geometry: [
        {lat: 46.680573, lon: 7.866784},
        {lat: 46.680785, lon: 7.867196},
        {lat: 46.680798, lon: 7.867481}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Rütigässli'}
    },
    {
      type: 'way',
      id: 34917957,
      geometry: [
        {lat: 46.680798, lon: 7.867481},
        {lat: 46.680779, lon: 7.868573}
      ],
      tags: {highway: 'footway', surface: 'asphalt', name: 'Rütigässli'}
    },
    {
      type: 'way',
      id: 34917958,
      geometry: [
        {lat: 46.680779, lon: 7.868573},
        {lat: 46.680838, lon: 7.86904},
        {lat: 46.680827, lon: 7.86921},
        {lat: 46.680757, lon: 7.869405}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Rütigässli'}
    },
    {
      type: 'way',
      id: 34917959,
      geometry: [
        {lat: 46.68525, lon: 7.86219},
        {lat: 46.685149, lon: 7.862228},
        {lat: 46.685009, lon: 7.86227},
        {lat: 46.684852, lon: 7.862319},
        {lat: 46.684807, lon: 7.862333}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 34917960,
      geometry: [
        {lat: 46.685774, lon: 7.86302},
        {lat: 46.685644, lon: 7.862593}
      ],
      tags: {highway: 'path', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 34917961,
      geometry: [
        {lat: 46.68406, lon: 7.870085},
        {lat: 46.68378, lon: 7.869888}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 34918347,
      geometry: [
        {lat: 46.681331, lon: 7.871218},
        {lat: 46.680992, lon: 7.871444},
        {lat: 46.680956, lon: 7.871588},
        {lat: 46.680912, lon: 7.871648},
        {lat: 46.681009, lon: 7.871945},
        {lat: 46.681229, lon: 7.872178},
        {lat: 46.681586, lon: 7.871969},
        {lat: 46.681737, lon: 7.87176}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 34918349,
      geometry: [
        {lat: 46.687883, lon: 7.863481},
        {lat: 46.687956, lon: 7.863457},
        {lat: 46.68802, lon: 7.863436},
        {lat: 46.688082, lon: 7.863421},
        {lat: 46.688167, lon: 7.8634}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Schloss'}
    },
    {
      type: 'way',
      id: 35006037,
      geometry: [
        {lat: 46.681229, lon: 7.872178},
        {lat: 46.681165, lon: 7.872318},
        {lat: 46.681141, lon: 7.872422}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 35006038,
      geometry: [
        {lat: 46.679059, lon: 7.870231},
        {lat: 46.679134, lon: 7.8703},
        {lat: 46.679146, lon: 7.870591},
        {lat: 46.679147, lon: 7.87094},
        {lat: 46.679214, lon: 7.871649},
        {lat: 46.679188, lon: 7.871973},
        {lat: 46.679136, lon: 7.872294},
        {lat: 46.679108, lon: 7.872381},
        {lat: 46.679008, lon: 7.872698},
        {lat: 46.678984, lon: 7.872858},
        {lat: 46.678996, lon: 7.872995},
        {lat: 46.679036, lon: 7.873152},
        {lat: 46.679116, lon: 7.87342},
        {lat: 46.679184, lon: 7.873645},
        {lat: 46.679371, lon: 7.874051},
        {lat: 46.679693, lon: 7.874961},
        {lat: 46.67981, lon: 7.875226},
        {lat: 46.67986, lon: 7.875314},
        {lat: 46.679928, lon: 7.875375}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Juheigässli'}
    },
    {
      type: 'way',
      id: 35006040,
      geometry: [
        {lat: 46.682495, lon: 7.872891},
        {lat: 46.681965, lon: 7.87364},
        {lat: 46.681922, lon: 7.873702},
        {lat: 46.681868, lon: 7.873779},
        {lat: 46.681824, lon: 7.873841},
        {lat: 46.681732, lon: 7.873981},
        {lat: 46.681606, lon: 7.874157},
        {lat: 46.681107, lon: 7.874864},
        {lat: 46.680969, lon: 7.875077},
        {lat: 46.680911, lon: 7.875138},
        {lat: 46.68082, lon: 7.875176},
        {lat: 46.680588, lon: 7.875219},
        {lat: 46.680397, lon: 7.87527},
        {lat: 46.680276, lon: 7.875302},
        {lat: 46.680216, lon: 7.875315},
        {lat: 46.680055, lon: 7.875349},
        {lat: 46.679992, lon: 7.875359},
        {lat: 46.679935, lon: 7.875349}
      ],
      tags: {highway: 'track', surface: 'compacted'}
    },
    {
      type: 'way',
      id: 35006041,
      geometry: [
        {lat: 46.679928, lon: 7.875375},
        {lat: 46.680111, lon: 7.875085},
        {lat: 46.680214, lon: 7.874929},
        {lat: 46.680316, lon: 7.874784},
        {lat: 46.680509, lon: 7.874511},
        {lat: 46.680597, lon: 7.874383},
        {lat: 46.680961, lon: 7.873855},
        {lat: 46.681186, lon: 7.873529},
        {lat: 46.681279, lon: 7.873394},
        {lat: 46.681557, lon: 7.872994},
        {lat: 46.68175, lon: 7.872716},
        {lat: 46.682099, lon: 7.872198}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Feldweg'}
    },
    {
      type: 'way',
      id: 35006042,
      geometry: [
        {lat: 46.678151, lon: 7.868093},
        {lat: 46.678113, lon: 7.868194},
        {lat: 46.677965, lon: 7.868249},
        {lat: 46.677829, lon: 7.868268}
      ],
      tags: {highway: 'footway', name: 'Eyacheri'}
    },
    {
      type: 'way',
      id: 35070230,
      geometry: [
        {lat: 46.68599, lon: 7.846218},
        {lat: 46.686046, lon: 7.846277},
        {lat: 46.686094, lon: 7.846333},
        {lat: 46.686244, lon: 7.846533},
        {lat: 46.686298, lon: 7.846588},
        {lat: 46.686492, lon: 7.846812},
        {lat: 46.686541, lon: 7.846892},
        {lat: 46.686592, lon: 7.847017},
        {lat: 46.686636, lon: 7.847217},
        {lat: 46.686639, lon: 7.847305},
        {lat: 46.686639, lon: 7.847388},
        {lat: 46.68664, lon: 7.847584},
        {lat: 46.686647, lon: 7.847675},
        {lat: 46.686664, lon: 7.847769},
        {lat: 46.686684, lon: 7.847857},
        {lat: 46.686712, lon: 7.847981},
        {lat: 46.686791, lon: 7.848255},
        {lat: 46.686818, lon: 7.848336},
        {lat: 46.686873, lon: 7.848479},
        {lat: 46.686913, lon: 7.848582},
        {lat: 46.686941, lon: 7.848674},
        {lat: 46.686953, lon: 7.848726}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Freihofstrasse'}
    },
    {
      type: 'way',
      id: 35070238,
      geometry: [
        {lat: 46.687097, lon: 7.850854},
        {lat: 46.687032, lon: 7.851276},
        {lat: 46.687017, lon: 7.851341}
      ],
      tags: {
        highway: 'residential',
        width: '5.6',
        surface: 'asphalt',
        name: 'Spielmatte'
      }
    },
    {
      type: 'way',
      id: 35070239,
      geometry: [
        {lat: 46.687097, lon: 7.850854},
        {lat: 46.687134, lon: 7.850542}
      ],
      tags: {
        highway: 'residential',
        width: '5.4',
        surface: 'asphalt',
        bridge: 'yes',
        name: 'Spielmatte'
      }
    },
    {
      type: 'way',
      id: 35079962,
      geometry: [
        {lat: 46.67664, lon: 7.874872},
        {lat: 46.676863, lon: 7.874474},
        {lat: 46.677461, lon: 7.873509}
      ],
      tags: {
        highway: 'residential',
        surface: 'asphalt',
        name: 'Aenderbergstrasse'
      }
    },
    {
      type: 'way',
      id: 35079963,
      geometry: [
        {lat: 46.67664, lon: 7.874872},
        {lat: 46.676389, lon: 7.875278}
      ],
      tags: {
        highway: 'unclassified',
        surface: 'asphalt',
        bridge: 'yes',
        name: 'Aenderbergstrasse'
      }
    },
    {
      type: 'way',
      id: 35081140,
      geometry: [
        {lat: 46.685297, lon: 7.878822},
        {lat: 46.685429, lon: 7.878796},
        {lat: 46.685597, lon: 7.878753},
        {lat: 46.685744, lon: 7.878707},
        {lat: 46.685904, lon: 7.878644},
        {lat: 46.686054, lon: 7.878573},
        {lat: 46.686211, lon: 7.878492},
        {lat: 46.686312, lon: 7.878431},
        {lat: 46.686421, lon: 7.878359},
        {lat: 46.686551, lon: 7.878269},
        {lat: 46.686705, lon: 7.878141},
        {lat: 46.686845, lon: 7.878018},
        {lat: 46.686894, lon: 7.87797},
        {lat: 46.686966, lon: 7.8779}
      ],
      tags: {highway: 'trunk', lanes: '2', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 35081145,
      geometry: [
        {lat: 46.688476, lon: 7.875703},
        {lat: 46.688679, lon: 7.875471},
        {lat: 46.688788, lon: 7.875365},
        {lat: 46.688842, lon: 7.875327},
        {lat: 46.688937, lon: 7.875289}
      ],
      tags: {highway: 'trunk_link', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 35094756,
      geometry: [
        {lat: 46.691778, lon: 7.867134},
        {lat: 46.691754, lon: 7.867235},
        {lat: 46.691741, lon: 7.867349},
        {lat: 46.691774, lon: 7.867481},
        {lat: 46.691837, lon: 7.867691},
        {lat: 46.691856, lon: 7.867772},
        {lat: 46.69188, lon: 7.867918},
        {lat: 46.691918, lon: 7.868055},
        {lat: 46.691974, lon: 7.868161},
        {lat: 46.692119, lon: 7.86837},
        {lat: 46.692374, lon: 7.868643},
        {lat: 46.692483, lon: 7.868748}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Brienzstrasse'}
    },
    {
      type: 'way',
      id: 35398112,
      geometry: [
        {lat: 46.691042, lon: 7.862661},
        {lat: 46.691057, lon: 7.86253},
        {lat: 46.691123, lon: 7.862417},
        {lat: 46.691189, lon: 7.862329},
        {lat: 46.691251, lon: 7.862263},
        {lat: 46.691329, lon: 7.862208},
        {lat: 46.691431, lon: 7.86213},
        {lat: 46.69148, lon: 7.862087},
        {lat: 46.691491, lon: 7.862006},
        {lat: 46.691434, lon: 7.86187},
        {lat: 46.691377, lon: 7.86177},
        {lat: 46.691336, lon: 7.861692},
        {lat: 46.691318, lon: 7.861573},
        {lat: 46.691325, lon: 7.861422},
        {lat: 46.691337, lon: 7.861332},
        {lat: 46.69136, lon: 7.861246},
        {lat: 46.691382, lon: 7.861156},
        {lat: 46.691405, lon: 7.861065},
        {lat: 46.691437, lon: 7.860939},
        {lat: 46.691462, lon: 7.860816},
        {lat: 46.691508, lon: 7.860697},
        {lat: 46.691548, lon: 7.860622},
        {lat: 46.6916, lon: 7.860489},
        {lat: 46.691632, lon: 7.860413},
        {lat: 46.691658, lon: 7.86034},
        {lat: 46.691726, lon: 7.860212},
        {lat: 46.691798, lon: 7.860091},
        {lat: 46.691859, lon: 7.859995},
        {lat: 46.691916, lon: 7.859935},
        {lat: 46.691948, lon: 7.859867},
        {lat: 46.691957, lon: 7.859746},
        {lat: 46.69199, lon: 7.859645},
        {lat: 46.692035, lon: 7.859532},
        {lat: 46.692097, lon: 7.859401},
        {lat: 46.692126, lon: 7.859303},
        {lat: 46.692133, lon: 7.859197},
        {lat: 46.692123, lon: 7.859066},
        {lat: 46.692104, lon: 7.858983},
        {lat: 46.69209, lon: 7.858825},
        {lat: 46.692083, lon: 7.858737},
        {lat: 46.692085, lon: 7.858583},
        {lat: 46.692087, lon: 7.85849},
        {lat: 46.692088, lon: 7.858404},
        {lat: 46.69208, lon: 7.858258},
        {lat: 46.69205, lon: 7.858135},
        {lat: 46.692021, lon: 7.858037},
        {lat: 46.691986, lon: 7.857899},
        {lat: 46.691961, lon: 7.857818},
        {lat: 46.691933, lon: 7.857737},
        {lat: 46.691907, lon: 7.857662},
        {lat: 46.691879, lon: 7.857586},
        {lat: 46.691838, lon: 7.857483},
        {lat: 46.691788, lon: 7.857398},
        {lat: 46.691745, lon: 7.857279},
        {lat: 46.691708, lon: 7.857176},
        {lat: 46.691689, lon: 7.857078},
        {lat: 46.69165, lon: 7.856965},
        {lat: 46.691638, lon: 7.856831},
        {lat: 46.69161, lon: 7.856741},
        {lat: 46.691555, lon: 7.856688},
        {lat: 46.691508, lon: 7.856635},
        {lat: 46.691486, lon: 7.856527},
        {lat: 46.691441, lon: 7.856451},
        {lat: 46.691399, lon: 7.856363},
        {lat: 46.691373, lon: 7.856227},
        {lat: 46.691361, lon: 7.856106},
        {lat: 46.691327, lon: 7.856001},
        {lat: 46.691282, lon: 7.8559},
        {lat: 46.691232, lon: 7.855829},
        {lat: 46.691182, lon: 7.855731},
        {lat: 46.691163, lon: 7.855626},
        {lat: 46.691156, lon: 7.85551},
        {lat: 46.691094, lon: 7.855419},
        {lat: 46.691002, lon: 7.855331},
        {lat: 46.690956, lon: 7.855213},
        {lat: 46.6909, lon: 7.855102},
        {lat: 46.690859, lon: 7.855047},
        {lat: 46.690805, lon: 7.854984},
        {lat: 46.69075, lon: 7.854913},
        {lat: 46.690702, lon: 7.854848},
        {lat: 46.690621, lon: 7.854742},
        {lat: 46.690555, lon: 7.854656},
        {lat: 46.690489, lon: 7.854599},
        {lat: 46.690393, lon: 7.854561},
        {lat: 46.690332, lon: 7.854518},
        {lat: 46.690281, lon: 7.85444},
        {lat: 46.69027, lon: 7.854314},
        {lat: 46.690258, lon: 7.854206},
        {lat: 46.69026, lon: 7.854073},
        {lat: 46.690222, lon: 7.854158},
        {lat: 46.690189, lon: 7.853997},
        {lat: 46.690177, lon: 7.853919},
        {lat: 46.690142, lon: 7.853818},
        {lat: 46.690127, lon: 7.853949},
        {lat: 46.690103, lon: 7.854042},
        {lat: 46.69006, lon: 7.853909},
        {lat: 46.690042, lon: 7.853833},
        {lat: 46.690025, lon: 7.853697},
        {lat: 46.689987, lon: 7.853587},
        {lat: 46.689958, lon: 7.853519},
        {lat: 46.689858, lon: 7.853398},
        {lat: 46.689792, lon: 7.85332},
        {lat: 46.689738, lon: 7.853255},
        {lat: 46.689671, lon: 7.853194},
        {lat: 46.689585, lon: 7.853136},
        {lat: 46.6895, lon: 7.853023},
        {lat: 46.689447, lon: 7.852945},
        {lat: 46.689405, lon: 7.852877},
        {lat: 46.689385, lon: 7.852839}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 35399149,
      geometry: [
        {lat: 46.691412, lon: 7.876151},
        {lat: 46.691474, lon: 7.876178},
        {lat: 46.691816, lon: 7.876085},
        {lat: 46.69207, lon: 7.876019},
        {lat: 46.692615, lon: 7.875876},
        {lat: 46.692841, lon: 7.875807}
      ],
      tags: {highway: 'residential', name: 'Dammweg'}
    },
    {
      type: 'way',
      id: 35551459,
      geometry: [
        {lat: 46.683391, lon: 7.844793},
        {lat: 46.683563, lon: 7.845133},
        {lat: 46.683611, lon: 7.845228},
        {lat: 46.683676, lon: 7.845349},
        {lat: 46.683806, lon: 7.845589},
        {lat: 46.683869, lon: 7.845705},
        {lat: 46.684016, lon: 7.845979},
        {lat: 46.684099, lon: 7.846132},
        {lat: 46.684156, lon: 7.846242},
        {lat: 46.684341, lon: 7.846595},
        {lat: 46.684424, lon: 7.846753},
        {lat: 46.684514, lon: 7.846918},
        {lat: 46.684593, lon: 7.847061},
        {lat: 46.684663, lon: 7.847184},
        {lat: 46.684698, lon: 7.847244},
        {lat: 46.684894, lon: 7.847575},
        {lat: 46.685049, lon: 7.847855},
        {lat: 46.685094, lon: 7.847937},
        {lat: 46.685156, lon: 7.848067},
        {lat: 46.685167, lon: 7.848117}
      ],
      tags: {
        highway: 'secondary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Seestrasse'
      }
    },
    {
      type: 'way',
      id: 35876194,
      geometry: [
        {lat: 46.674743, lon: 7.850648},
        {lat: 46.674827, lon: 7.850684},
        {lat: 46.675062, lon: 7.85084},
        {lat: 46.675196, lon: 7.850884},
        {lat: 46.675252, lon: 7.850864},
        {lat: 46.675325, lon: 7.850803},
        {lat: 46.675397, lon: 7.85078},
        {lat: 46.675542, lon: 7.85081},
        {lat: 46.67561, lon: 7.850796},
        {lat: 46.675646, lon: 7.85064},
        {lat: 46.675631, lon: 7.850522}
      ],
      tags: {highway: 'service', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 37109470,
      geometry: [
        {lat: 46.685276, lon: 7.879942},
        {lat: 46.685217, lon: 7.879619},
        {lat: 46.685149, lon: 7.879317},
        {lat: 46.685083, lon: 7.879068},
        {lat: 46.685018, lon: 7.878848},
        {lat: 46.68492, lon: 7.878564},
        {lat: 46.684868, lon: 7.878429},
        {lat: 46.684772, lon: 7.878195},
        {lat: 46.684666, lon: 7.877966},
        {lat: 46.68455, lon: 7.877732},
        {lat: 46.684478, lon: 7.877601},
        {lat: 46.684306, lon: 7.877272}
      ],
      tags: {highway: 'motorway', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 37109471,
      geometry: [
        {lat: 46.685349, lon: 7.881569},
        {lat: 46.685376, lon: 7.881447},
        {lat: 46.685397, lon: 7.88133},
        {lat: 46.685414, lon: 7.881195},
        {lat: 46.685422, lon: 7.88111},
        {lat: 46.685438, lon: 7.880864},
        {lat: 46.685456, lon: 7.880624},
        {lat: 46.685496, lon: 7.88032},
        {lat: 46.685535, lon: 7.880092},
        {lat: 46.685555, lon: 7.880002},
        {lat: 46.685588, lon: 7.879882},
        {lat: 46.685645, lon: 7.879699},
        {lat: 46.685678, lon: 7.879608},
        {lat: 46.685761, lon: 7.879411},
        {lat: 46.685869, lon: 7.879208},
        {lat: 46.686001, lon: 7.879001},
        {lat: 46.686159, lon: 7.878799},
        {lat: 46.686376, lon: 7.878561},
        {lat: 46.68647, lon: 7.878468},
        {lat: 46.686729, lon: 7.878215},
        {lat: 46.686966, lon: 7.8779}
      ],
      tags: {highway: 'trunk_link', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 37109475,
      geometry: [
        {lat: 46.688476, lon: 7.875703},
        {lat: 46.688706, lon: 7.875329},
        {lat: 46.688855, lon: 7.875092},
        {lat: 46.689084, lon: 7.87474}
      ],
      tags: {highway: 'trunk', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 37109480,
      geometry: [
        {lat: 46.694428, lon: 7.871262},
        {lat: 46.694519, lon: 7.871288},
        {lat: 46.694548, lon: 7.8713}
      ],
      tags: {highway: 'primary', lanes: '2', surface: 'asphalt', bridge: 'yes'}
    },
    {
      type: 'way',
      id: 37109481,
      geometry: [
        {lat: 46.689321, lon: 7.875938},
        {lat: 46.689348, lon: 7.875788},
        {lat: 46.689355, lon: 7.875699},
        {lat: 46.689353, lon: 7.875608},
        {lat: 46.689344, lon: 7.875483},
        {lat: 46.689279, lon: 7.875062},
        {lat: 46.689267, lon: 7.874888},
        {lat: 46.689273, lon: 7.874757},
        {lat: 46.689302, lon: 7.874614},
        {lat: 46.68935, lon: 7.874489},
        {lat: 46.689455, lon: 7.874225}
      ],
      tags: {highway: 'primary_link', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 37109482,
      geometry: [
        {lat: 46.684682, lon: 7.878817},
        {lat: 46.684777, lon: 7.878834},
        {lat: 46.684878, lon: 7.878843},
        {lat: 46.684978, lon: 7.878848},
        {lat: 46.685117, lon: 7.878845},
        {lat: 46.68522, lon: 7.878835}
      ],
      tags: {highway: 'trunk', lanes: '2', surface: 'asphalt', bridge: 'yes'}
    },
    {
      type: 'way',
      id: 37801554,
      geometry: [
        {lat: 46.688227, lon: 7.874624},
        {lat: 46.688328, lon: 7.874539},
        {lat: 46.688397, lon: 7.874509},
        {lat: 46.688509, lon: 7.874473},
        {lat: 46.688577, lon: 7.874457},
        {lat: 46.688638, lon: 7.874448},
        {lat: 46.688726, lon: 7.874461},
        {lat: 46.688793, lon: 7.874506},
        {lat: 46.68884, lon: 7.874574},
        {lat: 46.688866, lon: 7.874644},
        {lat: 46.688877, lon: 7.874753},
        {lat: 46.688859, lon: 7.874867},
        {lat: 46.688818, lon: 7.874972},
        {lat: 46.688646, lon: 7.875262},
        {lat: 46.688529, lon: 7.875452},
        {lat: 46.688443, lon: 7.875602}
      ],
      tags: {highway: 'trunk_link', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 37801556,
      geometry: [
        {lat: 46.688443, lon: 7.875602},
        {lat: 46.688222, lon: 7.876128}
      ],
      tags: {
        highway: 'trunk_link',
        lanes: '1',
        surface: 'asphalt',
        bridge: 'yes'
      }
    },
    {
      type: 'way',
      id: 37801560,
      geometry: [
        {lat: 46.683404, lon: 7.87764},
        {lat: 46.683448, lon: 7.877732},
        {lat: 46.683496, lon: 7.877823},
        {lat: 46.683573, lon: 7.877949},
        {lat: 46.68365, lon: 7.878044}
      ],
      tags: {highway: 'trunk', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 37801561,
      geometry: [
        {lat: 46.683176, lon: 7.87715},
        {lat: 46.683404, lon: 7.87764}
      ],
      tags: {highway: 'trunk', lanes: '1', surface: 'asphalt', bridge: 'yes'}
    },
    {
      type: 'way',
      id: 37801563,
      geometry: [
        {lat: 46.68365, lon: 7.878044},
        {lat: 46.6836, lon: 7.877921},
        {lat: 46.683556, lon: 7.877797}
      ],
      tags: {highway: 'trunk_link', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 37801564,
      geometry: [
        {lat: 46.683556, lon: 7.877797},
        {lat: 46.683538, lon: 7.877712},
        {lat: 46.683525, lon: 7.877628},
        {lat: 46.683537, lon: 7.877443},
        {lat: 46.683571, lon: 7.877335},
        {lat: 46.683638, lon: 7.877229},
        {lat: 46.6837, lon: 7.877172},
        {lat: 46.683805, lon: 7.877133},
        {lat: 46.683839, lon: 7.877129}
      ],
      tags: {highway: 'trunk_link', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 37801565,
      geometry: [
        {lat: 46.683839, lon: 7.877129},
        {lat: 46.683921, lon: 7.877141},
        {lat: 46.683986, lon: 7.877172},
        {lat: 46.684047, lon: 7.877216},
        {lat: 46.684136, lon: 7.877295},
        {lat: 46.684275, lon: 7.877427}
      ],
      tags: {highway: 'trunk_link', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 37801567,
      geometry: [
        {lat: 46.687908, lon: 7.873006},
        {lat: 46.687874, lon: 7.872764},
        {lat: 46.687846, lon: 7.87256},
        {lat: 46.687713, lon: 7.871682},
        {lat: 46.687564, lon: 7.870651},
        {lat: 46.687532, lon: 7.870399}
      ],
      tags: {
        highway: 'primary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Lindenallee'
      }
    },
    {
      type: 'way',
      id: 37801568,
      geometry: [
        {lat: 46.688937, lon: 7.875289},
        {lat: 46.689041, lon: 7.875293},
        {lat: 46.689115, lon: 7.875329},
        {lat: 46.689177, lon: 7.875384},
        {lat: 46.689235, lon: 7.875463},
        {lat: 46.689278, lon: 7.875561},
        {lat: 46.689302, lon: 7.875676},
        {lat: 46.689312, lon: 7.875757},
        {lat: 46.689321, lon: 7.875938}
      ],
      tags: {highway: 'trunk_link', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 40750096,
      geometry: [
        {lat: 46.673237, lon: 7.882591},
        {lat: 46.673329, lon: 7.882365},
        {lat: 46.673426, lon: 7.882116},
        {lat: 46.673457, lon: 7.882035},
        {lat: 46.673588, lon: 7.881694},
        {lat: 46.673619, lon: 7.881622},
        {lat: 46.67381, lon: 7.881183},
        {lat: 46.674344, lon: 7.88001},
        {lat: 46.674408, lon: 7.879869},
        {lat: 46.674454, lon: 7.879768},
        {lat: 46.674912, lon: 7.878762},
        {lat: 46.674968, lon: 7.878645},
        {lat: 46.675376, lon: 7.877779},
        {lat: 46.675614, lon: 7.877233},
        {lat: 46.675797, lon: 7.876814},
        {lat: 46.675824, lon: 7.876746},
        {lat: 46.67585, lon: 7.876669},
        {lat: 46.67595, lon: 7.876368},
        {lat: 46.67603, lon: 7.876127}
      ],
      tags: {
        highway: 'unclassified',
        surface: 'asphalt',
        name: 'Aenderbergstrasse'
      }
    },
    {
      type: 'way',
      id: 40750369,
      geometry: [
        {lat: 46.674538, lon: 7.872398},
        {lat: 46.674627, lon: 7.872349},
        {lat: 46.675024, lon: 7.872266},
        {lat: 46.675199, lon: 7.872264},
        {lat: 46.675317, lon: 7.872275},
        {lat: 46.67544, lon: 7.872294},
        {lat: 46.675583, lon: 7.872259},
        {lat: 46.675712, lon: 7.872188},
        {lat: 46.676025, lon: 7.87193}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Senggigässli'}
    },
    {
      type: 'way',
      id: 40751117,
      geometry: [
        {lat: 46.675627, lon: 7.865072},
        {lat: 46.675747, lon: 7.866031}
      ],
      tags: {highway: 'footway'}
    },
    {
      type: 'way',
      id: 40751166,
      geometry: [
        {lat: 46.675627, lon: 7.865072},
        {lat: 46.675519, lon: 7.865065},
        {lat: 46.675198, lon: 7.865092},
        {lat: 46.674902, lon: 7.865124},
        {lat: 46.674546, lon: 7.865132}
      ],
      tags: {highway: 'track', name: 'Feldgässli'}
    },
    {
      type: 'way',
      id: 40821261,
      geometry: [
        {lat: 46.67715, lon: 7.863025},
        {lat: 46.677256, lon: 7.86312},
        {lat: 46.677332, lon: 7.86324},
        {lat: 46.677466, lon: 7.863382},
        {lat: 46.677562, lon: 7.86339},
        {lat: 46.67772, lon: 7.863377},
        {lat: 46.677776, lon: 7.863345},
        {lat: 46.677815, lon: 7.863287},
        {lat: 46.677909, lon: 7.863129},
        {lat: 46.678012, lon: 7.862919},
        {lat: 46.678102, lon: 7.862567},
        {lat: 46.678163, lon: 7.862424},
        {lat: 46.678189, lon: 7.862283},
        {lat: 46.678224, lon: 7.861951},
        {lat: 46.678297, lon: 7.861604},
        {lat: 46.678354, lon: 7.861459},
        {lat: 46.678394, lon: 7.861382},
        {lat: 46.67843, lon: 7.861288},
        {lat: 46.678464, lon: 7.861182},
        {lat: 46.678559, lon: 7.861134},
        {lat: 46.678628, lon: 7.861066},
        {lat: 46.678661, lon: 7.860975},
        {lat: 46.678692, lon: 7.86084},
        {lat: 46.6787, lon: 7.8607},
        {lat: 46.678688, lon: 7.860623},
        {lat: 46.678636, lon: 7.860411},
        {lat: 46.678609, lon: 7.860321},
        {lat: 46.678594, lon: 7.860235},
        {lat: 46.678602, lon: 7.860132},
        {lat: 46.678624, lon: 7.860036},
        {lat: 46.678661, lon: 7.859943},
        {lat: 46.678718, lon: 7.859858},
        {lat: 46.678812, lon: 7.859796},
        {lat: 46.678886, lon: 7.85974},
        {lat: 46.678871, lon: 7.859633},
        {lat: 46.67875, lon: 7.859581},
        {lat: 46.678643, lon: 7.859505},
        {lat: 46.678596, lon: 7.859407},
        {lat: 46.678596, lon: 7.859202},
        {lat: 46.678545, lon: 7.859064}
      ],
      tags: {highway: 'track', surface: 'gravel', name: 'Ringweg'}
    },
    {
      type: 'way',
      id: 40857977,
      geometry: [
        {lat: 46.676269, lon: 7.859908},
        {lat: 46.676284, lon: 7.859987},
        {lat: 46.676265, lon: 7.860372},
        {lat: 46.676293, lon: 7.86048},
        {lat: 46.676365, lon: 7.860533},
        {lat: 46.676423, lon: 7.860536},
        {lat: 46.676499, lon: 7.860621},
        {lat: 46.676737, lon: 7.860901},
        {lat: 46.676818, lon: 7.86095},
        {lat: 46.676908, lon: 7.86097},
        {lat: 46.67694, lon: 7.861052},
        {lat: 46.676942, lon: 7.861143},
        {lat: 46.676927, lon: 7.861237},
        {lat: 46.676983, lon: 7.861291},
        {lat: 46.677025, lon: 7.861228},
        {lat: 46.677034, lon: 7.861101},
        {lat: 46.677025, lon: 7.860964},
        {lat: 46.677029, lon: 7.860826},
        {lat: 46.677045, lon: 7.860747},
        {lat: 46.677093, lon: 7.860667},
        {lat: 46.677167, lon: 7.860601},
        {lat: 46.677263, lon: 7.860543},
        {lat: 46.677362, lon: 7.860512},
        {lat: 46.677421, lon: 7.86048},
        {lat: 46.677456, lon: 7.86035},
        {lat: 46.677421, lon: 7.860282},
        {lat: 46.677397, lon: 7.860208},
        {lat: 46.677385, lon: 7.86011},
        {lat: 46.677385, lon: 7.859989},
        {lat: 46.677405, lon: 7.859672},
        {lat: 46.677463, lon: 7.859401},
        {lat: 46.67747, lon: 7.859298},
        {lat: 46.677433, lon: 7.859232},
        {lat: 46.677368, lon: 7.859205},
        {lat: 46.677269, lon: 7.859135},
        {lat: 46.677194, lon: 7.859005},
        {lat: 46.677047, lon: 7.858846},
        {lat: 46.676973, lon: 7.858735},
        {lat: 46.676899, lon: 7.858524},
        {lat: 46.676837, lon: 7.858464},
        {lat: 46.676729, lon: 7.858418},
        {lat: 46.676637, lon: 7.858367},
        {lat: 46.676449, lon: 7.858283},
        {lat: 46.676407, lon: 7.858226},
        {lat: 46.676025, lon: 7.857414},
        {lat: 46.675936, lon: 7.857145},
        {lat: 46.675909, lon: 7.857053},
        {lat: 46.675858, lon: 7.856874},
        {lat: 46.675796, lon: 7.8568},
        {lat: 46.675706, lon: 7.856855},
        {lat: 46.675619, lon: 7.857167},
        {lat: 46.675579, lon: 7.857415},
        {lat: 46.675515, lon: 7.857734},
        {lat: 46.675403, lon: 7.858098},
        {lat: 46.675316, lon: 7.858375},
        {lat: 46.67527, lon: 7.858605},
        {lat: 46.67507, lon: 7.858994},
        {lat: 46.674995, lon: 7.85925},
        {lat: 46.6749, lon: 7.85938}
      ],
      tags: {highway: 'track', surface: 'gravel'}
    },
    {
      type: 'way',
      id: 40868212,
      geometry: [
        {lat: 46.676269, lon: 7.859908},
        {lat: 46.676123, lon: 7.859808},
        {lat: 46.676041, lon: 7.859807},
        {lat: 46.676009, lon: 7.859707},
        {lat: 46.676032, lon: 7.859632},
        {lat: 46.676096, lon: 7.859477},
        {lat: 46.676121, lon: 7.859367},
        {lat: 46.676169, lon: 7.859285},
        {lat: 46.67624, lon: 7.859286},
        {lat: 46.676452, lon: 7.859408},
        {lat: 46.676452, lon: 7.859509},
        {lat: 46.676473, lon: 7.859616},
        {lat: 46.67656, lon: 7.85968},
        {lat: 46.676622, lon: 7.859674},
        {lat: 46.676715, lon: 7.859715},
        {lat: 46.676864, lon: 7.859745},
        {lat: 46.677036, lon: 7.859825},
        {lat: 46.676999, lon: 7.859748},
        {lat: 46.677112, lon: 7.859721},
        {lat: 46.677226, lon: 7.859677},
        {lat: 46.677204, lon: 7.859582},
        {lat: 46.67712, lon: 7.859528},
        {lat: 46.677368, lon: 7.859379},
        {lat: 46.677463, lon: 7.859401}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 40868269,
      geometry: [
        {lat: 46.675903, lon: 7.859046},
        {lat: 46.676015, lon: 7.858886},
        {lat: 46.675779, lon: 7.859002},
        {lat: 46.675818, lon: 7.858385},
        {lat: 46.675829, lon: 7.858051},
        {lat: 46.675822, lon: 7.857298},
        {lat: 46.675815, lon: 7.85705},
        {lat: 46.675833, lon: 7.856972},
        {lat: 46.675909, lon: 7.857053}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 40869115,
      geometry: [
        {lat: 46.677047, lon: 7.858846},
        {lat: 46.677132, lon: 7.85884},
        {lat: 46.677204, lon: 7.85882},
        {lat: 46.677284, lon: 7.85882},
        {lat: 46.677355, lon: 7.85886},
        {lat: 46.677447, lon: 7.858872},
        {lat: 46.677535, lon: 7.858795},
        {lat: 46.677573, lon: 7.858711},
        {lat: 46.677576, lon: 7.858606},
        {lat: 46.677571, lon: 7.858516},
        {lat: 46.677597, lon: 7.858412},
        {lat: 46.677629, lon: 7.858344},
        {lat: 46.677689, lon: 7.858322},
        {lat: 46.677773, lon: 7.858336},
        {lat: 46.677878, lon: 7.858471},
        {lat: 46.677903, lon: 7.8586},
        {lat: 46.67794, lon: 7.8585},
        {lat: 46.677966, lon: 7.85838},
        {lat: 46.678003, lon: 7.8583},
        {lat: 46.678071, lon: 7.858387},
        {lat: 46.678088, lon: 7.85854},
        {lat: 46.678138, lon: 7.85867},
        {lat: 46.678171, lon: 7.858808},
        {lat: 46.678228, lon: 7.858727},
        {lat: 46.678301, lon: 7.858687}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 40869250,
      geometry: [
        {lat: 46.676983, lon: 7.861291},
        {lat: 46.676984, lon: 7.861408},
        {lat: 46.677039, lon: 7.86155},
        {lat: 46.677092, lon: 7.861575},
        {lat: 46.677071, lon: 7.861661},
        {lat: 46.67713, lon: 7.861635},
        {lat: 46.677123, lon: 7.861713},
        {lat: 46.677112, lon: 7.861816},
        {lat: 46.677013, lon: 7.861784},
        {lat: 46.676921, lon: 7.86177},
        {lat: 46.676951, lon: 7.861836},
        {lat: 46.676935, lon: 7.861918},
        {lat: 46.677089, lon: 7.862073},
        {lat: 46.677203, lon: 7.86208},
        {lat: 46.677295, lon: 7.862093},
        {lat: 46.677404, lon: 7.862023},
        {lat: 46.677502, lon: 7.861902},
        {lat: 46.67766, lon: 7.861798},
        {lat: 46.677623, lon: 7.861981},
        {lat: 46.677562, lon: 7.86221},
        {lat: 46.677517, lon: 7.862517},
        {lat: 46.67741, lon: 7.862647},
        {lat: 46.677464, lon: 7.862686},
        {lat: 46.677577, lon: 7.862657},
        {lat: 46.677557, lon: 7.862752},
        {lat: 46.677545, lon: 7.862846},
        {lat: 46.677569, lon: 7.862928},
        {lat: 46.677616, lon: 7.862988},
        {lat: 46.677664, lon: 7.863065},
        {lat: 46.677533, lon: 7.863159},
        {lat: 46.677464, lon: 7.863138},
        {lat: 46.67738, lon: 7.863151},
        {lat: 46.677438, lon: 7.863269},
        {lat: 46.677466, lon: 7.863382}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 40869692,
      geometry: [
        {lat: 46.675109, lon: 7.861268},
        {lat: 46.675007, lon: 7.861138},
        {lat: 46.674896, lon: 7.860986},
        {lat: 46.674849, lon: 7.860911},
        {lat: 46.674776, lon: 7.860836},
        {lat: 46.674625, lon: 7.860618},
        {lat: 46.674555, lon: 7.860482},
        {lat: 46.674527, lon: 7.860404},
        {lat: 46.674519, lon: 7.860176},
        {lat: 46.674497, lon: 7.859932},
        {lat: 46.674358, lon: 7.859659},
        {lat: 46.674314, lon: 7.859563},
        {lat: 46.674283, lon: 7.859439}
      ],
      tags: {highway: 'path', width: '1'}
    },
    {
      type: 'way',
      id: 40920595,
      geometry: [
        {lat: 46.675929, lon: 7.854437},
        {lat: 46.675938, lon: 7.854527},
        {lat: 46.676058, lon: 7.854629},
        {lat: 46.676144, lon: 7.85463},
        {lat: 46.676282, lon: 7.854584},
        {lat: 46.676402, lon: 7.854536},
        {lat: 46.676466, lon: 7.854532},
        {lat: 46.676577, lon: 7.854611},
        {lat: 46.676671, lon: 7.854732},
        {lat: 46.676753, lon: 7.854809},
        {lat: 46.67682, lon: 7.854862},
        {lat: 46.676896, lon: 7.85492},
        {lat: 46.676932, lon: 7.854994},
        {lat: 46.676909, lon: 7.855068},
        {lat: 46.676824, lon: 7.85515},
        {lat: 46.676712, lon: 7.855109},
        {lat: 46.676577, lon: 7.855049},
        {lat: 46.676483, lon: 7.855025},
        {lat: 46.676341, lon: 7.854998},
        {lat: 46.676218, lon: 7.855003},
        {lat: 46.676103, lon: 7.855059},
        {lat: 46.675941, lon: 7.855188},
        {lat: 46.675676, lon: 7.855375},
        {lat: 46.675512, lon: 7.855499},
        {lat: 46.675424, lon: 7.855536},
        {lat: 46.675321, lon: 7.855546},
        {lat: 46.675101, lon: 7.85546},
        {lat: 46.675043, lon: 7.855427},
        {lat: 46.674946, lon: 7.855385},
        {lat: 46.674843, lon: 7.855397},
        {lat: 46.67471, lon: 7.855495},
        {lat: 46.67458, lon: 7.855667},
        {lat: 46.674436, lon: 7.855777},
        {lat: 46.674306, lon: 7.855863},
        {lat: 46.674197, lon: 7.855883},
        {lat: 46.674121, lon: 7.855933},
        {lat: 46.674067, lon: 7.856128},
        {lat: 46.674087, lon: 7.856324},
        {lat: 46.674057, lon: 7.856402},
        {lat: 46.673978, lon: 7.856494},
        {lat: 46.67381, lon: 7.856596},
        {lat: 46.673731, lon: 7.856657},
        {lat: 46.673698, lon: 7.856757},
        {lat: 46.673678, lon: 7.856859},
        {lat: 46.673737, lon: 7.857006},
        {lat: 46.674016, lon: 7.857503},
        {lat: 46.674205, lon: 7.857915},
        {lat: 46.674523, lon: 7.858456},
        {lat: 46.674741, lon: 7.85892},
        {lat: 46.6749, lon: 7.85938}
      ],
      tags: {highway: 'track', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 40921357,
      geometry: [
        {lat: 46.675014, lon: 7.858962},
        {lat: 46.675016, lon: 7.858869},
        {lat: 46.675056, lon: 7.85872},
        {lat: 46.675117, lon: 7.858455},
        {lat: 46.675119, lon: 7.858286},
        {lat: 46.6751, lon: 7.857941},
        {lat: 46.675101, lon: 7.857786},
        {lat: 46.675123, lon: 7.857457},
        {lat: 46.675129, lon: 7.857184},
        {lat: 46.675112, lon: 7.856986},
        {lat: 46.675045, lon: 7.856832},
        {lat: 46.674993, lon: 7.856743},
        {lat: 46.674944, lon: 7.856705},
        {lat: 46.674886, lon: 7.856691},
        {lat: 46.674814, lon: 7.856709},
        {lat: 46.674694, lon: 7.856798},
        {lat: 46.674582, lon: 7.856884},
        {lat: 46.674482, lon: 7.856952},
        {lat: 46.674405, lon: 7.856952},
        {lat: 46.674334, lon: 7.856892},
        {lat: 46.674252, lon: 7.856763},
        {lat: 46.674169, lon: 7.856592},
        {lat: 46.674116, lon: 7.856454},
        {lat: 46.674087, lon: 7.856324}
      ],
      tags: {highway: 'track', surface: 'gravel'}
    },
    {
      type: 'way',
      id: 40922192,
      geometry: [
        {lat: 46.674067, lon: 7.856128},
        {lat: 46.674211, lon: 7.856039},
        {lat: 46.674359, lon: 7.85601},
        {lat: 46.67431, lon: 7.856245},
        {lat: 46.67432, lon: 7.856328},
        {lat: 46.674388, lon: 7.856346},
        {lat: 46.674407, lon: 7.856454},
        {lat: 46.674427, lon: 7.856529},
        {lat: 46.674507, lon: 7.856504},
        {lat: 46.674547, lon: 7.856423},
        {lat: 46.674606, lon: 7.856301},
        {lat: 46.674682, lon: 7.856196},
        {lat: 46.674777, lon: 7.856174},
        {lat: 46.674895, lon: 7.856165},
        {lat: 46.674963, lon: 7.856205},
        {lat: 46.675013, lon: 7.856277},
        {lat: 46.675086, lon: 7.856371},
        {lat: 46.675139, lon: 7.856475},
        {lat: 46.675248, lon: 7.856672},
        {lat: 46.675319, lon: 7.856947},
        {lat: 46.675393, lon: 7.857306}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 40922291,
      geometry: [
        {lat: 46.678886, lon: 7.85974},
        {lat: 46.678966, lon: 7.859732},
        {lat: 46.679226, lon: 7.859687},
        {lat: 46.679281, lon: 7.859625},
        {lat: 46.679322, lon: 7.859543},
        {lat: 46.679353, lon: 7.85942},
        {lat: 46.679324, lon: 7.859324},
        {lat: 46.679173, lon: 7.85928},
        {lat: 46.67909, lon: 7.859308},
        {lat: 46.678979, lon: 7.859321},
        {lat: 46.678916, lon: 7.859272},
        {lat: 46.678871, lon: 7.859202},
        {lat: 46.678794, lon: 7.859103},
        {lat: 46.678719, lon: 7.859072},
        {lat: 46.678609, lon: 7.859076},
        {lat: 46.678545, lon: 7.859064}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 40922754,
      geometry: [
        {lat: 46.675086, lon: 7.856371},
        {lat: 46.675125, lon: 7.856288},
        {lat: 46.675156, lon: 7.856195},
        {lat: 46.675287, lon: 7.856241},
        {lat: 46.675225, lon: 7.856158},
        {lat: 46.675347, lon: 7.856127},
        {lat: 46.675557, lon: 7.85586},
        {lat: 46.675764, lon: 7.855605},
        {lat: 46.675836, lon: 7.855524},
        {lat: 46.675949, lon: 7.855419},
        {lat: 46.676058, lon: 7.855279},
        {lat: 46.676136, lon: 7.855166},
        {lat: 46.676257, lon: 7.855075},
        {lat: 46.676431, lon: 7.855058}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 40923005,
      geometry: [
        {lat: 46.675287, lon: 7.856241},
        {lat: 46.675564, lon: 7.856104},
        {lat: 46.675664, lon: 7.856012},
        {lat: 46.675778, lon: 7.855965},
        {lat: 46.675896, lon: 7.85587},
        {lat: 46.676025, lon: 7.85588},
        {lat: 46.676128, lon: 7.855821},
        {lat: 46.676215, lon: 7.855776},
        {lat: 46.676325, lon: 7.855759},
        {lat: 46.676526, lon: 7.855753},
        {lat: 46.676727, lon: 7.855731},
        {lat: 46.676834, lon: 7.855722},
        {lat: 46.676909, lon: 7.855839},
        {lat: 46.676985, lon: 7.855961},
        {lat: 46.677042, lon: 7.856008},
        {lat: 46.677289, lon: 7.855987},
        {lat: 46.677371, lon: 7.856098},
        {lat: 46.677459, lon: 7.856194},
        {lat: 46.677612, lon: 7.856132},
        {lat: 46.677711, lon: 7.856151},
        {lat: 46.677766, lon: 7.856221},
        {lat: 46.677839, lon: 7.85636},
        {lat: 46.677931, lon: 7.856646},
        {lat: 46.677983, lon: 7.856614},
        {lat: 46.67805, lon: 7.856498}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 40923235,
      geometry: [
        {lat: 46.675125, lon: 7.856288},
        {lat: 46.675222, lon: 7.856314},
        {lat: 46.675305, lon: 7.856383},
        {lat: 46.675405, lon: 7.856443},
        {lat: 46.675492, lon: 7.856494},
        {lat: 46.675576, lon: 7.856475}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 40923976,
      geometry: [
        {lat: 46.681354, lon: 7.860794},
        {lat: 46.681276, lon: 7.860832},
        {lat: 46.681145, lon: 7.860942},
        {lat: 46.681053, lon: 7.860961},
        {lat: 46.680976, lon: 7.860916},
        {lat: 46.680741, lon: 7.860655},
        {lat: 46.680423, lon: 7.860439},
        {lat: 46.680297, lon: 7.860305},
        {lat: 46.6802, lon: 7.860155},
        {lat: 46.680147, lon: 7.860086},
        {lat: 46.680086, lon: 7.860035},
        {lat: 46.680022, lon: 7.859998},
        {lat: 46.679893, lon: 7.859959},
        {lat: 46.679847, lon: 7.859915},
        {lat: 46.679835, lon: 7.859838},
        {lat: 46.679889, lon: 7.85979},
        {lat: 46.680038, lon: 7.859775},
        {lat: 46.680234, lon: 7.859735},
        {lat: 46.680341, lon: 7.859744},
        {lat: 46.680501, lon: 7.859839},
        {lat: 46.680525, lon: 7.859935},
        {lat: 46.680482, lon: 7.860114},
        {lat: 46.680181, lon: 7.859951},
        {lat: 46.680038, lon: 7.859775}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Hubelweg'}
    },
    {
      type: 'way',
      id: 40924157,
      geometry: [
        {lat: 46.680234, lon: 7.859735},
        {lat: 46.680252, lon: 7.859568},
        {lat: 46.68039, lon: 7.859577},
        {lat: 46.680476, lon: 7.859662},
        {lat: 46.680503, lon: 7.859732},
        {lat: 46.68056, lon: 7.859802},
        {lat: 46.680714, lon: 7.859842},
        {lat: 46.680653, lon: 7.85978},
        {lat: 46.680596, lon: 7.85974},
        {lat: 46.680938, lon: 7.859777},
        {lat: 46.681041, lon: 7.859827},
        {lat: 46.681186, lon: 7.859998},
        {lat: 46.681284, lon: 7.859972}
      ],
      tags: {highway: 'path', surface: 'fine_gravel'}
    },
    {
      type: 'way',
      id: 40980346,
      geometry: [
        {lat: 46.678407, lon: 7.858809},
        {lat: 46.678413, lon: 7.85864},
        {lat: 46.678386, lon: 7.858493},
        {lat: 46.678288, lon: 7.858335},
        {lat: 46.678171, lon: 7.858152},
        {lat: 46.678082, lon: 7.857804},
        {lat: 46.678039, lon: 7.857547},
        {lat: 46.67804, lon: 7.857338},
        {lat: 46.678026, lon: 7.857239},
        {lat: 46.678008, lon: 7.857124},
        {lat: 46.678072, lon: 7.856638},
        {lat: 46.67805, lon: 7.856498},
        {lat: 46.678038, lon: 7.856369},
        {lat: 46.677998, lon: 7.856174},
        {lat: 46.678073, lon: 7.856179},
        {lat: 46.678136, lon: 7.8562},
        {lat: 46.678068, lon: 7.856071},
        {lat: 46.678139, lon: 7.856023},
        {lat: 46.678227, lon: 7.856028},
        {lat: 46.678321, lon: 7.855997},
        {lat: 46.678353, lon: 7.855887},
        {lat: 46.678401, lon: 7.855543},
        {lat: 46.678282, lon: 7.855191},
        {lat: 46.678272, lon: 7.855111},
        {lat: 46.678293, lon: 7.854995},
        {lat: 46.67836, lon: 7.854959},
        {lat: 46.678643, lon: 7.855197},
        {lat: 46.678774, lon: 7.855333},
        {lat: 46.678893, lon: 7.855397}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 40980459,
      geometry: [
        {lat: 46.676163, lon: 7.853758},
        {lat: 46.676211, lon: 7.853695},
        {lat: 46.676282, lon: 7.853524},
        {lat: 46.676329, lon: 7.853429},
        {lat: 46.676411, lon: 7.85336},
        {lat: 46.676535, lon: 7.853275},
        {lat: 46.676663, lon: 7.853194},
        {lat: 46.676809, lon: 7.853143},
        {lat: 46.676894, lon: 7.853077},
        {lat: 46.676963, lon: 7.85302},
        {lat: 46.677042, lon: 7.85297},
        {lat: 46.677123, lon: 7.852974},
        {lat: 46.67721, lon: 7.852936},
        {lat: 46.677289, lon: 7.852906},
        {lat: 46.677377, lon: 7.852906},
        {lat: 46.677416, lon: 7.852937}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 40980534,
      geometry: [
        {lat: 46.678893, lon: 7.855397},
        {lat: 46.678956, lon: 7.855515},
        {lat: 46.679065, lon: 7.855617},
        {lat: 46.679141, lon: 7.85576},
        {lat: 46.679245, lon: 7.855855},
        {lat: 46.679324, lon: 7.856155},
        {lat: 46.679359, lon: 7.856262},
        {lat: 46.679424, lon: 7.856333},
        {lat: 46.679496, lon: 7.856382},
        {lat: 46.679529, lon: 7.856485},
        {lat: 46.67954, lon: 7.856575},
        {lat: 46.679607, lon: 7.856391},
        {lat: 46.679653, lon: 7.85623}
      ],
      tags: {highway: 'footway', surface: 'asphalt', name: 'Felsenegg'}
    },
    {
      type: 'way',
      id: 40981356,
      geometry: [
        {lat: 46.678008, lon: 7.857124},
        {lat: 46.677939, lon: 7.857162},
        {lat: 46.677818, lon: 7.85725},
        {lat: 46.677684, lon: 7.857285},
        {lat: 46.677509, lon: 7.857373},
        {lat: 46.677376, lon: 7.857438},
        {lat: 46.677375, lon: 7.857534},
        {lat: 46.677466, lon: 7.857817},
        {lat: 46.677525, lon: 7.857873},
        {lat: 46.677596, lon: 7.857881},
        {lat: 46.67767, lon: 7.85786},
        {lat: 46.677774, lon: 7.857838},
        {lat: 46.677867, lon: 7.857958},
        {lat: 46.677918, lon: 7.858063},
        {lat: 46.677957, lon: 7.858113}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 40981507,
      geometry: [
        {lat: 46.676932, lon: 7.854994},
        {lat: 46.677029, lon: 7.855015},
        {lat: 46.677122, lon: 7.855082},
        {lat: 46.677206, lon: 7.855084},
        {lat: 46.677575, lon: 7.855345},
        {lat: 46.677898, lon: 7.855511},
        {lat: 46.67813, lon: 7.855569},
        {lat: 46.678235, lon: 7.855571},
        {lat: 46.678401, lon: 7.855543},
        {lat: 46.678506, lon: 7.85554},
        {lat: 46.678573, lon: 7.855589},
        {lat: 46.678618, lon: 7.855697},
        {lat: 46.678644, lon: 7.855797},
        {lat: 46.67865, lon: 7.855868}
      ],
      tags: {highway: 'track'}
    },
    {
      type: 'way',
      id: 40981531,
      geometry: [
        {lat: 46.677122, lon: 7.855082},
        {lat: 46.677236, lon: 7.855003},
        {lat: 46.677383, lon: 7.854895},
        {lat: 46.677442, lon: 7.854706},
        {lat: 46.677506, lon: 7.8545},
        {lat: 46.677506, lon: 7.854182},
        {lat: 46.677506, lon: 7.853993},
        {lat: 46.677521, lon: 7.853883},
        {lat: 46.677561, lon: 7.853818},
        {lat: 46.67768, lon: 7.853724},
        {lat: 46.677761, lon: 7.853737},
        {lat: 46.6779, lon: 7.853804},
        {lat: 46.677989, lon: 7.853827},
        {lat: 46.678095, lon: 7.854113},
        {lat: 46.678144, lon: 7.854414},
        {lat: 46.678178, lon: 7.854603},
        {lat: 46.67824, lon: 7.854793},
        {lat: 46.678252, lon: 7.854949},
        {lat: 46.678272, lon: 7.855111}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 40981807,
      geometry: [
        {lat: 46.676466, lon: 7.854532},
        {lat: 46.67653, lon: 7.85449},
        {lat: 46.676659, lon: 7.854219},
        {lat: 46.676721, lon: 7.85413},
        {lat: 46.676793, lon: 7.854059},
        {lat: 46.676872, lon: 7.854043},
        {lat: 46.676889, lon: 7.853964},
        {lat: 46.676795, lon: 7.853808},
        {lat: 46.676729, lon: 7.853635},
        {lat: 46.676767, lon: 7.853501},
        {lat: 46.676864, lon: 7.853466},
        {lat: 46.677047, lon: 7.85343},
        {lat: 46.677167, lon: 7.853466},
        {lat: 46.677218, lon: 7.853506},
        {lat: 46.677336, lon: 7.853531},
        {lat: 46.677404, lon: 7.853552},
        {lat: 46.677434, lon: 7.853678},
        {lat: 46.677488, lon: 7.853844},
        {lat: 46.677521, lon: 7.853883}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 40981849,
      geometry: [
        {lat: 46.678343, lon: 7.85348},
        {lat: 46.678235, lon: 7.853432},
        {lat: 46.678161, lon: 7.853377},
        {lat: 46.678089, lon: 7.853367},
        {lat: 46.678031, lon: 7.853371},
        {lat: 46.677951, lon: 7.85336},
        {lat: 46.677821, lon: 7.853289},
        {lat: 46.677693, lon: 7.853212},
        {lat: 46.677657, lon: 7.853151},
        {lat: 46.677622, lon: 7.85307},
        {lat: 46.677534, lon: 7.852931},
        {lat: 46.677471, lon: 7.8529},
        {lat: 46.677416, lon: 7.852937}
      ],
      tags: {highway: 'path', surface: 'dirt'}
    },
    {
      type: 'way',
      id: 40981985,
      geometry: [
        {lat: 46.679835, lon: 7.859838},
        {lat: 46.679765, lon: 7.859779},
        {lat: 46.679682, lon: 7.859773},
        {lat: 46.679574, lon: 7.859847},
        {lat: 46.679469, lon: 7.859958},
        {lat: 46.679364, lon: 7.860099},
        {lat: 46.679272, lon: 7.860276},
        {lat: 46.679225, lon: 7.86035},
        {lat: 46.679161, lon: 7.860396},
        {lat: 46.67906, lon: 7.860465},
        {lat: 46.678966, lon: 7.860568},
        {lat: 46.678919, lon: 7.860636},
        {lat: 46.678896, lon: 7.860722},
        {lat: 46.678886, lon: 7.860881},
        {lat: 46.678855, lon: 7.860983},
        {lat: 46.67883, lon: 7.861072},
        {lat: 46.678778, lon: 7.861151},
        {lat: 46.678666, lon: 7.86122},
        {lat: 46.678578, lon: 7.861297},
        {lat: 46.678463, lon: 7.861305},
        {lat: 46.67843, lon: 7.861288}
      ],
      tags: {highway: 'track'}
    },
    {
      type: 'way',
      id: 40982109,
      geometry: [
        {lat: 46.67789, lon: 7.863896},
        {lat: 46.677935, lon: 7.863809},
        {lat: 46.677966, lon: 7.86372},
        {lat: 46.678049, lon: 7.863534},
        {lat: 46.67806, lon: 7.863341},
        {lat: 46.678158, lon: 7.863201},
        {lat: 46.678214, lon: 7.86309},
        {lat: 46.678337, lon: 7.862633},
        {lat: 46.678516, lon: 7.862342},
        {lat: 46.678604, lon: 7.862206},
        {lat: 46.678642, lon: 7.862138},
        {lat: 46.678711, lon: 7.861942},
        {lat: 46.678902, lon: 7.86164},
        {lat: 46.678996, lon: 7.861608},
        {lat: 46.678942, lon: 7.861739},
        {lat: 46.679001, lon: 7.861709},
        {lat: 46.678952, lon: 7.861843},
        {lat: 46.678961, lon: 7.861924},
        {lat: 46.679017, lon: 7.861937},
        {lat: 46.679481, lon: 7.86164},
        {lat: 46.679542, lon: 7.861626}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 40982241,
      geometry: [
        {lat: 46.67843, lon: 7.861288},
        {lat: 46.678427, lon: 7.861458},
        {lat: 46.678433, lon: 7.861574},
        {lat: 46.678504, lon: 7.861466},
        {lat: 46.678592, lon: 7.861419},
        {lat: 46.678675, lon: 7.861369},
        {lat: 46.678647, lon: 7.861479},
        {lat: 46.67857, lon: 7.86169},
        {lat: 46.678547, lon: 7.861766},
        {lat: 46.678578, lon: 7.861962},
        {lat: 46.678568, lon: 7.862074},
        {lat: 46.678511, lon: 7.862151},
        {lat: 46.678351, lon: 7.862535},
        {lat: 46.678337, lon: 7.862633}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 40982805,
      geometry: [
        {lat: 46.677815, lon: 7.863287},
        {lat: 46.677721, lon: 7.863573},
        {lat: 46.677733, lon: 7.863668},
        {lat: 46.677798, lon: 7.863823},
        {lat: 46.67789, lon: 7.863896},
        {lat: 46.677797, lon: 7.863948},
        {lat: 46.677722, lon: 7.863959},
        {lat: 46.677616, lon: 7.86394},
        {lat: 46.677506, lon: 7.863872},
        {lat: 46.677385, lon: 7.86383},
        {lat: 46.677268, lon: 7.863777},
        {lat: 46.677334, lon: 7.863908},
        {lat: 46.677325, lon: 7.863943}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 40983494,
      geometry: [
        {lat: 46.67682, lon: 7.854862},
        {lat: 46.676727, lon: 7.854897},
        {lat: 46.676631, lon: 7.854833},
        {lat: 46.676551, lon: 7.854777},
        {lat: 46.676389, lon: 7.854766},
        {lat: 46.676185, lon: 7.854848},
        {lat: 46.675879, lon: 7.85498},
        {lat: 46.675724, lon: 7.855072},
        {lat: 46.67563, lon: 7.855147},
        {lat: 46.675492, lon: 7.855115},
        {lat: 46.675282, lon: 7.855024},
        {lat: 46.675079, lon: 7.855028},
        {lat: 46.674964, lon: 7.855027},
        {lat: 46.674785, lon: 7.855045},
        {lat: 46.674626, lon: 7.855119},
        {lat: 46.674432, lon: 7.855145},
        {lat: 46.674281, lon: 7.855158}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 41053851,
      geometry: [
        {lat: 46.687977, lon: 7.858717},
        {lat: 46.687947, lon: 7.858896}
      ],
      tags: {highway: 'footway', surface: 'paving_stones'}
    },
    {
      type: 'way',
      id: 41054002,
      geometry: [
        {lat: 46.687933, lon: 7.858607},
        {lat: 46.687789, lon: 7.858551}
      ],
      tags: {highway: 'footway', surface: 'paving_stones'}
    },
    {
      type: 'way',
      id: 43242624,
      geometry: [
        {lat: 46.682789, lon: 7.875966},
        {lat: 46.682964, lon: 7.876068},
        {lat: 46.683072, lon: 7.876142},
        {lat: 46.683218, lon: 7.876246}
      ],
      tags: {highway: 'trunk', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 43450653,
      geometry: [
        {lat: 46.682516, lon: 7.846652},
        {lat: 46.682573, lon: 7.846739},
        {lat: 46.682728, lon: 7.846968},
        {lat: 46.68307, lon: 7.847476},
        {lat: 46.683388, lon: 7.847931},
        {lat: 46.683447, lon: 7.848001},
        {lat: 46.683507, lon: 7.848069},
        {lat: 46.683656, lon: 7.848223}
      ],
      tags: {
        highway: 'residential',
        width: '4.4',
        surface: 'asphalt',
        name: 'Baumgarten'
      }
    },
    {
      type: 'way',
      id: 43450654,
      geometry: [
        {lat: 46.684342, lon: 7.848542},
        {lat: 46.68447, lon: 7.848381}
      ],
      tags: {
        highway: 'residential',
        surface: 'asphalt',
        name: 'Helvetiastrasse'
      }
    },
    {
      type: 'way',
      id: 43450659,
      geometry: [
        {lat: 46.684305, lon: 7.850457},
        {lat: 46.684251, lon: 7.850357},
        {lat: 46.684038, lon: 7.850116},
        {lat: 46.683492, lon: 7.84945},
        {lat: 46.683209, lon: 7.849143},
        {lat: 46.683012, lon: 7.84898},
        {lat: 46.682766, lon: 7.848798},
        {lat: 46.682718, lon: 7.848757},
        {lat: 46.682614, lon: 7.84864},
        {lat: 46.68256, lon: 7.848568},
        {lat: 46.68251, lon: 7.848495},
        {lat: 46.682454, lon: 7.848387}
      ],
      tags: {
        highway: 'residential',
        width: '3.8',
        surface: 'asphalt',
        name: 'Spielhölzli'
      }
    },
    {
      type: 'way',
      id: 43450660,
      geometry: [
        {lat: 46.685503, lon: 7.847333},
        {lat: 46.685437, lon: 7.847264},
        {lat: 46.685356, lon: 7.84716},
        {lat: 46.685219, lon: 7.84692},
        {lat: 46.685166, lon: 7.846813},
        {lat: 46.685125, lon: 7.84676},
        {lat: 46.68501, lon: 7.846647},
        {lat: 46.684921, lon: 7.846679},
        {lat: 46.684787, lon: 7.846833},
        {lat: 46.684657, lon: 7.846984},
        {lat: 46.684593, lon: 7.847061}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Oberdorf'}
    },
    {
      type: 'way',
      id: 44332661,
      geometry: [
        {lat: 46.687085, lon: 7.877772},
        {lat: 46.686512, lon: 7.878208},
        {lat: 46.686426, lon: 7.878265},
        {lat: 46.6863, lon: 7.878329},
        {lat: 46.686224, lon: 7.87836},
        {lat: 46.686153, lon: 7.878386},
        {lat: 46.685973, lon: 7.878429},
        {lat: 46.685902, lon: 7.878438},
        {lat: 46.685748, lon: 7.878439},
        {lat: 46.685622, lon: 7.878424}
      ],
      tags: {highway: 'trunk_link', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 44332662,
      geometry: [
        {lat: 46.687085, lon: 7.877772},
        {lat: 46.687163, lon: 7.877681},
        {lat: 46.687358, lon: 7.877443},
        {lat: 46.687484, lon: 7.877279},
        {lat: 46.687637, lon: 7.877061},
        {lat: 46.687807, lon: 7.876806},
        {lat: 46.688148, lon: 7.876248}
      ],
      tags: {highway: 'trunk', lanes: '4', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 60697378,
      geometry: [
        {lat: 46.689902, lon: 7.866448},
        {lat: 46.689965, lon: 7.866438},
        {lat: 46.690111, lon: 7.866665},
        {lat: 46.690146, lon: 7.866738},
        {lat: 46.690217, lon: 7.866885},
        {lat: 46.690418, lon: 7.867336},
        {lat: 46.690463, lon: 7.867427},
        {lat: 46.690692, lon: 7.867939}
      ],
      tags: {
        highway: 'residential',
        width: '7',
        lanes: '1',
        surface: 'asphalt',
        name: 'Höheweg'
      }
    },
    {
      type: 'way',
      id: 71019186,
      geometry: [
        {lat: 46.69589, lon: 7.863455},
        {lat: 46.695948, lon: 7.863529},
        {lat: 46.695971, lon: 7.863721},
        {lat: 46.695985, lon: 7.863824},
        {lat: 46.696008, lon: 7.863942},
        {lat: 46.696038, lon: 7.864063},
        {lat: 46.696077, lon: 7.864171},
        {lat: 46.696121, lon: 7.864257},
        {lat: 46.696188, lon: 7.864355},
        {lat: 46.69625, lon: 7.864441},
        {lat: 46.696329, lon: 7.864579},
        {lat: 46.696412, lon: 7.864682},
        {lat: 46.696498, lon: 7.864774},
        {lat: 46.696581, lon: 7.864854},
        {lat: 46.696671, lon: 7.86494},
        {lat: 46.69675, lon: 7.865009},
        {lat: 46.696817, lon: 7.865054},
        {lat: 46.696888, lon: 7.8651}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 71019189,
      geometry: [
        {lat: 46.696187, lon: 7.857007},
        {lat: 46.696242, lon: 7.85709},
        {lat: 46.696278, lon: 7.857205},
        {lat: 46.69628, lon: 7.857331},
        {lat: 46.69627, lon: 7.857466},
        {lat: 46.696286, lon: 7.857575},
        {lat: 46.696339, lon: 7.857718},
        {lat: 46.69637, lon: 7.85783},
        {lat: 46.696392, lon: 7.857907},
        {lat: 46.696423, lon: 7.857982},
        {lat: 46.696475, lon: 7.858062},
        {lat: 46.696518, lon: 7.858131},
        {lat: 46.6966, lon: 7.858277},
        {lat: 46.696644, lon: 7.858383},
        {lat: 46.696675, lon: 7.85846},
        {lat: 46.696712, lon: 7.858567},
        {lat: 46.696744, lon: 7.85865},
        {lat: 46.696799, lon: 7.858767},
        {lat: 46.696876, lon: 7.858876},
        {lat: 46.696921, lon: 7.858931},
        {lat: 46.69696, lon: 7.858994},
        {lat: 46.696978, lon: 7.859083},
        {lat: 46.696982, lon: 7.859223},
        {lat: 46.696978, lon: 7.859309},
        {lat: 46.696984, lon: 7.859392},
        {lat: 46.697001, lon: 7.859498},
        {lat: 46.697019, lon: 7.859604},
        {lat: 46.697045, lon: 7.859731},
        {lat: 46.697074, lon: 7.85986},
        {lat: 46.69708, lon: 7.860003},
        {lat: 46.697072, lon: 7.860098},
        {lat: 46.697082, lon: 7.860192},
        {lat: 46.697088, lon: 7.86029},
        {lat: 46.697094, lon: 7.86039},
        {lat: 46.697098, lon: 7.860482},
        {lat: 46.69711, lon: 7.860576},
        {lat: 46.697149, lon: 7.8607},
        {lat: 46.697182, lon: 7.860766},
        {lat: 46.697228, lon: 7.860846},
        {lat: 46.697261, lon: 7.860929},
        {lat: 46.697254, lon: 7.861019},
        {lat: 46.697214, lon: 7.861201},
        {lat: 46.697192, lon: 7.861322},
        {lat: 46.697173, lon: 7.861434},
        {lat: 46.697143, lon: 7.861568},
        {lat: 46.697117, lon: 7.8617},
        {lat: 46.697094, lon: 7.861806},
        {lat: 46.697074, lon: 7.861889},
        {lat: 46.697068, lon: 7.861973},
        {lat: 46.697068, lon: 7.862053},
        {lat: 46.697106, lon: 7.86223},
        {lat: 46.697121, lon: 7.862314},
        {lat: 46.697129, lon: 7.862397},
        {lat: 46.697131, lon: 7.862489},
        {lat: 46.697137, lon: 7.862586},
        {lat: 46.697139, lon: 7.862695},
        {lat: 46.697133, lon: 7.862801},
        {lat: 46.697123, lon: 7.862913},
        {lat: 46.697112, lon: 7.863025},
        {lat: 46.697097, lon: 7.863109},
        {lat: 46.697078, lon: 7.863234},
        {lat: 46.697053, lon: 7.863406},
        {lat: 46.697027, lon: 7.863506},
        {lat: 46.697005, lon: 7.863589},
        {lat: 46.696982, lon: 7.863693},
        {lat: 46.696956, lon: 7.863787},
        {lat: 46.696939, lon: 7.863876},
        {lat: 46.696911, lon: 7.863997},
        {lat: 46.696891, lon: 7.864108},
        {lat: 46.696878, lon: 7.864212},
        {lat: 46.696862, lon: 7.864329},
        {lat: 46.696862, lon: 7.864412},
        {lat: 46.696862, lon: 7.86451},
        {lat: 46.696858, lon: 7.864602},
        {lat: 46.696864, lon: 7.864768},
        {lat: 46.696869, lon: 7.864884},
        {lat: 46.696868, lon: 7.864897}
      ],
      tags: {highway: 'path', surface: 'ground'}
    },
    {
      type: 'way',
      id: 71019192,
      geometry: [
        {lat: 46.69408, lon: 7.863113},
        {lat: 46.694119, lon: 7.86297},
        {lat: 46.694119, lon: 7.862833},
        {lat: 46.694164, lon: 7.862724},
        {lat: 46.69419, lon: 7.862643},
        {lat: 46.694254, lon: 7.86254}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 71019193,
      geometry: [
        {lat: 46.694272, lon: 7.862618},
        {lat: 46.694321, lon: 7.862491},
        {lat: 46.69437, lon: 7.862414},
        {lat: 46.694432, lon: 7.862417},
        {lat: 46.694486, lon: 7.862526},
        {lat: 46.694559, lon: 7.862635},
        {lat: 46.694644, lon: 7.862726},
        {lat: 46.694687, lon: 7.862775}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 71019225,
      geometry: [
        {lat: 46.695527, lon: 7.863},
        {lat: 46.695605, lon: 7.863071},
        {lat: 46.695656, lon: 7.863134},
        {lat: 46.695688, lon: 7.863265},
        {lat: 46.695704, lon: 7.863363},
        {lat: 46.695727, lon: 7.863478},
        {lat: 46.695723, lon: 7.863575},
        {lat: 46.695701, lon: 7.863686}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 71019286,
      geometry: [
        {lat: 46.696187, lon: 7.857007},
        {lat: 46.696256, lon: 7.857027},
        {lat: 46.696339, lon: 7.857096},
        {lat: 46.696386, lon: 7.857145},
        {lat: 46.696423, lon: 7.857239},
        {lat: 46.696473, lon: 7.857299},
        {lat: 46.696539, lon: 7.85738},
        {lat: 46.696602, lon: 7.857451},
        {lat: 46.696671, lon: 7.857514},
        {lat: 46.696748, lon: 7.857569},
        {lat: 46.696799, lon: 7.857618},
        {lat: 46.696864, lon: 7.857672},
        {lat: 46.69694, lon: 7.857721},
        {lat: 46.697013, lon: 7.857764},
        {lat: 46.697078, lon: 7.857798},
        {lat: 46.697145, lon: 7.85783},
        {lat: 46.697232, lon: 7.857838},
        {lat: 46.697316, lon: 7.857841},
        {lat: 46.697403, lon: 7.857841},
        {lat: 46.697479, lon: 7.857847},
        {lat: 46.697578, lon: 7.857861},
        {lat: 46.697507, lon: 7.857764},
        {lat: 46.697456, lon: 7.857732},
        {lat: 46.697369, lon: 7.857655},
        {lat: 46.697283, lon: 7.857572},
        {lat: 46.697212, lon: 7.85748},
        {lat: 46.697178, lon: 7.857414},
        {lat: 46.697133, lon: 7.857277},
        {lat: 46.697098, lon: 7.857165},
        {lat: 46.697055, lon: 7.857007},
        {lat: 46.697021, lon: 7.856892},
        {lat: 46.696992, lon: 7.856775},
        {lat: 46.696958, lon: 7.856657},
        {lat: 46.696925, lon: 7.856543},
        {lat: 46.696903, lon: 7.856471},
        {lat: 46.696883, lon: 7.856394},
        {lat: 46.696874, lon: 7.856302},
        {lat: 46.696866, lon: 7.856219},
        {lat: 46.696882, lon: 7.856081},
        {lat: 46.696903, lon: 7.855995},
        {lat: 46.696925, lon: 7.855923},
        {lat: 46.696939, lon: 7.855843},
        {lat: 46.696945, lon: 7.85576},
        {lat: 46.69694, lon: 7.855602},
        {lat: 46.696931, lon: 7.855479},
        {lat: 46.696917, lon: 7.855338},
        {lat: 46.696901, lon: 7.855195},
        {lat: 46.696886, lon: 7.855112},
        {lat: 46.696862, lon: 7.855},
        {lat: 46.69683, lon: 7.85488},
        {lat: 46.696793, lon: 7.854756},
        {lat: 46.696767, lon: 7.854668},
        {lat: 46.696748, lon: 7.85457},
        {lat: 46.69673, lon: 7.854395},
        {lat: 46.696734, lon: 7.854272},
        {lat: 46.696736, lon: 7.854114},
        {lat: 46.696738, lon: 7.853948},
        {lat: 46.696746, lon: 7.853836},
        {lat: 46.696752, lon: 7.853739},
        {lat: 46.69675, lon: 7.853638},
        {lat: 46.69674, lon: 7.853538},
        {lat: 46.696714, lon: 7.853446},
        {lat: 46.696677, lon: 7.853349},
        {lat: 46.696646, lon: 7.853269},
        {lat: 46.696616, lon: 7.853194},
        {lat: 46.696585, lon: 7.853108},
        {lat: 46.696561, lon: 7.853005},
        {lat: 46.696541, lon: 7.852884},
        {lat: 46.69653, lon: 7.852798},
        {lat: 46.696534, lon: 7.852644},
        {lat: 46.696506, lon: 7.852472},
        {lat: 46.696477, lon: 7.852317},
        {lat: 46.696455, lon: 7.852214},
        {lat: 46.696441, lon: 7.852119},
        {lat: 46.696406, lon: 7.851996},
        {lat: 46.696392, lon: 7.85191},
        {lat: 46.696378, lon: 7.851792},
        {lat: 46.696362, lon: 7.851614},
        {lat: 46.696349, lon: 7.851445},
        {lat: 46.696337, lon: 7.851316},
        {lat: 46.696325, lon: 7.851176},
        {lat: 46.696313, lon: 7.851058},
        {lat: 46.696296, lon: 7.850972},
        {lat: 46.696288, lon: 7.85088},
        {lat: 46.696288, lon: 7.850771},
        {lat: 46.696278, lon: 7.850674},
        {lat: 46.696244, lon: 7.850571},
        {lat: 46.696242, lon: 7.850422},
        {lat: 46.696244, lon: 7.85031},
        {lat: 46.696239, lon: 7.850218},
        {lat: 46.696229, lon: 7.850118},
        {lat: 46.696211, lon: 7.850017},
        {lat: 46.696173, lon: 7.849897},
        {lat: 46.696154, lon: 7.849863}
      ],
      tags: {highway: 'path', surface: 'ground'}
    },
    {
      type: 'way',
      id: 71019373,
      geometry: [
        {lat: 46.697356, lon: 7.851582},
        {lat: 46.697313, lon: 7.851511},
        {lat: 46.697258, lon: 7.851564},
        {lat: 46.697253, lon: 7.851482},
        {lat: 46.697218, lon: 7.851407},
        {lat: 46.697157, lon: 7.851475},
        {lat: 46.69714, lon: 7.851397},
        {lat: 46.697161, lon: 7.85129},
        {lat: 46.697093, lon: 7.851293},
        {lat: 46.697112, lon: 7.851136},
        {lat: 46.697049, lon: 7.851197},
        {lat: 46.696997, lon: 7.851257},
        {lat: 46.697006, lon: 7.851075},
        {lat: 46.696971, lon: 7.850869},
        {lat: 46.696915, lon: 7.850805},
        {lat: 46.696883, lon: 7.850914},
        {lat: 46.696838, lon: 7.850786},
        {lat: 46.696763, lon: 7.850651},
        {lat: 46.696679, lon: 7.850619},
        {lat: 46.696626, lon: 7.850469},
        {lat: 46.696751, lon: 7.850274},
        {lat: 46.696692, lon: 7.850187},
        {lat: 46.696586, lon: 7.85015},
        {lat: 46.696403, lon: 7.85009},
        {lat: 46.696347, lon: 7.850043},
        {lat: 46.696244, lon: 7.850027},
        {lat: 46.696205, lon: 7.849999}
      ],
      tags: {highway: 'path', surface: 'ground'}
    },
    {
      type: 'way',
      id: 72077966,
      geometry: [
        {lat: 46.689323, lon: 7.858519},
        {lat: 46.689329, lon: 7.858407},
        {lat: 46.689305, lon: 7.858146},
        {lat: 46.6893, lon: 7.85792},
        {lat: 46.689296, lon: 7.857685}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Strandbadstrasse'
      }
    },
    {
      type: 'way',
      id: 75126597,
      geometry: [
        {lat: 46.683806, lon: 7.851092},
        {lat: 46.683762, lon: 7.851181},
        {lat: 46.683714, lon: 7.85128},
        {lat: 46.683646, lon: 7.851322},
        {lat: 46.683585, lon: 7.85131},
        {lat: 46.683286, lon: 7.851237},
        {lat: 46.683092, lon: 7.851195},
        {lat: 46.682978, lon: 7.851171},
        {lat: 46.682895, lon: 7.851153},
        {lat: 46.682545, lon: 7.851079},
        {lat: 46.682117, lon: 7.850988},
        {lat: 46.681873, lon: 7.85093},
        {lat: 46.681702, lon: 7.850879},
        {lat: 46.681649, lon: 7.850857},
        {lat: 46.681548, lon: 7.850805},
        {lat: 46.681418, lon: 7.850737},
        {lat: 46.681314, lon: 7.850682},
        {lat: 46.681229, lon: 7.850651},
        {lat: 46.681157, lon: 7.850652},
        {lat: 46.681088, lon: 7.850683},
        {lat: 46.681008, lon: 7.850733},
        {lat: 46.680942, lon: 7.850763},
        {lat: 46.680878, lon: 7.850769},
        {lat: 46.680473, lon: 7.850695}
      ],
      tags: {
        highway: 'residential',
        width: '5.6',
        lanes: '1',
        surface: 'asphalt',
        name: 'Fabrikstrasse'
      }
    },
    {
      type: 'way',
      id: 75126609,
      geometry: [
        {lat: 46.683257, lon: 7.851069},
        {lat: 46.683762, lon: 7.851181}
      ],
      tags: {highway: 'service', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 76127439,
      geometry: [
        {lat: 46.686533, lon: 7.855781},
        {lat: 46.686627, lon: 7.855977},
        {lat: 46.686631, lon: 7.856067},
        {lat: 46.686577, lon: 7.856128},
        {lat: 46.685961, lon: 7.856741},
        {lat: 46.685919, lon: 7.856788}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Höheweg'}
    },
    {
      type: 'way',
      id: 76227131,
      geometry: [
        {lat: 46.688496, lon: 7.877015},
        {lat: 46.688555, lon: 7.877152},
        {lat: 46.688604, lon: 7.877248}
      ],
      tags: {
        highway: 'tertiary',
        lanes: '1',
        surface: 'asphalt',
        name: 'Lindenallee'
      }
    },
    {
      type: 'way',
      id: 76227133,
      geometry: [
        {lat: 46.688604, lon: 7.877248},
        {lat: 46.688591, lon: 7.877134},
        {lat: 46.688583, lon: 7.877033},
        {lat: 46.688577, lon: 7.876992}
      ],
      tags: {
        highway: 'tertiary',
        lanes: '1',
        surface: 'asphalt',
        name: 'Lindenallee'
      }
    },
    {
      type: 'way',
      id: 77103870,
      geometry: [
        {lat: 46.685764, lon: 7.856816},
        {lat: 46.686467, lon: 7.858191},
        {lat: 46.686699, lon: 7.85867},
        {lat: 46.686897, lon: 7.859111},
        {lat: 46.686938, lon: 7.859209},
        {lat: 46.687105, lon: 7.859637},
        {lat: 46.68714, lon: 7.859726},
        {lat: 46.687962, lon: 7.861863},
        {lat: 46.687958, lon: 7.861957},
        {lat: 46.687928, lon: 7.862037},
        {lat: 46.687266, lon: 7.862538},
        {lat: 46.687083, lon: 7.862673},
        {lat: 46.686544, lon: 7.863052},
        {lat: 46.686477, lon: 7.863077},
        {lat: 46.686421, lon: 7.863073},
        {lat: 46.686237, lon: 7.862964},
        {lat: 46.686188, lon: 7.862919},
        {lat: 46.685303, lon: 7.8619},
        {lat: 46.685092, lon: 7.861678},
        {lat: 46.684994, lon: 7.861582},
        {lat: 46.684892, lon: 7.861477},
        {lat: 46.684837, lon: 7.8614},
        {lat: 46.684776, lon: 7.861281},
        {lat: 46.684746, lon: 7.861201},
        {lat: 46.684709, lon: 7.861055},
        {lat: 46.684692, lon: 7.860947},
        {lat: 46.68462, lon: 7.860444},
        {lat: 46.684232, lon: 7.857706}
      ],
      tags: {highway: 'footway', surface: 'fine_gravel'}
    },
    {
      type: 'way',
      id: 77103874,
      geometry: [
        {lat: 46.684232, lon: 7.857706},
        {lat: 46.684402, lon: 7.857603},
        {lat: 46.684809, lon: 7.857369},
        {lat: 46.685018, lon: 7.857248},
        {lat: 46.685282, lon: 7.857094},
        {lat: 46.685764, lon: 7.856816},
        {lat: 46.685824, lon: 7.856783},
        {lat: 46.685884, lon: 7.856717}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 77103879,
      geometry: [
        {lat: 46.687131, lon: 7.859704},
        {lat: 46.687068, lon: 7.85975},
        {lat: 46.687011, lon: 7.859752},
        {lat: 46.686954, lon: 7.859724},
        {lat: 46.686898, lon: 7.859683},
        {lat: 46.68685, lon: 7.859633},
        {lat: 46.686812, lon: 7.859563},
        {lat: 46.686799, lon: 7.859441},
        {lat: 46.686799, lon: 7.859359},
        {lat: 46.686809, lon: 7.859261},
        {lat: 46.686837, lon: 7.859175},
        {lat: 46.686897, lon: 7.859111}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 77103882,
      geometry: [
        {lat: 46.684904, lon: 7.861131},
        {lat: 46.685109, lon: 7.860964},
        {lat: 46.685245, lon: 7.860853},
        {lat: 46.686817, lon: 7.859578}
      ],
      tags: {highway: 'path', surface: 'asphalt', name: 'Peter-Ober-Allee'}
    },
    {
      type: 'way',
      id: 77103889,
      geometry: [
        {lat: 46.684703, lon: 7.861018},
        {lat: 46.684769, lon: 7.861009},
        {lat: 46.684829, lon: 7.861029},
        {lat: 46.684886, lon: 7.861095},
        {lat: 46.684923, lon: 7.861233},
        {lat: 46.684914, lon: 7.861323},
        {lat: 46.684865, lon: 7.861439},
        {lat: 46.684821, lon: 7.861529}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 77103908,
      geometry: [
        {lat: 46.682967, lon: 7.851559},
        {lat: 46.682961, lon: 7.851624}
      ],
      tags: {highway: 'steps', surface: 'concrete'}
    },
    {
      type: 'way',
      id: 77103923,
      geometry: [
        {lat: 46.681651, lon: 7.850683},
        {lat: 46.681632, lon: 7.850784}
      ],
      tags: {highway: 'steps'}
    },
    {
      type: 'way',
      id: 79429953,
      geometry: [
        {lat: 46.684821, lon: 7.861529},
        {lat: 46.684765, lon: 7.861488},
        {lat: 46.684745, lon: 7.861474}
      ],
      tags: {
        highway: 'primary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Klosterstrasse'
      }
    },
    {
      type: 'way',
      id: 79485970,
      geometry: [
        {lat: 46.689221, lon: 7.874543},
        {lat: 46.689455, lon: 7.874225}
      ],
      tags: {highway: 'trunk', lanes: '2', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 79498482,
      geometry: [
        {lat: 46.69614, lon: 7.87626},
        {lat: 46.696266, lon: 7.876378},
        {lat: 46.696585, lon: 7.876629},
        {lat: 46.6969, lon: 7.876895},
        {lat: 46.69703, lon: 7.877032},
        {lat: 46.697142, lon: 7.877203},
        {lat: 46.697198, lon: 7.877305},
        {lat: 46.697254, lon: 7.877415},
        {lat: 46.697326, lon: 7.877607},
        {lat: 46.697425, lon: 7.87797},
        {lat: 46.697536, lon: 7.878411},
        {lat: 46.697655, lon: 7.878894},
        {lat: 46.697814, lon: 7.879622}
      ],
      tags: {
        highway: 'primary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Hauptstrasse'
      }
    },
    {
      type: 'way',
      id: 79498485,
      geometry: [
        {lat: 46.694943, lon: 7.871757},
        {lat: 46.694878, lon: 7.871582},
        {lat: 46.69485, lon: 7.87149},
        {lat: 46.694783, lon: 7.871378},
        {lat: 46.694709, lon: 7.871281},
        {lat: 46.694654, lon: 7.871107},
        {lat: 46.694569, lon: 7.870983},
        {lat: 46.694542, lon: 7.870996}
      ],
      tags: {highway: 'cycleway', width: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 79498487,
      geometry: [
        {lat: 46.689531, lon: 7.873979},
        {lat: 46.689455, lon: 7.874029},
        {lat: 46.689352, lon: 7.874089},
        {lat: 46.689275, lon: 7.874128},
        {lat: 46.689194, lon: 7.874161},
        {lat: 46.689077, lon: 7.874206},
        {lat: 46.688605, lon: 7.87436},
        {lat: 46.688339, lon: 7.874442},
        {lat: 46.688281, lon: 7.874458},
        {lat: 46.688217, lon: 7.874456}
      ],
      tags: {highway: 'primary_link', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 79498491,
      geometry: [
        {lat: 46.689706, lon: 7.873913},
        {lat: 46.689531, lon: 7.873979}
      ],
      tags: {highway: 'primary_link', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 81292174,
      geometry: [
        {lat: 46.687708, lon: 7.853336},
        {lat: 46.687689, lon: 7.85361},
        {lat: 46.687655, lon: 7.854119}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Postgasse'
      }
    },
    {
      type: 'way',
      id: 81292186,
      geometry: [
        {lat: 46.681944, lon: 7.846898},
        {lat: 46.681643, lon: 7.847301}
      ],
      tags: {highway: 'footway', surface: 'concrete', bridge: 'yes'}
    },
    {
      type: 'way',
      id: 81292214,
      geometry: [
        {lat: 46.686487, lon: 7.851402},
        {lat: 46.686553, lon: 7.851622},
        {lat: 46.686682, lon: 7.851845}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 81294668,
      geometry: [
        {lat: 46.687831, lon: 7.852733},
        {lat: 46.687847, lon: 7.852326}
      ],
      tags: {highway: 'footway', surface: 'wood', bridge: 'yes'}
    },
    {
      type: 'way',
      id: 81294680,
      geometry: [
        {lat: 46.675812, lon: 7.853093},
        {lat: 46.675775, lon: 7.852985},
        {lat: 46.67568, lon: 7.852906},
        {lat: 46.675622, lon: 7.852914},
        {lat: 46.675576, lon: 7.852963},
        {lat: 46.675506, lon: 7.85303},
        {lat: 46.675439, lon: 7.853145},
        {lat: 46.675372, lon: 7.853285},
        {lat: 46.675306, lon: 7.853331},
        {lat: 46.675236, lon: 7.853261},
        {lat: 46.675124, lon: 7.853248},
        {lat: 46.675055, lon: 7.853345},
        {lat: 46.675066, lon: 7.853221},
        {lat: 46.675132, lon: 7.853157},
        {lat: 46.675241, lon: 7.853032},
        {lat: 46.675293, lon: 7.852856},
        {lat: 46.675367, lon: 7.852656},
        {lat: 46.675493, lon: 7.852423},
        {lat: 46.675573, lon: 7.852314},
        {lat: 46.675584, lon: 7.852221},
        {lat: 46.675561, lon: 7.852059},
        {lat: 46.675598, lon: 7.851984},
        {lat: 46.675692, lon: 7.852032},
        {lat: 46.675827, lon: 7.851918},
        {lat: 46.675929, lon: 7.851774}
      ],
      tags: {highway: 'path', width: '1.3', surface: 'gravel'}
    },
    {
      type: 'way',
      id: 81294709,
      geometry: [
        {lat: 46.684342, lon: 7.848542},
        {lat: 46.684242, lon: 7.848724},
        {lat: 46.684171, lon: 7.848976},
        {lat: 46.684154, lon: 7.84908},
        {lat: 46.684168, lon: 7.849158},
        {lat: 46.684396, lon: 7.849352}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Helvetiastrasse'}
    },
    {
      type: 'way',
      id: 81610908,
      geometry: [
        {lat: 46.694221, lon: 7.879606},
        {lat: 46.693885, lon: 7.879381},
        {lat: 46.693862, lon: 7.879206},
        {lat: 46.69365, lon: 7.87759},
        {lat: 46.693924, lon: 7.877571},
        {lat: 46.69399, lon: 7.877564}
      ],
      tags: {highway: 'footway', surface: 'fine_gravel', name: 'Aareweg'}
    },
    {
      type: 'way',
      id: 81610909,
      geometry: [
        {lat: 46.688854, lon: 7.863015},
        {lat: 46.688902, lon: 7.86293},
        {lat: 46.689098, lon: 7.862774},
        {lat: 46.689181, lon: 7.862721},
        {lat: 46.689428, lon: 7.862613},
        {lat: 46.689502, lon: 7.8626},
        {lat: 46.689557, lon: 7.862629},
        {lat: 46.689677, lon: 7.862582},
        {lat: 46.689796, lon: 7.862547}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Höheweg'}
    },
    {
      type: 'way',
      id: 81610910,
      geometry: [
        {lat: 46.688665, lon: 7.863134},
        {lat: 46.688816, lon: 7.863035},
        {lat: 46.688891, lon: 7.863001},
        {lat: 46.689251, lon: 7.862993},
        {lat: 46.689432, lon: 7.862981},
        {lat: 46.689604, lon: 7.862959},
        {lat: 46.689685, lon: 7.86294},
        {lat: 46.689738, lon: 7.862917},
        {lat: 46.689831, lon: 7.86289}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Höheweg'}
    },
    {
      type: 'way',
      id: 82125352,
      geometry: [
        {lat: 46.687017, lon: 7.851341},
        {lat: 46.686932, lon: 7.8513},
        {lat: 46.686859, lon: 7.851306},
        {lat: 46.686753, lon: 7.851354},
        {lat: 46.686696, lon: 7.851386},
        {lat: 46.686609, lon: 7.851417},
        {lat: 46.686487, lon: 7.851402},
        {lat: 46.686242, lon: 7.851354},
        {lat: 46.686125, lon: 7.851373},
        {lat: 46.685784, lon: 7.851405},
        {lat: 46.685599, lon: 7.851404},
        {lat: 46.685502, lon: 7.851395},
        {lat: 46.685414, lon: 7.85138},
        {lat: 46.685323, lon: 7.851356},
        {lat: 46.6851, lon: 7.85126},
        {lat: 46.684953, lon: 7.851186},
        {lat: 46.684809, lon: 7.851102},
        {lat: 46.684697, lon: 7.851032},
        {lat: 46.684641, lon: 7.850992},
        {lat: 46.684535, lon: 7.850911},
        {lat: 46.684272, lon: 7.850705},
        {lat: 46.684222, lon: 7.850664}
      ],
      tags: {
        highway: 'residential',
        width: '4',
        surface: 'asphalt',
        name: 'Aarestrasse'
      }
    },
    {
      type: 'way',
      id: 83921533,
      geometry: [
        {lat: 46.680706, lon: 7.851495},
        {lat: 46.680726, lon: 7.851229}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 83921535,
      geometry: [
        {lat: 46.68035, lon: 7.850763},
        {lat: 46.680451, lon: 7.850771}
      ],
      tags: {highway: 'steps'}
    },
    {
      type: 'way',
      id: 83921537,
      geometry: [
        {lat: 46.680295, lon: 7.850759},
        {lat: 46.679796, lon: 7.850646}
      ],
      tags: {highway: 'footway', surface: 'concrete'}
    },
    {
      type: 'way',
      id: 83921539,
      geometry: [
        {lat: 46.680295, lon: 7.850963},
        {lat: 46.680301, lon: 7.850776}
      ],
      tags: {
        highway: 'footway',
        surface: 'concrete',
        name: 'Straubhaarunterführung'
      }
    },
    {
      type: 'way',
      id: 83921542,
      geometry: [
        {lat: 46.680726, lon: 7.851229},
        {lat: 46.680734, lon: 7.85104}
      ],
      tags: {highway: 'footway', surface: 'concrete'}
    },
    {
      type: 'way',
      id: 83921547,
      geometry: [
        {lat: 46.680726, lon: 7.851229},
        {lat: 46.680658, lon: 7.851225},
        {lat: 46.680601, lon: 7.851261},
        {lat: 46.680578, lon: 7.851333},
        {lat: 46.680563, lon: 7.851462}
      ],
      tags: {highway: 'service', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 90182721,
      geometry: [
        {lat: 46.684698, lon: 7.847244},
        {lat: 46.684606, lon: 7.847357},
        {lat: 46.684556, lon: 7.847416},
        {lat: 46.684548, lon: 7.847513},
        {lat: 46.684666, lon: 7.847725},
        {lat: 46.684757, lon: 7.847958},
        {lat: 46.684772, lon: 7.848059},
        {lat: 46.68479, lon: 7.84814},
        {lat: 46.684838, lon: 7.848235},
        {lat: 46.685003, lon: 7.848497},
        {lat: 46.685063, lon: 7.848557}
      ],
      tags: {
        highway: 'residential',
        width: '3',
        surface: 'asphalt',
        name: 'Unterdorf'
      }
    },
    {
      type: 'way',
      id: 90182722,
      geometry: [
        {lat: 46.68447, lon: 7.848381},
        {lat: 46.684517, lon: 7.84832},
        {lat: 46.684598, lon: 7.848217},
        {lat: 46.68468, lon: 7.848126},
        {lat: 46.684772, lon: 7.848059}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Unterdorf'}
    },
    {
      type: 'way',
      id: 102822487,
      geometry: [
        {lat: 46.680082, lon: 7.876314},
        {lat: 46.680153, lon: 7.876653},
        {lat: 46.680193, lon: 7.876854},
        {lat: 46.680236, lon: 7.876949},
        {lat: 46.680291, lon: 7.877013},
        {lat: 46.680356, lon: 7.877108},
        {lat: 46.680418, lon: 7.877294},
        {lat: 46.680452, lon: 7.8774}
      ],
      tags: {highway: 'service', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 102822506,
      geometry: [
        {lat: 46.67933, lon: 7.877794},
        {lat: 46.679288, lon: 7.87785},
        {lat: 46.679248, lon: 7.878408},
        {lat: 46.679211, lon: 7.87897},
        {lat: 46.679195, lon: 7.879113},
        {lat: 46.679173, lon: 7.879249},
        {lat: 46.679112, lon: 7.879543},
        {lat: 46.679079, lon: 7.87973},
        {lat: 46.679067, lon: 7.879819},
        {lat: 46.679009, lon: 7.880485},
        {lat: 46.678975, lon: 7.88055},
        {lat: 46.678899, lon: 7.880529},
        {lat: 46.67729, lon: 7.878091},
        {lat: 46.676879, lon: 7.877456},
        {lat: 46.676906, lon: 7.877217},
        {lat: 46.676937, lon: 7.876921}
      ],
      tags: {highway: 'track'}
    },
    {
      type: 'way',
      id: 102822526,
      geometry: [
        {lat: 46.679923, lon: 7.875531},
        {lat: 46.679915, lon: 7.875446},
        {lat: 46.679928, lon: 7.875375}
      ],
      tags: {highway: 'service', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 102822538,
      geometry: [
        {lat: 46.681277, lon: 7.88259},
        {lat: 46.681258, lon: 7.882311},
        {lat: 46.681172, lon: 7.881217},
        {lat: 46.681069, lon: 7.879979},
        {lat: 46.681023, lon: 7.879835},
        {lat: 46.680967, lon: 7.879726},
        {lat: 46.680939, lon: 7.879639},
        {lat: 46.680924, lon: 7.87956},
        {lat: 46.680909, lon: 7.879438},
        {lat: 46.680854, lon: 7.878789},
        {lat: 46.680832, lon: 7.878634},
        {lat: 46.680816, lon: 7.878553},
        {lat: 46.680792, lon: 7.878461},
        {lat: 46.680652, lon: 7.878056}
      ],
      tags: {highway: 'track'}
    },
    {
      type: 'way',
      id: 102822542,
      geometry: [
        {lat: 46.680013, lon: 7.875963},
        {lat: 46.679947, lon: 7.875647},
        {lat: 46.679923, lon: 7.875531}
      ],
      tags: {highway: 'service', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 117871881,
      geometry: [
        {lat: 46.682044, lon: 7.851295},
        {lat: 46.682038, lon: 7.851496},
        {lat: 46.682322, lon: 7.851559},
        {lat: 46.682262, lon: 7.85179}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 131308870,
      geometry: [
        {lat: 46.686182, lon: 7.863123},
        {lat: 46.686136, lon: 7.863197},
        {lat: 46.686136, lon: 7.863288},
        {lat: 46.68619, lon: 7.863368},
        {lat: 46.686253, lon: 7.863368},
        {lat: 46.686301, lon: 7.86331},
        {lat: 46.686312, lon: 7.86322},
        {lat: 46.68628, lon: 7.863141},
        {lat: 46.686222, lon: 7.86311},
        {lat: 46.686182, lon: 7.863123}
      ],
      tags: {
        highway: 'primary',
        lanes: '1',
        surface: 'asphalt',
        name: 'Klosterstrasse'
      }
    },
    {
      type: 'way',
      id: 144527977,
      geometry: [
        {lat: 46.67868, lon: 7.851069},
        {lat: 46.678668, lon: 7.851231},
        {lat: 46.67868, lon: 7.85154},
        {lat: 46.678714, lon: 7.852071},
        {lat: 46.678731, lon: 7.852156}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Friedweg'
      }
    },
    {
      type: 'way',
      id: 144558616,
      geometry: [
        {lat: 46.686312, lon: 7.850126},
        {lat: 46.686256, lon: 7.850146}
      ],
      tags: {highway: 'path', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 144558622,
      geometry: [
        {lat: 46.686394, lon: 7.849665},
        {lat: 46.686375, lon: 7.849746},
        {lat: 46.686312, lon: 7.850126}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Mühlegässli'}
    },
    {
      type: 'way',
      id: 144558628,
      geometry: [
        {lat: 46.686312, lon: 7.850126},
        {lat: 46.686461, lon: 7.8502},
        {lat: 46.68656, lon: 7.85024},
        {lat: 46.686676, lon: 7.850276},
        {lat: 46.686755, lon: 7.8503},
        {lat: 46.687096, lon: 7.85044},
        {lat: 46.687126, lon: 7.850466}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Unter den Häusern'}
    },
    {
      type: 'way',
      id: 144587340,
      geometry: [
        {lat: 46.678343, lon: 7.85348},
        {lat: 46.678732, lon: 7.853121},
        {lat: 46.679105, lon: 7.85277},
        {lat: 46.679435, lon: 7.852461},
        {lat: 46.679506, lon: 7.852394}
      ],
      tags: {
        highway: 'residential',
        width: '5.5',
        lanes: '1',
        surface: 'asphalt',
        name: 'Rugenaustrasse'
      }
    },
    {
      type: 'way',
      id: 144613307,
      geometry: [
        {lat: 46.68043, lon: 7.85152},
        {lat: 46.680446, lon: 7.851437}
      ],
      tags: {
        highway: 'footway',
        lanes: '1',
        surface: 'asphalt',
        name: 'Rugenaustrasse'
      }
    },
    {
      type: 'way',
      id: 144617542,
      geometry: [
        {lat: 46.687691, lon: 7.850265},
        {lat: 46.687571, lon: 7.85027},
        {lat: 46.68749, lon: 7.85024},
        {lat: 46.687368, lon: 7.85016},
        {lat: 46.687284, lon: 7.850115},
        {lat: 46.687193, lon: 7.85008}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Habkerngässli'}
    },
    {
      type: 'way',
      id: 144624043,
      geometry: [
        {lat: 46.680599, lon: 7.85492},
        {lat: 46.6804, lon: 7.855094},
        {lat: 46.680218, lon: 7.855256},
        {lat: 46.680161, lon: 7.855296},
        {lat: 46.680047, lon: 7.855361},
        {lat: 46.679425, lon: 7.855929}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Waldeggstrasse'
      }
    },
    {
      type: 'way',
      id: 144624048,
      geometry: [
        {lat: 46.680498, lon: 7.854674},
        {lat: 46.680426, lon: 7.854729},
        {lat: 46.680353, lon: 7.854801},
        {lat: 46.680104, lon: 7.855023},
        {lat: 46.680061, lon: 7.855062}
      ],
      tags: {
        highway: 'residential',
        width: '3.1',
        lanes: '1',
        surface: 'asphalt',
        name: 'Waldeggstrasse'
      }
    },
    {
      type: 'way',
      id: 144627550,
      geometry: [
        {lat: 46.681697, lon: 7.85564},
        {lat: 46.68187, lon: 7.855528},
        {lat: 46.681951, lon: 7.855429},
        {lat: 46.682344, lon: 7.855079}
      ],
      tags: {
        highway: 'service',
        surface: 'asphalt',
        name: 'General-Guisan-Strasse'
      }
    },
    {
      type: 'way',
      id: 144627555,
      geometry: [
        {lat: 46.681697, lon: 7.85564},
        {lat: 46.681585, lon: 7.855733},
        {lat: 46.681593, lon: 7.855782}
      ],
      tags: {highway: 'footway', surface: 'pebblestone'}
    },
    {
      type: 'way',
      id: 144627556,
      geometry: [
        {lat: 46.681593, lon: 7.855782},
        {lat: 46.681643, lon: 7.856144},
        {lat: 46.681662, lon: 7.856322}
      ],
      tags: {
        highway: 'service',
        lanes: '1',
        surface: 'asphalt',
        name: 'Rosenstrasse'
      }
    },
    {
      type: 'way',
      id: 144627557,
      geometry: [
        {lat: 46.68125, lon: 7.856556},
        {lat: 46.681174, lon: 7.856588},
        {lat: 46.681092, lon: 7.856629},
        {lat: 46.681004, lon: 7.85672}
      ],
      tags: {highway: 'service', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 144633482,
      geometry: [
        {lat: 46.687289, lon: 7.862665},
        {lat: 46.68731, lon: 7.862826},
        {lat: 46.687326, lon: 7.862951},
        {lat: 46.687402, lon: 7.863525},
        {lat: 46.687415, lon: 7.863629}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 144646536,
      geometry: [
        {lat: 46.686057, lon: 7.854767},
        {lat: 46.685985, lon: 7.854765},
        {lat: 46.685318, lon: 7.85503},
        {lat: 46.685164, lon: 7.855101}
      ],
      tags: {highway: 'pedestrian', surface: 'paving_stones', name: 'Postgasse'}
    },
    {
      type: 'way',
      id: 144646541,
      geometry: [
        {lat: 46.686298, lon: 7.85551},
        {lat: 46.686174, lon: 7.855148},
        {lat: 46.686103, lon: 7.854952},
        {lat: 46.68606, lon: 7.854833},
        {lat: 46.686057, lon: 7.854767}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Blumenstrasse'}
    },
    {
      type: 'way',
      id: 144646544,
      geometry: [
        {lat: 46.686004, lon: 7.85476},
        {lat: 46.685964, lon: 7.854527}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 144646545,
      geometry: [
        {lat: 46.685701, lon: 7.853382},
        {lat: 46.685732, lon: 7.853471},
        {lat: 46.685788, lon: 7.853735},
        {lat: 46.685854, lon: 7.854062},
        {lat: 46.685906, lon: 7.854289},
        {lat: 46.685957, lon: 7.854498},
        {lat: 46.685964, lon: 7.854527}
      ],
      tags: {
        highway: 'residential',
        width: '4.2',
        lanes: '1',
        surface: 'asphalt',
        name: 'Blumenstrasse'
      }
    },
    {
      type: 'way',
      id: 144649246,
      geometry: [
        {lat: 46.68554, lon: 7.853539},
        {lat: 46.685347, lon: 7.853116},
        {lat: 46.685308, lon: 7.853013},
        {lat: 46.685164, lon: 7.852598},
        {lat: 46.685353, lon: 7.852378},
        {lat: 46.685374, lon: 7.852337}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Aareckstrasse'}
    },
    {
      type: 'way',
      id: 144650980,
      geometry: [
        {lat: 46.685957, lon: 7.854498},
        {lat: 46.68604, lon: 7.854502},
        {lat: 46.686106, lon: 7.854515},
        {lat: 46.68618, lon: 7.854538},
        {lat: 46.686247, lon: 7.85457},
        {lat: 46.686341, lon: 7.854626}
      ],
      tags: {
        highway: 'service',
        lanes: '1',
        surface: 'asphalt',
        name: 'Postgasse'
      }
    },
    {
      type: 'way',
      id: 144653252,
      geometry: [
        {lat: 46.684357, lon: 7.852181},
        {lat: 46.684373, lon: 7.85186}
      ],
      tags: {highway: 'service', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 144653253,
      geometry: [
        {lat: 46.6849, lon: 7.853253},
        {lat: 46.68439, lon: 7.852256},
        {lat: 46.684357, lon: 7.852181}
      ],
      tags: {highway: 'service', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 144653254,
      geometry: [
        {lat: 46.685207, lon: 7.853887},
        {lat: 46.685159, lon: 7.853788},
        {lat: 46.6849, lon: 7.853253}
      ],
      tags: {highway: 'service', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 144764601,
      geometry: [
        {lat: 46.679618, lon: 7.853976},
        {lat: 46.679574, lon: 7.85388},
        {lat: 46.679492, lon: 7.853655},
        {lat: 46.679535, lon: 7.853551},
        {lat: 46.679622, lon: 7.853705},
        {lat: 46.679755, lon: 7.853867},
        {lat: 46.679699, lon: 7.853921},
        {lat: 46.679635, lon: 7.853982},
        {lat: 46.679618, lon: 7.853976}
      ],
      tags: {highway: 'service', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 144764602,
      geometry: [
        {lat: 46.678822, lon: 7.854781},
        {lat: 46.678982, lon: 7.854635},
        {lat: 46.679618, lon: 7.853976}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Waldeggstrasse'}
    },
    {
      type: 'way',
      id: 144764605,
      geometry: [
        {lat: 46.679289, lon: 7.853736},
        {lat: 46.678847, lon: 7.854162},
        {lat: 46.678649, lon: 7.85436}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Waldeggstrasse'}
    },
    {
      type: 'way',
      id: 144764608,
      geometry: [
        {lat: 46.679585, lon: 7.854918},
        {lat: 46.679467, lon: 7.854652},
        {lat: 46.6794, lon: 7.854637},
        {lat: 46.679262, lon: 7.854764},
        {lat: 46.679127, lon: 7.854895}
      ],
      tags: {highway: 'service', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 144764610,
      geometry: [
        {lat: 46.679127, lon: 7.854895},
        {lat: 46.678953, lon: 7.855064}
      ],
      tags: {highway: 'service', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 144777664,
      geometry: [
        {lat: 46.684821, lon: 7.861529},
        {lat: 46.684783, lon: 7.861635}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 144777709,
      geometry: [
        {lat: 46.684783, lon: 7.861635},
        {lat: 46.684773, lon: 7.861761},
        {lat: 46.684785, lon: 7.861858},
        {lat: 46.684829, lon: 7.86216},
        {lat: 46.684852, lon: 7.862319}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 144821718,
      geometry: [
        {lat: 46.688337, lon: 7.863778},
        {lat: 46.688502, lon: 7.863664},
        {lat: 46.688705, lon: 7.863525},
        {lat: 46.688778, lon: 7.86347}
      ],
      tags: {highway: 'footway', surface: 'paving_stones'}
    },
    {
      type: 'way',
      id: 144821720,
      geometry: [
        {lat: 46.688843, lon: 7.863887},
        {lat: 46.688733, lon: 7.863789},
        {lat: 46.688721, lon: 7.86371},
        {lat: 46.688653, lon: 7.863643},
        {lat: 46.688588, lon: 7.863687},
        {lat: 46.688519, lon: 7.863692},
        {lat: 46.688502, lon: 7.863664}
      ],
      tags: {highway: 'footway', surface: 'fine_gravel'}
    },
    {
      type: 'way',
      id: 144821903,
      geometry: [
        {lat: 46.683466, lon: 7.854768},
        {lat: 46.683407, lon: 7.85457},
        {lat: 46.683177, lon: 7.854695}
      ],
      tags: {highway: 'service', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 144821904,
      geometry: [
        {lat: 46.683174, lon: 7.854917},
        {lat: 46.683466, lon: 7.854768},
        {lat: 46.683532, lon: 7.854967}
      ],
      tags: {highway: 'service', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 144821907,
      geometry: [
        {lat: 46.683532, lon: 7.854967},
        {lat: 46.683267, lon: 7.855103},
        {lat: 46.683314, lon: 7.855308},
        {lat: 46.68358, lon: 7.855173},
        {lat: 46.683532, lon: 7.854967}
      ],
      tags: {highway: 'service', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 144869183,
      geometry: [
        {lat: 46.688043, lon: 7.863305},
        {lat: 46.687981, lon: 7.863258},
        {lat: 46.687813, lon: 7.863061},
        {lat: 46.687754, lon: 7.863},
        {lat: 46.687642, lon: 7.862927},
        {lat: 46.687559, lon: 7.862887},
        {lat: 46.687496, lon: 7.862863},
        {lat: 46.687438, lon: 7.862848},
        {lat: 46.687343, lon: 7.862843},
        {lat: 46.687259, lon: 7.862865},
        {lat: 46.687168, lon: 7.862909},
        {lat: 46.687032, lon: 7.863003},
        {lat: 46.686938, lon: 7.863051},
        {lat: 46.686821, lon: 7.863076},
        {lat: 46.686754, lon: 7.863109},
        {lat: 46.686666, lon: 7.86315},
        {lat: 46.686624, lon: 7.86313}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 147007460,
      geometry: [
        {lat: 46.686222, lon: 7.850254},
        {lat: 46.686195, lon: 7.850325},
        {lat: 46.686148, lon: 7.850384},
        {lat: 46.685832, lon: 7.850539},
        {lat: 46.685733, lon: 7.850551},
        {lat: 46.685598, lon: 7.850554},
        {lat: 46.685474, lon: 7.850555},
        {lat: 46.685416, lon: 7.850548},
        {lat: 46.685341, lon: 7.850529},
        {lat: 46.685146, lon: 7.850463},
        {lat: 46.684673, lon: 7.850342},
        {lat: 46.684615, lon: 7.850311},
        {lat: 46.684532, lon: 7.850271},
        {lat: 46.684477, lon: 7.850219},
        {lat: 46.684421, lon: 7.850166}
      ],
      tags: {highway: 'footway', width: '1.3', surface: 'compacted'}
    },
    {
      type: 'way',
      id: 147037699,
      geometry: [
        {lat: 46.690384, lon: 7.86205},
        {lat: 46.690395, lon: 7.861816},
        {lat: 46.690407, lon: 7.861654},
        {lat: 46.690448, lon: 7.861577},
        {lat: 46.69052, lon: 7.861496},
        {lat: 46.690629, lon: 7.861332},
        {lat: 46.690688, lon: 7.861231},
        {lat: 46.690713, lon: 7.861159},
        {lat: 46.690734, lon: 7.861055},
        {lat: 46.690734, lon: 7.860944},
        {lat: 46.690744, lon: 7.860784},
        {lat: 46.69076, lon: 7.860646},
        {lat: 46.690778, lon: 7.860539},
        {lat: 46.690747, lon: 7.860469},
        {lat: 46.690737, lon: 7.860414}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 147037723,
      geometry: [
        {lat: 46.690737, lon: 7.860414},
        {lat: 46.690742, lon: 7.860321}
      ],
      tags: {highway: 'steps'}
    },
    {
      type: 'way',
      id: 147037725,
      geometry: [
        {lat: 46.690742, lon: 7.860321},
        {lat: 46.690783, lon: 7.860112},
        {lat: 46.690785, lon: 7.860105}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 147037727,
      geometry: [
        {lat: 46.690785, lon: 7.860105},
        {lat: 46.690799, lon: 7.860051}
      ],
      tags: {highway: 'steps'}
    },
    {
      type: 'way',
      id: 147037729,
      geometry: [
        {lat: 46.690799, lon: 7.860051},
        {lat: 46.690835, lon: 7.859918},
        {lat: 46.690911, lon: 7.859666},
        {lat: 46.69093, lon: 7.859581},
        {lat: 46.690956, lon: 7.859451},
        {lat: 46.690993, lon: 7.859161},
        {lat: 46.691005, lon: 7.859035},
        {lat: 46.691016, lon: 7.858599},
        {lat: 46.691009, lon: 7.858456},
        {lat: 46.690994, lon: 7.858289},
        {lat: 46.690963, lon: 7.858037},
        {lat: 46.690866, lon: 7.85764}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 147037730,
      geometry: [
        {lat: 46.690866, lon: 7.85764},
        {lat: 46.690844, lon: 7.857558}
      ],
      tags: {highway: 'steps'}
    },
    {
      type: 'way',
      id: 147037733,
      geometry: [
        {lat: 46.690844, lon: 7.857558},
        {lat: 46.690817, lon: 7.857452},
        {lat: 46.690757, lon: 7.857242},
        {lat: 46.690707, lon: 7.857102},
        {lat: 46.690654, lon: 7.856979},
        {lat: 46.690607, lon: 7.856857},
        {lat: 46.690607, lon: 7.856783}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 147037739,
      geometry: [
        {lat: 46.689583, lon: 7.855505},
        {lat: 46.68947, lon: 7.85522},
        {lat: 46.689419, lon: 7.855093},
        {lat: 46.68934, lon: 7.854911},
        {lat: 46.6893, lon: 7.854793},
        {lat: 46.689262, lon: 7.854655},
        {lat: 46.689244, lon: 7.854566},
        {lat: 46.689214, lon: 7.854469},
        {lat: 46.689185, lon: 7.854379},
        {lat: 46.689109, lon: 7.854133},
        {lat: 46.68907, lon: 7.85401},
        {lat: 46.688908, lon: 7.853496}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Untere Goldey'}
    },
    {
      type: 'way',
      id: 147037747,
      geometry: [
        {lat: 46.689935, lon: 7.855261},
        {lat: 46.689672, lon: 7.855436},
        {lat: 46.689583, lon: 7.855505}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Untere Goldey'}
    },
    {
      type: 'way',
      id: 147037750,
      geometry: [
        {lat: 46.690501, lon: 7.861734},
        {lat: 46.690448, lon: 7.861577}
      ],
      tags: {highway: 'path'}
    },
    {
      type: 'way',
      id: 147047765,
      geometry: [
        {lat: 46.689911, lon: 7.858421},
        {lat: 46.689382, lon: 7.858545}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        bridge: 'yes',
        name: 'Untere Goldey'
      }
    },
    {
      type: 'way',
      id: 147047767,
      geometry: [
        {lat: 46.690023, lon: 7.85762},
        {lat: 46.689862, lon: 7.857611}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 147047769,
      geometry: [
        {lat: 46.690251, lon: 7.857564},
        {lat: 46.690075, lon: 7.857607},
        {lat: 46.690004, lon: 7.857633},
        {lat: 46.689969, lon: 7.857701},
        {lat: 46.689963, lon: 7.857801},
        {lat: 46.689968, lon: 7.857881},
        {lat: 46.690005, lon: 7.858303},
        {lat: 46.690013, lon: 7.858397},
        {lat: 46.690075, lon: 7.859099},
        {lat: 46.690101, lon: 7.859191}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Untere Goldey'}
    },
    {
      type: 'way',
      id: 147049152,
      geometry: [
        {lat: 46.690234, lon: 7.862018},
        {lat: 46.690247, lon: 7.8622},
        {lat: 46.690264, lon: 7.862403},
        {lat: 46.690278, lon: 7.8626},
        {lat: 46.690291, lon: 7.862767},
        {lat: 46.69031, lon: 7.862984},
        {lat: 46.690331, lon: 7.863223},
        {lat: 46.690348, lon: 7.863406},
        {lat: 46.690362, lon: 7.863553},
        {lat: 46.69038, lon: 7.863702},
        {lat: 46.690402, lon: 7.863861},
        {lat: 46.690416, lon: 7.863952},
        {lat: 46.690438, lon: 7.864138},
        {lat: 46.690474, lon: 7.864415},
        {lat: 46.690506, lon: 7.864695},
        {lat: 46.690539, lon: 7.865042},
        {lat: 46.690565, lon: 7.865209},
        {lat: 46.690592, lon: 7.865377},
        {lat: 46.690598, lon: 7.865419}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 147050123,
      geometry: [
        {lat: 46.690013, lon: 7.858397},
        {lat: 46.689933, lon: 7.858416}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Untere Goldey'}
    },
    {
      type: 'way',
      id: 147051024,
      geometry: [
        {lat: 46.689526, lon: 7.854416},
        {lat: 46.689625, lon: 7.854313},
        {lat: 46.689732, lon: 7.85414},
        {lat: 46.68979, lon: 7.854073}
      ],
      tags: {highway: 'service', name: 'Obere Goldey'}
    },
    {
      type: 'way',
      id: 147116033,
      geometry: [
        {lat: 46.689193, lon: 7.854496},
        {lat: 46.689205, lon: 7.854533}
      ],
      tags: {highway: 'steps', surface: 'paving_stones'}
    },
    {
      type: 'way',
      id: 147116035,
      geometry: [
        {lat: 46.689186, lon: 7.854473},
        {lat: 46.689177, lon: 7.854439}
      ],
      tags: {highway: 'steps', surface: 'paving_stones'}
    },
    {
      type: 'way',
      id: 147116040,
      geometry: [
        {lat: 46.68919, lon: 7.854485},
        {lat: 46.688758, lon: 7.854767}
      ],
      tags: {highway: 'footway', surface: 'asphalt', bridge: 'yes'}
    },
    {
      type: 'way',
      id: 147116041,
      geometry: [
        {lat: 46.689205, lon: 7.854533},
        {lat: 46.689235, lon: 7.854536}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 147116042,
      geometry: [
        {lat: 46.689177, lon: 7.854439},
        {lat: 46.689195, lon: 7.854405}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 147116044,
      geometry: [
        {lat: 46.688758, lon: 7.854767},
        {lat: 46.688733, lon: 7.854783}
      ],
      tags: {highway: 'steps'}
    },
    {
      type: 'way',
      id: 147116047,
      geometry: [
        {lat: 46.687697, lon: 7.850457},
        {lat: 46.687807, lon: 7.850494},
        {lat: 46.687883, lon: 7.850549},
        {lat: 46.687998, lon: 7.850647},
        {lat: 46.688072, lon: 7.850719},
        {lat: 46.688235, lon: 7.850889},
        {lat: 46.688284, lon: 7.850956},
        {lat: 46.688367, lon: 7.851085},
        {lat: 46.688441, lon: 7.851201},
        {lat: 46.68849, lon: 7.851274},
        {lat: 46.688617, lon: 7.851459},
        {lat: 46.688847, lon: 7.851831},
        {lat: 46.688877, lon: 7.851885}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Obere Goldey'}
    },
    {
      type: 'way',
      id: 147116056,
      geometry: [
        {lat: 46.690346, lon: 7.85635},
        {lat: 46.69024, lon: 7.856243},
        {lat: 46.690041, lon: 7.856007},
        {lat: 46.68993, lon: 7.855901},
        {lat: 46.689876, lon: 7.855855},
        {lat: 46.689706, lon: 7.855707},
        {lat: 46.689639, lon: 7.855628},
        {lat: 46.689599, lon: 7.855542}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Obere Goldey'}
    },
    {
      type: 'way',
      id: 147117199,
      geometry: [
        {lat: 46.688794, lon: 7.853105},
        {lat: 46.688704, lon: 7.852799},
        {lat: 46.688652, lon: 7.852635},
        {lat: 46.688591, lon: 7.852463},
        {lat: 46.688544, lon: 7.852348},
        {lat: 46.688392, lon: 7.852002},
        {lat: 46.688347, lon: 7.85191},
        {lat: 46.688221, lon: 7.851682},
        {lat: 46.68816, lon: 7.851572},
        {lat: 46.688045, lon: 7.851396},
        {lat: 46.687961, lon: 7.851278},
        {lat: 46.687808, lon: 7.851061},
        {lat: 46.687737, lon: 7.850946},
        {lat: 46.687685, lon: 7.850834},
        {lat: 46.687628, lon: 7.850666}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Untere Goldey'}
    },
    {
      type: 'way',
      id: 147122674,
      geometry: [
        {lat: 46.686999, lon: 7.851404},
        {lat: 46.687164, lon: 7.851643},
        {lat: 46.687238, lon: 7.851801},
        {lat: 46.687287, lon: 7.851861},
        {lat: 46.687366, lon: 7.851909},
        {lat: 46.687434, lon: 7.851934},
        {lat: 46.687513, lon: 7.851952},
        {lat: 46.687614, lon: 7.852122}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Spielmatte'}
    },
    {
      type: 'way',
      id: 147122677,
      geometry: [
        {lat: 46.687817, lon: 7.852192},
        {lat: 46.687746, lon: 7.852143},
        {lat: 46.687647, lon: 7.852144},
        {lat: 46.687614, lon: 7.852122}
      ],
      tags: {highway: 'footway', surface: 'fine_gravel'}
    },
    {
      type: 'way',
      id: 147122678,
      geometry: [
        {lat: 46.688851, lon: 7.855339},
        {lat: 46.688846, lon: 7.855119}
      ],
      tags: {highway: 'footway', surface: 'concrete'}
    },
    {
      type: 'way',
      id: 147122679,
      geometry: [
        {lat: 46.688846, lon: 7.855119},
        {lat: 46.688769, lon: 7.854797},
        {lat: 46.688738, lon: 7.854723},
        {lat: 46.688718, lon: 7.85464},
        {lat: 46.68869, lon: 7.854554},
        {lat: 46.688611, lon: 7.85431},
        {lat: 46.688464, lon: 7.85382}
      ],
      tags: {highway: 'footway', surface: 'fine_gravel'}
    },
    {
      type: 'way',
      id: 148473207,
      geometry: [
        {lat: 46.68391, lon: 7.857444},
        {lat: 46.683875, lon: 7.85767},
        {lat: 46.683834, lon: 7.857837},
        {lat: 46.683789, lon: 7.857957}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Jungfraustrasse'
      }
    },
    {
      type: 'way',
      id: 148473250,
      geometry: [
        {lat: 46.682378, lon: 7.857144},
        {lat: 46.682369, lon: 7.857223},
        {lat: 46.682448, lon: 7.857524},
        {lat: 46.682475, lon: 7.857612},
        {lat: 46.682549, lon: 7.857834},
        {lat: 46.682643, lon: 7.858207},
        {lat: 46.682679, lon: 7.858352},
        {lat: 46.682769, lon: 7.858684}
      ],
      tags: {
        highway: 'residential',
        width: '4',
        lanes: '1',
        surface: 'asphalt',
        name: 'Waldeggstrasse'
      }
    },
    {
      type: 'way',
      id: 148473251,
      geometry: [
        {lat: 46.68391, lon: 7.857444},
        {lat: 46.683867, lon: 7.857409}
      ],
      tags: {
        highway: 'tertiary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Waldeggstrasse'
      }
    },
    {
      type: 'way',
      id: 150075948,
      geometry: [
        {lat: 46.681632, lon: 7.847317},
        {lat: 46.681546, lon: 7.847154},
        {lat: 46.6815, lon: 7.847092},
        {lat: 46.681375, lon: 7.846999},
        {lat: 46.681278, lon: 7.846935},
        {lat: 46.681171, lon: 7.846844},
        {lat: 46.6811, lon: 7.846801},
        {lat: 46.681054, lon: 7.846757},
        {lat: 46.681002, lon: 7.846717},
        {lat: 46.680886, lon: 7.846645},
        {lat: 46.680716, lon: 7.846529},
        {lat: 46.680495, lon: 7.846373},
        {lat: 46.680419, lon: 7.84633},
        {lat: 46.680331, lon: 7.84625},
        {lat: 46.680254, lon: 7.846208},
        {lat: 46.680189, lon: 7.846163},
        {lat: 46.680056, lon: 7.846099},
        {lat: 46.680003, lon: 7.846052},
        {lat: 46.679827, lon: 7.845945},
        {lat: 46.679724, lon: 7.84586},
        {lat: 46.679583, lon: 7.845774},
        {lat: 46.679514, lon: 7.845716},
        {lat: 46.679403, lon: 7.845657},
        {lat: 46.679162, lon: 7.845504},
        {lat: 46.679039, lon: 7.845408},
        {lat: 46.678933, lon: 7.845362},
        {lat: 46.678809, lon: 7.845288},
        {lat: 46.67873, lon: 7.845222},
        {lat: 46.678641, lon: 7.845149}
      ],
      tags: {highway: 'footway', surface: 'ground'}
    },
    {
      type: 'way',
      id: 150469770,
      geometry: [
        {lat: 46.686076, lon: 7.849419},
        {lat: 46.686177, lon: 7.849502},
        {lat: 46.68628, lon: 7.849585},
        {lat: 46.686383, lon: 7.849659},
        {lat: 46.686408, lon: 7.84967}
      ],
      tags: {
        highway: 'residential',
        width: '5',
        surface: 'asphalt',
        name: 'Untere Gasse'
      }
    },
    {
      type: 'way',
      id: 150644757,
      geometry: [
        {lat: 46.68233, lon: 7.851536},
        {lat: 46.682344, lon: 7.851412}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 150872304,
      geometry: [
        {lat: 46.67986, lon: 7.853199},
        {lat: 46.68014, lon: 7.852909},
        {lat: 46.680325, lon: 7.85333}
      ],
      tags: {highway: 'service', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 150872313,
      geometry: [
        {lat: 46.681059, lon: 7.852056},
        {lat: 46.680737, lon: 7.852376},
        {lat: 46.680604, lon: 7.852568},
        {lat: 46.680522, lon: 7.852591},
        {lat: 46.680455, lon: 7.852653}
      ],
      tags: {highway: 'service', surface: 'paving_stones'}
    },
    {
      type: 'way',
      id: 150872314,
      geometry: [
        {lat: 46.680738, lon: 7.852443},
        {lat: 46.680891, lon: 7.852774},
        {lat: 46.680728, lon: 7.852942}
      ],
      tags: {highway: 'footway', surface: 'paving_stones'}
    },
    {
      type: 'way',
      id: 150872316,
      geometry: [
        {lat: 46.681315, lon: 7.852658},
        {lat: 46.681234, lon: 7.852732},
        {lat: 46.681078, lon: 7.852875}
      ],
      tags: {highway: 'service', surface: 'paving_stones'}
    },
    {
      type: 'way',
      id: 150872317,
      geometry: [
        {lat: 46.680934, lon: 7.852965},
        {lat: 46.680859, lon: 7.852807}
      ],
      tags: {highway: 'footway', surface: 'paving_stones'}
    },
    {
      type: 'way',
      id: 150872318,
      geometry: [
        {lat: 46.681078, lon: 7.852875},
        {lat: 46.680934, lon: 7.852965},
        {lat: 46.680897, lon: 7.853004}
      ],
      tags: {highway: 'footway', surface: 'paving_stones'}
    },
    {
      type: 'way',
      id: 151053231,
      geometry: [
        {lat: 46.680528, lon: 7.852346},
        {lat: 46.680908, lon: 7.852013},
        {lat: 46.681012, lon: 7.851922}
      ],
      tags: {highway: 'service', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 152081643,
      geometry: [
        {lat: 46.687445, lon: 7.872784},
        {lat: 46.687374, lon: 7.872317},
        {lat: 46.687347, lon: 7.872145},
        {lat: 46.687228, lon: 7.871357},
        {lat: 46.687136, lon: 7.870749},
        {lat: 46.687101, lon: 7.870669},
        {lat: 46.687042, lon: 7.870597},
        {lat: 46.686974, lon: 7.870563},
        {lat: 46.686879, lon: 7.870556},
        {lat: 46.686306, lon: 7.870625}
      ],
      tags: {
        highway: 'residential',
        surface: 'asphalt',
        name: 'Mittengrabenstrasse'
      }
    },
    {
      type: 'way',
      id: 152196650,
      geometry: [
        {lat: 46.676745, lon: 7.865398},
        {lat: 46.677052, lon: 7.865204},
        {lat: 46.677431, lon: 7.864963},
        {lat: 46.677569, lon: 7.864852}
      ],
      tags: {
        highway: 'secondary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Gsteigstrasse'
      }
    },
    {
      type: 'way',
      id: 152196652,
      geometry: [
        {lat: 46.687385, lon: 7.869643},
        {lat: 46.687444, lon: 7.869612}
      ],
      tags: {
        highway: 'primary',
        lanes: '1',
        surface: 'asphalt',
        name: 'Kreisel Lindenallee'
      }
    },
    {
      type: 'way',
      id: 152196657,
      geometry: [
        {lat: 46.688485, lon: 7.876745},
        {lat: 46.688435, lon: 7.876808},
        {lat: 46.688424, lon: 7.876854}
      ],
      tags: {
        highway: 'primary',
        lanes: '1',
        surface: 'asphalt',
        name: 'Aldi-Kreisel'
      }
    },
    {
      type: 'way',
      id: 152196660,
      geometry: [
        {lat: 46.686524, lon: 7.845356},
        {lat: 46.686387, lon: 7.845506},
        {lat: 46.686332, lon: 7.845574},
        {lat: 46.686287, lon: 7.845639},
        {lat: 46.68622, lon: 7.845754},
        {lat: 46.686174, lon: 7.84584},
        {lat: 46.68609, lon: 7.846015},
        {lat: 46.686033, lon: 7.84613},
        {lat: 46.68599, lon: 7.846218},
        {lat: 46.685865, lon: 7.84648},
        {lat: 46.685588, lon: 7.847115},
        {lat: 46.685523, lon: 7.847281},
        {lat: 46.685423, lon: 7.84755},
        {lat: 46.685295, lon: 7.847893},
        {lat: 46.68525, lon: 7.847985},
        {lat: 46.685167, lon: 7.848117}
      ],
      tags: {
        highway: 'tertiary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Scheidgasse'
      }
    },
    {
      type: 'way',
      id: 152196661,
      geometry: [
        {lat: 46.687976, lon: 7.848045},
        {lat: 46.687994, lon: 7.847923},
        {lat: 46.688044, lon: 7.847548},
        {lat: 46.688076, lon: 7.847309},
        {lat: 46.688108, lon: 7.847049},
        {lat: 46.688118, lon: 7.846956},
        {lat: 46.688111, lon: 7.846743},
        {lat: 46.688098, lon: 7.846576},
        {lat: 46.688042, lon: 7.845928},
        {lat: 46.687989, lon: 7.845389},
        {lat: 46.68797, lon: 7.845175},
        {lat: 46.687981, lon: 7.844985},
        {lat: 46.688001, lon: 7.844882},
        {lat: 46.688044, lon: 7.844722},
        {lat: 46.688105, lon: 7.844502},
        {lat: 46.688163, lon: 7.844304},
        {lat: 46.688194, lon: 7.844197},
        {lat: 46.688279, lon: 7.843929},
        {lat: 46.688306, lon: 7.843844},
        {lat: 46.688351, lon: 7.843699},
        {lat: 46.688362, lon: 7.843598},
        {lat: 46.688293, lon: 7.843449}
      ],
      tags: {
        highway: 'residential',
        surface: 'asphalt',
        name: 'Beatenbergstrasse'
      }
    },
    {
      type: 'way',
      id: 152196665,
      geometry: [
        {lat: 46.677397, lon: 7.869429},
        {lat: 46.677135, lon: 7.869445},
        {lat: 46.676653, lon: 7.869477},
        {lat: 46.676434, lon: 7.869495},
        {lat: 46.676267, lon: 7.869497},
        {lat: 46.675718, lon: 7.869596},
        {lat: 46.675452, lon: 7.869644},
        {lat: 46.675402, lon: 7.869654}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Hertigässli'
      }
    },
    {
      type: 'way',
      id: 152460858,
      geometry: [
        {lat: 46.683867, lon: 7.857409},
        {lat: 46.683808, lon: 7.857372},
        {lat: 46.683757, lon: 7.857341},
        {lat: 46.683645, lon: 7.857266},
        {lat: 46.683568, lon: 7.857231},
        {lat: 46.683482, lon: 7.857203},
        {lat: 46.683391, lon: 7.857187},
        {lat: 46.683294, lon: 7.857181},
        {lat: 46.683202, lon: 7.857185},
        {lat: 46.683052, lon: 7.8572}
      ],
      tags: {
        highway: 'tertiary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Waldeggstrasse'
      }
    },
    {
      type: 'way',
      id: 152460862,
      geometry: [
        {lat: 46.68194, lon: 7.862027},
        {lat: 46.682039, lon: 7.862006},
        {lat: 46.682237, lon: 7.861948},
        {lat: 46.682634, lon: 7.861808},
        {lat: 46.682827, lon: 7.86174},
        {lat: 46.683108, lon: 7.861658},
        {lat: 46.683373, lon: 7.86158},
        {lat: 46.683575, lon: 7.861527},
        {lat: 46.683824, lon: 7.861463},
        {lat: 46.68402, lon: 7.861416},
        {lat: 46.684124, lon: 7.861395},
        {lat: 46.684215, lon: 7.861378},
        {lat: 46.68434, lon: 7.861373},
        {lat: 46.684462, lon: 7.861383},
        {lat: 46.684547, lon: 7.861405},
        {lat: 46.684573, lon: 7.861412}
      ],
      tags: {
        highway: 'primary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Parkstrasse'
      }
    },
    {
      type: 'way',
      id: 153540341,
      geometry: [
        {lat: 46.685167, lon: 7.848117},
        {lat: 46.685179, lon: 7.848194},
        {lat: 46.685171, lon: 7.848284},
        {lat: 46.685162, lon: 7.848325}
      ],
      tags: {
        highway: 'secondary',
        lanes: '2',
        surface: 'asphalt',
        name: 'Raeuberegge'
      }
    },
    {
      type: 'way',
      id: 158754110,
      geometry: [
        {lat: 46.679796, lon: 7.850646},
        {lat: 46.679803, lon: 7.850572}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 158754113,
      geometry: [
        {lat: 46.680473, lon: 7.850695},
        {lat: 46.680578, lon: 7.85079},
        {lat: 46.680577, lon: 7.850805}
      ],
      tags: {highway: 'footway'}
    },
    {
      type: 'way',
      id: 163201717,
      geometry: [
        {lat: 46.68681, lon: 7.853423},
        {lat: 46.686886, lon: 7.853499},
        {lat: 46.686987, lon: 7.853578},
        {lat: 46.687087, lon: 7.853674},
        {lat: 46.687437, lon: 7.853976},
        {lat: 46.687479, lon: 7.854034},
        {lat: 46.687507, lon: 7.854159}
      ],
      tags: {
        highway: 'residential',
        lanes: '1',
        surface: 'asphalt',
        name: 'Postgasse'
      }
    },
    {
      type: 'way',
      id: 164919954,
      geometry: [
        {lat: 46.682939, lon: 7.851832},
        {lat: 46.68295, lon: 7.851726},
        {lat: 46.682961, lon: 7.851624}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 166928723,
      geometry: [
        {lat: 46.685088, lon: 7.854813},
        {lat: 46.685185, lon: 7.854749},
        {lat: 46.685245, lon: 7.854708},
        {lat: 46.685256, lon: 7.8547}
      ],
      tags: {highway: 'service', lanes: '1', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 168164749,
      geometry: [
        {lat: 46.67825, lon: 7.851822},
        {lat: 46.678026, lon: 7.851234},
        {lat: 46.677943, lon: 7.851024}
      ],
      tags: {
        highway: 'service',
        lanes: '1',
        surface: 'asphalt',
        name: 'Rugenparkstrasse'
      }
    },
    {
      type: 'way',
      id: 168164754,
      geometry: [
        {lat: 46.677811, lon: 7.852179},
        {lat: 46.677898, lon: 7.852073},
        {lat: 46.677943, lon: 7.852011},
        {lat: 46.677951, lon: 7.851928},
        {lat: 46.677916, lon: 7.851855},
        {lat: 46.677861, lon: 7.851771},
        {lat: 46.677792, lon: 7.851764},
        {lat: 46.677663, lon: 7.851916}
      ],
      tags: {highway: 'service', surface: 'asphalt', name: 'Waldeggstrasse'}
    },
    {
      type: 'way',
      id: 168166545,
      geometry: [
        {lat: 46.681653, lon: 7.856327},
        {lat: 46.681752, lon: 7.856757},
        {lat: 46.681783, lon: 7.856873},
        {lat: 46.681784, lon: 7.856978}
      ],
      tags: {highway: 'footway', surface: 'pebblestone'}
    },
    {
      type: 'way',
      id: 168166546,
      geometry: [
        {lat: 46.681825, lon: 7.856984},
        {lat: 46.681812, lon: 7.856793},
        {lat: 46.68176, lon: 7.85679}
      ],
      tags: {highway: 'footway', surface: 'paving_stones'}
    },
    {
      type: 'way',
      id: 168574609,
      geometry: [
        {lat: 46.690096, lon: 7.869562},
        {lat: 46.69012, lon: 7.869664}
      ],
      tags: {
        highway: 'residential',
        surface: 'asphalt',
        name: 'Untere Bönigstrasse'
      }
    },
    {
      type: 'way',
      id: 168576530,
      geometry: [
        {lat: 46.690252, lon: 7.868543},
        {lat: 46.690083, lon: 7.866696},
        {lat: 46.690149, lon: 7.866621}
      ],
      tags: {highway: 'footway'}
    },
    {
      type: 'way',
      id: 168783738,
      geometry: [
        {lat: 46.689491, lon: 7.879662},
        {lat: 46.689548, lon: 7.879633},
        {lat: 46.689604, lon: 7.879511},
        {lat: 46.689623, lon: 7.879379},
        {lat: 46.689649, lon: 7.878954},
        {lat: 46.689778, lon: 7.877376},
        {lat: 46.689786, lon: 7.877281},
        {lat: 46.689807, lon: 7.877009},
        {lat: 46.689842, lon: 7.876534},
        {lat: 46.689861, lon: 7.876345},
        {lat: 46.689888, lon: 7.876123},
        {lat: 46.689927, lon: 7.875888},
        {lat: 46.689997, lon: 7.875521},
        {lat: 46.690216, lon: 7.874524},
        {lat: 46.690249, lon: 7.874318},
        {lat: 46.690278, lon: 7.874089},
        {lat: 46.690297, lon: 7.873848},
        {lat: 46.690302, lon: 7.87368},
        {lat: 46.6903, lon: 7.873492},
        {lat: 46.690293, lon: 7.873243},
        {lat: 46.690287, lon: 7.873061},
        {lat: 46.690273, lon: 7.872744},
        {lat: 46.690263, lon: 7.872513},
        {lat: 46.690214, lon: 7.871447},
        {lat: 46.690183, lon: 7.870809},
        {lat: 46.690174, lon: 7.870495},
        {lat: 46.69017, lon: 7.870375},
        {lat: 46.690158, lon: 7.870068},
        {lat: 46.690153, lon: 7.87002}
      ],
      tags: {
        highway: 'residential',
        surface: 'asphalt',
        name: 'Untere Bönigstrasse'
      }
    },
    {
      type: 'way',
      id: 168786329,
      geometry: [
        {lat: 46.690692, lon: 7.867939},
        {lat: 46.690764, lon: 7.868095},
        {lat: 46.690916, lon: 7.86843},
        {lat: 46.691004, lon: 7.868624},
        {lat: 46.691095, lon: 7.868814}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Höheweg'}
    },
    {
      type: 'way',
      id: 168786330,
      geometry: [
        {lat: 46.691095, lon: 7.868814},
        {lat: 46.691136, lon: 7.8689},
        {lat: 46.691218, lon: 7.869087},
        {lat: 46.691285, lon: 7.869264},
        {lat: 46.69132, lon: 7.86939},
        {lat: 46.691372, lon: 7.869768},
        {lat: 46.691388, lon: 7.869918},
        {lat: 46.691472, lon: 7.870877},
        {lat: 46.691479, lon: 7.870955},
        {lat: 46.691485, lon: 7.871078}
      ],
      tags: {highway: 'residential', surface: 'asphalt', name: 'Kammistrasse'}
    },
    {
      type: 'way',
      id: 168798089,
      geometry: [
        {lat: 46.691879, lon: 7.879519},
        {lat: 46.691833, lon: 7.879433},
        {lat: 46.691691, lon: 7.879096},
        {lat: 46.691616, lon: 7.878901},
        {lat: 46.691588, lon: 7.878823},
        {lat: 46.691558, lon: 7.878724},
        {lat: 46.691495, lon: 7.878479},
        {lat: 46.691408, lon: 7.878115},
        {lat: 46.691349, lon: 7.877779},
        {lat: 46.691326, lon: 7.877588},
        {lat: 46.691318, lon: 7.877475},
        {lat: 46.691315, lon: 7.877222},
        {lat: 46.691323, lon: 7.877135},
        {lat: 46.69135, lon: 7.877054}
      ],
      tags: {highway: 'track'}
    },
    {
      type: 'way',
      id: 168798098,
      geometry: [
        {lat: 46.689828, lon: 7.873899},
        {lat: 46.689896, lon: 7.873895},
        {lat: 46.689957, lon: 7.873863},
        {lat: 46.690012, lon: 7.87381},
        {lat: 46.690052, lon: 7.873723},
        {lat: 46.690058, lon: 7.873637},
        {lat: 46.690021, lon: 7.873501},
        {lat: 46.690064, lon: 7.873401},
        {lat: 46.690218, lon: 7.873286},
        {lat: 46.690267, lon: 7.873242},
        {lat: 46.690292, lon: 7.873221}
      ],
      tags: {highway: 'cycleway'}
    },
    {
      type: 'way',
      id: 168798100,
      geometry: [
        {lat: 46.690085, lon: 7.873513},
        {lat: 46.690298, lon: 7.873309},
        {lat: 46.690562, lon: 7.873082},
        {lat: 46.690696, lon: 7.872978},
        {lat: 46.691009, lon: 7.872755},
        {lat: 46.691216, lon: 7.872628},
        {lat: 46.691445, lon: 7.872497},
        {lat: 46.691622, lon: 7.872409},
        {lat: 46.691879, lon: 7.872288},
        {lat: 46.694083, lon: 7.871332},
        {lat: 46.694169, lon: 7.8713},
        {lat: 46.694317, lon: 7.871262},
        {lat: 46.694428, lon: 7.871262}
      ],
      tags: {
        highway: 'primary',
        lanes: '2',
        surface: 'asphalt',
        bridge: 'viaduct',
        name: 'Goldswil-Viadukt'
      }
    },
    {
      type: 'way',
      id: 168798162,
      geometry: [
        {lat: 46.691126, lon: 7.869417},
        {lat: 46.691156, lon: 7.869409}
      ],
      tags: {highway: 'footway'}
    },
    {
      type: 'way',
      id: 168798173,
      geometry: [
        {lat: 46.690565, lon: 7.869518},
        {lat: 46.690715, lon: 7.869517},
        {lat: 46.690854, lon: 7.869483},
        {lat: 46.69103, lon: 7.86944},
        {lat: 46.691126, lon: 7.869417}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 168798184,
      geometry: [
        {lat: 46.691169, lon: 7.869347},
        {lat: 46.691156, lon: 7.869225},
        {lat: 46.69114, lon: 7.869414}
      ],
      tags: {highway: 'footway'}
    },
    {
      type: 'way',
      id: 168798186,
      geometry: [
        {lat: 46.690489, lon: 7.869641},
        {lat: 46.690463, lon: 7.869418}
      ],
      tags: {highway: 'footway', surface: 'asphalt'}
    },
    {
      type: 'way',
      id: 168801494,
      geometry: [
        {lat: 46.690565, lon: 7.869518},
        {lat: 46.690552, lon: 7.86941}
      ],
      tags: {highway: 'steps'}
    },
    {
      type: 'way',
      id: 168801496,
      geometry: [
        {lat: 46.691156, lon: 7.869409},
        {lat: 46.691194, lon: 7.8694}
      ],
      tags: {highway: 'steps'}
    }
  ]
};
