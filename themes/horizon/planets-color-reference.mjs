// Reference gate for planets-color.js (node
// planets-color-reference.mjs): Mallama's printed tables at
// their own worked example, the shipped Ballesteros/Planck
// chain corroborating the printed solar colour, the printed
// phase machinery reproducing the classic sky, and the drawn
// tints carrying the printed albedo orderings.
import {
  SOLAR_MAG,
  SUN_BV,
  T_SUN,
  PLANET_ALBEDO,
  PLANET_VREF,
  SATURN_RADIUS_KM,
  KM_PER_AU,
  VENUS_PHASE_V,
  JUPITER_PHASE_V,
  phasePoly,
  planetTintRGB
} from './planets-color.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // The printed solar colour meets the shipped stellar chain:
  // Table 6's B - V = 0.65 through the repo's own Ballesteros
  // relation gives the Sun's effective temperature within ten
  // kelvin - the star frame and the planet photometry agree
  // before anything is drawn.
  const ok =
    Math.abs(SUN_BV - 0.65) < 1e-9 &&
    Math.abs(T_SUN - 5772) < 10 &&
    SOLAR_MAG.V === -26.75 &&
    SOLAR_MAG.B === -26.1 &&
    SOLAR_MAG.R === -27.29;
  check(
    'printed solar colour through the shipped chain',
    ok,
    `Table 6 verbatim; B-V = ${SUN_BV.toFixed(2)} -> Ballesteros T = ${T_SUN.toFixed(0)} K vs the Sun's 5772`
  );
}

{
  // The paper's own worked example re-emerges from the vendored
  // tables EXACTLY (their Eqs. 3-4): Saturn's luminosity ratio
  // 10^((-26.75 + 8.91)/2.5) = 7.31e-8, the area factor
  // sin^2(r/AU) = 1.46e-7 from the printed 57,240 km radius,
  // and the geometric albedo 0.499 - matching Table 7's V
  // column for Saturn.
  const Lr = Math.pow(10, (SOLAR_MAG.V - PLANET_VREF.Saturn) / 2.5);
  const area = Math.pow(Math.sin(SATURN_RADIUS_KM / KM_PER_AU), 2);
  const p = Lr / area;
  const ok =
    Math.abs(Lr / 7.31e-8 - 1) < 0.005 &&
    Math.abs(area / 1.46e-7 - 1) < 0.005 &&
    Math.abs(p - 0.499) < 0.003 &&
    Math.abs(p - PLANET_ALBEDO.Saturn[2]) < 0.002;
  check(
    'printed worked example exact',
    ok,
    `Lratio ${Lr.toExponential(3)} (printed 7.31e-8), area ${area.toExponential(3)} (printed 1.46e-7), p = ${p.toFixed(4)} (printed 0.499 = Table 7 Saturn V ${PLANET_ALBEDO.Saturn[2]})`
  );
}

{
  // The printed phase machinery reproduces the classic sky:
  // Venus's polynomial at zero phase IS Table 3's reference
  // (-4.384 -> printed -4.38); with nothing but circular-orbit
  // geometry its printed coefficients put the greatest
  // brilliancy at -4.8 near phase 124 degrees - the almanac
  // value emerges, nothing was fit; Jupiter's printed quadratic
  // dims ~6-8% at its maximum 12-degree phase (the paper's own
  // cross-check against the Pioneer-based curves reads "about
  // 6%"); and the V references at mean-opposition geometry give
  // Jupiter -2.7 and Uranus +5.6 - the sixth planet sits a
  // magnitude inside the theme's own 6.5 naked-eye catalogue
  // limit, which is why it is now drawn.
  const v0 = phasePoly(VENUS_PHASE_V, 0);
  let best = {m: 99, a: 0};
  const rV = 0.7233;
  for (let a = 1; a <= 165; a += 0.25) {
    const ar = (a * Math.PI) / 180;
    const disc = Math.pow(2 * rV * Math.cos(ar), 2) - 4 * (rV * rV - 1);
    const d = (2 * rV * Math.cos(ar) + Math.sqrt(disc)) / 2;
    const m = phasePoly(VENUS_PHASE_V, a) + 5 * Math.log10(rV * d);
    if (m < best.m) best = {m, a};
  }
  const dim = phasePoly(JUPITER_PHASE_V, 12) - phasePoly(JUPITER_PHASE_V, 0);
  const dimPct = (1 - Math.pow(10, -0.4 * dim)) * 100;
  const jupOpp = PLANET_VREF.Jupiter + 5 * Math.log10(5.204 * 4.204);
  const uraOpp = PLANET_VREF.Uranus + 5 * Math.log10(19.19 * 18.19);
  const ok =
    Math.abs(v0 - -4.384) < 1e-9 &&
    Math.abs(v0 - PLANET_VREF.Venus) < 0.005 &&
    best.m > -5.0 &&
    best.m < -4.6 &&
    best.a > 100 &&
    best.a < 140 &&
    dimPct > 4 &&
    dimPct < 10 &&
    jupOpp > -3.0 &&
    jupOpp < -2.5 &&
    uraOpp > 5.3 &&
    uraOpp < 5.9 &&
    uraOpp < 6.5;
  check(
    'printed phase machinery, classic sky',
    ok,
    `Venus poly(0) = ${v0} = Table 3; greatest brilliancy ${best.m.toFixed(2)} at ${best.a.toFixed(0)} deg (classic -4.8 near 124); Jupiter 12-deg dimming ${dimPct.toFixed(1)}% (printed ~6%); opposition V: Jupiter ${jupOpp.toFixed(2)}, Uranus ${uraOpp.toFixed(2)} < 6.5 naked-eye`
  );
}

{
  // The drawn tints carry the printed albedo record: Mars is the
  // red extreme (its printed B->R albedo TRIPLES: 0.088 ->
  // 0.288); Uranus and Neptune are blue-green - their printed
  // albedo collapses toward R (0.561 -> 0.202, 0.562 -> 0.181;
  // "distinctly blue color" printed) so their red channel is the
  // LOWEST, which no Planck fit of a colour index could produce;
  // Venus is the most nearly neutral; Jupiter and Saturn are
  // warm creams in between; every tint is a max-1 carrier.
  const t = Object.fromEntries(
    ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'].map(
      (n) => [n, planetTintRGB(n)]
    )
  );
  const carrier = Object.values(t).every(
    (c) => Math.abs(Math.max(...c) - 1) < 1e-12 && Math.min(...c) > 0
  );
  const marsRed = t.Mars[0] === 1 && t.Mars[2] < 0.3 && t.Mars[1] < 0.6;
  const iceBlue =
    t.Uranus[2] === 1 &&
    t.Uranus[0] < 0.5 &&
    t.Neptune[2] === 1 &&
    t.Neptune[0] < t.Uranus[0] &&
    t.Uranus[1] > t.Uranus[0] &&
    t.Neptune[1] > t.Neptune[0];
  const spread = (c) => Math.max(...c) / Math.min(...c);
  const venusNeutral = spread(t.Venus) < 1.35;
  const mostNeutral = Object.entries(t).every(
    ([n, c]) => n === 'Venus' || spread(c) >= spread(t.Venus)
  );
  const warmGiants =
    t.Jupiter[0] === 1 &&
    t.Jupiter[1] > t.Jupiter[2] &&
    t.Saturn[0] === 1 &&
    t.Saturn[1] > t.Saturn[2] &&
    t.Saturn[2] < t.Jupiter[2];
  const ok =
    carrier && marsRed && iceBlue && venusNeutral && mostNeutral && warmGiants;
  check(
    'printed albedos become the drawn tints',
    ok,
    `Mars (${t.Mars.map((v) => v.toFixed(2)).join('/')}) red extreme; Uranus (${t.Uranus.map((v) => v.toFixed(2)).join('/')}) and Neptune (${t.Neptune.map((v) => v.toFixed(2)).join('/')}) blue-green with red lowest (printed methane collapse); Venus spread ${spread(t.Venus).toFixed(2)} most neutral; Saturn warmer than Jupiter; all max-1 carriers`
  );
}

{
  // Table 7 structural verbatim checks: the vendored grid holds
  // the printed values at spot rows (Mercury V 0.142, Venus R
  // 0.708, Uranus R 0.202, Neptune I 0.067), every albedo is a
  // physical fraction, and the V column agrees with Table 3 +
  // Table 6 through the paper's own Eq. 3-4 route for the one
  // planet whose radius the paper prints.
  const a = PLANET_ALBEDO;
  const ok =
    a.Mercury[2] === 0.142 &&
    a.Venus[3] === 0.708 &&
    a.Uranus[3] === 0.202 &&
    a.Neptune[4] === 0.067 &&
    a.Earth[2] === 0.434 &&
    Object.values(a).every((row) => row.every((v) => v > 0 && v < 1)) &&
    Object.keys(a).length === 8;
  check(
    'Table 7 verbatim structure',
    ok,
    `8 planets x 7 bands, spot rows verbatim (Mercury V ${a.Mercury[2]}, Venus R ${a.Venus[3]}, Uranus R ${a.Uranus[3]}, Neptune I ${a.Neptune[4]}), all physical fractions`
  );
}

process.exit(fail ? 1 : 0);
