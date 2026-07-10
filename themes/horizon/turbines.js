/**
 * turbines.js - wind turbines from OSM, spun by the real wind
 * under the manufacturers' own operating envelopes. Pure math
 * (node-importable); the silhouettes live in windmills.js.
 *
 * The spec ladder (like the building-height ladder): explicit
 * tags (rotor:diameter, height:hub, height-to-tip) beat the
 * model's published sheet, which beats fleet medians computed
 * from the published sheets themselves - no invented constants.
 * The sheets, read at the source:
 *  - Vestas V90-1.8/2.0 MW facts & figures (2 MW platform
 *    brochure): cut-in 4, rated 12, cut-out 25 m/s; nominal
 *    14.5 rpm, operational interval 9.3-16.6 rpm; hub heights
 *    from 80 m; blade 44 m, max chord 3.5 m; nacelle
 *    10.4 x 3.4 x 4 m.
 *  - ENERCON product overview, E-82 E2 2,300 kW: variable
 *    6-18 rpm; hub heights from 78 m; cut-in and rated read off
 *    ENERCON's own calculated power curve (first powered row at
 *    2 m/s, 2,350 kW plateau from 14 m/s; Cp peaks at 0.50);
 *    storm control runs the cut-out down over 28-34 m/s.
 *  - Vestas General Specification V112-3.0 MW (0011-9181 V03):
 *    static 12.8 rpm, dynamic 6.2-17.7 rpm; cut-in 3, cut-out
 *    25, re-cut-in 23 m/s; blade 54.65 m, max chord 4.0 m; rotor
 *    tilt 6 deg, blade coning 4 deg; yawing speed 0.5 deg/s.
 *    Rated 13 m/s (V112 datasheet); the 3.3 shares the platform.
 *
 * The control law is the variable-speed pitch-regulated scheme
 * (Burton, Jenkins, Sharpe & Bossanyi, Wind Energy Handbook):
 * region 2 tracks maximum Cp at constant tip-speed ratio,
 * Omega = lambda_opt v / R, clamped to the published operational
 * interval; above rated the pitch sheds power at constant top
 * speed; outside cut-in/cut-out the rotor is feathered. The
 * closure lambda_opt = Omega_max R / v_rated makes the rotor
 * reach its published top speed exactly at its published rated
 * wind - every constant in the law is a sheet value. ENERCON's
 * patented storm control replaces the hard stop: the speed
 * tapers linearly across the published 28-34 m/s window instead
 * of shutting down ("merely reduces power output by slowing
 * down the rotational speed" - ENERCON product overview).
 */

const RPM = Math.PI / 30; // rad/s per rpm

export const TILT_DEG = 6; // rotor tilt (V112 GS table 2-1)
export const CONE_DEG = 4; // blade coning (V112 GS table 2-1)
export const YAW_DEG_S = 0.5; // yawing speed at 50 Hz (V112 GS)

// Published sheet values only. hub is the lowest published hub
// height (the conservative choice where OSM is silent); blade,
// chord and nacelle [l, w, h] in metres where the sheet gives
// them.
export const MODEL_SPECS = {
  V90: {
    d: 90,
    hub: 80,
    powerKW: 2000,
    cutIn: 4,
    vRated: 12,
    cutOut: 25,
    rpmMin: 9.3,
    rpmMax: 16.6,
    blade: 44,
    chord: 3.5,
    nacelle: [10.4, 3.4, 4]
  },
  E82: {
    d: 82,
    hub: 78,
    powerKW: 2300,
    cutIn: 2,
    vRated: 14,
    cutOut: 28,
    storm: [28, 34],
    rpmMin: 6,
    rpmMax: 18
  },
  V112: {
    d: 112,
    hub: 84,
    powerKW: 3300,
    cutIn: 3,
    vRated: 13,
    cutOut: 25,
    rpmMin: 6.2,
    rpmMax: 17.7,
    blade: 54.65,
    chord: 4
  }
};

const median = (a) => {
  const s = a.slice().sort((x, y) => x - y);
  return s[(s.length - 1) >> 1];
};

// The fleet medians OF THE PUBLISHED TABLE close the ladder for
// turbines whose model OSM does not know: median specific power
// P/A sizes a rotor from a power tag, the median tip-speed ratio
// and tip speed set its law. Computed, not chosen.
const SHEETS = Object.values(MODEL_SPECS);
export const GENERIC = (() => {
  const sp = median(
    SHEETS.map((s) => (s.powerKW * 1000) / (Math.PI * s.d * s.d * 0.25))
  );
  const lambda = median(
    SHEETS.map((s) => (s.rpmMax * RPM * s.d) / 2 / s.vRated)
  );
  const tip = median(SHEETS.map((s) => (s.rpmMax * RPM * s.d) / 2));
  return {
    specificPower: sp, // W/m^2
    lambda,
    tipMax: tip, // m/s
    d: median(SHEETS.map((s) => s.d)),
    hub: median(SHEETS.map((s) => s.hub)),
    cutIn: median(SHEETS.map((s) => s.cutIn)),
    cutOut: median(SHEETS.map((s) => s.cutOut)),
    rpmMin: median(SHEETS.map((s) => s.rpmMin))
  };
})();

const num = (v) => {
  if (v == null) return null;
  const m = String(v)
    .replace(',', '.')
    .match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

export function powerKW(tags) {
  const raw = tags['generator:output:electricity'];
  if (!raw) return null;
  const v = num(String(raw).replace(/,/g, ''));
  if (v == null) return null;
  return /mw/i.test(raw) ? v * 1000 : v;
}

const modelKey = (tags) => {
  const m = (tags.model || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (const k of Object.keys(MODEL_SPECS)) {
    if (m === k || m.startsWith(k)) return k;
  }
  return null;
};

/**
 * Resolve one turbine's spec through the ladder. Returns
 * {model, d, r, hub, cutIn, vRated, cutOut, storm, omMin, omMax,
 * lambda, blade, chord, nacelle} with omMin/omMax in rad/s and
 * the closure lambda = omMax r / vRated already applied.
 */
export function specOf(tags = {}) {
  const key = modelKey(tags);
  const base = key ? MODEL_SPECS[key] : null;
  const p = powerKW(tags) ?? base?.powerKW ?? null;
  const d =
    num(tags['rotor:diameter']) ??
    base?.d ??
    (p != null
      ? Math.sqrt((4 * p * 1000) / (Math.PI * GENERIC.specificPower))
      : GENERIC.d);
  const r = d / 2;
  const hub =
    num(tags['height:hub']) ??
    (num(tags.height) != null ? num(tags.height) - r : null) ??
    base?.hub ??
    GENERIC.hub;
  const omMin = (base?.rpmMin ?? GENERIC.rpmMin) * RPM;
  const omMax = base ? base.rpmMax * RPM : GENERIC.tipMax / r;
  const vRated = base?.vRated ?? GENERIC.tipMax / GENERIC.lambda;
  return {
    model: key,
    d,
    r,
    hub,
    powerKW: p,
    cutIn: base?.cutIn ?? GENERIC.cutIn,
    vRated,
    cutOut: base?.cutOut ?? GENERIC.cutOut,
    storm: base?.storm ?? null,
    omMin,
    omMax,
    lambda: (omMax * r) / vRated,
    blade: base?.blade ?? null,
    chord: base?.chord ?? null,
    nacelle: base?.nacelle ?? null
  };
}

/**
 * Rotor speed (rad/s) at hub wind v (m/s): the variable-speed
 * law with the published clamps. Vestas stops hard at cut-out;
 * ENERCON storm control tapers the speed linearly across its
 * published window instead.
 */
export function rotorOmega(spec, v) {
  if (!(v >= spec.cutIn)) return 0;
  const stop = spec.storm ? spec.storm[1] : spec.cutOut;
  if (v >= stop) return 0;
  let om = Math.min(
    Math.max((spec.lambda * v) / spec.r, spec.omMin),
    spec.omMax
  );
  if (spec.storm && v > spec.storm[0]) {
    om *= (spec.storm[1] - v) / (spec.storm[1] - spec.storm[0]);
  }
  return om;
}

/**
 * Wind at hub height from the forecast model's own levels
 * (Open-Meteo 10/80/120 m), interpolated on the neutral
 * surface-layer log profile (wind ~ ln z): exact at each anchor,
 * log-linear between and beyond. Units pass through.
 */
export function hubWind(v10, v80, v120, h) {
  const [z1, w1, z2, w2] = h <= 80 ? [10, v10, 80, v80] : [80, v80, 120, v120];
  const f = Math.log(h / z1) / Math.log(z2 / z1);
  return Math.max(w1 + (w2 - w1) * f, 0);
}

/** Overpass power=generator + generator:source=wind elements. */
export function parseTurbines(osm) {
  const out = [];
  for (const el of osm?.elements || []) {
    const t = el.tags || {};
    if (t['generator:source'] !== 'wind') continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    out.push({lat, lon, ref: t.ref || null, spec: specOf(t)});
  }
  return out;
}
