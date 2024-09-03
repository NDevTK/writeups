'use strict';
const themes = document.getElementById('themes');

themes.value = theme;

if (themes.value === '') {
  alert('The ' + theme + " theme doesn't exist, maybe file a bug :)");
  localStorage.removeItem('theme');
  reloadAll();
}

themes.onchange = () => {
  if (themes.value == 'default') {
    localStorage.removeItem('theme');
  } else {
    if (themes.value == 'random') {
      const allowedThemes = [...themes.options].filter((e) => {
        // Filter out the currently active theme and ourself.
        return e.value != themes.value && e.value != theme;
      });
      themes.value =
        allowedThemes[Math.floor(Math.random() * allowedThemes.length)].value;
    }
    if (themes.value == 'mc.css') {
      // https://www.minecraft.net/en-us/usage-guidelines
      alert(
        'NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.'
      );
    }
    // Consent!
    if (
      confirm(
        'Allow the ' +
          themes.value +
          ' theme preference to be saved to localStorage?'
      )
    ) {
      localStorage.setItem('theme', themes.value);
      reloadAll();
    }
  }
};

// Dont assume the user has javascript enabled and no clickjacking.
if (window.top == window) themes.disabled = false;

if (theme === 'base64.css') {
  [...document.body.querySelectorAll('p, a')].forEach((e) => {
    e.innerText = btoa(
      String.fromCharCode(...new TextEncoder('utf-8').encode(e.innerText))
    );
  });
}

function reloadAll() {
  reload.postMessage('');
  location.reload();
}
