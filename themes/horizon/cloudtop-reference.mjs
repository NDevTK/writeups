// Reference printer for the measured cloud tops (node
// cloudtop-reference.mjs). The law lives in cloudtop.js; the
// landmarks hold the VERBATIM published palette, the pixel
// classification on samples from a REAL tile, the census
// statistics, and the ISA-derived ISCCP boundary heights.
import {
  classifyCtop,
  CTOP_FRESH_D,
  CTOP_RGB,
  CTOP_Z,
  ctopStats,
  ISCCP_LOW_TOP_M,
  ISCCP_MID_TOP_M
} from './cloudtop.js';
import {CTOP_SAMPLES} from './cloudtop-fixture.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// ---- 1. the published palette, verbatim -------------------------
{
  const first = CTOP_RGB[0];
  const lastBand = CTOP_RGB[239];
  const inf = CTOP_RGB[240];
  check(
    'colormap verbatim',
    CTOP_RGB.length === 241 &&
      first.join(',') === '255,0,0,0,50' &&
      lastBand.join(',') === '185,16,143,11950,12000' &&
      inf[3] === 12000 &&
      inf[4] === Infinity &&
      inf.slice(0, 3).join(',') === '102,0,119',
    `240 published 50 m bands [0,50)..[11950,12000) plus the open ` +
      `[12000,+INF) class (102,0,119) - the v1.3 XML fetched 2026-08-09, ` +
      `embedded verbatim (the GIBS colormap files were RENAMED upstream ` +
      `this summer; vendoring is why the censuses survive the churn)`
  );
  const c1 = classifyCtop([1, 222, 0, 255]);
  const c2 = classifyCtop([102, 0, 119, 255]);
  check(
    'classification is the palette inverted',
    c1.kind === 'height' &&
      c1.m === 6075 &&
      c2.kind === 'top12' &&
      c2.m === 12000,
    `(1,222,0) -> ${c1.m} m (the [6050,6100) band's midpoint); the open ` +
      `class returns its 12000 m FLOOR labelled top12 - "at least", never ` +
      `an invented height`
  );
}

// ---- 2. real-tile pixels ----------------------------------------
{
  const hs = CTOP_SAMPLES.banded.map((s) => classifyCtop(s.slice(2)).m);
  const infOk = CTOP_SAMPLES.top12.every(
    (s) => classifyCtop(s.slice(2)).kind === 'top12'
  );
  const unseenOk = CTOP_SAMPLES.unseen.every(
    (s) => classifyCtop(s.slice(2)).kind === 'unseen'
  );
  check(
    'a real Alpine tile reads back',
    hs.every((m) => Number.isFinite(m)) &&
      Math.min(...hs) > 3000 &&
      Math.max(...hs) < 4000 &&
      infOk &&
      unseenOk,
    `eight banded pixels resolve to ${Math.min(...hs)}-${Math.max(...hs)} m ` +
      `(the 2026-08-07 convective field; full tile: 24.8% cloud, banded ` +
      `median 5575 m, 474 anvil pixels), the anvil pixels read top12 and ` +
      `the transparent fill reads unseen - clear sky and no-retrieval stay ` +
      `indistinguishable, so the census claims heights, never cover`
  );
}

// ---- 3. the census ----------------------------------------------
{
  // A scripted sampler over 16 cells, its colours drawn FROM the
  // vendored table itself (the earlier draft invented rgb values
  // and the classifier rightly refused them - the palette is a
  // lookup, not a gradient): 6 low tops, 4 mid, 2 banded high,
  // 1 anvil, 3 unseen. Indices ignored; the geo mapping is the
  // terrain's own gated sceneToGeo/pixelOf.
  const rowAt = (m) =>
    CTOP_RGB.find((e) => e[3] <= m && m < e[4])
      .slice(0, 3)
      .concat(255);
  const seq = [
    rowAt(25),
    rowAt(500),
    rowAt(500),
    rowAt(1500),
    rowAt(1500),
    rowAt(2500),
    rowAt(4000),
    rowAt(4000),
    rowAt(5000),
    rowAt(6075),
    rowAt(8000),
    rowAt(8000),
    [102, 0, 119, 255], // anvil
    null,
    null,
    [220, 220, 255, 0]
  ];
  let k = 0;
  const stats = ctopStats(
    () => seq[k++ % seq.length],
    {lat: 46.6, lon: 8.0},
    520,
    4
  );
  check(
    'census statistics per ISCCP band',
    stats.n === 13 &&
      Math.abs(stats.cloudFrac - 13 / 16) < 1e-9 &&
      stats.nLow === 6 &&
      stats.nHigh === 3 &&
      stats.highM !== null &&
      stats.lowM < ISCCP_LOW_TOP_M &&
      stats.highM >= ISCCP_MID_TOP_M,
    `13 of 16 cells answered (cloudFrac ${(stats.cloudFrac * 100).toFixed(1)}%): ` +
      `low median ${stats.lowM} m (n=${stats.nLow}), mid ${stats.midM} m ` +
      `(n=${stats.nMid}), high ${stats.highM} m (n=${stats.nHigh}, anvil ` +
      `floor included) - medians per the ISCCP bands the repo already ` +
      `carries`
  );
  const empty = ctopStats(() => null, {lat: 0, lon: 0}, 520, 2);
  check(
    'unseen honesty',
    empty.n === 0 &&
      empty.lowM === null &&
      empty.midM === null &&
      empty.highM === null,
    `a box the satellite never answered returns null everywhere - the ` +
      `hand thickness stands, stated`
  );
}

// ---- 4. the ISA boundary heights --------------------------------
{
  const h = (p) => (288150 / 6.5) * (1 - Math.pow(p / 1013.25, 1 / 5.255));
  check(
    'ISCCP boundaries from the ISA barometric formula',
    CTOP_FRESH_D === 2 &&
      CTOP_Z === 7 &&
      Math.abs(ISCCP_LOW_TOP_M - h(680)) < 5 &&
      Math.abs(ISCCP_MID_TOP_M - h(440)) < 5,
    `680 hPa -> ${h(680).toFixed(0)} m and 440 hPa -> ${h(440).toFixed(0)} m ` +
      `by the ISA formula (T0 288.15 K, L 6.5 K/km, exponent 5.255) - the ` +
      `exported ${ISCCP_LOW_TOP_M}/${ISCCP_MID_TOP_M} are its round; the ` +
      `client hands MEASURED boundary heights from the radiosonde column ` +
      `when one is fresh; freshness ${CTOP_FRESH_D} d, native z${CTOP_Z}`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
