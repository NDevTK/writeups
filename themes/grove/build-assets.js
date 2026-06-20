// Grove sprite generator: authors each element as SVG and rasterises it to a PNG
// with resvg, so the art lives as editable source and can be regenerated.
//   NODE_PATH=/tmp/assets/node_modules node themes/grove/build-assets.js
// (dev deps: @resvg/resvg-js, sharp — installed outside the repo)
const {Resvg} = require('@resvg/resvg-js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'assets');
fs.mkdirSync(OUT, {recursive: true});

const S = (vb, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb}">${body}</svg>`;
const png = (svg, w) =>
  new Resvg(svg, {fitTo: {mode: 'width', value: w}}).render().asPng();
const save = (name, svg, w) =>
  fs.writeFileSync(`${OUT}/${name}.png`, png(svg, w));

// ---- deer (2 walk frames) with belly shadow + leg shading ----
const deerSvg = (lf) =>
  S(
    '260 215',
    `
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
<path d="M193,54 C198,40 202,30 200,19"/><path d="M199,38 C207,35 212,31 215,26"/><path d="M200,20 C203,14 205,11 209,8"/></g>`
  );
save('deer_a', deerSvg([0, 0, 0, 0]), 210);
save('deer_b', deerSvg([7, -6, -6, 7]), 210);

save(
  'oak',
  S(
    '180 210',
    `
<defs><radialGradient id="oak" gradientUnits="userSpaceOnUse" cx="64" cy="52" r="92"><stop offset="0" stop-color="#90ce54"/><stop offset=".55" stop-color="#5da53a"/><stop offset="1" stop-color="#377322"/></radialGradient></defs>
<path d="M84,206 C82,170 80,150 82,118 L100,118 C102,150 100,176 96,206 Z" fill="#6b4628"/>
<path d="M90,150 C80,140 70,138 62,132" stroke="#5e3c22" stroke-width="5" fill="none" stroke-linecap="round"/>
<g fill="url(#oak)"><circle cx="90" cy="78" r="44"/><circle cx="54" cy="88" r="32"/><circle cx="126" cy="88" r="32"/><circle cx="70" cy="54" r="30"/><circle cx="112" cy="56" r="30"/><circle cx="92" cy="40" r="26"/></g>
<g fill="#a2db64" opacity="0.55"><circle cx="70" cy="50" r="13"/><circle cx="90" cy="38" r="9"/></g>`
  ),
  150
);

save(
  'pine',
  S(
    '140 220',
    `
<defs><linearGradient id="pine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#46934a"/><stop offset="1" stop-color="#1f5a28"/></linearGradient></defs>
<rect x="63" y="182" width="13" height="36" rx="3" fill="#6b4628"/>
<g fill="url(#pine)"><path d="M70,18 L106,86 L34,86 Z"/><path d="M70,58 L116,136 L24,136 Z"/><path d="M70,104 L124,188 L16,188 Z"/></g>
<g fill="#5cb050" opacity="0.4"><path d="M70,18 L86,52 L70,52 Z"/><path d="M70,58 L92,100 L70,100 Z"/></g>`
  ),
  120
);

save(
  'bush',
  S(
    '178 86',
    `
<defs><radialGradient id="b" gradientUnits="userSpaceOnUse" cx="64" cy="36" r="96"><stop offset="0" stop-color="#86c64a"/><stop offset="1" stop-color="#357020"/></radialGradient></defs>
<g fill="url(#b)"><ellipse cx="40" cy="66" rx="34" ry="18"/><ellipse cx="92" cy="68" rx="42" ry="20"/><ellipse cx="142" cy="66" rx="32" ry="17"/><circle cx="56" cy="50" r="24"/><circle cx="100" cy="46" r="27"/><circle cx="136" cy="52" r="19"/></g>
<g fill="#9ad65a" opacity="0.5"><circle cx="58" cy="42" r="9"/><circle cx="102" cy="40" r="8"/></g>
<ellipse cx="92" cy="80" rx="82" ry="7" fill="#2f6a1e" opacity="0.3"/>`
  ),
  150
);

save(
  'grass',
  S(
    '80 60',
    `<g fill="none" stroke-linecap="round">
<path d="M14,58 C12,46 10,40 6,34" stroke="#458c2e" stroke-width="4"/><path d="M22,58 C20,40 16,30 12,22" stroke="#4f9c34" stroke-width="4"/>
<path d="M32,58 C32,38 32,28 34,17" stroke="#5fae3c" stroke-width="4"/><path d="M42,58 C44,40 48,30 52,22" stroke="#4f9c34" stroke-width="4"/>
<path d="M54,58 C56,42 60,34 64,28" stroke="#67b842" stroke-width="4"/></g>`
  ),
  80
);

const flower = (c) =>
  S(
    '40 60',
    `<path d="M20,58 L20,28" stroke="#4f9c34" stroke-width="3"/>
<g fill="${c}"><circle cx="20" cy="18" r="6"/><circle cx="12" cy="23" r="6"/><circle cx="28" cy="23" r="6"/><circle cx="15" cy="13" r="6"/><circle cx="25" cy="13" r="6"/></g><circle cx="20" cy="18" r="4.5" fill="#ffd24a"/>`
  );
save('flower_p', flower('#ef6a8a'), 44);
save('flower_w', flower('#f3ecf2'), 44);

save(
  'cloud',
  S(
    '210 100',
    `
<defs><linearGradient id="cl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dbe8f2"/></linearGradient></defs>
<g fill="url(#cl)"><ellipse cx="72" cy="62" rx="48" ry="28"/><ellipse cx="126" cy="56" rx="52" ry="34"/><ellipse cx="104" cy="44" rx="38" ry="27"/><ellipse cx="158" cy="66" rx="36" ry="23"/></g>`
  ),
  200
);

save(
  'sun',
  S(
    '100 100',
    `<defs><radialGradient id="s"><stop offset="0" stop-color="#fff6c8"/><stop offset=".7" stop-color="#ffd84a"/><stop offset="1" stop-color="#ffbe2e"/></radialGradient></defs><circle cx="50" cy="50" r="40" fill="url(#s)"/>`
  ),
  100
);

// ---- NEW: moon ----
save(
  'moon',
  S(
    '100 100',
    `<defs><radialGradient id="m" cx="42%" cy="38%" r="65%"><stop offset="0" stop-color="#fdfbf0"/><stop offset="1" stop-color="#d3dde9"/></radialGradient></defs>
<circle cx="50" cy="50" r="40" fill="url(#m)"/>
<g fill="#c4cedb" opacity="0.55"><circle cx="64" cy="40" r="7"/><circle cx="42" cy="62" r="9"/><circle cx="38" cy="40" r="5"/><circle cx="58" cy="60" r="4"/></g>`
  ),
  100
);

// ---- NEW: soft glow (sun/moon halo, fireflies) ----
save(
  'glow',
  S(
    '128 128',
    `<defs><radialGradient id="g"><stop offset="0" stop-color="#ffffff" stop-opacity="1"/><stop offset=".3" stop-color="#fff0b8" stop-opacity=".85"/><stop offset="1" stop-color="#ffcf4a" stop-opacity="0"/></radialGradient></defs><circle cx="64" cy="64" r="64" fill="url(#g)"/>`
  ),
  128
);

// ---- duck (improved upswept tail) ----
save(
  'duck',
  S(
    '170 116',
    `
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
<circle cx="131" cy="49" r="2.6" fill="#111"/><circle cx="132" cy="48" r="0.8" fill="#fff"/>`
  ),
  160
);

save(
  'duckling',
  S(
    '80 70',
    `<defs><radialGradient id="dk" gradientUnits="userSpaceOnUse" cx="30" cy="30" r="42"><stop offset="0" stop-color="#f6d96a"/><stop offset="1" stop-color="#d8a93e"/></radialGradient></defs>
<ellipse cx="38" cy="48" rx="24" ry="18" fill="url(#dk)"/><circle cx="58" cy="34" r="13" fill="url(#dk)"/>
<path d="M68,32 C76,31 79,35 76,38 C73,40 67,38 66,35 Z" fill="#e8a23a"/><circle cx="61" cy="32" r="2" fill="#111"/>`
  ),
  80
);

// ---- bird (a = wings up; b = graceful down-stroke) ----
const bird = (wings) =>
  S(
    '100 80',
    `<g fill="#46637a">${wings}<ellipse cx="50" cy="50" rx="15" ry="8.5"/><circle cx="63" cy="47" r="6"/></g><path d="M69,47 L78,45 L69,50 Z" fill="#e8a23a"/><circle cx="65" cy="46" r="1.5" fill="#10181f"/><circle cx="65.5" cy="45.5" r="0.5" fill="#fff"/>`
  );
save(
  'bird_a',
  bird(
    `<path d="M50,46 C36,30 22,24 14,26 C24,34 34,42 48,50 Z"/><path d="M50,46 C64,30 78,24 86,26 C76,34 66,42 52,50 Z"/>`
  ),
  110
);
save(
  'bird_b',
  bird(
    `<path d="M50,52 C40,60 28,72 16,71 C25,61 37,55 48,53 Z"/><path d="M50,52 C60,60 72,72 84,71 C75,61 63,55 52,53 Z"/>`
  ),
  110
);

save(
  'butterfly_a',
  S(
    '80 70',
    `<g fill="#ef8a3a"><ellipse cx="26" cy="26" rx="15" ry="12"/><ellipse cx="54" cy="26" rx="15" ry="12"/><ellipse cx="29" cy="47" rx="10" ry="9"/><ellipse cx="51" cy="47" rx="10" ry="9"/></g><g fill="#fff" opacity=".5"><circle cx="22" cy="24" r="3.5"/><circle cx="58" cy="24" r="3.5"/></g><ellipse cx="40" cy="36" rx="3" ry="15" fill="#3a2a1a"/>`
  ),
  80
);
save(
  'butterfly_b',
  S(
    '80 70',
    `<g fill="#e8772c"><ellipse cx="33" cy="26" rx="8" ry="12"/><ellipse cx="47" cy="26" rx="8" ry="12"/><ellipse cx="35" cy="46" rx="6" ry="9"/><ellipse cx="45" cy="46" rx="6" ry="9"/></g><ellipse cx="40" cy="36" rx="3" ry="15" fill="#3a2a1a"/>`
  ),
  80
);

save(
  'rabbit',
  S(
    '104 116',
    `<defs><linearGradient id="rb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8b49a"/><stop offset="1" stop-color="#94795f"/></linearGradient></defs>
<path d="M49,58 C43,28 41,8 48,5 C55,4 57,26 56,54 Z" fill="url(#rb)"/><path d="M62,56 C59,28 62,8 70,8 C78,11 72,32 69,54 Z" fill="url(#rb)"/>
<path d="M48,50 C46,30 46,18 49,12" stroke="#e7b9b0" stroke-width="3.4" fill="none"/><path d="M65,50 C64,32 66,20 70,14" stroke="#e7b9b0" stroke-width="3" fill="none"/>
<ellipse cx="36" cy="94" rx="21" ry="18" fill="url(#rb)"/><ellipse cx="53" cy="84" rx="23" ry="21" fill="url(#rb)"/>
<circle cx="21" cy="99" r="10" fill="#f2ebe0"/><ellipse cx="60" cy="107" rx="16" ry="5.5" fill="#bda78c"/>
<circle cx="64" cy="56" r="16" fill="url(#rb)"/><path d="M75,55 C81,56 83,62 78,66 C74,67 71,63 72,58 Z" fill="url(#rb)"/>
<path d="M80,59 l4.5,2.3 l-4.5,2.3 Z" fill="#c97f8a"/><path d="M80,63.4 q-2.6,3.4 -6,2.4" stroke="#7a5648" stroke-width="1.2" fill="none"/>
<circle cx="65" cy="52" r="2.6" fill="#1a1208"/><circle cx="66" cy="51" r="0.8" fill="#fff"/>`
  ),
  104
);

// ---- NEW: fox (trotting, faces right) ----
save(
  'fox',
  S(
    '210 150',
    `
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
<circle cx="169" cy="65" r="2.7" fill="#140e09"/>`
  ),
  175
);

// ---- NEW: dragonfly (2 wing frames) ----
const dragon = (wA, wB) =>
  S(
    '100 60',
    `
<g fill="#bfeaf2" opacity="0.55"><ellipse cx="42" cy="${wA}" rx="20" ry="6"/><ellipse cx="42" cy="${60 - wA}" rx="20" ry="6"/><ellipse cx="60" cy="${wB}" rx="15" ry="5"/><ellipse cx="60" cy="${60 - wB}" rx="15" ry="5"/></g>
<rect x="28" y="28" width="50" height="4" rx="2" fill="#2f9a8f"/><rect x="74" y="28.5" width="14" height="3" rx="1.5" fill="#1d6f66"/>
<circle cx="28" cy="30" r="6" fill="#2f9a8f"/><circle cx="24" cy="28" r="3.5" fill="#1d6f66"/>`
  );
save('dragonfly_a', dragon(18, 20), 90);
save('dragonfly_b', dragon(24, 26), 90);

// ---- NEW: lily pad with blossom ----
save(
  'lily',
  S(
    '90 60',
    `<defs><linearGradient id="lp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#54a542"/><stop offset="1" stop-color="#327028"/></linearGradient></defs>
<ellipse cx="45" cy="36" rx="40" ry="16" fill="url(#lp)"/><path d="M45,36 L72,28 L72,44 Z" fill="#27581f"/>
<ellipse cx="32" cy="32" rx="14" ry="5" fill="#6fbb50" opacity="0.55"/>
<g fill="#f6cfe0"><ellipse cx="56" cy="30" rx="6" ry="3.4"/><ellipse cx="56" cy="30" rx="3.4" ry="7"/><ellipse cx="51" cy="33" rx="4" ry="2.4" transform="rotate(-30 51 33)"/><ellipse cx="61" cy="33" rx="4" ry="2.4" transform="rotate(30 61 33)"/></g>
<circle cx="56" cy="30" r="2.6" fill="#ffd24a"/>`
  ),
  80
);

// ---- NEW: falling leaf (white base, tinted per-leaf in the engine) ----
save(
  'leaf',
  S(
    '40 40',
    `<path d="M20,4 C31,7 35,18 31,30 C28,37 18,38 12,30 C7,23 9,11 20,4 Z" fill="#ffffff"/><path d="M20,7 L23,31 M20,15 L13,20 M21,20 L29,18" stroke="#d2d2d2" stroke-width="1.4" fill="none"/>`
  ),
  36
);

// ---- NEW: blossom petal (spring) ----
save(
  'petal',
  S(
    '30 30',
    `<defs><linearGradient id="pt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe2ee"/><stop offset="1" stop-color="#f4a9c8"/></linearGradient></defs><path d="M15,3 C23,7 24,18 15,27 C6,18 7,7 15,3 Z" fill="url(#pt)"/>`
  ),
  26
);

// ---- NEW: soft snowflake (winter) ----
save(
  'flake',
  S(
    '24 24',
    `<defs><radialGradient id="fl"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#f2f8ff"/><stop offset="1" stop-color="#dfeefc" stop-opacity="0"/></radialGradient></defs><circle cx="12" cy="12" r="9" fill="url(#fl)"/>`
  ),
  24
);

// ---- DESERT biome ----
save(
  'cactus',
  S(
    '100 180',
    `<defs><linearGradient id="ca" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5fa451"/><stop offset=".5" stop-color="#3f7d38"/><stop offset="1" stop-color="#2c5e28"/></linearGradient></defs>
<rect x="41" y="36" width="18" height="142" rx="9" fill="url(#ca)"/>
<rect x="16" y="72" width="16" height="44" rx="8" fill="url(#ca)"/><rect x="24" y="100" width="22" height="14" rx="7" fill="url(#ca)"/>
<rect x="68" y="56" width="16" height="48" rx="8" fill="url(#ca)"/><rect x="54" y="88" width="22" height="14" rx="7" fill="url(#ca)"/>
<g stroke="#2c5e28" stroke-width="1.6" opacity="0.5"><line x1="50" y1="46" x2="50" y2="172"/><line x1="24" y1="80" x2="24" y2="110"/><line x1="76" y1="64" x2="76" y2="98"/></g>
<g fill="#f4b6c8"><circle cx="50" cy="36" r="4"/><circle cx="24" cy="72" r="3.5"/><circle cx="76" cy="56" r="3.5"/></g>`
  ),
  90
);
save(
  'cactus2',
  S(
    '80 86',
    `<defs><linearGradient id="cb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fa451"/><stop offset="1" stop-color="#2c5e28"/></linearGradient></defs>
<ellipse cx="40" cy="52" rx="26" ry="30" fill="url(#cb)"/>
<g stroke="#2c5e28" stroke-width="2" opacity="0.5"><path d="M40,24 V80"/><path d="M22,28 V78"/><path d="M58,28 V78"/></g>
<g fill="#f4c84a"><circle cx="40" cy="22" r="5"/><circle cx="32" cy="25" r="4"/><circle cx="48" cy="25" r="4"/></g><circle cx="40" cy="23" r="2.5" fill="#e0892e"/>`
  ),
  72
);
save(
  'rock',
  S(
    '100 56',
    `<defs><linearGradient id="rk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cdaa78"/><stop offset="1" stop-color="#9c8058"/></linearGradient></defs>
<path d="M8,54 C3,38 18,30 34,33 C40,22 60,22 68,34 C86,31 97,42 92,54 Z" fill="url(#rk)"/>
<path d="M28,40 C36,34 50,34 58,40" stroke="#b2966a" stroke-width="2" fill="none"/>
<path d="M16,52 C20,46 28,46 32,50" stroke="#8a7048" stroke-width="2" fill="none" opacity="0.6"/>`
  ),
  100
);
save(
  'lizard',
  S(
    '120 52',
    `<defs><linearGradient id="lz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cf9a52"/><stop offset="1" stop-color="#a8763a"/></linearGradient></defs>
<path d="M14,30 C2,29 1,33 11,34 C22,35 32,33 42,31 Z" fill="url(#lz)"/>
<g stroke="#8a6230" stroke-width="4" stroke-linecap="round"><line x1="46" y1="37" x2="40" y2="46"/><line x1="52" y1="37" x2="58" y2="46"/><line x1="74" y1="37" x2="68" y2="46"/><line x1="80" y1="37" x2="86" y2="46"/></g>
<ellipse cx="62" cy="30" rx="28" ry="10" fill="url(#lz)"/>
<path d="M88,27 C100,25 108,29 104,34 C100,38 90,36 86,32 Z" fill="url(#lz)"/>
<circle cx="96" cy="29" r="2" fill="#1a120a"/>
<g fill="#8a6230" opacity="0.5"><circle cx="54" cy="26" r="2"/><circle cx="66" cy="27" r="2"/><circle cx="78" cy="27" r="1.8"/></g>`
  ),
  110
);
// camel with 2 walk frames (legs stride between frames)
const camelSvg = (lf) =>
  S(
    '200 160',
    `<defs><linearGradient id="cm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6ac6a"/><stop offset="1" stop-color="#a87e44"/></linearGradient></defs>
<g stroke="#9a7038" stroke-width="9" stroke-linecap="round"><line x1="72" y1="96" x2="${68 + lf[0]}" y2="150"/><line x1="92" y1="98" x2="${92 + lf[1]}" y2="152"/><line x1="124" y1="98" x2="${128 + lf[2]}" y2="150"/><line x1="142" y1="96" x2="${148 + lf[3]}" y2="148"/></g>
<path d="M58,98 C50,86 60,78 78,76 C86,54 118,54 126,76 C144,78 156,84 156,98 C148,106 80,108 58,98 Z" fill="url(#cm)"/>
<path d="M150,90 C160,74 164,56 168,44 C170,37 180,37 180,46 C180,60 176,76 166,90 Z" fill="url(#cm)"/>
<path d="M176,42 C187,40 193,45 190,51 C187,56 179,54 175,49 Z" fill="url(#cm)"/>
<path d="M174,40 L172,33 L179,38 Z" fill="#a87e44"/><circle cx="182" cy="44" r="2" fill="#1a120a"/>
<path d="M58,92 C50,93 48,101 54,105 C59,101 60,95 60,91 Z" fill="#a87e44"/>`
  );
save('camel', camelSvg([0, 0, 0, 0]), 175);
save('camel_b', camelSvg([9, -7, -8, 8]), 175);
save(
  'tumbleweed',
  S(
    '80 80',
    `<g stroke="#b89860" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.92">
<circle cx="40" cy="40" r="30"/><circle cx="40" cy="40" r="19"/>
<path d="M10,40 H70 M40,10 V70 M19,19 L61,61 M61,19 L19,61 M12,32 Q40,46 68,32 M12,48 Q40,34 68,48"/></g>`
  ),
  72
);

// ---- COAST biome ----
save(
  'palm',
  S(
    '150 200',
    `<defs><linearGradient id="pt" x1="0" y1="1" x2="0.3" y2="0"><stop offset="0" stop-color="#9c7a48"/><stop offset="1" stop-color="#c2a06a"/></linearGradient>
<linearGradient id="pf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#62b34c"/><stop offset="1" stop-color="#2f7e30"/></linearGradient></defs>
<path d="M62,198 C56,150 56,108 72,68 L86,72 C72,110 76,152 80,198 Z" fill="url(#pt)"/>
<g stroke="#8a6a40" stroke-width="1.4" opacity="0.5" fill="none"><path d="M60,176 q10,4 20,1"/><path d="M59,148 q11,4 22,1"/><path d="M61,118 q11,4 22,1"/><path d="M65,90 q9,4 18,1"/></g>
<g fill="url(#pf)">
<path d="M77,66 C50,46 22,46 6,58 C28,56 54,60 78,72 Z"/><path d="M77,66 C104,46 132,46 148,58 C126,56 100,60 76,72 Z"/>
<path d="M77,64 C56,38 36,24 22,18 C42,30 62,48 78,70 Z"/><path d="M77,64 C98,38 118,24 132,18 C112,30 92,48 76,70 Z"/>
<path d="M77,62 C72,36 72,18 77,6 C82,18 82,40 79,66 Z"/></g>
<g fill="#6b4a28"><circle cx="71" cy="74" r="5"/><circle cx="82" cy="76" r="5"/><circle cx="77" cy="80" r="5"/></g>`
  ),
  130
);
save(
  'crab',
  S(
    '100 56',
    `<defs><linearGradient id="cr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8693f"/><stop offset="1" stop-color="#b8401e"/></linearGradient></defs>
<g stroke="#a83c1c" stroke-width="3.5" stroke-linecap="round" fill="none"><path d="M32,40 L18,52"/><path d="M38,43 L30,54"/><path d="M62,43 L70,54"/><path d="M68,40 L82,52"/></g>
<g stroke="#c4502a" stroke-width="3.5" stroke-linecap="round" fill="none"><path d="M30,34 L14,30"/><path d="M70,34 L86,30"/></g>
<ellipse cx="12" cy="30" rx="7" ry="5" fill="url(#cr)"/><path d="M6,28 L13,30 L6,32" stroke="#8f3016" stroke-width="2" fill="none"/>
<ellipse cx="88" cy="30" rx="7" ry="5" fill="url(#cr)"/><path d="M94,28 L87,30 L94,32" stroke="#8f3016" stroke-width="2" fill="none"/>
<ellipse cx="50" cy="36" rx="24" ry="14" fill="url(#cr)"/>
<g stroke="#b8401e" stroke-width="2.5"><line x1="44" y1="25" x2="42" y2="16"/><line x1="56" y1="25" x2="58" y2="16"/></g>
<circle cx="42" cy="14" r="3" fill="#2a1810"/><circle cx="58" cy="14" r="3" fill="#2a1810"/>
<g fill="#f0a080" opacity="0.5"><circle cx="44" cy="33" r="2.5"/><circle cx="56" cy="33" r="2.5"/></g>`
  ),
  90
);
save(
  'sailboat',
  S(
    '140 116',
    `<rect x="67" y="22" width="4" height="72" fill="#8a6a40"/>
<path d="M73,26 L73,88 L112,88 Z" fill="#f6f2e8"/><path d="M73,26 L73,88 L112,88 Z" fill="none" stroke="#d8d0bc" stroke-width="1.5"/>
<path d="M65,32 L65,86 L34,86 Z" fill="#eae3d2"/>
<path d="M71,20 L86,25 L71,30 Z" fill="#d84a3a"/>
<path d="M20,92 C34,110 106,110 120,92 Z" fill="#c2502e"/>
<path d="M20,92 L120,92 L114,86 L26,86 Z" fill="#eceae4"/>`
  ),
  120
);
save(
  'starfish',
  S(
    '60 60',
    `<defs><radialGradient id="sf" cx="50%" cy="42%"><stop offset="0" stop-color="#f0a850"/><stop offset="1" stop-color="#cf7c2c"/></radialGradient></defs>
<path d="M30,5 L37.6,22 L56,23 L41,35 L46.6,53 L30,42.5 L13.4,53 L19,35 L4,23 L22.4,22 Z" fill="url(#sf)"/>
<g fill="#b86a22"><circle cx="30" cy="26" r="2.4"/><circle cx="24" cy="30" r="1.8"/><circle cx="36" cy="30" r="1.8"/><circle cx="30" cy="34" r="1.8"/></g>`
  ),
  56
);

save(
  'gull',
  S(
    '110 60',
    `<g fill="#f2f5f8">
<path d="M55,38 C40,20 24,16 10,22 C26,24 40,30 52,40 Z"/><path d="M55,38 C70,20 86,16 100,22 C84,24 70,30 58,40 Z"/>
<ellipse cx="55" cy="40" rx="8" ry="5"/><circle cx="62" cy="37" r="5"/></g>
<g fill="#b8c2ca"><path d="M10,22 L19,20 L16,26 Z"/><path d="M100,22 L91,20 L94,26 Z"/></g>
<path d="M67,37 L75,36 L67,41 Z" fill="#f0b43a"/><circle cx="61" cy="36" r="1.5" fill="#222"/>`
  ),
  100
);

// ---- WETLAND biome ----
save(
  'reed',
  S(
    '120 230',
    `<defs><linearGradient id="rd" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#4a7a2c"/><stop offset="1" stop-color="#84bd50"/></linearGradient></defs>
<g fill="url(#rd)">
<path d="M60,226 C54,150 44,92 28,44 C44,90 60,148 64,226 Z"/>
<path d="M60,226 C66,150 78,98 96,56 C80,100 66,150 66,226 Z"/>
<path d="M60,226 C57,140 55,78 53,28 C61,80 63,148 64,226 Z"/>
<path d="M60,226 C53,170 46,128 34,96 C48,130 58,172 62,226 Z"/>
<path d="M60,226 C64,170 72,130 86,100 C72,132 62,174 62,226 Z"/></g>
<g stroke="#7a5028" stroke-width="4.5" stroke-linecap="round"><line x1="50" y1="224" x2="44" y2="150"/><line x1="70" y1="224" x2="76" y2="138"/></g>
<rect x="39.5" y="118" width="9" height="36" rx="4.5" fill="#7c4f28"/><rect x="71.5" y="106" width="9" height="36" rx="4.5" fill="#89592c"/>
<line x1="44" y1="118" x2="44" y2="106" stroke="#9a6a36" stroke-width="2.4" stroke-linecap="round"/><line x1="76" y1="106" x2="76" y2="94" stroke="#9a6a36" stroke-width="2.4" stroke-linecap="round"/>`
  ),
  112
);
save(
  'heron',
  S(
    '190 232',
    `<defs><linearGradient id="hr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b3c0cf"/><stop offset="1" stop-color="#6f8398"/></linearGradient></defs>
<g stroke="#caa24a" stroke-width="4" stroke-linecap="round" fill="none"><path d="M82,148 L74,226"/><path d="M98,148 L108,226"/><path d="M74,226 l14,3"/><path d="M108,226 l14,3"/></g>
<ellipse cx="92" cy="128" rx="40" ry="25" fill="url(#hr)"/>
<path d="M106,118 C134,122 156,132 172,146 C152,152 122,150 100,138 Z" fill="#5f7488"/>
<path d="M88,112 C68,96 76,68 98,56 C108,50 112,46 118,40" stroke="url(#hr)" stroke-width="13" fill="none" stroke-linecap="round"/>
<ellipse cx="122" cy="40" rx="12" ry="9" fill="#b3c0cf"/>
<path d="M128,34 C144,28 156,28 164,32 C150,33 138,36 130,41 Z" fill="#8b99a8"/>
<path d="M132,40 L176,36 L132,46 Z" fill="#e3b653"/>
<circle cx="124" cy="38" r="2.4" fill="#16181c"/>`
  ),
  158
);
save(
  'frog',
  S(
    '70 56',
    `<defs><radialGradient id="fg" cx="50%" cy="34%"><stop offset="0" stop-color="#7cc24a"/><stop offset="1" stop-color="#3f8a2e"/></radialGradient></defs>
<ellipse cx="35" cy="45" rx="29" ry="10" fill="#327a26"/>
<path d="M12,46 C8,32 19,38 22,47 Z" fill="#3f8a2e"/><path d="M58,46 C62,32 51,38 48,47 Z" fill="#3f8a2e"/>
<ellipse cx="35" cy="38" rx="21" ry="15" fill="url(#fg)"/>
<circle cx="24" cy="24" r="8" fill="url(#fg)"/><circle cx="46" cy="24" r="8" fill="url(#fg)"/>
<circle cx="24" cy="22" r="4.6" fill="#f4e04a"/><circle cx="46" cy="22" r="4.6" fill="#f4e04a"/>
<circle cx="24" cy="22" r="2.2" fill="#16240c"/><circle cx="46" cy="22" r="2.2" fill="#16240c"/>
<path d="M26,42 Q35,49 44,42" stroke="#235a1a" stroke-width="2" fill="none" stroke-linecap="round"/>
<g fill="#2d6b22" opacity="0.55"><circle cx="30" cy="36" r="2"/><circle cx="41" cy="38" r="2"/><circle cx="35" cy="32" r="1.8"/></g>`
  ),
  66
);

// ---- fish (2 frames, tail sweeps; side-on facing right) ----
// Kept light + silvery so it tints to each pond's deep colour while submerged
// and reads as a bright fish when it leaps clear of the surface.
const fishSvg = (tf) =>
  S(
    '120 60',
    `<defs><linearGradient id="fsb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ea6b9"/><stop offset="0.5" stop-color="#c2d3de"/><stop offset="1" stop-color="#eef5f9"/></linearGradient></defs>
<path d="M34,30 L9,${17 + tf} C17,25 17,35 9,${43 + tf} Z" fill="#9fb4c4" opacity="0.92"/>
<path d="M58,15 Q70,2 84,17 Z" fill="#8fa6b8" opacity="0.85"/>
<path d="M64,44 Q74,55 84,43 Z" fill="#8fa6b8" opacity="0.8"/>
<path d="M30,30 C42,13 70,9 96,16 C107,19 113,24 113,30 C113,36 107,41 96,44 C70,51 42,47 30,30 Z" fill="url(#fsb)"/>
<path d="M86,35 Q93,45 99,36 Z" fill="#86a0b3" opacity="0.75"/>
<path d="M40,30 C60,22 86,22 104,28 C86,32 60,34 40,30 Z" fill="#7f97a8" opacity="0.5"/>
<path d="M92,18 C96,24 96,36 92,42" stroke="#7f97a8" stroke-width="1.4" fill="none" opacity="0.6"/>
<circle cx="100" cy="26" r="3" fill="#16242e"/><circle cx="101" cy="25" r="1" fill="#eaf3f7"/>`
  );
save('fish_a', fishSvg(0), 120);
save('fish_b', fishSvg(7), 120);

// ---- ALPINE biome ----
const goatSvg = (lf) =>
  S(
    '180 152',
    `<defs><linearGradient id="gt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5f2ea"/><stop offset="1" stop-color="#ccc4b1"/></linearGradient></defs>
<g stroke="#bbb39e" stroke-width="9" stroke-linecap="round"><line x1="46" y1="92" x2="${42 + lf[0]}" y2="140"/><line x1="66" y1="94" x2="${66 + lf[1]}" y2="142"/><line x1="98" y1="94" x2="${102 + lf[2]}" y2="142"/><line x1="116" y1="92" x2="${122 + lf[3]}" y2="140"/></g>
<g stroke="#3a3026" stroke-width="9" stroke-linecap="round"><line x1="${42 + lf[0]}" y1="137" x2="${42 + lf[0]}" y2="144"/><line x1="${66 + lf[1]}" y1="139" x2="${66 + lf[1]}" y2="146"/><line x1="${102 + lf[2]}" y1="139" x2="${102 + lf[2]}" y2="146"/><line x1="${122 + lf[3]}" y1="137" x2="${122 + lf[3]}" y2="144"/></g>
<path d="M40,96 C32,70 50,54 90,54 C126,54 140,68 140,90 C140,102 118,106 88,106 C58,106 48,106 40,96 Z" fill="url(#gt)"/>
<path d="M40,92 C36,84 38,74 44,70 C46,80 46,88 50,96 Z" fill="#e3ddcd" opacity="0.7"/>
<path d="M132,90 C142,82 148,72 152,62 C154,72 152,84 146,94 Z" fill="url(#gt)"/>
<ellipse cx="151" cy="58" rx="13" ry="15" fill="url(#gt)"/>
<path d="M159,64 C169,66 173,74 167,80 C161,80 157,74 155,68 Z" fill="#e8e2d2"/>
<path d="M147,44 C145,30 147,20 153,16" stroke="#2c241a" stroke-width="4.2" fill="none" stroke-linecap="round"/>
<path d="M155,44 C155,30 159,20 165,16" stroke="#2c241a" stroke-width="4.2" fill="none" stroke-linecap="round"/>
<path d="M155,72 C153,84 151,92 149,97 C147,89 147,79 149,70 Z" fill="#e2dccb"/>
<circle cx="153" cy="56" r="2.4" fill="#1c160e"/><circle cx="163" cy="72" r="1.7" fill="#3a3026"/>`
  );
save('goat', goatSvg([0, 0, 0, 0]), 168);
save('goat_b', goatSvg([7, -6, -6, 7]), 168);
// eagle redrawn as a side-on glide facing right (head + beak forward, not the old top-down view)
save(
  'eagle',
  S(
    '160 96',
    `<defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a5236"/><stop offset="1" stop-color="#3a2c1c"/></linearGradient>
<linearGradient id="egw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#574330"/><stop offset="1" stop-color="#2f2418"/></linearGradient></defs>
<path d="M42,56 L10,49 L8,61 L42,62 Z" fill="#ece6da"/>
<path d="M40,55 C54,47 92,46 120,53 C112,62 66,64 38,60 Z" fill="url(#eg)"/>
<path d="M88,52 C72,28 50,10 20,3 C40,9 54,20 64,34 C54,28 44,28 36,30 C54,38 70,46 86,52 Z" fill="url(#egw)"/>
<path d="M78,54 C66,70 50,80 28,84 C46,78 56,68 66,56 Z" fill="#3c2d1d"/>
<path d="M112,53 C112,45 120,41 129,43 C124,47 124,53 127,57 C120,59 114,58 112,53 Z" fill="#ece6da"/>
<circle cx="128" cy="48" r="8.5" fill="#ece6da"/>
<path d="M135,45 L152,48 L136,53 Z" fill="#e8b53f"/>
<path d="M152,48 C154,49.5 152,51.5 148,51 Z" fill="#c9952a"/>
<circle cx="131" cy="46" r="1.7" fill="#16120c"/>`
  ),
  140
);

// ---- SAVANNA biome ----
save(
  'acacia',
  S(
    '236 190',
    `<defs><linearGradient id="ac" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a6a3e"/><stop offset="1" stop-color="#674c2a"/></linearGradient>
<linearGradient id="acf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#86a55f"/><stop offset="1" stop-color="#5c7d3c"/></linearGradient></defs>
<path d="M106,188 C110,136 106,98 103,72 L119,72 C117,100 124,140 128,188 Z" fill="url(#ac)"/>
<g stroke="#674c2a" stroke-width="8" stroke-linecap="round" fill="none"><path d="M109,82 C84,70 56,58 32,54"/><path d="M113,78 C144,66 176,56 204,54"/><path d="M110,90 C90,76 70,62 54,57"/><path d="M112,86 C136,72 164,60 186,56"/></g>
<path d="M14,60 C44,32 96,24 118,24 C152,24 204,34 222,60 C200,52 152,50 118,50 C82,50 38,52 14,60 Z" fill="url(#acf)"/>
<ellipse cx="118" cy="44" rx="104" ry="17" fill="url(#acf)"/>
<ellipse cx="118" cy="37" rx="78" ry="12" fill="#90af68"/>
<g fill="#6f9450" opacity="0.5"><ellipse cx="56" cy="50" rx="24" ry="8"/><ellipse cx="118" cy="46" rx="30" ry="9"/><ellipse cx="182" cy="50" rx="24" ry="8"/></g>`
  ),
  210
);
const giraffeSvg = (lf) =>
  S(
    '214 322',
    `<defs><linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eec670"/><stop offset="1" stop-color="#cf9e44"/></linearGradient></defs>
<g stroke="#d4a44a" stroke-width="15" stroke-linecap="round"><line x1="70" y1="170" x2="${64 + lf[0]}" y2="304"/><line x1="98" y1="172" x2="${98 + lf[1]}" y2="306"/><line x1="126" y1="172" x2="${130 + lf[2]}" y2="306"/><line x1="150" y1="170" x2="${158 + lf[3]}" y2="302"/></g>
<g stroke="#4a3520" stroke-width="15" stroke-linecap="round"><line x1="${64 + lf[0]}" y1="296" x2="${64 + lf[0]}" y2="305"/><line x1="${98 + lf[1]}" y1="298" x2="${98 + lf[1]}" y2="307"/><line x1="${130 + lf[2]}" y1="298" x2="${130 + lf[2]}" y2="307"/><line x1="${158 + lf[3]}" y1="294" x2="${158 + lf[3]}" y2="303"/></g>
<path d="M52,150 C42,162 40,182 46,194" stroke="#cf9e44" stroke-width="6" fill="none" stroke-linecap="round"/><line x1="46" y1="190" x2="43" y2="202" stroke="#4a3520" stroke-width="6" stroke-linecap="round"/>
<path d="M46,166 C40,128 70,106 112,104 C154,102 178,118 178,150 C178,174 136,184 98,184 C72,184 54,178 46,166 Z" fill="url(#gf)"/>
<path d="M146,126 C158,90 166,54 174,30" stroke="url(#gf)" stroke-width="31" fill="none" stroke-linecap="round"/>
<path d="M158,114 C167,80 175,46 182,24" stroke="#9c6f34" stroke-width="7" fill="none" stroke-linecap="round"/>
<path d="M164,32 C158,18 168,8 182,9 C194,10 200,18 197,28 C204,30 207,37 202,43 C195,49 178,48 171,42 C165,38 164,35 164,32 Z" fill="url(#gf)"/>
<g stroke="#7a5a30" stroke-width="4.5" stroke-linecap="round"><line x1="175" y1="11" x2="173" y2="1"/><line x1="189" y1="11" x2="191" y2="1"/></g>
<circle cx="173" cy="1" r="4" fill="#5a4326"/><circle cx="191" cy="1" r="4" fill="#5a4326"/>
<circle cx="180" cy="28" r="2.6" fill="#3a2a16"/>
<g fill="#a9742f" opacity="0.85"><path d="M60,138 l18,-4 l7,17 l-17,5 Z"/><path d="M94,150 l19,-2 l5,17 l-19,4 Z"/><path d="M126,138 l18,-2 l6,17 l-18,5 Z"/><path d="M150,158 l17,0 l2,15 l-17,2 Z"/><path d="M154,90 l14,-2 l3,15 l-14,3 Z"/><path d="M161,56 l12,-2 l3,13 l-12,3 Z"/><path d="M167,30 l10,-2 l2,10 l-10,2 Z"/></g>`
  );
save('giraffe', giraffeSvg([0, 0, 0, 0]), 202);
save('giraffe_b', giraffeSvg([9, -8, -8, 9]), 202);
save(
  'zebra',
  S(
    '204 152',
    `
<g stroke="#3a3a3a" stroke-width="9" stroke-linecap="round"><line x1="62" y1="92" x2="58" y2="138"/><line x1="86" y1="94" x2="86" y2="140"/><line x1="118" y1="94" x2="122" y2="140"/><line x1="142" y1="92" x2="148" y2="138"/></g>
<path d="M46,94 C38,68 60,54 102,54 C142,54 160,64 160,86 C160,100 132,104 98,104 C68,104 54,104 46,94 Z" fill="#f2efe8"/>
<path d="M152,84 C164,70 172,54 178,40 C184,46 186,58 182,72 C178,86 166,94 156,96 Z" fill="#f2efe8"/>
<path d="M178,40 C188,34 198,37 197,47 C196,55 188,58 180,56 Z" fill="#f2efe8"/>
<path d="M170,40 L166,26 L178,34 Z" fill="#f2efe8"/>
<path d="M152,48 C160,38 170,32 178,30 C172,40 164,50 158,60 Z" fill="#3a3a3a"/>
<g stroke="#2c2c2c" stroke-width="5" stroke-linecap="round" fill="none"><path d="M72,58 C68,74 68,90 70,100"/><path d="M88,56 C84,74 84,92 86,102"/><path d="M106,55 C102,74 102,92 104,103"/><path d="M124,57 C122,74 122,90 124,101"/><path d="M140,62 C140,76 140,88 142,98"/></g>
<g stroke="#2c2c2c" stroke-width="4" stroke-linecap="round" fill="none"><path d="M158,58 l10,-8"/><path d="M162,70 l12,-8"/><path d="M164,82 l12,-7"/></g>
<path d="M46,84 C36,88 32,100 36,108 C40,100 44,92 50,90 Z" fill="#f2efe8"/><line x1="35" y1="106" x2="32" y2="117" stroke="#2c2c2c" stroke-width="4" stroke-linecap="round"/>
<path d="M190,48 C196,50 198,56 194,60 L186,58 Z" fill="#3a3a3a"/><circle cx="180" cy="48" r="2.2" fill="#1a1a1a"/>`
  ),
  188
);
// vulture redrawn side-on facing right (bald head + hooked beak), not the old top-down soaring view
save(
  'vulture',
  S(
    '162 96',
    `<defs><linearGradient id="vu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b4d40"/><stop offset="1" stop-color="#312820"/></linearGradient>
<linearGradient id="vuw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#493d31"/><stop offset="1" stop-color="#241c14"/></linearGradient></defs>
<path d="M44,58 L8,51 L6,64 L44,65 Z" fill="url(#vuw)"/>
<path d="M42,58 C58,49 98,48 124,55 C116,65 68,67 40,63 Z" fill="url(#vu)"/>
<path d="M92,54 C76,28 52,9 22,2 C42,8 58,20 68,35 C56,28 46,28 38,31 C56,40 74,48 90,54 Z" fill="url(#vuw)"/>
<path d="M80,57 C68,74 50,84 28,88 C48,81 60,70 70,58 Z" fill="#2b2117"/>
<path d="M112,56 C113,49 119,45 124,47 C120,51 121,57 124,60 C118,61 113,60 112,56 Z" fill="#6c5e50"/>
<circle cx="131" cy="50" r="7" fill="#bd9186"/>
<path d="M126,45 C129,42 135,42 137,46 C133,47 130,48 127,49 Z" fill="#a87c72"/>
<path d="M137,47 L155,50 L138,56 Z" fill="#2c2118"/>
<path d="M155,50 C157,51.5 155,53.5 151,53 Z" fill="#191009"/>
<circle cx="134" cy="48" r="1.7" fill="#0f0a05"/><circle cx="134.6" cy="47.4" r="0.5" fill="#e8d8c0"/>`
  ),
  140
);

// ---- BAMBOO biome ----
save(
  'bamboo',
  S(
    '132 268',
    `<defs><linearGradient id="bm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6fa83e"/><stop offset=".5" stop-color="#9ccf63"/><stop offset="1" stop-color="#5e9636"/></linearGradient></defs>
<g><rect x="40" y="40" width="14" height="222" rx="6" fill="url(#bm)"/><rect x="64" y="26" width="15" height="236" rx="6" fill="url(#bm)"/><rect x="88" y="58" width="12" height="204" rx="6" fill="url(#bm)"/></g>
<g stroke="#4f7e2e" stroke-width="2.5"><line x1="40" y1="92" x2="54" y2="92"/><line x1="40" y1="150" x2="54" y2="150"/><line x1="40" y1="208" x2="54" y2="208"/><line x1="64" y1="78" x2="79" y2="78"/><line x1="64" y1="140" x2="79" y2="140"/><line x1="64" y1="202" x2="79" y2="202"/><line x1="88" y1="108" x2="100" y2="108"/><line x1="88" y1="166" x2="100" y2="166"/><line x1="88" y1="224" x2="100" y2="224"/></g>
<g fill="#5c9e3c"><path d="M71,28 C56,16 40,16 30,24 C46,26 60,32 70,40 Z"/><path d="M72,28 C87,16 103,16 113,24 C97,26 83,32 73,40 Z"/><path d="M47,44 C34,36 22,36 14,42 C26,44 38,50 48,56 Z"/><path d="M93,62 C106,52 118,52 126,58 C114,60 102,66 92,72 Z"/></g>`
  ),
  126
);
const pandaSvg = (lf) =>
  S(
    '200 150',
    `
<g stroke="#2a2a2a" stroke-width="13" stroke-linecap="round"><line x1="66" y1="96" x2="${62 + lf[0]}" y2="138"/><line x1="92" y1="98" x2="${92 + lf[1]}" y2="140"/><line x1="120" y1="98" x2="${124 + lf[2]}" y2="140"/><line x1="144" y1="96" x2="${150 + lf[3]}" y2="138"/></g>
<path d="M52,98 C44,68 72,52 110,52 C150,52 168,64 168,90 C168,106 138,110 104,110 C74,110 60,110 52,98 Z" fill="#f4f2ee"/>
<path d="M148,56 C164,60 170,74 168,92 C162,104 150,108 140,108 C150,92 150,72 148,56 Z" fill="#2a2a2a"/>
<circle cx="166" cy="64" r="24" fill="#f4f2ee"/>
<circle cx="156" cy="44" r="10" fill="#2a2a2a"/>
<ellipse cx="172" cy="60" rx="8" ry="10" fill="#2a2a2a"/>
<circle cx="174" cy="60" r="2.6" fill="#fff"/><circle cx="174" cy="61" r="1.4" fill="#1a1a1a"/>
<path d="M186,66 C194,68 196,76 189,80 C183,80 181,72 182,68 Z" fill="#f4f2ee"/>
<ellipse cx="190" cy="72" rx="3.6" ry="2.6" fill="#2a2a2a"/>
<path d="M52,86 C42,86 38,96 44,102 C50,98 54,92 58,90 Z" fill="#f4f2ee"/>`
  );
save('panda', pandaSvg([0, 0, 0, 0]), 180);
save('panda_b', pandaSvg([8, -7, -7, 8]), 180);
save(
  'redpanda',
  S(
    '208 124',
    `<defs><linearGradient id="rp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c45a2a"/><stop offset="1" stop-color="#9c421c"/></linearGradient>
<linearGradient id="rpt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a3416"/><stop offset="1" stop-color="#bd5428"/></linearGradient></defs>
<path d="M70,86 C44,98 16,98 8,78 C4,68 10,58 20,56 C16,66 22,76 40,80 C52,83 64,84 74,82 Z" fill="url(#rpt)"/>
<g stroke="#3a1e10" stroke-width="7" stroke-linecap="round" fill="none"><path d="M14,68 q9,9 19,8"/><path d="M22,56 q9,6 18,7"/><path d="M34,82 q11,4 21,0"/></g>
<g stroke="#3a2014" stroke-width="8" stroke-linecap="round"><line x1="84" y1="88" x2="82" y2="110"/><line x1="110" y1="90" x2="110" y2="112"/><line x1="138" y1="90" x2="140" y2="110"/></g>
<path d="M60,86 C56,64 80,56 116,56 C148,56 164,64 164,82 C164,94 140,98 112,98 C84,98 68,96 60,86 Z" fill="url(#rp)"/>
<circle cx="170" cy="66" r="20" fill="url(#rp)"/>
<path d="M170,51 C180,51 188,58 188,68 C188,77 181,83 171,82 C176,72 176,59 170,51 Z" fill="#f7ece0"/>
<path d="M170,51 C160,51 152,58 152,68 C152,77 159,83 169,82 C164,72 164,59 170,51 Z" fill="#f7ece0"/>
<circle cx="156" cy="49" r="9" fill="url(#rp)"/><circle cx="184" cy="49" r="9" fill="url(#rp)"/>
<circle cx="156" cy="49" r="4.5" fill="#f7ece0"/><circle cx="184" cy="49" r="4.5" fill="#f7ece0"/>
<circle cx="163" cy="65" r="2.2" fill="#1a1a1a"/><circle cx="177" cy="65" r="2.2" fill="#1a1a1a"/>
<circle cx="170" cy="74" r="3" fill="#241008"/>`
  ),
  192
);

// ---- VOLCANIC biome ----
save(
  'volcano',
  S(
    '420 300',
    `<defs>
<linearGradient id="vc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5c4f56"/><stop offset="1" stop-color="#2e2630"/></linearGradient>
<linearGradient id="vl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset=".5" stop-color="#ff7a2a"/><stop offset="1" stop-color="#d2331a"/></linearGradient></defs>
<path d="M24,298 L150,74 C160,52 260,52 270,74 L396,298 Z" fill="url(#vc)"/>
<path d="M150,74 C162,56 258,56 270,74 C248,88 188,88 150,74 Z" fill="#221c24"/>
<ellipse cx="210" cy="74" rx="52" ry="11" fill="url(#vl)"/>
<path d="M196,80 C190,140 186,210 180,296 L202,296 C206,210 210,140 216,82 Z" fill="url(#vl)" opacity="0.85"/>
<path d="M236,82 C244,150 250,224 258,296 L242,296 C234,212 226,150 220,84 Z" fill="url(#vl)" opacity="0.7"/>
<path d="M24,298 L150,74 C138,98 112,166 86,238 C74,272 54,292 44,298 Z" fill="#241e26" opacity="0.45"/>
<g fill="#1d171f" opacity="0.55"><ellipse cx="120" cy="244" rx="20" ry="8"/><ellipse cx="322" cy="256" rx="22" ry="9"/><ellipse cx="286" cy="210" rx="12" ry="6"/></g>`
  ),
  420
);

// ---- NEW: cave set (bat 2 frames, stalactite, stalagmite, glowing crystal cluster) ----
// dark cool-rock palette so the glow of crystals + glowworms reads against it
const bat = (tip, mid) =>
  S(
    '140 86',
    `<g fill="#2b2536">
<path d="M70,30 L63,11 L72,26 Z"/><path d="M70,30 L77,11 L68,26 Z"/>
<circle cx="70" cy="30" r="8"/><ellipse cx="70" cy="46" rx="9" ry="15"/>
<path d="M62,38 C44,${tip} 24,${tip - 2} 8,${mid} C24,${mid + 6} 32,${mid + 13} 40,${mid + 9} C44,${mid + 17} 54,${mid + 12} 60,52 Z"/>
<path d="M78,38 C96,${tip} 116,${tip - 2} 132,${mid} C116,${mid + 6} 108,${mid + 13} 100,${mid + 9} C96,${mid + 17} 86,${mid + 12} 80,52 Z"/></g>
<g fill="#3c3449" opacity="0.6"><path d="M62,40 C46,${tip + 6} 30,${tip + 3} 16,${mid + 2} C30,${mid + 8} 38,${mid + 11} 58,50 Z"/>
<path d="M78,40 C94,${tip + 6} 110,${tip + 3} 124,${mid + 2} C110,${mid + 8} 102,${mid + 11} 82,50 Z"/></g>`
  );
save('bat_a', bat(20, 34), 112);
save('bat_b', bat(44, 54), 112);

save(
  'stalactite',
  S(
    '56 210',
    `<defs><linearGradient id="sl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#37304a"/><stop offset=".6" stop-color="#251f33"/><stop offset="1" stop-color="#171320"/></linearGradient></defs>
<path d="M2,0 C6,70 12,130 28,206 C42,132 50,72 54,0 Z" fill="url(#sl)"/>
<path d="M20,0 C22,54 24,96 28,150 C31,96 33,54 35,0 Z" fill="#473d5c" opacity="0.45"/>
<path d="M35,0 C40,60 45,110 40,150 C46,108 50,58 53,0 Z" fill="#0f0c16" opacity="0.4"/>`
  ),
  56
);

save(
  'stalagmite',
  S(
    '64 176',
    `<defs><linearGradient id="sm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3350"/><stop offset="1" stop-color="#191420"/></linearGradient></defs>
<path d="M6,176 C12,104 18,54 32,2 C46,54 52,104 58,176 Z" fill="url(#sm)"/>
<path d="M30,176 C30,120 30,70 32,12 C34,70 35,120 38,176 Z" fill="#4c4263" opacity="0.4"/>
<path d="M42,176 C47,120 50,80 52,42" stroke="#0f0c16" stroke-width="3" opacity="0.3" fill="none"/>`
  ),
  64
);

// crystal kept light + faceted so it can be tinted per cluster (teal / violet / blue)
save(
  'crystal',
  S(
    '96 120',
    `<defs><linearGradient id="cr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eaf6ff"/><stop offset="1" stop-color="#9fc4e8"/></linearGradient>
<linearGradient id="cr2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#bcd6f0"/></linearGradient></defs>
<path d="M30,118 L20,52 L36,18 L46,54 Z" fill="url(#cr)"/>
<path d="M58,118 L50,64 L62,30 L72,66 Z" fill="url(#cr)"/>
<path d="M44,118 L36,72 L48,40 L56,74 Z" fill="url(#cr2)"/>
<g fill="#ffffff" opacity="0.55"><path d="M36,18 L41,40 L31,46 Z"/><path d="M62,30 L67,52 L57,56 Z"/><path d="M48,40 L52,60 L44,62 Z"/></g>
<g fill="#7fa6cc" opacity="0.45"><path d="M46,54 L40,72 L44,52 Z"/><path d="M72,66 L64,34 L70,60 Z"/></g>`
  ),
  96
);

// snow-capped massif that rises behind the alpine hills (a `feature`, so it sits at the back)
save(
  'peak',
  S(
    '440 320',
    `<defs><linearGradient id="pk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b7c5da"/><stop offset="1" stop-color="#61728a"/></linearGradient></defs>
<path d="M150,320 L300,66 L440,320 Z" fill="#8295ad"/>
<path d="M0,320 L150,36 L340,320 Z" fill="url(#pk)"/>
<path d="M150,36 L104,128 L132,116 L150,150 L176,104 L150,36 Z" fill="#f3f8ff"/>
<path d="M300,66 L266,128 L286,120 L300,148 L320,116 L300,66 Z" fill="#e9f1fb"/>
<path d="M150,36 L176,104 L150,150 L132,116 Z" fill="#9aa9bf" opacity="0.5"/>
<path d="M150,150 L196,236 L150,320 L122,232 Z" fill="#536378" opacity="0.45"/>`
  ),
  430
);

// distant mesa/butte (desert horizon): layered sedimentary rock with a sunlit + shadowed face,
// a cap rock and erosion gullies — light + tintable so it hazes into the distance
save(
  'butte',
  S(
    '240 178',
    `<defs><linearGradient id="bz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2c794"/><stop offset="1" stop-color="#c0a06d"/></linearGradient></defs>
<path d="M14,178 L40,118 L200,118 L228,178 Z" fill="#cdb182"/>
<path d="M40,178 L48,46 L194,46 L202,178 Z" fill="url(#bz)"/>
<path d="M46,64 L195,64 L194,76 L47,76 Z" fill="#caa771" opacity="0.55"/>
<path d="M45,90 L196,90 L195,100 L46,100 Z" fill="#bd9a64" opacity="0.5"/>
<path d="M44,112 L197,112 L196,122 L45,122 Z" fill="#caa771" opacity="0.45"/>
<path d="M46,46 L194,46 L192,58 L48,58 Z" fill="#e8cf9d"/>
<path d="M48,46 L194,46 L186,40 L56,40 Z" fill="#f1deb2"/>
<path d="M152,48 L194,46 L202,178 L162,178 Z" fill="#a88a5c" opacity="0.34"/>
<path d="M112,47 L108,178" stroke="#a88a5c" stroke-width="2.6" opacity="0.32" fill="none"/>
<path d="M150,47 L156,118" stroke="#a88a5c" stroke-width="2" opacity="0.26" fill="none"/>
<path d="M76,47 L72,118" stroke="#a88a5c" stroke-width="1.6" opacity="0.22" fill="none"/>`
  ),
  240
);
// ice floe drifting on the fjord: a flat slab with sunlit facets and a waterline shadow
save(
  'icefloe',
  S(
    '160 82',
    `<defs><linearGradient id="ifc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3f9ff"/><stop offset="1" stop-color="#c7d9e8"/></linearGradient></defs>
<ellipse cx="80" cy="62" rx="72" ry="13" fill="#88acc6" opacity="0.55"/>
<path d="M14,56 L34,38 L72,30 L118,32 L148,46 L150,58 L118,66 L38,66 Z" fill="url(#ifc)"/>
<path d="M40,48 L66,34 L112,36 L132,47 L108,54 L54,54 Z" fill="#ffffff" opacity="0.85"/>
<path d="M72,32 L80,54" stroke="#bcd2e2" stroke-width="1.5" opacity="0.6" fill="none"/>
<path d="M118,34 L108,54" stroke="#bcd2e2" stroke-width="1.3" opacity="0.5" fill="none"/>
<path d="M34,40 L40,64" stroke="#bcd2e2" stroke-width="1.2" opacity="0.45" fill="none"/>`
  ),
  160
);

// distant coastal headland: a layered rock promontory with a green scrub cap and a shadowed lee
// face — a discrete landform, so a designed sprite; placed on the sea horizon and hazed
save(
  'headland',
  S(
    '250 196',
    `<defs><linearGradient id="hl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9c9486"/><stop offset="1" stop-color="#6c655a"/></linearGradient>
<linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fb066"/><stop offset="1" stop-color="#6c9047"/></linearGradient></defs>
<path d="M18,196 L34,84 L92,52 L156,56 L214,86 L232,196 Z" fill="url(#hl)"/>
<path d="M30,108 L222,110 L221,122 L31,120 Z" fill="#857c6e" opacity="0.5"/>
<path d="M26,146 L226,148 L225,160 L27,158 Z" fill="#857c6e" opacity="0.45"/>
<path d="M156,56 L214,86 L232,196 L182,196 Z" fill="#564f45" opacity="0.34"/>
<path d="M34,84 L92,52 L156,56 L214,86 Q188,72 156,70 Q120,66 92,68 Q58,72 34,84 Z" fill="url(#hg)"/>
<path d="M92,52 L156,56 Q150,62 120,62 Q104,62 92,58 Z" fill="#a3c178" opacity="0.7"/>
<path d="M150,58 L160,84 M120,60 L116,86" stroke="#564f45" stroke-width="2" opacity="0.25" fill="none"/>`
  ),
  250
);
// fjord wall: a tall, steep rock buttress that plunges to the water, snow-dusted top + ledges,
// vertical striations on the face. Drawn as a left-side wall; mirror it for the right bank.
save(
  'cliff',
  S(
    '230 470',
    `<defs><linearGradient id="clf" x1="0" y1="0" x2="1" y2="0.25"><stop offset="0" stop-color="#7f8da4"/><stop offset="1" stop-color="#3c4658"/></linearGradient></defs>
<path d="M0,470 L0,40 L58,16 L120,58 L152,150 L168,300 L156,470 Z" fill="url(#clf)"/>
<path d="M104,92 L114,470 L92,470 L82,104 Z" fill="#2e3949" opacity="0.28"/>
<path d="M150,150 L168,196 L150,470 L140,470 L136,196 Z" fill="#2e3949" opacity="0.2"/>
<g stroke="#2f3a4c" stroke-width="2.4" opacity="0.32" fill="none"><path d="M30,80 L38,468"/><path d="M58,70 L66,468"/><path d="M126,120 L132,468"/></g>
<path d="M0,40 L58,16 L120,58 L152,150 Q150,120 120,96 Q78,66 40,66 L0,66 Z" fill="#e9eff7"/>
<path d="M0,40 L58,16 L120,58 Q92,42 56,44 L0,52 Z" fill="#f6faff"/>
<path d="M150,150 L168,196 Q150,180 138,190 L132,156 Z" fill="#dfe7f0" opacity="0.85"/>
<path d="M88,108 Q96,140 92,210" stroke="#aab6c8" stroke-width="2" opacity="0.4" fill="none"/>`
  ),
  230
);
save(
  'bigrock',
  S(
    '380 340',
    `<defs><linearGradient id="bk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9ccd8"/><stop offset="1" stop-color="#73768a"/></linearGradient>
<linearGradient id="bkt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef0f6"/><stop offset="1" stop-color="#aeb2c4"/></linearGradient></defs>
<path d="M0,340 L0,78 L48,58 L106,68 L168,52 L232,64 L300,68 L332,94 L314,142 L288,170 L304,216 L284,268 L246,308 L196,340 Z" fill="url(#bk)"/>
<path d="M0,78 L48,58 L106,68 L168,52 L232,64 L300,68 L332,94 L322,114 L300,88 L232,82 L168,72 L106,86 L48,78 L0,94 Z" fill="url(#bkt)" opacity="0.72"/>
<path d="M332,94 L314,142 L288,170 L304,216 L290,218 L276,170 L300,138 L320,100 Z" fill="#3c3f4b" opacity="0.66"/>
<g fill="#85889b" opacity="0.42"><path d="M30,128 L86,112 L72,190 L26,178 Z"/><path d="M128,152 L194,136 L184,224 L126,214 Z"/><path d="M216,120 L284,114 L296,178 L238,192 Z"/></g>
<g fill="#dfe1ea" opacity="0.5"><path d="M16,100 L64,86 L52,126 L20,130 Z"/><path d="M150,70 L212,64 L200,98 L150,98 Z"/></g>`
  ),
  380
);
const falls = (a) =>
  S(
    '380 340',
    `<defs><linearGradient id="fw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2f1fa"/><stop offset="1" stop-color="#a6cadf"/></linearGradient></defs>
<path d="M0,50 Q150,40 300,56 L326,82 Q160,66 0,68 Z" fill="url(#fw)" opacity="0.82"/>
<path d="M310,66 Q304,200 320,310 Q324,328 338,328 Q350,328 352,310 Q338,200 340,70 Z" fill="url(#fw)" opacity="0.8"/>
<g stroke="#f4fbff" stroke-width="2.4" fill="none" opacity="0.72"><path d="M318,${76 + a} Q314,200 326,310"/><path d="M332,${70 + a} Q340,200 332,310"/><path d="M325,${82 + a} Q324,200 329,310"/></g>
<g stroke="#ffffff" stroke-width="1.8" opacity="0.5"><line x1="${30 + a * 4}" y1="56" x2="${88 + a * 4}" y2="55"/><line x1="${134 + a * 4}" y1="54" x2="${196 + a * 4}" y2="56"/><line x1="${72 + a * 4}" y1="62" x2="${124 + a * 4}" y2="61"/></g>
<g fill="#ffffff"><ellipse cx="326" cy="70" rx="22" ry="9"/><ellipse cx="310" cy="64" rx="9" ry="6"/><ellipse cx="342" cy="66" rx="8" ry="5"/></g>
<g fill="#ffffff"><ellipse cx="332" cy="322" rx="28" ry="10"/><ellipse cx="308" cy="318" rx="10" ry="6"/><ellipse cx="354" cy="318" rx="10" ry="6"/><ellipse cx="${322 + a * 3}" cy="326" rx="6" ry="4"/></g>`
  );
save('falls_a', falls(0), 380);
save('falls_b', falls(7), 380);

// seamless vertical streak/droplet tile — scrolled downward over a fall to read as flowing water
save(
  'wstreak',
  S(
    '64 140',
    `<g stroke="#eaf7ff" stroke-width="2.6" fill="none" opacity="0.38"><line x1="12" y1="-4" x2="12" y2="144"/><line x1="26" y1="-4" x2="26" y2="144"/><line x1="40" y1="-4" x2="40" y2="144"/><line x1="52" y1="-4" x2="52" y2="144"/></g>
<g fill="#ffffff" opacity="0.85"><rect x="10.5" y="8" width="3" height="18" rx="1.5"/><rect x="24.5" y="52" width="3" height="20" rx="1.5"/><rect x="38.5" y="26" width="3" height="16" rx="1.5"/><rect x="50.5" y="64" width="3" height="15" rx="1.5"/><rect x="11" y="92" width="3" height="17" rx="1.5"/><rect x="25" y="113" width="3" height="18" rx="1.5"/><rect x="39" y="98" width="3" height="16" rx="1.5"/><rect x="51" y="121" width="3" height="14" rx="1.5"/></g>`
  ),
  64
);

// soft fog bank — tiled horizontally and drifted to make low mist; alpha driven by time of day
save(
  'fog',
  S(
    '256 90',
    `<defs><radialGradient id="fg"><stop offset="0" stop-color="#ffffff" stop-opacity="0.92"/><stop offset="0.6" stop-color="#ffffff" stop-opacity="0.4"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="50" cy="46" rx="85" ry="32" fill="url(#fg)"/>
<ellipse cx="130" cy="40" rx="88" ry="35" fill="url(#fg)"/>
<ellipse cx="210" cy="48" rx="84" ry="31" fill="url(#fg)"/>
<ellipse cx="306" cy="46" rx="85" ry="32" fill="url(#fg)"/>
<ellipse cx="-46" cy="48" rx="84" ry="31" fill="url(#fg)"/>`
  ),
  256
);

// ---- REEF biome (underwater) ----
// kelp: a tall frond rising from the seabed; anchored at the base and swayed by the current
save(
  'kelp',
  S(
    '60 320',
    `<defs><linearGradient id="kl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#62a847"/><stop offset="1" stop-color="#2b5422"/></linearGradient></defs>
<path d="M30,320 C22,256 40,214 30,152 C22,102 38,54 30,6 C40,54 52,104 44,154 C36,216 46,258 42,320 Z" fill="url(#kl)"/>
<path d="M31,300 C16,270 8,232 16,196 C20,224 28,252 33,288 Z" fill="url(#kl)" opacity="0.85"/>
<path d="M40,288 C56,258 62,224 54,190 C50,222 42,248 39,280 Z" fill="url(#kl)" opacity="0.85"/>
<path d="M30,320 C30,200 34,110 31,8" fill="none" stroke="#234a1c" stroke-width="2" opacity="0.5"/>
<g fill="#bfe89a" opacity="0.6"><circle cx="33" cy="60" r="3"/><circle cx="29" cy="150" r="3"/><circle cx="34" cy="232" r="3"/></g>`
  ),
  80
);
// sea fan: a flat lattice of fine branches that filter the current
save(
  'coral_fan',
  S(
    '150 150',
    `<defs><linearGradient id="cf" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#9b3a7a"/><stop offset="1" stop-color="#e07cb6"/></linearGradient></defs>
<g fill="none" stroke="url(#cf)" stroke-linecap="round">
<path d="M75,148 C72,120 72,108 75,96" stroke-width="6"/>
<path d="M75,96 C66,78 54,64 44,40" stroke-width="4"/><path d="M75,96 C84,78 96,64 106,40" stroke-width="4"/>
<path d="M75,100 C72,76 70,52 72,18" stroke-width="3.4"/>
<path d="M72,60 C62,44 52,32 46,16" stroke-width="2.4"/><path d="M78,60 C88,44 98,32 104,16" stroke-width="2.4"/>
<path d="M58,52 C50,40 44,30 40,16" stroke-width="1.7"/><path d="M92,52 C100,40 106,30 110,16" stroke-width="1.7"/>
<path d="M50,38 C44,28 40,22 36,12" stroke-width="1.3"/><path d="M100,38 C106,28 110,22 114,12" stroke-width="1.3"/>
<path d="M66,42 C62,30 60,22 60,12" stroke-width="1.3"/><path d="M84,42 C88,30 90,22 90,12" stroke-width="1.3"/></g>
<g fill="none" stroke="#cf63a6" stroke-width="0.9" opacity="0.55"><path d="M55,60 Q75,52 95,60"/><path d="M50,36 Q75,30 100,36"/><path d="M44,20 Q75,14 106,20"/></g>`
  ),
  150
);
// staghorn coral: chunky branching colony with pale polyp tips
save(
  'coral_branch',
  S(
    '170 150',
    `<defs><linearGradient id="cb" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#d96a3a"/><stop offset="1" stop-color="#f4a772"/></linearGradient></defs>
<g fill="none" stroke="url(#cb)" stroke-linecap="round">
<path d="M85,148 C84,120 82,108 84,92" stroke-width="14"/>
<path d="M84,96 C74,80 60,72 50,52" stroke-width="11"/><path d="M84,96 C96,80 110,72 122,54" stroke-width="11"/>
<path d="M84,100 C84,78 86,58 86,34" stroke-width="10"/>
<path d="M52,58 C44,46 40,38 36,26" stroke-width="7"/><path d="M120,58 C128,46 132,38 138,26" stroke-width="7"/>
<path d="M86,40 C80,30 76,24 74,14" stroke-width="6"/><path d="M86,40 C92,30 96,24 100,14" stroke-width="6"/></g>
<g fill="#ffd9b8"><circle cx="36" cy="25" r="4.2"/><circle cx="138" cy="25" r="4.2"/><circle cx="74" cy="13" r="3.6"/><circle cx="100" cy="13" r="3.6"/><circle cx="86" cy="32" r="3.6"/><circle cx="50" cy="50" r="3.4"/><circle cx="122" cy="52" r="3.4"/></g>`
  ),
  165
);
// coral knobs: a low cluster colony on the seabed
save(
  'coral_round',
  S(
    '130 84',
    `<ellipse cx="65" cy="76" rx="60" ry="14" fill="#1f5a4f" opacity="0.45"/>
<circle cx="40" cy="54" r="20" fill="#3fa890"/><circle cx="72" cy="48" r="24" fill="#49bda0"/><circle cx="100" cy="56" r="17" fill="#3fa890"/>
<circle cx="54" cy="62" r="13" fill="#8a6fc0"/><circle cx="88" cy="64" r="12" fill="#9a7fce"/>
<g fill="#2b7a68" opacity="0.7"><circle cx="36" cy="50" r="2"/><circle cx="46" cy="58" r="2"/><circle cx="70" cy="44" r="2.2"/><circle cx="78" cy="54" r="2"/><circle cx="100" cy="54" r="2"/></g>
<g fill="#bdf0e2" opacity="0.5"><circle cx="66" cy="40" r="5"/><circle cx="34" cy="48" r="4"/><circle cx="96" cy="50" r="3.5"/></g>`
  ),
  130
);
// anemone: a crown of soft tentacles waving in the current (swayed)
save(
  'anemone',
  S(
    '100 100',
    `<defs><linearGradient id="an" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#c9447e"/><stop offset="1" stop-color="#f792c2"/></linearGradient></defs>
<ellipse cx="50" cy="88" rx="30" ry="13" fill="#b23a6e"/>
<g fill="none" stroke="url(#an)" stroke-width="5" stroke-linecap="round">
<path d="M50,86 C40,60 36,42 30,22"/><path d="M50,86 C50,58 50,40 50,18"/><path d="M50,86 C60,60 64,42 70,22"/>
<path d="M50,86 C32,66 24,50 18,34"/><path d="M50,86 C68,66 76,50 82,34"/>
<path d="M50,86 C44,58 42,40 40,20"/><path d="M50,86 C56,58 58,40 60,20"/></g>
<g fill="#ffe0ef"><circle cx="30" cy="22" r="3"/><circle cx="50" cy="18" r="3"/><circle cx="70" cy="22" r="3"/><circle cx="18" cy="34" r="3"/><circle cx="82" cy="34" r="3"/><circle cx="40" cy="20" r="3"/><circle cx="60" cy="20" r="3"/></g>`
  ),
  100
);
// sea turtle: glides across the reef now and then, facing right (front flipper sweeps like a wing)
save(
  'turtle',
  S(
    '200 132',
    `<defs><radialGradient id="tsh" cx="44%" cy="32%"><stop offset="0" stop-color="#74b46c"/><stop offset="1" stop-color="#3a6a3e"/></radialGradient></defs>
<path d="M44,70 C22,66 10,78 15,94 C30,90 45,82 53,73 Z" fill="#4a7d4a"/>
<path d="M150,58 C168,52 182,56 184,66 C182,76 168,78 152,72 Z" fill="#5a9456"/>
<circle cx="173" cy="63" r="2.6" fill="#14210f"/><circle cx="174" cy="62" r="0.9" fill="#fff"/>
<ellipse cx="92" cy="64" rx="64" ry="41" fill="url(#tsh)"/>
<path d="M40,76 C70,98 120,98 148,76 C120,88 64,88 40,76 Z" fill="#84bd7c" opacity="0.45"/>
<g fill="none" stroke="#2f5733" stroke-width="2" opacity="0.55"><path d="M92,24 L92,104"/><path d="M60,32 Q92,42 124,32"/><path d="M56,64 Q92,72 128,64"/><path d="M70,26 L60,62 L72,100"/><path d="M114,26 L124,62 L112,100"/></g>
<path d="M120,48 C140,32 160,26 168,36 C160,50 140,58 122,62 Z" fill="#5a9456"/>
<path d="M122,50 C138,38 154,34 164,40 C150,44 136,48 124,56 Z" fill="#74b46c" opacity="0.6"/>`
  ),
  210
);
// bubble: rises from the reef and wobbles upward
save(
  'bubble',
  S(
    '24 24',
    `<circle cx="12" cy="12" r="9" fill="#bfe8f0" opacity="0.26"/>
<circle cx="12" cy="12" r="9" fill="none" stroke="#eafaff" stroke-width="1.6" opacity="0.8"/>
<circle cx="9" cy="9" r="2.4" fill="#ffffff" opacity="0.9"/>`
  ),
  24
);
// jellyfish (2 frames): a translucent bell that pulses — relaxed (p=0) vs contracted (p=1) —
// while trailing oral arms and fine tentacles; drifts slowly up the column
const jellySvg = (p) => {
  const rx = 36 - p * 8,
    ry = 23 + p * 10,
    cy = 50 - p * 8,
    sp = 1 - p * 0.4; // tentacles gather as the bell contracts
  return S(
    '92 166',
    `<defs><radialGradient id="jb" cx="50%" cy="38%"><stop offset="0" stop-color="#ffdcf1" stop-opacity="0.9"/><stop offset="0.7" stop-color="#cfa6e8" stop-opacity="0.55"/><stop offset="1" stop-color="#9a7fd0" stop-opacity="0.22"/></radialGradient></defs>
<g fill="none" stroke-linecap="round">
<path d="M${46 - 22 * sp},${cy + 6} q-6,42 ${-4 * sp},92" stroke="#e9b9ea" stroke-width="3" opacity="0.55"/>
<path d="M${46 - 8 * sp},${cy + 9} q-2,48 ${-2 * sp},94" stroke="#e9b9ea" stroke-width="3" opacity="0.55"/>
<path d="M${46 + 8 * sp},${cy + 9} q2,48 ${2 * sp},94" stroke="#e9b9ea" stroke-width="3" opacity="0.55"/>
<path d="M${46 + 22 * sp},${cy + 6} q6,42 ${4 * sp},92" stroke="#e9b9ea" stroke-width="3" opacity="0.55"/>
<path d="M${46 - 29 * sp},${cy + 3} q-4,56 ${-7 * sp},110" stroke="#f3d2ee" stroke-width="1.2" opacity="0.45"/>
<path d="M${46 + 29 * sp},${cy + 3} q4,56 ${7 * sp},110" stroke="#f3d2ee" stroke-width="1.2" opacity="0.45"/>
<path d="M46,${cy + 9} q0,58 0,112" stroke="#f3d2ee" stroke-width="1.2" opacity="0.45"/></g>
<path d="M${46 - rx},${cy} a${rx},${ry} 0 0 1 ${rx * 2},0 q${-rx},16 ${-rx * 2},0 Z" fill="url(#jb)"/>
<ellipse cx="40" cy="${cy - ry * 0.45}" rx="${rx * 0.36}" ry="${ry * 0.34}" fill="#ffffff" opacity="0.32"/>`
  );
};
save('jelly_a', jellySvg(0), 92);
save('jelly_b', jellySvg(1), 92);

// ---- JUNGLE biome ----
// tall buttressed rainforest tree: flared roots, a tall trunk rising into a high canopy + moss
save(
  'jungle_tree',
  S(
    '184 470',
    `<defs><linearGradient id="jtt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6f5238"/><stop offset="0.5" stop-color="#56402a"/><stop offset="1" stop-color="#3c2a1a"/></linearGradient>
<radialGradient id="jtc" cx="44%" cy="36%" r="72%"><stop offset="0" stop-color="#59a040"/><stop offset="1" stop-color="#2d5b26"/></radialGradient></defs>
<ellipse cx="40" cy="98" rx="46" ry="36" fill="url(#jtc)"/>
<ellipse cx="146" cy="92" rx="48" ry="36" fill="url(#jtc)"/>
<ellipse cx="90" cy="70" rx="94" ry="60" fill="url(#jtc)"/>
<path d="M70,120 C58,150 56,176 64,200 C76,180 80,150 84,124 Z" fill="#2d5b26" opacity="0.6"/>
<path d="M114,118 C126,150 128,178 120,202 C108,182 104,150 100,122 Z" fill="#2d5b26" opacity="0.5"/>
<path d="M80,462 C76,322 80,182 86,118 L100,118 C106,182 110,322 104,462 Z" fill="url(#jtt)"/>
<path d="M80,462 C70,414 50,392 24,384 C34,416 50,440 64,462 Z" fill="url(#jtt)"/>
<path d="M104,462 C114,414 134,392 160,384 C150,416 134,440 120,462 Z" fill="url(#jtt)"/>
<path d="M91,140 C89,290 91,404 94,456" stroke="#3c2a1a" stroke-width="3" opacity="0.4" fill="none"/>
<g fill="#3f7a30" opacity="0.6"><ellipse cx="95" cy="232" rx="6" ry="15"/><ellipse cx="88" cy="318" rx="5" ry="13"/><ellipse cx="97" cy="392" rx="5" ry="12"/></g>`
  ),
  184
);
// hanging vine with leaves (anchored at the top; sways)
save(
  'vine',
  S(
    '46 300',
    `<path d="M23,2 C16,70 30,140 21,210 C16,256 26,282 23,300" fill="none" stroke="#3f6b2e" stroke-width="4" stroke-linecap="round"/>
<g fill="#4e8c3a"><path d="M22,40 C8,34 4,46 16,52 C24,52 26,44 22,40 Z"/><path d="M26,86 C40,80 44,92 32,98 C24,98 22,90 26,86 Z"/><path d="M20,140 C6,136 4,148 16,152 C24,150 24,144 20,140 Z"/><path d="M25,196 C39,192 42,204 30,208 C23,206 22,200 25,196 Z"/><path d="M21,250 C8,247 6,258 17,261 C24,260 24,253 21,250 Z"/></g>`
  ),
  46
);
// big split tropical leaf (monstera) for the undergrowth
save(
  'bigleaf',
  S(
    '172 150',
    `<defs><linearGradient id="bl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#62b048"/><stop offset="1" stop-color="#357a2a"/></linearGradient></defs>
<path d="M86,150 C84,118 82,96 86,78" stroke="#357a2a" stroke-width="5" fill="none" stroke-linecap="round"/>
<path d="M86,80 C40,78 12,58 8,30 C6,14 18,6 40,10 C30,22 36,40 64,52 C44,40 52,18 78,18 C70,30 78,46 86,58 C94,46 102,30 94,18 C120,18 128,40 108,52 C136,40 142,22 132,10 C154,6 166,14 164,30 C160,58 132,78 86,80 Z" fill="url(#bl)"/>
<g stroke="#2f6a24" stroke-width="2" opacity="0.5" fill="none"><path d="M86,78 L52,32"/><path d="M86,78 L86,22"/><path d="M86,78 L120,32"/><path d="M86,70 L24,28"/><path d="M86,70 L148,28"/></g>`
  ),
  172
);
// toucan: black body, cream throat, blue eye-ring and a big orange-yellow beak (faces right)
save(
  'toucan',
  S(
    '150 116',
    `<defs><linearGradient id="tkb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff9a1e"/><stop offset="0.7" stop-color="#ffd23e"/><stop offset="1" stop-color="#ffe27a"/></linearGradient></defs>
<path d="M22,96 C10,92 6,80 14,74 C22,76 30,86 34,94 Z" fill="#14141a"/>
<ellipse cx="60" cy="62" rx="42" ry="34" fill="#1b1b22"/>
<path d="M40,40 C44,26 60,20 78,24 C66,30 56,40 52,52 C46,50 42,46 40,40 Z" fill="#2a2a33"/>
<ellipse cx="92" cy="46" rx="26" ry="24" fill="#1b1b22"/>
<path d="M78,72 C86,80 104,82 118,74 C104,86 86,86 76,80 Z" fill="#f4efe1"/>
<path d="M70,52 C72,64 78,74 92,78 C86,66 84,58 84,50 Z" fill="#f4efe1"/>
<path d="M108,34 C140,30 150,40 148,50 C146,60 120,62 104,56 C100,46 102,38 108,34 Z" fill="url(#tkb)"/>
<path d="M144,46 C150,48 150,54 144,55 C138,55 138,48 144,46 Z" fill="#e23a2a"/>
<path d="M108,38 C124,36 138,40 146,48" stroke="#d98018" stroke-width="1.6" fill="none" opacity="0.6"/>
<circle cx="101" cy="44" r="6.5" fill="#3fb6d6"/><circle cx="101" cy="44" r="3.2" fill="#10141a"/><circle cx="102.4" cy="42.6" r="1" fill="#fff"/>
<path d="M58,94 L56,108 M70,96 L70,110" stroke="#5b6470" stroke-width="3" stroke-linecap="round"/>`
  ),
  150
);
// monkey: a small brown monkey sitting with a curled tail (faces right)
save(
  'monkey',
  S(
    '120 128',
    `<defs><radialGradient id="mk" cx="50%" cy="40%"><stop offset="0" stop-color="#866043"/><stop offset="1" stop-color="#5e4430"/></radialGradient></defs>
<path d="M30,96 C8,92 2,70 16,58 C26,52 34,64 34,80 C34,88 32,94 30,96 Z" fill="#5e4430"/>
<path d="M24,68 C10,64 8,52 18,48 C26,48 28,58 26,66 Z" fill="#6b4f38"/>
<ellipse cx="62" cy="92" rx="30" ry="28" fill="url(#mk)"/>
<g stroke="#5e4430" stroke-width="9" stroke-linecap="round"><line x1="48" y1="110" x2="44" y2="126"/><line x1="76" y1="110" x2="80" y2="126"/></g>
<g stroke="#6b4f38" stroke-width="7" stroke-linecap="round"><line x1="44" y1="86" x2="30" y2="104"/><line x1="82" y1="84" x2="96" y2="100"/></g>
<circle cx="84" cy="58" r="26" fill="url(#mk)"/>
<circle cx="40" cy="50" r="9" fill="#6b4f38"/><circle cx="78" cy="34" r="8" fill="#6b4f38"/>
<ellipse cx="90" cy="62" rx="18" ry="16" fill="#cBA883"/>
<ellipse cx="90" cy="62" rx="18" ry="16" fill="#c9a883"/>
<circle cx="84" cy="56" r="2.6" fill="#1a120c"/><circle cx="98" cy="56" r="2.6" fill="#1a120c"/>
<path d="M84,68 Q90,72 96,68" stroke="#7a5034" stroke-width="2" fill="none" stroke-linecap="round"/>`
  ),
  120
);

// ---- wildlife: seal (fjord), dolphin (coast), marmot (alpine) ----
// harbour seal hauled out: plump body, raised head, rear flippers, soft spots (faces right)
save(
  'seal',
  S(
    '172 90',
    `<defs><radialGradient id="slb" cx="50%" cy="34%"><stop offset="0" stop-color="#9ba7b2"/><stop offset="1" stop-color="#69757f"/></radialGradient></defs>
<path d="M18,72 C6,68 0,76 9,82 C18,84 27,77 31,73 Z" fill="#69757f"/>
<path d="M22,72 C16,52 52,46 98,48 C132,50 150,58 150,67 C150,75 118,80 78,80 C48,80 26,82 22,72 Z" fill="url(#slb)"/>
<g fill="#5b6770" opacity="0.45"><circle cx="58" cy="60" r="3.2"/><circle cx="92" cy="65" r="2.6"/><circle cx="40" cy="67" r="2.6"/><circle cx="112" cy="62" r="2.2"/><circle cx="74" cy="58" r="2.4"/></g>
<path d="M96,73 C100,83 113,85 117,79 C112,75 104,73 96,73 Z" fill="#606c75"/>
<path d="M120,58 C123,38 140,30 153,36 C162,42 160,55 151,61 C140,65 127,64 120,58 Z" fill="url(#slb)"/>
<ellipse cx="156" cy="46" rx="9" ry="6.5" fill="#7a8590"/>
<circle cx="159" cy="46" r="1.5" fill="#33393f"/>
<circle cx="146" cy="43" r="2.7" fill="#16191c"/><circle cx="147" cy="42" r="0.9" fill="#fff"/>
<g stroke="#cfd6dd" stroke-width="0.8" opacity="0.7" fill="none"><path d="M157,48 L170,50"/><path d="M157,50 L169,54"/></g>`
  ),
  172
);
// dolphin mid-leap: streamlined body, beak, dorsal fin, fluke, pale belly (faces right)
save(
  'dolphin',
  S(
    '180 96',
    `<defs><linearGradient id="dlp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5f6e7e"/><stop offset="0.55" stop-color="#8392a1"/><stop offset="1" stop-color="#d2dbe2"/></linearGradient></defs>
<path d="M12,58 C36,44 84,34 132,40 C150,42 166,48 174,55 C164,57 152,57 142,56 C151,63 159,72 163,82 C147,75 135,67 126,62 C92,68 48,70 24,66 C15,64 10,61 12,58 Z" fill="url(#dlp)"/>
<path d="M66,38 C72,20 88,18 96,36 C86,34 76,35 66,38 Z" fill="#6f7e8d"/>
<path d="M40,40 C36,30 42,24 50,28 C48,34 44,38 40,40 Z" fill="#6f7e8d"/>
<path d="M30,60 C72,67 112,64 142,56 C112,69 70,71 34,65 Z" fill="#dde4ea" opacity="0.6"/>
<path d="M150,52 C162,50 173,53 176,57 C171,59 160,58 150,57 Z" fill="#7a8a98"/>
<path d="M150,55 L161,55" stroke="#5f6e7e" stroke-width="1.4" opacity="0.6"/>
<circle cx="144" cy="50" r="2.6" fill="#15181c"/><circle cx="145" cy="49" r="0.9" fill="#fff"/>`
  ),
  180
);
// marmot sentinel: sitting upright on its haunches, forepaws at chest (faces forward, right-ish)
save(
  'marmot',
  S(
    '98 122',
    `<defs><radialGradient id="mmt" cx="50%" cy="34%"><stop offset="0" stop-color="#a47c4e"/><stop offset="1" stop-color="#6e5132"/></radialGradient></defs>
<path d="M72,104 C88,100 92,112 82,118 C72,116 68,108 72,104 Z" fill="#6e5132"/>
<ellipse cx="49" cy="86" rx="31" ry="31" fill="url(#mmt)"/>
<ellipse cx="49" cy="92" rx="18" ry="22" fill="#caa97a"/>
<g fill="#6e5132"><ellipse cx="40" cy="78" rx="6" ry="11"/><ellipse cx="58" cy="78" rx="6" ry="11"/></g>
<circle cx="49" cy="44" r="23" fill="url(#mmt)"/>
<circle cx="33" cy="27" r="7" fill="#6e5132"/><circle cx="65" cy="27" r="7" fill="#6e5132"/>
<circle cx="33" cy="27" r="3.4" fill="#8a6845"/><circle cx="65" cy="27" r="3.4" fill="#8a6845"/>
<ellipse cx="49" cy="51" rx="14" ry="12" fill="#caa97a"/>
<circle cx="41" cy="41" r="2.8" fill="#1a120c"/><circle cx="57" cy="41" r="2.8" fill="#1a120c"/>
<circle cx="42" cy="40" r="0.9" fill="#fff"/><circle cx="58" cy="40" r="0.9" fill="#fff"/>
<ellipse cx="49" cy="52" rx="3.4" ry="2.4" fill="#3a2418"/>
<path d="M49,54 L49,60 M49,60 Q43,62 40,60 M49,60 Q55,62 58,60" stroke="#7a5436" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<path d="M44,62 L46,68 M54,62 L52,68" stroke="#caa97a" stroke-width="3" stroke-linecap="round"/>`
  ),
  98
);

// ---- BLOSSOM biome ----
// flowering cherry: a soft pink blossom canopy over a pale trunk, with lighter + deeper clusters
save(
  'sakura',
  S(
    '192 222',
    `<defs><radialGradient id="skc" gradientUnits="userSpaceOnUse" cx="96" cy="62" r="104"><stop offset="0" stop-color="#ffe2ef"/><stop offset="0.55" stop-color="#ffb7d4"/><stop offset="1" stop-color="#ef8bbb"/></radialGradient></defs>
<path d="M88,218 C86,168 82,138 80,112 L106,112 C110,140 108,178 104,218 Z" fill="#70605a"/>
<g stroke="#5e4d46" stroke-width="6" fill="none" stroke-linecap="round"><path d="M94,142 C78,122 58,114 44,100"/><path d="M96,150 C112,128 134,120 150,108"/><path d="M95,122 C92,102 90,86 94,68"/></g>
<g fill="url(#skc)"><circle cx="94" cy="74" r="47"/><circle cx="50" cy="86" r="34"/><circle cx="140" cy="84" r="34"/><circle cx="72" cy="50" r="30"/><circle cx="118" cy="52" r="30"/><circle cx="96" cy="38" r="26"/></g>
<g fill="#ffeaf3" opacity="0.6"><circle cx="74" cy="48" r="14"/><circle cx="116" cy="50" r="11"/><circle cx="96" cy="36" r="9"/></g>
<g fill="#ef7cb1" opacity="0.32"><circle cx="58" cy="98" r="13"/><circle cx="132" cy="96" r="13"/><circle cx="96" cy="88" r="11"/></g>
<g fill="#fff4f8"><circle cx="40" cy="74" r="3.5"/><circle cx="156" cy="74" r="3.5"/><circle cx="92" cy="20" r="3.5"/><circle cx="120" cy="34" r="3"/><circle cx="66" cy="34" r="3"/></g>`
  ),
  160
);
// koi (2 frames): a white kohaku with orange patches, a dark spot, barbels (faces right)
const koiSvg = (tf) =>
  S(
    '120 60',
    `<path d="M34,30 L9,${17 + tf} C17,25 17,35 9,${43 + tf} Z" fill="#f2f5f7" opacity="0.95"/>
<path d="M58,15 Q70,3 84,17 Z" fill="#eaedf0" opacity="0.85"/>
<path d="M64,44 Q74,55 84,43 Z" fill="#eaedf0" opacity="0.8"/>
<path d="M30,30 C42,13 70,9 96,16 C107,19 113,24 113,30 C113,36 107,41 96,44 C70,51 42,47 30,30 Z" fill="#fbfdfe"/>
<g fill="#f2882c"><path d="M44,21 C58,15 71,18 73,28 C66,37 51,36 41,31 Z"/><path d="M86,18 C100,17 107,23 104,31 C97,39 86,36 81,28 Z"/></g>
<ellipse cx="65" cy="23" rx="5" ry="4" fill="#2b2b2f"/>
<path d="M86,35 Q93,45 99,36 Z" fill="#eaedf0" opacity="0.7"/>
<path d="M92,18 C96,24 96,36 92,42" stroke="#d8b48d" stroke-width="1.3" fill="none" opacity="0.5"/>
<circle cx="100" cy="26" r="3" fill="#171210"/><circle cx="101" cy="25" r="1" fill="#fff"/>
<g stroke="#e2c4a2" stroke-width="1" opacity="0.7" fill="none"><path d="M112,29 C118,29 120,32 121,34"/><path d="M112,31 C117,33 119,36 119,38"/></g>`
  );
save('koi_a', koiSvg(0), 120);
save('koi_b', koiSvg(7), 120);

// ---- CANYON biome ----
// roadrunner: a streaky desert bird in a running stride — long legs, long up-cocked tail,
// shaggy crest, long beak and a red eye-patch (faces right)
save(
  'roadrunner',
  S(
    '178 120',
    `<defs><linearGradient id="rrb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7e6a52"/><stop offset="1" stop-color="#52422f"/></linearGradient></defs>
<g stroke="#7d6038" stroke-width="4.5" stroke-linecap="round"><line x1="74" y1="80" x2="56" y2="110"/><line x1="92" y1="80" x2="104" y2="108"/></g>
<g stroke="#7d6038" stroke-width="3" stroke-linecap="round" fill="none"><path d="M56,110 L47,113"/><path d="M56,110 L62,116"/><path d="M104,108 L96,112"/><path d="M104,108 L111,113"/></g>
<path d="M52,72 C30,62 14,42 8,18 C24,28 40,44 58,64 Z" fill="url(#rrb)"/>
<path d="M50,78 C28,72 14,58 8,40 C24,46 40,58 56,72 Z" fill="#5c4a36" opacity="0.85"/>
<path d="M48,78 C46,58 70,52 98,55 C118,57 130,64 127,74 C122,84 96,86 72,84 C58,82 50,84 48,78 Z" fill="url(#rrb)"/>
<path d="M58,80 C78,84 104,82 122,73 C102,86 70,88 54,82 Z" fill="#cabb9c" opacity="0.6"/>
<g stroke="#3c3024" stroke-width="1.3" opacity="0.4"><path d="M60,64 L66,76"/><path d="M76,60 L82,74"/><path d="M92,60 L97,73"/><path d="M108,64 L111,74"/></g>
<path d="M116,62 C128,46 144,40 153,46 C148,57 137,61 126,64 Z" fill="url(#rrb)"/>
<ellipse cx="152" cy="44" rx="13" ry="11" fill="url(#rrb)"/>
<path d="M144,32 C140,22 146,15 154,17 C153,24 152,29 153,35 Z" fill="#52422f"/>
<path d="M138,28 C136,20 141,16 147,19 C146,25 145,29 147,33 Z" fill="#52422f"/>
<path d="M162,44 C174,43 180,45 182,47 C178,50 169,49 161,47 Z" fill="#3a3026"/>
<path d="M161,46 L181,47" stroke="#2a2018" stroke-width="0.8" opacity="0.6"/>
<circle cx="154" cy="41" r="2.7" fill="#15110b"/><circle cx="155" cy="40" r="0.9" fill="#fff"/>
<path d="M156,47 C161,48 164,50 163,53" stroke="#bd553a" stroke-width="2.4" fill="none" opacity="0.85" stroke-linecap="round"/>`
  ),
  178
);

// ---- contact sheet of new + polished ----
const review = ['roadrunner'];
const cols = 4,
  cell = 230,
  pad = 14,
  rows = Math.ceil(review.length / cols);
(async () => {
  const comps = [];
  for (let i = 0; i < review.length; i++) {
    const buf = await sharp(`${OUT}/${review[i]}.png`)
      .resize({width: cell - pad * 2, height: cell - pad * 2, fit: 'inside'})
      .toBuffer();
    const m = await sharp(buf).metadata();
    comps.push({
      input: buf,
      left: Math.round((i % cols) * cell + (cell - m.width) / 2),
      top: Math.round(Math.floor(i / cols) * cell + (cell - m.height) / 2)
    });
  }
  await sharp({
    create: {
      width: cols * cell,
      height: rows * cell,
      channels: 3,
      background: '#cfd8e0'
    }
  })
    .composite(comps)
    .png()
    .toFile('/tmp/grove_new.png');
  console.log('rebuilt assets; review sheet -> /tmp/grove_new.png');
})();
