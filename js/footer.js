'use strict';
const themes = document.getElementById('themes');
const info = document.getElementById('info');

themes.value = theme;

function getRandomIntInclusive(min, max) {
  const randomBuffer = new Uint32Array(1);

  window.crypto.getRandomValues(randomBuffer);

  let randomNumber = randomBuffer[0] / (0xffffffff + 1);

  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(randomNumber * (max - min + 1)) + min;
}

function getRandom(max) {
  return getRandomIntInclusive(0, max - 1);
}

function notSupported(reason) {
  alert('The ' + themes.value + ' theme cant be used with ' + reason + '.');
  themes.value = theme;
  return false;
}

themes.onchange = async () => {
  if (themes.value === 'random') {
    const allowedThemes = [...themes.options].filter((e) => {
      // Filter out the currently active theme and ourself.
      return e.value != themes.value && e.value != theme;
    });
    // Select a random dropdown option.
    themes.value = allowedThemes[getRandom(allowedThemes.length)].value;
  }

  switch (themes.value) {
    case 'default.css':
      localStorage.removeItem('theme');
      reloadAll();
      return;
    case 'mc.css':
      // https://www.minecraft.net/en-us/usage-guidelines
      alert(
        'NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.'
      );
      break;
    case 'noscript.css':
      notSupported('javascript enabled');
      break;
    case 'spoof':
      if (isMobile) {
        notSupported('a mobile device');
      } else {
        let w = window.open(
          'https://accounts.google.com/writeups',
          '',
          'width=1000000000,height=1'
        );
        w.resizeBy(0, -100000);
        setInterval((_) => w.focus(), 5);
      }
      break;
    case 'ai':
      AIWarning();
      location.href = 'https://www.youtube.com/watch?v=2jhVRk1H7vw';
      break;
    case 'summarizer.css':
      const supported = await summarizerSupport();
      if (!supported) break;
      AIWarning();
      break;
  }
  // Consent!
  if (
    themes.value.endsWith('.css') &&
    themes.value !== theme &&
    confirm(
      'Allow the ' +
        themes.value +
        ' theme preference to be saved to localStorage?'
    )
  ) {
    localStorage.setItem('theme', themes.value);
    reloadAll();
  } else {
    // Revert UI
    themes.value = theme;
  }
};

function AtPos(str, position, newStr) {
  return str.slice(0, position) + newStr + str.slice(position);
}

function TypoSTR(str) {
  if (str.length === 0) return;
  let words = str.split(' ');
  words.forEach((word, index) => {
    if (word.length === 0) return;
    // For security links and email addresses wont get a typo
    if (word.includes('://') || word.includes('@')) return;
    if (getRandom(2)) words[index] = Typo(word);
  });
  return words.join(' ');
}

function Typo(word) {
  let index = getRandom(word.length);
  let letter = word[index];
  // If chosen is a number then ignore
  if (!isNaN(letter)) return word;
  let newString = AtPos(word, index, letter);
  if (getRandom(2)) newString = AtPos(newString, index, letter);
  return newString;
}

function reloadAll() {
  reload.postMessage('');
  location.reload();
}

switch (theme) {
  case 'duck.css':
    const link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = '/writeups/duck.svg';
    break;
  case 'typoifier.css':
    document.querySelectorAll('p, a').forEach((e) => {
      e.childNodes.forEach((node) => {
        if (node.data === '' || node.data === undefined) return;
        node.data = TypoSTR(node.data);
      });
    });
    break;
  case 'audio.css':
    const utterance = new SpeechSynthesisUtterance(document.body.innerText);
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices[0];
    window.addEventListener('pagehide', () => {
      speechSynthesis.cancel();
    });
    setInterval(() => {
      if (speechSynthesis.speaking) return;
      speechSynthesis.speak(utterance);
    }, 1000);
    break;
  case 'base64.css':
    [...document.body.querySelectorAll('p, a')].forEach((e) => {
      e.innerText = btoa(
        String.fromCharCode(...new TextEncoder('utf-8').encode(e.innerText))
      );
    });
    break;
  case 'noscript.css':
    document.body.innerText =
      'You are using the NoScript theme with Javascript enabled :)';
    break;
  case 'summarizer.css':
    summarizer();
    break;
}

if (!theme.endsWith('.css')) {
  document.body.innerText = 'Themes end in .css :)';
}

async function summarizerSupport() {
  if ('ai' in self && 'summarizer' in self.ai) {
    const c = await ai.summarizer.capabilities();
    if (c.available === 'no') return notSupported('unusable Summarizer API');
    return true;
  }
  return notSupported('no Summarizer API');
}

function AIWarning() {
  alert('AI content, might be misleading');
}

async function summarizer() {
  const supported = await summarizerSupport();
  // Dont run on the listing page since for security AI is not allowed to render HTML.
  if (
    !supported ||
    location.pathname === '/writeups/credits/' ||
    location.pathname === '/writeups/privacy/' ||
    location.pathname === '/writeups/'
  )
    return;
  const summarizer = await ai.summarizer.create({
    sharedContext: `**The writeups document a collection of security vulnerabilities discovered in various software and online services.** They primarily focus on web security issues, including Cross-Site Scripting (XSS), Same-Origin Policy (SOP) bypasses, information leaks (like access tokens, cookies, user data, and URLs), and other security flaws.

Key aspects of the context include:

*   **Focus on Google Products and Services:** Many writeups detail vulnerabilities found in Google Cloud Shell, Google extensions, Google Accounts/GAIA, Google Photos, Project IDX, Chromium infra, Google Scholar PDF Reader, and various Google websites and services.
*   **Browser Security:** A significant portion of the writeups concerns browser security, particularly in Chromium and related browser extensions. There are also mentions of security features in browsers like Content Security Policy (CSP), Cross-Origin Opener Policy (COOP), and Site Isolation.
*   **Vulnerability Research and Bug Bounties:** Many writeups mention reporting these vulnerabilities through bug bounty programs (like Google VRP) and the rewards received. The writeups often provide technical details and proof-of-concept code to demonstrate the vulnerabilities.
*   **Cross-Site Leaks (XS-Leaks):** Several writeups specifically address cross-site information leaks (XS-Leaks), highlighting techniques like timing attacks and cache probing.
*   **Security of Third-Party Libraries and Services:** Some writeups also cover vulnerabilities found in third-party libraries used by various websites and services, such as PDF.js, EqualWeb Accessibility Library, and Nuance Library.
*   **Exploitation Techniques:** The writeups often include code snippets and detailed steps to reproduce the vulnerabilities, illustrating various exploitation techniques.
*   **Fixes and Mitigations:** Some writeups mention how the reported vulnerabilities were fixed or the mitigations implemented by the affected vendors.
*   **Tools and Methodologies:** The author sometimes mentions tools and methodologies used for vulnerability research, such as code auditing, dynamic analysis, and browser developer tools.
*   **Personal Anecdotes and Opinions:** The author occasionally includes personal anecdotes, opinions on security practices, and interactions with bug bounty programs.

In essence, the site serves as a technical blog or portfolio showcasing the author's findings in web security research, with a strong emphasis on vulnerabilities affecting Google products and the Chromium browser ecosystem, often discovered and reported through bug bounty programs.`,
    format: 'plain-text',
    length: 'long'
  });
  content.innerText = await summarizer.summarize(content.innerText);
}

// Dont assume the user has javascript enabled and no clickjacking.
if (window.top === window && !searchParams.has('theme'))
  themes.disabled = false;
// Javascript enabled, not a mobile device.
if (location.pathname === '/writeups/' && !isMobile)
  info.innerText = 'You can go back here with the dot key.';
