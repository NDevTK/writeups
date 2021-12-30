---
title: Embed users content from Google Cloud Shell in remote iframes (Not fixed)
tags: []
date: 24/10/2021
---


Since there's no embedding protection on /_cloudshell/ and a “SameSite None” cookie is used for “CloudShellAuthorization” it's possible to embed the files on to an attacker controlled website like
```js
iframe.src = "8080-SERVER.cloudshell.dev/_cloudshell/file?path=/entrypoint.sh";
```
when the Theia subdomain is known (DNS is normally insecure).
This allows attacks like The [Human Side Channel](https://ronmasas.com/posts/the-human-side-channel) and [Element leaks](https://xsleaks.dev/docs/attacks/element-leaks/).
It would be worse if the “SERVER” could be leaked without network access,
That's prevented because the redirector [https://ssh.cloud.google.com/devshell/proxy?port=8080&devshellProxyPath=%2Ffoo](https://ssh.cloud.google.com/devshell/proxy?port=8080&devshellProxyPath=%2Ffoo) blocks embedding and has COOP.
