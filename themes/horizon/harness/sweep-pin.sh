#!/bin/bash
# Deterministic (pin=1) smoke matrix on WebGPU (the build is
# WebGPU-only; the WebGL2 backend - and with it A/B testing - was
# deleted). Shots exist for PAGEERROR detection and visual
# inspection only; correctness rests on the CPU double-precision
# references (ocean/atmo/moon/optics/surf/glint *-reference.mjs)
# and the numeric probe pages that read GPU texels back against
# them.
#
# Env:
#   SHOOT_CHROME  Chrome for Testing binary (headed launch under Xvfb)
#   BASE          harness server origin (default http://localhost:8901)
# Nelson note: the planar-reflector water renders the scene twice and
# crawls on SwiftShader Vulkan (~1.2 fps) - it gets a 900 s budget.
cd "$(dirname "$0")"
BASE=${BASE:-http://localhost:8901}
declare -A SC=(
  [noon]='lat=46.62&lon=8.04&time=2026-07-04T12:00&cloud=25&code=2'
  [sunset]='lat=46.62&lon=8.04&time=2026-07-04T19:10&cloud=30&code=2'
  [night]='lat=46.62&lon=8.04&time=2026-06-29T22:30&cloud=5&code=0'
  [stratus]='lat=46.62&lon=8.04&time=2026-07-04T12:00&cloud=90&code=3'
  [towering]='lat=46.62&lon=8.04&time=2026-07-04T15:00&cloud=70&code=95'
  [nelson]='lat=-41.27&lon=173.28&time=2026-07-04T12:00&cloud=15&code=1&wind=28'
  [snow]='lat=46.62&lon=8.04&time=2026-07-04T09:00&temp=-3&code=73&snow=2&cloud=90'
  [aurora]='lat=64.13&lon=-21.9&time=2026-01-15T23:30&aurora=0.85&auroralat=67&cloud=5'
)
for k in noon sunset night stratus towering nelson snow aurora; do
  budget=420; wait=360000
  if [ $k = nelson ]; then budget=900; wait=780000; fi
  timeout $budget xvfb-run -a -s "-screen 0 1400x900x24" node shoot.mjs \
    "$BASE/writeups/themes/Horizon-dbg.html?${SC[$k]}&pin=1" \
    "pin-$k.ppm" --wgpu --wait-console 'PINSTOP' --wait-ms $wait 2>&1 \
    | grep -aE '\|(SHOT|PAGEERROR)\|' | sed "s/^/[$k] /"
done
echo PIN-SWEEP-DONE
