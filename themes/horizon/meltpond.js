/**
 * meltpond.js - the colour of Arctic melt ponds from the printed
 * two-stream model, and the measured seasonal pond fraction. The
 * summer ice stops being uniformly white: the ponded part of the
 * drawn floe turns the blue the physics says it must.
 *
 * Sources, read in full:
 *  - Lu, Lepparanta, Cheng & Li 2016, "Influence of melt-pond
 *    depth and ice thickness on Arctic sea-ice albedo and light
 *    transmittance", Cold Reg. Sci. Technol. 124, 1-10 - via the
 *    author manuscript deposited in Helda (hdl:10138/173644; the
 *    journal copy is paywalled). The display equations there are
 *    Equation-Editor WMF drawings; they were recovered verbatim
 *    from the drawings' own text records:
 *      Eq. 1:  dF|v = -k F|v dz - s F|v dz + s F|^ dz  (and the
 *              opposite-sign twin for F|^),
 *      Eq. 2:  F|v(z) = A(1-mu)e^{kap z} + B(1+mu)e^{-kap z},
 *              F|^(z) = A(1+mu)e^{kap z} + B(1-mu)e^{-kap z},
 *      mu  = sqrt(k/(k+2s))   (1 purely absorbing, 0 scattering),
 *      kap = sqrt(k(k+2s))    (Perovich 1990's attenuation),
 *      BCs (Eqs. 4-6): pond top gains (1-R1)F0 plus R1'' of the
 *      upwelling reflected back down; pond-ice and ice-ocean
 *      interfaces are continuous (R2 = 0, printed); no upwelling
 *      from the ocean (printed, after Smith 1973); the albedo is
 *      R1 F0 + (1-R1'')F|^p(0) over F0 (Eq. 8).
 *    Constants as printed: R1 = 0.05 (diffuse air-water Fresnel,
 *    after Perovich 1990); R1'' = (1-R1)/n_w^2 = 0.54 (upwelling
 *    at the water-air interface, after Dera 1992; n_w = 1.33 in
 *    their Fig. 1); sigma_i = 2.5 m^-1 (gas-bubble scattering of
 *    porous summer interior ice, after Perovich 1990 - printed
 *    realistic range 1.2-2.5 m^-1, and their Sec. 5.1 shows the
 *    resulting albedo band); melt-pond water scatters nothing
 *    (sigma_w = 0, printed); k_i = nu_pi k_pureice + nu_bp k_w
 *    (their Eq. 3) with the printed Huang et al. 2013 windows
 *    nu_pi >= 60 %, nu_bp <= 20 % - the window centres 0.8/0.1
 *    carried here; the paper prints the whole window moving the
 *    result by less than +-20 % in k and < 0.02 in albedo.
 *    Defaults Hp = 0.3 m, Hi = 1.0 m: the printed Perovich et
 *    al. 2009 field values for clear ponds on typical Arctic FYI.
 *    The three-layer solution is solved here in closed form; the
 *    reference gate verifies the closed form satisfies the
 *    printed ODEs and all four printed boundary conditions to
 *    machine precision, and lands on the paper's own printed
 *    numbers (albedo = 0.05 exactly with no scattering; the
 *    underlying-ice albedo window 0.5-0.7; the 350-600 vs
 *    600-900 nm sensitivity split).
 *  - Lu, Lepparanta, Cheng, Li, Istomina & Heygster 2018, "The
 *    color of melt ponds on Arctic sea ice", The Cryosphere 12,
 *    1331-1345: the same RTM turned into colour. Printed there
 *    and held by the gate: the melting case Hi + delta Hp =
 *    1.3 m with delta = 1.3 (porous summer ice, after Huang et
 *    al. 2013) takes the pond albedo 0.5 -> 0.05 and the RGB
 *    intensities "from about 0.6 to 0.05", the colour running
 *    "from gray to blue and then to almost black"; the red band
 *    stays lowest and falls almost linearly while green and blue
 *    fall faster at the end; the in situ HSL windows of Istomina
 *    et al. 2016 (hue 0.2-0.5, saturation 0-0.5, luminance
 *    0.4-0.6) with the printed model-vs-measurement 2*eps = 0.22
 *    band (R = 0.822, P < 0.01, eps = 0.110); and the printed
 *    licence for an equal-energy colour fold - the incident
 *    spectrum moves hue/saturation by < 0.15 and luminance by
 *    < 0.04.
 *  - Rosel, Kaleschke & Birnbaum 2012, "Melt ponds on Arctic sea
 *    ice determined from MODIS satellite data using an artificial
 *    neural network", The Cryosphere 6, 431-446: the measured
 *    relative pond fraction (fraction OF THE ICE surface) for the
 *    whole Arctic, 2000-2011. Printed: the mean annual cycle
 *    rises strongly in June to a maximum ABOVE 15 % at the end of
 *    June, has a second maximum at the end of July, and the data
 *    season is day 129 to day 249; the retrieval domain is the
 *    Arctic Ocean north of 60 N (southern hemisphere: no data, no
 *    ponds drawn); ponds can reach 70 % on flat first-year ice.
 *    The weekly mean curve of their Fig. 6 is vendored below,
 *    machine-read from the figure's embedded raster (axis frame
 *    and labels located programmatically; the printed anchors
 *    above gate the read). New snow covers ponds (printed) - the
 *    drawn pond fraction rides the snow-free part of the ice mix.
 *
 * Spectral inputs, vendored verbatim:
 *  - k_w: Smith & Baker 1981, "Optical properties of the clearest
 *    natural waters (200-800 nm)", Appl. Opt. 20, 177-184 - the
 *    clear-natural-water absorption column (the source Lu 2016
 *    prints for 350-800 nm), via the OMLC digitisation of the
 *    printed table (omlc.org/spectra/water/data/smith81.txt),
 *    converted 1/cm -> 1/m.
 *  - kappa_ice: Warren & Brandt 2008 compilation rows at the same
 *    wavelengths - the SAME published ASCII table already
 *    vendored per-channel in seaice.js (the gate cross-checks the
 *    three shared rows are identical); k_pureice = 4 pi kappa /
 *    lambda (the relation Lu 2016 prints for the Kou extension).
 */

// [lambda nm, k_w (m^-1, Smith & Baker 1981), kappa (Warren &
// Brandt 2008)]. 350-800 nm; WB2008 tabulates no 360-380 rows.
export const POND_SPECTRAL = [
  [350, 0.0463, 2e-11],
  [390, 0.0191, 2e-11],
  [400, 0.0171, 2.365e-11],
  [410, 0.0162, 2.669e-11],
  [420, 0.0153, 3.135e-11],
  [430, 0.0144, 4.14e-11],
  [440, 0.0145, 6.268e-11],
  [450, 0.0145, 9.239e-11],
  [460, 0.0156, 1.325e-10],
  [470, 0.0156, 1.956e-10],
  [480, 0.0176, 2.861e-10],
  [490, 0.0196, 4.172e-10],
  [500, 0.0257, 5.889e-10],
  [510, 0.0357, 8.036e-10],
  [520, 0.0477, 1.076e-9],
  [530, 0.0507, 1.409e-9],
  [540, 0.0558, 1.813e-9],
  [550, 0.0638, 2.289e-9],
  [560, 0.0708, 2.839e-9],
  [570, 0.0799, 3.461e-9],
  [580, 0.108, 4.159e-9],
  [590, 0.157, 4.93e-9],
  [600, 0.244, 5.73e-9],
  [610, 0.289, 6.89e-9],
  [620, 0.309, 8.58e-9],
  [630, 0.319, 1.04e-8],
  [640, 0.329, 1.22e-8],
  [650, 0.349, 1.43e-8],
  [660, 0.4, 1.66e-8],
  [670, 0.43, 1.89e-8],
  [680, 0.45, 2.09e-8],
  [690, 0.5, 2.4e-8],
  [700, 0.65, 2.9e-8],
  [710, 0.839, 3.44e-8],
  [720, 1.169, 4.03e-8],
  [730, 1.799, 4.3e-8],
  [740, 2.38, 4.92e-8],
  [750, 2.47, 5.87e-8],
  [760, 2.55, 7.08e-8],
  [770, 2.51, 8.58e-8],
  [780, 2.36, 1.02e-7],
  [790, 2.16, 1.18e-7],
  [800, 2.07, 1.34e-7]
];

// The printed constants (see header).
export const POND_R1 = 0.05; // diffuse sky -> water (Perovich 1990)
export const POND_R1PP = 0.54; // upwelling water -> air (Dera 1992)
export const POND_SIGMA_I = 2.5; // m^-1 bubble scattering (Perovich 1990)
export const POND_SIGMA_I_RANGE = [1.2, 2.5]; // printed realistic range
export const NU_PUREICE = 0.8; // centre of printed nu_pi >= 0.6 window
export const NU_BRINE = 0.1; // centre of printed nu_bp <= 0.2 window
export const POND_HP = 0.3; // m - printed default pond depth
export const POND_HI = 1.0; // m - printed default underlying ice
export const MELT_TOTAL = 1.3; // m - printed melting case Hi + delta Hp
export const MELT_DELTA = 1.3; // printed water/porous-ice density ratio

// Eq. 2's parameters, exactly as printed.
export const pondMu = (k, s) => Math.sqrt(k / (k + 2 * s));
export const pondKappa = (k, s) => Math.sqrt(k * (k + 2 * s));

// The ice slab under the pond, solved from Eq. 2 with the printed
// interface conditions (continuity above, zero ocean upwelling
// below): reflectance and transmittance of the slab under diffuse
// irradiance. r is the semi-infinite two-stream albedo (1-mu)/
// (1+mu); X = e^{-2 kap Hi}.
export function iceSlabRT(k, s, Hi) {
  if (s <= 0) {
    // purely absorbing: nothing turns round (mu = 1, r = 0).
    return {R: 0, T: Math.exp(-k * Hi)};
  }
  const mu = pondMu(k, s);
  const kap = pondKappa(k, s);
  const r = (1 - mu) / (1 + mu);
  const X = Math.exp(-2 * kap * Hi);
  const denom = 1 - r * r * X;
  return {
    R: (r * (1 - X)) / denom,
    T: (Math.sqrt(X) * (1 - r * r)) / denom
  };
}

// Absorption of the sea ice under the pond, Eq. 3 at the printed
// window centres: k_i = nu_pi (4 pi kappa / lambda) + nu_bp k_w.
export function pondKIce(nm, kw, kappa) {
  return NU_PUREICE * ((4 * Math.PI * kappa) / (nm * 1e-9)) + NU_BRINE * kw;
}

// The three-layer closed form. The pond water only absorbs
// (sigma_w = 0 printed), so Eq. 2 decouples there into the two
// Beer legs W = e^{-kw Hp} each way; the four printed boundary
// conditions then give, with b the downwelling and a the
// upwelling irradiance at the pond top (F0 = 1):
//   a = Rice W^2 b,   b = (1 - R1) + R1'' a
//   alpha = R1 + (1 - R1'') a       (Eq. 8)
//   T     = Tice W b                (Eq. 8, at the ice bottom)
// The gate verifies this solution against the printed ODEs and
// BCs directly.
export function pondAlphaT(kw, ki, Hp, Hi, sigmaI = POND_SIGMA_I) {
  const {R: Rice, T: Tice} = iceSlabRT(ki, sigmaI, Hi);
  const W = Math.exp(-kw * Hp);
  const b = (1 - POND_R1) / (1 - POND_R1PP * Rice * W * W);
  const a = Rice * W * W * b;
  return {
    alpha: POND_R1 + (1 - POND_R1PP) * a,
    T: Tice * W * b,
    Rice
  };
}

// Spectral pond albedo at any wavelength on the vendored grid
// (linear interpolation of the printed inputs).
export function pondAlphaAt(nm, Hp = POND_HP, Hi = POND_HI, sigmaI) {
  const t = POND_SPECTRAL;
  let i = 0;
  while (i < t.length - 2 && nm > t[i + 1][0]) i++;
  const f =
    nm <= t[i][0] ? 0 : Math.min(1, (nm - t[i][0]) / (t[i + 1][0] - t[i][0]));
  const kw = t[i][1] + (t[i + 1][1] - t[i][1]) * f;
  const kap = t[i][2] + (t[i + 1][2] - t[i][2]) * f;
  const lam = t[i][0] + (t[i + 1][0] - t[i][0]) * f;
  return pondAlphaT(kw, pondKIce(lam, kw, kap), Hp, Hi, sigmaI).alpha;
}

// The pond colour at the theme's channels (c = 0/1/2 = 680/550/
// 440 nm, the seaice.js order): absolute diffuse albedo.
export function pondAlbedoRGB(Hp = POND_HP, Hi = POND_HI) {
  return [
    pondAlphaAt(680, Hp, Hi),
    pondAlphaAt(550, Hp, Hi),
    pondAlphaAt(440, Hp, Hi)
  ];
}

// The printed Lu 2018 melting case: melt progress m in [0, 1]
// deepens the pond 0 -> 1 m while the ice under it thins
// 1.3 m -> 0, holding Hi + delta Hp = 1.3 m with delta = 1.3.
export function pondMeltState(m) {
  const t = Math.min(Math.max(m, 0), 1);
  return {
    Hp: (t * MELT_TOTAL) / MELT_DELTA,
    Hi: MELT_TOTAL * (1 - t)
  };
}

// Rosel et al. 2012 Fig. 6: the mean relative melt-pond fraction
// per grid cell, whole Arctic Ocean, 2000-2011 mean of the weekly
// product - machine-read from the published figure at half-week
// steps (the plot frame and axis labels located programmatically;
// the first sample is the printed season start day 129, the last
// the printed day-249 end). The gate holds the printed anchors on
// this read: the mean rises through June to a maximum ABOVE 15 %
// at the end of June, a second local maximum at the end-of-July
// composite week, both tails below 0.09.
// [day of year, pond fraction of the ice surface]
export const POND_FRAC_CURVE = [
  [130, 0.0771],
  [133.5, 0.0806],
  [137, 0.0845],
  [140.5, 0.0902],
  [144, 0.0971],
  [147.5, 0.1026],
  [151, 0.1072],
  [154.5, 0.1128],
  [158, 0.1223],
  [161.5, 0.1316],
  [165, 0.1395],
  [168.5, 0.147],
  [172, 0.1502],
  [175.5, 0.1508],
  [179, 0.1501],
  [182.5, 0.1473],
  [186, 0.1443],
  [189.5, 0.1392],
  [193, 0.1341],
  [196.5, 0.1306],
  [200, 0.1275],
  [203.5, 0.1241],
  [207, 0.1204],
  [210.5, 0.1178],
  [214, 0.1193],
  [217.5, 0.1205],
  [221, 0.113],
  [224.5, 0.1049],
  [228, 0.0986],
  [231.5, 0.0934],
  [235, 0.0881],
  [238.5, 0.0827],
  [242, 0.0775],
  [245.5, 0.0753],
  [249, 0.0732]
];

// The climatological pond fraction at a day of year: linear on
// the weekly grid, zero outside the printed data season (the
// retrieval exists for day 129-249 only; outside it new ice and
// snowfall cover the ponds - printed).
export function pondFractionOfDay(doy) {
  const t = POND_FRAC_CURVE;
  if (doy < 129 || doy > 249) return 0;
  if (doy <= t[0][0]) return t[0][1];
  if (doy >= t[t.length - 1][0]) return t[t.length - 1][1];
  let i = 0;
  while (i < t.length - 2 && doy > t[i + 1][0]) i++;
  const f = (doy - t[i][0]) / (t[i + 1][0] - t[i][0]);
  return t[i][1] + (t[i + 1][1] - t[i][1]) * f;
}

// The drawn pond fraction: the measured climatology, gated by
// the measured surface air temperature (ponds are meltwater -
// none unless the measured air is above the melting point) and
// by the data's own hemisphere (the retrieval domain is the
// Arctic; no southern data, no southern ponds).
export function pondFraction(doy, tempC, latDeg) {
  if (!(latDeg > 0) || !(tempC > 0)) return 0;
  return pondFractionOfDay(doy);
}
