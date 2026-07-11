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
 * roof, and a lead-car NOSE shaped to the category - a long
 * streamlined prow for the high-speed families, a short raked cab
 * for the standard network, a blunt stub for the narrow-gauge stock -
 * so a train reads by its type as well as its paint. Built along -z
 * (like the vessels' bows) and centred, so the caller points +z at
 * the next stop.
 */

import * as THREE from 'three/webgpu';

export const CAR_GAP_M = 0.8;

export function trainLengthM(consist) {
  return consist.cars * consist.len + (consist.cars - 1) * CAR_GAP_M;
}

// The lead-car NOSE profile by category: a long, low, sharply tapered
// prow for the high-speed families (the ICE/TGV/Railjet power-car
// snout), a short raked cab for the standard network, and a blunt stub
// for the narrow-gauge stock. len is the nose length as a fraction of a
// car; tipY the tip's height (fraction of body height, lower = more
// streamlined); taper the tip size (fraction of the cross-section).
const HS_CATS = new Set(['ICE', 'TGV', 'RJ', 'RJX', 'ICN', 'EC', 'EN']);
function noseProfile(cat, narrow) {
  if (narrow) return {len: 0.1, tipY: 0.52, taper: 0.6}; // blunt
  if (HS_CATS.has(String(cat || '').toUpperCase()))
    return {len: 0.5, tipY: 0.28, taper: 0.14}; // streamlined
  return {len: 0.22, tipY: 0.44, taper: 0.36}; // raked cab
}

// A tapered nose from the body-end cross-section (W x H at z = sZ) out
// to a small low tip, as a five-face frustum. Double-sided material, so
// the winding needs no bookkeeping; built for either end by the sign
// of sZ.
function noseMesh(mat, sZ, W, H, yBase, prof, U) {
  const dir = Math.sign(sZ) || 1;
  const zTip = sZ + dir * prof.len;
  const yc = yBase + H * prof.tipY;
  const w = (W / 2) * prof.taper;
  const h = (H / 2) * prof.taper;
  const Bbl = [-W / 2, yBase, sZ];
  const Bbr = [W / 2, yBase, sZ];
  const Btr = [W / 2, yBase + H, sZ];
  const Btl = [-W / 2, yBase + H, sZ];
  const Tbl = [-w, yc - h, zTip];
  const Tbr = [w, yc - h, zTip];
  const Ttr = [w, yc + h, zTip];
  const Ttl = [-w, yc + h, zTip];
  const P = [];
  const quad = (a, b, c, d) => P.push(...a, ...b, ...c, ...a, ...c, ...d);
  quad(Btl, Btr, Ttr, Ttl); // top (rakes down to the tip)
  quad(Bbr, Bbl, Tbl, Tbr); // underside
  quad(Bbl, Btl, Ttl, Tbl); // left
  quad(Btr, Bbr, Tbr, Ttr); // right
  quad(Ttl, Ttr, Tbr, Tbl); // tip cap
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
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
  // A shaped nose on both ends (push-pull - how these lines run):
  // streamlined for high-speed, a raked cab otherwise, blunt for
  // narrow-gauge. Double-sided so the frustum needs no winding care.
  const noseMat = mats.cab.clone();
  noseMat.side = THREE.DoubleSide;
  const p = noseProfile(cat, consist.narrow);
  const prof = {len: p.len * L, tipY: p.tipY, taper: p.taper};
  for (const s of [-1, 1])
    group.add(noseMesh(noseMat, s * (total / 2), W, H, yBase, prof, U));
  return trainLengthM(consist);
}
