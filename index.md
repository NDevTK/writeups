<ul>
  {% assign posts = site.posts | reverse %}
  {% for post in posts %}
    <li>
      <a href="{{ post.url }}">{{ post.title }}</a>
    </li>
  {% endfor %}
</ul>
