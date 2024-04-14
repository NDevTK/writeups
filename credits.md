---
layout: default
---
<div>
  <ul id="credits">
    {% for person in site.data.people %}
      <li>
        <h2>
          {{ site.data.people[person].credit }} <a href="{{ site.data.people[person].social | relative_url }}">Social</a>
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
