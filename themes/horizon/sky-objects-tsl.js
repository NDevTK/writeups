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
    glowM: uniform(new Color('#0c0f16'))
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
  material.colorNode = u.albM.mul(lunar).mul(2.0).add(u.glowM);
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
