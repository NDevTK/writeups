---
title: SponsorBlock
---

[SponsorBlock](https://sponsor.ajay.app/) is a browser extension to skip youtube sponsors using crowd sourced data.  
Was forked from [my extension](https://github.com/NDevTK/YTSponsorSkip) despite what it says that was not in 2020.  
Since its crowd sourced it has to trust its users but to prevent abuse VIPs can lock segments.

# Clickjacking (2022)
Because they wanted to insert the extension popup on to the YouTube page popup.html was added to web_accessible_resources,  
The ability to use a iframe was unknown there was no embedding protection and it used a hacky sendRequestToCustomServer function to inject the content into the page dom.    
This meant the persons user id was exposed to youtube and the popup controls such as the ability to turn off sponsor skiping could be clickjacked.
```js
let frame = document.createElement('iframe');
frame.src = 'chrome-extension://mnjggcdmjocbbbhaepdhchncahnbgone/popup.html';
document.body.appendChild(frame)
```
This was fixed by just using the iframe and checking the origin of the parant with postMessage for *.youtube.com  
On firefox this attack is harder because it uses a randomized id for the url this also prevents detecting the existence of extensions.

# Javascript allowed on the API (2021)
Fixed by adding a CSP. [Post-Spectre Web Development](https://w3c.github.io/webappsec-post-spectre-webdev/)

# Trusting 3rd party (2021)
The servers nginx.conf had a proxy_pass for a 3rd party service.  
That would allow session and viewed video ids to be leaked via a service worker and impersonation of the sponsor.ajay.app domain.

# Unlisted video IDs exposed to the SponsorBlock server (2020)
Fixed by checking if a video was unlisted and then asking the user, later changed to a k-anonymity system.

# Insecure user id generation (2019)
The extension uses a random id to authenticate users that is then hashed when stored in the public database.  
But it used the insecure Math.random() it now uses window.crypto.getRandomValues

# Rate limit bypass (2019)
Since the server was using caddy it was possible to spoof your IP address with the x-forwarded-for header.

# Users IPs exposed in public database (2019)
While IPv4 address where hashed 5000 times its using sha256 with a static salt so it would be easy to compute all possible IP adresss.  
This was fixed by moving the data to a private database.
