// wetground-reference.mjs - the gate for the wet world
// (wetground.js). The law lives once there; the primary (Lekner
// & Dorf 1988, read in full via the openly served annotated
// rendering) supplies every pin. Landmarks:
//  - THE INTERNAL MIRROR FROM THE SHIPPED FRESNEL: integrating
//    the repo's own gated Fresnel split over the hemisphere
//    lands BOTH printed return probabilities - Angstrom's 0.437
//    and their improved 0.475 - and Stern's reciprocity
//    R(x, n) = R(x/n^2, 1/n) holds numerically at every sample
//  - the printed small-absorption ratios: wetting raises the
//    single-interaction absorption by their printed 7/8/10% at
//    nr = 1.5/2/2.5
//  - ANGSTROM'S MEASURED PAIRS LAND: the model's wet albedo at
//    his measured dry sand and black mold reproduces his
//    measured wet values at the paper's own scatter
//  - darker above the gloss floor (below it the film's ~2%
//    entry reflection outshines a near-black surface - wet
//    coal glints), and strongest where absorption is weak -
//    their Fig. 2 sentence as inequalities
//  - the wetness state: rain saturates the skin, the measured
//    soil column speaks otherwise, silence means dry
import {
  pAngstrom,
  pInternal,
  rBarIso,
  rUnpol,
  wetAlbedo,
  wetDarkenFactor,
  wetnessFrom
} from './wetground.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- the internal mirror from the shipped Fresnel -------------
{
  const pA = pAngstrom();
  const p = pInternal();
  let worstRec = 0;
  for (let i = 1; i < 40; i++) {
    const x = i / 40;
    const n = 1.45;
    worstRec = Math.max(
      worstRec,
      Math.abs(rUnpol(x, n) - rUnpol(x / (n * n), 1 / n))
    );
  }
  check(
    'THE INTERNAL MIRROR from the shipped Fresnel',
    Math.abs(pA - 0.4375) < 1e-12 &&
      Math.abs(p - 0.475) < 0.002 &&
      worstRec < 1e-12,
    `Angstrom's cone gives p = ${pA.toFixed(4)} (their printed 0.437); ` +
      `adding the sub-critical Fresnel return - integrated from the ` +
      `repo's own coxmunk split, not transcribed - lands p = ` +
      `${p.toFixed(3)} (their printed 0.475): the machinery that ` +
      `polarizes the drawn sea sets how dark the wet ground goes; and ` +
      `Stern's reciprocity R(x,n) = R(x/n^2, 1/n) holds to ` +
      `${worstRec.toExponential(1)} at every sample (their Eq. 5)`
  );
}

// ---- the printed small-absorption ratios ----------------------
{
  const ratios = [1.5, 2, 2.5].map((nr) => {
    const aDry = 1e-3;
    const ratio = (1 - rBarIso(nr / (4 / 3))) / (1 - rBarIso(nr));
    return ratio; // a_w/a_d in the small-a limit, their Eq. (11)
  });
  const printed = [1.07, 1.08, 1.1];
  const worst = Math.max(...ratios.map((r, i) => Math.abs(r - printed[i])));
  check(
    'wetting raises absorption by their printed percentages',
    worst < 0.015,
    `small-absorption a_w/a_d = ` +
      `${ratios.map((r) => r.toFixed(3)).join(' / ')} at nr = 1.5/2/2.5 ` +
      `vs their printed 1.07/1.08/1.10 - the relative-index half of the ` +
      `darkening, worst ${worst.toFixed(3)} off the print`
  );
}

// ---- Angstrom's measured pairs land ---------------------------
{
  const sand = wetAlbedo(0.182);
  const mold = wetAlbedo(0.141);
  check(
    "ANGSTROM'S MEASURED PAIRS land",
    Math.abs(sand - 0.091) < 0.03 && Math.abs(mold - 0.084) < 0.03,
    `dry sand 0.182 wets to ${sand.toFixed(3)} (Angstrom measured ` +
      `0.091), dry black mold 0.141 to ${mold.toFixed(3)} (measured ` +
      `0.084, itself an average of 0.091/0.081/0.081) - the model built ` +
      `from the shipped Fresnel reproduces the 1925 pyranometer pairs ` +
      `at the paper's own Fig. 3 scatter`
  );
}

// ---- darker above the gloss floor, strongest where weak -------
{
  // Below a tiny albedo the model turns the sign: the film's own
  // ~2% entry reflection outshines a near-black surface (wet
  // coal glints). Find the crossover, then hold the darkening
  // above it.
  let lo = 0.001;
  let hi = 0.2;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (wetAlbedo(mid) > mid) lo = mid;
    else hi = mid;
  }
  const crossRho = (lo + hi) / 2;
  let alwaysDarker = true;
  for (let rho = 0.06; rho <= 0.9; rho += 0.02)
    if (wetAlbedo(rho) >= rho) alwaysDarker = false;
  // Their Fig. 2 sentence, literally: the ABSORPTION ratio A/a_d
  // is largest where absorption is weak.
  const absRatio = (aDry) => {
    const rho = 1 - aDry;
    return (1 - wetAlbedo(rho)) / aDry;
  };
  const fw = [0, 0.5, 1].map((w) => wetDarkenFactor(0.2, w));
  check(
    'darker above the gloss floor, strongest where absorption is weak',
    crossRho < 0.05 &&
      alwaysDarker &&
      absRatio(0.1) > absRatio(0.5) &&
      absRatio(0.5) > absRatio(0.9) &&
      fw[0] === 1 &&
      fw[1] > fw[2] &&
      fw[2] < 0.7,
    `every ground darker than dry albedo ${crossRho.toFixed(3)} wets ` +
      `DARKER (below that floor the film's ~2% entry gloss outshines a ` +
      `near-black surface - wet coal's sheen, the model's own honest ` +
      `sign change); the absorption ratio A/a_d falls ` +
      `${absRatio(0.1).toFixed(2)} > ${absRatio(0.5).toFixed(2)} > ` +
      `${absRatio(0.9).toFixed(2)} from weak to strong absorption - ` +
      `their "the darkening effect is strongest when the absorption is ` +
      `weak"; the client factor runs 1 -> ${fw[2].toFixed(2)} as ` +
      `wetness saturates at dry albedo 0.2`
  );
}

// ---- the wetness state ----------------------------------------
{
  const dry = wetnessFrom(null, 0);
  const soil = wetnessFrom(0.21, 0);
  const rain = wetnessFrom(0.07, 1.2);
  const damp = wetnessFrom(0.07, 0);
  check(
    'the wetness state composes its two sources',
    dry === 0 &&
      Math.abs(soil - 0.6) < 1e-9 &&
      rain >= 0.9 &&
      Math.abs(damp - 0.2) < 1e-9,
    `feed silence reads dry (0); measured 0.21 m^3/m^3 topsoil reads ` +
      `${soil.toFixed(2)} of the stated 0.35 saturation scale; live rain ` +
      `saturates the skin to ${rain.toFixed(2)} regardless of the ` +
      `column (a film exists while rain falls - stated), and after the ` +
      `rain the measured soil (${damp.toFixed(2)}) takes over - the ` +
      `world dries at the speed the soil model actually dries`
  );
}

process.exit(fail ? 1 : 0);
