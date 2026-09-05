/**
 * starnames-data.js - the IAU Catalog of Star Names (IAU-CSN), the
 * Working Group on Star Names' official list (IAU Division C, WGSN;
 * https://www.iau.org/public/themes/naming_stars/), as served by the
 * WGSN secretary's file IAU-CSN.txt (last updated 2022-04-04; CC BY -
 * "free to use ... as long as the source is mentioned"). Vendored
 * slice: every named star to V = 2.5 (85 of 449 names), with the
 * catalogue's own J2000 RA/Dec in degrees, its V magnitude and its
 * Bayer designation. The pick layer (pick.js) names the catalogue
 * star nearest a click by matching these coordinates against
 * stars.json (the Yale Bright Star Catalog the dome draws).
 */

export const STAR_NAMES = [
  {
    name: 'Sirius',
    bayer: 'α CMa',
    mag: -1.45,
    raDeg: 101.287155,
    decDeg: -16.716116
  },
  {
    name: 'Canopus',
    bayer: 'α Car',
    mag: -0.62,
    raDeg: 95.987958,
    decDeg: -52.695661
  },
  {
    name: 'Arcturus',
    bayer: 'α Boo',
    mag: -0.05,
    raDeg: 213.9153,
    decDeg: 19.182409
  },
  {
    name: 'Rigil',
    bayer: 'α Cen',
    mag: -0.01,
    raDeg: 219.902066,
    decDeg: -60.833975
  },
  {
    name: 'Vega',
    bayer: 'α Lyr',
    mag: 0.03,
    raDeg: 279.234735,
    decDeg: 38.783689
  },
  {
    name: 'Capella',
    bayer: 'α Aur',
    mag: 0.08,
    raDeg: 79.172328,
    decDeg: 45.997991
  },
  {
    name: 'Rigel',
    bayer: 'β Ori',
    mag: 0.18,
    raDeg: 78.634467,
    decDeg: -8.201638
  },
  {
    name: 'Procyon',
    bayer: 'α CMi',
    mag: 0.4,
    raDeg: 114.825493,
    decDeg: 5.224993
  },
  {
    name: 'Achernar',
    bayer: 'α Eri',
    mag: 0.45,
    raDeg: 24.428523,
    decDeg: -57.236753
  },
  {
    name: 'Betelgeuse',
    bayer: 'α Ori',
    mag: 0.45,
    raDeg: 88.792939,
    decDeg: 7.407064
  },
  {
    name: 'Hadar',
    bayer: 'β Cen',
    mag: 0.61,
    raDeg: 210.955856,
    decDeg: -60.373035
  },
  {
    name: 'Altair',
    bayer: 'α Aql',
    mag: 0.76,
    raDeg: 297.695827,
    decDeg: 8.868321
  },
  {
    name: 'Aldebaran',
    bayer: 'α Tau',
    mag: 0.87,
    raDeg: 68.980163,
    decDeg: 16.509302
  },
  {
    name: 'Spica',
    bayer: 'α Vir',
    mag: 0.98,
    raDeg: 201.298247,
    decDeg: -11.161319
  },
  {
    name: 'Antares',
    bayer: 'α Sco',
    mag: 1.06,
    raDeg: 247.351915,
    decDeg: -26.432003
  },
  {
    name: 'Pollux',
    bayer: 'β Gem',
    mag: 1.16,
    raDeg: 116.328958,
    decDeg: 28.026199
  },
  {
    name: 'Fomalhaut',
    bayer: 'α PsA',
    mag: 1.17,
    raDeg: 344.412693,
    decDeg: -29.622237
  },
  {
    name: 'Deneb',
    bayer: 'α Cyg',
    mag: 1.25,
    raDeg: 310.35798,
    decDeg: 45.280339
  },
  {
    name: 'Mimosa',
    bayer: 'β Cru',
    mag: 1.25,
    raDeg: 191.930263,
    decDeg: -59.688764
  },
  {
    name: 'Acrux',
    bayer: 'α Cru',
    mag: 1.33,
    raDeg: 186.649563,
    decDeg: -63.099093
  },
  {
    name: 'Toliman',
    bayer: 'α Cen',
    mag: 1.35,
    raDeg: 219.896096,
    decDeg: -60.837528
  },
  {
    name: 'Regulus',
    bayer: 'α Leo',
    mag: 1.36,
    raDeg: 152.092962,
    decDeg: 11.967209
  },
  {
    name: 'Adhara',
    bayer: 'ε CMa',
    mag: 1.5,
    raDeg: 104.656453,
    decDeg: -28.972086
  },
  {
    name: 'Gacrux',
    bayer: 'γ Cru',
    mag: 1.59,
    raDeg: 187.791498,
    decDeg: -57.113213
  },
  {
    name: 'Bellatrix',
    bayer: 'γ Ori',
    mag: 1.64,
    raDeg: 81.282764,
    decDeg: 6.349703
  },
  {
    name: 'Elnath',
    bayer: 'β Tau',
    mag: 1.65,
    raDeg: 81.572971,
    decDeg: 28.607452
  },
  {
    name: 'Miaplacidus',
    bayer: 'β Car',
    mag: 1.67,
    raDeg: 138.299906,
    decDeg: -69.717208
  },
  {
    name: 'Alnilam',
    bayer: 'ε Ori',
    mag: 1.69,
    raDeg: 84.053389,
    decDeg: -1.201919
  },
  {
    name: 'Alnair',
    bayer: 'α Gru',
    mag: 1.73,
    raDeg: 332.05827,
    decDeg: -46.960974
  },
  {
    name: 'Alnitak',
    bayer: 'ζ Ori',
    mag: 1.74,
    raDeg: 85.189694,
    decDeg: -1.942574
  },
  {
    name: 'Alioth',
    bayer: 'ε UMa',
    mag: 1.76,
    raDeg: 193.50729,
    decDeg: 55.959823
  },
  {
    name: 'Kaus',
    bayer: 'ε Sgr',
    mag: 1.79,
    raDeg: 276.042993,
    decDeg: -34.384616
  },
  {
    name: 'Mirfak',
    bayer: 'α Per',
    mag: 1.79,
    raDeg: 51.080709,
    decDeg: 49.861179
  },
  {
    name: 'Dubhe',
    bayer: 'α UMa',
    mag: 1.81,
    raDeg: 165.931965,
    decDeg: 61.751035
  },
  {
    name: 'Wezen',
    bayer: 'δ CMa',
    mag: 1.83,
    raDeg: 107.09785,
    decDeg: -26.3932
  },
  {
    name: 'Alkaid',
    bayer: 'η UMa',
    mag: 1.85,
    raDeg: 206.885157,
    decDeg: 49.313267
  },
  {
    name: 'Avior',
    bayer: 'ε Car',
    mag: 1.86,
    raDeg: 125.62848,
    decDeg: -59.509484
  },
  {
    name: 'Sargas',
    bayer: 'θ Sco',
    mag: 1.86,
    raDeg: 264.329711,
    decDeg: -42.997824
  },
  {
    name: 'Menkalinan',
    bayer: 'β Aur',
    mag: 1.9,
    raDeg: 89.882179,
    decDeg: 44.947433
  },
  {
    name: 'Atria',
    bayer: 'α TrA',
    mag: 1.91,
    raDeg: 252.166229,
    decDeg: -69.027712
  },
  {
    name: 'Alhena',
    bayer: 'γ Gem',
    mag: 1.93,
    raDeg: 99.42796,
    decDeg: 16.39928
  },
  {
    name: 'Peacock',
    bayer: 'α Pav',
    mag: 1.94,
    raDeg: 306.411904,
    decDeg: -56.73509
  },
  {
    name: 'Castor',
    bayer: 'α Gem',
    mag: 1.98,
    raDeg: 113.649428,
    decDeg: 31.888276
  },
  {
    name: 'Mirzam',
    bayer: 'β CMa',
    mag: 1.98,
    raDeg: 95.674939,
    decDeg: -17.955919
  },
  {
    name: 'Alphard',
    bayer: 'α Hya',
    mag: 1.99,
    raDeg: 141.896847,
    decDeg: -8.658602
  },
  {
    name: 'Alsephina',
    bayer: 'δ Vel',
    mag: 1.99,
    raDeg: 131.175944,
    decDeg: -54.708819
  },
  {
    name: 'Hamal',
    bayer: 'α Ari',
    mag: 2.01,
    raDeg: 31.793357,
    decDeg: 23.462418
  },
  {
    name: 'Diphda',
    bayer: 'β Cet',
    mag: 2.04,
    raDeg: 10.897379,
    decDeg: -17.986606
  },
  {
    name: 'Nunki',
    bayer: 'σ Sgr',
    mag: 2.05,
    raDeg: 283.81636,
    decDeg: -26.296724
  },
  {
    name: 'Menkent',
    bayer: 'θ Cen',
    mag: 2.06,
    raDeg: 211.670617,
    decDeg: -36.369958
  },
  {
    name: 'Alpheratz',
    bayer: 'α And',
    mag: 2.07,
    raDeg: 2.096916,
    decDeg: 29.090431
  },
  {
    name: 'Kochab',
    bayer: 'β UMi',
    mag: 2.07,
    raDeg: 222.676357,
    decDeg: 74.155504
  },
  {
    name: 'Mirach',
    bayer: 'β And',
    mag: 2.07,
    raDeg: 17.433013,
    decDeg: 35.620557
  },
  {
    name: 'Saiph',
    bayer: 'κ Ori',
    mag: 2.07,
    raDeg: 86.93912,
    decDeg: -9.669605
  },
  {
    name: 'Rasalhague',
    bayer: 'α Oph',
    mag: 2.08,
    raDeg: 263.733627,
    decDeg: 12.560035
  },
  {
    name: 'Shaula',
    bayer: 'λ Sco',
    mag: 2.08,
    raDeg: 263.402167,
    decDeg: -37.103824
  },
  {
    name: 'Algol',
    bayer: 'β Per',
    mag: 2.09,
    raDeg: 47.042215,
    decDeg: 40.955648
  },
  {
    name: 'Almach',
    bayer: 'γ And',
    mag: 2.1,
    raDeg: 30.974804,
    decDeg: 42.329725
  },
  {
    name: 'Tiaki',
    bayer: 'β Gru',
    mag: 2.12,
    raDeg: 340.666876,
    decDeg: -46.884576
  },
  {
    name: 'Polaris',
    bayer: 'α UMi',
    mag: 2.13,
    raDeg: 37.954561,
    decDeg: 89.264109
  },
  {
    name: 'Denebola',
    bayer: 'β Leo',
    mag: 2.14,
    raDeg: 177.26491,
    decDeg: 14.572058
  },
  {
    name: 'Aspidiske',
    bayer: 'ι Car',
    mag: 2.21,
    raDeg: 139.272529,
    decDeg: -59.275232
  },
  {
    name: 'Naos',
    bayer: 'ζ Pup',
    mag: 2.21,
    raDeg: 120.896031,
    decDeg: -40.003148
  },
  {
    name: 'Alphecca',
    bayer: 'α CrB',
    mag: 2.22,
    raDeg: 233.67195,
    decDeg: 26.714693
  },
  {
    name: 'Mizar',
    bayer: 'ζ UMa',
    mag: 2.23,
    raDeg: 200.981429,
    decDeg: 54.925362
  },
  {
    name: 'Sadr',
    bayer: 'γ Cyg',
    mag: 2.23,
    raDeg: 305.557091,
    decDeg: 40.256679
  },
  {
    name: 'Suhail',
    bayer: 'λ Vel',
    mag: 2.23,
    raDeg: 136.998993,
    decDeg: -43.432589
  },
  {
    name: 'Eltanin',
    bayer: 'γ Dra',
    mag: 2.24,
    raDeg: 269.151541,
    decDeg: 51.488896
  },
  {
    name: 'Schedar',
    bayer: 'α Cas',
    mag: 2.24,
    raDeg: 10.126838,
    decDeg: 56.537331
  },
  {
    name: 'Mintaka',
    bayer: 'δ Ori',
    mag: 2.25,
    raDeg: 83.001667,
    decDeg: -0.299095
  },
  {name: 'Caph', bayer: 'β Cas', mag: 2.28, raDeg: 2.294522, decDeg: 59.149781},
  {
    name: 'Dschubba',
    bayer: 'δ Sco',
    mag: 2.29,
    raDeg: 240.083359,
    decDeg: -22.62171
  },
  {
    name: 'Larawag',
    bayer: 'ε Sco',
    mag: 2.29,
    raDeg: 252.540878,
    decDeg: -34.293232
  },
  {
    name: 'Merak',
    bayer: 'β UMa',
    mag: 2.34,
    raDeg: 165.460319,
    decDeg: 56.382426
  },
  {
    name: 'Izar',
    bayer: 'ε Boo',
    mag: 2.35,
    raDeg: 221.246763,
    decDeg: 27.074207
  },
  {
    name: 'Enif',
    bayer: 'ε Peg',
    mag: 2.38,
    raDeg: 326.046484,
    decDeg: 9.875009
  },
  {
    name: 'Ankaa',
    bayer: 'α Phe',
    mag: 2.4,
    raDeg: 6.570939,
    decDeg: -42.306084
  },
  {
    name: 'Phecda',
    bayer: 'γ UMa',
    mag: 2.41,
    raDeg: 178.457679,
    decDeg: 53.694758
  },
  {
    name: 'Sabik',
    bayer: 'η Oph',
    mag: 2.43,
    raDeg: 257.594529,
    decDeg: -15.724907
  },
  {
    name: 'Scheat',
    bayer: 'β Peg',
    mag: 2.44,
    raDeg: 345.943572,
    decDeg: 28.082785
  },
  {
    name: 'Alderamin',
    bayer: 'α Cep',
    mag: 2.45,
    raDeg: 319.644885,
    decDeg: 62.585574
  },
  {
    name: 'Aludra',
    bayer: 'η CMa',
    mag: 2.45,
    raDeg: 111.02376,
    decDeg: -29.303106
  },
  {
    name: 'Markeb',
    bayer: 'κ Vel',
    mag: 2.47,
    raDeg: 140.528407,
    decDeg: -55.010667
  },
  {
    name: 'Aljanah',
    bayer: 'ε Cyg',
    mag: 2.48,
    raDeg: 311.552843,
    decDeg: 33.970257
  },
  {
    name: 'Markab',
    bayer: 'α Peg',
    mag: 2.49,
    raDeg: 346.190223,
    decDeg: 15.205267
  }
];
