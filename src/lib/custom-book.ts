/**
 * 내 프롬프트 그림책 — 사용자가 입력한 설정/줄거리를 "같은 캐릭터·같은 화풍"으로
 * 이어지는 5~10컷의 삽화로 생성한다.
 *
 * 일관성(consistency)의 핵심:
 *  DALL·E 3에는 seed/참조 이미지 옵션이 없어 컷마다 그림체가 흔들리기 쉽다.
 *  그래서 먼저 입력 설정에서 "캐릭터 시트(시각 ID)"를 한 번 만들어 두고,
 *  모든 컷의 이미지 프롬프트 앞단에 그 시트를 그대로 주입한다.
 *  → 컷이 바뀌어도 외형·의상·색팔레트·화풍이 동일하게 유지된다.
 */
import { ask, generateImage, hasKey } from './ai';

export interface CutPlan { caption: string; scene: string }
export interface CutResult { caption: string; scene: string; emoji: string; image?: string }

/** 키 없을 때(또는 이미지 실패 시) 컷을 채울 이모지 풀 */
const EMOJI_POOL = ['🌟', '🌳', '🏞️', '🌙', '🐯', '🦋', '🏯', '🎐', '🌸', '⛰️', '🔥', '💧', '🌈', '👑', '🎁', '🌻'];
export const cutEmoji = (i: number): string => EMOJI_POOL[i % EMOJI_POOL.length];

/** 생성할 컷 수 — 1컷부터, 상한 없음 */
export const MIN_CUTS = 1;
export const clampCuts = (n: number): number => Math.max(MIN_CUTS, Math.round(n) || MIN_CUTS);

/**
 * 모든 컷에 동일하게 주입할 "캐릭터 시트(시각 ID)"를 만든다.
 * 외형·의상·색팔레트·화풍만 묘사하고 장면 동작은 제외 → 컷 간 일관성 유지.
 * 키가 없으면 사용자의 원문 설정을 그대로 ID로 사용한다.
 */
export async function buildStyleSheet(charId: string): Promise<string> {
  const base = charId.trim();
  if (!hasKey() || !base) return base;
  try {
    const out = await ask(
      '너는 그림책 아트 디렉터다. 주어진 설정을 바탕으로, 한 편의 동화 안 여러 삽화에서 ' +
        '"동일하게" 유지해야 할 캐릭터 외형·의상·색팔레트·화풍을 영어로 아주 구체적으로 한 단락(80단어 이내)으로 묘사하라. ' +
        '이것은 매 컷 프롬프트에 그대로 붙일 "character & style sheet"다. 특정 장면의 동작·배경은 넣지 말고 변하지 않는 시각 정체성만 적어라.',
      base,
      { temperature: 0.5, max_tokens: 400 },
    );
    return out.trim() || base;
  } catch {
    return base;
  }
}

/**
 * 설정 + 줄거리/요청을 정확히 n개의 컷으로 분할한다.
 * 각 컷 = 아이에게 읽어줄 한국어 본문(caption) + 삽화용 영어 장면 묘사(scene).
 * 키가 없으면 사용자가 줄바꿈으로 적은 줄을 컷으로 쓰고 모자라면 자동으로 채운다.
 */
export async function planCuts(charId: string, concept: string, n: number): Promise<CutPlan[]> {
  const lines = concept.split('\n').map((s) => s.trim()).filter(Boolean);
  const fill = (count: number): CutPlan[] =>
    Array.from({ length: count }, (_, i) => ({
      caption: lines[i] || `${i + 1}번째 장면`,
      scene: lines[i] || concept.trim() || charId.trim(),
    }));

  if (!hasKey()) return fill(n);

  try {
    const out = await ask(
      `너는 그림책 작가다. 설정과 줄거리를 받아 정확히 ${n}개의 컷으로 나눈다. ` +
        '컷들은 기승전결로 자연스럽게 이어져야 하고 주인공은 동일하게 유지된다. ' +
        '반드시 JSON만 출력: {"cuts":[{"caption":"아이에게 읽어줄 따뜻한 한국어 본문 1~2문장","scene":"이 컷 삽화를 위한 영어 장면 묘사(인물 동작·구도·배경, 한 문장)"}]}',
      `설정/주인공: ${charId.trim()}\n줄거리/요청: ${concept.trim() || '설정에 어울리는 따뜻하고 교훈 있는 이야기를 자유롭게 만들어줘'}\n컷 수: ${n}`,
      { json: true, temperature: 0.8, max_tokens: Math.min(8000, 400 + n * 140) },
    );
    const p = JSON.parse(out);
    const cuts: CutPlan[] = Array.isArray(p.cuts)
      ? p.cuts.slice(0, n).map((c: { caption?: unknown; scene?: unknown }, i: number) => ({
          caption: String(c.caption || lines[i] || `${i + 1}번째 장면`),
          scene: String(c.scene || lines[i] || concept.trim() || charId.trim()),
        }))
      : [];
    if (!cuts.length) return fill(n);
    while (cuts.length < n) cuts.push(fill(n)[cuts.length]);
    return cuts;
  } catch {
    return fill(n);
  }
}

/**
 * 공유 캐릭터 시트(시각 ID) + 개별 컷 장면 → DALL·E 3 프롬프트.
 * 시리즈 전체에서 같은 캐릭터·화풍을 유지하도록 일관성 지시를 명시한다.
 */
export function cutImagePrompt(styleSheet: string, scene: string, idx: number, total: number): string {
  return (
    "Children's picture book illustration, warm and gentle. " +
    `CONSISTENT CHARACTER & STYLE — keep identical across the whole series: ${styleSheet}. ` +
    `This is illustration ${idx + 1} of ${total} in one continuous story; ` +
    `same character design, proportions, outfit, art style and color palette as the other cuts. ` +
    `Vertical portrait composition for a picture-book page. ` +
    `Scene of this cut: ${scene}. No text, no words, no letters, no captions in the image.`
  );
}

/**
 * 한 컷의 삽화를 생성한다. 키가 없거나 실패하면 image 없이 이모지로 폴백.
 */
export async function renderCut(styleSheet: string, plan: CutPlan, idx: number, total: number): Promise<CutResult> {
  const base: CutResult = { caption: plan.caption, scene: plan.scene, emoji: cutEmoji(idx) };
  if (!hasKey()) return base;
  try {
    const image = await generateImage(cutImagePrompt(styleSheet, plan.scene, idx, total), { size: '1024x1024' });
    return { ...base, image };
  } catch {
    return base;
  }
}
