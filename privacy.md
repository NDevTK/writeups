---
layout: default
title: Privacy
---

# Browser Extension Privacy Policy
No data is collected or shared by the extensions with the exception of "RCE PoC" as that depends on google drive there <https://www.google.com/drive/terms-of-service/> still applies.

# Writeups Privacy Policy
This website may store Cookies and use Google Analytics <https://www.google.com/policies/privacy/partners/> because I would like to know what posts and themes need improving, You can Opt-out via the [Google Analytics Opt-out Add-on](https://chrome.google.com/webstore/detail/google-analytics-opt-out/fllaojicojecljbmefodhfapmkghcbnh) or use this button <button id="state">JS Disabled</button>  
<script>
  state.onclick = toggle;
  state.innerText = localStorage.getItem('optout') ? 'Opted-out' : 'Opted-in';
  
  function toggle() {
    if (localStorage.getItem('optout')) {
      localStorage.removeItem('optout');
    } else {
      localStorage.setItem('optout', true);
    }
    reload.postMessage('');
    location.reload();
  }
</script>
It also uses GitHub Pages <https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement> and Google Fonts <https://fonts.google.com/>.  
If your wondering about the lack of Cookie banner, it went on holiday.

# `ndev.tk` Privacy Policy
The following services are in use `cdn.jsdelivr.net`, Cloudflare, GitHub pages, Google embed.  
Sometimes data is stored in localStorage for website functionality.


# Contact Information
Site owner: [ndevtk@protonmail.com](mailto:ndevtk@protonmail.com)
