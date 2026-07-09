/**
 * Terrain worker - the roam hop's heavy bakes, off the main
 * thread. One job in, three grids out; the page's frame loop
 * never stalls while the world it is flying over gets rebuilt.
 *
 * The job is a pure snapshot ({dem, centerElev, anchor, world,
 * xz, S, DT}) and the math is the SAME gated modules the theme
 * uses (terrain-sample.js for the surface, leadr.js for the
 * slope-moment pyramid) - the worker adds no model of its own:
 *  - moments: S x S heights sampled through sampleDem, slopes,
 *    and the full LEADR pyramid (every level a transferable
 *    Float32Array).
 *  - mesh: the exact vertex y/wet for the x/z lattice the main
 *    thread harvested from its own PlaneGeometry - no vertex-
 *    ordering assumptions cross the thread boundary.
 *  - bathymetry: the DT x DT signed-depth grid (demElev only, no
 *    seasoning - same as the inline loop it replaces) plus the
 *    sea-depth accumulators for the FFT ocean's TMA depth.
 */

import {buildMomentPyramid, slopesFromHeights} from './leadr.js';
import {demElev, sampleDem} from './terrain-sample.js';

self.onmessage = (ev) => {
  const {id, dem, centerElev, anchor, world, xz, S, DT, lakes} = ev.data;

  // LEADR slope-moment heights.
  const step = world / (S - 1);
  const hs = new Float64Array(S * S);
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      hs[j * S + i] = sampleDem(
        dem,
        (i / (S - 1) - 0.5) * world,
        (j / (S - 1) - 0.5) * world,
        centerElev,
        anchor,
        world,
        lakes
      ).y;
    }
  }
  const {sx, sz} = slopesFromHeights(hs, S, step);
  const pyr = buildMomentPyramid(sx, sz, S);

  // Mesh vertex surface for the harvested lattice.
  const n = xz.length / 2;
  const meshY = new Float32Array(n);
  const meshWet = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    const s = sampleDem(
      dem,
      xz[2 * k],
      xz[2 * k + 1],
      centerElev,
      anchor,
      world,
      lakes
    );
    meshY[k] = s.y;
    meshWet[k] = s.water ? 1 : 0;
  }

  // Signed bathymetry (metres vs MSL / 40, clamped) + mean depth.
  const depth = new Float32Array(DT * DT);
  let dSum = 0;
  let dCnt = 0;
  for (let dj = 0; dj < DT; dj++) {
    for (let di = 0; di < DT; di++) {
      const e = demElev(
        dem,
        (di / (DT - 1) - 0.5) * world,
        (dj / (DT - 1) - 0.5) * world,
        world
      );
      if (e < 0) {
        dSum += -e;
        dCnt++;
      }
      depth[dj * DT + di] = Math.min(Math.max(-e / 40, -1), 1);
    }
  }

  const levels = pyr.levels.map((l) => ({data: l.data, size: l.size}));
  self.postMessage({id, levels, meshY, meshWet, depth, dSum, dCnt}, [
    ...levels.map((l) => l.data.buffer),
    meshY.buffer,
    meshWet.buffer,
    depth.buffer
  ]);
};
