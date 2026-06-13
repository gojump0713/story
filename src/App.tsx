import { useEffect, useRef, useState } from 'react';
import { AppLayout, Stack, Field, Chip, useLocalStorage, type Meta } from './ui';
import { ask, hasKey, generateImage } from './lib/ai';
import { useReadAloud } from './lib/tts';
import { buildStyleSheet, planCuts, cutImagePrompt, cutEmoji, clampCuts } from './lib/custom-book';

/* ──────────────────────────────────────────────────────────────────────────
 * 한국형 AI 동화책 제작 스튜디오 — 기획서 사양(6단계 파이프라인·멀티페이지)을
 * 정적 React로 구현. 입력 → 생성 진행 → 페이지 뷰어 → 독후활동 → 책장.
 * ────────────────────────────────────────────────────────────────────────── */
const M: Meta = {
  id: 1, icon: '📚', title: '한국형 AI 동화책 제작 스튜디오', tagline: '아이 나이·주제·한국 소재를 고르면 6단계 파이프라인으로 동화·삽화·독후활동까지 한 번에',
  members: ['이소민', '신슬', '유용주', '구자성'], color: '#EC4899', ai: true,
  problem:
    '시중 동화는 번역물·서구 정서가 많고, 우리 아이의 이름·연령·관심사에 맞춘 맞춤 동화는 만들기 어렵습니다. ' +
    '본 스튜디오는 아이 나이·주제·한국 소재(탈춤·한복·설날·도깨비 등)를 입력하면 입력수집 → 스토리 생성 → 장면 분할 → 삽화 → 독후활동 → 렌더링의 ' +
    '6단계 파이프라인으로 기승전결 동화를 짓고, 페이지 넘기기 뷰어로 읽으며 이해·감정·창작·어휘 독후활동까지 제공합니다.',
  features: [
    { icon: '✍️', title: '내 프롬프트 그림책', desc: '주인공·그림체를 정하면 같은 캐릭터·화풍으로 5~10컷을 이어 그려 한 권으로' },
    { icon: '🧩', title: '6단계 생성 파이프라인', desc: '입력수집→스토리→장면분할→삽화→독후활동→렌더링을 시각화' },
    { icon: '📖', title: '페이지 넘기기 뷰어', desc: '장면별 삽화·본문을 한 장씩 넘기며 읽는 그림책 UX' },
    { icon: '📝', title: '독후활동 4종', desc: '생각 질문·창작 활동·만들기·어휘로 읽기를 학습으로 연결' },
    { icon: '🎨', title: '컷별 DALL·E 삽화', desc: '뷰어에서 1컷부터 원하는 컷을 골라 DALL·E로 그리기 · 같은 캐릭터·화풍 유지 · 다시 그리기/모두 그리기' },
    { icon: '🔊', title: '음성 낭독(TTS)', desc: '브라우저 음성으로 장면을 읽어주는 무료 오디오북' },
    { icon: '📚', title: '내 책장', desc: '만든 동화를 표지로 저장하고 언제든 다시 읽기' },
  ],
  howto: [
    '(선택) OpenAI API 키를 입력하면 실제 GPT 창작·DALL·E 삽화가 켜집니다',
    '🎲 AI 자동: 아이 이름·나이·주제·한국 소재를 고르면 6단계 파이프라인이 진행됩니다',
    '✍️ 내 프롬프트: 주인공·그림체와 줄거리를 적고 컷 수(5~10)를 정하면 같은 화풍으로 이어진 그림책이 생성됩니다',
    '뷰어에서 “🎨 N컷 그리기”로 1컷부터 원하는 컷을 골라 DALL·E 삽화를 그립니다 (“1컷부터 모두 그리기”도 가능)',
    '뷰어로 읽고, 독후활동을 풀고, 📚 책장에 저장합니다',
  ],
  facts: [
    { value: '6', label: '생성 단계' }, { value: '1~∞', label: '컷 수 자유' }, { value: '4종', label: '독후활동' },
    { value: 'TTS', label: '음성 낭독' }, { value: 'DALL·E', label: '삽화(선택)' }, { value: '책장', label: '저장' },
  ],
  info: [
    { title: '왜 맞춤 동화가 효과적일까요?', body: '아이가 자기 이름의 주인공이 되면 몰입과 정서적 공감이 커지고 책 읽기 흥미가 높아집니다. 연령별 어휘 조절은 이해도를, 독후활동은 문해력과 사고력을 함께 키웁니다.' },
    { title: '연령별 어휘 조절', body: '6세 이하는 15자 이내 짧은 문장, 그 이상은 25자 내외로 — 시스템 프롬프트가 나이에 맞춰 문장 길이·어휘·감정 복잡도를 조절합니다.' },
    { title: '한국적 소재', body: '탈춤·한복·설날·한옥·도깨비·호랑이 등 우리 문화 요소를 자연스럽게 녹여, 정체성과 정서가 담긴 창작 동화를 만듭니다.' },
    { title: '읽기를 학습으로', body: '읽고 끝나지 않도록 이해력 질문·감정 탐색·창작 활동·새 어휘를 자동 생성해 부모-아이 대화와 학습으로 잇습니다.' },
  ],
  pipeline: [
    '입력 수집 — 나이·주제·한국 소재를 구조화',
    '스토리 생성 — 연령별 어휘 규칙 + 기승전결 + 교훈, JSON 스키마 강제',
    '장면 분할 — 제목·본문·배경·감정 단위로 5~8장면 파싱',
    '삽화 — 감정별 그라데이션·이모지 아트(선택 시 DALL·E 실사)',
    '독후활동 생성 — 이해·감정·창작·어휘 4종 자동 구성',
    '렌더링 — 페이지 뷰어 / TTS 낭독 / 책장 저장',
  ],
  techNotes: [
    { title: '캐릭터 시트로 컷 일관성 유지', body: 'DALL·E 3는 seed가 없어 컷마다 그림체가 흔들립니다. 입력 설정에서 외형·의상·색팔레트·화풍만 담은 "시각 ID(캐릭터 시트)"를 한 번 생성해 모든 컷 프롬프트 앞단에 동일하게 주입 → 같은 주인공·같은 화풍으로 5~10컷이 이어집니다.' },
    { title: '단일 호출 구조화 출력', body: '제목·장면(제목/본문/배경/감정)·독후활동·교훈을 한 번의 json_object 응답으로 받아 6단계 파이프라인을 결정적으로 구성합니다.' },
    { title: '파이프라인 시각화', body: '실제 생성 대기 시간에 6단계 진행 상태기계를 애니메이션해, 백엔드 없이도 처리 흐름을 직관적으로 보여줍니다.' },
    { title: 'Web Speech 낭독', body: 'ko-KR 음성으로 장면을 순차 낭독하고 현재 페이지를 상태로 관리하는 오디오북 기능을 제공합니다.' },
    { title: '정적 배포 친화', body: 'Vite + React + TS, GitHub Pages 자동 배포. 상태는 localStorage 에만 의존해 백엔드 없이 완결됩니다. (확장 설계: Supabase Edge + 벡터검색)' },
  ],
  targets: ['미취학~초등 저학년 아이와 부모', '한국 소재 창작 동화 콘텐츠 제작자', '유아·아동 교육 종사자'],
  goals: [
    '아이 이름·나이·관심사에 맞춘 맞춤 동화를 6단계로 자동 생성한다',
    '삽화·낭독·독후활동까지 한 권으로 읽기를 학습으로 연결한다',
    'API 키 없이도 이모지 아트·샘플로 끝까지 동작하게 한다',
  ],
  scenarios: [
    '아이 나이·주제·한국 소재를 고르면 6단계 파이프라인이 동화를 생성한다',
    '페이지 뷰어로 읽으며 컷별 DALL·E 삽화·TTS 낭독을 감상한다',
    '독후활동(생각·창작·만들기·어휘)을 풀고 책장에 저장해 다시 읽는다',
  ],
  screens: [
    { name: '생성 (create)', desc: 'AI 자동/내 프롬프트 모드 — 나이·주제·소재·주인공·화풍 입력' },
    { name: '생성 진행 (generating·customgen)', desc: '6단계 파이프라인 애니메이션으로 생성 과정 표시' },
    { name: '리더 (reader)', desc: '장면별 삽화·본문을 한 장씩 넘기는 그림책 뷰어 + 컷 그리기·TTS' },
    { name: '독후활동 (activity)', desc: '이해 질문·창작·만들기·어휘 4종' },
    { name: '내 책장 (library)', desc: '만든 동화를 표지로 저장·재열람' },
  ],
  pipelineDetail: [
    { step: '입력 수집', detail: '아이 나이·주제·한국 소재(탈춤·한복·도깨비 등)를 구조화해 생성 입력으로 만든다.' },
    { step: '스토리 생성', detail: '연령별 어휘 규칙(6세↓ 15자/이상 25자) + 기승전결 + 교훈을 system 프롬프트로 지시하고 json_object로 받는다.' },
    { step: '장면 분할', detail: '응답을 제목·본문·배경·감정 단위 5~8장면으로 파싱한다.' },
    { step: '삽화', detail: '감정별 그라데이션·이모지 아트로 기본 렌더, 키가 있으면 캐릭터 시트를 모든 컷 프롬프트에 주입해 DALL·E로 일관 삽화를 그린다.' },
    { step: '독후활동 생성', detail: '이해·감정·창작·어휘 4종 활동을 자동 구성한다.' },
    { step: '렌더링', detail: '페이지 뷰어·TTS 낭독·책장 저장(localStorage)으로 완성한다.' },
  ],
  promptNotes: [
    'system 프롬프트가 아이 나이에 맞춰 문장 길이·어휘·감정 복잡도를 조절하고, 제목·장면·독후활동·교훈을 하나의 json_object로 받도록 스키마를 강제한다.',
    '삽화 일관성을 위해 외형·의상·색팔레트·화풍만 담은 "시각 ID(캐릭터 시트)"를 먼저 만들어 모든 컷 이미지 프롬프트 앞단에 동일 주입한다(DALL·E 3는 seed 미지원).',
    '컷별 이미지 프롬프트는 lib/custom-book의 planCuts·cutImagePrompt로 생성하며, 1컷부터 골라 그리거나 모두 그리기를 지원한다.',
    'API 키가 없으면 GPT·DALL·E 호출 없이 이모지 아트와 샘플 텍스트로 동일한 6단계 결과를 제공한다.',
  ],
  architecture:
    '백엔드 없는 React SPA. 공통 레이아웃·5탭은 src/ui.tsx, 동화 생성·뷰어·책장은 src/App.tsx가 담당한다. ' +
    'GPT 창작과 DALL·E 삽화는 src/lib/ai.ts, 컷 분할·프롬프트는 src/lib/custom-book.ts, 음성 낭독은 src/lib/tts.ts가 처리하고, 만든 책은 브라우저 localStorage에 저장한다.',
  structure: [
    { path: 'src/App.tsx', desc: '동화 생성·페이지 뷰어·독후활동·책장 + 메타(M)' },
    { path: 'src/ui.tsx', desc: '공통 레이아웃·5탭·UI 헬퍼' },
    { path: 'src/lib/ai.ts', desc: 'GPT chat + DALL·E 이미지 생성 헬퍼' },
    { path: 'src/lib/custom-book.ts', desc: '컷 분할·캐릭터 시트·컷 이미지 프롬프트' },
    { path: 'src/lib/tts.ts', desc: 'Web Speech 한국어 낭독 훅' },
    { path: 'src/index.css', desc: '테마·그림책/뷰어 스타일' },
  ],
  dataModel: [
    { name: 'Story', desc: 'title·hero·scenes·activities·moral·images의 동화 한 권' },
    { name: 'Scene', desc: '장면 단위 title·text·art(감정 아트)·emotion' },
    { name: 'Activities', desc: '독후활동 think(질문)·create·craft·vocab(어휘)' },
    { name: 'Saved', desc: 'Story + id. localStorage 키 "fairytale.lib.v4" 책장에 누적' },
  ],
  deploy:
    'Vite 빌드(base: "./") 후 GitHub Actions(deploy.yml)가 main push 시 GitHub Pages로 자동 배포 → aebonlee.github.io/project01/',
  scope: {
    include: ['아이 입력 → 6단계로 동화·삽화·독후활동 생성', '페이지 뷰어·TTS 낭독·책장 저장', 'GPT 창작 + 키 없을 때 이모지 아트/샘플 폴백'],
    exclude: ['실물 책 인쇄·배송', '다중 사용자 공유·댓글', '음성 더빙·애니메이션'],
  },
  pitch: [
    '아이 이름·연령에 맞춘 "내 아이 주인공" 맞춤 동화라는 점',
    '캐릭터 시트로 컷 화풍을 일관되게 유지하는 삽화 설계',
    '키 없이도 이모지 아트로 끝까지 동작해 시연이 안전한 점',
  ],
  stack: ['React 18', 'TypeScript', 'Vite', 'OpenAI GPT', 'gpt-image-1 / DALL·E', 'Web Speech API', 'localStorage'],
  links: [
    { label: 'OpenAI Platform', url: 'https://platform.openai.com' },
    { label: 'Web Speech API (MDN)', url: 'https://developer.mozilla.org/docs/Web/API/SpeechSynthesis' },
  ],
};

const TOPICS = [
  { key: 'friend', label: '우정', emoji: '🤝' }, { key: 'courage', label: '용기', emoji: '🦁' }, { key: 'nature', label: '자연', emoji: '🌳' },
  { key: 'honesty', label: '정직', emoji: '💛' }, { key: 'family', label: '가족', emoji: '🏡' }, { key: 'wisdom', label: '지혜', emoji: '🦉' },
];
const MATERIALS = [
  { key: 'tal', label: '탈춤', emoji: '🎭' }, { key: 'hanbok', label: '한복', emoji: '👘' }, { key: 'seollal', label: '설날', emoji: '🧧' },
  { key: 'hanok', label: '한옥', emoji: '🏘️' }, { key: 'dokkaebi', label: '도깨비', emoji: '👹' }, { key: 'tiger', label: '호랑이', emoji: '🐯' }, { key: 'jeju', label: '제주', emoji: '🌊' },
];
const GRADIENTS = [
  ['#fb923c', '#fbbf24'], ['#60a5fa', '#22d3ee'], ['#34d399', '#a3e635'],
  ['#f472b6', '#c084fc'], ['#f87171', '#fbbf24'], ['#818cf8', '#f472b6'], ['#2dd4bf', '#60a5fa'], ['#facc15', '#fb7185'],
];

const PIPELINE = ['소재 분석 및 줄거리 구상', '기승전결 스토리 생성', '장면 분할 (5~8장면)', '삽화 프롬프트 생성', '독후활동 4종 생성', '동화 뷰어 렌더링'];

// 삽화 비율(그림 크기) 선택지 — generateImage 의 size 로 전달
type ImgSize = '1024x1792' | '1024x1024' | '1792x1024';
const RATIOS: { key: ImgSize; label: string; emoji: string }[] = [
  { key: '1024x1792', label: '세로', emoji: '📱' },
  { key: '1024x1024', label: '정사각', emoji: '⬛' },
  { key: '1792x1024', label: '가로', emoji: '🖼️' },
];

interface Scene { title: string; text: string; art: string; emotion: string }
interface Vocab { word: string; meaning: string }
interface Activities { think: string[]; create: string; craft: string[]; vocab: Vocab[] }
interface Story { title: string; hero: string; topicLabel: string; scenes: Scene[]; activities: Activities; moral: string; images?: string[]; styleId?: string }
interface Saved extends Story { id: number }

function fallbackStory(hero: string, _age: number, topic: typeof TOPICS[number], mat: typeof MATERIALS[number]): Story {
  const h = hero.trim() || '아이';
  const scenes: Scene[] = [
    { title: '제1장 — 시작', text: `옛날 ${mat.label}이(가) 있는 마을에 ${h}(이)가 살았어요. ${h}(은)는 아직 ${topic.label}이(가) 무엇인지 잘 몰랐답니다.`, art: mat.emoji, emotion: '평온' },
    { title: '제2장 — 사건', text: `어느 날 마을에 작은 소동이 벌어졌어요. ${h}(은)는 곤경에 빠진 친구를 보았지요.`, art: '✨', emotion: '놀람' },
    { title: '제3장 — 고민', text: `“어떻게 해야 할까?” ${h}(은)는 ${topic.label}에 대해 곰곰이 생각했어요.`, art: '🤔', emotion: '고민' },
    { title: '제4장 — 용기', text: `${h}(은)는 용기를 내어 손을 내밀었어요. “${topic.label}은(는) 함께할 때 더 빛나는 거야!”`, art: topic.emoji, emotion: '용기' },
    { title: '제5장 — 끝', text: `그날 이후 ${mat.label} 마을엔 웃음이 가득해졌어요. ${h}(은)는 ${topic.label}의 소중함을 마음에 새겼답니다. 끝.`, art: '🌟', emotion: '기쁨' },
  ];
  return {
    title: `${h}와(과) ${mat.label} 이야기`, hero: h, topicLabel: topic.label, scenes,
    styleId: `주인공 ${h}, 주제 ${topic.label}, 한국 전통 소재 ${mat.label}, 따뜻하고 부드러운 아동 그림책 수채화 스타일, 일관된 등장인물`,
    activities: {
      think: [`${h}(이)가 가장 용감했던 순간은 언제였을까요?`, `친구는 그때 어떤 마음이었을까요?`, `나라면 어떻게 했을지 이야기해 볼까요?`],
      create: `이야기의 새로운 결말을 상상해서 그림이나 글로 만들어 보세요.`,
      craft: [`${mat.label}을(를) 색종이로 만들어 보기`, '주인공 얼굴 그려서 막대 인형 만들기', '가족과 역할을 나눠 동화 연극하기'],
      vocab: [{ word: topic.label, meaning: `${topic.label}은(는) 다른 사람을 생각하는 따뜻한 마음이에요.` }, { word: '용기', meaning: '두렵지만 옳은 일을 해내는 마음의 힘이에요.' }],
    },
    moral: `${topic.label}은(는) 멀리 있지 않아요. 오늘 내가 내민 작은 손길에서 시작된답니다.`,
  };
}

async function generateStory(hero: string, age: number, topic: typeof TOPICS[number], mat: typeof MATERIALS[number]): Promise<Story> {
  if (!hasKey()) return fallbackStory(hero, age, topic, mat);
  try {
    const maxLen = age <= 6 ? '15자 이내' : '25자 내외';
    const out = await ask(
      '너는 한국 전래동화 스타일의 아동문학 작가이자 문해력 교사야. 기승전결과 교훈이 있는 창작 동화를 만든다. ' +
        `대상 ${age}세, 문장 길이 ${maxLen}, 한국 문화 요소를 자연스럽게 포함. ` +
        '반드시 JSON만: {"title":"","scenes":[{"title":"제N장 — 소제목","text":"본문","art":"이모지1개","emotion":"감정"}],' +
        '"activities":{"think":["생각·이해 질문"],"create":"창작 활동 한 문장","craft":["만들기 활동"],"vocab":[{"word":"","meaning":""}]},"moral":"한 문장 교훈"}',
      `주인공: ${hero.trim() || '아이'} / 나이: ${age} / 주제: ${topic.label} / 한국 소재: ${mat.label}. 장면 5~6개, 생각질문 3개, 만들기 3개, 어휘 2~3개.`,
      { json: true, temperature: 0.9, max_tokens: 1600 },
    );
    const p = JSON.parse(out);
    const scenes: Scene[] = Array.isArray(p.scenes) ? p.scenes.map((s: Scene, i: number) => ({ title: String(s.title || `제${i + 1}장`), text: String(s.text || ''), art: String(s.art || '✨').slice(0, 2), emotion: String(s.emotion || '') })) : [];
    if (!scenes.length) return fallbackStory(hero, age, topic, mat);
    const a = p.activities || {};
    return {
      title: String(p.title || `${hero.trim() || '아이'}의 이야기`), hero: hero.trim() || '아이', topicLabel: topic.label, scenes,
      styleId: `주인공 ${hero.trim() || '아이'}, 주제 ${topic.label}, 한국 전통 소재 ${mat.label}, 따뜻하고 부드러운 아동 그림책 수채화 스타일, 일관된 등장인물`,
      activities: {
        think: (a.think || []).map(String), create: String(a.create || '이야기의 새 결말을 그려 보세요.'),
        craft: (a.craft || []).map(String), vocab: (a.vocab || []).map((v: Vocab) => ({ word: String(v.word || ''), meaning: String(v.meaning || '') })).filter((v: Vocab) => v.word),
      },
      moral: String(p.moral || ''),
    };
  } catch {
    return fallbackStory(hero, age, topic, mat);
  }
}

/* 6단계 생성 진행 애니메이션 (텍스트 생성) — 삽화는 뷰어에서 컷별로 그린다 */
function Generating({ color, onDone, run }: { color: string; onDone: (s: Story) => void; run: () => Promise<Story> }) {
  const [step, setStep] = useState(0);
  const storyRef = useRef<Story | null>(null);
  useEffect(() => {
    let alive = true;
    run().then((s) => { storyRef.current = s; });
    const iv = setInterval(() => {
      setStep((s) => {
        if (s >= PIPELINE.length - 1) {
          clearInterval(iv);
          setTimeout(() => { if (alive && storyRef.current) onDone(storyRef.current); else if (alive) { const t = setInterval(() => { if (storyRef.current) { clearInterval(t); onDone(storyRef.current); } }, 200); } }, 500);
          return s;
        }
        return s + 1;
      });
    }, 650);
    return () => { alive = false; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="card sb-gen">
      <div className="sb-gen__spin" style={{ borderTopColor: color }} />
      <h3 style={{ margin: '4px 0 14px' }}>✨ 동화를 짓고 있어요…</h3>
      <ul className="sb-steps">
        {PIPELINE.map((t, i) => (
          <li key={i} className={`sb-step ${i < step ? 'done' : i === step ? 'doing' : 'todo'}`}>
            <span className="sb-step__check" style={i <= step ? { background: color, color: '#fff', borderColor: color } : undefined}>{i < step ? '✓' : i + 1}</span>
            <span className="sb-step__title">{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 커스텀 그림책용 기본 독후활동 */
function customActivities(): Activities {
  return {
    think: ['가장 마음에 드는 장면은 어느 컷이었나요?', '주인공의 기분은 처음과 끝에 어떻게 달라졌을까요?', '내가 주인공이라면 어떻게 했을지 이야기해 볼까요?'],
    create: '이 이야기의 다음 컷을 상상해서 그림이나 글로 이어 만들어 보세요.',
    craft: ['가장 좋아하는 컷을 따라 그려 보기', '주인공에게 짧은 편지 쓰기', '가족과 한 컷씩 나눠 소리 내어 읽기'],
    vocab: [],
  };
}

/* 내 프롬프트 그림책 — 같은 캐릭터·화풍으로 N컷을 실제 생성하며 진행 표시 */
function CustomGenerating({ color, charId, concept, cuts, title, onDone }:
  { color: string; charId: string; concept: string; cuts: number; title: string; onDone: (s: Story) => void }) {
  const [phase, setPhase] = useState('🎨 그림체와 주인공을 분석하고 있어요…');
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(cuts);
  const [thumbs, setThumbs] = useState<(string | null)[]>([]);
  const ai = hasKey();

  useEffect(() => {
    let alive = true;
    (async () => {
      const sheet = await buildStyleSheet(charId);
      if (!alive) return;
      setPhase('📝 줄거리를 컷으로 나누고 있어요…');
      const plan = await planCuts(charId, concept, cuts);
      if (!alive) return;
      setTotal(plan.length);
      setThumbs(Array(plan.length).fill(null));
      const scenes: Scene[] = plan.map((p, i) => ({ title: `${i + 1}컷`, text: p.caption, art: cutEmoji(i), emotion: '' }));
      setThumbs(plan.map((_p, i) => cutEmoji(i)));
      setDone(plan.length);
      if (!alive) return;
      const story: Story = {
        title: title.trim() || `${charId.trim().slice(0, 18) || '나의'} 그림책`,
        hero: charId.trim(), topicLabel: '내 프롬프트',
        scenes,
        activities: customActivities(),
        moral: '',
        styleId: sheet,
      };
      onDone(story);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="card sb-gen">
      <div className="sb-gen__spin" style={{ borderTopColor: color }} />
      <h3 style={{ margin: '4px 0 6px' }}>{phase}</h3>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--faint)' }}>
        같은 주인공·같은 그림체로 {total}컷을 구성하는 중이에요{ai ? ' · 그림은 뷰어에서 1컷부터 그릴 수 있어요' : ' (오프라인 샘플 — 이모지 컷)'}
      </p>
      <div className="cg-bar"><span className="cg-bar__fill" style={{ width: `${pct}%`, background: color }} /></div>
      <div className="cg-grid">
        {Array.from({ length: total }, (_, i) => {
          const t = thumbs[i];
          return (
            <div key={i} className={`cg-cell ${i < done ? 'done' : i === done ? 'doing' : ''}`} style={i === done ? { borderColor: color } : undefined}>
              <span className="cg-cell__art">{t || i + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* 페이지 넘기기 뷰어 */
function Reader({ story, color, onActivity, onSave, canDraw, busyCut, drawingAll, drawError, onDrawCut, onDrawAll, imgSize, onImgSize }:
  { story: Story; color: string; onActivity: () => void; onSave: () => void;
    canDraw?: boolean; busyCut?: number | null; drawingAll?: boolean; drawError?: string | null; onDrawCut?: (i: number) => void; onDrawAll?: () => void;
    imgSize?: ImgSize; onImgSize?: (s: ImgSize) => void }) {
  const [page, setPage] = useState(0);
  const tts = useReadAloud();
  const sc = story.scenes[page];
  const [a, b] = GRADIENTS[page % GRADIENTS.length];
  const img = story.images?.[page];
  const drawingThis = busyCut === page;
  const anyBusy = drawingAll || busyCut != null;
  const drawnCount = story.scenes.filter((_s, i) => story.images?.[i]).length;
  return (
    <div className="sb-reader">
      <div className="sb-book">
        <div className="sb-scene" style={{ background: img ? undefined : `linear-gradient(135deg, ${a}, ${b})` }}>
          {img ? <img src={img} alt={sc.title} /> : <span className="sb-scene__art">{sc.art}</span>}
          {drawingThis && <div className="sb-scene__busy"><span className="sb-gen__spin" style={{ borderTopColor: '#fff', margin: 0, width: 30, height: 30 }} /><span>그리는 중…</span></div>}
        </div>
        <div className="sb-text">
          <h2 style={{ color }}>{sc.title}</h2>
          <p>{sc.text}</p>
          {sc.emotion && <span className="sb-emotion">{sc.emotion}</span>}
        </div>
      </div>

      {canDraw && (
        <>
          <div className="sb-ratio">
            <span className="sb-ratio__label">그림 비율</span>
            {RATIOS.map((r) => (
              <button key={r.key} type="button" disabled={anyBusy}
                className={`sb-ratio__btn ${imgSize === r.key ? 'on' : ''}`}
                style={imgSize === r.key ? { borderColor: color, color, background: `${color}14` } : undefined}
                onClick={() => onImgSize?.(r.key)}>{r.emoji} {r.label}</button>
            ))}
          </div>
          <div className="sb-draw">
            <button className="btn" style={{ background: color, padding: '8px 14px', fontSize: 13.5 }} disabled={anyBusy} onClick={() => onDrawCut?.(page)}>
              {drawingThis ? '🎨 그리는 중…' : img ? `🔄 ${page + 1}컷 다시 그리기` : `🎨 ${page + 1}컷 그리기`}
            </button>
            <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 13.5 }} disabled={anyBusy} onClick={() => onDrawAll?.()}>
              {drawingAll ? `🎨 그리는 중… (${(busyCut ?? 0) + 1}/${story.scenes.length})` : '🎨 1컷부터 모두 그리기'}
            </button>
            <span className="sb-draw__count">삽화 {drawnCount}/{story.scenes.length}</span>
          </div>
        </>
      )}
      {canDraw && drawError && (
        <div className="sb-draw__err">⚠️ 삽화 생성 실패 — {drawError}
          <span> · 키·결제 상태를 확인하거나, 계정에 따라 <code>VITE_OPENAI_IMAGE_MODEL=dall-e-3</code> 지정이 필요할 수 있어요.</span>
        </div>
      )}

      <div className="sb-pager">
        <button className="sb-pager__btn" disabled={page === 0} onClick={() => setPage(page - 1)}>← 이전</button>
        <div className="sb-dots">{story.scenes.map((_s, i) => <span key={i} className={`sb-dot ${i === page ? 'on' : ''} ${story.images?.[i] ? 'drawn' : ''}`} style={i === page ? { background: color } : story.images?.[i] ? { background: `${color}88` } : undefined} onClick={() => setPage(i)} />)}</div>
        {page < story.scenes.length - 1
          ? <button className="sb-pager__btn" onClick={() => setPage(page + 1)}>다음 →</button>
          : <button className="sb-pager__btn primary" style={{ background: color, color: '#fff' }} onClick={onActivity}>📝 독후활동</button>}
      </div>
      <div className="sb-ctrl">
        {tts.supported && <button className="btn btn-ghost" onClick={() => (tts.speaking ? tts.stop() : tts.play([sc.text]))}>{tts.speaking ? '⏹️ 멈춤' : '🔊 읽어주기'}</button>}
        <button className="btn btn-ghost" onClick={onSave}>💾 책장 저장</button>
        <button className="btn btn-ghost" onClick={() => window.print()}>↓ 인쇄</button>
      </div>
      {canDraw === false && <p style={{ margin: 0, fontSize: 12, color: 'var(--faint)', textAlign: 'center' }}>🔑 상단에 OpenAI 키를 입력하면 컷마다 DALL·E로 그릴 수 있어요.</p>}
    </div>
  );
}

function Activity({ story, color, onBack, onLibrary }: { story: Story; color: string; onBack: () => void; onLibrary: () => void }) {
  const A = story.activities;
  return (
    <Stack gap={16}>
      <div className="sb-crumb">📖 {story.title} › 독후활동</div>
      <h2 style={{ margin: 0, fontSize: 20 }}>📝 동화를 다 읽었어요! 무엇을 더 해볼까요?</h2>
      <div className="sb-act-grid">
        <article className="sb-act"><span className="sb-act__type" style={{ background: `${color}18`, color }}>💭 생각 질문</span><h3>이야기를 함께 떠올려 봐요</h3><ul>{A.think.map((q, i) => <li key={i}>{q}</li>)}</ul></article>
        <article className="sb-act"><span className="sb-act__type" style={{ background: '#f59e0b18', color: '#b45309' }}>🎨 창작 활동</span><h3>나만의 이야기를 만들어요</h3><p>{A.create}</p></article>
        <article className="sb-act"><span className="sb-act__type" style={{ background: '#10b98118', color: '#047857' }}>🧶 만들기 활동</span><h3>손으로 만들어 봐요</h3><ul>{A.craft.map((c, i) => <li key={i}>{c}</li>)}</ul></article>
        <article className="sb-act"><span className="sb-act__type" style={{ background: '#6366f118', color: '#4338ca' }}>📖 새로운 낱말</span><h3>오늘 배운 말</h3><ul>{A.vocab.map((v, i) => <li key={i}><b>{v.word}</b> — {v.meaning}</li>)}</ul></article>
      </div>
      {story.moral && <div className="callout-soft" style={{ background: `${color}12`, border: `1px solid ${color}40` }}><span style={{ fontSize: 22 }}>💝</span><p style={{ margin: 0, fontWeight: 600 }}>{story.moral}</p></div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn" style={{ background: color }} onClick={onLibrary}>✓ 활동 완료 · 책장으로</button>
        <button className="btn btn-ghost" onClick={onBack}>← 다시 읽기</button>
      </div>
    </Stack>
  );
}

type View = 'create' | 'generating' | 'customgen' | 'reader' | 'activity' | 'library';
type Mode = 'auto' | 'custom';

function Feature() {
  const [view, setView] = useState<View>('create');
  const [mode, setMode] = useState<Mode>('auto');
  const [hero, setHero] = useState('');
  const [age, setAge] = useState(7);
  const [topic, setTopic] = useState(TOPICS[0]);
  const [mat, setMat] = useState(MATERIALS[0]);
  // 내 프롬프트 그림책 입력
  const [charId, setCharId] = useState('');
  const [concept, setConcept] = useState('');
  const [cuts, setCuts] = useState(6);
  const [bookTitle, setBookTitle] = useState('');
  const [story, setStory] = useState<Story | null>(null);
  const [busyCut, setBusyCut] = useState<number | null>(null);
  const [drawingAll, setDrawingAll] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<ImgSize>('1024x1792');
  const [lib, setLib] = useLocalStorage<Saved[]>('fairytale.lib.v4', []);

  const go = (v: View) => { setView(v); requestAnimationFrame(() => document.getElementById('sb-top')?.scrollIntoView({ behavior: 'smooth' })); };
  const start = () => go(mode === 'custom' ? 'customgen' : 'generating');
  const onGenerated = (s: Story) => { setStory(s); go('reader'); };
  const save = () => { if (story && !lib.find((l) => l.title === story.title)) setLib([{ ...story, id: Date.now() }, ...lib].slice(0, 24)); };

  // 한 컷의 DALL·E 삽화를 그려 story.images[i]에 반영 (같은 styleId로 화풍 일관성 유지)
  const drawOne = async (s: Story, i: number) => {
    const sheet = s.styleId || `${s.hero} ${s.topicLabel} 따뜻한 아동 그림책 수채화, 일관된 등장인물`;
    const img = await generateImage(cutImagePrompt(sheet, s.scenes[i].text, i, s.scenes.length), { size: imgSize });
    setStory((prev) => {
      if (!prev) return prev;
      const images = [...(prev.images || Array(prev.scenes.length).fill(''))];
      images[i] = img;
      return { ...prev, images };
    });
  };
  const drawCut = async (i: number) => {
    if (!story || !hasKey() || busyCut !== null || drawingAll) return;
    setBusyCut(i); setDrawError(null);
    try { await drawOne(story, i); } catch (e) { setDrawError(e instanceof Error ? e.message : '삽화 생성 실패'); }
    setBusyCut(null);
  };
  const drawAll = async () => {
    if (!story || !hasKey() || busyCut !== null || drawingAll) return;
    setDrawingAll(true); setDrawError(null);
    for (let i = 0; i < story.scenes.length; i++) {
      setBusyCut(i);
      try { await drawOne(story, i); } catch (e) { setDrawError(e instanceof Error ? e.message : '삽화 생성 실패'); break; }
    }
    setBusyCut(null);
    setDrawingAll(false);
  };

  return (
    <Stack>
      <div id="sb-top" />
      {/* 진행 표시줄(현재 단계) */}
      {story && view !== 'create' && view !== 'generating' && (
        <div className="sb-flow">
          {(['reader', 'activity', 'library'] as View[]).map((v, i) => (
            <button key={v} className={`sb-flow__step ${view === v ? 'on' : ''}`} style={view === v ? { background: M.color, color: '#fff', borderColor: M.color } : undefined} onClick={() => go(v)}>{['📖 읽기', '📝 독후활동', '📚 책장'][i]}</button>
          ))}
          <button className="sb-flow__step" style={{ marginLeft: 'auto' }} onClick={() => go('create')}>＋ 새 동화</button>
        </div>
      )}

      {view === 'create' && (
        <div className="studio">
          <div className="sb-mode">
            <button className={`sb-mode__btn ${mode === 'auto' ? 'on' : ''}`} style={mode === 'auto' ? { background: M.color, color: '#fff', borderColor: M.color } : undefined} onClick={() => setMode('auto')}>🎲 AI 자동 동화</button>
            <button className={`sb-mode__btn ${mode === 'custom' ? 'on' : ''}`} style={mode === 'custom' ? { background: M.color, color: '#fff', borderColor: M.color } : undefined} onClick={() => setMode('custom')}>✍️ 내 프롬프트 그림책</button>
          </div>

          {mode === 'auto' ? (
            <>
              <div className="studio-row">
                <Field label="주인공 이름"><input value={hero} onChange={(e) => setHero(e.target.value)} placeholder="예: 토리, 민준, 하늘" /></Field>
                <Field label={`아이 나이 · ${age}세`}><input type="range" min={5} max={12} value={age} onChange={(e) => setAge(Number(e.target.value))} /></Field>
              </div>
              <Field label="이야기 주제"><div className="chips">{TOPICS.map((t) => <Chip key={t.key} active={topic.key === t.key} color={M.color} onClick={() => setTopic(t)}>{t.emoji} {t.label}</Chip>)}</div></Field>
              <Field label="한국 소재"><div className="chips">{MATERIALS.map((m) => <Chip key={m.key} active={mat.key === m.key} color={M.color} onClick={() => setMat(m)}>{m.emoji} {m.label}</Chip>)}</div></Field>
              <button className="btn" style={{ background: M.color }} onClick={start}>✨ 동화 만들기</button>
            </>
          ) : (
            <>
              <div className="callout-soft" style={{ background: `${M.color}10`, border: `1px solid ${M.color}33`, fontSize: 12.5, lineHeight: 1.7 }}>
                <span style={{ fontSize: 18 }}>🪄</span>
                <p style={{ margin: 0 }}>주인공·그림체를 한 번 정하면 <b>같은 캐릭터·같은 화풍</b>으로 <b>1컷부터 원하는 만큼</b> 이어진 그림책을 만들어요. {!hasKey() && <span style={{ color: 'var(--faint)' }}>(실제 삽화는 위에서 OpenAI 키를 입력하면 켜집니다)</span>}</p>
              </div>
              <Field label="주인공 · 그림체 설정 (시각 ID)" hint="모든 컷에 똑같이 유지돼요">
                <textarea rows={2} value={charId} onChange={(e) => setCharId(e.target.value)} placeholder="예: 둥근 얼굴에 노란 한복을 입은 여자아이 '토리', 따뜻한 파스텔 수채화 그림체, 큰 눈" />
              </Field>
              <Field label="이야기 / 장면 프롬프트" hint="줄거리를 적거나, 한 줄에 한 컷씩 적어도 돼요 (비우면 AI가 알아서 구성)">
                <textarea rows={4} value={concept} onChange={(e) => setConcept(e.target.value)} placeholder={'예: 토리가 도깨비 친구를 만나 잃어버린 달을 찾아 떠나는 모험\n또는 한 줄에 한 컷씩:\n토리가 한옥 마당에서 노는 장면\n밤하늘의 달이 사라지는 장면\n도깨비를 처음 만나는 장면'} />
              </Field>
              <div className="studio-row">
                <Field label="컷 수" hint="1컷부터, 제한 없음"><input type="number" min={1} step={1} value={cuts} onChange={(e) => setCuts(clampCuts(Number(e.target.value)))} /></Field>
                <Field label="책 제목 (선택)"><input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} placeholder="예: 토리와 달도깨비" /></Field>
              </div>
              <button className="btn" style={{ background: M.color }} disabled={!charId.trim()} onClick={start}>🎨 {cuts}컷 그림책 만들기</button>
            </>
          )}
          {lib.length > 0 && <button className="btn btn-ghost" onClick={() => go('library')}>📚 내 책장 ({lib.length})</button>}
        </div>
      )}

      {view === 'generating' && <Generating color={M.color} run={() => generateStory(hero, age, topic, mat)} onDone={onGenerated} />}

      {view === 'customgen' && <CustomGenerating color={M.color} charId={charId} concept={concept} cuts={cuts} title={bookTitle} onDone={onGenerated} />}

      {view === 'reader' && story && (
        <Reader story={story} color={M.color} onActivity={() => go('activity')} onSave={save}
          canDraw={hasKey()} busyCut={busyCut} drawingAll={drawingAll} drawError={drawError} onDrawCut={drawCut} onDrawAll={drawAll}
          imgSize={imgSize} onImgSize={setImgSize} />
      )}

      {view === 'activity' && story && <Activity story={story} color={M.color} onBack={() => go('reader')} onLibrary={() => { save(); go('library'); }} />}

      {view === 'library' && (
        <Stack gap={12}>
          <h3 className="learn-h" style={{ color: M.color }}>📚 내 책장 ({lib.length})</h3>
          {lib.length === 0 && <p style={{ color: 'var(--faint)', fontSize: 14 }}>아직 저장한 동화가 없어요. 새 동화를 만들어 보세요!</p>}
          <div className="sb-shelf">
            {lib.map((b, i) => {
              const [g1, g2] = GRADIENTS[i % GRADIENTS.length];
              return (
                <div key={b.id} className="sb-shelf__item">
                  <button className="sb-shelf__cover" style={b.images?.[0]
                    ? { backgroundImage: `linear-gradient(transparent 55%, rgba(0,0,0,.6)), url(${b.images[0]})`, backgroundSize: 'cover', backgroundPosition: 'center', justifyContent: 'flex-end' }
                    : { background: `linear-gradient(135deg, ${g1}, ${g2})` }} onClick={() => { setStory(b); go('reader'); }}>
                    {!b.images?.[0] && <span className="sb-shelf__art">{b.scenes[0]?.art || '📖'}</span>}
                    <span className="sb-shelf__title">{b.title}</span>
                  </button>
                  <button className="sb-shelf__del" onClick={() => setLib(lib.filter((x) => x.id !== b.id))}>✕</button>
                </div>
              );
            })}
          </div>
          <button className="btn" style={{ background: M.color, alignSelf: 'flex-start' }} onClick={() => go('create')}>＋ 새 동화 만들기</button>
        </Stack>
      )}
    </Stack>
  );
}

export default function App() { return <AppLayout m={M} feature={<Feature />} />; }
