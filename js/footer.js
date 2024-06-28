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

  const share = document.getElementById('share');
  share.onclick = () => {
      if (navigator.share) {
        navigator.share({url: location.href});
      } else {
        open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(location.href));
      }
  }
  share.disabled = false;

  const translate = document.getElementById('translate');
  // Dont translate the google translate
  if (location.origin.endsWith('.translate.goog')) translate.hidden = true;

  // Auto reload the page every 30 minutes (Keep content up to date)
  // This should keep the scroll position and only run when hidden
  const autoReload = 1000 * 60 * 30;
  setInterval(() => {
    if (document.visibilityState === 'hidden') location.reload();
  }, autoReload);
