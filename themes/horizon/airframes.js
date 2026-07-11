/**
 * airframes.js - the aircraft geometry, the aerial twin of vessels.js:
 * designed once and shared by the theme (Horizon.html) and the asset
 * viewer (harness/asset-viewer.html) so the shapes are ITERATED ON
 * VISUALLY in isolation and shipped identically.
 *
 * Everything scales from the MEASURED airframe identity (aircraft.js,
 * from the ADS-B ICAO type): the wingspan and length set the planform,
 * the body class picks the arrangement - a widebody's fat fuselage and
 * two big underwing engines, a heavy quad's four, a bizjet's aft-mounted
 * pair and T-tail, a turboprop's straight high wings and prop discs, a
 * light single's nose prop, a helicopter's rotor disc and tail boom.
 * Nose points local -z, up is +y, wings span +/-x (the frame the scene
 * orients by track). Each wing is a sub-group pivoted AT THE ROOT so it
 * sweeps aft while staying attached to the fuselage, and its engines
 * ride as children so they hang under the swept wing. Absolute size is
 * visibility-scaled by the caller's U, but the wingspan:length RATIO and
 * the arrangement are the real aircraft's, so an A380 dwarfs a Cessna
 * and the TYPE reads honestly.
 *
 * Materials are the CALLER's (the theme applies its aerial-fog tone
 * hook; the viewer uses plain ones): {body, wing, engine, glass, prop} -
 * see makeAircraftMaterials.
 */

import {
  CylinderGeometry,
  BoxGeometry,
  ConeGeometry,
  Group,
  Mesh
} from 'three/webgpu';

// Fuselage radius as a fraction of length, per class.
const FUSELAGE_R = {
  narrowbody: 0.05,
  widebody: 0.07,
  heavy_quad: 0.075,
  regional_jet: 0.045,
  turboprop: 0.045,
  bizjet: 0.05,
  ga_piston: 0.075,
  helicopter: 0.12
};

// Wing sweep (radians, tip goes aft) - jets swept, props/GA straight.
const SWEEP = {
  narrowbody: 0.42,
  widebody: 0.5,
  heavy_quad: 0.52,
  regional_jet: 0.32,
  turboprop: 0.04,
  bizjet: 0.48,
  ga_piston: 0.0,
  helicopter: 0.0
};

const box = (group, w, h, d, mat, x, y, z, ry = 0) => {
  const m = new Mesh(new BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  group.add(m);
  return m;
};

// A cylinder laid along z (nose-tail), tapering front->back radius.
const tubeZ = (group, rF, rB, len, mat, x, y, z) => {
  const m = new Mesh(new CylinderGeometry(rF, rB, len, 14), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  group.add(m);
  return m;
};

// A flat disc (prop/rotor); faceY = horizontal disc (rotor), else faces
// along z (prop).
const disc = (group, r, thick, mat, x, y, z, faceY = false) => {
  const m = new Mesh(new CylinderGeometry(r, r, thick, 20), mat);
  if (!faceY) m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  group.add(m);
  return m;
};

// A cone pointing along -z (nose) or +z (tail).
const cone = (group, r, len, mat, x, y, z, forward) => {
  const m = new Mesh(new ConeGeometry(r, len, 14), mat);
  m.rotation.x = forward ? -Math.PI / 2 : Math.PI / 2;
  m.position.set(x, y, z);
  group.add(m);
  return m;
};

// A wing (or stabiliser) as a root-pivoted sub-group: it sweeps about
// the fuselage attachment so the tip trails but the root stays put.
// Returns the group so the caller can hang engines under it.
function wing(
  parent,
  side,
  rootX,
  rootY,
  rootZ,
  spanU,
  chordU,
  thick,
  mat,
  sweep,
  dihedral = 0.04
) {
  const g = new Group();
  g.position.set(rootX, rootY, rootZ);
  g.rotation.y = -side * sweep;
  g.rotation.z = side * dihedral; // slight upward dihedral
  const m = new Mesh(new BoxGeometry(spanU, thick, chordU), mat);
  // taper the tip by nudging it thinner is overkill; a plain panel reads
  // fine at scene scale. Extend outboard from the root pivot.
  m.position.set(side * (spanU / 2), 0, 0);
  g.add(m);
  parent.add(g);
  return g;
}

// Build an aircraft of the given identity into `group`. dims is the
// aircraft.js record {wingspanM, lengthM, engines, mount, cls, ...};
// U is scene units per metre (already visibility-scaled). Returns
// {L, W} in scene units.
export function buildAircraft(group, dims, mats, hash = 0, U = 1) {
  const cls = dims.cls;
  const W = dims.wingspanM * U;
  const L = dims.lengthM * U;
  const rF = (FUSELAGE_R[cls] || 0.05) * L;
  const sweep = SWEEP[cls] ?? 0.4;

  if (cls === 'helicopter') {
    // Rounded fuselage pod, tapering tail boom, a clearly-visible main
    // rotor disc on a short mast, a tail rotor and landing skids.
    tubeZ(group, rF, rF * 0.8, L * 0.55, mats.body, 0, 0, -L * 0.05);
    cone(group, rF, L * 0.22, mats.glass, 0, rF * 0.1, -L * 0.34, true); // nose canopy
    tubeZ(
      group,
      rF * 0.22,
      rF * 0.1,
      L * 0.6,
      mats.body,
      0,
      rF * 0.35,
      L * 0.38
    ); // boom
    box(
      group,
      rF * 0.14,
      rF * 0.9,
      rF * 0.14,
      mats.engine,
      0,
      rF * 0.85,
      -L * 0.02
    ); // mast
    disc(group, W / 2, rF * 0.05, mats.prop, 0, rF * 1.35, -L * 0.02, true); // main rotor
    disc(group, W * 0.13, rF * 0.05, mats.prop, rF * 0.25, rF * 0.5, L * 0.64); // tail rotor
    box(
      group,
      rF * 1.8,
      rF * 0.05,
      L * 0.42,
      mats.engine,
      0,
      -rF * 0.95,
      -L * 0.05
    ); // skids
    return {L, W};
  }

  // ---- fixed wing ----
  const highWing = cls === 'turboprop' || cls === 'ga_piston';
  // Fuselage: a tube with a short nose cone and an up-swept tail cone.
  tubeZ(group, rF, rF, L * 0.74, mats.body, 0, 0, 0);
  cone(group, rF, L * 0.1, mats.body, 0, 0, -L * 0.42, true);
  cone(group, rF, L * 0.16, mats.body, 0, rF * 0.55, L * 0.42, false);
  box(group, rF * 1.05, rF * 0.5, rF * 0.9, mats.glass, 0, rF * 0.4, -L * 0.32); // windshield

  // Wings, root-pivoted so they sweep but stay attached. Engines hang
  // as children so they follow the sweep.
  const halfSpan = W / 2 - rF * 0.4;
  const chord = L * (highWing ? 0.1 : 0.12);
  const wingY = highWing ? rF * 0.75 : -rF * 0.45;
  const wingZ = highWing ? -L * 0.03 : L * 0.03;
  const engines = dims.engines;
  const wingMount = dims.mount === 'wing';
  for (const s of [-1, 1]) {
    const wg = wing(
      group,
      s,
      s * rF * 0.4,
      wingY,
      wingZ,
      halfSpan,
      chord,
      rF * 0.12,
      mats.wing,
      sweep
    );
    // Engines / props under this wing (local coords: x outboard from
    // root, z forward = -).
    if (cls === 'turboprop') {
      const ex = halfSpan * 0.42;
      tubeZ(
        wg,
        rF * 0.3,
        rF * 0.24,
        L * 0.13,
        mats.engine,
        ex,
        -rF * 0.1,
        -chord * 0.5
      );
      disc(
        wg,
        rF * 0.95,
        rF * 0.04,
        mats.prop,
        ex,
        -rF * 0.1,
        -chord * 0.5 - L * 0.09
      );
    } else if (wingMount) {
      const perSide = engines >= 4 ? 2 : 1;
      const er =
        rF * (cls === 'widebody' || cls === 'heavy_quad' ? 0.46 : 0.34);
      for (let k = 0; k < perSide; k++) {
        const ex = halfSpan * (perSide === 1 ? 0.4 : 0.3 + k * 0.32);
        tubeZ(
          wg,
          er,
          er * 0.82,
          L * 0.15,
          mats.engine,
          ex,
          -er - rF * 0.12,
          -chord * 0.35
        );
      }
    }
  }

  // GA nose prop.
  if (cls === 'ga_piston') {
    tubeZ(group, rF * 0.55, rF * 0.4, L * 0.12, mats.body, 0, 0, -L * 0.42);
    disc(group, rF * 1.1, rF * 0.05, mats.prop, 0, 0, -L * 0.49);
  }

  // Aft-fuselage engines (bizjet / CRJ) on the rear sides.
  if (!wingMount && cls !== 'ga_piston') {
    const er = rF * 0.42;
    for (const s of [-1, 1])
      tubeZ(
        group,
        er,
        er * 0.82,
        L * 0.14,
        mats.engine,
        s * rF * 1.25,
        rF * 0.55,
        L * 0.26
      );
  }

  // Tail: a swept vertical fin sitting on the aft fuselage + horizontal
  // stabilisers (T-tail on bizjets).
  const finH = rF * (cls === 'heavy_quad' || cls === 'widebody' ? 2.4 : 2.6);
  const finZ = L * 0.38;
  const fin = new Group();
  fin.position.set(0, rF * 0.6, finZ);
  fin.rotation.x = -0.5; // rake the fin aft
  // the vertical fin carries the airline's tail colour (the surface a
  // spotter reads); stabilisers stay in the wing tone
  box(fin, rF * 0.14, finH, L * 0.12, mats.tail || mats.wing, 0, finH / 2, 0);
  group.add(fin);
  const tTail = cls === 'bizjet';
  const stabY = tTail ? rF * 0.6 + finH * 0.92 : rF * 0.5;
  const stabZ = tTail ? finZ + finH * 0.5 : L * 0.4;
  for (const s of [-1, 1])
    wing(
      group,
      s,
      s * rF * 0.3,
      stabY,
      stabZ,
      W * 0.17,
      L * 0.07,
      rF * 0.09,
      mats.wing,
      sweep * 0.5,
      0
    );

  return {L, W};
}

// A small material set in the caller's material class. tint (0..1)
// nudges the fuselage brightness so a fleet is not uniform. opts.livery
// (airline.js {tail, fuselage}) paints the tail fin the airline's brand
// colour - and its fuselage where the carrier's is not white - so a
// plane reads by its airline; without it the airframe is neutral light.
export function makeAircraftMaterials(MaterialClass, opts = {}) {
  const tint = opts.tint ?? 0;
  const g = 0.82 - tint * 0.16;
  const mk = (r, gr, b, o) => {
    const m = new MaterialClass();
    if (m.color && m.color.setRGB) m.color.setRGB(r, gr, b);
    if (o != null && 'opacity' in m) {
      m.opacity = o;
      m.transparent = true;
    }
    return m;
  };
  const lv = opts.livery || null;
  const body =
    lv && lv.fuselage
      ? mk(lv.fuselage[0], lv.fuselage[1], lv.fuselage[2])
      : mk(g, g, g * 1.02);
  const tail =
    lv && lv.tail
      ? mk(lv.tail[0], lv.tail[1], lv.tail[2])
      : mk(g * 0.92, g * 0.92, g * 0.96);
  return {
    body,
    wing: mk(g * 0.92, g * 0.92, g * 0.96),
    tail,
    engine: mk(0.3, 0.31, 0.34),
    glass: mk(0.1, 0.14, 0.22),
    prop: mk(0.22, 0.22, 0.24, 0.5)
  };
}
