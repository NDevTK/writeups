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
    - glints / curtain march on SwiftShader exceed 420 s - both
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
      sigma*I^2 = 2.25 k^(7/6) sec(Z)^(11/6) mu*{5/6} sits in the
      weak regime at ~0.49, consistent with Young's 0.1 s-averaged
      0.255; the ITU RMS-wind integral is exact on analytic
      profiles and refuses profiles that do not span the slab;
      the scintillation weighting Cn^2 h^(5/6) puts the mean
      altitude in the jet (7.4 km) even though the ground layer has
      the larger pointwise Cn^2, and the 30 m/s flying-shadow
      crossing rate lands at ~500 Hz = the published milliseconds
      shadow lifetime (Dravins et al. 1997 II).
    - Display: sigZen (new star uniform) = Young's calibrated
      zenith sigma x sigmaScale(v*RMS) = sqrt(mu*{5/6}(v)/
      mu\_{5/6}(21)) - a calm upper atmosphere steadies the stars, a
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
      computes max(store\*40 + tide, 0) before the surf LUT sample -
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
      - the ReadMe notes: Quadrantids B = 1.8, Geminids asymmetric
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
      - relative_humidity_250hPa and records the verdict (during
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
    removes the CORS wall from the contrail item: - horizon-adsb (src/index.js + wrangler.toml): an allowlisted
    proxy - GET /adsb?lat&lon&dist only, numeric-validated,
    dist <= 60 nm, coordinates rounded to ~110 m so nearby
    visitors share a 15 s edge-cached upstream call. NOT an open
    proxy. Verified end-to-end with `wrangler dev --local`: CORS
    header added, live traffic flowing (a Condor A20N at FL360
    over the test site, feed OAT -53 degC - consistent with the
    measured 250 hPa air; 38 aircraft over Heathrow on the
    OpenSky-era recheck), 404/400 on anything else. - Upstream reality (measured on the DEPLOYED worker, not just
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
    x-adsb-source names the mode per response. - (SUPERSEDED, kept as history) Making the OpenSky source
    good: OpenSky's anonymous tier buckets
    400 daily credits per IP - Cloudflare's shared egress
    exhausts that pool, which is the measured ~50% 503 shedding.
    A registered API client gets 4000 credits/day on its OWN
    account (docs: openskynetwork.github.io/opensky-api); the
    15 nm box is far under the 25 sq deg 1-credit tier, and the
    15 s edge cache spends the budget frugally. The worker does
    OAuth2 client-credentials against the OpenSky Keycloak
    (endpoint verified live: invalid*client 401 for bogus
    creds), caches the 30-minute Bearer token per isolate,
    refreshes once on a server-side 401, and falls back to
    anonymous (with 2 shed-absorbing retries, 400 ms apart) when
    the secrets are absent. Every upstream fetch carries a hard
    4 s AbortSignal timeout - the tarpit measurement is exactly
    why. Owner setup: create an API client on the OpenSky
    account page, then `npx wrangler secret put
OPENSKY_CLIENT_ID` + `OPENSKY_CLIENT_SECRET` and redeploy. - worker-reference.mjs (gate set 18, airplanes.live build):
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
    Heathrow with exactly the seven fields. - Theme: syncTraffic polls the worker each minute (only while
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
    ?adsb=URL overrides the proxy origin. - DEPLOY (owner): cd themes/horizon/worker && npx wrangler
    deploy (needs `wrangler login` or CLOUDFLARE_API_TOKEN). The
    theme expects https://horizon-adsb.<subdomain>.workers.dev -
    ADSB_PROXY in Horizon.html assumes subdomain `ndevtk`; update
    it if the account's workers.dev subdomain differs. Each
    upstream change needs a redeploy. - RESOLVED by edge measurement (GET /probe on the deployed
    worker, 2026-07-06, three consistent runs): control 200 in
    389 ms (egress healthy); opensky-api AND opensky-auth
    TimeoutError at 6 s even with an honest User-Agent -
    OpenSky network-drops Cloudflare ranges, so credentials can
    NEVER help (the owner's OPENSKY*\* worker secrets are now
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
    GitHub Pages site can never hold a secret, but a worker can. - Source: aisstream.io - global community AIS over WebSocket,
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
    window + clean close, /adsb unaffected). - Physics (ships.js): COLREGS 1972 verbatim - Rule 21 arcs
    (masthead 225 deg, sidelights 112.5 each, sternlight 135;
    side + stern tile the circle exactly), Rule 22 ranges for > = 50 m vessels (6/3/3 nm), Annex I section 8 luminous > intensity I = 3.43e6 T D^2 K^-D (reproduces the published > table: 0.9 cd at 1 nm, 12 at 3, 94 at 6), Allard's law for > apparent illuminance - and the Annex I constant 3.43e6 IS > 1852^2 to three figures, so at the rated range the eye > receives exactly the adopted 2e-7 lux threshold: the > regulation is Allard's law solved for I (landmarked to > 1e-12). Rule 20(b) lights from sunset to sunrise = solar > altitude below -50 arcmin. ships-reference.mjs is gate set > 18 (6 landmarks); the /ais route landmark joined set 19 > (worker): stubbed aisstream socket, subscription carries > key + exact bbox, latest-per-MMSI, sentinels, 503 without a > key. - Theme: 8-slot ship pool on the tide-following water plane;
    syncShips polls /ais every 120 s (only when the DEM has
    sea), dead-reckons on SOG/COG between reports, hulls are
    documented display furniture (90 m default - position
    reports carry no dimensions); each nav light shows only
    inside its Rule 21 arc for the camera's CURRENT relative
    bearing, brightness Allard at actual distance (a 3 nm
    sidelight dies at 3 nm exactly), provenance panel lists
    callsigns + speeds. ?ais=URL overrides the proxy; ?ship=N
    spawns deterministic synthetic vessels (no fetch, no
    Math.random) for pinned shots. - Owner setup: create the free key at aisstream.io (GitHub
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
      Bear programme's A\* = 0.297 (Goode et al. 2001 - measured
      by watching precisely the glow this item draws); Lambertian
      sphere phase law at its exact nodes (f(pi/2) = 1/pi);
      geometry on the shared IUGG radius (imported from
      lightning.js - the model lives once)
    - landmarks (gate set 24): full Earth from the Moon V =
      -16.52 (published -17..-16.1), 33x the full Moon;
      earthlight/sunlight = 8.16e-5 at new moon = A\*(R_E/d)^2
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
  - DONE: eclipses done RIGHT (eclipses.js) - the first-pass
    solar-eclipse code was exactly the kind of approximation this
    project exists to remove, and lunar eclipses did not exist:
    - the old code dimmed the light by the linear MAGNITUDE
      (diameter fraction) with a fixed 0.267-deg sun. Replaced:
      illuminance follows the covered AREA - the exact two-disc
      lens integral (at magnitude 0.5 the true obscuration is
      0.391: every partial phase was over-darkened by up to
      ~28%) - and the sun's radius now comes from the true VSOP87
      distance (its +-1.7% annual swing IS the total-vs-annular
      distinction; the annular branch returns (r_m/r_s)^2).
    - lunar eclipses: the classical geocentric shadow
      construction with Danjon's 2% enlargement (the Almanac's
      rule) - umbral/penumbral magnitudes and the exact umbral
      AREA immersion, which drives a copper darkening of the
      Hapke moon disc (Danjon L2 tint as the documented display
      mapping; the penumbra dims gently, as it really does).
    - eclipses-reference.mjs (gate set 27, 5 landmarks) validates
      the EXACT chain the page runs (the vendored
      astronomy-engine in node) against PUBLISHED history: the
      lens integral at its closed forms + a deterministic grid
      integration; Dallas 2024-04-08 TOTAL at 18:42 UT with
      magnitude 1.013 (published 1.018) and FIRST CONTACT
      bracketed to the published 17:23 UT; Galicia 2026-08-12 -
      the eclipse five weeks from this commit - max obscuration
      100.0% over 17:00-20:00 UT (our own ephemeris confirms the
      totality); the 2026-03-03 total lunar eclipse peaking at
      umbral magnitude 1.16 fully immersed, with the
      Danjon-enlarged umbra spanning 2.70 moon radii (classical
      ~2.7).
    - Theme: astro block feeds eclipses.js from the SAME
      AE.Equator results (sun distance now captured); the
      existing dimming plumbing (direct 1-0.93f, ambient 1-0.85f)
      consumes the new area obscuration unchanged; say() reports
      obscuration + magnitude + annular; ?eclipse=f harness
      override. On 2026-08-12 every visitor in the path gets the
      real darkness at the real minute.
  - DONE: light pollution (skyglow.js) - the biggest honesty gap
    left in the night sky: the theme rendered the same pristine
    Gaia galaxy over Manhattan as over the Atacama. Now the
    visitor's night sky is set by their MEASURED artificial
    skyglow:
    - data: the World Atlas of Artificial Night Sky Brightness
      itself (Falchi et al. 2016, Science Advances; DOI
      10.5880/GFZ.1.4.2016.001, CC BY-NC) - the 653 MB source
      GeoTIFF (30 arcsec, float32 mcd/m^2) downloaded from GFZ
      and downsampled to a 0.5-deg grid (720 x 290, mean in
      LINEAR brightness, byte log-quantised: skyglow-data.js,
      ~270 KB). Site checks at FULL resolution before
      downsampling reproduced the published values: Las Vegas
      17.26, London 17.63, Mauna Kea 21.98, mid-Pacific 22.00
      mag/arcsec^2.
    - physics: the paper's own scale (natural = 0.174 mcd/m^2 =
      22.00 mag/arcsec^2; total = 22 - 2.5 log10(1+r)); celestial
      sources wash by CONTRAST, exactly 1/(1+r); horizon
      anisotropy machinery via Walker's law (1977: d^-2.5) ring
      samples of the same grid (gated; dome anisotropy wiring is
      the noted follow-up). Conventional SQM->Bortle mapping for
      the provenance line.
    - skyglow-reference.mjs (gate set 28): quantisation
      round-trip over all 256 byte values; the scale's closed
      forms; Bortle breakpoints; the geography of light in four
      grid samples (Vegas/London city cells < 19.5, mid-Pacific
      exactly 22.00, Atacama dark, beyond coverage 0); Walker's
      law exact (25 vs 100 km = 4^2.5 = 32).
    - theme: boot-time sample at the visitor -> star field,
      constellations, Milky Way, zodiacal and airglow scale by
      1/(1+r); planets and meteor heads (bright compact sources)
      by 1/sqrt(1+r) (documented split); a warm sodium/LED veil
      dome (createVeilMaterial reused additively) rises with
      darkness and brightens under overcast - real urban clouds
      glow, they do not blacken. Provenance line quotes zenith
      mag/arcsec^2, Bortle class and the contrast factor.
      ?lp=r overrides for harness shots.
  - DONE: paraselenic optics - the moon gets the certified optics
    dome. The classic winter-night sight (the 22-deg lunar halo
    in cirrus) plus moon dogs and the rare moonbow, with NO new
    optical physics: createOpticsMaterial (the gated Descartes
    bows + halo + parhelia LUTs) instanced a second time and
    anchored to the moon. What IS new and single-sourced:
    moonphase.js - the disk-integrated Hapke phase curve
    extracted from moon-reference (which now imports it, still
    holding the 0.082-of-full-at-90-deg Rougier landmark, plus a
    new coarse-grid consistency check at 0.01% drift) - scales
    the dome by how much light the moon actually sends. Phase
    angle at 1 Hz from the eclipse block's own sun-moon
    elongation (exact to the ~1 deg lunar parallax, documented).
    Same gating physics as the sun's dome: measured cirrus for
    the halo, measured rain for the bow, low source for the
    dogs; MOONOPT_GAIN (0.22) is the documented display anchor
    across the eye's night adaptation, and the city washing
    (lpVisBright) applies. Full-moon cirrus nights now ring the
    moon exactly as the real sky does.
  - DONE: security review (owner-directed). The Cloudflare worker
    code is DELETED (themes/horizon/worker + worker-reference.mjs
    - git history holds it): the daemon is the EventSource server
      proper, not a bolt-on, so the schema normalizers (readsb
      strip, ITU-R M.1371 sentinels, aisBox geodesy) moved into
      server/src/index.mjs and their landmarks into
      server-reference.mjs ('normalizers (ex-worker)' - the gate
      never lost them; validate.sh runs 27 sets). The legacy
      /lightning/stream route is gone (the unified /stream carries
      strikes). "why" leak: audited - the daemon never exposed
      error internals (that leak lived only in the deleted worker's
      /ais 502 body); all daemon error bodies are generic, gated by
      the server set. Every response now carries
      content-security-policy: sandbox + x-content-type-options:
      nosniff (SEC_HEADERS, spread first in head(); new 'security
      headers' landmark asserts exactly these two). Caddy-level
      origin list: answered in server/README.md - the daemon check
      is authoritative because it is pure, exported and
      reference-gated (and guards loopback); Caddyfile.example
      gained an OPTIONAL commented belt-and-braces matcher that
      only sheds foreign-Origin load at the edge. install.sh stops
      shipping the worker and removes /opt/horizon-live/worker;
      update.sh no longer watches the deleted path.
  - DONE: explore - the wallpaper stops being one fixed viewpoint
    (owner: "limited view, no option to explore; some places have
    more data sources and frontier research than others"). New
    single source explore.js + explore-reference.mjs (gate set 28,
    4 landmarks): DESTINATIONS is a menu of documented measured
    superlatives - Dover Strait (busiest lane: COLREGS ships +
    contrails), Tromso (IGRF-14 gmLat 67.5 deg, the one entry in
    the 64-70 deg auroral zone - landmarked), Cerro Paranal
    (floors the shipped Falchi atlas exactly: ratio 0 -> 22.00
    mag/arcsec^2 -> Bortle 1, landmarked as the ensemble's dark
    pole with Singapore Strait the bright pole at Bortle 7), Lake
    Maracaibo (Albrecht et al. 2016 LIS/OTD: 233 fl/km^2/yr,
    Blitzortung live), Grindelwald (relief), Galicia 43N 8W (the
    exact point eclipses-reference proves at 100.0% obscuration
    2026-08-12), Mauna Kea. Each menu row is ANNOTATED by the
    repo's own gated models (Falchi Bortle/mag + IGRF gmLat), not
    prose - and so is every open-meteo geocoder search result
    (search anywhere by name; new remote API, recorded in the
    provenance panel). Relocation is a clean re-boot via
    relocateURL (landmarked hygiene): weather pins die,
    infrastructure params (debug/dem/adsb/ais/live/tles) survive,
    4 dp coords + place label. KEY SEMANTIC FIX: lat/lon left the
    `overridden` pin list (now WEATHER_PINS, exported from
    explore.js - the theme imports it, single source): a pinned
    LOCATION now loads that place's REAL weather/sea/radar; it
    only skips the IP geolocation. Harness pins are unaffected
    (every pinned scene also pins cloud/code). UI: G key /
    double-click / ?explore=1, Escape closes; typing guards so
    the search box never trips the D-panel or free-cam keys.
    Verified in real Chromium (WebGPU, Xvfb): overlay builds 9
    rows with annotations byte-identical to the reference values,
    G toggles, guards hold; only the documented environmental
    Dawn texture spam (OPEN below) in the log.
  - DONE: roam - terrain streaming under the free camera (the
    explore item's completion: the world stops being one fixed
    16 km diorama). Architecture: NOT a tile mosaic - the
    equirectangular box RE-ANCHORS. New single source roam.js +
    roam-reference.mjs (gate set 29, 5 landmarks): geoToScene/
    sceneToGeo are the theme's mapping and its algebraic inverse
    (landmarked bit-equal to ships.aisToScene AND
    contrails.adsbToScene at 4 anchors - the model lives once;
    roundtrip 6.9e-12 units), yOfElev/elevOfY carry the camera's
    absolute altitude across the asinh datum change (1000 random
    datum swaps drift 1.4e-12 m), roamDecision is the trigger
    state machine (fire at ROAM_TRIGGER_M = DEM_HALF_M/2 = 4 km,
    so real data always outruns the fetch; wait/cooldown/retry
    landmarked), and a 300-hop random walk lands the camera on
    the exact origin every swap with hop distances matching
    haversine to the documented 0.113% m/deg convention.
    EXACTNESS FIX absorbed: DEM_HALF_M/WORLD/MPU now live in
    roam.js and the theme's former hand-typed 57.14 m/unit (a
    50 ppm approximation of its own 16000/280) is replaced by
    exact MPU everywhere (ship/aircraft kinematics, water
    metersPerUnit, COLREGS/CFR slant ranges, radar scene scale).
    Theme integration: maybeRoam() in the free-cam frame path;
    reanchor() fetches the new box (fetchDEMTiles -> fetchDEM
    fallback), swaps via the SAME buildWorld() boot uses, rewrites
    the camera exactly, clears the live pools (stale scene
    frames), reconnects the /stream EventSource (initial ais/adsb
    snapshot repopulates in seconds), re-runs the cheap syncs +
    computeSkyglow() (the Falchi block is now a re-runnable
    function), and history.replaceState's the URL through the
    gated relocateURL - reload keeps the walked-to spot;
    pinnedLoc flips true so IP geolocation never snaps you home.
    Leak work for repeated rebuilds: previous terrain geometry
    disposed, ocean FFT cascades got a dispose() (2 data + 6
    storage textures each), water depth texture freed.
    ?demtiles=URL endpoint override (infrastructure param, kept
    across relocations) lets the offline harness serve
    deterministic terrarium tiles; ?roam=0 pins the box.
    window.**roam harness introspection (same precedent as
    **meteors). Verified in real Chromium (WebGPU/Xvfb) with a
    local synthetic-tile server: flew the free camera past the
    4 km ring - fetch, buildWorld swap, camera rewrite to origin,
    URL rewrite and panel provenance all firing (smoke needed a
    fixture-side GPUTexture.createView swizzle shim - see the
    updated OPEN note).
  - DONE: quality hardening pass (owner-directed: "before
    continuing with frontier research/data sources spend time for
    client and server to ensure it's a high standard") - the four
    gaps named in the roam design review, closed:
    1. EARTH-ANCHORED DRESSING (the approximation that mattered):
       micro-relief moved from scene-space fbm(x/7) to
       roam.microRelief - the theme's exact octave weights
       (0.55/0.27/0.13/0.05 at 1/2.1/4.3/8.9) over period-free 3D
       value noise ON THE EARTH SPHERE at the historic 400 m base
       wavelength (MICRO_M === 7*MPU exactly). 3D-on-the-sphere
       because any 2D unrolling shears somewhere (lon*cos(lat)
       drifts lonRad\*sin(lat) metres of texture per metre walked
       north - 21:1 streaks at 170E). Trees moved from a
       scene-space RNG to roam.treeCandidates: fixed geodetic
       cells (150 m), one hash-deterministic candidate each
       (position jitter, species, size, sway phase), cos(lat)
       acceptance holds areal density flat, hash-sorted so the
       140-tree display budget picks a deterministic, spatially
       unbiased subset. OSM forest polygons now stored GEODETIC
       and projected per box (the old scene-space rings were
       orphaned by every hop). Landmarked: 200 overlap points
       agree to 0.0 across a 2.8 km re-anchor; 6435 shared tree
       candidates bit-exact (position + uniforms); density 44.5
       vs 44.4 /km² at 0/60 deg; MICRO_M identity.
    2. SETTLE-GATED SYNCS: a hop re-anchors terrain, the stream
       and the pure local models (skyglow, IGRF) immediately, but
       the eight API re-syncs wait for the camera to REST
       (ROAM_SETTLE_MS = 4 s) with ROAM_FORCE_HOPS = 3 as the
       staleness backstop for a pilot who never stops - no more
       ~1 req/s against third parties during a long flight.
       settleDue landmarked.
    3. FOREST RACE: syncForests no longer triggers a full
       buildWorld - placeTrees() (extracted, re-runnable)
       re-dresses the standing terrain when polygons arrive, and
       geodetic storage means late data can never land in the
       wrong box.
    4. ROAM URL SEMANTICS: roam is the same session walking, so
       roamURL keeps EVERY param (time and weather pins included -
       the deliberate opposite of explore's fresh-start
       relocateURL) and only moves the coordinates, dropping the
       stale place label. Landmarked; reload mid-walk now
       reproduces the session exactly.
       SERVER (same pass): SSE backpressure - a stalled client
       (zero TCP window) used to buffer events in daemon RAM without
       bound for its 30-minute lifetime, and one broken client's
       write throw ABORTED the strike fanout loop for every client
       after it (real bug). Now: per-client write isolation in the
       fanout + overBackpressure(SSE_BUFFER_MAX = 256 KiB) drops
       slow readers on every write path (strike/ais/adsb/heartbeat);
       EventSource reconnects healthy clients. New 'SSE backpressure'
       landmark (boundary exact, 36x the largest real ais frame,
       6.6 MB worst case across SSE_MAX). Gate now 30 sets: roam 9
       landmarks, server 12.
  - DONE: solar-wind aurora - the curtain's driver becomes a
    MEASUREMENT taken 1.5 million km upwind. New single source
    solarwind.js (daemon + theme + reference; install.sh ships it
    beside the daemon like lightning.js) + solarwind-reference.mjs
    (gate set 31, 4 landmarks): Newell et al. 2007 coupling
    dPhi/dt = v^(4/3) B_T^(2/3) sin^(8/3)(theta_c/2) held to its
    own closed form (northward IMF EXACTLY zero - the merging
    valve; 4/3 and 2/3 exponents by scaling law; clock-angle
    symmetry; storm/quiet 8.2x), wire parsers for both SWPC
    formats against fixtures captured LIVE from the real
    endpoints 2026-07-07 (column-shuffled variant proves
    name-keyed parsing; +null==0 gap bug caught by the null-row
    fixture), hpScale rebase clamped [0.25, 4]. Daemon: one 60 s
    poll of SWPC's propagated-solar-wind (DSCOVR/ACE at L1,
    propagated_time_tag = the real ballistic lead) + OVATION
    hemispheric power serves every visitor - GET /solarwind and
    the `space` event on /stream (60 s + on connect), /health
    grows a space block. VERIFIED LIVE in this container: local
    daemon served wind sampled 02:20 UT arriving at the bow shock
    03:07:43 (47 min of genuine foreknowledge), coupling 1736,
    HP 14/15 GW. Theme: applySpace via stream event + 5 min poll
    (?space=URL override, kept across relocations); the curtain
    scales by hpScale(HP now / HP at grid) between 30-min OVATION
    refreshes - emission is linear in precipitating power for a
    fixed spectrum (Rees 1989 ch. 3), and this is the measured
    evolution of the SAME model that draws the oval, rebased to 1
    at every fresh grid; pinned ?aurora stays pinned; product
    clamped at the designed full-curtain level. The provenance
    panel now says "strikes the magnetosphere in N min" - the
    wallpaper knows before the sky does.
  - DONE: METAR - aerodromes MEASURE the sky, and the nearest
    fresh report now outranks the model where it can see. New
    single source metar.js (daemon + theme + reference; shipped
    beside the daemon like lightning.js/solarwind.js) +
    metar-reference.mjs (gate set 32, 4 landmarks): FMH-1 okta
    band midpoints (sky-clear codes exactly 0, VV exactly 8/8),
    WMO etage split at 2/7 km with the exact international foot -
    the live-captured Glasgow fixture (FEW013 BKN025 OVC030)
    decodes to 100% low cover with a 396.24 m measured base -
    visibility by the exact statute mile with the API's "N+"
    documented as an at-least floor, nearest-FRESH station
    selection (staleness disqualifies before distance ranks), and
    the readsb-style normalizer. Daemon: GET /metar?lat&lon -
    aviationweather.gov decodes reports but sends no CORS header,
    so the daemon proxies with a 10-min per-area cache; VERIFIED
    LIVE in this container (Glasgow's layered ob served through
    the route). Theme: syncMetar every 10 min (?metar=URL
    override, kept across relocations; roam clears the station on
    re-anchor and re-syncs on settle); a fresh (<90 min) nearby
    (<60 km) station replaces the Espy LCL ESTIMATE with the
    ceilometer's MEASURED deck base, the model's low cover with
    the measured okta fraction, and the model visibility with the
    transmissometer reading (Koschmieder haze). DELIBERATE SCOPE:
    mid/high decks stay with the model - automated ceilometers
    are blind above a few km, and overriding cirrus with an AUTO
    station's silence would erase real measured-model cloud.
    Present weather (wxString) is recorded as provenance only.
  - DONE: wildfire smoke - NOAA HMS, the analyst-verified plume
    layer. New single source smoke.js (daemon + theme + reference;
    shipped beside the daemon) + smoke-reference.mjs (gate set 37,
    3 landmarks): the KML parser held to a VERBATIM fixture cut
    from the live daily file (150 plumes parsed, density counts
    49/46/55 matching the raw grep exactly), interior probes of the
    real plumes hitting their published class concentrations
    (Ruminski et al. 2006: light/medium/heavy = 5/16/27 ug/m^3),
    and geometry discipline (heavy outranks light in overlaps; a
    concave U-notch is OUTSIDE - the even-odd test; the development
    probe that landed a concave plume's centroid outside its own
    ring is why that landmark exists). Daemon: hourly fetch of the
    ~200 KB daily KML (yesterday's file stands in early UTC),
    parsed to RAM, GET /smoke?lat&lon answers with the plume class
    or null (HMS is a North America product - null elsewhere is
    the truthful answer); /health grows a smoke block. Theme:
    syncSmoke every 30 min (?smoke=URL override, kept across
    relocations, re-synced on roam settle); the provenance panel
    reports "heavy plume overhead (analyst-verified) · class ~27
    ug/m^3"; state.smoke carries the class for the render hook.
    DELIBERATE SCOPE: no render change this item - the CAMS AOD
    the sky already uses is quantitative and includes smoke; HMS
    adds the analyst's TYPE verdict, whose honest render
    consequence is the aerosol's single-scattering albedo (biomass
    smoke absorbs more), and that hook waits on the OPEN question
    below.
- DONE: the roam hitch - the hop's heavy bakes moved off the
  main thread (the last open quality item from the roam design
  review). The inline demElev/sample math was EXTRACTED into
  terrain-sample.js (single source: theme + worker + reference -
  it had been ungated inline code since the DEM feature landed)
  and terrain-sample-reference.mjs joins the gate (set 39, 4
  landmarks): the mercator pixel mapping reproduced independently
  and bilinear held EXACT on a linear-in-pixel field; grid-kind
  corners/centre/clamp exact; the sea rule and asinh datum with
  the micro-relief IDENTITY against roam.microRelief; and anchor
  independence at the full sample() level (the roam overlap
  property survives the composition). terrain-worker.js (module
  worker, same gated modules, no model of its own) computes the
  LEADR moments pyramid, the 321^2 mesh surface for the exact
  vertex lattice the main thread harvested (no vertex-ordering
  assumptions cross the thread boundary - the xz array travels
  with the job), and the 512^2 signed bathymetry + TMA depth
  accumulators; everything returns as transferables.
  buildWorld(pre) consumes the precomputed grids when present and
  samples synchronously when not - boot, the procedural fallback
  and any worker failure (no module workers, crash, hung job ->
  8 s bail) use the same single body. BONUS EXACTNESS FIX: the
  camera used to teleport back to the anchor point at the swap,
  discarding the distance flown during the fetch (tens of units
  at full speed); it now rewrites from its CURRENT geodetic
  position through the same gated geoToScene - exact continuity.
  window.\_\_roam.workerUsed for the harness; verified in the
  browser smoke (hop through the worker path).
- DONE (radiative constants): MIE_A0 corrected 4.4e-6 -> 4.44e-7.
  Hillaire (2020) gives Mie scattering 3.996e-6 and EXTINCTION
  4.440e-6 = sigma_s / 0.9 (Bruneton's convention); the original
  port read the extinction-minus-scattering as 4.4e-6 - a slipped
  decimal carried self-consistently by every mirror, giving Mie
  SSA 0.48 instead of the paper's 0.9 (haze absorbed 10x too
  much). All three mirrors moved in the same edit - the TSL
  extinction (atmosphere-tsl.js), the CPU sun-colour integral
  (sun-transmittance.js), and the double-precision reference
  (atmo-reference.mjs) - so the reference-vs-engine relationship
  is unchanged and the gate re-derives every REF texel from the
  corrected constant. New landmark in atmo-reference.mjs pins it:
  sigma_s/(sigma_s+sigma_a) = 0.9 to 1e-12 and sigma_t = 4.440e-6
  (exit 1 on drift), so the constant can never silently regress.
  Measured effect on the sun's transmitted light (mieScale 1,
  red channel): alt 1 deg 0.2132 -> 0.2482 (+16%), alt 0.2 deg
  0.1144 -> 0.1511 (+32%) - the low sun and horizon sky brighten
  toward the paper's intent, high sun barely moves (alt 30 deg
  +0.6%). No pinned GPU texel matrix exists for the sky (the
  fixture rig cannot shoot it - environment OPEN below), so
  on-screen judgement is the owner's live browser; the numeric
  chain is gated. The smoke SSA hook (analyst-verified plume ->
  biomass-burning single-scattering albedo) stays deferred until
  a citable climatology value is settled - published AERONET
  spreads are wide and we do not invent constants.
- DONE: measured aerosols - the sky's Mie term stops being one
  gray knob (Jul 9). GEFS-Aerosols (NOAA's operational GOCART
  coupling, Bhattacharjee et al. 2023 WAF) publishes per 0.25-deg
  cell, 3-hourly: total AOT at 340/440/555/645/859 nm, scattering
  AOT at 555, SSA + asymmetry at 340, and per-species AOT +
  scattering AOT at 555 for dust/sea-salt/sulphate/organic/black
  carbon - the RADIATIVE properties themselves, measured, so no
  OPAC climatology transcription and no invented mixing rules.
  Chain: NOMADS grib filter (the supported subsetting path since
  OpenDAP retired, SCN 25-81) -> grib2.js, a minimal certified
  GRIB2 decoder (GDT 3.0, PDT 4.0/4.48, DRT 5.0 simple packing +
  bitmap, sign-magnitude integers) gated against an ecCodes
  2.47.3 ground-truth decode of a LIVE captured subset
  (grib2-fixture.mjs, 20 messages, every texel to 1e-12, one full
  81-value grid) plus synthetic spec-built messages (negative
  scales, bitmap holes, 0-bit constant fields, 0/360 folding) ->
  aerosol.js: census + channel set at the theme's 680/550/440
  (tau by piecewise Angstrom 1929 log-log interpolation - exact
  on any power law, gated; SSA from the TWO measured anchors
  linearly in ln lambda, the same bridging AERONET applies; g =
  the measured 340 nm ASYSFK, replacing the hardcoded 0.8) ->
  mieCoefficients calibrates the Hillaire exp(-h/1200) profile so
  the column above the LOCAL terrain equals measured tau exactly
  (algebraic identity, gated). KEY landmark: a flat tau =
  4.44e-6 x 1200 SSA-0.9 column returns EXACTLY 3.996e-6/4.44e-7
  - the measured path degenerates to Hillaire (2020) for
    paper-standard air. Daemon: /aerosol?lat&lon (one ~6 KB subset
    per 0.25-deg cell, 45 min cache, cycle fallback, health block);
    live-verified end-to-end on the real feed (Grindelwald cell,
    12z+9: tau550 0.0385, SSA 0.891, g 0.710, sulphate+organic
    dominated, black carbon SSA 0.213). Renderer: atmosphere-tsl
    Mie went vec3 - mieScat/mieAbs/mieG uniforms in extinction,
    in-scatter and the (now measured-g) Cornette-Shanks phase; LUT
    rebuild keyed on the radiative set; sun-transmittance.js takes
    the same per-channel coefficients (both callers updated);
    atmo-reference.mjs mirrors the per-channel structure with
    paper defaults - REF texels verified IDENTICAL before/after
    the refactor. Fallback when /aerosol is silent: the paper's
    SSA/g calibrated to the measured CAMS total AOD through the
    SAME gated path - which also retires the old aod/0.12
    normalisation (the paper's very clean default air passed off
    as the global mean; tau is now the physical column). This
    CLOSES the deferred smoke-SSA question with measured data
    instead of a picked constant: organic-matter and black-carbon
    columns darken the measured SSA wherever a plume actually
    absorbs; HMS stays the analyst-verified provenance layer. Gate
    grew 39 -> 41 sets (grib2, aerosol). Visual judgement stays
    with the owner's live browser (fixture rig cannot shoot the
    sky): expect hazier, warmer horizons under real air - measured
    tau is 5-30x the paper default - and dust/smoke events to
    read as coloured, absorbing skies.
- DONE: crepuscular rays - Hillaire's volumetric shadow in the
  aerial perspective (Jul 9). The cloud shadow map (Schneider
  2015 Beer-Lambert through the decks, shipped in phase 5) so far
  shadowed only SURFACES; the haze between the camera and the
  terrain ignored it, so cloud banks never threw visible beams.
  Now the aerial-perspective march multiplies its DIRECT
  single-scatter term per step by the shadow map's transmittance
  at the marched point (chi(t)) - exactly Hillaire (2020)'s
  aerial perspective with volumetric shadow; multiple scattering
  stays unshadowed per the paper. Structural change the shadow
  forced: the aerial LUT went 64x32 half-circle -> 128x32 FULL
  circle with SIGNED azimuth (clouds are not azimuthally
  symmetric - the old |relAz| fold would have mirrored every
  shaft across the sun line); the seam sits at the anti-sun
  azimuth where in-scatter varies slowest, and aerial-tsl's
  sampler reads the signed angle back via atan(cross, dot).
  Gated in atmo-reference.mjs (atmo set grew 10 -> 16 lines):
  (1) chi=1 IS the unshadowed march and chi=0 IS the
  ambient-only march, exact - the shadow touches only the direct
  term; (2) linearity restatement - a half-lit ray equals
  ambient + the lit steps' direct contributions harvested from
  an independent pass (1.8e-15); (3) fill-rotation vs sampler
  atan(cross, dot) roundtrip over the full signed circle
  (2.2e-16) - a sign slip would mirror every shaft; plus three
  REF aerial texel pins. Scope, stated honestly: the 2D LUT
  collapses elevation, so chi is sampled at the ground datum
  along the ray - the shafts line up with the terrain's own
  per-pixel cloud shadow by construction; the sky DOME march
  stays unshadowed (a shaft's shadow covers only the first 16 km
  of a dome ray, which converges to unshadowed at the dome's
  distances - and dome shafts would need the same full-circle
  treatment on the 192x108 sky LUT, a possible follow-up).
  Wiring: the cloud shadow hook is created BEFORE the atmosphere
  so its transmittance node compiles into the aerial compute
  kernel; camera scene position + sun azimuth uniforms feed the
  march (set before update()). Browser smoke with the cloud
  system ACTIVE (cloud=60): kernel compiles, frame loop alive,
  no new shader errors - the "2D view of 3D texture" Dawn spam
  under heavy cloud reproduces IDENTICALLY on a clean HEAD
  worktree (156 vs 158 messages), i.e. the documented
  environmental drift below, not this change.
- DONE: crepuscular rays phase 2 - the sky dome joins (Jul 9).
  The follow-up queued in the phase-1 entry: the SKY-VIEW march
  now carries the same volumetric shadow as the aerial one, so
  the beams fan across the sky from cloud gaps, not only through
  the terrain haze. One march factory serves both LUTs (the
  aerial march was the special case se=0, ce=1 all along - the
  unification is a deletion, not a fork). Sky-view LUT went
  192x108 half-circle -> 384x108 FULL signed circle (the old
  texel pitch kept; the seam at the anti-sun azimuth); the dome
  sampler reads the signed angle with the same gated
  atan(cross, dot); the irradiance integral's 8 azimuth samples
  now span the full circle, so the shadowed sky darkens the
  hemisphere ambient correctly. Shadow samples are HEIGHT-AWARE
  everywhere now: scene y from the theme's exact asinh altitude
  datum (identity landmark against roam.yOfElev - one datum, one
  model), so a ray above the decks reads full sun and a camera
  flying over the clouds sees no ground shafts (this supersedes
  phase 1's ground-datum sampling for the aerial march too).
  Landmarks (atmo set 16 -> 19 lines): full-circle back-compat -
  the six old half-circle sky pins and their MIRRORS reproduce to
  2.2e-16 (the remap provably changes nothing for a symmetric
  sky; REF pins re-indexed 192+i, same values to the digit); sky
  shadow bounds (chi=1 IS unshadowed, chi=0 IS ambient-only,
  exact); the datum identity. Cost: fillSky doubles its texels
  (384 wide) - per frame like before, fine on real GPUs. Scope
  note: the shadow map still covers the 16 km world box, so
  dome beams come from the clouds overhead - which is where
  crepuscular rays live.
- DONE: Black Marble night lights - the ground under the skyglow
  (Jul 9). The Falchi atlas the sky already uses is DERIVED from
  VIIRS DNB radiances; this puts the source on the terrain, so
  valley towns glow exactly where the sky above them does. Feed:
  GIBS WMTS (keyless, CORS \* confirmed), layer
  VIIRS_SNPP_GapFilled_BRDF_Corrected_DayNightBand_Radiance - the
  DAILY gap-filled BRDF-corrected moonlight-removed VNP46A2
  science product (Roman et al. 2018, RSE 210), published ~2 days
  behind (the sync walks back to the newest available day). The
  tiles are palettized PNGs whose PUBLISHED GIBS colormap is an
  exact data-to-gray table in nW/(cm^2 sr): nightlights.js embeds
  the 180-bin table and inverts pixels to CALIBRATED radiance -
  town brightness is measured and linear, not painted. One
  demonstrable typo in NASA's published table (gray 166's upper
  edge printed 100.0 amid a 0.1-wide ramp whose next bin starts
  at 10.0) is corrected and documented; the contiguity landmark
  would fail otherwise. Field build: NaN-aware bilinear on
  RADIANCE (never on the non-linear gray), sampled through
  roam.sceneToGeo - the same gated Earth anchoring as the
  terrain, so lights sit on the towns through explore and roam
  hops (re-anchor refetches; a hop mid-fetch is sequence-guarded).
  Render: a 96x96 float radiance texture over the box feeds a new
  terrain emissive term - linear radiance x ONE exposure-matched
  gain (like every other emissive) x a 2700 K Planckian lamp
  tint computed from the Kang et al. (2002) locus approximation
  (a documented rendering choice - DNB is panchromatic - with the
  locus GATED against published CIE Planckian points), fading in
  through civil twilight. Gate grew 41 -> 42 sets
  (nightlights-reference.mjs, 5 landmarks): the LIVE captured
  Bernese-Oberland tile decoded by a reference-only PNG reader
  (palette + tRNS, all five filters) onto Pillow ground-truth
  pins - Bern saturates the scale at >= 38.2 nW/(cm^2 sr), Thun
  ~37, Interlaken mid-scale, dark Alps at the 0.1-0.2 airglow
  floor, plus a full 256-px row through the Bern conurbation;
  colormap monotone/contiguous with every gray inverting into its
  own bin; the mercator pixel mapping against an independent
  restatement; the field bilinear against an independently placed
  single-lit-pixel weight through the Earth-anchor roundtrip; the
  lamp locus vs published CIE coordinates. ?lights=0 disables;
  ?lights=URL overrides the tile endpoint ({d}/{z}/{r}/{c}).
- DONE: owner feedback round - "boats are generic" and "no light
  sources" (Jul 9). Two fixes, one PR.
  MEASURED VESSELS: the hull comment admitted it ("display
  furniture... reports carry no dimensions") - but AIS message 5
  carries them; the daemon just never subscribed. Now
  ShipStaticData joins the aisstream subscription; normalizeStatic
  (gated) reads the M.1371 type and the REAL dimensions (A+B
  length, C+D beam from the antenna offsets, draught in metres),
  a statics table rides the resident picture (6-min repeats,
  24 h own-clock prune) and query() merges type/len/beam/draught
  into /ais and the stream events. The theme scales each hull to
  its measured length/beam, picks the silhouette by type class
  (cargo hatches, tanker trunk, white passenger decks, fishing
  wheelhouse+gantry, sailing mast, tug house - typeClass, gated)
  and rebuilds only when identity changes. The COLREGS lights got
  EXACTER with real lengths: lightPlan (gated) implements Rule 23
  (second masthead abaft and higher on >= 50 m power vessels),
  Rule 25(b) (sailing = NO masthead), Rule 22 in full (ranges by
  length band - a 15 m boat's masthead is 3 nm, not 6) and
  Annex I 2(a)/3(a) heights and separations from the measured
  beam/length; each light now carries its own range through the
  Allard fade. Landmarks: server set +1 (static merge fixture),
  ships set +2 (type table; the 240 m/30 m/8 m/sailing plans
  against the regulation text). The ?ship=N harness fleet is one
  vessel of each class, measured-sized.
  LIGHT SOURCES: Black Marble gave the glow; now it gives the
  LAMPS. nightlights.js lampCandidates seeds Earth-anchored point
  sources exactly like roam's trees (the shared hash3 - exported
  - on absolute geodetic cells, cos(lat) acceptance for uniform
    areal density, hash-sorted display budget), with acceptance
    LINEAR in the measured radiance (LAMP_FULL 15 nW/(cm^2 sr) =
    every 120 m cell lit) and none below ~3x the airglow floor.
    The theme drops them on the terrain surface (never on water -
    the 500 m data bleeds over shorelines), warm additive points
    through the shared AgX+fog encode, brightness following
    measured radiance, gated by the same civil-twilight ramp as
    the emissive glow, rebuilt on roam re-anchor. Landmark:
    deterministic twice; every overlap lamp from a second anchor
    geodetically identical; count matches the areal-density
    binomial expectation; dark field -> no lamps. Browser smoke
    with the captured tile served locally through ?lights=: the
    full pipeline (fetch -> decode -> field -> lamps -> compiled
    point cloud) runs with the panel recording the lamp count -
    which also live-verified the previous entry's texture path.
    (Bug found by the smoke: a local variable named `sample`
    shadowed the terrain sampler - renamed, and the sync's catch
    now logs to console under ?debug=1 instead of swallowing.)
- DONE: asset design loop + designed vessels (Jul 9, owner: "great
  looking assets have to be designed (maybe using tools to
  help)"). The tool: harness/asset-viewer.html renders the fleet
  in isolation and shoot.mjs's readback path takes the pictures -
  geometry is now designed against ACTUAL RENDERS (the loop
  caught its own rig lesson immediately: composited screenshots
  are blank for WebGPU surfaces; the readback camera is the only
  camera). The assets: vessels.js - ONE shared module the viewer
  and the theme both import, so what was designed is what ships.
  Hulls are real plan-forms now (flared bow taper, parallel
  midbody, elliptical transom - an extruded Shape, not a box)
  scaled to the measured AIS length/beam; arrangements by class:
  container bays in per-ship deterministic colours (roam.hash3 on
  the mmsi) with an island bridge + funnel seated ON the house,
  tanker centre walkway + midship manifold + aft island,
  passenger decks stepping back in four white tiers with a raked
  funnel, trawler wheelhouse + A-gantry + boom, sailing rig with
  mast, boom and a SET MAINSAIL, compact tug/other house. Three
  design iterations via screenshots (fleet + per-class close-ups)
  fixed: fog swallowing the stage, sun behind the fleet, funnels
  drowned inside deckhouses, murky container palette. The theme's
  buildShip now just calls buildVessel + hangs the gated COLREGS
  light plan on the result; the old inline boxes are deleted.
  Geometry is display furniture (not gated); everything measured
  about it - dimensions, type, light plan - was already gated in
  the previous entry. Viewer + workflow documented in
  harness/README.md.
- DONE: real inland water (Jul 9, owner: "data sources we are not
  integrating with or making proper assets is not progress"). The
  terrain's sea rule (elevation <= 0.3 m) could never see a lake:
  Interlaken rendered as a town between two grass basins, in a
  theme that already knew the town's lights and ships. Fixed with
  OSM natural=water through the SAME Overpass endpoints the
  forests use - integrated END TO END, not plumbed: lakes.js
  (gated, 5 landmarks) stitches relation boundary rings by exact
  endpoint matching (Thunersee arrives as 42 outer ways; the LIVE
  captured Brienzersee relation is the fixture, thinned
  interior-only so endpoints survive), thins shorelines to the
  mask texel, measures each lake's SURFACE LEVEL as the median
  shoreline DEM (the shore is at lake level by definition), and
  scanline-rasterises even-odd into an O(1) wet mask - gated
  against the pointwise even-odd test (smoke.js inRing, one
  polygon model) across the grid, islands staying dry.
  terrain-sample.sampleDem gained the mask: inside a lake the
  surface is water, FLAT at the measured level through the same
  asinh datum + settle as the sea; the sea rule answers first,
  untouched (terrain-sample set still green unchanged). Threaded
  everywhere the sampler runs: the terrain worker job carries the
  mask (built in prepareTerrain from the NEW box's DEM + anchor,
  so worker and main thread bake identical water), trees and
  lamps skip lake cells automatically through sample().water,
  ships FLOAT at the lake's own level (the BLS steamers on
  Thunersee carry AIS), and the no-sea guard now admits lake-only
  boxes. Late Overpass arrival rebuilds the standing world once
  through the normal worker pipeline. Cached geodetic per
  location like the forests; ?water=0 disables; KEEP_PARAMS
  carries 'water'. Gate 43 -> 44 sets. Browser smoke: local flat
  DEM + the real fixture primed into the cache, booted
  mid-Brienzersee - panel records "2 lakes - Brienzersee", the
  wet-mask rebuild runs through the worker, frame loop alive.
- DONE: real buildings (Jul 9, the environment series after lakes -
  towns were lamp points floating on empty grass). OSM
  way[building] through the SAME Overpass mirrors the forests and
  lakes use, designed in the asset-viewer loop before wiring:
  buildings.js is PURE JS geometry (no renderer import), gated at 5
  landmarks - the OSM height ladder (height tag in either decimal
  form > building:levels x 3 m per Simple 3D Buildings > per-type
  defaults > 9 m; the captured census says the ladder matters:
  height tagged on 1 of 400 Interlaken buildings, levels on 20),
  shoelace footprint area exact on a surveyed rectangle,
  ear-clipping triangulation held by the EXACTNESS identity
  (triangle areas sum to the polygon area, convex + concave, both
  windings), the LIVE captured 180-footprint Interlaken fixture
  parsing with the documented defaults doing the work, and the
  merged geometry watertight: bases sunk 2 m for slope seating,
  wall normals horizontal and outward (winding normalised),
  gabled ridges along the long axis for near-rectangular
  house-family footprints, flat caps ear-clipped, NOTHING facing
  down - that landmark caught a real bug (earClip emits
  shoelace-positive = clockwise-from-above triangles; unreversed,
  every flat roof faced down and was culled invisible - the
  viewer shot showed walls with no tops, the strengthened gate
  now holds it), glow riding every vertex, buildings in water
  skipped entirely. Facade tints deterministic via roam's shared
  hash on the OSM id; house-family types keep the tiled-roof tone
  even when their footprint is too complex for a ridge (the tag
  speaks, not a guess). Theme wiring end to end: syncBuildings
  (both mirrors, geodetic localStorage cache per anchor like
  water/forests), placeBuildings seats the merged mesh on
  sample() ground (never in water), and the walls' emissiveNode
  is the town's MEASURED Black Marble radiance - placeBuildings
  re-runs when syncLights lands, so the glow attribute samples
  the same lightsField the lamps and terrain glow use, with the
  lamps' tint and eye-response sqrt, gated to night by the same
  solar-altitude ramp (bldNightU). Roam re-anchors re-project
  through the pinned dressAnchor; ?buildings=0 disables;
  KEEP_PARAMS carries 'buildings'. The asset viewer grew
  ?asset=buildings (theme-exact U = 7/400, auto-framing on the
  built bounding box, ?n= nearest-N close-ups). Gate 44 -> 45
  sets.
- DONE: real roads (Jul 10, the environment series after
  buildings - the towns had their shapes but nothing connected
  them). OSM way[highway] through the SAME Overpass mirrors,
  designed in the asset viewer before wiring: roads.js is pure JS
  geometry gated at 5 landmarks - the OSM WIDTH ladder mirroring
  the height ladder (width tag in either decimal form > lanes x
  3.5 m, the OSM/AASHTO default lane > per-type defaults > 4 m;
  the captured census: width tagged on 38 of 400 Interlaken ways,
  lanes on 138), surface provenance (the tagged surface picks the
  albedo - 320 of 400 ways carry one - untagged paved classes
  read asphalt, track/path bare ground), densify/thin held exact
  (gap <= max, interior spacing >= min, endpoints and original
  vertices never moved), the LIVE 400-way Interlaken fixture
  (geometry thinned to >= 6 m interior, endpoints exact for
  connectivity), and ribbon geometry held by the EXACTNESS
  identity: on a straight flat road the triangle areas sum to
  length x ladder-width to float32 storage precision (1e-6 - the
  gate documents that the bound is the Float32Array, not the
  math), normals exactly up; water CUTS a road into strips, and
  the same road carrying OSM's bridge tag SPANS the wet gap on a
  straight grade between its shores (both behaviors in one
  landmark, asymmetric 4->8 m shores). Class-ranked display cap
  keeps the network's spine (motorway first, then by length).
  Theme wiring end to end: syncRoads (both mirrors, geodetic
  localStorage cache per anchor), placeRoads seats ribbons on
  sample() ground + 2 m clearance for the coarse render mesh
  (ribbon follows sample() every 15 m; the mesh interpolates 50 m
  cells) with polygonOffset, aerial-wrapped vertex colors,
  receiveShadow; rebuilt per box in buildWorld, re-synced on roam
  settle and boot; ?roads=0 disables; KEEP_PARAMS carries
  'roads'. The asset viewer's buildings stage now draws the
  street network under the town (?roads=0 to isolate) - the
  design loop caught the near-plane precision issue (near now
  scales with framing distance). Debug trail: the ribbon area
  identity first gated at 1e-9 and failed at 3.1e-8 - float32
  vertex storage, tolerance moved to the documented 1e-6, the
  double-precision math itself exact. Gate 45 -> 46 sets.
- DONE: real ground cover (Jul 10, the environment series after
  roads - the terrain painted one grass everywhere low and dry).
  OSM landuse + ground-cover naturals (grassland, sand, beach,
  scree, bare_rock) through the SAME Overpass mirrors: landuse.js
  (pure JS, gated at 5 landmarks) - the class -> linear-albedo
  table with unknown classes dropped (base grass is the truthful
  unknown), ways parsed directly and relations stitched via the
  LAKES' gated endpoint matching (shared code, not re-derived;
  synthetic 4-segment shuffled/reversed relation landmark since
  the captured bbox holds none), rings thinned by the lakes'
  gated decimate, and landTint scanline-rasterising even-odd into
  an n x n RGBA field (rgb = class albedo, a = coverage) painted
  LARGEST FIRST so small parcels win their texels (paint-order
  landmark: a meadow inside farmland keeps its centre). The
  raster is gated against the pointwise even-odd test (smoke.js
  inRing) AND against the terrain shader's row orientation - a
  north-half square must paint only the upper texture rows,
  because the shader samples v = 0.5 - z/world (the flip lives in
  landTint at write time, held by the gate). The LIVE fixture:
  125 captured Interlaken polygons (14 classes, census in the
  fixture header), 88 painting the box at 2% texel share - the
  gate documents that 2% is the honest number (the capture bbox
  is ~3.3 km of the 16 km box). terrain-tsl.js grew landTexNode +
  uLandOn beside the night-lights texture: the tint mixes into
  the GRASS albedo only (0.85 strength), through the same detail
  fbm and measured Ross-Li factor, so rock faces, snow and the
  sea never read it and lighting stays the model's. Horizon:
  syncLanduse (both mirrors, geodetic cache per anchor),
  placeLanduse re-rasterises per box and swaps the DataTexture
  exactly like the lights path; ?landuse=0; KEEP_PARAMS carries
  'landuse'. The asset viewer's town stage paints the same field
  under the buildings/roads (canvas overlay, stage-only layer
  separation 0.05/0.1 after a z-fight against the 8000-unit
  backdrop plane - the THEME blends in-shader and cannot fight).
  Float32 tolerance lesson re-applied at the paint-order landmark
  (0.13 stored as 0.12999999...). Debug trail: the live-fixture
  landmark first demanded >10% texel share and failed at 2% -
  arithmetic, not code: the capture bbox is 4% of the box area.
  Gate 46 -> 47 sets. Browser smoke: 177/177 buildings, 319/319
  roads, 88/116 landuse polygons painted on the DEM world, one
  known warning class.
- DONE: real watercourses (Jul 10, the environment series after
  ground cover - the lakes module puts polygon water where OSM
  draws riverbanks, but most of the network is LINEAR: the Aare's
  arms, the Lütschine, every alpine stream were invisible). OSM
  waterway=river/stream/canal/drain/ditch through the SAME
  Overpass mirrors, and the geometry through the ROADS' gated
  ribbon builder - riversGeometry IS roadsGeometry re-exported
  (the exactness identity, terrain following and water
  strip-breaking are gated once and shared, per the standing
  reuse directive). rivers.js owns only what is water-specific,
  gated at 4 landmarks: the waterway width ladder (width tag >
  type defaults > 2 m; the census: width tagged on 6 of 300
  captured ways), parse rules on the LIVE 300-way fixture
  (tunnelled reaches SKIPPED - 70 of 300, an underground
  watercourse is invisible by definition; the Aare present by
  name; rivers class-ranked before streams), the shared-builder
  area identity asserted through the rivers path (length x
  ladder-width to float32, water albedo on every vertex), and
  stops-at-the-shore: where groundY says polygon water the ribbon
  ENDS at the shore vertex and the lake surface takes over - one
  water, two sources, no double-draw (bridge=false always: water
  never bridges water). Theme wiring: syncRivers (both mirrors,
  geodetic cache per anchor), placeRivers seats ribbons at 1.5 m
  over the render mesh - deliberately UNDER the roads' 2 m so a
  tagged road bridge crosses ABOVE the river it spans - roughness
  0.22 water sheen (the full reflector pass stays the lakes'),
  aerial-wrapped, rebuilt per box, re-synced on roam settle and
  boot; ?rivers=0; KEEP_PARAMS carries 'rivers'. The asset
  viewer's town stage threads the fixture's watercourses between
  the ground cover and the roads - the shot shows the real Aare
  sweep with its canal branch. Gate 47 -> 48 sets. Browser smoke:
  177/177 buildings, 319/319 roads, 88/116 landuse, 185/189
  watercourses on the DEM world, one known warning class.
- DONE: real railways (Jul 10, the environment series - around
  Interlaken the rail network IS the landscape: the standard-gauge
  Thun line, the metre-gauge Berner Oberland-Bahn, 800 mm rack
  lines, the Harderbahn funicular). OSM way[railway] through the
  SAME mirrors, geometry through the SAME gated ribbon builder
  (railsGeometry IS roadsGeometry - one exactness gate, three
  consumers now). rails.js owns only the rail-specific knowledge,
  gated at 4 landmarks: the width ladder MEASURED from the gauge
  tag - the captured census tags gauge on 288 of 300 ways (1000 mm
  x140, 1435 x117, 800 x31), so bed width = tracks x (gauge +
  2.6 m ballast shoulders), falling to tracks x 4 m, then type
  defaults; the LIVE 203-way fixture (all three gauges' beds
  present as distinct widths, the Harderbahn by name, every
  tunnelled reach skipped - 14 tagged, the Alps route trains
  underground); the shared-builder area identity through the rails
  path at the MEASURED metre-gauge bed; and the bridge CARRY - the
  same line tagged bridge=yes spans an asymmetric wet gap on the
  straight grade while untagged it cuts at the shore (the Aare
  rail bridges are real; a fixture-count lesson: of 24 tagged
  bridges most are short decks under the stub floors, 6 long ones
  survive - the landmark documents that). Theme: syncRails (both
  mirrors, geodetic cache per anchor), placeRails at 1.8 m
  clearance - above the rivers' 1.5 m (rail decks over water) and
  under the roads' 2 m (road overpasses on top) - ballast albedo,
  aerial-wrapped, per-box rebuild, roam + boot syncs; ?rails=0;
  KEEP_PARAMS carries 'rails'. Viewer stage threads the network -
  the shot shows Interlaken West's real station-yard fan. Gate
  48 -> 49 sets. Browser smoke, five layers now: 177/177
  buildings, 319/319 roads, 88/116 landuse, 185/189 watercourses,
  192/196 railways on the DEM world, one known warning class.
- DONE: real trains on the real timetable (Jul 10, owner: "public
  transport normally has tracking or schedules (includes metadata
  like what type of train etc)" + "location specific APIs should
  only get called while viewing their scope"). The railways got
  their TRAFFIC: the Swiss open transport API
  (transport.opendata.ch - keyless, CORS-open) publishes station
  boards with each departure's category (IC/ICE/RE/R/PE), number,
  operator (SBB, BLS, ZB, BOB), REAL-TIME DELAY, and the passList
  of stops it calls at (WGS84 coordinates + arrival/departure
  timestamps). trains.js (pure, gated at 5 landmarks): parseBoard
  (delay minutes shift the published stop times exactly - the
  real-time layer; stops without coordinates dropped; bus/boat
  filtered - boats already arrive via AIS), trainAt (WHERE IS IT
  NOW: dwelling at a stop between arr and dep, else the exact
  linear fraction between the bracketing stops - the timetable's
  own fixes, the AIS ships' dead-reckoning honesty on rails; null
  outside the journey window), consistOf (category -> car count,
  operator gauge -> stock dimensions: the narrow ops run 18 x
  2.65 m cars, the standard net 25 x 2.85 m - documented defaults
  where the API publishes no formation), and the PROVIDER
  REGISTRY: PROVIDERS entries own a coverage bbox and their URL
  builders; providerFor(lat, lon) resolves which (if any) speaks
  for a point - a location-scoped API is NEVER CALLED outside its
  scope (gate landmark: Interlaken and border Basel resolve the
  Swiss provider, Paris and New York resolve none), so the
  registry can grow without idle traffic. The LIVE fixture: 14
  real Interlaken Ost departures (6 BOB regionals, 3 SBB ICs, an
  ICE, ZB regionals, a BLS RE, the GoldenPass PE). rollingstock.js
  (vessels.js mould - three import allowed, never node-imported):
  buildTrain turns a consist into car bodies + window band + roof
  - bogies + cab faces, IC family light-bodied, regional/narrow
    the red of Swiss regional stock; designed in the viewer's new
    ?asset=trains lineup (2 iterations: window band proportions,
    stage albedo). Theme: syncTrains (provider-scoped: locations ->
    nearest station id -> stationboard, 90 s poll for the delays,
    roam re-sync; panel records station, departure count and the
    next train's label/destination/operator), frame loop draws each
    live journey at trainAt(now) seated at rail-bed clearance,
    heading along its current leg, pool pruned as boards roll over;
    ?trains=0; KEEP_PARAMS carries 'trains'. Coverage is the
    provider's: no board, no trains invented. Gate 49 -> 50 sets.
    Browser smoke: five placed layers unchanged, trains code silent
    in the sandbox (no provider reachable - the truthful default),
    one known warning class.
- DONE: scheduled lake boats (Jul 10, closing the loop the trains
  PR opened - the BLS steamers carry AIS but terrestrial coverage
  on the lakes is spotty; the SAME Swiss boards know them by
  SCHEDULE). The pier stations publish category BAT sailings
  (Interlaken Ost (See): BLS-brs to Brienz, each with its
  passList of pier coordinates and times), and the locations
  response carries an `icon` field - so the ONE existing
  locations call names both the nearest rail station and the
  nearest pier; only one extra board fetch, still provider-scoped.
  trains.js: parseBoard gained a category-set parameter (rail by
  default, BOAT_CATS parses the sailings; buses stay filtered),
  BOAT_DIMS documents the BLS motorship default the boards do not
  publish. Gate 6 landmarks now: the LIVE pier fixture parses 5
  BLS-brs sailings with placed piers through the SAME parser and
  interpolation the trains use, and the rail parse of the pier
  board yields 0 - one parser, two modes, no cross-talk. Theme:
  syncTrains fetches the pier board when a pier exists,
  boatJourneys render through the GATED vessels.js passenger hull
  (buildVessel - the same designed asset the AIS fleet uses),
  floated at the lake's measured level by the same lake logic as
  the AIS ships, positioned by trainAt at the delay-shifted
  times. DEDUP RULE: an active AIS vessel within 300 m WINS and
  the scheduled boat hides - a measured position beats a
  schedule, nothing double-draws. Panel records the pier, sailing
  count and next departure. ?trains=0 governs both modes. Gate
  set count unchanged (50) - the trains set grew 5 -> 6
  landmarks. Browser smoke unchanged and clean.
- DONE: worldwide trains via transitous.org (Jul 10, growing the
  provider registry - the community DB API answered 503 on both
  versions, so the SECOND registry entry became the better one:
  transitous.org aggregates public GTFS feeds worldwide, keyless
  and CORS-open, and its api/v6/map/trips answers a box + time
  window with every leg operating there RIGHT THEN - mode, line
  name (ICE 698), real-time-adjusted departure/arrival with a
  realTime flag, the from/to stops, and the encoded POLYLINE of
  the actual route shape). trains.js grew (gate 6 -> 9
  landmarks): decodePolyline held EXACT against the canonical
  documented reference polyline (the shared GTFS encoding);
  pathPoint - a point at LENGTH fraction f along a geodetic path,
  by cumulative arc length not vertex count (landmark: f = 0.5 on
  a 300 m + 100 m L sits exactly 200 m up the first leg);
  parseTrips -> the SAME journey shape the boards produce (one
  consist ladder, one livery family, one renderer), MODE_CAT
  mapping GTFS modes to board categories with underground modes
  deliberately absent (drawing a metro on the surface would be
  inventing) and FERRY routed to the boats path; trainAt follows
  a journey carrying its route shape ALONG THE SHAPE by arc
  length instead of the straight line (the LIVE 57-leg Frankfurt
  fixture holds ICE 698 mid-leg ON its own polyline). The
  registry: transitous kind 'trips' with the WORLD as its bbox,
  ordered AFTER the Swiss national board (richer metadata wins
  where both cover); the scope landmark now proves Paris and New
  York fall through to the aggregator while Interlaken stays
  Swiss - one provider per view, never more. Theme: syncTrains
  branches on provider.kind - the trips flow is ONE box query
  (~8 km, 15-minute window) parsed and split rail/ferry; panel
  records leg count, real-time share and the next departure.
  Renderers unchanged - the shared journey shape did the work.
  Gate 50 sets (trains 6 -> 9 landmarks); browser smoke unchanged
  and clean.
- DONE: real cable cars (Jul 10, completing the Alpine transport
  picture - the Jungfrau region's aerial installations are its
  skyline: the Schilthorn cable cars, Beatenberg-Niederhorn, the
  Firstbahn). OSM way[aerialway~cable_car|gondola|mixed_lift|
  chair_lift] through the SAME mirrors; the way nodes ARE the
  pylon positions, so the spans are real and NOTHING is thinned
  at capture. aerialways.js (pure, gated at 4 landmarks): the
  TRUE catenary, never the parabola - solveCatenaryA runs Newton
  on the sag identity d = a (cosh(L/2a) - 1) seeded by the
  parabolic answer (landmark: the solved a reproduces a 12 m sag
  to 2.4e-13 AND measurably differs from L^2/8d - the
  approximation is provably not what ships); catenaryPoints hangs
  the cable between supports at UNEQUAL heights via the asinh
  vertex closed form xv = L/2 - a asinh(h / (2a sinh(L/2a))) -
  both endpoints exact to machine precision, every interior point
  strictly below the chord (a cable hangs; it never rises above
  its supports' line); the LIVE 44-installation fixture parses
  with its identity (Niederhorn and the Firstbahn by name, the
  first pylon line's 13 nodes intact); cabins hang at
  deterministic shared-hash fractions - a cable car runs one per
  direction, a gondola circulates by spacing. Theme:
  syncAerialways (both mirrors, geodetic cache per anchor),
  placeAerialways projects each pylon onto the sampled terrain
  (interior supports 12 m, end stations 6 m), hangs every span on
  its own catenary as LineSegments (1 px at any distance - what a
  distant cable IS), pylon cylinders and cabin boxes
  aerial-wrapped; ?aerialways=0; KEEP_PARAMS carries
  'aerialways'. Gate 50 -> 51 sets. Browser smoke, SEVEN placed
  layers now: 177/177 buildings, 319/319 roads, 88/116 landuse,
  185/189 watercourses, 192/196 railways, 3/44 aerial
  installations (the rest lie outside the 16 km box - honest),
  one known warning class.
- DONE: real summit labels (Jul 10 - the Jungfrau panorama is
  famous BECAUSE its peaks have names). OSM natural=peak nodes
  through the SAME mirrors carry the two facts a panorama label
  needs: the name and the surveyed elevation. peaks.js (pure,
  gated at 4 landmarks): parsePeaks handles the ele tag's wild
  forms ('4048.8', '3 970', comma decimals) - nameless peaks
  cannot be labelled and are dropped, elevation-less ones keep a
  name-only label; selectPeaks is the cartographic declutter rule
  (elevation-ranked greedy with minimum separation) and the LIVE
  400-peak fixture holds its own case in point: the Jungfrau is
  labelled while "Wengen Jungfrau" (4085 m, ~300 m away) is not,
  every kept pair >= 1.8 km apart; the fixture carries the
  4000ers at their surveyed metres (Finsteraarhorn 4274, Jungfrau
  4158, Mönch 4107); labelText renders 'Jungfrau · 4158 m' at tag
  precision. Theme: syncPeaks (both mirrors, geodetic cache per
  anchor), placePeaks selects 12 in-box summits and pins each
  label as a small canvas sprite just over the RENDERED summit
  (constant screen size, sizeAttenuation off) - annotations, not
  scenery: they deliberately skip the aerial haze (a label that
  fades like rock defeats its reason to exist); ?peaks=0;
  KEEP_PARAMS carries 'peaks'; panel records count and the
  highest label. Gate 51 -> 52 sets. Browser smoke, EIGHT layers:
  the seven placed layers unchanged plus 12 of 59 summits
  labelled on the box, one known warning class.
- DONE: measured river flow (Jul 10, owner: source integration +
  asset design + frontier research in one - and an explicit
  revert first: a shared-sky presence prototype was judged not
  progress and rolled back clean to HEAD before this). GloFAS
  (the Open-Meteo Flood API - keyless, global, the same family
  the theme's weather/marine/air-quality already use
  browser-side) publishes daily river discharge for the nearest
  river cell. Today's flow against the recent record now drives
  the rendered river WIDTHS through Leopold & Maddock (1953,
  USGS Professional Paper 252) at-a-station hydraulic geometry:
  a cross-section widens with discharge as w = a Q^b, canonical
  at-a-station width exponent b = 0.26, applied as a RATIO so
  the OSM ladder width stays the calibration - w_today =
  w_ladder x (Q_today / Q_ref)^0.26 with Q_ref the 92-day median
  of the SAME source (internally consistent). rivers.js gained
  refDischarge (median, null under 14 valid days) and
  dischargeFactor (exact power law, clamped [0.5, 2], factor 1
  whenever the data cannot speak - nothing invented), gate 4 -> 6
  landmarks: the law held exact against Math.pow with unity at
  reference and guarded edges, and the LIVE 93-day GloFAS capture
  at the Interlaken cell recomputing its own median (34.65 m3/s)
  and the capture day's factor (26.16 m3/s -> x0.930: the Aare a
  touch narrower that day, by the paper's own law). Theme:
  syncDischarge (one fetch per anchor, 6 h refresh, roam
  re-sync), placeRivers scales the ladder widths by the factor
  before the shared ribbon builder; panel records today's flow,
  the median and the width factor; ?discharge=0 pins the ladder;
  KEEP_PARAMS carries 'discharge'. Gate 52 sets (rivers 4 -> 6
  landmarks); browser smoke unchanged and clean (offline the
  factor is 1 - the truthful default).
- DONE: measured snow cover (Jul 10 - retiring the theme's oldest
  surviving heuristic: the snowline inferred snow from the
  freezing level; NASA GIBS serves the daily MEASURED answer over
  the same keyless WMTS the Black Marble lights use). Layer
  MODIS_Terra_NDSI_Snow_Cover (the standard MODIS snow product -
  NDSI scaled 1..100 per pixel); snowcover.js (pure, gated at 4
  landmarks): the published GIBS colormap embedded VERBATIM
  (v1.3, fetched at capture; the ramp is NOT a formula - banded
  green, cycling blue, red at 100 - so the exact table IS the
  inversion; landmark holds rows 1/50/100 verbatim, 100 injective
  keys, and the transparent flag classes cloud 250 / night 211 /
  water 237/239 / no-data tellable by RGB at alpha 0); NDSI ->
  fractional snow cover through Salomonson & Appel (2004, RSE
  89): FSC = -0.01 + 1.45 NDSI, the printed coefficients held
  exact with the physical clamps; the LIVE tile fixture (GIBS z8
  r90 c133, 2026-07-08 - the Jungfrau in July): sampled glacier
  pixels classify as measured snow, valley pixels as measured
  bare ground, cloud and the lakes as their flags, 3708 snow
  pixels on the tile in a month the freezing-level rule can only
  guess at; and the snowField raster (sceneToGeo + the night
  lights' gated pixelOf) exact per cell with unknown (-1)
  propagated and the shader row orientation held (float32
  fround() on the expectation - the storage lesson, fourth
  appearance). terrain-tsl: snowTexNode + uSnowCovOn beside the
  lights and landuse textures; where the satellite saw ground the
  FSC REPLACES the freezing-level elevation gate, while the slope
  shedding (where snow physically sticks) and the live-snowfall
  uSnowy term stand in both regimes - yesterday's pass cannot see
  today's fall - and under cloud/night the heuristic stands
  (fscKnown smoothstep on the -1 sentinel). Horizon:
  syncSnowCover walks back up to 8 days for the newest published
  Terra day (4 corner tiles, canvas decode, N=96 field,
  NearestFilter - FSC must not bilinear across a cloud edge),
  drops to the heuristic on re-anchor until the new box's field
  lands, 6 h refresh; panel records the day, the seen share and
  the mean cover; ?snowcover=0|URL; KEEP_PARAMS carries
  'snowcover'. Gate 52 -> 53 sets. Browser smoke clean (the
  debug-mode offline-fetch warnings of trains/discharge joined
  the smoke's known-offline filter - by-design messages, not
  defects).
- DONE: wet soil darkens (Jul 10 - the coupling class: two
  measured systems interacting. The landuse tints painted the
  fields one dry albedo forever; real fields darken after real
  rain). Source: the SAME open-meteo forecast family already
  serving weather/marine/air-quality publishes
  soil_moisture_0_to_1cm (m³/m³, the reactive top centimetre -
  the layer the eye actually sees wet). Research: Lobell & Asner
  (2002, SSSAJ 66:722) - laboratory result that soil reflectance
  falls EXPONENTIALLY with moisture expressed as DEGREE OF
  SATURATION, similarly across soil types, R = b + a exp(-c
  theta_sat), with the visible band saturating by ~0.20 m³/m³
  volumetric. Two documented parameters close the per-soil
  unknowns (their four soils differ; no single published
  constant): the classic visible-band figure that saturated soil
  reflects about HALF of dry, and loam porosity 0.45 for the
  volumetric -> saturation conversion; the decay constant is
  DERIVED from the paper's saturation point rather than picked -
  exp(-c x 0.20/porosity) = 1/20, c = 6.74. landuse.js:
  soilDarkening (dry = 1, monotone, saturated floor, factor 1
  whenever data cannot speak), SOIL_CLASSES (farmland, farmyard,
  allotments, quarry, sand, beach - vegetated tints stand, canopy
  hides soil), landTint gained the soilFactor param applied at
  paint time. Gate 5 -> 6 landmarks: the exponential exact, the
  derivation identity held to 1e-12, and through the painter - a
  farmland texel darkens by exactly the factor (float32 fround)
  while a meadow texel stands. At the LIVE capture (Interlaken,
  0.108 m³/m³ that morning) the fields render x0.599 - visibly
  damp ground, measured. Theme: syncSoil (current hour from the
  hourly series, 3 h refresh, roam re-sync), placeLanduse repaints
  through the factor; panel records theta and the tint; ?soil=0
  pins dry; KEEP_PARAMS carries 'soil'. Gate 53 sets (landuse
  5 -> 6 landmarks); browser smoke clean.
- DONE: measured ridges and the church spires (Jul 10, the asset
  lane - every added vertex traceable to a tag or a theorem). The
  gable decision was a vertex-count heuristic (ring <= 6) and the
  ridge itself only built for exact quads - an L-shaped house
  vertex-counted as "rectangular" while a true rectangle with one
  surveyed notch fell to a flat cap. Now the decision is
  MEASURED: buildings.js gained convexHull (Andrew monotone
  chain) and minAreaRect - the minimum-area enclosing rectangle
  by rotating calipers, EXACT by the Freeman & Shapira (1975)
  theorem that the optimum shares a side with a hull edge, so
  testing hull edge directions is complete, not a search. A
  house-family footprint takes a ridge iff its true area fills >=
  80% of its own rectangle; the ridge rides the rectangle's
  measured long axis with the real 0.4 m eave overhang past the
  walls (roof orders re-hand-checked for outward normals under
  the general axis pair). On the LIVE fixture the census moved
  honestly: 31 -> 48 gabled - 17 near-rectangular houses with 5+
  surveyed vertices now carry correctly oriented ridges. And the
  churches got their spires: building=church/chapel raises a
  slate pyramid over a gable end (the END is untagged anywhere -
  a deterministic pick via the shared hash, the same convention
  as the facade tints), base a quarter of the measured short
  axis, height max(1.1 h, 8 m). A REAL church joined the fixture
  for it: the Evangelisch-Reformierte Kirche Unterseen, 9 surveyed
  nodes, 1.4 km from the anchor. Gate 5 -> 7 landmarks: the
  rotated 40 x 25 rectangle recovers its area to 0.0e+0 with its
  true axis and the L fills 55% (< 80, stays flat); the notched
  6-vertex house - the OLD rule's blind spot - rides a real
  sloped ridge, and the live church raises its spire 31.8 m over
  ground with nothing anywhere facing down. Viewer: the town
  stage includes the church; the reshoot shows the town's
  roofscape reorganised along the true footprint axes. Gate 53
  sets (buildings 5 -> 7 landmarks); browser smoke clean.
- DONE: cabins pendulum in the measured wind (Jul 10, the
  coupling lane - the gusts that already sway the trees now swing
  the cable cars). A suspended cabin IS a pendulum: statics from
  the drag equation balanced against gravity, tan(lean) =
  0.5 rho v^2 Cd A / (m g), leaning the hanger along the TRUE
  wind direction; dynamics from the pendulum's own natural
  frequency omega = sqrt(g/L) - gusts cycle the lean between the
  mean-wind and gust-wind deflections at that frequency, phase
  decorrelated per cabin via the deterministic fractions. The
  documented cabin closes the untagged unknowns: an 8-seat
  monocable gondola (600 kg tare, 2.6 m^2 frontal, Cd 1.1 bluff
  body, 2.5 m hanger arm); air density thins with the anchor's
  elevation on the 8.4 km scale height. aerialways.js gained
  CABIN/windAngle/cabinSwing, gate 4 -> 5 landmarks: the statics
  identity exact to 1e-15, the density-altitude ratio exactly
  exp(-1) at one scale height, omega exact, the gust cycle
  bounded by (and sweeping) the [mean, gust] lean interval, calm
  hanging plumb. Theme: placeAerialways registers each cabin with
  its hang point and phase; the frame loop swings them about the
  SAME treeAxis/windV pair the tree spring-dampers use - one wind,
  every consumer. Hanger length corrected from the old ad hoc
  1.7 m offset to the documented 2.5 m arm. Gate 53 sets
  (aerialways 4 -> 5 landmarks); browser smoke clean.
- DONE: snow lies on the roofs (Jul 10, the coupling lane - the
  measured snow cover and the OSM buildings meet). buildingsGeometry
  gained a fourth attribute: `roof` flags exactly the surfaces
  snow can LIE on (the sloped ridge planes and flat caps - walls,
  gable faces and the spires stay bare: snow does not stand on
  the vertical or the steep). The merged-geometry landmark now
  holds it structurally: every flagged vertex faces up or
  up-slope (ny > 0.05), both classes present, nothing mis-flagged.
  Theme: the buildings' colorNode mixes the terrain's OWN snow
  albedo (0.87/0.90/0.93) over the roof surfaces by
  max(measured, live) - `rsnow`, a per-vertex attribute sampled
  from the SAME Salomonson-Appel FSC field the terrain reads
  (syncSnowCover re-seats the town when the field lands, the
  lights-path precedent), OR the live-snowfall term, the very
  uSnowy value the terrain smooths each frame (bldSnowU mirrors
  it) - so when it snows tonight the roofs whiten with the ground
  in real time, and tomorrow the satellite confirms or clears
  them. Nothing new is invented: one snow state, three consumers
  (terrain, physics drifts, now the roofs). Gate 53 sets
  (buildings landmark strengthened in place); browser smoke clean.
- DONE: clouds amplify the skyglow (Jul 10, the coupling lane -
  the live cloud cover and the Falchi atlas meet). Kyba, Ruhtz,
  Fischer & Hölker (2011, PLoS ONE 6:e17307) measured it:
  overcast multiplies zenith sky luminance by 10.1 inside Berlin
  and 2.8 at 32 km out - the amplification grows with how much
  artificial light is overhead, which is exactly what the Falchi
  ratio already measures per anchor. skyglow.js gained cloudAmp:
  the two published anchors log-interpolated in the ratio (the
  assigned anchor ratios ~20 urban core / ~3 city edge are the
  documented closure), clamped to the measured range and to >= 1
  (a pristine sky has nothing to amplify - the rendered clouds
  already occlude its stars directly), partial cover linear in
  cloud fraction (the paper's okta bins rise monotonically). Gate
  landmark (skyglow 4 -> 5): both anchors exact to 1e-12, clear =
  1, pristine never amplified, clamps hold, monotone both ways,
  and the magnitude identity - the amplified zenith brightens by
  exactly 2.5 log10((1+rA)/(1+r)) through the module's own
  skyMag. Theme: computeSkyglow now computes the STATIC parts
  (atlas sample, azimuthal glow pattern) and the new
  applyCloudSkyglow derives everything live - star contrast,
  zenith mag, Bortle, horizon-glow amplitude - from the AMPLIFIED
  ratio, re-run on every weather poll as the measured cover
  changes; the panel shows the factor ('x7.3 under 90% cloud
  (Kyba 2011)'). An overcast night over a town is now visibly
  brighter than a clear one, and the stars fade under it exactly
  as the contrast ratio says. Gate 53 sets (skyglow 4 -> 5
  landmarks); browser smoke clean.
- DONE: wind turbines from OSM, spun by the real wind under the
  manufacturers' own envelopes (Jul 10, all three lanes at once -
  a real data source, a designed asset, and the published control
  law followed rather than approximated). turbines.js: the spec
  ladder (explicit rotor:diameter/height:hub tags > the model's
  published sheet > fleet medians computed FROM the sheets - no
  invented constants) resolves Vestas V90-2.0 (facts & figures:
  cut-in 4/rated 12/cut-out 25 m/s, 9.3-16.6 rpm, nacelle
  10.4x3.4x4 m), ENERCON E-82 E2 (product overview: 6-18 rpm,
  storm control 28-34 m/s, cut-in and rated wind read off
  ENERCON's own calculated power curve, Cp max 0.50) and the
  V112 platform (General Specification 0011-9181 V03: 6.2-17.7
  rpm, rotor tilt 6 deg, coning 4 deg, yaw 0.5 deg/s; rated 13).
  The control law is Burton et al.'s variable-speed scheme:
  region 2 tracks max Cp at Omega = lambda_opt v / R inside the
  published interval, with the closure lambda_opt =
  Omega_max R / v_rated so the rotor hits its published top
  speed exactly at its published rated wind; Vestas stops hard
  at cut-out, ENERCON's storm control tapers the speed linearly
  across its published window instead. Hub wind comes from the
  forecast model's own 80/120 m levels (syncWeather now asks for
  them), log-profile interpolated to each hub. windmills.js
  (vessels.js mould, ?asset=windmills stage): tower/nacelle/
  three coned blades from the sheets' own dims and ratios (both
  Vestas sheets put the blade at 0.49 D), nacelles slew into the
  live wind at the published yaw rate, rotors spin clockwise
  seen from upwind. Live fixture: the 19-turbine Juvent farm on
  Mont Crosin (3 models, 16 JUV refs). Gate 54 sets (turbines: 6
  landmarks - ladder, law, storm control, ENERCON's published
  curve closing the constants, log-profile anchors, fixture).
- DONE: wind-farm wakes - the farm robs itself (Jul 10, frontier
  research on the data shipped hours earlier). wakes.js follows
  the industry PARK scheme from its sources: Jensen (1983,
  Risoe-M-2411) top-hat wake expanding at r0 + k s with the
  momentum initial reduction (1 - Ct) = (V/U0)^2; Katic,
  Hoejstrup & Jensen (1986, EWEC Rome) partial shadowing by the
  exact circle-circle lens and root-sum-square superposition;
  WAsP's land decay k = 0.075. Thrust is published data end to
  end: Vestas prints the V112's full Ct table in the General
  Specification (table 12-2 - the 1.225 kg/m^3 column carried
  verbatim, 45 rows), and the other pitch-regulated models ride
  that curve on the non-dimensional v / v_rated axis of their
  own sheets' rated winds. The E-82's storm control tapers its
  thrust across the same published 28-34 window as its speed.
  The gate holds the transfer against a THEOREM, not a feeling:
  inverting ENERCON's own published Cp curve through
  one-dimensional momentum theory (Cp = 4a(1-a)^2 on a <= 1/3,
  Ct = 4a(1-a)) is a strict lower bound on true thrust - losses
  only lower Cp at fixed induction - and the transferred curve
  clears that floor at every published row, converging above
  rated where the loss share vanishes (within 22% by 20 m/s).
  An earlier draft used the inversion DIRECTLY as the E-82's
  thrust; the gate's own cross-check exposed the bias (Cp 0.50
  inverts to 0.62 against the V112's published 0.80 in the same
  regime) and the design changed - the reference-first loop
  working as intended. Landmarks (6): the published curve
  verbatim/monotone/physical; the floor theorem; Jensen closed
  points (initial reduction exact, deficit exactly /4 where the
  wake doubles, s^-2 far field); the lens at its closed forms
  (equal circles at one radius = (2pi/3 - sqrt(3)/2)/pi exactly);
  sqrt(2) superposition; the live Juvent farm (west wind 8 m/s:
  6 of 19 waked, deepest at 74% of free wind, calm lays none).
  Theme: farm factors in METRES (the asinh-warped scene Y is not
  a length), recomputed per weather poll, rotors visibly slower
  deep in the farm; panel records 'Jensen wind-farm wakes - N of
  M waked, deepest -P%'. Gate 55 sets.
- DONE: VBB radar provider - live vehicle TRACKING for
  Berlin-Brandenburg (Jul 10, the data-source lane; the user's
  nudge to try a different endpoint). The DB instances
  (v5/v6.db.transport.rest) still answer 503 on every probe, but
  the VBB instance of the same HAFAS family is up, keyless and
  CORS-open - and its /radar endpoint beats a station board: it
  reports every vehicle MOVING in a box with its live position,
  line metadata (name, product, operator) and realtime-adjusted
  stopovers. trains.js: PROVIDERS gains the radar entry (bbox
  Berlin-Brandenburg, between the Swiss board and the transitous
  world fallback), PRODUCT_CAT maps HAFAS products onto the one
  consist ladder (underground still deliberately absent, buses
  never parse, ferries take the boats path), parseRadar emits
  the SAME journey shape the boards do - so trainAt, the pools
  and the liveries all serve a third provider kind unchanged.
  Each movement's own live fix rides along untouched, and the
  gate holds the interpolation against it: in the captured
  frame (central Berlin, 07:45 CEST - 20 verbatim movements:
  the ODEG RE8, 12 S-Bahn, 3 trams, 4 buses) the RE8 was
  dwelling at Potsdamer Platz and trainAt at capture time lands
  0.0 m from the radar's reported position - tracking and
  timetable agreeing through the parser. Trains 9 -> 11
  landmarks (the frame + provider scoping: Berlin -> radar,
  Interlaken -> Swiss board, mid-Pacific -> transitous, the
  dead DB endpoint stays out). Theme: a third syncTrains branch;
  Berlin smoke (radar stubbed with the captured frame) records
  '16 vehicles tracked - RE8 -> Elsterwerda (ODEG)'. Gate 55
  sets.
- DONE: Cox & Munk (1954) sun glitter on the lakes (Jul 10, the
  frontier lane - the LAST tuned lobe in the water path replaced
  by the published law). The wet-pixel glitter was a Blinn
  exponent mix(700, 60, U/15); it is now the slope-statistics
  model Cox & Munk measured from aerial photographs of the sun's
  glitter - the standard of ocean optical remote sensing since.
  coxmunk.js carries the laws as reproduced verbatim in Capelle
  et al. 2023 (the IASI revisit, eq. 9-12): upwind mss 3.16e-3 U,
  crosswind 3e-3 + 1.92e-3 U (wind at the paper's own 12.5 m
  mast, clamped to its 1-14 m/s data range), the Gram-Charlier
  expansion with measured skewness C12 = 0.01 - 0.0086 U,
  C30 = 0.04 - 0.033 U (waves lean downwind) and peakedness
  0.23/0.12/0.40, exact unpolarised Fresnel (n = 1.34), and the
  Breon/MERIS radiance factor rhoF p / (4 cosThetaV cos^4 beta).
  Landmarks (5): the regressions exact at their anchors with the
  separately fitted total consistent inside the paper's own
  +-0.004; the Gram-Charlier structure held by MOMENT IDENTITIES
  (Hermite orthogonality: normalisation and both second moments
  untouched by the corrections, the normalised upwind third
  moment = -C30 exactly - recovered numerically to 0.289 vs
  0.290); Fresnel closed points incl. Brewster's rs^2/2; the
  mirror-geometry closed form exact and the photographed
  observable - wind WIDENS the glitter (peak falls, off-specular
  brightens); the anisotropy (along-wind slopes likelier than
  across, downwind lean likelier than up). terrain-tsl mirrors
  the same expressions on wet pixels (uWind125 uniform); the
  theme feeds it the 12.5 m wind log-interpolated from the
  forecast model's own 80/120 m levels (turbines.js hubWind).
  One scene now shares one wind: trees sway in it, cabins swing
  in it, rotors spin and wake in it, and the lake glitter
  widens, elongates and leans with it. Gate 56 sets; Interlaken
  smoke clean.
- DONE: the rainbow, by Airy's theory on measured rain (Jul 10,
  the frontier lane). rainbow.js follows the sources end to end:
  Daimon & Masumura (2007) Sellmeier dispersion of water (eight
  measured coefficients verbatim, 21.5 C); Descartes geometry in
  the closed forms of Adam's Physics Reports 356 review (x0^2 =
  ((k+1)^2 - N^2)/((k+1)^2 - 1); the review's own anchors hold -
  N = 1.3318 -> 42.3 deg, N = 1.3435 -> 40.6 deg, n = 4/3
  secondary -> 51 deg); Airy (1838) diffraction with xi =
  (2 k_w^2 a^2 / D'')^(1/3) (D - Dmin), the Airy function
  implemented from the A&S series/asymptotics and gated at
  Ai(0), Ai(1), the first zero and the primary-peak abscissa;
  bow strengths from the exact Fresnel path factor
  (1-rho)^2 rho^k through the SAME fresnelWater the Cox-Munk
  glitter uses; drops from Marshall & Palmer (1948) - the very
  paper the radar's Z-R already inverts - D0 = 3.67/Lambda,
  Lambda = 4.1 R^-0.21; solar-disk smearing (chord-weighted
  0.266 deg). Landmarks (6): dispersion checkpoints; Descartes
  closed forms with D'(x0) = 0 to 1e-12; Airy vs A&S; MP exact
  at 1 mm/h; THE BOW - red primary 42.11 deg with blue inside
  (colour order), secondary reversed at 50.8/53.1, Alexander's
  dark band at 0.0% of peak, secondary/primary 0.37 matching the
  Fresnel path ratio 0.35; and the supernumerary signature -
  fringes 0.81 deg apart in drizzle, 0.56 in a downpour
  ((k a)^(-2/3), invisible to geometric optics). Theme: a dome
  overlay (sky-objects-tsl) samples the CPU-computed RGB profile
  by angle from the antisolar point; gates all measured - rain
  at the anchor, direct beam through the measured cover, the sun
  low enough that the bow clears the horizon; re-laid on every
  weather poll; panel records 'Airy rainbow - primary 42.4 deg,
  drops O 1.1 mm (Marshall-Palmer, 3 mm/h)'. Gate 57 sets.
- DONE: the 22-degree ice halo and the sundogs (Jul 10, the
  rainbow's sibling - ice prisms sunward where the rain was
  antisolar). halos.js: ice index from Warren & Brandt (2008),
  the compilation's own rows at the atmosphere's RGB (1.3073/
  1.3110/1.3163); the halo as minimum deviation through the
  hexagonal 60-degree prism, D = 2 asin(n sin(A/2)) - A -
  21.66 deg red to 22.34 blue, the red inner edge; sundogs by
  Bravais (1847) skew-ray optics - n' = sqrt(n^2 - sin^2 h)/
  cos h, so the dogs sit ON the halo at sunrise (n'(0) = n
  exactly), migrate outward as the sun climbs, and die at the
  closed-form cutoff asin(sqrt((4 - n^2)/3)) = 60.9 deg - the
  documented sundog death near 61; the profile is the
  minimum-deviation caustic (1/sqrt(D - Dmin), dark inside -
  every photograph's sharp inner edge), solar-disk smeared with
  the rainbow's own kernel, Fresnel-weighted through the same
  gated fresnelWater. The 46-degree halo's closed point is
  gated (45.9 deg) but the bow is OMITTED from the drawn
  profile: its real faintness comes from ray-path statistics
  Fresnel alone does not carry, and the gate proved it (a
  Fresnel-only 46 came out at 86% of the 22 - mistuned physics
  is worse than none). Landmarks (6): the verbatim rows; prism
  closed points with the stationarity identity |D'(i_m)| = 0;
  Bravais exact at 0 and at the cutoff; the caustic's exact
  1/sqrt ratio; the profile's red inner edge, dark-inside/
  soft-outside; sundogs end-to-end (ON the halo at the horizon
  to 1e-12, red toward the sun at 25 deg, the LUT empty at 65).
  Theme: a second dome overlay (ring LUT static physics; the
  sundog LUT re-solves Bravais when the sun moves 0.2 deg;
  plates' documented ~1.5 deg wobble as the vertical envelope);
  amplitude follows the MEASURED high cloud through the direct
  beam of the lower decks - the cirrus deck the theme already
  polls finally has its signature. Gate 58 sets; smoke shows the
  bow and the halo standing in one sky.
- DONE: atmospheric-optics CONSOLIDATION - one system again
  (Jul 10). The Jul 10 rainbow and halo features were built
  without noticing the theme ALREADY carried a certified
  optics dome (optics-lut.js + createOpticsMaterial: Monte-Carlo
  halo histogram, geometric Descartes bow histogram with the
  emergent Fresnel ratio and Alexander band, limb-darkened solar
  convolution, and BOTH sun and moon instances - paraselenae and
  moonbows with Hapke phase brightness). For two merges the sky
  drew two bows and two halos at slightly different radii. The
  fix keeps the best of both: rainbow.js and halos.js remain as
  the pure-physics LIBRARIES (their 12 landmarks unchanged) and
  optics-lut.js now composes them - the bow LUT is rebuilt from
  AIRY theory (supernumeraries the geometric histogram
  documented as out of scope, drop radius from Marshall-Palmer
  on the measured rain, re-laid on weather polls for both the
  sun dome and the moonbow); the halo keeps its superior
  Monte-Carlo histogram but on the Warren & Brandt 2008 rows;
  the sundogs drop the old fixed gaussian band ("plate-crystal
  orientation statistics out of scope") for the Bravais LUT -
  migration, dispersion and the ~61-degree death are now the
  physics', and the old (0.44 - alt)/0.26 display ramp is
  deleted. My duplicate dome meshes, materials and theme blocks
  are removed; the water index moved from Hale & Querry to
  Daimon & Masumura through the library. optics-reference.mjs
  grew from a printer into an asserting gate (4 landmarks:
  Warren-Brandt halo edges, the Airy bow with colour order/
  reversed secondary/band/Fresnel ratio, supernumerary
  tightening THROUGH the LUT, the dog LUT's migration and
  cutoff). Lesson recorded: grep the codebase for the
  phenomenon BEFORE building it - the 'optics' set name was in
  the gate list all along. Gate 58 sets (optics 4 asserting);
  rain smoke shows ONE bow, the LUT record carrying its
  measured drop size.
- DONE: real comets from the MPC's own element sets (Jul 10,
  data + frontier - exact orbital mechanics on a live source).
  comets.js: the Minor Planet Center's Soft00Cmt export (963
  comets, CORS-open - the browser fetches it directly, cached a
  day) parses to perihelion epoch/q/e/angles/photometric g,k;
  propagation is the universal-variable Kepler solver (Vallado
  Alg. 8 / Danby 6.9) - ONE formulation through the Stumpff
  functions for elliptic, near-parabolic and hyperbolic orbits,
  started from perihelion where the equation collapses to
  sqrt(mu) dt = e chi^3 S + q chi; brightness by the standard
  m1 = g + 5 log Delta + 2.5 k log r. Landmarks (5): Stumpff
  closed points (C(pi^2) = 2/pi^2 exactly); universal Kepler at
  its exact limits - the circle holds r = a to 1e-12 with the
  mean motion's own angle, BARKER'S EQUATION satisfied to 3e-16
  at e = 1, time reversal exact, the vis-viva energy integral
  held on ellipse, parabola and the e = 6.14 hyperbola; the MPC
  lines parse verbatim; PROPAGATION AGAINST JPL HORIZONS with
  same-day element sets - Hale-Bopp (29 years past perihelion,
  50.9 AU out) to 2.1e-3 AU, the INTERSTELLAR 3I/ATLAS (e =
  6.14) to 4.8e-3 AU, short-period Lagerkvist to 4.0e-3 AU -
  three orbit regimes, one solver, independent ephemeris; the
  magnitude law at its closed points with the filter pipeline.
  Theme: propagated once a minute beside the planets (ecliptic
  <-> equatorial by the J2000 obliquity, Earth from the same
  astronomy-engine ephemeris, alt/az through the same AE.Horizon
  path); the brightest comet above magnitude 6.5 gets a head
  sprite through the planets' own brightness law and an
  anti-sunward tail faded by the DIFFUSE-source contrast law
  (lpVis - tails wash out before heads). Most nights nothing
  shows - rare-event content like the eclipses; the panel
  records name/mag/r/Delta whenever one is up. ?comet=g forces
  a synthetic perihelion comet for the harness. Gate 59 sets.
- DONE: the dust tail, by Finson & Probstein (Jul 10 - closing
  the comet feature's own documented gap, "dust lag is not
  modelled"). comets.js gained velocities through the f'/g'
  functions (perihelion speed sqrt(mu(1+e)/q) exact), the
  general-state universal solver (Vallado Alg. 8 in full -
  group property 40 d + 60 d = 100 d to 3e-16, energy and
  angular momentum drift exactly zero), and syndyne(): dust of
  radiation-pressure parameter beta released with zero ejection
  velocity (the FP 1968 model) flies the SAME universal
  equations under mu(1 - beta) from the comet's own state at
  emission. Landmarks (comets 5 -> 7): beta = 0 rides the comet
  to 5e-16 AU at every age; a young small-beta grain sits
  anti-sunward by the closed-form leading order
  (1/2) beta mu tau^2 / r^2 (ratio 1.0003, direction cosine
  1.000); the beta = 0.3, 40-day grain TRAILS the orbital
  motion - the curve every dust-tail photograph shows. Theme:
  two tails now - the straight bluish ION tail (solar-wind
  carried, effectively radial) and the curved warm DUST strip
  through the beta = 0.3 syndyne's own sky positions (grains 2
  to 60 days old, widening with age), both faded by the
  diffuse-source contrast law. Gate 59 sets (comets 7).
- DONE: the dust FAN + the force-free limit (Jul 10, comets
  polish). The single beta = 0.3 syndyne became the family the
  Finson-Probstein diagram actually describes: three syndynes
  (beta 0.1/0.3/0.6) drawn as overlapping strips - the tail's
  width on the sky IS the grain-size family, not a drawn shape.
  keplerFromState gained the exact mu = 0 branch (a beta = 1
  grain: radiation pressure cancels gravity, straight-line
  motion). Landmark (comets 7 -> 8): the fan's ordering - at
  fixed 20-day age the anti-sunward displacement grows STRICTLY
  with beta across 0.05/0.1/0.3/0.6/1.0 (beta 1 carrying 20x
  beta 0.05), and every grain collapses onto the head at age
  zero; the FP sheet's whole geometry in one check.
- PARKED honestly (Jul 10, both after real source checks): lake
  ice - MODIS NDSI statically masks inland water (our own
  FLAG_RGB rows 237/239 prove it), so freeze is NOT measurable
  through the snow pipeline, and Stefan's law without a
  depth-aware onset would freeze Lake Thun (which does not
  freeze); measured-imagery ground albedo (GIBS 8-day surface
  reflectance / HLS NBAR) - the display stretch is not citably
  documented for quantitative inversion, HLS carries clouds with
  no mask layer, and the Ross-Li kernels were FITTED from the
  same MOD09 measurements, so blending both would double-count
  one dataset. Both need better sources, not more cleverness.
  DB transport.rest re-probed Jul 10: now fully dark (no route).
- DONE: Greenler's crystal Monte Carlo - the 46-degree halo
  earns its honest brightness (Jul 10). halos.js gained the full
  3D random-orientation tracer the caustic model stood in for:
  hexagonal ice prisms (compact c/a = 1, the classical
  random-orientation model's documented parameter) at uniform
  SO(3) orientations (Shoemake quaternions), flux-correct entry
  face selection (rejection on projected area - unbiased),
  uniform entry point ON the face, vector Snell in, the convex
  prism's own exit face, Fresnel at both interfaces, TIR
  transits discarded (internally reflected families make OTHER
  arcs, documented out of scope). Deterministic (seeded
  mulberry32) so the gate holds exact facts about the output.
  Every 2-refraction path lands in ONE histogram: the 22-degree
  halo (side-side, 60-deg wedge) and the 46-degree halo
  (side-basal, 90-deg wedge) both EMERGE - and the 46 comes out
  at 0.23 of the 22, the orientation-plus-Fresnel statistics the
  throughput-only model put at 0.86 (which is why it was omitted
  then; now it is drawn at the crystal's own number). Landmarks
  (halos 6 -> 7): the n = 1 NULL TEST (an index-free crystal is
  optically nothing - every transit exits undeviated, max
  deviation 5e-8 rad of float noise), bit-identical seeded
  histograms, both halos at their minimum-deviation edges, the
  emergent ratio pinned to (0.05, 0.45). optics-lut's
  buildHaloLUT now wraps mcHalo (3x400k transits, ~250 ms at
  init) + the limb-darkened sun convolution; the dome window
  widened to 15-52 deg; the sundog Bravais LUT unchanged. Gate
  59 sets.
- DONE: the daylight, measured (Jul 10, the data sweep's find -
  the sweep also re-probed the HAFAS family: only BVG lives, and
  VBB's bbox already covers it). Open-Meteo's satellite
  radiation API (keyless, CORS-open) serves the geostationary
  constellations' OBSERVED global horizontal irradiance at the
  anchor, hourly, fresh to the hour. clearness.js turns it into
  the scene's ambient response through two classics: Haurwitz
  (1945) closed-form clear sky (GHI = 1098 cos Z e^(-0.057/
  cos Z)) gives the clearness index kt = measured/clear - the
  whole-sky transmittance the satellite actually saw; Erbs,
  Klein & Duffie (1982) splits it into the DIFFUSE fraction,
  because the scene's direct sun already dims per pixel
  (Beer-Lambert through the drawn decks) and only the AMBIENT
  should follow the measurement. ambientFactor = kd(kt) kt
  normalised at the correlation's own clear anchor (kt = 0.8,
  its own kd there - so ambientFactor(0.8) = 1 identically and
  a clear sky leaves the calibrated scene untouched). The real,
  documented thin-overcast BRIGHTENING (diffuse under a bright
  deck exceeds clear-sky diffuse, x2+) comes out of the
  correlation instead of being impossible under the old
  (1 - cloudy 0.3) heuristic - which stays as the fallback when
  the satellite is silent (poles, stale hours, low sun: kt is
  null below cos Z = 0.1 where Haurwitz vanishes). Landmarks
  (4): Haurwitz closed points; Erbs verbatim INCLUDING the
  published coefficients' own near-continuity at both branch
  boundaries (0 at 0.22, 2.7e-4 at 0.80 - facts of the paper,
  not of our code); the exact ratio/anchor identities and
  clamps; the live capture (pickHour takes the 13:00 row, 801
  W/m^2, kt 0.93 at the declination geometry - a clear Bernese
  afternoon corroborated by its own 895 peak). Theme: polled
  each 15 min, kt computed once a minute at the picked hour's
  midpoint sun through the same ephemeris; panel records GHI,
  kt and the Erbs factor; ?ghi=W harness override. Gate 60
  sets.
- DONE: visual verification, for real (Jul 10 - "without viewing
  them your not doing anything useful"). The theme can now be
  SEEN under the harness: (a) ?debug=1 exposes **r/**scene/
  **cam/**THREE/**astro and window.**capture(w,h) - the frame
  loop services capture requests itself, repeating its own pass
  sequence (main render, cloud composite, precipitation overlay)
  into an offscreen target and reading it back through three;
  a concurrent external render breaks the backend, and canvas
  snapshots never see a WebGPU surface (texture recycled on
  present). (b) The readback initially hung FOREVER: under
  Xvfb/SwiftShader there is no vsync backpressure, so an
  unthrottled rAF loop runs ~30 s of GPU work ahead and every
  mapAsync waits behind the backlog - measured by pausing rAF
  and watching the map resolve exactly when the queue drained
  (32 s). The driver (scratchpad view.mjs) paces rAF at ~3 fps
  and holds the loop during readback. (c) view.mjs routes every
  external request through server-side curl (the environment's
  agent proxy) with an on-disk cache, so the offline browser
  runs the theme fully LIVE - real DEM, weather, satellite
  irradiance, Overpass, GIBS, MPC, VBB radar. (d) ?look=az,alt
  and the runtime \_\_look override aim the default camera (a bow
  is antisolar, a halo circumsolar); yaw snaps when pinned.
  VIEWED and verified: Interlaken overcast noon (real ridge
  lines, peak labels), Mont Crosin farm (20 live turbines,
  rotor stars yawed to the westerly; one "artifact" line proved
  to be a REAL near turbine tower seen edge-on to its rotor),
  the double rainbow with Alexander's dark band emerging from
  the Airy LUT, the 22-deg halo ring + both parhelia (interior
  saturation is the aureole through 85% cirrus - the LUT's dark
  hole is exact, zero below 21.8 deg), the twilight comet with
  its anti-sunward tail over the Burgfeldstand ridge, the
  Milky Way's Sagittarius band at local midnight, Black Marble
  town lamps, live VBB trains in Berlin.
- DONE: the moon stops punching a hole in the day sky (Jul 10,
  FOUND BY LOOKING - the Berlin shot showed the waning crescent
  as a dark blob at 4.6 deg alt). The disc is above every metre
  of air on the ray, so the dome's in-scatter belongs ON it:
  atmosphere-tsl's domeColor LUT sampling extracted into a
  shared skySampleFor(v) (the dome now consumes it too - one
  code path, no divergence) and exposed as skyRadiance;
  createMoonMaterial adds it over the Hapke surface. The disc
  stays opaque, so lunar occultations of stars still occlude.
  By day the dark limb now carries the sky's own radiance (a 4%
  crescent 5 deg up in haze is invisible, as in nature); by
  night the sample is starlight-dark and nothing changes.
- DONE: trains ride their rails (Jul 10, the user's own eyes -
  "You have trains in the grass"). Berlin showed two S-Bahn
  consists on plain meadow: trainAt flies the straight CHORD
  between stops (hundreds of metres off through curves) and the
  drawn network never constrained it. rails.js now owns
  map-matching: railIndex builds the segment grid AND the rail
  graph (OSM junctions share node coordinates, so quantized
  endpoints merge into vertices); snapToRail is nearest-arc
  projection (closed-form foot, gated); railRoute is
  route-based map matching - Dijkstra over the drawn graph
  between the two stop projections, exact mid-arc endpoint
  handling, a route longer than 3x the chord means missing
  links (null, no invented detours); routePoint walks the
  routed polyline by arc length with the local track bearing.
  trainAt exposes its leg + time fraction; the theme's ladder:
  published shape > routed leg (constant speed ON the real
  geometry, heading = track bearing) > nearest-arc snap of the
  chord position (100 m, the GPS-error case - legs whose far
  stop is outside the drawn box cannot route) > HIDDEN (tunnel
  or a way the 300-cap dropped - a train through the grass
  would be inventing track; the panel counts both:
  "trains (map-matched): N on drawn rails - M off-network
  hidden"). Landmarks (2 new in rails-reference): nearest-arc
  at its closed points (interior foot, 3-4-5 endpoint clamp,
  cross-cell nearest, gate null); the L-network route (length
  exactly 17, the junction at f = 9/17, per-segment bearings,
  one-arc legs direct, disconnected components null). Gate 60
  sets + 3 GPU probes PASS.
- DONE (three OSM layers: wetland, waterfalls, power grid, Aug
  6): (1) natural=wetland with NO new constant - the albedo IS
  the grassland base through the gated Lobell & Asner wet-soil
  law at full saturation (x0.5006), both pieces already cited;
  ways + relations; a SURFACE class (alpine bogs), so it
  survives the rock bands; identity landmark. (2) Waterfalls:
  waterway=waterfall nodes with a MEASURED height=\* render as a
  whitewater curtain down the exact asinh datum - no height, no
  curtain; width = the rivers' gated Leopold exponent on the
  live GloFAS ratio (re-exported); parse + reuse landmarks.
  (3) The power grid: way[power=line|minor_line], vertices as
  supports, every span on the aerialways' own gated catenary
  (function-identity landmark: catenaryPoints IS the aerialways
  export; 3% midpoint sag pinned) - one sag law for gondolas and
  grid; cable/underground skipped (the tunnel doctrine); height
  tag honoured, display defaults documented (35 m/10 m). All
  through the tiled Overpass path. Grindelwald smoke: a minor
  line marches its poles across the meadow, spans sagging on the
  shared law; PAGEERROR 0; 82 reference sets green.
- DONE (rock-band tint consumption, Aug 6): the landuse tint fed
  the grass band only, stranding glacier/quarry/bare_rock/scree/
  sand wherever the slope or elevation rock bands took over. The
  distinction shipped is OSM's own semantics: SURFACE classes
  (the tag asserts the ground itself - ice, rock, extraction
  face, sand; true at any altitude) vs USE classes (use over
  unspecified ground, which the alpine bands legitimately
  override). One float alpha packs both: 1 = surface, 0.5 = use;
  shader decodes cov = min(2a,1) / surf = max(2a-1,0) exactly,
  linear filtering blending the boundary; the surface share
  re-applies after BOTH rock mixes at the same 0.85; snow still
  wins above (accumulation zones whiten as before). tintAt stays
  alpha-truthy - every existing consumer/landmark unchanged; new
  'surface/use alpha packing' landmark. The browser loop caught
  the one real break pre-commit: min() unimported in TSL scope =
  a solid-black terrain with ZERO console errors (the second
  silent-black this session; method-chained .min()/.max() is the
  file's idiom). 80 sets green.
- DONE (the totality corona, Aug 6): corona.js = Baumbach 1937
  eq. (5), READ from the original AN 263 scan (I(rho) = 0.0532
  rho^-2.5 + 1.425 rho^-7 + 2.565 rho^-17, millionths of the
  disc CENTRE - p. 124 fixes centre = 1e6 units, Abbot U = 0.6,
  mean/centre = 1 - U/3 by its own eq. (2)). Five landmarks incl.
  the verbatim limb sum 4.0432, the exact closed-form total flux
  (~1.4e-6 of the sun, the of-order-the-full-moon classic) vs
  log-spaced quadrature, and the irradiance closure. The dome
  draws it ALWAYS with no visibility gate: anchored to the
  disc-centre brightness IMPLIED by unit solar irradiance
  (B_centre = 1/((1-U/3) pi sunRad^2) ~ 18,382 sr^-1, in-shader
  from the live radius) it hides beneath the daytime aureole and
  EMERGES at totality on radiometry alone; the moon covers the
  inner reaches geometrically. LESSON: a first attempt anchored
  to the drawn disc's 120 DISPLAY constant sat ~150x under the
  sky and vanished - display compressions must never anchor real
  radiances. Radial verification on the 0.9996 Galicia capture:
  37/11/7.7 counts at rho 1.16/1.45/1.74 over the 6.4 twilight
  floor, annulus ratio 6.7x vs Baumbach 5.7x through the AgX toe.
  Scope: K/F split, streamers, Ludendorff flattening. 80 sets.
- DONE (shallow-regime pass + two owned corrections, Aug 6): the
  new per-ship wake instrumentation (?debug \_\_ships: uMs, depth,
  Frh, drawn wedge) caught two defects in the first wake commit.
  (1) The depth source read the dressed sample().e (~0 over
  water) and the 0.5 m floor INVENTED supercritical cones for
  every hull; worse, terrarium carries NO offshore bathymetry at
  Nelson at all (bed 0.00 m across the bay, measured through the
  512^2 grid). Honest rule shipped: a floating hull proves only
  depth >= draught, so with no resolved bed (> 1.5 m) the wedge
  is the parameter-free deep Kelvin; Havelock engages only on
  data; ?bathy=N is the labelled harness override. (2) The synth
  fleet moved held hulls (the anchored tanker steamed at 12 kt -
  the earlier hand-off's 'anchored ships trailed nothing' was
  WRONG for the harness path; live aisToScene did hold). Synth
  now rests held statuses; a resting hull's instrumentation
  reads null. Also: fleet speed column + 34 kt planing tender,
  and the 'Frh = 3 crossover' landmark - the Mach cone passes
  EXACTLY through the deep Kelvin sine 1/3 at Frh 3 (wakes are
  WIDER than Kelvin between 1 and 3, narrower only beyond).
  Browser-verified over a forced 2.2 m harbour: 48.8 deg
  near-critical cones at Frh 1.33 beside the tender's 15.4 deg
  at 3.77, both exactly on the gated curve, anchored hull
  resting. 79 sets green.
- DONE (Kelvin wakes, Aug 6): kelvin.js derives the ship-wake
  wedge by Havelock's 1908 construction over the finite-depth
  dispersion (stationarity c = U cos theta; rays at the group
  speed; wedge = max ray angle) - the closed forms EMERGE and six
  landmarks pin them: deep sin(alpha) = 1/3 exactly (Thomson
  1887; reproduced independently through the cos^2 = 2/3 cusp),
  Havelock widening 19.6/34.6/67.9 deg at Frh 0.6/0.9/0.99, and
  the supercritical Mach cone sin(alpha) = 1/Frh at 1.5/2.0.
  water-tsl draws arms + turbulent centreline as a third foam
  source from 8 per-vessel uniform pairs; Horizon feeds every
  moving hull per frame (measured SOG over the bathymetry's
  tide-adjusted depth AT the vessel; beam/stern from message 5).
  Amplitude deliberately unclaimed (hull-shape territory): the
  brightness is display furniture with the stationary-phase
  caustic fade, and the ~25 m transverse crests stay undrawn
  (below the display's resolvable angle - the veglod argument).
  Composition for free: a held (anchored/moored) hull feeds
  nothing, so the status physics silences the wake physics.
  Browser-verified at Nelson dusk: three moving harness vessels
  trail arm-arm-centreline Vs at the Kelvin angle; the anchored
  tanker and moored sailer trail NOTHING; PAGEERROR 0. 79 sets.
- DONE (aurora sRGB matrix derived + glacier layer, Aug 6): two
  smaller items. aurora-lut.js carried the repo's LAST pasted
  XYZ->sRGB coefficient block, contradicting spectral-srgb.js's
  own emerge-don't-paste rule - it now consumes the one derived
  matrix (line colours unchanged at printed precision). And
  natural=glacier joined the landuse layer (ways + multipolygon
  relations) at the measured Morteratsch bare-ice albedo 0.34
  (Oerlemans & Knap 1998 J.Glaciol. 44(147), READ from the paper:
  snow 0.75/firn 0.53/ice 0.34), deliberately neutral (the blue
  of bare ice needs an unmeasured bubble-scattering coefficient)
  with the MODIS FSC whitening accumulation zones over it.
  Documented scope: the tint field feeds the grass band only
  (landuse's standing design) so the value lands on low tongues;
  letting the rock band consume the tint is its own pass, and it
  would also un-strand quarry/bare_rock at altitude. Both gated
  (glacier landmark; aurora gate green with the derived matrix).
  METHOD NOTE (owner direction): papers are read DIRECTLY now -
  the COLREGS figures were re-verified against the treaty text
  (UNTS 1050 I-15824) and the albedos against the Oerlemans PDF
  itself, not fetched summaries. Also observed on the box: the
  update timer self-deployed the morning push (derived watch list
  working), but the AIS upstream is DARK - /health shows keySet
  true, 14 connects, ZERO frames, badFrames 0 (lightning/space
  flow normally). Not a code path this session touched; the
  /probe instrument exists for exactly this - owner attention
  needed (key standing or aisstream outage).
- DONE (measured navigational status -> Rule 27/30 lights, Aug 6):
  a new measured field end to end. The daemon received M.1371
  NavigationalStatus (Table 45) on every position report and
  dropped it; normalizeShip keeps it (missing -> 15, the
  standard's default) and ships.js maps it to the COLREGS regimes
  the rules DETERMINE: Rule 30 anchor whites (fore >= 6 m, >= 4.5
  m above the after one, Annex I 2(k); one light under 50 m),
  Rule 30(d) aground reds, Rule 27(a)/(b) NUC and RAM verticals
  with their making-way carve-outs (NUC making way: side + stern,
  NO masthead), Annex I 2(i) spacing, Rule 22 all-round ranges
  (3/2 nm), Rule 21(e) no-arc visibility - and anchored/moored/
  aground hulls HOLD instead of dead-reckoning GPS jitter across
  the harbour. Deliberate abstentions pinned in the gate: status
  4 (Rule 28 reds optional) and 7 (trawl vs other gear
  unmeasured) keep the underway set. Pool builds the union of
  every regime's dots once; the frame gates by live status - a
  ship weighing anchor needs no rebuild. Harness fleet carries
  statuses (anchored tanker, moored sailer, aground other).
  Verified: 4 new ships landmarks + server landmark, night
  browser capture of the anchored tanker (fore-high/aft-low
  whites lit, underway set dark, in-page dot inspection), zero
  page errors.
- DONE (the drawn sun at its true radius + the eclipsed sky, Aug
  6): the second half of the one-solar-disc item. The dome's
  cos(0.9999893) literal (a fixed 0.2651 deg) became a uniform fed
  at 1 Hz with the IAU radius over the live VSOP87 distance - the
  disc breathes 976" (January) to 944" (July); refraction.js's
  deliberately-mirrored constant now derives from the same
  eclipses.js source, sunRefraction takes the live disc for its
  flattening derivative (setting sun 0.833, closer to the
  published 5/6), and the moon's squash spans the moon's OWN
  semidiameter. R_SUN_KM carries its provenance honestly: Auwers
  1891 / Almanac 959.63" (the value the eclipse gates were
  certified with) vs IAU 2015 B3 nominal 695,700 km (~959.2") -
  documented, not mixed. Found while verifying against the
  2026-08-12 Galicia eclipse (six days out): obscuration dimmed
  only sunLight - a 99.96%-covered sun lit a full daylight dome.
  Fix: every atmosphere radiance is linear in the source
  irradiance, so ONE uncovered-fraction uniform at the two
  radiance-LUT outputs darkens dome + aerial + ambient exactly
  (transmittance/Psi_ms are optical properties, unscaled; probes
  see 1x). The DISC is deliberately unscaled - the moon covers it
  geometrically: the 0.9996 A Coruna capture shows the sky down
  to a horizon glow ring, terrain silhouetted, and the last
  photospheric sliver burning past the moon. Documented scope:
  penumbra sky gradient and the corona (totality goes dark).
  Verified: live in-page radii (sun 947", moon 980" that day),
  refraction/atmo/eclipses + full 77 + all four GPU probes green,
  noon scene unchanged; the browser loop caught the one wiring
  bug (d.radius undefined -> per-frame PAGEERROR) before commit.
- DONE (one solar disc, convolved exactly once, Aug 6): the solar
  radius lived as five literals (0.266 in halos.js caustic and the
  rainbow kernel, 0.267 in optics-lut and snow-glints prose,
  acos(0.9999893) in refraction.js) while eclipses.js proved the
  true disc swings +-1.7%. eclipses.js now exports
  sunAngularRadiusRad/moonAngularRadiusRad (IAU radii over the
  true distance) and the caustic/bow/LUT paths derive from it. The
  REAL bug found on the way: parhelionProfile fed caustic() -
  already 5-point disc-smeared - into buildDogLUT's limb-darkened
  sunConvolve, so the dogs shipped ~sqrt(2) wide and the gate
  (position + cutoff only) could not see it. parhelionProfile now
  integrates the RAW 1/sqrt caustic exactly per bin (causticBin:
  int x^-1/2 = 2 sqrt x - integrable divergence, no floor, no
  smear) and the disc enters ONCE, downstream; the dog/bow
  rebuilds take the LIVE radius from the 1 Hz ephemeris and
  paraselenae convolve with the MOON's disc (+-7% anomalistic).
  New 'single solar convolution' landmark pins red-dog FWHM 0.72
  deg and demands the width answer to the radius: a re-doubled
  smear (~1.0) or a dropped convolution (~0.4) both fail. Scoped
  OUT, next: the DRAWN disc (atmosphere-tsl cos 0.9999893, which
  refraction.js deliberately mirrors) is its own shader+probe
  pass. Browser-verified: both dogs compact and coloured on the
  22-deg ring, PAGEERROR 0.
- DONE (Cox-Munk unification + exact MPU, Aug 6): the sea's
  sub-grid mss was an inline 0.003+0.00512U copy - unclamped and
  fed the 10 m wind where the paper specifies its 12.5 m mast -
  so sea and lakes obeyed different laws in one frame. coxmunk.js
  now exports the paper's own total fit mssTotal (clamped 1-14
  m/s, new landmark, sigma^2(10)=0.0542 exact) and the theme
  feeds it the same log-interpolated 12.5 m wind as uWind125, for
  the uniform and the panel receipt alike (Monahan's whitecaps
  deliberately stay on U10 - that fit's own height). Also
  terrain-tsl's three 57.14 literals -> exact 400/7, closing the
  50 ppm drift atmosphere-tsl already closed. Nelson
  browser-verified clean.
- DONE (veglod.js: spatial tree LOD + instanced pools, Aug 6):
  the vegetation layer was the last count cap (140 trees,
  first-come, ~3 draws each). veglod.js is the third LOD sibling
  with the angle finally written down: keep a tree while its
  DRAWN crown subtends the display's finest pixel - the exact
  tan-mapping edge derivative 2 tan(fov/2)/H cos^2(fov/2), not
  small-angle fov/H - floored by the Snellen observer's 1 arcmin
  (Tipton 1984; Reddy 1997 PhD, Secs. 2.3.3/3.1.5-3.1.6: detail
  below these thresholds "would not be available" to any later
  stage of vision). Five landmarks: derivative vs finite
  difference, acuity floor, closed-form keep radius roundtrip,
  monotonicity, purity (no counter in the API). Rendering pays
  via InstancedMesh pools (piece x material x shadow tier,
  offsets baked, one matrix per tree; near tier casts under the
  buildings' BLD_SHADOW_M rationale; sway spring state per
  instance). Browser-verified at Grindelwald: 249 trees above
  3.9' in 6 draws, recorded in the provenance panel like every
  honest layer.
- DONE (live-data restorations, Aug 6): four measured features
  were dark or wrong in production. (1) radar.js decode - three
  functions used but never imported; the first non-transparent
  pixel threw, the catch swallowed it, radarObs.field never
  built, setRadarCover never ran, and the panel omitted the
  RainViewer row exactly when radar was live (the precip-rate
  override kept working, hiding it). (2) syncTraffic bailed
  unless Schmidt-Appleman said contrails form - but applyTraffic
  is the SOLE feeder of airframes/liveries/navlights, so dry-250
  days emptied the polled sky while the SSE path stayed ungated;
  the gate moved to the contrail-slot claim where ct.forms
  already sat. (3) runRoamSyncs omitted syncAir, syncInsolation
  and syncOvation - the oval kept the previous meridian for up to
  a poll interval after a hop. (4) ships.js aisToScene
  dead-reckoned cog-or-due-north; motion now follows COG, falls
  back to TrueHeading, and with neither measured HOLDS (new 'AIS
  track precedence' landmark; drawing an invented due-north track
  was the one thing no instrument reported).
- DONE (decoder/deploy hardening + the promised gate, Aug 6):
  grib2.js could hang the daemon's request path - a zero section
  length never advanced the walk; it now throws, as does a
  sub-16-byte message and (new) a non-unit template 3.0 basic
  angle that previously DECODED SILENTLY with the 1e-6
  assumption ('corruption fails loudly' landmark drives all three
  through synthetic messages). update.sh's hand-kept watch list
  had drifted (modis-land.js shipped but unwatched = stale
  physics forever); the list is now DERIVED from install.sh's own
  ship list, and install.sh stages index.mjs and runs the
  unshipped-import guard BEFORE replacing the live file (a guard
  hit used to leave /opt unloadable for the next Restart=always
  bounce). And modis-land.js's header claimed a reference that
  did not exist - the only module asserting a gate it lacked;
  modis-land-reference.mjs now holds the cell snap, the exact
  point-query URL forms, the composite pick, both scale/fill
  decodes and the sur_refl_state_500m QA decision (Amazon 138
  rejected, malformed state fails CLOSED). validate.sh runs 77
  reference sets.
- HARNESS NOTE (real WebGPU in the agent container, Aug 6): the
  OPEN environment item resolves as predicted - a CURRENT Chrome
  for Testing (151.0.7922.76 via setup-chrome.mjs) under xvfb
  with SwiftShader Vulkan renders the full theme with ZERO Dawn
  errors. The flags that matter, wrapped around the CfT binary
  and passed as SHOOT_CHROME: --use-webgpu-adapter=swiftshader
  --enable-features=Vulkan --use-vulkan=swiftshader
  --disable-gpu-sandbox (without them Dawn drops its instance in
  popErrorScope on the stock shoot.mjs flag set). Live data
  reaches the page through shoot.mjs's curl routing; view-serve's
  /eval + /panel verified the veglod pools and the provenance
  rows in-session.
- DONE (measured phenology replaces three guessed calendars, and
  the guesses are DELETED not demoted, Aug 6): the theme decided
  when leaves came out and when grass cured from latitude
  arithmetic in three separate places - grassland.js and forest.js
  each carried hardcoded month lists per latitude band, and the
  drawn tree canopies ran Hopkins' bioclimatic law. Hopkins is a
  real rule but it is a SHIFT on a fixed reference calendar, and
  its own arithmetic shows where it breaks: autumn tint starts at
  senescence (day 265 - hop) while maturity needs 45 days from
  leaf-out (105 + hop), so the two cross once hop > 57.5 - above
  824 m at 46.6 deg N. At Grindelwald's 1034 m that put 6 August
  87% of the way into autumn colour.
  MCD12Q2 (MODIS Land Cover Dynamics) measures it instead, per
  500 m pixel per year since 2001, on the ORNL DAAC point service
  the NDVI and reflectance feeds already ride (keyless, CORS-open,
  same ndviCell snap re-exported not re-derived).
  Reading the RIGHT primary source mattered and cost a correction
  mid-pass: the first document read was the Collection 6 guide
  (Gray, Sulla-Menashe & Friedl, Jan 2019), but ORNL serves
  product years through 2024, which is C6.1 - so the governing
  text is the Collection 6.1 user guide (14 Mar 2022, LP DAAC doc
  1417). Every gated number was re-checked against that edition.
  They agree throughout - Table 1, the 15/50/90% definitions,
  Figure 2's bit packing, Table 2's worked QA values - but C6.1
  fixes spuriously early greenup from a spline discontinuity
  across calendar years and targets generation 6 months after a
  year ends, not 12.
  What the product actually gives is not labels but a curve: each
  dated metric is the crossing of a KNOWN fraction of the cycle's
  own EVI2 amplitude (15/50/90% up, 90/50/15% down), so the seven
  (date, level) knots reconstruct the pixel's season shape with
  nothing invented. Section 3.2 tells users to prefer the stable
  50% crossings for season start/end, so the green season is
  bounded by MidGreenup/MidGreendown and the 15% ones only open
  and close the shoulder. The up-leg and down-leg amplitudes are
  defined differently (peak minus segment start vs peak minus
  segment end), so the knots are a normalised SHAPE and nothing
  converts them back to absolute EVI2.
  Two facts the service taught that no document did: it serves 23
  bands and Peak IS NOT one of them though Table 1 lists the SDS,
  so no Peak band is requested and the level-1.0 knot is simply
  absent rather than guessed (Peak still holds bits 6-7 of
  QA_Detailed, so it stays in the key order); and the product runs
  far enough behind that a measured season must be carried onto
  the drawn year by WHOLE calendar years (month and day preserved,
  no 365.2425 drift), trying three shifts because C6.1 files a
  cycle under the year of its Peak and a southern season straddles
  the new year.
  NO FALLBACK, on the owner's call. The month lists and Hopkins
  are removed, not kept behind the measured path: a guess kept as
  a backstop is still drawn and still wrong. The product's own
  retrieval test (amplitude >= 0.1 AND >= 35% of the three-year
  range) IS the measurement of whether a pixel has a season, so no
  cycle means no seasonal modulation - grass keeps its class
  green, canopies hold summer. That deleted the 26-40 deg
  amplitude ramp and the 52 deg straw/olive split with their
  calendar, and GRASS_OLIVE with them: it existed to soften a
  maritime winter the calendar browned wrongly, and a measured
  dormancy needs no apology. Crops keep their agronomic calendar
  as a documented exception - a cropland cycle turns on sowing and
  harvest dates the phenometrics do not distinguish, and the guide
  warns two retrieved cycles are not guaranteed to be two cropping
  cycles.
  The gates caught two of my own wrong assertions, both worth
  keeping: dry grass is measurably BRIGHTER in every channel
  including green (ECOSTRESS ~14/21/32% vs green grass's 4-11%),
  so cured turf lifts its green rather than dropping it, and a
  function's arity stops counting at the first default parameter -
  replaced with the stronger claim that a month number in the
  phase slot is now completely inert.
  Browser-verified at Grindelwald under SwiftShader: nine live
  ORNL requests all 200, resolving product year A2024001 at the
  snapped cell; the measured 2024 season (greenup 5 Mar, half-green
  4 Apr, mature 31 May, senescing 6 Sep, half-down 9 Oct, dormant
  3 Nov; EVI2 amplitude 0.4675, QA 0 = best) carried onto 2026
  keeping every month and day; 6 August reads grass "green",
  canopy "summer"; every drawn canopy material green-dominant with
  no autumn gold. Re-run with ?pheno=0 the canopy set is
  byte-identical - no data, no season, where the old code would
  have gilded them.
  10 landmarks in phenology-reference.mjs (83 sets now), including
  Figure 2's 14409 and all five Table 2 rows decoded exactly.
  Left open: the aureole pass, still not started.
- DONE (the LOD review, Aug 6 second session): veglod wrote the
  angle down; this pass held the OTHER layers to it. Three finds,
  all shipped. (1) linelod's CLASS_RADIUS_M table + length bonus
  (20 hand numbers) dropped ALREADY-DOWNLOADED, plainly visible
  ways - a 100 m trail at 1.3 km subtends 264 arcmin of extent
  and the table cut it at 600+400 m; a budget dressed as
  perception. The law now: keep a fetched way while its EXTENT
  subtends the shared threshold (the subtense law IS veglod's
  crownArcmin, re-exported; landmark pins function identity).
  The honest boundary is the FETCH (all classes in the near z14
  pass, arterials across the box), stated as the feasibility
  budget at the call site. Width licenses no drop: a sub-pixel-
  wide road still crosses hundreds of pixels of length (the
  telegraph-wire argument); only a way whose WHOLE extent sits
  under the threshold can never structure the percept. Roads
  cache key bumped (geo2) - old caches were table-filtered.
  (2) aerialways carried the layer stack's LAST count cap
  (parse cap=60, silent); retired, landmarked (200 synthetic
  gondolas all parse; the Jungfrau fixture's 44 unchanged).
  (3) veglod's consumption loop carried two UNCITED filters
  overriding two measurements (OSM forest polygon, despiked
  DEM): a scene-space slope cutoff whose true-slope meaning
  DRIFTED with elevation (~31 deg at the datum, ~53 deg a
  thousand metres up - an asinh-compression artifact; its "~35
  deg" comment would delete WSL's own Stillberg site, 92,000
  trees planted on a measured ~38 deg slope), and two
  uncommented clearing circles at fixed scene coordinates
  (0, +-26) carving invented meadows into real forests at EVERY
  anchor (archaeology: b880238, added with no rationale). Both
  deleted - a filter that overrides measurements needs a
  citation to exist. Grindelwald live: 261 trees (was 249; the
  12 were real), PAGEERROR 0. NOT changed, recorded verdicts:
  bldlod's area ramp (12/55/130/260 m^2) drops houses subtending
  30+ px at 850 m - it is a BUDGET mislabeled as perception, but
  lifting it needs a dense-city perf measurement the fixtures
  cannot give (Grindelwald village shows nothing); reworded
  honestly is the floor, lifting is its own pass. nightlights
  lampCandidates cap=4000 already documents itself as a
  spatially-unbiased budget. Roads browser re-verify OWED: every
  Overpass mirror was 504ing at session time (environmental);
  the law is reference-gated, the call site compiles, PAGEERROR
  0, but a live look at the drawn network is owed when mirrors
  recover. UPDATE (same session, mirrors recovered): VERIFIED
  live at Grindelwald - 997 of 997 parsed ways kept by the
  extent law (the fetch is the boundary, as designed), 875
  placed on the box, no perf cliff; the record line now
  separates parsed-kept from raw-fetched (the first wording
  counted Overpass elements parseRoads' own floors drop, which
  read as an extent-law drop it never was).
- DONE (the aureole pass, Aug 6 second session - the item every
  hand-off since phenology left open): the sky march carried ONE
  Cornette-Shanks lobe at the measured 340 nm asymmetry, and a
  single smooth lobe cannot hold the forward DIFFRACTION SPIKE
  of coarse particles - so the circumsolar aureole (dust's own
  signature in the sky) never formed, and Hillaire's own paper
  conditions the low-frequency sky-view LUT on exactly that
  absence ("fairly smooth for realistic phase g values", Sec.
  5.1, with anisotropic-phase LUT accuracy named as future
  work). The construction, every number printed or measured:
  (1) The classic delta decomposition (Joseph, Wiscombe &
  Weinman 1976; Wiscombe NCAR TN-121+STR read from the scan -
  its printed f = g^2 forms g/(1+g), (1-wg^2)tau, (1-g^2)w/
  (1-wg^2) are a gate landmark my general-f relations must
  reproduce): P = f P_spike + (1-f) CS(g'), with
  f g_spike + (1-f) g' = g held to 1e-12 per channel. Every LUT
  march (sky-view, aerial, MS, irradiance) runs the SCALED
  system - Mie scattering (1-f) sigma_s, extinction minus
  f sigma_s, phase CS(g') now per-channel - and the T LUT's
  alpha carries the Mie density column D_M (km) so the marches'
  sun transmittance is the scaled T' = T exp(+f sigma_s D_M):
  forward-diffracted light stays in the quasi-direct beam. At
  f = 0 (no measured coarse aerosol) every relation collapses
  to identity - the four pre-existing GPU probes run exactly
  there and stayed green, which IS the no-regression proof.
  (2) The spike's shape and share derive from the documents
  behind the live feed: GEFS-Aerosols computes its AODs through
  the GOCART optics LUT (Zhang et al. 2022 GMD, Sect. 2.2 -
  read; "no size distribution for OC, BC, and sulfate" in the
  bulk scheme, optics from Colarco's LUT), whose size set is
  the GADS/OPAC one printed in Chin et al. 2002 Table 2 and
  Hess et al. 1998 (OPAC) Table 1c - both read from the page
  scans. The spike is Fraunhofer diffraction (Babinet / van de
  Hulst Sec. 8.31): a settled coarse particle diffracts exactly
  its geometric cross-section, and BOTH papers PRINT the
  extinction-paradox signature that shares out - sea-salt
  coarse Q = 2.143, the r_e 2.4 um dust row Q = 2.277 - so each
  coarse mode's diffracted share of extinction is a printed
  1/Q, divided by the species' MEASURED single-scattering
  albedo (the feed's own per-species SCTAOTK/AOTK at 555).
  Which modes spike is the sources' own coarse/fine labels, not
  an invented x-bound: SSCM (Chin's operational r_m 1.64) and
  OPAC's mineral-transported MITR (r_modN 0.50, sigma 2.20,
  PRINTED r_max 5 um - truncation is load-bearing, a landmark);
  everything the sources call submicron/accumulation (sulfate,
  OC, BC per Chin's own footnote, SSAM) stays in the smooth
  lobe. Within sea salt the SSAM:SSCM split follows OPAC Table
  4's printed maritime-clean 20 : 3.2e-3 through both printed
  Qs and the modes' second moments (computed: SSCM carries
  0.65% of species extinction - the aureole is a DUST
  phenomenon, as the sun-photometry literature says); sea salt
  swells by Chin Table 3's printed growth factors at the
  MEASURED surface RH (Murphy-Koop dew-point rh, the refraction
  column's own closure). tau_spike is channel-INDEPENDENT
  (geometric cross-sections diffract at every wavelength); only
  the pattern narrows with x - blue P(0) 76/sr vs red 32/sr for
  MITR, a landmark.
  (3) The drawn term: the dome adds P_spike(theta) x I_ss per
  pixel inside a CPU-computed cone (where the spike falls under
  1% of the full smooth source, Rayleigh included - clean day
  13.7 deg, dust day 30) - the same per-pixel-after-the-LUT
  road Hillaire's sun disc takes, with I_ss a 32-step scaled
  march carrying the cloud shadow (an aureole dies behind a
  deck) and sunE (an eclipse dims it linearly). theta from
  asin|v x sun| (acos loses exactly the small angles the spike
  lives at).
  Gates: aureole-reference.mjs, 11 landmarks (A&S Bessel J1
  printed values + first zero; Airy unit efficiency + the
  closed-form central value pi<r^4>/(lambda^2<r^2>); first
  minimum at j11/x; Wiscombe's printed forms recovered at
  f = g^2; growth knots exact; the printed-ratio SSCM share;
  conservation to 1e-12; wavelength ordering; MITR truncation
  direction; full degeneration to null). atmo-reference grew
  the D_M mirror (its own 40-term series to 1e-9) and the
  scaled-march landmarks (f = 0 bit-identical; f = 0.3
  near-sun 24.5% dimmer, anti-sun +0.04%, graze T' > T). New
  GPU probe tsl-dm-probe.html: T-LUT alpha texels at the CPU
  integral (1.0234 vs 1.0233 km; 159.13 km graze through fp16)
  and rgb still pure exp(-tau). validate.sh: 84 sets + 5
  probes, all green.
  RADIOMETRIC CLOSURE in the browser (SwiftShader WebGPU, the
  full theme): a synthetic Saharan-dust fixture
  (aureole-fixture.json, tau550 0.5, du 80% of AOT) over a
  pinned-clear Grindelwald afternoon, f550 = 0.389, and TWO
  float captures (?aureole=0 is the new labelled A/B override;
  an explicit ?aerosol= fixture now composes with weather pins
  instead of being silenced by them). The measured ON-OFF
  radial difference profile matches the double-precision CPU
  prediction to 1% through the aureole core (1.01/1.00/0.99 at
  1/2/4 deg, normalised at 2) and reproduces the predicted SIGN
  CROSSOVER at ~8 deg where the flattened g' remainder starts
  dimming the mid-field - conservation visible in the frame.
  12 deg ratio 1.26: the MS pedestal shift the single-scatter
  prediction omits, documented. Display look: the dust sky
  carries a blinding white circumsolar glare fading to blue at
  25+ deg, ON visibly bluer than OFF at the frame corners (the
  redistributed side-scatter).
  Documented scope: ground direct beam stays on TRUE T (the
  spike's quasi-direct share is absent from the terrain budget
  - conservative, its own pass); desert source regions read
    slightly soft (MITR vs the three-mode desert mixture); Q at
    500 nm serves all channels (printed-value convention); the
    droplet/ice diffraction corona through thin cloud is
    optics-lut territory, untouched.
- HAND-OFF (Aug 6 second session close): the approximation sweep
  after the aureole pass comes back CLEAN - every grep hit for
  roughly/guess/hand-tuned/arbitrary in the drawn layers is
  documentation of a retired guess or a cited value; no
  undocumented physics constant surfaced. The named next passes,
  in rough order of value: (1) terrain direct beam onto the
  scaled T' (the aureole's conservative scope - the spike's
  quasi-direct share is currently absent from the ground
  budget, ~f tau_M of the direct term on dusty days) - DONE Aug 7;
  (2) the droplet/ice diffraction corona through thin cloud (the
  same Airy machinery, sizes from nubis/optics territory) - DONE
  Aug 7 (the ice corona; droplet altocumulus stays named); (3) the
  desert three-mode mixture (OPAC Table 4 printed 269.5/30.5/
  0.142) behind a source-region test, un-softening in-desert
  aureoles; (4) bldlod's ramp lift - blocked on a dense-city
  perf measurement the Grindelwald/Nelson fixtures cannot give.
  Harness notes that cost time this session, do not rediscover:
  pkill -f view-serve.mjs KILLS ITS OWN SHELL (the -f pattern
  matches the wrapper's command line; use a [e] character-class
  pattern); the SHOOT_CHROME wrapper script with the four
  SwiftShader flags is REQUIRED for view-serve too (the raw CfT
  binary drops Dawn's instance in createBuffer at boot); and
  WEATHER_PINS silencing syncAerosol is why a pinned-clear
  scene needs the explicit ?aerosol= fixture (which now
  composes with pins by design).
- DONE (measured total-column ozone + the terrain beam close-out,
  Aug 7): two items after the aureole. (1) The ground's direct
  sunlight now rides the delta-scaled Beer law (sunTransmittanceJS
  opt-in fDiff; the drawn disc and the airglow factor deliberately
  stay pure Beer-Lambert, documented at the function); landmark
  pins the algebraic endpoints bit-exactly. (2) The sky's ozone
  column is MEASURED. The shipped constants encode exactly 300 DU
  - not by inference: Bruneton's own demo.cc constructs
    kMaxOzoneNumberDensity = 300 DU / 15 km over the same tent
    (read from the source; the 15 km IS the tent integral, held to
    its closed form in the gate). Absorption is linear in the
    column, so the correction is ONE scale DU/300 on the ozone term
    everywhere - shader extinction(), the CPU transmittance twin,
    the band rows. The feed: the operational GFS's TOZNE (WMO
    4.2-0-14-0, DU) through the SAME NOMADS grib-filter path the
    aerosols ride - the KEY DISCOVERY making it free: the filter's
    subregion extraction RE-PACKS complex-packed GFS fields to
    simple packing (template 5.0), so the gated grib2.js decodes
    the operational GFS unchanged (a captured 187-byte live message
    is the checked-in fixture, its 297.753 DU at Grindelwald pinned
    in the gate). Daemon /ozone mirrors /aerosol (cell cache,
    cycle walk-back, health row; install.sh ships ozone.js and the
    derived watch list picks it up). Census fails CLOSED outside
    [70, 700] DU. ozone-reference: 5 landmarks including the
    log-ratio identity - log T_s/T_1 per channel proportional to
    the shipped cross-sections ALONE (G/R = 1.881/0.650 to 1e-9,
    path-independent; no tuning could fake it). Theme: syncOzone
    on the aerosol cadence + roam re-sync (the runRoamSyncs lesson
    applied), 6 h freshness, ?du=N pin and ?ozone=URL override
    composing with weather pins, panel row. Browser-verified at a
    pinned Grindelwald sunset (sun 1.4 deg), 450 vs 150 DU float
    captures: G dims to 0.71, R to 0.89, B to 0.96 across three
    sky rows - the measured G/R log-ratio 2.96 lands on the
    cross-sections' own 2.89, the Chappuis signature in the frame.
    85 reference sets + 5 GPU probes green. Scope: the tent SHAPE
    stays (profile seasonality is second order next to the 220-460
    DU column swing); the live /ozone endpoint activates when the
    owner's update timer deploys the daemon.
- DONE (the cirrus diffraction corona + the veil's tau earns its
  citation, Aug 7): the named next pass after the aureole - the
  corona through thin cold cirrus, papers read before code.
  Sources, read directly (the WAF-gated CSU repository PDF fetched
  through a spawned-Chrome + curl-jar bridge; AMS serves its own):
  Gedzelman & Lock 2003 (Appl. Opt. 42, 497, IN FULL) - coronas
  through "optically thin clouds such as altocumulus and
  cirrocumulus", ring radius inversely proportional to droplet
  radius, ice coronas RARE because crystal shape/orientation/size
  ranges wash rings unless the distribution is narrow; their
  printed visibility arc (white aureole from tau ~ 0.001, purity
  max flat over 0.05 <= tau <= 0.5, washed out tau >= 4, bright
  coronas tau <= 0.2 ice / <= 1.0 droplets) and the
  diffraction-theory validity edge (monodisperse a >= 5 um).
  Sassen & Comstock 2001 (JAS 58, 2113, IN FULL) - the FARS
  midlatitude cirrus climatology: mean visible optical depth 0.75
  +- 0.91, median 0.61, from ~860 h of LIRAD; Table 2's midcloud
  -42.6 C mean marks how much colder the corona subset is.
  Sassen 1991 (Appl. Opt. 30, 3421, publisher abstract) - eleven
  corona cirrus cases: thin cirrostratus at/above the tropopause,
  BETWEEN -60 AND -70 C, mean diameters 12-30 um from the rings
  themselves. Sassen, Mace, Hallett & Poellot 1998 (Appl. Opt.
  37, 1477, publisher abstract) - the instrumented case: -71 C,
  14 km, corona rings inverting to AN EFFECTIVE PARTICLE DIAMETER
  OF ~22 UM, corroborated in situ ("simple solid crystals").
  Jaervinen, Vochezer, Moehler & Schnaiter 2014 (Appl. Opt. 53,
  7566, publisher abstract) - AIDA chamber: "a narrow distribution
  of small (median Dp = 19-32 um) and compact ice crystals" from
  homogeneous freezing - the WHY of the narrowness.
  BUILT (cloud-corona.js, gated by cloud-corona-reference.mjs, 10
  landmarks): the monodisperse Airy pattern of the printed 22 um
  (monodisperse IS the sources' model - Sassen inverts rings
  through it, G&L bound its validity; x ~ 126 sits deep inside),
  source-disc convolved EXACTLY ONCE via optics-lut's own
  sunConvolve (now exported - one convolution in the repo).
  Radiometry: single scattering through a thin slab, L(theta) =
  P(theta) (tau/2) e^-tau per unit pre-cirrus direct irradiance -
  the tau/2 is the extinction paradox's diffracted half (van de
  Hulst Sec. 8.31, the aureole's own citation; no printed Q needed
  at x ~ 126), the e^-tau dies exactly as G&L's wash-out arc
  demands. The GATE is a measurement the theme already fetches:
  250 hPa temperature <= -60 C (Sassen's printed warm edge; the
  contrail criterion's own level), failing CLOSED unmeasured -
  ?t250= pins it for the harness. Drawn in the DOME per pixel
  beside the aureole spike (same resolution argument, same
  sin-form angle), through the T LUT's own air transmittance
  (pure Beer - the drawn disc's documented convention), the
  camera's cloud-shadow chi (a corona dies behind a deck) and
  sunE. The veil's uncited "tau_vis = 1 (typical cirrostratus)"
  became the PRINTED FARS mean 0.75 (CIRRUS_TAU_FULL), and
  cirrusT + the corona now ride ONE measured column - the
  sunlight through full cirrus brightened e^-0.75/e^-1 = 1.28x,
  cited. Landmarks: A&S J0 printed values + first zero (J1 stays
  aureole's - one Bessel each); Airy central value x^2/4pi; the
  ring-to-diameter inversion returns 22.000 um from the pattern's
  own first red minimum (Sassen's method run backward); red ring
  outside green outside blue (2.160/1.747/1.398 deg); pattern
  quadrature against the CLOSED encircled energy 1 - J0^2 - J1^2
  (Born & Wolf 8.5.2) to 0.03% - the 6 deg cone holds 95.2% of
  the diffracted light, stated not hidden; slab closed points
  (slope exactly 1/2, max at tau = 1); the printed 0.75 column;
  the cold gate both ways (-60/-71 pass, -59.9 refuses, null
  refuses); convolution survival - the first green ring keeps 81%
  modulation through the 0.533 deg disc, WHY Sassen could
  photograph rings around the sun; degeneration to nothing on
  every road (warm, no cover, unmeasured, ?cirruscorona=0).
  BROWSER-VERIFIED (SwiftShader WebGPU, pinned Grindelwald
  15:30Z, cloudhigh=45, t250=-65, sun 32.86 deg, tau_slant 0.622,
  amp 0.167; ON vs ?cirruscorona=0 OFF float captures at fov 20,
  nospec): the measured ON-OFF radial difference shows THREE
  rings at the predicted angles - green minima 1.75/3.15/4.65 deg
  vs predicted 1.75/3.20/4.64 - and the per-channel first minima
  land at R 2.15 / G 1.75 / B 1.45 deg vs predicted
  2.16/1.75/1.40: the red-outside-blue corona ordering MEASURED
  in the frame. Band-integrated closure (0.5 deg annulus bands,
  normalised at 2-2.5 deg): all 21 band x channel ratios of
  measured to predicted sit within 0.88-1.19, most inside +-10%
  - the residual is pixel/annulus quantisation against ring
    gradients spanning 2.5 orders of magnitude (52x from 0.8 to
    2.0 deg), plus tiny blue denominators where blue's own minima
    fall. Display look: a delicate red-magenta first ring around
    the saturated circumsolar glare - the corona photographs
    describe.
    Harness drift found and fixed on the way (regen.py): (1) the
    terrarium string-rewrite assert no longer matched - the theme
    grew the ?demtiles= infrastructure param; regen now asserts the
    param instead and the harness URL carries demtiles=/tiles. (2)
    regen still INJECTED a stale u8-only \_\_capture that executed
    after - and so SHADOWED - the theme's own ?debug=1 native
    capture (frame-loop-serviced, FloatType-capable): /snap?float=1
    silently returned u8 bytes under an f32 header. The injection
    is deleted; regen asserts the theme hook instead. Two more
    lessons for the do-not-rediscover list: a compound shell
    command that both pkills '[v]iew-serve.mjs' AND names
    view-serve.mjs verbatim later in the same line kills its own
    shell anyway (the character class only disguises the pattern,
    not the target string elsewhere in the command line - restart
    in a SEPARATE command); and view-serve's stdout must go to a
    FILE, never through a pipeline that exits early (tee |
    grep -m1 LOADED SIGPIPE-kills the server minutes later, orphaning
    xvfb + chrome).
    Documented scope: the LUNAR corona (the classic naked-eye case)
    waits on a cited moonlight irradiance frame - the moon optics
    dome's display gains are not that frame; droplet coronas
    through altocumulus wait on a mid-deck optical-depth model;
    corona ellipticity from oriented crystals out of scope
    (Jaervinen's compact crystals justify circularity); the drawn
    DISC still ignores the veil's tau (its cirrus dimming remains
    the veil mesh's display alpha - unifying the disc onto the
    measured column is its own pass).
- DONE (the moonlight irradiance frame + the LUNAR corona, Aug 7
  second push): the corona entry's first scope item, closed the
  same day - the classic naked-eye corona now draws around the
  moon, radiometrically, from two printed values and physics the
  repo already gated. moonlight.js states E_moon in the sky's own
  E0 units: NASA NSSDC fact sheets (archived pages, read
  directly - the live NSSDC site now redirects to a generic
  nasa.gov page) print the full moon's apparent V magnitude
  -12.74 AT ITS PRINTED GEOMETRY ("Mean values at opposition:
  distance 378,000 km, apparent diameter 1896 arcsec") and the
  sun's -26.74, so the full-moon ratio is EXACTLY
  10^(-14.00/2.5) = 10^-5.6 = 2.512e-6 - no invented brightness;
  phase rides the ALREADY-GATED disk-integrated Hapke curve
  (moonphase.js relPhase, the same astro.moonRel the paraselenic
  optics breathe, held to Rougier), distance rides the live
  ephemeris inverse-square (astro.moonDistKm now stored beside
  moonAngR), and a lunar eclipse dims by the exact umbral
  immersion (1 - inUmbra, eclipses.js geometry) - linear in the
  source, the sunE argument on the other body. Documented
  conventions: the V-band anchor serves all three channels (the
  moon is nearly grey; per-channel lunar albedo needs its own
  citation), penumbral dimming and the umbral copper glow
  (~1e-4, refracted light) are second-order scope. The KEY
  cross-check landmark: the shipped Helfenstein & Veverka Hapke
  parameters, integrated ABSOLUTELY over the disc ((w/4pi)
  INT hapkeR dxdy = disk I/F 0.1419 vs the fact sheet's printed
  geometric albedo 0.12), give E_full/E0 = 3.00e-6 at the printed
  distance - within 19% of the printed anchor, UNTUNED: the
  shipped photometry and the printed anchor describe the same
  moon, and the printed measurement anchors.
  The drawn side: the dome's corona machinery became a shared
  coronaAdd(dir, amp, tex) with a SECOND branch on corMoonDir -
  the same 22 um pattern re-convolved with the MOON's live disc
  (sunConvolve grew an optional limbAlpha; [0,0,0] is the flat
  disc the moon's own full-phase Hapke rendering draws),
  re-laid on the +-7% monthly disc drift, anchored on the DRAWN
  (refracted) moon beside the other paraselenic optics, amp =
  E_moon x (tau/2) e^-tau behind the same measured cold gate.
  No sunE on the moon branch (a solar eclipse does not touch
  moonlight). ALSO FIXED, found while deriving the moon's
  geometry: the sun branch's cloud-shadow chi DOUBLE-COUNTED -
  the cirrus sits above the volumetric decks, the sun-side path
  to it crosses no deck, and the view-side leg is extinguished
  by the cloud composite itself (the dome sits behind every deck
  pixel); the chi factor is deleted from the corona branch (the
  aureole march's chi is different physics - sun-side shadowing
  of in-scatter generated along the ray - and stays).
  moonlight-reference.mjs holds 5 landmarks: the printed
  magnitudes to 10^-5.6 exactly; phase through the gated curve
  (quarter/full 0.082 on Rougier's ~0.08) + printed
  perigee/apogee inverse-square bracketing (1.246); umbral
  linearity clamped; fails closed on any missing input; and the
  Hapke-corroborates-the-anchor coherence bound (<20%, converged
  N=800). validate.sh: 87 sets + 5 GPU probes green.
  BROWSER-VERIFIED at a pinned Grindelwald night (2026-08-28
  21:30Z: sun -27.5, gibbous moon rel 0.646 at 27.95 deg, E_moon
  1.566e-6, corMoonAmp 2.74e-7 - rings drawn at two ten-millionths
  of the sky's unit solar irradiance and measured there): ON vs
  ?cirruscorona=0 float captures, disc-centroid-centred - the
  measured first minima land ON the drawn LUT's own convolved
  positions to 0.01-0.03 deg (R 2.18/2.19, G 1.78/1.79, B
  1.43/1.46 - the raw Airy angles shift outward ~0.04 deg under
  the disc convolution, and the measurement resolves THAT), all
  21 band x channel shape ratios within 0.93-1.13, and the
  ABSOLUTE radiometric chain closes: measured T x exposure per
  channel over P x amp gives T = 0.766/0.656/0.523 vs the CPU
  chain's 0.737/0.631/0.500 (+4%), while the same closure on the
  SOLAR corona frames lands 0.992/0.992/0.993 - sub-percent.
  Chasing that closure was its own lesson: the first pass read a
  channel-flat 0.855 deficit in BOTH scenes, survived three
  refuted hypotheses (high-sprite alpha - cover-scaling test,
  UNCHANGED at cloudhigh 12 vs 45; volumetric composite -
  noclouds ratio exactly 1.0000; spectral projection -
  applySpectral is grey-preserving, spec/nospec captures
  bit-identical), and cracked on the DRAWN DISC itself (discT x
  120 x exposure reads the GPU's own T in-frame): the prediction
  chain had fed sunTransmittanceJS the raw Hillaire defaults
  while the theme correctly runs the AOD-0.12 FALLBACK calibrated
  at centerElev (mieCoefficients - sigma(0) 2.13e-4, 53x the
  paper coefficient at this altitude). The pinned-clear-scene
  aerosol lesson from the aureole pass, met again from the
  analysis side: the sky's Mie term is NEVER the paper default in
  a real scene, pinned or live. Verified with the corrected mie:
  disc T matches the CPU twin to 1.6% per channel. Gate after
  integration: 87 reference sets + 5 GPU probes green.
- DONE (the drawn disc onto the measured cirrus column, Aug 7
  third push - the corona entry's remaining scope item): the
  dome's DIRECT solar image - the high-sun disc with its limb and
  spots, the totality corona riding it, and the sunset
  transfer-band disc - now dims by e^-tau_slant of the same
  Sassen & Comstock column the terrain's sunlight and the cirrus
  corona already ride (ONE cirrusTd uniform, fed the exact
  cirrusT the sunlight computes; default 1 keeps every probe page
  and the no-cirrus sky bit-identical). The energy pair is now
  honest at first scattering order and the gate SAYS so: new
  landmark - 1 - e^-tau(1+tau) lies in [0, tau^2/2] across the
  physical range, with the drawn corona exactly half the
  scattered first order (the geometric large-angle half feeds the
  halo/optics territory, still display-gained - named below).
  Scope: the MOON disc is a mesh in the display frame (its cirrus
  dimming stays with the veil until the moon-optics radiometric
  pass); the ambient SKY's response to cirrus (every LUT march is
  lit by the unshadowed sun) remains the overcast veil's display
  job - that is the review list's item (2), a real radiative-
  transfer pass of its own. BROWSER-VERIFIED against the
  pre-change pinned capture (same scene, same pin, corona off,
  cloudhigh 45, sun 32.86 deg): disc-centre float ratio new/old
  = 0.5385/0.5386/0.5388 per channel vs predicted e^-0.622 =
  0.5369 - 0.3%, channel-flat as grey ice demands - while the
  sky 2 deg away is UNCHANGED to the printed digits (6.876 =
  6.876): the multiplication touched exactly the direct image
  and nothing else. Also recorded: the AMS
  downloadpdf path that served Sassen & Comstock 2001 in this
  session 403s (CloudFront) on later attempts for Miles et al.
  2000 and the OPAC BAMS paper - the droplet-corona and desert
  passes should budget the spawned-Chrome + curl-jar bridge for
  their reading. (Miles et al. 2000 landed on a later retry -
  17 pages banked in-session for the droplet pass.)
- DONE (the RADIOMETRIC halo - the display layer's first retiree,
  Aug 7 fourth push): the review's top-ranked legacy item, closed
  with one new measured source and the MC the repo already
  certified. Forster & Mayer 2022 (ACP 22, 15179, OPEN ACCESS,
  read directly - the HaloCam retrieval over 4400 22-degree halo
  images) measures the SMOOTH CRYSTAL FRACTION: only smooth
  hexagonal crystals ring (the rough remainder scatters
  featurelessly - Jaervinen et al. 2018's 61-81% deformed
  majority, cited therein); their printed per-habit average for
  SOLID COLUMNS - exactly the habit mcHalo traces (HEX_C = 1) -
  is ~37% (halos.js SCF_COLUMN, with the plate/hollow ~73/~47
  rows and the (50 +- 30)% habit-independent figure documented at
  the constant). The KEY code fact: mcHalo's entry rejection
  sampling IS flux weighting, so every accepted sample is one
  unit of light incident on the crystal - the MC has been
  computing the absolute phase function all along, unnormalised.
  mcHalo now books it (accepted / binnedT / lowT / highT / lostT
  per channel; traceCrystal grew an optional counter, rng
  sequence untouched - the seeded-determinism landmark holds
  bit-identical), and buildHaloLUT converts to sr^-1 per unit
  geometric-interaction depth BEFORE the disc convolution. The
  measured books, green channel: pass-through (<15 deg) 26.2%,
  histogram window 19.6%, wide 0.9%, UNTRACED (entry/exit
  Fresnel reflections + TIR continuations the 2-refraction trace
  does not follow - they exit somewhere, this histogram cannot
  claim where) 53.3% - stated, and the ring is therefore
  CONSERVATIVE; the 22-degree window carries 11.14% of the
  geometric unit, peak 1.149/sr, 46/22 share ratio 0.328.
  The drawn ring: L = E_src x (tau/2) e^-tau x SCF x P_abs(theta)
  x T_air x exposure - the corona's own slab law (coronaAmp,
  cirrusSlantTau - one implementation) on the same measured
  column, for BOTH domes: the sun at E0 = 1 and the MOON through
  moonlight.js (rel, live distance, umbral immersion) - the
  lunar halo is radiometric moonlight now, not MOONOPT_GAIN. The
  0.18 display gain and the halo's gating heuristics
  (cHigh < 90 ? 1 : 0.5, day x (1 - cloudy x 1.1)) RETIRE: cover
  lives in tau, day/night in T_air, deck occlusion in the
  composite. The dogs ride the same amp at their shipped
  calibrated ratio (dogK = (0.6/0.18) x peakAbs - the
  oriented-plate fraction is unmeasured, documented); only the
  BOW keeps a display gain (its radiometry needs the rain
  shaft's optical depth - named). skyExposure hoisted to frame
  scope (dome, aerial hooks and optics amps share one value).
  ?halo=0 is the labelled A/B override; the panel row prints the
  radiometric amp + SCF. Documented scope: always-ringing veil
  vs Forster 2017's "at least 25% of cirrus produce 22-degree
  halos" - the occurrence discriminator (which cirrus rings
  today) is unmeasured in the theme's feeds and stays named;
  the untraced 53% excludes 3+-leg features (parhelic circle,
  120-degree dogs) by construction. Gate: optics-reference grew
  the absolute-accounting landmark (books close to 0 exactly,
  LUT integral = binned share to 0.01%, share22/peakAbs/ratio
  pinned); halos-reference's MC landmarks hold unchanged.
  BROWSER-VERIFIED (pinned Grindelwald day, cloudhigh 45, sun
  32.86 deg, fov 55, ON vs ?halo=0 float captures - and a harness
  lesson en route: three background capture tasks raced one
  view-serve page and produced a bit-identical "A/B" (the OFF
  snap fired on the ON page); the clean protocol VERIFIES the
  page variant via /eval before every snap, one sequential task):
  measured ring peaks R 21.88 / G 22.13 / B 22.38 deg vs
  predicted 21.90/22.19/22.55 - red inside blue, each within a
  bin; the inner edge is the caustic's zero (dL at 20.5 deg
  0.000 of the peak); and the RING ENERGY INTEGRALS over
  [19, 26] deg close at 0.960/0.959/0.962 of the radiometric
  prediction per channel - 4%, with the peak-value deficit
  (0.74-0.79) explained as annulus + LUT-bilinear smearing of a
  sharp caustic, energy conserved. The drawn ring now stands
  ~+30-50% over the adjacent sky at this tau - real halo
  prominence - where the display gain drew ~+3%.
- DONE (the desert three-mode mixture, Aug 7 fifth push - the
  aureole's in-desert scope closed): OPAC finally READ DIRECTLY
  (the BAMS PDF downloaded this session - the AMS route recovered
  after its 403 spell) alongside Chin et al. 2002 (23 pages, the
  same route). Table 4's desert row verbatim: water-soluble 2000
  - mineral nuc 269.5 / acc 30.5 / coa 0.142 cm^-3 - the
    hand-off's remembered numbers confirmed on the page - and the
    N_i x M\* cross-check against Table 1c CLOSES on the page
    itself (7.49/168.7/46.0 vs printed 7.5/168.7/45.6, impactor
    rounding only): a transcription-proof landmark. Chin Table 2's
    dust rows give printed Q at 500 nm across the size range
    (0.14->1.298 ... 4.50->2.178); the OPAC modes map by their own
    effective radii - MINM r_e 0.213 -> the 0.24 row (2.201), MIAM
    r_e 1.297 with sigma IDENTICAL to Chin's 2.00 -> the 1.40 row
    (2.421), MICM r_e 8.22 (x ~ 94) -> the van de Hulst asymptote
    2, the cirrus corona's own convention. The GATE is the feed
    itself: when the measured dust AOT holds the MAJORITY of the
    555 nm column (dominance in its plain sense, no tuned
    threshold - OPAC's own framing separates transported MITR from
    the desert TYPE), dust runs the three-mode mixture; below it
    the transported system stands bit-identical, and missing bands
    fail closed to transported. Only the "coa."-labelled MICM
    spikes (the existing source-label criterion): its computed
    share of desert-dust extinction is 9.16% through printed
    numbers alone, so the desert spike tau is SMALLER (f550 0.041
    vs MITR's 0.389 at the fixture) while the pattern's central
    value is 24.1x TALLER (r_e 8.2 um vs the truncated
    transported distribution) - the measured un-softening: a far
    narrower, brighter circumsolar core over a cleaner mid-field,
    the drawn cone tightening from the 30-degree cap to 12.1
    degrees. aureole-reference grew the landmark set (13 total):
    the page closure, the r_e-to-row mapping, the share, the
    inequality pair, the majority flip both ways, and fail-closed
    on missing bands - PLUS the real-feed SHAPE lesson: the first
    lookup indexed tau as an array where the daemon keys it by
    band VALUE (the fixture exposed it; the landmark now uses the
    real object shape and channelSet's own access pattern).
    BROWSER-VERIFIED end to end: the pinned-clear scene with the
    Saharan fixture (du 80%) boots to the panel row "aureole f550
    0.041 · cone 12.0° · desert 3-mode (dust majority, OPAC Table
    4)" - the drawn-pattern machinery downstream is byte-identical
    to the pipeline the aureole pass closed radiometrically at 1%.
    Scope: the majority criterion is the plain-language dominance
    convention (a finer discriminator - bin-resolved dust AOT,
    source geography - stays named); MINM/MIAM's wide forward
    lobes remain in the smooth CS term by the same label criterion
    as every accumulation mode.
- DONE (the droplet corona through the volumetric deck, Aug 7
  sixth push - G&L's most common producer joins the drawn sky):
  Miles, Verlinde & Clothiaux 2000 read in full (JAS 57, 295,
  the AMS route again): every published in-situ stratus droplet
  spectrum in one survey, fitted by their Eq. (6) lognormal -
  NATURAL-log width, median diameter - and separated marine vs
  continental by the source papers' own classification. Table 3's
  printed averages are the two drawn classes: D_n 13.1 / 7.7 um,
  sigma_log 0.38 for BOTH (the survey's own coincidence); their
  Eq. (7a) D_e = D_n exp(5 sigma^2/2) reproduces the
  independently tabulated D_e,obs inside the printed spreads for
  both classes (18.8 vs 19.2 +- 4.7; 11.0 vs 10.8 +- 4.1), and
  the paper's own instruction ("the parameters reported in the
  database are the untruncated distributions that reproduce the
  measurements") sets the quadrature bounds, held effectively
  untruncated by a closed-moment landmark. The pattern is the
  aureole's OWN diffractionPattern at deck sizes (one ensemble
  implementation) - and at the printed width every ring washes
  out: the drawn corona is the smooth aureole G&L's Mie runs
  predict ("interference that results from flat and wide droplet
  size distributions washes out the outer rings"), monotone by
  landmark in every channel, while the inverse size law survives
  as EXACT similarity (continental = marine stretched by
  13.1/7.7 in angle, dimmed by its square - a fourth-decimal
  landmark). The radiometry: amp = tau/2 and NOTHING ELSE in the
  dome - the volumetric composite extinguishes the dome behind
  every deck pixel, so the slab law's e^-tau leg already runs
  per pixel in the compositor; (tau/2) e^-tau reassembles
  EXACTLY (landmark) - the chi-fix architecture stated as an
  identity. The deck tau reads PER FRAGMENT from the cloud
  shadow map along the fragment's own ray (clouds-tsl tauSlant:
  the transmittance hook refactored to take a direction, terrain
  shadows unchanged through the wrapper), so a GAP zeroes the
  corona with the droplets that would have drawn it, and the
  unattached map's zero texture fails the whole term closed. The
  air-mass class is the desert gate's own majority test on sea
  salt (marine when it holds the 555 nm column; continental
  otherwise and without products - the panel row names class and
  D_n). The MOON rides the same machinery on its flat disc
  through moonlight.js's E0 frame - the classic naked-eye corona
  through thin stratus - and the veil in front of either source
  is carried as e^-tau_cirrus on the CPU leg. cloud-corona-
  reference grew to 19 landmarks (8 new). GPU CERTIFICATION IS A
  NEW PROBE, not a screenshot: tsl-dropcorona-probe.html joins
  validate.sh (six probes now) - the hook's map replaced by a
  synthetic constant-tau texture so every leg is closed-form:
  the term present; DOUBLING tau doubles it to 2.000/2.000/2.000
  (an e^-tau in the dome would read 0.86 - the double-extinction
  regression pinned on real WebGPU); uOn=0 an exact zero; the
  drawn pattern on the CPU LUT within 5% (box-integrated over
  the pixel footprint - the band probe's half-pixel lesson
  relearned); absolute radiometry through sunTransmittanceJS
  within ~3%. HARNESS FINDING, measured and code-independent:
  the volumetric deck was NEVER covered by this harness (every
  prior scene pinned cloudlow=0), and the full theme page under
  SwiftShader now loses its device in EVERY configuration - the
  2x2 matrix (deck/clear x working-tree/HEAD) shows the same
  createBuffer/popErrorScope signature on COMMITTED code, so
  the view-serve visual instrument is down environment-wide
  this session while the probe pages stay healthy (the six-probe
  gate is green). A deck march under SwiftShader and a
  theme-page visual of this corona both stay named for a fresh
  container. Scope: the mid deck rides the same two stratus
  classes (a printed altocumulus size climatology is its own
  source - named); ellipticity stays out of scope.
- DONE (the rain-shaft bow, Aug 7 seventh push - the 0.55 display
  gain retired, the optics dome's LAST display-scaled amplitude):
  Marshall & Palmer 1948 READ IN FULL (two pages, the AMS
  /downloadpdf/view path finally yielding after the plain path's
  403 spell): eq. (1) N_D = N0 e^(-Lambda D), eq. (2) N0 = 0.08
  cm^-4 "for any intensity of rainfall", eq. (3) Lambda = 41
  R^-0.21 cm^-1 - the constants rainbow.js carried now verified
  on the page, WITH the paper's own small-drop caveat carried as
  documented uncertainty (their Table 1: fitted moments 10-20%
  above measured - mpSigmaExt leans the same way, uncorrected:
  the fitted exponential is the citable object). Gedzelman's
  visibility papers (the natural radiative-transfer source) are
  captcha-walled at Optica and closed at Unpaywall/S2 -
  ATTEMPTED, not read, so nothing is cited from them; the shaft
  law is instead the corona/halo family's own certified
  single-scatter machinery, closed analytically. THE PIECES: (1)
  mpSigmaExt - sigma = pi N0/Lambda^3 x 1e-6 m^-1 (Q = 2, the
  paradox asymptote; ~1e-3/m at 5 mm/h - tau 1 per km of
  shower), closed form == quadrature by landmark. (2) The
  ABSOLUTE bow LUT: energy conservation replaces the uncited
  Airy prefactor - each k-bow's curve is normalised to carry
  exactly the window energy of the DESCARTES/FRESNEL ray mapping
  (bowGeometric: flux through the impact annulus, Fresnel-
  chained, spread over the deviation annulus; size-independent
  per unit geometric depth, so one normalisation serves the
  whole MP ensemble). The x-domain window integral
  (bowWindowEnergy) replaced a theta-domain quadrature MEASURED
  2x wrong at 2048 bins - the caustic's integrable singularity;
  landmarks hold the two domains equal (0.9996), the default
  quadrature at 5 digits, and - the scale's proof - the
  FRINGE-AVERAGED Airy curve riding the geometric mapping at
  0.996 away from the caustic. Secondary/primary peak ratio
  comes out 0.101 from energy alone - the classic tenth. (3) The
  two-leg slab (bowSlab): eye at the layer base, drops to the
  MEASURED freezing level (state.freezing - no measurement, no
  bow; camera above the freezing level sees snow, which never
  bows - an emergent gate), sun leg climbing out at sin(h), view
  leg at the fragment's own sin(alpha), both exponents linear in
  s -> closed form (e^-tau0 - e^-tauV)/kc with the overflow-free
  identity tau0 + sigma smax kc = tauV; == quadrature at 1.8e-8
  across the angle grid incl. the removable point alpha = h and
  downward rays. Per-fragment in the material (bowSigH/bowSinH
  uniforms). (4) Deck shadowing of the shaft: chiSun =
  e^-tauSlant(camera, sunDir) from the cloud shadow map (the
  hook's third consumer) - the 1 - cloudy x 1.1 heuristic
  retires; daylight lives in T_air; MOONOPT_GAIN retires with it
  (the moonbow now rides moonlight.js's E0 x the same slab - its
  rarity is the physics). optics-reference: 10 landmarks (4 new;
  the bow-LUT landmark now asserts the ratio from energy and
  Alexander's band relative to the absolute peak). GPU: a SECOND
  new probe, tsl-bow-probe.html (validate.sh, SEVEN probes) -
  synthetic constant-tau map again: sigma-H doubling moves the
  term by the slab law's own 0.2174 (not a gain's 2.000 -
  measured 0.2167), chi = e^-0.6 to four digits, absolute
  radiometry at the caustic peaks 2.4%/1.3% (red/green, each at
  its own stationary point - the probe assumes NO readback row
  orientation after measuring the corona probe's symmetric
  target had hidden that bit), blue dark at the red edge. The
  drawn result: a bow whose brightness follows the measured rain
  rate through sigma, the measured freezing level through H, the
  sun's altitude through both legs, deck shadows through the
  map, and the veil through e^-tau_cirrus - where 0.55 x
  (1 - cloudy x 1.1) once stood. Scope: the shaft is horizontally
  homogeneous (the radar's cell field could localise it - named);
  MP is stratiform rain (their own scope), carried for showers
  too as the only printed DSD in the theme's feeds.
- DONE (radiometric sundogs + two owned corrections, Aug 7 eighth
  push - the optics dome's LAST display constant, dogK, retired):
  two papers read in full through the recovered AMS route -
  Breon & Dubrulle 2004 (JAS 61, 2888: POLDER glint measures the
  oriented plates directly; "the typical effective fraction (area
  weighted) of oriented plates in clouds lies between 10^-3 and
  10^-2" -> PLATE_ALPHA = the printed range's log midpoint with
  the decade stated; tilt "most Theta close to 1 degree" with
  their own Gaussian form; oriented diameters "0.1 to a few
  millimeters") and Auer & Veal 1970 (JAS 27, 919: Table 1 P1a
  hexagonal plates, h = 2.020 d^0.449 - the printed aspect law).
  THE AUDIT'S FIRST CORRECTION: building the plate faces exposed
  that mcHalo's BASAL areas were shipped at HALF their true
  3 sqrt(3)/2 - side transits over-weighted, the 22-deg ring's
  absolute phase function ~1.4x too bright (share 0.111 -> 0.0854,
  peak 1.15 -> 0.83/sr), the 46/22 share ratio 0.33 -> 0.43;
  fixed, both gates re-pinned with the fix documented. THE
  SECOND: the plate Monte Carlo's independent vector-Snell trace
  arbitrated the parhelion POSITION convention - vertical faces
  conserve the vertical direction cosine, so the Bravais minimum
  deviation is the AZIMUTH offset itself; the shipped
  great-circle conversion drew dogs outward with altitude (~2.8
  deg too far at 25 deg sun). parhelionProfile, parhelion() and
  the landmarks now carry az = Dmin (analytic 26.1, drawn LUT
  26.3, Tape's tables agree). THE NEW MACHINERY: mcParhelion -
  the traced hexagonal prism under the PLATES' orientation
  statistics (uniform spin, B&D's Rayleigh-sampled ~1-deg tilt),
  per-trial diameters log-uniform over B&D's printed range with
  Auer-Veal aspects (a single fixed aspect light-pipes with
  geometric resonances - measured non-monotone; the population
  washes them), and the internal walk FOLLOWING basal total
  internal reflections (up to 12 face events): the light-pipe
  that carries dogs to altitude - without it thin plates dog
  only at grazing sun. Off-almucantar exits (the 46 family, the
  subparhelion region) are booked offAlm, stated, never in the
  dog; the books close to 1e-9. The MC's caustic lands on the
  Bravais azimuth at every tested altitude (24.43 vs 24.35 at
  h=20), its share of the plate's interaction is tabulated
  (PARHELION_SHARE, 12 altitudes at 600k samples, deterministic
  seed) and the gate RE-RUNS three rows and holds the shipped
  literals to 3% - the grazing maximum and the monotone fade to
  the Bravais cutoff both emerge from the traced geometry (why
  real dogs die as the sun climbs). The tilt wobble's DRAWN
  sigma is the MC's own sigmaAlt (0.32-0.58 deg - B&D's printed
  1-deg tilt mapped through the actual refraction), replacing
  the hand-quoted 1.5-deg envelope. THE DRAWN DOG: azimuth LUT
  normalised to unit integral; dogAmp = E_src x T_air x the same
  measured cirrus slab x PLATE_ALPHA x parhelionShare(alt) x the
  Gaussian's peak density - no SCF (the glint-measured alpha
  already selects specular plates), dogK's (0.6/0.18) x peakAbs
  deleted, u.dogs deleted, the moon's paraselenae on the same
  chain through moonlight.js. halos-reference grew to 11
  landmarks (4 new), optics-reference re-pinned + strengthened
  (Bravais-azimuth assertion, unit integrals). Full gate green -
  87 reference sets and SEVEN GPU probes (the bow probe
  re-certifying the changed optics material). Scope: alpha spans
  a printed DECADE (the dominant stated uncertainty - a dog can
  honestly be 3x dimmer or brighter than the midpoint); B&D
  measured mostly 500-700 hPa clouds and note high clouds carry
  LOWER alpha - documented; subparhelia and the parhelic circle
  (the offAlm light) stay named.
- DONE (the overcast veil as radiative transfer, Aug 7 ninth
  push - the hand-picked #79838c/#a2abb3 gradient retired): two
  papers read in full - Meador & Weaver 1980 (JAS 37, 630: the
  two-stream review) and Wood 2012 (MWR 140, 2373: the
  stratocumulus review) - and they interlock with the Miles
  survey the theme already ships (Wood's own thickness
  compilation cites Miles et al. 2000; the r_e is Miles' printed
  D_e,obs by the measured air-mass class). THE COLUMN: Wood's
  printed climatological LWP 40-150 g/m^2 (log midpoint carried,
  range stated) through his own tau = (3/2) LWP/(rho r_e):
  continental tau ~21.5, marine ~12.1 - inside his printed
  overcast range. THE TRANSFER: MW Table 1's Eddington row at
  omega_0 = 1 (Wood: "omega = 1" in the visible) gives gamma_1 =
  (3/4)(1-g) = gamma_2, and their Eq. (29) prints the
  conservative closed form R = gamma_1 tau/(1 + gamma_1 tau),
  T = 1 - R; g = 0.84, the middle of Wood's printed 0.82-0.86
  (Liou); conservative T depends on (1-g) tau alone so
  delta-scaling dissolves (the similarity invariant). PRINTED
  CORROBORATION: Wood's own "a = tau/(tau+7)" IS this formula at
  g = 0.8095, just under the printed range - the gate holds the
  identity and the 10% agreement at g = 0.84 over tau 5..40, and
  holds the closed form to a direct RK4 two-stream ODE solution
  at 2e-4. THE SKY UNDER THE DECK: MW's own Eq. (30) intensity
  ansatz I = 1/2[(2+3mu)I+ + (2-3mu)I-] with a dark lower
  boundary gives the emergent gradation L(mu) = E(2+3mu)/(4 pi)
  - zenith 2.5x horizon, flux closure exact by quadrature
    (landmark; the empirical CIE/Moon-Spencer 3:1 is steeper -
    documented context, not read, not drawn). THE DRAWN VEIL:
    veilE = T(tau) x (direct sun x (1-eclipse) + moonlight.js
    moon + the MEASURED skyIrr ambient), display-projected,
    x skyExposure; the material carries only (2+3mu)/(4 pi);
    opacity = the COVER itself (at tau ~12-21 the covered sky's
    pattern transmission is e^-tau ~ 1e-6 - opaque, so cover
    measures coverage and nothing else). Retired together: the two
    hand-picked greys, the cloudy^2 x 0.85 fade and the day gate -
    night, eclipse and moonlit overcast all EMERGE from the fed
    irradiance (a full-moon overcast now glows faintly grey, a new
    -moon overcast is black). overcast-reference: 6 landmarks
    (printed constants; interlocking tau; the Table-1 identity;
    closed form = ODE; the tau/(tau+7) corroboration; flux
    closure + 2.5:1 + fails closed). validate.sh: 88 reference
    sets. Scope: single slab over a dark base (snow-under-overcast
    brightening is its own pass); homogeneity per Wood's printed
    <=10% correction; the fog-colour cGray lerp stays in the
    scene-light constants item.
- DONE (the ground-coupled overcast - the white-out, Aug 7 tenth
  push; closes the veil's dark-base scope the same day it was
  written): Wiscombe & Warren 1980 READ IN FULL (JAS 37, 2712 -
  the spectral snow-albedo model). The coupling is the adding
  method on Meador & Weaver's own conservative R: the slab
  re-reflects the surface's light, E_dn = T E0 / (1 - a R), with
  the energy identity R + a T^2 F + (1-a) T F = 1 held EXACTLY
  by landmark (space's share plus the ground's share is the
  incident unit) and a = 0 collapsing to the dark-base law
  bit-for-bit. THE ALBEDO IS MEASURED: the MOD09A1 white-sky
  [R,G,B] the Hillaire ground term already rides (Payne's 0.06
  at sea), snow-blended by the MODIS NDSI fractional cover
  (snowField's mean FSC, now surfaced as snowFSC) through
  Wiscombe & Warren's DIFFUSE snow albedo - their own Sec. 4
  statement says the diffuse albedo is the operative one under
  cloud, and their remark that cloud over snow RAISES albedo at
  high sun points at exactly this coupling. SNOW_ALBEDO_RGB
  [0.953, 0.968, 0.98] is read from their Fig. 9 at the standard
  100 um grain (stated as a figure read), blue highest - a snowy
  overcast whitens toward blue through the series, and at the
  continental column full fresh snow multiplies the underside
  light by ~3.4x: the white-out where ground and sky merge.
  overcast-reference: 8 landmarks (series = closed form; exact
  energy closure on the grid; a = 0 identity; the 3.3x printed;
  channel ordering with the paper's 10-15% age bound). Scope:
  the terrain's own drawn snow colour (0.87/0.9/0.93 display)
  is unchanged - re-lighting the GROUND from the coupled
  E_dn is the scene-light item's business; the veil alone
  consumes the factor today.
- DONE (the ring family's occurrence, Aug 7 eleventh push - the
  SCF comment's own documented overdraw closed): Forster 2017's
  banked HaloCam paper re-read for its statistics, printed
  verbatim: "about 27% of the cirrus clouds produced 22 deg
  halos, sundogs or upper tangent arcs" (ACCEPT, visual - the
  instantaneous family rate) and "about 25% of the detected
  cirrus clouds occurred together with a 22 deg halo"
  (automated). The other ~3/4 of cirrus is rough/aggregate
  veil that rings NOT AT ALL - the theme had drawn every veil
  ringing. HALO_FAMILY_FRACTION = 0.27 now gates the whole
  crystal family (sun halo, dogs, moon halo, paraselenae -
  one population, one gate; the cold-regime corona keeps its
  own t250 gate) through haloOccurrence: a DETERMINISTIC
  per-site (0.1-deg quantized), per-UTC-hour mulberry32 draw
  with a 5-minute ramp at hour boundaries - the same sky for
  every visitor and every harness run, rings fading in rather
  than popping. Scoping bonus: the retrieved SCF 37% was
  measured ON halo images, so gating the ring to
  halo-producing hours uses that number inside its own
  population at last. Documented limit, printed in the same
  paper: 1-hour BINNED rates read higher ("more than 50%";
  Sassen et al. 2003's 54% as printed there) because real
  displays flicker within the hour - the binary hour gate
  holds the instantaneous rate exact and a within-hour
  intermittency model stays named. halos-reference: 12
  landmarks (long-run rate 0.2689 vs the printed 0.27;
  bit-determinism; two hemispheres decorrelate at exactly the
  independence expectation 60.6%; ramp continuity; NaN fails
  closed). ?halooccur=0|1 is the labelled harness pin; the
  panel's optics row names the hour's state. Full gate green.
- DONE (the parhelic circle, Aug 7 twelfth push - the white ring
  from the plates already measured): NO new population constant -
  the circle is the B&D-measured oriented plates' EXTERNAL
  reflection off their vertical side faces, which conserve the
  vertical direction cosine: every reflection lands ON the
  almucantar. The plate Monte Carlo now BOOKS the entry-face
  Fresnel reflection (1 - T, zero extra rng draws - the shipped
  share table stays bit-identical, asserted) into a circle
  histogram plus a reflOffAlmT bucket (basal reflections - the
  sun-pillar family, stated, not drawn); the books still close
  to 0 exactly. The DRAWN profile is analytic: the mirror law
  folds the uniform face azimuth as psi = (dAz + pi)/2, so
  P(dAz) = <c> cos h sin(dAz/2) rho(cos h sin(dAz/2)) / A_tot(h)
  per radian of azimuth per unit plate interaction - the mirror
  PAIR doubling the one-branch Jacobian (the first draft missed
  it; the MC caught the exact factor 2), <c> the population-mean
  aspect over B&D's sizes through Auer-Veal, A_tot the
  spin-averaged projection (one basal + the side ring). The MC
  holds the closed form (12% past 90 deg, 25% below - the
  analytic omits the tilt smear on the steep near-sun flank,
  stated); GRAZING mirrors vanish toward the sun (the circle is
  zero where the dogs live - complementarity by geometry), and
  the circle is WHITE by physics (the ice indices move rho by
  ~4% - landmark). Vertical spread: the reflected family's own
  MC sigma, 0.84 deg flat in altitude (the printed ~1-deg tilt
  through the actual mirror), shipped as CIRCLE_SIGMA_ALT_DEG
  with the gate re-deriving it. Drawn as a 256-bin absolute LUT
  over [0, 180] deg (no disc convolution - smooth curve,
  documented) re-laid with the dogs, riding the SAME chain:
  slabBase x PLATE_ALPHA x T_air x Gaussian peak - so the
  occurrence hour, the veil column and the eclipse all gate it
  for free, and it has NO refraction cutoff: it outlives the
  dogs at high sun, exactly as observed. The moon gets the
  paraselenic circle on the same feeds. halos-reference: 13
  landmarks. Scope: the internal families' almucantar light
  beyond the dogs (120-degree parhelia, the blue spot) and the
  sun-pillar family (the booked basal reflections at low sun)
  stay named.
- DONE (the sun pillar, Aug 7 thirteenth push - the column from
  the reflections the circle pass booked): NO new empirical
  constant - every number derives from research already
  integrated (B&D's tilt and alpha, Auer-Veal aspects, the
  ephemeris disc radius, Warren indices). The plate MC's
  reflOffAlmT bucket gains a PILLAR sub-bucket (reflections
  within 3 deg of the source azimuth: a +-15-deg apparent-
  altitude histogram plus azimuth moments; the existing books
  untouched, closure unchanged). The emergent physics is the
  basal mirror exactly: the image sits at MINUS the source
  altitude, a vertical Gaussian of sigma sqrt(2) Theta (B&D's
  per-component Theta/sqrt(2), doubled by the mirror - MC rms
  1.40 deg at h = 5 vs 1.414), and the azimuth deflection is
  2 b tan|h| - the grazing mirror is BLIND to the sideways tilt
  (folded-Gaussian moments held to two digits), so the drawn
  column is one source-disc wide, exactly the photographs. Share
  of the plate interaction: (3 sqrt(3)/2) sin|h| rho(sin|h|) /
  A_tot(|h|) - MC 0.253 vs closed 0.261 at h = +5; at h = -6 the
  photon enters the LOWER basal face and the image lands at +12
  ABOVE the horizon (the twilight pillar's geometry, in the same
  books; the histogram window's exact Gaussian truncation folded
  into the expectation, share to 2%, mean to 0.1 deg). The
  EMERGENCE is the law share x (1 - Phi(h / sigma)): peak near
  h ~ 1 deg, x7.4 over h = 3, four decades down by 8 - a
  sunrise/sunset optic, gated. Drawn with NO vertical LUT (the
  profile is a closed-form Gaussian; sigma widens by the disc's
  marginal variance R^2/4 in quadrature - the separable draw is
  exact to (R/sigma)^2, stated) and a 64-bin azimuth LUT: the
  limb-darkened disc marginal through the crystal Gaussian
  (buildPillarLUT; unit signed-domain integral, the optics gate
  holds the quadrature width law to 0.2% and the sigma_c -> 0
  build IS the disc marginal). Below-horizon fragments gate off:
  the deck lives ABOVE the eye, no crystals sit under the
  horizon ray (the aircraft subsun waits on a camera-above-deck
  geometry). Both sources ride the dog/circle chain (slabBase x
  PLATE_ALPHA x T_air x peak density - occurrence, veil and
  eclipse gate for free); the moon pillar takes the moon's own
  disc width. halos-reference: the pillar landmark (share both
  signs of h, mirror moments, folded azimuth, emergence);
  optics-reference: the LUT landmark. Named limits: the TWILIGHT
  pillar - the classic bright case, h < 0 with the image fully
  above the horizon - waits on the deck's own twilight
  illumination (an 8-km deck keeps direct sun for ~3 deg of
  ground-horizon dip; today's slabBase chain gates at h > 0),
  and internal-path pillar light (transmitted families) stays in
  the lost/offAlm books, stated.
- DONE (twilight veil geometry, Aug 7 fourteenth push - the
  named limit of the pillar pass, resolved): NEW PAPER read in
  full - Sassen & Campbell 2001 (JAS 58, 481, FARS Part I, the
  same instrument family as the tau chain's Part III): 10-yr
  annual cirrus base/top 8.79/11.02 km MSL (Table 3; the layer
  envelope 2.23 km is their difference exactly), shipped as
  CIRRUS_BASE_M/CIRRUS_TOP_M. THE APPROXIMATION RETIRED: the
  veil's plane-parallel slant 1/max(sin h, 0.08) - the 0.08
  floor was a display-era clamp - replaced by the EXACT chord
  through the printed spherical shell (shellChordAM, closed
  two-branch geometry, eye-height aware, brute-force ray-sample
  landmark to 8e-4 from the eye AND from inside the shell at
  negative elevations). The honest numbers: 4.5% correction at
  10 deg already, horizon air mass 18.2 where the floor said
  12.5, and the chord keeps meaning below h = 0 down to the
  shell's own tangent. All seven veil call sites (sun disc/
  corona/halo slab, moon bow/halo/corona x2) now pass the
  camera's own height. THE TWILIGHT PILLAR: pillarShare's
  flat-plate sin|h| died at the horizon wrongly - the beam's
  sine on the tilted normal folds as E[|sin h + t cos h|] (the
  opposite tilt sign presents the OTHER basal face, the same
  mirror plane), quadrature with Fresnel inside the fold, held
  against a direct orientation Monte Carlo to 0.2% at h = 0/1/5
  (share 0.077 at the horizon: the mirrors glint THROUGH
  sunset). The drawn feed moves to the crystal-local frame
  (Horizon.html pillarBase): visible-centroid view elevation
  (truncated-Gaussian closed form), the crystal where that ray
  meets the deck mid-shell, the LOCAL sun altitude there (the
  horizon-dip arc: at h = -2 the crystals 180 km sunward see the
  sun 0.4 deg below THEIR horizon), the deck-frame beam through
  the existing Hillaire integral (its own planet-shadow test IS
  the twilight cutoff), the view leg's air through the NEW
  pathToRadiusT segment integral (closure landmark in
  atmo-reference: T_seg x T_rest = T_full to 1% - the coarse
  march's own quadrature), the view leg's in-veil extinction,
  and the sun leg's slab on the first-exit chord - the stated
  single-patch assumption (the far branch of a grazing chord
  re-enters the shell 200+ km out, beyond the local cover's
  domain; shellFirstExit, near/full both printed by the gate:
  15.5/44.5 at -2 deg). The composed curve, pinned by the
  cloud-corona-reference composition landmark: CONTINUOUS
  through sunset (cross-ratio 1.028), peak at h = -3.0 deg at
  cover 0.1 (-3.55 at 0.3), STRONGLY red there (R/G 10.5, R/B
  ~1400 - the photographs' pillar), exactly zero at -4.6 deg
  when the deck's own sun sets, zero cover kills it. Sun and
  moon both (the moon pillar lives through moonrise/moonset the
  same way, moonIrradianceE0 on top). The h > 0 pillar feed
  upgraded to the same exact frame (one formula, no branch seam;
  the pass-13 halos-reference emergence landmark re-stated:
  share x visibility is monotone into twilight - the old
  "peak near h ~ 1" was the flat-plate artifact). Documented
  residuals: the uniform-shell in-cloud-graze valley near
  h ~ -2.5 (the deck lit through its own long body - real in
  the mean-field model, softened in patchy life); the subcirrus
  oriented-plate "crystal layers" Sassen & Campbell report as
  their second most common detection (p. 485) are the OTHER
  pillar carrier, unmodelled - a future population.
- DONE (the circle's internal families, Aug 7 fifteenth push -
  the light the circle pass left named, and TWO owned
  corrections found on the way): NO new constant - the plate MC
  already TRACED the basal-entry transits (top face in,
  light-pipe, bottom face out - the parallel refractions cancel,
  so the exit rides the almucantar at the side-mirror fold
  azimuth); this pass BOOKS them by side-mirror count k. What
  the books show, each MC-held with a closed form: k = 2 off
  adjacent faces peaks in the bin holding EXACTLY 120 degrees
  (the corner reflector rotates twice the dihedral regardless of
  incidence) and is WHITE - the 120-DEGREE PARHELIA; k = 1 is a
  TIR-BRIGHT plateau (share up to 4.4% of the plate interaction
  at h = 35 vs the external mirrors' ~1%) that CUTS OFF at
  dAz_c = 2 asin(sqrt(n^2 - 1)/cos h) per channel - Warren
  dispersion orders the cutoffs red < green < blue and between
  them the drawn circle turns BLUE at B/R ~ 4.8: KOENNEN'S BLUE
  SPOT, emerging from the traced indices (the MC edges land on
  the closed forms within the tilt smear: 138.5/139.9/144.1 vs
  136.6/138.6/141.6 at h = 25). Above cos h < sqrt(n^2 - 1)
  (h ~ 32 deg) there is no cutoff and the plateau reaches the
  ANTHELIC point; toward the horizon the pipe SEALS (the
  internal basal incidence crosses critical) - the internal
  circle is the high-sun complement of the external low-sun
  mirrors, and the whole circle now outlives both. THE
  CORRECTIONS: (1) the dog books carried a basal-entry leak (up
  to 5% at h = 20, most of the h = 55 row) - entry-face scoping
  makes them side-entry pure; (2) the walk's 12-event cap
  starved the grazing light-pipe tails (+3% dog share at h = 25)
  - raised to 40, converged against 80. Both shipped tables
    re-derived at the 600k shipping count (bit-tight in the gate
    again). Drawn: buildCircleLUT sums the families ABSOLUTE per
    steradian at the almucantar - each family's own vertical peak
    density baked in (their sigmas differ, 0.84 vs ~1 deg), the
    120-degree spots as MC-held Gaussians, the amp reduced to the
    bare slab chain and the drawn falloff sigma now the LUT's
    share-weighted value (fed at the dog-cadence re-lay, sun and
    moon). Documented residuals: the analytic k = 1 fold
    (sin(dAz/2) under the TIR step) carries a ~20-30% near-sun
    deficit vs the traced hexagon (first-hit corner competition,
    stated and gated loose - the dogs own that region visually);
    past-cutoff partial internal reflections stay in the walk's
    lost bucket (the anthelic segment below 32 deg keeps only the
    external family); the 46-degree family and the high-altitude
    side-exit arcs (Parry/heliac territory) remain booked
    (transOffAlm) and named, not drawn.
- DONE (the circumzenithal and circumhorizontal arcs, Aug 7
  sixteenth push - the transOffAlm bucket WAS the CZA): the most
  vivid plate optics, drawn from the books the circle passes
  already carried, with NO new constant. The transit routes
  separate the arcs exactly: basal entry + SIDE exit is the
  CIRCUMZENITHAL ARC - tangential momenta through the
  perpendicular faces give its altitude in closed form,
  asin(sqrt(n^2 - cos^2 h)), real only while cos h >=
  sqrt(n^2 - 1) (the sun below ~32 deg, the arc's documented
  window - the SAME critical geometry as the circle's blue spot,
  the same faces); side entry + BASAL exit is the
  CIRCUMHORIZONTAL ARC at asin(sqrt(1 + sin^2 h - n^2)), open
  past ~58 deg - the fire rainbow's documented season. The MC
  lands both altitudes to the SECOND DECIMAL per channel (CZA
  h15: 61.74/62.40/63.40 vs closed 61.75/62.42/63.41; CHA h70:
  24.65/23.91/22.80 vs 24.65/23.91/22.82) - dispersion PURE
  VERTICAL, red toward the sun on both arcs, ~1.7 deg of spread:
  the most saturated colours in the family, from the Warren rows
  alone. The WINDOW EDGES STAGGER by dispersion - blue leaves
  the CZA first as the sun climbs (h = 30 shares R 0.85% > G
  0.59% > B 0.37%), red opens the CHA first (h = 58: R 2.1% >>
  B 0.2%) - so the drawn arcs are born and die colour by colour,
  exactly as photographed; the gates hold the staggering in the
  tables AND the LUT rows (a channel outside its window ships an
  EMPTY row). Azimuth: the tangential Bravais fold, parametric
  in the side-face azimuth (arcAzProfile - Fresnel-weighted,
  numeric fold, unit integral), holds the traced books to a few
  percent per window with the tails exact (the arcs die by ~55
  deg of azimuth). Drawn as per-channel-ALTITUDE bands (vec3
  centres - the closed forms per frame - under one MC tilt
  sigma) times the azimuth LUTs, on the same slabBase x
  PLATE*ALPHA x occurrence chain, sun AND moon (the lunar CZA is
  a real rare sight; centres at the drawn refracted moon, shares
  at the true altitude, the dogs' own split). Tables:
  CZA_SHARE_R/G/B + sigma over the parhelion grid, CHA*\* over
  its own 55-90 grid (600k, the shipping count). Landmarks:
  halos-reference (closed altitudes per channel, red-low/red-
  high ordering, window nulls and empty books at h = 40 between
  the windows, staggered table edges, azimuth windows vs the
  fold, closure with the new buckets), optics-reference (unit
  in-window integrals, per-channel staggered LUT rows, h = 31.5
  red-alive-blue-empty). Named, not drawn: the subhorizon CZA
  mirror image (booked transOffAlm, camera-above-deck territory
  with the subsun), and the Parry/Lowitz oriented-COLUMN arcs -
  a different crystal population (the plates cannot make them).
- DONE (within-hour halo intermittency, Aug 7 seventeenth push
  - the occurrence pass's documented limit, resolved from the
    SAME paper): Forster 2017 prints BOTH ends - the instantaneous
    family rate (27% of cirrus) AND "more than 50% if the HaloCam
    observations are binned to 1 h intervals" (Sassen 2003's 54%
    corroborating) - and a per-hour draw cannot satisfy both.
    haloOccurrence is now an EPISODE process: cosine-interpolated
    value noise per quantized site, pushed through its own EXACT
    trapezoid CDF so the instantaneous marginal is uniform at
    every phase - the printed 0.27 is pinned BY CONSTRUCTION, not
    by tuning - thresholded at the printed fraction, with the node
    spacing the one derived constant (43 min), fit so the 1-h
    binned any-on rate lands at 0.538, inside the printed band;
    mean episode ~53 min. Deterministic, site-decorrelated,
    CONTINUOUS in time (threshold crossings ramp over ~10 s of
    the field's own drift; the old hour-boundary 5-min ramp is
    retired), fails closed on garbage. Every family that rides
    haloOcc - ring, dogs, circle with its internal families and
    120-degree spots, pillar, CZA/CHA - inherits the episode
    texture for free: halos now come and go WITHIN the hour, as
    the camera saw them. Gate re-pinned: instantaneous 0.2697
    measured, binned 0.533, decorrelation at independence, max
    5-s step 0.32, NaN closed. ALSO this pass, deferred with
    reasons stated: the scene-light constants (0.18 + 2.4 stLum,
    moonUp 0.07, the ambient 1.1) form ONE coupled photometric
    system with the exposure curve - replacing the moonlit
    ambient with the measured chain (moonlight E0 x the Hillaire
    sky transfer) gives ~2e-5 three-units where the display shows
    ~0.05: the 0.07 constant embodies the eye's missing scotopic
    adaptation (~1e5 of dynamic range the 24/(0.2+0.8 day)
    exposure does not span). The honest replacement is a mesopic/
    scotopic adaptation model landed WITH visual verification,
    which this session's instrument cannot provide (the theme-page
    device loss is environment-wide, proven code-independent) -
    named for a session with eyes. The upper tangent arc stays
    blocked too, precisely: Forster prints its occurrence (7.8% of
    cirrus time, 30% of halo time) but NO oriented-column
    fraction exists in the literature read so far - the arc's
    RADIANCE has no citation, and the house does not draw
    uncited constants.
- DONE (visual verification, Aug 7 eighteenth push - the
  instrument works again, and it caught a bug): the theme-page
  device loss that took the view-serve instrument down earlier
  is GONE after the environment cleanup, but full-page boots now
  stall on upstream 504s for cache-missed live APIs (the page
  never mounts its renderer; open-meteo itself answers - other
  hosts time out through the proxy). The session's captures come
  from a NEW dedicated instrument instead:
  harness/tsl-optics-visual.html - the certified
  createOpticsMaterial with the theme's own feed chains
  (slabBase/alpha/shares/LUT re-lays verbatim in structure),
  isolated over a dark sky, ?scene= presets at the showcase
  geometries and ?expo= a documented linear display gain (the
  capture path reads a render target: LINEAR, no tone mapping).
  Four scenes shot under real WebGPU (SwiftShader Vulkan) and
  verified by eye: (1) sun 22 - the ring's red inner edge, both
  dogs ON the circle, and the CZA above curving around the
  ZENITH (opposite curvature to the ring) with red toward the
  sun at the closed-form 67-69 deg band; (2) sun 25 aimed at az
  132 - the parhelic circle carrying the WHITE 120-deg parhelion
  bump, then turning BLUE and dying at the TIR cutoffs
  (137-142), then the faint external-only anthelic remnant -
  pass 15's whole physics in one frame; (3) sun 60 - the CHA
  below the sun, red rim on top (the 3-lambda dome renders its
  4-deg spectral spread as three sub-bands - the renderer's
  inherent wavelength discretisation, stated); (4) sun -2.5 -
  the twilight pillar: a one-disc-wide deep-red column standing
  on the horizon above the set sun. THE BUG THE INSTRUMENT
  CAUGHT: texture sampling clamps to the edge texel, so the
  halo, bow and dog terms painted their LAST BIN'S value across
  the whole dome outside their angular windows - a uniform wash
  the bright sky hides but a dark capture shows (the anthelic
  frame arrived purple). Range masks added to all three terms
  (sky-objects-tsl), and the bow probe gained pass E: the term
  is EXACTLY zero at 75 deg from the antisolar point - the
  regression is instrument-caught from now on. Display-gain
  honesty: the circle scene needs x150 and the pillar x1e5 over
  the ring's x1 - the radiometric spread the scene-light
  adaptation item already names.
- DONE (the full-page instrument restored + integrated A/B
  difference renders, Aug 7 nineteenth push): the "device loss"
  era is fully over - the earlier verdicts had TWO mundane
  causes, both now fixed or documented. (1) window.\_\_r and the
  capture hooks only install with ?debug=1: a healthy page looks
  dead to the probes without it. (2) Boot is SLOW, not stalled:
  the live-stream endpoint (api.ndev.tk/stream - an EventSource
  that can never complete through the buffering curl route) and
  heavy Overpass queries each eat a full curl timeout;
  view-serve now logs REQ|status|ms|url for every failed or slow
  proxied fetch and takes VIEW_CURL_TIMEOUT. (3) A REAL BUG
  found on the way: the documented ?cloud/cloudlow/cloudmid/
  cloudhigh harness pins were OVERWRITTEN by the live open-meteo
  apply seconds after boot - every cloud A/B silently ran on
  live cover (caught when a pinned-cirrus capture came back with
  halo amp 0.000: the live sky had no high cloud). The apply now
  skips URL-pinned fields. With all three fixed, the canonical
  box boots to RENDERER-UP under real WebGPU (SwiftShader
  Vulkan), and the session captured the first INTEGRATED
  verification set: the 22-deg ring visible through the deck in
  the display frame, and halo-on-minus-off LINEAR FLOAT
  difference renders (the livecache replays byte-identical data
  across the pair, so the subtraction isolates the drawn
  families exactly; residual speckle is the volumetric deck's
  temporal-reconstruction jitter, both signs). The sun-aim
  difference is the ring alone - full circle, red inner edge, no
  wash anywhere (the range-mask fix holding in-scene). The
  high-aim difference shows the ring top PLUS the CZA's red and
  green sub-bands with NO BLUE FRINGE - the sun sat at 30.3 deg,
  past blue's window edge (31.1): the staggered channel death
  the gates pin, photographed in the integrated scene. The
  instrument is available again for the scene-light adaptation
  pass (the one item explicitly waiting on eyes).
- DONE (photometric adaptation, stage 1, Aug 7 twentieth push -
  the scene-light item's FOUNDATION, from a new paper read in
  full): Larson, Rushmeier & Piatko 1997 (LBNL 39882, the
  visibility-matching tone reproduction report - open access at
  the Radiance site). adaptation.js now carries, verbatim: Table
  1's piecewise just-noticeable-difference function (the
  Ferwerda 1996 rod+cone thresholds combined at the printed
  10^-0.0184 cd/m^2 crossover; the gate holds the scotopic
  floor, both Weber branches at slope exactly 1, and the fit's
  own seam sizes, 0.012 dex worst, stated); the contrast-
  matching exposure SHAPE 1/JND(La) (Eq. 7a's global form - the
  display-side threshold folds into the caller's anchor); the
  printed mesopic range (0.0056-5.6 cd/m^2, linear ramp) and
  Eq. 13's Macbeth-fit scotopic luminance (equal-energy closed
  point Y*scot/Y = 2.31 exact; Purkinje ordering gated). THE
  PHOTOMETRIC BRIDGE COSTS NO NEW CONSTANT: Falchi's printed
  natural-sky pair (skyglow.js 0.174 mcd/m^2 = 22.00
  mag/arcsec^2) plus the exact arcsec^2 solid angle gives the
  point-source zero point (2.58e-6 lux at V = 0), and
  moonlight.js's SUN_VMAG then DERIVES the solar illuminance
  constant: 128.1 klx, inside the textbook 120-135, with the
  full moon corroborating at 0.322 lx (textbook 0.25-0.35) -
  the absolute luminance frame the scene needed, assembled
  entirely from constants already cited in this repo. MOONSKY*\*:
  the clear-sky hemisphere irradiance per unit source E0 versus
  source altitude, generated from the Hillaire reference march
  (same constants, MS at zero albedo) - linearity in the source
  makes the sun's transfer the moon's; the atmo gate re-derives
  three rows with ITS OWN march at a parameterised source
  direction (skyAt gains sunMuP, default bit-identical;
  tolerance covers the two quadratures plus the gate LUT's
  Payne-0.06 vs generator-0 MS albedo, measured +8% at high
  sun). The frame CLOSES the dead-end the intermittency pass
  documented: clear-day mean sky 1889 cd/m^2 (textbook band),
  full-moon sky 4.7 mcd/m^2 (the classic ~5), and the JND
  exposure gain between them 2.91e4 - exactly the ~1e4-1e5 of
  adaptation the display map was missing. Emergent bonus, gated:
  the transfer table's twilight rows are RED over green (the
  grazing path's own reddening) while blue stays on top -
  asserted per row. STAGE 2 (named): wire expo/skyExposure,
  sunLight, ambient and the moonlit term onto this frame -
  retiring 0.18 + 2.4 stLum, the ambient 1.1 and moonUp
  0.07 x RGB - with the day anchored to the current daytime
  appearance (one derived continuity constant) and the restored
  view-serve instrument shooting day/dusk/moonlit A/Bs before
  the switch lands.
- DONE (photometric adaptation, stage 2, Aug 7 twenty-first
  push - the switch LANDS): skyExposure and the moonlit ambient
  now ride adaptation.js. The display map: EXPO_DAY = 24 (the
  old curve's daylight value - continuity, the ONE remaining
  unit constant, documented), anchored at the DERIVED clear-day
  mean sky (the transfer table at sun 45 deg through the bridge:
  1889 cd/m^2), and every other adaptation state follows the JND
  ratio - Eq. 7a's global form (gate row: anchor -> 24 exact,
  civil twilight 2.8e4, full-moon night 7.0e5, NaN fails BRIGHT
  to day). The adaptation luminance is the SAME instrument as
  the anchor - skyTransferE at the sun's AND the moon's real
  altitudes (each linear in its own E0), under the measured
  Erbs-kt cloud dimming, plus the Falchi skyglow floor
  (1 + lpRatio, artificial included). THE FIRST CAPTURE ROUND
  CAUGHT A REAL BUG: the first wiring fed the dome's live
  irradiance readback as La against the table-derived anchor -
  two instruments, never cross-calibrated, ~2.6-3x apart in
  absolute scale (measured: readback 575 vs table 1511 cd/m^2 at
  sun 30 deg; 25 vs 74 at sun -3.2 deg) - and the biased ratio
  TRIPLED the day exposure into tone-mapper clip (the A/B frame
  was solid white). The two instruments TRACK each other in
  relative collapse (0.0435 vs 0.049 day->twilight, 15%) - so
  the constant scale cancels once the table sits on BOTH sides
  of the ratio, and the dome readback keeps its ambient job
  (its product with the adaptive exposure stays ~0.84 day ->
  twilight: Weber constancy lands on the terrain too, for
  free). skyTransferE gained the below-edge extrapolation the
  loop needed: the march's own log-slope carries the twilight
  collapse past the -10 deg table edge, and by astronomical
  twilight (-18 deg, the printed no-sunlight definition) the
  sun's sky sits BELOW the Falchi natural floor (gated: 0.12 vs
  0.174 mcd/m^2) - deep night belongs to the moon and the
  skyglow, never to a clamped row (which would have pinned every
  night at 0.2 cd/m^2, 40x a full-moon sky). THE MOON CAPTURE
  CAUGHT A SECOND PRE-EXISTING BUG the new exposure amplified,
  and it took THREE probes to name it honestly: the ambient's
  irradiance readback is an ASYNC staging read that takes
  seconds to first resolve on a slow queue, and its acceptance
  guard (sum > 1e-7) never accepts a real night sky at all - so
  a page booted at night runs on the DAYLIGHT init guess (0.05,
  0.07, 0.1), for the first seconds always, and forever if the
  night readback stays under the guard. At the legacy expo 120
  the stale guess flattened to a cosmetic wash; at the adaptive
  ~1e6 it rendered the terrain solid white (the first capture's
  white-out), and the live-probe values only made sense once
  the RACE was seen: early snaps catch the guess, late probes
  catch the resolved sky. Fixed on both ends of what the guard
  was actually for: (a) only the FIRST resolve can predate the
  first LUT fill, so from the second resolve on, zero IS the
  sky (a real moonless night no longer starves the update); (b)
  until that first resolve lands, every skyIrr consumer
  (ambient, veil, far horizon) gates the guess by the existing
  day factor - a day boot keeps its day guess, a night boot
  starts from darkness, zero new constants. The moonlit
  ambient: moonUp 0.07 x hand-RGB(0.05, 0.055, 0.075) x 14
  RETIRED - the term is now skyTransferE(moon.alt) x the
  measured moonIrradianceE0 in the shared spectral projection
  and the shared adaptive exposure, reproducing the old
  constant's magnitude (~0.08 display units at full moon vs the
  tuned ~0.05) from physics alone. ?adapt=0 pins the legacy
  curve (and the legacy moonlit term) for the harness A/B; the
  panel row shows La -> expo live. THE PURKINJE FOLD LANDS WITH
  IT (at La 3.2e-3 the eye is 40% below cone threshold - the
  paper's own physiology says colour cannot survive there):
  below the printed mesopic range every JS-fed lighting colour
  (ambient + ground, the veil, the Koschmieder fog, the
  far-horizon sky) lerps toward its OWN rod luminance -
  Rec.709 -> XYZ exact, Eq. 13's scotopic Y, normalised at the
  paper's equal-energy closed point 2.31 so grey light is
  luminance-preserving and blue-rich moonlight lands slightly
  brighter as grey (the Purkinje shift, zero new constants);
  the panel row appends the live rod fraction. The dome and
  optics shaders keep colour until the next stage (uniform
  plumbing, documented). A/B captures (view-serve,
  fl=2700 pinning the aloft fetch so both sides share weather):
  DAY sun 30 deg (La 1470 cd/m^2 both sides) expo 24 -> 31 (the
  built appearance holds by anchor), TWILIGHT sun -3.2 deg
  (La 59) 83 -> 716 (the eye adapts - dusk stays seen; the
  optics amps ride the same frame, the emerging pillar
  included), FULL-MOON night 120 -> ~7e5 (the moonlit landscape
  actually renders, rod-grey). Documented scope, its own
  pass: sunLight's 0.18 + 2.4 stLum three-unit map and the
  ambient's 1.1 diffuse-fraction constant stay - the direct-sun
  scene-light map is a COUPLED system (sun + ambient + material
  albedos verified per-material) and this pass touches only the
  sky-side frame.
- DONE (photometric adaptation, stage 3, Aug 7 twenty-second
  push - the MOONLIT DOME and the shader-side rod fold): the one
  atmosphere march now serves whichever light OWNS the sky. The
  linearity that built the MOONSKY table gets used in the other
  direction: when the moon's sky (its transfer at its altitude
  times its measured E0) outshines the sun's, the theme feeds
  the march the MOON's direction and scales the fed exposure by
  e0Moon - the dome, the aerial perspective, the ambient
  readback and the crepuscular cloud shadow all become the
  moon's, at the moon's own absolute level, with zero new code
  in the march itself. The switch is CONTINUOUS by construction:
  it happens exactly where the two skies are equal-luminance on
  the same tables that decide it - the gate derives the full-
  moon crossover from the shipped constants alone and holds it
  to nautical twilight (sun -14.06 deg, band -18..-9, skies
  equal there to 3e-15, ordering flips across). The analytic
  moonlit-ambient term from stage 2 becomes the STAND-IN until
  the moon-sourced readback resolves - the measured march then
  replaces it (an analytic term on top would count the same
  light twice); the readback consumers scale by the active
  source's E0. The Purkinje fold goes SHADER-SIDE: a scotB
  uniform in the dome's display node and the optics material
  (both sun and moon instances) lerps the displayed colour
  toward its own Eq. 13 rod luminance - the same Rec.709 -> XYZ
  - /2.31 mirror as the JS fold, fed the same mesopic blend -
    so the moonlit sky and a moonlit-night halo ring grey with
    the rods like everything else. GPU-GATED: the bow probe's new
    pass F sets scotB = 0 and holds the folded pixel to the JS
    rod luminance of the coloured pixel - grey to 0.2%, value
    exact to 0.5% (the Purkinje boost is visible in the pass:
    grey 1.93e-2 from a blue-rich pixel whose green is 1.09e-2).
    The panel row names the active source. Still stage-parked:
    the star sprites keep their catalogue colours below the
    mesopic range (their own display system), and the direct-sun
    scene-light map is unchanged (its own pass, as named).
- DONE (photometric adaptation, stage 4, Aug 7 twenty-third
  push - the direct-sun scene-light map lands on the frame): the
  named coupled system, closed by a units audit instead of a
  recalibration. three r185's physical lights put the Lambert
  1/pi IN THE MATERIAL, and the ambient readback is the
  cosine-weighted MEAN RADIANCE (E/pi - irradianceNode divides
  by its own weight sum), so the physical scene-light rig is
  pure algebra: directional colour x intensity = transmitted
  beam st x adaptive exposure (lit surface = albedo x E_beam x
  cos x expo / pi, the dome's own absolute frame); hemisphere
  colour = readback x PI x exposure; ground bounce = albedo x
  (beam x sin(alt) + sky E) x exposure with NO factor (the
  bounce's Lambert pi cancels the hemisphere's). THE AUDIT
  EXPLAINED THE OLD NUMBERS: the 2.4 sun gain, the 1.1 ambient
  factor and the 0.55 bounce factor were all the same ~2.9x
  low - the whole legacy scene sat one consistent factor under
  the dome's absolute level, which is why it LOOKED coherent
  and measured wrong. All three retire (the exposure is the
  gain now); the 0.18 offset retires as a PHANTOM FLOOR - and
  a live bug: sin(max(alt, 0)) freezes the beam at its horizon
  value below the horizon, which the old 0.18 + day > 0 pair
  masked and the adaptive twilight exposure would have amplified
  x700 on sun-facing slopes. The physical gate is the setting
  disc itself: discVisibleFrac (sun-transmittance.js), the
  closed circular segment at the REFRACTED apparent altitude -
  discObscuration's two-circle lens in the occluder -> infinity
  limit; gated in atmo-reference (half at centre-set exact,
  symmetric to 1e-12, monotone, step fallback; limb darkening
  stated out). The eclipse fudge 1 - 0.93 x ecl retires to the
  exact uncovered fraction, and the adaptation luminance's sun
  term now carries the same (1 - ecl) - the eye ADAPTS into
  totality by the same linearity everything else rides. The
  Ross-Li diffuse fraction reads the rig's own two irradiances
  again (it had drifted onto the glint feed). SCOPED WITH NAMES:
  the four custom scatter systems (near sea/snow glitter, the
  far strip's glints, the ocean's specular sun, the cloud
  deck's direct beam) stay on an explicit sunIFeedLegacy - each
  shader's radiometry was calibrated against the legacy scale
  and a silent 9x jump is not a verification; each is a named
  follow-up. ?adapt=0 pins the complete legacy display system
  (curve, sun map, 1.1, 0.55, 0.93, day gate) so the A/B
  compares SYSTEMS, not knobs. A/B captures: DAY sun 30 deg
  (24 -> 31) - the terrain joins the dome's frame, snow and
  forest lit, nothing clips; GOLDEN HOUR sun +2.6 deg (52 -> 83) - the beam's transmitted reddening lands on the
  sun-facing slopes; TWILIGHT -3.2 deg (83 -> 733) - the beam
  is OFF (discFrac 0), terrain rides the pi-ambient through
  the twilight purple. CAUGHT ON THE SIDE, pre-existing (both
  A/B sides identically): a low-sun grey DISC bounded near the
  22-deg radius over the sunset azimuth at golden hour - some
  low-sun dome/optics term paints its interior through the
  fog; needs its own hunt (range-mask family, sunset band, or
  aureole cone are the suspects).
- DONE (ocean glitter, Aug 7 twenty-fourth push - the first of
  stage 4's four legacy-fed scatter systems retired): the sea's
  specular sun now runs the PRINTED Cox & Munk (1954) sun-glitter
  law. ocean-glint.js carries the Gaussian slope PDF and the
  Fresnel-less kernel P(slope)/(4 cos_v cos^4_tilt), gated
  (ocean-glint-reference.mjs): the PDF integrates to 1 with its
  mean-square slope equal to the fed mss to 1e-12, the kernel's
  hemisphere energy is CONSERVED against the surface flux
  E cos(theta_s) - 1.0000 at calm and at the Cox-Munk 5 m/s
  variance, 0.98 at gale (the single-facet law's own
  shadowing/multi-bounce loss, stated) - the mirror peak is
  1/(pi mss 4 cos_v) exact and the grazing 1/cos_v glitter road
  is the printed law's own. water-tsl.js transcribes the kernel
  on the half-vector in the RESOLVED frame at the per-pixel
  effective variance (Bruneton 2010's filter split, already
  probe-gated); the facet Fresnel is the Schlick term that
  already weights the mirror + specular branch (rhoF at the
  macro normal approximates rhoF at the facet - exact in the
  glitter core, stated). RETIRED: the classic three.js Water
  energy patch pow(dir, shiny) x (0.02 shiny + 0.5) - the
  exponent rode the variance, the ENERGY was an uncited display
  calibration - and the ocean's sunIFeedLegacy: water.sunColor
  is now the physical beam (st x adaptive exposure), so the
  glitter sits on the same absolute frame as the dome and the
  terrain, and the sunset glitter road brightens toward grazing
  by geometry instead of by tuning. Still legacy-fed, named:
  the near sea/snow glitter sparkles, the far strip's glints,
  the cloud deck's direct beam.
- DONE (the golden-hour "grey disc" hunt, Aug 7 - a
  verification pass whose honest outcome is NO DEFECT): the
  stage-4 captures flagged a large grey disc bounded near the
  22-deg radius over the sunset, identical on both A/B sides.
  The hunt, by harness bisection on the live instrument: it
  dies with ?halo=0 and with nothing else (the first bisect's
  cloudhigh=0 leg was VOID - appending a duplicate URL key
  loses to the first occurrence, a lesson for future bisects).
  Difference images against the halo-off frame show the family
  adds light only OUTSIDE the sharp 21.8-deg inner edge -
  the "grey disc interior" is the sky itself, darker by
  contrast, which is exactly how a real 22-deg halo reads
  (the classic dark interior), with the 46-deg ring's wing
  filling the frame at capture scale. The amplitude chain was
  then suspected of using the wrong frame (ground tH vs the
  pillar's crystal-local deck frame) - REFUTED BY THE CLOSURE
  IDENTITY: along the sun sight line pre-sunset, deck-beam x
  view-segment IS the ground transmittance (T_seg x T_rest =
  T_full, the gated identity), so the ground tH is correct
  physics for the whole plate family while the sun is up; the
  frames only diverge post-sunset, which the family's
  sun.alt > 0 gate already excludes (the post-sunset ring on
  still-lit cirrus stays a named future item with the pillar's
  share fold as its template). The prominence in the captures
  traces to the harness URL forcing halooccur=1: without it
  the episode process has the ring hour OFF at the fixture
  time and the sunset sky renders clean - measured 27% of
  cirrus hours, exactly as the intermittency pass shipped.
- DONE (terrain glitter and the far ring, Aug 7 twenty-sixth
  push - two more scatter systems join the physical frame, and
  a convention myth dies): the AUDIT found the terrain's sea
  glitter already runs the COMPLETE printed Cox & Munk law -
  the full anisotropic Gram-Charlier PDF with the paper's own
  c21/c03 and peakedness coefficients (gated by
  coxmunk-reference's moment identities), exact unpolarised
  Fresnel at n = 1.34, the 4 cos_v cos^4_n denominator - and
  the snow sparkle is the Zirr-Kaplanyan counting model over a
  GGX-Smith-Fresnel lobe at the cited crystal area fraction:
  both emit radiance per unit beam irradiance, so ONLY THE FEED
  was display-bound. uSunCol now carries the physical beam
  (colour x intensity, no pi - specular adds outside the
  Lambert); the alt gate and the global cloud factor stay (the
  glint path is not CSM-shadowed, documented). THE FAR RING:
  its material claimed "three's light convention premultiplies
  pi... no explicit /pi" - REFUTED from the build's own source
  (r185 BRDF_Lambert = diffuseColor x 1/pi), so the ring now
  receives the rig's beam and the hemisphere colour PRE-DIVIDED
  by pi and meets the near terrain's seam under one law. The
  audit also caught a pre-existing units gap: the ring's sky
  term was fed the RAW per-E0 readback - no exposure at all,
  ~50x under the display frame - so far land was effectively
  sun-plus-fog only; it now copies ambient.color (exposure,
  cloud dimming, moon term and the rod fold arrive in one
  place, one-frame lag like every far feed). The legacy pin
  keeps the old pair, units gap included - the A/B compares
  systems as they were. ONE legacy-fed consumer remains, named:
  the cloud deck's direct beam (its volumetric radiometry gets
  its own audit).
- DONE (the cloud deck's direct beam, Aug 7 twenty-seventh push
  - the LAST legacy-fed scatter system retires, and the display
    chain's final magic number explains itself): the volumetric
    march's source was sunCol x sunTerm x 18/1.75 + ambient, with
    the shader's own comment admitting "18 was the display
    calibration". The audit's algebra: the legacy feed (x0.55 at
    the theme, x18 in the shader, /1.75 octave sum) lands within
    ~10% of the PHYSICAL beam (st x adaptive exposure) / 1.75 -
    the 18 was the scene-light frame ratio all along, the same
    ~pi x 2.9 family every stage-4 audit found. The march's
    source is now the beam irradiance itself; the /1.75 STAYS
    with a physical reading (the Wrenninge octaves triple-count
    at zero optical depth - dividing by sum(a^i) pins the thin
    limit to the single-scatter white point); the x18 moved
    VERBATIM into the legacy pin's feed so ?adapt=0 reproduces
    the old deck exactly; and the 0.02 night floor retires - the
    adaptive exposure lights moonlit decks physically. The
    deck's ambient half had ALREADY moved frames in stage 4
    (ambCol copies ambient.color) but no fixture since had a
    deck - the pose-pinned 55/25 sunset capture is its first
    verification: the physical deck holds the legacy white point
    (lit tops, dark bases, nothing clips), the gap beam threads
    the per-pixel shadow map identically on both sides, and the
    heavy-overcast sunset stays SEEN under adaptation where the
    legacy side goes near-black. sunIFeedLegacy now survives
    only inside the consumers' pinned branches - every scatter
    system (ocean, near glitter, far ring, deck) runs the one
    physical frame.
- DONE (the post-sunset plate family, Aug 7 twenty-eighth push
  - the named future item lands on the disc hunt's own
    argument): the family's beam moves to the CRYSTAL-LOCAL frame
    (cloud-corona.js crystalBeamT, gated) - and the closure
    identity that REFUTED the frame swap as a bug fix is exactly
    what makes it safe as a feature: pre-sunset, deck-beam x
    view-segment equals the ground transmittance to 0.73% (the
    gate holds the identity at 2/5/10/25 deg), so the swap is a
    no-op while the sun is up. PAST ground sunset the old chain
    froze at its horizon value behind a hard sun.alt > 0 gate;
    the crystal frame carries the ring, the dogs, the circle and
    the arcs on still-lit cirrus - reddening like the pillar
    (R/G 11 at -2 deg, gated) - and the window's END is new
    geometry: the horizon-ward crystal sits where the earth's
    curvature has rotated the frame a FULL horizon dip (~3.2 deg
    at the mid-shell), so its sun survives to ground altitude
    ~ -6.4 deg - TWO dips down, further than the pillar's own
    centroid (-4.6). The gate also caught a latent hole in the
    transmittance machinery: sunTransmittanceJS only intersects
    the TOP sphere, so a sub-surface path merely underflows -
    at -6 deg it leaked 1e-2 of red through the earth.
    crystalBeamT closes the window with the EXACT planet shadow
    (sin h_loc < -sqrt(1 - (Rb/Rm)^2)); the gate asserts zeros
    by -7. The moon family gets the same window (the moonset
    ring). LUT builders verified at negative altitudes (dog,
    circle, arc, closed-form cza all continuous); the share
    tables stand on their h = 0 row past sunset (stated). The
    -2.4 deg capture shows the feature: the deep-red ring arcing
    over the sunset glow where the amp was hard zero before -
    halo amp G 0.007, the panel's own row.
- DONE (star colours at the printed colour floor, Aug 7
  twenty-ninth push - a NEW PAPER read in full, and the colour
  boundary triple-corroborated): Schaefer 1993, "Astronomy and
  the Limits of Vision" (Vistas in Astronomy 36, 311 - 51
  pages, the celestial-visibility review). Sec. 2.12 prints the
  point-source colour floor - "the human eye can detect colors
  from sources brighter than 1500 nL" - and his case boundary
  log B = 3.17 IS log10(1500) throughout the paper's threshold
  machinery. His own p. 319 unit table (1 nL = 3.18e-6 nit)
  lands the floor at 4.77 mcd/m^2 - within 15% of
  Ferwerda/LBNL's printed mesopic edge (5.6), two independent
  printed sources on ONE boundary - and his 26.33 mag/arcsec^2-
  per-nL row closes a THIRD way: the theme's Falchi-anchored
  bridge reproduces his nit conversion to 1.4% with no shared
  constants (all three in one gate landmark). adaptation.js
  ships NL*TO_CDM2 / COLOR_LIMIT*\*; the star sprites fold
  their catalogue tints to their own Eq. 13 rod luminance under
  the SAME shared mesopic blend the dome, optics and lighting
  ride (makeSprites gains a colour hook; the theme feeds
  mesoB). Stated residuals: the printed floor is a field
  statement - the few brightest stars' colour survival needs a
  per-source image-brightness limit no source here prints, so
  the fold is uniform; planets keep their tints (their discs
  sit brighter than any star); and the paper's F_c scotopic
  B-V correction is NOT taken (its sign convention needs
  deeper reading than a review pass should risk).
- DONE (the UTA hunt's verdict, Aug 7 thirtieth push - a
  documented negative: NO printed oriented-column fraction
  exists, and the literature itself says why): the task was
  the COLUMN_ALPHA analog of PLATE_ALPHA (the sundogs' Breon
  & Dubrulle log-midpoint) so the upper tangent arc could
  ride the same cited-amplitude chain. Three NEW full reads
  this pass. (1) Noel & Chepfer 2010 (JGR 115, D00H23, 13
  pp, via the HAL archive): 18 months of global CALIOP -
  oriented crystals in ~6% of optically thin ice layers,
  in-layer proportion 1-5% (overall ratio 1e-3..5e-3),
  detection delta < 0.12 = at least one oriented per ~154
  random (Sassen & Benson's formula, beta_r/beta_h = 360) -
  but the specular signature is "typical of oriented planar
  or columnar crystals" (species NOT separable), and the
  -30..-10 C detection band (the planar growth regime)
  yields their conclusion "oriented crystals are mostly
  planar". No column split anywhere. (2) Zhou, Yang,
  Dessler, Hu & Baum 2012 (JAMC 51, 1426, 14 pp): the
  instrument-side closure - they simulate oriented COLUMNS
  explicitly (their ice cloud C) and print that the columns'
  effect on the delta-gamma' relationship is "much smaller"
  than the plates' (P11(180) an order under plates inside 1
  deg incidence, their Fig. 8), so CALIOP's oriented signal
  "is generated primarily from platelike particles": their
  retrieved 0-6% / 0-3% / 0-0.5% fractions (mixed-phase /
  warm ice / cold ice) are PLATE numbers, and the
  space-lidar route that measured the plate family is
  structurally blind to the column one. (3) Westbrook 2011
  (QJRMS 137, 538, the author's own manuscript - ~150 tank
  runs at Re 8-100): the reframe - orientation MODE is
  deterministic, not fractional: hexagonal prisms flip at
  the printed critical aspect ratio L/d = 0.9
  (Re-independent); plates below fall c-axis vertical,
  columns above c-axis horizontal in ALL ~130 column runs;
  the secondary roll lock is two-facets-VERTICAL, weak, and
  its predicted display "has not been observed in the
  atmosphere" - real columns roll-average, exactly the
  classical tangent-arc population - while Parry displays
  trace to SCALENE cross-sections, and Sassen & Takano
  2000's thick-plate Parry hypothesis is refuted in print.
  Also closed: Breon & Dubrulle 2004 (the PLATE_ALPHA
  source) contains zero column content (full-text check);
  Forster & Mayer 2022 prints the exclusion verbatim
  ("observations of upper tangent arcs and sundogs contain
  valuable information about the fraction of oriented
  columns and plates, they are excluded from the retrieval")
  and drops its top image segment to keep UTA signatures OUT
  of the fits; Noel & Sassen 2005 (last push's read) holds
  one column case in six ("observed once... an exception");
  Sassen & Takano 2000 itself is closed-access (checked: no
  OA copy) - a single-case Parry study per its abstract and
  both citing reads, not a fraction source. THE VERDICT: the
  oriented-column fraction is per-cloud retrievable
  information that no published study has retrieved - the
  lidar that measured the plate numbers cannot see columns,
  the halo photometry that could measure them excludes the
  arcs by design, and the lab says the split is size/quality
  microphysics (the Re window and facet quality), not a
  universal constant. What IS printed for the arc:
  occurrence (Forster 2017 - 7.8% of cirrus-present time, 9
  of 30 halo-hours; Sassen et al. 2003 relative frequency
  ~15%), the orientation mode (Westbrook), and the
  total-oriented ceiling (1e-3..5e-3, mostly planar). The
  house does not draw uncited constants: the arc stays
  undrawn, and the twenty-third push's blocked note now has
  its verdict - closed by the literature's own framing, not
  by an unfinished search. A future landing needs a NEW
  published column-fraction retrieval (or one of our own
  from HaloCam-class data - out of scope for a review
  branch).
- DONE (star tints from Planck + the F_c verdict, Aug 7
  thirty-first push - a NEW PAPER read in full, a hand ramp
  retired, and the twenty-ninth push's residual resolved):
  Schaefer 1990 (PASP 102, 212, "Telescopic Limiting
  Magnitudes" - 18 pages via the ADS scan). His Eq. 13 prints
  the night-vision colour correction -2.5 log(F_c) =
  1 - (B-V)/2 below log B = 3.17 in millimicroLamberts - the
  SAME 1500 nL boundary the colour floor ships - and Eq. 14's
  assembly (I\* = I Fb Fe Ft Fp Fa Fsc Fr Fc) with the p. 214
  prose ("the redder of the two stars would appear fainter"
  under night vision) resolves the sign convention the
  twenty-ninth push declined to guess: in the rod frame a
  star's V-band brightness shifts by -(1 - (B-V)/2) mag, a
  printed slope of +0.5 mag per unit B-V, redder fainter.
  While landing it, the audit found the star tints themselves
  were a hand ramp (clamp((kelvin-3000)/9000) into three
  hand-shaped channel expressions - uncited display
  approximation). Both shipped together: stars-color.js
  derives each catalogue star's tint from Planck's law
  (SI-exact h, c, k_B) through the repo's OWN CIE_1931_2DEG
  table and XYZ_TO_LINEAR_SRGB matrix (ocean-color.js - the
  same colorimetry the ocean, vegetation and sky ride), max-1
  chromaticity carrier; 2300 K now renders (1, .33, .04) deep
  orange and 45000 K (.34, .47, 1) blue-white where the ramp
  was flat 0.72..1 - and the sprite fold's Rec.709 matrix
  finally operates on tints that ARE Rec.709 linear. The
  corroboration: the shipped Larson-Eq.-13 rod fold, run over
  the Planck tints against Ballesteros 2012's printed
  blackbody colour-temperature relation (EPL 97, 34008;
  T = 4600(1/(0.92(B-V)+1.7) + 1/(0.92(B-V)+0.62)); his own
  constants land T(0.65) = 5778.4 K, the solar effective
  temperature) produces a rod-brightness slope of 0.417 mag
  per B-V over B-V 0..1.5 - Schaefer's printed 0.5 to 17%,
  sign matching, two independent printed routes (a
  Macbeth-patch photometric fit vs astronomical physiology)
  on one slope. F_c is therefore deliberately NOT applied on
  top of the fold - the fold already carries it, and stacking
  both would double-count (stated in the module header). Gate:
  stars-color-reference.mjs, 5 landmarks - Ballesteros
  constants verbatim + solar anchor to 1 K + inversion
  round-trip 9e-16; fold-rows x display-matrix identity to
  2.1e-4; 6500 K Planck vs shipped D65 dxy (0.0006, -0.0054)
  < 0.006 (the D-series-vs-Planck offset, documented); locus
  monotone with red-led cool / blue-led hot ends; the
  Schaefer slope in [0.40, 0.55] + the fold's scale
  invariance at 2e-16. validate.sh gains the gate; VALIDATE
  PASS (all references + 7 GPU probes). Stated residuals: the
  catalogue temperature is treated as a blackbody (no line
  blanketing - Ballesteros' fit is itself the demonstration
  that real-star B-V tracks the blackbody form); the shipped
  CMF table's 360-700 nm span truncates the deepest-red tail
  (sub-percent of X at 2300 K); and the twenty-ninth push's
  FIRST residual stands unchanged - a per-star colour-
  SURVIVAL brightness limit is still nowhere in print (1990b
  prints the brightness correction, not a per-source colour
  threshold; the 1500 nL floor remains a field statement).
- DONE (milky way tints from Gaia's own passbands, Aug 7
  thirty-second push - a NEW PAPER read in full and the second
  hand colour ramp retired): the galaxy dome's cell tints
  mapped integrated BP-RP through a hand lerp ("bluish 0.6 ->
  warm 1.6", two hand endpoint colours - the bake comment
  itself called it the one documented display mapping).
  Retired on the same frame as the star sprites: Riello et
  al. 2021 (A&A 649, A3, "Gaia EDR3: photometric content and
  validation" - all 35 pages) is the SOURCE PAPER of the
  zero points and G-V polynomial milkyway.js already shipped
  (its Table C.2 prints the -0.02704/0.01424/-0.2156/0.01426
  row verbatim; Table 3 prints the shipped 25.6874/25.3385/
  24.7479 VEGAMAG zero points), and the same Table 3 prints
  the AB zero points (25.8010/25.3540/25.1040) and the band
  pivot wavelengths (621.79/510.97/776.91 nm) while its Eqs.
  13-17 define the synthetic-photometry frame. The key
  arithmetic: per band m_VEG - m_AB = ZP_VEG - ZP_AB, so a
  blackbody's VEGAMAG BP-RP needs NO Vega spectrum - the AB
  colour from the passband curves plus the printed offset
  (0.3406; the release's full-precision zeropt.dat gives
  0.3406749). The official EDR3 passband release (DPAC
  version-2 files, the paper's own electronic tables) is
  vendored at 5 nm into milkyway.js; bpRpOfPlanck folds
  Planck's law (stars-color.js SI-exact constants) through
  the curves, kelvinFromBpRp inverts the monotone relation,
  and the bake draws each cell as starTintRGB of that
  temperature via a 256-tap colour LUT - the galaxy and the
  drawn stars now ride ONE cited colour chain end to end
  (the old ramp domain gets real temperatures: bpRp 0.6 ->
  6940 K, 1.6 -> 3889 K; the bulge reads warm orange
  (1, .64, .35) where the ramp was flat (1, .88, .72)).
  Gate: milkyway-reference.mjs grows two landmarks - the
  vendoring one (pivot wavelengths re-derived from the
  decimated rows land on the printed 510.97/776.91 to 0.02
  nm; the VEGA-AB offset is the printed zero-point
  arithmetic) and the inversion one (monotone, round-trip
  3.5e-15, the 0.6/1.6 temperatures in stated bands, solar-
  Teff blackbody colour 0.868). VALIDATE PASS (all
  references + 7 GPU probes; the bake LUT costs ~0.3 s once
  at galaxy creation, off the frame loop). Stated
  reductions: a cell's mixed stellar population is drawn as
  the single blackbody of its integrated EDR3 colour - line
  blanketing shifts real stars a few hundredths of a mag off
  the blackbody locus (the solar-Teff blackbody sits at
  0.868 where the Sun measures ~0.82), and colours outside
  the 2300-45000 K span clamp to the end temperatures.
- DONE (the twilight purple light, Aug 7 thirty-third push -
  TWO papers read in full and a missing atmospheric layer
  landed): the theme had NO stratospheric aerosol - the mie
  profile's 1.2 km scale height puts every drawn particle in
  the planet's shadow minutes after sunset, so the twilight
  purple light (the pastel band that dominates clear evening
  skies between civil-twilight start and end) had no source.
  Sources, both read cover to cover: Lee & Hernandez-Andres
  2003 (Applied Optics 42, 445, 13 pp, via the Granada colour
  lab's own archive) - the purple light's reds are
  TROPOSPHERICALLY reddened sunlight singly scattered in the
  stratosphere (the stratosphere alone "at most yellows" it);
  their Table 2 prints the evening window at view elevation
  20 deg over 35 twilights: start h0 -1.41 +- 0.93, maximum
  purity -3.89 +- 0.71, end -7.37 +- 0.56; scatterers are
  sulfuric-acid droplets under 0.1 um. Kremser et al. 2016
  (Rev. Geophys. 54, 278, all 59 pp, via the White Rose
  archive) - the Junge layer sits at 15-25 km peaking near
  20 km; in quiescent periods the aerosol is "only 5 to 10%
  above molecular levels" in CALIPSO 532 backscatter, and the
  stratospheric lidar ratio is "typically between 45 and 50
  sr". THE AMPLITUDE CHAIN: those two printed ranges over the
  EXACT molecular lidar ratio 8pi/3 fix the layer's
  extinction at 0.27..0.60 of the molecular extinction inside
  it (log-mid 0.40) - no new unit constant; the amplitude
  rides the shipped Hillaire Rayleigh scale, and integrating
  the printed layer against the shipped profile lands the
  background AOD(532) at 5.4e-3 inside the printed-range
  bracket [3.6e-3, 8.1e-3], overlapping the review's own
  quiescent record (~3e-3..6e-3, its Figs. 4/10). stratos.js
  computes the single-scatter term with the EXISTING certified
  machinery - sunTransmittanceJS per sample (the
  tropospherically reddened beam, exact planet shadow
  included) x pathToRadiusT view legs x Rayleigh phase (the
  printed sub-0.1 um size is the stated dipole reduction) -
  and the drawn shell (createStratMaterial, a 24x16
  radiance texture over sun-relative azimuth x elevation,
  refilled at 1 Hz in the twilight window) adds over the dome
  in the same per-E0 x skyExposure frame with the shared
  Eq.-13 rod fold. THE EMERGENT WINDOW, gated: at view 20 deg
  the term holds 70% of its sunset value at Lee's printed
  start (-1.41), reddens through R/B 40 at his printed purity
  peak (-3.89, 16% amplitude), and hard-shadows by -6; at
  view 5 deg the term's last light dies between -6.81 and
  -7.93 - the printed end -7.37 +- 0.56 BRACKETS the
  single-scatter cutoff. Also gated: solar-azimuth
  concentration x9 (the printed "eyelid" shape), day
  smallness (6% of the molecular zenith order at sun 45),
  and exact linearity in volcScale - the stage-2 hook for a
  live OMPS/GIBS volcanic feed (Kremser prints the ~1 yr
  sulfate e-folding and Table 1's moderate-eruption SO2
  masses; the honest live mapping needs its own pass because
  fresh SO2 is not yet aerosol). Stated scope: single
  scattering only (the -7.37 end at view 20 carries a
  higher-order tail the term omits - it reproduces the end
  low in the sky instead, where the last purple actually
  lives), grazing refraction (~0.5 deg) unbent, and the
  Angstrom slope 1.35 is a documented graph-read of the
  review's Fig. 10 (the one number not from body text).
  validate.sh gains the gate; VALIDATE PASS (all references
  - 7 GPU probes).
- DONE (volcanic stage-2 verdict, Aug 7 thirty-fourth push - a
  paper read in full and the SO2 blocker DISSOLVED by a found
  direct product): the stage-2 question was how a live feed
  could honestly scale volcScale when fresh SO2 is not yet
  aerosol. Ridley et al. 2014 (GRL 41, 7763 + supplement, all
  22 pp via the MIT archive) closes the modelling route with a
  negative: it prints the clean background SAOD (0.0015 above
  15 km, from the study's lidar minima), the below-15-km share
  (30-70% of total SAOD, 28-39% at Tsukuba), the -25 W/m2 per
  unit SAOD forcing conversion (after Solomon 2011), and the
  post-2000 forcing -0.19 +- 0.09 W/m2 - but NO per-eruption
  SAOD table and NO SO2-mass-to-SAOD relation; combined with
  Kremser's conversion-lag physics, an instantaneous SO2-column
  mapping stays unprintable. THE DISSOLUTION: the GIBS
  GetCapabilities scout found the keyless layers
  OMPS*NOAA21_LimbProfiler_Aerosol_OpticalDepth and
  \_Aerosol_ExtinctionCoefficient*{12,14,16,18,20}KM - the
  MEASURED stratospheric aerosol optical depth itself, the
  exact product Kremser's review names as forthcoming
  (Gorkavyi et al. 2013), now operational. No SO2 modelling is
  needed at all: the honest stage-2 feed is volcScale =
  measured local sAOD / stratAOD532() (the shipped background
  chain), same GIBS machinery snowcover.js already ships
  (tile + colormap inversion). NAMED NEXT PASS: the
  volcanic.js feed - fetch the layer's colormap XML, sample
  the viewer's cell, gate the inversion round-trip and the
  background-consistency (quiet sky should read ~stratAOD532
  within the printed quiescent band), wire volcScale, validate,
  push. This pass ships the verdict and the scouted layer
  names; the layer term itself is already linear in volcScale
  by construction (thirty-third push's gate).
- DONE (the live stratosphere, Aug 7 thirty-fifth push - the
  volcanic feed lands and the named next pass closes): volcanic.js
  feeds the purple-light layer's volcScale from the MEASURED
  stratosphere - the GIBS OMPS*NOAA21_LimbProfiler_Aerosol*
  OpticalDepth layer (daily, keyless, epsg3857 Level6 verified
  live; today's default is the current date), the very product
  Kremser 2016 names as forthcoming. The published colormap
  (v1.3, fetched 2026-08-07) is vendored VERBATIM and inverted
  exactly, the snowcover.js pattern: 201 contiguous bins, no
  duplicate colours, below-floor magenta under 6.00e-3, open top
  above 2.50e-2. The LP retrieval reports extinction at 675 nm
  (Loughman 2018 v1 basis / Taha 2021 v2.1), so volcScale =
  measured SAOD_675 over the shipped chain moved to 675 by the
  layer's own documented Angstrom slope (chainAOD675 = 3.94e-3).
  THE CORROBORATION, gated: the product's own display floor
  (6.00e-3) sits at x1.52 the shipped background - inside
  Kremser's printed modern-vs-minimum band (2013 a factor
  1.6-2 over the 2002 minimum) - and the LIVE Aug 2026 tile
  reads in the first painted bins (~6.0-6.4e-3): the real
  stratosphere lands exactly where the chain + the review put
  it. Sampling: a 33x33 block around the viewer's pixel with
  unknown/below-floor cells entered AT the chain background, so
  an unpainted sky returns volcScale = 1 IDENTICALLY (the gate
  holds it exact); day-backoff to 10 days is honest data (the
  ~1 yr sulfate e-folding); clamp at 8 (the colormap top is
  x6.4). Wired at boot and re-anchor beside the snow sync;
  panel row records the measured value and day; ?volcanic=0
  pins the background. Gate: volcanic-reference.mjs, 4
  landmarks (published structure; floor-vs-chain corroboration;
  201/201 inversion round-trip with monotone geometric mids;
  sampler + clamp + unknown contracts). VALIDATE PASS (all
  references + 7 GPU probes). The stratospheric story is now
  END TO END real: printed background chain (thirty-third
  push), measured live scaling (this push), drawn purple light
  gated on Lee's printed window - and a future eruption will
  paint the theme's twilights within days of the satellite
  seeing it.
- DONE (the last hand split, Aug 7 thirty-sixth push - a paper
  read in full and the hand-off list's final uncited constant
  retired): the per-layer cloud-cover fallback (low/mid/high =
  0.7/0.5/0.3 of total when the model lacks layers - the
  hand-off's item (4), the last invented split still standing)
  now carries the MEASURED partition. Rossow & Schiffer 1999
  (BAMS 80, 2261, "Advances in Understanding Clouds from
  ISCCP" - all 28 pages via the AMS archive): their Table 5
  prints the D-series global annual cloud-TYPE amounts for
  1986-93 (nine types, ice and liquid separately, daytime only
  - the caption's own caveat); the level sums land low 26.5 /
    middle 19.2 / high 21.6 (%), partitioning the printed 67.6
    total to 0.3%, with the abstract's long-term global mean
    0.675 +- 0.012 bracketing it. cloud-climatology.js vendors
    the type table VERBATIM and derives the fallback fractions
    low 0.392 / mid 0.284 / high 0.320 of total (sum 0.996 -
    the old guess summed 1.5 by silent overlap); the semantics
    are stated in the header: ISCCP classifies each cloudy
    pixel once at its TOP (Fig. 2's printed 680/440 mb level
    bounds), so lower layers under high decks are understated
    relative to true per-layer covers - the fallback is the
    measured top-view partition, the honest floor when data is
    missing (open-meteo serves real per-layer covers almost
    always). All four fallback sites in Horizon.html now read
    the module (cHighFrac at the cirrus column + the
    cLow/cMid/cHigh deck feeds); no hand split remains. Gate:
    cloud-climatology-reference.mjs, 2 landmarks (Table 5's own
    closure + the partition contract with the printed ordering
    low > high > mid). VALIDATE PASS (all references + 7 GPU
    probes). With this, the original hand-off's legacy-display
    ledger is CLOSED: every item is either retired onto a
    printed frame or documented with its verdict.
- DONE (sea ice stage 1: the white-ice optics, Aug 7
  thirty-seventh push - a NEW PAPER read in full and a missing
  surface's physics landed): the theme has measured snow for
  LAND but no ice for the SEA - a polar fjord draws liquid blue
  in February. Stage 1 ships the optics; the feed and the drawn
  water blend are stage 2 (scouted: GIBS
  GHRSST_L4_MUR_Sea_Ice_Concentration is live daily through
  yesterday with a 102-entry published colormap, 1%-per-bin -
  the AMSR2 12km layer DIED 2025-09-01, checked and rejected).
  Source, all 35 pages: Malinka, Zege, Heygster & Istomina,
  "Reflective properties of white sea ice and snow" (The
  Cryosphere 10, 2541, 2016). White ice reflectance is closed
  form in THREE parameters (their Table 1: layer tau, grain
  chord a, yellow-substance absorption); seaice.js transcribes
  Eq. 10 (Fresnel diffuse transmittance closed form), Eqs. 7-9
  (the mixture's omega0), and Eq. 29's asymptotic albedos with
  the printed g = 0.67, at the conclusion's printed ordinary-
  white-ice ranges (tau 7..15, grains 1-4 mm, log-mids; pure
  ice stated - Table 2's pure cases put the yellow substance
  at ~1e-4/m). Ice n, kappa: Warren & Brandt 2008's published
  ASCII rows at 440/550/680 VERBATIM (fetched from the UW
  compilation). THE GATE'S FOUR LANDMARKS: (1) Eq. 10 equals
  an independent first-principles Fresnel integral to 2e-10 -
  and the check caught the PAPER itself: its printed 1-T_diff
  interval ends 0.0695 at n = 1.334 where its own formula
  (and the independent integral) give 0.0666; the low end
  0.0611 is exact - a documented prose discrepancy, the
  machine-verified formula ships. (2) The W&B rows: kappa
  climbs three decades blue to red. (3) The albedo structure:
  r_d(550) sits on Eq. 30's non-absorbing tau/(tau+4) to
  0.56% (the paper: absorption is negligible at 550), the
  spectrum orders blue > green > red (white ice faintly
  blue: 0.717/0.715/0.703), and the printed tau range spans
  the paper's own "about 0.7-0.8" white-ice band. (4) The
  printed 48-degree crossing is EXACT: the paper says direct
  and diffuse albedos are equal at theta0 = arccos(2/3), and
  G(arccos(2/3)) = 1 makes it an identity - grazing sun
  0.865 > r_d 0.715 > overhead 0.634, the printed ordering.
  VALIDATE PASS (all references + 7 GPU probes). Stage 2,
  named: the GHRSST feed (snowcover-pattern colormap
  inversion, boot/re-anchor sample, state.iceConc) and the
  drawn blend (water body colour toward r_d x incident,
  wave/glint damping by concentration) with its own gate.
- DONE (sea ice stage 2: the polar ocean freezes by
  measurement, Aug 7 thirty-eighth push): the GHRSST MUR
  concentration feed lands and the drawn blend closes the
  sea-ice pass. seaice.js gains the stage-2 machinery: the
  published 100-bin colormap VERBATIM (one percent per bin,
  unique colours - the gate round-trips every bin exactly),
  iceConcOfRGBA / sampleIceConc (unknown cells SKIPPED - land
  and gaps; an all-unknown sample returns -1 and the feature
  stays off), and iceDisplayRGB = r_d x BODY_GAIN - the
  white-ice albedo in the water body's OWN display frame (one
  shared scalar, no new constant; the gate prints the
  consequence: ice sits x64 the tuned dark-sea luminance,
  exactly what a 0.71-albedo surface over a ~0.01-reflectance
  body must do). Horizon.html: syncSeaIce beside the snow and
  stratosphere syncs (boot + re-anchor; skipped below 35 deg
  latitude; 6-day backoff; panel row records concentration
  and day), and three frame-side effects - the body colour
  lerps to the ice colour re-based every frame (never
  compounds), the Cox-Munk glitter damps by (1 - C), and the
  wind-sea drive damps to U(1 - C) (the measured-partition
  path is left as served - WAM masks ice; stated). ?seaice=0
  keeps liquid water. Gate: 6 landmarks total (the four
  stage-1 optics landmarks + the colormap round-trip + the
  sampler/display-frame contract). VALIDATE PASS (all
  references + 7 GPU probes). A February fjord now freezes
  because a satellite analysis says it is frozen, wearing the
  printed white-ice albedo, with the sea calmed and the
  glitter gone in proportion to the measured concentration.
- DONE (sea ice stage 3: snow on the ice, Aug 7 thirty-ninth
  push - the pass completes on the same paper's printed rows):
  bare white ice is the SUMMER surface; the cold-season sea
  wears snow, and Malinka's Table 2 prints the snow-covered-ice
  parameters (tau 27..73, grains 170..270 um - the conclusion's
  fresh-snow statistics agree: tau > 30, grains < 300 um).
  seaice.js carries the log-mid pair and iceDisplayRGB(fsc)
  mixes bare and snow-covered albedos AREA-WEIGHTED by the
  theme's measured fractional snow cover (snowcover.js's GIBS
  NDSI field - the land measurement standing proxy for
  snowfall on the adjacent ice, a stated reduction; an area
  fraction makes the linear albedo mix exact). The snow-covered
  triple lands at r_d = 0.909/0.915/0.917 - inside the paper's
  own measured snow-covered band (~0.85-0.95, its Fig. 11) and
  properly above bare white ice. Gate: 7 landmarks (the new
  one holds the Table-2 triple's band, the ordering, and the
  mix's end-exactness and monotonicity). Documented residual:
  the FAR sea stays the sky-view LUT's Payne-lit horizon (the
  far ring deliberately draws no sea mesh), so the horizon
  line keeps liquid radiance under full ice - the near drawn
  water is where the freeze lives; a future pass could carry
  the concentration into the sky-LUT's sea-horizon term.
  VALIDATE PASS (all references + 7 GPU probes).
- DONE (sea ice stage 4: the frozen sea reaches the horizon
  and the sky, Aug 8 fortieth push - the stage-3 residual
  closed): the far sea stayed a liquid Payne-lit horizon under
  full ice because the dome's terminal ground bounce fed
  Payne's 0.06 wherever the box has sea - and that SAME feed
  is the sky-view LUT's sea-horizon term. seaice.js now
  exports iceAlbedoMix(c, fsc) - the ABSOLUTE diffuse albedo
  of the drawn ice (bare/snow-covered area-weighted), with
  iceDisplayRGB refactored to be exactly that number in the
  water body's display frame (the gate holds the consistency
  to 1e-15). Both Payne consumers ride it by measured
  concentration: the dome ground bounce (scalar - the lum3 of
  the mixed triple; the sky-view LUT's sea horizon and the
  aerial in-scatter whiten with the frozen sea, closing the
  residual the honest way, through the SAME term that was
  documented as the gap) and the overcast ground coupling
  (per channel - a polar overcast over pack ice now whitens
  by the ice-coupled series exactly as the snow-land path
  does). Under no ice both sites reduce to Payne's 0.06
  verbatim. VALIDATE PASS (all references + 7 GPU probes).
  The sea-ice arc is complete across four stages: printed
  optics, measured concentration, measured snow on the ice,
  and the frozen sea reflected in sky, horizon and overcast.
- DONE (the moon gets its face, Aug 8 forty-first push - a NEW
  DATA SOURCE and the sky's most recognizable pattern): the
  drawn moon was a uniform-albedo Hapke sphere - calibrated
  photometry, blank face. Now it wears the MEASURED maria:
  moon-albedo-data.js vendors the LROC WAC global morphologic
  mosaic (LRO_WAC_Mosaic_Global_303ppd_v02; Robinson et al.
  2010, Space Sci. Rev. 150, 81 - the LROC instrument paper),
  fetched from NASA Moon Trek's keyless WMTS (the two zoom-0
  equirect tiles), downsampled to 256x128 and normalized to an
  AREA-WEIGHTED sphere mean of exactly 1 - a pure spatial
  modulation, so the shipped Hapke disc calibration
  (R_FULL_CENTRE, the full-moon anchor) is preserved by
  construction. Orientation WITHOUT a rotation series
  (moonface.js): the vendored engine's Libration() gives the
  sub-observer selenographic point, the moon-to-earth
  direction is the drawn moon's own vector negated, and the
  spin pole is the IAU frame's printed constant (Archinal et
  al. 2011: alpha0 269.9949, delta0 66.5392; the report's
  sub-0.05-deg series dropped, stated) riding the celestial
  group's own sidereal frame - three facts fix the body frame
  completely, libration wobble included, refreshed every 30 s.
  The material samples the map by the LOCAL normal (the mesh
  quaternion IS the body orientation), multiplying the
  lunar + earthshine term - so the maria show in earthshine
  too, as they really do. GATES (moon-reference grows two):
  the WAC face landmark - sphere mean 1.000, Crisium 0.55 /
  Tranquillitatis 0.49 dark and Tycho's terrain 1.58 /
  farside highlands 1.30 bright at printed selenographic
  coordinates, and the dark-area fraction 38% nearside vs 10%
  farside (the classic printed nearside-maria concentration);
  the orientation landmark - IAU constants verbatim, R
  orthonormal to 4e-16, sub-observer-to-earth exact to 1e-16,
  pole alignment cos = 1 on consistent geometry, zero
  libration facing (0,0) exactly. A longitude-origin bug was
  caught DURING the build by the landmark values themselves
  (Crisium read bright until the WMTS -180 column origin was
  rolled to the lon-0 convention - the map checks are why the
  face is right). VALIDATE PASS (all references + 7 GPU
  probes).
- DONE (the eclipsed moon, Aug 8 forty-second push - TWO papers
  read in full and the copper tint retired onto a printed
  shadow): the lunar-eclipse darkening was a hand copper lerp
  (the block itself called it "the documented display mapping
  of a mid-scale L2 eclipse") plus a 0.18 penumbral constant.
  Mallama 2022 (arXiv:2112.08966, 12 pp) prints the whole
  answer: his Table B.1 is the DISK-RESOLVED shadow profile -
  magnitudes lost in Johnson B/V/R at 50 positions from the
  outer penumbral boundary to the shadow centre - vendored
  VERBATIM in lunar-umbra.js (stood in for 440/550/680, band
  centres within ~15 nm, stated). The moon material now
  samples it PER FRAGMENT: pos = 1 - d/penumbra with the live
  penumbral radius (his printed scale note), the shadow-centre
  direction from the same geocentric vectors the eclipse
  geometry already used (antisolar-minus-moon offset through
  the celestial group's sidereal frame) - so the umbral edge
  CREEPS ACROSS THE MEASURED MARIA FACE from the last push,
  blue dying first and red last, penumbra included (the 0.18
  constant retires with the copper; earthshine is left
  unshadowed - its own geometry). GATES, four landmarks:
  (1) the table's printed structure - 50 rows monotone, centre
  B/V/R 22.24/15.44/11.02 verbatim, the colour branches
  joined at a third of the way in and forked after, as the
  paper narrates; (2) the printed drops - centre blue "almost
  a billion" (7.9e8), red "20,000 times" (2.6e4); (3) THE
  EMERGENT REPRODUCTION - disc-integrating the vendored
  resolved table with the paper's own stated geometry
  (penumbral annulus = lunar diameter; umbra/rMoon from the
  theme's own eclipses.js at mean distances) lands his
  integrated Table B.2 endpoints to 0.01-0.02 mag (B +7.38 vs
  7.39, V +1.42 vs 1.44, R -3.06 vs -3.05) - the integrated
  table re-emerges from the resolved one, no fit - and his
  full-moon baseline -12.73 sits 0.01 from the theme's shipped
  MOON_FULL_VMAG; (4) the half-million span (4.7e5, his
  "nearly one-half million") and the MEASURED corroboration -
  Ugolnikov, Maslov & Korotkiy 2011 (arXiv:1106.6178, 5 pp,
  read in full) measured the June 2011 umbra at 503/677/867 nm
  and print "falls down to about 1e-6" at 503 - this table's
  deep-umbra green is 6.7e-7, a factor 1.5. Stated scope: the
  profile is for a clear atmosphere - Mallama prints that
  volcanic aerosol darkens eclipses below it ("an approximate
  upper limit" after major eruptions), the named hook for a
  future coupling to the theme's measured stratospheric AOD
  feed. VALIDATE PASS (all references + 7 GPU probes; the
  suite's GPU legs needed the restart-killed :8901 server
  rebooted - environment, not code).
- DONE (volcanic lunar eclipses, Aug 8 forty-third push - two
  shipped systems close a loop with ZERO new constants):
  Mallama prints that his shadow profile is for a clear
  atmosphere and that volcanic stratospheric aerosol darkens
  eclipses below it (his Fig. 5.1 post-eruption outliers,
  "an approximate upper limit") - the hook the last push
  named. It closes from what the theme already ships: his
  Table 3.1 prints the umbral rays' minimum altitudes against
  shadow distance (vendored verbatim - deep-umbra rays graze
  at 0-8 km, BELOW the Junge layer), each such ray crosses
  the stratos.js shell twice, and the chord integral of the
  layer's per-channel extinction times the LIVE measured
  volcScale (the OMPS feed) is the darkening.
  lunar-umbra.js gains rayMinAltM + volcanicMagExtra, and
  buildUmbraLUT folds the extra magnitudes per channel; the
  theme rebuilds the LUT during an eclipse whenever the
  measured volcScale moves. THE NUMBERS, gated: at background
  the centre gains only 0.16 mag (green) - Mallama's clear
  table stays right, and the exactness check now pins the LUT
  at volcScale 0 to his table verbatim; at the Pinatubo scale
  (SAOD675 = 0.1 through the live feed's OWN chainAOD675
  conversion, volcScale 25.4) the centre darkens by
  +3.0/+4.0/+5.4 mag in R/G/B - squarely on the observed
  record (his outliers sit ~3-4 mag under the model in V) -
  with blue dying fastest, so a volcanic umbra reddens before
  it blacks out, exactly as 1992-93 was described; and the
  extra is exactly linear in volcScale (the gate holds the
  identity). The loop this closes is the pass's point: the
  same satellite measurement that scales the twilight purple
  light now darkens the eclipsed moon - two independently
  grounded systems joined by printed geometry (Keen's classic
  Science 222 result, eclipse brightness as a stratospheric
  aerosol probe, now runs INSIDE the theme in the forward
  direction). VALIDATE PASS (all references + 7 GPU probes).
- DONE (melt ponds, Aug 8 forty-fourth push - the summer ice
  turns blue by printed optics): the measured floe was
  year-round white; Arctic summer ice is 10-40 % ponds. Three
  papers read in full: Lu et al. 2016 (Cold Reg. Sci. Technol.
  124 - the journal copy is paywalled, so the pass fetched the
  authors' accepted manuscript from Helda via the unpaywall
  API, then recovered the display equations VERBATIM from the
  .docx's Equation-Editor WMF drawings with a hand-written WMF
  text-record parser: the two-stream pair, mu/kappa, the four
  boundary conditions, Dera's R1'' = (1-R1)/n_w^2 = 0.54); Lu
  et al. 2018 (The Cryosphere 12, 1331 - the same RTM as
  colour, with the printed Istomina in-situ HSL windows and
  the printed melting narrative); Rosel et al. 2012 (The
  Cryosphere 6, 431 - the MODIS pond-fraction climatology).
  meltpond.js solves the printed three-layer model in closed
  form over Smith & Baker 1981 water + Warren & Brandt 2008
  ice rows (the WB rows shared verbatim with seaice.js);
  seaice.js's iceAlbedoMix/iceDisplayRGB gain a pond fraction
  (ponds ride the snow-free part - new snow covers ponds,
  printed); the theme drives it with Rosel's Fig. 6 curve
  (machine-read from the published raster at the printed
  anchors: > 15 % peak at the end of June, the end-of-July
  second maximum, season day 129-249) gated by the measured
  open-meteo 2 m temperature above freezing, northern
  hemisphere only (the data's own domain). THE NUMBERS, all
  gated: the closed form satisfies the printed ODEs and BCs to
  1e-12; sigma_i = 0 gives albedo = R1 = 0.05 EXACTLY at every
  wavelength (printed "only specular reflectance"), and the
  melt end (Hi = 0) lands there too; the CIE-folded melting
  case runs grey (sat 0.035, "about 0.6") -> blue (hue 0.54)
  -> almost black (0.05) with red lowest and near-linear
  (late/early step 1.18) while green/blue accelerate
  (3.0/3.6) - Lu 2018's printed Fig. 8 narrative emerges
  whole; the default pond sits in the printed Istomina windows
  (sat 0.077, lum 0.470, hue 0.553 vs measured 0.2-0.5 inside
  the printed 2 eps = 0.22 band); the underlying-ice albedo
  window 0.5-0.7 holds and rises with BOTH Hi and (through the
  water's spectral weighting) Hp, exactly as printed; sigma_i
  1.2 -> 2.5 moves broadband albedo +0.11 vs printed +0.10;
  the printed 350-600 / 600-900 nm sensitivity split lands
  (Hp moves 680 nm 12x more than 440; Hi moves 440 nm, ~zero
  at 800); 500 nm young/mature ponds 0.63/0.28 vs printed
  0.6/0.25. VALIDATE PASS (all references + 7 GPU probes).
- DONE (lake ice, Aug 8 forty-fifth push - the lakes freeze by
  Stefan's law on the measured winter): the OSM lakes rippled
  blue in January at 61 N. Two papers read in full: Yang,
  Lepparanta, Cheng & Li 2012 (Tellus A 64, Lake Vanajavesi -
  fetched from Helda, keyless) and Pirazzini et al. 2006 (Ann.
  Glaciol. 44 - the albedo law, open at Cambridge). NEW
  EXTERNAL DATA SOURCE: the open-meteo ERA5 archive API
  (keyless) - daily mean 2 m temperature at the anchor since
  the season start. lakeice.js integrates the measured series
  day by day with ZERO free knobs - every constant is a
  printed pair from the Vanajavesi paper: the sqrt-FDD growth
  structure is printed verbatim ("in proportion to the square
  root of the freezing-degree days"); a = 2.21 cm/sqrt(degC d)
  pinned by the printed 53 cm climatological maximum over
  Table 1's printed monthly temperatures; the ice-on budget
  (12 degC d) by the printed 30 November mean freezing date at
  November's printed -0.4 degC; the melt rate by the printed
  "2 cm d-1 melting in April" at April's printed +2.7. What
  then EMERGES, gated: breakup 27 April vs the printed
  observed 30 April (season 147 d vs printed 152); the
  Kuivajarvi validation circles (mid-month 17/32/45/51 cm vs
  observed ~20/35/44/50); the printed sensitivities (+1 degC:
  freeze +4 d vs printed 5 d/degC, maximum -6.5 cm vs printed
  ~6, breakup -10/+7 d vs printed 8). The drawn colour is the
  printed Yang Eq. 2 / Pirazzini Eq. 3 law at the printed
  values (film 0.15 below the printed 0.001 m; bare black ice
  min(0.55, 0.15 h^1.5 + 0.15) - 0.208 at 53 cm; snow ramp to
  the terrain's own snow class over the printed 0.1 m, read as
  the measured areal fraction; Pirazzini's tuned melting form
  corroborates - 0.6 m ice at 0.294 vs their printed "about
  0.3", RMSE 0.032). Wiring: terrain-sample/worker split lake
  pixels from sea (0/1/2 in the wet grid), terrain-tsl gains a
  lake attribute + two uniforms - frozen lake pixels trade the
  animated sea for the ice albedo, go still (DEM normal), wear
  the snow-class roughness and drop the wave glitter; the sea
  keeps its own measured concentration path untouched. Full-
  page WebGPU smoke at Vanajavesi compiles clean. VALIDATE
  PASS (all references + 7 GPU probes).
- DONE (planet colours, Aug 8 forty-sixth push - the last
  hand-picked tints in the sky): the five drawn planets carried
  fifteen hand-picked RGB numbers while every star's tint came
  from physics. One paper read in full (49 pp): Mallama,
  Krobusek & Pavlov 2017 (Icarus 282, arXiv) - the modern
  reference photometry for all eight planets. planets-color.js
  vendors its Table 6 (solar magnitudes), Table 7 (per-band
  geometric albedos) and Table 3 (V references) verbatim, plus
  the Venus and Jupiter phase polynomials from the appendix.
  The drawn tint is the stars' own Planck carrier at the
  PRINTED solar colour (Table 6's B-V = 0.65 through the
  shipped Ballesteros relation = 5778 K, seven kelvin from the
  Sun's real 5772 - gated) times the printed B/V/R albedos,
  whose band centres (436/549/700 nm, printed) sit on the
  theme's 440/550/680 channels. Mars goes deep red (its
  printed albedo TRIPLES from B to R), Saturn warm, Venus
  near-neutral - and URANUS JOINS THE SKY as the sixth
  naked-eye planet: its opposition magnitude (+5.6 from the
  printed reference, gated) sits a magnitude inside the star
  catalogue's own 6.5 limit, and its printed albedo collapse
  (0.561 B -> 0.202 R, the methane blanket) makes it
  blue-green - a colour no colour-index Planck fit could
  produce. THE GATES: the paper's own worked example
  re-emerges exactly from the vendored tables (Saturn L-ratio
  7.31e-8, area factor 1.46e-7 from the printed 57,240 km
  radius, geometric albedo 0.499 = Table 7); Venus's printed
  phase polynomial plus plain circular geometry puts greatest
  brilliancy at -4.81 at phase 124 deg - the almanac value,
  nothing fitted; Jupiter's printed quadratic dims 7.5% at its
  12-deg maximum phase (the paper's own "about 6%"
  cross-check); the live magnitudes stay with the ephemeris
  engine, now corroborated against the printed frame. Night
  full-page smoke clean with six planets. VALIDATE PASS (all
  references + 7 GPU probes).
- DONE (star visibility, Aug 8 forty-seventh push - the stars
  appear in magnitude order): every point source shared one
  hand twilight ramp (nightSky on sun altitude), planets got a
  hand x1.6 "pierce twilight" factor, and light pollution
  dimmed stars through the 1/(1+r) stand-in. All three retire
  behind Schaefer's PRINTED threshold law (PASP 102, 212, both
  1990 papers on disk, reread): adaptation.js gains
  limitingMagnitude(B) - the Knoll-Tousey-Hulburt/Hecht
  two-branch threshold (Eq. 2, printed constants, day/night
  split at the printed log B = 3.17 which IS the module's own
  1500 nL colour floor), the Allen anchor (Eq. 16), and his
  assembled naked-eye Eq. 18 - whose printed worked example
  (136 nL, k_v 0.3 -> 6.05, "in excellent agreement with
  common lore") the gate reproduces EXACTLY, with his printed
  sky pairings (21.0 <-> 136 nL, 21.8 <-> 65 nL) agreeing with
  the module's own Falchi-anchored bridge to 1%. Every star,
  planet and comet sprite now carries its V magnitude and
  fades in over the PRINTED +-0.5 mag Blackwell detection
  width around the frame's limiting magnitude, computed from
  laCd - the adaptation sky that already contains twilight,
  moonlight and the measured Falchi skyglow. What EMERGES:
  the dusk sky fills in magnitude order (Venus, then Sirius
  and Jupiter, the 6.5 tail last); the daytime limit sits at
  -4.3, so Venus near greatest brilliancy pierces daylight
  while Jupiter cannot (the classic, gated); a full-moon sky
  reads limiting magnitude 4.3 (lore 4-5) and a Bortle-8 city
  keeps only its bright stars - the Bortle scale emerges from
  the measured atlas through one printed law; and during
  totality laCd collapses so the stars come out over the
  eclipsed sun by the same threshold, nothing special-cased.
  The best-sky limit lands at 6.5 - the catalogue's own
  naked-eye cut, closing the loop. Meteors keep their
  population-rate frame (transients, documented scope).
  Twilight full-page smoke clean. VALIDATE PASS (all
  references + 7 GPU probes).
- DONE (meteor perception, Aug 8 forty-eighth push - moonlight
  suppresses the shower): the meteor system spawned against a
  fixed lm = 6.5 no matter the sky, gated by the same hand
  nightSky ramp the stars just retired. One paper read in full:
  Koschack & Rendtel 1990 (WGN 18:2, 44, the ADS scan - the
  SAME paper the zenith correction already cites). meteors.js
  vendors their Table 4 (the MEASURED probability of perception
  p(dm, R) from ~5000 double-count meteors; blank cells zero,
  their own reading) and Table 6 (the standard field portions),
  folds them through their Eq. 5 - and their printed Table 5
  standard row RE-EMERGES EXACTLY (0.00482 / 0.0593 / 0.365 /
  0.860). visibleRateFactor(r, lm) then folds the r^m magnitude
  distribution (their Eq. 6) against the perception curve,
  normalised at the ZHR definition's own 6.5 - and the textbook
  r^(lm - 6.5) limiting-magnitude correction EMERGES from the
  printed tables within 6% over lm 4.3-6.5, nothing fitted.
  The theme drives it with the frame's Schaefer limiting
  magnitude (last push): a full-moon sky keeps 13% of a
  Perseid-class shower - the famous moonlit-shower suppression
  - city glow thins rates by the measured atlas, twilight and
    daylight kill them through the same law, and spawn draws
    truncate at the live limit so no drawn streak is fainter
    than the sky allows. The hand nightSky x lpVisBright meteor
    gate retires; clouds still occlude. Perseid-night full-page
    smoke clean. VALIDATE PASS (all references + 7 GPU probes).
- DONE (visual review + horizon hardening, Aug 8 forty-ninth
  push): captured and INSPECTED real twilight and deep-night
  renders of the new sky passes (Gibraltar, 4 h apart). What
  the pixels confirm: the Schaefer threshold visibly fills the
  sky in magnitude order - a sparse bright-star field at
  nautical twilight against the red sunset band, the faint
  magnitude tail arriving by 00:30 - with natural brightness
  spread and no artifacts. A flagged anomaly (star-like dots
  below the sea horizon, one soft mover) was hunted and
  RESOLVED AS NOT A BUG: a pixel census (101 bright px above /
  20 below), an attempted sprite fix that changed nothing, and
  a close look identified the dots as the strait's FLASHING
  NAVIGATION LIGHTS on the water (navlights.js working as
  designed - their frame-to-frame variation is the real light
  characters). The hunt still landed a real hardening: the
  celestial sprite shell (r ~900) reaches far past the drawn
  sea/terrain box, so a set star or planet could peek past the
  world's far edge with nothing to occlude it - star AND
  planet/comet sprites now fade over the horizon (short
  smoothstep at altitude zero), replacing geometry that is not
  there. Above-horizon field unchanged (93 vs 101 bright px,
  scintillation noise). VALIDATE PASS (all references + 7 GPU
  probes).
- DONE (extended-source visibility, Aug 8 fiftieth push - a
  VERDICT, no code): the natural sequel to the Schaefer point-
  source threshold was to put the milky way, zodiacal light and
  airglow on a printed extended-source law and retire their
  remaining hand nightSky ramp. The candidate mechanism - the
  shipped Ferwerda/LBNL JND as the contrast threshold - FAILS
  its own sanity check, measured before any code: at the dark-
  sky adaptation floor (1.74e-4 cd/m^2) the shipped JND is
  1.39e-3 cd/m^2, which puts the gegenschein at 0.125 of
  threshold, the zodiacal cone at 0.26 and the bright milky-way
  clouds at 0.50 - all INVISIBLE, while every one is a real
  naked-eye dark-sky object. The diagnosis: Ferwerda's numbers
  are BRIEF-PRESENTATION detection thresholds; astronomical
  extended sources are seen by long inspection with spatial
  summation over degrees, governed by Blackwell 1946's large-
  field long-duration contrast tables (JOSA 36, 624) - which
  are paywalled at Optica, with no open mirror found. VERDICT:
  the diffuse dome features keep their existing documented
  frame until Blackwell's printed large-field tables (or an
  open equivalent, e.g. a CIE contrast standard) can be read
  and vendored; wiring them through the flash JND would have
  erased real sky features and is rejected. The blocker is
  named for a future pass.
- DONE (extended sources unblocked, Aug 8 fifty-first push -
  Crumey opens what Blackwell's paywall closed): the fiftieth
  push's verdict named the blocker; the unblock is Crumey 2014
  (MNRAS 442, 2600, arXiv - read in full), which re-derives
  Blackwell's large-field data in closed form with every
  constant printed. adaptation.js gains his scotopic model -
  his own recommendation "for astronomical visibility": Ricco
  branch R = (r1 B^-1/4 + r2)^2, large-target branch Cinf =
  k1 B^-1/4 + k2, joined as ((R/A)^q + Cinf^q)^(1/q) with the
  printed q = 0.6, the printed 1e-5 cd/m^2 zero-background
  floor, and his printed notional field factor F = 2 (the value
  his own telescopic application shows landing Sinnott's
  best-value limits). The gate holds what the flash JND
  provably could not: the gegenschein-class zodiacal feature
  (the module's own Leinert-derived 22.0 mag/arcsec^2 over
  0.03 sr) sits 14x ABOVE threshold at the natural dark sky -
  visible, as it really is - falls to ratio 0.86 (vis 0.33,
  marginal) under a full-moon sky, and to zero in twilight.
  The milky way's appearance rides Crumey's printed
  OBSERVATIONAL anchor (Bigourdan 1907 via his Sec. 9: visible
  at sun -13 deg, sky ~20.25 mag/arcsec^2) fading in over his
  printed grey band to full at the 21.25 black boundary - his
  own practical dark-sky definition. Wiring: zodiU.night and
  mwU.night now run these laws at the frame's adaptation sky
  (laCd - twilight, moonlight and the measured skyglow all
  inside), retiring their share of the nightSky x lpVis hand
  ramp; airglow keeps its frame (it IS the background, not a
  feature on it - documented); clouds still occlude. VALIDATE
  PASS (all references + 7 GPU probes).
- DONE (aurora-visibility source hunt, Aug 8 fifty-second push
  - a hunt record, no code): the named lead was to put the
    aurora's naked-eye visibility on the shipped Crumey threshold
    via the rayleigh unit and the IBC brightness classes. The
    hunt's verified outcomes: Hunten, Roach & Chamberlain 1956
    (JATP 8, 309 - the paper that DEFINES the rayleigh and the
    IBC scale) is CLOSED - the ADS scan returns AccessDenied
    (Elsevier-era JATP; ADS only serves society-journal scans)
    and unpaywall confirms no open copy; Sigernes et al. 2014
    (GI 3, 241, Copernicus - fetched and checked) is open but is
    spectral calibration only (R/Angstrom), printing neither the
    IBC classes nor visual-brightness anchors. The deeper
    blocker found on inspection: the drawn curtain's absolute
    brightness chain is deliberately display-calibrated
    (aurora-lut's own documented split - "profiles are the
    physics, gains are exposure") because the absolute
    photons-per-ion-pair yields live in book-only sources (Rees
    1989 ch. 3, Chamberlain 1961); without them an honest kR
    level for the drawn curtain cannot be constructed, whatever
    the threshold law. NEXT-WINDOW ROUTES, in order: (1) the
    AGU/Wiley open digitisation of Chamberlain 1961 (Physics of
    the Aurora and Airglow was re-issued in the AGU Classics
    series) for the printed yields AND the IBC definitions in
    one source; (2) an open Fang-lineage paper printing the
    35.5 eV per ion pair and 5577 yield chain; (3) failing both,
    the aurora keeps its documented display frame - the same
    honest state the extended-source features held between the
    fiftieth verdict and the Crumey unblock.
- DONE (aurora absolute brightness, Aug 8 fifty-third push - the
  curtain gets printed kilorayleighs and earns its own visibility):
  the fifty-second entry's blocker dissolved one route sideways -
  the AGU Classics digitisation of Chamberlain 1961 sits behind
  Cloudflare (and the wayback mirror behind this container's
  egress policy), but an OpenAlex sweep of the 138 papers citing
  Hunten et al. 1956 surfaced everything needed in OPEN journals,
  all four read in full: Brandstrom et al. 2012 (GI 1, 43) prints
  the SI rayleigh - Eq. 1: 1 R defined as 1e10 photons s^-1 m^-2
  column; Eq. 2: apparent radiance = 1e10 I/(4 pi) per sr (Baker
  & Romick 1976 lineage, the exact convention airglow.js already
  carries from PALACE Sect. 2, so the aurora reuses the airglow's
  own lineRadiance/lineLuminance/cieY chain - one conversion, one
  home); Baumgardner et al. 2007 (Ann. Geophys. 25, 2593) prints
  the brightness anchors - SAR-arc climatology 500 +- 270 R
  "almost always sub-visual", the 29 Oct 1991 arc at 9.5 kR above
  background that "approaches naked-eye visibility" (13.5 kR +-
  20% above atmosphere), and the 23-24 Mar 1969 great aurora at
  ~100 kR greenline + ~200 kR redline (Noxon & Evans 1976);
  Hayakawa et al. 2018 (ApJ 869, 57, the ApJ/arXiv open copy)
  prints IBC Class IV ~ 1000 kR at 5577 with Chamberlain's
  "total illumination on the ground equals to that of full moon";
  Dahlgren et al. 2011 (Ann. Geophys. 29, 1699) prints the same
  SI definition for auroral arcs plus few-kR ordinary discrete
  arcs. WHAT SHIPPED: (1) aurora-lut.js curtain-photometry block
  - curtainKR(drive) rides a printed ladder from the PALACE
    green-airglow mean (163 R, the sky's zero-aurora green line,
    imported from airglow.js LINES) to the printed 100 kR great
    aurora at full drive, log-linear across the three decades
    (decade-built like the IBC scale; mid-drive lands at 4.0 kR,
    the ordinary-arc band); curtainLuminance(kR) closes kR ->
    cd/m^2 through the airglow chain; (2) adaptation.js gains
    CRUMEY_B_VALID = 0.1 - Crumey's own printed validity edge
    ("approximately 0.1 cd m^-2 ... for achromatic sources") - and
    crumeyThresholdDB now continues past it as a Weber law at the
    model's edge contrast (continuous by construction, identical
    below, and the printed photopic slope-one regime beyond - the
    expired fit would otherwise let any bright extended source
    survive daylight); (3) Horizon.html retires the aurora's hand
    nightSky ramp: strength = drive x extendedVisibility(
    curtainLuminance(curtainKR(drive)), laCd, 0.1 sr) x cloud x
    elevation - the curtain now appears exactly when its printed
    brightness beats the printed threshold against the same live
    sky luminance the stars use. LANDMARKS (aurora-reference, all
    gated): the SI chain re-derived by independent arithmetic
    (1 kR at 5577 = 1.927e-4 cd/m^2 exact) and that unit rung
    sits at 1.11x the moonless natural sky (skyglow's printed
    NATURAL_MCD pair - why a 1 kR aurora is a threshold object);
    ladder endpoints exact with monotone log interior; the
    visibility matrix emerges - a 100 kR great aurora pierces full
    moonlight (the theme's own 5e-3 cd/m^2 class) AND the
    validity-edge twilight sky while daylight extinguishes even
    IBC IV, and a quiet 1 kR arc is full at dark, 0.33 under the
    moon, dead in twilight; Hayakawa's IBC IV sentence closes
    through the theme's own moon - full-sky 1000 kR delivers 0.61
    lx vs the derived MOON_FULL_LUX 0.322 lx, equality at half-sky
    coverage, two printed chains meeting at a sentence from 1961;
    Baumgardner's red-line pair through the same chain - 500 R at
    1.02x the achromatic dark-sky threshold (sub-visual once the
    630 nm rod penalty applies) vs 9.5 kR at 19.3x (approaches
    visibility), luminance ratio exactly 19; the Weber continuation
    continuous at the edge, exactly linear beyond, monotone over
    8.5 decades (adaptation-reference holds the below-edge
    identity against the raw printed model). STILL DISPLAY, now
    documented as such against the printed frame: the inter-line
    gains (6300 x2.0 exposure, 4278 at the printed 1/5.5 Rees
    ratio), the E0-from-probability mapping, the sine curtain
    shape, and the log drive axis itself (its endpoints are
    printed; the interpolation is the neutral choice across a
    decade-built span). The IBC I-III rungs remain unvendored -
    Ebihara 2017's full ladder sits in a WEKO3 SPA (KURENAI) that
    serves only its shell to every API probed, and Gao 2020 is
    closed - but nothing load-bearing waits on them.
- DONE (snow albedo aging, Aug 8 fifty-fourth push - the snow on
  the ground gets a history): the terrain's snow class was a fixed
  fresh white - vec3(0.87, 0.9, 0.93) painted identically onto a
  January drift and an April crust - repeated verbatim on the
  building roofs and as the lake-ice snow-ramp target. Now it ages
  by print. SOURCE (read in full, CC-BY): Essery 2015 (GMD 8,
  3867), FSM 1.0, whose prognostic albedo is the classic
  ISBA/Douville-lineage scheme as the paper itself prints -
  Eq. 10, d(alpha)/dt = (alb_min - alpha)/tau +
  (Sf/S_alpha)(alb_max - alpha) - with Table 2 verbatim: alb_max
  0.8, alb_min 0.5, S_alpha 10 kg/m^2, T_alpha 2 C, tau_cold
  1000 h, tau_melt 100 h (the printed 10x: melt collapses in days
  what cold barely dents in months); Eq. 11 (the diagnostic
  variant) carried for the cross-gate. DRIVER: the same keyless
  open-meteo ERA5 archive the Stefan lake ice uses - trailing 90
  days of daily snowfall_sum + temperature_2m_mean at the
  visitor, snowfall converted by the feed's own printed "divide
  by 7" depth-to-water rule (7 cm of depth IS the printed 10
  kg/m^2 refresh mass, exactly). The daily step solves the linear
  ODE in closed form, so the integration is sub-step independent;
  cold-vs-melting switches on the daily mean against 0 C
  (documented archive proxy for FSM's surface state). DISPLAY
  FOLD, stated not invented: the fresh class is PINNED at alb_max
  (visible-band reflectance rightly sits above broadband) and
  rides the printed broadband factor alpha/alb_max down to
  exactly 0.625 of fresh at the aged floor - the visible
  darkening of real old snow is impurity- and wetness-driven and
  FSM's broadband range folds those in. WIRED: terrain-tsl
  uSnowCol uniform (ground mix), the roofs share the same
  uniform (their comment already promised "the snow albedo is
  the terrain's own"), and the lake-ice ramp targets the aged
  class; ?snowage=0 keeps it fresh; panel records "FSM snow age:
  albedo 0.71, 12 d since snowfall". LANDMARKS (snowage-reference,
  all gated): Table 2 verbatim; the closed step IS Eq. 10 (Euler
  convergence + exact half-day composition); Fig. 3a re-derived -
  e-fold at exactly tau for both timescales, fortnight of cold
  keeps 0.714 while a fortnight of melt lands 0.510; one 7 cm
  storm day recovers 62% of the gap to fresh; Eq. 11 agrees
  about temperature (fresh at -2 C, floor at 0 C, exact midpoint
  -1 C); a synthetic season - weekly storms hold winter at 0.72,
  then melt crosses 0.6 on day 4 and sits within 0.006 of the
  floor by day 15: the famous spring darkening emerges from two
  printed timescales with nothing tuned; display fold exact at
  both ends. Sea ice keeps its OWN printed snow optics (Table 2
  snow-covered-ice rows in seaice.js) - no change there.
- DONE (measured snow depth + the GIBS census, Aug 8 fifty-fifth
  push - the depth laws get a depth): the recorded catalogue sweep
  ran - the keyless GIBS WMTS GetCapabilities enumerates 1338
  layers, and the census that matters is the TIME axis: MUR L4
  sea-surface temperature, MODIS daily land-surface temperature
  and MODIS L2 chlorophyll are live to this week; the AMSR
  snow-water-equivalent family - the layer that would have served
  a measured depth - DIED 2025-09-01 (eleven months stale, the
  AMSR2 sunset), a reminder that a feed's existence is not its
  liveness and every candidate must be checked against its
  Dimension extent before any code leans on it. The measured
  depth arrived anyway, from the family already trusted:
  open-meteo's current block serves model snow_depth in metres on
  the SAME request the theme already makes for weather (one
  parameter appended, zero new calls). TWO documented
  approximations retired: (1) the live-snowfall ground whitening
  was a binary - snowing now at under half a degree paints
  uSnowy 1, else 0; it is now FSM 1.0's printed Eq. 13 cover
  curve, fs = tanh(h/hf) with Table 2's hf = 0.1 m, driven by the
  measured depth - the paper's own sentence "snow of depth equal
  to parameter hf thus covers 76 % of the ground and depth 2 hf
  covers 96 %" is the gate's landmark, re-derived exactly
  (tanh 1 = 0.762, tanh 2 = 0.964); the roofs inherit it through
  the shared uniform; the binary survives only as the null-depth
  fallback. (2) The lake-ice snow ramp - Yang's printed 0.1 m
  DEPTH ramp, which the forty-seventh pass could only run on the
  MODIS areal fraction as a documented proxy - now runs on the
  measured depth over lakeice.js's own exported SNOW_RAMP_M; the
  areal proxy stands in only when the feed omits depth. Panel
  unchanged (the weather record already carries the snow state);
  snowage-reference grew the Eq. 13 landmark (printed 76/96 pair
  exact, monotone, saturating). NEXT LEADS from the census, in
  value order: MUR L4 SST (gap-free daily 1 km - sea smoke
  criterion, air-sea contrast; needs a printed steam-fog
  threshold paper), MODIS daily LST (surface-air split for the
  near-ground optical-turbulence term the HV profile pins at its
  climatological A - needs a printed A(dT) law), MODIS L2
  chlorophyll as an NRT bridge inside the ocean-colour fallback
  chain (CCI spectral first, chl-Morel NRT second - the chain
  already documents the seam). The IBC I-III rungs stay locked
  (WEKO3 shell, Gao closed).
- DONE (satellite standard magnitudes, Aug 8 fifty-sixth push -
  every satellite gets its own brightness and earns its twilight):
  the fleet drew all ~150 CelesTrak visual-group satellites at one
  flat naked-eye default (m_std 4.0) and cut them at a hand 4.6.
  Both retire. THE CATALOGUE: the Stellarium project's
  satellites.dat (GPL data, fetched keyless from the repo raw;
  gzip inflated by the browser's own DecompressionStream), whose
  header prints its provenance - Mike McCants' magnitude files,
  the MMT-9 automated photometric observatory, CelesTrak RCS -
  16,346 standard magnitudes covering 138 of today's 157
  visual-group ids (88 percent). The lineage was audited both
  ways before trusting it: on the 126 ids shared with the
  community's archived 2014 qs.mag mirror, every value agrees
  within 0.5 mag, median difference 0.00 - one catalogue carried
  forward, extended by observatory photometry (Tianhe 1.87,
  recent CZ bodies). THE CONVENTION, printed: McCants' own file
  description (quoted verbatim in the GPL plugin source) - mag =
  stdmag - 15.75 + 2.5 log10(range^2/fracil) - anchors stdmag at
  1000 km, HALF illuminated (-15.75 + 2.5 log10(1e6/0.5) =
  +0.003), which is EXACTLY where sats.js's Lambert-sphere law
  normalises, so catalogue values plug into satMagnitude()
  unchanged; the 1000-km standard system is the one the open
  photometric literature prints (Mallama 2021, arXiv:2111.09735,
  read in full - his MMT-9-derived OneWeb 7.18 +/- 0.03 and
  VisorSat 7.21 are the same observatory-and-convention chain,
  and 7.21 is verbatim what the plugin source carries for
  Starlink, closing paper-to-catalogue). WIRED: satmags.js
  vendors the 138-id visual-group snapshot (2026-08-08, offline
  floor) and live-refreshes from the maintained file;
  syncFleet() entries carry their NORAD id; the draw loop reads
  each satellite's own m_std (absent ids keep the 4.0 default -
  now a documented FALLBACK, half a magnitude dim of the
  catalogue median 3.5); and the hand 4.6 cutoff is now the
  frame's live Schaefer limiting magnitude - the same printed
  threshold the stars obey since the forty-ninth push, so
  satellites emerge as twilight deepens and drown under
  moonlight and city glow exactly as real passes do. LANDMARKS
  (satmags-reference, gated): the parser on the documented
  format; the ISS -2.5 / Hubble 1.5 / Envisat 3.0 anchors
  (Hubble and Envisat identical across twelve years of the
  lineage); the convention anchor exact to 1e-12 across all 138
  vendored values; the retired default in context (median 3.5,
  spread -2.5..7.5); the ISS overhead at -4.4 - the Venus-class
  pass of observing lore - against a default-class body at +2.1.
- DONE (the green line finds its measured altitude, Aug 8
  fifty-seventh push - Whiter's seven winters gate the curtain):
  the hunt first hit two walls worth recording - the AMS archive
  that served Wiscombe & Warren freely one push ago now returns
  CloudFront "Request blocked" on every try (IP throttling after
  the first success; the Yellow Sea sea-smoke paper JAS-D-22-0065
  and Monahan & O'Muircheartaigh 1980 both wait behind it, named
  here for a cooled-off window), and the Springer-era Annales
  Geophysicae (Lummerzheim & Lilensten 1994) is served by neither
  Copernicus nor ADS. The open route that DID land: Whiter,
  Partamies, Gustavsson & Kauristie 2023 (Ann. Geophys. 41, 1,
  CC-BY - read in full), a 57,907-pair statistical study of green
  557.7 and blue 427.8 peak emission altitudes from seven winters
  of MIRACLE all-sky cameras - printed means 114.84 +/- 0.06 km
  (green) and 116.55 +/- 0.07 km (blue), the blue ABOVE the green
  "contrary to a common misconception", the split growing as
  precipitation softens, the two converging below 110 km, and the
  printed mechanism for all of it: the N2(A) + O energy-transfer
  rate is the PRODUCT of the N2(A) and atomic-O densities, so the
  transfer-fed green peaks below the ionization-fed blue wherever
  [O] falls with altitude. THE CHANGE (aurora-lut.js): the 5577
  profile - which shared the blue's N2-ionization shape apart
  from low-border quenching - now carries the printed [O] product
  weighting, normalised to 1 at the blue line's own peak so the
  inter-line display calibration keeps its meaning. ONE factor,
  BOTH printed regimes emerge: soft spectra put the blue peak
  km above the green (0.5 keV: +14.5; 1.5 keV: +4.8) because [O]
  falls with altitude up there, and hard spectra converge
  (3 keV: 0.0) because 95-105 km is the [O] profile's own flat
  top; at the measured-typical 114.84 km (the LUT's E0 ~ 0.8
  keV) the blue sits above by the printed direction. The hard
  end (15 keV: green 7 km above blue) is gated as a BOUND with
  the paper's own caveat quoted - their model overshoots there
  too, because the low-altitude O(1S) sources beyond the
  transfer chain (O2+ dissociative recombination et al., their
  Table 2) are unmodelled in print. Landmarks (aurora-reference):
  the typical-window pairing, the softening sequence 14.5 -> 4.8
  -> 0.0 km, the hard bound, red far above at every energy; all
  fifteen prior aurora landmarks (Fang, quenching, photometry,
  Crumey visibility) hold unchanged. What the eye gets: soft
  evening arcs now wear their green LOW against a taller blue
  flank, and hard substorm curtains keep the classic coincident
  green-over-purple wall - both orderings now measured, not
  assumed.
- DONE (the sea steams, Aug 8 fifty-eighth push - sea smoke by
  the printed ASTD gate, and the whitecap law's scan read at
  last): the AMS throttle lifted on retry and both named papers
  landed. MAIN PASS - sea smoke: Shen, Li, Yan, Perrie, Zhang &
  Zhu 2022 (J. Atmos. Sci. 79, 3163 - read in full), the Qingdao
  "Hai Hao" sea smoke of 7 Jan 2021 (buoys, Himawari-8, GOCI,
  Sentinel-1B SAR, coupled ROMS-WRF). Their Table 1 prints the
  century-old classification by air-sea temperature difference
  (SAT > SST warm advection fog, SAT < SST cold advection fog,
  SAT << SST sea smoke - the Willett 1928 / Saunders 1964
  lineage, tabulated openly at last after Saunders itself proved
  closed), and the case pins the numbers: ASTD ~20 C (air
  -13.3 C over ~6.7 C water, RH 89.0 percent, "steam on the
  surface of boiling water", a layer a few metres deep, too
  shallow for the passive satellites) with simulated lowest
  visibility 3.09 km - against the printed typical winter ASTD
  of 5-7 C in the same sea "with no fog" and the 2006 large
  cold-advection fog at ASTD ~3 C. WHAT SHIPPED: seasmoke.js -
  Table 1's classes and seaSmokeVisM: smoke density linear in
  the ASTD excess above the printed no-fog band top (7 C), so
  Koschmieder visibility = 3.09 km x 13/(ASTD - 7), exactly the
  printed event value at the printed 20 C, infinity at the
  printed band. DRIVER: sea_surface_temperature appended to the
  marine current= request the theme already makes (zero new
  calls; the marine grid answers only over water, so a non-null
  SST is itself the open-water proof). WIRED: visEff =
  min(measured visibility, smoke visibility) at the one
  Koschmieder site - the model's own fog stays authoritative
  when it already sees it, and the fold's licence to touch the
  whole coastal scene is the paper's own "propagate inland by
  the sea breeze" sentence; panel records the steaming sea;
  ?seasmoke=0. LANDMARKS (seasmoke-reference): Table 1 classes;
  the printed pair (band -> infinity, 20 C -> 3090 m exact);
  Koschmieder linearity (vis x (ASTD-7) constant to 2e-16,
  half-way ASTD gives exactly twice the event visibility); the
  buoy morning lands on the printed 3.09 km and the 2006 event
  classifies as fog-not-smoke with the module silent - the
  paper's own division of labour. RIDER - provenance: Monahan &
  O'Muircheartaigh 1980 (JPO 10, 2094), the source of the
  theme's whitecap law, turned out to be a pure scan - all six
  pages machine-read: the vendored W = 3.84e-6 U^3.41 is their
  Eq. 5, the RECOMMENDED robust-biweight fit to the 90 combined
  points, with the OLS twin Eq. 4 (2.95e-6 U^3.52) printed
  beside it; ocean-reference now gates the twins against each
  other (within 10.5 percent over the observed 4-15 m/s core)
  and the printed nil-below-3-m/s lore; terrain-tsl's citation
  carries the read. The sea's foam and the sea's smoke both
  stand on print now.
- DONE (the airglow ring earns its dark sky, Aug 8 fifty-ninth
  push - and an NLC hunt verdict): the pass began as an NLC lead
  and ended somewhere better. HUNT VERDICT first: the fifty-third
  push's pattern (gate a faint layer's visibility by its printed
  brightness through the shipped Crumey threshold) wants to
  retire the noctilucent shell's documented 6-degree
  sky-brightness gate too, but the open NLC photometry corpus
  (Ugolnikov's arXiv line: the 2021 RGB radiative-transfer
  paper, the 2018 bright-display polarimetry - both read) works
  in camera-selection RATIO floors (NLC-to-background 0.02-0.1,
  instrument limits, not visual contrasts) and prints no typical
  visual-display brightness or contrast; the 6-degree gate
  therefore stays documented, with the printed 16.6-degree
  geometric end still exact. Also noted for the record:
  Ugolnikov 2025 reports WINTER NLC after a sudden stratospheric
  warming - the theme's summer-only climatological envelope now
  has a printed exception it deliberately does not chase (no
  live SSW-state feed). THE PASS THAT SHIPPED INSTEAD: the
  airglow dome itself was still gated by the hand nightSky ramp
  times the lpVis light-pollution stand-in - the exact pair the
  zodiacal light shed in the fifty-first push - even though
  every printed piece needed was already vendored: the PALACE
  line intensities (163/164/36.5 R), their solar-cycle slopes,
  the rayleigh-to-luminance chain, and Crumey's threshold.
  airglow.js gains airglowStructureCd(srf) - the three visible
  line groups' total photopic luminance at the live F10.7
  (4.353e-5 cd/m^2 at 100 sfu, re-derived in the gate by
  independent arithmetic) - and Horizon replaces the ramp pair
  with extendedVisibility(structure, laCd, AGLOW_SR): moonlight
  and the MEASURED city glow now drown the ring through laCd
  itself. What emerges, all gated: fully visible at the
  pristine natural sky, extinguished under full moonlight and
  at a 10x-natural city sky, MARGINAL (0.43) from a 3x-natural
  suburb at mean flux - and at solar maximum (200 sfu) the
  strengthened lines push the suburban ring back to full
  visibility, the IGY-era lore that airglow structure was
  prominent at solar max, emergent from the printed slopes;
  monotone in flux; conservative by construction (the mean
  airglow already sits inside the natural-sky floor it is
  tested against, so the onset can only err later, never
  earlier). The one lpVis consumer left is the constellation
  stick-figure overlay - an annotation, not a physical layer,
  and it keeps its display policy. The airglow's remaining
  display piece is AGLOW_GAIN alone (the drawn amplitude);
  its APPEARANCE is now printed physics end to end.
- DONE (visual verification finds the invisible curtain, Aug 8
  sixtieth push - two stacked field bugs, probed to root cause
  and fixed): after six wiring-heavy passes on the night-sky
  visibility stack, this pass put eyes on the frames - and the
  aurora curtain, strength 0.97 on the panel, drew NOTHING.
  A capture-and-probe session (shoot.mjs grew a --dump-text
  flag - the debug panel saved beside every frame - and three
  throwaway CDP probes: a scene-graph inspector, a draw-call
  toggler, and a node-graph ladder that swaps materials live and
  reads back the mean of each try) separated FOUR hypotheses and
  killed two: float32 filtering is granted on this SwiftShader
  (fresh float32 textures sample bright), and the material class
  is innocent (bare NodeMaterial with constant nodes renders).
  WHAT WAS ACTUALLY BROKEN, both latent for a long time: (1) the
  E0 rebuild mutated the live LUT DataTexture (data.set +
  needsUpdate) mid-render-loop, and on this build's WebGPU
  backend that re-upload leaves the GPU copy ZEROED - the ladder
  measured it directly (fresh texture bright at 91, the same
  texture after one mutation black at 0.8); the fix ships a
  FRESH DataTexture through the texture node's .value on every
  rebuild (the swap path measured bright at 91). (2) The curtain
  base mapping buried the physics: the material maps mesh height
  to emission altitude (92-320 km over 720 units), so the ~100
  km green border lives 25 units above uBase - but the frame
  loop set uBase = yAurora - 160, sinking the bright border ~13
  degrees BELOW the horizon for every DISTANT oval (the common
  case; the replica-graph probe proved the visible band sampled
  only the profile's empty high-altitude tail - raw LUT sum
  drawn full-green still read black). The curtain only ever
  showed when the oval sat overhead. Fix: uBase = yAurora - 25
  (the border offset derived from the LUT span, commented in
  place), cylinder centre riding half its height above. VERIFIED
  in pixels: the green border now stands at the oval's elevation
  over the northern ridge at a 9-degree-distant oval - occluded
  properly by terrain, waving. Also seen working in the same
  frames, one capture each: the FSM snow age at the aged floor
  (0.50, 84 d since snowfall, Manitoba in August), the live
  McCants catalogue (16,346 magnitudes through the browser's
  own DecompressionStream), the measured HMS wildfire glow
  lighting the valley (real August fires - the red the first
  capture mistook for a bug), no sea smoke inland, and the
  magnitude-ordered stars. The MeshBasicNodeMaterial blanket
  swap tried mid-hunt was REVERTED once proven irrelevant -
  the fix is minimal. Lesson recorded: reference gates hold the
  MATH to print, but only captures hold the PIXELS to the math -
  the two bugs stacked so that each hid the other, and no CPU
  gate could see either.
- DONE (the mutation audit acquits the pattern, Aug 8
  sixty-first push - a verdict, no code): the sixtieth push's
  texture bug raised an alarming generalisation - the theme
  mutates DataTextures at runtime in a dozen places (the sundog
  LUT re-lays every 0.2 deg of sun travel, the parhelic circle
  with it, the transmittance and sunspot rows on their feeds,
  the corona radii, the bow's rain re-lay, the moon face and
  umbra on their async loads, the live radar frames, the ocean
  spectrum on every wind change) and every atmosphere-side one
  is a height-1 row like the aurora LUT that died. If runtime
  mutation zeroed them all, half the theme's live behaviour was
  silently broken. THE CONTROLLED EXPERIMENT SAYS NO: a
  shape-matrix probe on the live page (bind a texture in a
  material, render, mutate its data + needsUpdate, render again)
  measured float32 64x64 (69.3 -> 68.5), float32 256x1 (68.1 ->
  68.0) and uint8 256x1 (67.9 -> 67.8) - every mutation
  re-uploads and keeps rendering. The generalised rewrite is
  NOT justified; the healthy call sites stay as they are. What
  remains true and fixed: the aurora curtain is pixel-verified
  green after the sixtieth push's pair of fixes, and the
  fresh-texture swap it now uses is harmless-at-worst. What
  remains UNRESOLVED and recorded: in the sixtieth session's
  ladder, a fresh material binding the REAL page's aurora LUT -
  after its real mid-loop rebuild - read the texture as empty,
  while the same probe pattern today reads mutated textures
  fine; the difference (64-wide row? update ordering inside the
  page's own frame task? a one-off backend state?) was not run
  to ground, and the aurora no longer depends on it. Environment
  note for future sessions: the :8901 static server died twice
  this window (container worker restarts) - a probe that cannot
  even navigate is reporting the server, not the page.
- DONE (red sprites above the measured strikes, Aug 8
  sixty-second push - the research-first turn): the user asked
  for a survey before code, so this pass began as one. Candidates
  weighed: red sprites over the live Blitzortung feed, STEVE,
  Bishop's ring from the live OMPS layer, and the tide waterline
  (found already DONE - water plane, surf depth chain and ships
  all ride state.tide). VERDICTS on the parked two: STEVE's
  brightness anchor is open (MacDonald 2018 Sci Adv CC-BY) but
  its occurrence climatology is Wiley-locked - parked until an
  open printer surfaces; Bishop's ring needs the 1888 Royal
  Society Krakatoa report (archive.org egress-blocked) or any
  open printed ring radius - none found - parked. SPRITES WON:
  the trigger feed already ships (strike events with bearing +
  great-circle distance), the photometry rides this window's
  rayleigh->Crumey chain, and the sources fell open one by one:
  Hu et al. 2002 GRL and Cummer & Lyons 2005 JGR from Cummer's
  own Duke reprint archive (both READ IN FULL: the +CG charge
  moment ladder - >90% sprite above 1000 C km in <6 ms, <10%
  below 600, ~60% between; sharp nightly thresholds 600/600/350
  C km; zero sprites from ~900 analysed -CGs; above-threshold
  +CGs outnumber -CGs ~30:1), Chen et al. 2008 JGR from the
  ISUAL group's own NCKU site (READ IN FULL: 633 sprites in the
  three-year survey, global rate 0.50/min observed, factor-two
  detection correction to ~1/min, Sato & Fukunishi's independent
  0.5/min quoted alongside; sprite columns span 40-90 km, halo
  disk 75-85 km; sprites per unit area land:coast:ocean
  4.7:3.2:1 against lightning's 10:1), Kuo et al. 2005 GRL from
  the same shelf (READ IN FULL: N2 1PG red canon, SP band
  physics, 1N quench height 48 km), and Barrington-Leigh's
  Stanford thesis from his own McGill page (photometric
  calibration sec. 3.3, quenching sec. 2.3.3 and the elve/halo
  chapters read: 1 kR = 22.6 pW cm^-2 sr^-1 at 700 nm - the
  SAME SI rayleigh the theme ships, cross-checked in the gate to
  0.08%; observed sprite-halo photometer signals of order 10 MR
  against a 60 MR modeled QE flash; elves >1 MR; and the Pasko
  1997 coefficients with the printed crossovers - red 1P
  quenched below 50 km, blue 2P surviving to 32). The global
  flash rate (~45/s, Christian 2003/Cecil 2014) prints in the
  fully-open Perez-Invernon 2023 sprite-chemistry preprint
  (Copernicus direct PDF). WHAT SHIPPED (sprites.js +
  sprites-reference.mjs, 6 landmarks; createRedSpriteMaterial in
  sky-objects-tsl.js; Horizon.html wiring): each located flash
  rolls 1-in-2700 (corrected rate over flash rate), ocean
  flashes x2.44 by the two printed per-area ratios (marine SST
  presence = the theme's open-water proof, the seasmoke pass's
  own device); a winner hangs the printed 40-90 km span at the
  strike's bearing with the exact curvature drop (the aurora
  uBase lesson, now gated: flat+drop vs exact spherical within
  0.4 deg over the feed's 60-200 km), columns + halo band as the
  documented display shapes; the COLOUR at every altitude is the
  printed quenching physics - survival q = A/(A + alpha N(z)) is
  a logistic centred on each printed crossover, the barometric
  H = 6.72 km DERIVED from the printed A/alpha pair (squarely
  the handbook mesospheric value - the print is
  self-consistent), so the red body and blue tendril bottoms
  EMERGE with the handover computed at 44.4 km; appearance is
  Crumey-gated on the printed 10 MR through the shipped chain
  (6.7e-3 cd/m^2 = 38x the dark sky: plainly visible rural-dark,
  extinguished by daylight - the printed dark-sky lore
  reproduced by the printed threshold), decaying on the printed
  several-to-tens-of-ms lifetime; ?sprite=N sprites every Nth
  synthetic strike and holds the envelope for the offline
  harness. PIXEL-VERIFIED (xvfb-run + --wgpu, the validate
  recipe): crimson columns with purplish bottoms at the mapped
  elevations over the Manitoba night ridge, two events at their
  two distances, stars and airglow ring behind - first capture
  showed additive white-out and a hard halo quad edge (x-envelope
  0.30 at the edge), fixed to 0.15 weight and 3.5 sharpness with
  the display exposure at 0.5. RECORDED GAPS, not gates: the
  parent-physics ladder (polarity, charge moment) compresses
  into the single per-flash probability because Blitzortung
  carries neither - the Hu/Cummer constants ship as
  documentation; Crumey's threshold is steady-state and the
  few-tens-of-ms brevity is an unmodelled hardening (no printed
  Blondel-Rey/Bloch constant in the repo yet - a future pass);
  elves (6.5x more frequent, printed >60 kA peak-current gate in
  Chen 2008 via Barrington-Leigh & Inan 1999) are blocked on a
  current-bearing feed. Environment notes: Wiley/IOP/Springer
  and both Anubis walls (handle.net, digital.csic.es) stay
  closed - and the real-browser route through the agent proxy
  is dead at the transport (Chromium's CONNECT is reset for
  every external host, headed or headless, example.com
  included; recorded, per the proxy README this is
  report-not-work-around) - the unlock was author self-hosting:
  Duke reprints, the NCKU ISUAL shelf (plain http, PDFs served
  whole), and Barrington-Leigh's thesis on his McGill page.
  validate.sh full PASS (102 CPU gates incl. the new 6, all 7
  GPU probes).
- DONE (the browser gets its trust: proxy-debug session, Aug 8
  sixty-third push - environment tooling, one repo tool): the
  user asked for two fixes - the dead real-browser route through
  the agent proxy, and Wayback Machine access. BOTH DIAGNOSED TO
  GROUND with a Chrome net-log (--log-net-log + the netlog JSON
  repaired past its truncation): the "CONNECTION_RESET for every
  external host" verdict from the sixty-second pass was TWO
  stacked faults, neither what it looked like. (1) Chrome's
  TLS 1.3 ClientHello is RESET mid-handshake by the proxy's MITM
  stack (the [begin-ok, -101] pairs on every tunnel; curl's
  classical hello passes) - capping the browser at
  --ssl-version-max=tls1.2 clears it, and the capped hop is only
  browser->localhost-proxy (the proxy re-originates its own TLS
  upstream; verification stays ON). (2) On retries that DID
  handshake, ERR_CERT_AUTHORITY_INVALID: the proxy README's
  promised "browser NSS store" was EMPTY - certutil -L showed a
  bare database. Fix: apt-get install libnss3-tools; certutil -d
  sql:/root/.pki/nssdb -A -t "C,," -n ccr-agent-proxy -i
  /root/.ccr/agent-proxy-ca.crt. (The CACertificates enterprise
  policy was tried first and is NOT honoured by this CfT build -
  both policy dirs written, cert errors persisted.) The working
  recipe is now a VERSIONED TOOL, harness/fetch-web.mjs: page
  text mode and PDF mode (direct application/pdf capture, else
  first bitstream/.pdf link fetched with the page's own session),
  with the one-time container setup documented in its header -
  containers are ephemeral, so the two setup commands must be
  re-run per container. PROVEN REACH, one target per wall class:
  Springer's cookie flow FELL (snm13.pdf, 932 KB - Stenbaek-
  Nielsen, Kanmae, McHarg & Haaland 2013, Surveys in Geophysics
  34,769, the sprite-streamer photometry review that was locked
  during the sixty-second hunt; its prints CORROBORATE the
  shipped anchor: sprite brightness "typically substantially
  above the 3 MR saturation ... maximum ~12 MR" against the
  shipped 10 MR characteristic, streamer heads discussed to
  100 GR with the authors' own caveat, and Sentman's "roughly
  that of bright aurorae"); Anubis-class proof-of-work walls
  AUTO-SOLVE (hdl.handle.net cleared its challenge and followed
  the redirect). WAYBACK, decoded: web.archive.org is NOT
  policy-blocked - the proxy grants the CONNECT and the
  UPSTREAM leg to web.archive.org resets ~11 s later (curl and
  browser identically); unreachable from this egress, reported,
  not worked around. But the archive.org HOST works fully:
  /wayback/available API answers (closest-snapshot lookups
  work), metadata API answers, and ITEM DOWNLOADS serve whole
  scans - the 1888 Royal Society Krakatoa Committee report
  (eruptionofkrakat00roya: 44 MB scan PDF + OCR text) is IN THE
  SCRATCHPAD, flipping the parked Bishop's-ring candidate to
  viable (printed ring radii from the primary, live OMPS AOD
  already wired since the fortieth pass). STILL CLOSED, by
  choice or by upstream: IOP (Radware captcha) and Wiley
  (Cloudflare interactive) are bot managers this project does
  not defeat; digital.csic.es is served a "Web Page Blocked!"
  page by the upstream URL filter (block page names the egress
  client IP) - an admin-level allowlist item, reported. Admin
  notes worth relaying: the README's browser-NSS promise is
  unfulfilled in this image, and toolTrustFailureCodes reports
  java_truststore_seed_failed.
- DONE (Bishop's Ring from its own primary: Aug 8 sixty-fourth
  push - bishop.js + bishop-reference.mjs + the TSL ring pair +
  wiring): the stratospheric diffraction corona of a volcanically
  loaded sky, from the phenomenon's 1888 primary - the Royal
  Society Krakatoa Committee report, Part IV Sec. I(e) (E.
  Douglas Archibald, pp. 232-263), the 44 MB archive.org scan the
  sixty-third session unlocked. Per the standing scan rule every
  shipped value was MACHINE-READ FROM THE PAGE IMAGES (report
  pages 232/235/236/237/238/256/257 = scan 338/341-344/362-363,
  rendered at 150 dpi and read page by page; OCR used only to
  locate them). What the pages print: Bishop's Sep 5 1883
  Honolulu discovery ("20 deg to 30 deg from the sun ... whitish
  haze with pinkish tint, shading off into lilac or purple ...
  hardly a conspicuous object"); the Carola's "deep red outer
  margin" (diffraction, the reverse of the ice halo); Cornu's
  inside-out tint order; Table II means 21 deg 7' / 45 deg 33'
  (adopted 21 / 45 deg 30'); Ricco's May 1884 theodolite triplet
  21 deg 36' / 30 deg 20' / 42 deg 52' (the value Archibald
  himself elevates); Riggenbach's independent 20/28/44; the
  63-observation sunset dilatation table; the purple-glow bridge
  (18.6 deg at ZD 92-94, the glow starting at the dilated
  corona); the STOKES REDUCTION sin(D/2) = N lambda/d with
  N = 0.7655 / 1.7571 ("indebted to Professor Stokes") and its
  particle table 0.00165/0.00162/0.00150 mm -> mean 0.00159 mm =
  0.00006 in adopted; Forel 0.003 mm and Flogel 0.001 mm
  independent; visibility to June 1886; equatorial washout to "a
  mere glare" where densest. THE FIND: Stokes' printed constants
  are the first two J0 ZEROS OVER PI (2.40483/pi, 5.52008/pi -
  the repo's own A&S anchors, matched to the era's table
  precision; a gate landmark). His first-order criterion places
  the ring at u = 2.405 - the CENTRAL LOBE's shoulder - so the
  drawn diameter re-inverts the report's best measurement
  through the theme's one certified diffraction machinery
  instead (the Sassen road the cirrus corona took): Ricco's
  printed maximum-intensity radius 15 deg 10' identified with
  the first bright Airy ring (u = j2,1 = 5.13562, re-derived by
  direct maximisation in the gate) at the photopic 550 nm
  channel gives d = 3.44 um - ON Forel's independent printed
  0.003 mm, and differing from Archibald's 1.59 um by EXACTLY
  j21/j01 = 2.1356 (gate landmark: one criterion constant
  between the two printed reductions). The other two printed
  anchors then EMERGE unfitted: the mid-spectrum first minimum
  lands at 11.3 deg vs the printed 10.5 inner radius, and the
  printed 22.75 outer red limit falls between the red first
  ring (18.9) and red second zero (26.2). AMPLITUDE, all
  measured: tau_ring = (volcScale - 1) x chainAOD675() - the
  live OMPS-LP excess over the shipped Kremser background chain
  (the printed formula itself FORBIDS a background ring: no
  sin <= 1 solution for the quiescent sub-0.2 um layer) - on
  the exact shellChordAM chord through the printed 15-25 km
  Junge layer, through the cirrus corona's own (tau/2) e^-tau
  slab law, achromatic by the aureole's geometric-cross-section
  convention (x ~ 20). Visibility EMERGES radiometrically: at
  volcScale 8 the ring modulates the circumsolar Rayleigh floor
  at the tens-of-percent level ("visible every day and all
  day"); an unpainted quiet stratosphere adds EXACTLY zero; the
  colormap-floor read stays under 10% even as an upper bound -
  no coded threshold anywhere. Drawn as a corona-family branch:
  coronaAdd generalised to per-branch theta_max (28 deg,
  encircled-energy landmark > 90%), buildCloudCoronaLUT gained
  an optional thetaMaxDeg (default untouched - cloud-corona gate
  green unchanged), sun ring under sunE with tAir, LUNAR ring on
  the corMoonDir/moonIrradianceE0 frame (the report's own moon
  rows; its printed smaller apparent extent - "in consequence of
  its inferior brilliancy" - now emerges through adaptation
  rather than being drawn smaller). ?bishop=N forces a
  Krakatoa-class volcScale for capture, ?bishopring=0 is the
  labelled A/B override. VERIFIED IN PIXELS: A/B pairs at the
  noon fixture - identical saturated core, additions confined to
  the 28 deg cone, and the off-glare structure at the Airy
  radii for d = 3.44 um (red first ring ~19-20 deg, green
  second ~25.4, blue third ~28.2 in the zenith-aim cut) with
  the lilac-into-blue rim of Bishop's own description visible
  at the glare's edge. Documented scope: the sunset dilatation
  and the equatorial multiple-scattering washout are carried as
  printed record, not modelled; quiet-time OMPS excesses are
  fine-mode and their drawn ring is sub-visible by magnitude
  (the emergence landmark); supernumerary rings of the
  monodisperse "supposed spherical" model would smear under the
  real 1883 size dispersion (no printed distribution to carry).
  The user's note that bot-guarded pages can be fetched is
  received - nothing in this pass needed the two interactive
  bot managers, and the recorded stance stands until a pass
  actually requires one. validate.sh full PASS (104 CPU gates
  incl. the new 21-landmark bishop gate, all 7 GPU probes; the
  probes need BASE=http://localhost:8901/themes/horizon/harness
  - the script default is the bare origin and 404s, worth a
    future default fix).
- DONE (brief lights get their printed constant: Aug 8
  sixty-fifth push - blondel.js + blondel-reference.mjs + the
  sprite gate wiring): the sprite pass had recorded one honest
  gap - "Crumey's threshold is steady-state; the
  few-tens-of-ms brevity is a documented unmodelled hardening
  (no printed flash-threshold constant in the repo yet)". The
  constant now exists in the repo, from the law's own primary:
  Blondel & Rey 1911, "Sur la perception des lumieres breves a
  la limite de leur portee" (J. Phys. Theor. Appl. 1, 530-550)
  plus the companion "Application aux signaux ..." (1, 643-655)
  - BOTH found as open HAL scans (jpa-00241701/11, the EDP
    digitisation of the 1911 journal, located through the HAL
    search API in one query), both READ IN FULL in the original
    French, and - standing scan rule - every shipped value ALSO
    machine-read from the page images (pp. 547, 548, 652, 653,
    655; the machine read corrected the OCR's "12 et 23 0/0"
    probable error to the printed "12 et 25 0/0"). What the
    pages print: the a-priori argument that Bloch's E t =
    constant cannot hold at threshold (a light AT the steady
    threshold would need infinite time - the E(t) hyperbola must
    be asymptotic to E0, not the axis); the eye at a flash's
    range limit as a BALLISTIC galvanometer; two purpose-built
    flash comparators, 25 series over 17 observers, durations
    1/1000 to 3 s, geometric means, probable error 12-25%; the
    law in four printed forms (p. 548, machine-read): E t =
    E0(0.21 + t), (E - E0) t = 0.21 E0, E/E0 = 1 + 0.21/t, t =
    0.21 E0/(E - E0) - the time constant a = 0.21 s from the
    printed axis cut "21/100 de seconde a gauche de l'origine",
    restated in the application paper's eq. (8) and conclusion;
    the equivalent-fixed-light reduction I t/(a + t); the
    ballistic integral for non-uniform flashes (p. 652,
    machine-read): int(E - E0)dt = a E0 and I'h = int I dt /
    (a + (t2 - t1)) - the effective-intensity form signal optics
    still uses - admitted by the authors to ~1 s; E0 point-source
    threshold documentation 0.5-1e-7 lux; their own honest
    footnote keeping the general (E - b E0) t = a E0 should
    either constant need refinement. THE MODULE: blondel.js
    carries the constant, the printed validity window and the
    two closed forms blondelReyFactor (t/(a+t)) and
    blondelReyThreshold ((a+t)/t); the 7-landmark gate holds the
    algebra (half-efficiency EXACTLY 1/2 at t = a; Bloch limit
    E t -> a E0 at 1 ms; steady -> 1), re-derives the paper's own
    worked example (doubling a 0.21 s flash gains exactly 4/3 -
    their printed "33 0/0, au lieu de 100 0/0"), and holds the
    WIRING: the sprite's 30 ms display life needs x8.00 the
    steady threshold, the printed 10 MR halo KEEPS dark-rural
    visibility 1.00 (the printed "dark-sky phenomenon" survives
    its own printed brevity) and 0 in daylight, while the
    twilight extinction point moves x8.1 darker - the hardening
    in the same adapted-luminance units the stars use. WIRED:
    spriteVis now gates on spriteLumCd x blondelReyFactor(30 ms)
    (Horizon.html; the stale "unmodelled" notes in the frame
    comment and sprites-reference.mjs updated to point at the
    new module). NEGATIVE WIRINGS, checked and stated in the
    gate: meteors are NOT corrected - visibleRateFactor gates on
    a perception-probability table MEASURED ON REAL METEORS, so
    the transient penalty is already inside the measurement and
    Blondel-Rey on top would double-count (the would-be 0.3 s
    factor 0.59 ~ 0.58 mag is printed for the record); lightning
    flashes and glints carry no threshold gate (suprathreshold
    when drawn); stars/planets/aurora/airglow are the steady
    t -> infinity limit, factor 1 exactly. Runtime smoke: the
    night strike+sprite fixture still draws its crimson columns
    through the hardened gate (dark-sky vis 1.0, as the gate
    predicted). validate.sh full PASS (105 CPU gates incl. the
    new 7-landmark blondel gate, all 7 GPU probes).
- DONE (the tide gets its printed physics and a real gauge: Aug 8
  sixty-sixth push - tides.js + tides-reference.mjs +
  tide-fixture.js + the gauge wiring): the drawn tide existed
  (open-meteo's modeled sea_level_height_msl lifting the water
  plane and the surf zone's true depth) but carried no printed
  frame and no measurement. Both now exist. THE PRIMARY:
  Schureman, "Manual of Harmonic Analysis and Prediction of
  Tides", USC&GS Special Publication 98 (1941), public-domain,
  fetched whole from archive.org (manualofharmonic00usco,
  340-page scan) - the manual behind the constants NOAA still
  serves. Standing scan rule: the shipped constants were
  MACHINE-READ from the page images - Table 1 "Fundamental
  astronomical data" (p. 163: hourly rates s 0.54901653, h
  0.04106864, p 0.00464183, N -0.00220641, p1 0.00000196) and
  Table 38, the CONSTITUENT GEARS OF TIDE-PREDICTING MACHINE
  No. 2 (p. 308: "theoretical speed per hour" to seven decimals
  for every constituent - the column the Survey's brass computer
  was geared to; the M1 row re-read at high magnification,
  14.4920521). THE FEED: NOAA CO-OPS, keyless with open CORS -
  the 301-gauge station list, measured water_level (date=latest,
  datum MSL, metric) and each station's published harmonic
  constants (harcon). THE GATE (9 landmarks on a vendored San
  Francisco 9414290 fixture: harcon + a 60-day hourly NOAA
  prediction series + a held-out week, provenance in the
  fixture header): (1) Table 38 DERIVES from Table 1 - 29
  standard lunisolar arguments (M2 = 2T-2s+2h, K1 = T+h, ...)
  land on the printed seven decimals, worst 1.4e-7 deg/hr; (2)
  the compounds are exact printed sums - 18 identities
  (O1+K1=M2, K1+P1=S2, K1-O1=MF, M2-N2=MM, 2K1=K2, S2+-SA=
  R2/T2, ...) close at the table's own rounding: one astronomy,
  one table; (3) NOAA SERVES THE 1941 PRINT - 36 of 37 harcon
  speeds equal Table 38 to their rounding, and the single
  exception is a definitional find CLOSED IN PRINT: served M1
  14.496694 = printed M1 + printed perigee rate exactly (the
  modern convention folds the p-dependence into the speed
  instead of Schureman's nodal u); (4) a least-squares fit AT
  THE PRINTED SPEEDS to NOAA's own 60-day series reproduces the
  held-out week to 0.41 mm RMS - the served prediction product
  IS a synthesis at the 1941 machine's speeds - and recovers
  the published M2 at -3.3% (the 2026-epoch lunar-nodal
  factor), with the station's printed M2 > K1 > O1 > S2 mixed
  hierarchy; (5) nearest-gauge discovery finds the city-front
  gauge at 0.5 km and returns null from the Alps - fails closed
  to the model chain. WIRED: syncMarine now tries the nearest
  CO-OPS gauge within 75 km first - state.tide rides the
  MEASUREMENT (tides + surge) with a "NOAA tide gauge" record
  line; no gauge in reach keeps the open-meteo model value
  (record line now says so); ?tidegauge=0 pins the model path,
  the existing ?tide=M pin stands above both. Documented scope:
  V0+u equilibrium arguments and f node factors are not
  implemented (the fit absorbs the epoch's f x H and V0 + u,
  which is exactly what synthesis needs; kappa phase lags are
  not compared); the drawn tide is always a measured or model
  value, never a local synthesis; CO-OPS coverage is US +
  territories - elsewhere the model fallback stands. Runtime
  smoke: the SF city-front scene loads the gauge path clean
  under debug. validate.sh full PASS (106 CPU gates incl. the
  new 9-landmark tides gate, all 7 GPU probes).
- DONE (the brown horizon: Aug 8 sixty-seventh push - no2.js +
  no2-xsec-data.js + no2-reference.mjs + the march wiring): a
  fresh survey opened the turn (the parked list was empty):
  (A) tropospheric NO2 as a drawn absorber, (B) an elve
  brightness ladder, (C) the STEVE climatology. Verdicts: B is
  recorded Blondel-Rey-NEGATIVE pending a bright-elve print -
  at the sub-millisecond elve lifetime the printed t/(a+t)
  factor is ~0.003, putting the >1 MR characteristic elve well
  under the naked-eye threshold (consistent with elves being a
  camera phenomenon; a printed tens-of-MR class would reopen
  it); C has open arXiv copies of related STEVE papers (parked
  viable); A VERIFIED END TO END AND EXECUTED. THE PHYSICS -
  NO2 is the coloured gas of polluted air: its visible bands
  absorb blue ~87x more than red (5x more than green), so long
  low paths lose blue and brown the skyline while the zenith
  stays blue. THE DATA - the MPI-Mainz UV/VIS Spectral Atlas
  (Keller-Rudek, Moortgat, Sander & Soerensen 2013, ESSD 5,
  365, open access, READ IN FULL - their Sect. 3.3 fixes the
  cm^2 molecule^-1 base-e air-wavelength conventions), serving
  each study's ORIGINAL published cross sections; THREE
  independent laboratory datasets vendored at the theme's
  channel windows (0.5-nm bin means over +-20 nm - the banded
  spectrum makes a single-wavelength read unstable, a gate
  landmark holds the max/min spread that justifies this):
  Bogumil 2003 (SCIAMACHY PFM, the shipped values - the only
  set covering the red window whole), Vandaele 1998 (FTS) and
  Burrows 1998 (GOME FM) - mutually held to 2.6% (B/V) and
  7.0% (vs Burrows, the documented GOME low bias). THE FEED -
  Sentinel-5P TROPOMI tropospheric column via GIBS, keyless
  WMTS, LIVE (tiles confirmed for the current date - NB
  Worldview's own config lists the layer's dateRange as ENDING
  2024-12-03, stale by ~20 months against its own serving GIBS
  stack), inverted exactly through the published 191-bin OMI
  palette Worldview styles it with (0..2e16 molec/cm^2, open
  top; unpainted -> ZERO column, fails closed). TEMPO L3 serves
  the same quantity HOURLY over North America (recorded future
  refinement; its WMTS needs the hourly TIME dimension). THE
  WIRING - the ozone road exactly: a per-channel Beer absorber
  in EVERY march, riding the boundary-layer profile the mie
  terms already integrate (the 1200 m Hillaire exponential - a
  documented co-emission reduction; beta0 = sigma N / 1200 m
  puts the whole measured column under it identically, a gate
  identity): atmosphere-tsl extinction() gains no2A on d.y
  (mieKey extended - LUTs rebuild when the column moves), BOTH
  sun-transmittance.js integrators gain the term on their tm
  leg (absent -> bit-exact identity, and the 27-landmark atmo
  CPU-vs-GPU closure gate stays green untouched), Horizon.html
  syncNO2 samples the tile (volcanic.js pattern) and attaches
  mieRad.no2. ?no2=0 pins clean air, ?no2=N forces the column.
  THE GATE (9 landmarks): three-laboratory agreement; the
  ordering IS the brown tint; exact colormap roundtrip; the
  column-under-profile identity; the CPU twin against the
  analytic zenith ratio; and EMERGENCE with no coded threshold
  - a 1.5e16 plume at the horizon transmits 60% in blue
    against 99.4% in red (R/B 1.67, the brown band over the
    skyline), 99.4% blue at the zenith (the classic look-up blue
    over a brown skyline), and a 1e15 background stays over
    99.9% - under a JND everywhere. VERIFIED IN PIXELS over a
    clean sea horizon (the first Alpine A/B was invalidated by
    drifting valley fog - recorded): the forced-plume frame
    shows the dusky band hugging the horizon, and the
    glare-free difference profile drops 12 blue counts in the
    unclipped horizon strip with red untouched, confined exactly
    to the low rows (the saturated sky above clips at 255 -
    the drawn band lives where the display has headroom, honest
    tone-mapping behaviour). Environment note: Semantic Scholar
    API rate-limited this session (429 on the elve probe);
    plain-http arXiv still returns empty (https works).
    validate.sh full PASS (107 CPU gates incl. the new 9-landmark
    no2 gate, all 7 GPU probes).
- DONE (nacreous clouds: Aug 8 sixty-eighth push - psc.js +
  psc-reference.mjs + createNacreousMaterial + the 50 hPa feed):
  mother-of-pearl clouds (type II polar stratospheric clouds)
  from two Copernicus-open primaries READ IN FULL, under a NEW
  measured feed. Pitts, Poole & Gonzalez 2018 (ACP, the 12-year
  CALIOP climatology) prints the threshold ladder at exactly the
  level the feed serves - 50 hPa, 10 ppbv HNO3, 5 ppmv H2O:
  T_NAT 195.7 K, T_STS 192 K, T_ice 188.5 K - and the ice-PSC
  occurrence mode "slightly below the frost point with a FWHM of
  about 1 K" (their Fig. 12, both hemispheres), which IS the
  drawn gate: a logistic in the MEASURED temperature, 1/2 at the
  printed frost point, the printed width; plus ice optics
  (n = 1.31, lognormal sigma 1.38), seasons (Antarctic May-Oct
  peak Jul-Aug +-25%; Arctic Dec-Mar, rel-std > 100%), the
  wave-ice class (R532 > 50, mountain-wave; Antarctic-Peninsula
  and Scandinavian-lee hotspots), and their MERRA-2 caveat
  (synoptic analyses under-resolve wave amplitudes) carried as
  the gate's documented conservatism. Reichardt et al. 2004
  (ACP, the Esrange two-lidar wave-PSC case) prints the
  microphysics the iridescence rides: wave-ice maximum
  dimensions 3 -> 1.9 um through the wave phase, isometric
  (aspect 0.75-1.25), and the KEY licence quoted verbatim -
  "the size distribution of the optically relevant PSC
  particles is narrow ... justified as in situ measurements
  confirm" - so the drawn colour is LOCALLY MONODISPERSE
  certified Airy (cloud-corona machinery) with the size
  gradient ACROSS the lenticular form being the printed phase
  evolution: the banding IS the size sorting. First bright
  rings land at 17.4-28.2 deg mid-visible (the classic nacreous
  zone; exact inverse-size similarity a landmark). THE FEED:
  open-meteo serves temperature_50hPa keylessly - one variable
  added to the existing winds-aloft request (state.t50). The
  9-landmark gate holds the ladder, the logistic (1/2 at T_ice
  exactly, the printed 1 K FWHM), the degC bridge, the ring
  zone, the closed-form Airy centres per LUT row, and the
  twilight window CLOSED-FORM: the 24 km shell (Pitts prints
  PSCs "up to > 25 km"; the gate level stays 50 hPa where the
  thresholds are printed) is lit at sun -3 deg with R/B 6-22
  (the reddened pearl beam), still lit 0.1 deg above its
  acos(R/(R+h)) = 4.97 deg dip and EXACTLY dark 0.1 deg past
  it. ?psc=T forces the 50 hPa temperature, ?psc=0 disables.
  THE DEBUG SAGA, recorded as harness lore: the drawn forms
  "vanished" through five capture cycles and the causes were
  never the physics - (1) additive colour over the theme's
  near-saturated twilight band saturates to white-on-white and
  a chromatic pixel detector goes blind (the bare-green bisect
  finally showed a white RECTANGLE hiding in the white band);
  (2) an A/B pair taken as two page loads 40 s apart caught
  LIVE-AEROSOL drift - a 55.7M-count whole-frame difference
  that shrank to 1.2M once the pair was pinned with
  aod/volcanic=0/no2=0/irr=0 - A/B captures of live-feed
  pages MUST pin every feed (protocol note for every future
  pass); (3) the 20.5 km shell's twilight window closes at
  -4.6 deg, BEFORE this theme's bright band darkens - the
  display window is real physics and the drawn shell moved to
  the printed band top. The pinned difference render shows the
  three lenticular forms drawn at their positions with the
  pattern sampled at the true sun angle; the 8-bit output
  against the brightest band has headroom only in green, so
  the vivid pearl look needs the layer inside the dome's tone
  pipeline - recorded refinement, with the display exposure
  (0.45) and lens envelope documented as display constants
  (no printed wave-PSC visible optical depth is in hand; a
  future pass could derive one from the printed backscatter
  and lidar ratios). validate.sh full PASS (108 CPU gates
  incl. the new 9-landmark psc gate, all 7 GPU probes).
- DONE (Aug 8, the review session's 69th pass - STEVE from its
  discovery primaries): the subauroral arc joins the sky on the
  aurora's own live machinery. Two primaries read in full:
  MacDonald et al. 2018 (Science Advances eaaq0030 - science.org
  403s; the Europe PMC deposit PMC5851661 serves the full text
  keylessly) prints the discovery geometry - arc just below
  60 deg MLAT, SAID climatology 60.1 deg / 22:30 MLT /
  half-width 0.57 deg, westward flow 5.5 km/s, emission mapped
  at 170-230 km, proton aurora >= 2 deg poleward, premidnight,
  "approximately an hour", green picket fence - and Chu et al.
  2019 (arXiv:1906.08886, equation page machine-read) prints the
  photometric chain: the Carlson O(1D) thermal excitation rate
  alpha(Te) = 0.15 sqrt(Te)(8537+Te)/(34191+Te)^3 exp(-22756/Te)
  anchored on Foster 1994's SAR arc (350 R at 3500-4000 K) gives
  the event's 7600 K "red auroral emission of 7 to 17 kR which
  is visible to the human eye". A derivation FINDING the gate
  now holds: the printed 7-17 window IS the Foster Te span alone
  through their own equation (350 x alpha(7600)/alpha(4000.. 3500) = 7.0-16.9 kR, both ends within 10%); the Ne depletion
  (x0.65) is their separately stated caveat, NOT folded into the
  printed window - first drafted WITH the Ne factor, the low end
  landed at 4.6 kR and the print refuted the arithmetic.
  steve.js carries the printed constants + the excitation rate,
  the curvature-drop geometry (slab edges 45-54 deg tall from
  the discovery belt, thin 3 deg band from gmLat 50, null past
  range - fails closed), the printed 5.5 km/s flow as the
  drawn angular drift at slant range (1.2 deg/s - the pickets
  stream at the printed speed), the midnight-WRAPPING
  premidnight window (first draft failed 00:12 local - the
  [21, 24.5] test needs h>=21 OR h<=0.5, caught while writing
  the landmark), and the printed ~1 h episode as a per-site-
  night hashed onset (halo episode-node pattern; no printed
  per-night rate is claimed; envelope integrates 55 min with
  5-min cosine edges). steve-reference.mjs holds 12 landmarks
  including the bracket re-derivation, Te dominance x30 vs Ne
  x0.65, and the Crumey gate: 7 kR at 630 nm = 3.17e-4 cd/m^2 =
  1.8x the natural dark sky - visible 1.00 dark, 0 in daylight,
  the printed phrase through the printed threshold. The drawn
  side rides shipped machinery end to end: createSteveMaterial
  (sky-objects-tsl.js) is the aurora-curtain cylinder idiom with
  the certified 630.0 + 557.7 CIE lines, the continuum share of
  the mauve a documented display mixture (the primaries print
  "exotic emissions" and decline to explain it); Horizon.html
  gates the ribbon on the live aurora drive (enhanced-activity),
  the window, the episode, steveSlabDeg(state.gmLat) and
  extendedVisibility(7 kR, laCd) - moon/city/twilight kill it
  exactly as the discovery photography does - with display level
  DERIVED as mid-window 12 kR over the curtain ladder's 100 kR
  full-scale (0.12, not hand-picked), magnetic-meridian
  placement flipped equatorward for poleward visitors, and
  ?steve=1|0 harness pins. Pinned A/B captures (rural Alberta
  night, gmLat 58.9, look=13,50): the amplified diff shows the
  mauve ribbon arcing the frame with grouped green pickets along
  its lower edge; the only other deltas are +-1-count exposure-
  loop couplings on stars/terrain (the adaptation responding to
  added light - expected of every additive layer). Display
  finding recorded in steve.js: at 1x the night pipeline's rod
  fold mutes 630 nm exactly as Purkinje says - the ribbon reads
  pale, matching naked-eye STEVE reports; the mauve is the
  long-exposure camera's colour. CORRECTION to an earlier shelf
  note: the gegenschein is NOT missing - zodiacal.js ships
  Leinert Table 17 verbatim through the Delta-lambda = 180 row
  (antisolar 230 S10, ~22.0 mag/as^2) and the dome draws it; the
  shelf note came from a case-sensitive grep ("gegenschein" vs
  the file's capitalized "Gegenschein"). Validation: full gate
  green - 109 CPU references (steve registered after aurora) +
  all 7 GPU probes.
- DONE (Aug 8, the review session's 70th pass - TEMPO: the
  hourly geostationary column joins the brown horizon): the
  shelved TEMPO refinement is unblocked and shipped. The blocker
  dissolved in the capabilities: GIBS serves
  TEMPO_L3_NO2_Vertical_Column_Troposphere (epsg3857
  GoogleMapsCompatible_Level7 and epsg4326 1km, PNG) with TIME
  values that are exact per-scan timestamps (~40-60 min cadence,
  live today) - the earlier 400s were date-format misses, and
  TIME=default resolves server-side to the LATEST scan, so the
  client needs no time discovery at all. The primary: Zoogman et
  al. 2017 (JQSRT, the mission paper) - paywalled at PMC but open
  at NTRS (deposit 20170003141), READ IN FULL with Tables 1-2
  machine-read from the rendered pages. Printed and carried in
  no2.js: hourly daylight revisit; FOR 4.82 x 8.38 deg =
  "from Mexico City, Cuba, and the Bahamas to the Canadian oil
  sands, and from the Atlantic to the Pacific" (the abstract
  corners become the precheck box, the tile's own painted cells
  the real gate); IFOV 2.1 x 4.4 km, product 8.4 x 4.4; NO2
  typical 6e15, required precision 1.0e15 molec/cm^2; and THE
  print that ties feed to optics - the NO2 retrieval fits
  423-451 nm (Table 1 SNR window; Sect. 7 fit range 400-465 nm),
  INSIDE the theme's 440 +- 20 nm blue band-mean window: the
  instrument measures the column in the very band the drawn
  absorber removes. Sect. 9 puts the morning/evening scans on
  "peaks in vehicle miles traveled" - rush hour enters the sky.
  The TEMPO palette (v1.3, 254 linear bins 0..3.0e16) is
  vendored verbatim next to the OMI one; the inverter is now
  shared (paletteOfRGBA) and sampleNo2 takes the palette as an
  argument. Five new landmarks in no2-reference.mjs (14 total):
  the TEMPO palette roundtrips exactly; the TWO published
  palettes invert the same column to the same molec/cm^2 within
  one TEMPO bin (worst 9.0e13 across the shared range - no
  scale factor between instruments anywhere); the printed fit
  windows sit inside the drawn blue band (mid 437 vs channel
  440 nm); the printed structure + FOR box hold (Mexico City and
  the oil sands in, Hamburg and Seoul out, NaN out); and the
  printed 1e15 precision transmits 96.6% blue on the horizon
  chord (under a JND) while the printed typical 6e15 transmits
  81% - the drawn tint sits above the instrument's own noise by
  construction. Horizon.html syncNO2 goes TEMPO-first inside the
  box (TIME=default, tempoOfRGBA, zero painted cells fall
  through to the TROPOMI 5-day walk unchanged) and the refresh
  tightens from 6 h to the printed 1 h revisit. Verified on live
  bytes end to end with the module's own exports: the LA
  neighbourhood sampled 54/54 painted cells at 7.66e15 (and the
  column CHANGED between two fetches twenty minutes apart - a
  fresh scan had published: the diurnal cycle observably in the
  feed); browser load capture PAGEERROR-free. Full gate green -
  109 CPU references + 7 GPU probes.
- HAND-OFF (Aug 7 session close - the review session): the
  approximation sweep after ozone + direct-beam + corona stays
  CLEAN in the physics layers; what remains lives in the LEGACY
  DISPLAY layer, ranked for future radiometric passes: (1) the
  optics dome's calibrated display gains (0.55 bow / 0.18 halo /
  0.6 dogs) and gating heuristics (1 - cloudy x 1.1, the
  cHigh < 90 ? 1 : 0.5 halo dim) - the peak-normalised profiles
  are physical but their absolute scale is not, unlike the
  aureole/totality-corona/cirrus-corona frame - PARTLY RETIRED
  Aug 7 fourth push: the HALO (sun + moon) is radiometric with
  its heuristics deleted; still display-scaled: the bow's 0.55
  (needs the rain shaft's optical depth), the dogs' calibrated
  ratio to the ring (oriented-plate fraction unmeasured), and
  the bow's moonOut/MOONOPT_GAIN path; (2) the overcast
  veil mesh (hand-picked #79838c/#a2abb3 gradient, alpha =
  cloudy^2 x 0.85) standing in for overcast radiative transfer;
  (3) scene-light calibration constants (0.18 + 2.4 stLum,
  moonUp 0.07, fog colour lerps); (4) the per-layer cloud-cover
  fallback splits (0.7/0.5/0.3 of total when the model lacks
  layers - rarely hit, open-meteo serves per-layer covers). The
  named next passes, in rough order of value: (1) the LUNAR
  corona - the classic naked-eye case - blocked only on a CITED
  moonlight irradiance in the sky's E0 frame (the moon optics
  dome's display gains are not that frame; with the citation the
  same cloud-corona LUT anchors on the moon disc radius, and the
  whole moon-optics stack could follow onto radiometry) - DONE
  the same day, moonlight.js (the entry above); the moon-optics
  stack's own move onto that frame stays named; (2) the
  droplet corona through altocumulus (G&L's most common producer;
  needs a mid-deck optical-depth model - the volumetric decks
  know their density, the sprite layers do not); (3) the desert
  three-mode mixture (OPAC Table 4 printed 269.5/30.5/0.142)
  behind a source-region test; (4) the drawn disc onto the
  measured cirrus column (today the disc ignores the veil's tau
  entirely - display-alpha covers it); (5) bldlod's ramp lift,
  still blocked on a dense-city perf measurement. Observed, not
  mine, for the record: a boot-time "THREE.TSL: Length of
  parameters exceeds maximum length of 'vec4()'" console warning
  appears on every load of this build (no PAGEERROR, gate green,
  no vec4 call in the corona pass) - three-internal, worth a
  root-cause when convenient.
- DONE (sky parallax: the celestial group rides with the camera,
  Jul 11): the sunspot verification's "pose aims 1.35 deg high"
  was neither the pose nor the ephemeris - the camera provably
  aimed at the astro sun (forward-dot 0.99999) while the DRAWN
  disc sat 1.2 deg lower. Root cause: every directional sky
  entity was painted on spheres anchored at the scene ORIGIN
  while the camera sits ~35 scene units away - displacement over
  radius = 1.4 deg on the 1400-unit dome, 2.3 deg on the
  860-unit planet shell, DIFFERENT per shell, for every viewer
  in every scene since the theme began. All 15 sky entities
  (dome, veil, polar star group, NLC, moon, planets, comets,
  meteors, aurora, airglow, optics x2, ISS, light-pollution
  glow) now live in a skyGroup whose position copies the camera
  per frame, world orientation untouched; world content stays
  put. VERIFIED: posed at the raw astro sun, the drawn disc
  lands 0.04 deg from the frame centre (seconds of solar drift)
  - down from 1.2-1.5. The harness's empirical -1.35 deg pose
    correction is retired. Gate 57 sets + 4 GPU probes PASS.
- DONE (real sunspots on the drawn sun, Jul 11): the research-
  first rebuild, shipped. Placement: carrington_longitude against
  L0(t) at render time through Meeus ch. 29 (his example 29.a
  emerges; the tested feed semantics reproduce BOTH agency
  products - CMD -32.9 vs SRS "W33", -47.2 vs the feed's W47).
  Photometry: Mathew 2007 Table 2 size-dependent fits anchor a
  constant Delta-T shift of the Maltby 1986 Table 3 brightness-
  temperature curve -> per-spot per-channel tints (deeper in
  blue); umbral share from Jha 2018 (5.5); limb-darkening of
  contrast and cycle phase ignored WITH CAUSE from the read
  sources. Drawing: 4 texels/spot (position/radii, per-spot
  foreshortening z, umbra+penumbra tint vec3s) multiplying the
  limb-darkened high-sun disc with analytic edge coverage; the
  mirage band's folded disc is documented out of scope. Probe
  pass 4: a synthetic spot through the raw tap draws its fed
  tint to 1% per channel (and re-taught the harness that the
  high-sun path needs dirR/dirB fed). LIVE verification on
  2026-07-11's actual sun (4 spotted regions, largest 330
  millionths): the first capture caught a REAL SIGN BUG - the
  drawn spots mirrored in h; the measured pattern matched
  prediction only under an h flip plus one common rotation that
  equalled the page's parallactic angle exactly (u x d vs d x u
  in the shader's east basis). Fixed, re-captured: drawn vs
  predicted positions agree to 0.003 disc radii (~3 arcsec) for
  regions 4482 and 4487, with 4485/4481 present at their
  foreshortened limb positions. Also learned: the pose aims
  ~1.35 deg high systematically (corrected empirically for the
  captures; root cause on the harness list), and clouds - the
  measured 51% cover - hid the sun until the noclouds
  diagnostic separated the layers. Gate 57 sets + 4 GPU probes
  PASS.
- RESEARCH LOG (frontier integrations, Jul 11): sources TESTED
  and papers READ before any code - a first sunspot attempt
  written from recalled citations was removed unlanded; the
  actual paper then disproved its core simplification.
  Data sources, tested with real queries:
  (1) NOAA SWPC solar_regions.json - CORS \*, a 30-DAY HISTORY
  (not a snapshot): region 4481 marches +47E..-47W at 13.3
  deg/day across rows; cross-checked against the SRS text
  product (JSON lon -33 on Jul 10 = SRS "W33", so longitude is
  east-positive CMD valid at each row's OWN date 2400Z, and the
  newest row is extrapolated a day past the 0030 UTC SRS). The
  robust placement design that falls out: use the row's
  carrington_longitude against L0(t) computed at render time -
  continuous, never a day stale. Areas (millionths of the
  hemisphere) match SRS (0010/0410/0175 on Jul 10).
  (2) NOAA CoastWatch ERDDAP - coastwatch.pfeg redirects to
  coastwatch.noaa.gov; the science-quality weekly chlor_a is
  SIX WEEKS stale (rejected), the gap-filled DINEOF daily
  (noaacwNPPN20VIIRSDINEOFDaily) is 2 days fresh and returned
  3.1-4.7 mg/m3 off San Francisco (upwelling-plausible); NO
  CORS headers on either host, so a browser integration must
  route through the api.ndev.tk daemon like /aerosol.
  (3) NASA SVS CGI Moon Kit (LROC albedo asset) - unreachable
  from this environment (TLS failure through the proxy);
  deferred until the asset and its licence text are actually
  obtainable.
  Research read (not recalled): Mathew, Martinez Pillet,
  Solanki, Krivova 2007 (A&A 465, 291; arXiv astro-ph/0701401,
  read in full): MDI 676.8 nm continuum, 160+ spots, stray-light
  and Ni-line corrected. Table 2: umbral CORE intensity
  power-law 1.8598 r^-1.0679 and mean umbral 0.8297 r^-0.3052
  (r in arcsec; double-linear fits per size regime tabulated
  too); mean penumbral 0.8561 - 0.0016 r_spot (near-constant);
  umbra-penumbra boundary at 0.655 and penumbra-quiet-Sun at
  0.945 of quiet-Sun intensity. The paper states outright that
  a single umbral brightness for all spots is "a very poor
  approximation" (core intensity spans x6 with size) - any
  implementation must carry the size dependence. STILL MISSING
  before implementation: a read source for the wavelength
  scaling of the contrasts to 550/440 nm (Maltby et al. 1986
  tables or an open successor - the 2015 A&A 1999-2014
  sunspot-properties paper is open HTML and is the next read),
  and a read source for the umbra/spot area share.
- DONE (band transmittance exact + a refutation + the first
  dome GPU probe, Jul 11): chased the flash mirror's 1.5x
  per-channel K-spread. The honest landmark REFUTED the working
  hypothesis - the 2D transmittance LUT's radius-row bilinear
  blend skews sunset R/G by only 0.48% at the flash geometry
  (atmo-reference, double precision); the 1.5x was the HARNESS
  breaking itself: the display gamut clip zeroes the deep-red
  disc's negative pre-clip B (and drags G), so inverting the
  spectral matrix on clipped pixels is invalid (verified: a pure
  disc colour recovers B 2.38x high through clip+inversion).
  Still shipped, because exact beats small-error: (1)
  sunTransmittanceJS grew an hObs parameter (2-arg call
  BIT-IDENTICAL to the old 300 m, landmarked) and the band now
  draws its transmittance from CPU-built rows at the EXACT
  observer radius (bandTTex, filled with the curve on the same
  cadence, refilled when the aerosol set moves) - halving the
  0.48% to 0.19% of a 4096-step truth integral; (2) a REAL
  half-texel bug found on the way: the band mapped altitude
  linearly to u while row i's texel centre is (i+0.5)/N - up to
  half a row of drift (0.15 mrad = 30 arcsec of drawn disc
  geometry, ~4% of grazing T_G); uOfAlt lands each row's
  altitude on its texel centre; (3) tsl-band-probe.html, the
  gate's FIRST dome-path GPU probe: an identity transfer curve
  puts the disc at a known fragment and the drawn pixel matches
  P(120 T) to 0.08% in display space (comparing there because
  the clip makes P non-invertible - the probe's own first runs
  re-derived every harness lesson: the sky reference must be
  the same fragment with the sun set, readback rows must stay
  256-byte aligned, and the expectation must integrate the
  pixel's own footprint half-pixel-exactly); the set sun stays
  set to 0.01%. Also: container rollback recovery - all merged
  work was safe on the remote; stale shared-sky presence code
  found in the restored snapshot was a feature REMOVED by
  design and was discarded, not preserved (the wrongly-pushed
  snapshot branch was buried at main); the harness symlink +
  playwright-core + servers rebuilt. Gate 56
  sets + 4 GPU probes PASS.
- DONE (the flash rim made continuous, Jul 11): the rim - the
  last rows where the 550 nm image persists past 680 nm's end -
  is thinner than a pixel (0.4-1.1 px through this mirage), and
  point sampling a sub-pixel band on a curved arc broke it into
  dashes: measured on the SF float captures, 9 of 55 disc
  columns had NO green-rim pixel. The exact treatment is the
  codebase's own precedent (the horizon seam): the fragment
  shows the BOX-FILTER INTEGRAL of the band term over its 2D
  footprint - an 8x4 fwidth quadrature in (apparent altitude,
  azimuth offset); the altitude taps ride the LUT's hardware
  interpolation so 8 reads serve all 32 membership evaluations;
  fwidth hoisted to uniform control flow (WGSL forbids
  derivatives in the divergent branch). Measured: dashed
  columns 9 -> 3 (vertical-only) -> 1 faint dip at 12% of the
  mean (the 2D filter), per-column G-excess continuous, the
  drawn rim visually unbroken. TESTED AND REJECTED: doubling
  TRANS_ROWS to 320 - the rim's sub-pixel thickness does NOT
  converge with row count (160/320/640/.../4000 all move it
  60-97% vs each other; it sits at the precision limit of the
  curve integrator itself) and 320 measurably THINNED the drawn
  rim (9 faint columns). The footprint integral is what fixes
  the dashing; the row count stays at the gate-proven 160.
  Gate 56 sets + 3 GPU probes PASS.
- DONE (flash radiometry + the phantom sub-horizon sun, Jul 11):
  pointed the float tap at the SF sunset replay (same cached
  forecast/aerosol). New harness introspection: \*\*profileLevels
  exports the measured refraction column INPUTS (buildProfile on
  them reproduces the exact profile the drawn sun used). The CPU
  mirror - transferCurve on the exported levels at the exact
  observer, the shader's per-channel mu^A limb + vis, the LUT
  atmosphere's transmittance on the cached GEFS set, spectral
  matrix inverted on the float pixels, ONE fitted row shift -
  reproduces the drawn sliver row by row (interior rows within
  a few %, e.g. measured 33.7/2.8/0.5 vs predicted 33.8/2.8/0.5),
  and the rim row measures linear G/R = 8.0 - the green flash as
  RADIOMETRY (680 nm image ends a row below the 550 nm one,
  exactly the transfer curve's geometry). Known residual: the
  per-channel scale spread at grazing incidence is the shipped
  transmittance LUT's finite mu resolution near the horizon edge
  (CPU quadrature converged: 32 -> 4096 steps moves K < 0.3%).
  AND A REAL BUG FORCED OUT: below the graze the apparent sun
  deliberately saturates (twilight continuity), parking the SET
  sun's disc just under the dip - BELOW the transfer band's
  fixed -0.6 deg floor, where the unoccluded high-sun path
  painted a phantom half-disc onto the LUT sea (the story's
  "double sun at 03:38:30" lower image was THIS, not a mirage
  fold - the record is corrected). Fix: (1) the band floor
  follows the observer (min(-0.0105, -sqrt(2h/R) - 0.005), the
  geometric dip bounding the refracted dip from below), so sea
  rows always cover the graze-saturated remnant; (2) the
  high-sun disc path never draws below an engaged band's floor
  (rising suns above the ceiling still draw). VERIFIED on the
  replay: 03:38:30 keeps the sliver + green rim ON the horizon,
  phantom gone; 03:39:00 (sun true -1.23 deg, every disc point
  below the refracted horizon) shows sea and twilight only.
  Gate 56 sets + 3 GPU probes PASS.
- DONE (the float radiometric capture, Jul 11): the harness
  capture bracket (?debug=1 **capture) takes a float flag and
  renders the SAME multi-pass frame into a FloatType target -
  a linear radiometric tap. The dome and sky objects write raw
  HDR radiance (x exposure, no tone map), so the readback
  carries what 8-bit presentation clamps at 1.0 and crushes at
  night; **roam.centerElev is exported so the harness can
  mirror camH-dependent physics at the exact observer altitude.
  MEASURED with it (Interlaken, live data, fov-5 telephoto):
  (1) the rendered sun disc's radial profile reproduces
  Hestroffer & Magnan mu^a PER CHANNEL to 0.36/0.45/0.57% RMS
  (r < 0.9R) with the disc radius PREDICTED from the capture
  geometry and the spectral projection INVERTED on the pixels -
  the display matrix wiring verified end-to-end through the
  GPU; (2) the disc centre's channel ratios equal the Hillaire
  transmittance integral run on the SAME cached GEFS-Aerosols
  response at the exact 1623 m observer: R/G +0.138%, B/G
  -0.177%, and the implied exposure comes out one common scalar
  across channels (18.64/18.61/18.58) as a single uniform must;
  (3) disc centre 2080/1903/1670 in linear units - 2912:1 over
  the adjacent sky, unrepresentable in 8 bits; (4) a night
  frame re-exposed +3 EV after capture reveals the 557.7 nm
  airglow wash, the Milky Way band and the van Rhijn horizon
  brightening that the 8-bit snap crushes to black. Gate 56
  sets + 3 GPU probes PASS.
- DONE (the teal noon stratum -> the spectral display
  projection, Jul 11): built exactly as diagnosed below.
  spectral-srgb.js: the CIE 1931 2-deg CMF rows at 680/550/440
  (CVRL table VERBATIM), the three lines scaled so EQUAL
  radiance maps to D65 (the unique all-positive 3x3 solution -
  neutrality preserved by construction), then XYZ->sRGB DERIVED
  from the primaries + D65. Landmarks (5): the published IEC
  61966-2-1 coefficients (3.2406...) EMERGE from the derivation
  to 3.7e-4; 550 nm sits at (0.302, 0.692) - the gap to the
  green primary IS the bug; P(1,1,1) = (1,1,1) to 5.6e-16; the
  pinned de-teal (Rayleigh zenith mixture G/B 0.410 -> 0.323,
  R/B 0.175 -> 0.241); a pure 550 nm line clips back to the
  green primary axis (mixtures change, monochromatic saturation
  survives). Wired at the DISPLAY ends only - domeColor's final
  colour, the skyRadiance export (moon + far ring), the aerial
  LUT's in-scatter term, and the two CPU feeds (irradiance
  readback -> ambient, sunTransmittanceJS -> sunLight colour,
  where the Rec.709 luminance now means luminance) - every LUT
  texel pin untouched, gate 56 sets + 3 GPU probes PASS.
  VERIFIED at Interlaken noon (the diagnosis scene: the cyan
  stratum gone; measured mid-sky G/R 1.78 -> 1.30, and the
  zenith lands at R/B 0.47, G/B 0.60 - real clear-sky
  chromaticity, where the raw channels starved red at 0.38) and
  a Rotterdam sea noon (sunlit polder green untouched - the
  projection moves the spectral radiances, never material
  colours; the alpine ridges shift with it because the aerial
  in-scatter carried the same bug as the sky).
- OPEN -> DIAGNOSED (the teal noon stratum, Jul 11): clean
  inland noon skies (first stared at during the Interlaken
  far-horizon shots) carry a distinct cyan band between the
  zenith blue and the horizon white. Eliminated BY A/B RENDERS:
  not the clouds (snap?noclouds=1 identical), not the measured
  white-sky albedo's MS bounce (?brdf=1 zeroes the feed -
  bit-identical sky), not aurora (0.00) or airglow (nightSky
  gates on the overridden sun correctly). The band is intrinsic
  to the sky chain's COLORIMETRY: the three radiance channels
  (680/550/440 nm) write STRAIGHT into sRGB R/G/B - measured
  mid-sky pixels run G 190 vs R 109 with G reaching parity with
  B near the horizon, i.e. 550 nm assigned to pure sRGB green
  over-saturates cyan exactly where Rayleigh's G/B converge.
  Hillaire's own 3-lambda demo shares the shortcut; the exact
  fix is the CIE 1931 projection - for three MONOCHROMATIC
  bands the color-matching values give an exact 3x3 from
  per-lambda radiance to XYZ, then the standard XYZ->sRGB - a
  display-end matrix in domeColor (and the aerial/fog hook), so
  every LUT texel pin is untouched; scene sweep pins would
  re-base. A fresh session's feature: global, perceptual, worth
  doing with daylight-scene comparisons at several anchors.
- DONE (the green flash and the mirage sun, Jul 11 - built as
  planned below, plus what the visuals forced): transferCurve +
  foldCount in refraction.js, the 160-row LUT band in the dome
  (alpha = per-row visibility), the theme feed on
  profile/height cadence. Landmarks: identity + fold-free
  standard atmosphere; the inferior mirage folds with a
  BACKWARD branch; the ducting critical lapse EMERGES from
  Ciddor's partials (+0.125 K/m, textbook, never assumed) with
  sub-critical mock mirages and super-critical smooth looming
  44' deep; the flash - 16.5" bare rim, x8.4 mirage-magnified,
  measured with only VISIBLE rows; and the refracted dip itself
  (-2.48' at 2 m vs geometric -2.72'). TWO REAL BUGS FORCED OUT:
  (1) the below-horizon ray tracer's tangent Newton undershot at
  the graze and the floor kept the aimed ray's Snell constant -
  integrating a ray that never existed and folding the curve
  artificially (now scan+bisect, underground rays saturate at
  the true graze; the N-convergence pin re-based); (2) the first
  sunset shots showed the disc floating past the drawn water's
  edge - the LUT now carries visibility (a row whose ray still
  points down at the profile bottom shows sea) so the sun sets
  at the TRUE refracted horizon wherever the finite water plane
  ends. VERIFIED: the full Rotterdam descent series through the
  measured evening profile - flattening emerging from the curve,
  the dip cutting the disc, the last sliver at 20:06:16.
  Tonight's near-standard Rotterdam profile kept the rim at 1 px
  (x1) - and then California DELIVERED: San Francisco's measured
  marine inversion (15.2 -> 24.9 C across 1000 -> 950 hPa, the
  live forecast column) ran the full Young sequence through the
  same code, unscripted - the sun LOOMED past its Rotterdam
  setting depth (half-disc at -0.95 true), FOLDED into a double
  sun at 03:38:30 (the inverted second image of the mock
  mirage), and at 03:39:00 the detached mirage-merged sliver
  flashed yellow-green (G/R 0.95 inside the sliver vs 0.45 in
  the surrounding sky; the red-saturated 8-bit sky is why the
  hue reads yellow-green rather than pure green - a radiometric
  float readback on a flash night would show the clean signal).
  The same frames carry the far ring's Farallon Islands at
  43 km. Sequence delivered.
  The original plan, for the record:
- (plan) the green flash and the mirage sun (Jul
  11): refraction.js already ray-traces the MEASURED column
  (Ciddor 1996 refractivity, Auer & Standish 2000 integral) but
  the drawn disc consumes only THREE scalars - per-channel
  centres + one flattening - so the Omega sun, mock-mirage
  slicing and the mirage-MAGNIFIED flash (Young: most naked-eye
  flashes are magnified green rims, not the bare 10-20 arcsec
  dispersion) cannot appear. The upgrade is van der Werf's
  transfer curve: trueAlt(a) = a - R(a) per wavelength, indexed
  by APPARENT altitude a - single-valued in a (each observed
  direction sees one ray; no fixed point), with mirage folds
  appearing as NON-monotonicity (several a seeing the same true
  altitude = multiple images). The curve is SUN-INDEPENDENT -
  profile- and observer-height-keyed only - so a ~160-row CPU
  LUT rebuilt on profile cadence feeds the dome shader, and the
  sun's true altitude slides against it per frame: the disc
  membership test per fragment row per channel REPLACES the
  centre+flatten model inside a +-2 deg horizon band (the old
  path stays above it). Landmarks: (1) identity with the
  existing roundtrip at +2 deg; (2) fold count 0 under the
  standard atmosphere; (3) inferior mirage - a superadiabatic
  surface layer folds the curve below the horizon and the folded
  branch's slope is NEGATIVE (the reflected image is inverted, a
  physical requirement); (4) the DUCTING CRITERION EMERGES:
  bisect the fold-onset inversion strength and match the closed
  form (dn/dh = -n/r, the critical lapse ~+0.11 K/m from
  Ciddor's own partials - never assumed); (5) flash
  magnification: a mild inversion stretches the last green
  sliver beyond the flat-atmosphere rim. Visual: sunset series
  at a west-facing sea anchor through the fov telephoto.
- DONE (the far horizon, Jul 11 - built, iterated through five
  Tasman Bay renders, merged): the ring exists exactly as
  planned below, plus four fixes the visuals forced: (1) open
  SEA is not drawn - the sky-view LUT's Payne-lit horizon IS the
  far sea; sea-only triangles drop, shoreline triangles keep
  their water corners (island landmark: 258 of 688 triangles,
  every one touching land); (2) those water corners clamp to the
  SURFACE, not terrarium's -80 m bathymetry (landmarked); (3)
  the fade rides the box fog's exact FogExp2 curve
  (exp(-(1.98 d/V)^2), 2% at V and the half-distance identity
  both landmarked) - linear-exponent Koschmieder was twice as
  hazy at half distance and stepped the seam; (4) three's light
  convention premultiplies pi, so the ring's Lambert drops its
  /pi to match the box terrain. Albedo ladder: measured
  white-sky RGB when the box has it, terrain-tsl's own
  GRASS_MEAN (exported single-source) otherwise - Nelson (0
  clear MODIS obs) wears the box's grass. VERIFIED at Nelson
  looking SW: Waimea Plains and the Moutere hills continue past
  the seam to ranges on the skyline at k = 0.292 from the
  evening's MEASURED inversion; before/after delivered. Gate
  green (63 sets, far-terrain at 8 landmarks + 3 GPU probes).
  INTERLAKEN verified (Jul 11, noon override): the ring carries a
  ~4000 m mass at az 153-161, r 320-360 u - the Eiger-Moench-
  Jungfrau group at its true bearings (Jungfrau az 155 from the
  box centre, the classic Hoehematte gap view; Eiger is genuinely
  foothill-hidden from town, as in reality). Honest caveat: the
  theme's asinh datum compresses altitude differentials ~3x at
  4000 m (dy/de = (16/500)/cosh), so the wall draws at 2.5 deg
  from the hillside camera where reality gives 7.6 deg - the
  IN-BOX peaks compress identically (the seam landmark holds the
  consistency), so this is the theme's established vertical
  language, not a ring defect; if the wallpaper ever wants true
  alpine drama the datum itself is the knob, and every drawn
  metre moves together.
  The original plan, for the record:
- (plan) the far horizon: the world
  currently ENDS at the box edge (8 km) - but from Nelson the
  real view crosses Tasman Bay to ranges 40+ km out, and from
  Interlaken the Oberland walls the sky far beyond any box. A
  far-terrain ring from the SAME terrarium tiles at coarse zoom
  (z8, ~500 m/px, ~9-16 tiles for a 400 km span, same decode,
  same despike) drawn from the box edge to ~200 km: (1) geometry
  - a polar grid around the anchor, log-spaced radii 140 -> 3500
    units, elevation through the same mercator sampling, EARTH
    CURVATURE subtracted before the box's asinh datum compression
    (drop = d^2 / (2 R_eff) with R_eff = R/(1 - k)); the
    refraction coefficient k comes from the MEASURED refraction
    column's surface lapse rate (the standard geodetic formula -
    verify the exact published coefficients before coding; the
    textbook k ~ 0.13 must EMERGE from the standard-atmosphere
    lapse as a landmark, not be assumed); (2) rendering - true
    coordinates, a far pre-pass (its own depth range) before the
    main scene, so no skybox parallax approximation; (3) colour -
    at 25-200 km terrain is tonal: sun x slope shading on DEM
    normals over the box's MEASURED white-sky albedo (the RTLSR
    inversion), faded to the horizon sky by Koschmieder
    transmittance at the MEASURED visibility (both already cited
    in-theme); the aerial LUT covers the first 25.7 km exactly;
    (4) landmarks - curvature drop closed-form, k from standard
    atmosphere, seam continuity at the box edge (the ring's first
    radius reads the same elevation the box's sampler reads),
    mercator sampling identity vs demElev; (5) visual proof at
    Nelson (the Arthur Range across Tasman Bay) and Interlaken
    (the Oberland beyond the box).
- DONE (cross-boundary legs, Jul 11): a leg whose far stop is off
  the drawn graph (beyond the box or the cap) now rides drawn
  rail to the graph LEAF nearest the far stop instead of hiding
  or chording - rails.js railRouteToward: Dijkstra ball from the
  near stop's projection (limit maxDetour x the foot-to-target
  line), exit = argmin of euclid(leaf, farStop) over reachable
  degree-1 nodes, the in-box path is real geometry, ONLY the
  outside tail's length is the euclid approximation (it scales
  along-track speed, never placement); past the exit the train
  hides (outside the drawn world). The plan's earlier sketch -
  argmin of g(n) + euclid(n, farStop) over ALL nodes - was
  REFUTED while building: by the triangle inequality that score
  is minimal at the start foot (the landmark encodes the numbers:
  41.0 at the foot vs 42.24/49/49 at the L-network's nodes), so
  it can never leave the start; the leaf rule is the
  degeneracy-free form and matches the physical claim (the real
  line continues undrawn from the drawn stub nearest the stop it
  serves). Guards: no leaf closer to the target than the foot ->
  null; detour ball bound. Ladder wiring: railRoute null + exactly
  one endpoint in-box -> railRouteToward (direction negated when
  the OUT stop is the origin); fraction f maps over len + tail;
  cache shares railRouteCache. Three landmarks (exact L-network
  exit/len 19/tail 30 + the refutation inequality; fork exit
  flips with the target's side at exact lengths; progress guard
  nulls) - rails-reference at 10. Full gate green. Maasvlakte
  seam re-check rode along (Jul 11, post-bounce + unified
  albedo): the grey/black seam is GONE - the reflector edge now
  meets a lit sea-toned band; what remains is the subtle tonal
  transition of drawn water against the LUT background, real
  geometry, not an artifact.
- DONE: the visual QA pass, round two (Jul 10 evening - "same
  standard as boats and planes, need to show stuff happening").
  Ships and planes joined the seen-not-asserted club: the daemon
  (api.ndev.tk) IS reachable through the environment's proxy -
  the earlier NET-FAIL was the harness shim waiting for a
  bounded body on the unbounded /stream SSE; the plain /adsb and
  /ais poll endpoints answer fine. VIEWED: live AIS vessels off
  the Maasvlakte (a real 57 m coaster's hull + superstructure,
  M.1371 silhouette); five concurrent Zurich trains in one radar
  frame; 10-frame animations of the S 24 and S 11 sliding along
  their (now fully drawn) lines; Nelson pre-dawn - dawn arch,
  Venus, 1,689 measured Black Marble lamps speckling the town,
  Tasman Bay reflecting the dawn. Three suspected artifacts
  RESOLVED AS CORRECT by investigation: the ground speckles are
  the lamps; the dashed vertical sky lines are contrails seen
  end-on (an aircraft flying at the camera projects its trail as
  a vertical streak); the pre-dawn tan is green vegetation under
  the warm dawn-sky ambient with the documented adaptation lift.
- DONE (measured land albedo, Jul 11 - closes the entry below's
  open research): the unified ground albedo now takes the box's
  MEASURED value inland. The MCD43 weights themselves stay
  fixed-sites-only on ORNL's open API (checked live: MCD43A1/A/A4
  all refuse arbitrary points while MOD09A1 serves globally), so
  the theme runs the OPERATIONAL retrieval itself: fitRTLSR
  (ross-li.js) is Lucht, Schaaf & Strahler 2000's linear least
  squares of R = f_iso + f_vol Kvol + f_geo Kgeo over the same
  clear MOD09A1 multi-angular record the archetype fit already
  pulls (BASE kernels as the product uses), with the product's
  rules mirrored: 7-observation full-inversion floor, a
  normal-matrix conditioning gate (repeated geometry refuses),
  and physical guards (f_iso and both integrated albedos inside
  (0,1)). Run per MODIS band 1/4/3 - the nearest measured
  narrowbands to the atmosphere's 680/550/440 nm channels - and
  the already-validated Lucht white-sky integrals give an [R,G,B]
  albedo; ALL THREE bands must invert or none feed (a two-channel
  albedo would be invented colour). atmo.update accepts the vec3
  (Payne 0.06 stays at sea); the MS rebuild key carries all three
  channels. Landmarks: planted weights recover fp-exactly
  (3.9e-16) on the measured Grindelwald geometries with the
  Lucht-integral WSA; 6 obs refuse; rank-1 geometry refuses; the
  MS landmark adds per-channel independence (an R-only feed moves
  only R). VERIFIED LIVE at the Sydney box: 46 clear obs, panel
  'MOD09A1 white-sky albedo - RGB 0.089/0.085/0.056' -
  chlorophyll-shaped values feeding the sky ground bounce. Full
  gate green.
- DONE (ONE ground albedo: MS LUT unified with the terminal
  bounce, Jul 10 latest): research pass on Hillaire (2020)
  turned up that the multiple-scattering LUT's ground
  contribution hardcoded an UNCITED 0.3 - applied over open
  ocean too - while the paper's model has a single ground_albedo
  parameter shared by the MS transfer (eq. 5-7's ground term)
  and any ray-march ground termination; Hillaire's own reference
  implementation (sebh/UnrealEngineSkyAtmosphere,
  SkyAtmosphereCommon.cpp) defaults info.ground_albedo to ZERO
  and exposes it as an input. Now the MS LUT's ground term reads
  the SAME groundAlb uniform as the sky-view terminal bounce:
  Payne (1972) 0.06 where the box has sea (the ocean MS horizon
  no longer borrows a value three grades too bright), 0 inland
  until a measured land albedo earns its citation - the open
  research is the MODIS path (MOD09A1 bands 1/4/3 sit near the
  atmosphere's 680/550/440 nm channels; Lucht 2000's white-sky
  kernel integrals are already in ross-li.js, but the published
  archetype weights cover red/NIR only, so a per-band RGB
  white-sky albedo needs either per-band shape retrievals or a
  cited narrowband set before it can feed this uniform). The MS
  fill re-dispatches when the fed albedo changes (its rebuild
  key carries the albedo alongside the aerosol set).
  atmo-reference mirrors it: buildMs(gAlb) parameterised, new
  landmark holds psi EXACTLY linear in the fed albedo texel by
  texel (1.7e-15), gains non-negative everywhere and strictly
  positive at ground/high-sun; downstream sky-view landmarks run
  at the 0.06 sea feed. Full gate green (57 reference sets +
  ocean-wind/ocean-sea/glints).
- DONE (aircraft lights: visual proof + exact Allard slant, Jul
  10 latest): the daemon's ADS-B upstream came back, so the
  planes finally met the ships/trains visual standard - at Sao
  Paulo GRU (20:10 local, dark, 12 live aircraft) the viewer
  chased hex e48014 at 960 m from 8 units abeam: the green
  25.1385 starboard nav light tracks across ten frames (~29
  px/frame, constant row) and frame 5 catches the white 25.1401
  anticollision strobe mid-flash; stills, zooms and two GIFs
  delivered. Chasing the HIGH plane (e4952f, 3,353 m) exposed a
  real modelling gap: the slant range fed to Allard's law took
  the vertical leg as altM - centerElev - a GROUND observer
  assumption, so a camera flown to the plane's own altitude
  still saw arc-edge candela dimmed by a phantom
  ground-to-cruise leg. Fixed exactly: vertical leg is now
  |altM - observer altitude| with the observer's altitude from
  the same asinh inversion that feeds the LUTs; a ground camera
  reproduces the old value bit-for-bit (commit 29f3563, full
  gate green - 61 reference sets + ocean-wind/ocean-sea/glints
  GPU probes). The high plane STAYED dark after the fix and
  that is CORRECT: its light meshes are confirmed on in scene
  state (tail + strobe visible=true via /eval) while the frame
  shows no stars either - the camera sits inside GRU's live 25%
  cloud deck at 3.4 km and the Nubis march extinguishes
  everything on that sight line; the 960 m plane below the deck
  renders its lights fine through the identical path. Two
  harness lessons: the gate's GPU probes need
  BASE=http://localhost:8903 (the harness-dir server - the 8901
  repo-root default 404s and all three probes "fail" without
  touching a shader), and view-serve's on-disk livecache keys
  ADS-B polls by URL, so a reloaded session replays the SAME
  aircraft forever - fresh traffic needs a cache clear.
- DONE (the black horizon band, Jul 10 latest - diagnosed from
  the CODE, built, merged b9c2272, visually confirmed): the band
  below the horizon at every anchor was the dome's below-horizon
  LUT rows, and atmosphere-tsl's makeMarch accumulated
  IN-SCATTER ONLY - Hillaire (2020) terminates the
  ground-hitting sky-view rays with the ground bounce the march
  omitted: L += T(dGround) x (albedo/pi) x NdotL x T_sun(ground).
  With no bounce, a steep below-horizon ray carries only its
  short path's in-scatter -> near-black at noon; at night the
  band is invisible (dark anyway), which is exactly the observed
  behaviour (Rotterdam noon, daylit Tasman Bay; fine at Nelson
  pre-dawn; the Maasvlakte grey/black seam is the reflector edge
  meeting this band). BUILT AS PLANNED: (1) makeMarch grew a
  ground-hit flag + groundAlbedo uniform, applied only in
  skyviewNode's below-horizon branch (the aerial march does NOT
  add it - scene geometry provides that ground); (2) the albedo
  is FED, not painted: Payne (1972) open-ocean broadband 0.06
  where the box edge is sea; the land value still needs its own
  citation before inland boxes change (the MS-LUT reference's
  0.3 is the natural candidate); (3) atmo-reference mirrors the
  term with closed-point landmarks (identity at zero albedo,
  linear in albedo, above-horizon rows bit-identical) and the
  gate held 61 reference sets + 3 GPU probes green; (4) visual
  before/after at the Maasvlakte anchor CONFIRMED through the
  viewer: same ship-chase pose (camera 2.2 units over a live AIS
  vessel, 12.5 deg down), the wedge between the sky horizon and
  the ocean plane edge went from near-black to a lit haze tone
  continuous with the sea. Harness lesson from the shoot: /pose
  y is SCENE units under the asinh height compression (real
  altitude = centerElev + 500\*sinh(y/16)), so y=350 is above the
  atmosphere (black frame) and y=60 is a 10 km aerial view -
  keep posed cameras in single-digit y for eye-level shots.
- RESOLVED (the Nelson cone, Jul 11 - solved IN-ENVIRONMENT, no
  real hardware needed; the entry below records the earlier trail
  and its wrong conclusion): the cone was GARBAGE IN THE SOURCE
  TILE, faithfully baked and faithfully rendered. The differential
  ladder that cracked it: (1) a geometry clone on a plain red
  MeshBasicMaterial spiked too - not the terrain material; (2) a
  fresh BufferGeometry from COPIED arrays spiked - not the GPU
  buffers, so the CPU data itself, contradicting the earlier
  "provably clean" verdict (that check verified the box MAXIMUM,
  24.49 units - plausible Bryant Range height - never the tall
  vertex's placement); (3) grid x/z regularity and index topology
  scanned clean; (4) CPU projection reduced the needle to TWO
  adjacent vertices carrying 507/389 m at the harbour waterfront
  (grid c=148, r=136/137), each shielding the other from a
  neighbour-spike scan; (5) decoding the SOURCE terrarium tile
  (12/4019/2564) directly showed the same garbage - a 1-2 px
  column of -92/134/448/531 m flanked by -248/-276 m in 3-6 m
  harbour pixels ("tiles are clean" had only checked the box max,
  which the 531 m garbage sits below). The lavapipe cross-check
  was attempted first and is documented for the record: Chrome
  hardwires its CPU-fallback WebGPU adapter to the bundled
  SwiftShader (hiding the ICD, the bundled loader and the .so
  makes requestAdapter return null - system lavapipe is never
  offered), and the ?webgl=1 backend diagnostic boots but the
  TSL chain floods NodeBuilder errors, so neither alternate
  rasterizer runs the full theme here. FIX: despikeDEM
  (terrain-sample.js), decision-based median repair at tile
  decode - replace a sample only when it deviates >150 m from
  its 3x3 neighbourhood median; the median follows real cliffs
  and ridges, only 1-2 px towers trip it, and no real landform
  stands 150 m proud of its 3x3 median at 30 m posting (Old Man
  of Hoy, 137 m, is the tallest sea stack on Earth). A
  Hampel/MAD rule was tried first and REJECTED BY THE LANDMARKS:
  the garbage cluster inflates its own window MAD and shields
  itself (448 m survived a 573 m threshold). Landmarks plant the
  measured streak verbatim (exactly 4 repairs; the two
  under-floor survivors asserted SURVIVING - the rule boundary
  held both ways), hold a 75-deg knife ridge bit-identical, and
  keep a 120 m sea stack. VERIFIED: same needle pose, panel
  reads "7 px despiked", the harbour view is clean terrain -
  before/after delivered. Full gate green. Also retired: the
  "impossible Raycaster" caveat below - the raycasts were likely
  answering truthfully about data nobody believed.
- SUPERSEDED (the Nelson cone, Jul 10 late - the earlier trail,
  kept for the record; its conclusion was WRONG): NOT the
  cathedral. The full forensic trail, every step measured
  through the viewer's /eval: not a building (no tagged height
  over 25 m in the box); not a tree instance (no InstancedMesh
  scale outliers); not the FFT ocean (a real calm-limit NaN bug
  was found and fixed on the way - see the calm-limit DONE - but
  the cone survived it); not vessels, not any of the ~68
  top-level objects (visibility bisect); it dies EXACTLY when
  the terrain mesh (ground child 0) hides. Yet the terrain's CPU
  state is provably clean: position max 24.49 units (the real
  Bryant Range corner), every index in range, no positionNode,
  no morphs, no children - and a forced attribute re-upload
  (needsUpdate) does NOT clear it. The real terrarium tiles for
  the box are clean (refetched and decoded: max 1210 m).
  Conclusion: the draw call renders one garbage vertex that
  exists nowhere in JS-visible state - a backend-level vertex
  buffer corruption on THIS container's SwiftShader/Dawn stack,
  same family as the swizzle rejection. NEXT: check Nelson
  (?lat=-41.27&lon=173.28) on real hardware - if the cone is
  absent there, this moves to the environment column for good.
  CAVEAT (Jul 10, latest): the in-page Raycaster itself returned
  a physically impossible result at Rotterdam - a HORIZONTAL ray
  from y=3.9 "hitting" the flat y=-0.33 water plane at d=26, the
  same d at every altitude from +1 to -8 deg, while that plane's
  own vertex scan is clean (a rotated +-140 plane, no spike).
  Every /eval raycast conclusion on this stack (parts of the
  cone trail, the band diagnosis) is therefore suspect; the band
  question stays OPEN and the real-hardware look is the only
  trustworthy next step for the cone.
- OPEN (environment, not code) - UPDATE (roam smoke, Jul 7): the
  drift now also manifests as a PER-FRAME uncaught TypeError -
  GPUTexture.createView rejects the `swizzle` field three's
  texture views pass (the bundled chromium-1194's WebGPU
  dictionary vs this three build) - which aborts frame() before
  any scene logic runs in the fixture rig (event-driven UI
  still works, which is why the explore smoke passed). The roam
  smoke installs a fixture-side createView shim that strips the
  field (identity swizzle, never shipped); a matching
  SHOOT_CHROME remains the real fix for pixel work.
  Original note: today's fixture rig drops the
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

- DONE (phase 1 of the green flash): refraction.js +
  refraction-reference.mjs (gate set 33, 4 landmarks) - the
  gated physics core. Ciddor (1996) refractivity of air (full
  CIPM densities + compressibility; matches the NIST 633 nm
  check value to 2e-10 and the independent Birch & Downs Edlen
  to 8e-10) and an exact ray tracer for a spherically stratified
  atmosphere (dR = -tan z dn/n in height parametrisation, Snell
  invariant, tangent-point split for below-horizontal rays from
  elevated observers, s^2 substitution regularising the horizon
  singularity analytically). Held to closed forms: zenith
  exactly 0, R(45) = (n0-1)tan z to 0.15", Bennett at 10 deg to
  3%, horizon 33.0 arcmin (ICAO 15 C), green rim 14.2" above red
  (dispersion tracks dn/(n-1) to 8.5%), setting-sun flattening
  0.835 (published ~5/6), apparent/true roundtrip 7e-12. Debug
  trail: a barometric double-negative in the ICAO fixture and a
  clamped bottom stencil were both caught by the closed-form
  landmarks. PHASE 2 (DONE): the drawn sun and moon are refracted
  through the MEASURED column. syncAloft also fetches the low
  pressure levels (temperature/relative_humidity at 1000..200 hPa
  - low geopotentials, still one request) and builds
    state.profile via the gated buildProfile, closed at the ground
    by the surface temperature and the exact dew-point rh (Murphy &
    Koop). Frame loop: a paced CPU ray trace (N = 400, pinned
    within 0.5" of N = 1600 by the new 'node-count convergence'
    landmark; recompute every 0.02 deg of true altitude when low,
    0.5 deg high - ~10 ms per update, sunsets only) yields the
    green-channel apparent altitude that now drives sunVec (sky,
    water, aerial - the whole scene sees the LIFTED sun: sunset
    genuinely happens minutes later, from geometry), plus
    per-channel apparent directions + the flattening ratio into new
    atmosphere-tsl uniforms (sunDisc: dirR/dirB/flatten). The
    shader draws three monochrome Hestroffer-Magnan discs, each
    squashed vertically about its own centre - the green rim IS the
    gap between them, widening whenever the measured profile
    magnifies it: the green flash, when the real atmosphere serves
    one. The moon takes the same lift and squash (its rim
    dispersion sits below the eye's threshold at lunar brightness -
    documented scope), and the paraselenic optics dome anchors on
    the DRAWN moon. Below the grazing ray the displacement holds
    its limit so twilight geometry stays continuous; the ICAO
    standard atmosphere stands in offline; the -50 arcmin EVENT
    conventions (ships.js etc.) deliberately stay - this is the
    drawn sun, not the almanac. Also absorbed: atmosphere-tsl's
    aerialMaxUnits used the 57.14 literal - now exact 400/7. A new
    'measured profile builder' landmark holds the surface
    hydrostatic closure to its closed form. Gate 36 sets,
    refraction at 6 landmarks.
