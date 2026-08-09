// Reference printer for the pollen-corona machinery (node
// pollen-reference.mjs). The law lives in pollen.js - the
// printed Gregory/Filioglou grain properties through the SHIPPED
// certified airyPattern - and these landmarks hold it:
//  - the printed constants verbatim (birch 25 um / 0.8 g cm-3,
//    pine 75 / 0.4, Qext = 2 the paradox limit)
//  - the tau chain is exact arithmetic on measured factors, and
//    a big birch day computes to the faint-ring regime real
//    pollen coronae occupy
//  - the ring radii come out of the SHIPPED Airy law at the
//    printed diameter: first ring ~1.7 deg at 550 nm, red
//    outside blue in wavelength proportion - nothing coded
//  - zero pollen or no boundary layer = zero tau = no display
import {
  BIRCH_D_UM,
  BIRCH_RHO_G_CM3,
  buildPollenLUT,
  PINE_D_UM,
  PINE_RHO_G_CM3,
  POLLEN_MAX_DEG,
  POLLEN_QEXT,
  POLLEN_TEX_W,
  pollenRingDeg,
  pollenTau
} from './pollen.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- 1. printed constants ---------------------------------------
{
  check(
    'the printed grain properties',
    BIRCH_D_UM === 25 &&
      BIRCH_RHO_G_CM3 === 0.8 &&
      PINE_D_UM === 75 &&
      PINE_RHO_G_CM3 === 0.4 &&
      POLLEN_QEXT === 2,
    `birch 25 um / 0.8 g cm-3, pine 75 um / 0.4 (Filioglou 2023's mass ` +
      `conversion, citing Gregory 1961 - carried verbatim); Qext = 2, the ` +
      `printed extinction-paradox limit (a 25 um grain sits at x ~ 140)`
  );
}

// ---- 2. the tau chain -------------------------------------------
{
  const t = pollenTau(20000, 1500);
  const hand = 20000 * 2 * Math.PI * Math.pow(12.5e-6, 2) * 1500;
  check(
    'a big birch day computes to the faint-ring regime',
    Math.abs(t - hand) < 1e-15 && t > 0.02 && t < 0.05,
    `20,000 grains/m3 under a 1.5 km boundary layer -> tau = ` +
      `${t.toFixed(4)} (exact: N Qext pi r^2 BLH) - the faint ring real ` +
      `pollen coronae are; the display amplitude is the shipped ` +
      `coronaAmp(tau), nothing hand-scaled`
  );
  check(
    'no pollen, no display',
    pollenTau(0, 1500) === 0 &&
      pollenTau(5000, NaN) === 0 &&
      pollenTau(NaN, 1500) === 0,
    `zero concentration, or a missing boundary-layer depth, is tau 0 - ` +
      `fails to data, never to style`
  );
}

// ---- 3. the rings from the shipped law --------------------------
{
  const rG = pollenRingDeg(BIRCH_D_UM, 0.55);
  const rR = pollenRingDeg(BIRCH_D_UM, 0.68);
  const rB = pollenRingDeg(BIRCH_D_UM, 0.44);
  const ratio = rR / rB;
  check(
    'the birch corona rings where the Airy law puts them',
    rG !== null &&
      rG > 1.4 &&
      rG < 2.2 &&
      rR > rG &&
      rG > rB &&
      Math.abs(ratio / (0.68 / 0.44) - 1) < 0.05,
    `first bright ring at ${rG?.toFixed(2)} deg (550 nm) from the printed ` +
      `25 um grain - red ${rR?.toFixed(2)} outside blue ${rB?.toFixed(2)}, ` +
      `ratio ${ratio.toFixed(3)} vs lambda's ${(0.68 / 0.44).toFixed(3)} - ` +
      `the SHIPPED certified airyPattern, nothing new coded`
  );
  const lut = buildPollenLUT();
  let finite = true;
  let core = 0;
  for (let i = 0; i < lut.w; i++)
    for (let c = 0; c < 3; c++) {
      const v = lut.data[i * 4 + c];
      if (!Number.isFinite(v) || v < 0) finite = false;
      if (i === 0) core = Math.max(core, v);
    }
  check(
    'pollen LUT physical',
    lut.w === POLLEN_TEX_W &&
      lut.maxDeg === POLLEN_MAX_DEG &&
      finite &&
      core > 0,
    `${POLLEN_TEX_W} bins over 0-${POLLEN_MAX_DEG} deg from the sun, ` +
      `finite and non-negative with a bright aureole core - ready for ` +
      `coronaAmp x transmittance x exposure`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
