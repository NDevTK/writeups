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
import {AGLOW_GAIN, LINES, R_EARTH} from './airglow.js';
import {buildZodiacalGrid, OBLIQUITY, zlPerGreen} from './zodiacal.js';
import {ang2pix, cellS10, CELL_AREA_DEG2} from './milkyway.js';
import {MW_FBP, MW_FG, MW_FRP} from './milkyway-data.js';

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

// mix(bottom, top, h) gradient dome that fades in with cloud cover.
export function createVeilMaterial() {
  const u = {
    alpha: uniform(0),
    top: uniform(new Color('#79838c')),
    bottom: uniform(new Color('#a2abb3'))
  };
  const material = new NodeMaterial();
  material.side = BackSide;
  material.transparent = true;
  material.depthWrite = false;
  const h = clamp(normalize(positionLocal).y.mul(1.4).add(0.25), 0.0, 1.0);
  material.colorNode = mix(u.bottom, u.top, h);
  material.opacityNode = u.alpha;
  return {material, u};
}

// The moon: Hapke photometry (see block comment below). The disc
// stays flat at full phase like the real moon - the mu0/(mu0+mu)
// Lommel-Seeliger backbone survives inside Hapke's IMSA - and the
// brightness now follows the observed phase curve, opposition surge
// included.
export function createMoonMaterial() {
  const u = {
    sunDirM: uniform(new Vector3(0, 1, 0)),
    albM: uniform(new Color('#cdd4e2')),
    glowM: uniform(new Color('#0c0f16')),
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
  material.colorNode = u.albM.mul(lunar.add(earthlit)).mul(2.0).add(u.glowM);
  return {material, u};
}

// Additive aurora curtains; the oval's real latitude enters as uBase.
// The vertical structure and color are PHYSICAL (aurora-lut.js):
// Fang et al. 2010 electron deposition through the CIRA-72 mean
// atmosphere, line profiles for 630.0 / 557.7 / 427.8 nm with O(1D)
// quenching, sampled by the fragment's emission altitude. The
// characteristic energy E0 (from the precipitation data) rebuilds
// the LUT in place; the sine curtain waving stays as the documented
// shape heuristic (curtain fluid dynamics are out of scope). What
// the physics gives untuned: green lower border near 100 km, the
// purple N2+ fringe below it, red 630.0 tops above 200 km that take
// over as precipitation softens.
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
  const lutData = new Float32Array(128 * 4);
  const lutTex = new DataTexture(lutData, 128, 1, RGBAFormat, FloatType);
  lutTex.minFilter = lutTex.magFilter = LinearFilter;
  const lutNode = texture(lutTex);
  let builtE0 = 0;
  const setE0 = (e0) => {
    const e = Math.min(Math.max(e0, 0.3), 20);
    if (Math.abs(e - builtE0) < builtE0 * 0.05) return;
    builtE0 = e;
    lutData.set(buildAuroraLUT(e).data);
    lutTex.needsUpdate = true;
  };
  setE0(3);
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
    uTzen: uniform(new Vector3(0.94, 0.87, 0.72))
  };
  const C = LINES.map((l) => wavelengthToLinearSRGB(l.lam));
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = BackSide;
  material.blending = AdditiveBlending;
  const cosZ = clamp(normalize(positionWorld.sub(cameraPosition)).y, 0.0, 1.0);
  const s2 = float(1).sub(cosZ.mul(cosZ));
  const vr = (hKm) => {
    const q = R_EARTH / (R_EARTH + hKm * 1e3);
    return float(1).div(sqrt(float(1).sub(s2.mul(q * q))));
  };
  const X = float(1).div(cosZ.add(exp(cosZ.mul(-11)).mul(0.025)));
  const T = pow(vec3(u.uTzen), X);
  const col = vec3(...C[0])
    .mul(u.uLineI.x.mul(vr(LINES[0].hKm)))
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
// on one additive dome.
export function createOpticsMaterial() {
  const u = {
    sunDir: uniform(new Vector3(0, 1, 0)),
    antisolar: uniform(new Vector3(0, -1, 0)),
    bow: uniform(0),
    halo: uniform(0),
    dogs: uniform(0)
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
  // convolved with the limb-darkened sun disc. The old hand-tuned
  // smoothstep bands and spectral ramp are deleted; the display
  // gains (0.55 bow, halo's dog/base mix) keep their calibrated
  // values, now scaling peak-normalised physical profiles.
  const mkLutTex = (lut) => {
    const t = new DataTexture(lut.data, lut.bins, 1, RGBAFormat, FloatType);
    t.minFilter = t.magFilter = LinearFilter;
    t.needsUpdate = true;
    return t;
  };
  const haloLut = buildHaloLUT();
  const bowLut = buildBowLUT();
  const haloTexN = texture(mkLutTex(haloLut));
  const bowTexN = texture(mkLutTex(bowLut));

  const DEG = 57.29577951308232;
  const v = normalize(positionLocal);
  const aA = acos(clamp(dot(v, u.antisolar), -1.0, 1.0)).mul(DEG);
  const aS = acos(clamp(dot(v, u.sunDir), -1.0, 1.0)).mul(DEG);
  const bowSample = bowTexN.sample(
    vec2(aA.sub(bowLut.thMinDeg).div(bowLut.thMaxDeg - bowLut.thMinDeg), 0.5)
  ).rgb;
  const haloSample = haloTexN.sample(
    vec2(aS.sub(haloLut.thMinDeg).div(haloLut.thMaxDeg - haloLut.thMinDeg), 0.5)
  ).rgb;
  const cBow = bowSample.mul(u.bow).mul(0.55);
  // Parhelia placement stays the documented gaussian band at the
  // sun's own elevation (plate-crystal orientation statistics are
  // out of scope); its radial profile is now the physical halo LUT.
  // exp(-x^2) written as a product - GLSL pow() is undefined for
  // negative bases, and x goes negative below the sun.
  const dx = v.y.sub(u.sunDir.y).mul(14.0);
  const dogBand = exp(dx.mul(dx).negate());
  const cHalo = haloSample.mul(
    u.halo.mul(u.dogs.mul(dogBand).mul(0.6).add(0.18))
  );
  material.colorNode = cBow.add(cHalo);
  material.opacityNode = 1.0;
  return {material, u};
}

// Shared machinery for the two point-sprite systems: an InstancedMesh
// of unit planes, SpriteNodeMaterial billboarding, and a scale node
// reproducing gl_PointSize (pixels at the projected centre).
function makeSprites({positions, colors, sizes, opacityFor}) {
  const count = sizes.length;
  const geo = new PlaneGeometry(1, 1);
  const posAttr = new InstancedBufferAttribute(positions, 3);
  const colAttr = new InstancedBufferAttribute(colors, 3);
  const sizeAttr = new InstancedBufferAttribute(sizes, 1);
  const material = new SpriteNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  const center = instancedBufferAttribute(posAttr);
  const colorA = instancedBufferAttribute(colAttr);
  const sizeA = instancedBufferAttribute(sizeAttr);
  material.positionNode = center;
  // gl_PointSize is pixels at the centre's projected depth: a quad of
  // world height sizePx * 2*viewZ / (screenH * P[1][1]) rasterizes to
  // the same sizePx pixels.
  const viewZ = modelViewMatrix.mul(vec4(center, 1.0)).z.negate();
  const p11 = cameraProjectionMatrix.element(1).element(1);
  const {sizeNode, opacityNode} = opacityFor(center, sizeA);
  material.scaleNode = sizeNode.mul(2.0).mul(viewZ).div(screenSize.y.mul(p11));
  // gl_PointCoord's radial mask on the quad's own uv
  const d = length(uv().sub(0.5));
  material.colorNode = colorA;
  material.opacityNode = opacityNode.mul(smoothstep(0.2, 0.5, d).oneMinus());
  const mesh = new InstancedMesh(geo, material, count);
  mesh.frustumCulled = false;
  return {mesh, posAttr, sizeAttr};
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
export function createStarSprites(positions, colors, sizes) {
  const u = {
    night: uniform(0),
    time: uniform(0),
    twRate: uniform(9),
    sigZen: uniform(youngSigma(EYE_D_CM, 1))
  };
  const {mesh} = makeSprites({
    positions,
    colors,
    sizes,
    opacityFor: (center, sizeA) => {
      const alt = max(
        normalize(modelWorldMatrix.mul(vec4(center, 1.0)).xyz).y,
        0.04
      );
      const am = float(1.0).div(alt);
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
      return {
        sizeNode: sizeA,
        opacityNode: u.night.mul(I)
      };
    }
  });
  return {mesh, u};
}

// Naked-eye planets: fixed pixel size, night-gated discs at their
// live ephemeris positions (write posAttr + needsUpdate at 1 Hz).
export function createPlanetSprites(positions, colors, sizes) {
  const u = {night: uniform(0)};
  const {mesh, posAttr, sizeAttr} = makeSprites({
    positions,
    colors,
    sizes,
    opacityFor: (center, sizeA) => ({
      sizeNode: sizeA,
      opacityNode: u.night
    })
  });
  return {mesh, u, posAttr, sizeAttr};
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
// parameter; the colour tint from each cell's integrated BP-RP is
// the one documented display mapping (bluish 0.6 -> warm 1.6).
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
  const data = new Float32Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const c = Math.min(Math.max((tint[i * 2] - 0.6) / 1.0, 0), 1);
    // bluish-white (0.6) -> warm (1.6) - display mapping
    data[i * 4] = (0.82 + 0.18 * c) * lumB[i];
    data[i * 4 + 1] = (0.9 - 0.02 * c) * lumB[i];
    data[i * 4 + 2] = (1.0 - 0.28 * c) * lumB[i];
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

/**
 * The rainbow overlay (rainbow.js computes the physics): a 1-D
 * RGB profile over the angle from the ANTISOLAR point, Airy
 * theory on the Marshall-Palmer drop of the measured rain,
 * uploaded as a LUT. The dome just measures each view ray's
 * angle off the antisolar axis and samples - primary, Alexander's
 * dark band, secondary and the supernumerary fringes are all IN
 * the profile. Additive, depth-tested (terrain occludes the low
 * arc), faded by the caller's alpha (sun, rain and cloud gates
 * live in the theme).
 */
export function createRainbowMaterial(n = 512) {
  const lutData = new Float32Array(n * 4);
  const lut = new DataTexture(lutData, n, 1, RGBAFormat, FloatType);
  lut.minFilter = lut.magFilter = LinearFilter;
  lut.needsUpdate = true;
  const u = {
    alpha: uniform(0),
    antisun: uniform(new Vector3(0, -1, 0)),
    g0: uniform((37 * Math.PI) / 180),
    g1: uniform((55 * Math.PI) / 180),
    lut,
    lutData
  };
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = BackSide;
  material.blending = AdditiveBlending;
  const d = normalize(positionLocal);
  const g = acos(clamp(dot(d, u.antisun), -1.0, 1.0));
  const frac = clamp(g.sub(u.g0).div(u.g1.sub(u.g0)), 0.0, 1.0);
  const c = texture(u.lut).sample(vec2(frac, 0.5));
  // the LUT ends at zero on both flanks; the hard clamp edges
  // never show
  material.colorNode = c.rgb.mul(u.alpha);
  material.opacityNode = float(1);
  return {material, u};
}

/**
 * The ice-halo overlay (halos.js computes the physics): the
 * 22-degree ring LUT over the angle from the SUN, plus the
 * sundog LUT over azimuthal offset along the sun's almucantar,
 * weighted vertically by the plates' documented ~1.5-degree
 * wobble. Additive, depth-tested, faded by the caller's alpha
 * (cirrus and sun gates live in the theme).
 */
export function createHaloMaterial(n = 512, np = 256) {
  const ringData = new Float32Array(n * 4);
  const ring = new DataTexture(ringData, n, 1, RGBAFormat, FloatType);
  ring.minFilter = ring.magFilter = LinearFilter;
  ring.needsUpdate = true;
  const parData = new Float32Array(np * 4);
  const par = new DataTexture(parData, np, 1, RGBAFormat, FloatType);
  par.minFilter = par.magFilter = LinearFilter;
  par.needsUpdate = true;
  const u = {
    alpha: uniform(0),
    parOn: uniform(0),
    sunDir: uniform(new Vector3(0, 1, 0)),
    sunAlt: uniform(0),
    g0: uniform((18 * Math.PI) / 180),
    g1: uniform((30 * Math.PI) / 180),
    a0: uniform((18 * Math.PI) / 180),
    a1: uniform((55 * Math.PI) / 180),
    sigV: uniform((1.5 * Math.PI) / 180),
    ring,
    ringData,
    par,
    parData
  };
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = BackSide;
  material.blending = AdditiveBlending;
  const d = normalize(positionLocal);
  const g = acos(clamp(dot(d, u.sunDir), -1.0, 1.0));
  const ringC = texture(u.ring).sample(
    vec2(clamp(g.sub(u.g0).div(u.g1.sub(u.g0)), 0.0, 1.0), 0.5)
  );
  // azimuth offset along the almucantar + the plates' vertical
  // wobble envelope
  const hd = max(sqrt(float(1.0).sub(d.y.mul(d.y))), 1e-4);
  const hs = max(sqrt(float(1.0).sub(u.sunDir.y.mul(u.sunDir.y))), 1e-4);
  const cosAz = clamp(
    d.x.mul(u.sunDir.x).add(d.z.mul(u.sunDir.z)).div(hd.mul(hs)),
    -1.0,
    1.0
  );
  const az = acos(cosAz);
  const dAlt = asin(clamp(d.y, -1.0, 1.0))
    .sub(u.sunAlt)
    .div(u.sigV);
  const parC = texture(u.par)
    .sample(vec2(clamp(az.sub(u.a0).div(u.a1.sub(u.a0)), 0.0, 1.0), 0.5))
    .rgb.mul(exp(dAlt.mul(dAlt).negate()))
    .mul(u.parOn);
  material.colorNode = ringC.rgb.add(parC).mul(u.alpha);
  material.opacityNode = float(1);
  return {material, u};
}
