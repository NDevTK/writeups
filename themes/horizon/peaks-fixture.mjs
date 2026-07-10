// Captured Overpass response (maps.mail.ru mirror, 2026-07-10):
// node[natural=peak][name](46.45,7.6,46.8,8.15);out 400; - the
// named summits of the Jungfrau region, 383 of 400 carrying
// their surveyed elevation (Finsteraarhorn 4274, Jungfrau
// 4158, Moench 4107, Schreckhorn 4078). Tags trimmed to
// name/ele; coordinates 6 dp. Includes the label-clutter
// case the selection gate holds: "Wengen Jungfrau" (4085)
// stands 300 m from the Jungfrau itself.
export const PEAKS_FIXTURE = {
  elements: [
    {
      type: 'node',
      id: 26862474,
      lat: 46.465198,
      lon: 7.993212,
      tags: {name: 'Aletschhorn', ele: '4195'}
    },
    {
      type: 'node',
      id: 26862594,
      lat: 46.488896,
      lon: 7.772511,
      tags: {name: 'Blüemlisalphorn', ele: '3663'}
    },
    {
      type: 'node',
      id: 26862632,
      lat: 46.787096,
      lon: 8.046868,
      tags: {name: 'Brienzer Rothorn', ele: '2348'}
    },
    {
      type: 'node',
      id: 26862792,
      lat: 46.468557,
      lon: 7.734963,
      tags: {name: 'Doldenhorn', ele: '3638'}
    },
    {
      type: 'node',
      id: 26862899,
      lat: 46.788057,
      lon: 7.901773,
      tags: {name: 'Furggenguetsch', ele: '2197'}
    },
    {
      type: 'node',
      id: 26863045,
      lat: 46.493398,
      lon: 8.097329,
      tags: {name: 'Grosses Wannenhorn', ele: '3906'}
    },
    {
      type: 'node',
      id: 26863067,
      lat: 46.511578,
      lon: 7.827271,
      tags: {name: 'Gspaltenhorn', ele: '3436'}
    },
    {
      type: 'node',
      id: 26863705,
      lat: 46.635036,
      lon: 8.124738,
      tags: {name: 'Mittelhorn', ele: '3704'}
    },
    {
      type: 'node',
      id: 26864560,
      lat: 46.686109,
      lon: 8.075556,
      tags: {name: 'Schwarzhoren', ele: '2927'}
    },
    {
      type: 'node',
      id: 26865116,
      lat: 46.461944,
      lon: 7.6,
      tags: {name: 'Vordere Loner', ele: '3049'}
    },
    {
      type: 'node',
      id: 31664299,
      lat: 46.646194,
      lon: 7.652367,
      tags: {name: 'Niesen', ele: '2362'}
    },
    {
      type: 'node',
      id: 31664302,
      lat: 46.577632,
      lon: 8.005469,
      tags: {name: 'Eiger', ele: '3970'}
    },
    {
      type: 'node',
      id: 173559350,
      lat: 46.731963,
      lon: 7.806639,
      tags: {name: 'Gemmenalphorn', ele: '2061'}
    },
    {
      type: 'node',
      id: 173559354,
      lat: 46.75899,
      lon: 7.819521,
      tags: {name: 'Sieben Hengste', ele: '1952'}
    },
    {
      type: 'node',
      id: 271357793,
      lat: 46.564882,
      lon: 7.754029,
      tags: {name: 'Aabeberg', ele: '1964'}
    },
    {
      type: 'node',
      id: 271904229,
      lat: 46.557282,
      lon: 7.835174,
      tags: {name: 'Schilthorn', ele: '2973'}
    },
    {
      type: 'node',
      id: 272880580,
      lat: 46.59252,
      lon: 7.948034,
      tags: {name: 'Lauberhorn', ele: '2472'}
    },
    {
      type: 'node',
      id: 283740485,
      lat: 46.61814,
      lon: 7.93804,
      tags: {name: 'Männlichen', ele: '2345'}
    },
    {
      type: 'node',
      id: 300548031,
      lat: 46.706581,
      lon: 7.802481,
      tags: {name: 'Bire', ele: '1500'}
    },
    {
      type: 'node',
      id: 304323886,
      lat: 46.730692,
      lon: 7.770409,
      tags: {name: 'Sigriswiler Rothorn', ele: '2051'}
    },
    {
      type: 'node',
      id: 305235603,
      lat: 46.706616,
      lon: 8.047661,
      tags: {name: 'Tschingel', ele: '2243'}
    },
    {
      type: 'node',
      id: 317003742,
      lat: 46.509401,
      lon: 8.088302,
      tags: {name: 'Wyssnollen', ele: '3595'}
    },
    {
      type: 'node',
      id: 344627857,
      lat: 46.638666,
      lon: 8.115604,
      tags: {name: 'Wetterhorn', ele: '3692'}
    },
    {
      type: 'node',
      id: 344668869,
      lat: 46.451743,
      lon: 7.946368,
      tags: {name: 'Schinhorn', ele: '3796'}
    },
    {
      type: 'node',
      id: 344668877,
      lat: 46.600216,
      lon: 7.949553,
      tags: {name: 'Tschuggen', ele: '2520'}
    },
    {
      type: 'node',
      id: 344668897,
      lat: 46.477941,
      lon: 8.020157,
      tags: {name: 'Dreieckhorn', ele: '3811'}
    },
    {
      type: 'node',
      id: 387516641,
      lat: 46.592712,
      lon: 7.759571,
      tags: {name: 'Dreispitz', ele: '2520'}
    },
    {
      type: 'node',
      id: 392334657,
      lat: 46.478479,
      lon: 7.877245,
      tags: {name: 'Breithorn', ele: '3780'}
    },
    {
      type: 'node',
      id: 393422021,
      lat: 46.742252,
      lon: 7.928627,
      tags: {name: 'Augstmatthorn', ele: '2137'}
    },
    {
      type: 'node',
      id: 394861145,
      lat: 46.751477,
      lon: 7.945315,
      tags: {name: 'Blasenhubel', ele: '1940'}
    },
    {
      type: 'node',
      id: 401457560,
      lat: 46.63188,
      lon: 8.137246,
      tags: {name: 'Rosenhorn', ele: '3689'}
    },
    {
      type: 'node',
      id: 401457561,
      lat: 46.625029,
      lon: 8.143424,
      tags: {name: 'Rosenegg', ele: '3470'}
    },
    {
      type: 'node',
      id: 410147190,
      lat: 46.632131,
      lon: 7.76679,
      tags: {name: 'Greberegg', ele: '1595'}
    },
    {
      type: 'node',
      id: 413907884,
      lat: 46.583266,
      lon: 8.128207,
      tags: {name: 'Lauteraarhorn', ele: '4042'}
    },
    {
      type: 'node',
      id: 413907885,
      lat: 46.601745,
      lon: 8.102097,
      tags: {name: 'Kleines Schreckhorn', ele: '3495'}
    },
    {
      type: 'node',
      id: 413907886,
      lat: 46.604583,
      lon: 8.091047,
      tags: {name: 'Gwächta', ele: '3163'}
    },
    {
      type: 'node',
      id: 416037587,
      lat: 46.461837,
      lon: 7.808952,
      tags: {name: 'Petersgrat', ele: '3202'}
    },
    {
      type: 'node',
      id: 416037596,
      lat: 46.458934,
      lon: 7.798889,
      tags: {name: 'Rote Tätsch', ele: '3165'}
    },
    {
      type: 'node',
      id: 416565933,
      lat: 46.452477,
      lon: 7.787221,
      tags: {name: 'Birghorn', ele: '3242.8'}
    },
    {
      type: 'node',
      id: 418596980,
      lat: 46.48879,
      lon: 7.823013,
      tags: {name: 'Mutthorn', ele: '3035'}
    },
    {
      type: 'node',
      id: 419287414,
      lat: 46.711706,
      lon: 7.777094,
      tags: {name: 'Niederhorn', ele: '1963'}
    },
    {
      type: 'node',
      id: 452398103,
      lat: 46.703787,
      lon: 8.140825,
      tags: {name: 'Tschingel', ele: '2326'}
    },
    {
      type: 'node',
      id: 474774710,
      lat: 46.659187,
      lon: 7.9137,
      tags: {name: 'Oberberghorn', ele: '2069'}
    },
    {
      type: 'node',
      id: 476715213,
      lat: 46.546468,
      lon: 8.06756,
      tags: {name: 'Hinter Fiescherhorn', ele: '4025'}
    },
    {
      type: 'node',
      id: 476715217,
      lat: 46.536896,
      lon: 8.073776,
      tags: {name: 'Klein Grünhorn', ele: '3913'}
    },
    {
      type: 'node',
      id: 476715219,
      lat: 46.532031,
      lon: 8.077766,
      tags: {name: 'Gross Grünhorn', ele: '4043'}
    },
    {
      type: 'node',
      id: 476715223,
      lat: 46.52673,
      lon: 8.074774,
      tags: {name: 'Grünegghorn', ele: '3860'}
    },
    {
      type: 'node',
      id: 497299521,
      lat: 46.676255,
      lon: 7.859696,
      tags: {name: 'Kleiner Rugen', ele: '733'}
    },
    {
      type: 'node',
      id: 498435878,
      lat: 46.621361,
      lon: 7.851821,
      tags: {name: 'Sulegg', ele: '2413'}
    },
    {
      type: 'node',
      id: 505804170,
      lat: 46.577392,
      lon: 7.984182,
      tags: {name: 'Rotstock', ele: '2663'}
    },
    {
      type: 'node',
      id: 505804678,
      lat: 46.54662,
      lon: 8.015381,
      tags: {name: 'Trugberg', ele: '3932'}
    },
    {
      type: 'node',
      id: 506243884,
      lat: 46.526887,
      lon: 7.969277,
      tags: {name: 'Louwihorn', ele: '3773'}
    },
    {
      type: 'node',
      id: 506243886,
      lat: 46.522095,
      lon: 7.980681,
      tags: {name: 'Kranzberg', ele: '3742'}
    },
    {
      type: 'node',
      id: 506243895,
      lat: 46.552714,
      lon: 7.924348,
      tags: {name: 'Schwarzmönch', ele: '2645'}
    },
    {
      type: 'node',
      id: 526988406,
      lat: 46.498177,
      lon: 8.091362,
      tags: {name: 'Schönbühlhorn', ele: '3854'}
    },
    {
      type: 'node',
      id: 538371124,
      lat: 46.483153,
      lon: 8.10468,
      tags: {name: 'Kleines Wannenhorn', ele: '3706'}
    },
    {
      type: 'node',
      id: 548618247,
      lat: 46.631215,
      lon: 7.858207,
      tags: {name: 'Bällenhöchst', ele: '2095'}
    },
    {
      type: 'node',
      id: 598491812,
      lat: 46.779461,
      lon: 8.036079,
      tags: {name: 'Dirrengrind', ele: '1850'}
    },
    {
      type: 'node',
      id: 616718873,
      lat: 46.6116,
      lon: 8.146056,
      tags: {name: 'Ankenbälli', ele: '3601'}
    },
    {
      type: 'node',
      id: 620877226,
      lat: 46.790397,
      lon: 8.072306,
      tags: {name: 'Arnihaggen', ele: '2216'}
    },
    {
      type: 'node',
      id: 653877997,
      lat: 46.486976,
      lon: 7.910079,
      tags: {name: 'Grosshorn', ele: '3754'}
    },
    {
      type: 'node',
      id: 653878066,
      lat: 46.512874,
      lon: 7.96743,
      tags: {name: 'Gletscherhorn', ele: '3983'}
    },
    {
      type: 'node',
      id: 653878178,
      lat: 46.559982,
      lon: 8.035006,
      tags: {name: 'Walcherhorn', ele: '3692'}
    },
    {
      type: 'node',
      id: 653878194,
      lat: 46.551334,
      lon: 8.061472,
      tags: {name: 'Grosses Fiescherhorn', ele: '4048.8'}
    },
    {
      type: 'node',
      id: 653902561,
      lat: 46.537347,
      lon: 8.126114,
      tags: {name: 'Finsteraarhorn', ele: '4274'}
    },
    {
      type: 'node',
      id: 653902617,
      lat: 46.532374,
      lon: 8.147683,
      tags: {name: 'Studerhorn', ele: '3632'}
    },
    {
      type: 'node',
      id: 653902769,
      lat: 46.546598,
      lon: 8.114411,
      tags: {name: 'Agassizhorn', ele: '3947'}
    },
    {
      type: 'node',
      id: 656427737,
      lat: 46.467553,
      lon: 7.964313,
      tags: {name: 'Sattelhorn', ele: '3744'}
    },
    {
      type: 'node',
      id: 658419992,
      lat: 46.467535,
      lon: 7.976501,
      tags: {name: 'Kleines Aletschhorn', ele: '3755'}
    },
    {
      type: 'node',
      id: 658421819,
      lat: 46.508034,
      lon: 7.953371,
      tags: {name: 'Ebnefluh / Äbeni Flue', ele: '3962'}
    },
    {
      type: 'node',
      id: 663870029,
      lat: 46.693066,
      lon: 7.680891,
      tags: {name: 'Spiezberg'}
    },
    {
      type: 'node',
      id: 772594383,
      lat: 46.622195,
      lon: 7.793568,
      tags: {name: 'Morgenberghorn', ele: '2248'}
    },
    {
      type: 'node',
      id: 800161777,
      lat: 46.674933,
      lon: 7.999324,
      tags: {name: 'Faulhorn', ele: '2680'}
    },
    {
      type: 'node',
      id: 823663741,
      lat: 46.573784,
      lon: 7.691946,
      tags: {name: 'Gehrihorn', ele: '2130'}
    },
    {
      type: 'node',
      id: 830405744,
      lat: 46.451569,
      lon: 8.000974,
      tags: {name: 'Vorderes Geisshorn', ele: '3634'}
    },
    {
      type: 'node',
      id: 846190202,
      lat: 46.711273,
      lon: 7.871181,
      tags: {name: 'Höhi Egg', ele: '1628'}
    },
    {
      type: 'node',
      id: 846190242,
      lat: 46.704276,
      lon: 7.860847,
      tags: {name: 'Wannichnubel', ele: '1585'}
    },
    {
      type: 'node',
      id: 846190251,
      lat: 46.716206,
      lon: 7.879343,
      tags: {name: 'Roteflue', ele: '1731'}
    },
    {
      type: 'node',
      id: 858518162,
      lat: 46.594597,
      lon: 8.111184,
      tags: {name: 'Nässihorn', ele: '3741'}
    },
    {
      type: 'node',
      id: 858521196,
      lat: 46.645029,
      lon: 8.110523,
      tags: {name: 'Scheideggwetterhorn', ele: '3361'}
    },
    {
      type: 'node',
      id: 950753511,
      lat: 46.788914,
      lon: 8.036602,
      tags: {name: 'Schongütsch', ele: '2319'}
    },
    {
      type: 'node',
      id: 959698452,
      lat: 46.716586,
      lon: 7.748632,
      tags: {name: 'Spitzi Flue', ele: '1658'}
    },
    {
      type: 'node',
      id: 1014782974,
      lat: 46.667829,
      lon: 8.007438,
      tags: {name: 'Simelihorn', ele: '2749'}
    },
    {
      type: 'node',
      id: 1014782981,
      lat: 46.668018,
      lon: 8.003369,
      tags: {name: 'Esel', ele: '2687'}
    },
    {
      type: 'node',
      id: 1014859131,
      lat: 46.673346,
      lon: 8.041762,
      tags: {name: 'Grossenegg'}
    },
    {
      type: 'node',
      id: 1014859139,
      lat: 46.677132,
      lon: 8.014188,
      tags: {name: 'Gassenhorn'}
    },
    {
      type: 'node',
      id: 1014859146,
      lat: 46.664942,
      lon: 8.01154,
      tags: {name: 'Reeti', ele: '2757'}
    },
    {
      type: 'node',
      id: 1015008217,
      lat: 46.676721,
      lon: 8.077512,
      tags: {name: 'Gemschberg'}
    },
    {
      type: 'node',
      id: 1015008220,
      lat: 46.692641,
      lon: 8.058992,
      tags: {name: 'Gärstenhoren', ele: '2798'}
    },
    {
      type: 'node',
      id: 1039766142,
      lat: 46.778957,
      lon: 7.859474,
      tags: {name: 'Trogenhorn', ele: '1973'}
    },
    {
      type: 'node',
      id: 1123361749,
      lat: 46.476387,
      lon: 7.616238,
      tags: {name: 'Hindere Loner', ele: '2778'}
    },
    {
      type: 'node',
      id: 1123362152,
      lat: 46.469503,
      lon: 7.609409,
      tags: {name: 'Mittlere Loner', ele: '3002'}
    },
    {
      type: 'node',
      id: 1244929527,
      lat: 46.655666,
      lon: 8.142013,
      tags: {name: 'Wellhorn', ele: '3191.4'}
    },
    {
      type: 'node',
      id: 1244930493,
      lat: 46.476687,
      lon: 7.757464,
      tags: {name: 'Fründenhorn', ele: '3368'}
    },
    {
      type: 'node',
      id: 1244930698,
      lat: 46.699137,
      lon: 8.127485,
      tags: {name: 'Grindelgrat', ele: '2392'}
    },
    {
      type: 'node',
      id: 1244930729,
      lat: 46.517331,
      lon: 7.749337,
      tags: {name: 'Bundstock', ele: '2756'}
    },
    {
      type: 'node',
      id: 1244931004,
      lat: 46.604034,
      lon: 7.604356,
      tags: {name: 'Tschipparällehore', ele: '2398'}
    },
    {
      type: 'node',
      id: 1244931236,
      lat: 46.54151,
      lon: 7.713577,
      tags: {name: 'Aermighorn', ele: '2742'}
    },
    {
      type: 'node',
      id: 1244932303,
      lat: 46.625793,
      lon: 7.619105,
      tags: {name: 'Drunegalm', ele: '2408'}
    },
    {
      type: 'node',
      id: 1244932311,
      lat: 46.534228,
      lon: 7.737915,
      tags: {name: 'Chistihubel', ele: '2216'}
    },
    {
      type: 'node',
      id: 1244934123,
      lat: 46.495286,
      lon: 7.792174,
      tags: {name: 'Morgenhorn', ele: '3627'}
    },
    {
      type: 'node',
      id: 1244934130,
      lat: 46.607866,
      lon: 7.743303,
      tags: {name: 'Wätterlatte', ele: '2007'}
    },
    {
      type: 'node',
      id: 1244934361,
      lat: 46.692769,
      lon: 8.074363,
      tags: {name: 'Wildgärst', ele: '2890'}
    },
    {
      type: 'node',
      id: 1244934416,
      lat: 46.515717,
      lon: 7.762495,
      tags: {name: 'Schwarzhorn', ele: '2785'}
    },
    {
      type: 'node',
      id: 1244935294,
      lat: 46.528861,
      lon: 7.721567,
      tags: {name: 'Salzhorn', ele: '2570'}
    },
    {
      type: 'node',
      id: 1276246921,
      lat: 46.722552,
      lon: 7.795403,
      tags: {name: 'Burgfeldstand', ele: '2063'}
    },
    {
      type: 'node',
      id: 1325428842,
      lat: 46.617,
      lon: 7.745061,
      tags: {name: 'Ufem Letze', ele: '1751'}
    },
    {
      type: 'node',
      id: 1339566115,
      lat: 46.657463,
      lon: 8.029162,
      tags: {name: 'Uf Spitzen'}
    },
    {
      type: 'node',
      id: 1372212711,
      lat: 46.478806,
      lon: 7.848212,
      tags: {name: 'Tschingelhorn', ele: '3562'}
    },
    {
      type: 'node',
      id: 1372214030,
      lat: 46.498248,
      lon: 7.932652,
      tags: {name: 'Mittaghorn', ele: '3890'}
    },
    {
      type: 'node',
      id: 1372214713,
      lat: 46.509091,
      lon: 7.644404,
      tags: {name: 'Howang', ele: '2519'}
    },
    {
      type: 'node',
      id: 1372215844,
      lat: 46.520126,
      lon: 7.729534,
      tags: {name: 'Dündenhorn', ele: '2862'}
    },
    {
      type: 'node',
      id: 1372216350,
      lat: 46.525257,
      lon: 7.819852,
      tags: {name: 'Vorderi Bütlasse', ele: '3063'}
    },
    {
      type: 'node',
      id: 1372219824,
      lat: 46.558506,
      lon: 7.997271,
      tags: {name: 'Mönch', ele: '4107'}
    },
    {
      type: 'node',
      id: 1372221356,
      lat: 46.575497,
      lon: 8.118035,
      tags: {name: 'Strahlegghorn', ele: '3461'}
    },
    {
      type: 'node',
      id: 1372222163,
      lat: 46.589893,
      lon: 8.118142,
      tags: {name: 'Schreckhorn', ele: '4078'}
    },
    {
      type: 'node',
      id: 1372222309,
      lat: 46.592907,
      lon: 7.816974,
      tags: {name: 'Schwalmere', ele: '2777'}
    },
    {
      type: 'node',
      id: 1372223240,
      lat: 46.614989,
      lon: 8.140723,
      tags: {name: 'Bärglistock', ele: '3655'}
    },
    {
      type: 'node',
      id: 1372233100,
      lat: 46.679356,
      lon: 7.620961,
      tags: {name: 'Sunnighorn', ele: '1397'}
    },
    {
      type: 'node',
      id: 1372234076,
      lat: 46.687965,
      lon: 8.085199,
      tags: {name: 'Schrybershiri', ele: '2516'}
    },
    {
      type: 'node',
      id: 1372245484,
      lat: 46.774994,
      lon: 7.984627,
      tags: {name: 'Tannhorn', ele: '2221'}
    },
    {
      type: 'node',
      id: 1373183515,
      lat: 46.469036,
      lon: 8.034288,
      tags: {name: 'Kleines Dreieckhorn', ele: '3639'}
    },
    {
      type: 'node',
      id: 1381596589,
      lat: 46.534704,
      lon: 7.639625,
      tags: {name: 'Elsighorn', ele: '2341'}
    },
    {
      type: 'node',
      id: 1383360563,
      lat: 46.772858,
      lon: 8.106899,
      tags: {name: 'Wilerhorn', ele: '2005'}
    },
    {
      type: 'node',
      id: 1408362963,
      lat: 46.527048,
      lon: 7.887882,
      tags: {name: 'Tanzbödeli'}
    },
    {
      type: 'node',
      id: 1435708318,
      lat: 46.536774,
      lon: 7.962591,
      tags: {name: 'Jungfrau', ele: '4158'}
    },
    {
      type: 'node',
      id: 1446366967,
      lat: 46.75362,
      lon: 7.80126,
      tags: {name: 'Burst', ele: '1968'}
    },
    {
      type: 'node',
      id: 1447330539,
      lat: 46.632684,
      lon: 8.097221,
      tags: {name: 'Chrinnenhorn', ele: '2741'}
    },
    {
      type: 'node',
      id: 1465000341,
      lat: 46.710268,
      lon: 8.060703,
      tags: {name: 'Axalphoren', ele: '2321'}
    },
    {
      type: 'node',
      id: 1484045724,
      lat: 46.787214,
      lon: 7.884178,
      tags: {name: 'Aff', ele: '2036'}
    },
    {
      type: 'node',
      id: 1640528403,
      lat: 46.49249,
      lon: 7.620382,
      tags: {name: 'Bunderspitz', ele: '2546'}
    },
    {
      type: 'node',
      id: 1674465689,
      lat: 46.504791,
      lon: 7.642955,
      tags: {name: 'First', ele: '2548'}
    },
    {
      type: 'node',
      id: 1679705889,
      lat: 46.758715,
      lon: 7.955272,
      tags: {name: 'Gummhoren', ele: '2040'}
    },
    {
      type: 'node',
      id: 1729296419,
      lat: 46.786428,
      lon: 7.893293,
      tags: {name: 'Hohgant', ele: '2163'}
    },
    {
      type: 'node',
      id: 1737166648,
      lat: 46.7647,
      lon: 7.84033,
      tags: {name: 'Ramsgrind', ele: '1659'}
    },
    {
      type: 'node',
      id: 1754140527,
      lat: 46.632721,
      lon: 7.629382,
      tags: {name: 'Fromberghorn', ele: '2394'}
    },
    {
      type: 'node',
      id: 1754140528,
      lat: 46.619019,
      lon: 7.613688,
      tags: {name: 'Standhore', ele: '2339'}
    },
    {
      type: 'node',
      id: 1754140529,
      lat: 46.608435,
      lon: 7.609475,
      tags: {name: 'Steischlaghore', ele: '2321'}
    },
    {
      type: 'node',
      id: 1754140530,
      lat: 46.624296,
      lon: 7.62262,
      tags: {name: 'Triesthore', ele: '2321'}
    },
    {
      type: 'node',
      id: 1754145782,
      lat: 46.614131,
      lon: 7.72915,
      tags: {name: 'Engelhorn', ele: '1774'}
    },
    {
      type: 'node',
      id: 2035401373,
      lat: 46.670933,
      lon: 7.628975,
      tags: {name: 'Burgflue', ele: '979'}
    },
    {
      type: 'node',
      id: 2186183354,
      lat: 46.748437,
      lon: 7.893913,
      tags: {name: 'Winterröscht', ele: '1759'}
    },
    {
      type: 'node',
      id: 2186216926,
      lat: 46.75307,
      lon: 7.88357,
      tags: {name: 'Bolberg', ele: '1799'}
    },
    {
      type: 'node',
      id: 2186260251,
      lat: 46.768209,
      lon: 7.891392,
      tags: {name: 'Stand', ele: '1765'}
    },
    {
      type: 'node',
      id: 2242270529,
      lat: 46.510852,
      lon: 7.698201,
      tags: {name: 'Bire', ele: '2502'}
    },
    {
      type: 'node',
      id: 2309671461,
      lat: 46.595816,
      lon: 7.769033,
      tags: {name: 'Latrejespitz', ele: '2430'}
    },
    {
      type: 'node',
      id: 2313261720,
      lat: 46.599163,
      lon: 7.769651,
      tags: {name: 'First', ele: '2440'}
    },
    {
      type: 'node',
      id: 2318169975,
      lat: 46.732526,
      lon: 7.690343,
      tags: {name: 'Krindenhubel'}
    },
    {
      type: 'node',
      id: 2320097653,
      lat: 46.734871,
      lon: 7.920842,
      tags: {name: 'Suggiturm', ele: '2085'}
    },
    {
      type: 'node',
      id: 2357104974,
      lat: 46.657796,
      lon: 7.960537,
      tags: {name: 'Bira', ele: '2400'}
    },
    {
      type: 'node',
      id: 2357104975,
      lat: 46.653653,
      lon: 7.98096,
      tags: {name: 'Burg', ele: '2207'}
    },
    {
      type: 'node',
      id: 2357104976,
      lat: 46.666258,
      lon: 7.934457,
      tags: {name: 'Loucherhorn', ele: '2230'}
    },
    {
      type: 'node',
      id: 2357167329,
      lat: 46.577103,
      lon: 7.864867,
      tags: {name: 'Bietenhorn', ele: '2756'}
    },
    {
      type: 'node',
      id: 2401785474,
      lat: 46.502416,
      lon: 8.084255,
      tags: {name: 'Fiescher Gabelhorn', ele: '3876'}
    },
    {
      type: 'node',
      id: 2402689355,
      lat: 46.550632,
      lon: 7.695133,
      tags: {name: 'Sattelhorn', ele: '2376'}
    },
    {
      type: 'node',
      id: 2418263093,
      lat: 46.500932,
      lon: 8.05967,
      tags: {name: 'Fülbärg', ele: '3242.6'}
    },
    {
      type: 'node',
      id: 2459510861,
      lat: 46.532004,
      lon: 7.9673,
      tags: {name: 'Rottalhorn', ele: '3972'}
    },
    {
      type: 'node',
      id: 2478781149,
      lat: 46.501408,
      lon: 8.071487,
      tags: {name: '3605'}
    },
    {
      type: 'node',
      id: 2478781150,
      lat: 46.501837,
      lon: 8.079004,
      tags: {name: 'Chamm', ele: '3866'}
    },
    {
      type: 'node',
      id: 2478781151,
      lat: 46.490006,
      lon: 8.100409,
      tags: {name: '3807', ele: '3807'}
    },
    {
      type: 'node',
      id: 2478781152,
      lat: 46.476953,
      lon: 8.103127,
      tags: {name: 'Wannenzwillinge', ele: '3430'}
    },
    {
      type: 'node',
      id: 2478781794,
      lat: 46.450972,
      lon: 8.095207,
      tags: {name: 'Strahlhorn', ele: '3026'}
    },
    {
      type: 'node',
      id: 2497199101,
      lat: 46.469398,
      lon: 7.690488,
      tags: {name: 'Innerer Fisistock', ele: '2787'}
    },
    {
      type: 'node',
      id: 2497234638,
      lat: 46.473483,
      lon: 7.704354,
      tags: {name: 'Äusserer Fisistock', ele: '2945'}
    },
    {
      type: 'node',
      id: 2497235768,
      lat: 46.469934,
      lon: 7.727258,
      tags: {name: 'Kleindoldenhorn', ele: '3475'}
    },
    {
      type: 'node',
      id: 2497236698,
      lat: 46.483715,
      lon: 7.767624,
      tags: {name: 'Oeschinenhorn', ele: '3486'}
    },
    {
      type: 'node',
      id: 2526317227,
      lat: 46.492853,
      lon: 7.783168,
      tags: {name: 'Wyssi Frau', ele: '3650'}
    },
    {
      type: 'node',
      id: 2526340242,
      lat: 46.503878,
      lon: 7.780187,
      tags: {name: 'Wildi Frau', ele: '3273'}
    },
    {
      type: 'node',
      id: 2618578655,
      lat: 46.622254,
      lon: 7.95784,
      tags: {name: 'Wysshorn', ele: '1983'}
    },
    {
      type: 'node',
      id: 2674591966,
      lat: 46.79793,
      lon: 7.644687,
      tags: {name: 'Wachthubel', ele: '893'}
    },
    {
      type: 'node',
      id: 2683854598,
      lat: 46.541964,
      lon: 7.948989,
      tags: {name: 'Silberhorn', ele: '3690'}
    },
    {
      type: 'node',
      id: 2713514421,
      lat: 46.787629,
      lon: 8.090012,
      tags: {name: 'Höch Gumme', ele: '2205'}
    },
    {
      type: 'node',
      id: 2904391624,
      lat: 46.602565,
      lon: 7.84425,
      tags: {name: 'Lobhörner', ele: '2566'}
    },
    {
      type: 'node',
      id: 2907008307,
      lat: 46.683704,
      lon: 7.989382,
      tags: {name: 'Schwabhoren', ele: '2374'}
    },
    {
      type: 'node',
      id: 2926281386,
      lat: 46.670527,
      lon: 7.93128,
      tags: {name: 'Roriwanghorn', ele: '1968'}
    },
    {
      type: 'node',
      id: 2987798172,
      lat: 46.450623,
      lon: 7.665766,
      tags: {name: 'Untere Tatelishorn'}
    },
    {
      type: 'node',
      id: 3008915122,
      lat: 46.542709,
      lon: 7.806285,
      tags: {name: 'Hundshorn', ele: '2928'}
    },
    {
      type: 'node',
      id: 3008947968,
      lat: 46.553364,
      lon: 7.787585,
      tags: {name: 'Zahm Andrist', ele: '2681'}
    },
    {
      type: 'node',
      id: 3008947969,
      lat: 46.547954,
      lon: 7.797192,
      tags: {name: 'Wild Andrist', ele: '2849'}
    },
    {
      type: 'node',
      id: 3008955015,
      lat: 46.518464,
      lon: 7.819836,
      tags: {name: 'Bütlasse', ele: '3193'}
    },
    {
      type: 'node',
      id: 3008988285,
      lat: 46.51061,
      lon: 7.840197,
      tags: {name: 'Tschingelspitz', ele: '3304'}
    },
    {
      type: 'node',
      id: 3009140124,
      lat: 46.582208,
      lon: 7.823789,
      tags: {name: 'Drättehorn', ele: '2794'}
    },
    {
      type: 'node',
      id: 3009144505,
      lat: 46.588833,
      lon: 7.821895,
      tags: {name: 'Hoganthorn', ele: '2777'}
    },
    {
      type: 'node',
      id: 3009152314,
      lat: 46.590293,
      lon: 7.842741,
      tags: {name: 'Spaltenhorn', ele: '2526'}
    },
    {
      type: 'node',
      id: 3009155396,
      lat: 46.557887,
      lon: 7.794585,
      tags: {name: 'Hätlishore', ele: '2564'}
    },
    {
      type: 'node',
      id: 3009158604,
      lat: 46.561722,
      lon: 7.818789,
      tags: {name: 'Chilchflüh', ele: '2833'}
    },
    {
      type: 'node',
      id: 3009187471,
      lat: 46.500644,
      lon: 7.771943,
      tags: {name: 'Ufem Stock', ele: '3221'}
    },
    {
      type: 'node',
      id: 3105831304,
      lat: 46.716255,
      lon: 8.079206,
      tags: {name: 'Oltschiburg', ele: '2234'}
    },
    {
      type: 'node',
      id: 3212624098,
      lat: 46.655174,
      lon: 7.908211,
      tags: {name: 'Gumihorn', ele: '2100'}
    },
    {
      type: 'node',
      id: 3212660616,
      lat: 46.653336,
      lon: 7.909457,
      tags: {name: 'Geiss'}
    },
    {
      type: 'node',
      id: 3227897672,
      lat: 46.561978,
      lon: 7.857393,
      tags: {name: 'Birg', ele: '2684'}
    },
    {
      type: 'node',
      id: 3382067850,
      lat: 46.656119,
      lon: 7.90701,
      tags: {name: 'Daube', ele: '2076'}
    },
    {
      type: 'node',
      id: 3442392241,
      lat: 46.722653,
      lon: 8.070039,
      tags: {name: 'Hennefidle', ele: '1637'}
    },
    {
      type: 'node',
      id: 3442770076,
      lat: 46.611488,
      lon: 7.80538,
      tags: {name: 'Rengghorn', ele: '2013'}
    },
    {
      type: 'node',
      id: 3442770078,
      lat: 46.653349,
      lon: 7.83066,
      tags: {name: 'Birchizand', ele: '1605'}
    },
    {
      type: 'node',
      id: 3531458676,
      lat: 46.728097,
      lon: 7.762167,
      tags: {name: 'Merra', ele: '1953'}
    },
    {
      type: 'node',
      id: 3543628168,
      lat: 46.678579,
      lon: 7.619611,
      tags: {name: 'Mittagflue', ele: '1421'}
    },
    {
      type: 'node',
      id: 3543643724,
      lat: 46.678267,
      lon: 7.616848,
      tags: {name: 'Fliederhorn / Hinterhorn', ele: '1440'}
    },
    {
      type: 'node',
      id: 3544050855,
      lat: 46.707462,
      lon: 8.081713,
      tags: {name: 'Schryberhorn', ele: '2069'}
    },
    {
      type: 'node',
      id: 3547016528,
      lat: 46.608644,
      lon: 8.07913,
      tags: {name: 'Mättenberg', ele: '3104'}
    },
    {
      type: 'node',
      id: 3562887253,
      lat: 46.768324,
      lon: 7.972774,
      tags: {name: 'Ällgäuwhoren', ele: '2047'}
    },
    {
      type: 'node',
      id: 3695925420,
      lat: 46.54705,
      lon: 7.976092,
      tags: {name: 'Mathildespitze', ele: '3557'}
    },
    {
      type: 'node',
      id: 3719861398,
      lat: 46.571804,
      lon: 7.85823,
      tags: {name: 'Eltitashorn', ele: '2693'}
    },
    {
      type: 'node',
      id: 3821678805,
      lat: 46.738066,
      lon: 7.778616,
      tags: {name: 'Mittaghorn', ele: '2013'}
    },
    {
      type: 'node',
      id: 3926646713,
      lat: 46.529774,
      lon: 7.668307,
      tags: {name: 'Teufematti', ele: '952'}
    },
    {
      type: 'node',
      id: 4131213871,
      lat: 46.549601,
      lon: 7.932419,
      tags: {name: 'Rotbrätthoren', ele: '2720'}
    },
    {
      type: 'node',
      id: 4131230695,
      lat: 46.540796,
      lon: 7.945315,
      tags: {name: 'Goldenhoren', ele: '3640'}
    },
    {
      type: 'node',
      id: 4131230697,
      lat: 46.542668,
      lon: 7.939011,
      tags: {name: 'Fellenbergflieli', ele: '3385'}
    },
    {
      type: 'node',
      id: 4131230698,
      lat: 46.543866,
      lon: 7.953613,
      tags: {name: 'Chlys Silberhoren', ele: '3537'}
    },
    {
      type: 'node',
      id: 4455403996,
      lat: 46.712358,
      lon: 8.112992,
      tags: {name: 'Wandelhoren', ele: '2303'}
    },
    {
      type: 'node',
      id: 4473563133,
      lat: 46.70126,
      lon: 8.098771,
      tags: {name: 'Garzen', ele: '2711'}
    },
    {
      type: 'node',
      id: 4596973716,
      lat: 46.758285,
      lon: 7.650068,
      tags: {name: 'Grüsisberg', ele: '950'}
    },
    {
      type: 'node',
      id: 4622366094,
      lat: 46.771235,
      lon: 7.993025,
      tags: {name: 'Alpenrosenhubel'}
    },
    {
      type: 'node',
      id: 4622366095,
      lat: 46.779443,
      lon: 7.99459,
      tags: {name: 'Balmi', ele: '2141'}
    },
    {
      type: 'node',
      id: 4622366184,
      lat: 46.764403,
      lon: 7.965404,
      tags: {name: 'Schnierenhireli', ele: '2070'}
    },
    {
      type: 'node',
      id: 4622379610,
      lat: 46.743931,
      lon: 7.929964,
      tags: {name: 'Wytlouwihoren', ele: '2106'}
    },
    {
      type: 'node',
      id: 4625406473,
      lat: 46.769061,
      lon: 7.756117,
      tags: {name: 'Hubel', ele: '1207'}
    },
    {
      type: 'node',
      id: 4625548323,
      lat: 46.773047,
      lon: 7.799167,
      tags: {name: 'Stouffe', ele: '1511'}
    },
    {
      type: 'node',
      id: 4625548334,
      lat: 46.753055,
      lon: 7.797612,
      tags: {name: 'Bluemhorn', ele: '1939'}
    },
    {
      type: 'node',
      id: 4625548335,
      lat: 46.749471,
      lon: 7.807682,
      tags: {name: 'Schibe', ele: '1955'}
    },
    {
      type: 'node',
      id: 4630673796,
      lat: 46.794028,
      lon: 7.754671,
      tags: {name: 'Bichsel', ele: '1208'}
    },
    {
      type: 'node',
      id: 4716913189,
      lat: 46.541089,
      lon: 7.831988,
      tags: {name: 'Poganggenhorn', ele: '2443'}
    },
    {
      type: 'node',
      id: 4867867527,
      lat: 46.635588,
      lon: 8.091302,
      tags: {name: 'Byhorn'}
    },
    {
      type: 'node',
      id: 4927220033,
      lat: 46.544314,
      lon: 8.06831,
      tags: {name: 'P3981', ele: '3981'}
    },
    {
      type: 'node',
      id: 5077264476,
      lat: 46.675057,
      lon: 7.67845,
      tags: {name: 'Hondrichhügel', ele: '875'}
    },
    {
      type: 'node',
      id: 5338223020,
      lat: 46.797533,
      lon: 8.105951,
      tags: {name: 'Mändli', ele: '2059'}
    },
    {
      type: 'node',
      id: 5338233050,
      lat: 46.798983,
      lon: 8.137116,
      tags: {name: 'Sädel', ele: '1672'}
    },
    {
      type: 'node',
      id: 5338233084,
      lat: 46.789571,
      lon: 8.132455,
      tags: {name: 'Turren', ele: '1562'}
    },
    {
      type: 'node',
      id: 5338233097,
      lat: 46.786663,
      lon: 8.11944,
      tags: {name: 'Finsterbüel', ele: '1688'}
    },
    {
      type: 'node',
      id: 5338233098,
      lat: 46.776076,
      lon: 8.101643,
      tags: {name: 'Hörnli', ele: '1942'}
    },
    {
      type: 'node',
      id: 5338233099,
      lat: 46.769079,
      lon: 8.11169,
      tags: {name: 'Hirendli', ele: '1763'}
    },
    {
      type: 'node',
      id: 5344666066,
      lat: 46.790282,
      lon: 8.091352,
      tags: {name: 'Arnifirst', ele: '2154'}
    },
    {
      type: 'node',
      id: 5345463888,
      lat: 46.798028,
      lon: 8.078222,
      tags: {name: 'Arnitriste', ele: '2004'}
    },
    {
      type: 'node',
      id: 5345463889,
      lat: 46.798666,
      lon: 8.05474,
      tags: {name: 'Nesslenstock', ele: '1838'}
    },
    {
      type: 'node',
      id: 5345463890,
      lat: 46.793259,
      lon: 8.040633,
      tags: {name: 'Brätterstock', ele: '2115'}
    },
    {
      type: 'node',
      id: 5345632665,
      lat: 46.724064,
      lon: 7.904604,
      tags: {name: 'Schönbüel', ele: '1807'}
    },
    {
      type: 'node',
      id: 5345667682,
      lat: 46.720044,
      lon: 7.823332,
      tags: {name: 'Leimere', ele: '1659'}
    },
    {
      type: 'node',
      id: 5351376444,
      lat: 46.754074,
      lon: 7.738723,
      tags: {name: 'Bramberg', ele: '1175'}
    },
    {
      type: 'node',
      id: 5351376445,
      lat: 46.749935,
      lon: 7.749209,
      tags: {name: 'Züsenegghubel', ele: '1427'}
    },
    {
      type: 'node',
      id: 5351376446,
      lat: 46.749199,
      lon: 7.76598,
      tags: {name: 'Mäscherchopf', ele: '1556'}
    },
    {
      type: 'node',
      id: 5351376447,
      lat: 46.767461,
      lon: 7.720146,
      tags: {name: 'Buechholzegg', ele: '1119'}
    },
    {
      type: 'node',
      id: 5351376448,
      lat: 46.776192,
      lon: 7.725317,
      tags: {name: 'Bahubel', ele: '957'}
    },
    {
      type: 'node',
      id: 5352504418,
      lat: 46.764996,
      lon: 7.909523,
      tags: {name: 'Heitbüel', ele: '1608'}
    },
    {
      type: 'node',
      id: 5810135104,
      lat: 46.706594,
      lon: 7.76642,
      tags: {name: 'Uf Vorsess', ele: '1761'}
    },
    {
      type: 'node',
      id: 5810135105,
      lat: 46.709051,
      lon: 7.771745,
      tags: {name: 'Flöschhorn', ele: '1898'}
    },
    {
      type: 'node',
      id: 5954174148,
      lat: 46.517958,
      lon: 8.148205,
      tags: {name: 'Finsteraarrothorn', ele: '3549'}
    },
    {
      type: 'node',
      id: 6089787580,
      lat: 46.473512,
      lon: 7.720685,
      tags: {name: 'Doldenstock', ele: '3232'}
    },
    {
      type: 'node',
      id: 6110504194,
      lat: 46.706185,
      lon: 7.952097,
      tags: {name: 'Senggfluh', ele: '695'}
    },
    {
      type: 'node',
      id: 6143279453,
      lat: 46.791612,
      lon: 7.920866,
      tags: {name: 'Grätli', ele: '1835'}
    },
    {
      type: 'node',
      id: 6143279454,
      lat: 46.793845,
      lon: 7.933356,
      tags: {name: 'Brünneligrind', ele: '1790'}
    },
    {
      type: 'node',
      id: 6143279455,
      lat: 46.795626,
      lon: 7.94264,
      tags: {name: 'Birchegütsch', ele: '1582'}
    },
    {
      type: 'node',
      id: 6143314544,
      lat: 46.747507,
      lon: 7.878274,
      tags: {name: 'Twiri', ele: '1712'}
    },
    {
      type: 'node',
      id: 6558684890,
      lat: 46.45367,
      lon: 8.051924,
      tags: {name: 'Olmenhorn', ele: '3314'}
    },
    {
      type: 'node',
      id: 6621298676,
      lat: 46.486811,
      lon: 7.644622,
      tags: {name: 'Alpschelehubel', ele: '2247'}
    },
    {
      type: 'node',
      id: 6621298677,
      lat: 46.515364,
      lon: 7.644527,
      tags: {name: 'Stand', ele: '2320'}
    },
    {
      type: 'node',
      id: 6740170352,
      lat: 46.546974,
      lon: 7.868488,
      tags: {name: 'Bryndli', ele: '2132'}
    },
    {
      type: 'node',
      id: 6963261180,
      lat: 46.644747,
      lon: 7.661138,
      tags: {name: 'Glogghore', ele: '1984'}
    },
    {
      type: 'node',
      id: 6969898353,
      lat: 46.652558,
      lon: 7.652896,
      tags: {name: 'Meiehöri', ele: '1865'}
    },
    {
      type: 'node',
      id: 7196404813,
      lat: 46.733712,
      lon: 7.828882,
      tags: {name: 'Guggihürli', ele: '1820'}
    },
    {
      type: 'node',
      id: 7238054084,
      lat: 46.681934,
      lon: 7.698641,
      tags: {name: 'Bürg', ele: '696'}
    },
    {
      type: 'node',
      id: 7314528536,
      lat: 46.606725,
      lon: 7.73828,
      tags: {name: 'Standflue', ele: '1978'}
    },
    {
      type: 'node',
      id: 7392107691,
      lat: 46.75876,
      lon: 7.968565,
      tags: {name: 'Bitschigrind', ele: '1696'}
    },
    {
      type: 'node',
      id: 7427977083,
      lat: 46.69468,
      lon: 7.81842,
      tags: {name: 'Hüenderhubel', ele: '1204'}
    },
    {
      type: 'node',
      id: 7749776972,
      lat: 46.620654,
      lon: 7.913947,
      tags: {name: 'Leiterhorn', ele: '1515'}
    },
    {
      type: 'node',
      id: 7749824730,
      lat: 46.642414,
      lon: 7.855751,
      tags: {name: 'Schwarzhore', ele: '1561'}
    },
    {
      type: 'node',
      id: 7767189956,
      lat: 46.623483,
      lon: 7.876482,
      tags: {name: 'Vreneli'}
    },
    {
      type: 'node',
      id: 7783795150,
      lat: 46.736716,
      lon: 8.02603,
      tags: {name: 'Gippi', ele: '759'}
    },
    {
      type: 'node',
      id: 8068770308,
      lat: 46.526132,
      lon: 7.885373,
      tags: {name: 'Spitzhorn', ele: '2211'}
    },
    {
      type: 'node',
      id: 8068770313,
      lat: 46.518883,
      lon: 7.86575,
      tags: {name: 'Ellstabhoren', ele: '2827'}
    },
    {
      type: 'node',
      id: 8138165163,
      lat: 46.495842,
      lon: 7.761524,
      tags: {name: 'Blüemlisalp Rothorn', ele: '3297'}
    },
    {
      type: 'node',
      id: 8152126382,
      lat: 46.584321,
      lon: 7.86546,
      tags: {name: 'Wyssburg', ele: '2617'}
    },
    {
      type: 'node',
      id: 8152192019,
      lat: 46.609268,
      lon: 7.862842,
      tags: {name: 'Gälba Schopf'}
    },
    {
      type: 'node',
      id: 8162247851,
      lat: 46.555009,
      lon: 7.91419,
      tags: {name: 'Mönchsbüffel', ele: '2077'}
    },
    {
      type: 'node',
      id: 8248737628,
      lat: 46.564073,
      lon: 7.887723,
      tags: {name: 'Allmihubel', ele: '1932'}
    },
    {
      type: 'node',
      id: 8812045691,
      lat: 46.575482,
      lon: 7.789502,
      tags: {name: 'Glütschstock', ele: '2100'}
    },
    {
      type: 'node',
      id: 8815192549,
      lat: 46.579697,
      lon: 7.96632,
      tags: {name: 'Fallbodenhubel', ele: '2172'}
    },
    {
      type: 'node',
      id: 8830637547,
      lat: 46.65004,
      lon: 8.035067,
      tags: {name: 'Furggenhorn'}
    },
    {
      type: 'node',
      id: 8883221613,
      lat: 46.568886,
      lon: 7.749144,
      tags: {name: 'Golderenhorn', ele: '1917'}
    },
    {
      type: 'node',
      id: 8948926291,
      lat: 46.611236,
      lon: 7.867134,
      tags: {name: 'Ars'}
    },
    {
      type: 'node',
      id: 9190429896,
      lat: 46.476948,
      lon: 7.723871,
      tags: {name: 'Bim spitze Stei', ele: '2975'}
    },
    {
      type: 'node',
      id: 9229556339,
      lat: 46.706744,
      lon: 8.052438,
      tags: {name: 'Grätli', ele: '2200'}
    },
    {
      type: 'node',
      id: 9275173198,
      lat: 46.747193,
      lon: 7.710402,
      tags: {name: 'Schwändiblueme', ele: '1396'}
    },
    {
      type: 'node',
      id: 9275173400,
      lat: 46.752096,
      lon: 7.689798,
      tags: {name: 'Winterberg', ele: '1217'}
    },
    {
      type: 'node',
      id: 9275173403,
      lat: 46.752599,
      lon: 7.698929,
      tags: {name: 'Schluechtegg', ele: '1279'}
    },
    {
      type: 'node',
      id: 9275173451,
      lat: 46.765084,
      lon: 7.69857,
      tags: {name: 'Roteberg', ele: '1201'}
    },
    {
      type: 'node',
      id: 9275173452,
      lat: 46.76567,
      lon: 7.686819,
      tags: {name: 'Egg', ele: '1172'}
    },
    {
      type: 'node',
      id: 9275173454,
      lat: 46.765709,
      lon: 7.678875,
      tags: {name: 'Winteregg', ele: '1150'}
    },
    {
      type: 'node',
      id: 9300410152,
      lat: 46.785127,
      lon: 7.866277,
      tags: {name: 'Hohgant West', ele: '2062'}
    },
    {
      type: 'node',
      id: 9308713699,
      lat: 46.776789,
      lon: 7.96961,
      tags: {name: 'Niesen', ele: '1748'}
    },
    {
      type: 'node',
      id: 9895245351,
      lat: 46.59696,
      lon: 8.041356,
      tags: {name: 'Ostegg', ele: '2710'}
    },
    {
      type: 'node',
      id: 9895245358,
      lat: 46.580446,
      lon: 8.01268,
      tags: {name: 'Grosser Turm', ele: '3688'}
    },
    {
      type: 'node',
      id: 9906444578,
      lat: 46.602825,
      lon: 7.84108,
      tags: {name: 'Kleines Lobhorn', ele: '2519'}
    },
    {
      type: 'node',
      id: 9962441936,
      lat: 46.555554,
      lon: 8.075786,
      tags: {name: 'Kleines Fiescherhorn Ochs', ele: '3895'}
    },
    {
      type: 'node',
      id: 10002653673,
      lat: 46.622222,
      lon: 7.862126,
      tags: {name: 'Schärihubel', ele: '2124'}
    },
    {
      type: 'node',
      id: 10002653682,
      lat: 46.606631,
      lon: 7.840878,
      tags: {name: 'Schnäbel', ele: '2422'}
    },
    {
      type: 'node',
      id: 10002653683,
      lat: 46.605603,
      lon: 7.854426,
      tags: {name: 'Schwarze Schopf', ele: '2285'}
    },
    {
      type: 'node',
      id: 10011503025,
      lat: 46.593217,
      lon: 7.875174,
      tags: {name: 'Soushorn', ele: '2327'}
    },
    {
      type: 'node',
      id: 10011503030,
      lat: 46.588446,
      lon: 7.868837,
      tags: {name: 'Ougstmatthoren', ele: '2462'}
    },
    {
      type: 'node',
      id: 10011503048,
      lat: 46.538924,
      lon: 7.810834,
      tags: {name: 'Hundsflue', ele: '2860'}
    },
    {
      type: 'node',
      id: 10184109251,
      lat: 46.786604,
      lon: 7.895079,
      tags: {name: 'Drei Bären', ele: '2161'}
    },
    {
      type: 'node',
      id: 10761452772,
      lat: 46.51252,
      lon: 7.812949,
      tags: {name: 'Wildstein', ele: '2615'}
    },
    {
      type: 'node',
      id: 11223401274,
      lat: 46.679822,
      lon: 7.621844,
      tags: {name: 'Zwärgli / Vorspitz', ele: '1380'}
    },
    {
      type: 'node',
      id: 11396658822,
      lat: 46.548943,
      lon: 7.705402,
      tags: {name: 'Ärmigchnubel', ele: '2412'}
    },
    {
      type: 'node',
      id: 11537020024,
      lat: 46.453049,
      lon: 7.84452,
      tags: {name: 'Chrindelspitza', ele: '3016'}
    },
    {
      type: 'node',
      id: 11537165063,
      lat: 46.503286,
      lon: 7.921095,
      tags: {name: 'Wildhoren', ele: '3047'}
    },
    {
      type: 'node',
      id: 11537254234,
      lat: 46.503498,
      lon: 7.821708,
      tags: {name: 'Kamel', ele: '3094'}
    },
    {
      type: 'node',
      id: 11537259496,
      lat: 46.451417,
      lon: 7.816845,
      tags: {name: 'Tellispitza', ele: '3081'}
    },
    {
      type: 'node',
      id: 11537279037,
      lat: 46.630514,
      lon: 8.115376,
      tags: {name: 'Hick', ele: '3127'}
    },
    {
      type: 'node',
      id: 11537297796,
      lat: 46.569816,
      lon: 8.081138,
      tags: {name: 'Pfaffestecki', ele: '3113'}
    },
    {
      type: 'node',
      id: 11537485522,
      lat: 46.469018,
      lon: 7.911618,
      tags: {name: 'Jegichnubel', ele: '3124'}
    },
    {
      type: 'node',
      id: 11537579431,
      lat: 46.604753,
      lon: 8.085056,
      tags: {name: 'Ankenbälli', ele: '3160'}
    },
    {
      type: 'node',
      id: 11537753942,
      lat: 46.486209,
      lon: 7.850127,
      tags: {name: 'Wetterhorn', ele: '3233'}
    },
    {
      type: 'node',
      id: 11537858364,
      lat: 46.549308,
      lon: 7.96181,
      tags: {name: 'Schneehoren', ele: '3400'}
    },
    {
      type: 'node',
      id: 11537895109,
      lat: 46.483323,
      lon: 7.890997,
      tags: {name: 'Zuckerstock', ele: '3383'}
    },
    {
      type: 'node',
      id: 11537929940,
      lat: 46.477905,
      lon: 7.843501,
      tags: {name: 'Kleines Tschingelhorn', ele: '3494'}
    },
    {
      type: 'node',
      id: 11537942373,
      lat: 46.571496,
      lon: 7.995952,
      tags: {name: 'Chlyne Eiger', ele: '3467'}
    },
    {
      type: 'node',
      id: 11538003829,
      lat: 46.554285,
      lon: 8.13138,
      tags: {name: 'Nasse Strahlegg', ele: '3481'}
    },
    {
      type: 'node',
      id: 11538010745,
      lat: 46.478722,
      lon: 8.103542,
      tags: {name: 'Wannenzwillinge', ele: '3480'}
    },
    {
      type: 'node',
      id: 11538124174,
      lat: 46.547666,
      lon: 7.985411,
      tags: {name: 'Sphinx', ele: '3571'}
    },
    {
      type: 'node',
      id: 11538149880,
      lat: 46.479641,
      lon: 7.949381,
      tags: {name: 'Anuchnubel', ele: '3589'}
    },
    {
      type: 'node',
      id: 11538150943,
      lat: 46.572926,
      lon: 8.146868,
      tags: {name: 'Hugihorn', ele: '3647'}
    },
    {
      type: 'node',
      id: 11538210082,
      lat: 46.518089,
      lon: 8.081454,
      tags: {name: 'Grünhörnli', ele: '3595'}
    },
    {
      type: 'node',
      id: 11538251441,
      lat: 46.475794,
      lon: 7.875102,
      tags: {name: 'Kleines Breithorn', ele: '3654'}
    },
    {
      type: 'node',
      id: 11538251745,
      lat: 46.455567,
      lon: 7.949061,
      tags: {name: 'Distlighorn', ele: '3723'}
    },
    {
      type: 'node',
      id: 11538280260,
      lat: 46.579006,
      lon: 8.139219,
      tags: {name: 'Kleines Lauteraarhorn', ele: '3738'}
    },
    {
      type: 'node',
      id: 11538346455,
      lat: 46.539654,
      lon: 7.963345,
      tags: {name: 'Wengen Jungfrau', ele: '4085'}
    },
    {
      type: 'node',
      id: 11540033768,
      lat: 46.563914,
      lon: 7.846036,
      tags: {name: 'Schwarzbirg', ele: '2791'}
    },
    {
      type: 'node',
      id: 11586484042,
      lat: 46.74847,
      lon: 7.71519,
      tags: {name: 'Blueme', ele: '1392'}
    },
    {
      type: 'node',
      id: 12035590326,
      lat: 46.47092,
      lon: 7.680411,
      tags: {name: 'Fisischafberg'}
    },
    {
      type: 'node',
      id: 12040710096,
      lat: 46.578018,
      lon: 7.889206,
      tags: {name: 'Dorenhubel', ele: '1897'}
    },
    {
      type: 'node',
      id: 12040710125,
      lat: 46.514612,
      lon: 7.992154,
      tags: {name: 'Kranzberg Südgipfel', ele: '3666'}
    },
    {
      type: 'node',
      id: 12040710128,
      lat: 46.524585,
      lon: 7.87268,
      tags: {name: 'Schafhoren', ele: '2228'}
    },
    {
      type: 'node',
      id: 12040710139,
      lat: 46.556099,
      lon: 7.84007,
      tags: {name: 'Chlys Schilthoren', ele: '2863'}
    },
    {
      type: 'node',
      id: 12040710152,
      lat: 46.548473,
      lon: 7.859324,
      tags: {name: 'Chlyni Nadla', ele: '2227'}
    },
    {
      type: 'node',
      id: 12040710181,
      lat: 46.666405,
      lon: 7.955957,
      tags: {name: 'Ussri Sägissa', ele: '2426'}
    },
    {
      type: 'node',
      id: 12040710208,
      lat: 46.478755,
      lon: 8.044957,
      tags: {name: 'Drittes Dreieck', ele: '2952'}
    },
    {
      type: 'node',
      id: 12040710215,
      lat: 46.666025,
      lon: 8.136986,
      tags: {name: 'Scheenenbielhubel', ele: '2066'}
    },
    {
      type: 'node',
      id: 12040710221,
      lat: 46.654834,
      lon: 8.103892,
      tags: {name: 'Schlafhubel', ele: '2035'}
    },
    {
      type: 'node',
      id: 12040710224,
      lat: 46.487683,
      lon: 8.03564,
      tags: {name: 'Viertes Dreieck', ele: '3016'}
    },
    {
      type: 'node',
      id: 12040710229,
      lat: 46.488855,
      lon: 7.654722,
      tags: {name: 'Hellhore', ele: '1792'}
    },
    {
      type: 'node',
      id: 12040710246,
      lat: 46.521797,
      lon: 7.754899,
      tags: {name: 'Chlyne Bundstock', ele: '2560'}
    },
    {
      type: 'node',
      id: 12040710282,
      lat: 46.50891,
      lon: 7.740362,
      tags: {name: 'Fuli Flue', ele: '2119'}
    },
    {
      type: 'node',
      id: 12040710287,
      lat: 46.581268,
      lon: 7.697608,
      tags: {name: 'Hore am Rüederigs', ele: '1858'}
    },
    {
      type: 'node',
      id: 12040710293,
      lat: 46.656408,
      lon: 7.968417,
      tags: {name: 'Tissel', ele: '2190'}
    },
    {
      type: 'node',
      id: 12040710303,
      lat: 46.684269,
      lon: 8.094634,
      tags: {name: 'Bandspitz', ele: '2401'}
    },
    {
      type: 'node',
      id: 12040710306,
      lat: 46.667585,
      lon: 8.073301,
      tags: {name: 'Hohbiel', ele: '2112'}
    },
    {
      type: 'node',
      id: 12040710315,
      lat: 46.523982,
      lon: 7.855889,
      tags: {name: 'Hinders Busenhoren', ele: '2283'}
    },
    {
      type: 'node',
      id: 12040710329,
      lat: 46.608295,
      lon: 7.77839,
      tags: {name: 'Witliflue', ele: '1967'}
    },
    {
      type: 'node',
      id: 12040710337,
      lat: 46.659427,
      lon: 7.963233,
      tags: {name: 'Bira', ele: '2456'}
    },
    {
      type: 'node',
      id: 12040710350,
      lat: 46.581248,
      lon: 7.84614,
      tags: {name: 'Mättenberg', ele: '2188'}
    },
    {
      type: 'node',
      id: 12040710357,
      lat: 46.699661,
      lon: 7.992795,
      tags: {name: 'Litschgiburg', ele: '2069'}
    },
    {
      type: 'node',
      id: 12040710360,
      lat: 46.584329,
      lon: 7.984634,
      tags: {name: 'Chräjenbiel', ele: '2158'}
    },
    {
      type: 'node',
      id: 12040710396,
      lat: 46.50511,
      lon: 7.624562,
      tags: {name: 'Metschhore', ele: '2229'}
    },
    {
      type: 'node',
      id: 12040710402,
      lat: 46.575844,
      lon: 8.084763,
      tags: {name: 'Obere Buggel', ele: '2831'}
    },
    {
      type: 'node',
      id: 12040710429,
      lat: 46.799622,
      lon: 8.019706,
      tags: {name: 'Hunds-Chnubel', ele: '1690'}
    },
    {
      type: 'node',
      id: 12040710441,
      lat: 46.604133,
      lon: 8.075742,
      tags: {name: 'Bräntlershorn', ele: '2699'}
    },
    {
      type: 'node',
      id: 12040710444,
      lat: 46.582365,
      lon: 7.832933,
      tags: {name: 'Mära', ele: '2609'}
    },
    {
      type: 'node',
      id: 12040710454,
      lat: 46.473811,
      lon: 8.100592,
      tags: {name: 'Senfspitze', ele: '3353'}
    },
    {
      type: 'node',
      id: 12040710465,
      lat: 46.526966,
      lon: 7.856563,
      tags: {name: 'Äbenhoren', ele: '2148'}
    },
    {
      type: 'node',
      id: 12040710478,
      lat: 46.477356,
      lon: 8.123292,
      tags: {name: 'Distelspitz', ele: '3071'}
    },
    {
      type: 'node',
      id: 12040710509,
      lat: 46.764221,
      lon: 7.884044,
      tags: {name: 'Höchst', ele: '1792'}
    },
    {
      type: 'node',
      id: 12040710514,
      lat: 46.697861,
      lon: 7.987376,
      tags: {name: 'Bättenalpburg', ele: '2135'}
    },
    {
      type: 'node',
      id: 12040710550,
      lat: 46.548888,
      lon: 7.856732,
      tags: {name: 'Grossi Nadla', ele: '2237'}
    },
    {
      type: 'node',
      id: 12040710551,
      lat: 46.668917,
      lon: 7.963547,
      tags: {name: 'Indri Sägissa', ele: '2462'}
    },
    {
      type: 'node',
      id: 12040710553,
      lat: 46.669268,
      lon: 7.990105,
      tags: {name: 'Hohtissel', ele: '2500'}
    },
    {
      type: 'node',
      id: 12040710571,
      lat: 46.536392,
      lon: 7.935241,
      tags: {name: 'Mälchstuel', ele: '2764'}
    },
    {
      type: 'node',
      id: 12040710572,
      lat: 46.467843,
      lon: 8.054977,
      tags: {name: 'Erstes Dreieck', ele: '2995'}
    },
    {
      type: 'node',
      id: 12040710582,
      lat: 46.640058,
      lon: 7.813004,
      tags: {name: 'Rotenegg', ele: '1890'}
    },
    {
      type: 'node',
      id: 12040710622,
      lat: 46.631593,
      lon: 7.80481,
      tags: {name: 'Gross-Schiffli', ele: '2038'}
    },
    {
      type: 'node',
      id: 12040710637,
      lat: 46.582911,
      lon: 7.690988,
      tags: {name: 'Höri', ele: '1783'}
    },
    {
      type: 'node',
      id: 12040710651,
      lat: 46.661048,
      lon: 7.951085,
      tags: {name: 'Burg', ele: '2240'}
    },
    {
      type: 'node',
      id: 12040710652,
      lat: 46.619278,
      lon: 7.925152,
      tags: {name: 'Grindegg', ele: '1869'}
    },
    {
      type: 'node',
      id: 12040710671,
      lat: 46.526146,
      lon: 7.864142,
      tags: {name: 'Vorders Busenhoren', ele: '2229'}
    },
    {
      type: 'node',
      id: 12040710691,
      lat: 46.681546,
      lon: 7.957736,
      tags: {name: 'Roteflue', ele: '2296'}
    },
    {
      type: 'node',
      id: 12040710698,
      lat: 46.520382,
      lon: 7.828221,
      tags: {name: 'Jegihoren', ele: '2610'}
    },
    {
      type: 'node',
      id: 12040710702,
      lat: 46.613044,
      lon: 7.859525,
      tags: {name: 'Grätli', ele: '2109'}
    },
    {
      type: 'node',
      id: 12040710706,
      lat: 46.748129,
      lon: 7.919429,
      tags: {name: 'Rengghuppi', ele: '1699'}
    },
    {
      type: 'node',
      id: 12040710732,
      lat: 46.527393,
      lon: 7.862562,
      tags: {name: 'Mittlers Busenhoren', ele: '2200'}
    },
    {
      type: 'node',
      id: 12040710775,
      lat: 46.619589,
      lon: 7.930181,
      tags: {name: 'Bärenbodengrind', ele: '2021'}
    },
    {
      type: 'node',
      id: 12040710779,
      lat: 46.573692,
      lon: 7.897988,
      tags: {name: 'Mittelberg', ele: '1753'}
    },
    {
      type: 'node',
      id: 12040710780,
      lat: 46.682103,
      lon: 8.109679,
      tags: {name: 'Cheerhubel', ele: '2213'}
    },
    {
      type: 'node',
      id: 12040710781,
      lat: 46.661876,
      lon: 8.09661,
      tags: {name: 'Chiemattenhubla', ele: '2029'}
    },
    {
      type: 'node',
      id: 12040710784,
      lat: 46.523189,
      lon: 7.863559,
      tags: {name: 'Ghudelhoren', ele: '2424'}
    },
    {
      type: 'node',
      id: 12040710814,
      lat: 46.68538,
      lon: 7.96525,
      tags: {name: 'Furggenhoren', ele: '2170'}
    },
    {
      type: 'node',
      id: 12040710827,
      lat: 46.588646,
      lon: 7.802563,
      tags: {name: 'Glütschhöreli', ele: '2521'}
    },
    {
      type: 'node',
      id: 12040710838,
      lat: 46.586729,
      lon: 7.942096,
      tags: {name: 'Galtbachhoren', ele: '2169'}
    },
    {
      type: 'node',
      id: 12040710852,
      lat: 46.78988,
      lon: 8.111505,
      tags: {name: 'First', ele: '1815'}
    },
    {
      type: 'node',
      id: 12040710875,
      lat: 46.508279,
      lon: 7.922997,
      tags: {name: 'Beeswenghoren', ele: '2754'}
    },
    {
      type: 'node',
      id: 12040710877,
      lat: 46.657038,
      lon: 7.944527,
      tags: {name: 'Stellihorn', ele: '2077'}
    },
    {
      type: 'node',
      id: 12040710908,
      lat: 46.515824,
      lon: 7.709636,
      tags: {name: 'Zahlershorn', ele: '2744'}
    },
    {
      type: 'node',
      id: 12040710909,
      lat: 46.614371,
      lon: 7.845828,
      tags: {name: 'Nideri Sulegg', ele: '2345'}
    },
    {
      type: 'node',
      id: 12040710928,
      lat: 46.783199,
      lon: 8.004745,
      tags: {name: 'Briefehörnli', ele: '2165'}
    },
    {
      type: 'node',
      id: 12040710956,
      lat: 46.509964,
      lon: 7.626272,
      tags: {name: 'Widerhubel', ele: '2142'}
    },
    {
      type: 'node',
      id: 12040710959,
      lat: 46.571376,
      lon: 7.949545,
      tags: {name: 'Wyssi Flue', ele: '1869'}
    },
    {
      type: 'node',
      id: 12040710960,
      lat: 46.522734,
      lon: 7.649422,
      tags: {name: 'Chilchhore', ele: '2162'}
    },
    {
      type: 'node',
      id: 12040710970,
      lat: 46.791556,
      lon: 7.989888,
      tags: {name: 'Arnibergegg', ele: '1604'}
    },
    {
      type: 'node',
      id: 12040710973,
      lat: 46.659604,
      lon: 8.02659,
      tags: {name: 'Hireleni', ele: '2357'}
    },
    {
      type: 'node',
      id: 12040710992,
      lat: 46.522172,
      lon: 7.641509,
      tags: {name: 'Homattihubel', ele: '2109'}
    },
    {
      type: 'node',
      id: 12040711005,
      lat: 46.606793,
      lon: 7.812696,
      tags: {name: 'Doren', ele: '1986'}
    },
    {
      type: 'node',
      id: 12040711037,
      lat: 46.602386,
      lon: 8.071231,
      tags: {name: 'Brunnhorn', ele: '2442'}
    }
  ]
};
