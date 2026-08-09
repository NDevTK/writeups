// closure-reference.mjs - the gate for the radiative closure
// audit. The law lives once in closure.js (+ the vendored ASTM
// G173-03 table in g173-data.js) - and these landmarks hold it:
//  - the vendored table IS the standard: its broadband integrals
//    land on the standard's own printed totals (global 1000.37,
//    direct 900.14 W/m^2)
//  - the luminous efficacies derive through the repo's own gated
//    CIE Y - no assumed lm/W constant anywhere - and land in the
//    textbook window with the physical ordering (the atmosphere
//    strips infrared, so ground efficacies exceed the
//    extraterrestrial one)
//  - TWO INDEPENDENT SOLAR ILLUMINANCE CONSTANTS MEET: E0_LUX
//    descends from Falchi's sky pair + the sun's visual magnitude
//    (astronomy); the G173 ETR column integrates to its own
//    (radiometry). No shared constant - one number, held to 6%
//  - THE AM1.5 FLAGSHIP: at the standard's own geometry (sun
//    41.81 deg) and its own printed aerosol (AOD 0.084, applied
//    flat - sensitivity to a one-octave spectral slope is
//    measured and printed), the drawn beam's visible
//    transmittance meets the standard's own - the Hillaire chain
//    against ASTM, two machineries that share nothing
//  - the drawn clear-sky diffuse fraction at AM1.5 sits in the
//    physical band (the standard's tilted 11.7% stated as the
//    non-comparable cousin - tilt geometry and 0.2 ground albedo)
//  - closureRatios: exact identity at algebraic agreement, null
//    below the 5 deg floor, missing components drop their keys
import {
  closureRatios,
  drawnBeamLux,
  drawnDiffuseLux,
  efficacyLmW,
  g173Broadband,
  G173_E0_LUX,
  K_DIRECT_LMW,
  K_ETR_LMW,
  K_GLOBAL_LMW,
  measuredLux
} from './closure.js';
import {E0_LUX, lum3} from './adaptation.js';
import {sunTransmittanceJS} from './sun-transmittance.js';
import {mieCoefficients} from './aerosol.js';
import {G173_DIRECT, G173_ETR} from './g173-data.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- the vendored table IS the standard -----------------------
{
  const bb = g173Broadband();
  check(
    'G173 broadband integrals land on the printed totals',
    Math.abs(bb.global - 1000.37) < 0.5 && Math.abs(bb.direct - 900.14) < 0.5,
    `global ${bb.global.toFixed(2)} (print 1000.37), direct ` +
      `${bb.direct.toFixed(2)} (print 900.14), ETR ${bb.etr.toFixed(1)} ` +
      `W/m^2 - the verbatim proof over all 2002 rows`
  );
}

// ---- efficacies through the repo's own CIE Y ------------------
check(
  'luminous efficacies derive - no assumed lm/W anywhere',
  K_GLOBAL_LMW > 95 &&
    K_GLOBAL_LMW < 120 &&
    K_DIRECT_LMW > 95 &&
    K_DIRECT_LMW < 120 &&
    K_ETR_LMW > 90 &&
    K_ETR_LMW < 110 &&
    K_GLOBAL_LMW > K_ETR_LMW &&
    K_DIRECT_LMW > K_ETR_LMW,
  `global ${K_GLOBAL_LMW.toFixed(1)}, direct ${K_DIRECT_LMW.toFixed(1)}, ` +
    `ETR ${K_ETR_LMW.toFixed(1)} lm/W - textbook window, and both ground ` +
    `columns exceed the extraterrestrial (the atmosphere strips IR, ` +
    `raising the visible share)`
);

// ---- two independent solar illuminance constants meet ---------
{
  const ratio = E0_LUX / G173_E0_LUX;
  check(
    'astronomy meets radiometry on the solar illuminance',
    Math.abs(ratio - 1) < 0.06,
    `E0_LUX ${(E0_LUX / 1000).toFixed(1)} klx (Falchi pair + sun Vmag) vs ` +
      `G173 ETR ${(G173_E0_LUX / 1000).toFixed(1)} klx (683 int V E) - ` +
      `ratio ${ratio.toFixed(3)}; no shared constant between the chains`
  );
}

// ---- THE AM1.5 FLAGSHIP ---------------------------------------
{
  // The standard's own geometry and printed aerosol: AM1.5 is
  // zenith 48.19 deg (sun altitude 41.81), AOD 0.084 at 500 nm
  // applied FLAT across the channels (the standard prints one
  // number; the slope sensitivity is measured below). Sea level.
  const alt = ((90 - 48.19) * Math.PI) / 180;
  const stdSet = {tau: [0.084, 0.084, 0.084], ssa: [0.9, 0.9, 0.9], g: 0.8};
  const mie = mieCoefficients(stdSet, 0);
  const tvisDrawn = lum3(...sunTransmittanceJS(Math.sin(alt), mie, 0));
  const lumDir = 683 * gInt(G173_DIRECT);
  const lumEtr = 683 * gInt(G173_ETR);
  const tvisStd = lumDir / lumEtr;
  // Slope sensitivity: tilt the flat AOD by a one-octave-class
  // spectral slope (+-35% at the band edges, opposite signs) and
  // measure what the V-weighted transmittance does.
  const slopeSet = {
    tau: [0.084 * 0.65, 0.084, 0.084 * 1.35],
    ssa: [0.9, 0.9, 0.9],
    g: 0.8
  };
  const tvisSlope = lum3(
    ...sunTransmittanceJS(Math.sin(alt), mieCoefficients(slopeSet, 0), 0)
  );
  const slopeShift = Math.abs(tvisSlope - tvisDrawn);
  check(
    'AM1.5: the drawn beam meets the ASTM standard',
    Math.abs(tvisDrawn / tvisStd - 1) < 0.08 && slopeShift < 0.02,
    `drawn visible transmittance ${tvisDrawn.toFixed(4)} vs the ` +
      `standard's own ${tvisStd.toFixed(4)} - ratio ` +
      `${(tvisDrawn / tvisStd).toFixed(3)} (unmodelled visible water ` +
      `vapour and the flat-AOD reading live inside the band; a one-octave ` +
      `aerosol slope moves it ${slopeShift.toFixed(4)}) - the Hillaire ` +
      `march against ASTM, no shared machinery`
  );
}

// ---- the drawn clear-sky diffuse fraction ---------------------
{
  const alt = ((90 - 48.19) * Math.PI) / 180;
  const stdSet = {tau: [0.084, 0.084, 0.084], ssa: [0.9, 0.9, 0.9], g: 0.8};
  const mie = mieCoefficients(stdSet, 0);
  const dB = drawnBeamLux(alt, mie, 0);
  const dD = drawnDiffuseLux(alt);
  const frac = dD / (dD + dB);
  check(
    'clear-sky diffuse fraction sits in the physical band',
    frac > 0.05 && frac < 0.25,
    `drawn horizontal diffuse share ${(frac * 100).toFixed(1)}% at AM1.5 ` +
      `(the standard's tilted share is 11.7% - stated as the ` +
      `non-comparable cousin: 37 deg sun-facing tilt over 0.2 albedo ` +
      `ground; the transfer table is horizontal over zero albedo)`
  );
}

// ---- closureRatios mechanics ----------------------------------
{
  const alt = Math.PI / 4;
  const stdSet = {tau: [0.084, 0.084, 0.084], ssa: [0.9, 0.9, 0.9], g: 0.8};
  const mie = mieCoefficients(stdSet, 0);
  // Algebraic identity: feed back exactly what the frame draws.
  const dB = drawnBeamLux(alt, mie, 0);
  const dD = drawnDiffuseLux(alt);
  const ghi = (dB + dD) / K_GLOBAL_LMW;
  const r = closureRatios({
    sunAltRad: alt,
    mieRad: mie,
    eyeHM: 0,
    ghiWm2: ghi,
    dirWm2: dB / K_DIRECT_LMW,
    difWm2: null
  });
  const below = closureRatios({
    sunAltRad: (4 * Math.PI) / 180,
    mieRad: mie,
    eyeHM: 0,
    ghiWm2: 500
  });
  const m = measuredLux({ghiWm2: 100, dirWm2: null, difWm2: null});
  check(
    'closureRatios: identity exact, floor honest, keys drop',
    r &&
      Math.abs(r.globalRatio - 1) < 1e-12 &&
      Math.abs(r.beamRatio - 1) < 1e-12 &&
      !('diffuseRatio' in r) &&
      below === null &&
      m.beam === null &&
      Math.abs(m.global - 100 * K_GLOBAL_LMW) < 1e-9,
    `feeding the drawn sky back through the efficacies returns ratios ` +
      `1.000000 exactly; sun 4 deg returns null (the kt chain's own ` +
      `validity floor); a missing component never invents its ratio`
  );
}

// gInt: local trapezoid of a G173 column weighted by the repo's
// CIE Y - shared by the flagship (hoisted).
import {cieY} from './airglow.js';
import {G173_NM} from './g173-data.js';
function gInt(col) {
  let s = 0;
  for (let i = 1; i < G173_NM.length; i++) {
    const w0 = G173_NM[i - 1];
    const w1 = G173_NM[i];
    s += 0.5 * (col[i - 1] * cieY(w0) + col[i] * cieY(w1)) * (w1 - w0);
  }
  return s;
}

process.exit(fail ? 1 : 0);
