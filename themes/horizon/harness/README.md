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
- `sweep-pin.sh` — the eight-scene pinned smoke matrix on WebGPU
  (PAGEERROR detection + visual inspection).
- `ppmdiff.py a.ppm b.ppm [diff.png]` — mean/max abs diff plus
  horizontal-band breakdown (PIL only).

Fixture site layout (not in the repo; rebuild per WEBGPU-PLAN.md):
`site/` mirrors the published site with `/tiles/{z}/{x}/{y}.png`
terrarium fixtures and `osm-fixtures.js`, served by
`python3 -m http.server 8901`.
