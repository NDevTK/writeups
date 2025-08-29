'use strict';

const isMobile =
  'userAgentData' in navigator
    ? navigator.userAgentData.mobile
    : /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

const searchParams = new URL(location.href).searchParams;

function getTheme() {
  if (searchParams.has('theme')) {
    return searchParams.get('theme');
  }
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

let count = 0;

onkeyup = (e) => {
  if (e.key === '.' && location.pathname === '/writeups/') {
    count += 1;
    if (count === 10) {
      alert('Developer Mode enabled.');
      count = 0;
    }
  }
  if (e.key === '.' && location.pathname !== '/writeups/') {
    location.href = '/writeups/';
  }
};

if (location.hash === '#deprecated/')
  alert('Requested resource is deprecated.');
