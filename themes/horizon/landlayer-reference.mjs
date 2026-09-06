// landlayer-reference.mjs - the gate for landlayer.js (157th pass):
// the roughness classes against Stull's printed drag coefficients
// (the log law's own print), the Guide's ln-average, the bluff-body
// thermal roughness against Rigden's constants (the kilowatt
// finding), the bulk solution's closure on its own inputs and its
// neutral limit, Fleagle's test on the film, Hirt's coefficient over
// the eye's metres, and the composed column under the fixture's
// ascent.
import {
  AUTOCONVECTIVE_LAYERS,
  DAVENPORT,
  KB_BLUFF_C1,
  KB_INV_RIGDEN,
  KB_LAW_OF_OSM,
  OSM_ROUGHNESS,
  autoconvective,
  cdLogLaw,
  davenportClass,
  effectiveZ0,
  insidePolygon,
  kbInvBluff,
  kbInvOfLaw,
  kbSensitivity,
  landBulk,
  landColumnRows,
  landRefractionK,
  roughnessCensus
} from './landlayer.js';
import {KAPPA, NU_AIR, PR_NEUTRAL, psiH} from './surfacelayer.js';
import {refractionK} from './far-terrain.js';
import {AUTOCONVECTIVE_K_PER_M} from './fleagle.js';
import {SOUNDING} from './observatory-fixture.js';

let fail = false;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail = true;
};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

// ---- THE CLASSES: Stull's CD column is the log law's own print -----
{
  const rows = DAVENPORT.map((d) => ({
    ...d,
    cd: cdLogLaw(d.z0M),
    err: Math.abs(cdLogLaw(d.z0M) - d.cdStull) / d.cdStull
  }));
  const worst = Math.max(...rows.map((r) => r.err));
  const half = effectiveZ0([
    {frac: 0.5, z0M: 0.03},
    {frac: 0.5, z0M: 1}
  ]);
  const skewed = effectiveZ0([
    {frac: 0.9, z0M: 0.03},
    {frac: 0.1, z0M: 1}
  ]);
  const arith = 0.9 * 0.03 + 0.1 * 1;
  const mapped = Object.keys(OSM_ROUGHNESS);
  const lawed = Object.keys(KB_LAW_OF_OSM);
  const sq = [
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0]
    ]
  ];
  const hole = [
    ...sq,
    [
      [0.4, 0.4],
      [0.4, 0.6],
      [0.6, 0.6],
      [0.6, 0.4]
    ]
  ];
  check(
    'THE CLASSES: Stull’s drag column is the log law at 10 m, the Guide averages ln z0, the cover maps to a class and a law',
    DAVENPORT.length === 8 &&
      DAVENPORT[0].z0M === 0.0002 &&
      DAVENPORT[2].z0M === 0.03 &&
      DAVENPORT[6].z0M === 1 &&
      DAVENPORT[7].z0M === 2 &&
      worst < 0.03 &&
      rows.every((r) => r.err < 0.03) &&
      davenportClass(3).name === 'open' &&
      davenportClass(0).cls === 1 &&
      davenportClass(11).cls === 8 &&
      near(half, Math.sqrt(0.03), 1e-12) &&
      skewed < arith &&
      near(skewed, Math.exp(0.9 * Math.log(0.03) + 0.1 * Math.log(1)), 1e-12) &&
      Number.isNaN(effectiveZ0([])) &&
      mapped.length === 24 &&
      mapped.every((k) => OSM_ROUGHNESS[k] >= 2 && OSM_ROUGHNESS[k] <= 7) &&
      OSM_ROUGHNESS.residential === 7 &&
      OSM_ROUGHNESS.forest === 7 &&
      OSM_ROUGHNESS.farmland === 4 &&
      OSM_ROUGHNESS.grass === 3 &&
      OSM_ROUGHNESS.beach === 2 &&
      mapped.every((k) => k in KB_LAW_OF_OSM) &&
      lawed.length === 25 &&
      KB_LAW_OF_OSM.open.constant === KB_INV_RIGDEN.GRA &&
      KB_LAW_OF_OSM.residential.bluff === 'kanda' &&
      KB_LAW_OF_OSM.beach.bluff === 'brutsaert' &&
      near(KB_LAW_OF_OSM.forest.constant, 0.5) &&
      insidePolygon(sq, 0.5, 0.5) &&
      !insidePolygon(sq, 1.5, 0.5) &&
      !insidePolygon(hole, 0.5, 0.5) &&
      insidePolygon(hole, 0.2, 0.2),
    `(kappa / ln(10 / z0))^2 lands within ${(worst * 100).toFixed(1)}% of every printed CD from 0.0014 (sea) to 0.062 (chaotic) - ` +
      `${rows.map((r) => `${r.z0M}: ${r.cd.toFixed(4)}/${r.cdStull}`).join(', ')}; half open, half closed averages ln z0 to ${half.toFixed(4)} m ` +
      `(the geometric mean), nine tenths open to ${skewed.toFixed(4)} m against an arithmetic ${arith.toFixed(3)}; ${mapped.length} painted covers ` +
      `map to classes 2-7 (built and forest 'closed', crops 'roughly open', grass 'open', beaches 'smooth') and every one carries a thermal law; ` +
      `the even-odd test finds a point in a square, not past it, and not in its hole`
  );
}

// ---- THE BLUFF LAW: Rigden's constants and the kilowatt finding ----
{
  const z0 = 1;
  const reOf = (u) => (u * z0) / NU_AIR;
  const kb05K = kbInvBluff(z0, 0.5, KB_BLUFF_C1.kanda);
  const kb05B = kbInvBluff(z0, 0.5, KB_BLUFF_C1.brutsaert);
  const byHand = (c1, u) => c1 * Math.pow(reOf(u), 0.25) - 2;
  const rising = kbInvBluff(z0, 0.8) > kbInvBluff(z0, 0.4);
  const met = {
    uMs: 3.5,
    zuM: 10,
    taC: 27.8,
    ztM: 2,
    tsC: 31.4,
    pPa: 101300,
    rhFrac: 0.5,
    bliM: 1000
  };
  const sens = kbSensitivity({...met, z0M: 1}, [
    KB_INV_RIGDEN.ALL,
    (u) => kbInvBluff(1, u, KB_BLUFF_C1.kanda),
    (u) => kbInvBluff(1, u, KB_BLUFF_C1.brutsaert)
  ]);
  const grass = landBulk({...met, z0M: 0.03, kbInv: KB_INV_RIGDEN.GRA});
  const lawGrass = kbInvOfLaw(KB_LAW_OF_OSM.grass, 0.03, 0.3);
  const lawBuilt = kbInvOfLaw(KB_LAW_OF_OSM.residential, 1, 0.5);
  const lawNone = kbInvOfLaw(null, 1, 0.5);
  check(
    'THE BLUFF LAW: kB^-1 = C1 Re*^0.25 - 2 by hand, rising with u*; a constant over built ground returns kilowatts, the law tens to hundreds',
    KB_INV_RIGDEN.SHR === 3.5 &&
      KB_INV_RIGDEN.GRA === 2.5 &&
      KB_INV_RIGDEN.CRO === 1.75 &&
      KB_INV_RIGDEN.DBF === 0.25 &&
      KB_INV_RIGDEN.ENF === 0.75 &&
      KB_INV_RIGDEN.ALL === 1.75 &&
      KB_BLUFF_C1.brutsaert === 2.46 &&
      KB_BLUFF_C1.kanda === 1.29 &&
      near(kb05K, byHand(1.29, 0.5), 1e-12) &&
      near(kb05B, byHand(2.46, 0.5), 1e-12) &&
      kb05K > 10 &&
      kb05K < 20 &&
      kb05B > 25 &&
      rising &&
      sens.length === 3 &&
      sens[0].kbInv === 1.75 &&
      sens[0].hsbWm2 > 800 &&
      sens[1].hsbWm2 > 30 &&
      sens[1].hsbWm2 < 200 &&
      sens[2].hsbWm2 > 20 &&
      sens[2].hsbWm2 < sens[1].hsbWm2 &&
      sens[0].hsbWm2 / sens[1].hsbWm2 > 8 &&
      sens[1].kbInv > 10 &&
      sens[2].kbInv > sens[1].kbInv &&
      grass.hsbWm2 > 80 &&
      grass.hsbWm2 < 150 &&
      near(lawGrass, 2.5, 1e-12) &&
      near(lawBuilt, byHand(1.29, 0.5), 1e-12) &&
      lawNone === 1.75,
    `over z0 = 1 m at u* 0.5 (Re* ${reOf(0.5).toExponential(2)}) Kanda's C1 gives kB^-1 ${kb05K.toFixed(2)}, Brutsaert's ${kb05B.toFixed(2)}, ` +
      `both rising with u*; the same afternoon (+3.6 K skin, 3.5 m/s) over a suburb: Rigden's all-cover constant 1.75 returns H ${sens[0].hsbWm2.toFixed(0)} W/m^2, ` +
      `Kanda's law (kB^-1 ${sens[1].kbInv.toFixed(1)}) ${sens[1].hsbWm2.toFixed(0)}, Brutsaert's (${sens[2].kbInv.toFixed(1)}) ${sens[2].hsbWm2.toFixed(0)} - ` +
      `the pass's own finding, so built ground takes the law; the grass (0.03 m, GRA 2.5) reads ${grass.hsbWm2.toFixed(0)} W/m^2, ` +
      `u* ${grass.uStar.toFixed(3)}, L ${grass.L.toFixed(1)} m`
  );
}

// ---- THE BULK CLOSURE: the profile returns its inputs; the neutral limit
{
  const met = {
    uMs: 3.5,
    zuM: 10,
    taC: 27.8,
    ztM: 2,
    tsC: 31.4,
    pPa: 101300,
    rhFrac: 0.5,
    bliM: 1000,
    z0M: 0.03,
    kbInv: 2.5
  };
  const mo = landBulk(met);
  const Sgust = Math.sqrt(met.uMs ** 2 + mo.gust ** 2);
  // the flux identity in the module's own frame
  const hById = -mo.rhoA * 1004.7 * KAPPA * mo.uStar * mo.thetaStar;
  // Businger's L from the solved scales
  const tV = (met.taC + 273.15) * (1 + 0.61 * mo.qA);
  const LById =
    (tV * mo.uStar * mo.uStar) /
    (KAPPA * KAPPA * 9.80665 * mo.thetaStar * (1 + 0.61 * mo.qA));
  // the 2-m potential temperature returns the screen's
  const thetaA = met.taC + (9.80665 / 1004.7) * met.ztM;
  const neutral = landBulk({
    ...met,
    tsC: met.taC + (9.80665 / 1004.7) * met.ztM,
    rhFrac: null
  });
  const uNeutral = (KAPPA * met.uMs) / Math.log(met.zuM / met.z0M);
  const stable = landBulk({...met, uMs: 2, taC: 16, tsC: 12});
  check(
    'THE BULK CLOSURE: u(zu) and theta(zt) return the inputs, the flux and L are their own identities, the neutral limit is the log law',
    near(mo.uAt(met.zuM), Sgust, 1e-6) &&
      near(mo.thetaAt(met.ztM), thetaA, 1e-6) &&
      near(mo.tAt(met.ztM), met.taC, 1e-6) &&
      // T(0) is T(z0h): the skin within the profile's psi at z0h/L
      Math.abs(mo.tAt(0) - met.tsC) < 5e-3 &&
      near(mo.hsbWm2, hById, 1e-9) &&
      near(mo.L, LById, 1e-6 * Math.abs(mo.L)) &&
      mo.L < 0 &&
      mo.gust > 0 &&
      mo.z0h === met.z0M * Math.exp(-met.kbInv) &&
      mo.kbInv === 2.5 &&
      mo.iterations < 80 &&
      near(neutral.thetaStar, 0, 1e-9) &&
      !Number.isFinite(neutral.L) &&
      near(neutral.uStar, uNeutral, 1e-9) &&
      neutral.gust === 0 &&
      near(neutral.hsbWm2, 0, 1e-6) &&
      stable.L > 0 &&
      stable.thetaStar > 0 &&
      stable.hsbWm2 < 0 &&
      stable.gust === 0 &&
      stable.tAt(2) > stable.tAt(0) &&
      mo.tAt(2) < mo.tAt(0) &&
      mo.tAt(10) < mo.tAt(2),
    `u(10 m) ${mo.uAt(10).toFixed(4)} = the gust-augmented S ${Sgust.toFixed(4)} m/s, theta(2 m) ${mo.thetaAt(2).toFixed(4)} = the screen's ` +
      `${thetaA.toFixed(4)} C, T(0) the skin; H ${mo.hsbWm2.toFixed(2)} W/m^2 = -rho cp k u* theta* and L ${mo.L.toFixed(2)} m Businger's own; ` +
      `a skin at the screen's potential temperature with dry air solves theta* 0, L infinite, u* ${neutral.uStar.toFixed(4)} = kappa U / ln(zu/z0) ` +
      `${uNeutral.toFixed(4)}, no gust; a 4 K inversion stands stable (L ${stable.L.toFixed(1)} m, H ${stable.hsbWm2.toFixed(1)} W/m^2, the air warming upward)`
  );
}

// ---- FLEAGLE'S TEST AND HIRT'S COEFFICIENT over the eye's metres ----
{
  const met = {
    uMs: 3.5,
    zuM: 10,
    taC: 27.8,
    ztM: 2,
    tsC: 31.4,
    pPa: 101300,
    rhFrac: 0.5,
    bliM: 1000,
    z0M: 0.03,
    kbInv: 2.5
  };
  const mo = landBulk(met);
  const a = autoconvective(mo);
  const cool = autoconvective(landBulk({...met, taC: 16, tsC: 12, uMs: 2}));
  const k = landRefractionK(mo, met.pPa);
  const k0 = landRefractionK(mo, met.pPa, {zA: 0, zB: 100});
  const kByHand = refractionK(
    met.pPa / 100,
    (mo.tAt(2) + mo.tAt(100)) / 2 + 273.15,
    (mo.tAt(100) - mo.tAt(2)) / 98
  );
  const kStd = refractionK(1013.25, 288.15, -0.0065);
  const kNight = landRefractionK(landBulk({...met, taC: 16, tsC: 12, uMs: 2}), met.pPa);
  const contiguous = a.layers.findIndex((l) => !l.super);
  check(
    'FLEAGLE’S TEST AND HIRT’S COEFFICIENT: the film is super-autoconvective from the ground to a stated top; k over the eye’s 2-100 m by hand',
    near(a.rateKm, -AUTOCONVECTIVE_K_PER_M * 1000, 1e-12) &&
      near(a.rateKm, -34.163, 1e-3) &&
      a.layers.length === AUTOCONVECTIVE_LAYERS.length &&
      a.layers[0].super &&
      a.filmTopM !== null &&
      a.filmTopM > 2 &&
      a.filmTopM < 100 &&
      contiguous > 0 &&
      a.filmTopM === a.layers[contiguous - 1].zB &&
      a.layers.every((l, i) => i === 0 || l.lapseKm > a.layers[i - 1].lapseKm || !l.super) &&
      cool.filmTopM === null &&
      cool.layers.every((l) => !l.super) &&
      near(k, kByHand, 1e-12) &&
      k0 < k &&
      k < kStd &&
      kNight > kStd,
    `the afternoon film's lapse runs ${a.layers.map((l) => `${l.zA}-${l.zB} m ${l.lapseKm.toFixed(0)}`).join(', ')} K/km against Fleagle's ` +
      `${a.rateKm.toFixed(2)}: super-autoconvective to ${a.filmTopM} m (the inferior mirage's film), the night inversion nowhere; ` +
      `Hirt's k over 2-100 m ${k.toFixed(4)} by hand (the standard lapse's ${kStd.toFixed(4)} above it - the hot ground bends rays up), ` +
      `over 0-100 m ${k0.toFixed(4)} (the steepest metres pull it down), the night's ${kNight.toFixed(4)} above the standard (rays bend down: looming)`
  );
}

// ---- THE COMPOSED COLUMN under the fixture's ascent -------------------
{
  const met = {
    uMs: 3.5,
    zuM: 10,
    taC: 27.8,
    ztM: 2,
    tsC: 31.4,
    pPa: 101300,
    rhFrac: 0.5
  };
  const col = landColumnRows(SOUNDING.rows, met, {
    z0M: 0.03,
    kbInv: 2.5,
    h0M: 20,
    bliM: null
  });
  const rows = col ? col.rows : [];
  const land = rows.filter((r) => r.src === 'land');
  const mixed = rows.filter((r) => r.src === 'mixed');
  const balloon = rows.filter((r) => r.src === 'balloon');
  const mono = rows.every(
    (r, i) => i === 0 || (r.hM > rows[i - 1].hM && r.p < rows[i - 1].p)
  );
  const hb = SOUNDING.rows[0].hM;
  const firstBalloon = balloon[0];
  const sameAbove = balloon.every((r) =>
    SOUNDING.rows.some((q) => Math.abs(q.hM - r.hM) < 1e-9 && q.tC === r.tC)
  );
  // the hydrostatic step between the film's first two rows by hand
  const r0 = rows[0];
  const r1 = rows[1];
  const pByHand =
    r0.p *
    Math.exp(
      (-(r1.hM - r0.hM) * 9.80665) /
        (287.053 * ((r0.tC + r1.tC) / 2 + 273.15))
    );
  const noAscent = landColumnRows(SOUNDING.rows.slice(0, 3), met, {h0M: 20});
  const short = landColumnRows(SOUNDING.rows, met, {h0M: 20, topM: 30});
  // the census as the page runs it: no painted cover falls to 'open'
  const c = roughnessCensus(null, 32.85, -117.12, {radiusM: 1000, n: 41});
  const sq = (lat, lon, h) => [
    [
      [lat - h, lon - h],
      [lat - h, lon + h],
      [lat + h, lon + h],
      [lat + h, lon - h]
    ]
  ];
  const c2 = roughnessCensus(
    [
      {cls: 'forest', rings: sq(32.86, -117.11, 0.006), area: 2},
      {cls: 'residential', rings: sq(32.85, -117.12, 0.0027), area: 1}
    ],
    32.85,
    -117.12,
    {radiusM: 1000, n: 41}
  );
  const fracSum = c2.covers.reduce((s, x) => s + x.frac, 0);
  const z0ByHand = Math.exp(
    c2.covers.reduce((s, x) => s + x.frac * Math.log(x.z0M), 0)
  );
  const kbByHand = c2.covers.reduce(
    (s, x) => s + x.frac * kbInvOfLaw(x.law, x.z0M, 0.5),
    0
  );
  check(
    'THE COMPOSED COLUMN: the film from the eye’s ground, the modelled band to the balloon’s inversion, the ascent above; the census as the page runs it',
    col !== null &&
      col.h0M === 20 &&
      col.pSurfPa === 101300 &&
      near(rows[0].tC, met.tsC, 1e-3) &&
      rows[0].hM === 20 &&
      rows[0].src === 'land' &&
      land.length >= 10 &&
      land[land.length - 1].hM === 20 + col.filmTopM &&
      col.filmTopM === 100 &&
      mixed.length > 3 &&
      col.modelBand !== null &&
      col.modelBand[0] === 120 &&
      col.modelBand[1] === col.joinM &&
      firstBalloon.hM === col.joinM &&
      col.joinM > hb + 30 &&
      sameAbove &&
      mono &&
      near(r1.p, pByHand, 1e-9) &&
      noAscent === null &&
      short !== null &&
      short.filmTopM === 30 &&
      c.sampled > 1000 &&
      c.covers.length === 1 &&
      c.covers[0].osm === 'open' &&
      near(c.z0M, davenportClass(3).z0M, 1e-12) &&
      near(c.kbInvAt(0.3), KB_INV_RIGDEN.GRA, 1e-12) &&
      c.bluffFrac === 0 &&
      c.dominant.name === 'open' &&
      c2.sampled === c.sampled &&
      c2.covers.length === 3 &&
      c2.covers[0].osm === 'open' &&
      c2.byOsm.residential > 100 &&
      c2.byOsm.forest > 30 &&
      near(fracSum, 1, 1e-12) &&
      near(c2.z0M, z0ByHand, 1e-12) &&
      near(c2.kbInvAt(0.5), kbByHand, 1e-12) &&
      c2.bluffFrac > 0.1 &&
      c2.bluffFrac < 0.2 &&
      c2.kbInvAt(0.8) > c2.kbInvAt(0.3),
    `${rows.length} rows: ${land.length} of the film from ${rows[0].hM} m (the skin ${rows[0].tC.toFixed(1)} C) to ${land[land.length - 1].hM} m, ` +
      `${mixed.length} modelled to the balloon's inversion base at ${col.joinM} m (the band ${col.modelBand.join('-')} m no closure may lean on), ` +
      `${balloon.length} of the ascent above unchanged; every row above the last in height and below it in pressure, the first step hydrostatic by hand; ` +
      `a three-row ascent declines, a 30-m film keeps its top; the census with nothing painted samples ${c.sampled} points of the square kilometre as 'open' ` +
      `(z0 ${c.z0M} m, kB^-1 ${c.kbInvAt(0.3)}), with a residential square and a forest corner ${c2.covers.map((x) => `${x.osm} ${(x.frac * 100).toFixed(0)}%`).join(', ')} ` +
      `- z0 ${c2.z0M.toFixed(4)} m by the Guide's ln-average and kB^-1 ${c2.kbInvAt(0.5).toFixed(2)} at u* 0.5 by hand, ${(c2.bluffFrac * 100).toFixed(0)}% under the bluff law`
  );
}

process.exit(fail ? 1 : 0);
