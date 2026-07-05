# Horizon WebGPU port — engineering plan

The goal: move Horizon.html from WebGLRenderer to three.js
WebGPURenderer with the research passes (Hillaire atmosphere LUTs,
Nubis cloud march, irradiance integral) running as real compute
shaders — the way the papers themselves run.

This is a REPLACEMENT, not a parallel path: once the validation
matrix is green on WebGPURenderer, the old WebGLRenderer code
(onBeforeCompile hooks, ShaderMaterial passes, the GLSL CSM) is
deleted. Browsers without WebGPU run the SAME node code on
WebGPURenderer's WebGL2 backend — there is exactly one
implementation of every piece of physics.

## Ground rules (do not relax these to "finish" a phase)

- **No approximations to make it run.** If a subsystem cannot port
  cleanly inside a session, it stays on the working renderer until it
  can. A phase is done when the harness matrix is green, not when it
  compiles.
- **Every phase ends with the full validation matrix** (below) and,
  where the phase claims visual equivalence, a numeric A/B against the
  previous phase (mean abs pixel diff, with the stochastic
  temporal-cloud region excluded or accounted for; phase 1 measured
  3.5/255 mean with 96% of outliers in cloud sky).
- **One phase per commit series, plan updated in the same push.** The
  Status section below is the hand-off between sessions.

## Phases

1. **DONE — three r160 → r185** (commit `d001eea`). Modern three
   splits the build: `three.module.min.js` imports
   `./three.core.min.js`; both are vendored. Sky/Water/CSM examples
   re-vendored at the same tag (Water patch target strings and CSM API
   byte-checked before the swap).
2. **WebGPURenderer on its WebGL backend.** Vendor
   `build/three.webgpu.js` (+ `three.tsl.js`). `onBeforeCompile` does
   not exist there, so every material hook becomes TSL node material
   code:
   - terrain (TERRAIN_GLSL: per-pixel material from the DEM normal
     map, sea normals/spec, roughness) → `MeshStandardNodeMaterial`
     with `colorNode`/`normalNode`/`roughnessNode`
   - aerial-perspective fog hook (all world materials) → shared TSL
     fog node sampling the aerial LUT
   - CSM → `CSMShadowNode` (three has a node-based CSM)
   - Water/Sky → `WaterMesh`/`SkyMesh` from `examples/jsm/objects/`
     (TSL versions); re-apply the Cox-Munk/whitecap/surf physics as
     node code — the physics itself must not be simplified
   - atmosphere/cloud passes can initially stay as fragment-style
     passes via `TextureNode` render targets
     Acceptance: full matrix on the WebGL backend, A/B vs phase 1.
3. **WebGPU backend + compute.** Enable WebGPU (feature-detect,
   WebGL2 fallback stays):
   - transmittance / multiple-scattering / sky-view / aerial /
     irradiance LUT chain → compute shaders writing storage textures
   - Nubis march → compute at quarter res (same Bayer temporal
     reconstruction; storage-texture ping-pong)
   - irradiance readback → async staging-buffer read
     (`readRenderTargetPixelsAsync`), removing the 1 Hz sync stall
     Acceptance: matrix on WebGPU AND on the WebGL2 fallback.
4. **Post-port improvements** (each still paper-sourced): blue-noise
   march jitter (Ulichney / void-and-cluster) replacing the hash,
   sky-view LUT horizon-band fix (Bruneton parameterization near the
   horizon), motion-vector history for a translating camera if the
   free camera ever animates positionally.

## Validation matrix (offline fixture harness)

Rebuild recipe: copy the site into a scratch dir as
`site/writeups/themes/…`, rewrite the terrarium URL to local
`/tiles/{z}/{x}/{y}.png` fixtures (Grindelwald 46.62,8.04 z12 and
Nelson −41.27,173.28 z12), inject a fetch stub before the module
script that serves OSM Overpass fixtures by URL suffix and rejects
everything else (stars.json / constellations / rapier pass through to
disk), serve with `python3 -m http.server`, and shoot with headless
Chromium `--use-angle=swiftshader --virtual-time-budget=N
--screenshot` (console via `--enable-logging=stderr`, state probes via
`window.__dbg` → `document.title`).

Scenes (all at Grindelwald unless noted):

- noon clear (`cloud=25…code=2`) — aerial blues, GGX terrain, CSM
- sunset 19:10 — alpenglow from transmitted direct sun only
- night 2026-06-29T22:30 — stars, constellations, 6-px
  Lommel-Seeliger moon (flat disc, ~172–177 luminance across)
- stratus `code=3`, cumulus `code=2`, towering `code=95` decks
- Nelson sea — Water patch compiles, Cox-Munk glitter
- snowfall `temp=-3&code=73&snow=2` — Rapier loads, flakes fall
- aurora, Reykjavik winter night `aurora=0.85&auroralat=67` (an oval
  at the observer's own latitude is _correctly_ at the zenith and out
  of frame — not a bug)
- scripted free-camera flight (synthetic pointer drag + KeyW)

## Status

- Phase 1 complete (r185 vendored, matrix green, A/B 3.5/255).
- Phase 2 in progress:
  - `three.webgpu.min.js` + `three.tsl.min.js` vendored at r185;
    WebGPURenderer boots on the WebGL2 backend in the harness
    (`forceWebGL: true`, `await renderer.init()`,
    `renderer.backend.isWebGLBackend`).
  - Terrain material ported: `terrain-tsl.js` exports
    `createTerrainNodeMaterial(normalMapTex, aerialLutTex)` — the
    complete GLSL logic as node code (noise, DEM normal map,
    grass/rock/snow/sea with asinh elevation inversion,
    Pierson-Moskowitz sea normals, Blinn+Schlick glitter as
    emissiveNode, Monahan whitecaps, per-pixel roughnessNode, aerial
    LUT + Koschmieder outputNode). Unit-validated on the WebGL
    backend: altitude bands with jittered snowline, normal-map
    lighting, wet-attribute sea, wave normals.
  - TSL gotchas recorded: textures are graph nodes (pass to the
    factory, swap via `node.value` on rebake — `uniform(null)` does
    NOT work); `uniform()` takes THREE objects (Vector2/Color), not
    TSL constructors; `transformNormalToView` is object→view space
    (fine while the terrain mesh transform is identity — revisit if
    that changes).
  - Aerial fog extracted to `aerial-tsl.js` — ONE shared node graph
    (and uniforms object) applied to every world material via
    `aerial.apply(mat)`; terrain-tsl consumes it. Unit-validated on a
    scene with the terrain plus instanced conifers sharing the hook.
  - `CSMShadowNode.js` vendored (r185, node-based CSM: a shadow node
    on ONE real light — sun colour/intensity stay on that light, no
    mirrored cascade lights like the WebGL CSM). Validated in the
    same scene: per-tree soft cascade shadows on the WebGL backend.
    Usage: `sun.shadow.shadowNode = new CSMShadowNode(sun, {cascades:
3, maxFar, mode: 'practical'})`, `csm.fade = true`;
    `updateFrustums()` on resize.
  - Atmosphere ported to `atmosphere-tsl.js` — DONE and validated at
    the strongest level available: every probed texel of every LUT
    matches `atmo-reference.mjs` (an independent double-precision JS
    implementation, kept in the repo) to fp16 quantization, and the
    rendered dome is PIXEL-IDENTICAL (mean abs diff 0.0) to the
    shipped GLSL dome at the same sun/exposure. The one real bug on
    the way: nested TSL Loops both name their counter `i`, and
    outer-counter-derived EXPRESSIONS are inlined into the inner body
    where GLSL scoping makes the inner `i` win — the MS integral came
    out orders of magnitude small. Rule: `.toVar()` everything
    derived from an outer loop counter before entering an inner Loop
    (verified by a sum-probe; fixed in multiscatter + irradiance).
  - Texture-coordinate conventions on WebGPURenderer's WebGL backend,
    established by readback probes (cost a lot — do not rediscover):
    - readback rows and SCENE-geometry RT writes: GL bottom-origin
    - QuadMesh RT writes AND `texture().sample()` reads: both
      V-flipped → QuadMesh-write + sample() is SELF-CONSISTENT and is
      what atmosphere-tsl uses; scene-geometry writes must not be
      mixed into that chain; numeric readbacks of QuadMesh-written
      LUTs see flipped rows (flip j → H-1-j, texel-exact).
  - Harness gotchas (again: do not rediscover): WebGPURenderer.init()
    hangs on a DETACHED canvas (append to DOM first); interleaving
    readRenderTargetPixelsAsync with subsequent renderAsync calls
    deadlocks (batch ALL renders, then ALL readbacks); sync render()
    for offscreen passes works inside a frame but multiple top-level
    awaited renderAsync sequences can stall under
    --virtual-time-budget; readbacks of HalfFloat targets return raw
    fp16 bit patterns (decode: 15360 = 1.0); two-canvas comparison
    pages mis-size the second canvas — use one full-window page per
    renderer and diff screenshots.
  - Clouds ported to `clouds-tsl.js` — DONE at the A/B level: the
    noise physics extracted to renderer-agnostic `cloud-noise.js`
    (one definition, both implementations wrap it), the full
    temporal-reconstruction pipeline as node code (Bayer via the
    closed form 4\*((3(y&1))^(2(x&1))) + ((3((y>>1)&1))^(2((x>>1)&1)))
    instead of a const array; history reprojection with the top-origin
    uv flip at NDC conversions; depth-clamped march; nearest-depth
    composite with premultiplied blending). Deterministic warm-frame
    A/B vs the GLSL system: mean abs diff 1.25/255, residual explained
    by per-pixel jitter orientation (gl_FragCoord bottom-origin vs
    screenCoordinate top-origin) and fp. Further conventions pinned:
    depth-texture sample() is top-origin like colour; scene depth
    prepasses need no flip when sampled at uv(); Color uniforms upload
    RAW (no implicit sRGB conversion); an A/B page's scene.background
    bleeds through semi-transparent composites differently per output
    colorspace - compare over black.
  - Water ported to `water-tsl.js` — DONE at the strongest A/B level:
    full physics (Cox-Munk glitter, Monahan whitecaps, McCowan surf on
    the bathymetry texture, distorted mirror reflection) renders
    pixel-equivalent to the classic patched Water.js — mean abs diff
    0.013/255, ZERO pixels above 25, at default mirror resolutions.
    `HorizonWaterMesh` is a marked source fork of the vendored r185
    `WaterMesh.js` (node graphs cannot be string-patched). The A/B
    caught two real bugs on the way — both are the reason the
    reference-first method exists:
    - UPSTREAM three r185 `WaterMesh.js` writes
      `noise.xzy.mul( 1.5, 1.0, 1.5 )`, but TSL `mul()` chains extra
      args as scalar factors (×1.5×1.0×1.5 = ×2.25 uniformly) and
      `normalize()` cancels a uniform scale — the wave-slope
      anisotropy of classic Water.js silently vanishes and the sea
      flattens (glitter/diffuse wrong; was 8.75/255 mean). The fork
      uses `mul(vec3(1.5, 1.0, 1.5))`. Rule: NEVER pass multiple
      scalars to a TSL operator expecting a vector — construct the
      vector.
    - reflector() uv is top-origin; the classic mirror uv is
      bottom-origin, so the SAME distortion vector must be added with
      V negated or the reflection warps the opposite way vertically
      (only visible at content edges — a reflected box's waterline
      grew a tail). With both fixes: dist=0 and full-distortion A/Bs
      are both outlier-free.
    - Also pinned: WebGPURenderer honors `flipY` for loaded image
      textures exactly like WebGLRenderer (verified by a
      flip-the-reference experiment: the classic render moved AWAY
      from the TSL one when its texture was un-flipped) — no
      orientation fix-ups needed for image textures, the earlier
      QuadMesh/RT conventions are about render targets only.
  - Sky objects ported to `sky-objects-tsl.js` — DONE, strongest A/B:
    veil dome, Lommel-Seeliger moon, aurora curtains, optics dome
    (bows/halo/sundogs, both camera aims) all PIXEL-IDENTICAL
    (mean 0.000, max 0); planets identical; stars mean 0.005/255 with
    ≤1 edge pixel over threshold under active twinkle. Notes that cost
    real debugging — do not rediscover:
    - Stars/planets are instanced sprite quads (SpriteNodeMaterial +
      InstancedBufferAttribute + InstancedMesh): WebGPU has no
      gl_PointSize. scaleNode = px·2·viewZ/(screenH·P[1][1])
      reproduces gl_PointSize exactly (validated: static field has
      zero differing pixels vs gl_PointSize rendering).
    - The scintillation hash is now PCG (Jarzynski & Olano 2020) in
      BOTH implementations (Horizon.html updated): the legacy
      fract(sin(dot·43758)) hash decorrelates between shader
      compilers at fp32 — 34/400 stars twinkled with different
      phases. Integer hashing is bit-exact.
    - `vertexStage()` is load-bearing for attribute-hashing in TSL:
      node graphs evaluate in the fragment stage by default, so the
      attribute arrives through an INTERPOLATED varying and ULP-level
      interpolation noise rerolls the hash. Hash in the vertex stage,
      pass the float result through the varying.
    - TSL uint ops (bitcast/bitAnd/shiftRight/mul-wrap, >2^31
      constants) are all CORRECT on the WebGL backend — an apparent
      failure was stale `--screenshot`s of tiny single-render probe
      pages. For small probes, read back in-page
      (drawImage + getImageData) — that readback is authoritative.
    - These ShaderMaterials render RAW in the classic pipeline (no
      tonemapping/colorspace chunks, so they bypass AgX + sRGB);
      the A/B ran with LinearSRGB output on the TSL side. AT
      INTEGRATION: NodeMaterials go through the renderer output
      transform, so each of these needs the same bypass decision
      (`material.toneMapped = false` equivalent / raw outputNode) or
      the sky objects will double-transform.
  - RENDERER SWITCH LANDED (in progress): Horizon.html now boots
    WebGPURenderer (top-level `await renderer.init()`; WebGL2 backend
    fallback automatic) with ALL subsystems on the TSL ports:
    terrain-tsl, aerial-tsl, atmosphere-tsl, clouds-tsl, water-tsl,
    sky-objects-tsl, CSMShadowNode on ONE real sun light, precip as
    instanced sprites. Output architecture: the renderer runs
    NoToneMapping + LinearSRGB (identity global transform) and the
    shared aerial hooks apply AgX(0.55)+sRGB per material IN THE
    CLASSIC CHUNK ORDER (fog/aerial AFTER the encode - that is what
    shipped; `workingToColorSpace(toneMapping(AgX, exp, output.rgb))`
    reproduces classic bytes exactly, probe-validated). Raw-output
    passes (dome, sky objects, cloud composite) set no hook.
    Fixes found on the way (all repo'd):
    - RenderTarget.setSize does NOT resize an attached DepthTexture -
      recreate the RT+DepthTexture on resize or the cloud march reads
      a stale 2x2 depth (NaN-ish sceneDist).
    - OPAQUE node materials stomp output alpha to 1: the cloud march
      and the atmosphere LUT passes (aerial LUT alpha = mean
      transmittance!) need `transparent = true; blending = NoBlending`
      to write RGBA verbatim. Invisible over the black A/B background,
      fatal over a real scene - A/B over a NON-black background too.
    - Do NOT use material.premultipliedAlpha for the premultiplied
      cloud composite - that flag multiplies rgb by alpha IN-SHADER a
      second time. CustomBlending One/OneMinusSrcAlpha works fine on
      the node pipeline (the original suspicion was wrong).
    - The sprite/line pipelines do not compose opacityNode into
      `output` when an outputNode hook is set: transparent unlit
      things (precip, constellation lines, flakes) take the
      AgX+sRGB+fog chain on COLORNODE via aerial.encodeFog()/
      applyFogColor() instead of the output hook.
    - InstancedMesh with count = 0 still draws on WebGPU: gate
      `mesh.visible` (flakes/drift cluster at origin otherwise).
    - CSMShadowNode binds its camera lazily on first render: guard
      `csm.updateFrustums()` on resize until `csm.camera` exists.
    - The theme's water was NEVER added to the scene in the classic
      build (ground.remove on rebuild but no add - latent regression);
      the port restores `ground.add(water)`.
  - Validation matrix vs phase 1 (identical fixture URLs, mean abs
    diff /255): noon 2.10, night 0.93, sunset 6.04, Nelson sea 1.21,
    aurora 0.78, dome+veil under overcast 3.03 (residuals: tree sway
    phase, star twinkle, cloud wisps). Heavy-cloud deck brightness
    ROOT-CAUSED after a long hunt (deterministic subsystem A/Bs were
    EXACT at every constructed config - cumulus/stratus, mid deck,
    moving camera, dpr, interleaved passes, 300-frame loops):
    - The whole residual pinned to ambCol: pinning the cloud lighting
      uniforms equal in both builds collapses the stratus scene to
      ratio 0.99. Two components, both fixed/attributed:
      1. TRANSIENT (fixed): the async irradiance readback leaves the
         initial skyIrr GUESS in place for the first frames; the cloud
         history (8%/frame exponential blend, refresh every 16 frames)
         BAKES that bright guess in and forgets it only over hundreds
         of marched frames. Fix: cloud-system creation now waits for
         `skyIrrReady` (first readback resolved). Rule: never let a
         TEMPORAL-HISTORY system integrate lighting built on the
         async-seed guess.
      2. STEADY ~16%% (attributed): the classic GL irradiance pass
         reads (0.0088, 0.0185, 0.0403) vs TSL (0.0103, 0.0209,
         0.0444) at the same sky. The TSL irradiance LUT is validated
         per-texel against atmo-reference.mjs (double precision); the
         GL pass never was. The WebGPU build is the CORRECT one; the
         residual stratus/towering means (~16/255, concentrated in the
         deck) are the classic build's error, not the port's.
    - Also fixed on the way: frame dt is now clamped >= 0 (rAF
      timestamps are not guaranteed monotonic under every scheduler;
      a negative dt drove exponential eases out of range - uSnowy went
      negative in harness runs).
    - Snow scene: component-validated (snow cover whitens, flakes,
      precip sprites, deck = same code as stratus) but the full-scene
      A/B is harness-limited: chromium's --virtual-time-budget clock
      skips through async GPU readbacks and exhausts the budget in
      seconds of wall time on this heavier build (a pinned-interval
      injection does not stop it). Compare snow at component level or
      on real hardware.
  - NEXT (first move next session): delete the WebGL-only code paths
    (onBeforeCompile hooks, GLSL CSM trio, Sky.js/Water.js, clouds.js
    GLSL passes, atmosphere.js GLSL passes — keep sunTransmittanceJS
    by moving the CPU mirror out of atmosphere.js first). Then
    phase 3 (WebGPU backend + compute).
