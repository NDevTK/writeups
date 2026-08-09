// Reference printer for the measured droplet size (node
// creff-reference.mjs). The law lives in creff.js; the landmarks
// hold the VERBATIM two-phase palette, the classification on
// pixels from a REAL tile, the per-phase census, and the scope
// statement (water feeds the corona; bulk ice never does).
import {
  classifyCreff,
  CREFF_FRESH_D,
  CREFF_ICE_RGB,
  CREFF_WATER_RGB,
  CREFF_Z,
  creffStats
} from './creff.js';
import {airyPattern, DROPLET_DE_OBS_UM} from './cloud-corona.js';
import {CREFF_SAMPLES} from './creff-fixture.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- 1. the published two-phase palette, verbatim ---------------
{
  const w0 = CREFF_WATER_RGB[0];
  const wN = CREFF_WATER_RGB[124];
  const i0 = CREFF_ICE_RGB[0];
  const iN = CREFF_ICE_RGB[125];
  check(
    'colormap verbatim, microns recovered from the x100 axis',
    CREFF_WATER_RGB.length === 125 &&
      CREFF_ICE_RGB.length === 126 &&
      w0.join(',') === '255,255,0,4,5.161' &&
      wN.join(',') === '141,0,0,25,30' &&
      i0.join(',') === '182,0,184,5,10.317' &&
      iN.join(',') === '0,255,0,50,60',
    `water 125 bands 4-30 um, ice 126 bands 5-60 um - the published ` +
      `sourceValue axis is micrometres x100 (its own value attribute ` +
      `prints the microns; 400 -> 4.00), stored here in microns, verbatim`
  );
  const cw = classifyCreff([255, 255, 0, 255]);
  const ci = classifyCreff([0, 255, 0, 255]);
  check(
    'phases stay phases',
    cw.kind === 'water' &&
      Math.abs(cw.um - 4.5805) < 1e-9 &&
      ci.kind === 'ice' &&
      ci.um === 55,
    `(255,255,0) -> water ${cw.um} um, (0,255,0) -> ice ${ci.um} um - one ` +
      `lookup, two physically distinct populations, never mixed`
  );
}

// ---- 2. real-tile pixels ----------------------------------------
{
  const wu = CREFF_SAMPLES.water.map((s) => classifyCreff(s.slice(2)));
  const iu = CREFF_SAMPLES.ice.map((s) => classifyCreff(s.slice(2)));
  check(
    'a real Alpine tile reads back per phase',
    wu.every((c) => c.kind === 'water' && c.um >= 4 && c.um <= 30) &&
      iu.every((c) => c.kind === 'ice' && c.um >= 5 && c.um <= 60) &&
      CREFF_SAMPLES.unseen.every(
        (s) => classifyCreff(s.slice(2)).kind === 'unseen'
      ),
    `five cumulus pixels read water ${wu.map((c) => c.um.toFixed(1)).join('/')} ` +
      `um and five anvil pixels read ice ${iu.map((c) => c.um.toFixed(1)).join('/')} ` +
      `um (full tile: 6014 water median 11.05, 1222 ice median 24.13); ` +
      `the fill reads unseen`
  );
}

// ---- 3. the census and the scope --------------------------------
{
  const seq = [
    [255, 255, 0, 255], // water 4.58
    [255, 255, 0, 255],
    [255, 255, 25, 255], // water band
    [0, 255, 0, 255], // ice 55
    [182, 0, 184, 255], // ice 7.66
    null,
    [220, 220, 255, 0],
    null
  ];
  let k = 0;
  const stats = creffStats(
    () => seq[k++ % seq.length],
    {lat: 46.6, lon: 8},
    520,
    4
  );
  check(
    'per-phase medians, unseen honesty',
    stats.nWater === 6 &&
      stats.nIce === 4 &&
      stats.waterUm !== null &&
      stats.iceUm !== null &&
      creffStats(() => null, {lat: 0, lon: 0}, 520, 2).waterUm === null,
    `16 cells -> ${stats.nWater} water (median ${stats.waterUm?.toFixed(2)} um), ` +
      `${stats.nIce} ice (median ${stats.iceUm} um), the rest unseen; a box ` +
      `with no retrievals returns null - the printed class average stands`
  );
  check(
    'the scope the physics demands',
    CREFF_FRESH_D === 2 &&
      CREFF_Z === 7 &&
      DROPLET_DE_OBS_UM.marine === 19.2 &&
      DROPLET_DE_OBS_UM.continental === 10.8,
    `the water median's D_e = 2 r_eff outranks the printed class averages ` +
      `(marine ${DROPLET_DE_OBS_UM.marine} / continental ` +
      `${DROPLET_DE_OBS_UM.continental} um De) when the satellite saw ` +
      `liquid here today; BULK ice r_eff never feeds the cirrus corona - ` +
      `coronae ring from narrow small-crystal subsets a bulk retrieval ` +
      `cannot resolve (cloud-corona.js's own printed caveat); freshness ` +
      `${CREFF_FRESH_D} d, native z${CREFF_Z}`
  );
}

// ---- 4. the measured size moves the rings by the exact law ------
{
  // The builder's override rescales the printed mode's rm by
  // De_meas/De_class at fixed sigma; every diffraction angle
  // scales as 1/D, so DOUBLING the measured De must HALVE the
  // first-ring angle. Held on the gated airyPattern at the
  // continental De and twice it - the same law the lognormal
  // integral inherits term by term.
  const N = 2048;
  const thetas = new Float64Array(N);
  for (let i = 0; i < N; i++) thetas[i] = ((i + 0.5) / N) * 0.14; // to 8 deg
  const De = DROPLET_DE_OBS_UM.continental;
  const p1 = airyPattern(De, 0.55, thetas);
  const p2 = airyPattern(2 * De, 0.55, thetas);
  const firstMin = (p) => {
    for (let i = 2; i < N - 1; i++)
      if (p[i] < p[i - 1] && p[i] <= p[i + 1]) return thetas[i];
    return NaN;
  };
  const t1 = firstMin(p1);
  const t2 = firstMin(p2);
  check(
    'doubling the measured De halves the ring',
    Number.isFinite(t1) && Number.isFinite(t2) && Math.abs(t1 / t2 - 2) < 0.06,
    `first minimum ${((t1 * 180) / Math.PI).toFixed(2)} deg at the printed ` +
      `continental De, ${((t2 * 180) / Math.PI).toFixed(2)} deg at twice ` +
      `it - ratio ${(t1 / t2).toFixed(3)}, the 1/D diffraction law through ` +
      `the SAME pattern the display's LUT packs`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
