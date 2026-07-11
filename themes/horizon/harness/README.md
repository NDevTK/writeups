# Real-WebGPU validation harness

Offline, deterministic harness for `themes/Horizon.html` on
`WebGPURenderer` — real WebGPU (Dawn) via SwiftShader Vulkan. The
build is WebGPU-only (the WebGL2 backend - and with it A/B testing -
was deleted); correctness rests on the CPU double-precision
references (`../*-reference.mjs`) and the numeric probe pages that
read GPU texels back against them; the pinned matrix is a
smoke/visual run. Every architectural choice here was forced by a
measured failure; the full list and the matrix history live in
`../WEBGPU-PLAN.md` (section "Real-WebGPU harness").

One-time setup (ephemeral containers lose both):

    ln -sfn ../../.. writeups   # probe pages import ./writeups/themes/...
    npm install --no-save playwright-core

Pieces:

- `regen.py <site-dir> [theme-html]` — regenerates the fixture-served
  debug page (`Horizon-dbg.html`) from the repo theme: local DEM
  tiles, OSM fixture stub, console `record()` logger, the
  `GPUTextureViewDescriptor.swizzle` shim for older Chrome, the
  `window.__capture` full-frame render-target readback hook, and the
  `pin=1` deterministic clock (synthetic 60 Hz rAF timestamps, seeded
  `Math.random`, clock freeze at `pinstop` frames — freeze, not stop:
  three's WebGL fence polling rides rAF).
- `shoot.mjs <url> <out.ppm> [--wgpu] [--wait-console RE|--wait-ms N]`
  — spawns Chrome for Testing itself (headed, under `xvfb-run`;
  Playwright-launched browsers break Dawn), attaches via
  `connectOverCDP`, captures through `window.__capture` /
  `readRenderTargetPixelsAsync`, normalises readback row order,
  writes PPM. Needs
  `playwright-core` installed next to it and `SHOOT_CHROME` pointing
  at a Chrome for Testing binary
  (`npx @puppeteer/browsers install chrome@stable`).
- `validate.sh` — the reference-first gate and the ONE correctness
  entrypoint: all six CPU double-precision references, then the
  GPU-vs-reference probes asserting texels at the reference values.
  Nothing compares one render against another.
- `sweep-pin.sh` — the eight-scene pinned smoke matrix on WebGPU
  (PAGEERROR detection + visual inspection).
- `ppmdiff.py a.ppm b.ppm [diff.png]` — mean/max abs diff plus
  horizontal-band breakdown (PIL only).

Fixture site layout (not in the repo; rebuild per WEBGPU-PLAN.md):
`site/` mirrors the published site with `/tiles/{z}/{x}/{y}.png`
terrarium fixtures and `osm-fixtures.js`, served by
`python3 -m http.server 8901`.

## Asset viewer (design loop)

`asset-viewer.html` renders the shared `../vessels.js` fleet (the
SAME module the theme ships) in isolation, so asset geometry is
designed against actual renders instead of imagination:

    python3 -m http.server 8901   # from the repo root
    xvfb-run -a node shoot.mjs \
      "http://localhost:8901/themes/horizon/harness/asset-viewer.html" \
      out.ppm --wgpu --wait-console DONE

`?cls=cargo` isolates one class; `?az/el/d/yaw` orbit; `?len/beam`
override the measured size. Composited screenshots are blank for
WebGPU surfaces - shoot.mjs's readback path is the camera.
