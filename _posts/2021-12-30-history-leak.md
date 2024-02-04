---
title: Cross-origin URL disclosure via "history.length" (Awarded $5000)
---

Same URL navigations don't normally increase history.length,
But this allows the opener to check the exact URL of a window.
So in Chromium this is no longer true for a cross-origin initiator if there's no error, there are currently timing attacks with same document navigations however. <https://chromium-review.googlesource.com/c/chromium/src/+/2983325>
Also [40087397 - Eliminate :visited privacy issues once and for all - chromium](https://issues.chromium.org/issues/40087397) still exists and should be fixed.
