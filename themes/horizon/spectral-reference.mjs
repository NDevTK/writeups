// Reference printer for the spectral display projection (node
// spectral-reference.mjs). Ground truth for the 3-line CIE fix:
//  - the PUBLISHED IEC 61966-2-1 XYZ->sRGB coefficients
//    (3.2406, -1.5372, ...) EMERGE from the primaries + D65
//    derivation - they are never pasted into the code
//  - the equal-radiance -> D65 construction has a unique
//    all-positive solution, and it preserves neutrality exactly:
//    P (1,1,1) = (1,1,1) to floating point
//  - the measured teal cast moves the RIGHT way: the Rayleigh
//    zenith mixture's G/B drops from 0.410 to 0.323 and R/B
//    rises 0.175 -> 0.241 (550 nm stops masquerading as the
//    green primary; the diagnosis pinned, not just "looks less
//    teal")
//  - a PURE 550 nm line is out of sRGB gamut; the standard
//    zero clip lands it back on the green primary axis - the
//    projection changes mixtures only, exactly where the cast
//    lived
import {
  applySpectral,
  CMF,
  SPECTRAL_TO_SRGB,
  spectralToSrgbMatrix,
  xyzToSrgbMatrix
} from './spectral-srgb.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // The CVRL table rows carry the textbook chromaticity of
  // 550 nm - a yellow-green at (0.302, 0.692), NOT the sRGB
  // green primary (0.300, 0.600). This gap IS the teal bug.
  const [X, Y, Z] = CMF[550];
  const x = X / (X + Y + Z);
  const y = Y / (X + Y + Z);
  check(
    '550 nm chromaticity',
    Math.abs(x - 0.3016) < 5e-4 && Math.abs(y - 0.6923) < 5e-4,
    `550 nm sits at (${x.toFixed(4)}, ${y.toFixed(4)}) - yellow-green, not the sRGB green primary (0.300, 0.600); writing its radiance straight into G is the measured teal cast`
  );
}

{
  // The IEC 61966-2-1 matrix emerges from the derivation. The
  // published 4-decimal values (Poynton / IEC): row-major.
  const pub = [
    [3.2406, -1.5372, -0.4986],
    [-0.9689, 1.8758, 0.0415],
    [0.0557, -0.204, 1.057]
  ];
  const M = xyzToSrgbMatrix();
  let worst = 0;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      worst = Math.max(worst, Math.abs(M[i][j] - pub[i][j]));
  check(
    'IEC matrix emerges',
    worst < 6e-4,
    `XYZ->sRGB derived from the primaries + D65 matches the published IEC 61966-2-1 coefficients to ${worst.toExponential(1)} (M[0][0] = ${M[0][0].toFixed(6)} vs 3.2406) - the standard emerges, it is not pasted`
  );
}

{
  // Equal radiance -> D65: the 3x3 solve has a unique
  // ALL-POSITIVE solution (a physical scaling, not a formal one),
  // and neutrality survives the whole chain exactly.
  const {P, scales} = spectralToSrgbMatrix();
  const one = P.map((r) => r[0] + r[1] + r[2]);
  const worst = Math.max(
    Math.abs(one[0] - 1),
    Math.abs(one[1] - 1),
    Math.abs(one[2] - 1)
  );
  check(
    'neutrality by construction',
    scales.every((s) => s > 0) && worst < 1e-12,
    `line scales (${scales.map((s) => s.toFixed(4)).join(', ')}) all positive; P (1,1,1) = (1,1,1) to ${worst.toExponential(1)} - the fix CANNOT re-tint greys, only spectrally skewed mixtures`
  );
}

{
  // The pinned de-teal: the single-scattered Rayleigh zenith
  // mixture (lambda^-4 weights against 680 nm) moves from the
  // cyan-drifted raw ratios to the projected ones.
  const ray = [1, (680 / 550) ** 4, (680 / 440) ** 4];
  const out = applySpectral(ray);
  const gb0 = ray[1] / ray[2];
  const rb0 = ray[0] / ray[2];
  const gb = out[1] / out[2];
  const rb = out[0] / out[2];
  check(
    'Rayleigh de-teal',
    Math.abs(gb0 - 0.41) < 5e-3 &&
      Math.abs(gb - 0.323) < 2e-3 &&
      Math.abs(rb0 - 0.175) < 5e-3 &&
      Math.abs(rb - 0.241) < 2e-3,
    `zenith Rayleigh mixture: G/B ${gb0.toFixed(3)} -> ${gb.toFixed(3)}, R/B ${rb0.toFixed(3)} -> ${rb.toFixed(3)} - less green, more red, out of the teal quadrant (the diagnosed drift, reversed)`
  );
}

{
  // A pure monochromatic 550 nm line is OUTSIDE sRGB; the
  // standard zero clip returns it to the green primary axis.
  // Monochromatic stimuli end where they started - only
  // mixtures change.
  const raw = SPECTRAL_TO_SRGB.map((r) => r[1]);
  const out = applySpectral([0, 1, 0]);
  check(
    'pure 550 clips to green',
    raw[0] < 0 && raw[2] < 0 && out[0] === 0 && out[2] === 0 && out[1] > 1,
    `P (0,1,0) = (${raw.map((v) => v.toFixed(3)).join(', ')}) - R and B negative (out of gamut), the zero clip lands on the green primary axis (0, ${out[1].toFixed(3)}, 0); the projection changes MIXTURES, monochromatic saturation survives`
  );
}

process.exit(fail ? 1 : 0);
