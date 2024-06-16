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
  
  if (navigator.share) share.disabled = false;
  
  share.onclick = () => {
    navigator.share({url: location.href})
  }
