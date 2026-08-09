// looming-reference.mjs - the gate for the Bathurst looming
// hindcast (looming.js) and for the mirage fan's SECOND IMAGE
// (the stage-B draw). The law lives once in looming.js /
// far-terrain.js; the primary (Lehn & Legal 1998, Appl. Opt.
// 37, 1489 - author-hosted OA, read in full) supplies both the
// printed model anchors and the theodolite record. Landmarks:
//  - THE PRINTED STANDARD-AIR ANCHORS: their -14.2' ray grazes
//    the sea at their printed 32.4 km (to a fraction of a
//    metre, at the razor-thin discriminant the geometry
//    actually has), and their angle-to-elevation translations
//    at Claxton Point (-12.6' -> 14 m, -12.1' -> 18 m) land to
//    ~0.5 m - the repo's Ciddor kappa chain meeting their ray
//    tracer on three printed numbers
//  - THE PEAK IS INVISIBLE in ordinary air (their "nothing was
//    previously visible", through the same masked march)
//  - THE LOOMING EMERGES at a MILD inversion: visibility onset
//    near 2 degC of Fermi jump at their printed 60 m center
//    ("the weakest inversion", their own criterion), and at
//    dT* ~ 3.9 the image reproduces their printed model span
//    [-12.6', -9.8'] with the top 37-m-class of the peak at
//    2x-class magnification - the theodolite record hindcast
//  - THE SECOND IMAGE: under a hard duct a whole band of
//    target heights carries TWO images - adjacent fold branches
//    with opposite parity, the upper compressing into the
//    duct-edge wall - the stack the drawn stage-B strip rides
import {
  LOOM_CLAXTON_KM,
  LOOM_MAG,
  LOOM_PEAK_KM,
  LOOM_TOP_ARCMIN,
  loomImage,
  loomMarch,
  loomProfile
} from './looming.js';
import {fanBranches, rayFan} from './far-terrain.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const arcmin = (a) => (a / 60 / 180) * Math.PI;

// ---- the printed standard-air anchors -------------------------
{
  const m142 = loomMarch(arcmin(-14.2), 0, {mask: false});
  let minH = Infinity;
  let minAtKm = 0;
  for (let x = 20000; x <= 45000; x += 50) {
    const h = m142.hAt(x);
    if (h < minH) {
      minH = h;
      minAtKm = x / 1000;
    }
  }
  const h126 = loomMarch(arcmin(-12.6), 0, {mask: false}).hAt(
    LOOM_CLAXTON_KM * 1000
  );
  const h121 = loomMarch(arcmin(-12.1), 0, {mask: false}).hAt(
    LOOM_CLAXTON_KM * 1000
  );
  check(
    'the printed standard-air anchors land',
    minH < 3 &&
      Math.abs(minAtKm - 32.4) < 2 &&
      Math.abs(h126 - 14) < 1.5 &&
      Math.abs(h121 - 18) < 1.5,
    `their -14.2' ray grazes to ${minH.toFixed(1)} m at ` +
      `${minAtKm.toFixed(1)} km (their printed sea tangency: 32.4 km - ` +
      `a razor-thin discriminant, and the march lands on it); Claxton ` +
      `translations ${h126.toFixed(1)} / ${h121.toFixed(1)} m vs their ` +
      `printed 14 / 18 - the repo's Ciddor kappa chain and their ray ` +
      `tracer meet on three printed numbers with no tuning`
  );
}

// ---- invisible, then looming ----------------------------------
{
  const img0 = loomImage(0);
  let thresh = NaN;
  for (let dT = 1; dT <= 4; dT += 0.1) {
    if (loomImage(dT).visible) {
      thresh = dT;
      break;
    }
  }
  let best = null;
  for (let dT = 3; dT <= 5.2; dT += 0.1) {
    const im = loomImage(dT);
    if (!im.visible) continue;
    const d = Math.abs(im.topArcmin - LOOM_TOP_ARCMIN);
    if (!best || d < best.d) best = {dT, d, ...im};
  }
  check(
    'THE LOOMING EMERGES as recorded',
    !img0.visible &&
      thresh > 1.5 &&
      thresh < 3 &&
      best &&
      best.dT < 5 &&
      Math.abs(best.topArcmin - -9.8) < 0.4 &&
      Math.abs(best.baseArcmin - -12.6) < 0.5 &&
      best.depthM > 30 &&
      best.depthM < 50 &&
      best.mag > 1.7 &&
      best.mag < 2.6,
    `ordinary air: the 351 m peak at 105 km is INVISIBLE (their ` +
      `"nothing was previously visible" - every ray over Claxton passes ` +
      `above it); a Fermi inversion at their printed 60 m makes it loom ` +
      `from dT ~ ${thresh.toFixed(1)} degC ("the weakest inversion", ` +
      `mild as they demand), and at dT* = ${best.dT.toFixed(1)} the ` +
      `image spans ${best.baseArcmin.toFixed(1)}' to ` +
      `${best.topArcmin.toFixed(1)}' - their printed model span -12.6' ` +
      `to -9.8' - lifting the top ${best.depthM.toFixed(0)} m of the ` +
      `peak (printed: 37 m) at ${best.mag.toFixed(2)}x magnification ` +
      `(printed ${LOOM_MAG}; the residual is the unprinted inversion ` +
      `shape - theirs is a figure, ours the NZ pass's Fermi form)`
  );
}

// ---- the second image: stack, parity, and the wall ------------
{
  // The 1597 duct itself (the NZ pass's printed parameters, dT
  // 12 K at 80 m) as the hard-duct case, through the SHIPPED fan
  // machinery (far-terrain.js rayFan/fanBranches - exactly what
  // the client's second ring mesh draws). Three classical facts
  // of the two-image band at 60 km:
  //  - the STACK: a band of target heights carries two images;
  //  - OPPOSITE PARITY: the lower image is INVERTED (apparent
  //    elevation falls as the target rises) while the upper
  //    moves the other way - adjacent fold branches alternate;
  //  - THE WALL: the upper image compresses the whole band into
  //    a sub-arcsecond line at the duct's edge - the vertical
  //    stacking that turns coasts into walls in Lehn's
  //    photographs and squeezed de Veer's sun.
  const prof = loomProfile(12, 80, 5);
  const alphas = [];
  const N = 4800;
  for (let i = 0; i < N; i++)
    alphas.push(((-0.4 + (0.7 * i) / (N - 1)) * Math.PI) / 180);
  const fan = rayFan(prof, 14, alphas, 80e3, 50);
  const dM = 60e3;
  const hs = [51, 55, 59];
  const brs = hs.map((h) => fanBranches(fan, dM, h));
  const twoEach = brs.every((b) => b.length === 2);
  const b0 = brs.map((b) => b[0]);
  const b1 = brs.map((b) => b[1]);
  const inverted = twoEach && b0[1] < b0[0] && b0[2] < b0[1];
  const span0 = twoEach ? Math.abs(b0[2] - b0[0]) : 0;
  const span1 = twoEach ? Math.abs(b1[2] - b1[0]) : Infinity;
  const wall = twoEach && span1 < span0 / 50;
  const sep = twoEach && b1[0] - b0[0] > arcmin(5);
  const asec = (r) => ((r * 180 * 3600) / Math.PI).toFixed(1);
  check(
    'THE SECOND IMAGE: stack, parity and the wall',
    twoEach && inverted && wall && sep,
    `under the 1597 duct a 51-59 m target band at 60 km carries TWO ` +
      `images ~${(((b1[0] - b0[0]) * 180 * 60) / Math.PI).toFixed(0)}' apart: ` +
      `the lower is INVERTED (apparent ${asec(b0[0])}" -> ${asec(b0[2])}" ` +
      `as the target rises 8 m) while the upper compresses the same 8 m ` +
      `into ${asec(span1)}" (${(span0 / Math.max(span1, 1e-9)).toFixed(0)}x ` +
      `flatter than the lower image's ${asec(span0)}") - the duct-edge ` +
      `WALL of the classic superior mirage, the stacking that squeezed ` +
      `de Veer's sun; adjacent fold branches carry opposite parity, and ` +
      `the far ring's second mesh now draws exactly this branch`
  );
}

process.exit(fail ? 1 : 0);
