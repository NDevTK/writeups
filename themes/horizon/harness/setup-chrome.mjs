// setup-chrome.mjs - make the harness bring its OWN current Chrome.
//
// The GPU probes need a CURRENT Chrome for Testing: the theme is a real
// WebGPU scene and Dawn moves fast (e.g. GPUTextureComponentSwizzle and
// implicit 2D views of 3D textures, which an older build rejects). The
// box's pinned Playwright chromium is frequently months behind, so the
// harness must NOT test on it. This resolves the latest Chrome-for-
// Testing Stable, downloads chrome-linux64 once, caches it by version,
// and returns the binary path.
//
// Order of resolution:
//   1. $SHOOT_CHROME, if it points at a real binary  (explicit override)
//   2. a cached download of the current CfT Stable    (the normal path)
//   3. fetch + unzip the current CfT Stable, then cache it
//   4. the pinned Playwright chromium                 (offline fallback)
//
// Network + unzip go through curl/unzip (execSync) so the agent proxy
// and its CA bundle are honoured exactly as elsewhere in the repo.
import {execSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const VERSIONS_URL =
  'https://googlechromelabs.github.io/chrome-for-testing/' +
  'last-known-good-versions-with-downloads.json';

const PINNED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CACHE_ROOT = join(tmpdir(), 'cft-cache');

const sh = (cmd) =>
  execSync(cmd, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
const isExe = (p) => {
  try {
    return !!p && existsSync(p);
  } catch {
    return false;
  }
};

// The chrome-linux64 zip lays down a folder of that name; find the
// `chrome` binary inside the extracted tree.
function binIn(dir) {
  const direct = join(dir, 'chrome-linux64', 'chrome');
  if (existsSync(direct)) return direct;
  // fall back to a shallow search in case the layout shifts
  try {
    for (const e of readdirSync(dir, {withFileTypes: true})) {
      if (e.isDirectory()) {
        const c = join(dir, e.name, 'chrome');
        if (existsSync(c)) return c;
      }
    }
  } catch {}
  return null;
}

// Resolve {version, url} for the current Stable linux64 chrome build.
function resolveStable() {
  const json = JSON.parse(sh(`curl -fsSL ${JSON.stringify(VERSIONS_URL)}`));
  const stable = json && json.channels && json.channels.Stable;
  if (!stable || !stable.version) throw new Error('no Stable channel');
  const dl = ((stable.downloads || {}).chrome || []).find(
    (d) => d.platform === 'linux64'
  );
  if (!dl || !dl.url) throw new Error('no linux64 chrome download');
  return {version: stable.version, url: dl.url};
}

let cached = null;

/**
 * Return an absolute path to a Chrome binary the harness may launch,
 * downloading the current Chrome-for-Testing Stable if needed. Never
 * throws: on any failure it falls back to the pinned browser so the
 * harness still runs (the GPU gate will simply be on the old build).
 */
export async function ensureChrome() {
  if (cached) return cached;

  // 1. explicit override wins, no questions asked
  if (isExe(process.env.SHOOT_CHROME)) {
    cached = process.env.SHOOT_CHROME;
    return cached;
  }

  try {
    const {version, url} = resolveStable();
    const dir = join(CACHE_ROOT, version);
    let bin = binIn(dir);
    if (!bin) {
      mkdirSync(dir, {recursive: true});
      const zip = join(dir, 'chrome.zip');
      sh(`curl -fsSL ${JSON.stringify(url)} -o ${JSON.stringify(zip)}`);
      sh(`unzip -oq ${JSON.stringify(zip)} -d ${JSON.stringify(dir)}`);
      sh(`rm -f ${JSON.stringify(zip)}`);
      bin = binIn(dir);
    }
    if (bin && existsSync(bin)) {
      try {
        sh(`chmod +x ${JSON.stringify(bin)}`);
      } catch {}
      cached = bin;
      console.error(`[setup-chrome] using Chrome for Testing ${version}`);
      return cached;
    }
  } catch (e) {
    console.error(
      `[setup-chrome] auto-setup failed (${e.message}); using pinned`
    );
  }

  // 4. offline / failure fallback
  cached = PINNED;
  return cached;
}

// Allow `node setup-chrome.mjs` to just print the resolved path.
if (import.meta.url === `file://${process.argv[1]}`) {
  ensureChrome().then((p) => {
    console.log(p);
  });
}
