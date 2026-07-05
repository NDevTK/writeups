import {Color, Mesh, NodeMaterial, Vector2, Vector3} from 'three/webgpu';
import {
  Fn,
  cameraPosition,
  clamp,
  cross,
  dot,
  float,
  length,
  max,
  mix,
  mul,
  normalize,
  positionGeometry,
  positionWorld,
  pow,
  reflect,
  reflector,
  smoothstep,
  texture,
  uniform,
  vec2,
  vec3,
  vertexStage
} from 'three/tsl';

/**
 * Horizon's sea as a TSL node material (WebGPU project, phase 2;
 * FFT waves phase 5).
 *
 * Forked from three r185 examples/jsm/objects/WaterMesh.js (vendored
 * unmodified alongside for provenance). The wave field is the
 * Tessendorf FFT ocean (ocean-tsl.js cascades, reference-validated):
 *  - vertex displacement (lambda-choppy Dx/Dz + h) summed over the
 *    k-space-partitioned cascades
 *  - the EXACT displaced-surface normal, built once from the summed
 *    spectral slopes and Jacobian derivatives (maps carry combinable
 *    terms; normals of a sum are not sums of normals)
 *  - whitecaps from the Jacobian folding criterion (Tessendorf 2001,
 *    J < Jt), with Jt = 0.4745 calibrated so coverage matches
 *    Monahan & O'Muircheartaigh (1980) W = 3.84e-6 U^3.41 at
 *    U = 12 m/s (ocean-reference.mjs prints the percentile) - at
 *    every other wind, coverage follows from the physics
 *  - Cox & Munk (1954) glitter: the Blinn lobe's gloss follows the
 *    RESIDUAL slope variance - total wind mss minus what the FFT
 *    cascades resolve (Bruneton, Neyret & Holzschuch 2010) - via the
 *    shiny uniform the theme computes
 *  - McCowan surf: waves break where H > 0.78 d against the REAL
 *    terrarium bathymetry (depth texture), foam along the shallows
 *  - deterministic time uniforms (the caller advances them - also
 *    what makes A/B tests exact)
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
    this.foamJ = uniform(0.4745); // folding threshold, see header
    this.windDirW = uniform(new Vector2(1, 0));
    this.hsWave = uniform(0.5);
    this.worldSize = uniform(options.worldSize ?? 280);
    const depthTexNode = texture(options.depthTex);
    this.depthTexNode = depthTexNode; // swap via .value on rebuild

    // ---------- FFT ocean cascades (phase 5) ----------
    // The plane is rotated x = -pi/2: local (x, y) -> world (x, -y),
    // world up -> local +z. Sampling uses the UNDISPLACED surface
    // parameter, carried to the fragment stage as a varying so the
    // horizontal chop does not re-parameterise the maps.
    const {cascades, metersPerUnit} = options.ocean;
    const mpu = metersPerUnit;
    const baseXZm = vec2(positionGeometry.x, positionGeometry.y.negate()).mul(
      mpu
    );
    const cascadeNodes = cascades.map((c) => ({
      disp: texture(c.displacementTex),
      deriv: texture(c.derivTex),
      invL: 1 / c.patchSize
    }));

    // Vertex displacement: world (Dx, h, Dz) metres -> local
    // (Dx, -Dz, h) scene units.
    const dispSum = cascadeNodes
      .map(({disp, invL}) => disp.sample(baseXZm.mul(invL)).xyz)
      .reduce((acc, d) => acc.add(d));
    material.positionNode = positionGeometry.add(
      vec3(dispSum.x, dispSum.z.negate(), dispSum.y).div(mpu)
    );

    // Fragment: sum the combinable spectral terms across cascades,
    // then build the exact displaced-surface normal and the folding
    // Jacobian ONCE from the totals.
    const fragXZ = vertexStage(baseXZm);
    let sumSx = float(0);
    let sumSz = float(0);
    let sumJxx = float(0);
    let sumJzz = float(0);
    let sumJxz = float(0);
    for (const {disp, deriv, invL} of cascadeNodes) {
      const uvC = fragXZ.mul(invL);
      const d4 = deriv.sample(uvC);
      sumSx = sumSx.add(d4.x);
      sumSz = sumSz.add(d4.y);
      sumJxx = sumJxx.add(d4.z);
      sumJzz = sumJzz.add(d4.w);
      sumJxz = sumJxz.add(disp.sample(uvC).w);
    }
    const tanX = vec3(float(1).add(sumJxx), sumSx, sumJxz);
    const tanZ = vec3(sumJxz, sumSz, float(1).add(sumJzz));
    const surfaceNormal = normalize(cross(tanZ, tanX));
    const jacobian = float(1)
      .add(sumJxx)
      .mul(float(1).add(sumJzz))
      .sub(sumJxz.mul(sumJxz));

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

      // HORIZON: whitecaps from the Jacobian folding criterion
      // (Tessendorf 2001) - foam where the horizontal displacement
      // folds the surface (J below the Monahan-calibrated threshold)
      // - plus McCowan surf on the real bathymetry (the shoal ramp
      // is written as oneMinus of an ordered smoothstep because
      // reversed-edge smoothstep is undefined per spec).
      const capMask = smoothstep(this.foamJ, this.foamJ.sub(0.35), jacobian);
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
