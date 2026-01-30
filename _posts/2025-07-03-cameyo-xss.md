---
title: Cameyo XSS
---

XSS on Cameyo's Virtual App Delivery platform (alternative to VDI & DaaS), a TIER0 Google acquisition per <https://github.com/google/bughunters/blob/d1d112929c1e10ce86ec5686fa81eb1f828dd019/domain-tiers/external_domains_acquisitions.asciipb#L26>

PoC:
<https://online.cameyo.com/apps/foo?setCookie=CyoMngEnt=&redirUrl=javascript:alert(origin)>

This was fixed by sanitizing redirect URLs to only allow the HTTP and HTTPS protocols.

```js
function getSafeRedirectUrl(urlParameter) {
  if (!urlParameter) {
    return; // No URL provided
  }
  try {
    const url = new URL(urlParameter, window.location.origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return; //Blocked redirect to potentially unsafe URL
    }
    if (url.hostname !== window.location.hostname) {
      return; //Blocked redirect to external URL
    }
    return url;
  } catch (e) {
    return; // Handle cases where urlParameter is not a valid URL at all
  }
}

// SetCookie (used by companyAdd.aspx)
var setCookie = getURLParameter('setCookie');
if (setCookie !== null && setCookie.startsWith('CyoMngEnt=')) {
  var redirUrl = getURLParameter('redirUrl');
  var safeUrl = getSafeRedirectUrl(redirUrl);
  if (safeUrl) {
    document.cookie = setCookie;
    document.location.href = safeUrl;
  }
}
```

This was a duplicate report so was not rewarded.
