// Reference printer for the zodiacal light (node
// zodiacal-reference.mjs). The model lives once in zodiacal.js;
// landmarks, all against Leinert et al. 1998 (A&AS 127, 1) and the
// published photometry:
//  - the paper's own consistency: the ecliptic-pole brightness it
//    quotes (60 +- 3 S10sun) times its own S10-to-SI factor
//    (1.28e-8, Table 2) equals the adopted pole value 77
//  - the table's structure: the Gegenschein is a LOCAL MAXIMUM on
//    the ecliptic at (180, 0) above the (135-150, 0) minimum; the
//    brightness declines monotonically with elongation from 15 to
//    135 deg and with latitude at fixed elongation
//  - the sampler is exact at grid nodes and honours the symmetry
//    folds (dlam -> -dlam, 360-dlam; beta -> -beta)
//  - absolute photometry via the solar-spectrum conversion: the
//    pole lands at ~23.2 V mag/arcsec^2 and the Gegenschein at
//    ~22.0 - the published surface brightnesses of both
//  - Masana factors: fR swings +-4% over the Earth's real
//    perihelion-aphelion range; fS is unity below 60 deg latitude
//    and +-10% above
import {
  buildZodiacalGrid,
  eclipticOfDir,
  fR,
  fS,
  filledTable,
  lumPerUnit,
  OBLIQUITY,
  sampleZL,
  ZL_BETA,
  ZL_DLAM,
  ZL_POLE,
  ZL_TABLE,
  zlPerGreen
} from './zodiacal.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  const pole = 60 * 1.28;
  check(
    'pole consistency',
    Math.abs(pole - ZL_POLE) < 1,
    `60 S10sun x 1.28e-8 = ${pole.toFixed(1)} vs adopted ${ZL_POLE} (1e-8 W m^-2 sr^-1 um^-1)`
  );
}

{
  const at = (dl, be) => ZL_TABLE[ZL_DLAM.indexOf(dl)][ZL_BETA.indexOf(be)];
  const gegen = at(180, 0);
  const min = at(135, 0);
  let mono = true;
  for (let i = ZL_DLAM.indexOf(15); i < ZL_DLAM.indexOf(135); i++) {
    if (ZL_TABLE[i + 1][0] > ZL_TABLE[i][0]) mono = false;
  }
  let monoB = true;
  const r90 = ZL_TABLE[ZL_DLAM.indexOf(90)];
  for (let j = 1; j < r90.length; j++) if (r90[j] > r90[j - 1]) monoB = false;
  check(
    'table structure',
    gegen === 230 && min === 179 && gegen > at(150, 0) && mono && monoB,
    `Gegenschein ${gegen} > minimum ${min} at (135,0); ecliptic decline 15->135 and latitude decline at 90 deg both monotonic`
  );
}

{
  const node = sampleZL(90, 0);
  const symD = Math.abs(sampleZL(-60, 30) - sampleZL(60, 30));
  const symW = Math.abs(sampleZL(300, 30) - sampleZL(60, 30));
  const symB = Math.abs(sampleZL(60, -30) - sampleZL(60, 30));
  const filled = filledTable()[0][0];
  check(
    'sampler',
    node === 259 &&
      symD < 1e-12 &&
      symW < 1e-12 &&
      symB < 1e-12 &&
      filled === 11500,
    `node (90,0) = ${node} exact; folds exact; sun-proximal blank fills to column value ${filled}`
  );
  const grid = buildZodiacalGrid(96, 48);
  const gPole = grid[47 * 96];
  check(
    'shader grid',
    Math.abs(gPole - ZL_POLE) < 1e-9 && Math.abs(grid[0] - filled) < 1e-9,
    `regular grid closes at the pole (${gPole.toFixed(1)}) and the sun corner (${grid[0].toFixed(0)})`
  );
}

{
  // Published surface brightnesses (V mag/arcsec^2 =
  // 12.576 - 2.5 log10 L[cd/m^2]).
  const mag = (u) => 12.576 - 2.5 * Math.log10(u * lumPerUnit());
  const pole = mag(ZL_POLE);
  const gegen = mag(230);
  check(
    'absolute photometry',
    Math.abs(pole - 23.2) < 0.3 && Math.abs(gegen - 22.0) < 0.3,
    `pole ${pole.toFixed(2)} mag/arcsec^2 (~23.2 published), Gegenschein ${gegen.toFixed(2)} (~22.0)`
  );
  const ratio = zlPerGreen();
  check(
    'airglow cross-calibration',
    ratio > 0.01 && ratio < 0.1,
    `one table unit = ${ratio.toFixed(4)} of the airglow reference green line - both share AGLOW_GAIN`
  );
}

{
  const swing = fR(0.9833) / fR(1.0167);
  const hi = fS(75, 96 + 90);
  const lo = fS(75, 96 - 90);
  check(
    'Masana factors',
    Math.abs(fR(1) - 1) < 1e-12 &&
      swing > 1.07 &&
      swing < 1.09 &&
      Math.abs(hi - 1.1) < 1e-12 &&
      Math.abs(lo - 0.9) < 1e-12 &&
      fS(30, 96 + 90) === 1,
    `fR perihelion/aphelion = ${swing.toFixed(3)} (r^-2.3); fS in [${lo.toFixed(2)}, ${hi.toFixed(2)}] above 60 deg, 1 below`
  );
}

{
  // Frame roundtrip: a sun built at ecliptic longitude 30 (the
  // NOAA formula's own construction) must come back at
  // (lam = 30, beta = 0) exactly; the ecliptic pole (ra = 270,
  // dec = 90 - obliquity) at beta = 90.
  const lam0 = (30 * Math.PI) / 180;
  const ra = Math.atan2(Math.cos(OBLIQUITY) * Math.sin(lam0), Math.cos(lam0));
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(lam0));
  const e = eclipticOfDir(
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec),
    Math.cos(dec) * Math.cos(ra)
  );
  const p = eclipticOfDir(
    Math.cos(Math.PI / 2 - OBLIQUITY) * Math.sin(1.5 * Math.PI),
    Math.sin(Math.PI / 2 - OBLIQUITY),
    Math.cos(Math.PI / 2 - OBLIQUITY) * Math.cos(1.5 * Math.PI)
  );
  check(
    'ecliptic frame',
    Math.abs(e.lam - lam0) < 1e-12 &&
      Math.abs(e.beta) < 1e-12 &&
      Math.abs(p.beta - Math.PI / 2) < 1e-9,
    `sun at lam=30 roundtrips (${((e.lam * 180) / Math.PI).toFixed(6)}, ${e.beta.toExponential(1)}); ecliptic pole beta = ${((p.beta * 180) / Math.PI).toFixed(4)}`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
