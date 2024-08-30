  "use strict";

  function getTheme() {
      try {
          return localStorage.getItem('theme') || 'default';
      } catch {
          return 'default';
      }
  }

  const theme = getTheme();

  // default is handled without JS
  if (theme !== 'default') {
      const stylesheet = document.createElement('link');
      stylesheet.href = '/writeups/themes/' + encodeURIComponent(theme);
      stylesheet.rel = 'stylesheet';
      document.head.appendChild(stylesheet);
  }

  const reload = new BroadcastChannel('reload');
  reload.onmessage = (event) => {
      if (location.origin !== event.origin) return;
      location.reload();
  }

  onkeyup = (e) => {
      if (e.key === 'ArrowLeft') history.back();
      if (e.key === 'ArrowRight') history.forward();
  }
