/**
 * rollingstock.js - the train silhouettes, in the vessels.js
 * mould: a shared visual module (three import allowed here, never
 * node-imported) both the theme and the asset viewer render, so
 * the shapes are designed once in the viewer loop and shipped
 * identically. The MEASURED identity comes from trains.js:
 * category and operator pick the consist (car count, narrow vs
 * standard stock dimensions) - this module only turns a consist
 * into geometry. Liveries are documented design defaults: the
 * intercity family runs light bodies with a dark window band, the
 * regional and narrow-gauge families the red of Swiss regional
 * stock; the lead car carries a dark cab face. The train is built
 * along -z (like the vessels' bows) and centred, so the caller
 * points +z at the next stop.
 */

import * as THREE from 'three/webgpu';

const IC_FAMILY = new Set(['IC', 'ICE', 'ICN', 'EC', 'EN', 'RJ', 'RJX', 'TGV']);

export const CAR_GAP_M = 0.8;

export function trainLengthM(consist) {
  return consist.cars * consist.len + (consist.cars - 1) * CAR_GAP_M;
}

/**
 * Build one train into `group`. cat/consist from trains.js
 * (consistOf); mats: {icBody, regBody, win, roof, cab}; U = scene
 * units per metre. Returns the total length in metres.
 */
export function buildTrain(group, cat, consist, mats, U) {
  const body = IC_FAMILY.has(cat) ? mats.icBody : mats.regBody;
  const L = consist.len * U;
  const W = consist.w * U;
  const H = (consist.h - 0.6) * U; // body over the running gear
  const yBase = 0.6 * U; // wheel/bogie clearance
  const total = trainLengthM(consist) * U;
  const carGeo = new THREE.BoxGeometry(W, H, L * 0.985);
  const winGeo = new THREE.BoxGeometry(W * 1.015, H * 0.2, L * 0.78);
  const roofGeo = new THREE.BoxGeometry(W * 0.9, 0.25 * U, L * 0.94);
  const cabGeo = new THREE.BoxGeometry(W * 1.01, H * 0.9, 0.5 * U);
  const bogieGeo = new THREE.BoxGeometry(W * 0.75, 0.55 * U, 2.4 * U);
  for (let i = 0; i < consist.cars; i++) {
    const z0 =
      -total / 2 + (consist.len / 2 + i * (consist.len + CAR_GAP_M)) * U;
    const car = new THREE.Mesh(carGeo, body);
    car.position.set(0, yBase + H / 2, z0);
    group.add(car);
    const win = new THREE.Mesh(winGeo, mats.win);
    win.position.set(0, yBase + H * 0.66, z0);
    group.add(win);
    const roof = new THREE.Mesh(roofGeo, mats.roof);
    roof.position.set(0, yBase + H + 0.125 * U, z0);
    group.add(roof);
    for (const s of [-1, 1]) {
      const bogie = new THREE.Mesh(bogieGeo, mats.cab);
      bogie.position.set(0, 0.3 * U, z0 + s * L * 0.32);
      group.add(bogie);
    }
  }
  // Cab faces on both ends (push-pull - how these lines run).
  for (const s of [-1, 1]) {
    const cab = new THREE.Mesh(cabGeo, mats.cab);
    cab.position.set(0, yBase + H * 0.45, s * (total / 2 - 0.25 * U));
    group.add(cab);
  }
  return trainLengthM(consist);
}
