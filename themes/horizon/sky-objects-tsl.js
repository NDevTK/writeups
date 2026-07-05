import {
  AdditiveBlending,
  BackSide,
  Color,
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
  acos,
  bitcast,
  instancedBufferAttribute,
  cameraPosition,
  cameraProjectionMatrix,
  clamp,
  dot,
  exp,
  float,
  length,
  max,
  mix,
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
  texture,
  uint,
  uniform,
  uv,
  vertexStage,
  vec3,
  vec4
} from 'three/tsl';

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

// Lommel-Seeliger moon: mu0/(mu0+mu), x2 so the full-moon face
// reads as the albedo. Flat disc at full phase, like the real moon.
export function createMoonMaterial() {
  const u = {
    sunDirM: uniform(new Vector3(0, 1, 0)),
    albM: uniform(new Color('#cdd4e2')),
    glowM: uniform(new Color('#0c0f16'))
  };
  const material = new NodeMaterial();
  const n = normalize(normalWorld);
  const mu0 = dot(n, u.sunDirM);
  const mu = dot(n, normalize(cameraPosition.sub(positionWorld)));
  const ls = select(mu0.greaterThan(0.0), mu0.div(max(mu0.add(mu), 1e-3)), 0.0);
  material.colorNode = u.albM.mul(ls).mul(2.0).add(u.glowM);
  return {material, u};
}

// Additive aurora curtains; the oval's real latitude enters as uBase.
export function createAuroraMaterial() {
  const u = {
    time: uniform(0),
    strength: uniform(0),
    uBase: uniform(60)
  };
  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.side = DoubleSide;
  material.blending = AdditiveBlending;
  const ux = uv().x;
  const h = clamp(positionWorld.y.sub(u.uBase).div(720.0), 0.0, 1.0);
  const w = sin(
    ux
      .mul(38.0)
      .add(u.time.mul(0.9))
      .add(sin(ux.mul(7.0).add(u.time.mul(0.35))).mul(2.4))
  )
    .mul(0.5)
    .add(0.5);
  const w2 = sin(ux.mul(61.0).sub(u.time.mul(0.6)).add(2.1))
    .mul(0.5)
    .add(0.5);
  const band = pow(h.oneMinus(), 2.0).mul(smoothstep(0.08, 0.32, h));
  const a = u.strength.mul(band).mul(w.mul(w2).add(0.9));
  const col = mix(vec3(0.13, 0.95, 0.45), vec3(0.5, 0.25, 0.95), h.mul(1.3));
  material.colorNode = col.mul(a);
  material.opacityNode = a;
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
  const spectral = Fn(([h]) => {
    return clamp(
      vec3(
        h.mul(1.6).sub(0.35),
        float(1.0).sub(h.mul(2.4).sub(1.25).abs()),
        float(1.05).sub(h.mul(1.7))
      ),
      0.0,
      1.0
    );
  });
  const DEG = 57.29577951308232;
  const v = normalize(positionLocal);
  const aA = acos(clamp(dot(v, u.antisolar), -1.0, 1.0)).mul(DEG);
  const aS = acos(clamp(dot(v, u.sunDir), -1.0, 1.0)).mul(DEG);
  // primary bow: violet 40.6 inner -> red 42.4 outer
  const b1 = smoothstep(40.4, 40.9, aA).mul(
    smoothstep(42.2, 42.6, aA).oneMinus()
  );
  const c1 = spectral(clamp(aA.sub(40.6).div(1.8), 0.0, 1.0).oneMinus()).mul(
    b1.mul(u.bow).mul(0.55)
  );
  // secondary: red 50.4 inner -> violet 53.2 outer, 43% brightness
  const b2 = smoothstep(50.2, 50.8, aA).mul(
    smoothstep(52.8, 53.6, aA).oneMinus()
  );
  const c2 = spectral(clamp(aA.sub(50.4).div(2.8), 0.0, 1.0)).mul(
    b2.mul(u.bow).mul(0.24)
  );
  // 22-deg halo, red inner edge fading to bluish white; parhelia ride
  // a gaussian band at the sun's own elevation
  const th = smoothstep(21.2, 21.9, aS).mul(
    smoothstep(22.5, 23.8, aS).oneMinus()
  );
  const hcol = mix(
    vec3(1.0, 0.5, 0.35),
    vec3(0.85, 0.92, 1.0),
    clamp(aS.sub(21.8).div(1.6), 0.0, 1.0)
  );
  // exp(-x^2) written as a product - GLSL pow() is undefined for
  // negative bases, and x goes negative below the sun
  const dx = v.y.sub(u.sunDir.y).mul(14.0);
  const dogBand = exp(dx.mul(dx).negate());
  const c3 = hcol.mul(
    th.mul(u.halo).mul(u.dogs.mul(dogBand).mul(0.6).add(0.18))
  );
  material.colorNode = c1.add(c2).add(c3);
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

// Yale stars with Kolmogorov scintillation: twinkle amplitude grows
// with airmass (~sec z), so horizon stars shimmer, zenith stars don't.
export function createStarSprites(positions, colors, sizes) {
  const u = {night: uniform(0), time: uniform(0)};
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
      const vtw = clamp(am.sub(1.0).mul(0.06), 0.0, 0.5)
        .mul(sin(u.time.mul(9.0).add(ph)))
        .add(1.0);
      return {
        sizeNode: sizeA.mul(vtw),
        opacityNode: u.night.mul(vtw)
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
