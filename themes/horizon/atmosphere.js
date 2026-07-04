import * as THREE from 'three';

/**
 * A Scalable and Production Ready Sky and Atmosphere Rendering Technique
 * - Sébastien Hillaire, EGSR 2020 (the Frostbite / Unreal Engine sky).
 *
 * Faithful WebGL2 implementation for Horizon:
 *  - transmittance LUT (256x64), computed once
 *  - multiple-scattering LUT (32x32) with 64-direction sphere integral
 *    and ground bounce, computed once
 *  - sky-view LUT (192x108) raymarched every frame for the current sun
 *  - Earth profiles from Bruneton & Neyret (2008): Rayleigh 8km,
 *    Mie 1.2km (Cornette-Shanks g=0.8), ozone tent layer at 25km
 *
 * The Mie coefficients scale with the measured aerosol optical depth, so
 * the sky's haze is data, not taste. transmittanceJS mirrors the optical
 * depth integral on the CPU so the sun's light COLOUR on the terrain is
 * the physically transmitted one.
 */

const COMMON = /* glsl */ `
  const float Rb = 6360e3;
  const float Rt = 6460e3;
  const vec3 rayleighS = vec3(5.802e-6, 13.558e-6, 33.1e-6);
  const float mieS0 = 3.996e-6;
  const float mieA0 = 4.4e-6;
  const vec3 ozoneA = vec3(0.650e-6, 1.881e-6, 0.085e-6);
  uniform float mieScale;

  vec3 densities(float h) {
    // x: rayleigh, y: mie, z: ozone
    return vec3(
      exp(-h / 8000.0),
      exp(-h / 1200.0),
      max(0.0, 1.0 - abs(h - 25e3) / 15e3)
    );
  }

  vec3 extinction(float h) {
    vec3 d = densities(h);
    return rayleighS * d.x + (mieS0 + mieA0) * mieScale * d.y + ozoneA * d.z;
  }

  // Distance to the sphere of radius R, or -1.
  float raySphere(float r, float mu, float R) {
    float b = r * mu;
    float c = r * r - R * R;
    float disc = b * b - c;
    if (disc < 0.0) return -1.0;
    float s = sqrt(disc);
    float t = -b - s;
    if (t > 0.0) return t;
    t = -b + s;
    return t > 0.0 ? t : -1.0;
  }

  // Bruneton's transmittance LUT parameterisation.
  vec2 tParamsToUv(float r, float mu) {
    float H = sqrt(Rt * Rt - Rb * Rb);
    float rho = sqrt(max(r * r - Rb * Rb, 0.0));
    float disc = r * r * (mu * mu - 1.0) + Rt * Rt;
    float d = max(-r * mu + sqrt(max(disc, 0.0)), 0.0);
    float dMin = Rt - r;
    float dMax = rho + H;
    return vec2((d - dMin) / (dMax - dMin), rho / H);
  }

  float phaseR(float c) { return 3.0 / (16.0 * 3.14159265) * (1.0 + c * c); }
  float phaseM(float c) {
    const float g = 0.8;
    float g2 = g * g;
    return 3.0 / (8.0 * 3.14159265) * ((1.0 - g2) * (1.0 + c * c)) /
      ((2.0 + g2) * pow(1.0 + g2 - 2.0 * g * c, 1.5));
  }
`;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const TRANSMITTANCE_FRAG =
  COMMON +
  /* glsl */ `
  varying vec2 vUv;
  void main() {
    // Inverse of tParamsToUv.
    float H = sqrt(Rt * Rt - Rb * Rb);
    float rho = H * vUv.y;
    float r = sqrt(rho * rho + Rb * Rb);
    float dMin = Rt - r;
    float dMax = rho + H;
    float d = dMin + vUv.x * (dMax - dMin);
    float mu = d == 0.0 ? 1.0 : (H * H - rho * rho - d * d) / (2.0 * r * d);
    mu = clamp(mu, -1.0, 1.0);

    const int N = 40;
    float dt = d / float(N);
    vec3 tau = vec3(0.0);
    for (int i = 0; i < N; i++) {
      float ti = (float(i) + 0.5) * dt;
      float h = sqrt(r * r + ti * ti + 2.0 * r * ti * mu) - Rb;
      tau += extinction(h) * dt;
    }
    gl_FragColor = vec4(exp(-tau), 1.0);
  }
`;

const MULTISCATTER_FRAG =
  COMMON +
  /* glsl */ `
  uniform sampler2D tLut;
  varying vec2 vUv;

  vec3 sunT(float r, float mu) {
    return texture2D(tLut, tParamsToUv(r, mu)).rgb;
  }

  void main() {
    float muS = vUv.x * 2.0 - 1.0;
    float r = Rb + vUv.y * (Rt - Rb) + 1.0;
    vec3 sunDir = vec3(sqrt(1.0 - muS * muS), muS, 0.0);

    // Hillaire eq. 5-7: integrate second-order luminance and the
    // multiple-scattering transfer over the sphere, then the geometric
    // series gives Psi_ms = L2 / (1 - f_ms).
    vec3 L2 = vec3(0.0);
    vec3 fms = vec3(0.0);
    const int DIRS = 64;
    for (int i = 0; i < DIRS; i++) {
      // spherical Fibonacci directions
      float fi = float(i) + 0.5;
      float cosT = 1.0 - 2.0 * fi / float(DIRS);
      float sinT = sqrt(max(1.0 - cosT * cosT, 0.0));
      float phi = fi * 2.399963;
      vec3 dir = vec3(sinT * cos(phi), cosT, sinT * sin(phi));

      float mu = dir.y;
      float dGround = raySphere(r, mu, Rb);
      float dTop = raySphere(r, mu, Rt);
      float dEnd = dGround > 0.0 ? dGround : dTop;
      const int STEPS = 20;
      float dt = dEnd / float(STEPS);
      vec3 T = vec3(1.0);
      vec3 Li = vec3(0.0);
      vec3 fi3 = vec3(0.0);
      float cSun = dot(dir, sunDir);
      for (int s = 0; s < STEPS; s++) {
        float ti = (float(s) + 0.5) * dt;
        float ri = sqrt(r * r + ti * ti + 2.0 * r * ti * mu);
        float h = ri - Rb;
        vec3 dens = densities(h);
        vec3 scat = rayleighS * dens.x + mieS0 * mieScale * dens.y;
        vec3 ext = extinction(h);
        // sun zenith cosine at the sample point (spherical earth)
        float muSi = clamp((r * muS + ti * dot(dir, sunDir)) / ri, -1.0, 1.0);
        vec3 Ts = sunT(ri, muSi);
        vec3 S = scat * (phaseR(cSun) + phaseM(cSun)) * 0.5 * Ts;
        vec3 stepT = exp(-ext * dt);
        // energy-conserving integration (Hillaire appendix)
        Li += T * (S - S * stepT) / max(ext, vec3(1e-9));
        fi3 += T * (scat - scat * stepT) / max(ext, vec3(1e-9));
        T *= stepT;
      }
      if (dGround > 0.0) {
        // ground bounce with albedo 0.3
        float muSg = clamp((r * muS + dGround * dot(dir, sunDir)) / Rb, -1.0, 1.0);
        Li += T * sunT(Rb, muSg) * max(muSg, 0.0) * 0.3 / 3.14159265;
      }
      L2 += Li / float(DIRS);
      fms += fi3 / float(DIRS);
    }
    vec3 psi = L2 / max(vec3(1.0) - fms, vec3(1e-4));
    gl_FragColor = vec4(psi, 1.0);
  }
`;

const SKYVIEW_FRAG =
  COMMON +
  /* glsl */ `
  uniform sampler2D tLut;
  uniform sampler2D msLut;
  uniform float sunMu;   // cos of sun zenith angle
  uniform float camH;    // camera height above ground, metres
  varying vec2 vUv;

  vec3 sunT(float r, float mu) {
    return texture2D(tLut, tParamsToUv(r, mu)).rgb;
  }
  vec3 psiMS(float r, float mu) {
    return texture2D(msLut, vec2(mu * 0.5 + 0.5, (r - Rb) / (Rt - Rb))).rgb;
  }

  void main() {
    float r = Rb + max(camH, 1.0);
    // uv.y: sqrt-warped view elevation split at the horizon (Hillaire's
    // parameterisation keeps detail where the gradients live).
    float horizon = -sqrt(max(r * r - Rb * Rb, 0.0)) / r; // cos of horizon zenith? (sin of dip)
    float hAngle = asin(clamp(horizon, -1.0, 1.0));       // negative dip
    float v = vUv.y;
    float elev;
    if (v < 0.5) {
      float c = 1.0 - v * 2.0;
      elev = hAngle - c * c * (hAngle + 1.5707963);
    } else {
      float c = v * 2.0 - 1.0;
      elev = hAngle + c * c * (1.5707963 - hAngle);
    }
    // uv.x: azimuth relative to the sun, 0..pi (sky is symmetric).
    float relAz = vUv.x * 3.14159265;

    float se = sin(elev);
    float ce = cos(elev);
    vec3 dir = vec3(ce * cos(relAz), se, ce * sin(relAz));
    float sunS = sqrt(max(1.0 - sunMu * sunMu, 0.0));
    vec3 sunDir = vec3(sunS, sunMu, 0.0);

    float mu = dir.y;
    float dGround = raySphere(r, mu, Rb);
    float dTop = raySphere(r, mu, Rt);
    float dEnd = dGround > 0.0 ? dGround : dTop;
    dEnd = max(dEnd, 0.0);

    const int STEPS = 32;
    float dt = dEnd / float(STEPS);
    vec3 T = vec3(1.0);
    vec3 L = vec3(0.0);
    float cSun = dot(dir, sunDir);
    for (int s = 0; s < STEPS; s++) {
      float ti = (float(s) + 0.5) * dt;
      float ri = sqrt(r * r + ti * ti + 2.0 * r * ti * mu);
      float h = ri - Rb;
      vec3 dens = densities(h);
      vec3 scatR = rayleighS * dens.x;
      vec3 scatM = vec3(mieS0 * mieScale * dens.y);
      vec3 ext = extinction(h);
      float muSi = clamp((r * sunMu + ti * cSun) / ri, -1.0, 1.0);
      vec3 Ts = sunT(ri, muSi);
      vec3 S = (scatR * phaseR(cSun) + scatM * phaseM(cSun)) * Ts +
               (scatR + scatM) * psiMS(ri, muSi);
      vec3 stepT = exp(-ext * dt);
      L += T * (S - S * stepT) / max(ext, vec3(1e-9));
      T *= stepT;
    }
    gl_FragColor = vec4(L, 1.0);
  }
`;

const AERIAL_FRAG =
  COMMON +
  /* glsl */ `
  uniform sampler2D tLut;
  uniform sampler2D msLut;
  uniform float sunMu;
  uniform float camH;
  uniform float maxDistM;
  varying vec2 vUv;

  vec3 sunT(float r, float mu) {
    return texture2D(tLut, tParamsToUv(r, mu)).rgb;
  }
  vec3 psiMS(float r, float mu) {
    return texture2D(msLut, vec2(mu * 0.5 + 0.5, (r - Rb) / (Rt - Rb))).rgb;
  }

  // Hillaire's aerial perspective, specialised to near-horizontal rays:
  // every fog-receiving fragment in this scene sits within a few degrees
  // of the camera's horizon, so the froxel volume collapses to
  // (relative azimuth x distance). rgb = inscattered radiance,
  // a = mean transmittance.
  void main() {
    float relAz = vUv.x * 3.14159265;
    float dist = vUv.y * maxDistM;
    float r = Rb + max(camH, 1.0);
    vec3 dir = vec3(cos(relAz), 0.0, sin(relAz));
    float sunS = sqrt(max(1.0 - sunMu * sunMu, 0.0));
    vec3 sunDir = vec3(sunS, sunMu, 0.0);
    float cSun = dot(dir, sunDir);

    const int STEPS = 20;
    float dt = dist / float(STEPS);
    vec3 T = vec3(1.0);
    vec3 L = vec3(0.0);
    for (int s = 0; s < STEPS; s++) {
      float ti = (float(s) + 0.5) * dt;
      float ri = sqrt(r * r + ti * ti);
      float h = ri - Rb;
      vec3 dens = densities(h);
      vec3 scatR = rayleighS * dens.x;
      vec3 scatM = vec3(mieS0 * mieScale * dens.y);
      vec3 ext = extinction(h);
      float muSi = clamp((r * sunMu + ti * cSun) / ri, -1.0, 1.0);
      vec3 Ts = sunT(ri, muSi);
      vec3 S = (scatR * phaseR(cSun) + scatM * phaseM(cSun)) * Ts +
               (scatR + scatM) * psiMS(ri, muSi);
      vec3 stepT = exp(-ext * dt);
      L += T * (S - S * stepT) / max(ext, vec3(1e-9));
      T *= stepT;
    }
    gl_FragColor = vec4(L, dot(T, vec3(0.3333)));
  }
`;

const DOME_FRAG = /* glsl */ `
  uniform sampler2D skyLut;
  uniform sampler2D tLutD;
  uniform vec3 sunDirW;
  uniform float camHD;
  uniform float exposure;
  varying vec3 vDir;

  const float RbD = 6360e3;
  const float RtD = 6460e3;

  vec2 tUv(float r, float mu) {
    float H = sqrt(RtD * RtD - RbD * RbD);
    float rho = sqrt(max(r * r - RbD * RbD, 0.0));
    float disc = r * r * (mu * mu - 1.0) + RtD * RtD;
    float d = max(-r * mu + sqrt(max(disc, 0.0)), 0.0);
    return vec2((d - (RtD - r)) / (rho + H - (RtD - r)), rho / H);
  }

  void main() {
    vec3 v = normalize(vDir);
    float r = RbD + max(camHD, 1.0);
    float horizon = -sqrt(max(r * r - RbD * RbD, 0.0)) / r;
    float hAngle = asin(clamp(horizon, -1.0, 1.0));
    float elev = asin(clamp(v.y, -1.0, 1.0));
    float uy;
    if (elev < hAngle) {
      uy = 0.5 - 0.5 * sqrt(clamp((hAngle - elev) / (hAngle + 1.5707963), 0.0, 1.0));
    } else {
      uy = 0.5 + 0.5 * sqrt(clamp((elev - hAngle) / (1.5707963 - hAngle), 0.0, 1.0));
    }
    vec2 sunH = normalize(vec2(sunDirW.x, sunDirW.z) + 1e-6);
    vec2 vH = normalize(vec2(v.x, v.z) + 1e-6);
    float relAz = acos(clamp(dot(sunH, vH), -1.0, 1.0));
    vec3 col = texture2D(skyLut, vec2(relAz / 3.14159265, uy)).rgb;

    // The sun disc itself: direct transmittance, honestly clipped by ACES.
    float cSun = dot(v, sunDirW);
    if (cSun > 0.9999893) {
      col += texture2D(tLutD, tUv(r, v.y)).rgb * 120.0;
    }
    gl_FragColor = vec4(col * exposure, 1.0);
  }
`;

function pass(renderer, material, target) {
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  renderer.setRenderTarget(target);
  renderer.render(scene, cam);
  renderer.setRenderTarget(null);
}

function makeTarget(w, h) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false
  });
}

export function createAtmosphere(renderer) {
  const gl = renderer.getContext();
  const ok =
    renderer.capabilities.isWebGL2 &&
    !!gl.getExtension('EXT_color_buffer_float');
  if (!ok) return {ok: false};

  const tLut = makeTarget(256, 64);
  const msLut = makeTarget(32, 32);
  const skyLut = makeTarget(192, 108);
  const aerialLut = makeTarget(64, 32);
  const MAX_DIST_M = 25700; // 450 scene units at 57.14 m/unit

  const mieU = {value: 1};
  const tMat = new THREE.ShaderMaterial({
    uniforms: {mieScale: mieU},
    vertexShader: VERT,
    fragmentShader: TRANSMITTANCE_FRAG
  });
  const msMat = new THREE.ShaderMaterial({
    uniforms: {mieScale: mieU, tLut: {value: tLut.texture}},
    vertexShader: VERT,
    fragmentShader: MULTISCATTER_FRAG
  });
  const svUniforms = {
    mieScale: mieU,
    tLut: {value: tLut.texture},
    msLut: {value: msLut.texture},
    sunMu: {value: 0.5},
    camH: {value: 300}
  };
  const svMat = new THREE.ShaderMaterial({
    uniforms: svUniforms,
    vertexShader: VERT,
    fragmentShader: SKYVIEW_FRAG
  });
  const aerialUniforms = {
    mieScale: mieU,
    tLut: {value: tLut.texture},
    msLut: {value: msLut.texture},
    sunMu: {value: 0.5},
    camH: {value: 300},
    maxDistM: {value: MAX_DIST_M}
  };
  const aerialMat = new THREE.ShaderMaterial({
    uniforms: aerialUniforms,
    vertexShader: VERT,
    fragmentShader: AERIAL_FRAG
  });

  const domeU = {
    skyLut: {value: skyLut.texture},
    tLutD: {value: tLut.texture},
    sunDirW: {value: new THREE.Vector3(0, 1, 0)},
    camHD: {value: 300},
    exposure: {value: 28}
  };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1400, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: domeU,
      vertexShader:
        'varying vec3 vDir; void main(){ vDir = position;' +
        ' gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: DOME_FRAG
    })
  );
  mesh.renderOrder = -3;

  let lutsBuilt = false;
  let lastMie = -1;
  function buildLuts() {
    pass(renderer, tMat, tLut);
    pass(renderer, msMat, msLut);
    lutsBuilt = true;
    lastMie = mieU.value;
  }

  return {
    ok: true,
    mesh,
    aerialTex: aerialLut.texture,
    aerialMaxUnits: MAX_DIST_M / 57.14,
    // Called each frame: cheap sky-view raymarch for the current sun.
    // exposure models the eye's photopic adaptation (tone reproduction,
    // not physics): twilight is genuinely darker, but not pitch black.
    update(sunDir, mieScale, camHMetres, exposure) {
      mieU.value = mieScale;
      // Aerosols change slowly; rebuild the static LUTs only when the
      // measured AOD moves.
      if (!lutsBuilt || Math.abs(mieScale - lastMie) > 0.05) buildLuts();
      svUniforms.sunMu.value = sunDir.y;
      svUniforms.camH.value = camHMetres;
      aerialUniforms.sunMu.value = sunDir.y;
      aerialUniforms.camH.value = camHMetres;
      domeU.sunDirW.value.copy(sunDir);
      domeU.camHD.value = camHMetres;
      if (exposure) domeU.exposure.value = exposure;
      pass(renderer, svMat, skyLut);
      pass(renderer, aerialMat, aerialLut);
    }
  };
}

// CPU mirror of the transmittance integral, so the sun's light on the
// terrain carries its true transmitted colour (sunset reddening included).
export function sunTransmittanceJS(cosZenith, mieScale) {
  const Rb = 6360e3;
  const Rt = 6460e3;
  const r = Rb + 300;
  const mu = cosZenith;
  const b = r * mu;
  // Below the horizon the planet itself shadows the sun.
  if (mu < 0 && b * b - (r * r - Rb * Rb) > 0) return [0, 0, 0];
  const disc = b * b - (r * r - Rt * Rt);
  if (disc < 0) return [0, 0, 0];
  const d = -b + Math.sqrt(disc);
  if (d <= 0) return [0, 0, 0];
  const N = 32;
  const dt = d / N;
  let tr = 0;
  let tm = 0;
  let to = 0;
  for (let i = 0; i < N; i++) {
    const ti = (i + 0.5) * dt;
    const h = Math.sqrt(r * r + ti * ti + 2 * r * ti * mu) - Rb;
    tr += Math.exp(-h / 8000) * dt;
    tm += Math.exp(-h / 1200) * dt;
    to += Math.max(0, 1 - Math.abs(h - 25e3) / 15e3) * dt;
  }
  const mie = (3.996e-6 + 4.4e-6) * mieScale * tm;
  return [
    Math.exp(-(5.802e-6 * tr + mie + 0.65e-6 * to)),
    Math.exp(-(13.558e-6 * tr + mie + 1.881e-6 * to)),
    Math.exp(-(33.1e-6 * tr + mie + 0.085e-6 * to))
  ];
}
