import {
  NoBlending,
  BackSide,
  DataTexture,
  QuadMesh,
  HalfFloatType,
  FloatType,
  LinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  RenderTarget,
  RGBAFormat,
  SphereGeometry,
  StorageTexture,
  Vector2,
  Vector3
} from 'three/webgpu';
import {
  Fn,
  If,
  Loop,
  abs,
  asin,
  asinh,
  atan,
  clamp,
  cos,
  cross,
  dot,
  exp,
  float,
  fwidth,
  instanceIndex,
  int,
  ivec2,
  max,
  min,
  mix,
  normalize,
  positionLocal,
  pow,
  select,
  sin,
  smoothstep,
  sqrt,
  texture,
  textureStore,
  uniform,
  uv,
  vec2,
  vec3,
  vec4
} from 'three/tsl';
import {spectralNode} from './spectral-srgb.js';
import {sunAngularRadiusRad} from './eclipses.js';
import {sunTransmittanceJS} from './sun-transmittance.js';

// The display projection for the three spectral lines (680/550/440
// nm CIE-weighted into linear sRGB, equal radiance -> D65; see
// spectral-srgb.js). Applied at the DISPLAY ends only - the dome's
// final colour and the skyRadiance export - so every LUT texel keeps
// its reference-pinned spectral value.
const spectral = spectralNode({vec3, dot, max});

/**
 * TSL port of the Hillaire (2020) multiple-scattering atmosphere
 * (WebGPU project, phase 2). Same math, same LUT sizes and Bruneton
 * parameterisation as the GLSL version this replaces:
 *  - transmittance LUT 256x64, built once (40-step optical depth)
 *  - multiple-scattering LUT 32x32: 64 spherical-Fibonacci directions,
 *    20-step marches, ground bounce, Psi_ms = L2 / (1 - f_ms)
 *  - sky-view LUT 384x108 per frame (32 steps, sqrt-warped elevation
 *    split at the true horizon; full SIGNED azimuth circle)
 *  - aerial-perspective LUT 128x32 (SIGNED relative azimuth over the
 *    full circle x distance, 20 steps) for the per-material fog hook
 *  - BOTH per-frame marches carry Hillaire's volumetric shadow: the
 *    DIRECT single-scatter term is multiplied per step by the cloud
 *    shadow map's Beer-Lambert transmittance at the marched point
 *    (crepuscular rays in the sky AND in the terrain haze; multiple
 *    scattering stays unshadowed). The full circles exist BECAUSE
 *    of the shadow - clouds are not azimuthally symmetric; the
 *    seams sit at the anti-sun azimuth where in-scatter varies
 *    slowest. Shadow samples map to the scene through the exact
 *    asinh altitude datum, so rays above the decks read full sun.
 *  - 1x1 cosine-weighted sky irradiance for the hemisphere ambient
 *    (read back asynchronously - no pipeline stall)
 *  - the dome samples the sky-view LUT and adds the sun disc through
 *    the transmittance LUT
 *
 * The LUT builders are coordinate-parameterised Fns - the single
 * definition of the physics - each dispatched as a compute kernel
 * writing a StorageTexture (probe: store-y == sample-v ==
 * readback-row, filtered sampling works inside kernels). WebGPU-only
 * build: the QuadMesh render-target drivers were deleted with the
 * WebGL2 backend.
 */

const RB = 6360e3;
const RT = 6460e3;
const MAX_DIST_M = 25700; // 450 scene units at 57.14 m/unit
const SCENE_PER_M = 7 / 400; // roam.js MPU inverted (exact)
const SKY_H = 108; // sky-view LUT rows; the guarded split needs it

// `cloudShadow` (optional) is the theme's cloud shadow hook
// (clouds-tsl.js createCloudShadowHook): its Beer-Lambert
// transmittance(worldPos) shadows the aerial march's direct term.
export function createAtmosphereTSL(renderer, cloudShadow) {
  // Mie radiative properties as uniforms (aerosol.js): per-channel
  // scattering and absorption coefficients at profile h = 0 (1/m)
  // and the phase asymmetry. Defaults are Hillaire (2020)'s exact
  // constants (scattering 3.996e-6, extinction 4.440e-6 = sigma_s
  // / 0.9, g 0.8); with a live /aerosol answer the theme sets the
  // MEASURED GEFS-Aerosols channel set instead (the gated
  // aerosol-reference.mjs proves the measured path degenerates to
  // these defaults for paper-standard air).
  const mieScat = uniform(new Vector3(3.996e-6, 3.996e-6, 3.996e-6));
  const mieAbs = uniform(new Vector3(4.44e-7, 4.44e-7, 4.44e-7));
  // Delta similarity (aureole.js, gated by aureole-reference.mjs):
  // fDiff is the per-channel fraction of the Mie SCATTERING carried
  // by the coarse-mode diffraction spike (dust MITR + sea-salt
  // SSCM through their printed 1/Q shares); gPrime is the smooth
  // remainder's asymmetry with f g_spike + (1 - f) g' = g held
  // exactly on the CPU. Every march below runs the SCALED system
  // (Joseph, Wiscombe & Weinman 1976): scattering (1-f) sigma_s,
  // extinction sigma_e - f sigma_s, phase CS(g') - and the spike
  // itself is drawn per pixel on the dome at first scattering
  // order, where the sky-view LUT could never resolve it (the same
  // resolution argument Hillaire 2020 uses to composite the sun
  // disc after the LUT). f = 0 - no measured coarse aerosol -
  // collapses every scaled relation to identity: the pre-aureole
  // system, bit for bit (the existing GPU probes run exactly
  // there).
  const fDiff = uniform(new Vector3(0, 0, 0));
  const gPrime = uniform(new Vector3(0.8, 0.8, 0.8));
  // cos of the drawn-cone half angle; 2 disables the branch (no
  // direction has cos > 1). aureole.js computes the cone as the
  // angle where the spike falls under 1% of the full smooth source.
  const spikeCosCone = uniform(2);
  const spikeThetaMax = uniform(0.5236);
  const SPIKE_N = 256;
  const spikeTex = new DataTexture(
    new Float32Array(SPIKE_N * 4),
    SPIKE_N,
    1,
    RGBAFormat,
    FloatType
  );
  spikeTex.magFilter = LinearFilter;
  spikeTex.minFilter = LinearFilter;
  spikeTex.needsUpdate = true;
  const spikeNode = texture(spikeTex);
  // The cirrus diffraction corona (cloud-corona.js, gated by
  // cloud-corona-reference.mjs): the monodisperse Airy pattern of
  // the measured corona-cirrus crystals (Sassen et al. 1998's
  // printed 22 um), source-disc convolved on the CPU, drawn per
  // pixel at first scattering order like the aureole spike - the
  // sky-view LUT can resolve neither. corAmp carries the whole
  // slab radiometry (tau/2) e^-tau computed from the measured
  // veil column; 0 - warm cirrus, no cover, or no measurement -
  // never runs the branch (corCosCone 2 disables it outright).
  const corAmp = uniform(0);
  const corCosCone = uniform(2);
  const corThetaMax = uniform(0.1047);
  const COR_N = 256;
  const corTex = new DataTexture(
    new Float32Array(COR_N * 4),
    COR_N,
    1,
    RGBAFormat,
    FloatType
  );
  corTex.magFilter = LinearFilter;
  corTex.minFilter = LinearFilter;
  corTex.needsUpdate = true;
  const corNode = texture(corTex);
  // The lunar corona's own set: the pattern re-convolved with the
  // MOON's live disc (flat kernel - the full-moon disc is flat,
  // the theme's own Hapke rendering says so), the amplitude in
  // E0 units through moonlight.js, anchored on the DRAWN
  // (refracted) moon direction.
  const corMoonDir = uniform(new Vector3(0, -1, 0));
  // Scalar: the printed V-band anchor serves all three channels
  // (documented convention, moonlight.js) - colour lives in the
  // per-channel pattern.
  const corMoonAmp = uniform(0);
  const corMoonCosCone = uniform(2);
  const corMoonTex = new DataTexture(
    new Float32Array(COR_N * 4),
    COR_N,
    1,
    RGBAFormat,
    FloatType
  );
  corMoonTex.magFilter = LinearFilter;
  corMoonTex.minFilter = LinearFilter;
  corMoonTex.needsUpdate = true;
  const corMoonNode = texture(corMoonTex);
  // The DECK droplet corona (cloud-corona.js buildDropletCoronaLUT):
  // the cross-section-weighted Airy ensemble of the Miles, Verlinde
  // & Clothiaux 2000 Table 3 lognormal for the measured air-mass
  // class - at the printed sigma_log 0.38 a smooth ringless aureole,
  // G&L's flat-and-wide washout. Its amplitude is assembled PER
  // FRAGMENT: the CPU feeds DROPLET_DIFF_SHARE (the van de Hulst
  // paradox half) times the veil transmittance in front of the
  // source, and the fragment multiplies the deck's own slant
  // optical depth along the VIEW ray, read from the cloud shadow
  // map (clouds-tsl tauSlant - the exact map terrain shadows ride,
  // one deck-column definition). NO e^-tau here: the volumetric
  // composite extinguishes the dome behind every deck pixel, which
  // IS the slab law's extinction leg - the reference gate holds
  // amp * e^-tau === (tau/2) e^-tau, the cirrus corona's own law
  // with the extinction carried by the compositor. Through a GAP
  // the map's tau is zero and the corona vanishes with the
  // droplets that would have drawn it; the unattached map's zero
  // texture fails the whole term closed.
  const corDropAmp = uniform(0);
  const corDropCosCone = uniform(2);
  const corDropTex = new DataTexture(
    new Float32Array(COR_N * 4),
    COR_N,
    1,
    RGBAFormat,
    FloatType
  );
  corDropTex.magFilter = LinearFilter;
  corDropTex.minFilter = LinearFilter;
  corDropTex.needsUpdate = true;
  const corDropNode = texture(corDropTex);
  // The moon's droplet set: the same ensemble convolved with the
  // MOON's flat disc, the amplitude carrying the moonlight
  // irradiance (moonlight.js) - the classic naked-eye lunar corona
  // through thin stratus. Anchored on the drawn moon direction the
  // cirrus set already carries.
  const corMoonDropAmp = uniform(0);
  const corMoonDropCosCone = uniform(2);
  const corMoonDropTex = new DataTexture(
    new Float32Array(COR_N * 4),
    COR_N,
    1,
    RGBAFormat,
    FloatType
  );
  corMoonDropTex.magFilter = LinearFilter;
  corMoonDropTex.minFilter = LinearFilter;
  corMoonDropTex.needsUpdate = true;
  const corMoonDropNode = texture(corMoonDropTex);
  // Bishop's Ring (bishop.js, gated by bishop-reference.mjs): the
  // STRATOSPHERIC diffraction corona of a volcanically loaded sky
  // - the 1888 Krakatoa Committee report's printed geometry
  // inverted through the same certified Airy machinery, its
  // amplitude the MEASURED OMPS volcanic excess over the Kremser
  // background through the (tau/2) e^-tau slab law. Its own
  // theta_max: the ring lives at 12-23 deg from the sun, not the
  // corona's 6. Background stratosphere -> amp 0, branch off
  // (cos cone 2) - today's sky draws nothing.
  const bishopAmpU = uniform(0);
  const bishopCosCone = uniform(2);
  const bishopThetaMax = uniform(0.4887);
  const bishopTex = new DataTexture(
    new Float32Array(COR_N * 4),
    COR_N,
    1,
    RGBAFormat,
    FloatType
  );
  bishopTex.magFilter = LinearFilter;
  bishopTex.minFilter = LinearFilter;
  bishopTex.needsUpdate = true;
  const bishopNode = texture(bishopTex);
  // The lunar Bishop's ring - the report's own Table II holds
  // moon rows ("a red haze round the moon all night", Thessalus);
  // same pattern with the flat lunar disc, amplitude in the
  // moonlight E0 frame. Its printed smaller apparent size ("in
  // consequence of its inferior brilliancy") emerges through the
  // theme's adaptation, not through a different pattern.
  const bishopMoonAmp = uniform(0);
  const bishopMoonCosCone = uniform(2);
  const bishopMoonTex = new DataTexture(
    new Float32Array(COR_N * 4),
    COR_N,
    1,
    RGBAFormat,
    FloatType
  );
  bishopMoonTex.magFilter = LinearFilter;
  bishopMoonTex.minFilter = LinearFilter;
  bishopMoonTex.needsUpdate = true;
  const bishopMoonNode = texture(bishopMoonTex);
  // The camera's scene-space height (asinh world y, the shadow
  // map's own frame) - with aerialCamXZ it places the fragment
  // ray's origin for the deck-column read.
  const corCamY = uniform(0);
  // The measured cirrus column over the DIRECT solar image: the
  // drawn disc (limb, spots), the totality corona riding it and
  // the sunset transfer-band disc all dim by e^-tau_slant of the
  // same Sassen & Comstock column the terrain's sunlight and the
  // cirrus corona already ride - the diffracted share of what the
  // disc loses is exactly what the corona branch re-adds (first
  // scattering order; the conservation landmark holds the pair).
  // 1 (no cirrus, and every probe page's default) is identity.
  // Grey: large-crystal extinction is flat across the visible.
  const cirrusTd = uniform(1);
  // Measured total-column ozone (ozone.js, gated): the shipped
  // ozone constants encode exactly 300 DU (Bruneton's own printed
  // construction); absorption is linear in the column, so the
  // measured GFS TOZNE scales the term everywhere as DU/300. 1
  // (the reference column) with no measurement.
  const ozScale = uniform(1);
  const sunMu = uniform(0.5);
  const camH = uniform(300);
  const exposure = uniform(28);
  // The Purkinje fold (adaptation.js scotopicY mirrored in TSL):
  // 1 = photopic (colour untouched), 0 = pure rod vision - the
  // dome's displayed colour lerps toward its own Eq. 13 rod
  // luminance (Rec.709 -> XYZ exact, normalised at the paper's
  // equal-energy closed point 2.31). The theme feeds the printed
  // mesopic ramp's blend each frame.
  const scotB = uniform(1);
  // Hillaire (2020) terminates ground-hitting sky-view rays with a
  // Lambertian ground bounce; the albedo is FED by the theme, not
  // painted - Payne (1972) open-ocean broadband 0.06 where the box
  // has sea, 0 otherwise (a land value needs its own citation, so
  // inland horizons keep the pure in-scatter until then).
  const groundAlb = uniform(new Vector3(0, 0, 0));
  const sunDirW = uniform(new Vector3(0, 1, 0));
  // Refraction of the drawn disc (refraction.js on the CPU): the
  // red and blue channels' own apparent directions and the shared
  // vertical flattening. Defaults draw an undispersed round disc.
  const sunDirR = uniform(new Vector3(0, 1, 0));
  const sunDirB = uniform(new Vector3(0, 1, 0));
  const sunFlat = uniform(1);
  // The drawn disc's TRUE angular radius: the IAU photospheric
  // radius over the live VSOP87 distance (eclipses.js; the theme
  // feeds it at 1 Hz), so the disc breathes the +-1.7% annual
  // swing - 976 arcsec at January perihelion, 944 at July
  // aphelion. The retired cos(0.9999893) literal was a FIXED
  // 0.2651 deg, 0.6% under the 1 au disc and blind to the swing;
  // the Hestroffer & Magnan limb law is unchanged, only its edge
  // now sits where the ephemeris puts it.
  const sunRadU = uniform(sunAngularRadiusRad());
  // Solar irradiance factor illuminating the whole column: 1
  // normally; during a solar eclipse the theme sets the uncovered
  // fraction (1 - obscuration, eclipses.js's exact lens area).
  // Every radiance this module emits - single scatter, multiple
  // scatter, ground bounce, aerial in-scatter, the 1x1 ambient
  // integral - is LINEAR in this source term (the marches never
  // depend on it nonlinearly), so one factor at the two LUT
  // outputs is exact under a uniform-sky obscuration. Documented
  // scope: the penumbra's brightness gradient across the sky near
  // totality is not modelled. The corona IS (Baumbach 1937, drawn
  // below at its true millionths-of-centre radiance) - it is what
  // remains when this factor reaches zero. The drawn DISC is
  // deliberately NOT scaled: the uncovered photosphere keeps its
  // full surface brightness and the moon disc covers it
  // geometrically.
  const sunE = uniform(1);
  // The sunset transfer LUT (refraction.js transferCurve): TRUE
  // altitude per channel indexed by APPARENT altitude across a
  // horizon band. Folds in the curve ARE the mirage images and
  // the magnified green flash - the disc membership test below
  // replaces the centre+flatten model inside the band. Fed by the
  // theme on profile/observer-height cadence (the curve is
  // sun-independent); transOn gates the whole path so high-sun
  // frames pay nothing.
  // 160 rows was tested against 320/640/.../4000 on the SF mirage
  // captures: the flash rim's sub-pixel thickness does NOT converge
  // with row count - it sits at the precision limit of the curve
  // integrator itself - and 320 measurably thinned the drawn rim.
  // The pixel-footprint quadrature below is what keeps the rim
  // continuous; the row count stays at the gate-proven value.
  const TRANS_ROWS = 160;
  const transTex = new DataTexture(
    new Float32Array(TRANS_ROWS * 4),
    TRANS_ROWS,
    1,
    RGBAFormat,
    FloatType
  );
  transTex.magFilter = LinearFilter;
  transTex.minFilter = LinearFilter;
  transTex.needsUpdate = true;
  const transNode = texture(transTex);
  // Harness-only radiometric tap (?debug float captures): 0 skips
  // the spectral display projection AND its gamut clip on the
  // dome, so a float readback carries the raw 680/550/440 nm
  // radiance - the clip is not invertible (deep-red disc pixels
  // recover B 2.38x high through clip + inversion), so honest
  // radiometry needs the pre-projection values. Display always
  // runs with 1.
  const specOn = uniform(1);
  const transA0 = uniform(-0.0105);
  const transA1 = uniform(0.0349);
  const transOn = uniform(0);
  const sunTrueAlt = uniform(0);
  // The band's own transmittance rows (same apparent-altitude axis
  // as transTex): the 2D LUT's bilinear blend across its ~100 m
  // radius rows mixes transmittances of neighbouring grazing
  // geometries - a small real channel-ratio error at the horizon
  // (0.5% R/G at 130 m, atmo-reference). These rows are the CPU
  // integral at the EXACT observer radius instead, built in
  // sunTransfer.set below on the same cadence as the curve. (The
  // 1.5x K-spread that triggered this hunt turned out to be a
  // HARNESS artifact: the display gamut clip on deep-red disc
  // pixels breaks the spectral-matrix inversion - the landmark
  // refuted the LUT hypothesis and pinned the true 0.5%.)
  const bandTTex = new DataTexture(
    new Float32Array(TRANS_ROWS * 4),
    TRANS_ROWS,
    1,
    RGBAFormat,
    FloatType
  );
  bandTTex.magFilter = LinearFilter;
  bandTTex.minFilter = LinearFilter;
  bandTTex.needsUpdate = true;
  const bandTNode = texture(bandTTex);
  // Real sunspots (sunspots.js: SWPC regions through Meeus ch. 29,
  // photometry from Mathew 2007 anchored on Maltby 1986 - see that
  // module's header for the read sources). FOUR texels per spot:
  //   A (v, h, rU, on)   B (foreshorten z, rP, 0, 0)
  //   C (umbra RGB, 0)   D (penumbra RGB, 0)
  // v/h in solar radii in the local vertical frame; tints are
  // per-spot per-channel intensity ratios to the photosphere
  // (size-dependent - a single value is "a very poor
  // approximation", Mathew 2007). Drawn in the high-sun disc path
  // only; the mirage band's folded disc is documented out of scope
  // (spots there sit under 8x magnified turbulence and extinction).
  const SPOTS_MAX = 8;
  const spotsTex = new DataTexture(
    new Float32Array(SPOTS_MAX * 4 * 4),
    SPOTS_MAX * 4,
    1,
    RGBAFormat,
    FloatType
  );
  spotsTex.magFilter = spotsTex.minFilter = LinearFilter;
  spotsTex.needsUpdate = true;
  const spotsNode = texture(spotsTex);
  let lastCurve = null;
  function fillBandT() {
    if (!lastCurve) return;
    const mie = {
      scat: mieScat.value.toArray(),
      abs: mieAbs.value.toArray(),
      ozScale: ozScale.value
    };
    const h = Math.max(camH.value, 1);
    const rObs = RB + h;
    // Rows below the straight-ray tangent keep the graze value -
    // the same clamp the 2D LUT's edge texel applied there (the
    // ducted rays those rows carry have no straight-ray
    // transmittance; the tangent ray is the limit).
    const muG = -Math.sqrt(Math.max(1 - (RB / rObs) ** 2, 0)) + 1e-9;
    const d = bandTTex.image.data;
    for (let i = 0; i < TRANS_ROWS; i++) {
      const t = sunTransmittanceJS(
        Math.max(Math.sin(lastCurve.a[i]), muG),
        mie,
        h
      );
      d[i * 4] = t[0];
      d[i * 4 + 1] = t[1];
      d[i * 4 + 2] = t[2];
      d[i * 4 + 3] = 1;
    }
    bandTTex.needsUpdate = true;
  }

  const rayleighS = vec3(5.802e-6, 13.558e-6, 33.1e-6);
  const ozoneA = vec3(0.65e-6, 1.881e-6, 0.085e-6);
  // Measured tropospheric NO2 (no2.js, gated): per-metre
  // absorption at h = 0, riding the mie boundary-layer profile
  // (d.y - the same 1200 m exponential its emissions share).
  // Zero = clean or unmeasured sky, exact identity.
  const no2A = uniform(new Vector3(0, 0, 0));

  // x: rayleigh, y: mie, z: ozone (tent at 25 km).
  const densities = Fn(([h]) =>
    vec3(
      exp(h.div(-8000)),
      exp(h.div(-1200)),
      max(0.0, float(1.0).sub(abs(h.sub(25e3)).div(15e3)))
    )
  );

  const extinction = Fn(([h]) => {
    const d = densities(h);
    return rayleighS
      .mul(d.x)
      .add(mieScat.add(mieAbs).add(no2A).mul(d.y))
      .add(ozoneA.mul(ozScale).mul(d.z));
  });

  // Distance to the sphere of radius R, or -1.
  const raySphere = Fn(([r, mu, R]) => {
    const b = r.mul(mu);
    const c = r.mul(r).sub(R.mul(R));
    const disc = b.mul(b).sub(c);
    const res = float(-1).toVar();
    If(disc.greaterThanEqual(0.0), () => {
      const s = sqrt(disc);
      const t0 = b.negate().sub(s);
      const t1 = b.negate().add(s);
      res.assign(
        select(
          t0.greaterThan(0.0),
          t0,
          select(t1.greaterThan(0.0), t1, float(-1))
        )
      );
    });
    return res;
  });

  // Bruneton's transmittance LUT parameterisation.
  const tParamsToUv = Fn(([r, mu]) => {
    const H = sqrt(RT * RT - RB * RB);
    const rho = sqrt(max(r.mul(r).sub(RB * RB), 0.0));
    const disc = r
      .mul(r)
      .mul(mu.mul(mu).sub(1.0))
      .add(RT * RT);
    const d = max(
      r
        .mul(mu)
        .negate()
        .add(sqrt(max(disc, 0.0))),
      0.0
    );
    const dMin = float(RT).sub(r);
    const dMax = rho.add(H);
    return vec2(d.sub(dMin).div(dMax.sub(dMin)), rho.div(H));
  });

  const phaseR = Fn(([c]) =>
    c
      .mul(c)
      .add(1.0)
      .mul(3.0 / (16.0 * 3.14159265))
  );
  // Henyey-Greenstein x Cornette-Shanks at the SCALED asymmetry g'
  // (per channel - the delta split's f is wavelength-dependent, so
  // the remainder's g' is too). With no measured coarse aerosol
  // gPrime carries the measured 340 nm ASYSFK (0.8 default) in all
  // channels and this is the pre-aureole phase exactly.
  const phaseM = Fn(([c]) => {
    const g2 = gPrime.mul(gPrime);
    return g2
      .oneMinus()
      .div(g2.add(2.0))
      .mul(3.0 / (8.0 * 3.14159265))
      .mul(c.mul(c).add(1.0))
      .div(pow15(g2.add(1.0).sub(gPrime.mul(c).mul(2.0))));
  });
  // x^1.5 without pow's undefined-for-negative edge (componentwise
  // - phaseM feeds it a vec3 since the split went per-channel).
  const pow15 = Fn(([x]) => {
    const m = max(x, 1e-6);
    return m.mul(sqrt(m));
  });

  // Compute kernels over storage textures (WebGPU-only build; the
  // QuadMesh render-target drivers were deleted with the WebGL2
  // backend).

  function makeTarget(w, h, type) {
    const rt = new RenderTarget(w, h, {
      type: type || HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
      stencilBuffer: false
    });
    return rt;
  }

  function makeStorage(w, h, type) {
    const t = new StorageTexture(w, h);
    t.type = type || HalfFloatType;
    t.minFilter = t.magFilter = LinearFilter;
    return t;
  }

  // {tex, w, h} per LUT.
  function makeLut(w, h, type) {
    const tex = makeStorage(w, h, type);
    return {tex, w, h};
  }

  const tLut = makeLut(256, 64);
  const msLut = makeLut(32, 32);
  // Full SIGNED azimuth circle (384 = the old 192 half-circle
  // texel pitch kept): the volumetric cloud shadow is not
  // azimuthally symmetric, so the sky-view LUT carries both sides
  // of the sun line. u = 0.5 faces the sun; the clamp seam sits at
  // the anti-sun azimuth.
  const skyLut = makeLut(384, SKY_H);
  const aerialLut = makeLut(128, 32);
  // The irradiance readback needs a RenderTarget on both backends
  // (readRenderTargetPixelsAsync is the async staging read); it is a
  // single texel - nothing for compute to win.
  const irrLut = makeTarget(1, 1, FloatType);

  const tTexNode = texture(tLut.tex);
  const msTexNode = texture(msLut.tex);
  const skyTexNode = texture(skyLut.tex);

  const sunT = Fn(([r, mu]) => tTexNode.sample(tParamsToUv(r, mu)).rgb);
  // Delta-scaled sun transmittance to a march point: true
  // Beer-Lambert times exp(+f sigma_s D_M) - the T LUT's alpha
  // carries D_M in km. At f = 0 the factor is exactly 1.
  const sunTS = Fn(([r, mu]) => {
    const s = tTexNode.sample(tParamsToUv(r, mu));
    return s.rgb.mul(exp(fDiff.mul(mieScat).mul(s.a.mul(1000.0))));
  });
  const psiMS = Fn(
    ([r, mu]) =>
      msTexNode.sample(vec2(mu.mul(0.5).add(0.5), r.sub(RB).div(RT - RB))).rgb
  );

  // ---------- transmittance (built once per aerosol change) ----------
  const transmittanceNode = Fn(([vUv]) => {
    const H = float(Math.sqrt(RT * RT - RB * RB));
    const rho = H.mul(vUv.y);
    const r = sqrt(rho.mul(rho).add(RB * RB));
    const dMin = float(RT).sub(r);
    const dMax = rho.add(H);
    const d = dMin.add(vUv.x.mul(dMax.sub(dMin)));
    const mu = clamp(
      select(
        d.equal(0.0),
        float(1.0),
        H.mul(H).sub(rho.mul(rho)).sub(d.mul(d)).div(r.mul(d).mul(2.0))
      ),
      -1.0,
      1.0
    );
    const N = 40;
    const dt = d.div(N);
    const tau = vec3(0).toVar();
    // Alpha carries the Mie reference-density column D_M = INT
    // exp(-h/1200) ds along the same path, in KILOMETRES (a graze
    // path reaches ~220 km-equivalent - metres would overflow the
    // fp16 texel). The delta-scaled transmittance is then exactly
    // T' = T exp(+f sigma_s D_M): forward-diffracted light stays
    // in the quasi-direct beam (the scaled system's own Beer law).
    const dm = float(0).toVar();
    Loop(N, ({i}) => {
      const ti = float(i).add(0.5).mul(dt);
      const h = sqrt(
        r.mul(r).add(ti.mul(ti)).add(r.mul(ti).mul(mu).mul(2.0))
      ).sub(RB);
      tau.addAssign(extinction(h).mul(dt));
      dm.addAssign(densities(h).y.mul(dt));
    });
    return vec4(exp(tau.negate()), dm.div(1000.0));
  });

  // ---------- multiple scattering (rebuilt when aerosols or the
  // fed ground albedo change) ----------
  const multiscatterNode = Fn(([vUv]) => {
    const muS = vUv.x.mul(2.0).sub(1.0);
    const r = float(RB)
      .add(vUv.y.mul(RT - RB))
      .add(1.0);
    const sunDir = vec3(sqrt(max(muS.mul(muS).oneMinus(), 0.0)), muS, 0.0);

    // Hillaire eq. 5-7: second-order luminance and the transfer
    // integrated over the sphere; Psi_ms = L2 / (1 - f_ms).
    const L2 = vec3(0).toVar();
    const fms = vec3(0).toVar();
    const DIRS = 64;
    Loop(DIRS, ({i}) => {
      // Everything derived from the OUTER counter must be materialised
      // with toVar() before the inner Loop: nested TSL Loops both name
      // their counter `i`, and un-var'd expressions are inlined into
      // the inner body where GLSL scoping makes the INNER i win
      // (verified by probe: sum test returned the shadowed value).
      const fi = float(i).add(0.5).toVar();
      const cosT = float(1.0)
        .sub(fi.mul(2.0 / DIRS))
        .toVar();
      const sinT = sqrt(max(cosT.mul(cosT).oneMinus(), 0.0)).toVar();
      const phi = fi.mul(2.399963).toVar();
      const dir = vec3(sinT.mul(cos(phi)), cosT, sinT.mul(sin(phi))).toVar();

      const mu = dir.y.toVar();
      const dGround = raySphere(r, mu, float(RB)).toVar();
      const dTop = raySphere(r, mu, float(RT)).toVar();
      const dEnd = select(dGround.greaterThan(0.0), dGround, dTop).toVar();
      const STEPS = 20;
      const dt = dEnd.div(STEPS).toVar();
      const T = vec3(1).toVar();
      const Li = vec3(0).toVar();
      const fi3 = vec3(0).toVar();
      const cSun = dot(dir, sunDir).toVar();
      Loop(STEPS, ({i: s}) => {
        const ti = float(s).add(0.5).mul(dt);
        const ri = sqrt(
          r.mul(r).add(ti.mul(ti)).add(r.mul(ti).mul(mu).mul(2.0))
        );
        const h = ri.sub(RB);
        const dens = densities(h);
        // The SCALED system (delta similarity): Mie scattering
        // keeps only the smooth remainder (1 - f) sigma_s, the
        // extinction drops the spike's share, and the sun
        // transmittance carries the spike's light in the
        // quasi-direct beam (sunTS). f = 0 is the old system.
        const scat = rayleighS
          .mul(dens.x)
          .add(mieScat.mul(fDiff.oneMinus()).mul(dens.y));
        const ext = extinction(h).sub(mieScat.mul(fDiff).mul(dens.y));
        const muSi = clamp(r.mul(muS).add(ti.mul(cSun)).div(ri), -1.0, 1.0);
        const Ts = sunTS(ri, muSi);
        const S = scat
          .mul(phaseR(cSun).add(phaseM(cSun)))
          .mul(0.5)
          .mul(Ts);
        const stepT = exp(ext.mul(dt).negate());
        const extC = max(ext, vec3(1e-9));
        Li.addAssign(T.mul(S.sub(S.mul(stepT))).div(extC));
        fi3.addAssign(T.mul(scat.sub(scat.mul(stepT))).div(extC));
        T.mulAssign(stepT);
      });
      If(dGround.greaterThan(0.0), () => {
        const muSg = clamp(
          r.mul(muS).add(dGround.mul(cSun)).div(RB),
          -1.0,
          1.0
        );
        // Ground contribution at the FED albedo - Hillaire's model
        // has ONE ground_albedo parameter shared by this LUT and
        // the sky-view terminal bounce (his reference implementation
        // defaults it to zero and exposes it as an input; the old
        // 0.3 literal here was uncited). The theme feeds Payne
        // (1972) 0.06 where the box has sea, 0 inland until a
        // measured land albedo earns its citation. Scaled sun
        // transmittance like every march term.
        Li.addAssign(
          T.mul(sunTS(float(RB), muSg))
            .mul(max(muSg, 0.0))
            .mul(groundAlb)
            .mul(1 / Math.PI)
        );
      });
      L2.addAssign(Li.div(DIRS));
      fms.addAssign(fi3.div(DIRS));
    });
    const psi = L2.div(max(vec3(1).sub(fms), vec3(1e-4)));
    return vec4(psi, 1.0);
  });

  // ---------- shared march with volumetric shadow ----------
  // ONE single-scattering march serves the sky-view and aerial LUTs
  // (step count is the compile-time constant): a ray from camera
  // height at SIGNED azimuth az from the sun and elevation
  // (se, ce), where chi(t) - the cloud shadow map's Beer-Lambert
  // transmittance at the marched point - multiplies the DIRECT
  // single-scatter term only (Hillaire 2020's volumetric shadow;
  // multiple scattering stays unshadowed). The marched point maps
  // to the scene through the sun-azimuth rotation (roundtrip
  // gated), the horizontal arc ti*ce (curvature over the 16 km
  // shadow range is metres - far under the map texel), and the
  // theme's exact asinh altitude datum (roam.js yOfElev, gated).
  // Mirrored in atmo-reference.mjs.
  const aerialCamXZ = uniform(new Vector2(0, 0));
  const aerialSunAz = uniform(new Vector2(1, 0));
  const shadowElev0 = uniform(0); // the box's elevation datum (m)
  // withGround: Hillaire's terminal ground bounce for sky-view rays
  // that end ON the virtual ground (L += T x albedo/pi x NdotL x
  // T_sun at the hit) - the aerial march never takes it, scene
  // geometry provides that ground.
  const makeMarch = (steps, withGround = false) =>
    Fn((args) => {
      const [r, az, se, ce, dEnd] = args;
      const gHit = withGround ? args[5] : null;
      const dt = dEnd.div(steps);
      const T = vec3(1).toVar();
      const L = vec3(0).toVar();
      const mu = se;
      const sunS = sqrt(max(sunMu.mul(sunMu).oneMinus(), 0.0));
      const cSun = ce.mul(cos(az)).mul(sunS).add(se.mul(sunMu));
      // Scene-plane direction of this azimuth: the sun's azimuth
      // vector rotated by az (counterclockwise in the xz basis -
      // the same convention aerial-tsl's atan(cross, dot) reads
      // back; roundtrip gated).
      const sceneDir = vec2(
        aerialSunAz.x.mul(cos(az)).sub(aerialSunAz.y.mul(sin(az))),
        aerialSunAz.x.mul(sin(az)).add(aerialSunAz.y.mul(cos(az)))
      );
      Loop(steps, ({i: s}) => {
        const ti = float(s).add(0.5).mul(dt);
        const ri = sqrt(
          r.mul(r).add(ti.mul(ti)).add(r.mul(ti).mul(mu).mul(2.0))
        );
        const h = ri.sub(RB);
        const dens = densities(h);
        const scatR = rayleighS.mul(dens.x);
        // The SCALED system (delta similarity, aureole.js): the
        // smooth Mie remainder scatters here; the spike's share
        // travels in the quasi-direct beam (scaled extinction,
        // scaled sun transmittance) and is drawn on the dome at
        // first order. f = 0 makes every line the old system.
        const scatM = mieScat.mul(fDiff.oneMinus()).mul(dens.y);
        const ext = extinction(h).sub(mieScat.mul(fDiff).mul(dens.y));
        const muSi = clamp(r.mul(sunMu).add(ti.mul(cSun)).div(ri), -1.0, 1.0);
        const Ts = sunTS(ri, muSi);
        // chi: sun visibility through the cloud decks at the
        // marched point - scene xz from the horizontal arc, scene
        // y from the altitude datum (a ray above the decks reads
        // full sun; the hook's mid-plane projection handles any y).
        const chi = cloudShadow
          ? (() => {
              const p = aerialCamXZ.add(
                sceneDir.mul(ti.mul(ce).mul(SCENE_PER_M))
              );
              const y = asinh(h.sub(shadowElev0).div(500)).mul(16);
              return cloudShadow.transmittance(vec3(p.x, y, p.y));
            })()
          : float(1);
        const S = scatR
          .mul(phaseR(cSun))
          .add(scatM.mul(phaseM(cSun)))
          .mul(Ts)
          .mul(chi)
          .add(scatR.add(scatM).mul(psiMS(ri, muSi)));
        const stepT = exp(ext.mul(dt).negate());
        L.addAssign(T.mul(S.sub(S.mul(stepT))).div(max(ext, vec3(1e-9))));
        T.mulAssign(stepT);
      });
      if (gHit) {
        // The ground point's up vector dotted with the sun IS the
        // path muS expression at ti = dEnd (both are dot(P-hat,
        // sun)) - so NdotL and the transmittance-to-sun reuse the
        // march's own formulas exactly.
        const rG = sqrt(
          r.mul(r).add(dEnd.mul(dEnd)).add(r.mul(dEnd).mul(mu).mul(2.0))
        );
        const muG = clamp(r.mul(sunMu).add(dEnd.mul(cSun)).div(rG), -1.0, 1.0);
        L.addAssign(
          T.mul(sunTS(rG, muG))
            .mul(groundAlb)
            .mul(max(muG, 0.0))
            .mul(1 / Math.PI)
            .mul(gHit)
        );
      }
      return vec4(L, dot(T, vec3(1 / 3, 1 / 3, 1 / 3)));
    });
  const marchSky32 = makeMarch(32, true);
  const marchAerial20 = makeMarch(20);

  // Sky-view vertical mapping, Bruneton-style guarded split (phase 4
  // horizon-band fix). Sky radiance is DISCONTINUOUS at the horizon
  // (ground-terminated march below vs full path to the atmosphere top
  // above); the old mapping put the seam mid-texel at v=0.5 and
  // bilinear filtering smeared it into a band. Now each half-range
  // maps to its own texel-CENTRE range with a half-texel guard on
  // either side of the seam - a sampled v never mixes rows across it
  // - keeping the sqrt warp that concentrates resolution at the
  // horizon. The ray class is assigned BY HALF (Bruneton 2008 's
  // ray_r_mu_intersects_ground), not by intersection test, so the two
  // boundary rows store the true one-sided limits: the below row
  // marches to the ground at the exact tangent distance, the above
  // row to the top.
  const SKY_GUARD = 0.5 / SKY_H;
  const SKY_SPAN = 0.5 - 1 / SKY_H;
  const skyVFromElev = Fn(([elev, hAngle]) => {
    const res = float(0).toVar();
    If(elev.lessThan(hAngle), () => {
      const s = sqrt(
        clamp(hAngle.sub(elev).div(hAngle.add(1.5707963)), 0.0, 1.0)
      );
      res.assign(float(0.5 - SKY_GUARD).sub(s.mul(SKY_SPAN)));
    }).Else(() => {
      const s = sqrt(
        clamp(elev.sub(hAngle).div(float(1.5707963).sub(hAngle)), 0.0, 1.0)
      );
      res.assign(float(0.5 + SKY_GUARD).add(s.mul(SKY_SPAN)));
    });
    return res;
  });
  const elevFromSkyV = Fn(([v, hAngle]) => {
    const res = float(0).toVar();
    If(v.lessThan(0.5), () => {
      const s = clamp(
        float(0.5 - SKY_GUARD)
          .sub(v)
          .div(SKY_SPAN),
        0.0,
        1.0
      );
      res.assign(hAngle.sub(s.mul(s).mul(hAngle.add(1.5707963))));
    }).Else(() => {
      const s = clamp(v.sub(0.5 + SKY_GUARD).div(SKY_SPAN), 0.0, 1.0);
      res.assign(hAngle.add(s.mul(s).mul(float(1.5707963).sub(hAngle))));
    });
    return res;
  });

  // ---------- sky-view (per frame) ----------
  const skyviewNode = Fn(([vUv]) => {
    const r = float(RB).add(max(camH, 1.0));
    const horizon = sqrt(max(r.mul(r).sub(RB * RB), 0.0))
      .div(r)
      .negate();
    const hAngle = horizon.clamp(-1, 1).asin();
    const elev = elevFromSkyV(vUv.y, hAngle);
    // Full-circle SIGNED azimuth: u = 0.5 faces the sun, the seam
    // (u = 0/1) is the anti-sun azimuth (same convention as the
    // aerial LUT - the cloud shadow is not azimuthally symmetric).
    const az = vUv.x.sub(0.5).mul(2.0 * 3.14159265);
    const se = sin(elev);
    const ce = cos(elev);
    const dGround = raySphere(r, se, float(RB));
    const dTop = raySphere(r, se, float(RT));
    // Ray class by texture half; the tangent distance is the exact
    // disc==0 fallback for the below-boundary row.
    const dTangent = sqrt(max(r.mul(r).sub(RB * RB), 0.0));
    const dEnd = max(
      select(
        vUv.y.lessThan(0.5),
        select(dGround.greaterThan(0.0), dGround, dTangent),
        dTop
      ),
      0.0
    );
    // Below-horizon rows whose ray genuinely reaches the ground
    // take Hillaire's terminal ground bounce; the tangent
    // fallback and every above-horizon row do not.
    const gHit = select(
      vUv.y.lessThan(0.5).and(dGround.greaterThan(0.0)),
      float(1.0),
      float(0.0)
    );
    return marchSky32(r, az, se, ce, dEnd, gHit);
  });

  // ---------- aerial perspective (per frame) ----------
  const aerialNode = Fn(([vUv]) => {
    // Full-circle SIGNED azimuth: u = 0.5 faces the sun, the seam
    // (u = 0/1) is the anti-sun azimuth. A horizontal ray:
    // se = 0, ce = 1.
    const az = vUv.x.sub(0.5).mul(2.0 * 3.14159265);
    const dist = vUv.y.mul(MAX_DIST_M);
    const r = float(RB).add(max(camH, 1.0));
    return marchAerial20(r, az, float(0), float(1), dist);
  });

  // ---------- cosine-weighted sky irradiance (per frame, 1x1) ----------
  const irradianceNode = Fn(() => {
    const r = float(RB).add(max(camH, 1.0));
    const horizon = sqrt(max(r.mul(r).sub(RB * RB), 0.0))
      .div(r)
      .negate();
    const hAngle = horizon.clamp(-1, 1).asin();
    const E = vec3(0).toVar();
    const wSum = float(0).toVar();
    Loop(6, ({i: ie}) => {
      // toVar() everything outer-counter-derived before the inner Loop
      // (nested counters shadow - see the multiscatter comment).
      const elev = float(ie)
        .add(0.5)
        .mul(1.5707963 / 6)
        .toVar();
      const uy = skyVFromElev(elev, hAngle).toVar();
      // cos(theta_zenith) = sin(elev); d-omega = cos(elev) d-elev d-az
      const w = sin(elev).mul(cos(elev)).toVar();
      Loop(8, ({i: ia}) => {
        // ax spans the FULL signed circle now (u = 0.5 faces the
        // sun) - the mean over 8 azimuths is the same integral,
        // and the shadowed sky darkens the ambient correctly.
        const ax = float(ia)
          .add(0.5)
          .mul(1 / 8);
        E.addAssign(skyTexNode.sample(vec2(ax, uy)).rgb.mul(w));
        wSum.addAssign(w);
      });
    });
    return vec4(E.div(max(wSum, 1e-6)), 1.0);
  });

  // ---------- the dome ----------
  // The dome's LUT sample for an arbitrary world direction - shared
  // by the dome itself and by anything that sits ABOVE the whole
  // atmosphere (the moon disc): every metre of air along such a ray
  // is in front of the object, so the full sky-view in-scatter adds
  // over its surface radiance.
  const skySampleFor = Fn(([v]) => {
    const r = float(RB).add(max(camH, 1.0));
    const horizon = sqrt(max(r.mul(r).sub(RB * RB), 0.0))
      .div(r)
      .negate();
    const hAngle = horizon.clamp(-1, 1).asin();
    const elev = v.y.clamp(-1, 1).asin();
    const sunH = normalize(sunDirW.xz.add(vec2(1e-6, 1e-6)));
    const vH = normalize(v.xz.add(vec2(1e-6, 1e-6)));
    // SIGNED azimuth over the full circle - atan(cross, dot), the
    // same convention the LUT fill rotates by (roundtrip gated).
    const ux = atan(sunH.x.mul(vH.y).sub(sunH.y.mul(vH.x)), dot(sunH, vH))
      .div(2.0 * 3.14159265)
      .add(0.5);
    // The horizon is a true radiance discontinuity (the guarded LUT
    // split stores its one-sided limits in the two seam rows). A
    // pixel straddling it should show the box-filter integral of
    // both sides, so blend the limits by pixel coverage
    // (fwidth(elev) = the pixel's elevation footprint); this also
    // keeps the dome a continuous function of elev - no cross-device
    // single-pixel classification flips along the horizon row.
    const sA = sqrt(
      clamp(elev.sub(hAngle).div(float(1.5707963).sub(hAngle)), 0.0, 1.0)
    );
    const sB = sqrt(
      clamp(hAngle.sub(elev).div(hAngle.add(1.5707963)), 0.0, 1.0)
    );
    const uyAbove = float(0.5 + SKY_GUARD).add(sA.mul(SKY_SPAN));
    const uyBelow = float(0.5 - SKY_GUARD).sub(sB.mul(SKY_SPAN));
    const cov = clamp(
      elev
        .sub(hAngle)
        .div(max(fwidth(elev), 1e-7))
        .add(0.5),
      0.0,
      1.0
    );
    return mix(
      skyTexNode.sample(vec2(ux, uyBelow)).rgb,
      skyTexNode.sample(vec2(ux, uyAbove)).rgb,
      cov
    );
  });

  const domeColor = Fn(() => {
    const v = normalize(positionLocal);
    const r = float(RB).add(max(camH, 1.0));
    const col = skySampleFor(v).toVar();
    // The sun disc: direct transmittance with photospheric limb
    // darkening, Hestroffer & Magnan (1998) power law I(mu) = mu^a,
    // a(lambda_um) = -0.023 + 0.292 / lambda, at the same 680/550/440
    // nm the scattering coefficients use. mu = cos of the angular
    // offset from disc centre normalised to the disc radius; the 120
    // constant is the CENTRAL intensity.
    //
    // Atmospheric refraction splits and squashes the disc
    // (refraction.js, ray-traced through the MEASURED profile on
    // the CPU): each channel carries its own apparent direction -
    // the green rim IS the gap between them, widening when the
    // profile magnifies it (the green flash's approach) - and all
    // three share the vertical flattening ratio (the setting sun's
    // published ~5/6 squash). The angular offset from each centre
    // is decomposed against the local vertical and its vertical
    // component divided by the flatten factor; clamp keeps the
    // limb law's exact zero at the (elliptical) edge, as before.
    const cSunG = dot(v, sunDirW);
    // The AUREOLE: the coarse-mode diffraction spike's first
    // scattering order, drawn per pixel exactly where the sky-view
    // LUT cannot resolve it - the same resolution argument Hillaire
    // (2020) gives for compositing the sun disc after the LUT. The
    // marches above run the delta-SCALED system (the spike's light
    // rides the quasi-direct beam); here that light scatters ONCE
    // into its true angular pattern:
    //   L = P_spike(theta) * INT sigma_s f * T'_sun * chi * T'_view ds
    // with theta constant along the whole ray (sun and view fixed),
    // so the pattern factors out of the march. Everything scaled
    // (T'), cloud-shadowed (chi - the aureole dies behind a deck)
    // and eclipse-dimmed (sunE). Outside the CPU-computed cone the
    // term sits under 1% of the smooth source; with no measured
    // coarse aerosol spikeCosCone = 2 and the branch never runs.
    If(cSunG.greaterThan(spikeCosCone), () => {
      const mu = v.y;
      const dGround = raySphere(r, mu, float(RB)).toVar();
      const dTop = raySphere(r, mu, float(RT)).toVar();
      const dEnd = select(dGround.greaterThan(0.0), dGround, dTop).toVar();
      const STEPS = 32;
      const dt = dEnd.div(STEPS).toVar();
      const Tv = vec3(1).toVar();
      const Iss = vec3(0).toVar();
      Loop(STEPS, ({i: s}) => {
        const ti = float(s).add(0.5).mul(dt);
        const ri = sqrt(
          r.mul(r).add(ti.mul(ti)).add(r.mul(ti).mul(mu).mul(2.0))
        );
        const h = ri.sub(RB);
        const dens = densities(h);
        const sig = mieScat.mul(fDiff).mul(dens.y);
        const ext = extinction(h).sub(sig);
        const muSi = clamp(r.mul(sunMu).add(ti.mul(cSunG)).div(ri), -1.0, 1.0);
        const Ts = sunTS(ri, muSi);
        const chi = cloudShadow
          ? (() => {
              // Same scene mapping as the LUT marches: v.xz IS
              // ce * horizontal direction, so the arc is direct.
              const p = aerialCamXZ.add(v.xz.mul(ti.mul(SCENE_PER_M)));
              const y = asinh(h.sub(shadowElev0).div(500)).mul(16);
              return cloudShadow.transmittance(vec3(p.x, y, p.y));
            })()
          : float(1);
        const S = sig.mul(Ts).mul(chi);
        const stepT = exp(ext.mul(dt).negate());
        Iss.addAssign(Tv.mul(S.sub(S.mul(stepT))).div(max(ext, vec3(1e-9))));
        Tv.mulAssign(stepT);
      });
      // sin-form angle: acos loses precision exactly where the
      // spike lives (theta -> 0); asin of the cross length holds it.
      const sinTh = cross(v, sunDirW).length();
      const th = asin(clamp(sinTh, 0.0, 1.0));
      const uS = th
        .div(spikeThetaMax)
        .clamp(0.0, 1.0)
        .mul((SPIKE_N - 1) / SPIKE_N)
        .add(0.5 / SPIKE_N);
      col.addAssign(spikeNode.sample(vec2(uS, 0.5)).rgb.mul(Iss).mul(sunE));
    });
    // The cirrus corona: the cold veil's crystals diffract the
    // direct beam once -
    //   L(theta) = P(theta) * T_air * amp * sunE,
    // P the CPU-convolved Airy pattern (sr^-1), T_air the LUT's
    // own eye->space transmittance along the fragment ray (pure
    // Beer, the drawn disc's documented convention), amp =
    // (tau/2) e^-tau on the measured cirrus column - the
    // extinction e^-tau lives INSIDE amp. The volumetric decks
    // need NO factor here: the cirrus sits above them, the
    // sun-side path to it crosses no deck, and the view-side leg
    // is extinguished by the cloud composite itself (the dome is
    // behind every deck pixel) - a chi here would extinguish
    // twice.
    const coronaAdd = (dirU, ampU, texN, thMaxU = corThetaMax) => {
      const sinTh = cross(v, dirU).length();
      const th = asin(clamp(sinTh, 0.0, 1.0));
      const uC = th
        .div(thMaxU)
        .clamp(0.0, 1.0)
        .mul((COR_N - 1) / COR_N)
        .add(0.5 / COR_N);
      const tAir = tTexNode.sample(tParamsToUv(r, v.y)).rgb;
      col.addAssign(texN.sample(vec2(uC, 0.5)).rgb.mul(tAir).mul(ampU));
    };
    If(cSunG.greaterThan(corCosCone), () => {
      coronaAdd(sunDirW, corAmp.mul(sunE), corNode);
    });
    // The LUNAR corona - the same pattern anchored on the drawn
    // moon, its amplitude carrying the moonlight irradiance in
    // this frame's own E0 units (moonlight.js: the printed
    // fact-sheet anchor through the gated Hapke phase curve and
    // the live distance; a lunar eclipse's umbral immersion
    // dims it linearly upstream). No sunE - the sun's eclipse
    // does not touch moonlight.
    If(dot(v, corMoonDir).greaterThan(corMoonCosCone), () => {
      coronaAdd(corMoonDir, corMoonAmp, corMoonNode);
    });
    // Bishop's Ring: the stratospheric slab's diffraction at its
    // own wider cone - the white inner space and reddish-brown
    // border of the 1888 record around sun and moon. Same
    // first-order road as the cirrus corona (the stratosphere
    // sits above every deck, the composite carries the view-side
    // extinction, tAir the eye->space leg).
    If(cSunG.greaterThan(bishopCosCone), () => {
      coronaAdd(sunDirW, bishopAmpU.mul(sunE), bishopNode, bishopThetaMax);
    });
    If(dot(v, corMoonDir).greaterThan(bishopMoonCosCone), () => {
      coronaAdd(corMoonDir, bishopMoonAmp, bishopMoonNode, bishopThetaMax);
    });
    // The deck droplet coronas: amp = (paradox half * veil
    // transmittance, CPU) * the deck's slant tau along THIS
    // fragment's ray (the cloud shadow map - one deck-column
    // definition with the terrain's shadows), no e^-tau (the
    // volumetric composite extinguishes the dome behind every
    // deck pixel - the slab law's other leg). Gaps zero the map's
    // tau and the corona dies with the droplets; the unattached
    // map fails closed.
    if (cloudShadow) {
      const camPos = () => vec3(aerialCamXZ.x, corCamY, aerialCamXZ.y);
      If(cSunG.greaterThan(corDropCosCone), () => {
        const tauD = cloudShadow.tauSlant(camPos(), v);
        coronaAdd(sunDirW, tauD.mul(corDropAmp).mul(sunE), corDropNode);
      });
      If(dot(v, corMoonDir).greaterThan(corMoonDropCosCone), () => {
        const tauD = cloudShadow.tauSlant(camPos(), v);
        coronaAdd(corMoonDir, tauD.mul(corMoonDropAmp), corMoonDropNode);
      });
    }
    // Inside the transfer band at a low sun, the disc is drawn
    // through the LUT: the fragment's APPARENT altitude reads the
    // TRUE altitude each channel sees there, and disc membership
    // is |trueAlt - sunTrueAlt| against the disc radius - folds in
    // the curve then draw themselves as the Omega sun, mock-mirage
    // slices and the magnified flash. Azimuth handled small-angle
    // (the gate is a ~2.5 deg window around the sun's azimuth).
    const aFrag = asin(clamp(v.y, -1.0, 1.0));
    const vH = normalize(vec3(v.x, 0.0, v.z).add(vec3(0.0, 0.0, 1e-9)));
    const sH = normalize(
      vec3(sunDirW.x, 0.0, sunDirW.z).add(vec3(0.0, 0.0, 1e-9))
    );
    const cosAz = dot(vH, sH);
    const sinAz = vH.x.mul(sH.z).sub(vH.z.mul(sH.x));
    const inBand = transOn
      .greaterThan(0.5)
      .and(aFrag.greaterThan(transA0))
      .and(aFrag.lessThan(transA1))
      .and(cosAz.greaterThan(0.999));
    // The fragment's footprint in altitude AND azimuth offset,
    // materialised in UNIFORM control flow (WGSL forbids
    // derivatives inside the divergent branch below).
    const hOff = sinAz.mul(cos(aFrag));
    const fwA = fwidth(aFrag).toVar();
    const fwH = fwidth(hOff).toVar();
    If(inBand, () => {
      const discR = sunRadU;
      // The flash rim (the last row where the 550 nm image
      // persists past 680 nm's end) is thinner than a pixel, and
      // point sampling a sub-pixel feature on a curved arc breaks
      // it into dashes (measured: 9 of 55 disc columns lost their
      // green rim pixel; a vertical-only filter still left 3 -
      // mid-arc the boundary crosses pixels horizontally). Same
      // treatment as the horizon seam below: the fragment shows
      // the BOX-FILTER INTEGRAL of the band term over its own 2D
      // footprint (fwidth in both apparent altitude and azimuth
      // offset), as an 8x4 quadrature - the altitude taps ride the
      // LUT's hardware interpolation (transmittance depends only
      // on altitude, so 8 LUT reads serve all 32 membership
      // evaluations), converging on the true pixel integral
      // instead of approximating the edge with a smoothstep.
      const TAPS_A = 8;
      const TAPS_H = 4;
      // Row i of the band textures carries altitude a0 + i/(N-1) *
      // span, but its texel CENTRE sits at (i+0.5)/N - a linear
      // alt->u map drifts up to half a texel across the band, and
      // half a row here is 0.15 mrad of altitude where the grazing
      // transmittance moves ~4% (the band probe measured exactly
      // that on the drawn disc). uOfAlt lands row i's altitude on
      // its texel centre.
      const uOfAlt = (aVal) =>
        aVal
          .sub(transA0)
          .div(transA1.sub(transA0))
          .mul((TRANS_ROWS - 1) / TRANS_ROWS)
          .add(0.5 / TRANS_ROWS);
      const acc = vec3(0.0).toVar();
      for (let i = 0; i < TAPS_A; i++) {
        const aS = aFrag.add(fwA.mul((i + 0.5) / TAPS_A - 0.5));
        const t4 = transNode.sample(vec2(uOfAlt(aS), 0.5));
        for (let j = 0; j < TAPS_H; j++) {
          const hS = hOff.add(fwH.mul((j + 0.5) / TAPS_H - 0.5));
          const chanMu = (tc) => {
            const vOff = tc.sub(sunTrueAlt);
            const s2 = clamp(
              vOff.mul(vOff).add(hS.mul(hS)).div(discR.mul(discR)),
              0.0,
              1.0
            );
            return sqrt(s2.oneMinus());
          };
          const limb = vec3(
            pow(chanMu(t4.r), 0.4064),
            pow(chanMu(t4.g), 0.5079),
            pow(chanMu(t4.b), 0.6406)
          );
          acc.addAssign(limb.mul(t4.a));
        }
      }
      // Transmittance from the band's own CPU-built rows (exact
      // observer radius) instead of the 2D LUT's radius-row blend
      // (0.5% R/G error here); sampled once per fragment - T is
      // smooth where the membership edge is not.
      col.addAssign(
        bandTNode
          .sample(vec2(uOfAlt(aFrag), 0.5))
          .rgb.mul(acc)
          .mul(cirrusTd)
          .mul(120.0 / (TAPS_A * TAPS_H))
      );
    }).Else(() => {
      // When the transfer band is engaged, a fragment BELOW its
      // floor is below the observer's geometric dip (the theme
      // extends the floor under the horizon) - sea, never sun.
      // Without this gate the graze-saturated apparent direction
      // parks the set sun's disc just under the dip, where this
      // unoccluded path painted it onto the LUT sea (caught by the
      // SF flash float captures). Above the band's ceiling (a
      // rising sun leaving the band) this path still draws.
      const elseDisc = cSunG
        .greaterThan(0.9998)
        .and(transOn.lessThan(0.5).or(aFrag.greaterThanEqual(transA0)));
      If(elseDisc, () => {
        const sinRad = sin(sunRadU).toVar();
        const sin2R = sinRad.mul(sinRad);
        const chanMu = (dir) => {
          const cS = dot(v, dir);
          const up = normalize(
            vec3(0.0, 1.0, 0.0)
              .sub(dir.mul(dir.y))
              .add(vec3(0.0, 0.0, 1e-9))
          );
          const off = v.sub(dir.mul(cS));
          const ov = dot(off, up).div(sunFlat);
          const rest = off.sub(up.mul(dot(off, up)));
          const s2 = clamp(
            ov.mul(ov).add(dot(rest, rest)).div(sin2R),
            0.0,
            1.0
          );
          return sqrt(s2.oneMinus());
        };
        const limb = vec3(
          pow(chanMu(sunDirR), 0.4064),
          pow(chanMu(sunDirW), 0.5079),
          pow(chanMu(sunDirB), 0.6406)
        );
        // Sunspots multiply the limb-darkened photosphere (the spot
        // sits in the same limb-darkened environment). Fragment
        // disc coordinates in the local vertical frame, in solar
        // radii; the vertical shares the disc's refraction
        // flattening. Each spot is a circle ON THE SPHERE, so its
        // radial axis foreshortens by its own z; edges get analytic
        // pixel coverage from the hoisted footprint (fwidth is
        // illegal in this divergent branch).
        const upW = normalize(
          vec3(0.0, 1.0, 0.0)
            .sub(sunDirW.mul(sunDirW.y))
            .add(vec3(0.0, 0.0, 1e-9))
        );
        // d x u points toward INCREASING azimuth (u x d is its
        // negation - caught on the first live capture: the drawn
        // spots mirrored in h against the SWPC positions).
        const eastW = normalize(cross(sunDirW, upW));
        const offW = v.sub(sunDirW.mul(dot(v, sunDirW)));
        const vN = dot(offW, upW).div(sunFlat).div(sinRad);
        const hN = dot(offW, eastW).div(sinRad);
        const aa = fwA.div(sinRad).max(1e-4);
        const spotF = vec3(1.0).toVar();
        for (let i = 0; i < SPOTS_MAX; i++) {
          const W = SPOTS_MAX * 4;
          const sA = spotsNode.sample(vec2((4 * i + 0.5) / W, 0.5));
          const sB = spotsNode.sample(vec2((4 * i + 1.5) / W, 0.5));
          const sC = spotsNode.sample(vec2((4 * i + 2.5) / W, 0.5));
          const sD = spotsNode.sample(vec2((4 * i + 3.5) / W, 0.5));
          const rho = max(sA.xy.length(), 1e-4);
          const rx = sA.x.div(rho);
          const ry = sA.y.div(rho);
          const dv = vN.sub(sA.x);
          const dh = hN.sub(sA.y);
          const zSh = max(sB.x, 0.05);
          const dRad = dv.mul(rx).add(dh.mul(ry)).div(zSh);
          const dTan = dh.mul(rx).sub(dv.mul(ry));
          const rr = sqrt(dRad.mul(dRad).add(dTan.mul(dTan)));
          const covU = smoothstep(
            sA.z.sub(aa.mul(0.5)),
            sA.z.add(aa.mul(0.5)),
            rr
          )
            .oneMinus()
            .mul(sA.w);
          const covP = smoothstep(
            sB.y.sub(aa.mul(0.5)),
            sB.y.add(aa.mul(0.5)),
            rr
          )
            .oneMinus()
            .mul(sA.w);
          spotF.mulAssign(mix(mix(vec3(1.0), sD.rgb, covP), sC.rgb, covU));
        }
        const discT = tTexNode.sample(tParamsToUv(r, v.y)).rgb.toVar();
        col.addAssign(discT.mul(limb).mul(spotF).mul(cirrusTd).mul(120.0));
        // The corona (Baumbach 1937, AN 263, 121, eq. (5) - read
        // from the original scan; corona.js is the gated mirror):
        // I(rho) = 0.0532 rho^-2.5 + 1.425 rho^-7 + 2.565 rho^-17
        // in MILLIONTHS of the disc-CENTRE brightness - the
        // paper's p. 124 sets the centre to 1e6 units, exactly
        // the 120-constant's own normalisation, so the tie needs
        // no conversion. Drawn ALWAYS at that true radiance
        // through the same transmittance as the disc: beneath any
        // daylit sky it vanishes on radiometry alone, and as an
        // eclipse drives the sky down (sunE) it EMERGES - no
        // visibility gate anywhere; the moon disc covers its
        // inner reaches geometrically. vN/hN are already the
        // flatten-consistent disc-frame coordinates in solar
        // radii, so rho falls out of the frame the spots built.
        // Fit range 1-6 R_sun (the paper's measured range); the
        // else-branch's own cSunG gate ends the draw at ~4.3.
        // K/F split, streamers and the cycle-dependent Ludendorff
        // flattening: documented scope (eq. 5 is the mean).
        const rho = sqrt(vN.mul(vN).add(hN.mul(hN))).max(0.2);
        const bau = pow(rho, -2.5)
          .mul(0.0532)
          .add(pow(rho, -7.0).mul(1.425))
          .add(pow(rho, -17.0).mul(2.565));
        // Radiometric anchor (corona.js, gated): the disc-centre
        // brightness IMPLIED by this model's unit solar irradiance
        // is B_centre = 1/((1 - U/3) pi sunRad^2) - about 18,382
        // sr^-1 at 1 au - and the corona is Baumbach's millionths
        // of THAT, not of the display-compressed 120 disc (a 120-
        // anchored first attempt sat ~150x beneath the sky and
        // vanished). In this frame the limb corona (~0.074) lives
        // among the sky's own radiances: beneath the daytime
        // aureole, above the totality sky - emergence by
        // radiometry alone.
        const bCentre = float(1.0).div(sunRadU.mul(sunRadU).mul(0.8 * Math.PI));
        col.addAssign(
          discT
            .mul(bau.mul(smoothstep(0.98, 1.02, rho)).mul(bCentre.mul(1e-6)))
            .mul(cirrusTd)
        );
      });
    });
    const lin = col.mul(exposure);
    const disp = mix(lin, spectral(lin), specOn).toVar();
    // Rod vision: below the mesopic range the eye reports Eq. 13's
    // scotopic luminance, not colour (X guarded like the JS
    // scotopicY; (Y+Z)/X >= 0.562 for any non-negative RGB, so the
    // bracket never goes negative).
    const Xc = disp.x
      .mul(0.4124)
      .add(disp.y.mul(0.3576))
      .add(disp.z.mul(0.1805));
    const Yc = disp.x
      .mul(0.2126)
      .add(disp.y.mul(0.7152))
      .add(disp.z.mul(0.0722));
    const Zc = disp.x
      .mul(0.0193)
      .add(disp.y.mul(0.1192))
      .add(disp.z.mul(0.9505));
    const Ys = Yc.mul(
      Yc.add(Zc).div(max(Xc, 1e-12)).add(1.0).mul(1.33).sub(1.68)
    ).div(2.31);
    return vec4(mix(vec3(Ys), disp, scotB), 1.0);
  });

  // QuadMesh remains only for the irradiance pass (a 1x1
  // RenderTarget the async readback needs) and the readLut blit.
  const quad = new QuadMesh();

  function passMaterial(node) {
    const m = new MeshBasicNodeMaterial();
    m.colorNode = node;
    m.toneMapped = false;
    // LUT alpha channels carry data (the aerial LUT stores mean
    // transmittance in alpha); opaque node materials stomp output
    // alpha to 1, so write source RGBA verbatim.
    m.transparent = true;
    m.blending = NoBlending;
    return m;
  }

  // One compute invocation per texel; vUv at texel centres (the same
  // coordinates the readLut blit's uv() sees).
  function makeKernel(fn, lut) {
    const {w, h} = lut;
    return Fn(() => {
      const i = int(instanceIndex);
      const x = i.mod(w);
      const y = i.div(w);
      const vUv = vec2(float(x).add(0.5).div(w), float(y).add(0.5).div(h));
      textureStore(lut.tex, ivec2(x, y), fn(vUv));
    })().compute(w * h);
  }

  // Per-LUT fill: dispatch the kernel.
  function makeFill(fn, lut) {
    const kernel = makeKernel(fn, lut);
    return () => renderer.compute(kernel);
  }

  const fillT = makeFill(transmittanceNode, tLut);
  const fillMs = makeFill(multiscatterNode, msLut);
  // The two radiance LUTs are stored pre-scaled by the solar
  // irradiance factor (eclipse obscuration; 1 normally, so the
  // reference probes see the unscaled texels). Transmittance and
  // Psi_ms are optical properties of the air, independent of how
  // hard the sun shines - they stay unscaled. Alpha carries data
  // (aerial mean transmittance), never scaled.
  const fillSky = makeFill((vUv) => {
    const s = skyviewNode(vUv).toVar();
    return vec4(s.rgb.mul(sunE), s.a);
  }, skyLut);
  const fillAerial = makeFill((vUv) => {
    const s = aerialNode(vUv).toVar();
    return vec4(s.rgb.mul(sunE), s.a);
  }, aerialLut);

  const irrMat = passMaterial(irradianceNode());

  const domeMat = new MeshBasicNodeMaterial({side: BackSide});
  domeMat.colorNode = domeColor();
  domeMat.toneMapped = false;
  domeMat.depthWrite = false;
  const mesh = new Mesh(new SphereGeometry(1400, 32, 20), domeMat);
  mesh.renderOrder = -3;

  let lutsBuilt = false;
  let lastMie = '';
  let lastMs = '';

  return {
    ok: true,
    mesh,
    aerialTex: aerialLut.tex,
    // Exact metres-per-scene-unit (roam.js MPU = 16000/280): the
    // old 57.14 literal was 50 ppm off the mapping's own constant.
    aerialMaxUnits: MAX_DIST_M / (400 / 7),
    // Crepuscular rays: the shadowed marches need the camera's
    // scene position, the sun's azimuth vector and the box's
    // elevation datum to place their shadow samples (set per frame
    // next to the fog hook's uSunAzV).
    aerialShadow: {
      camXZ: aerialCamXZ,
      sunAz: aerialSunAz,
      elev0: shadowElev0,
      camY: corCamY
    },
    // Refraction of the drawn disc: per-channel apparent
    // directions + vertical flattening (set from refraction.js).
    sunDisc: {
      dirR: sunDirR,
      dirB: sunDirB,
      flatten: sunFlat,
      radius: sunRadU,
      // e^-tau_slant of the measured cirrus column (the theme
      // feeds the SAME cirrusT its sunlight rides); 1 = no veil.
      cirrusT: cirrusTd
    },
    // Solar-eclipse illumination: the theme sets 1 - obscuration.
    sunE,
    // Real sunspots: the theme feeds buildSpots() output (sunspots
    // .js). Empty list (or omission) clears the disc.
    sunSpots: {
      set(list) {
        const d = spotsTex.image.data;
        d.fill(0);
        (list || []).slice(0, SPOTS_MAX).forEach((sp, i) => {
          const o = i * 16;
          d[o] = sp.v;
          d[o + 1] = sp.h;
          d[o + 2] = sp.rU;
          d[o + 3] = 1;
          d[o + 4] = sp.shorten ?? 1;
          d[o + 5] = sp.rP;
          d[o + 8] = sp.umbra[0];
          d[o + 9] = sp.umbra[1];
          d[o + 10] = sp.umbra[2];
          d[o + 12] = sp.penumbra[0];
          d[o + 13] = sp.penumbra[1];
          d[o + 14] = sp.penumbra[2];
        });
        spotsTex.needsUpdate = true;
      }
    },
    // The radiometric tap (see specOn above) - harness captures
    // set 0 for the captured frame and restore.
    spectralOn: specOn,
    // The Purkinje fold blend (1 photopic .. 0 rod); the theme
    // feeds mesopicBlend(La) each frame.
    scotB,
    // The sunset transfer LUT feed (see the band in domeColor).
    sunTransfer: {
      on: transOn,
      sunTrue: sunTrueAlt,
      set(curve) {
        const d = transTex.image.data;
        for (let i = 0; i < TRANS_ROWS; i++) {
          d[i * 4] = curve.tR[i];
          d[i * 4 + 1] = curve.tG[i];
          d[i * 4 + 2] = curve.tB[i];
          // Alpha = visibility: rows whose rays run into the
          // surface show sea, not sun.
          d[i * 4 + 3] = curve.vis ? curve.vis[i] : 1;
        }
        transTex.needsUpdate = true;
        transA0.value = curve.a[0];
        transA1.value = curve.a[curve.a.length - 1];
        // The band's transmittance rows follow the same cadence
        // (and update() refills them when the aerosol set moves).
        lastCurve = curve;
        fillBandT();
      },
      // Harness introspection: the CPU-built rows, for probes.
      bandData: () => bandTTex.image.data
    },
    // The cirrus corona feed (cloud-corona.js): patterns only when
    // a LUT re-lays (source-disc drift), amplitudes every frame -
    // 0 disables a branch entirely (cos cone 2). Sun and moon are
    // the same machinery at their own discs and amplitudes.
    cloudCorona: (() => {
      let coneRad = 0;
      let coneRadMoon = 0;
      let coneRadDrop = 0;
      let coneRadMoonDrop = 0;
      return {
        setPattern(lut) {
          corTex.image.data.set(lut.curve);
          corTex.needsUpdate = true;
          corThetaMax.value = lut.thetaMaxRad;
          coneRad = lut.coneRad;
        },
        setAmp(amp) {
          corAmp.value = amp;
          corCosCone.value = amp > 0 && coneRad > 0 ? Math.cos(coneRad) : 2;
        },
        setMoonPattern(lut) {
          corMoonTex.image.data.set(lut.curve);
          corMoonTex.needsUpdate = true;
          coneRadMoon = lut.coneRad;
        },
        setMoon(dir, amp) {
          if (dir) corMoonDir.value.copy(dir);
          corMoonAmp.value = amp;
          corMoonCosCone.value =
            amp > 0 && coneRadMoon > 0 ? Math.cos(coneRadMoon) : 2;
        },
        // The deck droplet corona set: patterns are the Miles
        // lognormal ensembles convolved with each source's live
        // disc; amps carry the paradox half times the veil
        // transmittance (sun) or times the moonlight irradiance
        // (moon) - the deck's own tau rides the fragment.
        setDropPattern(lut) {
          corDropTex.image.data.set(lut.curve);
          corDropTex.needsUpdate = true;
          coneRadDrop = lut.coneRad;
        },
        setDropAmp(amp) {
          corDropAmp.value = amp;
          corDropCosCone.value =
            amp > 0 && coneRadDrop > 0 ? Math.cos(coneRadDrop) : 2;
        },
        setMoonDropPattern(lut) {
          corMoonDropTex.image.data.set(lut.curve);
          corMoonDropTex.needsUpdate = true;
          coneRadMoonDrop = lut.coneRad;
        },
        setMoonDrop(amp) {
          corMoonDropAmp.value = amp;
          corMoonDropCosCone.value =
            amp > 0 && coneRadMoonDrop > 0 ? Math.cos(coneRadMoonDrop) : 2;
        }
      };
    })(),
    // Bishop's Ring feed (bishop.js): patterns on source-disc
    // drift, the measured-excess amplitude every frame; amp 0
    // disables a branch outright. The moon ring anchors on the
    // corMoonDir the cirrus set keeps live.
    bishopRing: (() => {
      let coneRad = 0;
      let coneRadMoon = 0;
      return {
        setPattern(lut) {
          bishopTex.image.data.set(lut.curve);
          bishopTex.needsUpdate = true;
          bishopThetaMax.value = lut.thetaMaxRad;
          coneRad = lut.coneRad;
        },
        setAmp(amp) {
          bishopAmpU.value = amp;
          bishopCosCone.value = amp > 0 && coneRad > 0 ? Math.cos(coneRad) : 2;
        },
        setMoonPattern(lut) {
          bishopMoonTex.image.data.set(lut.curve);
          bishopMoonTex.needsUpdate = true;
          coneRadMoon = lut.coneRad;
        },
        setMoon(amp) {
          bishopMoonAmp.value = amp;
          bishopMoonCosCone.value =
            amp > 0 && coneRadMoon > 0 ? Math.cos(coneRadMoon) : 2;
        }
      };
    })(),
    // The dome's own radiance (exposure applied) for a world
    // direction - objects above the atmosphere (the moon) add this
    // over their surface so a dark disc never punches a hole in
    // the day sky.
    skyRadiance: (v) => spectral(skySampleFor(v).mul(exposure)),
    // Exposed for the validation harness (orientation / content
    // checks against the GLSL reference).
    luts: {
      t: tLut.tex,
      ms: msLut.tex,
      sky: skyLut.tex
    },
    // Harness-only numeric readback of a LUT region: the LUTs are
    // storage textures, not render targets - blit through a quad
    // into a temp RT first. (All LUT widths keep w*16 bytes
    // 256-aligned; narrower WebGPU readbacks come back row-padded.)
    async readLut(name, x, y, w, h) {
      const lut = {t: tLut, ms: msLut, sky: skyLut, aerial: aerialLut}[name];
      const rt = makeTarget(lut.w, lut.h, FloatType);
      const m = passMaterial(texture(lut.tex).sample(uv()));
      quad.material = m;
      renderer.setRenderTarget(rt);
      quad.render(renderer);
      renderer.setRenderTarget(null);
      const px = await renderer.readRenderTargetPixelsAsync(rt, x, y, w, h);
      rt.dispose();
      return px;
    },
    // Called each frame: cheap sky-view raymarch for the current sun.
    // exposure models the eye's photopic adaptation (tone
    // reproduction, not physics): twilight is genuinely darker, but
    // not pitch black.
    update(sunDir, mie, camHMetres, expo, groundAlbedo) {
      // The ground albedo (shared by the MS LUT and the terminal
      // bounce): Payne (1972) 0.06 scalar where the box has sea,
      // or the box's MEASURED per-channel white-sky albedo inland
      // ([R,G,B] from the MOD09A1 RTLSR inversion - MODIS bands
      // 1/4/3, the nearest measured narrowbands to the atmosphere's
      // 680/550/440 nm channels).
      if (Array.isArray(groundAlbedo)) groundAlb.value.fromArray(groundAlbedo);
      else if (groundAlbedo != null) groundAlb.value.setScalar(groundAlbedo);
      // mie = {scat: [r,g,b], abs: [r,g,b], g, aureole?} (1/m at
      // h = 0) from aerosol.js mieCoefficients - measured when
      // /aerosol answers, the Hillaire defaults calibrated to the
      // measured total AOD otherwise. aureole (aureole.js
      // aureoleSet) carries the delta split: per-channel spike
      // fraction, scaled asymmetry g', the drawn pattern and its
      // cone. Without it f = 0 and the whole scaled system is the
      // old system exactly.
      if (mie) {
        mieScat.value.fromArray(mie.scat);
        mieAbs.value.fromArray(mie.abs);
        const aur = mie.aureole;
        if (aur) {
          fDiff.value.fromArray(aur.fDiff);
          gPrime.value.fromArray(aur.gPrime);
          spikeThetaMax.value = aur.thetaMaxRad;
          spikeCosCone.value = Math.cos(aur.coneRad);
          spikeTex.image.data.set(aur.curve);
          spikeTex.needsUpdate = true;
        } else {
          fDiff.value.set(0, 0, 0);
          gPrime.value.setScalar(mie.g);
          spikeCosCone.value = 2;
        }
        // Measured column ozone: DU/300 (1 when unmeasured). The
        // T/MS LUTs rebuild through the key below when it moves.
        ozScale.value = mie.ozScale ?? 1;
        // Measured NO2 boundary-layer absorption (no2.js).
        if (mie.no2) no2A.value.set(mie.no2[0], mie.no2[1], mie.no2[2]);
        else no2A.value.set(0, 0, 0);
      }
      sunMu.value = sunDir.y;
      camH.value = camHMetres;
      sunDirW.value.copy(sunDir);
      if (expo) exposure.value = expo;
      // Aerosols change on sync cadence, not per frame; rebuild the
      // static LUTs only when the radiative set actually moves. The
      // multiple-scattering LUT also carries the fed ground albedo
      // (sea/land differs by anchor), so its key includes it.
      const mieKey = mie
        ? mie.scat.join() +
          '|' +
          mie.abs.join() +
          '|' +
          mie.g +
          '|' +
          (mie.ozScale ?? 1) +
          '|' +
          (mie.no2 ? mie.no2.join() : '0') +
          '|' +
          (mie.aureole
            ? mie.aureole.fDiff.join() + '|' + mie.aureole.gPrime.join()
            : 'nof')
        : lastMie;
      const msKey =
        mieKey +
        '|' +
        groundAlb.value.x +
        ',' +
        groundAlb.value.y +
        ',' +
        groundAlb.value.z;
      if (!lutsBuilt || msKey !== lastMs) {
        if (!lutsBuilt || mieKey !== lastMie) {
          fillT();
          // The band transmittance rows carry the same mie set - a
          // new aerosol answer rebuilds them from the stored curve.
          fillBandT();
        }
        fillMs();
        lutsBuilt = true;
        lastMie = mieKey;
        lastMs = msKey;
      }
      fillSky();
      fillAerial();
      quad.material = irrMat;
      renderer.setRenderTarget(irrLut);
      quad.render(renderer);
      renderer.setRenderTarget(null);
    },
    // Cosine-weighted mean sky radiance (multiply by pi for
    // irradiance). Async: no pipeline stall, the caller updates the
    // hemisphere light when the read resolves (1 Hz cadence).
    async readIrradiance() {
      return renderer.readRenderTargetPixelsAsync(irrLut, 0, 0, 1, 1);
    }
  };
}
