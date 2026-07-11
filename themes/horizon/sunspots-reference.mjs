// Reference printer for the sunspot integration (node
// sunspots-reference.mjs). Every pin below is a READ source or a
// TESTED feed property (WEBGPU-PLAN research log, Jul 11):
//  - Meeus's worked example 29.a EMERGES (P +26.27, B0 +5.99,
//    L0 238.63 for 1992 Oct 13.0)
//  - the TESTED feed semantics reproduce: real frozen rows of
//    region 4481 (carrington_longitude from the live feed) run
//    through cmdFromCarrington + L0(t) land on the SRS text
//    product's own W33 at 10/2400Z, and the same spot marches
//    WEST at the synodic rate across days
//  - Mathew et al. 2007 Table 2 arithmetic is reproduced exactly
//    at sample radii, including their two-regime split
//  - the Maltby-anchored transfer: at zero size-shift the model
//    returns Table 3's measured mid-cycle ratios AT their own
//    wavelengths exactly; contrast is deeper in blue at every size
//  - Jha 2018 area share: r_umbra/r_spot = 1/sqrt(6.5)
//  - parallactic angle antisymmetry (Meeus ch. 14)
import {
  brightnessT,
  buildSpots,
  cmdFromCarrington,
  discToAltAz,
  MALTBY_MID,
  maltbyTb,
  mathewPenumbralMean,
  mathewUmbralMean,
  parallacticAngle,
  planckRatio,
  PU_AREA_RATIO,
  solarDiscGeometry,
  spotOnDisc,
  spotPhotometry,
  SUN_RADIUS_ARCSEC,
  T_PHOTOSPHERE
} from './sunspots.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // Meeus example 29.a: 1992 October 13.0 TD (JDE 2448908.5).
  const g = solarDiscGeometry(2448908.5);
  check(
    'Meeus 29.a emerges',
    Math.abs(g.P - 26.27) < 0.02 &&
      Math.abs(g.B0 - 5.99) < 0.02 &&
      Math.abs(g.L0 - 238.63) < 0.05,
    `1992 Oct 13.0: P = ${g.P.toFixed(2)} (26.27), B0 = ${g.B0.toFixed(2)} (5.99), L0 = ${g.L0.toFixed(2)} (238.63) - the published example from the published algorithm`
  );
}

{
  // The TESTED feed semantics, frozen from the live pull of
  // 2026-07-11 (research log): region 4481's real rows. The SRS
  // text product (same agency, independent pipeline) put it at
  // W33 valid 2026-07-10 2400Z with Carrington longitude 331.
  // cmdFromCarrington at L0(that instant) must land there, and
  // the JSON's own east-positive 'longitude' matched at -33.
  const jd10 = 2440587.5 + Date.UTC(2026, 6, 11, 0, 0) / 86400000;
  const g10 = solarDiscGeometry(jd10);
  const cmd10 = cmdFromCarrington(331, g10.L0);
  // ...and a day later the JSON's extrapolated row said W47 with
  // Carrington 332 - the same check one synodic day on.
  const jd11 = jd10 + 1;
  const cmd11 = cmdFromCarrington(332, solarDiscGeometry(jd11).L0);
  check(
    'tested feed semantics reproduce',
    Math.abs(cmd10 - -33) < 1.5 && Math.abs(cmd11 - -47) < 1.5,
    `region 4481: Carrington 331 at 2026-07-10 2400Z -> CMD ${cmd10.toFixed(1)} (SRS: W33), Carrington 332 a day later -> ${cmd11.toFixed(1)} (feed: W47) - placement from carrington_longitude + L0(t) reproduces BOTH products`
  );
}

{
  // Mapping invariants + the westward drift from the real L0
  // dynamics (carr - L0 is west-positive; the API is east-positive).
  const c = spotOnDisc(5.99, 0, 5.99);
  const limb = spotOnDisc(0, 90, 0);
  const jd0 = 2460500.5;
  const g0 = solarDiscGeometry(jd0);
  const g3 = solarDiscGeometry(jd0 + 3);
  const carr = g0.L0 - 20;
  const x0 = spotOnDisc(15, cmdFromCarrington(carr, g0.L0), g0.B0).x;
  const x3 = spotOnDisc(15, cmdFromCarrington(carr, g3.L0), g3.B0).x;
  const rate =
    (cmdFromCarrington(carr, g0.L0) - cmdFromCarrington(carr, g3.L0)) / 3;
  check(
    'disc mapping + westward drift',
    Math.abs(c.x) < 1e-12 &&
      Math.abs(c.y) < 1e-12 &&
      Math.abs(c.z - 1) < 1e-12 &&
      Math.abs(Math.hypot(limb.x, limb.y) - 1) < 1e-12 &&
      rate > 13 &&
      rate < 13.5 &&
      x3 > x0,
    `sub-observer point -> disc centre, CMD 90 -> the limb exactly; a fixed Carrington spot loses ${rate.toFixed(2)} deg/day of east CMD (synodic ~13.2) and its x marches toward the WEST limb (${x0.toFixed(3)} -> ${x3.toFixed(3)})`
  );
}

{
  // Mathew Table 2 arithmetic, both regimes (676.8 nm, r arcsec).
  const u5 = mathewUmbralMean(5);
  const u12 = mathewUmbralMean(12);
  const p20 = mathewPenumbralMean(20);
  check(
    'Mathew 2007 Table 2',
    Math.abs(u5 - (0.6536 - 0.0266 * 5)) < 1e-15 &&
      Math.abs(u12 - (0.4858 - 0.0087 * 12)) < 1e-15 &&
      Math.abs(p20 - (0.8561 - 0.0016 * 20)) < 1e-15 &&
      u12 < u5,
    `mean umbral I(5") = ${u5.toFixed(4)} (small regime), I(12") = ${u12.toFixed(4)} (large regime), penumbral I(20") = ${p20.toFixed(4)} - the fits verbatim, larger umbrae darker (x6 core span is their headline result)`
  );
}

{
  // Maltby anchoring: brightnessT/planckRatio invert exactly at
  // the measured nodes, so a zero size-shift returns Table 3's
  // mid-cycle values AT their own wavelengths.
  let worst = 0;
  for (const [nm, ratio] of MALTBY_MID)
    worst = Math.max(
      worst,
      Math.abs(planckRatio(nm, maltbyTb(nm), T_PHOTOSPHERE) - ratio)
    );
  // The T_b curve the nodes imply (the physical content: ~3300 K
  // at 387 nm rising through ~3550 K at 579 nm for large cores).
  const t579 = brightnessT(579, 0.066);
  check(
    'Maltby 1986 Table 3 anchors',
    worst < 1e-12 && t579 > 3450 && t579 < 3650,
    `all four measured nodes reproduce through the Planck inversion to ${worst.toExponential(1)}; the 579 nm ratio 0.066 is a ${t579.toFixed(0)} K brightness temperature (a large umbral core)`
  );
}

{
  // The combined photometry: a real worked example - region 4482
  // from the tested pull (area 410 uhem). Radii from the area and
  // the Jha share; intensities size-dependent and deeper in blue.
  const rP = Math.sqrt(2 * 410e-6);
  const rU = rP / Math.sqrt(1 + PU_AREA_RATIO);
  const ph = spotPhotometry(rU * SUN_RADIUS_ARCSEC, rP * SUN_RADIUS_ARCSEC);
  const big = spotPhotometry(15, 30);
  const small = spotPhotometry(3, 6);
  check(
    'spot photometry (worked example)',
    Math.abs(rP - 0.02864) < 1e-4 &&
      Math.abs(rU * SUN_RADIUS_ARCSEC - 10.78) < 0.05 &&
      ph.umbra[2] < ph.umbra[1] &&
      ph.umbra[1] < ph.umbra[0] &&
      ph.umbra[1] > 0.2 &&
      ph.umbra[1] < 0.45 &&
      ph.penumbra[1] > 0.75 &&
      ph.penumbra[1] < 0.9 &&
      big.umbra[1] < small.umbra[1],
    `410 uhem -> r_spot 2.86% of the radius, r_umbra 10.8" -> umbra ${ph.umbra.map((v) => v.toFixed(3)).join('/')} at 680/550/440 (deeper in blue), penumbra ${ph.penumbra[1].toFixed(3)}; a 15" umbra is darker than a 3" one (${big.umbra[1].toFixed(3)} < ${small.umbra[1].toFixed(3)}) - size dependence carried, per Mathew's warning`
  );
}

{
  // Parallactic angle (Meeus ch. 14) + the sky-frame rotation.
  const qw = parallacticAngle(0.3, 0.8, 0.1);
  const qe = parallacticAngle(-0.3, 0.8, 0.1);
  const rot = discToAltAz(0, 1, 30, 30);
  check(
    'orientation chain',
    parallacticAngle(0, 0.8, 0.1) === 0 &&
      qw > 0 &&
      Math.abs(qw + qe) < 1e-15 &&
      Math.abs(rot.v - 1) < 1e-12 &&
      Math.abs(rot.h) < 1e-12,
    `q(meridian) = 0, antisymmetric to 1e-15; P = q sends solar north to the zenith exactly`
  );
}

{
  // The live-feed builder on frozen REAL rows (the tested pull):
  // latest date only, real areas only, far side dropped, sorted.
  const jd = 2440587.5 + Date.UTC(2026, 6, 11, 12, 0) / 86400000;
  const rows = [
    {
      observed_date: '2026-07-11',
      region: 4481,
      latitude: 14,
      carrington_longitude: 332,
      area: 10
    },
    {
      observed_date: '2026-07-11',
      region: 4482,
      latitude: -9,
      carrington_longitude: 298,
      area: 410
    },
    {
      observed_date: '2026-07-11',
      region: 4485,
      latitude: -10,
      carrington_longitude: 353,
      area: 175
    },
    {
      observed_date: '2026-07-11',
      region: 9999,
      latitude: 5,
      carrington_longitude: 150,
      area: 300
    },
    {
      observed_date: '2026-07-11',
      region: 4487,
      latitude: 9,
      carrington_longitude: 299,
      area: 0
    },
    {
      observed_date: '2026-07-10',
      region: 4482,
      latitude: -9,
      carrington_longitude: 298,
      area: 410
    }
  ];
  const spots = buildSpots(rows, jd, 0);
  check(
    'live-feed builder',
    spots.length === 3 &&
      spots[0].region === 4482 &&
      spots[1].region === 4485 &&
      spots[2].region === 4481 &&
      spots.every(
        (s) =>
          Math.hypot(s.v, s.h) < 1 && s.rU < s.rP && s.umbra[1] < s.penumbra[1]
      ),
    `6 frozen rows -> ${spots.length} drawable spots (far-side Carrington 150 dropped, zero-area dropped, stale date dropped), sorted by size, umbra darker than penumbra everywhere`
  );
}

process.exit(fail ? 1 : 0);
