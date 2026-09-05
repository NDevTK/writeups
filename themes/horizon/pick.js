/**
 * pick.js - the pure geometry of pointing at the drawn world (145th
 * pass): a click becomes a ray, the ray becomes a compass direction,
 * the direction is matched against the sky's bodies by angle and
 * against the ground, the sea and the satellite's texel field by
 * intersection. Nothing here touches three.js or the DOM - the page
 * feeds ray origins and directions in scene units and gets back
 * numbers it can print.
 *
 * CONVENTIONS (the theme's, held by the harness pose and skyPoint):
 * scene +x is east, +y up, -z north; a compass azimuth az (degrees
 * clockwise from north) at altitude alt points along
 * (cos alt sin az, sin alt, -cos alt cos az). The camera's yaw is
 * pi - az (its forward vector is (sin yaw, ., cos yaw)); the free
 * camera's pitch is -alt.
 */

const RAD = Math.PI / 180;

export function dirFromAzAlt(azDeg, altDeg) {
  const az = azDeg * RAD;
  const alt = altDeg * RAD;
  return {
    x: Math.cos(alt) * Math.sin(az),
    y: Math.sin(alt),
    z: -Math.cos(alt) * Math.cos(az)
  };
}
export function azAltFromDir({x, y, z}) {
  const n = Math.hypot(x, y, z) || 1;
  return {
    azDeg: (((Math.atan2(x, -z) / RAD) % 360) + 360) % 360,
    altDeg: Math.asin(Math.max(-1, Math.min(1, y / n))) / RAD
  };
}
// The camera yaw and pitch that look along a compass direction.
export function yawPitchFor(azDeg, altDeg) {
  return {yaw: Math.PI - azDeg * RAD, pitch: -altDeg * RAD};
}
// Great-circle separation of two compass directions, degrees.
export function sepDeg(a, b) {
  const da = dirFromAzAlt(a.azDeg, a.altDeg);
  const db = dirFromAzAlt(b.azDeg, b.altDeg);
  const c = da.x * db.x + da.y * db.y + da.z * db.z;
  return Math.acos(Math.max(-1, Math.min(1, c))) / RAD;
}
// The item (each {azDeg, altDeg, ...}) nearest a direction within
// maxDeg, or null.
export function nearestByAngle(dir, items, maxDeg) {
  let best = null;
  for (const it of items) {
    if (!Number.isFinite(it.azDeg) || !Number.isFinite(it.altDeg)) continue;
    const s = sepDeg(dir, it);
    if (s <= maxDeg && (!best || s < best.sepDeg)) best = {item: it, sepDeg: s};
  }
  return best;
}
// Where a ray from o along d (scene units) crosses the plane y = yPlane
// ahead of the origin: the distance t along d, or null.
export function rayPlaneY(o, d, yPlane) {
  if (Math.abs(d.y) < 1e-9) return null;
  const t = (yPlane - o.y) / d.y;
  return t > 0 ? t : null;
}
// The satellite field's texel under a scene point that has already
// been shifted the way the shader shifts it (p + wOff - fieldOff):
// the shader samples pg = p / world + 0.5 across an rm x rm texture;
// the nearest texel is floor(pg rm), or null outside the field.
export function texelIndex(px, pz, worldUnits, rm) {
  const u = px / worldUnits + 0.5;
  const v = pz / worldUnits + 0.5;
  if (!(u >= 0 && u < 1 && v >= 0 && v < 1)) return null;
  return {ii: Math.floor(u * rm), jj: Math.floor(v * rm)};
}
// The field pixel a deck texel came from (the inverse of
// goesir.deckField: i = ci - halfPx - 1 + ii), or null on the border.
export function fieldPixelOfTexel(ii, jj, halfPx, ci, cj, rm) {
  if (ii <= 0 || jj <= 0 || ii >= rm - 1 || jj >= rm - 1) return null;
  return {i: ci - halfPx - 1 + ii, j: cj - halfPx - 1 + jj};
}
// The compass direction of the open sea: n azimuths, each walked
// outward in steps to maxM at most; the walk skips the land it
// starts on (an observer on a mesa is kilometres from the shore),
// and once it reaches the sea (the DEM at or under the sea rule,
// 0.3 m, far-terrain's) counts how far the sea then runs before
// land returns. The answer is the CENTRE of the widest contiguous
// arc of azimuths whose sea run reaches within 5% of the longest (a
// coast facing one way gives that way, not the first azimuth that
// happens to reach the limit). Returns {azDeg, runM, arcDeg} or null
// when no azimuth reaches the sea at all. elevAt takes scene units
// (x east, z south).
export function seaHorizonAzimuth(
  elevAt,
  {maxM = 200e3, stepM = 500, mpu = 1, n = 72, seaM = 0.3} = {}
) {
  const runs = new Float64Array(n);
  let longest = 0;
  for (let k = 0; k < n; k++) {
    const d = dirFromAzAlt((360 * k) / n, 0);
    let seaFrom = -1;
    let run = 0;
    for (let r = stepM; r <= maxM; r += stepM) {
      const e = elevAt((d.x * r) / mpu, (d.z * r) / mpu);
      const sea = e <= seaM;
      if (seaFrom < 0) {
        if (sea) seaFrom = r;
        continue;
      }
      if (!sea) break;
      run = r - seaFrom;
    }
    runs[k] = seaFrom < 0 ? 0 : run + stepM;
    if (runs[k] > longest) longest = runs[k];
  }
  if (!(longest > 0)) return null;
  const open = (k) => runs[((k % n) + n) % n] >= 0.95 * longest;
  // start scanning from an azimuth that is NOT open so a wrapped arc
  // is counted once; all open means the whole circle is sea
  let start = -1;
  for (let k = 0; k < n; k++)
    if (!open(k)) {
      start = k;
      break;
    }
  if (start < 0) return {azDeg: 0, runM: longest, arcDeg: 360};
  let best = null;
  let k = start;
  while (k < start + n) {
    if (!open(k)) {
      k++;
      continue;
    }
    const a0 = k;
    while (k < start + n && open(k)) k++;
    const len = k - a0;
    if (!best || len > best.len) best = {a0, len};
  }
  const centre = (best.a0 + (best.len - 1) / 2) % n;
  return {
    azDeg: (360 * centre) / n,
    runM: longest,
    arcDeg: (360 * best.len) / n
  };
}
// The catalogue star nearest a named star's coordinates: stars are
// [raDeg, decDeg, ...] rows; returns the index within tolDeg or -1.
export function catalogueIndexNear(raDeg, decDeg, stars, tolDeg = 0.1) {
  let best = -1;
  let bd = tolDeg;
  const cd = Math.cos(decDeg * RAD);
  for (let i = 0; i < stars.length; i++) {
    const dra = ((((stars[i][0] - raDeg) % 360) + 540) % 360) - 180;
    const d = Math.hypot(dra * cd, stars[i][1] - decDeg);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}
