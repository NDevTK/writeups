---
title: Download limit bypass (Fixed)
---

By doing `history.back()` and `history.forward()` between two origins it was possible to bypass the multiple file download restriction.  
PoC code can be found at <https://github.com/NDevTK/DownloadBypass/tree/master>  
This was fixed in <https://issues.chromium.org/issues/40750895>
