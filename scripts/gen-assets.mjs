// OG 공유 이미지 + 파비콘 생성기
// SVG를 디자인하고 @resvg/resvg-js로 PNG 래스터화한다(한글: Malgun Gothic).
// 실행: node scripts/gen-assets.mjs
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pub = join(__dirname, '..', 'public');
mkdirSync(pub, { recursive: true });

const FONT_DIR = 'C:/Windows/Fonts';
const fontFiles = [join(FONT_DIR, 'malgun.ttf'), join(FONT_DIR, 'malgunbd.ttf')];

// ── 색상 팔레트 (다크블루) ──
const C = {
  bg0: '#0A1633', bg1: '#15317C',
  accent: '#5B8CFF', accentSoft: '#AFC6FF',
  page: '#16336F', white: '#FFFFFF',
};

// 4-포인트 반짝이 별 path
const sparkle = (cx, cy, s, fill = C.white, op = 0.85) =>
  `<path d="M${cx} ${cy - s} L${cx + s * 0.18} ${cy - s * 0.18} L${cx + s} ${cy} L${cx + s * 0.18} ${cy + s * 0.18} L${cx} ${cy + s} L${cx - s * 0.18} ${cy + s * 0.18} L${cx - s} ${cy} L${cx - s * 0.18} ${cy - s * 0.18} Z" fill="${fill}" opacity="${op}"/>`;

// 펼친 책 아이콘 (0,0 기준, 폭 w)
const book = (tx, ty, w, stroke = C.accent, fill = C.page, sw = Math.max(3, w / 60)) => {
  const u = w / 350; // 350 기준 스케일
  const S = (n) => (n * u).toFixed(1);
  return `<g transform="translate(${tx},${ty})">
    <path d="M0 ${S(30)} Q${S(90)} 0 ${S(175)} ${S(24)} L${S(175)} ${S(200)} Q${S(90)} ${S(176)} 0 ${S(206)} Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
    <path d="M${S(350)} ${S(30)} Q${S(260)} 0 ${S(175)} ${S(24)} L${S(175)} ${S(200)} Q${S(260)} ${S(176)} ${S(350)} ${S(206)} Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
    <line x1="${S(175)}" y1="${S(24)}" x2="${S(175)}" y2="${S(200)}" stroke="${stroke}" stroke-width="${sw}"/>
    ${[58, 88, 118].map((y) => `<line x1="${S(40)}" y1="${S(y)}" x2="${S(150)}" y2="${S(y - 8)}" stroke="${stroke}" stroke-width="${S(5)}" stroke-linecap="round" opacity="0.7"/>`).join('')}
    ${[58, 88, 118].map((y) => `<line x1="${S(200)}" y1="${S(y - 8)}" x2="${S(310)}" y2="${S(y)}" stroke="${stroke}" stroke-width="${S(5)}" stroke-linecap="round" opacity="0.7"/>`).join('')}
  </g>`;
};

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.bg0}"/>
      <stop offset="1" stop-color="${C.bg1}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.84" cy="0.16" r="0.6">
      <stop offset="0" stop-color="#3E6BFF" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#3E6BFF" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

// ── OG 이미지 (1200 x 630) ──
const ogSvg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  ${defs}
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="22" y="22" width="1156" height="586" rx="30" fill="none" stroke="${C.accent}" stroke-opacity="0.28" stroke-width="2"/>
  ${book(815, 175, 300)}
  ${sparkle(760, 150, 18, C.accentSoft, 0.9)}
  ${sparkle(1120, 250, 13, C.white, 0.8)}
  ${sparkle(1080, 470, 16, C.accentSoft, 0.7)}
  ${sparkle(150, 520, 12, C.white, 0.55)}
  <rect x="100" y="150" width="296" height="52" rx="26" fill="${C.accent}" fill-opacity="0.18" stroke="${C.accent}" stroke-opacity="0.5" stroke-width="1.5"/>
  <text x="124" y="185" font-family="Malgun Gothic" font-weight="bold" font-size="24" letter-spacing="2" fill="${C.accentSoft}">AI STORYBOOK STUDIO</text>
  <text x="100" y="360" font-family="Malgun Gothic" font-weight="bold" font-size="124" fill="${C.white}">동네아는형</text>
  <rect x="104" y="398" width="132" height="7" rx="3.5" fill="${C.accent}"/>
  <text x="260" y="405" font-family="Malgun Gothic" font-size="44" fill="${C.accentSoft}">—</text>
  <text x="100" y="480" font-family="Malgun Gothic" font-weight="bold" font-size="54" fill="${C.accentSoft}">AI 창작동화 서비스</text>
</svg>`;

// ── 파비콘 (512 x 512) ──
const faviconSvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  ${defs}
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect width="512" height="512" rx="112" fill="url(#glow)"/>
  ${book(110, 150, 292, C.white, 'rgba(255,255,255,0.10)', 14)}
  ${sparkle(400, 120, 30, C.accentSoft, 0.95)}
  ${sparkle(96, 410, 20, C.white, 0.7)}
</svg>`;

// ── 렌더 ──
const render = (svg, width) =>
  new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { fontFiles, loadSystemFonts: true, defaultFontFamily: 'Malgun Gothic' },
  }).render().asPng();

const out = (name, buf) => { writeFileSync(join(pub, name), buf); console.log('✓', name, `(${(buf.length / 1024).toFixed(1)} KB)`); };

out('og-image.png', render(ogSvg, 1200));
writeFileSync(join(pub, 'favicon.svg'), faviconSvg); console.log('✓ favicon.svg');
out('favicon.png', render(faviconSvg, 64));
out('favicon-192.png', render(faviconSvg, 192));
out('apple-touch-icon.png', render(faviconSvg, 180));
console.log('완료.');
void readFileSync; // (lint placeholder)
