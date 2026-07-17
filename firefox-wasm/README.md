# firefox-wasm

Self-hosted [`firefox-wasm`](https://github.com/HeyPuter/firefox-wasm) — the
`Gecko` engine compiled to WebAssembly — that powers the **Firefox** theme
(`../themes/Firefox.html`). The theme embeds this path with `?url=<page>` and the
in-browser Firefox opens that page.

Everything is served same-origin from this folder — nothing is fetched from
another site except the `WISP` network proxy (the transport the engine browses
through). Cross-origin isolation for `SharedArrayBuffer` is provided by
`../coi-serviceworker.js`, whose scope covers this path.

## Files

- `assets/app.js` — the built [v0.0.1](https://github.com/HeyPuter/firefox-wasm/releases/tag/v0.0.1)
  bundle, beautified. Inlines the emscripten glue, the pthread worker and the
  minimal GRE (`gecko.data`). One local edit: the initial page comes from the
  `url` query parameter (via `gecko.evalChrome("openTrustedLinkIn(...)")`)
  instead of a hardcoded site.
- `assets/app.css` — the bundle's styles.
- `gecko.wasm.zst` — the engine, zstd-compressed (~37 MB); the only large binary,
  decoded in-browser.
- `chrome-assets.tar.zst` / `chrome-assets.json` — the Firefox front-end
  (`browser/`) tree, decompressed into memory and mounted as the engine's GRE.
- `index.html` — host page. Registers the isolation service worker, then boots
  `chrome://browser/content/browser.xhtml` and navigates to `?url`.
- `logo.webp` — splash logo.

## Query parameters

- `url` — absolute URL to open in the first tab (default: the writeups site).
- `wisp` — `WISP` WebSocket endpoint used for networking. Also settable in the
  splash's advanced options. Without one, only `about:` / `data:` pages load.

## Updating the build

Replace `gecko.wasm.zst` + `chrome-assets.tar.zst` (+ `chrome-assets.json`) and
`assets/app.*` with a newer `make web` / release build, and re-apply the one
`openTrustedLinkIn` edit. Requires `WebAssembly` JSPI in the viewer's browser.
