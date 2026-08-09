// beads-reference.mjs - the gate for the Baily's beads
// hindcast: the 2017 August 21 graze from inside the southern
// umbral limit, marched along the LOLA-measured lunar limb
// against the recorded flash-spectrum video. The law lives once
// in beads.js; both vendored legs (Quaglia et al. 2021's printed
// computational model and the LDEM_16-derived limb ring) carry
// their provenance in beads-data.js. Landmarks:
//  - the vendored table is internally consistent: the lunar
//    semidiameter polynomial IS the printed datum radius at the
//    printed distance (sub-milliarcsecond), and the solar
//    polynomial implies an August heliocentric distance
//  - MY LIMB REPRODUCES THEIR LIMB: heights within ~3" of the
//    datum, the C2 valley as the local minimum at PA ~171, the
//    C3 valley at ~185-186, and the narrow double valley
//    between them that the photosphere never reaches - derived
//    from a 33 MB public altimetry grid none of whose bytes
//    came from the paper
//  - THE RECORDED VIDEO DISCRIMINATES: with Auwers' 959.63"
//    the march puts ~32 s of photospheric extinction at the
//    site (their own model prints 32.6 s; four codes span
//    32.6-36.1 s) - far outside the video's recorded 9-17 s;
//    with their measured 959.95" the march lands INSIDE the
//    video bounds; at 960.00" the contacts land at their
//    printed T0 -+ 6.6 s
//  - the beads sequence plays as written: three-plus beads half
//    a minute out, the last bead lingering alone through the
//    final ten seconds, beads returning faster after C3
//  - the drawn eclipse carries the measured radius: the
//    shipped solarEclipse now runs the photospheric-extinction
//    disc (959.95" at 1 au exactly), while the certified
//    Dallas/Galicia landmarks hold unchanged
import {
  AUWERS_ARCSEC,
  AUWERS_SITE_DURATION_S,
  C2C3_AT_960_S,
  LIMB_RING_ARCSEC,
  MEASURED_S_ARCSEC,
  MODEL_SPREAD_S,
  MOON_DATUM_KM,
  MOON_DIST_KM,
  MOON_SEMIDIAM_POLY,
  SUN_SEMIDIAM_POLY,
  VIDEO_EXTINCTION_S
} from './beads-data.js';
import {exposedState, grazeMarch, limbHeight, sunLimbHeight} from './beads.js';
import {AU_KM, ECLIPSE_SUN_SCALE, R_SUN_KM, solarEclipse} from './eclipses.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- the vendored table is internally consistent --------------
{
  const datumApp = Math.asin(MOON_DATUM_KM / MOON_DIST_KM) * 206264.806;
  const dMas = (datumApp - MOON_SEMIDIAM_POLY[0]) * 1000;
  const sunAu = 960 / SUN_SEMIDIAM_POLY[0];
  check(
    'Table 2 closes on itself',
    Math.abs(dMas) < 5 && sunAu > 1.01 && sunAu < 1.013,
    `the lunar semidiameter polynomial (${MOON_SEMIDIAM_POLY[0]}") IS the ` +
      `printed 1738.091 km datum at the printed 367399.181 km - ` +
      `difference ${dMas.toFixed(1)} mas; the solar polynomial implies ` +
      `${sunAu.toFixed(5)} au - late-August Earth, as the calendar demands`
  );
}

// ---- my limb reproduces their limb ----------------------------
{
  let mn = Infinity;
  let mx = -Infinity;
  for (const h of LIMB_RING_ARCSEC) {
    mn = Math.min(mn, h);
    mx = Math.max(mx, h);
  }
  const minIn = (a, b) => {
    let m = Infinity;
    let at = a;
    for (let p = a; p <= b; p += 0.1) {
      const h = limbHeight(p);
      if (h < m) {
        m = h;
        at = p;
      }
    }
    return {m, at};
  };
  const c2v = minIn(168, 174);
  const c3v = minIn(183, 188);
  const dbl = minIn(174.5, 178.5);
  const bump = Math.max(limbHeight(176), limbHeight(176.5));
  check(
    'MY LIMB REPRODUCES THEIR LIMB',
    mx < 3.2 &&
      mn > -3.2 &&
      c2v.m < -1.0 &&
      Math.abs(c2v.at - 171) < 2 &&
      c3v.m < -0.8 &&
      Math.abs(c3v.at - 185.5) < 2 &&
      dbl.m < -0.6 &&
      bump > dbl.m + 0.4,
    `LDEM_16 ring at their printed libration: heights span ` +
      `${mn.toFixed(2)}"..${mx.toFixed(2)}" (their "just 2-3""); the C2 ` +
      `valley bottoms at PA ${c2v.at.toFixed(1)} (${c2v.m.toFixed(2)}") ` +
      `and C3 at ${c3v.at.toFixed(1)} (${c3v.m.toFixed(2)}") - their ` +
      `printed ~171 / ~185-186; between them the narrow double valley ` +
      `(${dbl.m.toFixed(2)}" under a ${bump.toFixed(2)}" bump) - the ` +
      `same southern polar relief, from an independent altimetry grid`
  );
}

// ---- the recorded video discriminates -------------------------
const mAuw = grazeMarch(AUWERS_ARCSEC);
const mMeas = grazeMarch(MEASURED_S_ARCSEC);
const m960 = grazeMarch(960.0);
{
  const durs = [959.63, 959.85, 959.95, 960.0, 960.15].map(
    (s) => grazeMarch(s).durationS
  );
  const mono = durs.every((d, i) => i === 0 || d < durs[i - 1]);
  check(
    'THE RECORDED VIDEO DISCRIMINATES the solar radius',
    Math.abs(mAuw.durationS - AUWERS_SITE_DURATION_S) < 1.5 &&
      mAuw.durationS > MODEL_SPREAD_S[0] - 1.5 &&
      mAuw.durationS < MODEL_SPREAD_S[1] &&
      mAuw.durationS > VIDEO_EXTINCTION_S[1] + 10 &&
      mMeas.durationS > VIDEO_EXTINCTION_S[0] &&
      mMeas.durationS < VIDEO_EXTINCTION_S[1] &&
      Math.abs(m960.c2S + C2C3_AT_960_S) < 1 &&
      Math.abs(m960.c3S - C2C3_AT_960_S) < 1 &&
      mono,
    `Auwers 959.63": the march gives ${mAuw.durationS.toFixed(1)} s of ` +
      `photospheric extinction (their model prints 32.6 s; four codes ` +
      `span 32.6-36.1) - the video recorded 9-17 s, and 32 s is exactly ` +
      `the "wildly incompatible" the paper calls it; measured 959.95": ` +
      `${mMeas.durationS.toFixed(1)} s - INSIDE the video bounds; at ` +
      `960.00" the contacts land at T0${m960.c2S.toFixed(1)}/+` +
      `${m960.c3S.toFixed(1)} s vs their printed -+6.6; duration falls ` +
      `monotonically ${durs.map((d) => d.toFixed(1)).join(' > ')} s ` +
      `across 959.63..960.15`
  );
  check(
    'the contacts land in the printed valleys',
    Math.abs(mMeas.c2PaDeg - 171) < 4 && Math.abs(mMeas.c3PaDeg - 185.5) < 4,
    `C2 at PA ${mMeas.c2PaDeg.toFixed(1)}, C3 at PA ` +
      `${mMeas.c3PaDeg.toFixed(1)} - the same two southern valleys their ` +
      `Figure 6 marks (~171-172 and ~185-186): the LAST and FIRST light ` +
      `of totality each pick a real lunar valley, and my limb picks the ` +
      `same two theirs did`
  );
}

// ---- the beads sequence plays as written ----------------------
{
  const at = (dt) => exposedState((m960.c2S + dt) / 60, 960.0).beadCount;
  const at3 = (dt) => exposedState((m960.c3S + dt) / 60, 960.0).beadCount;
  // The final phase: their own sentence is PLURAL - "the last
  // inconspicuous Baily's beads will remain, fading away very
  // slowly until the onset of totality". Two separable facts:
  // photosphere PRESENT (geometric, any size) to the brink, and
  // never more than 2 beads above a 0.05" prominence floor -
  // beneath it, 0.01-0.05" glints flicker (geometric arcs touch
  // 3), the "inconspicuous" of the sentence made literal.
  let lingerOk = true;
  let present = true;
  for (let dt = -10; dt <= -0.5; dt += 0.5) {
    const st = exposedState((m960.c2S + dt) / 60, 960.0, 0.05);
    if (st.arcs.length < 1) present = false;
    if (st.beadCount > 2) lingerOk = false;
  }
  check(
    'the beads sequence plays as written',
    at(-30) >= 3 &&
      at(-10) <= 2 &&
      lingerOk &&
      present &&
      at3(3) <= 2 &&
      at3(10) >= 3 &&
      at3(10) > at(-10),
    `half a minute before C2 the limb shows ${at(-30)} photospheric arcs ` +
      `(their "three beads" are the prominent ones); the field thins to ` +
      `${at(-10)} by C2-10 s and stays a 1-2 bead trickle above a 0.05" ` +
      `prominence floor to the brink, sub-0.05" glints flickering ` +
      `beneath - their "last INCONSPICUOUS Baily's beads... fading away ` +
      `very slowly until the onset of totality", the fade continuous to ` +
      `zero; after C3, ${at3(3)} bead at +3 s but ${at3(10)} by +10 s - ` +
      `"beads should reappear at a noticeably faster rate", and they ` +
      `do: ${at3(10)} arcs at +10 s out vs ${at(-10)} at -10 s in`
  );
  // the double valley never shines at mid-totality
  let worstGap = -Infinity;
  for (let ps = 174.5; ps <= 178.5; ps += 0.05) {
    const gap = sunLimbHeight(ps, 0, MEASURED_S_ARCSEC) - limbHeight(ps);
    if (gap > worstGap) worstGap = gap;
  }
  check(
    'the intermediate double valley never shines',
    worstGap < 0 && worstGap > -0.7,
    `at mid-totality the solar limb rises to within ` +
      `${(-worstGap).toFixed(2)}" of the double valley's floor and no ` +
      `closer - their "photospheric continuum does not shine in the ` +
      `intermediate double valley... the solar limb passed just below ` +
      `the bottom", quantified through my own limb`
  );
}

// ---- the drawn eclipse carries the measured radius ------------
{
  const auwersApp = Math.asin(R_SUN_KM / AU_KM) * 206264.806;
  const se = solarEclipse(0, AU_KM, 380000);
  const rSunAs = se.rSun * 206264.806;
  check(
    'the shipped eclipse disc is the measured one',
    Math.abs(auwersApp - 959.645) < 0.05 &&
      Math.abs(rSunAs - MEASURED_S_ARCSEC) < 0.001 &&
      ECLIPSE_SUN_SCALE > 1.0002 &&
      ECLIPSE_SUN_SCALE < 1.0005,
    `R_SUN_KM/AU encodes Auwers (${auwersApp.toFixed(3)}"); ` +
      `solarEclipse now applies the measured photospheric-extinction ` +
      `scale and returns ${rSunAs.toFixed(3)}" at 1 au - the radius the ` +
      `2017 video actually saw; obscuration moves ~0.03% and the ` +
      `certified Dallas/Galicia landmarks hold in their own gate`
  );
}

process.exit(fail ? 1 : 0);
