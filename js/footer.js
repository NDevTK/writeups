  "use strict";
  const themes = document.getElementById('themes');
  
  themes.value = theme;

  themes.onchange = () => {
    if (themes.value == 'default') {
      localStorage.removeItem('theme');
    } else {
      localStorage.setItem('theme', themes.value);
    }
    // Being lazy here
    reload.postMessage('');
    location.reload();
  }

  // Dont assume the user has javascript enabled and no clickjacking.
  if (window.top == window) themes.disabled = false;

  const translate = document.getElementById('translate');
  // Dont translate the google translate
  if (location.origin.endsWith('.translate.goog')) translate.hidden = true;

 if (theme === 'base64.css') {
  [...document.body.querySelectorAll('p, a')].forEach(e => { e.innerText = btoa(encodeURI(e.innerText)) });
 }
