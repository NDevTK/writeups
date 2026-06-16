'use strict';
const themes = document.getElementById('themes');
const info = document.getElementById('info');

// 1. A small set of notoriously common passwords to save API calls.
// Convert inputs to lowercase before checking against this set.
const COMMON_PASSWORDS = new Set([
  '123456',
  'password',
  '123456789',
  '12345',
  '12345678',
  'qwerty',
  'password123',
  'admin',
  '111111',
  'letmein',
  'welcome'
]);

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Checks a password against complexity rules, common dictionaries, and HIBP.
 * @param {string} password - The plaintext password to evaluate.
 * @returns {Promise<{isValid: boolean, message: string}>}
 */
async function evaluatePassword(password) {
  if (!password) {
    return {
      isValid: false,
      message: 'Password must be provided.'
    };
  }

  // --- TIER 1: Basic Security Requirements ---
  if (password.length < 8) {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters long.'
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one uppercase letter.'
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one lowercase letter.'
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one number.'
    };
  }
  // Matches any character that is NOT a word character (a-z, A-Z, 0-9) or underscore
  if (!/[^a-zA-Z0-9_]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one special character.'
    };
  }

  // --- TIER 2: Local Dictionary Check ---
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return {
      isValid: false,
      message: 'This password is too common. Please choose a unique one.'
    };
  }

  // --- TIER 3: HIBP Network API Call ---
  try {
    const isPwned = await checkHibpApi(password);
    if (isPwned) {
      return {
        isValid: false,
        isPwn: true,
        message:
          'This password has appeared in a data breach. Please choose another.'
      };
    }
  } catch (error) {
    return {
      isValid: false,
      message: 'Error while checking password.'
    };
  }

  // If it survives all checks, it's valid!
  return {isValid: true, message: 'Password seems to be secure.'};
}

/**
 * Helper function: Checks the password against the HIBP API using k-anonymity.
 * @param {string} password
 * @returns {Promise<boolean>}
 */
async function checkHibpApi(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

  const prefix = hashHex.slice(0, 5);
  const suffix = hashHex.slice(5);

  const response = await fetch(
    `https://api.pwnedpasswords.com/range/${prefix}`
  );
  if (!response.ok)
    throw new Error(`API request failed with status: ${response.status}`);

  const text = await response.text();
  const pwnedLines = text.split(/\r?\n/);

  for (const line of pwnedLines) {
    const [returnedSuffix] = line.split(':');
    if (returnedSuffix === suffix) return true;
  }

  return false;
}

// --- Usage Examples ---
// evaluatePassword("weak").then(console.log);
// -> { isValid: false, message: 'Password must be at least 8 characters long.' }

// evaluatePassword("Password123!").then(console.log);
// -> { isValid: false, message: 'This password is too common. Please choose a unique one.' }

// evaluatePassword("Tr0ub4dor&3").then(console.log);
// -> { isValid: false, message: 'This password has appeared in a data breach. Please choose another.' }

// evaluatePassword("SuperS3cr3t!Random_Phrase").then(console.log);
// -> { isValid: true, message: 'Password is secure.' }

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

  btn.addEventListener('click', function () {
    frame.contentWindow.postMessage({type: 'shaderwall', action: 'toggle'});
  });

  window.addEventListener('message', function (e) {
    if (e.origin != location.origin) return;
    if (e.data === 'deleteme') {
      document.body.removeChild(frame);
      document.body.removeChild(btn);
      return;
    }
    var d = e.data || {};
    if (d.type !== 'shaderwall') return;
    document.body.appendChild(btn);
    if (d.state === 'shown') {
      frame.style.zIndex = '2147483646';
      frame.style.pointerEvents = 'auto';
    } else if (d.state === 'hidden') {
      frame.style.zIndex = '-1';
      frame.style.pointerEvents = 'none';
    }
  });
}

// Shared buffer for random number generation to avoid allocation overhead
const randomBuffer = new Uint32Array(1);

themes.value = theme;

const writeupsContext = {
  sharedContext:
    'This is an webapp infomation security bug writeup intended for a tech-savvy audience.',
  format: 'plain-text',
  length: 'long',
  expectedInputLanguages: ['en'],
  outputLanguage: 'en',
  expectedContextLanguages: ['en']
};

function getRandomIntInclusive(min, max) {
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

function hashPassword(message) {
  // SHA256 may seem fast
  let salt = localStorage.getItem('salt');
  if (!salt) {
    salt = crypto.randomUUID();
    localStorage.setItem('salt', salt);
  }
  return crypto
    .createHash('sha256')
    .update(salt + message + salt)
    .digest('hex');
}

themes.onchange = async () => {
  if (themes.value === 'random.tmp') {
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
    case 'spoof.tmp':
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
    case 'ai.tmp':
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
    !themes.value.endsWith('.tmp') &&
    themes.value !== theme &&
    confirm(
      'Allow the ' +
        themes.value +
        ' theme preference to be saved to localStorage?'
    )
  ) {
    localStorage.setItem('theme', themes.value);

    if (themes.value == 'summarizer.css') {
      document.body.innerText = 'Please wait loading AI model...';
      await Summarizer.create(writeupsContext);
    }

    if (themes.value == 'ParentalControlLock.css') {
      if (
        confirm(
          'We use HIBP to find any valid password, would you like to set a custom one?'
        )
      ) {
        while (true) {
          let password = prompt('Enter password');
          let result = await evaluatePassword(password);
          if (result.isValid) {
            localStorage.setItem('password', hashPassword(password));
            await sleep(2000);
            alert('Custom password has been set');
            break;
          } else {
            alert(result.message);
          }
        }
      }
    }

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

async function applyTheme() {
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
      const typoElements = Array.from(document.querySelectorAll('p, a'));
      let typoIndex = 0;

      const processTypoChunk = () => {
        const chunkStart = performance.now();
        // Process for ~16ms to maintain 60fps
        while (
          typoIndex < typoElements.length &&
          performance.now() - chunkStart < 16
        ) {
          // Optimization: check time only every 50 iterations to reduce overhead
          for (
            let i = 0;
            i < 50 && typoIndex < typoElements.length;
            i++, typoIndex++
          ) {
            const e = typoElements[typoIndex];
            e.childNodes.forEach((node) => {
              if (node.data === '' || node.data === undefined) return;
              node.data = TypoSTR(node.data);
            });
          }
        }

        if (typoIndex < typoElements.length) {
          requestAnimationFrame(processTypoChunk);
        }
      };

      requestAnimationFrame(processTypoChunk);
      break;
    case 'audio.css':
      const utterance = new SpeechSynthesisUtterance(document.body.innerText);
      const voices = speechSynthesis.getVoices();
      utterance.voice = voices[0];
      window.addEventListener('pagehide', () => {
        speechSynthesis.cancel();
      });
      utterance.onend = () => {
        speechSynthesis.speak(utterance);
      };
      speechSynthesis.speak(utterance);
      break;
    case 'base64.css':
      document.body.querySelectorAll('p, a').forEach((e) => {
        e.innerText = btoa(
          String.fromCharCode(...new TextEncoder('utf-8').encode(e.innerText))
        );
      });
      break;
    case 'emoji.css':
      // Encode base64 into emoji
      const encoding = base2base(
        '0123456789+/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz=',
        '😀 😃 😄 😁 😆 😅 🤣 😂 🥹 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 ☺️ 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🫢 🤭 🤫 🤔 🙂‍↔️ 🙂‍↕️ 🫡 🤐 🤨 😐️ 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 😮‍💨 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🫠 🥵 🥶 😶‍🌫️ 🫥 🥴 🫨 😵‍💫 😵 🤯 🤠 🥳 🥸 😎 🤓 🧐 🫤 😕 😟 🙁 ☹️ 😮 😯 😲 😳 🫣 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👹 👺 👻 👽️ 👾 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾 🙈 🙉 🙊 👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈️ 👉️ 👆️ 🖕 👇️ ☝️ 🫵 👍️ 👎️ ✊ 👊 🤛 🤜 👏 🙌 👐 🫶 🤲 🫳 🫴 🫱 🫲 🤝 🫸 🫷 🙏 ✍️ 💅 🤳 💪 🦾 🦿 🦵 🦶 👂️ 🦻 👃 🧠 🫀 🫁 🦷 🦴 👀 👁️ 👅 👄 🫦 💋 👶 🧒 👦 👧 🧑 👨 👩 🧔 🧔‍♀️ 🧔‍♂️ 🧑‍🦰 👨‍🦰 👩‍🦰 🧑‍🦱 👨‍🦱 👩‍🦱 🧑‍🦳 👨‍🦳 👩‍🦳 🧑‍🦲 👨‍🦲 👩‍🦲 👱 👱‍♂️ 👱‍♀️ 🧓 👴 👵 🙍 🙍‍♂️ 🙍‍♀️ 🙎 🙎‍♂️ 🙎‍♀️ 🙅 🙅‍♂️ 🙅‍♀️ 🙆 🙆‍♂️ 🙆‍♀️ 💁 💁‍♂️ 💁‍♀️ 🙋 🙋‍♂️ 🙋‍♀️ 🧏 🧏‍♂️ 🧏‍♀️ 🙇 🙇‍♂️ 🙇‍♀️ 🤦 🤦‍♂️ 🤦‍♀️ 🤷 🤷‍♂️ 🤷‍♀️ 🧑‍⚕️ 👨‍⚕️ 👩‍⚕️ 🧑‍🎓 👨‍🎓 👩‍🎓 🧑‍🏫 👨‍🏫 👩‍🏫 🧑‍⚖️ 👨‍⚖️ 👩‍⚖️ 🧑‍🌾 👨‍🌾 👩‍🌾 🧑‍🍳 👨‍🍳 👩‍🍳 🧑‍🔧 👨‍🔧 👩‍🔧 🧑‍🏭 👨‍🏭 👩‍🏭 🧑‍💼 👨‍💼 👩‍💼 🧑‍🔬 👨‍🔬 👩‍🔬 🧑‍💻 👨‍💻 👩‍💻 🧑‍🎤 👨‍🎤 👩‍🎤 🧑‍🎨 👨‍🎨 👩‍🎨 🧑‍✈️ 👨‍✈️ 👩‍✈️ 🧑‍🚀 👨‍🚀 👩‍🚀 🧑‍🚒 👨‍🚒 👩‍🚒 👮 👮‍♂️ 👮‍♀️ 🕵️ 🕵️‍♂️ 🕵️‍♀️ 💂 💂‍♂️ 💂‍♀️ 🥷 👷 👷‍♂️ 👷‍♀️ 🫅 🤴 👸 👳 👳‍♂️ 👳‍♀️ 👲 🧕 🤵 🤵‍♂️ 🤵‍♀️ 👰 👰‍♂️ 👰‍♀️ 🫄 🫃 🤰 🤱 👩‍🍼 👨‍🍼 🧑‍🍼 👼 🎅 🤶 🧑‍🎄 🦸 🦸‍♂️ 🦸‍♀️ 🦹 🦹‍♂️ 🦹‍♀️ 🧙 🧙‍♂️ 🧙‍♀️ 🧚 🧚‍♂️ 🧚‍♀️ 🧛 🧛‍♂️ 🧛‍♀️ 🧜 🧜‍♂️ 🧜‍♀️ 🧝 🧝‍♂️ 🧝‍♀️ 🧞 🧞‍♂️ 🧞‍♀️ 🧟 🧟‍♂️ 🧟‍♀️ 🧌 💆 💆‍♂️ 💆‍♀️ 💇 💇‍♂️ 💇‍♀️ 🚶 🚶‍♂️ 🚶‍♀️ 🧍 🧍‍♂️ 🧍‍♀️ 🧎 🧎‍♂️ 🧎‍♀️ 🧑‍🦯 👨‍🦯 👩‍🦯 🧑‍🦼 👨‍🦼 👩‍🦼 🧑‍🦽 👨‍🦽 👩‍🦽 🏃 🏃‍♂️ 🏃‍♀️ 🚶‍➡️ 🚶‍♀️‍➡️ 🚶‍♂️‍➡️ 🧎‍➡️ 🧎‍♀️‍➡️ 🧎‍♂️‍➡️ 🧑‍🦯‍➡️ 👨‍🦯‍➡️ 👩‍🦯‍➡️ 🧑‍🦼‍➡️ 👨‍🦼‍➡️ 👩‍🦼‍➡️ 🧑‍🦽‍➡️ 👨‍🦽‍➡️ 👩‍🦽‍➡️ 🏃‍➡️ 🏃‍♀️‍➡️ 🏃‍♂️‍➡️ 💃 🕺 🕴️ 👯 👯‍♂️ 👯‍♀️ 🧖 🧖‍♂️ 🧖‍♀️ 🧗 🧗‍♂️ 🧗‍♀️ 🤺 🏇 ⛷️ 🏂️ 🏌️ 🏌️‍♂️ 🏌️‍♀️ 🏄️ 🏄‍♂️ 🏄‍♀️ 🚣 🚣‍♂️ 🚣‍♀️ 🏊️ 🏊‍♂️ 🏊‍♀️ ⛹️ ⛹️‍♂️ ⛹️‍♀️ 🏋️ 🏋️‍♂️ 🏋️‍♀️ 🚴 🚴‍♂️ 🚴‍♀️ 🚵 🚵‍♂️ 🚵‍♀️ 🤸 🤸‍♂️ 🤸‍♀️ 🤼 🤼‍♂️ 🤼‍♀️ 🤽 🤽‍♂️ 🤽‍♀️ 🤾 🤾‍♂️ 🤾‍♀️ 🤹 🤹‍♂️ 🤹‍♀️ 🧘 🧘‍♂️ 🧘‍♀️ 🛀 🛌 🧑‍🤝‍🧑 👭 👫 👬 💏 👩‍❤️‍💋‍👨 👨‍❤️‍💋‍👨 👩‍❤️‍💋‍👩 💑 👩‍❤️‍👨 👨‍❤️‍👨 👩‍❤️‍👩 👪️ 👨‍👩‍👦 👨‍👩‍👧 👨‍👩‍👧‍👦 👨‍👩‍👦‍👦 👨‍👩‍👧‍👧 👨‍👨‍👦 👨‍👨‍👧 👨‍👨‍👧‍👦 👨‍👨‍👦‍👦 👨‍👨‍👧‍👧 👩‍👩‍👦 👩‍👩‍👧 👩‍👩‍👧‍👦 👩‍👩‍👦‍👦 👩‍👩‍👧‍👧 👨‍👦 👨‍👦‍👦 👨‍👧 👨‍👧‍👦 👨‍👧‍👧 👩‍👦 👩‍👦‍👦 👩‍👧 👩‍👧‍👦 👩‍👧‍👧 🗣️ 👤 👥 🫂 👣🐵 🐒 🦍 🦧 🐶 🐕️ 🦮 🐕‍🦺 🐩 🐺 🦊 🦝 🐱 🐈️ 🐈‍⬛ 🦁 🐯 🐅 🐆 🐴 🐎 🦄 🫏 🦓 🦌 🫎 🦬 🐮 🐂 🐃 🐄 🐷 🐖 🐗 🐽 🐏 🐑 🐐 🐪 🐫 🦙 🦒 🐘 🦣 🦏 🦛 🐭 🐁 🐀 🐹 🐰 🐇 🐿️ 🦫 🦔 🦇 🐻 🐻‍❄️ 🐨 🐼 🦥 🦦 🦨 🦘 🦡 🐾 🦃 🐔 🐓 🐣 🐤 🐥 🐦️ 🐧 🐦‍⬛ 🕊️ 🦅 🦆 🪿 🦢 🦉 🦤 🦩 🦚 🦜 🐦‍🔥 🪽 🪶 🪹 🪺 🥚 🐸 🐊 🐢 🦎 🐍 🐲 🐉 🦕 🦖 🐳 🐋 🐬 🦭 🐟️ 🐠 🐡 🦈 🪼 🐙 🦑 🦀 🦞 🦐 🪸 🦪 🐚 🐌 🦋 🐛 🐜 🐝 🪲 🐞 🦗 🪳 🕷️ 🕸️ 🦂 🦟 🪰 🪱 🦠 🍄 🍄‍🟫 💐 💮 🏵️ 🌼 🌻 🌹 🥀 🌺 🌷 🌸 🪷 🪻 🌱 🪴 🏕️ 🌲 🌳 🌰 🌴 🌵 🎋 🎍 🌾 🌿 ☘️ 🍀 🍁 🍂 🍃 🌍️ 🌎️ 🌏️ 🌑 🌒 🌓 🌔 🌕️ 🌖 🌗 🌘 🌙 🌚 🌛 🌜️ ☀️ 🌝 🌞 🪐 💫 ⭐️ 🌟 ✨ 🌠 ☄️ 🌌 ☁️ ⛅️ ⛈️ 🌤️ 🌥️ 🌦️ 🌧️ 🌨️ 🌩️ 🌪️ 🌫️ 🌬️ 🌀 🌈 🌂 ☂️ ☔️ ⛱️ ⚡️ ❄️ ☃️ ⛄️ 🏔️ ⛰️ 🗻 🌋 🔥 💧 🌊 💥 💦 💨🍇 🍈 🍉 🍊 🍋 🍋‍🟩 🍌 🍍 🥭 🍎 🍏 🍐 🍑 🍒 🍓 🫐 🥝 🍅 🫒 🥥 🥑 🍆 🥔 🥕 🌽 🌶️ 🫑 🥒 🥬 🥦 🫛 🧄 🧅 🫚 🍄 🍄‍🟫 🫘 🥜 🌰 🍞 🥐 🥖 🫓 🥨 🥯 🥞 🧇 🧀 🍖 🍗 🥩 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🫔 🥙 🧆 🥚 🍳 🥘 🍲 🫕 🥣 🥗 🍿 🧈 🧂 🥫 🍱 🍘 🍙 🍚 🍛 🍜 🍝 🍠 🍢 🍣 🍤 🍥 🥮 🍡 🥟 🥠 🥡 🍦 🍧 🍨 🍩 🍪 🎂 🍰 🧁 🥧 🍫 🍬 🍭 🍮 🍯 🍼 🥛 🫗 ☕️ 🫖 🍵 🍶 🍾 🍷 🍸️ 🍹 🍺 🍻 🥂 🥃 🥤 🧋 🧃 🧉 🧊 🥢 🍽️ 🍴 🥄 🔪⚽️ ⚾️ 🥎 🏀 🏐 🏈 🏉 🎾 🥏 🎳 🏏 🏑 🏒 🥍 🏓 🏸 🥊 🥋 🥅 ⛳️ ⛸️ 🎣 🤿 🎽 🎿 🛷 🥌 🎯 🪀 🪁 🎱 🎖️ 🏆️ 🏅 🥇 🥈 🥉🏔️ ⛰️ 🌋 🗻 🏕️ 🏖️ 🏜️ 🏝️ 🏟️ 🏛️ 🏗️ 🧱 🪨 🪵 🛖 🏘️ 🏚️ 🏠️ 🏡 🏢 🏣 🏤 🏥 🏦 🏨 🏩 🏪 🏫 🏬 🏭️ 🏯 🏰 💒 🗼 🗽 ⛪️ 🕌 🛕 🕍 ⛩️ 🕋 ⛲️ ⛺️ 🌁 🌃 🏙️ 🌄 🌅 🌆 🌇 🌉 🗾 🏞️ 🎠 🎡 🎢 💈 🎪 🚂 🚃 🚄 🚅 🚆 🚇️ 🚈 🚉 🚊 🚝 🚞 🚋 🚌 🚍️ 🚎 🚐 🚑️ 🚒 🚓 🚔️ 🚕 🚖 🚗 🚘️ 🚙 🛻 🚚 🚛 🚜 🏎️ 🏍️ 🛵 🦽 🦼 🛺 🚲️ 🛴 🛹 🛼 🚏 🛣️ 🛤️ 🛢️ ⛽️ 🚨 🚥 🚦 🛑 🚧 ⚓️ ⛵️ 🛶 🚤 🛳️ ⛴️ 🛥️ 🚢 ✈️ 🛩️ 🛫 🛬 🪂 💺 🚁 🚟 🚠 🚡 🛰️ 🚀 🛸 🎆 🎇 🎑 🗿🛎️ 🧳 ⌛️ ⏳️ ⌚️ ⏰ ⏱️ ⏲️ 🕰️ 🌡️ 🗺️ 🧭 🎃 🎄 🧨 🎈 🎉 🎊 🎎 🪭 🎏 🎐 🎀 🎁 🎗️ 🎟️ 🎫 🔮 🪄 🧿 🎮️ 🕹️ 🎰 🎲 ♟️ 🧩 🧸 🪅 🪆 🖼️ 🎨 🧵 🪡 🧶 🪢 👓️ 🕶️ 🥽 🥼 🦺 👔 👕 👖 🧣 🧤 🧥 🧦 👗 👘 🥻 🩱 🩲 🩳 👙 👚 👛 👜 👝 🛍️ 🎒 🩴 👞 👟 🥾 🥿 👠 👡 🩰 👢 👑 👒 🎩 🎓️ 🧢 🪖 ⛑️ 📿 💄 💍 💎 📢 📣 📯 🎙️ 🎚️ 🎛️ 🎤 🎧️ 📻️ 🎷 🪗 🎸 🎹 🎺 🎻 🪕 🪈 🪇 🥁 🪘 🪩 📱 📲 ☎️ 📞 📟️ 📠 🔋 🪫 🔌 💻️ 🖥️ 🖨️ ⌨️ 🖱️ 🖲️ 💽 💾 💿️ 📀 🧮 🎥 🎞️ 📽️ 🎬️ 📺️ 📷️ 📸 📹️ 📼 🔍️ 🔎 🕯️ 💡 🔦 🏮 🪔 📔 📕 📖 📗 📘 📙 📚️ 📓 📒 📃 📜 📄 📰 🗞️ 📑 🔖 🏷️ 💰️ 🪙 💴 💵 💶 💷 💸 💳️ 🪪 🧾 ✉️ 💌 📧 🧧 📨 📩 📤️ 📥️ 📦️ 📫️ 📪️ 📬️ 📭️ 📮 🗳️ ✏️ ✒️ 🖋️ 🖊️ 🖌️ 🖍️ 📝 💼 📁 📂 🗂️ 📅 📆 🗒️ 🗓️ 📇 📈 📉 📊 📋️ 📌 📍 📎 🖇️ 📏 📐 ✂️ 🗃️ 🗄️ 🗑️ 🔒️ 🔓️ 🔏 🔐 🔑 🗝️ 🔨 🪓 ⛏️ ⚒️ 🛠️ 🗡️ ⚔️ 💣️ 🔫 🪃 🏹 🛡️ 🪚 🔧 🪛 🔩 ⚙️ 🗜️ ⚖️ 🦯 🔗 ⛓️‍💥 ⛓️ 🪝 🧰 🧲 🪜 🛝 🛞 🫙 ⚗️ 🧪 🧫 🧬 🔬 🔭 📡 🩻 💉 🩸 💊 🩹 🩺 🩼 🚪 🛗 🪞 🪟 🛏️ 🛋️ 🪑 🪤 🚽 🪠 🚿 🛁 🧼 🫧 🪒 🪮 🧴 🧷 🧹 🧺 🧻 🪣 🪥 🧽 🧯 🛟 🛒 🚬 ⚰️ 🪦 ⚱️ 🏺 🪧 🕳️💘 💝 💖 💗 💓 💞 💕 💟 ❣️ 💔 ❤️ 🧡 💛 💚 🩵 💙 💜 🩷 🤎 🖤 🩶 🤍 ❤️‍🔥 ❤️‍🩹 💯 ♨️ 💢 💬 👁️‍🗨️ 🗨️ 🗯️ 💭 💤 🌐 ♠️ ♥️ ♦️ ♣️ 🃏 🀄️ 🎴 🎭️ 🔇 🔈️ 🔉 🔊 🔔 🔕 🎼 🎵 🎶 💹 🏧 🚮 🚰 ♿️ 🚹️ 🚺️ 🚻 🚼️ 🧑‍🧑‍🧒 🧑‍🧑‍🧒‍🧒 🧑‍🧒 🧑‍🧒‍🧒 🚾 🛂 🛃 🛄 🛅 🛜 ⛓️‍💥 ⚠️ 🚸 ⛔️ 🚫 🚳 🚭️ 🚯 🚱 🚷 📵 🔞 ☢️ ☣️ ⬆️ ↗️ ➡️ ↘️ ⬇️ ↙️ ⬅️ ↖️ ↕️ ↔️ ↩️ ↪️ ⤴️ ⤵️ 🔃 🔄 🔙 🔚 🔛 🔜 🔝 🛐 ⚛️ 🕉️ ✡️ ☸️ 🪯 ☯️ ✝️ ☦️ ☪️ ☮️ 🕎 🔯 🪬 ♈️ ♉️ ♊️ ♋️ ♌️ ♍️ ♎️ ♏️ ♐️ ♑️ ♒️ ♓️ ⛎ 🔀 🔁 🔂 ▶️ ⏩️ ⏭️ ⏯️ ◀️ ⏪️ ⏮️ 🔼 ⏫ 🔽 ⏬ ⏸️ ⏹️ ⏺️ ⏏️ 🎦 🔅 🔆 📶 📳 📴 ♀️ ♂️ ⚧ ✖️ ➕ ➖ ➗ 🟰 ♾️ ‼️ ⁉️ ❓️ ❔ ❕ ❗️ 〰️ 💱 💲 ⚕️ ♻️ ⚜️ 🔱 📛 🔰 ⭕️ ✅ ☑️ ✔️ ❌ ❎ ➰ ➿ 〽️ ✳️ ✴️ ❇️ ©️ ®️ ™️ #️⃣ *️⃣ 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 🔠 🔡 🔢 🔣 🔤 🅰️ 🆎 🅱️ 🆑 🆒 🆓 ℹ️ 🆔 Ⓜ️ 🆕 🆖 🅾️ 🆗 🅿️ 🆘 🆙 🆚 🈁 🈂️ 🈷️ 🈶 🈯️ 🉐 🈹 🈚️ 🈲 🉑 🈸 🈴 🈳 ㊗️ ㊙️ 🈺 🈵 🔴 🟠 🟡 🟢 🔵 🟣 🟤 ⚫️ ⚪️ 🟥 🟧 🟨 🟩 🟦 🟪 🟫 ⬛️ ⬜️ ◼️ ◻️ ◾️ ◽️ ▪️ ▫️ 🔶 🔷 🔸 🔹 🔺 🔻 💠 🔘 🔳 🔲 🕛️ 🕧️ 🕐️ 🕜️ 🕑️ 🕝️ 🕒️ 🕞️ 🕓️ 🕟️ 🕔️ 🕠️ 🕕️ 🕡️ 🕖️ 🕢️ 🕗️ 🕣️ 🕘️ 🕤️ 🕙️ 🕥️ 🕚️ 🕦️🏁 🚩 🎌 🏴 🏳️ 🏳️‍🌈 🏳️‍⚧️ 🏴‍☠️👋🏻 🤚🏻 🖐🏻 ✋🏻 🖖🏻 👌🏻 🤌🏻 🤏🏻 ✌🏻 🤞🏻 🤟🏻 🤘🏻 🤙🏻 👈🏻 👉🏻 👆🏻 🖕🏻 👇🏻 ☝🏻 🫵🏻 👍🏻 👎🏻 ✊🏻 👊🏻 🤛🏻 🤜🏻 👏🏻 🙌🏻 👐🏻 🤲🏻 🫱🏻 🫲🏻 🤝🏻 🫳🏻 🫴🏻 🫸🏻 🫷🏻 🙏🏻 🫰🏻 🫶🏻 ✍🏻 💅🏻 🤳🏻 💪🏻 🦵🏻 🦶🏻 👂🏻 🦻🏻 👃🏻 👶🏻 🧒🏻 👦🏻 👧🏻 🧑🏻 👱🏻 👨🏻 🧔🏻 🧔🏻‍♀️ 🧔🏻‍♂️ 👨🏻‍🦰 👨🏻‍🦱 👨🏻‍🦳 👨🏻‍🦲 👩🏻 👩🏻‍🦰 🧑🏻‍🦰 👩🏻‍🦱 🧑🏻‍🦱 👩🏻‍🦳 🧑🏻‍🦳 👩🏻‍🦲 🧑🏻‍🦲 👱🏻‍♀️ 👱🏻‍♂️ 🧓🏻 👴🏻 👵🏻 🙍🏻 🙍🏻‍♂️ 🙍🏻‍♀️ 🙎🏻 🙎🏻‍♂️ 🙎🏻‍♀️ 🙅🏻 🙅🏻‍♂️ 🙅🏻‍♀️ 🙆🏻 🙆🏻‍♂️ 🙆🏻‍♀️ 💁🏻 💁🏻‍♂️ 💁🏻‍♀️ 🙋🏻 🙋🏻‍♂️ 🙋🏻‍♀️ 🧏🏻 🧏🏻‍♂️ 🧏🏻‍♀️ 🙇🏻 🙇🏻‍♂️ 🙇🏻‍♀️ 🤦🏻 🤦🏻‍♂️ 🤦🏻‍♀️ 🤷🏻 🤷🏻‍♂️ 🤷🏻‍♀️ 🧑🏻‍⚕️ 👨🏻‍⚕️ 👩🏻‍⚕️ 🧑🏻‍🎓 👨🏻‍🎓 👩🏻‍🎓 🧑🏻‍🏫 👨🏻‍🏫 👩🏻‍🏫 🧑🏻‍⚖️ 👨🏻‍⚖️ 👩🏻‍⚖️ 🧑🏻‍🌾 👨🏻‍🌾 👩🏻‍🌾 🧑🏻‍🍳 👨🏻‍🍳 👩🏻‍🍳 🧑🏻‍🔧 👨🏻‍🔧 👩🏻‍🔧 🧑🏻‍🏭 👨🏻‍🏭 👩🏻‍🏭 🧑🏻‍💼 👨🏻‍💼 👩🏻‍💼 🧑🏻‍🔬 👨🏻‍🔬 👩🏻‍🔬 🧑🏻‍💻 👨🏻‍💻 👩🏻‍💻 🧑🏻‍🎤 👨🏻‍🎤 👩🏻‍🎤 🧑🏻‍🎨 👨🏻‍🎨 👩🏻‍🎨 🧑🏻‍✈️ 👨🏻‍✈️ 👩🏻‍✈️ 🧑🏻‍🚀 👨🏻‍🚀 👩🏻‍🚀 🧑🏻‍🚒 👨🏻‍🚒 👩🏻‍🚒 👮🏻 👮🏻‍♂️ 👮🏻‍♀️ 🕵🏻 🕵🏻‍♂️ 🕵🏻‍♀️ 💂🏻 💂🏻‍♂️ 💂🏻‍♀️ 🥷🏻 👷🏻 👷🏻‍♂️ 👷🏻‍♀️ 🫅🏻 🤴🏻 👸🏻 👳🏻 👳🏻‍♂️ 👳🏻‍♀️ 👲🏻 🧕🏻 🤵🏻 🤵🏻‍♂️ 🤵🏻‍♀️ 👰🏻 👰🏻‍♂️ 👰🏻‍♀️ 🫄🏻 🫃🏻 🤰🏻 🧑🏻‍🍼 👨🏻‍🍼 👩🏻‍🍼 🤱🏻 👼🏻 🎅🏻 🤶🏻 🧑🏻‍🎄 🦸🏻 🦸🏻‍♂️ 🦸🏻‍♀️ 🦹🏻 🦹🏻‍♂️ 🦹🏻‍♀️ 🧙🏻 🧙🏻‍♂️ 🧙🏻‍♀️ 🧚🏻 🧚🏻‍♂️ 🧚🏻‍♀️ 🧛🏻 🧛🏻‍♂️ 🧛🏻‍♀️ 🧜🏻 🧜🏻‍♂️ 🧜🏻‍♀️ 🧝🏻 🧝🏻‍♂️ 🧝🏻‍♀️ 💆🏻 💆🏻‍♂️ 💆🏻‍♀️ 💇🏻 💇🏻‍♂️ 💇🏻‍♀️ 🚶🏻 🚶🏻‍♂️ 🚶🏻‍♀️ 🧍🏻 🧍🏻‍♂️ 🧍🏻‍♀️ 🧎🏻 🧎🏻‍♂️ 🧎🏻‍♀️ 🧑🏻‍🦯 👨🏻‍🦯 👩🏻‍🦯 🧑🏻‍🦼 👨🏻‍🦼 👩🏻‍🦼 🧑🏻‍🦽 👨🏻‍🦽 👩🏻‍🦽 🏃🏻 🏃🏻‍♂️ 🏃🏻‍♀️ 🚶🏻‍➡️ 🚶🏻‍♀️‍➡️ 🚶🏻‍♂️‍➡️ 🧎🏻‍➡️ 🧎🏻‍♀️‍➡️ 🧎🏻‍♂️‍➡️ 🧑🏻‍🦯‍➡️ 👨🏻‍🦯‍➡️ 👩🏻‍🦯‍➡️ 🧑🏻‍🦼‍➡️ 👨🏻‍🦼‍➡️ 👩🏻‍🦼‍➡️ 🧑🏻‍🦽‍➡️ 👨🏻‍🦽‍➡️ 👩🏻‍🦽‍➡️ 🏃🏻‍➡️ 🏃🏻‍♀️‍➡️ 🏃🏻‍♂️‍➡️ 💃🏻 🕺🏻 🕴🏻 🧖🏻 🧖🏻‍♂️ 🧖🏻‍♀️ 🧗🏻 🧗🏻‍♂️ 🧗🏻‍♀️ 🏇🏻 🏂🏻 🏌🏻 🏌🏻‍♂️ 🏌🏻‍♀️ 🏄🏻 🏄🏻‍♂️ 🏄🏻‍♀️ 🚣🏻 🚣🏻‍♂️ 🚣🏻‍♀️ 🏊🏻 🏊🏻‍♂️ 🏊🏻‍♀️ ⛹🏻 ⛹🏻‍♂️ ⛹🏻‍♀️ 🏋🏻 🏋🏻‍♂️ 🏋🏻‍♀️ 🚴🏻 🚴🏻‍♂️ 🚴🏻‍♀️ 🚵🏻 🚵🏻‍♂️ 🚵🏻‍♀️ 🤸🏻 🤸🏻‍♂️ 🤸🏻‍♀️ 🤽🏻 🤽🏻‍♂️ 🤽🏻‍♀️ 🤾🏻 🤾🏻‍♂️ 🤾🏻‍♀️ 🤹🏻 🤹🏻‍♂️ 🤹🏻‍♀️ 🧘🏻 🧘🏻‍♂️ 🧘🏻‍♀️ 🛀🏻 🛌🏻 💑🏻 💏🏻 👫🏻 👭🏻 👬🏻'
      );
      const elements = document.body.querySelectorAll('p, a');
      const updates = [];
      elements.forEach((e) => {
        // Optimization: Avoid double innerText write to prevent unnecessary layout thrashing
        const base64 = btoa(
          String.fromCharCode(...new TextEncoder('utf-8').encode(e.innerText))
        );
        updates.push({element: e, text: encoding(base64)});
      });
      updates.forEach(({element, text}) => {
        element.innerText = text;
      });
      break;
    case 'noscript.css':
      document.body.innerText =
        'You are using the NoScript theme with Javascript enabled :)';
      break;
    case 'ParentalControlLock.css':
      // Not a real security boundary
      document.body.innerText = 'Locked';
      document.title = 'Locked';
      document.addEventListener('contextmenu', (event) =>
        event.preventDefault()
      );
      window.onkeydown = (event) => {
        event.preventDefault();
      };
      await sleep(2000);
      let password = prompt('Enter password');
      let hashedPassword = localStorage.getItem('password');
      if (hashedPassword) {
        if (hashPassword(password) === hashedPassword) {
          localStorage.removeItem('password');
          localStorage.removeItem('theme');
          location.reload();
        }
      } else {
        let result = await evaluatePassword(password);
        if (result.isPwn) {
          localStorage.removeItem('theme');
        }
        alert(result.message);
      }
      location.reload();
      break;
    case 'summarizer.css':
      summarizer();
      break;
  }
}

applyTheme();

if (theme.endsWith('.tmp')) {
  document.body.innerText = 'Theme must not end in .tmp because I said so.';
}

async function summarizerSupport() {
  if ('Summarizer' in self) {
    const a = await Summarizer.availability({languages: ['en']});
    if (a === 'downloadable' && !navigator.userActivation.isActive)
      return notSupported(
        'user activation needed for downloading Summarizer API data'
      );
    if (a == 'downloading' || a == 'downloadable' || a == 'available')
      return true;
    return notSupported('unusable Summarizer API');
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

  const summarizer = await Summarizer.create(writeupsContext);
  const stream = summarizer.summarizeStreaming(content.innerText, {
    context: document.title
  });

  content.innerText = '';

  let buffer = '';
  let frameId = null;

  const updateDOM = () => {
    content.innerText += buffer;
    buffer = '';
    frameId = null;
  };

  for await (const chunk of stream) {
    buffer += chunk;
    if (!frameId) {
      frameId = requestAnimationFrame(updateDOM);
    }
  }

  if (frameId) {
    cancelAnimationFrame(frameId);
    updateDOM();
  } else if (buffer) {
    updateDOM();
  }
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
  var noDifference = srcAlphabet === dstAlphabet,
    srcAlphabet = [...new Set([...srcAlphabet].join(''))],
    dstAlphabet = [...new Set([...dstAlphabet].join(''))],
    fromBase = BigInt(srcAlphabet.length),
    toBase = BigInt(dstAlphabet.length);

  // Optimization: Pre-compute lookup map for O(1) access
  var srcMap = {};
  for (var i = 0; i < srcAlphabet.length; i++) {
    srcMap[srcAlphabet[i]] = BigInt(i);
  }

  return (number) => {
    if (noDifference) return number;

    var val = 0n;
    for (var i = 0; i < number.length; i++) {
      var char = number[i];
      if (srcMap[char] === undefined) continue;
      val = val * fromBase + srcMap[char];
    }

    if (val === 0n) return dstAlphabet[0];

    var result = [];
    while (val > 0n) {
      var remainder = val % toBase;
      result.push(dstAlphabet[Number(remainder)]);
      val = val / toBase;
    }

    return result.reverse().join('');
  };
}
