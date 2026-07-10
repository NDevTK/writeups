// Captured Overpass response (maps.mail.ru mirror, 2026-07-10):
// way[aerialway~cable_car|gondola|mixed_lift|chair_lift]
// (46.55,7.7,46.8,8.1);out geom 100; - the real aerial
// installations of the Jungfrau region: the Schilthorn
// cable cars (Stechelberg-Gimmelwald, Birg-Schilthorn),
// Beatenberg-Niederhorn, the Firstbahn, Wengen-Maennlichen.
// Tags trimmed to aerialway/name/duration; coordinates 6 dp;
// geometry NOT thinned - the way nodes are the pylon
// positions and every one is structural. Census: 44 ways
// (25 chair_lift, 11 cable_car, 8 gondola), 43 named.
export const AERIAL_FIXTURE = {
  elements: [
    {
      type: 'way',
      id: 4809574,
      geometry: [
        {lat: 46.585498, lon: 7.723433},
        {lat: 46.58547, lon: 7.723361},
        {lat: 46.585083, lon: 7.72237},
        {lat: 46.584423, lon: 7.720667},
        {lat: 46.583893, lon: 7.719299},
        {lat: 46.583426, lon: 7.718096},
        {lat: 46.582742, lon: 7.716327},
        {lat: 46.582309, lon: 7.715212},
        {lat: 46.581637, lon: 7.713482},
        {lat: 46.580797, lon: 7.711311},
        {lat: 46.580021, lon: 7.709309},
        {lat: 46.579824, lon: 7.708796},
        {lat: 46.579668, lon: 7.70839}
      ],
      tags: {aerialway: 'chair_lift', name: 'Sesselbahn Kiental-Ramslauenen'}
    },
    {
      type: 'way',
      id: 24668922,
      geometry: [
        {lat: 46.690605, lon: 7.765478},
        {lat: 46.69074, lon: 7.765539},
        {lat: 46.691193, lon: 7.765761},
        {lat: 46.691822, lon: 7.766065},
        {lat: 46.694446, lon: 7.767339},
        {lat: 46.700398, lon: 7.770221},
        {lat: 46.700519, lon: 7.770281},
        {lat: 46.700574, lon: 7.770308},
        {lat: 46.701832, lon: 7.770919},
        {lat: 46.707028, lon: 7.773436},
        {lat: 46.709501, lon: 7.774635},
        {lat: 46.71033, lon: 7.775039},
        {lat: 46.710554, lon: 7.775148}
      ],
      tags: {aerialway: 'gondola', name: 'Luftseilbahn Beatenberg-Niederhorn'}
    },
    {
      type: 'way',
      id: 25010804,
      geometry: [
        {lat: 46.555113, lon: 7.901784},
        {lat: 46.54775, lon: 7.894255},
        {lat: 46.547058, lon: 7.893554}
      ],
      tags: {aerialway: 'cable_car', name: 'Stechelberg – Gimmelwald'}
    },
    {
      type: 'way',
      id: 25010926,
      geometry: [
        {lat: 46.56176, lon: 7.857277},
        {lat: 46.55743, lon: 7.835772},
        {lat: 46.55736, lon: 7.835378}
      ],
      tags: {aerialway: 'cable_car', name: 'Birg - Schlithorn'}
    },
    {
      type: 'way',
      id: 25075912,
      geometry: [
        {lat: 46.606252, lon: 7.921495},
        {lat: 46.61182, lon: 7.937165},
        {lat: 46.613164, lon: 7.940946}
      ],
      tags: {aerialway: 'cable_car', name: 'Wengen LWM'}
    },
    {
      type: 'way',
      id: 25076446,
      geometry: [
        {lat: 46.598768, lon: 7.907198},
        {lat: 46.598673, lon: 7.906473},
        {lat: 46.598234, lon: 7.903198},
        {lat: 46.597218, lon: 7.895628},
        {lat: 46.596669, lon: 7.891561},
        {lat: 46.596583, lon: 7.890919}
      ],
      tags: {aerialway: 'cable_car', name: 'Mürrenbahn'}
    },
    {
      type: 'way',
      id: 25076686,
      geometry: [
        {lat: 46.625023, lon: 8.041783},
        {lat: 46.62531, lon: 8.041831},
        {lat: 46.626334, lon: 8.042018},
        {lat: 46.627486, lon: 8.042177},
        {lat: 46.62868, lon: 8.042341},
        {lat: 46.630142, lon: 8.042542},
        {lat: 46.632249, lon: 8.042832},
        {lat: 46.633326, lon: 8.04298},
        {lat: 46.634157, lon: 8.043094},
        {lat: 46.634643, lon: 8.043167},
        {lat: 46.63589, lon: 8.044052},
        {lat: 46.637246, lon: 8.045012},
        {lat: 46.639234, lon: 8.046418},
        {lat: 46.640271, lon: 8.047152},
        {lat: 46.641222, lon: 8.047825},
        {lat: 46.643076, lon: 8.049137},
        {lat: 46.643787, lon: 8.04964},
        {lat: 46.645308, lon: 8.050717},
        {lat: 46.646301, lon: 8.05142},
        {lat: 46.646756, lon: 8.051765}
      ],
      tags: {aerialway: 'gondola', name: 'Firstbahn'}
    },
    {
      type: 'way',
      id: 25076692,
      geometry: [
        {lat: 46.661377, lon: 8.05296},
        {lat: 46.662849, lon: 8.052981},
        {lat: 46.663043, lon: 8.052982},
        {lat: 46.664241, lon: 8.052986},
        {lat: 46.664893, lon: 8.052988},
        {lat: 46.665773, lon: 8.052991},
        {lat: 46.667121, lon: 8.052995},
        {lat: 46.66835, lon: 8.052999},
        {lat: 46.669018, lon: 8.053001},
        {lat: 46.670096, lon: 8.053005},
        {lat: 46.671324, lon: 8.053009},
        {lat: 46.673129, lon: 8.053015},
        {lat: 46.674132, lon: 8.053018},
        {lat: 46.674466, lon: 8.053004}
      ],
      tags: {aerialway: 'chair_lift', name: 'Oberjoch'}
    },
    {
      type: 'way',
      id: 25076711,
      geometry: [
        {lat: 46.623122, lon: 8.047001},
        {lat: 46.61781, lon: 8.055802},
        {lat: 46.617438, lon: 8.05642}
      ],
      tags: {aerialway: 'cable_car', name: 'Pfingsteggbahn'}
    },
    {
      type: 'way',
      id: 25936973,
      geometry: [
        {lat: 46.718563, lon: 8.03741},
        {lat: 46.717659, lon: 8.037838},
        {lat: 46.715013, lon: 8.039092},
        {lat: 46.713605, lon: 8.039759},
        {lat: 46.712182, lon: 8.040433},
        {lat: 46.711565, lon: 8.040724},
        {lat: 46.710888, lon: 8.041045},
        {lat: 46.71017, lon: 8.041385},
        {lat: 46.709742, lon: 8.041588}
      ],
      tags: {aerialway: 'chair_lift', name: 'Sesselbahn Windegg'}
    },
    {
      type: 'way',
      id: 27255186,
      geometry: [
        {lat: 46.624701, lon: 8.01855},
        {lat: 46.624681, lon: 8.018298},
        {lat: 46.624667, lon: 8.01813},
        {lat: 46.624465, lon: 8.015606},
        {lat: 46.624226, lon: 8.012829},
        {lat: 46.62396, lon: 8.009687},
        {lat: 46.623718, lon: 8.006899},
        {lat: 46.623418, lon: 8.00332},
        {lat: 46.623167, lon: 8.000639},
        {lat: 46.623024, lon: 7.998824},
        {lat: 46.622757, lon: 7.995839},
        {lat: 46.622544, lon: 7.993255},
        {lat: 46.622364, lon: 7.991315},
        {lat: 46.622142, lon: 7.988679},
        {lat: 46.621904, lon: 7.98587},
        {lat: 46.62167, lon: 7.983195},
        {lat: 46.621374, lon: 7.979669},
        {lat: 46.621367, lon: 7.979593},
        {lat: 46.621337, lon: 7.97924}
      ],
      tags: {aerialway: 'gondola', name: 'Männlichenbahn'}
    },
    {
      type: 'way',
      id: 27365628,
      geometry: [
        {lat: 46.572769, lon: 7.949824},
        {lat: 46.574001, lon: 7.949573},
        {lat: 46.575322, lon: 7.949304},
        {lat: 46.576524, lon: 7.949059},
        {lat: 46.57774, lon: 7.948812},
        {lat: 46.578918, lon: 7.948572},
        {lat: 46.580054, lon: 7.948341},
        {lat: 46.581004, lon: 7.948147},
        {lat: 46.582172, lon: 7.94791},
        {lat: 46.583464, lon: 7.947647},
        {lat: 46.584744, lon: 7.947386},
        {lat: 46.585774, lon: 7.947177},
        {lat: 46.58623, lon: 7.947084},
        {lat: 46.586647, lon: 7.946999}
      ],
      tags: {aerialway: 'chair_lift', name: 'Wixi'}
    },
    {
      type: 'way',
      id: 27365636,
      geometry: [
        {lat: 46.58617, lon: 7.959892},
        {lat: 46.586334, lon: 7.959493},
        {lat: 46.586473, lon: 7.959156},
        {lat: 46.586739, lon: 7.958509},
        {lat: 46.587285, lon: 7.957182},
        {lat: 46.587695, lon: 7.956187},
        {lat: 46.587974, lon: 7.95551},
        {lat: 46.588511, lon: 7.954205},
        {lat: 46.589263, lon: 7.952377},
        {lat: 46.590042, lon: 7.950485},
        {lat: 46.590633, lon: 7.949008},
        {lat: 46.590773, lon: 7.948672}
      ],
      tags: {aerialway: 'chair_lift', name: 'Lauberhorn'}
    },
    {
      type: 'way',
      id: 27365638,
      geometry: [
        {lat: 46.589653, lon: 7.973153},
        {lat: 46.589412, lon: 7.972142},
        {lat: 46.589083, lon: 7.97076},
        {lat: 46.588611, lon: 7.968776},
        {lat: 46.588276, lon: 7.967369},
        {lat: 46.587998, lon: 7.966203},
        {lat: 46.587679, lon: 7.964862},
        {lat: 46.587457, lon: 7.963933},
        {lat: 46.587131, lon: 7.962564},
        {lat: 46.586911, lon: 7.961552},
        {lat: 46.586831, lon: 7.961179}
      ],
      tags: {aerialway: 'chair_lift', name: 'Arven'}
    },
    {
      type: 'way',
      id: 30080579,
      geometry: [
        {lat: 46.618142, lon: 7.96448},
        {lat: 46.618082, lon: 7.964203},
        {lat: 46.617978, lon: 7.963724},
        {lat: 46.617652, lon: 7.962229},
        {lat: 46.617038, lon: 7.959366},
        {lat: 46.616772, lon: 7.958128},
        {lat: 46.616367, lon: 7.95624},
        {lat: 46.615907, lon: 7.954093},
        {lat: 46.615458, lon: 7.952002},
        {lat: 46.61512, lon: 7.950424},
        {lat: 46.614739, lon: 7.948649},
        {lat: 46.614346, lon: 7.946816},
        {lat: 46.614204, lon: 7.946156},
        {lat: 46.614035, lon: 7.945369},
        {lat: 46.613741, lon: 7.943996},
        {lat: 46.613613, lon: 7.9434},
        {lat: 46.613511, lon: 7.942925},
        {lat: 46.613425, lon: 7.942523},
        {lat: 46.613326, lon: 7.94206}
      ],
      tags: {aerialway: 'chair_lift', name: 'Sesselbahn Männlichen'}
    },
    {
      type: 'way',
      id: 30080631,
      geometry: [
        {lat: 46.617148, lon: 7.966704},
        {lat: 46.61702, lon: 7.966458},
        {lat: 46.616716, lon: 7.96587},
        {lat: 46.616222, lon: 7.964924},
        {lat: 46.615494, lon: 7.963534},
        {lat: 46.614744, lon: 7.962095},
        {lat: 46.614309, lon: 7.961264},
        {lat: 46.613907, lon: 7.960486},
        {lat: 46.613149, lon: 7.959015},
        {lat: 46.612411, lon: 7.9576},
        {lat: 46.611569, lon: 7.955988},
        {lat: 46.610718, lon: 7.954366},
        {lat: 46.61043, lon: 7.953812},
        {lat: 46.609643, lon: 7.952311},
        {lat: 46.608915, lon: 7.950917},
        {lat: 46.608084, lon: 7.949308},
        {lat: 46.607145, lon: 7.947523},
        {lat: 46.606314, lon: 7.945923},
        {lat: 46.606274, lon: 7.945846},
        {lat: 46.6061, lon: 7.945503}
      ],
      tags: {aerialway: 'chair_lift', name: 'Läger'}
    },
    {
      type: 'way',
      id: 30080639,
      geometry: [
        {lat: 46.604772, lon: 7.960274},
        {lat: 46.604277, lon: 7.960172},
        {lat: 46.602721, lon: 7.959849},
        {lat: 46.60182, lon: 7.959662},
        {lat: 46.60062, lon: 7.959413},
        {lat: 46.599314, lon: 7.959142},
        {lat: 46.599026, lon: 7.959082}
      ],
      tags: {aerialway: 'chair_lift', name: 'Gummi'}
    },
    {
      type: 'way',
      id: 30080668,
      geometry: [
        {lat: 46.59027, lon: 7.973979},
        {lat: 46.590565, lon: 7.973278},
        {lat: 46.591285, lon: 7.971572},
        {lat: 46.59179, lon: 7.970373},
        {lat: 46.592206, lon: 7.969386},
        {lat: 46.592971, lon: 7.967571},
        {lat: 46.593758, lon: 7.965705},
        {lat: 46.594516, lon: 7.963907},
        {lat: 46.595208, lon: 7.962266},
        {lat: 46.595604, lon: 7.961325},
        {lat: 46.596228, lon: 7.959846},
        {lat: 46.596977, lon: 7.95807},
        {lat: 46.598034, lon: 7.955562},
        {lat: 46.598177, lon: 7.955222}
      ],
      tags: {aerialway: 'chair_lift', name: 'Honegg'}
    },
    {
      type: 'way',
      id: 30080764,
      geometry: [
        {lat: 46.594181, lon: 7.923692},
        {lat: 46.59407, lon: 7.924639},
        {lat: 46.593829, lon: 7.926705},
        {lat: 46.593696, lon: 7.927837},
        {lat: 46.593444, lon: 7.929992},
        {lat: 46.593377, lon: 7.930566},
        {lat: 46.593301, lon: 7.931219}
      ],
      tags: {aerialway: 'chair_lift', name: 'Innerwengen'}
    },
    {
      type: 'way',
      id: 31342258,
      geometry: [
        {lat: 46.660168, lon: 8.066809},
        {lat: 46.661391, lon: 8.066561},
        {lat: 46.662284, lon: 8.06638},
        {lat: 46.663002, lon: 8.066235},
        {lat: 46.66372, lon: 8.066089},
        {lat: 46.66489, lon: 8.065852},
        {lat: 46.666397, lon: 8.065547},
        {lat: 46.667819, lon: 8.065259},
        {lat: 46.669351, lon: 8.064948},
        {lat: 46.670016, lon: 8.064813},
        {lat: 46.671384, lon: 8.064536},
        {lat: 46.672544, lon: 8.064303},
        {lat: 46.673721, lon: 8.064067},
        {lat: 46.674266, lon: 8.063952}
      ],
      tags: {aerialway: 'chair_lift', name: 'Schilt'}
    },
    {
      type: 'way',
      id: 31342426,
      geometry: [
        {lat: 46.654908, lon: 8.073712},
        {lat: 46.655038, lon: 8.073499},
        {lat: 46.656046, lon: 8.071972},
        {lat: 46.657052, lon: 8.070458},
        {lat: 46.657922, lon: 8.069152},
        {lat: 46.658875, lon: 8.067718},
        {lat: 46.659757, lon: 8.066392},
        {lat: 46.660709, lon: 8.06496},
        {lat: 46.661082, lon: 8.064364},
        {lat: 46.661272, lon: 8.064039}
      ],
      tags: {aerialway: 'chair_lift', name: 'Grindel'}
    },
    {
      type: 'way',
      id: 34723029,
      geometry: [
        {lat: 46.620391, lon: 7.895126},
        {lat: 46.621808, lon: 7.891815},
        {lat: 46.622648, lon: 7.88985},
        {lat: 46.622885, lon: 7.889295},
        {lat: 46.623396, lon: 7.888117}
      ],
      tags: {aerialway: 'cable_car', name: 'Luftseilbahn Isenfluh-Sulwald'}
    },
    {
      type: 'way',
      id: 48554861,
      geometry: [
        {lat: 46.808035, lon: 8.035565},
        {lat: 46.807913, lon: 8.035337},
        {lat: 46.807569, lon: 8.034702},
        {lat: 46.80679, lon: 8.033301},
        {lat: 46.80584, lon: 8.031607},
        {lat: 46.805239, lon: 8.030498},
        {lat: 46.804259, lon: 8.028729},
        {lat: 46.803546, lon: 8.027431},
        {lat: 46.802658, lon: 8.025814},
        {lat: 46.80182, lon: 8.024289},
        {lat: 46.801026, lon: 8.022845},
        {lat: 46.800242, lon: 8.021417},
        {lat: 46.799535, lon: 8.020132},
        {lat: 46.799487, lon: 8.020043},
        {lat: 46.799413, lon: 8.019909}
      ],
      tags: {aerialway: 'chair_lift'}
    },
    {
      type: 'way',
      id: 48923363,
      geometry: [
        {lat: 46.807619, lon: 8.059638},
        {lat: 46.801099, lon: 8.054827},
        {lat: 46.799226, lon: 8.05344},
        {lat: 46.787988, lon: 8.045047},
        {lat: 46.78727, lon: 8.044484}
      ],
      tags: {
        aerialway: 'cable_car',
        name: 'Luftseilbahn Sörenberg-Brienzer Rothorn'
      }
    },
    {
      type: 'way',
      id: 52329528,
      geometry: [
        {lat: 46.590454, lon: 7.974355},
        {lat: 46.589832, lon: 7.97434},
        {lat: 46.588287, lon: 7.974429},
        {lat: 46.58745, lon: 7.974478},
        {lat: 46.585184, lon: 7.974609},
        {lat: 46.583847, lon: 7.974686},
        {lat: 46.582236, lon: 7.974779},
        {lat: 46.580559, lon: 7.974876},
        {lat: 46.579906, lon: 7.974914},
        {lat: 46.579234, lon: 7.974953},
        {lat: 46.578068, lon: 7.97502},
        {lat: 46.576819, lon: 7.975092},
        {lat: 46.575421, lon: 7.975186}
      ],
      tags: {aerialway: 'chair_lift', name: 'Eigernordwand'}
    },
    {
      type: 'way',
      id: 80185902,
      geometry: [
        {lat: 46.791089, lon: 8.060798},
        {lat: 46.790925, lon: 8.060215},
        {lat: 46.790556, lon: 8.058876},
        {lat: 46.790246, lon: 8.057748},
        {lat: 46.789717, lon: 8.055834},
        {lat: 46.78927, lon: 8.054264},
        {lat: 46.78884, lon: 8.052737},
        {lat: 46.788313, lon: 8.050842},
        {lat: 46.788023, lon: 8.049817},
        {lat: 46.787894, lon: 8.049375},
        {lat: 46.787847, lon: 8.049212}
      ],
      tags: {aerialway: 'chair_lift', name: 'Eisee - Brienzer Rothorn'}
    },
    {
      type: 'way',
      id: 150258430,
      geometry: [
        {lat: 46.569223, lon: 7.863417},
        {lat: 46.569043, lon: 7.863257},
        {lat: 46.568936, lon: 7.863163},
        {lat: 46.568089, lon: 7.862416},
        {lat: 46.567567, lon: 7.861956},
        {lat: 46.566562, lon: 7.861069},
        {lat: 46.566091, lon: 7.860653},
        {lat: 46.56491, lon: 7.859611},
        {lat: 46.563654, lon: 7.858504},
        {lat: 46.562271, lon: 7.857283},
        {lat: 46.562155, lon: 7.857181},
        {lat: 46.561908, lon: 7.856963}
      ],
      tags: {aerialway: 'chair_lift', name: 'Riggli'}
    },
    {
      type: 'way',
      id: 150259405,
      geometry: [
        {lat: 46.566933, lon: 7.868933},
        {lat: 46.566976, lon: 7.868891},
        {lat: 46.56738, lon: 7.868483},
        {lat: 46.568562, lon: 7.86729},
        {lat: 46.569351, lon: 7.866494},
        {lat: 46.570146, lon: 7.865692},
        {lat: 46.570661, lon: 7.865172},
        {lat: 46.57075, lon: 7.865082},
        {lat: 46.570922, lon: 7.864908},
        {lat: 46.570966, lon: 7.864864}
      ],
      tags: {aerialway: 'chair_lift', name: 'Muttleren'}
    },
    {
      type: 'way',
      id: 150259832,
      geometry: [
        {lat: 46.56892, lon: 7.877107},
        {lat: 46.569153, lon: 7.875749},
        {lat: 46.569386, lon: 7.87439},
        {lat: 46.569458, lon: 7.873966},
        {lat: 46.569522, lon: 7.873594},
        {lat: 46.569617, lon: 7.873041},
        {lat: 46.569804, lon: 7.871947},
        {lat: 46.570017, lon: 7.870707},
        {lat: 46.570224, lon: 7.869495},
        {lat: 46.57055, lon: 7.867592},
        {lat: 46.570698, lon: 7.866727},
        {lat: 46.5709, lon: 7.865548},
        {lat: 46.570994, lon: 7.865001},
        {lat: 46.571008, lon: 7.864924}
      ],
      tags: {aerialway: 'chair_lift', name: 'Kandahar'}
    },
    {
      type: 'way',
      id: 150268906,
      geometry: [
        {lat: 46.566269, lon: 7.889311},
        {lat: 46.56635, lon: 7.889282},
        {lat: 46.566619, lon: 7.889184},
        {lat: 46.568029, lon: 7.888661},
        {lat: 46.569002, lon: 7.888304},
        {lat: 46.569714, lon: 7.888074},
        {lat: 46.570478, lon: 7.887772},
        {lat: 46.570561, lon: 7.887734}
      ],
      tags: {aerialway: 'chair_lift', name: 'Maulerhubel'}
    },
    {
      type: 'way',
      id: 150270143,
      geometry: [
        {lat: 46.5815, lon: 7.895727},
        {lat: 46.581416, lon: 7.895665},
        {lat: 46.580466, lon: 7.894959},
        {lat: 46.579019, lon: 7.893883},
        {lat: 46.577935, lon: 7.893077},
        {lat: 46.577031, lon: 7.892405},
        {lat: 46.57616, lon: 7.891757},
        {lat: 46.575786, lon: 7.891479},
        {lat: 46.574785, lon: 7.890735},
        {lat: 46.574644, lon: 7.89063},
        {lat: 46.573572, lon: 7.889833},
        {lat: 46.57211, lon: 7.888746},
        {lat: 46.571068, lon: 7.887972},
        {lat: 46.570885, lon: 7.887836},
        {lat: 46.570792, lon: 7.887767}
      ],
      tags: {aerialway: 'chair_lift', name: 'Winteregg'}
    },
    {
      type: 'way',
      id: 154475630,
      geometry: [
        {lat: 46.566276, lon: 7.888915},
        {lat: 46.566065, lon: 7.888738},
        {lat: 46.56487, lon: 7.887733},
        {lat: 46.564377, lon: 7.887319},
        {lat: 46.564147, lon: 7.887126}
      ],
      tags: {aerialway: 'chair_lift', name: 'Allmendhubel'}
    },
    {
      type: 'way',
      id: 154530061,
      geometry: [
        {lat: 46.621337, lon: 7.97924},
        {lat: 46.621274, lon: 7.978921}
      ],
      tags: {aerialway: 'gondola', name: 'Männlichenbahn'}
    },
    {
      type: 'way',
      id: 208096176,
      geometry: [
        {lat: 46.556521, lon: 7.890506},
        {lat: 46.55654, lon: 7.890167},
        {lat: 46.556551, lon: 7.88997},
        {lat: 46.556638, lon: 7.88839},
        {lat: 46.556745, lon: 7.886448},
        {lat: 46.556862, lon: 7.884335},
        {lat: 46.556944, lon: 7.882837},
        {lat: 46.557004, lon: 7.881757},
        {lat: 46.557044, lon: 7.881033},
        {lat: 46.557122, lon: 7.879625},
        {lat: 46.557286, lon: 7.876645},
        {lat: 46.557383, lon: 7.874885},
        {lat: 46.557518, lon: 7.872434},
        {lat: 46.55754, lon: 7.87204}
      ],
      tags: {aerialway: 'chair_lift', name: 'Schiltgrat'}
    },
    {
      type: 'way',
      id: 230567296,
      geometry: [
        {lat: 46.547165, lon: 7.893414},
        {lat: 46.550416, lon: 7.892769},
        {lat: 46.555168, lon: 7.891826},
        {lat: 46.557622, lon: 7.891338}
      ],
      tags: {aerialway: 'cable_car', name: 'Gimmelwald – Mürren'}
    },
    {
      type: 'way',
      id: 230567297,
      geometry: [
        {lat: 46.557758, lon: 7.891063},
        {lat: 46.558531, lon: 7.884829},
        {lat: 46.55904, lon: 7.880728},
        {lat: 46.56181, lon: 7.858376},
        {lat: 46.561869, lon: 7.857904}
      ],
      tags: {aerialway: 'cable_car', name: 'Mürren - Birg'}
    },
    {
      type: 'way',
      id: 288709911,
      geometry: [
        {lat: 46.621274, lon: 7.978921},
        {lat: 46.621194, lon: 7.978641},
        {lat: 46.62117, lon: 7.978557},
        {lat: 46.621008, lon: 7.977988},
        {lat: 46.620422, lon: 7.975835},
        {lat: 46.619571, lon: 7.972832},
        {lat: 46.618817, lon: 7.970149},
        {lat: 46.61786, lon: 7.966736},
        {lat: 46.617095, lon: 7.964028},
        {lat: 46.616411, lon: 7.961567},
        {lat: 46.615671, lon: 7.958962},
        {lat: 46.614932, lon: 7.956317},
        {lat: 46.613976, lon: 7.952904},
        {lat: 46.613401, lon: 7.950853},
        {lat: 46.61273, lon: 7.948423},
        {lat: 46.611789, lon: 7.945014},
        {lat: 46.611362, lon: 7.943477},
        {lat: 46.611297, lon: 7.943251},
        {lat: 46.61118, lon: 7.942866}
      ],
      tags: {aerialway: 'gondola', name: 'Männlichenbahn'}
    },
    {
      type: 'way',
      id: 362735721,
      geometry: [
        {lat: 46.691148, lon: 7.79603},
        {lat: 46.690756, lon: 7.795979},
        {lat: 46.690383, lon: 7.79593},
        {lat: 46.689838, lon: 7.795859},
        {lat: 46.688321, lon: 7.79566},
        {lat: 46.687631, lon: 7.79557}
      ],
      tags: {
        aerialway: 'cable_car',
        name: 'Privatseilbahn Sundlauenen - Schmalenhals - Schwendi'
      }
    },
    {
      type: 'way',
      id: 675817101,
      geometry: [
        {lat: 46.658494, lon: 8.065264},
        {lat: 46.658534, lon: 8.064865},
        {lat: 46.658604, lon: 8.064287},
        {lat: 46.658897, lon: 8.061867},
        {lat: 46.659145, lon: 8.05982},
        {lat: 46.659337, lon: 8.058236},
        {lat: 46.659439, lon: 8.057422},
        {lat: 46.659711, lon: 8.05508},
        {lat: 46.659774, lon: 8.054565},
        {lat: 46.659858, lon: 8.05382}
      ],
      tags: {aerialway: 'gondola', name: 'Firstbahn'}
    },
    {
      type: 'way',
      id: 799042591,
      geometry: [
        {lat: 46.624307, lon: 8.019366},
        {lat: 46.623475, lon: 8.01861},
        {lat: 46.619539, lon: 8.014997},
        {lat: 46.611929, lon: 8.008249},
        {lat: 46.605726, lon: 8.002726},
        {lat: 46.589833, lon: 7.988576},
        {lat: 46.585181, lon: 7.98466},
        {lat: 46.575479, lon: 7.97574}
      ],
      tags: {aerialway: 'gondola', name: 'Eiger Express'}
    },
    {
      type: 'way',
      id: 1239817092,
      geometry: [
        {lat: 46.555443, lon: 7.901962},
        {lat: 46.556885, lon: 7.895932},
        {lat: 46.557276, lon: 7.894333},
        {lat: 46.557645, lon: 7.892845},
        {lat: 46.558014, lon: 7.891403}
      ],
      tags: {
        aerialway: 'cable_car',
        name: 'Stechelberg - Mürren',
        duration: '3:54'
      }
    },
    {
      type: 'way',
      id: 1442024303,
      geometry: [
        {lat: 46.572827, lon: 7.950162},
        {lat: 46.578381, lon: 7.968413}
      ],
      tags: {aerialway: 'chair_lift', name: 'Wixi - Fallboden'}
    },
    {
      type: 'way',
      id: 1495451842,
      geometry: [
        {lat: 46.627942, lon: 8.049246},
        {lat: 46.62973, lon: 8.046026}
      ],
      tags: {aerialway: 'chair_lift', name: 'Isch - Bodmi'}
    },
    {
      type: 'way',
      id: 1526161604,
      geometry: [
        {lat: 46.646756, lon: 8.051765},
        {lat: 46.646959, lon: 8.05197},
        {lat: 46.647152, lon: 8.052193},
        {lat: 46.648275, lon: 8.053488},
        {lat: 46.64896, lon: 8.054278},
        {lat: 46.650398, lon: 8.055936},
        {lat: 46.651405, lon: 8.057098},
        {lat: 46.65213, lon: 8.057934},
        {lat: 46.652414, lon: 8.058262},
        {lat: 46.652836, lon: 8.058749},
        {lat: 46.654267, lon: 8.060399},
        {lat: 46.654824, lon: 8.061041},
        {lat: 46.65653, lon: 8.06301},
        {lat: 46.657686, lon: 8.064343},
        {lat: 46.658017, lon: 8.064725},
        {lat: 46.658262, lon: 8.065007},
        {lat: 46.658494, lon: 8.065264}
      ],
      tags: {aerialway: 'gondola', name: 'Firstbahn'}
    }
  ]
};
