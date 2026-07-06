// Reference printer for noctilucent clouds (node
// nlc-reference.mjs). The model lives once in nlc.js; landmarks
// against exact geometry and the classical NLC literature:
//  - shell distance: overhead exactly h; at the horizon exactly
//    sqrt(h(2R+h)) - both closed forms
//  - the zenith shadow boundary is acos(R/(R+h)) with NO
//    screening (the cylinder grazes the solid Earth overhead):
//    9.24 deg for h = 83 km - and the exact test agrees with the
//    closed form to the bisection's precision
//  - DERIVED WINDOW: the last sunlit shell patch toward the
//    sunward horizon dies at ~16.6 deg solar depression - the
//    published Gadsden & Schroeder "6-16 deg" visibility window
//    emerges from the shadow-cylinder geometry (with Rozenberg's
//    ~30 km twilight screening) instead of being put in
//  - asymmetry: at 12 deg depression the sunward horizon still
//    burns while the antisolar sky is long dark
//  - season envelope: peak exactly 22 days after the summer
//    solstice of the OBSERVER'S hemisphere, zero outside the
//    -32..+65 day window, zero equatorward of 50 deg, hemisphere
//    flip exact (a January display at 60 S while 60 N has none)
import {
  BETA_MIN_DEG,
  NLC_H_KM,
  SCREEN_KM,
  seasonEnvelope,
  shadowEntryDepression,
  shellDistanceKm,
  sunlitAtShell
} from './nlc.js';
import {R_EARTH} from './lightning.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const D = Math.PI / 180;

{
  const up = shellDistanceKm(Math.PI / 2);
  const hor = shellDistanceKm(0);
  const exactHor = Math.sqrt(NLC_H_KM * (2 * R_EARTH + NLC_H_KM));
  check(
    'shell distances',
    Math.abs(up - NLC_H_KM) < 1e-9 && Math.abs(hor - exactHor) < 1e-9,
    `zenith -> ${up.toFixed(3)} km (h exactly); horizon -> ${hor.toFixed(1)} km (sqrt(h(2R+h)) = ${exactHor.toFixed(1)} exactly)`
  );
}

{
  // Overhead, both closed forms are exact against the bisection:
  // the SOLID-Earth boundary acos(R/(R+h)) is the textbook
  // "shadow reaches 83 km at ~9.2 deg"; with Rozenberg's 30 km
  // screening the cylinder widens to acos((R+s)/(R+h)). And
  // overhead has no sunward/antisolar asymmetry.
  const closedSolid = Math.acos(R_EARTH / (R_EARTH + NLC_H_KM)) / D;
  const closedScreen =
    Math.acos((R_EARTH + SCREEN_KM) / (R_EARTH + NLC_H_KM)) / D;
  const zenithSolid = shadowEntryDepression(Math.PI / 2, 0, NLC_H_KM, 0) / D;
  const zenithScreen = shadowEntryDepression(Math.PI / 2, 0) / D;
  const symmetric =
    Math.abs(shadowEntryDepression(Math.PI / 2, Math.PI) / D - zenithScreen) <
    1e-6;
  check(
    'zenith shadow boundary',
    closedSolid > 9.0 &&
      closedSolid < 9.4 &&
      Math.abs(zenithSolid - closedSolid) < 1e-6 &&
      Math.abs(zenithScreen - closedScreen) < 1e-6 &&
      symmetric,
    `solid Earth: bisection ${zenithSolid.toFixed(4)} = acos(R/(R+h)) = ${closedSolid.toFixed(4)} deg (textbook ~9.2); screened: ${zenithScreen.toFixed(4)} = acos((R+s)/(R+h)) = ${closedScreen.toFixed(4)} deg; azimuth-independent overhead`
  );
}

{
  // The derived visibility window: sunward horizon, the LAST
  // sunlit direction.
  const betaMax = shadowEntryDepression(0, 0) / D;
  const anti = sunlitAtShell(0, Math.PI, 12 * D);
  const sunward = sunlitAtShell(0, 0, 12 * D);
  check(
    'derived 6-16 deg window',
    betaMax > 15.5 &&
      betaMax < 17.5 &&
      sunward &&
      !anti &&
      BETA_MIN_DEG === 6 &&
      SCREEN_KM === 30,
    `sunward-horizon shadow entry at ${betaMax.toFixed(2)} deg depression (Gadsden & Schroeder's published ~16); at 12 deg the sunward horizon burns while the antisolar sky is dark; lower gate ${BETA_MIN_DEG} deg (sky brightness), screening ${SCREEN_KM} km (Rozenberg)`
  );
}

{
  const peakN = seasonEnvelope(172 + 22, 60);
  const offN = seasonEnvelope(100, 60);
  const janS = seasonEnvelope(11, -60); // Dec solstice + 21
  const janN = seasonEnvelope(11, 60);
  const lowLat = seasonEnvelope(194, 45);
  const ramp = seasonEnvelope(194, 54) < seasonEnvelope(194, 60);
  check(
    'season envelope',
    Math.abs(peakN - 1) < 1e-12 &&
      offN === 0 &&
      janS > 0.99 &&
      janN === 0 &&
      lowLat === 0 &&
      ramp,
    `NH peak = 1 exactly 22 d after Jun 21; day 100 -> 0; Jan 11 at 60 S -> ${janS.toFixed(3)} while 60 N -> 0 (hemisphere flip, year wrap); 45 deg -> 0; 54 < 60 deg ramp`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
