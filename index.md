---
layout: default
---

<ul id="postLinks">
  {% for post in site.posts %}
  <li>
    <h2>
      <a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
    </h2>
  </li>
  {% endfor %}
</ul>

<p1><a href="{{ "/feed.xml" | relative_url }}">RSS</a> / <a target="_top" href="https://issues.chromium.org/issues?q=reporter:(ndevtk@protonmail.com)">Chromium</a> / <a target="_top" href="https://bughunters.google.com/profile/64c58a55-2401-4176-96a7-8cf5766cc146">Google</a> / <a href="https://ndevtk.github.io/writeups/credits/">Credits</a> / <a target="_top" href="https://x.com/ndevtk">X</a> / <a href="https://discord.gg/AUJjpZHFbP">Discord</a> / <a href="https://ndevtk.github.io/writeups/privacy/">Privacy</a> / <a target="_top" href="https://github.com/NDevTK">GitHub</a> / <a rel="me" target="_top" href="https://infosec.exchange/@ndevtk">Mastodon</a> / <a target="_top" href="https://bugcrowd.com/h/NDevTK">Bugcrowd</a> / <a target="_top" href="https://www.youtube.com/@NDevTK">YouTube</a> / <a target="_top" href="https://chromewebstore.google.com/detail/originmarker/kglglfbjpbmbnonckhgfhjllhocnnpjg">OriginMarker</a> / <a target="_top" href="https://chromewebstore.google.com/detail/autopause/bcecldolamfbkgokgpnlpmhjcijglhll">AutoPause</a> / <a target="_top" href="https://chromewebstore.google.com/detail/requestisolation/aljkbkjgcllgbhiimdeeefdfocbkolmb">RequestIsolation</a> / <a target="_top" href="https://chrome.google.com/webstore/detail/aodfhblfhpcdadgcnpkfibjgjdoenoja">postLogger</a> / <a target="_top" href="https://ndev.tk/">ndev.tk</a> </p1><p2 id="info"></p2>
