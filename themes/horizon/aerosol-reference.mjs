// Reference gate for aerosol.js (node aerosol-reference.mjs):
//  - the LIVE GEFS-Aerosols fixture flows end-to-end (bytes ->
//    decoded messages -> products at a cell) onto the ecCodes pins
//  - Angstrom (1929) channel interpolation is EXACT on a pure
//    power law and restated independently on the fixture
//  - the two-anchor SSA line hits its measured anchors; species
//    physics read straight off the feed (sea salt conservative,
//    black carbon dark, GOCART total = sum of species)
//  - the Hillaire-profile calibration is an algebraic identity
//    (column above terrain = measured tau), and with a flat
//    tau = 4.44e-6 * 1200, SSA 0.9 column the pipeline lands on
//    the paper's exact constants (3.996e-6 / 4.44e-7) - the
//    measured path degenerates to Hillaire (2020) when the air
//    matches the paper
import {
  CHANNEL_NM,
  MIE_H,
  TAU_MAX,
  TAU_MIN,
  aerosolProducts,
  angstromTau,
  channelSet,
  mieCoefficients,
  reweightSpecies
} from './aerosol.js';
import {AER_SUBSET_B64, PINS} from './grib2-fixture.mjs';
import {parseGrib2} from './grib2.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const msgs = parseGrib2(
  Uint8Array.from(atob(AER_SUBSET_B64), (c) => c.charCodeAt(0))
);
// (47N, 8E) is grid index 40 of the 9x9 fixture - the cell the
// ecCodes v40 pins were captured at.
const prod = aerosolProducts(msgs, 47, 8);

{
  // ecCodes associates (R + X*2^E)/10^D differently - equality is
  // to 1e-12, same as the decoder gate.
  const p = (i) => PINS[i].v40;
  const eq = (a, b) => Math.abs(a - b) < 1e-12;
  const ok =
    prod &&
    prod.bands.join() === '340,440,555,645,858.5' &&
    eq(prod.tau[340], p(0)) &&
    eq(prod.tau[440], p(3)) &&
    eq(prod.tau[555], p(4)) &&
    eq(prod.tau[645], p(16)) &&
    eq(prod.tau[858.5], p(17)) &&
    eq(prod.sct555, p(5)) &&
    eq(prod.ssalb340, p(2)) &&
    eq(prod.asy340, p(1)) &&
    eq(prod.species.dust.aot, p(6)) &&
    eq(prod.species.blackCarbon.sct, p(15)) &&
    prod.forecastHours === 3;
  check(
    'fixture census',
    ok,
    `five optical bands + 555 scattering + 340 SSA/asymmetry + five species, every value the ecCodes pin for cell (47N, 8E)`
  );
}

{
  // Species physics straight off the measured column: sea salt and
  // sulphate scatter conservatively (SCT = AOT to the packing
  // quantum), black carbon is dark, and GOCART's total is the sum
  // of its species.
  const s = prod.species;
  const bcSSA = s.blackCarbon.sct / s.blackCarbon.aot;
  const sum = Object.values(s).reduce((a, x) => a + x.aot, 0);
  check(
    'species physics',
    s.seaSalt.sct === s.seaSalt.aot &&
      s.sulfate.sct === s.sulfate.aot &&
      bcSSA > 0.15 &&
      bcSSA < 0.3 &&
      Math.abs(sum - prod.tau[555]) < 1e-3,
    `sea salt and sulphate SSA = 1 exactly; black carbon SSA ${bcSSA.toFixed(3)} (strong absorber); sum of species ${sum.toFixed(6)} vs total ${prod.tau[555].toFixed(6)}`
  );
}

{
  // Angstrom exactness: tau = 0.2 (lambda/550)^-1.3 sampled at the
  // feed's five bands must reproduce the SAME law at all three
  // channel wavelengths (680 and 550 interior, 440 on a node).
  const bands = [340, 440, 555, 645, 858.5];
  const law = (nm) => 0.2 * (nm / 550) ** -1.3;
  const tau = Object.fromEntries(bands.map((nm) => [nm, law(nm)]));
  let worst = 0;
  for (const nm of CHANNEL_NM)
    worst = Math.max(worst, Math.abs(angstromTau(bands, tau, nm) - law(nm)));
  // Independent restatement on the live fixture: log-log linear is
  // tau550 = tau440^(1-f) * tau555^f with f = ln(550/440)/ln(555/440).
  const f = Math.log(550 / 440) / Math.log(555 / 440);
  const want550 = prod.tau[440] ** (1 - f) * prod.tau[555] ** f;
  const got = channelSet(prod);
  check(
    'Angstrom channels',
    worst < 1e-16 && Math.abs(got.tau[1] - want550) < 1e-12,
    `pure power law reproduced to ${worst.toExponential(1)} at 680/550/440; fixture green channel ${got.tau[1].toFixed(6)} matches the independent restatement`
  );
}

{
  // The SSA line passes through its two measured anchors, and the
  // asymmetry is the measured 340 nm value (not the old fixed 0.8).
  const set = channelSet(prod);
  const s555 = prod.sct555 / prod.tau[555];
  const slope = (s555 - prod.ssalb340) / Math.log(555 / 340);
  const at = (nm) => prod.ssalb340 + slope * Math.log(nm / 340);
  const worst = Math.max(
    Math.abs(set.ssa[0] - at(680)),
    Math.abs(set.ssa[1] - at(550)),
    Math.abs(set.ssa[2] - at(440))
  );
  const fSum = Object.values(set.fractions).reduce((a, x) => a + x, 0);
  check(
    'measured SSA and g',
    worst < 1e-15 &&
      set.g === prod.asy340 &&
      Math.abs(fSum - 1) < 0.02 &&
      set.ssa[1] > 0.89 &&
      set.ssa[1] < 0.91,
    `two-anchor line (340: ${prod.ssalb340.toFixed(4)}, 555: ${s555.toFixed(4)}) evaluated at the channels to ${worst.toExponential(1)}; g = measured ${set.g.toFixed(4)}; species fractions sum to ${fSum.toFixed(4)}`
  );
}

{
  // Profile calibration identity: the column above the terrain is
  // the measured tau EXACTLY, at sea level and at 1600 m; the
  // scattering/absorption split recovers the channel SSA.
  const set = channelSet(prod);
  let worst = 0;
  for (const h0 of [0, 1600]) {
    const {scat, abs} = mieCoefficients(set, h0);
    for (let c = 0; c < 3; c++) {
      const col = (scat[c] + abs[c]) * MIE_H * Math.exp(-h0 / MIE_H);
      worst = Math.max(
        worst,
        Math.abs(col - set.tau[c]) / set.tau[c],
        Math.abs(scat[c] / (scat[c] + abs[c]) - set.ssa[c])
      );
    }
  }
  check(
    'profile calibration',
    worst < 1e-12,
    `integral_h0^inf sigma0 exp(-h/${MIE_H}) dh returns the measured tau to ${worst.toExponential(1)} (h0 = 0 and 1600 m), split recovers SSA`
  );
}

{
  // Paper bridge: a flat column with tau = 4.44e-6 * 1200 and
  // SSA 0.9 must land on Hillaire (2020)'s exact constants.
  const bands = [340, 440, 555, 645, 858.5];
  const tauFlat = 4.44e-6 * MIE_H;
  const prodH = {
    bands,
    tau: Object.fromEntries(bands.map((nm) => [nm, tauFlat])),
    sct555: 0.9 * tauFlat,
    ssalb340: 0.9,
    asy340: 0.8,
    species: {}
  };
  const {scat, abs, g} = mieCoefficients(channelSet(prodH), 0);
  const worst = Math.max(
    ...scat.map((s) => Math.abs(s - 3.996e-6)),
    ...abs.map((a) => Math.abs(a - 4.44e-7))
  );
  check(
    'Hillaire degeneracy',
    worst < 1e-18 && g === 0.8,
    `flat tau ${tauFlat.toExponential(3)} @ SSA 0.9 -> scat 3.996e-6, abs 4.44e-7 per channel to ${worst.toExponential(1)}, g 0.8 - the measured path contains the paper`
  );
}

{
  // Clamps: a dust-storm column caps at TAU_MAX, a sterile column
  // floors at TAU_MIN, quantization pushing SCT past AOT clamps
  // SSA to 1, and a missing essential returns null.
  const bands = [340, 440, 555, 645, 858.5];
  const mk = (t, sct) => ({
    bands,
    tau: Object.fromEntries(bands.map((nm) => [nm, t])),
    sct555: sct,
    ssalb340: 1,
    asy340: 0.99,
    species: {}
  });
  const storm = channelSet(mk(8, 8));
  const clean = channelSet(mk(1e-7, 1e-7));
  const none = aerosolProducts(msgs.slice(0, 3), 47, 8);
  check(
    'clamps and absence',
    storm.tau.every((t) => t === TAU_MAX) &&
      clean.tau.every((t) => t === TAU_MIN) &&
      storm.ssa.every((s) => s === 1) &&
      storm.g === 0.95 &&
      none === null,
    `tau clamps to [${TAU_MIN}, ${TAU_MAX}], SSA to 1, g to 0.95; a census without the essentials is null`
  );
}

{
  // THE HAZE'S KIND (169th pass): the species split re-weighted to a
  // measured kind - each species' 555 nm AOT its new share of the
  // total, its scattering AOT at its own ratio, the totals, bands and
  // anchors untouched; a species the feed had no column for takes the
  // total's scattering ratio; a missing 555 band or no fractions
  // returns the input itself
  const near = (a, b, tol = 1e-12) => Math.abs(a - b) <= tol;
  const bands = [340, 440, 555, 645, 858.5];
  const prod = {
    bands,
    tau: Object.fromEntries(bands.map((nm) => [nm, 0.4])),
    sct555: 0.36,
    ssalb340: 0.9,
    asy340: 0.7,
    species: {
      dust: {aot: 0.04, sct: 0.038},
      seaSalt: {aot: 0.12, sct: 0.12},
      sulfate: {aot: 0.16, sct: 0.16},
      organic: {aot: 0.06, sct: 0.054},
      blackCarbon: {aot: 0.02, sct: 0.005}
    }
  };
  const before = channelSet(prod);
  const rw = reweightSpecies(prod, {dust: 0.6, seaSalt: 0.12, sulfate: 0.16, organic: 0.09, blackCarbon: 0.03});
  const after = channelSet(rw);
  const sumAot = Object.values(rw.species).reduce((a, s) => a + s.aot, 0);
  const noFine = reweightSpecies(
    {...prod, species: {dust: {aot: 0.2, sct: 0.19}, seaSalt: {aot: 0.2, sct: 0.2}}},
    {dust: 0.2, seaSalt: 0.2, organic: 0.6}
  );
  const same = reweightSpecies(prod, null);
  const noBand = reweightSpecies({...prod, bands: [340, 440], tau: {340: 0.5, 440: 0.45}}, {dust: 0.6});
  check(
    "THE HAZE'S KIND re-weights the species, never the column",
    near(before.fractions.dust, 0.1) &&
      near(after.fractions.dust, 0.6) &&
      near(rw.species.dust.aot, 0.24) &&
      near(rw.species.dust.sct / rw.species.dust.aot, 0.95) &&
      near(rw.species.blackCarbon.aot, 0.012) &&
      near(rw.species.blackCarbon.sct / rw.species.blackCarbon.aot, 0.25) &&
      near(sumAot, 0.4) &&
      after.tau.every((t, c) => t === before.tau[c]) &&
      after.ssa.every((s, c) => s === before.ssa[c]) &&
      after.g === before.g &&
      rw.tau === prod.tau &&
      rw.sct555 === prod.sct555 &&
      prod.species.dust.aot === 0.04 &&
      near(noFine.species.organic.aot, 0.24) &&
      near(noFine.species.organic.sct, 0.24 * 0.9) &&
      near(noFine.species.dust.aot, 0.08) &&
      same === prod &&
      noBand.species === prod.species,
    `a dust call on a 10%-dust column: dust 0.04 -> ${rw.species.dust.aot.toFixed(3)} of the 0.4 total (${(100 * after.fractions.dust).toFixed(0)}%), its scattering ratio kept at ${(rw.species.dust.sct / rw.species.dust.aot).toFixed(2)}, ` +
      `black carbon's at ${(rw.species.blackCarbon.sct / rw.species.blackCarbon.aot).toFixed(2)}, the species summing to ${sumAot.toFixed(3)}; the channel tau, SSA and g unchanged; a smoke call on a column without fine absorbers gives organic ${noFine.species.organic.aot.toFixed(2)} at the total's ratio 0.9; no fractions or no 555 band returns the input`
  );
}

process.exit(fail ? 1 : 0);
