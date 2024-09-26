---
title: Gmail XS-Search (Fixed)
---

[Duplicate](https://www.youtube.com/watch?v=nQJHGHw94fM) and was done before Partitioned HTTP Cache was added.
[(XS-Search | XS-Leaks Wiki)](https://xsleaks.dev/docs/attacks/xs-search/)
[(Cache Probing | XS-Leaks Wiki)](https://xsleaks.dev/docs/attacks/cache-probing/#fetch-with-abortcontroller)  
Allowed leaking email content cross-site.

# Oct 25, 2020 11:21PM

Created issue (on behalf of redacted).
Summary: On a successful search on Gmail the `send_googblue_20dp.png` is cached which maybe exploited with timing attacks (XS-Search)

Proof of concept: https://drive.google.com/file/d/redacted
Steps to reproduce:

1. Run javascript in proof of concept
2. It can then be tested by using `checkContent("Google", send2x).then(console.log)` it should return true/false depending on the result of the search

It maybe send1x depending on the image used by Gmail.

Browser/OS: Chrome, Windows 10

The script works by first opening a window on https://mail.google.com/mail
Then using window.location to perform a search like https://mail.google.com/mail/u/0/#search/Google
Then it detects if the `send_googblue_20dp.png` image is cached if it is the search was successful after that the image then get purged from the cache.

This probably would not be possible if the cache was not shared.

Attack scenario:
I think malicious javascript running on a different website could perform an XS-Search attack on someones Gmail account and search by letter to get email contents.
Because mail.google.com would not allow iframes to be used window.open is used instead this maybe suspicious to the user but it could be done when the device is idle or using a popunder.

# Oct 25, 2020 11:21PM

NOTE: This e-mail has been generated automatically.

Thanks for your report.

This email confirms we've received your message. We'll investigate and get back to you once we've got an update. In the meantime, you might want to take a look at the list of frequently asked questions about Google VRP.

If you are reporting a security vulnerability and wish to appear in Google Security Hall of Fame, please create a profile.

You appear automatically in our Honorable Mentions if we decide to file a security vulnerability based on your report, and you will also show up in our Hall of Fame if we issue a reward.

Note that if you did not report a vulnerability, or a technical security problem in one of our products, we won't be able to act on your report. This channel is not the right one if you wish to resolve a problem with your account, report non-security bugs, or suggest a new feature in our product.

Cheers,
Google Security Bot

Follow us on Twitter!

# Oct 26, 2020 10:00PM

Status: Duplicate of 1337
Hello,

We have identified this issue to be in a family of XS-Search attacks. In order to fix this kind of issues, we are now considering larger scale changes to the behavior of our products. We are doing this in a few ways:

- We are currently auditing which search endpoints exist in our web services that need to be protected against.
- We are experimenting with different defenses that don't break existing user functionality but also are effective.
- We are working with web browsers to find ways that the web platform can help defend against these attacks.

As all this work is already undergoing, for now we consider vulnerability reports in this area to be duplicates, unless they significantly change our understanding of our defenses and mitigations. See https://sites.google.com/site/bughunteruniversity/nonvuln/xsleaks for a more comprehensive description.

That said - if you think we misunderstood your report, and this issue does not meet the above criteria, feel free to let us know.
