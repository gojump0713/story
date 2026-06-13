/**
 * 생성형 SVG 삽화 — 배경(setting)별 그림책 스타일 일러스트를 코드로 그린다.
 * API·이미지 파일 없이 동작하며, DALL·E 삽화의 폴백/기본 비주얼로 쓰인다.
 */
import { type CSSProperties } from 'react';

export type SceneKind = 'forest' | 'sea' | 'village' | 'mountain' | 'sky' | 'garden';

const PALETTE: Record<SceneKind, [string, string, string]> = {
  forest:   ['#bfe6c3', '#6fcf97', '#2f8f5b'],
  sea:      ['#bfe3f2', '#5bb8e8', '#2f7fc0'],
  village:  ['#fce3c4', '#f0b97d', '#c97e3f'],
  mountain: ['#dfe6ee', '#9fb4cc', '#5d7490'],
  sky:      ['#2b2f6b', '#4a4fa0', '#8a8ff0'],
  garden:   ['#f7d9ec', '#f3a0cf', '#d65fa6'],
};

/** 배경별 전경 실루엣(언덕/파도/지붕/봉우리 등) */
function foreground(kind: SceneKind, c: string) {
  switch (kind) {
    case 'forest':
      return <>
        <path d="M0 150 Q80 110 160 150 T320 150 V200 H0 Z" fill={c} />
        {[40, 110, 180, 250].map((x, i) => (
          <g key={i}><rect x={x - 4} y={110 - (i % 2) * 8} width="8" height="40" fill="#6b4a2b" /><polygon points={`${x},${78 - (i % 2) * 8} ${x - 22},${134 - (i % 2) * 8} ${x + 22},${134 - (i % 2) * 8}`} fill={c} /></g>
        ))}
      </>;
    case 'sea':
      return <>
        <path d="M0 150 Q40 138 80 150 T160 150 T240 150 T320 150 V200 H0 Z" fill={c} opacity="0.9" />
        <path d="M0 165 Q40 153 80 165 T160 165 T240 165 T320 165 V200 H0 Z" fill={c} />
        <circle cx="250" cy="60" r="22" fill="#ffe9a8" />
      </>;
    case 'village':
      return <>
        <rect x="0" y="150" width="320" height="50" fill={c} />
        {[30, 120, 210].map((x, i) => (
          <g key={i}><rect x={x} y="118" width="64" height="40" fill="#f6efe2" stroke={c} /><polygon points={`${x - 8},118 ${x + 32},92 ${x + 72},118`} fill={c} /></g>
        ))}
      </>;
    case 'mountain':
      return <>
        <polygon points="0,160 90,70 170,160" fill={c} />
        <polygon points="120,160 220,50 320,160" fill={c} opacity="0.8" />
        <polygon points="190,80 220,50 250,80" fill="#fff" />
        <rect x="0" y="158" width="320" height="42" fill={c} />
      </>;
    case 'sky':
      return <>
        {[[40, 50], [120, 30], [200, 70], [270, 40], [90, 90], [240, 100]].map(([x, y], i) => (
          <g key={i}><circle cx={x} cy={y} r="2.4" fill="#fff" /><circle cx={x} cy={y} r="6" fill="#fff" opacity="0.18" /></g>
        ))}
        <circle cx="255" cy="55" r="26" fill="#fdf3c4" /><circle cx="246" cy="48" r="22" fill={PALETTE.sky[0]} />
        <path d="M0 165 Q160 140 320 165 V200 H0 Z" fill={c} />
      </>;
    case 'garden':
      return <>
        <rect x="0" y="155" width="320" height="45" fill={c} />
        {[40, 95, 150, 205, 260].map((x, i) => (
          <g key={i}><rect x={x - 2} y="120" width="4" height="38" fill="#5aa05a" /><circle cx={x} cy="116" r="11" fill="#fff" /><circle cx={x} cy="116" r="5" fill="#ffd83b" /></g>
        ))}
      </>;
  }
}

export function SceneArt({ kind, style }: { kind: SceneKind; style?: CSSProperties }) {
  const [a, b, c] = PALETTE[kind];
  const gid = `sky-${kind}`;
  return (
    <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block', ...style }} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${gid})`} />
      {foreground(kind, c)}
    </svg>
  );
}
