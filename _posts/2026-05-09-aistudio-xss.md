---
title: Google AI Studio XSS (Awarded $10000)
---

**URL:** <https://aistudio.google.com/>

**Vulnerability type:** Cross-site scripting (XSS)

### Details

Iframes in Google AI Studio had XSS for example this one found in the gallery
<https://remix-remix-remix-geoseeker-853813963450.us-west1.run.app/__cookie_check.html?return_url=javascript:alert(origin)> also applies to ones created by users.

`__cookie_check.html` is used as part of the auth flow so this leaks the access token since victim DNS subdomains are not secrets (Network, Per email ACL, Public Gallery) might even be predictable.

You can also get HTML injection (And maybe XSS) on <https://aistudio.google.com/> but the CSP makes it annoying `https://aistudio.google.com/_/upload/597f9790-0fe0-4555-a48f-7f04b290716e/file/3cca5f9cbde3693876d97bc340855144d3b8375b0cfc5424609e9a0614e2cce0` with CSP bypass or creative use of html elements could be impactful.

```
content-type: text/html; charset=UTF-8
content-security-policy: default-src 'none'; img-src 'self'; report-uri https://csp.withgoogle.com/csp/scotty/2;
```

Random note: <https://remix-cosmic-flow-853813963450.us-west1.run.app/_aistudio-iframe.js> has very lax message listener origin checks some are just hostname and some don't exist and its embed protection is `frame-ancestors 'self' https://*.google.com https://localhost.corp.google.com:26001;` so any google subdomain works for click jacking.

### Attack scenario

An XSS on <https://aistudio.google.com/> ideally.
AI Studio embeds ask for permissions like geolocation and have Google OAuth integrations.

### The fix

`https://aistudio.google.com/_/upload/` file endpoint now uses the following headers

```
content-security-policy: sandbox; default-src 'none'; frame-ancestors 'none'
content-type: application/octet-stream
```

`__cookie_check.html` now case insensitively blocks javascript protocol redirects

```js
/**
 * Redirects to the return url. If autoClose is true, then the return url will be opened in a
 * new window, and it will be closed automatically when the page loads.
 * Options:
 *   storageAccessGranted: if true, appends __storage_access_granted=1 to
 *   the return url so the Lua auth script can set the test cookie
 *   server-side (needed for Safari/iOS where document.cookie is blocked).
 */
async function redirectToReturnUrl(autoClose, storageAccessGranted = false) {
  const initialReturnUrlStr = new URLSearchParams(window.location.search).get(
    'return_url'
  );
  const returnUrl = initialReturnUrlStr ? new URL(initialReturnUrlStr) : null;

  // Prevent potentially malicious URLs from being used
  if (returnUrl.protocol.toLowerCase() === 'javascript:') {
    console.error('Potentially malicious return URL blocked');
    return;
  }

  if (storageAccessGranted) {
    returnUrl.searchParams.set('__storage_access_granted', '1');
  }

  if (autoClose) {
    returnUrl.searchParams.set('__auto_close', '1');
    const url = new URL(window.location.href);
    url.searchParams.set('return_url', returnUrl.toString());
    // Land on the cookie check page first, so the user can interact with it before proceeding
    // to the return url where cookies can be set.
    window.open(url.toString(), '_blank');
    const hasAccess = await document.hasStorageAccess();
    document.querySelector('#stepOne').classList.add('hidden');
    if (!hasAccess) {
      document.querySelector('#stepThree').classList.remove('hidden');
    } else {
      window.location.reload();
    }
  } else {
    window.location.href = returnUrl.toString();
  }
}
```
