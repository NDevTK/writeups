// Reference printer for STEVE (node steve-reference.mjs). The law
// lives once in steve.js - MacDonald et al. 2018 (Science
// Advances, the discovery paper, PMC full text) and Chu et al.
// 2019 (the GRL driver paper, arXiv preprint with the equation
// page machine-read), both read in full - and these landmarks
// hold it:
//  - the printed 7-17 kR redline estimate RE-DERIVES from the
//    printed Carlson excitation rate and the Foster 1994 anchors
//    (their own bracketing arithmetic, both ends)
//  - "Te clearly dominates": the alpha ratio across the printed
//    temperatures is an order of magnitude beyond the Ne ratio
//  - the printed geometry maps to the sky through the sprite
//    pass's gated curvature mapping: near-zenith for the Alberta
//    discovery sites, low-north for mid-latitude observers,
//    nothing when out of range - fails closed
//  - the printed brightness is dark-sky visible through the same
//    Crumey gate the aurora rides ("visible to the human eye"),
//    and dies into daylight
//  - the premidnight window and one-hour episode carry the print
import {
  EVENT_NE,
  EVENT_TE_K,
  FOSTER_NE,
  FOSTER_R,
  FOSTER_TE_K,
  PICKET_LAM,
  PROTON_OFFSET_DEG,
  SAID_HALF_W_DEG,
  SAID_MLT_H,
  STEVE_ALT_KM,
  STEVE_DUR_MIN,
  STEVE_KR,
  STEVE_LAM_RED,
  STEVE_MLAT,
  STEVE_SR,
  alphaO1D,
  eveningIndex,
  inSteveWindow,
  localSolarHours,
  steveDriftRadPerS,
  steveElevationDeg,
  steveEnvelope,
  steveKrBracket,
  steveOnsetHour,
  steveSideSign,
  steveSlabDeg
} from './steve.js';
import {cieY, lineLuminance} from './airglow.js';
import {extendedVisibility} from './adaptation.js';
import {NATURAL_MCD} from './skyglow.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- 1. the printed photometric bracket re-derived --------------
{
  const [lo, hi] = steveKrBracket();
  check(
    'printed 7-17 kR bracket re-derived',
    lo >= STEVE_KR[0] * 0.9 &&
      lo <= STEVE_KR[0] * 1.1 &&
      hi >= STEVE_KR[1] * 0.9 &&
      hi <= STEVE_KR[1] * 1.1,
    `Foster's 350 R x alpha(7600)/alpha(4000..3500): ${lo.toFixed(1)}-` +
      `${hi.toFixed(1)} kR vs the printed 7-17 - the window IS the Foster Te ` +
      `span through their own equation, both ends within 10%`
  );
  const domTe = alphaO1D(EVENT_TE_K) / alphaO1D(3750);
  const caveat = EVENT_NE / FOSTER_NE;
  check(
    'Te clearly dominates (their words, quantified)',
    domTe > 20 && domTe < 45 && caveat > 0.5 && caveat < 1,
    `alpha rises x${domTe.toFixed(0)} from 3750 K to the event's 7600 K while ` +
      `the separately-caveated Ne depletion is only x${caveat.toFixed(2)} - the ` +
      `printed dominance statement, and why the window ignores Ne`
  );
  const mono =
    alphaO1D(3000) < alphaO1D(5000) && alphaO1D(5000) < alphaO1D(8000);
  check(
    'excitation rate physical',
    mono && alphaO1D(EVENT_TE_K) > 1e-12 && alphaO1D(EVENT_TE_K) < 1e-9,
    `alpha(Te) monotone over the SAR-STEVE range; alpha(7600 K) = ` +
      `${alphaO1D(EVENT_TE_K).toExponential(2)} cm^3/s (thermal excitation scale)`
  );
}

// ---- 2. the drawn geometry --------------------------------------
{
  const albertaEl = steveElevationDeg(58.5);
  const midLatEl = steveElevationDeg(50);
  const tooFar = steveElevationDeg(38);
  check(
    'printed MLAT maps to the observed skies',
    albertaEl > 40 &&
      steveSideSign(58.5) === 1 &&
      midLatEl > 5 &&
      midLatEl < 15 &&
      steveSideSign(64) === -1 &&
      tooFar === null &&
      steveElevationDeg(NaN) === null,
    `gmLat 58.5 (the Alberta discovery belt): arc at ${albertaEl.toFixed(0)} deg - ` +
      `the near-overhead ribbon of the citizen photos; gmLat 50: ${midLatEl.toFixed(1)} deg ` +
      `low toward the magnetic pole; gmLat 64 sees it equatorward; gmLat 38 or ` +
      `unmeasured: nothing, fails closed`
  );
  check(
    'printed structural constants carried',
    STEVE_MLAT === 60 &&
      SAID_HALF_W_DEG === 0.57 &&
      STEVE_ALT_KM[0] === 170 &&
      STEVE_ALT_KM[1] === 230 &&
      PROTON_OFFSET_DEG === 2 &&
      STEVE_DUR_MIN === 60,
    `arc just below 60 deg MLAT, SAID half-width 0.57 deg, emission mapped at ` +
      `170-230 km, proton aurora 2 deg poleward, ~1 h episode - the discovery ` +
      `paper's numbers`
  );
  const slab = steveSlabDeg(58.5);
  const slabFar = steveSlabDeg(50);
  const drift = (steveDriftRadPerS(58.5) * 180) / Math.PI;
  check(
    'the slab and the flow on the sky',
    slab &&
      slab.hi > slab.lo &&
      slab.hi - slab.lo > 5 &&
      slabFar &&
      slabFar.hi - slabFar.lo < 4 &&
      steveSlabDeg(38) === null &&
      drift > 0.5 &&
      drift < 2,
    `printed 170-230 km edges from the discovery belt: ${slab.lo.toFixed(0)}-` +
      `${slab.hi.toFixed(0)} deg tall ribbon; from gmLat 50 a thin ` +
      `${(slabFar.hi - slabFar.lo).toFixed(1)} deg band; and the printed 5.5 km/s ` +
      `westward flow streams the pickets at ${drift.toFixed(1)} deg/s at the ` +
      `slant range - motion carried from print, not styled`
  );
}

// ---- 3. dark-sky visible, daylight dead -------------------------
{
  const kR = (v) => v * 1e3; // rayleigh chain units (R)
  const L7 = lineLuminance(kR(STEVE_KR[0]), STEVE_LAM_RED, cieY(STEVE_LAM_RED));
  const L17 = lineLuminance(
    kR(STEVE_KR[1]),
    STEVE_LAM_RED,
    cieY(STEVE_LAM_RED)
  );
  const dark = NATURAL_MCD * 1e-3;
  // The arc's angular size: half a degree of MLAT at the printed
  // altitudes seen from the discovery belt - an extended ribbon;
  // 0.01 sr is the same order the aurora gate uses for arcs.
  const vDark = extendedVisibility(L7, dark, STEVE_SR);
  const vDay = extendedVisibility(L17, 3000, STEVE_SR);
  check(
    '"visible to the human eye" through the Crumey gate',
    L7 > 1e-4 && vDark > 0.5 && vDay === 0,
    `the printed lower bound 7 kR at 630 nm = ${L7.toExponential(2)} cd/m^2 - ` +
      `${(L7 / dark).toFixed(1)}x the natural dark sky, visibility ${vDark.toFixed(2)}; ` +
      `daylight extinguishes even 17 kR (${L17.toExponential(2)} cd/m^2) - the ` +
      `printed phrase lands through the same threshold the aurora rides`
  );
  check(
    'the two lines of the display',
    STEVE_LAM_RED === 630 && PICKET_LAM === 557.7,
    `redline 630 nm (the printed thermal-excitation share) + picket fence at ` +
      `the aurora's own 557.7 nm green - the continuum share of the mauve stays ` +
      `a documented display mixture ("exotic emissions", unexplained in the print)`
  );
}

// ---- 4. the premidnight window and the ~1 h episode -------------
{
  check(
    'printed window and cadence',
    inSteveWindow(22.5) &&
      inSteveWindow(21.2) &&
      inSteveWindow(0.2) &&
      !inSteveWindow(18) &&
      !inSteveWindow(1.0) &&
      !inSteveWindow(2.5) &&
      Math.abs(SAID_MLT_H - 22.5) < 1e-12 &&
      !inSteveWindow(NaN),
    `premidnight hours around the quoted 22:30 MLT (drawn 21:00-00:30 local as ` +
      `the documented MLT proxy, wrapping midnight); afternoon and late night ` +
      `draw nothing; unmeasured time fails closed`
  );
  check(
    'local solar hours proxy',
    Math.abs(localSolarHours(0, 0) - 0) < 1e-9 &&
      Math.abs(localSolarHours(0, 105) - 7) < 1e-9 &&
      Math.abs(localSolarHours(12 * 3600e3, -120) - 4) < 1e-9 &&
      Number.isNaN(localSolarHours(0, NaN)),
    `UTC + lon/15: Greenwich midnight = 0 h, 105 E = 7 h, 120 W noon UTC = 4 h; ` +
      `no longitude, no clock`
  );
  // The hashed per-site-night onset: deterministic, always inside
  // the window with room for the full printed duration.
  let onsetsOK = true;
  const onsets = [];
  for (let ev = 100; ev < 130; ev++) {
    const o = steveOnsetHour(ev, 54.5, -113.5);
    onsets.push(o);
    if (
      !(o >= 21) ||
      !(o <= 24.5 - STEVE_DUR_MIN / 60) ||
      o !== steveOnsetHour(ev, 54.5, -113.5)
    )
      onsetsOK = false;
  }
  const spread = Math.max(...onsets) - Math.min(...onsets);
  // The envelope: off before onset, full mid-episode, off after -
  // and the integrated duration is the printed hour less the two
  // 5-min raised-cosine edges' half-weight (55 min).
  const on = 22.0;
  let intMin = 0;
  for (let m = -30; m < 120; m += 0.25) {
    intMin += steveEnvelope(on + m / 60, on) * 0.25;
  }
  check(
    'the printed ~1 h episode, hashed per night',
    onsetsOK &&
      spread > 1 &&
      steveEnvelope(21.9, on) === 0 &&
      steveEnvelope(22.5, on) === 1 &&
      steveEnvelope(23.05, on) === 0 &&
      Math.abs(intMin - (STEVE_DUR_MIN - 5)) < 0.5 &&
      steveEnvelope(NaN, on) === 0 &&
      eveningIndex(0, 0) === eveningIndex(3 * 3600e3, 0),
    `onset deterministic per site-night, spread ${spread.toFixed(1)} h across a ` +
      `month, always leaving room for the printed 60 min; envelope integrates ` +
      `${intMin.toFixed(1)} min with 5-min cosine edges; one seed per evening ` +
      `across its midnight crossing`
  );
  check(
    'gate solid angle documented',
    STEVE_SR === 0.01,
    `thin-ribbon Crumey envelope 0.01 sr - conservative against the curtain's 0.1`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
