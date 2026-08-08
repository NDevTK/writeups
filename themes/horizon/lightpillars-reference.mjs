// Reference printer for light pillars (node
// lightpillars-reference.mjs). The law lives once in
// lightpillars.js - Zeng 2018 (JAMES, the diamond-dust
// microphysics model) and Ricaud et al. 2017 (ACP, the Dome C
// lidar episodes), both open access - and these landmarks hold
// it:
//  - the printed frame is carried: the 100-300 m layer, the
//    "typically less than -10 degC" formation, the plate habit
//    riding the theme's ALREADY-BOOKED tilt statistics (Breon &
//    Dubrulle's ~1 deg through the sun-pillar mirror fold - no
//    new constant anywhere)
//  - the mirror geometry is exact: image at twice the height,
//    top elevation atan(2H/d), near lights tower while far ones
//    shrink, and the drawn column is 2H by construction
//  - the occurrence gate is the METAR report itself: 'IC'
//    matches as a code group, blowing/drifting snow and
//    remarks do not, no report -> no pillars (fails closed)
//  - the profile is flat-bodied with the tilt fold's own edge -
//    wider (relatively) for far lights exactly as the geometry
//    says
import {
  DD_ARCTIC_FREQ,
  DD_LAYER_DRAWN_M,
  DD_LAYER_M,
  DD_T_TYP_C,
  diamondDustReported,
  PILLAR_SIGMA_ALT,
  pillarColumnM,
  pillarHalfWidthM,
  pillarHalfWidthRad,
  pillarProfile,
  pillarTopRad,
  PLATE_TILT_THETA
} from './lightpillars.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const DEG = Math.PI / 180;

// ---- 1. the printed frame ---------------------------------------
{
  check(
    'printed diamond-dust frame carried',
    DD_LAYER_M[0] === 100 &&
      DD_LAYER_M[1] === 300 &&
      DD_LAYER_DRAWN_M === 200 &&
      DD_T_TYP_C === -10 &&
      DD_ARCTIC_FREQ[0] === 0.2 &&
      DD_ARCTIC_FREQ[1] === 0.5,
    `Ricaud's lidar layer 100-300 m (drawn at the 200 m midpoint), Zeng's ` +
      `"typically less than -10 degC" and 20-50% arctic winter frequency - ` +
      `the phenomenon's printed envelope`
  );
  check(
    'the tilt is the booked one',
    Math.abs(PLATE_TILT_THETA - Math.PI / 180) < 1e-12 &&
      Math.abs(PILLAR_SIGMA_ALT - Math.SQRT2 * PLATE_TILT_THETA) < 1e-12 &&
      Math.abs(pillarHalfWidthRad() - PILLAR_SIGMA_ALT) < 1e-15,
    `Breon & Dubrulle's ~1 deg plate tilt through the sun pillar's own ` +
      `sqrt(2) mirror fold - the light pillar adds NO new constant`
  );
}

// ---- 2. the exact mirror geometry -------------------------------
{
  const near = pillarTopRad(1000);
  const far = pillarTopRad(8000);
  check(
    'image at twice the height',
    Math.abs(pillarColumnM() - 400) < 1e-12 &&
      Math.abs(near - Math.atan2(400, 1000)) < 1e-15 &&
      near > 21 * DEG &&
      near < 22 * DEG &&
      far > 2.5 * DEG &&
      far < 3.2 * DEG &&
      pillarTopRad(0) === 0 &&
      pillarTopRad(NaN) === 0,
    `a 200 m layer over a light 1 km away: pillar to ${(near / DEG).toFixed(1)} deg ` +
      `(towering); 8 km away: ${(far / DEG).toFixed(1)} deg (a stub) - atan(2H/d) ` +
      `exactly, the classic near-light drama; no distance, no pillar`
  );
  const w2 = pillarHalfWidthM(2000);
  check(
    'width is the tilt at range',
    Math.abs(w2 - 2000 * Math.tan(PILLAR_SIGMA_ALT)) < 1e-9 &&
      w2 > 45 &&
      w2 < 55,
    `at 2 km the booked sqrt(2) x 1 deg spread is a ${w2.toFixed(0)} m ` +
      `half-width column - thin and tall, as photographed`
  );
}

// ---- 3. the measured occurrence gate ----------------------------
{
  check(
    'METAR IC report gates, fails closed',
    diamondDustReported('IC') &&
      diamondDustReported('-SN IC') &&
      diamondDustReported('IC BR') &&
      diamondDustReported('+IC') &&
      !diamondDustReported('BLSN') &&
      !diamondDustReported('DRSN') &&
      !diamondDustReported('FZFG') &&
      !diamondDustReported('ICE') &&
      !diamondDustReported('') &&
      !diamondDustReported(null),
    `'IC' as a space-delimited code group (with intensity prefixes) reports ` +
      `diamond dust; blowing/drifting snow, freezing fog, 'ICE' fragments and ` +
      `silence do not - the aerodrome's own observation is the gate`
  );
}

// ---- 4. the profile ---------------------------------------------
{
  const bodyNear = pillarProfile(0.5, 1000);
  const topNear = pillarProfile(0.995, 1000);
  const softFar =
    pillarProfile(0.7, 12000) < 1 && pillarProfile(0.5, 12000) === 1;
  check(
    'flat body, tilt-fold top',
    bodyNear === 1 &&
      topNear < 0.3 &&
      pillarProfile(0.01, 1000) < 0.2 &&
      softFar &&
      pillarProfile(1.5, 1000) === 0 &&
      pillarProfile(-0.1, 1000) === 0,
    `mid-column full (every height mirrors somewhere), the top softens over ` +
      `the tilt fold's share - RELATIVELY wider for far lights (sigma against ` +
      `a smaller atan(2H/d)) exactly as the geometry says; outside [0,1] zero`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
