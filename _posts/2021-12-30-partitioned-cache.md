---
title: Partitioned HTTP Cache Bypass (Not fixed)
---

Since browser cache is keyed by window location its still possible to do a cache probing attack by timing navigation.  
It does not matter if the navigation initiator is cross-site. [(Navigations | XS-Leaks Wiki)](https://xsleaks.dev/docs/attacks/navigations/#partitioned-http-cache-bypass)  
This allows a cache based XS-Search on websites when same-site resources are used based on the search query controlled by the attacker.

Cache probing tool: <https://sites.google.com/view/xsleaks>  
Old cache probing attacks: <https://github.com/NDevTK/CacheAttack>

A fix is being planned in <https://groups.google.com/a/chromium.org/g/blink-dev/c/YpxpzceGw68/m/ezbYJOSeAAAJ>
