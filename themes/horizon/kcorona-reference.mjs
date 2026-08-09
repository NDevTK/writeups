// kcorona-reference.mjs - the gate for the solar corona's
// absolute photometry (kcorona.js) and for CORONALITY: the 2017
// edge-site record (beads-data.js primary) closing a loop
// through the theme's own circumsolar aureole. Landmarks:
//  - van de Hulst's Eq. (10) reproduces his printed Table 1
//    totals (every column) and the printed ring ratio Q = 1.84
//  - THE CORONA IS WORTH A THIRD TO THREE-FIFTHS OF A FULL
//    MOON in the theme's own magnitude bridge, and the
//    maximum-phase total sits inside his quoted Dyson & Woolley
//    photoelectric record
//  - the 1950 eclipse model MEETS the 1973 Skylab coronagraph
//    (Saito, Poland & Munro Tables II/III) at every printed
//    radius, equator and pole - two instruments, 23 years apart
//  - the inner corona OUTSHINES the clear-day mean sky: the
//    corona hides behind the circumsolar aureole, not the mean
//    sky - which is exactly what the coronality loop measures
//  - THE CORONALITY LOOP: the printed naked-eye onset (full
//    corona >= 35-40 s before C2) + van de Hulst's outer-corona
//    brightness + the LDF residual fraction imply a circumsolar
//    enhancement A* at 0.8 deg; the theme's OWN drawn aureole
//    (aureole.js spike, OPAC/Chin diffraction at a clean-day
//    dust column) independently produces the same band - and
//    with that drawn enhancement the predicted coronality
//    window contains totality with tens of seconds to spare on
//    each side, the paper's "coronality, alongside totality"
import {
  coronaCdM2,
  coronaIlluminanceLux,
  coronaSurfB,
  ringTotal,
  SPM77_BKF,
  sunMeanDiscCdM2,
  VDH_C_MAXMIN,
  VDH_F,
  VDH_K_MAX,
  VDH_K_MIN,
  VDH_K_POLE
} from './kcorona.js';
import {E0_LUX, lum3, skyTransferE} from './adaptation.js';
import {E_FULL_RATIO} from './moonlight.js';
import {diffractionPattern, MITR} from './aureole.js';
import {mieCoefficients} from './aerosol.js';
import {sunTransmittanceJS} from './sun-transmittance.js';
import {exposedIllumFraction, grazeMarch} from './beads.js';
import {MEASURED_S_ARCSEC} from './beads-data.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- Eq. (10) reproduces Table 1 ------------------------------
{
  const rows = [
    ['K_max', VDH_K_MAX, 1.213e-6],
    ['K_min', VDH_K_MIN, 0.683e-6],
    ['K_pole', VDH_K_POLE, 0.305e-6],
    ['F', VDH_F, 0.259e-6]
  ];
  let worst = 0;
  for (const [, coeffs, printed] of rows)
    worst = Math.max(worst, Math.abs(ringTotal(coeffs, 1) / printed - 1));
  const ringMax = ringTotal(VDH_K_MAX, 1.03, 6) + ringTotal(VDH_F, 1.03, 6);
  const ringMin =
    0.7 * ringTotal(VDH_K_MIN, 1.03, 6) +
    0.3 * ringTotal(VDH_K_POLE, 1.03, 6) +
    ringTotal(VDH_F, 1.03, 6);
  const Q = ringMax / ringMin;
  check(
    'Eq. (10) reproduces the printed Table 1',
    worst < 0.005 &&
      Math.abs(ringMax / 1.102e-6 - 1) < 0.01 &&
      Math.abs(ringMin / 0.596e-6 - 1) < 0.01 &&
      Math.abs(Q - 1.84) < 0.02,
    `every printed total lands (worst ${(worst * 100).toFixed(2)}%): K_max ` +
      `1.213, K_min 0.683, K_pole 0.305, F 0.259 (x1e-6 sun); the ` +
      `1.03-6 ring gives ${(ringMax * 1e6).toFixed(3)}/${(
        ringMin * 1e6
      ).toFixed(3)} - his printed 1.102/0.596 and their ratio ` +
      `Q = ${Q.toFixed(2)} (printed 1.84)`
  );
}

// ---- the corona in full moons ---------------------------------
{
  const totMin = coronaIlluminanceLux(0) / E0_LUX;
  const totMax = coronaIlluminanceLux(1) / E0_LUX;
  const moonsMin = totMin / E_FULL_RATIO;
  const moonsMax = totMax / E_FULL_RATIO;
  check(
    'the corona is worth a third to three-fifths of a full moon',
    moonsMin > 0.25 &&
      moonsMin < 0.5 &&
      moonsMax > 0.45 &&
      moonsMax < 0.75 &&
      totMax > 1.07e-6 &&
      totMax < 1.66e-6,
    `total corona light: ${(totMin * 1e6).toFixed(2)}e-6 of the sun at ` +
      `minimum, ${(totMax * 1e6).toFixed(2)}e-6 at maximum = ` +
      `${moonsMin.toFixed(2)} to ${moonsMax.toFixed(2)} FULL MOONS through ` +
      `the theme's own magnitude bridge (E_FULL_RATIO); the maximum sits ` +
      `inside van de Hulst's quoted Dyson & Woolley photoelectric record ` +
      `(1.07-1.66e-6), the minimum ~25% under it - his own stated offset`
  );
}

// ---- 1950 model meets 1973 Skylab -----------------------------
{
  let worst = 0;
  let at = '';
  for (const [r, eq, pol] of SPM77_BKF) {
    const dEq = Math.abs(coronaSurfB(r, 'eq', 0) / eq - 1);
    const dPol = Math.abs(coronaSurfB(r, 'pole', 0) / pol - 1);
    if (dEq > worst) {
      worst = dEq;
      at = `eq r=${r}`;
    }
    if (dPol > worst) {
      worst = dPol;
      at = `pole r=${r}`;
    }
  }
  check(
    'the 1950 eclipse model meets the 1973 Skylab coronagraph',
    worst < 0.25,
    `B_K+F at r = 2.5, 3, 4, 5, equator AND pole: van de Hulst's closed ` +
      `forms vs Saito-Poland-Munro's printed streamer-free measurements - ` +
      `worst disagreement ${(worst * 100).toFixed(0)}% (${at}), inside ` +
      `SPM's own +-20-50% stated absolute accuracy: two instruments, 23 ` +
      `years and a technology apart, one corona`
  );
}

// ---- the corona hides behind the aureole ----------------------
const ALT_2017 = (45.43 * Math.PI) / 180; // sun altitude at the site
const MEAN_SKY = (lum3(...skyTransferE(ALT_2017)) * E0_LUX) / Math.PI;
{
  const inner = coronaCdM2(1.03, 'eq', 0.2);
  check(
    'the inner corona outshines the mean sky',
    inner > MEAN_SKY && inner < 10 * MEAN_SKY,
    `at r = 1.03 the corona runs ${inner.toFixed(0)} cd/m^2 against a ` +
      `clear-day mean sky of ${MEAN_SKY.toFixed(0)} - the corona is NOT ` +
      `hidden by the mean sky but by the circumsolar aureole (the theme ` +
      `draws that aureole; the coronality loop below measures it)`
  );
}

// ---- THE CORONALITY LOOP --------------------------------------
{
  // The record (beads-data primary, printed): from a few hundred
  // metres inside the southern limit, the FULL corona - faint
  // outer included - was visible at least 35-40 s before second
  // contact, for 50-60 s in all, around ~13-15 s of totality.
  const m = grazeMarch(MEASURED_S_ARCSEC);
  const bOuter = coronaCdM2(3, 'eq', 0.2); // outer corona, declining cycle
  // Implied circumsolar enhancement at the printed onset window:
  // sky(0.8 deg) = A x mean sky x LDF residual fraction = bOuter.
  const fr = (ts) => exposedIllumFraction(ts / 60, MEASURED_S_ARCSEC);
  const aStar40 = bOuter / (MEAN_SKY * fr(m.c2S - 40));
  const aStar35 = bOuter / (MEAN_SKY * fr(m.c2S - 35));
  // The theme's own drawn enhancement: the aureole.js spike
  // (transported-dust MITR diffraction, the OPAC/Chin pattern the
  // dome draws) at 0.8 deg for a clean-day dust column.
  const mieRad = mieCoefficients(
    {tau: [0.1, 0.1, 0.1], ssa: [0.9, 0.9, 0.9], g: 0.8},
    700
  );
  const eBeam =
    lum3(...sunTransmittanceJS(Math.cos(Math.PI / 2 - ALT_2017), mieRad, 700)) *
    E0_LUX;
  const p08 = diffractionPattern(MITR, 0.55, [(0.8 * Math.PI) / 180])[0];
  const aDrawn = (tauDu) => (eBeam * (tauDu / MITR.q) * p08) / MEAN_SKY;
  const aLo = aDrawn(0.02);
  const aHi = aDrawn(0.08);
  const overlap = aStar40 < aHi && aStar35 > aLo;
  // With the drawn mid-column enhancement, the predicted window:
  const aMid = aDrawn(0.04);
  const fStar = bOuter / (aMid * MEAN_SKY);
  const crossing = (from, to, step) => {
    for (let ts = from; step > 0 ? ts <= to : ts >= to; ts += step)
      if (fr(ts) < fStar) return ts;
    return NaN;
  };
  const tOn = crossing(m.c2S - 70, m.c2S, 0.5);
  const tOff = crossing(m.c3S + 70, m.c3S, -0.5);
  const windowS = tOff - tOn;
  const leadS = m.c2S - tOn;
  const tailS = tOff - m.c3S;
  check(
    'THE CORONALITY LOOP closes through the drawn aureole',
    aStar40 > aLo &&
      aStar35 < aHi &&
      overlap &&
      leadS > 25 &&
      leadS < 55 &&
      tailS > 15 &&
      windowS > 55 &&
      windowS < 110 &&
      windowS > 3 * m.durationS,
    `the printed onset (full corona 35-40 s before C2) demands a ` +
      `circumsolar sky ${aStar40.toFixed(0)}-${aStar35.toFixed(0)}x the ` +
      `mean at 0.8 deg; the theme's OWN aureole spike (OPAC/Chin ` +
      `diffraction, dust tau 0.02-0.08) draws ${aLo.toFixed(0)}-` +
      `${aHi.toFixed(0)}x - the bands overlap: the naked-eye timing of a ` +
      `2017 eclipse MEASURES the aureole the dome draws. With the ` +
      `mid-column enhancement, coronality runs ${windowS.toFixed(0)} s ` +
      `(onset ${leadS.toFixed(0)} s before C2, ${tailS.toFixed(0)} s ` +
      `after C3) around ${m.durationS.toFixed(1)} s of totality - ` +
      `"coronality, alongside totality", more than three times longer, ` +
      `exactly the edge-site experience the paper coined the word for`
  );
}

// ---- the residual fraction behaves ----------------------------
{
  const m = grazeMarch(MEASURED_S_ARCSEC);
  const fMid = exposedIllumFraction(0, MEASURED_S_ARCSEC);
  const seq = [-40, -30, -20, -12].map((dt) =>
    exposedIllumFraction((m.c2S + dt) / 60, MEASURED_S_ARCSEC)
  );
  const mono = seq.every((v, i) => i === 0 || v < seq[i - 1]);
  check(
    'the LDF residual fraction behaves',
    fMid === 0 && mono && seq[0] > 1e-5 && seq[0] < 1e-3,
    `zero during totality (complete photospheric extinction, exactly); ` +
      `monotone decline into C2 (${seq.map((v) => v.toExponential(1)).join(' > ')}) ` +
      `- their Eq. (6)-(7) light-curve integral over the exposed arcs, ` +
      `normalized by the closed-form disc integral 2 pi Sigma^2/(alpha+2)`
  );
}

process.exit(fail ? 1 : 0);
