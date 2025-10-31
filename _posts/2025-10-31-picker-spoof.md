---
title: File picker UI spoof (Awarded $2000)
---

File picker shown on the wrong origin while keeping FileSystemHandle.

```js
onmouseup = (_) => {
  let fs = showOpenFilePicker();
  open('https://www.google.com');
};
```

This issue was fixed in <https://issues.chromium.org/40059071> by making FileSystemAccess APIs consume user activation.
