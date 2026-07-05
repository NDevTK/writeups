#!/usr/bin/env python3
"""Regenerate the fixture-harness theme page from the repo theme.

One authoritative script (the inline variants drifted): injects the
offline fetch stub, rewrites terrarium tiles to local fixtures, adds
the record() console logger, the WebGPU swizzle shim (this chromium
predates GPUTextureViewDescriptor.swizzle), and the __capture hook
that replays one full frame (prepass, main, cloud composite, overlay)
into a render target for the shoot.mjs driver - composited
screenshots cannot see GPU surfaces under Xvfb.
"""
import os
import sys

SITE = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('HARNESS_SITE')
THEME = (
    sys.argv[2]
    if len(sys.argv) > 2
    else os.path.join(os.path.dirname(__file__), '..', '..', 'Horizon.html')
)
assert SITE, 'usage: regen.py <site-dir> [theme-html]'
OUT = SITE + '/writeups/themes/Horizon-dbg.html'

STUB = (
    '<script src="../../../osm-fixtures.js"></script>'
    '<script>/* swizzle shim */ if (navigator.gpu && self.GPUTexture) {'
    ' const ov = GPUTexture.prototype.createView;'
    " GPUTexture.prototype.createView = function (d) { if (d && 'swizzle' in d)"
    ' { d = Object.assign({}, d); delete d.swizzle; } return ov.call(this, d); }; }'
    '</script>'
    '<script>const realFetch = window.fetch; window.fetch = (url, opts) => {'
    ' url = String(url);'
    ' if (url.includes("stars.json") || url.includes("rapier") || url.includes("constellations"))'
    ' return realFetch(url, opts);'
    ' if (url.includes("interpreter?data=")) {'
    ' const suffix = url.split("interpreter?data=")[1];'
    ' for (const [k, v] of Object.entries(window.OSM_FIXTURES))'
    ' { if (k.endsWith(suffix)) return Promise.resolve(new Response(v)); } }'
    ' return Promise.reject(new Error("offline test")); };</script>'
    # Deterministic clock for cross-backend A/B of animated scenes
    # (clouds advect with uTime; two wall-clock runs sample different
    # times). pin=1 feeds rAF callbacks synthetic 60 Hz timestamps and
    # seeds Math.random; at frame pinstop (default 600) the clock
    # FREEZES but rAF keeps dispatching - dt becomes 0, uTime stops,
    # so the frame is capture-time-invariant, while three's WebGL
    # fence polling (which rides rAF) stays alive. A hard rAF stop
    # deadlocks readRenderTargetPixelsAsync on the WebGL backend.
    '<script>{ const P = new URLSearchParams(location.search);'
    ' if (P.get("pin")) {'
    ' const STOP = +(P.get("pinstop") || 600);'
    ' const raf = window.requestAnimationFrame.bind(window);'
    ' let f = 0, synth = 5000;'
    ' performance.now = () => synth;'
    ' window.requestAnimationFrame = (cb) =>'
    ' raf(() => {'
    ' f++;'
    ' if (f % 100 === 0) console.log("PINFRAME|" + f);'
    ' if (f <= STOP) synth = 5000 + (f * 1000) / 60;'
    ' else if (f === STOP + 1) console.log("PINSTOP|" + STOP);'
    ' cb(synth);'
    ' });'
    ' let seed = 12345 >>> 0;'
    ' Math.random = () =>'
    ' (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;'
    ' } }</script>'
)

CAPTURE = """
      // Harness capture: replay one full frame (prepass, main render,
      // cloud composite, precip overlay) into a render target and
      // read it back - the compositor cannot capture GPU surfaces
      // under Xvfb, and WebGPU canvases recycle their texture.
      window.__r = renderer;
      window.__THREE = THREE;
      window.__capture = async (w, h) => {
        const cap = (s) => console.log('CAP|' + s);
        cap('start');
        const rt = new THREE.RenderTarget(w, h);
        camera.updateMatrixWorld();
        if (cloudsActive) {
          const mask = camera.layers.mask;
          scene.overrideMaterial = depthOnlyMat;
          camera.layers.mask = 1 << 3;
          renderer.setRenderTarget(cloudDepthRT);
          renderer.render(scene, camera);
          camera.layers.mask = mask;
          scene.overrideMaterial = null;
          cloudSys.render(camera, cloudDepthRT.depthTexture);
        }
        cap('main');
        renderer.setRenderTarget(rt);
        renderer.render(scene, camera);
        if (cloudsActive) cloudSys.composite();
        cap('overlay');
        {
          const mask = camera.layers.mask;
          camera.layers.mask = 1 << 4;
          renderer.autoClear = false;
          renderer.render(scene, camera);
          renderer.autoClear = true;
          camera.layers.mask = mask;
        }
        renderer.setRenderTarget(null);
        cap('readback');
        const buf = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, w, h);
        cap('done');
        rt.dispose();
        return buf;
      };
"""

s = open(THEME).read()
s = s.replace(
    "'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/' +", "'/tiles/' +"
)
assert '/tiles/' in s
s = s.replace(
    """      function record(name, value) {
        sources[name] = {value: String(value), at: Date.now()};
      }""",
    """      function record(name, value) {
        sources[name] = {value: String(value), at: Date.now()};
        console.log('REC|' + name + '|' + value);
      }""",
)
anchor = '      // ---------- main loop ----------'
assert s.count(anchor) == 1
s = s.replace(anchor, CAPTURE + anchor)
i = s.index('<script type="module">')
import tempfile

fd, tmp = tempfile.mkstemp(dir=os.path.dirname(OUT))
with os.fdopen(fd, 'w') as fh:
    fh.write(s[:i] + STUB + s[i:])
os.replace(tmp, OUT)  # atomic: shots may be loading the page right now
print('regenerated', OUT)
