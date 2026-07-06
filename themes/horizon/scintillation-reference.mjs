// Reference printer for stellar scintillation (node
// scintillation-reference.mjs). The model lives once in
// scintillation.js; landmarks:
//  - Young (1967): the naked eye at zenith sits at sigma ~ 0.25
//    (stars visibly twinkle even overhead); a 10 cm telescope with
//    1 s exposures at ~0.02 (they barely do) - the textbook
//    contrast between eye and instrument
//  - the X^(7/4) airmass law: horizon stars (X ~ 5-6) saturate the
//    clamp - violent twinkle low in the sky
//  - mean conservation is EXACT: the time-average of the displayed
//    intensity equals 1 at every sigma (I0 normaliser), checked by
//    quadrature; the shader's 4-term I0 agrees to 1e-6 on the
//    clamped range
import {
  besselI0,
  besselI0Shader,
  EYE_D_CM,
  EYE_DT_S,
  intensity,
  SIGMA_MAX,
  youngSigma
} from './scintillation.js';

{
  const eye = youngSigma(EYE_D_CM, 1);
  const eyeX2 = youngSigma(EYE_D_CM, 2);
  const tel = youngSigma(10, 1, 0, 1);
  console.log(
    `REF young: eye zenith sigma ${eye.toFixed(3)} (~0.25),` +
      ` eye X=2 ${eyeX2.toFixed(3)},` +
      ` 10 cm scope 1 s ${tel.toFixed(3)} (~0.02)`
  );
  console.log(
    `REF airmass law: X=4 / X=1 ratio ${(youngSigma(EYE_D_CM, 4) / eye).toFixed(2)}` +
      ` (4^1.75 = ${Math.pow(4, 1.75).toFixed(2)})`
  );
}

{
  let worst = 0;
  let worstShader = 0;
  for (const sigma of [0.1, 0.25, 0.6, SIGMA_MAX]) {
    // quadrature mean of the displayed intensity over one period
    const M = 200000;
    let mean = 0;
    for (let k = 0; k < M; k++) {
      mean += intensity(sigma, Math.sin((2 * Math.PI * (k + 0.5)) / M)) / M;
    }
    worst = Math.max(worst, Math.abs(mean - 1));
    worstShader = Math.max(
      worstShader,
      Math.abs(besselI0Shader(sigma) / besselI0(sigma) - 1)
    );
  }
  console.log(
    `REF mean conservation: worst |E[I] - 1| = ${worst.toExponential(1)};` +
      ` shader I0 rel err ${worstShader.toExponential(1)}`
  );
}
