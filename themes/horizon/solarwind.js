/**
 * Solar wind - the single source shared by the horizon-live
 * daemon (server/src/index.mjs; install.sh ships this file beside
 * it, the same pattern as lightning.js), the theme (Horizon.html)
 * and the reference printer (solarwind-reference.mjs).
 *
 * The aurora's driver is MEASURED 1.5 million km upwind: DSCOVR/
 * ACE sit at L1 and NOAA SWPC publishes their 1-minute solar wind
 * (speed, density, IMF By/Bz in GSM) already propagated
 * ballistically to the bow shock (propagated_time_tag) - so the
 * wallpaper knows what will drive the magnetosphere BEFORE it
 * arrives, by a real physical lead time of tens of minutes.
 *
 *  - Newell et al. 2007 (JGR 112, A01206), "A nearly universal
 *    solar wind-magnetosphere coupling function":
 *      dPhi_MP/dt = v^(4/3) * B_T^(2/3) * sin^(8/3)(theta_c / 2)
 *    with B_T = sqrt(By^2 + Bz^2) and theta_c = atan2(By, Bz) the
 *    IMF clock angle. Purely northward IMF (Bz > 0, By = 0) gives
 *    EXACTLY zero - the merging valve is closed; purely southward
 *    gives the full v^(4/3) B^(2/3). Units as in the paper:
 *    v in km/s, B in nT.
 *  - Hemispheric power: SWPC's OVATION nowcast (GW, 5-minute
 *    cadence). Auroral column emission is linear in precipitating
 *    energy flux for a fixed spectrum (Rees 1989 ch. 3), so
 *    between OVATION grid refreshes the theme scales its curtain
 *    by HP(now)/HP(at grid) - the measured temporal evolution of
 *    the SAME model that draws the oval, never a second opinion.
 *  - Wire parsers for the two SWPC formats, captured live
 *    2026-07-07 and held by the reference against those fixtures:
 *    products/geospace/propagated-solar-wind-1-hour.json (header
 *    row + data rows, occasional nulls) and
 *    text/aurora-nowcast-hemi-power.txt ('#' comments, then
 *    "obs forecast northGW southGW" rows).
 */

// IMF clock angle (radians): 0 = due north, pi = due south.
export function clockAngle(byNt, bzNt) {
  return Math.atan2(byNt, bzNt);
}

// Newell et al. 2007 coupling function, (km/s)^(4/3) nT^(2/3).
// |sin| keeps the odd power real for negative By (the function is
// symmetric in the clock angle's sign).
export function newellCoupling(vKms, byNt, bzNt) {
  const bt = Math.hypot(byNt, bzNt);
  if (!(vKms > 0) || bt === 0) return 0;
  const s = Math.abs(Math.sin(clockAngle(byNt, bzNt) / 2));
  return Math.pow(vKms, 4 / 3) * Math.pow(bt, 2 / 3) * Math.pow(s, 8 / 3);
}

// Latest finite sample from SWPC's propagated-solar-wind product:
// [header, ...rows], columns located BY NAME (the reference holds
// this against a column-shuffled fixture), rows with null speed
// or field components skipped from the tail.
export function parsePropagated(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const h = rows[0];
  const col = (name) => h.indexOf(name);
  const iT = col('time_tag');
  const iV = col('speed');
  const iN = col('density');
  const iBy = col('by');
  const iBz = col('bz');
  const iBt = col('bt');
  const iP = col('propagated_time_tag');
  if ([iT, iV, iBy, iBz, iP].some((i) => i < 0)) return null;
  // Strict numeric read: SWPC marks gaps with null, and +null is
  // 0 (finite!) - a gap must never read as a calm 0 nT / 0 km/s.
  const num = (x) => (x === null || x === undefined || x === '' ? NaN : +x);
  for (let k = rows.length - 1; k >= 1; k--) {
    const r = rows[k];
    const v = num(r[iV]);
    const by = num(r[iBy]);
    const bz = num(r[iBz]);
    if (!Number.isFinite(v) || !Number.isFinite(by) || !Number.isFinite(bz))
      continue;
    const n = iN >= 0 ? num(r[iN]) : NaN;
    const bt = iBt >= 0 ? num(r[iBt]) : NaN;
    return {
      time: r[iT],
      propagatedTime: r[iP],
      speed: v,
      density: Number.isFinite(n) ? n : null,
      by,
      bz,
      bt: Number.isFinite(bt) ? bt : Math.hypot(by, bz),
      coupling: newellCoupling(v, by, bz)
    };
  }
  return null;
}

// Latest row of the OVATION hemispheric-power nowcast:
// "YYYY-MM-DD_HH:MM  YYYY-MM-DD_HH:MM  northGW  southGW" after
// '#' comment lines.
export function parseHemiPower(text) {
  if (typeof text !== 'string') return null;
  const lines = text.split('\n');
  for (let k = lines.length - 1; k >= 0; k--) {
    const s = lines[k].trim();
    if (!s || s.startsWith('#')) continue;
    const f = s.split(/\s+/);
    if (f.length < 4) continue;
    const north = +f[2];
    const south = +f[3];
    if (!Number.isFinite(north) || !Number.isFinite(south)) continue;
    return {obs: f[0], forecast: f[1], north, south};
  }
  return null;
}

// Minutes until the sampled wind strikes the bow shock (negative:
// it is already driving). Explicit clock - nothing here reads the
// wall time.
export function leadMinutes(propagatedTimeIso, nowMs) {
  const t = Date.parse(propagatedTimeIso);
  if (!Number.isFinite(t)) return null;
  return (t - nowMs) / 60000;
}

// Rebase factor between OVATION grid refreshes: emission is
// linear in precipitating power (fixed spectrum), clamped so a
// bad sample can never black out or blow out the curtain. Either
// side missing -> neutral.
export function hpScale(hpNow, hpAtGrid, lo = 0.25, hi = 4) {
  if (!(hpNow > 0) || !(hpAtGrid > 0)) return 1;
  return Math.min(Math.max(hpNow / hpAtGrid, lo), hi);
}
