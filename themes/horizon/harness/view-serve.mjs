// Persistent viewer for the theme under real WebGPU (SwiftShader
// Vulkan) with a control API - the visual-verification instrument.
//
//   xvfb-run -a node view-serve.mjs <url>
//
// Same spawn recipe as shoot.mjs (headed chromium + connectOverCDP;
// Playwright-launched browsers break Dawn's instance). All page
// fetches except localhost are answered server-side through curl
// with an on-disk cache (livecache/, keyed by method+url+body), so
// a scene replays byte-identical live data until the cache is
// cleared.
//
// Control API on :8905 (all GET):
//   /snap?name=N&w=&h=&fov=&noclouds=1&float=1&nospec=1
//        capture via the page's __capture bracket. Default writes
//        N.ppm (+ N.panel.txt); float=1 writes N.f32 (LE uint32
//        w,h + raw RGBA float32 - linear radiance); nospec=1 skips
//        the spectral display projection for the captured frame
//        (raw radiometry; see atmosphere-tsl spectralOn).
//   /aim?az=&alt=      look override (window.__look)
//   /pose?x=&y=&z=&az=&alt= | /pose?clear=1   exact camera pose
//   /astro /panel /trains /ships /planes      introspection
//   /eval?js=EXPR      run an expression in the page
import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  rmSync
} from 'node:fs';
import {createHash} from 'node:crypto';
import http from 'node:http';
import {ensureChrome} from './setup-chrome.mjs';

const url = process.argv[2];
if (!url) {
  console.error('usage: xvfb-run -a node view-serve.mjs <url>');
  process.exit(2);
}

const CACHE = new URL('./livecache/', import.meta.url).pathname;
mkdirSync(CACHE, {recursive: true});
const TYPES = {
  json: 'application/json',
  png: 'image/png',
  js: 'text/javascript'
};
const curlFetch = (method, u, body) =>
  new Promise((resolve) => {
    const key = createHash('sha256')
      .update(method + '\n' + u + '\n')
      .update(body || Buffer.alloc(0))
      .digest('hex');
    const bodyFile = CACHE + key + '.body';
    const metaFile = CACHE + key + '.meta';
    if (existsSync(bodyFile) && existsSync(metaFile)) {
      return resolve({
        buf: readFileSync(bodyFile),
        meta: JSON.parse(readFileSync(metaFile, 'utf8'))
      });
    }
    const args = [
      '-sS',
      '--max-time',
      '45',
      '-X',
      method,
      '-o',
      bodyFile + '.tmp',
      '-w',
      '%{http_code}\t%{content_type}',
      u
    ];
    if (body && body.length) {
      args.push('--data-binary', '@-');
    }
    const p = spawn('curl', args);
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    if (body && body.length) p.stdin.end(body);
    else p.stdin.end();
    p.on('close', (code) => {
      if (code !== 0 || !existsSync(bodyFile + '.tmp')) {
        return resolve({buf: Buffer.alloc(0), meta: {status: 502, type: ''}});
      }
      const [status, type] = out.split('\t');
      const meta = {status: +status || 502, type: type || ''};
      try {
        // cache only successes - failures retry next time
        if (meta.status >= 200 && meta.status < 400) {
          rmSync(bodyFile, {force: true});
          spawn('mv', [bodyFile + '.tmp', bodyFile]).on('close', () => {
            writeFileSync(metaFile, JSON.stringify(meta));
            resolve({buf: readFileSync(bodyFile), meta});
          });
        } else {
          const buf = readFileSync(bodyFile + '.tmp');
          rmSync(bodyFile + '.tmp', {force: true});
          resolve({buf, meta});
        }
      } catch {
        resolve({buf: Buffer.alloc(0), meta: {status: 502, type: ''}});
      }
    });
  });

// ---- browser ----
const port = 9200 + (process.pid % 700);
const profile = `/tmp/view-serve-${process.pid}`;
const args = [
  '--enable-unsafe-webgpu',
  '--no-sandbox',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${port}`,
  '--window-size=1300,760',
  'about:blank'
];
const exe = await ensureChrome();
const proc = spawn(exe, args, {stdio: 'ignore'});
process.on('exit', () => {
  try {
    proc.kill('SIGKILL');
    rmSync(profile, {recursive: true, force: true});
  } catch {}
});

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
await page.setViewportSize({width: 1280, height: 720});
page.on('console', (m) => console.log('CONSOLE|' + m.text().slice(0, 240)));
page.on('pageerror', (e) =>
  console.log('PAGEERROR|' + e.message.slice(0, 240))
);

// Server-side fetch for everything non-local: replayable data +
// no proxy/CORS surprises inside the page.
await page.route(
  (u) => !u.href.startsWith('http://localhost'),
  async (route) => {
    const req = route.request();
    try {
      const body = req.postDataBuffer();
      const {buf, meta} = await curlFetch(req.method(), req.url(), body);
      await route.fulfill({
        status: meta.status,
        contentType: meta.type || TYPES[req.url().split('.').pop()] || '',
        body: buf
      });
    } catch {
      await route.abort();
    }
  }
);
// No swizzle shim: setup-chrome guarantees a current Chrome for
// Testing that supports GPUTextureComponentSwizzle natively, so the
// render is the browser's real behaviour, not a stripped-channel
// approximation on an outdated build.
await page.goto(url, {waitUntil: 'load', timeout: 120000});
console.log('LOADED - control on :8905');

let busy = false;
async function snap(name, w, h, fov, noClouds, float32, noSpec) {
  if (busy) return {err: 'busy'};
  busy = true;
  try {
    if (fov > 0 || noClouds || noSpec)
      await page.evaluate(
        ([f, nc, ns]) => {
          if (f > 0) {
            window.__fovSave = window.__cam.fov;
            window.__cam.fov = f;
            window.__cam.updateProjectionMatrix();
          }
          if (nc) window.__noClouds = true;
          if (ns) window.__noSpectral = true;
        },
        [fov, noClouds, noSpec]
      );
    const shot = await page.evaluate(
      async ([w, h, fl]) => {
        if (!window.__capture) return null;
        const buf = await Promise.race([
          window.__capture(w, h, fl),
          new Promise((_, rej) => setTimeout(() => rej('timeout'), 420000))
        ]);
        const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        let bin = '';
        for (let i = 0; i < u8.length; i += 32768)
          bin += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
        return {w, h, b64: btoa(bin)};
      },
      [w, h, float32]
    );
    const panel = await page
      .evaluate(() => document.getElementById('panel').textContent)
      .catch(() => '');
    writeFileSync(name + '.panel.txt', panel);
    if (!shot) return {err: 'no-capture'};
    const px = Buffer.from(shot.b64, 'base64');
    if (float32) {
      const hdr32 = Buffer.alloc(8);
      hdr32.writeUInt32LE(shot.w, 0);
      hdr32.writeUInt32LE(shot.h, 4);
      writeFileSync(name + '.f32', Buffer.concat([hdr32, px]));
      return {ok: name + '.f32', bytes: px.length};
    }
    const hdr = Buffer.from(`P6\n${shot.w} ${shot.h}\n255\n`);
    const rgb = Buffer.alloc(shot.w * shot.h * 3);
    for (let i = 0, j = 0; j < rgb.length; i += 4, j += 3) {
      rgb[j] = px[i];
      rgb[j + 1] = px[i + 1];
      rgb[j + 2] = px[i + 2];
    }
    writeFileSync(name + '.ppm', Buffer.concat([hdr, rgb]));
    return {ok: name + '.ppm'};
  } catch (e) {
    return {err: String(e).slice(0, 300)};
  } finally {
    if (fov > 0 || noClouds || noSpec)
      await page
        .evaluate(() => {
          if (window.__fovSave) {
            window.__cam.fov = window.__fovSave;
            window.__cam.updateProjectionMatrix();
            window.__fovSave = 0;
          }
          window.__noClouds = false;
          window.__noSpectral = false;
        })
        .catch(() => {});
    busy = false;
  }
}

http
  .createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (o) => {
      res.writeHead(200, {'content-type': 'application/json'});
      res.end(JSON.stringify(o));
    };
    try {
      if (u.pathname === '/snap') {
        send(
          await snap(
            u.searchParams.get('name') || 'snap',
            +(u.searchParams.get('w') || 1280),
            +(u.searchParams.get('h') || 720),
            +(u.searchParams.get('fov') || 0),
            u.searchParams.has('noclouds'),
            u.searchParams.has('float'),
            u.searchParams.has('nospec')
          )
        );
      } else if (u.pathname === '/aim') {
        const az = +u.searchParams.get('az');
        const alt = +(u.searchParams.get('alt') || 0);
        await page.evaluate(([a, l]) => (window.__look = [a, l]), [az, alt]);
        send({look: [az, alt]});
      } else if (u.pathname === '/pose') {
        if (u.searchParams.has('clear')) {
          await page.evaluate(() => (window.__pose = null));
          send({pose: null});
        } else {
          const pose = {
            x: +u.searchParams.get('x'),
            y: +u.searchParams.get('y'),
            z: +u.searchParams.get('z'),
            az: +u.searchParams.get('az'),
            alt: +(u.searchParams.get('alt') || 0)
          };
          await page.evaluate((p) => (window.__pose = p), pose);
          send({pose});
        }
      } else if (u.pathname === '/astro') {
        send(
          await page.evaluate(() => {
            const a = window.__astro || {};
            const deg = (r) => (r / Math.PI) * 180;
            const f = (b) => b && {alt: deg(b.alt), az: deg(b.az)};
            return {sun: f(a.sun), moon: f(a.moon)};
          })
        );
      } else if (u.pathname === '/panel') {
        send({
          panel: await page.evaluate(
            () => document.getElementById('panel').textContent
          )
        });
      } else if (u.pathname === '/trains') {
        send(await page.evaluate(() => window.__trains || []));
      } else if (u.pathname === '/ships') {
        send(await page.evaluate(() => window.__ships || []));
      } else if (u.pathname === '/planes') {
        send(await page.evaluate(() => window.__planes || []));
      } else if (u.pathname === '/eval') {
        const src = u.searchParams.get('js') || 'null';
        send({
          result: await page.evaluate(
            (s) => new Function('return (' + s + ')')(),
            src
          )
        });
      } else {
        send({err: 'unknown'});
      }
    } catch (e) {
      send({err: String(e).slice(0, 300)});
    }
  })
  .listen(8905, () => console.log('control listening on 8905'));
