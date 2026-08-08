/**
 * seasmoke.js - arctic sea smoke (steam fog) over open water:
 * the steaming-sea mornings when bitter air crosses warm water.
 *
 * Source (read in full): Shen, Li, Yan, Perrie, Zhang & Zhu 2022
 * (J. Atmos. Sci. 79, 3163, JAS-D-22-0065.1) - the Qingdao
 * "Hai Hao" sea smoke of 7 January 2021, observed by two buoys,
 * Himawari-8, GOCI and Sentinel-1B SAR and reproduced with a
 * coupled ROMS-WRF simulation. Their Table 1 prints the
 * century-old classification of sea fog by the air-sea
 * temperature difference (ASTD = SST - SAT): SAT > SST is warm
 * advection fog, SAT < SST cold advection fog, and SAT << SST
 * the sea smoke of the Willett 1928 / Saunders 1964 lineage,
 * exactly as the paper tabulates it. The case pins the numbers:
 * ASTD ~ 20 C (buoy air temperature -13.3 C, relative humidity
 * 89.0 percent, "looked like the steam on the surface of
 * boiling water", a layer only a few metres deep) with a
 * simulated lowest visibility of 3.09 km - against the printed
 * typical winter ASTD of 5-7 C in the same sea "with no fog"
 * (Zhu et al. 2018 as printed there) and the 2006 large
 * cold-advection fog event at ASTD ~ 3 C (fog, but not smoke).
 *
 * The gate this module ships: smoke amount scales linearly in
 * the ASTD excess above the printed no-fog band top (the
 * neutral interpolation between the two printed anchors), and
 * since Koschmieder visibility is inverse in extinction, the
 * smoke's own visibility is
 *   vis = VIS_EVENT x (EVENT - NOFOG) / (ASTD - NOFOG),
 * reaching the printed 3.09 km exactly at the printed 20 C and
 * releasing to infinity at the printed no-fog band. The theme
 * folds it as min(measured visibility, smoke visibility): when
 * the weather model already sees the fog, the MEASURED value
 * stays authoritative (the paper's own division - their event
 * was too shallow for the passive satellites, which is why sea
 * smoke is the case a visibility feed most plausibly misses).
 * The paper also prints that sea fog may "propagate inland by
 * the sea breeze to decrease local visibility" - the licence
 * for folding a coastal visitor's whole-scene visibility rather
 * than the water pixels alone.
 */

export const SMOKE_ASTD_NOFOG = 7; // C - printed top of the no-fog band
export const SMOKE_ASTD_EVENT = 20; // C - the printed 2021 event
export const SMOKE_VIS_EVENT_M = 3090; // m - printed lowest visibility

// Table 1's classification by the sign and size of ASTD.
export function seaFogClass(sstC, satC) {
  const astd = sstC - satC;
  if (astd < 0) return 'warm-advection';
  return astd > SMOKE_ASTD_NOFOG ? 'sea-smoke' : 'cold-advection';
}

// The smoke's own Koschmieder visibility (m): infinity at and
// below the printed no-fog band, the printed 3.09 km at the
// printed event, linear-in-density between and beyond.
export function seaSmokeVisM(sstC, satC) {
  const astd = sstC - satC;
  const t = (astd - SMOKE_ASTD_NOFOG) / (SMOKE_ASTD_EVENT - SMOKE_ASTD_NOFOG);
  if (!(t > 0)) return Infinity;
  return SMOKE_VIS_EVENT_M / t;
}
