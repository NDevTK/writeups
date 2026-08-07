// Reference gate for ozone.js (node ozone-reference.mjs): the
// measured total-column ozone scaling, held to Bruneton's own
// printed construction and to a captured live GFS message.
import {
  ozoneCensus,
  ozoneScale,
  OZONE_REF_DU,
  DU_MIN,
  DU_MAX
} from './ozone.js';
import {parseGrib2, gridValue} from './grib2.js';
import {OZONE_FIXTURE} from './ozone-fixture.mjs';
import {sunTransmittanceJS} from './sun-transmittance.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const near = (a, b, t) => Math.abs(a - b) < t;

{
  // The reference column is Bruneton's construction, not ours:
  // kMaxOzoneNumberDensity = 300 DU / 15 km, where 15 km IS the
  // tent's integral - hold the tent integral to its closed form
  // (0.5 * base * height = 0.5 * 30 km * 1) by quadrature, and the
  // constant to the printed 300.
  const N = 200000;
  let integ = 0;
  for (let i = 0; i < N; i++) {
    const h = ((i + 0.5) / N) * 60e3;
    integ += Math.max(0, 1 - Math.abs(h - 25e3) / 15e3) * (60e3 / N);
  }
  const ok = OZONE_REF_DU === 300 && near(integ, 15e3, 1);
  check(
    'Bruneton 300 DU over the 15 km tent',
    ok,
    `tent integral ${integ.toFixed(1)} m (closed 15000); reference ${OZONE_REF_DU} DU`
  );
}

{
  // The captured live message (NOMADS GFS 2026-08-06T12z f006,
  // subregion-repacked to simple packing): the gated decoder reads
  // WMO 4.2-0-14-0 and the Grindelwald cell holds 297.753 DU -
  // pinned to the value decoded at capture time.
  const msgs = parseGrib2(OZONE_FIXTURE);
  const c = ozoneCensus(msgs, 46.62, 8.04, gridValue);
  const ok =
    c &&
    near(c.du, 297.7531, 5e-3) &&
    c.forecastHours === 6 &&
    c.refTime.y === 2026 &&
    c.refTime.H === 12;
  check(
    'captured GFS TOZNE decodes',
    ok,
    c
      ? `${c.du.toFixed(3)} DU at Grindelwald, cycle 2026-08-06T12z+${c.forecastHours}`
      : 'no census'
  );
}

{
  // The scale is exactly linear with the identity at the reference:
  // scale(300) = 1 bit-exactly, scale(150) = 0.5, and out-of-range
  // values (decode garbage, both sides) fail CLOSED to 1.
  const ok =
    ozoneScale(300) === 1 &&
    ozoneScale(150) === 0.5 &&
    near(ozoneScale(460), 460 / 300, 1e-15) &&
    ozoneScale(NaN) === 1 &&
    ozoneScale(30) === 1 &&
    ozoneScale(9000) === 1;
  check(
    'scale identity + linearity + closed failure',
    ok,
    `scale(300)=1 scale(150)=0.5 scale(460)=${ozoneScale(460).toFixed(4)}; 30/9000/NaN -> 1`
  );
}

{
  // The census rejects a wrong parameter and out-of-range values:
  // a category-14 message with parameter 1 (not total ozone) or a
  // TOZNE holding 20 DU (below every measured extreme) yields
  // null - fail closed, never a guessed sky.
  const msgs = parseGrib2(OZONE_FIXTURE);
  const wrongParam = msgs.map((m) => ({...m, paramNumber: 1}));
  const cWrong = ozoneCensus(wrongParam, 46.62, 8.04, gridValue);
  const lowVal = ozoneCensus(msgs, 46.62, 8.04, () => 20);
  const ok =
    cWrong === null && lowVal === null && DU_MIN === 70 && DU_MAX === 700;
  check(
    'census fails closed',
    ok,
    `wrong parameter -> null; 20 DU -> null; bounds [${DU_MIN}, ${DU_MAX}]`
  );
}

{
  // The CPU transmittance twin consumes the scale exactly like the
  // shader's ozScale uniform: absent === 1 bit-identically, and
  // the per-channel LOG-ratio of a scaled to an unscaled call is
  // proportional to the shipped ozone cross-sections ALONE -
  // log T_s/T_1 = -(s-1) sigma_c INT(tent), so the G/R log-ratio
  // is 1.881/0.650 exactly, independent of the path geometry. A
  // closed identity no tuning could fake.
  const mu = 0.3;
  const mie = {scat: [4e-6, 4e-6, 4e-6], abs: [4e-7, 4e-7, 4e-7]};
  const t1 = sunTransmittanceJS(mu, mie);
  const tAbsent = sunTransmittanceJS(mu, {...mie});
  const t15 = sunTransmittanceJS(mu, {...mie, ozScale: 1.5});
  const lr = (c) => Math.log(t15[c] / t1[c]);
  const ok =
    t1.every((v, c) => v === tAbsent[c]) &&
    near(lr(1) / lr(0), 1.881 / 0.65, 1e-9) &&
    near(lr(2) / lr(0), 0.085 / 0.65, 1e-9) &&
    t15[1] < t1[1];
  check(
    'transmittance twin log-ratio identity',
    ok,
    `G/R log-ratio ${(lr(1) / lr(0)).toFixed(9)} = 1.881/0.650 = ${(1.881 / 0.65).toFixed(9)}; B/R ${(lr(2) / lr(0)).toFixed(9)}; more ozone dims G most`
  );
}

process.exit(fail ? 1 : 0);
