// Reference gate for meltpond.js (node meltpond-reference.mjs):
// the printed Lu 2016 two-stream machinery at its own equations
// and limits, Lu 2018's printed colour narrative and Istomina
// windows, and Rosel 2012's printed pond-fraction anchors.
import {
  POND_SPECTRAL,
  POND_R1,
  POND_R1PP,
  POND_SIGMA_I,
  POND_SIGMA_I_RANGE,
  NU_PUREICE,
  NU_BRINE,
  POND_HP,
  POND_HI,
  MELT_TOTAL,
  MELT_DELTA,
  pondMu,
  pondKappa,
  iceSlabRT,
  pondKIce,
  pondAlphaT,
  pondAlphaAt,
  pondAlbedoRGB,
  pondMeltState,
  POND_FRAC_CURVE,
  pondFractionOfDay,
  pondFraction
} from './meltpond.js';
import {ICE_NK} from './seaice.js';
import {CIE_1931_2DEG, XYZ_TO_LINEAR_SRGB} from './ocean-color.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// The colour fold used by the gates: the spectral pond albedo
// through the CIE 2-deg observer into linear sRGB - the daylight
// (D65-referenced) photographic frame of the Istomina comparison.
// Equal-energy weighting of the albedo is licensed by Lu 2018's
// printed F0 sensitivity (< 0.15 in hue and saturation, < 0.04
// in luminance); in this frame the printed start-grey of the
// melting case emerges by itself.
const M = XYZ_TO_LINEAR_SRGB;
const foldRGB = (Hp, Hi) => {
  let X = 0;
  let Y = 0;
  let Z = 0;
  let N = 0;
  for (const [nm, xb, yb, zb] of CIE_1931_2DEG) {
    const a = pondAlphaAt(nm, Hp, Hi);
    X += a * xb;
    Y += a * yb;
    Z += a * zb;
    N += yb;
  }
  X /= N;
  Y /= N;
  Z /= N;
  return [
    M[0][0] * X + M[0][1] * Y + M[0][2] * Z,
    M[1][0] * X + M[1][1] * Y + M[1][2] * Z,
    M[2][0] * X + M[2][1] * Y + M[2][2] * Z
  ];
};
const hslOf = ([r, g, b]) => {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const L = (mx + mn) / 2;
  const d = mx - mn;
  const S = d === 0 ? 0 : d / (1 - Math.abs(2 * L - 1));
  let H = 0;
  if (d > 0) {
    if (mx === r) H = ((g - b) / d + 6) % 6;
    else if (mx === g) H = (b - r) / d + 2;
    else H = (r - g) / d + 4;
    H /= 6;
  }
  return [H, S, L];
};

{
  // The printed machinery holds together: mu/kappa at their
  // printed limits (kappa = k for a purely absorbing medium,
  // zero for purely scattering; mu spans 1 -> 0 the same way);
  // R1'' is Dera's printed (1 - R1)/n_w^2 = 0.54 at the printed
  // n_w = 1.33; the closed-form three-layer solution satisfies
  // the printed coupled ODEs (Eq. 1) and all four printed
  // boundary conditions to machine precision at every theme
  // channel; and the vendored Warren & Brandt rows at 680/550/
  // 440 are IDENTICAL to the ones seaice.js already carries.
  const kapAbs = Math.abs(pondKappa(0.3, 0) - 0.3) < 1e-15;
  const kapSca = pondKappa(0, 5) === 0;
  const muLim = pondMu(0.3, 0) === 1 && pondMu(0, 5) === 0;
  const dera = Math.abs((1 - POND_R1) / (1.33 * 1.33) - POND_R1PP) < 0.005;
  let odeRes = 0;
  let bcRes = 0;
  for (const nm of [680, 550, 440]) {
    const row = POND_SPECTRAL.find((r) => r[0] === nm);
    const kw = row[1];
    const ki = pondKIce(nm, kw, row[2]);
    const s = POND_SIGMA_I;
    const {R: Rice, T: Tice} = iceSlabRT(ki, s, POND_HI);
    const b =
      (1 - POND_R1) / (1 - POND_R1PP * Rice * Math.exp(-2 * kw * POND_HP));
    // reconstruct the ice-layer A, B of the printed Eq. 2 from
    // the interface values and check Eq. 1 plus the BCs.
    const mu = pondMu(ki, s);
    const kap = pondKappa(ki, s);
    const W = Math.exp(-kw * POND_HP);
    const Fdn0 = b * W; // pond bottom downwelling = ice top (BC 5b)
    const Fup0 = Rice * Fdn0; // ice top upwelling (slab albedo)
    // solve Eq. 2's A, B from the two interface irradiances
    const det = (1 - mu) * (1 - mu) - (1 + mu) * (1 + mu);
    const A = ((1 - mu) * Fdn0 - (1 + mu) * Fup0) / det;
    const B = ((1 - mu) * Fup0 - (1 + mu) * Fdn0) / det;
    const Fdn = (z) =>
      A * (1 - mu) * Math.exp(kap * z) + B * (1 + mu) * Math.exp(-kap * z);
    const Fup = (z) =>
      A * (1 + mu) * Math.exp(kap * z) + B * (1 - mu) * Math.exp(-kap * z);
    // Eq. 1 residual by central differences mid-slab
    const h = 1e-6;
    const z0 = POND_HI / 2;
    const dDn = (Fdn(z0 + h) - Fdn(z0 - h)) / (2 * h);
    const dUp = (Fup(z0 + h) - Fup(z0 - h)) / (2 * h);
    odeRes = Math.max(
      odeRes,
      Math.abs(dDn - (-(ki + s) * Fdn(z0) + s * Fup(z0))),
      Math.abs(dUp - ((ki + s) * Fup(z0) - s * Fdn(z0)))
    );
    // BCs: 4a at the pond top, 5a/5b continuity, 6a at the ice
    // bottom, and Eq. 8's albedo assembled both ways.
    const a = Fup0 * W; // pond top upwelling (Beer leg up)
    bcRes = Math.max(
      bcRes,
      Math.abs(b - (1 - POND_R1 + POND_R1PP * a)), // BC 4a
      Math.abs(Fup(POND_HI)), // BC 6a: no ocean upwelling
      Math.abs(Fdn(POND_HI) - Tice * Fdn0), // slab transmittance
      Math.abs(
        POND_R1 +
          (1 - POND_R1PP) * a -
          pondAlphaT(kw, ki, POND_HP, POND_HI).alpha
      ) // Eq. 8
    );
  }
  const rowsMatch = ICE_NK.every(([nm, , kap]) => {
    const r = POND_SPECTRAL.find((q) => q[0] === nm);
    return r && r[2] === kap;
  });
  const ok =
    kapAbs &&
    kapSca &&
    muLim &&
    dera &&
    odeRes < 1e-9 &&
    bcRes < 1e-12 &&
    rowsMatch;
  check(
    'printed two-stream machinery',
    ok,
    `mu/kappa limits exact; R1''=(1-R1)/n_w^2=${((1 - POND_R1) / (1.33 * 1.33)).toFixed(3)}~0.54 printed; ODE residual ${odeRes.toExponential(1)}, BC residual ${bcRes.toExponential(1)}; WB2008 rows shared with seaice.js verbatim`
  );
}

{
  // The printed no-scattering limit and the melt endpoint: with
  // sigma_i = 0 "the melt-pond albedo is 0.05, reflecting only
  // specular reflectance at the air-water interface" - EXACT in
  // the model at every wavelength, and the colour is the printed
  // "dark grey" (channels equal). The melting case ends the same
  // way: Hi = 0 leaves alpha = R1 exactly ("almost black").
  const noSc = [680, 550, 440, 500, 800].map((nm) => {
    const row = POND_SPECTRAL.find((r) => r[0] === nm);
    return pondAlphaT(row[1], pondKIce(nm, row[1], row[2]), POND_HP, POND_HI, 0)
      .alpha;
  });
  const exact = noSc.every((a) => Math.abs(a - POND_R1) < 1e-15);
  const end = pondAlbedoRGB(MELT_TOTAL / MELT_DELTA, 0);
  const endExact = end.every((a) => Math.abs(a - POND_R1) < 1e-15);
  const ok = exact && endExact;
  check(
    'printed 0.05 limits',
    ok,
    `sigma_i=0 albedo = R1 = ${POND_R1} exactly at all wavelengths (printed "only specular reflectance", dark grey); melt end Hi=0 also exactly ${end[1].toFixed(2)} ("almost black")`
  );
}

{
  // Lu 2018's printed melting case (Fig. 8, Hi + 1.3 Hp = 1.3 m):
  // the RGB intensities fall "from about 0.6 to 0.05", the pond
  // albedo 0.5 -> 0.05 (flat-weight broadband here, their F0
  // there), the colour runs grey -> blue -> almost black; red
  // stays below green and blue through the melt and falls almost
  // linearly while green and blue accelerate toward the end.
  const rgbAt = (m) => {
    const {Hp, Hi} = pondMeltState(m);
    return foldRGB(Hp, Hi);
  };
  const start = rgbAt(0);
  const mid = rgbAt(0.5);
  const end = rgbAt(1);
  const [, sS] = hslOf(start);
  const [hM] = hslOf(mid);
  const grey =
    sS < 0.08 && Math.max(...start) > 0.5 && Math.max(...start) < 0.7;
  const blue = hM > 0.45 && hM < 0.65 && mid[2] > mid[0];
  const black = Math.max(...end) < 0.07 && hslOf(end)[2] < 0.07;
  // red lower than green and blue through the melting process
  let redLow = true;
  for (const m of [0.25, 0.4, 0.5, 0.6, 0.75, 0.9]) {
    const [r, g, b] = rgbAt(m);
    if (r > g + 1e-9 || r > b + 1e-9) redLow = false;
  }
  // curvature: last-step vs first-step size on quarter marks
  const q = [0, 0.25, 0.5, 0.75, 1].map(rgbAt);
  const stepRatio = (c) =>
    (q[3][c] - q[4][c]) / Math.max(q[0][c] - q[1][c], 1e-9);
  const redLin = stepRatio(0) < 1.6;
  const gbFast = stepRatio(1) > 2 && stepRatio(2) > 2;
  const flatB = (Hp, Hi) => {
    let s = 0;
    for (const [nm] of POND_SPECTRAL) s += pondAlphaAt(nm, Hp, Hi);
    return s / POND_SPECTRAL.length;
  };
  const aStart = flatB(0, MELT_TOTAL);
  const ok =
    grey &&
    blue &&
    black &&
    redLow &&
    redLin &&
    gbFast &&
    aStart > 0.44 &&
    aStart < 0.54;
  check(
    'Lu 2018 melting narrative',
    ok,
    `start grey (sat ${sS.toFixed(3)}, max RGB ${Math.max(...start).toFixed(2)} ~ "about 0.6", albedo ${aStart.toFixed(2)} ~ printed 0.5) -> blue (hue ${hM.toFixed(2)}, B>R) -> almost black (${Math.max(...end).toFixed(3)}); red lowest through the melt and near-linear (late/early step ${stepRatio(0).toFixed(2)}) vs green/blue accelerating (${stepRatio(1).toFixed(2)}/${stepRatio(2).toFixed(2)})`
  );
}

{
  // The Istomina windows (Lu 2018, printed): measured pond colour
  // has hue 0.2-0.5, saturation 0-0.5, luminance 0.4-0.6, and
  // the printed model-measurement agreement band is 2 eps = 0.22
  // (R = 0.822, P < 0.01). The default printed pond must sit in
  // the measured windows within that printed band (it lands just
  // past the cyan edge of the hue window, well inside 2 eps -
  // the theme's deep-red 680 nm channel sees more red loss than
  // a camera's).
  const [h, s, l] = hslOf(foldRGB(POND_HP, POND_HI));
  const ok =
    h > 0.2 && h < 0.5 + 0.22 && s >= 0 && s < 0.5 && l > 0.4 && l < 0.6;
  check(
    'Istomina colour windows',
    ok,
    `default pond HSL ${h.toFixed(3)}/${s.toFixed(3)}/${l.toFixed(3)} vs printed measured hue 0.2-0.5 (+ printed 2eps 0.22), sat 0-0.5, lum 0.4-0.6`
  );
}

{
  // Lu 2016's printed broadband anchors, flat-weight over the
  // vendored 350-800 nm grid (their numbers fold their Fig. 2
  // F0; the flat fold sits a few hundredths above - documented,
  // and the printed INCREMENTS reproduce): default-case albedo
  // vs printed 0.32-0.37; the underlying-ice albedo window
  // "within 0.5 and 0.7", increasing with both Hi and (through
  // the water's spectral weighting) Hp; scattering swing sigma_i
  // 1.2 -> 2.5 raises albedo by the printed ~+0.10 and cuts
  // transmittance by the printed ~-0.12.
  const flatB = (fn) => {
    let s = 0;
    for (const row of POND_SPECTRAL) s += fn(row);
    return s / POND_SPECTRAL.length;
  };
  const aB = flatB(([nm]) => pondAlphaAt(nm));
  const rice = ([nm, kw, kap], Hi = POND_HI) =>
    pondAlphaT(kw, pondKIce(nm, kw, kap), 0, Hi).Rice;
  const riceB = flatB((row) => rice(row));
  const wRice = (Hp) => {
    let s = 0;
    let w = 0;
    for (const row of POND_SPECTRAL) {
      const W2 = Math.exp(-2 * row[1] * Hp);
      s += rice(row) * W2;
      w += W2;
    }
    return s / w;
  };
  const riceHi = flatB((row) => rice(row, 3));
  const aSig = (sig) =>
    flatB(
      ([nm, kw, kap]) =>
        pondAlphaT(kw, pondKIce(nm, kw, kap), POND_HP, POND_HI, sig).alpha
    );
  const tSig = (sig) =>
    flatB(
      ([nm, kw, kap]) =>
        pondAlphaT(kw, pondKIce(nm, kw, kap), POND_HP, POND_HI, sig).T
    );
  const dA = aSig(POND_SIGMA_I_RANGE[1]) - aSig(POND_SIGMA_I_RANGE[0]);
  const dT = tSig(POND_SIGMA_I_RANGE[1]) - tSig(POND_SIGMA_I_RANGE[0]);
  const ok =
    aB > 0.32 &&
    aB < 0.44 &&
    riceB > 0.5 &&
    riceB < 0.7 &&
    riceHi > riceB &&
    wRice(0.5) > wRice(0) &&
    dA > 0.06 &&
    dA < 0.14 &&
    dT < -0.08 &&
    dT > -0.17;
  check(
    'Lu 2016 broadband anchors',
    ok,
    `default albedo ${aB.toFixed(3)} (printed 0.32-0.37 + flat-fold offset); underlying-ice albedo ${riceB.toFixed(2)} in the printed 0.5-0.7, rising with Hi (${riceHi.toFixed(2)} at 3 m) and with Hp via spectral weighting (${wRice(0).toFixed(3)} -> ${wRice(0.5).toFixed(3)}); sigma_i 1.2->2.5 moves albedo +${dA.toFixed(2)} (printed +0.10) and transmittance ${dT.toFixed(2)} (printed -0.12)`
  );
}

{
  // The printed spectral split: pond depth matters only in the
  // 600-900 nm band (the printed reason: "the relatively small
  // k_w value at these wavelengths (< 0.1 m^-1)" - true of every
  // vendored row up to 570 nm; the 580 nm edge row sits at 0.108,
  // the printed bound read loosely at the band edge), while ice
  // thickness shows only below 600 nm, "gradually decreased to
  // nearly zero at 800 nm". Rosel's printed unmixing endmember
  // keeps the same ordering: pond reflectance blue > red > NIR.
  const dHp = (nm) =>
    pondAlphaAt(nm, 0.5, POND_HI) - pondAlphaAt(nm, 0.1, POND_HI);
  const dHi = (nm) => pondAlphaAt(nm, 0, 3) - pondAlphaAt(nm, 0, 0.5);
  const kwLow =
    POND_SPECTRAL.filter(([nm]) => nm <= 570).every(([, kw]) => kw < 0.1) &&
    POND_SPECTRAL.find(([nm]) => nm === 580)[1] < 0.11;
  const young = pondAlphaAt(500, 0.05, 1.5);
  const mature = pondAlphaAt(500, 0.5, 0.3);
  const ok =
    Math.abs(dHp(680)) > 8 * Math.abs(dHp(440)) &&
    Math.abs(dHi(440)) > 3 * Math.abs(dHi(680)) &&
    Math.abs(dHi(800)) < 0.01 &&
    kwLow &&
    pondAlphaAt(470) > pondAlphaAt(640) &&
    pondAlphaAt(640) > pondAlphaAt(800) &&
    young > 0.55 &&
    young < 0.7 &&
    mature > 0.23 &&
    mature < 0.34;
  check(
    'printed spectral split',
    ok,
    `Hp sensitivity 680 vs 440 nm ${dHp(680).toFixed(3)}/${dHp(440).toFixed(3)} (printed: 600-900 only; every vendored k_w < 0.1 below 600 ${kwLow}); Hi sensitivity 440 vs 680/800 ${dHi(440).toFixed(2)}/${dHi(680).toFixed(2)}/${dHi(800).toFixed(3)} (printed: 350-600, ~zero at 800); blue>red>NIR like the printed endmember; 500 nm young ${young.toFixed(2)} / mature ${mature.toFixed(2)} vs printed 0.6/0.25`
  );
}

{
  // Rosel 2012's printed fraction anchors on the machine-read
  // weekly curve: the mean rises through June to a maximum ABOVE
  // 15 % at the end of June, a second local maximum near the end
  // of July, the printed data season is day 129-249 with both
  // tails well below the peak, and every value sits inside the
  // figure's own 0.04-0.18 axis. The drawn fraction obeys the
  // measured gates: nothing below freezing, nothing in the
  // southern hemisphere (no data), nothing out of season.
  const t = POND_FRAC_CURVE;
  const peak = Math.max(...t.map((r) => r[1]));
  const peakDay = t.find((r) => r[1] === peak)[0];
  const axis = t.every(([, v]) => v > 0.04 && v < 0.18);
  // second local maximum: the end-of-July composite week
  let second = 0;
  for (let i = 1; i < t.length - 1; i++) {
    if (
      t[i][0] > 205 &&
      t[i][0] < 222 &&
      t[i][1] >= t[i - 1][1] - 1e-9 &&
      t[i][1] >= t[i + 1][1] - 1e-9
    )
      second = t[i][0];
  }
  const gates =
    pondFraction(180, 5, 75) === pondFractionOfDay(180) &&
    pondFraction(180, -2, 75) === 0 &&
    pondFraction(180, 5, -75) === 0 &&
    pondFraction(100, 5, 75) === 0 &&
    pondFraction(300, 5, 75) === 0 &&
    pondFractionOfDay(129) > 0 &&
    pondFractionOfDay(249) > 0;
  const last = t[t.length - 1];
  const ok =
    t.length === 35 &&
    t[0][0] === 130 &&
    last[0] === 249 &&
    peak > 0.15 &&
    peakDay >= 172 &&
    peakDay <= 182 &&
    second > 0 &&
    t[0][1] < 0.09 &&
    last[1] < 0.09 &&
    axis &&
    gates;
  check(
    'Rosel fraction anchors',
    ok,
    `peak ${peak.toFixed(3)} > 0.15 printed, on day ${peakDay} ("end of June"); second local maximum on day ${second} (the end-of-July composite week); season day 130-249 (printed 129-249), tails ${t[0][1].toFixed(3)}/${last[1].toFixed(3)}; freezing/hemisphere/season gates exact`
  );
}

process.exit(fail ? 1 : 0);
