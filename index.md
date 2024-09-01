---
layout: default
---

<div>
  <ul id="postLinks">
    {% for post in site.posts %}
      <li>
        <h2>
          <a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
        </h2>
      </li>
    {% endfor %}
  </ul>
  
  <p1><a href="{{ "/feed.xml" | relative_url }}">RSS</a> / [Chromium](https://issues.chromium.org/issues?q=reporter:(ndevtk@protonmail.com)) / [Credits](https://ndevtk.github.io/writeups/credits/) / [X](https://x.com/ndevtk) / [Discord](https://discord.gg/AUJjpZHFbP) / [YouTube](https://www.youtube.com/@NDevTK) / [Privacy](https://ndevtk.github.io/writeups/privacy/) / [GitHub](https://ndevtk.github.io/writeups/privacy/) / [ndev.tk](https://ndev.tk/)</p1><br>
</div>
