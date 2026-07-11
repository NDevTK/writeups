#!/bin/bash
# The reference-first validation gate - the project's ONE correctness
# entrypoint. No comparisons between renders: every check is against
# ground truth.
#   1. CPU double-precision references (node): each *-reference.mjs
#      recomputes its physics from the papers and prints/holds its
#      landmarks - a non-zero exit fails the gate.
#   2. GPU-vs-reference probes (Chrome + fixture server): pages that
#      read GPU texels back and assert them AT the reference values
#      (ocean wind + measured-sea modes, glint hash/counts bit-exact,
#      compute-primitive conventions).
# The pinned scene matrix (sweep-pin.sh) is a separate smoke/visual
# run and not part of this gate.
#
# Env for step 2 (same as sweep-pin.sh):
#   SHOOT_CHROME  Chrome for Testing binary (headed launch under Xvfb)
#   BASE          harness server origin (default http://localhost:8901)
# Step 2 is skipped (gate still meaningful, reduced) if SHOOT_CHROME
# is unset.
set -u
cd "$(dirname "$0")"
BASE=${BASE:-http://localhost:8901}
REFDIR=${REFDIR:-..} # where the *-reference.mjs live
fail=0

echo "== CPU references (double precision, ground truth) =="
for name in ocean atmo moon optics surf glint coxmunk aurora leadr radar igrf scintillation ross-li cn2 airglow zodiacal meteors comets contrails ships navlights aircraft lightning milkyway earthshine nlc sats eclipses skyglow rainbow halos explore roam solarwind metar clearness refraction smoke terrain-sample far-terrain spectral sunspots lakes buildings roads landuse rivers rails trains aerialways turbines wakes peaks snowcover grib2 aerosol nightlights morel ocean-color ocean-measured-color vegetation land-color surface-color crops livery forest server; do
  ref="$REFDIR/$name-reference.mjs"
  if [ ! -f "$ref" ]; then echo "[FAIL] $name-reference.mjs missing"; fail=1; continue; fi
  if out=$(node "$ref" 2>&1); then
    echo "[ok]   $(basename "$ref") ($(echo "$out" | wc -l) landmarks)"
  else
    echo "[FAIL] $(basename "$ref")"
    echo "$out" | tail -5
    fail=1
  fi
done

if [ -z "${SHOOT_CHROME:-}" ]; then
  echo "== GPU probes skipped (SHOOT_CHROME unset) =="
else
  echo "== GPU-vs-reference probes (WebGPU) =="
  probe() { # name url pass_regex
    local out
    out=$(timeout 240 xvfb-run -a node shoot.mjs "$2" /dev/null --wgpu \
      --wait-console 'DONE' 2>&1)
    if echo "$out" | grep -qaE "$3" && ! echo "$out" | grep -qaE 'FAIL|ERR '; then
      echo "[ok]   $1"
    else
      echo "[FAIL] $1"
      echo "$out" | grep -aE 'OCEAN|GLINT|PROBE' | tail -6
      fail=1
    fi
  }
  probe ocean-wind "$BASE/tsl-ocean-num.html" 'TEXELS PASS'
  probe ocean-sea "$BASE/tsl-ocean-num.html?sea=1" 'TEXELS PASS'
  probe glints "$BASE/tsl-glint-probe.html" 'HASH PASS'
  probe sunset-band "$BASE/tsl-band-probe.html" 'BAND PASS'
fi

if [ $fail = 0 ]; then echo "VALIDATE PASS"; else echo "VALIDATE FAIL"; fi
exit $fail
