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

<p1><a href="{{ "/feed.xml" | relative_url }}">RSS</a> / <a href="https://issues.chromium.org/issues?q=reporter:(ndevtk@protonmail.com)">Chromium</a> / <a href="https://bughunters.google.com/profile/64c58a55-2401-4176-96a7-8cf5766cc146">Google</a> / <a href="https://ndevtk.github.io/writeups/credits/">Credits</a> / <a href="https://x.com/ndevtk">X</a> / <a href="https://discord.gg/AUJjpZHFbP">Discord</a> / <a href="https://drive.google.com/drive/folders/1NvC6sWiKO_9DaJDLBp9HvawxAqg62nNG?usp=sharing">PoCs</a> / <a href="https://ndevtk.github.io/writeups/privacy/">Privacy</a> / <a href="https://github.com/NDevTK">GitHub</a> / <a rel="me" href="https://infosec.exchange/@ndevtk">Mastodon</a> / <a href="https://bugcrowd.com/external_redirect?site=https://bugcrowd.com/NDevTK">Bugcrowd</a> / <a href="https://chromewebstore.google.com/detail/originmarker/kglglfbjpbmbnonckhgfhjllhocnnpjg">OriginMarker</a> / <a href="https://chromewebstore.google.com/detail/autopause/bcecldolamfbkgokgpnlpmhjcijglhll">AutoPause</a> / <a href="https://chromewebstore.google.com/detail/requestisolation/aljkbkjgcllgbhiimdeeefdfocbkolmb">RequestIsolation</a> / <a href="https://chrome.google.com/webstore/detail/aodfhblfhpcdadgcnpkfibjgjdoenoja">postLogger</a> / <a href="https://ndev.tk/">ndev.tk</a> </p1><p2 id="info"></p2>
