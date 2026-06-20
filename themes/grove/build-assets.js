// Grove sprite generator: authors each element as SVG and rasterises it to a PNG
// with resvg, so the art lives as editable source and can be regenerated.
//   NODE_PATH=/tmp/assets/node_modules node themes/grove/build-assets.js
// (dev deps: @resvg/resvg-js, sharp — installed outside the repo)
const { Resvg } = require('@resvg/resvg-js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'assets');
fs.mkdirSync(OUT, { recursive: true });

const S = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb}">${body}</svg>`;
const png = (svg, w) => new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render().asPng();
const save = (name, svg, w) => fs.writeFileSync(`${OUT}/${name}.png`, png(svg, w));

// ---- deer (2 walk frames) with belly shadow + leg shading ----
const deerSvg = (lf) => S('260 215', `
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8773f"/><stop offset="1" stop-color="#6c4626"/></linearGradient>
<linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f4a2b"/><stop offset="1" stop-color="#3f2a18"/></linearGradient></defs>
<g stroke-linecap="round">
<line x1="86" y1="132" x2="${84 + lf[0]}" y2="196" stroke="#553a23" stroke-width="8"/>
<line x1="150" y1="130" x2="${151 + lf[1]}" y2="194" stroke="#553a23" stroke-width="8"/>
<line x1="98" y1="135" x2="${95 + lf[2]}" y2="201" stroke="url(#lg)" stroke-width="9"/>
<line x1="161" y1="133" x2="${164 + lf[3]}" y2="199" stroke="url(#lg)" stroke-width="9"/></g>
<path d="M58,104 C49,101 47,113 55,119 C60,121 63,113 62,107 Z" fill="#6b4626"/>
<path d="M60,120 C56,99 80,89 102,90 C128,91 150,94 166,106 C174,113 171,127 162,134 C148,143 116,146 94,143 C76,141 63,140 60,120 Z" fill="url(#bg)"/>
<circle cx="80" cy="116" r="23" fill="url(#bg)"/>
<path d="M70,104 C95,92 135,93 168,107 C150,99 110,99 84,108 Z" fill="#b88350" opacity="0.5"/>
<path d="M72,138 C100,146 140,144 160,133 C136,148 96,149 72,143 Z" fill="#3f2a18" opacity="0.4"/>
<path d="M150,108 C160,95 173,84 184,73 L199,82 C188,99 173,114 163,130 Z" fill="url(#bg)"/>
<ellipse cx="196" cy="70" rx="17" ry="12.5" fill="url(#bg)"/>
<path d="M206,60 C218,62 226,71 223,82 C221,90 208,87 200,80 C196,74 200,64 206,60 Z" fill="url(#bg)"/>
<ellipse cx="222" cy="80" rx="4.5" ry="3.5" fill="#2a1c12"/>
<path d="M184,58 C177,47 180,40 189,45 C194,49 193,59 188,63 Z" fill="#7c5230"/>
<circle cx="202" cy="68" r="2.6" fill="#140e09"/><circle cx="203" cy="67" r="0.8" fill="#d8c7a8"/>
<g fill="none" stroke="#bda572" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round">
<path d="M188,54 C184,38 182,26 187,15"/><path d="M184,37 C177,33 172,29 169,22"/><path d="M187,16 C184,11 182,8 178,5"/>
<path d="M193,54 C198,40 202,30 200,19"/><path d="M199,38 C207,35 212,31 215,26"/><path d="M200,20 C203,14 205,11 209,8"/></g>`);
save('deer_a', deerSvg([0, 0, 0, 0]), 210);
save('deer_b', deerSvg([7, -6, -6, 7]), 210);

save('oak', S('180 210', `
<defs><radialGradient id="oak" gradientUnits="userSpaceOnUse" cx="64" cy="52" r="92"><stop offset="0" stop-color="#90ce54"/><stop offset=".55" stop-color="#5da53a"/><stop offset="1" stop-color="#377322"/></radialGradient></defs>
<path d="M84,206 C82,170 80,150 82,118 L100,118 C102,150 100,176 96,206 Z" fill="#6b4628"/>
<path d="M90,150 C80,140 70,138 62,132" stroke="#5e3c22" stroke-width="5" fill="none" stroke-linecap="round"/>
<g fill="url(#oak)"><circle cx="90" cy="78" r="44"/><circle cx="54" cy="88" r="32"/><circle cx="126" cy="88" r="32"/><circle cx="70" cy="54" r="30"/><circle cx="112" cy="56" r="30"/><circle cx="92" cy="40" r="26"/></g>
<g fill="#a2db64" opacity="0.55"><circle cx="70" cy="50" r="13"/><circle cx="90" cy="38" r="9"/></g>`), 150);

save('pine', S('140 220', `
<defs><linearGradient id="pine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#46934a"/><stop offset="1" stop-color="#1f5a28"/></linearGradient></defs>
<rect x="63" y="182" width="13" height="36" rx="3" fill="#6b4628"/>
<g fill="url(#pine)"><path d="M70,18 L106,86 L34,86 Z"/><path d="M70,58 L116,136 L24,136 Z"/><path d="M70,104 L124,188 L16,188 Z"/></g>
<g fill="#5cb050" opacity="0.4"><path d="M70,18 L86,52 L70,52 Z"/><path d="M70,58 L92,100 L70,100 Z"/></g>`), 120);

save('bush', S('150 96', `
<defs><radialGradient id="b" gradientUnits="userSpaceOnUse" cx="52" cy="30" r="74"><stop offset="0" stop-color="#86c64a"/><stop offset="1" stop-color="#357020"/></radialGradient></defs>
<g fill="url(#b)"><circle cx="48" cy="60" r="32"/><circle cx="96" cy="62" r="30"/><circle cx="72" cy="42" r="30"/></g>
<g fill="#9ad65a" opacity="0.5"><circle cx="52" cy="38" r="10"/></g>`), 130);

save('grass', S('80 60', `<g fill="none" stroke-linecap="round">
<path d="M14,58 C12,46 10,40 6,34" stroke="#458c2e" stroke-width="4"/><path d="M22,58 C20,40 16,30 12,22" stroke="#4f9c34" stroke-width="4"/>
<path d="M32,58 C32,38 32,28 34,17" stroke="#5fae3c" stroke-width="4"/><path d="M42,58 C44,40 48,30 52,22" stroke="#4f9c34" stroke-width="4"/>
<path d="M54,58 C56,42 60,34 64,28" stroke="#67b842" stroke-width="4"/></g>`), 80);

const flower = (c) => S('40 60', `<path d="M20,58 L20,28" stroke="#4f9c34" stroke-width="3"/>
<g fill="${c}"><circle cx="20" cy="18" r="6"/><circle cx="12" cy="23" r="6"/><circle cx="28" cy="23" r="6"/><circle cx="15" cy="13" r="6"/><circle cx="25" cy="13" r="6"/></g><circle cx="20" cy="18" r="4.5" fill="#ffd24a"/>`);
save('flower_p', flower('#ef6a8a'), 44);
save('flower_w', flower('#f3ecf2'), 44);

save('cloud', S('210 100', `
<defs><linearGradient id="cl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dbe8f2"/></linearGradient></defs>
<g fill="url(#cl)"><ellipse cx="72" cy="62" rx="48" ry="28"/><ellipse cx="126" cy="56" rx="52" ry="34"/><ellipse cx="104" cy="44" rx="38" ry="27"/><ellipse cx="158" cy="66" rx="36" ry="23"/></g>`), 200);

save('sun', S('100 100', `<defs><radialGradient id="s"><stop offset="0" stop-color="#fff6c8"/><stop offset=".7" stop-color="#ffd84a"/><stop offset="1" stop-color="#ffbe2e"/></radialGradient></defs><circle cx="50" cy="50" r="40" fill="url(#s)"/>`), 100);

// ---- NEW: moon ----
save('moon', S('100 100', `<defs><radialGradient id="m" cx="42%" cy="38%" r="65%"><stop offset="0" stop-color="#fdfbf0"/><stop offset="1" stop-color="#d3dde9"/></radialGradient></defs>
<circle cx="50" cy="50" r="40" fill="url(#m)"/>
<g fill="#c4cedb" opacity="0.55"><circle cx="64" cy="40" r="7"/><circle cx="42" cy="62" r="9"/><circle cx="38" cy="40" r="5"/><circle cx="58" cy="60" r="4"/></g>`), 100);

// ---- NEW: soft glow (sun/moon halo, fireflies) ----
save('glow', S('128 128', `<defs><radialGradient id="g"><stop offset="0" stop-color="#ffffff" stop-opacity="1"/><stop offset=".3" stop-color="#fff0b8" stop-opacity=".85"/><stop offset="1" stop-color="#ffcf4a" stop-opacity="0"/></radialGradient></defs><circle cx="64" cy="64" r="64" fill="url(#g)"/>`), 128);

// ---- duck (improved upswept tail) ----
save('duck', S('170 116', `
<defs><linearGradient id="db" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c2a06e"/><stop offset="1" stop-color="#8a6a44"/></linearGradient>
<linearGradient id="dh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2faa55"/><stop offset="1" stop-color="#176b34"/></linearGradient></defs>
<path d="M32,74 C22,70 14,62 12,54 C20,60 28,68 38,78 Z" fill="#8a6a44"/>
<path d="M18,57 C12,53 10,56 13,61 C16,63 19,60 18,57 Z" fill="#33271a"/>
<path d="M30,80 C24,58 50,50 80,52 C108,54 124,64 124,76 C124,90 98,98 70,96 C48,94 36,94 30,80 Z" fill="url(#db)"/>
<path d="M58,76 C74,66 96,66 108,73 C99,82 74,86 60,82 Z" fill="#eef2f2"/>
<path d="M62,78 C76,72 94,72 104,77" stroke="#c9d2d2" stroke-width="2" fill="none"/>
<path d="M106,68 C110,50 118,40 128,38 C139,36 145,45 142,55 C139,66 128,71 118,73 C112,74 108,74 106,68 Z" fill="url(#dh)"/>
<path d="M110,68 C116,70 123,69 127,65" stroke="#fff" stroke-width="2.4" fill="none"/>
<path d="M140,51 C153,49 159,53 156,58 C153,62 143,61 138,58 Z" fill="#eab43c"/>
<circle cx="131" cy="49" r="2.6" fill="#111"/><circle cx="132" cy="48" r="0.8" fill="#fff"/>`), 160);

save('duckling', S('80 70', `<defs><radialGradient id="dk" gradientUnits="userSpaceOnUse" cx="30" cy="30" r="42"><stop offset="0" stop-color="#f6d96a"/><stop offset="1" stop-color="#d8a93e"/></radialGradient></defs>
<ellipse cx="38" cy="48" rx="24" ry="18" fill="url(#dk)"/><circle cx="58" cy="34" r="13" fill="url(#dk)"/>
<path d="M68,32 C76,31 79,35 76,38 C73,40 67,38 66,35 Z" fill="#e8a23a"/><circle cx="61" cy="32" r="2" fill="#111"/>`), 80);

// ---- bird (a = wings up; b = graceful down-stroke) ----
const bird = (wings) => S('100 80', `<g fill="#46637a">${wings}<ellipse cx="50" cy="50" rx="15" ry="8.5"/><circle cx="63" cy="47" r="6"/></g><path d="M69,47 L78,45 L69,50 Z" fill="#e8a23a"/>`);
save('bird_a', bird(`<path d="M50,46 C36,30 22,24 14,26 C24,34 34,42 48,50 Z"/><path d="M50,46 C64,30 78,24 86,26 C76,34 66,42 52,50 Z"/>`), 110);
save('bird_b', bird(`<path d="M50,52 C40,60 28,72 16,71 C25,61 37,55 48,53 Z"/><path d="M50,52 C60,60 72,72 84,71 C75,61 63,55 52,53 Z"/>`), 110);

save('butterfly_a', S('80 70', `<g fill="#ef8a3a"><ellipse cx="26" cy="26" rx="15" ry="12"/><ellipse cx="54" cy="26" rx="15" ry="12"/><ellipse cx="29" cy="47" rx="10" ry="9"/><ellipse cx="51" cy="47" rx="10" ry="9"/></g><g fill="#fff" opacity=".5"><circle cx="22" cy="24" r="3.5"/><circle cx="58" cy="24" r="3.5"/></g><ellipse cx="40" cy="36" rx="3" ry="15" fill="#3a2a1a"/>`), 80);
save('butterfly_b', S('80 70', `<g fill="#e8772c"><ellipse cx="33" cy="26" rx="8" ry="12"/><ellipse cx="47" cy="26" rx="8" ry="12"/><ellipse cx="35" cy="46" rx="6" ry="9"/><ellipse cx="45" cy="46" rx="6" ry="9"/></g><ellipse cx="40" cy="36" rx="3" ry="15" fill="#3a2a1a"/>`), 80);

save('rabbit', S('90 112', `<defs><linearGradient id="rb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8b49a"/><stop offset="1" stop-color="#94795f"/></linearGradient></defs>
<path d="M40,54 C34,28 32,12 39,9 C45,8 47,26 46,48 Z" fill="url(#rb)"/><path d="M53,52 C51,28 53,12 59,11 C65,13 61,30 57,50 Z" fill="url(#rb)"/>
<path d="M40,46 C37,30 37,20 40,16" stroke="#e7b9b0" stroke-width="3" fill="none"/>
<ellipse cx="50" cy="88" rx="26" ry="22" fill="url(#rb)"/><circle cx="50" cy="60" r="18" fill="url(#rb)"/>
<circle cx="74" cy="88" r="9" fill="#efe6d8"/><circle cx="44" cy="58" r="2.4" fill="#111"/>
<path d="M50,64 l-3,3 h6 Z" fill="#b96b78"/><ellipse cx="40" cy="106" rx="13" ry="6" fill="#b8a288"/>`), 95);

// ---- NEW: fox (trotting, faces right) ----
save('fox', S('210 150', `
<defs><linearGradient id="fx" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e07a2e"/><stop offset="1" stop-color="#bd5e1e"/></linearGradient></defs>
<path d="M44,86 C10,82 4,50 20,42 C28,60 38,72 58,82 Z" fill="url(#fx)"/>
<path d="M24,48 C10,50 6,66 16,72 C15,60 18,52 26,50 Z" fill="#f3ead8"/>
<g stroke="#2a2018" stroke-width="8" stroke-linecap="round"><line x1="72" y1="92" x2="70" y2="132"/><line x1="94" y1="94" x2="94" y2="134"/><line x1="120" y1="94" x2="122" y2="134"/><line x1="140" y1="92" x2="144" y2="130"/></g>
<path d="M50,84 C46,64 72,56 102,57 C132,58 152,64 156,78 C158,92 132,100 102,99 C74,98 56,98 50,84 Z" fill="url(#fx)"/>
<path d="M66,92 C92,99 126,97 152,85 C132,104 86,106 66,98 Z" fill="#f3ead8" opacity="0.92"/>
<path d="M140,74 C148,60 160,52 172,52 C184,52 190,62 186,72 L198,86 L174,88 C168,91 158,91 150,87 Z" fill="url(#fx)"/>
<path d="M174,80 L200,87 L177,91 Z" fill="#f3ead8"/>
<circle cx="200" cy="87" r="3.6" fill="#1d160f"/>
<path d="M150,56 L145,36 L163,49 Z" fill="url(#fx)"/><path d="M151,52 L149,41 L158,49 Z" fill="#2a2018"/>
<path d="M171,54 L173,34 L186,49 Z" fill="url(#fx)"/><path d="M173,50 L174,40 L182,49 Z" fill="#2a2018"/>
<circle cx="169" cy="65" r="2.7" fill="#140e09"/>`), 175);

// ---- NEW: dragonfly (2 wing frames) ----
const dragon = (wA, wB) => S('100 60', `
<g fill="#bfeaf2" opacity="0.55"><ellipse cx="42" cy="${wA}" rx="20" ry="6"/><ellipse cx="42" cy="${60 - wA}" rx="20" ry="6"/><ellipse cx="60" cy="${wB}" rx="15" ry="5"/><ellipse cx="60" cy="${60 - wB}" rx="15" ry="5"/></g>
<rect x="28" y="28" width="50" height="4" rx="2" fill="#2f9a8f"/><rect x="74" y="28.5" width="14" height="3" rx="1.5" fill="#1d6f66"/>
<circle cx="28" cy="30" r="6" fill="#2f9a8f"/><circle cx="24" cy="28" r="3.5" fill="#1d6f66"/>`);
save('dragonfly_a', dragon(18, 20), 90);
save('dragonfly_b', dragon(24, 26), 90);

// ---- NEW: lily pad with blossom ----
save('lily', S('90 60', `<defs><linearGradient id="lp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#54a542"/><stop offset="1" stop-color="#327028"/></linearGradient></defs>
<ellipse cx="45" cy="36" rx="40" ry="16" fill="url(#lp)"/><path d="M45,36 L72,28 L72,44 Z" fill="#27581f"/>
<ellipse cx="32" cy="32" rx="14" ry="5" fill="#6fbb50" opacity="0.55"/>
<g fill="#f6cfe0"><ellipse cx="56" cy="30" rx="6" ry="3.4"/><ellipse cx="56" cy="30" rx="3.4" ry="7"/><ellipse cx="51" cy="33" rx="4" ry="2.4" transform="rotate(-30 51 33)"/><ellipse cx="61" cy="33" rx="4" ry="2.4" transform="rotate(30 61 33)"/></g>
<circle cx="56" cy="30" r="2.6" fill="#ffd24a"/>`), 80);

// ---- NEW: falling leaf (white base, tinted per-leaf in the engine) ----
save('leaf', S('40 40', `<path d="M20,4 C31,7 35,18 31,30 C28,37 18,38 12,30 C7,23 9,11 20,4 Z" fill="#ffffff"/><path d="M20,7 L23,31 M20,15 L13,20 M21,20 L29,18" stroke="#d2d2d2" stroke-width="1.4" fill="none"/>`), 36);

// ---- NEW: blossom petal (spring) ----
save('petal', S('30 30', `<defs><linearGradient id="pt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe2ee"/><stop offset="1" stop-color="#f4a9c8"/></linearGradient></defs><path d="M15,3 C23,7 24,18 15,27 C6,18 7,7 15,3 Z" fill="url(#pt)"/>`), 26);

// ---- NEW: soft snowflake (winter) ----
save('flake', S('24 24', `<defs><radialGradient id="fl"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#f2f8ff"/><stop offset="1" stop-color="#dfeefc" stop-opacity="0"/></radialGradient></defs><circle cx="12" cy="12" r="9" fill="url(#fl)"/>`), 24);

// ---- contact sheet of new + polished ----
const review = ['lily', 'leaf', 'petal', 'flake'];
const cols = 4, cell = 230, pad = 14, rows = Math.ceil(review.length / cols);
(async () => {
  const comps = [];
  for (let i = 0; i < review.length; i++) {
    const buf = await sharp(`${OUT}/${review[i]}.png`).resize({ width: cell - pad * 2, height: cell - pad * 2, fit: 'inside' }).toBuffer();
    const m = await sharp(buf).metadata();
    comps.push({ input: buf, left: Math.round((i % cols) * cell + (cell - m.width) / 2), top: Math.round(Math.floor(i / cols) * cell + (cell - m.height) / 2) });
  }
  await sharp({ create: { width: cols * cell, height: rows * cell, channels: 3, background: '#cfd8e0' } }).composite(comps).png().toFile('/tmp/grove_new.png');
  console.log('rebuilt assets; review sheet -> /tmp/grove_new.png');
})();
