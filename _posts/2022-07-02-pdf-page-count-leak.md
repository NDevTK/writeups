---
title: PDF Page count leak (Awarded $500)
---

[Issue 1306443](https://bugs.chromium.org/p/chromium/issues/detail?id=1306443)

On chrome the PDF viewer has a message listener thats used for the cross-origin scripting API.  
By sending a message to the viewer with the type of getThumbnail and a page number thats greater then the number of available pages it would crash to prevent OOB access.
```js
let w = open('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf');
setTimeout(_ => w[0].postMessage({type: 'getThumbnail', page: '1337'}, "*"), 1000);
```
This crash can be detected cross-origin in the following ways
- Checking device performance like with [devicemonitor](https://devicemonitor.glitch.me/) after ```w[0].postMessage({type: 'print'});```  
- [Issue 1307087](https://bugs.chromium.org/p/chromium/issues/detail?id=1307087)
- Extension tabs API looking for the status of unloaded (no permission needed)
