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
    location.reload();
  }

  // Dont assume the user has javascript enabled.
  themes.disabled = false;

  const share = document.getElementById('share');
  
  if (navigator.share) share.hidden = false;
  
  share.onclick = () => {
    navigator.share({url: location.href})
  }
