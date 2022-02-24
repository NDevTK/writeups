---
title: Sandbox escape: bypass allow-popups-to-escape-sandbox (Awarded 2500)
---
An empty document did apply the owner's document sandbox flags,
This meant that with “allow-same-origin” it was possible to open a new window and escape the sandbox. [https://bugs.chromium.org/p/chromium/issues/detail?id=1256822](https://bugs.chromium.org/p/chromium/issues/detail?id=1256822)
