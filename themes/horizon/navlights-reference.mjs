// Reference printer for aviation exterior lights (node
// navlights-reference.mjs). The model lives once in navlights.js;
// landmarks against 14 CFR Part 25 - the certification rule
// every transport aircraft actually meets - and exact solves:
//  - 25.1385/25.1389 arcs tile the circle: 110 (green) + 110
//    (red) + 140 (white tail) = 360, with head-on showing both
//    forward lights and dead astern only the tail
//  - the 25.1391 intensity table verbatim: 40 cd inside 10 deg
//    of the nose, 30 to 20 deg, 5 to 110 deg, 20 cd rear -
//    symmetric about the nose
//  - 25.1401 anti-collision: 400 cd effective, 40-100 flashes
//    per minute; the per-aircraft strobe schedule stays inside
//    the band, is deterministic in the ICAO hex, and two
//    different hexes desynchronize
//  - visual ranges via the SHIPS' Allard law (apparentLux
//    imported - one model): a 40 cd position light dies between
//    4 and 5.5 nm, a 400 cd strobe carries farther, and the
//    bisection is self-consistent with apparentLux to 1e-9
import {
  ANTICOLLISION_CD,
  FLASH_PER_MIN,
  lightArcsAir,
  positionIntensity,
  strobeOn,
  visRangeM
} from './navlights.js';
import {apparentLux} from './ships.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  let green = 0;
  let red = 0;
  let tail = 0;
  let exclusive = true;
  for (let r = 0.125; r < 360; r += 0.25) {
    const a = lightArcsAir(r);
    if (a.green + a.red + a.tail !== 1) exclusive = false;
    green += a.green * 0.25;
    red += a.red * 0.25;
    tail += a.tail * 0.25;
  }
  const headOn = lightArcsAir(0);
  const astern = lightArcsAir(180);
  check(
    '25.1385 arcs',
    exclusive &&
      Math.abs(green - 110) < 1e-9 &&
      Math.abs(red - 110) < 1e-9 &&
      Math.abs(tail - 140) < 1e-9 &&
      headOn.red &&
      headOn.green &&
      !headOn.tail &&
      astern.tail &&
      !astern.red &&
      !astern.green,
    `green ${green.toFixed(2)} + red ${red.toFixed(2)} + tail ${tail.toFixed(2)} = 360 exactly; head-on shows red+green, dead astern tail only`
  );
}

{
  const t = (r) => positionIntensity(r);
  check(
    '25.1391 table',
    t(5) === 40 &&
      t(355) === 40 &&
      t(15) === 30 &&
      t(345) === 30 &&
      t(45) === 5 &&
      t(109) === 5 &&
      t(251) === 5 &&
      t(180) === 20 &&
      t(115) === 20,
    `40 cd inside 10 deg (both sides), 30 cd to 20 deg, 5 cd to 110 deg, rear 20 cd - the certification table verbatim`
  );
}

{
  // Strobes: count flashes over one minute for two hexes; rates
  // must sit inside the certified band and differ (no unison sky).
  const count = (hex) => {
    let n = 0;
    let was = false;
    for (let t = 0; t < 60; t += 0.005) {
      const on = strobeOn(hex, t);
      if (on && !was) n++;
      was = on;
    }
    return n;
  };
  const a = count('4b1817');
  const b = count('3c6754');
  check(
    '25.1401 anti-collision',
    ANTICOLLISION_CD === 400 &&
      a >= FLASH_PER_MIN[0] &&
      a <= FLASH_PER_MIN[1] &&
      b >= FLASH_PER_MIN[0] &&
      b <= FLASH_PER_MIN[1] &&
      a !== b,
    `400 cd effective; hex 4b1817 -> ${a}/min, 3c6754 -> ${b}/min - both inside 40-100, desynchronized`
  );
}

{
  const r40 = visRangeM(40);
  const r400 = visRangeM(ANTICOLLISION_CD);
  const nm = (m) => m / 1852;
  const consistent = Math.abs(apparentLux(40, r40) - 2e-7) < 1e-9;
  check(
    'Allard ranges',
    nm(r40) > 4 && nm(r40) < 5.5 && r400 > r40 * 1.5 && consistent,
    `40 cd position light dies at ${nm(r40).toFixed(2)} nm; 400 cd strobe at ${nm(r400).toFixed(2)} nm; bisection meets apparentLux threshold exactly (one Allard model with the ships)`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
