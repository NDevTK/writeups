'use strict';

const allowedThemes = [
  'audio.css',
  'base64.css',
  'basic.css',
  'blueprint-schematic.css',
  'code-matrix.css',
  'comic.css',
  'cyberpunk.css',
  'default.css',
  'duck.css',
  'emoji.css',
  'flip.css',
  'glitch.css',
  'gradient.css',
  'light.css',
  'mc.css',
  'noscript.css',
  'oceanic-depths.css',
  'old-terminal.css',
  'rainbow-text.css',
  'redacted-classified.css',
  'retro-gamification.css',
  'summarizer.css',
  'typoifier.css'
];

const isMobile =
  'userAgentData' in navigator
    ? navigator.userAgentData.mobile
    : /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

const searchParams = new URL(location.href).searchParams;

function getTheme() {
  let themeCandidate;
  if (searchParams.has('theme')) {
    themeCandidate = searchParams.get('theme');
  } else {
    try {
      themeCandidate = localStorage.getItem('theme') || 'default.css';
    } catch {
      themeCandidate = 'default.css';
    }
  }

  if (allowedThemes.includes(themeCandidate)) {
    return themeCandidate;
  }
  return 'default.css';
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

if (location.hash.startsWith('#deprecated')) {
  alert('Requested resource is apparently deprecated.');
  location.hash = '';
}
