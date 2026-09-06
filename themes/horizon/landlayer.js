/**
 * landlayer.js - THE LAND SURFACE LAYER (157th pass): the measured
 * land skin (NOAA's ABI land surface temperature, goesl2.js) against
 * the screen air and the 10-m wind on the footprint's own roughness,
 * through Monin-Obukhov similarity, composed under the balloon into
 * the LAND's refraction column - the terrestrial refraction over the
 * land horizon (Hirt's coefficient over the eye's own metres) and the
 * inferior-mirage verdict (Fleagle's autoconvective test) for the
 * land spokes of the far ring, beside the pier's marine layer
 * (surfacelayer.js) for the sea spokes. Pure; mirrored by
 * landlayer-reference.mjs; composed by observatory.landPanel, which
 * owns no law.
 *
 * PRIMARIES, read in full:
 *  - WMO-No. 8, Guide to Instruments and Methods of Observation
 *    (the CIMO Guide), Volume I, Chapter 5 (Measurement of surface
 *    wind), Annex 5.B "Effective roughness length": the Davenport
 *    classification (Wieringa 1992) - 1 sea 0.0002 m, 2 smooth 0.005,
 *    3 open 0.03, 4 roughly open 0.10, 5 rough 0.25, 6 very rough
 *    0.5, 7 closed 1.0, 8 chaotic >= 2 m - with its rule that an
 *    effective roughness over a footprint is had by averaging ln z0
 *    rather than z0 itself, sector by sector out to 2 km. The
 *    footprint census below averages ln z0 over the painted cover.
 *  - Stull 2017, Practical Meteorology: an algebra-based survey of
 *    atmospheric science (open, CC BY-NC-SA), Chapter 18, Table 18-1:
 *    the same classes with the 10-m drag coefficient CD = 0.0014,
 *    0.0028, 0.0047, 0.0075, 0.012, 0.018, 0.030, >= 0.062 - the
 *    neutral log law (kappa / ln(10 / z0))^2 reproduces every entry
 *    within its rounding (gate-held), so the table is the law's own
 *    print, not a second source.
 *  - Oke 2006, Initial guidance to obtain representative
 *    meteorological observations at urban sites (WMO/TD-No. 1250,
 *    IOM Report 81), Table 2: the Davenport classes with their urban
 *    faces - a regularly built-up area without much height variation
 *    is class 7 'closed' (1.0 m), a city centre of mixed heights
 *    class 8 'chaotic'; the mapping of OSM's cover below follows it.
 *  - Rigden, Li & Salvucci 2018, "Dependence of thermal roughness
 *    length on friction velocity across land cover types: a synthesis
 *    analysis using AmeriFlux data", Agricultural and Forest
 *    Meteorology 249, 512-519 (open access): kB^-1 = ln(z0 / z0h)
 *    fitted by cover at an emissivity of 0.98 (Table 2: shrubland 3.5,
 *    grassland 2.5, cropland 1.75, deciduous broadleaf forest 0.25,
 *    evergreen needleleaf forest 0.75, all covers 1.75) and the
 *    bluff-body law of Eq. 10, kB^-1 = C1 Re*^0.25 - 2 with Re* =
 *    u* z0 / nu, C1 = 2.46 (Brutsaert 1982) or 1.29 (Kanda et al.
 *    2007) - a constant kB^-1 over built or bare ground returned
 *    kilowatts of sensible flux for a few kelvin of skin-air contrast
 *    (measured in this pass: 3-6 kW/m^2 over a suburb), so built and
 *    bare covers take the bluff law and canopies the constants.
 *  - Hirt, Guillaume, Wisbar, Buerki & Sternberg 2010 (JGR 115,
 *    D21102): k = 503 P/T^2 (0.0343 + dT/dh) - far-terrain.js's
 *    refractionK, fed the film's own gradient over the eye's metres.
 *  - Fleagle 1950 (fleagle.js): the autoconvective lapse g/R =
 *    34.16 K/km - the gradient past which the inferior mirage forms;
 *    the film is tested layer by layer.
 *  - The Kansas profile forms (surfacelayer.js: Businger 1971 /
 *    Paulson 1970, kappa 0.40, the neutral Prandtl 0.74) and COARE's
 *    convective gustiness (Fairall 1996) - the same similarity the
 *    pier's film rides, with the roughness PRESCRIBED from the cover
 *    instead of Charnock's sea.
 *
 * STATED LIMITS: the skin is one satellite pixel (2 km, hourly) and
 * the air and wind a station's or a model's at their own heights;
 * the latent flux is not claimed (no surface humidity is measured)
 * so the Obukhov length rides the sensible flux alone, the virtual
 * temperature from the screen humidity; the cover's roughness is a
 * class, not a measurement, and the bluff law's C1 is a choice
 * between two authors' fits (both carried, the sensitivity printed).
 */
import {
  eSatPa,
  GUST_BETA,
  inversionBaseM,
  KAPPA,
  NU_AIR,
  PR_NEUTRAL,
  psiH,
  psiM,
  specificHumidity,
  ZETA_MAX,
  ZETA_MIN
} from './surfacelayer.js';
import {refractionK} from './far-terrain.js';
import {AUTOCONVECTIVE_K_PER_M} from './fleagle.js';

const G = 9.80665;
const CP = 1004.7;
const R_DRY = 287.053;

// ---- The roughness classes (WMO-No. 8 Annex 5.B; Stull Table 18-1) --
export const DAVENPORT = [
  {cls: 1, name: 'sea', z0M: 0.0002, cdStull: 0.0014},
  {cls: 2, name: 'smooth', z0M: 0.005, cdStull: 0.0028},
  {cls: 3, name: 'open', z0M: 0.03, cdStull: 0.0047},
  {cls: 4, name: 'roughly open', z0M: 0.1, cdStull: 0.0075},
  {cls: 5, name: 'rough', z0M: 0.25, cdStull: 0.012},
  {cls: 6, name: 'very rough', z0M: 0.5, cdStull: 0.018},
  {cls: 7, name: 'closed', z0M: 1.0, cdStull: 0.03},
  {cls: 8, name: 'chaotic', z0M: 2.0, cdStull: 0.062}
];
export function davenportClass(cls) {
  return DAVENPORT[Math.min(8, Math.max(1, Math.round(cls))) - 1];
}
/** The neutral log law's drag coefficient at zM over z0M. */
export function cdLogLaw(z0M, zM = 10, kappa = KAPPA) {
  return (kappa / Math.log(zM / z0M)) ** 2;
}
// OSM's painted cover (landuse.js CLASS_ALBEDO's keys) to a Davenport
// class, after the Guide's descriptions and Oke's urban faces:
// built-up ground without much height variation is 'closed' (7), a
// mature forest the same; orchards, vineyards and farmyards are
// 'rough' (5: high crops, scattered obstacles); low crops 'roughly
// open' (4); grass of every use 'open' (3); allotments and cemeteries
// (hedges, trees, sheds in groups) 'very rough' (6); a quarry face
// 'roughly open'; bare rock and scree 'open'; sand, a beach and a
// glacier 'smooth' (2: "featureless land ... beaches, pack ice").
export const OSM_ROUGHNESS = {
  residential: 7,
  commercial: 7,
  retail: 7,
  industrial: 7,
  railway: 5,
  forest: 7,
  wood: 7,
  orchard: 5,
  vineyard: 5,
  farmyard: 5,
  farmland: 4,
  allotments: 6,
  cemetery: 6,
  grass: 3,
  meadow: 3,
  grassland: 3,
  village_green: 3,
  recreation_ground: 3,
  quarry: 4,
  bare_rock: 3,
  scree: 3,
  sand: 2,
  beach: 2,
  glacier: 2
};
// ---- The thermal roughness (Rigden, Li & Salvucci 2018) ---------
export const KB_INV_RIGDEN = {
  SHR: 3.5,
  GRA: 2.5,
  CRO: 1.75,
  DBF: 0.25,
  ENF: 0.75,
  ALL: 1.75
};
export const KB_BLUFF_C1 = {brutsaert: 2.46, kanda: 1.29};
export const NU_AIR_M2S = NU_AIR;
/** Eq. 10: kB^-1 = C1 Re*^0.25 - 2, Re* = u* z0 / nu. */
export function kbInvBluff(z0M, uStar, c1 = KB_BLUFF_C1.kanda) {
  const re = (Math.max(uStar, 1e-4) * z0M) / NU_AIR_M2S;
  return c1 * Math.pow(re, 0.25) - 2;
}
// The law each cover takes: built and bare ground the bluff-body law
// (Kanda's fit over built, Brutsaert's over bare), canopies Rigden's
// constants by their nearest AmeriFlux class (a forest the mean of
// the deciduous and evergreen fits; crops CRO; allotments and
// cemeteries the shrubland's; grass of every use GRA; unpainted
// ground - the theme's base grass - GRA).
export const KB_LAW_OF_OSM = {
  residential: {bluff: 'kanda'},
  commercial: {bluff: 'kanda'},
  retail: {bluff: 'kanda'},
  industrial: {bluff: 'kanda'},
  railway: {bluff: 'kanda'},
  forest: {constant: (KB_INV_RIGDEN.DBF + KB_INV_RIGDEN.ENF) / 2, of: 'DBF/ENF'},
  wood: {constant: (KB_INV_RIGDEN.DBF + KB_INV_RIGDEN.ENF) / 2, of: 'DBF/ENF'},
  orchard: {constant: KB_INV_RIGDEN.CRO, of: 'CRO'},
  vineyard: {constant: KB_INV_RIGDEN.CRO, of: 'CRO'},
  farmyard: {constant: KB_INV_RIGDEN.CRO, of: 'CRO'},
  farmland: {constant: KB_INV_RIGDEN.CRO, of: 'CRO'},
  allotments: {constant: KB_INV_RIGDEN.SHR, of: 'SHR'},
  cemetery: {constant: KB_INV_RIGDEN.SHR, of: 'SHR'},
  grass: {constant: KB_INV_RIGDEN.GRA, of: 'GRA'},
  meadow: {constant: KB_INV_RIGDEN.GRA, of: 'GRA'},
  grassland: {constant: KB_INV_RIGDEN.GRA, of: 'GRA'},
  village_green: {constant: KB_INV_RIGDEN.GRA, of: 'GRA'},
  recreation_ground: {constant: KB_INV_RIGDEN.GRA, of: 'GRA'},
  quarry: {bluff: 'brutsaert'},
  bare_rock: {bluff: 'brutsaert'},
  scree: {bluff: 'brutsaert'},
  sand: {bluff: 'brutsaert'},
  beach: {bluff: 'brutsaert'},
  glacier: {bluff: 'brutsaert'},
  open: {constant: KB_INV_RIGDEN.GRA, of: 'GRA'}
};
/** A cover's kB^-1 at a friction velocity over its own z0. */
export function kbInvOfLaw(law, z0M, uStar) {
  if (!law) return KB_INV_RIGDEN.ALL;
  if (law.bluff) return kbInvBluff(z0M, uStar, KB_BLUFF_C1[law.bluff]);
  return law.constant;
}
/** The Guide's effective roughness: exp of the fraction-weighted mean
 * of ln z0 over the parts [{frac, z0M}]. */
export function effectiveZ0(parts) {
  let s = 0;
  let f = 0;
  for (const p of parts) {
    if (!(p.frac > 0) || !(p.z0M > 0)) continue;
    s += p.frac * Math.log(p.z0M);
    f += p.frac;
  }
  return f > 0 ? Math.exp(s / f) : NaN;
}
/** Even-odd test of a point against a polygon's rings ([[lat, lon],
 * ...] each; outer and inner rings alike - a hole toggles twice). */
export function insidePolygon(rings, lat, lon) {
  let inside = false;
  for (const ring of rings) {
    const n = ring.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const yi = ring[i][0];
      const xi = ring[i][1];
      const yj = ring[j][0];
      const xj = ring[j][1];
      if (yi > lat !== yj > lat) {
        const x = xj + ((lat - yj) * (xi - xj)) / (yi - yj);
        if (lon < x) inside = !inside;
      }
    }
  }
  return inside;
}
/**
 * THE FOOTPRINT'S ROUGHNESS: the painted cover (landuse.js's polygons
 * [{cls, rings, area}], largest first - the later, smaller parcel
 * wins a point, as the paint does) sampled on an n x n grid over the
 * disc of radiusM around the point, every sample classed by its
 * cover (defaultCls where none is painted - the theme's base grass,
 * class 3 'open'), the Guide's ln-averaged z0 over the samples, and
 * the covers' thermal-roughness laws combined the same way: the
 * fraction-weighted mean of kB^-1 IS the ln-average of z0h, so
 * kbInvAt(u*) is the footprint's own. Returns {sampled, radiusM,
 * byClass, byOsm, covers: [{osm, cls, frac, z0M, law}], z0M,
 * kbInvAt, kbInvNeutral, bluffFrac, dominant: {name, frac}}.
 */
export function roughnessCensus(
  polys,
  lat0,
  lon0,
  {
    radiusM = 1000,
    n = 41,
    defaultCls = 3,
    mapping = OSM_ROUGHNESS,
    laws = KB_LAW_OF_OSM
  } = {}
) {
  const mPerLat = 111195;
  const mPerLon = 111195 * Math.cos((lat0 * Math.PI) / 180);
  const list = Array.isArray(polys) ? polys : [];
  const byOsm = {};
  const byClass = {};
  let sampled = 0;
  for (let a = 0; a < n; a++) {
    const dy = (-1 + (2 * a) / (n - 1)) * radiusM;
    for (let b = 0; b < n; b++) {
      const dx = (-1 + (2 * b) / (n - 1)) * radiusM;
      if (dx * dx + dy * dy > radiusM * radiusM) continue;
      const lat = lat0 + dy / mPerLat;
      const lon = lon0 + dx / mPerLon;
      let osm = 'open';
      for (let k = list.length - 1; k >= 0; k--) {
        const p = list[k];
        if (!p || !p.rings || !(p.cls in mapping)) continue;
        if (insidePolygon(p.rings, lat, lon)) {
          osm = p.cls;
          break;
        }
      }
      const cls = osm === 'open' ? defaultCls : mapping[osm];
      byOsm[osm] = (byOsm[osm] || 0) + 1;
      byClass[cls] = (byClass[cls] || 0) + 1;
      sampled++;
    }
  }
  const covers = Object.entries(byOsm)
    .map(([osm, cnt]) => {
      const cls = osm === 'open' ? defaultCls : mapping[osm];
      return {
        osm,
        cls,
        frac: cnt / sampled,
        z0M: davenportClass(cls).z0M,
        law: laws[osm] ?? laws.open
      };
    })
    .sort((a, b) => b.frac - a.frac);
  const z0M = effectiveZ0(covers);
  const kbInvAt = (uStar) =>
    covers.reduce((s, c) => s + c.frac * kbInvOfLaw(c.law, c.z0M, uStar), 0);
  const bluffFrac = covers.reduce(
    (s, c) => s + (c.law && c.law.bluff ? c.frac : 0),
    0
  );
  return {
    sampled,
    radiusM,
    byClass,
    byOsm,
    covers,
    z0M,
    kbInvAt,
    kbInvNeutral: kbInvAt(0.3),
    bluffFrac,
    dominant: covers.length
      ? {name: covers[0].osm, cls: covers[0].cls, frac: covers[0].frac}
      : {name: 'open', cls: defaultCls, frac: 1}
  };
}

// ---- The bulk solution over a prescribed roughness ----------------
const clampZeta = (z) => Math.min(ZETA_MAX, Math.max(ZETA_MIN, z));
/**
 * Monin-Obukhov similarity over land: the wind at zuM, the air at
 * ztM (with its relative humidity for the virtual temperature), the
 * skin tsC, the pressure, the footprint's z0 and its kB^-1 (a number,
 * or a function of u* for the bluff law), the boundary-layer depth
 * for COARE's gustiness. Fixed-point iteration on the Kansas
 * profiles (z0 prescribed, z0h = z0 exp(-kB^-1) re-evaluated at the
 * current u*). Returns u*, theta* (Businger's k-carrying definition),
 * L, the gust, the density at the thermometer and the sensible flux
 * (positive when the ground heats the air), and the profile
 * functions tAt / thetaAt / uAt (z above the ground).
 */
export function landBulk({
  uMs,
  zuM = 10,
  taC,
  ztM = 2,
  tsC,
  pPa = 101325,
  z0M = 0.03,
  kbInv = KB_INV_RIGDEN.ALL,
  rhFrac = null,
  bliM = 1000
}) {
  const kbOf = typeof kbInv === 'function' ? kbInv : () => kbInv;
  const tK = taC + 273.15;
  const thetaA = taC + (G / CP) * ztM;
  const thetaS = tsC;
  const dTheta = thetaA - thetaS;
  const qA =
    Number.isFinite(rhFrac) && rhFrac > 0
      ? specificHumidity(Math.min(1, rhFrac) * eSatPa(taC), pPa)
      : 0;
  const tV = tK * (1 + 0.61 * qA);
  const zi = Number.isFinite(bliM) && bliM > 0 ? bliM : 1000;
  let uStar = 0.3;
  let thetaStar = 0;
  let L = Infinity;
  let gust = 0;
  let kb = kbOf(uStar);
  let z0h = z0M * Math.exp(-kb);
  let iter = 0;
  for (iter = 0; iter < 80; iter++) {
    const S = Math.sqrt(uMs * uMs + gust * gust);
    const zetaU = Number.isFinite(L) ? clampZeta(zuM / L) : 0;
    const zetaT = Number.isFinite(L) ? clampZeta(ztM / L) : 0;
    kb = kbOf(Math.max(uStar, 1e-3));
    z0h = z0M * Math.exp(-kb);
    const uNew =
      (KAPPA * Math.max(S, 0.05)) / (Math.log(zuM / z0M) - psiM(zetaU));
    const denomT =
      PR_NEUTRAL * (Math.log(ztM / Math.min(z0h, ztM / 2)) - psiH(zetaT));
    const tNew = dTheta / denomT;
    const tvStar = tNew * (1 + 0.61 * qA);
    const LNew =
      Math.abs(tvStar) < 1e-9
        ? Infinity
        : (tV * uNew * uNew) / (KAPPA * KAPPA * G * tvStar);
    const wtv = -KAPPA * uNew * tvStar;
    gust = wtv > 0 ? GUST_BETA * Math.cbrt((G / tV) * wtv * zi) : 0;
    const dU = Math.abs(uNew - uStar);
    const dT = Math.abs(tNew - thetaStar);
    uStar = 0.5 * uStar + 0.5 * uNew;
    thetaStar = 0.5 * thetaStar + 0.5 * tNew;
    L = LNew;
    if (iter > 5 && dU < 1e-9 && dT < 1e-9) break;
  }
  const Ptq = pPa / 100 - 0.125 * ztM;
  const rhoA = (Ptq * 100) / (R_DRY * tK * (1 + 0.61 * qA));
  const z0hUse = Math.min(z0h, ztM / 2);
  const zeta = (z) => (Number.isFinite(L) ? clampZeta(z / L) : 0);
  const thetaAt = (z) => {
    const zz = Math.max(z, z0hUse);
    return thetaS + thetaStar * PR_NEUTRAL * (Math.log(zz / z0hUse) - psiH(zeta(zz)));
  };
  return {
    uStar,
    thetaStar,
    L,
    zetaU: Number.isFinite(L) ? zuM / L : 0,
    clamped:
      Number.isFinite(L) && (zuM / L < ZETA_MIN || zuM / L > ZETA_MAX),
    z0: z0M,
    z0h,
    kbInv: kb,
    gust,
    rhoA,
    qA,
    dTheta,
    thetaS,
    hsbWm2: -rhoA * CP * KAPPA * uStar * thetaStar,
    iterations: iter,
    thetaAt,
    /** Actual temperature at z above the ground (C). */
    tAt: (z) => thetaAt(z) - (G / CP) * Math.max(z, z0hUse),
    uAt: (z) => {
      const zz = Math.max(z, z0M);
      return (uStar / KAPPA) * (Math.log(zz / z0M) - psiM(zeta(zz)));
    }
  };
}
/** What the thermal-roughness choice moves: the bulk re-solved for
 * each kB^-1 in kbs (numbers or functions of u*): [{kbInv, uStar,
 * thetaStar, hsbWm2, lapseKm (2-10 m)}]. */
export function kbSensitivity(args, kbs) {
  return kbs.map((kb) => {
    const mo = landBulk({...args, kbInv: kb});
    return {
      kbInv: mo.kbInv,
      uStar: mo.uStar,
      thetaStar: mo.thetaStar,
      hsbWm2: mo.hsbWm2,
      lapseKm: ((mo.tAt(10) - mo.tAt(2)) / 8) * 1000
    };
  });
}
// ---- The film's verdicts --------------------------------------------
/**
 * Fleagle's test layer by layer: the film's lapse over each [zA, zB]
 * against the autoconvective rate g/R (34.16 K/km; steeper - more
 * negative - and rays bend upward, the inferior mirage's condition).
 * filmTopM: the top of the contiguous super-autoconvective layers
 * from the ground, null when the lowest is not.
 */
export const AUTOCONVECTIVE_LAYERS = [
  [0.5, 1],
  [1, 2],
  [2, 4],
  [4, 8],
  [8, 16],
  [16, 32],
  [32, 64],
  [64, 100]
];
export function autoconvective(mo, layers = AUTOCONVECTIVE_LAYERS) {
  const rateKm = -AUTOCONVECTIVE_K_PER_M * 1000;
  const out = layers.map(([zA, zB]) => {
    const lapseKm = ((mo.tAt(zB) - mo.tAt(zA)) / (zB - zA)) * 1000;
    return {zA, zB, lapseKm, super: lapseKm < rateKm};
  });
  let filmTopM = null;
  for (const l of out) {
    if (!l.super) break;
    filmTopM = l.zB;
  }
  return {rateKm, layers: out, filmTopM};
}
/** Hirt's coefficient over the land: the pressure and the film's own
 * mean temperature and gradient between zA and zB above the ground
 * (the eye's 2-100 m by default - the far ring's own layer). */
export function landRefractionK(mo, pPa, {zA = 2, zB = 100} = {}) {
  const tA = mo.tAt(zA);
  const tB = mo.tAt(zB);
  const tMeanK = (tA + tB) / 2 + 273.15;
  return refractionK(pPa / 100, tMeanK, (tB - tA) / (zB - zA));
}
// ---- The composed column ---------------------------------------------
/**
 * The LAND column under the balloon: the similarity film from the
 * ground (h0M absolute; the ascent's own floor when null) to topM,
 * tagged 'land'; a modelled mixed layer blending to the balloon at
 * the join (the ascent's first capping inversion above skipM, else
 * its mixed-layer depth, else just above the film) tagged 'mixed';
 * the ascent above, tagged 'balloon' - marineColumnRows's own
 * composition with the roughness prescribed. met: {uMs, zuM, taC,
 * ztM, tsC, pPa?, rhFrac?}. Rows are daemon-shape [{p hPa, hM, tC,
 * rh, src}]. Returns {rows, mo, filmTopM, modelBand, joinM, pSurfPa,
 * h0M} or null when the ascent is too short.
 */
export function landColumnRows(
  balloonRows,
  met,
  {z0M = 0.03, kbInv = KB_INV_RIGDEN.ALL, h0M = null, topM = 100, skipM = 30, bliM = null} = {}
) {
  if (!Array.isArray(balloonRows) || balloonRows.length < 5) return null;
  const hb = balloonRows[0].hM;
  const h0 = Number.isFinite(h0M) ? h0M : hb;
  const base = inversionBaseM(balloonRows, hb + skipM, hb + 2500);
  const zJoin =
    base !== null && base > h0 + topM + 20
      ? base
      : Number.isFinite(bliM) && bliM > topM + 50
        ? hb + bliM
        : Math.max(hb + skipM, h0 + topM + 30);
  const kept = balloonRows.filter((q) => q.hM >= zJoin);
  if (kept.length < 5) return null;
  const tb = balloonRows[0].tC + 273.15;
  const pSurf = Number.isFinite(met.pPa)
    ? met.pPa
    : balloonRows[0].p * 100 * Math.exp((-(h0 - hb) * G) / (R_DRY * tb));
  const mo = landBulk({
    uMs: met.uMs,
    zuM: met.zuM ?? 10,
    taC: met.taC,
    ztM: met.ztM ?? 2,
    tsC: met.tsC,
    pPa: pSurf,
    z0M,
    kbInv,
    rhFrac: met.rhFrac ?? null,
    bliM: bliM ?? 1000
  });
  const first = kept[0];
  const zTop = Math.min(topM, Math.max(5, first.hM - h0 - 5));
  const rhRef = Number.isFinite(met.rhFrac)
    ? met.rhFrac
    : (balloonRows[0].rh ?? first.rh ?? 50) / 100;
  const out = [];
  let p = pSurf;
  let zPrev = 0;
  let tPrev = null;
  const push = (z, tC, rh, src) => {
    if (tPrev !== null && z > zPrev) {
      const tMean = (tPrev + tC) / 2 + 273.15;
      p *= Math.exp((-(z - zPrev) * G) / (R_DRY * tMean));
    }
    out.push({p: p / 100, hM: h0 + z, tC, rh: Math.round(rh * 100), src});
    zPrev = z;
    tPrev = tC;
  };
  // the film's humidity: the screen's own vapour pressure held (no
  // surface humidity is measured), so rh follows the temperature
  const eAir = rhRef * eSatPa(met.taC);
  const rhOf = (tC) => Math.min(1, Math.max(0, eAir / eSatPa(tC)));
  const zs = [0, 0.1, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 100].filter(
    (z) => z <= zTop
  );
  if (zs[zs.length - 1] < zTop) zs.push(zTop);
  for (const z of zs) push(z, mo.tAt(z), rhOf(mo.tAt(z)), 'land');
  const thetaMix = mo.thetaAt(zTop);
  let mixedTop = zTop;
  const firstZ = first.hM - h0;
  if (firstZ > zTop + 20) {
    const tAtMix = (z) => thetaMix - (G / CP) * z;
    const zBlend = Math.max(zTop, firstZ - 150);
    const zs2 = [];
    for (let z = zTop + 100; z < zBlend; z += 100) zs2.push(z);
    for (let z = zBlend; z < firstZ - 1; z += 30) zs2.push(z);
    for (const z of zs2) {
      let tC = tAtMix(z);
      if (z >= zBlend) {
        const f = (z - zBlend) / (firstZ - zBlend);
        tC = tAtMix(zBlend) + f * (first.tC - tAtMix(zBlend));
      }
      push(z, tC, rhOf(tC), 'mixed');
      mixedTop = z;
    }
  }
  for (const q of kept)
    push(q.hM - h0, q.tC, (q.rh ?? rhRef * 100) / 100, 'balloon');
  return {
    rows: out,
    mo,
    filmTopM: zTop,
    modelBand: mixedTop > zTop ? [h0 + zTop, first.hM] : null,
    joinM: first.hM,
    pSurfPa: pSurf,
    h0M: h0
  };
}
