/**
 * comets.js - real comets from the Minor Planet Center's own
 * current orbital elements, propagated by exact two-body
 * mechanics. Pure math (node-importable); the theme fetches the
 * MPC file (CORS-open, cached daily), propagates, and draws
 * whatever is genuinely bright enough to see - most nights that
 * is nothing, exactly like the eclipses.
 *
 * Sources, followed rather than approximated:
 *  - Elements: the MPC "Soft00Cmt" export (SkyMap format) -
 *    perihelion epoch T (TT), perihelion distance q (AU),
 *    eccentricity e, argument of perihelion, ascending node and
 *    inclination (J2000.0 ecliptic, degrees), osculation epoch,
 *    and the two photometric parameters g (absolute magnitude)
 *    and k (slope).
 *  - Propagation: the universal-variable Kepler solver (Vallado,
 *    "Fundamentals of Astrodynamics", Algorithm 8; Danby 6.9) -
 *    ONE formulation for elliptic, near-parabolic and hyperbolic
 *    orbits through the Stumpff functions C(z), S(z). Comets
 *    live at e ~ 1 where the classical anomaly equations are
 *    singular; the universal formulation is exact there. Started
 *    from perihelion the equation collapses to
 *    sqrt(mu) dt = e chi^3 S(z) + q chi, z = alpha chi^2 -
 *    Newton in chi, position by the f and g functions in the
 *    perifocal frame, rotated to the ecliptic by the elements.
 *    mu = k^2 with Gauss's constant k = 0.01720209895 (AU, day).
 *  - Brightness: the standard cometary total-magnitude law
 *    m1 = g + 5 log10(Delta) + 2.5 k log10(r) (the same M1/k1
 *    parameterisation JPL Horizons reports).
 */

export const GAUSS_K = 0.01720209895; // rad/day at 1 AU (defined)
export const MU_SUN = GAUSS_K * GAUSS_K; // AU^3/day^2

const RAD = Math.PI / 180;

/** Julian date (TT ~ the file's own scale) from calendar pieces. */
export function jdOf(y, m, dFrac) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  const jdn =
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045;
  return jdn + dFrac - 0.5;
}

/**
 * Parse the MPC Soft00Cmt (SkyMap) export: fixed columns, one
 * comet per line. Returns [{name, tp (JD of perihelion), q, e,
 * peri, node, incl (radians), epoch, g, k}]. Lines that do not
 * carry the numeric fields are dropped.
 */
export function parseSoft00(text) {
  const out = [];
  for (const line of String(text).split('\n')) {
    if (line.length < 100) continue;
    const y = parseInt(line.slice(14, 18), 10);
    const mo = parseInt(line.slice(19, 21), 10);
    const dF = parseFloat(line.slice(22, 30));
    const q = parseFloat(line.slice(30, 40));
    const e = parseFloat(line.slice(41, 50));
    const peri = parseFloat(line.slice(51, 60));
    const node = parseFloat(line.slice(61, 70));
    const incl = parseFloat(line.slice(71, 80));
    const g = parseFloat(line.slice(90, 96));
    const k = parseFloat(line.slice(96, 102));
    const name = line.slice(102, 158).trim();
    if (
      !Number.isFinite(y) ||
      !Number.isFinite(q) ||
      !Number.isFinite(e) ||
      q <= 0
    )
      continue;
    out.push({
      name,
      tp: jdOf(y, mo, dF),
      q,
      e,
      peri: peri * RAD,
      node: node * RAD,
      incl: incl * RAD,
      g: Number.isFinite(g) ? g : 10,
      k: Number.isFinite(k) ? k : 4
    });
  }
  return out;
}

// Stumpff functions (series near zero, closed forms beyond).
export function stumpffC(z) {
  if (Math.abs(z) < 1e-6) return 1 / 2 - z / 24 + (z * z) / 720;
  if (z > 0) return (1 - Math.cos(Math.sqrt(z))) / z;
  const s = Math.sqrt(-z);
  return (Math.cosh(s) - 1) / -z;
}
export function stumpffS(z) {
  if (Math.abs(z) < 1e-6) return 1 / 6 - z / 120 + (z * z) / 5040;
  if (z > 0) {
    const s = Math.sqrt(z);
    return (s - Math.sin(s)) / (s * s * s);
  }
  const s = Math.sqrt(-z);
  return (Math.sinh(s) - s) / (s * s * s);
}

/**
 * Universal Kepler from PERIHELION: solve
 * sqrt(mu) dt = e chi^3 S(z) + q chi (z = alpha chi^2,
 * alpha = (1 - e)/q) for chi by Newton (dt in days), then the
 * f/g functions give the perifocal position. Returns
 * {x, y (perifocal, AU), r}.
 */
export function keplerUniversal(q, e, dtDays) {
  const alpha = (1 - e) / q;
  const smu = Math.sqrt(MU_SUN);
  const target = smu * dtDays;
  // Newton with a parabolic-guess start (Barker-like scale)
  let chi =
    Math.abs(alpha) > 1e-9
      ? target * alpha // elliptic/hyperbolic first guess
      : Math.cbrt(6 * target) * 0.5;
  if (chi === 0) chi = 1e-8;
  for (let it = 0; it < 60; it++) {
    const z = alpha * chi * chi;
    const C = stumpffC(z);
    const S = stumpffS(z);
    const F = e * chi * chi * chi * S + q * chi - target;
    const r = e * chi * chi * C + q * (1 - z * S) + q * z * S; // dF/dchi
    const step = F / r;
    chi -= step;
    if (Math.abs(step) < 1e-14 * Math.max(1, Math.abs(chi))) break;
  }
  const z = alpha * chi * chi;
  const C = stumpffC(z);
  const S = stumpffS(z);
  // f and g from perihelion (r0 = q, vr0 = 0)
  const f = 1 - ((chi * chi) / q) * C;
  const g = dtDays - (chi * chi * chi * S) / smu;
  const v0 = Math.sqrt((MU_SUN * (1 + e)) / q); // perihelion speed
  const x = f * q;
  const y = g * v0;
  return {x, y, r: Math.hypot(x, y)};
}

/**
 * Heliocentric J2000-ecliptic position (AU) of a comet at JD:
 * universal Kepler in the perifocal frame, rotated by
 * (peri, incl, node). Returns {x, y, z, r}.
 */
export function cometState(el, jd) {
  const pf = keplerUniversal(el.q, el.e, jd - el.tp);
  const co = Math.cos(el.peri);
  const so = Math.sin(el.peri);
  const cO = Math.cos(el.node);
  const sO = Math.sin(el.node);
  const ci = Math.cos(el.incl);
  const si = Math.sin(el.incl);
  // perifocal -> ecliptic (classical COE rotation)
  const px = co * cO - so * sO * ci;
  const py = co * sO + so * cO * ci;
  const pz = so * si;
  const qx = -so * cO - co * sO * ci;
  const qy = -so * sO + co * cO * ci;
  const qz = co * si;
  return {
    x: pf.x * px + pf.y * qx,
    y: pf.x * py + pf.y * qy,
    z: pf.x * pz + pf.y * qz,
    r: pf.r
  };
}

/**
 * Total magnitude: m1 = g + 5 log10(Delta) + 2.5 k log10(r) -
 * Delta the geocentric and r the heliocentric distance (AU).
 */
export function cometMagnitude(el, r, delta) {
  return el.g + 5 * Math.log10(delta) + 2.5 * el.k * Math.log10(r);
}

/**
 * The show: propagate every comet to jd, take the observer's
 * heliocentric ecliptic position (AU, from the theme's
 * ephemeris), keep those brighter than magLimit, brightest
 * first. Returns [{name, mag, r, delta, helio, geo}] with geo
 * the J2000-ecliptic geocentric vector (AU).
 */
export function visibleComets(elements, jd, obs, magLimit = 9) {
  const out = [];
  for (const el of elements) {
    // A comet a decade from perihelion at q ~ small is far and
    // faint; still propagate - the filter is the magnitude.
    const h = cometState(el, jd);
    const gx = h.x - obs.x;
    const gy = h.y - obs.y;
    const gz = h.z - obs.z;
    const delta = Math.hypot(gx, gy, gz);
    const mag = cometMagnitude(el, h.r, delta);
    if (!Number.isFinite(mag) || mag > magLimit) continue;
    out.push({
      name: el.name,
      mag,
      r: h.r,
      delta,
      helio: h,
      geo: {x: gx, y: gy, z: gz}
    });
  }
  out.sort((a, b) => a.mag - b.mag);
  return out;
}
