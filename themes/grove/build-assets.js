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

// ---- snow overlays: drawn on the SAME canvas as the green tree so they register exactly when
//      laid over it as a child sprite, settling on the branches and swaying with the tree ----
save(
  'pine_snow',
  S(
    '140 220',
    `
<g fill="#e7eff9">
<path d="M70,18 L86,49 C83,55 77,53 70,54 C63,53 57,55 54,49 Z"/>
<path d="M70,58 L91,93 C87,100 79,97 70,98 C61,97 53,100 49,93 Z"/>
<path d="M70,104 L94,142 C89,150 80,147 70,148 C60,147 51,150 46,142 Z"/></g>
<g fill="#ffffff">
<path d="M70,20 L80,40 C78,44 74,43 70,43 C66,43 62,44 60,40 Z"/>
<path d="M70,60 L83,82 C80,86 75,85 70,85 C65,85 60,86 57,82 Z"/>
<path d="M70,106 L86,132 C82,137 76,136 70,136 C64,136 58,137 54,132 Z"/></g>`
  ),
  120
);
save(
  'oak_snow',
  S(
    '180 210',
    `
<path fill="#e7eff9" d="M46,64 C50,42 64,30 78,34 C86,18 102,18 110,32 C126,30 136,46 132,64 C126,57 118,59 112,66 C106,55 96,57 90,66 C82,56 72,58 66,66 C58,57 50,59 46,64 Z"/>
<path fill="#ffffff" d="M72,38 C82,24 100,24 108,36 C100,33 92,37 86,43 C80,35 76,36 72,38 Z"/>`
  ),
  150
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

// snow settled over the bush crown (overlaid as a child, same registration as 'bush')
save(
  'bush_snow',
  S(
    '178 86',
    `
<path fill="#e7eff9" d="M30,54 C34,36 48,30 60,34 C70,18 92,16 104,28 C116,20 132,30 138,50 C130,44 122,46 116,54 C108,42 96,44 88,54 C78,42 66,44 58,54 C48,44 38,46 30,54 Z"/>
<path fill="#ffffff" opacity="0.8" d="M68,34 C80,22 98,24 106,34 C98,31 90,35 84,41 C78,33 73,33 68,34 Z"/>`
  ),
  150
);

// snow for the new trees — same canvas/registration as each, so it settles on their crowns/tiers
save(
  'birch_snow',
  S(
    '130 210',
    `<path fill="#e7eff9" d="M39,50 C43,33 56,25 68,29 C76,15 92,15 98,29 C110,27 117,39 113,52 C106,45 98,47 91,54 C84,44 75,46 69,54 C61,45 51,47 45,54 C42,52 39,52 39,50 Z"/>
<path fill="#ffffff" opacity="0.7" d="M62,27 C70,15 86,15 94,27 C86,23 78,27 72,33 C67,25 64,26 62,27 Z"/>`
  ),
  120
);
save(
  'fir_snow',
  S(
    '140 224',
    `<g fill="#e7eff9">
<path d="M70,12 C76,26 82,36 90,46 C82,42 76,44 70,44 C64,44 58,42 50,46 C58,36 64,26 70,12 Z"/>
<path d="M70,46 C77,60 84,70 94,80 C84,75 77,77 70,77 C63,77 56,75 46,80 C56,70 63,60 70,46 Z"/>
<path d="M70,82 C78,98 86,110 98,120 C86,114 78,116 70,116 C62,116 54,114 42,120 C54,110 62,98 70,82 Z"/></g>
<g fill="#ffffff" opacity="0.7">
<path d="M70,16 C74,26 78,34 84,42 C77,38 73,40 70,40 C67,40 63,38 56,42 C62,34 66,26 70,16 Z"/>
<path d="M70,50 C75,62 80,71 88,79 C80,74 74,76 70,76 C66,76 60,74 52,79 C60,71 65,62 70,50 Z"/></g>`
  ),
  120
);
save(
  'poplar_snow',
  S(
    '80 232',
    `<path fill="#e7eff9" d="M40,8 C50,28 55,46 56,66 C50,58 44,58 40,60 C36,58 30,58 24,66 C25,46 30,28 40,8 Z"/>
<path fill="#ffffff" opacity="0.7" d="M40,12 C46,28 50,42 51,56 C46,48 42,50 40,52 C38,50 34,48 29,56 C30,42 34,28 40,12 Z"/>`
  ),
  70
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

// ---- POLAR biome (penguin, tabular iceberg, orca) ----
// gentoo-ish penguin standing upright: black back + head, white front, orange beak + webbed
// feet, a pale bonnet patch around the eye (faces right; the engine rocks it for a waddle)
save(
  'penguin',
  S(
    '96 136',
    `<defs><linearGradient id="pgb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c3542"/><stop offset="1" stop-color="#0e1219"/></linearGradient></defs>
<g fill="#f2a73c"><path d="M38,118 C30,117 22,122 26,128 C33,131 44,128 47,123 Z"/><path d="M54,119 C62,117 71,122 66,128 C59,131 49,128 47,123 Z"/></g>
<path d="M24,104 C15,114 16,122 26,118 C32,114 33,106 32,100 Z" fill="#12161d"/>
<path d="M26,92 C16,66 22,30 40,18 C54,9 70,16 72,36 C77,60 74,94 62,112 C53,124 34,122 26,92 Z" fill="url(#pgb)"/>
<path d="M28,46 C16,58 17,88 28,102 C33,92 33,60 32,48 Z" fill="#161b23"/>
<path d="M44,28 C60,32 62,74 55,100 C50,114 39,113 35,100 C31,76 34,38 44,28 Z" fill="#f4f8fb"/>
<path d="M52,24 C64,24 67,40 56,46 C47,47 44,32 52,24 Z" fill="#eaf2f8"/>
<circle cx="56" cy="33" r="2.7" fill="#0d1118"/><circle cx="57" cy="32" r="0.9" fill="#fff"/>
<path d="M60,37 C73,35 80,40 77,45 C70,48 63,45 60,43 Z" fill="#f2a73c"/>
<path d="M60,41 L77,43" stroke="#c97f24" stroke-width="0.9" opacity="0.7"/>`
  ),
  96
);
// tabular iceberg on the polar horizon: flat-topped ice block with a sunlit cap, a shaded
// face and a waterline shadow — a discrete landform, so a designed sprite (light + tintable)
save(
  'iceberg',
  S(
    '224 152',
    `<defs><linearGradient id="ibg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fcfdff"/><stop offset="1" stop-color="#d3e4ef"/></linearGradient></defs>
<path d="M10,152 L18,78 L52,58 L108,50 L168,56 L206,82 L214,152 Z" fill="url(#ibg)"/>
<path d="M18,78 L52,58 L108,50 L168,56 L138,74 L64,80 Z" fill="#ffffff" opacity="0.92"/>
<path d="M168,56 L206,82 L214,152 L176,152 L166,80 Z" fill="#a6c4d7" opacity="0.85"/>
<path d="M10,152 L10,138 L214,138 L214,152 Z" fill="#93b6cc" opacity="0.55"/>
<g stroke="#bdd7e5" stroke-width="2" opacity="0.7" fill="none"><path d="M64,80 L78,134"/><path d="M112,62 L120,136"/></g>`
  ),
  224
);
// orca surfacing: black body with a tall dorsal fin, white eye-patch, belly and grey saddle
// (faces right; reuses the dolphin porpoise mechanic, so anchored at its centre like the dolphin)
save(
  'orca',
  S(
    '192 106',
    `<defs><linearGradient id="orb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b212a"/><stop offset="1" stop-color="#05070b"/></linearGradient></defs>
<path d="M60,64 C56,82 72,90 82,82 C73,73 65,67 60,64 Z" fill="#0b0e13"/>
<path d="M12,60 C38,44 88,34 136,40 C154,42 170,48 180,55 C170,58 158,58 148,57 C158,67 166,77 170,90 C151,81 139,71 129,65 C93,71 47,73 24,69 C14,67 9,63 12,60 Z" fill="url(#orb)"/>
<path d="M64,38 C70,6 94,8 100,36 C88,32 76,33 64,38 Z" fill="#10141b"/>
<path d="M98,40 C112,40 122,45 124,52 C112,48 102,48 94,50 Z" fill="#5a6571" opacity="0.65"/>
<path d="M42,68 C86,74 122,69 148,57 C122,73 80,75 48,71 Z" fill="#eef3f6"/>
<ellipse cx="152" cy="50" rx="9" ry="5.2" fill="#eef3f6" transform="rotate(-13 152 50)"/>
<circle cx="158" cy="52" r="2.3" fill="#090b0f"/>
<path d="M150,53 C163,51 174,54 178,57 C172,59 161,58 150,57 Z" fill="#161b22"/>`
  ),
  192
);

// ---- GLADE biome (bioluminescent mushrooms) ----
// kept white/pale so the engine tints each cluster to its glow colour (like the cave crystals):
// a tall trio of toadstools with luminous caps, pale stems, faint spots and an under-cap gill line
save(
  'mushroom_a',
  S(
    '120 134',
    `<defs><radialGradient id="mca" cx="50%" cy="36%"><stop offset="0" stop-color="#ffffff"/><stop offset="0.68" stop-color="#e2f4f5"/><stop offset="1" stop-color="#bfe2e4"/></radialGradient></defs>
<path d="M25,124 C23,110 22,100 26,94 L35,94 C38,102 37,112 35,124 Z" fill="#e7f3f4"/>
<ellipse cx="30" cy="92" rx="18" ry="10.5" fill="url(#mca)"/>
<path d="M86,128 C84,110 83,98 87,86 L98,86 C101,98 99,112 97,128 Z" fill="#e7f3f4"/>
<ellipse cx="92" cy="84" rx="21" ry="12.5" fill="url(#mca)"/>
<path d="M54,130 C51,104 50,84 55,70 L67,70 C73,84 71,106 68,130 Z" fill="#eef7f7"/>
<ellipse cx="60" cy="62" rx="29" ry="16" fill="url(#mca)"/>
<path d="M36,57 Q60,46 84,57 Q60,53 36,57 Z" fill="#ffffff" opacity="0.7"/>
<path d="M33,64 Q60,74 87,64" stroke="#a9d6d9" stroke-width="2" fill="none" opacity="0.6"/>
<g fill="#ffffff" opacity="0.85"><circle cx="52" cy="59" r="3"/><circle cx="70" cy="57" r="2.4"/><circle cx="63" cy="65" r="1.9"/><circle cx="27" cy="90" r="1.8"/><circle cx="95" cy="82" r="2"/></g>`
  ),
  120
);
// a big domed-cap toadstool with two babies (same pale, tintable palette)
save(
  'mushroom_b',
  S(
    '116 122',
    `<defs><radialGradient id="mcb" cx="50%" cy="34%"><stop offset="0" stop-color="#ffffff"/><stop offset="0.68" stop-color="#e2f4f5"/><stop offset="1" stop-color="#bfe2e4"/></radialGradient></defs>
<path d="M12,112 C10,102 10,96 13,92 L21,92 C24,98 23,106 22,112 Z" fill="#e7f3f4"/>
<ellipse cx="17" cy="92" rx="13" ry="8" fill="url(#mcb)"/>
<path d="M94,116 C92,106 92,100 95,96 L102,96 C105,102 104,110 103,116 Z" fill="#e7f3f4"/>
<ellipse cx="98" cy="96" rx="11" ry="7" fill="url(#mcb)"/>
<path d="M48,116 C44,92 44,72 51,58 L66,58 C73,74 72,98 67,116 Z" fill="#eef7f7"/>
<path d="M22,60 C26,32 90,32 94,60 C70,66 46,66 22,60 Z" fill="url(#mcb)"/>
<path d="M22,60 C46,68 70,68 94,60 C70,64 46,64 22,60 Z" fill="#bfe6e8" opacity="0.7"/>
<g fill="#ffffff" opacity="0.85"><circle cx="42" cy="50" r="3.4"/><circle cx="62" cy="46" r="2.8"/><circle cx="76" cy="52" r="2.6"/><circle cx="54" cy="54" r="2.2"/></g>`
  ),
  116
);

// ---- GLADE owl (2 wing frames): glides through the twilight on slow beats ----
// muted cool greys so it sits in the dim glade, with a pale facial disc and big luminous eyes;
// head turned to face the viewer (owl-style) while the body glides right. up = wings raised.
const owl = (up) =>
  S(
    '152 104',
    `<defs><linearGradient id="owb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c7e84"/><stop offset="1" stop-color="#565a61"/></linearGradient></defs>
<path d="M34,62 C20,58 13,64 18,73 C27,75 33,70 39,65 Z" fill="#5c5f64"/>
${
  up
    ? `<path d="M62,54 C46,28 28,20 12,25 C25,35 41,49 56,62 C60,60 61,57 62,54 Z" fill="#6e7177"/>
<g stroke="#4f5258" stroke-width="1.2" opacity="0.5"><path d="M22,28 L40,46"/><path d="M33,24 L48,44"/></g>`
    : `<path d="M62,66 C46,86 28,92 12,86 C25,78 41,68 56,60 C60,62 61,64 62,66 Z" fill="#5a5d63"/>
<g stroke="#4f5258" stroke-width="1.2" opacity="0.5"><path d="M22,84 L40,66"/><path d="M33,88 L48,68"/></g>`
}
<ellipse cx="68" cy="62" rx="33" ry="23" fill="url(#owb)"/>
<g fill="#494c52" opacity="0.4"><circle cx="58" cy="60" r="2"/><circle cx="72" cy="66" r="2"/><circle cx="64" cy="70" r="1.8"/><circle cx="80" cy="62" r="1.8"/></g>
<path d="M92,28 C90,16 96,15 100,25 Z" fill="#54575c"/>
<path d="M120,28 C122,16 116,15 112,25 Z" fill="#54575c"/>
<circle cx="106" cy="50" r="26" fill="url(#owb)"/>
<path d="M106,28 C127,28 129,58 106,69 C83,58 85,28 106,28 Z" fill="#dfe2d4"/>
<circle cx="95" cy="48" r="11" fill="#eaffb0" opacity="0.35"/><circle cx="117" cy="48" r="11" fill="#eaffb0" opacity="0.35"/>
<circle cx="95" cy="48" r="9" fill="#eaffb0"/><circle cx="117" cy="48" r="9" fill="#eaffb0"/>
<circle cx="96" cy="49" r="4.6" fill="#1c1810"/><circle cx="118" cy="49" r="4.6" fill="#1c1810"/>
<circle cx="97" cy="47" r="1.4" fill="#fff"/><circle cx="119" cy="47" r="1.4" fill="#fff"/>
<path d="M106,55 L101,63 L111,63 Z" fill="#c98f33"/>`
  );
save('owl_a', owl(true), 152);
save('owl_b', owl(false), 152);

// ---- distant whale (coast / polar / fjord): surfaces far out, blows, then dives ----
// just the exposed back breaking the surface (flat bottom sits at the waterline): a long low
// arch with a small dorsal hump, a blowhole bump near the head, a wet sheen and some mottling
save(
  'whale_back',
  S(
    '200 64',
    `<defs><linearGradient id="whb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a6b78"/><stop offset="1" stop-color="#2c3a45"/></linearGradient></defs>
<path d="M8,60 C20,40 60,30 110,28 C150,27 178,34 192,46 C196,50 196,56 194,60 Z" fill="url(#whb)"/>
<path d="M126,30 C132,18 144,18 148,30 C140,29 132,29 126,30 Z" fill="#3a4a55"/>
<path d="M176,36 C180,30 186,30 188,36 C184,35 180,35 176,36 Z" fill="#3a4a55"/>
<path d="M30,42 C70,33 120,32 170,40 C120,37 72,38 34,46 Z" fill="#8aa0ad" opacity="0.5"/>
<g fill="#46545f" opacity="0.5"><circle cx="70" cy="42" r="2.4"/><circle cx="100" cy="38" r="2"/><circle cx="140" cy="42" r="2.2"/></g>`
  ),
  200
);
// tail flukes lifting for the dive — roughly symmetric so it mirrors cleanly; flat bottom at the waterline
save(
  'whale_fluke',
  S(
    '120 92',
    `<defs><linearGradient id="whf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a6b78"/><stop offset="1" stop-color="#2c3a45"/></linearGradient></defs>
<path d="M54,92 C52,72 54,58 60,52 L64,52 C70,58 70,74 68,92 Z" fill="url(#whf)"/>
<path d="M61,54 C45,42 25,38 9,42 C23,48 41,54 59,60 Z" fill="url(#whf)"/>
<path d="M63,54 C79,42 99,38 115,42 C101,48 83,54 65,60 Z" fill="url(#whf)"/>
<path d="M59,55 L65,55 L62,60 Z" fill="#22303a"/>
<g fill="#8aa0ad" opacity="0.4"><path d="M15,43 C31,46 47,51 59,57 C45,51 29,47 15,45 Z"/><path d="M105,43 C89,46 73,51 61,57 C77,51 93,47 105,45 Z"/></g>
<g fill="#bcd3dd" opacity="0.7"><circle cx="21" cy="48" r="1.4"/><circle cx="99" cy="48" r="1.4"/><circle cx="41" cy="56" r="1.2"/></g>`
  ),
  120
);

// ======== NEW SPRITE VARIANTS: more trees, flowers and a second butterfly ========

// birch — a slim white-barked, airy deciduous to break up the oaks
save(
  'birch',
  S(
    '130 210',
    `
<defs><radialGradient id="bch" cx="50%" cy="36%" r="64%"><stop offset="0" stop-color="#c4e67d"/><stop offset=".6" stop-color="#86c24a"/><stop offset="1" stop-color="#5a9636"/></radialGradient></defs>
<path d="M60,208 C58,150 57,104 62,58 L72,58 C76,104 74,150 70,208 Z" fill="#eef1ea"/>
<path d="M64,60 C60,104 61,154 62,206" stroke="#d2d9cd" stroke-width="1.6" fill="none"/>
<g fill="#39403a"><path d="M57,92 h10 v3.2 h-10 z"/><path d="M66,118 h7 v2.6 h-7 z"/><path d="M58,146 h10 v3.2 h-10 z"/><path d="M66,172 h7 v2.6 h-7 z"/><path d="M60,196 h6 v2.4 h-6 z"/></g>
<g stroke="#cdd4c8" stroke-width="2" fill="none" stroke-linecap="round"><path d="M64,74 C54,66 47,60 41,52"/><path d="M68,80 C78,72 86,66 92,58"/></g>
<g fill="url(#bch)"><circle cx="64" cy="44" r="25"/><circle cx="40" cy="55" r="19"/><circle cx="88" cy="55" r="19"/><circle cx="52" cy="30" r="17"/><circle cx="78" cy="32" r="16"/><circle cx="66" cy="20" r="14"/></g>
<g fill="#d8f094" opacity="0.55"><circle cx="54" cy="33" r="8"/><circle cx="75" cy="35" r="7"/><circle cx="65" cy="22" r="6"/></g>`
  ),
  120
);

// fir — a fuller, cooler conifer with soft drooping tiers, distinct from the sharp pine
save(
  'fir',
  S(
    '140 224',
    `
<defs><linearGradient id="fr" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0" stop-color="#5aa46a"/><stop offset="1" stop-color="#1b5440"/></linearGradient></defs>
<rect x="64" y="190" width="12" height="34" rx="3" fill="#664527"/>
<g fill="url(#fr)">
<path d="M70,14 C78,30 86,40 96,50 C84,46 76,48 70,48 C64,48 56,46 44,50 C54,40 62,30 70,14 Z"/>
<path d="M70,44 C80,62 90,74 104,86 C88,80 78,82 70,82 C62,82 52,80 36,86 C50,74 60,62 70,44 Z"/>
<path d="M70,78 C82,98 94,112 112,126 C92,118 80,120 70,120 C60,120 48,118 28,126 C46,112 58,98 70,78 Z"/>
<path d="M70,114 C84,136 98,152 120,168 C96,158 82,160 70,160 C58,160 44,158 20,168 C42,152 56,136 70,114 Z"/>
<path d="M70,152 C86,176 102,194 128,210 C100,198 84,200 70,200 C56,200 36,198 12,210 C38,194 54,176 70,152 Z"/></g>
<g fill="#7cc086" opacity="0.4"><path d="M70,18 C76,32 82,41 90,49 C80,45 74,47 70,47 Z"/><path d="M70,48 C78,64 86,74 98,84 C86,79 76,81 70,81 Z"/><path d="M70,82 C80,100 90,113 104,124 C90,117 78,119 70,119 Z"/></g>`
  ),
  120
);

// poplar — a tall narrow column (Lombardy), great for lining a far bank or breaking the skyline
save(
  'poplar',
  S(
    '80 232',
    `
<defs><linearGradient id="pop" x1="0" y1="0" x2="1" y2="0.6"><stop offset="0" stop-color="#82bc4c"/><stop offset="1" stop-color="#3a7830"/></linearGradient></defs>
<rect x="36" y="150" width="8" height="80" rx="3" fill="#664527"/>
<path d="M40,6 C58,40 64,72 62,110 C61,142 54,170 40,198 C26,170 19,142 18,110 C16,72 22,40 40,6 Z" fill="url(#pop)"/>
<path d="M40,12 C52,44 57,72 55,106 C50,80 45,52 40,32 Z" fill="#a4d66a" opacity="0.45"/>
<path d="M40,32 C44,64 48,98 50,134 C47,162 44,182 40,198 C40,150 40,92 40,32 Z" fill="#2f6328" opacity="0.4"/>`
  ),
  70
);

// flower variants — genuinely different shapes, not just a recolour of the round bloom
save(
  'flower_y',
  S(
    '40 60',
    `<path d="M20,58 L20,28" stroke="#4f9c34" stroke-width="3"/>
<g fill="#fbf3d4">
<ellipse cx="20" cy="9" rx="3.2" ry="8"/>
<ellipse cx="20" cy="9" rx="3.2" ry="8" transform="rotate(45 20 19)"/>
<ellipse cx="20" cy="9" rx="3.2" ry="8" transform="rotate(90 20 19)"/>
<ellipse cx="20" cy="9" rx="3.2" ry="8" transform="rotate(135 20 19)"/>
<ellipse cx="20" cy="9" rx="3.2" ry="8" transform="rotate(180 20 19)"/>
<ellipse cx="20" cy="9" rx="3.2" ry="8" transform="rotate(225 20 19)"/>
<ellipse cx="20" cy="9" rx="3.2" ry="8" transform="rotate(270 20 19)"/>
<ellipse cx="20" cy="9" rx="3.2" ry="8" transform="rotate(315 20 19)"/></g>
<circle cx="20" cy="19" r="5.5" fill="#eaa72e"/><circle cx="18.5" cy="17.5" r="2.6" fill="#f6d36a"/>`
  ),
  44
);
save(
  'flower_b',
  S(
    '40 60',
    `<path d="M20,58 L20,22" stroke="#3f7a2e" stroke-width="3"/>
<path d="M20,40 C11,39 8,32 11,28 C14,34 20,36 20,40 Z" fill="#3f7a2e"/>
<g fill="#6f86dd">
<circle cx="20" cy="20" r="3.6"/>
<circle cx="15.5" cy="26" r="3.8"/><circle cx="24.5" cy="26" r="3.8"/>
<circle cx="13" cy="33" r="4.2"/><circle cx="20" cy="32" r="4.2"/><circle cx="27" cy="33" r="4.2"/>
<circle cx="14.5" cy="40" r="3.8"/><circle cx="25.5" cy="40" r="3.8"/></g>
<g fill="#9fb1f0" opacity="0.6"><circle cx="18" cy="24" r="1.8"/><circle cx="22" cy="30" r="1.8"/><circle cx="17" cy="37" r="1.6"/></g>`
  ),
  44
);
save(
  'tulip',
  S(
    '40 60',
    `<path d="M20,58 L20,30" stroke="#3f8a2e" stroke-width="3.5"/>
<path d="M20,42 C10,40 8,31 12,27 C15,35 20,37 20,42 Z" fill="#3f8a2e"/>
<path d="M12,22 C12,13 16,7 20,7 C24,7 28,13 28,22 C28,28 24,31 20,31 C16,31 12,28 12,22 Z" fill="#e0556a"/>
<path d="M20,8 C18,14 18,24 20,31 C22,24 22,14 20,8 Z" fill="#c33f54" opacity="0.5"/>
<path d="M12.5,22 C14,16 16,11 20,8 C18,15 17,22 18,29 Z" fill="#f3899a" opacity="0.6"/>`
  ),
  44
);

// swallowtail — a second butterfly with a real different silhouette (tails) and pattern, not a tint
save(
  'swallow_a',
  S(
    '84 74',
    `<g fill="#f4cf4a">
<ellipse cx="27" cy="28" rx="18" ry="13"/><ellipse cx="57" cy="28" rx="18" ry="13"/>
<path d="M33,40 C27,52 24,60 27,67 L33,58 L37,67 L41,55 Z"/>
<path d="M51,40 C57,52 60,60 57,67 L51,58 L47,67 L43,55 Z"/></g>
<g stroke="#2b2418" stroke-width="2.6" fill="none" stroke-linecap="round">
<path d="M17,18 C16,26 18,34 23,39"/><path d="M28,15 C26,25 28,34 31,40"/>
<path d="M67,18 C68,26 66,34 61,39"/><path d="M56,15 C58,25 56,34 53,40"/></g>
<g fill="#3f86c6"><circle cx="33" cy="58" r="2.6"/><circle cx="51" cy="58" r="2.6"/></g>
<circle cx="42" cy="60" r="2.2" fill="#e07a2e"/>
<ellipse cx="42" cy="40" rx="2.8" ry="17" fill="#241c12"/><circle cx="42" cy="22" r="3" fill="#241c12"/>`
  ),
  84
);
save(
  'swallow_b',
  S(
    '84 74',
    `<g fill="#eac43e">
<ellipse cx="36" cy="28" rx="9" ry="13"/><ellipse cx="48" cy="28" rx="9" ry="13"/>
<path d="M39,40 C36,52 35,60 37,67 L41,57 Z"/><path d="M45,40 C48,52 49,60 47,67 L43,57 Z"/></g>
<g stroke="#2b2418" stroke-width="2.2" fill="none" stroke-linecap="round"><path d="M33,18 C32,26 33,34 37,40"/><path d="M51,18 C52,26 51,34 47,40"/></g>
<ellipse cx="42" cy="40" rx="2.8" ry="17" fill="#241c12"/><circle cx="42" cy="22" r="3" fill="#241c12"/>`
  ),
  84
);

// willow — a weeping form for the water's edge, with a curtain of drooping fronds
save(
  'willow',
  S(
    '160 200',
    `<defs><linearGradient id="wil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fc857"/><stop offset="1" stop-color="#5a9438"/></linearGradient></defs>
<rect x="72" y="116" width="14" height="84" rx="4" fill="#6b4a30"/>
<ellipse cx="79" cy="72" rx="60" ry="38" fill="url(#wil)"/>
<g fill="none" stroke-linecap="round">
<g stroke="#6ba33f" stroke-width="5">
<path d="M30,80 C28,106 31,130 28,156"/><path d="M46,94 C44,122 47,148 44,174"/><path d="M62,102 C60,132 63,160 60,186"/><path d="M79,104 C77,136 80,164 78,190"/><path d="M96,102 C98,132 95,160 98,186"/><path d="M112,94 C114,122 111,148 114,174"/><path d="M128,80 C130,106 127,130 130,156"/></g>
<g stroke="#a6d165" stroke-width="2.5" opacity="0.6"><path d="M38,86 C36,110 39,132 37,154"/><path d="M70,104 C68,134 71,160 69,184"/><path d="M104,98 C106,126 103,150 105,176"/></g></g>`
  ),
  135
);
save(
  'willow_snow',
  S(
    '160 200',
    `<path fill="#e7eff9" d="M24,72 C30,52 52,40 79,40 C106,40 128,52 134,72 C124,62 110,62 100,70 C90,58 70,58 60,70 C50,62 34,62 24,72 Z"/>
<path fill="#ffffff" opacity="0.7" d="M48,52 C62,44 96,44 110,52 C98,48 86,52 79,58 C72,52 60,48 48,52 Z"/>`
  ),
  135
);

// dead snag — a bare, weathered standing trunk for a bit of character (good year-round)
save(
  'snag',
  S(
    '120 210',
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">
<path d="M52,208 C50,150 53,96 59,46" stroke="#9a8a72" stroke-width="13"/>
<path d="M53,200 C51,150 54,98 59,50" stroke="#bcad92" stroke-width="5"/>
<g stroke="#9a8a72" stroke-width="6"><path d="M56,98 C44,86 36,76 26,68"/><path d="M58,74 C70,64 78,54 88,48"/><path d="M55,130 C45,122 39,114 32,102"/><path d="M59,58 C58,46 60,36 64,26"/></g>
<g stroke="#9a8a72" stroke-width="3.5"><path d="M30,70 C24,64 20,58 17,50"/><path d="M86,50 C92,44 96,38 98,30"/><path d="M33,104 C28,98 25,92 23,84"/></g></g>`
  ),
  105
);

// flowering shrub — a denser, blossom-flecked bush variant
save(
  'shrub',
  S(
    '160 92',
    `<defs><radialGradient id="shr" gradientUnits="userSpaceOnUse" cx="60" cy="34" r="92"><stop offset="0" stop-color="#7eba48"/><stop offset="1" stop-color="#316a1e"/></radialGradient></defs>
<g fill="url(#shr)"><ellipse cx="38" cy="66" rx="32" ry="17"/><ellipse cx="84" cy="68" rx="40" ry="19"/><ellipse cx="126" cy="66" rx="30" ry="16"/><circle cx="52" cy="50" r="22"/><circle cx="92" cy="46" r="25"/><circle cx="124" cy="52" r="18"/></g>
<g fill="#f6e9f0"><circle cx="44" cy="46" r="3.4"/><circle cx="64" cy="40" r="3"/><circle cx="86" cy="38" r="3.4"/><circle cx="106" cy="44" r="3"/><circle cx="120" cy="52" r="3"/><circle cx="34" cy="60" r="3"/><circle cx="74" cy="56" r="3"/><circle cx="100" cy="58" r="3.2"/></g>
<g fill="#e6b0c8"><circle cx="54" cy="52" r="2"/><circle cx="94" cy="48" r="2"/><circle cx="116" cy="58" r="1.8"/></g>`
  ),
  140
);

// poppy — broad red petals with a dark heart, a distinct bloom from the round flower
save(
  'poppy',
  S(
    '40 60',
    `<path d="M20,58 C18,46 19,38 20,26" stroke="#4f8a35" stroke-width="2.5" fill="none"/>
<g fill="#e0392f"><ellipse cx="20" cy="13" rx="9" ry="8"/><ellipse cx="12" cy="20" rx="8" ry="7"/><ellipse cx="28" cy="20" rx="8" ry="7"/><ellipse cx="20" cy="25" rx="9" ry="6"/></g>
<g fill="#c22b22" opacity="0.5"><ellipse cx="13" cy="20" rx="5" ry="4"/><ellipse cx="27" cy="20" rx="5" ry="4"/></g>
<circle cx="20" cy="19" r="4.2" fill="#241410"/>
<g fill="#3a241a"><circle cx="17" cy="17" r="1"/><circle cx="23" cy="17" r="1"/><circle cx="20" cy="21.5" r="1"/></g>`
  ),
  44
);

// female mallard — mottled brown plumage, brown head, orange bill (a real plumage, not a tint)
save(
  'duck_f',
  S(
    '170 116',
    `<defs><linearGradient id="dfb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c6a675"/><stop offset="1" stop-color="#7e5e3c"/></linearGradient>
<linearGradient id="dfh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ad8c5e"/><stop offset="1" stop-color="#6d5232"/></linearGradient></defs>
<path d="M32,74 C22,70 14,62 12,54 C20,60 28,68 38,78 Z" fill="#7e5e3c"/>
<path d="M18,57 C12,53 10,56 13,61 C16,63 19,60 18,57 Z" fill="#33271a"/>
<path d="M30,80 C24,58 50,50 80,52 C108,54 124,64 124,76 C124,90 98,98 70,96 C48,94 36,94 30,80 Z" fill="url(#dfb)"/>
<g stroke="#5e442a" stroke-width="2" fill="none" opacity="0.45" stroke-linecap="round"><path d="M44,70 C54,68 64,68 72,70"/><path d="M50,80 C62,78 76,78 88,80"/><path d="M60,88 C72,87 86,87 98,88"/></g>
<path d="M66,74 C80,69 92,70 100,75 C92,82 78,84 68,80 Z" fill="#5a6b86" opacity="0.65"/>
<path d="M106,68 C110,50 118,40 128,38 C139,36 145,45 142,55 C139,66 128,71 118,73 C112,74 108,74 106,68 Z" fill="url(#dfh)"/>
<path d="M112,52 C122,50 132,50 140,53" stroke="#4a3820" stroke-width="2.4" fill="none"/>
<path d="M140,51 C153,49 159,53 156,58 C153,62 143,61 138,58 Z" fill="#c98a3e"/>
<circle cx="131" cy="49" r="2.6" fill="#111"/><circle cx="132" cy="48" r="0.8" fill="#fff"/>`
  ),
  160
);

// toadstool — classic red fly-agaric with white spots, for the meadow/fern floor
save(
  'toadstool',
  S(
    '40 46',
    `<ellipse cx="20" cy="43" rx="9" ry="2.4" fill="#2f5a24" opacity="0.28"/>
<path d="M17,28 C16,36 16,40 18,43 L23,43 C25,40 25,36 24,28 Z" fill="#f1ebda"/>
<path d="M5,26 C5,14 13,8 20,8 C27,8 35,14 35,26 C28,30 12,30 5,26 Z" fill="#d8392f"/>
<path d="M5,26 C12,28 28,28 35,26 C30,23.5 10,23.5 5,26 Z" fill="#b22922" opacity="0.5"/>
<g fill="#f6ecd8"><circle cx="13" cy="18" r="2.1"/><circle cx="22" cy="14" r="2.5"/><circle cx="29" cy="21" r="1.9"/><circle cx="19" cy="22" r="1.5"/></g>`
  ),
  44
);
// a plain brown mushroom alongside it
save(
  'shroom',
  S(
    '40 40',
    `<ellipse cx="20" cy="37" rx="8" ry="2.2" fill="#2f5a24" opacity="0.28"/>
<path d="M16,23 C15,30 15,34 18,37 L22,37 C25,34 25,30 24,23 Z" fill="#e9ddc1"/>
<path d="M7,23 C8,14 13,10 20,10 C27,10 32,14 33,23 C27,27 13,27 7,23 Z" fill="#9c6b3e"/>
<path d="M7,23 C13,25 27,25 33,23 C28,21 12,21 7,23 Z" fill="#caa06a" opacity="0.5"/>`
  ),
  40
);
// a fallen mossy log
save(
  'log',
  S(
    '124 50',
    `<defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a6a48"/><stop offset="1" stop-color="#5e4429"/></linearGradient></defs>
<rect x="10" y="20" width="104" height="22" rx="11" fill="url(#lg)"/>
<ellipse cx="16" cy="31" rx="7" ry="11" fill="#7a5836"/><ellipse cx="16" cy="31" rx="4.2" ry="7" fill="#9c7a52"/><ellipse cx="16" cy="31" rx="1.8" ry="3.4" fill="#7a5836"/>
<path d="M22,20 C42,16 72,16 102,19 C92,22 42,23 22,24 Z" fill="#5e8a3e"/>
<g fill="#6fa04a"><ellipse cx="42" cy="20" rx="11" ry="4"/><ellipse cx="74" cy="20" rx="13" ry="4"/></g>
<g fill="#4e3820" opacity="0.3"><rect x="40" y="30" width="22" height="2" rx="1"/><rect x="70" y="34" width="18" height="2" rx="1"/></g>`
  ),
  112
);
// a tree stump with cut rings
save(
  'stump',
  S(
    '70 56',
    `<defs><linearGradient id="stp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a6a48"/><stop offset="1" stop-color="#5e4429"/></linearGradient></defs>
<path d="M14,52 C12,32 14,22 18,18 L52,18 C56,22 58,32 56,52 Z" fill="url(#stp)"/>
<path d="M16,28 C30,30 44,30 54,28" stroke="#4e3820" stroke-width="1.4" fill="none" opacity="0.35"/>
<path d="M22,22 C24,30 26,42 25,50" stroke="#4e3820" stroke-width="1.1" fill="none" opacity="0.3"/>
<ellipse cx="35" cy="18" rx="21" ry="9" fill="#a07c52"/><ellipse cx="35" cy="18" rx="15" ry="6" fill="#8a6638" opacity="0.5"/><ellipse cx="35" cy="18" rx="8" ry="3.4" fill="#a07c52"/><ellipse cx="35" cy="18" rx="3" ry="1.3" fill="#7a5630"/>`
  ),
  64
);
// a berry bush — a bush variant studded with red berries
save(
  'berrybush',
  S(
    '160 92',
    `<defs><radialGradient id="bry" gradientUnits="userSpaceOnUse" cx="60" cy="34" r="92"><stop offset="0" stop-color="#5fa040"/><stop offset="1" stop-color="#2a6018"/></radialGradient></defs>
<g fill="url(#bry)"><ellipse cx="38" cy="66" rx="32" ry="17"/><ellipse cx="84" cy="68" rx="40" ry="19"/><ellipse cx="126" cy="66" rx="30" ry="16"/><circle cx="52" cy="50" r="22"/><circle cx="92" cy="46" r="25"/><circle cx="124" cy="52" r="18"/></g>
<g fill="#cf2f2f"><circle cx="46" cy="48" r="3"/><circle cx="60" cy="44" r="3"/><circle cx="88" cy="42" r="3.2"/><circle cx="104" cy="48" r="3"/><circle cx="120" cy="54" r="2.8"/><circle cx="36" cy="60" r="2.8"/><circle cx="76" cy="56" r="3"/><circle cx="100" cy="58" r="3"/></g>
<g fill="#f47a68" opacity="0.7"><circle cx="45" cy="47" r="1"/><circle cx="87" cy="41" r="1.1"/><circle cx="103" cy="47" r="1"/></g>`
  ),
  140
);

// fawn — a small spotted deer (no antlers) that trails the herd; two walk frames like the deer
const fawnSvg = (lf) =>
  S(
    '190 152',
    `<defs><linearGradient id="fbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c28c50"/><stop offset="1" stop-color="#8a5e34"/></linearGradient>
<linearGradient id="flg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9c6c3e"/><stop offset="1" stop-color="#5e3e22"/></linearGradient></defs>
<g stroke-linecap="round">
<line x1="62" y1="96" x2="${60 + lf[0]}" y2="138" stroke="#5e4026" stroke-width="6"/>
<line x1="106" y1="95" x2="${107 + lf[1]}" y2="137" stroke="#5e4026" stroke-width="6"/>
<line x1="70" y1="98" x2="${68 + lf[2]}" y2="140" stroke="url(#flg)" stroke-width="6.5"/>
<line x1="114" y1="97" x2="${116 + lf[3]}" y2="139" stroke="url(#flg)" stroke-width="6.5"/></g>
<path d="M44,78 C40,62 58,56 76,57 C96,58 110,60 120,70 C126,76 124,86 116,92 C104,99 84,100 68,98 C54,96 46,92 44,78 Z" fill="url(#fbg)"/>
<circle cx="58" cy="84" r="17" fill="url(#fbg)"/>
<path d="M110,74 C118,62 128,54 138,50 L149,57 C141,69 131,79 125,90 Z" fill="url(#fbg)"/>
<ellipse cx="147" cy="49" rx="13" ry="10.5" fill="url(#fbg)"/>
<path d="M155,42 C165,44 171,51 168,60 C166,66 155,63 149,57 C146,51 149,46 155,42 Z" fill="url(#fbg)"/>
<ellipse cx="167" cy="58" rx="3.4" ry="2.6" fill="#2a1c12"/>
<path d="M139,42 C133,31 135,25 142,29 C146,33 145,41 141,46 Z" fill="#7c5230"/>
<path d="M151,38 C153,29 157,24 163,23 C159,31 157,39 155,46 Z" fill="#7c5230"/>
<circle cx="151" cy="48" r="2.2" fill="#140e09"/><circle cx="151.6" cy="47.4" r="0.7" fill="#d8c7a8"/>
<g fill="#f0e2c4" opacity="0.85"><circle cx="66" cy="71" r="2.4"/><circle cx="80" cy="66" r="2.6"/><circle cx="94" cy="69" r="2.3"/><circle cx="76" cy="79" r="2.1"/><circle cx="90" cy="81" r="2.1"/><circle cx="104" cy="75" r="2.3"/></g>
<path d="M68,82 C84,88 104,86 117,78 C101,91 80,92 68,85 Z" fill="#5e3e22" opacity="0.35"/>`
  );
save('fawn_a', fawnSvg([0, 0, 0, 0]), 150);
save('fawn_b', fawnSvg([6, -5, -5, 6]), 150);

// ======== DESERT detail ========
// a barrel cactus crowned with bloom
save(
  'barrel_cactus',
  S(
    '70 84',
    `<defs><linearGradient id="bcg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4e8038"/><stop offset="0.5" stop-color="#78a850"/><stop offset="1" stop-color="#44742e"/></linearGradient></defs>
<ellipse cx="35" cy="78" rx="20" ry="4" fill="#7a5a2e" opacity="0.2"/>
<path d="M15,76 C11,42 18,20 35,20 C52,20 59,42 55,76 Z" fill="url(#bcg)"/>
<g stroke="#3f6a2e" stroke-width="1.6" fill="none" opacity="0.45"><path d="M25,72 C22,46 25,30 29,22"/><path d="M35,74 L35,21"/><path d="M45,72 C48,46 45,30 41,22"/><path d="M20,66 C18,46 20,32 24,24"/><path d="M50,66 C52,46 50,32 46,24"/></g>
<g stroke="#eee6c8" stroke-width="1.1" stroke-linecap="round" opacity="0.7"><path d="M21,44 l-3,-1"/><path d="M30,38 l0,-3"/><path d="M40,38 l0,-3"/><path d="M49,44 l3,-1"/><path d="M24,58 l-3,0"/><path d="M46,58 l3,0"/></g>
<g fill="#ef5f92"><ellipse cx="35" cy="16" rx="5" ry="6"/><ellipse cx="29" cy="19" rx="4.5" ry="5"/><ellipse cx="41" cy="19" rx="4.5" ry="5"/><ellipse cx="32" cy="14" rx="4" ry="5"/><ellipse cx="38" cy="14" rx="4" ry="5"/></g>
<circle cx="35" cy="17" r="2.6" fill="#f6cf52"/>`
  ),
  60
);
// a bleached longhorn skull
save(
  'skull',
  S(
    '74 58',
    `<path d="M22,22 C22,9 31,4 37,4 C43,4 52,9 52,22 C52,30 48,37 41,41 L43,54 L37,48 L31,54 L33,41 C26,37 22,30 22,22 Z" fill="#ece6d6"/>
<path d="M37,4 C31,4 22,9 22,22 C24,16 30,12 37,12 C44,12 50,16 52,22 C52,9 43,4 37,4 Z" fill="#f6f2e6" opacity="0.55"/>
<g fill="#39332a"><ellipse cx="30" cy="24" rx="4.5" ry="5.5"/><ellipse cx="44" cy="24" rx="4.5" ry="5.5"/></g>
<path d="M35,32 L39,32 L37,40 Z" fill="#39332a"/>
<path d="M22,20 C9,15 2,19 5,26 C9,23 17,23 24,26 Z" fill="#dcd4c0"/>
<path d="M52,20 C65,15 72,19 69,26 C65,23 57,23 50,26 Z" fill="#dcd4c0"/>`
  ),
  64
);

// ======== COAST detail ========
// a fan scallop shell
save(
  'shell',
  S(
    '40 34',
    `<defs><linearGradient id="shl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e0cc"/><stop offset="1" stop-color="#e2b89a"/></linearGradient></defs>
<path d="M20,31 C7,29 3,15 7,7 C10,12 14,9 17,7 C18,5 22,5 23,7 C26,9 30,12 33,7 C37,15 33,29 20,31 Z" fill="url(#shl)"/>
<g stroke="#cf9e7e" stroke-width="1.2" fill="none" stroke-linecap="round"><path d="M20,29 L20,8"/><path d="M20,29 L13,11"/><path d="M20,29 L27,11"/><path d="M20,29 L9,16"/><path d="M20,29 L31,16"/></g>
<ellipse cx="20" cy="30" rx="5" ry="3" fill="#d8a584"/>`
  ),
  40
);
// a spiral conch
save(
  'conch',
  S(
    '46 42',
    `<defs><linearGradient id="cnc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7ecda"/><stop offset="1" stop-color="#e7a892"/></linearGradient></defs>
<path d="M10,32 C4,22 9,8 24,8 C37,8 43,19 40,29 C37,37 28,39 22,36 C29,35 33,28 31,22 C29,16 21,15 17,21 C14,26 18,33 24,33 C18,37 13,36 10,32 Z" fill="url(#cnc)"/>
<path d="M24,8 C31,11 35,17 33,23 C31,17 22,15 17,21 C20,13 27,12 24,8 Z" fill="#d98876" opacity="0.5"/>
<g fill="#eaa08e" opacity="0.6"><circle cx="22" cy="14" r="1.5"/><circle cx="31" cy="20" r="1.3"/><circle cx="14" cy="24" r="1.2"/></g>`
  ),
  44
);
// a weathered piece of driftwood
save(
  'driftwood',
  S(
    '112 38',
    `<defs><linearGradient id="dw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c6baa6"/><stop offset="1" stop-color="#8e8270"/></linearGradient></defs>
<path d="M8,24 C30,18 60,16 92,18 C102,18 106,22 102,26 C82,30 40,30 14,30 C8,30 6,26 8,24 Z" fill="url(#dw)"/>
<g stroke="#7a6e5c" stroke-width="1" fill="none" opacity="0.5"><path d="M16,24 C40,22 70,22 98,24"/><path d="M22,28 C46,27 70,27 94,28"/></g>
<path d="M92,18 C100,13 106,15 106,21 C102,19 96,19 92,22 Z" fill="#b2a690"/>
<ellipse cx="12" cy="26" rx="4.4" ry="4.4" fill="#9a8e7a"/><ellipse cx="12" cy="26" rx="2" ry="2.4" fill="#7a6e5c"/>`
  ),
  100
);

// ======== SAVANNA detail ========
// a termite mound — a tall reddish spire with smaller turrets
save(
  'termite_mound',
  S(
    '64 112',
    `<defs><linearGradient id="tm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9c5e34"/><stop offset="0.5" stop-color="#be7e4c"/><stop offset="1" stop-color="#864e2c"/></linearGradient></defs>
<ellipse cx="32" cy="107" rx="25" ry="5" fill="#6a4424" opacity="0.22"/>
<path d="M44,107 C44,86 46,72 50,62 C52,58 55,58 56,64 C58,78 58,93 56,107 Z" fill="url(#tm)"/>
<path d="M10,107 C10,93 12,83 15,77 C17,74 19,75 20,80 C21,91 21,99 20,107 Z" fill="url(#tm)"/>
<path d="M18,107 C16,72 20,42 28,18 C30,12 35,12 37,18 C45,44 49,74 47,107 Z" fill="url(#tm)"/>
<path d="M28,62 C24,46 26,32 30,22 C28,42 30,72 30,105 Z" fill="#7a4e2c" opacity="0.4"/>
<g fill="#864e2c" opacity="0.45"><ellipse cx="24" cy="52" rx="3.5" ry="8"/><ellipse cx="40" cy="62" rx="3.5" ry="9"/><ellipse cx="33" cy="80" rx="3" ry="7"/></g>`
  ),
  56
);
// a baobab — a fat swollen trunk with a sparse crown of branches
save(
  'baobab',
  S(
    '140 200',
    `<defs><linearGradient id="bao" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#94805a"/><stop offset="0.5" stop-color="#b89a68"/><stop offset="1" stop-color="#86704a"/></linearGradient></defs>
<path d="M44,196 C40,150 46,110 58,90 C50,70 56,56 70,56 C84,56 90,70 82,90 C94,110 100,150 96,196 Z" fill="url(#bao)"/>
<path d="M58,90 C66,86 76,86 84,90 C76,96 66,96 58,90 Z" fill="#7a624a" opacity="0.4"/>
<path d="M52,150 C50,120 54,100 62,90 C58,110 58,150 60,194 Z" fill="#7a644a" opacity="0.35"/>
<g stroke="#86704a" stroke-width="5" fill="none" stroke-linecap="round"><path d="M70,58 C66,44 58,34 48,28"/><path d="M70,58 C74,44 82,34 92,28"/><path d="M70,58 C70,42 70,32 70,22"/><path d="M50,30 C44,26 40,22 36,16"/><path d="M90,30 C96,26 100,22 104,16"/><path d="M70,24 C66,20 64,16 62,10"/><path d="M70,24 C74,20 76,16 78,10"/></g>
<g fill="#86a84e" opacity="0.85"><ellipse cx="40" cy="18" rx="10" ry="6"/><ellipse cx="100" cy="18" rx="10" ry="6"/><ellipse cx="70" cy="12" rx="9" ry="5.5"/><ellipse cx="58" cy="20" rx="6" ry="4"/><ellipse cx="84" cy="20" rx="6" ry="4"/></g>`
  ),
  120
);
// an aloe — a rosette of pointed succulent leaves with reddish tips
save(
  'aloe',
  S(
    '50 52',
    `<g fill="#5e9a4e">
<path d="M25,49 C22,30 20,18 18,8 C24,16 26,30 27,47 Z"/>
<path d="M25,49 C18,34 12,24 6,16 C16,24 22,34 27,46 Z"/>
<path d="M25,49 C32,34 38,24 44,16 C34,24 28,34 23,46 Z"/>
<path d="M25,49 C14,41 8,35 3,29 C13,35 20,41 26,47 Z"/>
<path d="M25,49 C36,41 42,35 47,29 C37,35 30,41 24,47 Z"/></g>
<path d="M25,47 C23,32 22,22 21,14 C25,22 26,34 27,46 Z" fill="#7cbf5e"/>
<g fill="#d86a4a" opacity="0.7"><circle cx="18" cy="9" r="1.6"/><circle cx="6" cy="16" r="1.4"/><circle cx="44" cy="16" r="1.4"/><circle cx="3" cy="29" r="1.3"/><circle cx="47" cy="29" r="1.3"/></g>`
  ),
  50
);

// ======== a squirrel — a cross-biome critter that sits and nibbles ========
save(
  'squirrel',
  S(
    '70 66',
    `<defs><linearGradient id="sq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bc6e3c"/><stop offset="1" stop-color="#8a4e28"/></linearGradient></defs>
<path d="M22,58 C7,54 3,37 9,23 C15,11 27,11 31,19 C23,19 15,27 17,39 C19,49 27,53 33,53 C29,57 25,59 22,58 Z" fill="url(#sq)"/>
<path d="M13,31 C11,23 15,17 21,15 C17,21 17,29 21,35 Z" fill="#d49058" opacity="0.6"/>
<path d="M34,57 C30,45 32,33 40,29 C48,25 56,31 56,43 C56,53 50,59 44,59 C40,59 36,59 34,57 Z" fill="url(#sq)"/>
<circle cx="49" cy="25" r="11" fill="url(#sq)"/>
<path d="M43,17 C41,11 43,7 47,9 C47,13 46,17 45,19 Z" fill="#8a4e28"/>
<path d="M55,17 C57,11 55,7 51,9 C51,13 52,17 53,19 Z" fill="#8a4e28"/>
<path d="M40,53 C38,43 40,35 45,33 C44,41 44,49 46,55 C43,56 41,55 40,53 Z" fill="#e8c89c"/>
<circle cx="45" cy="40" r="3.4" fill="#a06a3a"/>
<circle cx="52" cy="24" r="2" fill="#140e09"/><circle cx="52.6" cy="23.4" r="0.6" fill="#fff"/>
<circle cx="58" cy="27" r="1.6" fill="#3a241a"/>`
  ),
  62
);

// ======== WINTER ground: snow-capped boulders (the snow is part of the rock) ========
// a single boulder wearing a settled, drooping cap of snow
save(
  'snowrock_a',
  S(
    '104 74',
    `<defs><linearGradient id="srka" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#828b99"/><stop offset="1" stop-color="#565e6c"/></linearGradient>
<linearGradient id="srsa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dbe6f1"/></linearGradient></defs>
<ellipse cx="52" cy="69" rx="44" ry="5" fill="#3a4350" opacity="0.18"/>
<path d="M10,67 C2,47 16,35 34,39 C44,23 70,23 82,39 C100,37 104,55 96,67 Z" fill="url(#srka)"/>
<path d="M16,49 C12,41 22,32 34,39 C44,25 70,25 82,39 C92,39 98,45 96,53 C92,49 86,50 82,54 C80,50 75,50 72,53 C65,47 55,47 49,53 C43,48 36,49 32,54 C28,50 22,50 18,53 C16,52 15,50 16,49 Z" fill="url(#srsa)"/>
<path d="M22,53 C32,50 42,52 49,53 C58,51 70,52 80,53" stroke="#c2d0e0" stroke-width="1.8" fill="none" opacity="0.6"/>
<path d="M40,63 C48,59 58,59 64,63" stroke="#454d5a" stroke-width="1.5" fill="none" opacity="0.5"/>`
  ),
  92
);
// a low cluster of two boulders under one snow blanket
save(
  'snowrock_b',
  S(
    '128 66',
    `<defs><linearGradient id="srkb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b94a2"/><stop offset="1" stop-color="#5c6470"/></linearGradient>
<linearGradient id="srsb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d8e4f0"/></linearGradient></defs>
<ellipse cx="64" cy="61" rx="56" ry="5" fill="#3a4350" opacity="0.18"/>
<path d="M6,59 C0,45 14,37 28,40 C34,30 52,30 58,42 C70,40 78,48 74,59 Z" fill="url(#srkb)"/>
<path d="M66,59 C62,46 76,38 92,41 C100,30 118,32 122,46 C128,52 124,60 118,59 Z" fill="url(#srkb)"/>
<path d="M10,46 C8,39 16,34 28,40 C34,31 52,31 58,42 C66,42 70,47 68,52 C62,48 54,49 50,53 C44,48 34,48 28,52 C22,47 14,48 12,52 C9,50 9,47 10,46 Z" fill="url(#srsb)"/>
<path d="M70,46 C76,38 84,35 92,41 C100,32 116,33 120,45 C124,48 123,53 120,55 C114,50 106,50 100,54 C92,49 82,50 78,54 C74,50 70,49 70,46 Z" fill="url(#srsb)"/>`
  ),
  116
);

// ======== an arctic hare — white winter coat, long black-tipped ears (faces right) ========
save(
  'hare',
  S(
    '100 128',
    `<defs><linearGradient id="hr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f9fd"/><stop offset="1" stop-color="#cfdae8"/></linearGradient></defs>
<path d="M46,66 C40,30 38,10 46,7 C54,6 56,30 54,64 Z" fill="url(#hr)"/>
<path d="M60,64 C57,30 60,10 69,11 C78,15 71,36 67,62 Z" fill="url(#hr)"/>
<path d="M45,18 C43,10 47,7 48,12 C48,15 47,18 46,20 Z" fill="#2b2f38"/>
<path d="M67,19 C66,12 69,11 70,15 C70,18 69,21 68,22 Z" fill="#2b2f38"/>
<path d="M46,56 C44,36 45,24 48,18" stroke="#e8c8cc" stroke-width="3" fill="none"/>
<path d="M61,55 C60,37 62,25 66,20" stroke="#e8c8cc" stroke-width="2.6" fill="none"/>
<ellipse cx="40" cy="106" rx="22" ry="20" fill="url(#hr)"/>
<ellipse cx="53" cy="89" rx="23" ry="22" fill="url(#hr)"/>
<circle cx="22" cy="108" r="10" fill="#ffffff"/>
<ellipse cx="59" cy="118" rx="15" ry="5" fill="#c2cedd"/>
<circle cx="61" cy="61" r="16" fill="url(#hr)"/>
<path d="M72,60 C78,61 80,67 75,71 C71,72 68,68 69,63 Z" fill="url(#hr)"/>
<path d="M77,64 l4.6,2.3 l-4.6,2.3 Z" fill="#d98a92"/>
<circle cx="62" cy="57" r="2.6" fill="#1a1a20"/><circle cx="63" cy="56" r="0.8" fill="#fff"/>`
  ),
  100
);

// ======== perched songbirds — sit in the canopy and flit between trees (face right) ========
const perchBird = (id, back, breast, beak, wing) =>
  S(
    '58 52',
    `<path d="M18,38 L2,32 L4,41 L18,42 Z" fill="${wing}"/>
<ellipse cx="26" cy="32" rx="15" ry="14" fill="${back}"/>
<path d="M30,21 C41,23 43,41 30,45 C23,45 21,34 23,28 C25,23 27,21 30,21 Z" fill="${breast}"/>
<circle cx="36" cy="20" r="11" fill="${back}"/>
<path d="M40,13 C47,15 47,27 40,29 C33,28 33,16 40,13 Z" fill="${breast}"/>
<path d="M46,18 L55,20 L46,23 Z" fill="${beak}"/>
<circle cx="41" cy="18" r="2" fill="#1a140d"/>
<path d="M16,27 C25,23 34,25 37,34 C30,40 21,38 16,34 Z" fill="${wing}"/>
<g stroke="${wing}" stroke-width="1.7" stroke-linecap="round"><line x1="26" y1="45" x2="26" y2="50"/><line x1="32" y1="45" x2="32" y2="50"/></g>`
  );
save(
  'robin',
  perchBird('robin', '#8a7a60', '#d8643a', '#e2a23a', '#6f6048'),
  50
);
save(
  'bluebird',
  perchBird('bluebird', '#4a82c8', '#d59060', '#3a3a40', '#37619a'),
  50
);
save(
  'finch',
  perchBird('finch', '#b6b04e', '#ecd24e', '#3a3a40', '#8a8638'),
  50
);

// ---- contact sheet of new + polished ----
const review = [
  'snowrock_a',
  'snowrock_b',
  'hare',
  'rabbit',
  'robin',
  'bluebird',
  'finch',
  'swallow_a'
];
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
