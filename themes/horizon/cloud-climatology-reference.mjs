// Reference gate for cloud-climatology.js (node
// cloud-climatology-reference.mjs): Rossow & Schiffer 1999's
// Table 5 at its own printed closure.
import {
  ISCCP_TOTAL,
  ISCCP_TYPES,
  ISCCP_LOW,
  ISCCP_MID,
  ISCCP_HIGH,
  LOW_FRAC,
  MID_FRAC,
  HIGH_FRAC
} from './cloud-climatology.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // Table 5's own arithmetic: nine printed types sum by level to
  // low 26.5 / mid 19.2 / high 21.6 (%), the partition closes on
  // the printed 67.6 total to 0.3% (type amounts are daytime
  // only - the caption's caveat), and the abstract's long-term
  // 0.675 +- 0.012 brackets the total.
  const part = ISCCP_LOW + ISCCP_MID + ISCCP_HIGH;
  const ok =
    Object.keys(ISCCP_TYPES).length === 9 &&
    Math.abs(ISCCP_LOW - 0.265) < 1e-9 &&
    Math.abs(ISCCP_MID - 0.192) < 1e-9 &&
    Math.abs(ISCCP_HIGH - 0.216) < 1e-9 &&
    Math.abs(part - ISCCP_TOTAL) < 0.004 &&
    Math.abs(ISCCP_TOTAL - 0.675) < 0.012;
  check(
    'Table 5 closure',
    ok,
    `low ${ISCCP_LOW.toFixed(3)} + mid ${ISCCP_MID.toFixed(3)} + high ${ISCCP_HIGH.toFixed(3)} = ${part.toFixed(3)} vs printed total ${ISCCP_TOTAL} (0.3%); abstract 0.675 +- 0.012 brackets`
  );
}

{
  // The fallback fractions: the measured top-view partition
  // (sums to ~1 by construction) replacing the invented
  // overlapping 0.7 + 0.5 + 0.3 = 1.5.
  const s = LOW_FRAC + MID_FRAC + HIGH_FRAC;
  const ok =
    Math.abs(LOW_FRAC - 0.392) < 0.001 &&
    Math.abs(MID_FRAC - 0.284) < 0.001 &&
    Math.abs(HIGH_FRAC - 0.32) < 0.001 &&
    s > 0.98 &&
    s <= 1.0 &&
    LOW_FRAC > HIGH_FRAC &&
    HIGH_FRAC > MID_FRAC;
  check(
    'fallback partition',
    ok,
    `low ${LOW_FRAC.toFixed(3)} / mid ${MID_FRAC.toFixed(3)} / high ${HIGH_FRAC.toFixed(3)} (sum ${s.toFixed(3)}; the old guess summed 1.5); ordering low > high > mid as printed`
  );
}

process.exit(fail ? 1 : 0);
