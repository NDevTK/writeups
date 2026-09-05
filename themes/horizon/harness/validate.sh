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
for name in ozone no2 cloud-corona cloud-climatology cloudtop creff moonlight overcast adaptation stars-color varstars planets-color stratos volcanic gvp bishop psc aureole ocean atmo moon lunar-umbra optics surf glint coxmunk whitecap aurora steve leadr radar igrf scintillation ross-li cn2 airglow gwaves zodiacal meteors gmn comets cobs contrails ships navlights aircraft airline wildfire lightning sprites blondel tides milkyway earthshine nlc sats satmags eclipses skyglow rainbow fogbow mie halos explore roam solarwind metar sounding buoy seasmoke clearness closure refraction smoke terrain-sample far-terrain leewave hindcast nz rayleighpol beads kcorona looming lehn fleagle surfacelayer coolskin warmlayer wetground observatory spectral sunspots lakes buildings facade roads landuse rivers rails trains aerialways turbines wakes peaks snowcover snowage snotel seaice meltpond lakeice grib2 aerosol aeronet pollen nightlights lightpillars morel ocean-glint ocean-color ocean-measured-color vegetation land-color surface-color spectral-color crops livery forest grassland bldlod linelod veglod kelvin corona waterfalls powerlines geotiles modis-land phenology server; do
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
  # Fail fast on a mispointed BASE: the probes 404 quietly (seven
  # slow no-capture failures) when the fixture server's root is
  # the repo instead of this harness directory - measured, twice.
  if ! curl -sf -o /dev/null --max-time 10 "$BASE/tsl-ocean-num.html"; then
    echo "[FAIL] BASE $BASE does not serve the harness pages"
    echo "       (serve THIS directory, or set BASE=.../themes/horizon/harness)"
    fail=1
  fi
  probe() { # name url pass_regex
    local out
    out=$(timeout 240 xvfb-run -a node shoot.mjs "$2" /dev/null --wgpu \
      --wait-console 'DONE' 2>&1)
    if echo "$out" | grep -qaE "$3" && ! echo "$out" | grep -qaE 'FAIL|ERR '; then
      echo "[ok]   $1"
    else
      echo "[FAIL] $1"
      echo "$out" | grep -aE 'OCEAN|GLINT|PROBE' | tail -6
      # The filtered view hides launcher-level failures (a dead
      # fixture server, a chrome that never started) - keep the
      # raw transcript for the post-mortem.
      echo "$out" > "/tmp/validate-gpu-$1.raw"
      echo "       raw -> /tmp/validate-gpu-$1.raw ($(echo "$out" | wc -l) lines)"
      fail=1
    fi
  }
  probe ocean-wind "$BASE/tsl-ocean-num.html" 'TEXELS PASS'
  probe ocean-sea "$BASE/tsl-ocean-num.html?sea=1" 'TEXELS PASS'
  probe glints "$BASE/tsl-glint-probe.html" 'HASH PASS'
  probe sunset-band "$BASE/tsl-band-probe.html" 'BAND PASS'
  probe dm-column "$BASE/tsl-dm-probe.html" 'DM PASS'
  probe drop-corona "$BASE/tsl-dropcorona-probe.html" 'DROPCOR PASS'
  probe bow-shaft "$BASE/tsl-bow-probe.html" 'BOWP PASS'

  # The page wiring: the research section must render inside the
  # THEME itself - the panels' module graph imports, syncResearch
  # survives, refreshPanel prints. Wiring is gated either way the
  # feeds land: a live ascent must show the flash and retrieval
  # lines; no ascent must show the mirage line's fail-closed text.
  # (The 124th-129th panels were hand-verified per pass; this
  # probe owns that check now.)
  PAGEBASE="${BASE%/themes/horizon/harness}"
  if [ "$PAGEBASE" = "$BASE" ]; then
    echo "[skip] page-wiring (BASE carries no repo root above the harness)"
  else
    ptxt=$(mktemp)
    timeout 240 xvfb-run -a node shoot.mjs \
      "$PAGEBASE/themes/Horizon.html?debug=1" /dev/null --wgpu \
      --wait-ms 50000 --dump-text "$ptxt" >/dev/null 2>&1
    if grep -qa "research · the drawn world diagnosed" "$ptxt" &&
      grep -qa "mirage (measured column)" "$ptxt" &&
      { grep -qa "no fresh ascent" "$ptxt" ||
        { grep -qa "green flash tonight (Young)" "$ptxt" &&
          grep -qa "mirage inversion retrieval (Lehn 1983)" "$ptxt"; }; }; then
      echo "[ok]   page-wiring (research section renders in the theme)"
    else
      echo "[FAIL] page-wiring"
      grep -a "research\|mirage\|green flash" "$ptxt" | head -4
      echo "       $(wc -l <"$ptxt") lines of page text -> $ptxt"
      fail=1
    fi
  fi
fi

if [ $fail = 0 ]; then echo "VALIDATE PASS"; else echo "VALIDATE FAIL"; fi
exit $fail
