import {
  Color,
  DataTexture,
  FloatType,
  LinearFilter,
  Mesh,
  NodeMaterial,
  RGBAFormat,
  Vector3,
  Vector4
} from 'three/webgpu';
import {
  Fn,
  acos,
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
  reflector,
  abs,
  exp,
  smoothstep,
  texture,
  uniform,
  vec2,
  vec3,
  vertexStage
} from 'three/tsl';
import {buildSurfLUT} from './surf.js';
import {foamRGB} from './whitecap.js';

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
 *    it) - at every other wind, coverage follows from the physics.
 *    What that coverage PAINTS is printed too (whitecap.js,
 *    gated): Dierssen 2019 Eq. (7)'s spectral foam at Koepke
 *    1984's effective 22%, mixed by Dierssen Eq. (12) with EXACT
 *    area weights - the last hand foam colour is retired
 *  - Cox & Munk (1954) glitter, the PRINTED law (ocean-glint.js,
 *    gated): radiance = E_beam x P(slope)/(4 cos_v cos^4_tilt) at
 *    the RESIDUAL slope variance - total wind mss minus what the
 *    FFT cascades resolve (Bruneton, Neyret & Holzschuch 2010)
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
    // Polarized-sky mirror factor (rayleighpol.js stage 2, the
    // IPRT-gated doubling engine composed with coxmunk.js's
    // Fresnel split): an RGBA f-LUT over (relative azimuth
    // 0..180 deg across, incidence 0..88 deg down), identity
    // until the worker's first bake lands. skyPolOn ramps with
    // sun altitude and gates the whole fold; the page writes
    // texels in place and flips needsUpdate.
    {
      const polData = new Float32Array(19 * 16 * 4).fill(1);
      this.skyPolTex = new DataTexture(polData, 19, 16, RGBAFormat, FloatType);
      this.skyPolTex.magFilter = LinearFilter;
      this.skyPolTex.minFilter = LinearFilter;
      this.skyPolTex.needsUpdate = true;
    }
    this.skyPolOn = uniform(0);
    // Kelvin wakes (kelvin.js, gated): up to 8 vessels, fed per
    // frame from live AIS. Per slot two vec4s in SCENE units:
    //  A = (x, z, dirX, dirZ)   position + unit track direction
    //  B = (tan(alpha), halfBeamU, sternOffU, gain)
    // alpha is the Havelock/Kelvin wedge half-angle computed on
    // the CPU from the vessel's measured SOG and the bathymetry's
    // own depth at its position (deep 19.47 deg, widening toward
    // the critical depth Froude number, Mach cone beyond). gain 0
    // disables a slot (and an anchored ship's SOG-driven gain is
    // 0 by itself). The GEOMETRY is the gated physics; the arm
    // brightness profile below is display furniture like the
    // hulls (amplitude needs hull shape - wave-resistance theory,
    // out of scope), with the along-arm fade using the classical
    // stationary-phase caustic exponent r^(-1/3).
    this.wakeA = [];
    this.wakeB = [];
    for (let i = 0; i < 8; i++) {
      this.wakeA.push(uniform(new Vector4(0, 0, 0, 1)));
      this.wakeB.push(uniform(new Vector4(0.352, 0.1, 0, 0)));
    }
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
    // moves into the glitter lobe below. Scaling Gaussian slopes by f
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
    const worldToEye = cameraPosition.sub(positionWorld);
    const eyeDirection = normalize(worldToEye);

    // Cloud shadows (phase 5): the decks' Beer-Lambert transmittance
    // dims the DIRECT sun terms only - the sky reflection is lit by
    // the whole sky, not the sun ray.
    const sunT = options.cloudShadow
      ? options.cloudShadow.transmittance(positionWorld)
      : float(1);
    // The sun glitter, the PRINTED Cox & Munk (1954) law (ocean-glint
    // .js, gated: PDF normalisation and variance exact, hemisphere
    // energy conserved against the surface flux): radiance = E_beam
    // x P(slope) / (4 cos_v cos^4_tilt), with the Gaussian slope PDF
    // at the per-pixel EFFECTIVE variance (Bruneton 2010's filter
    // split - resolved waves tilt the frame, mssEff is the subgrid
    // remainder). The facet is the half-vector; its Fresnel lives in
    // the Schlick term that already weights the whole mirror +
    // specular branch below (stated: rhoF at the macro normal
    // approximates rhoF at the facet, exact in the glitter core).
    // sunColor is the beam through the physical scene-light frame.
    // RETIRED: the classic three.js Water energy patch pow(dir,
    // shiny) x (0.02 shiny + 0.5) - variance-driven exponent,
    // uncited display energy.
    const halfV = normalize(eyeDirection.add(this.sunDirection));
    const cosTilt = clamp(dot(halfV, surfaceNormal), 1e-3, 1.0);
    const cosV = max(dot(eyeDirection, surfaceNormal), 1e-3);
    const mssC = max(mssEff, 1e-4);
    const tan2 = float(1).sub(cosTilt.mul(cosTilt)).div(cosTilt.mul(cosTilt));
    const slopeP = exp(tan2.negate().div(mssC)).div(mssC.mul(Math.PI));
    const specularLight = slopeP
      .div(cosV.mul(cosTilt.mul(cosTilt).mul(cosTilt).mul(cosTilt)).mul(4.0))
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
      // The polarized sky in the mirror (rayleighpol.js stage 2):
      // the sky is partially polarized and Fresnel splits Rs/Rp,
      // so the mirrored dome differs from the scalar prediction by
      // f = 1 + [(Rp-Rs)/(Rp+Rs)] (Q/I) - dimmest at 90 deg from
      // the sun through the Brewster band, brighter toward and
      // away (the photographers' azimuth). Looked up on the MACRO
      // water plane (wave tilt is second-order here - stated):
      // theta_i from the view drop, relative azimuth between the
      // look and the sun. Grazing incidence forces f -> 1 (Rs =
      // Rp), which also guards the waterline reflections of
      // terrain and hulls - only high-sky mirror pixels move. The
      // factor multiplies the MIRROR alone: the glitter is direct
      // UNPOLARIZED sunlight, already carried by the scalar
      // Fresnel weight. Epsilons keep the azimuths defined at sun
      // zenith / view nadir, where the LUT is flat anyway.
      const cosI = clamp(eyeDirection.y, 0.0, 1.0);
      const hV = normalize(
        vec2(eyeDirection.x, eyeDirection.z).negate().add(vec2(1e-5, 0))
      );
      const hS = normalize(
        vec2(this.sunDirection.x, this.sunDirection.z).add(vec2(1e-5, 0))
      );
      const dazT = acos(clamp(dot(hV, hS), -1.0, 1.0)).div(Math.PI);
      const thT = clamp(acos(cosI).mul(180 / Math.PI / 88), 0.0, 1.0);
      const polF = mix(
        vec3(1),
        texture(
          this.skyPolTex,
          vec2(dazT.mul(18 / 19).add(0.5 / 19), thT.mul(15 / 16).add(0.5 / 16))
        ).rgb,
        this.skyPolOn
      );
      const albedo = mix(
        this.sunColor.mul(diffuseLight).mul(0.3).add(scatter),
        mirrorSampler.rgb.mul(polF).add(specularLight),
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
      // Kelvin wakes: for each fed vessel, the wedge of half-angle
      // alpha (kelvin.js - the gated Havelock/Kelvin geometry)
      // opens astern of the hull. Two foam sources per ship, both
      // display-scaled like the hulls themselves: the divergent-
      // wave ARMS along the wedge boundary (fading with the
      // classical stationary-phase caustic exponent, (s0/s)^(1/3))
      // and the turbulent CENTRELINE streak of beam width. The
      // individual transverse crests (~25 m at 12 kt) sit under
      // the display's resolvable angle at wallpaper distances -
      // drawing them would alias (the veglod argument), so the
      // envelope is what renders.
      let wake = float(0);
      for (let i = 0; i < 8; i++) {
        const A = this.wakeA[i];
        const B = this.wakeB[i];
        const rel = positionWorld.xz.sub(A.xy);
        const d = A.zw;
        const sBack = rel.x.mul(d.x).add(rel.y.mul(d.y)).negate();
        const q = abs(rel.x.mul(d.y).sub(rel.y.mul(d.x)));
        const sEff = sBack.sub(B.z).max(0.0);
        const behind = smoothstep(0.0, 0.05, sBack.sub(B.z));
        const halfW = sEff.mul(B.x).add(B.y);
        // Arm band: thickness one beam plus a slow display spread.
        const armW = B.y.add(sEff.mul(0.02)).max(1e-4);
        const arm = exp(q.sub(halfW).div(armW).pow(2).negate());
        const ctr = exp(q.div(B.y.mul(1.4).max(1e-4)).pow(2).negate());
        const s0 = float(1.5);
        const decay = pow(s0.div(sEff.add(s0)), 1.0 / 3.0);
        // Display end-fade at ~2.5 km so far wakes leave the
        // uniform budget cleanly (the caustic decay alone never
        // quite reaches zero).
        const endFade = smoothstep(44.0, 30.0, sEff);
        wake = wake.add(
          behind
            .mul(decay)
            .mul(endFade)
            .mul(arm.mul(0.65).add(ctr.mul(0.5)))
            .mul(B.w)
        );
      }
      // The foam's PRINTED optics (whitecap.js, gated): Dierssen
      // 2019 Eq. (7)'s spectral shape at the theme's channels,
      // pinned to Koepke 1984's time-averaged effective 22% -
      // the operational level defined on exactly the photographic
      // whitecap area the Monahan-calibrated mask marks. The old
      // hand vec3(0.82, 0.86, 0.88) stood ~4x this level and
      // retires. The daylight envelope (direct-sun elevation +
      // 0.3 ambient floor) is the material's documented display
      // shading, unchanged.
      const fRGB = foamRGB();
      const foam = vec3(fRGB[0], fRGB[1], fRGB[2]).mul(
        max(this.sunDirection.y, 0.0).add(0.3)
      );
      // Dierssen Eq. (12) / Gordon 1997: Rt = A Rf + (1-A) Rw -
      // the mixed pixel with its area weights EXACT. The old 0.9
      // and 0.85 dilution factors undercut the Monahan-calibrated
      // coverage and the Battjes-Janssen Qb by exactly that much;
      // both retire so mean foam radiance is W x Rf by algebra.
      return mix(albedo, foam, clamp(capMask.add(surf).add(wake), 0.0, 1.0));
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
