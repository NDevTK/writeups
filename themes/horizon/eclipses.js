/**
 * Eclipses - the single source shared by the theme
 * (Horizon.html) and the reference printer
 * (eclipses-reference.mjs).
 *
 * Replaces the theme's first-pass eclipse code, which used the
 * linear MAGNITUDE (fraction of the sun's DIAMETER covered) with
 * a fixed 0.267-deg sun to dim the light. Both were
 * approximations of exactly the kind this project exists to
 * remove:
 *  - illuminance follows the covered AREA (the two-disc lens
 *    integral, closed form below): at magnitude 0.5 the true
 *    obscuration is 0.391, not 0.5 - the old code over-darkened
 *    every partial phase by up to ~30%
 *  - the sun's angular radius swings +-1.7% over the year (959.63
 *    arcsec at 1 AU - the IAU photospheric radius over the true
 *    VSOP87 distance), and that swing is the entire difference
 *    between a TOTAL and an ANNULAR eclipse
 *
 * Solar: topocentric separation (the theme already has it) against
 * the two TRUE disc radii; discObscuration() gives the covered
 * fraction of the photosphere with the exact circle-circle lens
 * area, including the annular branch (fraction = (r_m/r_s)^2 when
 * the moon sits inside the sun's disc).
 *
 * Lunar: the classical geocentric shadow construction (Chauvenet;
 * the 2% shadow enlargement is Danjon's rule for the terrestrial
 * atmosphere - the same rule the Astronomical Almanac applies):
 *   umbra    = 1.02 (pi_moon + pi_sun - s_sun)
 *   penumbra = 1.02 (pi_moon + pi_sun + s_sun)
 * with the parallaxes and solar radius from the true distances,
 * measured from the ANTISOLAR point. The umbral magnitude
 * (u + r_m - sep) / (2 r_m) drives the copper darkening of the
 * moon disc - during totality the moon glows with light refracted
 * through every sunrise and sunset on Earth at once.
 *
 * The ephemerides are astronomy-engine (vendored; VSOP87/ELP) -
 * the same instance the theme drives; reference-gated here
 * against PUBLISHED history: the 2024-04-08 Dallas totality, the
 * upcoming 2026-08-12 totality over Galicia, and the 2026-03-03
 * total lunar eclipse.
 */

export const R_SUN_KM = 696000; // IAU photospheric radius
export const R_MOON_KM = 1737.4;
export const R_EARTH_EQ_KM = 6378.137;
export const DANJON = 1.02; // shadow enlargement (Danjon's rule)

// Fraction of disc 1 (the sun) covered by disc 2 (the moon):
// exact two-circle lens area. All angles in radians (small-angle
// safe: these are ~0.005 rad discs).
export function discObscuration(sep, rSun, rMoon) {
  if (sep >= rSun + rMoon) return 0;
  if (sep <= rMoon - rSun) return 1; // total
  if (sep <= rSun - rMoon) return (rMoon * rMoon) / (rSun * rSun); // annular
  const d = Math.max(sep, 1e-12);
  const a1 =
    rSun *
    rSun *
    Math.acos((d * d + rSun * rSun - rMoon * rMoon) / (2 * d * rSun));
  const a2 =
    rMoon *
    rMoon *
    Math.acos((d * d + rMoon * rMoon - rSun * rSun) / (2 * d * rMoon));
  const tri =
    0.5 *
    Math.sqrt(
      Math.max(
        (-d + rSun + rMoon) *
          (d + rSun - rMoon) *
          (d - rSun + rMoon) *
          (d + rSun + rMoon),
        0
      )
    );
  return (a1 + a2 - tri) / (Math.PI * rSun * rSun);
}

// Solar eclipse at the observer: separation (rad, topocentric)
// plus the TRUE distances (km) -> obscuration (area fraction,
// what the light does) and magnitude (diameter fraction, what
// the almanacs quote).
export function solarEclipse(sepRad, distSunKm, distMoonKm) {
  const rSun = Math.asin(R_SUN_KM / distSunKm);
  const rMoon = Math.asin(R_MOON_KM / distMoonKm);
  const obsc = discObscuration(sepRad, rSun, rMoon);
  const mag = Math.max((rSun + rMoon - sepRad) / (2 * rSun), 0);
  return {obsc, mag, rSun, rMoon, annular: rMoon < rSun && obsc > 0};
}

// Lunar eclipse circumstances from geocentric positions: the
// moon's angular separation from the ANTISOLAR point (rad) and
// the two true distances. Returns the penumbral and umbral
// magnitudes (almanac convention) and the umbral IMMERSION
// fraction (0..1 area, driving the copper darkening).
export function lunarEclipse(sepAntisolarRad, distSunKm, distMoonKm) {
  const piM = Math.asin(R_EARTH_EQ_KM / distMoonKm);
  const piS = Math.asin(R_EARTH_EQ_KM / distSunKm);
  const sS = Math.asin(R_SUN_KM / distSunKm);
  const umbra = DANJON * (piM + piS - sS);
  const penumbra = DANJON * (piM + piS + sS);
  const rM = Math.asin(R_MOON_KM / distMoonKm);
  const umbraMag = (umbra + rM - sepAntisolarRad) / (2 * rM);
  const penMag = (penumbra + rM - sepAntisolarRad) / (2 * rM);
  // area immersion in the umbra: the same lens integral with the
  // umbra as the "sun" disc and the moon as the cover, read the
  // other way round (fraction of the MOON inside the umbra)
  const inUmbra =
    (discObscuration(sepAntisolarRad, umbra, rM) * (Math.PI * umbra * umbra)) /
    (Math.PI * rM * rM);
  return {
    umbraMag,
    penMag,
    umbra,
    penumbra,
    rMoon: rM,
    inUmbra: Math.min(inUmbra, 1)
  };
}
