# firefox-wasm

Self-hosted [`firefox-wasm`](https://github.com/HeyPuter/firefox-wasm) v0.0.1 —
the `Gecko` engine compiled to WebAssembly — that powers the **Firefox** theme
(`../themes/Firefox.html`). The theme embeds this folder full-screen with
`?url=<page>`, so the writeup renders inside a real Firefox.

Built from the upstream `demo/chrome` source and shipped **unbundled**, as plain
ES modules (no bundler): the app entry (`main.js`) imports the prebuilt engine
library (`gecko.js`) and the tar/zstd helper (`chrome-fs.js` → `zstddec.js`)
natively. Everything is served same-origin; the only external calls are Google
Fonts and the `WISP` network proxy the engine browses through.

## Files

- `main.js` — app entry (from `demo/chrome/src/main.ts`). Auto-boots the engine
  (no Launch button) and opens the `?url` page via `gecko.evalChrome`. Reads a
  `WISP` endpoint from `?wisp=`, defaulting to a public open server.
- `chrome-fs.js` — mounts the Firefox front-end tar as the engine's GRE.
- `gecko.js` — the prebuilt engine library (inlines the emscripten glue, the
  pthread worker and the minimal GRE). The one large JS file.
- `zstddec.js` — zstd decoder (ES module).
- `styles.css` — splash styles.
- `gecko.wasm.zst` — the engine, zstd-compressed (~34 MB), decoded in-browser.
- `chrome-assets.tar.zst` / `chrome-assets.json` — the Firefox front-end
  (`browser/`) tree, decompressed into memory and mounted at `/gre`.
- `index.html` — host page; registers `../coi-serviceworker.js` so the build is
  cross-origin isolated (`SharedArrayBuffer`) and boots `browser.xhtml`.
- `logo.webp` — splash logo.

## Query parameters

- `url` — page to open in the first tab (default: the writeups site).
- `wisp` — `WISP` WebSocket endpoint for networking (also settable in the splash's
  advanced options). Without a reachable one, only `about:` / `data:` pages load.

## Rebuilding

Stage `gecko.js/dist/` and `demo/chrome/public/chrome-assets.*` from the v0.0.1
release, then `pnpm --filter chrome-demo` and transpile `src/*.ts` to ES modules
(`esbuild --format=esm`, no bundle). Requires `WebAssembly` JSPI in the viewer's
browser (Chrome 137+; Firefox behind an `about:config` flag).
