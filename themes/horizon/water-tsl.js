import {Color, Mesh, NodeMaterial, Vector2, Vector3} from 'three/webgpu';
import {
  Fn,
  cameraPosition,
  clamp,
  cross,
  dot,
  float,
  fwidth,
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
    // Sub-grid slope variance (total wind mss minus what the
    // cascades resolve); the per-pixel effective mss adds back the
    // variance of whatever the pixel footprint filters out.
    this.mssSubgrid = uniform(0.01);
    this.foamJ = uniform(0.4745); // folding threshold, see header
    this.foamW = uniform(0); // Monahan mean coverage, far-field foam
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
      invL: 1 / c.patchSize,
      mss: c.mssUniform,
      mapSize: c.mapSize
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
    //
    // Wave FILTERING (slope-variance-preserving minification,
    // Bruneton, Neyret & Holzschuch 2010): the maps have no mip
    // chain, so each cascade's contribution fades with its MEASURED
    // per-pixel minification (fwidth of the map uv in texels - what
    // a mip LOD would measure), and the faded-out slope variance
    // moves into the Blinn lobe below. Scaling Gaussian slopes by f
    // scales their variance by f^2, so mssEff = mssSubgrid +
    // sum (1 - f_c^2) mss_c preserves TOTAL slope variance at every
    // distance - the sea keeps its roughness as detail leaves the
    // pixel; it just stops aliasing.
    const fragXZ = vertexStage(baseXZm);
    let sumSx = float(0);
    let sumSz = float(0);
    let sumJxx = float(0);
    let sumJzz = float(0);
    let sumJxz = float(0);
    let mssEff = this.mssSubgrid;
    let fFine = float(1); // finest cascade's fade, for the foam
    for (const {disp, deriv, invL, mss, mapSize} of cascadeNodes) {
      const uvC = fragXZ.mul(invL);
      const texPerPix = length(fwidth(uvC.mul(mapSize)));
      const f = smoothstep(4.0, 1.0, texPerPix);
      fFine = f;
      const d4 = deriv.sample(uvC);
      sumSx = sumSx.add(d4.x.mul(f));
      sumSz = sumSz.add(d4.y.mul(f));
      sumJxx = sumJxx.add(d4.z.mul(f));
      sumJzz = sumJzz.add(d4.w.mul(f));
      sumJxz = sumJxz.add(disp.sample(uvC).w.mul(f));
      mssEff = mssEff.add(float(1).sub(f.mul(f)).mul(mss));
    }
    const tanX = vec3(float(1).add(sumJxx), sumSx, sumJxz);
    const tanZ = vec3(sumJxz, sumSz, float(1).add(sumJzz));
    const surfaceNormal = normalize(cross(tanZ, tanX));
    const jacobian = float(1)
      .add(sumJxx)
      .mul(float(1).add(sumJzz))
      .sub(sumJxz.mul(sumJxz));
    // Cox-Munk Blinn lobe from the per-pixel EFFECTIVE variance.
    const shiny = max(float(2).div(max(mssEff, 1e-4)).sub(2), 30.0);

    const worldToEye = cameraPosition.sub(positionWorld);
    const eyeDirection = normalize(worldToEye);

    const reflection = normalize(
      reflect(this.sunDirection.negate(), surfaceNormal)
    );
    const direction = max(0.0, dot(eyeDirection, reflection));
    // Cloud shadows (phase 5): the decks' Beer-Lambert transmittance
    // dims the DIRECT sun terms only - the sky reflection is lit by
    // the whole sky, not the sun ray.
    const sunT = options.cloudShadow
      ? options.cloudShadow.transmittance(positionWorld)
      : float(1);
    // HORIZON: Cox-Munk-driven Blinn lobe - gloss and its energy
    // follow the per-pixel effective slope variance (classic patch:
    // pow(dir, shiny)*(shiny*0.02+0.5)).
    const specularLight = pow(direction, shiny)
      .mul(shiny.mul(0.02).add(0.5))
      .mul(this.sunColor)
      .mul(sunT);
    const diffuseLight = max(dot(this.sunDirection, surfaceNormal), 0.0)
      .mul(this.sunColor)
      .mul(0.5)
      .mul(sunT);

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
      // Folding foam where resolved; where minification fades the
      // fine cascade out, converge to the Monahan MEAN coverage (the
      // same statistic the folding threshold was calibrated to) so a
      // distant gale sea keeps its aggregate whiteness.
      const capMask = mix(
        this.foamW,
        smoothstep(this.foamJ, this.foamJ.sub(0.35), jacobian),
        fFine
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
