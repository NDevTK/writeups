---
layout: default
---
<div>
  <ul id="credits">
    {% for data in site.data.people %}
      <li>
        <h2>
          {{ data.credit }} <a href="{{ data.social | relative_url }}">Social</a>
        </h2>
      </li>
    {% endfor %}
  </ul>
</div>
<script type="speculationrules">
{
  "prerender": [
    {
      "source": "document",
      "where": { "href_matches": "/*\\?*#*" },
      "eagerness": "moderate"
    }
  ],
  "prefetch": [
    {
      "source": "document",
      "where": { "not": { "href_matches": "/*\\?*#*" } },
      "eagerness": "moderate"
    }
  ]
}
</script>
