  "use strict";
  const themes = document.getElementById('themes');
  
  themes.value = theme;

  if (themes.value === '') {
    alert('The ' + theme + " theme doesn't exist, maybe file a bug :)");
  }

  themes.onchange = () => {
    if (themes.value == 'default' || themes.value == '') {
      localStorage.removeItem('theme');
    } else {
      // Consent!
      if (confirm('Allow theme to be saved to localStorage?')) localStorage.setItem('theme', themes.value);
    }
    // Being lazy here
    reload.postMessage('');
    location.reload();
  }

  // Dont assume the user has javascript enabled and no clickjacking.
  if (window.top == window) themes.disabled = false;

 if (theme === 'base64.css') {
  [...document.body.querySelectorAll('p, a')].forEach(e => { e.innerText = btoa(encodeURI(e.innerText)) });
 }
