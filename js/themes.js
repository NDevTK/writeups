'use strict';

const isMobile = ('userAgentData' in navigator) ? navigator.userAgentData.mobile : /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

function getTheme() {
  try {
    return localStorage.getItem('theme') || 'default.css';
  } catch {
    return 'default.css';
  }
}

const theme = getTheme();

const stylesheet = document.createElement('link');
stylesheet.href = '/writeups/themes/' + encodeURIComponent(theme);
stylesheet.rel = 'stylesheet';
document.head.appendChild(stylesheet);

const reload = new BroadcastChannel('reload');
reload.onmessage = (event) => {
  if (location.origin !== event.origin) return;
  location.reload();
};

onkeyup = (e) => {
  if (e.key === '.' && location.pathname !== '/writeups/') {
    location.href = '/writeups/';
  }
};
