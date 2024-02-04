---
title: XSS in native browser UI (Awarded $500)
---

Chromium NTP (New Tab Page) reflected content from a url parameter into the DOM, This was fixed by replacing ```i18nRaw``` with ```i18n``` that performs html escaping.
Impact is reduced because it's on chrome-untrusted and can only be navigated to directly or from a browser extension. <https://issues.chromium.org/issues/40057777>

UPDATE: As part of <https://bugs.chromium.org/p/chromium/issues/detail?id=1269151> chrome-untrusted URLs in chrome.window and chrome.tabs are now disallowed.
```js
chrome.tabs.update(ID, {url: "chrome-untrusted://new-tab-page/custom_background_image?url=https://a.a&size=%3C/style%3E%3Cscript%3Ealert(1)%3C/script%3E"}, console.log);
```
