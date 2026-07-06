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

# The daemon: one file, zero npm dependencies. It imports the
# worker's normalizers, so ship both files preserving layout.
mkdir -p /opt/horizon-live/worker/src
install -m 644 src/index.mjs /opt/horizon-live/index.mjs
install -m 644 ../worker/src/index.js /opt/horizon-live/worker/src/index.js
# The import path '../../worker/src/index.js' must keep resolving
# from /opt/horizon-live/index.mjs - rewrite it for the flat deploy.
sed -i "s#'../../worker/src/index.js'#'./worker/src/index.js'#" /opt/horizon-live/index.mjs

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
systemctl daemon-reload
systemctl enable --now horizon-live
systemctl restart horizon-live
sleep 1
systemctl --no-pager -l status horizon-live | head -6
echo
echo ">> daemon: curl -s localhost:8127/health"
echo ">> TLS: copy Caddyfile.example into /etc/caddy/Caddyfile with"
echo "   your hostname, then: systemctl reload caddy"
echo ">> then from anywhere: curl -s https://<host>/probe"
