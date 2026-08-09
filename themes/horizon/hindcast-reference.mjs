// hindcast-reference.mjs - the record hindcast: the world-record
// long-distance photograph reproduced through the shipped ray fan
// from the morning's own archived radiosonde. No new law - every
// instrument here is already gated (parseWyoText, buildProfile,
// rayFan, fanBranches, refractionK); what is NEW is the ground
// truth: a documented, dated, photographed observation the
// machinery either explains or fails.
//
// THE OBSERVATION (Beyond Horizons, "443 KM | Finestrelles,
// Pyrenees - Pic Gaspard, Alps", the record page read in full):
// at dawn on 16 July 2016 (~04:10 UTC) Marc Bret photographed,
// from Pic de Finestrelles (2820 m, printed), the silhouette of
// the Ecrins massif: Barre des Ecrins (4102 m, printed) at
// 440 km and Pic Gaspard (3883 m) at the printed 443 km - "the
// brand new World Record of distant photograph of landscapes" -
// with "refractive favorable circumstances" claimed but never
// computed. The line of sight crosses the Gulf of Lion at
// grazing height (sea level path - stated simplification; the
// land segments near both ends lie far below the ray).
//
// THE INSTRUMENT RECORD: Nimes-Courbessac (07645) 00Z radiosonde
// that morning, vendored verbatim (hindcast-nimes-data.js) - the
// nearest standard ascent in space (the coastal station by the
// path's midpoint) and time (four hours before the photograph,
// stated). It carries an elevated inversion (9.4 -> 11.4 degC
// across 1409 -> 1545 m) under a stable ~-3.5 K/km layer - the
// morning's own favorable air, measured.
//
// Landmarks:
//  - the fixture parses through the SAME gated parser the daemon
//    uses, and its verbatim anchors hold (surface row, the
//    inversion pair, 62 rows to 28.6 km)
//  - BARE EARTH BLOCKS: the straight ray sags ~500 m under the
//    Mediterranean - no refraction, no record
//  - the standard atmosphere is MARGINAL: Hirt's k at the
//    standard surface clears the sea by a grazing sliver
//  - THE FAN REPRODUCES THE RECORD through the measured column:
//    Pic Gaspard at 443 km and the Barre at 440 km both return
//    branches, at apparent altitudes below the horizontal (the
//    photograph's "thin line of Mountains rises over the
//    Horizon"), with the grazing height over the Gulf printed
//  - THE RECORD SITS AT THE MEASURED EDGE: bisecting the fan,
//    a 3883 m summit stops being visible almost exactly at the
//    printed 443 km - the photograph was taken at the measured
//    column's own visibility limit. The ISA column reaches a
//    few km farther: the land-based 00Z ascent's superadiabatic
//    surface layer UNBENDS the grazing miles, and the marine
//    boundary layer the ray actually crossed lies beyond any
//    land radiosonde - the honest residual, stated, not tuned
//    away. The hindcast's job is to report where the archived
//    instrument puts the edge, and it puts it ON the record.
import {parseWyoText} from './sounding.js';
import {buildProfile, standardProfile} from './refraction.js';
import {fanBranches, rayFan, R_EARTH, refractionK} from './far-terrain.js';
import {NIMES_2016071600} from './hindcast-nimes-data.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// The printed facts of the record.
const OBS_M = 2820; // Pic de Finestrelles (the record page)
const GASPARD_M = 3883; // Pic Gaspard
const GASPARD_KM = 443; // the printed record distance
const ECRINS_M = 4102; // Barre des Ecrins (the record page)
const ECRINS_KM = 440;

// ---- the fixture parses and its anchors hold ------------------
const rows = parseWyoText(NIMES_2016071600);
{
  const s0 = rows[0];
  const inv = rows.filter((r) => r.hM === 1409 || r.hM === 1545);
  check(
    'the archived ascent parses through the gated parser',
    rows.length === 62 &&
      s0.p === 1014 &&
      s0.hM === 60 &&
      s0.tC === 19.4 &&
      inv.length === 2 &&
      inv[0].tC === 9.4 &&
      inv[1].tC === 11.4 &&
      rows[rows.length - 1].hM === 28610,
    `62 rows, surface 1014 hPa / 60 m / 19.4 degC, the elevated ` +
      `inversion 9.4 -> 11.4 degC across 1409 -> 1545 m, top 28.6 km - ` +
      `verbatim anchors of the 00Z Nimes ascent, parseWyoText the ` +
      `daemon's own`
  );
}

// The connecting ray's minimum height in the FLAT-EARTH frame:
// the ground is flat and a straight ray rises away from it at
// h'' = (1-k)/R (the sphere falls away - the fan's own sign
// derivation), so h(x) = h1 + s x + a x^2 with a = (1-k)/(2R)
// and s set to hit h2 at d. Concave UP: the low point sits
// inside the span (at -s/2a when s < 0), exactly the sag the
// fan generalises to a full kappa profile.
function chordMin(h1, h2, dM, k) {
  const a = (1 - k) / (2 * R_EARTH);
  const s = (h2 - h1) / dM - a * dM;
  if (s >= 0) return h1;
  const xStar = Math.min(-s / (2 * a), dM);
  return h1 + s * xStar + a * xStar * xStar;
}

// ---- bare Earth blocks ----------------------------------------
{
  const hMin = chordMin(OBS_M, GASPARD_M, GASPARD_KM * 1e3, 0);
  check(
    'bare Earth blocks the record',
    hMin < -400,
    `the unrefracted ray bottoms at ${hMin.toFixed(0)} m - half a ` +
      `kilometre under the Mediterranean; without refraction there is ` +
      `no photograph`
  );
}

// ---- the standard atmosphere is marginal ----------------------
const K_STD = refractionK(1013.25, 288.15, -0.0065);
{
  const hMin = chordMin(OBS_M, GASPARD_M, GASPARD_KM * 1e3, K_STD);
  check(
    'the standard atmosphere clears by a grazing sliver',
    hMin > 0 && hMin < 400,
    `Hirt's standard k = ${K_STD.toFixed(4)} lifts the ray's low point ` +
      `to ${hMin.toFixed(0)} m over the Gulf of Lion - the record sits ` +
      `at the very edge of standard refraction`
  );
}

// ---- the fan through the measured column ----------------------
// The same row mapping applySounding ships to buildProfile.
const lv = rows
  .filter((q) => q.hM > rows[0].hM + 0.5)
  .map((q) => ({
    pPa: q.p * 100,
    hM: q.hM,
    tC: q.tC,
    rh: (q.rh ?? 0) / 100
  }));
const prof = buildProfile(lv, {
  hM: rows[0].hM,
  tC: rows[0].tC,
  rh: (rows[0].rh ?? 0) / 100
});
const N_ALPHA = 900;
const alphas = [];
for (let i = 0; i < N_ALPHA; i++)
  alphas.push(((-2.5 + (2.5 * i) / (N_ALPHA - 1)) * Math.PI) / 180);
const fanMeas = rayFan(prof, OBS_M + 2, alphas, 450e3, 100);
const brGaspard = fanBranches(fanMeas, GASPARD_KM * 1e3, GASPARD_M);
const brEcrins = fanBranches(fanMeas, ECRINS_KM * 1e3, ECRINS_M);

// Grazing height of a connecting ray: re-march the single branch
// angle and take the lowest finite height along the path.
function grazeM(profile, obsM, alphaRad, dM) {
  const one = rayFan(profile, obsM, [alphaRad], dM, 100);
  let m = Infinity;
  const n = Math.round(dM / 100);
  for (let j = 0; j < n; j++) {
    const h = one.hs[0][j];
    if (Number.isFinite(h)) m = Math.min(m, h);
    else return NaN; // struck ground before the target
  }
  return m;
}

{
  const aDeg = brGaspard.map((a) => ((a * 180) / Math.PI).toFixed(2));
  const gr = brGaspard.length
    ? grazeM(prof, OBS_M + 2, brGaspard[0], GASPARD_KM * 1e3)
    : NaN;
  check(
    'THE RECORD REPRODUCES through the measured column',
    brGaspard.length >= 1 &&
      brEcrins.length >= 1 &&
      brGaspard.every((a) => a < 0 && a > (-2.2 * Math.PI) / 180) &&
      Number.isFinite(gr) &&
      gr > 0,
    `Pic Gaspard at the printed 443 km returns ${brGaspard.length} ` +
      `branch(es) at ${aDeg.join('/')} deg apparent altitude (below the ` +
      `horizontal - the photograph's thin line ON the horizon) and the ` +
      `Barre at 440 km returns ${brEcrins.length}; the connecting ray ` +
      `grazes ${gr.toFixed(0)} m over the Gulf of Lion - the 00Z ` +
      `morning column carries the world record`
  );
}

// ---- the record sits at the measured edge ---------------------
{
  // Farthest distance at which a Pic-Gaspard-height summit still
  // returns a branch, bisected on the fan's own columns (2 km
  // step): the measured column's visibility limit.
  const farthest = (fan) => {
    for (let d = 450e3; d >= 380e3; d -= 2e3) {
      if (fanBranches(fan, d, GASPARD_M).length) return d;
    }
    return null;
  };
  const fanIsa = rayFan(standardProfile(), OBS_M + 2, alphas, 450e3, 100);
  const fM = farthest(fanMeas);
  const fI = farthest(fanIsa);
  check(
    'THE RECORD SITS AT THE MEASURED EDGE',
    fM != null &&
      Math.abs(fM - GASPARD_KM * 1e3) <= 3e3 &&
      fI != null &&
      fI >= fM,
    `through the archived 00Z column a ${GASPARD_M} m summit stays ` +
      `visible out to ${(fM / 1e3).toFixed(0)} km - the printed record ` +
      `distance IS the measured column's own limit (443 km, within the ` +
      `fan's 2 km step). The ISA column reaches ${(fI / 1e3).toFixed(0)} ` +
      `km: the land-based ascent's superadiabatic surface layer unbends ` +
      `the grazing miles, and the marine boundary layer the ray actually ` +
      `crossed lies beyond any land radiosonde - the residual stated, ` +
      `not tuned away`
  );
}

process.exit(fail ? 1 : 0);
