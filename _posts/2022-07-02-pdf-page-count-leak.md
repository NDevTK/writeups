---
title: PDF Page count leak (Awarded $500)
---

On chrome the PDF viewer has a message listener that's used for the cross-origin scripting API.  
By sending a message to the viewer with the type of `getThumbnail` and a page number that's greater then the number of available pages it would crash to prevent OOB access.

```js
let w = open(
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
);
setTimeout(
  (_) => w[0].postMessage({type: 'getThumbnail', page: '1337'}, '*'),
  1000
);
```

This crash can be detected cross-origin in the following ways

- Checking device performance after `w[0].postMessage({type: 'print'});`
- [Issue 40828189](https://issues.chromium.org/issues/40828189)
- Extension tabs API looking for the status of unloaded (no permission needed)

This was fixed in [Issue 40059101](https://issues.chromium.org/issues/40059101)
