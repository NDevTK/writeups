// Reference printer for the ship model (node ships-reference.mjs).
// The model lives once in ships.js; landmarks against COLREGS
// (1972) - the actual regulation every vessel obeys - and exact
// solves:
//  - Annex I section 8 reproduces the published intensity table:
//    0.9 cd at 1 nm, 12 cd at 3 nm, 94 cd at 6 nm
//  - the Annex I constant 3.43e6 is 1852^2 to three figures, so
//    Allard's law returns EXACTLY the threshold illuminance T at
//    the rated range - the regulation is Allard solved for I
//  - Rule 21 arcs tile the circle (112.5 + 112.5 + 135 = 360)
//    and the boundary memberships are exact: dead ahead shows
//    both sidelights + masthead, dead astern only the sternlight
//  - the scene mapping mirrors the aircraft path with the exact
//    international knot (asserted equal to contrails.KT_MS)
//  - Rule 20(b) lights-on boundary at -50 arcmin solar altitude
import {
  aisToScene,
  apparentLux,
  KT_MS,
  lightArcs,
  lightPlan,
  luminousIntensity,
  RANGE_NM,
  rangesFor,
  relBearing,
  statusClass,
  statusLights,
  statusUnderway,
  SUNSET_ELEV,
  typeClass
} from './ships.js';
import {KT_MS as KT_MS_AIR} from './contrails.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  const i1 = luminousIntensity(1);
  const i3 = luminousIntensity(3);
  const i6 = luminousIntensity(6);
  check(
    'Annex I intensities',
    Math.abs(i1 - 0.9) < 0.05 &&
      Math.abs(i3 - 12) < 0.1 &&
      Math.abs(i6 - 94) < 0.3,
    `D=1 -> ${i1.toFixed(2)} cd (table 0.9); D=3 -> ${i3.toFixed(1)} cd (table 12); D=6 -> ${i6.toFixed(1)} cd (table 94)`
  );
}

{
  // Allard round trip: at the rated range the eye receives the
  // threshold illuminance exactly (up to 3.43e6 vs 1852^2 =
  // 3429904, a 2.8e-5 rounding the regulation itself made).
  const T = 2e-7;
  const r6 = apparentLux(luminousIntensity(6), 6 * 1852) / T;
  const r3 = apparentLux(luminousIntensity(3), 3 * 1852) / T;
  const constRatio = 3.43e6 / (1852 * 1852);
  check(
    'Allard round trip',
    Math.abs(r6 - constRatio) < 1e-12 &&
      Math.abs(r3 - constRatio) < 1e-12 &&
      Math.abs(constRatio - 1) < 3e-5,
    `E(rated range)/T = ${r6.toFixed(7)} at 6 nm and ${r3.toFixed(7)} at 3 nm - both exactly 3.43e6/1852^2 = ${constRatio.toFixed(7)}`
  );
}

{
  // Rule 21 arcs: exact sweep sampled BETWEEN the arc boundaries
  // (at the boundaries themselves adjacent lights sit at their
  // screen edges and are both lit - checked separately below) -
  // every interior direction belongs to exactly one of
  // {sidelight region, stern region}, and the masthead spans
  // exactly the sidelight union (225 of the 360 deg).
  let ok = true;
  let masthead = 0;
  for (let r = 0.125; r < 360; r += 0.25) {
    const a = lightArcs(r);
    const side = a.port || a.starboard;
    if (side === a.stern) ok = false; // exactly one region
    if (a.masthead !== side) ok = false;
    if (a.masthead) masthead += 0.25;
  }
  const ahead = lightArcs(0);
  const astern = lightArcs(180);
  const beamS = lightArcs(90);
  const beamP = lightArcs(270);
  check(
    'Rule 21 arcs',
    ok &&
      Math.abs(masthead - 225) < 1e-9 &&
      ahead.port &&
      ahead.starboard &&
      ahead.masthead &&
      !ahead.stern &&
      astern.stern &&
      !astern.masthead &&
      !astern.port &&
      !astern.starboard &&
      beamS.starboard &&
      !beamS.port &&
      beamP.port &&
      !beamP.starboard &&
      RANGE_NM.masthead === 6 &&
      RANGE_NM.side === 3 &&
      RANGE_NM.stern === 3,
    `sidelights+stern tile 360 exactly; masthead spans ${masthead.toFixed(2)} deg (225); dead ahead = red+green+masthead, dead astern = stern only; Rule 22 ranges 6/3/3 nm`
  );
}

{
  // Relative bearing in the scene frame (+x east, -z north): an
  // observer due EAST of a north-heading ship sits broad on the
  // starboard beam (rel 90); due south is dead astern (180).
  const ship = {x: 0, z: 0};
  const east = relBearing(0, ship, {x: 10, z: 0});
  const south = relBearing(0, ship, {x: 0, z: 10});
  const westOf90 = relBearing(90, ship, {x: -10, z: 0});
  check(
    'relative bearing',
    Math.abs(east - 90) < 1e-9 &&
      Math.abs(south - 180) < 1e-9 &&
      Math.abs(westOf90 - 180) < 1e-9,
    `north-heading ship: observer east -> rel ${east.toFixed(1)} (starboard beam), south -> ${south.toFixed(1)} (astern); east-heading ship, observer west -> ${westOf90.toFixed(1)} (astern)`
  );
}

{
  // Scene mapping: exact knot; a ship AT the reference point maps
  // to the origin; 10 kt due east moves +x only at the exact
  // converted speed; +8 km north is the half-world edge.
  const ref = {lat: 46.62, lon: 8.04, halfM: 8000, world: 280, mpu: 57.14};
  const at = aisToScene({lat: 46.62, lon: 8.04, sog: 10, cog: 90}, ref);
  const north = aisToScene(
    {lat: 46.62 + 8000 / 111320, lon: 8.04, sog: 0, cog: null},
    ref
  );
  const spExp = (10 * 0.514444) / 57.14;
  check(
    'AIS mapping',
    Math.abs(at.x) < 1e-9 &&
      Math.abs(at.z) < 1e-9 &&
      Math.abs(at.vx - spExp) < 1e-12 &&
      Math.abs(at.vz) < 1e-9 &&
      Math.abs(north.z - -140) < 1e-9 &&
      north.sp === 0 &&
      KT_MS === 0.514444 &&
      KT_MS === KT_MS_AIR,
    `origin exact; 10 kt east -> vx ${at.vx.toFixed(4)} u/s; +8 km north -> z ${north.z.toFixed(1)} (half-world); KT_MS shared with the aircraft path`
  );
  // Track precedence: COG (includes set/drift) over TrueHeading;
  // a heading-only vessel dead-reckons along that heading; with
  // neither measured a moving hull HOLDS (marching it due north
  // would be inventing a track). cog=0 is a measured due-north
  // course, not a missing one.
  const hdgOnly = aisToScene(
    {lat: 46.62, lon: 8.04, sog: 10, cog: null, hdg: 90},
    ref
  );
  const blind = aisToScene({lat: 46.62, lon: 8.04, sog: 10, cog: null}, ref);
  const cogZero = aisToScene(
    {lat: 46.62, lon: 8.04, sog: 10, cog: 0, hdg: 90},
    ref
  );
  check(
    'AIS track precedence',
    Math.abs(hdgOnly.vx - spExp) < 1e-12 &&
      Math.abs(hdgOnly.vz) < 1e-9 &&
      blind.vx === 0 &&
      blind.vz === 0 &&
      Math.abs(blind.sp - spExp) < 1e-12 &&
      Math.abs(cogZero.vz - -spExp) < 1e-12 &&
      Math.abs(cogZero.vx) < 1e-9,
    `hdg-only rides its heading (vx ${hdgOnly.vx.toFixed(4)}); directionless holds (sp kept ${blind.sp.toFixed(4)}); cog=0 beats hdg`
  );
}

{
  check(
    'Rule 20(b) boundary',
    Math.abs(SUNSET_ELEV - -0.8333333333333334) < 1e-12,
    `lights from sunset to sunrise: solar altitude below ${SUNSET_ELEV.toFixed(4)} deg (-50 arcmin: 34' refraction + 16' semidiameter)`
  );
}

{
  // ITU-R M.1371 type codes -> silhouette classes: family by
  // first digit, specific craft at 30-37 and 52.
  const ok =
    typeClass(70) === 'cargo' &&
    typeClass(79) === 'cargo' &&
    typeClass(84) === 'tanker' &&
    typeClass(60) === 'passenger' &&
    typeClass(30) === 'fishing' &&
    typeClass(36) === 'sailing' &&
    typeClass(37) === 'pleasure' &&
    typeClass(52) === 'tug' &&
    typeClass(31) === 'tug' &&
    typeClass(41) === 'hsc' &&
    typeClass(0) === 'other' &&
    typeClass(90) === 'other';
  check(
    'M.1371 type classes',
    ok,
    `70s cargo, 80s tanker, 60s passenger, 30 fishing, 36 sailing, 37 pleasure, 31/32/52 tug, 40s HSC, unknown/other -> other`
  );
}

{
  // The measured light plan, COLREGS made concrete. 240 x 32 m
  // cargo (Rule 23(a) + Annex I 2(a)/3(a)): TWO mastheads, the
  // forward at min(6..12, beam-capped) = 12 m (beam 32 caps at
  // 12), the after 4.5 m higher, separated by min(len/2, 100) =
  // 100 m, forward light within a quarter length of the stem;
  // Rule 22(a) ranges 6/3/3.
  const big = lightPlan(240, 32, 'cargo');
  const sepBig = big.mastheads[1].z - big.mastheads[0].z;
  const stemBig = big.mastheads[0].z - -120;
  // 30 m fisherman: ONE masthead (under 50 m), Rule 22(b) ranges
  // 5/2/2; an 8 m launch: 2/1/2; a 15 m boat's masthead range 3.
  const mid = lightPlan(30, 7, 'fishing');
  const small = rangesFor(8);
  const fifteen = rangesFor(15);
  // Rule 25(b): a sailing vessel carries NO masthead light.
  const sail = lightPlan(14, 4, 'sailing');
  const ok =
    big.mastheads.length === 2 &&
    big.mastheads[0].y === 12 &&
    big.mastheads[1].y === 16.5 &&
    sepBig === 100 &&
    stemBig >= 0 &&
    stemBig <= 60 &&
    big.ranges.masthead === 6 &&
    // Annex I 2(g) is a MAXIMUM: sidelights not above 3/4 of the
    // forward masthead height (the plan places them at 0.6).
    Math.abs(big.sideY - 7.2) < 1e-12 &&
    big.sideY <= 0.75 * big.mastheads[0].y &&
    mid.mastheads.length === 1 &&
    mid.mastheads[0].y === 7 &&
    mid.ranges.masthead === 5 &&
    mid.ranges.side === 2 &&
    small.masthead === 2 &&
    small.side === 1 &&
    small.stern === 2 &&
    fifteen.masthead === 3 &&
    sail.mastheads.length === 0 &&
    sail.ranges.side === 2;
  check(
    'measured light plan',
    ok,
    `240 m cargo: two mastheads 12/16.5 m, 100 m apart, forward within L/4 of the stem, 6/3/3 nm; 30 m fisher: one masthead at beam height 7 m, 5/2/2; 8 m launch 2/1/2; 15 m masthead 3 nm; sailing = no masthead (Rule 25(b))`
  );
}

{
  // Navigational status -> light regime (ITU-R M.1371 Table 45
  // through COLREGS Rules 27/30). The deliberate abstentions are
  // pinned too: status 4 (constrained by draught) keeps the
  // underway set because Rule 28's reds are optional, and 7
  // (fishing) because AIS cannot say trawl vs other gear.
  const ok =
    statusClass(0) === 'underway' &&
    statusClass(1) === 'anchored' &&
    statusClass(2) === 'nuc' &&
    statusClass(3) === 'ram' &&
    statusClass(4) === 'underway' &&
    statusClass(5) === 'moored' &&
    statusClass(6) === 'aground' &&
    statusClass(7) === 'underway' &&
    statusClass(8) === 'underway' &&
    statusClass(15) === 'underway' &&
    statusClass(undefined) === 'underway';
  check(
    'M.1371 status classes',
    ok,
    `0/8 underway, 1 anchored, 2 NUC, 3 RAM, 5 moored, 6 aground; 4 and 7 deliberately keep the underway set (optional Rule 28 reds, unmeasured fishing gear); 15/missing = the standard's default`
  );
}

{
  // Rule 30 anchor lights from the measured length. 240 m: fore
  // all-round white >= 6 m up and >= 4.5 m above the after one
  // (Annex I 2(k)), fore light toward the bow (-z); 30 m: ONE
  // all-round white (Rule 30(b)); aground adds two all-round
  // reds 2 m apart (Annex I 2(i); 1 m under 20 m). Rule 22
  // all-round ranges: 3 nm at 50 m+, 2 below.
  const big = statusLights(240, 32, 'anchored');
  const small = statusLights(30, 7, 'anchored');
  const agnd = statusLights(240, 32, 'aground');
  const dinghy = statusLights(12, 3, 'nuc');
  const ok =
    big.length === 2 &&
    big[0].y >= 6 &&
    big[0].y - big[1].y >= 4.5 &&
    big[0].z < 0 &&
    big[1].z > 0 &&
    big.every((l) => l.color === 'white' && l.show === 'anchorish') &&
    small.length === 1 &&
    small[0].color === 'white' &&
    agnd.length === 4 &&
    agnd.filter((l) => l.color === 'red').length === 2 &&
    agnd
      .filter((l) => l.color === 'red')
      .every((l, i, a) => i === 0 || a[0].y - l.y === 2) &&
    dinghy.length === 2 &&
    dinghy[0].y - dinghy[1].y === 1 &&
    rangesFor(240).allRound === 3 &&
    rangesFor(30).allRound === 2 &&
    rangesFor(8).allRound === 2;
  check(
    'Rule 30/27 all-round lights',
    ok,
    `240 m anchored: fore white ${big[0].y} m (bow side), after ${big[1].y} m (>= 4.5 m lower); 30 m: one white where best seen; aground = anchor pair + two reds 2 m apart (1 m under 20 m); all-round ranges 3/2 nm`
  );
}

{
  // Rule 27's underway carve-outs: NUC making way shows side +
  // stern but NO masthead (27(a)(iii)); RAM making way keeps the
  // masthead too (27(b)(iii)); neither shows anything extra when
  // stopped; anchored/moored/aground carry none of the underway
  // set (Rules 23/25 apply to vessels underway).
  const nucStop = statusUnderway('nuc', false);
  const nucWay = statusUnderway('nuc', true);
  const ramWay = statusUnderway('ram', true);
  const anch = statusUnderway('anchored', true);
  const ok =
    !nucStop.side &&
    !nucStop.stern &&
    !nucStop.masthead &&
    nucWay.side &&
    nucWay.stern &&
    !nucWay.masthead &&
    ramWay.side &&
    ramWay.stern &&
    ramWay.masthead &&
    !anch.masthead &&
    !anch.side &&
    !anch.stern &&
    statusUnderway('underway', false).masthead;
  check(
    'Rule 27 making-way carve-outs',
    ok,
    `NUC making way: side + stern, no masthead; RAM making way: masthead too; stopped: reds only; anchored/moored/aground: no underway lights at all`
  );
}

{
  // A measured at-anchor status HOLDS the hull: the GPS-jitter
  // SOG must not dead-reckon an anchored ship across its
  // harbour (the fix itself keeps arriving).
  const ref = {lat: 46.62, lon: 8.04, halfM: 8000, world: 280, mpu: 57.14};
  const anch = aisToScene(
    {lat: 46.62, lon: 8.04, sog: 0.2, cog: 90, st: 1},
    ref
  );
  const under = aisToScene(
    {lat: 46.62, lon: 8.04, sog: 0.2, cog: 90, st: 0},
    ref
  );
  check(
    'anchored hulls hold',
    anch.vx === 0 && anch.vz === 0 && anch.sp > 0 && under.vx > 0,
    `st=1 with 0.2 kt of jitter holds position (sp kept for the record); st=0 dead-reckons as before`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
