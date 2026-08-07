// Reference gate for moonlight.js (node moonlight-reference.mjs):
// the moonlight irradiance frame, held to the printed fact-sheet
// anchors, the gated phase curve, and the shipped Hapke
// photometry's own absolute integral.
import {
  moonIrradianceE0,
  hapkeFullE0,
  hapkeDiskIntegralIF,
  relPhase,
  E_FULL_RATIO,
  MOON_FULL_VMAG,
  SUN_VMAG,
  MOON_OPPOSITION_KM,
  MOON_RADIUS_KM,
  MOON_GEOMETRIC_ALBEDO
} from './moonlight.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const near = (a, b, t) => Math.abs(a - b) < t;

{
  // The printed anchor is exact arithmetic on the two fact-sheet
  // magnitudes: 10^(-(26.74 - 12.74)/2.5) = 10^-5.6.
  const ok =
    MOON_FULL_VMAG === -12.74 &&
    SUN_VMAG === -26.74 &&
    near(E_FULL_RATIO, Math.pow(10, -5.6), 1e-21) &&
    near(E_FULL_RATIO, 2.5119e-6, 1e-10);
  check(
    'printed magnitudes -> 10^-5.6 exactly',
    ok,
    `E_full/E0 = ${E_FULL_RATIO.toExponential(5)} from V ${SUN_VMAG} / ${MOON_FULL_VMAG} at ${MOON_OPPOSITION_KM} km`
  );
}

{
  // Full moon at the printed distance IS the anchor; the quarter
  // moon rides the SAME gated phase curve the theme feeds
  // (relPhase - held to Rougier in moon-reference), and distance
  // scales inverse-square: the printed perigee/apogee pair
  // (363,300 / 405,500 km, fact-sheet mean values) brackets full
  // by (405.5/363.3)^2 = 1.246 in irradiance.
  const full = moonIrradianceE0(1, MOON_OPPOSITION_KM);
  const q = moonIrradianceE0(relPhase(90), MOON_OPPOSITION_KM);
  const peri = moonIrradianceE0(1, 363300);
  const apo = moonIrradianceE0(1, 405500);
  const ok =
    full === E_FULL_RATIO &&
    near(q / full, relPhase(90), 1e-15) &&
    q / full > 0.05 &&
    q / full < 0.12 &&
    near(peri / apo, (405500 / 363300) ** 2, 1e-12);
  check(
    'phase through the gated curve, distance inverse-square',
    ok,
    `full ${full.toExponential(4)}; quarter/full ${(q / full).toFixed(4)} (Rougier ~0.08); perigee/apogee ${(peri / apo).toFixed(4)} = ${((405500 / 363300) ** 2).toFixed(4)}`
  );
}

{
  // The umbral factor is linear and clamped - half-immersed
  // halves it, fully immersed extinguishes it (the copper glow is
  // documented scope), garbage clamps.
  const e = moonIrradianceE0(1, MOON_OPPOSITION_KM);
  const ok =
    moonIrradianceE0(1, MOON_OPPOSITION_KM, 0.5) === e * 0.5 &&
    moonIrradianceE0(1, MOON_OPPOSITION_KM, 0) === 0 &&
    moonIrradianceE0(1, MOON_OPPOSITION_KM, 7) === e &&
    moonIrradianceE0(1, MOON_OPPOSITION_KM, -3) === 0;
  check(
    'umbral immersion linear, clamped',
    ok,
    'half-immersed halves; immersed extinguishes; garbage clamps to [0,1]'
  );
}

{
  // Fails closed on any missing input: an unmeasured moon lights
  // nothing.
  const ok =
    moonIrradianceE0(NaN, 384400) === 0 &&
    moonIrradianceE0(1, NaN) === 0 &&
    moonIrradianceE0(0, 384400) === 0 &&
    moonIrradianceE0(1, 0) === 0 &&
    moonIrradianceE0(undefined, undefined) === 0;
  check('fails closed', ok, 'NaN/zero/undefined phase or distance -> 0');
}

{
  // The shipped Hapke photometry's own absolute statement: the
  // Helfenstein & Veverka parameters integrated over the disc
  // give E_full/E0 within 20% of the printed anchor, and the
  // disk-integrated I/F at opposition sits near the printed
  // geometric albedo 0.12. Coherence, not calibration - the
  // printed value anchors, the model corroborates untuned.
  const model = hapkeFullE0(800);
  const pIF = hapkeDiskIntegralIF(0.01 * (Math.PI / 180), 800);
  const ok =
    near(model / E_FULL_RATIO, 1, 0.2) &&
    near(pIF, MOON_GEOMETRIC_ALBEDO, 0.03) &&
    MOON_RADIUS_KM === 1737.4;
  check(
    'shipped Hapke corroborates the printed anchor',
    ok,
    `model E_full/E0 ${model.toExponential(4)} vs printed ${E_FULL_RATIO.toExponential(4)} (ratio ${(model / E_FULL_RATIO).toFixed(3)}); disk I/F ${pIF.toFixed(4)} vs printed p 0.12`
  );
}

process.exit(fail ? 1 : 0);
