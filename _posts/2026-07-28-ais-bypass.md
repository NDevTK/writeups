---
title: AI Studio Auth bypass
---

**URL:** <https://aistudio.google.com/>

**Vulnerability type:** Remote Code Execution (RCE)

### Details

AI Studio containers have two different auth systems one is `user_auth_verification.lua` but there is also `/__aistudio_internal_control_plane` that uses a golang app called control-plane-api and is designed to only accept signed requests from the Google backend except `/__aistudio_internal_control_plane/health` because that ones special.

However using the metadata API its possible from the attackers container to sign a request for the victims container due to a shared SA.

From the attackers container mint a signature for the victims container

```
js
app.get(`${endpoint}/mintid`, async (req, res) => {
  const aud = String(req.query.aud || '');
  if (!aud) return res.status(400).json({ error: 'aud query param required' });
  try {
    const r = await queryMetadata(`/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(aud)}&format=full`);
    res.status(r.status).type('text/plain').send(r.body);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

For example `https://ais-dev-ieym56sbhi3e3yugjrclgb-498368762413.europe-west2.run.app/__cp_tap_CPshFhdBeJg2/mintid?aud=https://ais-dev-wz5qlkb3fdlkip3rkpzf47-505266060889.europe-west2.run.app`
Then the attacker can speak on behalf of the backend to run commands on the victim.

```
curl -i -H "Authorization: Bearer eyJ..." -H "Accept: application/json" "https://ais-dev-wz5qlkb3fdlkip3rkpzf47-505266060889.europe-west2.run.app/__aistudio_internal_control_plane/fs/list?path=.&recursive=false&exclude="
```

### Attack scenario

With knowledge of the endpoint name an attacker can use the `__aistudio_internal_control_plane` API pretending to be the Google backend for example to list files but `/dev/exec` also exists.

The above finding was found with help from AI and written by me incase you want its version of the report I put it below.
Transcript can be found at [here](https://ndevtk.github.io/writeups/chat2.png)  
Cross-tenant authentication bypass on AI Studio applet control plane via shared service account (cross-Google-account RCE)

AI Studio applet containers have two auth systems: `user_auth_verification.lua` gates the user-facing applet at /, and `control-plane-api` (Go binary) gates the management API at `/__aistudio_internal_control_plane/*`. The latter is designed to only accept Google-signed ID tokens from Google's backend orchestrator; `/__aistudio_internal_control_plane/health` is exempt and returns a fixed liveness JSON.

The control-plane validates tokens via:
```
audience := fmt.Sprintf("https://%s", r.Host)
idtoken.Validate(ctx, token, audience)
```
Cloud Run pins `r.Host` to the container's canonical service URL at the routing layer, so the audience binding is per-container — which is correct in principle.

The break: every applet container in europe-west2 runs as the same service account, `ais-sandbox@ais-europe-west2-064bc45eb5954.iam.gserviceaccount.com` — the same SA the orchestrator uses (verified by decoding legitimate orchestrator tokens captured at the `control-plane` endpoints). Because the GCP metadata server identity endpoint lets any workload mint ID tokens with arbitrary audience, an applet can mint a token cryptographically equivalent to one from the orchestrator, targeted at any other applet's URL.

Reproduction (across two Google accounts I own):

Account α → applet A at `https://ais-dev-ieym56sbhi3e3yugjrclgb-498368762413.europe-west2.run.app`
Account β → applet C at `https://ais-dev-wz5qlkb3fdlkip3rkpzf47-505266060889.europe-west2.run.app`
Confirm both containers report the same SA via metadata server (email field).
From A's container, mint a token for C's URL:

GET `http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/identity?audience=https://<C-url>`
(Header: Metadata-Flavor: Google.) Returned JWT decodes to iss=accounts.google.com, email=ais-sandbox@…, aud=https://<C-url>.
Use the minted token against C's control plane:
```
curl -H "Authorization: Bearer <token>" \
"https://<C-url>/__aistudio_internal_control_plane/fs/list?path=.&recursive=false&exclude="
```
Returns HTTP 200 with C's app directory listing.
Impact: the full control-plane surface is reachable in any victim applet whose URL is known:

`/dev/exec`, `/dev/exec-stream` — arbitrary command execution
`/fs/read`, `/fs/write`, `/fs/delete`, `/fs/removeall` — arbitrary file read/write/delete
`/dev/logs` — log exfiltration
`/cloudsql/startproxy` — Cloud SQL access via shared SA
`/dev/env` — environment variable manipulation
URL discoverability is the only bound. `run.services.list` is denied on this SA so mass enumeration via Cloud Run API is blocked, but targeted attacks remain trivial wherever applet URLs leak.

Affected code: `main.main.authMiddleware.func2` in `control-plane-api`. Audience derivation `fmt.Sprintf("https://%s", r.Host)` combined with `google.golang.org/api/idtoken.Validate`.

Suggested mitigation: assign each applet container a dedicated service account distinct from the orchestrator's, or replace ID-token auth on the control plane with a non-impersonable workload identity (e.g., mTLS with per-applet certs).

Scope of testing: demonstration was performed only against two applets I created under two Google accounts I own. No tokens were minted with audiences for URLs outside my own account. No third-party data was accessed.

This was fixed via per Google account SAs while cross-account exploitation has been mitigated, cross-sandbox access remains functional; this surface likely poses minimal risk barring the introduction of multi-user collaborative editing features.
Even after the double 🎉 Nice catch P1/S1 its claimed by the panel to be duplicate.
