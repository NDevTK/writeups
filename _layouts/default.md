<!DOCTYPE html>
<html lang="{{ page.lang | default: site.lang | default: "en-US" }}">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">

{% seo %}

<link rel="stylesheet" href="{{ "/assets/css/style.css?v=" | append: site.github.build_revision | relative_url }}">
{% include head-custom.html %}

  </head>
  <body>
    <div class="container-lg px-3 my-5 markdown-body">
      {% if site.title and site.title != page.title %}
      <h1><a href="{{ "/" | absolute_url }}">{{ site.title }}</a></h1>
      {% endif %}
      <div id="content">
      {{ content }}
      </div>
      <div class="footer border-top border-gray-light mt-5 pt-3 text-right">
        {% include footer-custom.html %}
      </div>
    </div>

  </body>
</html>
