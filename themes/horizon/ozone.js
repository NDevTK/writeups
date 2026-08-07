/**
 * ozone.js - the sky's MEASURED total-column ozone, replacing the
 * fixed 300 DU the atmosphere constants encode. Gated by
 * ozone-reference.mjs.
 *
 * The atmosphere's ozone term (Hillaire 2020 Table 1, via Bruneton)
 * is a tent profile of width 30 km centred at 25 km with absorption
 * 0.650/1.881/0.085 e-6 /m at the channel wavelengths. Bruneton's
 * own reference implementation CONSTRUCTS those numbers from a
 * fixed column: "computed so as to get 300 Dobson units of ozone -
 * for this we divide 300 DU by the integral of the ozone density
 * profile ... which is equal to 15km"
 * (precomputed_atmospheric_scattering demo.cc, read from the
 * source; cross-sections from the Bremen IUP O3 spectra at 233 K).
 * The real column is measured every day and swings roughly 220-460
 * DU with season and latitude - and under an Antarctic-spring
 * ozone hole it has been measured below 100 DU. Absorption is
 * LINEAR in the column (Beer-Lambert with a fixed profile shape),
 * so the exact correction is one scale factor DU/300 on the ozone
 * term everywhere it appears - transmittance, every march, the CPU
 * sun-transmittance twin. The tent SHAPE stays (the profile's
 * seasonal shape change is second order next to the column swing;
 * documented scope).
 *
 * The measurement rides the operational GFS: NOMADS publishes
 * TOZNE (WMO code table 4.2, discipline 0, category 14, parameter
 * 0 - "Total ozone", DU) per 0.25-deg cell, and the grib filter's
 * subregion extraction re-packs to simple packing, so the gated
 * grib2.js decodes it unchanged. The daemon serves one cell per
 * request exactly like /aerosol.
 */

// The reference column the shipped constants encode - Bruneton's
// own printed construction, not a choice made here.
export const OZONE_REF_DU = 300;

// Sanity bounds (DU) guarding decode corruption, wide of every
// measured extreme (the 1994 Antarctic-hole minima sat in the 70s;
// high-latitude spring maxima reach the 600s). Outside them the
// census fails CLOSED - no measurement, scale 1.
export const DU_MIN = 70;
export const DU_MAX = 700;

/**
 * Census of decoded GRIB2 messages at (lat, lon): the total-ozone
 * value in DU, or null when no valid TOZNE message is present.
 * gridValue is injected (grib2.js) so this module stays pure.
 */
export function ozoneCensus(msgs, lat, lon, gridValue) {
  for (const m of msgs || []) {
    if (m.discipline !== 0 || m.paramCategory !== 14 || m.paramNumber !== 0)
      continue;
    const v = gridValue(m, lat, lon);
    if (!Number.isFinite(v) || v < DU_MIN || v > DU_MAX) continue;
    return {
      du: v,
      refTime: m.refTime || null,
      forecastHours: m.forecastHours ?? null
    };
  }
  return null;
}

// The exact linear correction: the ozone absorption everywhere is
// the shipped constants times this. 300 DU -> 1 identically.
export function ozoneScale(du) {
  if (!Number.isFinite(du) || du < DU_MIN || du > DU_MAX) return 1;
  return du / OZONE_REF_DU;
}
