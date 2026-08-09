// whitecap-reference.mjs - the gate for the foam's printed optics.
// The law lives once in whitecap.js - Dierssen 2019 (open access,
// read in full) Eq. (7) + Eq. (12), with Koepke 1984's effective
// level carried verbatim in her text - and these landmarks hold it:
//  - the log base of Eq. (7) is PROVEN: base 10 reproduces her
//    printed "~40% in visible" and Frouin's printed 85% SWIR
//    reduction; a natural log goes negative - impossible
//  - the effective level 22% sits inside the printed fresh span,
//    above the printed aged span, and within "nearly equivalent"
//    reach of her own 18% thin-foam measurement
//  - the channel colours carry the printed physics: red dips
//    (the 600 nm liquid trough's side) and the visible stays
//    "nearly spectrally flat" - her sentences, both held
//  - the Kw-for-aw substitution is BOUNDED: a full factor-two
//    absorption error moves the raw polynomial under 3% absolute
//    and the drawn (re-pinned) colour under 1.5%
//  - the mixed pixel (Eq. 12) is exact at its endpoints and
//    linear between; at Monahan's W(12 m/s) on Payne's 0.06 sea
//    the mean brightening lands where the algebra says
//  - the retirement is printed: the old hand foam (0.82-0.88)
//    stood ~4x above the printed effective level
import {
  DIERSSEN_POLY,
  DIERSSEN_THIN,
  FOAM_CHANNEL_NM,
  FOAM_EFF_550,
  foamRGB,
  KOEPKE_AGED,
  KOEPKE_FRESH,
  kwAt,
  mixedPixel,
  rfOfAw
} from './whitecap.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- the log base, proven from her own printed anchors --------
{
  const visible = rfOfAw(0.01); // clearest visible-band water
  const swir = rfOfAw(500); // ~1650 nm class absorption
  const [a3, a2, a1, a0] = DIERSSEN_POLY;
  const xln = Math.log(0.01);
  const lnVisible = (a3 * xln ** 3 + a2 * xln ** 2 + a1 * xln + a0) / 100;
  check(
    'Eq. (7) is base-10 - her own anchors prove it',
    Math.abs(visible - 0.39) < 0.02 &&
      swir > 0.03 &&
      swir < 0.09 &&
      lnVisible < 0,
    `log10 gives ${(visible * 100).toFixed(1)}% at aw 0.01 (print "~40% in ` +
      `visible") and ${(swir * 100).toFixed(1)}% at aw 500 - a ` +
      `${(100 * (1 - swir / visible)).toFixed(0)}% reduction (Frouin's ` +
      `printed 85% at 1650 nm); natural log would give ` +
      `${(lnVisible * 100).toFixed(0)}% - negative reflectance, impossible`
  );
}

// ---- the effective level inside the printed spans -------------
check(
  'the 22% effective level sits where the print puts it',
  FOAM_EFF_550 >= KOEPKE_FRESH[0] &&
    FOAM_EFF_550 <= KOEPKE_FRESH[1] &&
    FOAM_EFF_550 > KOEPKE_AGED[1] &&
    Math.abs(DIERSSEN_THIN - FOAM_EFF_550) / FOAM_EFF_550 < 0.2,
  `0.22 inside Koepke's fresh [${KOEPKE_FRESH}] and above aged ` +
    `[${KOEPKE_AGED}]; Dierssen's own thin foam ${DIERSSEN_THIN} is ` +
    `within ${(
      (100 * Math.abs(DIERSSEN_THIN - FOAM_EFF_550)) /
      FOAM_EFF_550
    ).toFixed(0)}% - her "nearly equivalent"`
);

// ---- the channel colours carry the printed physics ------------
{
  const [r, g, b] = foamRGB();
  const vis = [r, g, b];
  const flat = Math.max(...vis) / Math.min(...vis);
  check(
    'foam channels: red dips, visible stays nearly flat',
    Math.abs(g - FOAM_EFF_550) < 1e-12 && r < b && r < g && flat < 1.15,
    `rgb ${vis.map((v) => v.toFixed(3)).join('/')} (550 nm pinned to ` +
      `0.22 exactly) - red below blue and green (the 600 nm liquid ` +
      `trough's side: aged foam is faintly cyan) and max/min ` +
      `${flat.toFixed(3)} ("nearly spectrally flat")`
  );
}

// ---- the Kw-for-aw substitution, bounded ----------------------
{
  // Raw polynomial response to a full factor-two absorption
  // error, per channel...
  let worst = 0;
  for (const nm of FOAM_CHANNEL_NM) {
    const kw = kwAt(nm);
    worst = Math.max(
      worst,
      Math.abs(rfOfAw(2 * kw) - rfOfAw(kw)),
      Math.abs(rfOfAw(kw / 2) - rfOfAw(kw))
    );
  }
  // ...but the DRAWN colour re-pins its level at the 550 channel,
  // so a systematic Kw-vs-aw offset (the substitution is one
  // spectrum standing for another, not per-channel noise) only
  // moves the ratios. Re-derive the colour under a global x2
  // absorption and measure what actually changes on screen.
  const base = foamRGB();
  const g2 = rfOfAw(2 * kwAt(FOAM_CHANNEL_NM[1]));
  const pert = FOAM_CHANNEL_NM.map(
    (nm) => (FOAM_EFF_550 * rfOfAw(2 * kwAt(nm))) / g2
  );
  const drawn = Math.max(...base.map((v, i) => Math.abs(pert[i] - v)));
  check(
    'the Kw-for-aw substitution is bounded where it can be seen',
    worst < 0.03 && drawn < 0.015,
    `raw Eq. (7) moves at most ${(worst * 100).toFixed(2)}% absolute ` +
      `under a factor-two absorption error; after the 550 nm level ` +
      `re-pin the DRAWN channels move at most ${(drawn * 100).toFixed(2)}% ` +
      `absolute (a twentieth of the 22% level) - the vendored Morel Kw ` +
      `standing in for Rottgers aw cannot move the foam colour visibly`
  );
}

// ---- the mixed pixel, exact -----------------------------------
{
  const rw = 0.06; // Payne's sea albedo (the repo's own print)
  const rf = FOAM_EFF_550;
  const W12 = 3.84e-6 * Math.pow(12, 3.41); // Monahan RBF at 12 m/s
  const mid = mixedPixel(rw, 0.5, rf);
  check(
    'Eq. (12) is exact and the gale-sea brightening follows',
    mixedPixel(rw, 0, rf) === rw &&
      mixedPixel(rw, 1, rf) === rf &&
      Math.abs(mid - (rw + rf) / 2) < 1e-15 &&
      Math.abs(mixedPixel(rw, W12, rf) - rw - W12 * (rf - rw)) < 1e-15,
    `endpoints exact, midpoint exact; at W(12 m/s) = ` +
      `${(W12 * 100).toFixed(2)}% the mean sea brightens by ` +
      `${(W12 * (rf - rw)).toExponential(2)} - the area-weighted ` +
      `average Gordon 1997 asks for, with the (1-A) term explicit`
  );
}

// ---- the retirement, printed ----------------------------------
{
  const hand = [0.82, 0.86, 0.88];
  const [r, g, b] = foamRGB();
  const ratio = hand[1] / g;
  check(
    'the hand foam colour retires: it stood ~4x the printed level',
    ratio > 3.5 && ratio < 4.5 && r > 0.15 && b > 0.15,
    `old vec3(${hand.join(', ')}) vs printed ` +
      `${[r, g, b].map((v) => v.toFixed(3)).join('/')} - the green ` +
      `channel ratio ${ratio.toFixed(2)}; every drawn foam texel was ` +
      `nearly four times brighter than the operational effective ` +
      `reflectance the coverage calibration assumes`
  );
}

process.exit(fail ? 1 : 0);
