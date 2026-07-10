/**
 * windmills.js - the wind-turbine silhouettes, in the vessels.js
 * mould: a shared visual module (three import allowed here, never
 * node-imported) both the theme and the asset viewer render, so
 * the shapes are designed once in the viewer loop and shipped
 * identically. The MEASURED identity comes from turbines.js: the
 * spec ladder sets rotor diameter, hub height, and where the
 * sheet publishes them the nacelle box (V90: 10.4 x 3.4 x 4 m)
 * and blade length/chord. Where a sheet is silent the dims
 * derive from the rotor by the PUBLISHED sheets' own ratios -
 * both Vestas sheets put the blade at 0.49 D (44/90, 54.65/112),
 * the V90 nacelle at 0.116/0.038/0.044 D. The rotor rides the
 * published 6 deg tilt with 4 deg blade coning (V112 GS), and
 * the caller yaws the head and spins the rotor - clockwise seen
 * from upwind, as every sheet states. Light-grey paint is the
 * industry's agreed low-visibility finish (RAL 7035), a
 * documented design default like the rolling stock's liveries.
 */

import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh
} from 'three/webgpu';
import {CONE_DEG, TILT_DEG} from './turbines.js';

const RAD = Math.PI / 180;

// Published-ratio fallbacks (see header).
export function bladeLenM(spec) {
  return spec.blade ?? 0.49 * spec.d;
}
export function nacelleDims(spec) {
  return spec.nacelle ?? [0.116 * spec.d, 0.038 * spec.d, 0.044 * spec.d];
}

/**
 * Build one turbine into `group` (ground at y = 0): tapered
 * tubular tower to the hub, yaw head with the nacelle, tilted
 * rotor with spinner and three coned blades. mats:
 * {body, dark}; U = scene units per metre. Returns {yaw, rotor}
 * for the caller's frame loop (yaw about +y; spin about the
 * rotor's local +z, negative = clockwise from upwind).
 */
export function buildWindmill(group, spec, mats, U) {
  const [nl, nw, nh] = nacelleDims(spec);
  const hubY = spec.hub * U;
  // Tower: the sheets publish hub heights, not base diameters -
  // the taper is a design default sized against the published
  // nacelle width.
  const towerH = spec.hub - nh / 2;
  const tower = new Mesh(
    new CylinderGeometry(0.33 * nw * U, 0.62 * nw * U, towerH * U, 12),
    mats.body
  );
  tower.position.y = (towerH / 2) * U;
  group.add(tower);

  const yaw = new Group();
  yaw.position.y = hubY;
  group.add(yaw);

  const nacelle = new Mesh(new BoxGeometry(nw * U, nh * U, nl * U), mats.body);
  nacelle.position.z = -0.18 * nl * U; // hub overhangs the tower
  yaw.add(nacelle);

  // Rotor: published 6 deg tilt (upwind clearance), nose along
  // +z - the caller points +z into the wind.
  const rotor = new Group();
  rotor.position.z = (0.5 * nl - 0.18 * nl) * U;
  rotor.rotation.x = -TILT_DEG * RAD;
  yaw.add(rotor);

  const noseR = 0.55 * nh * U;
  const nose = new Mesh(new ConeGeometry(noseR, 1.6 * noseR, 10), mats.dark);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 0.8 * noseR;
  rotor.add(nose);

  const bl = bladeLenM(spec);
  const chord = spec.chord ?? 0.08 * bl;
  for (let i = 0; i < 3; i++) {
    // A tapered, flattened spar: root at the published max
    // chord, fine tip; coned the published 4 deg away from the
    // tower.
    const g = new CylinderGeometry(
      0.14 * chord * U,
      0.5 * chord * U,
      bl * U,
      5
    );
    g.translate(0, (bl / 2) * U, 0);
    g.scale(1, 1, 0.22);
    const blade = new Mesh(g, mats.body);
    const arm = new Group();
    arm.rotation.z = i * ((2 * Math.PI) / 3);
    blade.rotation.x = -CONE_DEG * RAD;
    arm.add(blade);
    rotor.add(arm);
  }
  return {yaw, rotor};
}
