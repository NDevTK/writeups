import {Color, Mesh, NodeMaterial, Vector2, Vector3} from 'three/webgpu';
import {
  Fn,
  add,
  cameraPosition,
  clamp,
  div,
  dot,
  float,
  length,
  max,
  mix,
  mul,
  normalize,
  positionWorld,
  pow,
  reflect,
  reflector,
  smoothstep,
  sub,
  texture,
  uniform,
  vec2,
  vec3
} from 'three/tsl';

/**
 * Horizon's sea as a TSL node material (WebGPU project, phase 2).
 *
 * Forked from three r185 examples/jsm/objects/WaterMesh.js (vendored
 * unmodified alongside for provenance) with the physics the classic
 * pipeline applied as runtime string patches - node graphs cannot be
 * string-patched, so the fork carries them at source level, each block
 * marked HORIZON:
 *  - Cox & Munk (1954) glitter: the Blinn lobe's gloss follows the
 *    wind-driven slope variance (shiny uniform), not a fixed 100
 *  - Monahan & O'Muircheartaigh (1980) whitecaps: coverage
 *    W = 3.84e-6 U^3.41 drives a noise-thresholded foam mask
 *  - McCowan surf: waves break where H > 0.78 d against the REAL
 *    terrarium bathymetry (depth texture), foam along the shallows
 *  - deterministic time uniform (the caller advances it, exactly like
 *    the classic `time` uniform - also what makes A/B tests exact)
 *  - the shared aerial-perspective + Koschmieder hook applies as the
 *    material's outputNode
 */

export class HorizonWaterMesh extends Mesh {
  constructor(geometry, options) {
    const material = new NodeMaterial();
    super(geometry, material);
    this.isWaterMesh = true;
    this.resolutionScale =
      options.resolutionScale !== undefined ? options.resolutionScale : 0.5;

    this.waterNormals = texture(options.waterNormals);
    this.alpha = uniform(options.alpha !== undefined ? options.alpha : 1.0);
    this.size = uniform(options.size !== undefined ? options.size : 1.0);
    this.sunColor = uniform(new Color(options.sunColor ?? 0xffffff));
    this.sunDirection = uniform(
      options.sunDirection !== undefined
        ? options.sunDirection
        : new Vector3(0.70707, 0.70707, 0.0)
    );
    this.waterColor = uniform(new Color(options.waterColor ?? 0x7f7f7f));
    this.distortionScale = uniform(
      options.distortionScale !== undefined ? options.distortionScale : 20.0
    );

    // HORIZON uniforms (same names/semantics as the classic patch).
    this.timeU = uniform(0);
    this.shiny = uniform(200);
    this.whitecapW = uniform(0);
    this.windDirW = uniform(new Vector2(1, 0));
    this.hsWave = uniform(0.5);
    this.worldSize = uniform(options.worldSize ?? 280);
    const depthTexNode = texture(options.depthTex);
    this.depthTexNode = depthTexNode; // swap via .value on rebuild

    // TSL (WaterMesh recipe, with the deterministic time uniform)
    const getNoise = Fn(([uv]) => {
      const offset = this.timeU;
      const uv0 = add(
        div(uv, 103),
        vec2(div(offset, 17), div(offset, 29))
      ).toVar();
      const uv1 = div(uv, 107)
        .sub(vec2(div(offset, -19), div(offset, 31)))
        .toVar();
      const uv2 = add(
        div(uv, vec2(8907.0, 9803.0)),
        vec2(div(offset, 101), div(offset, 97))
      ).toVar();
      const uv3 = sub(
        div(uv, vec2(1091.0, 1027.0)),
        vec2(div(offset, 109), div(offset, -113))
      ).toVar();
      const noise = this.waterNormals
        .sample(uv0)
        .add(this.waterNormals.sample(uv1))
        .add(this.waterNormals.sample(uv2))
        .add(this.waterNormals.sample(uv3));
      return noise.mul(0.5).sub(1);
    });

    const noise = getNoise(positionWorld.xz.mul(this.size));
    // HORIZON: classic Water.js scales the swizzled noise by
    // vec3(1.5, 1.0, 1.5) BEFORE normalizing - the anisotropy is the
    // wave slope. Upstream WaterMesh.js writes `.mul(1.5, 1.0, 1.5)`,
    // but TSL mul() chains extra args as scalar factors (x2.25
    // uniformly), which normalize() cancels - flattening the sea.
    // A/B against the GLSL reference caught it; keep the vec3.
    const surfaceNormal = normalize(noise.xzy.mul(vec3(1.5, 1.0, 1.5)));

    const worldToEye = cameraPosition.sub(positionWorld);
    const eyeDirection = normalize(worldToEye);

    const reflection = normalize(
      reflect(this.sunDirection.negate(), surfaceNormal)
    );
    const direction = max(0.0, dot(eyeDirection, reflection));
    // HORIZON: Cox-Munk-driven Blinn lobe - gloss and its energy
    // follow the wind (classic patch: pow(dir, shiny)*(shiny*0.02+0.5)).
    const specularLight = pow(direction, this.shiny)
      .mul(this.shiny.mul(0.02).add(0.5))
      .mul(this.sunColor);
    const diffuseLight = max(dot(this.sunDirection, surfaceNormal), 0.0)
      .mul(this.sunColor)
      .mul(0.5);

    const distance = length(worldToEye);
    const distortion = surfaceNormal.xz
      .mul(float(0.001).add(float(1.0).div(distance)))
      .mul(this.distortionScale);

    material.transparent = true;
    material.opacityNode = this.alpha;
    material.receivedShadowPositionNode = positionWorld.add(distortion);

    material.colorNode = Fn(() => {
      const mirrorSampler = reflector();
      // HORIZON: the classic pipeline adds the distortion in the
      // mirror RT's bottom-origin uv space; reflector()'s uv is
      // top-origin, so the same vector must displace with V negated
      // or the reflection warps the opposite way at content edges
      // (pinned by an A/B that only diverged at the reflection of a
      // box's waterline until this flip).
      mirrorSampler.uvNode = mirrorSampler.uvNode.add(
        distortion.mul(vec2(1, -1))
      );
      mirrorSampler.reflector.resolutionScale = this.resolutionScale;
      this.add(mirrorSampler.target);

      const theta = max(dot(eyeDirection, surfaceNormal), 0.0);
      const rf0 = float(0.02);
      const reflectance = mul(
        pow(float(1.0).sub(theta), 5.0),
        float(1.0).sub(rf0)
      ).add(rf0);
      const scatter = max(0.0, dot(surfaceNormal, eyeDirection)).mul(
        this.waterColor
      );
      const albedo = mix(
        this.sunColor.mul(diffuseLight).mul(0.3).add(scatter),
        mirrorSampler.rgb.add(specularLight),
        reflectance
      );

      // HORIZON: Monahan whitecaps + McCowan surf on the real
      // bathymetry (same math as the classic string patch; the shoal
      // ramp is written as oneMinus of an ordered smoothstep because
      // reversed-edge smoothstep is undefined per spec).
      const capN = this.waterNormals.sample(
        positionWorld.xz.mul(0.02).add(this.windDirW.mul(this.timeU.mul(0.012)))
      ).g;
      const capMask = smoothstep(
        this.whitecapW.oneMinus().sub(0.04),
        this.whitecapW.oneMinus().add(0.02),
        capN
      );
      const dpt = depthTexNode
        .sample(positionWorld.xz.div(this.worldSize).add(0.5))
        .r.mul(40.0);
      const db = this.hsWave.div(0.78);
      const shoal = smoothstep(db.mul(0.6), db.mul(2.4), dpt)
        .oneMinus()
        .mul(smoothstep(0.012, 0.05, dpt));
      const surfN = this.waterNormals.sample(
        positionWorld.xz.mul(0.05).add(this.windDirW.mul(this.timeU.mul(0.03)))
      ).b;
      const surf = shoal.mul(smoothstep(0.35, 0.7, surfN.add(shoal.mul(0.25))));
      const foam = vec3(0.82, 0.86, 0.88).mul(
        max(this.sunDirection.y, 0.0).add(0.3)
      );
      return mix(
        albedo,
        foam,
        clamp(capMask.mul(0.9).add(surf.mul(0.85)), 0.0, 1.0)
      );
    })();
  }
}
