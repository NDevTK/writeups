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

  const share = document.getElementById('share');
  
  if (navigator.share) share.hidden = false;
  
  share.onclick = () => {
    navigator.share({url: location.href})
  }
