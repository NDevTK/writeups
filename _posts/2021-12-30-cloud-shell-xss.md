---
title: Google Cloud Shell XSS (Awarded $5000)
---

This is an attempt to make a better write up than [575924 – (CVE-2021-41038) XSS in @theia/plugin-ext webview](https://bugs.eclipse.org/bugs/show_bug.cgi?id=575924) :) (It's a Theia bug but Google paid for improving the security of the project after some discussion.)

[https://shell.cloud.google.com/](https://shell.cloud.google.com/) embeds the [Theia IDE](https://theia-ide.org/) from a subdomain of “cloudshell.dev” that can request access to the GCP API via postMessage(), So bugs in the Theia project may affect the security of Google Cloud. (it's not on the Public Suffix List, used to be on appspot.com that is listed)
I'm not sure when the API opt in was added, I think it used to have credentials by default.
```js
window.parent.postMessage({
    "target": "ID from URL of webview",
    "channel": "onmessage",
    "data": {
        "type": "LOG_IN"
    }
}); // Childs are trusted just rename “channel” to “command” and remove “target”.
```
Theia has an implementation of the VS Code webviews which are like iframes and are used to render arbitrary html this can be done via postMessage() from any origin. [(message listener)](https://github.com/eclipse-theia/theia/blob/d3501165bb4e87c3612a1a02c34a1d16ab81802c/packages/plugin-ext/src/main/browser/webview/pre/host.js#L28) [(assignment)](https://github.com/eclipse-theia/theia/blob/d3501165bb4e87c3612a1a02c34a1d16ab81802c/packages/plugin-ext/src/main/browser/webview/pre/main.js#L501)

For security webviews are meant to use a unique origin so the [sandbox restrictions](https://github.com/eclipse-theia/theia/blob/d3501165bb4e87c3612a1a02c34a1d16ab81802c/packages/plugin-ext/src/main/browser/webview/pre/main.js#L480) get enforced but they don't due to the “allow-same-origin”. [(What I've learned so far while bringing VS Code's Webviews to the web – UWTB)](https://blog.mattbierner.com/vscode-webview-web-learnings/).

Google Cloud Shell does not isolate webviews into their own origins like said [here](https://github.com/eclipse-theia/theia/tree/master/packages/plugin-ext#environment-variables) and the webviews are allowed to run terminal commands anyway via postMessage()
```js
window.parent.postMessage({
    "target": "ID from URL of webview",
    "channel": "onmessage",
    "data": {
        "text": "echo ':)'",
        "type": "RUN_IN_TERMINAL"
    }
});
```
However they do use [CSP frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-ancestors) to block embedding of the IDE and its webviews,
`Content-Security-Policy: frame-ancestors 'self' https://*.corp.google.com:* https://*.sandbox.google.com:* https://*.googleplex.com:* https://byteboard.googleplex.com https://byteboard.dev https://edge.byteboard.dev https://enginterview.withgoogle.com https://console.cloud.google.com https://ide.cloud.google.com https://shell.cloud.google.com https://ssh.cloud.google.com;`
So to prevent webview hijacking/xss Theia now checks that messages are from window.parent or a child of the webview. [(Change)](https://github.com/eclipse-theia/theia/pull/10202/files)
Other web IDEs may still be vulnerable if the webviews have no embedding protection like “vscode-webview.net” [(CVE-2022-24526)](https://github.com/microsoft/vscode/issues/144703) or they have [copied](https://github.com/microsoft/vscode/blob/ba40bd16433d5a817bfae15f3b4350e18f144af4/src/vs/workbench/contrib/webview/browser/pre/host.js) from VS Code,
However VS Code now uses MessageChannel and [only sends to window.parent](https://github.com/microsoft/vscode/blob/6960f154ec1db21df82e87c7b043f760e6d45b8f/src/vs/workbench/contrib/webview/browser/pre/main.js#L298).

## Exploitation
In order to exploit this an attacker needs to send a message to the webview.
After looking at the code in `https://www.gstatic.com/_/cloudshell/_/js/` I found that using the “opencloudcodewelcome” URL parameter it will embed Theia and open a webview automatically. [https://shell.cloud.google.com/?show=ide&opencloudcodewelcome=true](https://shell.cloud.google.com/?show=ide&opencloudcodewelcome=true) (this now uses [COOP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy) allow-popups so the opener can't be exploited)

Then to get [XSS](https://owasp.org/www-community/attacks/xss/) any opener can send a message to the embedded webview.
```js
w[2][0].postMessage({channel: "content", args: {options: {allowScripts: true}, contents: "<script>document.write(document.domain)</script>"}}, "*");
```
