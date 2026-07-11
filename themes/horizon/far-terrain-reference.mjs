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
  curvatureDrop,
  farRadii,
  farRingGeometry,
  koschmiederT,
  R_EARTH,
  refractionK
} from './far-terrain.js';

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
  const isle = farRingGeometry({
    radiiU: radii,
    nAz: 8,
    mpu,
    centerElev,
    k,
    elevAt: (x, z) => (x > 0 && z > 0 ? 500 : 0)
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
  check(
    'sea not drawn',
    isle.indices.length < g.indices.length &&
      touchLand &&
      isle.indices.length > 0,
    `the island fixture keeps ${isle.indices.length / 3} of ${g.indices.length / 3} triangles - every one touches land, the open water is left to the LUT's measured sea`
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
  // Koschmieder at the measured visibility: T at exactly V is
  // e^-3.912 = the 2% contrast threshold that DEFINES V.
  const t = koschmiederT(20e3, 20e3);
  check(
    'Koschmieder identity',
    Math.abs(t - Math.exp(-3.912)) < 1e-12 && Math.abs(t - 0.02) < 0.0002,
    `T(V) = e^-3.912 = ${t.toFixed(5)} - the 2% contrast threshold that defines meteorological visibility`
  );
}

process.exit(fail ? 1 : 0);
