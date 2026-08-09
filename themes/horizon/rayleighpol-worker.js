/**
 * Polarized-sky worker - the doubling engine's LUT bake, off the
 * main thread (a full three-channel solve is ~1-2 s of pure
 * matrix arithmetic; the frame loop never stalls while the sky's
 * polarization field rebuilds for a new sun or a new AOD).
 *
 * The job is a pure snapshot ({id, sunAltDeg, tauR, tauA}) and
 * the math is the SAME gated modules the reference runs:
 * rayleighpol.js (the IPRT-benchmarked doubling engine) composed
 * with coxmunk.js's Fresnel split - the worker adds no model of
 * its own. One job in, one RGBA Float32Array out (transferred).
 */

import {skyPolLut} from './rayleighpol.js';
import {fresnelRsRp, N_WATER} from './coxmunk.js';

self.onmessage = (ev) => {
  const {id, sunAltDeg, tauR, tauA} = ev.data;
  const nTheta = 16;
  const thetaMaxDeg = 88;
  const polK = [];
  for (let i = 0; i < nTheta; i++) {
    const th = (i * thetaMaxDeg) / (nTheta - 1);
    const {Rs, Rp} = fresnelRsRp(Math.cos((th * Math.PI) / 180), N_WATER);
    polK.push((Rp - Rs) / Math.max(Rp + Rs, 1e-12));
  }
  const lut = skyPolLut({sunAltDeg, tauR, tauA, polK, nTheta, thetaMaxDeg});
  self.postMessage(
    {
      id,
      nTheta: lut.nTheta,
      nDaz: lut.nDaz,
      thetaMaxDeg: lut.thetaMaxDeg,
      data: lut.data
    },
    [lut.data.buffer]
  );
};
