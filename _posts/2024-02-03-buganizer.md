---
title: Google Issue Tracker leak (Fixed)
---

Google Issue Tracker/Buganizer is hosted on multiple domains such as `issues.skia.org`, `issues.pigweed.dev`, `issues.gerritcodereview.com`, `git.issues.gerritcodereview.com`,  `issuetracker.google.com`, `issues.fuchsia.dev`, `issues.chromium.org` and one tracker can read issues from a different one like `fetch('https://issues.skia.org/action/issues/<ISSUE ID>/events');`

```js
for (let i=0; i < 1337; i++) {
  fetch('https://issuetracker.google.com/action/trackers/' + i).then(async issue => {
    let result = await issue.text();
    if (result.includes('b.Tracker')) console.log(result);
  });
}
```

An intentional embeddable XSS existed at `jsfiddle.skia.org` that is cross-origin but same-site as somewhere the issue tracker is hosted hence bypassing site/process isolation protections.

This means:
- CPU bugs like Meltdown/Spectre or a compromised renderer can read the contents of private google issues of the logged in user, bypassing the `Cross-Origin-Resource-Policy: same-site` header and Cross-Origin Read Blocking.
- Can modify and send `document.cookie` as first party, but not read the `HttpOnly` cookies directly, allowing Login CSRF since no  [__Host-](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#__host-) cookie prefix is used only [__Secure-](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#__secure-) that protects from local network attackers.
- No more cache partitioning for `skia.org`

While there may be other ways to bypass site isolation like an attacker controlled image, video or postMessage on the victim site allowing JS execution significantly increases the attack surface for renderer bugs. <https://www.chromium.org/Home/chromium-security/strict-origin-isolation-trial>
<https://bughunters.google.com/blog/6554750087200768/securely-hosting-user-data-in-modern-web-applications#approach-2-serving-active-user-content>

“The CORP bypass is an extra hardening bypass which is currently out-of-scope of VRP and this issue is also out-of-scope for Chrome Extension VRP due to it's not an extension. We may revisit this issue later when we include such bypasses into our VRP.”

This was fixed by removing `jsfiddle.skia.org`

# That other thing
So there was some other attack I liked but sadly they know about it internally and have not fixed it so cant include it but I would have liked to :(
