// Proper harness driver for real-WebGPU (and WebGL) validation.
//
// Architecture, each piece forced by a measured failure:
// - HEADED chromium under Xvfb: headless Dawn loses its instance.
// - The driver SPAWNS chromium itself and connects via
//   connectOverCDP: any Playwright-launched browser (default args,
//   ignoreAllDefaultArgs, incognito or persistent context) breaks
//   Dawn's instance (mapAsync -> "external Instance reference no
//   longer exists"), while a plain spawn with the same flags works.
// - Capture is a render-target readback through three itself (pages
//   expose window.__r/__scene/__cam/__THREE): composited screenshots
//   are blank for GPU surfaces under Xvfb and WebGPU canvases
//   recycle their texture on present, so neither the compositor nor
//   toDataURL sees the frame. Output is PPM (PIL-readable).
//
// Usage:
//   xvfb-run -a node shoot.mjs <url> <out.ppm> [opts]
// opts:
//   --wgpu            enable WebGPU (otherwise SwiftShader GL only)
//   --wait-ms N       settle time before capture (default 20000)
//   --wait-console R  capture as soon as a console line matches R
//   --reduced-motion  emulate prefers-reduced-motion
import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {writeFileSync, readFileSync, rmSync} from 'node:fs';
import {ensureChrome} from './setup-chrome.mjs';

const [url, out, ...rest] = process.argv.slice(2);
const has = (f) => rest.includes(f);
const val = (f, d) => {
  const i = rest.indexOf(f);
  return i >= 0 ? rest[i + 1] : d;
};
const waitMs = +val('--wait-ms', 20000);
const waitRe = val('--wait-console', null);
const port = 9000 + ((Math.abs(process.pid) % 900) | 0);

const profile = `/tmp/shoot-profile-${process.pid}`;
const args = [
  '--no-sandbox',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking', // no Chrome telemetry through the route
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${port}`,
  '--window-size=1300,760',
  'about:blank'
];
if (has('--wgpu')) args.unshift('--enable-unsafe-webgpu');
else args.unshift('--use-angle=swiftshader');

const exe = await ensureChrome();
const proc = spawn(exe, args, {stdio: 'ignore'});
process.on('exit', () => {
  try {
    proc.kill('SIGKILL');
    rmSync(profile, {recursive: true, force: true});
  } catch {}
});

// wait for the CDP endpoint
let browser = null;
for (let i = 0; i < 60 && !browser; i++) {
  try {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!browser) throw new Error('CDP connect failed');

const ctx = browser.contexts()[0];
const page = ctx.pages()[0] || (await ctx.newPage());
if (has('--reduced-motion')) await page.emulateMedia({reducedMotion: 'reduce'});
await page.setViewportSize({width: 1280, height: 720});

// The launched Chrome cannot egress directly (its CONNECT tunnels reset
// under the sandbox) and its --proxy-server tunnels reset too, so every
// non-local request is answered server-side through curl - which DOES
// honour the agent proxy, the same mechanism view-serve.mjs uses. A page
// that fetches live data (the theme now calls the CORS-open feeds itself)
// thus reaches the network "like the curl version". Localhost (the
// fixture server) stays direct.
let curlN = 0;
const curlFetch = (method, u, body) =>
  new Promise((resolve) => {
    const tmp = `/tmp/shoot-curl-${process.pid}-${curlN++}.body`;
    const args = [
      '-sS',
      '--max-time',
      '30',
      '-X',
      method,
      '-o',
      tmp,
      '-w',
      '%{http_code}\t%{content_type}',
      u
    ];
    if (body && body.length) args.push('--data-binary', '@-');
    const p = spawn('curl', args);
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    if (body && body.length) p.stdin.end(body);
    else p.stdin.end();
    p.on('close', (code) => {
      try {
        if (code !== 0)
          return resolve({buf: Buffer.alloc(0), status: 502, type: ''});
        const [status, type] = out.split('\t');
        const buf = readFileSync(tmp);
        resolve({buf, status: +status || 502, type: type || ''});
      } catch {
        resolve({buf: Buffer.alloc(0), status: 502, type: ''});
      } finally {
        rmSync(tmp, {force: true});
      }
    });
  });
await page.route(
  (u) =>
    !u.href.startsWith('http://localhost') &&
    !u.href.startsWith('http://127.0.0.1'),
  async (route) => {
    const req = route.request();
    try {
      const {buf, status, type} = await curlFetch(
        req.method(),
        req.url(),
        req.postDataBuffer()
      );
      await route.fulfill({status, contentType: type, body: buf});
    } catch {
      await route.abort();
    }
  }
);

const t0 = Date.now();
const ts = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
let matched = null;
const matchedPromise = new Promise((res) => (matched = res));
page.on('console', (m) => {
  const text = m.text();
  console.log(ts() + '|CONSOLE|' + text.slice(0, 300));
  if (waitRe && new RegExp(waitRe).test(text)) matched(true);
});
page.on('pageerror', (e) =>
  console.log(ts() + '|PAGEERROR|' + e.message.slice(0, 300))
);

await page.goto(url, {waitUntil: 'load', timeout: 90000});
if (waitRe) {
  await Promise.race([
    matchedPromise,
    new Promise((r) => setTimeout(r, waitMs))
  ]);
  await page.waitForTimeout(250);
} else {
  await page.waitForTimeout(waitMs);
}

// Pages may expose window.__capture(w, h) -> RGBA buffer for
// multi-pass frames; otherwise the generic scene re-render is used.
// Rows are normalised to top-origin: WebGL-backend readbacks are
// bottom-origin, WebGPU's are top-origin.
const rtShot = await page
  .evaluate(async () => {
    if (!window.__r) return null;
    const r = window.__r;
    const T = window.__THREE;
    const w = 1280;
    const h = 720;
    let buf;
    if (window.__capture) {
      buf = await window.__capture(w, h);
    } else {
      const rt = new T.RenderTarget(w, h);
      r.setRenderTarget(rt);
      r.render(window.__scene, window.__cam);
      r.setRenderTarget(null);
      buf = await r.readRenderTargetPixelsAsync(rt, 0, 0, w, h);
      rt.dispose();
    }
    const flip = !r.backend.isWebGPUBackend;
    const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    let bin = '';
    for (let i = 0; i < u8.length; i += 32768)
      bin += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
    return {w, h, bpe: buf.BYTES_PER_ELEMENT, flip, b64: btoa(bin)};
  })
  .catch((e) => {
    console.log('SHOT|evaluate-error|' + String(e).slice(0, 400));
    return null;
  });

if (rtShot && rtShot.bpe === 1) {
  const px = Buffer.from(rtShot.b64, 'base64');
  const hdr = Buffer.from(`P6\n${rtShot.w} ${rtShot.h}\n255\n`);
  const rgb = Buffer.alloc(rtShot.w * rtShot.h * 3);
  for (let y = 0; y < rtShot.h; y++) {
    const sy = rtShot.flip ? rtShot.h - 1 - y : y;
    for (let x = 0; x < rtShot.w; x++) {
      const i = (sy * rtShot.w + x) * 4;
      const j = (y * rtShot.w + x) * 3;
      rgb[j] = px[i];
      rgb[j + 1] = px[i + 1];
      rgb[j + 2] = px[i + 2];
    }
  }
  writeFileSync(out, Buffer.concat([hdr, rgb]));
  console.log(ts() + '|SHOT|rt|' + out);
} else if (rtShot) {
  console.log(ts() + '|SHOT|rt-unsupported-bpe|' + rtShot.bpe);
} else {
  console.log(ts() + '|SHOT|no-capture');
}
await browser.close();
process.exit(0);
