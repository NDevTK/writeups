/**
 * rollingstock.js - the train silhouettes, in the vessels.js
 * mould: a shared visual module (three import allowed here, never
 * node-imported) both the theme and the asset viewer render, so
 * the shapes are designed once in the viewer loop and shipped
 * identically. The MEASURED identity comes from trains.js:
 * category and operator pick the consist (car count, narrow vs
 * standard stock dimensions); the LIVERY (livery.js) turns that
 * same category+operator into the operator's real painted colours
 * - the DB ICE white body with its red cheatline, the RhB and
 * Swiss-regional reds, the BLS green, the SBB intercity silver.
 * This module only turns a consist + livery into geometry: a
 * carbody, a dark window band, a signature cheatline stripe, a
 * roof and a dark cab face. Built along -z (like the vessels'
 * bows) and centred, so the caller points +z at the next stop.
 */

import * as THREE from 'three/webgpu';

export const CAR_GAP_M = 0.8;

export function trainLengthM(consist) {
  return consist.cars * consist.len + (consist.cars - 1) * CAR_GAP_M;
}

/**
 * A material set in the caller's material class from a livery.js
 * livery {body, band, stripe, roof, cab}. decorate(m) is the
 * caller's per-material hook (the theme's aerial-fog tone; the
 * viewer passes none). Cached per livery key by the caller.
 */
export function makeTrainMaterials(MaterialClass, livery, decorate) {
  const mk = (hex, rough) => {
    const m = new MaterialClass();
    if (m.color && m.color.set) m.color.set(hex);
    if ('roughness' in m) m.roughness = rough;
    if (decorate) decorate(m);
    return m;
  };
  return {
    body: mk(livery.body, 0.55),
    band: mk(livery.band, 0.3),
    stripe: mk(livery.stripe, 0.45),
    roof: mk(livery.roof, 0.7),
    cab: mk(livery.cab, 0.5)
  };
}

/**
 * Build one train into `group`. cat/consist from trains.js
 * (consistOf); mats from makeTrainMaterials (a livery's colours);
 * U = scene units per metre. Returns the total length in metres.
 */
export function buildTrain(group, cat, consist, mats, U) {
  const L = consist.len * U;
  const W = consist.w * U;
  const H = (consist.h - 0.6) * U; // body over the running gear
  const yBase = 0.6 * U; // wheel/bogie clearance
  const total = trainLengthM(consist) * U;
  const carGeo = new THREE.BoxGeometry(W, H, L * 0.985);
  const winGeo = new THREE.BoxGeometry(W * 1.015, H * 0.2, L * 0.78);
  // The signature cheatline - a thin band along the sides at
  // waist height (the ICE red stripe, an operator accent). Solid
  // liveries set stripe = body so it reads as one colour.
  const stripeGeo = new THREE.BoxGeometry(W * 1.02, H * 0.12, L * 0.9);
  const roofGeo = new THREE.BoxGeometry(W * 0.9, 0.25 * U, L * 0.94);
  const cabGeo = new THREE.BoxGeometry(W * 1.01, H * 0.9, 0.5 * U);
  const bogieGeo = new THREE.BoxGeometry(W * 0.75, 0.55 * U, 2.4 * U);
  for (let i = 0; i < consist.cars; i++) {
    const z0 =
      -total / 2 + (consist.len / 2 + i * (consist.len + CAR_GAP_M)) * U;
    const car = new THREE.Mesh(carGeo, mats.body);
    car.position.set(0, yBase + H / 2, z0);
    group.add(car);
    const stripe = new THREE.Mesh(stripeGeo, mats.stripe);
    stripe.position.set(0, yBase + H * 0.4, z0);
    group.add(stripe);
    const win = new THREE.Mesh(winGeo, mats.band);
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
