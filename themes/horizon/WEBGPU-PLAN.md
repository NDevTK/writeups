# Horizon WebGPU port — engineering plan

The goal: move Horizon.html from WebGLRenderer to three.js
WebGPURenderer with the research passes (Hillaire atmosphere LUTs,
Nubis cloud march, irradiance integral) running as real compute
shaders — the way the papers themselves run.

This is a REPLACEMENT, not a parallel path: once the validation
matrix is green on WebGPURenderer, the old WebGLRenderer code
(onBeforeCompile hooks, ShaderMaterial passes, the GLSL CSM) is
deleted. There is exactly one implementation of every piece of
physics. UPDATE (owner decision, phase 5): the build is WebGPU-ONLY
— the WebGL2 backend of WebGPURenderer and every raster driver that
served it are deleted too (see the "WebGPU-ONLY" status entry);
browsers without WebGPU get a caption, not a fallback.

## Ground rules (do not relax these to "finish" a phase)

- **No approximations to make it run.** If a subsystem cannot port
  cleanly inside a session, it stays on the working renderer until it
  can. A phase is done when the harness matrix is green, not when it
  compiles.
- **Every phase ends validated.** Historically that meant the full
  pinned matrix plus a numeric A/B (two engines); with the
  WebGPU-only build there is no A/B of any kind — a phase ends with
  its CPU double-precision reference green and its numeric probe
  reading GPU texels back at the reference values (harness/
  validate.sh). Full-matrix smoke sweeps are NOT part of the
  per-item gate (owner direction 2026-07-06: stop verifying all
  scenes) — shoot a single affected scene only when a change
  plausibly breaks page load, and rely on PAGEERROR in that log.
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
disk), and serve with `python3 -m http.server`.

Shooting: a Node driver (playwright-core) that SPAWNS Chrome for
Testing itself (headed, under `xvfb-run`) and attaches via
`connectOverCDP`, waits for a console marker, then captures by
replaying one full frame into a `RenderTarget` in-page
(`readRenderTargetPixelsAsync`) and writing a PPM. Every piece is
forced by a measured failure — see "Real-WebGPU harness" below. The
old `--virtual-time-budget --screenshot` recipe only works for
WebGL-backend pages without async GPU readbacks; the driver replaces
it for both backends.

Determinism: animated scenes (cloud advection, water, twinkle) cannot
be A/B'd across two wall-clock runs. The harness page accepts
`pin=1[&pinstop=N]`: rAF callbacks get synthetic 60 Hz timestamps
(`performance.now` follows), `Math.random` is a seeded LCG, and at
frame N (default 600) the clock FREEZES while rAF keeps dispatching —
dt becomes 0, uTime stops, the frame is capture-time-invariant, and a
`PINSTOP` console line tells the driver to shoot. Freezing (not
stopping) rAF matters: three's WebGL-backend async readback polls its
fence via rAF, so a hard rAF stop deadlocks the capture itself.

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
  - LEGACY DELETION DONE — phase 2 complete. Removed: atmosphere.js,
    clouds.js, Sky.js, Water.js, CSM.js, CSMShader.js,
    three.module.min.js (the classic build; `three` now maps to the
    webgpu build). Kept: CSMFrustum.js (imported by CSMShadowNode),
    WaterMesh.js (provenance for the water-tsl fork),
    cloud-noise.js / atmo-reference.mjs (single-source physics and
    ground truth). sunTransmittanceJS moved to sun-transmittance.js.
    Post-deletion harness check: noon 2.39 / night 0.34 / Nelson 0.22
    vs the pre-deletion build (temporal randomness only). There is
    now exactly ONE implementation of every piece of physics.
- Phase 3, step 1 DONE — the full validation matrix ran on the REAL
  WebGPU backend (Dawn/SwiftShader Vulkan) in this environment and is
  green. The earlier session's verdict that this "needs a real
  browser/GPU" was WRONG — the blockers were all in the presentation/
  capture path, never in theme code. What was actually wrong, and the
  working recipe (the "Real-WebGPU harness"):
  - Headless chromium: Dawn loses its instance (`mapAsync` → "external
    Instance reference no longer exists"). HEADED under `xvfb-run`
    works.
  - ANY Playwright-LAUNCHED browser breaks Dawn the same way (default
    args, `ignoreAllDefaultArgs`, persistent context — all tried).
    The driver must `spawn()` the browser itself (plain flags:
    `--enable-unsafe-webgpu --no-sandbox --user-data-dir=…
--remote-debugging-port=…`) and attach with `connectOverCDP`.
  - Compositor screenshots are blank for GPU surfaces under Xvfb, and
    WebGPU canvases recycle their texture on present (`toDataURL` /
    `drawImage` see stale frames). The ONLY reliable capture is an
    in-page render-target readback through three itself; the harness
    page exposes `window.__capture(w,h)` which replays one full frame
    (cloud prepass → march → main render → composite → precip
    overlay) into a fresh RT and returns
    `readRenderTargetPixelsAsync` bytes.
  - Readback row order differs: WebGL-backend readbacks are
    bottom-origin, WebGPU's top-origin — the driver normalises.
  - three r185 passes `swizzle` in GPUTextureViewDescriptor; the
    fixture chromium (Chrome for Testing 150, fetched with
    `npx @puppeteer/browsers install chrome@stable`) predates it —
    harness-only createView shim strips it.
  - SwiftShader-Vulkan throughput: most scenes ~10–30 fps; Nelson
    (planar-reflector water + cloud deck = the scene rendered twice)
    crawls at ~1.2 fps — budget ~900 s for its 600 pinned frames.
  - Results, pinned deterministic matrix at frame 600 (mean abs
    diff /255, real WebGPU vs WebGL2 backend of the SAME build):
    noon 0.005 (max 3), sunset 0.054, night 0.001 (16 star px at fp
    twinkle thresholds), stratus 0.92, towering 0.31, Nelson sea
    0.075 (glitter + twinkle points), snow 0.52, aurora 0.0003. The
    stratus/towering/snow residual is confined to
    the cloud deck (terrain rows diff exactly 0.000) and decomposes
    into: fp accumulation along the 600-frame temporal march (WGSL vs
    GLSL transcendentals), Bayer cells refreshed in the ~15
    post-freeze frames before each capture, quarter-res upsample
    edges at the terrain silhouette, and (snow) flake positions
    offset because the async Rapier wasm load lands on a different
    frame. Structure is identical throughout.
  - Subsystem pages on real WebGPU vs WebGL backend: dome 0.00,
    clouds 0.01, water 0.03 (specular-glint fp noise, no structure),
    moon/veil/aurora/optics/stars/planets 0.0000 (bit-exact). The
    clouds-tsl `coordinateSystem` clip-z branch and all QuadMesh/RT
    orientation conventions are hereby validated on WebGPU proper.
- Phase 3, step 2 DONE — compute ports. The physics stayed
  single-source: every LUT builder and the cloud march body are now
  coordinate-parameterised Fns with two thin drivers - on WebGPU a
  compute dispatch writing a StorageTexture (one invocation per
  texel, vUv at texel centres exactly matching the raster path's
  uv()); on the WebGL2 backend, which has no compute, the same Fn
  still renders through the phase-2 QuadMesh pass.
  - atmosphere-tsl.js: transmittance / multiscatter / sky-view /
    aerial LUTs are compute on WebGPU. The 1x1 irradiance stays a
    raster pass on both backends: readRenderTargetPixelsAsync IS the
    async staging read (no sync stall since phase 2), and a single
    texel gives compute nothing to win. Harness readLut() blits
    storage textures through a temp RT.
  - clouds-tsl.js: the march ping-pongs two StorageTextures via
    per-buffer kernels; history/composite consume them through the
    same swappable texture nodes as before. `pix` carries
    fragment-convention pixel centres (x+0.5) so the Bayer lattice
    and per-pixel hash are bit-identical across drivers. The
    composite remains raster (it blends into the frame).
  - Compute-primitive probe (tsl-compute-probe.html), all PASS on
    Dawn: textureStore row == sample v == readback row (no flip);
    filtered texture sampling and Loop/If inside kernels; DepthTexture
    sampling inside kernels. Also caught: WebGPU float readbacks
    narrower than 64 px come back 256-byte-row-padded (scrambled) -
    keep probe/LUT widths at w\*16 bytes % 256 == 0.
  - Subsystem A/B, compute (WebGPU) vs fragment (WebGL2): dome
    0.0017 (the only >8 outliers are a 2-px band at the sky-view
    horizon seam - linear filtering across the physical discontinuity
    amplifies half-float FMA differences; the phase-4 Bruneton
    horizon-band item targets exactly this seam), clouds 0.0375
    after 64 temporal frames with max 8.
  - Full pinned matrix, WebGPU compute vs WebGL2 fragment (mean abs
    /255): noon 0.005 (a single pixel >8), sunset 0.059, night
    0.001, stratus 0.84, towering 0.32, Nelson 0.007 (max 8!), snow
    0.44, aurora 0.0003 - every scene at or better than the
    fragment-vs-fragment baseline above. Nelson's pinned run also
    got ~25% faster wall-clock (compute march).
  - Phase 3 complete.
- Phase 4, steps 1-2 DONE - horizon-band fix and blue-noise jitter.
  - Sky-view horizon fix (Bruneton). The horizon is a true radiance
    discontinuity (ground-terminated march below, full path above);
    the old mapping put it mid-texel at v=0.5 and bilinear filtering
    smeared it into the band. Now: each half-range maps to its own
    texel-centre range with half-texel guards at the seam (sqrt warp
    kept), the ray CLASS is assigned by texture half (Bruneton's
    ray_r_mu_intersects_ground - the below-boundary row marches to
    the ground at the exact tangent distance, the above row to the
    top, storing the two one-sided limits), and the dome blends the
    limits by pixel coverage (fwidth(elev)) - the box-filter integral
    of the discontinuity, which also keeps the dome continuous in
    elev so backends cannot disagree on single-pixel classification
    along the horizon row. atmo-reference.mjs mirrors the mapping;
    per-texel validation passes within ~0.1% including both guard
    rows (below 4.96e-2 vs above 8.66e-2 red - the discontinuity is
    real and now resolved crisply). Dome A/B history: pre-fix 0.0017
    with a 102-px seam band; guarded split alone 0.0102 (571 px of
    single-pixel classification flips - each backend crisp but
    disagreeing sub-pixel); with coverage blend 0.0004 and 6 px > 8.
  - Blue-noise march jitter (blue-noise.js): Ulichney's
    void-and-cluster, full algorithm (phase 0 relaxation + all three
    rank phases, toroidal Gaussian sigma 1.5, seeded LCG -
    deterministic everywhere). Verified: exact permutation,
    neighbour-threshold separation 0.41 vs white noise's 1/3. Ranks
    ship 16-bit across R/G of a 64x64 nearest/repeat DataTexture;
    marchBody's jit = fract(blueNoise(pix) + frameI \* 0.618034) - the
    golden-ratio sequence stays as the temporal decorrelator, blue
    noise replaces the white sin-hash spatially. hash12 deleted.
  - Full pinned matrix (WebGPU compute vs WebGL2 fragment, /255):
    noon 0.0062, sunset 0.067, night 0.0009, stratus 0.54 (was 0.84
    - the blue noise dithers cross-compiler fp differences at high
      frequency and they cancel in the temporal average; 3.5x fewer
      > 8 outliers), towering 0.33, Nelson 0.0070 (max 6), snow 0.48,
      > aurora 0.0003. Sea horizon at Nelson and the alpine noon horizon
      > render as crisp AA'd lines.
- Phase 4, step 3 DONE - depth-aware cloud reprojection. The camera
  translates (intro height ease, free-flight KeyW) and the fixed
  600-unit proxy point parallaxed everything not at that distance.
  - The march now outputs its CLOUD FRONT DEPTH alongside radiance:
    the coarse ranging was split into its own `slabFront` Fn (still
    runs exactly once per deck - marchSlab receives its result), the
    reconstruction became a JS builder returning {col, front} nodes,
    and the drivers route both outputs - the compute kernel stores
    into a second StorageTexture (nearest-filtered: depth must not
    blend across the cloud/sky sentinel edge), the raster driver
    writes a 2-attachment MRT RenderTarget through an Fn returning a
    TSL struct (buildMarch's If/toVar need an active build stack -
    fine inside the kernel Fn, so only the raster driver needs the
    struct wrapper; probed struct + mrt + per-attachment readback on
    the WebGL2 backend first).
  - Reprojection is Schneider's two-step: project the 600 proxy,
    read the history's front depth there, reproject through that
    distance. Rotation stays exact at any distance; sky pixels carry
    a 30000 sentinel and degrade to direction-only (exact for sky);
    reprojected pixels carry their front depth forward with their
    colour.
  - Acceptance, measured: moving-camera error vs a temporal-free
    ground truth (the clouds page's truth=1 forces a full fresh
    march every frame via the harness-only `_warm` export; identical
    deterministic camera path and jitter) dropped from 10.35 mean
    (fixed-600) to 3.95 (depth-aware), 2.6x, outlier fraction 0.29
    to 0.18 - and visibly, the deck structures register against the
    truth where the old code displaced them. Static regression:
    clouds A/B 0.0374 (unchanged), theme stratus pinned 0.547
    (unchanged within run tolerance).
  - Phase 4 complete. The port is done: one TSL implementation of
    every piece of physics, compute-driven on WebGPU, QuadMesh-driven
    on the WebGL2 fallback, reference-validated per-texel and
    matrix-validated cross-backend at every step.
- Phase 5 - ongoing state-of-the-art upgrades. Method lesson from
  the port, now standing policy: the durable ground truth is a
  double-precision CPU mirror (atmo-reference.mjs), not any previous
  GPU build - write the reference first, then the shader.
  - DONE: cloud multiple scattering by attenuated octaves (Wrenninge
    et al. 2013 "Oz"; real-time form per Hillaire, Frostbite 2016),
    replacing Schneider's Beer-powder cheat. Octave i scales
    contribution a^i, sun optical depth b^i, dual-lobe HG
    eccentricity c^i; a = b = c = 0.5, N = 3, a <= b for energy
    conservation. The legacy x18 display calibration is divided by
    sum(a^i) = 1.75 so the validated white point is preserved - the
    octave SHAPE (deep transmission, more isotropic side-lighting)
    is the physics, the constant is exposure. Deck means moved
    stratus 85->95 / towering 61->67 (multiple scattering is why a
    real overcast is not black); structure intact; cross-backend
    stratus 1.03 with the usual deck-confined fp-dither profile
    (terrain rows exactly 0, outlier tail unchanged - amplitude
    scales with the larger transmitted signal).
  - DONE: photospheric limb darkening on the sun disc, Hestroffer &
    Magnan (1998) power law I(mu) = mu^alpha with
    alpha(lambda_um) = -0.023 + 0.292/lambda at the same 680/550/440
    nm the scattering coefficients use; the disc constant is now the
    CENTRAL intensity. Dome A/B unchanged (0.0004).
  - Tessendorf FFT ocean, step 1 DONE - spectrum, reference, and the
    GPU FFT pipeline, reference-validated on BOTH backends.
    - ocean-spectrum.js (single source for reference and runtime):
      JONSWAP (Hasselmann et al. 1973 fetch relations) with the TMA
      finite-depth factor (Bouws et al. 1985, Kitaigorodskii
      scaling), Hasselmann/DHE (1980) directional spreading with the
      measured power laws and lgamma normalisation, finite-depth
      dispersion w^2 = g k tanh(kD) with the dw/dk Jacobian for the
      S(w,theta) -> S(kx,kz) change of variables, seeded Box-Muller
      h0(k). Physical sanity: Hs(U=12, F=120 km, D=60 m) = 4.02 m.
    - ocean-reference.mjs (double precision): Hermitian evolution
      h = h0(k)e^{iwt} + conj(h0(-k))e^{-iwt}, all 8 real fields
      (h, choppy Dx/Dz, spectral slopes, the 3 Jacobian derivatives),
      radix-2 IFFT; self-check max|Im| = 4.7e-15. Prints per-texel
      values incl. the exact displaced-surface normal and
      J = (1+lJxx)(1+lJzz)-(lJxz)^2.
    - ocean-tsl.js: h0/omega + butterfly LUT built once on the CPU
      (bit-reversal folded into pass 0, bottom-half twiddle signs
      folded in); per frame evolve -> 2 x log2N butterfly passes over
      two rgba32float chains (4 complex transforms packed as
      h+iDx | Dz+iSx and Sz+iJxx | Jzz+iJxz) -> unpack to a
      displacement map (lDx, h, lDz) and a derivative map
      (n.x, n.z, J) with the EXACT normal from spectral tangents.
      Project dual drivers throughout. Validated per-texel against
      the reference at t=13.7 on real WebGPU AND the WebGL2 backend
      (harness/tsl-ocean-num.html) - identical values on both.
    - New measured conventions (harness/tsl-flip-probe3.html):
      CPU DataTexture rows read STRAIGHT under .sample() on both
      backends; QuadMesh MRT write + sample self-consistent on both
      attachments; only the WebGL2 READBACK is row-flipped. Blit
      fragment outputs clamp NEGATIVE rgb at zero (positives pass) -
      numeric readbacks of signed data go through an fp32 affine
      encode. And ivec2.toFloat() collapses to a scalar - convert
      vectors with vec2()/vec3(), never .toFloat().
  - Tessendorf FFT ocean, step 2 DONE - water integration.
    - Two cascades (L = 1000 m and 120 m, N = 256), k-space
      partitioned at lambda = 25 m via exact kMin/kMax band limits in
      the h0 build - summed cascades never double-count energy. The
      unpack maps now carry COMBINABLE terms - (lDx, h, lDz, lJxz)
      and (Sx, Sz, lJxx, lJzz) - because normals and the folding
      Jacobian of a sum are not sums of per-cascade ones; the
      material sums cascade samples and builds both once.
    - water-tsl: vertex displacement (world (Dx,h,Dz) -> the rotated
      plane's local frame), the exact displaced-surface normal from
      summed spectral tangents (sampled at the UNDISPLACED parameter,
      carried by vertexStage), Jacobian-folding whitecaps with
      Jt = 0.4745 - calibrated by ocean-reference.mjs so coverage
      matches Monahan W = 3.84e-6 U^3.41 at U = 12 m/s; at every
      other wind coverage follows from the physics. The 4-octave
      scrolling-normal-map sea and the Monahan noise mask are
      DELETED; the waterNormals texture remains only for McCowan
      surf noise. Cox-Munk glitter now uses the RESIDUAL slope
      variance (total wind mss minus the cascades' exact resolved
      mss, computed as sum k^2 S dk^2 at init - Bruneton, Neyret &
      Holzschuch 2010), so sub-grid slopes are neither lost nor
      counted twice.
    - Horizon.html: cascades built with the water plane (TMA depth =
      mean of the real bathymetry, F = 150 km fixed - the weather
      API reports no fetch), advanced on REAL seconds (dispersion is
      physical), spectrum rebuilt IN PLACE via setWind() when the
      wind moves > 1.5 m/s or > 20 deg (same gating pattern as the
      aerosol LUTs; same textures/kernels, only h0 re-uploads).
      PlaneGeometry now 192x192 segments for the displacement.
    - Acceptance: pinned Nelson (28 m/s gale) on real WebGPU vs the
      WebGL2 backend: mean 0.0279, frac>8 0.00002 - green.
  - Tessendorf FFT ocean, step 3 DONE - slope-variance-preserving
    wave filtering (the maps have no mip chain; unfiltered
    minification of the fine cascade aliased into glitter speckle,
    12% of daytime-page samples diverging cross-backend).
    - Each cascade's slope/Jacobian contribution fades by its
      MEASURED per-pixel minification: f = smoothstep(4, 1,
      |fwidth(uv \* N)|) - the same quantity a mip LOD would compute.
      Scaling Gaussian slopes by f scales their variance by f^2, so
      the Blinn lobe's per-pixel effective variance
      mssEff = mssSubgrid + sum (1 - f_c^2) mss_c preserves TOTAL
      slope variance at every distance (Bruneton 2010's bookkeeping,
      per pixel): the sea keeps its roughness as detail leaves the
      pixel footprint - it just stops aliasing. The shiny uniform is
      gone; the theme now feeds mssSubgrid and each cascade
      contributes through its self-updating mssUniform.
    - Foam: where minification fades the fine cascade, the folding
      mask converges to the Monahan MEAN coverage (foamW uniform) -
      the same statistic the folding threshold was calibrated
      against - so a distant gale sea keeps its aggregate whiteness.
    - Results: daytime water subsystem A/B 5.41 -> 0.118 mean (46x),
      outliers 12% -> 0.18%; the distant glitter is a smooth
      Cox-Munk lobe. Pinned Nelson gale: 0.0279 -> 0.0007 mean with
      ZERO samples over 8 - the best cross-backend number in the
      project. FFT ocean complete.
  - DONE: cloud shadows (Schneider 2015's cloud shadow map). Each
    deck's vertical sigma-weighted optical depth - Beer-Lambert
    through the SAME Nubis density the sky marches - fills a 2D map
    per frame (project dual drivers); every sunlit material
    multiplies its received CSM shadow by
    exp(-tau / max(sunDir.y, 0.08)) sampled where the sun ray
    crosses each deck's mid height (receivedShadowNode; the unlit
    water dims its DIRECT sun terms - glitter, diffuse - through the
    same transmittance, not its sky reflection). The flat
    (1 - cloudy\*0.55) global sun dim is REPLACED: decks shadow per
    pixel, and the only global factor left is the cirrus veil as
    exp(-tau/sin alt) with tau_vis = 1 at full high cover (typical
    cirrostratus). Two measured fixes on the way: the shadow
    integral must use the FULL eroded density (a coarse-only
    integral left tau >= 0.42 in the VISUAL GAPS - the erosion's
    clamp-to-zero is what clears them), and the raster fill needed
    the Fn wrap (Loop/toVar with no active build stack - the ocean's
    bug class). Validation: tau maps bit-comparable across backends
    (identical stats, max 1 LSB); cumulus terrain signed diff vs the
    old build has sd 11.5 range -43..+6 (patchy shadows + brighter
    gaps, not a flat offset); pinned stratus 0.76 with the usual
    deck-confined profile and terrain rows at 0.006. Overcast now
    reads physically: direct sun extinguished under the deck,
    ambient-only terrain.
  - DONE: Hapke lunar photometry (Hapke 1981 IMSA, the 2002
    H-function approximation, SHOE opposition surge, single-lobe
    Henyey-Greenstein) with the canonical Helfenstein & Veverka
    (1987) lunar parameters w = 0.21, B0 = 2.0, h = 0.07,
    xi = -0.18; macroscopic roughness theta-bar omitted (sub-pixel
    at the 6-px disc; documented, not hidden). Replaces
    Lommel-Seeliger, whose curve has no opposition surge.
    moon-reference.mjs integrates the disc: the phase curve
    reproduces the observed lunar function (I/I_full = 0.082 at
    g = 90 deg vs Rougier's ~0.08; 0.029 at 120 deg), and its
    full-moon disc-centre value normalises the shader so the
    calibrated full-moon brightness anchor holds. Cross-backend
    moon page: bit-exact (0.0000, max 0).
  - DONE: physical atmospheric-optics radiance profiles
    (optics-lut.js, double precision at init, reference-first per
    the standing policy - optics-reference.mjs prints the
    landmarks). Replaces the hand-tuned smoothstep bands + spectral
    ramp in createOpticsMaterial with two 256x1 float LUTs the
    shader samples by angle:
    - 22-deg halo: deviation histogram of a randomly rotating
      60-deg ice prism (Warren dispersion n = 1.307/1.311/1.317),
      weighted by aperture cos(x) and both Fresnel transmittances -
      the 1/sqrt(D - Dmin) caustic at minimum deviation IS the
      sharp red inner edge. After sun-disc convolution the channel
      edges sit at 21.37/21.68/22.15 deg (the geometric
      21.61/21.92/22.37 minus half the solar smearing), peaks
      21.76/22.07/22.54 deg.
    - Rainbows: Descartes deviation D(b) = 2(i-r) + k(pi-2r) for
      k = 1,2 histogrammed over impact parameter with annulus
      weight b and the Fresnel chain T R^k T (Hale & Querry
      dispersion). Primary peaks at 42.28/41.79/41.10 deg,
      secondary at 50.48/51.26/52.63 deg with the colour order
      REVERSED, the secondary/primary ratio ~0.157 and Alexander's
      dark band (44-49 deg histograms to exactly 0.0000) all EMERGE
      from the Fresnel chain - none of it is tuned.
    - Both profiles convolved with the 0.267-deg-radius sun disc
      carrying the SAME Hestroffer & Magnan limb darkening the dome
      renders. Airy supernumeraries are wave optics - out of scope,
      documented in the header. Kept: the calibrated display gains
      and the sundog azimuth gaussian (a placement heuristic,
      documented as such). Cross-backend optics page: bit-exact
      (mean 0.0000, max 0). Visual: halo shows the red inner edge
      with dispersion falloff and sundogs; bow shows the red-outer
      primary, the faint colour-reversed secondary, and the dark
      band between them.
  - DONE: live sea state - the FFT spectrum driven by MEASURED wave
    partitions from the open-meteo Marine API (ECMWF WAM): wind sea
    and swell each with significant height, PEAK period and
    direction (syncMarine, 15-min cadence, hsw/tpw/dww +
    hss/tps/dws URL pins for the harness). Two research pieces and
    one found bug:
    - Partition spectra: JONSWAP shape at the measured Tp with the
      DNV-RP-C205 sect. 3.5.5 peak enhancement gamma(Hs, Tp); the
      Phillips constant of each partition comes from EXACT numeric
      integration so partition variance is m0 = Hs^2/16 (Goda's
      closed-form alpha approximation NOT used). The composed sea is
      the Torsethaugen/Ochi-Hubble two-peak structure with measured
      partitions. Spreading: Hasselmann 1980 for the wind sea (it is
      wind-coupled), Mitsuyasu/Goda cos^{2s}(theta/2) with
      s_max = 75 for swell (Hasselmann's s needs U10/c_p, which is
      meaningless for waves that left their generation area). NO TMA
      re-application to measured partitions: TMA turns a deep-water
      PREDICTION into depth-limited form, but the marine model's
      Hs/Tp already contain the site's depth physics - re-applying
      phi measurably shifted a 14 s swell peak to 12.9 s. Finite-
      depth dispersion still maps omega to local wavenumbers.
      Over land the API returns nulls and the fetch-limited wind-sea
      prediction stands - same spectrum builder, no separate path.
    - FOUND AND FIXED: the h0 normalisation realised FOUR times the
      spectral variance (Tessendorf's eq. 42 read literally -
      measured 5.68 m realised Hs against 2.62 m of omega-integral
      theory at U = 12). Now E[|h0|^2] = S dk^2 / 2 so the Hermitian
      mode sum realises exactly m0 (Horvath 2015's normalisation
      discussion); the reference prints theory vs realised (2.62 vs
      2.84 m - the gap is Gaussian draw noise on a finite grid) and
      the sea-state cascades realise 2.79 m against a measured
      2.5 m total for the same reason (a 1 km periodic tile of
      narrow swell holds few modes - sample variance, not error).
    - Foam recalibrated for the physical amplitudes AND against the
      shader's ACTUAL mask: ocean-reference.mjs bisects Jt so the
      grid-mean of smoothstep(Jt, Jt - 0.175, J) equals Monahan
      coverage (the old quantile calibration assumed a hard
      threshold the shader never applied): Jt 0.4745 -> 0.7974,
      transition width 0.35 -> 0.175 (proportional to the tighter
      J range 0.470..1.707).
    - Validation: spread integrals exactly 1 (lgamma norm); dense
      k-plane quadrature recovers each partition Hs exactly
      (1.499 / 2.000 m); swell peak lands at the measured 14 s;
      per-texel GPU maps match the double-precision CPU reference
      in sea mode on BOTH backends (tsl-ocean-num.html ?sea=1, fp32
      agreement, WebGL2 scan finds the reference texel at the
      documented row-flip); water-page cross-backend A/B in sea
      mode mean 0.048/255 with 0.008% outliers. Pinned Nelson
      wind-mode regression after the amplitude/foam changes:
      0.0005 mean, ZERO samples over 8 (was 0.0007); sea-pinned
      Nelson (hsw=1.2 tpw=5.5 + hss=2.5 tps=13): 0.0005 mean, zero
      outliers, with the sea-vs-wind signal confined to the water
      rows as expected (surf foam widens over the shallow bank at
      the 2.8 m total sea).
  - DONE: Battjes-Janssen depth-induced breaking (surf.js single
    source + surf-reference.mjs, reference-first). Replaces the
    McCowan H > 0.78 d smoothstep heuristic AND the dead surf
    "patchiness" modulation (measured: the waternormals blue channel
    is >= 0.88 everywhere, so its smoothstep(0.35, 0.7, b) mask was
    identically 1 - a no-op since the classic build).
    - Physics, computed in double precision per frame into a 256 x 1
      depth LUT the shader samples on the real terrarium bathymetry:
      the B&J 1978 breaking fraction (1 - Qb)/ln Qb = -(Hrms/Hm)^2
      solved by geometric bisection (residuals at machine zero;
      Qb(0.5) = 0.0198, the canonical ~0.02); the Miche-type cap
      Hm = (0.88/k) tanh(gamma k d / 0.88); the Battjes & Stive 1985
      recalibrated gamma = 0.5 + 0.4 tanh(33 s0) from offshore
      steepness; linear shoaling of Hrms via exact-cg energy flux,
      bounded by Hm (the clipped-Rayleigh model's own consistency
      bound); k(omega, d) by Newton on the exact finite-depth
      dispersion (no Hunt/Eckart explicit fit - reference matches
      wave tables: T = 10 s, d = 10 m -> L = 92.4 m vs 92.3).
      Documented scope: pointwise Qb over the depth field - the full
      energy-balance ODE along rays (SWAN territory) is out.
    - Crest-located foam: the LUT's second channel is
      z(d) = probit(1 - Qb) (Wichura's AS 241, machine precision;
      coverage roundtrip 1e-13), and the shader masks where the
      RESOLVED FFT elevation exceeds z sigma with sigma = Hs/4 -
      coverage is exactly Qb(depth) by the Gaussian-sea definition
      and the surf rides the actual breaking crests instead of
      painting a flat depth band. Peak period: the dominant measured
      partition's Tp, or the fetch-limited JONSWAP peak
      (peakOmega) in wind mode - the same spectrum the cascades
      realise.
    - Dead interface deleted with the heuristic: the water
      material's waterNormals / timeU / windDirW uniforms fed
      nothing after the FFT port (normals and time come from the
      cascades); the theme and harness page stop feeding them.
    - Validation: surf-reference.mjs prints the published landmarks
      (Qb magnitudes + machine residuals, wave-table dispersion,
      Battjes-Stive gammas, probit quantiles, monotonic Qb(d)
      profile with the 2.5 m / 13 s surf zone confined to d < ~7 m);
      water-page cross-backend A/B unchanged-green (0.048 mean,
      backends read the same CPU LUT); pinned sea Nelson A/B 0.0005
      mean with zero outliers. The pinned Nelson bay itself is
      bit-identical before/after: its 128^2 depth texture
      (125 m/texel over 16 km) resolves no pixels inside the surf
      band, so BOTH the old heuristic and Qb are exactly zero there
      - a scene/bathymetry-resolution limit (pre-existing), not a
        model one. Visual on the harness depth ramp at a storm sea
        (Hs 8 m, Tp 16 s): the saturated breaker wedge fills the
        shallow corner and partial-Qb foam sits ON the crests in the
        mid-zone instead of painting a flat depth band.
  - DONE: bathymetry depth texture upgraded to what the source data
    supports - 512^2 float texels with linear filtering over the
    16 km world (31 m/texel = the z12 terrarium resolution itself;
    going higher would invent data). The old 128^2 8-bit
    nearest-filtered texture quantised depth to 0.157 m steps in
    125 m blocks and could not resolve the surf band at all. The
    harness page's synthetic ramp matches (float + linear).
    A pinned Nelson comparison of the two build states (gathered
    while landing the change) put the whole signal in the water
    rows with sky and terrain bands exactly 0.000.
  - DONE: Zirr & Kaplanyan 2016 procedural multiscale glints for the
    snow (snow-glints.js pure-JS single source + glint-reference.mjs,
    reference-first; terrain-tsl.js carries the node mirror).
    - Model: RHO = 30k specular ice crystals per m^2, mirror facets
      with a GGX orientation spread (alpha 0.35, FSPEC area
      fraction 0.12, ice F0 0.018); a crystal glints when its normal
      falls in the sun cone around the half vector,
      p(h) = D(h)(n.h) Omega_g. The pixel footprint (fwidth,
      metres) selects a two-level cell stack (bilinear cell weights,
      fractional-level blend - the paper's spatial reconstruction);
      each cell's count is Poisson(nbar) - the binomial's
      large-RHO limit the paper invokes - drawn by inverse CDF on
      ONE deterministic uniform from pcg3d(cell, level, h-bin)
      (Jarzynski & Olano 2020). Above nbar = 3 the crystals are
      sub-pixel and a matched mean/variance uniform stands in (the
      paper's Gaussian regime). All hash inputs are kept
      non-negative integers so JS, WGSL and GLSL agree bit-exactly.
    - Energy conservation by construction: the glint factor is
      sum(w N)/nbar_pix with E[factor] = 1, multiplying the exact
      smooth facet lobe (GGX D projected-area normalised - the
      reference integrates it to 1.00000 - height-correlated Smith
      V, Schlick F). Reference statistics: factor mean 1.00 at
      every scale with rel-sd 2.5 at a 4 cm footprint (that IS the
      sparkle) dying to 0.017 at 8 m (converged to the smooth
      lobe).
    - tsl-glint-probe.html: GPU pcg3d lanes and Poisson counts equal
      the CPU single source BIT FOR BIT on BOTH backends (0/64 hash,
      0/128 count mismatches).
    - Like the sea glitter, the glint rides the emissive path (not
      CSM-shadowed - documented, consistent; energy only in direct
      sun via uSunCol).
    - Two port bugs the standalone probe could not catch (they were
      in the zKey/level mixing the probe did not exercise), found by
      an in-scene compile error (f32 \* u32): VECTOR .toInt()
      collapses to a scalar - same measured class as the ocean's
      ivec2.toFloat() - so the half-vector bin must be three SCALAR
      floor().toInt() conversions; and an integer literal above 2^31
      (2654435761) is unsafe in the shader generators - replaced by
      1597334677 in both the JS single source and the node mirror.
    - Scene validation: pinned overcast snow matrix scene A/B 0.328
      mean (the certified deck profile; terrain rows 0.008-0.07);
      sunny fresh-snow visual (temp=-2, snow=0.5, code=0) shows
      surface-anchored sparkle points on the foreground slopes,
      distinct from the falling flakes.
  - DONE: WebGPU-ONLY (owner decision) - the WebGL2 backend is
    deleted everywhere. What changed:
    - ocean-tsl / atmosphere-tsl / clouds-tsl lose their raster
      drivers (QuadMesh + MRT/struct passes, sampler-mediated texel
      reads, render-target LUTs): every pass is now a compute kernel
      over storage textures, full stop. The WebGL2 readback
      compensations (row flips, the EXT_color_buffer_float gate) go
      with them. QuadMesh remains only where a RenderTarget is the
      point: the cloud composite, the 1x1 irradiance readback, the
      harness readMap/readLut blits.
    - Horizon.html requires navigator.gpu and a WebGPU adapter; a
      browser without them gets a plain caption (current Chrome,
      Edge, Firefox and Safari all ship WebGPU), not a fallback.
    - tsl-water-gpu.html's dead classic-GL branch (V was hardcoded
      'gpu' since the port) and its unused waternormals load are
      deleted; every harness page pins forceWebGL: false.
    - VALIDATION MODEL CHANGES: with one engine there is no A/B of
      any kind. Correctness rests on (a) the CPU double-precision
      references (atmo/ocean/moon/optics/surf/glint), and (b) the
      numeric probe pages reading GPU texels back against those
      references (both re-run green on the compute-only build:
      glint hash/count 0/64 + 0/128 mismatches, ocean sea-mode
      texels at the reference values). sweep-pin.sh remains only as
      a smoke/visual matrix (PAGEERROR detection). The dual-backend
      numbers recorded above are the historical record of how the
      port was proven.
    - The historical dual-driver findings (V-flip conventions,
      sampler-mediated fetches, MRT struct routing) stay recorded in
      this file's earlier sections - they are how the port was
      PROVEN, and they document the WebGL2 backend behaviour should
      it ever return.
  - DONE: harness/validate.sh - the reference-first gate, the
    project's ONE correctness entrypoint. Step 1 runs all six CPU
    double-precision references (ocean 26 landmarks, atmo 9, moon 7,
    optics 11, surf 23, glint 17); step 2 shoots the
    GPU-vs-reference probes and asserts texels AT the reference
    values (tsl-ocean-num.html is now a self-checking gate in both
    wind and measured-sea modes, fp32 tolerance 5e-3 through the
    full FFT chain; the glint probe asserts bit-exact hash/counts).
    Nothing in the gate compares one render against another.
    First full run on the WebGPU-only build: VALIDATE PASS
    (6/6 references, 3/3 probes).
  - DONE: physical aurora (aurora-lut.js single source +
    aurora-reference.mjs, reference-first). Replaces the hand-tuned
    curtain gradient (invented green-to-purple ramp, pow-band
    vertical profile) with the emission physics, driven by the
    OVATION/Kp data the theme already fetches:
    - Upper atmosphere: the CIRA-72 Mean Reference Atmosphere as
      tabulated in the AFGL Handbook of Geophysics (1985) tables
      14-7/14-9, embedded 90-400 km (T, N2, O2, O, Ar; the shared
      120 km row pins the column alignment; derived rho within 10%
      of USSA76 at 100/200 km). Column mass integrates the
      piecewise-exponential profile analytically.
    - Deposition: Fang et al. (2010, GRL) parameterization of
      isotropic monoenergetic electron impact ionization with their
      table-1 Pij verbatim, integrated over a Maxwellian of
      characteristic energy E0 by log-E quadrature. Reference:
      ionization peaks sweep 230 -> 90 km as E0 hardens 0.1 -> 30
      keV, monotonically; the sub-unity isotropic energy integral is
      the real backscattered albedo.
    - Lines: 427.8 nm N2+ follows the Rees (1989) N2 ionization
      share. 557.7 nm O(1S) ALSO follows the N2 share - its source
      at the emission peak is the N2(A3Sigma) energy-transfer chain,
      which is why photometric 5577/4278 is famously near-constant.
      (The first cut weighted green by the atomic-oxygen FRACTION,
      which is ~1% at 100 km: the curtain rendered blue - the
      visual caught a real physics error, fixed at the source term,
      not the gains.) 630.0 nm O(1D) keeps the oxygen share.
      O(1S)/O(1D) collisional quenching (Streit et al. 1976 rates).
      Untuned results: green peak 108 km at E0 = 3 keV (the textbook
      lower border), red 630.0 confined above ~200 km (survival
      0.12 at 200 km, 0.82 at 300 km), red/green column ratio 0.41
      soft vs ~0 hard - type-d red aurora emerges for soft
      precipitation. Line colors from the Wyman-Sloan-Shirley CIE
      fits (557.7 green, 630.0 red, 427.8 violet-blue).
    - The curtain samples the altitude LUT (fragment height -> 92 to
      320 km emission altitude); E0 = 1.5 + 4.5 \* ovalP keV is the
      documented display mapping (the public OVATION product has no
      spectra); setE0 gates in-place LUT rebuilds. Curtain waving
      stays the documented shape heuristic. Display gains: the blue
      gain carries the OBSERVED I(5577)/I(4278) ~ 5.5 (green and
      blue share the N2 profile shape); red 2.0 and green 1.0 are
      exposure for the folded chains.
    - aurora-reference.mjs joins validate.sh (16 landmarks; gate
      PASS at 7/7 references + 3/3 probes).
  - DONE: LEADR terrain filtering (Dupuy, Heitz, Iehl, Poulin &
    Neyret 2013; leadr.js single source + leadr-reference.mjs).
    Replaces the mipless 8-bit DEM normal map - which aliased both
    the lighting and every specular term at distance - with a
    CPU double-precision box pyramid of slope moments
    (E[sx], E[sz], E[sx^2], E[sz^2]) uploaded as hand-built float32
    mips (tsl-leadr-probe.html: upload, per-level LOD reads and
    trilinear filtering all exact on the WebGPU stack - probed
    BEFORE the design committed to raw fp32 moments).
    - Normals do not average; slopes do. The trilinear auto-LOD
      sample gives the footprint's MEAN slope (the filtered shading
      normal) and its central variance, which inflates every
      microfacet lobe: alpha_eff^2 = alpha^2 + 2 sigma^2 for the
      body GGX roughness AND for the snow-glint lobe (distant snow's
      sparkle widens by the unresolved terrain slopes - the same
      variance-preservation principle as the ocean's Bruneton
      bookkeeping, now on land). One moments sample per fragment
      feeds normal, roughness and glints.
    - The covariance E[sx sz] is NOT stored: every BRDF in the
      pipeline is isotropic, so only the variance trace enters
      shading (documented; storing it would only feed an
      anisotropic lobe we do not have). 512^2 base matches the
      ~26 m z12 source data over the 16 km world.
    - leadr-reference.mjs: pyramid equals the direct footprint
      average at fp32 epsilon (4e-9); the law of total variance
      holds across every level (6e-8); a known sinusoid lands on
      its analytic slope variance; no negative variances. Gate PASS
      at 8/8 references + 3/3 probes; noon smoke clean.
  - DONE: radar-measured precipitation (radar.js single source +
    radar-reference.mjs). The rain/snow intensity was the model's
    POINT value from the forecast API; it now comes from the latest
    RainViewer radar composite - an actual measurement - decoded at
    the visitor:
    - Their black-and-white tile scheme (color 0, smoothing and
      snow colorisation off): red channel dBZ = (R & 127) - 32,
      bit 7 flags snow, transparent = no radar coverage (probed:
      CORS is open, catalog + tiles fetch from the browser).
    - Z-R inversion: Marshall & Palmer (1948) Z = 200 R^1.6 for
      rain, Sekhon & Srivastava (1970) Z = 1780 S^2.21 for the
      snow-flagged pixels. Reference landmarks: exact round-trips,
      the canonical 23 dBZ = 1.00 mm/h boundary, 40 dBZ = 11.5,
      50 dBZ = 48.6; at equal dBZ snow reads a DRIER liquid
      equivalent (steeper exponent). Web Mercator tile math checked
      against the slippy-map landmarks; windowStats reproduces
      analytic means on a synthetic tile exactly.
    - syncRadar() every 10 min: one z8 tile at the visitor, canvas
      decode, mean rates over the 16 km world footprint. Fresh
      (< 25 min) covered radar replaces the model's precipitation
      in the particle intensity; no coverage or offline keeps the
      model silently. Pinned scenes are untouched (overridden gate
      - the harness fetch stub). Gate PASS at 9/9 references + 3/3
        probes; noon smoke clean.
  - DONE: IGRF-14 geomagnetism for the aurora geometry (igrf.js
    single source + igrf-reference.mjs). The curtain pointed TRUE
    north; auroral arcs run along GEOMAGNETIC east-west and the oval
    is organised by geomagnetic latitude:
    - The full IGRF-14 model (IAGA 2024): all 195 Schmidt
      semi-normalised coefficients to degree 13 at epoch 2025.0 plus
      secular variation, extracted verbatim from NOAA's
      igrf14coeffs.txt; geomag70's geodetic (WGS84) conversion; the
      standard B_r/B_theta/B_phi sums.
    - The analytic gate caught TWO real recursion bugs before any
      external anchor was consulted: the Schmidt diagonal factor
      sqrt((2m-1)/2m) must start at m = 2 (P11 = sin theta exactly),
      and the off-diagonal recursion needed the
      [(2n-1) ct P - sqrt((n-1)^2-m^2) P] / sqrt(n^2-m^2) Schmidt
      form (the first attempt used a different normalisation the
      dipole-dominated field almost masked - hand-written P_n^m for
      n <= 3 exposed it at 0.39 absolute). After the fixes:
      hand forms at 1e-16, tilted-dipole identity at 0.0 nT, the
      published 2025 geomagnetic pole (80.9 N 72.7 W), and real
      declinations everywhere (Grindelwald +3.5, Reykjavik -11.1,
      Nelson +23.0, equatorial-Atlantic inclination -30).
    - Theme: syncGeomag() computes declination + geomagnetic
      latitude at the visitor; the curtain azimuth swings by -D
      (magnetic north), the Kp oval fallback runs on geomagnetic
      latitude (Alaska at 61 N geographic is IN the oval, Hamburg at
      53.5 N is not). In-scene record confirms the live values.
    - ALSO FIXED here: the radar.js import in Horizon.html had not
      landed (the edit anchored on a stale import block and
      syncRadar's try/catch swallowed the ReferenceError - the
      radar feature was silently dead). Lesson recorded: a caught
      exception can hide a missing import; the smoke grep now
      includes PAGEERROR and the geomag record() line serves as the
      liveness signal for the import block. Gate PASS at 10/10
      references + 3/3 probes; aurora smoke clean with the IGRF
      record live.
  - DONE: radar-driven Nubis coverage field. Schneider's system
    drives its decks with 2D WEATHER MAPS; the port had collapsed
    that to a scalar cover per deck. The map is back - and it is
    MEASURED: syncRadar builds a 64^2 world-space coverage field
    from the decoded dBZ window (precipitation at a texel means
    cloud overhead; local rate maps to cover with the drizzle floor
    as threshold, saturating toward 0.95 by 1 mm/h - the rate-to-
    cover curve is the documented display mapping, the cell
    PLACEMENT is measurement). coverAt() takes max(noise cover,
    radar field) for the rain-bearing low deck only (per-deck rad
    gate); the field is anchored to the deck's advection offset at
    fetch and then drifts with the SAME wOff as the noise, so
    measured cells ride the wind with the clouds they belong to.
    The cloud shadow map integrates the same density, so shadows
    and rain cells co-locate automatically. The default 1x1 zero
    texture keeps every pinned scene identical; stratus smoke
    clean; gate PASS.
  - DONE: field-aligned auroral rays (the IGRF item's follow-up -
    the inclination was computed and unused). Auroral rays run along
    B, so in the curtain plane they fan toward the MAGNETIC ZENITH:
    the ray/wave coordinate is sheared by -y sin(beta) / tan|I| over
    the arc length - the exact projection of the field line onto the
    curtain surface, one formula for both hemispheres (symmetric in
    |beta|; the southern curtain is the mirrored mesh). Vertical at
    the magnetic-meridian centre, 13.7 deg at the arc edge for
    Reykjavik's I = 75.4 (landmark in igrf-reference.mjs);
    syncGeomag feeds tan|I|. Gate PASS; full-length aurora smoke
    clean.
  - DONE: star scintillation (Young 1967 + log-normal statistics +
    jet-stream timescale). The old twinkle was an ad-hoc sine on
    star size; replaced with the published model, one source
    (scintillation.js) shared by the shader and the reference:
    - Amplitude: Young (1967) sigma = 0.09 D^(-2/3) X^(7/4)
      e^(-h/8km) (2 dt)^(-1/2) with the NAKED-EYE aperture D = 0.7
      cm and photopic integration dt = 0.1 s - zenith sigma 0.255
      (stars visibly twinkle even overhead), 10 cm scope at 1 s
      sits at 0.014 (they barely do); the X^(7/4) airmass law is
      asserted exactly and the horizon (X ~ 5-6) saturates the
      SIGMA_MAX = 1.2 clamp - violent low-sky twinkle.
    - Statistics: intensity is LOG-NORMAL (Dravins et al. 1997),
      I = exp(sigma s) / I0(sigma) - the modified-Bessel normaliser
      is the EXACT mean of exp(sigma sin), so every star's
      time-averaged brightness is conserved at every airmass
      (quadrature check 3e-14; the shader's 5-term I0 series is
      within 3e-7 on the clamped range). Twinkling redistributes
      light in time; it does not brighten the sky.
    - Timescale: flicker rides turbulence blown across the line of
      sight (Dravins II) - the display rate scales with the
      MEASURED 250 hPa jet-stream wind already fetched for the
      cloud decks (documented mapping, clamp 4-18 Hz), so a fast
      jet overhead visibly speeds the twinkle. Modulates sprite
      opacity (intensity), not size. scintillation-reference.mjs
      is landmark set 11 in the gate.
  - Smoke-matrix hardening (the capstone sweep exposed three silent
    failure modes): sweep-pin.sh now writes each scene's FULL
    driver log to pin-<scene>.log and prints an explicit NO-SHOT
    line with the exit code when PINSTOP is never reached (the old
    grep filter swallowed net::ERR_CONNECTION_REFUSED crashes -
    five scenes "ran" against a dead fixture server and the log
    showed nothing); it liveness-checks the server before every
    scene and restarts it from SITE_DIR if down; and the snow /
    aurora scenes join Nelson at the 900 s budget (90% cloud decks
    + glints / curtain march on SwiftShader exceed 420 s - both
    timed out silently at the old budget). The full-matrix rerun
    was cut short by owner direction (see ground rules): the sweep
    remains available on demand but is no longer a per-item gate.
  - DONE: Ross-Li vegetation BRDF (the MODIS operational kernel
    model, fitted to the visitor pixel's own satellite record). One
    source, ross-li.js, mirrored exactly in the terrain TSL node:
    - Kernels: RTLSR (Lucht, Schaaf & Strahler 2000) - RossThick
      volume kernel + LiSparse-Reciprocal geometric kernel at the
      operational h/b = 2, b/r = 1 - with the Maignan et al. 2004
      hotspot factor (1 + (1 + xi/xi0)^-1), xi0 = 1.5 deg on the
      scattering bracket. Landmarks: both base kernels vanish
      exactly at nadir (f_iso IS the nadir BRF), reciprocity to
      2e-16, hotspot factor exactly 2 at the antisolar point and
      1.5 at xi0; Gauss-Legendre quadrature of the kernels
      reproduces Lucht's white-sky integrals 0.189184 / -1.377622
      to 4e-5 and exposes the published cubic black-sky fits'
      honest residuals (worst archetype albedo error 3.5%, the
      extreme-volume archetype at the 75 deg domain edge).
    - Energy: the shader applies R / BSA_M(theta_i) for the direct
      beam and HDRF_sky(theta_v) / WSA for the isotropic-sky part
      (kernel reciprocity), blended by the rig's own
      diffuse-skylight fraction (the blue-sky albedo weighting,
      Roman et al. 2010) - each term averages to exactly 1 over the
      view hemisphere (checked to 2e-15), so the Ross-Li shape
      REDISTRIBUTES the existing grass albedo with sun/view
      geometry and adds no energy. BSA_M extends Lucht's cubic with
      a least-squares cubic of the Maignan-excess integral on the
      same basis (G_DHOT, quadrature residual < 4e-4). Angles live
      in the local LEADR-mean-normal frame, clamped to the 75 deg
      kernel-fit domain.
    - Weights: the six global BRDF archetypes of Zhang, Jiao et al.
      2016 (Remote Sensing 8:1004, Table 1, red+NIR, verbatim; the
      published AFX column re-derives from the published f-values
      to 9e-4 - the table is used self-consistently). Per-pixel
      MCD43A1 needs authenticated archives (ORNL lists it but
      serves no data - probed dates/subset at multiple sites), so
      the archetype is selected by the PUBLISHED
      minimum-fitting-error rule (Jiao et al. 2014; the FY-2G
      archetype albedo retrieval): syncBrdf() fetches the visitor
      pixel's last 60 MOD09A1 composites (~16 months; archetype
      papers fit multi-year records) with per-composite sun/view
      geometry from the ORNL subset REST API (CORS confirmed for
      the site origin), keeps only strictly-clear looks by the
      published state-word QC (cloud, shadow, adjacency, high
      aerosol/cirrus, snow, water all rejected - decoder asserted
      on state words measured at the test pixel), and fits all six
      scaled archetype shapes; argmin RMSE wins. Grindelwald
      measured: 8 clear looks of 60, archetype A2, stable vs a
      90-composite refit. MODIS raz is view-minus-solar azimuth of
      the from-pixel directions, so raz = 0 IS backscatter
      (kernels are even in phi; the near-backscatter composites in
      the fetched series are visibly the bright ones). Identifiability
      is a gate landmark: at the ten REAL Terra geometries measured
      at the pixel, all 12 planted archetypes (both bands) are
      recovered with exact scale. Fewer than 4 clear looks (ocean,
      polar night, persistent cloud) -> Lambertian fallback,
      recorded in the provenance panel either way. ?brdf=N pins an
      archetype for the offline harness (shot clean with A2).
      ross-li-reference.mjs is landmark set 12 in the gate.
  - DONE: winds-aloft Cn^2 drives the star scintillation (cn2.js;
    completes the scintillation item's "documented display mapping"
    debt). The Hufnagel-Valley optical-turbulence profile
    (Hufnagel 1974; Valley 1980; parameterised form and wind rule
    per ITU-R P.1621) is driven by the MEASURED upper-atmosphere
    wind: v_RMS = sqrt((1/15km) int_5^20km V^2 dh) computed exactly
    (piecewise-linear V^2 per panel) from the Open-Meteo 500..50
    hPa wind speeds + geopotential heights that syncAloft now
    fetches (heights referenced to the API's own site elevation).
    - Landmarks (cn2-reference.mjs, gate set 13): the HV5/7 canon
      re-derived from the moment integrals - r0 = 4.96 cm ("5") and
      theta0 = 6.89 urad ("7") at 0.5 um with the canonical
      v = 21 m/s, A = 1.7e-14 (the first web-checked source that
      said v = 27 was wrong; the SPIE Field Guide's 21 lands both
      named values); the instantaneous Rytov point-receiver index
      sigma_I^2 = 2.25 k^(7/6) sec(Z)^(11/6) mu_{5/6} sits in the
      weak regime at ~0.49, consistent with Young's 0.1 s-averaged
      0.255; the ITU RMS-wind integral is exact on analytic
      profiles and refuses profiles that do not span the slab;
      the scintillation weighting Cn^2 h^(5/6) puts the mean
      altitude in the jet (7.4 km) even though the ground layer has
      the larger pointwise Cn^2, and the 30 m/s flying-shadow
      crossing rate lands at ~500 Hz = the published milliseconds
      shadow lifetime (Dravins et al. 1997 II).
    - Display: sigZen (new star uniform) = Young's calibrated
      zenith sigma x sigmaScale(v_RMS) = sqrt(mu_{5/6}(v)/
      mu_{5/6}(21)) - a calm upper atmosphere steadies the stars, a
      screaming jet churns them - clamped 0.05..0.6; twRate now
      comes from the profile's Fresnel-shadow crossing rate
      (W-weighted wind over W-weighted altitude) divided by 50
      (documented display division of a ~500 Hz process; raw-jet
      mapping stays as the no-data fallback). Measured at the test
      pixel: v_RMS 14.3 m/s -> sigma x0.84, 297 Hz -> rate 5.9.
      Both feed the provenance panel via the new Hufnagel-Valley
      record. Night scene shot clean.
  - DONE: nightglow (airglow.js + the sky dome in
    sky-objects-tsl.js) - the night sky's own light, from PALACE
    v1.0 (Noll et al. 2025, arXiv:2504.10683, the X-shooter-built
    successor of the ESO Sky Model), driven by the MEASURED solar
    radio flux:
    - Lines (PALACE Tables 2/4 + Sect. 4 verbatim): [OI] 557.7 nm
      163 R at 97 km (m_SCE +0.754), the ionospheric [OI]
      630.0+636.4 nm doublet 164 R at 250 km (+1.432), Na D 36.5 R
      at 92 km (+0.235) - the three dominant VISIBLE groups (OH's
      715 kR live in the near-IR).
    - Solar activity (PALACE Eq. 1, f0 = 1 annual mean):
      1 + 0.01 m_SCE (srf - 100), srf from the NOAA SWPC F10.7 feed
      (syncF107, trailing 27-day mean per PALACE's centred 27-day
      regression basis; ?f107=N pins it). The reference printer
      closes the loop between the two published models: scaling
      163 R from 100 to 129 sfu lands within 4.5% of the ESO Sky
      Model's 190 R reference.
    - Geometry: per-line van Rhijn (Eq. 3, R = 6371 km) - exactly 1
      at zenith, 5.8x on the horizon for 97 km, and provably WEAKER
      (3.67x) for the 250 km red layer; extinction is the engine's
      own Hillaire zenith transmittance (sunTransmittanceJS at the
      live aerosol load) raised to the Rozenberg (1966) airmass
      (Eq. 5; exactly 40 on the horizon) - the same T_ref^X pattern
      PALACE itself uses (Eq. 4), so the ring dies right at the
      horizon.
    - Photometry: line weights are LUMINANCE-exact - energy
      radiance (1 R = 1e10/4pi photons s^-1 m^-2 sr^-1, PALACE
      Sect. 2) times CIE Y from the same Wyman/Sloan/Shirley fit
      the aurora colours use (needed because
      wavelengthToLinearSRGB peak-normalises, stripping V(lambda);
      the first shot proved it - the red doublet painted the sky
      orange until the luminance weights restored the real GREEN
      dominance). Absolute check: 163 R of 557.7 nm is 3.1e-5
      cd/m^2 = 17% of the canonical 21.9 mag/arcsec^2 moonless sky.
      AGLOW_GAIN = 0.015 is the one documented exposure on the
      exact relative structure (the aurora-curtain pattern). Night
      scene shot clean: subtle green-tinted band above the
      ridgeline over a near-black zenith, 8-14/255 linear.
      airglow-reference.mjs is landmark set 14 in the gate.
  - DONE: measured tide - the sea level itself is now data. The
    Open-Meteo Marine sea_level_height_msl current value (tides +
    surge vs MSL; verified live - a real 1.5 m half-day swing at
    the Nelson test site) enters two places:
    - The water plane rides sea level through the SAME asinh world
      compression the terrain uses:
      y = 16 asinh((tide - centerElev)/500) - 0.15.
    - The Battjes-Janssen surf now breaks at the TRUE local depth:
      the bathymetry bake stores SIGNED depth clamp(-e/40, -1, 1)
      (float texture - shoreline texels keep their real height
      above MSL instead of clamping to zero), and water-tsl
      computes max(store*40 + tide, 0) before the surf LUT sample -
      exactly max(tide - e, 0) for all |e| <= 40 m, held as a
      surf-reference landmark. High water drowns the breakpoint
      bars, low water exposes them, the McCowan/BJ criterion
      untouched.
    - syncMarine carries the new field (own provenance record;
      independent of the wave partitions - a flat calm still has a
      tide); ?tide=N pins it for the offline harness (pinned scenes
      skip syncMarine, so the matrix stays deterministic at
      tide 0). The TMA mean depth is left at MSL (a +-2 m tide on a
      5-60 m mean is sub-percent on the spectrum; documented).
      NOTE the plan file is NOT prettier-managed - prettier escapes
      the math underscores; format code files only.
  - DONE: zodiacal light (zodiacal.js + the celestial dome in
    sky-objects-tsl.js) - scattered sunlight off the interplanetary
    dust, the third and last major component of the moonless sky:
    - Brightness: Leinert et al. 1998 (A&AS 127, 1) Table 17
      VERBATIM - 19 x 10 helioecliptic grid at 500 nm in 1e-8 W
      m^-2 sr^-1 um^-1, scraped from the journal's own HTML and
      closed at beta = 90 with the paper's pole value (60 +- 3
      S10sun x its own 1.28e-8 conversion = 77, held as a landmark).
      Structure landmarks: the Gegenschein (230 at (180, 0)) is a
      local maximum above the (135, 0) minimum of 179; monotonic
      elongation and latitude declines. The five unobservable
      sun-proximal cells fill by column extrapolation (daylight
      there; never displayed).
    - Geometry: the dome is a CHILD OF THE CELESTIAL GROUP, so the
      cone stands on the real ecliptic and the Gegenschein rides
      the antisolar point through the night. The shader rotates
      object-space (equatorial) directions into ecliptic
      coordinates by the obliquity - the exact TSL mirror of
      eclipticOfDir(), which the reference roundtrips (sun built at
      lam = 30 returns (30, 0) exactly; ecliptic pole at beta = 90).
      The sun's ecliptic longitude comes from the SAME NOAA series
      sunEquatorial always used (refactored, not duplicated).
    - Modulation (Masana et al. 2021 eqs. 15-18): the Earth's REAL
      heliocentric distance from the vendored ephemeris
      (AE.HelioDistance) drives fR = r^-2.3 (+-4% over the year,
      8.0% peri-to-aphelion held as a landmark), and the
      symmetry-plane factor fS = 1 + 0.1 sin(LamE - 96 deg) breathes
      the |beta| >= 60 sky by +-10% (eq. 17's own piecewise form).
    - Photometry: table units convert to luminance through the
      solar spectrum (5772 K Planck x the shared CIE-Y fit,
      Gauss-Legendre) - landing the PUBLISHED surface brightnesses
      untuned: ecliptic pole 23.24 V mag/arcsec^2 (~23.2), 
      Gegenschein 22.05 (~22.0). The display cross-calibrates to
      the airglow: one table unit = zlPerGreen() = 0.0224 of the
      reference green line, so BOTH night-sky effects share the one
      documented AGLOW_GAIN. Extinction is the shared zenith
      transmittance to the Rozenberg airmass. Night scene shot
      clean; the moonless sky now carries airglow + zodiacal light
      at their true relative strengths (the ZL minimum really does
      rival the green line - 22.9 vs ~23.3 mag/arcsec^2).
      zodiacal-reference.mjs is landmark set 15 in the gate.
  - DONE: meteor showers (meteors.js + a five-slot streak pool in
    the celestial group) - the sky now produces meteors at the REAL
    observed rates:
    - Catalogue: the IMO Meteor Shower Calendar 2026 Table 5
      (Working List of Visual Meteor Showers) VERBATIM for the
      twelve principal showers - peak solar longitude, radiant,
      V_inf, population index r, peak ZHR (extracted column by
      column from the calendar PDF, row alignment verified on the
      QUA/PER/GEM anchors). Radiant drift and the activity-profile
      slopes B come from Jenniskens 1994 (A&A 287, 990) via its
      machine-readable VizieR catalogue J/A+A/287/990 (tables 3a/3b
      + the ReadMe notes: Quadrantids B = 1.8, Geminids asymmetric
      0.39 up / 0.72 down).
    - Model: ZHR(lam_sun) = ZHRmax 10^(-B|lam - lam_max|) (the
      catalogue's own Note 1) with per-branch B; radiant of date by
      the published drifts; observed rate ZHR sin(h_R) (the ZHR
      definition unwound, Koschack & Rendtel 1990); magnitudes from
      the population-index law by inverse CDF (per-magnitude count
      ratio EXACTLY r). Landmarks (set 16): the IMO 2026 peak DATES
      land on the IMO lam_max values through the theme's own NOAA
      solar-longitude series (two published chains meeting within a
      day); the Quadrantid FWHM is 7.9 h (famously hours) vs the
      Perseids' 3.0 days; Aug 13 is led by PER at exactly 100/h and
      Dec 14 by GEM; the zenith correction and magnitude law are
      exact.
    - Display: Poisson spawning at the live rate (a Perseid-maximum
      zenith radiant yields a meteor every ~40 s - real rates, not
      fireworks); each meteor is a quad on the star sphere along
      the great circle AWAY from the radiant (foreshortened by
      sin(D), speed scaled by V_inf - the documented display
      mapping), with a sharp head sweeping down the quad and an
      exponential train pointing back at the radiant; Pogson
      amplitude from the drawn magnitude. ?meteor=N forces N/h with
      a synthetic zenith radiant AND biases spawns into the camera
      cone (harness only - the natural path is all-sky); the
      capture dump (regen.py) prints each slot's life/amp/NDC, which
      is how the first "missing" streaks were shown to be healthy
      but off-frame - the pinned shot then caught one in frame,
      head and train visible. Spawns consume Math.random, which the
      pin harness seeds - pinned scenes stay deterministic.
  - DONE: contrails by Schmidt-Appleman (contrails.js) - whether
    today's sky can hold a contrail at all is now a MEASUREMENT:
    - Physics: Schumann 1996's formulation. The exhaust mixing line
      G = EI_H2O cp P / (eps Q (1 - eta)) (kerosene EI 1.223,
      Q = 43.2 MJ/kg, eta = 0.3); formation when the line reaches
      liquid saturation - Schumann's closed-form threshold T_LM(G)
      is held to the EXACT tangency solve de_w/dT = G by Newton
      (worst 0.03 K over 200-350 hPa; landmark), with T_LC(U) for
      ambient humidity solved likewise and anchored by the exact
      closed forms at U = 0 and 1. Persistence = ice
      supersaturation, RHi = U e_w/e_i > 1. Saturation pressures
      are Murphy & Koop 2005 eqs. 7/10, anchored at the 611.657 Pa
      triple point; their supercooled e_w/e_i ratio (1.60 at
      -50 degC) is WHY persistent contrails exist at all.
    - Measured drive: syncAloft now also fetches temperature_250hPa
      + relative_humidity_250hPa and records the verdict (during
      the build: -48.5 degC / 42% -> NO formation, T_LC -49.7 - a
      knife-edge day, held as the reference's measured-case
      landmark after the physics overruled the first guess). The
      laid trails drift with the measured 250 hPa wind.
    - Aircraft: NO CORS-open ADS-B feed exists - probed OpenSky
      (allow-origin locked to its own site), adsb.lol and adsb.fi
      (no CORS headers) - so the traffic is ambient display
      furniture (a transit every ~75 s, documented) whose trails
      exist ONLY when the criterion says so and linger (tau 240 s,
      spreading) only under ice supersaturation vs seconds-scale
      stubs (tau 25 s). Cruise level stays lit until the sun is
      ~8 deg below the ground horizon (sunset contrail glow); cloud
      cover hides trails like it hides stars. ?contrail=0/1/2 pins
      the regime with a fast harness spawn cadence; noon scene shot
      clean with two sunlit trails mid-flight.
      contrails-reference.mjs is landmark set 17 in the gate.
    - Scouted and rejected this round: SWPC solar-regions sunspots
      on the limb-darkened disc (CORS-open and measured, but the
      eye-scale 0.53-deg disc makes even naked-eye groups
      sub-pixel - honest display says no); live ADS-B (CORS, above).
  - DONE (deployed at https://horizon-adsb.ndevtk.workers.dev):
    live ADS-B aircraft via a Cloudflare Worker
    (themes/horizon/worker). The owner green-lit workers, which
    removes the CORS wall from the contrail item:
    - horizon-adsb (src/index.js + wrangler.toml): an allowlisted
      proxy - GET /adsb?lat&lon&dist only, numeric-validated,
      dist <= 60 nm, coordinates rounded to ~110 m so nearby
      visitors share a 15 s edge-cached upstream call. NOT an open
      proxy. Verified end-to-end with `wrangler dev --local`: CORS
      header added, live traffic flowing (a Condor A20N at FL360
      over the test site, feed OAT -53 degC - consistent with the
      measured 250 hPa air; 38 aircraft over Heathrow on the
      OpenSky-era recheck), 404/400 on anything else.
    - Upstream reality (measured on the DEPLOYED worker, not just
      locally, over two rounds): api.adsb.lol AND opendata.adsb.fi
      don't just refuse Cloudflare-egress requests - they TARPIT
      them. Round 1 read as hard 429s; round 2 (after the failover
      build deployed) measured 5 of 6 probes hanging past 15 s
      with one sub-second 32-aircraft success - so ANY failover
      chain through the readsb feeds stalls the whole request
      before the next upstream gets a turn. The same queries
      answer sub-second from a residential IP. Decision (owner:
      "one good data source"): the readsb upstreams are DROPPED;
      OpenSky became the single source for one round (SUPERSEDED
      by the edge measurement below - OpenSky network-drops CF
      ranges too, which only /probe could see). Its restrictive
      CORS never
      mattered behind a server-side proxy (the original objection
      only applied to direct browser fetches - the owner called
      this out). OpenSky takes a bounding box (1 nm latitude =
      exactly 1/60 deg; longitude widened by 1/cos lat) and speaks
      positional state vectors in SI units, so the worker
      normalizes into the readsb shape with the exact
      international foot and knot - the theme keeps ONE parser.
      x-adsb-source names the mode per response.
    - (SUPERSEDED, kept as history) Making the OpenSky source
      good: OpenSky's anonymous tier buckets
      400 daily credits per IP - Cloudflare's shared egress
      exhausts that pool, which is the measured ~50% 503 shedding.
      A registered API client gets 4000 credits/day on its OWN
      account (docs: openskynetwork.github.io/opensky-api); the
      15 nm box is far under the 25 sq deg 1-credit tier, and the
      15 s edge cache spends the budget frugally. The worker does
      OAuth2 client-credentials against the OpenSky Keycloak
      (endpoint verified live: invalid_client 401 for bogus
      creds), caches the 30-minute Bearer token per isolate,
      refreshes once on a server-side 401, and falls back to
      anonymous (with 2 shed-absorbing retries, 400 ms apart) when
      the secrets are absent. Every upstream fetch carries a hard
      4 s AbortSignal timeout - the tarpit measurement is exactly
      why. Owner setup: create an API client on the OpenSky
      account page, then `npx wrangler secret put
      OPENSKY_CLIENT_ID` + `OPENSKY_CLIENT_SECRET` and redeploy.
    - worker-reference.mjs (gate set 18, airplanes.live build):
      the worker module runs UNMODIFIED in node, so the gate
      exercises the real handler offline - fetch stubbed with the
      measured failure modes - asserting the /v2/point URL shape,
      the strip to exactly the theme's seven fields with readsb
      units UNTOUCHED, "ground"/incomplete vectors dropped, a 429
      blip carried by the rate-respecting retry with the
      User-Agent sent, CORS + x-adsb-source, the adsbToScene
      round-trip, /probe mapping statuses and thrown timeouts
      alike into inspectable rows, and the 404/400/OPTIONS
      allowlist. Live checks: the real handler run in node served
      14 aircraft over Heathrow / 3 alpine / 5 JFK from
      airplanes.live; workerd (`wrangler dev --local`) 15 over
      Heathrow with exactly the seven fields.
    - Theme: syncTraffic polls the worker each minute (only while
      Schmidt-Appleman says trails can exist), maps state vectors
      with adsbToScene (contrails.js: exact international foot/knot
      constants, the theme's own equirectangular + asinh mapping;
      landmark set: origin/altitude/velocity exact, +8 km north =
      half-world) and queues cruise aircraft (>= FL260, inside the
      world, deduplicated by hex for 10 min). Free contrail slots
      claim REAL aircraft first - real position, real altitude,
      real track and ground speed, callsign in the provenance
      record - with the ambient traffic as documented fallback
      (worker not deployed, offline harness, no coverage).
      ?adsb=URL overrides the proxy origin.
    - DEPLOY (owner): cd themes/horizon/worker && npx wrangler
      deploy (needs `wrangler login` or CLOUDFLARE_API_TOKEN). The
      theme expects https://horizon-adsb.<subdomain>.workers.dev -
      ADSB_PROXY in Horizon.html assumes subdomain `ndevtk`; update
      it if the account's workers.dev subdomain differs. Each
      upstream change needs a redeploy.
    - RESOLVED by edge measurement (GET /probe on the deployed
      worker, 2026-07-06, three consistent runs): control 200 in
      389 ms (egress healthy); opensky-api AND opensky-auth
      TimeoutError at 6 s even with an honest User-Agent -
      OpenSky network-drops Cloudflare ranges, so credentials can
      NEVER help (the owner's OPENSKY_* worker secrets are now
      unused and can be deleted); adsb.lol 429 in 869 ms and
      adsb.fi 403 in 139 ms - fast deliberate refusals; and
      airplanes.live 200 with 30-32 aircraft in 126-232 ms every
      time. airplanes.live is itself served through Cloudflare,
      so worker-to-it traffic is first-class. THE one source:
      airplanes.live /v2/point/lat/lon/radius - readsb v2
      natively (feet, knots), so no unit conversion even exists
      to get wrong; the worker strips vectors to the seven fields
      the theme reads (an order of magnitude smaller payload) and
      respects the documented 1 req/s: rounded coords + 15 s edge
      cache + the single retry spaced a full 1.1 s. /probe stays
      in the worker as a permanent regression instrument. History
      of the hunt, all measured: OpenSky's anonymous per-IP 400
      credits/day explained the 503 shedding; the readsb feeds
      tarpit CF egress (5/6 probes hung >15 s); adsb.one serves a
      bot-challenge page even to a residential probe. The
      earlier OAuth2 client-credentials build (Keycloak token
      endpoint, per-isolate 30-min cache, 401 refresh) is in git
      history at cfffb36 should OpenSky ever unblock Cloudflare.
  - DONE (deploy + key pending): live AIS ships on the FFT ocean
    (ships.js + worker /ais route) - the worker pattern's second
    payoff, and the first use of its OTHER superpower: a static
    GitHub Pages site can never hold a secret, but a worker can.
    - Source: aisstream.io - global community AIS over WebSocket,
      free API key, terms explicitly forbid browser exposure (so
      the key lives in `npx wrangler secret put AISSTREAM_KEY`).
      /ais opens an outbound socket, subscribes the visitor's
      bounding box (subscription must arrive within 3 s - sent on
      open), collects PositionReports for a 2.5 s window, closes,
      answers plain JSON stripped to seven fields with ITU-R
      M.1371 sentinels mapped (Sog 102.3 -> 0, Cog 360 / heading
      511 -> null), 60 s manual edge cache per rounded coordinate
      (few concurrent sockets on the free tier - the cache IS the
      budget). Bad-key reality (measured): aisstream keeps the
      socket open and sends NOTHING - indistinguishable from an
      empty sea - so the documented error-frame path is handled
      but verification needs a real key over a busy lane (Dover
      Strait) after deploy. WS mechanics verified in node AND
      workerd against the live server (connect + subscribe +
      window + clean close, /adsb unaffected).
    - Physics (ships.js): COLREGS 1972 verbatim - Rule 21 arcs
      (masthead 225 deg, sidelights 112.5 each, sternlight 135;
      side + stern tile the circle exactly), Rule 22 ranges for
      >= 50 m vessels (6/3/3 nm), Annex I section 8 luminous
      intensity I = 3.43e6 T D^2 K^-D (reproduces the published
      table: 0.9 cd at 1 nm, 12 at 3, 94 at 6), Allard's law for
      apparent illuminance - and the Annex I constant 3.43e6 IS
      1852^2 to three figures, so at the rated range the eye
      receives exactly the adopted 2e-7 lux threshold: the
      regulation is Allard's law solved for I (landmarked to
      1e-12). Rule 20(b) lights from sunset to sunrise = solar
      altitude below -50 arcmin. ships-reference.mjs is gate set
      18 (6 landmarks); the /ais route landmark joined set 19
      (worker): stubbed aisstream socket, subscription carries
      key + exact bbox, latest-per-MMSI, sentinels, 503 without a
      key.
    - Theme: 8-slot ship pool on the tide-following water plane;
      syncShips polls /ais every 120 s (only when the DEM has
      sea), dead-reckons on SOG/COG between reports, hulls are
      documented display furniture (90 m default - position
      reports carry no dimensions); each nav light shows only
      inside its Rule 21 arc for the camera's CURRENT relative
      bearing, brightness Allard at actual distance (a 3 nm
      sidelight dies at 3 nm exactly), provenance panel lists
      callsigns + speeds. ?ais=URL overrides the proxy; ?ship=N
      spawns deterministic synthetic vessels (no fetch, no
      Math.random) for pinned shots.
    - Owner setup: create the free key at aisstream.io (GitHub
      sign-in), then `cd themes/horizon/worker && npx wrangler
      secret put AISSTREAM_KEY && npx wrangler deploy`.
  - DONE (owner provisioning): horizon-live, the dedicated-IP
    successor to the worker (themes/horizon/server) - the owner
    chose a real server (GCP free-tier e2-micro) after the
    deployed /ais answered an empty Dover Strait and every
    worker-side failure traced to Cloudflare's SHARED egress IPs.
    - Daemon (src/index.mjs, node >= 22, ZERO npm dependencies):
      ONE persistent aisstream.io WebSocket with a GLOBAL
      subscription (their design intent), ingested into a
      last-position-per-MMSI table under a 1x1 degree spatial
      grid - any visitor is answered from RAM; reconnect with
      exponential backoff + a 180 s stale-feed watchdog (a valid
      global subscription never goes quiet - which also makes a
      dead key visible in /health within seconds, ending the
      silent-key ambiguity the worker could not escape); /adsb by
      readsb failover (adsb.lol -> adsb.fi -> airplanes.live, all
      through the worker-gated normalize()) with a 15 s cache -
      the clean IP reopens the rich feeds, VERIFIED live from
      this box (adsb.lol answered first, 10 aircraft, cache hit
      on repeat); /probe ported (incl. OpenSky - measure the
      box's own IP before trusting it); /health engine stats.
    - NOT an open CORS proxy (owner requirement): Origin
      allowlist - only ALLOW_ORIGIN (default the GitHub Pages
      origin) gets a CORS grant, foreign origins are refused 403,
      absent Origin passes with NO grant; per-IP token-bucket
      rate limit; GET/OPTIONS only; params validated; the
      normalizers are IMPORTED from the worker source (the model
      lives once).
    - server-reference.mjs is gate set 20: grid ingest with cell
      migration (old cell emptied AND deleted), latest-per-MMSI,
      Class B on the same path, junk counted not stored; query on
      the same aisBox geodesy with exact boundary inclusion,
      internals stripped, limit honoured; prune with grid
      cleanup; origin allowlist semantics; limiter budget/refill/
      isolation - all under explicit clocks. Flat /opt deploy
      layout (install.sh rewrites the worker import path)
      verified by simulation.
    - Ops: hardened systemd unit (DynamicUser, ProtectSystem=
      strict, MemoryMax), Caddyfile for auto-TLS (sslip.io works
      domainless), idempotent install.sh (NodeSource node 22 +
      Caddy), README runbook with the GCP free-tier notes (IPv4
      now billed separately; ~1 GB/mo free egress - payloads are
      deliberately a few KB). Optional: Cloudflare orange-cloud
      in FRONT for inbound shielding while outbound keeps the
      clean IP - the best of both measured worlds.
    - DEPLOYED at https://api.ndev.tk (GCP box behind
      Cloudflare orange-cloud with an Origin CA cert, Full
      strict - the 525 on first try was the Caddy-ACME
      chicken-and-egg, solved exactly that way). Measured from
      ITS IP via /probe: control 200, opensky-api 200/683 ms
      (OpenSky IS back on a dedicated IP), adsb.lol 200 (serving
      /adsb first, 10 aircraft over Heathrow), adsb.fi 200,
      airplanes.live 200 - EVERYTHING answers; the shared-egress
      thesis fully confirmed. /health on first full deploy:
      23,344 ships resident in 917 grid cells, ~104 frames/s,
      badFrames 0 (the ships:0 mystery was OUR Blob bug, fixed
      and gated - the owner's key was fine all along); Dover
      Strait answered with named vessels (ZIM VIETNAM 14.5 kt
      hdg 017, GAS NOBLE, NAVIGATOR LUNA...). Origin lock holds
      through Cloudflare: foreign origin 403, site origin exact
      echo. ADSB_PROXY/AIS_PROXY defaults in Horizon.html now
      point at api.ndev.tk; the horizon-adsb worker stays
      deployed as documented fallback (?adsb=/?ais= overrides).
  - DONE (live end-to-end): real-time lightning - Blitzortung.org
    strikes flash on the horizon, the item the worker era had to
    shelve because it needs a PERSISTENT socket. First use of the
    daemon's client-facing push, and the owner asked the right
    question at the right moment: EventSource/WebSocket BYPASS
    CORS, so client streams are origin-scoped server-side - the
    daemon's global Origin allowlist gate 403s foreign origins
    before a stream opens (verified live), and that check is the
    ONLY origin protection such endpoints can have.
    - Feed: Blitzortung's community sockets (ws1/ws7/ws8,
      subscribe {"a":111}), wire format LZW-compressed JSON -
      protocol verified LIVE before a line was written (Florida
      storm strikes decoded on first connect). The daemon's
      decoder is gated by round-trip against a spec-built encoder
      INCLUDING the KwKwK corner case; strikes land in the same
      1-degree grid pattern as ships (ns -> ms time base, 15 min
      retention), queried by EXACT haversine after a cell
      prefilter. /lightning snapshot + /lightning/stream SSE
      (25-s heartbeats, 30-min lifetime, SSE_MAX cap). Live
      check: 106 strikes resident 12 s after boot; the Orlando
      storm streamed 18 strikes in a 20 s listen window with
      exact ranges. Data CC BY-SA, credited in the provenance
      panel.
    - Physics (lightning.js, gate set 21 - 5 landmarks): Rakov &
      Uman 2003 flash structure - 15-20% single-stroke, mean
      multiplicity 3-5 (median 3), ~60 ms geometric-mean
      interstroke intervals, subsequent strokes ~0.4 of the
      first, continuing current in 30-50% of flashes (20k-draw
      statistics all inside the published bands); Koschmieder
      T = exp(-3.912 d/V) with the exact-2%-at-V landmark;
      haversine on the IUGG mean radius (equatorial degree
      111.1949 km exact); apparent brightness T/d^2.
    - Theme: SSE strikes become flash events whose FLICKER IS THE
      PHYSICS - the 60 Hz frame loop evaluates the stroke
      sequence directly (the ~60 ms restrikes and continuing-
      current glow are frame-resolvable), amplitude carries
      Koschmieder + inverse-square at the true distance, the glow
      quad hangs at the true bearing (createFlashMaterial - the
      radial shape is the one documented display element).
      ?strike=N spawns deterministic synthetic flashes (fixed
      uniform table, camera-cone azimuths) for pinned shots;
      ?lightning=URL overrides the endpoint. EventSource
      reconnects itself.
  - DONE: the unified live channel + gate-checked self-deploys -
    the two pieces the owner picked after the daemon proved out
    (200 GB/mo egress confirmed comfortable: ~130 MB/mo per
    always-on viewer BEFORE Cloudflare's edge cache absorbs
    repeats).
    - /stream (daemon): ONE origin-scoped EventSource per viewer
      multiplexes named events - `strike` the instant Blitzortung
      locates one, `ais` ship deltas every 30 s from the in-RAM
      global picture, `adsb` aircraft every 20 s through the
      shared per-area cache (many viewers in one place still cost
      ONE upstream request; the readsb rate budget is managed in
      one place, server-side). Initial ais/adsb push on connect;
      25 s heartbeats; 30 min lifetime onto EventSource's
      auto-reconnect; SSE_MAX cap shared with the legacy
      /lightning/stream (kept for one deploy cycle). sseEvent()
      framing is spec-exact and landmarked. Live smoke on the
      real upstreams: one 25 s connection carried 52 strikes
      (Florida storm), 2 adsb pushes (14 aircraft) and the ais
      event. Aircraft now appear within ~20 s of reality instead
      of up to 60 s - a contrail starts where the plane IS.
    - Theme: syncTraffic/syncShips refactored into fetch +
      applyTraffic/applyShips; the unified EventSource feeds the
      SAME apply functions (idempotent by hex/MMSI), the polls
      stay armed as documented fallback. ?live=URL overrides the
      stream base.
    - Self-update (server/update.sh + systemd timer, armed by
      install.sh): every 5 min the box fetches UPDATE_BRANCH
      (default main - merging to main IS the deploy trigger,
      matching Pages), and if server files changed it runs the
      FULL reference gate ON THE BOX (validate.sh CPU sets -
      plain node, which is the whole point of the gate) before
      reinstalling; the previous install is kept at
      /opt/horizon-live.prev for instant rollback and a failing
      gate leaves the running version untouched (remembered, so
      no retry spam). Nothing deploys unverified - ops now obeys
      the same law as the code. Owner note: set
      UPDATE_BRANCH=claude/website-themes-discussion-jjh4yp in
      /etc/horizon-live.env to track the PR branch until #44
      merges, or leave main and deploys begin at merge.
  - DONE: aircraft exterior lights (navlights.js) - the live
    traffic layer now works around the clock. By day the ADS-B
    aircraft lay Schmidt-Appleman contrails; after sunset they
    carry what 14 CFR Part 25 CERTIFIES, the aviation twin of the
    ships' COLREGS item:
    - 25.1385/25.1389 arcs verbatim: red left / green right
      forward position lights over 110 deg each (both reach dead
      ahead), white tail light over the remaining 140 - tiling
      the circle exactly (landmarked like Rule 21)
    - the 25.1391 minimum-intensity table verbatim, BY ANGLE OFF
      THE NOSE: 40 cd inside 10 deg, 30 to 20 deg, 5 to 110,
      20 cd rear - so an aircraft flying straight at the camera
      is 8x brighter than one crossing abeam, which is the real
      night-sky look
    - 25.1401 anti-collision strobes: 400 cd effective, 40-100
      flashes/min - each aircraft's rate and phase deterministic
      in its 24-bit ICAO hex, so the sky never blinks in unison
      (landmark counts flashes/min for two hexes: in-band and
      desynchronized)
    - ONE Allard model with the ships (apparentLux imported;
      visRangeM bisection meets it to 1e-9): a 40 cd position
      light dies at 4.58 nm, the strobe carries to 8.92 - and
      ranges are SLANT ranges (altitude included), so a jet 10 km
      up overhead is 10 km away
    - 91.209 lights from sunset to sunrise - the ships'
      SUNSET_ELEV boundary reused
    - Theme: applyTraffic now feeds TWO consumers - every valid
      aircraft at ANY altitude (approach traffic low overhead is
      the brightest sight of all) updates the 8-slot airLights
      pool (dead-reckoning like ships, idempotent by hex), while
      cruise-only traffic still queues for contrail slots.
      navlights-reference.mjs is gate set 22 (4 landmarks).
      ?plane=N spawns deterministic mixed-altitude crossings for
      pinned shots.
  - DONE: the Milky Way - Gaia DR3 integrated starlight, measured
    star by star. No Pioneer table survives in machine-readable
    form, so we went one better: TWO server-side ESA TAP
    aggregations over the ENTIRE gaiadr3.gaia_source catalogue
    (job ids + queries verbatim in milkyway-data.js) - G/BP/RP
    flux sums per HEALPix level-5 cell for ALL sources, minus the
    same sums for G < 5.5, because the theme draws the bright end
    as individual Yale stars: the dome carries only light fainter
    than the drawn catalogue, the very construction of the
    Pioneer background maps. The counts sum to 1,811,709,771 -
    the published DR3 total EXACTLY, asserted by the gate.
    - milkyway.js (gate set 23, 5 landmarks): Gorski 2005 nested
      pix2ang AND ang2pix - the round trip holds for ALL 12288
      pixels, a landmark that immediately caught a real polar-cap
      off-by-one (nr = jr, not jr+1) that spot checks had missed;
      exact J2000 galactic rotation (l=0,b=0 -> RA 266.4050 Dec
      -28.9362 textbook; NGP b=90; inverse exact); Riello 2021
      G-V coefficients verbatim with the S10 unit closed by
      construction (a lone V=10 star over 1 deg^2 -> s10 = 1 to
      1e-9); whole-sky diffuse starlight G = -6.66 (classical
      ~-6.7); plane/pole structure 207 vs 28.2 S10 - the pole
      mean IN Toller's 20-40 band (the exact-NGP cell is
      Poisson-dominated by undrawn 5.5-6.5 mag stars - 31 Com
      sits on the pole - so only the ensemble is asserted, the
      aurora lesson re-learned).
    - Render: createMilkyWayMaterial bakes the exact per-cell
      pipeline into a 512x256 equirect float texture in the
      celestial frame (3-tap smoothing over the 1.8-deg cells is
      the documented display smoothing; the BP-RP tint mapping is
      the one documented display element), sampled on a dome
      riding the star group with the SAME zlPerGreen base,
      AGLOW_GAIN, night gate and zenith-transmittance extinction
      as the zodiacal light - the galaxy/zodiacal contrast has NO
      free parameter. milkyway-data.js is ~450 KB (4-sig-fig
      fluxes; Pages gzips it to ~150 KB).
  - DONE: earthshine (earthshine.js) - "the old moon in the new
    moon's arms" completes the lunar photometry:
    - the chain is closed-form and MEASURED at its anchor: the
      Earth's phase from the Moon is the exact complement of the
      Moon's phase from Earth (new moon = FULL Earth over the
      thinnest crescent); the Earth's effective albedo is the Big
      Bear programme's A* = 0.297 (Goode et al. 2001 - measured
      by watching precisely the glow this item draws); Lambertian
      sphere phase law at its exact nodes (f(pi/2) = 1/pi);
      geometry on the shared IUGG radius (imported from
      lightning.js - the model lives once)
    - landmarks (gate set 24): full Earth from the Moon V =
      -16.52 (published -17..-16.1), 33x the full Moon;
      earthlight/sunlight = 8.16e-5 at new moon = A*(R_E/d)^2
      exactly - the ashen side 10.2 mag below the sunlit surface
      (the classical Danjon contrast); quarter = new/pi exactly;
      full moon -> 0
    - render: the dark limb is lit FROM the observer's direction
      - TRUE OPPOSITION geometry - so createMoonMaterial applies
      the SAME Hapke kernel with incidence along the view and
      g = 0 (SHOE surge fully on, Henyey-Greenstein backscatter
      P(0) in closed form): no separate photometric model, one
      new uniform (the ratio, fed per frame from the same two
      vectors the shader already uses). ?eshine=N scales for
      harness shots.
  - DONE: noctilucent clouds (nlc.js) - the 83-km mesospheric ice
    shell, and the item's crown: the classical visibility window
    is DERIVED, not gated. The exact construction - closed-form
    ray-to-shell distance on the IUGG Earth (shared with
    lightning.js), then the Earth's shadow cylinder widened by
    Rozenberg's 30 km twilight screening - puts the last sunlit
    patch toward the sunward horizon at 16.55 deg solar
    depression: Gadsden & Schroeder's published "6-16 deg NLC
    window" emerges from the geometry to within half a degree
    (the 6-deg end stays as the documented sky-brightness gate).
    Landmarks (gate set 25): shell distances at their closed
    forms (zenith exactly h; horizon exactly sqrt(h(2R+h)));
    zenith shadow boundary matching BOTH closed forms exactly -
    solid Earth acos(R/(R+h)) = 9.20 deg (the textbook figure)
    and screened acos((R+s)/(R+h)) = 7.35; sunward/antisolar
    asymmetry at 12 deg; season envelope peaking exactly 22 days
    after the observer's summer solstice (DeLand/Fiedler shape),
    zero out of season/below 50 deg latitude, hemisphere flip
    with year wrap exact. No live NLC feed exists, so
    night-to-night variability is deliberately absent - in
    season, at latitude, in the window, the climatological-mean
    veil shows (documented display choice). Render: the TSL
    fragment mirrors nlc.js exactly in world kilometres; the
    billow pattern (~35/90 km gravity-wave scales drifting at
    the mesospheric ~40 m/s), forward-scattering brightening,
    slant-path thickening and silvery-blue tint are the
    documented display elements. ?nlc=N forces the envelope
    (geometry stays exact) for pinned shots.
  - DONE: the naked-eye satellite fleet (sats.js) - the ISS's
    visibility physics generalised to CelesTrak's curated
    `visual` group (157 objects when fetched), Starlink trains
    and all:
    - daemon /tles route: CelesTrak GP data cached 6 h in memory
      (their own request of clients), stale-served through
      outages (TLEs hold for days), origin-locked like every
      route - verified live (157 sets, cache hit on repeat)
    - sats.js (gate set 26, 4 landmarks): TLE parsing gated by
      the format's OWN integrity check (the modulo-10 checksum -
      a one-digit corruption drops the set); Vallado's
      cylindrical shadow with the boundary exactly at R_eq; the
      McCants standard-magnitude law (m_std at 1000 km half
      phase; +5 mag at 10x range exactly; full phase 2.5 log10
      pi brighter) on the Lambert phase law IMPORTED from
      earthshine.js - one phase law now serves the moon,
      earthshine and satellites; and the vendored satellite.js
      (Vallado's SGP4 - it runs unmodified in node, so the gate
      drives the REAL propagator) holds a real 1963 element set
      inside its own orbit band computed from the set's n and e.
      Intrinsic magnitudes are not distributed with GP data: the
      naked-eye class default 4.0 is the documented display
      choice; every pass's GEOMETRY is exact.
    - Theme: syncFleet (6 h, checksummed, ISS excluded - its
      certified path stays); 12-dot pool; per frame SGP4
      refreshes round-robin (8/frame, ~10 us each) with
      velocity extrapolation between refreshes (<10 ms drift);
      drawn only above the horizon, outside the shadow cylinder,
      sun below -0.05 rad, and brighter than mag 4.6 - typically
      a handful of moving points, which is what the real night
      sky shows. ?tles=URL overrides the proxy.
  - OPEN (environment, not code): today's fixture rig drops the
    volumetric cloud decks and spams "2D view of 3D texture" Dawn
    validation errors from the Nubis noise volumes - bisect-shot
    d202bb5 (the certified phase-5 build), 289ab7c, a466700,
    ad2270c and HEAD all reproduce it, while the SAME d202bb5 code
    rendered clouds in its Jul 5 certification shots. Same pinned
    Chrome binary, same shoot.mjs, no system Vulkan ICDs (bundled
    SwiftShader), so the trigger is environmental drift in the
    container, not any commit. References + GPU probes (the actual
    correctness gate) are unaffected and green. Revisit if cloud
    scenes need pixel inspection; the errors first appear when the
    cloud compute pipeline spins up (~frame 200).
  - Phase 5 FINAL CERTIFICATION - full pinned matrix with EVERYTHING
    (octave clouds, limb darkening, FFT ocean + filtering, cloud
    shadows, Hapke moon), real WebGPU vs WebGL2, mean abs /255:
    noon 0.0115, sunset 0.048, night 0.0009, stratus 0.73, towering
    0.40, Nelson 0.0007, snow 0.33, aurora 0.0003 - all green, all
    residuals the documented deck-confined fp-dither / point-sprite
    profiles.
  - Earlier certification (pre cloud shadows) - full pinned matrix with everything
    (octave clouds, limb darkening, FFT ocean + filtering), real
    WebGPU vs WebGL2 backend, mean abs /255: noon 0.0099, sunset
    0.040, night 0.0009, stratus 1.10 (the known deck fp-dither
    profile at the octave model's larger transmitted signal; terrain
    rows exactly 0), towering 0.30, Nelson 0.0007, snow 0.39,
    aurora 0.0003 - all green. Wind-range visual pass (u = 4/12/28
    on harness/tsl-water-gpu.html): calm glassy sea with a tight
    glitter lobe, moderate sea with a broadened dimmer lobe, gale
    sea whitecapped to ~32% Monahan coverage - physical across the
    range.
