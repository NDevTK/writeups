// leewave-reference.mjs - the gate for the mountain-wave layer.
// The law lives once in leewave.js - Stull, Practical Meteorology
// v1.02b (open CC, UBC), ch. 17.7 Mountain Waves (eqs. 17.30-17.32
// with both worked sample applications) and ch. 5.6.3 (eq. 5.4a
// with its ISA sample) - and these landmarks hold it:
//  - eq. 5.4a lands Stull's own ISA-at-4-km numbers: N_BV =
//    0.0111 rad/s, period 565.5 s
//  - eq. 17.30 lands the ch. 17 sample: N = 0.0129 s^-1,
//    lambda = 14.62 km at M = 30 m/s
//  - eq. 17.31's own e-folding sentence holds exactly: amplitude
//    is z1/e at x = b lambda
//  - the dew-point inversion is exact against the gated eLiq and
//    the printed zLCL sample (T = 10, Td = 8 -> 250 m) follows
//  - the virtual-temperature factor is the BLH pass's exact form
//  - the ridge finder recovers a synthetic hill's height, width
//    and distance, prefers the NEAREST qualifying ridge, and
//    returns null under the prominence floor
//  - THE PRINTED CLOUD COUNT EMERGES: Stull's full sample
//    atmosphere over a resonant ridge (Fr3 = 1, z1 = H/2) grows
//    exactly '1 cap cloud and 2 lenticular clouds' - his own
//    sentence - from the assembled chain
import {
  B_DAMP,
  crestClouds,
  dampedZ,
  dewC,
  fr3Regime,
  froude3,
  G_STULL,
  GAMMA_D_KM,
  LCL_A_M_PER_C,
  naturalWavelengthM,
  nBV,
  ridgeFromTransect,
  virtualTk,
  zLclM
} from './leewave.js';
import {eLiq, EPS} from './contrails.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- eq. 5.4a at Stull's ch. 5 sample: ISA at 4 km ------------
{
  const n = nBV(262, -0.0065);
  const p = (2 * Math.PI) / n;
  check(
    'eq. 5.4a lands the printed ISA sample',
    Math.abs(n - 0.01111) < 5e-5 && Math.abs(p - 565.5) < 0.2,
    `N_BV ${n.toFixed(5)} rad/s (print 0.0111), period ${p.toFixed(1)} s ` +
      `(print 565.5) - |g| ${G_STULL}, Gamma_d ` +
      `${(GAMMA_D_KM * 1000).toFixed(1)} K/km, all his own numbers`
  );
}

// ---- eq. 17.30 at the ch. 17 sample ---------------------------
const N17 = nBV(283, -0.005);
const LAM17 = naturalWavelengthM(30, N17);
check(
  'eq. 17.30 lands the printed wavelength',
  Math.abs(N17 - 0.0129) < 1e-4 && Math.abs(LAM17 - 14620) < 30,
  `N ${N17.toFixed(4)} s^-1 (print 0.0129), lambda ` +
    `${(LAM17 / 1000).toFixed(2)} km (print 14.62) at M 30 m/s`
);

// ---- eq. 17.31: the e-folding sentence ------------------------
{
  const z1 = 500;
  const atB = dampedZ(z1, LAM17, B_DAMP * LAM17);
  check(
    'eq. 17.31 e-folds at b wavelengths',
    Math.abs(atB - z1 / Math.E) < 1e-9 && dampedZ(z1, LAM17, 0) === z1,
    `z(b lambda) = ${atB.toFixed(2)} m = z1/e exactly (his sentence: ` +
      `'wave amplitude reduces to 1/e at a downwind distance of b ` +
      `wavelengths'); z(0) = z1`
  );
}

// ---- the moisture chain: exact inversion, printed sample ------
{
  const rh = eLiq(8 + 273.15) / eLiq(10 + 273.15);
  const td = dewC(10, rh);
  const lcl = zLclM(10, td);
  check(
    'dew-point inversion is exact and the printed zLCL follows',
    Math.abs(td - 8) < 1e-6 && Math.abs(lcl - 250) < 1e-3,
    `RH built from eLiq at Td 8 inverts to ${td.toFixed(4)} degC; ` +
      `zLCL = ${LCL_A_M_PER_C}(10 - 8) = ${lcl.toFixed(1)} m (print 250)`
  );
}
{
  const tvDry = virtualTk(20, 0, 101325);
  const tK = 293.15;
  const e = eLiq(tK);
  const w = (EPS * e) / (101325 - e);
  const tvSat = virtualTk(20, 1, 101325);
  const exact = (tK * (1 + w / EPS)) / (1 + w);
  check(
    'virtual temperature carries the exact factor',
    tvDry === tK && Math.abs(tvSat - exact) < 1e-9 && tvSat > tK,
    `dry Tv = T exactly; saturated 20 degC at 1013 hPa lifts Tv to ` +
      `${tvSat.toFixed(2)} K by (1+w/eps)/(1+w) - the BLH pass's form, ` +
      `no 0.61 shortcut`
  );
}

// ---- the ridge finder on synthetic terrain --------------------
{
  const dM = [];
  const eM = [];
  for (let d = 0; d <= 40000; d += 250) {
    dM.push(d);
    let e = 100;
    if (Math.abs(d - 15000) < 5000)
      e += 800 * Math.cos((Math.PI * (d - 15000)) / 10000);
    if (Math.abs(d - 32000) < 4000)
      e += 1400 * Math.cos((Math.PI * (d - 32000)) / 8000);
    eM.push(e);
  }
  const r = ridgeFromTransect(dM, eM);
  const wTrue = (2 * 10000) / 3; // half-height crossings of the cosine
  check(
    'the ridge finder recovers the nearest hill',
    r &&
      Math.abs(r.dM - 15000) <= 250 &&
      Math.abs(r.hM - 800) < 1 &&
      Math.abs(r.wM - wTrue) < 300 &&
      Math.abs(r.elevM - 900) < 1,
    r
      ? `peak ${r.elevM.toFixed(0)} m at ${(r.dM / 1000).toFixed(1)} km, ` +
          `H ${r.hM.toFixed(0)} m, W ${(r.wM / 1000).toFixed(2)} km (true ` +
          `${(wTrue / 1000).toFixed(2)}) - the taller 32 km hill loses to ` +
          `the NEARER one (its waves reach the anchor less damped)`
      : 'no ridge found'
  );
  const flat = ridgeFromTransect(
    dM,
    eM.map((e) => Math.min(e, 240))
  );
  check(
    'the prominence floor fails closed',
    flat === null,
    'a 140 m bump under the 200 m floor returns null - flat fetch ' +
      'writes no waves'
  );
}

// ---- Fr3 ladder -----------------------------------------------
check(
  'the Froude-3 ladder reads as printed',
  froude3(14000, 7000) === 1 &&
    fr3Regime(1) === 'resonant' &&
    fr3Regime(0.2) === 'blocked' &&
    fr3Regime(5) === 'wake',
  'lambda = 2W gives Fr3 = 1 (eq. 17.32) - resonant; 0.2 blocked, ' +
    '5 wake - his qualitative ladder, the octave window stated as ' +
    'the display reading'
);

// ---- THE FLAGSHIP: the printed cloud count emerges ------------
{
  // Stull's sample air (N = 0.0129, M = 30 -> lambda 14.62 km)
  // over a resonant ridge: W = lambda/2 (Fr3 = 1), H = 1000 m so
  // z1 = H/2 = 500 m (his printed resonance amplitude), crest air
  // T 10 / Td 8 (his moisture sample -> zLCL 250 m).
  const fr3 = froude3(LAM17, LAM17 / 2);
  const clouds = crestClouds({z1M: 500, lamM: LAM17, zLclRelM: 250});
  const ladder = clouds.map((c) => c.topRelM.toFixed(1)).join('/');
  check(
    "the printed '1 cap cloud and 2 lenticular clouds' emerges",
    fr3 === 1 &&
      fr3Regime(fr3) === 'resonant' &&
      clouds.length === 3 &&
      clouds[0].n === 0 &&
      clouds[2].n === 2 &&
      clouds.every((c) => c.chordM > 0 && c.chordM < LAM17 / 2) &&
      500 * Math.exp(-3 / B_DAMP) < 250,
    `crest ladder ${ladder} m over zLCL 250 m: the cap (n=0) plus ` +
      `crests 1-2 cloud over, crest 3 (${(500 * Math.exp(-1)).toFixed(1)} m) ` +
      `stays dry - exactly his sample's sentence; chords ` +
      `${clouds.map((c) => (c.chordM / 1000).toFixed(2)).join('/')} km ` +
      `from the printed cosine`
  );
}

process.exit(fail ? 1 : 0);
