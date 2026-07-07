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
install -m 644 src/index.mjs /opt/horizon-live/index.mjs
install -m 644 ../lightning.js /opt/horizon-live/lightning.js
install -m 644 ../solarwind.js /opt/horizon-live/solarwind.js
install -m 644 ../metar.js /opt/horizon-live/metar.js
# The '../../' import paths must keep resolving from
# /opt/horizon-live/index.mjs - rewrite them for the flat deploy
# (metar.js's own './lightning.js' import already resolves there).
sed -i "s#'../../lightning.js'#'./lightning.js'#; s#'../../solarwind.js'#'./solarwind.js'#; s#'../../metar.js'#'./metar.js'#" /opt/horizon-live/index.mjs

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
