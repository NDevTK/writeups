// Reference printer for the sea's cool skin (node
// coolskin-reference.mjs). Primaries READ IN FULL (see
// coolskin.js): Fairall et al. 2026 (JGR Oceans, open - the COARE
// 3.6 skin model printed as Eqs. 12-19/32/36, its Table A2, Figs.
// 2 and 4, Table 2), the authors' published implementation
// coare36vn_zrf_et (the free-convection lambda, the seawater
// constants, the solar absorption of the skin), and Yang et al.
// 2022 (ACP preprint, open - the Brunt clear-sky emissivity refit
// and its all-sky cloud/humidity correction, with the printed
// coefficient spread of other networks). The gate holds:
//  - the printed constants (seawater conductivity, viscosity,
//    density, heat capacity; Saunders' lambda 6; the 1-cm cap; the
//    sea's 0.97 emissivity; Brunt 0.599/0.053; the all-sky
//    coefficients)
//  - Saunders' form in the shear limit: as u* grows the buoyancy
//    correction vanishes and delta -> 6 nu / u*w, so k DT / Q0 ->
//    0.6 delta_u (Eq. 32); Table A2's old-model cooling (0.34 K at
//    Q0 = 115 W/m^2 with delta_u about 3 mm) lands in the band
//  - ORACLE REPRODUCTION: the port fed the authors' code's own
//    converged fluxes returns the code's skin to 5e-4 K and its
//    thickness to 5e-3 mm, in five regimes - light wind
//    (buoyancy-limited), 10 m/s (shear), the calm La Jolla night,
//    3 m/s at the pier, and a 300 W/m^2 solar case (the skin's
//    solar offset)
//  - the paper's printed anchors: Fig. 4's 0.28 K at 2 m/s and
//    Q0 = 114.47 (the code's own friction velocity), Fig. 2's
//    0.19 K at 10 m/s and Q0 = 240.96, Table 2's PISTON modelled
//    mean 0.169 K at the cruise-mean forcing of Table 1
//  - the sign and size of the solar offset (Table A2: cooling
//    reduced, never reversed, at Rns0 = 300 in light wind)
//  - the longwave: Brunt's clear emissivity monotone in e and
//    inside the printed spread of other networks (SURFRAD, the
//    36-site global fit) to 0.02; the all-sky form returns the
//    clear value at CF = 0 and raises it under cloud; the modelled
//    sky over the pier on a clear night lands within 3% of COARE's
//    own latitude default (400 - 1.6 |lat|)
//  - the composition (observatory.marinePanel): the skin cools the
//    interface, weakens the pier's film and the air-sea contrast
//    by tenths, never flips their sign on a warm-water night; the
//    shore METAR's dewpoint replaces the ascent's; the modelled
//    longwave is named as such with its printed RMSE.
import {
  ALLSKY,
  BRUNT_CBSRN,
  BRUNT_GLOBAL36,
  BRUNT_SURFRAD,
  CP_WATER,
  DZ_SKIN_CAP_M,
  EMISSIVITY_SEA,
  K_WATER,
  LAMBDA_SAUNDERS,
  LW_RMSE_ALLSKY_WM2,
  LW_RMSE_CLEAR_WM2,
  NU_WATER,
  RHO_WATER,
  SIGMA_SB,
  T_ZERO_K,
  coolSkin,
  emissivityAllSky,
  emissivityClear,
  lwDown,
  lwDownDefault,
  skinSolarFraction,
  thermalExpansion,
  latentHeat
} from './coolskin.js';
import {eSatPa} from './surfacelayer.js';
import {marinePanel} from './observatory.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// 1. the printed constants
{
  const ok =
    K_WATER === 0.6 &&
    NU_WATER === 1e-6 &&
    RHO_WATER === 1022 &&
    CP_WATER === 4000 &&
    LAMBDA_SAUNDERS === 6 &&
    DZ_SKIN_CAP_M === 0.01 &&
    EMISSIVITY_SEA === 0.97 &&
    T_ZERO_K === 273.16 &&
    BRUNT_CBSRN[0] === 0.599 &&
    BRUNT_CBSRN[1] === 0.053 &&
    ALLSKY.a === 0.178 &&
    ALLSKY.b === 0.339 &&
    ALLSKY.c === 0.075 &&
    ALLSKY.d === 0.395 &&
    ALLSKY.e === 0.253 &&
    LW_RMSE_CLEAR_WM2 === 13.8 &&
    LW_RMSE_ALLSKY_WM2 === 17.3 &&
    near(latentHeat(26.8), 2437484, 1) &&
    near(thermalExpansion(26.8, 35), 2.1e-5 * Math.pow(30, 0.79), 1e-9);
  check(
    'the printed constants',
    ok,
    `seawater k ${K_WATER} W/m/K, nu ${NU_WATER} m^2/s, rho ${RHO_WATER}, cp ${CP_WATER}; Saunders lambda ${LAMBDA_SAUNDERS}, thickness cap ${DZ_SKIN_CAP_M * 100} cm, sea emissivity ${EMISSIVITY_SEA}, the code's 273.16 zero; Brunt ${BRUNT_CBSRN.join('/')}; the all-sky form's five coefficients; the ACP paper's RMSEs ${LW_RMSE_CLEAR_WM2}/${LW_RMSE_ALLSKY_WM2} W/m^2; Le(26.8 C) ${latentHeat(26.8).toExponential(4)} J/kg and Al(26.8 C, 35 PSU) ${thermalExpansion(26.8, 35).toExponential(4)} 1/K as the code writes them`
  );
}

// 2. Saunders' form in the shear limit, and Table A2's old model
{
  const rhoA = 1.1677;
  const lwDn = 400;
  // strong shear: the buoyancy term is negligible and delta -> 6 nu / u*w
  const fast = coolSkin({uStar: 3, rhoA, tsC: 26.8, hsb: 2.2, hlb: 53, lwDn});
  const uw = Math.sqrt(rhoA / RHO_WATER) * 3;
  const dzSaunders = (LAMBDA_SAUNDERS * NU_WATER) / uw;
  const ratio = (K_WATER * fast.dTK) / fast.qcolWm2 / dzSaunders;
  // Table A2 (note): U10n = 2 m/s, Q0 = 115 W/m^2, delta_ut about
  // 3.1 mm - the old model's cooling at 0.6 delta_u printed 0.34 K.
  const band = [2.9e-3, 3.1e-3].map((du) => (0.6 * du * 115) / K_WATER);
  const ok =
    near(fast.lambda, 6, 0.01) &&
    near(ratio, 1, 0.01) &&
    band[0] < 0.34 &&
    band[1] > 0.34;
  check(
    "Saunders' form in the shear limit and Table A2's old model",
    ok,
    `at u* = 3 m/s the buoyancy correction leaves lambda at ${fast.lambda.toFixed(3)} and k DT/Q0 at ${ratio.toFixed(4)} x (6 nu / u*w) - Eq. 32's 0.6 delta_u; at Q0 = 115 W/m^2 and delta_u 2.9-3.1 mm the old model cools ${band[0].toFixed(3)}-${band[1].toFixed(3)} K, bracketing Table A2's printed 0.34`
  );
}

// 3. ORACLE REPRODUCTION: the authors' code's converged numbers
{
  // coare36vn_zrf_et run at the stated inputs (lw_dn as given,
  // sw_dn 0 unless stated); recorded: usr, hsb, hlb, rhoa, the
  // code's g(lat), and its dT_skin / dz_skin.
  const g15 = 9.783786397643507;
  const g33 = 9.79557967395499;
  const cases = [
    {
      name: '2 m/s, sea 26.8 C, air 25.8 C, RH 75, lw_dn 400',
      inp: {
        uStar: 0.0722801,
        rhoA: 1.167707,
        tsC: 26.8,
        hsb: 2.2256,
        hlb: 53.15366,
        lwDn: 400,
        g: g15
      },
      dT: 0.331014,
      dzMm: 1.79458
    },
    {
      name: '10 m/s, same air and sea',
      inp: {
        uStar: 0.3727297,
        rhoA: 1.167707,
        tsC: 26.8,
        hsb: 9.56357,
        hlb: 191.98103,
        lwDn: 400,
        g: g15
      },
      dT: 0.202976,
      dzMm: 0.47278
    },
    {
      name: 'La Jolla calm night (0.1 m/s, water 20.9, air 19.0, RH 80, lw_dn 340)',
      inp: {
        uStar: 0.0232753,
        rhoA: 1.19725,
        tsC: 20.9,
        hsb: 2.40597,
        hlb: 16.29562,
        lwDn: 340,
        g: g33
      },
      dT: 0.372454,
      dzMm: 2.27882
    },
    {
      name: 'La Jolla at 3 m/s',
      inp: {
        uStar: 0.100251,
        rhoA: 1.19725,
        tsC: 20.9,
        hsb: 7.37459,
        hlb: 49.19535,
        lwDn: 340,
        g: g33
      },
      dT: 0.340841,
      dzMm: 1.5025
    },
    {
      name: 'La Jolla at 3 m/s under 300 W/m^2 of net solar',
      inp: {
        uStar: 0.1003596,
        rhoA: 1.19725,
        tsC: 20.9,
        hsb: 7.54669,
        hlb: 49.66182,
        lwDn: 340,
        swNet: 300,
        g: g33
      },
      dT: 0.311626,
      dzMm: 1.51367
    }
  ];
  const outs = cases.map((c) => ({...c, got: coolSkin(c.inp)}));
  const ok = outs.every(
    (c) => near(c.got.dTK, c.dT, 5e-4) && near(c.got.dzM * 1000, c.dzMm, 5e-3)
  );
  check(
    "ORACLE REPRODUCTION of the authors' code",
    ok,
    outs
      .map(
        (c) =>
          `${c.name}: ${c.got.dTK.toFixed(4)} K over ${(c.got.dzM * 1000).toFixed(3)} mm (code ${c.dT.toFixed(4)} K, ${c.dzMm.toFixed(3)} mm; lambda ${c.got.lambda.toFixed(2)})`
      )
      .join('; ')
  );
}

// 4. the paper's printed anchors
{
  // Fig. 4: U10 = 2 m/s, sea-air 1 C, RH 75, no solar: Q0 = 114.47
  // W/m^2, u*w = 0.0029418 m/s, DT (COARE 3.6) = 0.28 C. The
  // code's own u* at that wind gives the flux split (hsb 2.2, hlb
  // 53.2); the sky set so the net infrared closes Q0.
  const rhoA = 1.167707;
  const uStar4 = 0.0029418 / Math.sqrt(rhoA / RHO_WATER);
  const hsb4 = 2.2256;
  const hlb4 = 53.15366;
  const rnl4 = 114.47 - hsb4 - hlb4;
  const lw4 =
    SIGMA_SB * Math.pow(26.8 - 0.28 + T_ZERO_K, 4) - rnl4 / EMISSIVITY_SEA;
  const f4 = coolSkin({
    uStar: uStar4,
    rhoA,
    tsC: 26.8,
    hsb: hsb4,
    hlb: hlb4,
    lwDn: lw4
  });
  // Fig. 2: 10 m/s, Q0 = 240.96 W/m^2, DT (3.6) = 0.19 C - the
  // code's u* at 10 m/s, the same flux split scaled to Q0.
  const hsb2 = 9.56357;
  const hlb2 = 191.98103;
  const rnl2 = 240.96 - hsb2 - hlb2;
  const lw2 =
    SIGMA_SB * Math.pow(26.8 - 0.19 + T_ZERO_K, 4) - rnl2 / EMISSIVITY_SEA;
  const f2 = coolSkin({
    uStar: 0.3727297,
    rhoA,
    tsC: 26.8,
    hsb: hsb2,
    hlb: hlb2,
    lwDn: lw2
  });
  // Table 1/2 PISTON: U10n 7.0, SST 29.0, Ta 28.4, RH 83, Hs 2.6,
  // Hl 99, Rnl 35 (Q0 136); Table 2's COARE 3.6 mean 0.169 C.
  const lwP =
    SIGMA_SB * Math.pow(29.0 - 0.17 + T_ZERO_K, 4) - 35 / EMISSIVITY_SEA;
  // the code's own u* and air density at the cruise-mean wind
  // (an oracle run at 7 m/s, 18-m wind, 15-m air)
  const fP = coolSkin({
    uStar: 0.2239281,
    rhoA: 1.153748,
    tsC: 29.0,
    hsb: 2.6,
    hlb: 99,
    lwDn: lwP,
    g: 9.78
  });
  // Fig. 4's title states Q0 and u*w but not the sensible/latent
  // split nor the exact water temperature behind its 0.28; the
  // buoyancy-limited skin at 2 m/s moves 0.03 K across that
  // freedom (measured here), so the band is 0.04.
  const ok =
    near(f4.qcolWm2, 114.47, 2) &&
    near(f4.dTK, 0.28, 0.04) &&
    near(f2.qcolWm2, 240.96, 2) &&
    near(f2.dTK, 0.19, 0.03) &&
    near(fP.qcolWm2, 136, 2) &&
    near(fP.dTK, 0.169, 0.04);
  check(
    "the paper's printed anchors",
    ok,
    `Fig. 4 (2 m/s, Q0 ${f4.qcolWm2.toFixed(1)}): ${f4.dTK.toFixed(3)} K vs printed 0.28 (its flux split unstated - a 0.04 band); Fig. 2 (10 m/s, Q0 ${f2.qcolWm2.toFixed(1)}): ${f2.dTK.toFixed(3)} K vs printed 0.19; PISTON cruise-mean forcing (7 m/s, Q0 ${fP.qcolWm2.toFixed(0)}): ${fP.dTK.toFixed(3)} K vs Table 2's modelled mean 0.169 (measured 0.163)`
  );
}

// 5. the solar offset: cooling reduced, never reversed, in light wind
{
  const base = coolSkin({
    uStar: 0.0722801,
    rhoA: 1.167707,
    tsC: 26.8,
    hsb: 2.2256,
    hlb: 53.15366,
    lwDn: 400
  });
  const sun = coolSkin({
    uStar: 0.0722801,
    rhoA: 1.167707,
    tsC: 26.8,
    hsb: 2.2256,
    hlb: 53.15366,
    lwDn: 400,
    swNet: 300
  });
  const fr = skinSolarFraction(sun.dzM);
  const ok =
    sun.dTK > 0 &&
    sun.dTK < base.dTK &&
    base.dTK - sun.dTK > 0.02 &&
    base.dTK - sun.dTK < 0.12 &&
    fr > 0.01 &&
    fr < 0.1;
  check(
    'the solar offset',
    ok,
    `2 m/s, 300 W/m^2 net solar: the skin absorbs ${(fr * 100).toFixed(1)}% of it within ${(sun.dzM * 1000).toFixed(2)} mm and cools ${sun.dTK.toFixed(3)} K instead of ${base.dTK.toFixed(3)} - an offset of ${(base.dTK - sun.dTK).toFixed(3)} K (Table A2's old-model solar term at 0.6 delta_u: 0.074 K)`
  );
}

// 6. the longwave
{
  const es = [5, 10, 15, 20, 30];
  const eps = es.map((e) => emissivityClear(e));
  const mono = eps.every((v, i) => i === 0 || v > eps[i - 1]);
  const spread = [10, 20].map((e) => [
    Math.abs(emissivityClear(e) - emissivityClear(e, BRUNT_SURFRAD)),
    Math.abs(emissivityClear(e) - emissivityClear(e, BRUNT_GLOBAL36))
  ]);
  const within = spread.every((p) => p[0] < 0.02 && p[1] < 0.02);
  const clr = emissivityClear(18.3);
  const same0 = emissivityAllSky(clr, 0, 80) === clr;
  let raises = true;
  for (const cf of [0.19, 0.44, 0.75, 1])
    for (const rh of [50, 70, 90])
      if (emissivityAllSky(clr, cf, rh) <= clr) raises = false;
  const ovc = emissivityAllSky(clr, 1, 90);
  // the pier's clear night: KSAN 18.3 C, dewpoint 16.1 C
  const e = eSatPa(16.1) / 100;
  const sky = lwDown({taC: 18.3, eHpa: e, cf: 0, rhPct: 87});
  const dflt = lwDownDefault(32.87);
  const ok =
    mono &&
    within &&
    same0 &&
    raises &&
    ovc > 0.85 &&
    ovc < 0.95 &&
    Math.abs(sky.wm2 - dflt) / dflt < 0.03 &&
    sky.rmseWm2 === LW_RMSE_CLEAR_WM2;
  check(
    'the longwave',
    ok,
    `Brunt clear emissivity rises ${eps[0].toFixed(3)} -> ${eps[eps.length - 1].toFixed(3)} over 5-30 hPa and sits within ${Math.max(...spread.flat()).toFixed(3)} of the SURFRAD and 36-site fits; the all-sky form returns the clear value at CF 0, raises it under every cover, and reaches ${ovc.toFixed(3)} overcast at RH 90; the pier's clear night (18.3 C, dewpoint 16.1 C, e ${e.toFixed(1)} hPa) gives ${sky.wm2.toFixed(0)} W/m^2 down - within ${((Math.abs(sky.wm2 - dflt) / dflt) * 100).toFixed(1)}% of COARE's own default ${dflt.toFixed(0)} at this latitude; stated noise ${sky.rmseWm2} W/m^2`
  );
}

// 7. the composition: the skin on the pier's film
{
  const balloon = (h0, tSurf) => {
    const rows = [];
    let p = 1013.25 * Math.exp(-h0 / 8400);
    let hPrev = h0;
    const tAt = (h) =>
      h < h0 + 600
        ? tSurf - 0.0065 * (h - h0)
        : tSurf - 0.0065 * 600 + 6 - 0.0065 * (h - h0 - 600);
    for (const h of [
      h0,
      h0 + 30,
      h0 + 100,
      h0 + 300,
      h0 + 600,
      h0 + 700,
      h0 + 1000,
      h0 + 2000,
      h0 + 5000,
      h0 + 9000
    ]) {
      if (h > h0) {
        const tMean = (tAt(hPrev) + tAt(h)) / 2 + 273.15;
        p *= Math.exp((-(h - hPrev) * 9.80665 * 0.0289644) / (8.31451 * tMean));
      }
      rows.push({p, hM: h, tC: +tAt(h).toFixed(3), rh: 60});
      hPrev = h;
    }
    return rows;
  };
  const rows = balloon(134, 24);
  const met = {
    uMs: 0.1,
    zuM: 17.5,
    taC: 19.0,
    ztM: 16.5,
    tsC: 20.9,
    pPa: 101320
  };
  const shore = {id: 'KSAN', km: 11, tC: 18.3, dewC: 16.1, cf: 0, rhPct: 87};
  const bare = marinePanel(met, rows, {bliM: 600});
  const skinned = marinePanel(met, rows, {bliM: 600, shore, latDeg: 32.87});
  const ok =
    bare &&
    skinned &&
    skinned.skinK > 0.2 &&
    skinned.skinK < 0.5 &&
    near(skinned.tInterfaceC, met.tsC - skinned.skinK, 1e-9) &&
    skinned.dTairSkinK > bare.dTairSeaK &&
    skinned.dTairSkinK < 0 &&
    Math.abs(skinned.filmLapseKm) < Math.abs(bare.filmLapseKm) &&
    skinned.filmLapseKm < 0 &&
    skinned.dewSource.includes('KSAN') &&
    skinned.lwSource.includes('modelled') &&
    skinned.lwRmseWm2 === LW_RMSE_CLEAR_WM2 &&
    skinned.hlbWm2 > 0 &&
    skinned.q0Wm2 > 50;
  check(
    'the composition: the skin on the pier film',
    ok,
    skinned
      ? `calm pier, water 20.9 C under 19.0 C air, the shore METAR's dewpoint 16.1 C: the sky sends ${skinned.lwDnWm2.toFixed(0)} W/m^2 down (${skinned.lwSource}), the water loses ${skinned.q0Wm2.toFixed(0)} W/m^2 (sensible ${skinned.hsbWm2.toFixed(1)}, latent ${skinned.hlbWm2.toFixed(1)}, infrared ${skinned.rnlWm2.toFixed(1)}) through a ${(skinned.skinDzM * 1000).toFixed(2)}-mm skin ${skinned.skinK.toFixed(3)} K cooler than the bulk - the interface at ${skinned.tInterfaceC.toFixed(2)} C, the contrast ${skinned.dTairSkinK.toFixed(2)} K instead of ${bare.dTairSeaK.toFixed(2)}, the film ${skinned.filmLapseKm.toFixed(0)} K/km instead of ${bare.filmLapseKm.toFixed(0)}; humidity from ${skinned.dewSource}`
      : 'marinePanel returned null'
  );
}

process.exit(fail ? 1 : 0);
