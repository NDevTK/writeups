/**
 * Nightglow (airglow) line emission - the single source shared by
 * the sky dome material (sky-objects-tsl.js mirrors the math in
 * TSL) and the reference printer (airglow-reference.mjs).
 *
 * Model: PALACE v1.0, the Paranal Airglow Line And Continuum
 * Emission model (Noll et al. 2025, arXiv:2504.10683), built from
 * ten years of VLT X-shooter spectra. The display carries its three
 * dominant VISIBLE line groups, with reference intensities (annual
 * nocturnal zenith means at solar radio flux 100 sfu), emission
 * layer heights (PALACE Table 2) and solar-cycle slopes m_SCE
 * (PALACE Table 4) verbatim:
 *   [OI] 557.7 nm green line  163 R    97 km   m_SCE +0.754
 *   [OI] 630.0 + 636.4 nm     123+41 R 250 km  m_SCE +1.432
 *   Na D 589.0 + 589.6 nm     36.5 R   92 km   m_SCE +0.235
 * (PALACE Sects. 4.3/4.5: the green line is the Barth mechanism in
 * the mesopause; the red doublet is ionospheric O(1D), which is why
 * it sits at 250 km and swings hardest with the solar cycle; Na D
 * is the meteoric-metal layer.)
 *
 * Solar activity (PALACE Eq. 1 with the annual-mean climatology
 * f0 = 1): f(srf) = 1 + 0.01 m_SCE (srf - 100), srf the 10.7 cm
 * solar radio flux in sfu - MEASURED live from the NOAA SWPC F10.7
 * feed (PALACE regressed on centred 27-day averages; the display
 * uses the trailing 27-day mean).
 *
 * Geometry (PALACE Eq. 3, van Rhijn 1921): a thin layer at height h
 * brightens toward the horizon as
 *   V(z) = [1 - (R sin z / (R + h))^2]^(-1/2),  R = 6371 km,
 * peaking at 5.8x for the 97 km green line - the airglow ring low
 * in all-sky photographs. Extinction then eats it right at the
 * horizon: transmission follows the engine's OWN Hillaire zenith
 * transmittance raised to the Rozenberg (1966) airmass
 *   X(z) = [cos z + 0.025 e^(-11 cos z)]^(-1)
 * (the same T_ref^X pattern PALACE Eq. 4 uses; X saturates at 40 on
 * the horizon instead of diverging).
 *
 * Units: 1 R = 10^10/(4 pi) photons s^-1 m^-2 sr^-1 (PALACE
 * Sect. 2), so a line's energy radiance is that times hc/lambda -
 * the green line's 163 R is ~3e-5 cd m^-2, a solid fraction of the
 * canonical 21.9 mag arcsec^-2 moonless sky. Relative line weights
 * in the shader are exact; ONE display gain (AGLOW_GAIN) exposes
 * the whole effect, the same physical-structure/documented-exposure
 * pattern as the aurora curtains.
 */

export const R_EARTH = 6371e3; // m (PALACE Eq. 3 uses the mean radius)

// {air wavelength nm, reference intensity R at 100 sfu, layer
// height km, solar-cycle slope m_SCE per 100 sfu} - PALACE
// Tables 2/4 and Sect. 4.5/4.3. The red doublet is carried at its
// intensity-weighted wavelength (123 R at 630.0, 41 R at 636.4).
export const LINES = [
  {name: 'OI557', lam: 557.7, refR: 163, hKm: 97, msce: 0.754},
  {name: 'OIred', lam: 631.6, refR: 164, hKm: 250, msce: 1.432},
  {name: 'NaD', lam: 589.3, refR: 36.5, hKm: 92, msce: 0.235}
];

// PALACE Eq. 1 with f0 = 1 (annual nocturnal mean climatology).
export function palaceSolar(msce, srf) {
  return Math.max(1 + 0.01 * msce * (srf - 100), 0);
}

// van Rhijn (1921) layer enhancement, PALACE Eq. 3; cosZ >= 0.
export function vanRhijn(cosZ, hKm) {
  const q = R_EARTH / (R_EARTH + hKm * 1e3);
  const s2 = Math.max(1 - cosZ * cosZ, 0);
  return 1 / Math.sqrt(1 - q * q * s2);
}

// Rozenberg (1966) airmass, PALACE Eq. 5: 1 at zenith, 40 on the
// horizon.
export function rozenbergX(cosZ) {
  return 1 / (cosZ + 0.025 * Math.exp(-11 * cosZ));
}

// Energy radiance of a line (W m^-2 sr^-1) from its Rayleigh
// intensity: 1 R = 1e10/(4 pi) photons s^-1 m^-2 sr^-1, photon
// energy hc/lambda.
export function lineRadiance(refR, lamNm) {
  const H = 6.62607015e-34;
  const C = 2.99792458e8;
  return ((refR * 1e10) / (4 * Math.PI)) * ((H * C) / (lamNm * 1e-9));
}

// Photopic luminance (cd m^-2) of a line, for the reference
// printer's absolute sanity check against the dark-sky canon.
export function lineLuminance(refR, lamNm, vLambda) {
  return 683 * vLambda * lineRadiance(refR, lamNm);
}

// CIE 1931 photopic Y (luminous efficiency) - the same Wyman,
// Sloan & Shirley (2013) multi-lobe fit the aurora's colour
// conversion uses. Needed here because wavelengthToLinearSRGB
// peak-normalises each line's colour (spectral lines sit outside
// sRGB), which strips V(lambda) - so the LUMINANCE must be restored
// in the line weights: Y(557.7) ~ 1.0, Y(589.3) ~ 0.77,
// Y(631.6) ~ 0.25, matching the CIE table values.
export function cieY(nm) {
  const g = (mu, s1, s2) => {
    const s = nm < mu ? s1 : s2;
    const t = (nm - mu) / s;
    return Math.exp(-0.5 * t * t);
  };
  return 0.821 * g(568.8, 46.9, 40.5) + 0.286 * g(530.9, 16.3, 31.1);
}

// The shader's per-line strengths: LUMINANCE-weighted (energy
// radiance times V(lambda) - what the eye actually receives),
// normalised so the green line at 100 sfu is exactly 1 - the
// display gain then carries all absolute exposure. The green line
// dominates (the airglow looks green), with the red doublet
// overtaking only at high solar activity via its steep m_SCE.
export function lineStrengths(srf) {
  const lum = (l) => lineRadiance(l.refR, l.lam) * cieY(l.lam);
  const ref = lum(LINES[0]);
  return LINES.map((l) => (lum(l) / ref) * palaceSolar(l.msce, srf));
}

// One documented display exposure for the whole effect (applied to
// the exact relative structure above): a barely-perceptible zenith
// tint that grows into the van Rhijn horizon band, matching the
// ~20%-of-dark-sky luminance the green line really carries.
export const AGLOW_GAIN = 0.015;
