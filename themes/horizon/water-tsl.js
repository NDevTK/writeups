import {
  Color,
  DataTexture,
  FloatType,
  LinearFilter,
  Mesh,
  NodeMaterial,
  RGBAFormat,
  Vector3
} from 'three/webgpu';
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
import {buildSurfLUT} from './surf.js';

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
 *    J < Jt): the mask is smoothstep(Jt, Jt - 0.175, J) and Jt =
 *    0.7974 is calibrated against that EXACT mask so grid-mean
 *    coverage matches Monahan & O'Muircheartaigh (1980)
 *    W = 3.84e-6 U^3.41 at U = 12 m/s (ocean-reference.mjs bisects
 *    it) - at every other wind, coverage follows from the physics
 *  - Cox & Munk (1954) glitter: the Blinn lobe's gloss follows the
 *    RESIDUAL slope variance - total wind mss minus what the FFT
 *    cascades resolve (Bruneton, Neyret & Holzschuch 2010) - via the
 *    shiny uniform the theme computes
 *  - Battjes & Janssen (1978) surf on the REAL terrarium bathymetry:
 *    setSurf(hs, tp, depthRef) bakes a double-precision depth LUT
 *    (surf.js - Miche cap, Battjes & Stive 1985 gamma, linear
 *    shoaling, the implicit Qb equation) and the shader places that
 *    breaking fraction on the ACTUAL FFT crests: foam where the
 *    resolved elevation exceeds z(d) sigma (probit channel), so
 *    coverage is exactly Qb and the surf rides the waves that break
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

    // HORIZON uniforms.
    // Sub-grid slope variance (total wind mss minus what the
    // cascades resolve); the per-pixel effective mss adds back the
    // variance of whatever the pixel footprint filters out.
    this.mssSubgrid = uniform(0.01);
    this.foamJ = uniform(0.7974); // folding threshold, see header
    this.foamW = uniform(0); // Monahan mean coverage, far-field foam
    this.hsWave = uniform(0.5);
    // Measured sea level vs MSL (m): tides + surge. The bathymetry
    // texture stores SIGNED depth vs MSL, so adding the tide before
    // the bed clamp gives the TRUE local water depth - the surf
    // breakpoint (Battjes-Janssen samples this) migrates with the
    // tide exactly as depth-limited breaking demands.
    this.tide = uniform(0);
    this.worldSize = uniform(options.worldSize ?? 280);
    const depthTexNode = texture(options.depthTex);
    this.depthTexNode = depthTexNode; // swap via .value on rebuild

    // Battjes-Janssen surf LUT over depth (see setSurf below):
    // R = Qb, G = crest threshold z in units of sigma = Hs/4.
    this._surfData = new Float32Array(256 * 4);
    for (let i = 0; i < 256; i++) this._surfData[i * 4 + 1] = 4; // off
    const surfTex = new DataTexture(
      this._surfData,
      256,
      1,
      RGBAFormat,
      FloatType
    );
    surfTex.minFilter = surfTex.magFilter = LinearFilter;
    surfTex.needsUpdate = true;
    this._surfTex = surfTex;
    this._surfKey = '';
    const surfTexNode = texture(surfTex);

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
    let sumEta = float(0); // resolved elevation (m), for the surf crests
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
      const dc = disp.sample(uvC);
      sumJxz = sumJxz.add(dc.w.mul(f));
      sumEta = sumEta.add(dc.y.mul(f));
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
      // - plus Battjes-Janssen surf on the real bathymetry.
      // Folding foam where resolved; where minification fades the
      // fine cascade out, converge to the Monahan MEAN coverage (the
      // same statistic the folding threshold was calibrated to) so a
      // distant gale sea keeps its aggregate whiteness.
      const capMask = mix(
        this.foamW,
        smoothstep(this.foamJ, this.foamJ.sub(0.175), jacobian),
        fFine
      );
      const dpt = depthTexNode
        .sample(positionWorld.xz.div(this.worldSize).add(0.5))
        .r.mul(40.0)
        .add(this.tide)
        .max(0.0);
      // Depth-induced breaking (Battjes & Janssen 1978): the LUT's
      // probit channel is the crest threshold in sigma = Hs/4 units;
      // foam where the resolved FFT elevation tops it, so coverage
      // is EXACTLY the breaking fraction Qb(depth) and the surf sits
      // on the crests that break. The narrow transition band around
      // the threshold is symmetric, preserving coverage to first
      // order; the shoreline guard keeps foam off the beach edge
      // texels.
      const sigma = this.hsWave.mul(0.25).max(1e-3);
      const zThr = surfTexNode.sample(vec2(dpt.div(40.0), 0.5)).g.mul(sigma);
      const wS = sigma.mul(0.15).max(0.02);
      const surf = smoothstep(zThr.sub(wS), zThr.add(wS), sumEta).mul(
        smoothstep(0.012, 0.05, dpt)
      );
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

  // Bake the Battjes-Janssen depth profile for the current sea state
  // (hs = total significant height m, tp = peak period s, depthRef =
  // the depth hs is referenced at - the spectrum's TMA depth). Cheap
  // (256 Newton solves) but gated so per-frame calls only rebuild
  // when the state actually moved.
  setSurf(hs, tp, depthRef) {
    const key = hs.toFixed(3) + '|' + tp.toFixed(2) + '|' + depthRef.toFixed(1);
    if (key === this._surfKey) return;
    this._surfKey = key;
    this._surfData.set(buildSurfLUT({hs, tp, depthRef}));
    this._surfTex.needsUpdate = true;
  }
}
