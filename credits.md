---
layout: default
---
<div>
  <ul id="credits">
    {% for person in site.data.people %}
      <li>
        <h2>
          {{ person }}
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
