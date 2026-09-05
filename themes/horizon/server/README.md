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
- `GET /metar?lat&lon` — aerodrome observations near the point
  (aviationweather.gov decodes them but sends no CORS header):
  measured cloud-layer bases, covers, visibility and present
  weather, stripped to the fields the theme reads
  (`normalizeMetars`, gated) with a 10-minute per-area cache.
- `GET /smoke?lat&lon` — the analyst-verified wildfire plume over
  the point: NOAA HMS daily polygons (North America), fetched
  hourly, decoded by the gated `smoke.js`, answered from RAM with
  the published class concentration.
- `GET /aerosol?lat&lon` — measured aerosol radiative properties
  for the 0.25° cell over the point: GEFS-Aerosols (NOAA's
  operational GOCART coupling) total optical thickness at five
  optical bands, scattering optical thickness, single-scattering
  albedo, asymmetry, and the dust/sea-salt/sulphate/organic/
  black-carbon split. Fetched as a ~6 KB GRIB2 subset from the
  NOMADS grib filter (the supported subsetting path since OpenDAP
  retired, SCN 25-81), decoded by the gated `grib2.js`, censused
  by the gated `aerosol.js`; per-cell answers cached 45 min
  (3-hourly product), failures 5 min, cycle fallback when the
  newest run is not yet published.
- `GET /aeronet?lat&lon` — the nearest AERONET station's latest
  direct-sun AOD (Giles et al. 2019 Version 3, Level 1.5
  near-real-time; the web service sends no CORS header). Station
  list refreshed daily, per-site observations cached 15 min,
  rows normalized by the gated `aeronet.js`; the client applies
  its own freshness window and representativity radius —
  measured Sun photometry outranks the aerosol model where a
  photometer actually looked.
- `GET /solarwind` — the aurora's measured driver: DSCOVR/ACE
  solar wind at L1, already propagated to the bow shock by SWPC
  (the `propagated_time_tag` is a real physical lead time of tens
  of minutes), with the Newell 2007 coupling function computed by
  the shared, gated `solarwind.js`, plus the OVATION hemispheric
  power (GW). One 60 s poll serves every visitor. Also pushed as
  the `space` event on `/stream` (60 s cadence, initial push on
  connect).
- `GET /goesl2?lat&lon` — NOAA's own operational cloud products
  around the point (148th pass): the clear-sky mask
  (`ABI-L2-ACMC`: BCM, ACM, cloud probability, DQF on the 2-km
  CONUS grid) and the cloud top height (`ABI-L2-ACHAC`: HT on the
  10-km grid) from the NOAA Open Data buckets (`noaa-goes18` for
  GOES-West, `noaa-goes19` for GOES-East; anonymous S3, listed and
  fetched by the daemon, decoded by the gated pure-JS HDF5 reader
  `hdf5.js`, navigated by `goesl2.js`'s PUG equations), cut to
  ±100 km windows (101 × 101 mask pixels, 21 × 21 height pixels)
  and packed as base64 typed arrays with their censuses. Since the
  149th pass the answer also carries the band-13 imagery itself
  (`ABI-L2-CMIPC` C13: NOAA's brightness temperature as 12-bit
  counts with the file's scale and offset, DQF) and DCOMP's daytime
  retrievals (`ABI-L2-CODC` optical depth at 640 nm and `ABI-L2-CPSC`
  effective radius, uint16 counts with their scale, the shared flag
  word) as `imagery` and `dcomp`, and since the 151st the hour's sea
  surface (skin) temperature (`ABI-L2-SSTF`, the hourly full-disk
  file - there is no CONUS SST product - as counts from 180 K with
  the file's flags) as `sst`, and since the 152nd NOAA's downward
  shortwave radiation at the surface (`ABI-L2-DSRF`: the full-disk
  10-minute file, 0.2-4.0 µm direct + diffuse in W/m² as counts at
  0.0229 W/m², DQF 0 good / 1 degraded or invalid; the Enterprise
  SRB algorithm's ATBD read in full) as `dsr`, with the point's own
  pixel (`here`), the mean of the good pixels within 5 pixels
  (`near` - the ATBD's spatial average for reading a pixel against
  a point on the ground) and the window census in W/m²: seven
  products in all (about 240 kB a window). Since the 151st pass
  every file is read by HTTP RANGE
  (`hdf5.js` `openHdf5Lazy`): the first 256 kB, then only the chunks
  the window touches, so a window of the 32 MB SST file costs about
  1 MB and the 4 MB mask about 0.9 MB. Windows are held a dozen per
  satellite and product, keyed by file and tenth-degree cell, so a
  new file keys new windows; `?t=ISO` asks the five 5-minute
  products and the 10-minute DSR for that moment (the hourly SST is
  never asked for a moment). `sat: null` with a `reason` is a real answer (no bucket
  reaches this longitude; Himawari's products are not on AWS in this
  form); 502 when every product failed upstream; `upstream:
'partial'` names a body missing some.
- `GET /health` — AIS + lightning + space-weather + smoke +
  aerosol engine stats.
- `GET /probe` — health + the fixed-target reachability
  diagnostic, run from the box's own IP.

Browser access is origin-locked to `ALLOW_ORIGIN` (the website —
this is not an open CORS proxy); everything is rate-limited per
IP.

## Persistence across restarts

Every deploy restarts the process (the self-update timer), and a
fresh process holds empty caches. Since the 144th pass the slow
per-area caches (sounding, buoy, metar, aeronet, aerosol, ozone,
chlor, ndvi, surface, rrs, sst) and the sitewide feeds (TLEs, GMN, GVP,
COBS, the station lists) are snapshotted to `cache.json` in the
systemd `StateDirectory` (`/var/lib/horizon-live`, the unit's one
writable path; `HORIZON_STATE_DIR` overrides) every five minutes
and on `SIGTERM`, and restored at start - rows older than a day are
dropped, rows already refetched are never overwritten. The warm-up
then covers the home area first and the snapshot's most recently
served areas after it (`recentAreas`, `warmUpPlan`, gated in
`server-reference.mjs`). `/health` reports the state file, what was
restored and the last save. The streaming pictures (AIS, lightning)
and the 15-second aircraft cache are not persisted.

The ocean-colour route (`/rrs`) asks the daily ESA CCI product and
its 8-day composite in parallel under the shared upstream budget
(a six-band ERDDAP point query takes about 18 s - the old 15-s
timeout failed every call); the daily's measurement wins, the
composite fills its cloud gaps, and the answer names its `product`.

The foundation-SST route (`/sst`, 147th pass) serves JPL's MUR v4.1
analysis (0.01°, daily, `sea_surface_foundation_temperature`) from
CoastWatch's ERDDAP as a 3° box at 0.05° around the point's 0.5°
cell — 61 × 61 values to 0.001 °C, null over land — so the
satellite cloud field can give every sea pixel its own clear-sky
reference and a coast with no pier or buoy still has a measured sea
temperature (a foundation temperature: no diurnal skin, stated on
the page). One ERDDAP request of ~200 kB answers in about a second;
successes cache 6 h (the analysis is daily), failures 10 min; the
answer carries the analysis `time`.

The NOAA cloud-product route (`/goesl2`, 148th pass) lists the UTC
hour's prefix of the satellite's bucket (then the previous hour's
when that hour has no file yet - the first file of an hour lands
about four minutes after its start, measured; a listing stands a
minute), takes the newest start stamp - or, with `?t=ISO`, the stamp
nearest that moment within 15 minutes, so the page can compare its
GIBS mosaic with the mask of the mosaic's own minute (GIBS's tiles
trailed the bucket by 2 h 12 min on 2026-09-05 at 20:05Z, measured) -
and reads the window from the file only when that key and cell are
not already held. Since the 151st pass the read is by HTTP RANGE
(the buckets answer `Range` with 206 and a `Content-Range` total,
and are CORS-open with it, measured): `hdf5.js` `openHdf5Lazy`
fetches the first 256 kB (NetCDF-4 writes its object headers,
attribute heaps and coordinate vectors up front), navigates the
point to its pixel, and then fetches only the chunk strips the
±100 km window touches (NOAA chunks these files in full-width row
strips: 52 rows on the 2-km CONUS grid, 24 on the full disk), in
64 kB blocks, three to six round trips a file. Measured against the
live bucket from this sandbox: the 4.2 MB mask in 4 ranges and
896 kB (465 ms), the 3.8 MB band-13 imagery in 3 ranges and 736 kB
(309 ms), the 5.0 MB optical depth in 4 ranges and 824 kB, the
5.4 MB particle size in 3 ranges and 755 kB, the 0.3 MB heights
whole, and the 32.3 MB full-disk SST in 6 ranges and 1065 kB
(767 ms); all six products cold in 1.2 s (the 148th-150th's
whole-file path took 5.5-6.4 s and 51 MB for five), a cached body
in 5 ms. Every window pixel equals the whole-file decode's
(`hdf5-reference.mjs`, `server-reference.mjs`). One read per file
and cell is in flight at a time; a listing or read failure holds
the product for two minutes, during which the newest held window of
the cell stands in for "latest". Windows are typed arrays of tens
of kilobytes and live in RAM only (never persisted; a dozen per
satellite and product, the least recently asked for let go; all
let go after an hour unasked; the CPS file's flag word is not held

- it equals the COD file's pixel for pixel, measured). The 150th's
  decode worker and memory guard guarded whole files and are
  retired with them: the daemon's resident size no longer moves with
  the products (about 130 MB with six windows held, measured). The
  home is warmed on start like the other slow routes. `/probe` lists
  the held windows with their files, cells, times, box sizes and the
  kilobytes read of each file's megabytes, the resident and heap
  sizes, and the listing/fetch/range/error counters with the
  megabytes ranged.

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
