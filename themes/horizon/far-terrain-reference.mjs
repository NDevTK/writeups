// Reference printer for the far horizon (node
// far-terrain-reference.mjs). Ground truth for the ring that
// carries the view from the box edge to the geometric horizon:
//  - the refraction coefficient formula (Hirt et al. 2010, JGR
//    115, D21102) at the standard atmosphere REPRODUCES the
//    classic 1/6 curvature rule within 3% - the textbook value
//    emerges from the published formula, it is never assumed
//  - the curvature drop closed-form (785 m at 100 km, k=0) and
//    the refraction correction direction (k>0 shrinks the drop)
//  - seam continuity: at the box edge the ring vertex reads the
//    SAME y the box's own datum compression gives that elevation,
//    and the flat-box-meets-curved-world step subtends < 1 px
//  - a real case: Mt Arthur (1795 m) seen from Nelson across
//    ~35 km of Tasman Bay clears the horizon by the closed-form
//    apparent height; the drop hides the first ~96 m of it
import {
  apparentPrimary,
  branchCount,
  curvatureDrop,
  fanBranches,
  farRadii,
  farRingBaseY,
  farRingGeometry,
  kappaTable,
  koschmiederT,
  R_EARTH,
  rayFan,
  refractionK
} from './far-terrain.js';
import {buildProfile, standardProfile} from './refraction.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // Standard atmosphere -> the classic rule emerges.
  const k = refractionK(1013.25, 288.15, -0.0065);
  const ratio = k / (1 / 6);
  check(
    'refraction coefficient',
    Math.abs(k - 0.1706) < 5e-4 && Math.abs(ratio - 1) < 0.03,
    `Hirt et al. 2010 at the standard atmosphere: k = ${k.toFixed(4)} - within ${((ratio - 1) * 100).toFixed(1)}% of the classic 1/6 curvature rule (never assumed)`
  );
  // A strong measured inversion (dT/dh > 0) raises k - looming.
  const kInv = refractionK(1013.25, 278.15, +0.02);
  check(
    'inversion raises k',
    kInv > 0.3 && refractionK(1013.25, 288.15, -0.01) < k,
    `+20 mK/m inversion at 5 C gives k = ${kInv.toFixed(3)} (looming); a steeper lapse lowers k - the measured column drives it`
  );
}

{
  // Curvature drop closed-form: d^2/2R = 784.8 m at 100 km (k=0);
  // k = 0.17 stretches the effective radius and shrinks it.
  const d0 = curvatureDrop(100e3, 0);
  const dk = curvatureDrop(100e3, 0.17);
  const want = (100e3 * 100e3) / (2 * R_EARTH);
  check(
    'curvature drop',
    Math.abs(d0 - want) < 1e-9 && Math.abs(dk - want * 0.83) < 1e-9,
    `${d0.toFixed(1)} m at 100 km bare Earth; k = 0.17 shrinks it to ${dk.toFixed(1)} m (exactly (1-k) x)`
  );
}

{
  // Seam continuity + datum identity on a synthetic dome of
  // elevation: the ring's first radius (box edge) must read
  // EXACTLY the box's own compression of (e - drop - datum).
  const mpu = 400 / 7;
  const centerElev = 300;
  const elevAt = (x, z) => 300 + 0.5 * Math.hypot(x, z);
  const k = 0.17;
  const radii = farRadii(150, 3500, 44);
  const g = farRingGeometry({
    radiiU: radii,
    nAz: 8,
    mpu,
    centerElev,
    k,
    elevAt
  });
  let worst = 0;
  for (let ai = 0; ai < 8; ai++) {
    const az = (ai / 8) * 2 * Math.PI;
    const x = Math.sin(az) * radii[0];
    const z = -Math.cos(az) * radii[0];
    const e = elevAt(x, z) - curvatureDrop(radii[0] * mpu, k);
    const want = 16 * Math.asinh((e - centerElev) / 500);
    worst = Math.max(worst, Math.abs(g.positions[ai * 3 + 1] - want));
  }
  // The box draws its 8 km flat (no in-box curvature), so the
  // ring's first radius sits drop(edge) BELOW the adjacent box
  // terrain - a ~4.8 m step at 8.5 km. The invariant that
  // matters is ANGULAR: the step subtends well under one pixel
  // (0.057 deg/px at the theme's 55 deg / 960 px).
  const drop0 = curvatureDrop(radii[0] * mpu, k);
  const stepDeg = (Math.atan(drop0 / (radii[0] * mpu)) * 180) / Math.PI;
  check(
    'seam continuity',
    worst < 1e-6 && stepDeg < 0.057 && g.positions.length === 44 * 8 * 3,
    `box-edge ring vertices reproduce the box datum compression to ${worst.toExponential(1)}; the flat-box-meets-curved-world step is ${drop0.toFixed(2)} m = ${stepDeg.toFixed(3)} deg - inside one pixel`
  );
  // Index sanity: full wrap, every index in range (the all-land
  // dome drops nothing).
  let ok = g.indices.length === 43 * 8 * 6;
  for (const i of g.indices) if (i >= 44 * 8) ok = false;
  check(
    'ring topology',
    ok,
    `${g.indices.length / 3} triangles wrap ${44} rings x ${8} spokes with every index in range`
  );
  // Open sea is NOT drawn - the sky-view LUT's Payne-lit horizon
  // IS the far sea; the ring only adds land. An island fixture:
  // one azimuth quadrant carries 500 m, the rest is water.
  // Sea-only triangles vanish, every kept triangle touches land
  // (shorelines meet the water without gaps).
  // The water carries real terrarium BATHYMETRY (-80 m here);
  // shoreline sea corners must sit at the SURFACE, not the seabed.
  const isle = farRingGeometry({
    radiiU: radii,
    nAz: 8,
    mpu,
    centerElev,
    k,
    elevAt: (x, z) => (x > 0 && z > 0 ? 500 : -80)
  });
  let touchLand = true;
  for (let t = 0; t < isle.indices.length; t += 3) {
    if (
      isle.sea[isle.indices[t]] &&
      isle.sea[isle.indices[t + 1]] &&
      isle.sea[isle.indices[t + 2]]
    )
      touchLand = false;
  }
  let surfOk = true;
  for (let t = 0; t < isle.indices.length; t++) {
    const vi = isle.indices[t];
    if (!isle.sea[vi]) continue;
    const r = radii[Math.floor(vi / 8)];
    const want =
      16 * Math.asinh((0 - curvatureDrop(r * mpu, k) - centerElev) / 500);
    if (Math.abs(isle.positions[vi * 3 + 1] - want) > 1e-5) surfOk = false;
  }
  check(
    'sea not drawn',
    isle.indices.length < g.indices.length &&
      touchLand &&
      isle.indices.length > 0 &&
      surfOk,
    `the island fixture keeps ${isle.indices.length / 3} of ${g.indices.length / 3} triangles - every one touches land, the open water stays the LUT's measured sea, and every kept shoreline sea corner sits at the dropped SURFACE (0 m), never the -80 m seabed`
  );
  // THE LAND'S OWN REFRACTION (157th pass): a coast fixture - sea
  // (-80 m bathymetry) west of the anchor, rising land east of it.
  // The spokes whose inner ring stands on land drop by the land
  // layer's coefficient, the sea spokes by the column's; the base
  // re-solved from the retained elevations (farRingBaseY) is the
  // build's own, bit for bit; without a land coefficient every
  // spoke keeps k, and a new land coefficient moves the land spokes
  // alone.
  const coastAt = (x, z) => (x > 0.5 ? 200 + 0.2 * Math.hypot(x, z) : -80);
  const kLand = 0.05;
  const coast = farRingGeometry({
    radiiU: radii,
    nAz: 8,
    mpu,
    centerElev,
    k,
    elevAt: coastAt,
    kLand
  });
  const plain = farRingGeometry({
    radiiU: radii,
    nAz: 8,
    mpu,
    centerElev,
    k,
    elevAt: coastAt
  });
  const nullLand = farRingGeometry({
    radiiU: radii,
    nAz: 8,
    mpu,
    centerElev,
    k,
    elevAt: coastAt,
    kLand: null
  });
  const marks = Array.from(coast.spokeLand).join('');
  let dropOk = true;
  let landMoved = 0;
  let seaSame = 0;
  for (let v = 0; v < coast.trueEM.length; v++) {
    const ai = v % 8;
    const r = radii[Math.floor(v / 8)];
    const kk = coast.spokeLand[ai] ? kLand : k;
    const want =
      16 *
      Math.asinh(
        (coast.trueEM[v] - curvatureDrop(r * mpu, kk) - centerElev) / 500
      );
    if (Math.abs(coast.positions[v * 3 + 1] - want) > 1e-5) dropOk = false;
    const d = coast.positions[v * 3 + 1] - plain.positions[v * 3 + 1];
    // kLand 0.05 < k 0.17: less refraction lift, so the land SINKS
    if (coast.spokeLand[ai]) {
      if (d < 0) landMoved++;
    } else if (d === 0) seaSame++;
  }
  const base = farRingBaseY({
    trueEM: coast.trueEM,
    distU: coast.distU,
    spokeLand: coast.spokeLand,
    nAz: 8,
    mpu,
    centerElev,
    k,
    kLand
  });
  const baseNull = farRingBaseY({
    trueEM: coast.trueEM,
    distU: coast.distU,
    spokeLand: coast.spokeLand,
    nAz: 8,
    mpu,
    centerElev,
    k,
    kLand: null
  });
  let maxBase = 0;
  let maxNull = 0;
  let maxPlainNull = 0;
  for (let v = 0; v < base.length; v++) {
    maxBase = Math.max(maxBase, Math.abs(base[v] - coast.positions[v * 3 + 1]));
    maxNull = Math.max(
      maxNull,
      Math.abs(baseNull[v] - plain.positions[v * 3 + 1])
    );
    maxPlainNull = Math.max(
      maxPlainNull,
      Math.abs(nullLand.positions[v * 3 + 1] - plain.positions[v * 3 + 1])
    );
  }
  const nLandSp = coast.spokeLand.reduce((s, b) => s + b, 0);
  const nLandV = (coast.trueEM.length / 8) * nLandSp;
  const nSeaV = coast.trueEM.length - nLandV;
  check(
    'the land spokes drop by the land coefficient (per spoke)',
    marks === '01110000' &&
      nLandSp === 3 &&
      dropOk &&
      landMoved === nLandV &&
      seaSame === nSeaV &&
      // the retained elevation is Float32: the re-solve differs from
      // the build by that rounding alone (one ulp of the datum)
      maxBase < 4e-6 &&
      maxNull < 4e-6 &&
      maxPlainNull === 0 &&
      base.length === coast.trueEM.length,
    `the coast fixture marks spokes ${marks} land at their inner ring (east of the anchor); every land vertex drops by k ${kLand} ` +
      `and every sea vertex by k ${k} to the build's datum - all ${landMoved} land vertices sit LOWER than under k ${k} (the smaller ` +
      `coefficient is less refraction lift: the hot land's ground sinks), the ${seaSame} sea vertices unmoved; farRingBaseY reproduces ` +
      `the build's y to the retained Float32 elevation's own rounding (max diff ${maxBase.toExponential(1)} in the datum), with kLand null ` +
      `the plain build's (${maxNull.toExponential(1)}), and a build handed kLand null is the plain build (${maxPlainNull})`
  );
}

{
  // The real case: Mt Arthur (1795 m) from Nelson harbour
  // (observer ~2 m) across ~35 km. Apparent height above the
  // horizontal = e - drop; the drop at 35 km (k = 0.1706) eats
  // 96 m x (1-k) ... closed form checked both ways.
  const k = refractionK(1013.25, 288.15, -0.0065);
  const drop = curvatureDrop(35e3, k);
  const bare = (35e3 * 35e3) / (2 * R_EARTH);
  const apparent = 1795 - drop;
  check(
    'Mt Arthur across the bay',
    Math.abs(bare - 96.1) < 0.2 && drop < bare && apparent > 1700,
    `35 km of Tasman Bay drops the horizon ${bare.toFixed(1)} m bare / ${drop.toFixed(1)} m refracted - Mt Arthur still stands ${apparent.toFixed(0)} m proud (it IS visible from Nelson, and the ring will draw it)`
  );
}

{
  // The horizon fade uses the BOX's own fog curve (aerial-tsl:
  // exp(-(1.98 d/V)^2)) so the seam cannot step, and the curve
  // still lands on Koschmieder's 2% contrast at exactly V.
  const t = koschmiederT(20e3, 20e3);
  const mid = koschmiederT(10e3, 20e3);
  check(
    'Koschmieder calibration',
    Math.abs(t - Math.exp(-1.98 * 1.98)) < 1e-12 &&
      Math.abs(t - 0.0198) < 3e-4 &&
      Math.abs(mid - Math.exp(-0.99 * 0.99)) < 1e-12,
    `T(V) = e^-3.9204 = ${t.toFixed(5)} (Koschmieder's 2% at exactly V) and the half-distance value ${mid.toFixed(4)} IS the box fog's - the seam cannot step`
  );
}

// ---- The terrestrial ray fan: the mirage machinery --------------
{
  const DEG = Math.PI / 180;
  const prof = standardProfile();
  const alphas = [];
  for (let i = 0; i <= 600; i++) alphas.push((-1.4 + (i * 2.2) / 600) * DEG);
  const fan = rayFan(prof, 50, alphas, 200e3, 100);
  const kStd = refractionK(1013.25, 288.15, -0.0065);
  const diffAt = (dKm, eM) => {
    const br = fanBranches(fan, dKm * 1e3, eM);
    if (!br.length) return null;
    return (
      50 + dKm * 1e3 * Math.tan(br[0]) - (eM - curvatureDrop(dKm * 1e3, kStd))
    );
  };
  const d20 = diffAt(20, 0);
  const d40 = diffAt(40, 300);
  const d180 = diffAt(180, 2600);
  check(
    'Hirt-k EMERGES from the ray fan',
    Math.abs(d20) < 0.5 && Math.abs(d40) < 1 && d180 < 0 && Math.abs(d180) < 25,
    `h'' = 1/R - kappa(h) through the standard column lands ` +
      `${Math.abs(d20).toFixed(2)} m from the Hirt-k parabola at 20 km and ` +
      `${Math.abs(d40).toFixed(2)} m at 40 km - the mean-k model IS the ` +
      `uniform-kappa limit; at 180 km the fan draws ${(-d180).toFixed(1)} m ` +
      `LOWER because the long ray samples thinner air aloft where kappa ` +
      `falls - physics the parabola cannot know, in the physical direction`
  );
  // THE PAGE'S OWN CALL FORM (157th pass): the ring hands the fan a
  // Float64Array of launch angles. A typed array's .map returns a
  // typed array, so the rows came back as NaN and the march's first
  // write threw - every page probe with a measured column had logged
  // it since the 99th pass, caught and silent. The fan must march the
  // same rows from either list, bit for bit.
  {
    const fanT = rayFan(prof, 50, Float64Array.from(alphas), 200e3, 100);
    let same =
      fanT.hs.length === fan.hs.length && fanT.hs[0] instanceof Float32Array;
    let maxD = 0;
    for (let i = 0; same && i < fan.hs.length; i++)
      for (let j = 0; j < fan.hs[i].length; j++) {
        const a = fan.hs[i][j];
        const b = fanT.hs[i][j];
        if (Number.isNaN(a) !== Number.isNaN(b)) same = false;
        else if (!Number.isNaN(a)) maxD = Math.max(maxD, Math.abs(a - b));
      }
    const brT = fanBranches(fanT, 20e3, 0);
    const brA = fanBranches(fan, 20e3, 0);
    check(
      "the fan marches typed-array launch angles (the page's call)",
      same && maxD === 0 && brT.length === brA.length && brT[0] === brA[0],
      `${fanT.hs.length} rows of Float32Array from a Float64Array of alphas, ` +
        `every height and every NaN identical to the plain-array march ` +
        `(max |diff| ${maxD}), the 20-km branch ${((brT[0] * 180) / Math.PI).toFixed(4)} deg ` +
        `either way - the ring's fan was the one caller handing a typed array`
    );
  }
  // The classical superior-mirage column: +6 degC across 30-60 m
  // over a cold sea, eye at 15 m, targets low and far.
  const profInv = buildProfile(
    [
      {pPa: 101000, hM: 30, tC: 4, rh: 0.8},
      {pPa: 100650, hM: 60, tC: 10, rh: 0.6},
      {pPa: 100000, hM: 120, tC: 9.5, rh: 0.6},
      {pPa: 95000, hM: 550, tC: 7, rh: 0.6},
      {pPa: 80000, hM: 1900, tC: -1, rh: 0.5}
    ],
    {hM: 0, tC: 4, rh: 0.8}
  );
  const kt = kappaTable(profInv, 400, 1);
  const over = [];
  for (let i = 0; i < kt.n; i++)
    if (kt.kap[i] > 1 / R_EARTH) over.push(kt.h0 + i * kt.dhM);
  check(
    'the duct criterion DERIVES',
    over.length > 20 && over[0] >= 30 && over[over.length - 1] <= 60,
    `kappa > 1/R exactly across the inversion (${over[0]}-` +
      `${over[over.length - 1]} m, ${over.length} rows) - the classical ` +
      `super-refraction threshold (dN/dh < -157 N/km) is nothing but ` +
      `kappa = 1/R, derived from the gated Ciddor chain, never quoted`
  );
  const alphas2 = [];
  for (let i = 0; i <= 1200; i++)
    alphas2.push((-0.35 + (i * 0.7) / 1200) * DEG);
  const fan2 = rayFan(profInv, 15, alphas2, 150e3, 50);
  const img80 = fanBranches(fan2, 80e3, 20);
  const img50 = fanBranches(fan2, 50e3, 20);
  const img110 = fanBranches(fan2, 110e3, 40);
  check(
    'the superior mirage stacks and the skip zone empties',
    img80.length === 2 &&
      Math.abs(img80[0] / DEG - -0.0417) < 0.005 &&
      Math.abs(img80[1] / DEG - 0.0584) < 0.005 &&
      img50.length === 0 &&
      img110.length === 2 &&
      img110[1] - img110[0] < 0.03 * DEG,
    `an 80 km target at 20 m shows TWO images (${(img80[0] / DEG).toFixed(4)} ` +
      `and ${(img80[1] / DEG).toFixed(4)} deg - erect below, ducted above); ` +
      `at 50 km NO ray reaches it at any tested height - the classical ` +
      `SKIP ZONE of ducted propagation, emerging unprompted; at 110 km the ` +
      `pair compresses to ${(((img110[1] - img110[0]) / DEG) * 60).toFixed(1)} ` +
      `arcmin - the Novaya-Zemlya squeeze`
  );
  check(
    'fan honesty and the crossing utilities',
    fanBranches(fan2, 80e3, 1).length === 0 &&
      apparentPrimary([0, 1, 2], [5, 3, 1], 4) === 0.5 &&
      branchCount([0, 1, 2, 3], [0, 2, 0, 2], 1) === 3,
    `a target below every surviving ray is HIDDEN (empty, not invented); ` +
      `the crossing solver interpolates exactly and counts every fold`
  );
}

process.exit(fail ? 1 : 0);
