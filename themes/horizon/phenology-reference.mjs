// phenology-reference.mjs - the gate for the measured growing
// calendar (MCD12Q2, MODIS Land Cover Dynamics Collection 6).
//
// Primary source, read directly, and matched to what the service
// actually serves: ORNL offers product years through 2024, which is
// Collection 6.1, so the governing document is "User Guide to
// Collection 6.1 MODIS Land Cover Dynamics (MCD12Q2) Product", Gray,
// Sulla-Menashe and Friedl, 14 March 2022 (LP DAAC document 1417).
// Section and table numbers below are that edition's. Its numbers
// agree with the 2019 Collection 6 guide throughout - Table 1, the
// 15/50/90% definitions, Figure 2 and Table 2 are unchanged - but
// C6.1 fixes spuriously early greenup detection caused by a spline
// discontinuity across calendar years, and targets generation 6
// months after a year ends rather than 12.
//
// Landmarks:
//  - one cell model: the 0.01-deg snap IS modis-land.js's ndviCell,
//    re-exported not re-derived - both feeds ride the same ORNL
//    point service and must land on the same pixel
//  - the SERVED inventory, not the SDS table: the service answers
//    with 23 bands and Peak is not among them, though Table 1 lists
//    it; so no Peak band is ever requested, while Peak keeps its
//    place in the QA bit order (Figure 2)
//  - QA_Detailed unpacks exactly as the guide's own worked examples:
//    Figure 2's 14409 and every row of Table 2
//  - the date window is the documented one: fill and out-of-range
//    read null, and the range ends decode to the guide's own dates
//  - the knots ARE the product's definition (section 2.3): 15/50/90%
//    of the segment amplitude going up, 90/50/15% coming down, so
//    the reconstructed greenness passes exactly through each level
//  - the measured season carries onto the drawn year by WHOLE
//    calendar years - the product is ~18 months behind, so this is
//    always exercised
//  - the real Grindelwald pixel, live from the service, lands August
//    at full maturity - where Hopkins' law put the same canopy 87%
//    of the way into autumn. Hopkins is DELETED, not demoted to a
//    fallback: with no measured cycle nothing seasonal is drawn
//  - nothing measured, nothing drawn: poor QA, sub-threshold
//    amplitude and out-of-order dates all refuse the cycle, and the
//    weak 15% crossings are dropped rather than invented
import {ndviCell as landCell} from './modis-land.js';
import {
  EVI_AMP_MIN_VALID,
  epochDay,
  ndviCell,
  PHENO_BANDS,
  PHENO_DAY_MAX,
  PHENO_DAY_MIN,
  PHENO_FILL,
  PHENO_KEYS,
  PHENO_LEVEL,
  phenoAlign,
  phenoCycle,
  phenoDay,
  phenoForestPhase,
  phenoGrassPhase,
  phenoGreenness,
  phenoUrl,
  QA_POOR,
  unpackDetailedQa
} from './phenology.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

const iso = (d) => new Date(d * 86400000).toISOString().slice(0, 10);
const day = (s) => Math.round(Date.parse(s + 'T00:00:00Z') / 86400000);

{
  check(
    'one cell model',
    ndviCell === landCell &&
      ndviCell(46.6237, 8.0412).lat === 46.62 &&
      ndviCell(46.6237, 8.0412).lon === 8.04,
    'phenology snaps with modis-land.js ndviCell itself (identity); 46.6237,8.0412 -> 46.62,8.04 - one cell for the NDVI, reflectance and phenology queries'
  );
}

{
  // The service's own inventory decides what may be asked for.
  const url = phenoUrl(
    {lat: 46.62, lon: 8.04},
    'A2023001',
    PHENO_BANDS.greenup
  );
  check(
    'served bands only',
    !('peak' in PHENO_BANDS) &&
      PHENO_KEYS.includes('peak') &&
      PHENO_KEYS.length === 7 &&
      url ===
        'https://modis.ornl.gov/rst/api/v1/MCD12Q2/subset?latitude=46.62&longitude=8.04&startDate=A2023001&endDate=A2023001&band=Greenup.Num_Modes_01&kmAboveBelow=0&kmLeftRight=0',
    'no Peak band is requested (the point service serves 23 bands and Peak is not one, though Table 1 lists the SDS); Peak still holds bits 6-7 of QA_Detailed so it stays in the key order; the /subset URL is the exact point form'
  );
}

{
  // Figure 2 and Table 2 of the user guide, decoded.
  const f2 = unpackDetailedQa(14409);
  const rows = [
    [0, [0, 0, 0, 0, 0, 0, 0]],
    [5461, [1, 1, 1, 1, 1, 1, 1]],
    [15963, [3, 2, 1, 1, 2, 3, 3]],
    [14409, [1, 2, 0, 1, 0, 2, 3]],
    [16383, [3, 3, 3, 3, 3, 3, 3]]
  ];
  const allRows = rows.every(([v, want]) => {
    const q = unpackDetailedQa(v);
    return q && PHENO_KEYS.every((k, i) => q[k] === want[i]);
  });
  check(
    'QA_Detailed unpack',
    allRows &&
      f2.greenup === 1 &&
      f2.midGreenup === 2 &&
      f2.maturity === 0 &&
      f2.peak === 1 &&
      f2.senescence === 0 &&
      f2.midGreendown === 2 &&
      f2.dormancy === 3 &&
      unpackDetailedQa(PHENO_FILL) === null &&
      unpackDetailedQa(16384) === null,
    `Figure 2's 14409 -> Greenup 1, MidGreenup 2, Maturity 0, Peak 1, Senescence 0, MidGreendown 2, Dormancy 3, and all five Table 2 rows (0, 5461, 15963, 14409, 16383) decode exactly; fill and >16383 refuse`
  );
}

{
  check(
    'documented date window',
    phenoDay(PHENO_FILL) === null &&
      phenoDay(PHENO_DAY_MIN - 1) === null &&
      phenoDay(PHENO_DAY_MAX + 1) === null &&
      phenoDay(PHENO_DAY_MIN) === PHENO_DAY_MIN &&
      iso(PHENO_DAY_MIN) === '2000-06-30' &&
      iso(PHENO_DAY_MAX) === '2059-09-17',
    `valid 11138..32766 days since 1-1-1970 = ${iso(PHENO_DAY_MIN)}..${iso(PHENO_DAY_MAX)}; the 32767 fill and anything outside read null`
  );
}

// The live Grindelwald pixel (46.624 N, 8.041 E), product year 2023,
// straight from the ORNL service - the numbers this gate is built on
// were fetched, not chosen:
//   Greenup 19446  MidGreenup 19474  Maturity 19552
//   Senescence 19615  MidGreendown 19658  Dormancy 19681
//   EVI_Amplitude 1377  QA_Overall 1
const GRINDELWALD = {
  greenup: 19446,
  midGreenup: 19474,
  maturity: 19552,
  senescence: 19615,
  midGreendown: 19658,
  dormancy: 19681,
  amplitude: 1377,
  qa: 1
};

{
  const c = phenoCycle(GRINDELWALD);
  check(
    'measured alpine season',
    c !== null &&
      iso(c.greenup) === '2023-03-30' &&
      iso(c.midGreenup) === '2023-04-27' &&
      iso(c.maturity) === '2023-07-14' &&
      iso(c.senescence) === '2023-09-15' &&
      iso(c.midGreendown) === '2023-10-28' &&
      iso(c.dormancy) === '2023-11-20' &&
      Math.abs(c.amplitude - 0.1377) < 1e-12 &&
      c.peak === null,
    `green-up ${iso(c.greenup)}, half-green ${iso(c.midGreenup)}, mature ${iso(c.maturity)}, senescing ${iso(c.senescence)}, half-down ${iso(c.midGreendown)}, dormant ${iso(c.dormancy)}; EVI2 amplitude ${c.amplitude.toFixed(4)}; no Peak knot because the service serves none`
  );
}

{
  // Section 2.3: each dated metric is a crossing of a KNOWN fraction
  // of the segment amplitude, so the reconstruction must pass through
  // those levels exactly.
  const c = phenoCycle(GRINDELWALD);
  const atKnot = PHENO_KEYS.filter((k) => c[k] != null).every(
    (k) => Math.abs(phenoGreenness(c, c[k]) - PHENO_LEVEL[k]) < 1e-12
  );
  const mid = phenoGreenness(c, (c.midGreenup + c.maturity) / 2);
  check(
    'knots are the definition',
    atKnot &&
      phenoGreenness(c, c.greenup - 30) === 0 &&
      phenoGreenness(c, c.dormancy + 30) === 0 &&
      mid > 0.5 &&
      mid < 0.9,
    `greenness passes exactly through 15/50/90% on the way up and 90/50/15% on the way down (section 2.3); flat at the dormant floor outside the season; halfway from half-green to mature reads ${mid.toFixed(3)}`
  );
}

{
  // The product is ~18 months behind the scene, so alignment is not
  // an edge case - it is the normal path.
  const c = phenoCycle(GRINDELWALD);
  const aug = day('2026-08-06');
  const a = phenoAlign(c, aug);
  check(
    'season carries by whole years',
    iso(a.midGreenup) === '2026-04-27' &&
      iso(a.dormancy) === '2026-11-20' &&
      a.midGreenup - c.midGreenup === day('2026-04-27') - day('2023-04-27') &&
      phenoGrassPhase(c, aug) === 'green' &&
      phenoForestPhase(c, aug) === 'summer',
    `a 2023 season shifted onto 2026 keeps its month and day (${iso(a.midGreenup)}, ${iso(a.dormancy)}) - no 365.2425 drift; 6 August 2026 reads grass "green", canopy "summer"`
  );
}

{
  // What the measured calendar replaces - and replaces outright,
  // with no fallback left behind it. Hopkins' bioclimatic law as the
  // theme used to run it: hop = 4*(|lat| - 39) + elev/30.5, leaf-out at
  // day 105 + hop, senescence at day 265 - hop, autumn tint ramping
  // over the 20 days from senescence while maturity needs 45 days
  // from leaf-out. Autumn therefore begins before the canopy has
  // finished maturing once 265 - hop < 105 + hop + 45, i.e. hop >
  // 57.5 - a crossover at a fixed elevation for each latitude.
  const lat = 46.624;
  const hop = (e) => 4 * (Math.abs(lat) - 39) + e / 30.5;
  const crossM = (57.5 - 4 * (Math.abs(lat) - 39)) * 30.5;
  const elev = 1034; // Grindelwald village, the site the bug showed up at
  const h = hop(elev);
  const leafOut = 105 + h;
  const senesce = 265 - h;
  const doy = 218; // 6 August
  const frac = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));
  const fall = frac(doy, senesce, senesce + 20);
  const c = phenoCycle(GRINDELWALD);
  check(
    'the guess it replaces',
    Math.abs(crossM - 824) < 1 &&
      senesce < leafOut + 45 &&
      fall > 0.8 &&
      phenoForestPhase(c, day('2026-08-06')) === 'summer' &&
      day('2026-08-06') > phenoAlign(c, day('2026-08-06')).maturity &&
      day('2026-08-06') < phenoAlign(c, day('2026-08-06')).senescence,
    `above ${crossM.toFixed(0)} m at this latitude Hopkins starts autumn before maturity completes; at ${elev} m it puts 6 August ${(fall * 100).toFixed(0)}% into autumn colour, while the measured pixel is between maturity (14 Jul) and senescence (15 Sep) - full summer`
  );
}

{
  // Nothing measured, nothing drawn.
  const poor = phenoCycle({...GRINDELWALD, qa: QA_POOR});
  const flat = phenoCycle({...GRINDELWALD, amplitude: 900}); // 0.09 < 0.1
  const fill = phenoCycle({...GRINDELWALD, midGreenup: PHENO_FILL});
  const swapped = phenoCycle({
    ...GRINDELWALD,
    maturity: GRINDELWALD.midGreenup - 5
  });
  const weak = phenoCycle({...GRINDELWALD, greenup: PHENO_FILL});
  check(
    'nothing measured, nothing drawn',
    poor === null &&
      flat === null &&
      fill === null &&
      swapped === null &&
      phenoCycle(null) === null &&
      weak !== null &&
      weak.greenup === null &&
      phenoGrassPhase(weak, weak.midGreenup - 1) === 'dormant' &&
      Math.abs(EVI_AMP_MIN_VALID - 0.1) < 1e-12,
    `poor QA, a 0.09 amplitude below the product's own 0.1 validity floor (section 2.2), a filled stable date and out-of-order dates all refuse the cycle; a missing 15% crossing keeps the cycle but collapses the shoulder onto the stable 50% bound rather than inventing one`
  );
}

{
  const d = new Date('2026-08-06T13:45:00Z');
  check(
    'product time base',
    epochDay(d) === day('2026-08-06') && iso(epochDay(d)) === '2026-08-06',
    'scene time enters as days since 1-1-1970, floored to UTC midnight - the product’s own base'
  );
}

process.exit(fail ? 1 : 0);
