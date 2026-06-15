'use strict';
const themes = document.getElementById('themes');
const info = document.getElementById('info');

/**
 * Checks if a password has been compromised using the HIBP API.
 * @param {string} password - The plaintext password to check.
 * @returns {Promise<boolean>} - Returns true if pwned, false otherwise.
 */
async function isPasswordPwned(password) {
  // 1. Hash the password using SHA-1
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);

  // 2. Convert the buffer to a hexadecimal string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

  // 3. Split the hash into a 5-character prefix and the remaining suffix
  const prefix = hashHex.slice(0, 5);
  const suffix = hashHex.slice(5);

  try {
    // 4. Fetch the compromised suffixes for this prefix
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`
    );

    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    const text = await response.text();

    // 5. Check if our suffix exists in the API response
    // The API returns lines formatted as "SUFFIX:COUNT"
    const pwnedLines = text.split(/\r?\n/);
    for (const line of pwnedLines) {
      const [returnedSuffix] = line.split(':');
      if (returnedSuffix === suffix) {
        return true; // Match found! Password is pwned.
      }
    }

    return false; // No match found. Password is safe (for now).
  } catch (error) {
    console.error('Failed to check password against HIBP:', error);
    // Decide how you want to handle API errors. Returning false assumes safe on failure.
    return false;
  }
}

// --- Usage Example ---
// isPasswordPwned("password123").then(isPwned => console.log(isPwned)); // Expected: true
// isPasswordPwned("correcthorsebatterystaple!@#").then(isPwned => console.log(isPwned)); // Expected: false

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
  case 'lock.css':
    document.body.innerText = 'Locked';
    if (isPasswordPwned(prompt('Enter password'))) {
      localStorage.removeItem('theme');
    }
    break;
  case 'summarizer.css':
    summarizer();
    break;
}

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
