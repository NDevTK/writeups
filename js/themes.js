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

if (theme.endsWith('.html')) {
  var frame = document.createElement('iframe');
  frame.src = '/writeups/themes/' + encodeURIComponent(theme);
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  frame.style.cssText = [
    'position:fixed',
    'inset:0',
    'width:100%',
    'height:100%',
    'border:0',
    'margin:0',
    'z-index:-1'
  ].join(';');
  document.body.prepend(frame);

  var btn = document.createElement('button');
  btn.textContent = '✦';
  btn.title = 'Wallpaper controls';
  btn.style.cssText =
    'position:fixed;left:20px;top:20px;width:42px;height:42px;border:0;' +
    'border-radius:13px;cursor:pointer;z-index:2147483647;color:#fff;' +
    'background:rgba(16,16,22,.42);backdrop-filter:blur(18px);' +
    '-webkit-backdrop-filter:blur(18px);font-size:18px;line-height:1;opacity:.5;';
  btn.onmouseenter = function () {
    btn.style.opacity = '1';
  };
  btn.onmouseleave = function () {
    btn.style.opacity = '.5';
  };
  document.body.appendChild(btn);

  btn.addEventListener('click', function () {
    frame.contentWindow.postMessage({type: 'shaderwall', action: 'toggle'});
  });

  window.addEventListener('message', function (e) {
    if (e.origin != location.origin) return;
    var d = e.data || {};
    if (d.type !== 'shaderwall') return;
    if (d.state === 'shown') {
      frame.style.zIndex = '2147483646';
      frame.style.pointerEvents = 'auto';
    } else if (d.state === 'hidden') {
      frame.style.zIndex = '-1';
      frame.style.pointerEvents = 'none';
    }
  });
} else {
  const stylesheet = document.createElement('link');
  stylesheet.href = '/writeups/themes/' + encodeURIComponent(theme);
  stylesheet.rel = 'stylesheet';
  document.head.appendChild(stylesheet);
}

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
