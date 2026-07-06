// Reference printer for the contrail criterion (node
// contrails-reference.mjs). The model lives once in contrails.js;
// landmarks against the published sources and exact solves:
//  - Murphy & Koop 2005: ice and liquid saturation pressures meet
//    at the triple point 611.657 Pa; the supercooled liquid/ice
//    ratio at -50 degC sits in the published 1.6-1.75 band (this
//    ratio is WHY persistent contrails exist: air can be
//    ice-supersaturated while under liquid saturation)
//  - Schumann 1996: the closed-form threshold fit T_LM(G) stays
//    within 0.25 K of the EXACT tangency solve de_w/dT = G across
//    the cruise range; at 250 hPa and eta = 0.3 the threshold is
//    the textbook "about -42 degC at cruise"
//  - T_LC anchors: exactly T_LM at U = 1 and exactly
//    T_LM - e_w(T_LM)/G at U = 0, monotonic between
//  - the criterion reproduces the classic phase diagram: colder or
//    moister means contrails; persistence only with RHi > 1
import {
  adsbToScene,
  appleman,
  eIce,
  eLiq,
  FT_M,
  KT_MS,
  slopeG,
  tlcAt,
  tlmApprox,
  tlmExact
} from './contrails.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  const ti = eIce(273.16);
  const tw = eLiq(273.16);
  const ratio50 = eLiq(223.15) / eIce(223.15);
  check(
    'Murphy-Koop',
    Math.abs(ti / 611.657 - 1) < 1e-3 &&
      Math.abs(tw / 611.657 - 1) < 1e-3 &&
      ratio50 > 1.6 &&
      ratio50 < 1.75,
    `triple point ice ${ti.toFixed(2)} / liquid ${tw.toFixed(2)} Pa (611.657); e_w/e_i at -50 degC = ${ratio50.toFixed(3)}`
  );
}

{
  let worst = 0;
  for (const P of [20000, 25000, 30000, 35000]) {
    const G = slopeG(P);
    worst = Math.max(worst, Math.abs(tlmApprox(G) - tlmExact(G)));
  }
  const t250 = tlmExact(slopeG(25000));
  check(
    'Schumann threshold',
    worst < 0.25 && Math.abs(t250 - -42) < 2,
    `fit vs exact tangency: worst ${worst.toFixed(3)} K over 200-350 hPa; T_LM(250 hPa, eta 0.3) = ${t250.toFixed(1)} degC (textbook ~-42)`
  );
}

{
  const G = slopeG(25000);
  const tlm = tlmExact(G);
  const anchor0 = tlm - eLiq(tlm + 273.15) / G;
  const mid = tlcAt(G, 0.6);
  check(
    'T_LC anchors',
    Math.abs(tlcAt(G, 1) - tlm) < 1e-9 &&
      Math.abs(tlcAt(G, 0) - anchor0) < 1e-9 &&
      mid > anchor0 &&
      mid < tlm,
    `U=1 -> T_LM exact; U=0 -> ${anchor0.toFixed(2)} degC exact; U=0.6 between (${mid.toFixed(2)})`
  );
}

{
  // The classic phase behaviour at cruise (250 hPa, eta 0.3):
  // -60 degC forms at any humidity; -30 degC never forms; and
  // persistence needs ice supersaturation - RHi crosses 1 where
  // U e_w = e_i.
  const cold = appleman(25000, -60, 0);
  const warm = appleman(25000, -30, 1);
  const dryCold = appleman(25000, -60, 0.3);
  const moist = appleman(25000, -60, 0.8);
  check(
    'phase diagram',
    cold.forms &&
      !warm.forms &&
      dryCold.forms &&
      !dryCold.persists &&
      moist.forms &&
      moist.persists,
    `-60/dry forms (short-lived, RHi ${dryCold.rhi.toFixed(2)}); -60/U=0.8 persists (RHi ${moist.rhi.toFixed(2)}); -30 degC never`
  );
  // The measured case from the build session: -48.5 degC, RH 42%
  // at 250 hPa over the alpine test site. The criterion says NO -
  // the air is 1.2 K too warm for that humidity (T_LC = -49.7) -
  // yet the same temperature at liquid saturation WOULD trail
  // (T_LC(1) = T_LM = -42). A knife-edge day: this humidity
  // sensitivity near threshold is exactly what the model is for.
  const today = appleman(25000, -48.5, 0.42);
  const humid = appleman(25000, -48.5, 1);
  check(
    'measured case',
    !today.forms && today.tlc < -48.5 && humid.forms,
    `-48.5 degC / 42% -> NO trail (T_LC ${today.tlc.toFixed(1)}); at saturation it would (T_LC ${humid.tlc.toFixed(1)})`
  );
}

{
  // Live-aircraft mapping (the Cloudflare worker feed): exact unit
  // constants; an aircraft AT the reference point maps to the
  // scene origin at the asinh-compressed altitude; a due-east
  // track moves +x only at the exact converted ground speed; the
  // equirectangular offsets are symmetric.
  const ref = {
    lat: 46.62,
    lon: 8.04,
    halfM: 8000,
    world: 280,
    centerElev: 300,
    mpu: 57.14
  };
  const at = adsbToScene(
    {lat: 46.62, lon: 8.04, alt_baro: 36000, gs: 420, track: 90},
    ref
  );
  const yExp = 16 * Math.asinh((36000 * 0.3048 - 300) / 500);
  const spExp = (420 * 0.514444) / 57.14;
  const north = adsbToScene(
    {lat: 46.62 + 8000 / 111320, lon: 8.04, alt_baro: 36000, gs: 420, track: 0},
    ref
  );
  check(
    'ADS-B mapping',
    Math.abs(at.x) < 1e-9 &&
      Math.abs(at.z) < 1e-9 &&
      Math.abs(at.y - yExp) < 1e-12 &&
      Math.abs(at.vx - spExp) < 1e-12 &&
      Math.abs(at.vz) < 1e-9 &&
      Math.abs(north.z - -140) < 1e-9 &&
      Math.abs(north.vz - -spExp) < 1e-12 &&
      FT_M === 0.3048 &&
      KT_MS === 0.514444,
    `origin exact; FL360 -> y ${at.y.toFixed(2)}; 420 kt east -> vx ${at.vx.toFixed(3)} u/s; +8 km north -> z ${north.z.toFixed(1)} (half-world)`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
