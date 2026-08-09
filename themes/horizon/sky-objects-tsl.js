import {
  AdditiveBlending,
  BackSide,
  Color,
  DataTexture,
  FloatType,
  LinearFilter,
  RedFormat,
  RGBAFormat,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  NodeMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SpriteNodeMaterial,
  Vector3
} from 'three/webgpu';
import {
  Fn,
  abs,
  acos,
  asin,
  atan,
  bitcast,
  instancedBufferAttribute,
  cameraPosition,
  cameraProjectionMatrix,
  clamp,
  dot,
  exp,
  float,
  length,
  log,
  max,
  mix,
  mod,
  modelViewMatrix,
  modelWorldMatrix,
  normalWorld,
  normalize,
  positionLocal,
  positionWorld,
  pow,
  screenSize,
  select,
  sin,
  smoothstep,
  sqrt,
  step,
  texture,
  uint,
  uniform,
  uv,
  vertexStage,
  vec2,
  vec3,
  vec4
} from 'three/tsl';
import {buildBowLUT, buildHaloLUT} from './optics-lut.js';
import {
  buildAuroraLUT,
  wavelengthToLinearSRGB,
  Z_MAX,
  Z_MIN
} from './aurora-lut.js';
import {EYE_D_CM, SIGMA_MAX, youngSigma} from './scintillation.js';
import {
  BLUE_EXC_W,
  QUENCH_1P_KM,
  QUENCH_2P_KM,
  SPRITE_BOT_KM,
  SPRITE_LAM_BLUE,
  SPRITE_LAM_RED,
  SPRITE_TOP_KM,
  quenchScaleHeightKm
} from './sprites.js';
import {AGLOW_GAIN, LINES, R_EARTH} from './airglow.js';
import {buildZodiacalGrid, OBLIQUITY, zlPerGreen} from './zodiacal.js';
import {ang2pix, cellS10, CELL_AREA_DEG2, kelvinFromBpRp} from './milkyway.js';
import {MW_FBP, MW_FG, MW_FRP} from './milkyway-data.js';
import {starTintRGB} from './stars-color.js';

/**
 * Horizon's sky objects as TSL node materials (WebGPU project,
 * phase 2). Each factory is a 1:1 port of the ShaderMaterial it
 * replaces in Horizon.html - same uniforms (exposed with the same
 * `.value` shape), same math, so the frame loop drives them
 * unchanged and the A/B harness can hold them to the GLSL output.
 *
 * The two Points systems (stars, planets) become instanced sprite
 * quads: WebGPU has no gl_PointSize (point-list rasterizes at one
 * pixel), so the point sprites are PlaneGeometry instances under
 * SpriteNodeMaterial - the way three's own WebGPU particle examples
 * draw them - with the scale node converting the catalogue's pixel
 * sizes to world units through the projection (pixel-exact at the
 * sprite centre, like gl_PointSize).
 */

// The overcast veil, RADIOMETRIC (overcast.js, gated by
// overcast-reference.mjs): the sky under a stratocumulus slab of
// Wood 2012's printed liquid water path at Miles' printed
// effective radius, transmitted by Meador & Weaver's conservative
// two-stream closed form, drawn with THEIR OWN Eq. (30) emergent
// gradation L(mu) = E (2 + 3 mu) / (4 pi) - zenith 2.5x horizon.
// The theme feeds veilE = E_below x exposure per channel (sun +
// moon + measured sky ambient, display-projected); the material
// carries only the printed angular law. Opacity is the COVER
// fraction itself - at the drawn tau the covered sky is opaque
// (e^-tau ~ 1e-6) - so the old hand-picked #79838c/#a2abb3
// gradient, the cloudy^2 x 0.85 fade and the day gate are all
// retired: day and night live in the fed irradiance.
export function createVeilMaterial() {
  const u = {
    alpha: uniform(0),
    veilE: uniform(new Color(0, 0, 0))
  };
  const material = new NodeMaterial();
  material.side = BackSide;
  material.transparent = true;
  material.depthWrite = false;
  const mu = clamp(normalize(positionLocal).y, 0.0, 1.0);
  material.colorNode = vec3(u.veilE).mul(
    mu
      .mul(3.0)
      .add(2.0)
      .mul(1 / (4 * Math.PI))
  );
  material.opacityNode = u.alpha;
  return {material, u};
}

// The moon: Hapke photometry (see block comment below). The disc
// stays flat at full phase like the real moon - the mu0/(mu0+mu)
// Lommel-Seeliger backbone survives inside Hapke's IMSA - and the
// brightness now follows the observed phase curve, opposition surge
// included.
// skyFor: the atmosphere's skyRadiance node factory. The moon is
// above every metre of air on the ray, so the dome's in-scatter adds
// over the disc - by day the dark limb carries the sky's own
// radiance instead of occluding it (the disc stays opaque, so lunar
// occultations of stars still work).
export function createMoonMaterial(skyFor, faceTex, umbraTex) {
  const u = {
    sunDirM: uniform(new Vector3(0, 1, 0)),
    albM: uniform(new Color('#cdd4e2')),
    glowM: uniform(new Color('#0c0f16')),
    // Lunar-eclipse shadow (lunar-umbra.js): the shadow centre's
    // world direction, the penumbral angular radius, and the
    // gate. The per-fragment position in the shadow samples
    // Mallama's printed profile.
    shadowDir: uniform(new Vector3(0, 0, 1)),
    shadowPen: uniform(0.02),
    eclOn: uniform(0),
    // earthlight/sunlight illuminance ratio (earthshine.js: the
    // Goode 2001 measured Earth albedo through the Lambert phase
    // law at the exact complement of the lunar phase; ~8e-5 at
    // new moon, 0 at full) - fed per frame by the theme
    eshine: uniform(0)
  };
  const material = new NodeMaterial();

  // Hapke (1981) IMSA lunar photometry with the (2002) H-function
  // approximation and the SHOE opposition surge; single-lobe
  // Henyey-Greenstein; lunar parameters from Helfenstein & Veverka
  // (1987): w = 0.21, B0 = 2.0, h = 0.07, xi = -0.18. Macroscopic
  // roughness theta-bar is omitted - sub-pixel at the theme's 6-px
  // disc (documented in moon-reference.mjs, whose disk-integrated
  // curve reproduces the observed lunar phase function: 0.082 of
  // full at g = 90 deg vs Rougier's ~0.08). Replaces Lommel-Seeliger,
  // whose curve lacks the opposition surge entirely. Normalised by
  // the full-moon disc-centre value (from the reference) times 0.5
  // so the previously calibrated full-moon brightness is unchanged.
  const W_SS = 0.21;
  const B0 = 2.0;
  const HW = 0.07;
  const XI = -0.18;
  const GAM = Math.sqrt(1 - W_SS);
  const R0 = (1 - GAM) / (1 + GAM);
  const R_FULL_CENTRE = 2.71872; // moon-reference.mjs
  const hapkeH = (xRaw) => {
    const x = clamp(xRaw, 1e-3, 1.0);
    return float(1).div(
      float(1).sub(
        x.mul(W_SS).mul(
          float(R0).add(
            float(1)
              .sub(x.mul(2 * R0))
              .mul(0.5)
              .mul(log(float(1).add(x).div(x)))
          )
        )
      )
    );
  };

  const n = normalize(normalWorld);
  const view = normalize(cameraPosition.sub(positionWorld));
  const mu0 = dot(n, u.sunDirM);
  const mu = dot(n, view);
  // Phase angle at the moon: between the sun direction and the
  // direction back to the observer. Only cos(g) is needed.
  const cg = clamp(dot(u.sunDirM, view), -1.0, 1.0);
  const tanHalfG = sqrt(
    clamp(float(1).sub(cg).div(float(1).add(cg)), 0.0, 1e6)
  );
  const Bg = float(B0).div(float(1).add(tanHalfG.div(HW)));
  const Pg = float(1 - XI * XI).div(
    pow(max(float(1 + XI * XI).add(cg.mul(2 * XI)), 1e-4), 1.5)
  );
  const rHapke = mu0.div(max(mu0.add(mu), 1e-3)).mul(
    Bg.add(1)
      .mul(Pg)
      .add(hapkeH(mu0).mul(hapkeH(mu)))
      .sub(1)
  );
  const lunar = select(
    mu0.greaterThan(0.0),
    rHapke.mul(0.5 / R_FULL_CENTRE),
    0.0
  );
  // Earthshine: the dark limb is lit FROM the observer's own
  // direction - true opposition geometry - so the SAME Hapke
  // kernel applies with incidence along the view: mu0 = mu and
  // g = 0, where the SHOE surge is fully on (B = B0) and the
  // Henyey-Greenstein lobe takes its closed-form backscatter
  // value P(0) = (1 - xi^2)/(1 + xi^2 + 2 xi)^1.5. u.eshine
  // carries the earthlight/sunlight ratio; the whole disc gets
  // the term (its contribution under the sunlit side is 1e-4 of
  // the sunlight - invisible there, the ashen glow elsewhere).
  const P0 = (1 - XI * XI) / Math.pow(1 + XI * XI + 2 * XI, 1.5);
  const earthlit = select(
    mu.greaterThan(0.0),
    hapkeH(mu)
      .mul(hapkeH(mu))
      .add((B0 + 1) * P0 - 1)
      .mul(0.5)
      .mul(0.5 / R_FULL_CENTRE)
      .mul(u.eshine),
    0.0
  );
  // The measured face (moon-albedo-data.js: LROC WAC mosaic,
  // mean-1 modulation): sampled by the LOCAL normal - the mesh's
  // quaternion is the body orientation (moonface.js), so local
  // coordinates ARE selenographic. Row 0 = north at v = 0
  // (DataTexture memory order), column 0 = lon 0, east positive;
  // texel 128 = 1.0.
  // The eclipse shadow multiplies the SUN-lit term only (the
  // earthshine term is its own geometry): per-fragment shadow
  // position pos = 1 - d/penumbra (Mallama's Pos'n with the live
  // penumbral radius), the printed profile from the LUT.
  let sunTerm = lunar;
  if (umbraTex) {
    const skyD = normalize(positionWorld.sub(cameraPosition));
    const dAng = acos(clamp(dot(skyD, u.shadowDir), -1.0, 1.0));
    const sPos = clamp(
      float(1).sub(dAng.div(max(u.shadowPen, 1e-6))),
      0.0,
      1.0
    );
    const sFac = texture(umbraTex).sample(vec2(sPos, 0.5)).rgb;
    sunTerm = sunTerm.mul(mix(vec3(1, 1, 1), sFac, u.eclOn));
  }
  let shape = sunTerm.add(earthlit);
  if (faceTex) {
    const nL = normalize(positionLocal);
    const fLat = asin(clamp(nL.y, -1.0, 1.0));
    const fLon = atan(nL.x, nL.z);
    const fUV = vec2(
      fLon
        .div(2 * Math.PI)
        .add(1)
        .mod(1),
      float(0.5).sub(fLat.div(Math.PI))
    );
    shape = shape.mul(
      texture(faceTex)
        .sample(fUV)
        .r.mul(255 / 128)
    );
  }
  let moonCol = u.albM.mul(shape).mul(2.0).add(u.glowM);
  if (skyFor)
    moonCol = moonCol.add(skyFor(normalize(positionWorld.sub(cameraPosition))));
  material.colorNode = moonCol;
  return {material, u};
}

// Additive aurora curtains; the oval's real latitude enters as uBase.
// The vertical structure and color are PHYSICAL (aurora-lut.js):
// Fang et al. 2010 electron deposition through the CIRA-72 mean
// atmosphere, line profiles for 630.0 / 557.7 / 427.8 nm with O(1D)
// quenching, sampled by the fragment's emission altitude. The
// characteristic energy E0 (from the precipitation data) rebuilds
// the LUT in place; the sine curtain waving stays as the documented
// shape heuristic (curtain fluid dynamics are out of scope). The
// theme drives `strength` as OVATION drive x the Crumey visibility
// of the curtain's PRINTED brightness (aurora-lut.js curtain
// photometry: the kR ladder against the live sky luminance), so
// appearance is earned, not ramped. What the physics gives
// untuned: green lower border near 100 km, the purple N2+ fringe
// below it, red 630.0 tops above 200 km that take over as
// precipitation softens.
export function createAuroraMaterial() {
  const u = {
    time: uniform(0),
    strength: uniform(0),
    uBase: uniform(60),
    // tan(|inclination|) from IGRF at the visitor: auroral rays run
    // along B, so in the curtain plane they fan toward the MAGNETIC
    // ZENITH - vertical at the magnetic-meridian centre, leaning by
    // atan(sin(beta)/tan I) at azimuth beta along the arc (the exact
    // projection of the field line onto the curtain surface).
    uTanI: uniform(3.73)
  };
  // Must match the curtain mesh (open CylinderGeometry in the theme).
  const ARC = Math.PI / 1.3;
  const RADIUS = 760;
  // Each E0 rebuild ships a FRESH DataTexture through the node's
  // value. Mutating one live texture (data.set + needsUpdate) is
  // the documented three pattern, but on this build's WebGPU
  // backend the mid-loop re-upload leaves the GPU copy ZEROED -
  // the curtain drew nothing while its CPU-side LUT was full
  // (found by this pass's ladder probe: a fresh texture samples
  // bright, the mutated original samples black). Swapping
  // textureNode.value is the supported path and survives it.
  const mkLut = (e) => {
    const t = new DataTexture(
      buildAuroraLUT(e).data,
      128,
      1,
      RGBAFormat,
      FloatType
    );
    t.minFilter = t.magFilter = LinearFilter;
    t.needsUpdate = true;
    return t;
  };
  const lutNode = texture(mkLut(3));
  let builtE0 = 3;
  const setE0 = (e0) => {
    const e = Math.min(Math.max(e0, 0.3), 20);
    if (Math.abs(e - builtE0) < builtE0 * 0.05) return;
    builtE0 = e;
    const old = lutNode.value;
    lutNode.value = mkLut(e);
    if (old) old.dispose();
  };
  // Monochromatic line colors (CIE fits, linear sRGB) with
  // calibrated display gains. Green and blue share the N2 profile
  // shape, so the blue gain carries the OBSERVED photometric ratio
  // I(5577)/I(4278) ~ 5.5 (Rees 1989); the red gain is exposure for
  // the folded O(1D) chain.
  const C630 = wavelengthToLinearSRGB(630.0).map((v) => v * 2.0);
  const C5577 = wavelengthToLinearSRGB(557.7).map((v) => v * 1.0);
  const C4278 = wavelengthToLinearSRGB(427.8).map((v) => v * (1 / 5.5));

  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = DoubleSide;
  material.blending = AdditiveBlending;
  const ux = uv().x;
  const h = clamp(positionWorld.y.sub(u.uBase).div(720.0), 0.0, 1.0);
  // The curtain's vertical span maps to emission altitude: base at
  // 92 km (below the green border so the N2+ fringe shows), top at
  // 320 km (red 630.0 territory).
  const zKm = mix(92.0, 320.0, h);
  const lut = lutNode.sample(vec2(zKm.sub(Z_MIN).div(Z_MAX - Z_MIN), 0.5));
  // Field-aligned rays: shear the ray/wave coordinate so columns
  // follow the projected field line - tops converge on the magnetic
  // zenith. Shear in arc-uv units: -y sin(beta) / (tan I * arc
  // length); symmetric in |beta|, so one formula serves both
  // hemispheres (the southern curtain is the mirrored mesh).
  const beta = ux.sub(0.5).mul(ARC);
  const uxRay = ux.sub(
    positionWorld.y
      .sub(u.uBase)
      .mul(sin(beta))
      .div(u.uTanI.mul(RADIUS * ARC))
  );
  const w = sin(
    uxRay
      .mul(38.0)
      .add(u.time.mul(0.9))
      .add(sin(uxRay.mul(7.0).add(u.time.mul(0.35))).mul(2.4))
  )
    .mul(0.5)
    .add(0.5);
  const w2 = sin(uxRay.mul(61.0).sub(u.time.mul(0.6)).add(2.1))
    .mul(0.5)
    .add(0.5);
  const a = u.strength.mul(w.mul(w2).add(0.9));
  const col = vec3(...C630)
    .mul(lut.r)
    .add(vec3(...C5577).mul(lut.g))
    .add(vec3(...C4278).mul(lut.b));
  material.colorNode = col.mul(a);
  material.opacityNode = clamp(lut.r.add(lut.g).add(lut.b).mul(a), 0.0, 1.0);
  return {material, u, setE0};
}

// STEVE: the thin mauve subauroral ribbon with its green picket
// fence (steve.js - MacDonald et al. 2018 + Chu et al. 2019,
// both read in full). The mesh is an open cylinder arc like the
// aurora curtain; uv.x runs along the arc (magnetic east-west),
// the local height spans the printed 170-230 km emission slab.
// What the print gives: the 630.0 nm redline share of the colour
// (the same CIE fit the curtain uses), the picket fence in the
// aurora's own certified 557.7 nm green, and the streaming -
// uDrift is the printed 5.5 km/s SAID flow at the observer's
// slant range (steve.js steveDriftRadPerS), so the structures
// visibly stream at the printed angular rate. What stays
// documented display: the continuum share of the mauve (the
// primaries print the spectrum as continuum-bearing "exotic
// emissions" and leave it unexplained - a flat lift toward blue
// makes the printed WORD "mauve" read), and the picket count and
// duty cycle (no printed spacing in hand).
export function createSteveMaterial() {
  const u = {
    amp: uniform(0), // Crumey-gated drive x episode envelope
    time: uniform(0),
    uDrift: uniform(0.02), // rad/s along the arc - printed flow at range
    uPicket: uniform(1)
  };
  const C630 = wavelengthToLinearSRGB(630.0);
  const C5577 = wavelengthToLinearSRGB(557.7);
  // Redline + documented continuum lift = the mauve body.
  const CONT = [0.5, 0.42, 1.15];
  const mauve = C630.map((v, i) => v * 0.85 + CONT[i] * 0.5);
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = DoubleSide;
  material.blending = AdditiveBlending;
  const ARC = Math.PI / 1.3; // must match the theme's mesh
  const ux = uv().x;
  const uy = positionLocal.y.add(0.5); // unit-height cylinder, 0=bottom
  // Streaming coordinate: arc angle minus the printed drift.
  const ph = ux.mul(ARC).add(u.time.mul(u.uDrift));
  // Gentle vertical undulation (the arc's kinks) and large-scale
  // luminosity structure, both riding the printed drift.
  const wob = sin(ph.mul(3.0))
    .mul(0.06)
    .add(sin(ph.mul(7.0).add(1.7)).mul(0.04));
  const yc = uy.sub(0.55).add(wob).div(0.28);
  const band = exp(yc.mul(yc).negate());
  const body = band.mul(sin(ph.mul(2.0).add(0.7)).mul(0.15).add(0.85));
  // The picket fence: short green columns hanging at the ribbon's
  // lower edge, quasi-periodic, grouped, streaming with the flow.
  const yp = uy.sub(0.16).div(0.11);
  const py = exp(yp.mul(yp).negate());
  const pk = smoothstep(
    float(0.6),
    float(0.82),
    sin(ph.mul(88.0)).mul(0.5).add(0.5)
  ).mul(
    smoothstep(
      float(0.3),
      float(0.72),
      sin(ph.mul(13.0).add(2.0)).mul(0.5).add(0.5)
    )
  );
  const fence = py.mul(pk).mul(u.uPicket).mul(1.5);
  const col = vec3(...mauve)
    .mul(body)
    .add(vec3(...C5577).mul(fence));
  material.colorNode = col.mul(u.amp);
  material.opacityNode = clamp(body.add(fence).mul(u.amp), 0.0, 1.0);
  return {material, u};
}

// Nightglow dome (airglow.js): the PALACE line model's three
// visible groups - the [OI] 557.7 nm green line (97 km), the
// ionospheric [OI] red doublet (250 km) and Na D (92 km) - each
// with its own van Rhijn horizon brightening (PALACE Eq. 3; thin
// layers brighten toward the horizon, lower layers more), the
// measured-F10.7 solar scaling folded into uLineI CPU-side
// (PALACE Eq. 1), and the engine's OWN Hillaire zenith
// transmittance raised to the Rozenberg airmass (PALACE Eq. 4/5
// pattern) so extinction eats the ring right at the horizon. The
// per-line structure is exact; AGLOW_GAIN is the one documented
// exposure (same pattern as the aurora curtains).
export function createAirglowMaterial() {
  const u = {
    night: uniform(0),
    // lineStrengths(srf): luminance-weighted, green = 1 at 100 sfu.
    uLineI: uniform(new Vector3(1, 0.221, 0.164)),
    // Hillaire zenith transmittance (sunTransmittanceJS(1, mie)).
    uTzen: uniform(new Vector3(0.94, 0.87, 0.72)),
    // Gravity-wave banding on the GREEN line (gwaves.js - the
    // imaged 557.7 statistics): wave vector (rad/m over the
    // layer's horizontal plane, scene frame), phase (advanced
    // CPU-side at the printed speed) and the printed few-percent
    // amplitude. Zero amp = the dome exactly as before.
    uGwAmp: uniform(0),
    uGwKx: uniform(0),
    uGwKz: uniform(0),
    uGwPh: uniform(0)
  };
  const C = LINES.map((l) => wavelengthToLinearSRGB(l.lam));
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = BackSide;
  material.blending = AdditiveBlending;
  const dirW = normalize(positionWorld.sub(cameraPosition));
  const cosZ = clamp(dirW.y, 0.0, 1.0);
  const s2 = float(1).sub(cosZ.mul(cosZ));
  const vr = (hKm) => {
    const q = R_EARTH / (R_EARTH + hKm * 1e3);
    return float(1).div(sqrt(float(1).sub(s2.mul(q * q))));
  };
  const X = float(1).div(cosZ.add(exp(cosZ.mul(-11)).mul(0.025)));
  const T = pow(vec3(u.uTzen), X);
  // The ray's horizontal position AT the green layer: bands
  // compress toward the horizon by pure perspective (what every
  // all-sky image shows); the 0.05 floor freezes them in the
  // last grazing degrees instead of aliasing (imagers unwarp
  // only to ~60 deg zenith angle themselves - documented guard).
  const hScale = float(LINES[0].hKm * 1000).div(max(dirW.y, 0.05));
  const gw = float(1).add(
    u.uGwAmp.mul(
      sin(
        dirW.x
          .mul(hScale)
          .mul(u.uGwKx)
          .add(dirW.z.mul(hScale).mul(u.uGwKz))
          .sub(u.uGwPh)
      )
    )
  );
  const col = vec3(...C[0])
    .mul(u.uLineI.x.mul(vr(LINES[0].hKm)).mul(gw))
    .add(vec3(...C[1]).mul(u.uLineI.y.mul(vr(LINES[1].hKm))))
    .add(vec3(...C[2]).mul(u.uLineI.z.mul(vr(LINES[2].hKm))))
    .mul(T)
    .mul(AGLOW_GAIN);
  // Additive blend multiplies colour by alpha once - night gates
  // through the opacity alone.
  material.colorNode = col;
  material.opacityNode = u.night;
  return {material, u};
}

// Zodiacal light dome (zodiacal.js): Leinert et al. 1998 Table 17
// resampled onto a regular helioecliptic grid, sampled per pixel
// after an exact equatorial->ecliptic rotation of the CELESTIAL
// object-space direction (the dome rides the star group, so the
// cone tracks the real ecliptic through the night and the
// Gegenschein sits at the antisolar point). The CPU feeds the sun's
// ecliptic longitude, the Masana r^-2.3 heliocentric factor and
// the +-10% symmetry-plane sinusoid (applied above 60 deg latitude,
// eq. 17's own piecewise form); extinction is the shared zenith
// transmittance to the Rozenberg airmass; photometry rides the
// airglow's scale (zlPerGreen) under the SAME documented
// AGLOW_GAIN.
export function createZodiacalMaterial() {
  const u = {
    night: uniform(0),
    uSunLam: uniform(0), // sun geocentric ecliptic longitude (rad)
    uScale: uniform(zlPerGreen()), // x fR(r), CPU-fed per frame
    uFs: uniform(1), // Masana fS sinusoid (|beta| >= 60 deg)
    uTzen: uniform(new Vector3(0.94, 0.87, 0.72))
  };
  const W = 96;
  const H = 48;
  const tex = new DataTexture(
    buildZodiacalGrid(W, H),
    W,
    H,
    RedFormat,
    FloatType
  );
  tex.minFilter = tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  const gridNode = texture(tex);
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = BackSide;
  material.blending = AdditiveBlending;
  // Object space IS the celestial (equatorial) frame; rotate about
  // the equinox axis by the obliquity - the exact TSL mirror of
  // zodiacal.js eclipticOfDir.
  const d = normalize(positionLocal);
  const cE = Math.cos(OBLIQUITY);
  const sE = Math.sin(OBLIQUITY);
  const ex = d.z;
  const ey = d.x.mul(cE).add(d.y.mul(sE));
  const ez = d.y.mul(cE).sub(d.x.mul(sE));
  const lam = atan(ey, ex);
  const beta = asin(clamp(ez, -1, 1));
  // Fold the helioecliptic longitude to [0, pi].
  const dl = abs(
    mod(lam.sub(u.uSunLam).add(Math.PI * 3), Math.PI * 2).sub(Math.PI)
  );
  const val = gridNode.sample(
    vec2(dl.div(Math.PI), abs(beta).div(Math.PI / 2))
  ).r;
  const fs = mix(float(1), u.uFs, step((60 * Math.PI) / 180, abs(beta)));
  const cosZ = clamp(normalize(positionWorld.sub(cameraPosition)).y, 0.0, 1.0);
  const X = float(1).div(cosZ.add(exp(cosZ.mul(-11)).mul(0.025)));
  const T = pow(vec3(u.uTzen), X);
  material.colorNode = T.mul(val.mul(u.uScale).mul(fs).mul(AGLOW_GAIN));
  material.opacityNode = u.night;
  return {material, u};
}

// One meteor streak (meteors.js drives the statistics): a quad laid
// along the great-circle path on the star sphere. uv.x runs
// head-to-tail along the path; `life` sweeps 0..1 moving the bright
// head down the quad with an exponential luminous train behind it
// (the classic visual meteor: a point of light drawing a fading
// line), a lateral Gaussian keeps the streak thin, and `amp`
// carries the drawn magnitude. Additive; gated by the same night
// factor as the stars.
export function createMeteorMaterial() {
  const u = {night: uniform(0), life: uniform(0), amp: uniform(0)};
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = DoubleSide;
  material.blending = AdditiveBlending;
  const x = uv().x;
  const behind = u.life.sub(x);
  const head = exp(behind.mul(-14).abs().mul(-1)); // sharp head
  const train = select(behind.greaterThan(0.0), exp(behind.mul(-6)), float(0));
  const lat = exp(uv().y.sub(0.5).mul(5).pow(2).mul(-1));
  // End-of-life fade (life runs to 1.2 so the train clears).
  const fade = clamp(float(1.2).sub(u.life).mul(3), 0.0, 1.0);
  material.colorNode = vec3(0.85, 0.92, 1.0).mul(
    head.add(train.mul(0.6)).mul(lat).mul(u.amp).mul(fade)
  );
  material.opacityNode = u.night;
  return {material, u};
}

// One contrail (contrails.js decides IF it exists and whether it
// lingers): a quad laid along a cruise-level flight path. uv.x runs
// along the path; `head` (0..1) is the aircraft position, so the
// segment behind it has age (head - x) * cross seconds and fades
// with the e-folding time tau - seconds for a dry-day stub,
// minutes for an ice-supersaturated sky. `spread` widens the old
// trail (dividing the amplitude to conserve the optical mass) the
// way persistent contrails relax into cirrus. Lit by the sun tint,
// gated by `day` (cruise altitude stays sunlit well after ground
// sunset).
export function createContrailMaterial() {
  const u = {
    day: uniform(0),
    head: uniform(0),
    tau: uniform(25),
    cross: uniform(70),
    spread: uniform(0),
    tint: uniform(new Color(1, 1, 1))
  };
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = DoubleSide;
  const x = uv().x;
  const age = max(u.head.sub(x), 0.0).mul(u.cross);
  const laid = smoothstep(u.head.add(0.004), u.head.sub(0.004), x);
  const grow = float(1).add(age.div(u.tau).mul(u.spread).mul(3.0));
  const lat = exp(uv().y.sub(0.5).mul(7).div(grow).pow(2).negate());
  const a = laid
    .mul(exp(age.div(u.tau).negate()))
    .mul(lat)
    .div(grow)
    .mul(u.day);
  material.colorNode = u.tint;
  material.opacityNode = a.mul(0.85);
  return {material, u};
}

// Rainbows at the Descartes angles + the 22-deg halo with sundogs,
// on one additive dome. `cloudShadow` (optional) is the theme's
// cloud shadow hook - the bow's sun leg reads the decks' measured
// optical depth through it (the same map terrain shadows and the
// droplet corona ride).
export function createOpticsMaterial(cloudShadow) {
  const dogData = new Float32Array(256 * 4);
  const dogTex = new DataTexture(dogData, 256, 1, RGBAFormat, FloatType);
  dogTex.minFilter = dogTex.magFilter = LinearFilter;
  dogTex.needsUpdate = true;
  const circleData = new Float32Array(256 * 4);
  const circleTex = new DataTexture(circleData, 256, 1, RGBAFormat, FloatType);
  circleTex.minFilter = circleTex.magFilter = LinearFilter;
  circleTex.needsUpdate = true;
  const pillarData = new Float32Array(64 * 4);
  const pillarTex = new DataTexture(pillarData, 64, 1, RGBAFormat, FloatType);
  pillarTex.minFilter = pillarTex.magFilter = LinearFilter;
  pillarTex.needsUpdate = true;
  const czaData = new Float32Array(128 * 4);
  const czaTex = new DataTexture(czaData, 128, 1, RGBAFormat, FloatType);
  czaTex.minFilter = czaTex.magFilter = LinearFilter;
  czaTex.needsUpdate = true;
  const chaData = new Float32Array(128 * 4);
  const chaTex = new DataTexture(chaData, 128, 1, RGBAFormat, FloatType);
  chaTex.minFilter = chaTex.magFilter = LinearFilter;
  chaTex.needsUpdate = true;
  const u = {
    sunDir: uniform(new Vector3(0, 1, 0)),
    antisolar: uniform(new Vector3(0, -1, 0)),
    // The Purkinje fold blend (adaptation.js scotopicY mirrored
    // in TSL): 1 = photopic, 0 = pure rod vision - the summed
    // optics families lerp toward their own Eq. 13 rod luminance
    // (Rec.709 -> XYZ exact, /2.31 closed point). The theme
    // feeds the printed mesopic ramp's blend; a moonlit-night
    // halo ring greys like everything else the rods see.
    scotB: uniform(1),
    // The RADIOMETRIC bow amplitude (per channel): the theme feeds
    // E_src x T_air x e^-tau_veil x exposure; the rain shaft's own
    // slab factor is assembled PER FRAGMENT below from bowSigH /
    // bowSinH (the two-leg single-scatter integral in closed
    // form), and the LUT it multiplies is ABSOLUTE (sr^-1 per
    // unit geometric-interaction depth, energy-normalised against
    // the Descartes/Fresnel ray mapping - optics-lut). The old
    // 0.55 display gain and the 1 - cloudy x 1.1 daylight
    // heuristic are retired; deck shadowing of the shaft is the
    // measured cloud shadow map through chiSun.
    bowAmp: uniform(new Color(0, 0, 0)),
    // sigma_ext x H: Marshall-Palmer extinction of the measured
    // rain rate times the measured rain-column depth (freezing
    // level above the camera; rainbow.js mpSigmaExt).
    bowSigH: uniform(0),
    // sin(source altitude) - the sun leg's slant through the
    // shaft.
    bowSinH: uniform(0.5),
    // The RADIOMETRIC halo amplitude (per channel): the theme
    // feeds E_src x (tau/2) e^-tau x SCF x T_air x exposure - the
    // corona's slab radiometry on the measured cirrus column with
    // Forster & Mayer 2022's smooth-crystal fraction - and the
    // LUT it multiplies is ABSOLUTE (sr^-1, optics-lut). The old
    // 0.18 display gain and its cover heuristics are retired.
    haloAmp: uniform(new Color(0, 0, 0)),
    // The RADIOMETRIC dog amplitude (per channel): the theme
    // feeds E_src x T_air x slab x PLATE_ALPHA (Breon & Dubrulle
    // 2004's measured oriented-plate fraction) x the Monte
    // Carlo's parhelionShare(h) x the vertical Gaussian's peak
    // density. The azimuth LUT it multiplies integrates to 1 per
    // channel, so the drawn dog is sr^-1 in the same frame as
    // the ring - the old calibrated dogK ratio is retired.
    dogAmp: uniform(new Color(0, 0, 0)),
    // The tilt wobble's drawn sigma (radians): the plate MC's
    // sigmaAlt at the current source altitude, fed with the LUT.
    dogSigma: uniform(0.006),
    // The PARHELIC CIRCLE: the same measured plates' EXTERNAL
    // reflection off their vertical faces - white by physics,
    // zero toward the sun (the dogs' territory), riding the same
    // PLATE_ALPHA x slab x occurrence chain (halos.js
    // parhelicCircleProfile, MC-held). circleAmp carries E_src x
    // T_air x slab x alpha x the vertical Gaussian's peak
    // density; the LUT is absolute per unit plate interaction.
    circleAmp: uniform(new Color(0, 0, 0)),
    circleSigma: uniform(0.0147),
    // The SUN PILLAR / subsun: the same plates' BASAL faces as
    // external mirrors - the horizontal mirror images the source
    // at altitude -srcAlt, smeared vertically by the tilt through
    // the mirror (sigma sqrt(2) Theta, halos.js pillarShare /
    // PILLAR_SIGMA_ALT, MC-held) and ONE SOURCE-DISC WIDE in
    // azimuth (the grazing mirror is blind to the sideways tilt;
    // optics-lut buildPillarLUT carries the limb-darkened
    // marginal). pillarAmp carries E_src x T_air x slab x
    // PLATE_ALPHA x pillarShare(h) x the vertical Gaussian's peak
    // density; the azimuth LUT integrates to 1 per radian, so the
    // drawn column is sr^-1 in the ring's frame. Below-horizon
    // fragments gate off: the deck lives ABOVE the eye, so no
    // crystals sit along a downward ray (the aircraft subsun
    // waits on a camera-above-deck geometry).
    pillarAmp: uniform(new Color(0, 0, 0)),
    pillarSigma: uniform(0.0248),
    pillarAzMax: uniform(0.0155),
    // The 90-degree-wedge ARCS of the same plates (halos.js
    // czaAltitude/chaAltitude, arcAzProfile - the tangential
    // Bravais fold): each arc is a per-channel-ALTITUDE band -
    // the dispersion is pure vertical, so the altitude centre is
    // a vec3 (the closed forms per ice index; the CZA holds red
    // low toward the sun, the CHA red high toward the sun) under
    // one MC tilt sigma, with the azimuth LUT normalised per
    // radian and the amp carrying E_src x T_air x slab x
    // PLATE_ALPHA x the MC share table x the vertical peak.
    // Channels leave the windows one by one (the share table and
    // the LUT rows both empty per channel) - the arcs are born
    // and die colour by colour.
    czaAmp: uniform(new Color(0, 0, 0)),
    czaAlt: uniform(new Vector3(1, 1, 1)),
    czaSigma: uniform(0.008),
    chaAmp: uniform(new Color(0, 0, 0)),
    chaAlt: uniform(new Vector3(0.3, 0.3, 0.3)),
    chaSigma: uniform(0.008),
    // Bravais parhelia (optics-lut buildDogLUT): azimuth-offset
    // LUT re-laid by the theme as the source climbs; srcAlt +
    // the plates' documented ~1.5-degree wobble envelope place
    // it vertically.
    srcAlt: uniform(0),
    dogA0: uniform((18 * Math.PI) / 180),
    dogA1: uniform((55 * Math.PI) / 180),
    dogTex,
    dogData,
    circleTex,
    circleData,
    pillarTex,
    pillarData,
    czaTex,
    czaData,
    chaTex,
    chaData
  };
  const material = new NodeMaterial();
  material.side = BackSide;
  material.transparent = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;

  // Physical radiance profiles (optics-lut.js, double precision at
  // init, reference-checked by optics-reference.mjs): the 22-deg
  // halo is the minimum-deviation caustic of the randomly rotating
  // 60-deg ice prism with Warren dispersion and Fresnel
  // transmittances; the bow LUT carries primary AND secondary from
  // the Descartes deviation with the Fresnel chain - their
  // brightness ratio and Alexander's dark band between them emerge
  // from the physics (the band histograms to exactly zero). Both
  // convolved with the limb-darkened sun disc. All THREE optics
  // are now absolute: the halo LUT in sr^-1 per unit
  // geometric-interaction depth (the MC's own flux accounting,
  // basal areas corrected by the sundog pass's audit), the bow
  // energy-normalised against the Descartes/Fresnel mapping, and
  // the dogs riding the plate MC's own share table with Breon &
  // Dubrulle's measured oriented-plate fraction - no display
  // gain remains on this dome.
  const mkLutTex = (lut) => {
    const t = new DataTexture(lut.data, lut.bins, 1, RGBAFormat, FloatType);
    t.minFilter = t.magFilter = LinearFilter;
    t.needsUpdate = true;
    return t;
  };
  const haloLut = buildHaloLUT();
  const bowLut = buildBowLUT();
  const bowTex = mkLutTex(bowLut);
  u.bowTex = bowTex; // theme re-lays it from the measured rain
  const haloTexN = texture(mkLutTex(haloLut));
  const bowTexN = texture(bowTex);

  const DEG = 57.29577951308232;
  const v = normalize(positionLocal);
  const aA = acos(clamp(dot(v, u.antisolar), -1.0, 1.0)).mul(DEG);
  const aS = acos(clamp(dot(v, u.sunDir), -1.0, 1.0)).mul(DEG);
  // Range masks: texture sampling clamps to the edge texel, so
  // without them the halo and bow terms would paint their LAST
  // BIN'S value across the whole dome outside their angular
  // windows - a uniform wash the bright sky hides but a dark
  // capture shows (found by the visual-verification instrument;
  // the dog window below gets the same mask). The edges FEATHER
  // over one LUT bin - the instrument's own resolution, no new
  // constant: the 77th pass's x4-amplified fogbow capture showed
  // the hard step at the window edge (invisible at 1x, recorded
  // as a shelf item); a bin-wide smoothstep states the
  // truncation smoothly.
  const bowFea = (bowLut.thMaxDeg - bowLut.thMinDeg) / bowLut.bins;
  const bowIn = smoothstep(bowLut.thMinDeg, bowLut.thMinDeg + bowFea, aA).mul(
    smoothstep(bowLut.thMaxDeg - bowFea, bowLut.thMaxDeg, aA).oneMinus()
  );
  const haloFea = (haloLut.thMaxDeg - haloLut.thMinDeg) / haloLut.bins;
  const haloIn = smoothstep(
    haloLut.thMinDeg,
    haloLut.thMinDeg + haloFea,
    aS
  ).mul(
    smoothstep(haloLut.thMaxDeg - haloFea, haloLut.thMaxDeg, aS).oneMinus()
  );
  const bowSample = bowTexN
    .sample(
      vec2(aA.sub(bowLut.thMinDeg).div(bowLut.thMaxDeg - bowLut.thMinDeg), 0.5)
    )
    .rgb.mul(bowIn);
  const haloSample = haloTexN
    .sample(
      vec2(
        aS.sub(haloLut.thMinDeg).div(haloLut.thMaxDeg - haloLut.thMinDeg),
        0.5
      )
    )
    .rgb.mul(haloIn);
  // The rain shaft's slab factor, per fragment: the two-leg
  // single-scatter integral through a homogeneous Marshall-Palmer
  // layer from the eye up to the measured freezing level, in
  // closed form. Eye at the layer base, drop at range s along a
  // ray of elevation alpha: view leg e^-sigma s, sun leg
  // e^-sigma (H - s sin alpha)/sin h; both exponents linear in s,
  // so with kc = 1 - sin(alpha)/sin(h) and the geometric-share
  // dtau_g = (sigma/2) ds,
  //   slab = (1/2) (e^-tau0 - e^-tauV) / kc,
  // tau0 = sigma H / sin h (the sun leg from the layer base),
  // tauV = sigma H / sin(alpha) (the view leg to the layer top -
  // the identity tau0 + sigma smax kc = tauV keeps both exponents
  // non-negative, no overflow at any angle pair). Upward rays exit
  // through the layer top; grazing/downward rays run the
  // untruncated tail (kc > 0 there, tauV -> huge, the e^-tauV
  // term vanishes; terrain z-buffers the dome wherever the ground
  // would truncate it). kc -> 0 (the fragment at the source's own
  // altitude) is removable: slab -> (1/2) e^-tau0 tauV. Zero rain
  // or the camera above the freezing level zero bowSigH - no
  // shaft, no bow.
  const sinA = v.y;
  const kc = float(1).sub(sinA.div(max(u.bowSinH, 1e-3)));
  const tau0 = u.bowSigH.div(max(u.bowSinH, 1e-3));
  const tauV = u.bowSigH.div(clamp(sinA, 1e-4, 1));
  const bowSlab = select(
    abs(kc).lessThan(1e-4),
    exp(tau0.negate()).mul(tauV),
    exp(tau0.negate()).sub(exp(tauV.negate())).div(kc)
  ).mul(0.5);
  // Deck shadowing of the shaft along the SUN leg: the measured
  // cloud shadow map (one deck-column definition with terrain
  // shadows and the droplet corona). The unattached map reads
  // tau 0 - full sun.
  const chiSun = cloudShadow
    ? exp(cloudShadow.tauSlant(cameraPosition, u.sunDir).negate())
    : float(1);
  const cBow = bowSample.mul(u.bowAmp).mul(bowSlab).mul(chiSun);
  // Parhelia: the Bravais azimuth-offset LUT along the source's
  // almucantar (dogs ON the halo at the horizon, migrating
  // outward at the Bravais azimuth, dead past the cutoff - the
  // LUT empties itself), spread vertically by the MEASURED tilt
  // wobble: the Gaussian whose sigma the plate Monte Carlo maps
  // from Breon & Dubrulle's printed ~1-degree tilt distribution
  // through the actual refraction (dogSigma, fed with the LUT).
  // The azimuth LUT integrates to 1 per channel and dogAmp
  // carries E_src x T_air x slab x PLATE_ALPHA x share(h) x the
  // Gaussian's peak density - the old 0.6/0.18 calibrated ratio
  // (dogK) is retired: the dog:ring ratio now follows from the
  // plates' measured fraction and the two Monte Carlos' own
  // absolute books.
  const hd = max(sqrt(float(1.0).sub(v.y.mul(v.y))), 1e-4);
  const hs = max(sqrt(float(1.0).sub(u.sunDir.y.mul(u.sunDir.y))), 1e-4);
  const cosAz = clamp(
    v.x.mul(u.sunDir.x).add(v.z.mul(u.sunDir.z)).div(hd.mul(hs)),
    -1.0,
    1.0
  );
  const azOff = acos(cosAz);
  const dAlt = asin(clamp(v.y, -1.0, 1.0))
    .sub(u.srcAlt)
    .div(max(u.dogSigma, 1e-4));
  const dogIn = step(u.dogA0, azOff).mul(step(azOff, u.dogA1));
  const dogSample = texture(u.dogTex)
    .sample(
      vec2(clamp(azOff.sub(u.dogA0).div(u.dogA1.sub(u.dogA0)), 0.0, 1.0), 0.5)
    )
    .rgb.mul(dogIn);
  const cDogs = dogSample.mul(exp(dAlt.mul(dAlt).mul(-0.5))).mul(u.dogAmp);
  // The parhelic circle rides the SAME almucantar coordinates:
  // azOff spans the full [0, pi] the LUT covers, the vertical
  // Gaussian uses the reflected family's own sigma.
  const dAltC = asin(clamp(v.y, -1.0, 1.0))
    .sub(u.srcAlt)
    .div(max(u.circleSigma, 1e-4));
  const circleSample = texture(u.circleTex).sample(
    vec2(azOff.div(Math.PI).clamp(0.0, 1.0), 0.5)
  ).rgb;
  const cCircle = circleSample
    .mul(exp(dAltC.mul(dAltC).mul(-0.5)))
    .mul(u.circleAmp);
  // The pillar: the basal mirror's image at MINUS the source
  // altitude, the tilt Gaussian vertical, the disc-marginal LUT
  // azimuthal (sampled at |azOff| - the profile is even), gated
  // to the sky above the horizon.
  const dAltP = asin(clamp(v.y, -1.0, 1.0))
    .add(u.srcAlt)
    .div(max(u.pillarSigma, 1e-4));
  const pillarSample = texture(u.pillarTex).sample(
    vec2(azOff.div(max(u.pillarAzMax, 1e-4)).clamp(0.0, 1.0), 0.5)
  ).rgb;
  const cPillar = pillarSample
    .mul(exp(dAltP.mul(dAltP).mul(-0.5)))
    .mul(step(0.0, v.y))
    .mul(u.pillarAmp);
  // The wedge arcs: per-channel altitude bands (the closed-form
  // dispersion is vertical) at the azimuth-LUT brightness.
  const altV = asin(clamp(v.y, -1.0, 1.0));
  const dCz = vec3(
    altV.sub(u.czaAlt.x),
    altV.sub(u.czaAlt.y),
    altV.sub(u.czaAlt.z)
  ).div(max(u.czaSigma, 1e-4));
  const czaSample = texture(u.czaTex).sample(
    vec2(azOff.div(Math.PI).clamp(0.0, 1.0), 0.5)
  ).rgb;
  const cCza = czaSample.mul(exp(dCz.mul(dCz).mul(-0.5))).mul(u.czaAmp);
  const dCh = vec3(
    altV.sub(u.chaAlt.x),
    altV.sub(u.chaAlt.y),
    altV.sub(u.chaAlt.z)
  ).div(max(u.chaSigma, 1e-4));
  const chaSample = texture(u.chaTex).sample(
    vec2(azOff.div(Math.PI).clamp(0.0, 1.0), 0.5)
  ).rgb;
  const cCha = chaSample.mul(exp(dCh.mul(dCh).mul(-0.5))).mul(u.chaAmp);
  const cHalo = haloSample.mul(u.haloAmp);
  const cSum = cBow
    .add(cHalo)
    .add(cDogs)
    .add(cCircle)
    .add(cPillar)
    .add(cCza)
    .add(cCha)
    .toVar();
  // Rod vision (see u.scotB): X guarded like the JS scotopicY;
  // (Y+Z)/X >= 0.562 for any non-negative RGB, so the bracket
  // never goes negative.
  const Xc = cSum.x.mul(0.4124).add(cSum.y.mul(0.3576)).add(cSum.z.mul(0.1805));
  const Yc = cSum.x.mul(0.2126).add(cSum.y.mul(0.7152)).add(cSum.z.mul(0.0722));
  const Zc = cSum.x.mul(0.0193).add(cSum.y.mul(0.1192)).add(cSum.z.mul(0.9505));
  const Ys = Yc.mul(
    Yc.add(Zc).div(max(Xc, 1e-12)).add(1.0).mul(1.33).sub(1.68)
  ).div(2.31);
  material.colorNode = mix(vec3(Ys), cSum, u.scotB);
  material.opacityNode = 1.0;
  return {material, u};
}

// Shared machinery for the two point-sprite systems: an InstancedMesh
// of unit planes, SpriteNodeMaterial billboarding, and a scale node
// reproducing gl_PointSize (pixels at the projected centre).
function makeSprites({positions, colors, sizes, mags, opacityFor}) {
  const count = sizes.length;
  const geo = new PlaneGeometry(1, 1);
  const posAttr = new InstancedBufferAttribute(positions, 3);
  const colAttr = new InstancedBufferAttribute(colors, 3);
  const sizeAttr = new InstancedBufferAttribute(sizes, 1);
  // Per-sprite V magnitude, for the Schaefer visibility threshold
  // (adaptation.js limitingMagnitude). Callers that do not pass
  // mags get sprites that ignore the threshold (mag -99).
  const magAttr = new InstancedBufferAttribute(
    mags || new Float32Array(count).fill(-99),
    1
  );
  const material = new SpriteNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  const center = instancedBufferAttribute(posAttr);
  const colorA = instancedBufferAttribute(colAttr);
  const sizeA = instancedBufferAttribute(sizeAttr);
  const magA = instancedBufferAttribute(magAttr);
  material.positionNode = center;
  // gl_PointSize is pixels at the centre's projected depth: a quad of
  // world height sizePx * 2*viewZ / (screenH * P[1][1]) rasterizes to
  // the same sizePx pixels.
  const viewZ = modelViewMatrix.mul(vec4(center, 1.0)).z.negate();
  const p11 = cameraProjectionMatrix.element(1).element(1);
  const {sizeNode, opacityNode, colorNode} = opacityFor(
    center,
    sizeA,
    colorA,
    magA
  );
  material.scaleNode = sizeNode.mul(2.0).mul(viewZ).div(screenSize.y.mul(p11));
  // gl_PointCoord's radial mask on the quad's own uv
  const d = length(uv().sub(0.5));
  material.colorNode = colorNode ?? colorA;
  material.opacityNode = opacityNode.mul(smoothstep(0.2, 0.5, d).oneMinus());
  const mesh = new InstancedMesh(geo, material, count);
  mesh.frustumCulled = false;
  return {mesh, posAttr, sizeAttr, magAttr};
}

// PCG hash (Jarzynski & Olano 2020, "Hash Functions for GPU
// Rendering"): integer arithmetic is bit-exact across shader
// compilers, where the classic fract(sin(dot)) hash decorrelates at
// fp32 (a 1-ULP sin difference times 43758 fully rerolls the value).
// A JS-side node builder, NOT Fn(): Fn parameters default to float,
// which silently turns the integer ops into float math.
const pcg = (v) => {
  const s = v.mul(uint(747796405)).add(uint(2891336453)).toVar();
  const w = s
    .shiftRight(s.shiftRight(uint(28)).add(uint(4)))
    .bitXor(s)
    .mul(uint(277803737))
    .toVar();
  return w.shiftRight(uint(22)).bitXor(w);
};

// Yale stars with PHYSICAL scintillation (scintillation.js +
// cn2.js): Young (1967)'s sigma for the naked eye grows as
// airmass^(7/4) (0.255 at zenith - stars visibly twinkle even
// overhead - to the log-normal clamp near the horizon), MODULATED
// by the measured winds aloft: sigZen is Young's value times the
// Hufnagel-Valley sigmaScale of the ITU-R RMS 5-20 km wind (a calm
// upper atmosphere really does steady the stars; a screaming jet
// really does churn them). The intensity is the mean-conserving
// log-normal exp(sigma s)/I0(sigma) (Dravins' statistics; the
// Bessel normaliser makes the time-average of every star EXACTLY
// its catalogue brightness), and the flicker rate rides the
// Fresnel-shadow crossing rate of the measured profile (cn2.js
// shadowRate; documented display division of a ~500 Hz process).
// The size stays fixed: scintillation is an intensity phenomenon;
// image wander is sub-sprite at this scale.
export function createStarSprites(positions, colors, sizes, mags) {
  const u = {
    night: uniform(0),
    time: uniform(0),
    twRate: uniform(9),
    sigZen: uniform(youngSigma(EYE_D_CM, 1)),
    // Schaefer's naked-eye limiting magnitude at the current sky
    // (adaptation.js limitingMagnitude, fed per frame): each star
    // fades in over the PRINTED +-0.5 mag detection width
    // (Blackwell's 10-50-90% steps) around its own catalogue
    // magnitude - the stars appear in magnitude order at dusk,
    // Sirius first and the 6.5 tail last, and a light-polluted
    // or moonlit sky keeps its faint tail dark by the same law.
    limMag: uniform(99),
    // The point-source colour floor (Schaefer 1993 Sec. 2.12,
    // via adaptation.js COLOR_LIMIT: 1500 nL, corroborating the
    // Ferwerda mesopic edge to 15% - gated): below the mesopic
    // range the catalogue tints fold to their own rod luminance
    // - the same Eq. 13 mirror as the dome and the optics. The
    // theme feeds the shared mesopic blend. Stated residual:
    // the printed floor is a field statement - the few
    // brightest stars' colour survival needs a per-source
    // image-brightness limit no source here prints, so the fold
    // is uniform (and planets keep their tints - their discs
    // sit brighter than any star).
    scotB: uniform(1)
  };
  const {mesh, sizeAttr, magAttr} = makeSprites({
    positions,
    colors,
    sizes,
    mags,
    opacityFor: (center, sizeA, colorA, magA) => {
      const altRaw = normalize(modelWorldMatrix.mul(vec4(center, 1.0)).xyz).y;
      const alt = max(altRaw, 0.04);
      const am = float(1.0).div(alt);
      // The sky ends at the horizon: the celestial sphere (r ~900)
      // reaches far beyond the drawn sea/terrain box, so a
      // below-horizon star would otherwise peek past the world's
      // far edge (caught in the Aug 8 visual review). A short fade
      // through the horizon replaces geometry that is not there.
      const aboveHor = smoothstep(float(-0.02), float(0.005), altRaw);
      // Per-star phase in [0, 2pi) from the position bit patterns.
      // vertexStage() is load-bearing: left to the fragment stage,
      // the attribute arrives through an INTERPOLATED varying and
      // the ULP-level interpolation noise rerolls the hash.
      const ph = vertexStage(
        pcg(
          bitcast(center.x, 'uint').bitXor(
            bitcast(center.y, 'uint').mul(uint(2654435769))
          )
        )
          .toFloat()
          .mul(1.46291807e-9)
      );
      const sigma = clamp(pow(am, 1.75).mul(u.sigZen), 0.0, SIGMA_MAX);
      const s = sin(u.time.mul(u.twRate).add(ph));
      // 5-term I0(sigma) - the exact normaliser of E[exp(sigma sin)]
      // (see scintillation.js; rel err < 1e-6 on the clamped range).
      const q = sigma.mul(sigma).mul(0.25);
      const q2 = q.mul(q);
      const i0 = float(1)
        .add(q)
        .add(q2.mul(0.25))
        .add(q2.mul(q).mul(1 / 36))
        .add(q2.mul(q2).mul(1 / 576));
      const I = exp(sigma.mul(s)).div(i0);
      const Xc = colorA.x
        .mul(0.4124)
        .add(colorA.y.mul(0.3576))
        .add(colorA.z.mul(0.1805));
      const Yc = colorA.x
        .mul(0.2126)
        .add(colorA.y.mul(0.7152))
        .add(colorA.z.mul(0.0722));
      const Zc = colorA.x
        .mul(0.0193)
        .add(colorA.y.mul(0.1192))
        .add(colorA.z.mul(0.9505));
      const Ys = Yc.mul(
        Yc.add(Zc).div(max(Xc, 1e-12)).add(1.0).mul(1.33).sub(1.68)
      ).div(2.31);
      // The Schaefer visibility gate: the printed +-0.5 mag
      // Blackwell detection ramp around the current limiting
      // magnitude (0 at limMag - 0.5 below the star, 1 at +0.5).
      const vis = smoothstep(float(-0.5), float(0.5), u.limMag.sub(magA));
      return {
        sizeNode: sizeA,
        opacityNode: u.night.mul(I).mul(vis).mul(aboveHor),
        colorNode: mix(vec3(Ys), colorA, u.scotB)
      };
    }
  });
  // sizeAttr/magAttr exposed so the variable stars (varstars.js
  // printed GCVS elements) can re-write their live magnitudes.
  return {mesh, u, sizeAttr, magAttr};
}

// Naked-eye planets: fixed pixel size, night-gated discs at their
// live ephemeris positions (write posAttr + needsUpdate at 1 Hz).
export function createPlanetSprites(positions, colors, sizes, mags) {
  // limMag: the same Schaefer threshold the stars ride - Venus
  // (mag -4.6) clears the daytime/twilight limit long before any
  // star, Mercury near +0.2 waits for real darkness, exactly the
  // sky's own order. Callers write magAttr per frame beside the
  // ephemeris positions.
  const u = {night: uniform(0), limMag: uniform(99)};
  const {mesh, posAttr, sizeAttr, magAttr} = makeSprites({
    positions,
    colors,
    sizes,
    mags,
    opacityFor: (center, sizeA, colorA, magA) => ({
      sizeNode: sizeA,
      // The same horizon fade as the stars: the sprite shell
      // reaches past the drawn world's far edge, so a set planet
      // must fade at the horizon rather than rely on geometry.
      opacityNode: u.night
        .mul(smoothstep(float(-0.5), float(0.5), u.limMag.sub(magA)))
        .mul(
          smoothstep(
            float(-0.02),
            float(0.005),
            normalize(modelWorldMatrix.mul(vec4(center, 1.0)).xyz).y
          )
        )
    })
  });
  return {mesh, u, posAttr, sizeAttr, magAttr};
}

// Precipitation particles: the classic PointsMaterial with a soft
// radial map, as instanced billboards. A size-attenuated point of
// size S covers S*0.5*screenH/viewZ pixels; a view-plane quad of
// world scale S/P[1][1] projects identically, so the two match
// exactly at every depth.
export function createPrecipSprites(positions, dotTex, encodeFog) {
  const u = {
    color: uniform(new Color('#bcd2e8')),
    size: uniform(0.22),
    opacity: uniform(0)
  };
  const count = positions.length / 3;
  const posAttr = new InstancedBufferAttribute(positions, 3);
  const material = new SpriteNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  const center = instancedBufferAttribute(posAttr);
  material.positionNode = center;
  const p11 = cameraProjectionMatrix.element(1).element(1);
  material.scaleNode = u.size.div(p11);
  const texel = texture(dotTex);
  const base = u.color.mul(texel.rgb);
  // the caller passes the shared AgX+sRGB+fog colour hook - as a
  // colorNode transform, because the sprite pipeline does not compose
  // opacityNode into `output` for outputNode hooks
  material.colorNode = encodeFog ? encodeFog(base) : base;
  material.opacityNode = u.opacity.mul(texel.a);
  const mesh = new InstancedMesh(new PlaneGeometry(1, 1), material, count);
  mesh.frustumCulled = false;
  return {mesh, u, posAttr};
}

// One lightning flash (lightning.js decides the stroke sequence
// and the apparent brightness): a soft radial glow quad hung at
// the strike's azimuth behind/inside the cloud base. uv-radial
// falloff; `amp` carries the instantaneous Rakov-Uman flash
// amplitude times the Koschmieder/inverse-square viewing factor -
// the flicker rhythm IS the physics, this node only shapes the
// glow. Cool-white channel tint (~30000 K).
export function createFlashMaterial() {
  const u = {amp: uniform(0)};
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = DoubleSide;
  material.blending = AdditiveBlending;
  const r2 = uv().sub(0.5).length().mul(2).clamp(0, 1).pow(2);
  const glow = exp(r2.mul(-4));
  material.colorNode = vec3(0.82, 0.87, 1.0).mul(glow.mul(u.amp));
  material.opacityNode = float(1);
  return {material, u};
}

// One red sprite (sprites.js owns the physics): a quad whose v
// axis IS emission altitude, mapped by the caller across the
// printed 40-90 km span (Chen 2008) at the strike's elevation.
// Column strips + the 75-85 km halo band are the documented
// display shapes; the COLOUR at every altitude is the printed
// quenching physics - N2(1P) red survival crossing 1/2 at 50 km,
// the blue system at 32 km (Pasko 1997 coefficients via
// Barrington-Leigh 2000), the same logistic-in-altitude the
// reference gate pins. `amp` carries the Crumey-gated luminance
// factor times the flash envelope.
export function createRedSpriteMaterial() {
  const u = {
    amp: uniform(0),
    // four column centres across the quad (set from the spawn's
    // uniform stream - deterministic under the pin harness)
    cols: uniform(new Vector3(0.3, 0.52, 0.7)),
    col4: uniform(0.42),
    colW: uniform(0.045)
  };
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = DoubleSide;
  material.blending = AdditiveBlending;
  const H = quenchScaleHeightKm();
  const CR = wavelengthToLinearSRGB(SPRITE_LAM_RED);
  const CB = wavelengthToLinearSRGB(SPRITE_LAM_BLUE);
  const x = uv().x;
  const z = uv()
    .y.mul(SPRITE_TOP_KM - SPRITE_BOT_KM)
    .add(SPRITE_BOT_KM);
  const qR = float(1).div(float(1).add(exp(float(QUENCH_1P_KM).sub(z).div(H))));
  const qB = float(BLUE_EXC_W).div(
    float(1).add(exp(float(QUENCH_2P_KM).sub(z).div(H)))
  );
  const strip = (c) => exp(x.sub(c).div(u.colW).pow(2).negate());
  const cols = strip(u.cols.x)
    .add(strip(u.cols.y))
    .add(strip(u.cols.z))
    .add(strip(u.col4));
  // columns live 55-85 km with tendrils fading to the printed
  // 40 km floor; the halo is the featureless 75-85 km disk
  const colEnv = smoothstep(float(SPRITE_BOT_KM), float(56), z).mul(
    float(1).sub(smoothstep(float(83), float(SPRITE_TOP_KM), z))
  );
  const halo = exp(z.sub(80).div(4).pow(2).negate()).mul(
    exp(x.sub(0.5).mul(3.5).pow(2).negate()).mul(0.15)
  );
  const shape = cols.mul(colEnv).add(halo);
  const colr = vec3(CR[0], CR[1], CR[2])
    .mul(qR)
    .add(vec3(CB[0], CB[1], CB[2]).mul(qB));
  material.colorNode = colr.mul(shape).mul(u.amp);
  material.opacityNode = float(1);
  return {material, u};
}

// The rod-luminance of an RGB node - the SAME Purkinje fold the
// star sprites carry inline (sRGB->XYZ, then the gated scotopic
// luminance estimator; adaptation.js holds the law): billboards
// mix toward this with their scotB uniform.
const rodY = (c) => {
  const Xc = c.x.mul(0.4124).add(c.y.mul(0.3576)).add(c.z.mul(0.1805));
  const Yc = c.x.mul(0.2126).add(c.y.mul(0.7152)).add(c.z.mul(0.0722));
  const Zc = c.x.mul(0.0193).add(c.y.mul(0.1192)).add(c.z.mul(0.9505));
  return Yc.mul(
    Yc.add(Zc).div(max(Xc, 1e-12)).add(1.0).mul(1.33).sub(1.68)
  ).div(2.31);
};

// Light pillar quad (lightpillars.js law): the diamond-dust
// image column over a city lamp - flat body (every height inside
// the layer mirrors somewhere along the sightline), the top
// softened over the tilt fold's share of the column (uSoft,
// computed CPU-side from the gated pillarProfile law - this
// node graph is its renderer twin), a thin horizontal Gaussian
// at the booked tilt width, the lamp's own warm tint.
export function createLightPillarMaterial() {
  const u = {
    amp: uniform(0),
    uSoft: uniform(0.15),
    uCol: uniform(new Vector3(1, 0.82, 0.55))
  };
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = DoubleSide;
  material.blending = AdditiveBlending;
  const v = uv().y;
  const x = uv().x.sub(0.5).mul(2.0);
  const body = clamp(v.div(0.06), 0.0, 1.0);
  const te = max(v.sub(float(1.0).sub(u.uSoft)).div(u.uSoft), 0.0);
  const top = exp(te.mul(te).mul(-3.0));
  const across = exp(x.mul(x).mul(-2.2));
  const a = body.mul(top).mul(across).mul(u.amp);
  material.colorNode = u.uCol.mul(a);
  material.opacityNode = clamp(a, 0.0, 1.0);
  return {material, u};
}

// Volcanic plume quad (gvp.js occurrence + printed height): an
// alpha-blended ash column between the volcano's summit and the
// observatory's reported plume top. The column widens toward
// the top (uWiden) and the top drifts downwind (uBend, from the
// scene's own measured wind direction) - both DOCUMENTED display
// shapes; the two load-bearing numbers (that a plume exists, and
// how high it reaches) are the weekly report's own. uDay is the
// stated display shading (ash grey under the current daylight).
export function createPlumeMaterial() {
  const u = {
    amp: uniform(0),
    uBend: uniform(0),
    uWiden: uniform(2.5),
    uCol: uniform(new Vector3(0.36, 0.33, 0.3)),
    uDay: uniform(1),
    // Twilight plumes grey with the rods like everything else.
    scotB: uniform(1)
  };
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = DoubleSide;
  const v = uv().y;
  const xc = uv().x.sub(0.5).sub(u.uBend.mul(v).mul(0.35));
  const w = mix(float(1).div(u.uWiden), float(1), v).mul(0.5);
  const body = smoothstep(w, w.mul(0.55), abs(xc));
  const top = float(1).sub(smoothstep(float(0.9), float(1.0), v));
  const base = smoothstep(float(0.0), float(0.04), v);
  const a = body.mul(top).mul(base).mul(u.amp);
  const lit = u.uCol.mul(u.uDay);
  material.colorNode = mix(vec3(rodY(lit)), lit, u.scotB);
  material.opacityNode = clamp(a, 0.0, 1.0);
  return {material, u};
}

// Lenticular (mountain-wave) cloud lens - the lee-wave pass.
// leewave.js places and sizes every lens (crest ladder, chord,
// thickness: Stull's printed machinery on the measured column
// over the real ridge); the SHADING is traced per frame: litV =
// the reddened beam at the lens's own altitude times the gated
// overcast two-stream albedo, plus the deck's own ambient; amp
// carries the two-stream's 1 - e^-tau (opaque at stratiform tau).
// The smooth almond envelope is the family's documented display
// shape (the PSC/plume precedent), and the lenses grey with the
// rods like every billboard in the mesopic fold.
export function createLenticularMaterial() {
  const u = {
    amp: uniform(0),
    litV: uniform(new Vector3(0.5, 0.5, 0.5)),
    scotB: uniform(1)
  };
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = DoubleSide;
  const lx = uv().x.sub(0.5).mul(2);
  const ly = uv().y.sub(0.5).mul(2);
  const rr = lx.mul(lx).add(ly.mul(ly));
  const a = smoothstep(float(1), float(0.55), rr).mul(u.amp);
  material.colorNode = mix(vec3(rodY(u.litV)), u.litV, u.scotB);
  material.opacityNode = clamp(a, 0.0, 1.0);
  return {material, u};
}

// Nacreous (mother-of-pearl) cloud material - psc.js physics: the
// certified Airy iridescence LUT (rows = the printed 1.9-3.0 um
// wave-ice size span, columns = scattering angle) sampled at each
// fragment's TRUE angle from the sun, with the size row swept
// ALONG the lenticular form (Reichardt 2004's printed 3 -> 1.9 um
// phase evolution - the banding IS the size gradient). ampV
// carries the reddened 20.5 km twilight beam per channel times
// the measured-temperature gate; the lens envelope is a
// documented display shape.
export function createNacreousMaterial(lut) {
  const tex = new DataTexture(lut.data, lut.w, lut.h, RGBAFormat, FloatType);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  const u = {
    ampV: uniform(new Vector3(0, 0, 0)),
    sunDir: uniform(new Vector3(0, 1, 0)),
    // The twilight nacreous display lives in mesopic light - it
    // joins the same gated rod fold as the rest of the frame.
    scotB: uniform(1)
  };
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = DoubleSide;
  material.blending = AdditiveBlending;
  const texN = texture(tex);
  const dirW = normalize(positionWorld.sub(cameraPosition));
  const cosT = clamp(dot(dirW, u.sunDir), -1, 1);
  const th = acos(cosT);
  const uTh = th
    .div(lut.thetaMaxRad)
    .clamp(0, 1)
    .mul((lut.w - 1) / lut.w)
    .add(0.5 / lut.w);
  const vRow = uv()
    .x.clamp(0, 1)
    .mul((lut.h - 1) / lut.h)
    .add(0.5 / lut.h);
  const pat = texN.sample(vec2(uTh, vRow)).rgb;
  const ex = uv().x.sub(0.5).div(0.38);
  const ey = uv().y.sub(0.5).div(0.22);
  const env = exp(ex.pow(2).add(ey.pow(2)).negate().mul(3.0));
  const lit = pat.mul(env).mul(u.ampV);
  material.colorNode = mix(vec3(rodY(lit)), lit, u.scotB);
  material.opacityNode = float(1);
  return {material, u};
}

// The glory (mie.js law): the exact Mie backscatter rings around
// the antisolar point, on a billboard quad centred on the
// antisolar direction. The 1-D LUT is the exact phase function
// p(theta) (sr^-1) per RGB channel over 0..GLORY_MAX_DEG from
// 180 deg, at the fogbow's own printed droplet - the SAME fog
// makes both displays. Each fragment samples at its TRUE angle
// from the antisolar direction (billboard flatness never enters
// the angle), so the rings stay circular at any quad
// orientation. ampV carries the whole fogbow radiometric chain
// computed CPU-side at the antisolar point: source transmittance
// x veil x exposure x the two-leg fog slab (bowSlab at
// sinA = -sinH, where kc = 2 exactly) - the small-angle
// reduction of the dome's per-fragment slab to one value across
// the 8-deg window, stated. Depth test is OFF by design: the
// glory forms on the fog BETWEEN the eye and every fogged
// surface (the Brocken geometry), so it must draw over the
// terrain the fog veils; the additive quad feathers to zero at
// the LUT window edge.
export function createGloryMaterial(lut) {
  const tex = new DataTexture(lut.data, lut.w, 1, RGBAFormat, FloatType);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  const u = {
    ampV: uniform(new Vector3(0, 0, 0)),
    antiDir: uniform(new Vector3(0, -1, 0)),
    // The mesopic rod fold (the same gated Eq. 13 mirror the
    // dome, stars and optics ride) - fed mesoB per frame so a
    // moonlit ring greys exactly as the printed colour floor
    // says real lunar coronae do.
    scotB: uniform(1)
  };
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.depthTest = false;
  material.side = DoubleSide;
  material.blending = AdditiveBlending;
  const texN = texture(tex);
  const dirW = normalize(positionWorld.sub(cameraPosition));
  const cosT = clamp(dot(dirW, u.antiDir), -1, 1);
  const gN = acos(cosT).div((lut.maxDeg * Math.PI) / 180);
  const uTh = gN
    .clamp(0, 1)
    .mul((lut.w - 1) / lut.w)
    .add(0.5 / lut.w);
  const pat = texN.sample(vec2(uTh, 0.5)).rgb;
  const feather = float(1).sub(smoothstep(float(0.86), float(1.0), gN));
  const lit = pat.mul(feather).mul(u.ampV);
  material.colorNode = mix(vec3(rodY(lit)), lit, u.scotB);
  material.opacityNode = float(1);
  return {material, u};
}

// The K + F solar corona (kcorona.js, gated): van de Hulst
// 1950's printed model corona on a billboard around the SUN,
// drawn in the dome's own absolute frame. The LUT rows are the
// equatorial and polar surface-brightness profiles (E0-relative
// radiance, i.e. cd/m^2 per lux of solar constant) at the
// current cycle phase; the fragment blends them by position
// angle around the SOLAR AXIS (u.axisU, the projected rotation
// axis fed CPU-side from sunspots.js's own disc geometry - the
// same P + parallactic frame the drawn spots ride), polar caps
// 0.3 of the circumference as van de Hulst's model states. The
// inner feather starts at the MOON's current radius ratio
// (u.innerR - during totality the moon covers the corona's
// base) and the amplitude is the sun's transmittance times the
// sky exposure: the corona is sunlight, and its visibility
// against the drawn sky then EMERGES from the same adaptation
// frame everything else rides - dazzled away in daylight,
// revealed exactly as the eclipsed sky collapses (the
// coronality the kcorona gate holds against the 2017 record).
export function createCoronaMaterial(lut) {
  const tex = new DataTexture(lut.data, lut.w, 2, RGBAFormat, FloatType);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  const u = {
    ampV: uniform(new Vector3(0, 0, 0)),
    sunDir: uniform(new Vector3(0, 1, 0)),
    axisU: uniform(new Vector3(0, 1, 0)),
    rSunRad: uniform(0.00465),
    innerR: uniform(1.03),
    scotB: uniform(1),
    tex
  };
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.depthTest = true;
  material.side = DoubleSide;
  material.blending = AdditiveBlending;
  const texN = texture(tex);
  const dirW = normalize(positionWorld.sub(cameraPosition));
  const cosT = clamp(dot(dirW, u.sunDir), -1, 1);
  const rr = acos(cosT).div(u.rSunRad); // solar radii from centre
  const span = lut.rMax - 1;
  const gN = rr.sub(1).div(span).clamp(0, 1);
  const uTh = gN.mul((lut.w - 1) / lut.w).add(0.5 / lut.w);
  // Position angle around the projected solar axis: the polar
  // caps span 0.3 of the circumference (54 deg about each pole
  // -> |PA| < 27 deg), blended over a stated 10-deg seam.
  const perp = dirW.sub(u.sunDir.mul(cosT));
  const perpN = normalize(perp.add(vec3(1e-6, 0, 0)));
  const cosPA = abs(dot(perpN, u.axisU));
  const polarMix = smoothstep(
    float(Math.cos((32 * Math.PI) / 180)),
    float(Math.cos((22 * Math.PI) / 180)),
    cosPA
  );
  const vRow = mix(float(0.25), float(0.75), polarMix);
  const pat = texN.sample(vec2(uTh, vRow)).rgb;
  const featherIn = smoothstep(u.innerR, u.innerR.add(0.08), rr);
  const featherOut = float(1).sub(smoothstep(float(0.88), float(1.0), gN));
  const lit = pat.mul(featherIn).mul(featherOut).mul(u.ampV);
  material.colorNode = mix(vec3(rodY(lit)), lit, u.scotB);
  material.opacityNode = float(1);
  return {material, u};
}

// The Milky Way dome: Gaia DR3 integrated starlight
// (milkyway.js / milkyway-data.js - every DR3 source aggregated
// server-side at ESA, minus the G < 5.5 bright end the theme
// draws as individual stars). The bake below runs the EXACT
// per-cell pipeline (nested ang2pix -> Riello G-V -> S10) into an
// equirect texture in the CELESTIAL frame the dome's object space
// already is; a 3-tap smoothing pass softens the 1.8-deg HEALPix
// cells (documented display smoothing on exact data). Photometry
// rides the SAME zlPerGreen base and AGLOW_GAIN as the zodiacal
// light, so the galaxy/zodiacal contrast carries no free
// parameter; each cell's integrated BP-RP is read as the
// blackbody of the same EDR3 colour (milkyway.js Riello
// machinery) and drawn with the star sprites' own Planck tint
// chain (stars-color.js) - one cited colour frame for the
// galaxy and the drawn stars, a stated single-temperature
// reduction of each cell's mixed population.
export function buildMilkyWayGrid(W, H) {
  const lum = new Float32Array(W * H);
  const tint = new Float32Array(W * H * 2); // bpRp packed later
  for (let y = 0; y < H; y++) {
    const dec = ((y + 0.5) / H - 0.5) * Math.PI;
    for (let x = 0; x < W; x++) {
      const ra = ((x + 0.5) / W) * 2 * Math.PI;
      const pix = ang2pix(Math.sin(dec), ra);
      const {s10, bpRp} = cellS10(
        MW_FG[pix],
        MW_FBP[pix],
        MW_FRP[pix],
        CELL_AREA_DEG2
      );
      lum[y * W + x] = s10;
      tint[(y * W + x) * 2] = bpRp;
    }
  }
  // separable 3-tap [1 2 1]/4, run twice: RA wraps, Dec clamps
  const blur = (src) => {
    const a = new Float32Array(src);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < H; y++) {
        const row = new Float32Array(W);
        for (let x = 0; x < W; x++) {
          row[x] =
            0.25 * a[y * W + ((x + W - 1) % W)] +
            0.5 * a[y * W + x] +
            0.25 * a[y * W + ((x + 1) % W)];
        }
        a.set(row, y * W);
      }
      for (let x = 0; x < W; x++) {
        const col = new Float32Array(H);
        for (let y = 0; y < H; y++) {
          const y0 = Math.max(y - 1, 0);
          const y1 = Math.min(y + 1, H - 1);
          col[y] =
            0.25 * a[y0 * W + x] + 0.5 * a[y * W + x] + 0.25 * a[y1 * W + x];
        }
        for (let y = 0; y < H; y++) a[y * W + x] = col[y];
      }
    }
    return a;
  };
  const lumB = blur(lum);
  // Tint LUT over the colour axis: 256 taps of the cited chain
  // (bpRp -> blackbody temperature -> Planck tint), so the bake
  // pays the bisection/integration once per colour, not per
  // texel.
  const TN = 256;
  const T0 = -0.5;
  const T1 = 3.0;
  const tintLut = new Float32Array(TN * 3);
  for (let i = 0; i < TN; i++) {
    const bp = T0 + ((T1 - T0) * i) / (TN - 1);
    const [r, g, b] = starTintRGB(kelvinFromBpRp(bp));
    tintLut[i * 3] = r;
    tintLut[i * 3 + 1] = g;
    tintLut[i * 3 + 2] = b;
  }
  const data = new Float32Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const j =
      3 *
      Math.min(
        Math.max(Math.round(((tint[i * 2] - T0) / (T1 - T0)) * (TN - 1)), 0),
        TN - 1
      );
    data[i * 4] = tintLut[j] * lumB[i];
    data[i * 4 + 1] = tintLut[j + 1] * lumB[i];
    data[i * 4 + 2] = tintLut[j + 2] * lumB[i];
    data[i * 4 + 3] = 1;
  }
  return data;
}

export function createMilkyWayMaterial() {
  const u = {
    night: uniform(0),
    uScale: uniform(zlPerGreen()),
    uTzen: uniform(new Vector3(0.94, 0.87, 0.72))
  };
  const W = 512;
  const H = 256;
  const tex = new DataTexture(
    buildMilkyWayGrid(W, H),
    W,
    H,
    RGBAFormat,
    FloatType
  );
  tex.minFilter = tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  const mapNode = texture(tex);
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = BackSide;
  material.blending = AdditiveBlending;
  // Object space IS the celestial frame (the star convention:
  // x = cosDec sinRA, y = sinDec, z = cosDec cosRA).
  const d = normalize(positionLocal);
  const dec = asin(clamp(d.y, -1, 1));
  const ra = atan(d.x, d.z);
  const uvm = vec2(
    mod(ra.div(2 * Math.PI).add(1), 1),
    dec.div(Math.PI).add(0.5)
  );
  const s = mapNode.sample(uvm);
  const cosZ = clamp(normalize(positionWorld.sub(cameraPosition)).y, 0.0, 1.0);
  const X = float(1).div(cosZ.add(exp(cosZ.mul(-11)).mul(0.025)));
  const T = pow(vec3(u.uTzen), X);
  material.colorNode = T.mul(s.rgb.mul(u.uScale).mul(AGLOW_GAIN));
  material.opacityNode = u.night;
  return {material, u};
}

// Noctilucent clouds (nlc.js): the 83-km mesospheric ice shell,
// lit only where it still sees the sun while the observer stands
// in twilight darkness. The fragment mirrors nlc.js EXACTLY in
// world kilometres - closed-form ray-shell distance, then the
// Earth's shadow cylinder widened by the 30 km Rozenberg
// screening height; the published 6-16 deg visibility window is
// GEOMETRY here, not a gate. Display elements (documented): the
// gravity-wave billow pattern (two sine octaves, ~35/90 km, the
// observed NLC band scales, drifting at the ~40 m/s mesospheric
// wind), the forward-scattering brightening toward the sun, the
// slant-path thickening toward the horizon, and the silvery-blue
// tint. uAmp carries the season/latitude envelope and the 6-deg
// sky-brightness gate from the CPU.
export function createNLCMaterial() {
  const u = {
    uSunDirW: uniform(new Vector3(1, 0, 0)),
    uAmp: uniform(0),
    time: uniform(0)
  };
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = BackSide;
  material.blending = AdditiveBlending;
  const R = 6371.0088;
  const H = 83;
  const SCREEN = 30;
  const d = normalize(positionWorld.sub(cameraPosition));
  const dy = d.y;
  // exact shell distance (km): sqrt(R^2 dy^2 + H(2R+H)) - R dy
  const t = sqrt(
    dy
      .mul(dy)
      .mul(R * R)
      .add(H * (2 * R + H))
  ).sub(dy.mul(R));
  const P = vec3(d.x.mul(t), dy.mul(t).add(R), d.z.mul(t));
  const along = dot(P, u.uSunDirW);
  const perp2 = dot(P, P).sub(along.mul(along));
  const lit = select(
    along.greaterThanEqual(0.0),
    float(1),
    step((R + SCREEN) * (R + SCREEN), perp2)
  );
  // soften the shadow edge over ~60 km of perpendicular distance
  const soft = select(
    along.greaterThanEqual(0.0),
    float(1),
    smoothstep(
      (R + SCREEN) * (R + SCREEN),
      (R + SCREEN + 60) * (R + SCREEN + 60),
      perp2
    )
  );
  // billows: two sine octaves in shell-plane kilometres, drifting
  const drift = u.time.mul(0.04); // 40 m/s in km/s
  const w1 = sin(P.x.add(drift.mul(35)).mul((2 * Math.PI) / 35))
    .mul(sin(P.z.mul((2 * Math.PI) / 47)))
    .mul(0.5)
    .add(0.5);
  const w2 = sin(
    P.x
      .mul((2 * Math.PI) / 90)
      .add(P.z.mul((2 * Math.PI) / 110))
      .add(drift)
  )
    .mul(0.5)
    .add(0.5);
  const billow = w1.mul(0.6).add(w2.mul(0.4)).pow(1.6);
  // forward scattering toward the sun + slant-path thickening
  const fwd = dot(d, u.uSunDirW).mul(0.5).add(0.5).pow(2).mul(0.75).add(0.25);
  const slant = clamp(t.div(H).div(9.0), 0.0, 1.0);
  const horizonFade = smoothstep(0.0, 0.03, dy); // above horizon only
  material.colorNode = vec3(0.62, 0.74, 0.9).mul(
    lit
      .mul(soft)
      .mul(billow)
      .mul(fwd)
      .mul(slant)
      .mul(horizonFade)
      .mul(u.uAmp)
      .mul(0.32)
  );
  material.opacityNode = float(1);
  return {material, u};
}

// The light-pollution dome (skyglow.js): a warm sodium/LED glow
// whose HORIZON ANISOTROPY is measured - 16 azimuth weights,
// computed at boot from Walker's law over ring samples of the
// Falchi atlas grid, arrive as a wrapping 16x1 texture. A coastal
// city glows toward the city and stays dark over the sea. The
// vertical profile (strong at the horizon, fading with altitude)
// and the warm tint are the documented display elements; the
// amplitude and the azimuth structure are the measured part.
export function createSkyglowMaterial() {
  const az = new Float32Array(16).fill(1);
  const azTex = new DataTexture(az, 16, 1, RedFormat, FloatType);
  azTex.wrapS = RepeatWrapping;
  azTex.minFilter = azTex.magFilter = LinearFilter;
  azTex.needsUpdate = true;
  const u = {
    alpha: uniform(0),
    tint: uniform(new Vector3(0.42, 0.33, 0.18)),
    azTex,
    azData: az
  };
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = BackSide;
  material.blending = AdditiveBlending;
  const d = normalize(positionLocal);
  // scene azimuth: 0 = north = -z, 90 = east = +x
  const azFrac = atan(d.x, d.z.negate())
    .div(2 * Math.PI)
    .add(1)
    .mod(1);
  const w = texture(azTex).sample(vec2(azFrac, 0.5)).r;
  // horizon-heavy vertical profile: the glow lives low
  const h = clamp(d.y, 0.0, 1.0);
  const prof = exp(h.mul(-5.5)).mul(0.85).add(0.15);
  material.colorNode = vec3(u.tint).mul(w.mul(prof).mul(u.alpha));
  material.opacityNode = float(1);
  return {material, u};
}

// The twilight purple light: the stratospheric (Junge) layer's
// single-scatter radiance (stratos.js - Kremser 2016's printed
// amplitude riding the shipped Rayleigh scale, gated on Lee &
// Hernandez-Andres 2003's printed window). The texture holds
// per-unit-E0 radiance over (azimuth from the sun, elevation to
// the zenith); uGain carries skyExposure (the same per-E0 frame
// the dome's march draws in), and the rod fold is the shared
// Eq. 13 under the same mesopic blend as the dome and optics.
export function createStratMaterial() {
  const W = 24;
  const H = 16;
  const data = new Float32Array(W * H * 4);
  const tex = new DataTexture(data, W, H, RGBAFormat, FloatType);
  tex.wrapS = RepeatWrapping;
  tex.minFilter = tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  const u = {
    gain: uniform(0),
    sunAz: uniform(0),
    scotB: uniform(1),
    tex,
    data
  };
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = BackSide;
  material.blending = AdditiveBlending;
  const d = normalize(positionLocal);
  const az = atan(d.x, d.z.negate());
  // Texture u: dPhi in [-pi, pi] mapped to [0, 1] (RepeatWrapping
  // closes the seam); v: elevation 0..pi/2.
  const tu = az
    .sub(u.sunAz)
    .div(2 * Math.PI)
    .add(1.5)
    .mod(1);
  const tv = asin(clamp(d.y, 0.0, 1.0)).div(Math.PI / 2);
  const col = texture(tex).sample(vec2(tu, tv)).rgb.mul(u.gain);
  const Xs = col.x.mul(0.4124).add(col.y.mul(0.3576)).add(col.z.mul(0.1805));
  const Ys = col.x.mul(0.2126).add(col.y.mul(0.7152)).add(col.z.mul(0.0722));
  const Zs = col.x.mul(0.0193).add(col.y.mul(0.1192)).add(col.z.mul(0.9505));
  const rod = Ys.mul(
    Ys.add(Zs).div(max(Xs, 1e-12)).add(1).mul(1.33).sub(1.68)
  ).div(2.31);
  material.colorNode = mix(vec3(max(rod, 0.0)), col, u.scotB);
  material.opacityNode = float(1);
  return {material, u};
}
