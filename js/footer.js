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
      location.href =
        'https://drive.google.com/file/d/1KjQB7czJo3t8mgYRZMYkbrsY1JIriz7A/view?usp=sharing';
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
  case 'emoji.css':
    [...document.body.querySelectorAll('p, a')].forEach((e) => {
      e.innerText = btoa(
        String.fromCharCode(...new TextEncoder('utf-8').encode(e.innerText))
      );
      e.innerText = encoding(e.innerText);
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
    sharedContext:
      'This is an webapp infomation security bug writeup intended for a tech-savvy audience.',
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

function base2base(srcAlphabet, dstAlphabet) {
    /* modification of github.com/HarasimowiczKamil/any-base to:
		* support multibyte
		* enforce unique alphabets
	*/	
	var  noDifference = srcAlphabet === dstAlphabet
		,srcAlphabet = [...new Set([...srcAlphabet].join(""))]
		,dstAlphabet = [...new Set([...dstAlphabet].join(""))]
		,fromBase = srcAlphabet.length
		,toBase = dstAlphabet.length
		
	return number=>{
		if(noDifference) return number

		number = [...number];
		
		var i, divide, newlen
			,length = number.length
			,result = ''
			,numberMap = {}
		
		for(i = 0; i < length; i++)
			numberMap[i] = srcAlphabet.indexOf(number[i])
				
		do {
			divide = 0
			newlen = 0
			for(i = 0; i < length; i++) {
				divide = divide * fromBase + numberMap[i]
				if(divide >= toBase) {
					numberMap[newlen++] = parseInt(divide / toBase, 10)
					divide = divide % toBase
				}
				else if(newlen)
					numberMap[newlen++] = 0
			}
			length = newlen
			result = dstAlphabet[divide] + result
		} while (newlen != 0)
	
		return result
	}
}

// Encode base64 into emoji
const encoding = base2base('0123456789+/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz=', '😀😁😂🤣😃😄😅😆😉😊😋😎😨😩🤯😬😮‍💨😰😱🥵🥶😳🤪😵👹👺💀☠️👻👽😹😸💩🤖👾🐻🐻‍❄️🐨🐼🐸🦓🐴🫎🫏🦄🐔🐲🐐🐫🦙🦘🦥🦨🦡🐘🦣🐁🐀🪲🐞🦂🕷️🕸️🐠🐡🦑🦐🐙🦞🦔🐇🐿️🦫🦎🐊🐴🫎');
