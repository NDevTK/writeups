  "use strict";

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
