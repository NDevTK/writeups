// Reference printer for the nightglow line model (node
// airglow-reference.mjs). The model lives once in airglow.js;
// landmarks, all against PALACE v1.0 (Noll et al. 2025) and the
// published geometry:
//  - van Rhijn: exactly 1 at zenith; 5.8x on the horizon for the
//    97 km green line and weaker (3.7x) for the 250 km red layer -
//    HIGHER layers brighten LESS toward the horizon
//  - Rozenberg airmass: 1 at zenith, exactly 40 on the horizon
//    (the published horizontal value)
//  - PALACE Eq. 1 cross-check: scaling the 163 R green reference
//    from 100 to 129 sfu lands within 10% of the ESO Sky Model's
//    190 R at its 129 sfu reference (PALACE Sect. 4.5 quotes both)
//  - absolute photometry: 163 R of 557.7 nm is ~3e-5 cd m^-2, a
//    5-50% fraction of the canonical 21.9 mag/arcsec^2 moonless
//    dark sky (airglow really is a chief component of it)
//  - the red doublet's solar swing is the strongest and Na D's the
//    weakest of the three (ionospheric vs metal-layer chemistry)
import {
  AGLOW_GAIN,
  cieY,
  LINES,
  lineLuminance,
  lineStrengths,
  palaceSolar,
  rozenbergX,
  vanRhijn
} from './airglow.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  const v0 = vanRhijn(1, 97);
  const vG = vanRhijn(0, 97);
  const vR = vanRhijn(0, 250);
  const vNa = vanRhijn(0, 92);
  check(
    'van Rhijn',
    Math.abs(v0 - 1) < 1e-12 &&
      Math.abs(vG - 5.79) < 0.05 &&
      vR < vG &&
      Math.abs(vR - 3.67) < 0.05 &&
      vNa > vG,
    `zenith 1 exact; horizon 97 km ${vG.toFixed(2)}x, 250 km ${vR.toFixed(2)}x, 92 km ${vNa.toFixed(2)}x`
  );
}

{
  const x0 = rozenbergX(1);
  const x90 = rozenbergX(0);
  check(
    'Rozenberg airmass',
    Math.abs(x0 - 1) < 1e-4 && Math.abs(x90 - 40) < 1e-12,
    `zenith ${x0.toFixed(5)}, horizon ${x90.toFixed(1)} (published 40)`
  );
}

{
  // PALACE Sect. 4.5: 163 R at 100 sfu; the ESO Sky Model reference
  // is 190 R at 129 sfu. Eq. 1 must connect the two models.
  const at129 = 163 * palaceSolar(0.754, 129);
  check(
    'Eq.1 vs ESO Sky Model',
    Math.abs(at129 / 190 - 1) < 0.1,
    `163 R @100 sfu -> ${at129.toFixed(1)} R @129 sfu vs ESO 190 R (${((at129 / 190 - 1) * 100).toFixed(1)}%)`
  );
  const s = lineStrengths(100);
  check(
    'reference strengths',
    Math.abs(s[0] - 1) < 1e-12 && s[1] < 0.35 && s[2] < 0.25,
    `green 1 exact, red ${s[1].toFixed(3)}, NaD ${s[2].toFixed(3)} (luminance-weighted - the airglow LOOKS green)`
  );
}

{
  // Absolute photometry: CIE photopic V(557.7) ~ 0.98, V(589.3)
  // ~ 0.77, V(630) ~ 0.27. The moonless dark-sky canon is 21.9
  // mag/arcsec^2 ~ 1.7e-4 cd/m^2 (mag/arcsec^2 =
  // 12.576 - 2.5 log10 L).
  // The Wyman-fit Y must land on the CIE table values first.
  check(
    'CIE Y fit',
    Math.abs(cieY(557.7) - 0.98) < 0.03 &&
      Math.abs(cieY(589.3) - 0.77) < 0.03 &&
      Math.abs(cieY(631.6) - 0.26) < 0.03,
    `Y(557.7) = ${cieY(557.7).toFixed(3)}, Y(589.3) = ${cieY(589.3).toFixed(3)}, Y(631.6) = ${cieY(631.6).toFixed(3)}`
  );
  const Lg = lineLuminance(163, 557.7, cieY(557.7));
  const dark = Math.pow(10, (12.576 - 21.9) / 2.5);
  const frac = Lg / dark;
  check(
    'absolute photometry',
    Lg > 1e-5 && Lg < 1e-4 && frac > 0.05 && frac < 0.5,
    `green line ${Lg.toExponential(2)} cd/m^2 = ${(frac * 100).toFixed(0)}% of the 21.9 mag/arcsec^2 dark sky`
  );
}

{
  // Solar-cycle ordering (PALACE Table 4): ionospheric red >> green
  // >> Na D; and the Eq. 1 clamp keeps intensities non-negative at
  // any srf.
  const swing = (m) => palaceSolar(m, 200) / palaceSolar(m, 70);
  const ok =
    swing(1.432) > swing(0.754) &&
    swing(0.754) > swing(0.235) &&
    palaceSolar(1.432, 0) >= 0;
  check(
    'solar-cycle ordering',
    ok,
    `70->200 sfu swings: red ${swing(1.432).toFixed(1)}x, green ${swing(0.754).toFixed(1)}x, NaD ${swing(0.235).toFixed(1)}x`
  );
  check(
    'display gain',
    AGLOW_GAIN > 0 && AGLOW_GAIN < 1,
    `single documented exposure ${AGLOW_GAIN} on the exact relative structure`
  );
}

{
  // The ring earns its dark sky: the structure's total printed
  // luminance (three PALACE lines through the rayleigh chain)
  // re-derived by independent arithmetic, then through the
  // shipped Crumey threshold at the theme's sky classes. What
  // must emerge: fully visible at the pristine natural sky,
  // extinguished under full moonlight and city glow (the ring is
  // a dark-site phenomenon), marginal from a suburban 3x-natural
  // sky at solar minimum-to-mean - and at solar MAXIMUM the
  // strengthened lines push it back over the threshold there
  // (the IGY-era lore that airglow structure was prominent at
  // solar max), monotone in solar flux throughout.
  const {airglowStructureCd, AGLOW_SR} = await import('./airglow.js');
  const {extendedVisibility} = await import('./adaptation.js');
  const {NATURAL_MCD} = await import('./skyglow.js');
  const H = 6.62607015e-34;
  const C = 2.99792458e8;
  const lum = (R, lam, Y) =>
    683 * Y * ((R * 1e10) / (4 * Math.PI)) * ((H * C) / (lam * 1e-9));
  const indep =
    lum(163, 557.7, cieY(557.7)) +
    lum(164, 631.6, cieY(631.6)) +
    lum(36.5, 589.3, cieY(589.3));
  const total = airglowStructureCd(100);
  const dark = NATURAL_MCD * 1e-3;
  const vis = (srf, B) =>
    extendedVisibility(airglowStructureCd(srf), B, AGLOW_SR);
  const vDark = vis(100, dark);
  const vMoon = vis(100, 5e-3);
  const vSuburb = vis(100, 3 * dark);
  const vCity = vis(100, 10 * dark);
  const vSuburbMax = vis(200, 3 * dark);
  let mono = true;
  let prev = -1;
  for (let srf = 70; srf <= 250; srf += 10) {
    const v = vis(srf, 3 * dark);
    if (v < prev - 1e-12) mono = false;
    prev = v;
  }
  const ok =
    Math.abs(total / indep - 1) < 1e-12 &&
    total > 4.2e-5 &&
    total < 4.5e-5 &&
    vDark === 1 &&
    vMoon === 0 &&
    vSuburb > 0.2 &&
    vSuburb < 0.7 &&
    vCity === 0 &&
    vSuburbMax > 0.9 &&
    mono;
  check(
    'the ring earns its dark sky (Crumey gate)',
    ok,
    `structure ${total.toExponential(3)} cd/m^2 at 100 sfu (independent arithmetic exact); ` +
      `vis: pristine ${vDark}, full moon ${vMoon}, suburban 3x ${vSuburb.toFixed(2)} (marginal), city 10x ${vCity}; ` +
      `solar max at the suburb ${vSuburbMax.toFixed(2)} - the IGY lore emerges; monotone in flux`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
