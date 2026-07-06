# horizon-live

The Horizon theme's live-data daemon for a small always-on box
with its own IP address. Successor to the Cloudflare Worker in
`../worker` — every upstream failure measured there (adsb.lol
tarpit, adsb.fi 403, OpenSky network drop, the shared anonymous
credit pools) had the same root cause: Cloudflare's shared egress
IPs. A dedicated IP reopens the whole upstream menu, and a
resident process holds the ONE persistent global aisstream.io
socket the free tier is designed around, answering every visitor
from RAM.

Design and security posture live in the header of
`src/index.mjs`. The physics/schema layer is imported from the
worker source (the model lives once); the daemon's own pure
pieces (spatial grid, origin allowlist, rate limiter) are gated
by `../server-reference.mjs` — reference set 20 in
`../harness/validate.sh`.

## Deploy (GCP free tier)

1. **VM**: e2-micro in `us-west1` / `us-central1` / `us-east1`
   (the Always Free regions), Ubuntu 24.04 LTS, allow HTTPS
   traffic. Note: Google now bills external IPv4 separately even
   on free-tier VMs (check current pricing), and Always Free
   egress is ~1 GB/month — the daemon's payloads are deliberately
   a few KB and cacheable, so a personal-site audience fits.
2. **DNS**: point an A record (e.g. `live.yourdomain`) at the VM,
   or use zero-setup `live.<ip-with-dashes>.sslip.io`. Optional:
   proxy through Cloudflare (orange cloud, SSL mode "Full") for
   edge caching + DDoS shielding of INBOUND traffic while
   OUTBOUND keeps the clean dedicated IP — the best of both
   measured worlds.
3. **Install**: clone the repo on the box, then
   `cd themes/horizon/server && sudo ./install.sh`, put the
   aisstream key into `/etc/horizon-live.env`, restart, set the
   hostname in `/etc/caddy/Caddyfile` (see `Caddyfile.example`).
4. **Verify**:
   - `curl -s localhost:8127/health` — `frames` climbing into the
     thousands within seconds proves the key and the global
     subscription (the world's AIS never goes quiet). `frames: 0`
     after a minute means the key is wrong.
   - `curl -s https://<host>/probe` — measures what THIS box's IP
     can reach (adsb.lol, adsb.fi, airplanes.live, OpenSky) so
     upstream order can be tuned on evidence.
   - `curl -s 'https://<host>/ais?lat=51.05&lon=1.45&dist=15'` —
     the Dover Strait, never empty.
5. **Point the theme at it**: test first with URL overrides
   (`?ais=https://<host>/ais&adsb=https://<host>/adsb`), then
   switch `AIS_PROXY` / `ADSB_PROXY` defaults in
   `themes/Horizon.html`.

## Endpoints

- `GET /ais?lat&lon&dist` — ships near the point from the
  in-memory global picture (dist ≤ 30 nm; instant, no upstream
  round-trip).
- `GET /adsb?lat&lon&dist` — aircraft via readsb failover
  (adsb.lol → adsb.fi → airplanes.live), 15 s cache.
- `GET /lightning?lat&lon&km` — strikes of the last 10 minutes
  within km (≤ 250) of the point, with ages and exact
  great-circle distances (Blitzortung.org, CC BY-SA).
- `GET /lightning/stream?lat&lon&km` — server-sent events:
  strikes pushed the moment the network locates them.
  EventSource bypasses CORS, so the Origin allowlist gate IS the
  protection here — foreign origins get 403 before the stream
  opens. Capped concurrent streams (`SSE_MAX`, default 25).
- `GET /health` — AIS + lightning engine stats.
- `GET /probe` — health + the fixed-target reachability
  diagnostic, run from the box's own IP.

Browser access is origin-locked to `ALLOW_ORIGIN` (the website —
this is not an open CORS proxy); everything is rate-limited per
IP.
