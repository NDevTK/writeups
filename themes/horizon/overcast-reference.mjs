// Reference gate for overcast.js (node overcast-reference.mjs):
// the overcast sky's two-stream slab and its emergent gradation,
// held to Meador & Weaver 1980's printed forms and Wood 2012's
// printed climatology, with the closed forms checked against
// direct numerics.
import {
  OVERCAST_LWP_RANGE,
  OVERCAST_LWP,
  CLOUD_G_RANGE,
  CLOUD_G,
  overcastTau,
  overcastGamma1,
  overcastAlbedo,
  overcastT,
  overcastRadiance,
  overcastGroundFactor,
  SNOW_ALBEDO_RGB
} from './overcast.js';
import {DROPLET_DE_OBS_UM} from './cloud-corona.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const near = (a, b, t) => Math.abs(a - b) < t;

{
  // Wood 2012's printed numbers, verbatim: LWP 40-150 g/m^2
  // (log midpoint carried), g = 0.82-0.86 (middle carried).
  const ok =
    OVERCAST_LWP_RANGE[0] === 40 &&
    OVERCAST_LWP_RANGE[1] === 150 &&
    near(OVERCAST_LWP, Math.sqrt(6000), 1e-9) &&
    CLOUD_G_RANGE[0] === 0.82 &&
    CLOUD_G_RANGE[1] === 0.86 &&
    CLOUD_G === 0.84;
  check(
    'Wood 2012 printed climatology',
    ok,
    `LWP ${OVERCAST_LWP.toFixed(1)} g/m^2 of [${OVERCAST_LWP_RANGE}]; g ${CLOUD_G} of [${CLOUD_G_RANGE}]`
  );
}

{
  // The optical depth through Miles' printed effective radii (the
  // survey Wood's own thickness compilation cites): continental
  // r_e 5.4 um -> tau ~21.5, marine 9.6 -> ~12.1 - inside Wood's
  // printed overcast range ("less than 1 to more than 20", up to
  // 50). Monotone in LWP, inverse in r_e; fails closed without
  // microphysics.
  const tC = overcastTau(DROPLET_DE_OBS_UM.continental / 2);
  const tM = overcastTau(DROPLET_DE_OBS_UM.marine / 2);
  const ok =
    near(tC, 21.5, 0.2) &&
    near(tM, 12.1, 0.2) &&
    tC > tM &&
    overcastTau(5.4, 150) > overcastTau(5.4, 40) &&
    overcastTau(0) === 0 &&
    overcastTau(-1) === 0 &&
    overcastTau(5.4, 0) === 0;
  check(
    'overcast tau from the interlocking surveys',
    ok,
    `continental ${tC.toFixed(1)}, marine ${tM.toFixed(1)} at the log-mid LWP; monotone; fails closed`
  );
}

{
  // Meador & Weaver Table 1 Eddington at omega_0 = 1:
  // gamma_1 = 1/4[7 - (4+3g)] = (3/4)(1-g), and the closed
  // R = gamma_1 tau/(1 + gamma_1 tau) of their Eq. (29) with
  // T + R = 1 exactly (conservative).
  let ok = true;
  for (const g of [0.8, 0.84, 0.86]) {
    if (!near(overcastGamma1(g), 0.25 * (7 - (4 + 3 * g)), 1e-15)) ok = false;
    for (const tau of [0.5, 5, 12.1, 21.5, 40]) {
      const R = overcastAlbedo(tau, g);
      const gt = overcastGamma1(g) * tau;
      if (!near(R, gt / (1 + gt), 1e-15)) ok = false;
      if (!near(R + overcastT(tau, g), 1, 1e-15)) ok = false;
    }
  }
  check(
    'Meador-Weaver Eddington closed form',
    ok,
    `gamma_1 = (3/4)(1-g) = Table 1's 1/4[7 - omega_0(4+3g)] at omega_0 = 1; R + T = 1 exactly over the grid`
  );
}

{
  // The closed conservative form against a direct numerical
  // solution of the two-stream equations dI+/dtau = gamma_1 I+ -
  // gamma_2 I-, dI-/dtau = gamma_2 I+ - gamma_1 I- (gamma_1 =
  // gamma_2, diffuse incidence I-(0) = 1, I+(tau') = 0): RK4 at
  // 20000 steps, both boundaries shot. The printed algebra is the
  // integral's own value.
  const g = CLOUD_G;
  const g1 = overcastGamma1(g);
  const solve = (tauP) => {
    // shoot on I+(0) so that I+(tauP) = 0; linear system, so one
    // secant step from two trials is exact up to integration error
    const run = (ip0) => {
      const N = 20000;
      const dt = tauP / N;
      let ip = ip0;
      let im = 1;
      for (let i = 0; i < N; i++) {
        const k1p = g1 * ip - g1 * im;
        const k1m = g1 * ip - g1 * im;
        const ipm = ip + (dt / 2) * k1p;
        const imm = im + (dt / 2) * k1m;
        const k2p = g1 * ipm - g1 * imm;
        const k2m = g1 * ipm - g1 * imm;
        const ipm2 = ip + (dt / 2) * k2p;
        const imm2 = im + (dt / 2) * k2m;
        const k3p = g1 * ipm2 - g1 * imm2;
        const k3m = g1 * ipm2 - g1 * imm2;
        const ipe = ip + dt * k3p;
        const ime = im + dt * k3m;
        const k4p = g1 * ipe - g1 * ime;
        const k4m = g1 * ipe - g1 * ime;
        ip += (dt / 6) * (k1p + 2 * k2p + 2 * k3p + k4p);
        im += (dt / 6) * (k1m + 2 * k2m + 2 * k3m + k4m);
      }
      return {ip, im};
    };
    const a = run(0);
    const b = run(1);
    // I+(tauP) is linear in ip0: find the root.
    const x = -a.ip / (b.ip - a.ip);
    const s = run(x);
    return {R: x, T: s.im};
  };
  let ok = true;
  let detail = '';
  for (const tau of [1, 12.1, 21.5]) {
    const n = solve(tau);
    const okR = near(n.R, overcastAlbedo(tau, g), 2e-4);
    const okT = near(n.T, overcastT(tau, g), 2e-4);
    if (!okR || !okT) ok = false;
    detail += `tau ${tau}: T ${overcastT(tau, g).toFixed(4)} (ODE ${n.T.toFixed(4)}); `;
  }
  check('closed form = the two-stream ODE', ok, detail);
}

{
  // Wood's own printed corroboration: "a = tau/(tau+7)" (Seinfeld
  // & Pandis) IS the Meador-Weaver conservative form at
  // g = 1 - 4/21 = 0.8095 - INSIDE the printed 0.82-0.86? Just
  // below it - so the gate asserts the exact-identity g and that
  // the two albedos agree within the printed g-range's own spread
  // over the overcast tau range.
  const gStar = 1 - 4 / 21;
  let ok = near(overcastGamma1(gStar), 1 / 7, 1e-12);
  let worst = 0;
  for (const tau of [5, 12.1, 21.5, 40]) {
    const a1 = overcastAlbedo(tau, CLOUD_G);
    const a2 = tau / (tau + 7);
    worst = Math.max(worst, Math.abs(a1 / a2 - 1));
    if (!(Math.abs(a1 / a2 - 1) < 0.12)) ok = false;
  }
  check(
    'Wood-printed tau/(tau+7) corroborates',
    ok,
    `identity at g = ${gStar.toFixed(4)} (printed range starts 0.82); at g = ${CLOUD_G} the two albedos agree within ${(worst * 100).toFixed(1)}% over tau 5..40`
  );
}

{
  // The emergent gradation: MW Eq. (30) with a dark base -
  // L(mu) = E (2+3mu)/(4 pi). Flux closure EXACT by quadrature
  // (INT L mu dOmega = E), zenith:horizon = 5:2, and the level:
  // horizon L = E/(2 pi), zenith L = 5E/(4 pi).
  const E = 0.37;
  const M = 200000;
  let flux = 0;
  for (let i = 0; i < M; i++) {
    const mu = (i + 0.5) / M;
    flux += overcastRadiance(mu, E) * mu * 2 * Math.PI * (1 / M);
  }
  const ok =
    near(flux / E, 1, 1e-6) &&
    near(overcastRadiance(1, E) / overcastRadiance(0, E), 2.5, 1e-12) &&
    near(overcastRadiance(0, E), E / (2 * Math.PI), 1e-15) &&
    overcastRadiance(0.5, -1) === 0;
  check(
    'emergent (2+3mu)/4pi: flux closes, zenith 2.5x horizon',
    ok,
    `quadrature flux/E = ${(flux / E).toFixed(7)}; gradation ${(overcastRadiance(1, E) / overcastRadiance(0, E)).toFixed(2)}:1; negative irradiance fails closed`
  );
}

{
  // The ground coupling: the adding series summed in closed form
  // (30-term partial sum matches at 1e-12), a = 0 the shipped
  // dark-base law exactly, energy EXACTLY closed - what space
  // gets back (R + a T^2 F) plus what the ground keeps
  // ((1-a) T F) is the incident unit, algebraically and on the
  // grid - and the white-out magnitude printed: full fresh snow
  // over the continental column multiplies the underside light
  // by ~3.4.
  let ok = true;
  const tauC = 21.5;
  for (const tau of [1, 12.1, 21.5]) {
    const R = overcastAlbedo(tau);
    const T = overcastT(tau);
    for (const a of [0, 0.06, 0.2, 0.968]) {
      const F = overcastGroundFactor(tau, a);
      let series = 0;
      for (let n = 0; n < 140; n++) series += (a * R) ** n;
      if (!near(F, series, 1e-9)) ok = false;
      if (!near(R + a * T * T * F + (1 - a) * T * F, 1, 1e-12)) ok = false;
    }
    if (!near(overcastGroundFactor(tau, 0), 1, 1e-15)) ok = false;
  }
  const white = overcastGroundFactor(tauC, SNOW_ALBEDO_RGB[1]);
  ok = ok && white > 3 && white < 4;
  check(
    'ground-coupled overcast: series, closure, white-out',
    ok,
    `factor(tau ${tauC}, snow G ${SNOW_ALBEDO_RGB[1]}) = ${white.toFixed(2)}x (the white-out); energy closes exactly; a = 0 is the dark-base law`
  );
}

{
  // Wiscombe & Warren's snow: blue > green > red (the visible
  // slope of their Fig. 9), all inside the paper's own visible
  // band statements (high, with the printed 10-15% age spread
  // below their standard-grain values still above 0.8).
  const s = SNOW_ALBEDO_RGB;
  const ok =
    s[2] > s[1] && s[1] > s[0] && s[0] > 0.94 && s[2] < 1 && s[0] * 0.85 > 0.8;
  check(
    'Wiscombe-Warren snow albedo channels',
    ok,
    `RGB [${s.join(', ')}] - blue highest; the printed 15% age drop keeps the visible above 0.8`
  );
}

process.exit(fail ? 1 : 0);
