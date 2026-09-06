#!/bin/bash
# horizon-live installer for a fresh Ubuntu box (22.04/24.04).
# Idempotent - safe to re-run after edits. Review before running;
# it is short on purpose. Usage (from this directory):
#   sudo ./install.sh
# then:
#   sudo nano /etc/horizon-live.env     # put the real key in
#   sudo systemctl restart horizon-live
#   curl -s localhost:8127/health
set -euo pipefail
cd "$(dirname "$0")"

# Node >= 22 (built-in WebSocket client). NodeSource keeps Ubuntu's
# apt workflow; Ubuntu's own nodejs is too old.
if ! command -v node >/dev/null || [ "$(node -e 'console.log(+process.versions.node.split(".")[0])')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# Caddy for TLS (skip if you terminate TLS elsewhere).
if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key |
    gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    >/etc/apt/sources.list.d/caddy-stable.list
  apt-get update && apt-get install -y caddy
fi

# The daemon: zero npm dependencies. It imports the lightning
# geometry and the solar-wind physics, so ship those files too.
mkdir -p /opt/horizon-live
rm -rf /opt/horizon-live/worker
# Stage the entry point BESIDE the live one: the drift guard below
# must run before anything replaces /opt/horizon-live/index.mjs,
# or a guard hit leaves an unloadable file in place and the next
# Restart=always bounce crash-loops the running service.
install -m 644 src/index.mjs /opt/horizon-live/index.mjs.new
install -m 644 ../lightning.js /opt/horizon-live/lightning.js
install -m 644 ../solarwind.js /opt/horizon-live/solarwind.js
install -m 644 ../metar.js /opt/horizon-live/metar.js
install -m 644 ../smoke.js /opt/horizon-live/smoke.js
install -m 644 ../grib2.js /opt/horizon-live/grib2.js
install -m 644 ../aerosol.js /opt/horizon-live/aerosol.js
install -m 644 ../aeronet.js /opt/horizon-live/aeronet.js
install -m 644 ../gmn.js /opt/horizon-live/gmn.js
install -m 644 ../gvp.js /opt/horizon-live/gvp.js
install -m 644 ../sounding.js /opt/horizon-live/sounding.js
install -m 644 ../contrails.js /opt/horizon-live/contrails.js
install -m 644 ../buoy.js /opt/horizon-live/buoy.js
install -m 644 ../cobs.js /opt/horizon-live/cobs.js
install -m 644 ../ozone.js /opt/horizon-live/ozone.js
install -m 644 ../modis-land.js /opt/horizon-live/modis-land.js
# NOAA's L2 cloud products (148th pass): the pure HDF5 reader, the
# fixed-grid navigation and the satellite table the /goesl2 route
# imports (none of the three imports anything itself).
install -m 644 ../hdf5.js /opt/horizon-live/hdf5.js
install -m 644 ../goesl2.js /opt/horizon-live/goesl2.js
install -m 644 ../satellites.js /opt/horizon-live/satellites.js
# The shared L2 decode block (155th pass; imports './hdf5.js' and
# './goesl2.js', both flat here). Its absence from this list is why
# the box refused every revision from the 155th to the 157th: the
# drift guard below did its job and the old build stayed (158th).
install -m 644 ../goesl2-decode.js /opt/horizon-live/goesl2-decode.js
# the flashes from orbit (168th): the GLM law and its bearing helper
install -m 644 ../glm.js /opt/horizon-live/glm.js
install -m 644 ../wildfire.js /opt/horizon-live/wildfire.js
# The '../../' import paths must keep resolving from
# /opt/horizon-live/index.mjs - rewrite them for the flat deploy
# (metar.js's own './lightning.js', aerosol.js's own './grib2.js'
# and sounding.js's own './contrails.js' imports already resolve
# there).
sed -i "s#'../../lightning.js'#'./lightning.js'#; s#'../../solarwind.js'#'./solarwind.js'#; s#'../../metar.js'#'./metar.js'#; s#'../../smoke.js'#'./smoke.js'#; s#'../../grib2.js'#'./grib2.js'#; s#'../../aerosol.js'#'./aerosol.js'#; s#'../../aeronet.js'#'./aeronet.js'#; s#'../../gmn.js'#'./gmn.js'#; s#'../../gvp.js'#'./gvp.js'#; s#'../../sounding.js'#'./sounding.js'#; s#'../../buoy.js'#'./buoy.js'#; s#'../../cobs.js'#'./cobs.js'#; s#'../../ozone.js'#'./ozone.js'#; s#'../../modis-land.js'#'./modis-land.js'#; s#'../../hdf5.js'#'./hdf5.js'#; s#'../../goesl2.js'#'./goesl2.js'#; s#'../../satellites.js'#'./satellites.js'#; s#'../../goesl2-decode.js'#'./goesl2-decode.js'#" /opt/horizon-live/index.mjs.new
# Ship-list drift guard: any '../../*.js' import left unrewritten means
# a shared file was added to index.mjs without being added HERE, and the
# flat deploy would crash-loop on ERR_MODULE_NOT_FOUND (Cloudflare 502s
# while systemd shows "running"). Fail the install instead - the staged
# file is discarded and the running deploy keeps its loadable tree.
if grep -q "'\.\./\.\./" /opt/horizon-live/index.mjs.new; then
  echo "install.sh: unshipped '../../' import in index.mjs:" >&2
  grep -n "'\.\./\.\./" /opt/horizon-live/index.mjs.new >&2
  rm -f /opt/horizon-live/index.mjs.new
  exit 1
fi
mv /opt/horizon-live/index.mjs.new /opt/horizon-live/index.mjs
# The deployed revision beside the entry point (158th pass): the
# daemon reports it in /health, /probe and the /goesl2 body, so a
# stale deploy is seen from anywhere instead of inferred from a
# body's missing products.
REV=$(git rev-parse HEAD 2>/dev/null || echo unknown)
printf '{"rev":"%s","installedAt":"%s"}\n' "$REV" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  >/opt/horizon-live/VERSION
chmod 644 /opt/horizon-live/VERSION

# Environment (created once; never overwritten - your key lives here).
if [ ! -f /etc/horizon-live.env ]; then
  cat >/etc/horizon-live.env <<'ENV'
AISSTREAM_KEY=put-your-key-here
ALLOW_ORIGIN=https://ndevtk.github.io
PORT=8127
HOST=127.0.0.1
RATE_PER_MIN=60
TRUST_PROXY=1
ENV
  chmod 600 /etc/horizon-live.env
  echo ">> edit /etc/horizon-live.env and set AISSTREAM_KEY"
fi

install -m 644 horizon-live.service /etc/systemd/system/horizon-live.service
# Self-update machinery: a timer runs update.sh every 5 minutes;
# it deploys a new revision ONLY after the reference gate passes
# on this box (see update.sh; branch via UPDATE_BRANCH in
# /etc/horizon-live.env, default main).
install -m 755 update.sh /opt/horizon-live-update.sh
install -m 644 horizon-live-update.service /etc/systemd/system/
install -m 644 horizon-live-update.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now horizon-live
systemctl enable --now horizon-live-update.timer
systemctl restart horizon-live
sleep 1
systemctl --no-pager -l status horizon-live | head -6
echo
echo ">> daemon: curl -s localhost:8127/health"
echo ">> TLS: copy Caddyfile.example into /etc/caddy/Caddyfile with"
echo "   your hostname, then: systemctl reload caddy"
echo ">> then from anywhere: curl -s https://<host>/probe"
