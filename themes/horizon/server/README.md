# horizon-live

The Horizon theme's live-data daemon for a small always-on box
with its own IP address. It superseded (and absorbed) a
Cloudflare Worker whose code has since been deleted — every
upstream failure measured there (adsb.lol tarpit, adsb.fi 403,
OpenSky network drop, the shared anonymous credit pools) had the
same root cause: Cloudflare's shared egress IPs. A dedicated IP
reopens the whole upstream menu, and a resident process holds the
ONE persistent global aisstream.io socket the free tier is
designed around, answering every visitor from RAM.

Design and security posture live in the header of
`src/index.mjs`. The daemon's pure pieces (schema normalizers,
spatial grid, origin allowlist, rate limiter, security headers)
are gated by `../server-reference.mjs` — the `server` set in
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
- `GET /stream?lat&lon&km&ais&adsb` — the live channel: one
  origin-scoped EventSource carries `strike` events the moment
  the network locates them, `ais` ship deltas every 30 s from
  RAM, and `adsb` aircraft every 20 s through the shared per-area
  cache (many viewers in one place still cost one upstream
  request). Initial ais/adsb push on connect. EventSource
  bypasses CORS, so the Origin allowlist gate IS the protection
  here — foreign origins get 403 before the stream opens. Capped
  concurrent streams (`SSE_MAX`, default 25).
- `GET /health` — AIS + lightning engine stats.
- `GET /probe` — health + the fixed-target reachability
  diagnostic, run from the box's own IP.

Browser access is origin-locked to `ALLOW_ORIGIN` (the website —
this is not an open CORS proxy); everything is rate-limited per
IP.

## Security posture

- Every response carries `content-security-policy: sandbox` and
  `x-content-type-options: nosniff`: even if a response were ever
  opened as a document, it runs in a null origin with scripts,
  forms and plugins disabled, and nothing is content-sniffed into
  a scriptable type. Reference-gated (`security headers` landmark
  in `../server-reference.mjs`).
- Error responses are generic (`bad gateway`, `not found`, …) —
  no upstream error text, stack traces or internal state ever
  reaches a client. Diagnostics go to the journal and `/health`.
- SSE backpressure: a stalled stream client (zero TCP window) is
  disconnected once its socket buffer exceeds `SSE_BUFFER_MAX`
  (256 KiB, reference-gated) — slow readers cannot grow the
  daemon's memory, and one broken client can never abort the
  strike fanout to the rest (per-client write isolation).
- Why the origin allowlist lives in the daemon, not in Caddy: the
  daemon's check is pure, exported and reference-gated — the gate
  proves exact-echo/403/no-grant behaviour on every deploy, which
  a Caddyfile can't offer, and the protection survives a Caddy
  swap or misconfiguration (it also guards direct `:8127`
  loopback access). Caddy MAY additionally pre-filter as
  belt-and-braces to shed foreign-origin load before it reaches
  node — `Caddyfile.example` shows the optional matcher — but the
  daemon check is the one that counts and stays.

## Self-update (no manual deploys)

`install.sh` also arms `horizon-live-update.timer`: every 5
minutes `update.sh` fetches the watched branch (`UPDATE_BRANCH`
in `/etc/horizon-live.env`, default `main` — merging to main IS
the deploy trigger, same as GitHub Pages). If the server files
changed, it checks out the new revision and runs the FULL
reference gate (`harness/validate.sh`, CPU sets) **on this box**;
only a PASS reinstalls and restarts, with the previous install
kept at `/opt/horizon-live.prev` for instant rollback. A failing
gate leaves the running version untouched and lands in
`journalctl -u horizon-live-update`. Nothing deploys unverified —
the same rule the repo itself lives by.
