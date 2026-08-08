// Reference gate for seaice.js (node seaice-reference.mjs): the
// Malinka white-ice transcription at the paper's own printed
// checks, on Warren & Brandt's published rows.
import {
  ICE_NK,
  WHITE_ICE_TAU,
  WHITE_ICE_TAU_RANGE,
  WHITE_ICE_A_M,
  tDiff,
  iceOmega0,
  iceAlbedoDiffuse,
  iceAlbedoDirect,
  ICE_CONC_RGB,
  iceConcOfRGBA,
  sampleIceConc,
  iceDisplayRGB,
  iceAlbedoMix,
  SNOW_ICE_TAU,
  SNOW_ICE_A_M
} from './seaice.js';
import {BODY_GAIN, TARGET_LUMINANCE, luminance} from './ocean-color.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // Eq. 10 against first principles: the closed form must equal
  // the numerical Fresnel diffuse-transmittance integral
  // int T(theta) 2 cos sin dtheta. The paper's printed interval
  // for 1 - T_diff (0.0611..0.0695 over n 1.300..1.334) matches
  // at the LOW end exactly; at n = 1.334 both the closed form
  // and the independent integral give 0.0666, not the printed
  // 0.0695 - a documented discrepancy in the paper's prose, not
  // in its formula.
  const fresnelT = (n, ci) => {
    const st = Math.sqrt(Math.max(0, 1 - ci * ci)) / n;
    if (st >= 1) return 0;
    const ct = Math.sqrt(1 - st * st);
    const rs = (ci - n * ct) / (ci + n * ct);
    const rp = (n * ci - ct) / (n * ci + ct);
    return 1 - 0.5 * (rs * rs + rp * rp);
  };
  const tNum = (n) => {
    const N = 20000;
    let s = 0;
    for (let i = 0; i < N; i++) {
      const ci = (i + 0.5) / N;
      s += (fresnelT(n, ci) * 2 * ci) / N;
    }
    return s;
  };
  let worst = 0;
  for (const n of [1.3, 1.31, 1.334]) {
    worst = Math.max(worst, Math.abs(tDiff(n) - tNum(n)));
  }
  const lo = 1 - tDiff(1.3);
  const hi = 1 - tDiff(1.334);
  const ok = worst < 1e-5 && Math.abs(lo - 6.11e-2) < 5e-4 && hi > lo;
  check(
    'Eq. 10 vs first-principles Fresnel',
    ok,
    `closed form = numeric integral to ${worst.toExponential(1)}; 1 - T_diff ${lo.toFixed(4)} at n 1.300 (printed 0.0611 exact), ${hi.toFixed(4)} at 1.334 (paper prints 0.0695 - its own formula gives this value)`
  );
}

{
  // Warren & Brandt rows: kappa climbs three decades from blue
  // to red (their Fig. 2's printed behaviour) while n falls.
  const ok =
    ICE_NK[2][2] === 6.268e-11 &&
    ICE_NK[1][2] === 2.289e-9 &&
    ICE_NK[0][2] === 2.09e-8 &&
    ICE_NK[2][1] > ICE_NK[1][1] &&
    ICE_NK[1][1] > ICE_NK[0][1];
  check(
    'Warren-Brandt 2008 rows',
    ok,
    `kappa 6.268e-11 / 2.289e-9 / 2.090e-8 at 440/550/680 (three decades); n monotone falling`
  );
}

{
  // The printed structure of the albedos at the printed
  // parameters: at 550 nm absorption is negligible and the full
  // r_d sits on Eq. 30's tau/(tau+4); the spectrum orders blue >
  // green > red (white ice is faintly blue); the whole triple
  // lands in the paper's own "about 0.7-0.8" blue-green band for
  // white ice across the printed tau range.
  const rd = [0, 1, 2].map((c) => iceAlbedoDiffuse(c));
  const limit = WHITE_ICE_TAU / (WHITE_ICE_TAU + 4);
  const lo = WHITE_ICE_TAU_RANGE[0] / (WHITE_ICE_TAU_RANGE[0] + 4);
  const hi = WHITE_ICE_TAU_RANGE[1] / (WHITE_ICE_TAU_RANGE[1] + 4);
  const ok =
    Math.abs(rd[1] - limit) / limit < 0.01 &&
    rd[2] > rd[1] &&
    rd[1] > rd[0] &&
    lo > 0.63 &&
    hi < 0.8 &&
    rd[1] > lo &&
    rd[1] < hi;
  check(
    'white-ice albedo structure',
    ok,
    `r_d RGB (${rd.map((v) => v.toFixed(3)).join(', ')}); 550 nm vs tau/(tau+4) = ${limit.toFixed(3)} to ${((Math.abs(rd[1] - limit) / limit) * 100).toFixed(2)}%; printed tau range spans ${lo.toFixed(2)}..${hi.toFixed(2)}`
  );
}

{
  // The printed 48-degree crossing, exact: the paper says direct
  // and diffuse albedos are equal at theta0 = arccos(2/3) - and
  // G(arccos(2/3)) = 1 makes that an identity of the
  // transcription. Grazing sun brightens, high sun darkens,
  // relative to diffuse (their Sec. 4.2 reasoning).
  const cx = 2 / 3;
  const rEq = iceAlbedoDirect(1, cx);
  const rd = iceAlbedoDiffuse(1);
  const ok =
    Math.abs(rEq - rd) < 1e-15 &&
    iceAlbedoDirect(1, 0.05) > rd &&
    iceAlbedoDirect(1, 1) < rd;
  check(
    'printed 48-degree crossing',
    ok,
    `r(acos 2/3) - r_d = ${(rEq - rd).toExponential(1)} (exact); grazing ${iceAlbedoDirect(1, 0.05).toFixed(3)} > r_d ${rd.toFixed(3)} > normal ${iceAlbedoDirect(1, 1).toFixed(3)}`
  );
}

{
  // The published concentration colormap: 100 one-percent bins
  // in order, unique colours, exact round-trip to bin centres;
  // nodata and unlisted colours are unknown.
  let okAll = ICE_CONC_RGB.length === 100;
  for (let i = 0; i < ICE_CONC_RGB.length; i++) {
    const [r, g, b, k] = ICE_CONC_RGB[i];
    if (k !== i) okAll = false;
    if (Math.abs(iceConcOfRGBA(r, g, b, 255) - (i + 0.5) / 100) > 1e-12)
      okAll = false;
  }
  const unknowns =
    iceConcOfRGBA(0, 0, 0, 0) === -1 && iceConcOfRGBA(9, 9, 9, 255) === -1;
  check(
    'published concentration colormap',
    okAll && unknowns,
    `100 bins [k, k+1)%, unique, round-trip exact; nodata/unlisted -> unknown`
  );
}

{
  // The sampler and the display frame: all-unknown returns -1
  // (feature off over land); a half-ice block means correctly;
  // the drawn ice colour is r_d x BODY_GAIN - the water body's
  // own frame - and sits an order of magnitude above the tuned
  // dark-sea luminance, as a 0.7-albedo surface must.
  const off = sampleIceConc(() => null, 0, 0, 2);
  const half = sampleIceConc(
    (ix) => (ix < 0 ? [17, 17, 17, 255] : [255, 230, 230, 255]),
    0,
    0,
    2
  );
  const ice = iceDisplayRGB();
  const ratio = luminance(ice) / TARGET_LUMINANCE;
  const ok =
    off === -1 &&
    Math.abs(half - (0.005 * 10 + 0.995 * 15) / 25) < 1e-12 &&
    Math.abs(ice[1] - iceAlbedoDiffuse(1) * BODY_GAIN) < 1e-15 &&
    ratio > 10;
  check(
    'sampler and display frame',
    ok,
    `all-unknown -> -1; half-plume mean ${half.toFixed(3)}; ice luminance x${ratio.toFixed(0)} the tuned dark sea (r_d ~0.71 vs the body reflectance, one shared BODY_GAIN)`
  );
}

{
  // Snow-covered ice at Table 2's printed rows (tau 27..73,
  // grains 170..270 um, log-mids): the triple lands in the
  // paper's measured snow-covered band (~0.85-0.95 visible,
  // their Fig. 11) and above bare white ice; the area-weighted
  // mix is exact at its ends and monotone in the measured snow
  // fraction.
  const snow = [0, 1, 2].map((c) =>
    iceAlbedoDiffuse(c, SNOW_ICE_TAU, SNOW_ICE_A_M)
  );
  const bare = iceDisplayRGB(0);
  const full = iceDisplayRGB(1);
  const halfMix = iceDisplayRGB(0.5);
  let ok = true;
  for (let c = 0; c < 3; c++) {
    if (!(snow[c] > 0.85 && snow[c] < 0.95)) ok = false;
    if (!(snow[c] > iceAlbedoDiffuse(c))) ok = false;
    if (Math.abs(full[c] - snow[c] * BODY_GAIN) > 1e-15) ok = false;
    if (Math.abs(bare[c] - iceAlbedoDiffuse(c) * BODY_GAIN) > 1e-15) ok = false;
    if (!(halfMix[c] > bare[c] && halfMix[c] < full[c])) ok = false;
    if (Math.abs(iceAlbedoMix(c, 0.5) * BODY_GAIN - halfMix[c]) > 1e-15)
      ok = false;
  }
  check(
    'snow-covered ice (Table 2 rows)',
    ok,
    `r_d snow (${snow.map((v) => v.toFixed(3)).join(', ')}) in the 0.85-0.95 measured band, above bare; area mix exact at ends, monotone`
  );
}

process.exit(fail ? 1 : 0);
