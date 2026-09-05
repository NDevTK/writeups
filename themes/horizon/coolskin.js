/**
 * coolskin.js - the sea's COOL SKIN under a pier's bulk water
 * temperature, and the sky's downwelling longwave that drives it.
 *
 * The pier thermometer sits metres under the surface; the air
 * touches an interface a few tenths cooler, because the sensible,
 * latent and net-infrared losses all leave through a millimetre
 * where only molecular conduction carries heat (Saunders 1967;
 * Fairall, Bradley, Godfrey, Wick, Edson & Young 1996 - the paper
 * is walled, its framework reprinted in full in Fairall et al.
 * 2026 below). The 135th pass named "bulk water temperature
 * without the cool-skin tenths" as a stated limit; this module
 * retires it with the model the flux community runs.
 *
 * PRIMARIES, read in full:
 *  - Fairall, Thompson, Bariteau, Wick, Minnett, Szczodrak, Jessup
 *    & Witte 2026, "An Updated Treatment of the Oceanic Cool Skin
 *    in the COARE Bulk Flux Algorithm", JGR Oceans 131,
 *    e2025JC023539 (open, CC-BY). Its Section 3.3 prints the
 *    COARE 3.6 skin model this module runs: the steady interfacial
 *    budget (Eqs. 12-14), the skin as DT = (Q0 - f(delta) Rns0)
 *    delta / k (Eq. 15), delta_c = lambda_c nu / u*w with
 *    lambda_c = 6 (Eq. 17, Saunders' form), and the version-3.6
 *    statement k DT_cool / Q0 = 6 nu / u*w = 0.6 delta_u (Eq. 32,
 *    Eq. 36). Its Table A2 prints the old model's numbers at
 *    U10 = 2 m/s, Q0 = 115 W/m^2 (0.34 K of cooling at 0.6 delta_u,
 *    0.074 K of solar offset at Rns0 = 300); its Figs. 2 and 4 the
 *    COARE 3.6 skin at 10 m/s (0.19 K, Q0 = 240.96) and 2 m/s
 *    (0.28 K, Q0 = 114.47); its Table 2 the PISTON cruise mean
 *    (0.163 K measured, 0.169 modelled); its Section 7 the PSL
 *    database mean (0.192 K). The paper's own new model (3.7:
 *    turbulent-molecular diffusivity, tangential stress) needs the
 *    wave-stress fraction of Fairall et al. 2011 - not adopted
 *    here; 3.6 is the released model and the one the paper's
 *    figures compare against.
 *  - The authors' published implementation, coare36vn_zrf_et
 *    (NOAA-PSL/COARE-algorithm, the code the Data Availability
 *    statement points to): the free-convection limit on lambda
 *    that Eq. 17 does not print (Fairall 1996's form: lambda =
 *    6 / [1 + (bigc alq / u*^4)^0.75]^0.333 when the skin's
 *    buoyancy flux alq = Al qcol + be Hl cpw/Le is positive, else
 *    lambda = 6 with the thickness capped at 1 cm), bigc =
 *    16 g cpw (rhow nu_w)^3 / (k^2 rhoa^2), the seawater expansion
 *    coefficients, the three-exponential solar absorption of the
 *    skin (Fairall 1996 Eq. 17 with Wick et al. 2005's 0.065), and
 *    the skin's own emission fed back into the net infrared. The
 *    exponent 0.333 is the code's literal; the port keeps it so
 *    the oracle runs in the gate match to the fourth decimal.
 *  - Yang, Hu, Chen & Quan 2022, "Parameterization of downward
 *    longwave radiation based on long-term baseline surface
 *    radiation measurements in China", ACP preprint acp-2022-794
 *    (open, read in full): the Brunt clear-sky emissivity refitted
 *    on 12,368 clear hours of pyrgeometer data (Eq. 2: eps = 0.599
 *    + 0.053 sqrt(e), e in hPa), the all-sky correction by cloud
 *    fraction and humidity (Eq. 6: eps_all = eps_clr (1 - 0.178
 *    CF^0.339) + 0.075 CF^0.395 RH^0.253), its Table 2 listing the
 *    Brunt coefficients other networks found (SURFRAD 0.598/0.057,
 *    36 sites worldwide 0.605/0.048 - the spread this module's
 *    landmarks hold the fit inside), and its printed errors
 *    (clear-sky RMSE 13.8 W/m^2, all-sky 17.3 W/m^2). No pyrgeometer
 *    looks at the sea off the pier; the sky's longwave is MODELLED
 *    from the pier's measured air with the shore's dewpoint and
 *    cloud cover, and every line that uses it says so.
 *  - NOAA PSL's hourly ship flux archive (137th pass;
 *    NOAA_PSL_Hourly_Ship_Flux on the COAPS ERDDAP - the database
 *    Fairall et al. 2026 describe in their Section 2.1): 31,914
 *    measured hours on 44 research cruises, 1991-2021, sampled
 *    into shipflux-fixture.js. Fed the archive's own friction
 *    velocity, fluxes and measured longwave, this module returns
 *    PSL's COARE skin over 507 night hours to 6e-5 K RMS; on 323
 *    daytime hours whose measured solar certified a clear sky,
 *    the land-fitted Brunt reads the sea's pyrgeometers with bias
 *    -2.0 W/m^2 and RMSE 10.6 - the clear-sky uncertainty the page
 *    now quotes (LW_OCEAN_CLEAR) - while on 616 nights of unlogged
 *    cover the clear formula under-reads by 27 W/m^2 (the cloud
 *    term the pier's METAR supplies; LW_OCEAN_ALLSKY).
 *
 * STATED LIMITS: no warm layer (the daytime near-surface warming;
 * the CO-OPS water sensor sits 3.4 m down - a daytime skin is
 * offered with that caveat, a night-time one without); no rain
 * sensible heat; COARE 3.6's total-stress skin, not 3.7's
 * tangential one; the longwave from a screen-level emissivity fit
 * made over land (China's baseline network), its clear-sky form
 * held over the ocean by the ship archive, its cloud term still on
 * the land fit's printed coefficients (the ships log no cover);
 * METAR cloud cover in okta midpoints where the fit used a fisheye
 * camera.
 */

// --- seawater and air constants, the code's own ---------------
export const K_WATER = 0.6; // W m^-1 K^-1 (tcw)
export const NU_WATER = 1e-6; // m^2 s^-1 (visw)
export const RHO_WATER = 1022; // kg m^-3 (rhow)
export const CP_WATER = 4000; // J kg^-1 K^-1 (cpw)
export const BETA_SALINE_PER_PSU = 0.00075; // be = bets * Ss
export const LAMBDA_SAUNDERS = 6;
export const DZ_SKIN_CAP_M = 0.01;
export const EMISSIVITY_SEA = 0.97;
export const SIGMA_SB = 5.67e-8;
export const T_ZERO_K = 273.16; // the code's T2K
export const R_GAS_DRY = 287.1;
export const CP_AIR = 1004.67;
export const G_STD = 9.80665;
export const SALINITY_OCEAN = 35;
// Wick et al. 2005's halved leading coefficient (the code's 0.065)
export const SKIN_SOLAR_A = 0.065;
// --- the sky's longwave: Yang et al. 2022 ----------------------
export const BRUNT_CBSRN = [0.599, 0.053]; // Eq. (2)
export const BRUNT_SURFRAD = [0.598, 0.057]; // Table 2, Li et al. 2017
export const BRUNT_GLOBAL36 = [0.605, 0.048]; // Table 2, Wang & Liang 2009
export const ALLSKY = {a: 0.178, b: 0.339, c: 0.075, d: 0.395, e: 0.253}; // Eq. (6)
export const LW_RMSE_CLEAR_WM2 = 13.8; // their independent validation
export const LW_RMSE_ALLSKY_WM2 = 17.3;
// --- the sky over the SEA: NOAA PSL's ship flux archive (137th),
// pinned from the frozen sample and held to it in the gate ------
export const LW_OCEAN_CLEAR = {
  biasWm2: -2.0,
  rmseWm2: 10.6,
  hours: 323,
  cruises: 44
};
export const LW_OCEAN_ALLSKY = {epsMean: 0.911, rmseWm2: 22, hours: 616};

/** COARE's latent heat of vaporization (J/kg) at the water
 * temperature - the code's Le. */
export function latentHeat(tsC) {
  return (2.501 - 0.00237 * tsC) * 1e6;
}

/** Seawater thermal expansion coefficient (1/K): the code's Al,
 * the 35-PSU form 2.1e-5 (T + 3.2)^0.79 blended with the
 * freshwater form by salinity (Lillibridge 1980 via the code). */
export function thermalExpansion(tsC, ssPsu = SALINITY_OCEAN) {
  const al35 = 2.1e-5 * Math.pow(tsC + 3.2, 0.79);
  const al0 = (2.2 * Math.pow(Math.max(tsC - 1, 0), 0.82) - 5) * 1e-5;
  return al0 + ((al35 - al0) * ssPsu) / 35;
}

/** The fraction of the net solar flux absorbed within a skin of
 * thickness dz (m): Fairall 1996's three-exponential form with
 * Wick 2005's leading coefficient - the code's dels/sw_net. */
export function skinSolarFraction(dzM) {
  return (
    SKIN_SOLAR_A + 11 * dzM - (6.6e-5 / dzM) * (1 - Math.exp(-dzM / 0.0008))
  );
}

/** The free-convection constant of the skin thickness: bigc =
 * 16 g cpw (rhow nu_w)^3 / (k^2 rhoa^2). */
export function bigC(rhoA, g = G_STD) {
  return (
    (16 * g * CP_WATER * Math.pow(RHO_WATER * NU_WATER, 3)) /
    (K_WATER * K_WATER * rhoA * rhoA)
  );
}

/** Air density from pressure, temperature and specific humidity. */
export function airDensity(pPa, tC, q = 0) {
  return pPa / (R_GAS_DRY * (tC + T_ZERO_K) * (1 + 0.61 * q));
}

/**
 * THE COOL SKIN (COARE 3.6): given the air-side friction velocity
 * (gustiness included, as COARE's), the sensible and latent fluxes
 * (W/m^2, positive cooling the ocean), the downwelling longwave
 * and the net solar reaching the water, iterate the interfacial
 * budget to the skin's temperature depression dT (K, positive =
 * skin cooler than the bulk) and thickness dz (m). The skin's own
 * emission enters the net infrared (the code's lw_net on
 * ts - dT_skin), so the loop closes on dT.
 */
export function coolSkin({
  uStar,
  rhoA,
  tsC,
  hsb,
  hlb,
  lwDn,
  swNet = 0,
  ssPsu = SALINITY_OCEAN,
  g = G_STD
}) {
  const Le = latentHeat(tsC);
  const Al = thermalExpansion(tsC, ssPsu);
  const be = BETA_SALINE_PER_PSU * ssPsu;
  const bigc = bigC(rhoA, g);
  const root = Math.sqrt(rhoA / RHO_WATER) * Math.max(uStar, 1e-6);
  let dT = 0;
  let dz = 0.001;
  let lambda = LAMBDA_SAUNDERS;
  let qcol = 0;
  let alq = 0;
  let rnl = 0;
  let iterations = 0;
  for (iterations = 1; iterations <= 40; iterations++) {
    rnl = EMISSIVITY_SEA * (SIGMA_SB * Math.pow(tsC - dT + T_ZERO_K, 4) - lwDn);
    const qout = rnl + hsb + hlb;
    const dels = swNet * skinSolarFraction(dz);
    qcol = qout - dels;
    alq = Al * qcol + (be * hlb * CP_WATER) / Le;
    if (alq > 0) {
      lambda =
        6 /
        Math.pow(1 + Math.pow((bigc * alq) / Math.pow(uStar, 4), 0.75), 0.333);
      dz = (lambda * NU_WATER) / root;
    } else {
      lambda = LAMBDA_SAUNDERS;
      dz = Math.min(DZ_SKIN_CAP_M, (LAMBDA_SAUNDERS * NU_WATER) / root);
    }
    const dTn = (qcol * dz) / K_WATER;
    const done = iterations > 2 && Math.abs(dTn - dT) < 1e-8;
    dT = dTn;
    if (done) break;
  }
  return {
    dTK: dT,
    dzM: dz,
    lambda,
    qcolWm2: qcol,
    rnlWm2: rnl,
    alq,
    buoyant: alq > 0,
    iterations
  };
}

// --- the sky's longwave -----------------------------------------

/** Brunt's clear-sky emissivity, e in hPa (Yang 2022 Eq. 2 by
 * default; the other printed coefficient pairs for the spread). */
export function emissivityClear(eHpa, [a, b] = BRUNT_CBSRN) {
  return a + b * Math.sqrt(Math.max(eHpa, 0));
}

/** All-sky emissivity from the clear value, the cloud fraction
 * (0-1) and the relative humidity (%): Yang 2022 Eq. (6). CF = 0
 * returns the clear value exactly. */
export function emissivityAllSky(epsClr, cf, rhPct) {
  const c = Math.min(1, Math.max(0, cf));
  const rh = Math.min(100, Math.max(1, rhPct));
  return (
    epsClr * (1 - ALLSKY.a * Math.pow(c, ALLSKY.b)) +
    ALLSKY.c * Math.pow(c, ALLSKY.d) * Math.pow(rh, ALLSKY.e)
  );
}

/** Downwelling longwave (W/m^2) from screen temperature (C),
 * vapour pressure (hPa), cloud fraction and RH (%): eps sigma T^4
 * in the paper's own definition of emissivity (Eq. 1). */
export function lwDown({taC, eHpa, cf = 0, rhPct = 50}) {
  const epsClr = emissivityClear(eHpa);
  const epsAll = emissivityAllSky(epsClr, cf, rhPct);
  const tK = taC + T_ZERO_K;
  return {
    wm2: epsAll * SIGMA_SB * Math.pow(tK, 4),
    epsClr,
    epsAll,
    // clear: the ocean's own test of the fit (the ship archive);
    // covered: the land fit's all-sky validation, cover known
    rmseWm2: cf > 0 ? LW_RMSE_ALLSKY_WM2 : LW_OCEAN_CLEAR.rmseWm2
  };
}

/** COARE 3.6's own stand-in when no longwave is known: the code's
 * commented default lw_dn = 400 - 1.6 |lat| (W/m^2). The METAR
 * cover-to-fraction mapping lives in metar.js (FMH-1 oktas); the
 * composing layer supplies the fraction. */
export function lwDownDefault(latDeg) {
  return 400 - 1.6 * Math.abs(latDeg);
}
