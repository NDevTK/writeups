// Reference printer for the fogbow (node fogbow-reference.mjs).
// The law lives in fogbow.js over the rainbow's own machinery
// (rainbow.js / optics-lut.js - Airy on Descartes with the
// measured water index) - Mazoyer et al. 2019 (ACP, the SIRTA
// fog microphysics, open access, read in full) supplies the
// printed fog - and these landmarks hold it:
//  - the printed frame: droplet mean diameters 4-14 um, the
//    1 km fog definition, the 18 m thin-fog top, the FM-100
//    2-50 um range
//  - WHITENESS EMERGES: at fog sizes the per-channel Airy first
//    maxima converge to a fraction of their rain-size spread -
//    the colour collapse IS the white bow, across the WHOLE
//    printed span, from the same LUT builder the rainbow uses
//  - the bow pulls inside the rain bow and broadens by the
//    printed (ka)^(-2/3) fringe law
//  - the amplitude is measured end to end: sigma x V = 3.912
//    identically (Koschmieder's definition), and through the
//    rainbow's own two-leg slab at the printed thin-fog top,
//    DENSE FOG KILLS ITS OWN BOW - no threshold coded
//  - the METAR FG family gates; mist, smoke and silence do not
import {
  FOG_D_DRAWN_UM,
  FOG_DM_UM,
  FOG_ND_MAX_CM3,
  FOG_SPECTRO_UM,
  FOG_THIN_TOP_M,
  FOG_VIS_DEF_M,
  fogDropRadiusMm,
  fogReported,
  fogSigH,
  fogSigmaPerM
} from './fogbow.js';
import {KOSCHMIEDER} from './lightning.js';
import {bowSlab, mpDropRadiusMm} from './rainbow.js';
import {buildBowLUT} from './optics-lut.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

// Per-channel primary-peak angle (deg) of a bow LUT.
function peaks(lut) {
  const out = [0, 0, 0];
  const best = [0, 0, 0];
  for (let i = 0; i < lut.bins; i++) {
    const th =
      lut.thMinDeg + ((i + 0.5) * (lut.thMaxDeg - lut.thMinDeg)) / lut.bins;
    if (th > 45) break;
    for (let c = 0; c < 3; c++) {
      const v = lut.data[i * 4 + c];
      if (v > best[c]) {
        best[c] = v;
        out[c] = th;
      }
    }
  }
  return out;
}
// Green-channel FWHM (deg) of the primary.
function widthG(lut) {
  let pk = 0;
  let pi = 0;
  for (let i = 0; i < lut.bins; i++) {
    const v = lut.data[i * 4 + 1];
    if (v > pk) {
      pk = v;
      pi = i;
    }
  }
  let lo = pi;
  let hi = pi;
  while (lo > 0 && lut.data[lo * 4 + 1] > pk / 2) lo--;
  while (hi < lut.bins - 1 && lut.data[hi * 4 + 1] > pk / 2) hi++;
  return ((hi - lo) * (lut.thMaxDeg - lut.thMinDeg)) / lut.bins;
}

// ---- 1. the printed frame ---------------------------------------
{
  check(
    'printed fog frame carried',
    FOG_DM_UM[0] === 4 &&
      FOG_DM_UM[1] === 14 &&
      FOG_D_DRAWN_UM === 14 &&
      FOG_VIS_DEF_M === 1000 &&
      FOG_THIN_TOP_M === 18 &&
      FOG_SPECTRO_UM[0] === 2 &&
      FOG_SPECTRO_UM[1] === 50 &&
      FOG_ND_MAX_CM3 === 255 &&
      Math.abs(fogDropRadiusMm() - 0.007) < 1e-15,
    `Mazoyer's 23 events: Dm 4-14 um (drawn at the clean-fog 14 um end - the ` +
      `a^(7/3) weighting on the printed size-number anticorrelation), the 1 km ` +
      `fog definition, the 18 m thin-fog top, the 2-50 um spectrometer range`
  );
}

// ---- 2. whiteness emerges from the one Airy law -----------------
{
  const rain = buildBowLUT(256, mpDropRadiusMm(1));
  const fog = buildBowLUT(256, fogDropRadiusMm());
  const fogLo = buildBowLUT(256, FOG_DM_UM[0] / 2 / 1000);
  const pr = peaks(rain);
  const pf = peaks(fog);
  const pl = peaks(fogLo);
  const sepRain = Math.abs(pr[0] - pr[2]);
  const sepFog = Math.abs(pf[0] - pf[2]);
  const sepLo = Math.abs(pl[0] - pl[2]);
  check(
    'the colour collapse IS the white bow',
    sepRain > 1.0 && sepFog < 0.45 * sepRain && sepLo < 0.7 * sepRain,
    `rain (Marshall-Palmer 1 mm/h): red and blue primaries ${sepRain.toFixed(1)} deg ` +
      `apart - the rainbow; fog 14 um: ${sepFog.toFixed(2)} deg; fog 4 um: ` +
      `${sepLo.toFixed(2)} deg - the separation collapses across the WHOLE ` +
      `printed span, same builder, size only`
  );
  const wR = widthG(rain);
  const wF = widthG(fog);
  check(
    'broad and pulled inside',
    wF > 3 * wR && pf[1] < pr[0] - 1 && pf[1] > 35.5,
    `green FWHM ${wR.toFixed(1)} deg (rain) -> ${wF.toFixed(1)} deg (fog, ` +
      `x${(wF / wR).toFixed(1)} - the printed (ka)^(-2/3) fringe law ballooning); ` +
      `the fog primary sits ${(pr[0] - pf[1]).toFixed(1)} deg inside the rain ` +
      `red peak - the Airy shift at small size, the classic fogbow radius`
  );
}

// ---- 3. the measured amplitude ----------------------------------
{
  const v300 = fogSigmaPerM(300) * 300;
  check(
    'Koschmieder bridge exact',
    Math.abs(v300 - KOSCHMIEDER) < 1e-12 &&
      Math.abs(fogSigmaPerM(50) * 50 - KOSCHMIEDER) < 1e-12 &&
      fogSigmaPerM(NaN) === 0 &&
      fogSigmaPerM(-5) === 0 &&
      Math.abs(fogSigH(300) - (KOSCHMIEDER * 18) / 300) < 1e-15,
    `sigma x V = 3.912 identically (visibility's own definition, ` +
      `lightning.js); sigma x 18 m = ${fogSigH(300).toFixed(3)} at 300 m ` +
      `visibility; unmeasured visibility -> no extinction -> no bow`
  );
  const sunS = Math.sin((25 * Math.PI) / 180);
  const viewS = Math.sin((5 * Math.PI) / 180);
  const bright = bowSlab(fogSigH(400), sunS, viewS);
  const dense = bowSlab(fogSigH(50), sunS, viewS);
  check(
    'dense fog kills its own bow',
    bright > 0 &&
      dense > 0 &&
      bright / dense > 3 &&
      bowSlab(fogSigH(NaN), sunS, viewS) === 0,
    `the rainbow's own two-leg slab at the printed 18 m top: 400 m visibility ` +
      `scatters ${(bright / dense).toFixed(1)}x more into the bow than 50 m - ` +
      `the sun leg's extinction extinguishes the display as the bank thickens, ` +
      `emergent, no threshold coded`
  );
}

// ---- 4. the measured occurrence ---------------------------------
{
  check(
    'METAR FG family gates, fails closed',
    fogReported('FG') &&
      fogReported('MIFG') &&
      fogReported('BCFG') &&
      fogReported('PRFG') &&
      fogReported('FZFG') &&
      fogReported('VCFG') &&
      fogReported('-RA FG') &&
      !fogReported('BR') &&
      !fogReported('FU') &&
      !fogReported('BLSN') &&
      !fogReported('GFG') &&
      !fogReported('') &&
      !fogReported(null),
    `FG with its printed qualifiers (shallow/patches/partial/freezing/` +
      `vicinity) reports droplet fog under the 1 km definition; mist, smoke, ` +
      `blowing snow, fragments and silence do not`
  );
}

if (fail) {
  console.log(`${fail} LANDMARK(S) FAILED`);
  process.exit(1);
}
