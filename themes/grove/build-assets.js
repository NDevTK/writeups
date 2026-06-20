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
    `<g fill="#46637a">${wings}<ellipse cx="50" cy="50" rx="15" ry="8.5"/><circle cx="63" cy="47" r="6"/></g><path d="M69,47 L78,45 L69,50 Z" fill="#e8a23a"/>`
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
    '90 112',
    `<defs><linearGradient id="rb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8b49a"/><stop offset="1" stop-color="#94795f"/></linearGradient></defs>
<path d="M40,54 C34,28 32,12 39,9 C45,8 47,26 46,48 Z" fill="url(#rb)"/><path d="M53,52 C51,28 53,12 59,11 C65,13 61,30 57,50 Z" fill="url(#rb)"/>
<path d="M40,46 C37,30 37,20 40,16" stroke="#e7b9b0" stroke-width="3" fill="none"/>
<ellipse cx="50" cy="88" rx="26" ry="22" fill="url(#rb)"/><circle cx="50" cy="60" r="18" fill="url(#rb)"/>
<circle cx="74" cy="88" r="9" fill="#efe6d8"/><circle cx="44" cy="58" r="2.4" fill="#111"/>
<path d="M50,64 l-3,3 h6 Z" fill="#b96b78"/><ellipse cx="40" cy="106" rx="13" ry="6" fill="#b8a288"/>`
  ),
  95
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
save(
  'camel',
  S(
    '200 160',
    `<defs><linearGradient id="cm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6ac6a"/><stop offset="1" stop-color="#a87e44"/></linearGradient></defs>
<g stroke="#9a7038" stroke-width="9" stroke-linecap="round"><line x1="72" y1="96" x2="68" y2="150"/><line x1="92" y1="98" x2="92" y2="152"/><line x1="124" y1="98" x2="128" y2="150"/><line x1="142" y1="96" x2="148" y2="148"/></g>
<path d="M58,98 C50,86 60,78 78,76 C86,54 118,54 126,76 C144,78 156,84 156,98 C148,106 80,108 58,98 Z" fill="url(#cm)"/>
<path d="M150,90 C160,74 164,56 168,44 C170,37 180,37 180,46 C180,60 176,76 166,90 Z" fill="url(#cm)"/>
<path d="M176,42 C187,40 193,45 190,51 C187,56 179,54 175,49 Z" fill="url(#cm)"/>
<path d="M174,40 L172,33 L179,38 Z" fill="#a87e44"/><circle cx="182" cy="44" r="2" fill="#1a120a"/>
<path d="M58,92 C50,93 48,101 54,105 C59,101 60,95 60,91 Z" fill="#a87e44"/>`
  ),
  175
);
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

// ---- ALPINE biome ----
save(
  'goat',
  S(
    '180 152',
    `<defs><linearGradient id="gt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5f2ea"/><stop offset="1" stop-color="#ccc4b1"/></linearGradient></defs>
<g stroke="#bbb39e" stroke-width="9" stroke-linecap="round"><line x1="46" y1="92" x2="42" y2="140"/><line x1="66" y1="94" x2="66" y2="142"/><line x1="98" y1="94" x2="102" y2="142"/><line x1="116" y1="92" x2="122" y2="140"/></g>
<g stroke="#3a3026" stroke-width="9" stroke-linecap="round"><line x1="42" y1="137" x2="42" y2="144"/><line x1="66" y1="139" x2="66" y2="146"/><line x1="102" y1="139" x2="102" y2="146"/><line x1="122" y1="137" x2="122" y2="144"/></g>
<path d="M40,96 C32,70 50,54 90,54 C126,54 140,68 140,90 C140,102 118,106 88,106 C58,106 48,106 40,96 Z" fill="url(#gt)"/>
<path d="M40,92 C36,84 38,74 44,70 C46,80 46,88 50,96 Z" fill="#e3ddcd" opacity="0.7"/>
<path d="M132,90 C142,82 148,72 152,62 C154,72 152,84 146,94 Z" fill="url(#gt)"/>
<ellipse cx="151" cy="58" rx="13" ry="15" fill="url(#gt)"/>
<path d="M159,64 C169,66 173,74 167,80 C161,80 157,74 155,68 Z" fill="#e8e2d2"/>
<path d="M147,44 C145,30 147,20 153,16" stroke="#2c241a" stroke-width="4.2" fill="none" stroke-linecap="round"/>
<path d="M155,44 C155,30 159,20 165,16" stroke="#2c241a" stroke-width="4.2" fill="none" stroke-linecap="round"/>
<path d="M155,72 C153,84 151,92 149,97 C147,89 147,79 149,70 Z" fill="#e2dccb"/>
<circle cx="153" cy="56" r="2.4" fill="#1c160e"/><circle cx="163" cy="72" r="1.7" fill="#3a3026"/>`
  ),
  168
);
save(
  'eagle',
  S(
    '150 72',
    `<defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a4632"/><stop offset="1" stop-color="#392a1b"/></linearGradient></defs>
<path d="M72,36 C54,18 32,12 8,18 C18,22 12,28 6,31 C22,28 30,32 42,35 C54,40 65,40 72,38 Z" fill="url(#eg)"/>
<path d="M72,36 C90,18 112,12 136,18 C126,22 132,28 138,31 C122,28 114,32 102,35 C90,40 79,40 72,38 Z" fill="url(#eg)"/>
<g fill="#2c2114"><path d="M8,18 l-7,1 l6,4 Z"/><path d="M136,18 l7,1 l-6,4 Z"/></g>
<ellipse cx="72" cy="38" rx="9" ry="14" fill="url(#eg)"/>
<path d="M64,49 L80,49 L72,62 Z" fill="#f1ede4"/>
<circle cx="72" cy="26" r="7.5" fill="#f1ede4"/>
<path d="M72,20 L72,11 L77,20 Z" fill="#e7b53f"/>
<circle cx="70" cy="25" r="1.5" fill="#1a1a1a"/>`
  ),
  132
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
save(
  'giraffe',
  S(
    '214 322',
    `<defs><linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eec670"/><stop offset="1" stop-color="#cf9e44"/></linearGradient></defs>
<g stroke="#d4a44a" stroke-width="15" stroke-linecap="round"><line x1="70" y1="170" x2="64" y2="304"/><line x1="98" y1="172" x2="98" y2="306"/><line x1="126" y1="172" x2="130" y2="306"/><line x1="150" y1="170" x2="158" y2="302"/></g>
<g stroke="#4a3520" stroke-width="15" stroke-linecap="round"><line x1="64" y1="296" x2="64" y2="305"/><line x1="98" y1="298" x2="98" y2="307"/><line x1="130" y1="298" x2="130" y2="307"/><line x1="158" y1="294" x2="158" y2="303"/></g>
<path d="M52,150 C42,162 40,182 46,194" stroke="#cf9e44" stroke-width="6" fill="none" stroke-linecap="round"/><line x1="46" y1="190" x2="43" y2="202" stroke="#4a3520" stroke-width="6" stroke-linecap="round"/>
<path d="M46,166 C40,128 70,106 112,104 C154,102 178,118 178,150 C178,174 136,184 98,184 C72,184 54,178 46,166 Z" fill="url(#gf)"/>
<path d="M146,126 C158,90 166,54 174,30" stroke="url(#gf)" stroke-width="31" fill="none" stroke-linecap="round"/>
<path d="M158,114 C167,80 175,46 182,24" stroke="#9c6f34" stroke-width="7" fill="none" stroke-linecap="round"/>
<path d="M164,32 C158,18 168,8 182,9 C194,10 200,18 197,28 C204,30 207,37 202,43 C195,49 178,48 171,42 C165,38 164,35 164,32 Z" fill="url(#gf)"/>
<g stroke="#7a5a30" stroke-width="4.5" stroke-linecap="round"><line x1="175" y1="11" x2="173" y2="1"/><line x1="189" y1="11" x2="191" y2="1"/></g>
<circle cx="173" cy="1" r="4" fill="#5a4326"/><circle cx="191" cy="1" r="4" fill="#5a4326"/>
<circle cx="180" cy="28" r="2.6" fill="#3a2a16"/>
<g fill="#a9742f" opacity="0.85"><path d="M60,138 l18,-4 l7,17 l-17,5 Z"/><path d="M94,150 l19,-2 l5,17 l-19,4 Z"/><path d="M126,138 l18,-2 l6,17 l-18,5 Z"/><path d="M150,158 l17,0 l2,15 l-17,2 Z"/><path d="M154,90 l14,-2 l3,15 l-14,3 Z"/><path d="M161,56 l12,-2 l3,13 l-12,3 Z"/><path d="M167,30 l10,-2 l2,10 l-10,2 Z"/></g>`
  ),
  202
);
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
save(
  'vulture',
  S(
    '156 74',
    `<defs><linearGradient id="vu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3e34"/><stop offset="1" stop-color="#2c241c"/></linearGradient></defs>
<path d="M76,38 C58,22 38,16 14,18 C22,22 18,26 12,28 C24,27 28,30 36,33 C28,34 22,36 18,37 C30,39 42,39 52,40 C62,41 70,41 76,40 Z" fill="url(#vu)"/>
<path d="M76,38 C94,22 114,16 138,18 C130,22 134,26 140,28 C128,27 124,30 116,33 C124,34 130,36 134,37 C122,39 110,39 100,40 C90,41 82,41 76,40 Z" fill="url(#vu)"/>
<ellipse cx="76" cy="40" rx="9" ry="13" fill="url(#vu)"/>
<path d="M68,50 L84,50 L76,60 Z" fill="#241d16"/>
<circle cx="76" cy="28" r="5.5" fill="#caa9a0"/>
<path d="M76,24 L76,17 L80,24 Z" fill="#3a2a1a"/>
<circle cx="74" cy="27" r="1.3" fill="#1a1a1a"/>`
  ),
  134
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
save(
  'panda',
  S(
    '200 150',
    `
<g stroke="#2a2a2a" stroke-width="13" stroke-linecap="round"><line x1="66" y1="96" x2="62" y2="138"/><line x1="92" y1="98" x2="92" y2="140"/><line x1="120" y1="98" x2="124" y2="140"/><line x1="144" y1="96" x2="150" y2="138"/></g>
<path d="M52,98 C44,68 72,52 110,52 C150,52 168,64 168,90 C168,106 138,110 104,110 C74,110 60,110 52,98 Z" fill="#f4f2ee"/>
<path d="M148,56 C164,60 170,74 168,92 C162,104 150,108 140,108 C150,92 150,72 148,56 Z" fill="#2a2a2a"/>
<circle cx="166" cy="64" r="24" fill="#f4f2ee"/>
<circle cx="156" cy="44" r="10" fill="#2a2a2a"/>
<ellipse cx="172" cy="60" rx="8" ry="10" fill="#2a2a2a"/>
<circle cx="174" cy="60" r="2.6" fill="#fff"/><circle cx="174" cy="61" r="1.4" fill="#1a1a1a"/>
<path d="M186,66 C194,68 196,76 189,80 C183,80 181,72 182,68 Z" fill="#f4f2ee"/>
<ellipse cx="190" cy="72" rx="3.6" ry="2.6" fill="#2a2a2a"/>
<path d="M52,86 C42,86 38,96 44,102 C50,98 54,92 58,90 Z" fill="#f4f2ee"/>`
  ),
  180
);
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

// ---- contact sheet of new + polished ----
const review = ['giraffe'];
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
