  "use strict";
  const theme = localStorage.getItem('theme') || 'default';
  
  if (theme !== 'default') {
    const stylesheet = document.createElement('link');
    stylesheet.href = '/writeups/themes/' + encodeURIComponent(theme);
    stylesheet.rel = 'stylesheet';
    document.head.appendChild(stylesheet);
  }
