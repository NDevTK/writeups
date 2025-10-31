---
title: Bypass PaymentRequest.show() calls after the first (Awarded $1000)
---

By abusing the chrome page auto reloader such as with max redirects `https://xsinator.com/testcases/files/maxredirect.php?n=19&url=https://mixolydian-wild-legal.glitch.me/?url=<ATTACKER PAGE>` you could bypass the following rule:

- PaymentRequest.show() calls after the first (per page load) require either transient user activation or delegated payment request capability.

This issue was fixed in <https://issues.chromium.org/40072274> video PoC <https://www.youtube.com/watch?v=2X5RNABRK40>
