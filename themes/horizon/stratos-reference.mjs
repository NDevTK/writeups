// Reference gate for stratos.js (node stratos-reference.mjs): the
// stratospheric layer's printed amplitude chain and Lee &
// Hernandez-Andres 2003's printed twilight window, emergent.
import {
  stratAOD532,
  stratLayerRadiance,
  EXT_FRAC,
  EXT_FRAC_RANGE,
  MOL_LIDAR_SR,
  STRAT_BASE_M,
  STRAT_TOP_M
} from './stratos.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const D2R = Math.PI / 180;
const mieS0 = 3.996e-6; // the Hillaire default set (atmo-reference)
const MIE = {
  scat: [mieS0, mieS0, mieS0],
  abs: [mieS0 / 9, mieS0 / 9, mieS0 / 9]
};
const lum = (L) => 0.2126 * L[0] + 0.7152 * L[1] + 0.0722 * L[2];

{
  // The amplitude chain: printed backscatter fraction (5-10%
  // above molecular) x printed lidar ratio (45-50 sr) over the
  // exact molecular 8 pi / 3 -> extinction fraction 0.27..0.60
  // (log-mid 0.40); through the shipped Rayleigh profile over
  // the printed 15-25 km layer that is a background AOD(532) of
  // 3.6e-3..8.1e-3 - overlapping the review's own quiescent
  // record (~0.003-0.006, Fig. 4/10).
  const aod = stratAOD532();
  const lo = (aod / EXT_FRAC) * EXT_FRAC_RANGE[0];
  const hi = (aod / EXT_FRAC) * EXT_FRAC_RANGE[1];
  const ok =
    STRAT_BASE_M === 15000 &&
    STRAT_TOP_M === 25000 &&
    Math.abs(MOL_LIDAR_SR - (8 * Math.PI) / 3) < 1e-12 &&
    Math.abs(EXT_FRAC - 0.4004) < 5e-4 &&
    Math.abs(EXT_FRAC_RANGE[0] - 0.2686) < 5e-4 &&
    Math.abs(EXT_FRAC_RANGE[1] - 0.5968) < 5e-4 &&
    aod > 4e-3 &&
    aod < 7e-3 &&
    lo < 6e-3 &&
    hi > 3e-3;
  check(
    'printed amplitude chain',
    ok,
    `ext fraction ${EXT_FRAC.toFixed(4)} of molecular (printed 0.27..0.60); AOD532 ${aod.toExponential(2)} in [${lo.toExponential(2)}, ${hi.toExponential(2)}] vs quiescent record ~3e-3..6e-3`
  );
}

{
  // Lee Table 2 at view elevation 20 deg toward the sun: the
  // term is alive at the printed START (h0 = -1.41: 70% of its
  // sunset value), strongly reddened but still substantial at
  // the printed PURITY PEAK (-3.89: R/B x40, 16% amplitude),
  // and hard-shadowed by -6 (the straight-line end at this
  // view; the printed -7.37 end carries the lower-sky tail -
  // next landmark).
  const L0 = stratLayerRadiance(20 * D2R, 0, 0, MIE);
  const Ls = stratLayerRadiance(20 * D2R, 0, -1.41 * D2R, MIE);
  const Lp = stratLayerRadiance(20 * D2R, 0, -3.89 * D2R, MIE);
  const Le = stratLayerRadiance(20 * D2R, 0, -6 * D2R, MIE);
  const rbSunset = L0[0] / L0[2];
  const rbPeak = Lp[0] / Lp[2];
  const ok =
    lum(Ls) / lum(L0) > 0.5 &&
    lum(Ls) / lum(L0) < 0.9 &&
    lum(Lp) / lum(L0) > 0.1 &&
    lum(Lp) / lum(L0) < 0.25 &&
    rbPeak > 10 &&
    rbPeak > 5 * rbSunset &&
    lum(Le) === 0;
  check(
    'Lee window at view 20 deg',
    ok,
    `start -1.41: ${((lum(Ls) / lum(L0)) * 100).toFixed(0)}% of sunset; peak -3.89: ${((lum(Lp) / lum(L0)) * 100).toFixed(0)}% amplitude, R/B ${rbPeak.toFixed(0)} (sunset ${rbSunset.toFixed(1)}); hard shadow by -6 (exact zero)`
  );
}

{
  // The printed END emerges low in the sky: at view elevation
  // 5 deg the term's last light dies between -6.81 and -7.93 -
  // Lee's printed end -7.37 +- 0.56 brackets the single-scatter
  // cutoff. (Grazing refraction ~0.5 deg is not modelled -
  // stated in the module header.)
  const before = stratLayerRadiance(5 * D2R, 0, -6.81 * D2R, MIE);
  const after = stratLayerRadiance(5 * D2R, 0, -7.93 * D2R, MIE);
  const ok = lum(before) > 0 && lum(after) === 0;
  check(
    'printed end at the low sky',
    ok,
    `view 5 deg: alive at -6.81 (${lum(before).toExponential(1)}), extinct by -7.93 - cutoff inside the printed -7.37 +- 0.56`
  );
}

{
  // Structure: solar-azimuth concentration (the eyelid), day
  // smallness against the molecular dome, and exact linearity
  // in the stage-2 volcanic hook.
  const a0 = lum(stratLayerRadiance(20 * D2R, 0, -3.89 * D2R, MIE));
  const a180 = lum(stratLayerRadiance(20 * D2R, Math.PI, -3.89 * D2R, MIE));
  const day = lum(stratLayerRadiance(90 * D2R, 0, 45 * D2R, MIE));
  const rayOrder = 13.558e-6 * 8000 * 0.06; // molecular zenith scale
  const v3 = lum(stratLayerRadiance(20 * D2R, 0, -3.89 * D2R, MIE, 300, 3));
  const v1 = lum(stratLayerRadiance(20 * D2R, 0, -3.89 * D2R, MIE, 300, 1));
  const ok =
    a0 / a180 > 5 && day / rayOrder < 0.1 && Math.abs(v3 / v1 - 3) < 1e-9;
  check(
    'structure: azimuth, day smallness, volcanic linearity',
    ok,
    `solar-azimuth x${(a0 / a180).toFixed(1)}; day zenith ${((day / rayOrder) * 100).toFixed(0)}% of molecular order; volcScale x3 -> x${(v3 / v1).toFixed(3)}`
  );
}

process.exit(fail ? 1 : 0);
