// Reference printer for atmospheric refraction (node
// refraction-reference.mjs). The low sun's displacement,
// flattening and dispersion are ray-traced, so the gate holds the
// tracer to independent anchors:
//  - Ciddor refractivity to the NIST check value and to the
//    INDEPENDENT Birch & Downs revised Edlen equation
//  - the integral to its closed forms: exactly 0 at the zenith,
//    (n0-1)tan(z) at 45 deg, Bennett's empirical fit at 10 deg,
//    the classical band at the horizon
//  - dispersion: the green image sits higher than red, blue
//    higher than green, in proportion to the refractivity spread
//  - the setting sun's published flattening (~5/6) and the exact
//    apparent/true fixed-point roundtrip
import {
  ARCSEC,
  DEG,
  apparentAltitude,
  ciddorN,
  refractionRad,
  standardProfile,
  sunRefraction
} from './refraction.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // Ciddor 1996 vs NIST (633 nm, 20 C, 101325 Pa, dry, 450 ppm:
  // n-1 = 2.71800e-4) and vs Birch & Downs (1994) at standard
  // 15 C - two independent formulations agreeing to 1e-9.
  const nist = ciddorN(0.633, 20, 101325, 0) - 1;
  const c15 = ciddorN(0.633, 15, 101325, 0);
  const s2 = 1 / (0.633 * 0.633);
  const bd = 1 + (8342.54 + 2406147 / (130 - s2) + 15998 / (38.9 - s2)) * 1e-8;
  const disp =
    ciddorN(0.44, 15, 101325, 0) > ciddorN(0.55, 15, 101325, 0) &&
    ciddorN(0.55, 15, 101325, 0) > ciddorN(0.68, 15, 101325, 0);
  const moist = ciddorN(0.55, 20, 101325, 1) < ciddorN(0.55, 20, 101325, 0);
  check(
    'Ciddor refractivity',
    Math.abs(nist - 2.718e-4) < 5e-9 &&
      Math.abs(c15 - bd) < 5e-9 &&
      disp &&
      moist,
    `633 nm 20 C: ${(nist * 1e4).toFixed(5)}e-4 (NIST 2.71800e-4); vs Birch-Downs ${Math.abs(c15 - bd).toExponential(1)}; blue > green > red; moist air less refractive`
  );
}

{
  // The ray tracer against its closed forms on the ICAO standard
  // atmosphere: zero at the zenith exactly; (n0-1)tan(z) at 45 deg
  // (the flat-atmosphere identity, sphericity is second order
  // there); Bennett's fit at 10 deg (5.28'); the classical band
  // at the horizon.
  const prof = standardProfile();
  const zenith = refractionRad(90 * DEG, prof, 0.55);
  const r45 = refractionRad(45 * DEG, prof, 0.55) / ARCSEC;
  const closed = (ciddorN(0.55, 15, 101325, 0) - 1) / ARCSEC;
  const r10 = refractionRad(10 * DEG, prof, 0.55) / ARCSEC / 60;
  const bennett = 1 / Math.tan((10 + 7.31 / (10 + 4.4)) * DEG); // arcmin
  const rh = (refractionRad(0, prof, 0.55) / DEG) * 60;
  check(
    'ray tracer closed forms',
    zenith === 0 &&
      Math.abs(r45 - closed) < 0.5 &&
      Math.abs(r10 - bennett) / bennett < 0.05 &&
      rh > 32 &&
      rh < 35.5,
    `zenith exactly 0; R(45°) ${r45.toFixed(2)}" vs (n0-1)tan z ${closed.toFixed(2)}"; R(10°) ${r10.toFixed(2)}' vs Bennett ${bennett.toFixed(2)}'; horizon ${rh.toFixed(2)}' (classical ~33-35' at 15 C)`
  );
}

{
  // Dispersion: the green image rides above red, blue above
  // green, and the split tracks the refractivity spread (the
  // geometry is shared, so dR/R follows dn/(n-1)).
  const prof = standardProfile();
  const rG = refractionRad(0, prof, 0.55);
  const rR = refractionRad(0, prof, 0.68);
  const rB = refractionRad(0, prof, 0.44);
  const gr = (rG - rR) / ARCSEC;
  const bg = (rB - rG) / ARCSEC;
  const nG = ciddorN(0.55, 15, 101325, 0) - 1;
  const nR = ciddorN(0.68, 15, 101325, 0) - 1;
  const ratio = (rG - rR) / rG / ((nG - nR) / nG);
  check(
    'green rim dispersion',
    gr > 10 && gr < 20 && bg > gr && Math.abs(ratio - 1) < 0.15,
    `green sits ${gr.toFixed(1)}" above red at the horizon (blue ${bg.toFixed(1)}" above green); dR/R tracks dn/(n-1) to ${((ratio - 1) * 100).toFixed(1)}%`
  );
}

{
  // The drawn sun: fixed-point apparent altitude roundtrips at
  // fp; the setting sun's vertical flattening lands in the
  // published ~5/6 band; the rim widens as the sun drops (the
  // flash's approach); an elevated observer's below-horizontal
  // ray (tangent-point path) still returns finite, larger
  // refraction.
  const prof = standardProfile();
  const rt = apparentAltitude(10 * DEG, prof, 0.55);
  const err = Math.abs(rt - refractionRad(rt, prof, 0.55) - 10 * DEG);
  const setting = sunRefraction(-0.5 * DEG, prof, 50);
  const high = sunRefraction(2 * DEG, prof, 50);
  const rimSet = (setting.appG - setting.appR) / ARCSEC;
  const rimHigh = (high.appG - high.appR) / ARCSEC;
  const below = refractionRad(-0.2 * DEG, prof, 0.55, 300);
  const at0 = refractionRad(0, prof, 0.55, 300);
  check(
    'the drawn sun',
    err < 1e-9 &&
      setting.flatten > 0.75 &&
      setting.flatten < 0.9 &&
      high.flatten > setting.flatten &&
      rimSet > rimHigh &&
      rimSet > 8 &&
      Number.isFinite(below) &&
      below > at0,
    `apparent/true roundtrip ${err.toExponential(1)} rad; setting sun flattened to ${setting.flatten.toFixed(3)} (published ~5/6), rim ${rimSet.toFixed(1)}" vs ${rimHigh.toFixed(1)}" at +2°; below-horizontal ray (300 m observer) finite and larger (${((below / DEG) * 60).toFixed(1)}')`
  );
}

process.exit(fail ? 1 : 0);
