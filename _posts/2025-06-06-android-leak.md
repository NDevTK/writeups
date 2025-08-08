---
title: Android lock screen data leak (Awarded $500)
---

Due to a lock screen race its possible to leak interactive app contents since app launches show on the lock screen temporarily.

There's multiple ways to cause app launches from the lockscreen:

- [Deeplinks/BROWSABLE intents](https://ndevtk.github.io/writeups/2024/08/01/awas/) (when you hold down selected text and press open)
- Gemini app will bypass PIN prompt when controlled via an external USB keyboard (USB to USB C adapter)
- Gboard settings icon

They appear to not be willing to confirm if the fix covers all ways to launch apps from the lockscreen or just deeplinks are being patched as it would be a cross-report data leak.

Steps on a locked Android device:

- Type in to Gemini "https://discord.gg/a"
- Select that text and tap open
- Profit :)

Stupid PoC Minecraft video: <https://www.youtube.com/watch?v=TUysajkSlM4> when I made the report this was a private YouTube video but my channel got terminated for an unknown reason.

# Impact

Leaks sensitive (if user disables notification content on lockscreen) app contents like discord messages and was later shown by a different researcher to allow installing apps from Google play <https://www.youtube.com/watch?v=SmZsfn69B7E> and described as a "Two Years Old Android Security Issue"

It is assumed my report was wrongly triaged as a trust and safety issue and the reward for my potentially duplicate report was accidental and not based on the Android rewards table.

# Conclusion

- Abuse VRP should stop hijacking reports
- Android team should fix lockscreen bypasses quicker then 2 years
