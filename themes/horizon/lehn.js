/**
 * lehn.js - Lehn 1983, "Inversion of superior mirage data to
 * compute temperature profiles", J. Opt. Soc. Am. 73, 1622-1625
 * (read in full; home.cc.umanitoba.ca/~lehn/_Papers_for_Download/
 * inv_prob_83.pdf). The inverse problem of the mirage: a mirage
 * observation ties together (1) an object at known distance,
 * (2) the transmitted image, (3) the average temperature profile
 * between them - any two determine the third. This module owns
 * his machinery for recovering (3) from (1) + (2).
 *
 * The observable is his TRANSFER CHARACTERISTIC (TC): ray
 * elevation phi at the eye against the elevation z at which that
 * ray meets the object plane, phi from a level bubble, z from the
 * surface. Under an inversion the TC is S-shaped; its maximum is
 * the PIVOT (phi_p, z_p), its minimum (phi_m, z_m); the
 * negative-slope stretch between them is the inverted image. The
 * one-vertex restriction (at most one inverted image - his stated
 * applicability) splits the TC into three zones with distinct
 * treatments:
 *  - zone I (phi < phi_p): erect low image; NON-iterative - each
 *    layer below the pivot gets the ray-curvature radius that
 *    reproduces the observed TC (the bottom radius straight from
 *    the tangent-ray closed form, Eq. A5), and radius converts to
 *    a temperature gradient through Eq. (A1),
 *      1/r = eps rho / ((1 + eps rho) T) (dT/dz + g beta),
 *    with n = 1 + eps rho (eps = 0.000226), rho = beta p / T
 *    (beta = 0.00348, the reciprocal specific gas constant) and
 *    g beta the autoconvective gradient - the same g/R_M the
 *    nz gate cross-closes against van der Werf.
 *  - zone II (phi_p..phi_m): the inverted image; iterative via
 *    the VERTEX LOCUS. At a ray's vertex his Eq. (1) holds,
 *      2 eps [rho(z) - rho(z_e)] + (2/R_E)(z - z_e) + phi^2 = 0,
 *    which with the density model (B5) rearranges to Eq. (2):
 *    the vertex temperature as a function of launch phi and
 *    vertex elevation z_v. Each pass compares computed against
 *    observed TC and moves the vertex elevations ("if a ray is
 *    too high on the object plane ... the vertex locus will be
 *    steepened, lowering the vertex of this ray and thus lowering
 *    its intersection"), then reads new vertex temperatures from
 *    Eq. (2). The locus is tangent to the TC at the pivot.
 *  - zone III (phi > phi_m): elevated erect image, rays past the
 *    inversion; per-sample gradient nudges ("if the estimated
 *    elevation ... is too high, dT/dz is increased at the
 *    appropriate elevation").
 * His convergence claim, landmarked in lehn-reference.mjs: "a
 * reasonable approximation ... in three iterations and a good
 * approximation in eight".
 *
 * Rays are his parabolic arcs (A2-A7): the Earth's surface
 * z = -x^2/(2 R_E), a ray z = -x^2/(2 r) + x tan(phi) + z_e -
 * equivalently a flat-earth march with curvature 1/R_E - 1/r,
 * which is what composing his per-layer origins with (A7)
 * produces; the arcs here are closed-form per layer, no stepping.
 */

export const LEHN_EPS = 0.000226; // n = 1 + eps rho (rho kg/m^3)
export const LEHN_BETA = 0.00348; // rho = beta p / T (1/R_M, mks)
export const LEHN_G = 9.80665;
export const LEHN_R_E = 6371008.8;

/** Eq. (B5)-style density at a level: rho = beta p / T. */
export function lehnDensity(pPa, TK) {
  return (LEHN_BETA * pPa) / TK;
}

/**
 * Eq. (A1): curvature 1/r of a roughly horizontal ray in air of
 * temperature TK, pressure pPa, under gradient dTdz (K/m).
 * Positive toward the Earth.
 */
export function rayCurvature(TK, pPa, dTdz) {
  const rho = lehnDensity(pPa, TK);
  return (
    ((LEHN_EPS * rho) / ((1 + LEHN_EPS * rho) * TK)) *
    (dTdz + LEHN_G * LEHN_BETA)
  );
}

/** Eq. (A1) inverted: the gradient a measured curvature implies. */
export function gradientFromCurvature(TK, pPa, invR) {
  const rho = lehnDensity(pPa, TK);
  return (
    (invR * (1 + LEHN_EPS * rho) * TK) / (LEHN_EPS * rho) - LEHN_G * LEHN_BETA
  );
}

/**
 * Eq. (A5)/(A6): the radius that makes a ray from eye height zE
 * at elevation phiH tangent to the surface, and the distance to
 * the tangent point.
 */
export function tangentRadius(zE, phiH) {
  const t2 = Math.tan(phiH) ** 2;
  return 1 / (1 / LEHN_R_E - t2 / (2 * zE));
}
export function tangentDistance(zE, phiH) {
  const r = tangentRadius(zE, phiH);
  return Math.tan(phiH) / (1 / r - 1 / LEHN_R_E);
}

/**
 * Eq. (2) (via Eq. (1) + B5): vertex temperature of a ray
 * launched at elevation phi from zE that turns at elevation zV.
 * TzeK is the known eye-level temperature (his fixed point), TmK
 * the estimated mean temperature of the layers of interest, p0Pa
 * the surface pressure.
 */
export function vertexTemperature(phi, zV, {zE, TzeK, TmK = TzeK, p0Pa}) {
  const dz = zV - zE;
  return (
    TzeK +
    TzeK *
      (-((LEHN_G * LEHN_BETA) / TmK) * dz +
        (TzeK * dz) / (LEHN_EPS * LEHN_BETA * p0Pa * LEHN_R_E) +
        (TzeK * phi * phi) / (2 * LEHN_EPS * LEHN_BETA * p0Pa))
  );
}

/**
 * The forward problem on his own atmosphere model: a profile as
 * piecewise-linear T between node elevations (hM ascending, tC),
 * hydrostatic p from p0Pa at hM[0], rays as exact parabolic arcs
 * per layer (curvature 1/R_E - 1/r in the flat-earth frame; his
 * A2-A7). Returns the TC: for each launch elevation (radians),
 * the height (m, surface frame of hM) where the ray crosses
 * x = distM, NaN if it strikes the ground first, plus each ray's
 * vertex elevation (its greatest height, for the vertex locus).
 */
export function lehnForwardTC(nodes, {eyeM, distM, alphas, p0Pa = 101325}) {
  const hs = nodes.hM;
  const ts = nodes.tC;
  const nL = hs.length;
  // Hydrostatic pressures at nodes (B2 with layer-mean T).
  const ps = new Float64Array(nL);
  ps[0] = p0Pa;
  for (let i = 1; i < nL; i++) {
    const tMean = ((ts[i - 1] + ts[i]) / 2 + 273.15) * (1 / LEHN_BETA);
    ps[i] = ps[i - 1] * Math.exp(-((hs[i] - hs[i - 1]) * LEHN_G) / tMean);
  }
  const layerOf = (h, slope = 0) => {
    let i = 0;
    while (i < nL - 2 && hs[i + 1] <= h) i++;
    // On a boundary (within a micron - the arcs land there
    // exactly up to roundoff), the travel direction picks the
    // layer; otherwise an ascending ray parked 1e-10 under the
    // line would take the LOWER layer's curvature across the
    // whole remaining distance.
    if (i < nL - 2 && Math.abs(h - hs[i + 1]) < 1e-6 && slope >= 0) i++;
    else if (i > 0 && Math.abs(h - hs[i]) < 1e-6 && slope < 0) i--;
    return i;
  };
  // His model: ONE parabolic arc per layer - constant curvature,
  // evaluated at the layer's mid-height.
  const layerCurv = new Float64Array(nL - 1);
  for (let i = 0; i < nL - 1; i++) {
    const TK = (ts[i] + ts[i + 1]) / 2 + 273.15;
    const pPa = Math.sqrt(ps[i] * ps[i + 1]);
    const dTdz = (ts[i + 1] - ts[i]) / (hs[i + 1] - hs[i]);
    layerCurv[i] = rayCurvature(TK, pPa, dTdz);
  }
  const ground = hs[0];
  const zAt = new Float64Array(alphas.length).fill(NaN);
  const zVertex = new Float64Array(alphas.length).fill(NaN);
  const nVertex = new Uint8Array(alphas.length);
  for (let k = 0; k < alphas.length; k++) {
    let x = 0;
    let h = eyeM;
    let slope = Math.tan(alphas[k]);
    let hMax = h;
    let guard = 0;
    let verts = 0;
    while (x < distM && guard++ < 4 * nL + 40) {
      const i = layerOf(h, slope);
      const a = 1 / LEHN_R_E - layerCurv[i];
      // Crossing distances to the layer's boundaries and to the
      // object plane: h + slope dx + a dx^2 / 2 = hB. Stable
      // quadratic (q-form): the naive -B + sqrt(B^2 - 4AC)
      // cancels to zero exactly when the ray starts on a
      // boundary, which is every layer change.
      const cross = (hB) => {
        const A = a / 2;
        const B = slope;
        const C = h - hB;
        if (Math.abs(A) < 1e-18) {
          const dx = -C / B;
          return B !== 0 && dx > 1e-6 ? dx : Infinity;
        }
        const disc = B * B - 4 * A * C;
        if (disc < 0) return Infinity;
        const s = Math.sqrt(disc);
        const q = -(B + (B >= 0 ? 1 : -1) * s) / 2;
        let best = Infinity;
        for (const dx of [q / A, q === 0 ? Infinity : C / q])
          if (dx > 1e-6 && dx < best) best = dx;
        return best;
      };
      const up = i < nL - 1 ? cross(hs[i + 1]) : Infinity;
      const dn = cross(Math.max(hs[i], ground));
      const dx = Math.min(up, dn, distM - x);
      if (!Number.isFinite(dx) || dx <= 0) break;
      const hNew = h + slope * dx + (a * dx * dx) / 2;
      // Vertex inside the step? (Count them: the algorithm's
      // stated domain is AT MOST ONE per ray.)
      if (slope > 0 && slope + a * dx < 0) {
        const xv = -slope / a;
        hMax = Math.max(hMax, h + slope * xv + (a * xv * xv) / 2);
        verts++;
      }
      slope += a * dx;
      x += dx;
      h = hNew;
      hMax = Math.max(hMax, h);
      if (h <= ground + 1e-6 && x < distM) {
        h = NaN;
        break;
      }
    }
    if (Number.isFinite(h) && x >= distM - 1e-6) {
      zAt[k] = h;
      zVertex[k] = hMax;
      nVertex[k] = verts;
    }
  }
  return {alphas: Float64Array.from(alphas), zAt, zVertex, nVertex};
}

/**
 * The TC's critical points (his Fig. 3): the PIVOT is the S's own
 * local maximum - the first prominent one, NOT the global top of
 * an erect zone-III branch - and the minimum the local minimum
 * after it. Prominence guards against sampling wiggles.
 */
export function tcCriticalPoints(tc, promM = 0.5) {
  const z = tc.zAt;
  const n = z.length;
  const prom = (i, sign) => {
    // Smallest of the two excursions before the curve REGAINS the
    // extremum's level. A side that ends at the horizon (NaN) or
    // the window edge without re-crossing does not bound the
    // prominence - the S's low branch falls into the sea horizon,
    // and the pivot is prominent by default from that side.
    let best = Infinity;
    for (const dir of [-1, 1]) {
      let d = 0;
      let crossed = false;
      for (let k = i + dir; k >= 0 && k < n; k += dir) {
        if (!Number.isFinite(z[k])) break;
        if (sign * z[k] > sign * z[i]) {
          crossed = true;
          break;
        }
        d = Math.max(d, sign * (z[i] - z[k]));
      }
      if (crossed) best = Math.min(best, d);
    }
    return best;
  };
  let iP = -1;
  for (let i = 1; i < n - 1; i++) {
    if (
      !Number.isFinite(z[i - 1]) ||
      !Number.isFinite(z[i]) ||
      !Number.isFinite(z[i + 1])
    )
      continue;
    if (z[i] >= z[i - 1] && z[i] >= z[i + 1] && prom(i, 1) >= promM) {
      iP = i;
      break;
    }
  }
  let iM = -1;
  if (iP >= 0)
    for (let i = iP + 1; i < n - 1; i++) {
      if (!Number.isFinite(z[i]) || !Number.isFinite(z[i + 1])) continue;
      if (z[i] <= z[i + 1] && prom(i, -1) >= promM) {
        iM = i;
        break;
      }
    }
  return {iP, iM};
}

/**
 * The inversion (his computational algorithm, Figs. 2-4): from an
 * observed TC alone - samples (alphas ascending, zAt at the
 * object plane distM), the eye height, the eye-level temperature
 * (his known fixed point) and surface pressure - recover the
 * temperature profile.  Returns {nodes: {hM, tC}, iters, rms}
 * with rms the TC reproduction error (m) per iteration.
 */
export function lehnInvertTC(
  obs,
  {eyeM, distM, TzeC, p0Pa = 101325, iterations = 8, topM = null}
) {
  const {iP, iM} = tcCriticalPoints(obs);
  if (iP < 1) return null; // pivot at the bottom: no zone I - out of range
  const phiP = obs.alphas[iP];
  const zP = obs.zAt[iP];
  const TzeK = TzeC + 273.15;
  // ---- zone I: direct, layer by layer (Fig. 4) ----
  // The bottom layer's radius from the tangent closed form (A5)
  // at the lowest observed ray; each next layer's radius by
  // bisection so its ray lands on the observed z. Layers span
  // ground..eye, then the object-plane elevations of successive
  // zone-I samples.
  const zone1 = [];
  for (let i = 0; i < iP; i++) if (Number.isFinite(obs.zAt[i])) zone1.push(i);
  if (zone1.length < 2) return null;
  const phiH = obs.alphas[zone1[0]];
  const rBottom = tangentRadius(Math.max(eyeM, 0.5), phiH);
  const gradBottom = gradientFromCurvature(TzeK, p0Pa, 1 / rBottom);
  // Node scaffold: ground, eye, then zone-I landing heights.
  const hM = [0, eyeM];
  const tC = [TzeC - gradBottom * eyeM, TzeC];
  const grads = [gradBottom];
  for (let k = 1; k < zone1.length; k++) {
    const i = zone1[k];
    const zTarget = obs.zAt[i];
    // Decimate near the pivot: the TC flattens there and
    // sub-metre layers would demand runaway gradients to move a
    // landing at all (the resolution limit his Fig. 7 also shows
    // at the pivot elevation).
    if (zTarget <= hM[hM.length - 1] + 2) continue;
    // Bisect this layer's gradient so the ray lands at zTarget.
    const hTop = zTarget;
    const land = (g) => {
      const nodes = {
        hM: [...hM, hTop, hTop + 4000],
        tC: [
          ...tC,
          tC[tC.length - 1] + g * (hTop - hM[hM.length - 1]),
          tC[tC.length - 1] + g * (hTop - hM[hM.length - 1]) - 0.0065 * 4000
        ]
      };
      const f = lehnForwardTC(nodes, {
        eyeM,
        distM,
        alphas: [obs.alphas[i]],
        p0Pa
      });
      return f.zAt[0];
    };
    let lo = -0.05;
    let hi = 0.8;
    let gBest = 0;
    let missBest = Infinity;
    for (let it = 0; it < 40; it++) {
      const mid = (lo + hi) / 2;
      const z = land(mid);
      const miss = Number.isFinite(z) ? z - zTarget : -1e9;
      if (Math.abs(miss) < missBest) {
        missBest = Math.abs(miss);
        gBest = mid;
      }
      // Larger gradient bends the ray down harder -> lands lower.
      if (miss > 0) lo = mid;
      else hi = mid;
    }
    grads.push(gBest);
    hM.push(hTop);
    tC.push(tC[tC.length - 1] + gBest * (hTop - hM[hM.length - 2]));
  }
  // ---- zones II + III: the vertex-locus iteration ----
  const zTop = topM ?? Math.max(zP * 3, zP + 60);
  // Initial guess above the pivot: "usually a linear increase
  // with elevation".
  let upper = [
    {h: hM[hM.length - 1], t: tC[tC.length - 1]},
    {h: zTop, t: tC[tC.length - 1] + 0.05 * (zTop - hM[hM.length - 1])}
  ];
  const zone23 = [];
  for (let i = iP + 1; i < obs.alphas.length; i++)
    if (Number.isFinite(obs.zAt[i])) zone23.push(i);
  const rmsLog = [];
  let vertexEl = null;
  let gTop = 0.005;
  for (let iter = 0; iter < iterations; iter++) {
    const nodes = {
      hM: [...hM, ...upper.slice(1).map((u) => u.h)],
      tC: [...tC, ...upper.slice(1).map((u) => u.t)]
    };
    const f = lehnForwardTC(nodes, {
      eyeM,
      distM,
      alphas: zone23.map((i) => obs.alphas[i]),
      p0Pa
    });
    let s2 = 0;
    let n2 = 0;
    const moves = [];
    for (let k = 0; k < zone23.length; k++) {
      const i = zone23[k];
      const zC = f.zAt[k];
      const e = Number.isFinite(zC) ? zC - obs.zAt[i] : zTop / 2;
      s2 += e * e;
      n2++;
      const inII = iM < 0 || i <= iM;
      if (inII) {
        // Move this ray's vertex against the landing error (his
        // steepen-the-locus rule), then read its temperature from
        // Eq. (2).
        const zV0 = Number.isFinite(f.zVertex[k]) ? f.zVertex[k] : zP + 1;
        const move = Math.max(-1.5, Math.min(1.5, -0.12 * e));
        const zV = Math.max(zP + 0.05, zV0 + move);
        moves.push({
          h: zV,
          t:
            vertexTemperature(obs.alphas[i], zV, {
              zE: eyeM,
              TzeK,
              TmK: TzeK,
              p0Pa
            }) - 273.15
        });
      }
    }
    rmsLog.push(Math.sqrt(s2 / Math.max(n2, 1)));
    // Rebuild the profile above the pivot from the moved
    // vertices (sorted, anchored at the zone-I top), keeping a
    // top node so zone-III rays escape over the structure; then
    // zone-III nudge: the top gradient follows the mean error of
    // rays past the minimum.
    moves.sort((a, b) => a.h - b.h);
    const anchor = {h: hM[hM.length - 1], t: tC[tC.length - 1]};
    const dedup = [anchor];
    for (const m of moves)
      if (m.h > dedup[dedup.length - 1].h + 0.25) dedup.push(m);
    if (iM >= 0) {
      let eIII = 0;
      let nIII = 0;
      for (let k = 0; k < zone23.length; k++)
        if (zone23[k] > iM && Number.isFinite(f.zAt[k])) {
          eIII += f.zAt[k] - obs.zAt[zone23[k]];
          nIII++;
        }
      if (nIII)
        gTop = Math.max(-0.01, Math.min(0.06, gTop + 0.00025 * (eIII / nIII)));
    }
    const last = dedup[dedup.length - 1];
    dedup.push({h: zTop, t: last.t + gTop * (zTop - last.h)});
    upper = dedup;
    vertexEl = moves.map((m) => m.h);
  }
  return {
    nodes: {
      hM: [...hM, ...upper.slice(1).map((u) => u.h)],
      tC: [...tC, ...upper.slice(1).map((u) => u.t)]
    },
    zone1Grads: grads,
    pivot: {phi: phiP, zM: zP},
    min: iM >= 0 ? {phi: obs.alphas[iM], zM: obs.zAt[iM]} : null,
    vertexEl,
    rms: rmsLog
  };
}
