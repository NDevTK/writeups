/**
 * vessels.js - the vessel geometry, designed once and shared by
 * the theme (Horizon.html) and the asset viewer
 * (harness/asset-viewer.html), so the shapes are ITERATED ON
 * VISUALLY in isolation and shipped identically.
 *
 * Everything scales from the MEASURED AIS identity (message 5):
 * length and beam set the hull exactly, the M.1371 type class
 * picks the arrangement. The hull is a real plan-form - parallel
 * midbody, flared bow taper, elliptical transom - extruded to the
 * freeboard, not a box; superstructures follow the class
 * (container stacks, tanker trunk + manifold, layered passenger
 * decks, trawler wheelhouse + gantry, sailing rig with mainsail).
 * Deterministic per-ship variety (paint, container colours) comes
 * from the mmsi through roam's shared avalanche hash - no
 * Math.random, same ship every time.
 *
 * Materials are the CALLER's (the theme applies its aerial-fog
 * hook; the viewer uses plain ones): {hullA, hullB, sup, white,
 * deck, funnel, sail, boxes: [..]} - see makeVesselMaterials.
 */

import {
  CylinderGeometry,
  ExtrudeGeometry,
  BoxGeometry,
  Mesh,
  Shape
} from 'three/webgpu';
import {hash3} from './roam.js';

// Freeboard (above-water hull, metres) from length - clamped
// visual proportions of real merchant hulls.
export function freeboardM(lenM) {
  return Math.min(Math.max(0.045 * lenM, 1.2), 11);
}

// The plan-form hull: pointed, flared bow over the forward ~30%,
// parallel midbody, elliptical transom stern. Shape y+ is the bow
// (rotated so the bow faces -z in the ship frame, +y up), extruded
// to the freeboard. Returns a Mesh whose deck sits at y = fbU.
export function hullMesh(lenU, beamU, fbU, mat) {
  const hb = beamU / 2;
  const yBow = lenU / 2; // shape frame: +y = bow
  const yBowFull = lenU * (0.5 - 0.3); // flare ends, midbody starts
  const yStern = -lenU * (0.5 - 0.09);
  const s = new Shape();
  s.moveTo(0, yBow);
  s.quadraticCurveTo(hb * 0.9, yBow - 0.12 * lenU, hb, yBowFull);
  s.lineTo(hb, yStern);
  s.quadraticCurveTo(hb, -lenU / 2, hb * 0.5, -lenU / 2);
  s.lineTo(-hb * 0.5, -lenU / 2);
  s.quadraticCurveTo(-hb, -lenU / 2, -hb, yStern);
  s.lineTo(-hb, yBowFull);
  s.quadraticCurveTo(-hb * 0.9, yBow - 0.12 * lenU, 0, yBow);
  const g = new ExtrudeGeometry(s, {depth: fbU, bevelEnabled: false});
  // Shape plane -> deck plan: x across, shape +y -> scene -z (bow
  // forward), extrusion +z -> scene +y (up).
  g.rotateX(-Math.PI / 2);
  return new Mesh(g, mat);
}

const box = (parent, w, h, len, mat, x, y, z) => {
  const m = new Mesh(new BoxGeometry(w, h, len), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};
const drum = (parent, r, h, mat, x, y, z) => {
  const m = new Mesh(new CylinderGeometry(r, r * 1.15, h, 10), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};

/**
 * Build one vessel into `group` (cleared by the caller): measured
 * length/beam in metres, class from ships.typeClass, materials
 * from the caller, U = scene units per metre (1 for the viewer).
 * Returns {deckY} in group units for the caller's light dots.
 */
export function buildVessel(group, lenM, beamM, cls, mats, mmsi, U = 1) {
  const L = lenM * U;
  const B = Math.max(beamM, 3) * U;
  const fb = freeboardM(lenM) * U;
  const hM = (m) => m * U;
  const hull = hullMesh(L, B, fb, mmsi % 2 ? mats.hullB : mats.hullA);
  hull.position.y = -fb * 0.15; // slight settle into the water
  group.add(hull);
  const deckY = fb * 0.85;
  const funnel = (x, z, hFm, r = 0.02, yBase = deckY) => {
    return drum(
      group,
      Math.max(hM(r * lenM), hM(1)),
      hM(hFm),
      mats.funnel,
      x,
      yBase + hM(hFm / 2),
      z
    );
  };
  if (cls === 'cargo' || cls === 'hsc') {
    // aft island bridge + container bays in per-ship colours
    const hH = hM(Math.min(Math.max(0.1 * lenM, 5), 24));
    box(group, B * 0.88, hH, L * 0.1, mats.white, 0, deckY + hH / 2, L * 0.36);
    box(
      group,
      B * 0.95,
      hH * 0.16,
      L * 0.11,
      mats.deck,
      0,
      deckY + hH + hH * 0.08,
      L * 0.36
    ); // bridge wings
    funnel(0, L * 0.385, Math.min(0.05 * lenM, 9), 0.016, deckY + hH);
    const bH = hM(Math.min(Math.max(0.055 * lenM, 2.4), 12));
    const bays = Math.max(2, Math.min(5, Math.round(lenM / 55)));
    for (let k = 0; k < bays; k++) {
      const zc = -0.38 + (k * 0.62) / bays;
      const mat =
        mats.boxes[Math.floor(hash3(mmsi | 0, k, 21) * mats.boxes.length)];
      const hVar = 0.7 + 0.5 * hash3(mmsi | 0, k, 22);
      box(
        group,
        B * 0.84,
        bH * hVar,
        L * (0.5 / bays),
        mat,
        0,
        deckY + (bH * hVar) / 2,
        L * (zc + 0.25 / bays)
      );
    }
  } else if (cls === 'tanker') {
    const hH = hM(Math.min(Math.max(0.09 * lenM, 5), 20));
    box(group, B * 0.88, hH, L * 0.11, mats.white, 0, deckY + hH / 2, L * 0.37);
    funnel(0, L * 0.395, Math.min(0.05 * lenM, 8), 0.016, deckY + hH);
    // the raised centre walkway + manifold at midship
    box(
      group,
      B * 0.16,
      hM(1.6),
      L * 0.62,
      mats.deck,
      0,
      deckY + hM(0.8),
      -L * 0.04
    );
    box(group, B * 0.55, hM(3.2), L * 0.04, mats.deck, 0, deckY + hM(1.6), 0);
    drum(
      group,
      hM(0.012 * lenM + 0.6),
      hM(2.2),
      mats.deck,
      B * 0.2,
      deckY + hM(1.1),
      -L * 0.28
    );
  } else if (cls === 'passenger') {
    // layered white decks stepping back toward the bow, one funnel
    const hD = hM(Math.min(Math.max(0.028 * lenM, 2.6), 3.2));
    for (let k = 0; k < 4; k++) {
      const shrink = 1 - k * 0.09;
      box(
        group,
        B * 0.86 * shrink,
        hD,
        L * (0.72 - k * 0.09),
        mats.white,
        0,
        deckY + hD * (k + 0.5),
        L * (0.02 + k * 0.02)
      );
    }
    funnel(0, L * 0.16, Math.min(0.045 * lenM, 7), 0.02, deckY + hD * 4);
  } else if (cls === 'fishing') {
    // forward wheelhouse, working aft deck, A-gantry, boom
    box(
      group,
      B * 0.72,
      hM(3.2),
      L * 0.24,
      mats.white,
      0,
      deckY + hM(1.6),
      -L * 0.16
    );
    box(
      group,
      B * 0.5,
      hM(2.2),
      L * 0.1,
      mats.sup,
      0,
      deckY + hM(3.2 + 1.1),
      -L * 0.16
    );
    box(
      group,
      B * 0.08,
      hM(5.5),
      B * 0.08,
      mats.deck,
      B * 0.3,
      deckY + hM(2.75),
      L * 0.32
    );
    box(
      group,
      B * 0.08,
      hM(5.5),
      B * 0.08,
      mats.deck,
      -B * 0.3,
      deckY + hM(2.75),
      L * 0.32
    );
    box(
      group,
      B * 0.7,
      hM(0.35),
      B * 0.08,
      mats.deck,
      0,
      deckY + hM(5.3),
      L * 0.32
    );
    box(
      group,
      hM(0.3),
      hM(7),
      hM(0.3),
      mats.deck,
      0,
      deckY + hM(3.5),
      -L * 0.02
    );
  } else if (cls === 'sailing') {
    // mast, boom and a set mainsail (a thin triangle)
    const mastH = hM(1.25 * lenM);
    box(
      group,
      hM(0.25),
      mastH,
      hM(0.25),
      mats.deck,
      0,
      deckY + mastH / 2,
      -L * 0.08
    );
    box(
      group,
      hM(0.18),
      hM(0.18),
      L * 0.42,
      mats.deck,
      0,
      deckY + hM(1.6),
      L * 0.13
    );
    const sail = new Shape();
    sail.moveTo(0, 0);
    sail.lineTo(0, mastH * 0.88);
    sail.lineTo(L * 0.4, 0);
    sail.lineTo(0, 0);
    const sg = new ExtrudeGeometry(sail, {
      depth: hM(0.06),
      bevelEnabled: false
    });
    const sm = new Mesh(sg, mats.sail);
    sm.position.set(0, deckY + hM(1.7), -L * 0.08);
    sm.rotation.y = -Math.PI / 2;
    group.add(sm);
    box(
      group,
      B * 0.5,
      hM(1),
      L * 0.2,
      mats.white,
      0,
      deckY + hM(0.5),
      L * 0.3
    );
  } else {
    // tug / pleasure / other: compact house, small funnel aft
    const hH = hM(Math.min(Math.max(0.09 * lenM, 2.8), 10));
    box(group, B * 0.72, hH, L * 0.3, mats.white, 0, deckY + hH / 2, L * 0.08);
    box(
      group,
      B * 0.5,
      hH * 0.5,
      L * 0.16,
      mats.sup,
      0,
      deckY + hH * 1.25,
      L * 0.04
    );
    funnel(
      B * 0.18,
      L * 0.26,
      Math.min(0.06 * lenM, 4),
      0.03,
      deckY + hH * 0.7
    );
  }
  return {deckY};
}
