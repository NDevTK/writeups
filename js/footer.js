'use strict';
const themes = document.getElementById('themes');

themes.value = theme;

if (themes.value === '') {
  alert('The ' + theme + " theme doesn't exist, maybe file a bug :)");
  localStorage.removeItem('theme');
  // Prioritizes consistency over user preference :/
  reloadAll();
}

function getRandom(max) {
  // This is not secure
  return Math.floor((Math.random() * 10) % max);
}

themes.onchange = () => {
  switch (themes.value) {
    case 'default.css':
      localStorage.removeItem('theme');
      reloadAll();
      return;
    case 'random':
      const allowedThemes = [...themes.options].filter((e) => {
        // Filter out the currently active theme and ourself.
        return e.value != themes.value && e.value != theme;
      });
      themes.value = allowedThemes[getRandom(allowedThemes.length)].value;
      break;
    case 'mc.css':
      // https://www.minecraft.net/en-us/usage-guidelines
      alert(
        'NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.'
      );
      break;
  }
  // Consent!
  if (
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
    if (getRandom(2)) words[index] = Typo(word);
  });
  return words.join(' ');
}

function Typo(word) {
  let index = getRandom(word.length);
  let letter = word[index];
  let newString = AtPos(word, index, letter);
  if (getRandom(2)) newString = AtPos(newString, index, letter);
  return newString;
}

function reloadAll() {
  reload.postMessage('');
  location.reload();
}

switch (theme) {
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
}

// Dont assume the user has javascript enabled and no clickjacking.
if (window.top == window) themes.disabled = false;
