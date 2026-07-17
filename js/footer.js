'use strict';
const themes = document.getElementById('themes');
const info = document.getElementById('info');

// "Too common" is decided by prevalence in the HIBP corpus, not a static list:
// a password counted at least this many times is treated as common. In the
// ParentalControlLock fallback those must NOT carry isPwn, so the obvious
// guesses can't open the lock. Tunable — for reference, "123456" is ~37M hits,
// "qwerty123" ~800k, and the long tail drops off fast below here.
const COMMON_PASSWORD_THRESHOLD = 100000;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Checks a password against a minimum length and its prevalence in the HIBP
 * breached-password corpus. No composition rules (per NIST 800-63B): length
 * plus the breach signal is what actually matters. A count >= the threshold is
 * "too common"; any non-zero count is a breach. Network-only — no offline
 * fallback, so it fails closed if HIBP is unreachable.
 * @param {string} password - The plaintext password to evaluate.
 * @returns {Promise<{isValid: boolean, isPwn?: boolean, message: string}>}
 */
async function evaluatePassword(password) {
  if (!password) {
    return {
      isValid: false,
      message: 'Password must be provided.'
    };
  }

  // --- TIER 1: Length only (no composition rules) ---
  if (password.length < 8) {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters long.'
    };
  }

  // --- TIER 2: HIBP prevalence (breach count) ---
  let breachCount;
  try {
    breachCount = await checkHibpApi(password);
  } catch (error) {
    return {
      isValid: false,
      message: 'Error while checking password.'
    };
  }

  if (breachCount >= COMMON_PASSWORD_THRESHOLD) {
    // No isPwn on purpose: the most common passwords must not open the
    // ParentalControlLock fallback.
    return {
      isValid: false,
      message: 'This password is too common. Please choose a unique one.'
    };
  }
  if (breachCount > 0) {
    return {
      isValid: false,
      isPwn: true,
      message:
        'This password has appeared in a data breach. Please choose another.'
    };
  }

  // No breaches on record.
  return {isValid: true, message: 'Password seems to be secure.'};
}

/**
 * Looks the password up in HIBP via k-anonymity and returns how many times it
 * appears in the corpus (0 if not found). Add-Padding rows have a count of 0,
 * so they contribute nothing.
 * @param {string} password
 * @returns {Promise<number>}
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
    `https://api.pwnedpasswords.com/range/${prefix}`,
    {
      headers: {
        'Add-Padding': 'true'
      }
    }
  );
  if (!response.ok)
    throw new Error(`API request failed with status: ${response.status}`);

  const text = await response.text();
  const pwnedLines = text.split(/\r?\n/);

  for (const line of pwnedLines) {
    const [returnedSuffix, count] = line.split(':');
    if (returnedSuffix === suffix) return parseInt(count, 10);
  }

  return 0;
}

// --- Usage Examples (now driven by the live HIBP count) ---
// evaluatePassword("weak").then(console.log);
// -> { isValid: false, message: 'Password must be at least 8 characters long.' }

// evaluatePassword("password").then(console.log);   // count is well over the threshold
// -> { isValid: false, message: 'This password is too common. Please choose a unique one.' }

// A long unique passphrase (composition is not required); only a breach hit rejects it:
// evaluatePassword("a fairly long unique passphrase").then(console.log);
// -> { isValid: true, message: 'Password seems to be secure.' }  // if its HIBP count is 0

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
  // Forward pointer position into the wallpaper iframe so HTML themes can
  // parallax even while it sits behind the page content (which eats the events).
  document.addEventListener(
    'pointermove',
    function (e) {
      frame.contentWindow.postMessage(
        {
          type: 'wallpaper-pointer',
          x: e.clientX / window.innerWidth,
          y: e.clientY / window.innerHeight
        },
        location.origin
      );
    },
    {passive: true}
  );
  var btn = document.createElement('button');
  btn.textContent = '✦';
  btn.title = 'Wallpaper controls';
  // The visible glyph is just a star; give assistive tech a real name.
  btn.setAttribute('aria-label', 'Wallpaper controls');
  btn.style.cssText =
    'position:fixed;left:20px;top:20px;width:42px;height:42px;border:0;' +
    'border-radius:13px;cursor:pointer;z-index:2147483647;color:#fff;' +
    'background:rgba(16,16,22,.42);backdrop-filter:blur(18px);' +
    '-webkit-backdrop-filter:blur(18px);font-size:18px;line-height:1;opacity:.5;';
  // Surface it on hover or keyboard focus (the browser focus ring stays, since
  // cssText never clears outline) so it isn't a faint, easy-to-miss glyph.
  btn.onmouseenter = btn.onfocus = function () {
    btn.style.opacity = '1';
  };
  btn.onmouseleave = btn.onblur = function () {
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
    // no clickjacking, sending shaderwall type shows embed support
    if (window.top === window) document.body.appendChild(btn);
    if (d.state === 'shown' || d.state === 'bare') {
      // 'bare' is a clean wallpaper: keep the iframe forward (covering the page) but with the
      // theme's own controls hidden. The toggle button (above the iframe) brings the controls back.
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

async function hashPassword(message) {
  // PBKDF2 is part of Web Crypto, so this stays library-free while being a
  // proper slow password hash rather than a single fast SHA-256.
  let salt = localStorage.getItem('salt');
  if (!salt) {
    salt = crypto.randomUUID();
    localStorage.setItem('salt', salt);
  }
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(message),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 600000, // OWASP 2023 floor for PBKDF2-HMAC-SHA256
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  // Portable hex (Uint8Array.toHex() is too new to rely on), like checkHibpApi.
  return Array.from(new Uint8Array(bits))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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
        // Popups can be blocked (w is null); and once the user closes the
        // window, stop poking it so we don't spam focus() on a closed window.
        if (w) {
          w.resizeBy(0, -100000);
          const focusLoop = setInterval(() => {
            if (w.closed) {
              clearInterval(focusLoop);
              return;
            }
            w.focus();
          }, 5);
        }
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
  let typeWarn = themes.value.endsWith('.html')
    ? ' May use external services'
    : '';
  // Consent!
  if (
    !themes.value.endsWith('.tmp') &&
    themes.value !== theme &&
    confirm(
      'Allow the ' +
        themes.value +
        ' theme preference to be saved to localStorage?' +
        typeWarn
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
          'We use HIBP to find any valid password, would you like to set a custom one instead?'
        )
      ) {
        while (true) {
          let password = prompt('Enter password');
          let result = await evaluatePassword(password);
          if (result.isValid) {
            let hashedInput = await hashPassword(password);
            localStorage.setItem('password', hashedInput);
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

// The Firefox theme embeds firefox-wasm, which needs SharedArrayBuffer and thus
// a cross-origin-isolated page. GitHub Pages can't send COOP/COEP, so a service
// worker synthesises them (coi-serviceworker.js). That isolation reloads the
// page and changes cross-origin loading site-wide, so we only want it for that
// one theme: register the worker when switching into Firefox and tear it down
// when switching out, instead of running it on every page.
let coiPolicy;
function coiScriptURL() {
  const url = '/writeups/coi-serviceworker.js';
  if (!(window.trustedTypes && window.trustedTypes.createPolicy)) return url;
  // The CSP enforces require-trusted-types-for 'script', so the URL handed to
  // serviceWorker.register() must come from a Trusted Types policy.
  coiPolicy ??= window.trustedTypes.createPolicy('coi-serviceworker', {
    createScriptURL: (s) => s
  });
  return coiPolicy.createScriptURL(url);
}

async function setCoiWorker(enable) {
  if (!('serviceWorker' in navigator)) return;
  try {
    if (enable) {
      await navigator.serviceWorker.register(coiScriptURL());
      // Wait until it's active so the reload below is controlled — and so the
      // freshly loaded page actually comes back cross-origin isolated.
      await navigator.serviceWorker.ready;
    } else {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch (e) {
    console.error('coi-serviceworker:', e);
  }
}

async function reloadAll() {
  // Match the worker to the theme we're switching to, before reloading, so the
  // next page load is isolated (Firefox) or plain (everything else). `theme` is
  // the theme we're leaving; `themes.value` is the one we're moving to.
  if (themes.value === 'Firefox.html') {
    await setCoiWorker(true);
  } else if (theme === 'Firefox.html') {
    await setCoiWorker(false);
  }
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
      let result = await evaluatePassword(password);
      let hashedPassword = localStorage.getItem('password');
      if (hashedPassword) {
        let hashedInput = await hashPassword(password);
        if (hashedInput === hashedPassword) {
          localStorage.removeItem('password');
          localStorage.removeItem('theme');
        }
      } else if (result.isPwn) {
        localStorage.removeItem('theme');
      }
      alert(result.message);
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
