// Builds the ARS SHI logo kit (SVG masters) in brand/logo/ from the traced site artwork.
// Proportions match the site header: monogram 3.01x wordmark height, gap 0.55x,
// so the whole lockup is an equilateral triangle (height = 0.866 x width).
import fs from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const read = f => fs.readFileSync(root + 'site/img/w/' + f, 'utf8');
const inner = s => s.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  .replace(/fill="#000" stroke="#000"/, 'fill="#fff" stroke="#fff"');
const MONO = inner(read('logo-mono-bold.svg')), WM = inner(read('logo-wm-bold.svg'));
const MONO_VB = '-24 -24 1608 1692', WM_VB = '-8 -8 2656 508';

const U = 100;                                   // wordmark height
const LW = 5.2704 * U, MH = 3.01 * U, MW = MH * 0.9496, GAP = 0.55 * U;
const LH = MH + GAP + U;                         // 456 -> 0.865 x width

const BLUE = ['#07103A',0,'#0E1E5C',10,'#2A43A0',18,'#0B1A52',26,'#1E3A9C',36,'#4F72D6',44,'#0E1E5C',52,'#24399A',64,'#0A184C',74,'#3354B8',86,'#07103A',100];
const GOLD = ['#7A5A20',0,'#B08A3E',10,'#E2C580',18,'#9A7432',26,'#D6B064',36,'#F6E2A8',44,'#A98436',52,'#E0C27C',64,'#8E6B2C',74,'#EBD08E',86,'#7A5A20',100];
const grad = (id, st) => `<linearGradient id="${id}" x1="-0.63" y1="0" x2="1.87" y2="0.3">` +
  st.reduce((a, v, i) => i % 2 ? a : a + `<stop offset="${st[i+1]}%" stop-color="${v}"/>`, '') + '</linearGradient>';

// paint: 'blue' | 'gold' | solid hex.  layout: 'lockup' | 'square' | 'icon'
function svg({ paint, bg, layout }) {
  let W, H, mx, my, wx, wy, scale;
  if (layout === 'lockup') { const p = 0.06 * LW; W = LW + 2*p; H = LH + 2*p; scale = 1; mx = p + (LW-MW)/2; my = p; wx = p; wy = p + MH + GAP; }
  const parts = [];
  const defs = [];
  const fillFor = (id, x, y, w, h) => {
    if (paint === 'blue' || paint === 'gold') {
      defs.push(grad('g' + id, paint === 'blue' ? BLUE : GOLD));
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#g${id})" mask="url(#m${id})"/>`;
    }
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${paint}" mask="url(#m${id})"/>`;
  };
  const piece = (id, vb, body, x, y, w, h) => {
    defs.push(`<mask id="m${id}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}"><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb}">${body}</svg></mask>`);
    parts.push(fillFor(id, x, y, w, h));
  };
  if (layout === 'lockup') {
    piece('a', MONO_VB, MONO, mx, my, MW, MH);
    piece('b', WM_VB, WM, wx, wy, LW, U);
  } else if (layout === 'square') {            // full lockup centred in a square (social profile)
    W = H = 1000; const s = 640 / LW, ox = (W - LW*s)/2, oy = (H - LH*s)/2;
    piece('a', MONO_VB, MONO, ox + (LW-MW)/2*s, oy, MW*s, MH*s);
    piece('b', WM_VB, WM, ox, oy + (MH+GAP)*s, LW*s, U*s);
  } else {                                     // monogram only (favicon / app icon / watermark)
    W = H = 1000; const h = 720, w = h * 0.9496;
    piece('a', MONO_VB, MONO, (W-w)/2, (H-h)/2, w, h);
  }
  const fmt = n => +n.toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(W)} ${fmt(H)}">` +
    `<title>ARS SHI</title><defs>${defs.join('')}</defs>` +
    (bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : '') + parts.join('') + '</svg>\n';
}

const LINEN = '#FAF6EE', LAPIS = '#0E1E5C';
const kit = {
  'ars-shi-logo-blue-gloss':            { paint: 'blue',    layout: 'lockup' },
  'ars-shi-logo-blue-gloss-on-linen':   { paint: 'blue',    layout: 'lockup', bg: LINEN },
  'ars-shi-logo-gold-gloss':            { paint: 'gold',    layout: 'lockup' },
  'ars-shi-logo-gold-gloss-on-lapis':   { paint: 'gold',    layout: 'lockup', bg: LAPIS },
  'ars-shi-logo-blue-flat':             { paint: LAPIS,     layout: 'lockup' },
  'ars-shi-logo-gold-flat':             { paint: '#D9BC78', layout: 'lockup' },
  'ars-shi-logo-white':                 { paint: '#FFFFFF', layout: 'lockup' },
  'ars-shi-logo-black':                 { paint: '#000000', layout: 'lockup' },
  'ars-shi-profile-blue-on-linen':      { paint: 'blue',    layout: 'square', bg: LINEN },
  'ars-shi-profile-gold-on-lapis':      { paint: 'gold',    layout: 'square', bg: LAPIS },
  'ars-shi-icon-blue-on-linen':         { paint: 'blue',    layout: 'icon',   bg: LINEN },
  'ars-shi-icon-gold-on-lapis':         { paint: 'gold',    layout: 'icon',   bg: LAPIS },
  'ars-shi-icon-blue-gloss':            { paint: 'blue',    layout: 'icon' },
};
const out = root + 'brand/logo/svg/';
fs.mkdirSync(out, { recursive: true });
for (const [name, o] of Object.entries(kit)) fs.writeFileSync(out + name + '.svg', svg(o));
console.log(Object.keys(kit).length + ' SVGs; lockup ratio H/W =', (LH/LW).toFixed(4));
